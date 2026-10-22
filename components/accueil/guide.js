// Défilement guidé de l'histoire de l'accueil : un geste (molette, pavé tactile, glissé du doigt, flèche,
// espace) emmène doucement à l'arrêt suivant, au lieu de faire défiler librement. Les arrêts sont le
// héros, puis chaque chapitre de la méthode (et chaque étape de ceux qui en ont : Aménager, Visiter).
// Après la conclusion (le dernier arrêt), le défilement redevient libre jusqu'en bas ; en remontant, il
// redevient guidé à la conclusion.
// Seulement avec Lenis (mouvement permis) ; la barre de défilement et les liens d'ancre restent libres.
// Pendant qu'on tient un animal de la 3D (window.__rrSaisie), la page ne bouge pas.
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export const VISITE = 0.55;          // écart entre deux étapes d'un même chapitre (fraction d'écran)
const GESTE = 180;                   // ms sans événement : le geste suivant est un nouveau geste
const REPOS = 250;                   // ms après un trajet avant d'accepter un nouveau geste
const DOIGT = 34;                    // px de glissé pour changer d'arrêt
const ECART = 0.2;                   // deux arrêts plus proches que cette fraction d'écran n'en font qu'un
const SAISIE = 'input, textarea, select, [contenteditable="true"]';
const douce = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const haut = el => el.getBoundingClientRect().top + window.scrollY;

// où le texte d'un chapitre se pose : sous la pièce collée en haut (téléphone), sinon dans l'écran
export function collant(page) {
  const piece = page.querySelector('.acc-scene__piece');
  return piece && getComputedStyle(piece).position === 'sticky' ? piece.offsetHeight + 8 : null;
}
// arrêt d'un chapitre ; pour un chapitre à étapes, celui de sa première étape
export function arretChapitre(el, page) {
  const vh = window.innerHeight, sous = collant(page);
  const corps = el.querySelector('.acc-chapitre__corps');
  if (corps && el.dataset.etapes) {
    const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
    const top = parseFloat(getComputedStyle(corps).top);
    return haut(el) + pad - (Number.isFinite(top) ? top : vh * 0.2);
  }
  return sous === null ? haut(el) + el.offsetHeight / 2 - vh / 2 : haut(el) - sous;
}

function arrets(page) {
  const vh = window.innerHeight, max = Math.max(0, document.documentElement.scrollHeight - vh), ecart = vh * ECART;
  const liste = [0];
  page.querySelectorAll('[data-chapitre]').forEach(el => {
    if (el.dataset.chapitre === '0') return;
    const base = arretChapitre(el, page), n = Number(el.dataset.etapes || 1);
    for (let k = 0; k < n; k++) liste.push(base + k * vh * VISITE);
  });
  // un arrêt de quelques centimètres ne se verrait pas (on croirait que le geste n'a rien fait)
  const tries = liste.map(v => Math.round(Math.min(max, Math.max(0, v)))).sort((a, b) => a - b);
  return tries.filter((v, i) => i === 0 || v - tries[i - 1] > ecart);
}

// Rend { molette(données) pour l'option virtualScroll de Lenis, aller(arrêt), arreter() }.
export function guider(lenisRef, page) {
  let pas = [], trajet = false, dernier = 0, fini = 0, amplitude = 0, signe = 0, etaitLibre = false;
  const calculer = () => { pas = arrets(page); };
  calculer();
  ScrollTrigger.addEventListener('refresh', calculer);

  const vers = (cible, lenis = lenisRef()) => {
    if (!lenis || cible === undefined) return;
    const ici = lenis.animatedScroll;
    trajet = true;
    const ecrans = Math.abs(cible - ici) / window.innerHeight;
    lenis.scrollTo(cible, {
      duration: Math.min(2.2, Math.max(1.3, 1 + ecrans * 0.5)), easing: douce, lock: true, force: true,
      onComplete: () => { trajet = false; fini = performance.now(); }
    });
  };
  const aller = sens => {
    const lenis = lenisRef();
    if (!lenis) return;
    const ici = lenis.animatedScroll;
    vers(sens > 0 ? pas.find(v => v > ici + 4) : [...pas].reverse().find(v => v < ici - 4), lenis);
  };
  const pret = () => !trajet && performance.now() - fini > REPOS;
  // après la conclusion, le défilement est libre ; en remontant, il le reste jusqu'à la conclusion
  const libre = (sens, delta = 0) => {
    const lenis = lenisRef();
    if (!lenis || trajet || !pas.length) return false;
    const limite = pas[pas.length - 1];
    if (lenis.animatedScroll < limite - 4) return false;
    return sens > 0 || lenis.targetScroll + delta > limite + 2;
  };

  // molette et pavé tactile (via Lenis) : un geste = un arrêt ; l'inertie du pavé ne compte pas.
  // Nouveau geste : une pause, un changement de sens, ou une poussée qui repart à la hausse alors que
  // l'inertie du geste précédent s'éteint encore (sinon il faudrait attendre qu'elle se taise tout à fait).
  const molette = ({ deltaX, deltaY, event }) => {
    if (event.type !== 'wheel' || event.ctrlKey || Math.abs(deltaX) > Math.abs(deltaY)) return true;
    if (window.__rrSaisie) { if (event.cancelable) event.preventDefault(); return false; }
    const t = performance.now(), d = Math.abs(deltaY), s = Math.sign(deltaY);
    if (s && libre(s, deltaY)) { etaitLibre = true; dernier = t; amplitude = d; signe = s; return true; }
    if (event.cancelable) event.preventDefault();
    // on revient dans l'histoire en remontant : ce geste-là emmène à la conclusion
    const retour = etaitLibre;
    etaitLibre = false;
    const nouveau = retour || t - dernier > GESTE || (s && s !== signe) || (d >= 12 && d > amplitude * 1.6 + 4);
    dernier = t;
    amplitude = d;
    if (s) signe = s;
    if (nouveau && (pret() || retour) && s) aller(s);
    return false;
  };

  // clavier
  const touche = e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest(SAISIE)) return;
    const sens = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1, ' ': e.shiftKey ? -1 : 1 }[e.key];
    if (!sens) return;
    if (e.key.startsWith('Arrow') && e.target instanceof Element && e.target.closest('.acc-vitrine')) return;
    if (libre(sens)) return;
    e.preventDefault();
    if (pret()) aller(sens);
  };

  // doigt : un glissé vertical = un arrêt (un glissé horizontal reste à la vitrine)
  let depart = null, axe = '';
  const toucher = e => { if (e.touches.length === 1 && !window.__rrSaisie) { depart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; axe = ''; } else depart = null; };
  const glisser = e => {
    if (window.__rrSaisie) { depart = null; if (e.cancelable) e.preventDefault(); return; }
    if (!depart || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - depart.x, dy = e.touches[0].clientY - depart.y;
    if (!axe && Math.hypot(dx, dy) > 6) {
      axe = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
      // après la conclusion, le doigt fait défiler la page comme d'habitude
      if (axe === 'y' && libre(-Math.sign(dy), -dy)) { depart = null; return; }
    }
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
    // un arrêt précis (k-ième arrêt d'un chapitre à étapes), comme si on y était allé au défilement
    allerA(cible) { if (!trajet) vers(Math.round(cible)); },
    arreter() {
      ScrollTrigger.removeEventListener('refresh', calculer);
      window.removeEventListener('keydown', touche);
      window.removeEventListener('touchstart', toucher);
      window.removeEventListener('touchmove', glisser);
      window.removeEventListener('touchend', lacher);
    }
  };
}
