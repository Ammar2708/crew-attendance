begin;

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.employees (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now()
);

create index push_tokens_user_id_idx
  on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

revoke all on table public.push_tokens from anon, authenticated;
grant select, insert, delete on table public.push_tokens to authenticated;

create policy "push_tokens_select_own"
on public.push_tokens
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "push_tokens_insert_own"
on public.push_tokens
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "push_tokens_delete_own"
on public.push_tokens
for delete
to authenticated
using (user_id = (select auth.uid()));

commit;
