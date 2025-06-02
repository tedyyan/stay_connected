-- Events Table Structure
-- This table stores check-in events that users create to monitor their activity

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

-- Primary Key Constraint
ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");

-- Indexes
CREATE INDEX "idx_event_contacts_event_id" ON "public"."events" USING "btree" ("id");

-- Enable Row Level Security
ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own events" ON "public"."events" 
    FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own events" ON "public"."events" 
    FOR UPDATE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their own events" ON "public"."events" 
    FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

-- Grant Permissions
GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role"; 