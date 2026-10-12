// Banc d'essai de l'aménagement : pièces synthétiques (aucun plan client), plans vus du
// dessus en SVG et mesures (remplissage, relations, variété des dispositions).
// node scripts/banc-amenagement.mjs [dossier-de-sortie] [nombre-de-variations] [cas,separes,par,virgules]
import fs from 'node:fs/promises';
import path from 'node:path';
import { PRODUITS } from '../lib/catalogue.js';
import { choisirCandidats } from '../lib/selection.js';
import { preparerAmenagement, appliquerProposition } from '../lib/amenagement.js';
import { posesStaging } from '../lib/staging.js';
import { boite, estMural, estSuspendu } from '../lib/agencement.js';
import { contourDe, segmentsDe, pointOuverture } from '../lib/contour.js';
import { rectangle } from '../tests/fixtures/bench-chambres.js';
import { sejour89 } from '../tests/fixtures/staging.js';
import { evaluerRemplissage } from '../lib/remplissage.js';
import { scoreRelations } from '../lib/relations-zones.js';

const sortie = path.resolve(process.argv[2] || '.data/banc-amenagement');
const nbVariations = +(process.argv[3] || 4), filtre = process.argv[4] ? process.argv[4].split(',') : null;
await fs.mkdir(sortie, { recursive: true });

// Séjour 45 m² : une baie sur le grand mur, deux portes (entrée et cuisine).
function sejour45() {
  const m = rectangle(9, 5);
  m.murs.fond.ouvertures = [{ type: 'fenetre', position: -1.5, largeur: 2, hauteur: 1.4, allege: .9 }];
  m.murs.droite.ouvertures = [{ type: 'porte', position: 1, largeur: .9, hauteur: 2.05, allege: 0 }];
  return m;
}
export const CAS = [
  { id: 'salon-18', fonction: 'salon', modele: () => rectangle(4.5, 4), envies: 'Salon chaleureux' },
  { id: 'salon-24', fonction: 'salon', modele: () => rectangle(6, 4), envies: 'Salon contemporain' },
  { id: 'salon-30', fonction: 'salon', modele: () => rectangle(6, 5), envies: 'Salon chaleureux' },
  { id: 'sejour-45', fonction: 'salon', modele: sejour45, envies: 'Séjour scandinave lumineux' },
  { id: 'sejour-89', fonction: 'salon', modele: sejour89, envies: 'Salon chaleureux' },
  { id: 'chambre-10', fonction: 'chambre', modele: () => rectangle(3, 3.5), envies: 'Chambre japandi' },
  { id: 'chambre-16', fonction: 'chambre', modele: () => rectangle(4, 4, 2), envies: 'Chambre chaleureuse avec un coin lecture' },
  { id: 'chambre-20', fonction: 'chambre', modele: () => rectangle(4, 5), envies: 'Chambre contemporaine, coin bureau' },
  { id: 'bureau-12', fonction: 'bureau', modele: () => rectangle(3.5, 3.5), envies: 'Bureau scandinave' },
  { id: 'sam-15', fonction: 'salle_a_manger', modele: () => rectangle(5, 3), envies: 'Salle à manger classique' }
];

