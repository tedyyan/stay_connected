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
    const { eventId } = await req.json();

    if (!eventId) {
      throw new Error("Event ID is required");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    // Get the event to verify it exists and get user_id
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError) {
      throw new Error(`Event not found: ${eventError.message}`);
    }

    // Update the last check-in time and ensure status is 'running'
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("events")
      .update({
        last_check_in: now,
        status: "running",
        updated_at: now,
      })
      .eq("id", eventId);

    if (updateError) {
      throw new Error(`Failed to update check-in time: ${updateError.message}`);
    }

    // Log the activity
    await supabase.from("activity_logs").insert({
      user_id: event.user_id,
      event_id: eventId,
      action: "check_in",
      details: { timestamp: now, event_name: event.name },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Check-in successful",
        timestamp: now,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error(`Error processing check-in: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
