create table if not exists public.teacher_test_blueprints (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  chapter_filters jsonb not null default '[]'::jsonb,
  subject_weights jsonb not null default '{}'::jsonb,
  question_count integer not null default 20 check (question_count between 1 and 200),
  duration_minutes integer not null default 45 check (duration_minutes between 0 and 600),
  passing_score_percent integer not null default 70 check (passing_score_percent between 0 and 100),
  randomize_questions boolean not null default true,
  one_question_per_page boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_test_blueprints_chapter_filters_array check (jsonb_typeof(chapter_filters) = 'array'),
  constraint teacher_test_blueprints_subject_weights_object check (jsonb_typeof(subject_weights) = 'object')
);

create unique index if not exists teacher_test_blueprints_teacher_name_uidx
  on public.teacher_test_blueprints (teacher_id, lower(btrim(name)));
create index if not exists teacher_test_blueprints_teacher_updated_idx
  on public.teacher_test_blueprints (teacher_id, updated_at desc);

alter table public.teacher_test_blueprints enable row level security;

drop policy if exists teacher_test_blueprints_select_own on public.teacher_test_blueprints;
create policy teacher_test_blueprints_select_own
  on public.teacher_test_blueprints for select
  to authenticated
  using ((select auth.uid()) = teacher_id);

drop policy if exists teacher_test_blueprints_insert_own on public.teacher_test_blueprints;
create policy teacher_test_blueprints_insert_own
  on public.teacher_test_blueprints for insert
  to authenticated
  with check ((select auth.uid()) = teacher_id);

drop policy if exists teacher_test_blueprints_update_own on public.teacher_test_blueprints;
create policy teacher_test_blueprints_update_own
  on public.teacher_test_blueprints for update
  to authenticated
  using ((select auth.uid()) = teacher_id)
  with check ((select auth.uid()) = teacher_id);

drop policy if exists teacher_test_blueprints_delete_own on public.teacher_test_blueprints;
create policy teacher_test_blueprints_delete_own
  on public.teacher_test_blueprints for delete
  to authenticated
  using ((select auth.uid()) = teacher_id);

revoke all on table public.teacher_test_blueprints from anon;
grant select, insert, update, delete on table public.teacher_test_blueprints to authenticated;
grant all on table public.teacher_test_blueprints to service_role;
