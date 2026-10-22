'use client';
// Animations de la page d'accueil « Plan vivant » : GSAP (ScrollTrigger, SplitText) et Lenis.
// Le contenu est déjà complet dans le HTML : ce composant ne fait que le révéler et l'animer.
// Sans JavaScript, ou avec « réduire les animations », la page reste entière et immobile :
// les états de départ (accueil.css) n'existent que si data-acc contient « mouvement » (et « ouverture »
// pour le héros, caché sous le préchargement).
//
// Dialogue avec la pièce 3D (components/accueil/PieceAccueil.js), par événements sur document :
//  - « rr:piece-prete » (reçu) : la 3D est prête, le compteur du préchargement peut finir ;
//  - « rr:piece-intro » (émis) : fin du préchargement, ou tout de suite s'il n'y en a pas ;
//  - « rr:piece-chapitre » (émis, detail.chapitre de 0 à 3, detail.visite) : chapitre actif au défilement
//    (0 = héros) ; dans le dernier, la visite en cours (un appartement après l'autre, puis tous) ;
//  - « rr:piece-shuffle » (émis) : on reclique sur « Shuffle » alors qu'on y est déjà : une autre idée.
// Ils restent lisibles après coup (window.__rrPieceIntro, window.__rrPieceChapitre) pour une 3D montée plus tard ;
// le chapitre courant est renvoyé chaque fois que la 3D se dit prête.
import { useEffect, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from 'lenis';
import { BEZIER } from '@/components/mouvement/regles.js';
import { suivreCurseur } from '@/components/mouvement/curseur.js';
import { guider, arretChapitre, VISITE } from './guide.js';

const avantAffichage = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const REDUIT = '(prefers-reduced-motion: reduce)';
// propriétés rendues au CSS une fois l'élément révélé (ses survols et ses mises en page reprennent la main)
const A_EFFACER = 'opacity,transform,translate,rotate,scale';
const DUREE_MAX = 6500;   // préchargement, rideau compris, compté depuis le premier affichage (ms)
const RIDEAU = 0.9;       // le panneau se replie vers le haut (s)
const FIN_COMPTE = 0.4;   // le compteur va jusqu'à 100 (s)
const LECTURE = 4000;     // le plan a le temps de se tracer entièrement (3,8 s en CSS) avant de laisser place à la 3D (ms)
const DEFILEMENT = [' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'];

// jetons posés sur <html data-acc="…"> : js, mouvement, ouverture (préchargement), anime (le script a la main)
const jetons = () => (document.documentElement.getAttribute('data-acc') || '').split(/\s+/).filter(Boolean);
const poser = liste => document.documentElement.setAttribute('data-acc', [...new Set(liste)].join(' '));
const a = j => jetons().includes(j);
const retirer = j => poser(jetons().filter(x => x !== j));
// instant du premier affichage (script d'amorce de la mise en page)
const debut = () => (typeof window.__rrAccT === 'number' ? window.__rrAccT : 0);
const emettre = (nom, detail) => document.dispatchEvent(detail === undefined ? new CustomEvent(nom) : new CustomEvent(nom, { detail }));
const attendre = ms => new Promise(r => setTimeout(r, ms));

// fin d'une révélation : l'état de départ CSS est levé (.is-vu) et les styles posés par GSAP sont effacés
function vu(elements, effacer = elements) {
  gsap.utils.toArray(elements).forEach(e => e.classList.add('is-vu'));
  gsap.set(effacer, { clearProps: A_EFFACER });
}

// retrait des jetons différé : en mode strict (développement), React démonte puis remonte aussitôt
let retrait = 0;

export default function Animations() {
  avantAffichage(() => {
    clearTimeout(retrait);
    if (!a('js')) {
      // arrivée par un lien interne : le script d'amorce n'a pas tourné (pas de préchargement)
      window.__rrAccT = performance.now();
      poser(matchMedia(REDUIT).matches ? ['js'] : ['js', 'mouvement']);
    } else if (!a('anime')) {
      // script arrivé tard : le secours CSS efface déjà le préchargement (6,5 s) ou montre déjà tout (3 s, sans préchargement)
      const ecoule = performance.now() - debut(), avecOuverture = a('ouverture');
      if (ecoule > 6300) retirer('ouverture');
      if (ecoule > (avecOuverture ? 6400 : 2600)) retirer('mouvement');
    }
    // effacés avant la page suivante (qui reposera les siens)
    return () => { retrait = setTimeout(() => document.documentElement.removeAttribute('data-acc'), 0); };
  }, []);

  useEffect(() => demarrer(), []);
  return null;
}

function demarrer() {
  const page = document.getElementById('acc');
  if (!page) return undefined;
  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  ScrollTrigger.config({ ignoreMobileResize: true });
  // mêmes courbes que le reste du site (components/mouvement/regles.js)
  CustomEase.create('acc', BEZIER.pivot);           // entrée-sortie franche
  CustomEase.create('acc-sortie', BEZIER.arrivee);  // arrivée douce

  const mouvement = a('mouvement');
  const ouverture = mouvement && a('ouverture');
  poser([...jetons(), 'anime']);
  const nettoyages = [];
  let annule = false;
  let lenis = null;
  let guide = null;
  let image = 0;
  const ctx = gsap.context(() => {}, page);
  const entete = page.querySelector('[data-entete]');
  const scene = page.querySelector('[data-scene]');

  // ---------- 1. la pièce 3D : chapitre actif (et son étape : proposition, puis Shuffle ; visite), intro
  let chapitre = -1;
  let visite = 0;
  let introduite = false;
  const annoncer = (n, encore = false, k = visite) => {
    if (n === chapitre && k === visite && !encore) return;
    chapitre = n;
    visite = k;
    window.__rrPieceChapitre = n;
    window.__rrPieceVisite = k;
    if (scene) scene.setAttribute('data-actif', String(n));
    page.querySelectorAll('[data-etape]').forEach(li => {
      const actif = Number(li.closest('[data-chapitre]')?.dataset.chapitre) === n && Number(li.dataset.etape) === k;
      li.classList.toggle('is-actif', actif);
      if (actif) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    // tout le monde est heureux : la conclusion prend la place du dernier chapitre
    if (scene) scene.toggleAttribute('data-conclusion', n === 3 && k === 4);
    emettre('rr:piece-chapitre', { chapitre: n, visite: k });
  };
  // la 3D s'est montée ou rechargée après coup : elle reçoit l'état courant
  const surPrete = () => { if (introduite && chapitre >= 0) annoncer(chapitre, true); };
  document.addEventListener('rr:piece-prete', surPrete);
  nettoyages.push(() => document.removeEventListener('rr:piece-prete', surPrete));
  const introduire = () => {
    if (introduite || annule) return;
    introduite = true;
    window.__rrPieceIntro = true;
    emettre('rr:piece-intro');
    ctx.add(() => suivreChapitres(page, annoncer, mouvement));
  };

  // ---------- 2. barre pilule : se tasse au défilement, s'assombrit sur les sections de nuit
  const tasser = () => entete.classList.toggle('is-defile', window.scrollY > 40);
  tasser();
  ctx.add(() => {
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: tasser });
    const actives = new Set();
    const milieu = () => Math.round(entete.getBoundingClientRect().bottom - 28);
    gsap.utils.toArray('[data-fond="nuit"]', page).forEach(section => ScrollTrigger.create({
      trigger: section, start: () => `top ${milieu()}px`, end: () => `bottom ${milieu()}px`,
      onToggle: s => { if (s.isActive) actives.add(section); else actives.delete(section); entete.classList.toggle('is-nuit', actives.size > 0); }
    }));
  });

  // ---------- 3. horloge de Paris (pied de page)
  const horloges = page.querySelectorAll('[data-horloge]');
  const format = new Intl.DateTimeFormat(document.documentElement.lang === 'en' ? 'en-GB' : 'fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const heure = () => { const h = format.format(new Date()); horloges.forEach(e => { if (e.textContent !== h) e.textContent = h; }); };
  heure();
  const minuterie = setInterval(heure, 15000);
  nettoyages.push(() => clearInterval(minuterie));

  // ---------- 4. liens d'ancre : défilement doux s'il y a Lenis (sinon le navigateur s'en charge, scroll-margin-top en CSS)
  const ancre = e => {
    const lien = e.target.closest && e.target.closest('a[data-ancre]');
    if (!lien || !lenis) return;
    const id = lien.getAttribute('href');
    const cible = id === '#acc' ? 0 : page.querySelector(id);
    if (cible === null) return;
    e.preventDefault();
    lenis.scrollTo(cible, { duration: 1.4, offset: cible === 0 ? 0 : -(entete.offsetHeight + 24), easing: t => 1 - Math.pow(1 - t, 4) });
    if (cible === 0) { history.replaceState(history.state, '', location.pathname + location.search); return; }
    history.replaceState(history.state, '', id);
    cible.setAttribute('tabindex', '-1');
    cible.focus({ preventScroll: true });   // le clavier repart de la section choisie
  };
  page.addEventListener('click', ancre);
  nettoyages.push(() => page.removeEventListener('click', ancre));

  // ---------- 4 bis. étapes d'Aménager : un clic y emmène comme le défilement ; Shuffle, encore : une autre idée
  const surEtape = e => {
    const bouton = e.target.closest && e.target.closest('.acc-etapes__bouton');
    const li = bouton && bouton.closest('[data-etape]');
    const el = li && li.closest('[data-chapitre]');
    if (!el) return;
    const n = Number(el.dataset.chapitre), k = Number(li.dataset.etape);
    if (n === chapitre && k === visite) { if (k > 0) emettre('rr:piece-shuffle'); return; }
    const cible = arretChapitre(el, page) + k * innerHeight * VISITE;
    if (guide) guide.allerA(cible);
    else window.scrollTo({ top: cible, behavior: mouvement ? 'smooth' : 'auto' });
  };
  page.addEventListener('click', surEtape);
  nettoyages.push(() => page.removeEventListener('click', surEtape));

  // ---------- 5. catalogue : les rangées de meubles accélèrent avec le défilement de la page
  const defile = page.querySelector('[data-defile]');
  if (defile && mouvement) nettoyages.push(elan(defile));

  // défilement doux, une fois le préchargement passé
  const lancerLenis = () => {
    if (annule || lenis) return;
    // défilement guidé : un geste emmène à l'arrêt suivant (guide.js)
    guide = guider(() => lenis, page);
    nettoyages.push(() => { guide.arreter(); guide = null; });
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, autoRaf: false, virtualScroll: guide.molette });
    lenis.on('scroll', ScrollTrigger.update);
    const tic = t => lenis.raf(t * 1000);
    gsap.ticker.add(tic);
    gsap.ticker.lagSmoothing(0);
    nettoyages.push(() => { gsap.ticker.remove(tic); gsap.ticker.lagSmoothing(500, 33); lenis.destroy(); lenis = null; });
  };

  if (!mouvement) {
    // mouvement réduit : tout est déjà visible ; la 3D reçoit quand même son intro et ses chapitres (état final chez elle)
    image = requestAnimationFrame(introduire);
  } else {
    // ---------- 6. préchargement, entrée du héros, révélations au défilement, petites réactions
    ctx.add(() => revelations(page));
    ctx.add(() => diapositives(page));
    nettoyages.push(reactions(page, ctx));
    (async () => {
      if (ouverture) {
        await new Promise(fin => ctx.add(() => {
          nettoyages.push(prechargement(page, ctx, {
            auDepart: () => { introduire(); ctx.add(() => entree(page)); },
            fin
          }));
        }));
        if (annule) return;
        retirer('ouverture');
        gsap.set(page.querySelectorAll('[data-ouverture], [data-ouverture-contenu]'), { clearProps: 'all' });
      } else {
        image = requestAnimationFrame(introduire);
      }
      lancerLenis();
      // polices chargées : les découpes SplitText se refont seules (autoSplit), les positions se recalculent
      await Promise.race([document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : null, attendre(1500)]);
      if (!annule) ScrollTrigger.refresh();
    })();
  }

  return () => {
    annule = true;
    cancelAnimationFrame(image);
    ctx.revert();
    nettoyages.forEach(f => f());
    entete.classList.remove('is-defile', 'is-nuit');
    if (scene) { scene.removeAttribute('data-actif'); scene.removeAttribute('data-conclusion'); }
    delete window.__rrPieceIntro;
    delete window.__rrPieceChapitre;
  };
}

