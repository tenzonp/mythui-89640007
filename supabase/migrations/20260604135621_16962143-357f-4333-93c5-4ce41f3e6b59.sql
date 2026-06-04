-- Business knowledge base tables: profile, team, accounts, free-form entries.

-- 1) business_profile (one row per user)
CREATE TABLE IF NOT EXISTS public.business_profile (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  tagline text,
  description text,
  industry text,
  website text,
  primary_goal text,
  tone text,
  target_audience text,
  value_props text[] DEFAULT '{}'::text[],
  extra jsonb DEFAULT '{}'::jsonb,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profile TO authenticated;
GRANT ALL ON public.business_profile TO service_role;
ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own business_profile" ON public.business_profile
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER business_profile_set_updated_at
  BEFORE UPDATE ON public.business_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) business_team_members
CREATE TABLE IF NOT EXISTS public.business_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_team_members_user_idx ON public.business_team_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_team_members TO authenticated;
GRANT ALL ON public.business_team_members TO service_role;
ALTER TABLE public.business_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own team members" ON public.business_team_members
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER business_team_members_set_updated_at
  BEFORE UPDATE ON public.business_team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) business_accounts (gmail / instagram / x / linkedin / tiktok / youtube / phone / other)
CREATE TABLE IF NOT EXISTS public.business_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  handle text,
  url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_accounts_user_idx ON public.business_accounts(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_accounts TO authenticated;
GRANT ALL ON public.business_accounts TO service_role;
ALTER TABLE public.business_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.business_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER business_accounts_set_updated_at
  BEFORE UPDATE ON public.business_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) business_knowledge_entries (free-form facts: products, pricing, FAQs, policies)
CREATE TABLE IF NOT EXISTS public.business_knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  tags text[] DEFAULT '{}'::text[],
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_knowledge_user_idx ON public.business_knowledge_entries(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_knowledge_entries TO authenticated;
GRANT ALL ON public.business_knowledge_entries TO service_role;
ALTER TABLE public.business_knowledge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own knowledge entries" ON public.business_knowledge_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER business_knowledge_set_updated_at
  BEFORE UPDATE ON public.business_knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();