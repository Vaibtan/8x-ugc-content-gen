-- Ticket #8: text assets retain every generic, automatic, and founder-steered
-- rewrite. The current asset payload stays quick to render while this table
-- supplies an auditable, reversible history for the comparison UI.
create table if not exists public.asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  version integer not null check (version > 0),
  action text not null check (
    action in (
      'generic',
      'voice-pass',
      'more-like-my-voice',
      'punchier-hook',
      'shorter'
    )
  ),
  content text not null check (char_length(content) > 0),
  fidelity_score integer check (
    fidelity_score is null or fidelity_score between 0 and 100
  ),
  diff_notes jsonb not null default '[]'::jsonb check (jsonb_typeof(diff_notes) = 'array'),
  created_at timestamptz not null default now(),
  unique (asset_id, version)
);

create index asset_versions_asset_id_version_idx
  on public.asset_versions (asset_id, version);

alter table public.asset_versions enable row level security;

create policy "users can read their own asset versions"
  on public.asset_versions for select to authenticated
  using (
    exists (
      select 1
      from public.assets
      join public.packs on packs.id = assets.pack_id
      where assets.id = asset_versions.asset_id
        and packs.user_id = (select auth.uid())
    )
  );

create policy "users can create versions for their own assets"
  on public.asset_versions for insert to authenticated
  with check (
    exists (
      select 1
      from public.assets
      join public.packs on packs.id = assets.pack_id
      where assets.id = asset_versions.asset_id
        and packs.user_id = (select auth.uid())
    )
  );

grant select, insert on public.asset_versions to authenticated;
