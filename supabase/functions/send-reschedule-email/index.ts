import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RescheduleEmailRequest {
  userEmail: string;
  userName: string;
  specialty: string;
  professionalName: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-reschedule-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, specialty, professionalName, oldDate, oldTime, newDate, newTime }: RescheduleEmailRequest = await req.json();

    console.log("Sending reschedule email to:", userEmail);
    console.log("Reschedule details:", { specialty, professionalName, oldDate, oldTime, newDate, newTime });

    const formatDate = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formattedOldDate = formatDate(oldDate);
    const formattedNewDate = formatDate(newDate);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Agendamentos <onboarding@resend.dev>",
        to: [userEmail],
        subject: "🔄 Agendamento Reagendado",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .detail-row { padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
              .detail-label { color: #6b7280; font-weight: 500; }
              .detail-value { color: #111827; font-weight: 600; float: right; }
              .old-value { text-decoration: line-through; opacity: 0.6; color: #ef4444; }
              .new-value { color: #10b981; font-weight: 700; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
              .arrow { margin: 0 10px; color: #3b82f6; }
              .comparison { display: flex; justify-content: center; align-items: center; margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 24px;">🔄 Agendamento Alterado</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Seu horário foi reagendado</p>
              </div>
              <div class="content">
                <p>Olá, <strong>${userName}</strong>!</p>
                <p>Seu agendamento foi reagendado para uma nova data/horário. Confira os detalhes:</p>
                
                <div class="details">
                  <div class="detail-row">
                    <span class="detail-label">📋 Especialidade</span>
                    <span class="detail-value">${specialty}</span>
                    <div style="clear: both;"></div>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">👤 Profissional</span>
                    <span class="detail-value">${professionalName}</span>
                    <div style="clear: both;"></div>
                  </div>
                </div>

                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin: 0 0 15px 0; color: #374151;">📅 Alteração de Data</h3>
                  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;">
                    <div style="text-align: center; padding: 10px;">
                      <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px;">ANTES</div>
                      <div class="old-value">${formattedOldDate}</div>
                      <div class="old-value">${oldTime}</div>
                    </div>
                    <div style="font-size: 24px; color: #3b82f6;">→</div>
                    <div style="text-align: center; padding: 10px;">
                      <div style="font-size: 12px; color: #6b7280; margin-bottom: 5px;">AGORA</div>
                      <div class="new-value">${formattedNewDate}</div>
                      <div class="new-value">${newTime}</div>
                    </div>
                  </div>
                </div>

                <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <strong>ℹ️ Lembrete:</strong> Anote a nova data e horário para não perder sua consulta!
                </div>
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
    console.error("Error sending reschedule email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
