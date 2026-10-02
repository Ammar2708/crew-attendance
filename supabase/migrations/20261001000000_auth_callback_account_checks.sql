create table public.auth_callback_account_checks (
  token_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

alter table public.auth_callback_account_checks enable row level security;

revoke all on table public.auth_callback_account_checks from anon, authenticated;

create or replace function public.is_auth_callback_account_set_up(account_check_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.auth_callback_account_checks as account_check
    join auth.users as auth_user on auth_user.id = account_check.user_id
    where account_check.token_hash = encode(
      extensions.digest(convert_to(account_check_token, 'UTF8'), 'sha256'),
      'hex'
    )
      and account_check.expires_at > now()
      and (
        auth_user.email_confirmed_at is not null
        or nullif(auth_user.encrypted_password, '') is not null
      )
  );
$$;

revoke all on function public.is_auth_callback_account_set_up(text) from public;
grant execute on function public.is_auth_callback_account_set_up(text) to anon, authenticated;
