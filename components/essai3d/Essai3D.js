'use client';
// Essai privé d'un accueil en 3D pour RealRoom : un plan se trace, une maison se dresse autour,
// on la découpe, les meubles se placent seuls, le soir tombe ; puis la présentation du logiciel.
// La scène est celle de l'intro Maison Corleone (moteur/intro.js), habillée aux couleurs de
// l'accueil (plâtre, encre, rouille) et avec la maison à découper (option « maison »).
// Six étapes, un texte chacune : un coup de molette (ou un glissé du doigt, ou une flèche du
// clavier) et la caméra voyage jusqu'à l'étape suivante. Après la dernière, la page défile
// normalement vers la présentation ; revenue tout en haut, la molette repilote la scène.
// Le bouton « Créer mon premier projet » est là dès l'ouverture, sans attendre la 3D.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { chargerCatalogue } from '@/components/catalogueClient.js';
import { initGsap, gsap, SplitText, dechiffrer, reduit } from '@/components/maison/anim.js';
import { prix } from '@/lib/i18n.js';

// arrêts de la caméra (progression p de la scène) et place du texte :
// le plan · la maison dressée · la maison découpée (meubles actuels) · les meubles posés · le soir · la vue d'ensemble
const ETAPES = [
  { p: 0, cote: 'hero' },
  { p: .27, cote: 'g' },
  { p: .315, cote: 'd' },
  { p: .655, cote: 'g' },
  { p: .85, cote: 'd' },
  { p: 1, cote: 'hero' }
];
const CALME = 220;   // un geste de molette est fini quand plus rien n'arrive pendant ce temps
const doux = k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const pad2 = n => String(n).padStart(2, '0');
const HABILLAGE = { brume: { jour: '#EDEAE4', soir: '#131312' }, trait: '#B8411D', maison: {} };

