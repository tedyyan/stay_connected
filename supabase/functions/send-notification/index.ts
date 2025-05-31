import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import sgMail from "https://esm.sh/@sendgrid/mail@7.7.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting notification processing...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Initialize SendGrid and get environment variables
    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') || ''
    const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY') || ''
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'notifications@stayconnected.app'
    const FROM_PHONE = Deno.env.get('FROM_PHONE') || ''

    console.log('Environment variables loaded:', {
      SENDGRID_API_KEY: SENDGRID_API_KEY ? '***' : 'not set',
      TELNYX_API_KEY: TELNYX_API_KEY ? '***' : 'not set',
      FROM_EMAIL,
      FROM_PHONE
    });

    sgMail.setApiKey(SENDGRID_API_KEY)

    // Get pending notifications
    console.log('Fetching pending notifications...');
    const { data: notifications, error: fetchError } = await supabaseClient
      .from('notification_logs')
      .select(`
        *,
        events (
          name,
          user_id,
          notification_content
        )
      `)
      .eq('status', 'pending')
      .limit(50)

    if (fetchError) {
      console.error('Error fetching notifications:', fetchError);
      throw fetchError
    }

    console.log(`Found ${notifications?.length || 0} pending notifications`);

    const results = []
    for (const notification of notifications || []) {
      console.log(`Processing notification ID ${notification.id}:`, {
        type: notification.notification_type,
        recipient: notification.recipient,
        eventName: notification.events?.name
      });

      try {
        if (notification.notification_type === 'email') {
          // Send email using SendGrid
          const msg = {
            to: notification.recipient,
            from: FROM_EMAIL,
            subject: `Inactivity Alert: ${notification.events.name}`,
            text: notification.content,
            html: `
              <h2>Inactivity Alert</h2>
              <p>${notification.content}</p>
              <p>Event: ${notification.events.name}</p>
              <hr>
              <p><small>This is an automated message from Stay Connected.</small></p>
            `
          }

          console.log('Preparing to send email:', {
            to: notification.recipient,
            from: FROM_EMAIL,
            subject: `Inactivity Alert: ${notification.events.name}`
          });

          try {
            const response = await sgMail.send(msg)
            console.log('SendGrid API Response:', {
              statusCode: response[0]?.statusCode,
              headers: response[0]?.headers,
              body: response[0]?.body,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error('SendGrid Error Details:', {
              message: error.message,
              code: error?.code,
              response: {
                statusCode: error?.response?.statusCode,
                body: error?.response?.body,
                headers: error?.response?.headers
              },
              timestamp: new Date().toISOString(),
              stack: error.stack
            });
            throw error
          }

          results.push({
            id: notification.id,
            type: 'email',
            success: true
          })
        } else if (notification.notification_type === 'sms') {
          // Format phone numbers to E.164
          const formattedPhone = formatToE164(notification.recipient)
          const formattedFromPhone = formatToE164(FROM_PHONE)

          console.log('Preparing to send SMS:', {
            to: formattedPhone,
            from: formattedFromPhone,
            contentLength: notification.content.length,
            timestamp: new Date().toISOString()
          });

          // Send SMS using Telnyx REST API
          const response = await fetch("https://api.telnyx.com/v2/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${TELNYX_API_KEY}`
            },
            body: JSON.stringify({
              from: formattedFromPhone,
              to: formattedPhone,
              text: notification.content
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

          results.push({
            id: notification.id,
            type: 'sms',
            success: true
          })
        }

        console.log(`Updating notification ${notification.id} status to sent`);
        // Update notification status to sent
        const { error: updateError } = await supabaseClient
          .from('notification_logs')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', notification.id)

        if (updateError) {
          console.error('Error updating notification status:', updateError);
        }

      } catch (error) {
        console.error('Error sending notification:', error)
        
        console.log(`Updating notification ${notification.id} status to failed`);
        // Update notification status to failed
        const { error: updateError } = await supabaseClient
          .from('notification_logs')
          .update({ 
            status: 'failed',
            error_message: error.message
          })
          .eq('id', notification.id)

        if (updateError) {
          console.error('Error updating notification failure status:', updateError);
        }

        results.push({
          id: notification.id,
          type: notification.notification_type,
          success: false,
          error: error.message
        })
      }
    }

    console.log('Notification processing completed. Results:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error processing notifications:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

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