'use client';
// Direction d'animation commune à tout le site (GSAP). Un seul endroit pour les durées, les
// courbes, les décalages et le mouvement réduit : les composants composent ces règles au lieu
// de recopier leurs propres valeurs.
//
// Règles :
//  - transform et opacity seulement (autoAlpha pour ce qui disparaît : un élément invisible ne
//    reçoit plus les clics) ;
//  - chaque animation est interrompable : la suivante sur la même cible la remplace (overwrite) ;
//  - aucune animation ne retarde une tâche : l'état utile est posé tout de suite, le mouvement
//    l'accompagne ;
//  - mouvement réduit ou script absent : l'état final, immédiatement.
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

export { gsap };

// secondes
export const DUREES = { instant: .12, court: .22, moyen: .42, long: .7, titre: 1.1, camera: 1.6 };
// courbes enregistrées une fois (noms GSAP)
export const COURBES = {
  arrivee: 'rr-arrivee',      // entrée qui ralentit franchement (titres, panneaux)
  douce: 'power3.out',        // contenu qui glisse en place
  depart: 'power2.in',        // sortie brève
  pivot: 'rr-pivot',          // entrée-sortie (changement d'état, caméra)
  lineaire: 'none'
};
// secondes entre deux éléments d'une même entrée
export const DECALAGES = { serre: .035, normal: .07, large: .1 };
// pixels
export const ECARTS = { petit: 8, moyen: 16, grand: 28 };
// mêmes valeurs côté CSS (var(--sortie) : globals.css)
export const BEZIER = { arrivee: '0.22, 1, 0.36, 1', pivot: '0.76, 0, 0.24, 1' };

let pret = false;
export function initialiser() {
  if (pret || typeof window === 'undefined') return gsap;
  gsap.registerPlugin(CustomEase);
  CustomEase.create(COURBES.arrivee, BEZIER.arrivee);
  CustomEase.create(COURBES.pivot, BEZIER.pivot);
  gsap.config({ nullTargetWarn: false });
  pret = true;
  return gsap;
}

const REDUIT = '(prefers-reduced-motion: reduce)';
// Le marqueur data-mvt est posé avant l'affichage (layout.js) si le JavaScript tourne et que le
// visiteur n'a pas demandé moins d'animations. La préférence est relue à chaque appel : elle
// peut changer pendant la visite.
export function mouvementPermis() {
  if (typeof document === 'undefined') return false;
  if (!document.documentElement.hasAttribute('data-mvt')) return false;
  try { return !matchMedia(REDUIT).matches; } catch (_) { return true; }
}

// Applique une préférence de mouvement qui change en cours de visite (réglage système).
export function suivrePreference() {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = matchMedia(REDUIT);
  const maj = () => {
    if (mq.matches) {
      document.documentElement.removeAttribute('data-mvt');
      // tout ce qui bouge encore se termine à son état final
      gsap.globalTimeline.getChildren(true, true, false).forEach(t => t.progress(1));
    } else document.documentElement.setAttribute('data-mvt', '');
  };
  mq.addEventListener?.('change', maj);
  return () => mq.removeEventListener?.('change', maj);
}

const liste = cibles => gsap.utils.toArray(cibles).filter(Boolean);

// Entrée d'éléments qui viennent d'apparaître : ils glissent et se fondent en place.
// Les styles posés sont effacés à la fin (le CSS reprend la main, survols compris).
export function entrer(cibles, o = {}) {
  const els = liste(cibles);
  if (!els.length) return null;
  initialiser();
  if (!mouvementPermis()) { gsap.set(els, { clearProps: 'opacity,visibility,transform' }); return null; }
  return gsap.fromTo(els, { autoAlpha: 0, y: o.y ?? ECARTS.moyen, x: o.x ?? 0 },
    { autoAlpha: 1, y: 0, x: 0, duration: o.duree ?? DUREES.moyen, delay: o.delai ?? 0,
      stagger: o.decalage ?? DECALAGES.serre, ease: o.courbe ?? COURBES.douce, overwrite: true,
      clearProps: 'opacity,visibility,transform', onComplete: o.fin });
}

// Sortie : l'élément devient invisible ET inerte (autoAlpha), sans bloquer ce qui suit.
export function sortir(cibles, o = {}) {
  const els = liste(cibles);
  if (!els.length) return null;
  initialiser();
  if (!mouvementPermis()) { gsap.set(els, { autoAlpha: 0 }); o.fin?.(); return null; }
  return gsap.to(els, { autoAlpha: 0, y: o.y ?? -ECARTS.petit, duration: o.duree ?? DUREES.court,
    ease: COURBES.depart, overwrite: true, onComplete: o.fin });
}

// Volet (panneau latéral, tiroir) : ouvert, il reçoit le focus ; fermé, il est inerte et caché.
// Une ouverture pendant une fermeture reprend depuis la position courante.
export function volet(el, ouvert, o = {}) {
  if (!el) return null;
  initialiser();
  const cote = o.cote || 'droite';
  const axe = cote === 'bas' ? 'yPercent' : 'xPercent';
  const loin = cote === 'gauche' ? -100 : 100;
  if (ouvert) { el.inert = false; el.removeAttribute('aria-hidden'); }
  const fin = () => { if (!ouvert) { el.inert = true; el.setAttribute('aria-hidden', 'true'); } o.fin?.(); };
  if (!mouvementPermis()) { gsap.set(el, { autoAlpha: ouvert ? 1 : 0, [axe]: ouvert ? 0 : loin }); fin(); return null; }
  return gsap.to(el, { autoAlpha: ouvert ? 1 : 0, [axe]: ouvert ? 0 : loin,
    duration: ouvert ? DUREES.long : DUREES.moyen, ease: ouvert ? COURBES.arrivee : COURBES.depart, overwrite: true, onComplete: fin });
}

// Boucle d'attente (indicateur d'activité, jamais une progression) : suspendue quand l'onglet
// est caché ou l'élément hors de l'écran, et arrêtée par le nettoyage renvoyé.
export function boucle(el, creer) {
  if (!el || !mouvementPermis()) return () => {};
  initialiser();
  const tl = creer(gsap.timeline({ repeat: -1 }));
  let visible = true;
  const maj = () => { if (visible && !document.hidden) tl.play(); else tl.pause(); };
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(e => { visible = e[0]?.isIntersecting !== false; maj(); }) : null;
  io?.observe(el);
  document.addEventListener('visibilitychange', maj);
  return () => { io?.disconnect(); document.removeEventListener('visibilitychange', maj); tl.revert(); };
}

// Annonce aux lecteurs d'écran (région vivante partagée, créée à la demande).
export function annoncer(texte) {
  if (typeof document === 'undefined' || !texte) return;
  let r = document.getElementById('rr-annonces');
  if (!r) {
    r = document.createElement('div');
    r.id = 'rr-annonces'; r.className = 'visuel-masque';
    r.setAttribute('role', 'status'); r.setAttribute('aria-live', 'polite');
    document.body.appendChild(r);
  }
  // vider puis écrire : une annonce identique à la précédente est quand même relue
  r.textContent = '';
  setTimeout(() => { r.textContent = texte; }, 30);
}

// Focus déplacé sur un titre d'étape sans faire défiler la page brusquement.
export function focaliser(el) {
  if (!el || typeof el.focus !== 'function') return;
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}