const r2 = n => Math.round(n * 100) / 100;
function executer(cas, variation) {
  const modele = cas.modele(), prep = preparerAmenagement([], { budget: 0, envies: cas.envies, encyclopedie: true, variation });
  const candidats = choisirCandidats(PRODUITS, { modele, fonction: cas.fonction, ...prep });
  const t = Date.now();
  const r = appliquerProposition({ modele, prep, fonction: cas.fonction, produits: PRODUITS, proposition: { meubles: [] }, candidats });
  return { modele, r, ms: Date.now() - t };
}
export function mesurer(cas, modele, r) {
  const p = r.proposition, zones = p.planZones?.zones || [];
  const stage = p.staging ? posesStaging(r.agencement, p.staging, PRODUITS).filter(it => !['surface_item', 'wall_item', 'ceiling_item'].includes(it.kind)) : [];
  const catalogue = { ...PRODUITS, ...Object.fromEntries(stage.filter(it => it.p).map(it => [it.id, it.p])) };
  const avecProps = [...r.agencement, ...stage.map(it => ({ ...it, sku: it.sku || it.id }))];
  const rem = evaluerRemplissage(modele, avecProps, catalogue, { zones, preferences: p.preferences });
  const rel = scoreRelations(modele, zones, r.agencement, PRODUITS, cas.fonction);
  const signature = zones.map(z => `${z.type}:${z.dispositionUid || '-'}:${Math.round((z.x0 + z.x1) / 2)},${Math.round((z.z0 + z.z1) / 2)}:${r2(z.rot || 0)}`).sort().join('|');
  return {
    zones: zones.map(z => ({ type: z.type, disposition: z.dispositionUid || null })), signature,
    remplissage: { score: rem.score, vide: rem.vide, equilibre: rem.equilibre, regles: rem.regles.map(x => x.id) },
    relations: { score: rel.score, regles: rel.regles.map(x => x.id) },
    meubles: r.agencement.filter(it => it.garde !== false).length, props: stage.length,
    audit: p.planZones?.audit?.valide ?? null, manquants: (p.programme?.manquants || []).filter(s => s.obligatoire).map(s => s.usage),
    harmonie: p.harmonie?.score ?? null
  };
}

// ---------- dessin ----------
const COULEURS = { canape: '#C9714F', fauteuil: '#D9A066', table: '#8C6E52', lit: '#7A8FA6', meuble: '#6E6259', buffet: '#6E6259', armoire: '#5B5048', commode: '#6E6259',
  etagere: '#6E6259', bureau: '#5E7C6B', chaise: '#9BB0A0', tapis: '#E6DCCB', lampadaire: '#E3C15A', lampe: '#E3C15A', tv: '#2B2F36', 'tv-murale': '#2B2F36', plante: '#7FA36B', console: '#6E6259' };
