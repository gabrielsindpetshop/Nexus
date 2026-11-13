-- Shared NEXUS workspace records. Only users explicitly added to nexus_members
-- can access data; the app does not permit public self-registration.
create table if not exists public.nexus_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create table if not exists public.nexus_records (
  id uuid primary key,
  entity text not null check (entity in ('opportunities', 'ideas', 'evaluations', 'projects', 'research', 'knowledge')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nexus_records_entity_updated_at_idx
  on public.nexus_records (entity, updated_at desc);
create index if not exists nexus_records_created_by_idx
  on public.nexus_records (created_by);

alter table public.nexus_members enable row level security;
alter table public.nexus_records enable row level security;

revoke all on table public.nexus_members from anon, authenticated;
grant select on table public.nexus_members to authenticated;

revoke all on table public.nexus_records from anon, authenticated;
grant select, insert, update, delete on table public.nexus_records to authenticated;

drop policy if exists "Members can read their own membership" on public.nexus_members;
create policy "Members can read their own membership"
  on public.nexus_members for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "NEXUS members can read workspace records" on public.nexus_records;
create policy "NEXUS members can read workspace records"
  on public.nexus_records for select to authenticated
  using (exists (
    select 1 from public.nexus_members m where m.user_id = (select auth.uid())
  ));

drop policy if exists "NEXUS members can create workspace records" on public.nexus_records;
create policy "NEXUS members can create workspace records"
  on public.nexus_records for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.nexus_members m where m.user_id = (select auth.uid()))
  );

drop policy if exists "NEXUS members can update workspace records" on public.nexus_records;
create policy "NEXUS members can update workspace records"
  on public.nexus_records for update to authenticated
  using (exists (
    select 1 from public.nexus_members m where m.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.nexus_members m where m.user_id = (select auth.uid())
  ));

drop policy if exists "NEXUS members can delete workspace records" on public.nexus_records;
create policy "NEXUS members can delete workspace records"
  on public.nexus_records for delete to authenticated
  using (exists (
    select 1 from public.nexus_members m where m.user_id = (select auth.uid())
  ));
