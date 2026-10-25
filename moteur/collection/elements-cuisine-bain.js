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
    "id": "meuble-bas-cuisine",
    "nom": "Meuble bas de cuisine",
    "type": "bas",
    "fam": "cuisine",
    "pose": "sol",
    "dim": [
      0.6,
      0.6,
      0.9
    ],
    "dimMin": [
      0.3,
      0.45,
      0.75
    ],
    "dimMax": [
      3.6,
      0.75,
      1.05
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "meuble-haut-cuisine",
    "nom": "Meuble haut de cuisine",
    "type": "haut",
    "fam": "cuisine",
    "pose": "mur",
    "dim": [
      0.6,
      0.35,
      0.72
    ],
    "dimMin": [
      0.3,
      0.25,
      0.35
    ],
    "dimMax": [
      2.4,
      0.5,
      1.2
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "colonne-four",
    "nom": "Colonne four et micro-ondes",
    "type": "colonne",
    "fam": "cuisine",
    "pose": "sol",
    "dim": [
      0.6,
      0.6,
      2.1
    ],
    "dimMin": [
      0.42,
      0.42,
      1.575
    ],
    "dimMax": [
      0.96,
      0.9,
      2.835
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "refrigerateur",
    "nom": "Réfrigérateur",
    "type": "frigo",
    "fam": "electromenager",
    "pose": "sol",
    "dim": [
      0.6,
      0.65,
      1.85
    ],
    "dimMin": [
      0.55,
      0.6,
      1.4
    ],
    "dimMax": [
      0.9,
      0.75,
      2.0
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ],
    "degagement": 0.9
  },
  {
    "id": "refrigerateur-americain",
    "nom": "Réfrigérateur américain",
    "type": "americain",
    "fam": "electromenager",
    "pose": "sol",
    "dim": [
      0.92,
      0.75,
      1.8
    ],
    "dimMin": [
      0.8,
      0.65,
      1.6
    ],
    "dimMax": [
      1.2,
      0.9,
      2.1
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ],
    "degagement": 1.0
  },
  {
    "id": "plaque-cuisson",
    "nom": "Plaque de cuisson",
    "type": "plaque",
    "fam": "cuisine",
    "pose": "sol",
    "dim": [
      0.6,
      0.52,
      0.045
    ],
    "dimMin": [
      0.42,
      0.364,
      0.034
    ],
    "dimMax": [
      0.96,
      0.78,
      0.061
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ],
    "posable": true
  },
  {
    "id": "evier",
    "nom": "Évier et robinet",
    "type": "evier",
    "fam": "cuisine",
    "pose": "sol",
    "dim": [
      0.7,
      0.5,
      0.42
    ],
    "dimMin": [
      0.49,
      0.35,
      0.315
    ],
    "dimMax": [
      1.12,
      0.75,
      0.567
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ],
    "posable": true
  },
  {
    "id": "hotte-murale",
    "nom": "Hotte murale",
    "type": "hotte",
    "fam": "cuisine",
    "pose": "mur",
    "dim": [
      0.7,
      0.5,
      0.8
    ],
    "dimMin": [
      0.49,
      0.35,
      0.6
    ],
    "dimMax": [
      1.12,
      0.75,
      1.08
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "hotte-ilot",
    "nom": "Hotte îlot",
    "type": "hotte",
    "fam": "cuisine",
    "pose": "plafond",
    "dim": [
      0.9,
      0.6,
      0.95
    ],
    "dimMin": [
      0.63,
      0.42,
      0.712
    ],
    "dimMax": [
      1.44,
      0.9,
      1.282
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "lave-vaisselle",
    "nom": "Lave-vaisselle",
    "type": "lave-vaisselle",
    "fam": "electromenager",
    "pose": "sol",
    "dim": [
      0.6,
      0.6,
      0.85
    ],
    "dimMin": [
      0.42,
      0.42,
      0.637
    ],
    "dimMax": [
      0.96,
      0.9,
      1.147
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "credence",
    "nom": "Crédence",
    "type": "credence",
    "fam": "cuisine",
    "pose": "mur",
    "dim": [
      1.8,
      0.025,
      0.6
    ],
    "dimMin": [
      1.26,
      0.017,
      0.45
    ],
    "dimMax": [
      2.88,
      0.038,
      0.81
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ],
    "revetement": "zellige"
  },
  {
    "id": "lave-linge",
    "nom": "Lave-linge",
    "type": "linge",
    "fam": "electromenager",
    "pose": "sol",
    "dim": [
      0.6,
      0.6,
      0.85
    ],
    "dimMin": [
      0.42,
      0.42,
      0.637
    ],
    "dimMax": [
      0.96,
      0.9,
      1.147
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "seche-linge",
    "nom": "Sèche-linge",
    "type": "linge",
    "fam": "electromenager",
    "pose": "sol",
    "dim": [
      0.6,
      0.65,
      0.85
    ],
    "dimMin": [
      0.42,
      0.455,
      0.637
    ],
    "dimMax": [
      0.96,
      0.975,
      1.147
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "meuble-vasque",
    "nom": "Meuble vasque suspendu",
    "type": "meuble-vasque",
    "fam": "sanitaire",
    "pose": "mur",
    "dim": [
      0.9,
      0.5,
      0.85
    ],
    "dimMin": [
      0.63,
      0.35,
      0.637
    ],
    "dimMax": [
      1.44,
      0.75,
      1.147
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "vasque-a-poser",
    "nom": "Vasque à poser",
    "type": "vasque",
    "fam": "sanitaire",
    "pose": "sol",
    "dim": [
      0.44,
      0.36,
      0.15
    ],
    "dimMin": [
      0.308,
      0.252,
      0.112
    ],
    "dimMax": [
      0.704,
      0.54,
      0.203
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ],
    "posable": true
  },
  {
    "id": "wc-suspendu",
    "nom": "WC suspendu",
    "type": "wc",
    "fam": "sanitaire",
    "pose": "mur",
    "dim": [
      0.38,
      0.55,
      0.76
    ],
    "dimMin": [
      0.266,
      0.385,
      0.57
    ],
    "dimMax": [
      0.608,
      0.825,
      1.026
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ]
  },
  {
    "id": "douche-italienne",
    "nom": "Douche à l’italienne",
    "type": "douche",
    "fam": "sanitaire",
    "pose": "sol",
    "dim": [
      1.2,
      0.9,
      2.1
    ],
    "dimMin": [
      0.84,
      0.63,
      1.575
    ],
    "dimMax": [
      1.92,
      1.35,
      2.835
    ],
    "choix": [
      "contemporain",
      "classique",
      "japandi",
      "industriel"
    ],
    "arche": false
  },
  {
    "id": "seche-serviettes",
    "nom": "Sèche-serviettes",
    "type": "seche-serviettes",
    "fam": "radiateur",
    "pose": "mur",
    "dim": [
      0.5,
      0.12,
      1.2
    ],
    "dimMin": [
      0.35,
      0.084,
      0.9
    ],
    "dimMax": [
      0.8,
      0.18,
      1.62
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
  const { p, w, d, h, m, s, box, cyl, mesh, ellipsoide, barre, tube, profil, revolution, facade, poignee, robinet, anneau } = a;
  const type = p.type, bord = 0.018;
  function caisson(hauteur, bas = 0, haut = true) {
    box(w, bord, d, 0, bas, 0, m.bois);
    for (const x of [-w / 2 + bord / 2, w / 2 - bord / 2]) box(bord, hauteur, d, x, bas, 0, m.bois);
    box(w - bord * 2, hauteur - bord, bord, 0, bas + bord, -d / 2 + bord / 2, m.bois);
    if (haut) box(w, bord, d, 0, bas + hauteur - bord, 0, m.bois);
  }
  function portes(hauteur, bas, nombre, tiroirs = false) {
    const largeur = w / nombre;
    for (let i = 0; i < nombre; i++) {
      const x = -w / 2 + largeur * (i + 0.5), z = d / 2 - 0.04;
      facade(largeur - 0.006, hauteur - 0.006, x, bas + 0.003, z, bord);
      poignee(x + (tiroirs ? 0 : largeur * 0.28), bas + hauteur * (tiroirs ? 0.8 : 0.72), z + 0.031, !tiroirs, Math.min(0.1, hauteur * 0.3));
    }
  }
  function four(y, hauteur, micro = false) {
    box(w - 0.07, hauteur, 0.045, 0, y, d / 2 - 0.052, m.noir, 0.008);
    box(w - 0.12, hauteur * 0.6, 0.008, 0, y + hauteur * 0.13, d / 2 - 0.022, m.verre, 0.004);
    box(w - 0.16, 0.016, 0.016, 0, y + hauteur * 0.82, d / 2 - 0.008, m.metal, 0.005);
    box(micro ? 0.06 : 0.12, 0.024, 0.006, w * 0.22, y + hauteur * 0.88, d / 2 - 0.025, m.noir, 0.002);
  }
  function vasque(largeur, profondeur, hauteur, x, y, z, mat = m.clair) {
    const ep = Math.min(p.variante === 'classique' ? 0.034 : p.variante === 'industriel' ? 0.018 : 0.025, hauteur * 0.23);
    box(largeur - ep * 2, ep, profondeur - ep * 2, x, y, z, mat, 0.012);
    for (const dx of [-largeur / 2 + ep / 2, largeur / 2 - ep / 2]) box(ep, hauteur, profondeur, x + dx, y, z, mat, 0.009);
    for (const dz of [-profondeur / 2 + ep / 2, profondeur / 2 - ep / 2]) box(largeur - ep * 2, hauteur, ep, x, y, z + dz, mat, 0.009);
    cyl(0.018, 0.018, 0.005, x, y + ep + 0.003, z, m.chrome, 16);
  }
  if (type === 'bas' || type === 'haut') {
    const plinthe = type === 'bas' ? Math.min(0.1, h * 0.13) : 0;
    const plan = type === 'bas' ? 0.03 : 0.018;
    if (plinthe) box(w - 0.04, plinthe, d - 0.06, 0, 0, -0.015, m.noir);
    caisson(h - plinthe - plan, plinthe);
    const n = Math.max(1, Math.ceil(w / 0.6));
    portes(h - plinthe - plan - 0.005, plinthe, n);
    box(w, plan, d, 0, h - plan, 0, type === 'bas' && p.variante === 'artdeco' ? matiere('marbre', '#E9E6DF') : m.bois, 0.008);
  } else if (type === 'colonne') {
    caisson(h);
    const fourH = Math.min(0.58, h * 0.29), microH = Math.min(0.36, h * 0.18), y = h * 0.28;
    portes(y - 0.006, 0, 1);
    four(y + 0.006, fourH);
    four(y + fourH + 0.018, microH, true);
    portes(h - y - fourH - microH - 0.028, y + fourH + microH + 0.028, 1);
  } else if (type === 'frigo' || type === 'americain') {
    const retrait = p.variante === 'classique' ? 0.06 : 0.035;
    box(w, h, d - retrait, 0, 0, -retrait / 2, m.principal, s.rayon);
    const n = type === 'americain' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const largeur = w / n, x = -w / 2 + largeur * (i + 0.5);
      const z = d / 2 - (p.variante === 'contemporain' ? 0.012 : 0.043);
      box(largeur - 0.008, h - 0.075, 0.024, x, 0.04, z, m.principal, s.rayon);
      if (p.variante !== 'contemporain') poignee(x + (i ? -1 : 1) * largeur * 0.31, h * 0.4, d / 2 - 0.007, true, Math.min(0.36, h * 0.24));
      else box(0.012,Math.min(.3,h*.23), 0.006, x + largeur*.32, h * 0.42, d / 2 - 0.003, m.noir, 0.003);
    }
    box(w - 0.03, 0.028, d, 0, 0.005, 0, m.noir);
    if (type === 'americain') box(0.13, 0.2, 0.006, -w * 0.21, h * 0.48, d / 2 - 0.027, m.noir, 0.009);
  } else if (type === 'plaque') {
    box(w, Math.max(0.01, h - 0.012), d, 0, 0, 0, m.principal, 0.008);
    const rayon = Math.min(w * 0.17, d * (p.variante === 'japandi' ? 0.28 : 0.2));
    const positions = p.variante === 'japandi' ? [[-w*0.25,0],[w*0.25,0]] : [-w*0.25,w*0.25].flatMap(x=>[-d*0.24,d*0.24].map(z=>[x,z]));
    for (const [x,z] of positions) {
      const o = cyl(rayon, rayon, 0.003, x, h - 0.003, z, p.variante === 'industriel' ? m.metal : m.chrome, 24);
      if (p.variante !== 'industriel') cyl(rayon - 0.003, rayon - 0.003, 0.004, x, h - 0.004, z, m.noir, 24);
      else { box(rayon * 1.6, 0.009, 0.012, x, h - 0.009, z, m.noir); box(0.012, 0.009, rayon * 1.6, x, h - 0.009, z, m.noir); }
    }
    if (p.variante === 'classique') for (const x of [-0.04,0.04]) cyl(0.014,0.014,0.006,x,h-0.006,d*0.38,m.metal,12);
  } else if (type === 'evier' || type === 'vasque') {
    const bassin = type === 'evier' ? Math.min(0.16, h * 0.42) : h;
    const matBassin=type==='evier'?matiere(p.coloris==='naturel'?'chrome':'ceramique',p.cols[0]):m.clair;
    if (type === 'evier' && p.variante === 'classique') {
      const ep=Math.min(.015,w*.03,d*.05);
      for(const x of [-w/2+ep/2,w/2-ep/2])box(ep,.008,d,x,bassin-.008,0,m.chrome);
      for(const z of [-d/2+ep/2,d/2-ep/2])box(w-ep*2,.008,ep,0,bassin-.008,z,m.chrome);
      box(w*.03,.008,d,0,bassin-.008,0,m.chrome);
      for (const x of [-w * 0.25, w * 0.25]) vasque(w * 0.47, d - 0.015, bassin, x, 0, 0, matBassin);
    } else if (type === 'evier' && p.variante === 'industriel') {
      vasque(w * 0.72, d, bassin, -w * 0.14, 0, 0, matBassin);
      box(w * 0.28, 0.012, d, w * 0.36, bassin - 0.012, 0, m.chrome);
      for (let i = 0; i < 7; i++) box(w * 0.23, 0.004, 0.004, w * 0.36, bassin - 0.004, -d * 0.35 + i * d * 0.7 / 6, m.noir, 0);
    } else vasque(w, d, bassin, 0, 0, 0, matBassin);
    if (type === 'evier' && p.variante === 'japandi') for (const x of [-w * 0.38, w * 0.38]) box(0.04, 0.012, d - 0.02, x, bassin - 0.012, 0, m.bois);
    if (type === 'evier') robinet(0, bassin, -d * 0.32, Math.max(0.1, h - bassin));
    else if (p.variante === 'boheme' || p.variante === 'japandi') {
      const geo = new THREE.LatheGeometry([[0, 0], [w * 0.35, 0], [w * 0.5, h * 0.6], [w * 0.5, h], [w * 0.46, h], [w * 0.38, h * 0.2], [0, h * 0.15]].map(v => new THREE.Vector2(...v)), 24);
      a.g.children.splice(0).forEach(o => { if (o.geometry) o.geometry.dispose(); });
      geo.scale(1, 1, d / w); mesh(geo, m.clair);
    }
  } else if (type === 'hotte') {
    const y = h * 0.32;
    if (p.variante === 'classique') {
      const o = cyl(w * 0.19, w * 0.5, y, 0, 0, 0, m.principal, 4); o.geometry.rotateY(Math.PI / 4); o.geometry.scale(Math.SQRT2, 1, Math.SQRT2 * d / w);
      box(w, 0.04, d, 0, 0, 0, m.bois);
    } else box(w, Math.min(0.1, h * 0.2), d, 0, 0, 0, m.metal, s.rayon);
    box(Math.min(w * 0.32, 0.3), h - y, Math.min(d * 0.55, 0.3), 0, y, -d * 0.1, m.metal, 0.008);
    box(w * 0.6, 0.004, d * 0.45, 0, 0.004, 0, m.noir);
  } else if (type === 'lave-vaisselle') {
    box(w, h, d - 0.04, 0, 0, -0.02, m.metal, s.rayon);
    facade(w - 0.008, h - 0.045, 0, 0.025, d / 2 - 0.04, 0.018, p.variante === 'classique' || p.variante === 'japandi' ? m.facade : m.principal);
    poignee(0, h - 0.12, d / 2 - 0.007, false, Math.min(w * 0.5, 0.3));
    box(w - 0.04, 0.024, d, 0, 0, 0, m.noir);
  } else if (type === 'credence') {
    const mat = materiauRevetement(p.revetement || 'zellige', {couleur:p.couleur||p.cols[0]});
    const retrait = p.variante === 'contemporain' ? 0 : Math.min(0.006,d*0.35);
    box(w, h, d-retrait, 0, 0, -retrait/2, mat, 0);
    if (p.variante === 'classique') for (const y of [0.004, h - 0.014]) box(w - 0.008, 0.01, 0.006, 0, y, d / 2 - 0.003, m.metal, 0.002);
    if (p.variante === 'industriel') for (const x of [-w / 2 + 0.008, w / 2 - 0.008]) box(0.01, h - 0.008, 0.006, x, 0.004, d / 2 - 0.003, m.noir, 0);
    if (p.variante === 'japandi') box(w - 0.008, 0.018, Math.min(0.009, d), 0, h - 0.018, d / 2 - Math.min(0.009, d) / 2, m.bois, 0.004);
  } else if (type === 'linge') {
    box(w, h, d - 0.045, 0, 0, -0.0225, m.principal, s.rayon);
    box(w - 0.006, h - 0.02, 0.028, 0, 0.01, d / 2 - 0.025, m.principal, s.rayon);
    const rayon = Math.min(w * 0.31, h * 0.26), y = h * 0.45, z = d / 2 - 0.009;
    anneau(rayon, rayon, 0.014, 0, y, z - 0.008, m.chrome);
    const o = cyl(rayon - 0.014, rayon - 0.014, 0.012, 0, y - 0.006, z - 0.003, m.noir, 32); o.rotation.x = Math.PI / 2;
    const verre = cyl(rayon * 0.8, rayon * 0.8, 0.006, 0, y - 0.003, z + 0.003, m.verre, 32); verre.rotation.x = Math.PI / 2;
    const bouton = cyl(0.025, 0.025, 0.014, -w * 0.27, h * 0.85, d / 2 - 0.007, m.chrome); bouton.rotation.x = Math.PI / 2;
    box(w * 0.3, 0.035, 0.006, w * 0.18, h * 0.84, d / 2 - 0.004, m.noir, 0.003);
  } else if (type === 'meuble-vasque') {
    const hautMeuble = h - Math.min(0.26, h * 0.3);
    caisson(hautMeuble - 0.025);
    portes(hautMeuble - 0.028, 0, Math.max(1, Math.ceil(w / 0.55)), true);
    box(w, 0.025, d, 0, hautMeuble - 0.025, 0, m.clair, 0.008);
    const largeur = Math.min(0.55, w * 0.75), profondeur = d * 0.65;
    vasque(largeur, profondeur, 0.08, 0, hautMeuble, d * 0.08);
    const y = h - 0.01;
    tube([[0, y - 0.02, -d / 2 + 0.016], [0, y - 0.009, -d / 2 + 0.09], [0, y - 0.05, -d / 2 + 0.17]], 0.009, m.chrome);
    box(0.08, 0.08, 0.018, 0, h - 0.08, -d / 2 + 0.009, m.chrome);
  } else if (type === 'wc') {
    const hauteur = h * 0.59;
    const tailleBase = {contemporain:0.2,classique:0.27,japandi:0.16,industriel:0.32}[p.variante];
    const geo = new THREE.LatheGeometry([[0, 0], [w * tailleBase, 0], [w * 0.46, hauteur * 0.65], [w * 0.5, hauteur], [w * 0.42, hauteur], [w * 0.31, hauteur * 0.45], [0, hauteur * 0.35]].map(v => new THREE.Vector2(...v)), p.variante === 'industriel' ? 12 : 24);
    geo.scale(1, 1, d * 0.9 / w); mesh(geo, m.clair, 0, 0, d * 0.05);
    const siege = new THREE.TorusGeometry(1, 0.075, 6, 32); siege.rotateX(Math.PI / 2); siege.scale(w * 0.43, 0.13, d * 0.4); mesh(siege, m.clair, 0, hauteur + 0.012, d * 0.05);
    box(w * 0.7, 0.14, 0.018, 0, h - 0.14, -d / 2 + 0.009, m.chrome, 0.008);
    box(0.06, 0.04, 0.006, -0.03, h - 0.09, -d / 2 + 0.021, m.principal, 0.007);
    box(0.035, 0.04, 0.006, 0.03, h - 0.09, -d / 2 + 0.021, m.principal, 0.007);
  } else if (type === 'douche') {
    box(w, 0.03, d, 0, 0, 0, m.clair, 0.008);
    const largeur = w * 0.6, haut = h - 0.03, x = -w / 2 + largeur / 2;
    if (p.arche || p.variante === 'classique' || p.variante === 'boheme') {
      const rayon = Math.min(largeur / 2, haut * 0.25), points = [[-largeur / 2, 0], [largeur / 2, 0], [largeur / 2, haut - rayon]];
      for (let i = 0; i <= 16; i++) { const angle = i / 16 * Math.PI; points.push([Math.cos(angle) * largeur / 2, haut - rayon + Math.sin(angle) * rayon]); }
      profil(points, 0.009, x, 0.03, d / 2 - 0.012, m.verre);
    } else if (p.variante === 'japandi') profil([[-largeur/2,0],[largeur/2,0],[largeur/2,haut-0.08],[largeur/2-0.08,haut],[-largeur/2+0.08,haut],[-largeur/2,haut-0.08]],0.009,x,0.03,d/2-0.012,m.verre);
    else box(largeur, haut, 0.009, x, 0.03, d / 2 - 0.012, m.verre, 0.004);
    box(0.018, haut, 0.018, -w / 2 + 0.009, 0.03, d / 2 - 0.009, m.noir);
    const robY = h * 0.48, z = -d / 2 + 0.025;
    box(0.18, 0.045, 0.035, 0, robY, z, m.chrome, 0.009);
    barre([0, robY + 0.06, z], [0, h - 0.12, z], 0.012, m.chrome);
    tube([[0, h - 0.12, z], [0, h - 0.065, z + 0.1], [0, h - 0.065, z + Math.min(d * 0.35, 0.3)]], 0.012, m.chrome);
    cyl(0.11, 0.11, 0.018, 0, h - 0.1, z + Math.min(d * 0.35, 0.3), m.chrome, 24);
    box(w * 0.22, 0.004, 0.025, 0, 0.034, -d * 0.32, m.chrome, 0.002);
  } else if (type === 'seche-serviettes') {
    const rayon = 0.012, z = d / 2 - rayon;
    for (const x of [-w / 2 + rayon, w / 2 - rayon]) {
      cyl(rayon, rayon, h, x, 0, z, m.metal, 12);
      for (const y of [0.08, h - 0.08]) barre([x, y, -d / 2], [x, y, z], 0.009, m.metal);
    }
    const n = Math.max(4, Math.min(22, Math.floor(h / 0.09)));
    for (let i = 0; i < n; i++) {
      const y = 0.025 + (h - 0.05) * i / (n - 1);
      if (p.variante === 'classique') tube([[-w / 2 + rayon, y, z], [0, y, z - Math.min(d * 0.25, 0.03)], [w / 2 - rayon, y, z]], 0.008, m.metal);
      else if (p.variante === 'japandi') box(w - rayon * 2, 0.018, 0.012, 0, y - 0.009, z, m.metal, 0.004);
      else barre([-w / 2 + rayon, y, z], [w / 2 - rayon, y, z], p.variante === 'industriel' ? 0.011 : 0.008, m.metal);
    }
  }
}
