import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { materiauRevetement } from './revetements.js';

const CACHE_MATIERES = new Map();
const TOUR = Math.PI * 2;
const PROFILS = {
  contemporain: { nom: 'Contemporain', styles: ['contemporain', 'epure'], rayon: 0.025, pied: 'metal', facade: 'lisse' },
  classique: { nom: 'Classique', styles: ['classique', 'chaleureux'], rayon: 0.01, pied: 'tourne', facade: 'cadre' },
  japandi: { nom: 'Japandi', styles: ['japandi', 'scandinave', 'epure'], rayon: 0.018, pied: 'bois', facade: 'lattes' },
  industriel: { nom: 'Industriel', styles: ['industriel', 'contemporain'], rayon: 0.004, pied: 'cadre', facade: 'metal' },
  boheme: { nom: 'Bohème', styles: ['boheme', 'mediterraneen', 'chaleureux'], rayon: 0.035, pied: 'rotin', facade: 'cannage' },
  artdeco: { nom: 'Art déco', styles: ['artdeco', 'audacieux', 'chaleureux'], rayon: 0.022, pied: 'laiton', facade: 'cotes' }
};
const COULEURS = [
  ['naturel', 'Chêne clair et lin', '#C7B89E', '#C5A47A', '#343734'],
  ['ivoire', 'Ivoire et bois blanchi', '#E9E2D5', '#DDD2BA', '#B49A68'],
  ['caramel', 'Caramel et noyer', '#AC7D51', '#805E44', '#A88C58'],
  ['sauge', 'Sauge et bois teinté', '#98A28B', '#A3AA93', '#50584D'],
  ['bleu', 'Bleu profond et bois teinté', '#3D596C', '#4B6477', '#B39A67'],
  ['anthracite', 'Anthracite et bois fumé', '#414644', '#877360', '#242927']
];

function figer(valeur) {
  if (valeur && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
    Object.values(valeur).forEach(figer);
    Object.freeze(valeur);
  }
  return valeur;
}

function definirFiche(d) {
  const variantes = (d.choix || ['contemporain', 'classique', 'japandi', 'industriel', 'boheme', 'artdeco']).map(id => {
    const profil = PROFILS[id];
    const technique=['frigo','americain','linge','lave-vaisselle','hotte','clim','wc','douche','seche-serviettes','vasque','evier','plaque','cheminee','poele'].includes(d.type);
    const couleursBase=d.type==='vegetal'?[
      ['naturel','Sous-bois','#334C35','#7B9462','#353D30'],['ivoire','Panaché clair','#688061','#C2C6A5','#65715B'],['caramel','Olive doré','#606B3D','#A0A66C','#686C40'],['sauge','Sauge argentée','#64755F','#B2B79B','#6C7B62'],['bleu','Forêt bleutée','#304E46','#71958A','#385D54'],['anthracite','Forêt profonde','#233D32','#547F54','#293F32']
    ]:COULEURS;
    const coloris = couleursBase.map(([cle, nom, principale, bois, metal]) => ({
      id: cle, nom: technique?{naturel:d.type==='plaque'?'Noir vitro':d.type==='poele'?'Fonte noire':d.type==='evier'?'Inox':'Blanc mat',ivoire:'Ivoire',caramel:'Beige sable',sauge:'Vert sauge',bleu:'Bleu profond',anthracite:'Anthracite'}[cle]:d.type==='credence'&&cle==='naturel'?'Vert sauge':nom,
      couleurs: [technique&&cle==='naturel'?(['plaque','poele'].includes(d.type)?'#252B2A':d.type==='evier'?'#B8C1C1':'#E9E7E2'):d.type==='credence'&&cle==='naturel'?'#A0AD92':principale, bois,
        cle==='naturel'?(id==='industriel'?'#292E2D':id==='artdeco'||id==='classique'?'#AD925D':technique?'#B8C1C1':metal):{ivoire:'#DADCD5',caramel:'#A38350',sauge:'#75816A',bleu:'#38596B',anthracite:'#171B1A'}[cle]]
    }));
    return { id, nom: profil.nom, styles: profil.styles.slice(), coloris };
  });
  const styles = [...new Set(variantes.flatMap(v => v.styles))];
  return {
    ...d, choix: undefined, styles, stylePrincipal: variantes[0].styles[0], variantes,
    coloris: variantes[0].coloris, cols: variantes[0].coloris[0].couleurs,
    posable: Boolean(d.posable), degagement: d.degagement ?? 0.6,
    description: d.description || d.nom + ', proportions et détails adaptés au style choisi.'
  };
}

