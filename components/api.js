// Appels à l'API depuis le navigateur : JSON, erreurs lisibles, jamais d'exception réseau non gérée
import { moteurGuideActif } from '@/lib/moteur-guide.js';
export async function api(url, { method = 'GET', corps, formulaire, signal } = {}) {
  if (corps && url.endsWith('/amenager') && !moteurGuideActif()) corps = {...corps, moteurGuide:false};
  // démo sans compte (/fr/demo…) : tout se passe dans le navigateur, rien n'est envoyé au serveur
  if (typeof window !== 'undefined' && /^\/[a-z]{2}\/(maison-corleone\/)?demo(\/|$)/.test(location.pathname)) {
    const { repondre } = await import('@/components/demo/api.js');
    return repondre(url, { method, corps, formulaire });
  }
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
      // édition Maison Corleone : on se reconnecte avec le compte client de la boutique
      location.href = location.pathname.includes('/maison-corleone')
        ? `/api/mc/connexion?lang=${lang}&suite=${encodeURIComponent(location.pathname)}`
        : `/${lang}/connexion?suite=${encodeURIComponent(location.pathname)}`;
    }
    return { ...j, ok: r.ok && j.ok !== false, statut: r.status };
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, erreur: 'annule', statut: 0 };
    return { ok: false, erreur: 'reseau', statut: 0 };
  }
}
