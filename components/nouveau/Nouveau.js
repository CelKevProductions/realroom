'use client';
// Nouveau projet guidé, en plein écran : une question par écran, comme à l'inscription sur un
// logiciel. Le relevé (zip Lagarscan, JSON RoomPlan ou plan DXF) est lu dans le navigateur ; la pièce
// est créée dès qu'il est lu, puis les réponses rejoignent le parcours du projet (lib/parcours.js),
// comme celles de « Aménager mes pièces ». À la fin, la page d'attente lance la première proposition
// avec la même demande que le parcours (demandeProposition).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/api.js';
import { useRacine } from '@/components/chemins.js';
import { annoncer, boucle, entrer, focaliser, DUREES } from '@/components/mouvement/regles.js';
import { useIsoLayout } from '@/components/mouvement/react.js';
import Logo from '@/components/Logo.js';
import { reduireImage } from '@/components/piece/image.js';
import { scanExemple } from '@/components/demo/scan-exemple.js';
import { depuisScan, normaliserScan } from '@/lib/scan.js';
import { lireDXF, messageErreurDXF, APP_LAGARSOFT } from '@/lib/plans.js';
import { ESPACES_PAR_FONCTION } from '@/lib/espaces.js';
import { estInstallation } from '@/lib/usages.js';
import { etatVide, demandeProposition, PRIORITES, STYLES_GUIDES, FREQUENCES } from '@/lib/parcours.js';
import { prix, remplir } from '@/lib/i18n.js';
import { TEXTES } from './textes.js';
import { lireFichier, preparerReleve, resumePlan, nomCourt, regrouper } from './lecture.js';
import PlanVivant from './PlanVivant.js';
import { Picto, SceneStyle, PALETTES } from './Pictos.js';
import { entrerQuestion, sortirQuestion, tracerPlan } from './animations.js';
import Attente from './Attente.js';
import s from './Nouveau.module.css';

const ORDRE = ['accueil', 'nom', 'plan', 'compris', 'type', 'zones', 'meubles', 'foyer', 'priorites', 'style', 'inspirations', 'budget', 'recap'];
const CHAPITRE = { accueil: 0, nom: 0, plan: 1, compris: 1, type: 1, zones: 1, meubles: 1, foyer: 2, priorites: 2, style: 2, inspirations: 2, budget: 2, recap: 3 };
const TYPES = ['salon', 'chambre', 'salle_a_manger', 'bureau', 'salle_de_bain', 'entree', 'terrasse'];
const LETTRES = 'ABCDEFGHIJ';
const ICONE_PRIORITE = { circulation: 'circulation', rangement: 'rangements', recevoir: 'recevoir', calme: 'calme', lumiere: 'lumiere', enfants: 'enfants' };
const BUDGET = { min: 500, max: 15000, pas: 100, defaut: 3000, reperes: [1500, 3000, 5000, 8000] };
const UNITES = ['m', 'cm', 'mm', 'ft', 'in'];
const ETATS_MEUBLE = ['remplace', 'fixe', 'deplacable'];
const MAX_INSPIRATIONS = 3;
// la session en cours (pour reprendre où l'on en était), dans l'onglet seulement
const CLE = 'rr-nouveau-1';

// « *mot* » : le mot est surligné de pêche
const accent = str => String(str).split(/(\*[^*]+\*)/).filter(Boolean).map((m, i) => (m.startsWith('*') ? <em key={i}>{m.slice(1, -1)}</em> : m));
const sansEtoiles = str => String(str).replace(/\*/g, '');
const reponsesVides = () => ({
  fonction: 'salon', nomPiece: '', espaces: [], placesRepas: 4, meubles: {},
  foyer: { adultes: 2, enfants: 0, chien: false, chat: false, recevoir: 'parfois' },
  priorites: [], styles: [], styleLibre: '', avecBudget: false, budget: BUDGET.defaut, envies: ''
});
function lireSauvegarde(racine, projetId) {
  try {
    const v = JSON.parse(sessionStorage.getItem(CLE) || 'null');
    if (!v || v.racine !== racine || Date.now() - v.quand > 864e5 || !v.projet?.id || !ORDRE.includes(v.ecran) || v.ecran === 'accueil') return null;
    return projetId && v.projet.id !== projetId ? null : v;
  } catch (_) { return null; }
}
const oublierSauvegarde = () => { try { sessionStorage.removeItem(CLE); } catch (_) { /* stockage indisponible */ } };

