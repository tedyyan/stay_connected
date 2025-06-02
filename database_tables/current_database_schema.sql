

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



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


ALTER FUNCTION "public"."backfill_missing_users"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."create_contact_alert_notification"("p_event_id" "uuid", "p_contact_email" "text", "p_contact_phone" "text", "p_content" "text") OWNER TO "postgres";


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


ALTER FUNCTION "public"."create_user_reminder_notification"("p_event_id" "uuid", "p_user_email" "text", "p_user_phone" "text", "p_content" "text") OWNER TO "postgres";


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
  JOIN auth.users u ON e.user_id = u.id
  WHERE e.status = 'running'
    AND e.deleted = false
    AND e.muted = false
    -- Contact alerts after missed_checkin_threshold * check_in_frequency time has passed
    AND (NOW() - COALESCE(e.last_check_in, e.created_at)) >= 
        (COALESCE(e.check_in_frequency, INTERVAL '1 minute') * COALESCE(e.missed_checkin_threshold, 5))
    AND NOT EXISTS (
      -- Don't alert if we already sent contact alerts recently (1 minute window instead of 1 hour)
      SELECT 1 FROM notification_logs nl 
      WHERE nl.event_id = e.id 
        AND nl.notification_category = 'contact_alert'
        AND nl.sent_at > NOW() - INTERVAL '1 minute'
        AND nl.status = 'sent'
    )
    AND EXISTS (
      -- Only alert if user has contacts
      SELECT 1 FROM contacts c WHERE c.user_id = e.user_id AND c.deleted = false
    );
END;
$$;


ALTER FUNCTION "public"."get_events_needing_contact_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_events_needing_user_reminders"() RETURNS TABLE("id" "uuid", "name" "text", "user_id" "uuid", "user_email" character varying, "user_phone" "text", "check_in_frequency" interval, "last_checkin" timestamp with time zone, "hours_overdue" numeric, "minutes_overdue" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.user_id,
    au.email as user_email,  -- Email from auth.users
    u.phone as user_phone,   -- Phone from your users table
    COALESCE(e.check_in_frequency, INTERVAL '1 minute') as check_in_frequency,
    COALESCE(e.last_check_in, e.created_at) as last_checkin,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(e.last_check_in, e.created_at))) / 3600 as hours_overdue,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(e.last_check_in, e.created_at))) / 60 as minutes_overdue
  FROM events e
  JOIN auth.users au ON e.user_id = au.id  -- Auth data
  JOIN users u ON e.user_id = u.user_id    -- Your app data
  WHERE e.status = 'running'
    AND e.deleted = false
    AND e.muted = false
    -- Need check-in if time since last check-in > check-in frequency
    AND (NOW() - COALESCE(e.last_check_in, e.created_at)) >= COALESCE(e.check_in_frequency, INTERVAL '1 minute')
    AND NOT EXISTS (
      -- Don't send if we already sent a USER REMINDER within the check-in frequency period
      SELECT 1 FROM notification_logs nl 
      WHERE nl.event_id = e.id 
        AND nl.notification_type IN ('push', 'email', 'sms')
        AND nl.notification_category = 'user_reminder'
        AND nl.sent_at > NOW() - COALESCE(e.check_in_frequency, INTERVAL '1 minute')
        AND nl.status = 'sent'
    );
END;
$$;


