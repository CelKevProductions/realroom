// Recherche macro bornée : déplacer des ensembles complets, puis réserver leurs accès.
// Les rectangles viennent des dimensions du catalogue, jamais d'une sortie du modèle.
import { boite, estAuSol, estPlat, estMural, estSuspendu, estPosable, porteurDe, produitDe, zonesPortes, normaliserAngle } from './agencement.js';
import { contientBoite, contientPoint, segmentsDe, pointOuverture, distanceSegment, zoneOuverture } from './contour.js';
import { roleFonctionDe } from './roles.js';
import { correspondSlot, correspondEmplacement, surfacePiece } from './programme.js';
import { intersectionZones, dansZone } from './zones-geometrie.js';
import { bilanConfort } from './confort.js';
import {grainesEncyclopedie,evaluerDisposition,verifierReglesDures,scoreReglesEncyclopedie} from './encyclopedie.js';
import { evaluerDensite, repartitionZones } from './composition-surface.js';
import { circulationZones } from './circulation-zones.js';
import { verifierHauteurs } from './hauteurs.js';
import { scoreVariation, ancresDisposition, dispositionsDistinctes } from './variation-disposition.js';
import { noteComposition } from './qualite-composition.js';

// Poids de la note de composition dans le score d'un ensemble candidat. Plus fort, il évince des
// ensembles complets (repas) au profit d'un salon mieux posé ; réglé sur le banc et les tests unitaires.
const POIDS_COMPOSITION = .2;

const r = n => Math.round(n * 100) / 100;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dilater = (b, m) => ({ x0: b.x0 - m, x1: b.x1 + m, z0: b.z0 - m, z1: b.z1 + m });
const pointDans = (p, b) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1;
const local = (it, x, z) => ({ x: it.x + Math.cos(it.rot || 0) * x + Math.sin(it.rot || 0) * z, z: it.z - Math.sin(it.rot || 0) * x + Math.cos(it.rot || 0) * z });
const zoneLocale = (it, x, z, w, d) => boite({ ...local(it, x, z), rot: it.rot || 0 }, [w, d, 1]);
const donnees = (items, cat) => items.filter(it => it.garde !== false).map(it => ({ it, p: produitDe(it, cat) })).filter(e => e.p?.dim).map(e => ({ ...e, role: roleFonctionDe(e.it, e.p), b: boite(e.it, e.p.dim) }));
const auSol = es => es.filter(e => estAuSol(e.p.fam) && !estPlat(e.p.fam) && !porteurDe(e.it, e.p, es));

export function degagementsProgramme(e) {
  const { it, p, role } = e, [w, d] = p.dim;
  if(it.usageProgramme==='console-dos')return [zoneLocale(it,0,d/2+.45,w,.9)];
  if(it.usageProgramme==='ilot-cuisine')return [zoneLocale(it,0,-d/2-.5,w,1)];
  if(it.usageProgramme==='tabouret-bar')return [zoneLocale(it,0,-d/2-.375,w,.75)];
  if (role === 'lit') return [zoneLocale(it, 0, d / 2 + .325, w, .65),
    zoneLocale(it, -w / 2 - .3, .325, .6, Math.max(.4, d - .65)), zoneLocale(it, w / 2 + .3, .325, .6, Math.max(.4, d - .65))];
  if (role === 'chaise') { const recul = it.usageProgramme === 'chaise-bureau' ? .8 : .75; return [zoneLocale(it, 0, -d / 2 - recul / 2, w, recul)]; }
  if (role === 'repas') return [zoneLocale(it, 0, d / 2 + .4, w, .8), zoneLocale(it, 0, -d / 2 - .4, w, .8), zoneLocale(it, -w / 2 - .4, 0, .8, d), zoneLocale(it, w / 2 + .4, 0, .8, d)];
  if (it.usageProgramme === 'baignoire-ilot') return [dilater(e.b, .6)];
  const profondeur = role === 'rangement' ? .8 : role === 'bureau' ? .8 : ['canape', 'fauteuil', 'meridienne'].includes(role) ? .32 : 0;
  return profondeur ? [zoneLocale(it, 0, d / 2 + profondeur / 2, w * .88, profondeur)] : [];
}

function accesValides(modele, es) {
  const sol = auSol(es);
  for (const e of sol) for (const b of degagementsProgramme(e)) {
    if (!contientBoite(modele, b)) return false;
    if (sol.some(q => q.it.id !== e.it.id && !(e.role === 'repas' && ['chaise', 'tabouret'].includes(q.role) && (!e.it.zoneId || q.it.zoneId === e.it.zoneId))
      && !(e.role === 'bureau' && q.it.usageProgramme === 'chaise-bureau' && q.it.zoneId === e.it.zoneId)
      && intersectionZones(b, q.b) > .025)) return false;
  }
  return true;
}

function rattacher(items, catalogue, programme) {
  const slots = programme.zones.flatMap(z => z.slots), utilises = new Set(items.map(it => it.slotProgramme).filter(Boolean));
  return items.map(it => {
    if (it.garde === false || programme.zones.some(z => z.id === it.zoneId)) return { ...it };
    if (it.zoneId) it = { ...it, zoneId: undefined, usageProgramme: undefined, slotProgramme: undefined };
    const p = produitDe(it, catalogue), slot = slots.find(s => !utilises.has(s.id) && correspondSlot(p, s.usage, programme.fonction));
    if (slot) { utilises.add(slot.id); return { ...it, zoneId: slot.zone, usageProgramme: slot.usage, slotProgramme: slot.id, prioriteProgramme: slot.priorite }; }
    const role = roleFonctionDe(it, p || {});
    const type = ['tv', 'tv-murale', 'canape', 'table-basse'].includes(role) ? 'salon' : role === 'lit' || role === 'appoint' ? 'couchage'
      : role === 'rangement' ? 'rangement' : role === 'bureau' ? 'travail' : null;
    return type && programme.zones.some(z => z.id === type) ? { ...it, zoneId: type } : { ...it };
  });
}