function preparer(p) {
  if (!p || !Object.hasOwn(ELEMENTS, p.id)) throw Error('Élément inconnu : ' + (p && p.id));
  const f = ELEMENTS[p.id];
  const v = f.variantes.find(v => v.id === (p.variante || f.variantes[0].id));
  if (!v) throw Error('Variante inconnue : ' + p.variante);
  const c = v.coloris.find(c => c.id === (typeof p.coloris === 'string' ? p.coloris : v.coloris[0].id));
  if (!c) throw Error('Coloris inconnu : ' + p.coloris);
  const dim = p.dim || f.dim;
  if (!Array.isArray(dim) || dim.length !== 3) throw Error('Dimensions attendues : [largeur, profondeur, hauteur].');
  dim.forEach((n, i) => {
    if (!Number.isFinite(n) || n < f.dimMin[i] - 1e-8 || n > f.dimMax[i] + 1e-8) throw Error('Dimension hors plage : ' + p.id);
  });
  // Les cols d'une fiche recopiée ne doivent pas masquer un coloris explicite.
  const cols = p.cols && !((p.coloris || p.variante) && p.cols === f.cols) ? p.cols : c.couleurs;
  if (!Array.isArray(cols) || cols.length < 2 || cols.some(c => !/^#[0-9A-Fa-f]{6}$/.test(c))) throw Error('Coloris attendus au format #RRGGBB.');
  return { ...f, ...p, dim: dim.slice(), cols: [cols[0], cols[1], cols[2] || '#343734'], coloris: c.id, variante: v.id, profil: PROFILS[v.id] };
}

function hasardDepuis(texte) {
  let graine = 2166136261;
  for (const caractere of texte) graine = Math.imul(graine ^ caractere.charCodeAt(0), 16777619);
  return () => {
    graine = (graine + 0x6D2B79F5) >>> 0;
    let t = Math.imul(graine ^ (graine >>> 15), graine | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toileNeuve(taille = 256) {
  let toile;
  if (typeof OffscreenCanvas !== 'undefined') toile = new OffscreenCanvas(taille, taille);
  else if (typeof document !== 'undefined') { toile = document.createElement('canvas'); toile.width = toile.height = taille; }
  else throw Error('Construction 3D à effectuer dans un navigateur ou un worker avec canvas.');
  return toile;
}

function texturesMatiere(type, couleur) {
  const toile = toileNeuve(), relief = toileNeuve();
  const c = toile.getContext('2d'), r = relief.getContext('2d');
  const hasard = hasardDepuis(type + ':' + couleur);
  c.fillStyle = couleur; c.fillRect(0, 0, 256, 256);
  r.fillStyle = '#808080'; r.fillRect(0, 0, 256, 256);
  const couleurTrace = (clair, opacite) => { c.fillStyle = clair ? '#FFFFFF' : '#171410'; c.globalAlpha = opacite; };
  if (type === 'bois' || type === 'rotin') {
    for (let i = 0; i < 230; i++) {
      const y = hasard() * 256, amplitude = 0.5 + hasard() * 2, phase = hasard() * TOUR;
      c.strokeStyle = i % 3 ? '#3D2617' : '#F2E0BD'; c.globalAlpha = 0.04 + hasard() * 0.06; c.lineWidth = 0.4 + hasard() * 0.6;
      r.strokeStyle = i % 2 ? '#777777' : '#929292'; r.lineWidth = 0.65;
      for (const contexte of [c, r]) {
        contexte.beginPath();
        for (let x = 0; x <= 256; x += 8) {
          const v = y + Math.sin(x / 256 * TOUR + phase) * amplitude;
          if (x === 0) contexte.moveTo(x, v); else contexte.lineTo(x, v);
        }
        contexte.stroke();
      }
    }
  } else if (type === 'cannage') {
    c.fillStyle = '#59442E'; c.globalAlpha = 0.72; c.fillRect(0, 0, 256, 256);
    for (let y = -32; y < 288; y += 16) for (let x = -32; x < 288; x += 16) {
      c.fillStyle = couleur; c.globalAlpha = 1;
      c.fillRect(x, y, 4, 16); c.fillRect(x, y, 16, 4);
      r.fillStyle = '#B8B8B8'; r.fillRect(x, y, 4, 16); r.fillRect(x, y, 16, 4);
    }
    c.strokeStyle = couleur; c.lineWidth = 2; c.globalAlpha = 0.8;
    for (let i = -256; i < 512; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 256, 256); c.stroke(); }
  } else {
    const pas = type === 'bouclette' ? 4 : type === 'cotele' ? 8 : 2;
    for (let y = 0; y < 256; y += pas) for (let x = 0; x < 256; x += pas) {
      couleurTrace((x + y) % 2 === 0, 0.035 + hasard() * 0.045);
      c.fillRect(x, y, Math.max(1, pas - 1), 1);
      r.strokeStyle = '#9D9D9D'; r.lineWidth = 0.7;
      if (type === 'bouclette') { r.beginPath(); r.ellipse(x + 2, y + 2, 1.6, 1.9, 0, 0, TOUR); r.stroke(); }
      else { r.fillStyle = x % 2 ? '#727272' : '#929292'; r.fillRect(x, y, type === 'cotele' ? 3 : 1, pas); }
    }
  }
  c.globalAlpha = 1;
  return [toile, relief].map((image, i) => {
    const texture = new THREE.CanvasTexture(image);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    const pas = type === 'bois' || type === 'rotin' ? 0.6 : type === 'cannage' ? 0.25 : 0.18;
    texture.repeat.set(1 / pas, 1 / pas);
    texture.colorSpace = i ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.userData.partage = true;
    return texture;
  });
}

function matiere(type, couleur = '#D8D1C2') {
  const cle = type + ':' + couleur.toUpperCase();
  if (CACHE_MATIERES.has(cle)) return CACHE_MATIERES.get(cle);
  let m;
  if (type === 'marbre' || type === 'travertin') m = materiauRevetement(type === 'marbre' ? 'marbre-mural' : 'travertin', { couleur });
  else if (type === 'verre') m = new THREE.MeshPhysicalMaterial({ color: '#F4FAF8', transmission: 0.88, thickness: 0.012, roughness: 0.09, metalness: 0, ior: 1.5 });
  else if (type === 'miroir') m = new THREE.MeshPhysicalMaterial({ color: '#CDD6D5', metalness: 1, roughness: 0.07 });
  else if (type === 'metal' || type === 'chrome' || type === 'laque') m = new THREE.MeshPhysicalMaterial({ color: couleur, metalness: type === 'laque' ? 0 : 0.9, roughness: type === 'chrome' ? 0.13 : type === 'laque' ? 0.2 : 0.35, clearcoat: type === 'laque' ? 0.55 : 0 });
  else if (type === 'lumiere') m = new THREE.MeshStandardMaterial({ color: '#F4E9CD', emissive: '#F2D6A3', emissiveIntensity: 0.23, roughness: 0.65 });
  else if (type === 'voile') m = new THREE.MeshStandardMaterial({ color: '#F1ECE1', roughness: 0.95, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
  else if (type === 'feuille') m = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.58, side: THREE.DoubleSide });
  else {
    const texturee = ['bois', 'rotin', 'cannage', 'lin', 'bouclette', 'cotele', 'cuir'].includes(type);
    m = new THREE.MeshStandardMaterial({ color: texturee ? '#FFFFFF' : couleur, roughness: type === 'cuir' ? 0.55 : type === 'ceramique' ? 0.28 : 0.85 });
    if (texturee) { const [carte, relief] = texturesMatiere(type, couleur); m.map = carte; m.bumpMap = relief; m.bumpScale = type === 'bouclette' ? 0.0018 : 0.0006; }
  }
  if (type === 'marquage') { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; }
  if (['lin', 'bouclette', 'cotele', 'cannage', 'verre'].includes(type)) m.side = THREE.DoubleSide;
  m.userData.partage = true;
  CACHE_MATIERES.set(cle, m);
  return m;
}

function uvMetriques(geo) {
  const pos = geo.getAttribute('position'), normales = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
  if (!uv || !normales) return geo;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(normales.getX(i)), ny = Math.abs(normales.getY(i)), nz = Math.abs(normales.getZ(i));
    uv.setXY(i, nx > ny && nx > nz ? pos.getZ(i) : pos.getX(i), ny > nx && ny > nz ? pos.getZ(i) : pos.getY(i));
  }
  return geo;
}

function atelier(p) {
  const g = new THREE.Group(), [w, d, h] = p.dim, s = p.profil;
  const bois = matiere(s.pied === 'rotin' ? 'rotin' : 'bois', p.cols[1]);
  const metal = matiere('metal', p.cols[2]);
  const tissu = matiere(p.id.includes('cuir') || p.id.includes('club') || p.id.includes('chesterfield') ? 'cuir' : p.variante === 'contemporain' ? 'bouclette' : p.variante === 'artdeco' ? 'cotele' : 'lin', p.cols[0]);
  const m = {
    bois, metal, tissu, principal: matiere('uni', p.cols[0]),
    facade: matiere(s.facade === 'cannage'||p.id.includes('rotin')||p.id.includes('canne')||p.id.includes('tresse') ? 'cannage' : s.facade === 'metal' ? 'metal' : 'bois', s.facade === 'metal'&&!p.id.includes('canne')&&!p.id.includes('rotin')&&!p.id.includes('tresse') ? p.cols[0] : p.cols[1]),
    clair: matiere('ceramique', ['vasque','wc','douche'].includes(p.type)?p.cols[0]:'#EAE6DD'), noir: matiere('marquage', '#242A29'),
    verre: matiere('verre'), chrome: matiere('chrome', '#B8C1C1')
  };
  const hasard = hasardDepuis(p.id + ':' + p.variante);
  function mesh(geo, mat, x = 0, y = 0, z = 0) {
    const o = new THREE.Mesh(uvMetriques(geo), mat); o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true; g.add(o); return o;
  }
  function box(a, b, c, x = 0, y = 0, z = 0, mat = bois, rayon = s.rayon * 0.5) {
    const geo = rayon > 0 ? new RoundedBoxGeometry(Math.max(a, 0.001), Math.max(b, 0.001), Math.max(c, 0.001), 1, Math.min(rayon, a * 0.45, b * 0.45, c * 0.45)) : new THREE.BoxGeometry(a, b, c);
    return mesh(geo, mat, x, y + b / 2, z);
  }
  function cyl(rt, rb, hh, x = 0, y = 0, z = 0, mat = bois, segments = 16) {
    return mesh(new THREE.CylinderGeometry(rt, rb, hh, segments), mat, x, y + hh / 2, z);
  }
  function ellipsoide(a, b, c, x, y, z, mat = tissu) {
    const geo = new THREE.SphereGeometry(1, 16, 10); geo.scale(a / 2, b / 2, c / 2);
    return mesh(geo, mat, x, y + b / 2, z);
  }
  function barre(a, b, rayon = 0.012, mat = metal) {
    const depart = new THREE.Vector3(...a), arrivee = new THREE.Vector3(...b), axe = arrivee.clone().sub(depart);
    const o = mesh(new THREE.CylinderGeometry(rayon, rayon, axe.length(), 8), mat);
    o.position.copy(depart.add(arrivee).multiplyScalar(0.5)); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axe.normalize()); return o;
  }
  function tube(points, rayon = 0.012, mat = metal) {
    const courbe = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(new THREE.TubeGeometry(courbe, 20, rayon, 6, false), mat);
  }
  function anneau(rx, ry, epaisseur, x, y, z, mat = metal) {
    const geo = new THREE.TorusGeometry(1, epaisseur / Math.max(rx, ry), 6, 32);
    geo.scale(rx, ry, Math.min(rx, ry));
    return mesh(geo, mat, x, y, z);
  }
  function profil(points, epaisseur, x, y, z, mat = bois) {
    const forme = new THREE.Shape(); points.forEach(([a, b], i) => i ? forme.lineTo(a, b) : forme.moveTo(a, b)); forme.closePath();
    const geo = new THREE.ExtrudeGeometry(forme, { depth: epaisseur, bevelEnabled: false, curveSegments: 12 });
    geo.translate(0, 0, -epaisseur / 2); return mesh(geo, mat, x, y, z);
  }
  function revolution(points, x, y, z, mat = bois) {
    return mesh(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), 24), mat, x, y, z);
  }
  function instances(geo, mat, poses, couleurs) {
    const o = new THREE.InstancedMesh(uvMetriques(geo), mat, poses.length), objet = new THREE.Object3D();
    poses.forEach((pose, i) => {
      objet.position.set(...pose.position); objet.rotation.set(...(pose.rotation || [0, 0, 0])); objet.scale.set(...(pose.echelle || [1, 1, 1])); objet.updateMatrix();
      o.setMatrixAt(i, objet.matrix); if (couleurs) o.setColorAt(i, new THREE.Color(couleurs[i % couleurs.length]));
    });
    o.instanceMatrix.needsUpdate = true; o.computeBoundingBox(); o.computeBoundingSphere();
    o.castShadow = o.receiveShadow = true; g.add(o); return o;
  }
  function pieds(largeur, profondeur, hauteur, y = 0, forme = s.pied) {
    const rayon = Math.min(0.025, largeur * 0.07, profondeur * 0.07), retrait = Math.max(rayon, 0.035);
    for (const x of [-largeur / 2 + retrait, largeur / 2 - retrait]) for (const z of [-profondeur / 2 + retrait, profondeur / 2 - retrait]) {
      if (forme === 'tourne') revolution([[0.016, 0], [0.024, 0.035], [0.017, hauteur * 0.5], [0.027, hauteur * 0.8], [0.022, hauteur]], x, y, z, bois);
      else if (forme === 'cadre') box(0.025, hauteur, 0.025, x, y, z, metal, 0);
      else if (forme === 'rotin') { if(hauteur<.09)cyl(rayon*.8,rayon*.8,hauteur,x,y,z,bois,12);else {tube([[x,y+0.01,z],[x*1.035,y+hauteur*0.48,z*1.035],[x,y+hauteur-0.01,z]],rayon*0.8,bois);cyl(rayon*.8,rayon*.8,.012,x,y,z,bois,12);} }
      else if (forme === 'laiton') cyl(0.012,0.02,hauteur,x,y,z,metal,12);
      else cyl(forme === 'bois' ? rayon * 0.85 : 0.014, rayon, hauteur, x, y, z, forme === 'bois' ? bois : metal, 12);
    }
    if (forme === 'cadre') for (const z of [-profondeur / 2 + retrait, profondeur / 2 - retrait]) box(largeur - retrait * 2, 0.022, 0.025, 0, y + 0.03, z, metal, 0);
  }
  function facade(largeur, hauteur, x, y, z, profondeur = 0.018, mat = m.facade) {
    box(largeur, hauteur, profondeur, x, y, z, mat, s.rayon * 0.3);
    if (s.facade === 'cadre') {
      const bande = Math.min(0.036, largeur * 0.1, hauteur * 0.1);
      for (const dx of [-largeur / 2 + bande / 2, largeur / 2 - bande / 2]) box(bande, hauteur, 0.009, x + dx, y, z + profondeur / 2 + 0.0075, bois, 0.002);
      for (const dy of [0, hauteur - bande]) box(largeur - bande * 2, bande, 0.009, x, y + dy, z + profondeur / 2 + 0.0075, bois, 0.002);
    } else if (s.facade === 'lattes' || s.facade === 'cotes') {
      const nombre = Math.max(2, Math.min(40, Math.floor(largeur / 0.035)));
      const poses = Array.from({ length: nombre }, (_, i) => ({ position: [x - largeur / 2 + (i + 0.5) * largeur / nombre, y + hauteur / 2, z + profondeur / 2 + 0.008] }));
      instances(new THREE.BoxGeometry(0.012, Math.max(0.02, hauteur - 0.012), 0.006), bois, poses);
    }
  }
  function poignee(x, y, z, verticale = false, longueur = 0.11) {
    if (p.variante === 'contemporain') { box(verticale ? 0.007 : longueur, verticale ? longueur : 0.007, 0.006, x, y, z, m.noir, 0.002); return; }
    if (p.variante === 'classique') { const o = cyl(0.012, 0.012, 0.014, x, y - 0.012, z, metal, 12); o.rotation.x = Math.PI / 2; return; }
    box(verticale ? 0.012 : longueur, verticale ? longueur : 0.012, 0.014, x, y, z, p.variante === 'japandi' || p.variante === 'boheme' ? bois : metal, 0.005);
  }
  function robinet(x, y, z, hauteur = 0.24) {
    const rayon = 0.009;
    cyl(0.022, 0.022, 0.035, x, y, z, m.chrome, 16);
    const arc = tube([[x, y + 0.02, z], [x, y + hauteur * 0.8, z], [x, y + hauteur - rayon, z + 0.07], [x, y + hauteur * 0.75, z + 0.13]], rayon, m.chrome);
    arc.geometry.computeBoundingBox();
    const correction = hauteur / (arc.geometry.boundingBox.max.y - y);
    arc.geometry.translate(0, -y, 0); arc.geometry.scale(1, correction, 1); arc.geometry.translate(0, y, 0);
    box(0.055, 0.008, 0.014, x + 0.024, y + 0.05, z, m.chrome, 0.003);
  }
  return { p, g, w, d, h, s, m, hasard, mesh, box, cyl, ellipsoide, barre, tube, anneau, profil, revolution, instances, pieds, facade, poignee, robinet };
}

