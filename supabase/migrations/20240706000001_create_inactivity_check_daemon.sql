-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Ensure we're using the right schema
SET search_path = public;

-- Create a function to process inactivity checks
CREATE OR REPLACE FUNCTION public.check_user_inactivity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    event_record RECORD;
    check_time TIMESTAMP WITH TIME ZONE;
    inactivity_duration INTERVAL;
    should_trigger BOOLEAN;
BEGIN
    check_time := NOW();

    -- Loop through all active events
    FOR event_record IN 
        SELECT e.*, 
               CASE 
                   WHEN e.max_inactivity_time ~ '^[0-9]+$' THEN (e.max_inactivity_time || ' minutes')::interval
                   ELSE e.max_inactivity_time::interval
               END as inactivity_interval
        FROM public.events e
        WHERE e.status = 'running' 
        AND e.deleted = false 
        AND e.muted = false
    LOOP
        -- Calculate time since last check-in
        inactivity_duration := check_time - event_record.last_check_in;
        should_trigger := false;

        -- Check if inactivity threshold has been exceeded
        IF inactivity_duration > event_record.inactivity_interval THEN
            should_trigger := true;
        END IF;

        -- If should trigger and hasn't been triggered recently (within last hour)
        IF should_trigger AND (
            event_record.last_trigger_time IS NULL OR 
            check_time - event_record.last_trigger_time > interval '1 hour'
        ) THEN
            -- Update event status
            UPDATE public.events 
            SET status = 'triggered',
                last_trigger_time = check_time
            WHERE id = event_record.id;

            -- Create notification logs for each contact
            INSERT INTO public.notification_logs (
                event_id,
                notification_type,
                recipient,
                content,
                status
            )
            SELECT 
                event_record.id,
                CASE 
                    WHEN (c.notification_preference = 'sms' OR c.notification_preference = 'both') AND c.phone IS NOT NULL THEN 'sms'
                    ELSE 'email'
                END,
                CASE 
                    WHEN (c.notification_preference = 'sms' OR c.notification_preference = 'both') AND c.phone IS NOT NULL THEN c.phone
                    ELSE c.email
                END,
                COALESCE(
                    event_record.notification_content,
                    'User has been inactive for ' || event_record.max_inactivity_time || '. Please check on them.'
                ),
                'pending'
            FROM public.contacts c
            INNER JOIN public.event_contacts ec ON c.id = ec.contact_id
            WHERE ec.event_id = event_record.id
            AND c.deleted = false;

            -- Log the activity
            INSERT INTO public.activity_logs (
                user_id,
                event_id,
                action,
                details
            )
            VALUES (
                event_record.user_id,
                event_record.id,
                'event_triggered',
                jsonb_build_object(
                    'inactivity_duration', inactivity_duration,
                    'max_inactivity_time', event_record.max_inactivity_time,
                    'trigger_time', check_time
                )
            );
        END IF;
    END LOOP;
END;
$$;

-- Create a function to reset triggered events
CREATE OR REPLACE FUNCTION public.reset_triggered_event(p_event_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.events
    SET status = 'running',
        last_check_in = NOW(),
        last_trigger_time = NULL
    WHERE id = p_event_id
    AND status = 'triggered';

    -- Log the reset
    INSERT INTO public.activity_logs (
        user_id,
        event_id,
        action,
        details
    )
    SELECT 
        user_id,
        id,
        'event_reset',
        jsonb_build_object(
            'reset_time', NOW()
        )
    FROM public.events
    WHERE id = p_event_id;
END;
$$;

-- Schedule the cron job
SELECT cron.schedule(
    'check-user-inactivity',    -- name of the cron job
    '*/5 * * * *',             -- every 5 minutes
    'SELECT public.check_user_inactivity();'  -- SQL command to execute
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.check_user_inactivity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_triggered_event(UUID) TO authenticated;

-- Revoke unnecessary permissions
REVOKE ALL ON cron.job FROM public; 