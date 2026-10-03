'use client';
// Connexion en deux temps : l'adresse e-mail, puis le code reçu (6 chiffres).
// Le titre à gauche, le formulaire à droite ; une seule action à la fois.
import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/components/api.js';
import { Titre, useEntree, apparaitre } from '@/components/Mouvement.js';

export default function Connexion({ lang, t, liens }) {
  const params = useSearchParams();
  const inscription = params.get('inscription') === '1';
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [etape, setEtape] = useState('email');
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState('');
  const [codeEssai, setCodeEssai] = useState('');
  const page = useRef(null);
  const formulaire = useRef(null);
  const champCode = useRef(null);
  useEntree(page);
  useEffect(() => {
    if (etape !== 'code') return;
    apparaitre(formulaire.current);
    if (champCode.current) champCode.current.focus();
  }, [etape]);

  async function envoyer(e) {
    e.preventDefault();
    setErreur(''); setAttente(true);
    const r = await api('/api/auth/code', { method: 'POST', corps: { email, langue: lang } });
    setAttente(false);
    if (!r.ok) { setErreur(t.erreurs[r.erreur] || t.erreurs.envoi); return; }
    if (r.code) setCodeEssai(r.code); // essais sans service d'e-mail
    setEtape('code');
  }
  async function verifier(e) {
    e.preventDefault();
    setErreur(''); setAttente(true);
    const r = await api('/api/auth/verifier', { method: 'POST', corps: { email, code, langue: lang } });
    if (!r.ok) { setAttente(false); setErreur(t.erreurs[r.erreur] || t.erreurs.code); return; }
    document.cookie = 'rr_langue=' + lang + ';path=/;max-age=31536000;samesite=lax';
    const suite = params.get('suite');
    // chargement complet : toute la page repart avec la session ouverte
    location.assign(suite && suite.startsWith('/' + lang + '/app') ? suite : `/${lang}/app`);
  }
  const cgu = t.cgu.split(/(conditions de vente|terms of sale|politique de confidentialité|privacy policy)/).map((m, i) =>
    /conditions de vente|terms of sale/.test(m) ? <a key={i} href={liens.cgv}>{m}</a> : /confidentialité|privacy/.test(m) ? <a key={i} href={liens.confidentialite}>{m}</a> : m);

  return (
    <div className="page-connexion" ref={page}>
      <div className="page-connexion__titre">
        <Titre>{inscription ? t.titreInscription : t.titre}</Titre>
        <p data-entree="">{inscription ? t.introInscription : t.intro}</p>
      </div>
      <div className="page-connexion__form" ref={formulaire} data-entree="">
        {etape === 'email' ? (
          <form onSubmit={envoyer} className="formulaire">
            <label className="champ">
              <span>{t.email}</span>
              <input className="saisie" type="email" name="email" autoComplete="email" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            {erreur && <p className="avis avis--alerte" role="alert">{erreur}</p>}
            <button className="btn btn--plein btn--large btn--bloc" disabled={attente}>{attente ? <span className="rouage rouage--petit" /> : t.envoyer}</button>
          </form>
        ) : (
          <form onSubmit={verifier} className="formulaire">
            <p className="avis avis--ok">{t.envoye.replace('{email}', email)}</p>
            {codeEssai && <p className="avis" data-code-essai={codeEssai}>Code (essai) : <b className="chiffre">{codeEssai}</b></p>}
            <label className="champ">
              <span>{t.code}</span>
              <input ref={champCode} className="saisie saisie--code" name="code" autoComplete="one-time-code" inputMode="numeric" pattern="\d{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </label>
            {erreur && <p className="avis avis--alerte" role="alert">{erreur}</p>}
            <button className="btn btn--plein btn--large btn--bloc" disabled={attente || code.length !== 6}>{attente ? <span className="rouage rouage--petit" /> : t.verifier}</button>
            <div className="formulaire__bas">
              <button type="button" className="btn btn--lien" onClick={() => { setEtape('email'); setCode(''); setErreur(''); }}>{t.autreEmail}</button>
              <button type="button" className="btn btn--lien" onClick={envoyer}>{t.renvoyer}</button>
            </div>
          </form>
        )}
        <p className="formulaire__cgu">{cgu}</p>
      </div>
    </div>
  );
}
