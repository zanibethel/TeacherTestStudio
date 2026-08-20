create or replace function public.get_teacher_test_mastery_report(p_test_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid:=auth.uid();
  v_teacher uuid;
  v_students jsonb:='[]'::jsonb;
  v_subjects jsonb:='[]'::jsonb;
  v_chapters jsonb:='[]'::jsonb;
  v_student_count int:=0;
  v_need_help int:=0;
  v_improving int:=0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select teacher_id into v_teacher from public.tests where id=p_test_id;
  if v_teacher is null or v_teacher<>v_user then raise exception 'Test owner required'; end if;

  with submitted as (
    select a.*,
      row_number() over(partition by a.student_id order by a.submitted_at asc,a.attempt_number asc) first_rn,
      row_number() over(partition by a.student_id order by a.submitted_at desc,a.attempt_number desc) latest_rn
    from public.attempts a
    where a.test_id=p_test_id and a.submitted_at is not null
  ), score_summary as (
    select student_id,
      max(score_percent)::numeric best_score,
      max(score_percent) filter(where latest_rn=1)::numeric latest_score,
      max(score_percent) filter(where first_rn=1)::numeric first_score,
      count(*)::int attempt_count,
      max(submitted_at) last_submitted_at
    from submitted group by student_id
  ), response_rows as (
    select a.student_id,a.id attempt_id,a.submitted_at,a.attempt_number,
      coalesce(nullif(trim(q.subject_category),''),nullif(trim(q.content_area),''),'General review') subject,
      q.chapter_number,
      nullif(trim(q.chapter_title),'') chapter_title,
      r.is_correct,
      dense_rank() over(partition by a.student_id order by a.submitted_at desc,a.attempt_number desc) attempt_rank
    from public.attempts a
    join public.responses r on r.attempt_id=a.id
    join public.questions q on q.id=r.question_id
    where a.test_id=p_test_id and a.submitted_at is not null
  ), subject_stats as (
    select student_id,subject,count(*)::int answered,
      round(100.0*sum(case when is_correct then 1 else 0 end)/nullif(count(*),0),1) mastery,
      round(100.0*sum(case when is_correct and attempt_rank<=2 then 1 else 0 end)/nullif(count(*) filter(where attempt_rank<=2),0),1) recent_mastery
    from response_rows group by student_id,subject
  ), chapter_stats as (
    select student_id,chapter_number,chapter_title,count(*)::int answered,
      round(100.0*sum(case when is_correct then 1 else 0 end)/nullif(count(*),0),1) mastery,
      round(100.0*sum(case when is_correct and attempt_rank<=2 then 1 else 0 end)/nullif(count(*) filter(where attempt_rank<=2),0),1) recent_mastery
    from response_rows
    where chapter_number is not null or chapter_title is not null
    group by student_id,chapter_number,chapter_title
  ), weakest_subject as (
    select distinct on(student_id) student_id,subject,mastery,recent_mastery,answered
    from subject_stats where answered>=2
    order by student_id,recent_mastery asc nulls last,mastery asc,answered desc
  ), weakest_chapter as (
    select distinct on(student_id) student_id,chapter_number,chapter_title,mastery,recent_mastery,answered
    from chapter_stats where answered>=2
    order by student_id,recent_mastery asc nulls last,mastery asc,answered desc
  ), student_rows as (
    select s.student_id,coalesce(p.full_name,'Student') student_name,s.first_score,s.latest_score,s.best_score,s.attempt_count,s.last_submitted_at,
      round(s.latest_score-s.first_score,1) change,
      ws.subject weakest_subject,ws.recent_mastery weakest_subject_mastery,
      wc.chapter_number weakest_chapter_number,wc.chapter_title weakest_chapter_title,wc.recent_mastery weakest_chapter_mastery,
      case when wc.chapter_number is not null then 'Chapter '||wc.chapter_number::text||case when wc.chapter_title is not null then ' — '||wc.chapter_title else '' end
           else wc.chapter_title end weakest_chapter,
      case when s.attempt_count<2 then 'baseline'
           when s.latest_score-s.first_score>=5 then 'improving'
           when s.latest_score-s.first_score<=-5 then 'slipping'
           else 'steady' end trend,
      case when s.latest_score<70 or coalesce(ws.recent_mastery,100)<65 or coalesce(wc.recent_mastery,100)<65 then true else false end needs_help
    from score_summary s
    left join public.profiles p on p.id=s.student_id
    left join weakest_subject ws on ws.student_id=s.student_id
    left join weakest_chapter wc on wc.student_id=s.student_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id',student_id,'student_name',student_name,'first_score',first_score,'latest_score',latest_score,'best_score',best_score,'attempt_count',attempt_count,'last_submitted_at',last_submitted_at,
    'change',change,'trend',trend,'needs_help',needs_help,
    'weakest_subject',weakest_subject,'weakest_subject_mastery',weakest_subject_mastery,
    'weakest_chapter',weakest_chapter,'weakest_chapter_number',weakest_chapter_number,'weakest_chapter_title',weakest_chapter_title,'weakest_chapter_mastery',weakest_chapter_mastery,
    'weakest_area',weakest_subject,'weakest_mastery',weakest_subject_mastery
  ) order by needs_help desc, latest_score asc, student_name),'[]'::jsonb),
  count(*)::int,
  count(*) filter(where needs_help)::int,
  count(*) filter(where trend='improving')::int
  into v_students,v_student_count,v_need_help,v_improving
  from student_rows;

  with rr as (
    select coalesce(nullif(trim(q.subject_category),''),nullif(trim(q.content_area),''),'General review') subject,r.is_correct
    from public.attempts a
    join public.responses r on r.attempt_id=a.id
    join public.questions q on q.id=r.question_id
    where a.test_id=p_test_id and a.submitted_at is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('subject',subject,'area',subject,'mastery',mastery,'answered',answered) order by mastery asc,answered desc),'[]'::jsonb)
  into v_subjects
  from (
    select subject,count(*)::int answered,round(100.0*sum(case when is_correct then 1 else 0 end)/nullif(count(*),0),1) mastery
    from rr group by subject
  ) x;

  with rr as (
    select q.chapter_number,nullif(trim(q.chapter_title),'') chapter_title,r.is_correct
    from public.attempts a
    join public.responses r on r.attempt_id=a.id
    join public.questions q on q.id=r.question_id
    where a.test_id=p_test_id and a.submitted_at is not null
      and (q.chapter_number is not null or nullif(trim(q.chapter_title),'') is not null)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'chapter_number',chapter_number,'chapter_title',chapter_title,
    'chapter',case when chapter_number is not null then 'Chapter '||chapter_number::text||case when chapter_title is not null then ' — '||chapter_title else '' end else chapter_title end,
    'mastery',mastery,'answered',answered
  ) order by mastery asc,answered desc),'[]'::jsonb)
  into v_chapters
  from (
    select chapter_number,chapter_title,count(*)::int answered,
      round(100.0*sum(case when is_correct then 1 else 0 end)/nullif(count(*),0),1) mastery
    from rr group by chapter_number,chapter_title
  ) x;

  return jsonb_build_object(
    'test_id',p_test_id,
    'student_count',v_student_count,
    'needs_help_count',v_need_help,
    'improving_count',v_improving,
    'students',v_students,
    'subjects',v_subjects,
    'chapters',v_chapters,
    'areas',v_subjects
  );
end;
$function$;
