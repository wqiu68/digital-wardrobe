-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- Adds the bookshelf feature. Requires friends-migration.sql to have been run first.

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  author text default '',
  cover text default '',          -- image URL (Open Library) or compressed data URL
  status text not null default 'want' check (status in ('want', 'reading', 'read')),
  rating integer check (rating between 1 and 5),
  notes text default '',
  year integer,
  pages integer,
  isbn text default '',
  ol_key text default '',         -- Open Library work key, e.g. /works/OL45804W
  sort_order integer,
  added_at bigint default extract(epoch from now()) * 1000,
  created_at timestamp with time zone default now()
);

alter table books enable row level security;

-- SELECT: own books, or books of an accepted friend
create policy "Users can view own and friends books"
  on books for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from friendships
      where status = 'accepted'
        and (
          (requester_id = auth.uid() and addressee_id = books.user_id)
          or (addressee_id = auth.uid() and requester_id = books.user_id)
        )
    )
  );

create policy "Users can insert their own books"
  on books for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own books"
  on books for update
  using (auth.uid() = user_id);

create policy "Users can delete their own books"
  on books for delete
  using (auth.uid() = user_id);
