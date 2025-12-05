import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderEmailRequest {
  userEmail: string;
  userName: string;
  specialty: string;
  professionalName: string;
  date: string;
  time: string;
  hoursUntil: number;
}

const sendReminderEmail = async (data: ReminderEmailRequest) => {
  const { userEmail, userName, specialty, professionalName, date, time, hoursUntil } = data;

  console.log("Sending reminder email to:", userEmail);

  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const urgencyText = hoursUntil <= 1 
    ? "em 1 hora" 
    : hoursUntil <= 24 
      ? "amanhã" 
      : `em ${hoursUntil} horas`;

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Agendamentos <onboarding@resend.dev>",
      to: [userEmail],
      subject: `🔔 Lembrete: Sua consulta é ${urgencyText}!`,
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
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .highlight { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">🔔 Lembrete de Consulta</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Não se esqueça do seu compromisso!</p>
            </div>
            <div class="content">
              <p>Olá, <strong>${userName}</strong>!</p>
              
              <div class="highlight">
                <strong>Sua consulta é ${urgencyText}!</strong>
              </div>

              <p>Confira os detalhes do seu agendamento:</p>
              
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

  const responseData = await emailResponse.json();
  
  if (!emailResponse.ok) {
    throw new Error(responseData.message || "Failed to send email");
  }

  return responseData;
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-reminder-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Check if this is a single email request or a batch process request
    if (body.userEmail) {
      // Single email request
      const emailResponse = await sendReminderEmail(body as ReminderEmailRequest);
      console.log("Single reminder email sent:", emailResponse);

      return new Response(JSON.stringify({ success: true, data: emailResponse }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Batch process: find appointments needing reminders
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();

    // Get scheduled appointments that haven't received reminders
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        date,
        time,
        procedure,
        reminder_sent,
        profiles!appointments_user_id_fkey(email, name),
        professionals!appointments_professional_id_fkey(name)
      `)
      .eq('status', 'scheduled')
      .eq('reminder_sent', false);

    if (error) {
      console.error("Error fetching appointments:", error);
      throw error;
    }

    console.log("Found appointments:", appointments?.length || 0);

    const emailsSent: string[] = [];

    for (const apt of appointments || []) {
      const aptDateTime = new Date(`${apt.date}T${apt.time}`);
      const hoursUntil = (aptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      const profile = apt.profiles as any;
      const professional = apt.professionals as any;

      // Send 24h reminder (between 23-25 hours)
      if (hoursUntil >= 23 && hoursUntil <= 25) {
        try {
          await sendReminderEmail({
            userEmail: profile.email,
            userName: profile.name,
            specialty: apt.procedure,
            professionalName: professional.name,
            date: apt.date,
            time: apt.time,
            hoursUntil: 24
          });

          emailsSent.push(`24h reminder: ${profile.email}`);
          console.log("24h reminder sent to:", profile.email);
        } catch (e) {
          console.error("Error sending 24h reminder:", e);
        }
      }

      // Send 1h reminder (between 0.5-1.5 hours)
      if (hoursUntil >= 0.5 && hoursUntil <= 1.5) {
        try {
          await sendReminderEmail({
            userEmail: profile.email,
            userName: profile.name,
            specialty: apt.procedure,
            professionalName: professional.name,
            date: apt.date,
            time: apt.time,
            hoursUntil: 1
          });

          // Mark reminder as sent after 1h reminder
          await supabase
            .from('appointments')
            .update({ reminder_sent: true })
            .eq('id', apt.id);

          emailsSent.push(`1h reminder: ${profile.email}`);
          console.log("1h reminder sent to:", profile.email);
        } catch (e) {
          console.error("Error sending 1h reminder:", e);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      emailsSent,
      processedAt: now.toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-reminder-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
