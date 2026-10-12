-- =============================================================================
-- VIENTOS GYM · ajustes de seguridad (revisión del 12/10/2026)
-- Pegar COMPLETO en Supabase → SQL Editor → New query → Run. Se puede volver a
-- correr sin romper nada. No toca ningún dato: solo reglas.
--
--   1. Un profe ya no puede modificar ni dar de baja al dueño ni a otro profe
--      (antes podía, por ejemplo, dejar al dueño "de baja" y sin acceso).
--   2. Quien se registra sin el código del gimnasio no puede quedarse con el
--      DNI de otra persona como usuario (queda su email, pendiente de aprobación).
--   3. "Volver a su DNI" funciona también con DNI de 7 números (mínimo 6).
-- =============================================================================

-- 1 ---------------------------------------------------------------- perfiles
create or replace function private.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Desde el SQL Editor de Supabase (sin usuario de la app) se permite todo: lo usa make_admin
  if auth.uid() is null then return new; end if;
  if not public.is_staff() then
    new.role := old.role; new.status := old.status; new.coach_id := old.coach_id; new.fee := old.fee;
  elsif not public.is_admin() then
    -- el profe maneja socios; a otro profe o al dueño solo los cambia el dueño
    if old.role <> 'socio' and old.id <> auth.uid() then
      raise exception 'Solo el dueño puede modificar a un profe o administrador';
    end if;
    new.role := old.role;
    if old.id = auth.uid() then new.status := old.status; end if;
  end if;
  new.id := old.id; new.username := old.username; new.email := old.email; new.joined := old.joined;
  return new;
end $$;

-- 2 ------------------------------------------------------------------- altas
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_code text := new.raw_user_meta_data ->> 'code';
        v_ok text := (select data ->> 'joinCode' from public.gym where id = 1);
        v_valid boolean;
begin
  if v_code is not null and v_ok is not null and upper(trim(v_code)) <> upper(trim(v_ok)) then
    raise exception 'El código del gimnasio no es correcto. Pedilo en recepción.';
  end if;
  v_valid := v_code is not null and v_ok is not null;
  insert into public.profiles (id, name, username, email, phone)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
          -- el DNI como usuario solo con el código del gimnasio (alta en recepción o registro válido)
          lower(case when v_valid then coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), new.email) else new.email end),
          lower(new.email),
          coalesce(new.raw_user_meta_data ->> 'phone', ''))
  on conflict (id) do nothing;
  return new;
end $$;

-- 3 ------------------------------------------------------- contraseña nueva
create or replace function public.staff_set_password(p_user uuid, p_pass text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_role text := (select role from public.profiles where id = p_user);
begin
  if not public.is_staff() then raise exception 'Sin permiso'; end if;
  if v_role is null then raise exception 'No existe esa cuenta'; end if;
  if v_role <> 'socio' and not public.is_admin() then raise exception 'Solo el dueño puede cambiar la contraseña de un profe'; end if;
  if length(p_pass) < 6 then raise exception 'La contraseña es muy corta'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_pass, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

revoke execute on all functions in schema private from anon, authenticated, public;
revoke execute on function public.staff_set_password(uuid, text) from anon, public;
grant execute on function public.staff_set_password(uuid, text) to authenticated;

select 'Listo: ajustes de seguridad aplicados' as resultado;
