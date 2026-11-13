-- Keep NEXUS uploads private. Access is limited to authenticated workspace members.
insert into storage.buckets (id, name, public, file_size_limit)
values ('nexus-attachments', 'nexus-attachments', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "NEXUS members can read attachments" on storage.objects;
create policy "NEXUS members can read attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'nexus-attachments'
    and exists (
      select 1 from public.nexus_members m
      where m.user_id = (select auth.uid())
    )
  );

drop policy if exists "NEXUS members can upload attachments" on storage.objects;
create policy "NEXUS members can upload attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'nexus-attachments'
    and exists (
      select 1 from public.nexus_members m
      where m.user_id = (select auth.uid())
    )
  );

drop policy if exists "NEXUS members can update attachments" on storage.objects;
create policy "NEXUS members can update attachments"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'nexus-attachments'
    and exists (
      select 1 from public.nexus_members m
      where m.user_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'nexus-attachments'
    and exists (
      select 1 from public.nexus_members m
      where m.user_id = (select auth.uid())
    )
  );

drop policy if exists "NEXUS members can delete attachments" on storage.objects;
create policy "NEXUS members can delete attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'nexus-attachments'
    and exists (
      select 1 from public.nexus_members m
      where m.user_id = (select auth.uid())
    )
  );