function patronGroupe(type, entrees, lumiereLaterale = false, reserverTV = false) {
  const poses = new Map(), compte = new Map();
  const chercher = usages => entrees.find(e => usages.includes(e.it.usageProgramme) || usages.includes(e.role));
  const poser = (e, x, z, rot = 0, y) => { if (e) poses.set(e.it.id, { ...e.it, x, z, rot, ...(y != null ? { y } : {}) }); };
  const dim = e => e?.p.dim || [0, 0, 0];
  const lit = chercher(['lit']), sofa = chercher(['canape', 'salon-exterieur']), table = chercher(['table-repas']), bureau = chercher(['bureau']);
  const meubleTV = chercher(['meuble-tv']), tv = chercher(['tv', 'tv-murale']);
  const fauteuil = chercher(['fauteuil-lecture', 'fauteuil']), vasque = chercher(['vasque']);
  if (type === 'couchage' && lit) {
    poser(lit, 0, dim(lit)[1] / 2);
    const chevets = entrees.filter(e => e.it.usageProgramme === 'chevet' || e.role === 'appoint');
    chevets.forEach((e, i) => poser(e, (i % 2 ? 1 : -1) * (dim(lit)[0] / 2 + dim(e)[0] / 2 + .06), dim(e)[1] / 2 + .05));
    entrees.filter(e => e.it.usageProgramme === 'lampe-chevet').forEach((e, i) => { const a = chevets[i % chevets.length]; if (a) { const q = poses.get(a.it.id); poser(e, q.x, q.z, 0, dim(a)[2] + dim(e)[2] / 2); } });
    const banc = chercher(['banc']); if (banc) poser(banc, 0, dim(lit)[1] + .75 + dim(banc)[1] / 2, Math.PI);
  } else if (type === 'salon' && sofa) {
    poser(sofa, 0, dim(sofa)[1] / 2);
    const basse = chercher(['table-basse']);
    const chaises = entrees.filter(e => e.role === 'fauteuil');
    const decalage = chaises.length === 1 ? -.15 : 0;
    if (basse) poser(basse, decalage, dim(sofa)[1] + .42 + dim(basse)[1] / 2);
    const finTable = basse ? poses.get(basse.it.id).z + dim(basse)[1] / 2 : dim(sofa)[1] + .9;
    const tvZ = Math.max(2.55, finTable + 1.05 + dim(meubleTV || tv)[1] / 2);
    poser(meubleTV, 0, tvZ, Math.PI);
    if (tv) poser(tv, 0, tvZ, Math.PI, meubleTV ? dim(meubleTV)[2] + dim(tv)[2] / 2 : tv.it.y);
    chaises.forEach((e, i) => { const cote = i % 2 ? -1 : 1; poser(e, decalage + cote * ((basse ? dim(basse)[0] / 2 : .3) + dim(e)[1] / 2 + .33), basse ? poses.get(basse.it.id).z : 1.5, cote > 0 ? -Math.PI / 2 : Math.PI / 2); });
    const lumiere = chercher(['lumiere-salon']);
    if (lumiere && estPosable(lumiere.p.fam, dim(lumiere)) && meubleTV) {
      // Le quart du plateau chevauchait l'écran : l'audit vertical supprimait
      // alors la télévision. Réserver son volume avant de poser la lampe.
      const place = (dim(meubleTV)[0] - dim(lumiere)[0]) / 2 - .015;
      const largeurEcran = tv ? dim(tv)[0] : reserverTV ? Math.min(1.24,dim(meubleTV)[0]-.04) : 0;
      if (place - dim(lumiere)[0] / 2 >= largeurEcran / 2 + .01)
        poser(lumiere, -place, tvZ, Math.PI, dim(meubleTV)[2] + dim(lumiere)[2] / 2);
      else if (basse && dim(basse)[0] >= dim(lumiere)[0] + .04 && dim(basse)[1] >= dim(lumiere)[1] + .04)
        poser(lumiere, poses.get(basse.it.id).x - (dim(basse)[0] - dim(lumiere)[0]) / 2 + .02, poses.get(basse.it.id).z, 0, dim(basse)[2] + dim(lumiere)[2] / 2);
    }
    else if (lumiere && !estMural(lumiere.p.fam)) {
      // À côté du canapé : devant un meuble TV large, la lampe rendait tout
      // le salon compact impossible en obstruant ses 80 cm d'accès.
      if (lumiereLaterale) poser(lumiere, -dim(sofa)[0] / 2 - dim(lumiere)[0] / 2 - .15, dim(sofa)[1] / 2);
      else {
        const finAssises = Math.max(finTable + .12, ...chaises.map(e => poses.get(e.it.id).z + dim(e)[0] / 2 + .08));
        poser(lumiere, -dim(sofa)[0] / 2 + dim(lumiere)[0] / 2, finAssises + dim(lumiere)[1] / 2);
      }
    }
    const tapis = chercher(['tapis']); if (tapis) poser(tapis, 0, basse ? poses.get(basse.it.id).z : dim(sofa)[1]);
  } else if (type === 'repas' && table) {
    poser(table, 0, 0);
    const chaises = entrees.filter(e => e.it.usageProgramme === 'chaise-repas' || ['chaise', 'tabouret'].includes(e.role));
    const parCote = Math.ceil(chaises.length / 2);
    chaises.forEach((e, i) => { const cote = i < parCote ? 1 : -1, rang = i % parCote;
      const ecart = Math.max(dim(e)[0] + .08, dim(table)[0] / parCote);
      poser(e, (rang - (parCote - 1) / 2) * ecart, cote * (dim(table)[1] / 2 + dim(e)[1] / 2 + .08), cote > 0 ? Math.PI : 0); });
    entrees.filter(e => estSuspendu(e.p.fam)).forEach((e, i) => poser(e, i ? dim(table)[0] / 4 : 0, 0, 0, dim(table)[2] + .725 + dim(e)[2] / 2));
  } else if (['cuisine', 'bar'].includes(type)) {
    const comptoir = chercher(['ilot-cuisine', 'comptoir-bar']);
    if (comptoir) {
      poser(comptoir, 0, 0);
      const tabourets = entrees.filter(e => e.p.fam === 'tabouret');
      tabourets.forEach((e, i) => poser(e, (i - (tabourets.length - 1) / 2) * .65, dim(comptoir)[1] / 2 + dim(e)[1] / 2 + .12, Math.PI));
    }
  } else if (type === 'travail' && bureau) {
    poser(bureau, 0, dim(bureau)[1] / 2);
    const chaise = chercher(['chaise-bureau']); poser(chaise, 0, dim(bureau)[1] + .15 + dim(chaise)[1] / 2, Math.PI);
    const lampe = chercher(['lampe-bureau']); poser(lampe, -dim(bureau)[0] / 4, dim(bureau)[1] / 2, 0, dim(bureau)[2] + dim(lampe)[2] / 2);
  } else if (type === 'lecture' && fauteuil) {
    poser(fauteuil, 0, dim(fauteuil)[1] / 2);
    const appoint = chercher(['table-appoint', 'appoint']); poser(appoint, dim(fauteuil)[0] / 2 + dim(appoint)[0] / 2 + .12, dim(fauteuil)[1] / 2);
    const lampe = chercher(['lumiere-lecture']);
    if (lampe && estPosable(lampe.p.fam, dim(lampe)) && appoint) { const q = poses.get(appoint.it.id); poser(lampe, q.x, q.z, 0, dim(appoint)[2] + dim(lampe)[2] / 2); }
    else poser(lampe, -dim(fauteuil)[0] / 2 - dim(lampe)[0] / 2 - .15, dim(lampe)[1] / 2);
  } else if (type === 'vasque' && vasque) poser(vasque, 0, dim(vasque)[1] / 2);
  // Les rangements/accueil/baignoires ou un ensemble incomplet restent des rangées
  // fonctionnelles, pas des objets dispersés au hasard.
  let x = 0;
  for (const e of entrees) {
    if (poses.has(e.it.id) || estMural(e.p.fam) || estSuspendu(e.p.fam) || estPlat(e.p.fam)) continue;
    poser(e, x + dim(e)[0] / 2, dim(e)[1] / 2); x += dim(e)[0] + .18;
  }
  for (const e of entrees.filter(e => !poses.has(e.it.id))) {
    const a = chercher(type === 'accueil' ? ['console', 'rangement'] : type === 'vasque' ? ['vasque'] : ['repas', 'canape', 'lit', 'rangement']) || entrees[0];
    const q = poses.get(a?.it.id) || { x: 0, z: 0 };
    poser(e, q.x, estMural(e.p.fam) ? 0 : q.z, 0, estMural(e.p.fam) ? 1.475 : e.it.y);
  }
  const places = entrees.map(e => ({ it: poses.get(e.it.id), p: e.p }));
  return places.map(({ it, p }) => {
    const support = porteurDe(it, p, places);
    return support ? { ...it, kind: 'surface_item', attach_to: { type: 'furniture', id: support.it.id } } : it;
  });
}

