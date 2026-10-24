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
    "id": "cheminee-classique",
    "nom": "Cheminée classique",
    "type": "cheminee",
    "fam": "cheminee",
    "pose": "mur",
    "dim": [
      1.25,
      0.36,
      1.05
    ],
    "dimMin": [
      0.875,
      0.252,
      0.788
    ],
    "dimMax": [
      2.0,
      0.54,
      1.418
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "poele-bois",
    "nom": "Poêle à bois et conduit",
    "type": "poele",
    "fam": "cheminee",
    "pose": "sol",
    "dim": [
      0.55,
      0.5,
      2.5
    ],
    "dimMin": [
      0.4,
      0.4,
      1.5
    ],
    "dimMax": [
      0.8,
      0.75,
      3.3
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "rideaux",
    "nom": "Rideaux et voilage",
    "type": "rideaux",
    "fam": "rideau",
    "pose": "mur",
    "dim": [
      1.8,
      0.18,
      2.4
    ],
    "dimMin": [
      1.26,
      0.126,
      1.8
    ],
    "dimMax": [
      2.88,
      0.27,
      3.24
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "store-bateau",
    "nom": "Store bateau",
    "type": "store",
    "fam": "rideau",
    "pose": "mur",
    "dim": [
      1.2,
      0.08,
      1.5
    ],
    "dimMin": [
      0.84,
      0.056,
      1.125
    ],
    "dimMax": [
      1.92,
      0.12,
      2.025
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "verriere-atelier",
    "nom": "Verrière atelier",
    "type": "verriere",
    "fam": "architecture",
    "pose": "sol",
    "dim": [
      2.4,
      0.06,
      2.4
    ],
    "dimMin": [
      1.68,
      0.042,
      1.8
    ],
    "dimMax": [
      3.84,
      0.09,
      3.24
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "claustra-bois",
    "nom": "Claustra de bois",
    "type": "claustra",
    "fam": "architecture",
    "pose": "sol",
    "dim": [
      1.2,
      0.1,
      2.4
    ],
    "dimMin": [
      0.84,
      0.07,
      1.8
    ],
    "dimMax": [
      1.92,
      0.15,
      3.24
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "poutres-apparentes",
    "nom": "Poutres apparentes",
    "type": "poutres",
    "fam": "architecture",
    "pose": "plafond",
    "dim": [
      4,
      3.6,
      0.18
    ],
    "dimMin": [
      2,
      2,
      0.1
    ],
    "dimMax": [
      8,
      8,
      0.35
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "corniche",
    "nom": "Corniche",
    "type": "moulure",
    "fam": "architecture",
    "pose": "lineaire",
    "dim": [
      3,
      0.12,
      0.14
    ],
    "dimMin": [
      2.1,
      0.084,
      0.105
    ],
    "dimMax": [
      4.8,
      0.18,
      0.189
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "cimaise",
    "nom": "Cimaise",
    "type": "moulure",
    "fam": "architecture",
    "pose": "lineaire",
    "dim": [
      3,
      0.025,
      0.06
    ],
    "dimMin": [
      2.1,
      0.017,
      0.045
    ],
    "dimMax": [
      4.8,
      0.038,
      0.081
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "escalier-droit",
    "nom": "Escalier droit avec garde-corps",
    "type": "escalier",
    "fam": "architecture",
    "pose": "sol",
    "dim": [
      0.9,
      3.6,
      3.7
    ],
    "dimMin": [
      0.7,
      2.8,
      2.8
    ],
    "dimMax": [
      1.4,
      5.5,
      4.5
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ],
    "description": "Escalier à marches bois et garde-corps ; hauteur totale comprenant le garde-corps."
  },
  {
    "id": "poteau",
    "nom": "Poteau",
    "type": "poteau",
    "fam": "architecture",
    "pose": "sol",
    "dim": [
      0.22,
      0.22,
      2.5
    ],
    "dimMin": [
      0.154,
      0.154,
      1.875
    ],
    "dimMax": [
      0.352,
      0.33,
      3.375
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "bibliotheque-sur-mesure",
    "nom": "Bibliothèque sur mesure",
    "type": "bibliotheque",
    "fam": "etagere",
    "pose": "sol",
    "dim": [
      2.4,
      0.32,
      2.5
    ],
    "dimMin": [
      1.68,
      0.224,
      1.875
    ],
    "dimMax": [
      3.84,
      0.48,
      3.375
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "banquette-lecture",
    "nom": "Niche de lecture",
    "type": "banquette",
    "fam": "banc",
    "pose": "sol",
    "dim": [
      1.8,
      0.62,
      2.2
    ],
    "dimMin": [
      1.26,
      0.434,
      1.65
    ],
    "dimMax": [
      2.88,
      0.93,
      2.97
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "mur-vegetal",
    "nom": "Mur végétal",
    "type": "vegetal",
    "fam": "panneau",
    "pose": "mur",
    "dim": [
      1.8,
      0.12,
      2
    ],
    "dimMin": [
      1.26,
      0.084,
      1.5
    ],
    "dimMax": [
      2.88,
      0.18,
      2.7
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "penderie-dressing",
    "nom": "Penderie dressing",
    "type": "dressing",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      1.5,
      0.6,
      2.2
    ],
    "dimMin": [
      1.05,
      0.42,
      1.65
    ],
    "dimMax": [
      2.4,
      0.9,
      2.97
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "meuble-chaussures",
    "nom": "Meuble à chaussures",
    "type": "chaussures",
    "fam": "meuble",
    "pose": "sol",
    "dim": [
      0.8,
      0.3,
      1.1
    ],
    "dimMin": [
      0.56,
      0.21,
      0.825
    ],
    "dimMax": [
      1.28,
      0.45,
      1.485
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "climatiseur-mural",
    "nom": "Climatiseur mural",
    "type": "clim",
    "fam": "autre",
    "pose": "mur",
    "dim": [
      0.85,
      0.22,
      0.3
    ],
    "dimMin": [
      0.595,
      0.154,
      0.225
    ],
    "dimMax": [
      1.36,
      0.33,
      0.405
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "parasol",
    "nom": "Parasol à mât central",
    "type": "parasol",
    "fam": "exterieur",
    "pose": "sol",
    "dim": [
      2.5,
      2.5,
      2.4
    ],
    "dimMin": [
      1.75,
      1.75,
      1.8
    ],
    "dimMax": [
      4.0,
      3.75,
      3.24
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  }
];

export const ELEMENTS = figer(Object.fromEntries(DONNEES.map(d => { const f = definirFiche(d); return [f.id, f]; })));

function dessiner(a) {
  const { p, w, d, h, m, box, cyl, mesh, barre, tube, profil, instances, facade, poignee, hasard } = a;
  const type = p.type;
  if (type === 'cheminee') {
    const pierre = matiere(p.variante === 'japandi' ? 'travertin' : 'marbre', p.cols[0]);
    box(w, 0.055, d, 0, 0, 0, pierre, 0.006);
    const jambage = Math.min(p.variante === 'japandi' ? 0.12 : p.variante === 'industriel' ? 0.24 : 0.19, w * 0.22), tablette = Math.min(0.09, h * 0.12);
    for (const x of [-w / 2 + jambage / 2 + 0.025, w / 2 - jambage / 2 - 0.025]) box(jambage, h - tablette - 0.055, d * 0.8, x, 0.055, -d * 0.08, pierre, p.variante === 'classique' ? 0.014 : 0.004);
    box(w, tablette, d, 0, h - tablette, 0, pierre, 0.008);
    box(w - jambage * 2 - 0.06, h - tablette - 0.08, 0.012, 0, 0.06, -d / 2 + 0.006, m.noir, 0.002);
    if (p.variante === 'classique') for (const x of [-w * 0.35, w * 0.35]) box(0.018, h * 0.64, 0.012, x, h * 0.12, d * 0.32, pierre, 0.004);
  } else if (type === 'poele') {
    const corpsH = Math.min(0.82, h * 0.42), rayon = w / 2;
    const fonte=matiere('uni',p.cols[0]);
    if (p.variante === 'japandi' || p.variante === 'classique') { const o = cyl(rayon, rayon, corpsH, 0, 0, 0, fonte, 24); o.scale.z = d / w; }
    else box(w, corpsH, d, 0, 0, 0, fonte, p.variante === 'industriel' ? 0.006 : 0.025);
    box(w * 0.66, corpsH * 0.52, 0.006, 0, corpsH * 0.25, d / 2 - 0.003, m.verre, 0.008);
    cyl(0.07, 0.07, h - corpsH, 0, corpsH, -d * 0.17, m.noir, 20);
    box(w * 0.55, 0.04, 0.02, 0, corpsH * 0.14, d / 2 - 0.013, m.metal);
  } else if (type === 'rideaux') {
    const hauteurTissu = h - 0.065;
    function panneau(largeur, centre, z, amplitude, mat, plis) {
      const nx = Math.min(96, Math.max(24, plis * 8)), pos = [], uv = [], indices = [];
      for (let y = 0; y < 2; y++) for (let i = 0; i <= nx; i++) {
        const x = i / nx * largeur - largeur / 2;
        pos.push(x, y * hauteurTissu, Math.sin(i / nx * plis * TOUR) * amplitude);
        uv.push(x, y * hauteurTissu);
      }
      for (let i = 0; i < nx; i++) { const j = nx + 1 + i; indices.push(i, i + 1, j, i + 1, j + 1, j); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals();
      const o = mesh(geo, mat, centre, 0, z); return o;
    }
    panneau(w - 0.01, 0, -d / 2 + 0.016, Math.min(0.012, d * 0.12), matiere('voile'), Math.max(6, Math.round(w * 12)));
    for (const cote of [-1, 1]) panneau(w * (p.variante === 'classique' ? 0.45 : 0.39), cote * w * (p.variante === 'classique' ? 0.275 : 0.28), d * 0.12, d * 0.35, m.tissu, Math.max(4, Math.round(w * (p.variante === 'japandi' ? 4 : p.variante === 'industriel' ? 7 : 5))));
    barre([-w / 2, h - 0.013, d / 2 - 0.013], [w / 2, h - 0.013, d / 2 - 0.013], 0.013, m.metal);
    if (p.variante === 'classique') box(w - 0.015, Math.min(0.11, h * 0.1), d * 0.7, 0, h - 0.12, 0, m.tissu, 0.025);
  } else if (type === 'store') {
    box(w, 0.055, d, 0, h - 0.055, 0, m.bois, 0.006);
    const n = Math.max(3, Math.round(h / 0.22)), hauteur = (h - 0.055) / n;
    for (let i = 0; i < n; i++) {
      const o = box(w - 0.008, hauteur - 0.004, d * (p.variante === 'japandi' ? 0.4 : 0.25), 0, i * hauteur, d * 0.2, p.variante === 'boheme' ? m.facade : m.tissu, p.variante === 'classique' ? 0.025 : 0.006);
      if (p.variante === 'industriel') o.position.z -= d * 0.08;
    }
  } else if (type === 'verriere') {
    const ep = p.variante === 'classique' ? 0.04 : p.variante === 'industriel' ? 0.032 : 0.026;
    for (const y of [0, h - ep]) box(w, ep, d, 0, y, 0, m.metal, 0.002);
    const n = Math.max(1, Math.round(w / 0.5));
    for (let i = 0; i <= n; i++) box(ep, h, d, -w / 2 + ep / 2 + (w - ep) * i / n, 0, 0, m.metal, 0.002);
    for (let i = 0; i < n; i++) box(w / n - ep - 0.006, h - ep * 2 - 0.006, 0.008, -w / 2 + w / n * (i + 0.5), ep + 0.003, 0, m.verre, 0);
    box(w - ep * 2, ep, d, 0, h * (p.variante === 'japandi' ? 0.33 : 0.7), 0, m.metal, 0.002);
    if (p.variante === 'classique') box(w - ep * 2, ep, d, 0, h * 0.35, 0, m.metal, 0.002);
  } else if (type === 'claustra') {
    const ep = p.variante === 'classique' ? 0.035 : 0.026, n = Math.max(3, Math.round(w / (p.variante === 'japandi' ? 0.085 : 0.12)));
    box(w, ep, d, 0, 0, 0, m.bois); box(w, ep, d, 0, h - ep, 0, m.bois);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + ep / 2 + (w - ep) * i / (n - 1);
      if (p.variante === 'boheme') cyl(ep / 2, ep / 2, h - ep * 2, x, ep, 0, m.bois, 12);
      else box(ep, h - ep * 2, d * (p.variante === 'industriel' ? 0.65 : 1), x, ep, 0, m.bois);
    }
  } else if (type === 'poutres') {
    const ep = Math.min(p.variante === 'japandi' ? 0.1 : 0.14, d * 0.15), n = Math.max(2, Math.ceil(d / 0.6) + 1);
    const poses = Array.from({ length: n }, (_, i) => ({ position: [0, h / 2, -d / 2 + ep / 2 + (d - ep) * i / (n - 1)] }));
    instances(new THREE.BoxGeometry(w, h, ep), m.bois, poses);
    if (p.variante === 'classique') for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) box(0.12, h * 0.75, d, x, 0, 0, m.bois);
    if (p.variante === 'industriel') for (const x of [-w * 0.4, w * 0.4]) box(0.025, h * 0.9, d, x, 0, 0, m.metal, 0);
  } else if (type === 'moulure') {
    let points;
    if (p.variante === 'classique') points = [[0, 0], [d, 0], [d, h * 0.2], [d * 0.82, h * 0.3], [d * 0.7, h * 0.65], [d * 0.32, h * 0.82], [d * 0.25, h], [0, h]];
    else if (p.variante === 'japandi') points = [[0, 0], [d, 0], [d, h * 0.35], [d * 0.6, h], [0, h]];
    else if (p.variante === 'industriel') points = [[0, 0], [d, 0], [d, h * 0.2], [d * 0.2, h * 0.2], [d * 0.2, h], [0, h]];
    else points = [[0, 0], [d, 0], [d, h * 0.4], [d * 0.35, h * 0.4], [d * 0.35, h], [0, h]];
    const o = profil(points, w, 0, 0, 0, p.variante === 'industriel' ? m.metal : m.principal); o.rotation.y = Math.PI / 2;
  } else if (type === 'escalier') {
    const garde = 0.85, montee = h - garde, n = Math.max(8, Math.ceil(montee / 0.18)), giron = d / n, hausse = montee / n;
    for (let i = 0; i < n; i++) box(w, 0.035, giron, 0, hausse * (i + 1) - 0.035, d / 2 - giron * (i + 0.5), m.bois, 0.003);
    for (const x of [-w / 2 + 0.025, w / 2 - 0.025]) {
      box(0.04, hausse, 0.04, x, 0, d / 2 - 0.04, m.metal);
      barre([x, 0.035, d / 2 - 0.02], [x, montee - 0.07, -d / 2 + 0.02], 0.024, m.metal);
      for (let i = 0; i < n; i += 2) barre([x, hausse * (i + 1), d / 2 - giron * (i + 0.5)], [x, hausse * (i + 1) + garde - 0.02, d / 2 - giron * (i + 0.5)], 0.008, m.metal);
      barre([x, hausse + garde - 0.015, d / 2 - giron * 0.5], [x, h - 0.015, -d / 2 + giron * 0.5], 0.014, m.metal);
    }
  } else if (type === 'poteau') {
    box(w, h, d, 0, 0, 0, p.variante === 'industriel' ? materiauRevetement('beton-brut',{couleur:p.cols[0]}) : m.bois, p.variante === 'contemporain' ? 0.012 : p.variante === 'japandi' ? 0.007 : 0.002);
    if (p.variante === 'classique') for (const y of [0, h - 0.06]) box(w, 0.06, d, 0, y, 0, m.principal, 0.004);
  } else if (type === 'bibliotheque') {
    for (const x of [-w / 2 + 0.009, w / 2 - 0.009]) box(0.018, h, d, x, 0, 0, m.bois);
    box(w, h, 0.012, 0, 0, -d / 2 + 0.006, m.bois);
    const niveaux = Math.max(3, Math.min(9, Math.round(h / 0.35))), colonnes = Math.max(1, Math.ceil(w / 0.85));
    const livres = [];
    for (let j = 0; j <= niveaux; j++) box(w - 0.036, 0.018, d - 0.018, 0, j / niveaux * (h - 0.018), 0.009, m.bois);
    for (let i = 1; i < colonnes; i++) box(0.018, h, d - 0.018, -w / 2 + i * w / colonnes, 0, 0.009, m.bois);
    for (let j = 0; j < niveaux; j++) for (let i = 0; i < Math.min(60, Math.floor(w / 0.065)); i++) {
      if (hasard() < 0.2) continue;
      const largeur = 0.027 + hasard() * 0.025, hauteur = Math.min(0.28, h / niveaux - 0.04) * (0.65 + hasard() * 0.35);
      livres.push({ position: [-w / 2 + 0.055 + i * (w - 0.11) / Math.max(1, Math.floor(w / 0.065)), j / niveaux * (h - 0.018) + 0.022 + hauteur / 2, d / 2 - Math.min(d * 0.4, 0.12)], echelle: [largeur, hauteur, Math.min(0.2, d * 0.7)] });
    }
    instances(new THREE.BoxGeometry(1, 1, 1), m.principal, livres, ['#B6A58A', '#6E7F70', '#647380', '#A77E63', '#D7CBB8']);
    if (p.variante === 'classique') for (const y of [0.024, h - 0.04]) box(w - 0.036, 0.025, 0.012, 0, y, d / 2 - 0.006, m.bois);
  } else if (type === 'banquette') {
    for (const x of [-w / 2 + 0.025, w / 2 - 0.025]) box(0.05, h, d, x, 0, 0, m.bois, 0.01);
    box(w, 0.05, d, 0, h - 0.05, 0, m.bois, 0.01);
    box(w - 0.1, 0.34, d, 0, 0, 0, m.facade, 0.008);
    box(w - 0.12, 0.11, d - 0.03, 0, 0.35, 0.005, m.tissu, p.variante === 'japandi' ? 0.018 : p.variante === 'classique' ? 0.05 : 0.035);
    const n = Math.max(2, Math.round(w / 0.6));
    for (let i = 0; i < n; i++) box((w - 0.18) / n - 0.012, 0.25, 0.13, -w / 2 + 0.09 + (i + 0.5) * (w - 0.18) / n, 0.48, -d / 2 + 0.09, m.tissu, p.variante === 'boheme' ? 0.055 : 0.025);
  } else if (type === 'vegetal') {
    box(w, h, 0.012, 0, 0, -d / 2 + 0.006, materiauRevetement('vegetal',{couleur:p.cols[0]}), 0);
    const forme = new THREE.Shape(); forme.moveTo(0, -0.5); forme.quadraticCurveTo(0.45, 0, 0, 0.5); forme.quadraticCurveTo(-0.45, 0, 0, -0.5);
    const geo = new THREE.ShapeGeometry(forme, 4), poses = [];
    const n = Math.min(420, Math.max(30, Math.round(w * h * 65)));
    for (let i = 0; i < n; i++) {
      const longueur = Math.min(0.16, w * 0.2, h * 0.2) * (0.6 + hasard() * 0.4);
      poses.push({ position: [(hasard() - 0.5) * (w - longueur), longueur / 2 + hasard() * (h - longueur), i === 0 ? d / 2 : -d / 2 + 0.02 + hasard() * Math.max(0.001, d - 0.025)], rotation: [0, 0, hasard() * TOUR], echelle: [longueur * (p.variante === 'japandi' ? 0.5 : 0.9), longueur, 1] });
    }
    instances(geo, matiere('feuille', '#FFFFFF'), poses, [p.cols[0],p.cols[1],'#'+new THREE.Color(p.cols[0]).lerp(new THREE.Color(p.cols[1]),.5).getHexString()]);
  } else if (type === 'dressing') {
    for (const x of [-w / 2 + 0.014, w / 2 - 0.014]) box(0.028, h, d, x, 0, 0, m.bois);
    for (const y of [0, h - 0.022]) box(w, 0.022, d, 0, y, 0, m.bois);
    barre([-w / 2 + 0.03, h * 0.78, 0], [w / 2 - 0.03, h * 0.78, 0], 0.013, m.metal);
    const n = Math.min(18, Math.max(3, Math.floor(w / 0.13)));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.08 + i * (w - 0.16) / Math.max(1, n - 1), haut = h * 0.76, vetH = Math.min(0.9, h * 0.48), largeur = Math.min(0.4, d * 0.75);
      const o = profil([[-largeur / 2, 0], [largeur / 2, 0], [largeur * 0.4, vetH * 0.7], [largeur * 0.2, vetH], [-largeur * 0.2, vetH], [-largeur * 0.4, vetH * 0.7]], 0.025, x, haut - vetH, 0, i % 2 ? m.tissu : m.principal); o.rotation.y = Math.PI / 2;
    }
  } else if (type === 'chaussures') {
    box(w, h, d, 0, 0, 0, m.bois, 0.01);
    const n = Math.max(2, Math.round(h / 0.35));
    for (let i = 0; i < n; i++) { facade(w - 0.016, h / n - 0.008, 0, i * h / n + 0.004, d / 2 - 0.035); poignee(0, (i + 0.7) * h / n, d / 2 - 0.008); }
  } else if (type === 'clim') {
    box(w, h, d - 0.012, 0, 0, -0.006, m.principal, p.variante === 'classique' ? 0.035 : 0.018);
    const n = p.variante === 'industriel' ? 5 : 8;
    for (let i = 0; i < n; i++) box(w * 0.88, 0.006, 0.008, 0, h * 0.08 + i * h * 0.25 / n, d / 2 - 0.004, p.variante === 'japandi' ? m.bois : m.noir, 0);
    box(0.02, 0.008, 0.004, w * 0.38, h * 0.55, d / 2 - 0.002, m.noir, 0);
  } else if (type === 'parasol') {
    cyl(Math.min(w, d) * 0.09, Math.min(w, d) * 0.12, 0.06, 0, 0, 0, m.metal, 20);
    cyl(0.023, 0.023, h - 0.03, 0, 0, 0, m.bois, 16);
    const n = {contemporain:24,classique:16,japandi:8,industriel:4}[p.variante], retombee = Math.min(0.5, h * 0.22), positions = [0, h, 0], indices = [];
    for (let i = 0; i <= n; i++) { const angle = i / n * TOUR; positions.push(Math.cos(angle) * w / 2, h - retombee, Math.sin(angle) * d / 2); if (i < n) indices.push(0, i + 1, i + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals(); geo.setAttribute('uv', new THREE.Float32BufferAttribute(positions.flatMap((_, i) => i % 3 === 0 ? [positions[i], positions[i + 2]] : []), 2)); mesh(geo, m.tissu);
    for (let i = 0; i < 8; i++) { const angle = i / 8 * TOUR; barre([0, h - 0.02, 0], [Math.cos(angle) * (w / 2 - 0.006), h - retombee, Math.sin(angle) * (d / 2 - 0.006)], 0.005, m.bois); }
  }
}
