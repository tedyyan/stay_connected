-- Create a view for monitoring the inactivity checker
CREATE OR REPLACE VIEW public.inactivity_monitor AS
WITH job_status AS (
    SELECT 
        j.jobname,
        j.schedule,
        j.active,
        jrd.start_time as last_run,
        jrd.status as last_run_status,
        jrd.return_message as last_run_message
    FROM cron.job j
    LEFT JOIN LATERAL (
        SELECT * FROM cron.job_run_details 
        WHERE jobid = j.jobid 
        ORDER BY start_time DESC 
        LIMIT 1
    ) jrd ON true
    WHERE j.jobname = 'check-user-inactivity'
),
triggered_events AS (
    SELECT 
        COUNT(*) as triggered_count,
        MAX(last_trigger_time) as last_trigger
    FROM public.events
    WHERE status = 'triggered'
),
pending_notifications AS (
    SELECT 
        COUNT(*) as pending_count,
        MAX(sent_at) as last_notification
    FROM public.notification_logs
    WHERE status = 'pending'
)
SELECT 
    js.jobname,
    js.schedule,
    js.active as is_job_active,
    js.last_run,
    js.last_run_status,
    js.last_run_message,
    te.triggered_count as current_triggered_events,
    te.last_trigger as last_event_trigger,
    pn.pending_count as pending_notifications,
    pn.last_notification as last_notification_time
FROM job_status js
CROSS JOIN triggered_events te
CROSS JOIN pending_notifications pn;

-- Grant access to the view
GRANT SELECT ON public.inactivity_monitor TO authenticated; 