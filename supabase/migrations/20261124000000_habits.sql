-- Habit tracker: a daily checklist on the home page plus a month view.
-- Private to each person (friends can't see habits).

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  archived_at timestamptz  -- "deleted" habits keep their history
);
create index if not exists habits_user_idx on public.habits (user_id);

-- One row per habit per day it was done. `day` is the person's local date.
create table if not exists public.habit_checks (
  habit_id uuid not null references public.habits on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  primary key (habit_id, day)
);
create index if not exists habit_checks_user_day_idx on public.habit_checks (user_id, day);

alter table public.habits enable row level security;
alter table public.habit_checks enable row level security;

drop policy if exists "Own habits" on public.habits;
create policy "Own habits" on public.habits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Own habit checks" on public.habit_checks;
create policy "Own habit checks" on public.habit_checks for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = auth.uid())
  );
