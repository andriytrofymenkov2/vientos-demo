-- =============================================================================
-- RECONOCIMIENTO FACIAL: huella numérica de la cara de cada socio que lo ACEPTÓ.
-- No se guarda ninguna foto. La ve y la carga solo el personal del gimnasio (recepción);
-- el socio puede borrarla (retirar el consentimiento) y se borra sola si se da de baja.
-- Pegar COMPLETO en Supabase → SQL Editor → New query → Run. Se puede volver a correr.
-- =============================================================================
create table if not exists public.faces (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  data jsonb not null,                                -- { emb: [números], at }
  updated_at timestamptz not null default now()
);

alter table public.faces enable row level security;
drop policy if exists faces_staff on public.faces;
create policy faces_staff on public.faces for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists faces_socio_borra on public.faces;
create policy faces_socio_borra on public.faces for delete to authenticated using (user_id = auth.uid());

-- si el socio se da de baja, su huella facial se borra
create or replace function private.faces_baja() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'baja' and old.status is distinct from 'baja' then delete from public.faces where user_id = new.id; end if;
  return new;
end $$;
drop trigger if exists faces_baja on public.profiles;
create trigger faces_baja after update of status on public.profiles for each row execute function private.faces_baja();

revoke all on public.faces from anon;
grant select, insert, update, delete on public.faces to authenticated;
