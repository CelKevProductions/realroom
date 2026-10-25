// Page d'accueil de RealRoom, style « Maison douce » : statique (rapide, indexable), animée ensuite par
// components/accueil/Animations.js. Tout le contenu est dans le HTML ; les animations ne font que le révéler.
// La pièce 3D (components/accueil/PieceAccueil.js) remplit le cadre épinglé à côté du héros et de la méthode.
import Link from 'next/link';
import Logo from '@/components/Logo.js';
import Animations from '@/components/accueil/Animations.js';
import PieceAccueil from '@/components/accueil/PieceAccueil.js';
import PlanOuverture from '@/components/accueil/PlanOuverture.js';
import PiedAccueil from '@/components/accueil/PiedAccueil.js';
import RenduIA from '@/components/accueil/RenduIA.js';
import { texte, remplir, prix } from '@/lib/i18n.js';
import { PACKS, CREDITS, LIMITES, MARQUE, LANGUES } from '@/lib/config.js';
import { PRODUITS } from '@/lib/catalogue.js';

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const t = texte(lang);
  return {
    title: { absolute: t.meta.titre },
    alternates: { canonical: `/${lang}`, languages: { fr: '/fr', en: '/en', 'x-default': '/fr' } },
    openGraph: { url: `/${lang}`, images: [{ url: '/images/chambre-rendu-1200.jpg', width: 1200, height: 800 }] }
  };
}

const deux = n => String(n).padStart(2, '0');

// chiffres clés, tous lus dans le code (rien d'inventé) : les objets génériques de planification ne comptent pas
const REELS = Object.values(PRODUITS).filter(p => !p.generique);
const NB_MEUBLES = REELS.length;
const NB_FAMILLES = new Set(REELS.map(p => p.fam)).size;

