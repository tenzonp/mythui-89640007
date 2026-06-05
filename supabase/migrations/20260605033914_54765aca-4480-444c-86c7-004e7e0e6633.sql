ALTER TABLE public.business_team_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS invite_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS member_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE INDEX IF NOT EXISTS business_team_members_invite_token_idx ON public.business_team_members(invite_token);
CREATE INDEX IF NOT EXISTS business_team_members_member_user_idx ON public.business_team_members(member_user_id);

DROP POLICY IF EXISTS "view invite as member" ON public.business_team_members;
CREATE POLICY "view invite as member" ON public.business_team_members
  FOR SELECT TO authenticated
  USING (member_user_id = auth.uid());

DROP POLICY IF EXISTS "accept invite as member" ON public.business_team_members;
CREATE POLICY "accept invite as member" ON public.business_team_members
  FOR UPDATE TO authenticated
  USING (member_user_id = auth.uid())
  WITH CHECK (member_user_id = auth.uid());