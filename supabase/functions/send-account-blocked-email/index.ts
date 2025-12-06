import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmail, corsHeaders } from "../_shared/smtp-client.ts";

interface AccountBlockedEmailRequest {
  userEmail: string;
  userName: string;
  reason: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-account-blocked-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, reason }: AccountBlockedEmailRequest = await req.json();

    console.log("Sending account blocked email to:", userEmail);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7f1d1d, #991b1b); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .alert { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .info { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">🚫 Conta Bloqueada</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Seu acesso ao sistema foi bloqueado</p>
          </div>
          <div class="content">
            <p>Olá, <strong>${userName}</strong>,</p>
            <p>Informamos que sua conta no sistema de agendamentos foi <strong>bloqueada pela administração</strong>.</p>
            
            <div class="alert">
              <strong>🔒 Motivo do bloqueio:</strong><br><br>
              ${reason || "Decisão administrativa. Para mais informações, contate a administração."}
            </div>

            <div class="info">
              <strong>📞 O que fazer agora?</strong><br><br>
              Entre em contato com os administradores do sistema para:
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>Entender os motivos do bloqueio</li>
                <li>Solicitar a revisão do seu caso</li>
                <li>Verificar os passos para reativação</li>
              </ul>
            </div>

            <p>Enquanto sua conta estiver bloqueada, você não poderá acessar o sistema nem realizar agendamentos.</p>
          </div>
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda.</p>
            <p>Para esclarecimentos, contate a administração diretamente.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmail({
      to: userEmail,
      subject: "🚫 Conta Bloqueada - Sistema de Agendamentos",
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
    console.error("Error sending account blocked email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
