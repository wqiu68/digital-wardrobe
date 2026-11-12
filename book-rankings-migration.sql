-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- Adds genres and Beli-style rankings to books. Requires bookshelf-migration.sql.
-- Friends can already read each other's books (and therefore rankings) via existing RLS.

alter table books add column if not exists genre text default '';

-- How you felt about it; rankings only compare books within the same sentiment
alter table books add column if not exists sentiment text
  check (sentiment in ('liked', 'fine', 'disliked'));

-- Position within the sentiment group: higher = better. Fractional so a new book
-- can slot between two neighbours without renumbering the rest.
alter table books add column if not exists rank_order double precision;
