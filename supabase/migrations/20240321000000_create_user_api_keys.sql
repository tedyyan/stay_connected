-- Create user_api_keys table
CREATE TABLE IF NOT EXISTS public.user_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sendgrid_api_key TEXT,
    telnyx_api_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add RLS policies
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own API keys
CREATE POLICY "Users can read their own API keys"
    ON public.user_api_keys
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy for users to insert their own API keys
CREATE POLICY "Users can insert their own API keys"
    ON public.user_api_keys
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own API keys
CREATE POLICY "Users can update their own API keys"
    ON public.user_api_keys
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy for users to delete their own API keys
CREATE POLICY "Users can delete their own API keys"
    ON public.user_api_keys
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX idx_user_api_keys_user_id ON public.user_api_keys(user_id);

-- Enable realtime for user_api_keys table
ALTER PUBLICATION supabase_realtime ADD TABLE user_api_keys; 