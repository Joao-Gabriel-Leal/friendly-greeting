import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmail, corsHeaders } from "../_shared/smtp-client.ts";

interface NoShowEmailRequest {
  userEmail: string;
  userName: string;
  specialty: string;
  professionalName: string;
  appointmentDate: string;
  appointmentTime: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-noshow-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, specialty, professionalName, appointmentDate, appointmentTime }: NoShowEmailRequest = await req.json();

    console.log("Sending no-show email to:", userEmail);

    // Format date for display
    const date = new Date(appointmentDate);
    const formattedDate = date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .warning { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .info { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          .cta-button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">⚠️ Ausência Registrada</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Você não compareceu ao seu agendamento</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${userName}</strong>,</p>
            <p>Registramos sua ausência no atendimento agendado:</p>
            
            <div class="warning">
              <strong>📋 Detalhes do agendamento perdido:</strong><br><br>
              <strong>Especialidade:</strong> ${specialty}<br>
              <strong>Profissional:</strong> ${professionalName}<br>
              <strong>Data:</strong> ${formattedDate}<br>
              <strong>Horário:</strong> ${appointmentTime}
            </div>

            <div class="info">
              <strong>📌 Lembrete das regras do sistema:</strong>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>O não comparecimento pode resultar em suspensão temporária</li>
                <li>Em caso de imprevisto, sempre cancele com antecedência</li>
                <li>Cancelamentos no mesmo dia podem gerar penalidades</li>
              </ul>
            </div>

            <p>Se houve algum problema que impediu sua presença, entre em contato com a administração para evitar penalidades.</p>

            <center>
              <a href="${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app')}/dashboard" class="cta-button">Fazer Novo Agendamento</a>
            </center>
          </div>
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail({
      to: userEmail,
      subject: "⚠️ Ausência Registrada - Agendamento Perdido",
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
    console.error("Error sending no-show email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
