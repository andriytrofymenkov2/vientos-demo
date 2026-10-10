-- =============================================================================
-- VIENTOS GYM · base de datos (Supabase)
-- Pegar COMPLETO en Supabase → SQL Editor → New query → Run. Se puede volver a
-- correr sin romper nada (crea lo que falta y actualiza funciones y políticas).
--
-- Seguridad (RLS):
--   · socio      → ve y edita solo lo suyo (perfil, rutina, registros).
--   · profe      → ve todos los socios, arma rutinas, aprueba altas, cobra.
--   · admin      → todo lo anterior + datos del gimnasio, planes y profes.
--   · pendiente  → cuenta creada que todavía no aprobaron: no ve nada.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

-- ------------------------------------------------------------------ tablas
create table if not exists public.gym (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,       -- nombre, dirección, horarios, código, planes...
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'socio' check (role in ('socio', 'profe', 'admin')),
  status text not null default 'pendiente' check (status in ('pendiente', 'activo', 'baja')),
  name text not null default '',
  username text unique,
  email text,
  phone text default '',
  birth text default '',
  gender text default '',
  coach_id uuid references public.profiles (id) on delete set null,
  fee jsonb,                                      -- {planId, dueAt}
  prefs jsonb not null default '{"theme":"dark","sound":true}'::jsonb,
  joined timestamptz not null default now()
);

create table if not exists public.exercises (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id text primary key,
  data jsonb not null,                            -- nombre, nivel, días → bloques → ejercicios
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.routines (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  active boolean not null default true,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists routines_user on public.routines (user_id);

create table if not exists public.logs (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null,
  data jsonb not null                             -- día, minutos, series con peso y reps
);
create index if not exists logs_user_at on public.logs (user_id, at desc);

create table if not exists public.live (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  data jsonb not null,                            -- entrenamiento en curso
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  amount numeric not null default 0,
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.notices (
  id text primary key,
  at timestamptz not null default now(),
  data jsonb not null
);

-- --------------------------------------------------------------- ayudantes
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'activo';
$$;
create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'activo');
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('profe', 'admin'), false);
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false);
$$;

-- --------------------------------------------- alta de cuentas (auth → perfil)
-- Al crear un usuario se crea su perfil "pendiente". Si se registra desde la app
-- tiene que traer el código del gimnasio; si el código no coincide, se rechaza.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_code text := new.raw_user_meta_data ->> 'code';
        v_ok text := (select data ->> 'joinCode' from public.gym where id = 1);
