import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SendGrid } from "https://deno.land/x/sendgrid@0.0.3/mod.ts";
import { Telnyx } from "https://esm.sh/telnyx@1.25.5";

console.log("Edge Function starting...");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "notifications@example.com";
const FROM_PHONE = Deno.env.get("FROM_PHONE") || "+15555555555";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const sendgrid = new SendGrid(SENDGRID_API_KEY);
const telnyx = Telnyx(TELNYX_API_KEY);

serve(async (req) => {
  console.log(`Received ${req.method} request from ${req.headers.get('origin')}`);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // For non-OPTIONS requests, always include CORS headers
    const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

    // Validate that it's a POST request
    if (req.method !== "POST") {
      console.log("Method not allowed:", req.method);
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { headers, status: 405 }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    const apiKey = req.headers.get('apikey');
    console.log("Auth header present:", !!authHeader);
    console.log("API key present:", !!apiKey);

    // Create Supabase client
    console.log("Creating Supabase client...");
    const supabase = createClient(
      SUPABASE_URL,
      apiKey || SUPABASE_ANON_KEY
    );

    // Parse request body
    const body = await req.text();
    console.log("Request body:", body);
    const { eventIds, force = false } = JSON.parse(body);
    console.log("Event IDs:", eventIds, "Force:", force);

    // Get events based on request parameters
    let eventsQuery = supabase
      .from("events")
      .select("*")
      .eq("deleted", false)
      .eq("muted", false);

    if (eventIds && eventIds.length > 0) {
      eventsQuery = eventsQuery.in("id", eventIds);
    } else if (!force) {
      eventsQuery = eventsQuery.eq("status", "running");
    }

    console.log("Fetching events...");
    const { data: events, error: eventsError } = await eventsQuery;

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      throw new Error(`Error fetching events: ${eventsError.message}`);
    }

    console.log("Found events:", events?.length || 0);

    const now = new Date();
    const processedEvents = [];

    for (const event of events) {
      // For forced notifications, skip the trigger time check
      const shouldNotify = force || (() => {
        const lastCheckIn = new Date(event.last_check_in);
        const maxInactivityMs = parseInterval(event.max_inactivity_time);
        const triggerTime = new Date(lastCheckIn.getTime() + maxInactivityMs);
        return now >= triggerTime;
      })();

      if (shouldNotify) {
        if (!force) {
          // Only update status if not a forced notification
          const { error: updateError } = await supabase
            .from("events")
            .update({
              status: "triggered",
              last_trigger_time: now.toISOString(),
            })
            .eq("id", event.id);

          if (updateError) {
            console.error(
              `Error updating event ${event.id}: ${updateError.message}`,
            );
            continue;
          }
        }

        // Send notifications to all contacts
        const contacts = event.contacts as Array<{ id: string }>;

        for (const contactRef of contacts) {
          const { data: contact, error: contactError } = await supabase
            .from("contacts")
            .select("*")
            .eq("id", contactRef.id)
            .single();

          if (contactError) {
            console.error(
              `Error fetching contact ${contactRef.id}: ${contactError.message}`,
            );
            continue;
          }

          // Send email notification if email is available
          if (contact.email) {
            try {
              await sendEmailNotification(contact.email, contact.name, event);

              // Log the notification
              await supabase.from("notification_logs").insert({
                event_id: event.id,
                notification_type: "email",
                recipient: contact.email,
                content:
                  event.notification_content ||
                  `Check-in alert for ${event.name}`,
                status: "sent",
              });
            } catch (error) {
              console.error(
                `Error sending email to ${contact.email}: ${error.message}`,
              );

              // Log the failed notification
              await supabase.from("notification_logs").insert({
                event_id: event.id,
                notification_type: "email",
                recipient: contact.email,
                content:
                  event.notification_content ||
                  `Check-in alert for ${event.name}`,
                status: "failed",
                error_message: error.message,
              });
            }
          }

          // Send SMS notification if phone is available
          if (contact.phone) {
            try {
              await sendSmsNotification(contact.phone, event);

              // Log the notification
              await supabase.from("notification_logs").insert({
                event_id: event.id,
                notification_type: "sms",
                recipient: contact.phone,
                content:
                  event.notification_content ||
                  `Check-in alert for ${event.name}`,
                status: "sent",
              });
            } catch (error) {
              console.error(
                `Error sending SMS to ${contact.phone}: ${error.message}`,
              );

              // Log the failed notification
              await supabase.from("notification_logs").insert({
                event_id: event.id,
                notification_type: "sms",
                recipient: contact.phone,
                content:
                  event.notification_content ||
                  `Check-in alert for ${event.name}`,
                status: "failed",
                error_message: error.message,
              });
            }
          }
        }

        // Add to processed events
        processedEvents.push({
          id: event.id,
          name: event.name,
          triggered: true,
          forced: force,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedEvents,
        debug: {
          url: SUPABASE_URL,
          hasApiKey: !!apiKey,
          hasAuthHeader: !!authHeader,
          eventIds,
          force
        }
      }),
      { headers }
    );
  } catch (error: any) {
    console.error("Error in Edge Function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack,
        debug: {
          url: SUPABASE_URL,
          headers: Object.fromEntries(req.headers.entries())
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

// Helper function to parse PostgreSQL interval to milliseconds
function parseInterval(interval: string): number {
  // Simple parsing for common formats like '1 week', '2 days', etc.
  const match = interval.match(/^(\d+)\s+(\w+)$/);
  if (!match) return 0;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const msPerUnit: Record<string, number> = {
    microsecond: 0.001,
    microseconds: 0.001,
    millisecond: 1,
    milliseconds: 1,
    second: 1000,
    seconds: 1000,
    minute: 60 * 1000,
    minutes: 60 * 1000,
    hour: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
    years: 365 * 24 * 60 * 60 * 1000,
  };

  return value * (msPerUnit[unit] || 0);
}

async function sendEmailNotification(email: string, name: string, event: any) {
  const subject = `Check-in Alert: ${event.name}`;
  const content =
    event.notification_content ||
    `This is an automated alert. ${event.name} has not been checked in within the specified time period.`;

  await sendgrid.send({
    to: email,
    from: FROM_EMAIL,
    subject,
    text: `Hello ${name},\n\n${content}\n\nThis alert was triggered because the user did not check in within the specified time period.`,
    html: `<p>Hello ${name},</p><p>${content}</p><p>This alert was triggered because the user did not check in within the specified time period.</p>`,
  });
}

async function sendSmsNotification(phone: string, event: any) {
  const content =
    event.notification_content ||
    `Check-in Alert: ${event.name} has not been checked in within the specified time period.`;

  await telnyx.messages.create({
    from: FROM_PHONE,
    to: phone,
    text: content,
  });
}
