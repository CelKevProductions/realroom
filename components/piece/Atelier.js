'use client';
// L'atelier « plateau » : la pièce en 3D occupe tout l'écran, comme un configurateur. Le total du
// mobilier reste en haut à droite ; un dock en bas ouvre quatre chapitres (aménager, propositions,
// meubles, rendu) dans un panneau flottant posé sur la pièce. Repères numérotés sur les meubles.
// Choisir un meuble dans la liste : la caméra glisse jusqu'à lui et en fait le tour.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/components/api.js';
import Editeur3D, { chargerCatalogue } from '@/components/piece/Editeur3D.js';
import Catalogue from '@/components/piece/Catalogue.js';
import CameraPhoto from './CameraPhoto.js';
import {prixMobilier,nomCategorie,noteGeneriques} from '@/components/prixMobilier.js';
import Confort from '@/components/piece/Confort.js';
import PlanVie from '@/components/piece/PlanVie.js';
import BriefReamenagement from '@/components/piece/BriefReamenagement.js';
import Variantes from '@/components/piece/Variantes.js';
import Inspirations from '@/components/piece/Inspirations.js';
import Resultat from '@/components/piece/Resultat.js';
import Journal from '@/components/piece/Journal.js';
import Tuto from '@/components/Tuto.js';
import { apparaitre, deplier, animer } from '@/components/Mouvement.js';
import { prix, remplir } from '@/lib/i18n.js';
import { estMural, estSuspendu, estAdosse, placerAuMur, demiEmpreinte, resoudre, ANGLES } from '@/lib/agencement.js';
import { deplacerAvecAttaches } from '@/lib/finition.js';
import { referencesSpatialesActives } from '@/lib/ameublement-reference.js';
import { TYPES_PROGRAMME } from '@/lib/programme.js';
import { etatVariantes } from '@/lib/variation-disposition.js';
import { contourDe } from '@/lib/contour.js';
import { Rouage } from '@/components/mouvement/Attente.js';
import Toast from '@/components/mouvement/Toast.js';

