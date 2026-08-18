create index question_answers_choice_idx on public.question_answers(choice_id);
create index responses_choice_idx on public.responses(choice_id);
create index responses_question_idx on public.responses(question_id);

drop policy profiles_self on public.profiles;
drop policy profiles_teacher_attempt_students on public.profiles;
create policy profiles_read_authorized on public.profiles for select to authenticated using (
  (select auth.uid())=id
  or exists(
    select 1 from public.attempts a
    join public.tests t on t.id=a.test_id
    where a.student_id=profiles.id and t.teacher_id=(select auth.uid())
  )
);

drop policy questions_teacher_write on public.questions;
create policy questions_teacher_insert on public.questions for insert to authenticated with check (exists(select 1 from public.tests t where t.id=test_id and t.teacher_id=(select auth.uid())));
create policy questions_teacher_update on public.questions for update to authenticated using (exists(select 1 from public.tests t where t.id=test_id and t.teacher_id=(select auth.uid()))) with check (exists(select 1 from public.tests t where t.id=test_id and t.teacher_id=(select auth.uid())));
create policy questions_teacher_delete on public.questions for delete to authenticated using (exists(select 1 from public.tests t where t.id=test_id and t.teacher_id=(select auth.uid())));

drop policy choices_teacher_write on public.choices;
create policy choices_teacher_insert on public.choices for insert to authenticated with check (exists(select 1 from public.questions q join public.tests t on t.id=q.test_id where q.id=question_id and t.teacher_id=(select auth.uid())));
create policy choices_teacher_update on public.choices for update to authenticated using (exists(select 1 from public.questions q join public.tests t on t.id=q.test_id where q.id=question_id and t.teacher_id=(select auth.uid()))) with check (exists(select 1 from public.questions q join public.tests t on t.id=q.test_id where q.id=question_id and t.teacher_id=(select auth.uid())));
create policy choices_teacher_delete on public.choices for delete to authenticated using (exists(select 1 from public.questions q join public.tests t on t.id=q.test_id where q.id=question_id and t.teacher_id=(select auth.uid())));
