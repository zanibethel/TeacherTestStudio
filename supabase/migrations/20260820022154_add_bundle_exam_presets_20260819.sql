create table if not exists public.practice_bundle_exam_presets (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.practice_bundles(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  provider_label text,
  mode_label text not null default 'Exam simulation',
  question_count integer not null check (question_count between 5 and 200),
  duration_minutes integer not null default 0 check (duration_minutes between 0 and 600),
  passing_score_percent integer not null default 70 check (passing_score_percent between 0 and 100),
  readiness_target_percent integer not null default 70 check (readiness_target_percent between 0 and 100),
  is_free_preview boolean not null default false,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(bundle_id,slug)
);

create table if not exists public.practice_bundle_exam_preset_weights (
  preset_id uuid not null references public.practice_bundle_exam_presets(id) on delete cascade,
  exam_domain text not null,
  weight_percent numeric(5,2) not null check (weight_percent > 0 and weight_percent <= 100),
  primary key(preset_id,exam_domain)
);

alter table public.practice_bundle_exam_presets enable row level security;
alter table public.practice_bundle_exam_preset_weights enable row level security;
revoke all privileges on table public.practice_bundle_exam_presets from anon, authenticated;
revoke all privileges on table public.practice_bundle_exam_preset_weights from anon, authenticated;
grant all privileges on table public.practice_bundle_exam_presets to service_role;
grant all privileges on table public.practice_bundle_exam_preset_weights to service_role;

alter table public.practice_sessions
  add column if not exists source_exam_preset_id uuid references public.practice_bundle_exam_presets(id) on delete set null,
  add column if not exists session_kind text not null default 'practice',
  add column if not exists duration_minutes integer,
  add column if not exists passing_score_percent integer,
  add column if not exists deadline_at timestamptz;

create index if not exists practice_bundle_exam_presets_bundle_idx on public.practice_bundle_exam_presets(bundle_id,active,position);
create index if not exists practice_sessions_exam_preset_idx on public.practice_sessions(source_exam_preset_id) where source_exam_preset_id is not null;

insert into public.practice_bundle_exam_presets(bundle_id,slug,title,description,provider_label,mode_label,question_count,duration_minutes,passing_score_percent,readiness_target_percent,is_free_preview,active,position)
select b.id,'psi-practice-exam','PSI Practice Exam','Full-length CramLoop licensing-exam simulation built from this bundle''s verified question bank and exam-domain blueprint. This is original practice content and is not an official PSI exam.','PSI','Licensing exam simulation',100,120,70,70,false,true,10
from public.practice_bundles b where b.slug='texas-cosmetology-operator'
on conflict(bundle_id,slug) do update set title=excluded.title,description=excluded.description,provider_label=excluded.provider_label,mode_label=excluded.mode_label,question_count=excluded.question_count,duration_minutes=excluded.duration_minutes,passing_score_percent=excluded.passing_score_percent,readiness_target_percent=excluded.readiness_target_percent,is_free_preview=excluded.is_free_preview,active=excluded.active,position=excluded.position,updated_at=now();

insert into public.practice_bundle_exam_preset_weights(preset_id,exam_domain,weight_percent)
select p.id,w.exam_domain,w.weight_percent
from public.practice_bundle_exam_presets p
join public.practice_bundles b on b.id=p.bundle_id
join public.practice_bundle_domain_weights w on w.bundle_id=b.id
where b.slug='texas-cosmetology-operator' and p.slug='psi-practice-exam'
on conflict(preset_id,exam_domain) do update set weight_percent=excluded.weight_percent;

create or replace function public.get_practice_bundle_detail(p_bundle_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_user uuid:=auth.uid(); v_bundle public.practice_bundles%rowtype; v_ent public.practice_bundle_entitlements%rowtype; v_resources jsonb; v_options jsonb; v_presets jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_bundle from public.practice_bundles where id=p_bundle_id and active=true and catalog_scope='platform' and publication_status='published';
  if not found then raise exception 'Practice bundle unavailable'; end if;
  select * into v_ent from public.practice_bundle_entitlements where bundle_id=p_bundle_id and student_id=v_user;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'description',c.description,'subject',c.subject,'collection_type',c.collection_type,'is_free_preview',bc.is_free_preview,'position',bc.position) order by bc.position),'[]'::jsonb) into v_resources from public.practice_bundle_collections bc join public.shared_collections c on c.id=bc.collection_id where bc.bundle_id=p_bundle_id and c.active=true;
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,'duration_hours',o.duration_hours,'base_price_cents',(price_info->>'base_price_cents')::int,'price_cents',(price_info->>'effective_price_cents')::int,'pricing_rule_id',price_info->>'pricing_rule_id','pricing_label',price_info->>'pricing_label','badge',o.badge,'position',o.position) order by o.position),'[]'::jsonb) into v_options from public.practice_bundle_access_options o cross join lateral public.get_effective_bundle_option_price(p_bundle_id,o.id,v_user) price_info where o.bundle_id=p_bundle_id and o.active=true;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'title',p.title,'description',p.description,'provider_label',p.provider_label,'mode_label',p.mode_label,'question_count',p.question_count,'duration_minutes',p.duration_minutes,'passing_score_percent',p.passing_score_percent,'readiness_target_percent',p.readiness_target_percent,'is_free_preview',p.is_free_preview,'position',p.position,'domain_weights',coalesce((select jsonb_agg(jsonb_build_object('exam_domain',w.exam_domain,'weight_percent',w.weight_percent) order by w.weight_percent desc,w.exam_domain) from public.practice_bundle_exam_preset_weights w where w.preset_id=p.id),'[]'::jsonb)) order by p.position,p.title),'[]'::jsonb) into v_presets from public.practice_bundle_exam_presets p where p.bundle_id=p_bundle_id and p.active=true;
  return jsonb_build_object('id',v_bundle.id,'slug',v_bundle.slug,'title',v_bundle.title,'description',v_bundle.description,'subject',v_bundle.subject,'category',v_bundle.category,'subcategory',v_bundle.subcategory,'jurisdiction',v_bundle.jurisdiction,'language',v_bundle.language,'verified',v_bundle.verified,'content_version',v_bundle.content_version,'current_as_of',v_bundle.current_as_of,'alignment_note',v_bundle.alignment_note,'reviewed_at',v_bundle.reviewed_at,'pass_duration_days',v_bundle.pass_duration_days,'price_cents',v_bundle.price_cents,'free_preview_enabled',v_bundle.free_preview_enabled,'entitlement_status',v_ent.status,'entitlement_expires_at',v_ent.expires_at,'entitlement_access_option_id',v_ent.access_option_id,'entitlement_quoted_price_cents',v_ent.quoted_price_cents,'access_options',v_options,'resources',v_resources,'exam_presets',v_presets);
