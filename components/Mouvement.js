'use client';
// Mouvement de l'application (GSAP).
// Une seule entrée orchestrée par page : les titres sortent de leur masque, les traits de cote se
// tracent, puis le contenu suit. Ensuite, seulement des mouvements qui répondent à un geste :
// onglets, volet du catalogue, fiche produit, ligne qui se déplie, crédits qui défilent.
// Rien ne bouge si le visiteur a demandé moins d'animations (html sans data-mvt, voir layout.js).
// Durées, courbes et mouvement réduit : components/mouvement/regles.js (communs à tout le site).
import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap, initialiser, mouvementPermis, DUREES, COURBES, DECALAGES, ECARTS } from '@/components/mouvement/regles.js';

export { gsap };
export const animer = mouvementPermis;
const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// fin d'entrée : l'élément garde son état final, sans styles en ligne
function finir(els) {
  for (const e of els) {
    e.classList.add('is-entre');
    for (const p of ['opacity', 'transform', '--trace']) e.style.removeProperty(p);
    e.querySelectorAll('.masque > span').forEach(s => s.style.removeProperty('transform'));
  }
}

// Titre révélé ligne à ligne. lignes : retours à la ligne voulus ; sinon une seule ligne (qui peut passer à la ligne)
export function Titre({ as: Balise = 'h1', lignes, className, children, ...props }) {
  const l = lignes || [children];
  return (
    <Balise className={className} data-entree="titre" {...props}>
      {l.map((x, i) => <span key={i} className="masque"><span>{x}</span></span>)}
    </Balise>
  );
}

