-- Create contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  social_media JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted BOOLEAN DEFAULT FALSE
);

-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  max_inactivity_time TEXT NOT NULL,
  contacts JSONB NOT NULL,
  last_check_in TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notification_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  memo TEXT,
  deleted BOOLEAN DEFAULT FALSE,
  last_trigger_time TIMESTAMP WITH TIME ZONE,
  muted BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'running' CHECK (status IN ('deleted', 'running', 'triggered', 'paused'))
);

-- Create notification logs table
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES public.events(id) NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'sms')),
  recipient TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL,
  error_message TEXT
);

-- Create activity logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  event_id UUID REFERENCES public.events(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Contacts policies
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
CREATE POLICY "Users can view their own contacts"
ON public.contacts FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.contacts;
CREATE POLICY "Users can insert their own contacts"
ON public.contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
CREATE POLICY "Users can update their own contacts"
ON public.contacts FOR UPDATE
USING (auth.uid() = user_id);

-- Events policies
DROP POLICY IF EXISTS "Users can view their own events" ON public.events;
CREATE POLICY "Users can view their own events"
ON public.events FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own events" ON public.events;
CREATE POLICY "Users can insert their own events"
ON public.events FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
CREATE POLICY "Users can update their own events"
ON public.events FOR UPDATE
USING (auth.uid() = user_id);

-- Notification logs policies
DROP POLICY IF EXISTS "Users can view their own notification logs" ON public.notification_logs;
CREATE POLICY "Users can view their own notification logs"
ON public.notification_logs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.events
  WHERE events.id = notification_logs.event_id
  AND events.user_id = auth.uid()
));

-- Activity logs policies
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can view their own activity logs"
ON public.activity_logs FOR SELECT
USING (user_id::uuid = auth.uid());

-- Enable realtime
alter publication supabase_realtime add table contacts;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table notification_logs;
alter publication supabase_realtime add table activity_logs;
