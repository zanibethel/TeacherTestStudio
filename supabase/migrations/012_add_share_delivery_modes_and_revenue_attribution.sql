alter table public.test_shares
  add column if not exists delivery_mode text not null default 'standard',
  add column if not exists restricted_mode boolean not null default false,
  add column if not exists teacher_revenue_share_bps integer not null default 0;

alter table public.test_shares drop constraint if exists test_shares_delivery_mode_check;
alter table public.test_shares add constraint test_shares_delivery_mode_check
  check (delivery_mode in ('standard','restricted','study','paid_pass'));

alter table public.test_shares drop constraint if exists test_shares_teacher_revenue_share_bps_check;
alter table public.test_shares add constraint test_shares_teacher_revenue_share_bps_check
  check (teacher_revenue_share_bps between 0 and 10000);

comment on column public.test_shares.delivery_mode is 'Teacher-facing share preset: standard, restricted, study, or paid_pass.';
comment on column public.test_shares.restricted_mode is 'Whether this share should enforce the test restricted/strict delivery experience.';
comment on column public.test_shares.teacher_revenue_share_bps is 'Platform-controlled teacher share of paid pass revenue in basis points. Not teacher editable.';

create or replace function public.resolve_test_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
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
  return jsonb_build_object(
    'share_id',v_share.id,'test_id',v_test.id,'title',v_test.title,'description',v_test.description,
    'access_mode',v_share.access_mode,'delivery_mode',v_share.delivery_mode,'restricted_mode',v_share.restricted_mode,
    'payment_mode',v_share.payment_mode,'max_attempts',v_share.max_attempts,
    'access_duration_days',v_share.access_duration_days,'study_guide_enabled',v_share.study_guide_enabled,
    'price_cents',v_share.price_cents,'link_expires_at',v_share.link_expires_at,
    'entitlement_status',v_ent.status,'entitlement_expires_at',v_ent.expires_at
  );
end;$$;
