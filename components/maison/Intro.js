'use client';
// Intro 3D guidée (esprit Igloo) : la maquette se construit, les vieux meubles s'en vont, les pièces
// Maison Corleone se posent, le soir tombe. Six étapes, un texte chacune : un coup de molette (ou un
// glissé du doigt, ou une flèche du clavier) et la caméra voyage d'elle-même jusqu'à l'étape
// suivante, le texte change à l'arrivée. Pas de défilement libre : chaque geste mène quelque part.
// Rien ne passe par React pendant le voyage : les textes sont découpés en lettres une seule fois, et
// chaque changement est une animation GSAP (transformations et opacité seulement).
// La scène se construit quand le préchargement a joué son entrée (charger), et ne s'anime qu'une
// fois son arche ouverte (actif).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { chargerCatalogue } from '@/components/catalogueClient.js';
import { initGsap, gsap, SplitText, dechiffrer, reduit } from '@/components/maison/anim.js';
import { prix } from '@/lib/i18n.js';

// étapes du récit : la progression de la scène 3D (p) où la caméra s'arrête, et le côté du texte.
// Chaque arrêt montre un état au repos : la pièce montée avec les meubles d'avant, la pièce vide,
// les pièces Maison Corleone posées (de jour), le soir, puis la vue d'ensemble.
const ETAPES = [
  { p: 0, cote: 'hero' },
  { p: .3, cote: 'g' },
  { p: .455, cote: 'd' },
  { p: .655, cote: 'g' },
  { p: .85, cote: 'd' },
  { p: 1, cote: 'hero' }
];
// un geste de molette est fini quand plus rien n'arrive pendant ce temps (inertie du pavé tactile comprise)
const CALME = 220;
const doux = k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);   // départ et arrivée en douceur
const pad2 = n => String(n).padStart(2, '0');

