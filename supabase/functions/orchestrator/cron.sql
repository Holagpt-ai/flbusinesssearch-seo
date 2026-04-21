-- Orchestrator runs every 15 minutes
SELECT cron.schedule(
  'orchestrator-agent',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vfftynfyxazjlzfrhwiw.supabase.co/functions/v1/orchestrator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
