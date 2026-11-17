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

-- 6. Pitch decks: secure share links and analytics (Pro > Pitch decks > Shared, and deck.html).
--    A deck's slides are images in the "decks" bucket under a random folder that only open_deck() hands out,
--    after the password or email-domain check. Views and time on each slide are logged for the owner.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.pro_decks (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null,
  brand      text,
  property   text,
  slides     jsonb not null default '[]'::jsonb,   -- [{img, video?, title}] paths in the decks bucket
  protect    text not null default 'domain' check (protect in ('none','password','domain')),
  pass_hash  text,                                  -- bcrypt, set by set_deck_password()
  domains    text[] not null default '{}',          -- lower case, no @
  active     boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.pro_decks enable row level security;
drop policy if exists "own decks" on public.pro_decks;
create policy "own decks" on public.pro_decks
  for all to authenticated
  using (owner = auth.uid() and public.is_pro())
  with check (owner = auth.uid() and public.is_pro());

create table if not exists public.pro_deck_views (
  id        uuid primary key default gen_random_uuid(),
  deck_id   uuid not null references public.pro_decks (id) on delete cascade,
  email     text,
  session   text,
  country   text,
  tz        text,
  lang      text,
  ua        text,
  opened_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists pro_deck_views_deck on public.pro_deck_views (deck_id, opened_at desc);
alter table public.pro_deck_views enable row level security;
drop policy if exists "owner reads views" on public.pro_deck_views;
create policy "owner reads views" on public.pro_deck_views
  for select to authenticated
  using (exists (select 1 from public.pro_decks d where d.id = deck_id and d.owner = auth.uid()));

create table if not exists public.pro_deck_slides (
  view_id uuid not null references public.pro_deck_views (id) on delete cascade,
  slide   int not null,
  ms      bigint not null default 0,
  visits  int not null default 0,
  primary key (view_id, slide)
);
alter table public.pro_deck_slides enable row level security;
drop policy if exists "owner reads slide time" on public.pro_deck_slides;
create policy "owner reads slide time" on public.pro_deck_slides
  for select to authenticated
  using (exists (select 1 from public.pro_deck_views v join public.pro_decks d on d.id = v.deck_id
                 where v.id = view_id and d.owner = auth.uid()));

-- Owner sets a link's password (stored as a bcrypt hash only).
create or replace function public.set_deck_password(p_id uuid, p_pass text)
returns void language sql volatile security definer set search_path = public, extensions as $$
  update public.pro_decks set pass_hash = extensions.crypt(p_pass, extensions.gen_salt('bf'))
  where id = p_id and owner = auth.uid();
$$;
grant execute on function public.set_deck_password(uuid, text) to authenticated;

-- What the viewer page needs before the gate: title and which kind of check. No slides.
create or replace function public.deck_meta(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('title', title, 'protect', protect, 'domains', domains, 'brand', brand, 'property', property)
  from public.pro_decks where id = p_id and active and (expires_at is null or expires_at > now());
$$;
grant execute on function public.deck_meta(uuid) to anon, authenticated;

-- Checks the password or the signed-in viewer's email domain, logs the view, returns the slides.
create or replace function public.open_deck(p_id uuid, p_pass text default null, p_session text default null,
                                            p_tz text default null, p_lang text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  d public.pro_decks;
  em text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v uuid;
  hdr json;
begin
  select * into d from public.pro_decks where id = p_id and active and (expires_at is null or expires_at > now());
  if not found then return null; end if;
  if d.protect = 'password' and (p_pass is null or d.pass_hash is null or extensions.crypt(p_pass, d.pass_hash) <> d.pass_hash) then
    return jsonb_build_object('error', 'password');
  end if;
  if d.protect = 'domain' and (em = '' or not (split_part(em, '@', 2) = any (d.domains))) then
    return jsonb_build_object('error', 'domain');
  end if;
  begin hdr := current_setting('request.headers', true)::json; exception when others then hdr := null; end;
  insert into public.pro_deck_views (deck_id, email, session, country, tz, lang, ua)
  values (d.id, nullif(em, ''), left(p_session, 64), left(hdr ->> 'cf-ipcountry', 8), left(p_tz, 64), left(p_lang, 16), left(hdr ->> 'user-agent', 300))
  returning id into v;
  return jsonb_build_object('title', d.title, 'brand', d.brand, 'property', d.property, 'slides', d.slides, 'view', v);
end $$;
grant execute on function public.open_deck(uuid, text, text, text, text) to anon, authenticated;

-- Time on slide, sent by the viewer every few seconds. Only for views opened in the last 12 hours.
create or replace function public.deck_ping(p_view uuid, p_slide int, p_ms int, p_visit boolean default false)
returns void language sql volatile security definer set search_path = public as $$
  insert into public.pro_deck_slides (view_id, slide, ms, visits)
  select p_view, p_slide, least(greatest(p_ms, 0), 600000), case when p_visit then 1 else 0 end
  where exists (select 1 from public.pro_deck_views where id = p_view and opened_at > now() - interval '12 hours')
  on conflict (view_id, slide) do update set ms = public.pro_deck_slides.ms + excluded.ms, visits = public.pro_deck_slides.visits + excluded.visits;
  update public.pro_deck_views set last_seen = now() where id = p_view;
$$;
grant execute on function public.deck_ping(uuid, int, int, boolean) to anon, authenticated;

-- Slide images and videos. Public bucket, but nobody can list it, and each deck sits in a random folder.
insert into storage.buckets (id, name, public)
values ('decks', 'decks', true)
on conflict (id) do update set public = true;
drop policy if exists "pro members upload decks" on storage.objects;
create policy "pro members upload decks" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'decks' and public.is_pro());
drop policy if exists "pro members remove their decks" on storage.objects;
create policy "pro members remove their decks" on storage.objects
  for delete to authenticated
  using (bucket_id = 'decks' and owner = auth.uid());
