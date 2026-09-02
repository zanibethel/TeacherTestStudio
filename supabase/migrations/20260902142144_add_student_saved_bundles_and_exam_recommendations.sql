create table if not exists public.student_saved_practice_bundles (
  student_id uuid not null references public.profiles(id) on delete cascade,
  bundle_id uuid not null references public.practice_bundles(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (student_id, bundle_id)
);

alter table public.student_saved_practice_bundles enable row level security;

revoke all on table public.student_saved_practice_bundles from public, anon, authenticated;
grant select, insert, delete on table public.student_saved_practice_bundles to authenticated;
grant all on table public.student_saved_practice_bundles to service_role;

drop policy if exists student_saved_bundles_own_read on public.student_saved_practice_bundles;
create policy student_saved_bundles_own_read
on public.student_saved_practice_bundles
for select to authenticated
using ((select auth.uid()) = student_id);

drop policy if exists student_saved_bundles_own_insert on public.student_saved_practice_bundles;
create policy student_saved_bundles_own_insert
on public.student_saved_practice_bundles
for insert to authenticated
with check (
  (select auth.uid()) = student_id
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'student'
  )
  and exists (
    select 1 from public.practice_bundles b
    where b.id = bundle_id
      and b.active = true
      and b.catalog_scope = 'platform'
      and b.publication_status = 'published'
  )
);

drop policy if exists student_saved_bundles_own_delete on public.student_saved_practice_bundles;
create policy student_saved_bundles_own_delete
on public.student_saved_practice_bundles
for delete to authenticated
using ((select auth.uid()) = student_id);

create or replace function public.get_exam_session_recommendations(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_session public.practice_sessions%rowtype;
  v_main_preset_id uuid;
  v_areas jsonb := '[]'::jsonb;
  v_presets jsonb := '[]'::jsonb;
  v_main_exam jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select * into v_session
  from public.practice_sessions
  where id = p_session_id
    and student_id = v_user
    and status = 'submitted'
    and session_kind = 'exam_preset'
    and source_bundle_id is not null;

  if not found then raise exception 'Submitted exam session not found'; end if;

  select p.id into v_main_preset_id
  from public.practice_bundle_exam_presets p
  where p.bundle_id = v_session.source_bundle_id and p.active = true
  order by p.question_count desc, p.position, p.title
  limit 1;

  with area_results as (
    select
      coalesce(nullif(sq.exam_domain, ''), nullif(sq.content_area, ''), 'General') as area,
      count(*)::integer as total,
      count(*) filter (where r.is_correct)::integer as correct,
      round(100.0 * count(*) filter (where r.is_correct) / nullif(count(*), 0), 1) as mastery
    from public.practice_session_responses r
    join public.shared_questions sq on sq.id = r.question_id
    where r.session_id = p_session_id
    group by 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('area', area, 'correct', correct, 'total', total, 'mastery', mastery)
      order by mastery, total desc, area
    ),
    '[]'::jsonb
  ) into v_areas
  from area_results;

  with area_results as (
    select
      coalesce(nullif(sq.exam_domain, ''), nullif(sq.content_area, ''), 'General') as area,
      count(*)::integer as total,
      count(*) filter (where r.is_correct)::integer as correct,
      round(100.0 * count(*) filter (where r.is_correct) / nullif(count(*), 0), 1) as mastery
    from public.practice_session_responses r
    join public.shared_questions sq on sq.id = r.question_id
    where r.session_id = p_session_id
    group by 1
  ), ranked as (
    select
      p.id,
      p.title,
      p.description,
      p.question_count,
      p.duration_minutes,
      p.passing_score_percent,
      p.mode_label,
      round(sum(ar.mastery * w.weight_percent) / nullif(sum(w.weight_percent), 0), 1) as matched_mastery,
      round(sum((100 - ar.mastery) * w.weight_percent) / nullif(sum(w.weight_percent), 0), 1) as priority_score,
      array_agg(ar.area order by ar.mastery, ar.area) as matched_areas,
      (
        p.is_free_preview
        or exists (
          select 1 from public.practice_bundle_entitlements e
          where e.bundle_id = p.bundle_id
            and e.student_id = v_user
            and e.status in ('paid', 'comped')
            and (e.expires_at is null or e.expires_at > now())
        )
      ) as available
    from public.practice_bundle_exam_presets p
    join public.practice_bundle_exam_preset_weights w on w.preset_id = p.id
    join area_results ar on ar.area = w.exam_domain
    where p.bundle_id = v_session.source_bundle_id
      and p.active = true
      and p.id <> v_main_preset_id
    group by p.id
  )
  select coalesce(
    jsonb_agg(to_jsonb(recommended) order by recommended.priority_score desc, recommended.question_count desc),
    '[]'::jsonb
  ) into v_presets
  from (
    select * from ranked
    where priority_score > 0
    order by priority_score desc, question_count desc, title
    limit 3
  ) recommended;

  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'question_count', p.question_count,
    'duration_minutes', p.duration_minutes,
    'passing_score_percent', p.passing_score_percent,
    'available', (
      p.is_free_preview
      or exists (
        select 1 from public.practice_bundle_entitlements e
        where e.bundle_id = p.bundle_id
          and e.student_id = v_user
          and e.status in ('paid', 'comped')
          and (e.expires_at is null or e.expires_at > now())
      )
    )
  ) into v_main_exam
  from public.practice_bundle_exam_presets p
  where p.id = v_main_preset_id;

  return jsonb_build_object(
    'bundle_id', v_session.source_bundle_id,
    'is_main_exam', v_session.source_exam_preset_id = v_main_preset_id,
    'areas', v_areas,
    'recommended_presets', v_presets,
    'main_exam', v_main_exam
  );
end
$function$;

revoke execute on function public.get_exam_session_recommendations(uuid) from public, anon;
grant execute on function public.get_exam_session_recommendations(uuid) to authenticated, service_role;