function transformer(items, angle, dx, dz) { return items.map(it => ({ ...it, x: r(dx + Math.cos(angle) * it.x + Math.sin(angle) * it.z), z: r(dz - Math.sin(angle) * it.x + Math.cos(angle) * it.z), rot: normaliserAngle((it.rot || 0) + angle) })); }
function emprise(es) {
  const sol = es.filter(e => estAuSol(e.p.fam) && !porteurDe(e.it, e.p, es));
  const bs = (sol.length ? sol : es).map(e => e.b);
  return { x0: Math.min(...bs.map(b => b.x0)), x1: Math.max(...bs.map(b => b.x1)), z0: Math.min(...bs.map(b => b.z0)), z1: Math.max(...bs.map(b => b.z1)) };
}
function ouvertures(modele, types) { return segmentsDe(modele).flatMap(pan => (modele.murs?.[pan.id]?.ouvertures || []).filter(o => types.includes(o.type)).map(o => { const p = pointOuverture(pan, o.position); return { ...o, x: p[0], z: p[1], pan }; })); }
function scoreLocal(type, items, cat, modele) {
  const es = donnees(items, cat), b = emprise(es), centre = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
  const fenetres = ouvertures(modele, ['fenetre', 'baie']), portes = ouvertures(modele, ['porte', 'passage']);
  const proche = os => os.length ? Math.min(...os.map(o => distance(o, centre))) : 0;
  let score = 0;
  if (['repas', 'lecture'].includes(type) && fenetres.length) score += 4 / (1 + proche(fenetres));
  if (type === 'repas') { const cuisine = portes.filter(o => o.destination === 'cuisine' || o.usage === 'cuisine'); if (cuisine.length) score += 4 / (1 + proche(cuisine)); }
  if (type === 'travail' && fenetres.length) {
    const bureau = es.find(e => e.role === 'bureau');
    if (bureau) {
      const lateral = fenetres.some(o => Math.abs(((o.x - bureau.it.x) * Math.sin(bureau.it.rot || 0) + (o.z - bureau.it.z) * Math.cos(bureau.it.rot || 0)) / Math.max(.01, distance(o, bureau.it))) < .5);
      score += lateral ? 3 : -8;
      const lampe = es.find(e => e.it.usageProgramme === 'lampe-bureau');
      if (lampe) {
        const f = [...fenetres].sort((a, b) => distance(a, bureau.it) - distance(b, bureau.it))[0], a = bureau.it.rot || 0;
        const cote = q => (q.x - bureau.it.x) * Math.cos(a) - (q.z - bureau.it.z) * Math.sin(a);
        if (cote(f) * cote(lampe.it) < 0) score += 2;
      }
    }
  }
  if (['lecture', 'couchage'].includes(type) && portes.length) score += Math.min(3, proche(portes));
  if (type === 'salon') {
    const tv = es.find(e => ['tv', 'tv-murale'].includes(e.role) || e.it.usageProgramme === 'meuble-tv');
    if (tv) { const faceFenetre = fenetres.some(o => ((o.x - tv.it.x) * Math.sin(tv.it.rot) + (o.z - tv.it.z) * Math.cos(tv.it.rot)) / Math.max(.01, distance(o, tv.it)) > .8); score += faceFenetre ? -8 : 6; }
    if (es.some(e => e.role === 'canape') && tv) score += 5;
  }
  const ancre = es.find(e => ['lit', 'canape', 'rangement', 'bureau'].includes(e.role));
  if (ancre && ancre.it.dispositionUid!=='SL:1.2') { const dos = local(ancre.it, 0, -ancre.p.dim[1] / 2); score -= Math.min(...segmentsDe(modele).map(p => distanceSegment([dos.x, dos.z], p.a, p.b))) * 20; }
  return score;
}