const ZONES = { salon: '#C9714F', repas: '#8C6E52', lecture: '#D9A066', travail: '#5E7C6B', rangement: '#6E6259', couchage: '#7A8FA6', cuisine: '#4F7FA6', bar: '#A64F7F', accueil: '#999', cafe: '#999', bibliotheque: '#6E6259' };
export function dessiner(modele, r, titre) {
  const L = modele.dims.largeur, P = modele.dims.profondeur, ech = Math.min(560 / L, 420 / P), m = 24;
  const X = x => m + (x + L / 2) * ech, Z = z => m + 22 + (z + P / 2) * ech;
  const w = Math.ceil(L * ech + 2 * m), h = Math.ceil(P * ech + 2 * m + 22);
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Arial" font-size="9">`,
    `<rect width="${w}" height="${h}" fill="#FAF8F4"/>`, `<text x="${m}" y="16" font-size="12" font-weight="bold">${titre}</text>`];
  out.push(`<polygon points="${contourDe(modele).map(([x, z]) => `${X(x)},${Z(z)}`).join(' ')}" fill="#fff" stroke="#333" stroke-width="2"/>`);
  for (const pan of segmentsDe(modele)) for (const o of modele.murs?.[pan.id]?.ouvertures || []) {
    const a = pointOuverture(pan, o.position - o.largeur / 2), b = pointOuverture(pan, o.position + o.largeur / 2);
    out.push(`<line x1="${X(a[0])}" y1="${Z(a[1])}" x2="${X(b[0])}" y2="${Z(b[1])}" stroke="${o.type === 'fenetre' ? '#5AA9E6' : '#E05A47'}" stroke-width="5"/>`);
  }
  const p = r.proposition;
  for (const z of p.planZones?.zones || []) {
    out.push(`<rect x="${X(z.x0)}" y="${Z(z.z0)}" width="${(z.x1 - z.x0) * ech}" height="${(z.z1 - z.z0) * ech}" fill="none" stroke="${ZONES[z.type] || '#999'}" stroke-dasharray="4 3"/>`);
    out.push(`<text x="${X(z.x0) + 2}" y="${Z(z.z0) - 2}" fill="${ZONES[z.type] || '#666'}">${z.type}${z.dispositionUid ? ' ' + z.dispositionUid : ''}</text>`);
  }
  const stage = p.staging ? posesStaging(r.agencement, p.staging, PRODUITS).filter(it => !['surface_item', 'wall_item', 'ceiling_item'].includes(it.kind)) : [];
  const elements = [...r.agencement.filter(it => it.garde !== false).map(it => ({ it, p: PRODUITS[it.sku] || it.p, prop: false })), ...stage.map(it => ({ it, p: it.p, prop: true }))]
    .filter(e => e.p?.dim && !estSuspendu(e.p.fam)).sort((a, b) => Number(b.p.fam === 'tapis') - Number(a.p.fam === 'tapis'));
  for (const { it, p: q, prop } of elements) {
    const [dw, dd] = q.dim, a = -(it.rot || 0) * 180 / Math.PI;
    const fill = prop ? '#DADADA' : COULEURS[q.fam] || '#B9A58F';
    if (estMural(q.fam)) { const b = boite(it, [dw, .08, 1]); out.push(`<rect x="${X(b.x0)}" y="${Z(b.z0)}" width="${(b.x1 - b.x0) * ech}" height="${(b.z1 - b.z0) * ech}" fill="#333"/>`); continue; }
    out.push(`<g transform="translate(${X(it.x)},${Z(it.z)}) rotate(${a})"><rect x="${-dw / 2 * ech}" y="${-dd / 2 * ech}" width="${dw * ech}" height="${dd * ech}" fill="${fill}" fill-opacity="${q.fam === 'tapis' ? .6 : .9}" stroke="#333" stroke-width=".6"/>`
      + (prop ? '' : `<line x1="${-dw / 2 * ech}" y1="${dd / 2 * ech}" x2="${dw / 2 * ech}" y2="${dd / 2 * ech}" stroke="#000" stroke-width="2"/>`) + `</g>`);
    if (!prop && q.fam !== 'tapis') out.push(`<text x="${X(it.x)}" y="${Z(it.z) + 3}" text-anchor="middle" font-size="8" fill="#000">${(it.usageProgramme || q.fam).slice(0, 14)}</text>`);
  }
  out.push('</svg>');
  return out.join('');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bilan = [];
  for (const cas of CAS.filter(c => !filtre || filtre.includes(c.id))) {
    const essais = [];
    for (let v = 0; v < nbVariations; v++) {
      let res;
      try { res = executer(cas, v); } catch (e) { essais.push({ variation: v, erreur: String(e.message).slice(0, 200) }); continue; }
      const mesure = mesurer(cas, res.modele, res.r);
      essais.push({ variation: v, ms: res.ms, ...mesure });
      await fs.writeFile(path.join(sortie, `${cas.id}-v${v}.svg`), dessiner(res.modele, res.r, `${cas.id} · variation ${v} · remplissage ${mesure.remplissage.score} · relations ${mesure.relations.score}`));
    }
    const ok = essais.filter(e => !e.erreur);
    const resume = { cas: cas.id, essais: essais.length, erreurs: essais.length - ok.length, plansDistincts: new Set(ok.map(e => e.signature)).size,
      dispositions: [...new Set(ok.flatMap(e => e.zones.map(z => z.disposition).filter(Boolean)))],
      remplissage: ok[0]?.remplissage, relations: ok[0]?.relations, moyenneRemplissage: r2(ok.reduce((s, e) => s + e.remplissage.score, 0) / (ok.length || 1)),
      moyenneRelations: r2(ok.reduce((s, e) => s + e.relations.score, 0) / (ok.length || 1)), auditsValides: ok.filter(e => e.audit).length, manquants: ok[0]?.manquants, ms: ok[0]?.ms };
    bilan.push({ ...resume, essaisDetail: essais });
    console.log(JSON.stringify(resume));
  }
  await fs.writeFile(path.join(sortie, 'bilan.json'), JSON.stringify(bilan, null, 1));
}
