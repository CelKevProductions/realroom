'use client';
// Compte : solde, achat de crédits (avec la renonciation au droit de rétractation), historique, suppression
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/components/api.js';
import { useRacine } from '@/components/chemins.js';
import { useFil } from '@/components/fil.js';
import { Titre, Compteur, useEntree } from '@/components/Mouvement.js';
import { prix, remplir } from '@/lib/i18n.js';

export default function Compte({ lang, t, email, credits, historique: historiqueInitial, packs, couts, paiement }) {
  const tc = t.compte;
  const params = useSearchParams();
  const racine = useRacine(lang);
  const [solde, setSolde] = useState(credits);
  const [historique, setHistorique] = useState(historiqueInitial);
  const [consentement, setConsentement] = useState(false);
  const [attente, setAttente] = useState('');
  const [message, setMessage] = useState(params.get('paiement') === 'ok' ? { ok: true, texte: tc.paiementOk } : params.get('paiement') === 'annule' ? { texte: tc.paiementAnnule } : null);
  const page = useRef(null);
  useEntree(page);
  useFil([{ nom: t.projets.titre, href: racine }, { nom: tc.titre }]);
  useEffect(() => { dispatchEvent(new CustomEvent('realroom:credits', { detail: solde })); }, [solde]);

  // retour de Stripe : crédit immédiat, sans attendre le webhook
  useEffect(() => {
    const s = params.get('session');
    if (params.get('paiement') === 'ok' && s) api(`/api/credits/retour?session=${encodeURIComponent(s)}`).then(r => { if (r.ok) setSolde(r.credits); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function acheter(pack) {
    if (!consentement) { setMessage({ alerte: true, texte: tc.cocher }); return; }
    setAttente(pack);
    const r = await api('/api/credits/achat', { method: 'POST', corps: { pack, langue: lang, consentement: true } });
    // démo : crédits ajoutés sur place
    if (r.ok && typeof r.credits === 'number') { setSolde(r.credits); if (r.historique) setHistorique(r.historique); setAttente(''); setMessage({ ok: true, texte: tc.paiementOk }); return; }
    if (r.ok && r.url) { location.href = r.url; return; }
    setAttente('');
    setMessage({ alerte: true, texte: t.erreurs.generique });
  }
  async function supprimer() {
    if (!confirm(tc.confirmerSuppression)) return;
    const r = await api('/api/compte', { method: 'DELETE' });
    if (r.ok) location.href = `/${lang}`;
  }
  const date = d => new Intl.DateTimeFormat(t.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
  return (
    <div className="conteneur app-page app-page--etroite" ref={page}>
      <div className="app-page__tete"><Titre>{tc.titre}</Titre></div>
      <div className="compte">
        <section className="bloc compte__solde" data-entree="">
          <span className="compte__ligne"><span>{tc.solde}</span><span>{email}</span></span>
          <span className="chiffre" data-solde={solde}><Compteur valeur={solde} /></span>
          <p className="compte__note">{t.accueil.tarifsTexte}</p>
        </section>

        <section className="bloc" data-entree="">
          <div className="bloc__tete"><h2>{tc.acheter}</h2></div>
          {message && <p className={'avis' + (message.ok ? ' avis--ok' : message.alerte ? ' avis--alerte' : '')} role="status">{message.texte}</p>}
          <label className={'coche coche--cadre' + (message && message.texte === tc.cocher && !consentement ? ' is-alerte' : '')}>
            <input type="checkbox" checked={consentement} onChange={e => setConsentement(e.target.checked)} name="consentement" />{tc.retractation}
          </label>
          <div className="packs">
            {packs.map(p => (
              <div key={p.id} className={'pack' + (p.conseille ? ' pack--conseille' : '')}>
                <span className="pack__nom">{t.tarifs[p.id]}{p.conseille && <span className="pack__marque">{t.tarifs.conseille}</span>}</span>
                <span className="pack__prix">{prix(p.prix, lang)}</span>
                <span className="pack__detail">{remplir(t.tarifs.credits, { n: p.credits })}, {remplir(t.tarifs.rendus, { n: Math.floor(p.credits / couts.rendu) })}</span>
                <button className={'btn btn--bloc ' + (p.conseille ? 'btn--plein' : 'btn--clair')} disabled={!paiement || !!attente} onClick={() => acheter(p.id)} data-pack={p.id}>
                  {attente === p.id ? <span className="rouage rouage--petit" /> : t.tarifs.acheter}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bloc" data-entree="">
          <div className="bloc__tete"><h2>{tc.historique}</h2></div>
          <table className="historique"><tbody>
            {historique.map((h, i) => (
              <tr key={i}>
                <td>{tc.motifs[h.motif] || h.motif}<span className="date">{date(h.cree_le)}</span></td>
                <td className={h.delta > 0 ? 'is-plus' : undefined}>{h.delta > 0 ? '+' : ''}{h.delta}</td>
              </tr>
            ))}
          </tbody></table>
        </section>

        <p data-entree=""><button className="btn btn--lien compte__supprimer" onClick={supprimer}>{tc.supprimerCompte}</button></p>
      </div>
    </div>
  );
}
