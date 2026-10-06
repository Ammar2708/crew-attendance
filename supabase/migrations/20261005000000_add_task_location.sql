begin;

alter table public.tasks
  add column site_lat double precision,
  add column site_lng double precision,
  add constraint tasks_site_coordinates_pair_check check (
    (site_lat is null and site_lng is null)
    or
    (
      site_lat is not null
      and site_lng is not null
      and site_lat between -90 and 90
      and site_lng between -180 and 180
    )
  );

comment on column public.tasks.site_lat is 'Latitude selected for the task site when the task is assigned.';
comment on column public.tasks.site_lng is 'Longitude selected for the task site when the task is assigned.';

commit;
