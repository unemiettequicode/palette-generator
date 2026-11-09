-- Crée automatiquement un profil dans public.profiles
-- à chaque nouvel utilisateur inséré dans auth.users.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''  -- bonne pratique SECURITY DEFINER : évite le détournement via search_path
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'NouvelUtilisateur'),
    coalesce(new.raw_user_meta_data ->> 'role', 'student')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
