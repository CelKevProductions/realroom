'use client';
// L'atelier : la maquette 3D de la pièce et son panneau en trois temps
// (1 aménager, 2 meubles, 3 résultat). Ajout et réaménagement restent accessibles en haut du panneau.
// Choisir un meuble dans la liste : la caméra glisse jusqu'à lui et en fait le tour.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/components/api.js';
import Editeur3D, { chargerCatalogue } from '@/components/piece/Editeur3D.js';
import Catalogue from '@/components/piece/Catalogue.js';
import CameraPhoto from './CameraPhoto.js';
import Confort from '@/components/piece/Confort.js';
import Inspirations from '@/components/piece/Inspirations.js';
import Resultat from '@/components/piece/Resultat.js';
import Tuto from '@/components/Tuto.js';
import { apparaitre, deplier, animer } from '@/components/Mouvement.js';
import { prix, remplir } from '@/lib/i18n.js';
import { estMural, estSuspendu, estAdosse, placerAuMur, demiEmpreinte, resoudre, ANGLES } from '@/lib/agencement.js';

const Icone = ({ d }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const I = {
  gauche: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5', droite: 'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5',
  echanger: 'M7 7h13l-3-3M17 17H4l3 3', retirer: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', garder: 'M5 13l4 4L19 7'
};
const ONGLETS = ['amenager', 'meubles', 'resultat'];

// zone dépliée sous la ligne choisie (s'ouvre une fois, à l'apparition)
function Depliant({ children }) {
  const ref = useRef(null);
  useLayoutEffect(() => { deplier(ref.current); }, []);
  return <div className="ligne-meuble__detail" ref={ref}>{children}</div>;
}

export default function Atelier({ lang, t, piece, setPiece, rendus, setRendus, solde, setSolde, couts, services, retourPhotos }) {
  const tp = t.piece;
  const [items, setItems] = useState(piece.agencement || []);
  const [selection, setSelection] = useState(null);
  const [cadre, setCadre] = useState(null);
  const [vue, setVue] = useState('dessus');
  const [onglet, setOnglet] = useState((piece.agencement || []).some(it => it.origine === 'catalogue') ? 'meubles' : 'amenager');
  const [produits, setProduits] = useState(null);
  const [libelles, setLibelles] = useState({});
  const [cat, setCat] = useState({ ouvert: false, famille: '', remplace: null });
  const [opacite, setOpacite] = useState(0);
  const [attente, setAttente] = useState(false);
  const [inspirationOccupe, setInspirationOccupe] = useState(false);
  const [toast, setToast] = useState(null);
  const [mode, setMode] = useState((piece.proposition && piece.proposition.mode) || 'tout');
  const [envies, setEnvies] = useState((piece.proposition && piece.proposition.envies) || '');
  const [budget, setBudget] = useState((piece.proposition && piece.proposition.budget) || '');
  const [garder, setGarder] = useState(() => new Set(piece.proposition?.garder || []));
  const [aRemplacer, setARemplacer] = useState(() => new Set());
  const [dims, setDims] = useState(piece.modele.dims);
  const editeur = useRef(null);
  const outils = useRef(null);
  const panneau = useRef(null);
  const sauvegarde = useRef(null);
  const ecritures = useRef(Promise.resolve(true));
  const reamenagement = useRef(false);
  const aCadrer = useRef(null);
  const premierOnglet = useRef(true);
  const lireVue = useCallback(() => editeur.current?.pointDeVue(), []);
  const surVue = useCallback(v => { setSelection(null); setOpacite(0); editeur.current?.choisirVue(v); setVue('photo'); }, []);

  useEffect(() => { chargerCatalogue().then(c => { setProduits(c.produits); setLibelles(c.libelles || {}); }); }, []);
  useEffect(() => { setItems(piece.agencement || []); }, [piece.agencement]);
  const dire = (texte, erreur) => { setToast({ texte, erreur, n: Date.now() }); };
  useEffect(() => { if (!toast) return; const h = setTimeout(() => setToast(null), 3800); return () => clearTimeout(h); }, [toast]);

  // changement d'onglet : le contenu glisse en place, depuis le haut du panneau
  useEffect(() => {
    if (premierOnglet.current) { premierOnglet.current = false; return; }
    const corps = panneau.current && panneau.current.querySelector('.panneau__corps');
    if (!corps) return;
    corps.scrollTop = 0;
    apparaitre(corps, { y: 12 });
  }, [onglet]);

  // enregistrement différé des modifications faites à la main
  const ecrire = useCallback(liste => {
    const tache = ecritures.current.catch(() => false).then(async () => {
      const r = await api(`/api/pieces/${piece.id}`, { method: 'PATCH', corps: { agencement: liste } });
      if (!r.ok) dire(t.erreurs.generique, true);
      return r.ok;
    });
    ecritures.current = tache;
    return tache;
  }, [piece.id, t.erreurs.generique]);
  const enregistrer = useCallback(liste => {
    clearTimeout(sauvegarde.current);
    sauvegarde.current = setTimeout(() => { ecrire(liste).catch(() => dire(t.erreurs.generique, true)); }, 700);
  }, [ecrire, t.erreurs.generique]);
  const modifier = useCallback(f => {
    if (reamenagement.current) return;
    setItems(l => { const n = f(l); enregistrer(n); return n; });
  }, [enregistrer]);
  const vider = useCallback(async () => {
    clearTimeout(sauvegarde.current);
    if (!(await ecrire(items))) throw new Error('sauvegarde');
  }, [ecrire, items]);
  async function ouvrirPhotos() {
    clearTimeout(sauvegarde.current);
    const r = await api(`/api/pieces/${piece.id}`, { method: 'PATCH', corps: { agencement: items } });
    if (!r.ok) { dire(t.erreurs.generique, true); return; }
    setPiece(r.piece); retourPhotos();
  }

  // barre d'outils qui suit le meuble choisi à l'écran
  useEffect(() => {
    if (!selection) return;
    let raf;
    const suivre = () => {
      const p = editeur.current && editeur.current.projeter(selection);
      if (outils.current && p) { outils.current.style.left = p.x + 'px'; outils.current.style.top = p.y + 'px'; outils.current.style.display = p.visible ? '' : 'none'; }
      raf = requestAnimationFrame(suivre);
    };
    suivre();
    return () => cancelAnimationFrame(raf);
  }, [selection]);
  // la ligne du meuble choisi reste en vue dans le panneau
  useEffect(() => {
    if (!selection || onglet !== 'meubles' || !panneau.current) return;
    const l = panneau.current.querySelector(`[data-item="${selection}"]`);
    if (l) l.scrollIntoView({ block: 'nearest', behavior: animer() ? 'smooth' : 'auto' });
  }, [selection, onglet]);
  // meuble ajouté depuis le catalogue : la caméra va le montrer dès qu'il est dans la maquette
  useEffect(() => {
    if (aCadrer.current && editeur.current && editeur.current.cadrer(aCadrer.current)) aCadrer.current = null;
  }, [items]);

  const produitDe = it => (it.sku ? produits && produits[it.sku] : it.p);
  const choisi = items.find(it => it.id === selection);
  const pChoisi = choisi && produitDe(choisi);

  // choix dans la liste : cadrage et tour du meuble ; un second clic revient à la vue d'ensemble
  function choisirLigne(id) {
    if (selection === id) { setSelection(null); if (cadre) editeur.current && editeur.current.ensemble(); return; }
    setSelection(id);
    if (vue === 'dessus' && editeur.current) editeur.current.cadrer(id);
  }
  // choix dans la maquette : on reste où l'on est (le meuble peut être déplacé tout de suite)
  function surSelection(id) {
    setSelection(id);
    if (id) setOnglet('meubles');
    else if (cadre && editeur.current) editeur.current.ensemble();
  }
  function surDeplacement(d) {
    modifier(l => l.map(it => (it.id === d.id ? { ...it, x: d.x, z: d.z, rot: d.rot, ...(d.mur ? { mur: d.mur } : {}), ...(d.y != null ? { y: d.y } : {}) } : it)));
  }
  function tourner(delta) {
    const r = editeur.current && editeur.current.tourner(selection, delta);
    if (r) modifier(l => l.map(it => (it.id === r.id ? { ...it, rot: r.rot, x: r.x, z: r.z } : it)));
  }
  function basculerGarde(id) {
    modifier(l => l.map(it => (it.id === id ? { ...it, garde: it.garde === false ? true : false } : it)));
  }
  function retirer(id) {
    const it = items.find(x => x.id === id);
    if (!it) return;
    if (cadre === id && it.garde !== false && editeur.current) editeur.current.ensemble();
    if (it.origine === 'existant') basculerGarde(id);
    else { modifier(l => l.filter(x => x.id !== id)); setSelection(null); }
  }
  const ouvrirCatalogue = (famille, remplace) => setCat({ ouvert: true, famille: famille || '', remplace: remplace || null });
  const echanger = it => {
    const p = produitDe(it);
    ouvrirCatalogue(p && produits && Object.values(produits).some(x => x.fam === p.fam) ? p.fam : '', it.id);
  };
  // ajout ou échange depuis le catalogue : le nouveau meuble prend la place (et le rôle) de l'ancien
  function choisirProduit(p) {
    const { largeur: L, profondeur: P } = piece.modele.dims;
    const ancien = cat.remplace && items.find(x => x.id === cat.remplace);
    const id = 'c' + Date.now().toString(36);
    // point de départ : la place de l'ancien meuble, sinon contre le mur du fond (meubles adossés),
    // dans un coin (lampadaires, plantes, sculptures) ou au centre
    const [hx0, hz0] = demiEmpreinte(p.dim, ANGLES.entree);
    const coin = ['lampadaire', 'lampe', 'sculpture', 'jardiniere', 'plante'].includes(p.fam);
    let it = { id, origine: 'catalogue', sku: p.id, rot: ancien ? ancien.rot : ANGLES.entree,
      x: ancien ? ancien.x : coin ? L / 2 - hx0 - .1 : 0,
      z: ancien ? ancien.z : estAdosse(p.fam) || coin ? -P / 2 + hz0 + .02 : 0 };
    if (estMural(p.fam)) it = placerAuMur(piece.modele, { ...it, mur: ancien && ancien.mur ? ancien.mur : undefined, y: ancien && ancien.y ? ancien.y : 1.6 }, p.dim, ancien && ancien.mur ? ancien.mur : 'fond');
    else if (!estSuspendu(p.fam)) {
      const [hx, hz] = demiEmpreinte(p.dim, it.rot);
      it.x = Math.max(-L / 2 + hx, Math.min(L / 2 - hx, it.x));
      it.z = Math.max(-P / 2 + hz, Math.min(P / 2 - hz, it.z));
    }
    modifier(l => {
      let n = l;
      if (ancien) n = ancien.origine === 'existant' ? n.map(x => (x.id === ancien.id ? { ...x, garde: false } : x)) : n.filter(x => x.id !== ancien.id);
      // une place libre pour le nouveau meuble, les autres ne bougent pas
      const { items: places } = resoudre(piece.modele, [...n.map(x => ({ ...x, fixe: true })), it], produits);
      const place = places.find(x => x.id === id);
      if (!place) dire(tp.alertes + ' : ' + p.nom, true);
      return [...n, place ? { ...it, x: place.x, z: place.z, rot: place.rot, ...(place.mur ? { mur: place.mur, y: place.y } : {}) } : it];
    });
    setCat({ ouvert: false, famille: '', remplace: null });
    setSelection(id);
    setOnglet('meubles');
    if (vue === 'dessus') aCadrer.current = id;
  }
  async function proposer() {
    if (inspirationOccupe || reamenagement.current || !services.analyse) return;
    reamenagement.current = true;
    setAttente(true);
    setOnglet('meubles');
    try {
      await vider();
      const r = await api(`/api/pieces/${piece.id}/amenager`, { method: 'POST', corps: { mode, envies, budget: +budget || 0, garder: [...garder], aRemplacer: [...aRemplacer], langue: lang } });
      if (!r.ok) throw r;
      setPiece(r.piece);
      setSelection(null);
      aCadrer.current = null;
      dire(tp.reamenage);
      // la nouvelle pièce se dévoile : la caméra fait un lent quart de tour
      if (vue === 'dessus') editeur.current?.balayer();
    } catch (e) {
      dire(e?.erreur === 'limite' ? t.connexion.erreurs.limite : t.erreurs.generique, true);
    } finally {
      reamenagement.current = false;
      setAttente(false);
    }
  }
  async function appliquerDims() {
    const r = await api(`/api/pieces/${piece.id}`, { method: 'PATCH', corps: { dims } });
    if (r.ok) setPiece(r.piece); else dire(t.erreurs.generique, true);
  }
  async function corrigerPlan(geometrie) {
    clearTimeout(sauvegarde.current);
    const r = await api(`/api/pieces/${piece.id}`, { method: 'PATCH', corps: { geometrie, agencement: items } });
    if (!r.ok) return false;
    setPiece(r.piece); setDims(r.piece.modele.dims); setSelection(null);
    return true;
  }

  const existants = items.filter(it => it.origine === 'existant');
  const nouveaux = items.filter(it => it.origine === 'catalogue');
  const total = useMemo(() => nouveaux.reduce((s, it) => { const p = produitDe(it); return s + (p && p.prix > 0 ? p.prix : 0); }, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nouveaux, produits]);
  const photo = (piece.photos || []).find(p => p.role === 'entree');
  const cm = v => Math.round(v * 100);
  const suggestions = tp.suggestions[piece.fonction] || tp.suggestions.autre;

  const ligne = it => {
    const p = produitDe(it);
    if (!p) return null;
    const actif = it.id === selection;
    const catalogue = it.origine === 'catalogue';
    return (
      <div key={it.id} className={'ligne-meuble' + (it.garde === false ? ' is-retire' : '') + (actif ? ' is-choisi' : '')} data-item={it.id}>
        <button className="ligne-meuble__bouton" aria-current={actif} aria-expanded={actif} onClick={() => choisirLigne(it.id)}>
          {catalogue && p.vign ? <img src={p.vign} alt="" loading="lazy" /> : <span className="pastille" style={{ background: (p.cols && p.cols[0]) || undefined }} />}
          <span className="ligne-meuble__texte">
            <b>{p.nom}</b>
            <small>{catalogue ? p.cat : it.garde === false ? tp.retire : tp.existant} <span className="chiffre">{cm(p.dim[0])}×{cm(p.dim[1])}</span></small>
          </span>
          <span className="prix">{catalogue ? (p.prix > 0 ? prix(p.prix * 100, lang) : tp.surDevis) : ''}</span>
        </button>
        {actif && (
          <Depliant>
            {it.raison && <p>{it.raison}</p>}
            {catalogue && p.titre && <p>{p.titre}</p>}
            <p className="ligne-meuble__cotes">{remplir(tp.catalogue.dims, { l: cm(p.dim[0]), p: cm(p.dim[1]), h: cm(p.dim[2]) })}</p>
            <div className="ligne-meuble__actions">
              <button className="btn btn--clair btn--petit" onClick={() => echanger(it)} disabled={!produits}>{tp.echanger}</button>
              <button className="btn btn--clair btn--petit" onClick={() => retirer(it.id)}>{it.garde === false ? tp.garder : tp.supprimerMeuble}</button>
              {catalogue && p.url && <a className="btn btn--plein btn--petit" href={p.url} target="_blank" rel="noopener">{tp.acheter}</a>}
            </div>
          </Depliant>
        )}
      </div>
    );
  };

  // ---------- les trois temps du panneau : contenu, puis action principale en pied ----------
  const amenager = (
    <>
      <div className="panneau__corps" role="tabpanel" inert={attente || undefined}>
        <Confort modele={piece.modele} items={items} produits={produits} lang={lang} onCorriger={corrigerPlan} />
        <fieldset className="champ champ--groupe">
          <legend>{tp.modeTitre}</legend>
          <div className="choix-fonction choix-fonction--liste">
            {['tout', 'partiel'].map(m => (
              <label key={m}><input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} /><b>{tp.modes[m][0]}</b><small>{tp.modes[m][1]}</small></label>
            ))}
          </div>
        </fieldset>
        {existants.length > 0 && (
          <fieldset className="champ champ--groupe">
            <legend>{mode === 'tout' ? tp.aGarder : tp.aRemplacerTitre}</legend>
            <div className="coches">
              {existants.map(it => (
                <label key={it.id} className="coche">
                  <input type="checkbox" checked={mode === 'tout' ? garder.has(it.id) : aRemplacer.has(it.id)}
                    onChange={e => (mode === 'tout' ? setGarder : setARemplacer)(s => { const n = new Set(s); if (e.target.checked) n.add(it.id); else n.delete(it.id); return n; })} />
                  {it.p.nom}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="champ">
          <label className="champ"><span>{tp.envies}</span>
            <textarea className="saisie" value={envies} placeholder={tp.enviesAide} maxLength={1200} onChange={e => setEnvies(e.target.value)} />
          </label>
          <div className="puces">
            {suggestions.map(s => <button key={s} type="button" className="puce puce-bouton" onClick={() => setEnvies(v => (v ? v.replace(/[.\s]*$/, '') + ', ' : '') + s.toLowerCase())}>+ {s}</button>)}
          </div>
        </div>
        <label className="champ"><span>{tp.budget}</span>
          <span className="unite" data-unite="€"><input className="saisie" inputMode="numeric" value={budget} onChange={e => setBudget(e.target.value.replace(/\D/g, ''))} /></span>
        </label>
        <Inspirations piece={piece} setPiece={setPiece} lang={lang} demo={services.simulation} onOccupe={setInspirationOccupe} />
        <details className="corriger">
          <summary>{tp.corriger}</summary>
          <div className="corriger__corps">
            <div className="mesures mesures--serre">
              {['largeur', 'profondeur', 'hauteur'].map(k => (
                <label key={k} className="champ"><span>{tp[k].split(' (')[0]}</span>
                  <span className="unite" data-unite="m"><input className="saisie" inputMode="decimal" value={dims[k]} onChange={e => setDims(d => ({ ...d, [k]: e.target.value.replace(',', '.') }))} /></span>
                </label>
              ))}
            </div>
            <div className="rangee">
              <button className="btn btn--clair btn--petit" onClick={appliquerDims}>{tp.appliquer}</button>
              <button className="btn btn--lien btn--petit" onClick={ouvrirPhotos}>{tp.relancer}</button>
            </div>
          </div>
        </details>
      </div>
    </>
  );

  const prop = piece.proposition;
  const meubles = (
    <>
      <div className="panneau__corps" role="tabpanel" inert={attente || undefined}>
        {prop && prop.concept && (
          <div className="concept">
            <b>{tp.concept}</b>
            <p>{prop.concept}</p>
            {prop.conseils && prop.conseils.length > 0 && <><b className="concept__sous">{tp.conseils}</b><ul>{prop.conseils.map(c => <li key={c}>{c}</li>)}</ul></>}
            {prop.alertes && prop.alertes.length > 0 && <><b className="concept__sous">{tp.alertes}</b><ul>{prop.alertes.map(c => <li key={c}>{c}</li>)}</ul></>}
          </div>
        )}
        {nouveaux.length > 0 && (
          <section className="groupe">
            <h3 className="sous-titre">{tp.proposes} <span className="chiffre">{nouveaux.length}</span></h3>
            <div className="liste-meubles">{nouveaux.map(ligne)}</div>
            <div className="total"><span>{tp.total}</span><b>{prix(total * 100, lang)}</b></div>
          </section>
        )}
        {existants.length > 0 && (
          <section className="groupe">
            <h3 className="sous-titre">{tp.garderTitre} <span className="chiffre">{existants.length}</span></h3>
            <div className="liste-meubles">{existants.map(ligne)}</div>
          </section>
        )}
      </div>
      <div className="panneau__pied">
        {/* l'étape suivante, dite clairement : la photo réaliste par IA */}
        <button className="btn btn--plein btn--bloc" onClick={() => setOnglet('resultat')} disabled={attente}>{tp.versRendu}</button>
      </div>
    </>
  );

  return (
    <div className="atelier">
      <div className="atelier__scene" inert={attente || undefined} aria-busy={attente}>
        <Editeur3D ref={editeur} modele={piece.modele} items={items} selection={selection} vue={vue}
          surSelection={surSelection} surDeplacement={surDeplacement} surCadre={setCadre} erreurWebgl={t.erreurs.webgl} />
        {vue === 'photo' && photo && <div className="calque-photo" style={{ backgroundImage: `url(${photo.url})`, opacity: opacite }} />}
        <div className="vues">
          <div className="segment" role="group">
            {['dessus', 'photo'].map(v => <button key={v} aria-pressed={vue === v} onClick={() => {setSelection(null);setVue(v);}}>{tp.vues[v]}</button>)}
          </div>
          {cadre && vue === 'dessus' && <button className="btn btn--clair btn--petit" onClick={() => { setSelection(null); editeur.current && editeur.current.ensemble(); }}>{tp.ensemble}</button>}
        </div>
        {vue === 'photo' && <div className="camera-photo"><CameraPhoto modele={piece.modele} lang={lang} surChoisir={surVue}/><small>{lang==='fr'?'Glissez sur la pièce pour regarder autour.':'Drag on the room to look around.'}</small></div>}
        {vue === 'photo' && photo && (
          <label className="opacite">{tp.comparer}<input type="range" min="0" max="1" step=".05" value={opacite} onChange={e => setOpacite(+e.target.value)} /></label>
        )}
        {choisi && pChoisi && (
          <div ref={outils} className="outils-meuble" role="toolbar" aria-label={pChoisi.nom}>
            {!estMural(pChoisi.fam) && choisi.garde !== false && <><button title={tp.tourner} aria-label={tp.tourner} onClick={() => tourner(-Math.PI / 12)}><Icone d={I.gauche} /></button><button title={tp.tourner} aria-label={tp.tourner} onClick={() => tourner(Math.PI / 12)}><Icone d={I.droite} /></button></>}
            <button title={tp.echanger} aria-label={tp.echanger} onClick={() => echanger(choisi)}><Icone d={I.echanger} /></button>
            <button title={choisi.garde === false ? tp.garder : tp.supprimerMeuble} aria-label={choisi.garde === false ? tp.garder : tp.supprimerMeuble} onClick={() => retirer(choisi.id)}><Icone d={choisi.garde === false ? I.garder : I.retirer} /></button>
          </div>
        )}
        <p className="aide-scene">{tp.aide}</p>
        {/* guide de l'atelier : s'ouvre seul à la première visite ; le bouton le rouvre */}
        <div className="guide-scene"><Tuto id="atelier" etapes={t.tuto.atelier} libelles={t.tuto} className="btn btn--clair btn--petit" /></div>
      </div>

      <aside className="atelier__panneau" ref={panneau}>
        <div className="atelier__actions" role="group" aria-label={tp.ameublement}>
          <button type="button" className="btn btn--clair" onClick={() => ouvrirCatalogue('', null)} disabled={!produits || attente}>
            <span className="plus" aria-hidden="true" />{tp.ajouterMeuble}
          </button>
          <button type="button" className="btn btn--plein" onClick={proposer} disabled={attente || inspirationOccupe || !services.analyse} title={tp.reamenagerAide}>
            {attente && <span className="rouage rouage--petit" aria-hidden="true" />}{attente ? tp.proposition : tp.reamenager}
          </button>
          {attente && <p role="status">{tp.reamenagerAide}</p>}
        </div>
        <div className="onglets" role="tablist">
          {ONGLETS.map((o, i) => (
            <button key={o} role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)} disabled={attente}>
              <span className="onglets__num">{i + 1}</span>
              <span className="onglets__nom">{tp.panneau[o]}</span>
            </button>
          ))}
        </div>
        {onglet === 'amenager' && amenager}
        {onglet === 'meubles' && meubles}
        {onglet === 'resultat' && (
          <Resultat lang={lang} t={t} piece={{ ...piece, agencement: items }} rendus={rendus} setRendus={setRendus} solde={solde} setSolde={setSolde} couts={couts} services={services}
            capturer={o => editeur.current && editeur.current.capture(o)} lireVue={lireVue} surVue={surVue} avant={vider} setPiece={setPiece} />
        )}
      </aside>

      {produits && <Catalogue lang={lang} t={t} produits={produits} libelles={libelles} dims={piece.modele.dims} exterieur={piece.fonction === 'terrasse'} famille={cat.famille} ouvert={cat.ouvert}
        fermer={() => setCat({ ouvert: false, famille: '', remplace: null })} choisir={choisirProduit} action={cat.remplace ? tp.catalogue.choisir : tp.catalogue.ajouter} />}
      {toast && <div key={toast.n} className={'toast' + (toast.erreur ? ' toast--erreur' : '')} role="status">{toast.texte}</div>}
    </div>
  );
}
