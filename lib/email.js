// Envoi d'e-mails par Resend (RESEND_API_KEY, EMAIL_EXPEDITEUR). Sans clé, et seulement en local
// (développement, essais automatiques) : rien n'est envoyé et le code est rendu à la page.
// Sur Vercel (prévisualisation comme production), sans Resend, pas de connexion.
import { ESSAIS_LOCAUX } from './config.js';

export async function envoyerEmail({ a, sujet, texte, html }) {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    if (!ESSAIS_LOCAUX) { console.error('RESEND_API_KEY manquante : impossible d’envoyer le code de connexion.'); return { ok: false }; }
    return { ok: true, simule: true };
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(15e3),
    headers: { Authorization: 'Bearer ' + cle, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_EXPEDITEUR || 'RealRoom <onboarding@resend.dev>', to: [a], subject: sujet, text: texte, html })
  }).catch(() => null);
  if (!r || !r.ok) {
    console.error('Resend :', r && r.status, r && (await r.text().catch(() => '')));
    return { ok: false };
  }
  return { ok: true };
}
