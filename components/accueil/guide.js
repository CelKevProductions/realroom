// Défilement guidé de l'accueil : un geste (molette, pavé tactile, glissé du doigt, flèche, espace)
// emmène doucement à l'arrêt suivant, au lieu de faire défiler librement. Les arrêts sont le héros,
// chaque chapitre de la méthode (et chaque visite du dernier), puis le haut de chaque section ; une
// section plus haute que l'écran a des arrêts intermédiaires, pour qu'on puisse tout lire.
// Seulement avec Lenis (mouvement permis) ; la barre de défilement et les liens d'ancre restent libres.
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export const VISITE = 0.55;          // écart entre deux visites du dernier chapitre (fraction d'écran)
const GESTE = 180;                   // ms sans événement : le geste suivant est un nouveau geste
const REPOS = 250;                   // ms après un trajet avant d'accepter un nouveau geste
const DOIGT = 34;                    // px de glissé pour changer d'arrêt
const SAISIE = 'input, textarea, select, [contenteditable="true"]';
const douce = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const haut = el => el.getBoundingClientRect().top + window.scrollY;

// où le texte d'un chapitre se pose : sous la pièce collée en haut (téléphone), sinon dans l'écran
export function collant(page) {
  const piece = page.querySelector('.acc-scene__piece');
  return piece && getComputedStyle(piece).position === 'sticky' ? piece.offsetHeight + 8 : null;
}
// arrêt d'un chapitre ; pour le dernier, celui de sa première visite
export function arretChapitre(el, page) {
  const vh = window.innerHeight, sous = collant(page);
  const corps = el.querySelector('.acc-chapitre__corps');
  if (corps && el.dataset.visites) {
    const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
    const top = parseFloat(getComputedStyle(corps).top);
    return haut(el) + pad - (Number.isFinite(top) ? top : vh * 0.2);
  }
  return sous === null ? haut(el) + el.offsetHeight / 2 - vh / 2 : haut(el) - sous;
}

function arrets(page, entete) {
  const vh = window.innerHeight, max = Math.max(0, document.documentElement.scrollHeight - vh);
  const liste = [0];
  page.querySelectorAll('[data-chapitre]').forEach(el => {
    if (el.dataset.chapitre === '0') return;
    const base = arretChapitre(el, page), n = Number(el.dataset.visites || 1);
    for (let k = 0; k < n; k++) liste.push(base + k * vh * VISITE);
  });
  const marge = entete.offsetHeight + 12;
  page.querySelectorAll('[data-arret]').forEach(el => {
    const debut = haut(el) - marge, fin = debut + el.offsetHeight + marge - vh;
    liste.push(debut);
    for (let y = debut + vh * 0.8; y < fin; y += vh * 0.8) liste.push(y);
    if (fin > debut + 40) liste.push(fin);
  });
  liste.push(max);
  const tries = liste.map(v => Math.round(Math.min(max, Math.max(0, v)))).sort((a, b) => a - b);
  return tries.filter((v, i) => i === 0 || v - tries[i - 1] > 40);
}

// Rend { molette(données) pour l'option virtualScroll de Lenis, arreter() }.
export function guider(lenisRef, page, entete) {
  let pas = [], trajet = false, dernier = 0, fini = 0;
  const calculer = () => { pas = arrets(page, entete); };
  calculer();
  ScrollTrigger.addEventListener('refresh', calculer);

  const aller = sens => {
    const lenis = lenisRef();
    if (!lenis) return;
    const ici = lenis.animatedScroll;
    const cible = sens > 0 ? pas.find(v => v > ici + 4) : [...pas].reverse().find(v => v < ici - 4);
    if (cible === undefined) return;
    trajet = true;
    const ecrans = Math.abs(cible - ici) / window.innerHeight;
    lenis.scrollTo(cible, {
      duration: Math.min(2.2, Math.max(1.3, 1 + ecrans * 0.5)), easing: douce, lock: true, force: true,
      onComplete: () => { trajet = false; fini = performance.now(); }
    });
  };
  const pret = () => !trajet && performance.now() - fini > REPOS;

  // molette et pavé tactile (via Lenis) : un geste = un arrêt ; l'inertie du pavé ne compte pas
  const molette = ({ deltaX, deltaY, event }) => {
    if (event.type !== 'wheel' || event.ctrlKey || Math.abs(deltaX) > Math.abs(deltaY)) return true;
    if (event.cancelable) event.preventDefault();
    const t = performance.now(), nouveau = t - dernier > GESTE;
    dernier = t;
    if (nouveau && pret() && deltaY) aller(Math.sign(deltaY));
    return false;
  };

  // clavier
  const touche = e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest(SAISIE)) return;
    const sens = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1, ' ': e.shiftKey ? -1 : 1 }[e.key];
    if (!sens) return;
    if (e.key.startsWith('Arrow') && e.target instanceof Element && e.target.closest('.acc-vitrine')) return;
    e.preventDefault();
    if (pret()) aller(sens);
  };

  // doigt : un glissé vertical = un arrêt (un glissé horizontal reste à la vitrine)
  let depart = null, axe = '';
  const toucher = e => { if (e.touches.length === 1) { depart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; axe = ''; } else depart = null; };
  const glisser = e => {
    if (!depart || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - depart.x, dy = e.touches[0].clientY - depart.y;
    if (!axe && Math.hypot(dx, dy) > 6) axe = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
    if (axe === 'y' && e.cancelable) e.preventDefault();
  };
  const lacher = e => {
    if (!depart || axe !== 'y') { depart = null; return; }
    const dy = depart.y - e.changedTouches[0].clientY;
    depart = null;
    if (Math.abs(dy) > DOIGT && pret()) aller(Math.sign(dy));
  };

  window.addEventListener('keydown', touche);
  window.addEventListener('touchstart', toucher, { passive: true });
  window.addEventListener('touchmove', glisser, { passive: false });
  window.addEventListener('touchend', lacher, { passive: true });
  return {
    molette,
    arreter() {
      ScrollTrigger.removeEventListener('refresh', calculer);
      window.removeEventListener('keydown', touche);
      window.removeEventListener('touchstart', toucher);
      window.removeEventListener('touchmove', glisser);
      window.removeEventListener('touchend', lacher);
    }
  };
}
