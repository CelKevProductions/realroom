'use client';
// Compte : solde, achat de crédits (avec la renonciation au droit de rétractation), historique, suppression
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/components/api.js';
import { prix, remplir } from '@/lib/i18n.js';

export default function Compte({ lang, t, email, credits, historique: historiqueInitial, packs, couts, paiement }) {
  const tc = t.compte;
  const params = useSearchParams();
  const [solde, setSolde] = useState(credits);
  const [historique, setHistorique] = useState(historiqueInitial);
  useEffect(() => { dispatchEvent(new CustomEvent('realroom:credits', { detail: solde })); }, [solde]);
  const [consentement, setConsentement] = useState(false);
  const [attente, setAttente] = useState('');
  const [message, setMessage] = useState(params.get('paiement') === 'ok' ? { ok: true, texte: tc.paiementOk } : params.get('paiement') === 'annule' ? { texte: tc.paiementAnnule } : null);

  // retour de Stripe : crédit immédiat, sans attendre le webhook
  useEffect(() => {
    const s = params.get('session');
    if (params.get('paiement') === 'ok' && s) api(`/api/credits/retour?session=${encodeURIComponent(s)}`).then(r => { if (r.ok) setSolde(r.credits); });
  }, []);

  async function acheter(pack) {
    if (!consentement) { setMessage({ texte: tc.retractation }); return; }
    setAttente(pack);
    const r = await api('/api/credits/achat', { method: 'POST', corps: { pack, langue: lang, consentement: true } });
    // démo : crédits ajoutés sur place
    if (r.ok && typeof r.credits === 'number') { setSolde(r.credits); if (r.historique) setHistorique(r.historique); setAttente(''); setMessage({ ok: true, texte: tc.paiementOk }); return; }
    if (r.ok && r.url) { location.href = r.url; return; }
    setAttente('');
    setMessage({ texte: t.erreurs.generique });
  }
  async function supprimer() {
    if (!confirm(tc.confirmerSuppression)) return;
    const r = await api('/api/compte', { method: 'DELETE' });
    if (r.ok) location.href = `/${lang}`;
  }
  const date = d => new Intl.DateTimeFormat(t.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
  return (
    <div className="conteneur app-page" style={{ maxWidth: 900 }}>
      <div className="app-page__tete"><h1>{tc.titre}</h1></div>
      {message && <p className={'avis' + (message.ok ? ' avis--ok' : '')} style={{ marginBottom: 16 }}>{message.texte}</p>}
      <section className="carte bloc">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
          <div><span className="discret petit">{tc.solde}</span><div style={{ fontFamily: 'var(--titre)', fontSize: '3rem', lineHeight: 1 }} data-solde={solde}>{solde}</div></div>
          <span className="discret petit">{tc.email} : {email}</span>
        </div>
        <p className="discret petit">{t.accueil.tarifsTexte}</p>
      </section>
      <section className="carte bloc">
        <h2 style={{ fontSize: '1.5rem' }}>{tc.acheter}</h2>
        <div className="packs">
          {packs.map(p => (
            <div key={p.id} className={'carte pack' + (p.conseille ? ' pack--conseille' : '')}>
              {p.conseille && <span className="puce">{t.tarifs.conseille}</span>}
              <span className="pack__nom">{t.tarifs[p.id]}</span>
              <span className="pack__prix">{prix(p.prix, lang)}</span>
              <span className="pack__detail">{remplir(t.tarifs.credits, { n: p.credits })} · {remplir(t.tarifs.rendus, { n: Math.floor(p.credits / couts.rendu) })}</span>
              <button className="btn btn--plein btn--bloc" disabled={!paiement || !!attente} onClick={() => acheter(p.id)} data-pack={p.id}>{attente === p.id ? <span className="rouage rouage--petit" /> : t.tarifs.acheter}</button>
            </div>
          ))}
        </div>
        <label className="coche"><input type="checkbox" checked={consentement} onChange={e => setConsentement(e.target.checked)} name="consentement" />{tc.retractation}</label>
      </section>
      <section className="carte bloc">
        <h2 style={{ fontSize: '1.5rem' }}>{tc.historique}</h2>
        <table className="historique"><tbody>
          {historique.map((h, i) => <tr key={i}><td>{tc.motifs[h.motif] || h.motif}<br /><span className="discret petit">{date(h.cree_le)}</span></td><td>{h.delta > 0 ? '+' : ''}{h.delta}</td></tr>)}
        </tbody></table>
      </section>
      <p style={{ marginTop: 24 }}><button className="btn btn--lien" onClick={supprimer}>{tc.supprimerCompte}</button></p>
    </div>
  );
}
