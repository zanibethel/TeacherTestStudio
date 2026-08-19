alter table public.tests add column if not exists study_guide_enabled boolean not null default true;

create table if not exists public.test_shares (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  label text,
  access_mode text not null default 'classroom' check (access_mode in ('classroom','practice_pass')),
  payment_mode text not null default 'free' check (payment_mode in ('free','paid')),
  max_attempts integer check (max_attempts is null or max_attempts >= 1),
  access_duration_days integer check (access_duration_days is null or access_duration_days >= 1),
  study_guide_enabled boolean not null default true,
  link_expires_at timestamptz,
  price_cents integer check (price_cents is null or price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payment_mode <> 'paid' or coalesce(price_cents,0) > 0)
);

create index if not exists test_shares_teacher_idx on public.test_shares(teacher_id,created_at desc);
create index if not exists test_shares_test_idx on public.test_shares(test_id,created_at desc);

create table if not exists public.share_entitlements (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.test_shares(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'free' check (status in ('free','pending','paid','comped','revoked')),
  activated_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(share_id,student_id)
);
create index if not exists share_entitlements_student_idx on public.share_entitlements(student_id,expires_at);

alter table public.attempts add column if not exists share_id uuid references public.test_shares(id) on delete set null;
create index if not exists attempts_share_idx on public.attempts(share_id,student_id,submitted_at);

alter table public.test_shares enable row level security;
alter table public.share_entitlements enable row level security;

drop policy if exists "teachers manage own shares" on public.test_shares;
create policy "teachers manage own shares" on public.test_shares for all to authenticated
using (teacher_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher' and p.teacher_approved=true))
with check (teacher_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher' and p.teacher_approved=true));

drop policy if exists "students read own share entitlements" on public.share_entitlements;
create policy "students read own share entitlements" on public.share_entitlements for select to authenticated using (student_id=auth.uid());

drop policy if exists "teachers read entitlements for own shares" on public.share_entitlements;
create policy "teachers read entitlements for own shares" on public.share_entitlements for select to authenticated
using (exists(select 1 from public.test_shares s where s.id=share_id and s.teacher_id=auth.uid()));

create or replace function public.resolve_test_share(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_share public.test_shares%rowtype; v_test public.tests%rowtype; v_ent public.share_entitlements%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles where id=v_user and role='student') then raise exception 'Student account required'; end if;
  select * into v_share from public.test_shares where token=upper(trim(p_token)) and active=true;
  if not found then raise exception 'Share link unavailable'; end if;
  if v_share.link_expires_at is not null and now()>v_share.link_expires_at then raise exception 'This share link has expired'; end if;
  select * into v_test from public.tests where id=v_share.test_id and status='published';
  if not found then raise exception 'Test unavailable'; end if;
  select * into v_ent from public.share_entitlements where share_id=v_share.id and student_id=v_user;
  return jsonb_build_object('share_id',v_share.id,'test_id',v_test.id,'title',v_test.title,'description',v_test.description,'access_mode',v_share.access_mode,'payment_mode',v_share.payment_mode,'max_attempts',v_share.max_attempts,'access_duration_days',v_share.access_duration_days,'study_guide_enabled',v_share.study_guide_enabled,'price_cents',v_share.price_cents,'link_expires_at',v_share.link_expires_at,'entitlement_status',v_ent.status,'entitlement_expires_at',v_ent.expires_at);
end;$$;
grant execute on function public.resolve_test_share(text) to authenticated;

create or replace function public.start_shared_test_attempt(p_share_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_share public.test_shares%rowtype; v_test public.tests%rowtype; v_ent public.share_entitlements%rowtype; v_attempt uuid; v_count int; v_number int;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles where id=v_user and role='student') then raise exception 'Student account required'; end if;
  select * into v_share from public.test_shares where token=upper(trim(p_share_token)) and active=true;
  if not found then raise exception 'Share link unavailable'; end if;
  if v_share.link_expires_at is not null and now()>v_share.link_expires_at then raise exception 'This share link has expired'; end if;
  select * into v_test from public.tests where id=v_share.test_id and status='published';
  if not found then raise exception 'Test unavailable'; end if;
  select * into v_ent from public.share_entitlements where share_id=v_share.id and student_id=v_user;
  if v_share.payment_mode='paid' then
    if v_ent.id is null or v_ent.status not in ('paid','comped') then raise exception 'Payment required for this practice pass'; end if;
  elsif v_share.access_mode='practice_pass' and v_ent.id is null then
    insert into public.share_entitlements(share_id,student_id,status,activated_at,expires_at)
    values(v_share.id,v_user,'free',now(),case when v_share.access_duration_days is null then null else now()+make_interval(days=>v_share.access_duration_days) end)
    returning * into v_ent;
  end if;
  if v_ent.id is not null and v_ent.status='revoked' then raise exception 'Access has been revoked'; end if;
  if v_ent.id is not null and v_ent.expires_at is not null and now()>v_ent.expires_at then raise exception 'Your practice pass has expired'; end if;
  select id into v_attempt from public.attempts where test_id=v_test.id and student_id=v_user and share_id=v_share.id and submitted_at is null order by started_at desc limit 1;
  if v_attempt is not null then
    if v_test.allow_save_resume then return v_attempt; end if;
    raise exception 'You already have an attempt in progress';
  end if;
  select count(*) into v_count from public.attempts where share_id=v_share.id and student_id=v_user and submitted_at is not null;
  if v_share.max_attempts is not null and v_count>=v_share.max_attempts then raise exception 'No attempts remaining for this share'; end if;
  v_number:=v_count+1;
  insert into public.attempts(test_id,student_id,attempt_number,deadline_at,share_id)
  values(v_test.id,v_user,v_number,case when v_test.duration_minutes>0 then now()+make_interval(mins=>v_test.duration_minutes) else null end,v_share.id)
  returning id into v_attempt;
  return v_attempt;
end;$$;
grant execute on function public.start_shared_test_attempt(text) to authenticated;
