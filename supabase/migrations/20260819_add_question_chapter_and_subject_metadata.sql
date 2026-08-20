-- Add independent chapter and subject metadata to teacher/shared/test questions.
-- Keeps content_area populated for backwards compatibility with existing reports/remediation.

alter table public.question_bank add column if not exists chapter_number integer null;
alter table public.question_bank add column if not exists chapter_title text null;
alter table public.question_bank add column if not exists subject_category text null;
alter table public.question_bank drop constraint if exists question_bank_chapter_number_check;
alter table public.question_bank add constraint question_bank_chapter_number_check check (chapter_number is null or chapter_number > 0);

alter table public.shared_questions add column if not exists chapter_number integer null;
alter table public.shared_questions add column if not exists chapter_title text null;
alter table public.shared_questions add column if not exists subject_category text null;
alter table public.shared_questions drop constraint if exists shared_questions_chapter_number_check;
alter table public.shared_questions add constraint shared_questions_chapter_number_check check (chapter_number is null or chapter_number > 0);

alter table public.questions add column if not exists chapter_number integer null;
alter table public.questions add column if not exists chapter_title text null;
alter table public.questions add column if not exists subject_category text null;
alter table public.questions drop constraint if exists questions_chapter_number_check;
alter table public.questions add constraint questions_chapter_number_check check (chapter_number is null or chapter_number > 0);

update public.shared_questions set subject_category=coalesce(nullif(trim(exam_domain),''),nullif(trim(content_area),'')) where subject_category is null;
update public.question_bank set subject_category=nullif(trim(content_area),'') where subject_category is null;
update public.questions set subject_category=nullif(trim(content_area),'') where subject_category is null;

create index if not exists question_bank_teacher_chapter_idx on public.question_bank(teacher_id,chapter_number);
create index if not exists question_bank_teacher_subject_idx on public.question_bank(teacher_id,subject_category);
create index if not exists question_bank_teacher_chapter_subject_idx on public.question_bank(teacher_id,chapter_number,subject_category);

create or replace function public.import_shared_collection(p_collection_id uuid)
returns integer language plpgsql security definer set search_path to '' as $function$
declare v_user uuid:=auth.uid(); v_count integer:=0;
begin
  if v_user is null or not exists(select 1 from public.profiles where id=v_user and role='teacher' and teacher_approved=true) then raise exception 'Approved teacher account required'; end if;
  if not exists(select 1 from public.shared_collections where id=p_collection_id and active=true and (visibility='shared' or owner_teacher_id=v_user)) then raise exception 'Shared collection unavailable'; end if;
  insert into public.question_bank(teacher_id,prompt,normalized_prompt,choices,correct_index,content_area,subject_category,chapter_number,chapter_title,explanation,source_type,shared_question_id,imported_collection_id,focused_retake_hint)
  select v_user,q.prompt,q.normalized_prompt,q.choices,q.correct_index,q.content_area,coalesce(q.subject_category,q.exam_domain,q.content_area),q.chapter_number,q.chapter_title,q.explanation,'copied',q.id,p_collection_id,q.focused_retake_hint
  from public.shared_collection_questions cq join public.shared_questions q on q.id=cq.question_id
  where cq.collection_id=p_collection_id and q.active=true and q.moderation_status='approved'
  on conflict (teacher_id,normalized_prompt) do nothing;
  get diagnostics v_count=row_count; return v_count;
end;$function$;

create or replace function public.refresh_my_shared_bank_questions()
returns integer language plpgsql security definer set search_path to '' as $function$
declare v_user uuid:=auth.uid(); v_count integer:=0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  update public.question_bank qb set
    prompt=sq.prompt,
    normalized_prompt=case when exists(select 1 from public.question_bank other where other.teacher_id=v_user and other.id<>qb.id and other.normalized_prompt=sq.normalized_prompt) then qb.normalized_prompt else sq.normalized_prompt end,
    choices=sq.choices,correct_index=sq.correct_index,content_area=sq.content_area,
    subject_category=coalesce(sq.subject_category,sq.exam_domain,sq.content_area),chapter_number=sq.chapter_number,chapter_title=sq.chapter_title,
    explanation=sq.explanation,focused_retake_hint=sq.focused_retake_hint,updated_at=now()
  from public.shared_questions sq
  where qb.teacher_id=v_user and qb.shared_question_id=sq.id and sq.active=true and sq.moderation_status='approved'
    and (qb.prompt is distinct from sq.prompt or qb.choices is distinct from sq.choices or qb.correct_index is distinct from sq.correct_index or qb.content_area is distinct from sq.content_area or qb.subject_category is distinct from coalesce(sq.subject_category,sq.exam_domain,sq.content_area) or qb.chapter_number is distinct from sq.chapter_number or qb.chapter_title is distinct from sq.chapter_title or qb.explanation is distinct from sq.explanation or qb.focused_retake_hint is distinct from sq.focused_retake_hint or (qb.normalized_prompt is distinct from sq.normalized_prompt and not exists(select 1 from public.question_bank other where other.teacher_id=v_user and other.id<>qb.id and other.normalized_prompt=sq.normalized_prompt)));
  get diagnostics v_count=row_count; return v_count;
