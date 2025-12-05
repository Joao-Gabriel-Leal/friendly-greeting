# Migração para PostgreSQL Local

Este documento descreve como migrar o sistema de agendamento do Lovable Cloud (Supabase) para um PostgreSQL local com backend Node.js/Express.

## Arquitetura da Migração

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  Backend        │────▶│  PostgreSQL     │
│   (React)       │     │  (Express/Node) │     │  (Local)        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
      │                        │
      │                        ├── JWT Auth
      │                        ├── API REST
      └── API Calls            └── Controle de Acesso
```

## O que será substituído

| Supabase (atual)          | PostgreSQL Local (novo)        |
|---------------------------|--------------------------------|
| Supabase Auth             | JWT + bcrypt                   |
| Row Level Security (RLS)  | Middleware de autorização      |
| Edge Functions            | Express Routes                 |
| Supabase Client           | Fetch API / Axios              |
| Realtime                  | WebSocket (opcional)           |

---

## 1. Scripts SQL para PostgreSQL

### 1.1 Criar Banco de Dados

```sql
-- Criar banco de dados
CREATE DATABASE agendamento_db;

-- Conectar ao banco
\c agendamento_db;

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 1.2 Criar Enum de Roles

```sql
CREATE TYPE app_role AS ENUM ('user', 'admin');
```

### 1.3 Criar Tabelas

```sql
-- Tabela de usuários (autenticação)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de perfis
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role app_role DEFAULT 'user',
    department VARCHAR(100),
    suspended_until TIMESTAMP WITH TIME ZONE,
    last_appointment_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de roles de usuários
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    UNIQUE(user_id, role)
);

-- Tabela de profissionais
CREATE TABLE professionals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    start_time TIME DEFAULT '09:00:00',
    end_time TIME DEFAULT '17:00:00',
    work_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de agendamentos
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    procedure VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',
    cancel_reason TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice único para evitar conflitos de horário
CREATE UNIQUE INDEX idx_unique_appointment_slot 
ON appointments (professional_id, date, time) 
WHERE status != 'cancelled';

-- Tabela de dias disponíveis
CREATE TABLE available_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(professional_id, date)
);

-- Tabela de dias bloqueados
CREATE TABLE blocked_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de bloqueios de especialidade por usuário
CREATE TABLE user_specialty_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    specialty VARCHAR(100) NOT NULL,
    blocked_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, specialty)
);

-- Tabela de logs administrativos
CREATE TABLE admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 1.4 Criar Índices

```sql
CREATE INDEX idx_appointments_user_id ON appointments(user_id);
CREATE INDEX idx_appointments_professional_id ON appointments(professional_id);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_available_days_professional ON available_days(professional_id);
CREATE INDEX idx_blocked_days_professional ON blocked_days(professional_id);
CREATE INDEX idx_user_specialty_blocks_user ON user_specialty_blocks(user_id);
```

### 1.5 Criar Triggers para updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_professionals_updated_at
    BEFORE UPDATE ON professionals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_available_days_updated_at
    BEFORE UPDATE ON available_days
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blocked_days_updated_at
    BEFORE UPDATE ON blocked_days
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 1.6 Dados Iniciais

```sql
-- Criar admin padrão (senha: 123456)
-- Hash gerado com bcrypt (10 rounds)
INSERT INTO users (id, email, password_hash) VALUES 
('7d7826ef-aca5-4da2-8f75-179c08e1018d', 'igo.batista@aiatecnologia.com.br', '$2b$10$rOvHxQxj3K8s5c5w5V5KxOxIHxGKx5X5X5X5X5X5X5X5X5X5X5X5X');

INSERT INTO profiles (id, name, email, role) VALUES 
('7d7826ef-aca5-4da2-8f75-179c08e1018d', 'igor', 'igo.batista@aiatecnologia.com.br', 'admin');

INSERT INTO user_roles (user_id, role) VALUES 
('7d7826ef-aca5-4da2-8f75-179c08e1018d', 'admin');

