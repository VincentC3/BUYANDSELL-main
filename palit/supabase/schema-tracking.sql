-- =====================================================================
-- PALIT  ·  DELIVERY TRACKING  (run once in Supabase > SQL Editor > New query > Run)
-- Safe to re-run. Needs the purchases + items tables from your earlier SQL files.
-- =====================================================================

create table if not exists public.delivery_tracking (
  purchase_id  uuid primary key references public.purchases(id) on delete cascade,
  mode         text check (mode in ('self','courier')),
  status       text not null default 'preparing' check (status in ('preparing','out_for_delivery','delivered')),
  courier_name text check (char_length(courier_name) <= 60),
  courier_link text check (char_length(courier_link) <= 500),
  tracking_no  text check (char_length(tracking_no) <= 60),
  dest_lat     double precision check (dest_lat between -90 and 90),
  dest_lng     double precision check (dest_lng between -180 and 180),
  lat          double precision check (lat between -90 and 90),
  lng          double precision check (lng between -180 and 180),
  accuracy     double precision,
  heading      double precision,
  speed        double precision,
  position_at  timestamptz,
  started_at   timestamptz,
  delivered_at timestamptz,
  updated_at   timestamptz not null default now()
);

-- ---------- who is who for a purchase (bypasses RLS safely) ----------
create or replace function public.track_is_seller(p_purchase_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.purchases p join public.items i on i.id = p.item_id
    where p.id = p_purchase_id and i.seller_id = auth.uid()
  );
$$;

create or replace function public.track_is_buyer(p_purchase_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.purchases p
    where p.id = p_purchase_id and p.buyer_id = auth.uid()
  );
$$;

-- ---------- table access: clients may only READ (and only their own orders) ----------
alter table public.delivery_tracking enable row level security;
revoke all on public.delivery_tracking from anon, authenticated;
grant select on public.delivery_tracking to authenticated;

drop policy if exists "tracking: buyer or seller read" on public.delivery_tracking;
create policy "tracking: buyer or seller read" on public.delivery_tracking
  for select to authenticated
  using (public.track_is_seller(purchase_id) or public.track_is_buyer(purchase_id));

-- ---------- SELLER: start a delivery (self = live GPS, courier = tracking link) ----------
create or replace function public.track_start(
  p_purchase_id uuid, p_mode text,
  p_courier_name text default null, p_courier_link text default null, p_tracking_no text default null)
returns public.delivery_tracking
language plpgsql security definer set search_path = '' as $$
declare r public.delivery_tracking; pm record;
begin
  if auth.uid() is null or not public.track_is_seller(p_purchase_id) then raise exception 'Not allowed'; end if;
  select delivery_method, transaction_status into pm from public.purchases where id = p_purchase_id;
  if pm.delivery_method is distinct from 'delivery' then raise exception 'This order is a meet-up, not a delivery.'; end if;
  if pm.transaction_status is distinct from 'accepted' then raise exception 'Accept the order before starting the delivery.'; end if;
  if p_mode not in ('self','courier') then raise exception 'Invalid delivery type.'; end if;
  if p_mode = 'courier' then
    if coalesce(trim(p_courier_name), '') = '' then raise exception 'Enter the courier name.'; end if;
    if coalesce(trim(p_courier_link), '') = '' and coalesce(trim(p_tracking_no), '') = '' then
      raise exception 'Paste the tracking link or number.'; end if;
    if coalesce(trim(p_courier_link), '') <> '' and trim(p_courier_link) !~* '^https?://' then
      raise exception 'The tracking link must start with http:// or https://'; end if;
  end if;

  insert into public.delivery_tracking (purchase_id, mode, status, courier_name, courier_link, tracking_no, started_at, updated_at)
  values (p_purchase_id, p_mode, 'out_for_delivery',
          case when p_mode = 'courier' then nullif(trim(p_courier_name), '') end,
          case when p_mode = 'courier' then nullif(trim(p_courier_link), '') end,
          case when p_mode = 'courier' then nullif(trim(p_tracking_no), '') end,
          now(), now())
  on conflict (purchase_id) do update set
    mode = excluded.mode, status = 'out_for_delivery',
    courier_name = excluded.courier_name, courier_link = excluded.courier_link, tracking_no = excluded.tracking_no,
    started_at = coalesce(public.delivery_tracking.started_at, now()), updated_at = now()
  where public.delivery_tracking.status <> 'delivered'
  returning * into r;

  if r.purchase_id is null then raise exception 'This delivery is already marked delivered.'; end if;
  return r;