end;$function$;

create or replace function public.refresh_my_shared_bank_questions(p_collection_id uuid)
returns integer language plpgsql security definer set search_path to '' as $function$
declare v_user uuid:=auth.uid(); v_count integer:=0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_collection_id is null then return public.refresh_my_shared_bank_questions(); end if;
  update public.question_bank qb set
    prompt=sq.prompt,
    normalized_prompt=case when exists(select 1 from public.question_bank other where other.teacher_id=v_user and other.id<>qb.id and other.normalized_prompt=sq.normalized_prompt) then qb.normalized_prompt else sq.normalized_prompt end,
    choices=sq.choices,correct_index=sq.correct_index,content_area=sq.content_area,
    subject_category=coalesce(sq.subject_category,sq.exam_domain,sq.content_area),chapter_number=sq.chapter_number,chapter_title=sq.chapter_title,
    explanation=sq.explanation,focused_retake_hint=sq.focused_retake_hint,updated_at=now()
  from public.shared_questions sq
  where qb.teacher_id=v_user and qb.imported_collection_id=p_collection_id and qb.shared_question_id=sq.id and sq.active=true and sq.moderation_status='approved'
    and (qb.prompt is distinct from sq.prompt or qb.choices is distinct from sq.choices or qb.correct_index is distinct from sq.correct_index or qb.content_area is distinct from sq.content_area or qb.subject_category is distinct from coalesce(sq.subject_category,sq.exam_domain,sq.content_area) or qb.chapter_number is distinct from sq.chapter_number or qb.chapter_title is distinct from sq.chapter_title or qb.explanation is distinct from sq.explanation or qb.focused_retake_hint is distinct from sq.focused_retake_hint or (qb.normalized_prompt is distinct from sq.normalized_prompt and not exists(select 1 from public.question_bank other where other.teacher_id=v_user and other.id<>qb.id and other.normalized_prompt=sq.normalized_prompt)));
  get diagnostics v_count=row_count; return v_count;
end;$function$;

create or replace function public.create_test_with_questions_v6(
  p_title text,p_description text,p_randomize boolean,p_duration_minutes integer,p_one_question_per_page boolean,p_passing_score integer,p_exam_preset text,p_assessment_type text,p_chapter_label text,p_questions jsonb,p_questions_per_attempt integer default null,p_require_focused_retake_before_full boolean default false,p_focused_retake_percent integer default 50,p_focused_retake_min_score integer default 0,p_focused_retake_hints boolean default true,p_unlimited_attempts_until_due boolean default false,p_max_attempts integer default 1,p_due_at timestamptz default null)
