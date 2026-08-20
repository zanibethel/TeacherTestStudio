-- Further launch hardening: remove direct authenticated access to internal
-- tables that are intentionally reachable only through vetted SECURITY DEFINER
-- RPCs, and prevent direct invocation of a trigger-only enforcement function.

revoke all privileges on table public.platform_admins from authenticated;
revoke all privileges on table public.practice_bundle_domain_weights from authenticated;
revoke all privileges on table public.practice_bundle_reviews from authenticated;

revoke execute on function public.enforce_teacher_share_monetization() from authenticated, public;
grant execute on function public.enforce_teacher_share_monetization() to service_role;
