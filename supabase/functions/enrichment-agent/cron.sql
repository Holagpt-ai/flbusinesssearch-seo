-- Enrichment agent runs every hour to catch any pending records
-- that Agent 1 may have missed triggering directly
SELECT cron.schedule(
  'enrichment-agent-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vfftynfyxazjlzfrhwiw.supabase.co/functions/v1/enrichment-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

