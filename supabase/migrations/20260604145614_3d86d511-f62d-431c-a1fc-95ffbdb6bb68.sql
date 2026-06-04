UPDATE public.user_plans
SET tier = 'everest',
    monthly_credits = 40000,
    renews_at = (now() + interval '30 days')
WHERE user_id = '669899f1-1220-49f1-a01e-ca6722055180';

INSERT INTO public.credit_ledger (user_id, kind, amount, meta)
VALUES (
  '669899f1-1220-49f1-a01e-ca6722055180',
  'grant_monthly',
  40000,
  jsonb_build_object('tier', 'everest', 'reason', 'manual_grant')
);