export default function Intro({ t, lang, charger, actif, onAvance, onPret, onFini }) {
  const section = useRef(null), canvas = useRef(null), barre = useRef(null), defiler = useRef(null);
  const hudNom = useRef(null), hudNum = useRef(null);
  const blocs = useRef([]);
  const etiqRefs = useRef({});
  const moteur = useRef(null);
  const [etiqs, setEtiqs] = useState([]);
  const [panne, setPanne] = useState(false);
  const rappels = useRef({ onAvance, onPret, onFini });
  rappels.current = { onAvance, onPret, onFini };
  const recits = [t.intro.hero, ...t.intro.recits, t.intro.fin];

  // ?mesure dans l'adresse : durée de chaque étape de construction, lisible par les essais (lu au
  // montage : la page nettoie ensuite son adresse)
  const mesure = useRef(null);
  const vivant = useRef(true);
  useEffect(() => {
    vivant.current = true;
    if (location.search.includes('mesure')) mesure.current = (nom, ms) => { (window.__mcMesures ||= []).push([nom, Math.round(ms)]); };
    return () => { vivant.current = false; if (moteur.current) { moteur.current.detruire(); moteur.current = null; } };
  }, []);

  // construction de la scène, une fois l'animation du préchargement jouée (charger) : par étapes
  // courtes, sous le préchargement en attente (ses animations CSS ne dépendent pas du fil principal)
  const lance = useRef(false);
  useEffect(() => {
    if (!charger || lance.current) return;
    lance.current = true;
    const avance = v => rappels.current.onAvance && rappels.current.onAvance(v);
    (async () => {
      try {
        avance(.04);
        const [{ creerIntro }, cat] = await Promise.all([import('@/moteur/intro.js'), chargerCatalogue()]);
        if (!vivant.current || !canvas.current) return;
        avance(.1);
        const m = await creerIntro(canvas.current, {
          produits: cat.produits, mobile: innerWidth < 760,
          avance: q => avance(.1 + .88 * q), annule: () => !vivant.current, mesure: mesure.current
        });
        if (!vivant.current) { m.detruire(); return; }
        moteur.current = m;
        if (mesure.current) window.__mcIntro = m;
        setEtiqs(m.etiquettes().map(e => ({ id: e.id, nom: e.nom, prix: e.prix, cat: e.cat })));
      } catch (e) {
        if (e && e.annule) return;
        console.error('intro 3D', e);
        if (vivant.current) setPanne(true);
      }
      if (vivant.current) {
        avance(1);
        if (rappels.current.onPret) rappels.current.onPret();
      }
    })();
  }, [charger]);

  // les textes, découpés une fois pour toutes ; tous cachés jusqu'à leur moment
  useLayoutEffect(() => {
    initGsap();
    const coupes = [];
    blocs.current.forEach(b => {
      if (!b) return;
      const titre = SplitText.create(b.querySelector('.mc-recit__titre'), { type: 'words,chars', wordsClass: 'mot', charsClass: 'char' });
      const script = SplitText.create(b.querySelector('.mc-recit__script'), { type: 'chars', charsClass: 'char' });
      coupes.push(titre, script);
      b.__lettres = { titre: titre.chars, script: script.chars, suite: b.querySelectorAll('.mc-recit__texte, .mc-recit__fin') };
      gsap.set(b, { autoAlpha: 0 });
    });
    return () => coupes.forEach(c => c.revert());
  }, []);

  // un moment entre : lettres étirées qui se posent, script qui glisse, repère déchiffré
  function montrer(i) {
    const b = blocs.current[i];
    if (!b) return;
    b.classList.add('is-actif');
    b.removeAttribute('aria-hidden');
    b.querySelectorAll('button').forEach(x => { x.tabIndex = 0; });
    gsap.killTweensOf(b);
    gsap.set(b, { autoAlpha: 1 });
    const l = b.__lettres;
    const lab = b.querySelector('[data-label]');
    if (reduit() || !l) { if (lab) lab.textContent = lab.dataset.label; return; }
    gsap.timeline()
      .fromTo(l.titre, { opacity: 0, yPercent: 38, scaleY: 1.55, transformOrigin: '50% 100%' },
        { opacity: 1, yPercent: 0, scaleY: 1, duration: .95, stagger: .02, ease: 'expo.out', overwrite: true }, .04)
      .fromTo(l.script, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: .8, stagger: .025, ease: 'power2.out', overwrite: true }, .32)
      .fromTo(l.suite, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .7, ease: 'mcOut', overwrite: true }, .38);
    if (lab) dechiffrer(lab, lab.dataset.label, .7);
  }
  // un moment sort : le bloc s'efface d'un coup de fondu
  function cacher(i) {
    const b = blocs.current[i];
    if (!b) return;
    b.classList.remove('is-actif');
    b.setAttribute('aria-hidden', 'true');
    b.querySelectorAll('button').forEach(x => { x.tabIndex = -1; });
    if (reduit()) gsap.set(b, { autoAlpha: 0 });
    else gsap.to(b, { autoAlpha: 0, duration: .3, ease: 'power1.out', overwrite: true });
  }

  // étapes guidées : un geste → l'étape suivante (ou précédente), une fois l'arche du préchargement
  // ouverte. Une seule boucle par image : celle du moteur 3D, qui appelle « image » avant de dessiner
  // (la pièce, les étiquettes et les textes montrent toujours le même instant)
  useEffect(() => {
    if (!actif) return;
    initGsap();
    window.scrollTo(0, 0);
    const R = reduit();
    const m = moteur.current;
    const s = section.current;
    const N = ETAPES.length;
    // voyage en cours : de → vers, entre t0 et t0 + duree ; le texte de l'étape paraît à mi-chemin
    const st = { etape: 0, p: 0, de: 0, vers: 0, t0: 0, duree: 0, enCours: false, montre: true, texte: -1 };
    let raf = 0, dernierP = -1, dernierSoir = null, dernierDefiler = null;
    const vues = new Set();
    // étiquettes des meubles : recalculées seulement quand la caméra bouge, un style n'est écrit que
    // s'il change ; largeur lue une fois : près du bord droit, l'étiquette passe à gauche de son point
    const largeurs = {};
    const majEtiquettes = () => {
      if (!m) return;
      for (const e of m.etiquettes()) {
        const el = etiqRefs.current[e.id];
        if (!el) continue;
        const o = e.visible > .001 ? e.visible.toFixed(3) : '0';
        if (o !== el.__o) { el.__o = o; el.style.opacity = o; }
        if (o !== '0') {
          const w = largeurs[e.id] ||= el.offsetWidth;
          const gauche = e.x + w > innerWidth - 16;
          if (gauche !== el.__g) { el.__g = gauche; el.classList.toggle('is-gauche', gauche); }
          const tr = `translate3d(${e.x.toFixed(1)}px, ${e.y.toFixed(1)}px, 0) translate(${gauche ? 'calc(5px - 100%)' : '-5px'}, -50%)`;
          if (tr !== el.__t) { el.__t = tr; el.style.transform = tr; }
        }
        if (e.visible > .5 && !vues.has(e.id)) {
          vues.add(e.id);
          const n = el.querySelector('b');
          if (n) dechiffrer(n, e.nom, .7);
        } else if (e.visible === 0 && vues.has(e.id)) vues.delete(e.id);
      }
    };
    const surTaille = () => majEtiquettes();
    addEventListener('resize', surTaille);
    // le texte d'une étape (et le repère du bas)
    const afficher = i => {
      if (st.texte === i) return;
      if (st.texte >= 0) cacher(st.texte);
      st.texte = i;
      if (i < 0) return;
      montrer(i);
      if (hudNom.current) hudNom.current.textContent = i > 0 && i < N - 1 ? pad2(i) + ' — ' + recits[i].label : t.marque;
      if (hudNum.current) hudNum.current.textContent = `${pad2(i)} / ${pad2(N - 1)}`;
    };
    afficher(0);
    // vers l'étape voisine : le texte s'efface, la caméra voyage (durée selon la distance)
    const aller = sens => {
      const cible = st.etape + sens;
      if (st.enCours || cible < 0 || cible >= N) return;
      st.etape = cible;
      st.de = st.p; st.vers = ETAPES[cible].p;
      st.duree = R ? 0 : Math.min(2300, Math.max(1300, 1100 + 2600 * Math.abs(st.vers - st.de)));
      st.t0 = performance.now(); st.enCours = true; st.montre = false;
      afficher(-1);
    };
    const image = temps => {
      if (st.enCours) {
        const k = st.duree ? Math.min(1, Math.max(0, (temps - st.t0) / st.duree)) : 1;
        st.p = st.de + (st.vers - st.de) * doux(k);
        if (!st.montre && k >= .55) { st.montre = true; afficher(st.etape); }
        if (k >= 1) st.enCours = false;
      }
      // « Faites défiler » : à chaque arrêt, sauf le dernier
      const df = !st.enCours && st.etape < N - 1;
      if (df !== dernierDefiler) { dernierDefiler = df; if (defiler.current) defiler.current.style.opacity = df ? '1' : '0'; }
      const p = st.p;
      if (Math.abs(p - dernierP) > 1e-5 || dernierP < 0) {
        dernierP = p;
        if (m) m.regler(p);
        if (barre.current) barre.current.style.transform = `scaleX(${p.toFixed(4)})`;
        // texte clair seulement pour la fin (la caméra recule, le fond est sombre)
        const so = p > .88;
        if (so !== dernierSoir) { dernierSoir = so; s.classList.toggle('is-soir', so); }
        majEtiquettes();
      }
    };

    // les gestes. Molette ou pavé tactile : un geste (inertie comprise) = une étape ; un geste commencé
    // pendant un voyage est ignoré en entier, pour que son inertie ne saute pas l'étape d'après.
    let derniereMolette = 0, cumul = 0, servi = false;
    const surMolette = e => {
      e.preventDefault();
      const maintenant = performance.now();
      if (maintenant - derniereMolette > CALME) { cumul = 0; servi = false; }
      derniereMolette = maintenant;
      if (servi) return;
      if (st.enCours) { servi = true; return; }
      cumul += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      if (Math.abs(cumul) > 24) { servi = true; aller(cumul > 0 ? 1 : -1); }
    };
    // doigt : un glissé vertical d'au moins 40 px
    let y0 = null;
    const surDebut = e => { y0 = e.touches && e.touches.length === 1 ? e.touches[0].clientY : null; };
    const surGlisse = e => { if (y0 !== null) e.preventDefault(); };
    const surFin = e => {
      if (y0 === null) return;
      const dy = y0 - e.changedTouches[0].clientY;
      y0 = null;
      if (Math.abs(dy) > 40) aller(dy > 0 ? 1 : -1);
    };
    // clavier : flèches, pages, espace (sauf sur un bouton)
    const surTouche = e => {
      if (e.target && e.target.closest && e.target.closest('button, a, input, textarea, select')) return;
      if (['ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(e.key)) { e.preventDefault(); aller(1); }
      else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); aller(-1); }
    };
    addEventListener('wheel', surMolette, { passive: false });
    s.addEventListener('touchstart', surDebut, { passive: true });
    s.addEventListener('touchmove', surGlisse, { passive: false });
    s.addEventListener('touchend', surFin);
    addEventListener('keydown', surTouche);

    if (m) m.demarrer({ trace: !R, image });
    else {
      // sans 3D (image de secours) : une boucle à nous
      const boucle = temps => { image(temps); raf = requestAnimationFrame(boucle); };
      raf = requestAnimationFrame(boucle);
    }
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', surTaille);
      removeEventListener('wheel', surMolette);
      s.removeEventListener('touchstart', surDebut);
      s.removeEventListener('touchmove', surGlisse);
      s.removeEventListener('touchend', surFin);
      removeEventListener('keydown', surTouche);
      if (moteur.current) moteur.current.arreter();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif]);

  const fini = () => rappels.current.onFini && rappels.current.onFini();
  return (
    <section className="mc-intro" ref={section} aria-label={t.intro.hero.lignes.join(' ')}>
      <div className="mc-intro__scene">
        {panne ? <div className="mc-intro__secours" style={{ backgroundImage: 'url(/images/chambre-rendu-2048.jpg)' }} /> : <canvas ref={canvas} aria-hidden="true" />}
        <div className="mc-etiq-couche" aria-hidden="true">
          {etiqs.map(e => (
            <span key={e.id} className="mc-etiq" ref={el => { etiqRefs.current[e.id] = el; }}>
              <i className="mc-etiq__pt" />
              <span className="mc-etiq__txt"><b>{e.nom}</b> · <em>{e.prix > 0 ? prix(e.prix * 100, lang) : ''}</em></span>
            </span>
          ))}
        </div>
        <div className="mc-recit">
          {recits.map((r, i) => {
            const m = ETAPES[i];
            const fin = i === recits.length - 1;
            return (
              <div key={i} ref={el => { blocs.current[i] = el; }} className={`mc-recit__bloc mc-recit__bloc--${m.cote}`} aria-hidden="true">
                <p className="mc-recit__label mc-mono"><i />{i > 0 && !fin ? pad2(i) + ' — ' : ''}<span data-label={r.label}>{r.label}</span></p>
                <h2 className="mc-recit__titre mc-display">{r.lignes.map((l, k) => <span key={k} className="mc-ligne">{l}</span>)}</h2>
                <p className="mc-recit__script mc-script">{r.script}</p>
                {r.texte && <p className="mc-recit__texte">{r.texte}</p>}
                {fin && (
                  <div className="mc-recit__fin">
                    <button type="button" className="mc-btn mc-btn--grand mc-btn--plein mc-intro__go" onClick={fini} tabIndex={-1}>{r.bouton}</button>
                    <p className="mc-recit__note">{r.note}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mc-hud mc-hud--haut">
          <button type="button" className="mc-lien" onClick={fini}>{t.intro.passer}</button>
        </div>
        <div className="mc-hud__defiler mc-hud mc-mono" ref={defiler}><span>{t.intro.defiler}</span><i /></div>
        <div className="mc-hud mc-hud--bas mc-mono">
          <span ref={hudNom}>{t.marque}</span>
          <span className="mc-hud__barre"><span ref={barre} /></span>
          <span ref={hudNum}>00 / {pad2(ETAPES.length - 1)}</span>
        </div>
      </div>
    </section>
  );
}
