begin;

create extension if not exists pgcrypto with schema extensions;

-- An employee's id is the same UUID as their Supabase Auth user id.
create table public.employees (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text not null,
  role text not null check (role in ('employee', 'owner')),
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  clock_in_time timestamptz not null,
  clock_in_lat double precision not null,
  clock_in_lng double precision not null,
  clock_out_time timestamptz,
  clock_out_lat double precision,
  clock_out_lng double precision,
  date date not null
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  site_address text not null,
  assigned_to uuid not null references public.employees (id),
  assigned_by uuid not null references public.employees (id),
  status text not null,
  due_date date,
  created_at timestamptz not null default now()
);

create table public.task_photos (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  photo_url text not null,
  uploaded_at timestamptz not null default now()
);

create index attendance_employee_id_idx
  on public.attendance (employee_id);
create index attendance_employee_date_idx
  on public.attendance (employee_id, date);
create index tasks_assigned_to_idx
  on public.tasks (assigned_to);
create index tasks_assigned_by_idx
  on public.tasks (assigned_by);
create index task_photos_task_id_idx
  on public.task_photos (task_id);

-- SECURITY DEFINER avoids recursive RLS checks against employees while an
-- employees policy is itself being evaluated. The blank search path prevents
-- object-shadowing attacks; all referenced objects are schema-qualified.
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
  );
$$;

create or replace function public.can_access_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_owner()
    or exists (
      select 1
      from public.tasks as t
      where t.id = target_task_id
        and t.assigned_to = (select auth.uid())
    );
$$;

-- Storage task-photo objects must use: <task-id>/<file-name>.
create or replace function public.can_access_task_photo_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  task_id_segment text := pg_catalog.split_part(object_name, '/', 1);
begin
  if task_id_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return public.can_access_task(task_id_segment::uuid);
  end if;

  return false;
end;
$$;

revoke all on function public.is_owner() from public;
revoke all on function public.can_access_task(uuid) from public;
revoke all on function public.can_access_task_photo_path(text) from public;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.can_access_task(uuid) to authenticated;
grant execute on function public.can_access_task_photo_path(text) to authenticated;

alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.tasks enable row level security;
alter table public.task_photos enable row level security;

revoke all on table public.employees from anon, authenticated;
revoke all on table public.attendance from anon, authenticated;
revoke all on table public.tasks from anon, authenticated;
revoke all on table public.task_photos from anon, authenticated;

grant select, insert, update, delete on table public.employees to authenticated;
grant select, insert, update, delete on table public.attendance to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.task_photos to authenticated;

-- Employees can manage their own profile. A non-owner can never set their own
-- role to owner; create/promote the first owner from trusted server-side SQL.
create policy "employees_select_own_or_owner"
on public.employees
for select
to authenticated
using (
  id = (select auth.uid())
  or public.is_owner()
);

create policy "employees_insert_own_or_owner"
on public.employees
for insert
to authenticated
with check (
  public.is_owner()
  or (
    id = (select auth.uid())
    and role = 'employee'
  )
);

create policy "employees_update_own_or_owner"
on public.employees
for update
to authenticated
using (
  id = (select auth.uid())
  or public.is_owner()
)
with check (
  public.is_owner()
  or (
    id = (select auth.uid())
    and role = 'employee'
  )
);

create policy "employees_delete_own_or_owner"
on public.employees
for delete
to authenticated
using (
  id = (select auth.uid())
  or public.is_owner()
);

create policy "attendance_select_own_or_owner"
on public.attendance
for select
to authenticated
using (
  employee_id = (select auth.uid())
  or public.is_owner()
);

create policy "attendance_insert_own_or_owner"
on public.attendance
for insert
to authenticated
with check (
  employee_id = (select auth.uid())
  or public.is_owner()
);

create policy "attendance_update_own_or_owner"
on public.attendance
for update
to authenticated
using (
  employee_id = (select auth.uid())
  or public.is_owner()
)
with check (
  employee_id = (select auth.uid())
  or public.is_owner()
);

create policy "attendance_delete_own_or_owner"
on public.attendance
for delete
to authenticated
using (
  employee_id = (select auth.uid())
  or public.is_owner()
);

create policy "tasks_select_assigned_or_owner"
on public.tasks
for select
to authenticated
using (
  assigned_to = (select auth.uid())
  or public.is_owner()
);

create policy "tasks_insert_assigned_or_owner"
on public.tasks
for insert
to authenticated
with check (
  assigned_to = (select auth.uid())
  or public.is_owner()
);

create policy "tasks_update_assigned_or_owner"
on public.tasks
for update
to authenticated
using (
  assigned_to = (select auth.uid())
  or public.is_owner()
)
with check (
  assigned_to = (select auth.uid())
  or public.is_owner()
);

create policy "tasks_delete_assigned_or_owner"
on public.tasks
for delete
to authenticated
using (
  assigned_to = (select auth.uid())
  or public.is_owner()
);

create policy "task_photos_select_assigned_or_owner"
on public.task_photos
for select
to authenticated
using (public.can_access_task(task_id));

create policy "task_photos_insert_assigned_or_owner"
on public.task_photos
for insert
to authenticated
with check (public.can_access_task(task_id));

create policy "task_photos_update_assigned_or_owner"
on public.task_photos
for update
to authenticated
using (public.can_access_task(task_id))
with check (public.can_access_task(task_id));

create policy "task_photos_delete_assigned_or_owner"
on public.task_photos
for delete
to authenticated
using (public.can_access_task(task_id));

-- Private buckets: files are served only when storage.objects RLS allows it.
insert into storage.buckets (id, name, public)
values
  ('task-photos', 'task-photos', false),
  ('employee-photos', 'employee-photos', false)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

create policy "task_photos_storage_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-photos'
  and public.can_access_task_photo_path(name)
);

create policy "task_photos_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-photos'
  and public.can_access_task_photo_path(name)
);

create policy "task_photos_storage_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'task-photos'
  and public.can_access_task_photo_path(name)
)
with check (
  bucket_id = 'task-photos'
  and public.can_access_task_photo_path(name)
);

create policy "task_photos_storage_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-photos'
  and public.can_access_task_photo_path(name)
);

create policy "employee_photos_storage_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'employee-photos'
  and (
    pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
    or public.is_owner()
  )
);

create policy "employee_photos_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'employee-photos'
  and (
    pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
    or public.is_owner()
  )
);

create policy "employee_photos_storage_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'employee-photos'
  and (
    pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
    or public.is_owner()
  )
)
with check (
  bucket_id = 'employee-photos'
  and (
    pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
    or public.is_owner()
  )
);

create policy "employee_photos_storage_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'employee-photos'
  and (
    pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
    or public.is_owner()
  )
);

-- Bootstrap the first owner from the Supabase SQL editor after that Auth user
-- exists. SQL editor/service-role operations bypass these client RLS policies:
--
-- insert into public.employees (id, full_name, phone, role)
-- values ('AUTH-USER-UUID', 'Owner Name', '+0000000000', 'owner');

commit;
