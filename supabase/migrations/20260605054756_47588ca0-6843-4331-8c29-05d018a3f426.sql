-- Upgrade existing users to Everest and grant monthly credits
INSERT INTO public.user_plans (user_id, tier, monthly_credits, renews_at)
SELECT u.id, 'everest'::plan_tier, 40000, now() + interval '30 days'
FROM auth.users u
ON CONFLICT (user_id) DO UPDATE
SET tier = 'everest', monthly_credits = 40000, renews_at = now() + interval '30 days', updated_at = now();

INSERT INTO public.credit_ledger (user_id, kind, amount, meta)
SELECT u.id, 'grant_monthly', 40000, jsonb_build_object('tier','everest','source','manual_upgrade')
FROM auth.users u;