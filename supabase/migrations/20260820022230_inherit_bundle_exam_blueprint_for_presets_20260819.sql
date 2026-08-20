create or replace function public.admin_upsert_bundle_exam_preset(
  p_bundle_id uuid,p_preset_id uuid,p_slug text,p_title text,p_description text,p_provider_label text,p_mode_label text,
  p_question_count integer,p_duration_minutes integer,p_passing_score_percent integer,p_readiness_target_percent integer,
  p_is_free_preview boolean,p_position integer,p_active boolean
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare v_id uuid; v_created boolean:=false;
begin
  if not public.is_platform_admin() then raise exception 'Platform admin required'; end if;
  if not exists(select 1 from public.practice_bundles where id=p_bundle_id and catalog_scope='platform') then raise exception 'Bundle not found'; end if;
  if nullif(btrim(p_slug),'') is null or nullif(btrim(p_title),'') is null then raise exception 'Preset slug and title are required'; end if;
  if p_question_count not between 5 and 200 then raise exception 'Question count must be 5 to 200'; end if;
  if p_duration_minutes not between 0 and 600 then raise exception 'Duration must be 0 to 600 minutes'; end if;
  if p_passing_score_percent not between 0 and 100 or p_readiness_target_percent not between 0 and 100 then raise exception 'Score targets must be 0 to 100'; end if;
  if p_preset_id is null then
    insert into public.practice_bundle_exam_presets(bundle_id,slug,title,description,provider_label,mode_label,question_count,duration_minutes,passing_score_percent,readiness_target_percent,is_free_preview,position,active)
    values(p_bundle_id,lower(btrim(p_slug)),btrim(p_title),nullif(btrim(coalesce(p_description,'')),''),nullif(btrim(coalesce(p_provider_label,'')),''),coalesce(nullif(btrim(coalesce(p_mode_label,'')),''),'Exam simulation'),p_question_count,p_duration_minutes,p_passing_score_percent,p_readiness_target_percent,coalesce(p_is_free_preview,false),coalesce(p_position,0),coalesce(p_active,true))
    returning id into v_id;
    v_created:=true;
  else
    update public.practice_bundle_exam_presets
    set slug=lower(btrim(p_slug)),title=btrim(p_title),description=nullif(btrim(coalesce(p_description,'')),''),provider_label=nullif(btrim(coalesce(p_provider_label,'')),''),mode_label=coalesce(nullif(btrim(coalesce(p_mode_label,'')),''),'Exam simulation'),question_count=p_question_count,duration_minutes=p_duration_minutes,passing_score_percent=p_passing_score_percent,readiness_target_percent=p_readiness_target_percent,is_free_preview=coalesce(p_is_free_preview,false),position=coalesce(p_position,0),active=coalesce(p_active,true),updated_at=now()
    where id=p_preset_id and bundle_id=p_bundle_id returning id into v_id;
    if v_id is null then raise exception 'Exam preset not found'; end if;
  end if;
  if v_created then
    insert into public.practice_bundle_exam_preset_weights(preset_id,exam_domain,weight_percent)
    select v_id,w.exam_domain,w.weight_percent
    from public.practice_bundle_domain_weights w
    where w.bundle_id=p_bundle_id
    on conflict(preset_id,exam_domain) do nothing;
  end if;
  return v_id;
end $function$;

revoke execute on function public.admin_upsert_bundle_exam_preset(uuid,uuid,text,text,text,text,text,integer,integer,integer,integer,boolean,integer,boolean) from public, anon;
grant execute on function public.admin_upsert_bundle_exam_preset(uuid,uuid,text,text,text,text,text,integer,integer,integer,integer,boolean,integer,boolean) to authenticated, service_role;
