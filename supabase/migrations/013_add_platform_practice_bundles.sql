-- Platform-owned practice bundles group shared collections into student-facing pass products.
-- Operational catalog seed data (including bundle membership) is managed in Supabase and is not stored here.

create table if not exists public.practice_bundles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  subject text not null,
  catalog_scope text not null default 'platform' check (catalog_scope in ('platform','teacher')),
  owner_teacher_id uuid references public.profiles(id) on delete cascade,
  pass_duration_days integer not null default 14 check (pass_duration_days between 1 and 365),
  price_cents integer check (price_cents is null or price_cents >= 0),
  free_preview_enabled boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((catalog_scope='platform' and owner_teacher_id is null) or (catalog_scope='teacher' and owner_teacher_id is not null))
);

create table if not exists public.practice_bundle_collections (
  bundle_id uuid not null references public.practice_bundles(id) on delete cascade,
  collection_id uuid not null references public.shared_collections(id) on delete cascade,
  position integer not null default 1 check (position > 0),
  is_free_preview boolean not null default false,
  primary key(bundle_id,collection_id)
);

create table if not exists public.practice_bundle_entitlements (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.practice_bundles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','paid','comped','revoked','expired')),
  activated_at timestamptz,
  expires_at timestamptz,
  amount_paid_cents integer check (amount_paid_cents is null or amount_paid_cents >= 0),
  payment_reference text,
  created_at timestamptz not null default now(),
  unique(bundle_id,student_id)
);

alter table public.practice_sessions add column if not exists source_bundle_id uuid references public.practice_bundles(id) on delete set null;
alter table public.practice_sessions add column if not exists source_collection_id uuid references public.shared_collections(id) on delete set null;

create index if not exists practice_bundles_catalog_idx on public.practice_bundles(catalog_scope,active,subject);
create index if not exists practice_bundle_entitlements_student_idx on public.practice_bundle_entitlements(student_id,status,expires_at);

alter table public.practice_bundles enable row level security;
alter table public.practice_bundle_collections enable row level security;
alter table public.practice_bundle_entitlements enable row level security;

grant select on public.practice_bundles to authenticated;
grant select on public.practice_bundle_collections to authenticated;
grant select on public.practice_bundle_entitlements to authenticated;

create policy practice_bundles_authenticated_read on public.practice_bundles for select to authenticated using (active=true and (catalog_scope='platform' or owner_teacher_id=auth.uid()));
create policy practice_bundle_collections_authenticated_read on public.practice_bundle_collections for select to authenticated using (exists(select 1 from public.practice_bundles b where b.id=bundle_id and b.active=true and (b.catalog_scope='platform' or b.owner_teacher_id=auth.uid())));
create policy practice_bundle_entitlements_own_read on public.practice_bundle_entitlements for select to authenticated using (student_id=auth.uid());

-- RPC implementations are applied to hosted Supabase in production and enforce student-only bundle selection,
-- pass-scoped access, free-preview access, randomized delivery, and server-side answer protection.
