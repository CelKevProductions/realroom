'use client';
// Démo privée ReSpace dans l'atelier et le parcours : le code d'accès (gardé dans ce navigateur)
// et l'état du serveur. Avec le code, chaque « Aménager » fait poser les meubles par ReSpace.
// Invisible quand la démo n'existe pas (production, Maison Corleone).
import { useEffect, useState } from 'react';
import { api } from '@/components/api.js';
import { codeRespace, garderCodeRespace, suivreCodeRespace } from '@/components/respace.js';
import { Rouage } from '@/components/mouvement/Attente.js';

const enDemo = () => /^\/[a-z]{2}\/demo(\/|$)/.test(location.pathname);

export function useCodeRespace() {
  const [code, setCode] = useState('');
  useEffect(() => { const lireCode = () => setCode(codeRespace()); lireCode(); return suivreCodeRespace(lireCode); }, []);
  return code;
}

const ETATS = {
  fr: { pret: 'ReSpace est prêt : il pose tous les meubles à chaque « Aménager ».',
    demarrage: 'ReSpace se réveille, cela peut prendre quelques minutes. En attendant, le moteur RealRoom place les meubles.',
    indisponible: 'ReSpace ne répond pas : le moteur RealRoom place les meubles. Vérifie que ton serveur Hugging Face est allumé.',
    inconnu: 'Vérification du serveur ReSpace…' },
  en: { pret: 'ReSpace is ready: it places every piece each time you arrange.',
    demarrage: 'ReSpace is waking up, this can take a few minutes. Meanwhile the RealRoom engine places the furniture.',
    indisponible: 'ReSpace is not answering: the RealRoom engine places the furniture.',
    inconnu: 'Checking the ReSpace server…' }
};

// Phrase à afficher après un « Aménager » (réponse.respace) ; vide si ReSpace n'a pas été demandé.
export function messageRespace(respace, lang) {
  if (!respace) return '';
  const fr = lang !== 'en';
  if (respace.places != null) {
    const reste = respace.total - respace.places;
    return fr ? `ReSpace a posé ${respace.places} meuble${respace.places > 1 ? 's' : ''} sur ${respace.total} dans la pièce vide.${reste ? ` ${reste > 1 ? 'Les autres gardent' : 'Le dernier garde'} la place du moteur.` : ''}`
      : `ReSpace placed ${respace.places} of ${respace.total} pieces in the empty room.${reste ? ' The others keep the engine’s spot.' : ''}`;
  }
  if (respace.erreur === 'respace-code') garderCodeRespace('');
  const cause = {
    'respace-code': fr ? 'Code ReSpace incorrect' : 'Wrong ReSpace code',
    limite: fr ? 'ReSpace a atteint sa limite pour cette heure' : 'ReSpace hit its hourly limit',
    'respace-demarrage': fr ? 'ReSpace se réveille encore' : 'ReSpace is still waking up',
    'respace-indisponible': fr ? 'ReSpace ne répond pas' : 'ReSpace is not answering',
    'respace-aucun': fr ? 'ReSpace n’a trouvé aucune place valable' : 'ReSpace found no valid spot',
    'respace-acces': fr ? 'Le serveur ReSpace refuse le jeton d’accès' : 'The ReSpace server refuses the token'
  }[respace.erreur];
  if (respace.erreur === 'respace-inactif') return '';
  return (cause || (fr ? 'ReSpace n’a pas pu poser les meubles' : 'ReSpace could not place the furniture')) + (fr ? ' : le moteur RealRoom a placé les meubles.' : ': the RealRoom engine placed the furniture.');
}

export default function AccesRespace({ lang }) {
  const fr = lang !== 'en', code = useCodeRespace();
  const [actif, setActif] = useState(false), [etat, setEtat] = useState('inconnu');
  const [saisie, setSaisie] = useState(''), [erreur, setErreur] = useState('');
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
      <p className="respace-acces__texte">{fr ? 'Avec le code, ReSpace part de la pièce vide et pose tous les meubles à chaque « Aménager ».' : 'With the code, ReSpace starts from the empty room and places every piece each time you arrange.'}</p>
      <div className="respace-acces__ligne">
        <input className="saisie" type="password" autoComplete="off" aria-label={fr ? 'Code d’accès ReSpace' : 'ReSpace access code'} placeholder={fr ? 'Code d’accès' : 'Access code'} value={saisie} onChange={e => setSaisie(e.target.value)} />
        <button type="submit" className="btn btn--clair btn--petit" disabled={!saisie.trim()}>{fr ? 'Activer' : 'Turn on'}</button>
      </div>
      {erreur && <p className="respace-acces__erreur" role="alert">{erreur}</p>}
    </form>
  );
  return (
    <div className={'respace-acces is-' + etat} role="status">
      <p className="respace-acces__titre">{etat === 'demarrage' || etat === 'inconnu' ? <Rouage /> : <span className="respace-acces__point" aria-hidden="true" />}ReSpace
        <button type="button" className="btn btn--lien btn--petit respace-acces__retirer" onClick={() => garderCodeRespace('')}>{fr ? 'Retirer le code' : 'Remove code'}</button>
      </p>
      <p className="respace-acces__texte">{textes[etat]}</p>
    </div>
  );
}
