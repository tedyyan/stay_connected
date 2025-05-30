import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MailService } from "https://esm.sh/@sendgrid/mail@7.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "notifications@example.com";
const FROM_PHONE = Deno.env.get("FROM_PHONE") || "+15555555555";

console.log('Environment variables loaded:', {
  SENDGRID_API_KEY: SENDGRID_API_KEY ? '***' : 'not set',
  TELNYX_API_KEY: TELNYX_API_KEY ? '***' : 'not set',
  FROM_EMAIL,
  FROM_PHONE
});

// Initialize SendGrid
const sgMail = new MailService();
sgMail.setApiKey(SENDGRID_API_KEY);

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    console.log('Starting inactivity check...');
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    // Get all active events that are not deleted, not paused, and not muted
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select(`
        *,
        event_contacts (
          contact_id
        )
      `)
      .eq("deleted", false)
      .eq("muted", false)
      .eq("status", "running");

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      throw new Error(`Error fetching events: ${eventsError.message}`);
    }

    console.log(`Found ${events?.length || 0} active events to check`);

    const now = new Date();
    const processedEvents = [];

    for (const event of events) {
      console.log(`Processing event: ${event.name} (ID: ${event.id})`);
      console.log('Last check-in:', event.last_check_in);
      console.log('Max inactivity time:', event.max_inactivity_time);
      
      const lastCheckIn = new Date(event.last_check_in);
      const maxInactivityMs = parseInterval(event.max_inactivity_time);
      const triggerTime = new Date(lastCheckIn.getTime() + maxInactivityMs);

      console.log('Current time:', now.toISOString());
      console.log('Trigger time:', triggerTime.toISOString());
      console.log('Should trigger:', now >= triggerTime ? 'Yes' : 'No');

      // Check if the event should be triggered
      if (now >= triggerTime) {
        console.log(`Event ${event.id} has exceeded inactivity threshold, triggering notifications...`);
        
        // Update event status to triggered
        const { error: updateError } = await supabase
          .from("events")
          .update({
            status: "triggered",
            last_trigger_time: now.toISOString(),
          })
          .eq("id", event.id);

        if (updateError) {
          console.error(`Error updating event ${event.id}:`, updateError);
          continue;
        }

        // Get contacts from event_contacts
        const contactIds = event.event_contacts.map(ec => ec.contact_id);
        console.log(`Found ${contactIds.length} contacts for event`);

        for (const contactId of contactIds) {
          console.log(`Fetching contact details for ID: ${contactId}`);
          
          const { data: contact, error: contactError } = await supabase
            .from("contacts")
            .select("*")
            .eq("id", contactId)
            .single();

          if (contactError) {
            console.error(`Error fetching contact ${contactId}:`, contactError);
            continue;
          }

          console.log('Contact details:', {
            id: contact.id,
            name: contact.name,
            hasEmail: !!contact.email,
            hasPhone: !!contact.phone
          });

          // Send email notification if email is available
          if (contact.email) {
            try {
              console.log(`Sending email to ${contact.email}`);
              await sendEmailNotification(contact.email, contact.name, event);
              console.log(`Email sent successfully to ${contact.email}`);

              // Log the notification
              const { error: logError } = await supabase.from("notification_logs").insert({
                event_id: event.id,
                notification_type: "email",
                recipient: contact.email,
                content:
                  event.notification_content ||
                  `Check-in alert for ${event.name}`,
                status: "sent",
              });

              if (logError) {
                console.error('Error logging email notification:', logError);
              }
            } catch (error) {
              console.error(`Error sending email to ${contact.email}:`, error);
              console.error('SendGrid error details:', error?.response?.body);

              // Log the failed notification
              const { error: logError } = await supabase.from("notification_logs").insert({
                event_id: event.id,
                notification_type: "email",
                recipient: contact.email,
                content:
                  event.notification_content ||
                  `Check-in alert for ${event.name}`,
                status: "failed",
                error_message: error.message,
              });

              if (logError) {
                console.error('Error logging failed email notification:', logError);
              }
            }
          }

          // Send SMS notification if phone is available
          if (contact.phone) {
            try {
              console.log(`Sending SMS to ${contact.phone}`);
              await sendSmsNotification(contact.phone, event);
              console.log(`SMS sent successfully to ${contact.phone}`);

              // Log the notification
              const { error: logError } = await supabase.from("notification_logs").insert({
                event_id: event.id,
                notification_type: "sms",
                recipient: contact.phone,
                content:
                  event.notification_content ||
                  `Check-in alert for ${event.name}`,
                status: "sent",
              });

              if (logError) {
                console.error('Error logging SMS notification:', logError);
              }
            } catch (error) {
              console.error(`Error sending SMS to ${contact.phone}:`, error);

              // Log the failed notification
              const { error: logError } = await supabase.from("notification_logs").insert({
                event_id: event.id,
                notification_type: "sms",
                recipient: contact.phone,
                content:
                  event.notification_content ||
                  `Check-in alert for ${event.name}`,
                status: "failed",
                error_message: error.message,
              });

              if (logError) {
                console.error('Error logging failed SMS notification:', logError);
              }
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

    console.log('Inactivity check completed. Processed events:', processedEvents);

    return new Response(
      JSON.stringify({ success: true, processed: processedEvents }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error(`Error processing inactivity checks:`, error);
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

  const msg = {
    personalizations: [{
      to: [{ email }]
    }],
    from: { email: FROM_EMAIL },
    subject,
    content: [{
      type: "text/plain",
      value: `Hello ${name},\n\n${content}\n\nThis alert was triggered because the user did not check in within the specified time period.`
    }, {
      type: "text/html",
      value: `<p>Hello ${name},</p><p>${content}</p><p>This alert was triggered because the user did not check in within the specified time period.</p>`
    }]
  };

  console.log('Preparing to send email:', {
    to: email,
    from: FROM_EMAIL,
    subject,
    contentLength: content.length
  });

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(msg)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`SendGrid API error: ${response.status} - ${errorBody}`);
    }

    console.log('SendGrid API Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      timestamp: new Date().toISOString()
    });

    return response;
  } catch (error) {
    console.error('SendGrid Error Details:', {
      message: error.message,
      status: error.status,
      timestamp: new Date().toISOString(),
      stack: error.stack
    });
    throw error;
  }
}

async function sendSmsNotification(phone: string, event: any) {
  const content =
    event.notification_content ||
    `Check-in Alert: ${event.name} has not been checked in within the specified time period.`;

  // Format phone numbers to E.164
  const formattedPhone = formatToE164(phone);
  const formattedFromPhone = formatToE164(FROM_PHONE);

  console.log('Preparing to send SMS:', {
    to: formattedPhone,
    from: formattedFromPhone,
    contentLength: content.length,
    timestamp: new Date().toISOString()
  });

  const response = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TELNYX_API_KEY}`
    },
    body: JSON.stringify({
      from: formattedFromPhone,
      to: formattedPhone,
      text: content
    })
  });

  const responseData = await response.json();
  
  if (!response.ok) {
    console.error('Telnyx Error Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      body: responseData,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Telnyx API error: ${responseData.errors?.[0]?.detail || 'Unknown error'}`);
  }

  console.log('Telnyx API Response:', {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    data: {
      messageId: responseData?.data?.id,
      status: responseData?.data?.status,
      to: responseData?.data?.to?.[0]?.phone_number,
      from: responseData?.data?.from?.phone_number,
      type: responseData?.data?.type,
      timestamp: new Date().toISOString()
    }
  });

  return responseData;
}

// Helper function to format phone numbers to E.164
function formatToE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it's a US/Canada number (11 digits starting with 1 or 10 digits)
  if (digits.length === 11 && digits.startsWith('1')) {
    return '+' + digits;
  } else if (digits.length === 10) {
    return '+1' + digits;
  }
  
  // For other international numbers, just add + if not present
  return phone.startsWith('+') ? phone : '+' + digits;
}