begin
  if v_code is not null and v_ok is not null and upper(trim(v_code)) <> upper(trim(v_ok)) then
    raise exception 'El código del gimnasio no es correcto. Pedilo en recepción.';
  end if;
  insert into public.profiles (id, name, username, email, phone)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
          lower(coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), new.email)),   -- el DNI del socio, o su email
          lower(new.email),
          coalesce(new.raw_user_meta_data ->> 'phone', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

-- Un socio puede editar sus datos personales, pero no su rol, estado, profe ni cuota.
create or replace function private.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Desde el SQL Editor de Supabase (sin usuario de la app) se permite todo: lo usa make_admin
  if auth.uid() is null then return new; end if;
  if not public.is_staff() then
    new.role := old.role; new.status := old.status; new.coach_id := old.coach_id; new.fee := old.fee;
  elsif not public.is_admin() then
    new.role := old.role;                                   -- solo el dueño cambia roles
  end if;
  new.id := old.id; new.username := old.username; new.email := old.email; new.joined := old.joined;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles for each row execute function private.protect_profile();

-- ---------------------------------------------------------------- políticas
alter table public.gym enable row level security;
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.templates enable row level security;
alter table public.routines enable row level security;
alter table public.logs enable row level security;
alter table public.live enable row level security;
alter table public.payments enable row level security;
alter table public.notices enable row level security;

drop policy if exists "gym lee" on public.gym;
create policy "gym lee" on public.gym for select to authenticated using (public.is_active());
drop policy if exists "gym admin" on public.gym;
create policy "gym admin" on public.gym for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "perfil propio" on public.profiles;
create policy "perfil propio" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "perfil profes visibles" on public.profiles;
create policy "perfil profes visibles" on public.profiles for select to authenticated using (public.is_active() and role in ('profe', 'admin') and status = 'activo');
drop policy if exists "perfil staff lee" on public.profiles;
create policy "perfil staff lee" on public.profiles for select to authenticated using (public.is_staff());
drop policy if exists "perfil edita propio" on public.profiles;
create policy "perfil edita propio" on public.profiles for update to authenticated using (id = auth.uid() and public.is_active()) with check (id = auth.uid());
drop policy if exists "perfil staff edita" on public.profiles;
create policy "perfil staff edita" on public.profiles for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "ejercicios lee" on public.exercises;
create policy "ejercicios lee" on public.exercises for select to authenticated using (public.is_active());
drop policy if exists "ejercicios staff" on public.exercises;
create policy "ejercicios staff" on public.exercises for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "plantillas staff" on public.templates;
create policy "plantillas staff" on public.templates for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "rutinas propias" on public.routines;
create policy "rutinas propias" on public.routines for select to authenticated using (user_id = auth.uid() and public.is_active());
drop policy if exists "rutinas staff" on public.routines;
create policy "rutinas staff" on public.routines for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "registros propios" on public.logs;
create policy "registros propios" on public.logs for all to authenticated using (user_id = auth.uid() and public.is_active()) with check (user_id = auth.uid() and public.is_active());
drop policy if exists "registros staff lee" on public.logs;
create policy "registros staff lee" on public.logs for select to authenticated using (public.is_staff());

drop policy if exists "en curso propio" on public.live;
create policy "en curso propio" on public.live for all to authenticated using (user_id = auth.uid() and public.is_active()) with check (user_id = auth.uid() and public.is_active());
drop policy if exists "en curso staff lee" on public.live;
create policy "en curso staff lee" on public.live for select to authenticated using (public.is_staff());

drop policy if exists "pagos propios" on public.payments;
create policy "pagos propios" on public.payments for select to authenticated using (user_id = auth.uid() and public.is_active());
drop policy if exists "pagos staff" on public.payments;
create policy "pagos staff" on public.payments for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "avisos lee" on public.notices;
create policy "avisos lee" on public.notices for select to authenticated using (public.is_active());
drop policy if exists "avisos staff" on public.notices;
create policy "avisos staff" on public.notices for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- --------------------------------------------------- funciones del servidor
-- Ingreso con usuario o email: devuelve el email SOLO si la contraseña es correcta
-- (no deja averiguar qué cuentas existen). Máximo 8 intentos cada 15 minutos.
create table if not exists private.login_attempts (ident text not null, at timestamptz not null default now());
create or replace function public.login_email(p_ident text, p_pass text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_email text; v_hash text; v_n int; v_id text := lower(trim(p_ident));
begin
  if random() < 0.02 then delete from private.login_attempts where at < now() - interval '1 day'; end if;
  select count(*) into v_n from private.login_attempts where ident = v_id and at > now() - interval '15 minutes';
  if v_n >= 8 then raise exception 'Demasiados intentos. Esperá 15 minutos.'; end if;
  select u.email, u.encrypted_password into v_email, v_hash
    from auth.users u join public.profiles p on p.id = u.id
   where p.username = v_id or lower(u.email) = v_id
   limit 1;
  if v_hash is null or extensions.crypt(p_pass, v_hash) <> v_hash then
    insert into private.login_attempts (ident) values (v_id);
    return null;
  end if;
  delete from private.login_attempts where ident = v_id;
  return v_email;
end $$;

-- El profe o el dueño le genera una contraseña nueva a un socio (no a otro profe).
create or replace function public.staff_set_password(p_user uuid, p_pass text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_role text := (select role from public.profiles where id = p_user);
begin
  if not public.is_staff() then raise exception 'Sin permiso'; end if;
  if v_role <> 'socio' and not public.is_admin() then raise exception 'Solo el dueño puede cambiar la contraseña de un profe'; end if;
  if length(p_pass) < 8 then raise exception 'La contraseña es muy corta'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_pass, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

-- Rechazar una solicitud de alta (borra la cuenta pendiente).
create or replace function public.staff_reject(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Sin permiso'; end if;
  if not exists (select 1 from public.profiles where id = p_user and status = 'pendiente') then raise exception 'Solo se pueden rechazar cuentas pendientes'; end if;
  delete from auth.users where id = p_user;
end $$;

-- El socio borra su cuenta y todos sus datos (lo exige la ley de datos personales).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- Primer dueño: correr UNA vez desde el SQL Editor (no se puede llamar desde la app).
create or replace function public.make_admin(p_email text) returns text
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set role = 'admin', status = 'activo', name = case when name = '' then 'Administración' else name end
   where lower(email) = lower(trim(p_email));
  if not found then return 'No existe un usuario con ese email: crealo primero en Authentication → Users'; end if;
  return 'Listo: ' || p_email || ' ahora es dueño (administrador)';
end $$;

-- Datos públicos del gimnasio para la pantalla de ingreso (sin código ni precios).
create or replace function public.public_gym() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select data - 'joinCode' - 'plans' - 'convenios' from public.gym where id = 1), '{}'::jsonb);
$$;

-- "Despertador": consulta mínima para que el proyecto gratis no se pause.
create or replace function public.ping() returns text language sql stable as $$ select 'ok'::text $$;

revoke execute on all functions in schema public from anon, public;
revoke execute on all functions in schema private from anon, authenticated, public;
grant execute on function public.login_email(text, text), public.ping(), public.public_gym() to anon, authenticated;
grant execute on function public.my_role(), public.is_active(), public.is_staff(), public.is_admin(),
  public.staff_set_password(uuid, text), public.staff_reject(uuid), public.delete_my_account() to authenticated;
revoke execute on function public.make_admin(text) from authenticated;
