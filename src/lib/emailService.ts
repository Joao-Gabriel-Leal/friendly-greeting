import { supabase } from '@/integrations/supabase/client';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  userName?: string;
}

interface AppointmentEmailData {
  userEmail: string;
  userName: string;
  specialty: string;
  professionalName: string;
  appointmentDate: string;
  appointmentTime: string;
}

interface SuspensionEmailData {
  userEmail: string;
  userName: string;
  reason: string;
  suspendedUntil?: string;
  specialty?: string;
}

interface ReminderEmailData {
  userEmail: string;
  userName: string;
  specialty: string;
  professionalName: string;
  appointmentDate: string;
  appointmentTime: string;
  hoursUntil: number;
}

// Serviço de e-mail preparado para SMTP do Outlook/Microsoft 365
export const emailService = {
  // E-mail de confirmação de agendamento
  async sendConfirmationEmail(data: AppointmentEmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.functions.invoke('send-confirmation-email', {
        body: data,
      });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error sending confirmation email:', error);
      return { success: false, error: error.message };
    }
  },

  // E-mail de cancelamento
  async sendCancellationEmail(data: AppointmentEmailData & { cancelledByAdmin?: boolean; sameDayCancellation?: boolean }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.functions.invoke('send-cancellation-email', {
        body: data,
      });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error sending cancellation email:', error);
      return { success: false, error: error.message };
    }
  },

  // E-mail de suspensão/bloqueio de conta ou especialidade
  async sendSuspensionEmail(data: SuspensionEmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.functions.invoke('send-suspension-email', {
        body: data,
      });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error sending suspension email:', error);
      return { success: false, error: error.message };
    }
  },

  // E-mail de reativação de conta/especialidade
  async sendSuspensionLiftedEmail(data: { userEmail: string; userName: string; liftedByAdmin: boolean; specialty?: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.functions.invoke('send-suspension-lifted-email', {
        body: data,
      });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error sending suspension lifted email:', error);
      return { success: false, error: error.message };
    }
  },

  // E-mail de lembrete
  async sendReminderEmail(data: ReminderEmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.functions.invoke('send-reminder-email', {
        body: data,
      });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error sending reminder email:', error);
      return { success: false, error: error.message };
    }
  },

  // E-mail de reagendamento
  async sendRescheduleEmail(data: AppointmentEmailData & { oldDate: string; oldTime: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.functions.invoke('send-reschedule-email', {
        body: data,
      });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error sending reschedule email:', error);
      return { success: false, error: error.message };
    }
  },

  // E-mail de feedback/pesquisa de satisfação
  async sendFeedbackEmail(data: AppointmentEmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.functions.invoke('send-feedback-email', {
        body: data,
      });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error sending feedback email:', error);
      return { success: false, error: error.message };
    }
  },

  // E-mail de boas-vindas
  async sendWelcomeEmail(data: { userEmail: string; userName: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.functions.invoke('send-welcome-email', {
        body: data,
      });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error sending welcome email:', error);
      return { success: false, error: error.message };
    }
  },

  // E-mail de não comparecimento
  async sendNoShowEmail(data: AppointmentEmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.functions.invoke('send-noshow-email', {
        body: data,
      });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error sending no-show email:', error);
      return { success: false, error: error.message };
    }
  },

  // E-mail de conta bloqueada
  async sendAccountBlockedEmail(data: { userEmail: string; userName: string; reason: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.functions.invoke('send-account-blocked-email', {
        body: data,
      });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error sending account blocked email:', error);
      return { success: false, error: error.message };
    }
  },
};
