-- Notification Logs Table Structure
-- This table tracks all notifications sent by the system

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
    CONSTRAINT "notification_logs_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['email'::"text", 'sms'::"text", 'push'::"text"])))
);

ALTER TABLE "public"."notification_logs" OWNER TO "postgres";

-- Comments
COMMENT ON COLUMN "public"."notification_logs"."notification_category" IS 'Categories: user_reminder (reminders to user), contact_alert (alerts to contacts), event_trigger (full event notifications)';

-- Primary Key Constraint
ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");

-- Foreign Key Constraints
ALTER TABLE "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;

-- Indexes
CREATE INDEX "idx_notification_logs_event_id" ON "public"."notification_logs" USING "btree" ("event_id");
CREATE INDEX "idx_notification_logs_category" ON "public"."notification_logs" USING "btree" ("notification_category");
CREATE INDEX "idx_notification_logs_sent_at" ON "public"."notification_logs" USING "btree" ("sent_at");

-- Enable Row Level Security
ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notification logs" ON "public"."notification_logs" 
    FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "notification_logs"."event_id") AND ("e"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can insert their own notification logs" ON "public"."notification_logs" 
    FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "notification_logs"."event_id") AND ("e"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can update their own notification logs" ON "public"."notification_logs" 
    FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "notification_logs"."event_id") AND ("e"."user_id" = "auth"."uid"())))));

-- Grant Permissions
GRANT ALL ON TABLE "public"."notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_logs" TO "service_role"; 