// chapitres au défilement (0 = héros, 1 à 3 = méthode) : la 3D suit, le cadre change d'état,
// la jauge de la méthode se remplit
function suivreChapitres(page, annoncer, mouvement) {
  // chapitres à étapes (Aménager, Visiter) : une étape par arrêt du défilement guidé (guide.js), d'après la position
  const visiteIci = el => {
    const n = Number(el.dataset.etapes || 0);
    if (!n) return 0;
    return Math.min(n - 1, Math.max(0, Math.round((window.scrollY - arretChapitre(el, page)) / (innerHeight * VISITE))));
  };
  const declencheurs = gsap.utils.toArray('[data-chapitre]', page).map(el => ScrollTrigger.create({
    trigger: el, start: 'top 70%', end: 'bottom 70%',
    onToggle: s => { if (s.isActive) annoncer(Number(el.dataset.chapitre), false, visiteIci(el)); },
    onUpdate: s => { if (s.isActive && el.dataset.etapes) annoncer(Number(el.dataset.chapitre), false, visiteIci(el)); }
  }));
  // état de départ (page rechargée en milieu de défilement) : le dernier chapitre déjà atteint
  const atteints = declencheurs.filter(s => s.scroll() >= s.start);
  const atteint = atteints.length ? atteints[atteints.length - 1].trigger : null;
  annoncer(atteint ? Number(atteint.dataset.chapitre) : 0, false, atteint ? visiteIci(atteint) : 0);
  const jauge = page.querySelector('.acc-chapitres__jauge');
  if (mouvement && jauge) {
    gsap.fromTo(jauge, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.acc-chapitres', start: 'top 62%', end: 'bottom 62%', scrub: 0.4 } });
  }
}

// préchargement : le plan se trace et le compteur avance en CSS dès le premier affichage ;
// ici, on décide de la fin (3D prête et plan lu, ou la limite), puis le panneau se replie vers le haut.
// Un clic ou une touche le passe. Rend la fonction qui retire ses écouteurs.
function prechargement(page, ctx, { auDepart, fin }) {
  const boite = page.querySelector('[data-ouverture]');
  const compte = boite.querySelector('[data-compte]');
  const barre = boite.querySelector('[data-barre]');
  try { sessionStorage.setItem('rr-accueil', '1'); } catch (_) { /* navigation privée : tant pis */ }
  let fini = false;
  let limite = 0;
  let attente = 0;
  const ecoule = () => performance.now() - debut();
  const bloquer = e => e.preventDefault();
  const passer = () => fermer(true);
  const touche = e => {
    if (e.ctrlKey || e.metaKey || e.altKey || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    if (DEFILEMENT.includes(e.key)) e.preventDefault();   // pas de défilement de la page derrière
    fermer(true);
  };
  const surPrete = () => { clearTimeout(attente); attente = setTimeout(() => fermer(false), Math.max(0, LECTURE - ecoule())); };
  const detacher = () => {
    clearTimeout(limite);
    clearTimeout(attente);
    boite.removeEventListener('click', passer);
    boite.removeEventListener('wheel', bloquer);
    boite.removeEventListener('touchmove', bloquer);
    window.removeEventListener('keydown', touche, true);
    document.removeEventListener('rr:piece-prete', surPrete);
  };
  function fermer(vite) {
    if (fini) return;
    fini = true;
    detacher();
    // le compteur et la barre repartent de là où le CSS les a menés
    const n = { v: parseInt(getComputedStyle(compte).getPropertyValue('--compte'), 10) || 0 };
    compte.style.animation = 'none';
    barre.style.animation = 'none';
    const ecrire = () => {
      compte.style.setProperty('--compte', String(Math.round(n.v)));
      barre.style.transform = `scaleX(${n.v / 100})`;
    };
    ecrire();
    ctx.add(() => {
      gsap.timeline({ onComplete: fin })
        .to(n, { v: 100, duration: vite ? 0.16 : FIN_COMPTE, ease: 'power2.out', onUpdate: ecrire })
        .add(rideau(boite), '+=0.06')
        .call(auDepart, null, '<0.2');   // la 3D et le héros commencent pendant que le panneau monte
    });
  }
  boite.addEventListener('click', passer);
  boite.addEventListener('wheel', bloquer, { passive: false });
  boite.addEventListener('touchmove', bloquer, { passive: false });
  window.addEventListener('keydown', touche, true);
  document.addEventListener('rr:piece-prete', surPrete);
  // au plus tard : le rideau doit être monté à DUREE_MAX
  limite = setTimeout(() => fermer(false), Math.max(0, DUREE_MAX - (RIDEAU + FIN_COMPTE + 0.06) * 1000 - ecoule()));
  return detacher;
}

// le panneau se replie vers le haut comme un rideau ; son contenu part un peu plus vite
function rideau(boite) {
  return gsap.timeline()
    .to(boite.querySelector('[data-ouverture-contenu]'), { yPercent: -14, opacity: 0, duration: RIDEAU * 0.8, ease: 'power2.in' }, 0)
    .to(boite, { yPercent: -100, duration: RIDEAU, ease: 'acc' }, 0);
}

// découpe un titre en lignes masquées ; « animer » reçoit les lignes et rend l'animation
// (SplitText la refait si la largeur change ou quand les polices arrivent, en gardant sa progression)
function decouper(el, animer) {
  return SplitText.create(el, {
    type: 'lines', mask: 'lines', linesClass: 'acc-ligne', aria: 'none', autoSplit: true,
    onSplit: self => { gsap.set(el, { opacity: 1 }); return animer(self.lines); }
  });
}

// entrée du héros sous le rideau : barre pilule, titre ligne à ligne, textes, cadre de la pièce, règle
function entree(page) {
  const tl = gsap.timeline({ defaults: { ease: 'acc-sortie' } });
  const entete = page.querySelector('[data-entete]');
  tl.fromTo(entete, { opacity: 0, y: -18 }, { opacity: 1, y: 0, duration: 1, onComplete: () => vu(entete) }, 0.25);
  const titre = page.querySelector('[data-entree="lignes"]');
  if (titre) {
    let premier = true;
    decouper(titre, lignes => {
      const tw = gsap.fromTo(lignes, { yPercent: 110, filter: 'blur(10px)' }, { yPercent: 0, filter: 'blur(0px)', duration: 1.15, stagger: 0.09, ease: 'acc-sortie', clearProps: 'filter', onComplete: () => titre.classList.add('is-vu') });
      if (premier) { premier = false; tl.add(tw, 0); }
      return tw;
    });
  }
  const fondus = page.querySelectorAll('[data-entree="fondu"]');
  if (fondus.length) tl.fromTo(fondus, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1, stagger: 0.07, onComplete: () => vu(fondus) }, 0.2);
  const traits = page.querySelectorAll('[data-entree="trait"]');
  if (traits.length) tl.fromTo(traits, { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: 'acc', onComplete: () => vu(traits) }, 0.3);
  return tl;
}

// où se trouve un élément au moment de préparer sa révélation (page rechargée ou revenue en milieu de défilement)
const ETAPE = 0.88;   // on révèle quand le haut de l'élément passe à 88 % de la hauteur d'écran
function position(el) {
  const r = el.getBoundingClientRect();
  return r.bottom < 0 ? 'passe' : r.top < innerHeight * ETAPE ? 'visible' : 'plus-bas';
}
// déjà dépassé : montré tout de suite ; à l'écran : animé tout de suite ; plus bas : animé en arrivant
// (évite aussi de créer des déclencheurs « once » déjà franchis, que ScrollTrigger tuerait pendant son calcul)
function reveler(el, animer, declencheur = el) {
  const ou = position(declencheur);
  if (ou === 'passe') return false;
  animer(ou === 'plus-bas' ? { trigger: declencheur, start: `top ${ETAPE * 100}%`, once: true } : undefined);
  return true;
}

// chiffre qui se « décode » : caractères brouillés, puis la vraie valeur, de gauche à droite
const SIGNES = '0123456789#%/+×';
function decoder(el) {
  const vrai = el.textContent;
  const n = { p: 0 };
  let pas = 0;
  return gsap.to(n, {
    p: 1, duration: 1.1, ease: 'power1.inOut',
    onUpdate: () => {
      if (pas++ % 3) return;   // une image sur trois : le brouillage reste lisible
      const nets = Math.floor(n.p * (vrai.length + 1));
      el.textContent = [...vrai].map((c, i) => (i < nets || !/\d/.test(c) ? c : SIGNES[(Math.random() * SIGNES.length) | 0])).join('');
    },
    onComplete: () => { el.textContent = vrai; }
  });
}

// révélations au fil du défilement (hors héros)
function revelations(page) {
  // titres : ligne à ligne
  page.querySelectorAll('[data-anim="lignes"]').forEach(el => {
    const anime = reveler(el, st => decouper(el, lignes =>
      gsap.fromTo(lignes, { yPercent: 110, filter: 'blur(10px)' }, { yPercent: 0, filter: 'blur(0px)', duration: 1.15, ease: 'acc-sortie', stagger: 0.08, clearProps: 'filter', onComplete: () => el.classList.add('is-vu'), scrollTrigger: st })
    ));
    if (!anime) el.classList.add('is-vu');
  });

  // textes et cellules : fondu montant, par lots
  const fondus = gsap.utils.toArray('[data-anim="fondu"]', page);
  const passes = fondus.filter(el => position(el) === 'passe');
  passes.forEach(el => el.classList.add('is-vu'));
  ScrollTrigger.batch(fondus.filter(el => !passes.includes(el)), {
    start: `top ${ETAPE * 100}%`, once: true,
    onEnter: lot => gsap.fromTo(lot, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, ease: 'acc-sortie', stagger: 0.06, overwrite: true, onComplete: () => vu(lot) })
  });

  // filets et règles : ils se tirent de gauche à droite
  gsap.utils.toArray('[data-trait]', page).forEach(el => {
    const anime = reveler(el, st => gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: 'acc', onComplete: () => vu(el), scrollTrigger: st }));
    if (!anime) el.classList.add('is-vu');
  });

  // textes qui passent du gris à l'encre, mot à mot, au fil du défilement
  page.querySelectorAll('[data-mots]').forEach(el => {
    SplitText.create(el, {
      type: 'words', wordsClass: 'acc-mot', aria: 'none', autoSplit: true,
      onSplit: self => gsap.fromTo(self.words, { opacity: 0.18 }, { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 55%', scrub: 0.4 } })
    });
  });

  // chiffres clés : décodés en arrivant à l'écran
  page.querySelectorAll('[data-decode]').forEach(el => {
    reveler(el, st => (st ? ScrollTrigger.create({ ...st, onEnter: () => decoder(el) }) : decoder(el)));
  });

  // catalogue : les deux rangées entrent chacune de leur côté (seulement si elles sont encore plus bas)
  const defile = page.querySelector('[data-defile]');
  const rangs = gsap.utils.toArray('.acc-defile__rang', page);
  if (defile && rangs.length && position(defile) === 'plus-bas') {
    gsap.fromTo(rangs, { xPercent: i => (i ? -14 : 14), opacity: 0 }, {
      xPercent: 0, opacity: 1, duration: 1.6, ease: 'acc-sortie', stagger: 0.12, onComplete: () => gsap.set(rangs, { clearProps: 'opacity,transform' }),
      scrollTrigger: { trigger: defile, start: `top ${ETAPE * 100}%`, once: true }
    });
  }

  // le nom géant du pied de page monte lettre par lettre
  const nom = page.querySelector('[data-lettres]');
  if (nom) {
    const anime = reveler(nom, st => gsap.fromTo(nom.children, { yPercent: 105, y: 0 }, { yPercent: 0, y: 0, duration: 1.3, ease: 'acc-sortie', stagger: 0.045, onComplete: () => vu(nom, nom.children), scrollTrigger: st }));
    if (!anime) nom.classList.add('is-vu');
  }
}

// élan du catalogue : les rangées (animation CSS) vont plus vite quand la page défile, puis reprennent leur pas ;
// seulement quand elles sont à l'écran. Rend la fonction qui retire tout.
function elan(defile) {
  const animations = () => [...defile.querySelectorAll('.acc-defile__piste')].flatMap(p => p.getAnimations?.() || []);
  let dernier = window.scrollY, vitesse = 1, actif = false;
  function pas(_t, dms) {
    const dt = Math.max(1, dms) / 1000, y = window.scrollY;
    const voulue = 1 + Math.min(5, Math.abs(y - dernier) / dt / 450);
    dernier = y;
    vitesse += (voulue - vitesse) * (1 - Math.exp(-dt * (voulue > vitesse ? 10 : 2.5)));
    animations().forEach(a => { a.playbackRate = vitesse; });
  }
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting === actif) return;
    actif = e.isIntersecting;
    if (actif) { dernier = window.scrollY; gsap.ticker.add(pas); } else gsap.ticker.remove(pas);
  });
  io.observe(defile);
  return () => { io.disconnect(); gsap.ticker.remove(pas); animations().forEach(a => { a.playbackRate = 1; }); };
}

