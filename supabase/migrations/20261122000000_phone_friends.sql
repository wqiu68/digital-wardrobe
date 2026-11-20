-- Find friends by phone number.
--
-- Phone numbers live in their own table that nobody else can read. The
-- profiles table is readable by every signed-in user, so numbers must not go
-- there. Other people can only check "does this exact number belong to
-- someone?", which returns a name and id, never the number itself.

create table if not exists public.phone_numbers (
  user_id uuid primary key references auth.users on delete cascade,
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{6,14}$'),  -- E.164, e.g. +14155550123
  updated_at timestamptz not null default now()
);

alter table public.phone_numbers enable row level security;

drop policy if exists "Own phone: read" on public.phone_numbers;
drop policy if exists "Own phone: add" on public.phone_numbers;
drop policy if exists "Own phone: change" on public.phone_numbers;
drop policy if exists "Own phone: remove" on public.phone_numbers;
create policy "Own phone: read"   on public.phone_numbers for select using (auth.uid() = user_id);
create policy "Own phone: add"    on public.phone_numbers for insert with check (auth.uid() = user_id);
create policy "Own phone: change" on public.phone_numbers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own phone: remove" on public.phone_numbers for delete using (auth.uid() = user_id);

-- Look up homey members by phone (exact numbers only, at most 100 at a time
-- so the contact picker works but nobody can sweep through every number).
create or replace function public.find_profiles_by_phone(phones text[])
returns table (id uuid, display_name text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, n.phone
  from public.phone_numbers n
  join public.profiles p on p.id = n.user_id
  where auth.uid() is not null
    and n.user_id <> auth.uid()
    and cardinality(phones) <= 100
    and n.phone = any(phones);
$$;

revoke all on function public.find_profiles_by_phone(text[]) from public, anon;
grant execute on function public.find_profiles_by_phone(text[]) to authenticated;
