-- =============================================================================
-- ASISTENCIA: una sola entrada por socio por día, aunque la registren dos computadoras.
-- Completa el día de las entradas que ya había, borra repetidas (deja la primera) y lo hace obligatorio.
-- Pegar COMPLETO en Supabase → SQL Editor → New query → Run. Se puede volver a correr.
-- =============================================================================
update public.checkins
   set data = data || jsonb_build_object('day', to_char(at at time zone 'America/Argentina/Rio_Gallegos', 'YYYY-MM-DD'))
 where data->>'day' is null;

delete from public.checkins c
 using public.checkins o
 where c.user_id = o.user_id and c.data->>'day' = o.data->>'day' and (c.at, c.id) > (o.at, o.id);

create unique index if not exists checkins_un_dia on public.checkins (user_id, (data->>'day'));
