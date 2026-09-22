alter table public.practice_sessions
  add column if not exists teacher_id uuid references public.profiles(id) on delete cascade,
  add column if not exists local_student_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='practice_sessions_local_student_name_chk'
      and conrelid='public.practice_sessions'::regclass
  ) then
    alter table public.practice_sessions
      add constraint practice_sessions_local_student_name_chk
      check (local_student_name is null or char_length(btrim(local_student_name)) between 1 and 120);
  end if;
end $$;

create index if not exists practice_sessions_teacher_local_created_idx
  on public.practice_sessions(teacher_id, created_at desc)
  where teacher_id is not null and local_student_name is not null;

create or replace function public.get_teacher_classroom_exam_catalog()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid:=auth.uid();
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(
    select 1 from public.profiles
    where id=v_user and role='teacher' and teacher_approved=true
  ) then raise exception 'Approved teacher account required'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'slug',p.slug,
    'title',p.title,
    'description',p.description,
    'provider_label',p.provider_label,
    'mode_label',p.mode_label,
    'question_count',p.question_count,
    'duration_minutes',p.duration_minutes,
    'passing_score_percent',p.passing_score_percent,
    'position',p.position,
    'bundle_id',b.id,
    'bundle_slug',b.slug,
    'bundle_title',b.title,
    'subject',b.subject,
    'jurisdiction',b.jurisdiction,
    'verified',b.verified,
    'available_question_count',(
      select count(distinct sq.id)
      from public.practice_bundle_collections bc
      join public.shared_collection_questions scq on scq.collection_id=bc.collection_id
      join public.shared_questions sq on sq.id=scq.question_id
      where bc.bundle_id=b.id
        and sq.active=true
        and sq.moderation_status='approved'
    )
  ) order by b.sort_priority desc,b.title,p.position,p.title),'[]'::jsonb)
  into v_result
  from public.practice_bundle_exam_presets p
  join public.practice_bundles b on b.id=p.bundle_id
  where p.active=true
    and b.active=true
    and b.catalog_scope='platform'
    and b.publication_status='published';

  return v_result;
end
$function$;

create or replace function public.get_teacher_classroom_print_pool(p_bundle_id uuid,p_preset_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid:=auth.uid();
  v_bundle public.practice_bundles%rowtype;
  v_preset public.practice_bundle_exam_presets%rowtype;
  v_questions jsonb;
  v_weights jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(
    select 1 from public.profiles
    where id=v_user and role='teacher' and teacher_approved=true
  ) then raise exception 'Approved teacher account required'; end if;

  select * into v_bundle
  from public.practice_bundles
  where id=p_bundle_id
    and active=true
    and catalog_scope='platform'
    and publication_status='published';
  if not found then raise exception 'Practice bundle unavailable'; end if;

  select * into v_preset
  from public.practice_bundle_exam_presets
  where id=p_preset_id and bundle_id=p_bundle_id and active=true;
  if not found then raise exception 'Exam preset unavailable'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'exam_domain',w.exam_domain,
    'weight_percent',w.weight_percent
  ) order by w.weight_percent desc,w.exam_domain),'[]'::jsonb)
  into v_weights
  from public.practice_bundle_exam_preset_weights w
  where w.preset_id=v_preset.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,
    'prompt',q.prompt,
    'choices',q.choices,
    'correct_index',q.correct_index,
    'exam_domain',q.exam_domain,
    'content_area',q.content_area
  ) order by q.id),'[]'::jsonb)
  into v_questions
  from (
    select distinct
      sq.id,sq.prompt,sq.choices,sq.correct_index,sq.exam_domain,sq.content_area
    from public.practice_bundle_collections bc
    join public.shared_collection_questions scq on scq.collection_id=bc.collection_id
    join public.shared_questions sq on sq.id=scq.question_id
    where bc.bundle_id=p_bundle_id
      and sq.active=true
      and sq.moderation_status='approved'
  ) q;

  return jsonb_build_object(
    'bundle',jsonb_build_object(
      'id',v_bundle.id,
      'title',v_bundle.title,
      'subject',v_bundle.subject,
      'jurisdiction',v_bundle.jurisdiction,
      'verified',v_bundle.verified
    ),
    'preset',jsonb_build_object(
      'id',v_preset.id,
      'title',v_preset.title,
      'description',v_preset.description,
      'provider_label',v_preset.provider_label,
      'mode_label',v_preset.mode_label,
      'question_count',v_preset.question_count,
      'duration_minutes',v_preset.duration_minutes,
      'passing_score_percent',v_preset.passing_score_percent
    ),
    'weights',v_weights,
    'questions',v_questions
  );
