'use client';
// L'édition Maison Corleone, de bout en bout :
// préchargement (celui de la visite privée) → intro 3D dirigée par le défilement → parcours guidé
// (compte, pièce, budget, style, priorité, photos) → chargement 3D → la pièce en 3D.
// Entre deux temps, un rideau espresso passe, la fleur au centre.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/components/api.js';
import { chargerCatalogue } from '@/components/catalogueClient.js';
import { textesMaison } from '@/components/maison/textes.js';
import { initGsap, gsap, reduit } from '@/components/maison/anim.js';
import { Fleur } from '@/components/maison/Embleme.js';
import Prechargement from '@/components/maison/Prechargement.js';
import Intro from '@/components/maison/Intro.js';
import Parcours from '@/components/maison/Parcours.js';
import Chargement from '@/components/maison/Chargement.js';
import Scene from '@/components/maison/Scene.js';

const CHOIX_DEPART = { fonction: null, budget: 3000, styles: [], texte: '', coups: [], priorites: [] };
const lireSession = (cle, defaut) => { try { const v = sessionStorage.getItem(cle); return v == null ? defaut : JSON.parse(v); } catch (_) { return defaut; } };
const ecrireSession = (cle, v) => { try { if (v == null) sessionStorage.removeItem(cle); else sessionStorage.setItem(cle, JSON.stringify(v)); } catch (_) { /* navigation privée */ } };

