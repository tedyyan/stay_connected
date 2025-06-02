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
    console.log('Starting enhanced notification processing...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Initialize notification services
    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') || ''
    const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY') || ''
    const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') || ''
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'notifications@stayconnected.app'
    const FROM_PHONE = Deno.env.get('FROM_PHONE') || ''

    sgMail.setApiKey(SENDGRID_API_KEY)

    console.log('Environment variables loaded');

    const results = {
      userReminders: [],
      contactAlerts: [],
      eventsTriggered: [],
      errors: []
    };

    // 1. Process User Reminders
    console.log('Processing user reminders...');
    const userReminders = await processUserReminders(supabaseClient);
    results.userReminders = userReminders;

    // 2. Process Contact Alerts  
    console.log('Processing contact alerts...');
    const contactAlerts = await processContactAlerts(supabaseClient);
    results.contactAlerts = contactAlerts;

    // 3. Process Event Triggering
    console.log('Processing event triggering...');
    const triggeredEvents = await processEventTriggering(supabaseClient);
    results.eventsTriggered = triggeredEvents;

    // 4. Send all notifications
    console.log('Sending notifications...');
    await sendAllNotifications(supabaseClient, [
      ...userReminders,
      ...contactAlerts
    ], {
      SENDGRID_API_KEY,
      TELNYX_API_KEY,
      EXPO_ACCESS_TOKEN,
      FROM_EMAIL,
      FROM_PHONE
    });

    return new Response(
      JSON.stringify({ success: true, results }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error processing enhanced notifications:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

// Process user reminders for check-ins
async function processUserReminders(supabaseClient: any) {
  const { data: eventsNeedingReminders, error } = await supabaseClient.rpc('get_events_needing_user_reminders');
  
  if (error) {
    console.error('Error fetching events needing reminders:', error);
    return [];
  }

  const notifications = [];
  
  for (const event of eventsNeedingReminders || []) {
    // Get notification rules for user reminders
    const { data: rules } = await supabaseClient
      .from('notification_rules')
      .select('*')
      .eq('event_id', event.id)
      .eq('rule_type', 'user_reminder')
      .eq('is_active', true);

    for (const rule of rules || []) {
      // Create notification for each method
      for (const method of rule.notification_methods || []) {
        let recipient = '';
        if (method === 'email') recipient = event.user_email;
        if (method === 'sms') recipient = event.user_phone;
        if (method === 'push') recipient = event.user_id;

        if (recipient) {
          notifications.push({
            type: 'user_reminder',
            method: method,
            recipient: recipient,
            content: rule.message_template || 'Time to check in!',
            event_id: event.id,
            user_id: event.user_id,
            rule_id: rule.id
          });
        }
      }
    }
  }

  return notifications;
}

// Process contact alerts for missed check-ins
async function processContactAlerts(supabaseClient: any) {
  const { data: eventsNeedingAlerts, error } = await supabaseClient.rpc('get_events_needing_contact_alerts');
  
  if (error) {
    console.error('Error fetching events needing contact alerts:', error);
    return [];
  }

  const notifications = [];
  
  for (const event of eventsNeedingAlerts || []) {
    // Get contacts for this user
    const { data: contacts } = await supabaseClient
      .from('contacts')
      .select('*')
      .eq('user_id', event.user_id);

    // Get notification rules for contact alerts
    const { data: rules } = await supabaseClient
      .from('notification_rules')
      .select('*')
      .eq('event_id', event.id)
      .eq('rule_type', 'contact_alert')
      .eq('is_active', true);

    for (const rule of rules || []) {
      for (const contact of contacts || []) {
        // Create notification for each method the contact prefers
        const contactMethods = contact.notification_preference || ['email'];
        const ruleMethods = rule.notification_methods || ['email'];
        const methods = contactMethods.filter(m => ruleMethods.includes(m));

        for (const method of methods) {
          let recipient = '';
          if (method === 'email' && contact.email) recipient = contact.email;
          if (method === 'sms' && contact.phone) recipient = contact.phone;

          if (recipient) {
            const message = rule.message_template
              .replace('{{user_name}}', event.user_name || 'Unknown User')
              .replace('{{hours}}', event.hours_overdue || '0')
              .replace('{{expected_time}}', event.expected_checkin_time || 'Unknown');

            notifications.push({
              type: 'contact_alert',
              method: method,
              recipient: recipient,
              content: message,
              event_id: event.id,
              user_id: event.user_id,
              contact_id: contact.id,
              rule_id: rule.id
            });
          }
        }
      }
    }

    // Record missed check-in
    await supabaseClient
      .from('missed_checkins')
      .insert({
        event_id: event.id,
        user_id: event.user_id,
        expected_checkin_time: event.expected_checkin_time,
        missed_hours: event.hours_overdue,
        contacts_notified: true,
        contacts_notified_at: new Date().toISOString()
      });
  }

  return notifications;
}

// Process event triggering when thresholds are exceeded
async function processEventTriggering(supabaseClient: any) {
  const { data: eventsToTrigger, error } = await supabaseClient.rpc('get_events_to_trigger');
  
  if (error) {
    console.error('Error fetching events to trigger:', error);
    return [];
  }

  const triggeredEvents = [];
  
  for (const event of eventsToTrigger || []) {
    // Update event status to triggered
    const { error: updateError } = await supabaseClient
      .from('events')
      .update({ 
        status: 'triggered',
        updated_at: new Date().toISOString()
      })
      .eq('id', event.id);

    if (!updateError) {
      triggeredEvents.push({
        event_id: event.id,
        event_name: event.name,
        user_id: event.user_id,
        triggered_at: new Date().toISOString()
      });

      console.log(`Event ${event.id} (${event.name}) has been triggered`);
    }
  }

  return triggeredEvents;
}

// Send all notifications using appropriate services
async function sendAllNotifications(supabaseClient: any, notifications: any[], config: any) {
  for (const notification of notifications) {
    try {
      if (notification.method === 'email') {
        await sendEmail(notification, config);
      } else if (notification.method === 'sms') {
        await sendSMS(notification, config);
      } else if (notification.method === 'push') {
        await sendPushNotification(notification, config, supabaseClient);
      }
      
      console.log(`Sent ${notification.method} notification to ${notification.recipient}`);
    } catch (error) {
      console.error(`Failed to send ${notification.method} notification:`, error);
    }
  }
}

// Send email notification
async function sendEmail(notification: any, config: any) {
  const msg = {
    to: notification.recipient,
    from: config.FROM_EMAIL,
    subject: notification.type === 'user_reminder' ? 'Check-in Reminder' : 'Emergency Alert',
    text: notification.content,
    html: `<p>${notification.content}</p>`
  };

  await sgMail.send(msg);
}

// Send SMS notification
async function sendSMS(notification: any, config: any) {
  const response = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.TELNYX_API_KEY}`
    },
    body: JSON.stringify({
      from: config.FROM_PHONE,
      to: notification.recipient,
      text: notification.content
    })
  });

  if (!response.ok) {
    throw new Error(`Telnyx API error: ${response.status}`);
  }
}

// Send push notification
async function sendPushNotification(notification: any, config: any, supabaseClient: any) {
  // Get user's push tokens
  const { data: pushTokens } = await supabaseClient
    .from('user_push_tokens')
    .select('push_token, platform')
    .eq('user_id', notification.user_id);

  if (!pushTokens?.length) return;

  const pushMessages = pushTokens.map(tokenData => ({
    to: tokenData.push_token,
    sound: 'default',
    title: notification.type === 'user_reminder' ? 'Check-in Reminder' : 'Emergency Alert',
    body: notification.content,
    data: {
      eventId: notification.event_id,
      type: notification.type
    },
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.EXPO_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(pushMessages),
  });

  if (!response.ok) {
    throw new Error(`Expo Push API error: ${response.status}`);
  }
} 