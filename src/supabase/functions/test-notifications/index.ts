import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SendGrid } from "https://deno.land/x/sendgrid@0.0.3/mod.ts";
import { Telnyx } from "https://esm.sh/telnyx@1.25.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "notifications@example.com";
const FROM_PHONE = Deno.env.get("FROM_PHONE") || "+15555555555";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const { contactId, notificationType } = await req.json();

    if (!contactId) {
      throw new Error("Contact ID is required");
    }

    if (
      !notificationType ||
      !["email", "sms", "both"].includes(notificationType)
    ) {
      throw new Error(
        "Valid notification type is required (email, sms, or both)",
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    // Get the contact
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (contactError) {
      throw new Error(`Contact not found: ${contactError.message}`);
    }

    // Get user's API keys
    const { data: apiKeys, error: apiKeysError } = await supabase
      .from("user_api_keys")
      .select("*")
      .eq("user_id", contact.user_id)
      .single();

    if (apiKeysError) {
      throw new Error(`API keys not found: ${apiKeysError.message}`);
    }

    const results = {
      email: { sent: false, error: null },
      sms: { sent: false, error: null },
    };

    // Send test email
    if (notificationType === "email" || notificationType === "both") {
      if (!contact.email) {
        results.email.error = "Contact has no email address";
      } else if (!apiKeys.sendgrid_api_key) {
        results.email.error = "SendGrid API key not configured";
      } else {
        try {
          await sendTestEmail(
            contact.email,
            contact.name,
            apiKeys.sendgrid_api_key,
          );
          results.email.sent = true;
        } catch (error) {
          results.email.error = error.message;
        }
      }
    }

    // Send test SMS
    if (notificationType === "sms" || notificationType === "both") {
      if (!contact.phone) {
        results.sms.error = "Contact has no phone number";
      } else if (!apiKeys.telnyx_api_key) {
        results.sms.error = "Telnyx API key not configured";
      } else {
        try {
          await sendTestSms(
            contact.phone,
            contact.name,
            apiKeys.telnyx_api_key,
          );
          results.sms.sent = true;
        } catch (error) {
          results.sms.error = error.message;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error(`Error testing notifications: ${error.message}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});

async function sendTestEmail(email: string, name: string, apiKey: string) {
  const subject = "Test Notification";
  const content =
    "This is a test notification from your Check-In Alert System.";

  const sendgrid = new SendGrid(apiKey);
  await sendgrid.send({
    to: email,
    from: FROM_EMAIL,
    subject,
    text: `Hello ${name},\n\n${content}\n\nIf you received this message, your email notifications are working correctly.`,
    html: `<p>Hello ${name},</p><p>${content}</p><p>If you received this message, your email notifications are working correctly.</p>`,
  });
}

async function sendTestSms(phone: string, name: string, apiKey: string) {
  const content = `Hello ${name}, this is a test notification from your Check-In Alert System. If you received this message, your SMS notifications are working correctly.`;

  const telnyx = Telnyx(apiKey);
  await telnyx.messages.create({
    from: FROM_PHONE,
    to: phone,
    text: content,
  });
}
