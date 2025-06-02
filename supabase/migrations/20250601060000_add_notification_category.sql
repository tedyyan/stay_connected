-- Add notification_category column to distinguish between user reminders and contact alerts

-- Add the new column
ALTER TABLE notification_logs 
ADD COLUMN IF NOT EXISTS notification_category TEXT;

-- Create a check constraint for valid categories
ALTER TABLE notification_logs 
ADD CONSTRAINT notification_category_check 
CHECK (notification_category IN ('user_reminder', 'contact_alert', 'event_trigger'));

-- Update existing records based on content patterns
UPDATE notification_logs 
SET notification_category = CASE
    WHEN content LIKE '%You missed%' OR content LIKE '%Check-in reminder%' THEN 'user_reminder'
    WHEN content LIKE '%has been inactive%' OR content LIKE '%Please check on%' THEN 'contact_alert'
    ELSE 'event_trigger'
END
WHERE notification_category IS NULL;

-- Set default value for future records
ALTER TABLE notification_logs 
ALTER COLUMN notification_category SET DEFAULT 'user_reminder';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_category 
ON notification_logs(notification_category);

-- Add comments for documentation
COMMENT ON COLUMN notification_logs.notification_category IS 
'Categories: user_reminder (reminders to user), contact_alert (alerts to contacts), event_trigger (full event notifications)';

SELECT 'Notification category column added successfully!' as result; 