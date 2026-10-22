'use client';
// Démo privée ReSpace : une proposition ReSpace s'ajoute aux propositions de l'assistant
// (à côté de celles de Shuffle) ; on la compare ensuite dans l'atelier.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/api.js';
import { useEntree } from '@/components/Mouvement.js';
import { Rouage } from '@/components/mouvement/Attente.js';
import { useApparition } from '@/components/mouvement/react.js';
import { annoncer } from '@/components/mouvement/regles.js';
import { MiniPlan } from '@/components/piece/Variantes.js';
import { chargerCatalogue } from '@/components/catalogueClient.js';
import { lire, ecrire, piece as pieceDemo, projet as projetDemo } from '@/components/demo/magasin.js';
import { TYPES_PROGRAMME } from '@/lib/programme.js';
import { etatVariantes } from '@/lib/variation-disposition.js';
import { codeRespace, garderCodeRespace } from '@/components/respace.js';

const ETATS = { pret: 'Le serveur ReSpace est prêt.', demarrage: 'Le serveur ReSpace sort de veille. Cela peut prendre quelques minutes.',
  indisponible: 'Le serveur ReSpace ne répond pas.', inactif: 'La démo ReSpace n’est pas configurée.', inconnu: 'Vérification du serveur…',
  code: 'Entre le code d’accès : le serveur n’est vérifié (et réveillé) qu’avec lui.' };
const ERREURS = { 'respace-code': 'Code d’accès incorrect.', limite: 'Trop d’essais pour l’instant. Réessaie dans une heure.',
  'assistant-obsolete': 'Lance d’abord une première proposition dans l’atelier, puis reviens ici.',
  'respace-aucun': 'ReSpace n’a placé aucun meuble de façon valable dans cette pièce. La proposition actuelle est inchangée.',
  'respace-demarrage': 'Le serveur sort de veille. Réessaie dans un moment.', 'respace-acces': 'Le serveur ReSpace refuse le jeton d’accès.',
  'amenagement-conflit': 'La pièce a changé pendant le calcul. Recharge la page.' };
