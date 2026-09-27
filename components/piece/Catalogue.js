'use client';
// Catalogue dans une fenêtre : familles, recherche, seulement ce qui tient dans la pièce
import { useEffect, useMemo, useRef, useState } from 'react';
import { prix, remplir } from '@/lib/i18n.js';
import { estSuspendu, estMural } from '@/lib/agencement.js';

function tient(p, dims) {
  if (!p.dim || !dims) return true;
  const [w, d, h] = p.dim, { largeur: L, profondeur: P, hauteur: H } = dims;
  if (estSuspendu(p.fam)) return h <= Math.max(.3, H - 1.85);
  if (estMural(p.fam)) return w <= Math.max(L, P) - .2;
  return h <= H - .03 && ((w <= L - .15 && d <= P - .15) || (d <= L - .15 && w <= P - .15));
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Catalogue({ lang, t, produits, libelles, dims, famille, ouvert, fermer, choisir, action }) {
  const dlg = useRef(null);
  const [fam, setFam] = useState(famille || '');
  const [q, setQ] = useState('');
  const [tientSeul, setTientSeul] = useState(true);
  useEffect(() => { setFam(famille || ''); }, [famille, ouvert]);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);
  const tous = useMemo(() => Object.values(produits || {}), [produits]);
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
  const cm = v => Math.round(v * 100);
  return (
    <dialog ref={dlg} className="dialogue catalogue" onClose={fermer} onClick={e => { if (e.target === dlg.current) fermer(); }}>
      <div className="catalogue__tete">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3>{t.piece.catalogue.titre}</h3>
          <button className="btn btn--lien" onClick={fermer} aria-label="Fermer">✕</button>
        </div>
        <input className="saisie" type="search" placeholder={t.piece.catalogue.recherche} value={q} onChange={e => setQ(e.target.value)} />
        <label className="coche"><input type="checkbox" checked={tientSeul} onChange={e => setTientSeul(e.target.checked)} />{t.piece.catalogue.tientSeulement}</label>
      </div>
      <div className="catalogue__filtres">
        <button className="puce puce-bouton" aria-pressed={!fam} onClick={() => setFam('')}>{t.piece.catalogue.tout}</button>
        {familles.map(f => <button key={f} className="puce puce-bouton" aria-pressed={fam === f} onClick={() => setFam(f)}>{libelles[f] || f}</button>)}
      </div>
      <div className="catalogue__grille">
        {!liste.length && <p className="discret">{t.piece.catalogue.aucun}</p>}
        {liste.map(p => (
          <button key={p.id} className="produit" onClick={() => choisir(p)} data-sku={p.id}>
            <img src={p.vign} alt="" loading="lazy" width="170" height="170" />
            <b>{p.nom}</b>
            <small>{p.cat} · {remplir(t.piece.catalogue.dims, { l: cm(p.dim[0]), p: cm(p.dim[1]), h: cm(p.dim[2]) })}</small>
            <span className="prix">{p.prix > 0 ? prix(p.prix * 100, lang) : t.piece.surDevis}</span>
            <span className="btn btn--clair btn--petit" aria-hidden="true">{action}</span>
          </button>
        ))}
      </div>
    </dialog>
  );
}
