alter table public.profiles
  add constraint profiles_avatar_url_length
  check (avatar_url is null or char_length(avatar_url) <= 2048);

revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
