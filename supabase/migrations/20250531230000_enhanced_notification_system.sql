-- Enhanced Notification System Migration
-- Adds check-ins, contacts, notification rules, and event status tracking

-- Add new columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS missed_checkin_threshold INTEGER DEFAULT 2;
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'paused'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_message_to_contacts TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_notification_methods TEXT[] DEFAULT ARRAY['push', 'email'];
ALTER TABLE events ADD COLUMN IF NOT EXISTS contact_notification_methods TEXT[] DEFAULT ARRAY['email', 'sms'];

-- Create contacts table for emergency contacts
CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  relationship TEXT,
  notification_preference TEXT[] DEFAULT ARRAY['email'],
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Create check_ins table to track when users check in
CREATE TABLE IF NOT EXISTS check_ins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  method TEXT DEFAULT 'manual' CHECK (method IN ('manual', 'auto', 'api')),
  location TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_rules table for customizable notification logic
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('user_reminder', 'contact_alert', 'escalation')),
  trigger_after_hours INTEGER NOT NULL,
  notification_methods TEXT[] NOT NULL,
  message_template TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create missed_checkins table to track missed check-in incidents
CREATE TABLE IF NOT EXISTS missed_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expected_checkin_time TIMESTAMP WITH TIME ZONE NOT NULL,
  missed_hours INTEGER NOT NULL,
  contacts_notified BOOLEAN DEFAULT false,
  contacts_notified_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_method TEXT CHECK (resolution_method IN ('user_checkin', 'manual_resolve', 'timeout')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all new tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE missed_checkins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contacts
CREATE POLICY "Users can manage their own contacts" ON contacts
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for check_ins
CREATE POLICY "Users can manage their own check-ins" ON check_ins
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for notification_rules
CREATE POLICY "Users can manage notification rules for their events" ON notification_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = notification_rules.event_id 
      AND events.user_id = auth.uid()
    )
  );

-- Create RLS policies for missed_checkins
CREATE POLICY "Users can view their own missed check-ins" ON missed_checkins
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_event_id ON check_ins(event_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_user_id ON check_ins(user_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_checked_in_at ON check_ins(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_notification_rules_event_id ON notification_rules(event_id);
CREATE INDEX IF NOT EXISTS idx_missed_checkins_event_id ON missed_checkins(event_id);
CREATE INDEX IF NOT EXISTS idx_missed_checkins_user_id ON missed_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_rules_updated_at
  BEFORE UPDATE ON notification_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to get last check-in for an event
CREATE OR REPLACE FUNCTION get_last_checkin(event_id_param UUID)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  RETURN (
    SELECT MAX(checked_in_at)
    FROM check_ins
    WHERE event_id = event_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user needs to check in
CREATE OR REPLACE FUNCTION needs_checkin(event_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  event_record events%ROWTYPE;
  last_checkin TIMESTAMP WITH TIME ZONE;
  hours_since_last INTEGER;
BEGIN
  -- Get event details
  SELECT * INTO event_record FROM events WHERE id = event_id_param;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Get last check-in
  SELECT get_last_checkin(event_id_param) INTO last_checkin;
  
  -- If no check-ins yet, use event creation time
  IF last_checkin IS NULL THEN
    last_checkin := event_record.created_at;
  END IF;
  
  -- Calculate hours since last check-in
  hours_since_last := EXTRACT(EPOCH FROM (NOW() - last_checkin)) / 3600;
  
  -- Return true if it's been longer than the notification interval
  RETURN hours_since_last >= (event_record.notification_interval * 24);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default notification rules for existing events
INSERT INTO notification_rules (event_id, rule_type, trigger_after_hours, notification_methods, message_template, is_active)
SELECT 
  id as event_id,
  'user_reminder' as rule_type,
  (notification_interval * 24) as trigger_after_hours,
  ARRAY['push', 'email'] as notification_methods,
  'Time to check in! Please open the Stay Connected app and confirm you are safe.' as message_template,
  true as is_active
FROM events
WHERE NOT EXISTS (
  SELECT 1 FROM notification_rules nr 
  WHERE nr.event_id = events.id AND nr.rule_type = 'user_reminder'
);

-- Insert default contact alert rules for existing events
INSERT INTO notification_rules (event_id, rule_type, trigger_after_hours, notification_methods, message_template, is_active)
SELECT 
  id as event_id,
  'contact_alert' as rule_type,
  (notification_interval * 24 * 2) as trigger_after_hours, -- 2x the normal interval
  ARRAY['email', 'sms'] as notification_methods,
  'ALERT: We have not heard from {{user_name}} in over {{hours}} hours. Last expected check-in was {{expected_time}}. Please check on them.' as message_template,
  true as is_active
FROM events
WHERE NOT EXISTS (
  SELECT 1 FROM notification_rules nr 
  WHERE nr.event_id = events.id AND nr.rule_type = 'contact_alert'
);

SELECT 'Enhanced notification system created successfully!' as result; 