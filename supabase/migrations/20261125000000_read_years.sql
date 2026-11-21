-- A book can be read more than once: store every year it was read.
-- Keeps read_year (the latest year) filled in too, for older copies of the app.
alter table public.books add column if not exists read_years smallint[] not null default '{}';

update public.books
set read_years = array[read_year]
where read_year is not null and cardinality(read_years) = 0;
