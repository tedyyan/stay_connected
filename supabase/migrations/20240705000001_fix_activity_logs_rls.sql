-- Add missing INSERT policy for activity_logs
DROP POLICY IF EXISTS "Users can insert their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can insert their own activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id::uuid);

-- Add missing INSERT policy for notification_logs
DROP POLICY IF EXISTS "Users can insert notification logs" ON public.notification_logs;
CREATE POLICY "Users can insert notification logs"
ON public.notification_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = event_id
    AND events.user_id = auth.uid()
  )
); 