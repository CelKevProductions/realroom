import Link from 'next/link';
import { texte, remplir, prix } from '@/lib/i18n.js';
import { PACKS, CREDITS, MARQUE } from '@/lib/config.js';
import { PRODUITS } from '@/lib/catalogue.js';

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const t = texte(lang);
  return {
    title: { absolute: t.meta.titre },
    alternates: { canonical: `/${lang}`, languages: { fr: '/fr', en: '/en', 'x-default': '/fr' } },
    openGraph: { url: `/${lang}` }
  };
}

// quelques pièces du catalogue, montrées telles qu'on les achète
const VITRINE = ['terracotta', 'mcs-01', 'rce-05', 'sus-lnb-34', 'wom-wall-2414', 'sofa-220'];

export default async function Accueil({ params }) {
  const { lang } = await params;
  const t = texte(lang), a = t.accueil;
  const vitrine = VITRINE.map(id => PRODUITS[id]).filter(Boolean);
  const vedette = PRODUITS.terracotta || vitrine[0];
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'WebApplication', name: MARQUE.nom, url: `${MARQUE.site}/${lang}`, inLanguage: lang,
      applicationCategory: 'DesignApplication', operatingSystem: 'Web', description: t.meta.description,
      publisher: { '@type': 'Organization', name: MARQUE.editeur },
      offers: PACKS.map(p => ({ '@type': 'Offer', name: remplir(t.tarifs.credits, { n: p.credits }), price: (p.prix / 100).toFixed(2), priceCurrency: 'EUR' }))
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: a.faq.map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r } })) }
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <section className="hero">
        <div className="conteneur hero__grille">
          <div>
            <p className="surtitre">{a.surtitre}</p>
            <h1>{a.titre}</h1>
            <p className="hero__intro">{a.intro}</p>
            <div className="hero__actions">
              <Link className="btn btn--accent btn--large" href={`/${lang}/connexion?inscription=1`}>{a.cta}</Link>
              <span className="hero__note">{a.ctaNote}</span>
            </div>
          </div>
          <div className="hero__visuel">
            <div className="hero__maquette">
              <img src="/images/maquette-salon.jpg" alt={lang === 'fr' ? 'Maquette 3D d’un salon réaménagé avec des meubles Maison Corleone' : '3D model of a living room refurnished with Maison Corleone furniture'} width="1200" height="900" fetchPriority="high" />
            </div>
            <span className="puce puce--accent hero__etiquette">3D</span>
            {vedette && (
              <div className="carte hero__fiche">
                <img src={vedette.vign} alt="" width="72" height="72" loading="lazy" />
                <div><b>{vedette.nom}</b><span>{vedette.cat} · {prix(vedette.prix * 100, lang)}</span></div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section" id="comment">
        <div className="conteneur">
          <div className="section__tete"><h2>{a.etapesTitre}</h2></div>
          <ol className="etapes" style={{ padding: 0, margin: 0, listStyle: 'none' }}>
            {a.etapes.map(([titre, txt]) => (
              <li key={titre} className="carte etape"><h3>{titre}</h3><p>{txt}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="conteneur">
          <div className="section__tete"><h2>{a.pointsTitre}</h2></div>
          <div className="points">
            {a.points.map(([titre, txt]) => <div key={titre} className="point"><h3>{titre}</h3><p>{txt}</p></div>)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="conteneur">
          <div className="section__tete"><h2>{a.catalogueTitre}</h2><p>{a.catalogueTexte}</p></div>
          <div className="vitrine">
            {vitrine.map(p => (
              <figure key={p.id}>
                <img src={p.vign} alt={p.titre} width="360" height="360" loading="lazy" />
                <figcaption>{p.nom} · {p.prix > 0 ? prix(p.prix * 100, lang) : t.piece.surDevis}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="tarifs">
        <div className="conteneur">
          <div className="section__tete"><h2>{a.tarifsTitre}</h2><p>{a.tarifsTexte}</p><p><span className="puce puce--vert">{a.offerts}</span></p></div>
          <div className="packs">
            {PACKS.map(p => (
              <div key={p.id} className={'carte pack' + (p.conseille ? ' pack--conseille' : '')}>
                {p.conseille && <span className="puce">{t.tarifs.conseille}</span>}
                <span className="pack__nom">{t.tarifs[p.id]}</span>
                <span className="pack__prix">{prix(p.prix, lang)}</span>
                <span className="pack__detail">{remplir(t.tarifs.credits, { n: p.credits })} · {remplir(t.tarifs.parCredit, { p: prix(Math.round(p.prix / p.credits), lang, 2) })}</span>
                <span className="pack__detail">{remplir(t.tarifs.rendus, { n: Math.floor(p.credits / CREDITS.rendu) })}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="conteneur">
          <div className="section__tete"><h2>{a.faqTitre}</h2></div>
          <div className="faq">
            {a.faq.map(([q, r]) => <details key={q}><summary>{q}</summary><p>{r}</p></details>)}
          </div>
          <div className="fin">
            <h2>{a.finTitre}</h2>
            <p>{a.finTexte}</p>
            <Link className="btn btn--accent btn--large" href={`/${lang}/connexion?inscription=1`}>{a.cta}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
