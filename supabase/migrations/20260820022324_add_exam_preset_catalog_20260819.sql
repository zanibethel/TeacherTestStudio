create or replace function public.get_practice_exam_preset_catalog()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles where id=v_user and role='student') then raise exception 'Student account required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'slug',p.slug,'title',p.title,'description',p.description,'provider_label',p.provider_label,'mode_label',p.mode_label,
    'question_count',p.question_count,'duration_minutes',p.duration_minutes,'passing_score_percent',p.passing_score_percent,
    'readiness_target_percent',p.readiness_target_percent,'is_free_preview',p.is_free_preview,'position',p.position,
    'bundle_id',b.id,'bundle_slug',b.slug,'bundle_title',b.title,'subject',b.subject,'jurisdiction',b.jurisdiction,'verified',b.verified,
    'entitlement_status',e.status,'entitlement_expires_at',e.expires_at,
    'available',p.is_free_preview or (e.status in ('paid','comped') and (e.expires_at is null or e.expires_at>now()))
  ) order by b.sort_priority desc,b.title,p.position,p.title),'[]'::jsonb)
  into v_result
  from public.practice_bundle_exam_presets p
  join public.practice_bundles b on b.id=p.bundle_id
  left join public.practice_bundle_entitlements e on e.bundle_id=b.id and e.student_id=v_user
  where p.active=true and b.active=true and b.catalog_scope='platform' and b.publication_status='published';
  return v_result;
end $function$;

revoke execute on function public.get_practice_exam_preset_catalog() from public, anon;
grant execute on function public.get_practice_exam_preset_catalog() to authenticated, service_role;
