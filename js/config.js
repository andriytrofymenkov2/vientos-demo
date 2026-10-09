/* =========================================================================
   CONFIGURACIÓN DE LA APP DE VIENTOS
   - mode "demo": funciona sin servidor, con datos de ejemplo guardados en el
     navegador. Sirve para mostrar y probar; NO usar con socios reales.
   - mode "supabase": socios, rutinas y registros reales (próxima etapa).
   ========================================================================= */
export const CONFIG = {
  mode: "supabase",
  supabaseUrl: "https://oypqievulxbvjjxxfvvq.supabase.co",
  supabaseAnonKey: "sb_publishable_zHtcseGjRLeZpHxNMYZ0zw_N03E6mi5",

  /* Dirección pública de la app (la que va en el QR) */
  siteUrl: "https://andriytrofymenkov2.github.io/vientos-demo",
};
