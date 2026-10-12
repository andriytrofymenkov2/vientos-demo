-- =============================================================================
-- VIENTOS GYM · anular o modificar pagos: solo el dueño (12/10/2026)
-- Pegar COMPLETO en Supabase → SQL Editor → New query → Run. No toca datos.
-- Los profes siguen pudiendo ver y registrar pagos (cobrar), pero no borrarlos
-- ni cambiarles el monto.
-- =============================================================================
drop policy if exists "pagos staff" on public.payments;
drop policy if exists "pagos staff lee" on public.payments;
create policy "pagos staff lee" on public.payments for select to authenticated using (public.is_staff());
drop policy if exists "pagos staff cobra" on public.payments;
create policy "pagos staff cobra" on public.payments for insert to authenticated with check (public.is_staff());
drop policy if exists "pagos dueño" on public.payments;
create policy "pagos dueño" on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());

select 'Listo: solo el dueño puede anular pagos' as resultado;
