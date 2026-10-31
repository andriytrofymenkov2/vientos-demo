-- =============================================================================
-- ASISTENCIA: un socio puede entrar más de una vez por día (a la mañana al gimnasio y a la tarde
-- a otra actividad). Saca la regla de "una sola entrada por día" del paso 10.
-- La app evita contar dos veces la misma visita (entre una entrada y otra tienen que pasar 2 horas).
-- Pegar COMPLETO en Supabase → SQL Editor → New query → Run. Se puede volver a correr.
-- =============================================================================
drop index if exists public.checkins_un_dia;
