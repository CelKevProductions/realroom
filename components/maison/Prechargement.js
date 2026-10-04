'use client';
// Préchargement : celui de la visite privée, aux couleurs de Maison Corleone (espresso et crème).
// 1. Entrée : les lettres se posent, la fleur tourne, le filet de laiton se trace. Animations CSS
//    (transformations et opacité seulement), lancées dès le premier affichage de la page : elles
//    tournent hors du fil principal, donc rien (hydratation, chargement) ne peut les figer.
// 2. Attente : l'entrée jouée, la 3D de l'intro se construit (onEntreeFinie) ; la fleur continue de
//    tourner, une lueur descend le filet, le compteur suit la construction.
// 3. Sortie : la 3D est prête et le fil principal libre ; les lettres s'effacent, une arche s'ouvre
//    au centre et dévoile la pièce (onFini, après quoi seulement la 3D s'anime).
import { useLayoutEffect, useRef } from 'react';
import { initGsap, gsap, reduit } from '@/components/maison/anim.js';
import { Fleur } from '@/components/maison/Embleme.js';

// animations de l'entrée (celles que l'on attend avant de lancer la 3D ; le filigrane, très lent, n'en est pas)
const ENTREE = ['mc-pre-caps', 'mc-pre-script', 'mc-pre-fondu', 'mc-pre-fleur', 'mc-pre-ligne'];

// un texte en lettres, chacune avec son retard d'entrée (--d) et son rang (--i) pour la sortie
function Lettres({ texte, depart = 0, pas = .05, rang = 0 }) {
  return Array.from(texte).map((c, i) => (
    <span key={i} className="mc-l" style={{ '--d': `${(depart + i * pas).toFixed(3)}s`, '--i': rang + i }}>{c === ' ' ? ' ' : c}</span>
  ));
}

export default function Prechargement({ t, avancement, pret, onEntreeFinie, onFini }) {
  const racine = useRef(null), forme = useRef(null), ligne = useRef(null), pct = useRef(null), etape = useRef(null);
  const pretRef = useRef(pret);
  pretRef.current = pret;
  const rappels = useRef({ onEntreeFinie, onFini });
  rappels.current = { onEntreeFinie, onFini };

  useLayoutEffect(() => {
    initGsap();
    const el = racine.current;
    const q = s => el.querySelector(s);
    const R = reduit();
    // l'arche : un rectangle plein percé d'une arche (règle evenodd), redessiné pendant la sortie
    const arche = { w: 0, h: 0 };
    const dessiner = () => {
      const w = innerWidth, h = innerHeight, r = arche.w / 2, cx = w / 2, B = h + r + 20, cy = h - arche.h + r;
      let d = `M0 0H${w}V${B}H0Z`;
      if (arche.w > .5 && arche.h > .5) d += `M${cx - r} ${B}V${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}V${B}Z`;
      if (forme.current) forme.current.setAttribute('d', d);
    };
    dessiner();
    addEventListener('resize', dessiner);

    const s = { entree: false, sortie: false, compteur: 0, affiche: -1 };
    const minuteries = [];
    // 1 → 2 : l'entrée est jouée (ou ne se joue pas) : la 3D peut se construire
    const finEntree = () => {
      if (s.entree) return;
      s.entree = true;
      el.classList.add('is-attente');
      if (rappels.current.onEntreeFinie) rappels.current.onEntreeFinie();
    };
    if (R) finEntree();
    else {
      const anims = typeof el.getAnimations === 'function'
        ? el.getAnimations({ subtree: true }).filter(a => ENTREE.includes(a.animationName))
        : [];
      if (anims.length) Promise.all(anims.map(a => a.finished.catch(() => null))).then(finEntree);
      else minuteries.push(setTimeout(finEntree, 2100));
      minuteries.push(setTimeout(finEntree, 4000));   // garde-fou (onglet en arrière-plan…)
    }

    // 2 : compteur de la construction (le filet suit, en transition CSS)
    const tick = () => {
      if (s.sortie || !s.entree) return;
      const cible = Math.min(1, (avancement && avancement.current) || 0) * 100;
      s.compteur += (cible - s.compteur) * .12;
      if (cible - s.compteur < .5) s.compteur = cible;
      const n = Math.floor(s.compteur);
      if (n !== s.affiche) {
        s.affiche = n;
        if (pct.current) pct.current.textContent = String(n);
        if (ligne.current) ligne.current.style.transform = `scaleY(${(s.compteur / 100).toFixed(3)})`;
        if (etape.current) etape.current.textContent = n < 70 ? t.pre.etapes[0] : n < 99 ? t.pre.etapes[1] : t.pre.etapes[2];
      }
      if (pretRef.current && s.compteur >= 99.5) sortir();
    };
    gsap.ticker.add(tick);

    // 3 : les lettres s'effacent (CSS), l'arche monte puis s'ouvre en plein écran
    function sortir() {
      s.sortie = true;
      gsap.ticker.remove(tick);
      const fin = () => rappels.current.onFini && rappels.current.onFini();
      if (R) { gsap.to(el, { autoAlpha: 0, duration: .35, onComplete: fin }); return; }
      el.classList.add('is-sortie');
      const w = innerWidth, h = innerHeight;
      const w1 = w < 700 ? w * .52 : Math.min(w * .24, 380), h1 = h * (w < 700 ? .58 : .64);
      gsap.timeline({ onComplete: fin })
        .to(arche, { w: w1, h: h1, duration: 1.25, ease: 'expo.inOut', onUpdate: dessiner }, .3)
        .to(arche, { w: Math.max(w, h) * 2.4, h: h * 2, duration: 1.45, ease: 'expo.inOut', onUpdate: dessiner }, 1.5);
    }
    return () => {
      gsap.ticker.remove(tick);
      minuteries.forEach(clearTimeout);
      removeEventListener('resize', dessiner);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mc-pre" ref={racine} aria-hidden="true">
      <svg className="mc-pre__rideau" width="100%" height="100%"><path ref={forme} className="mc-pre__forme" fillRule="evenodd" d="M0 0H20000V20000H0Z" /></svg>
      <p className="mc-pre__filigrane">{t.service}</p>
      <span className="mc-pre__fleur"><Fleur /></span>
      <p className="mc-pre__cote mc-pre__cote--g"><Lettres texte={t.pre.gauche} depart={.25} pas={.03} /></p>
      <p className="mc-pre__cote mc-pre__cote--d"><Lettres texte={t.pre.droite} depart={.4} pas={.03} /></p>
      <div className="mc-pre__titre">
        <p className="mc-pre__caps">
          <span><Lettres texte="Maison" depart={.2} /></span>
          <span><Lettres texte="Corleone" depart={.5} rang={6} /></span>
        </p>
        <p className="mc-pre__script"><Lettres texte={t.service} depart={.75} rang={14} /></p>
      </div>
      <span className="mc-pre__ligne"><span ref={ligne} /></span>
      <p className="mc-pre__pct"><span ref={etape}>{t.pre.etapes[0]}</span> <b ref={pct}>0</b>&nbsp;%</p>
      <p className="mc-pre__pied">{t.pre.pied[0]}<br />{t.pre.pied[1]}</p>
    </div>
  );
}
