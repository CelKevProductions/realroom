// Claude « architecte » : trois partis d'aménagement pour une pièce, dans un vocabulaire fermé
// (mur d'appui de chaque espace, relations aux fenêtres, aux portes et aux autres espaces).
// Claude ne donne aucune coordonnée : le moteur garde ses règles dures (accès, passages, portes)
// et un parti ne fait que préférer, parmi les placements valables, ceux qui le respectent.
// Module pur (pas de réseau) : il sert au serveur et au moteur de la démo dans le navigateur.
import { segmentsDe, contourDe, pointOuverture, distanceSegment } from './contour.js';
import { boite, estAuSol, estPlat, estMural, estSuspendu, produitDe } from './agencement.js';
import { roleFonctionDe } from './roles.js';
import { intituleUsage } from './programme-textes.js';

export const RELATIONS = ['pres_fenetre', 'loin_fenetre', 'face_fenetre', 'dos_fenetre', 'fenetre_de_cote',
  'pres_porte', 'loin_porte', 'voit_porte', 'dans_un_coin', 'au_centre',
  'pres_espace', 'loin_espace', 'dos_a_espace', 'face_a_espace'];
const ENTRE_ESPACES = new Set(['pres_espace', 'loin_espace', 'dos_a_espace', 'face_a_espace']);
// Un parti départage des placements valables ; il ne vaut jamais un meuble perdu (zonage.js).
const POIDS_MUR = 60, POIDS_RELATION = 20;

const r2 = n => Math.round(n * 100) / 100;
const avant = it => ({ x: Math.sin(it.rot || 0), z: Math.cos(it.rot || 0) });
const unitaire = (dx, dz) => { const n = Math.hypot(dx, dz) || 1; return { x: dx / n, z: dz / n }; };

// Côté du plan vu de dessus (x vers la droite, z vers le bas) : aide Claude à se repérer.
function cotePlan(pan) {
  const [nx, nz] = pan.n.map(v => -v), mots = [];
  if (nz < -.38) mots.push('haut'); else if (nz > .38) mots.push('bas');
  if (nx < -.38) mots.push('gauche'); else if (nx > .38) mots.push('droite');
  return mots.join('-') || 'centre';
}
function ouvertures(modele, garder) {
  return segmentsDe(modele).flatMap(pan => (modele.murs?.[pan.id]?.ouvertures || []).filter(garder)
    .map(o => { const p = pointOuverture(pan, o.position); return { ...o, x: p[0], z: p[1], pan: pan.id }; }));
}
const fenetresDe = modele => ouvertures(modele, o => ['fenetre', 'baie'].includes(o.type));
// une baie sans allège est aussi un passage
const portesDe = modele => ouvertures(modele, o => ['porte', 'passage'].includes(o.type) || o.type === 'baie' && !(o.allege > .05));

/* ---------------------------------------------------------------
   Description de la pièce envoyée à Claude (aucun meuble à placer)
   --------------------------------------------------------------- */
