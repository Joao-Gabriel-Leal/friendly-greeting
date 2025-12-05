import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SuspensionLiftedEmailRequest {
  userEmail: string;
  userName: string;
  liftedByAdmin: boolean; // true se removido manualmente, false se expirou naturalmente
  specialty?: string; // Se for suspensão de especialidade específica
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-suspension-lifted-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, liftedByAdmin, specialty }: SuspensionLiftedEmailRequest = await req.json();

    console.log("Sending suspension lifted email to:", userEmail);
    console.log("Details:", { liftedByAdmin, specialty });

    const title = liftedByAdmin ? "Suspensão Removida" : "Suspensão Encerrada";
    const message = liftedByAdmin 
      ? "A administração removeu sua suspensão manualmente." 
      : "O período de suspensão chegou ao fim.";

    const suspensionType = specialty 
      ? `para a especialidade <strong>${specialty}</strong>` 
      : `da sua conta`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Agendamentos <onboarding@resend.dev>",
        to: [userEmail],
        subject: `✅ ${title} - Acesso Liberado`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .highlight { background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
              .cta-button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 24px;">🎉 ${title}</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Seu acesso foi restaurado</p>
              </div>
              <div class="content">
                <p>Olá, <strong>${userName}</strong>!</p>
                <p>Temos boas notícias! ${message}</p>
                
                <div class="highlight">
                  <strong>✅ Acesso Liberado:</strong> Seu acesso ${suspensionType} foi restaurado e você já pode realizar novos agendamentos ${specialty ? `para ${specialty}` : ''}.
                </div>

                <p style="margin-top: 20px;">Lembre-se de seguir as regras do sistema para evitar futuras suspensões:</p>
                <ul>
                  <li>Não cancele consultas no dia do agendamento</li>
                  <li>Compareça aos agendamentos confirmados</li>
                  <li>Respeite o limite de 1 agendamento por especialidade por mês</li>
                </ul>

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
        `,
      }),
    });

    const data = await emailResponse.json();
    console.log("Email response:", data);

    if (!emailResponse.ok) {
      throw new Error(data.message || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending suspension lifted email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
