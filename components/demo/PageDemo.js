'use client';
// Pages de la démo : les composants de l'application, alimentés par le magasin du navigateur
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import Projets from '@/components/Projets.js';
import Projet from '@/components/Projet.js';
import Piece from '@/components/Piece.js';
import Compte from '@/components/Compte.js';
import Croquis from '@/components/Croquis.js';
import Parcours from '@/components/parcours/Parcours.js';
import { useFil } from '@/components/fil.js';
import { lire, piece, publique, rendusDe, listeProjets, projetComplet, projet } from '@/components/demo/magasin.js';
import { repondre } from '@/components/demo/api.js';

const SERVICES = { analyse: true, rendu: false, monde: false, simulation: true };

function Introuvable({ lang, t }) {
  useFil([{ nom: t.projets.titre, href: `/${lang}/demo` }, { nom: t.erreurs.introuvable }]);
  return (
    <div className="conteneur app-page">
      <p className="vide">{t.demo.introuvable}</p>
      <Link className="btn btn--clair" href={`/${lang}/demo`}>{t.demo.retour}</Link>
    </div>
  );
}

// état du parcours lu par la même route que les écrans (démo : dans le navigateur)
function ParcoursDemo({ lang, t, id, approfondissement }) {
  const [initial, setInitial] = useState(null);
  useEffect(() => { repondre(`/api/projets/${id}/parcours`).then(r => setInitial(r.ok ? { etat: r.etat, revision: r.revision, pieces: r.pieces } : false)); }, [id]);
  if (initial === false) return <Introuvable lang={lang} t={t} />;
  if (!initial) return <div className="attente"><Croquis trace /><p className="discret">{t.demo.chargement}</p></div>;
  return <Parcours lang={lang} t={t} projetId={id} projetNom={projet(id).nom} initial={initial} produits={{}} approfondissement={approfondissement} />;
}

export default function PageDemo({ lang, t, vue, id, couts, packs, approfondissement }) {
  // le magasin vit dans le navigateur : rien à afficher côté serveur
  const [pret, setPret] = useState(false);
  useEffect(() => { lire(lang); setPret(true); }, [lang]);
  if (!pret) return <div className="attente"><Croquis trace /><p className="discret">{t.demo.chargement}</p></div>;

  if (vue === 'projets') return <Projets lang={lang} t={t} initiaux={listeProjets()} />;
  if (vue === 'projet') {
    const p = projetComplet(id);
    return p ? <Projet key={id} lang={lang} t={t} initial={p} /> : <Introuvable lang={lang} t={t} />;
  }
  if (vue === 'parcours') return projet(id) ? <ParcoursDemo lang={lang} t={t} id={id} approfondissement={approfondissement} /> : <Introuvable lang={lang} t={t} />;
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