end $$;

-- ---------- SELLER: live GPS point (max one write per 2 seconds) ----------
create or replace function public.track_position(
  p_purchase_id uuid, p_lat double precision, p_lng double precision,
  p_accuracy double precision default null, p_heading double precision default null, p_speed double precision default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.track_is_seller(p_purchase_id) then raise exception 'Not allowed'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid position.'; end if;

  update public.delivery_tracking set
    lat = p_lat, lng = p_lng,
    accuracy = case when p_accuracy between 0 and 100000 then p_accuracy else null end,
    heading  = case when p_heading  between 0 and 360    then p_heading  else null end,
    speed    = case when p_speed    between 0 and 100    then p_speed    else null end,
    position_at = now(), updated_at = now()
  where purchase_id = p_purchase_id and mode = 'self' and status = 'out_for_delivery'
    and (position_at is null or position_at < now() - interval '2 seconds');

  if not found and not exists (
    select 1 from public.delivery_tracking
    where purchase_id = p_purchase_id and mode = 'self' and status = 'out_for_delivery') then
    raise exception 'This delivery is not out for delivery.';
  end if;
end $$;

-- ---------- SELLER: mark delivered (also erases the stored GPS point for privacy) ----------
create or replace function public.track_delivered(p_purchase_id uuid)
returns public.delivery_tracking
language plpgsql security definer set search_path = '' as $$
declare r public.delivery_tracking;
begin
  if auth.uid() is null or not public.track_is_seller(p_purchase_id) then raise exception 'Not allowed'; end if;
  update public.delivery_tracking set
    status = 'delivered', delivered_at = now(), updated_at = now(),
    lat = null, lng = null, accuracy = null, heading = null, speed = null, position_at = null
  where purchase_id = p_purchase_id and status = 'out_for_delivery'
  returning * into r;
  if r.purchase_id is null then raise exception 'This delivery is not out for delivery.'; end if;
  return r;
end $$;

-- ---------- BUYER: drop the delivery pin ----------
create or replace function public.track_destination(p_purchase_id uuid, p_lat double precision, p_lng double precision)
returns public.delivery_tracking
language plpgsql security definer set search_path = '' as $$
declare r public.delivery_tracking; pm record;
begin
  if auth.uid() is null or not public.track_is_buyer(p_purchase_id) then raise exception 'Not allowed'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid position.'; end if;
  select delivery_method, transaction_status into pm from public.purchases where id = p_purchase_id;
  if pm.delivery_method is distinct from 'delivery' then raise exception 'This order is a meet-up, not a delivery.'; end if;
  if pm.transaction_status not in ('accepted','completed') then raise exception 'The seller has not accepted this order yet.'; end if;

  insert into public.delivery_tracking (purchase_id, dest_lat, dest_lng, updated_at)
  values (p_purchase_id, p_lat, p_lng, now())
  on conflict (purchase_id) do update set dest_lat = excluded.dest_lat, dest_lng = excluded.dest_lng, updated_at = now()
  where public.delivery_tracking.status <> 'delivered'
  returning * into r;
  if r.purchase_id is null then raise exception 'This delivery is already marked delivered.'; end if;
  return r;
end $$;

-- ---------- who may call the functions ----------
revoke all on function public.track_is_seller(uuid) from public, anon;
revoke all on function public.track_is_buyer(uuid) from public, anon;
revoke all on function public.track_start(uuid, text, text, text, text) from public, anon;
revoke all on function public.track_position(uuid, double precision, double precision, double precision, double precision, double precision) from public, anon;
revoke all on function public.track_delivered(uuid) from public, anon;
revoke all on function public.track_destination(uuid, double precision, double precision) from public, anon;
grant execute on function public.track_is_seller(uuid) to authenticated;
grant execute on function public.track_is_buyer(uuid) to authenticated;
grant execute on function public.track_start(uuid, text, text, text, text) to authenticated;
grant execute on function public.track_position(uuid, double precision, double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.track_delivered(uuid) to authenticated;
grant execute on function public.track_destination(uuid, double precision, double precision) to authenticated;

-- ---------- Realtime: pushes each new GPS point to the buyer's screen ----------
do $$
begin
  alter publication supabase_realtime add table public.delivery_tracking;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
