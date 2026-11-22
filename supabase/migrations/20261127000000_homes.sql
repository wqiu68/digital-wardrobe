-- Neighborhood: everyone has a little house on the friends map, and earns
-- points (from books read, closet pieces and habit check-offs) to spend on a
-- bigger house, paint and yard extras.
--
-- Points are always counted from real rows, never stored, and every purchase
-- goes through buy_home_upgrade(), which checks the price and balance here in
-- the database. There are no insert/update policies, so nobody can edit their
-- home row (or their points) directly.

create table if not exists public.homes (
  user_id uuid primary key references auth.users on delete cascade,
  level smallint not null default 1 check (level between 1 and 4),
  paint text not null default 'cream',
  owned text[] not null default '{}',   -- paints and yard extras bought
  spent integer not null default 0 check (spent >= 0),
  updated_at timestamptz not null default now()
);

-- Your little person: picked colors ({skin, hair, shirt, long}) and/or a small
-- face photo (a compressed data URL, about 10KB)
alter table public.homes add column if not exists look jsonb not null default '{}';
alter table public.homes add column if not exists photo text;

alter table public.homes enable row level security;

-- You and your accepted friends can see your house
drop policy if exists "Homes: own and friends" on public.homes;
create policy "Homes: own and friends" on public.homes for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = homes.user_id)
        or (f.addressee_id = auth.uid() and f.requester_id = homes.user_id))
  )
);

-- Prices. Keep in sync with CATALOG in src/utils/homes.js.
create or replace function public.home_price(item text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case item
    when 'level2' then 100  when 'level3' then 250  when 'level4' then 600
    when 'paint_sage' then 20  when 'paint_sky' then 20  when 'paint_blush' then 20
    when 'paint_butter' then 20  when 'paint_terracotta' then 30  when 'paint_navy' then 40
    when 'flowers' then 15  when 'mailbox' then 15  when 'lamp' then 25  when 'tree' then 30
    when 'fence' then 40  when 'cat' then 60  when 'dog' then 80  when 'pond' then 100
  end;
$$;

-- Your points: 10 per book read, 5 per closet piece, 2 per habit check-off.
-- Check-offs only count from the day the habit was created, so you can't
-- back-fill a year of days for free points.
create or replace function public.my_home_points()
returns table (books integer, pieces integer, checks integer, earned integer, spent integer)
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select
      (select count(*)::int from public.books b where b.user_id = auth.uid() and b.status = 'read') as books,
      (select count(*)::int from public.wardrobe_items w where w.user_id = auth.uid()) as pieces,
      (select count(*)::int from public.habit_checks hc
         join public.habits h on h.id = hc.habit_id
        where hc.user_id = auth.uid()
          and hc.day >= (h.created_at at time zone 'utc')::date - 1
          and hc.day <= current_date + 1) as checks
  )
  select c.books, c.pieces, c.checks,
         c.books * 10 + c.pieces * 5 + c.checks * 2,
         coalesce((select h.spent from public.homes h where h.user_id = auth.uid()), 0)
  from c
  where auth.uid() is not null;
$$;

create or replace function public.buy_home_upgrade(item text)
returns public.homes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  price integer := public.home_price(item);
  balance integer;
  h public.homes;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if price is null then raise exception 'That is not in the shop.'; end if;

  insert into public.homes (user_id) values (auth.uid()) on conflict do nothing;
  select * into h from public.homes where user_id = auth.uid() for update;

  if item like 'level%' then
    if substr(item, 6)::int <> h.level + 1 then raise exception 'Upgrade one size at a time.'; end if;
  elsif item = any(h.owned) then
    raise exception 'You already have that.';
  end if;

  select p.earned - h.spent into balance from public.my_home_points() p;
  if balance < price then raise exception 'Not enough points yet.'; end if;

  update public.homes set
    level = case when item like 'level%' then substr(item, 6)::smallint else level end,
    owned = case when item like 'level%' then owned else array_append(owned, item) end,
    paint = case when item like 'paint\_%' then item else paint end,
    spent = spent + price,
    updated_at = now()
  where user_id = auth.uid()
  returning * into h;
  return h;
end;
$$;

-- Switch between paints you own (cream is free)
create or replace function public.set_home_paint(paint text)
returns public.homes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  h public.homes;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  insert into public.homes (user_id) values (auth.uid()) on conflict do nothing;
  update public.homes set paint = set_home_paint.paint, updated_at = now()
  where user_id = auth.uid()
    and (set_home_paint.paint = 'cream' or set_home_paint.paint = any(owned))
  returning * into h;
  if h.user_id is null then raise exception 'Buy that paint first.'; end if;
  return h;
end;
$$;

-- Change your person's look and face photo (free)
create or replace function public.set_my_look(look jsonb, photo text)
returns public.homes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  h public.homes;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if jsonb_typeof(set_my_look.look) <> 'object' or length(set_my_look.look::text) > 300 then
    raise exception 'That look is not valid.';
  end if;
  if set_my_look.photo is not null
     and (set_my_look.photo not like 'data:image/%' or length(set_my_look.photo) > 60000) then
    raise exception 'That photo is too big. Try a smaller one.';
  end if;
  insert into public.homes (user_id) values (auth.uid()) on conflict do nothing;
  update public.homes set look = set_my_look.look, photo = set_my_look.photo, updated_at = now()
  where user_id = auth.uid()
  returning * into h;
  return h;
end;
$$;

revoke all on function public.set_my_look(jsonb, text) from public, anon;
grant execute on function public.set_my_look(jsonb, text) to authenticated;

revoke all on function public.my_home_points() from public, anon;
revoke all on function public.buy_home_upgrade(text) from public, anon;
revoke all on function public.set_home_paint(text) from public, anon;
grant execute on function public.my_home_points() to authenticated;
grant execute on function public.buy_home_upgrade(text) to authenticated;
grant execute on function public.set_home_paint(text) to authenticated;
