-- Create a function to invoke the edge function
CREATE OR REPLACE FUNCTION invoke_send_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Call edge function using pg_net extension
    PERFORM
        net.http_post(
            url := current_setting('app.settings.edge_function_base_url') || '/send-notification',
            headers := jsonb_build_object(
                'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
                'Content-Type', 'application/json'
            ),
            body := '{}'
        );
END;
$$;

-- Schedule the notification sender to run every minute
SELECT cron.schedule(
    'process-notifications',
    '* * * * *',
    $$SELECT invoke_send_notifications()$$
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION invoke_send_notifications() TO authenticated; 