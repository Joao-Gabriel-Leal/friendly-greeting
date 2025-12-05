import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationEmailRequest {
  userEmail: string;
  userName: string;
  specialty: string;
  professionalName: string;
  date: string;
  time: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-confirmation-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, specialty, professionalName, date, time }: ConfirmationEmailRequest = await req.json();

    console.log("Sending confirmation email to:", userEmail);
    console.log("Appointment details:", { specialty, professionalName, date, time });

    const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Agendamentos <onboarding@resend.dev>",
        to: [userEmail],
        subject: "✅ Agendamento Confirmado",
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
              .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .detail-row { padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
              .detail-label { color: #6b7280; font-weight: 500; }
              .detail-value { color: #111827; font-weight: 600; float: right; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
              .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 24px;">Agendamento Confirmado!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Seu horário está reservado</p>
              </div>
              <div class="content">
                <p>Olá, <strong>${userName}</strong>!</p>
                <p>Seu agendamento foi confirmado com sucesso. Confira os detalhes abaixo:</p>
                
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
                  <div class="detail-row">
                    <span class="detail-label">📅 Data</span>
                    <span class="detail-value">${formattedDate}</span>
                    <div style="clear: both;"></div>
                  </div>
                  <div class="detail-row" style="border-bottom: none;">
                    <span class="detail-label">🕐 Horário</span>
                    <span class="detail-value">${time}</span>
                    <div style="clear: both;"></div>
                  </div>
                </div>

                <div class="warning">
                  <strong>⚠️ Importante:</strong> Cancelamentos no dia da consulta ou não comparecimento resultam em suspensão de 60 dias para esta especialidade.
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
    console.error("Error sending confirmation email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
