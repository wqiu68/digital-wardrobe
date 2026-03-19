-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- This adds the friends feature: profiles, friendships, and updated RLS.

-- ─── 1. Profiles ──────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text default '',
  email text not null,
  created_at timestamp with time zone default now()
);

alter table profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ─── 2. Friendships ───────────────────────────────────────────────────────────
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references profiles(id) on delete cascade not null,
  addressee_id uuid references profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone default now(),
  unique(requester_id, addressee_id)
);

alter table friendships enable row level security;

create policy "Users can see their own friendships"
  on friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can send friend requests"
  on friendships for insert
  with check (auth.uid() = requester_id);

create policy "Addressee can respond to requests"
  on friendships for update
  using (auth.uid() = addressee_id);

create policy "Either user can remove a friendship"
  on friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);


-- ─── 3. Update wardrobe_items RLS to allow friends to view ───────────────────
-- Drop the current all-in-one policy
drop policy if exists "Users can manage their own items" on wardrobe_items;

-- SELECT: own items, or items of an accepted friend
create policy "Users can view own and friends items"
  on wardrobe_items for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from friendships
      where status = 'accepted'
        and (
          (requester_id = auth.uid() and addressee_id = wardrobe_items.user_id)
          or (addressee_id = auth.uid() and requester_id = wardrobe_items.user_id)
        )
    )
  );

-- INSERT / UPDATE / DELETE: own items only
create policy "Users can insert their own items"
  on wardrobe_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own items"
  on wardrobe_items for update
  using (auth.uid() = user_id);

create policy "Users can delete their own items"
  on wardrobe_items for delete
  using (auth.uid() = user_id);
