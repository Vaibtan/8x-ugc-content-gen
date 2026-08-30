-- Ticket #7: durable content-pack state. A pack is created before generation
-- begins, so a refresh can reconnect to the same idempotent request.
create table if not exists public.packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  idea text not null check (char_length(idea) between 1 and 4000),
  pillar text not null check (char_length(pillar) between 1 and 160),
  goal text not null check (goal in ('reach', 'leads')),
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'posted', 'winner')),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 160),
  content_json jsonb,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index packs_user_id_updated_at_idx
  on public.packs (user_id, updated_at desc);

alter table public.packs enable row level security;

create policy "users can read their own packs"
  on public.packs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can insert their own packs"
  on public.packs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can update their own packs"
  on public.packs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.packs to authenticated;

create trigger packs_set_updated_at
  before update on public.packs
  for each row execute procedure public.set_updated_at();

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.packs (id) on delete cascade,
  type text not null check (type in ('post', 'carousel', 'video', 'newsletter', 'magnet')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed')),
  content_json jsonb,
  file_url text,
  error text,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pack_id, type)
);

create index assets_pack_id_idx on public.assets (pack_id);

alter table public.assets enable row level security;

create policy "users can read their own pack assets"
  on public.assets for select to authenticated
  using (
    exists (
      select 1 from public.packs
      where packs.id = assets.pack_id and packs.user_id = (select auth.uid())
    )
  );

create policy "users can insert their own pack assets"
  on public.assets for insert to authenticated
  with check (
    exists (
      select 1 from public.packs
      where packs.id = assets.pack_id and packs.user_id = (select auth.uid())
    )
  );

create policy "users can update their own pack assets"
  on public.assets for update to authenticated
  using (
    exists (
      select 1 from public.packs
      where packs.id = assets.pack_id and packs.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.packs
      where packs.id = assets.pack_id and packs.user_id = (select auth.uid())
    )
  );

grant select, insert, update on public.assets to authenticated;

create trigger assets_set_updated_at
  before update on public.assets
  for each row execute procedure public.set_updated_at();

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.packs (id) on delete cascade,
  asset_id uuid references public.assets (id) on delete cascade,
  type text not null check (type in ('generate-pack-text', 'render-carousel', 'render-video', 'render-magnet')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed')),
  idempotency_key text not null unique,
  attempt integer not null default 0 check (attempt >= 0),
  error text,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_pack_id_status_idx on public.jobs (pack_id, status);

alter table public.jobs enable row level security;

create policy "users can read their own pack jobs"
  on public.jobs for select to authenticated
  using (
    exists (
      select 1 from public.packs
      where packs.id = jobs.pack_id and packs.user_id = (select auth.uid())
    )
  );

create policy "users can insert their own pack jobs"
  on public.jobs for insert to authenticated
  with check (
    exists (
      select 1 from public.packs
      where packs.id = jobs.pack_id and packs.user_id = (select auth.uid())
    )
  );

create policy "users can update their own pack jobs"
  on public.jobs for update to authenticated
  using (
    exists (
      select 1 from public.packs
      where packs.id = jobs.pack_id and packs.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.packs
      where packs.id = jobs.pack_id and packs.user_id = (select auth.uid())
    )
  );

grant select, insert, update on public.jobs to authenticated;

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute procedure public.set_updated_at();

alter table public.usage_events
  add constraint usage_events_pack_id_fkey
  foreign key (pack_id) references public.packs (id) on delete set null;

-- Provider-backed workers use the service-role repository. End users can read
-- their meter but never forge a usage event.
