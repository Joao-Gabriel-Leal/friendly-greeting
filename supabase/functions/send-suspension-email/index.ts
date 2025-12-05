import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SuspensionEmailRequest {
  userEmail: string;
  userName: string;
  reason: string;
  suspendedUntil: string;
  specialty?: string; // Se for suspensão de especialidade específica
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-suspension-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, reason, suspendedUntil, specialty }: SuspensionEmailRequest = await req.json();

    console.log("Sending suspension email to:", userEmail);
    console.log("Suspension details:", { reason, suspendedUntil, specialty });

    const formattedDate = new Date(suspendedUntil).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

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
        subject: "🚫 Conta Suspensa - Aviso Importante",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .detail-row { padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
              .detail-label { color: #6b7280; font-weight: 500; }
              .detail-value { color: #111827; font-weight: 600; float: right; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
              .warning { background: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 24px;">🚫 Acesso Suspenso</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Aviso importante sobre sua conta</p>
              </div>
              <div class="content">
                <p>Olá, <strong>${userName}</strong>!</p>
                <p>Informamos que seu acesso ${suspensionType} foi suspenso temporariamente.</p>
                
                <div class="details">
                  <div class="detail-row">
                    <span class="detail-label">📋 Motivo</span>
                    <span class="detail-value">${reason}</span>
                    <div style="clear: both;"></div>
                  </div>
                  <div class="detail-row" style="border-bottom: none;">
                    <span class="detail-label">📅 Suspenso até</span>
                    <span class="detail-value">${formattedDate}</span>
                    <div style="clear: both;"></div>
                  </div>
                </div>

                <div class="warning">
                  <strong>⚠️ Importante:</strong> Durante o período de suspensão, você não poderá realizar novos agendamentos ${specialty ? `para ${specialty}` : ''}. Após o término da suspensão, seu acesso será restaurado automaticamente.
                </div>

                <p style="margin-top: 20px;">Se você acredita que houve um engano, entre em contato com a administração.</p>
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
    console.error("Error sending suspension email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
