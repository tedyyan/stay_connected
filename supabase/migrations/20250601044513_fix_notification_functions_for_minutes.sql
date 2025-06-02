-- Fix notification functions to handle max_inactivity_time (minutes/hours) instead of just notification_interval (days)

-- Helper function to convert PostgreSQL interval to seconds
CREATE OR REPLACE FUNCTION interval_to_seconds(interval_text TEXT)
RETURNS INTEGER AS $$
DECLARE
  seconds INTEGER := 0;
  hours INTEGER;
  minutes INTEGER;
  secs INTEGER;
BEGIN
  -- Handle PostgreSQL interval format like "00:05:00" (HH:MM:SS)
  IF interval_text ~ '^\d{2}:\d{2}:\d{2}$' THEN
    hours := EXTRACT(EPOCH FROM interval_text::INTERVAL) / 3600;
    minutes := (EXTRACT(EPOCH FROM interval_text::INTERVAL) % 3600) / 60;
    secs := EXTRACT(EPOCH FROM interval_text::INTERVAL) % 60;
    RETURN EXTRACT(EPOCH FROM interval_text::INTERVAL)::INTEGER;
  END IF;
  
  -- Handle text format like "5 minutes", "1 day", etc.
  SELECT EXTRACT(EPOCH FROM interval_text::INTERVAL)::INTEGER INTO seconds;
  RETURN seconds;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback: assume it's days if we can't parse it
    RETURN 86400; -- 1 day in seconds
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated needs_checkin function that handles both notification_interval and max_inactivity_time
CREATE OR REPLACE FUNCTION needs_checkin(event_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  event_record events%ROWTYPE;
  last_checkin TIMESTAMP WITH TIME ZONE;
  seconds_since_last INTEGER;
  interval_seconds INTEGER;
BEGIN
  SELECT * INTO event_record FROM events WHERE id = event_id_param;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  SELECT get_last_checkin(event_id_param) INTO last_checkin;
  
  IF last_checkin IS NULL THEN
    last_checkin := event_record.created_at;
  END IF;
  
  seconds_since_last := EXTRACT(EPOCH FROM (NOW() - last_checkin))::INTEGER;
  
  -- Use max_inactivity_time if available, otherwise fall back to notification_interval
  IF event_record.max_inactivity_time IS NOT NULL THEN
    interval_seconds := interval_to_seconds(event_record.max_inactivity_time);
  ELSE
    -- Fallback to old notification_interval (days)
    interval_seconds := COALESCE(event_record.notification_interval, 1) * 24 * 3600;
  END IF;
  
  RETURN seconds_since_last >= interval_seconds;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated get_events_needing_user_reminders function
CREATE OR REPLACE FUNCTION get_events_needing_user_reminders()
RETURNS TABLE (
  id UUID,
  name TEXT,
  user_id UUID,
  user_email TEXT,
  user_phone TEXT,
  notification_interval INTEGER,
  last_checkin TIMESTAMP WITH TIME ZONE,
  hours_overdue INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.user_id,
    u.email as user_email,
    u.phone as user_phone,
    COALESCE(e.notification_interval, 1) as notification_interval,
    get_last_checkin(e.id) as last_checkin,
    GREATEST(0, EXTRACT(EPOCH FROM (NOW() - COALESCE(get_last_checkin(e.id), e.created_at))) / 3600)::INTEGER as hours_overdue
  FROM events e
  JOIN auth.users u ON e.user_id = u.id
  WHERE e.status = 'running'
    AND needs_checkin(e.id) = true
    AND NOT EXISTS (
      -- Don't send if we already sent a reminder in the last hour
      SELECT 1 FROM notification_logs nl 
      WHERE nl.event_id = e.id 
        AND nl.notification_type IN ('push', 'email', 'sms')
        AND nl.created_at > NOW() - INTERVAL '1 hour'
        AND nl.status = 'sent'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
