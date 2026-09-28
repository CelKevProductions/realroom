'use client';
import { api } from '@/components/api.js';

// sur téléphone, seule l'icône reste visible (le libellé reste lu par les lecteurs d'écran)
export default function Deconnexion({ lang, libelle }) {
  return (
    <button className="btn btn--lien deconnexion" type="button" title={libelle} onClick={async () => { await api('/api/auth/deconnexion', { method: 'POST' }); location.href = `/${lang}`; }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16l-4-4 4-4" /><path d="M6 12h10" /></svg>
      <span className="deconnexion__texte">{libelle}</span>
    </button>
  );
}
