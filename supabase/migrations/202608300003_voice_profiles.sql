-- Ticket #5: one editable, user-owned voice profile and the interview source
-- material that produced it. The JSON values are decoded through the shared
-- Effect schemas before application code sees them.
create table if not exists public.voice_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  profile_json jsonb not null,
  interview_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voice_profiles enable row level security;

create policy "users can read their own voice profile"
  on public.voice_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can insert their own voice profile"
  on public.voice_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can update their own voice profile"
  on public.voice_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger voice_profiles_set_updated_at
  before update on public.voice_profiles
  for each row execute procedure public.set_updated_at();

grant select, insert, update on public.voice_profiles to authenticated;
