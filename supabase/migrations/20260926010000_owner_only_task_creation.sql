begin;

-- Task assignment is an owner operation. Employees can still update tasks
-- assigned to them (for example, marking a task completed with photo proof).
drop policy if exists "tasks_insert_assigned_or_owner" on public.tasks;

create policy "tasks_insert_owner_only"
on public.tasks
for insert
to authenticated
with check (
  public.is_owner()
  and assigned_by = (select auth.uid())
);

commit;
