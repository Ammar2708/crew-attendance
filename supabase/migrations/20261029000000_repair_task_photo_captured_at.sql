begin;

-- Repair databases where the original captured_at migration was skipped or
-- recorded as applied while the column was missing.
alter table public.task_photos
  add column if not exists captured_at timestamptz not null default now();

commit;
