// Envoi d'e-mails par Resend (RESEND_API_KEY, EMAIL_EXPEDITEUR). Sans clé, en local ou sur un
// déploiement de prévisualisation en simulation : l'e-mail est seulement écrit dans la console et
// le code est rendu à la page (essais). Jamais en production : sans Resend, pas de connexion.
export async function envoyerEmail({ a, sujet, texte, html }) {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    const prod = process.env.VERCEL_ENV === 'production';
    const essai = !prod && (process.env.NODE_ENV !== 'production' || process.env.REALROOM_ESSAIS === '1' ||
      (process.env.VERCEL_ENV === 'preview' && process.env.REALROOM_SIMULATION === '1'));
    if (!essai) { console.error('RESEND_API_KEY manquante : impossible d’envoyer le code de connexion.'); return { ok: false }; }
    console.log('[e-mail simulé] à', a, '·', sujet);
    return { ok: true, simule: true };
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cle, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_EXPEDITEUR || 'RealRoom <onboarding@resend.dev>', to: [a], subject: sujet, text: texte, html })
  }).catch(() => null);
  if (!r || !r.ok) {
    console.error('Resend :', r && r.status, r && (await r.text().catch(() => '')));
    return { ok: false };
  }
  return { ok: true };
}
