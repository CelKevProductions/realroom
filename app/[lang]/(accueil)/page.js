// Page d'accueil de RealRoom, style « Maison douce » : statique (rapide, indexable), animée ensuite par
// components/accueil/Animations.js. Tout le contenu est dans le HTML ; les animations ne font que le révéler.
// La pièce 3D (components/accueil/PieceAccueil.js) remplit le cadre épinglé à côté du héros et de la méthode.
import Link from 'next/link';
import Logo from '@/components/Logo.js';
import Animations from '@/components/accueil/Animations.js';
import PieceAccueil from '@/components/accueil/PieceAccueil.js';
import PlanOuverture from '@/components/accueil/PlanOuverture.js';
import { texte, remplir, prix } from '@/lib/i18n.js';
import { PACKS, CREDITS, LIMITES, MARQUE, LANGUES } from '@/lib/config.js';
import { PRODUITS, LIBELLES } from '@/lib/catalogue.js';

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const t = texte(lang);
  return {
    title: { absolute: t.meta.titre },
    alternates: { canonical: `/${lang}`, languages: { fr: '/fr', en: '/en', 'x-default': '/fr' } },
    openGraph: { url: `/${lang}`, images: [{ url: '/images/chambre-rendu-1200.jpg', width: 1200, height: 800 }] }
  };
}

// pièces du catalogue montrées sur l'accueil, telles qu'on les achète
const VITRINE = ['cbb-03', 'fauteuil-velours-terracotta-pietement-plein-terra', 'lst-min-03', 'wom-wall-2414', 'sofa-220', 'terracotta', 'rce-05', 'fpf-lamp-7705', 'cm-950', 'abbraccio', 'wa908', 'scg-light-2409', 'hl-550', 'table-a-manger-marbre-bois-sculpte-zenoza'];
const cm = p => p.dim.slice(0, 2).map(v => Math.round(v * 100)).join(' × ') + ' cm';
// vignettes Shopify à la bonne taille (le CDN redimensionne selon « width »)
const taille = (u, w) => u.replace(/([?&])width=\d+/, `$1width=${w}`);
const deux = n => String(n).padStart(2, '0');

// chiffres clés, tous lus dans le code (rien d'inventé) : les objets génériques de planification ne comptent pas
const REELS = Object.values(PRODUITS).filter(p => !p.generique);
const NB_MEUBLES = REELS.length;
const NB_FAMILLES = new Set(REELS.map(p => p.fam)).size;

// « *mot* » : le mot est surligné de pêche
const accent = s => s.split(/(\*[^*]+\*)/).filter(Boolean).map((m, i) => (m.startsWith('*') ? <em key={i}>{m.slice(1, -1)}</em> : m));
// étiquette : une pastille blanche avec un point corail (dessiné en CSS)
const Etiquette = ({ children, className = '', ...p }) => <p className={'acc-etiquette ' + className} {...p}>{children}</p>;
// libellé de lien qui « roule » au survol : le texte monte, sa copie arrive par dessous (CSS seul)
const Roule = ({ children }) => <span className="acc-roule"><span>{children}</span></span>;
// bouton pilule encre : le corail monte depuis le bas au survol, le libellé roule, la pastille flèche tourne
const Bouton = ({ href, children, court, className = '', ...p }) => (
  <Link className={'acc-bouton ' + className} href={href} {...p}>
    <span className="acc-bouton__libelle"><span className={court ? 'acc-long' : undefined}>{children}</span>{court && <span className="acc-court">{court}</span>}</span>
    <i className="acc-bouton__fleche" aria-hidden="true" />
  </Link>
);
// filet de section avec ses repères « + » (bords et milieu), comme sur un calque
const Reperes = () => <div className="acc-reperes" aria-hidden="true"><span data-trait /><i /></div>;
// règle graduée
const Regle = ({ className = '', ...p }) => (
  <div className={'acc-regle ' + className} aria-hidden="true" {...p}>
    {['0', '1', '2', '3', '4 m'].map(g => <span key={g}>{g}</span>)}
  </div>
);

