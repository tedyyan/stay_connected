import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    // Call the check-inactivity function
    const { data, error } = await supabase.functions.invoke(
      "supabase-functions-check-inactivity",
      { body: {} },
    );

    if (error) {
      throw new Error(`Error invoking check-inactivity: ${error.message}`);
    }

    // Log the scheduled run
    await supabase.from("activity_logs").insert({
      user_id: "system", // Using "system" as a special user ID for system actions
      action: "scheduled_check",
      details: { result: data },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Scheduled check completed",
        data,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error(`Error in scheduled check: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
