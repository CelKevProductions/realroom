// Lecture d'un relevé déposé dans « Nouveau projet » : zip Lagarsoft (Lagarscan), JSON RoomPlan ou
// plan DXF. Tout se lit dans le navigateur ; seul le relevé normalisé part ensuite au serveur, qui
// refait la même validation (comme dans l'atelier, components/piece/Acquisition.js).
// On en tire aussi ce que le scan laisse deviner : type de pièce, coins (cuisine, repas), pente.
import { depuisScan, normaliserScan, MAX_SCAN_OCTETS, ErreurScan } from '@/lib/scan.js';
import { estZip, scanDepuisArchive, MAX_ARCHIVE_OCTETS, MAX_JSON_OCTETS } from '@/lib/archive-scan.js';
import { lireDXF } from '@/lib/plans.js';
import { contourDe } from '@/lib/contour.js';
import { estInstallation } from '@/lib/usages.js';
import { ESPACES_PAR_FONCTION } from '@/lib/espaces.js';
import { TYPES_PROGRAMME } from '@/lib/programme.js';

const echec = code => { throw new ErreurScan(code); };

// Fichier déposé -> { genre: 'scan', brut } ou { genre: 'dxf', texte, resultat }
export async function lireFichier(fichier) {
  if (!fichier) echec('scan-format');
  if (/\.dxf$/i.test(fichier.name || '')) {
    if (fichier.size > 5e6) echec('plan-taille');
    const texte = await fichier.text();
    return { genre: 'dxf', texte, resultat: lireDXF(texte) };
  }
  if (fichier.size > MAX_ARCHIVE_OCTETS) echec('trop-gros');
  const octets = new Uint8Array(await fichier.arrayBuffer());
  if (estZip(octets)) return { genre: 'scan', brut: await scanDepuisArchive(octets) };
  if (octets.length > MAX_JSON_OCTETS) echec('trop-gros');
  try { return { genre: 'scan', brut: JSON.parse(new TextDecoder().decode(octets)) }; }
  catch (_) { echec(/\.(usdz|pdf|png|jpe?g)$/i.test(fichier.name || '') ? 'scan-autre' : 'scan-format'); }
}

// Relevé brut -> relevé normalisé (celui qu'on enverra), plan et meubles, indices
export function preparerReleve(brut, origine = 'scan') {
  const scan = normaliserScan(brut);
  if (new TextEncoder().encode(JSON.stringify(scan)).length > MAX_SCAN_OCTETS - 10000) echec('trop-gros');
  const { modele, agencement } = depuisScan(scan);
  return { scan, modele, agencement, origine, indices: indices(brut, scan, agencement) };
}

// Sections d'un CapturedStructure (iOS 17) : livingRoom, bedroom, kitchen, diningRoom, bathroom…
function sections(brut) {
  const listes = [brut?.sections, brut?.structure?.sections, ...(Array.isArray(brut?.rooms) ? brut.rooms.map(r => r?.sections) : [])];
  const labels = listes.filter(Array.isArray).flat().map(x => String(x?.label || x?.category || '').trim()).filter(Boolean);
  return [...new Set(labels.map(l => l.replace(/[^a-zA-Z]/g, '').toLowerCase()))];
}

const TYPE_SECTION = { livingroom: 'salon', bedroom: 'chambre', diningroom: 'salle_a_manger', bathroom: 'salle_de_bain', kitchen: 'salon' };

function indices(brut, scan, agencement) {
  const vues = sections(brut);
  const noms = agencement.map(it => String(it.p?.nom || '').toLowerCase());
  const fams = agencement.map(it => it.p?.fam);
  const appareils = agencement.some(it => it.p?.fam === 'cuisine' && !/lave-linge/i.test(it.p?.nom || ''));
  // type de pièce : d'abord ce que dit le scan, puis ce qu'on y voit
  let fonction = null;
  if (vues.includes('livingroom')) fonction = 'salon';
  else if (vues.includes('bedroom')) fonction = 'chambre';
  else if (vues.includes('diningroom')) fonction = 'salle_a_manger';
  else if (vues.includes('bathroom')) fonction = 'salle_de_bain';
  else if (vues.includes('kitchen')) fonction = 'salon';
  if (!fonction) {
    if (fams.includes('lit')) fonction = 'chambre';
    else if (fams.includes('baignoire') || noms.some(n => /sanitaire/.test(n))) fonction = 'salle_de_bain';
    else if (fams.some(f => ['canape', 'fauteuil', 'tv', 'tv-murale'].includes(f))) fonction = 'salon';
  }
  const devine = !!fonction;
  fonction = TYPES_PROGRAMME.includes(fonction) ? fonction : 'salon';
  // coins de la pièce vus dans le scan
  const chaises = fams.filter(f => f === 'chaise').length, tables = fams.filter(f => f === 'table').length;
  const espaces = [];
  if (vues.includes('kitchen') || appareils) espaces.push('cuisine');
  if (vues.includes('diningroom') || (tables && chaises >= 2)) espaces.push('repas');
  const possibles = ESPACES_PAR_FONCTION[fonction] || [];
  // pente de toit : des murs nettement plus bas que les autres (sous les combles)
  const hauteurs = (scan.walls || []).map(w => w.size?.[1]).filter(Number.isFinite);
  const pente = hauteurs.length > 2 && Math.max(...hauteurs) - Math.min(...hauteurs) > .4
    ? { bas: Math.min(...hauteurs), haut: Math.max(...hauteurs) } : null;
  const incertains = [...(scan.walls || []), ...(scan.openings || []), ...(scan.objects || [])].some(e => e.confidence && e.confidence !== 'high');
  return { fonction, devine, sections: vues.filter(v => TYPE_SECTION[v]), espaces: espaces.filter(e => possibles.includes(e)), espacesVus: espaces, pente, incertains,
    placesRepas: chaises >= 2 ? Math.max(2, Math.min(10, Math.round(chaises / 2) * 2)) : null };
}

// Résumé lisible du plan : surface, cotes, ouvertures, meubles regroupés
export function resumePlan(modele, agencement) {
  const ps = contourDe(modele);
  const surface = Math.abs(ps.reduce((acc, q, i) => { const r = ps[(i + 1) % ps.length]; return acc + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  const ouv = Object.values(modele.murs || {}).flatMap(m => m.ouvertures || []);
  const meubles = agencement.filter(it => !estInstallation(it));
  const installations = agencement.filter(estInstallation);
  return {
    surface, largeur: modele.dims.largeur, profondeur: modele.dims.profondeur, hauteur: modele.dims.hauteur,
    hauteurMesuree: modele.dims.sources?.hauteur !== 'estimation',
    portes: ouv.filter(o => o.type === 'porte' || o.type === 'passage').length, fenetres: ouv.filter(o => o.type === 'fenetre').length,
    meubles, installations
  };
}

// « Canapé détecté » -> « Canapé »
export const nomCourt = it => String(it.p?.nom || '').replace(/\s+détecté(e)?$/i, '').trim() || 'Objet';

// meubles regroupés par nom : [{ nom, n, ids }]
export function regrouper(items) {
  const g = new Map();
  for (const it of items) { const k = nomCourt(it); g.set(k, [...(g.get(k) || []), it.id]); }
  return [...g].map(([nom, ids]) => ({ nom, n: ids.length, ids }));
}
