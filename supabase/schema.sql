-- Run this SQL once in Supabase -> SQL Editor
-- Safe to run on an existing/repurposed Supabase project (e.g. matchh_intelligence):
-- ensures all RoofCalc Pro columns exist without failing if `profiles` already existed.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_pro boolean not null default false,
  plan_expires_at timestamptz,
  paystack_customer_code text,
  ai_scans_used integer not null default 0,
  ai_scans_limit integer not null default 100,
  ai_scans_reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists is_pro boolean not null default false;
alter table public.profiles add column if not exists plan_expires_at timestamptz;
alter table public.profiles add column if not exists paystack_customer_code text;
alter table public.profiles add column if not exists ai_scans_used integer not null default 0;
alter table public.profiles add column if not exists ai_scans_limit integer not null default 100;
alter table public.profiles add column if not exists ai_scans_reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month');

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Cache table keyed by SHA-256 hash of compressed image to avoid duplicate Gemini token charges
create table if not exists public.sketch_cache (
  image_hash text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.sketch_cache enable row level security;

-- Automatically create a profiles row whenever a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill any pre-existing auth.users rows into profiles
insert into public.profiles (id, email)
select id, lower(email) from auth.users
on conflict (id) do nothing;