export function candidatsGroupe(modele, zone, items, cat, obstacles, lumiereLaterale = false, contexte = {}) {
  const reserverTV = zone.slots?.some(s=>s.usage==='television');
  const es = donnees(items, cat), base=patronGroupe(zone.type, es, lumiereLaterale,reserverTV), graines=grainesEncyclopedie(zone,items,cat,base);
  const ancre = { salon: ['canape', 'salon-exterieur'], repas: ['table-repas', 'repas'], couchage: ['lit'], lecture: ['fauteuil', 'fauteuil-lecture'], travail: ['bureau'] }[zone.type];
  if (ancre && !es.some(e => ancre.includes(e.it.usageProgramme) || ancre.includes(e.role))) return [];
  if (['salon', 'lecture', 'travail'].includes(zone.type)) for(const g of [...graines])graines.push({...g,items:g.items.map(it => ({ ...it, x: -it.x, rot: normaliserAngle(-(it.rot || 0)) }))});
  const facultatifs = es.filter(e => e.it.obligatoireProgramme === false);
  if (facultatifs.length) {const obligatoires=items.filter(it=>!facultatifs.some(q=>q.it.id===it.id));graines.push(...grainesEncyclopedie(zone,obligatoires,cat,patronGroupe(zone.type,donnees(obligatoires,cat),lumiereLaterale,reserverTV)));}
  const portes = zonesPortes(modele), fenetres = ouvertures(modele, ['fenetre']).map(o => ({ ...zoneOuverture(o.pan, o, .4), allege: o.allege || 0 })), L = modele.dims.largeur, P = modele.dims.profondeur, sortie = [], vus = new Set();
  const angles = [...new Set([0, Math.PI / 2, Math.PI, -Math.PI / 2, ...segmentsDe(modele).map(p => r(Math.atan2(p.n[0], p.n[1])))])].slice(0, 10);
  for (const graine of graines) {
    const patron=graine.items;
    if (!patron.length) continue;
    const fixes = patron.filter(it => it.fixe);
    for (const angle of angles) {
      const tournes = transformer(patron, angle, 0, 0), b = emprise(donnees(tournes, cat));
      const translations = [];
      if (fixes.length) {
        const avant = items.find(it => it.id === fixes[0].id), q = tournes.find(it => it.id === avant.id);
        if (Math.abs(normaliserAngle((avant.rot || 0) - q.rot)) > .03) continue;
        translations.push([avant.x - q.x, avant.z - q.z]);
      } else {
        const protection = donnees(tournes, cat).flatMap(e => degagementsProgramme(e));
        const protege = { x0: Math.min(b.x0, ...protection.map(q => q.x0)), x1: Math.max(b.x1, ...protection.map(q => q.x1)), z0: Math.min(b.z0, ...protection.map(q => q.z0)), z1: Math.max(b.z1, ...protection.map(q => q.z1)) };
        const xmin = -L / 2 - protege.x0 + .02, xmax = L / 2 - protege.x1 - .02, zmin = -P / 2 - protege.z0 + .02, zmax = P / 2 - protege.z1 - .02;
        if (xmin > xmax || zmin > zmax) continue;
        const nX = Math.min(13, Math.max(1, Math.ceil((xmax - xmin) / .35))), nZ = Math.min(13, Math.max(1, Math.ceil((zmax - zmin) / .35)));
        for (let i = 0; i <= nX; i++) for (let j = 0; j <= nZ; j++) translations.push([xmin + (xmax - xmin) * i / nX, zmin + (zmax - zmin) * j / nZ]);
        // Coins et pans du vrai polygone, y compris les décrochements intérieurs.
        for (const pan of segmentsDe(modele)) for (const t of [-.65, 0, .65]) {
          const centre = pointOuverture(pan, t * pan.long / 2), profondeur = Math.abs(pan.n[0]) * (b.x1 - b.x0) / 2 + Math.abs(pan.n[1]) * (b.z1 - b.z0) / 2;
          translations.push([centre[0] + pan.n[0] * (profondeur + .02) - (b.x0 + b.x1) / 2, centre[1] + pan.n[1] * (profondeur + .02) - (b.z0 + b.z1) / 2]);
        }
      }
      for (const [dx, dz] of translations) {
        let poses = transformer(patron, angle, dx, dz);
        if (fixes.some(it => { const a = items.find(q => q.id === it.id), q = poses.find(q => q.id === it.id); return distance(a, q) > .025 || Math.abs(normaliserAngle((a.rot || 0) - q.rot)) > .03; })) continue;
        poses = poses.map(it => it.fixe ? { ...items.find(q => q.id === it.id), zoneId: zone.id } : it);
        const cle = poses.map(it => `${it.id}:${it.x}:${it.z}:${r(it.rot)}`).join('|'); if (vus.has(cle)) continue;
        const donne = donnees(poses, cat), sol = auSol(donne), bbox = emprise(donne);
        if (zone.surfaceMax && (bbox.x1 - bbox.x0) * (bbox.z1 - bbox.z0) > zone.surfaceMax * 1.5) continue;
        // L'enveloppe d'un ensemble contient du vide : elle n'est pas un mur.
        // Vérifier chaque meuble permet les pièces en L et les accès partagés.
        if (sol.some(e => !contientBoite(modele, e.b) || portes.some(p => intersectionZones(e.b, p) > .001))) continue;
        if (!accesValides(modele, donne)) continue;
        if (sol.some((e, i) => sol.slice(i + 1).some(q => intersectionZones(e.b, q.b, .025) > .0001))) continue;
        if (sol.some(e => obstacles.some(q => intersectionZones(e.b, q.b, .025) > .0001))) continue;
        // L'allège est une observation, pas une hypothèse de vitrage toute hauteur.
        if (sol.some(e => fenetres.some(o => (e.role === 'lit' || e.p.dim[2] > o.allege + .08) && intersectionZones(e.b, o) > .005))) continue;
        const encyclo=evaluerDisposition(modele,poses,cat,graine,zone);if(!encyclo.valide)continue;
        const reglementaire=zone.encyclopedie?verifierReglesDures(modele,poses,cat,zone.profil):null;if(reglementaire&&!reglementaire.valide)continue;
        vus.add(cle);
        const complete = poses.length === items.length;
        // note de composition (pénalité) : seulement pour le zonage principal d'un séjour qui s'y prête
        const qualite = contexte.composer ? noteComposition(modele, poses, cat, { equilibre: false }).penalite : 0;
        const centre=[(bbox.x0+bbox.x1)/2,(bbox.z0+bbox.z1)/2];
        const voisinage=(contexte.table?20/(1+Math.hypot(centre[0]-contexte.table.x,centre[1]-contexte.table.z)):0)+scoreVariation(zone,poses,contexte.variation);
        const panProche=contexte.table?[...segmentsDe(modele)].sort((a,b)=>distanceSegment(centre,a.a,a.b)-distanceSegment(centre,b.a,b.b))[0]:null;
        const cloison=panProche&&Math.abs(panProche.centre[0])<L/2-.1&&Math.abs(panProche.centre[1])<P/2-.1?4:0;
        sortie.push({ items: poses, zone: { ...bbox, id: zone.id, type: zone.type, libelle: zone.libelle, rot: angle, meubles: poses.map(it => it.id),...(graine.disposition?{dispositionSource:graine.disposition.id,dispositionUid:graine.disposition.uid,geometrieSource:graine.disposition.geometrie}:{}),...(zone.encyclopedie?{encyclopedie:zone.encyclopedie}: {}) }, qualite, score: -POIDS_COMPOSITION*qualite+voisinage+cloison+encyclo.score+(zone.encyclopedie?scoreReglesEncyclopedie(poses,cat).score:0)+scoreLocal(zone.type, poses, cat, modele) - (items.length - poses.length) * (zone.surfaceMax ? 8 : 3), complete });
      }
    }
  }
  // Garder de la diversité de position et d'orientation, pas 48 voisins d'un seul coin.
  if (!sortie.length && zone.type === 'salon' && !lumiereLaterale && es.some(e => e.it.usageProgramme === 'lumiere-salon' && e.p.fam === 'lampadaire'))
    return candidatsGroupe(modele, zone, items, cat, obstacles, true,contexte);
  const groupes = new Map();
  for (const c of sortie.sort((a, b) => b.score - a.score)) { const key = `${r(c.zone.rot)}:${Math.floor(c.zone.x0)}:${Math.floor(c.zone.z0)}:${c.complete}`; const g = groupes.get(key) || []; if (g.length < 2) g.push(c); groupes.set(key, g); }
  const tries = [...groupes.values()].flat().sort((a, b) => b.score - a.score);
  if (zone.surfaceMax && L * P > 20) {
    const secteurs = new Map();
    for (const c of tries) {
      const key = `${r(c.zone.rot)}:${Math.floor(((c.zone.x0 + c.zone.x1) / 2 + L / 2) / (L / 3))}:${Math.floor(((c.zone.z0 + c.zone.z1) / 2 + P / 2) / (P / 3))}:${c.complete}`;
      if (!secteurs.has(key)) secteurs.set(key, c);
    }
    // En séjour intermédiaire, préserver les variantes voisines qui font tenir
    // les trois ensembles ; le grand open-space admet un échantillonnage plus large.
    return [...new Set([...tries.slice(0, L * P > 40 ? 32 : 72), ...secteurs.values()])].slice(0, L * P > 40 ? 104 : 144).concat(contexte.composer ? mieuxComposes(sortie, tries) : []);
  }
  return tries.slice(0, 72).concat(contexte.composer ? mieuxComposes(sortie, tries.slice(0, 72)) : []);
}
// En plus des candidats retenus par le score habituel, les mieux composés (écran au mur, assises tournées vers le salon).
// Seulement pour le zonage principal (contexte.composer) : la mise en scène et les compléments n'en tirent rien.
function mieuxComposes(sortie, retenus) {
  const deja = new Set(retenus);
  // seulement les ensembles complets : une note de composition ne doit jamais récompenser un meuble en moins
  return sortie.filter(c => c.complete && !deja.has(c)).sort((a, b) => (b.score - b.qualite) - (a.score - a.qualite)).slice(0, 16);
}