export default function Nouveau({ lang, t, projetInitial = null }) {
  const x = TEXTES[lang === 'en' ? 'en' : 'fr'];
  const router = useRouter();
  const racine = useRacine(lang);
  const demo = racine.includes('/demo');
  const [ecran, setEcran] = useState('accueil');
  const [projet, setProjet] = useState(projetInitial);
  const [nom, setNom] = useState('');
  const [piece, setPiece] = useState(null);
  const [lu, setLu] = useState(null);             // ce que le relevé laisse deviner : { indices, origine, fichier }
  const [r, setR] = useState(reponsesVides);
  const [occupe, setOccupe] = useState('');
  const [erreur, setErreur] = useState('');
  const [dxf, setDxf] = useState(null);           // plan DXF en attente d'unités ou du choix de la pièce
  const [fichier, setFichier] = useState('');
  const [attente, setAttente] = useState(null);   // demande de la première proposition (page d'attente)
  const [depuisRecap, setDepuisRecap] = useState(false);
  const [reprise, setReprise] = useState(null);
  const [sauvegarde, setSauvegarde] = useState('');
  const [choisi, setChoisi] = useState(null);
  const sensRef = useRef(1);
  const parcours = useRef(null);                  // { etat, revision } enregistrés
  const planConfirme = useRef(false);
  const file = useRef(Promise.resolve());
  const rRef = useRef(r); rRef.current = r;
  const pieceRef = useRef(piece); pieceRef.current = piece;
  const projetRef = useRef(projet); projetRef.current = projet;
  const continuerRef = useRef(null);

  // réponses : mises à jour tout de suite dans la référence (un envoi qui suit les lit déjà)
  const poser = useCallback(f => {
    const v = { ...rRef.current, ...(typeof f === 'function' ? f(rRef.current) : f) };
    rRef.current = v; setR(v);
  }, []);
  const garderPiece = p => { pieceRef.current = p; setPiece(p); };

  const possibles = ESPACES_PAR_FONCTION[r.fonction] || [];
  // mêmes meubles, même ordre que les numéros du plan (PlanVivant)
  const existants = (piece?.agencement || []).filter(it => it.origine === 'existant' && !estInstallation(it));
  const ecrans = ORDRE.filter(e => !(e === 'nom' && projetInitial) && !(e === 'zones' && !possibles.length) && !(e === 'meubles' && piece && !existants.length));
  const k = Math.max(0, ecrans.indexOf(ecran));
  const ch = CHAPITRE[ecran];

  // ---------- enregistrement des réponses dans le parcours du projet (un envoi à la fois)
  function etatDepuis(etat) {
    const p = pieceRef.current, v = rRef.current, pid = p.id;
    const gardes = Object.entries(v.meubles).filter(([, e]) => e === 'fixe' || e === 'deplacable');
    const espaces = v.espaces.filter(e => (ESPACES_PAR_FONCTION[v.fonction] || []).includes(e));
    return {
      ...etat, etape: 'proposition', pieces: [...new Set([...(etat.pieces || []), pid])],
      usages: { ...etat.usages, [pid]: { espaces, ...(espaces.includes('repas') ? { placesRepas: v.placesRepas } : {}), envies: v.envies.trim(), confirme: true, budget: v.avecBudget ? v.budget : 0 } },
      valides: { ...etat.valides, ...(planConfirme.current ? { [pid]: p.version_scene || 0 } : {}) },
      choix: { ...etat.choix, [pid]: gardes.length ? 'certains' : 'tout' },
      selection: { ...etat.selection, [pid]: Object.fromEntries(gardes) },
      photosPassees: { ...etat.photosPassees, [pid]: true },
      preferences: { ...etat.preferences, styles: v.styles, foyer: v.foyer, priorites: v.priorites, confirme: true,
        style: [...v.styles.map(id => x.style.styles[id][0]), v.styleLibre.trim()].filter(Boolean).join(', ').slice(0, 120) }
    };
  }
  const enregistrer = useCallback(() => {
    file.current = file.current.then(async () => {
      const pc = parcours.current, pr = projetRef.current;
      if (!pc || !pieceRef.current || !pr) return { ok: false };
      setSauvegarde('encours');
      const url = `/api/projets/${pr.id}/parcours`;
      let res = await api(url, { method: 'PUT', corps: { etat: etatDepuis(pc.etat), revision: pc.revision } });
      // enregistré ailleurs entre-temps : on repart de cette version et on y remet nos réponses
      if (!res.ok && res.erreur === 'parcours-conflit') res = await api(url, { method: 'PUT', corps: { etat: etatDepuis(res.etat), revision: res.revision } });
      if (res.ok) { parcours.current = { etat: res.etat, revision: res.revision }; setSauvegarde('ok'); } else setSauvegarde('erreur');
      return res;
    }).catch(() => ({ ok: false }));
    return file.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function chargerParcours(id) {
    const res = await api(`/api/projets/${id}/parcours`);
    if (res.ok) parcours.current = { etat: res.etat, revision: res.revision };
    return res;
  }

  // ---------- arrivée : défilement de la page coupé, projet existant chargé, session à reprendre
  useEffect(() => {
    const html = document.documentElement, avant = html.style.overflow;
    html.style.overflow = 'hidden';
    if (projetInitial) chargerParcours(projetInitial.id);
    setReprise(lireSauvegarde(racine, projetInitial?.id));
    return () => { html.style.overflow = avant; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // la session avance : on la garde pour pouvoir la reprendre (onglet rechargé, scan à faire)
  useEffect(() => {
    if (!projet || ecran === 'accueil') return;
    try { sessionStorage.setItem(CLE, JSON.stringify({ racine, projet, pieceId: piece?.id || null, ecran, r, lu, quand: Date.now(), plan: planConfirme.current })); } catch (_) { /* stockage plein */ }
  }, [racine, projet, piece?.id, ecran, r, lu]);

  async function reprendre() {
    const v = reprise;
    setOccupe('reprise');
    const res = await chargerParcours(v.projet.id);
    setOccupe('');
    if (!res.ok) { oublierSauvegarde(); setReprise(null); return; }
    const p = v.pieceId ? res.pieces.find(q => q.id === v.pieceId) : null;
    setProjet(v.projet); projetRef.current = v.projet; setNom(v.projet.nom);
    if (p) garderPiece(p);
    planConfirme.current = !!v.plan;
    setLu(v.lu); poser({ ...reponsesVides(), ...v.r });
    setReprise(null);
    aller(p || ['accueil', 'nom'].includes(v.ecran) ? v.ecran : 'plan', 1);
  }
  function recommencer() { oublierSauvegarde(); setReprise(null); }

  // ---------- navigation
  function aller(cible, sens = 1) {
    sensRef.current = sens;
    setErreur(''); setDxf(null); setChoisi(null);
    setEcran(cible);
  }
  function messageErreur(e) {
    const code = e?.code || e?.erreur;
    if (code && /^plan-/.test(code)) return messageErreurDXF(code, lang);
    return x.plan.erreurs[code] || x.erreurs[code] || (ecran === 'plan' ? x.plan.erreurs.generique : x.erreurs.generique);
  }
  const peutContinuer = ecran === 'plan' ? !!piece?.modele : true;
  async function suivant() {
    if (occupe || !peutContinuer) return;
    setErreur('');
    setOccupe('suite');
    try {
      if (ecran === 'nom') await validerNom();
      else if (ecran === 'compris') await confirmerPlan();
      else if (ecran === 'type') await validerType();
      else if (ecran === 'meubles') await validerMeubles();
      else if (ecran === 'recap') { await lancer(); return; }
      else if (CHAPITRE[ecran] >= 1 && pieceRef.current) enregistrer();
    } catch (e) { setErreur(messageErreur(e)); annoncer(messageErreur(e)); return; }
    finally { setOccupe(''); }
    const cible = depuisRecap ? 'recap' : ecrans[k + 1];
    setDepuisRecap(false);
    aller(cible, 1);
  }
  continuerRef.current = suivant;
  function precedent() { if (k > 0 && !occupe) { setDepuisRecap(false); aller(ecrans[k - 1], -1); } }
  function modifierDepuisRecap(cible) { setDepuisRecap(true); aller(cible, -1); }
  function quitter() { router.push(projet ? `${racine}/projets/${projet.id}` : racine); }
  function ouvrir(url) { oublierSauvegarde(); router.push(url); }

  // ---------- 1. le projet
  async function validerNom() {
    const n = nom.trim() || x.nom.exemple;
    if (!projet) {
      const res = await api('/api/projets', { method: 'POST', corps: { nom: n } });
      if (!res.ok) throw res;
      const pr = { id: res.projet.id, nom: res.projet.nom };
      setProjet(pr); projetRef.current = pr;
      await chargerParcours(pr.id);
    } else if (n !== projet.nom) {
      const res = await api(`/api/projets/${projet.id}`, { method: 'PATCH', corps: { nom: n } });
      if (res.ok) setProjet(v => ({ ...v, nom: n }));
    }
  }

  // ---------- 2. le relevé : lu ici, la pièce créée et son plan enregistré aussitôt
  async function deposer(f) {
    if (!f || occupe) return;
    setErreur(''); setDxf(null); setFichier(f.name || ''); setOccupe('lecture');
    try {
      const l = await lireFichier(f);
      if (l.genre === 'dxf') await suiteDxf(l.texte, l.resultat, f.name);
      else await enregistrerReleve(preparerReleve(l.brut, 'scan'), f.name);
    } catch (e) { setErreur(messageErreur(e)); annoncer(messageErreur(e)); }
    finally { setOccupe(''); }
  }
  async function suiteDxf(texte, resultat, nomFichier) {
    if (!resultat.unites) { setDxf({ texte, fichier: nomFichier, pieces: null }); return; }
    if (resultat.pieces.length > 1) { setDxf({ texte, fichier: nomFichier, pieces: resultat.pieces }); return; }
    await enregistrerReleve(preparerReleve(resultat.pieces[0].scan, 'dxf'), nomFichier);
  }
  async function choisirDxf(f) {
    const d = dxf;
    setErreur(''); setOccupe('lecture');
    try { await f(d); } catch (e) { setErreur(messageErreur(e)); } finally { setOccupe(''); }
  }
  async function essayerExemple() {
    if (occupe) return;
    setErreur(''); setFichier('scan-exemple.json'); setOccupe('lecture');
    try { await enregistrerReleve(preparerReleve(scanExemple(), 'exemple'), 'scan-exemple.json'); }
    catch (e) { setErreur(messageErreur(e)); } finally { setOccupe(''); }
  }
  async function enregistrerReleve(rel, nomFichier) {
    setOccupe('enregistrement');
    let p = pieceRef.current;
    if (!p) {
      const c = await api(`/api/projets/${projetRef.current.id}/pieces`, { method: 'POST', corps: { nom: t.fonctions[rel.indices.fonction], fonction: rel.indices.fonction } });
      if (!c.ok) throw c;
      p = { id: c.piece.id, nom: c.piece.nom, fonction: c.piece.fonction, modele: null };
      garderPiece(p);
    }
    const sc = await api(`/api/pieces/${p.id}/scan`, { method: 'POST', corps: { scan: rel.scan, ...(p.modele ? { remplacer: true, revision: p.maj_le } : {}) } });
    if (!sc.ok) throw sc;
    garderPiece(sc.piece);
    planConfirme.current = false;
    setLu({ indices: rel.indices, origine: rel.origine, fichier: nomFichier });
    poser({ fonction: rel.indices.fonction, espaces: rel.indices.espaces, placesRepas: rel.indices.placesRepas || 4, meubles: {} });
    aller('compris', 1);
  }
  // sans scan : la pièce est créée et l'atelier prend le relais (photos et mesures)
  async function partirDesPhotos() {
    if (occupe) return;
    setOccupe('suite');
    try {
      let p = pieceRef.current;
      if (!p) {
        const c = await api(`/api/projets/${projetRef.current.id}/pieces`, { method: 'POST', corps: { nom: t.fonctions.salon, fonction: 'salon' } });
        if (!c.ok) throw c;
        p = c.piece;
      }
      ouvrir(`${racine}/pieces/${p.id}`);
    } catch (e) { setErreur(messageErreur(e)); setOccupe(''); }
  }

  // ---------- « Voilà ce que j'ai compris » : plan confirmé, ou cotes corrigées
  async function confirmerPlan() {
    const v = await api(`/api/projets/${projetRef.current.id}/parcours`, { method: 'POST', corps: { action: 'valider', piece: pieceRef.current.id } });
    if (!v.ok) throw v;
    const n = v.pieces.find(q => q.id === pieceRef.current.id);
    if (n) garderPiece(n);
    planConfirme.current = true;
    await enregistrer();
  }
  async function corrigerCotes(dims) {
    setOccupe('cotes'); setErreur('');
    const res = await api(`/api/pieces/${pieceRef.current.id}`, { method: 'PATCH', corps: { dims } });
    setOccupe('');
    if (!res.ok) { setErreur(messageErreur(res)); return false; }
    garderPiece(res.piece);
    return true;
  }

  // ---------- type de pièce, vos meubles
  async function validerType() {
    const p = pieceRef.current, v = rRef.current;
    const nomPiece = v.nomPiece.trim() || t.fonctions[v.fonction];
    if (v.fonction !== p.fonction || nomPiece !== p.nom) {
      const res = await api(`/api/pieces/${p.id}`, { method: 'PATCH', corps: { fonction: v.fonction, nom: nomPiece } });
      if (!res.ok) throw res;
      garderPiece(res.piece);
    }
    poser(w => ({ espaces: w.espaces.filter(e => (ESPACES_PAR_FONCTION[w.fonction] || []).includes(e)) }));
    enregistrer();
  }
  async function validerMeubles() {
    await enregistrer();
    const c = await api(`/api/projets/${projetRef.current.id}/parcours`, { method: 'POST', corps: { action: 'contraintes', piece: pieceRef.current.id } });
    if (!c.ok) throw c;
    const n = c.pieces.find(q => q.id === pieceRef.current.id);
    if (n) garderPiece(n);
  }
  const etatMeuble = id => r.meubles[id] || 'remplace';
  const poserMeuble = (id, v) => { setChoisi(id); poser(w => ({ meubles: { ...w.meubles, [id]: v } })); };
  const cyclerMeuble = id => poserMeuble(id, ETATS_MEUBLE[(ETATS_MEUBLE.indexOf(etatMeuble(id)) + 1) % ETATS_MEUBLE.length]);
  const toutPoser = v => poser({ meubles: v === 'remplace' ? {} : Object.fromEntries(existants.map(it => [it.id, v])) });

  // ---------- inspirations (photos de la pièce, rôle « inspiration »)
  const inspirations = (piece?.photos || []).filter(f => f.role === 'inspiration');
  async function ajouterInspirations(fichiers) {
    const liste = [...(fichiers || [])].slice(0, MAX_INSPIRATIONS - inspirations.length);
    if (!liste.length || occupe) return;
    setOccupe('image'); setErreur('');
    try {
      for (const f of liste) {
        const { blob, largeur, hauteur } = await reduireImage(f);
        const fd = new FormData();
        fd.append('photo', blob, 'inspiration.jpg'); fd.append('role', 'inspiration');
        fd.append('largeur', String(largeur)); fd.append('hauteur', String(hauteur));
        const res = await api(`/api/pieces/${pieceRef.current.id}/photos`, { method: 'POST', formulaire: fd });
        if (!res.ok) throw res;
        garderPiece({ ...pieceRef.current, photos: res.piece.photos, maj_le: res.piece.maj_le });
      }
    } catch (e) { setErreur(e?.erreur === 'limite-photos' ? x.erreurs['limite-photos'] : x.inspirations.erreur); }
    finally { setOccupe(''); }
  }
  async function retirerInspiration(url) {
    if (occupe) return;
    setOccupe('image');
    const res = await api(`/api/pieces/${pieceRef.current.id}/photos?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
    if (res.ok) garderPiece({ ...pieceRef.current, photos: res.piece.photos, maj_le: res.piece.maj_le });
    setOccupe('');
  }

  // ---------- première proposition
  async function demande() {
    const res = await enregistrer();
    const etat = res?.ok ? res.etat : etatDepuis(parcours.current?.etat || etatVide());
    return demandeProposition(etat, pieceRef.current, lang);
  }
  async function lancer() { setAttente(await demande()); }
  async function relancer(modif) {
    poser({ ...(modif.sansBudget ? { avecBudget: false } : {}), ...(modif.toutRemplacer ? { meubles: {} } : {}), ...(modif.sansCoins ? { espaces: [] } : {}) });
    if (modif.toutRemplacer) {
      await enregistrer();
      const c = await api(`/api/projets/${projetRef.current.id}/parcours`, { method: 'POST', corps: { action: 'contraintes', piece: pieceRef.current.id } });
      const n = c.ok && c.pieces.find(q => q.id === pieceRef.current.id);
      if (n) garderPiece(n);
    }
    return demande();
  }

  // ---------- clavier : Entrée pour continuer, une lettre pour choisir
  useEffect(() => {
    const touche = e => {
      if (attente || e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      const c = e.target, tag = c?.tagName;
      if (e.key === 'Enter' && !e.shiftKey) {
        if (['TEXTAREA', 'BUTTON', 'A', 'SELECT', 'SUMMARY'].includes(tag) || c?.type === 'file' || c?.closest?.('form, label')) return;
        e.preventDefault(); continuerRef.current?.();
        return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || !/^[a-j]$/i.test(e.key)) return;
      const b = document.querySelector(`[data-question] [data-touche="${e.key.toUpperCase()}"]`);
      if (b) { e.preventDefault(); b.click(); }
    };
    addEventListener('keydown', touche);
    return () => removeEventListener('keydown', touche);
  }, [attente]);

  const p = { x, t, lang, demo, r, poser, piece, lu, projet, nom, setNom, possibles, existants, occupe, erreur, dxf, fichier, inspirations, choisi,
    deposer, choisirDxf, suiteDxf, essayerExemple, partirDesPhotos, corrigerCotes, etatMeuble, poserMeuble, toutPoser, ajouterInspirations,
    retirerInspiration, modifierDepuisRecap, aller, ecrans, reprise, reprendre, recommencer, projetInitial };
  const ECRANS = { accueil: Accueil, nom: Nom, plan: Plan, compris: Compris, type: TypePiece, zones: Zones, meubles: Meubles, foyer: Foyer,
    priorites: Priorites, style: Style, inspirations: Inspirations, budget: Budget, recap: Recap };
  const Ecran = ECRANS[ecran];
  const mobile = ecran === 'plan' ? 'apres' : ['compris', 'meubles'].includes(ecran) ? 'avant' : 'cache';
  const libelle = ecran === 'accueil' ? x.accueil.bouton : ecran === 'compris' ? x.compris.oui : ecran === 'recap' ? x.recap.lancer : depuisRecap ? x.recap.depuis : x.continuer;
  const facultatif = ecran === 'inspirations' && !inspirations.length;

  return (
    <div className={s.cadre} data-chapitre={ch} role="dialog" aria-modal="true" aria-label={x.accueil.etiquette}>
      <span className={s.halo} aria-hidden="true" /><span className={s.halo} aria-hidden="true" />
      <header className={s.entete}>
        <span className={s.marque}><Logo taille={26} /><span>RealRoom</span>{demo && <small>{x.demo}</small>}</span>
        <ol className={s.chapitres} aria-label={remplir(x.position, { n: k + 1, t: ecrans.length })}>
          {x.chapitres.map((c, i) => {
            const dans = ecrans.filter(e => CHAPITRE[e] === i), pos = dans.indexOf(ecran);
            const part = i < ch ? 1 : i > ch ? 0 : (pos + 1) / dans.length;
            return (
              <li key={c} className={s.chapitre} data-etat={i < ch ? 'fait' : i === ch ? 'actif' : 'avenir'} aria-current={i === ch ? 'step' : undefined}>
                <span>{c}</span>
                <span className={s.piste}><span className={s.remplissage} style={{ '--p': part }} /></span>
              </li>
            );
          })}
        </ol>
        <button type="button" className={s.quitter} onClick={quitter}><Picto nom="fermer" />{x.quitter}</button>
      </header>

      <main className={s.corps}>
        <div className={s.question} data-question="">
          <Question key={ecran} sensRef={sensRef} focusSaisie={ecran === 'nom'}>
            <Ecran {...p} />
          </Question>
        </div>
        <aside className={s.apercu} data-mobile={mobile} aria-label={x.apercu.titre}>
          <Apercu {...p} ecran={ecran} cyclerMeuble={cyclerMeuble} />
        </aside>
      </main>

      <footer className={s.pied}>
        <div>
          {k > 0 && <button type="button" className="btn btn--lien" onClick={precedent} disabled={!!occupe}><Picto nom="retour" />{x.retour}</button>}
        </div>
        <div>
          {sauvegarde === 'erreur' && <span className={s.etat} role="status">{x.nonEnregistre}</span>}
          <span className={s.position}>{x.question} {k + 1} / {ecrans.length}</span>
          {facultatif && <button type="button" className="btn btn--lien" onClick={suivant} disabled={!!occupe}>{x.passer}</button>}
          <span className={s.entree} aria-hidden="true">{x.entree} <kbd>↵</kbd></span>
          <button type="button" className="btn btn--plein btn--large" onClick={suivant} disabled={!!occupe || !peutContinuer}
            data-eclat={ecran === 'recap' ? '' : undefined}>
            {ecran === 'recap' && <Picto nom="etincelle" />}{libelle}{ecran !== 'recap' && <Picto nom="suite" />}
          </button>
        </div>
      </footer>

      {attente && piece && (
        <Attente lang={lang} x={x} racine={racine} piece={piece} demande={attente} relancer={relancer} ouvrir={ouvrir}
          modifier={cible => { setAttente(null); aller(cible, -1); }} />
      )}
    </div>
  );
}

// Une question : elle entre par le bas (par le haut au retour), son titre prend le focus et est annoncé.
function Question({ sensRef, focusSaisie, children }) {
  const ref = useRef(null);
  useIsoLayout(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.parentElement.scrollTop = 0;
    const fin = entrerQuestion(el, sensRef.current);
    const titre = el.querySelector('[data-titre-etape]');
    const saisie = focusSaisie && el.querySelector('[data-focus]');
    if (saisie) saisie.focus({ preventScroll: true }); else focaliser(titre);
    if (titre) annoncer(titre.textContent);
    return () => { fin(); sortirQuestion(el, sensRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={ref} className={s.interieur}>{children}</div>;
}

// En-tête commun à chaque question : pastille du chapitre, grand titre, aide.
function Tete({ x, ecran, titre, aide, etiquette }) {
  return <>
    <p className={s.etiquette} data-q>{etiquette || x.chapitres[CHAPITRE[ecran]]}</p>
    <h1 className={s.titre} data-titre-etape="" tabIndex={-1}>{accent(titre)}</h1>
    {aide && <p className={s.aide} data-q>{aide}</p>}
  </>;
}

function Erreur({ erreur }) {
  return erreur ? <p className={s.erreur} role="alert" data-q>{erreur}</p> : null;
}

// Carte de choix (une option) : pictogramme, libellé, sous-titre, lettre du clavier, coche.
function Option({ i, choisi, onClick, icone, titre, texte, puce, desactive }) {
  return (
    <button type="button" className={s.option} aria-pressed={choisi} aria-disabled={desactive || undefined} data-touche={LETTRES[i]} data-presse="" onClick={onClick}>
      {icone && <span className={s.icone}><Picto nom={icone} /></span>}
      <span className={s.optionTitre}>{titre}</span>
      {texte && <span className={s.optionTexte}>{texte}</span>}
      {puce && <span className={s.optionPuce}>{puce}</span>}
      <span className={s.touche} aria-hidden="true">{LETTRES[i]}</span>
      <span className={s.coche} aria-hidden="true"><Picto nom="coche" /></span>
    </button>
  );
}

function Reglage({ valeur, min, max, pas = 1, surChanger, libelle, x }) {
  return (
    <span className={s.reglage}>
      <button type="button" className={s.rond} disabled={valeur <= min} onClick={() => surChanger(Math.max(min, valeur - pas))} aria-label={`${libelle} : ${x.foyer.moins}`}><Picto nom="moins" /></button>
      <output className={s.valeur} aria-live="polite" aria-label={libelle}>{valeur}</output>
      <button type="button" className={s.rond} disabled={valeur >= max} onClick={() => surChanger(Math.min(max, valeur + pas))} aria-label={`${libelle} : ${x.foyer.plus}`}><Picto nom="plus" /></button>
    </span>
  );
}

/* ---------- les écrans ---------- */

function Accueil({ x, projetInitial, reprise, reprendre, recommencer, occupe }) {
  return <>
    <Tete x={x} ecran="accueil" titre={x.accueil.titre} aide={x.accueil.texte}
      etiquette={projetInitial ? remplir(x.accueil.ajout, { nom: projetInitial.nom }) : x.accueil.etiquette} />
    {reprise && (
      <div className={s.reprise} data-q>
        <p><b>{x.reprise.titre}</b>{remplir(x.reprise.texte, { nom: reprise.projet.nom, n: ORDRE.indexOf(reprise.ecran) + 1, t: ORDRE.length })}</p>
        <button type="button" className="btn btn--plein btn--petit" onClick={reprendre} disabled={!!occupe}>{x.reprise.reprendre}</button>
        <button type="button" className="btn btn--lien btn--petit" onClick={recommencer}>{x.reprise.recommencer}</button>
      </div>
    )}
    <ol className={s.etapes} data-q>
      {x.accueil.etapes.map(([a, b]) => <li key={a}><b>{a}</b><span>{b}</span></li>)}
    </ol>
  </>;
}

function Nom({ x, nom, setNom, erreur }) {
  return <>
    <Tete x={x} ecran="nom" titre={x.nom.titre} aide={x.nom.aide} />
    <div data-q>
      <input className={s.saisieGrande} data-focus="" value={nom} placeholder={x.nom.exemple} maxLength={80} autoComplete="off"
        aria-label={sansEtoiles(x.nom.titre)} onChange={e => setNom(e.target.value)} />
    </div>
    <div className={s.suggestions} data-q>
      {x.nom.suggestions.map(n => <button key={n} type="button" className={s.puce} aria-pressed={nom === n} onClick={() => setNom(n)}>{n}</button>)}
    </div>
    <Erreur erreur={erreur} />
  </>;
}

function Plan({ x, demo, occupe, erreur, dxf, fichier, deposer, choisirDxf, suiteDxf, essayerExemple, partirDesPhotos, piece }) {
  const [survol, setSurvol] = useState(false);
  const lecture = occupe === 'lecture' || occupe === 'enregistrement';
  return <>
    <Tete x={x} ecran="plan" titre={x.plan.titre} aide={x.plan.aide} />
    <div data-q>
      <label className={s.depot} data-survol={survol || undefined} data-occupe={lecture || undefined}
        onDragOver={e => { e.preventDefault(); setSurvol(true); }} onDragLeave={() => setSurvol(false)}
        onDrop={e => { e.preventDefault(); setSurvol(false); deposer(e.dataTransfer?.files?.[0]); }}>
        <span className={s.depotIcone}><Picto nom={lecture ? 'zip' : 'depot'} /></span>
        {lecture ? <>
          <b className={s.depotTitre} role="status">{occupe === 'lecture' ? x.plan.lecture : x.compris.envoi}</b>
          <span className={s.formats}>{fichier}</span>
          <span className={s.barre} aria-hidden="true" />
        </> : <>
          <b className={s.depotTitre}>{piece?.modele ? x.plan.autre : x.plan.zone}</b>
          <span className={s.formats}>{x.plan.ou} <u>{x.plan.choisir}</u></span>
          <span className={s.formats}>{x.plan.formats}</span>
          <input type="file" accept=".zip,.json,.dxf,application/zip,application/json" disabled={!!occupe}
            onChange={e => { deposer(e.target.files?.[0]); e.target.value = ''; }} />
        </>}
      </label>
    </div>
    {dxf && !dxf.pieces && (
      <div className={s.choixDxf} data-q>
        <p>{x.plan.unites}</p>
        <div className={s.suggestions}>
          {UNITES.map(u => <button key={u} type="button" className={s.puce} disabled={!!occupe}
            onClick={() => choisirDxf(d => suiteDxf(d.texte, lireDXF(d.texte, u), d.fichier))}>{x.plan.unitesNoms[u]}</button>)}
        </div>
      </div>
    )}
    {dxf?.pieces && (
      <div className={s.choixDxf} data-q>
        <p>{x.plan.choisirPiece}</p>
        <div className={s.suggestions}>
          {dxf.pieces.map(pc => <button key={pc.id} type="button" className={s.puce} disabled={!!occupe}
            onClick={() => choisirDxf(d => suiteDxf(d.texte, { unites: 'm', pieces: [pc] }, d.fichier))}>{pc.nom} · {pc.surface} m²</button>)}
        </div>
      </div>
    )}
    <Erreur erreur={erreur} />
    {demo && (
      <div data-q>
        <button type="button" className={s.exemple} onClick={essayerExemple} disabled={!!occupe}>
          <span className={s.icone}><Picto nom="etincelle" /></span>
          <span><b>{x.plan.exemple}</b><span>{x.plan.exempleTexte}</span></span>
          <Picto nom="suite" />
        </button>
      </div>
    )}
    <div data-q>
      <button type="button" className={s.lienBouton} onClick={partirDesPhotos} disabled={!!occupe}><Picto nom="photo" />{x.plan.photos}</button>
    </div>
  </>;
}

function Compris({ x, lang, piece, lu, erreur, occupe, corrigerCotes, aller }) {
  const [corriger, setCorriger] = useState(false);
  const [cotes, setCotes] = useState(null);
  if (!piece?.modele) return null;
  const res = resumePlan(piece.modele, piece.agencement || []);
  const f = (v, d = 2) => v.toLocaleString(x.locale, { minimumFractionDigits: d, maximumFractionDigits: d });
  const pl = (n, mots) => `${n} ${mots[(lang === 'en' ? n !== 1 : n > 1) ? 1 : 0]}`;
  const nom = n => x.noms[n] || n;
  const groupes = regrouper(res.meubles), fixes = regrouper(res.installations);
  const indices = lu?.indices || {};
  const valeurs = cotes || { largeur: f(res.largeur), profondeur: f(res.profondeur), hauteur: f(res.hauteur) };
  async function appliquer(e) {
    e.preventDefault();
    const n = v => Number(String(v).replace(',', '.'));
    if (await corrigerCotes({ largeur: n(valeurs.largeur), profondeur: n(valeurs.profondeur), hauteur: n(valeurs.hauteur) })) { setCorriger(false); setCotes(null); }
  }
  return <>
    <Tete x={x} ecran="compris" titre={x.compris.titre} aide={x.compris.aide} />
    <div className={s.resume} data-q>
      <div className={s.chiffres}>
        <span className={s.grand}>{f(res.surface, 1)}<small>m²</small></span>
        <span className={s.cotes}><b>{f(res.largeur)} × {f(res.profondeur)} m</b><br />{f(res.hauteur)} m {x.compris.sousPlafond}{res.hauteurMesuree ? '' : ` (${x.compris.estimee})`}</span>
      </div>
      <span className={s.cotes}>{pl(res.portes, x.compris.portes)} · {pl(res.fenetres, x.compris.fenetres)}</span>
    </div>
    {indices.sections?.length > 0 && (
      <div className={s.groupe} data-q>
        <span>{x.compris.sections}</span>
        <div className={s.jetons}>{indices.sections.map(v => <span key={v} className={`${s.jeton} ${s['jeton--vu']}`}>{x.compris.sectionsNoms[v] || v}</span>)}</div>
      </div>
    )}
    <div className={s.groupe} data-q>
      <span>{x.compris.meubles}</span>
      {groupes.length
        ? <div className={s.jetons}>{groupes.map(g => <span key={g.nom} className={s.jeton}>{nom(g.nom)}{g.n > 1 && <i>× {g.n}</i>}</span>)}</div>
        : <p className={s.note}>{x.compris.aucunMeuble}</p>}
    </div>
    {fixes.length > 0 && (
      <div className={s.groupe} data-q>
        <span>{x.compris.installations}</span>
        <div className={s.jetons}>{fixes.map(g => <span key={g.nom} className={`${s.jeton} ${s['jeton--fixe']}`}>{nom(g.nom)}{g.n > 1 && <i>× {g.n}</i>}</span>)}</div>
      </div>
    )}
    {indices.pente && <p className={s.avertissement} data-q>{remplir(x.compris.pente, { bas: f(indices.pente.bas), haut: f(indices.pente.haut) })}</p>}
    {indices.incertains && <p className={s.avertissement} data-q>{x.compris.incertains}</p>}
    {lu?.origine === 'dxf' && <p className={s.avertissement} data-q>{x.compris.dxf}</p>}
    <Erreur erreur={erreur} />
    <div className={s.ligne} data-q>
      <button type="button" className="btn btn--clair btn--petit" aria-expanded={corriger} onClick={() => setCorriger(v => !v)}><Picto nom="crayon" />{x.compris.corriger}</button>
      <button type="button" className="btn btn--lien btn--petit" onClick={() => aller('plan', -1)}>{x.plan.autre}</button>
    </div>
    {corriger && (
      <form className={s.corriger} onSubmit={appliquer} data-q>
        <div className={s.trois}>
          {['largeur', 'profondeur', 'hauteur'].map(c => (
            <label key={c} className={s.champ}><span>{x.compris[c]} <small>(m)</small></span>
              <input className={s.saisie} inputMode="decimal" value={valeurs[c]} onChange={e => setCotes({ ...valeurs, [c]: e.target.value })} />
            </label>
          ))}
        </div>
        <div className={s.ligne}>
          <button type="submit" className="btn btn--plein btn--petit" disabled={!!occupe}>{x.compris.appliquer}</button>
          <button type="button" className="btn btn--lien btn--petit" onClick={() => { setCorriger(false); setCotes(null); }}>{x.compris.fermer}</button>
        </div>
      </form>
    )}
    <p className={s.note} data-q>{x.compris.editeur}</p>
  </>;
}

function TypePiece({ x, t, r, poser, lu }) {
  const devine = lu?.indices?.devine ? lu.indices.fonction : null;
  return <>
    <Tete x={x} ecran="type" titre={x.type.titre} aide={devine ? x.type.devineAide : x.type.aide} />
    <div className={s.options} data-q>
      {TYPES.map((f, i) => <Option key={f} i={i} choisi={r.fonction === f} onClick={() => poser({ fonction: f })} icone={f}
        titre={x.type.options[f][0]} texte={x.type.options[f][1]} puce={devine === f ? x.type.devine : null} />)}
    </div>
    <label className={s.champ} data-q>
      <span>{x.type.nomPiece} <small>· {x.type.nomAide}</small></span>
      <input className={s.saisie} value={r.nomPiece} maxLength={80} placeholder={t.fonctions[r.fonction]} onChange={e => poser({ nomPiece: e.target.value })} />
    </label>
  </>;
}

function Zones({ x, r, poser, possibles, lu }) {
  const vus = lu?.indices?.espacesVus || [];
  const basculer = z => poser(w => ({ espaces: w.espaces.includes(z) ? w.espaces.filter(e => e !== z) : [...w.espaces, z] }));
  return <>
    <Tete x={x} ecran="zones" titre={x.zones.titre} aide={x.zones.aide} />
    <div className={s.options} data-q>
      {possibles.map((z, i) => <Option key={z} i={i} choisi={r.espaces.includes(z)} onClick={() => basculer(z)} icone={z} titre={x.zones.options[z]} puce={vus.includes(z) ? x.zones.vu : null} />)}
    </div>
    {r.espaces.includes('repas') && (
      <div className={s.compteur} data-q>
        <span className={s.icone}><Picto nom="repas" /></span>
        <b>{x.zones.places}</b>
        <Reglage x={x} valeur={r.placesRepas} min={2} max={10} pas={2} libelle={x.zones.places} surChanger={v => poser({ placesRepas: v })} />
      </div>
    )}
  </>;
}

function Meubles({ x, existants, etatMeuble, poserMeuble, toutPoser, choisi, erreur }) {
  const liste = useRef(null);
  // un meuble touché sur le plan : sa ligne vient à l'écran
  useEffect(() => { liste.current?.querySelector('[data-choisi]')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }, [choisi]);
  const tous = v => existants.every(it => etatMeuble(it.id) === v);
  const f = v => v.toLocaleString(x.locale, { maximumFractionDigits: 2 });
  return <>
    <Tete x={x} ecran="meubles" titre={x.meubles.titre} aide={x.meubles.aide} />
    <div className={s.suggestions} data-q>
      <button type="button" className={s.puce} aria-pressed={tous('remplace')} onClick={() => toutPoser('remplace')}><Picto nom="remplacer" />{x.meubles.tout}</button>
      <button type="button" className={s.puce} aria-pressed={tous('fixe')} onClick={() => toutPoser('fixe')}><Picto nom="cadenas" />{x.meubles.garder}</button>
    </div>
    <ol className={s.listeMeubles} ref={liste} data-q>
      {existants.map((it, i) => {
        const e = etatMeuble(it.id), nom = x.noms[nomCourt(it)] || nomCourt(it);
        return (
          <li key={it.id} className={s.meuble} data-etat={e} data-choisi={choisi === it.id || undefined}>
            <span className={s.numero}>{i + 1}</span>
            <span><b>{nom}</b><small>{f(it.p.dim[0])} × {f(it.p.dim[1])} m</small></span>
            <span className={s.etats} role="group" aria-label={`${i + 1}. ${nom}`}>
              {ETATS_MEUBLE.map(v => <button key={v} type="button" data-v={v} aria-pressed={e === v} onClick={() => poserMeuble(it.id, v)}>{x.meubles.etats[v]}</button>)}
            </span>
          </li>
        );
      })}
    </ol>
    <Erreur erreur={erreur} />
    <p className={s.note} data-q>{x.meubles.note}</p>
  </>;
}

function Foyer({ x, r, poser }) {
  const f = r.foyer, maj = v => poser(w => ({ foyer: { ...w.foyer, ...v } }));
  return <>
    <Tete x={x} ecran="foyer" titre={x.foyer.titre} aide={x.foyer.aide} />
    <div className={s.compteurs} data-q>
      <div className={s.compteur}><span className={s.icone}><Picto nom="adulte" /></span><b>{x.foyer.adultes}</b>
        <Reglage x={x} valeur={f.adultes} min={1} max={8} libelle={x.foyer.adultes} surChanger={v => maj({ adultes: v })} /></div>
      <div className={s.compteur}><span className={s.icone}><Picto nom="enfant" /></span><b>{x.foyer.enfants}</b>
        <Reglage x={x} valeur={f.enfants} min={0} max={6} libelle={x.foyer.enfants} surChanger={v => maj({ enfants: v })} /></div>
    </div>
    <p className={s.sousTitre} data-q>{x.foyer.animaux}</p>
    <div className={s.suggestions} data-q>
      <button type="button" className={s.puce} aria-pressed={f.chien} onClick={() => maj({ chien: !f.chien })}><Picto nom="chien" />{x.foyer.chien}</button>
      <button type="button" className={s.puce} aria-pressed={f.chat} onClick={() => maj({ chat: !f.chat })}><Picto nom="chat" />{x.foyer.chat}</button>
    </div>
    <p className={s.sousTitre} data-q>{x.foyer.recevoir}</p>
    <div data-q>
      <div className={s.segments} role="group" aria-label={x.foyer.recevoir}>
        {FREQUENCES.map(q => <button key={q} type="button" aria-pressed={f.recevoir === q} onClick={() => maj({ recevoir: q })}>{x.foyer.frequences[q]}</button>)}
      </div>
    </div>
  </>;
}

function Priorites({ x, r, poser }) {
  const [refus, setRefus] = useState(false);
  const basculer = id => {
    if (!r.priorites.includes(id) && r.priorites.length >= 3) { setRefus(true); annoncer(x.priorites.max); return; }
    setRefus(false);
    poser(w => ({ priorites: w.priorites.includes(id) ? w.priorites.filter(v => v !== id) : [...w.priorites, id] }));
  };
  return <>
    <Tete x={x} ecran="priorites" titre={x.priorites.titre} aide={x.priorites.aide} />
    <div className={`${s.options} ${s['options--2']}`} data-q>
      {PRIORITES.map((id, i) => <Option key={id} i={i} choisi={r.priorites.includes(id)} desactive={!r.priorites.includes(id) && r.priorites.length >= 3}
        onClick={() => basculer(id)} icone={ICONE_PRIORITE[id]} titre={x.priorites.options[id][0]} texte={x.priorites.options[id][1]} />)}
    </div>
    <p className={s.compte} data-q aria-live="polite">{refus ? x.priorites.max : remplir(x.priorites.compte, { n: r.priorites.length })}</p>
  </>;
}

function Style({ x, r, poser }) {
  const [refus, setRefus] = useState(false);
  const basculer = id => {
    if (!r.styles.includes(id) && r.styles.length >= 2) { setRefus(true); annoncer(x.style.max); return; }
    setRefus(false);
    poser(w => ({ styles: w.styles.includes(id) ? w.styles.filter(v => v !== id) : [...w.styles, id] }));
  };
  return <>
    <Tete x={x} ecran="style" titre={x.style.titre} aide={x.style.aide} />
    <div className={s.styles} data-q>
      {STYLES_GUIDES.map((id, i) => (
        <button key={id} type="button" className={s.style} aria-pressed={r.styles.includes(id)} data-touche={LETTRES[i]} data-presse="" onClick={() => basculer(id)}>
          <SceneStyle id={id} className={s.vignette} />
          <b>{x.style.styles[id][0]}</b>
          <span className={s.styleTexte}>{x.style.styles[id][1]}</span>
          <span className={s.pastilles} aria-hidden="true">{PALETTES[id].map(c => <i key={c} style={{ background: c }} />)}</span>
          <span className={s.touche} aria-hidden="true">{LETTRES[i]}</span>
          <span className={s.coche} aria-hidden="true"><Picto nom="coche" /></span>
        </button>
      ))}
    </div>
    <p className={s.compte} data-q aria-live="polite">{refus ? x.style.max : remplir(x.style.compte, { n: r.styles.length })}</p>
    <label className={s.champ} data-q>
      <span>{x.style.libre}</span>
      <input className={s.saisie} value={r.styleLibre} maxLength={80} placeholder={x.style.libreExemple} onChange={e => poser({ styleLibre: e.target.value })} />
    </label>
  </>;
}

function Inspirations({ x, demo, inspirations, ajouterInspirations, retirerInspiration, occupe, erreur }) {
  return <>
    <Tete x={x} ecran="inspirations" titre={x.inspirations.titre} aide={x.inspirations.aide} />
    <div className={s.images} data-q>
      {inspirations.map(f => (
        <figure key={f.url} className={s.image}>
          <img src={f.url} alt="" />
          <button type="button" onClick={() => retirerInspiration(f.url)} disabled={!!occupe} aria-label={x.inspirations.retirer}><Picto nom="fermer" /></button>
        </figure>
      ))}
      {inspirations.length < MAX_INSPIRATIONS && (
        <label className={s.ajout}>
          <Picto nom={occupe === 'image' ? 'image' : 'plus'} />
          <span>{occupe === 'image' ? x.inspirations.envoi : x.inspirations.ajouter}</span>
          <input type="file" accept="image/*" multiple disabled={!!occupe} onChange={e => { ajouterInspirations(e.target.files); e.target.value = ''; }} />
        </label>
      )}
    </div>
    <p className={s.compte} data-q>{remplir(x.inspirations.compte, { n: inspirations.length })}{demo ? ` · ${x.inspirations.demo}` : ''}</p>
    <Erreur erreur={erreur} />
  </>;
}

function Budget({ x, lang, r, poser }) {
  const v = r.budget, part = ((v - BUDGET.min) / (BUDGET.max - BUDGET.min)) * 100;
  return <>
    <Tete x={x} ecran="budget" titre={x.budget.titre} aide={x.budget.aide} />
    <div data-q>
      <p className={s.montant} data-sans={!r.avecBudget || undefined} aria-live="polite"><small>{x.budget.jusqua}</small>{prix(v * 100, lang)}</p>
    </div>
    <div data-q>
      <input type="range" className={s.curseur} min={BUDGET.min} max={BUDGET.max} step={BUDGET.pas} value={v} style={{ '--p': part + '%' }}
        aria-label={sansEtoiles(x.budget.titre)} aria-valuetext={prix(v * 100, lang)} onChange={e => poser({ budget: +e.target.value, avecBudget: true })} />
      <div className={s.graduations} aria-hidden="true"><span>{prix(BUDGET.min * 100, lang)}</span><span>{prix(BUDGET.max * 100, lang)}</span></div>
    </div>
    <div className={s.suggestions} data-q>
      {BUDGET.reperes.map(b => <button key={b} type="button" className={s.puce} aria-pressed={r.avecBudget && v === b} onClick={() => poser({ budget: b, avecBudget: true })}>{prix(b * 100, lang)}</button>)}
      <button type="button" className={s.puce} aria-pressed={!r.avecBudget} onClick={() => poser({ avecBudget: false })}>{x.budget.sans}</button>
    </div>
  </>;
}

function Recap({ x, t, lang, r, poser, piece, existants, inspirations, ecrans, modifierDepuisRecap }) {
  const res = piece?.modele ? resumePlan(piece.modele, piece.agencement || []) : null;
  const pl = (n, mots) => `${n} ${mots[(lang === 'en' ? n !== 1 : n > 1) ? 1 : 0]}`;
  const gardes = existants.filter(it => r.meubles[it.id] && r.meubles[it.id] !== 'remplace').map(it => x.noms[nomCourt(it)] || nomCourt(it));
  const f = r.foyer;
  const lignes = [
    ['type', x.recap.lignes.piece, `${r.nomPiece.trim() || t.fonctions[r.fonction]}${res ? ` · ${res.surface.toLocaleString(x.locale, { maximumFractionDigits: 1 })} m²` : ''}`],
    ['zones', x.recap.lignes.zones, r.espaces.length ? r.espaces.map(z => x.zones.options[z]).join(', ') + (r.espaces.includes('repas') ? ` · ${remplir(x.recap.places, { n: r.placesRepas })}` : '') : x.zones.rien],
    ['meubles', x.recap.lignes.meubles, gardes.length ? gardes.join(', ') : x.recap.tout],
    ['foyer', x.recap.lignes.foyer, [pl(f.adultes, x.recap.adulte), f.enfants ? pl(f.enfants, x.recap.enfant) : '', f.chien ? x.foyer.chien : '', f.chat ? x.foyer.chat : '', x.foyer.frequences[f.recevoir]].filter(Boolean).join(' · ')],
    ['priorites', x.recap.lignes.priorites, r.priorites.length ? r.priorites.map(id => x.priorites.options[id][0]).join(', ') : x.recap.aucune],
    ['style', x.recap.lignes.style, [...r.styles.map(id => x.style.styles[id][0]), r.styleLibre.trim()].filter(Boolean).join(', ') || x.recap.aucun],
    ['inspirations', x.recap.lignes.inspirations, inspirations.length ? pl(inspirations.length, x.recap.image) : x.recap.aucune],
    ['budget', x.recap.lignes.budget, r.avecBudget ? `${x.budget.jusqua} ${prix(r.budget * 100, lang)}` : x.budget.sans]
  ].filter(([e]) => ecrans.includes(e));
  return <>
    <Tete x={x} ecran="recap" titre={x.recap.titre} aide={x.recap.aide} />
    <dl className={s.recap} data-q>
      {lignes.map(([e, dt, dd]) => (
        <div key={e}><dt>{dt}</dt><dd>{dd}</dd><button type="button" onClick={() => modifierDepuisRecap(e)}>{x.recap.modifier}</button></div>
      ))}
    </dl>
    <label className={s.champ} data-q>
      <span>{x.recap.envies}</span>
      <textarea className={s.saisie} rows={3} maxLength={600} value={r.envies} placeholder={x.recap.enviesExemple} onChange={e => poser({ envies: e.target.value })} />
    </label>
  </>;
}

/* ---------- l'aperçu (colonne de droite) ---------- */

function Apercu(p) {
  const { ecran } = p;
  const sorte = ecran === 'accueil' ? 'exemple' : ecran === 'plan' ? 'aide' : ['compris', 'meubles'].includes(ecran) && p.piece?.modele ? 'plan-' + ecran : 'fiche';
  return <Volet key={sorte}>
    {sorte === 'exemple' && <Exemple x={p.x} />}
    {sorte === 'aide' && <AideScan x={p.x} />}
    {sorte.startsWith('plan-') && <ScenePlan {...p} />}
    {sorte === 'fiche' && <Fiche {...p} />}
  </Volet>;
}

function Volet({ children }) {
  const ref = useRef(null);
  useIsoLayout(() => {
    const tw = entrer(ref.current, { y: 28, duree: DUREES.long, delai: .08 });
    return () => tw?.progress(1).kill();
  }, []);
  return <div ref={ref} style={{ display: 'grid', justifyItems: 'center', width: '100%' }}>{children}</div>;
}

// le séjour d'exemple se dessine en boucle : on voit ce que deviendra le relevé
function Exemple({ x }) {
  const ref = useRef(null);
  const exemple = useMemo(() => depuisScan(normaliserScan(scanExemple())), []);
  useEffect(() => {
    const svg = ref.current?.querySelector('svg');
    return boucle(svg, tl => tl.add(tracerPlan(svg)).to(svg, { opacity: 0, duration: .6 }, '+=2.6').set(svg, { opacity: 1 }));
  }, []);
  return (
    <figure className={s.scene} ref={ref} style={{ margin: 0 }}>
      <PlanVivant modele={exemple.modele} items={exemple.agencement} label={x.apercu.exemple} />
      <figcaption className={s.legende}>{x.apercu.exemple}</figcaption>
    </figure>
  );
}

function AideScan({ x }) {
  return (
    <section className={s.carteAide} aria-labelledby="pas-de-scan">
      <h2 id="pas-de-scan">{x.plan.pasDeScan}</h2>
      <ol className={s.pas}>{x.plan.commentScanner.map(e => <li key={e}>{e}</li>)}</ol>
      <a className={s.lienBouton} href={APP_LAGARSOFT} target="_blank" rel="noopener"><Picto nom="scan" />{x.plan.appStore}</a>
      <table className={s.tableau}>
        <caption className="visuel-masque">{x.plan.comparer}</caption>
        <thead><tr><th scope="col">{x.plan.comparer}</th>{x.plan.fichiers.map(([n]) => <th key={n} scope="col">{n}</th>)}</tr></thead>
        <tbody>
          {x.plan.contenus.map((c, i) => (
            <tr key={c}><th scope="row">{c}</th>{x.plan.fichiers.map(([n, v]) => <td key={n} className={v[i] ? s.oui : s.non}>{v[i] ? '✓' : '—'}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ScenePlan({ x, ecran, piece, existants, etatMeuble, cyclerMeuble, choisi }) {
  const ref = useRef(null);
  const meubles = ecran === 'meubles';
  // « Voilà ce que j'ai compris » : le plan se trace à l'arrivée (et après une correction des cotes)
  const version = `${piece.version_scene || 0}-${piece.maj_le || ''}-${piece.modele.dims.largeur}-${piece.modele.dims.profondeur}`;
  useIsoLayout(() => {
    if (meubles) return undefined;
    const tl = tracerPlan(ref.current?.querySelector('svg'), { delai: .2 });
    return () => tl?.progress(1).kill();
  }, [version, meubles]);
  const etats = meubles ? Object.fromEntries(existants.map(it => [it.id, etatMeuble(it.id)])) : {};
  return (
    <div className={s.scene} ref={ref}>
      <PlanVivant modele={piece.modele} items={piece.agencement || []} etats={etats} numeros={meubles} choisi={choisi}
        surChoisir={meubles ? cyclerMeuble : undefined} cotes={!meubles} label={sansEtoiles(meubles ? x.meubles.titre : x.compris.titre)} />
      {meubles && (
        <p className={s.legende} aria-hidden="true">
          {ETATS_MEUBLE.map(v => <span key={v}><i data-v={v} />{x.meubles.etats[v]}</span>)}
          <span><i data-v="installation" />{x.compris.installations}</span>
        </p>
      )}
    </div>
  );
}

// la fiche du projet se remplit au fil des réponses
function Fiche({ x, t, lang, projet, nom, piece, r, ecran, ecrans, existants }) {
  const k = ecrans.indexOf(ecran);
  const vu = e => ecrans.includes(e) && ecrans.indexOf(e) <= k;
  const res = piece?.modele ? resumePlan(piece.modele, piece.agencement || []) : null;
  const etats = Object.fromEntries(existants.map(it => [it.id, r.meubles[it.id] || 'remplace']));
  const f = r.foyer;
  const gardes = existants.filter(it => r.meubles[it.id] && r.meubles[it.id] !== 'remplace').length;
  return (
    <div className={s.fiche}>
      <div className={s.ficheTete}><span>{x.apercu.titre}</span><b className={s.ficheTitre}>{projet?.nom || nom.trim() || x.nom.exemple}</b></div>
      <div className={s.fichePlan} data-vide={!res || undefined}>
        {res ? <PlanVivant modele={piece.modele} items={piece.agencement || []} etats={vu('meubles') ? etats : {}} cotes={false} label={x.apercu.piece} /> : x.apercu.planVide}
      </div>
      <dl className={s.ficheLignes}>
        {res && <div><dt>{x.apercu.piece}</dt><dd>{r.nomPiece.trim() || t.fonctions[r.fonction]} · {res.surface.toLocaleString(x.locale, { maximumFractionDigits: 1 })} m²</dd></div>}
        {vu('zones') && <div><dt>{x.apercu.zones}</dt><dd>{r.espaces.length ? r.espaces.map(z => x.zones.options[z]).join(', ') : x.zones.rien}</dd></div>}
        {vu('meubles') && <div><dt>{x.apercu.meubles}</dt><dd>{gardes ? `${gardes} / ${existants.length}` : x.recap.tout}</dd></div>}
        {vu('foyer') && <div><dt>{x.apercu.foyer}</dt><dd><Picto nom="adulte" />{f.adultes}{f.enfants > 0 && <> <Picto nom="enfant" />{f.enfants}</>}{f.chien && <> <Picto nom="chien" /></>}{f.chat && <> <Picto nom="chat" /></>}</dd></div>}
        {vu('priorites') && r.priorites.length > 0 && <div><dt>{x.apercu.priorites}</dt><dd>{r.priorites.map(id => x.priorites.options[id][0]).join(', ')}</dd></div>}
        {vu('style') && (r.styles.length > 0 || r.styleLibre.trim()) && <div><dt>{x.apercu.style}</dt><dd>
          {r.styles.length > 0 && <span className={s.pastilles} style={{ display: 'inline-flex', padding: 0, marginRight: 8, verticalAlign: -2 }}>{r.styles.flatMap(id => PALETTES[id].slice(1, 4)).map((c, i) => <i key={i} style={{ background: c }} />)}</span>}
          {[...r.styles.map(id => x.style.styles[id][0]), r.styleLibre.trim()].filter(Boolean).join(', ')}</dd></div>}
        {vu('budget') && <div><dt>{x.apercu.budget}</dt><dd>{r.avecBudget ? `${x.budget.jusqua} ${prix(r.budget * 100, lang)}` : x.budget.sans}</dd></div>}
      </dl>
      {!res && <p className={s.ficheVide}>{x.accueil.texte}</p>}
    </div>
  );
}
