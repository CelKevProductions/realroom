'use client';
// Mes projets : un projet = un logement (ou un lieu), avec ses pièces
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/api.js';
import { remplir } from '@/lib/i18n.js';

export default function Projets({ lang, t, initiaux }) {
  const router = useRouter();
  const [projets, setProjets] = useState(initiaux);
  const [attente, setAttente] = useState(false);
  async function creer() {
    setAttente(true);
    const r = await api('/api/projets', { method: 'POST', corps: { nom: t.projets.nomDefaut } });
    setAttente(false);
    if (r.ok) router.push(`/${lang}/app/projets/${r.projet.id}`);
  }
  async function supprimer(id) {
    if (!confirm(t.projets.confirmer)) return;
    const r = await api(`/api/projets/${id}`, { method: 'DELETE' });
    if (r.ok) setProjets(p => p.filter(x => x.id !== id));
  }
  return (
    <div className="conteneur app-page">
      <div className="app-page__tete">
        <h1>{t.projets.titre}</h1>
        <button className="btn btn--accent" onClick={creer} disabled={attente}>{t.projets.nouveau}</button>
      </div>
      {!projets.length && <p className="vide">{t.projets.vide}</p>}
      <div className="grille-cartes">
        {projets.map(p => (
          <div key={p.id} className="carte carte-projet" style={{ position: 'relative' }}>
            <Link href={`/${lang}/app/projets/${p.id}`} style={{ textDecoration: 'none', display: 'grid' }}>
              <div className="carte-projet__image" style={p.apercu ? { backgroundImage: `url(${p.apercu})` } : undefined}>{!p.apercu && '⌂'}</div>
              <div className="carte-projet__texte"><b>{p.nom}</b><span className="discret petit">{remplir(t.projets.pieces, { n: p.nb })}</span></div>
            </Link>
            <button className="btn btn--lien btn--petit" style={{ position: 'absolute', right: 8, bottom: 10 }} onClick={() => supprimer(p.id)}>{t.projets.supprimer}</button>
          </div>
        ))}
        <button className="carte-vide" onClick={creer} disabled={attente}>+ {t.projets.nouveau}</button>
      </div>
    </div>
  );
}