function cheminsEnveloppes(modele, zones, items, cat, largeur = .9) {
  const L = modele.dims.largeur, P = modele.dims.profondeur, rayon = largeur / 2, pas = Math.max(.1, Math.sqrt(L * P / 6500));
  const nx = Math.ceil(L / pas), nz = Math.ceil(P / pas), dx = L / nx, dz = P / nz, n = nx * nz;
  const coord = i => ({ x: -L / 2 + (i % nx + .5) * dx, z: -P / 2 + (Math.floor(i / nx) + .5) * dz });
  const es = donnees(items, cat), obstacles = [...zones.map(z => dilater(z, rayon)), ...auSol(es).filter(e => !e.it.zoneId).map(e => dilater(e.b, rayon))];
  const libre = new Uint8Array(n), vu = new Uint8Array(n), parent = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) { const p = coord(i); libre[i] = contientPoint(modele, p.x, p.z, rayon) && !obstacles.some(b => pointDans(p, b)) ? 1 : 0; }
  const proche = (p, limite) => { let idx = -1, d = limite; for (let i = 0; i < n; i++) if (libre[i] && distance(p, coord(i)) < d) { d = distance(p, coord(i)); idx = i; } return idx; };
  const portes = ouvertures(modele, ['porte', 'passage', 'baie']).filter(o => o.type !== 'baie' || !(o.allege > .05)).sort((a, b) => Number(b.pan.id === 'entree' || b.usage === 'entree') - Number(a.pan.id === 'entree' || a.usage === 'entree'));
  const seeds = portes.map(o => proche({ x: o.x + o.pan.n[0] * .6, z: o.z + o.pan.n[1] * .6 }, .3));
  const depart = seeds.length ? seeds[0] : proche({ x: 0, z: 0 }, Math.max(L, P));
  const file = []; if (depart >= 0) { file.push(depart); vu[depart] = 1; }
  for (let k = 0; k < file.length; k++) { const i = file[k], x = i % nx, z = Math.floor(i / nx);
    for (const j of [x ? i - 1 : -1, x < nx - 1 ? i + 1 : -1, z ? i - nx : -1, z < nz - 1 ? i + nx : -1]) if (j >= 0 && libre[j] && !vu[j]) { vu[j] = 1; parent[j] = i; file.push(j); }
  }
  const chemins = [], inaccessibles = [];
  for (const zone of zones) {
    let cible = -1, min = Infinity;
    for (const i of file) { const p = coord(i); const d = Math.hypot(Math.max(zone.x0 - p.x, 0, p.x - zone.x1), Math.max(zone.z0 - p.z, 0, p.z - zone.z1)); if (d <= rayon + pas * 1.6 && d < min) { min = d; cible = i; } }
    if (cible < 0) { inaccessibles.push(zone.id); continue; }
    const points = []; for (let i = cible; i >= 0; i = parent[i]) points.push(coord(i));
    chemins.push({ vers: zone.id, largeur, points: points.reverse().map(p => ({ x: r(p.x), z: r(p.z) })) });
  }
  return { largeur, portesConnues: portes.length > 0, portesBloquees: seeds.filter(i => i < 0 || !vu[i]).length, inaccessibles, chemins, valide: depart >= 0 && seeds.every(i => i >= 0 && vu[i]) && !inaccessibles.length };
}

export function cheminsZones(modele, zones, items, cat, largeur = .9) {
  if (largeur > .9) return cheminsEnveloppes(modele, zones, items, cat, largeur);
  const sol = auSol(donnees(items, cat));
  const calcul = circulationZones(modele, sol, zonesPortes(modele), largeur, { chemins: true });
  const zoneParMeuble = new Map(sol.map(e => [e.it.id, e.it.zoneId]));
  const chemins = calcul.chemins.map(c => ({ ...c, vers: zoneParMeuble.get(c.meuble) })).filter(c => c.vers);
  return { largeur, portesConnues: calcul.portesConnues, portesBloquees: calcul.portesBloquees,
    inaccessibles: [...new Set(calcul.inaccessibles.map(id => zoneParMeuble.get(id) || id))], chemins,
    valide: calcul.departValide && !calcul.portesBloquees && !calcul.inaccessibles.length };
}

