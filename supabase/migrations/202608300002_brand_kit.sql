-- Ticket #3: one private, user-owned visual identity per founder.
create table if not exists public.brand_kits (
  user_id uuid primary key references public.users (id) on delete cascade,
  display_name text not null default '',
  handle text not null default '',
  headshot_path text,
  logo_path text,
  primary_color text not null default '#173f34',
  secondary_color text not null default '#d9613f',
  font text not null default 'Inter'
    check (font in ('Inter', 'Manrope', 'Newsreader', 'Space Grotesk')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  check (secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);

alter table public.brand_kits enable row level security;

create policy "users can read their own brand kit"
  on public.brand_kits for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can insert their own brand kit"
  on public.brand_kits for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can update their own brand kit"
  on public.brand_kits for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger brand_kits_set_updated_at
  before update on public.brand_kits
  for each row execute procedure public.set_updated_at();

grant select, insert, update on public.brand_kits to authenticated;

-- The meter is empty until later slices record provider calls, but is durable
-- now so the Settings screen always reads the same user-owned source of truth.
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  pack_id uuid,
  operation text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  characters integer not null default 0 check (characters >= 0),
  cost_cents integer not null default 0 check (cost_cents >= 0),
  created_at timestamptz not null default now()
);

create index usage_events_user_id_created_at_idx
  on public.usage_events (user_id, created_at desc);

alter table public.usage_events enable row level security;

create policy "users can read their own usage"
  on public.usage_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.usage_events to authenticated;

-- Objects remain private. Their first folder is an authenticated user's UUID,
-- so direct storage operations and signed URL creation cannot cross accounts.
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', false)
on conflict (id) do update set public = false;

create policy "users can read their own brand assets"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "users can upload their own brand assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "users can replace their own brand assets"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "users can delete their own brand assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