end $function$;

create or replace function public.create_bundle_exam_preset_session(p_bundle_id uuid,p_preset_id uuid)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare v_user uuid:=auth.uid(); v_bundle public.practice_bundles%rowtype; v_preset public.practice_bundle_exam_presets%rowtype; v_ent public.practice_bundle_entitlements%rowtype; v_session uuid; v_count int; v_missing int; v_areas text[]; v_has_weights boolean;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles where id=v_user and role='student') then raise exception 'Student account required'; end if;
  select * into v_bundle from public.practice_bundles where id=p_bundle_id and active=true and catalog_scope='platform' and publication_status='published'; if not found then raise exception 'Practice bundle unavailable'; end if;
  select * into v_preset from public.practice_bundle_exam_presets where id=p_preset_id and bundle_id=p_bundle_id and active=true; if not found then raise exception 'Exam preset unavailable'; end if;
  select * into v_ent from public.practice_bundle_entitlements where bundle_id=p_bundle_id and student_id=v_user;
  if not v_preset.is_free_preview and (v_ent.id is null or v_ent.status not in ('paid','comped') or (v_ent.expires_at is not null and v_ent.expires_at<=now())) then raise exception 'An active pass is required for this exam preset'; end if;
  with eligible as (select distinct sq.id,sq.content_area from public.practice_bundle_collections bc join public.shared_collection_questions scq on scq.collection_id=bc.collection_id join public.shared_questions sq on sq.id=scq.question_id where bc.bundle_id=p_bundle_id and sq.active=true and sq.moderation_status='approved') select array_agg(distinct content_area) filter(where content_area is not null) into v_areas from eligible;
  insert into public.practice_sessions(student_id,title,selected_areas,question_count,source_bundle_id,source_exam_preset_id,session_kind,duration_minutes,passing_score_percent,deadline_at) values(v_user,v_preset.title,coalesce(v_areas,array[]::text[]),v_preset.question_count,p_bundle_id,v_preset.id,'exam_preset',v_preset.duration_minutes,v_preset.passing_score_percent,case when v_preset.duration_minutes>0 then now()+make_interval(mins=>v_preset.duration_minutes) else null end) returning id into v_session;
  select exists(select 1 from public.practice_bundle_exam_preset_weights where preset_id=v_preset.id) into v_has_weights;
  if v_has_weights then
    with weights as (select w.exam_domain,w.weight_percent,floor((v_preset.question_count*w.weight_percent)/100.0)::int base_count,((v_preset.question_count*w.weight_percent)/100.0)-floor((v_preset.question_count*w.weight_percent)/100.0) frac from public.practice_bundle_exam_preset_weights w where w.preset_id=v_preset.id), ranked_weights as (select *,row_number() over(order by frac desc,weight_percent desc,exam_domain) extra_rank,v_preset.question_count-sum(base_count) over() extras from weights), desired as (select exam_domain,base_count+case when extra_rank<=extras then 1 else 0 end desired_count from ranked_weights), eligible as (select distinct sq.id,sq.exam_domain from public.practice_bundle_collections bc join public.shared_collection_questions scq on scq.collection_id=bc.collection_id join public.shared_questions sq on sq.id=scq.question_id where bc.bundle_id=p_bundle_id and sq.active=true and sq.moderation_status='approved'), candidates as (select e.id,e.exam_domain,row_number() over(partition by e.exam_domain order by random()) rn from eligible e where e.exam_domain is not null), picked as (select c.id from candidates c join desired d on d.exam_domain=c.exam_domain and c.rn<=d.desired_count) insert into public.practice_session_questions(session_id,question_id,question_position) select v_session,id,row_number() over(order by random()) from picked;
  else
    insert into public.practice_session_questions(session_id,question_id,question_position) select v_session,id,row_number() over(order by random()) from (select distinct sq.id from public.practice_bundle_collections bc join public.shared_collection_questions scq on scq.collection_id=bc.collection_id join public.shared_questions sq on sq.id=scq.question_id where bc.bundle_id=p_bundle_id and sq.active=true and sq.moderation_status='approved') q order by random() limit v_preset.question_count;
  end if;
  select count(*) into v_count from public.practice_session_questions where session_id=v_session; v_missing:=v_preset.question_count-v_count;
  if v_missing>0 then insert into public.practice_session_questions(session_id,question_id,question_position) select v_session,q.id,v_count+row_number() over(order by random()) from (select distinct sq.id from public.practice_bundle_collections bc join public.shared_collection_questions scq on scq.collection_id=bc.collection_id join public.shared_questions sq on sq.id=scq.question_id where bc.bundle_id=p_bundle_id and sq.active=true and sq.moderation_status='approved' and not exists(select 1 from public.practice_session_questions psq where psq.session_id=v_session and psq.question_id=sq.id)) q order by random() limit v_missing; end if;
  select count(*) into v_count from public.practice_session_questions where session_id=v_session;
  if v_count<v_preset.question_count then delete from public.practice_sessions where id=v_session; raise exception 'This exam preset needs % unique questions, but only % are currently available',v_preset.question_count,v_count; end if;
  return v_session;
