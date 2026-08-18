create extension if not exists pg_trgm with schema extensions;

create or replace function public.normalize_question_text(p_text text)
returns text language sql immutable set search_path = '' as $$
  select trim(regexp_replace(lower(coalesce(p_text,'')), '[^a-z0-9]+', ' ', 'g'));
$$;

create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  prompt text not null,
  normalized_prompt text not null,
  choices jsonb not null check (jsonb_typeof(choices)='array' and jsonb_array_length(choices)>=2),
  correct_index integer not null check (correct_index>=0),
  content_area text,
  explanation text,
  source_type text not null default 'teacher' check (source_type in ('teacher','import','generated','copied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(teacher_id, normalized_prompt)
);
create index if not exists question_bank_teacher_idx on public.question_bank(teacher_id);
create index if not exists question_bank_content_area_idx on public.question_bank(teacher_id, content_area);
create index if not exists question_bank_normalized_trgm_idx on public.question_bank using gin(normalized_prompt extensions.gin_trgm_ops);
alter table public.question_bank enable row level security;
create policy "teachers manage own question bank" on public.question_bank for all to authenticated
using (teacher_id=auth.uid())
with check (teacher_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher'));

create or replace function public.find_question_bank_duplicates(p_prompt text,p_limit integer default 5)
returns table(id uuid,prompt text,content_area text,similarity_score real)
language sql security invoker set search_path = '' as $$
 select qb.id,qb.prompt,qb.content_area,extensions.similarity(qb.normalized_prompt,public.normalize_question_text(p_prompt))::real
 from public.question_bank qb
 where qb.teacher_id=auth.uid() and extensions.similarity(qb.normalized_prompt,public.normalize_question_text(p_prompt))>=0.58
 order by 4 desc limit greatest(1,least(coalesce(p_limit,5),20));
$$;
grant execute on function public.find_question_bank_duplicates(text,integer) to authenticated;

-- create_test_with_questions_v3 in production also upserts each saved question into question_bank.
