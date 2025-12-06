// Cliente SMTP preparado para Microsoft 365/Outlook
// Configuração será preenchida pelo time de TI

interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

// Função para obter configuração SMTP do ambiente
export function getSmtpConfig(): SmtpConfig {
  return {
    host: Deno.env.get("SMTP_HOST") || "smtp.office365.com",
    port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
    secure: Deno.env.get("SMTP_SECURE") === "true",
    user: Deno.env.get("SMTP_USER") || "",
    pass: Deno.env.get("SMTP_PASS") || "",
    from: Deno.env.get("SMTP_FROM") || "noreply@empresa.com.br",
  };
}

// Verifica se SMTP está configurado
export function isSmtpConfigured(): boolean {
  const config = getSmtpConfig();
  return !!(config.user && config.pass);
}

// Envia e-mail via SMTP usando fetch para API do Microsoft Graph (alternativa) 
// ou pode ser adaptado para nodemailer quando o time de TI configurar
export async function sendEmail(message: EmailMessage): Promise<{ success: boolean; error?: string }> {
  const config = getSmtpConfig();
  
  if (!isSmtpConfigured()) {
    console.log("SMTP não configurado. E-mail seria enviado para:", message.to);
    console.log("Assunto:", message.subject);
    // Em desenvolvimento, apenas loga o e-mail
    return { success: true };
  }

  try {
    // Implementação usando SMTPClient do Deno
    // Esta é uma implementação básica que funciona com Outlook/Office 365
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    
    const client = new SMTPClient({
      connection: {
        hostname: config.host,
        port: config.port,
        tls: true,
        auth: {
          username: config.user,
          password: config.pass,
        },
      },
    });

    const recipients = Array.isArray(message.to) ? message.to : [message.to];
    
    await client.send({
      from: message.from || config.from,
      to: recipients,
      subject: message.subject,
      content: message.html,
      html: message.html,
    });

    await client.close();
    
    console.log("E-mail enviado com sucesso para:", recipients.join(", "));
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao enviar e-mail via SMTP:", error);
    return { success: false, error: error.message };
  }
}

// Headers CORS padrão
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
