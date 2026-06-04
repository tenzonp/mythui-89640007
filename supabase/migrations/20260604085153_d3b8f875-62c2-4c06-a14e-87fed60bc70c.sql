
-- Daily free credits scheduler
-- Grants 100 credits per day to every free-tier user, idempotently.

CREATE OR REPLACE FUNCTION public.grant_daily_free_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date := (now() at time zone 'utc')::date;
BEGIN
  -- Insert ledger rows for free users who haven't been granted today
  WITH eligible AS (
    SELECT up.user_id
    FROM public.user_plans up
    WHERE up.tier = 'free'
      AND NOT EXISTS (
        SELECT 1 FROM public.daily_grants dg
        WHERE dg.user_id = up.user_id AND dg.grant_date = today
      )
  ), marked AS (
    INSERT INTO public.daily_grants (user_id, grant_date)
    SELECT user_id, today FROM eligible
    ON CONFLICT DO NOTHING
    RETURNING user_id
  )
  INSERT INTO public.credit_ledger (user_id, kind, amount, meta)
  SELECT user_id, 'grant_daily', 100, jsonb_build_object('date', today, 'source', 'cron')
  FROM marked;
END;
$$;

-- Enable cron + schedule daily at 00:05 UTC
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule existing job if re-running
DO $$
BEGIN
  PERFORM cron.unschedule('grant-daily-free-credits');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'grant-daily-free-credits',
  '5 0 * * *',
  $$ SELECT public.grant_daily_free_credits(); $$
);
