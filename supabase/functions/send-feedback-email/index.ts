import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FeedbackEmailRequest {
  userEmail: string;
  userName: string;
  specialty: string;
  professionalName: string;
  date: string;
  appointmentId: string;
}

async function sendFeedbackEmail(data: FeedbackEmailRequest) {
  const { userEmail, userName, specialty, professionalName, date, appointmentId } = data;

  console.log("Sending feedback email to:", userEmail);
  console.log("Appointment details:", { specialty, professionalName, date, appointmentId });

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
      subject: "⭐ Como foi sua consulta? Deixe seu feedback!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
            .detail-label { color: #6b7280; font-weight: 500; }
            .detail-value { color: #111827; font-weight: 600; float: right; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .stars { font-size: 32px; text-align: center; margin: 20px 0; }
            .star { color: #fbbf24; cursor: pointer; text-decoration: none; }
            .feedback-box { background: #ede9fe; border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">⭐ Sua opinião é importante!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Conte como foi sua experiência</p>
            </div>
            <div class="content">
              <p>Olá, <strong>${userName}</strong>!</p>
              <p>Esperamos que sua consulta tenha sido excelente! Gostaríamos de saber como foi sua experiência.</p>
              
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
                <div class="detail-row" style="border-bottom: none;">
                  <span class="detail-label">📅 Data</span>
                  <span class="detail-value">${formattedDate}</span>
                  <div style="clear: both;"></div>
                </div>
              </div>

              <div class="feedback-box">
                <strong>💬 Sua avaliação nos ajuda a melhorar!</strong>
                <p style="margin: 10px 0 0 0;">Compartilhe sua experiência para que possamos continuar oferecendo o melhor atendimento.</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <p style="margin-bottom: 15px; color: #6b7280;">Como você avalia o atendimento?</p>
                <div class="stars">
                  <span class="star">⭐</span>
                  <span class="star">⭐</span>
                  <span class="star">⭐</span>
                  <span class="star">⭐</span>
                  <span class="star">⭐</span>
                </div>
                <p style="font-size: 14px; color: #9ca3af; margin-top: 10px;">
                  (Responda este email com sua nota de 1 a 5 e um comentário opcional)
                </p>
              </div>

              <p style="margin-top: 20px; text-align: center; color: #6b7280;">
                Agradecemos por usar nosso sistema de agendamentos!
              </p>
            </div>
            <div class="footer">
              <p>Este é um email automático. Responda com sua avaliação.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    }),
  });

  const responseData = await emailResponse.json();
  console.log("Email response:", responseData);

  if (!emailResponse.ok) {
    throw new Error(responseData.message || "Failed to send email");
  }

  return responseData;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-feedback-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Se receber dados diretos de um agendamento específico
    if (body.userEmail) {
      const data = await sendFeedbackEmail(body as FeedbackEmailRequest);
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Modo batch: buscar consultas completadas nas últimas 24h que não receberam feedback
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar consultas completadas nas últimas 24h
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: completedAppointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        date,
        time,
        procedure,
        professional_id,
        user_id,
        profiles!appointments_user_id_fkey (
          name,
          email
        ),
        professionals!appointments_professional_id_fkey (
          name,
          specialty
        )
      `)
      .eq('status', 'completed')
      .gte('date', yesterdayStr)
      .lte('date', yesterdayStr);

    if (error) {
      console.error("Error fetching completed appointments:", error);
      throw error;
    }

    console.log("Found completed appointments for feedback:", completedAppointments?.length || 0);

    const results = [];
    for (const appointment of completedAppointments || []) {
      try {
        const profile = appointment.profiles as any;
        const professional = appointment.professionals as any;

        if (profile?.email && professional?.name) {
          await sendFeedbackEmail({
            userEmail: profile.email,
            userName: profile.name,
            specialty: professional.specialty,
            professionalName: professional.name,
            date: appointment.date,
            appointmentId: appointment.id
          });
          results.push({ appointmentId: appointment.id, status: 'sent' });
        }
      } catch (emailError: any) {
        console.error(`Error sending feedback for appointment ${appointment.id}:`, emailError);
        results.push({ appointmentId: appointment.id, status: 'error', error: emailError.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-feedback-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
