create or replace function private.grade_existing_attempt(p_attempt_id uuid, p_answers jsonb, p_auto boolean default false)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid:=auth.uid();
  v_test uuid;
  v_total int;
  v_correct int;
  v_expected int;
  v_answered int;
  q record;
  v_choice uuid;
  v_has_locked boolean;
begin
  select test_id into v_test
  from public.attempts
  where id=p_attempt_id and student_id=v_user and submitted_at is null;
  if v_test is null then raise exception 'Attempt unavailable'; end if;

  select exists(select 1 from public.attempt_questions aq where aq.attempt_id=p_attempt_id)
  into v_has_locked;

  select count(*) into v_expected
  from public.questions q
  where q.test_id=v_test
    and (not v_has_locked or exists(
      select 1 from public.attempt_questions aq
      where aq.attempt_id=p_attempt_id and aq.question_id=q.id
    ));

  if not coalesce(p_auto,false) then
    select count(*) into v_answered
    from public.questions q
    where q.test_id=v_test
      and (not v_has_locked or exists(
        select 1 from public.attempt_questions aq
        where aq.attempt_id=p_attempt_id and aq.question_id=q.id
      ))
      and nullif(btrim(coalesce(p_answers->>q.id::text,'')),'') is not null;

    if v_expected=0 or v_answered<>v_expected then
      raise exception 'Answer every question before submitting';
    end if;
  end if;

  for q in
    select id from public.questions
    where test_id=v_test
      and (not v_has_locked or exists(
        select 1 from public.attempt_questions aq
        where aq.attempt_id=p_attempt_id and aq.question_id=questions.id
      ))
  loop
    begin
      v_choice:=nullif(p_answers->>q.id::text,'')::uuid;
    exception when invalid_text_representation then
      v_choice:=null;
    end;

    if v_choice is not null and not exists(
      select 1 from public.choices c where c.id=v_choice and c.question_id=q.id
    ) then
      v_choice:=null;
    end if;

    insert into public.responses(attempt_id,question_id,choice_id,is_correct)
    values(
      p_attempt_id,
      q.id,
      v_choice,
      exists(select 1 from public.question_answers a where a.question_id=q.id and a.choice_id=v_choice)
    )
    on conflict (attempt_id,question_id)
    do update set choice_id=excluded.choice_id,is_correct=excluded.is_correct;
  end loop;

  select count(*),count(*) filter(where is_correct)
  into v_total,v_correct
  from public.responses
  where attempt_id=p_attempt_id;

  update public.attempts
  set submitted_at=now(),last_saved_at=now(),total_questions=v_total,correct_count=v_correct,
      score_percent=case when v_total=0 then 0 else round((v_correct::numeric/v_total)*100,2) end,
      auto_submitted=coalesce(p_auto,false)
  where id=p_attempt_id;

  return p_attempt_id;
end;
$function$;
