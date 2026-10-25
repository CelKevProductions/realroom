// Pictogrammes au trait du nouveau projet (24 × 24, couleur du texte) et petites scènes de style.
// Même dessin que les icônes de l'accueil : traits arrondis, aucune couleur imposée.
const P = {
  // types de pièce
  salon: <><path d="M5.5 11V8.5A2.5 2.5 0 0 1 8 6h8a2.5 2.5 0 0 1 2.5 2.5V11" /><path d="M3.5 12.5a1.5 1.5 0 0 1 3 0V14h11v-1.5a1.5 1.5 0 0 1 3 0V17a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1zM6 18v2M18 18v2" /></>,
  chambre: <><path d="M3.5 19.5V6M3.5 15.5h17v4M3.5 12.5h15.5a1.5 1.5 0 0 1 1.5 1.5v1.5" /><rect x="6" y="9" width="5.5" height="3.5" rx="1.4" /></>,
  salle_a_manger: <><path d="M3 13.5h18M6 13.5v7M18 13.5v7M12 3.5v3" /><path d="M8.2 10.5a3.8 3.8 0 0 1 7.6 0z" /></>,
  bureau: <><path d="M3 13.5h18M5.5 13.5v7M18.5 13.5v7" /><rect x="8" y="5" width="8" height="5.5" rx="1" /><path d="M12 10.5v3" /></>,
  salle_de_bain: <><path d="M3 12h18v1.5a5.5 5.5 0 0 1-5.5 5.5h-7A5.5 5.5 0 0 1 3 13.5z" /><path d="M6 12V6.5a2.5 2.5 0 0 1 5 0M7.5 19l-1 2M16.5 19l1 2" /></>,
  entree: <><path d="M6.5 20.5V4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5v16M3.5 20.5h17" /><circle cx="14.6" cy="12.5" r=".6" /></>,
  terrasse: <><path d="M3.5 10.5C5 6.5 8.3 4.5 12 4.5s7 2 8.5 6z" /><path d="M12 10.5v10M8.5 20.5h7" /></>,
  // coins de la pièce
  cuisine: <><path d="M4.5 10.5h15v4.5a4 4 0 0 1-4 4h-7a4 4 0 0 1-4-4zM2.5 10.5h2M19.5 10.5h2" /><path d="M9.5 7.5c0-1 1-1.2 1-2.2M13.5 7.5c0-1 1-1.2 1-2.2" /></>,
  repas: <><circle cx="12.5" cy="12" r="5" /><circle cx="12.5" cy="12" r="2.4" /><path d="M3.5 4.5v4a1.5 1.5 0 0 0 3 0v-4M5 10v9.5M21 4.5c-1.5.6-2.3 2.2-2.3 4.4V12H21M21 4.5v15" /></>,
  travail: <><rect x="5" y="5" width="14" height="9.5" rx="1.2" /><path d="M2.5 18.5h19l-1.6-2.5H4.1z" /></>,
  lecture: <><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5zM12 6.5v13" /></>,
  rangement: <><rect x="5" y="3.5" width="14" height="17" rx="1.5" /><path d="M5 9.2h14M5 14.8h14M10.5 6.3h3M10.5 12h3M10.5 17.6h3" /></>,
  bar: <><path d="M5 4.5h14L12 12zM12 12v7.5M8.5 19.5h7" /></>,
  // priorités
  circulation: <><path d="M4 18.5c3.5 0 4.5-3 6.5-6.5s3.5-6 7.5-6" /><path d="M15.5 3.5 18.3 6l-2.8 2.5" /><path d="M4 13.5h.01M6.5 10h.01" /></>,
  rangements: <><rect x="3.5" y="12" width="7.5" height="7.5" rx="1.2" /><rect x="13" y="12" width="7.5" height="7.5" rx="1.2" /><rect x="8.3" y="4.5" width="7.5" height="7.5" rx="1.2" /></>,
  recevoir: <><path d="M5 3.5h5.5L10 8.7a2.25 2.25 0 0 1-4.5 0zM7.75 11v6.5M5.5 17.5H10M13.5 3.5H19l-.5 5.2a2.25 2.25 0 0 1-4.5 0zM16.25 11v6.5M14 17.5h4.5" /></>,
  calme: <><path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z" /></>,
  lumiere: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  enfants: <><circle cx="8" cy="15" r="4.5" /><path d="M3.5 15h9M8 10.5c1.6 1.2 1.6 7.8 0 9" /><path d="M14 20h6.5v-6.5H14zM15.5 13.5l1.75-4 1.75 4" /></>,
  // foyer
  adulte: <><circle cx="12" cy="7.5" r="3.5" /><path d="M5 20.5a7 7 0 0 1 14 0" /></>,
  enfant: <><circle cx="12" cy="9.8" r="2.7" /><path d="M7.5 20.5a4.5 4.5 0 0 1 9 0" /></>,
  chien: <><path d="M7 6.5h10l2.5 2-1.5 5-2-2.3v4.8a4 4 0 0 1-8 0v-4.8l-2 2.3-1.5-5z" /><path d="M10.2 12h.01M13.8 12h.01M11 15.5h2" /></>,
  chat: <><path d="M5 9.5V4l4 3h6l4-3v5.5a7 7 0 0 1-14 0z" /><path d="M9.5 12h.01M14.5 12h.01M11 15.3l1 .8 1-.8" /></>,
  // fichiers et actions
  zip: <><path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5M10 5.5h1.5M10 8h1.5M10 10.5h1.5M9.6 13h2.3v3.2H9.6z" /></>,
  scan: <><rect x="7.5" y="3.5" width="9" height="17" rx="2.4" /><path d="M3.5 8V6a2.5 2.5 0 0 1 2.5-2.5M20.5 8V6A2.5 2.5 0 0 0 18 3.5M3.5 16v2A2.5 2.5 0 0 0 6 20.5M20.5 16v2a2.5 2.5 0 0 1-2.5 2.5M10 12h4" /></>,
  depot: <><path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" /><path d="M4.5 15v3A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" /></>,
  photo: <><rect x="3.5" y="6" width="17" height="13" rx="2" /><path d="M8.5 6l1.5-2.5h4L15.5 6" /><circle cx="12" cy="12.5" r="3.3" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="9.5" r="1.6" /><path d="m3.5 16.5 5-4.5 4 3.5 3-2.5 5 4" /></>,
  plan: <><path d="M3.5 5.5h17v13h-17zM12 5.5v6h8.5M3.5 13H8" /></>,
  coche: <><path d="M5 12.5l4.5 4.5L19 7.5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  moins: <><path d="M5 12h14" /></>,
  fermer: <><path d="M6 6l12 12M18 6 6 18" /></>,
  suite: <><path d="M4.5 12h15M13.5 6l6 6-6 6" /></>,
  retour: <><path d="M19.5 12h-15M10.5 6l-6 6 6 6" /></>,
  etincelle: <><path d="M12 3.5 13.8 10.2 20.5 12l-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8z" /></>,
  crayon: <><path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5zM13.5 7l3 3" /></>,
  cadenas: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  fleches: <><path d="M12 3.5v17M3.5 12h17M9 6.5l3-3 3 3M9 17.5l3 3 3-3M6.5 9l-3 3 3 3M17.5 9l3 3-3 3" /></>,
  remplacer: <><path d="M4.5 9.5a7.5 7.5 0 0 1 13.4-3.2M19.5 14.5a7.5 7.5 0 0 1-13.4 3.2" /><path d="M18.5 3v3.8h-3.8M5.5 21v-3.8h3.8" /></>
};

