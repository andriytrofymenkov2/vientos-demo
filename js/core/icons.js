import { LOGO_VIEWBOX, LOGO_PATHS } from "./logo-data.js";
/* Íconos de trazo propios (24x24, currentColor) */

const P = {
  home: '<path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-6h4v6"/>',
  dumbbell: '<path d="M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11"/><rect x="5" y="6.5" width="3" height="11" rx="1"/><rect x="16" y="6.5" width="3" height="11" rx="1"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-7"/>',
  trend: '<path d="M3.5 17.5 9 12l4 4 7.5-8"/><path d="M15 8h5.5v5.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.7 3.2-5.6 6.5-5.6s5.9 1.9 6.5 5.6"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.6c2 .7 3.2 2.5 3.5 5.4"/>',
  userplus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.7 3.2-5.6 6.5-5.6s5.9 1.9 6.5 5.6"/><path d="M18.5 7v6M15.5 10h6"/>',
  layers: '<path d="m12 3.5 9 4.5-9 4.5L3 8z"/><path d="m3 12.5 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1" fill="currentColor"/><circle cx="4.8" cy="12" r="1" fill="currentColor"/><circle cx="4.8" cy="17.5" r="1" fill="currentColor"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M18.5 6.5l1.5-1.5"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  check: '<path d="m4.5 12.5 4.8 4.8L19.5 7"/>',
  checkc: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8L16.2 9.6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  left: '<path d="m14.5 5-7 7 7 7"/>',
  right: '<path d="m9.5 5 7 7-7 7"/>',
  down: '<path d="m5 9.5 7 7 7-7"/>',
  up: '<path d="m5 14.5 7-7 7 7"/>',
  arrow: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  back: '<path d="M19.5 12h-15M10.5 6l-6 6 6 6"/>',
  ext: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v6H4V6h6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  logout: '<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  edit: '<path d="m4 20 1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="m13.5 7 3 3"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V4H4v11.5h4.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M4 4l16 16"/><path d="M10.5 6a10 10 0 0 1 1.5-.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.6M6.4 7.6A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  note: '<path d="M5 3.5h14v17H5z"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".7" fill="currentColor"/>',
  alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r=".7" fill="currentColor"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.9 3.3-6.2 4.3-10.3 2.8 1.7 4.4 4.3 4.4 6.6.8-.6 1.4-1.6 1.6-2.8 1.7 1.6 2.7 3.8 2.7 6.4 0 3.7-2.6 6.3-6.5 6.3z"/>',
  trophy: '<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4c0 3 1.5 4.5 3.8 4.8M16.5 6H20c0 3-1.5 4.5-3.8 4.8"/><path d="M12 13.5V17M8 20.5h8M9.5 17h5v3.5h-5z"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h12.5"/><path d="m16.5 3 3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H4.5"/><path d="m7.5 21-3-3 3-3"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4.5-2.2 1.4a11 11 0 0 0 5.8 5.8l1.4-2.2 4.5 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>',
  whatsapp: '<path d="M4 20.5 5.3 16A8.5 8.5 0 1 1 8.2 19z"/><path d="M9 8.3c.3-.6.6-.6.9-.6h.5c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5a6.2 6.2 0 0 0 2.9 2.5c.2.1.4.1.5-.1l.6-.8c.2-.2.4-.2.6-.1l1.7.8c.2.1.4.2.4.4 0 .4-.1 1-.6 1.4-.5.5-1.3.8-2.2.7-1.1-.2-2.6-.8-4-2.2-1.5-1.5-2.2-2.9-2.4-3.9-.1-.8.2-1.5.4-1.9z" fill="currentColor" stroke="none"/>',
  pin: '<path d="M12 21s-6.5-6.1-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.4"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".9" fill="currentColor"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M6.5 15h4"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.3 2.3 4.2-4.6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  filter: '<path d="M4 5h16l-6.2 7.5V19l-3.6 1.5v-8z"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10.5 5-3v9l-5-3"/>',
  qr: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 18.5v2M18.5 14h2"/>',
  share: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 11.5v9h14v-9"/>',
  addbox: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M12 8v8M8 12h8"/>',
  download: '<path d="M12 4v11"/><path d="m7 10.5 5 5 5-5"/><path d="M4.5 19.5h15"/>',
  print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14.5h10v6H7z"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/><path d="M10 21h4"/>',
  dots: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',
  muscle: '<path d="M5 15.5c0-4 1.5-8.5 4-10.5l2 1.5-1.5 3 3 1.5c2.5-1.5 6.5-.5 7.5 3s-1.5 6-5 6H9c-2.5 0-4-2-4-4.5z"/>',
  wind: '<path d="M3 8.5h10.5a2.75 2.75 0 1 0-2.75-2.75"/><path d="M3 12.5h15.5a2.75 2.75 0 1 1-2.75 2.75"/><path d="M3 16.5h7"/>',
  swap: '<path d="M7 4 3.5 7.5 7 11M3.5 7.5h13M17 13l3.5 3.5L17 20M20.5 16.5h-13"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  chat: '<path d="M4.5 5.5h15v10.5h-9l-4.5 3.5V16h-1.5z"/><path d="M8.5 9.5h7M8.5 12.5h4.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  send: '<path d="M4 12 20 4l-4.5 16-3.5-6.5z"/><path d="m12 13.5 8-9.5"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
};

export function icon(name, cls = "") {
  return `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.info}</svg>`;
}

/* Ondas de Vientos (dos trazos afinados en las puntas, rojo y grafito) */
export const WAVES = `<svg class="waves" viewBox="0 0 120 28" aria-hidden="true"><path class="w1" d="M2 15C22 4 40 4 60 11s38 8 58-3c-18 14-38 15-58 8S22 8 2 15z"/><path class="w2" d="M8 22c20-9 36-9 54-3s34 6 52-2c-16 11-34 12-52 6S26 15 8 22z"/></svg>`;

/* Logo OFICIAL de Vientos GYM (vectorizado de sus redes, ver dev/vectorizar_logo.py).
   Los colores salen del CSS (.logo .vl-*) y cambian con el tema claro/oscuro. */
export function logo() {
  return `<svg class="logo" viewBox="${LOGO_VIEWBOX}" role="img" aria-label="Vientos GYM">${LOGO_PATHS}</svg>`;
}
