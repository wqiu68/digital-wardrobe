-- Run this in the Supabase SQL Editor

create table wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  brand text default '',
  color text default '',
  size text default '',
  category text not null default 'TOPS',
  occasions text[] default array[]::text[],
  notes text default '',
  source_url text default '',
  image text default '',
  sort_order integer,
  added_at bigint default extract(epoch from now()) * 1000,
  created_at timestamp with time zone default now()
);

-- Row Level Security: users can only access their own items
alter table wardrobe_items enable row level security;

create policy "Users can manage their own items"
  on wardrobe_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
