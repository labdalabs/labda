-- Mirror every new Supabase auth user into a Profile row on signup. The app
-- previously only created a Profile lazily (when a user first created a
-- project), so a user who had merely signed in couldn't be found by email —
-- which broke project sharing. This is the trigger the code already assumed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public."Profile" (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