// sections sous la 3D : chaque arrêt du défilement guidé y change de « diapositive » : le contenu de la
// section qui arrive monte à sa place, celui de la section qui part pâlit et recule un peu
function diapositives(page) {
  gsap.utils.toArray('.acc-section', page).forEach(section => {
    const blocs = gsap.utils.toArray(section.querySelectorAll(':scope > :not(.acc-defile, .acc-reperes, [data-anim], [data-trait])'));
    if (!blocs.length) return;
    gsap.fromTo(blocs, { y: 70 }, { y: 0, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'top 35%', scrub: 0.6 } });
    const part = { trigger: section, start: 'bottom 75%', end: 'bottom 10%', scrub: 0.6 };
    gsap.to(blocs, { opacity: 0.22, scale: 0.97, transformOrigin: '50% 0%', ease: 'none', scrollTrigger: part });
    // les rangées du catalogue (elles défilent déjà) pâlissent seulement
    const defile = section.querySelector(':scope > .acc-defile');
    if (defile) gsap.to(defile, { opacity: 0.22, ease: 'none', scrollTrigger: { ...part } });
  });
}

// petites réactions (souris et clavier) : pilule du menu, curseur compagnon, lettres du pied de page
// qui sautent en vague. Les cartes, boutons et éclats sont communs à tout le site
// (components/mouvement/Interactions.js). Rend la fonction qui retire tout.
function reactions(page, ctx) {
  const fins = [suivreCurseur()];
  const ecouter = (cible, type, f, o) => { cible.addEventListener(type, f, o); fins.push(() => cible.removeEventListener(type, f, o)); };

  // menu : une pilule glisse d'un lien à l'autre (survol ou focus clavier)
  const menu = page.querySelector('.acc-menu');
  if (menu) {
    const pilule = document.createElement('span');
    pilule.className = 'acc-menu__pilule';
    pilule.setAttribute('aria-hidden', 'true');
    menu.prepend(pilule);
    fins.push(() => { gsap.killTweensOf(pilule); pilule.remove(); });
    let montree = false;
    const vers = e => {
      const lien = e.target.closest && e.target.closest('a');
      if (!lien || !menu.contains(lien)) return;
      const geo = { x: lien.offsetLeft - 12, width: lien.offsetWidth + 24 };
      if (montree) { gsap.to(pilule, { ...geo, duration: 0.5, ease: 'acc-sortie', overwrite: 'auto' }); return; }
      montree = true;
      gsap.set(pilule, geo);
      gsap.fromTo(pilule, { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'back.out(2.2)', overwrite: 'auto' });
    };
    const cacher = () => { montree = false; gsap.to(pilule, { scale: 0.6, autoAlpha: 0, duration: 0.25, ease: 'power2.in', overwrite: 'auto' }); };
    ecouter(menu, 'pointerover', vers);
    ecouter(menu, 'focusin', vers);
    ecouter(menu, 'pointerleave', cacher);
    ecouter(menu, 'focusout', e => { if (!menu.contains(e.relatedTarget)) cacher(); });
  }

  // nom géant du pied de page : la lettre survolée saute, ses voisines suivent en vague
  const nom = page.querySelector('[data-lettres]');
  if (nom) {
    const lettres = [...nom.children];
    ecouter(nom, 'pointerover', e => {
      const i = lettres.indexOf(e.target);
      if (i < 0 || !nom.classList.contains('is-vu')) return;
      lettres.forEach((l, j) => {
        const d = Math.abs(i - j);
        if (d > 2 || gsap.isTweening(l)) return;
        gsap.timeline({ delay: d * 0.06 })
          .to(l, { yPercent: -12 / (d + 1), rotation: (j - i) * 2, duration: 0.22, ease: 'power2.out' })
          .to(l, { yPercent: 0, rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)', clearProps: 'transform' });
      });
    });
  }
  return () => fins.forEach(f => f());
}
