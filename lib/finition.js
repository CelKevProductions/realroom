// Couche de composition en hauteur, après le placement micro. Elle ne déplace aucun meuble au sol.
import { segmentsDe, pointOuverture, distanceSegment, zoneOuverture } from './contour.js';
import { estMural, estSuspendu, produitDe, normaliserAngle, porteurDe } from './agencement.js';
import { attacheMur, intervalleHauteur, verifierHauteurs, empreinteVolume, chevaucheVolumes } from './hauteurs.js';
import { correspondEmplacement } from './programme.js';

export const POIDS_FINITION = Object.freeze({ focal: 6, tvFace: 5, contreJour: -8, porte: -100,
  lumiereZone: 4, suspensionCentree: 5, suspensionDecentree: -10, bureauLateral: 3,
  murPrincipal: 4, murPrincipalVide: -4, tableauCentre: 4, miroirConsole: 3,
  ouverture: -100, masque: -15, collision: -50, murVide: -2 });
export function finitionActive(choix) {
  if (choix === false) return false;
  if (typeof process !== 'undefined' && (process.env.REALROOM_COMPOSITION_DETAILS === '0' || process.env.NEXT_PUBLIC_REALROOM_COMPOSITION_DETAILS === '0')) return false;
  if (typeof window !== 'undefined') { try { if (localStorage.getItem('rr-composition-details') === '0') return false; } catch (_) {} }
  return true;
}
export const estDetailHauteur = p => estMural(p?.fam) || estSuspendu(p?.fam);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const r = n => Math.round(n * 1000) / 1000;
const esDe = (items, cat) => items.filter(it => it.garde !== false).map(it => ({ it, p: produitDe(it, cat) })).filter(e => e.p?.dim);
const local = (it, x, z) => ({ x: it.x + Math.cos(it.rot || 0) * x + Math.sin(it.rot || 0) * z, z: it.z - Math.sin(it.rot || 0) * x + Math.cos(it.rot || 0) * z });
const memeZone = (a, b) => !a.zoneId || !b.zoneId || a.zoneId === b.zoneId;
function fenetreFace(modele,it) {
  return segmentsDe(modele).some(p=>(modele.murs?.[p.id]?.ouvertures||[]).some(o=>{
    if (!['fenetre','baie'].includes(o.type)) return false;
    const q=pointOuverture(p,o.position),d=Math.hypot(q[0]-it.x,q[1]-it.z);
    return ((q[0]-it.x)*Math.sin(it.rot||0)+(q[1]-it.z)*Math.cos(it.rot||0))/Math.max(.01,d)>.8;
  }));
}
function coupeVue(porte,cible,e,modele,es) {
  const a=e.it.rot||0,c=Math.cos(a),s=Math.sin(a),loc=q=>[(q.x-e.it.x)*c-(q.z-e.it.z)*s,(q.x-e.it.x)*s+(q.z-e.it.z)*c];
  const de=loc(porte),vers=loc(cible.it),v=intervalleHauteur(e.it,e.p,modele,es),f=intervalleHauteur(cible.it,cible.p,modele,es);
  // Intersection du rayon avec le vrai volume tourné (trois intervalles), à hauteur des yeux.
  const origine=[...de,1.6],fin=[...vers,(f.bas+f.haut)/2],bornes=[[-e.p.dim[0]/2,e.p.dim[0]/2],[-e.p.dim[1]/2,e.p.dim[1]/2],[v.bas,v.haut]];
  let min=.001,max=.999;
  for(let i=0;i<3;i++) {
    const d=fin[i]-origine[i];
    if(Math.abs(d)<1e-8) {if(origine[i]<bornes[i][0]||origine[i]>bornes[i][1])return false;continue;}
    const ts=bornes[i].map(b=>(b-origine[i])/d).sort((a,b)=>a-b);min=Math.max(min,ts[0]);max=Math.min(max,ts[1]);if(min>max)return false;
  }
  return true;
}