export default function Essai3D({ t, lang }) {
  const section = useRef(null), canvas = useRef(null), barre = useRef(null), defiler = useRef(null), suite = useRef(null);
  const hudNom = useRef(null), hudNum = useRef(null), pct = useRef(null);
  const blocs = useRef([]);
  const etiqRefs = useRef({});
  const moteur = useRef(null);
  const [etiqs, setEtiqs] = useState([]);
  const [panne, setPanne] = useState(false);
  const [pret, setPret] = useState(false);
  const recits = t.recits;
  const lien = `/${lang}/demo`;

  // construction de la scène, dès l'ouverture
  useEffect(() => {
    let vivant = true;
    const avance = v => { if (pct.current) pct.current.textContent = Math.round(v * 100) + ' %'; };
    (async () => {
      try {
        avance(.04);
        const [{ creerIntro }, cat] = await Promise.all([import('@/moteur/intro.js'), chargerCatalogue()]);
        if (!vivant || !canvas.current) return;
        const m = await creerIntro(canvas.current, {
          produits: cat.produits, mobile: innerWidth < 760, ...HABILLAGE,
          avance: q => avance(.1 + .88 * q), annule: () => !vivant
        });
        if (!vivant) { m.detruire(); return; }
        moteur.current = m;
        setEtiqs(m.etiquettes().map(e => ({ id: e.id, nom: e.nom, prix: e.prix })));
      } catch (e) {
        if (e && e.annule) return;
        console.error('accueil 3D', e);
        if (vivant) setPanne(true);
      }
      if (vivant) setPret(true);
    })();
    return () => { vivant = false; if (moteur.current) { moteur.current.detruire(); moteur.current = null; } };
  }, []);

  // les textes, découpés une fois ; l'ouverture est montrée tout de suite
  useLayoutEffect(() => {
    initGsap();
    const coupes = [];
    blocs.current.forEach((b, i) => {
      if (!b) return;
      const titre = SplitText.create(b.querySelector('.es-recit__titre'), { type: 'words,chars', wordsClass: 'mot', charsClass: 'char' });
      coupes.push(titre);
      b.__lettres = { titre: titre.chars, suite: b.querySelectorAll('.es-recit__texte, .es-recit__fin') };
      if (i > 0) gsap.set(b, { autoAlpha: 0 });
    });
    montrer(0);
    return () => coupes.forEach(c => c.revert());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // un moment entre : lettres qui montent de leur ligne, repère déchiffré, le reste en fondu
  function montrer(i) {
    const b = blocs.current[i];
    if (!b) return;
    b.classList.add('is-actif');
    b.removeAttribute('aria-hidden');
    b.querySelectorAll('a, button').forEach(x => { x.tabIndex = 0; });
    gsap.killTweensOf(b);
    gsap.set(b, { autoAlpha: 1 });
    const l = b.__lettres;
    const lab = b.querySelector('[data-label]');
    if (reduit() || !l) { if (lab) lab.textContent = lab.dataset.label; return; }
    gsap.timeline()
      .fromTo(l.titre, { opacity: 0, yPercent: 60 }, { opacity: 1, yPercent: 0, duration: .9, stagger: .018, ease: 'expo.out', overwrite: true }, .04)
      .fromTo(l.suite, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .7, ease: 'mcOut', overwrite: true }, .3);
    if (lab) dechiffrer(lab, lab.dataset.label, .7);
  }
  function cacher(i) {
    const b = blocs.current[i];
    if (!b) return;
    b.classList.remove('is-actif');
    b.setAttribute('aria-hidden', 'true');
    b.querySelectorAll('a, button').forEach(x => { x.tabIndex = -1; });
    if (reduit()) gsap.set(b, { autoAlpha: 0 });
    else gsap.to(b, { autoAlpha: 0, duration: .3, ease: 'power1.out', overwrite: true });
  }

  // étapes guidées, une fois la scène prête. Une seule boucle par image : celle du moteur 3D, qui
  // appelle « image » avant de dessiner (la pièce, les étiquettes et les textes montrent le même instant)
  useEffect(() => {
    if (!pret) return;
    initGsap();
    const R = reduit();
    const m = moteur.current;
    const s = section.current;
    const N = ETAPES.length;
    const st = { etape: 0, p: 0, de: 0, vers: 0, t0: 0, duree: 0, enCours: false, montre: true, texte: 0 };
    let raf = 0, dernierP = -1, dernierSoir = null, dernierDefiler = null;
    const vues = new Set();
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
    addEventListener('resize', majEtiquettes);
    const afficher = i => {
      if (st.texte === i) return;
      if (st.texte >= 0) cacher(st.texte);
      st.texte = i;
      if (i < 0) return;
      montrer(i);
      if (hudNom.current) hudNom.current.textContent = i > 0 && i < N - 1 ? pad2(i) + ' — ' + recits[i].label : t.marque;
      if (hudNum.current) hudNum.current.textContent = `${pad2(i)} / ${pad2(N - 1)}`;
    };
    const aller = sens => {
      const cible = st.etape + sens;
      if (st.enCours || cible < 0) return;
      // après la dernière étape : la page continue vers la présentation
      if (cible >= N) { suite.current && suite.current.scrollIntoView({ behavior: R ? 'auto' : 'smooth' }); return; }
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
      const df = !st.enCours;
      if (df !== dernierDefiler) { dernierDefiler = df; if (defiler.current) defiler.current.style.opacity = df ? '1' : '0'; }
      const p = st.p;
      if (Math.abs(p - dernierP) > 1e-5 || dernierP < 0) {
        dernierP = p;
        if (m) m.regler(p);
        if (barre.current) barre.current.style.transform = `scaleX(${p.toFixed(4)})`;
        const so = p > .76;   // texte clair quand la nuit tombe
        if (so !== dernierSoir) { dernierSoir = so; s.classList.toggle('is-soir', so); }
        majEtiquettes();
      }
    };
    // la scène ne pilote que lorsque la page est tout en haut
    const enHaut = () => scrollY < 4;

    let derniereMolette = 0, cumul = 0, servi = false;
    const surMolette = e => {
      if (!enHaut()) return;
      if (st.etape === N - 1 && !st.enCours && e.deltaY > 0) return;   // défilement normal vers la suite
      e.preventDefault();
      const maintenant = performance.now();
      if (maintenant - derniereMolette > CALME) { cumul = 0; servi = false; }
      derniereMolette = maintenant;
      if (servi) return;
      if (st.enCours) { servi = true; return; }
      cumul += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      if (Math.abs(cumul) > 24) { servi = true; aller(cumul > 0 ? 1 : -1); }
    };
    let y0 = null;
    const surDebut = e => { y0 = enHaut() && e.touches && e.touches.length === 1 ? e.touches[0].clientY : null; };
    const surGlisse = e => { if (y0 !== null && !(st.etape === N - 1 && e.touches[0].clientY < y0)) e.preventDefault(); };
    const surFin = e => {
      if (y0 === null) return;
      const dy = y0 - e.changedTouches[0].clientY;
      y0 = null;
      if (Math.abs(dy) > 40) aller(dy > 0 ? 1 : -1);
    };
    const surTouche = e => {
      if (!enHaut()) return;
      if (e.target && e.target.closest && e.target.closest('button, a, input, textarea, select')) return;
      if (['ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(e.key)) { e.preventDefault(); aller(1); }
      else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); aller(-1); }
    };
    addEventListener('wheel', surMolette, { passive: false });
    s.addEventListener('touchstart', surDebut, { passive: true });
    s.addEventListener('touchmove', surGlisse, { passive: false });
    s.addEventListener('touchend', surFin);
    addEventListener('keydown', surTouche);
    // « passer l'intro » : directement la vue d'ensemble
    s.__passer = () => { if (st.enCours) return; st.etape = N - 2; aller(1); };

    if (m) m.demarrer({ trace: !R, image });
    else {
      const boucle = temps => { image(temps); raf = requestAnimationFrame(boucle); };
      raf = requestAnimationFrame(boucle);
    }
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', majEtiquettes);
      removeEventListener('wheel', surMolette);
      s.removeEventListener('touchstart', surDebut);
      s.removeEventListener('touchmove', surGlisse);
      s.removeEventListener('touchend', surFin);
      removeEventListener('keydown', surTouche);
      if (moteur.current) moteur.current.arreter();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret]);

  const passer = () => section.current && section.current.__passer && section.current.__passer();
  const pr = t.presentation;
  return (
    <main className="es">
      <section className="es-intro" ref={section} aria-label={recits[0].lignes.join(' ')}>
        {panne ? <div className="es-intro__secours" style={{ backgroundImage: 'url(/images/chambre-rendu-2048.jpg)' }} /> : <canvas ref={canvas} aria-hidden="true" />}
        <div className="es-grain" aria-hidden="true" />
        <div className="es-etiq-couche" aria-hidden="true">
          {etiqs.map(e => (
            <span key={e.id} className="es-etiq" ref={el => { etiqRefs.current[e.id] = el; }}>
              <i className="es-etiq__pt" />
              <span className="es-etiq__txt"><b>{e.nom}</b>{e.prix > 0 ? <> · <em>{prix(e.prix * 100, lang)}</em></> : null}</span>
            </span>
          ))}
        </div>
        <div className="es-recit">
          {recits.map((r, i) => {
            const e = ETAPES[i];
            const bord = i === 0 || i === recits.length - 1;
            return (
              <div key={i} ref={el => { blocs.current[i] = el; }} className={`es-recit__bloc es-recit__bloc--${e.cote}`} aria-hidden={i === 0 ? undefined : 'true'}>
                <p className="es-recit__label es-mono"><i />{!bord ? pad2(i) + ' — ' : ''}<span data-label={r.label}>{r.label}</span></p>
                <h2 className="es-recit__titre">{r.lignes.map((l, k) => <span key={k} className="es-ligne">{l}</span>)}</h2>
                {r.texte && <p className="es-recit__texte">{r.texte}</p>}
                {r.bouton && (
                  <div className="es-recit__fin">
                    <Link href={lien} className="es-btn" tabIndex={i === 0 ? 0 : -1}>{r.bouton}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8h12M9 3.5 13.5 8 9 12.5" /></svg></Link>
                    {r.note && <p className="es-recit__note es-mono">{r.note}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <header className="es-hud es-hud--haut">
          <span className="es-marque">{t.marque}</span>
          <span className="es-hud__droite">
            {!pret && !panne && <span className="es-mono es-charge">{t.chargement} · <span ref={pct}>0 %</span></span>}
            {pret && <button type="button" className="es-lien es-mono" onClick={passer}>{t.passer}</button>}
          </span>
        </header>
        <div className="es-hud__defiler es-hud es-mono" ref={defiler}><span>{t.defiler}</span><i /></div>
        <div className="es-hud es-hud--bas es-mono">
          <span ref={hudNom}>{t.marque}</span>
          <span className="es-hud__barre"><span ref={barre} /></span>
          <span ref={hudNum}>00 / {pad2(ETAPES.length - 1)}</span>
        </div>
      </section>

      <section className="es-suite" ref={suite} id="presentation" aria-labelledby="es-suite-titre">
        <p className="es-mono es-suite__label"><i />{t.suite}</p>
        <h2 id="es-suite-titre" className="es-suite__titre">{pr.titre}</h2>
        <p className="es-suite__intro">{pr.intro}</p>
        <h3 className="es-mono es-suite__sous">{pr.etapesTitre}</h3>
        <ol className="es-grille">
          {pr.etapes.map(([titre, txt], i) => (
            <li key={i} className="es-carte"><span className="es-mono">{pad2(i + 1)}</span><h4>{titre}</h4><p>{txt}</p></li>
          ))}
        </ol>
        <h3 className="es-mono es-suite__sous">{pr.pointsTitre}</h3>
        <ul className="es-grille">
          {pr.points.map(([titre, txt], i) => (
            <li key={i} className="es-carte"><h4>{titre}</h4><p>{txt}</p></li>
          ))}
        </ul>
        <div className="es-tarifs">
          <h3>{pr.tarifsTitre}</h3>
          <p>{pr.tarifsTexte}</p>
        </div>
        <div className="es-fin">
          <h2>{pr.finTitre}</h2>
          <p>{pr.finTexte}</p>
          <Link href={lien} className="es-btn">{recits[0].bouton}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8h12M9 3.5 13.5 8 9 12.5" /></svg></Link>
        </div>
      </section>
    </main>
  );
}
