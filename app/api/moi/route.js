import { route, json } from '@/lib/http.js';
import { utilisateur } from '@/lib/session.js';

export const GET = route(async () => {
  const u = await utilisateur();
  return json(u ? { connecte: true, email: u.email, credits: u.credits, langue: u.langue } : { connecte: false });
});
