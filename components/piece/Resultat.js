'use client';
// Résultat : rendu photo réaliste (fal.ai) puis visite 3D (Marble), avec suivi et avertissement
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/components/api.js';
import { useRacine } from '@/components/chemins.js';
import AvantApres from '@/components/piece/AvantApres.js';
import { remplir } from '@/lib/i18n.js';

export default function Resultat({ lang, t, piece, rendus, setRendus, solde, setSolde, couts, services, capturer }) {
  const tp = t.piece;
  const racine = useRacine(lang);
  const images = rendus.filter(r => r.type === 'image');
  const [choisi, setChoisi] = useState(() => (images.find(r => r.etat === 'fini') || {}).id);
  const [erreur, setErreur] = useState('');
  const photo = (piece.photos || []).find(p => p.role === 'entree');
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
        if (s.etat === 'erreur') setErreur(t.erreurs.generique);
        const m = await api('/api/moi');
        if (m.ok && m.connecte) setSolde(m.credits);
      }
      if (!arret) h = setTimeout(tour, delai);
    };
    h = setTimeout(tour, delai);
    return () => { arret = true; clearTimeout(h); };
  }, [enCours.map(r => r.id).join()]);

  async function generer(type, rendu) {
    setErreur('');
    const cout = type === 'monde' ? couts.monde : couts.rendu;
    if (solde < cout) { setErreur(tp.creditsManquants); return; }
    let corps = { type };
    if (type === 'image') {
      // capture de la maquette au format de la vraie photo
      const ratio = photo && photo.largeur && photo.hauteur ? photo.largeur / photo.hauteur : 4 / 3;
      const largeur = ratio >= 1 ? 1536 : Math.round(1536 * ratio), hauteur = ratio >= 1 ? Math.round(1536 / ratio) : 1536;
      const capture = capturer({ largeur, hauteur });
      if (!capture) { setErreur(t.erreurs.generique); return; }
      corps.capture = capture;
    } else corps.rendu = rendu;
    const r = await api(`/api/pieces/${piece.id}/rendus`, { method: 'POST', corps });
    if (!r.ok) { setErreur(r.erreur === 'credits' ? tp.creditsManquants : r.message && r.statut === 503 ? r.message : t.erreurs.generique); return; }
    setSolde(s => s - cout);
    setRendus(l => [{ id: r.id, type, etat: 'en_cours', credits: cout, resultat: null, cree_le: new Date().toISOString(), source: rendu || null }, ...l]);
  }

  const actuel = images.find(r => r.id === choisi) || images.find(r => r.etat === 'fini');
  const mondes = rendus.filter(r => r.type === 'monde');
  const imageEnCours = enCours.find(r => r.type === 'image');
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="bloc__tete"><h3>{tp.renduTitre}</h3><p className="discret petit">{tp.renduTexte}</p></div>
      {!services.rendu && <p className="avis">{t.erreurs.generique}</p>}
      <button className="btn btn--accent btn--bloc" onClick={() => generer('image')} disabled={!services.rendu || !!imageEnCours}>
        {imageEnCours ? <><span className="rouage rouage--petit" /> {tp.renduEnCours}</> : <>{tp.generer} · {remplir(tp.coute, { n: couts.rendu, s: couts.rendu > 1 ? 's' : '' })}</>}
      </button>
      {erreur && <p className="avis avis--alerte">{erreur} {erreur === tp.creditsManquants && <Link href={`${racine}/compte`}>{tp.acheterCredits}</Link>}</p>}
      {actuel && actuel.etat === 'fini' && actuel.resultat && (
        <>
          {photo ? <AvantApres avant={photo.url} apres={actuel.resultat.image} libelles={{ avant: tp.avant, apres: tp.apres }} etiquette="IA" /> : <img src={actuel.resultat.image} alt="" style={{ borderRadius: 12 }} />}
          <p className="avis petit">{tp.avertissement}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a className="btn btn--clair btn--petit" href={actuel.resultat.image} download={`realroom-${piece.nom}.jpg`}>{tp.telecharger}</a>
          </div>
          <div className="bloc__tete" style={{ marginTop: 8 }}><h3>{tp.mondeTitre}</h3><p className="discret petit">{tp.mondeTexte}</p></div>
          {(() => {
            const m = mondes.find(x => x.source === actuel.id);
            if (m && m.etat === 'en_cours') return <p className="avis"><span className="rouage rouage--petit" style={{ display: 'inline-block', verticalAlign: 'middle' }} /> {tp.mondeEnCours}</p>;
            if (m && m.etat === 'fini' && m.resultat && m.resultat.monde) {
              const w = m.resultat.monde;
              return w.url ? <a className="btn btn--plein btn--bloc" href={w.url} target="_blank" rel="noopener noreferrer">{tp.ouvrirMonde} ↗</a> : <p className="avis avis--ok">{tp.mondeTitre} (simulation)</p>;
            }
            return <button className="btn btn--clair btn--bloc" onClick={() => generer('monde', actuel.id)} disabled={!services.monde}>{tp.genererMonde} · {remplir(tp.coute, { n: couts.monde, s: couts.monde > 1 ? 's' : '' })}</button>;
          })()}
        </>
      )}
      {images.filter(r => r.etat === 'fini').length > 1 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <span className="petit discret">{tp.historique}</span>
          <div className="vignettes">
            {images.filter(r => r.etat === 'fini').map(r => (
              <button key={r.id} aria-pressed={r.id === (actuel && actuel.id)} onClick={() => setChoisi(r.id)}><img src={r.resultat.image} alt="" /></button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
