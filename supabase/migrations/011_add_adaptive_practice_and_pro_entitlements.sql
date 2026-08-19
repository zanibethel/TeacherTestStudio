-- Adaptive student mini-tests, platform catalog scoping, and teacher Pro entitlements.
alter table public.profiles add column if not exists teacher_plan text not null default 'free' check (teacher_plan in ('free','pro'));
alter table public.profiles add column if not exists teacher_plan_expires_at timestamptz;
alter table public.shared_collections add column if not exists catalog_scope text not null default 'platform' check (catalog_scope in ('platform','teacher'));
alter table public.shared_collections add column if not exists access_type text not null default 'free' check (access_type in ('free','paid','pass_only'));
alter table public.shared_collections add column if not exists price_cents integer check (price_cents is null or price_cents >= 0);

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  source_attempt_id uuid references public.attempts(id) on delete set null, source_share_id uuid references public.test_shares(id) on delete set null,
  title text not null default 'Focused practice', selected_areas text[] not null, question_count integer not null check (question_count between 5 and 30),
  status text not null default 'active' check (status in ('active','submitted')), score_percent numeric not null default 0,
  correct_count integer not null default 0, submitted_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.practice_session_questions (
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  question_id uuid not null references public.shared_questions(id) on delete restrict,
  question_position integer not null, primary key(session_id,question_id), unique(session_id,question_position)
);
create table if not exists public.practice_session_responses (
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  question_id uuid not null references public.shared_questions(id) on delete restrict,
  selected_index integer, is_correct boolean not null default false, primary key(session_id,question_id)
);

-- Live project also defines SECURITY DEFINER RPCs:
-- create_focus_practice_session(attempt, selected areas, size)
-- get_practice_session(session) (never returns correct_index)
-- submit_practice_session(session, answers) (grades server-side)
-- Normal clients cannot read practice-session question/response tables directly.