// Une TV ou une lampe suit son meuble ; la suspension suit la table lorsque l'utilisateur la déplace.
export function deplacerAvecAttaches(modele, items, catalogue, position) {
  const avant = items.find(it => it.id === position.id);
  if (!avant) return items;
  const champs = Object.fromEntries(Object.entries(position).filter(([k, v]) =>
    ['x', 'z', 'rot', 'y'].includes(k) ? Number.isFinite(v) : k === 'mur' && typeof v === 'string'));
  const apres = { ...avant, ...champs }, angle = (apres.rot || 0) - (avant.rot || 0);
  let resultat = items.map(it => it.id === avant.id ? apres : it);
  const parents = new Set([avant.id]);
  for (let tour = 0; tour < 4; tour++) {
    let change = false;
    resultat = resultat.map(it => {
      if (parents.has(it.id) || it.attach_to?.type !== 'furniture' || !parents.has(it.attach_to.id)) return it;
      const dx = it.x - avant.x, dz = it.z - avant.z; parents.add(it.id); change = true;
      return { ...it, x: r(apres.x + Math.cos(angle) * dx + Math.sin(angle) * dz), z: r(apres.z - Math.sin(angle) * dx + Math.cos(angle) * dz), rot: normaliserAngle((it.rot || 0) + angle) };
    });
    if (!change) break;
  }
  return resultat.map(it => {
    const p = produitDe(it, catalogue);
    if (estMural(p?.fam) && parents.has(it.id)) return attacheMur(modele, it, p);
    return Number.isFinite(it.y) ? { ...it, height: it.y } : it;
  });
}

function ancrage(it, p, es) {
  const usages = it.usageProgramme === 'tableau-principal' ? ['canape', 'lit', 'bureau']
    : p.fam === 'tv-murale' ? ['meuble-tv', 'canape', 'lit']
    : p.fam === 'miroir' ? ['console', 'vasque', 'buffet']
    : it.usageProgramme === 'tableau-secondaire' ? ['buffet', 'etagere', 'fauteuil-lecture', 'table-repas', 'bureau']
    : p.fam === 'applique' ? ['chevet', 'fauteuil-lecture', 'canape', 'lit', 'bureau', 'console', 'table-repas']
    : ['buffet', 'bureau', 'console', 'canape', 'lit'];
  return es.filter(e => !estDetailHauteur(e.p) && memeZone(it, e.it))
    .sort((a, b) => {
      const rang = e => { const i = usages.indexOf(e.it.usageProgramme || e.p.fam); return i < 0 ? 99 : i; };
      return rang(a) - rang(b) || distance(a.it, it) - distance(b.it, it);
    }).find(e => usages.includes(e.it.usageProgramme || e.p.fam)) || null;
}

function candidatsMur(modele, it, p, items, cat) {
  const es = esDe(items, cat), a = ancrage(it, p, es), pans = segmentsDe(modele);
  const principal = it.usageProgramme === 'tableau-principal', tv = p.fam === 'tv-murale';
  if ((principal || tv || p.fam === 'applique' || p.fam === 'miroir') && !a) return [];
  if (!es.some(e => !estDetailHauteur(e.p) && memeZone(it, e.it))) return [];
  const derriere = a ? local(a.it, 0, -a.p.dim[1] / 2) : it;
  const meilleurPan = a ? [...pans].sort((a, b) => distanceSegment([derriere.x, derriere.z], a.a, a.b) - distanceSegment([derriere.x, derriere.z], b.a, b.b))[0] : null;
  const y0 = tv ? Math.max(1.08, (a?.it.usageProgramme === 'meuble-tv' ? a.p.dim[2] + .12 + p.dim[2] / 2 : 1.08))
    : p.fam === 'applique' ? 1.65 : p.fam === 'etagere-murale' ? 1.65
    : a && ['canape', 'lit'].includes(a.p.fam) ? Math.max(1.475, a.p.dim[2] + .2 + p.dim[2] / 2)
    : a && ['console', 'vasque', 'buffet', 'commode'].includes(a.it.usageProgramme || a.p.fam) ? Math.max(1.475, a.p.dim[2] + .18 + p.dim[2] / 2) : 1.475;
  const candidats = [];
  for (const pan of pans) {
    if (p.dim[0] > pan.long - .16 || modele.murs?.[pan.id]?.observe === false) continue;
    if (principal && a && (pan.id !== meilleurPan?.id || distanceSegment([derriere.x, derriere.z], pan.a, pan.b) > .75)) continue;
    const centre = a ? (a.it.x - pan.centre[0]) * pan.d[0] + (a.it.z - pan.centre[1]) * pan.d[1] : 0;
    const positions = [centre, centre - .55, centre + .55, 0, -pan.long / 4, pan.long / 4,
      ...(modele.murs?.[pan.id]?.ouvertures || []).flatMap(o => [o.position * pan.signePosition - o.largeur / 2 - p.dim[0] / 2 - .1, o.position * pan.signePosition + o.largeur / 2 + p.dim[0] / 2 + .1])];
    for (const u of [...new Set(positions.map(r))]) {
      if (Math.abs(u) + p.dim[0] / 2 > pan.long / 2 - .06 || (principal && a && Math.abs(u - centre) > .08)) continue;
      for (const y of [...new Set([y0, y0 + .2].map(r))]) {
        if (y - p.dim[2] / 2 < .15 || y + p.dim[2] / 2 > modele.dims.hauteur - .08) continue;
        const q = pointOuverture(pan, u * pan.signePosition), pose = attacheMur(modele, { ...it, x: r(q[0]), z: r(q[1]), rot: normaliserAngle(Math.atan2(pan.n[0], pan.n[1])), y }, p, pan.id);
        if (verifierHauteurs(modele, [...items, pose], cat).some(e => e.ids.includes(it.id))) continue;
        let score = a ? -distance(pose, a.it) - Math.abs(u - centre) * 4 - Math.abs(y - y0) : 0;
        if (!items.some(q => estMural(produitDe(q, cat)?.fam) && q.mur === pan.id)) score += 2;
        if (pan.id === meilleurPan?.id) score += 4;
        if (principal && a) score += POIDS_FINITION.murPrincipal + POIDS_FINITION.tableauCentre;
        if (tv) {
          const sofa = es.find(e => ['canape', 'lit'].includes(e.p.fam) && memeZone(it, e.it));
          if (sofa) {
            const face = ((sofa.it.x - pose.x) * pan.n[0] + (sofa.it.z - pose.z) * pan.n[1]) / Math.max(.01, distance(sofa.it, pose));
            const vision = ((pose.x - sofa.it.x) * Math.sin(sofa.it.rot || 0) + (pose.z - sofa.it.z) * Math.cos(sofa.it.rot || 0)) / Math.max(.01, distance(sofa.it, pose));
            if (face < .85 || vision < .85) continue;
            score += POIDS_FINITION.tvFace;
            if (fenetreFace(modele,pose)) score += POIDS_FINITION.contreJour;
          }
        }
        candidats.push({ pose, score });
      }
    }
  }
  return candidats.sort((a, b) => b.score - a.score);
}

