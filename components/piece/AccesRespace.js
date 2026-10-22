'use client';
// Démo privée ReSpace dans l'atelier et le parcours : le code d'accès (gardé dans ce navigateur),
// l'état du serveur et le dernier bilan. Version « ReSpace seul » : avec le code, chaque
// « Aménager » fait poser les meubles par ReSpace, sans le moteur ; sans code, rien n'est lancé.
// Invisible quand la démo n'existe pas (production, Maison Corleone).
import { useEffect, useState } from 'react';
import { api } from '@/components/api.js';
import { codeRespace, garderCodeRespace, suivreCodeRespace, rapportRespace, suivreRapportRespace } from '@/components/respace.js';
import { Rouage } from '@/components/mouvement/Attente.js';

const enDemo = () => /^\/[a-z]{2}\/demo(\/|$)/.test(location.pathname);

export function useCodeRespace() {
  const [code, setCode] = useState('');
  useEffect(() => { const lireCode = () => setCode(codeRespace()); lireCode(); return suivreCodeRespace(lireCode); }, []);
  return code;
}

const ETATS = {
  fr: { pret: 'ReSpace est prêt : à chaque « Aménager », il pose seul tous les meubles, sans le moteur.',
    demarrage: 'ReSpace se réveille, cela peut prendre quelques minutes. Attends qu’il soit prêt avant d’aménager.',
    indisponible: 'ReSpace ne répond pas. Vérifie que ton serveur Hugging Face est allumé.',
    inconnu: 'Vérification du serveur ReSpace…' },
  en: { pret: 'ReSpace is ready: each time you arrange, it places every piece alone, without the engine.',
    demarrage: 'ReSpace is waking up, this can take a few minutes. Wait until it is ready.',
    indisponible: 'ReSpace is not answering. Check that your Hugging Face server is on.',
    inconnu: 'Checking the ReSpace server…' }
};

// Phrase à afficher après un « Aménager » réussi (réponse.respace) ; vide si ReSpace n'a pas été demandé.
export function messageRespace(respace, lang) {
  if (!respace || respace.places == null) return '';
  const fr = lang !== 'en', n = respace.places, rates = respace.nonPoses || [];
  return fr ? `ReSpace a posé seul ${n} meuble${n > 1 ? 's' : ''} sur ${respace.total}, sans aucune retouche du moteur.${rates.length ? ` Retiré${rates.length > 1 ? 's' : ''} faute de réponse lisible : ${rates.join(', ')}.` : ''}`
    : `ReSpace alone placed ${n} of ${respace.total} pieces, with no engine correction.${rates.length ? ` Removed (no readable answer): ${rates.join(', ')}.` : ''}`;
}

// Erreur d'un « Aménager » par ReSpace : la pièce n'a pas changé. Vide si l'erreur ne vient pas de ReSpace.
export function erreurRespace(e, lang) {
  const fr = lang !== 'en', code = e?.erreur;
  const cause = {
    'respace-sans-code': fr ? 'Dans cette version, c’est ReSpace qui aménage : entre d’abord le code d’accès sur la carte « ReSpace »' : 'In this version ReSpace does the layout: enter the access code on the “ReSpace” card first',
    'respace-code': fr ? 'Code ReSpace incorrect' : 'Wrong ReSpace code',
    'respace-inactif': fr ? 'ReSpace n’est pas configuré sur cette version (variables RESPACE_… absentes sur Vercel)' : 'ReSpace is not configured on this version',
    'respace-demarrage': fr ? 'Le serveur ReSpace se réveille encore. Réessaie dans quelques minutes' : 'The ReSpace server is still waking up. Try again in a few minutes',
    'respace-indisponible': fr ? 'ReSpace ne répond pas. Vérifie que ton serveur Hugging Face est allumé' : 'ReSpace is not answering. Check your Hugging Face server',
    'respace-acces': fr ? 'Le serveur ReSpace refuse le jeton d’accès (RESPACE_JETON)' : 'The ReSpace server refuses the access token',
    'respace-aucun': fr ? 'ReSpace n’a rendu aucune position lisible' : 'ReSpace returned no readable position'
  }[code];
  if (!cause) return '';
  const detail = e.message && e.message !== code ? ` (${e.message})` : '';
  return cause + detail + (code === 'respace-sans-code' ? '.' : fr ? '. La pièce n’a pas changé.' : '. The room did not change.');
}

