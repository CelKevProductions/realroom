// Page d'accueil de RealRoom : statique (rapide, indexable), animée ensuite par components/accueil/Animations.js.
// Tout le contenu est dans le HTML ; les animations ne font que le révéler.
import Link from 'next/link';
import Logo from '@/components/Logo.js';
import CtaCompte from '@/components/CtaCompte.js';
import Animations from '@/components/accueil/Animations.js';
import { texte, remplir, prix } from '@/lib/i18n.js';
import { PACKS, CREDITS, MARQUE } from '@/lib/config.js';
import { PRODUITS, LIBELLES } from '@/lib/catalogue.js';

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const t = texte(lang);
  return {
    title: { absolute: t.meta.titre },
    alternates: { canonical: `/${lang}`, languages: { fr: '/fr', en: '/en', 'x-default': '/fr' } },
    openGraph: { url: `/${lang}`, images: [{ url: '/images/accueil-photo-apres.jpg', width: 2000, height: 1250 }] }
  };
}

// pièces du catalogue montrées sur l'accueil, telles qu'on les achète
const VITRINE = ['sofa-220', 'terracotta', 'rce-05', 'sus-lnb-34', 'fpf-lamp-7705', 'cm-950', 'abbraccio', 'wa908', 'scg-light-2409', 'hl-550', 'mc-wall-3347', 'table-a-manger-marbre-bois-sculpte-zenoza'];
const cm = p => p.dim.slice(0, 2).map(v => Math.round(v * 100)).join(' × ') + ' cm';
// vignettes Shopify à la bonne taille (le CDN redimensionne selon « width »)
const taille = (u, w) => u.replace(/([?&])width=\d+/, `$1width=${w}`);

// titre découpé en mots pour le défilé de fin
const MOTS = s => s.split(' ');
// libellé de lien qui « roule » au survol : le texte monte, sa copie arrive par dessous (CSS seul)
const Roule = ({ children }) => <span className="acc-roule"><span>{children}</span></span>;

