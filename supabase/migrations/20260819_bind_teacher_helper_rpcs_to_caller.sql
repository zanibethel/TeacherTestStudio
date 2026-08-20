-- Bind teacher-only helper RPCs to the authenticated caller so signed-in users
-- cannot probe another teacher's approval, plan, or feature-access state.

create or replace function public.is_approved_teacher(p_teacher_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path to ''
as $function$
  select auth.uid() is not null
    and p_teacher_id = auth.uid()
    and exists(
      select 1 from public.profiles p
      where p.id=auth.uid() and p.role='teacher' and p.teacher_approved=true
    );
$function$;

create or replace function public.teacher_can_sell_access(p_teacher_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path to ''
as $function$
  select auth.uid() is not null
    and p_teacher_id = auth.uid()
    and exists(
      select 1
      from public.profiles p
      where p.id=auth.uid()
        and p.role='teacher'
        and p.teacher_approved=true
        and p.teacher_plan='pro'
        and (p.teacher_plan_expires_at is null or p.teacher_plan_expires_at>now())
    );
$function$;

create or replace function public.teacher_feature_access(p_teacher_id uuid default auth.uid())
returns jsonb
language sql
security definer
set search_path to ''
as $function$
  select case
    when auth.uid() is null or p_teacher_id <> auth.uid() then null
    else jsonb_build_object(
      'approved_teacher', coalesce(p.role='teacher' and p.teacher_approved,false),
      'classroom_tests', coalesce(p.role='teacher' and p.teacher_approved,false),
      'standard_sharing', coalesce(p.role='teacher' and p.teacher_approved,false),
      'restricted_mode', coalesce(p.role='teacher' and p.teacher_approved,false),
      'study_mode', coalesce(p.role='teacher' and p.teacher_approved,false),
      'rosters_and_groups', coalesce(p.role='teacher' and p.teacher_approved,false),
      'reports', coalesce(p.role='teacher' and p.teacher_approved,false),
      'can_sell_access', public.teacher_can_sell_access(auth.uid()),
      'plan', coalesce(p.teacher_plan,'free'),
      'plan_expires_at', p.teacher_plan_expires_at
    )
  end
  from public.profiles p
  where p.id=auth.uid();
$function$;
