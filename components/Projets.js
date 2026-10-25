'use client';
// Mes projets : un projet = un logement (ou un lieu), avec ses pièces ; « Nouveau projet » ouvre
// les questions guidées en plein écran (nouveau/Nouveau.js)
import Link from 'next/link';
import { useRef, useState } from 'react';
import { api } from '@/components/api.js';
import { useRacine } from '@/components/chemins.js';
import { useFil } from '@/components/fil.js';
import { Titre, useEntree } from '@/components/Mouvement.js';
import Croquis from '@/components/Croquis.js';
import Tuto from '@/components/Tuto.js';
import { remplir } from '@/lib/i18n.js';

export default function Projets({ lang, t, initiaux }) {
  const racine = useRacine(lang);
  const [projets, setProjets] = useState(initiaux);
  const page = useRef(null);
  useEntree(page);
  useFil([{ nom: t.projets.titre }]);

  async function supprimer(id) {
    if (!confirm(t.projets.confirmer)) return;
    const r = await api(`/api/projets/${id}`, { method: 'DELETE' });
    if (r.ok) setProjets(p => p.filter(x => x.id !== id));
  }
  return (
    <div className="conteneur app-page" ref={page}>
      <div className="app-page__tete">
        <Titre>{t.projets.titre}</Titre>
        <div className="app-page__actions" data-entree="">
          <Tuto id="accueil" etapes={t.tuto.accueil} libelles={t.tuto} />
          <Link className="btn btn--plein" href={`${racine}/nouveau`}>{t.projets.nouveau}</Link>
        </div>
      </div>
      {!projets.length && <p className="vide" data-entree="">{t.projets.vide}</p>}
      <div className="grille-cartes" data-entree="">
        {projets.map(p => (
          <article key={p.id} className="carte-projet">
            <Link href={`${racine}/projets/${p.id}`}>
              <span className="carte-projet__image">{p.apercu ? <img src={p.apercu} alt="" loading="lazy" /> : <Croquis />}</span>
              <span className="carte-projet__texte">
                <b>{p.nom}</b>
                <span className="carte-projet__meta">{remplir(t.projets.pieces, { n: p.nb, s: p.nb > 1 ? 's' : '' })}</span>
              </span>
            </Link>
            <div className="carte-projet__actions">
              <button className="btn btn--clair btn--petit" onClick={() => supprimer(p.id)}>{t.projets.supprimer}</button>
            </div>
          </article>
        ))}
        <Link className="carte-vide" href={`${racine}/nouveau`}>
          <span className="carte-vide__plus" aria-hidden="true" />
          <b>{t.projets.nouveau}</b>
        </Link>
      </div>
    </div>
  );
}
