import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferred_method: 'email' | 'sms';
  event_id: string;
}

export async function POST(request: Request) {
  try {
    console.log('API: Starting notification request');
    
    // Create a Supabase client with server-side rendering
    const cookieStore = cookies();
    console.log('API: Available cookies:', cookieStore.getAll().map(c => c.name));
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Get the user's session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('API: Session check result:', { 
      hasSession: !!session, 
      sessionError: sessionError?.message,
      userId: session?.user?.id 
    });

    if (!session) {
      console.log('API: No session found');
      return NextResponse.json(
        { success: false, error: 'Please sign in to notify contacts' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('API: Request body:', body);
    const { eventIds, force = false } = body;

    // Get events based on request parameters
    let eventsQuery = supabase
      .from("events")
      .select(`
        *,
        event_contacts!inner (
          contacts!inner (
            id,
            name,
            email,
            phone,
            notification_preference
          )
        )
      `)
      .eq("deleted", false)
      .eq("muted", false);

    if (eventIds && eventIds.length > 0) {
      eventsQuery = eventsQuery.in("id", eventIds);
    } else if (!force) {
      eventsQuery = eventsQuery.eq("status", "running");
    }

    const { data: events, error: eventsError } = await eventsQuery;
    console.log('API: Events query result:', { 
      eventCount: events?.length, 
      error: eventsError?.message,
      eventData: events 
    });

    if (eventsError) {
      console.error('API: Error fetching events:', eventsError);
      throw new Error(`Error fetching events: ${eventsError.message}`);
    }

    const processedEvents = [];
    for (const event of events || []) {
      console.log('API: Processing event:', {
        id: event.id,
        name: event.name,
        contactCount: event.event_contacts?.length
      });

      // Process each contact for the event
      for (const eventContact of (event.event_contacts || [])) {
        const contact = eventContact.contacts;
        if (!contact) continue;

        try {
          console.log('API: Processing notification for contact:', {
            contactId: contact.id,
            contactName: contact.name,
            method: contact.notification_preference
          });

          if (contact.notification_preference === 'email' && contact.email) {
            // Log SendGrid API request
            console.log('API: Sending email via SendGrid:', {
              to: contact.email,
              eventName: event.name,
              templateId: process.env.SENDGRID_TEMPLATE_ID
            });

            try {
              // Your SendGrid API call here
              // const response = await sendGrid.send({ ... });
              console.log('API: SendGrid API response:', {
                success: true,
                contact: contact.email,
                timestamp: new Date().toISOString()
              });

              // Log the notification
              await supabase.from("notification_logs").insert({
                user_id: session.user.id,
                event_id: event.id,
                contact_id: contact.id,
                method: 'email',
                status: 'success',
                details: {
                  email: contact.email,
                  event_name: event.name,
                  timestamp: new Date().toISOString()
                }
              });

            } catch (error: any) {
              console.error('API: SendGrid API error:', {
                error: error.message,
                code: error.code,
                contact: contact.email
              });

              // Log the failed notification
              await supabase.from("notification_logs").insert({
                user_id: session.user.id,
                event_id: event.id,
                contact_id: contact.id,
                method: 'email',
                status: 'error',
                details: {
                  email: contact.email,
                  error: error.message,
                  timestamp: new Date().toISOString()
                }
              });

              throw error;
            }
          } else if (contact.notification_preference === 'sms' && contact.phone) {
            // Log Telnyx API request
            console.log('API: Sending SMS via Telnyx:', {
              to: contact.phone,
              eventName: event.name
            });

            try {
              // Your Telnyx API call here
              // const response = await telnyx.messages.create({ ... });
              console.log('API: Telnyx API response:', {
                success: true,
                contact: contact.phone,
                timestamp: new Date().toISOString()
              });

              // Log the notification
              await supabase.from("notification_logs").insert({
                user_id: session.user.id,
                event_id: event.id,
                contact_id: contact.id,
                method: 'sms',
                status: 'success',
                details: {
                  phone: contact.phone,
                  event_name: event.name,
                  timestamp: new Date().toISOString()
                }
              });

            } catch (error: any) {
              console.error('API: Telnyx API error:', {
                error: error.message,
                code: error.code,
                contact: contact.phone
              });

              // Log the failed notification
              await supabase.from("notification_logs").insert({
                user_id: session.user.id,
                event_id: event.id,
                contact_id: contact.id,
                method: 'sms',
                status: 'error',
                details: {
                  phone: contact.phone,
                  error: error.message,
                  timestamp: new Date().toISOString()
                }
              });

              throw error;
            }
          } else {
            console.warn('API: Contact has invalid notification preference or missing contact info:', {
              contactId: contact.id,
              preference: contact.notification_preference,
              hasEmail: !!contact.email,
              hasPhone: !!contact.phone
            });
            continue;
          }
        } catch (error: any) {
          console.error('API: Error notifying contact:', {
            contactId: contact.id,
            error: error.message
          });
          // Continue with other contacts even if one fails
          continue;
        }
      }
      
      // Log the manual notification
      const { error: logError } = await supabase.from("activity_logs").insert({
        user_id: session.user.id,
        event_id: event.id,
        action: "manual_notification",
        details: {
          forced: force,
          processed: true,
          notification_attempts: event.event_contacts?.length || 0,
          timestamp: new Date().toISOString()
        },
      });

      if (logError) {
        console.error('API: Error logging activity:', { 
          eventId: event.id, 
          error: logError.message 
        });
        continue;
      }

      console.log('API: Successfully processed event:', event.id);
      processedEvents.push({
        id: event.id,
        name: event.name,
        triggered: true,
        forced: force,
        contacts_notified: event.event_contacts?.length || 0
      });
    }

    console.log('API: Completed processing all events:', { 
      processed: processedEvents.length,
      total_notifications: processedEvents.reduce((sum, event) => sum + event.contacts_notified, 0)
    });

    return NextResponse.json({ success: true, processed: processedEvents });
  } catch (error: any) {
    console.error("API: Error in notify endpoint:", {
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.message.includes('sign in') ? 401 : 500 }
    );
  }
} 