'use client';
// Mes projets : un projet = un logement (ou un lieu), avec ses pièces
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/api.js';
import { useRacine } from '@/components/chemins.js';
import { useFil } from '@/components/fil.js';
import { Titre, useEntree } from '@/components/Mouvement.js';
import Croquis from '@/components/Croquis.js';
import Tuto from '@/components/Tuto.js';
import { remplir } from '@/lib/i18n.js';

export default function Projets({ lang, t, initiaux }) {
  const router = useRouter();
  const racine = useRacine(lang);
  const [projets, setProjets] = useState(initiaux);
  const [attente, setAttente] = useState(false);
  const page = useRef(null);
  useEntree(page);
  useFil([{ nom: t.projets.titre }]);

  async function creer() {
    setAttente(true);
    const r = await api('/api/projets', { method: 'POST', corps: { nom: t.projets.nomDefaut } });
    setAttente(false);
    if (r.ok) router.push(`${racine}/projets/${r.projet.id}`);
  }
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
          <button className="btn btn--plein" onClick={creer} disabled={attente}>{t.projets.nouveau}</button>
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
        <button className="carte-vide" onClick={creer} disabled={attente}>
          <span className="carte-vide__plus" aria-hidden="true" />
          <b>{t.projets.nouveau}</b>
        </button>
      </div>
    </div>
  );
}
