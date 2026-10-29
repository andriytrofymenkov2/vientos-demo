-- =============================================================================
-- OPINIONES: calificaciones del 1 al 10, sugerencias y reclamos de los socios.
-- El socio crea y ve las suyas; el dueño ve todas, las marca resueltas y responde.
-- Pegar COMPLETO en Supabase → SQL Editor → New query → Run. Se puede volver a correr.
-- =============================================================================
create table if not exists public.feedback (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null check (kind in ('puntaje', 'sugerencia', 'reclamo')),
  data jsonb not null default '{}'::jsonb            -- puntajes, texto, estado, respuesta, espacio
);
create index if not exists feedback_at_idx on public.feedback (at desc);

alter table public.feedback enable row level security;
drop policy if exists feedback_socio_lee on public.feedback;
create policy feedback_socio_lee on public.feedback for select to authenticated using (user_id = auth.uid() and public.is_active());
drop policy if exists feedback_socio_crea on public.feedback;
create policy feedback_socio_crea on public.feedback for insert to authenticated with check (user_id = auth.uid() and public.is_active());
drop policy if exists feedback_socio_edita on public.feedback;
create policy feedback_socio_edita on public.feedback for update to authenticated using (user_id = auth.uid() and kind = 'puntaje') with check (user_id = auth.uid() and kind = 'puntaje');
drop policy if exists feedback_dueno on public.feedback;
create policy feedback_dueno on public.feedback for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.feedback from anon;
grant select, insert, update, delete on public.feedback to authenticated;
