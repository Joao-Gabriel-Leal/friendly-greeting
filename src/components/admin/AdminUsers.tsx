import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Edit, Trash2, Ban, CheckCircle, Search, KeyRound, ShieldX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SpecialtyBlock {
  specialty: string;
  blocked_until: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  department: string | null;
  suspended_until: string | null;
  blocked_specialties?: SpecialtyBlock[];
  created_at: string;
}

const SPECIALTIES = ['Massagem', 'Nutrição', 'Psicologia'];

const DEPARTMENTS = [
  'Administração',
  'Financeiro',
  'Recursos Humanos',
  'Marketing',
  'Adesão/Comercial',
  'Produção/Operações',
  'Logística',
  'Tecnologia da Informação',
  'Jurídico',
  'Atendimento ao Cliente',
] as const;

export default function AdminUsers() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'user' as 'user' | 'admin', department: '' });
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesData && !profilesError) {
      // Fetch specialty blocks for all users
      const { data: blocksData } = await supabase
        .from('user_specialty_blocks')
        .select('user_id, specialty, blocked_until')
        .gte('blocked_until', new Date().toISOString());

      const usersWithBlocks = profilesData.map(user => ({
        ...user,
        blocked_specialties: blocksData?.filter(b => b.user_id === user.id).map(b => ({
          specialty: b.specialty,
          blocked_until: b.blocked_until
        })) || []
      }));

      setUsers(usersWithBlocks as User[]);
    }
    setLoading(false);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ name: user.name, email: user.email, role: user.role, department: user.department || '' });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!editingUser) return;

    const { error } = await supabase
      .from('profiles')
      .update({ name: formData.name, role: formData.role, department: formData.department || null })
      .eq('id', editingUser.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o usuário.' });
    } else {
      // Also update user_roles table
      await supabase.from('user_roles').upsert({ 
        user_id: editingUser.id, 
        role: formData.role 
      }, { onConflict: 'user_id,role' });

      toast({ title: 'Sucesso', description: 'Usuário atualizado com sucesso.' });
      fetchUsers();
      setShowDialog(false);
    }
  };

  const handleSuspend = async (userId: string, suspend: boolean) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const suspendedUntil = suspend 
      ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() 
      : null;

    const { error } = await supabase
      .from('profiles')
      .update({ suspended_until: suspendedUntil })
      .eq('id', userId);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar a suspensão.' });
    } else {
      // Enviar e-mail de notificação
      try {
        if (suspend) {
          await supabase.functions.invoke('send-suspension-email', {
            body: {
              userEmail: user.email,
              userName: user.name,
              reason: 'Suspensão aplicada pela administração',
              suspendedUntil: suspendedUntil
            }
          });
        } else {
          await supabase.functions.invoke('send-suspension-lifted-email', {
            body: {
              userEmail: user.email,
              userName: user.name,
              liftedByAdmin: true
            }
          });
        }
      } catch (emailError) {
        console.error('Erro ao enviar e-mail:', emailError);
      }

      toast({ 
        title: 'Sucesso', 
        description: suspend ? 'Usuário suspenso por 60 dias.' : 'Suspensão removida.' 
      });
      fetchUsers();
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) return;

    const { error } = await supabase.from('profiles').delete().eq('id', userId);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o usuário.' });
    } else {
      toast({ title: 'Sucesso', description: 'Usuário excluído com sucesso.' });
      fetchUsers();
    }
  };

  const handleBlockSpecialties = (user: User) => {
    setEditingUser(user);
    setSelectedSpecialties([]);
    setShowBlockDialog(true);
  };

  const handleSaveSpecialtyBlock = async () => {
    if (!editingUser || selectedSpecialties.length === 0) return;

    const blockedUntil = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const promises = selectedSpecialties.map(specialty =>
      supabase.from('user_specialty_blocks').upsert({
        user_id: editingUser.id,
        specialty,
        blocked_until: blockedUntil
      }, { onConflict: 'user_id,specialty' })
    );

    const results = await Promise.all(promises);
    const hasError = results.some(r => r.error);

    if (hasError) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível bloquear especialidades.' });
    } else {
      toast({ 
        title: 'Sucesso', 
        description: `${selectedSpecialties.length} especialidade(s) bloqueada(s) por 60 dias.` 
      });
      fetchUsers();
      setShowBlockDialog(false);
      setSelectedSpecialties([]);
    }
  };

  const handleUnblockSpecialty = async (userId: string, specialty: string) => {
    const user = users.find(u => u.id === userId);
    
    const { error } = await supabase
      .from('user_specialty_blocks')
      .delete()
      .eq('user_id', userId)
      .eq('specialty', specialty);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível desbloquear especialidade.' });
    } else {
      // Enviar e-mail de notificação
      if (user) {
        try {
          await supabase.functions.invoke('send-suspension-lifted-email', {
            body: {
              userEmail: user.email,
              userName: user.name,
              liftedByAdmin: true,
              specialty: specialty
            }
          });
        } catch (emailError) {
          console.error('Erro ao enviar e-mail:', emailError);
        }
      }

      toast({ title: 'Sucesso', description: `Especialidade ${specialty} desbloqueada.` });
      fetchUsers();
    }
  };

  const handleChangePassword = (user: User) => {
    setEditingUser(user);
    setNewPassword('');
    setShowPasswordDialog(true);
  };

  const handleSavePassword = async () => {
    if (!editingUser || newPassword.length < 6) {
      toast({ 
        variant: 'destructive', 
        title: 'Erro', 
        description: 'A senha deve ter no mínimo 6 caracteres.' 
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            userId: editingUser.id,
            newPassword: newPassword,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        toast({ 
          variant: 'destructive', 
          title: 'Erro', 
          description: result.error || 'Não foi possível alterar a senha.' 
        });
      } else {
        toast({ title: 'Sucesso', description: 'Senha alterada com sucesso.' });
        setShowPasswordDialog(false);
        setNewPassword('');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Erro', 
        description: 'Erro ao alterar a senha. Tente novamente.' 
      });
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(user => {
                const isSuspended = user.suspended_until && new Date(user.suspended_until) > new Date();
                
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {user.department || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin' 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-secondary text-secondary-foreground'
                      }`}>
                        {user.role === 'admin' ? 'Admin' : 'Usuário'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {isSuspended ? (
                          <span className="text-destructive text-sm block">
                            Suspenso até {format(parseISO(user.suspended_until!), 'dd/MM/yyyy')}
                          </span>
                        ) : (
                          <span className="text-success text-sm block">Ativo</span>
                        )}
                        {user.blocked_specialties && user.blocked_specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.blocked_specialties.map((block: SpecialtyBlock) => (
                              <span 
                                key={block.specialty}
                                className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 flex items-center gap-1"
                              >
                                {block.specialty}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnblockSpecialty(user.id, block.specialty);
                                  }}
                                  className="hover:text-orange-900"
                                  title="Desbloquear"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(parseISO(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(user)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleBlockSpecialties(user)} 
                          title="Bloquear especialidades"
                        >
                          <ShieldX className="h-4 w-4 text-orange-500" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleChangePassword(user)} 
                          title="Alterar senha"
                        >
                          <KeyRound className="h-4 w-4 text-blue-500" />
                        </Button>
                        {isSuspended ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-success"
                            onClick={() => handleSuspend(user.id, false)}
                            title="Reativar usuário"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-warning"
                            onClick={() => handleSuspend(user.id, true)}
                            title="Suspender conta completa"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={() => handleDelete(user.id)}
                          title="Excluir usuário"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={formData.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.role} onValueChange={(v: 'user' | 'admin') => setFormData({ ...formData, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o departamento" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear Especialidades</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Selecione as especialidades que deseja bloquear por 60 dias para <strong>{editingUser?.name}</strong>:
            </p>
            <div className="space-y-3">
              {SPECIALTIES.map(specialty => (
                <div key={specialty} className="flex items-center space-x-2">
                  <Checkbox
                    id={`specialty-${specialty}`}
                    checked={selectedSpecialties.includes(specialty)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSpecialties([...selectedSpecialties, specialty]);
                      } else {
                        setSelectedSpecialties(selectedSpecialties.filter(s => s !== specialty));
                      }
                    }}
                  />
                  <Label htmlFor={`specialty-${specialty}`} className="cursor-pointer">
                    {specialty}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>Cancelar</Button>
            <Button 
              onClick={handleSaveSpecialtyBlock} 
              className="gradient-primary"
              disabled={selectedSpecialties.length === 0}
            >
              Bloquear Selecionadas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Definir nova senha para <strong>{editingUser?.name}</strong>:
            </p>
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancelar</Button>
            <Button onClick={handleSavePassword} className="gradient-primary">
              Alterar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
