-- The year someone finished a book, for the "By Year" view on the bookshelf.
-- Just a year (not a full date) because that's what people remember.
alter table public.books add column if not exists read_year smallint
  check (read_year between 1900 and 2100);
