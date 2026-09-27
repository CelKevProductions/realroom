'use client';
import { api } from '@/components/api.js';

export default function Deconnexion({ lang, libelle }) {
  return (
    <button className="btn btn--lien" type="button" onClick={async () => { await api('/api/auth/deconnexion', { method: 'POST' }); location.href = `/${lang}`; }}>
      {libelle}
    </button>
  );
}
