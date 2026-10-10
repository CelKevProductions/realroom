'use client';
// Résultat : rendu photo réaliste (fal.ai) puis visite 3D (Marble), avec suivi et avertissement.
// Pendant le rendu, la capture de la maquette reste à l'écran, balayée par un trait.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/components/api.js';
import { useRacine } from '@/components/chemins.js';
import AvantApres from '@/components/piece/AvantApres.js';
import Croquis from '@/components/Croquis.js';
import AnglesRendu from './AnglesRendu.js';
import { remplir } from '@/lib/i18n.js';

export default function Resultat({ lang, t, piece, rendus, setRendus, solde, setSolde, couts, services, capturer, onPhoto, setPiece }) {
  const tp = t.piece;
  const racine = useRacine(lang);
  const images = rendus.filter(r => r.type === 'image');
  const [choisi, setChoisi] = useState(() => (images.find(r => r.etat === 'fini') || {}).id);
  // erreur affichée près du bouton qui l'a déclenchée (rendu ou visite)
  const [erreur, setErreur] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [angle,setAngle]=useState('entree');
  const photo = (piece.photos || []).find(p => p.role === angle);
  const enCours = rendus.filter(r => r.etat === 'en_cours');

  // suivi des générations en cours : un tour après l'autre (jamais deux suivis du même rendu en même temps)
  useEffect(() => {
    if (!enCours.length) return;
    const delai = enCours.some(r => r.type === 'image') ? 2500 : 8000;
    let arret = false, h;
    const tour = async () => {
      for (const r of enCours) {
        const s = await api(`/api/rendus/${r.id}`);
        if (arret) return;
        if (!s.ok || s.etat === 'en_cours') continue;
        setRendus(l => l.map(x => (x.id === r.id ? { ...x, ...s } : x)));
        if (s.type === 'image' && s.etat === 'fini') setChoisi(s.id);
        if (s.etat === 'erreur') setErreur({ texte: t.erreurs.generique, de: s.type });
        const m = await api('/api/moi');
        if (m.ok && m.connecte) setSolde(m.credits);
      }
      if (!arret) h = setTimeout(tour, delai);
    };
    h = setTimeout(tour, delai);
    return () => { arret = true; clearTimeout(h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enCours.map(r => r.id).join()]);

  async function generer(type, rendu) {
    setErreur(null);
    const dire = texte => setErreur({ texte, de: type });
    const cout = type === 'monde' ? couts.monde : couts.rendu;
    if (solde < cout) { dire(tp.creditsManquants); return; }
    let corps = { type };
    if (type === 'image') {
      // capture de la maquette au format de la vraie photo
      const ratio = photo && photo.largeur && photo.hauteur ? photo.largeur / photo.hauteur : 4 / 3;
      const largeur = ratio >= 1 ? 1536 : Math.round(1536 * ratio), hauteur = ratio >= 1 ? Math.round(1536 / ratio) : 1536;
      const capture = capturer({ largeur, hauteur,angle });
      if (!capture) { dire(t.erreurs.generique); return; }
      corps.capture = capture;corps.angle=angle;
      setApercu(capture);
    } else corps.rendu = rendu;
    const r = await api(`/api/pieces/${piece.id}/rendus`, { method: 'POST', corps });
    if (!r.ok) { dire(r.erreur === 'credits' ? tp.creditsManquants : r.message && r.statut === 503 ? r.message : t.erreurs.generique); return; }
    setSolde(s => s - cout);
    setRendus(l => [{ id: r.id, type, angle: type === 'image' ? angle : null, etat: 'en_cours', credits: cout, resultat: null, cree_le: new Date().toISOString(), source: rendu || null }, ...l]);
  }

  const finis = images.filter(r => r.etat === 'fini' && r.resultat);
  const actuel = finis.find(r => r.id === choisi) || finis[0];
  const photoAvant = (piece.photos || []).find(p => p.role === (actuel?.angle || 'entree'));
  const mondes = rendus.filter(r => r.type === 'monde');
  const imageEnCours = enCours.find(r => r.type === 'image');
  const cout = n => remplir(tp.coute, { n, s: n > 1 ? 's' : '' });
  const monde = actuel && mondes.find(x => x.source === actuel.id);
  const avisErreur = erreur && (
    <p className="avis avis--alerte" role="alert">{erreur.texte} {erreur.texte === tp.creditsManquants && <Link href={`${racine}/compte`}>{tp.acheterCredits}</Link>}</p>
  );

  return (
    <>
      <div className="panneau__corps" role="tabpanel">
        <div className="bloc__tete"><h3>{tp.renduTitre}</h3><p>{tp.renduTexte}</p></div>
        <AnglesRendu lang={lang} piece={piece} onPiece={setPiece} angle={angle} setAngle={setAngle} capturer={capturer} disabled={!!imageEnCours}/>
        {!services.rendu && <p className="avis">{tp.renduIndispo}</p>}
        {!photo && <div className="avis"><p>{lang === 'en' ? 'Your metric plan is ready. Add a photo from this view for the final photo render; your scan will be kept.' : 'Votre plan métrique est prêt. Ajoutez une photo de cette vue pour le rendu photo final ; votre scan sera conservé.'}</p>
          <button type="button" className="btn btn--clair btn--petit" onClick={onPhoto}>{lang === 'en' ? 'Add the render photo' : 'Ajouter la photo du rendu'}</button></div>}
        {erreur && erreur.de === 'image' && avisErreur}
        {imageEnCours && (
          <div className="rendu-attente">
            {apercu ? <img src={apercu} alt="" /> : <Croquis trace />}
            <span className="rendu-attente__texte">{tp.renduEnCours}</span>
          </div>
        )}
        {!imageEnCours && actuel && (
          <>
            {photoAvant
              ? <AvantApres avant={photoAvant.url} apres={actuel.resultat.image} largeur={photoAvant.largeur||4} hauteur={photoAvant.hauteur||3} libelles={{ avant: tp.avant, apres: tp.apres }} etiquette="IA" />
              : <img className="rendu-seul" src={actuel.resultat.image} alt="" />}
            <p className="avis avis--note">{tp.avertissement}</p>
            <div className="rangee">
              <a className="btn btn--clair btn--petit" href={actuel.resultat.image} download={`realroom-${piece.nom}.jpg`}>{tp.telecharger}</a>
            </div>
          </>
        )}
        {finis.length > 1 && (
          <div className="champ">
            <span className="sous-titre">{tp.historique} <span className="chiffre">{finis.length}</span></span>
            <div className="vignettes">
              {finis.map(r => (
                <button key={r.id} aria-pressed={r.id === (actuel && actuel.id)} onClick={() => setChoisi(r.id)}><img src={r.resultat.image} alt="" /></button>
              ))}
            </div>
          </div>
        )}
        {!imageEnCours && actuel && (
          <div className="visite">
            <div className="bloc__tete"><h3>{tp.mondeTitre}</h3><p>{tp.mondeTexte}</p></div>
            {monde && monde.etat === 'en_cours' ? (
              <p className="avis"><span className="rouage rouage--petit" /> {tp.mondeEnCours}</p>
            ) : monde && monde.etat === 'fini' && monde.resultat && monde.resultat.monde ? (
              monde.resultat.monde.url
                ? <a className="btn btn--plein btn--bloc" href={monde.resultat.monde.url} target="_blank" rel="noopener noreferrer">{tp.ouvrirMonde}</a>
                : <p className="avis avis--ok">{tp.mondeTitre} (simulation)</p>
            ) : (
              <button className="btn btn--clair btn--bloc" onClick={() => generer('monde', actuel.id)} disabled={!services.monde}>
                {tp.genererMonde} <span className="cout">{cout(couts.monde)}</span>
              </button>
            )}
            {erreur && erreur.de === 'monde' && avisErreur}
          </div>
        )}
      </div>
      <div className="panneau__pied">
        <button className="btn btn--plein btn--large btn--bloc" onClick={() => generer('image')} disabled={!services.rendu || !!imageEnCours || !photo}>
          {imageEnCours ? <><span className="rouage rouage--petit" /> {tp.renduEnCours}</> : <>{tp.generer} <span className="cout">{cout(couts.rendu)}</span></>}
        </button>
      </div>
    </>
  );
}
