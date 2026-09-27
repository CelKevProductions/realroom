import { route, json, exiger, lireJSON, ErreurHTTP } from '@/lib/http.js';
import { creerPaiement } from '@/lib/paiement.js';

// POST { pack, langue, consentement: true } -> { url } (Stripe Checkout)
export const POST = route(async request => {
  const u = await exiger(request);
  const b = await lireJSON(request, 2000);
  if (b.consentement !== true) throw new ErreurHTTP(400, 'consentement');
  const origine = new URL(request.url).origin;
  const r = await creerPaiement({ uid: u.id, email: u.email, packId: b.pack, langue: b.langue === 'en' ? 'en' : 'fr', origine: process.env.SITE_URL || origine });
  if (r.erreur) throw new ErreurHTTP(r.erreur === 'pack' ? 400 : 503, r.erreur);
  return json({ url: r.url });
});