function fusionner(g) {
  g.updateMatrixWorld(true);
  const lots = new Map();
  for (const o of g.children.slice()) {
    if (!o.isMesh || o.isInstancedMesh) continue;
    const cle = o.material.uuid + ':' + Number(o.castShadow);
    if (!lots.has(cle)) lots.set(cle, { materiau: o.material, ombre: o.castShadow, objets: [] });
    lots.get(cle).objets.push(o);
  }
  for (const lot of lots.values()) {
    if (lot.objets.length < 2) continue;
    const geometries = lot.objets.map(o => {
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      geo.applyMatrix4(o.matrix); return geo;
    });
    const fusion = new THREE.BufferGeometry();
    for (const nom of ['position', 'normal', 'uv']) {
      const taille = nom === 'uv' ? 2 : 3;
      const longueur = geometries.reduce((s, geo) => s + geo.getAttribute(nom).array.length, 0);
      const valeurs = new Float32Array(longueur); let indice = 0;
      for (const geo of geometries) { const a = geo.getAttribute(nom).array; valeurs.set(a, indice); indice += a.length; }
      fusion.setAttribute(nom, new THREE.BufferAttribute(valeurs, taille));
    }
    fusion.computeBoundingBox(); fusion.computeBoundingSphere();
    const o = new THREE.Mesh(fusion, lot.materiau); o.castShadow = lot.ombre; o.receiveShadow = true; g.add(o);
    lot.objets.forEach(o => { g.remove(o); o.geometry.dispose(); }); geometries.forEach(geo => geo.dispose());
  }
}

function terminer(a) {
  const { g, p, w, d, h } = a;
  fusionner(g);
  const b = new THREE.Box3().setFromObject(g, true), taille = b.getSize(new THREE.Vector3()), centre = b.getCenter(new THREE.Vector3());
  if (taille.x <= 0 || taille.y <= 0 || taille.z <= 0) throw Error('Géométrie vide : ' + p.id);
  g.scale.set(w / taille.x, h / taille.y, d / taille.z);
  g.position.set(-centre.x * g.scale.x, p.pose === 'plafond' ? -b.max.y * g.scale.y : -b.min.y * g.scale.y, (p.pose === 'mur' || p.pose === 'lineaire' ? d / 2 : 0) - centre.z * g.scale.z);
  g.userData = { element: true, id: p.id, variante: p.variante, coloris: p.coloris || 'naturel', styles: p.profil.styles.slice(), dim: p.dim.slice(), correction: g.scale.toArray() };
  g.name = p.id + ':' + p.variante;
  g.updateMatrixWorld(true);
  return g;
}

export function construireElement(p) {
  const options = preparer(p), a = atelier(options);
  dessiner(a);
  return terminer(a);
}