export default function Experience({ lang, demo = false, profil: profilServeur = null, connexion = false, message = null, bienvenue = false, pieceId = null }) {
  const t = textesMaison(lang);
  const cle = demo ? 'mc-demo' : 'mc';
  const debut = pieceId ? 'ouverture' : bienvenue || message ? 'parcours' : 'accueil';
  const [phase, setPhase] = useState(debut);
  const [pre, setPre] = useState(debut === 'accueil');
  const [introActive, setIntroActive] = useState(false);
  const [introPrete, setIntroPrete] = useState(false);
  const avancement = useRef(0);
  const [profil, setProfil] = useState(profilServeur);
  const [demoConnecte, setDemoConnecte] = useState(false);
  const [choix, setChoix] = useState(CHOIX_DEPART);
  const [piece, setPiece] = useState(null);
  const [rendus, setRendus] = useState([]);
  const [credits, setCredits] = useState(profilServeur ? profilServeur.rendus : 0);
  const [etapeDepart, setEtapeDepart] = useState(null);
  const [produits, setProduits] = useState(null);
  const [pretClient, setPretClient] = useState(false);
  const rideau = useRef(null);
  const enCreation = useRef(null);
  const connecte = demo ? demoConnecte : !!profil;

  // ---------- rideau entre deux temps ----------
  // Le rideau monte et couvre l'écran, le temps suivant s'installe dessous, puis le rideau
  // continue sa course vers le haut. (y: 0 partout : sans cela, GSAP lirait le translateY(100%) du
  // CSS comme un décalage en pixels qui s'ajoute, et le rideau resterait hors de l'écran à l'aller.)
  const enTransition = useRef(false);
  useEffect(() => { if (rideau.current) { initGsap(); gsap.set(rideau.current, { yPercent: 100, y: 0 }); } }, []);
  const transition = useCallback(suite => {
    const el = rideau.current;
    if (enTransition.current) return;
    if (!el || reduit()) { suite(); scrollTo(0, 0); return; }
    enTransition.current = true;
    initGsap();
    el.style.pointerEvents = 'auto';
    gsap.timeline({ onComplete: () => { enTransition.current = false; el.style.pointerEvents = 'none'; gsap.set(el, { yPercent: 100, y: 0 }); } })
      .fromTo(el, { yPercent: 100, y: 0 }, { yPercent: 0, y: 0, duration: .8, ease: 'mc' })
      .fromTo(el.querySelector('svg'), { rotation: -90, scale: .4, autoAlpha: 0 }, { rotation: 0, scale: 1, autoAlpha: 1, duration: .7, ease: 'expo.out' }, .35)
      .add(() => { suite(); scrollTo(0, 0); }, .85)
      .to(el, { yPercent: -100, y: 0, duration: .9, ease: 'mc' }, 1.25);
  }, []);

  // ---------- profil (prénom, rendus restants, pièces) ----------
  const rafraichirProfil = useCallback(async () => {
    const r = await api('/api/mc/profil');
    if (r.ok && r.profil) { setProfil(r.profil); setCredits(r.profil.rendus); return r.profil; }
    return null;
  }, []);

  // ---------- ouvrir une pièce existante ----------
  const ouvrirPiece = useCallback(async (id, depuisAdresse = false) => {
    const r = await api(`/api/pieces/${id}`);
    if (!r.ok) {
      if (depuisAdresse) { history.replaceState(null, '', location.pathname); setPhase('parcours'); }
      return;
    }
    const p = r.piece;
    const amenagee = (p.agencement || []).some(it => it.origine === 'catalogue');
    const suite = amenagee ? 'piece' : p.modele || p.etat === 'analyse' ? 'chargement' : 'parcours';
    setPiece(p);
    setRendus(r.rendus || []);
    if (suite === 'parcours') { setChoix(c => ({ ...c, fonction: p.fonction })); setEtapeDepart('photos'); }
    if (depuisAdresse) setPhase(suite); else transition(() => setPhase(suite));
  }, [transition]);

  useEffect(() => {
    const c = lireSession(cle + '-choix', null);
    if (c && typeof c === 'object') setChoix({ ...CHOIX_DEPART, ...c });
    if (demo) setDemoConnecte(lireSession(cle + '-connecte', false) === true);
    if (demo || profilServeur) rafraichirProfil();
    chargerCatalogue().then(x => setProduits(x.produits)).catch(() => {});
    if (pieceId) ouvrirPiece(pieceId, true);
    if (bienvenue || message) history.replaceState(null, '', location.pathname);
    setPretClient(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (pretClient) ecrireSession(cle + '-choix', choix); }, [choix, cle, pretClient]);
  // l'adresse garde la pièce ouverte (recharger la page y ramène)
  useEffect(() => {
    if (!pretClient) return;
    if ((phase === 'piece' || phase === 'chargement') && piece) history.replaceState(null, '', `${location.pathname}?piece=${piece.id}`);
    else if ((phase === 'parcours' || phase === 'accueil') && location.search) history.replaceState(null, '', location.pathname);
  }, [phase, piece, pretClient]);

  // ---------- pièce en cours de création (au premier envoi de photo) ----------
  const assurerPiece = useCallback(() => {
    if (enCreation.current) return enCreation.current;
    const tache = (async () => {
      const f = choix.fonction || 'salon';
      if (piece && piece.id) {
        if (piece.fonction === f) return piece;
        const r = await api(`/api/pieces/${piece.id}`, { method: 'PATCH', corps: { fonction: f, nom: t.noms[f] } });
        if (!r.ok) throw r;
        setPiece(r.piece);
        return r.piece;
      }
      const nouveauProjet = async () => {
        const r = await api('/api/projets', { method: 'POST', corps: { nom: t.marque } });
        if (!r.ok) throw r;
        setProfil(p => ({ ...(p || {}), projetId: r.projet.id }));
        return r.projet.id;
      };
      let projet = (profil && profil.projetId) || await nouveauProjet();
      const creer = () => api(`/api/projets/${projet}/pieces`, { method: 'POST', corps: { nom: t.noms[f], fonction: f } });
      let r = await creer();
      if (!r.ok && (r.erreur === 'limite-pieces' || r.statut === 404)) { projet = await nouveauProjet(); r = await creer(); }
      if (!r.ok) throw r;
      const g = await api(`/api/pieces/${r.piece.id}`);
      if (!g.ok) throw g;
      setPiece(g.piece);
      setRendus([]);
      return g.piece;
    })();
    enCreation.current = tache;
    tache.catch(() => {}).finally(() => { enCreation.current = null; });
    return tache;
  }, [piece, choix.fonction, profil, t]);

  // ---------- les temps du parcours ----------
  const commencer = () => transition(() => { setEtapeDepart(null); setPhase('parcours'); });
  async function lancer(dims) {
    let p = piece;
    try { p = await assurerPiece(); } catch (_) { /* la pièce existe déjà : on continue */ }
    if (!p) return;
    const num = v => { const n = parseFloat(String(v || '').replace(',', '.')); return n > .8 && n < 30 ? Math.round(n * 100) / 100 : null; };
    const d = { largeur: num(dims && dims.largeur), profondeur: num(dims && dims.profondeur) };
    if (d.largeur || d.profondeur) {
      const r = await api(`/api/pieces/${p.id}`, { method: 'PATCH', corps: { dims: { ...(p.dims || {}), ...d } } });
      if (r.ok) setPiece(r.piece);
    }
    transition(() => setPhase('chargement'));
  }
  function finChargement(p) {
    setPiece(p);
    setRendus([]);
    if (demo || profil) rafraichirProfil();
    transition(() => setPhase('piece'));
  }
  function nouvelle() {
    setChoix(c => ({ ...CHOIX_DEPART, budget: c.budget, styles: c.styles }));
    setPiece(null);
    setRendus([]);
    transition(() => { setEtapeDepart('piece'); setPhase('parcours'); });
  }
  async function mesPieces() {
    await rafraichirProfil();
    transition(() => { setEtapeDepart('reprise'); setPhase('parcours'); });
  }
  async function deconnexion() {
    if (demo) {
      await api('/api/compte', { method: 'DELETE' });
      ['-choix', '-connecte'].forEach(s => ecrireSession(cle + s, null));
      location.href = `/${lang}/maison-corleone/demo`;
      return;
    }
    await api('/api/mc/deconnexion', { method: 'POST' });
    location.href = `/${lang}/maison-corleone`;
  }
  const connecterDemo = () => { setDemoConnecte(true); ecrireSession(cle + '-connecte', true); };
  const etapeInitiale = etapeDepart || (connecte ? (profil && profil.pieces && profil.pieces.length ? 'reprise' : 'piece') : 'compte');
  const nbPieces = (profil && profil.pieces && profil.pieces.length) || 0;

  return (
    <div className="mc" data-phase={phase}>
      {phase === 'accueil' && (
        <Intro t={t} lang={lang} actif={introActive}
          onAvance={v => { avancement.current = Math.max(avancement.current, v); }}
          onPret={() => setIntroPrete(true)} onFini={commencer} />
      )}
      {phase === 'parcours' && pretClient && (
        <Parcours t={t} lang={lang} demo={demo} etapeInitiale={etapeInitiale} connecte={connecte} profil={profil} connexion={connexion} message={message}
          choix={choix} setChoix={setChoix} piece={piece} setPiece={setPiece} assurerPiece={assurerPiece} produits={produits}
          onConnecteDemo={connecterDemo} onOuvrirPiece={id => ouvrirPiece(id)} onLancer={lancer} onDeconnexion={deconnexion} />
      )}
      {phase === 'chargement' && piece && (
        <Chargement t={t} lang={lang} demo={demo} piece={piece} choix={choix} aDesPieces={nbPieces > 0}
          onMaj={setPiece} onFini={finChargement}
          onPhotos={() => transition(() => { setEtapeDepart('photos'); setPhase('parcours'); })}
          onRetour={() => transition(() => { setEtapeDepart(null); setPhase('parcours'); })}
          onMesPieces={mesPieces} />
      )}
      {phase === 'piece' && piece && piece.modele && (
        <Scene key={piece.id} t={t} lang={lang} demo={demo} piece={piece} rendus={rendus} credits={credits} setCredits={setCredits} profil={profil}
          nbPieces={nbPieces} onNouvelle={nouvelle} onMesPieces={mesPieces} onDeconnexion={deconnexion} />
      )}
      {phase === 'ouverture' && <div className="mc-ouverture mc-fixe" aria-busy="true"><Fleur /></div>}
      {pre && (
        <Prechargement t={t} avancement={avancement} pret={introPrete} onSortie={() => setIntroActive(true)} onFini={() => setPre(false)} />
      )}
      <div className="mc-rideau" ref={rideau} aria-hidden="true"><Fleur /></div>
    </div>
  );
}