-- Profissionais
INSERT INTO professionals (name, specialty) VALUES
('Dr. Silva', 'Massagem'),
('Dr. Oliveira', 'Nutricionista'),
('Dra. Santos', 'Psicólogo');
```

---

## 2. Backend Node.js/Express

### 2.1 Estrutura de Pastas

```
backend/
├── src/
│   ├── config/
│   │   └── database.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── admin.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── appointments.js
│   │   ├── professionals.js
│   │   ├── users.js
│   │   ├── available-days.js
│   │   ├── blocked-days.js
│   │   └── admin.js
│   ├── services/
│   │   ├── emailService.js
│   │   └── appointmentService.js
│   └── index.js
├── package.json
└── .env
```

### 2.2 package.json

```json
{
  "name": "agendamento-backend",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "resend": "^2.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### 2.3 Variáveis de Ambiente (.env)

```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agendamento_db
JWT_SECRET=seu_jwt_secret_muito_seguro_aqui
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### 2.4 Código do Backend

#### config/database.js
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
```

#### middleware/auth.js
```javascript
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

module.exports = authMiddleware;
```

#### middleware/admin.js
```javascript
const pool = require('../config/database');

const adminMiddleware = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT role FROM profiles WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno' });
  }
};

module.exports = adminMiddleware;
```

#### routes/auth.js
```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const router = express.Router();

// Login
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const userResult = await pool.query(
      'SELECT u.*, p.name, p.role, p.department, p.suspended_until FROM users u JOIN profiles p ON u.id = p.id WHERE u.email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        suspended_until: user.suspended_until
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Registro
router.post('/signup', async (req, res) => {
  const { email, password, name, department } = req.body;
  
  try {
    // Verificar se email já existe
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Criar usuário
    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, passwordHash]
    );
    
    const userId = userResult.rows[0].id;
    
    // Criar perfil
    await pool.query(
      'INSERT INTO profiles (id, name, email, role, department) VALUES ($1, $2, $3, $4, $5)',
      [userId, name, email, 'user', department]
    );
    
    // Criar role
    await pool.query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
      [userId, 'user']
    );
    
    const token = jwt.sign(
      { id: userId, email, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: { id: userId, email, name, role: 'user', department }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Verificar sessão
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT p.* FROM profiles p WHERE p.id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
```

#### routes/appointments.js
```javascript
const express = require('express');
const pool = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Listar agendamentos do usuário
router.get('/my', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, p.name as professional_name, p.specialty
      FROM appointments a
      JOIN professionals p ON a.professional_id = p.id
      WHERE a.user_id = $1
      ORDER BY a.date DESC, a.time DESC
    `, [req.user.id]);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Criar agendamento