// Entrée de page : tous les [data-entree] encore cachés sous ref (titre | trait | le reste en fondu).
// cle : relancer pour les éléments apparus depuis (le déjà-entré ne rejoue pas).
export function useEntree(ref, cle) {
  useIso(() => {
    const racine = ref.current;
    if (!racine) return;
    const els = [racine, ...racine.querySelectorAll('[data-entree]')].filter(e => e.hasAttribute('data-entree') && !e.classList.contains('is-entre'));
    if (!els.length) return;
    if (!animer()) { finir(els); return; }
    initialiser();
    const titres = els.filter(e => e.dataset.entree === 'titre');
    const traits = els.filter(e => e.dataset.entree === 'trait');
    const reste = els.filter(e => !titres.includes(e) && !traits.includes(e));
    const tl = gsap.timeline({ defaults: { ease: COURBES.arrivee }, onComplete: () => finir(els) });
    // y: 0 — sinon GSAP garde le décalage de départ posé par la feuille de style en plus du yPercent
    titres.forEach((t, i) => tl.fromTo(t.querySelectorAll('.masque > span'), { yPercent: 112, y: 0 }, { yPercent: 0, y: 0, duration: DUREES.titre, stagger: DECALAGES.large }, i * .1));
    if (traits.length) tl.fromTo(traits, { '--trace': 0 }, { '--trace': 3, duration: DUREES.titre + .4, ease: COURBES.pivot, stagger: DECALAGES.large }, .12);
    if (reste.length) tl.fromTo(reste, { opacity: 0, y: ECARTS.moyen }, { opacity: 1, y: 0, duration: DUREES.long, stagger: DECALAGES.normal }, titres.length ? .28 : 0);
    // interrompue (navigation, démontage) : l'état final reste, jamais un contenu à demi caché
    return () => { tl.progress(1); tl.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
}

// Conteneur qui joue l'entrée de ce qu'il contient (pour les pages rendues côté serveur)
export function Entree({ as: Balise = 'div', children, ...props }) {
  const ref = useRef(null);
  useEntree(ref);
  return <Balise ref={ref} {...props}>{children}</Balise>;
}

// Contenu qui vient de changer après un geste (onglet, fiche) : il glisse en place
export function apparaitre(el, o = {}) {
  if (!el || !animer()) return;
  const cibles = o.enfants === false ? [el] : [...el.children];
  if (!cibles.length) return;
  initialiser();
  gsap.fromTo(cibles, { opacity: 0, y: o.y ?? ECARTS.petit, x: o.x ?? 0 }, { opacity: 1, y: 0, x: 0, duration: o.duree ?? DUREES.moyen, stagger: o.decalage ?? DECALAGES.serre, ease: COURBES.douce, clearProps: 'opacity,transform', overwrite: true });
}

// Une zone qui se déplie sous la ligne choisie
export function deplier(el) {
  if (!el || !animer()) return;
  // hauteur animée sur une seule ligne de liste (petite surface) : c'est la seule exception à
  // la règle transform/opacity, pour que le contenu suivant descende sans saut
  gsap.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: DUREES.moyen, ease: COURBES.douce, clearProps: 'height,opacity', overwrite: true });
}

// Dialogues : le volet du catalogue glisse depuis la droite, les autres montent en fondu
export function ouvrirDialogue(d, cote) {
  if (!d) return;
  // une fermeture en cours est abandonnée : le dialogue reste ouvert, sans style résiduel
  gsap.killTweensOf(d);
  d.__fermeture?.();
  if (!d.open) d.showModal();
  if (!animer()) { gsap.set(d, { clearProps: 'opacity,transform' }); return; }
  initialiser();
  if (cote === 'droite') gsap.fromTo(d, { xPercent: 100 }, { xPercent: 0, duration: DUREES.long, ease: COURBES.arrivee, clearProps: 'transform', overwrite: true });
  else gsap.fromTo(d, { opacity: 0, y: ECARTS.moyen }, { opacity: 1, y: 0, duration: DUREES.moyen, ease: COURBES.arrivee, clearProps: 'opacity,transform', overwrite: true });
}
export function fermerDialogue(d, cote) {
  if (!d || !d.open) return Promise.resolve();
  if (!animer()) { d.close(); return Promise.resolve(); }
  initialiser();
  return new Promise(fin => {
    // le dialogue sortant ne reçoit plus de clic : il ne peut pas bloquer l'écran pendant sa sortie
    d.style.pointerEvents = 'none';
    const finir = () => { d.__fermeture = null; d.style.removeProperty('pointer-events'); gsap.set(d, { clearProps: 'opacity,transform' }); fin(); };
    const fermer = () => { d.close(); finir(); };
    // rouvert pendant la sortie : la promesse se résout sans fermer
    d.__fermeture = finir;
    if (cote === 'droite') gsap.to(d, { xPercent: 100, duration: DUREES.moyen, ease: COURBES.depart, onComplete: fermer, overwrite: true });
    else gsap.to(d, { opacity: 0, y: ECARTS.petit, duration: DUREES.court, ease: COURBES.depart, onComplete: fermer, overwrite: true });
  });
}

// Nombre qui défile jusqu'à sa nouvelle valeur (crédits). Le nœud texte reste celui de React.
export function Compteur({ valeur, ...props }) {
  const ref = useRef(null);
  const avant = useRef(valeur);
  useIso(() => {
    const el = ref.current, de = avant.current;
    avant.current = valeur;
    if (!el || de === valeur || typeof de !== 'number' || typeof valeur !== 'number' || !animer()) return;
    initialiser();
    const noeud = el.firstChild;
    if (!noeud || noeud.nodeType !== 3) return;
    const o = { v: de };
    noeud.nodeValue = String(de);
    const tw = gsap.to(o, {
      v: valeur, duration: Math.min(1.4, .6 + Math.abs(valeur - de) * .04), ease: COURBES.douce,
      onUpdate: () => { noeud.nodeValue = String(Math.round(o.v)); }
    });
    return () => { tw.kill(); noeud.nodeValue = String(valeur); };
  }, [valeur]);
  return <span ref={ref} {...props}>{valeur}</span>;
}
