-- Add missing columns and tables that were lost during database reset

-- Add missed_checkin_threshold column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS missed_checkin_threshold INTEGER DEFAULT 2;

-- Add notification_interval column if it doesn't exist (fallback for old events)
ALTER TABLE events ADD COLUMN IF NOT EXISTS notification_interval INTEGER DEFAULT 1;

-- Update any existing events that might be missing these values
UPDATE events SET missed_checkin_threshold = 2 WHERE missed_checkin_threshold IS NULL;
UPDATE events SET notification_interval = 1 WHERE notification_interval IS NULL;

-- Create event_contacts junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.event_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE(event_id, contact_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_event_contacts_event_id ON public.event_contacts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_contacts_contact_id ON public.event_contacts(contact_id);

-- Enable RLS on event_contacts
ALTER TABLE public.event_contacts ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for event_contacts
DROP POLICY IF EXISTS "Users can view their own event contacts" ON public.event_contacts;
CREATE POLICY "Users can view their own event contacts"
  ON public.event_contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
      AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own event contacts" ON public.event_contacts;
CREATE POLICY "Users can insert their own event contacts"
  ON public.event_contacts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
      AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own event contacts" ON public.event_contacts;
CREATE POLICY "Users can update their own event contacts"
  ON public.event_contacts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
      AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own event contacts" ON public.event_contacts;
CREATE POLICY "Users can delete their own event contacts"
  ON public.event_contacts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
      AND e.user_id = auth.uid()
    )
  );
