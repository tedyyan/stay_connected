-- Fix RLS policies for contacts table
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create their own contacts" ON contacts;
CREATE POLICY "Users can create their own contacts"
ON contacts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
CREATE POLICY "Users can view their own contacts"
ON contacts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
CREATE POLICY "Users can update their own contacts"
ON contacts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;
CREATE POLICY "Users can delete their own contacts"
ON contacts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add notification_preference column to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notification_preference VARCHAR(10) DEFAULT 'email';

-- Add API keys table for users
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sendgrid_api_key TEXT,
  telnyx_api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own API keys" ON user_api_keys;
CREATE POLICY "Users can manage their own API keys"
ON user_api_keys
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- Enable realtime for user_api_keys
alter publication supabase_realtime add table user_api_keys;
