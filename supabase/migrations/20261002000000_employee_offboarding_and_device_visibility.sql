begin;

-- Existing installations already have employees.is_active from the initial
-- migration. Keep this migration safe for installations created from an older
-- schema that may not have included it.
alter table public.employees
  add column if not exists is_active boolean not null default true;

alter table public.push_tokens
  add column if not exists last_seen_at timestamptz;

update public.push_tokens
set last_seen_at = created_at
where last_seen_at is null;

alter table public.push_tokens
  alter column last_seen_at set default now(),
  alter column last_seen_at set not null;

create index if not exists push_tokens_user_last_seen_idx
  on public.push_tokens (user_id, last_seen_at desc);

-- This helper is used by restrictive policies so an offboarded employee loses
-- database access even if a previously issued access token has not expired yet.
create or replace function public.is_active_employee()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees as e
    where e.id = (select auth.uid())
      and e.is_active
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees as e
    where e.id = (select auth.uid())
      and e.role = 'owner'
      and e.is_active
  );
$$;

create or replace function public.can_access_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_employee()
    and (
      public.is_owner()
      or exists (
        select 1
        from public.tasks as t
        where t.id = target_task_id
          and t.assigned_to = (select auth.uid())
      )
    );
$$;

revoke all on function public.is_active_employee() from public;
grant execute on function public.is_active_employee() to authenticated;

-- Restrictive policies are ANDed with the existing per-table policies. This
-- keeps all current owner/employee rules while denying every inactive account.
create policy "active_accounts_only"
on public.employees
as restrictive
for all
to authenticated
using (public.is_active_employee())
with check (public.is_active_employee());

create policy "active_accounts_only"
on public.attendance
as restrictive
for all
to authenticated
using (public.is_active_employee())
with check (public.is_active_employee());

create policy "active_accounts_only"
on public.tasks
as restrictive
for all
to authenticated
using (public.is_active_employee())
with check (public.is_active_employee());

create policy "active_accounts_only"
on public.task_photos
as restrictive
for all
to authenticated
using (public.is_active_employee())
with check (public.is_active_employee());

create policy "active_accounts_only"
on public.push_tokens
as restrictive
for all
to authenticated
using (public.is_active_employee())
with check (public.is_active_employee());

create policy "active_accounts_only_for_crew_buckets"
on storage.objects
as restrictive
for all
to authenticated
using (
  bucket_id not in ('task-photos', 'employee-photos')
  or public.is_active_employee()
)
with check (
  bucket_id not in ('task-photos', 'employee-photos')
  or public.is_active_employee()
);

-- Owners can inspect device registrations. Employees retain access only to
-- their own tokens and can refresh last_seen_at for their current device.
drop policy if exists "push_tokens_select_own" on public.push_tokens;
create policy "push_tokens_select_own_or_owner"
on public.push_tokens
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_owner()
);

grant update on table public.push_tokens to authenticated;

create policy "push_tokens_update_own"
on public.push_tokens
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

commit;
