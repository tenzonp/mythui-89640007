-- Plan tier enum
CREATE TYPE public.plan_tier AS ENUM ('free','pro','everest');

-- user_plans
CREATE TABLE public.user_plans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier public.plan_tier NOT NULL DEFAULT 'free',
  monthly_credits int NOT NULL DEFAULT 0,
  renews_at timestamptz,
  dodo_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_plans TO authenticated;
GRANT ALL ON public.user_plans TO service_role;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own plan" ON public.user_plans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_user_plans_updated_at
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- credit_ledger
CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.threads(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('grant_monthly','grant_daily','spend','refund','adjust')),
  amount int NOT NULL,
  model text,
  agent_id text,
  complexity text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_ledger_user_created_idx ON public.credit_ledger (user_id, created_at DESC);
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own ledger" ON public.credit_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- daily_grants
CREATE TABLE public.daily_grants (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grant_date date NOT NULL,
  PRIMARY KEY (user_id, grant_date)
);
GRANT SELECT ON public.daily_grants TO authenticated;
GRANT ALL ON public.daily_grants TO service_role;
ALTER TABLE public.daily_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own daily grants" ON public.daily_grants
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Balance helper
CREATE OR REPLACE FUNCTION public.get_credit_balance(uid uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount), 0)::int FROM public.credit_ledger WHERE user_id = uid;
$$;
GRANT EXECUTE ON FUNCTION public.get_credit_balance(uuid) TO authenticated, service_role;

-- Auto-create Free plan row for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_plans (user_id, tier) VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_plan ON auth.users;
CREATE TRIGGER on_auth_user_created_plan
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_plan();

-- Backfill plans for existing users
INSERT INTO public.user_plans (user_id, tier)
SELECT id, 'free' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;