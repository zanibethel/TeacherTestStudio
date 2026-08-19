create table public.shared_questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  normalized_prompt text not null unique,
  choices jsonb not null check (jsonb_typeof(choices)='array' and jsonb_array_length(choices)>=2),
  correct_index integer not null check (correct_index>=0 and correct_index<jsonb_array_length(choices)),
  content_area text,
  explanation text,
  contributor_teacher_id uuid references public.profiles(id) on delete set null,
  moderation_status text not null default 'approved' check (moderation_status in ('draft','pending','approved','rejected')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shared_collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  subject text not null default 'General',
  collection_type text not null default 'question_bank' check (collection_type in ('question_bank','practice_pack','study_pack')),
  owner_teacher_id uuid references public.profiles(id) on delete set null,
  visibility text not null default 'shared' check (visibility in ('shared','private','unlisted')),
  student_available boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shared_collection_questions (
  collection_id uuid not null references public.shared_collections(id) on delete cascade,
  question_id uuid not null references public.shared_questions(id) on delete cascade,
  position integer not null default 1,
  primary key(collection_id,question_id)
);

alter table public.question_bank add column if not exists shared_question_id uuid references public.shared_questions(id) on delete set null;
alter table public.question_bank add column if not exists imported_collection_id uuid references public.shared_collections(id) on delete set null;

create index shared_questions_area_idx on public.shared_questions(content_area,active,moderation_status);
create index shared_collection_questions_collection_idx on public.shared_collection_questions(collection_id,position);
create index question_bank_shared_origin_idx on public.question_bank(shared_question_id);

alter table public.shared_questions enable row level security;
alter table public.shared_collections enable row level security;
alter table public.shared_collection_questions enable row level security;
grant select on public.shared_questions, public.shared_collections, public.shared_collection_questions to authenticated;

create policy "approved teachers browse shared questions" on public.shared_questions for select to authenticated using (
  active and moderation_status='approved' and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='teacher' and p.teacher_approved=true)
);
create policy "authenticated browse active collection metadata" on public.shared_collections for select to authenticated using (
  active and (visibility='shared' or owner_teacher_id=(select auth.uid()))
);
create policy "approved teachers browse collection question links" on public.shared_collection_questions for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='teacher' and p.teacher_approved=true)
);

create or replace function public.import_shared_collection(p_collection_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_count integer:=0;
begin
  if v_user is null or not exists(select 1 from public.profiles where id=v_user and role='teacher' and teacher_approved=true) then raise exception 'Approved teacher account required'; end if;
  if not exists(select 1 from public.shared_collections where id=p_collection_id and active=true and (visibility='shared' or owner_teacher_id=v_user)) then raise exception 'Shared collection unavailable'; end if;
  insert into public.question_bank(teacher_id,prompt,normalized_prompt,choices,correct_index,content_area,explanation,source_type,shared_question_id,imported_collection_id)
  select v_user,q.prompt,q.normalized_prompt,q.choices,q.correct_index,q.content_area,q.explanation,'copied',q.id,p_collection_id
  from public.shared_collection_questions cq join public.shared_questions q on q.id=cq.question_id
  where cq.collection_id=p_collection_id and q.active=true and q.moderation_status='approved'
  on conflict (teacher_id,normalized_prompt) do nothing;
  get diagnostics v_count=row_count; return v_count;
end;$$;
grant execute on function public.import_shared_collection(uuid) to authenticated;

-- Seed data is intentionally performed operationally in Supabase so answer content is not committed to the public repository.