export default async function Accueil({ params }) {
  const { lang } = await params;
  const t = texte(lang), a = t.accueil;
  const vitrine = VITRINE.map(id => PRODUITS[id]).filter(p => p && p.vign);
  const demo = `/${lang}/demo`;
  const inscription = `/${lang}/connexion?inscription=1`;
  const offerts = remplir(a.inscriptionNote, { n: CREDITS.bienvenue });
  const menu = [['#methode', a.menu.methode], ['#catalogue', a.menu.catalogue], ['#tarifs', a.menu.tarifs], ['#faq', a.menu.faq]];
  const chiffres = [['meubles', NB_MEUBLES], ['familles', NB_FAMILLES], ['pieces', LIMITES.piecesParProjet], ['credits', CREDITS.bienvenue]];
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'WebApplication', name: MARQUE.nom, url: `${MARQUE.site}/${lang}`, inLanguage: lang,
      applicationCategory: 'DesignApplication', operatingSystem: 'Web', description: t.meta.description, image: `${MARQUE.site}/images/chambre-rendu-1200.jpg`,
      publisher: { '@type': 'Organization', name: MARQUE.editeur },
      offers: PACKS.map(p => ({ '@type': 'Offer', name: remplir(t.tarifs.credits, { n: p.credits }), price: (p.prix / 100).toFixed(2), priceCurrency: 'EUR' }))
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: a.faq.map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r } })) }
  ];

  return (
    <div className="acc" id="acc">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <a className="acc-aller" href="#contenu">{a.menu.aller}</a>

      {/* préchargement : une fois par session, seulement avec les animations (absent sans JavaScript ou en mouvement réduit) */}
      <div className="acc-ouverture" aria-hidden="true" data-ouverture>
        <div className="acc-ouverture__contenu" data-ouverture-contenu>
          <div className="acc-ouverture__haut acc-mono"><span>RealRoom</span><span className="acc-crochets">{a.prechargement}</span></div>
          <PlanOuverture cotes={a.cotes} />
          <div className="acc-ouverture__bas">
            <span className="acc-ouverture__compte" data-compte />
            <span className="acc-mono acc-ouverture__passer">{a.passer}</span>
          </div>
          <div className="acc-ouverture__barre"><span data-barre /></div>
        </div>
      </div>

      {/* colonnes de la grille, en filets très légers */}
      <div className="acc-fond" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} />)}</div>

      <header className="acc-entete" data-entete>
        <div className="acc-pilule">
          <Link href={`/${lang}`} className="acc-marque" aria-label={a.aria.marque}><Logo taille={26} /><span>RealRoom</span></Link>
          <nav className="acc-menu" aria-label={a.aria.nav}>
            {menu.map(([href, l]) => <a key={href} href={href} data-ancre><Roule>{l}</Roule></a>)}
          </nav>
          <div className="acc-langues" role="group" aria-label={a.aria.langue}>
            {LANGUES.map(l => (l === lang
              ? <span key={l} aria-current="true">{l.toUpperCase()}</span>
              : <Link key={l} href={`/${l}`} hrefLang={l} lang={l} aria-label={l === 'en' ? 'English' : 'Français'}>{l.toUpperCase()}</Link>))}
          </div>
          <Bouton href={demo} court={a.ctaCourt} className="acc-bouton--petit">{a.cta}</Bouton>
        </div>
      </header>

      <main id="contenu">
        {/* ---------- héros et méthode, la pièce 3D épinglée à côté ---------- */}
        <div className="acc-scene" data-scene>
          <section className="acc-hero" data-chapitre="0" aria-labelledby="hero-titre">
            <Etiquette className="acc-hero__etiquette" data-entree="fondu">{a.surtitre}</Etiquette>
            <h1 id="hero-titre" className="acc-h1" data-entree="lignes">{accent(a.titreHero)}</h1>
            <p className="acc-hero__intro" data-entree="fondu">{a.intro}</p>
            <div className="acc-hero__actions" data-entree="fondu">
              <Bouton href={demo}>{a.cta}</Bouton>
              <Link className="acc-lien" href={inscription}>{a.inscription}<span className="acc-lien__note acc-mono">{offerts}</span></Link>
            </div>
            <p className="acc-mono acc-hero__note" data-entree="fondu"><span className="acc-point" aria-hidden="true" />{a.ctaNote}</p>
            <ol className="acc-hero__index acc-mono" data-entree="fondu">
              {a.chapitres.map((c, i) => <li key={c.titre}><span>{deux(i + 1)}</span>{c.titre}</li>)}
            </ol>
          </section>

          <div className="acc-scene__piece">
            <figure className="acc-piece" data-piece>
              <div className="acc-piece__filigrane" aria-hidden="true">
                {a.filigranes.map((m, i) => <span key={m} data-n={i}>{m}</span>)}
              </div>
              <div className="acc-piece__toile"><PieceAccueil lang={lang} /></div>
              <div className="acc-piece__cadran" aria-hidden="true" data-entree="fondu">
                <i className="acc-piece__coin" /><i className="acc-piece__coin" /><i className="acc-piece__coin" /><i className="acc-piece__coin" />
                <p className="acc-mono acc-piece__vue"><span className="acc-crochets">{a.vue}</span><span className="acc-piece__pile">{a.vues.map((v, i) => <span key={v} data-n={i}>{v}</span>)}</span></p>
                <p className="acc-mono acc-piece__numero"><span className="acc-piece__pile">{a.vues.map((v, i) => <span key={v} data-n={i}>{deux(i)}</span>)}</span> / {deux(a.chapitres.length)}</p>
              </div>
              <Regle className="acc-piece__regle" data-entree="trait" />
              <figcaption className="acc-visuellement-cache">{a.aria.piece}</figcaption>
            </figure>
          </div>

          <section className="acc-methode" id="methode" aria-labelledby="methode-titre">
            <div className="acc-methode__tete">
              <Etiquette data-anim="fondu">{a.methodeSurtitre}</Etiquette>
              <h2 id="methode-titre" className="acc-h2" data-anim="lignes">{a.methodeTitre}</h2>
            </div>
            <div className="acc-chapitres">
              <span className="acc-chapitres__jauge" aria-hidden="true" />
              <ol className="acc-chapitres__liste">
                {a.chapitres.map((c, i) => (
                  <li key={c.titre} className="acc-chapitre" data-chapitre={i + 1}>
                    <p className="acc-mono acc-chapitre__tete"><span className="acc-crochets acc-chapitre__num">{deux(i + 1)}</span><span className="acc-chapitre__etiquettes">{c.etiquettes.join(' · ')}</span></p>
                    <h3 className="acc-chapitre__titre">{c.titre}</h3>
                    <p className="acc-chapitre__texte" data-mots>{c.texte}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>

        {/* ---------- chiffres clés ---------- */}
        <section className="acc-section acc-chiffres" aria-labelledby="chiffres-titre">
          <Reperes />
          <div className="acc-grille">
            <Etiquette data-anim="fondu">{a.chiffresSurtitre}</Etiquette>
            <h2 id="chiffres-titre" className="acc-h2 acc-chiffres__titre" data-anim="lignes">{a.chiffresTitre}</h2>
          </div>
          <dl className="acc-cellules">
            {chiffres.map(([cle, valeur]) => (
              <div key={cle} className="acc-cellule">
                <dt className="acc-etiquette" data-anim="fondu">{a.chiffres[cle][0]}</dt>
                <dd className="acc-cellule__valeur" data-anim="fondu"><span aria-hidden="true" data-decode>{valeur}</span><span className="acc-visuellement-cache">{valeur}</span></dd>
                <dd className="acc-cellule__texte" data-anim="fondu">{a.chiffres[cle][1]}</dd>
              </div>
            ))}
          </dl>
          <Regle data-trait />
        </section>

        {/* ---------- catalogue ---------- */}
        <section className="acc-section acc-catalogue" id="catalogue" aria-labelledby="catalogue-titre">
          <Reperes />
          <div className="acc-grille">
            <Etiquette data-anim="fondu">{a.catalogueSurtitre}</Etiquette>
            <h2 id="catalogue-titre" className="acc-h2 acc-catalogue__titre" data-anim="lignes">{a.catalogueTitre}</h2>
            <p className="acc-catalogue__texte" data-anim="fondu">{remplir(a.catalogueTexte, { n: NB_MEUBLES })}</p>
            <p className="acc-mono acc-catalogue__aide" aria-hidden="true"><i className="acc-fleche acc-fleche--gauche" />{a.glisser}<i className="acc-fleche" /></p>
          </div>
          <div className="acc-vitrine" data-vitrine>
            <ul className="acc-vitrine__piste">
              {vitrine.map(p => (
                <li key={p.id} className="acc-produit">
                  <a href={p.url} target="_blank" rel="noopener" className="acc-produit__lien">
                    <span className="acc-produit__image"><img src={taille(p.vign, 480)} srcSet={`${taille(p.vign, 360)} 360w, ${taille(p.vign, 720)} 720w`} sizes="(min-width: 960px) 22vw, 64vw" alt={p.titre || p.nom} width="480" height="600" loading="lazy" decoding="async" draggable="false" /></span>
                    <span className="acc-produit__nom">{p.nom}</span>
                    <span className="acc-mono acc-produit__meta">{LIBELLES[p.fam] || p.cat} · {cm(p)}</span>
                    <span className="acc-produit__prix"><span>{prix(Math.round(p.prix * 100), lang)}</span><span className="acc-mono acc-produit__fiche">{a.ficheProduit}<i className="acc-fleche acc-fleche--haut" /></span></span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- tarifs ---------- */}
        <section className="acc-section acc-tarifs" id="tarifs" aria-labelledby="tarifs-titre">
          <Reperes />
          <div className="acc-grille">
            <Etiquette data-anim="fondu">{a.tarifsSurtitre}</Etiquette>
            <h2 id="tarifs-titre" className="acc-h2 acc-tarifs__titre" data-anim="lignes">{a.tarifsTitre}</h2>
            <p className="acc-tarifs__texte" data-anim="fondu">{a.tarifsTexte}</p>
            <p className="acc-mono acc-tarifs__offerts" data-anim="fondu"><span className="acc-point" aria-hidden="true" />{remplir(a.offerts, { n: CREDITS.bienvenue })}</p>
          </div>
          <ul className="acc-packs">
            {PACKS.map(p => (
              <li key={p.id} className={'acc-pack' + (p.conseille ? ' is-conseille' : '')}>
                <div className="acc-pack__contenu" data-anim="fondu">
                  <div className="acc-pack__tete">
                    <h3 className="acc-pack__nom">{t.tarifs[p.id]}</h3>
                    {p.conseille && <span className="acc-mono acc-pack__puce">{t.tarifs.conseille}</span>}
                  </div>
                  <p className="acc-pack__prix">{prix(p.prix, lang)}</p>
                  <dl className="acc-pack__details">
                    <div><dt>{a.colonnes.credits}</dt><dd>{p.credits}</dd></div>
                    <div><dt>{a.colonnes.parCredit}</dt><dd>{prix(Math.round(p.prix / p.credits), lang, 2)}</dd></div>
                    <div><dt>{a.colonnes.rendus}</dt><dd>{Math.floor(p.credits / CREDITS.rendu)}</dd></div>
                    <div><dt>{a.colonnes.visites}</dt><dd>{Math.floor(p.credits / CREDITS.monde)}</dd></div>
                  </dl>
                </div>
              </li>
            ))}
          </ul>
          <div className="acc-grille acc-tarifs__bas" data-anim="fondu">
            <p className="acc-mono acc-tarifs__gratuit">{a.gratuit}</p>
            <div className="acc-tarifs__actions">
              <Bouton href={demo}>{a.cta}</Bouton>
              <Link className="acc-lien" href={inscription}>{a.inscription}</Link>
            </div>
          </div>
        </section>

        {/* ---------- questions ---------- */}
        <section className="acc-section" id="faq" aria-labelledby="faq-titre">
          <Reperes />
          <div className="acc-grille acc-faq">
            <div className="acc-faq__tete">
              <Etiquette data-anim="fondu">{a.faqSurtitre}</Etiquette>
              <h2 id="faq-titre" className="acc-h2" data-anim="lignes">{a.faqTitre}</h2>
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

        {/* ---------- fin, sur fond nuit ---------- */}
        <section className="acc-section acc-nuit acc-fin" data-fond="nuit" aria-labelledby="fin-titre">
          <div className="acc-grille">
            <Etiquette data-anim="fondu">RealRoom</Etiquette>
            <p className="acc-manifeste" data-mots>{accent(a.manifeste)}</p>
            <div className="acc-fin__bas">
              <div>
                <h2 id="fin-titre" className="acc-fin__titre">{a.finTitre}</h2>
                <p>{a.finTexte}</p>
              </div>
              <div className="acc-fin__actions">
                <Bouton href={demo}>{a.cta}</Bouton>
                <Link className="acc-lien" href={inscription}>{a.inscription}</Link>
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
          <nav className="acc-pied__nav" aria-label={a.aria.plan}>
            {menu.map(([href, l]) => <a key={href} href={href} data-ancre><Roule>{l}</Roule></a>)}
            <Link href={demo}><Roule>{a.demo}</Roule></Link>
            <Link href={`/${lang}/connexion`}><Roule>{t.nav.connexion}</Roule></Link>
          </nav>
          <nav className="acc-pied__nav" aria-label={a.aria.legal}>
            <Link href={`/${lang}/legal/mentions`}><Roule>{t.pied.mentions}</Roule></Link>
            <Link href={`/${lang}/legal/cgv`}><Roule>{t.pied.cgv}</Roule></Link>
            <Link href={`/${lang}/legal/confidentialite`}><Roule>{t.pied.confidentialite}</Roule></Link>
            {LANGUES.filter(l => l !== lang).map(l => <Link key={l} href={`/${l}`} hrefLang={l} lang={l}><Roule>{l === 'en' ? 'English' : 'Français'}</Roule></Link>)}
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