export function completerHauteurs(modele, bases, details, catalogue, opts = {}) {
  let items = bases.map(it => ({ ...it }));
  const manquants = [], substitutions = [];
  function placer(it, p) {
    if (estMural(p.fam)) {
      const candidat = candidatsMur(modele, it, p, items, catalogue)[0];
      return candidat ? { pose: candidat.pose } : { motif: 'mur-ou-hauteur' };
    }
    if (!estSuspendu(p.fam)) return { motif: 'type' };
    const a = esDe(items, catalogue).find(e => memeZone(it, e.it) && e.it.usageProgramme === 'table-repas');
    if (it.zoneId === 'repas' && !a) return { motif: 'support-absent' };
    const bas = a ? a.p.dim[2] + (opts.programme?.encyclopedie ? .8 : .725) : Math.max(2.1, modele.dims.hauteur - p.dim[2] - .18);
    if (bas + p.dim[2] > modele.dims.hauteur - .12) return { motif: 'hauteur' };
    const pose = { ...it, ...(a ? { x: a.it.x, z: a.it.z, rot: a.it.rot || 0 } : {}), y: r(bas + p.dim[2] / 2), height: r(bas + p.dim[2] / 2), kind: 'ceiling_item', attach_to: a ? { type: 'furniture', id: a.it.id } : { type: 'ceiling' } };
    return verifierHauteurs(modele, [...items, pose], catalogue).some(e => e.ids.includes(it.id)) ? { motif: 'volume-ou-passage' } : { pose };
  }
  for (const it of details) {
    const p = produitDe(it, catalogue);
    if (!p) continue;
    if (it.fixe) { items.push({ ...it }); continue; }
    let resultat = placer(it, p);
    const slot = opts.emplacements?.find(m => m.programme?.id === it.slotProgramme)?.programme;
    if (!resultat.pose && slot && it.sku && opts.candidats) {
      const alternatives = Object.values(opts.candidats).flat().filter(q => q.id !== it.sku && estDetailHauteur(q) && correspondEmplacement(q, slot)
        && (!opts.budget || q.prix > 0 && q.prix <= p.prix)).sort((a, b) => a.dim[2] - b.dim[2] || a.prix - b.prix || a.id.localeCompare(b.id));
      for (const q of alternatives.slice(0, 12)) {
        const essai = placer({ ...it, sku: q.id }, q);
        if (!essai.pose) continue;
        resultat = essai; substitutions.push({ id: it.id, slot: slot.id, initial: it.sku, retenu: q.id }); break;
      }
    }
    if (resultat.pose) items.push(resultat.pose);
    else manquants.push({ id: it.id, slot: it.slotProgramme, usage: it.usageProgramme || p.fam, motif: resultat.motif });
  }
  const es = esDe(items, catalogue);
  items = items.map(it => {
    const p = produitDe(it, catalogue), s = p && porteurDe(it, p, es);
    return s && !it.fixe ? { ...it, kind: 'surface_item', attach_to: { type: 'furniture', id: s.it.id }, y: r(s.p.dim[2] + p.dim[2] / 2), height: r(s.p.dim[2] + p.dim[2] / 2) } : it;
  });
  // Ne jamais afficher une nouvelle TV sur le sol, ni deux objets superposés sur un plateau.
  const limiteRetraits=items.length;
  for (let tour=0;tour<limiteRetraits;tour++) {
    const conflit=verifierHauteurs(modele,items,catalogue).find(a=>['support-tv','volume-collision'].includes(a.type)&&a.ids.some(id=>!items.find(it=>it.id===id)?.fixe));
    if(!conflit)break;
    const candidats=items.filter(it=>conflit.ids.includes(it.id)&&!it.fixe
      && (['surface_item','ceiling_item'].includes(it.kind)||produitDe(it,catalogue)?.fam==='tv'))
      .sort((a,b)=>Number(produitDe(a,catalogue)?.fam==='tv')-Number(produitDe(b,catalogue)?.fam==='tv')
        ||Number(!!a.obligatoireProgramme)-Number(!!b.obligatoireProgramme)||(b.prioriteProgramme||9)-(a.prioriteProgramme||9));
    const retrait=candidats[0];if(!retrait)break;
    manquants.push({id:retrait.id,slot:retrait.slotProgramme,usage:retrait.usageProgramme||produitDe(retrait,catalogue)?.fam,motif:conflit.type});
    items=items.filter(it=>it.id!==retrait.id);
  }
  return { items, diagnostic: { version: 'composition-hauteur-2', manquants, substitutions, audit: verifierHauteurs(modele, items, catalogue), ...evaluerFinition(modele, items, catalogue, opts.programme) } };
}