const Icone = ({ d }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const I = {
  gauche: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5', droite: 'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5',
  echanger: 'M7 7h13l-3-3M17 17H4l3 3', retirer: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', garder: 'M5 13l4 4L19 7'
};
// chapitres du dock ; « propositions » s'affiche en bande en bas, les autres en panneau flottant
const ONGLETS = ['amenager', 'propositions', 'meubles', 'resultat'];
const m2 = (v, lang) => v.toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// zone dépliée sous la ligne choisie (s'ouvre une fois, à l'apparition)
function Depliant({ children }) {
  const ref = useRef(null);
  useLayoutEffect(() => { deplier(ref.current); }, []);
  return <div className="ligne-meuble__detail" ref={ref}>{children}</div>;
}

export default function Atelier({ lang, t, piece, setPiece, rendus, setRendus, solde, setSolde, couts, services, retourPhotos }) {
  const tp = t.piece;
  const assistantDisponible = TYPES_PROGRAMME.includes(piece.fonction);
  const [items, setItems] = useState(piece.agencement || []);
  const [selection, setSelection] = useState(null);
  const [cadre, setCadre] = useState(null);
  const [vue, setVue] = useState('dessus');
  const [onglet, setOnglet] = useState(() => (etatVariantes(piece, piece.agencement || []) ? 'propositions' : (piece.agencement || []).some(it => it.origine === 'catalogue') ? 'meubles' : 'amenager'));
  const [large, setLarge] = useState(false);
  const reperes = useRef(null);
  const [produits, setProduits] = useState(null);
  const [libelles, setLibelles] = useState({});
  const [cat, setCat] = useState({ ouvert: false, famille: '', remplace: null });
  const [opacite, setOpacite] = useState(0);
  const [attente, setAttente] = useState(false);
  const [brief, setBrief] = useState(null);
  const [espaces, setEspaces] = useState(piece.proposition?.espaces);
  const [placesRepas, setPlacesRepas] = useState(piece.proposition?.placesRepas);
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
  const surMouvement=useCallback(c=>{if(c)setOpacite(0);editeur.current?.deplacerCamera(c);},[]);

  useEffect(() => { chargerCatalogue().then(c => { setProduits(c.produits); setLibelles(c.libelles || {}); }); }, []);
  useEffect(() => { setItems(piece.agencement || []); }, [piece.agencement]);
  const dire = (texte, erreur) => { setToast({ texte, erreur, n: Date.now() }); };
  useEffect(() => { if (!toast) return; const h = setTimeout(() => setToast(null), 3800); return () => clearTimeout(h); }, [toast]);

  // changement de chapitre : le panneau glisse en place ; sur grand écran la pièce se range à côté
  useEffect(() => {
    if (premierOnglet.current) { premierOnglet.current = false; return; }
    const corps = panneau.current && panneau.current.querySelector('.panneau__corps');
    if (corps) corps.scrollTop = 0;
    if (panneau.current) apparaitre(panneau.current, { enfants: false, x: -14, y: 0 });
  }, [onglet]);
  useEffect(() => {
    const mq = matchMedia('(min-width: 900px)');
    const maj = () => setLarge(mq.matches);
    maj(); mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);
  const avecPanneau = !!onglet && onglet !== 'propositions';
  useEffect(() => { editeur.current?.decalage(large && avecPanneau && vue === 'dessus' ? .15 : 0, 0); }, [large, avecPanneau, vue]);

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
  // repères numérotés : ils suivent les meubles à l'écran tant que le chapitre Meubles est ouvert
  useEffect(() => {
    if (onglet !== 'meubles' || vue !== 'dessus') return;
    let raf, tour = 0;
    const suivre = () => {
      if (tour++ % 2 === 0 && reperes.current && editeur.current) {
        for (const el of reperes.current.children) {
          const p = editeur.current.projeter(el.dataset.id);
          if (!p) { el.style.display = 'none'; continue; }
          el.style.display = p.visible ? '' : 'none';
          el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -130%)`;
        }
      }
      raf = requestAnimationFrame(suivre);
    };
    suivre();
    return () => cancelAnimationFrame(raf);
  }, [onglet, vue]);
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
    modifier(l => deplacerAvecAttaches(piece.modele, l, produits, d));
  }
  function tourner(delta) {
    const r = editeur.current && editeur.current.tourner(selection, delta);
    if (r) modifier(l => deplacerAvecAttaches(piece.modele, l, produits, r));
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
  function ouvrirBrief(methode = 'assistant') {
    setBrief({ mode, envies, budget: +budget || 0, garder: [...garder], aRemplacer: [...aRemplacer], espaces, placesRepas, langue: lang, methode });
  }
  function erreurAssistant(e) {
    const fr = lang !== 'en';
    const messages = {
      'assistant-obsolete': fr ? 'La pièce a changé. Relance l’assistant pour créer de nouvelles propositions.' : 'The room has changed. Restart the assistant.',
      'assistant-disposition': fr ? 'Aucune disposition suffisamment sûre n’a été trouvée. Ton aménagement actuel est conservé.' : 'No suitable layout was found. Your current room is preserved.',
      'assistant-budget': fr ? 'Le mobilier conservé dépasse le budget. Ajuste le budget ou les meubles à garder.' : 'Kept furniture exceeds the budget. Adjust the budget or kept items.',
      'assistant-conservation': fr ? 'Cette proposition déplacerait un meuble conservé. Ton aménagement actuel est conservé.' : 'This layout would move a kept item. Your current room is preserved.',
      'assistant-fonction': fr ? 'Pour cette fonction de pièce, utilise l’option de réaménagement avec l’IA.' : 'Use the AI redesign option for this room type.',
      'amenagement-conflit': fr ? 'Une autre modification a été enregistrée pendant le calcul. Recharge la pièce avant de réessayer.' : 'The room changed during the calculation. Reload before trying again.'
    };
    return messages[e?.erreur] || t.demo.erreurs[e?.erreur] || (e?.erreur === 'limite' ? t.connexion.erreurs.limite : t.erreurs.generique);
  }
  async function proposer(demande) {
    const assistant = demande.methode !== 'ia';
    if (inspirationOccupe || reamenagement.current || !assistant && !services.analyse) return;
    reamenagement.current = true;
    setBrief(null);
    setEnvies(demande.envies); setBudget(demande.budget); setEspaces(demande.espaces); setPlacesRepas(demande.placesRepas);
    setAttente(assistant ? 'assistant' : 'ia');
    try {
      await vider();
      const r = await api(`/api/pieces/${piece.id}/${assistant ? 'variantes' : 'amenager'}`, { method: 'POST', corps: {...demande, action:'generer', referencesSpatiales:referencesSpatialesActives(demande.referencesSpatiales)} });
      if (!r.ok) throw r;
      setPiece(r.piece);
      setGarder(new Set(r.piece.proposition?.garder || []));
      setSelection(null);
      aCadrer.current = null;
      setOnglet(assistant ? 'propositions' : 'meubles');
      dire(tp.reamenage);
      // la nouvelle pièce se dévoile : la caméra fait un lent quart de tour
      if (vue === 'dessus') editeur.current?.balayer();
    } catch (e) {
      dire(erreurAssistant(e), true);
    } finally {
      reamenagement.current = false;
      setAttente(false);
    }
  }
  async function changerVariante(id) {
    if (reamenagement.current) return;
    reamenagement.current = true; setAttente(true);
    try {
      await vider();
      const r = await api(`/api/pieces/${piece.id}/variantes`, { method:'POST', corps:{ action:id ? 'choisir' : 'shuffle', id, session:piece.proposition?.variantes?.session } });
      if (!r.ok) throw r;
      setPiece(r.piece); setSelection(null); aCadrer.current = null;
      if (r.assistant?.message === 'aucune-autre-variante') dire(lang === 'fr' ? 'Aucune autre disposition aussi complète n’a été trouvée. Tu peux conserver celle-ci ou ajuster le brief.' : 'No equally complete alternative was found. Keep this one or adjust your brief.');
      else { dire(lang === 'fr' ? 'Proposition affichée et enregistrée.' : 'Proposal displayed and saved.'); if (vue === 'dessus') editeur.current?.balayer(); }
    } catch (e) { dire(erreurAssistant(e), true); }
    finally { reamenagement.current = false; setAttente(false); }
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
  const numerotes = [...nouveaux, ...existants].filter(it => it.garde !== false && produitDe(it));
  const numero = id => String(numerotes.findIndex(it => it.id === id) + 1).padStart(2, '0');
  const variantes = etatVariantes(piece, items);
  const fr = lang !== 'en';
  const nomOnglet = o => (o === 'propositions' ? (fr ? 'Propositions' : 'Proposals') : o === 'resultat' ? (fr ? 'Rendu photo' : 'Photo render') : tp.panneau[o]);

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
            <b>{it.garde !== false && <span className="ligne-meuble__num">{numero(it.id)}</span>}{p.nom}</b>
            <small>{catalogue ? nomCategorie(p,lang) : it.garde === false ? tp.retire : tp.existant} <span className="chiffre">{cm(p.dim[0])}×{cm(p.dim[1])}</span></small>
          </span>
          <span className="prix">{catalogue ? prixMobilier(p,lang,tp.surDevis) : ''}</span>
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

  // ---------- les chapitres du plateau : contenu, puis action principale en pied ----------
  const amenager = (
    <>
      <div className="panneau__corps" role="tabpanel" inert={!!attente || undefined}>
        <Confort modele={piece.modele} items={items} produits={produits} lang={lang} onCorriger={corrigerPlan}
          programme={piece.proposition?.programme} planZones={piece.proposition?.planZones} staging={piece.proposition?.staging}
          mode={mode} envies={envies} garder={[...garder]} preferences={piece.proposition?.preferences}
          onAppliquer={piece.proposition?.encyclopedie ? liste=>modifier(()=>liste) : undefined} />
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
      <div className="panneau__pied">
        <button type="button" className="btn btn--plein btn--bloc" onClick={() => ouvrirBrief()} disabled={!!attente || inspirationOccupe || !assistantDisponible}>
          {fr ? 'Composer avec l’assistant' : 'Arrange with the assistant'}
        </button>
        <button type="button" className="btn btn--lien btn--petit" onClick={() => ouvrirBrief('ia')} disabled={!!attente || inspirationOccupe || !services.analyse}>{fr ? 'Réaménager avec l’IA et mes inspirations' : 'Redesign with AI and my inspirations'}</button>
        {!assistantDisponible && <p className="discret petit">{fr ? 'Pour une cuisine, une chambre d’enfant ou une pièce sans fonction précise, utilise le réaménagement avec l’IA.' : 'For a kitchen, children’s room or an unspecified room type, use AI redesign.'}</p>}
      </div>
    </>
  );

  const prop = piece.proposition;
  const meubles = (
    <>
      <div className="panneau__corps" role="tabpanel" inert={!!attente || undefined}>
        {prop && prop.concept && (
          <div className="concept">
            <b>{tp.concept}{prop.moteur?.type === 'ia' ? ' · ' + t.demo.ia : ''}</b>
            <p>{prop.concept}</p>
            <PlanVie proposition={prop} langue={lang} />
            {prop.conseils && prop.conseils.length > 0 && <><b className="concept__sous">{tp.conseils}</b><ul>{prop.conseils.map(c => <li key={c}>{c}</li>)}</ul></>}
            {prop.alertes && prop.alertes.length > 0 && <><b className="concept__sous">{tp.alertes}</b><ul>{prop.alertes.map(c => <li key={c}>{c}</li>)}</ul></>}
          </div>
        )}
        {nouveaux.length > 0 && (
          <section className="groupe">
            <h3 className="sous-titre">{tp.proposes} <span className="chiffre">{nouveaux.length}</span></h3>
            <div className="liste-meubles">{nouveaux.map(ligne)}</div>
            <div className="total"><span>{nouveaux.some(it=>produitDe(it)?.generique)?(lang==='fr'?'Total estimé':'Estimated total'):tp.total}</span><b>{prix(total * 100, lang)}</b></div>
            {nouveaux.some(it=>produitDe(it)?.generique)&&<p className="avis avis--note">{noteGeneriques(lang)}</p>}
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
        <button className="btn btn--plein btn--bloc" onClick={() => setOnglet('resultat')} disabled={!!attente}>{tp.versRendu}</button>
      </div>
    </>
  );

  const fermer = () => setOnglet(null);
  // surface réelle du contour (pièces en L comprises), formule du lacet
  const surface = Math.abs(contourDe(piece.modele).reduce((acc, q, i, ps) => { const r = ps[(i + 1) % ps.length]; return acc + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  return (
    <div className={'plateau' + (avecPanneau ? ' is-panneau' : '') + (onglet === 'propositions' ? ' is-film' : '')}>
      <div className="plateau__scene" inert={!!attente || undefined} aria-busy={!!attente}>
        <Editeur3D ref={editeur} modele={piece.modele} items={items} staging={piece.proposition?.staging} selection={selection} vue={vue} navigationActive={!attente&&!cat.ouvert&&onglet!=='resultat'} surNavigation={()=>setOpacite(0)}
          surSelection={surSelection} surDeplacement={surDeplacement} surCadre={setCadre} erreurWebgl={t.erreurs.webgl} />
        {vue === 'photo' && photo && <div className="calque-photo" style={{ backgroundImage: `url(${photo.url})`, opacity: opacite }} />}
        {onglet === 'meubles' && vue === 'dessus' && (
          <div className="reperes" ref={reperes}>
            {numerotes.map(it => (
              <button key={it.id} type="button" data-id={it.id} className={'repere' + (it.id === selection ? ' is-choisi' : '')} style={{ display: 'none' }}
                aria-label={(produitDe(it)?.nom || '') + ' ' + numero(it.id)} onClick={() => choisirLigne(it.id)}>{numero(it.id)}</button>
            ))}
          </div>
        )}
        {choisi && pChoisi && (
          <div ref={outils} className="outils-meuble" role="toolbar" aria-label={pChoisi.nom}>
            {!estMural(pChoisi.fam) && choisi.garde !== false && <><button title={tp.tourner} aria-label={tp.tourner} onClick={() => tourner(-Math.PI / 12)}><Icone d={I.gauche} /></button><button title={tp.tourner} aria-label={tp.tourner} onClick={() => tourner(Math.PI / 12)}><Icone d={I.droite} /></button></>}
            <button title={tp.echanger} aria-label={tp.echanger} onClick={() => echanger(choisi)}><Icone d={I.echanger} /></button>
            <button title={choisi.garde === false ? tp.garder : tp.supprimerMeuble} aria-label={choisi.garde === false ? tp.garder : tp.supprimerMeuble} onClick={() => retirer(choisi.id)}><Icone d={choisi.garde === false ? I.garder : I.retirer} /></button>
          </div>
        )}
      </div>

      {/* colonne de gauche : fiche de la pièce (comme l'étiquette d'un plan), caméra photo, chapitre ouvert */}
      <div className="plateau__gauche">
        <div className="plateau__fiche flottant">
          <p className="plateau__etiquette">[ {t.fonctions[piece.fonction] || piece.fonction} ]</p>
          <p className="plateau__nom">{piece.nom}</p>
          <p className="plateau__cotes chiffre">{m2(piece.modele.dims.largeur, lang)} × {m2(piece.modele.dims.profondeur, lang)} m · {m2(surface, lang)} m²</p>
          <div className="plateau__vues">
            <div className="segment" role="group">
              {['dessus', 'photo'].map(v => <button key={v} aria-pressed={vue === v} onClick={() => {setSelection(null);setVue(v);}}>{tp.vues[v]}</button>)}
            </div>
            {cadre && vue === 'dessus' && <button className="btn btn--clair btn--petit" onClick={() => { setSelection(null); editeur.current && editeur.current.ensemble(); }}>{tp.ensemble}</button>}
          </div>
        </div>
        {vue === 'photo' && <div className="camera-photo flottant"><CameraPhoto modele={piece.modele} lang={lang} surChoisir={surVue} surMouvement={surMouvement} disabled={!!attente||cat.ouvert||onglet==='resultat'}/><small>{fr?'Flèches : se déplacer · Glisser : regarder autour.':'Arrows: move · Drag: look around.'}</small></div>}
        {vue === 'photo' && photo && (
          <label className="opacite flottant">{tp.comparer}<input type="range" min="0" max="1" step=".05" value={opacite} onChange={e => setOpacite(+e.target.value)} /></label>
        )}

        {/* chapitre ouvert : panneau flottant */}
        {avecPanneau && (
          <aside className="plateau__panneau flottant" ref={panneau} aria-label={nomOnglet(onglet)}>
            <header className="plateau__panneau-tete">
              <span className="chiffre">{String(ONGLETS.indexOf(onglet) + 1).padStart(2, '0')}</span>
              <b>{nomOnglet(onglet)}</b>
              <button type="button" className="plateau__fermer" onClick={fermer} aria-label={fr ? 'Fermer le panneau' : 'Close panel'}><span aria-hidden="true">×</span></button>
            </header>
            {onglet === 'amenager' && amenager}
            {onglet === 'meubles' && meubles}
            {onglet === 'resultat' && (
              <Resultat lang={lang} t={t} piece={{ ...piece, agencement: items }} rendus={rendus} setRendus={setRendus} solde={solde} setSolde={setSolde} couts={couts} services={services}
                capturer={o => editeur.current && editeur.current.capture(o)} lireVue={lireVue} surVue={surVue} avant={vider} setPiece={setPiece} />
            )}
          </aside>
        )}
      </div>

      {/* total du mobilier, toujours visible (comme le prix d'un configurateur) */}
      <div className="plateau__total flottant">
        <p className="plateau__etiquette">[ {fr ? 'Mobilier proposé' : 'Proposed furniture'} ]</p>
        <p className="plateau__prix">{nouveaux.length ? prix(total * 100, lang) : '—'}{nouveaux.some(it => produitDe(it)?.generique) ? <small> ≈</small> : null}</p>
        <p className="plateau__compte">{nouveaux.length} {fr ? 'proposés' : 'proposed'} · {existants.filter(it => it.garde !== false).length} {fr ? 'conservés' : 'kept'}</p>
        <button type="button" className="btn btn--plein btn--petit" onClick={() => ouvrirBrief()} disabled={!!attente || inspirationOccupe || !assistantDisponible}>
          {attente === 'assistant' && <Rouage />}{attente === 'assistant' ? (fr ? 'Composition…' : 'Arranging…') : (fr ? 'Composer avec l’assistant' : 'Arrange with the assistant')}
        </button>
      </div>


      {/* propositions de l'assistant et Shuffle : en bande, comme les variantes d'un configurateur */}
      {onglet === 'propositions' && !attente && (
        <div className="plateau__film">
          {variantes ? <Variantes piece={piece} items={items} produits={produits} demande={{mode,envies,budget,garder:[...garder],aRemplacer:[...aRemplacer],espaces,placesRepas}} lang={lang} attente={!!attente} onShuffle={() => changerVariante()} onChoisir={changerVariante} onRelancer={() => ouvrirBrief()} />
            : <div className="plateau__vide">
              <p><b>{fr ? 'Pas encore de proposition.' : 'No proposal yet.'}</b> {fr ? 'L’assistant compose la pièce avec de vrais meubles ; Shuffle en propose d’autres dispositions.' : 'The assistant arranges the room with real furniture; Shuffle suggests other layouts.'}</p>
              <button type="button" className="btn btn--plein btn--petit" onClick={() => ouvrirBrief()} disabled={!assistantDisponible || inspirationOccupe}>{fr ? 'Composer avec l’assistant' : 'Arrange with the assistant'}</button>
            </div>}
        </div>
      )}

      {attente === 'assistant' || attente === 'ia' ? <Journal key={attente} lang={lang} ia={attente === 'ia'} /> : null}

      {/* dock : ajouter un meuble, les quatre chapitres, le guide */}
      <nav className="plateau__dock" aria-label={tp.ameublement}>
        <button type="button" className="plateau__rond plateau__ajout" onClick={() => ouvrirCatalogue('', null)} disabled={!produits || !!attente} title={tp.ajouterMeuble} aria-label={tp.ajouterMeuble}><span className="plus" aria-hidden="true" /></button>
        <div className="plateau__chapitres" role="group">
          {ONGLETS.map((o, i) => (
            <button key={o} type="button" aria-pressed={onglet === o} onClick={() => setOnglet(onglet === o ? null : o)} disabled={!!attente}>
              <span className="plateau__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="plateau__libelle">{nomOnglet(o)}</span>
            </button>
          ))}
        </div>
        <Tuto id="atelier" etapes={t.tuto.atelier} libelles={t.tuto} className="plateau__rond plateau__guide" />
      </nav>
      {!avecPanneau && onglet !== 'propositions' && !attente && <p className="plateau__aide">{tp.aide}</p>}

      {produits && <Catalogue lang={lang} t={t} produits={produits} libelles={libelles} dims={piece.modele.dims} exterieur={piece.fonction === 'terrasse'} famille={cat.famille} ouvert={cat.ouvert}
        fermer={() => setCat({ ouvert: false, famille: '', remplace: null })} choisir={choisirProduit} action={cat.remplace ? tp.catalogue.choisir : tp.catalogue.ajouter} />}
      {toast && <Toast key={toast.n} erreur={toast.erreur}>{toast.texte}</Toast>}
      {brief && <BriefReamenagement piece={piece} demande={brief} lang={lang} onFermer={() => setBrief(null)} onValider={proposer} />}
    </div>
  );
}
