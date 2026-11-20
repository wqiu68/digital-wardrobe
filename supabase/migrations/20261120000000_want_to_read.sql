-- Bring back the "Want to Read" shelf.
-- Applied automatically by .github/workflows/supabase.yml on push to main.
alter table books drop constraint if exists books_status_check;
alter table books add constraint books_status_check check (status in ('want', 'reading', 'read'));
