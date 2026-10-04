'use client';
// Intro 3D dirigée par le défilement (esprit Igloo) : la maquette se construit, les vieux meubles
// s'en vont, les pièces Maison Corleone se posent, le soir tombe. Un texte par moment, des
// étiquettes qui se déchiffrent sur les meubles, une barre de progression ; « Commencer » à la fin.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import { chargerCatalogue } from '@/components/catalogueClient.js';
import { initGsap, lettres, entreeTitre, entreeScript, dechiffrer, monter, reduit } from '@/components/maison/anim.js';
import { prix } from '@/lib/i18n.js';

// moments du récit (part du défilement) : accueil, quatre temps, fin
const MOMENTS = [
  { de: 0, a: .085, cote: 'hero' },
  { de: .1, a: .29, cote: 'g' },
  { de: .3, a: .46, cote: 'd' },
  { de: .47, a: .655, cote: 'g' },
  { de: .67, a: .88, cote: 'd' },
  { de: .9, a: 1.01, cote: 'hero' }
];
const pad2 = n => String(n).padStart(2, '0');

export default function Intro({ t, lang, actif, onAvance, onPret, onFini }) {
  const section = useRef(null), canvas = useRef(null), barre = useRef(null), defiler = useRef(null);
  const etiqRefs = useRef({});
  const moteur = useRef(null);
  const [moment, setMoment] = useState(0);
  const [soir, setSoir] = useState(false);
  const [etiqs, setEtiqs] = useState([]);
  const [panne, setPanne] = useState(false);
  const rappels = useRef({ onAvance, onPret, onFini });
  rappels.current = { onAvance, onPret, onFini };

  // construction de la scène (pendant le préchargement)
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        if (rappels.current.onAvance) rappels.current.onAvance(.15);
        const [{ creerIntro }, cat] = await Promise.all([import('@/moteur/intro.js'), chargerCatalogue()]);
        if (!vivant || !canvas.current) return;
        if (rappels.current.onAvance) rappels.current.onAvance(.65);
        await new Promise(r => requestAnimationFrame(r));
        const m = creerIntro(canvas.current, { produits: cat.produits, mobile: innerWidth < 760 });
        if (!vivant) { m.detruire(); return; }
        moteur.current = m;
        setEtiqs(m.etiquettes().map(e => ({ id: e.id, nom: e.nom, prix: e.prix, cat: e.cat })));
      } catch (e) {
        console.error('intro 3D', e);
        if (vivant) setPanne(true);
      }
      if (vivant) {
        if (rappels.current.onAvance) rappels.current.onAvance(1);
        if (rappels.current.onPret) rappels.current.onPret();
      }
    })();
    return () => { vivant = false; if (moteur.current) { moteur.current.detruire(); moteur.current = null; } };
  }, []);

  // défilement : progression, moment du récit, étiquettes ; à partir de la fin du préchargement
  useEffect(() => {
    if (!actif) return;
    initGsap();
    window.scrollTo(0, 0);
    const R = reduit();
    const lenis = R ? null : new Lenis({ lerp: .085, smoothWheel: true, wheelMultiplier: .85 });
    if (moteur.current) moteur.current.demarrer({ trace: !R });
    let raf = 0, dernierP = -1, dernierMoment = -1, dernierSoir = null;
    const vues = new Set();
    const boucle = temps => {
      if (lenis) lenis.raf(temps);
      const s = section.current, m = moteur.current;
      if (s) {
        const r = s.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
        if (Math.abs(p - dernierP) > 1e-5) {
          dernierP = p;
          if (m) m.regler(p);
          if (barre.current) barre.current.style.transform = `scaleX(${p})`;
          const i = MOMENTS.findIndex(x => p >= x.de && p < x.a);
          if (i !== dernierMoment) { dernierMoment = i; setMoment(i); }
          // texte clair seulement pour la fin (la caméra recule, le fond est sombre) ; avant, la vue
          // intérieure du soir montre des murs éclairés : le texte reste foncé
          const so = p > .88;
          if (so !== dernierSoir) { dernierSoir = so; setSoir(so); }
          if (defiler.current) defiler.current.style.opacity = p < .015 ? '1' : '0';
        }
        if (m) {
          for (const e of m.etiquettes()) {
            const el = etiqRefs.current[e.id];
            if (!el) continue;
            el.style.transform = `translate(${e.x.toFixed(1)}px, ${e.y.toFixed(1)}px) translate(-5px, -50%)`;
            el.style.opacity = String(e.visible);
            if (e.visible > .5 && !vues.has(e.id)) {
              vues.add(e.id);
              const n = el.querySelector('b');
              if (n) dechiffrer(n, e.nom, .7);
            } else if (e.visible === 0 && vues.has(e.id)) vues.delete(e.id);
          }
        }
      }
      raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);
    return () => { cancelAnimationFrame(raf); if (lenis) lenis.destroy(); if (moteur.current) moteur.current.arreter(); };
  }, [actif]);

  // entrée du texte de chaque moment : lettres étirées, script, repère déchiffré
  useLayoutEffect(() => {
    if (!actif || moment < 0) return;
    const bloc = section.current && section.current.querySelector(`[data-moment="${moment}"]`);
    if (!bloc) return;
    entreeTitre(lettres(bloc.querySelector('.mc-recit__titre')), .05);
    entreeScript(lettres(bloc.querySelector('.mc-recit__script')), .4);
    const label = bloc.querySelector('[data-label]');
    if (label) dechiffrer(label, label.dataset.label, .8);
    monter(bloc.querySelectorAll('.mc-recit__texte, .mc-recit__fin'), .5, 16);
  }, [moment, actif]);

  const recits = [t.intro.hero, ...t.intro.recits, t.intro.fin];
  return (
    <section className={'mc-intro' + (soir ? ' is-soir' : '')} ref={section} aria-label={t.intro.hero.lignes.join(' ')}>
      <div className="mc-intro__scene">
        {panne ? <div className="mc-intro__secours" style={{ backgroundImage: 'url(/images/chambre-rendu-2048.jpg)' }} /> : <canvas ref={canvas} aria-hidden="true" />}
        <div className="mc-intro__voile" />
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
            const m = MOMENTS[i];
            const fin = i === recits.length - 1;
            return (
              <div key={i} data-moment={i} className={`mc-recit__bloc mc-recit__bloc--${m.cote}` + (i === moment ? ' is-actif' : '')} aria-hidden={i !== moment}>
                <p className="mc-recit__label mc-mono"><i />{i > 0 && !fin ? pad2(i) + ' — ' : ''}<span data-label={r.label}>{r.label}</span></p>
                <h2 className="mc-recit__titre mc-display">{r.lignes.map((l, k) => <span key={k} className="mc-ligne">{l}</span>)}</h2>
                <p className="mc-recit__script mc-script">{r.script}</p>
                {r.texte && <p className="mc-recit__texte">{r.texte}</p>}
                {fin && (
                  <div className="mc-recit__fin">
                    <button type="button" className={'mc-btn mc-btn--grand ' + (soir ? 'mc-btn--creme' : 'mc-btn--plein')} onClick={() => rappels.current.onFini && rappels.current.onFini()} tabIndex={i === moment ? 0 : -1}>{r.bouton}</button>
                    <p className="mc-recit__note">{r.note}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mc-hud mc-hud--haut">
          <button type="button" className="mc-lien" onClick={() => rappels.current.onFini && rappels.current.onFini()}>{t.intro.passer}</button>
        </div>
        <div className="mc-hud__defiler mc-hud mc-mono" ref={defiler}><span>{t.intro.defiler}</span><i /></div>
        <div className="mc-hud mc-hud--bas mc-mono">
          <span>{moment > 0 && moment < MOMENTS.length - 1 ? pad2(moment) + ' — ' + recits[moment].label : t.marque}</span>
          <span className="mc-hud__barre"><span ref={barre} /></span>
          <span>{pad2(Math.max(0, moment))} / {pad2(MOMENTS.length - 1)}</span>
        </div>
      </div>
    </section>
  );
}