export function planifierZones(modele, items, catalogue, programme, reduction = 0) {
  if (!programme) return { items, plan: null };
  const rattaches = rattacher(items, catalogue, programme), es = donnees(rattaches, catalogue);
  const sansZone = es.filter(e => !e.it.zoneId), obstacles = auSol(sansZone), manquants = [], statistiques = { candidats: 0, combinaisons: 0, plansVerifies: 0 };
  let etats = [{ items: sansZone.map(e => e.it), zones: [], score: 0 }];
  // Une orientation de bureau imposée par la fenêtre laisse moins de choix
  // qu'un îlot libre. La réserver tôt évite de perdre cette activité après les bars.
  const ordre=[...programme.zones].sort((a,b)=>{
    const priorite=z=>programme.encyclopedie&&z.type==='travail'?Math.min(z.priorite,1.5):z.priorite;
    return priorite(a)-priorite(b);
  });
  if(programme.encyclopedie)statistiques.ordreComposition=ordre.map(z=>z.id);
  // la note de composition ne départage que les pièces qui ont un salon (canapé, écran, fauteuils)
  // Séjours jusqu'à 40 m² seulement : au-delà, le moteur passe en open space (composition-surface.js),
  // où la note n'a pas été réglée et coûte cher ; le classement habituel y reste inchangé.
  const salon = programme.zones.some(z => z.type === 'salon') && !programme.compositionSurface?.openSpace && surfacePiece(modele) <= 40;
  for (const zone of ordre) {
    const meubles = rattaches.filter(it => it.garde !== false && it.zoneId === zone.id);
    if (!meubles.length) continue;
    const candidats = candidatsGroupe(modele, zone, meubles, catalogue, obstacles, false, {variation:programme.variation, composer:salon}); statistiques.candidats += candidats.length;
    const suites = [];
    for (const etat of etats) for (const c of candidats) {
      statistiques.combinaisons++;
      // En grand séjour, réserver les couloirs de 110 cm entre activités ;
      // dans chaque ensemble, les accès précis restent contrôlés séparément.
      if (programme.compositionSurface?.openSpace && etat.zones.some(z => intersectionZones(z, c.zone, programme.compositionSurface.largeurCirculation) > .001)) continue;
      const liste = [...etat.items, ...c.items];
      const donne = donnees(liste, catalogue), sol = auSol(donne);
      if (sol.some((e, i) => sol.slice(i + 1).some(q => intersectionZones(e.b, q.b, .025) > .0001))) continue;
      if (!accesValides(modele, donne)) continue;
      if(programme.encyclopedie&&!verifierReglesDures(modele,liste,catalogue,programme.encyclopedie.profil).valide)continue;
      const zones = [...etat.zones, c.zone];
      const repartition = programme.compositionSurface?.maxM2ParElement ? repartitionZones(modele, zones).score : 0;
      suites.push({ items: liste, zones, scoreLocal: (etat.scoreLocal || 0) + c.score, score: (etat.scoreLocal || 0) + c.score + repartition });
    }
    if (!suites.length) {
      if (meubles.some(it => it.fixe)) return { items, plan: { version: 'zones-1', statut: 'conservation', zones: [], chemins: [], statistiques, avertissements: ['Le mobilier conservé ne permet pas de déplacer cet ensemble : le placement existant est préservé.'] } };
      manquants.push({ zone: zone.id, motif: 'surface-ou-acces', meubles: meubles.map(it => it.id) }); continue;
    }
    const signatures = new Map();
    for (const s of suites.sort((a, b) => b.score - a.score)) { const cle = s.zones.map(z => `${z.id}:${Math.floor((z.x0 + z.x1) / 2)}:${Math.floor((z.z0 + z.z1) / 2)}:${r(z.rot)}`).join('|'); if (!signatures.has(cle)) signatures.set(cle, s); }
    // Conserver aussi les ensembles complets les mieux placés localement : la
    // répartition spatiale ne doit pas éliminer un coin encore à composer.
    if (programme.compositionSurface?.maxM2ParElement && !programme.compositionSurface.openSpace) {
      const locaux = [...suites].sort((a, b) => b.scoreLocal - a.scoreLocal);
      const positions = new Map();
      for (const s of suites) {
        const z = s.zones.at(-1), L = modele.dims.largeur, P = modele.dims.profondeur;
        const cle = `${r(z.rot)}:${Math.floor(((z.x0 + z.x1) / 2 + L / 2) / (L / 3))}:${Math.floor(((z.z0 + z.z1) / 2 + P / 2) / (P / 3))}`;
        if (!positions.has(cle)) positions.set(cle, s);
      }
      etats = [...new Set([...suites.slice(0, 24), ...locaux.slice(0, 16), ...[...positions.values()].slice(0, 24)])];
    } else etats = [...new Set([...suites.slice(0, 32), ...[...signatures.values()].slice(0, 32)])];
    // Garder aussi les états les mieux composés, que le score habituel aurait écartés (séjours seulement).
    if (!salon) continue;
    const plein = Math.max(...suites.map(s => s.items.length));
    const composes = suites.filter(s => s.items.length === plein).map(s => ({ s, q: s.score - noteComposition(modele, s.items, catalogue, { equilibre: false }).penalite })).sort((a, b) => b.q - a.q).slice(0, 16).map(x => x.s);
    etats = [...new Set([...etats, ...composes])];
  }
  const largeurCirculation = programme.compositionSurface?.largeurCirculation || .9;
  const verifies = etats.slice(0, 64).map(e => {
    statistiques.plansVerifies++;
    const circulation = cheminsZones(modele, e.zones, e.items, catalogue, largeurCirculation), confort = bilanConfort(modele, e.items, catalogue);
    const densite = evaluerDensite(modele, e.items, catalogue, programme, { zones: e.zones, circulation }, { phase: 'macro' });
    const qualite = salon ? noteComposition(modele, e.items, catalogue) : { penalite: 0 };
    return { ...e, circulation, confort, densite, qualite, score: (e.scoreLocal ?? e.score) + (densite?.score || 0) + (circulation.valide ? 5 : -50 * (circulation.portesBloquees + circulation.inaccessibles.length)) };
  });
  verifies.sort((a, b) => a.confort.score.contraintes - b.confort.score.contraintes || Number(b.confort.acces && b.confort.circulation !== false) - Number(a.confort.acces && a.confort.circulation !== false) || Number(b.circulation.valide) - Number(a.circulation.valide) || b.score - a.score);
  // La composition départage ensuite les plans aussi valides que le gagnant habituel et qui posent exactement
  // les mêmes meubles : elle ne fait jamais perdre un meuble, même facultatif. Pendant un Shuffle, seuls
  // concourent les plans différents des propositions déjà vues, quand il y en a.
  const meubles = v => v.items.filter(it => it.garde !== false).map(it => it.id).sort().join(',');
  const validite = v => [v.confort.score.contraintes, Number(v.confort.acces && v.confort.circulation !== false), Number(v.circulation.valide)].join(':');
  const tete = verifies[0], eviter = programme.variation?.eviter || [];
  const pairs = tete && salon ? verifies.filter(v => validite(v) === validite(tete) && meubles(v) === meubles(tete)) : [];
  const nouveaux = eviter.length ? pairs.filter(v => eviter.every(avant => dispositionsDistinctes(ancresDisposition(v.items), avant))) : [];
  const meilleur = !pairs.length ? tete : (nouveaux.length ? nouveaux : pairs).reduce((a, b) => (b.score - b.qualite.penalite > a.score - a.qualite.penalite ? b : a));
  if (!meilleur?.zones.length) return { items: items.filter(it => it.fixe || it.garde === false), plan: { version: 'zones-1', statut: 'impossible', zones: [], chemins: [], manquants, statistiques, avertissements: ['Aucun ensemble complet ne tient avec les dégagements demandés.'] } };
  const valide = meilleur.circulation.valide && meilleur.confort.acces && meilleur.confort.circulation !== false && !meilleur.confort.score.contraintes;
  // Une composition trop dense est réduite avant d'être présentée : on ne diminue
  // jamais les 90 cm de passage pour gagner une assise ou un rangement secondaire.
  if (!valide && reduction < 6) {
    const facultatifs = rattaches.filter(it => it.garde !== false && !it.fixe && it.obligatoireProgramme === false).sort((a, b) => (b.prioriteProgramme || 5) - (a.prioriteProgramme || 5));
    const secondaire = [...programme.zones].sort((a, b) => b.priorite - a.priorite).find(z => !z.slots.some(s => s.principal)
      && rattaches.some(it => it.garde !== false && it.zoneId === z.id && !it.fixe));
    const retirer = facultatifs.length ? [facultatifs[0].id] : secondaire ? rattaches.filter(it => it.garde !== false && it.zoneId === secondaire.id && !it.fixe).map(it => it.id) : [];
    if (retirer.length) {
      const essai = planifierZones(modele, rattaches.filter(it => !retirer.includes(it.id)), catalogue, programme, reduction + 1);
      if (essai.plan?.zones?.length) {
        essai.plan.retraitsDensite = [...retirer, ...(essai.plan.retraitsDensite || [])];
        essai.plan.manquants = [...(essai.plan.manquants || []), ...programme.zones.filter(z => rattaches.some(it => retirer.includes(it.id) && it.zoneId === z.id))
          .map(z => ({zone:z.id,motif:'circulation',meubles:rattaches.filter(it => retirer.includes(it.id) && it.zoneId === z.id).map(it => it.id)}))];
        essai.plan.statistiques.reductions = reduction + 1;
        essai.plan.avertissements = [...new Set(['Des éléments secondaires ont été écartés pour préserver les accès et les passages.', ...essai.plan.avertissements])];
        return essai;
      }
    }
  }
  return { items: [...meilleur.items, ...items.filter(it => it.garde === false)], plan: { version: programme.compositionSurface ? 'zones-surface-3' : 'zones-1', statut: meilleur.circulation.valide && meilleur.circulation.portesConnues && meilleur.confort.acces && meilleur.confort.circulation && !meilleur.confort.score.contraintes ? 'compose' : 'a-verifier', zones: meilleur.zones, chemins: meilleur.circulation.chemins, circulation: meilleur.circulation, largeurCirculation,...(programme.encyclopedie?{encyclopedie:programme.encyclopedie}:{}), score: r(meilleur.score), manquants,
    statistiques, avertissements: meilleur.circulation.valide ? [] : ['La liaison entre les ensembles et les portes doit être vérifiée ; le plan n’est pas certifié accessible.'] } };
}

