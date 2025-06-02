-- Event Contacts Junction Table Structure
-- This table manages the many-to-many relationship between events and contacts

CREATE TABLE IF NOT EXISTS "public"."event_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."event_contacts" OWNER TO "postgres";

-- Primary Key Constraint
ALTER TABLE ONLY "public"."event_contacts"
    ADD CONSTRAINT "event_contacts_pkey" PRIMARY KEY ("id");

-- Unique Constraint (prevent duplicate relationships)
ALTER TABLE ONLY "public"."event_contacts"
    ADD CONSTRAINT "event_contacts_event_id_contact_id_key" UNIQUE ("event_id", "contact_id");

-- Foreign Key Constraints
ALTER TABLE "public"."event_contacts"
    ADD CONSTRAINT "event_contacts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;

ALTER TABLE "public"."event_contacts"
    ADD CONSTRAINT "event_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;

-- Indexes for better query performance
CREATE INDEX "idx_event_contacts_event_id" ON "public"."event_contacts" USING "btree" ("event_id");
CREATE INDEX "idx_event_contacts_contact_id" ON "public"."event_contacts" USING "btree" ("contact_id");

-- Enable Row Level Security
ALTER TABLE "public"."event_contacts" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own event contacts" ON "public"."event_contacts" 
    FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_contacts"."event_id") AND ("e"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can insert their own event contacts" ON "public"."event_contacts" 
    FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_contacts"."event_id") AND ("e"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can update their own event contacts" ON "public"."event_contacts" 
    FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_contacts"."event_id") AND ("e"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can delete their own event contacts" ON "public"."event_contacts" 
    FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_contacts"."event_id") AND ("e"."user_id" = "auth"."uid"())))));

-- Grant Permissions
GRANT ALL ON TABLE "public"."event_contacts" TO "anon";
GRANT ALL ON TABLE "public"."event_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."event_contacts" TO "service_role"; 