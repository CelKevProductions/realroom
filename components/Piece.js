'use client';
// Une pièce : photos et mesures -> analyse (maquette 3D) -> atelier (aménager, rendu, visite 3D)
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/components/api.js';
import Photos from '@/components/piece/Photos.js';
import Atelier from '@/components/piece/Atelier.js';

export default function Piece({ lang, t, initiale, rendusInitiaux, credits, couts, services }) {
  const tp = t.piece;
  const [piece, setPiece] = useState(initiale);
  const [rendus, setRendus] = useState(rendusInitiaux);
  const [solde, setSolde] = useState(credits);
  const [forcerPhotos, setForcerPhotos] = useState(false);
  const [analyse, setAnalyse] = useState(initiale.etat === 'analyse');
  const [erreur, setErreur] = useState(initiale.etat === 'erreur' ? t.erreurs.generique : '');

  async function analyser() {
    setErreur(''); setAnalyse(true);
    const r = await api(`/api/pieces/${piece.id}/analyse`, { method: 'POST', corps: { langue: lang } });
    setAnalyse(false);
    if (!r.ok) { setErreur(r.erreur === 'limite' ? t.connexion.erreurs.limite : t.erreurs.generique); return; }
    setPiece(r.piece);
    setForcerPhotos(false);
  }
  const etape = analyse ? 1 : !piece.modele || forcerPhotos ? 0 : 1;
  const enAtelier = !analyse && piece.modele && !forcerPhotos;

  return (
    <>
      <div className="conteneur" style={{ width: 'min(1400px, 100% - 24px)', paddingTop: 14 }}>
        <nav className="fil" aria-label="fil">
          <Link href={`/${lang}/app`}>{t.projets.titre}</Link><span>›</span>
          <Link href={`/${lang}/app/projets/${piece.projet_id}`}>{piece.projet_nom}</Link><span>›</span>
          <span style={{ color: 'var(--encre)', fontWeight: 600 }}>{piece.nom}</span>
          <span className="puce" style={{ marginLeft: 6 }}>{t.fonctions[piece.fonction]}</span>
        </nav>
        {!enAtelier && (
          <ol className="etapes-piece" style={{ marginTop: 14 }}>
            {tp.etapes.map((e, i) => <li key={e} aria-current={i === etape ? 'step' : undefined}>{i + 1}. {e}</li>)}
          </ol>
        )}
      </div>
      {erreur && !analyse && <div className="conteneur" style={{ maxWidth: 980 }}><p className="avis avis--alerte">{erreur}</p></div>}
      {analyse ? (
        <div className="attente conteneur">
          <span className="rouage" />
          <h2 style={{ fontSize: '1.5rem' }}>{tp.analyseEnCours}</h2>
          <p className="discret">{tp.analyseDuree}</p>
        </div>
      ) : enAtelier ? (
        <Atelier lang={lang} t={t} piece={piece} setPiece={setPiece} rendus={rendus} setRendus={setRendus} solde={solde} setSolde={setSolde} couts={couts} services={services}
          retourPhotos={() => setForcerPhotos(true)} />
      ) : (
        <Photos lang={lang} t={t} piece={piece} setPiece={setPiece} analyser={analyser} attente={analyse || !services.analyse} />
      )}
    </>
  );
}
