// Code d'accès de la démo privée ReSpace, gardé dans ce navigateur. Avec lui, chaque
// « Aménager » de RealRoom fait poser les meubles par ReSpace ; Maison Corleone ne s'en sert jamais.
const CLE = 'rr-respace-code', EVENEMENT = 'rr-respace-code';
const surRealRoom = () => typeof window !== 'undefined' && !location.pathname.includes('/maison-corleone');

export function codeRespace() {
  if (!surRealRoom()) return '';
  try { return localStorage.getItem(CLE) || sessionStorage.getItem(CLE) || ''; } catch (_) { return ''; }
}
export function garderCodeRespace(code) {
  try { if (code) localStorage.setItem(CLE, code); else { localStorage.removeItem(CLE); sessionStorage.removeItem(CLE); } } catch (_) {}
  window.dispatchEvent(new Event(EVENEMENT));
}
export function suivreCodeRespace(rappel) {
  window.addEventListener(EVENEMENT, rappel);
  return () => window.removeEventListener(EVENEMENT, rappel);
}
// demandes qui lancent le moteur (pas le simple choix d'une proposition déjà faite)
export const lanceLeMoteur = (url, corps) => /^\/api\/pieces\/[^/]+\/(variantes|amenager)$/.test(url) && corps?.action !== 'choisir';
