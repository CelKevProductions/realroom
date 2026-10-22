import { notFound } from 'next/navigation';
import DemoRespace from '@/components/DemoRespace.js';
import { connecteOuConnexion } from '@/lib/session.js';
import { sql } from '@/lib/db.js';
import { PRODUITS } from '@/lib/catalogue.js';
import { TYPES_PROGRAMME } from '@/lib/programme.js';
import { etatVariantes } from '@/lib/variation-disposition.js';
import { configRespace } from '@/lib/moteurs/respace.js';

export const metadata = { title: 'Démo ReSpace', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Démo privée et non commerciale de ReSpace : invisible tant qu'elle n'est pas configurée.
export default async function PageRespace({ params }) {
  const { lang } = await params;
  if (!configRespace().actif) notFound();
  const u = await connecteOuConnexion(lang);
  const lignes = await sql(`SELECT x.id, x.nom, x.fonction, x.modele, x.agencement, x.proposition, pr.nom AS projet
    FROM pieces x JOIN projets pr ON pr.id = x.projet_id
    WHERE x.utilisateur_id = $1 AND x.modele IS NOT NULL ORDER BY x.maj_le DESC LIMIT 40`, [u.id]);
  const pieces = lignes.filter(p => TYPES_PROGRAMME.includes(p.fonction)).map(p => {
    const c = etatVariantes(p);
    return { id: p.id, nom: p.nom, projet: p.projet, modele: p.modele, agencement: p.agencement || [], prete: !!c && !c.obsolete,
      variantes: c?.etat.liste.length || 0 };
  });
  const skus = new Set(pieces.flatMap(p => p.agencement.map(it => it.sku)).filter(Boolean));
  const produits = Object.fromEntries([...skus].filter(s => PRODUITS[s]).map(s => [s, { fam: PRODUITS[s].fam, dim: PRODUITS[s].dim }]));
  return <DemoRespace lang={lang} pieces={pieces} produits={produits} />;
}
