import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateAccountRequest {
  professionalId: string;
  email: string;
  password: string;
  name: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify calling user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can create professional accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { professionalId, email, password, name }: CreateAccountRequest = await req.json();

    console.log("Creating account for professional:", professionalId, email);

    // Create auth user
    const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        setor: 'Profissional'
      }
    });

    if (createUserError) {
      console.error("Error creating user:", createUserError);
      return new Response(
        JSON.stringify({ error: createUserError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = authData.user.id;

    // Link professional to user
    const { error: updateProfError } = await supabaseAdmin
      .from("professionals")
      .update({ user_id: newUserId })
      .eq("id", professionalId);

    if (updateProfError) {
      console.error("Error linking professional:", updateProfError);
    }

    // Set role as professional
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ 
        user_id: newUserId, 
        role: 'professional' 
      }, { onConflict: 'user_id' });

    if (roleError) {
      console.error("Error setting role:", roleError);
    }

    console.log("Professional account created successfully:", newUserId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: newUserId,
        message: "Conta criada com sucesso" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in create-professional-account:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