export function decrirePiece({ modele, fonction, programme, fixes = [], produits = {}, langue = 'fr' }) {
  const pans = segmentsDe(modele);
  const murs = pans.map(pan => ({
    id: pan.id, cote: cotePlan(pan), de: pan.a.map(r2), a: pan.b.map(r2), longueur: r2(pan.long),
    ouvertures: (modele.murs?.[pan.id]?.ouvertures || []).map(o => ({
      type: o.type, centre: pointOuverture(pan, o.position).map(r2), largeur: r2(o.largeur || .9),
      ...(o.allege ? { allege: r2(o.allege) } : {}), ...(o.destination || o.usage ? { vers: o.destination || o.usage } : {}) }))
  }));
  const elements = fixes.map(it => {
    const p = produitDe(it, produits) || it.p || {}, dim = p.dim || [0, 0, 0];
    const dos = { x: it.x - Math.sin(it.rot || 0) * dim[1] / 2, z: it.z - Math.cos(it.rot || 0) * dim[1] / 2 };
    const mur = [...pans].sort((a, b) => distanceSegment([dos.x, dos.z], a.a, a.b) - distanceSegment([dos.x, dos.z], b.a, b.b))[0];
    return { nom: p.nom || it.id, famille: p.fam || null, centre: [r2(it.x), r2(it.z)], largeur: r2(dim[0]), profondeur: r2(dim[1]),
      contre_mur: mur && distanceSegment([dos.x, dos.z], mur.a, mur.b) < .3 ? mur.id : null };
  });
  const espaces = (programme?.zones || []).map(z => ({ id: z.id, libelle: z.libelle || z.id, demande: !!z.demandee,
    meubles: [...new Set(z.slots.filter(s => s.obligatoire !== false).map(s => intituleUsage(s.usage, langue)))] }));
  return { fonction, surface_m2: r2(Math.abs(aire(contourDe(modele)))), hauteur: modele.dims?.hauteur || null,
    repere: 'Metres, plan seen from above, origin at the room centre: x grows to the right, z grows downwards (towards the bottom of the plan).',
    contour: contourDe(modele).map(p => p.map(r2)), murs, elements_fixes: elements, espaces };
}
function aire(ps) { let s = 0; for (let i = 0; i < ps.length; i++) { const a = ps[i], b = ps[(i + 1) % ps.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }

/* ---------------------------------------------------------------
   Schéma de réponse (construit pour la pièce : murs et espaces connus)
   --------------------------------------------------------------- */
export function schemaPartis(modele, programme) {
  const murs = [...segmentsDe(modele).map(p => p.id), 'centre', 'indifferent'];
  const espaces = (programme?.zones || []).map(z => z.id);
  const objet = props => ({ type: 'object', additionalProperties: false, required: Object.keys(props), properties: props });
  const parti = objet({
    titre: { type: 'string' },
    idee: { type: 'string' },
    espaces: { type: 'array', items: objet({
      espace: { type: 'string', enum: espaces },
      adosse_a: { type: 'string', enum: murs },
      relations: { type: 'array', items: objet({ type: { type: 'string', enum: RELATIONS }, cible: { anyOf: [{ type: 'string', enum: espaces }, { type: 'null' }] } }) }
    }) }
  });
  return objet({ partis: { type: 'array', items: parti } });
}

// Réponse du modèle -> au plus trois partis utilisables (murs, espaces et relations connus).
export function normaliserPartis(json, modele, programme) {
  const murs = new Set([...segmentsDe(modele).map(p => p.id), 'centre']);
  const espaces = new Set((programme?.zones || []).map(z => z.id));
  const vus = new Set();
  return (Array.isArray(json?.partis) ? json.partis : []).map(p => {
    const parti = { titre: String(p?.titre || '').slice(0, 80).trim(), idee: String(p?.idee || '').slice(0, 300).trim(), espaces: {} };
    for (const e of Array.isArray(p?.espaces) ? p.espaces : []) {
      if (!espaces.has(e?.espace) || parti.espaces[e.espace]) continue;
      const relations = (Array.isArray(e.relations) ? e.relations : []).filter(q => RELATIONS.includes(q?.type)
        && (!ENTRE_ESPACES.has(q.type) || espaces.has(q.cible) && q.cible !== e.espace))
        .slice(0, 4).map(q => ({ type: q.type, ...(ENTRE_ESPACES.has(q.type) ? { cible: q.cible } : {}) }));
      const adosse = murs.has(e.adosse_a) ? e.adosse_a : null;
      if (adosse || relations.length) parti.espaces[e.espace] = { ...(adosse ? { adosse_a: adosse } : {}), relations };
    }
    return parti;
  }).filter(p => {
    const cle = JSON.stringify(p.espaces);
    if (!Object.keys(p.espaces).length || vus.has(cle)) return false;
    vus.add(cle); return true;
  }).slice(0, 3).map((p, i) => ({ ...p, titre: p.titre || `Idée ${i + 1}` }));
}

// Pour redemander d'autres partis sans répéter les précédents.
export const resumePartis = partis => (partis || []).map(p => ({ titre: p.titre, espaces: p.espaces }));

// Partis reçus dans une demande (la démo les apporte depuis le serveur) : forme seulement,
// un mur ou un espace inconnu de la pièce ne correspond simplement à rien.
export function nettoyerPartis(liste) {
  const nom = v => typeof v === 'string' && /^[\w-]{1,40}$/.test(v);
  return (Array.isArray(liste) ? liste : []).slice(0, 12).filter(p => p && typeof p === 'object' && p.espaces && typeof p.espaces === 'object')
    .map(p => ({ titre: String(p.titre || '').slice(0, 80), idee: String(p.idee || '').slice(0, 300),
      espaces: Object.fromEntries(Object.entries(p.espaces).slice(0, 12).filter(([id, e]) => nom(id) && e && typeof e === 'object').map(([id, e]) => [id, {
        ...(nom(e.adosse_a) ? { adosse_a: e.adosse_a } : {}),
        relations: (Array.isArray(e.relations) ? e.relations : []).slice(0, 4).filter(q => RELATIONS.includes(q?.type) && (!ENTRE_ESPACES.has(q.type) || nom(q.cible)))
          .map(q => ({ type: q.type, ...(ENTRE_ESPACES.has(q.type) ? { cible: q.cible } : {}) }))
      }])) }))
    .filter(p => Object.keys(p.espaces).length);
}

/* ---------------------------------------------------------------
   Score d'un placement candidat (lib/zonage.js)
   --------------------------------------------------------------- */
const ANCRES = { salon: ['canape', 'salon-exterieur'], repas: ['table-repas'], couchage: ['lit'], lecture: ['fauteuil-lecture', 'fauteuil'],
  travail: ['bureau'], rangement: ['buffet', 'armoire', 'etagere', 'vaisselier', 'rangement'], accueil: ['console', 'rangement'],
  cuisine: ['ilot-cuisine'], bar: ['comptoir-bar'], vasque: ['vasque'] };
function sol(items, cat) {
  return items.filter(it => it.garde !== false).map(it => ({ it, p: produitDe(it, cat) }))
    .filter(e => e.p?.dim && estAuSol(e.p.fam) && !estPlat(e.p.fam) && !estMural(e.p.fam) && !estSuspendu(e.p.fam) && e.it.kind !== 'surface_item');
}
// meuble principal de l'espace et centre de son emprise au sol
export function repereEspace(type, items, cat) {
  const es = sol(items, cat);
  if (!es.length) return null;
  const usages = ANCRES[type] || [];
  const ancre = es.find(e => usages.includes(e.it.usageProgramme)) || es.find(e => usages.includes(roleFonctionDe(e.it, e.p)))
    || [...es].sort((a, b) => b.p.dim[0] * b.p.dim[1] - a.p.dim[0] * a.p.dim[1])[0];
  const bs = es.map(e => boite(e.it, e.p.dim));
  const b = { x0: Math.min(...bs.map(q => q.x0)), x1: Math.max(...bs.map(q => q.x1)), z0: Math.min(...bs.map(q => q.z0)), z1: Math.max(...bs.map(q => q.z1)) };
  return { ancre: ancre.it, dim: ancre.p.dim, boite: b, centre: { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 } };
}
const plusProche = (os, p) => os.length ? [...os].sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] : null;

function satisfaction(type, rep, modele, pans) {
  const f = avant(rep.ancre), c = rep.centre;
  const vers = o => { const v = unitaire(o.x - rep.ancre.x, o.z - rep.ancre.z); return f.x * v.x + f.z * v.z; };
  const fenetre = plusProche(fenetresDe(modele), c), porte = plusProche(portesDe(modele), c);
  const loin = (o, echelle) => o ? Math.min(1, Math.hypot(o.x - c.x, o.z - c.z) / echelle) : null;
  switch (type) {
    case 'pres_fenetre': return fenetre ? 1 - loin(fenetre, 3.5) : null;
    case 'loin_fenetre': return loin(fenetre, 3.5);
    case 'face_fenetre': return fenetre ? Math.max(0, vers(fenetre)) : null;
    case 'dos_fenetre': return fenetre ? Math.max(0, -vers(fenetre)) : null;
    case 'fenetre_de_cote': return fenetre ? 1 - Math.abs(vers(fenetre)) : null;
    case 'pres_porte': return porte ? 1 - loin(porte, 4) : null;
    case 'loin_porte': return loin(porte, 4);
    case 'voit_porte': return porte ? Math.max(0, vers(porte)) : null;
    case 'dans_un_coin': {
      const b = rep.boite, coins = [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]];
      const touches = pans.filter(pan => Math.min(...coins.map(q => distanceSegment(q, pan.a, pan.b))) < .4);
      const angle = touches.some((a, i) => touches.slice(i + 1).some(q => Math.abs(a.n[0] * q.n[0] + a.n[1] * q.n[1]) < .5));
      return angle ? 1 : touches.length ? .3 : 0;
    }
    case 'au_centre': {
      const ps = contourDe(modele), cx = ps.reduce((s, p) => s + p[0], 0) / ps.length, cz = ps.reduce((s, p) => s + p[1], 0) / ps.length;
      return Math.max(0, 1 - Math.hypot(c.x - cx, c.z - cz) / 1.6);
    }
    default: return null;
  }
}

