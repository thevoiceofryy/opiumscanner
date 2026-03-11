-- Create user_markets table for saving watchlist markets
create table if not exists public.user_markets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  market_id text not null,
  market_slug text not null,
  market_title text not null,
  token_id text,
  is_primary boolean default false,
  created_at timestamp with time zone default now(),
  unique(user_id, market_id)
);

-- Create user_settings table for preferences
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  crypto_pair text default 'BTCUSDT',
  timeframe text default '1m',
  theme text default 'dark',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.user_markets enable row level security;
alter table public.user_settings enable row level security;

-- RLS policies for user_markets
create policy "user_markets_select_own" on public.user_markets 
  for select using (auth.uid() = user_id);
create policy "user_markets_insert_own" on public.user_markets 
  for insert with check (auth.uid() = user_id);
create policy "user_markets_update_own" on public.user_markets 
  for update using (auth.uid() = user_id);
create policy "user_markets_delete_own" on public.user_markets 
  for delete using (auth.uid() = user_id);

-- RLS policies for user_settings
create policy "user_settings_select_own" on public.user_settings 
  for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on public.user_settings 
  for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on public.user_settings 
  for update using (auth.uid() = user_id);
create policy "user_settings_delete_own" on public.user_settings 
  for delete using (auth.uid() = user_id);

-- Create indexes for performance
create index if not exists idx_user_markets_user_id on public.user_markets(user_id);
create index if not exists idx_user_settings_user_id on public.user_settings(user_id);
