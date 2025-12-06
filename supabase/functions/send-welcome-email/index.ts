import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmail, corsHeaders, isSmtpConfigured } from "../_shared/smtp-client.ts";

interface WelcomeEmailRequest {
  userEmail: string;
  userName: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-welcome-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName }: WelcomeEmailRequest = await req.json();

    console.log("Sending welcome email to:", userEmail);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .highlight { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          .cta-button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
          .feature-list { list-style: none; padding: 0; }
          .feature-list li { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .feature-list li:last-child { border-bottom: none; }
          .feature-list li::before { content: "✓ "; color: #10b981; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">🎉 Bem-vindo(a) ao Sistema de Agendamentos!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Seu cadastro foi realizado com sucesso</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${userName}</strong>!</p>
            <p>É um prazer tê-lo(a) conosco! Seu cadastro foi concluído e você já pode começar a usar nosso sistema de agendamentos.</p>
            
            <div class="highlight">
              <strong>📋 Como usar o sistema:</strong>
            </div>

            <ul class="feature-list">
              <li><strong>Agendar consultas:</strong> Escolha a especialidade, data e horário disponíveis</li>
              <li><strong>Acompanhar agendamentos:</strong> Visualize todos os seus agendamentos no painel</li>
              <li><strong>Cancelar/Reagendar:</strong> Gerencie suas consultas com antecedência</li>
              <li><strong>Receber lembretes:</strong> Notificações por e-mail antes das consultas</li>
            </ul>

            <div class="highlight" style="background: #fef3c7; border-color: #f59e0b;">
              <strong>⚠️ Regras importantes:</strong>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>Limite de 1 agendamento por especialidade por mês</li>
                <li>Cancelamentos no dia do atendimento podem gerar suspensão</li>
                <li>Não comparecer ao atendimento pode resultar em penalidades</li>
              </ul>
            </div>

            <center>
              <a href="${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app')}/dashboard" class="cta-button">Acessar o Sistema</a>
            </center>
          </div>
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda.</p>
            <p>Em caso de dúvidas, contate a administração.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail({
      to: userEmail,
      subject: "🎉 Bem-vindo(a) ao Sistema de Agendamentos!",
      html,
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