export function Picto({ nom, className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{P[nom]}</svg>;
}

// Palettes des styles (murs, sol, meuble, accent) : les couleurs de la scène et les pastilles.
export const PALETTES = {
  japandi: ['#EDE6DA', '#CDB79A', '#8E8172', '#3F3A35'],
  scandinave: ['#F3F1ED', '#E2D2BC', '#C9CCCF', '#C8A47E'],
  contemporain: ['#E4E1DC', '#9C948A', '#ECE7DF', '#D9A441'],
  boheme: ['#F0E2CC', '#C9A57A', '#C79A5B', '#C2703D'],
  industriel: ['#A6A19A', '#5E4B3C', '#8A5A3B', '#2E2E30'],
  classique: ['#EFE6DA', '#C9A982', '#3E4A61', '#C9A45C'],
  artdeco: ['#1F3B36', '#E9DCC9', '#7A2E3A', '#C9A45C'],
  mediterraneen: ['#F7F3EC', '#B8754E', '#E3D7C3', '#2F5D8A']
};

// Petite scène par style : un mur, un sol, une ouverture, un meuble et un objet qui le résument.
const SCENES = {
  japandi: ([mur, sol, meuble, sombre]) => <>
    <rect width="120" height="90" fill={mur} /><rect y="64" width="120" height="26" fill={sol} />
    <path d="M14 64V24h30v40" fill="#F7F2EA" stroke="#D8CDBB" strokeWidth="1.2" /><path d="M29 24v40M14 44h30" stroke="#D8CDBB" strokeWidth="1" />
    <rect x="52" y="52" width="52" height="10" rx="5" fill={meuble} /><rect x="54" y="47" width="48" height="7" rx="3.5" fill="#B3A795" />
    <path d="M56 62v4M100 62v4" stroke={sombre} strokeWidth="1.6" strokeLinecap="round" />
    <path d="M78 6v14" stroke={sombre} strokeWidth=".8" /><circle cx="78" cy="26" r="7" fill="#FBF8F2" stroke="#D8CDBB" strokeWidth=".8" />
    <rect x="104" y="56" width="9" height="8" rx="1.5" fill={sombre} /><circle cx="108.5" cy="50" r="6" fill="#7E8A6E" />
  </>,
  scandinave: ([mur, sol, meuble, bois]) => <>
    <rect width="120" height="90" fill={mur} /><rect y="64" width="120" height="26" fill={sol} />
    <rect x="70" y="16" width="34" height="34" rx="1" fill="#DCE4EA" stroke="#FFFFFF" strokeWidth="2" /><path d="M87 16v34M70 33h34" stroke="#FFFFFF" strokeWidth="1.4" />
    <rect x="14" y="44" width="54" height="16" rx="5" fill={meuble} /><rect x="16" y="38" width="50" height="10" rx="5" fill="#B9BDC1" />
    <path d="M20 60l-2 6M62 60l2 6" stroke={bois} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M41 0v12" stroke="#BFB5A8" strokeWidth=".8" /><path d="M34 19a7 7 0 0 1 14 0z" fill="#FFFFFF" stroke="#D9D2C7" strokeWidth=".8" />
    <rect x="30" y="66" width="44" height="8" rx="1" fill="#EFE7DC" />
  </>,
  contemporain: ([mur, sol, meuble, accent]) => <>
    <rect width="120" height="90" fill={mur} /><rect y="64" width="120" height="26" fill={sol} />
    <circle cx="44" cy="28" r="13" fill={accent} /><circle cx="52" cy="24" r="6" fill="#2F2E33" opacity=".85" />
    <path d="M12 60c0-10 6-14 16-14h40c10 0 16 4 16 14v3H12z" fill={meuble} /><path d="M18 54h60" stroke="#D8D0C4" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M96 64V20c0-8 6-12 12-12" fill="none" stroke="#2F2E33" strokeWidth="1.6" strokeLinecap="round" /><path d="M104 8a6 6 0 0 1 10 4z" fill="#2F2E33" />
    <ellipse cx="96" cy="64" rx="6" ry="1.6" fill="#2F2E33" />
  </>,
  boheme: ([mur, sol, rotin, terre]) => <>
    <rect width="120" height="90" fill={mur} /><rect y="64" width="120" height="26" fill={sol} />
    <path d="M28 54c-14-6-18-22-10-34 6-9 22-12 30-2 9 10 6 28-8 36z" fill={rotin} />
    <path d="M24 26c6 6 14 6 20 0M21 36c8 7 18 7 26 0M23 46c6 4 14 4 20 0" stroke="#A97E45" strokeWidth=".9" fill="none" />
    <rect x="22" y="50" width="28" height="10" rx="4" fill="#E9D2AE" /><path d="M26 60l-2 6M46 60l2 6" stroke="#A97E45" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M86 48h18l-3 16H89z" fill={terre} />
    <path d="M95 48c0-10-8-16-14-18M95 48c0-12 6-20 14-22M95 48c-2-8-10-10-16-8M95 48c3-7 10-9 15-6" stroke="#6E7C4C" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <path d="M70 8v22M64 8c0 8 3 14 6 18 3-4 6-10 6-18" stroke="#B89A72" strokeWidth=".9" fill="none" />
  </>,
  industriel: ([mur, sol, cuir, metal]) => <>
    <rect width="120" height="90" fill={mur} /><rect y="64" width="120" height="26" fill={sol} />
    <path d="M0 22h120M0 44h120" stroke="#9B958D" strokeWidth=".6" />
    <path d="M78 10v54M108 10v54M78 22h30M78 38h30M78 54h30" stroke={metal} strokeWidth="1.6" />
    <rect x="82" y="30" width="6" height="8" fill="#C8B79C" /><rect x="90" y="32" width="10" height="6" fill="#6A5240" /><rect x="84" y="47" width="14" height="7" fill="#B9AFA2" />
    <rect x="10" y="44" width="58" height="16" rx="3" fill={cuir} /><rect x="12" y="38" width="54" height="10" rx="3" fill="#77492D" />
    <path d="M14 60v6M64 60v6" stroke={metal} strokeWidth="1.8" />
    <path d="M40 0v18" stroke={metal} strokeWidth=".8" /><circle cx="40" cy="22" r="4" fill="#F2C76B" /><circle cx="40" cy="22" r="7" fill="#F2C76B" opacity=".25" />
  </>,
  classique: ([mur, sol, velours, laiton]) => <>
    <rect width="120" height="90" fill={mur} /><rect y="64" width="120" height="26" fill={sol} />
    <path d="M0 70l8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6" stroke="#B79668" strokeWidth=".7" fill="none" />
    <rect x="8" y="10" width="42" height="28" fill="none" stroke="#E0D3C1" strokeWidth="1.4" /><rect x="70" y="10" width="42" height="28" fill="none" stroke="#E0D3C1" strokeWidth="1.4" />
    <ellipse cx="60" cy="24" rx="9" ry="12" fill="#F5EFE6" stroke={laiton} strokeWidth="2" />
    <rect x="24" y="46" width="72" height="14" rx="3" fill={velours} /><rect x="28" y="38" width="64" height="11" rx="5" fill="#4A5874" />
    <circle cx="24" cy="50" r="6" fill="#4A5874" /><circle cx="96" cy="50" r="6" fill="#4A5874" />
    <path d="M30 60v5M90 60v5" stroke={laiton} strokeWidth="1.8" strokeLinecap="round" />
  </>,
  artdeco: ([mur, sol, velours, laiton]) => <>
    <rect width="120" height="90" fill={mur} /><rect y="64" width="120" height="26" fill={sol} />
    <path d="M44 44V22a16 16 0 0 1 32 0v22z" fill="#2C4F48" stroke={laiton} strokeWidth="1.6" />
    <path d="M60 6v38M44 26l16-9 16 9" stroke={laiton} strokeWidth=".8" fill="none" opacity=".7" />
    <path d="M14 52a9 9 0 0 1 18 0a9 9 0 0 1 18 0a9 9 0 0 1 18 0a9 9 0 0 1 18 0a9 9 0 0 1 18 0z" fill={velours} />
    <rect x="12" y="50" width="96" height="12" rx="4" fill="#8E3A47" />
    <path d="M18 62v4M102 62v4" stroke={laiton} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="106" cy="20" r="5" fill={laiton} /><path d="M106 25v10" stroke={laiton} strokeWidth="1.2" />
  </>,
  mediterraneen: ([mur, terre, lin, bleu]) => <>
    <rect width="120" height="90" fill={mur} /><rect y="64" width="120" height="26" fill={terre} />
    <path d="M0 77h120M30 64v26M60 64v26M90 64v26" stroke="#A3633F" strokeWidth=".7" />
    <path d="M70 52V26a14 14 0 0 1 28 0v26z" fill="#9FC3E0" /><path d="M70 40h28" stroke="#FFFFFF" strokeWidth="1" opacity=".7" />
    <path d="M70 52h28" stroke={bleu} strokeWidth="2.4" strokeLinecap="round" />
    <rect x="10" y="46" width="52" height="14" rx="6" fill={lin} /><rect x="12" y="39" width="48" height="10" rx="5" fill="#EEE6D6" />
    <rect x="18" y="41" width="10" height="7" rx="2" fill={bleu} opacity=".8" />
    <path d="M14 60v5M58 60v5" stroke="#B0906B" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M104 64l-2-12h12l-2 12z" fill="#C98A5E" /><path d="M108 52c0-10-6-16-10-18M108 52c0-10 4-18 9-20" stroke="#7D8B5A" strokeWidth="2" strokeLinecap="round" fill="none" />
  </>
};

export function SceneStyle({ id, className }) {
  const f = SCENES[id];
  if (!f) return null;
  return <svg className={className} viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">{f(PALETTES[id])}</svg>;
}