const DONNEES = [
  {
    "id": "miroir-rond",
    "nom": "Miroir rond",
    "type": "miroir",
    "fam": "miroir",
    "pose": "mur",
    "dim": [
      0.7,
      0.035,
      0.7
    ],
    "dimMin": [
      0.49,
      0.025,
      0.525
    ],
    "dimMax": [
      1.12,
      0.053,
      0.945
    ],
    "forme": "rond"
  },
  {
    "id": "miroir-arche",
    "nom": "Miroir arche",
    "type": "miroir",
    "fam": "miroir",
    "pose": "mur",
    "dim": [
      0.6,
      0.04,
      1
    ],
    "dimMin": [
      0.42,
      0.028,
      0.75
    ],
    "dimMax": [
      0.96,
      0.06,
      1.35
    ],
    "forme": "arche"
  },
  {
    "id": "miroir-ovale",
    "nom": "Miroir ovale",
    "type": "miroir",
    "fam": "miroir",
    "pose": "mur",
    "dim": [
      0.6,
      0.035,
      0.9
    ],
    "dimMin": [
      0.42,
      0.025,
      0.675
    ],
    "dimMax": [
      0.96,
      0.053,
      1.215
    ],
    "forme": "ovale"
  },
  {
    "id": "miroir-irregulier",
    "nom": "Miroir irrégulier",
    "type": "miroir",
    "fam": "miroir",
    "pose": "mur",
    "dim": [
      0.8,
      0.035,
      0.85
    ],
    "dimMin": [
      0.56,
      0.025,
      0.637
    ],
    "dimMax": [
      1.28,
      0.053,
      1.147
    ],
    "forme": "irregulier"
  },
  {
    "id": "miroir-rectangle",
    "nom": "Miroir à grand cadre",
    "type": "miroir",
    "fam": "miroir",
    "pose": "mur",
    "dim": [
      0.9,
      0.055,
      1.2
    ],
    "dimMin": [
      0.63,
      0.038,
      0.9
    ],
    "dimMax": [
      1.44,
      0.083,
      1.62
    ],
    "forme": "rectangle"
  },
  {
    "id": "miroir-sur-pied",
    "nom": "Miroir sur pied",
    "type": "miroir",
    "fam": "miroir",
    "pose": "sol",
    "dim": [
      0.55,
      0.4,
      1.6
    ],
    "dimMin": [
      0.385,
      0.28,
      1.2
    ],
    "dimMax": [
      0.88,
      0.6,
      2.16
    ],
    "forme": "arche"
  },
  {
    "id": "tableau-cadre",
    "nom": "Tableau encadré",
    "type": "tableau",
    "fam": "tableau",
    "pose": "mur",
    "dim": [
      0.7,
      0.035,
      0.9
    ],
    "dimMin": [
      0.49,
      0.025,
      0.675
    ],
    "dimMax": [
      1.12,
      0.053,
      1.215
    ],
    "nombre": 1
  },
  {
    "id": "triptyque",
    "nom": "Triptyque",
    "type": "tableau",
    "fam": "tableau",
    "pose": "mur",
    "dim": [
      1.5,
      0.035,
      0.8
    ],
    "dimMin": [
      1.05,
      0.025,
      0.6
    ],
    "dimMax": [
      2.4,
      0.053,
      1.08
    ],
    "nombre": 3
  },
  {
    "id": "mur-cadres",
    "nom": "Mur de cadres",
    "type": "tableau",
    "fam": "tableau",
    "pose": "mur",
    "dim": [
      1.6,
      0.035,
      1.1
    ],
    "dimMin": [
      1.12,
      0.025,
      0.825
    ],
    "dimMax": [
      2.56,
      0.053,
      1.485
    ],
    "nombre": 6
  },
  {
    "id": "tapis-rectangulaire",
    "nom": "Tapis rectangulaire",
    "type": "tapis",
    "fam": "tapis",
    "pose": "sol",
    "dim": [
      2,
      2.8,
      0.012
    ],
    "dimMin": [
      1.4,
      1.96,
      0.009
    ],
    "dimMax": [
      3.2,
      4.2,
      0.016
    ],
    "forme": "rectangle",
    "degagement": 0
  },
  {
    "id": "tapis-rond",
    "nom": "Tapis rond",
    "type": "tapis",
    "fam": "tapis",
    "pose": "sol",
    "dim": [
      1.8,
      1.8,
      0.012
    ],
    "dimMin": [
      1.26,
      1.26,
      0.009
    ],
    "dimMax": [
      2.88,
      2.7,
      0.016
    ],
    "forme": "rond",
    "degagement": 0
  },
  {
    "id": "tapis-organique",
    "nom": "Tapis organique",
    "type": "tapis",
    "fam": "tapis",
    "pose": "sol",
    "dim": [
      2,
      2.5,
      0.014
    ],
    "dimMin": [
      1.4,
      1.75,
      0.011
    ],
    "dimMax": [
      3.2,
      3.75,
      0.019
    ],
    "forme": "irregulier",
    "degagement": 0
  },
  {
    "id": "tapis-berbere",
    "nom": "Tapis berbère",
    "type": "tapis",
    "fam": "tapis",
    "pose": "sol",
    "dim": [
      2,
      2.8,
      0.018
    ],
    "dimMin": [
      1.4,
      1.96,
      0.013
    ],
    "dimMax": [
      3.2,
      4.2,
      0.024
    ],
    "forme": "rectangle",
    "degagement": 0
  },
  {
    "id": "tapis-jute",
    "nom": "Tapis en jute",
    "type": "tapis",
    "fam": "tapis",
    "pose": "sol",
    "dim": [
      1.8,
      1.8,
      0.009
    ],
    "dimMin": [
      1.26,
      1.26,
      0.007
    ],
    "dimMax": [
      2.88,
      2.7,
      0.012
    ],
    "forme": "rond",
    "degagement": 0
  },
  {
    "id": "tapis-motifs",
    "nom": "Tapis à motifs",
    "type": "tapis",
    "fam": "tapis",
    "pose": "sol",
    "dim": [
      2,
      2.8,
      0.012
    ],
    "dimMin": [
      1.4,
      1.96,
      0.009
    ],
    "dimMax": [
      3.2,
      4.2,
      0.016
    ],
    "forme": "rectangle",
    "degagement": 0
  },
  {
    "id": "plante-olivier",
    "nom": "Olivier en pot",
    "type": "plante",
    "fam": "plante",
    "pose": "sol",
    "dim": [
      0.85,
      0.8,
      1.65
    ],
    "dimMin": [
      0.595,
      0.56,
      1.237
    ],
    "dimMax": [
      1.36,
      1.2,
      2.228
    ]
  },
  {
    "id": "plante-olivier-petite",
    "nom": "Olivier en petit pot",
    "type": "plante",
    "fam": "plante",
    "pose": "sol",
    "dim": [
      0.468,
      0.44,
      0.907
    ],
    "dimMin": [
      0.328,
      0.308,
      0.68
    ],
    "dimMax": [
      0.749,
      0.66,
      1.224
    ],
    "posable": true
  },
  {
    "id": "plante-ficus",
    "nom": "Ficus en pot",
    "type": "plante",
    "fam": "plante",
    "pose": "sol",
    "dim": [
      0.7,
      0.7,
      1.5
    ],
    "dimMin": [
      0.49,
      0.49,
      1.125
    ],
    "dimMax": [
      1.12,
      1.05,
      2.025
    ]
  },
  {
    "id": "plante-ficus-petite",
    "nom": "Ficus en petit pot",
    "type": "plante",
    "fam": "plante",
    "pose": "sol",
    "dim": [
      0.385,
      0.385,
      0.825
    ],
    "dimMin": [
      0.269,
      0.269,
      0.619
    ],
    "dimMax": [
      0.616,
      0.578,
      1.114
    ],
    "posable": true
  },
  {
    "id": "plante-monstera",
    "nom": "Monstera en pot",
    "type": "plante",
    "fam": "plante",
    "pose": "sol",
    "dim": [
      0.8,
      0.8,
      1.05
    ],
    "dimMin": [
      0.56,
      0.56,
      0.788
    ],
    "dimMax": [
      1.28,
      1.2,
      1.418
    ]
  },
  {
    "id": "plante-monstera-petite",
    "nom": "Monstera en petit pot",
    "type": "plante",
    "fam": "plante",
    "pose": "sol",
    "dim": [
      0.44,
      0.44,
      0.578
    ],
    "dimMin": [
      0.308,
      0.308,
      0.433
    ],
    "dimMax": [
      0.704,
      0.66,
      0.78
    ],
    "posable": true
  },
  {
    "id": "plante-palmier",
    "nom": "Palmier en pot",
    "type": "plante",
    "fam": "plante",
    "pose": "sol",
    "dim": [
      1,
      1,
      1.8
    ],
    "dimMin": [
      0.7,
      0.7,
      1.35
    ],
    "dimMax": [
      1.6,
      1.5,
      2.43
    ]
  },
  {
    "id": "plante-palmier-petite",
    "nom": "Palmier en petit pot",
    "type": "plante",
    "fam": "plante",
    "pose": "sol",
    "dim": [
      0.55,
      0.55,
      0.99
    ],
    "dimMin": [
      0.385,
      0.385,
      0.742
    ],
    "dimMax": [
      0.88,
      0.825,
      1.337
    ],
    "posable": true
  },
  {
    "id": "plante-cactus",
    "nom": "Cactus en pot",
    "type": "plante",
    "fam": "plante",
    "pose": "sol",
    "dim": [
      0.45,
      0.45,
      0.95
    ],
    "dimMin": [
      0.315,
      0.315,
      0.712
    ],
    "dimMax": [
      0.72,
      0.675,
      1.282
    ]
  },
  {
    "id": "plante-cactus-petite",
    "nom": "Cactus en petit pot",
    "type": "plante",
    "fam": "plante",
    "pose": "sol",
    "dim": [
      0.248,
      0.248,
      0.522
    ],
    "dimMin": [
      0.174,
      0.174,
      0.392
    ],
    "dimMax": [
      0.397,
      0.372,
      0.705
    ],
    "posable": true
  },
  {
    "id": "plante-suspendue",
    "nom": "Plante suspendue",
    "type": "plante",
    "fam": "plante",
    "pose": "plafond",
    "dim": [
      0.65,
      0.65,
      1
    ],
    "dimMin": [
      0.455,
      0.455,
      0.75
    ],
    "dimMax": [
      1.04,
      0.975,
      1.35
    ]
  },
  {
    "id": "vase",
    "nom": "Vase",
    "type": "vase",
    "fam": "autre",
    "pose": "sol",
    "dim": [
      0.2,
      0.2,
      0.32
    ],
    "dimMin": [
      0.14,
      0.14,
      0.24
    ],
    "dimMax": [
      0.32,
      0.3,
      0.432
    ],
    "posable": true
  },
  {
    "id": "vase-haut",
    "nom": "Vase haut",
    "type": "vase",
    "fam": "autre",
    "pose": "sol",
    "dim": [
      0.22,
      0.22,
      0.55
    ],
    "dimMin": [
      0.154,
      0.154,
      0.413
    ],
    "dimMax": [
      0.352,
      0.33,
      0.743
    ],
    "posable": true
  },
  {
    "id": "sculpture",
    "nom": "Sculpture abstraite",
    "type": "sculpture",
    "fam": "autre",
    "pose": "sol",
    "dim": [
      0.25,
      0.18,
      0.4
    ],
    "dimMin": [
      0.175,
      0.126,
      0.3
    ],
    "dimMax": [
      0.4,
      0.27,
      0.54
    ],
    "posable": true
  },
  {
    "id": "livres-decoratifs",
    "nom": "Livres décoratifs",
    "type": "livres",
    "fam": "autre",
    "pose": "sol",
    "dim": [
      0.28,
      0.2,
      0.12
    ],
    "dimMin": [
      0.196,
      0.14,
      0.09
    ],
    "dimMax": [
      0.448,
      0.3,
      0.162
    ],
    "posable": true
  },
  {
    "id": "bougie",
    "nom": "Bougie",
    "type": "bougie",
    "fam": "autre",
    "pose": "sol",
    "dim": [
      0.09,
      0.09,
      0.16
    ],
    "dimMin": [
      0.063,
      0.063,
      0.12
    ],
    "dimMax": [
      0.144,
      0.135,
      0.216
    ],
    "posable": true
  },
  {
    "id": "plateau",
    "nom": "Plateau décoratif",
    "type": "plateau",
    "fam": "autre",
    "pose": "sol",
    "dim": [
      0.4,
      0.28,
      0.035
    ],
    "dimMin": [
      0.28,
      0.196,
      0.026
    ],
    "dimMax": [
      0.64,
      0.42,
      0.047
    ],
    "posable": true
  },
  {
    "id": "salon-jardin",
    "nom": "Salon de jardin",
    "type": "salon",
    "fam": "salon-jardin",
    "pose": "sol",
    "dim": [
      2.8,
      2,
      0.86
    ],
    "dimMin": [
      1.96,
      1.4,
      0.645
    ],
    "dimMax": [
      4.48,
      3.0,
      1.161
    ]
  },
  {
    "id": "table-jardin",
    "nom": "Table de jardin",
    "type": "table-jardin",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.6,
      0.85,
      0.75
    ],
    "dimMin": [
      1.12,
      0.595,
      0.562
    ],
    "dimMax": [
      2.56,
      1.275,
      1.013
    ],
    "usage": "table-repas"
  },
  {
    "id": "chaise-jardin",
    "nom": "Chaise de jardin",
    "type": "chaise-jardin",
    "fam": "chaise",
    "pose": "sol",
    "dim": [
      0.55,
      0.6,
      0.86
    ],
    "dimMin": [
      0.385,
      0.42,
      0.645
    ],
    "dimMax": [
      0.88,
      0.9,
      1.161
    ]
  },
  {
    "id": "transat",
    "nom": "Transat",
    "type": "transat",
    "fam": "salon-jardin",
    "pose": "sol",
    "dim": [
      0.7,
      1.9,
      0.85
    ],
    "dimMin": [
      0.49,
      1.33,
      0.637
    ],
    "dimMax": [
      1.12,
      2.85,
      1.147
    ]
  },
  {
    "id": "fauteuil-suspendu",
    "nom": "Fauteuil suspendu",
    "type": "suspendu",
    "fam": "fauteuil",
    "pose": "sol",
    "dim": [
      1.05,
      1.1,
      1.95
    ],
    "dimMin": [
      0.735,
      0.77,
      1.462
    ],
    "dimMax": [
      1.68,
      1.65,
      2.633
    ]
  },
  {
    "id": "hamac",
    "nom": "Hamac avec support",
    "type": "hamac",
    "fam": "salon-jardin",
    "pose": "sol",
    "dim": [
      3,
      1.1,
      1.2
    ],
    "dimMin": [
      2.1,
      0.77,
      0.9
    ],
    "dimMax": [
      4.8,
      1.65,
      1.62
    ]
  },
  {
    "id": "jardiniere",
    "nom": "Jardinière plantée",
    "type": "jardiniere",
    "fam": "plante",
    "pose": "sol",
    "dim": [
      1,
      0.4,
      0.8
    ],
    "dimMin": [
      0.7,
      0.28,
      0.6
    ],
    "dimMax": [
      1.6,
      0.6,
      1.08
    ]
  },
  {
    "id": "parasol-deporte",
    "nom": "Parasol déporté",
    "type": "parasol-deporte",
    "fam": "salon-jardin",
    "pose": "sol",
    "dim": [
      3,
      2.7,
      2.6
    ],
    "dimMin": [
      2.1,
      1.89,
      1.95
    ],
    "dimMax": [
      4.8,
      4.05,
      3.51
    ]
  }
];

