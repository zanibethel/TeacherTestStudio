alter function public.create_test_with_questions(text,text,boolean,jsonb) security invoker;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.grade_test_attempt(p_test_id uuid, p_answers jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_attempt uuid;
  v_total int;
  v_correct int;
  q record;
  v_choice uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.tests t where t.id=p_test_id and t.status='published') then raise exception 'Test unavailable'; end if;
  if not exists (select 1 from public.profiles p where p.id=v_user and p.role='student') then raise exception 'Student account required'; end if;

  insert into public.attempts(test_id,student_id) values(p_test_id,v_user) returning id into v_attempt;
  for q in select id from public.questions where test_id=p_test_id loop
    begin v_choice := nullif(p_answers->>q.id::text,'')::uuid; exception when invalid_text_representation then v_choice := null; end;
    if v_choice is not null and not exists (select 1 from public.choices c where c.id=v_choice and c.question_id=q.id) then v_choice := null; end if;
    insert into public.responses(attempt_id,question_id,choice_id,is_correct)
    values(v_attempt,q.id,v_choice,exists(select 1 from public.question_answers a where a.question_id=q.id and a.choice_id=v_choice));
  end loop;
  select count(*), count(*) filter(where is_correct) into v_total,v_correct from public.responses where attempt_id=v_attempt;
  update public.attempts set submitted_at=now(),total_questions=v_total,correct_count=v_correct,
    score_percent=case when v_total=0 then 0 else round((v_correct::numeric/v_total)*100,2) end where id=v_attempt;
  return v_attempt;
end;
$$;
revoke all on function private.grade_test_attempt(uuid,jsonb) from public, anon;
grant execute on function private.grade_test_attempt(uuid,jsonb) to authenticated;

create or replace function public.submit_test_attempt(p_test_id uuid, p_answers jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.grade_test_attempt(p_test_id,p_answers);
$$;
revoke all on function public.submit_test_attempt(uuid,jsonb) from public, anon;
grant execute on function public.submit_test_attempt(uuid,jsonb) to authenticated;