export default async function Accueil({ params }) {
  const { lang } = await params;
  const t = texte(lang), a = t.accueil;
  const autre = lang === 'fr' ? 'en' : 'fr';
  const vitrine = VITRINE.map(id => PRODUITS[id]).filter(p => p && p.vign);
  const annotations = [['mcs-01', p => cm(p)], ['terracotta', p => prix(Math.round(p.prix * 100), lang)], ['sus-lnb-34', p => cm(p)]]
    .map(([id, f]) => PRODUITS[id] && [PRODUITS[id].nom, LIBELLES[PRODUITS[id].fam] || '', f(PRODUITS[id])]).filter(Boolean);
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'WebApplication', name: MARQUE.nom, url: `${MARQUE.site}/${lang}`, inLanguage: lang,
      applicationCategory: 'DesignApplication', operatingSystem: 'Web', description: t.meta.description, image: `${MARQUE.site}/images/accueil-photo-apres.jpg`,
      publisher: { '@type': 'Organization', name: MARQUE.editeur },
      offers: PACKS.map(p => ({ '@type': 'Offer', name: remplir(t.tarifs.credits, { n: p.credits }), price: (p.prix / 100).toFixed(2), priceCurrency: 'EUR' }))
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: a.faq.map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r } })) }
  ];
  const inscription = `/${lang}/connexion?inscription=1`;

  return (
    <div className="acc" id="acc">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <a className="acc-aller" href="#contenu">{a.menu.aller}</a>

      {/* écran d'ouverture (une fois par session, seulement avec les animations) */}
      <div className="acc-ouverture" aria-hidden="true" data-ouverture>
        <div className="acc-ouverture__haut">
          <span className="acc-mono">RealRoom</span>
          <span className="acc-mono">{a.prechargement}</span>
        </div>
        <div className="acc-ouverture__compteur"><span data-compteur>000</span><span className="acc-mono">%</span></div>
        <div className="acc-ouverture__barre"><span data-barre /></div>
      </div>

      {/* repères de la grille, comme sur un plan */}
      <div className="acc-guides" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} />)}</div>

      <header className="acc-entete" data-entete>
        <div className="acc-entete__barre">
          <Link href={`/${lang}`} className="acc-marque" aria-label="RealRoom"><Logo taille={26} /><span>RealRoom</span></Link>
          <nav className="acc-menu" aria-label={lang === 'fr' ? 'Navigation principale' : 'Main navigation'}>
            <a href="#methode" data-ancre><Roule>{a.menu.methode}</Roule></a>
            <a href="#catalogue" data-ancre><Roule>{a.menu.catalogue}</Roule></a>
            <a href="#tarifs" data-ancre><Roule>{a.menu.tarifs}</Roule></a>
            <a href="#faq" data-ancre><Roule>{a.menu.faq}</Roule></a>
          </nav>
          <div className="acc-entete__actions">
            <Link className="acc-langue" href={`/${autre}`} hrefLang={autre} lang={autre}>{autre.toUpperCase()}</Link>
            <CtaCompte lang={lang} connexion={t.nav.connexion} commencer={t.nav.commencer} projets={t.nav.mesProjets} classeLien="acc-lien acc-cache-mobile" classeBouton="acc-bouton acc-bouton--petit" />
          </div>
        </div>
      </header>

      <main id="contenu">
        {/* ---------- ouverture ---------- */}
        <section className="acc-hero">
          <div className="acc-grille">
            <p className="acc-mono acc-hero__surtitre" data-anim="fondu">{a.surtitre}</p>
            <p className="acc-mono acc-hero__meta" data-anim="fondu" aria-hidden="true"><span>{a.heure}</span> <span data-horloge>—</span></p>
            <h1 className="acc-h1" data-anim="lignes" data-immediat>
              {a.titreLignes.map((l, i) => <span key={i} className="acc-h1__ligne">{l} </span>)}
            </h1>
            <div className="acc-cote acc-hero__cote" data-anim="cote" aria-hidden="true">
              <span className="acc-cote__trait" /><span className="acc-cote__texte acc-mono">{a.cote}</span>
            </div>
            <p className="acc-hero__intro" data-anim="fondu">{a.intro}</p>
            <div className="acc-hero__actions" data-anim="fondu">
              <Link className="acc-bouton" href={inscription} data-aimant><span>{a.cta}</span></Link>
              <Link className="acc-lien acc-lien--fleche" href={`/${lang}/demo`}>{a.demo}</Link>
              <p className="acc-mono acc-hero__note">{a.ctaNote}</p>
            </div>
            <ol className="acc-parcours acc-mono" data-anim="fondu" aria-label={a.etapesTitre}>
              {a.parcours.map((e, i) => <li key={e}><span>{String(i + 1).padStart(2, '0')}</span>{e}</li>)}
            </ol>
          </div>
          <figure className="acc-trou" data-trou>
            <div className="acc-trou__cadre" data-trou-cadre>
              <div className="acc-trou__plan" data-parallaxe>
                <img src="/images/accueil-maquette.jpg" alt={a.visuelAlt} width="2400" height="1500" fetchPriority="high" />
                {annotations.map(([nom, famille, valeur], i) => (
                  <span key={nom} className={`acc-note acc-note--${i + 1}`} data-note><span className="acc-note__etiquette"><b>{nom}</b><span className="acc-mono">{famille} · {valeur}</span></span></span>
                ))}
              </div>
            </div>
          </figure>
        </section>

        {/* ---------- avant / après ---------- */}
        <section className="acc-section acc-aa">
          <div className="acc-grille">
            <p className="acc-mono acc-surtitre" data-anim="fondu"><span>01</span>{a.avantApresSurtitre}</p>
            <h2 className="acc-h2 acc-aa__titre" data-anim="lignes">{a.avantApresTitre.map((l, i) => <span key={i}>{l} </span>)}</h2>
            <p className="acc-aa__texte" data-anim="fondu">{a.avantApresTexte}</p>
          </div>
          <div className="acc-aa__cadre" data-aa-cadre>
            <div className="acc-aa__scene" data-aa>
              <img className="acc-aa__img" src="/images/accueil-photo-avant.jpg" alt={a.avantAlt} width="2000" height="1250" loading="lazy" />
              <div className="acc-aa__apres" data-aa-apres>
                <img className="acc-aa__img" src="/images/accueil-photo-apres.jpg" alt={a.apresAlt} width="2000" height="1250" loading="lazy" />
              </div>
              <span className="acc-aa__ligne" data-aa-ligne aria-hidden="true" />
              <span className="acc-mono acc-aa__etiquette acc-aa__etiquette--avant">{a.avant}</span>
              <span className="acc-mono acc-aa__etiquette acc-aa__etiquette--apres">{a.apres}</span>
            </div>
          </div>
          <p className="acc-mono acc-aa__legende acc-grille-marge">{a.legendeMaquette}</p>
        </section>

        {/* ---------- méthode ---------- */}
        <section className="acc-section" id="methode">
          <div className="acc-grille">
            <p className="acc-mono acc-surtitre" data-anim="fondu"><span>02</span>{a.etapesSurtitre}</p>
            <h2 className="acc-h2 acc-methode__titre" data-anim="lignes">{a.etapesTitre}</h2>
          </div>
          <ol className="acc-etapes">
            {a.etapes.map(([titre, txt], i) => (
              <li key={titre} className="acc-etape acc-grille" data-rangee>
                <span className="acc-etape__trait" data-rangee-trait aria-hidden="true" />
                <span className="acc-mono acc-etape__num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="acc-h3 acc-etape__titre">{titre}</h3>
                <p className="acc-etape__texte">{txt}</p>
                <span className="acc-mono acc-etape__duree">{a.etapesDurees[i]}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- ce qui change tout ---------- */}
        <section className="acc-section acc-points" aria-labelledby="points-titre">
          <div className="acc-grille">
            <p className="acc-mono acc-surtitre" data-anim="fondu"><span>03</span>{a.pointsSurtitre}</p>
            <h2 id="points-titre" className="acc-visuellement-cache">{a.pointsTitre}</h2>
          </div>
          <div className="acc-defile" aria-hidden="true" data-defile>
            <div className="acc-defile__piste" data-defile-piste>
              {[0, 1].map(k => (
                <span key={k} className="acc-defile__groupe">
                  {a.points.map(([titre]) => <span key={titre} className="acc-defile__mot">{titre}<i /></span>)}
                </span>
              ))}
            </div>
          </div>
          <div className="acc-grille acc-points__grille">
            {a.points.map(([titre, txt]) => (
              <div key={titre} className="acc-point" data-anim="fondu">
                <h3 className="acc-h4">{titre}</h3>
                <p>{txt}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- catalogue ---------- */}
        <section className="acc-section acc-nuit acc-catalogue" id="catalogue" data-fond="nuit">
          <div className="acc-grille">
            <p className="acc-mono acc-surtitre" data-anim="fondu"><span>04</span>{a.catalogueSurtitre}</p>
            <h2 className="acc-h2 acc-catalogue__titre" data-anim="lignes">{a.catalogueTitre}</h2>
            <p className="acc-catalogue__texte" data-anim="fondu">{a.catalogueTexte}</p>
            <p className="acc-mono acc-catalogue__aide" aria-hidden="true"><i className="acc-fleche acc-fleche--gauche" />{a.glisser}<i className="acc-fleche" /></p>
          </div>
          <div className="acc-vitrine" data-vitrine>
            <ul className="acc-vitrine__piste" data-vitrine-piste>
              {vitrine.map(p => (
                <li key={p.id} className="acc-produit">
                  <a href={p.url} target="_blank" rel="noopener" className="acc-produit__lien">
                    <span className="acc-produit__image"><img src={taille(p.vign, 480)} srcSet={`${taille(p.vign, 360)} 360w, ${taille(p.vign, 720)} 720w`} sizes="(min-width: 760px) 22vw, 72vw" alt={p.titre || p.nom} width="480" height="600" loading="lazy" draggable="false" /></span>
                    <span className="acc-produit__nom">{p.nom}</span>
                    <span className="acc-mono acc-produit__meta">{LIBELLES[p.fam] || p.cat} · {cm(p)}</span>
                    <span className="acc-produit__prix">{prix(Math.round(p.prix * 100), lang)}<span className="acc-mono acc-produit__fiche">{a.ficheProduit}<i className="acc-fleche acc-fleche--haut" /></span></span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- tarifs ---------- */}
        <section className="acc-section" id="tarifs">
          <div className="acc-grille">
            <p className="acc-mono acc-surtitre" data-anim="fondu"><span>05</span>{a.tarifsSurtitre}</p>
            <h2 className="acc-h2 acc-tarifs__titre" data-anim="lignes">{a.tarifsTitre}</h2>
            <p className="acc-tarifs__texte" data-anim="fondu">{a.tarifsTexte}</p>
            <p className="acc-mono acc-tarifs__offerts" data-anim="fondu"><span className="acc-pastille" />{a.offerts}</p>
          </div>
          <div className="acc-grille">
            <div className="acc-tableau" role="table" aria-label={a.tarifsTitre} data-anim="fondu">
              <div className="acc-tableau__ligne acc-tableau__tete acc-mono" role="row">
                <span role="columnheader">{a.colonnes.pack}</span><span role="columnheader">{a.colonnes.credits}</span><span role="columnheader">{a.colonnes.prix}</span>
                <span role="columnheader">{a.colonnes.parCredit}</span><span role="columnheader">{a.colonnes.rendus}</span><span role="columnheader">{a.colonnes.visites}</span>
              </div>
              {PACKS.map(p => (
                <div key={p.id} className={'acc-tableau__ligne' + (p.conseille ? ' is-conseille' : '')} role="row">
                  <span role="cell" className="acc-tableau__pack">{t.tarifs[p.id]}{p.conseille && <em className="acc-mono">{t.tarifs.conseille}</em>}</span>
                  <span role="cell" data-label={a.colonnes.credits}>{p.credits}</span>
                  <span role="cell" className="acc-tableau__prix" data-label={a.colonnes.prix}>{prix(p.prix, lang)}</span>
                  <span role="cell" data-label={a.colonnes.parCredit}>{prix(Math.round(p.prix / p.credits), lang, 2)}</span>
                  <span role="cell" data-label={a.colonnes.rendus}>{Math.floor(p.credits / CREDITS.rendu)}</span>
                  <span role="cell" data-label={a.colonnes.visites}>{Math.floor(p.credits / CREDITS.monde)}</span>
                </div>
              ))}
              <div className="acc-tableau__ligne acc-tableau__gratuit acc-mono" role="row"><span role="cell">{a.gratuit}</span></div>
            </div>
          </div>
          <div className="acc-grille acc-tarifs__actions" data-anim="fondu">
            <Link className="acc-bouton" href={inscription} data-aimant><span>{a.cta}</span></Link>
            <p className="acc-mono">{a.ctaNote}</p>
          </div>
        </section>

        {/* ---------- questions ---------- */}
        <section className="acc-section" id="faq">
          <div className="acc-grille acc-faq">
            <div className="acc-faq__tete">
              <p className="acc-mono acc-surtitre" data-anim="fondu"><span>06</span>{a.faqSurtitre}</p>
              <h2 className="acc-h2" data-anim="lignes">{a.faqTitre}</h2>
            </div>
            <div className="acc-faq__liste">
              {a.faq.map(([q, r]) => (
                <details key={q} className="acc-question" data-anim="fondu">
                  <summary><span>{q}</span><i aria-hidden="true" /></summary>
                  <p>{r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- fin ---------- */}
        <section className="acc-section acc-nuit acc-fin" data-fond="nuit">
          <div className="acc-grille">
            <p className="acc-manifeste" data-mots>
              {MOTS(a.manifeste).map((m, i) => <span key={i}>{m} </span>)}
            </p>
            <div className="acc-fin__bas">
              <div>
                <h2 className="acc-h3">{a.finTitre}</h2>
                <p>{a.finTexte}</p>
              </div>
              <div className="acc-fin__actions">
                <Link className="acc-bouton" href={inscription} data-aimant><span>{a.cta}</span></Link>
                <Link className="acc-lien acc-lien--fleche" href={`/${lang}/demo`}>{a.demo}</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="acc-pied acc-nuit" data-fond="nuit">
        <div className="acc-grille acc-pied__haut">
          <div className="acc-pied__marque">
            <p>{t.pied.editeur} · {t.pied.meubles}</p>
            <p className="acc-mono"><span>{a.heure}</span> <span data-horloge>—</span></p>
          </div>
          <nav className="acc-pied__nav" aria-label={lang === 'fr' ? 'Plan du site' : 'Site map'}>
            <a href="#methode" data-ancre><Roule>{a.menu.methode}</Roule></a>
            <a href="#catalogue" data-ancre><Roule>{a.menu.catalogue}</Roule></a>
            <a href="#tarifs" data-ancre><Roule>{a.menu.tarifs}</Roule></a>
            <a href="#faq" data-ancre><Roule>{a.menu.faq}</Roule></a>
            <Link href={`/${lang}/demo`}><Roule>{a.demo}</Roule></Link>
            <Link href={`/${lang}/connexion`}><Roule>{t.nav.connexion}</Roule></Link>
          </nav>
          <nav className="acc-pied__nav" aria-label={lang === 'fr' ? 'Informations légales' : 'Legal'}>
            <Link href={`/${lang}/legal/mentions`}><Roule>{t.pied.mentions}</Roule></Link>
            <Link href={`/${lang}/legal/cgv`}><Roule>{t.pied.cgv}</Roule></Link>
            <Link href={`/${lang}/legal/confidentialite`}><Roule>{t.pied.confidentialite}</Roule></Link>
            <Link href={`/${autre}`} hrefLang={autre} lang={autre}><Roule>{autre === 'en' ? 'English' : 'Français'}</Roule></Link>
          </nav>
        </div>
        <p className="acc-pied__geant" aria-hidden="true" data-lettres>
          {'RealRoom'.split('').map((l, i) => <span key={i}>{l}</span>)}
        </p>
        <div className="acc-grille acc-pied__bas acc-mono">
          <span>© {new Date().getFullYear()} KPW · RealRoom</span>
          <a href="#acc" data-ancre><Roule>{a.menu.haut} ↑</Roule></a>
        </div>
      </footer>
      <Animations />
    </div>
  );
}
