// Recherche macro bornée : déplacer des ensembles complets, puis réserver leurs accès.
// Les rectangles viennent des dimensions du catalogue, jamais d'une sortie du modèle.
import { boite, estAuSol, estPlat, estMural, estSuspendu, estPosable, porteurDe, produitDe, zonesPortes, normaliserAngle } from './agencement.js';
import { contientBoite, contientPoint, segmentsDe, pointOuverture, distanceSegment, zoneOuverture } from './contour.js';
import { roleFonctionDe } from './roles.js';
import { correspondSlot, correspondEmplacement } from './programme.js';
import { intersectionZones, dansZone } from './zones-geometrie.js';
import { bilanConfort } from './confort.js';
import {grainesEncyclopedie,evaluerDisposition,verifierReglesDures,scoreReglesEncyclopedie} from './encyclopedie.js';
import { evaluerDensite, repartitionZones } from './composition-surface.js';
import { scoreRelations } from './relations-zones.js';
import { evaluerRemplissage } from './remplissage.js';

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
    if (sol.some(q => q.it.id !== e.it.id && !(e.role === 'repas' && ['chaise', 'tabouret'].includes(q.role))
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

function patronGroupe(type, entrees, lumiereLaterale = false) {
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
      if (!tv || place - dim(lumiere)[0] / 2 >= dim(tv)[0] / 2 + .01)
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


// Le meuble TV se place à une distance fixe du canapé ; s'il s'arrête à moins de 1,6 m
// d'un mur derrière lui, il flotte au milieu de la pièce. Variantes adossées : le meuble
// seul reculé contre ce mur (avec l'écran et la lampe posés dessus) tant que le recul
// reste confortable ; et, quand l'écran est sur le côté du canapé (dispositions
// latérales), tout l'ensemble glissé vers ce mur, le canapé gardant son propre appui.
function adosserEcran(modele, poses, cat) {
  const meuble = poses.find(it => it.usageProgramme === 'meuble-tv');
  if (!meuble) return [];
  const p = produitDe(meuble, cat), sofa = poses.find(it => produitDe(it, cat)?.fam === 'canape') || poses.find(it => produitDe(it, cat)?.fam === 'fauteuil');
  if (!p || !sofa) return [];
  const a = meuble.rot || 0, bx = -Math.sin(a), bz = -Math.cos(a), dos = { x: meuble.x + bx * p.dim[1] / 2, z: meuble.z + bz * p.dim[1] / 2 };
  let recul = Infinity;
  for (let d = .05; d <= 1.6; d += .05) if (!contientPoint(modele, dos.x + bx * d, dos.z + bz * d)) { recul = d - .05; break; }
  if (!Number.isFinite(recul) || recul < .1) return [];
  const variantes = [], decaler = ids => poses.map(it => !ids || ids.has(it.id) ? { ...it, x: r(it.x + bx * recul), z: r(it.z + bz * recul) } : it);
  if (Math.hypot(meuble.x + bx * recul - sofa.x, meuble.z + bz * recul - sofa.z) <= 4.2) {
    const suiveurs = new Set([meuble.id, ...poses.filter(it => it.id !== meuble.id && Math.abs(it.x - meuble.x) <= p.dim[0] / 2 + .01 && Math.abs(it.z - meuble.z) <= p.dim[0] / 2 + .01
      && ['tv', 'lampe', 'deco', 'sculpture', 'plante'].includes(produitDe(it, cat)?.fam) && Number.isFinite(it.y)).map(it => it.id)]);
    variantes.push(decaler(suiveurs));
  }
  const fs = Math.sin(sofa.rot || 0), fz = Math.cos(sofa.rot || 0);
  if (Math.abs(fs * bx + fz * bz) < .5) variantes.push(decaler(null));
  return variantes;
}

// Recul du meuble TV : dos au mur (à 10 cm près), ou planté au milieu de la pièce avec
// plus de 60 cm de vide derrière lui (l'effet « meuble posé au hasard »).
function reculEcran(modele, items, cat) {
  const meuble = items.find(it => it.usageProgramme === 'meuble-tv'), p = meuble && produitDe(meuble, cat);
  if (!p) return null;
  const a = meuble.rot || 0, bx = -Math.sin(a), bz = -Math.cos(a), dos = { x: meuble.x + bx * p.dim[1] / 2, z: meuble.z + bz * p.dim[1] / 2 };
  for (let d = .05; d <= 3; d += .05) if (!contientPoint(modele, dos.x + bx * d, dos.z + bz * d)) return d - .05;
  return 3;
}
export const POIDS_ECRAN = Object.freeze({ adosse: 3, flottant: -10 });
const noteEcran = recul => recul === null ? 0 : recul <= .1 ? POIDS_ECRAN.adosse : recul > .6 ? POIDS_ECRAN.flottant : 0;

export function candidatsGroupe(modele, zone, items, cat, obstacles, lumiereLaterale = false, contexte = {}) {
  const es = donnees(items, cat), base=patronGroupe(zone.type, es, lumiereLaterale), graines=grainesEncyclopedie(zone,items,cat,base);
  const ancre = { salon: ['canape', 'salon-exterieur'], repas: ['table-repas', 'repas'], couchage: ['lit'], lecture: ['fauteuil', 'fauteuil-lecture'], travail: ['bureau'] }[zone.type];
  if (ancre && !es.some(e => ancre.includes(e.it.usageProgramme) || ancre.includes(e.role))) return [];
  if (['salon', 'lecture', 'travail'].includes(zone.type)) for(const g of [...graines])graines.push({...g,items:g.items.map(it => ({ ...it, x: -it.x, rot: normaliserAngle(-(it.rot || 0)) }))});
  const facultatifs = es.filter(e => e.it.obligatoireProgramme === false);
  if (facultatifs.length) {const obligatoires=items.filter(it=>!facultatifs.some(q=>q.it.id===it.id));graines.push(...grainesEncyclopedie(zone,obligatoires,cat,patronGroupe(zone.type,donnees(obligatoires,cat),lumiereLaterale)));}
  const portes = zonesPortes(modele), fenetres = ouvertures(modele, ['fenetre']).map(o => ({ ...zoneOuverture(o.pan, o, .4), allege: o.allege || 0 })), L = modele.dims.largeur, P = modele.dims.profondeur, sortie = [], vus = new Set();
  const angles = [...new Set([0, Math.PI / 2, Math.PI, -Math.PI / 2, ...segmentsDe(modele).map(p => r(Math.atan2(p.n[0], p.n[1])))])].slice(0, 10);
  for (const graine of graines) {
    const patron=graine.items;
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
      // Chaque position est essayée telle quelle et, si possible, avec le meuble TV adossé au mur.
      // Les variantes adossées rejoignent les candidats sans bonus local : l'avantage d'un
      // écran contre le mur est compté sur le plan complet, sans bousculer le faisceau.
      const brutes = translations.flatMap(([dx, dz]) => { const brut = transformer(patron, angle, dx, dz); return [...adosserEcran(modele, brut, cat), brut]; });
      for (const brut of brutes) {
        let poses = brut;
        if (fixes.some(it => { const a = items.find(q => q.id === it.id), q = poses.find(q => q.id === it.id); return distance(a, q) > .025 || Math.abs(normaliserAngle((a.rot || 0) - q.rot)) > .03; })) continue;
        poses = poses.map(it => it.fixe ? { ...items.find(q => q.id === it.id), zoneId: zone.id } : it);
        const cle = poses.map(it => `${it.id}:${it.x}:${it.z}:${r(it.rot)}`).join('|'); if (vus.has(cle)) continue;
        const donne = donnees(poses, cat), sol = auSol(donne), bbox = emprise(donne);
        if (zone.surfaceMax && (bbox.x1 - bbox.x0) * (bbox.z1 - bbox.z0) > zone.surfaceMax * 1.5) continue;
        if (!contientBoite(modele, bbox) || portes.some(p => intersectionZones(bbox, p) > .001)) continue;
        if (!accesValides(modele, donne)) continue;
        if (sol.some((e, i) => sol.slice(i + 1).some(q => intersectionZones(e.b, q.b, .025) > .0001))) continue;
        if (sol.some(e => obstacles.some(q => intersectionZones(e.b, q.b, .025) > .0001))) continue;
        // L'allège est une observation, pas une hypothèse de vitrage toute hauteur.
        if (sol.some(e => fenetres.some(o => (e.role === 'lit' || e.p.dim[2] > o.allege + .08) && intersectionZones(e.b, o) > .005))) continue;
        const encyclo=evaluerDisposition(modele,poses,cat,graine,zone);if(!encyclo.valide)continue;
        const reglementaire=zone.encyclopedie?verifierReglesDures(modele,poses,cat,zone.profil):null;if(reglementaire&&!reglementaire.valide)continue;
        vus.add(cle);
        const complete = poses.length === items.length;
        const centre=[(bbox.x0+bbox.x1)/2,(bbox.z0+bbox.z1)/2];
        const voisinage=contexte.table?20/(1+Math.hypot(centre[0]-contexte.table.x,centre[1]-contexte.table.z)):0;
        const panProche=contexte.table?[...segmentsDe(modele)].sort((a,b)=>distanceSegment(centre,a.a,a.b)-distanceSegment(centre,b.a,b.b))[0]:null;
        const cloison=panProche&&Math.abs(panProche.centre[0])<L/2-.1&&Math.abs(panProche.centre[1])<P/2-.1?4:0;
        sortie.push({ items: poses, zone: { ...bbox, id: zone.id, type: zone.type, libelle: zone.libelle, rot: angle, meubles: poses.map(it => it.id),...(graine.disposition?{dispositionSource:graine.disposition.id,dispositionUid:graine.disposition.uid,geometrieSource:graine.disposition.geometrie,strategie:graine.strategy}:{}),...(zone.encyclopedie?{encyclopedie:zone.encyclopedie}: {}) }, score: voisinage+cloison+encyclo.score+(zone.encyclopedie?scoreReglesEncyclopedie(poses,cat).score:0)+scoreLocal(zone.type, poses, cat, modele) - (items.length - poses.length) * (zone.surfaceMax ? 8 : 3), complete });
      }
    }
  }
  // Garder de la diversité de position et d'orientation, pas 48 voisins d'un seul coin.
  if (!sortie.length && zone.type === 'salon' && !lumiereLaterale && es.some(e => e.it.usageProgramme === 'lumiere-salon' && e.p.fam === 'lampadaire'))
    return candidatsGroupe(modele, zone, items, cat, obstacles, true,contexte);
  const groupes = new Map();
  for (const c of sortie.sort((a, b) => b.score - a.score)) { const key = `${r(c.zone.rot)}:${Math.floor(c.zone.x0)}:${Math.floor(c.zone.z0)}:${c.complete}`; const g = groupes.get(key) || []; if (g.length < 2) g.push(c); groupes.set(key, g); }
  // Chaque disposition garde ses meilleures positions : la variété survit au tri par note.
  const parDisposition = new Map();
  for (const c of sortie) { const cle = `${c.zone.dispositionUid || '-'}:${c.zone.strategie || '-'}:${c.complete}`; const g = parDisposition.get(cle) || []; if (g.length < 8) g.push(c); parDisposition.set(cle, g); }
  const tries = [...new Set([...[...groupes.values()].flat(), ...[...parDisposition.values()].flat()])].sort((a, b) => b.score - a.score);
  const diversifier = liste => [...new Set([...[...parDisposition.values()].flatMap(g => g.slice(0, 4)), ...liste])];
  if (zone.surfaceMax && L * P > 20) {
    const secteurs = new Map();
    for (const c of tries) {
      const key = `${r(c.zone.rot)}:${Math.floor(((c.zone.x0 + c.zone.x1) / 2 + L / 2) / (L / 3))}:${Math.floor(((c.zone.z0 + c.zone.z1) / 2 + P / 2) / (P / 3))}:${c.complete}`;
      if (!secteurs.has(key)) secteurs.set(key, c);
    }
    // En séjour intermédiaire, préserver les variantes voisines qui font tenir
    // les trois ensembles ; le grand open-space admet un échantillonnage plus large.
    return diversifier([...new Set([...tries.slice(0, L * P > 40 ? 32 : 72), ...secteurs.values()])]).slice(0, L * P > 40 ? 120 : 160);
  }
  return diversifier(tries.slice(0, 72)).slice(0, 96);
}

export function cheminsZones(modele, zones, items, cat, largeur = .9) {
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


// Combinaison de dispositions d'un plan (type de coin, disposition source, stratégie).
export const signatureDispositions = zones => zones.map(z => `${z.type}:${z.dispositionUid || '-'}:${z.strategie || '-'}`).sort().join('|');
// Générateur pseudo-aléatoire à graine (mulberry32) : même graine, même plan.
export function aleatoire(graine) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Sans variation : le meilleur plan, comme avant. Avec une variation (chaque nouveau
// « Réaménager ») : un tirage parmi les plans aussi sûrs que le meilleur et proches de
// sa note. Le tirage porte d'abord sur la disposition du coin principal (le canapé face
// à l'écran, sur le côté, en vis-à-vis…), à chances égales, puis sur la combinaison des
// autres coins, en privilégiant les mieux notées.
export const TOLERANCE_VARIATION = 10;
const signatureCoin = z => z ? `${z.type}:${z.dispositionUid || '-'}:${z.strategie || '-'}` : '-';
function tirer(groupes, reference, echelle, hasard) {
  const poids = groupes.map(g => Math.exp((g[0].score - reference) / echelle));
  let t = hasard() * poids.reduce((a, b) => a + b, 0);
  for (let i = 0; i < groupes.length; i++) { t -= poids[i]; if (t <= 0) return groupes[i]; }
  return groupes[0];
}
const regrouper = (liste, cle) => { const m = new Map(); for (const e of liste) { const k = cle(e); if (!m.has(k)) m.set(k, []); m.get(k).push(e); } return [...m.values()]; };
function choisirPlan(verifies, rang, variation, statistiques) {
  const meilleur = verifies[0];
  if (!variation || !meilleur) return meilleur;
  const ref = rang(meilleur).join(',');
  const proches = verifies.filter(e => rang(e).join(',') === ref && e.score >= meilleur.score - TOLERANCE_VARIATION).sort((a, b) => b.score - a.score);
  const hasard = aleatoire(variation * 2654435761);
  // Toutes les dispositions principales retenues sont sûres : le tirage leur donne la même
  // chance, pour qu'un nouvel aménagement change vraiment de disposition.
  const principales = regrouper(proches, e => signatureCoin(e.zones[0]));
  const principale = principales[Math.floor(hasard() * principales.length)];
  const combinaisons = regrouper(principale, e => signatureDispositions(e.zones));
  const groupe = tirer(combinaisons, principale[0].score, 5, hasard);
  const voisins = groupe.filter(e => e.score >= groupe[0].score - 3);
  statistiques.variation = { graine: variation, plansProches: proches.length, dispositionsPrincipales: principales.length, combinaisons: regrouper(proches, e => signatureDispositions(e.zones)).length };
  return voisins[Math.floor(hasard() * voisins.length)] || meilleur;
}

export function planifierZones(modele, items, catalogue, programme, reduction = 0, opts = {}) {
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
  for (const zone of ordre) {
    const meubles = rattaches.filter(it => it.garde !== false && it.zoneId === zone.id);
    if (!meubles.length) continue;
    const candidats = candidatsGroupe(modele, zone, meubles, catalogue, obstacles); statistiques.candidats += candidats.length;
    const suites = [];
    for (const etat of etats) for (const c of candidats) {
      statistiques.combinaisons++;
      const ecart = programme.compositionSurface?.maxM2ParElement ? programme.compositionSurface.openSpace ? programme.compositionSurface.largeurCirculation : .8 : .04;
      if (etat.zones.some(z => intersectionZones(z, c.zone, ecart) > .001)) continue;
      const liste = [...etat.items, ...c.items];
      if (!accesValides(modele, donnees(liste, catalogue))) continue;
      if(programme.encyclopedie&&!verifierReglesDures(modele,liste,catalogue,programme.encyclopedie.profil).valide)continue;
      const zones = [...etat.zones, c.zone];
      const repartition = programme.compositionSurface?.maxM2ParElement ? repartitionZones(modele, zones).score : 0;
      // Les coins se jugent aussi entre eux (repas près du salon, lecture hors de l'axe TV…).
      // Cette note reste à part : sur un plan encore partiel, elle ne doit pas évincer du
      // faisceau les états qui laissent la place aux coins suivants.
      const relations = scoreRelations(modele, zones, liste, catalogue, programme.fonction).score;
      suites.push({ items: liste, zones, scoreLocal: (etat.scoreLocal || 0) + c.score, relations, score: (etat.scoreLocal || 0) + c.score + repartition });
    }
    // Un coin entièrement facultatif (buffet d'appoint…) ne doit pas évincer du faisceau les
    // dispositions qui n'ont pas la place de l'accueillir : elles continuent sans lui.
    const facultatif = !zone.demandee && meubles.every(it => it.obligatoireProgramme === false && !it.fixe);
    if (facultatif && suites.length) for (const etat of etats) suites.push({ ...etat, scoreLocal: (etat.scoreLocal || 0) - 3 * meubles.length, score: etat.score - 3 * meubles.length, ecartes: [...(etat.ecartes || []), zone.id] });
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
    // Variété : chaque combinaison de dispositions garde ses meilleurs représentants,
    // pour que la plus haute note locale ne fasse pas disparaître les autres géométries.
    const parDisposition = new Map();
    for (const s of suites) { const cle = signatureDispositions(s.zones); const g = parDisposition.get(cle) || []; if (g.length < 3) g.push(s); parDisposition.set(cle, g); }
    // Et les états où les coins s'enchaînent le mieux entre eux.
    const lies = [...suites].sort((a, b) => b.score + b.relations - a.score - a.relations).slice(0, 12);
    etats = [...new Set([...etats, ...[...parDisposition.values()].flat(), ...lies])];
  }
  // Les plans à vérifier mêlent les meilleurs et un représentant de chaque combinaison.
  const representants = new Map();
  for (const e of [...etats].sort((a, b) => b.score - a.score)) { const cle = signatureDispositions(e.zones); if (!representants.has(cle)) representants.set(cle, e); }
  const lies = [...etats].sort((a, b) => b.score + (b.relations || 0) - a.score - (a.relations || 0)).slice(0, 12);
  etats = [...new Set([...[...representants.values()].slice(0, 24), ...lies, ...etats])];
  const largeurCirculation = programme.compositionSurface?.largeurCirculation || .9;
  const verifies = etats.slice(0, 64).map(e => {
    statistiques.plansVerifies++;
    const circulation = cheminsZones(modele, e.zones, e.items, catalogue, largeurCirculation), confort = bilanConfort(modele, e.items, catalogue);
    const densite = evaluerDensite(modele, e.items, catalogue, programme, { zones: e.zones, circulation }, { phase: 'macro' });
    // Remplissage du plan complet : vides, équilibre, murs nus, coins flottants.
    const remplissage = evaluerRemplissage(modele, e.items, catalogue, { zones: e.zones, preferences: opts.preferences, phase: 'macro' });
    const relations = e.relations ?? scoreRelations(modele, e.zones, e.items, catalogue, programme.fonction).score;
    const ecran = noteEcran(reculEcran(modele, e.items, catalogue));
    return { ...e, circulation, confort, densite, remplissage, score: (e.scoreLocal ?? e.score) + relations + remplissage.score + ecran + (densite?.score || 0) + (circulation.valide ? 5 : -50 * (circulation.portesBloquees + circulation.inaccessibles.length)) };
  });
  const rang = e => [e.confort.score.contraintes, -Number(e.confort.acces && e.confort.circulation !== false), -Number(e.circulation.valide)];
  verifies.sort((a, b) => { const ra = rang(a), rb = rang(b); for (let i = 0; i < 3; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]; return b.score - a.score; });
  const meilleur = choisirPlan(verifies, rang, opts.variation, statistiques);
  if (!meilleur?.zones.length) return { items: items.filter(it => it.fixe || it.garde === false), plan: { version: 'zones-1', statut: 'impossible', zones: [], chemins: [], manquants, statistiques, avertissements: ['Aucun ensemble complet ne tient avec les dégagements demandés.'] } };
  const valide = meilleur.circulation.valide && meilleur.confort.acces && meilleur.confort.circulation !== false && !meilleur.confort.score.contraintes;
  // Une composition trop dense est réduite avant d'être présentée : on ne diminue
  // jamais les 90 cm de passage pour gagner une assise ou un rangement secondaire.
  if (!valide && reduction < 6) {
    const facultatifs = rattaches.filter(it => it.garde !== false && !it.fixe && it.obligatoireProgramme === false).sort((a, b) => (b.prioriteProgramme || 5) - (a.prioriteProgramme || 5));
    const secondaire = [...programme.zones].sort((a, b) => b.priorite - a.priorite).find(z => z.priorite > 1 && rattaches.some(it => it.garde !== false && it.zoneId === z.id && !it.fixe));
    const retirer = facultatifs.length ? [facultatifs[0].id] : secondaire ? rattaches.filter(it => it.garde !== false && it.zoneId === secondaire.id && !it.fixe).map(it => it.id) : [];
    if (retirer.length) {
      const essai = planifierZones(modele, rattaches.filter(it => !retirer.includes(it.id)), catalogue, programme, reduction + 1, opts);
      if (essai.plan?.zones?.length) {
        essai.plan.retraitsDensite = [...retirer, ...(essai.plan.retraitsDensite || [])];
        essai.plan.statistiques.reductions = reduction + 1;
        essai.plan.avertissements = [...new Set(['Des éléments secondaires ont été écartés pour préserver les accès et les passages.', ...essai.plan.avertissements])];
        return essai;
      }
    }
  }
  return { items: [...meilleur.items, ...items.filter(it => it.garde === false)], plan: { version: programme.compositionSurface ? 'zones-surface-3' : 'zones-1', statut: meilleur.circulation.valide && meilleur.circulation.portesConnues && meilleur.confort.acces && meilleur.confort.circulation && !meilleur.confort.score.contraintes ? 'compose' : 'a-verifier', zones: meilleur.zones, chemins: meilleur.circulation.chemins, circulation: meilleur.circulation, largeurCirculation,...(programme.encyclopedie?{encyclopedie:programme.encyclopedie}:{}), score: r(meilleur.score), remplissage: meilleur.remplissage, relations: scoreRelations(modele, meilleur.zones, meilleur.items, catalogue, programme.fonction), manquants: [...manquants, ...(meilleur.ecartes || []).map(id => ({ zone: id, motif: 'facultatif-ecarte', meubles: rattaches.filter(it => it.zoneId === id).map(it => it.id) }))],
    statistiques, avertissements: meilleur.circulation.valide ? [] : ['La liaison entre les ensembles et les portes doit être vérifiée ; le plan n’est pas certifié accessible.'] } };
}

export function verifierPlanZones(modele, items, catalogue, plan) {
  if (!plan?.zones?.length) return { valide: false, problemes: ['absence-de-plan'] };
  const problemes = [], es = donnees(items, catalogue);
  if(plan.encyclopedie)problemes.push(...verifierReglesDures(modele,items,catalogue,plan.encyclopedie.profil).erreurs);
  for (const z of plan.zones) { if (!contientBoite(modele, z)) problemes.push(`limites:${z.id}`); if (zonesPortes(modele).some(p => intersectionZones(z, p) > .001)) problemes.push(`porte:${z.id}`); }
  for (let i = 0; i < plan.zones.length; i++) for (const z of plan.zones.slice(i + 1)) if (intersectionZones(plan.zones[i], z) > .001) problemes.push('chevauchement-zones');
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

// Avant d’abandonner un espace demandé, essayer les mêmes usages avec des
// meubles plus compacts, puis sans les pièces facultatives. Trois reprises au plus.
export function planifierAvecAlternatives(modele, items, catalogue, programme, { candidats, budget = 0, langue = 'fr', emplacements = [], placesImposees = false, variation = 0, preferences } = {}) {
  const optsPlan = { variation, preferences };
  let meilleur = planifierZones(modele, items, catalogue, programme, 0, optsPlan);
  if (!programme) return meilleur;
  const rattaches = rattacher(items, catalogue, programme);
  const cibles = programme.zones.filter(z => programme.compositionSurface || z.demandee || z.id === 'repas');
  const requis = cibles.flatMap(z => z.slots).filter(s => s.obligatoire && rattaches.some(it => it.slotProgramme === s.id));
  if (!requis.length) return meilleur;
  const complet = resultat => requis.every(s => resultat.items.some(it => it.garde !== false && it.slotProgramme === s.id));
  const tousPresents = resultat => rattaches.filter(it => it.garde !== false).every(it => resultat.items.some(q => q.id === it.id && q.garde !== false));
  const satisfaisant = resultat => complet(resultat) && resultat.plan?.statut === 'compose' && (!programme.compositionSurface || tousPresents(resultat));
  if (satisfaisant(meilleur)) return meilleur;
  const qualite = resultat => {
    const presents = new Set(resultat.items.filter(it => it.garde !== false).map(it => it.slotProgramme));
    const confort = bilanConfort(modele, resultat.items, catalogue);
    const valide = resultat.plan?.circulation?.valide && confort.acces && confort.circulation !== false && !confort.score.contraintes;
    const principal = { salon: 'salon', chambre: 'couchage', salle_a_manger: 'repas', bureau: 'travail', entree: 'accueil', terrasse: 'salon', salle_de_bain: 'bain' }[programme.fonction];
    const principalePresente = programme.compositionSurface ? Number(requis.filter(s => s.zone === principal).every(s => presents.has(s.id))) : 0;
    return [Number(!!valide), principalePresente, cibles.filter(z => z.slots.filter(s => s.obligatoire && requis.some(q => q.id === s.id)).every(s => presents.has(s.id))).length,
      requis.filter(s => presents.has(s.id)).length, resultat.items.filter(it => it.obligatoireProgramme).length, resultat.items.length];
  };
  const mieux = (a, b) => { const qa = qualite(a), qb = qualite(b); for (let i = 0; i < qa.length; i++) if (qa[i] !== qb[i]) return qa[i] > qb[i]; return false; };
  const pool = candidats ? Object.values(candidats).flat() : Object.values(catalogue);
  const usages = new Set(['table-repas', 'chaise-repas', 'canape', 'table-basse', 'fauteuil-salon', 'fauteuil-lecture', 'bureau', 'chaise-bureau', 'lit']);
  const substitutions = [];
  const compacts = rattaches.map(it => {
    if (it.fixe || it.garde === false || !usages.has(it.usageProgramme)) return it;
    const p = produitDe(it, catalogue), slot = emplacements.find(m => m.programme?.id === it.slotProgramme)?.programme;
    if (!p || !slot) return it;
    // Un lit plus étroit libère les passages latéraux même s'il est un peu plus long.
    const tolerance = it.usageProgramme === 'lit' ? .15 : .01;
    const q = pool.filter(petit => correspondEmplacement(petit, slot) && petit.dim[0] <= p.dim[0] + .01 && petit.dim[1] <= p.dim[1] + tolerance
      && petit.dim[0] * petit.dim[1] < p.dim[0] * p.dim[1] - .01 && (!budget || petit.prix > 0 && petit.prix <= p.prix))
      .sort((a, b) => a.dim[0] * a.dim[1] - b.dim[0] * b.dim[1] || a.prix - b.prix)[0];
    if (!q) return it;
    substitutions.push({ id: it.id, initial: it.sku, retenu: q.id });
    return { ...it, sku: q.id, raison: langue === 'en' ? 'Compact alternative to make room for your chosen areas.' : 'Version plus compacte pour aménager les espaces choisis.' };
  });
  const sansFacultatifs = liste => liste.filter(it => it.fixe || it.garde === false || it.obligatoireProgramme !== false);
  // Repas trop grand pour la pièce : plutôt 4 (puis 2) couverts autour d'une table plus
  // petite que pas de table du tout. Jamais si le client a fixé le nombre de places.
  function moinsDeCouverts(liste, places) {
    const chaises = liste.filter(it => it.usageProgramme === 'chaise-repas' && !it.fixe && it.garde !== false);
    const table = liste.find(it => it.usageProgramme === 'table-repas' && !it.fixe && it.garde !== false);
    if (placesImposees || !table || chaises.length <= places) return null;
    const p = produitDe(table, catalogue);
    const q = pool.filter(t => correspondSlot(t, 'table-repas', programme.fonction) && Math.floor(t.dim[0] / .5) * 2 >= places
      && t.dim[0] <= p.dim[0] + .01 && t.dim[1] <= p.dim[1] + .01 && (!budget || t.prix > 0 && t.prix <= p.prix))
      .sort((a, b) => a.dim[0] * a.dim[1] - b.dim[0] * b.dim[1] || a.prix - b.prix)[0] || p;
    const retires = new Set(chaises.slice(places).map(it => it.id));
    return liste.filter(it => !retires.has(it.id)).map(it => it.id === table.id && q.id !== table.sku ? { ...it, sku: q.id, raison: langue === 'en' ? `Table sized for ${places} in this room.` : `Table à la mesure de ${places} couverts dans cette pièce.` } : it);
  }
  const essais = [sansFacultatifs(rattaches), ...(substitutions.length ? [compacts, sansFacultatifs(compacts)] : [])];
  for (const places of [4, 2]) { const l = moinsDeCouverts(sansFacultatifs(substitutions.length ? compacts : rattaches), places); if (l) essais.push(l); }
  for (const liste of essais) {
    // Chaque reprise tire avec sa propre graine : sinon le même tirage se répète d'un essai à l'autre.
    const resultat = planifierZones(modele, liste, catalogue, programme, 0, { ...optsPlan, variation: variation ? (variation + 7919 * (essais.indexOf(liste) + 1)) % 2147483647 || 1 : 0 });
    if (mieux(resultat, meilleur)) {
      meilleur = resultat;
      meilleur.plan.alternativesCompactes = substitutions.filter(s => resultat.items.some(it => it.id === s.id && it.sku === s.retenu));
      meilleur.plan.statistiques.reprisesEspaces = essais.indexOf(liste) + 1;
    }
    if (satisfaisant(meilleur)) break;
  }
  return meilleur;
}
