-- User API Keys Table Structure
-- This table stores third-party API keys for users (SendGrid, Telnyx, etc.)

CREATE TABLE IF NOT EXISTS "public"."user_api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sendgrid_api_key" "text",
    "telnyx_api_key" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."user_api_keys" OWNER TO "postgres";

-- Primary Key Constraint
ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_pkey" PRIMARY KEY ("id");

-- Unique Constraint (one record per user)
ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_user_id_key" UNIQUE ("user_id");

-- Foreign Key Constraints
ALTER TABLE "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

-- Indexes
CREATE INDEX "idx_user_api_keys_user_id" ON "public"."user_api_keys" USING "btree" ("user_id");

-- Enable Row Level Security
ALTER TABLE "public"."user_api_keys" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read their own API keys" ON "public"."user_api_keys" 
    FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own API keys" ON "public"."user_api_keys" 
    FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their own API keys" ON "public"."user_api_keys" 
    FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

-- Grant Permissions
GRANT ALL ON TABLE "public"."user_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."user_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."user_api_keys" TO "service_role"; 