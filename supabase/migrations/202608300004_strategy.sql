-- Ticket #6: a strict, user-owned strategy plus its queryable 30-day calendar.
-- The application decodes strategy_json and calendar rows with the shared
-- Effect schemas before use; RLS ensures a user can only read or edit theirs.
create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  strategy_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  strategy_id uuid not null references public.strategies (id) on delete cascade,
  scheduled_for date not null,
  pillar_id text not null,
  format text not null check (format in ('text_post', 'carousel', 'video', 'newsletter')),
  hook text not null,
  funnel_stage text not null check (funnel_stage in ('TOFU', 'MOFU', 'BOFU')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (strategy_id, scheduled_for)
);

create index if not exists calendar_items_user_date_idx
  on public.calendar_items (user_id, scheduled_for);

alter table public.strategies enable row level security;
alter table public.calendar_items enable row level security;

create policy "users can read their own strategy"
  on public.strategies for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users can insert their own strategy"
  on public.strategies for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "users can update their own strategy"
  on public.strategies for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users can read their own calendar"
  on public.calendar_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users can insert their own calendar"
  on public.calendar_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "users can update their own calendar"
  on public.calendar_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users can delete their own calendar"
  on public.calendar_items for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger strategies_set_updated_at
  before update on public.strategies
  for each row execute procedure public.set_updated_at();
create trigger calendar_items_set_updated_at
  before update on public.calendar_items
  for each row execute procedure public.set_updated_at();

-- The strategy JSON and its queryable calendar mirror each other. Keep their
-- replacement in one transaction so a failed calendar insert cannot leave an
-- otherwise valid strategy unreadable.
create or replace function public.save_strategy_with_calendar(
  p_user_id uuid,
  p_strategy_json jsonb,
  p_calendar_json jsonb
)
returns public.strategies
language plpgsql
set search_path = public
as $$
declare
  saved_strategy public.strategies;
begin
  insert into public.strategies (user_id, strategy_json)
  values (p_user_id, p_strategy_json)
  on conflict (user_id) do update
    set strategy_json = excluded.strategy_json
  returning * into saved_strategy;

  delete from public.calendar_items
  where strategy_id = saved_strategy.id;

  insert into public.calendar_items (
    user_id,
    strategy_id,
    scheduled_for,
    pillar_id,
    format,
    hook,
    funnel_stage
  )
  select
    p_user_id,
    saved_strategy.id,
    (item ->> 'date')::date,
    item ->> 'pillarId',
    item ->> 'format',
    item ->> 'hook',
    item ->> 'funnelStage'
  from jsonb_array_elements(p_calendar_json) as item;

  return saved_strategy;
end;
$$;

revoke all on function public.save_strategy_with_calendar(uuid, jsonb, jsonb)
  from public;
grant execute on function public.save_strategy_with_calendar(uuid, jsonb, jsonb)
  to authenticated;

grant select, insert, update on public.strategies to authenticated;
grant select, insert, update, delete on public.calendar_items to authenticated;
