'use client';
// Animations de la page d'accueil : GSAP (ScrollTrigger, SplitText, Draggable, Inertia) et Lenis.
// Le contenu est déjà complet dans le HTML : ce composant ne fait que le révéler et l'animer.
// Sans JavaScript, ou avec « réduire les animations », la page reste entière et immobile :
// les états de départ (accueil.css) n'existent que si data-acc contient « mouvement ».
import { useEffect, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from 'lenis';

const avantAffichage = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const REDUIT = '(prefers-reduced-motion: reduce)';
// propriétés rendues au CSS une fois l'élément révélé (ses survols et ses mises en page reprennent la main)
const A_EFFACER = 'opacity,transform,translate,rotate,scale';

// jetons posés sur <html data-acc="…"> : js, mouvement, ouverture (écran d'ouverture), anime (le script a la main)
const jetons = () => (document.documentElement.getAttribute('data-acc') || '').split(/\s+/).filter(Boolean);
const poser = liste => document.documentElement.setAttribute('data-acc', [...new Set(liste)].join(' '));
const a = j => jetons().includes(j);
const retirer = j => poser(jetons().filter(x => x !== j));

// fin d'une révélation : l'état de départ CSS est levé (.is-vu) et les styles posés par GSAP sont effacés
function vu(elements, effacer = elements) {
  gsap.utils.toArray(elements).forEach(e => e.classList.add('is-vu'));
  gsap.set(effacer, { clearProps: A_EFFACER });
}

export default function Animations() {
  avantAffichage(() => {
    if (!a('js')) {
      // arrivée par un lien interne : le script d'amorce n'a pas tourné, on pose les jetons avant l'affichage
      poser(matchMedia(REDUIT).matches ? ['js'] : ['js', 'mouvement']);
    } else if (performance.now() > 2500 && a('mouvement')) {
      // script arrivé tard : le secours CSS (3 s) montre déjà tout, on n'anime plus les entrées
      poser(jetons().filter(j => j !== 'mouvement' && j !== 'ouverture'));
    }
    // effacé avant l'affichage de la page suivante (qui reposera les siens)
    return () => document.documentElement.removeAttribute('data-acc');
  }, []);

  useEffect(() => demarrer(), []);
  return null;
}

function demarrer() {
  const page = document.getElementById('acc');
  if (!page) return undefined;
  gsap.registerPlugin(ScrollTrigger, SplitText, Draggable, InertiaPlugin, CustomEase);
  ScrollTrigger.config({ ignoreMobileResize: true });
  CustomEase.create('acc', '0.76, 0, 0.24, 1');          // entrée-sortie franche
  CustomEase.create('acc-sortie', '0.22, 1, 0.36, 1');   // arrivée douce

  const mouvement = a('mouvement');
  const ouverture = mouvement && a('ouverture');
  poser([...jetons(), 'anime']);
  const pointeurFin = matchMedia('(pointer: fine)').matches;
  const nettoyages = [];
  let annule = false;
  let lenis = null;
  const ctx = gsap.context(() => {}, page);
  const mm = gsap.matchMedia();
  const entete = page.querySelector('[data-entete]');

  // ---------- 1. épinglages d'abord : les déclencheurs créés ensuite tiennent compte de la place qu'ils prennent
  if (mouvement) {
    mm.add({ large: '(min-width: 760px)', petit: '(max-width: 759.98px)' }, c => {
      const large = c.conditions.large;
      // l'image du héros s'ouvre comme une fenêtre jusqu'au plein écran
      const trou = page.querySelector('[data-trou]');
      if (trou) {
        const depart = large ? ['27%', '15%'] : ['7%', '12%'];
        gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: large
            ? { trigger: trou, start: 'top top', end: '+=100%', pin: true, scrub: 0.9, anticipatePin: 1 }
            : { trigger: trou, start: 'top 92%', end: 'bottom 70%', scrub: 0.9 }
        })
          .fromTo(trou.querySelector('[data-trou-cadre]'), { '--trou-x': depart[0], '--trou-y': depart[1] }, { '--trou-x': '0%', '--trou-y': '0%', duration: 1 }, 0)
          .fromTo(trou.querySelector('[data-parallaxe]'), { scale: 1.25 }, { scale: 1.02, duration: 1 }, 0)
          .fromTo(trou.querySelectorAll('[data-note]'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.16, stagger: 0.07, ease: 'power2.out' }, 0.72);
      }
      // avant / après : le rideau passe de droite à gauche pendant que la scène reste à l'écran
      const cadre = page.querySelector('[data-aa-cadre]');
      const scene = page.querySelector('[data-aa]');
      if (cadre && scene) {
        gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: cadre, start: 'center center', end: '+=110%', pin: true, scrub: 0.7, anticipatePin: 1 } })
          .fromTo(scene, { '--coupe': '100%' }, { '--coupe': '0%', duration: 1 }, 0)
          .fromTo(scene.querySelectorAll('.acc-aa__img'), { scale: 1.06 }, { scale: 1, duration: 1 }, 0);
      }
    });
  }

  // ---------- 2. horloge de Paris (héros et pied de page)
  const horloges = page.querySelectorAll('[data-horloge]');
  const format = new Intl.DateTimeFormat(document.documentElement.lang === 'en' ? 'en-GB' : 'fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const heure = () => { const h = format.format(new Date()); horloges.forEach(e => { if (e.textContent !== h) e.textContent = h; }); };
  heure();
  const minuterie = setInterval(heure, 15000);
  nettoyages.push(() => clearInterval(minuterie));

  // ---------- 3. défilement doux, et liens d'ancre qui en profitent
  if (mouvement) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
    const tic = t => lenis.raf(t * 1000);
    gsap.ticker.add(tic);
    gsap.ticker.lagSmoothing(0);
    nettoyages.push(() => { gsap.ticker.remove(tic); gsap.ticker.lagSmoothing(500, 33); lenis.destroy(); });
  }
  const ancre = e => {
    const lien = e.target.closest && e.target.closest('a[data-ancre]');
    if (!lien || !lenis) return;       // sans Lenis, le navigateur s'en charge (scroll-margin-top en CSS)
    const id = lien.getAttribute('href');
    const cible = id === '#acc' ? 0 : page.querySelector(id);
    if (cible === null) return;
    e.preventDefault();
    lenis.scrollTo(cible, { duration: 1.5, easing: t => 1 - Math.pow(1 - t, 4) });
    if (cible === 0) { history.replaceState(history.state, '', location.pathname + location.search); return; }
    history.replaceState(history.state, '', id);
    cible.setAttribute('tabindex', '-1');
    cible.focus({ preventScroll: true });   // le clavier repart de la section choisie
  };
  page.addEventListener('click', ancre);
  nettoyages.push(() => page.removeEventListener('click', ancre));

  // ---------- 4. en-tête : fond au défilement, masqué en descendant, sombre sur les sections de nuit
  entete.classList.toggle('is-defile', window.scrollY > 24);
  ctx.add(() => {
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: s => {
        const y = s.scroll();
        entete.classList.toggle('is-defile', y > 24);
        if (mouvement) entete.classList.toggle('is-cache', s.direction === 1 && y > 520);
      }
    });
    const actives = new Set();
    const milieu = () => Math.round(entete.offsetHeight / 2);
    gsap.utils.toArray('[data-fond="nuit"]', page).forEach(section => ScrollTrigger.create({
      trigger: section, start: () => `top ${milieu()}px`, end: () => `bottom ${milieu()}px`,
      onToggle: s => { if (s.isActive) actives.add(section); else actives.delete(section); entete.classList.toggle('is-nuit', actives.size > 0); }
    }));
  });

  // ---------- 5. vitrine du catalogue : glisser à la souris, avec inertie (le doigt et le pavé tactile défilent déjà)
  const vitrine = page.querySelector('[data-vitrine]');
  if (vitrine && pointeurFin) {
    let deplace = false;
    const [glisse] = Draggable.create(vitrine, {
      type: 'scrollLeft', inertia: true, dragClickables: true, edgeResistance: 0.9, minimumMovement: 6,
      cursor: 'grab', activeCursor: 'grabbing',
      onPress() { deplace = false; },
      onDrag() { deplace = true; },
      onDragStart() { vitrine.classList.add('is-glisse'); },
      onRelease() { vitrine.classList.remove('is-glisse'); }
    });
    // un glisser ne doit pas ouvrir la fiche produit sous le curseur
    const bloquer = e => { if (deplace) { e.preventDefault(); e.stopPropagation(); deplace = false; } };
    vitrine.addEventListener('click', bloquer, true);
    nettoyages.push(() => { glisse.kill(); vitrine.removeEventListener('click', bloquer, true); });
  }

  if (mouvement) {
    ctx.add(() => {
      // ---------- 6. défilé de mots : sa vitesse et son sens suivent le défilement de la page
      const piste = page.querySelector('[data-defile-piste]');
      if (piste) {
        const boucle = gsap.to(piste, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
        boucle.totalTime(boucle.duration() * 200);   // de la marge pour repartir en arrière
        const pencher = gsap.quickTo(piste, 'skewX', { duration: 0.6, ease: 'power3' });
        ScrollTrigger.create({
          trigger: '[data-defile]', start: 'top bottom', end: 'bottom top',
          onToggle: s => boucle.paused(!s.isActive),
          onUpdate: s => {
            const v = s.getVelocity(), sens = s.direction;
            gsap.to(boucle, {
              timeScale: sens * gsap.utils.clamp(1, 6, 1 + Math.abs(v) / 300), duration: 0.25, overwrite: true,
              onComplete: () => gsap.to(boucle, { timeScale: sens, duration: 1.2, ease: 'power2.out' })
            });
            pencher(gsap.utils.clamp(-9, 9, -v / 220));
          }
        });
        const redresser = () => pencher(0);
        ScrollTrigger.addEventListener('scrollEnd', redresser);
        nettoyages.push(() => ScrollTrigger.removeEventListener('scrollEnd', redresser));
      }

      // ---------- 7. manifeste : les mots s'allument un à un
      const mots = page.querySelectorAll('[data-mots] > span');
      if (mots.length) {
        gsap.fromTo(mots, { opacity: 0.14 }, { opacity: 1, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: '[data-mots]', start: 'top 82%', end: 'bottom 48%', scrub: 0.5 } });
      }
    });

    // ---------- 8. boutons aimantés
    if (pointeurFin) {
      page.querySelectorAll('[data-aimant]').forEach(el => {
        const x = gsap.quickTo(el, 'x', { duration: 0.7, ease: 'power3' });
        const y = gsap.quickTo(el, 'y', { duration: 0.7, ease: 'power3' });
        const bouger = e => {
          const r = el.getBoundingClientRect();
          const cx = r.left - gsap.getProperty(el, 'x') + r.width / 2, cy = r.top - gsap.getProperty(el, 'y') + r.height / 2;
          x((e.clientX - cx) * 0.28);
          y((e.clientY - cy) * 0.38);
        };
        const quitter = () => { x(0); y(0); };
        el.addEventListener('pointermove', bouger);
        el.addEventListener('pointerleave', quitter);
        nettoyages.push(() => { el.removeEventListener('pointermove', bouger); el.removeEventListener('pointerleave', quitter); gsap.set(el, { clearProps: 'transform' }); });
      });
    }

    // ---------- 9. écran d'ouverture, puis entrée du héros et révélations au défilement
    (async () => {
      const attendre = ms => new Promise(r => setTimeout(r, ms));
      const polices = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve();
      if (ouverture) {
        if (lenis) lenis.stop();
        const image = page.querySelector('[data-trou] img');
        const chargee = image && image.decode ? image.decode().catch(() => {}) : Promise.resolve();
        let compte;
        ctx.add(() => { compte = compter(page); });
        await Promise.all([compte, Promise.race([Promise.all([polices, chargee]), attendre(2200)])]);
      } else {
        await Promise.race([polices, attendre(700)]);
      }
      if (annule) return;
      ctx.add(() => {
        const tl = gsap.timeline();
        if (ouverture) tl.add(sortieOuverture(page, () => { retirer('ouverture'); if (lenis) lenis.start(); }), 0);
        tl.add(entree(page, ouverture), ouverture ? 0.45 : 0);
        revelations(page);
      });
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    })();
  }

  return () => {
    annule = true;
    ctx.revert();
    mm.revert();
    nettoyages.forEach(f => f());
    entete.classList.remove('is-defile', 'is-cache', 'is-nuit');
  };
}

