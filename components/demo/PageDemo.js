'use client';
// Pages de la démo : les composants de l'application, alimentés par le magasin du navigateur
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import Projets from '@/components/Projets.js';
import Projet from '@/components/Projet.js';
import Piece from '@/components/Piece.js';
import Compte from '@/components/Compte.js';
import Croquis from '@/components/Croquis.js';
import { useFil } from '@/components/fil.js';
import { lire, piece, publique, rendusDe, listeProjets, projetComplet } from '@/components/demo/magasin.js';

const SERVICES = { analyse: true, rendu: true, monde: true };

function Introuvable({ lang, t }) {
  useFil([{ nom: t.projets.titre, href: `/${lang}/demo` }, { nom: t.erreurs.introuvable }]);
  return (
    <div className="conteneur app-page">
      <p className="vide">{t.demo.introuvable}</p>
      <Link className="btn btn--clair" href={`/${lang}/demo`}>{t.demo.retour}</Link>
    </div>
  );
}

export default function PageDemo({ lang, t, vue, id, couts, packs }) {
  // le magasin vit dans le navigateur : rien à afficher côté serveur
  const [pret, setPret] = useState(false);
  useEffect(() => { lire(lang); setPret(true); }, [lang]);
  if (!pret) return <div className="attente"><Croquis trace /><p className="discret">{t.demo.chargement}</p></div>;

  if (vue === 'projets') return <Projets lang={lang} t={t} initiaux={listeProjets()} />;
  if (vue === 'projet') {
    const p = projetComplet(id);
    return p ? <Projet key={id} lang={lang} t={t} initial={p} /> : <Introuvable lang={lang} t={t} />;
  }
  if (vue === 'piece') {
    const p = piece(id);
    return p ? <Piece key={id} lang={lang} t={t} initiale={publique(p)} rendusInitiaux={rendusDe(id)} credits={lire().credits} couts={couts} services={SERVICES} /> : <Introuvable lang={lang} t={t} />;
  }
  if (vue === 'compte') {
    const e = lire();
    return <Suspense><Compte lang={lang} t={t} email="demo@realroom.app" credits={e.credits} historique={e.mouvements} packs={packs} couts={couts} paiement /></Suspense>;
  }
  return <Introuvable lang={lang} t={t} />;
}
