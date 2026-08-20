-- Smart builder: explicit source buckets, teacher subject-mix presets,
-- and bundle-owned domain-to-subject mappings.

alter table public.teacher_test_blueprints
  add column if not exists source_filters jsonb not null default '[]'::jsonb,
  add column if not exists source_weights jsonb not null default '{}'::jsonb;

create table if not exists public.teacher_subject_mix_presets (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject_weights jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_subject_mix_presets_name_check check (length(btrim(name)) between 1 and 80),
  constraint teacher_subject_mix_presets_unique_name unique (teacher_id, name)
);

alter table public.teacher_subject_mix_presets enable row level security;

drop policy if exists teacher_mix_presets_select_own on public.teacher_subject_mix_presets;
create policy teacher_mix_presets_select_own on public.teacher_subject_mix_presets
for select to authenticated using ((select auth.uid()) = teacher_id);

drop policy if exists teacher_mix_presets_insert_own on public.teacher_subject_mix_presets;
create policy teacher_mix_presets_insert_own on public.teacher_subject_mix_presets
for insert to authenticated with check ((select auth.uid()) = teacher_id);

drop policy if exists teacher_mix_presets_update_own on public.teacher_subject_mix_presets;
create policy teacher_mix_presets_update_own on public.teacher_subject_mix_presets
for update to authenticated using ((select auth.uid()) = teacher_id)
with check ((select auth.uid()) = teacher_id);

drop policy if exists teacher_mix_presets_delete_own on public.teacher_subject_mix_presets;
create policy teacher_mix_presets_delete_own on public.teacher_subject_mix_presets
for delete to authenticated using ((select auth.uid()) = teacher_id);

revoke all on table public.teacher_subject_mix_presets from anon, authenticated;
grant select, insert, update, delete on table public.teacher_subject_mix_presets to authenticated;
revoke truncate, references, trigger, maintain on table public.teacher_subject_mix_presets from authenticated;
grant all on table public.teacher_subject_mix_presets to service_role;

create table if not exists public.practice_bundle_subject_mappings (
  bundle_id uuid not null references public.practice_bundles(id) on delete cascade,
  subject_category text not null,
  exam_domain text not null,
  primary key (bundle_id, subject_category)
);

alter table public.practice_bundle_subject_mappings enable row level security;
revoke all on table public.practice_bundle_subject_mappings from anon, authenticated;
grant all on table public.practice_bundle_subject_mappings to service_role;

insert into public.practice_bundle_subject_mappings(bundle_id,subject_category,exam_domain) values
('a260582b-6969-4df5-8223-6b4553925331','Chemical Texture Services','Hair & Scalp Care'),
('a260582b-6969-4df5-8223-6b4553925331','Hair & Scalp Care','Hair & Scalp Care'),
('a260582b-6969-4df5-8223-6b4553925331','Hair Weaving','Hair & Scalp Care'),
('a260582b-6969-4df5-8223-6b4553925331','Haircoloring & Lightening','Hair & Scalp Care'),
('a260582b-6969-4df5-8223-6b4553925331','Haircutting & Styling','Hair & Scalp Care'),
('a260582b-6969-4df5-8223-6b4553925331','Safety, Sanitation & Infection Control','Infection Control'),
('a260582b-6969-4df5-8223-6b4553925331','Licensing & Texas Rules','Licensing & Regulation'),
('a260582b-6969-4df5-8223-6b4553925331','Nail Care','Nail Care & Services'),
('a260582b-6969-4df5-8223-6b4553925331','Skin Care','Skin Care & Services')
on conflict (bundle_id,subject_category) do update set exam_domain=excluded.exam_domain;

create or replace function public.get_teacher_builder_bundle_presets()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then return '[]'::jsonb; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=v_uid and p.role='teacher' and coalesce(p.teacher_approved,false)
  ) then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(row_data.obj order by row_data.bundle_title,row_data.position,row_data.preset_title),'[]'::jsonb)
  into v_result
  from (
    select b.title bundle_title,ep.position,ep.title preset_title,
      jsonb_build_object(
        'preset_id',ep.id,
        'preset_title',ep.title,
        'bundle_id',b.id,
        'bundle_title',b.title,
        'question_count',ep.question_count,
        'collection_ids',(
          select coalesce(jsonb_agg(bc.collection_id::text order by bc.position),'[]'::jsonb)
          from public.practice_bundle_collections bc where bc.bundle_id=b.id
        ),
        'weights',coalesce(
          (select jsonb_object_agg(pw.exam_domain,pw.weight_percent order by pw.exam_domain)
           from public.practice_bundle_exam_preset_weights pw where pw.preset_id=ep.id),
          (select jsonb_object_agg(dw.exam_domain,dw.weight_percent order by dw.exam_domain)
           from public.practice_bundle_domain_weights dw where dw.bundle_id=b.id),
          '{}'::jsonb
        ),
        'subject_mappings',coalesce(
          (select jsonb_object_agg(sm.subject_category,sm.exam_domain order by sm.subject_category)
           from public.practice_bundle_subject_mappings sm where sm.bundle_id=b.id),
          '{}'::jsonb
        )
      ) obj
    from public.practice_bundle_exam_presets ep
    join public.practice_bundles b on b.id=ep.bundle_id
    where ep.active and b.active
      and exists(
        select 1
        from public.practice_bundle_collections bc
        join public.question_bank qb on qb.imported_collection_id=bc.collection_id
        where bc.bundle_id=b.id and qb.teacher_id=v_uid
      )
  ) row_data;
  return v_result;
end;
$$;

revoke all on function public.get_teacher_builder_bundle_presets() from public, anon;
grant execute on function public.get_teacher_builder_bundle_presets() to authenticated, service_role;