ALTER FUNCTION "public"."get_events_needing_user_reminders"() OWNER TO "postgres";


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
    token_identifier,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.id,  -- Keep as UUID, not text
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    NEW.created_at,
    NEW.updated_at
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."interval_to_seconds"("interval_text" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  seconds INTEGER := 0;
  hours INTEGER;
  minutes INTEGER;
  secs INTEGER;
BEGIN
  -- Handle PostgreSQL interval format like "00:05:00" (HH:MM:SS)
  IF interval_text ~ '^\d{2}:\d{2}:\d{2}$' THEN
    hours := EXTRACT(EPOCH FROM interval_text::INTERVAL) / 3600;
    minutes := (EXTRACT(EPOCH FROM interval_text::INTERVAL) % 3600) / 60;
    secs := EXTRACT(EPOCH FROM interval_text::INTERVAL) % 60;
    RETURN EXTRACT(EPOCH FROM interval_text::INTERVAL)::INTEGER;
  END IF;
  
  -- Handle text format like "5 minutes", "1 day", etc.
  SELECT EXTRACT(EPOCH FROM interval_text::INTERVAL)::INTEGER INTO seconds;
  RETURN seconds;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback: assume it's days if we can't parse it
    RETURN 86400; -- 1 day in seconds
END;
$_$;


ALTER FUNCTION "public"."interval_to_seconds"("interval_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_check_inactivity"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Call the check-inactivity edge function
    PERFORM
        net.http_post(
            url := 'https://qrbukgteabhmnfjwvrlp.supabase.co/functions/v1/check-inactivity',
            headers := jsonb_build_object(
                'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyYnVrZ3RlYWJobW5mand2cmxwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzcwNTE3MSwiZXhwIjoyMDYzMjgxMTcxfQ.Vw3Tl-FeYIM9_RW19umZb8H7sxJJVuBruwzCeyTCnEU',
                'Content-Type', 'application/json'
            ),
            body := '{}'::jsonb
        );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error calling check-inactivity: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."invoke_check_inactivity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_send_notifications"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Call the send-notification edge function
    -- REPLACE 'YOUR_SERVICE_ROLE_KEY_HERE' WITH YOUR ACTUAL KEY
    PERFORM
        net.http_post(
            url := 'https://qrbukgteabhmnfjwvrlp.supabase.co/functions/v1/send-notification',
            headers := jsonb_build_object(
                'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyYnVrZ3RlYWJobW5mand2cmxwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzcwNTE3MSwiZXhwIjoyMDYzMjgxMTcxfQ.Vw3Tl-FeYIM9_RW19umZb8H7sxJJVuBruwzCeyTCnEU',
                'Content-Type', 'application/json'
            ),
            body := '{}'::jsonb
        );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error calling send-notification: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."invoke_send_notifications"() OWNER TO "postgres";


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
    check_in_frequency,
    last_check_in,
    created_at
  INTO event_record 
  FROM events 
  WHERE id = event_id_param;
  
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


ALTER FUNCTION "public"."needs_checkin"("event_id_param" "uuid") OWNER TO "postgres";


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


ALTER FUNCTION "public"."update_event_contacts"("p_event_id" "uuid", "p_contact_ids" "uuid"[]) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "action" "text" NOT NULL,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "social_media" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted" boolean DEFAULT false
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "contacts" "jsonb" NOT NULL,
    "last_check_in" timestamp with time zone DEFAULT "now"(),
    "notification_content" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "memo" "text",
    "deleted" boolean DEFAULT false,
    "last_trigger_time" timestamp with time zone,
    "muted" boolean DEFAULT false,
    "status" "text" DEFAULT 'running'::"text",
    "missed_checkin_threshold" integer DEFAULT 2,
    "check_in_frequency" interval DEFAULT '01:00:00'::interval,
    CONSTRAINT "events_status_check" CHECK (("status" = ANY (ARRAY['deleted'::"text", 'running'::"text", 'triggered'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "recipient" "text" NOT NULL,
    "content" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" NOT NULL,
    "error_message" "text",
    "notification_category" "text" DEFAULT 'user_reminder'::"text",
    CONSTRAINT "notification_category_check" CHECK (("notification_category" = ANY (ARRAY['user_reminder'::"text", 'contact_alert'::"text", 'event_trigger'::"text"]))),
    CONSTRAINT "notification_logs_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['email'::"text", 'sms'::"text"])))
);


ALTER TABLE "public"."notification_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."notification_logs"."notification_category" IS 'Categories: user_reminder (reminders to user), contact_alert (alerts to contacts), event_trigger (full event notifications)';



CREATE TABLE IF NOT EXISTS "public"."user_api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sendgrid_api_key" "text",
    "telnyx_api_key" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "name" "text",
    "email" "text",
    "token_identifier" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    "subscription" "text",
    "credits" "text",
    "image" "text",
    "full_name" "text",
    "phone" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_contacts"
    ADD CONSTRAINT "event_contacts_event_id_contact_id_key" UNIQUE ("event_id", "contact_id");



ALTER TABLE ONLY "public"."event_contacts"
    ADD CONSTRAINT "event_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_event_contacts_contact_id" ON "public"."event_contacts" USING "btree" ("contact_id");



CREATE INDEX "idx_event_contacts_event_id" ON "public"."event_contacts" USING "btree" ("event_id");



CREATE INDEX "idx_notification_logs_category" ON "public"."notification_logs" USING "btree" ("notification_category");



CREATE INDEX "idx_user_api_keys_user_id" ON "public"."user_api_keys" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."event_contacts"
    ADD CONSTRAINT "event_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_contacts"
    ADD CONSTRAINT "event_contacts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



CREATE POLICY "Authenticated users can insert activity logs" ON "public"."activity_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert notifications" ON "public"."notification_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Service role can manage all activity logs" ON "public"."activity_logs" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all notification logs" ON "public"."notification_logs" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Users can delete their own API keys" ON "public"."user_api_keys" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own API keys" ON "public"."user_api_keys" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own activity logs" ON "public"."activity_logs" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own contacts" ON "public"."contacts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own data" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own event contacts" ON "public"."event_contacts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_contacts"."event_id") AND ("e"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own events" ON "public"."events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own notification logs" ON "public"."notification_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "notification_logs"."event_id") AND ("e"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can read their own API keys" ON "public"."user_api_keys" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own API keys" ON "public"."user_api_keys" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own activity logs" ON "public"."activity_logs" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own contacts" ON "public"."contacts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own data" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own events" ON "public"."events" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notification logs" ON "public"."notification_logs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "notification_logs"."event_id") AND ("e"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own activity logs" ON "public"."activity_logs" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own contacts" ON "public"."contacts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own data" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own event contacts" ON "public"."event_contacts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_contacts"."event_id") AND ("e"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own events" ON "public"."events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notification logs" ON "public"."notification_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "notification_logs"."event_id") AND ("e"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_missing_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_missing_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_missing_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_contact_alert_notification"("p_event_id" "uuid", "p_contact_email" "text", "p_contact_phone" "text", "p_content" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_contact_alert_notification"("p_event_id" "uuid", "p_contact_email" "text", "p_contact_phone" "text", "p_content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_contact_alert_notification"("p_event_id" "uuid", "p_contact_email" "text", "p_contact_phone" "text", "p_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_reminder_notification"("p_event_id" "uuid", "p_user_email" "text", "p_user_phone" "text", "p_content" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_reminder_notification"("p_event_id" "uuid", "p_user_email" "text", "p_user_phone" "text", "p_content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_reminder_notification"("p_event_id" "uuid", "p_user_email" "text", "p_user_phone" "text", "p_content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_events_needing_contact_alerts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_needing_contact_alerts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_needing_contact_alerts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_events_needing_user_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_needing_user_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_needing_user_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."interval_to_seconds"("interval_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."interval_to_seconds"("interval_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."interval_to_seconds"("interval_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."invoke_check_inactivity"() TO "anon";
GRANT ALL ON FUNCTION "public"."invoke_check_inactivity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoke_check_inactivity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."invoke_send_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."invoke_send_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoke_send_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."needs_checkin"("event_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."needs_checkin"("event_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."needs_checkin"("event_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_event_contacts"("p_event_id" "uuid", "p_contact_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_event_contacts"("p_event_id" "uuid", "p_contact_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event_contacts"("p_event_id" "uuid", "p_contact_ids" "uuid"[]) TO "service_role";



GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."event_contacts" TO "anon";
GRANT ALL ON TABLE "public"."event_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."event_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_logs" TO "service_role";



GRANT ALL ON TABLE "public"."user_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."user_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."user_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






RESET ALL;