export const ELEMENTS = figer(Object.fromEntries(DONNEES.map(d => { const f = definirFiche(d); return [f.id, f]; })));

function imageDecor(p, motif) {
  const cle = 'decor:' + p.id + ':' + p.variante + ':' + p.cols.join(':');
  if (CACHE_MATIERES.has(cle)) return CACHE_MATIERES.get(cle);
  const toile = toileNeuve(512), c = toile.getContext('2d'), hasard = hasardDepuis(p.id + ':' + p.variante);
  c.fillStyle = p.cols[0]; c.fillRect(0, 0, 512, 512);
  if (motif === 'jute') {
    for (let i = 0; i < 512; i += 3) { c.fillStyle = i % 2 ? '#E3CDA4' : '#8F744E'; c.globalAlpha = 0.2; c.fillRect(i, 0, 1, 512); c.fillRect(0, i, 512, 1); }
  } else if (motif === 'berbere') {
    c.strokeStyle = p.cols[2]; c.lineWidth = 7;
    for (let x = -256; x < 768; x += 128) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 128, 256); c.lineTo(x, 512); c.stroke(); c.beginPath(); c.moveTo(x + 128, 0); c.lineTo(x, 256); c.lineTo(x + 128, 512); c.stroke(); }
  } else if (motif === 'tapis') {
    c.strokeStyle = p.cols[1]; c.lineWidth = p.variante === 'artdeco' ? 12 : 5;
    for (let i = 0; i < 4; i++) { const retrait = 20 + i * 12; c.strokeRect(retrait, retrait, 512 - retrait * 2, 512 - retrait * 2); }
    if (p.variante === 'boheme' || p.variante === 'artdeco') for (let y = 80; y < 460; y += 80) for (let x = 80; x < 460; x += 80) { c.beginPath(); c.moveTo(x, y - 16); c.lineTo(x + 14, y); c.lineTo(x, y + 16); c.lineTo(x - 14, y); c.closePath(); c.stroke(); }
  } else {
    for (let i = 0; i < 9; i++) {
      c.fillStyle = [p.cols[1], '#E6DFD2', '#5D7466', p.cols[2]][i % 4]; c.globalAlpha = 0.5 + hasard() * 0.4;
      const x = hasard() * 512, y = hasard() * 512;
      c.beginPath(); c.ellipse(x, y, 20 + hasard() * 130, 25 + hasard() * 160, hasard() * Math.PI, 0, TOUR); c.fill();
    }
    c.globalAlpha = 0.75; c.strokeStyle = '#343C39'; c.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(60 + i * 115, 460); c.bezierCurveTo(150, 300, 280, 200, 400 - i * 60, 60); c.stroke(); }
  }
  if(motif!=='tableau') {
    c.globalAlpha=.3;c.strokeStyle=p.cols[2];c.lineWidth=3;
    if(p.variante==='classique'){c.beginPath();c.ellipse(256,256,110,160,0,0,TOUR);c.stroke();c.strokeRect(18,18,476,476);}
    else if(p.variante==='japandi')for(let y=30;y<512;y+=45){c.beginPath();c.moveTo(20,y);c.bezierCurveTo(180,y-12,330,y+12,492,y);c.stroke();}
    else if(p.variante==='industriel')for(let x=35;x<512;x+=90){c.strokeRect(x,30,28,452);}
    else if(p.variante==='artdeco')for(let y=60;y<512;y+=100)for(let x=60;x<512;x+=100){c.beginPath();c.arc(x,y,36,Math.PI,TOUR);c.stroke();}
  }
  c.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(toile); texture.colorSpace = THREE.SRGBColorSpace; texture.userData.partage = true;
  const mat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', map: texture, roughness: motif === 'tableau' ? 0.94 : 1 }); mat.userData.partage = true;
  CACHE_MATIERES.set(cle, mat); return mat;
}

