-- =============================================================================
-- ASISTENCIA: cada entrada del socio que registra recepción (por la cara, por DNI o "dejar pasar igual").
-- La carga y la ve el personal del gimnasio. El socio puede ver las suyas.
-- Pegar COMPLETO en Supabase → SQL Editor → New query → Run. Se puede volver a correr.
-- =============================================================================
create table if not exists public.checkins (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb            -- vía (cara, dni, manual) y quién la registró
);
create index if not exists checkins_at_idx on public.checkins (at desc);
create index if not exists checkins_user_idx on public.checkins (user_id, at desc);

alter table public.checkins enable row level security;
drop policy if exists checkins_staff on public.checkins;
create policy checkins_staff on public.checkins for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists checkins_socio_lee on public.checkins;
create policy checkins_socio_lee on public.checkins for select to authenticated using (user_id = auth.uid());

revoke all on public.checkins from anon;
grant select, insert, update, delete on public.checkins to authenticated;
