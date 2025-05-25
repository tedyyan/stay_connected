-- Add is_admin column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create default admin user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@example.com',
  crypt('pass1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin User"}',
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;

-- Get the admin user ID
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@example.com';
  
  -- Insert into public.users table
  INSERT INTO public.users (id, user_id, name, email, token_identifier, full_name, is_admin)
  VALUES (
    admin_id,
    admin_id,
    'Admin User',
    'admin@example.com',
    admin_id,
    'Admin User',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;
END
$$;

-- Update RLS policies for contacts
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
CREATE POLICY "Users can view their own contacts or admins can view all"
ON public.contacts FOR SELECT
USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
);

DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.contacts;
CREATE POLICY "Users can insert their own contacts"
ON public.contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
CREATE POLICY "Users can update their own contacts or admins can update all"
ON public.contacts FOR UPDATE
USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Update RLS policies for events
DROP POLICY IF EXISTS "Users can view their own events" ON public.events;
CREATE POLICY "Users can view their own events or admins can view all"
ON public.events FOR SELECT
USING (
  auth.uid()::uuid = user_id OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
);

DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
CREATE POLICY "Users can update their own events or admins can update all"
ON public.events FOR UPDATE
USING (
  auth.uid()::uuid = user_id OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Update RLS policies for notification logs
DROP POLICY IF EXISTS "Users can view their own notification logs" ON public.notification_logs;
CREATE POLICY "Users can view their own notification logs or admins can view all"
ON public.notification_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = notification_logs.event_id
    AND (events.user_id = auth.uid() OR 
         EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE))
  )
);

-- Update RLS policies for activity logs
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can view their own activity logs or admins can view all"
ON public.activity_logs FOR SELECT
USING (
  user_id::uuid = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
);
