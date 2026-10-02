begin;

alter table public.task_photos
  add column source text not null default 'camera'
  constraint task_photos_source_check check (source in ('camera', 'gallery'));

commit;
