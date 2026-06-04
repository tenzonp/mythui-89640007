
REVOKE EXECUTE ON FUNCTION public.grant_daily_free_credits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_daily_free_credits() TO service_role, postgres;
