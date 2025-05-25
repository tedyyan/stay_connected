-- Update activity_logs table to use UUID for user_id
ALTER TABLE public.activity_logs ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

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