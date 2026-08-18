alter table public.tests
  add column if not exists assessment_type text not null default 'custom' check (assessment_type in ('psi_practice','chapter_exam','custom')),
  add column if not exists chapter_label text;

alter table public.questions
  add column if not exists content_area text;

create or replace function public.create_test_with_questions_v3(
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
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid(); v_test uuid; v_question uuid; v_choice uuid; v_correct_choice uuid;
  q jsonb; c jsonb; q_index int := 0; c_index int; correct_index int; v_type text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id=v_user and p.role='teacher') then raise exception 'Teacher account required'; end if;
  if nullif(trim(p_title), '') is null then raise exception 'Title is required'; end if;
  if p_duration_minutes is null or p_duration_minutes < 0 or p_duration_minutes > 600 then raise exception 'Timer must be between 0 and 600 minutes'; end if;
  if p_passing_score is null or p_passing_score < 0 or p_passing_score > 100 then raise exception 'Passing score must be between 0 and 100'; end if;
  v_type := coalesce(nullif(trim(p_assessment_type),''),'custom');
  if v_type not in ('psi_practice','chapter_exam','custom') then raise exception 'Invalid assessment type'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then raise exception 'At least one question is required'; end if;

  insert into public.tests(teacher_id,title,description,randomize_questions,duration_minutes,one_question_per_page,passing_score_percent,exam_preset,assessment_type,chapter_label)
  values(v_user,trim(p_title),nullif(trim(p_description),''),coalesce(p_randomize,false),p_duration_minutes,coalesce(p_one_question_per_page,true),p_passing_score,coalesce(nullif(trim(p_exam_preset),''),'custom'),v_type,nullif(trim(p_chapter_label),''))
  returning id into v_test;

  for q in select value from jsonb_array_elements(p_questions) loop
    q_index := q_index + 1;
    if nullif(trim(q->>'prompt'), '') is null then raise exception 'Question % needs a prompt', q_index; end if;
    if jsonb_typeof(q->'choices') <> 'array' or jsonb_array_length(q->'choices') < 2 then raise exception 'Question % needs at least two choices', q_index; end if;
    correct_index := coalesce((q->>'correctIndex')::int,-1);
    if correct_index < 0 or correct_index >= jsonb_array_length(q->'choices') then raise exception 'Question % needs a correct answer', q_index; end if;
    insert into public.questions(test_id,prompt,position,content_area)
      values(v_test,trim(q->>'prompt'),q_index,nullif(trim(q->>'contentArea'),'')) returning id into v_question;
    c_index := 0; v_correct_choice := null;
    for c in select value from jsonb_array_elements(q->'choices') loop
      if nullif(trim(c#>>'{}'),'') is null then raise exception 'Question % contains an empty choice',q_index; end if;
      insert into public.choices(question_id,label,position) values(v_question,trim(c#>>'{}'),c_index+1) returning id into v_choice;
      if c_index = correct_index then v_correct_choice := v_choice; end if;
      c_index := c_index + 1;
    end loop;
    insert into public.question_answers(question_id,choice_id) values(v_question,v_correct_choice);
  end loop;
  return v_test;
end;
$$;

revoke all on function public.create_test_with_questions_v3(text,text,boolean,integer,boolean,integer,text,text,text,jsonb) from public, anon;
grant execute on function public.create_test_with_questions_v3(text,text,boolean,integer,boolean,integer,text,text,text,jsonb) to authenticated;