// « *mot* » : le mot est surligné de pêche
const accent = s => s.split(/(\*[^*]+\*)/).filter(Boolean).map((m, i) => (m.startsWith('*') ? <em key={i}>{m.slice(1, -1)}</em> : m));
// même chose, mot par mot (chaque mot porte son rang, --i, pour une apparition en cascade)
const mots = s => {
  let i = 0;
  return s.split(/(\*[^*]+\*)/).filter(Boolean).flatMap((m, j) => {
    const em = m.startsWith('*');
    const liste = (em ? m.slice(1, -1) : m).split(/(\s+)/).filter(Boolean)
      .map((w, k) => (/^\s+$/.test(w) ? w : <span key={`${j}-${k}`} className="acc-conclusion__mot" style={{ '--i': i++ }}>{w}</span>));
    return em ? [<em key={j}>{liste}</em>] : liste;
  });
};
// icônes au trait des invitations à essayer, une par étage : relever (téléphone qui scanne), aménager
// (canapé), Shuffle (flèches croisées), rendu photo (appareil)
const ICONES = [
  <svg key="r" viewBox="0 0 24 24"><rect x="7.5" y="3.5" width="9" height="17" rx="2.4" /><path d="M3.5 8V6a2.5 2.5 0 0 1 2.5-2.5M20.5 8V6A2.5 2.5 0 0 0 18 3.5M3.5 16v2A2.5 2.5 0 0 0 6 20.5M20.5 16v2a2.5 2.5 0 0 1-2.5 2.5M10 12h4" /></svg>,
  <svg key="a" viewBox="0 0 24 24"><path d="M5.5 11V8.5A2.5 2.5 0 0 1 8 6h8a2.5 2.5 0 0 1 2.5 2.5V11" /><path d="M3.5 12.5a1.5 1.5 0 0 1 3 0V14h11v-1.5a1.5 1.5 0 0 1 3 0V17a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1zM6 18v2M18 18v2" /></svg>,
  <svg key="s" viewBox="0 0 24 24"><path d="M3.5 7h3.2c2 0 3.1.9 4.3 2.6l2 2.8c1.2 1.7 2.3 2.6 4.3 2.6h3.2M3.5 17h3.2c1.6 0 2.6-.6 3.6-1.7M14 8.7c1-1.1 2-1.7 3.6-1.7h2.9M18 4.5 20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5" /></svg>,
  <svg key="p" viewBox="0 0 24 24"><path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h2l1.4-2h6.2l1.4 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.6" /></svg>
];
// chapitres (data-chapitre) qui ont plusieurs arrêts du défilement guidé : le rendu photo, puis toute la tour
const ETAPES = { 4: 2 };
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
  const demo = `/${lang}/demo`;
  const inscription = `/${lang}/connexion?inscription=1`;
  const offerts = remplir(a.inscriptionNote, { n: CREDITS.bienvenue });
  const menu = [['#methode', a.menu.methode], ['#rendu', a.menu.rendu], ['#tarifs', a.menu.tarifs], ['#faq', a.menu.faq]];
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
            <figure className="acc-piece" data-piece data-curseur={a.curseur.piece}>
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

          <section className="acc-methode" id="methode" aria-label={a.methodeSurtitre}>
            <div className="acc-chapitres">
              <span className="acc-chapitres__jauge" aria-hidden="true" />
              <ol className="acc-chapitres__liste">
                {a.chapitres.map((c, i) => {
                  // un étage de la tour par chapitre ; le dernier a deux arrêts : le rendu, puis toute la tour
                  // et la conclusion
                  const etapes = ETAPES[i + 1];
                  const fin = i === a.chapitres.length - 1;
                  const contenu = (
                    <>
                      <p className="acc-mono acc-chapitre__tete"><span className="acc-crochets acc-chapitre__num">{deux(i + 1)}</span><span className="acc-chapitre__etiquettes">{c.etiquettes.join(' · ')}</span></p>
                      <h3 className="acc-chapitre__titre">{c.titre}</h3>
                      <p className="acc-chapitre__texte" data-mots>{c.texte}</p>
                      {i === 2 && (
                        <ol className="acc-etapes">
                          <li data-etape={0}><button type="button" className="acc-etapes__bouton"><span className="acc-etapes__point" aria-hidden="true" />{a.shuffleBouton}</button></li>
                        </ol>
                      )}
                      <Link href={demo} className="acc-essai">
                        <span className="acc-essai__icone" aria-hidden="true">{ICONES[i]}</span>
                        <span className="acc-essai__texte"><strong>{a.essais[i][0]}</strong><span>{a.essais[i][1]}</span></span>
                        <i className="acc-bouton__fleche" aria-hidden="true" />
                      </Link>
                    </>
                  );
                  return (
                    <li key={c.titre} className={'acc-chapitre' + (etapes ? ' acc-chapitre--etapes' : '') + (fin ? ' acc-chapitre--fin' : '')} data-chapitre={i + 1} data-etapes={etapes} style={etapes ? { '--etapes': etapes } : undefined}>
                      <div className="acc-chapitre__corps">
                        {fin ? <div className="acc-chapitre__contenu">{contenu}</div> : contenu}
                        {fin && (
                          <div className="acc-conclusion">
                            <p className="acc-conclusion__phrase">{mots(a.conclusion)}</p>
                            <div className="acc-conclusion__actions"><Bouton href={demo}>{a.cta}</Bouton><span className="acc-mono">{a.ctaNote}</span></div>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        </div>

        {/* ---------- rendu photo IA : la maquette et le rendu, à comparer en glissant ---------- */}
        <section className="acc-section acc-rendu" id="rendu" aria-labelledby="rendu-titre" data-arret>
          <Reperes />
          <div className="acc-grille">
            <div className="acc-rendu__texte">
              <Etiquette data-anim="fondu">{a.renduSurtitre}</Etiquette>
              <h2 id="rendu-titre" className="acc-h2 acc-rendu__titre" data-anim="lignes">{a.renduTitre}</h2>
              <p className="acc-rendu__intro" data-anim="fondu">{a.renduTexte}</p>
              <dl className="acc-rendu__points" data-anim="fondu">
                {a.renduPoints.map(([valeur, sens]) => (
                  <div key={sens}><dt>{remplir(valeur, { n: CREDITS.rendu, s: CREDITS.rendu > 1 ? 's' : '' })}</dt><dd>{sens}</dd></div>
                ))}
              </dl>
              <div className="acc-rendu__action" data-anim="fondu"><Bouton href={demo}>{a.renduBouton}</Bouton></div>
            </div>
            <div className="acc-rendu__image" data-anim="fondu">
              <RenduIA avant="/images/chambre-maquette-1200.jpg" apres="/images/chambre-rendu-1200.jpg" libelles={a.renduImage} />
            </div>
          </div>
        </section>

        {/* ---------- chiffres clés ---------- */}
        <section className="acc-section acc-chiffres" aria-labelledby="chiffres-titre" data-arret>
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

        {/* ---------- tarifs ---------- */}
        <section className="acc-section acc-tarifs" id="tarifs" aria-labelledby="tarifs-titre" data-arret>
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
        <section className="acc-section" id="faq" aria-labelledby="faq-titre" data-arret>
          <Reperes />
          <div className="acc-grille acc-faq">
            <div className="acc-faq__tete">
              <Etiquette data-anim="fondu">{a.faqSurtitre}</Etiquette>
              <h2 id="faq-titre" className="acc-h2" data-anim="lignes">{a.faqTitre}</h2>
            </div>
            <div className="acc-faq__autre" data-anim="fondu">
              <p><strong>{a.faqAutre[0]}</strong> {a.faqAutre[1]}</p>
              <Bouton href={demo} className="acc-bouton--petit">{a.cta}</Bouton>
            </div>
            <ul className="acc-faq__liste" role="list">
              {a.faq.map(([q, r], i) => (
                <li key={q} className="acc-question" data-anim="fondu">
                  <span className="acc-mono acc-question__num" aria-hidden="true">{deux(i + 1)}</span>
                  <h3 className="acc-question__titre">{q}</h3>
                  <p>{r}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- fin, sur fond nuit ---------- */}
        <section className="acc-section acc-nuit acc-fin" data-fond="nuit" aria-labelledby="fin-titre" data-arret>
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

      <footer className="acc-pied acc-nuit" data-fond="nuit" data-arret>
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
        <div className="acc-pied__scene">
          <p className="acc-pied__geant" aria-hidden="true" data-lettres>
            {'RealRoom'.split('').map((l, i) => <span key={i}>{l}</span>)}
          </p>
          <PiedAccueil lang={lang} />
        </div>
        <div className="acc-grille acc-pied__bas acc-mono">
          <span>© {new Date().getFullYear()} KPW · RealRoom</span>
          <a href="#acc" data-ancre><Roule>{a.menu.haut} ↑</Roule></a>
        </div>
      </footer>
      <Animations />
    </div>
  );
}