returns uuid language plpgsql set search_path to '' as $function$
declare
  v_user uuid:=auth.uid(); v_test uuid; v_question uuid; v_choice uuid; v_correct_choice uuid; q jsonb; c jsonb; q_index int:=0; c_index int; correct_index int; v_type text; v_choices jsonb; v_pool_count int; v_hint text; v_subject text; v_chapter_number int; v_chapter_title text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.role='teacher' and coalesce(p.teacher_approved,false)) then raise exception 'Approved teacher account required'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'Title is required'; end if;
  if p_duration_minutes is null or p_duration_minutes<0 or p_duration_minutes>600 then raise exception 'Timer must be between 0 and 600 minutes'; end if;
  if p_passing_score is null or p_passing_score<0 or p_passing_score>100 then raise exception 'Passing score must be between 0 and 100'; end if;
  if p_focused_retake_percent not between 10 and 100 then raise exception 'Focused retest size must be between 10 and 100 percent'; end if;
  if p_focused_retake_min_score not between 0 and 100 then raise exception 'Focused retest required grade must be between 0 and 100'; end if;
  if p_max_attempts is null or p_max_attempts<1 or p_max_attempts>100 then raise exception 'Allowed attempts must be between 1 and 100'; end if;
  if coalesce(p_unlimited_attempts_until_due,false) and p_due_at is null then raise exception 'Unlimited retakes require a due date'; end if;
  if p_due_at is not null and p_due_at<=now() then raise exception 'Due date must be in the future'; end if;
  v_type:=coalesce(nullif(trim(p_assessment_type),''),'custom');
  if v_type not in ('psi_practice','chapter_exam','custom') then raise exception 'Invalid assessment type'; end if;
  if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions)=0 then raise exception 'At least one question is required'; end if;
  v_pool_count:=jsonb_array_length(p_questions);
  if p_questions_per_attempt is not null and (p_questions_per_attempt<1 or p_questions_per_attempt>v_pool_count) then raise exception 'Questions per attempt must be between 1 and the selected pool size'; end if;
  insert into public.tests(teacher_id,title,description,randomize_questions,duration_minutes,one_question_per_page,passing_score_percent,exam_preset,assessment_type,chapter_label,questions_per_attempt,require_focused_retake_before_full,focused_retake_percent,focused_retake_min_score,focused_retake_hints,unlimited_attempts_until_due,max_attempts,due_at)
  values(v_user,trim(p_title),nullif(trim(p_description),''),coalesce(p_randomize,false),p_duration_minutes,coalesce(p_one_question_per_page,true),p_passing_score,coalesce(nullif(trim(p_exam_preset),''),'custom'),v_type,nullif(trim(p_chapter_label),''),coalesce(p_questions_per_attempt,v_pool_count),coalesce(p_require_focused_retake_before_full,false),p_focused_retake_percent,p_focused_retake_min_score,coalesce(p_focused_retake_hints,true),coalesce(p_unlimited_attempts_until_due,false),p_max_attempts,p_due_at) returning id into v_test;
  for q in select value from jsonb_array_elements(p_questions) loop
    q_index:=q_index+1;
    if nullif(trim(q->>'prompt'),'') is null then raise exception 'Question % needs a prompt',q_index; end if;
    if jsonb_typeof(q->'choices')<>'array' or jsonb_array_length(q->'choices')<2 then raise exception 'Question % needs at least two choices',q_index; end if;
    correct_index:=coalesce((q->>'correctIndex')::int,-1);
    if correct_index<0 or correct_index>=jsonb_array_length(q->'choices') then raise exception 'Question % needs a correct answer',q_index; end if;
    v_hint:=nullif(trim(coalesce(q->>'focusedRetakeHint','')),'');
    v_subject:=nullif(trim(coalesce(q->>'subjectCategory',q->>'contentArea','')),'');
    v_chapter_number:=case when coalesce(q->>'chapterNumber','')~'^[0-9]+$' then (q->>'chapterNumber')::int else null end;
    v_chapter_title:=nullif(trim(coalesce(q->>'chapterTitle','')),'');
    insert into public.questions(test_id,prompt,position,content_area,subject_category,chapter_number,chapter_title,focused_retake_hint)
    values(v_test,trim(q->>'prompt'),q_index,v_subject,v_subject,v_chapter_number,v_chapter_title,v_hint) returning id into v_question;
    c_index:=0;v_correct_choice:=null;v_choices:='[]'::jsonb;
    for c in select value from jsonb_array_elements(q->'choices') loop
      if nullif(trim(c#>>'{}'),'') is null then raise exception 'Question % contains an empty choice',q_index; end if;
      v_choices:=v_choices||jsonb_build_array(trim(c#>>'{}'));
      insert into public.choices(question_id,label,position) values(v_question,trim(c#>>'{}'),c_index+1) returning id into v_choice;
      if c_index=correct_index then v_correct_choice:=v_choice; end if;c_index:=c_index+1;
    end loop;
    insert into public.question_answers(question_id,choice_id) values(v_question,v_correct_choice);
    insert into public.question_bank(teacher_id,prompt,normalized_prompt,choices,correct_index,content_area,subject_category,chapter_number,chapter_title,source_type,focused_retake_hint)
    values(v_user,trim(q->>'prompt'),public.normalize_question_text(q->>'prompt'),v_choices,correct_index,v_subject,v_subject,v_chapter_number,v_chapter_title,coalesce(nullif(trim(q->>'sourceType'),''),'teacher'),v_hint)
    on conflict (teacher_id,normalized_prompt) do update set prompt=excluded.prompt,choices=excluded.choices,correct_index=excluded.correct_index,content_area=coalesce(excluded.content_area,public.question_bank.content_area),subject_category=coalesce(excluded.subject_category,public.question_bank.subject_category),chapter_number=coalesce(excluded.chapter_number,public.question_bank.chapter_number),chapter_title=coalesce(excluded.chapter_title,public.question_bank.chapter_title),focused_retake_hint=excluded.focused_retake_hint,updated_at=now();
  end loop;return v_test;
end;$function$;

revoke execute on function public.import_shared_collection(uuid) from public,anon;
revoke execute on function public.refresh_my_shared_bank_questions() from public,anon;
revoke execute on function public.refresh_my_shared_bank_questions(uuid) from public,anon;
grant execute on function public.import_shared_collection(uuid) to authenticated,service_role;
grant execute on function public.refresh_my_shared_bank_questions() to authenticated,service_role;
grant execute on function public.refresh_my_shared_bank_questions(uuid) to authenticated,service_role;
