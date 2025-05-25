-- Add missing INSERT policy for events
DROP POLICY IF EXISTS "Users can insert their own events" ON public.events;
CREATE POLICY "Users can insert their own events"
ON public.events
FOR INSERT
WITH CHECK (auth.uid()::uuid = user_id);

-- Add missing INSERT policy for event_contacts
DROP POLICY IF EXISTS "Users can insert event contacts" ON public.event_contacts;
CREATE POLICY "Users can insert event contacts"
ON public.event_contacts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_id
    AND events.user_id = auth.uid()::uuid
  )
);

-- Fix activity logs policies
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can view their own activity logs"
ON public.activity_logs
FOR SELECT
USING (
  auth.uid()::uuid = user_id OR
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = activity_logs.event_id
    AND events.user_id = auth.uid()::uuid
  )
);

DROP POLICY IF EXISTS "Users can insert their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can insert their own activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (
  auth.uid()::uuid = user_id OR
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_id
    AND events.user_id = auth.uid()::uuid
  )
); 