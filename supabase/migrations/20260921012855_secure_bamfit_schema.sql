-- BAM FIT production schema.
-- Customer-facing data is protected with row-level security (RLS).
-- Operational and payment data is available only to the server-side service role.

create schema if not exists private;
revoke all on schema private from public;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text not null default '' check (char_length(phone) <= 40),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text not null unique check (char_length(email) between 3 and 254),
  phone text not null default '' check (char_length(phone) <= 40),
  goal text not null default '' check (char_length(goal) <= 1000),
  notes text not null default '' check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('10_sessions', '15_sessions', '25_sessions')),
  total_sessions integer not null check (total_sessions in (10, 15, 25)),
  credits_remaining integer not null check (credits_remaining between 0 and total_sessions),
  amount_paid integer not null check (amount_paid > 0),
  stripe_payment_id text unique,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 year')
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  package_id uuid references public.packages(id) on delete set null,
  service_type text not null check (char_length(service_type) between 1 and 120),
  session_date timestamptz not null,
  duration_mins integer not null default 60 check (duration_mins between 15 and 240),
  notes text not null default '' check (char_length(notes) <= 5000),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.pnf_appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  session_length text not null check (session_length in ('intro_20', 'session_25', 'session_50')),
  amount_paid integer not null check (amount_paid > 0),
  session_date timestamptz not null,
  notes text not null default '' check (char_length(notes) <= 5000),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  meal_plan text not null default '' check (char_length(meal_plan) <= 10000),
  supplements text not null default '' check (char_length(supplements) <= 5000),
  notes text not null default '' check (char_length(notes) <= 5000),
  amount_paid integer not null default 10000 check (amount_paid >= 0),
  active boolean not null default true,
  start_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.bamfit_payment_connection (
  id integer primary key check (id = 1),
  account_id text not null unique,
  livemode boolean not null,
  connected_at timestamptz not null default now()
);

create table if not exists public.bamfit_orders (
  stripe_session_id text primary key,
  client_id uuid not null references public.clients(id) on delete restrict,
  account_id text not null,
  package_type text not null check (package_type in ('10_sessions', '15_sessions', '25_sessions')),
  client_name text not null check (char_length(client_name) between 1 and 120),
  client_email text not null check (char_length(client_email) between 3 and 254),
  amount integer not null check (amount > 0),
  stripe_payment_id text not null unique,
  status text not null check (status in ('paid', 'refunded', 'disputed')),
  fulfillment_status text not null default 'pending' check (fulfillment_status in ('pending', 'fulfilled', 'cancelled')),
  paid_at timestamptz not null
);

alter table public.contact_forms
  add column if not exists read boolean not null default false,
  add column if not exists submitted_at timestamptz not null default now();

update public.contact_forms
set submitted_at = created_at
where created_at is not null and submitted_at > created_at;

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists bookings_client_date_idx on public.bookings(client_id, session_date desc);
create index if not exists bookings_package_id_idx on public.bookings(package_id);
create index if not exists bookings_upcoming_idx on public.bookings(session_date) where status in ('pending', 'confirmed');
create index if not exists packages_client_idx on public.packages(client_id, purchased_at desc);
create index if not exists pnf_client_date_idx on public.pnf_appointments(client_id, session_date desc);
create index if not exists nutrition_client_idx on public.nutrition_plans(client_id, start_date desc);
create index if not exists contact_forms_submitted_at_idx on public.contact_forms(submitted_at desc);
create index if not exists bamfit_orders_paid_at_idx on public.bamfit_orders(paid_at desc);
create index if not exists bamfit_orders_client_id_idx on public.bamfit_orders(client_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.owns_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.clients
      where id = target_client_id
        and user_id = (select auth.uid())
    );
$$;