end
$function$;

create or replace function public.create_teacher_local_exam_session(
  p_bundle_id uuid,
  p_preset_id uuid,
  p_student_name text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid:=auth.uid();
  v_bundle public.practice_bundles%rowtype;
  v_preset public.practice_bundle_exam_presets%rowtype;
  v_session uuid;
  v_count int;
  v_missing int;
  v_areas text[];
  v_has_weights boolean;
  v_name text:=btrim(coalesce(p_student_name,''));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(
    select 1 from public.profiles
    where id=v_user and role='teacher' and teacher_approved=true
  ) then raise exception 'Approved teacher account required'; end if;
  if char_length(v_name)<1 or char_length(v_name)>120 then
    raise exception 'Student name must be between 1 and 120 characters';
  end if;

  select * into v_bundle
  from public.practice_bundles
  where id=p_bundle_id
    and active=true
    and catalog_scope='platform'
    and publication_status='published';
  if not found then raise exception 'Practice bundle unavailable'; end if;

  select * into v_preset
  from public.practice_bundle_exam_presets
  where id=p_preset_id and bundle_id=p_bundle_id and active=true;
  if not found then raise exception 'Exam preset unavailable'; end if;

  with eligible as (
    select distinct sq.id,sq.content_area
    from public.practice_bundle_collections bc
    join public.shared_collection_questions scq on scq.collection_id=bc.collection_id
    join public.shared_questions sq on sq.id=scq.question_id
    where bc.bundle_id=p_bundle_id
      and sq.active=true
      and sq.moderation_status='approved'
  )
  select array_agg(distinct content_area) filter(where content_area is not null)
  into v_areas
  from eligible;

  insert into public.practice_sessions(
    student_id,teacher_id,local_student_name,title,selected_areas,question_count,
    source_bundle_id,source_exam_preset_id,session_kind,duration_minutes,
    passing_score_percent,deadline_at
  )
  values(
    v_user,v_user,v_name,v_preset.title,coalesce(v_areas,array[]::text[]),
    v_preset.question_count,p_bundle_id,v_preset.id,'local_exam_preset',
    v_preset.duration_minutes,v_preset.passing_score_percent,
    case when v_preset.duration_minutes>0
      then now()+make_interval(mins=>v_preset.duration_minutes)
      else null
    end
  )
  returning id into v_session;

  select exists(
    select 1
    from public.practice_bundle_exam_preset_weights
    where preset_id=v_preset.id
  )
  into v_has_weights;

  if v_has_weights then
    with weights as (
      select
        w.exam_domain,
        w.weight_percent,
        floor((v_preset.question_count*w.weight_percent)/100.0)::int base_count,
        ((v_preset.question_count*w.weight_percent)/100.0)
          - floor((v_preset.question_count*w.weight_percent)/100.0) frac
      from public.practice_bundle_exam_preset_weights w
      where w.preset_id=v_preset.id
    ),
    ranked_weights as (
      select *,
        row_number() over(order by frac desc,weight_percent desc,exam_domain) extra_rank,
        v_preset.question_count-sum(base_count) over() extras
      from weights
    ),
    desired as (
      select
        exam_domain,
        base_count+case when extra_rank<=extras then 1 else 0 end desired_count
      from ranked_weights
    ),
    eligible as (
      select distinct sq.id,sq.exam_domain
      from public.practice_bundle_collections bc
      join public.shared_collection_questions scq on scq.collection_id=bc.collection_id
      join public.shared_questions sq on sq.id=scq.question_id
      where bc.bundle_id=p_bundle_id
        and sq.active=true
        and sq.moderation_status='approved'
    ),
    candidates as (
      select
        e.id,
        e.exam_domain,
        row_number() over(partition by e.exam_domain order by random()) rn
      from eligible e
      where e.exam_domain is not null
    ),
    picked as (
      select c.id
      from candidates c
      join desired d
        on d.exam_domain=c.exam_domain
       and c.rn<=d.desired_count
    )
    insert into public.practice_session_questions(session_id,question_id,question_position)
    select v_session,id,row_number() over(order by random())
    from picked;
  else
    insert into public.practice_session_questions(session_id,question_id,question_position)
    select v_session,id,row_number() over(order by random())
    from (
      select distinct sq.id
      from public.practice_bundle_collections bc
      join public.shared_collection_questions scq on scq.collection_id=bc.collection_id
      join public.shared_questions sq on sq.id=scq.question_id
      where bc.bundle_id=p_bundle_id
        and sq.active=true
        and sq.moderation_status='approved'
    ) q
    order by random()
    limit v_preset.question_count;
  end if;

  select count(*) into v_count
  from public.practice_session_questions
  where session_id=v_session;

  v_missing:=v_preset.question_count-v_count;
  if v_missing>0 then
    insert into public.practice_session_questions(session_id,question_id,question_position)
    select v_session,q.id,v_count+row_number() over(order by random())
    from (
      select distinct sq.id
      from public.practice_bundle_collections bc
      join public.shared_collection_questions scq on scq.collection_id=bc.collection_id
      join public.shared_questions sq on sq.id=scq.question_id
      where bc.bundle_id=p_bundle_id
        and sq.active=true
        and sq.moderation_status='approved'
        and not exists(
          select 1
          from public.practice_session_questions psq
          where psq.session_id=v_session and psq.question_id=sq.id
        )
    ) q
    order by random()
    limit v_missing;
  end if;

  select count(*) into v_count
  from public.practice_session_questions
  where session_id=v_session;

  if v_count<v_preset.question_count then
    delete from public.practice_sessions where id=v_session;
    raise exception
      'This exam preset needs % unique questions, but only % are currently available',
      v_preset.question_count,v_count;
  end if;

  return v_session;
end
$function$;

create or replace function public.get_teacher_local_exam_report(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid:=auth.uid();
  v_session public.practice_sessions%rowtype;
  v_areas jsonb:='[]'::jsonb;
  v_bundle_title text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(
    select 1 from public.profiles
    where id=v_user and role='teacher' and teacher_approved=true
  ) then raise exception 'Approved teacher account required'; end if;

  select * into v_session
  from public.practice_sessions
  where id=p_session_id
    and teacher_id=v_user
    and student_id=v_user
    and local_student_name is not null
    and session_kind='local_exam_preset';
  if not found then raise exception 'Local exam session not found'; end if;

  select title into v_bundle_title
  from public.practice_bundles
  where id=v_session.source_bundle_id;

  if v_session.status='submitted' then
    with area_results as (
      select
        coalesce(nullif(sq.exam_domain,''),nullif(sq.content_area,''),'General') as area,
        count(*)::integer as total,
        count(*) filter(where r.is_correct)::integer as correct,
        round(
          100.0*count(*) filter(where r.is_correct)/nullif(count(*),0),
          1
        ) as mastery
      from public.practice_session_responses r
      join public.shared_questions sq on sq.id=r.question_id
      where r.session_id=p_session_id
      group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'area',area,
      'correct',correct,
      'total',total,
      'mastery',mastery
    ) order by mastery,total desc,area),'[]'::jsonb)
    into v_areas
    from area_results;
  end if;

  return jsonb_build_object(
    'id',v_session.id,
    'student_name',v_session.local_student_name,
    'title',v_session.title,
    'bundle_title',v_bundle_title,
    'status',v_session.status,
    'score_percent',v_session.score_percent,
    'correct_count',v_session.correct_count,
    'question_count',v_session.question_count,
    'passing_score_percent',v_session.passing_score_percent,
    'duration_minutes',v_session.duration_minutes,
    'deadline_at',v_session.deadline_at,
    'created_at',v_session.created_at,
    'submitted_at',v_session.submitted_at,
    'source_bundle_id',v_session.source_bundle_id,
    'source_exam_preset_id',v_session.source_exam_preset_id,
    'areas',v_areas
  );
end
$function$;

revoke all on function public.get_teacher_classroom_exam_catalog()
  from public,anon;
grant execute on function public.get_teacher_classroom_exam_catalog()
  to authenticated;

revoke all on function public.get_teacher_classroom_print_pool(uuid,uuid)
  from public,anon;
grant execute on function public.get_teacher_classroom_print_pool(uuid,uuid)
  to authenticated;

revoke all on function public.create_teacher_local_exam_session(uuid,uuid,text)
  from public,anon;
grant execute on function public.create_teacher_local_exam_session(uuid,uuid,text)
  to authenticated;

revoke all on function public.get_teacher_local_exam_report(uuid)
  from public,anon;
grant execute on function public.get_teacher_local_exam_report(uuid)
  to authenticated;
