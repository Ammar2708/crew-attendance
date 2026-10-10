begin;

alter table public.task_photos
  add column captured_at timestamptz not null default now();

commit;