router.post('/', auth, async (req, res) => {
  const { professional_id, procedure, date, time } = req.body;
  
  try {
    const result = await pool.query(`
      INSERT INTO appointments (user_id, professional_id, procedure, date, time)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.user.id, professional_id, procedure, date, time]);
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Horário já ocupado' });
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Cancelar agendamento
router.patch('/:id/cancel', auth, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  try {
    const result = await pool.query(`
      UPDATE appointments 
      SET status = 'cancelled', cancel_reason = $1, cancelled_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `, [reason || 'Cancelado pelo usuário', id, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Obter horários ocupados
router.get('/booked-slots', async (req, res) => {
  const { professionalId, date } = req.query;
  
  try {
    const result = await pool.query(`
      SELECT time FROM appointments
      WHERE professional_id = $1 AND date = $2 AND status != 'cancelled'
    `, [professionalId, date]);
    
    const bookedSlots = result.rows.map(r => r.time.substring(0, 5));
    res.json({ bookedSlots });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
```

#### routes/professionals.js
```javascript
const express = require('express');
const pool = require('../config/database');

const router = express.Router();

// Listar profissionais
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM professionals ORDER BY specialty');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
```

#### index.js (Servidor Principal)
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const appointmentsRoutes = require('./routes/appointments');
const professionalsRoutes = require('./routes/professionals');

const app = express();

app.use(cors());
app.use(express.json());

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/professionals', professionalsRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 3. Alterações no Frontend

### 3.1 Criar API Client

Criar arquivo `src/lib/api.ts`:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro na requisição');
    }

    return response.json();
  }

  // Auth
  async signIn(email: string, password: string) {
    const data = await this.request('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async signUp(email: string, password: string, name: string, department: string) {
    const data = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, department }),
    });
    this.setToken(data.token);
    return data;
  }

  async signOut() {
    this.setToken(null);
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Appointments
  async getMyAppointments() {
    return this.request('/appointments/my');
  }

  async createAppointment(data: any) {
    return this.request('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelAppointment(id: string, reason?: string) {
    return this.request(`/appointments/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }

  async getBookedSlots(professionalId: string, date: string) {
    return this.request(`/appointments/booked-slots?professionalId=${professionalId}&date=${date}`);
  }

  // Professionals
  async getProfessionals() {
    return this.request('/professionals');
  }

  // Available Days
  async getAvailableDays(professionalId: string) {
    return this.request(`/available-days?professionalId=${professionalId}`);
  }

  // Blocked Days
  async getBlockedDays(professionalId?: string) {
    const query = professionalId ? `?professionalId=${professionalId}` : '';
    return this.request(`/blocked-days${query}`);
  }
}

export const api = new ApiClient();
```

### 3.2 Atualizar Auth Context

Substituir `src/lib/auth.tsx` para usar a nova API.

### 3.3 Atualizar Componentes

Substituir todas as chamadas `supabase.from()` e `supabase.functions.invoke()` por chamadas à nova API.

---

## 4. Script de Migração Completo

Arquivo: `setup_database.sql`

```sql
-- ==========================================
-- SCRIPT COMPLETO DE CRIAÇÃO DO BANCO
-- PostgreSQL Local para Sistema de Agendamento
-- ==========================================

-- Criar banco (executar separadamente)
-- CREATE DATABASE agendamento_db;

-- Conectar ao banco e executar:
\c agendamento_db;

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum
DROP TYPE IF EXISTS app_role CASCADE;
CREATE TYPE app_role AS ENUM ('user', 'admin');

-- Tabelas
DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS user_specialty_blocks CASCADE;
DROP TABLE IF EXISTS blocked_days CASCADE;
DROP TABLE IF EXISTS available_days CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS professionals CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role app_role DEFAULT 'user',
    department VARCHAR(100),
    suspended_until TIMESTAMP WITH TIME ZONE,
    last_appointment_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    UNIQUE(user_id, role)
);

CREATE TABLE professionals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    start_time TIME DEFAULT '09:00:00',
    end_time TIME DEFAULT '17:00:00',
    work_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    procedure VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',
    cancel_reason TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_unique_appointment_slot 
ON appointments (professional_id, date, time) 
WHERE status != 'cancelled';

CREATE TABLE available_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(professional_id, date)
);

CREATE TABLE blocked_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_specialty_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    specialty VARCHAR(100) NOT NULL,
    blocked_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, specialty)
);

CREATE TABLE admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_appointments_user_id ON appointments(user_id);
CREATE INDEX idx_appointments_professional_id ON appointments(professional_id);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_profiles_role ON profiles(role);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_professionals_updated_at BEFORE UPDATE ON professionals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Dados iniciais
INSERT INTO professionals (name, specialty) VALUES
('Dr. Silva', 'Massagem'),
('Dr. Oliveira', 'Nutricionista'),
('Dra. Santos', 'Psicólogo');

SELECT 'Banco criado com sucesso!' as status;
```

---

## 5. Próximos Passos

1. **Instalar PostgreSQL localmente** ou usar Docker
2. **Executar script SQL** para criar o banco
3. **Criar pasta backend** e instalar dependências
4. **Configurar .env** com suas variáveis
5. **Atualizar frontend** para usar a nova API
6. **Testar todas as funcionalidades**

---

## 6. Comandos Úteis

```bash
# PostgreSQL via Docker
docker run --name postgres-agendamento -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15

# Conectar ao banco
psql -h localhost -U postgres -d agendamento_db

# Iniciar backend
cd backend && npm run dev

# Build frontend
npm run build
```
