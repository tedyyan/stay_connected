import { createClient } from '../../../supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('Authenticated user ID:', user.id);

    const { eventId } = await request.json();

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    console.log('Event ID:', eventId);

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single();

    if (eventError || !event) {
      console.error('Event error:', eventError);
      return NextResponse.json(
        { success: false, error: 'Event not found or access denied' },
        { status: 404 }
      );
    }

    console.log('Event found:', event.name);

    // Get user details including phone
    console.log('Looking up user in public.users table...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, phone, full_name')
      .eq('id', user.id)
      .single();

    console.log('User data query result:', { userData, userError });

    if (userError || !userData) {
      console.error('User data error:', userError);
      
      // Try to get user data from auth.users if public.users doesn't exist
      console.log('Trying to get user data from auth.users...');
      const { data: authUserData, error: authUserError } = await supabase.auth.getUser();
      console.log('Auth user data:', { 
        email: authUserData?.user?.email, 
        metadata: authUserData?.user?.user_metadata,
        error: authUserError 
      });
      
      return NextResponse.json(
        { success: false, error: 'User data not found in public.users table. Please run the user registration fix script.' },
        { status: 404 }
      );
    }

    console.log('User data found:', { 
      email: userData.email, 
      phone: userData.phone, 
      hasEmail: !!userData.email, 
      hasPhone: !!userData.phone 
    });

    if (!userData.email && !userData.phone) {
      return NextResponse.json(
        { success: false, error: 'No email or phone number found for user' },
        { status: 400 }
      );
    }

    // Create notification content
    const message = `Check-in reminder for "${event.name}". Please check in to confirm you're safe.`;
    
    const notifications = [];
    const errors = [];

    // Add email notification if user has email
    if (userData.email) {
      console.log('Creating email notification...');
      const { error: emailError } = await supabase
        .from('notification_logs')
        .insert({
          event_id: eventId,
          notification_type: 'email',
          recipient: userData.email,
          content: message,
          status: 'pending',
          notification_category: 'user_reminder'
        });

      if (emailError) {
        console.error('Email notification insert error:', emailError);
        errors.push(`Email: ${emailError.message}`);
      } else {
        console.log('Email notification created successfully');
        notifications.push({ type: 'email', recipient: userData.email });
      }
    }

    // Add SMS notification if user has phone
    if (userData.phone) {
      console.log('Creating SMS notification...');
      const { error: smsError } = await supabase
        .from('notification_logs')
        .insert({
          event_id: eventId,
          notification_type: 'sms',
          recipient: userData.phone,
          content: message,
          status: 'pending',
          notification_category: 'user_reminder'
        });

      if (smsError) {
        console.error('SMS notification insert error:', smsError);
        errors.push(`SMS: ${smsError.message}`);
      } else {
        console.log('SMS notification created successfully');
        notifications.push({ type: 'sms', recipient: userData.phone });
      }
    }

    console.log('Notification creation results:', { 
      notificationsCreated: notifications.length, 
      errorsCount: errors.length,
      notifications,
      errors 
    });

    if (notifications.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to queue notifications. Errors: ${errors.join(', ')}`,
          details: {
            userHasEmail: !!userData.email,
            userHasPhone: !!userData.phone,
            errors
          }
        },
        { status: 500 }
      );
    }

    // Trigger the send-notification edge function to process pending notifications
    console.log('Triggering send-notification function...');
    const { error: triggerError } = await supabase.functions.invoke('send-notification');
    
    if (triggerError) {
      console.error('Error triggering send-notification function:', triggerError);
    } else {
      console.log('Send-notification function triggered successfully');
    }

    return NextResponse.json({
      success: true,
      notifications,
      message: 'Check-in reminder sent successfully'
    });

  } catch (error) {
    console.error('Error in notify-myself route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 