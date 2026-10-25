'use client';
// Page d'attente de la première proposition. Le plan de la pièce se trace, des meubles fantômes
// essaient des places pendant que le moteur calcule, les étapes du calcul défilent (indicatives :
// aucun faux pourcentage). Quand la réponse arrive, les vrais meubles se posent un par un.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/components/api.js';
import { chargerCatalogue } from '@/components/catalogueClient.js';
import { annoncer, boucle, gsap } from '@/components/mouvement/regles.js';
import { useIsoLayout } from '@/components/mouvement/react.js';
import Logo from '@/components/Logo.js';
import { contourDe, contientPoint } from '@/lib/contour.js';
import { prix } from '@/lib/i18n.js';
import PlanVivant from './PlanVivant.js';
import { Picto } from './Pictos.js';
import { tracerPlan, poserMeubles } from './animations.js';
import s from './Nouveau.module.css';

// silhouettes des meubles qui « cherchent leur place » (largeur, profondeur en mètres)
const FANTOMES = {
  salon: [[2.2, .9], [.85, .85], [1.1, .6], [1.6, .42], [.5, .5]],
  chambre: [[1.6, 2.05], [.45, .4], [.45, .4], [1.2, .6], [.5, .5]],
  salle_a_manger: [[1.8, .9], [.45, .5], [.45, .5], [.45, .5], [1.6, .45]],
  bureau: [[1.4, .7], [.6, .6], [1, .35], [.85, .85]],
  salle_de_bain: [[1, .5], [.4, .35], [.6, .6]],
  entree: [[1, .35], [1, .4], [.5, .5]],
  terrasse: [[1.2, .8], [.5, .5], [.5, .5], [.6, .6]]
};
const TEINTES = ['var(--peche)', 'var(--menthe)', 'var(--lilas)', 'var(--beurre)', 'var(--rouille-clair)'];
const accent = str => String(str).split(/(\*[^*]+\*)/).filter(Boolean).map((m, i) => (m.startsWith('*') ? <em key={i}>{m.slice(1, -1)}</em> : m));

