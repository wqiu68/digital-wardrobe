-- Daily usage counter for the "Ask homey" assistant, so nobody can run up the
-- Anthropic bill. The assistant edge function bumps it before every Claude call
-- and refuses once a limit is hit.

create table if not exists public.assistant_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  messages integer not null default 0,  -- things the person typed
  calls integer not null default 0,     -- Claude requests (one message can take a few)
  primary key (user_id, day)
);

alter table public.assistant_usage enable row level security;
drop policy if exists "Own usage: read" on public.assistant_usage;
create policy "Own usage: read" on public.assistant_usage for select using (auth.uid() = user_id);
-- No insert/update policies: only the function below changes counts.

create or replace function public.bump_assistant_usage(new_message boolean)
returns table (messages integer, calls integer)
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.assistant_usage as u (user_id, day, messages, calls)
  values (auth.uid(), (now() at time zone 'utc')::date, case when new_message then 1 else 0 end, 1)
  on conflict (user_id, day) do update
    set messages = u.messages + excluded.messages,
        calls = u.calls + 1
  returning u.messages, u.calls;
$$;

revoke all on function public.bump_assistant_usage(boolean) from public, anon;
grant execute on function public.bump_assistant_usage(boolean) to authenticated;
