-- =====================================================================
-- PALIT marketplace  ·  Supabase schema
-- Paste this whole file into: Supabase Dashboard > SQL Editor > New query > Run
-- Safe to re-run.
-- =====================================================================

-- ---------- profiles (one row per signed-up user) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text,
  mobile       text,
  email        text,
  company      text,
  account_type text default 'buyer',
  created_at   timestamptz not null default now()
);

-- Creates the profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, mobile, email, company, account_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name'),
    coalesce(new.phone, new.raw_user_meta_data->>'mobile'),
    coalesce(new.raw_user_meta_data->>'email', new.email),
    new.raw_user_meta_data->>'company',
    coalesce(new.raw_user_meta_data->>'account_type', 'buyer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- items (everything shown in the Market) ----------
create table if not exists public.items (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  seller_name    text not null default 'Seller',
  title          text not null check (char_length(title) between 3 and 80),
  price          numeric(12,2) not null check (price >= 0),
  description    text not null check (char_length(description) between 5 and 2000),
  category       text not null default 'other',
  image_urls     text[] not null default '{}',
  lat            double precision not null check (lat between -90 and 90),
  lng            double precision not null check (lng between -180 and 180),
  location_label text,
  status         text not null default 'available' check (status in ('available','sold')),
  created_at     timestamptz not null default now()
);
-- For databases created BEFORE categories existed: adds the column to your existing items table.
alter table public.items add column if not exists category text not null default 'other';
create index if not exists items_category_idx on public.items (category);
create index if not exists items_created_idx on public.items (created_at desc);
create index if not exists items_seller_idx  on public.items (seller_id);

-- ---------- item_contacts (seller phone + Gmail: visible ONLY to signed-in users) ----------
create table if not exists public.item_contacts (
  item_id        uuid primary key references public.items(id) on delete cascade,
  contact_number text not null check (char_length(contact_number) between 7 and 20),
  gmail          text not null check (gmail ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- ---------- purchases (one row each time a signed-in buyer presses BUY ITEM) ----------
create table if not exists public.purchases (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.items(id) on delete cascade,
  buyer_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (item_id, buyer_id)
);

-- ---------- reviews (1-5 stars; only buyers can rate) ----------
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.items(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  stars      int  not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  unique (item_id, user_id)
);

-- ---------- item_stats (public counters used by the Ratings page) ----------
create or replace view public.item_stats as
select
  i.id as item_id,
  coalesce((select count(*) from public.purchases p where p.item_id = i.id), 0)::int as buys,
  coalesce((select round(avg(r.stars)::numeric, 2) from public.reviews r where r.item_id = i.id), 0)::float8 as avg_stars,
  coalesce((select count(*) from public.reviews r where r.item_id = i.id), 0)::int as rating_count
from public.items i;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.items         enable row level security;
alter table public.item_contacts enable row level security;
alter table public.purchases     enable row level security;
alter table public.reviews       enable row level security;

-- profiles: you only see / edit your own
drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: read own"   on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles: update own" on public.profiles for update to authenticated using (id = auth.uid());

-- items: everyone (even logged-out visitors) can browse; only the owner can post / edit / delete
drop policy if exists "items: public read"   on public.items;
drop policy if exists "items: owner insert"  on public.items;
drop policy if exists "items: owner update"  on public.items;
drop policy if exists "items: owner delete"  on public.items;
create policy "items: public read"  on public.items for select to anon, authenticated using (true);
create policy "items: owner insert" on public.items for insert to authenticated with check (seller_id = auth.uid());
create policy "items: owner update" on public.items for update to authenticated using (seller_id = auth.uid());
create policy "items: owner delete" on public.items for delete to authenticated using (seller_id = auth.uid());

-- item_contacts: only signed-in users can read (this is what BUY ITEM reveals)
drop policy if exists "contacts: signed-in read" on public.item_contacts;
drop policy if exists "contacts: owner insert"   on public.item_contacts;
drop policy if exists "contacts: owner update"   on public.item_contacts;
drop policy if exists "contacts: owner delete"   on public.item_contacts;
create policy "contacts: signed-in read" on public.item_contacts for select to authenticated using (true);
create policy "contacts: owner insert"   on public.item_contacts for insert to authenticated
  with check (exists (select 1 from public.items i where i.id = item_id and i.seller_id = auth.uid()));
create policy "contacts: owner update"   on public.item_contacts for update to authenticated
  using (exists (select 1 from public.items i where i.id = item_id and i.seller_id = auth.uid()));
create policy "contacts: owner delete"   on public.item_contacts for delete to authenticated
  using (exists (select 1 from public.items i where i.id = item_id and i.seller_id = auth.uid()));

-- purchases: you can record / read your own; you cannot "buy" your own listing
drop policy if exists "purchases: read own"   on public.purchases;
drop policy if exists "purchases: insert own" on public.purchases;
create policy "purchases: read own"   on public.purchases for select to authenticated using (buyer_id = auth.uid());
create policy "purchases: insert own" on public.purchases for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and not exists (select 1 from public.items i where i.id = item_id and i.seller_id = auth.uid())
  );

-- reviews: anyone can read; only a buyer of that item can rate it, and only for themselves
drop policy if exists "reviews: public read"    on public.reviews;
drop policy if exists "reviews: buyer insert"   on public.reviews;
drop policy if exists "reviews: owner update"   on public.reviews;
create policy "reviews: public read"  on public.reviews for select to anon, authenticated using (true);
create policy "reviews: buyer insert" on public.reviews for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.purchases p where p.item_id = reviews.item_id and p.buyer_id = auth.uid())
  );
create policy "reviews: owner update" on public.reviews for update to authenticated using (user_id = auth.uid());

grant select on public.item_stats to anon, authenticated;

-- =====================================================================
-- Storage bucket for item photos (public read, owners upload into their own folder)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

drop policy if exists "item-images: public read"   on storage.objects;
drop policy if exists "item-images: upload own"    on storage.objects;
drop policy if exists "item-images: delete own"    on storage.objects;
create policy "item-images: public read" on storage.objects for select
  using (bucket_id = 'item-images');
create policy "item-images: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "item-images: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
