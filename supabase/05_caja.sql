-- =============================================================================
-- CAJA: gastos y otros ingresos del gimnasio (los carga y los ve SOLO el dueño).
-- Las cuotas cobradas ya son ingresos: salen de la tabla de pagos.
-- Pegar COMPLETO en Supabase → SQL Editor → New query → Run. Se puede volver a correr.
-- =============================================================================
create table if not exists public.movements (
  id text primary key,
  at timestamptz not null default now(),
  amount numeric not null default 0 check (amount >= 0),
  kind text not null check (kind in ('gasto', 'ingreso')),
  data jsonb not null default '{}'::jsonb            -- categoría, detalle, espacio
);
create index if not exists movements_at_idx on public.movements (at desc);

alter table public.movements enable row level security;
drop policy if exists movements_admin_all on public.movements;
create policy movements_admin_all on public.movements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Permisos de la Data API (solo usuarios con sesión; la política deja pasar solo al dueño)
revoke all on public.movements from anon;
grant select, insert, update, delete on public.movements to authenticated;
