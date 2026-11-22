-- Friends feed: "Maya added 3 pieces", "Jordan finished Circe", "Sam ranked Dune".
--
-- Clothes added within 12 hours are shown as one post, unless the person ticks
-- "Post on its own" when adding (separate_post). Books get timestamps for when
-- they were finished and ranked, filled in by a trigger so every way of
-- changing a book (the app, the assistant, imports) records them the same way.

alter table public.wardrobe_items add column if not exists separate_post boolean not null default false;

alter table public.books add column if not exists finished_at timestamptz;
alter table public.books add column if not exists ranked_at timestamptz;

create or replace function public.books_feed_times()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'read' and old.status is distinct from 'read' then
    new.finished_at := now();
  end if;
  if new.sentiment is not null
     and (old.sentiment is distinct from new.sentiment or old.rank_order is null) then
    new.ranked_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists books_feed_times on public.books;
create trigger books_feed_times before update on public.books
  for each row execute function public.books_feed_times();