const secondes = ms => (ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' s';

// Démo sans compte : les pièces viennent du navigateur (magasin de la démo), le serveur ne garde rien.
const piecesDeLaDemo = () => {
  const e = lire();
  return e.pieces.filter(p => p.modele && TYPES_PROGRAMME.includes(p.fonction)).map(p => {
    const c = etatVariantes(p);
    return { id: p.id, nom: p.nom, projet: projetDemo(p.projet_id)?.nom || '', modele: p.modele, agencement: p.agencement || [], prete: !!c && !c.obsolete, variantes: c?.etat.liste.length || 0 };
  });
};
export function DemoRespaceNavigateur({ lang }) {
  const [donnees, setDonnees] = useState(null);
  useEffect(() => { chargerCatalogue().then(c => setDonnees({ pieces: piecesDeLaDemo(), produits: c.produits })).catch(() => setDonnees({ pieces: piecesDeLaDemo(), produits: {} })); }, []);
  if (!donnees) return <div className="attente"><Rouage /></div>;
  return <DemoRespace lang={lang} demo pieces={donnees.pieces} produits={donnees.produits} />;
}

export default function DemoRespace({ lang, pieces: initiales, produits, demo = false }) {
  const racine = demo ? `/${lang}/demo` : `/${lang}/app`;
  const page = useRef(null), resultat = useRef(null);
  const [code, setCode] = useState('');
  const [etat, setEtat] = useState('inconnu'), [detail, setDetail] = useState('');
  const [pieces, setPieces] = useState(initiales);
  const [enCours, setEnCours] = useState(null);
  const [retour, setRetour] = useState(null);
  useEntree(page);
  useApparition(resultat, retour?.n);

  // démo : le code n'est envoyé qu'au clic (un code tapé à moitié compterait comme un essai raté)
  const [codeSoumis, setCodeSoumis] = useState('');
  useEffect(() => { const c = codeRespace(); setCode(c); setCodeSoumis(c); }, []);
  // démo : l'état n'est demandé qu'avec un code (sinon un visiteur réveillerait le serveur GPU)
  const codeEtat = demo ? codeSoumis.trim() : '';
  useEffect(() => {
    if (demo && !codeEtat) { setEtat('code'); return; }
    let fini = false, minuterie;
    const verifier = async () => {
      const r = demo ? await api('/api/demo/respace', { method: 'POST', corps: { code: codeEtat, action: 'etat' } }) : await api('/api/respace/etat');
      if (fini) return;
      if (r.erreur === 'respace-code' || r.erreur === 'limite') {
        garderCodeRespace('');
        setEtat('code'); setRetour({ n: Date.now(), erreur: ERREURS[r.erreur] }); return;
      }
      if (codeEtat) garderCodeRespace(codeEtat);
      const e = r.etat || 'indisponible';
      setEtat(e); setDetail(e === 'indisponible' && r.detail ? String(r.detail) : '');
      if (e === 'demarrage') minuterie = setTimeout(verifier, 15000);
    };
    verifier();
    return () => { fini = true; clearTimeout(minuterie); };
  }, [demo, codeEtat]);

  async function proposer(p) {
    garderCodeRespace(code);
    setEnCours(p.id); setRetour(null);
    annoncer('ReSpace place les meubles de « ' + p.nom + ' ».');
    let r;
    if (demo) {
      const x = pieceDemo(p.id), revision = x?.maj_le;
      r = x ? await api('/api/demo/respace', { method: 'POST', corps: { code, piece: { fonction: x.fonction, modele: x.modele, agencement: x.agencement || [], proposition: x.proposition } } }) : { ok: false, erreur: 'introuvable' };
      if (r.ok) {
        if (pieceDemo(p.id) !== x || x.maj_le !== revision) r = { ok: false, erreur: 'amenagement-conflit' };
        else { ecrire(() => { x.agencement = r.agencement; x.proposition = r.proposition; x.maj_le = new Date().toISOString(); }); r = { ...r, piece: { agencement: r.agencement } }; }
      }
    } else r = await api(`/api/pieces/${p.id}/respace`, { method: 'POST', corps: { code } });
    setEnCours(null);
    if (!r.ok) {
      if (r.erreur === 'respace-demarrage') setEtat('demarrage');
      const texte = (ERREURS[r.erreur] || 'Erreur : ' + (r.erreur || r.statut)) + (r.erreur === 'respace-aucun' && r.message && r.message !== r.erreur ? ' (' + r.message + ')' : '');
      setRetour({ n: Date.now(), id: p.id, erreur: texte }); annoncer(texte); return;
    }
    const m = r.moteur, agencement = r.piece.agencement || [];
    setPieces(ps => ps.map(x => (x.id === p.id ? { ...x, agencement, variantes: x.variantes + 1 } : x)));
    const texte = `ReSpace a placé ${m.places} meubles sur ${m.total}. Les autres gardent la place proposée par le moteur.`;
    setRetour({ n: Date.now(), id: p.id, avant: p.agencement, apres: agencement, modele: p.modele, m, texte });
    annoncer(texte);
  }

  return (
    <div className="conteneur app-page app-page--etroite" ref={page}>
      <div className="app-page__tete">
        <h1 data-entree="">Démo ReSpace</h1>
      </div>
      <p className="avis avis--note app-page__avis" data-entree="">
        Démo privée et non commerciale. Les poids de ReSpace sont sous licence CC BY-NC-SA 4.0. Le moteur de RealRoom choisit les meubles ;
        ReSpace décide où les poser et comment les orienter ; le moteur vérifie ensuite chaque position.
      </p>
      <p className="etat" role="status" data-entree="">{etat === 'demarrage' && <Rouage />} {ETATS[etat]}{detail ? ` (${detail})` : ''}</p>
      <label className="champ" data-entree="">
        <span>Code d’accès</span>
        <input className="saisie" type="password" autoComplete="off" value={code} onChange={e => setCode(e.target.value)}
          onKeyDown={e => { if (demo && e.key === 'Enter') setCodeSoumis(code); }} />
      </label>
      {demo && <button className="btn btn--clair btn--petit" data-entree="" disabled={!code.trim() || code === codeSoumis && etat !== 'code'} onClick={() => setCodeSoumis(code)}>Vérifier le serveur</button>}
      {!pieces.length && <p className="vide" data-entree="">Aucune pièce avec un plan pour l’instant. Crée une pièce et relève son plan dans l’atelier.</p>}
      <ul className="liste-meubles" data-entree="">
        {pieces.map(p => (
          <li key={p.id} className="carte" style={{ padding: 16, marginBottom: 12 }}>
            <strong>{p.nom}</strong> <span className="discret">· {p.projet}</span>
            <div className="rangee" style={{ marginTop: 10, gap: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn--plein btn--petit" disabled={!p.prete || !code || etat !== 'pret' || !!enCours} onClick={() => proposer(p)}>
                {enCours === p.id ? <><Rouage /> ReSpace place les meubles…</> : 'Proposer avec ReSpace'}
              </button>
              <Link className="btn btn--clair btn--petit" href={`${racine}/pieces/${p.id}`}>Ouvrir dans l’atelier</Link>
              {!p.prete && <span className="discret">Lance d’abord une première proposition dans l’atelier.</span>}
            </div>
          </li>
        ))}
      </ul>
      <div ref={resultat} aria-live="polite">
        {retour?.erreur && <p className="avis avis--alerte">{retour.erreur}</p>}
        {retour?.m && (
          <div className="carte" style={{ padding: 16 }}>
            <p>{retour.texte}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <figure><MiniPlan modele={retour.modele} items={retour.avant} produits={produits} /><figcaption>Proposition affichée avant</figcaption></figure>
              <figure><MiniPlan modele={retour.modele} items={retour.apres} produits={produits} /><figcaption>Proposition ReSpace</figcaption></figure>
            </div>
            <p className="discret">
              {retour.m.mesures.appels} appels au modèle, médiane {secondes(retour.m.mesures.medianeAppelMs || 0)} par appel, {secondes(retour.m.mesures.dureeMs)} au total.
              {' '}{retour.m.mesures.illisibles} réponses illisibles, {retour.m.mesures.rejets} positions refusées par le moteur.
              {retour.m.mesures.orientation && ` Dos des meubles adossés à ${retour.m.mesures.orientation.dosMurMedianM} m du mur (médiane).`}
            </p>
            <p>La proposition est rangée avec les autres propositions de l’assistant : ouvre la pièce pour la comparer avec Shuffle et la choisir.</p>
          </div>
        )}
      </div>
    </div>
  );
}
