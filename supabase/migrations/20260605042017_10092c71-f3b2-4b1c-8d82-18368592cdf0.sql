
-- 1) Restrict permissive policies from public to authenticated
DROP POLICY IF EXISTS "own accounts" ON public.business_accounts;
CREATE POLICY "own accounts" ON public.business_accounts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own knowledge entries" ON public.business_knowledge_entries;
CREATE POLICY "own knowledge entries" ON public.business_knowledge_entries
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own business_profile" ON public.business_profile;
CREATE POLICY "own business_profile" ON public.business_profile
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own team members" ON public.business_team_members;
CREATE POLICY "own team members" ON public.business_team_members
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2) Storage RLS for the private 'artifacts' bucket (owner-scoped)
DROP POLICY IF EXISTS "artifacts owner select" ON storage.objects;
CREATE POLICY "artifacts owner select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'artifacts' AND owner = auth.uid());

DROP POLICY IF EXISTS "artifacts owner insert" ON storage.objects;
CREATE POLICY "artifacts owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artifacts' AND owner = auth.uid());

DROP POLICY IF EXISTS "artifacts owner update" ON storage.objects;
CREATE POLICY "artifacts owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'artifacts' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'artifacts' AND owner = auth.uid());

DROP POLICY IF EXISTS "artifacts owner delete" ON storage.objects;
CREATE POLICY "artifacts owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'artifacts' AND owner = auth.uid());

-- 3) Revoke EXECUTE on SECURITY DEFINER functions from anon/public
REVOKE EXECUTE ON FUNCTION public.grant_daily_free_credits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_plan() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_credit_balance(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
