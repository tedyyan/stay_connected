-- Database functions for enhanced notification system

-- Function to get events that need user reminders
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
  WHERE e.status = 'active'
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

-- Function to get events that need contact alerts
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
  WHERE e.status = 'active'
    AND EXTRACT(EPOCH FROM (NOW() - COALESCE(get_last_checkin(e.id), e.created_at))) / 3600 >= (e.notification_interval * 24 * e.missed_checkin_threshold)
    AND NOT EXISTS (
      -- Don't alert if we already sent contact alerts for this missed period
      SELECT 1 FROM missed_checkins mc 
      WHERE mc.event_id = e.id 
        AND mc.contacts_notified = true
        AND mc.created_at > NOW() - (e.notification_interval || ' days')::INTERVAL
    )
    AND EXISTS (
      -- Only alert if user has contacts
      SELECT 1 FROM contacts c WHERE c.user_id = e.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get events that should be triggered
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
  WHERE e.status = 'active'
    AND EXTRACT(EPOCH FROM (NOW() - COALESCE(get_last_checkin(e.id), e.created_at))) / 3600 >= (e.notification_interval * 24 * e.missed_checkin_threshold * 2) -- Double the threshold for triggering
    AND EXISTS (
      -- Only trigger if contacts have been notified
      SELECT 1 FROM missed_checkins mc 
      WHERE mc.event_id = e.id 
        AND mc.contacts_notified = true
        AND mc.created_at > NOW() - (e.notification_interval * 2 || ' days')::INTERVAL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to perform a manual check-in
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
  -- Verify the event belongs to the user
  IF NOT EXISTS (
    SELECT 1 FROM events WHERE id = event_id_param AND user_id = user_id_param
  ) THEN
    RAISE EXCEPTION 'Event not found or access denied';
  END IF;
  
  -- Insert the check-in
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
  
  -- Resolve any open missed check-ins
  UPDATE missed_checkins 
  SET 
    resolved_at = NOW(),
    resolution_method = 'user_checkin'
  WHERE event_id = event_id_param 
    AND user_id = user_id_param 
    AND resolved_at IS NULL;
  
  -- Reset event status to active if it was triggered
  UPDATE events 
  SET status = 'active'
  WHERE id = event_id_param 
    AND status = 'triggered';
  
  RETURN checkin_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's check-in status
CREATE OR REPLACE FUNCTION get_user_checkin_status(user_id_param UUID)
RETURNS TABLE (
  event_id UUID,
  event_name TEXT,
  event_status TEXT,
  last_checkin TIMESTAMP WITH TIME ZONE,
  next_checkin_due TIMESTAMP WITH TIME ZONE,
  hours_until_due INTEGER,
  is_overdue BOOLEAN,
  hours_overdue INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as event_id,
    e.name as event_name,
    e.status as event_status,
    get_last_checkin(e.id) as last_checkin,
    COALESCE(get_last_checkin(e.id), e.created_at) + (e.notification_interval || ' days')::INTERVAL as next_checkin_due,
    GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(get_last_checkin(e.id), e.created_at) + (e.notification_interval || ' days')::INTERVAL - NOW())) / 3600)::INTEGER as hours_until_due,
    (EXTRACT(EPOCH FROM (NOW() - COALESCE(get_last_checkin(e.id), e.created_at))) / 3600) >= (e.notification_interval * 24) as is_overdue,
    GREATEST(0, EXTRACT(EPOCH FROM (NOW() - COALESCE(get_last_checkin(e.id), e.created_at))) / 3600 - (e.notification_interval * 24))::INTEGER as hours_overdue
  FROM events e
  WHERE e.user_id = user_id_param
    AND e.status IN ('active', 'triggered')
  ORDER BY next_checkin_due ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_events_needing_user_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION get_events_needing_contact_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_events_to_trigger() TO authenticated;
GRANT EXECUTE ON FUNCTION perform_checkin(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_checkin_status(UUID) TO authenticated;

SELECT 'Notification functions created successfully!' as result; 