end $function$;

revoke execute on function public.create_bundle_exam_preset_session(uuid,uuid) from public, anon;
grant execute on function public.create_bundle_exam_preset_session(uuid,uuid) to authenticated, service_role;

create or replace function public.admin_get_practice_bundles()
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Platform admin required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'slug',b.slug,'title',b.title,'description',b.description,'subject',b.subject,'category',b.category,'subcategory',b.subcategory,'jurisdiction',b.jurisdiction,'language',b.language,'featured',b.featured,'sort_priority',b.sort_priority,'publication_status',b.publication_status,'content_version',b.content_version,'reviewed_at',b.reviewed_at,'verified',b.verified,'current_as_of',b.current_as_of,'alignment_note',b.alignment_note,'active',b.active,'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,'duration_hours',o.duration_hours,'price_cents',o.price_cents,'badge',o.badge,'position',o.position,'active',o.active) order by o.position) from public.practice_bundle_access_options o where o.bundle_id=b.id),'[]'::jsonb),'resources',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'is_free_preview',bc.is_free_preview,'position',bc.position) order by bc.position) from public.practice_bundle_collections bc join public.shared_collections c on c.id=bc.collection_id where bc.bundle_id=b.id),'[]'::jsonb),'exam_presets',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'title',p.title,'description',p.description,'provider_label',p.provider_label,'mode_label',p.mode_label,'question_count',p.question_count,'duration_minutes',p.duration_minutes,'passing_score_percent',p.passing_score_percent,'readiness_target_percent',p.readiness_target_percent,'is_free_preview',p.is_free_preview,'position',p.position,'active',p.active) order by p.position,p.title) from public.practice_bundle_exam_presets p where p.bundle_id=b.id),'[]'::jsonb)) order by b.sort_priority desc,b.title),'[]'::jsonb) into result from public.practice_bundles b where b.catalog_scope='platform';
  return result;
