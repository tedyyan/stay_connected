import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("Edge Function starting...");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY") || "";
const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "notifications@stayconnected.app";
const FROM_PHONE = Deno.env.get("FROM_PHONE") || "";

console.log('Environment variables loaded:', {
  SENDGRID_API_KEY: SENDGRID_API_KEY ? '***' : 'not set',
  TELNYX_API_KEY: TELNYX_API_KEY ? '***' : 'not set',
  EXPO_ACCESS_TOKEN: EXPO_ACCESS_TOKEN ? '***' : 'not set',
  FROM_EMAIL,
  FROM_PHONE
});

serve(async (req) => {
  console.log(`Received ${req.method} request from ${req.headers.get('origin')}`);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204
    });
  }

  try {
    console.log('Starting inactivity check - detecting overdue events...');
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const results = {
      userRemindersLogged: [],
      contactAlertsLogged: [],
      eventsTriggered: [],
      errors: []
    };

    // Phase 1: Log user reminders for overdue check-ins
    console.log('Phase 1: Checking for events needing user reminders...');
    try {
      const { data: eventsNeedingReminders, error: remindersError } = await supabase
        .rpc('get_events_needing_user_reminders');

      if (remindersError) {
        console.error('Error getting events needing reminders:', remindersError);
        results.errors.push({
          phase: 'user_reminders',
          error: remindersError.message
        });
      } else {
        console.log(`Found ${eventsNeedingReminders?.length || 0} events needing user reminders`);
        
        for (const event of eventsNeedingReminders || []) {
          console.log(`Processing user reminder for event: ${event.name} (${event.id})`);

          // Calculate missed intervals for this event
          const lastCheckin = event.last_checkin || event.created_at;
          const checkInFrequency = event.check_in_frequency || '1 hour';
          const missedThreshold = event.missed_checkin_threshold || 5;

          // Parse check_in_frequency interval to minutes
          let frequencyMinutes = 60; // default to 1 hour
          if (typeof checkInFrequency === 'string') {
            if (checkInFrequency.includes('minute')) {
              frequencyMinutes = parseInt(checkInFrequency) || 60;
            } else if (checkInFrequency.includes('hour')) {
              frequencyMinutes = (parseInt(checkInFrequency) || 1) * 60;
            } else if (checkInFrequency.includes('day')) {
              frequencyMinutes = (parseInt(checkInFrequency) || 1) * 60 * 24;
            }
          }
          
          const minutesSinceLastCheckin = (new Date().getTime() - new Date(lastCheckin).getTime()) / (1000 * 60);
          const missedIntervals = Math.floor(minutesSinceLastCheckin / frequencyMinutes);
          const remindersLeft = missedThreshold - missedIntervals;
          
          console.log(`Event ${event.name}: missed_intervals=${missedIntervals}, threshold=${missedThreshold}, reminders_left=${remindersLeft}`);

          // Only send reminders if we are in the reminder phase (1 <= missedIntervals < threshold)
          if (missedIntervals >= 1 && missedIntervals < missedThreshold) {
            
            // Check if we've already sent a reminder for this missed interval
            // BUT only check reminders sent AFTER the last check-in time
            const lastCheckinTime = event.last_check_in || event.created_at;
            const { data: existingReminders, error: reminderCheckError } = await supabase
              .from('notification_logs')
              .select('id')
              .eq('event_id', event.id)
              .eq('notification_category', 'user_reminder')
              .ilike('content', `Reminder #${missedIntervals}:%`)
              .gt('sent_at', lastCheckinTime) // Only check reminders sent after last check-in
              .limit(1);

            if (reminderCheckError) {
              console.error(`Error checking existing reminders for event ${event.id}:`, reminderCheckError);
            } else if (existingReminders && existingReminders.length > 0) {
              console.log(`Reminder #${missedIntervals} already sent for event ${event.name} since last check-in, skipping`);
              continue; // Skip this event, reminder already sent for this interval
            }

            console.log(`Sending Reminder #${missedIntervals} for event ${event.name}`);
            
            // Insert push notification request
            if (event.user_id) {
              try {
                const reminderContent = `Reminder #${missedIntervals}: Time to check in for "${event.name}". ${remindersLeft === 1 ? '1 reminder left' : remindersLeft + ' reminders left'} before contacts are alerted.`;
                
                const { error: pushLogError } = await supabase
                  .from('notification_logs')
                  .insert({
                    event_id: event.id,
                    notification_type: 'push',
                    recipient: event.user_id,
                    content: reminderContent,
                    status: 'pending',
                    notification_category: 'user_reminder'
                  });

                if (pushLogError) {
                  console.error(`Error logging push notification for event ${event.id}:`, pushLogError);
                  results.errors.push({
                    event_id: event.id,
                    type: 'push',
                    error: pushLogError.message
                  });
                } else {
                  results.userRemindersLogged.push({
                    event_id: event.id,
                    type: 'push',
                    success: true
                  });
                }
              } catch (error) {
                console.error(`Error logging push notification for event ${event.id}:`, error);
                results.errors.push({
                  event_id: event.id,
                  type: 'push',
                  error: error.message
                });
              }
            }

            // Insert email notification request
            if (event.user_email) {
              try {
                const reminderContent = `Reminder #${missedIntervals}: Time to check in for "${event.name}". ${remindersLeft === 1 ? '1 reminder left' : remindersLeft + ' reminders left'} before contacts are alerted.`;
                
                const { error: emailLogError } = await supabase
                  .from('notification_logs')
                  .insert({
                    event_id: event.id,
                    notification_type: 'email',
                    recipient: event.user_email,
                    content: reminderContent,
                    status: 'pending',
                    notification_category: 'user_reminder'
                  });

                if (emailLogError) {
                  console.error(`Error logging email notification for event ${event.id}:`, emailLogError);
                  results.errors.push({
                    event_id: event.id,
                    type: 'email',
                    error: emailLogError.message
                  });
                } else {
                  results.userRemindersLogged.push({
                    event_id: event.id,
                    type: 'email',
                    success: true
                  });
                }
              } catch (error) {
                console.error(`Error logging email notification for event ${event.id}:`, error);
                results.errors.push({
                  event_id: event.id,
                  type: 'email',
                  error: error.message
                });
              }
            }

            // Insert SMS notification request
            if (event.user_phone) {
              try {
                const reminderContent = `Reminder #${missedIntervals}: Time to check in for "${event.name}". ${remindersLeft === 1 ? '1 reminder left' : remindersLeft + ' reminders left'} before contacts are alerted. - Stay Connected`;
                
                const { error: smsLogError } = await supabase
                  .from('notification_logs')
                  .insert({
                    event_id: event.id,
                    notification_type: 'sms',
                    recipient: event.user_phone,
                    content: reminderContent,
                    status: 'pending',
                    notification_category: 'user_reminder'
                  });

                if (smsLogError) {
                  console.error(`Error logging SMS notification for event ${event.id}:`, smsLogError);
                  results.errors.push({
                    event_id: event.id,
                    type: 'sms',
                    error: smsLogError.message
                  });
                } else {
                  results.userRemindersLogged.push({
                    event_id: event.id,
                    type: 'sms',
                    success: true
                  });
                }
              } catch (error) {
                console.error(`Error logging SMS notification for event ${event.id}:`, error);
                results.errors.push({
                  event_id: event.id,
                  type: 'sms',
                  error: error.message
                });
              }
            }
          } else {
            console.log(`No reminder needed for event ${event.name}: missed_intervals=${missedIntervals}, threshold=${missedThreshold}`);
          }
        }
      }
    } catch (error) {
      console.error('Error in user reminders phase:', error);
      results.errors.push({
        phase: 'user_reminders',
        error: error.message
      });
    }

    // Phase 2: Log contact alerts (when missed_checkin_threshold is exceeded)
    console.log('Phase 2: Checking for events needing contact alerts...');
    try {
      const { data: eventsNeedingContactAlerts, error: alertsError } = await supabase
        .rpc('get_events_needing_contact_alerts');

      if (alertsError) {
        console.error('Error getting events needing contact alerts:', alertsError);
        results.errors.push({
          phase: 'contact_alerts',
          error: alertsError.message
        });
      } else {
        console.log(`Found ${eventsNeedingContactAlerts?.length || 0} events needing contact alerts`);
        
        for (const event of eventsNeedingContactAlerts || []) {
          console.log(`Logging contact alerts for event: ${event.name} (${event.id})`);
          
          // Get contacts for this event via event_contacts table
          const { data: eventContacts, error: eventContactsError } = await supabase
            .from('event_contacts')
            .select(`
              contact_id,
              contacts (
                id,
                name,
                email,
                phone,
                user_id,
                deleted
              )
            `)
            .eq('event_id', event.id);

          if (eventContactsError) {
            console.error(`Error fetching event contacts for event ${event.id}:`, eventContactsError);
            results.errors.push({
              event_id: event.id,
              error: eventContactsError.message
            });
            continue;
          }

          const validContacts = (eventContacts || [])
            .map(ec => ec.contacts)
            .filter(contact => contact && !contact.deleted);

          console.log(`Found ${validContacts.length} valid contacts for event ${event.id}`);

          const alertContent = `ALERT: ${event.user_name || 'User'} has not checked in for "${event.name}" in over ${Math.floor(event.minutes_overdue || 0)} minutes. Last expected check-in was ${event.expected_checkin_time || 'unknown'}. Please check on them.`;

          for (const contact of validContacts) {
            // Log email alert request
            if (contact.email) {
              try {
                const { error: emailLogError } = await supabase
                  .from('notification_logs')
                  .insert({
                    event_id: event.id,
                    notification_type: 'email',
                    recipient: contact.email,
                    content: alertContent,
                    status: 'pending',
                    notification_category: 'contact_alert'
                  });

                if (emailLogError) {
                  console.error(`Error logging email alert for contact ${contact.email}:`, emailLogError);
                  results.errors.push({
                    event_id: event.id,
                    contact_id: contact.id,
                    type: 'email',
                    error: emailLogError.message
                  });
                } else {
                  results.contactAlertsLogged.push({
                    event_id: event.id,
                    contact_id: contact.id,
                    type: 'email',
                    success: true
                  });
                }
              } catch (error) {
                console.error(`Error logging email alert for contact ${contact.email}:`, error);
                results.errors.push({
                  event_id: event.id,
                  contact_id: contact.id,
                  type: 'email',
                  error: error.message
                });
              }
            }

            // Log SMS alert request
            if (contact.phone) {
              try {
                const smsContent = `ALERT: ${event.user_name || 'User'} has not checked in for "${event.name}" in ${Math.floor(event.minutes_overdue || 0)} minutes. Please check on them. - Stay Connected`;
                
                const { error: smsLogError } = await supabase
                  .from('notification_logs')
                  .insert({
                    event_id: event.id,
                    notification_type: 'sms',
                    recipient: contact.phone,
                    content: smsContent,
                    status: 'pending',
                    notification_category: 'contact_alert'
                  });

                if (smsLogError) {
                  console.error(`Error logging SMS alert for contact ${contact.phone}:`, smsLogError);
                  results.errors.push({
                    event_id: event.id,
                    contact_id: contact.id,
                    type: 'sms',
                    error: smsLogError.message
                  });
                } else {
                  results.contactAlertsLogged.push({
                    event_id: event.id,
                    contact_id: contact.id,
                    type: 'sms',
                    success: true
                  });
                }
              } catch (error) {
                console.error(`Error logging SMS alert for contact ${contact.phone}:`, error);
                results.errors.push({
                  event_id: event.id,
                  contact_id: contact.id,
                  type: 'sms',
                  error: error.message
                });
              }
            }
          }

          // Record that contact alerts have been triggered for this event
          try {
            console.log(`Contact alerts logged for event ${event.id}, no need to insert into missed_checkins table`);
          } catch (error) {
            console.error(`Error in contact alerts tracking for event ${event.id}:`, error);
            results.errors.push({
              event_id: event.id,
              error: error.message
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in contact alerts phase:', error);
      results.errors.push({
        phase: 'contact_alerts',
        error: error.message
      });
    }

    // Phase 3: Trigger events (when threshold is reached)
    console.log('Phase 3: Checking for events to trigger...');
    try {
      // Query events that should be triggered 
      const { data: eventsToTrigger, error: triggerError } = await supabase
        .from('events')
        .select(`
          id,
          name,
          user_id,
          check_in_frequency,
          missed_checkin_threshold,
          last_check_in,
          created_at,
          status
        `)
        .eq('status', 'running')
        .eq('deleted', false)
        .eq('muted', false);

      if (triggerError) {
        console.error('Error getting events to trigger:', triggerError);
        results.errors.push({
          phase: 'event_triggering',
          error: triggerError.message
        });
      } else {
        // Filter events that should be triggered (reached the exact threshold)
        const filteredEventsToTrigger = (eventsToTrigger || []).filter(event => {
          const lastCheckin = event.last_check_in || event.created_at;
          const checkInFrequency = event.check_in_frequency || '1 hour';
          const missedThreshold = event.missed_checkin_threshold || 5;
          
          // Parse check_in_frequency interval to minutes
          let frequencyMinutes = 60; // default to 1 hour
          if (typeof checkInFrequency === 'string') {
            if (checkInFrequency.includes('minute')) {
              frequencyMinutes = parseInt(checkInFrequency) || 60;
            } else if (checkInFrequency.includes('hour')) {
              frequencyMinutes = (parseInt(checkInFrequency) || 1) * 60;
            } else if (checkInFrequency.includes('day')) {
              frequencyMinutes = (parseInt(checkInFrequency) || 1) * 60 * 24;
            }
          }
          
          const minutesSinceLastCheckin = (new Date().getTime() - new Date(lastCheckin).getTime()) / (1000 * 60);
          const missedIntervals = Math.floor(minutesSinceLastCheckin / frequencyMinutes);
          
          console.log(`Event ${event.name}: missed_intervals=${missedIntervals}, threshold=${missedThreshold}, should_trigger=${missedIntervals >= missedThreshold}`);
          
          // Trigger when missed intervals >= threshold (not threshold * 2)
          return missedIntervals >= missedThreshold;
        });

        console.log(`Found ${filteredEventsToTrigger?.length || 0} events to trigger`);
        
        for (const event of filteredEventsToTrigger || []) {
          console.log(`Triggering event: ${event.name} (${event.id})`);
          
          // Update event status to triggered
          const { error: updateError } = await supabase
            .from('events')
            .update({
              status: 'triggered',
              last_trigger_time: new Date().toISOString()
            })
            .eq('id', event.id);

          if (updateError) {
            console.error(`Error updating event ${event.id} to triggered:`, updateError);
            results.errors.push({
              event_id: event.id,
              error: updateError.message
            });
          } else {
            results.eventsTriggered.push({
              event_id: event.id,
              name: event.name
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in event triggering phase:', error);
      results.errors.push({
        phase: 'event_triggering',
        error: error.message
      });
    }

    console.log('Inactivity check completed. Results:', results);
    
    return new Response(JSON.stringify({
      success: true,
      results
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });

  } catch (error) {
    console.error("Error in inactivity check:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