revoke all on function private.owns_client(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.owns_client(uuid) to authenticated;

create or replace function public.deduct_session_credit(p_booking_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_package_id uuid;
  booking_status text;
begin
  select package_id, status into selected_package_id, booking_status
  from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if booking_status = 'completed' then return; end if;
  if booking_status = 'cancelled' then raise exception 'Cancelled bookings cannot be completed'; end if;

  if selected_package_id is not null then
    update public.packages set credits_remaining = credits_remaining - 1
    where id = selected_package_id and credits_remaining > 0;
    if not found then raise exception 'No session credits remain'; end if;
  end if;
  update public.bookings set status = 'completed' where id = p_booking_id;
end;
$$;

create or replace function public.record_bamfit_order(
  p_stripe_session_id text,
  p_account_id text,
  p_package_type text,
  p_client_name text,
  p_client_email text,
  p_amount integer,
  p_stripe_payment_id text,
  p_paid_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_client_id uuid;
  session_count integer;
begin
  session_count := case p_package_type
    when '10_sessions' then 10
    when '15_sessions' then 15
    when '25_sessions' then 25
    else null
  end;
  if session_count is null then raise exception 'Unknown package type'; end if;

  insert into public.clients (full_name, email)
  values (trim(p_client_name), lower(trim(p_client_email)))
  on conflict (email) do update set full_name = excluded.full_name
  returning id into selected_client_id;

  insert into public.bamfit_orders (
    stripe_session_id, client_id, account_id, package_type,
    client_name, client_email, amount, stripe_payment_id,
    status, fulfillment_status, paid_at
  ) values (
    p_stripe_session_id, selected_client_id, p_account_id, p_package_type,
    trim(p_client_name), lower(trim(p_client_email)), p_amount, p_stripe_payment_id,
    'paid', 'pending', p_paid_at
  ) on conflict (stripe_session_id) do nothing;

  insert into public.packages (
    client_id, type, total_sessions, credits_remaining,
    amount_paid, stripe_payment_id, purchased_at, expires_at
  ) values (
    selected_client_id, p_package_type, session_count, session_count,
    p_amount, p_stripe_payment_id, p_paid_at, p_paid_at + interval '1 year'
  ) on conflict (stripe_payment_id) do nothing;

  return selected_client_id;
end;
$$;

drop view if exists public.upcoming_bookings;
create view public.upcoming_bookings with (security_invoker = true) as
select b.*, c.full_name as client_name, c.email as client_email, c.phone as client_phone
from public.bookings b
join public.clients c on c.id = b.client_id
where b.session_date >= now() and b.status in ('pending', 'confirmed')
order by b.session_date;

drop view if exists public.active_packages;
create view public.active_packages with (security_invoker = true) as
select p.*, c.full_name as client_name, c.email as client_email
from public.packages p
join public.clients c on c.id = p.client_id
where p.credits_remaining > 0 and p.expires_at >= now();

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.packages enable row level security;
alter table public.bookings enable row level security;
alter table public.pnf_appointments enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.contact_forms enable row level security;
alter table public.bamfit_payment_connection enable row level security;
alter table public.bamfit_orders enable row level security;

revoke all on table public.profiles, public.clients, public.packages, public.bookings,
  public.pnf_appointments, public.nutrition_plans, public.contact_forms,
  public.bamfit_payment_connection, public.bamfit_orders from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant select on public.packages, public.bookings, public.pnf_appointments, public.nutrition_plans to authenticated;

grant select, insert, update, delete on table public.profiles, public.clients, public.packages,
  public.bookings, public.pnf_appointments, public.nutrition_plans, public.contact_forms,
  public.bamfit_payment_connection, public.bamfit_orders to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on public.upcoming_bookings, public.active_packages from anon, authenticated;
grant select on public.upcoming_bookings, public.active_packages to service_role;
revoke all on function public.deduct_session_credit(uuid) from public, anon, authenticated;
revoke all on function public.record_bamfit_order(text, text, text, text, text, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.deduct_session_credit(uuid) to service_role;
grant execute on function public.record_bamfit_order(text, text, text, text, text, integer, text, timestamptz) to service_role;

drop policy if exists contact_forms_server_only on public.contact_forms;
create policy contact_forms_server_only on public.contact_forms for all to anon, authenticated
using (false) with check (false);

drop policy if exists clients_server_only on public.clients;
create policy clients_server_only on public.clients for all to anon, authenticated
using (false) with check (false);

drop policy if exists payment_connection_server_only on public.bamfit_payment_connection;
create policy payment_connection_server_only on public.bamfit_payment_connection for all to anon, authenticated
using (false) with check (false);

drop policy if exists orders_server_only on public.bamfit_orders;
create policy orders_server_only on public.bamfit_orders for all to anon, authenticated
using (false) with check (false);

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists packages_select_own on public.packages;
create policy packages_select_own on public.packages for select to authenticated
using ((select private.owns_client(client_id)));

drop policy if exists bookings_select_own on public.bookings;
create policy bookings_select_own on public.bookings for select to authenticated
using ((select private.owns_client(client_id)));

drop policy if exists pnf_select_own on public.pnf_appointments;
create policy pnf_select_own on public.pnf_appointments for select to authenticated
using ((select private.owns_client(client_id)));

drop policy if exists nutrition_select_own on public.nutrition_plans;
create policy nutrition_select_own on public.nutrition_plans for select to authenticated
using ((select private.owns_client(client_id)));
