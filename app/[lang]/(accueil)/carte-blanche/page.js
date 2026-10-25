// Accueil « Carte blanche » : une autre version de la page d'accueil, à côté de la vraie (qui ne bouge
// pas). Une seule pièce, en nuage de points, raconte RealRoom en cinq actes au défilement : le scan, le
// plan, les meubles, Shuffle, puis la photo, où la nuit devient jour. Textes ici, mise en scène dans
// components/carte-blanche/Spectacle.js, la pièce dans components/carte-blanche/nuage.js.
import Link from 'next/link';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/ibm-plex-mono/400.css';
import './carte-blanche.css';
import Logo from '@/components/Logo.js';
import PiedAccueil from '@/components/accueil/PiedAccueil.js';
import Spectacle from '@/components/carte-blanche/Spectacle.js';
import { texte } from '@/lib/i18n.js';

const TEXTES = {
  fr: {
    meta: 'RealRoom · Carte blanche',
    charge: 'Relevé de la pièce',
    marque: 'Aménagement en 3D',
    actuelle: 'Version actuelle',
    demo: 'Essayer la démo',
    titre: ['Votre pièce,', 'avant d’y', 'vivre.'],
    chapeau: 'Un scan au téléphone, de vrais meubles à leurs vraies dimensions, et une photo de la pièce finie. En quelques minutes.',
    defiler: 'Faites défiler',
    actes: [
      { nom: 'Scanner', titre: ['Un tour', 'de pièce suffit.'], texte: 'Avec l’appli de scan de votre téléphone, vous faites le tour de la pièce. Murs, hauteur, portes et fenêtres sont relevés au centimètre.', note: 'Murs · Hauteur · Portes · Fenêtres' },
      { nom: 'Le plan', titre: ['Le plan', 'se dessine seul.'], texte: 'RealRoom lit le scan et redessine la pièce à plat, avec ses vraies mesures. Vous n’avez rien à tracer.', note: '4,60 × 3,80 m · 17,5 m²' },
      { nom: 'Aménager', titre: ['De vrais meubles,', 'à leur place.'], texte: 'Canapé, table, fauteuil, lampe : des meubles qui existent, à leurs vraies dimensions, posés en laissant la place de passer.', note: '7 meubles · Vraies dimensions' },
      { nom: 'Shuffle', titre: ['Une autre idée ?', 'Un clic.'], texte: 'Shuffle propose une autre disposition avec les mêmes envies. Gardez ce que vous aimez, changez le reste.', bouton: 'Shuffle' },
      { nom: 'Rendu photo', titre: ['Puis', 'la photo.'], texte: 'L’IA donne à chaque point sa matière : le chêne, le lin, le laiton, la lumière du soir. Vous voyez la pièce comme si vous y étiez.', note: 'Chêne · Lin · Laiton · Lumière du soir' }
    ],
    fin: ['À vous', 'de jouer.'],
    finTexte: 'La démo est ouverte, sans compte : une pièce vous attend, prête à meubler.',
    compte: 'Créer un compte',
    heure: 'Paris'
  },
  en: {
    meta: 'RealRoom · Carte blanche',
    charge: 'Scanning the room',
    marque: '3D room planning',
    actuelle: 'Current version',
    demo: 'Try the demo',
    titre: ['Your room,', 'before you', 'live in it.'],
    chapeau: 'A phone scan, real furniture at its real size, and a photo of the finished room. In a few minutes.',
    defiler: 'Scroll',
    actes: [
      { nom: 'Scan', titre: ['One walk', 'around the room.'], texte: 'With your phone’s scanning app, walk around the room. Walls, height, doors and windows are measured to the centimetre.', note: 'Walls · Height · Doors · Windows' },
      { nom: 'The plan', titre: ['The plan', 'draws itself.'], texte: 'RealRoom reads the scan and redraws the room flat, with its real measurements. Nothing to draw.', note: '4.60 × 3.80 m · 17.5 m²' },
      { nom: 'Furnish', titre: ['Real furniture,', 'in its place.'], texte: 'Sofa, table, armchair, lamp: furniture that exists, at its real size, placed with room to walk around.', note: '7 pieces · Real sizes' },
      { nom: 'Shuffle', titre: ['Another idea?', 'One click.'], texte: 'Shuffle suggests another layout with the same wishes. Keep what you like, change the rest.', bouton: 'Shuffle' },
      { nom: 'Photo render', titre: ['Then', 'the photo.'], texte: 'AI gives every point its material: oak, linen, brass, evening light. You see the room as if you were there.', note: 'Oak · Linen · Brass · Evening light' }
    ],
    fin: ['Your', 'turn.'],
    finTexte: 'The demo is open, no account needed: a room is waiting, ready to furnish.',
    compte: 'Create an account',
    heure: 'Paris'
  }
};

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const c = TEXTES[lang] || TEXTES.fr;
  return { title: { absolute: c.meta }, robots: { index: false, follow: false } };
}

const deux = n => String(n).padStart(2, '0');
// un titre en lignes : chaque ligne monte de derrière un cache
const Lignes = ({ lignes, balise = 'h2', className = '' }) => {
  const Balise = balise;
  return (
    <Balise className={className} data-montee>
      {lignes.map((l, i) => <span key={i} className="cb-ligne" style={{ '--i': i }}><span>{l}</span></span>)}
    </Balise>
  );
};

