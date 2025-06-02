-- Database Functions
-- These functions handle various business logic for the Stay Connected application

-- Function to backfill missing user records
CREATE OR REPLACE FUNCTION "public"."backfill_missing_users"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert any auth.users that don't have corresponding public.users records
  INSERT INTO public.users (
    id,
    user_id,
    email,
    name,
    full_name,
    phone,
    avatar_url,
    token_identifier,
    created_at,
    updated_at
  )
  SELECT 
    au.id,
    au.id,  -- Keep as UUID, not text
    au.email,
    au.raw_user_meta_data->>'name',
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'phone',
    au.raw_user_meta_data->>'avatar_url',
    au.email,
    au.created_at,
    au.updated_at
  FROM auth.users au
  LEFT JOIN public.users pu ON au.id = pu.id
  WHERE pu.id IS NULL;
  
  -- Update existing users to include phone numbers from auth metadata
  UPDATE public.users 
  SET phone = au.raw_user_meta_data->>'phone'
  FROM auth.users au
  WHERE public.users.id = au.id
    AND public.users.phone IS NULL
    AND au.raw_user_meta_data->>'phone' IS NOT NULL;
END;
$$;

-- Function to create contact alert notifications
CREATE OR REPLACE FUNCTION "public"."create_contact_alert_notification"("p_event_id" "uuid", "p_contact_email" "text", "p_contact_phone" "text", "p_content" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Insert email alert if contact has email
    IF p_contact_email IS NOT NULL THEN
        INSERT INTO notification_logs (
            event_id,
            notification_type,
            recipient,
            content,
            status,
            notification_category
        ) VALUES (
            p_event_id,
            'email',
            p_contact_email,
            p_content,
            'pending',
            'contact_alert'
        );
    END IF;

    -- Insert SMS alert if contact has phone
    IF p_contact_phone IS NOT NULL THEN
        INSERT INTO notification_logs (
            event_id,
            notification_type,
            recipient,
            content,
            status,
            notification_category
        ) VALUES (
            p_event_id,
            'sms',
            p_contact_phone,
            p_content,
            'pending',
            'contact_alert'
        );
    END IF;
END;
$$;

-- Function to create user reminder notifications
CREATE OR REPLACE FUNCTION "public"."create_user_reminder_notification"("p_event_id" "uuid", "p_user_email" "text", "p_user_phone" "text", "p_content" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Insert email reminder if user has email
    IF p_user_email IS NOT NULL THEN
        INSERT INTO notification_logs (
            event_id,
            notification_type,
            recipient,
            content,
            status,
            notification_category
        ) VALUES (
            p_event_id,
            'email',
            p_user_email,
            p_content,
            'pending',
            'user_reminder'
        );
    END IF;

    -- Insert SMS reminder if user has phone
    IF p_user_phone IS NOT NULL THEN
        INSERT INTO notification_logs (
            event_id,
            notification_type,
            recipient,
            content,
            status,
            notification_category
        ) VALUES (
            p_event_id,
            'sms',
            p_user_phone,
            p_content,
            'pending',
            'user_reminder'
        );
    END IF;

    -- Insert push notification
    INSERT INTO notification_logs (
        event_id,
        notification_type,
        recipient,
        content,
        status,
        notification_category
    ) VALUES (
        p_event_id,
        'push',
        p_user_email, -- push notifications use user email as identifier
        p_content,
        'pending',
        'user_reminder'
    );
END;
$$;

-- Function to get events needing contact alerts
CREATE OR REPLACE FUNCTION "public"."get_events_needing_contact_alerts"() RETURNS TABLE("id" "uuid", "name" "text", "user_id" "uuid", "user_name" "text", "check_in_frequency" interval, "missed_checkin_threshold" integer, "last_checkin" timestamp with time zone, "hours_overdue" numeric, "minutes_overdue" numeric, "expected_checkin_time" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.user_id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) as user_name,
    COALESCE(e.check_in_frequency, INTERVAL '1 minute') as check_in_frequency,
    COALESCE(e.missed_checkin_threshold, 5) as missed_checkin_threshold,
    COALESCE(e.last_check_in, e.created_at) as last_checkin,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(e.last_check_in, e.created_at))) / 3600 as hours_overdue,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(e.last_check_in, e.created_at))) / 60 as minutes_overdue,
    TO_CHAR(COALESCE(e.last_check_in, e.created_at) + COALESCE(e.check_in_frequency, INTERVAL '1 minute'), 'YYYY-MM-DD HH24:MI') as expected_checkin_time
  FROM events e
  LEFT JOIN auth.users u ON e.user_id = u.id
  WHERE e.status = 'running'
    AND e.deleted = false
    AND e.muted = false
    AND (NOW() - COALESCE(e.last_check_in, e.created_at)) >= COALESCE(e.check_in_frequency, INTERVAL '1 minute')
    AND NOT EXISTS (
      SELECT 1 FROM notification_logs nl
      WHERE nl.event_id = e.id
        AND nl.notification_category = 'contact_alert'
        AND nl.sent_at > NOW() - INTERVAL '1 hour'
    );
