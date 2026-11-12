-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- Adds book lending between friends and removes the "want to read" shelf.
-- Requires friends-migration.sql and bookshelf-migration.sql to have been run first.

-- ─── 1. Drop the "want to read" shelf ────────────────────────────────────────
update books set status = 'read' where status = 'want';
alter table books drop constraint if exists books_status_check;
alter table books add constraint books_status_check check (status in ('reading', 'read'));
alter table books alter column status set default 'read';


-- ─── 2. Helper: are two users accepted friends? ─────────────────────────────
create or replace function are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;


-- ─── 3. Loans ────────────────────────────────────────────────────────────────
-- Lifecycle: requested → lent → returned
--                     ↘ declined
create table if not exists book_loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references books on delete cascade not null,
  owner_id uuid references profiles(id) on delete cascade not null,
  borrower_id uuid references profiles(id) on delete cascade not null,
  status text not null default 'requested' check (status in ('requested', 'lent', 'declined', 'returned')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  check (owner_id <> borrower_id)
);

-- One open request/loan per borrower per book, and a book can only be lent to one person at a time
create unique index if not exists book_loans_one_open_per_borrower
  on book_loans (book_id, borrower_id) where status in ('requested', 'lent');
create unique index if not exists book_loans_one_lent_per_book
  on book_loans (book_id) where status = 'lent';

alter table book_loans enable row level security;

-- SELECT: owner and borrower see their loans; the owner's friends can see that a book is checked out
create policy "View own loans and friends' checked-out books"
  on book_loans for select
  using (
    auth.uid() = owner_id
    or auth.uid() = borrower_id
    or (status = 'lent' and are_friends(auth.uid(), owner_id))
  );

-- INSERT: you can request a friend's book for yourself
create policy "Request to borrow a friend's book"
  on book_loans for insert
  with check (
    auth.uid() = borrower_id
    and status = 'requested'
    and are_friends(auth.uid(), owner_id)
    and exists (select 1 from books where books.id = book_id and books.user_id = owner_id)
  );

-- UPDATE: only the owner moves a loan along (lend / decline / mark returned)
create policy "Owner responds to loans"
  on book_loans for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- DELETE: borrower can cancel a pending request or dismiss a declined one
create policy "Borrower cancels or dismisses"
  on book_loans for delete
  using (auth.uid() = borrower_id and status in ('requested', 'declined'));
