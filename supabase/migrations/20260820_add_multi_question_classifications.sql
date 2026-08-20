create table if not exists public.question_bank_chapters (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  chapter_number integer null check (chapter_number is null or chapter_number > 0),
  chapter_title text null,
  created_at timestamptz not null default now(),
  check (chapter_number is not null or nullif(btrim(chapter_title),'') is not null)
);
create unique index if not exists question_bank_chapters_unique_idx on public.question_bank_chapters(question_id, coalesce(chapter_number,0), lower(coalesce(btrim(chapter_title),'')));
create index if not exists question_bank_chapters_teacher_idx on public.question_bank_chapters(teacher_id, chapter_number);

create table if not exists public.question_bank_subjects (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject_category text not null check (nullif(btrim(subject_category),'') is not null),
  created_at timestamptz not null default now()
);
create unique index if not exists question_bank_subjects_unique_idx on public.question_bank_subjects(question_id, lower(btrim(subject_category)));
create index if not exists question_bank_subjects_teacher_idx on public.question_bank_subjects(teacher_id, lower(btrim(subject_category)));

alter table public.question_bank_chapters enable row level security;
alter table public.question_bank_subjects enable row level security;

drop policy if exists question_bank_chapters_owner_select on public.question_bank_chapters;
create policy question_bank_chapters_owner_select on public.question_bank_chapters for select to authenticated using ((select auth.uid()) = teacher_id);
drop policy if exists question_bank_chapters_owner_insert on public.question_bank_chapters;
create policy question_bank_chapters_owner_insert on public.question_bank_chapters for insert to authenticated with check ((select auth.uid()) = teacher_id and exists (select 1 from public.question_bank q where q.id=question_id and q.teacher_id=(select auth.uid())));
drop policy if exists question_bank_chapters_owner_update on public.question_bank_chapters;
create policy question_bank_chapters_owner_update on public.question_bank_chapters for update to authenticated using ((select auth.uid()) = teacher_id) with check ((select auth.uid()) = teacher_id and exists (select 1 from public.question_bank q where q.id=question_id and q.teacher_id=(select auth.uid())));
drop policy if exists question_bank_chapters_owner_delete on public.question_bank_chapters;
create policy question_bank_chapters_owner_delete on public.question_bank_chapters for delete to authenticated using ((select auth.uid()) = teacher_id);

drop policy if exists question_bank_subjects_owner_select on public.question_bank_subjects;
create policy question_bank_subjects_owner_select on public.question_bank_subjects for select to authenticated using ((select auth.uid()) = teacher_id);
drop policy if exists question_bank_subjects_owner_insert on public.question_bank_subjects;
create policy question_bank_subjects_owner_insert on public.question_bank_subjects for insert to authenticated with check ((select auth.uid()) = teacher_id and exists (select 1 from public.question_bank q where q.id=question_id and q.teacher_id=(select auth.uid())));
drop policy if exists question_bank_subjects_owner_update on public.question_bank_subjects;
create policy question_bank_subjects_owner_update on public.question_bank_subjects for update to authenticated using ((select auth.uid()) = teacher_id) with check ((select auth.uid()) = teacher_id and exists (select 1 from public.question_bank q where q.id=question_id and q.teacher_id=(select auth.uid())));
drop policy if exists question_bank_subjects_owner_delete on public.question_bank_subjects;
create policy question_bank_subjects_owner_delete on public.question_bank_subjects for delete to authenticated using ((select auth.uid()) = teacher_id);

revoke all on public.question_bank_chapters from anon;
revoke all on public.question_bank_subjects from anon;
grant select,insert,update,delete on public.question_bank_chapters to authenticated;
grant select,insert,update,delete on public.question_bank_subjects to authenticated;
grant all on public.question_bank_chapters to service_role;
grant all on public.question_bank_subjects to service_role;

insert into public.question_bank_chapters(question_id,teacher_id,chapter_number,chapter_title)
select id,teacher_id,chapter_number,nullif(btrim(chapter_title),'') from public.question_bank
where chapter_number is not null or nullif(btrim(chapter_title),'') is not null
on conflict do nothing;
insert into public.question_bank_subjects(question_id,teacher_id,subject_category)
select id,teacher_id,btrim(coalesce(subject_category,content_area)) from public.question_bank
where nullif(btrim(coalesce(subject_category,content_area)),'') is not null
on conflict do nothing;