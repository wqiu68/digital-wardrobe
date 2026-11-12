-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- Lets friends borrow closet items too. Requires book-loans-migration.sql to have been run first.
-- (The table keeps the name book_loans; each row now points at either a book OR a closet item.)

alter table book_loans alter column book_id drop not null;
alter table book_loans add column if not exists item_id uuid references wardrobe_items on delete cascade;

alter table book_loans drop constraint if exists book_loans_one_target;
alter table book_loans add constraint book_loans_one_target check (num_nonnulls(book_id, item_id) = 1);

-- Same rules as books: one open request per borrower per item, one active loan per item
create unique index if not exists book_loans_item_one_open_per_borrower
  on book_loans (item_id, borrower_id) where status in ('requested', 'lent');
create unique index if not exists book_loans_item_one_lent
  on book_loans (item_id) where status = 'lent';

-- Requests must point at something the owner actually owns
drop policy if exists "Request to borrow a friend's book" on book_loans;
create policy "Request to borrow a friend's book or item"
  on book_loans for insert
  with check (
    auth.uid() = borrower_id
    and status = 'requested'
    and are_friends(auth.uid(), owner_id)
    and (
      exists (select 1 from books where books.id = book_id and books.user_id = owner_id)
      or exists (select 1 from wardrobe_items w where w.id = item_id and w.user_id = owner_id)
    )
  );
