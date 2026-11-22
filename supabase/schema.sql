-- Run this SQL in Supabase -> SQL Editor
-- Safe & idempotent: can be re-run safely on an existing RoofCalc Pro database.

create extension if not exists pgcrypto;

-- 1. User Profiles (Pro status + pay-as-you-go AI scan credit balance)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_pro boolean not null default false,
  plan_expires_at timestamptz,
  paystack_customer_code text,
  ai_scans_used integer not null default 0,
  ai_scans_limit integer not null default 100,
  ai_scans_reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  referred_by_code text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists is_pro boolean not null default false;
alter table public.profiles add column if not exists plan_expires_at timestamptz;
alter table public.profiles add column if not exists paystack_customer_code text;
alter table public.profiles add column if not exists ai_scans_used integer not null default 0;
alter table public.profiles add column if not exists ai_scans_limit integer not null default 100;
alter table public.profiles add column if not exists ai_scans_reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month');
alter table public.profiles add column if not exists referred_by_code text;

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- 2. SHA-256 Sketch Cache (prevents duplicate Gemini API token charges on identical images)
create table if not exists public.sketch_cache (
  image_hash text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.sketch_cache enable row level security;

-- 3. Idempotent Payment Transactions Ledger (Pro Upgrades + On-Demand AI Scan Top-Up Packs)
create table if not exists public.payment_transactions (
  paystack_reference text primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  purchase_type text not null check (purchase_type in ('pro_upgrade', 'scan_topup')),
  pack_id text,
  scans_added integer not null default 0,
  original_amount_kobo integer not null default 0,
  paid_amount_kobo integer not null default 0,
  discount_kobo integer not null default 0,
  referral_code text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_transactions_user_id on public.payment_transactions(user_id);
alter table public.payment_transactions enable row level security;

-- 4. Influencer / Partner Referral Codes (Option A: Buyer Discount + Tracked Commission Ledger)
create table if not exists public.referral_codes (
  code text primary key,
  influencer_name text not null,
  influencer_email text,
  discount_percent numeric(5,2) not null default 15 check (discount_percent >= 0 and discount_percent <= 90),
  commission_percent numeric(5,2) not null default 20 check (commission_percent >= 0 and commission_percent <= 90),
  commission_flat_kobo integer check (commission_flat_kobo is null or commission_flat_kobo >= 0),
  partner_token text unique not null default encode(gen_random_bytes(12), 'hex'),
  is_active boolean not null default true,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses_count integer not null default 0,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;

-- 5. Influencer Referral Conversions & Payout Ledger (Option A)
create table if not exists public.referral_conversions (
  id uuid primary key default gen_random_uuid(),
  paystack_reference text not null unique,
  referral_code text not null references public.referral_codes(code) on update cascade,
  buyer_user_id uuid references auth.users(id) on delete set null,
  buyer_email text,
  purchase_type text not null default 'pro_upgrade',
  original_amount_kobo integer not null default 0,
  paid_amount_kobo integer not null default 0,
  discount_kobo integer not null default 0,
  commission_kobo integer not null default 0,
  payout_status text not null default 'pending' check (payout_status in ('pending', 'paid', 'void')),
  paid_at timestamptz,
  payout_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_referral_conversions_code on public.referral_conversions(referral_code);
create index if not exists idx_referral_conversions_status on public.referral_conversions(payout_status);
alter table public.referral_conversions enable row level security;

-- 6. Admin Payout Summary View (query this in Supabase to see who to pay each week/month)
create or replace view public.influencer_payout_summary as
select
  rc.code,
  rc.influencer_name,
  rc.influencer_email,
  rc.discount_percent,
  rc.commission_percent,
  rc.commission_flat_kobo,
  rc.is_active,
  rc.uses_count,
  rc.partner_token,
  count(conv.id) as total_conversions,
  coalesce(sum(conv.paid_amount_kobo) filter (where conv.payout_status <> 'void'), 0) / 100.0 as total_revenue_ngn,
  coalesce(sum(conv.commission_kobo) filter (where conv.payout_status = 'pending'), 0) / 100.0 as pending_payout_ngn,
  coalesce(sum(conv.commission_kobo) filter (where conv.payout_status = 'paid'), 0) / 100.0 as paid_out_ngn
from public.referral_codes rc
left join public.referral_conversions conv on conv.referral_code = rc.code
group by rc.code;

-- 7. Auto-create profiles row whenever a user signs up
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

-- =============================================================================
-- EXAMPLE: Create your first influencer referral code (uncomment & edit to run)
-- =============================================================================
-- insert into public.referral_codes (code, influencer_name, influencer_email, discount_percent, commission_percent, notes)
-- values ('SIJITEK15', 'Sample Influencer', 'influencer@example.com', 15, 20, '15% buyer discount, 20% influencer commission')
-- on conflict (code) do nothing;
--
-- Shareable link for the influencer:
--   https://roofcalc.sijiteksolutions.com/?ref=SIJITEK15
--
-- Live read-only earnings link for the influencer (grab partner_token from public.referral_codes):
--   https://roofcalc.sijiteksolutions.com/?partner=SIJITEK15&token=<partner_token>