export default function AccesRespace({ lang }) {
  const fr = lang !== 'en', code = useCodeRespace();
  const [actif, setActif] = useState(false), [etat, setEtat] = useState('inconnu');
  const [saisie, setSaisie] = useState(''), [erreur, setErreur] = useState('');
  const [rapport, setRapport] = useState(null);
  useEffect(() => { const lire = () => setRapport(rapportRespace()); lire(); return suivreRapportRespace(lire); }, []);
  const bilan = rapport && (rapport.erreur ? erreurRespace(rapport, lang) : messageRespace(rapport, lang));
  // la démo existe-t-elle ? (sans code, sans réveiller le serveur GPU)
  useEffect(() => {
    if (location.pathname.includes('/maison-corleone')) return;
    let fini = false;
    (enDemo() ? api('/api/demo/respace', { method: 'POST', corps: { action: 'actif' } }) : api('/api/respace/etat?sonde=1'))
      .then(r => { if (!fini) setActif(!!(r.ok && r.actif)); });
    return () => { fini = true; };
  }, []);
  // avec le code : état du serveur (le demander le réveille s'il est en veille)
  useEffect(() => {
    if (!actif || !code) return undefined;
    let fini = false, minuterie;
    setEtat('inconnu');
    const verifier = async () => {
      const r = enDemo() ? await api('/api/demo/respace', { method: 'POST', corps: { code, action: 'etat' } }) : await api('/api/respace/etat');
      if (fini) return;
      if (r.erreur === 'respace-code' || r.erreur === 'limite') {
        setErreur(r.erreur === 'limite' ? (fr ? 'Trop d’essais pour l’instant. Réessaie dans une heure.' : 'Too many tries. Try again in an hour.') : (fr ? 'Code d’accès incorrect.' : 'Wrong access code.'));
        garderCodeRespace(''); return;
      }
      const e = r.etat || 'indisponible';
      setEtat(ETATS.fr[e] ? e : 'indisponible');
      if (e === 'demarrage') minuterie = setTimeout(verifier, 15000);
    };
    verifier();
    return () => { fini = true; clearTimeout(minuterie); };
  }, [actif, code, fr]);

  if (!actif) return null;
  const textes = ETATS[fr ? 'fr' : 'en'];
  if (!code) return (
    <form className="respace-acces" onSubmit={e => { e.preventDefault(); if (saisie.trim()) { setErreur(''); garderCodeRespace(saisie.trim()); setSaisie(''); } }}>
      <p className="respace-acces__titre"><span className="respace-acces__point" aria-hidden="true" />ReSpace <span className="discret">· {fr ? 'démo privée' : 'private demo'}</span></p>
      <p className="respace-acces__texte">{fr ? 'Version « ReSpace seul » : ReSpace part de la pièce vide et pose tous les meubles, sans le moteur. Sans le code, « Aménager » ne se lance pas.' : '“ReSpace alone” version: ReSpace starts from the empty room and places every piece, without the engine. Without the code, arranging does not start.'}</p>
      <div className="respace-acces__ligne">
        <input className="saisie" type="password" autoComplete="off" aria-label={fr ? 'Code d’accès ReSpace' : 'ReSpace access code'} placeholder={fr ? 'Code d’accès' : 'Access code'} value={saisie} onChange={e => setSaisie(e.target.value)} />
        <button type="submit" className="btn btn--clair btn--petit" disabled={!saisie.trim()}>{fr ? 'Activer' : 'Turn on'}</button>
      </div>
      {(erreur || rapport?.erreur && bilan) && <p className="respace-acces__erreur" role="alert">{erreur || bilan}</p>}
    </form>
  );
  return (
    <div className={'respace-acces is-' + etat} role="status">
      <p className="respace-acces__titre">{etat === 'demarrage' || etat === 'inconnu' ? <Rouage /> : <span className="respace-acces__point" aria-hidden="true" />}ReSpace
        <button type="button" className="btn btn--lien btn--petit respace-acces__retirer" onClick={() => garderCodeRespace('')}>{fr ? 'Retirer le code' : 'Remove code'}</button>
      </p>
      <p className="respace-acces__texte">{textes[etat]}</p>
      {bilan && <p className={rapport.erreur ? 'respace-acces__erreur' : 'respace-acces__texte'} role={rapport.erreur ? 'alert' : undefined}>{fr ? 'Dernier essai : ' : 'Last try: '}{bilan}</p>}
    </div>
  );
}