export function verifierPlanZones(modele, items, catalogue, plan) {
  if (!plan?.zones?.length) return { valide: false, problemes: ['absence-de-plan'] };
  const problemes = [], es = donnees(items, catalogue);
  if(plan.encyclopedie)problemes.push(...verifierReglesDures(modele,items,catalogue,plan.encyclopedie.profil).erreurs);
  const sol = auSol(es), portes = zonesPortes(modele);
  for (const e of sol) { if (!contientBoite(modele, e.b)) problemes.push(`limites:${e.it.id}`); if (portes.some(p => intersectionZones(e.b, p) > .001)) problemes.push(`porte:${e.it.id}`); }
  for (let i = 0; i < sol.length; i++) for (const e of sol.slice(i + 1)) if (intersectionZones(sol[i].b, e.b, .025) > .0001) problemes.push('chevauchement-meubles');
  for (const e of es) { const zone = plan.zones.find(z => z.id === e.it.zoneId); if (zone && !estMural(e.p.fam) && !dansZone(e.it, e.p, zone)) problemes.push(`hors-zone:${e.it.id}`); }
  if (!accesValides(modele, es)) problemes.push('degagements');
  const circulation = cheminsZones(modele, plan.zones, items, catalogue, plan.largeurCirculation || plan.circulation?.largeur || .9);
  if (!circulation.valide) problemes.push('circulation');
  if (!circulation.portesConnues) problemes.push('porte-non-renseignee');
  const confort = bilanConfort(modele, items, catalogue);
  if (confort.score.contraintes) problemes.push('contraintes-micro');
  if (!confort.acces || confort.circulation === false) problemes.push('acces-micro');
  return { valide: !problemes.length, problemes, circulation, confort };
}

// Complétion conditionnée par les meubles déjà retenus : on essaie les éléments
// du programme un à un, sans déplacer les ensembles ni inventer un nouvel achat.
export function completerEnsembles(modele, resultat, souhaites, catalogue) {
  if (!resultat.plan?.zones?.length || !verifierPlanZones(modele, resultat.items, catalogue, resultat.plan).valide) return resultat;
  let items = resultat.items.slice(), plan = structuredClone(resultat.plan);
  const ajoutes = [];
  const manquants = souhaites.filter(it => !it.fixe && it.garde !== false && !items.some(q => q.id === it.id)
    && plan.zones.some(z => z.id === it.zoneId)).sort((a,b) => Number(!!b.obligatoireProgramme)-Number(!!a.obligatoireProgramme) || (a.prioriteProgramme || 5)-(b.prioriteProgramme || 5));
  for (const it of manquants.slice(0, 12)) {
    const p = produitDe(it, catalogue), es = donnees(items, catalogue), zone = plan.zones.find(z => z.id === it.zoneId);
    if (!p || !estAuSol(p.fam) || estPlat(p.fam)) continue;
    const lit = es.find(e => e.it.zoneId === it.zoneId && e.role === 'lit');
    let poses = [];
    if (it.usageProgramme === 'chevet' && lit) {
      for (const cote of [-1,1]) poses.push({ ...it, ...local(lit.it, cote*(lit.p.dim[0]/2+p.dim[0]/2+.06), -lit.p.dim[1]/2+p.dim[1]/2+.05), rot:lit.it.rot });
    } else if (estPosable(p.fam, p.dim)) {
      const supports = es.filter(e => e.it.zoneId === it.zoneId && (it.usageProgramme === 'lampe-chevet' ? e.it.usageProgramme === 'chevet' : ['table-basse','table-appoint','bureau','buffet'].includes(e.it.usageProgramme)));
      for (const h of supports) if (p.dim[0] <= h.p.dim[0]-.04 && p.dim[1] <= h.p.dim[1]-.04)
        for (const cote of [0,-1,1]) poses.push({ ...it, ...local(h.it,cote*(h.p.dim[0]-p.dim[0])*.35,0), rot:h.it.rot,
          kind:'surface_item', attach_to:{type:'furniture',id:h.it.id}, y:h.p.dim[2]+p.dim[2]/2 });
    } else if (['banc','armoire','buffet','etagere','meuble-tv','fauteuil-salon','fauteuil-lecture','lumiere-salon','lumiere-lecture','table-appoint'].includes(it.usageProgramme)) {
      const candidats = candidatsGroupe(modele, {id:zone.id,type:'complement',libelle:zone.libelle}, [it], catalogue, auSol(es));
      const centre = {x:(zone.x0+zone.x1)/2,z:(zone.z0+zone.z1)/2};
      poses = candidats.sort((a,b) => distance(a.items[0],centre)-distance(b.items[0],centre) || b.score-a.score).map(c => c.items[0]);
      if (it.usageProgramme === 'fauteuil-salon' && surfacePiece(modele) <= 40) {
        // Un fauteuil ajouté après coup rejoint le salon : tourné vers la table basse, à distance de conversation.
        // Avec une table basse, les places (tournées vers elle ou dans leur sens d'origine) sont essayées de la
        // mieux composée à la moins bien composée, et un fauteuil caché derrière le canapé ou tourné dos au salon
        // (+45 points) est laissé de côté plutôt que garé là ; sans table basse, les places habituelles restent proposées.
        const coeur = es.find(e => e.it.zoneId === it.zoneId && e.it.usageProgramme === 'table-basse');
        // l'équilibre de la pièce n'entre pas dans le seuil : il ne s'allume qu'à partir de quatre meubles au sol
        const note = liste => noteComposition(modele, liste, catalogue, { equilibre: false }).penalite, avant = coeur && note(items);
        // places du « U » d'abord : de part et d'autre de la table basse, puis en biais vers l'écran
        const u = !coeur ? [] : [-1, 1].flatMap(c => [0, .35, -.35].flatMap(dz => [.33, .5, .7].map(g => ({ ...it, ...local(coeur.it, c * (coeur.p.dim[0] / 2 + p.dim[1] / 2 + g), dz) }))));
        const vers = q => ({ ...q, rot: normaliserAngle(Math.round(Math.atan2(coeur.it.x - q.x, coeur.it.z - q.z) / (Math.PI / 4)) * Math.PI / 4) });
        if (coeur) poses = [...u.map(vers), ...poses.slice(0, 96).flatMap(q => [vers(q), q])]
          .map(q => ({ q, n: note([...items, q]) })).filter(c => c.n - avant < 40).sort((a, b) => a.n - b.n).map(c => c.q);
      }
      if (it.usageProgramme === 'banc' && lit) poses.unshift({ ...it, ...local(lit.it,0,lit.p.dim[1]/2+.75+p.dim[1]/2), rot:lit.it.rot });
    }
    for (const pose of poses.slice(0, 48)) {
      const liste = [...items,pose];
      if (verifierHauteurs(modele,liste,catalogue).some(e => e.ids.includes(it.id))) continue;
      const b = boite(pose,p.dim), agrandie = {...zone,x0:Math.min(zone.x0,b.x0),x1:Math.max(zone.x1,b.x1),z0:Math.min(zone.z0,b.z0),z1:Math.max(zone.z1,b.z1),meubles:[...zone.meubles,it.id]};
      const essai = {...plan,zones:plan.zones.map(z => z.id === zone.id ? agrandie : z)};
      const audit = verifierPlanZones(modele,liste,catalogue,essai);
      if (!audit.valide) continue;
      items = liste; plan = {...essai,audit,circulation:audit.circulation,chemins:audit.circulation.chemins}; ajoutes.push(it.id); break;
    }
  }
  return ajoutes.length ? {items,plan:{...plan,completionProgressive:{ajoutes}}} : resultat;
}

