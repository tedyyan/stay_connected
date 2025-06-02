-- Contacts Table Structure
-- This table stores contact information for emergency notifications

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

-- Primary Key Constraint
ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");

-- Enable Row Level Security
ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own contacts" ON "public"."contacts" 
    FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own contacts" ON "public"."contacts" 
    FOR UPDATE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their own contacts" ON "public"."contacts" 
    FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete their own contacts" ON "public"."contacts" 
    FOR DELETE USING (("auth"."uid"() = "user_id"));

-- Grant Permissions
GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role"; 