// Bonus d'un ensemble posé (une zone du programme) selon le parti.
export function scoreParti(zone, poses, cat, modele, parti) {
  const choix = parti?.espaces?.[zone.id];
  if (!choix) return 0;
  const rep = repereEspace(zone.type, poses, cat);
  if (!rep) return 0;
  const pans = segmentsDe(modele);
  let score = 0;
  if (choix.adosse_a) {
    const f = avant(rep.ancre), dos = { x: rep.ancre.x - f.x * rep.dim[1] / 2, z: rep.ancre.z - f.z * rep.dim[1] / 2 };
    const distances = pans.map(pan => ({ pan, d: distanceSegment([dos.x, dos.z], pan.a, pan.b) }));
    if (choix.adosse_a === 'centre') score += POIDS_MUR * Math.min(1, Math.min(...distances.map(q => q.d)) / 1);
    else {
      const cible = distances.find(q => q.pan.id === choix.adosse_a);
      if (cible) {
        const aligne = f.x * cible.pan.n[0] + f.z * cible.pan.n[1] > .7;
        score += POIDS_MUR * Math.max(0, 1 - cible.d / .8) * (aligne ? 1 : .3);
      }
    }
  }
  for (const q of choix.relations || []) {
    const s = satisfaction(q.type, rep, modele, pans);
    if (s != null) score += POIDS_RELATION * s;
  }
  return score;
}

