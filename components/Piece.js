'use client';
// Une pièce : photos et mesures -> analyse (maquette 3D) -> atelier (aménager, meubles, résultat).
// Avant l'atelier, les trois étapes sont tracées comme une cote sur un plan.
import { useEffect, useRef, useState } from 'react';
import { api } from '@/components/api.js';
import { useRacine } from '@/components/chemins.js';
import { useFil } from '@/components/fil.js';
import { Titre, useEntree } from '@/components/Mouvement.js';
import Croquis from '@/components/Croquis.js';
import Photos from '@/components/piece/Photos.js';
import Atelier from '@/components/piece/Atelier.js';
import PlanPiece from '@/components/piece/PlanPiece.js';

export default function Piece({ lang, t, initiale, rendusInitiaux, credits, couts, services }) {
  const tp = t.piece;
  const racine = useRacine(lang);
  const [piece, setPiece] = useState(initiale);
  const [rendus, setRendus] = useState(rendusInitiaux);
  const [solde, setSolde] = useState(credits);
  const [forcerPhotos, setForcerPhotos] = useState(false);
  const [planImporte, setPlanImporte] = useState(false);
  const [analyse, setAnalyse] = useState(initiale.etat === 'analyse');
  // analyse lancée ailleurs (autre onglet, page quittée puis rouverte) : on suit son état
  const [suivi, setSuivi] = useState(initiale.etat === 'analyse');
  const [erreur, setErreur] = useState(initiale.etat === 'erreur' ? t.erreurs.generique : '');
  const page = useRef(null);
  useFil([
    { nom: t.projets.titre, href: racine },
    { nom: piece.projet_nom, href: `${racine}/projets/${piece.projet_id}` },
    { nom: piece.nom }
  ]);
  useEffect(() => { dispatchEvent(new CustomEvent('realroom:credits', { detail: solde })); }, [solde]);
  useEffect(() => {
    if (!suivi) return;
    let arret = false, h;
    const tour = async () => {
      const r = await api(`/api/pieces/${piece.id}`);
      if (arret) return;
      if (r.ok && r.piece.etat !== 'analyse') {
        setSuivi(false); setAnalyse(false); setPiece(r.piece);
        if (r.piece.etat === 'erreur') setErreur(t.erreurs.generique);
        return;
      }
      h = setTimeout(tour, 4000);
    };
    h = setTimeout(tour, 4000);
    return () => { arret = true; clearTimeout(h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suivi]);

  async function analyser() {
    setErreur(''); setAnalyse(true);
    const r = await api(`/api/pieces/${piece.id}/analyse`, { method: 'POST', corps: { langue: lang } });
    if (r.erreur === 'en-cours') { setSuivi(true); return; }
    setAnalyse(false);
    if (!r.ok) { setErreur(r.erreur === 'limite' ? t.connexion.erreurs.limite : t.erreurs.generique); return; }
    setPiece(r.piece);
    setForcerPhotos(false);
  }
  const etape = analyse ? 1 : !piece.modele || forcerPhotos ? 0 : 1;
  const enAtelier = !analyse && piece.modele && !forcerPhotos;
  useEntree(page, enAtelier ? 'atelier' : analyse ? 'analyse' : 'photos');

  if (enAtelier) {
    return (
      <><Atelier lang={lang} t={t} piece={piece} setPiece={setPiece} rendus={rendus} setRendus={setRendus} solde={solde} setSolde={setSolde} couts={couts} services={services}
        retourPhotos={() => setForcerPhotos(true)} />
        {planImporte && <PlanPiece modele={piece.modele} items={piece.agencement || []} produits={{}} lang={lang} onFermer={() => setPlanImporte(false)} onSauver={async geometrie => {
          const r = await api(`/api/pieces/${piece.id}`, { method: 'PATCH', corps: { geometrie } });
          if (!r.ok) return false; setPiece(r.piece); return true;
        }} />}</>
    );
  }
  return (
    <div className="conteneur app-page" ref={page}>
      <header className="piece-tete">
        <div className="piece-tete__ligne">
          <Titre>{piece.nom}</Titre>
          {t.fonctions[piece.fonction] !== piece.nom && <span className="piece-tete__fonction" data-entree="">{t.fonctions[piece.fonction]}</span>}
        </div>
        <ol className="cote-etapes" data-entree="trait">
          {tp.etapes.map((e, i) => (
            <li key={e} style={{ '--i': i }} className={i < etape ? 'is-fait' : i === etape ? 'is-actif' : undefined} aria-current={i === etape ? 'step' : undefined}>
              <span className="cote-etapes__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="cote-etapes__nom">{e}</span>
              {i === tp.etapes.length - 1 && <span className="cote-etapes__fin" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </header>
      {erreur && !analyse && <p className="avis avis--alerte piece-erreur">{erreur}</p>}
      {analyse ? (
        <div className="attente" data-entree="">
          <Croquis trace />
          <h2>{tp.analyseEnCours}</h2>
          <p className="discret">{tp.analyseDuree}</p>
        </div>
      ) : (
        <Photos lang={lang} t={t} piece={piece} setPiece={setPiece} analyser={analyser} attente={analyse || !services.analyse}
          onImport={() => { setForcerPhotos(false); setPlanImporte(true); }} onOuvrir={() => setForcerPhotos(false)} />
      )}
    </div>
  );
}