function dessiner(a) {
  const { p, w, d, h, m, s, box, cyl, mesh, ellipsoide, barre, tube, profil, revolution, instances, pieds, hasard } = a;
  const type = p.type;
  function uvImage(o, largeur, hauteur, sol = false) {
    const pos = o.geometry.getAttribute('position'), uv = o.geometry.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / largeur + 0.5, sol ? pos.getZ(i) / hauteur + 0.5 : pos.getY(i) / hauteur);
  }
  function contour(forme, largeur, hauteur) {
    if (forme === 'rectangle') return [[-largeur / 2, 0], [largeur / 2, 0], [largeur / 2, hauteur], [-largeur / 2, hauteur]];
    if (forme === 'arche') {
      const rayon = Math.min(largeur / 2, hauteur * 0.35), pts = [[-largeur / 2, 0], [largeur / 2, 0], [largeur / 2, hauteur - rayon]];
      for (let i = 0; i <= 24; i++) pts.push([Math.cos(i / 24 * Math.PI) * largeur / 2, hauteur - rayon + Math.sin(i / 24 * Math.PI) * rayon]);
      return pts;
    }
    const pts = [];
    for (let i = 0; i < 48; i++) { const angle = i / 48 * TOUR, rayon = forme === 'irregulier' ? 1 + 0.09 * Math.sin(angle * 3) + 0.035 * Math.cos(angle * 5) : 1; pts.push([Math.cos(angle) * rayon, Math.sin(angle) * rayon]); }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return pts.map(([x, y]) => [(x - minX) / (maxX - minX) * largeur - largeur / 2, (y - minY) / (maxY - minY) * hauteur]);
  }
  function cadre(largeur, hauteur, profondeur, x, y, z, reflet = false, forme = 'rectangle') {
    const epStyle = { contemporain: 0.022, classique: 0.048, japandi: 0.032, industriel: 0.014, boheme: 0.04, artdeco: 0.057 }[p.variante];
    const points = contour(forme, largeur, hauteur), ep = Math.min(epStyle, largeur * 0.1, hauteur * 0.1);
    const exterieure = new THREE.Shape(points.map(p => new THREE.Vector2(...p)));
    const interieurs = points.map(([u, v]) => [u * (largeur - ep * 2) / largeur, ep + v * (hauteur - ep * 2) / hauteur]);
    exterieure.holes.push(new THREE.Path(interieurs.slice().reverse().map(p => new THREE.Vector2(...p))));
    const geo = new THREE.ExtrudeGeometry(exterieure, { depth: profondeur, bevelEnabled: false, curveSegments: 16 }); geo.translate(0, 0, -profondeur / 2);
    mesh(geo, p.variante === 'boheme' || p.variante === 'japandi' ? m.bois : m.metal, x, y, z);
    const image = profil(interieurs, 0.004, x, y, z + profondeur / 2 - 0.003, reflet ? matiere('miroir') : imageDecor(p, 'tableau'));
    if (!reflet) uvImage(image, largeur, hauteur);
    if (p.variante === 'classique' && forme === 'rectangle') for (const xx of [-largeur / 2 + ep / 2, largeur / 2 - ep / 2]) box(ep * 0.35, hauteur - 0.008, 0.006, x + xx, y + 0.004, z + profondeur / 2 - 0.003, m.metal, 0.002);
  }
  function pot(largeur, profondeur, hauteur, x = 0, y = 0, z = 0) {
    const rayon = largeur / 2;
    const ventre={contemporain:.7,classique:.82,japandi:.94,industriel:.6,boheme:.86,artdeco:.75}[p.variante];
    const o = revolution([[0, 0], [rayon * ventre, 0], [rayon*(p.variante==='classique'?1:.94),hauteur*.5], [rayon, hauteur], [rayon - 0.012, hauteur], [rayon * ventre*.92, 0.015], [0, 0.015]], x, y, z, p.variante === 'boheme' ? m.facade : matiere('ceramique', p.cols[0])); o.scale.z = profondeur / largeur;
    const terre = cyl(rayon * 0.88, rayon * 0.88, 0.006, x, y + hauteur - 0.018, z, matiere('uni', '#584B39'), 24); terre.scale.z = profondeur / largeur;
  }
  function petiteAssise(largeur, profondeur, hauteur, x, z) {
    const sol = hauteur * 0.4;
    for (const dx of [-largeur / 2 + 0.025, largeur / 2 - 0.025]) for (const dz of [-profondeur / 2 + 0.025, profondeur / 2 - 0.025]) box(0.025, sol, 0.025, x + dx, 0, z + dz, p.variante === 'industriel' ? m.metal : m.bois);
    box(largeur, 0.055, profondeur, x, sol, z, m.bois, 0.008);
    box(largeur - 0.035, 0.055, profondeur - 0.025, x, sol + 0.058, z + 0.005, m.tissu, 0.018);
    box(largeur, hauteur - sol - 0.113, 0.035, x, sol + 0.113, z - profondeur / 2 + 0.0175, p.variante === 'boheme' ? m.facade : m.bois, 0.012);
  }
  if (type === 'miroir') {
    const surPied = p.pose === 'sol', epaisseur = surPied ? 0.035 : d;
    cadre(w, h, epaisseur, 0, 0, surPied ? d / 2 - epaisseur / 2 : 0, true, p.forme || 'rectangle');
    if (surPied) for (const x of [-w * 0.3, w * 0.3]) { box(0.035, 0.025, d, x, 0, 0, m.bois); barre([x, 0.03, -d / 2 + 0.016], [x, h * 0.75, d / 2 - 0.03], 0.014, m.bois); }
  } else if (type === 'tableau') {
    const n = p.nombre || 1;
    if (n === 1) cadre(w, h, d, 0, 0, 0);
    else if (n === 3) for (let i = 0; i < 3; i++) cadre((w - 0.05) / 3, h, d, -w / 2 + (i + 0.5) * (w - 0.05) / 3 + i * 0.025, 0, 0);
    else for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) cadre((w - 0.05) / 3, (h - 0.025) / 2, d, -w / 2 + (i + 0.5) * (w - 0.05) / 3 + i * 0.025, j * (h + 0.025) / 2, 0);
  } else if (type === 'tapis') {
    const franges=p.variante==='classique'||p.variante==='boheme', profondeur=d-(franges?.05:0), points = contour(p.forme || 'rectangle', w, profondeur).map(([x, y]) => [x, y - profondeur / 2]);
    const forme = new THREE.Shape(points.map(p => new THREE.Vector2(...p))), biseau=p.variante==='japandi', geo = new THREE.ExtrudeGeometry(forme, { depth: biseau?Math.max(.001,h-.004):h, bevelEnabled: biseau, bevelThickness:Math.min(.002,h*.2),bevelSize:.012,bevelSegments:1 }); geo.rotateX(-Math.PI / 2);
    if(biseau){geo.computeBoundingBox();const b=geo.boundingBox,t=b.getSize(new THREE.Vector3()),centre=b.getCenter(new THREE.Vector3());geo.translate(-centre.x,-b.min.y,-centre.z);geo.scale(w/t.x,h/t.y,d/t.z);}
    const o = mesh(geo, imageDecor(p, p.id.includes('jute') ? 'jute' : p.id.includes('berbere') ? 'berbere' : 'tapis')); o.castShadow = false;
    uvImage(o, w, d, true);
    if(franges){const poses=[],n=p.variante==='classique'?64:48;for(let i=0;i<n;i++){const angle=i/n*TOUR;poses.push({position:[Math.cos(angle)*(w/2-.013),h*.25,Math.sin(angle)*(d/2-.013)],rotation:[0,Math.PI/2-angle,0]});}const f=instances(new THREE.BoxGeometry(.006,h*.5,.025),m.tissu,poses);f.castShadow=false;}
  } else if (type === 'plante') {
    const suspendue = p.pose === 'plafond', potH = Math.min(0.38, h * 0.28), potW = Math.min(w, d) * 0.45, potY = suspendue ? h * 0.43 : 0;
    pot(potW, potW, potH, 0, potY, 0);
    if (p.id.includes('cactus')) {
      const rayon = Math.min(w, d) * 0.11;
      cyl(rayon * 0.82, rayon, h - potH, 0, potH, 0, matiere('uni', '#6A8257'), 16);
      for (const [x, z] of [[-w / 2 + rayon, 0], [w / 2 - rayon, 0], [0, -d / 2 + rayon], [0, d / 2 - rayon]]) {
        barre([0, h * 0.45, 0], [x, h * 0.45, z], rayon, matiere('uni', '#6A8257'));
        cyl(rayon, rayon, h * 0.32, x, h * 0.45, z, matiere('uni', '#6A8257'), 12);
      }
    } else {
      const basCanop = suspendue ? 0 : potH, hautCanop = suspendue ? h * 0.63 : h - potH;
      const plante = new THREE.Shape();
      if(p.id.includes('monstera')){
        const contour=[[0,.5],[.14,.4],[.31,.28],[.14,.2],[.36,.1],[.15,.03],[.34,-.12],[.13,-.07],[.24,-.28],[0,-.5],[-.24,-.28],[-.13,-.07],[-.34,-.12],[-.15,.03],[-.36,.1],[-.14,.2],[-.31,.28],[-.14,.4]];
        contour.forEach(([x,y],i)=>i?plante.lineTo(x,y):plante.moveTo(x,y));plante.closePath();
        for(const x of [-.055,.055]){const trou=new THREE.Path();trou.absellipse(x,.2,.018,.045,0,TOUR,true,x*2);plante.holes.push(trou);}
      }else if(p.id.includes('palmier')){plante.moveTo(0,-.5);for(let i=0;i<8;i++){const y=-.4+i*.11;plante.lineTo(.02,y);plante.lineTo(.3*(1-i/9),y+.05);plante.lineTo(.02,y+.075);}plante.lineTo(0,.5);for(let i=7;i>=0;i--){const y=-.4+i*.11;plante.lineTo(-.02,y+.075);plante.lineTo(-.3*(1-i/9),y+.05);plante.lineTo(-.02,y);}plante.closePath();}
      else {plante.moveTo(0, -0.5); plante.bezierCurveTo(p.id.includes('olivier')?.16:.4, -0.2, p.id.includes('olivier')?.14:.35, 0.25, 0, 0.5); plante.bezierCurveTo(p.id.includes('olivier')?-.14:-.35, 0.25, p.id.includes('olivier')?-.16:-.4, -0.2, 0, -0.5);}
      const geo = new THREE.ShapeGeometry(plante, 5), poses = [], n = p.id.includes('olivier') ? 130 : p.id.includes('palmier') ? 65 : 55;
      for (let i = 0; i < n; i++) {
        const angle = hasard() * TOUR, rayon = Math.sqrt(hasard()), longueur = p.id.includes('olivier') ? 0.12 : p.id.includes('palmier') ? 0.4 : 0.28;
        poses.push({ position: [Math.cos(angle) * rayon * w * 0.42, basCanop + hautCanop * (0.15 + hasard() * 0.7), Math.sin(angle) * rayon * d * 0.42], rotation: [(hasard() - 0.5) * 1.4, angle, (hasard() - 0.5) * 1.4], echelle: [longueur * (p.id.includes('palmier') ? 0.28 : p.id.includes('monstera') ? 1.1 : 0.7), longueur, 1] });
      }
      const feuilles = instances(geo, matiere('feuille', '#FFFFFF'), poses, p.id.includes('olivier') ? ['#7E8B67', '#A2AA87', '#667551'] : ['#496E47', '#678C55', '#385B3C', '#839E69']);
      feuilles.computeBoundingBox(); const b = feuilles.boundingBox, taille = b.getSize(new THREE.Vector3()), centre = b.getCenter(new THREE.Vector3());
      feuilles.scale.set(w / taille.x, hautCanop / taille.y, d / taille.z); feuilles.position.set(-centre.x * feuilles.scale.x, basCanop - b.min.y * feuilles.scale.y, -centre.z * feuilles.scale.z);
      cyl(0.012, 0.026, suspendue ? potH * 0.7 : h * 0.7 - potH, 0, potY + potH - 0.02, 0, m.bois, 12);
    }
    if (suspendue) for (let i = 0; i < 3; i++) { const angle = i / 3 * TOUR; barre([Math.cos(angle) * potW * 0.4, potY + potH, Math.sin(angle) * potW * 0.4], [0, h - 0.003, 0], 0.003, m.bois); }
  } else if (type === 'vase') {
    const rayon = w / 2;
    const points = p.variante === 'classique' ? [[0, 0], [rayon * 0.6, 0], [rayon * 0.65, h * 0.15], [rayon, h * 0.45], [rayon * 0.5, h * 0.8], [rayon * 0.55, h], [rayon * 0.45, h], [rayon * 0.42, h * 0.8], [rayon * 0.88, h * 0.45], [0, 0.025]] : [[0, 0], [rayon * 0.8, 0], [rayon, h * 0.3], [rayon * (p.variante === 'japandi' ? 0.85 : 0.6), h * 0.8], [rayon * 0.55, h], [rayon * 0.45, h], [rayon * 0.5, h * 0.8], [0, 0.025]];
    if(p.variante==='artdeco')points.splice(3,0,[rayon*.85,h*.7]);
    if(p.variante==='industriel')points[2]=[rayon,h*.18];
    if(p.variante==='boheme')points[3]=[rayon*.9,h*.7];
    const o = revolution(points, 0, 0, 0, p.variante === 'industriel' ? m.metal : matiere('ceramique', p.cols[0])); o.scale.z = d / w;
  } else if (type === 'sculpture') {
    const socle = Math.min(0.06, h * 0.15); box(w * 0.6, socle, d * 0.65, 0, 0, 0, matiere('travertin', '#D3C3A8'), 0.004);
    const geo = p.variante === 'classique' ? new THREE.TorusGeometry(1, 0.2, 8, 32) : p.variante === 'japandi' ? new THREE.TorusGeometry(1, 0.35, 8, 32, Math.PI * 1.65) : p.variante==='industriel'?new THREE.IcosahedronGeometry(1,0):p.variante==='boheme'?new THREE.TorusKnotGeometry(1,.14,48,6,2,5):p.variante==='artdeco'?new THREE.TorusGeometry(1,.28,6,24,Math.PI*1.4):new THREE.TorusKnotGeometry(1, 0.2, 48, 6);
    geo.computeBoundingBox(); const b = geo.boundingBox, taille = b.getSize(new THREE.Vector3()), centre = b.getCenter(new THREE.Vector3()); geo.translate(-centre.x, -b.min.y, -centre.z); geo.scale(w / taille.x, (h - socle) / taille.y, d / taille.z); mesh(geo, p.variante === 'boheme' ? m.bois : m.metal, 0, socle, 0);
  } else if (type === 'livres') {
    const n = {contemporain:4,classique:5,japandi:3,industriel:6,boheme:2,artdeco:7}[p.variante], poses = Array.from({ length: n }, (_, i) => ({ position: [0, (i + 0.5) * h / n, 0], echelle: [w * (i === 0 ? 1 : 0.9), h / n - (i===n-1?0:0.003), d * (i === 0 ? 1 : 0.94)] }));
    instances(new THREE.BoxGeometry(1, 1, 1), m.principal, poses, [p.cols[0], p.cols[1], '#DDD3BE', '#7D8A77']);
  } else if (type === 'bougie') {
    const cire=matiere('uni',p.cols[0]);
    if(p.variante==='classique') {const support=revolution([[0,0],[w*.5,0],[w*.5,h*.15],[w*.18,h*.3],[w*.32,h*.4],[0,h*.4]],0,0,0,m.metal);support.scale.z=d/w;const pilier=cyl(w*.3,w*.3,h*.6-.012,0,h*.4,0,cire,24);pilier.scale.z=d/w;}
    else if(p.variante==='japandi'){const bol=cyl(w*.5,w*.46,h*.3,0,0,0,m.clair,24);bol.scale.z=d/w;const pilier=cyl(w*.33,w*.33,h*.7-.012,0,h*.3,0,cire,24);pilier.scale.z=d/w;}
    else {const o = cyl(w / 2, w / 2, h - 0.012, 0, 0, 0, cire, p.variante==='industriel'?8:p.variante==='artdeco'?16:p.variante==='boheme'?12:24); o.scale.z = d / w;}
    cyl(0.0018, 0.0018, 0.012, 0, h - 0.012, 0, m.noir, 6);
  } else if (type === 'plateau') {
    if(p.variante==='japandi'){const o=revolution([[0,0],[w*.4,0],[w*.5,h*.55],[w*.5,h],[w*.46,h],[w*.38,h*.2],[0,h*.2]],0,0,0,m.bois);o.scale.z=d/w;}
    else if (p.variante === 'classique' || p.variante === 'boheme') {
      const o = revolution([[0, 0], [w * 0.48, 0], [w * 0.5, h], [w * 0.46, h], [w * 0.44, h * 0.2], [0, h * 0.2]], 0, 0, 0, m.bois); o.scale.z = d / w;
      if(p.variante==='boheme')for(const x of [-w*.3,w*.3])box(w*.16,.008,d*.55,x,h-.008,0,m.bois,.004);
    } else {
      box(w, h * 0.25, d, 0, 0, 0, m.bois, 0.006);
      for (const x of [-w / 2 + 0.006, w / 2 - 0.006]) box(0.012, h, d, x, 0, 0, m.bois);
      for (const z of [-d / 2 + 0.006, d / 2 - 0.006]) box(w - 0.024, h, 0.012, 0, 0, z, m.bois);
      if(p.variante==='artdeco')for(const x of [-w*.35,w*.35])for(const z of [-d*.3,d*.3])ellipsoide(.012,.012,.012,x,h-.012,z,m.metal);
    }
  } else if (type === 'salon') {
    petiteAssise(w * 0.3, d * 0.4, h, -w * 0.35, -d * 0.3);
    petiteAssise(w * 0.3, d * 0.4, h, w * 0.35, -d * 0.3);
    const tableW = w * 0.42, tableD = d * 0.35, y = Math.min(0.4, h * 0.5);
    box(tableW, 0.028, tableD, 0, y, d * 0.325, m.bois, 0.006);
    for (const x of [-tableW * 0.4, tableW * 0.4]) for (const z of [-tableD * 0.38, tableD * 0.38]) box(0.025, y, 0.025, x, 0, d * 0.325 + z, m.metal);
  } else if (type === 'chaise-jardin') petiteAssise(w, d, h, 0, 0);
  else if (type === 'table-jardin') {
    box(w, 0.035, d, 0, h - 0.035, 0, m.bois, 0.008); pieds(w * 0.88, d * 0.8, h - 0.035, 0, p.variante === 'industriel' ? 'cadre' : s.pied);
    if (p.variante === 'japandi' || p.variante === 'boheme') for (let i = 1; i < Math.floor(d / 0.07); i++) box(w - 0.01, 0.004, 0.003, 0, h - 0.004, -d / 2 + i * 0.07, m.noir, 0);
  } else if (type === 'transat') {
    const sections = [[d / 2 - 0.014, h * 0.22], [d * 0.05, h * 0.25], [-d / 2 + 0.014, h - 0.014]], positions = [], uv = [], indices = [];
    for (let j = 0; j < sections.length; j++) for (const x of [-w / 2 + 0.025, w / 2 - 0.025]) { positions.push(x, sections[j][1], sections[j][0]); uv.push(x, sections[j][0]); }
    for (let j = 0; j < sections.length - 1; j++) { const i = j * 2; indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals(); mesh(geo, m.tissu);
    for (const x of [-w / 2 + 0.014, w / 2 - 0.014]) {
      for (let i = 0; i < 2; i++) barre([x, sections[i][1], sections[i][0]], [x, sections[i + 1][1], sections[i + 1][0]], 0.014, m.bois);
      for (const [z, y] of [sections[0], sections[2]]) ellipsoide(0.028, 0.028, 0.028, x, y - 0.014, z, m.bois);
      for (const z of [-d * 0.28, d * 0.3]) box(0.025, h * 0.23, 0.025, x, 0, z, m.bois);
    }
    if(p.variante==='boheme')for(const z of [-d*.2,d*.3])box(w-.06,.018,.035,0,h*.2,z,m.facade,.008);
  } else if (type === 'suspendu') {
    const base = cyl(w / 2, w / 2, 0.035, 0, 0, 0, m.metal, 24); base.scale.z = d / w;
    const support = tube([[0, 0.035, -d / 2 + 0.022], [0, h * 0.7, -d / 2 + 0.022], [0, h - 0.022, 0], [0, h - 0.1, d * 0.1]], 0.02, m.metal);
    support.geometry.computeBoundingBox(); const borne = support.geometry.boundingBox, epaisseur = borne.max.z - borne.min.z; support.geometry.translate(0, 0, -borne.min.z); support.geometry.scale(1, h / borne.max.y, d * 0.65 / epaisseur); support.geometry.translate(0, 0, -d * 0.47);
    const ouverture={contemporain:1,classique:.88,japandi:.76,industriel:.94,boheme:.82,artdeco:.7}[p.variante];
    const forme = new THREE.SphereGeometry(1, 24, 12, 0, TOUR*ouverture, Math.PI / 2, Math.PI / 2); forme.scale(w * 0.38, h * 0.28, d * 0.38); mesh(forme, m.facade, 0, h * 0.57, 0);
    ellipsoide(w * 0.63, 0.1, d * 0.6, 0, h * 0.31, d * 0.04, m.tissu);
    barre([0, h * 0.62, 0], [0, h - 0.1, d * 0.1], 0.005, m.metal);
  } else if (type === 'hamac') {
    for (const x of [-w / 2 + 0.035, w / 2 - 0.035]) { box(0.07, 0.035, d, x, 0, 0, m.bois); barre([x, 0.03, 0], [x * 0.87, h - 0.015, 0], 0.015, m.bois); ellipsoide(0.03, 0.03, 0.03, x * 0.87, h - 0.03, 0, m.bois); }
    const nx = 24, positions = [], uv = [], indices = [];
    for (let i = 0; i <= nx; i++) for (const z of [-d * 0.35, d * 0.35]) { const t = i / nx; positions.push((t - 0.5) * w * 0.86, h * (0.35 + Math.pow(t * 2 - 1, 2) * 0.58), z); uv.push(t * w, z); }
    for (let i = 0; i < nx; i++) { const j = i * 2; indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals(); mesh(geo, m.tissu);
  } else if (type === 'jardiniere') {
    const bac = h * 0.6, ep = 0.025;
    box(w, ep, d, 0, 0, 0, m.bois, 0.006);
    for (const x of [-w / 2 + ep / 2, w / 2 - ep / 2]) box(ep, bac, d, x, 0, 0, m.bois);
    for (const z of [-d / 2 + ep / 2, d / 2 - ep / 2]) {
      if(p.variante==='boheme'){const n=Math.max(3,Math.floor(w/.1));for(let i=0;i<n;i++)box((w-ep*2)/n-.005,bac,ep,-w/2+ep+(i+.5)*(w-ep*2)/n,0,z,m.facade,.008);}
      else box(w - ep * 2, bac, ep, 0, 0, z, m.bois);
    }
    box(w - ep * 2, 0.008, d - ep * 2, 0, bac - 0.015, 0, matiere('uni', '#584B39'));
    const n = Math.max(3, Math.floor(w / 0.15));
    for (let i = 0; i < n; i++) { const x = -w / 2 + 0.12 + i * (w - 0.24) / (n - 1); cyl(0.008, 0.008, h - bac, x, bac, 0, matiere('uni', '#647D4E'), 8); for (const cote of [-1, 1]) { const o = ellipsoide(0.09, (h - bac) * 0.55, Math.min(d * 0.65, 0.12), x + cote * 0.025, bac + (h - bac) * 0.2, 0, matiere('uni', '#7F965D')); o.rotation.z = cote * 0.25; } }
  } else if (type === 'parasol-deporte') {
    const x = -w * 0.38, y = h - 0.03;
    box(w * 0.24, 0.06, d * 0.4, x, 0, 0, m.metal, 0.01);
    cyl(0.025, 0.025, h - 0.06, x, 0.06, 0, m.metal, 16);
    barre([x, y, 0], [w * 0.1, y, 0], 0.018, m.metal);
    const n = {contemporain:24,classique:16,japandi:8,industriel:4,boheme:12,artdeco:32}[p.variante], positions = [w * 0.1, h - 0.065, 0], indices = [];
    for (let i = 0; i <= n; i++) { const angle = i / n * TOUR; positions.push(w * 0.1 + Math.cos(angle) * w * 0.4, h - Math.min(0.5, h * 0.2), Math.sin(angle) * d / 2); if (i < n) indices.push(0, i + 2, i + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals(); geo.setAttribute('uv', new THREE.Float32BufferAttribute(positions.flatMap((_, i) => i % 3 === 0 ? [positions[i], positions[i + 2]] : []), 2)); mesh(geo, m.tissu);
  }
}
