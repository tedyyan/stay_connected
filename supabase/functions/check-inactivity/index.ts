import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SendGrid } from "https://deno.land/x/sendgrid@0.0.3/mod.ts";
import { Telnyx } from "https://esm.sh/telnyx@1.25.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "notifications@example.com";
const FROM_PHONE = Deno.env.get("FROM_PHONE") || "+15555555555";

const sendgrid = new SendGrid(SENDGRID_API_KEY);
const telnyx = Telnyx(TELNYX_API_KEY);

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

    // Get all active events that are not deleted, not paused, and not muted
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .eq("deleted", false)
      .eq("muted", false)
      .eq("status", "running");

    if (eventsError) {
      throw new Error(`Error fetching events: ${eventsError.message}`);
    }

    const now = new Date();
    const processedEvents = [];

    for (const event of events) {
      const lastCheckIn = new Date(event.last_check_in);
      const maxInactivityMs = parseInterval(event.max_inactivity_time);
      const triggerTime = new Date(lastCheckIn.getTime() + maxInactivityMs);

      // Check if the event should be triggered
      if (now >= triggerTime) {
        // Update event status to triggered
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
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: processedEvents }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error(`Error processing inactivity checks: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
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

async function sendSmsNotification(phone: string, event: any, apiKey: string) {
  const content =
    event.notification_content ||
    `Check-in Alert: ${event.name} has not been checked in within the specified time period.`;

  const telnyx = Telnyx(apiKey);
  await telnyx.messages.create({
    from: FROM_PHONE,
    to: phone,
    text: content,
  });
}
