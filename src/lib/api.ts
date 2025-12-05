const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  department: string | null;
  suspended_until: string | null;
  last_appointment_date: string | null;
}

interface AuthResponse {
  token: string;
  user: Profile;
}

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

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro na requisição' }));
      throw new Error(error.error || 'Erro na requisição');
    }

    return response.json();
  }

  // Auth
  async signIn(email: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async signUp(email: string, password: string, name: string, department: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, department }),
    });
    this.setToken(data.token);
    return data;
  }

  async signOut() {
    this.setToken(null);
  }

  async getMe(): Promise<Profile> {
    return this.request<Profile>('/auth/me');
  }

  // Profiles
  async getProfiles(): Promise<Profile[]> {
    return this.request<Profile[]>('/profiles');
  }

  async getProfile(id: string): Promise<Profile> {
    return this.request<Profile>(`/profiles/${id}`);
  }

  async updateProfile(id: string, data: Partial<Profile>): Promise<Profile> {
    return this.request<Profile>(`/profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Appointments
  async getMyAppointments(): Promise<any[]> {
    return this.request<any[]>('/appointments/my');
  }

  async getAllAppointments(): Promise<any[]> {
    return this.request<any[]>('/appointments');
  }

  async createAppointment(data: {
    professional_id: string;
    procedure: string;
    date: string;
    time: string;
  }): Promise<any> {
    return this.request<any>('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelAppointment(id: string, reason?: string): Promise<any> {
    return this.request<any>(`/appointments/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }

  async updateAppointmentStatus(id: string, status: string): Promise<any> {
    return this.request<any>(`/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getBookedSlots(professionalId: string, date: string): Promise<{ bookedSlots: string[] }> {
    return this.request<{ bookedSlots: string[] }>(
      `/appointments/booked-slots?professionalId=${professionalId}&date=${date}`
    );
  }

  // Professionals
  async getProfessionals(): Promise<any[]> {
    return this.request<any[]>('/professionals');
  }

  async createProfessional(data: any): Promise<any> {
    return this.request<any>('/professionals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProfessional(id: string, data: any): Promise<any> {
    return this.request<any>(`/professionals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProfessional(id: string): Promise<void> {
    return this.request<void>(`/professionals/${id}`, {
      method: 'DELETE',
    });
  }

  // Available Days
  async getAvailableDays(professionalId: string, startDate: string, endDate: string): Promise<any[]> {
    return this.request<any[]>(
      `/available-days?professionalId=${professionalId}&startDate=${startDate}&endDate=${endDate}`
    );
  }

  async createAvailableDay(professionalId: string, date: string): Promise<any> {
    return this.request<any>('/available-days', {
      method: 'POST',
      body: JSON.stringify({ professional_id: professionalId, date }),
    });
  }

  async deleteAvailableDay(id: string): Promise<void> {
    return this.request<void>(`/available-days/${id}`, {
      method: 'DELETE',
    });
  }

  // Blocked Days
  async getBlockedDays(professionalId?: string, startDate?: string, endDate?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (professionalId) params.append('professionalId', professionalId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<any[]>(`/blocked-days${query}`);
  }

  async createBlockedDay(data: { professional_id?: string; date: string; reason?: string }): Promise<any> {
    return this.request<any>('/blocked-days', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteBlockedDay(id: string): Promise<void> {
    return this.request<void>(`/blocked-days/${id}`, {
      method: 'DELETE',
    });
  }

  // Specialty Blocks
  async getSpecialtyBlocks(userId: string): Promise<any[]> {
    return this.request<any[]>(`/specialty-blocks?userId=${userId}`);
  }

  async getAllSpecialtyBlocks(): Promise<any[]> {
    return this.request<any[]>('/specialty-blocks');
  }

  async createSpecialtyBlock(userId: string, specialty: string, blockedUntil: string): Promise<any> {
    return this.request<any>('/specialty-blocks', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, specialty, blocked_until: blockedUntil }),
    });
  }

  async deleteSpecialtyBlock(id: string): Promise<void> {
    return this.request<void>(`/specialty-blocks/${id}`, {
      method: 'DELETE',
    });
  }

  // Admin
  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    return this.request<void>('/admin/update-password', {
      method: 'POST',
      body: JSON.stringify({ userId, newPassword }),
    });
  }

  async suspendUser(userId: string, suspendedUntil: string): Promise<any> {
    return this.request<any>(`/profiles/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ suspended_until: suspendedUntil }),
    });
  }

  async unsuspendUser(userId: string): Promise<any> {
    return this.request<any>(`/profiles/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ suspended_until: null }),
    });
  }

  // Send emails (para funcionalidades de email)
  async sendConfirmationEmail(data: {
    userEmail: string;
    userName: string;
    specialty: string;
    professionalName: string;
    date: string;
    time: string;
  }): Promise<void> {
    return this.request<void>('/emails/confirmation', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendCancellationEmail(data: {
    userEmail: string;
    userName: string;
    specialty: string;
    date: string;
    time: string;
    isSameDayCancellation?: boolean;
  }): Promise<void> {
    return this.request<void>('/emails/cancellation', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
