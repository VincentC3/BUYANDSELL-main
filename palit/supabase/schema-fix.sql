-- =====================================================================
-- PALIT  ·  FIX / UPDATE v4  (accept & decline requests, views, safer contacts)
-- Run the WHOLE file once in Supabase > SQL Editor > New query > Run.
-- Safe to re-run. Run it AFTER your normal schema.sql.
-- =====================================================================

-- ---------- 1) status of every buyer request ----------
alter table public.purchases add column if not exists transaction_status text default 'pending';
update public.purchases set transaction_status = 'pending' where transaction_status is null;
alter table public.purchases alter column transaction_status set default 'pending';
alter table public.purchases alter column transaction_status set not null;

alter table public.purchases drop constraint if exists purchases_status_check;
alter table public.purchases drop constraint if exists purchases_transaction_status_check;
alter table public.purchases add constraint purchases_transaction_status_check
  check (transaction_status in ('pending','accepted','rejected','completed','cancelled'));

-- OPTIONAL: purchases made BEFORE this update were already finished deals.
-- Uncomment ONLY if you have no real pending requests yet:
-- update public.purchases set transaction_status = 'completed' where transaction_status = 'pending';

-- A buyer may send a new request after a decline: only ONE ACTIVE request per buyer+item.
alter table public.purchases drop constraint if exists purchases_item_id_buyer_id_key;
create unique index if not exists purchases_one_active_per_buyer
  on public.purchases (item_id, buyer_id) where transaction_status in ('pending','accepted');

-- ---------- 2) the SELLER answers requests on his own items ----------
drop policy if exists "purchases: seller update" on public.purchases;
create policy "purchases: seller update" on public.purchases for update to authenticated
  using (exists (select 1 from public.items i where i.id = purchases.item_id and i.seller_id = auth.uid()))
  with check (exists (select 1 from public.items i where i.id = purchases.item_id and i.seller_id = auth.uid()));

-- seller may change ONLY the status column
revoke update on public.purchases from authenticated;
grant update (transaction_status) on public.purchases to authenticated;

-- ---------- 3) seller phone + Gmail: only the seller OR a buyer the seller accepted ----------
drop policy if exists "contacts: signed-in read" on public.item_contacts;
drop policy if exists "contacts: seller or approved buyer read" on public.item_contacts;
create policy "contacts: seller or approved buyer read" on public.item_contacts for select to authenticated
  using (
    exists (select 1 from public.items i where i.id = item_contacts.item_id and i.seller_id = auth.uid())
    or exists (select 1 from public.purchases p
               where p.item_id = item_contacts.item_id and p.buyer_id = auth.uid()
                 and p.transaction_status in ('accepted','completed'))
  );

-- ---------- 4) only a COMPLETED purchase can be rated ----------
drop policy if exists "reviews: buyer insert" on public.reviews;
create policy "reviews: buyer insert" on public.reviews for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.purchases p
                where p.item_id = reviews.item_id and p.buyer_id = auth.uid()
                  and p.transaction_status = 'completed')
  );

-- ---------- 5) "sold" counts only real deals ----------
create or replace view public.item_stats as
select
  i.id as item_id,
  coalesce((select count(*) from public.purchases p
            where p.item_id = i.id and p.transaction_status in ('accepted','completed')), 0)::int as buys,
  coalesce((select round(avg(r.stars)::numeric, 2) from public.reviews r where r.item_id = i.id), 0)::float8 as avg_stars,
  coalesce((select count(*) from public.reviews r where r.item_id = i.id), 0)::int as rating_count
from public.items i;
grant select on public.item_stats to anon, authenticated;

-- ---------- 6) views counter ----------
alter table public.items add column if not exists views int not null default 0;

create or replace function public.increment_views(p_item_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.items set views = views + 1 where id = p_item_id;
$$;
grant execute on function public.increment_views(uuid) to anon, authenticated;
