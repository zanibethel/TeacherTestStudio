-- Launch hardening: remove unnecessary anonymous Data API reachability while
-- preserving intentionally public RPCs for catalog/pricing, teacher lookup,
-- and invite validation.

revoke all privileges on table public.attempt_integrity_events from anon;
revoke all privileges on table public.platform_admins from anon;
revoke all privileges on table public.practice_bundle_access_options from anon;
revoke all privileges on table public.practice_bundle_collections from anon;
revoke all privileges on table public.practice_bundle_domain_weights from anon;
revoke all privileges on table public.practice_bundle_entitlements from anon;
revoke all privileges on table public.practice_bundle_reviews from anon;
revoke all privileges on table public.practice_bundles from anon;
revoke all privileges on table public.question_bank from anon;
revoke all privileges on table public.shared_collection_questions from anon;
revoke all privileges on table public.shared_collections from anon;
revoke all privileges on table public.shared_questions from anon;
revoke all privileges on table public.teacher_invites from anon;
revoke all privileges on table public.teacher_share_experience_presets from anon;
revoke all privileges on table public.teacher_student_roster from anon;
revoke all privileges on table public.test_share_group_targets from anon;
revoke all privileges on table public.test_share_roster_targets from anon;

-- These functions all require an authenticated teacher/student internally and
-- should not be exposed to anonymous callers.
revoke execute on function public.create_test_with_questions_v4(text,text,boolean,integer,boolean,integer,text,text,text,jsonb,integer) from anon, public;
revoke execute on function public.create_test_with_questions_v4(text,text,boolean,integer,boolean,integer,text,text,text,jsonb,integer,boolean) from anon, public;
revoke execute on function public.create_test_with_questions_v5(text,text,boolean,integer,boolean,integer,text,text,text,jsonb,integer,boolean,integer,integer,boolean,boolean) from anon, public;
revoke execute on function public.create_test_with_questions_v5(text,text,boolean,integer,boolean,integer,text,text,text,jsonb,integer,boolean,integer,integer,boolean,boolean,integer,timestamptz) from anon, public;
revoke execute on function public.create_test_with_questions_v6(text,text,boolean,integer,boolean,integer,text,text,text,jsonb,integer,boolean,integer,integer,boolean,boolean,integer) from anon, public;
revoke execute on function public.create_test_with_questions_v6(text,text,boolean,integer,boolean,integer,text,text,text,jsonb,integer,boolean,integer,integer,boolean,boolean,integer,timestamptz) from anon, public;
revoke execute on function public.find_question_bank_duplicates(text,integer) from anon, public;
revoke execute on function public.get_practice_bundle_detail(uuid) from anon, public;
revoke execute on function public.get_practice_bundle_reviews(uuid) from anon, public;
revoke execute on function public.get_shared_collection_preview(uuid,integer) from anon, public;
revoke execute on function public.normalize_question_text(text) from anon, public;

-- Make anonymous access to future public-schema objects opt-in.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public;
