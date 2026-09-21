-- Align the operational schema with Anthony's current published offerings.
-- Legacy values remain valid so historical purchases are never invalidated.

alter table public.packages
  drop constraint if exists packages_type_check,
  drop constraint if exists packages_total_sessions_check;

alter table public.packages
  add constraint packages_type_check
    check (type in ('6_sessions', '10_sessions', '15_sessions', '25_sessions')),
  add constraint packages_total_sessions_check
    check (total_sessions in (6, 10, 15, 25)),
  alter column expires_at set default (now() + interval '90 days');

alter table public.bamfit_orders
  drop constraint if exists bamfit_orders_package_type_check;

alter table public.bamfit_orders
  add constraint bamfit_orders_package_type_check
    check (package_type in ('6_sessions', '10_sessions', '15_sessions', '25_sessions'));

alter table public.pnf_appointments
  drop constraint if exists pnf_appointments_session_length_check;

alter table public.pnf_appointments
  add constraint pnf_appointments_session_length_check
    check (session_length in ('intro_20', 'intro_25', 'session_25', 'session_50'));

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
    when '6_sessions' then 6
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
    p_amount, p_stripe_payment_id, p_paid_at, p_paid_at + interval '90 days'
  ) on conflict (stripe_payment_id) do nothing;

  return selected_client_id;
end;
$$;
