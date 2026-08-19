create table if not exists public.starter_question_bank (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  normalized_prompt text not null unique,
  choices jsonb not null check (jsonb_typeof(choices)='array' and jsonb_array_length(choices)>=2),
  correct_index integer not null check (correct_index>=0 and correct_index<jsonb_array_length(choices)),
  content_area text not null,
  explanation text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists starter_question_bank_area_idx
  on public.starter_question_bank(content_area)
  where active;

alter table public.starter_question_bank enable row level security;

drop policy if exists "approved teachers read starter bank" on public.starter_question_bank;
create policy "approved teachers read starter bank"
  on public.starter_question_bank
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'teacher'::public.user_role
        and coalesce(p.teacher_approved, false) = true
    )
  );

revoke all on public.starter_question_bank from anon;
grant select on public.starter_question_bank to authenticated;

-- Starter question content is intentionally NOT committed in migrations or source.
-- Production seed data is stored privately in Supabase so answer keys are not exposed in Git history.