// Avant d’abandonner un espace demandé, essayer les mêmes usages avec des
// meubles plus compacts, puis sans les pièces facultatives. Trois reprises au plus.
export function planifierAvecAlternatives(modele, items, catalogue, programme, { candidats, budget = 0, langue = 'fr', emplacements = [] } = {}) {
  let meilleur = planifierZones(modele, items, catalogue, programme);
  if (!programme) return meilleur;
  const rattaches = rattacher(items, catalogue, programme);
  const cibles = programme.zones.filter(z => programme.compositionSurface || z.demandee || z.id === 'repas');
  const requis = cibles.flatMap(z => z.slots).filter(s => s.obligatoire && rattaches.some(it => it.slotProgramme === s.id));
  if (!requis.length) return meilleur;
  const complet = resultat => requis.every(s => resultat.items.some(it => it.garde !== false && it.slotProgramme === s.id));
  const tousPresents = resultat => rattaches.filter(it => it.garde !== false).every(it => resultat.items.some(q => q.id === it.id && q.garde !== false));
  const satisfaisant = resultat => complet(resultat) && resultat.plan?.statut === 'compose' && (!programme.compositionSurface || tousPresents(resultat));
  if (satisfaisant(meilleur)) return completerEnsembles(modele, meilleur, rattaches, catalogue);
  const qualite = resultat => {
    const presents = new Set(resultat.items.filter(it => it.garde !== false).map(it => it.slotProgramme));
    const confort = bilanConfort(modele, resultat.items, catalogue);
    const valide = resultat.plan?.circulation?.valide && confort.acces && confort.circulation !== false && !confort.score.contraintes;
    const principal = { salon: 'salon', chambre: 'couchage', salle_a_manger: 'repas', bureau: 'travail', entree: 'accueil', terrasse: 'salon', salle_de_bain: 'bain' }[programme.fonction];
    const principalePresente = Number(requis.filter(s => s.principal || s.zone === principal && ['lit','canape','bureau','table-repas','salon-exterieur'].includes(s.usage)).every(s => presents.has(s.id)));
    return [Number(!!valide), principalePresente, cibles.filter(z => z.slots.filter(s => s.obligatoire && requis.some(q => q.id === s.id)).every(s => presents.has(s.id))).length,
      requis.filter(s => presents.has(s.id)).length, resultat.items.filter(it => it.obligatoireProgramme).length, resultat.items.length];
  };
  const mieux = (a, b) => { const qa = qualite(a), qb = qualite(b); for (let i = 0; i < qa.length; i++) if (qa[i] !== qb[i]) return qa[i] > qb[i]; return false; };
  const pool = candidats ? Object.values(candidats).flat() : Object.values(catalogue);
  const usages = new Set(['lit', 'armoire', 'buffet', 'meuble-tv', 'etagere', 'table-repas', 'chaise-repas', 'canape', 'table-basse', 'fauteuil-salon', 'fauteuil-lecture', 'bureau', 'chaise-bureau']);
  const substitutions = [];
  const compacts = rattaches.map(it => {
    if (it.fixe || it.garde === false || !usages.has(it.usageProgramme)) return it;
    const p = produitDe(it, catalogue), slot = emplacements.find(m => m.programme?.id === it.slotProgramme)?.programme;
    if (!p || !slot) return it;
    const q = pool.filter(petit => correspondEmplacement(petit, slot) && petit.dim[0] <= p.dim[0] + .01 && petit.dim[1] <= p.dim[1] + .01
      && petit.dim[0] * petit.dim[1] < p.dim[0] * p.dim[1] - .01 && (!budget || petit.prix > 0 && petit.prix <= p.prix))
      .sort((a, b) => a.dim[0] * a.dim[1] - b.dim[0] * b.dim[1] || a.prix - b.prix)[0];
    if (!q) return it;
    substitutions.push({ id: it.id, initial: it.sku, retenu: q.id });
    return { ...it, sku: q.id, raison: langue === 'en' ? 'Compact alternative to make room for your chosen areas.' : 'Version plus compacte pour aménager les espaces choisis.' };
  });
  const sansFacultatifs = liste => liste.filter(it => it.fixe || it.garde === false || it.obligatoireProgramme !== false);
  const essais = [sansFacultatifs(rattaches), ...(substitutions.length ? [compacts, sansFacultatifs(compacts)] : [])];
  for (const liste of essais) {
    const resultat = planifierZones(modele, liste, catalogue, programme);
    if (mieux(resultat, meilleur)) {
      meilleur = resultat;
      meilleur.plan.alternativesCompactes = substitutions.filter(s => resultat.items.some(it => it.id === s.id && it.sku === s.retenu));
      meilleur.plan.statistiques.reprisesEspaces = essais.indexOf(liste) + 1;
    }
    if (satisfaisant(meilleur)) break;
  }
  return completerEnsembles(modele, meilleur, rattaches, catalogue);
}
