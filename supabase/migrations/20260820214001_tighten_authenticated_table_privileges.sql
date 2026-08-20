-- Least-privilege hardening for authenticated Data API access.
-- RPC-only sensitive tables: no direct authenticated table access.
revoke all privileges on table public.attempt_questions from authenticated;
revoke all privileges on table public.attempt_integrity_events from authenticated;
revoke all privileges on table public.test_focus_practice_questions from authenticated;
revoke all privileges on table public.test_focus_practice_responses from authenticated;

-- Read-only direct tables: preserve SELECT used by authenticated app pages,
-- remove mutation/DDL-style privileges that have no matching app flow/policy.
revoke insert, update, delete, truncate, references, trigger on table public.attempts from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.responses from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.practice_sessions from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.profiles from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.share_entitlements from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.student_teacher_connection_requests from authenticated;

-- Teacher-managed classroom tables still require normal CRUD. Remove only
-- privileges not used by application data operations.
revoke truncate, references, trigger on table public.teacher_groups from authenticated;
revoke truncate, references, trigger on table public.teacher_group_members from authenticated;
revoke truncate, references, trigger on table public.test_assignments from authenticated;
revoke truncate, references, trigger on table public.test_shares from authenticated;
