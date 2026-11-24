-- Bound distributed rate-limit storage while preserving all live windows.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'vaani-rate-limit-bucket-cleanup'
  ) THEN
    PERFORM cron.schedule(
      'vaani-rate-limit-bucket-cleanup',
      '17 * * * *',
      $job$DELETE FROM private.rate_limit_buckets
           WHERE window_started_at < now() - interval '1 day'$job$
    );
  END IF;
END;
$migration$;