end $function$;

create or replace function public.admin_upsert_bundle_exam_preset(p_bundle_id uuid,p_preset_id uuid,p_slug text,p_title text,p_description text,p_provider_label text,p_mode_label text,p_question_count integer,p_duration_minutes integer,p_passing_score_percent integer,p_readiness_target_percent integer,p_is_free_preview boolean,p_position integer,p_active boolean)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'Platform admin required'; end if;
  if not exists(select 1 from public.practice_bundles where id=p_bundle_id and catalog_scope='platform') then raise exception 'Bundle not found'; end if;
  if nullif(btrim(p_slug),'') is null or nullif(btrim(p_title),'') is null then raise exception 'Preset slug and title are required'; end if;
  if p_question_count not between 5 and 200 then raise exception 'Question count must be 5 to 200'; end if;
  if p_duration_minutes not between 0 and 600 then raise exception 'Duration must be 0 to 600 minutes'; end if;
  if p_passing_score_percent not between 0 and 100 or p_readiness_target_percent not between 0 and 100 then raise exception 'Score targets must be 0 to 100'; end if;
  if p_preset_id is null then insert into public.practice_bundle_exam_presets(bundle_id,slug,title,description,provider_label,mode_label,question_count,duration_minutes,passing_score_percent,readiness_target_percent,is_free_preview,position,active) values(p_bundle_id,lower(btrim(p_slug)),btrim(p_title),nullif(btrim(coalesce(p_description,'')),''),nullif(btrim(coalesce(p_provider_label,'')),''),coalesce(nullif(btrim(coalesce(p_mode_label,'')),''),'Exam simulation'),p_question_count,p_duration_minutes,p_passing_score_percent,p_readiness_target_percent,coalesce(p_is_free_preview,false),coalesce(p_position,0),coalesce(p_active,true)) returning id into v_id;
  else update public.practice_bundle_exam_presets set slug=lower(btrim(p_slug)),title=btrim(p_title),description=nullif(btrim(coalesce(p_description,'')),''),provider_label=nullif(btrim(coalesce(p_provider_label,'')),''),mode_label=coalesce(nullif(btrim(coalesce(p_mode_label,'')),''),'Exam simulation'),question_count=p_question_count,duration_minutes=p_duration_minutes,passing_score_percent=p_passing_score_percent,readiness_target_percent=p_readiness_target_percent,is_free_preview=coalesce(p_is_free_preview,false),position=coalesce(p_position,0),active=coalesce(p_active,true),updated_at=now() where id=p_preset_id and bundle_id=p_bundle_id returning id into v_id; if v_id is null then raise exception 'Exam preset not found'; end if; end if;
  return v_id;
end $function$;

revoke execute on function public.admin_upsert_bundle_exam_preset(uuid,uuid,text,text,text,text,text,integer,integer,integer,integer,boolean,integer,boolean) from public, anon;
grant execute on function public.admin_upsert_bundle_exam_preset(uuid,uuid,text,text,text,text,text,integer,integer,integer,integer,boolean,integer,boolean) to authenticated, service_role;