// compteur de l'écran d'ouverture (000 → 100), la barre suit
function compter(page) {
  const boite = page.querySelector('[data-ouverture]');
  const chiffre = boite.querySelector('[data-compteur]');
  const n = { v: 0 };
  return new Promise(resolve => {
    gsap.timeline({ onComplete: resolve })
      .to(n, { v: 100, duration: 1.6, ease: 'power3.inOut', onUpdate: () => { chiffre.textContent = String(Math.round(n.v)).padStart(3, '0'); } }, 0)
      .fromTo(boite.querySelector('[data-barre]'), { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: 'power3.inOut' }, 0);
  });
}

// l'écran d'ouverture se retire vers le haut ; il ne reviendra pas avant la prochaine session
function sortieOuverture(page, fini) {
  const boite = page.querySelector('[data-ouverture]');
  try { sessionStorage.setItem('rr-accueil', '1'); } catch (_) { /* navigation privée : tant pis */ }
  return gsap.timeline({ onComplete: fini })
    .to(boite.querySelector('.acc-ouverture__compteur'), { yPercent: -16, opacity: 0, duration: 0.7, ease: 'acc' }, 0)
    .to(boite.querySelectorAll('.acc-ouverture__haut > *, .acc-ouverture__barre'), { opacity: 0, duration: 0.4 }, 0)
    .fromTo(boite, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'acc' }, 0.12);
}

