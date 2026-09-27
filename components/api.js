// Appels à l'API depuis le navigateur : JSON, erreurs lisibles, jamais d'exception réseau non gérée
export async function api(url, { method = 'GET', corps, formulaire, signal } = {}) {
  try {
    const r = await fetch(url, {
      method,
      signal,
      cache: 'no-store',
      headers: corps ? { 'Content-Type': 'application/json' } : undefined,
      body: corps ? JSON.stringify(corps) : formulaire
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && typeof window !== 'undefined' && !url.startsWith('/api/auth')) {
      const lang = location.pathname.split('/')[1] || 'fr';
      location.href = `/${lang}/connexion?suite=${encodeURIComponent(location.pathname)}`;
    }
    return { ...j, ok: r.ok && j.ok !== false, statut: r.status };
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, erreur: 'annule', statut: 0 };
    return { ok: false, erreur: 'reseau', statut: 0 };
  }
}
