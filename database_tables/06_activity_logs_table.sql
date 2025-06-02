-- Activity Logs Table Structure
-- This table tracks user actions and system events for auditing

CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "action" "text" NOT NULL,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."activity_logs" OWNER TO "postgres";

-- Primary Key Constraint
ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");

-- Foreign Key Constraints
ALTER TABLE "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;

-- Indexes
CREATE INDEX "idx_activity_logs_user_id" ON "public"."activity_logs" USING "btree" ("user_id");
CREATE INDEX "idx_activity_logs_event_id" ON "public"."activity_logs" USING "btree" ("event_id");
CREATE INDEX "idx_activity_logs_created_at" ON "public"."activity_logs" USING "btree" ("created_at");

-- Enable Row Level Security
ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own activity logs" ON "public"."activity_logs" 
    FOR SELECT USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can insert their own activity logs" ON "public"."activity_logs" 
    FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can update their own activity logs" ON "public"."activity_logs" 
    FOR UPDATE USING (("user_id" = "auth"."uid"()));

-- Grant Permissions
GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role"; 