// découpe un titre en lignes masquées ; « animer » reçoit les lignes et rend l'animation
// (SplitText la refait si la largeur change, en gardant sa progression)
function decouper(el, animer) {
  const enfants = [...el.children];
  const blocs = enfants.length && enfants.every(c => ['block', 'flow-root'].includes(getComputedStyle(c).display));
  return SplitText.create(blocs ? enfants : el, {
    type: 'lines', mask: 'lines', linesClass: 'acc-ligne', aria: 'none', autoSplit: true,
    onSplit: self => { gsap.set(el, { opacity: 1 }); return animer(self.lines); }
  });
}

// entrée du héros : repères de la grille, titre ligne à ligne, cote, textes
function entree(page, avecEntete) {
  const tl = gsap.timeline({ defaults: { ease: 'acc-sortie' } });
  const hero = page.querySelector('.acc-hero');
  const guides = page.querySelector('.acc-guides');
  tl.fromTo(guides.children, { scaleY: 0 }, { scaleY: 1, duration: 1.6, ease: 'acc', stagger: 0.035, onComplete: () => vu(guides, guides.children) }, 0);
  const titre = hero.querySelector('[data-immediat]');
  if (titre) {
    let premier = true;
    decouper(titre, lignes => {
      const tw = gsap.fromTo(lignes, { yPercent: 135 }, { yPercent: 0, duration: 1.3, ease: 'acc-sortie', stagger: 0.1, onComplete: () => titre.classList.add('is-vu') });
      if (premier) { premier = false; tl.add(tw, 0.1); }
      return tw;
    });
  }
  const fondus = hero.querySelectorAll('[data-anim="fondu"]');
  tl.fromTo(fondus, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.07, onComplete: () => vu(fondus) }, 0.35);
  const cote = hero.querySelector('[data-anim="cote"]');
  if (cote) {
    const trait = cote.querySelector('.acc-cote__trait'), texte = cote.querySelector('.acc-cote__texte');
    tl.set(cote, { opacity: 1 }, 0.6)
      .fromTo(trait, { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: 'acc' }, 0.6)
      .fromTo(texte, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8, onComplete: () => vu(cote, [cote, trait, texte]) }, 1.15);
  }
  if (avecEntete) {
    const barre = page.querySelectorAll('.acc-entete__barre > *');
    tl.fromTo(barre, { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 1, stagger: 0.08, onComplete: () => gsap.set(barre, { clearProps: A_EFFACER }) }, 0.3);
  }
  return tl;
}