// Relations entre deux ensembles, comptées quand le second est posé (planifierZones).
export function scorePartiEntreZones(parti, zone, items, zonesPosees, itemsPoses, cat) {
  if (!parti?.espaces || !zonesPosees.length) return 0;
  let score = 0;
  const reperes = new Map([[zone.id, repereEspace(zone.type, items, cat)]]);
  const repere = z => {
    if (!reperes.has(z.id)) reperes.set(z.id, repereEspace(z.type, itemsPoses.filter(it => it.zoneId === z.id), cat));
    return reperes.get(z.id);
  };
  const evaluer = (type, a, b) => {
    if (!a || !b) return null;
    const d = Math.hypot(a.centre.x - b.centre.x, a.centre.z - b.centre.z), f = avant(a.ancre), v = unitaire(b.centre.x - a.ancre.x, b.centre.z - a.ancre.z);
    if (type === 'pres_espace') return Math.max(0, 1 - d / 4);
    if (type === 'loin_espace') return Math.min(1, d / 5);
    if (type === 'dos_a_espace') return Math.max(0, -(f.x * v.x + f.z * v.z));
    if (type === 'face_a_espace') return Math.max(0, f.x * v.x + f.z * v.z);
    return null;
  };
  for (const autre of zonesPosees) {
    for (const [de, vers] of [[zone, autre], [autre, zone]]) {
      for (const q of parti.espaces[de.id]?.relations || []) {
        if (q.cible !== vers.id || !ENTRE_ESPACES.has(q.type)) continue;
        const s = evaluer(q.type, repere(de), repere(vers));
        if (s != null) score += POIDS_RELATION * s;
      }
    }
  }
  return score;
}

// Avant de lancer le moteur : faut-il des partis de Claude ? Toujours pour « Aménager » ;
// pour Shuffle, quand ceux déjà reçus sont tous montrés (au plus neuf par pièce), avec le brief
// et les meubles de départ de la première proposition.
export function partisAttendus(piece, demande) {
  const action = demande?.action || 'generer';
  if (action === 'generer') return { deja: [], brief: demande, agencement: piece?.agencement || [] };
  const etat = piece?.proposition?.variantes, a = etat?.architecte;
  return action === 'shuffle' && a && a.prochain >= a.partis.length && a.partis.length < 9
    ? { deja: a.partis, brief: etat.brief, agencement: etat.source || [] } : null;
}
