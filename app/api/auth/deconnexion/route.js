import { route, json, verifierOrigine } from '@/lib/http.js';
import { fermerSession } from '@/lib/session.js';

export const POST = route(async request => {
  verifierOrigine(request);
  await fermerSession();
  return json({ ok: true });
});