export default async function CarteBlanche({ params }) {
  const { lang } = await params;
  const c = TEXTES[lang] || TEXTES.fr;
  const t = texte(lang);
  const demo = `/${lang}/demo`;
  return (
    <div className="cb" lang={lang}>
      <div className="cb-precharge" aria-hidden="true">
        <span className="cb-mono">{c.charge}</span>
        <span className="cb-precharge__compte" data-precompte>000</span>
      </div>
      <div className="cb-toile" aria-hidden="true"><canvas /></div>
      <div className="cb-grain" aria-hidden="true" />
      <div className="cb-curseur" aria-hidden="true" />

      <header className="cb-barre" id="cb-haut">
        <Link href={`/${lang}`} className="cb-barre__marque" aria-label="RealRoom">
          <Logo taille={26} /> <span>RealRoom</span>
        </Link>
        <span className="cb-mono cb-barre__tag">{c.marque}</span>
        <nav className="cb-barre__liens">
          <Link href={`/${lang}`} className="cb-lien">{c.actuelle}</Link>
          <Link href={demo} className="cb-pastille" data-aimant data-curseur={c.demo}>{c.demo}<span aria-hidden="true">→</span></Link>
        </nav>
      </header>

      <aside className="cb-index" aria-hidden="true">
        <span className="cb-mono"><b data-compteur>00</b> / {deux(c.actes.length)}</span>
        <span className="cb-index__barre" data-barre />
        <ol>{c.actes.map((a, i) => <li key={a.nom} data-indice className="cb-mono"><i>{deux(i + 1)}</i> {a.nom}</li>)}</ol>
      </aside>

      <main className="cb-histoire">
        <section className="cb-heros">
          <p className="cb-mono cb-heros__haut" data-montee><span className="cb-point" /> RealRoom · {c.marque}</p>
          <Lignes lignes={c.titre} balise="h1" className="cb-heros__titre" />
          <div className="cb-heros__bas" data-montee>
            <p>{c.chapeau}</p>
            <a href="#acte-1" className="cb-defiler cb-mono"><span />{c.defiler}</a>
          </div>
        </section>

        {c.actes.map((a, i) => (
          <section key={a.nom} id={`acte-${i + 1}`} className="cb-acte" data-acte={i + 1}>
            <div className="cb-acte__texte">
              <p className="cb-acte__num" data-montee><span className="cb-mono">{deux(i + 1)}</span><span className="cb-mono">{a.nom}</span></p>
              <Lignes lignes={a.titre} className="cb-acte__titre" />
              <p className="cb-acte__corps" data-montee>{a.texte}</p>
              {a.note && <p className="cb-mono cb-acte__note" data-montee>{a.note}</p>}
              {a.bouton && (
                <div data-montee>
                  <button type="button" className="cb-shuffle" data-shuffle data-aimant data-curseur={a.bouton}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7h3.2c2 0 3.1.9 4.3 2.6l2 2.8c1.2 1.7 2.3 2.6 4.3 2.6h3.2M3.5 17h3.2c1.6 0 2.6-.6 3.6-1.7M14 8.7c1-1.1 2-1.7 3.6-1.7h2.9M18 4.5 20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5" /></svg>
                    {a.bouton}
                  </button>
                </div>
              )}
            </div>
          </section>
        ))}
      </main>

      <section className="cb-fin">
        <Lignes lignes={c.fin} className="cb-fin__titre" />
        <div className="cb-fin__bas" data-montee>
          <p>{c.finTexte}</p>
          <div className="cb-fin__actions">
            <Link href={demo} className="cb-pastille cb-pastille--grand" data-aimant data-curseur={c.demo}>{c.demo}<span aria-hidden="true">→</span></Link>
            <Link href={`/${lang}/connexion?inscription=1`} className="cb-lien">{c.compte}</Link>
          </div>
        </div>
      </section>

      <div className="acc cb-pied-boite">
        <footer className="acc-pied acc-nuit">
          <div className="acc-grille acc-pied__haut">
            <div className="acc-pied__marque">
              <p>{t.pied.editeur} · {t.pied.meubles}</p>
              <p className="acc-mono"><span>{c.heure}</span> <span data-horloge>—</span></p>
            </div>
            <nav className="acc-pied__nav" aria-label="RealRoom">
              <Link href={`/${lang}`}>{c.actuelle}</Link>
              <Link href={demo}>{c.demo}</Link>
              <Link href={`/${lang}/connexion`}>{t.nav.connexion}</Link>
            </nav>
            <nav className="acc-pied__nav" aria-label="Infos">
              <Link href={`/${lang}/legal/mentions`}>{t.pied.mentions}</Link>
              <Link href={`/${lang}/legal/cgv`}>{t.pied.cgv}</Link>
              <Link href={`/${lang}/legal/confidentialite`}>{t.pied.confidentialite}</Link>
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
            <a href="#cb-haut">↑</a>
          </div>
        </footer>
      </div>
      <Spectacle />
    </div>
  );
}
