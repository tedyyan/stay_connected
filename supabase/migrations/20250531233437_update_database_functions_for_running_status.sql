-- Update database functions to use 'running' status instead of 'active'

-- Update get_events_needing_user_reminders function
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
    e.notification_interval,
    get_last_checkin(e.id) as last_checkin,
    GREATEST(0, EXTRACT(EPOCH FROM (NOW() - COALESCE(get_last_checkin(e.id), e.created_at))) / 3600)::INTEGER as hours_overdue
  FROM events e
  JOIN auth.users u ON e.user_id = u.id
  WHERE e.status = 'running'
    AND needs_checkin(e.id) = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_events_needing_contact_alerts function
CREATE OR REPLACE FUNCTION get_events_needing_contact_alerts()
RETURNS TABLE (
  id UUID,
  name TEXT,
  user_id UUID,
  user_name TEXT,
  notification_interval INTEGER,
  missed_checkin_threshold INTEGER,
  last_checkin TIMESTAMP WITH TIME ZONE,
  hours_overdue INTEGER,
  expected_checkin_time TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.user_id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) as user_name,
    e.notification_interval,
    e.missed_checkin_threshold,
    get_last_checkin(e.id) as last_checkin,
    GREATEST(0, EXTRACT(EPOCH FROM (NOW() - COALESCE(get_last_checkin(e.id), e.created_at))) / 3600)::INTEGER as hours_overdue,
    TO_CHAR(COALESCE(get_last_checkin(e.id), e.created_at) + (e.notification_interval || ' days')::INTERVAL, 'YYYY-MM-DD HH24:MI') as expected_checkin_time
  FROM events e
  JOIN auth.users u ON e.user_id = u.id
  WHERE e.status = 'running'
    AND EXTRACT(EPOCH FROM (NOW() - COALESCE(get_last_checkin(e.id), e.created_at))) / 3600 >= (e.notification_interval * 24 * e.missed_checkin_threshold)
    AND NOT EXISTS (
      SELECT 1 FROM missed_checkins mc 
      WHERE mc.event_id = e.id 
        AND mc.contacts_notified = true
        AND mc.created_at > NOW() - (e.notification_interval || ' days')::INTERVAL
    )
    AND EXISTS (
      SELECT 1 FROM contacts c WHERE c.user_id = e.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_events_to_trigger function
CREATE OR REPLACE FUNCTION get_events_to_trigger()
RETURNS TABLE (
  id UUID,
  name TEXT,
  user_id UUID,
  notification_interval INTEGER,
  missed_checkin_threshold INTEGER,
  hours_overdue INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.user_id,
    e.notification_interval,
    e.missed_checkin_threshold,
    GREATEST(0, EXTRACT(EPOCH FROM (NOW() - COALESCE(get_last_checkin(e.id), e.created_at))) / 3600)::INTEGER as hours_overdue
  FROM events e
  WHERE e.status = 'running'
    AND EXTRACT(EPOCH FROM (NOW() - COALESCE(get_last_checkin(e.id), e.created_at))) / 3600 >= (e.notification_interval * 24 * e.missed_checkin_threshold * 2)
    AND EXISTS (
      SELECT 1 FROM missed_checkins mc 
      WHERE mc.event_id = e.id 
        AND mc.contacts_notified = true
        AND mc.created_at > NOW() - (e.notification_interval * 2 || ' days')::INTERVAL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update perform_checkin function
CREATE OR REPLACE FUNCTION perform_checkin(
  event_id_param UUID,
  user_id_param UUID,
  notes_param TEXT DEFAULT NULL,
  location_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  checkin_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM events WHERE id = event_id_param AND user_id = user_id_param
  ) THEN
    RAISE EXCEPTION 'Event not found or access denied';
  END IF;
  
  INSERT INTO check_ins (
    event_id,
    user_id,
    checked_in_at,
    method,
    location,
    notes
  ) VALUES (
    event_id_param,
    user_id_param,
    NOW(),
    'manual',
    location_param,
    notes_param
  ) RETURNING id INTO checkin_id;
  
  UPDATE missed_checkins 
  SET 
    resolved_at = NOW(),
    resolution_method = 'user_checkin'
  WHERE event_id = event_id_param 
    AND user_id = user_id_param 
    AND resolved_at IS NULL;
  
  UPDATE events 
  SET status = 'running'
  WHERE id = event_id_param 
    AND status = 'triggered';
  
  RETURN checkin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
