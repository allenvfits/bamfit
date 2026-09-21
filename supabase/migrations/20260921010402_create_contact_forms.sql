create table if not exists public.contact_forms (
  id bigint generated always as identity primary key,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text not null default '' check (char_length(phone) <= 40),
  interest text not null default '' check (char_length(interest) <= 120),
  message text not null default '' check (char_length(message) <= 5000),
  created_at timestamptz not null default now()
);

alter table public.contact_forms enable row level security;
revoke all on table public.contact_forms from anon, authenticated;
grant select, insert, update, delete on table public.contact_forms to service_role;
grant usage, select on sequence public.contact_forms_id_seq to service_role;
create index if not exists contact_forms_created_at_idx
  on public.contact_forms (created_at desc);
