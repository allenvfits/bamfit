create index if not exists bookings_package_id_idx on public.bookings(package_id);
create index if not exists bamfit_orders_client_id_idx on public.bamfit_orders(client_id);

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