// où se trouve un élément au moment de préparer sa révélation (page rechargée ou revenue en milieu de défilement)
const ETAPE = 0.9;   // on révèle quand le haut de l'élément passe à 90 % de la hauteur d'écran
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

// révélations au fil du défilement (hors héros)
function revelations(page) {
  page.querySelectorAll('[data-anim="lignes"]:not([data-immediat])').forEach(el => {
    const anime = reveler(el, st => decouper(el, lignes =>
      gsap.fromTo(lignes, { yPercent: 135 }, { yPercent: 0, duration: 1.2, ease: 'acc-sortie', stagger: 0.09, onComplete: () => el.classList.add('is-vu'), scrollTrigger: st })
    ));
    if (!anime) el.classList.add('is-vu');
  });

  const fondus = gsap.utils.toArray('[data-anim="fondu"]', page).filter(el => !el.closest('.acc-hero'));
  const passes = fondus.filter(el => position(el) === 'passe');
  passes.forEach(el => el.classList.add('is-vu'));
  ScrollTrigger.batch(fondus.filter(el => !passes.includes(el)), {
    start: `top ${ETAPE * 100}%`, once: true,
    onEnter: lot => gsap.fromTo(lot, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1, ease: 'acc-sortie', stagger: 0.08, overwrite: true, onComplete: () => vu(lot) })
  });

  // étapes : le trait se tire, puis le contenu de la rangée
  page.querySelectorAll('[data-rangee]').forEach(r => {
    const trait = r.querySelector('[data-rangee-trait]');
    const reste = [...r.children].filter(c => c !== trait);
    const anime = reveler(r, st => gsap.timeline({ scrollTrigger: st, onComplete: () => vu(r, r.children) })
      .fromTo(trait, { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: 'acc' }, 0)
      .fromTo(reste, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, ease: 'acc-sortie', stagger: 0.07 }, 0.15));
    if (!anime) r.classList.add('is-vu');
  });

  // cartes du catalogue : arrivent de la droite (seulement si elles sont encore plus bas)
  const vitrine = page.querySelector('[data-vitrine]');
  const cartes = gsap.utils.toArray('.acc-produit', page);
  if (vitrine && cartes.length && position(vitrine) === 'plus-bas') {
    gsap.from(cartes, { x: 90, opacity: 0, duration: 1.2, ease: 'acc-sortie', stagger: 0.06, onComplete: () => gsap.set(cartes, { clearProps: A_EFFACER }), scrollTrigger: { trigger: vitrine, start: `top ${ETAPE * 100}%`, once: true } });
  }

  // le nom géant du pied de page monte lettre par lettre
  const nom = page.querySelector('[data-lettres]');
  if (nom) {
    const anime = reveler(nom, st => gsap.fromTo(nom.children, { yPercent: 105, y: 0 }, { yPercent: 0, y: 0, duration: 1.3, ease: 'acc-sortie', stagger: 0.045, onComplete: () => vu(nom, nom.children), scrollTrigger: st }));
    if (!anime) nom.classList.add('is-vu');
  }
}