// quelques places possibles pour chaque fantôme, à l'intérieur de la pièce
function placesFantomes(modele, fonction) {
  const ps = contourDe(modele), xs = ps.map(p => p[0]), zs = ps.map(p => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const reduction = Math.min(1, (x1 - x0) * .45 / 2.2, (z1 - z0) * .45 / 2.05);
  return (FANTOMES[fonction] || FANTOMES.salon).map(([w0, d0], i) => {
    const w = Math.max(.3, w0 * reduction), d = Math.max(.3, d0 * reduction), marge = Math.max(w, d) / 2 + .1;
    const places = [];
    for (let essai = 0; essai < 60 && places.length < 4; essai++) {
      const x = x0 + marge + Math.random() * Math.max(0, x1 - x0 - 2 * marge), z = z0 + marge + Math.random() * Math.max(0, z1 - z0 - 2 * marge);
      if (contientPoint(modele, x, z, marge * .8)) places.push([x, z, Math.random() < .5 ? 0 : 90]);
    }
    if (!places.length) places.push([(x0 + x1) / 2, (z0 + z1) / 2, 0]);
    return { w, d, places, teinte: TEINTES[i % TEINTES.length] };
  });
}

export default function Attente({ lang, x, racine, piece, demande, relancer, modifier, ouvrir }) {
  const a = x.attente;
  const [etat, setEtat] = useState('calcul');   // calcul | pret | erreur
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState('');
  const [phase, setPhase] = useState(0), [conseil, setConseil] = useState(0), [long, setLong] = useState(false);
  const [essai, setEssai] = useState({ n: 0, demande });
  const [occupe, setOccupe] = useState(false);
  const scene = useRef(null), texte = useRef(null);
  const fantomes = useMemo(() => placesFantomes(piece.modele, piece.fonction), [piece]);

  // la demande part, les étapes indicatives avancent ; la révélation attend la fin du tracé du plan
  useEffect(() => {
    let fini = false;
    const debut = Date.now();
    setEtat('calcul'); setErreur(''); setPhase(0); setLong(false);
    const hPhase = setInterval(() => setPhase(p => Math.min(p + 1, a.phases.length - 1)), 2600);
    const hConseil = setInterval(() => setConseil(c => (c + 1) % a.conseils.length), 6500);
    const hLong = setTimeout(() => setLong(true), 22000);
    (async () => {
      const [r, catalogue] = await Promise.all([
        api(`/api/pieces/${piece.id}/variantes`, { method: 'POST', corps: essai.demande }).catch(() => ({ ok: false, erreur: 'reseau' })),
        chargerCatalogue().catch(() => null)
      ]);
      await new Promise(f => setTimeout(f, Math.max(0, 1700 - (Date.now() - debut))));
      if (fini) return;
      if (!r.ok) { setErreur(r.erreur || 'generique'); setEtat('erreur'); annoncer(a.erreur); return; }
      const produits = catalogue?.produits || {};
      const items = (r.piece.agencement || []).filter(it => it.garde !== false);
      const nouveaux = items.filter(it => it.origine === 'catalogue');
      setResultat({ piece: r.piece, produits, n: nouveaux.length, total: nouveaux.reduce((t, it) => t + (produits[it.sku]?.prix || 0), 0) });
      setEtat('pret');
      annoncer(a.pret.replace(/\*/g, ''));
    })();
    return () => { fini = true; clearInterval(hPhase); clearInterval(hConseil); clearTimeout(hLong); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essai]);

  // le plan se trace une fois, puis les fantômes essaient des places tant que le calcul dure
  useIsoLayout(() => {
    const tl = tracerPlan(scene.current?.querySelector('svg'), { meubles: false });
    return () => tl?.progress(1).kill();
  }, []);
  useEffect(() => {
    if (etat !== 'calcul') return undefined;
    const svg = scene.current?.querySelector('svg');
    const els = svg ? [...svg.querySelectorAll('.pv-fantome')] : [];
    els.forEach((el, i) => { const [px, pz, r] = fantomes[i].places[0]; gsap.set(el, { x: px, y: pz, rotation: r, transformOrigin: '50% 50%' }); });
    return boucle(svg, tl => {
      els.forEach((el, i) => {
        const f = fantomes[i];
        f.places.slice(1).concat([f.places[0]]).forEach(([px, pz, r], k) => {
          tl.to(el, { x: px, y: pz, rotation: r, duration: 1.1, ease: 'power3.inOut', transformOrigin: '50% 50%' }, .9 + k * 1.9 + i * .22);
        });
      });
      return tl;
    });
  }, [etat, fantomes]);
  // les vrais meubles se posent
  useIsoLayout(() => {
    if (etat !== 'pret') return undefined;
    const tl = poserMeubles(scene.current?.querySelector('svg'), { ecart: .07 });
    return () => tl?.progress(1).kill();
  }, [etat]);
  // le texte change de forme (calcul, prêt, erreur) : il glisse en place
  useIsoLayout(() => {
    const el = texte.current;
    if (!el) return undefined;
    const tw = gsap.fromTo(el.children, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .6, stagger: .06, ease: 'power3.out', clearProps: 'opacity,transform' });
    return () => tw.progress(1).kill();
  }, [etat]);

  const avecGardes = (essai.demande.garder || []).length > 0;
  async function reessayer(modif) {
    if (occupe) return;
    setOccupe(true);
    try {
      const d = modif ? await relancer(modif) : essai.demande;
      if (d) setEssai(e => ({ n: e.n + 1, demande: d }));
    } finally { setOccupe(false); }
  }
  const message = a.erreurs[erreur] || a.erreurs.generique;
  const items = etat === 'pret' ? resultat.piece.agencement : [];
  const ghost = (
    <g className={s.pvFantomes} aria-hidden="true" style={{ opacity: etat === 'calcul' ? 1 : 0, transition: 'opacity .5s' }}>
      {fantomes.map((f, i) => <rect key={i} className={s.pvFantome + ' pv-fantome'} x={-f.w / 2} y={-f.d / 2} width={f.w} height={f.d} rx={Math.min(.12, f.d / 4)} style={{ fill: f.teinte }} />)}
    </g>
  );
  return (
    <div className={s.attente} role="dialog" aria-modal="true" aria-label={a.etiquette}>
      <span className={s.halo} aria-hidden="true" /><span className={s.halo} aria-hidden="true" />
      <header className={s.entete}>
        <span className={s.marque}><Logo taille={26} /><span>RealRoom</span></span>
      </header>
      <div className={s.attenteCorps}>
        <div className={s.attenteTexte} ref={texte} key={etat} aria-live="polite">
          <p className={s.etiquette}>{a.etiquette}</p>
          {etat === 'calcul' && <>
            <h1 className={s.attenteTitre}>{a.titre}</h1>
            <ol className={s.phases}>
              {a.phases.map((p, i) => <li key={p} data-etat={i < phase ? 'fait' : i === phase ? 'encours' : 'avenir'}>{p}</li>)}
            </ol>
            <div className={s.conseil}><span>{a.conseil}</span><p key={conseil}>{a.conseils[conseil]}</p></div>
            {long && <p className={s.long}>{a.long}</p>}
          </>}
          {etat === 'pret' && <>
            <h1 className={s.attenteTitre}>{accent(a.pret)}</h1>
            <p className={s.total}><span><b>{resultat.n}</b> {a.meubles[(lang === 'en' ? resultat.n !== 1 : resultat.n > 1) ? 1 : 0]}</span>
              {resultat.total > 0 && <span><b>{prix(resultat.total * 100, lang)}</b> {a.totalTexte}</span>}</p>
            <div className={s.actions}>
              <button type="button" className="btn btn--plein btn--large" onClick={() => ouvrir(`${racine}/pieces/${piece.id}`)}>{a.voir}<Picto nom="suite" /></button>
              <button type="button" className="btn btn--lien" onClick={() => modifier('recap')}>{a.retour}</button>
            </div>
          </>}
          {etat === 'erreur' && <>
            <h1 className={s.attenteTitre}>{a.erreur}</h1>
            <p className={s.erreur} role="alert">{message}</p>
            <div className={s.actions}>
              {erreur === 'assistant-budget' && <button type="button" className="btn btn--plein" disabled={occupe} onClick={() => reessayer({ sansBudget: true })}>{a.sansBudget}</button>}
              {['assistant-conservation', 'assistant-disposition'].includes(erreur) && avecGardes && <button type="button" className="btn btn--plein" disabled={occupe} onClick={() => reessayer({ toutRemplacer: true })}>{a.sansGarder}</button>}
              {erreur === 'assistant-disposition' && !avecGardes && (essai.demande.espaces || []).length > 0 && <button type="button" className="btn btn--plein" disabled={occupe} onClick={() => reessayer({ sansCoins: true })}>{a.sansCoins}</button>}
              {['reseau', 'limite', 'generique', 'serveur', 'amenagement-conflit', 'annule'].includes(erreur) || !a.erreurs[erreur]
                ? <button type="button" className="btn btn--plein" disabled={occupe} onClick={() => reessayer(null)}>{a.reessayer}</button> : null}
              <button type="button" className="btn btn--clair" onClick={() => modifier('recap')}>{a.retour}</button>
              {['assistant-disposition', 'regles-bloquantes', 'assistant-conservation'].includes(erreur) && <button type="button" className="btn btn--lien" onClick={() => ouvrir(`${racine}/pieces/${piece.id}`)}>{a.atelier}</button>}
            </div>
          </>}
        </div>
        <div className={s.attenteScene} ref={scene}>
          <div className={s.scene}>
            <PlanVivant modele={piece.modele} items={items} produits={resultat?.produits} cotes={false} fantomes={ghost} label={a.titre} />
          </div>
        </div>
      </div>
    </div>
  );
}
