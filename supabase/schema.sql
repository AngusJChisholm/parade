-- SSS Pro: login, members and private data.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste this whole file > Run.
-- Safe to run again (it only creates what's missing and replaces the policies).

-- 1. Who has Pro. Access is by email, so a paying customer is added or switched off here.
create table if not exists public.pro_members (
  email      text primary key,
  plan       text not null default 'pro',      -- pro, team, enterprise, founding
  active     boolean not null default true,
  note       text,
  added_at   timestamptz not null default now()
);
alter table public.pro_members enable row level security;
-- Nobody reads this table from the browser; only the is_pro() check below looks at it.

-- 2. Is the signed-in user an active member?
create or replace function public.is_pro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pro_members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and m.active
  );
$$;
grant execute on function public.is_pro() to authenticated;

-- 3. Each member's saved state (watchlist, notes, report options, match feedback), so it follows them across devices.
create table if not exists public.pro_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.pro_state enable row level security;
drop policy if exists "own state" on public.pro_state;
create policy "own state" on public.pro_state
  for all to authenticated
  using (user_id = auth.uid() and public.is_pro())
  with check (user_id = auth.uid() and public.is_pro());

-- 4. Private file bucket for Pro-only data (matches.json, audit.json). Uploaded by the GitHub workflow.
insert into storage.buckets (id, name, public)
values ('pro', 'pro', false)
on conflict (id) do update set public = false;

drop policy if exists "pro members read pro files" on storage.objects;
create policy "pro members read pro files" on storage.objects
  for select to authenticated
  using (bucket_id = 'pro' and public.is_pro());

-- 5. Add yourself as the first member: replace YOUR_EMAIL below and run just these lines.
--    That's all it takes to give someone access: they enter that email on /pro and sign in with the emailed code.
-- insert into public.pro_members (email, plan, note)
-- values ('YOUR_EMAIL', 'enterprise', 'Owner')
-- on conflict (email) do nothing;
