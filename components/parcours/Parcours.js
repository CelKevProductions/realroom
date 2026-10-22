'use client';
// Parcours guidé d'un projet, sur une ou plusieurs pièces, en quatre écrans : vos pièces, la
// vérification, vos envies, votre aménagement. Mise en page de configurateur : la pièce en grand
// plan à gauche (on y touche les meubles à garder), les choix à droite, un pied fixe pour avancer. Chaque écran regroupe des étapes enregistrées
// (lib/parcours.js garde ses dix étapes) qui se dévoilent l'une après l'autre. Chaque choix est
// enregistré tout de suite (reprise à la visite suivante, sur n'importe quel appareil). On peut
// revenir en arrière à tout moment ; l'avancement affiché vient des données réelles. Les étapes
// réutilisent l'atelier existant (relevé, plan, Shuffle) au lieu de le refaire.
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import AccesRespace, { messageRespace } from '@/components/piece/AccesRespace.js';
import { api } from '@/components/api.js';
import { chargerCatalogue } from '@/components/catalogueClient.js';
import { useRacine } from '@/components/chemins.js';
import { useFil } from '@/components/fil.js';
import { Etape, useIsoLayout } from '@/components/mouvement/react.js';
import { Rouage, Progression } from '@/components/mouvement/Attente.js';
import { Explication } from '@/components/mouvement/Explication.js';
import { annoncer, entrer } from '@/components/mouvement/regles.js';
import { reduireImage } from '@/components/piece/image.js';
import { avancement, gardesDe, demandeProposition, normaliserParcours } from '@/lib/parcours.js';
import { ESPACES_PAR_FONCTION } from '@/lib/espaces.js';
import { estInstallation } from '@/lib/usages.js';
import { contourDe, segmentsDe, pointOuverture } from '@/lib/contour.js';
import { estMural, estSuspendu } from '@/lib/agencement.js';
import { FONCTIONS } from '@/lib/config.js';
import { TEXTES } from './textes.js';

const TACHE_ACTIVE = ['attente', 'en_cours'];
// les quatre écrans et les étapes enregistrées qu'ils regroupent
const ECRANS = [
  { id: 'pieces', etapes: ['perimetre', 'capture'] },
  { id: 'verifier', etapes: ['validation', 'choix', 'selection', 'photos'] },
  { id: 'envies', etapes: ['usages', 'preferences'] },
  { id: 'amenagement', etapes: ['proposition', 'approfondissement'] }
];
const FACULTATIVES = ['photos', 'approfondissement'];
const ecranDe = etape => Math.max(0, ECRANS.findIndex(e => e.etapes.includes(etape)));
// scène animée qui explique chaque étape (components/mouvement/Explication.js)
const SCENE = { perimetre: 'pieces', usages: 'usages', capture: 'relever', validation: 'valider', choix: 'conserver', selection: 'conserver',
  photos: 'photo', preferences: 'preferences', proposition: 'proposition', approfondissement: 'affiner' };

