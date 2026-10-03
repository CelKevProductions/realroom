'use client';
// Catalogue : un volet qui glisse depuis la droite. Familles, recherche, seulement ce qui tient
// dans la pièce. Choisir un meuble ouvre sa fiche : sa maquette 3D en gros plan, qui tourne sur
// elle-même (on la fait tourner au doigt), sa photo, ses cotes, son prix — puis on l'ajoute.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { prix, remplir } from '@/lib/i18n.js';
import { estSuspendu, estMural } from '@/lib/agencement.js';
import { ouvrirDialogue, fermerDialogue, apparaitre, animer } from '@/components/Mouvement.js';

function tient(p, dims) {
  if (!p.dim || !dims) return true;
  const [w, d, h] = p.dim, { largeur: L, profondeur: P, hauteur: H } = dims;
  if (estSuspendu(p.fam)) return h <= Math.max(.3, H - 1.85);
  if (estMural(p.fam)) return w <= Math.max(L, P) - .2;
  return h <= H - .03 && ((w <= L - .15 && d <= P - .15) || (d <= L - .15 && w <= P - .15));
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const EXTERIEUR = new Set(['salon-jardin', 'balancelle', 'jardiniere']);
const Croix = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;

// fiche d'un produit : la vitrine 3D (moteur/vitrine.js, chargée à la demande) ou la photo
function Fiche({ p, t, lang, produits, action, choisir, fermer }) {
  const tc = t.piece.catalogue;
  const racine = useRef(null);
  const canvas = useRef(null);
  const texte = useRef(null);
  const vitrine = useRef(null);
  const courant = useRef(p);
  courant.current = p;
  const [vue, setVue] = useState('3d');
  const [panne, setPanne] = useState(false);
  useLayoutEffect(() => { apparaitre(racine.current, { enfants: false, x: 32, y: 0, duree: .65 }); }, []);
  useEffect(() => {
    let vivant = true;
    import('@/moteur/vitrine.js').then(({ creerVitrine }) => {
      if (!vivant || !canvas.current) return;
      vitrine.current = creerVitrine(canvas.current, { produits, anime: animer() });
      vitrine.current.montrer(courant.current.id);
    }).catch(e => { console.error(e); if (vivant) setPanne(true); });
    return () => { vivant = false; if (vitrine.current) { vitrine.current.detruire(); vitrine.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const premier = useRef(true);
  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    if (vitrine.current) vitrine.current.montrer(p.id);
    setVue('3d');
    apparaitre(texte.current);
  }, [p.id]);
  useEffect(() => { if (vitrine.current) vitrine.current.pause(vue !== '3d'); }, [vue]);
  const cm = v => Math.round(v * 100);
  const photo = vue === 'photo' || panne;
  return (
    <aside className="detail" ref={racine} aria-label={p.nom}>
      <div className="detail__defile">
        <div className="detail__vue">
          <canvas ref={canvas} aria-label={tc.tourner} />
          {photo && <img className="detail__photo" src={p.img || p.vign} alt={p.titre || p.nom} />}
          <div className="segment detail__onglets" role="group">
            <button aria-pressed={!photo} disabled={panne} onClick={() => setVue('3d')}>{tc.vue3d}</button>
            <button aria-pressed={photo} onClick={() => setVue('photo')}>{tc.photo}</button>
          </div>
          <button className="btn btn--clair btn--icone detail__fermer" onClick={fermer} aria-label={tc.fermerFiche}><Croix /></button>
          {!photo && <span className="detail__aide">{tc.tourner}</span>}
        </div>
        <div className="detail__texte" ref={texte}>
          <b>{p.nom}</b>
          {p.titre && p.titre !== p.nom && <p>{p.titre}</p>}
          <p className="detail__cotes">{p.cat}, {remplir(tc.dims, { l: cm(p.dim[0]), p: cm(p.dim[1]), h: cm(p.dim[2]) })}</p>
          <p className="detail__prix">{p.prix > 0 ? prix(p.prix * 100, lang) : t.piece.surDevis}</p>
        </div>
      </div>
      <div className="detail__pied">
        <button className="btn btn--plein" onClick={() => choisir(p)}>{action}</button>
        {p.url && <a className="btn btn--clair" href={p.url} target="_blank" rel="noopener">{t.piece.voirFiche}</a>}
      </div>
    </aside>
  );
}

export default function Catalogue({ lang, t, produits, libelles, dims, exterieur, famille, ouvert, fermer, choisir, action }) {
  const tc = t.piece.catalogue;
  const dlg = useRef(null);
  const [fam, setFam] = useState(famille || '');
  const [q, setQ] = useState('');
  const [tientSeul, setTientSeul] = useState(true);
  const [fiche, setFiche] = useState(null);
  useEffect(() => { setFam(famille || ''); if (ouvert) setFiche(null); }, [famille, ouvert]);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (ouvert && !d.open) ouvrirDialogue(d, 'droite');
    if (!ouvert && d.open) fermerDialogue(d, 'droite').then(() => setFiche(null));
  }, [ouvert]);
  // pièce intérieure : pas de mobilier d'extérieur (et l'inverse pour une terrasse)
  const tous = useMemo(() => Object.values(produits || {}).filter(p => (exterieur ? true : !(p.ext || EXTERIEUR.has(p.fam)))), [produits, exterieur]);
  const familles = useMemo(() => {
    const n = {};
    tous.forEach(p => { if (!tientSeul || tient(p, dims)) n[p.fam] = (n[p.fam] || 0) + 1; });
    return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([f]) => f);
  }, [tous, tientSeul, dims]);
  const liste = useMemo(() => {
    const m = norm(q).split(/\s+/).filter(Boolean);
    return tous.filter(p => (!fam || p.fam === fam) && (!tientSeul || tient(p, dims))
      && m.every(x => norm([p.nom, p.titre, p.cat, (p.couleurs || []).join(' ')].join(' ')).includes(x)))
      .sort((a, b) => (b.look ? 1 : 0) - (a.look ? 1 : 0) || (a.prix || 9e9) - (b.prix || 9e9)).slice(0, 120);
  }, [tous, fam, q, tientSeul, dims]);

  return (
    <dialog ref={dlg} className="catalogue" aria-label={tc.titre} onClose={fermer} onCancel={e => { e.preventDefault(); fermer(); }} onClick={e => { if (e.target === dlg.current) fermer(); }}>
      <div className="catalogue__tete">
        <div className="catalogue__ligne">
          <h3>{tc.titre}</h3>
          <button className="btn btn--clair btn--icone" onClick={fermer} aria-label={tc.fermer}><Croix /></button>
        </div>
        <div className="catalogue__recherche">
          <input className="saisie" type="search" placeholder={tc.recherche} aria-label={tc.recherche} value={q} onChange={e => setQ(e.target.value)} />
          <label className="coche"><input type="checkbox" checked={tientSeul} onChange={e => setTientSeul(e.target.checked)} />{tc.tientSeulement}</label>
        </div>
      </div>
      <div className="catalogue__filtres">
        <button className="puce puce-bouton" aria-pressed={!fam} onClick={() => setFam('')}>{tc.tout}</button>
        {familles.map(f => <button key={f} className="puce puce-bouton" aria-pressed={fam === f} onClick={() => setFam(f)}>{libelles[f] || f}</button>)}
      </div>
      <div className={'catalogue__corps' + (fiche ? ' is-detail' : '')}>
        <div className="catalogue__grille">
          <p className="catalogue__compte chiffre" aria-live="polite">{remplir(tc.resultats, { n: liste.length })}</p>
          {!liste.length && <p className="vide">{tc.aucun}</p>}
          {liste.map(p => (
            <button key={p.id} className="produit" aria-pressed={!!fiche && fiche.id === p.id} onClick={() => setFiche(p)} data-sku={p.id}>
              <span className="produit__image"><img src={p.vign} alt="" loading="lazy" width="176" height="220" /></span>
              <b>{p.nom}</b>
              <small>{p.cat}</small>
              <span className="prix">{p.prix > 0 ? prix(p.prix * 100, lang) : t.piece.surDevis}</span>
            </button>
          ))}
        </div>
        {fiche && <Fiche p={fiche} t={t} lang={lang} produits={produits} action={action} choisir={choisir} fermer={() => setFiche(null)} />}
      </div>
    </dialog>
  );
}
