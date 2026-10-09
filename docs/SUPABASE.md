# Conectar la app de Vientos a Supabase (paso a paso)

Tiempo: unos 15 minutos. Se hace una sola vez.

## 1. Crear el proyecto
1. Entrá a https://supabase.com con tu cuenta (la misma del campus).
2. **New project**:
   - Nombre: `vientos-gym`
   - Database password: tocá **Generate a password** y guardala en un lugar seguro (no hace falta pasármela).
   - Region: **South America (São Paulo)**.
3. Esperá 1–2 minutos a que termine de crearse.

## 2. Pasarle a Claude dos datos
En **Project Settings → API** (o **Data API**):
- **Project URL** → `https://xxxx.supabase.co`
- **anon / publishable key** → empieza con `eyJ…` o `sb_publishable_…`

⚠️ Nunca pases la **service_role** ni la **secret key**.

## 3. Crear la base de datos
1. Menú izquierdo → **SQL Editor** → **New query**.
2. Abrí el archivo `supabase/01_esquema.sql`, copiá TODO y pegalo.
3. **Run**. Tiene que decir "Success. No rows returned".

## 4. Ajustes de ingreso
**Authentication → Sign In / Providers → Email**:
- **Confirm email: APAGADO** (los socios entran sin tener que confirmar un correo; la aprobación la hace el profe).
- Guardar.

**Authentication → URL Configuration**:
- Site URL: `https://andriytrofymenkov2.github.io/vientos-demo/`

## 5. Crear tu usuario de dueño
1. **Authentication → Users → Add user → Create new user**.
2. Tu email y una contraseña. Marcá **Auto Confirm User**.
3. Volvé al **SQL Editor**, nueva consulta, y corré (con tu email):
   ```sql
   select make_admin('tu-email@ejemplo.com');
   ```
   Tiene que responder "Listo: … ahora es dueño".

## 6. Primer ingreso
Abrí la app, ingresá con ese email y contraseña. En ese primer ingreso la app carga
sola los 58 ejercicios, las 8 plantillas y los datos del gimnasio.

Después, desde el panel:
- **Gimnasio → Sumar profe** para crear las cuentas de los profes.
- **Socios → Nuevo socio** (o que se registren solos con el código `VIENTOS`).

## La demostración sigue disponible
Con `?demo` en la dirección se abre la versión con datos de ejemplo:
`https://andriytrofymenkov2.github.io/vientos-demo/?demo#/ingresar`