export function evaluerFinition(modele, items, catalogue, programme) {
  const es = esDe(items, catalogue), pans = segmentsDe(modele), regles = [], ajouter = (id, points, ids = []) => regles.push({ id, points, ids });
  const mural = es.filter(e => estMural(e.p.fam)), zones = programme?.zones || [];
  const portes = pans.flatMap(p => (modele.murs?.[p.id]?.ouvertures || []).filter(o => ['porte', 'passage'].includes(o.type)).map(o => { const q = pointOuverture(p, o.position); return { x: q[0] + p.n[0] * .3, z: q[1] + p.n[1] * .3 }; }));
  const focal = es.find(e => e.it.usageProgramme === programme?.focal?.usage) || es.find(e => ['tv', 'tv-murale', 'lit', 'bureau', 'console'].includes(e.p.fam));
  if (focal) {
    const lisible = portes.some(porte => !es.some(e => e.it.id !== focal.it.id && e.it.id !== focal.it.attach_to?.id && !estMural(e.p.fam) && e.p.fam!=='tapis' && coupeVue(porte,focal,e,modele,es)));
    if (lisible) ajouter('focal-visible', POIDS_FINITION.focal, [focal.it.id]);
    const v=intervalleHauteur(focal.it,focal.p,modele,es);
    const battant=pans.some(p=>(modele.murs?.[p.id]?.ouvertures||[]).some(o=>{
      if(!['porte','passage'].includes(o.type)||v.bas>=(o.hauteur||2))return false;
      const b=zoneOuverture(p,o,.9,.025);
      return chevaucheVolumes(empreinteVolume(focal.it,focal.p),[[b.x0,b.z0],[b.x1,b.z0],[b.x1,b.z1],[b.x0,b.z1]]);
    }));
    if(battant)ajouter('focal-porte',POIDS_FINITION.porte,[focal.it.id]);
  }
  const tv = es.find(e => ['tv', 'tv-murale'].includes(e.p.fam)), sofa = es.find(e => e.p.fam === 'canape');
  if (tv && sofa) {
    const face = ((tv.it.x - sofa.it.x) * Math.sin(sofa.it.rot || 0) + (tv.it.z - sofa.it.z) * Math.cos(sofa.it.rot || 0)) / Math.max(.01, distance(tv.it, sofa.it));
    if (face > .85 && Math.abs(normaliserAngle((tv.it.rot || 0) - (sofa.it.rot || 0))) > Math.PI * .8) ajouter('tv-face-canape', POIDS_FINITION.tvFace, [tv.it.id, sofa.it.id]);
    if (fenetreFace(modele,tv.it)) ajouter('tv-contre-jour', POIDS_FINITION.contreJour, [tv.it.id]);
  }
  const luminaires = es.filter(e => ['lampe', 'lampadaire', 'applique', 'suspension', 'lustre', 'plafonnier'].includes(e.p.fam));
  for (const z of zones.filter(z => ['salon', 'repas', 'couchage', 'travail', 'lecture'].includes(z.id))) {
    const lumieres = luminaires.filter(e => e.it.zoneId === z.id);
    if (lumieres.length) ajouter('lumiere-zone', POIDS_FINITION.lumiereZone, lumieres.map(e => e.it.id));
  }
  for (const e of luminaires.filter(e => estSuspendu(e.p.fam))) {
    const table = es.find(q => q.it.zoneId === e.it.zoneId && q.it.usageProgramme === 'table-repas');
    if (table) ajouter('suspension-centree', distance(e.it, table.it) <= .04 ? POIDS_FINITION.suspensionCentree : POIDS_FINITION.suspensionDecentree, [e.it.id, table.it.id]);
  }
  for (const e of es.filter(e=>e.it.usageProgramme==='bureau')) {
    const lateral=pans.some(p=>(modele.murs?.[p.id]?.ouvertures||[]).some(o=>{
      if(!['fenetre','baie'].includes(o.type))return false;
      const q=pointOuverture(p,o.position),d=Math.hypot(q[0]-e.it.x,q[1]-e.it.z);
      return d>.1&&Math.abs(((q[0]-e.it.x)*Math.sin(e.it.rot||0)+(q[1]-e.it.z)*Math.cos(e.it.rot||0))/d)<.5;
    }));
    if(lateral)ajouter('bureau-lumiere-laterale',POIDS_FINITION.bureauLateral,[e.it.id]);
  }
  if (sofa) {
    const art = mural.find(e => e.it.usageProgramme === 'tableau-principal');
    ajouter('mur-principal', art ? POIDS_FINITION.murPrincipal : POIDS_FINITION.murPrincipalVide, art ? [art.it.id] : []);
    if (art && art.p.dim[0] >= sofa.p.dim[0] * .5 && art.p.dim[0] <= sofa.p.dim[0] * (2 / 3) + .001) ajouter('tableau-proportionne', POIDS_FINITION.tableauCentre, [art.it.id, sofa.it.id]);
  }
  for (const e of mural.filter(e => e.p.fam === 'miroir')) if (es.some(q => q.it.usageProgramme === 'console' && distance(e.it, q.it) < .5)) ajouter('miroir-console', POIDS_FINITION.miroirConsole, [e.it.id]);
  for (const a of verifierHauteurs(modele, items, catalogue)) ajouter(a.type, ['mur-collision','volume-collision'].includes(a.type) ? POIDS_FINITION.collision : a.type === 'mur-masque' ? POIDS_FINITION.masque : POIDS_FINITION.ouverture, a.ids);
  // Ne pas pousser à meubler un mur constitué uniquement d'ouvertures.
  for (const pan of pans) if (pan.long - (modele.murs?.[pan.id]?.ouvertures || []).reduce((s, o) => s + o.largeur, 0) > 1.2
    && !es.some(e => distanceSegment([e.it.x, e.it.z], pan.a, pan.b) < .65)) ajouter('mur-vide', POIDS_FINITION.murVide);
  const diagonale=tv?.p.diagonaleEcran;
  const tvDistance = tv && sofa ? { metres: r(distance(tv.it, sofa.it)), diagonale: Number.isFinite(diagonale)?r(diagonale):null,
    rapportDiagonale: Number.isFinite(diagonale)&&diagonale>0?r(distance(tv.it,sofa.it)/diagonale):null, indicatif:true } : null;
  return { score: regles.reduce((s, e) => s + e.points, 0), regles, focal: focal?.it.id || null,
    nombreMuraux: mural.filter(e => e.p.fam !== 'applique').length, cibleMuraux: programme?.details?.muraux || null, tvDistance };
}
