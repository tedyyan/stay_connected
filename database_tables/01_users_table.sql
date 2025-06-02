-- Users Table Structure
-- This table stores user profile information linked to Supabase auth

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

-- Primary Key Constraint
ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- Enable Row Level Security
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own data" ON "public"."users" 
    FOR SELECT USING (("auth"."uid"() = "id"));

CREATE POLICY "Users can update their own data" ON "public"."users" 
    FOR UPDATE USING (("auth"."uid"() = "id"));

-- Grant Permissions
GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role"; 