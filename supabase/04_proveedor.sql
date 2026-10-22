-- =============================================================================
-- Proveedor de la plataforma: ve los dos negocios (Vientos GYM y Fitz Club) y
-- elige en cuál trabajar desde el panel. Los dueños, profes y socios de cada
-- negocio ven solo lo suyo.
-- Se corre una vez en Supabase > SQL Editor, cambiando el email por el de la
-- cuenta del proveedor (tiene que ser administrador).
-- =============================================================================

update public.profiles
set prefs = coalesce(prefs, '{}'::jsonb) || '{"space":"all"}'::jsonb
where email = 'EMAIL_DEL_PROVEEDOR' and role = 'admin';

-- Para comprobarlo: tiene que aparecer "space": "all"
select name, role, prefs from public.profiles where email = 'EMAIL_DEL_PROVEEDOR';
