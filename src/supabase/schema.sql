-- Enable UUID and basic extensions
create extension if not exists "uuid-ossp";

-- Users table
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Licenses table (one-to-many in case you later sell multiple)
create table if not exists public.licenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  license_key text not null unique,
  plan text not null default 'free', -- 'free' | 'pro' | 'ultimate' | etc.
  status text not null default 'active', -- 'active' | 'revoked' | 'expired'
  created_at timestamptz not null default now()
);

-- Download artifacts (you’ll fill in your real links)
create table if not exists public.downloads (
  id uuid primary key default uuid_generate_v4(),
  platform text not null,  -- 'android'|'ios'|'windows'|'macos'|'linux'
  label text not null,     -- e.g., "Windows (MSIX)"
  url text not null,       -- direct or store link
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Helpful index
create index if not exists idx_downloads_platform on public.downloads(platform);

-- Row Level Security
alter table public.users enable row level security;
alter table public.licenses enable row level security;
alter table public.downloads enable row level security;

-- Public read access to downloads (so your page can show the list)
create policy "Public can read downloads"
on public.downloads for select
to anon using (true);

-- Insert/select for users via anon key (you’re only inserting email addresses from your site)
create policy "Upsert users by email (insert allowed)"
on public.users for insert
to anon with check (true);

create policy "Select users by email"
on public.users for select
to anon using (true);

-- Insert/select licenses via anon (generated client-side) — optional tighten later with Edge Function
create policy "Insert licenses"
on public.licenses for insert
to anon with check (true);

create policy "Select licenses"
on public.licenses for select
to anon using (true);