END;
$$;

-- Function to get events needing user reminders
CREATE OR REPLACE FUNCTION "public"."get_events_needing_user_reminders"() RETURNS TABLE("id" "uuid", "name" "text", "user_id" "uuid", "user_email" character varying, "user_phone" "text", "check_in_frequency" interval, "last_checkin" timestamp with time zone, "hours_overdue" numeric, "minutes_overdue" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.user_id,
    u.email as user_email,
    u.raw_user_meta_data->>'phone' as user_phone,
    COALESCE(e.check_in_frequency, INTERVAL '1 minute') as check_in_frequency,
    COALESCE(e.last_check_in, e.created_at) as last_checkin,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(e.last_check_in, e.created_at))) / 3600 as hours_overdue,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(e.last_check_in, e.created_at))) / 60 as minutes_overdue
  FROM events e
  LEFT JOIN auth.users u ON e.user_id = u.id
  WHERE e.status = 'running'
    AND e.deleted = false
    AND e.muted = false
    AND (NOW() - COALESCE(e.last_check_in, e.created_at)) >= COALESCE(e.check_in_frequency, INTERVAL '1 minute')
    AND NOT EXISTS (
      SELECT 1 FROM notification_logs nl
      WHERE nl.event_id = e.id
        AND nl.notification_category = 'user_reminder'
        AND nl.sent_at > NOW() - INTERVAL '2 minutes'
    );
END;
$$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (
    id,
    user_id,
    email,
    name,
    full_name,
    phone,
    avatar_url,
    token_identifier
  )
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Function to convert interval text to seconds
CREATE OR REPLACE FUNCTION "public"."interval_to_seconds"("interval_text" "text") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  seconds INTEGER;
BEGIN
  -- Handle different interval formats
  CASE
    WHEN interval_text LIKE '%minute%' THEN
      seconds := EXTRACT(EPOCH FROM CAST(interval_text AS INTERVAL))::INTEGER;
    WHEN interval_text LIKE '%hour%' THEN
      seconds := EXTRACT(EPOCH FROM CAST(interval_text AS INTERVAL))::INTEGER;
    WHEN interval_text LIKE '%day%' THEN
      seconds := EXTRACT(EPOCH FROM CAST(interval_text AS INTERVAL))::INTEGER;
    ELSE
      -- Default to parsing as PostgreSQL interval
      seconds := EXTRACT(EPOCH FROM CAST(interval_text AS INTERVAL))::INTEGER;
  END CASE;
  
  RETURN seconds;
END;
$$;

-- Function to check if an event needs check-in
CREATE OR REPLACE FUNCTION "public"."needs_checkin"("event_id_param" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  event_record RECORD;
BEGIN
  -- Get event details
  SELECT 
    status,
    deleted,
    muted,
    last_check_in,
    created_at,
    check_in_frequency
  INTO event_record
  FROM events
  WHERE id = event_id_param;
  
  -- Return false if event doesn't exist
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Return true if event is running and time since last check-in exceeds frequency
  RETURN event_record.status = 'running'
    AND event_record.deleted = false
    AND event_record.muted = false
    AND (NOW() - COALESCE(event_record.last_check_in, event_record.created_at)) >= 
        COALESCE(event_record.check_in_frequency, INTERVAL '1 minute');
END;
$$;

-- Function to update event contacts
CREATE OR REPLACE FUNCTION "public"."update_event_contacts"("p_event_id" "uuid", "p_contact_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete contacts that are no longer selected
  DELETE FROM event_contacts 
  WHERE event_id = p_event_id 
    AND contact_id NOT IN (SELECT UNNEST(p_contact_ids));
  
  -- Insert new contacts (ignore duplicates)
  INSERT INTO event_contacts (event_id, contact_id)
  SELECT p_event_id, contact_id
  FROM UNNEST(p_contact_ids) AS contact_id
  ON CONFLICT (event_id, contact_id) DO NOTHING;
END;
$$;

-- Set ownership and permissions for all functions
ALTER FUNCTION "public"."backfill_missing_users"() OWNER TO "postgres";
ALTER FUNCTION "public"."create_contact_alert_notification"("p_event_id" "uuid", "p_contact_email" "text", "p_contact_phone" "text", "p_content" "text") OWNER TO "postgres";
ALTER FUNCTION "public"."create_user_reminder_notification"("p_event_id" "uuid", "p_user_email" "text", "p_user_phone" "text", "p_content" "text") OWNER TO "postgres";
ALTER FUNCTION "public"."get_events_needing_contact_alerts"() OWNER TO "postgres";
ALTER FUNCTION "public"."get_events_needing_user_reminders"() OWNER TO "postgres";
ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";
ALTER FUNCTION "public"."interval_to_seconds"("interval_text" "text") OWNER TO "postgres";
ALTER FUNCTION "public"."needs_checkin"("event_id_param" "uuid") OWNER TO "postgres";
ALTER FUNCTION "public"."update_event_contacts"("p_event_id" "uuid", "p_contact_ids" "uuid"[]) OWNER TO "postgres"; 