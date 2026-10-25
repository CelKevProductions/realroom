'use client';
// Démo de la collection procédurale : chaque meuble, élément et revêtement dans une pièce témoin,
// avec ses styles et ses coloris. Rien n'est enregistré.
import { useEffect, useMemo, useState } from 'react';
import Editeur3D from '@/components/piece/Editeur3D.js';
import s from './Collection.module.css';

const L = 4.2, P = 3.6, H = 2.6;
// hauteur du bas des objets accrochés au mur qui ne sont pas des familles murales
const HAUTEUR_POSE = { 'meuble-haut-cuisine': 1.45, 'hotte-murale': 1.55, credence: .9, 'meuble-vasque': .5, 'wc-suspendu': .3,
  'seche-serviettes': .25, 'chevet-flottant': .35, 'meuble-tv-suspendu': .3, 'climatiseur-mural': 2.05, 'portemanteau-mural': 1.55 };

function piece(murFond, sol) {
  const mur = couleur => ({ couleur, ouvertures: [] });
  return {
    v: 1, dims: { largeur: L, profondeur: P, hauteur: H },
    murs: { fond: { ...mur('#EFEAE2'), ...(murFond ? { revetement: murFond } : {}) }, entree: mur('#EFEAE2'), droite: mur('#EFEAE2'),
      gauche: { couleur: '#EFEAE2', ouvertures: [{ type: 'fenetre', position: 0, largeur: 1.4, hauteur: 1.4, allege: .9 }] } },
    sol: { matiere: 'parquet', couleur: '#C9AE8A', ...(sol ? { revetement: sol } : {}) },
    plafond: { couleur: '#F6F4EF' }
  };
}

function Teintes({ coloris, choisi, choisir }) {
  return (
    <div className={s.teintes}>
      {coloris.map(c => (
        <button key={c.id} type="button" className={s.teinte} title={c.nom} aria-label={c.nom} aria-pressed={c.id === choisi}
          style={{ background: `linear-gradient(135deg, ${c.couleurs[0]} 55%, ${c.couleurs[1] || c.couleurs[0]} 55%)` }} onClick={() => choisir(c.id)} />
      ))}
    </div>
  );
}

export default function Collection() {
  const [C, setC] = useState(null);
  const [groupe, setGroupe] = useState('assises');
  const [choix, setChoix] = useState({ id: 'canape-3-places', variante: null, coloris: null });
  const [mur, setMur] = useState({ id: '', coloris: null });
  const [sol, setSol] = useState({ id: '', coloris: null });
  useEffect(() => { import('@/moteur/collection/index.js').then(setC); }, []);

  const fiche = C?.ELEMENTS[choix.id];
  const variante = fiche && (fiche.variantes.find(v => v.id === choix.variante) || fiche.variantes[0]);
  const coloris = variante && (variante.coloris.find(c => c.id === choix.coloris) || variante.coloris[0]);
  const items = useMemo(() => {
    if (!fiche) return [];
    const p = C.produitCollection(fiche.id, { variante: variante.id, coloris: coloris.id });
    const mural = C.estMural(p.fam), contreMur = fiche.pose === 'mur' || fiche.pose === 'lineaire';
    const y = mural ? (fiche.pose === 'sol' ? 0 : 1.5) : HAUTEUR_POSE[fiche.id];
    const z = contreMur ? -P / 2 + (mural ? 0 : p.dim[1] / 2) : 0;
    return [{ id: 'objet', p, x: 0, z, rot: 0, ...(Number.isFinite(y) ? { y } : {}), ...(mural ? { mur: 'fond' } : {}) }];
  }, [C, fiche, variante, coloris]);
  const modele = useMemo(() => piece(mur.id ? mur : null, sol.id ? sol : null), [mur, sol]);

  if (!C) return <div className="attente"><p className="discret">Chargement de la collection…</p></div>;
  const g = C.GROUPES.find(x => x.id === groupe);
  const revMur = mur.id && C.REVETEMENTS[mur.id], revSol = sol.id && C.REVETEMENTS[sol.id];
  return (
    <div className={s.page}>
      <div className={s.scene}>
        <Editeur3D modele={modele} items={items} vue="dessus" />
        <p className={s.legende}>{fiche.nom} · {variante.nom} · {coloris.nom}</p>
      </div>
      <aside className={s.panneau}>
        <div>
          <h1>La collection</h1>
          <p className="discret">{Object.keys(C.ELEMENTS).length} meubles et éléments, {Object.keys(C.REVETEMENTS).length} revêtements. Choisissez un objet, son style et sa couleur.</p>
        </div>
        <div>
          <h2>Famille</h2>
          <div className="puces">
            {C.GROUPES.map(x => <button key={x.id} type="button" className="puce puce-bouton" aria-pressed={x.id === groupe} onClick={() => setGroupe(x.id)}>{x.nom}</button>)}
          </div>
        </div>
        <div>
          <h2>Objet</h2>
          <div className={s.liste}>
            {g.ids.map(id => <button key={id} type="button" className="puce puce-bouton" aria-pressed={id === choix.id} onClick={() => setChoix({ id, variante: null, coloris: null })}>{C.ELEMENTS[id].nom}</button>)}
          </div>
        </div>
        <div>
          <h2>Style</h2>
          <div className="puces">
            {fiche.variantes.map(v => <button key={v.id} type="button" className="puce puce-bouton" aria-pressed={v.id === variante.id} onClick={() => setChoix({ ...choix, variante: v.id })}>{v.nom}</button>)}
          </div>
        </div>
        <div>
          <h2>Couleur</h2>
          <Teintes coloris={variante.coloris} choisi={coloris.id} choisir={c => setChoix({ ...choix, coloris: c })} />
        </div>
        <div>
          <h2>Mur du fond</h2>
          <select className={s.select} value={mur.id} onChange={e => setMur({ id: e.target.value, coloris: null })}>
            <option value="">Peinture unie</option>
            {C.listeRevetements('mur').map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
          </select>
          {revMur && <><p className={s.discret}>{revMur.description}</p><Teintes coloris={revMur.coloris} choisi={mur.coloris || revMur.coloris[0].id} choisir={c => setMur({ ...mur, coloris: c })} /></>}
        </div>
        <div>
          <h2>Sol</h2>
          <select className={s.select} value={sol.id} onChange={e => setSol({ id: e.target.value, coloris: null })}>
            <option value="">Parquet actuel</option>
            {C.listeRevetements('sol').map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
          </select>
          {revSol && <><p className={s.discret}>{revSol.description}</p><Teintes coloris={revSol.coloris} choisi={sol.coloris || revSol.coloris[0].id} choisir={c => setSol({ ...sol, coloris: c })} /></>}
        </div>
      </aside>
    </div>
  );
}