export default function Parcours({ lang, t, projetId, projetNom, initial, produits: produitsInitiaux, approfondissement }) {
  const x = TEXTES[lang] || TEXTES.fr;
  const racine = useRacine(lang);
  const [etat, setEtat] = useState(initial.etat);
  const [pieces, poserPieces] = useState(initial.pieces);
  // lu par modifier() dans le même geste qu'un ajout de pièce
  const piecesRef = useRef(pieces);
  const setPieces = useCallback(ps => { piecesRef.current = ps; poserPieces(ps); }, []);
  // le catalogue complet arrive ensuite : les plans des propositions montrent aussi les meubles ajoutés
  const [produits, setProduits] = useState(produitsInitiaux || {});
  useEffect(() => { chargerCatalogue().then(c => setProduits(p => ({ ...c.produits, ...p }))).catch(() => {}); }, []);
  const [sens, setSens] = useState(1);
  const [sauvegarde, setSauvegarde] = useState('ok');     // ok | encours | erreur
  const [occupe, setOccupe] = useState('');
  const [message, setMessage] = useState(null);
  const revision = useRef(initial.revision);
  const aEnvoyer = useRef(null), minuterie = useRef(null), enCours = useRef(Promise.resolve());
  useFil([{ nom: t.projets.titre, href: racine }, { nom: projetNom, href: `${racine}/projets/${projetId}` }, { nom: x.titre }]);

  const faits = avancement(etat, pieces);
  const choisies = etat.pieces.map(id => pieces.find(p => p.id === id)).filter(Boolean);
  // la pièce montrée en grand à gauche (pastilles pour changer de pièce)
  const [vueId, setVueId] = useState(null);
  const montrables = choisies.length ? choisies : pieces;
  const vuePiece = montrables.find(p => p.id === vueId) || montrables.find(p => p.modele) || montrables[0] || null;

  const k = ecranDe(etat.etape), ecran = ECRANS[k];
  const ecranFait = j => ECRANS[j].etapes.every(e => faits[e] || FACULTATIVES.includes(e));
  // étapes sans objet pour ces pièces : pas de meubles relevés, aucun meuble choisi un par un, rien de gardé
  const sansObjet = {
    choix: !choisies.some(p => existants(p).some(it => !estInstallation(it))),
    selection: !choisies.some(p => etat.choix[p.id] === 'certains'),
    photos: !choisies.some(p => gardesDe(etat, p).some(it => !estInstallation(it)))
  };
  const visibles = ecran.etapes.filter(e => !sansObjet[e]);
  // les étapes se dévoilent jusqu'à la première qui reste à faire
  const aFaire = visibles.findIndex(e => !faits[e] && !FACULTATIVES.includes(e));
  const montrees = aFaire < 0 ? visibles : visibles.slice(0, aFaire + 1);
  const active = aFaire < 0 ? visibles[visibles.length - 1] : visibles[aFaire];

  // Enregistrement automatique : un envoi à la fois, le dernier état gagne.
  const envoyer = useCallback(() => {
    clearTimeout(minuterie.current);
    const e = aEnvoyer.current;
    if (!e) return enCours.current;
    aEnvoyer.current = null;
    enCours.current = enCours.current.then(async () => {
      setSauvegarde('encours');
      const r = await api(`/api/projets/${projetId}/parcours`, { method: 'PUT', corps: { etat: e, revision: revision.current } });
      if (r.ok) { revision.current = r.revision; setSauvegarde(aEnvoyer.current ? 'encours' : 'ok'); return; }
      if (r.erreur === 'parcours-conflit') {
        // modifié ailleurs (autre onglet, autre appareil) : on reprend la version enregistrée
        revision.current = r.revision; setEtat(r.etat); setPieces(r.pieces); setSauvegarde('ok');
        setMessage({ texte: x.conflit }); annoncer(x.conflit); return;
      }
      setSauvegarde('erreur');
    });
    return enCours.current;
  }, [projetId, x.conflit, setPieces]);
  const modifier = useCallback(f => {
    setEtat(avant => {
      const apres = normaliserParcours(typeof f === 'function' ? f(avant) : { ...avant, ...f }, piecesRef.current);
      aEnvoyer.current = apres;
      setSauvegarde('encours');
      clearTimeout(minuterie.current);
      minuterie.current = setTimeout(envoyer, 500);
      return apres;
    });
  }, [envoyer]);
  useEffect(() => {
    // page quittée ou rechargée : le dernier état part quand même (keepalive)
    const quitter = () => {
      const e = aEnvoyer.current;
      // démo : tout est déjà dans le navigateur, rien à envoyer au serveur
      if (!e || racine.includes('/demo')) return;
      aEnvoyer.current = null; clearTimeout(minuterie.current);
      try { fetch(`/api/projets/${projetId}/parcours`, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etat: e, revision: revision.current }) }); } catch (_) {}
    };
    addEventListener('pagehide', quitter);
    // navigation dans l'application : envoi normal
    return () => { removeEventListener('pagehide', quitter); if (aEnvoyer.current) envoyer(); };
  }, [envoyer, projetId, racine]);

  const poserSelection = useCallback((pid, id, v) => modifier(e => {
    const sel = { ...(e.selection[pid] || {}) };
    if (v) sel[id] = v; else delete sel[id];
    return { ...e, selection: { ...e.selection, [pid]: sel } };
  }), [modifier]);

  async function recharger() {
    const r = await api(`/api/projets/${projetId}/parcours`);
    if (r.ok) setPieces(r.pieces);
    return r;
  }
  async function aller(j, direction) {
    // en quittant la vérification vers la suite, les contraintes des meubles gardés sont écrites sur chaque pièce
    if (ecran.id === 'verifier' && j > k) {
      setOccupe('contraintes');
      await envoyer();
      for (const p of choisies) {
        const r = await api(`/api/projets/${projetId}/parcours`, { method: 'POST', corps: { action: 'contraintes', piece: p.id } });
        if (!r.ok) { setOccupe(''); setMessage({ texte: x.erreurs[r.erreur] || x.erreurs.generique, erreur: true }); return; }
        setPieces(r.pieces);
      }
      setOccupe('');
    }
    setSens(direction); setMessage(null); modifier({ etape: ECRANS[j].etapes[0] });
  }
  const suivant = () => { if (k < ECRANS.length - 1) aller(k + 1, 1); };
  const precedent = () => { if (k > 0) aller(k - 1, -1); };
  // un écran fait, ou le premier qui ne l'est pas, est accessible depuis la progression
  const premierAFaire = ECRANS.findIndex((_, j) => !ecranFait(j));
  const accessible = j => j <= (premierAFaire < 0 ? ECRANS.length - 1 : premierAFaire) || ecranFait(j);
  const peutContinuer = ecranFait(k);

  const props = { x, t, lang, racine, etat, modifier, pieces, choisies, produits, faits, recharger, setPieces, setMessage, occupe, setOccupe, projetId, approfondissement, envoyer, poserSelection, vuePiece, setVueId };
  const fr = lang !== 'en';
  return (
    <div className="conteneur app-page parcours parcours--plateau">
      <div className="app-page__tete">
        <div>
          <p className="parcours__projet">{projetNom}</p>
          <h1>{x.titre}</h1>
        </div>
      </div>
      <nav className="parcours__ecrans" aria-label={x.recap}>
        <ol>
          {ECRANS.map((e, j) => (
            <li key={e.id} className={(j === k ? 'is-actif' : '') + (ecranFait(j) ? ' is-fait' : '')}>
              <button type="button" disabled={!accessible(j) || !!occupe} aria-current={j === k ? 'step' : undefined} onClick={() => j !== k && aller(j, j > k ? 1 : -1)}>
                <span className="parcours__num">{String(j + 1).padStart(2, '0')}</span>
                <span>{x.ecrans[e.id].nom}</span>
                {ecranFait(j) && <span className="visuel-masque">{x.fait}</span>}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <div className="parcours__grille">
        {/* la pièce en grand : plan dessiné, meubles numérotés, cotes */}
        <section className="parcours__vue" aria-label={fr ? 'Plan de la pièce' : 'Room plan'}>
          {montrables.length > 1 && <div className="parcours__pastilles" role="group" aria-label={fr ? 'Pièce affichée' : 'Room shown'}>
            {montrables.map(p => <button key={p.id} type="button" className="puce puce-bouton" aria-pressed={vuePiece?.id === p.id} onClick={() => setVueId(p.id)}>{p.nom}</button>)}
          </div>}
          <VuePiece {...props} p={vuePiece} ecran={ecran.id} active={active} />
        </section>
        <div className="parcours__scene">
          <Etape key={ecran.id} titre={x.ecrans[ecran.id].nom} sens={sens} className="parcours__etape">
            <p className="parcours__chapitre chiffre">{String(k + 1).padStart(2, '0')} / {String(ECRANS.length).padStart(2, '0')}</p>
            <h2 data-titre-etape="">{x.ecrans[ecran.id].titre}</h2>
            <p className="parcours__intro">{x.ecrans[ecran.id].intro}</p>
            <Explication key={active} scene={SCENE[active]} texte={x.etapes[active].panda} geste={k === 0 ? 'salut' : null} />
            {message && <p className={'avis ' + (message.erreur ? 'avis--alerte' : 'avis--note')}>{message.texte}</p>}
            {montrees.map(e => (
              <Bloc key={e} etape={e}>
                <h3>{x.etapes[e].titre}{FACULTATIVES.includes(e) && <span className="discret"> · {x.facultatif}</span>}</h3>
                <p className="discret">{x.etapes[e].intro}</p>
                <Contenu {...props} etape={e} />
              </Bloc>
            ))}
          </Etape>
        </div>
      </div>
      {/* pied fixe : avancement, enregistrement, retour et suite */}
      <div className="parcours__pied">
        <div className="parcours__avance">
          <span className="chiffre">{String(k + 1).padStart(2, '0')} / {String(ECRANS.length).padStart(2, '0')}</span>
          <span className="parcours__jauge" aria-hidden="true">{ECRANS.map((e, j) => <i key={e.id} className={ecranFait(j) ? 'is-fait' : j === k ? 'is-actif' : ''} />)}</span>
          <span className="parcours__sauvegarde" role="status">{sauvegarde === 'encours' ? x.enregistrement : sauvegarde === 'erreur' ? x.nonEnregistre : x.enregistre}</span>
        </div>
        {!peutContinuer && <p className="parcours__bloque">{x.etapes[active].bloque}</p>}
        <div className="parcours__boutons">
          <button type="button" className="btn btn--clair" onClick={precedent} disabled={k === 0 || !!occupe}>{x.retour}</button>
          {k < ECRANS.length - 1 && <button type="button" className="btn btn--plein" onClick={suivant} disabled={!peutContinuer || !!occupe}>
            {occupe === 'contraintes' ? <><Rouage /> {x.enregistrement}</> : <>{x.continuer} <span aria-hidden="true">→</span></>}
          </button>}
        </div>
      </div>
    </div>
  );
}

// État d'un meuble relevé pour le plan : reste à sa place, peut bouger, remplacé, installation.
function etatMeuble(etat, p, it) {
  if (estInstallation(it)) return 'installation';
  const choix = etat.choix[p.id];
  if (choix === 'certains') return etat.selection[p.id]?.[it.id] || 'remplace';
  if (choix === 'reagencer') return 'deplacable';
  if (choix === 'tout') return 'remplace';
  return 'neutre';
}
const CYCLE = { remplace: 'fixe', fixe: 'deplacable', deplacable: '' };

// La pièce en grand, au trait : sol, murs, fenêtres, portes, cotes et meubles numérotés.
// À l'étape « quels meubles conserver », toucher un meuble change son devenir.
function VuePiece({ x, t, lang, racine, etat, p, produits, ecran, poserSelection }) {
  const fr = lang !== 'en';
  if (!p) return <div className="plan-vide"><p>{fr ? 'Choisissez ou ajoutez une pièce : son plan s’affichera ici.' : 'Pick or add a room: its plan will show here.'}</p></div>;
  if (!p.modele) return (
    <div className="plan-vide">
      <p className="parcours__projet">{t.fonctions[p.fonction]}</p>
      <p><b>{p.nom}</b></p>
      <p className="discret">{fr ? 'Pas encore de plan pour cette pièce. Scan, plan DXF ou photos : quelques minutes suffisent.' : 'No plan yet for this room. Scan, DXF plan or photos: it only takes a few minutes.'}</p>
      <Link className="btn btn--plein btn--petit" href={`${racine}/pieces/${p.id}`}>{x.capture.relever}</Link>
    </div>
  );
  const m = p.modele, L = m.dims.largeur, P = m.dims.profondeur, pad = .62;
  const f = v => v.toLocaleString(x.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const proposition = ecran === 'amenagement' && (p.agencement || []).some(it => it.origine === 'catalogue');
  const liste = proposition ? (p.agencement || []).filter(it => it.garde !== false) : existants(p);
  const modifiable = ecran === 'verifier' && etat.choix[p.id] === 'certains';
  const produitDe = it => (it.sku && produits?.[it.sku]) || it.p;
  const etats = new Set();
  // tapis d'abord, meubles ensuite, et tous les numéros par-dessus pour qu'aucun ne soit caché
  const formes = [], numeros = [], places = [];
  liste.forEach((it, n) => {
    const q = produitDe(it);
    if (!q || estMural(q.fam) || estSuspendu(q.fam)) return;
    const e = it.origine === 'catalogue' ? 'propose' : etatMeuble(etat, p, it);
    etats.add(e);
    const [w, d] = q.dim, clic = modifiable && e !== 'installation', tapis = q.fam === 'tapis';
    const basculer = () => poserSelection(p.id, it.id, CYCLE[e] ?? '');
    // un tapis porte son numéro dans un coin, pour ne pas cacher celui du meuble posé dessus
    const a = -(it.rot || 0), cx = tapis ? -w / 2 + .22 : 0, cy = tapis ? -d / 2 + .22 : 0;
    // deux numéros au même endroit (meuble TV et télévision) : le second se décale
    const base = [it.x + cx * Math.cos(a) - cy * Math.sin(a), it.z + cx * Math.sin(a) + cy * Math.cos(a)];
    const [nx, nz] = [[0, 0], [0, .34], [0, -.34], [-.34, 0], [.34, 0]].map(([u, v]) => [base[0] + u, base[1] + v])
      .find(([u, v]) => places.every(([pu, pv]) => Math.hypot(u - pu, v - pv) > .3)) || base;
    places.push([nx, nz]);
    const pos = `translate(${nx} ${nz})`;
    const classe = 'plan-scene__meuble is-' + e + (clic ? ' is-cliquable' : '');
    formes.push({ tapis, el: (
      <g key={it.id} transform={`translate(${it.x} ${it.z})`} className={classe + (tapis ? ' is-tapis' : '')}
        {...(clic ? { role: 'button', tabIndex: 0, 'aria-label': `${n + 1} ${q.nom || q.fam}`, onClick: basculer, onKeyDown: ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); basculer(); } } } : {})}>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} rx=".035" transform={`rotate(${a * 180 / Math.PI})`} />
      </g>
    ) });
    numeros.push(
      <g key={'n-' + it.id} transform={pos} className={classe} aria-hidden="true" onClick={clic ? basculer : undefined}>
        <circle r=".15" className="plan-scene__pastille" />
        <text textAnchor="middle" dominantBaseline="central" className="plan-scene__numero">{n + 1}</text>
      </g>
    );
  });
  const meubles = [...formes.filter(f => f.tapis), ...formes.filter(f => !f.tapis)].map(f => f.el);
  const ouvertures = segmentsDe(m).flatMap(pan => (m.murs[pan.id]?.ouvertures || []).map((o, i) => {
    const a = pointOuverture(pan, o.position - o.largeur / 2), b = pointOuverture(pan, o.position + o.largeur / 2);
    return <line key={`${pan.id}-${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={o.type === 'fenetre' ? 'plan-scene__fenetre' : 'plan-scene__porte'} />;
  }));
  const LEGENDE = { fixe: x.selection.fixe.split(' · ').pop(), deplacable: x.selection.deplacable.split(' · ').pop(), remplace: x.selection.remplacer, installation: x.selection.installation,
    propose: fr ? 'Proposé par RealRoom' : 'Suggested by RealRoom', neutre: fr ? 'Meuble relevé' : 'Surveyed item' };
  return (
    <figure className="plan-scene-cadre">
      <svg viewBox={`${-L / 2 - pad} ${-P / 2 - pad} ${L + 2 * pad} ${P + 2 * pad}`} className="plan-scene" role="img" aria-label={`${p.nom} · ${f(L)} × ${f(P)} m`}>
        <polygon points={contourDe(m).map(q => q.join(',')).join(' ')} className="plan-scene__sol" />
        <g className="plan-scene__cote">
          <line x1={-L / 2} y1={-P / 2 - .32} x2={L / 2} y2={-P / 2 - .32} /><line x1={-L / 2} y1={-P / 2 - .42} x2={-L / 2} y2={-P / 2 - .22} /><line x1={L / 2} y1={-P / 2 - .42} x2={L / 2} y2={-P / 2 - .22} />
          <text x="0" y={-P / 2 - .4} textAnchor="middle">{f(L)}</text>
          <line x1={-L / 2 - .32} y1={-P / 2} x2={-L / 2 - .32} y2={P / 2} /><line x1={-L / 2 - .42} y1={-P / 2} x2={-L / 2 - .22} y2={-P / 2} /><line x1={-L / 2 - .42} y1={P / 2} x2={-L / 2 - .22} y2={P / 2} />
          <text x={-L / 2 - .4} y="0" textAnchor="middle" transform={`rotate(-90 ${-L / 2 - .4} 0)`}>{f(P)}</text>
        </g>
        {meubles}
        {ouvertures}
        {numeros}
      </svg>
      <figcaption>
        <span className="chiffre">{p.nom} · {f(L)} × {f(P)} m{m.dims.estimees ? ' · ' + x.validation.estimees : ''}</span>
        {etats.size > 0 && <span className="plan-scene__legende">{['fixe', 'deplacable', 'remplace', 'installation', 'propose', 'neutre'].filter(e => etats.has(e)).map(e => <span key={e} className={'is-' + e}><i aria-hidden="true" />{LEGENDE[e]}</span>)}</span>}
        {modifiable && <span className="plan-scene__astuce">{fr ? 'Touchez un meuble sur le plan pour changer son devenir.' : 'Tap an item on the plan to change what happens to it.'}</span>}
      </figcaption>
    </figure>
  );
}

// Une étape dans son écran : elle glisse en place quand elle se dévoile.
function Bloc({ etape, children }) {
  const ref = useRef(null);
  useIsoLayout(() => { const tw = entrer(ref.current); return () => { tw?.progress(1).kill(); }; }, []);
  return <section ref={ref} className="parcours__bloc" data-etape={etape}>{children}</section>;
}

function Contenu(props) {
  const E = { perimetre: Perimetre, usages: Usages, capture: Capture, validation: Validation, choix: Choix, selection: Selection,
    photos: PhotosMeubles, preferences: Preferences, proposition: Proposition, approfondissement: Approfondissement }[props.etape];
  return <E {...props} />;
}

// Montrer une pièce dans le grand plan (sur téléphone, on y remonte).
function VoirPlan({ x, p, vuePiece, setVueId, choisies }) {
  if (!p.modele || choisies.length < 2) return null;
  const affiche = vuePiece?.id === p.id;
  const montrer = () => {
    setVueId(p.id);
    if (matchMedia('(max-width: 900px)').matches) document.querySelector('.parcours__vue')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return <button type="button" className="btn btn--clair btn--petit" aria-pressed={affiche} onClick={montrer}>{affiche ? x.planAffiche : x.voirPlan}</button>;
}

// Petit plan au trait d'une pièce, pour sa carte.
function Croquis({ m }) {
  if (!m) return <svg viewBox="0 0 10 10" className="carte-piece__plan is-vide" aria-hidden="true"><rect x="1.5" y="1.5" width="7" height="7" rx=".5" /></svg>;
  const L = m.dims.largeur, P = m.dims.profondeur, pad = Math.max(L, P) * .1;
  return <svg viewBox={`${-L / 2 - pad} ${-P / 2 - pad} ${L + 2 * pad} ${P + 2 * pad}`} className="carte-piece__plan" aria-hidden="true">
    <polygon points={contourDe(m).map(q => q.join(',')).join(' ')} />
  </svg>;
}

/* 1. Périmètre : les pièces concernées, en cartes, plus une carte pour en ajouter */
function Perimetre({ x, t, etat, modifier, pieces, setPieces, projetId, recharger, setVueId }) {
  const [fonction, setFonction] = useState('salon'), [nom, setNom] = useState(''), [attente, setAttente] = useState(false);
  const [ouvert, setOuvert] = useState(!pieces.length);
  const basculer = id => {
    if (!etat.pieces.includes(id)) setVueId(id);
    modifier(e => ({ ...e, pieces: e.pieces.includes(id) ? e.pieces.filter(p => p !== id) : [...e.pieces, id] }));
  };
  async function ajouter(ev) {
    ev.preventDefault(); setAttente(true);
    const r = await api(`/api/projets/${projetId}/pieces`, { method: 'POST', corps: { nom: nom.trim() || t.fonctions[fonction], fonction } });
    setAttente(false);
    if (!r.ok) return;
    const n = await recharger();
    if (n.ok) { setPieces(n.pieces); modifier(e => ({ ...e, pieces: [...e.pieces, r.piece.id] })); setNom(''); setOuvert(false); setVueId(r.piece.id); }
  }
  return (
    <div className="cartes-pieces" role="group" aria-label={x.perimetre.pieces}>
      {pieces.map(p => {
        const choisie = etat.pieces.includes(p.id);
        return (
          <button key={p.id} type="button" className="carte-piece" aria-pressed={choisie} onClick={() => basculer(p.id)}>
            <Croquis m={p.modele} />
            <span className="carte-piece__nom">{p.nom}</span>
            <span className="carte-piece__info">{t.fonctions[p.fonction]} · {p.modele ? x.planReleve : x.sansPlan}</span>
            <span className="carte-piece__coche" aria-hidden="true">{choisie ? '✓' : '+'}</span>
          </button>
        );
      })}
      {ouvert ? (
        <form className="carte-piece carte-piece--form" onSubmit={ajouter}>
          <label className="champ"><span>{x.perimetre.fonction}</span>
            <select className="saisie" value={fonction} onChange={e => setFonction(e.target.value)}>
              {FONCTIONS.map(f => <option key={f} value={f}>{t.fonctions[f]}</option>)}
            </select>
          </label>
          <label className="champ"><span>{x.perimetre.nom}</span>
            <input className="saisie" value={nom} maxLength={80} placeholder={t.fonctions[fonction]} onChange={e => setNom(e.target.value)} />
          </label>
          <div className="rangee">
            <button className="btn btn--plein btn--petit" disabled={attente}>{attente ? <Rouage /> : null} {x.perimetre.ajouter}</button>
            {pieces.length > 0 && <button type="button" className="btn btn--lien btn--petit" onClick={() => setOuvert(false)}>{x.perimetre.annuler}</button>}
          </div>
        </form>
      ) : (
        <button type="button" className="carte-piece carte-piece--plus" onClick={() => setOuvert(true)}>
          <span className="carte-piece__signe" aria-hidden="true">+</span>
          <span className="carte-piece__nom">{x.perimetre.ajouter}</span>
        </button>
      )}
    </div>
  );
}

/* 2. Usages : ce qui se passe dans chaque pièce, en pastilles à cocher */
function Usages({ x, t, etat, modifier, choisies }) {
  const maj = (id, champ, v) => modifier(e => ({ ...e, usages: { ...e.usages, [id]: { espaces: [], envies: '', ...e.usages[id], [champ]: v } } }));
  return choisies.map(p => {
    const u = etat.usages[p.id] || { espaces: [], envies: '' }, possibles = ESPACES_PAR_FONCTION[p.fonction] || [];
    return (
      <fieldset key={p.id} className="carte parcours__piece">
        <legend><b>{p.nom}</b> <span className="discret">· {t.fonctions[p.fonction]}</span></legend>
        {possibles.length > 0 && <div className="puces">
          {possibles.map(s => {
            const on = u.espaces.includes(s);
            return <button key={s} type="button" className="puce puce-bouton parcours__usage" aria-pressed={on}
              onClick={() => maj(p.id, 'espaces', on ? u.espaces.filter(v => v !== s) : [...u.espaces, s])}>
              <span aria-hidden="true">{on ? '✓' : '+'}</span>{x.espaces[s]}
            </button>;
          })}
        </div>}
        {u.espaces.includes('repas') && <label className="champ"><span>{x.usages.places}</span>
          <input className="saisie" type="number" min="2" max="12" value={u.placesRepas || 4} onChange={e => maj(p.id, 'placesRepas', +e.target.value)} />
        </label>}
        <label className="champ"><span>{x.usages.envies}</span>
          <textarea className="saisie" rows={2} maxLength={600} value={u.envies} placeholder={x.usages.exemple} onChange={e => maj(p.id, 'envies', e.target.value)} />
        </label>
        <label className="coche"><input type="checkbox" checked={!!u.confirme} onChange={e => maj(p.id, 'confirme', e.target.checked)} />{x.usages.confirme}</label>
      </fieldset>
    );
  });
}

/* 3. Capture : relevé dans l'atelier existant (RoomPlan, import de plan, photos et mesures) */
function Capture({ x, racine, choisies, recharger }) {
  const [attente, setAttente] = useState(false);
  return (
    <>
      <ul className="parcours__liste">
        {choisies.map(p => <li key={p.id} className="carte parcours__piece">
          <b>{p.nom}</b>
          {p.modele ? <span className="puce puce--vert">{x.capture.fait}</span>
            : p.etat === 'analyse' ? <span className="puce"><Rouage /> {x.capture.analyse}</span>
              : <span className="puce">{x.capture.aFaire}</span>}
          <Link className="btn btn--petit btn--clair" href={`${racine}/pieces/${p.id}`}>{p.modele ? x.capture.refaire : x.capture.relever}</Link>
        </li>)}
      </ul>
      <button type="button" className="btn btn--lien" disabled={attente} onClick={async () => { setAttente(true); await recharger(); setAttente(false); }}>
        {attente && <Rouage />} {x.capture.actualiser}
      </button>
    </>
  );
}

function Cotes({ m, x }) {
  const f = v => v.toLocaleString(x.locale, { maximumFractionDigits: 2 });
  const ouv = Object.values(m.murs || {}).flatMap(w => w.ouvertures || []);
  return <p className="discret">{f(m.dims.largeur)} × {f(m.dims.profondeur)} m, {x.validation.hauteur} {f(m.dims.hauteur)} m
    {m.contour ? ` · ${contourDe(m).length} ${x.validation.cotes}` : ''} · {ouv.filter(o => o.type === 'porte' || o.type === 'passage').length} {x.validation.portes},
    {' '}{ouv.filter(o => o.type === 'fenetre').length} {x.validation.fenetres}{m.dims.estimees ? ' · ' + x.validation.estimees : ''}</p>;
}

/* 4. Validation du plan (le plan lui-même est à gauche) */
function Validation(props) {
  const { x, racine, etat, modifier, choisies, projetId, setPieces, setMessage } = props;
  const [attente, setAttente] = useState('');
  async function valider(p) {
    setAttente(p.id);
    const r = await api(`/api/projets/${projetId}/parcours`, { method: 'POST', corps: { action: 'valider', piece: p.id } });
    setAttente('');
    if (!r.ok) { setMessage({ texte: x.erreurs[r.erreur] || x.erreurs.generique, erreur: true }); return; }
    setPieces(r.pieces);
    const n = r.pieces.find(q => q.id === p.id);
    modifier(e => ({ ...e, valides: { ...e.valides, [p.id]: n.version_scene || 0 } }));
  }
  return choisies.map(p => (
    <section key={p.id} className="carte parcours__piece">
      <div className="parcours__rang"><h3>{p.nom}</h3><VoirPlan {...props} p={p} /></div>
      {!p.modele ? <p>{x.validation.pasDePlan}</p> : <>
        <Cotes m={p.modele} x={x} />
        {etat.valides[p.id] === (p.version_scene || 0)
          ? <p className="puce puce--vert">{x.validation.valide}</p>
          : <div className="rangee">
            <button type="button" className="btn btn--plein btn--petit" disabled={!!attente} onClick={() => valider(p)}>{attente === p.id && <Rouage />} {x.validation.juste}</button>
            <Link className="btn btn--clair btn--petit" href={`${racine}/pieces/${p.id}`}>{x.validation.corriger}</Link>
          </div>}
      </>}
    </section>
  ));
}

const existants = p => (p.agencement || []).filter(it => it.origine === 'existant' && it.garde !== false);

/* 5. Choix par pièce */
function Choix({ x, etat, modifier, choisies }) {
  return choisies.map(p => {
    const meubles = existants(p).filter(it => !estInstallation(it));
    return (
      <fieldset key={p.id} className="carte parcours__piece">
        <legend><b>{p.nom}</b></legend>
        {!meubles.length ? <p className="discret">{x.choix.vide}</p> : ['tout', 'reagencer', 'certains'].map(c => (
          <label key={c} className="coche coche--cadre">
            <input type="radio" name={'choix-' + p.id} checked={etat.choix[p.id] === c} onChange={() => modifier(e => ({ ...e, choix: { ...e.choix, [p.id]: c } }))} />
            <span><b>{x.choix[c]}</b><br /><span className="discret">{x.choix[c + 'Aide']}</span></span>
          </label>
        ))}
      </fieldset>
    );
  });
}

/* 6. Sélection : sur le plan à gauche (toucher un meuble) ou dans cette liste, mêmes numéros */
function Selection(props) {
  const { x, t, etat, choisies, poserSelection } = props;
  return choisies.map(p => {
    const liste = existants(p), choix = etat.choix[p.id] || 'tout', gardes = new Set(gardesDe(etat, p).map(it => it.id));
    if (!liste.length || !p.modele) return <section key={p.id} className="carte parcours__piece"><h3>{p.nom}</h3><p className="discret">{x.choix.vide}</p></section>;
    return (
      <section key={p.id} className="carte parcours__piece">
        <div className="parcours__rang"><h3>{p.nom} <span className="discret">· {x.choix[choix]}</span></h3><VoirPlan {...props} p={p} /></div>
        <ol className="parcours__meubles">
          {liste.map((it, n) => {
            const installation = estInstallation(it), [w, d, h] = it.p.dim;
            const valeur = installation ? 'fixe' : choix === 'certains' ? (etat.selection[p.id]?.[it.id] || '') : choix === 'reagencer' ? 'deplacable' : '';
            return (
              <li key={it.id} className={'is-' + (installation ? 'installation' : valeur || 'remplace')}>
                <span className="parcours__num">{n + 1}</span>
                <span><b>{it.p.nom || t.fonctions?.[it.p.fam] || it.p.fam}</b><br />
                  <span className="discret">{[w, d, h].map(v => Math.round(v * 100)).join(' × ')} cm{gardes.has(it.id) ? ' · ' + x.selection.verrou : ''}</span></span>
                {installation ? <span className="puce">{x.selection.installation}</span>
                  : choix === 'certains' ? (
                    <select className="saisie" aria-label={x.selection.devenir + ' ' + (n + 1)} value={valeur} onChange={e => poserSelection(p.id, it.id, e.target.value)}>
                      <option value="">{x.selection.remplacer}</option>
                      <option value="deplacable">{x.selection.deplacable}</option>
                      <option value="fixe">{x.selection.fixe}</option>
                    </select>
                  ) : <span className="puce">{valeur ? x.selection.deplacable : x.selection.remplacer}</span>}
              </li>
            );
          })}
        </ol>
        <p className="discret">{x.selection.note}</p>
      </section>
    );
  });
}

/* 7. Photos des meubles conservés (facultatif) */
function PhotosMeubles({ x, etat, modifier, choisies, setPieces, recharger, setMessage }) {
  const [attente, setAttente] = useState('');
  async function envoyer(p, it, fichier) {
    if (!fichier) return;
    setAttente(it.id);
    try {
      const { blob, largeur, hauteur } = await reduireImage(fichier);
      const f = new FormData();
      f.append('photo', blob, 'meuble.jpg'); f.append('role', 'detail'); f.append('meuble', it.id);
      f.append('largeur', String(largeur)); f.append('hauteur', String(hauteur));
      const r = await api(`/api/pieces/${p.id}/photos`, { method: 'POST', formulaire: f });
      if (!r.ok) setMessage({ texte: x.erreurs[r.erreur] || x.erreurs.generique, erreur: true });
      else { const n = await recharger(); if (n.ok) setPieces(n.pieces); }
    } catch (_) { setMessage({ texte: x.erreurs.format, erreur: true }); }
    setAttente('');
  }
  return choisies.map(p => {
    const gardes = gardesDe(etat, p).filter(it => !estInstallation(it));
    return (
      <section key={p.id} className="carte parcours__piece">
        <h3>{p.nom}</h3>
        {!gardes.length ? <p className="discret">{x.photos.aucun}</p> : <ul className="parcours__liste">
          {gardes.map(it => {
            const photo = (p.photos || []).find(f => f.meuble === it.id);
            return <li key={it.id} className="parcours__photo">
              {photo ? <img src={photo.url} alt={x.photos.alt + ' ' + (it.p.nom || it.p.fam)} width="72" height="72" /> : <span className="parcours__vignette" aria-hidden="true" />}
              <span>{it.p.nom || it.p.fam}</span>
              <label className="btn btn--petit btn--clair">
                {attente === it.id ? <Rouage /> : null} {photo ? x.photos.remplacer : x.photos.ajouter}
                <input type="file" accept="image/*" className="visuel-masque" disabled={!!attente} onChange={e => envoyer(p, it, e.target.files?.[0])} />
              </label>
            </li>;
          })}
        </ul>}
        <label className="coche"><input type="checkbox" checked={!!etat.photosPassees[p.id]}
          onChange={e => modifier(s => ({ ...s, photosPassees: { ...s.photosPassees, [p.id]: e.target.checked } }))} />{x.photos.passer}</label>
      </section>
    );
  });
}

/* 8. Préférences : budget au curseur, style en suggestions d'un clic */
const BUDGET_MAX = 10000;
function Preferences({ x, etat, modifier }) {
  const pr = etat.preferences, maj = (k, v) => modifier(e => ({ ...e, preferences: { ...e.preferences, [k]: v } }));
  const budget = pr.budget || 0, euros = v => v.toLocaleString(x.locale) + ' €';
  // une suggestion de style s'ajoute au champ, ou s'en retire si elle y est déjà
  const mots = (pr.style || '').split(',').map(v => v.trim()).filter(Boolean);
  const aStyle = s => mots.some(v => v.toLowerCase() === s.toLowerCase());
  const basculerStyle = s => maj('style', (aStyle(s) ? mots.filter(v => v.toLowerCase() !== s.toLowerCase()) : [...mots, s]).join(', ').slice(0, 120));
  return (
    <div className="formulaire">
      <div className="champ parcours__budget">
        <span id="parcours-budget">{x.preferences.budget}</span>
        <output className="parcours__montant" htmlFor="parcours-budget-curseur">{budget ? euros(budget) : x.preferences.sansBudget}</output>
        <input id="parcours-budget-curseur" type="range" min="0" max={Math.max(BUDGET_MAX, budget)} step="100" value={budget}
          aria-labelledby="parcours-budget" aria-valuetext={budget ? euros(budget) : x.preferences.sansBudget}
          style={{ '--part': `${budget / Math.max(BUDGET_MAX, budget) * 100}%` }} onChange={e => maj('budget', +e.target.value)} />
        <span className="parcours__bornes chiffre"><span>{x.preferences.sansBudget}</span><span>{euros(Math.max(BUDGET_MAX, budget))}</span></span>
        <label className="parcours__exact"><span className="discret">{x.preferences.exact}</span>
          <input className="saisie" type="number" min="0" step="100" value={budget || ''} placeholder={x.preferences.sansBudget} onChange={e => maj('budget', +e.target.value || 0)} />
        </label>
        <small>{x.preferences.budgetAide}</small>
      </div>
      <div className="champ">
        <label htmlFor="parcours-style">{x.preferences.style}</label>
        <div className="puces">
          {x.preferences.styles.map(s => <button key={s} type="button" className="puce puce-bouton parcours__usage" aria-pressed={aStyle(s)} onClick={() => basculerStyle(s)}>
            <span aria-hidden="true">{aStyle(s) ? '✓' : '+'}</span>{s}
          </button>)}
        </div>
        <input id="parcours-style" className="saisie" maxLength={120} value={pr.style} placeholder={x.preferences.styleExemple} onChange={e => maj('style', e.target.value)} />
      </div>
      <label className="champ"><span>{x.preferences.envies}</span>
        <textarea className="saisie" rows={3} maxLength={800} value={pr.envies} onChange={e => maj('envies', e.target.value)} />
      </label>
      <label className="coche"><input type="checkbox" checked={!!pr.confirme} onChange={e => maj('confirme', e.target.checked)} />{x.preferences.confirme}</label>
    </div>
  );
}

/* 9. Première proposition : l'assistant de l'atelier, pièce par pièce */
function Proposition(props) {
  const { x, lang, racine, etat, choisies, faits, recharger, setPieces, occupe, setOccupe } = props;
  const [suivi, setSuivi] = useState({}), [notes, setNotes] = useState({});
  async function lancer() {
    setOccupe('proposition');
    const n = { ...suivi };
    setNotes({});
    try {
      for (const p of choisies) {
        n[p.id] = 'encours'; setSuivi({ ...n });
        const r = await api(`/api/pieces/${p.id}/variantes`, { method: 'POST', corps: demandeProposition(etat, p, lang) }).catch(e => ({ ok: false, erreur: e?.code }));
        n[p.id] = r.ok ? 'fait' : (x.erreurs[r.erreur] || x.erreurs.generique);
        setSuivi({ ...n });
        if (r.ok && r.respace) setNotes(v => ({ ...v, [p.id]: messageRespace(r.respace, lang) }));
        annoncer(p.nom + ' : ' + (r.ok ? x.proposition.prete : n[p.id]));
      }
      const r = await recharger();
      if (r.ok) setPieces(r.pieces);
    } finally { setOccupe(''); }
  }
  const prete = p => (p.proposition?.variantes?.liste || []).length > 0;
  return (
    <>
      {occupe === 'proposition' && <Progression libelle={x.proposition.calcul} etapes={choisies.map(p => ({ id: p.id, nom: p.nom, fait: suivi[p.id] === 'fait', encours: suivi[p.id] === 'encours' }))} />}
      <AccesRespace lang={lang} />
      <button type="button" className="btn btn--plein" disabled={!!occupe} onClick={lancer}>
        {occupe === 'proposition' ? <><Rouage /> {x.proposition.calcul}</> : faits.proposition ? x.proposition.relancer : x.proposition.lancer}
      </button>
      {choisies.map(p => (
        <section key={p.id} className="carte parcours__piece">
          <div className="parcours__rang">
            <h3>{p.nom} {prete(p) && <span className="puce puce--vert">{x.proposition.prete}</span>}</h3>
            {prete(p) && p.modele && <div className="rangee">
              <VoirPlan {...props} p={p} />
              <Link className="btn btn--plein btn--petit" href={`${racine}/pieces/${p.id}`}>{x.proposition.atelier}</Link>
            </div>}
          </div>
          {typeof suivi[p.id] === 'string' && !['fait', 'encours'].includes(suivi[p.id]) && <p className="avis avis--alerte">{suivi[p.id]}</p>}
          {notes[p.id] && <p className="discret">{notes[p.id]}</p>}
        </section>
      ))}
    </>
  );
}

/* 10. Approfondissement (facultatif) : tâche longue sur le service GPU */
function Approfondissement({ x, lang, choisies, approfondissement, recharger, setPieces }) {
  const [taches, setTaches] = useState({}), [erreurs, setErreurs] = useState({});
  const lire = useCallback(async id => {
    const r = await api(`/api/pieces/${id}/approfondir`);
    if (r.ok) setTaches(v => ({ ...v, [id]: r.taches[0] || null }));
  }, []);
  useEffect(() => { choisies.forEach(p => lire(p.id)); }, [choisies.length, lire]); // eslint-disable-line react-hooks/exhaustive-deps
  // suivi des tâches actives, puis mise à jour des pièces à la fin
  useEffect(() => {
    const actives = Object.entries(taches).filter(([, t]) => t && TACHE_ACTIVE.includes(t.etat));
    if (!actives.length) return undefined;
    const h = setTimeout(async () => {
      for (const [pid, t] of actives) {
        const r = await api(`/api/taches/${t.id}`);
        if (r.ok) {
          setTaches(v => ({ ...v, [pid]: r.tache }));
          if (!TACHE_ACTIVE.includes(r.tache.etat)) { annoncer(x.approfondissement.etats[r.tache.etat]); const n = await recharger(); if (n.ok) setPieces(n.pieces); }
        }
      }
    }, 3000);
    return () => clearTimeout(h);
  }, [taches, recharger, setPieces, x]);
  async function lancer(p) {
    setErreurs(v => ({ ...v, [p.id]: '' }));
    const r = await api(`/api/pieces/${p.id}/approfondir`, { method: 'POST', corps: { langue: lang } });
    if (!r.ok) { setErreurs(v => ({ ...v, [p.id]: x.erreurs[r.erreur] || x.erreurs.generique })); return; }
    setTaches(v => ({ ...v, [p.id]: r.tache }));
  }
  async function arreter(p) {
    const r = await api(`/api/taches/${taches[p.id].id}`, { method: 'DELETE' });
    if (r.ok) setTaches(v => ({ ...v, [p.id]: r.tache }));
  }
  if (!approfondissement.actif) return <p className="avis avis--note">{x.approfondissement.indisponible}</p>;
  return (
    <>
      {approfondissement.simulation && <p className="avis avis--note">{x.approfondissement.simulation}</p>}
      {choisies.map(p => {
        const tache = taches[p.id], active = tache && TACHE_ACTIVE.includes(tache.etat);
        return (
          <section key={p.id} className="carte parcours__piece">
            <h3>{p.nom}</h3>
            {tache && <p className="discret" role="status">{active && <Rouage />} {x.approfondissement.etats[tache.etat]}
              {active && tache.progression ? ` (${tache.progression.etape}/${tache.progression.total})` : ''}
              {tache.etat === 'fini' && tache.resultat?.obsolete ? ' ' + x.approfondissement.obsolete : ''}
              {tache.etat === 'fini' && tache.resultat?.rapport ? ' ' + x.approfondissement.rapport(tache.resultat.rapport) : ''}
              {['erreur', 'annule'].includes(tache.etat) && tache.credits ? ' ' + x.approfondissement.rembourse : ''}</p>}
            {erreurs[p.id] && <p className="avis avis--alerte">{erreurs[p.id]}</p>}
            {active ? <button type="button" className="btn btn--clair btn--petit" onClick={() => arreter(p)}>{x.approfondissement.arreter}</button>
              : <button type="button" className="btn btn--plein btn--petit" onClick={() => lancer(p)}>{x.approfondissement.lancer} · {approfondissement.credits} {x.credits}</button>}
          </section>
        );
      })}
    </>
  );
}
