alter table public.profiles add column if not exists teacher_approved boolean not null default false;
alter table public.profiles add column if not exists teacher_can_invite boolean not null default false;

create table if not exists public.teacher_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '7 days'),
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  check (expires_at > created_at)
);
alter table public.teacher_invites enable row level security;

create policy "approved teachers manage own invites" on public.teacher_invites for all to authenticated
using (created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher' and p.teacher_approved and p.teacher_can_invite))
with check (created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher' and p.teacher_approved and p.teacher_can_invite));

create or replace function public.create_teacher_invite()
returns text language plpgsql security definer set search_path='' as $$
declare v_code text;
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher' and p.teacher_approved and p.teacher_can_invite) then raise exception 'Teacher invite permission required'; end if;
  insert into public.teacher_invites(created_by) values(auth.uid()) returning code into v_code;
  return v_code;
end;$$;
grant execute on function public.create_teacher_invite() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_requested_teacher boolean := coalesce(new.raw_user_meta_data->>'requested_role','')='teacher';
  v_invite text := upper(trim(coalesce(new.raw_user_meta_data->>'teacher_invite','')));
  v_approved boolean := false;
  v_creator uuid;
begin
  if v_requested_teacher and v_invite<>'' then
    select ti.created_by into v_creator
      from public.teacher_invites ti
      join public.profiles p on p.id=ti.created_by and p.role='teacher' and p.teacher_approved and p.teacher_can_invite
     where ti.code=v_invite and ti.used_by is null and ti.expires_at>now()
     for update of ti;
    v_approved := v_creator is not null;
  end if;

  insert into public.profiles(id,full_name,role,teacher_approved,teacher_can_invite)
  values(new.id,nullif(trim(new.raw_user_meta_data->>'full_name'),''),
    case when v_requested_teacher and v_approved then 'teacher'::public.user_role else 'student'::public.user_role end,
    v_requested_teacher and v_approved,
    false);

  if v_requested_teacher and v_approved then
    update public.teacher_invites set used_by=new.id,used_at=now() where code=v_invite and used_by is null;
  end if;
  return new;
end;$$;

-- Production also tightens teacher-owned test/question/question-bank RLS policies so only approved teachers may mutate teacher content.
