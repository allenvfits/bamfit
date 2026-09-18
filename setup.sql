-- Run once in the dedicated BAM FIT Supabase project. Server-only tables.
create table if not exists public.bamfit_payment_connection (
 id integer primary key check(id=1), account_id text not null unique,
 livemode boolean not null, connected_at timestamptz not null default now()
);
create table if not exists public.bamfit_orders (
 stripe_session_id text primary key, account_id text not null,
 package_type text not null, client_name text, client_email text,
 amount integer not null check(amount>0), stripe_payment_id text,
 status text not null, fulfillment_status text not null default 'pending', paid_at timestamptz not null
);
alter table public.bamfit_payment_connection enable row level security;
alter table public.bamfit_orders enable row level security;
revoke all on public.bamfit_payment_connection,public.bamfit_orders from anon,authenticated;
grant select,insert,update,delete on public.bamfit_payment_connection,public.bamfit_orders to service_role;
