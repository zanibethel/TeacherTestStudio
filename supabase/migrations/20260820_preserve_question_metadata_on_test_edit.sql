create or replace function public.update_test_with_questions_v2(
  p_test_id uuid,
  p_title text,
  p_description text,
  p_randomize boolean,
  p_duration_minutes integer,
  p_one_question_per_page boolean,
  p_passing_score integer,
  p_exam_preset text,
  p_assessment_type text,
  p_chapter_label text,
  p_questions jsonb
) returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_question uuid; v_choice uuid; v_correct_choice uuid;
  q jsonb; c jsonb; q_index int := 0; c_index int; correct_index int; v_type text; v_choices jsonb;
  v_hint text; v_subject text; v_chapter_number int; v_chapter_title text; v_explanation text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.role='teacher' and p.teacher_approved=true) then raise exception 'Approved teacher account required'; end if;
  if not exists(select 1 from public.tests t where t.id=p_test_id and t.teacher_id=v_user) then raise exception 'Test not found'; end if;
  if exists(select 1 from public.attempts a where a.test_id=p_test_id and a.submitted_at is not null) then raise exception 'This test has submitted attempts and must be revised as a new draft to preserve reports'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'Title is required'; end if;
  if p_duration_minutes is null or p_duration_minutes < 0 or p_duration_minutes > 600 then raise exception 'Timer must be between 0 and 600 minutes'; end if;
  if p_passing_score is null or p_passing_score < 0 or p_passing_score > 100 then raise exception 'Passing score must be between 0 and 100'; end if;
  v_type := coalesce(nullif(trim(p_assessment_type),''),'custom');
  if v_type not in ('psi_practice','chapter_exam','custom') then raise exception 'Invalid assessment type'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions)=0 then raise exception 'At least one question is required'; end if;

  update public.tests set title=trim(p_title),description=nullif(trim(p_description),''),randomize_questions=coalesce(p_randomize,false),duration_minutes=p_duration_minutes,one_question_per_page=coalesce(p_one_question_per_page,true),passing_score_percent=p_passing_score,exam_preset=coalesce(nullif(trim(p_exam_preset),''),'custom'),assessment_type=v_type,chapter_label=nullif(trim(p_chapter_label),''),updated_at=now() where id=p_test_id and teacher_id=v_user;
  delete from public.questions where test_id=p_test_id;

  for q in select value from jsonb_array_elements(p_questions) loop
    q_index := q_index + 1;
    if nullif(trim(q->>'prompt'),'') is null then raise exception 'Question % needs a prompt',q_index; end if;
    if jsonb_typeof(q->'choices') <> 'array' or jsonb_array_length(q->'choices') < 2 then raise exception 'Question % needs at least two choices',q_index; end if;
    correct_index := coalesce((q->>'correctIndex')::int,-1);
    if correct_index < 0 or correct_index >= jsonb_array_length(q->'choices') then raise exception 'Question % needs a correct answer',q_index; end if;
    v_hint := nullif(trim(coalesce(q->>'focusedRetakeHint','')), '');
    v_subject := nullif(trim(coalesce(q->>'subjectCategory',q->>'contentArea','')), '');
    v_chapter_number := case when coalesce(q->>'chapterNumber','') ~ '^[0-9]+$' then (q->>'chapterNumber')::int else null end;
    v_chapter_title := nullif(trim(coalesce(q->>'chapterTitle','')), '');
    v_explanation := nullif(trim(coalesce(q->>'explanation','')), '');

    insert into public.questions(test_id,prompt,position,content_area,subject_category,chapter_number,chapter_title,focused_retake_hint)
    values(p_test_id,trim(q->>'prompt'),q_index,v_subject,v_subject,v_chapter_number,v_chapter_title,v_hint)
    returning id into v_question;

    c_index := 0; v_correct_choice := null; v_choices := '[]'::jsonb;
    for c in select value from jsonb_array_elements(q->'choices') loop
      if nullif(trim(c#>>'{}'),'') is null then raise exception 'Question % contains an empty choice',q_index; end if;
      v_choices := v_choices || jsonb_build_array(trim(c#>>'{}'));
      insert into public.choices(question_id,label,position) values(v_question,trim(c#>>'{}'),c_index+1) returning id into v_choice;
      if c_index=correct_index then v_correct_choice:=v_choice; end if;
      c_index:=c_index+1;
    end loop;
    insert into public.question_answers(question_id,choice_id) values(v_question,v_correct_choice);

    insert into public.question_bank(teacher_id,prompt,normalized_prompt,choices,correct_index,content_area,subject_category,chapter_number,chapter_title,source_type,focused_retake_hint,explanation)
    values(v_user,trim(q->>'prompt'),public.normalize_question_text(q->>'prompt'),v_choices,correct_index,v_subject,v_subject,v_chapter_number,v_chapter_title,coalesce(nullif(trim(q->>'sourceType'),''),'teacher'),v_hint,v_explanation)
    on conflict (teacher_id,normalized_prompt) do update set
      prompt=excluded.prompt,choices=excluded.choices,correct_index=excluded.correct_index,
      content_area=excluded.content_area,subject_category=excluded.subject_category,
      chapter_number=excluded.chapter_number,chapter_title=excluded.chapter_title,
      focused_retake_hint=excluded.focused_retake_hint,explanation=coalesce(excluded.explanation,public.question_bank.explanation),updated_at=now();
  end loop;
  return p_test_id;
end;
$function$;

revoke all on function public.update_test_with_questions_v2(uuid,text,text,boolean,integer,boolean,integer,text,text,text,jsonb) from public;
revoke all on function public.update_test_with_questions_v2(uuid,text,text,boolean,integer,boolean,integer,text,text,text,jsonb) from anon;
grant execute on function public.update_test_with_questions_v2(uuid,text,text,boolean,integer,boolean,integer,text,text,text,jsonb) to authenticated;
grant execute on function public.update_test_with_questions_v2(uuid,text,text,boolean,integer,boolean,integer,text,text,text,jsonb) to service_role;
