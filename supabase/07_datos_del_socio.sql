-- =============================================================================
-- DATOS DEL SOCIO: el socio NO puede cambiar su nombre y apellido, su DNI (usuario) ni su email,
-- ni su cuota, plan, profe o estado. SÍ puede cambiar su teléfono, fecha de nacimiento, género y
-- preferencias. El nombre, el DNI y el email los corrige el gimnasio desde el panel.
-- Pegar COMPLETO en Supabase → SQL Editor → New query → Run. Se puede volver a correr.
-- =============================================================================
create or replace function private.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Desde el SQL Editor de Supabase (sin usuario de la app) se permite todo: lo usa make_admin
  if auth.uid() is null then return new; end if;
  if not public.is_staff() then
    new.role := old.role; new.status := old.status; new.coach_id := old.coach_id; new.fee := old.fee;
    new.name := old.name;
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
