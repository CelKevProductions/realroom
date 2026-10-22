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
    "id": "suspension-globe",
    "nom": "Suspension globe",
    "type": "suspension",
    "fam": "suspension",
    "pose": "plafond",
    "dim": [
      0.35,
      0.35,
      0.8
    ],
    "dimMin": [
      0.245,
      0.245,
      0.6
    ],
    "dimMax": [
      0.56,
      0.525,
      1.08
    ],
    "forme": "globe",
    "posable": false
  },
  {
    "id": "suspension-cloche",
    "nom": "Suspension cloche",
    "type": "suspension",
    "fam": "suspension",
    "pose": "plafond",
    "dim": [
      0.4,
      0.4,
      0.8
    ],
    "dimMin": [
      0.28,
      0.28,
      0.6
    ],
    "dimMax": [
      0.64,
      0.6,
      1.08
    ],
    "forme": "cloche",
    "posable": false
  },
  {
    "id": "suspension-papier",
    "nom": "Suspension en papier",
    "type": "suspension",
    "fam": "suspension",
    "pose": "plafond",
    "dim": [
      0.5,
      0.5,
      0.9
    ],
    "dimMin": [
      0.35,
      0.35,
      0.675
    ],
    "dimMax": [
      0.8,
      0.75,
      1.215
    ],
    "forme": "papier",
    "posable": false
  },
  {
    "id": "suspension-rotin",
    "nom": "Suspension en rotin",
    "type": "suspension",
    "fam": "suspension",
    "pose": "plafond",
    "dim": [
      0.48,
      0.48,
      0.85
    ],
    "dimMin": [
      0.336,
      0.336,
      0.637
    ],
    "dimMax": [
      0.768,
      0.72,
      1.147
    ],
    "forme": "rotin",
    "posable": false
  },
  {
    "id": "suspension-grappe",
    "nom": "Suspension en grappe",
    "type": "grappe",
    "fam": "suspension",
    "pose": "plafond",
    "dim": [
      0.8,
      0.7,
      1.1
    ],
    "dimMin": [
      0.56,
      0.49,
      0.825
    ],
    "dimMax": [
      1.28,
      1.05,
      1.485
    ],
    "forme": "",
    "posable": false
  },
  {
    "id": "suspension-longue",
    "nom": "Suspension longue",
    "type": "longue",
    "fam": "suspension",
    "pose": "plafond",
    "dim": [
      1.4,
      0.22,
      0.75
    ],
    "dimMin": [
      0.98,
      0.154,
      0.562
    ],
    "dimMax": [
      2.24,
      0.33,
      1.013
    ],
    "forme": "",
    "posable": false
  },
  {
    "id": "lustre-classique",
    "nom": "Lustre à bras",
    "type": "lustre",
    "fam": "lustre",
    "pose": "plafond",
    "dim": [
      0.85,
      0.85,
      0.8
    ],
    "dimMin": [
      0.595,
      0.595,
      0.6
    ],
    "dimMax": [
      1.36,
      1.275,
      1.08
    ],
    "forme": "",
    "posable": false
  },
  {
    "id": "lustre-lineaire",
    "nom": "Lustre moderne linéaire",
    "type": "lustre",
    "fam": "lustre",
    "pose": "plafond",
    "dim": [
      1.2,
      0.45,
      0.7
    ],
    "dimMin": [
      0.84,
      0.315,
      0.525
    ],
    "dimMax": [
      1.92,
      0.675,
      0.945
    ],
    "forme": "",
    "posable": false
  },
  {
    "id": "plafonnier",
    "nom": "Plafonnier",
    "type": "plafonnier",
    "fam": "plafonnier",
    "pose": "plafond",
    "dim": [
      0.45,
      0.45,
      0.15
    ],
    "dimMin": [
      0.315,
      0.315,
      0.112
    ],
    "dimMax": [
      0.72,
      0.675,
      0.203
    ],
    "forme": "",
    "posable": false
  },
  {
    "id": "applique-bras-articule",
    "nom": "Applique à bras articulé",
    "type": "applique",
    "fam": "applique",
    "pose": "mur",
    "dim": [
      0.28,
      0.32,
      0.4
    ],
    "dimMin": [
      0.196,
      0.224,
      0.3
    ],
    "dimMax": [
      0.448,
      0.48,
      0.54
    ],
    "forme": "",
    "posable": false
  },
  {
    "id": "applique-globe",
    "nom": "Applique globe",
    "type": "applique",
    "fam": "applique",
    "pose": "mur",
    "dim": [
      0.22,
      0.26,
      0.3
    ],
    "dimMin": [
      0.154,
      0.182,
      0.225
    ],
    "dimMax": [
      0.352,
      0.39,
      0.405
    ],
    "forme": "",
    "posable": false
  },
  {
    "id": "applique-liseuse",
    "nom": "Applique liseuse",
    "type": "applique",
    "fam": "applique",
    "pose": "mur",
    "dim": [
      0.18,
      0.25,
      0.32
    ],
    "dimMin": [
      0.126,
      0.175,
      0.24
    ],
    "dimMax": [
      0.288,
      0.375,
      0.432
    ],
    "forme": "",
    "posable": false
  },
  {
    "id": "lampadaire-arc",
    "nom": "Lampadaire arc",
    "type": "lampadaire",
    "fam": "lampadaire",
    "pose": "sol",
    "dim": [
      1.3,
      0.45,
      2
    ],
    "dimMin": [
      0.91,
      0.315,
      1.5
    ],
    "dimMax": [
      2.08,
      0.675,
      2.7
    ],
    "forme": "arc",
    "posable": false
  },
  {
    "id": "lampadaire-liseuse",
    "nom": "Lampadaire liseuse",
    "type": "lampadaire",
    "fam": "lampadaire",
    "pose": "sol",
    "dim": [
      0.34,
      0.34,
      1.45
    ],
    "dimMin": [
      0.238,
      0.238,
      1.087
    ],
    "dimMax": [
      0.544,
      0.51,
      1.958
    ],
    "forme": "liseuse",
    "posable": false
  },
  {
    "id": "lampadaire-trepied",
    "nom": "Lampadaire à trépied",
    "type": "lampadaire",
    "fam": "lampadaire",
    "pose": "sol",
    "dim": [
      0.55,
      0.55,
      1.55
    ],
    "dimMin": [
      0.385,
      0.385,
      1.163
    ],
    "dimMax": [
      0.88,
      0.825,
      2.093
    ],
    "forme": "trepied",
    "posable": false
  },
  {
    "id": "lampadaire-champignon",
    "nom": "Lampadaire champignon",
    "type": "lampadaire",
    "fam": "lampadaire",
    "pose": "sol",
    "dim": [
      0.5,
      0.5,
      1.45
    ],
    "dimMin": [
      0.35,
      0.35,
      1.087
    ],
    "dimMax": [
      0.8,
      0.75,
      1.958
    ],
    "forme": "champignon",
    "posable": false
  },
  {
    "id": "lampadaire-papier",
    "nom": "Lampadaire en papier",
    "type": "lampadaire",
    "fam": "lampadaire",
    "pose": "sol",
    "dim": [
      0.4,
      0.4,
      1.4
    ],
    "dimMin": [
      0.28,
      0.28,
      1.05
    ],
    "dimMax": [
      0.64,
      0.6,
      1.89
    ],
    "forme": "papier",
    "posable": false
  },
  {
    "id": "lampe-champignon",
    "nom": "Lampe champignon",
    "type": "lampe",
    "fam": "lampe",
    "pose": "sol",
    "dim": [
      0.32,
      0.32,
      0.42
    ],
    "dimMin": [
      0.224,
      0.224,
      0.315
    ],
    "dimMax": [
      0.512,
      0.48,
      0.567
    ],
    "forme": "champignon",
    "posable": true
  },
  {
    "id": "lampe-ceramique",
    "nom": "Lampe en céramique",
    "type": "lampe",
    "fam": "lampe",
    "pose": "sol",
    "dim": [
      0.32,
      0.32,
      0.5
    ],
    "dimMin": [
      0.224,
      0.224,
      0.375
    ],
    "dimMax": [
      0.512,
      0.48,
      0.675
    ],
    "forme": "ceramique",
    "posable": true
  },
  {
    "id": "lampe-plisse",
    "nom": "Lampe à abat-jour plissé",
    "type": "lampe",
    "fam": "lampe",
    "pose": "sol",
    "dim": [
      0.32,
      0.32,
      0.48
    ],
    "dimMin": [
      0.224,
      0.224,
      0.36
    ],
    "dimMax": [
      0.512,
      0.48,
      0.648
    ],
    "forme": "plisse",
    "posable": true
  },
  {
    "id": "lampe-pierre",
    "nom": "Lampe en pierre",
    "type": "lampe",
    "fam": "lampe",
    "pose": "sol",
    "dim": [
      0.3,
      0.3,
      0.46
    ],
    "dimMin": [
      0.21,
      0.21,
      0.345
    ],
    "dimMax": [
      0.48,
      0.45,
      0.621
    ],
    "forme": "pierre",
    "posable": true
  },
  {
    "id": "lampe-bureau",
    "nom": "Lampe de bureau",
    "type": "lampe",
    "fam": "lampe",
    "pose": "sol",
    "dim": [
      0.4,
      0.3,
      0.55
    ],
    "dimMin": [
      0.28,
      0.21,
      0.413
    ],
    "dimMax": [
      0.64,
      0.45,
      0.743
    ],
    "forme": "bureau",
    "posable": true
  }
];

export const ELEMENTS = figer(Object.fromEntries(DONNEES.map(d => { const f = definirFiche(d); return [f.id, f]; })));

function dessiner(a) {
  const { p, w, d, h, m, s, box, cyl, mesh, ellipsoide, barre, tube, revolution } = a;
  const source = matiere('lumiere'), type = p.type;
  function abatjour(largeur, profondeur, hauteur, x, y, z, forme = p.forme) {
    const mat = forme === 'rotin' || p.variante === 'boheme' ? m.facade : forme === 'pierre' ? matiere('travertin', '#D3C3A8') : p.variante === 'industriel' || forme === 'cloche' || forme === 'champignon' ? m.metal : m.tissu;
    if (forme === 'globe') {
      const points = [], exposant = { contemporain: 0.5, classique: 0.7, japandi: 0.3, industriel: 0.9, boheme: 0.4, artdeco: 0.6 }[p.variante];
      for (let i = 0; i <= 20; i++) { const t = i / 20; points.push([Math.pow(Math.max(0, 1 - Math.pow(t * 2 - 1, 2)), exposant) * largeur / 2, t * hauteur]); }
      const globe = revolution(points, x, y, z, source); globe.scale.z = profondeur / largeur;
      if (p.variante === 'classique' || p.variante === 'artdeco') for (let i = 0; i < 3; i++) {
        const rayon = largeur / 2 * Math.sqrt(1 - Math.pow((i + 1) / 4 * 2 - 1, 2));
        const o = cyl(rayon, rayon, 0.006, x, y + (i + 1) / 4 * hauteur, z, m.metal, 24); o.scale.z = profondeur / largeur;
      }
    } else if (forme === 'papier') {
      const points = [];
      const puissance = { contemporain: 0.9, classique: 1.2, japandi: 0.6, industriel: 1.5, boheme: 0.75, artdeco: 1.05 }[p.variante];
      for (let i = 0; i <= 18; i++) { const t = i / 18, rayon = Math.pow(Math.sin(t * Math.PI), puissance) * largeur / 2 * (i % 2 ? 1 : 1 / 1.035); points.push([rayon, t * hauteur]); }
      const o = revolution(points, x, y, z, matiere('lin', p.cols[0])); o.scale.z = profondeur / largeur;
    } else if (forme === 'champignon') {
      const couronne = { contemporain: 0.31, classique: 0.24, japandi: 0.37, industriel: 0.16, boheme: 0.4, artdeco: 0.28 }[p.variante];
      const points = [[0, 0], [largeur * 0.5, 0], [largeur * 0.5, hauteur * 0.14], [largeur * 0.46, hauteur * 0.5], [largeur * couronne, hauteur * 0.85], [0, hauteur]];
      const o = revolution(points, x, y, z, p.variante === 'japandi' ? m.bois : mat); o.scale.z = profondeur / largeur;
      const disque = cyl(largeur * 0.44, largeur * 0.44, 0.004, x, y + 0.003, z, source, 24); disque.scale.z = profondeur / largeur;
    } else if (forme === 'plisse') {
      const n = { contemporain: 64, classique: 48, japandi: 32, industriel: 24, boheme: 40, artdeco: 80 }[p.variante], positions = [], uv = [], indices = [];
      for (let j = 0; j < 2; j++) for (let i = 0; i <= n; i++) {
        const angle = i / n * TOUR, rayon = largeur * (j ? 0.32 : 0.5) * (i % 2 ? 0.94 : 1);
        positions.push(Math.cos(angle) * rayon, j * hauteur, Math.sin(angle) * rayon * profondeur / largeur); uv.push(i / n * largeur * Math.PI, j * hauteur);
      }
      for (let i = 0; i < n; i++) { const j = n + 1 + i; indices.push(i, j, i + 1, i + 1, j, j + 1); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals(); mesh(geo, mat, x, y, z);
    } else {
      const sommet = { contemporain: 0.25, classique: 0.34, japandi: 0.2, industriel: 0.12, boheme: 0.3, artdeco: 0.39 }[p.variante];
      const points = [[largeur * 0.48, 0], [largeur * 0.5, 0.012], [largeur * sommet, hauteur], [largeur * (sommet - 0.025), hauteur], [largeur * 0.47, 0.02]];
      const o = revolution(points, x, y, z, mat); o.scale.z = profondeur / largeur;
    }
    if (forme !== 'globe' && forme !== 'champignon') ellipsoide(Math.min(0.07, largeur * 0.25), Math.min(0.09, hauteur * 0.6), Math.min(0.07, profondeur * 0.3), x, y + 0.012, z, source);
  }
  function plafond() { box(Math.min(0.13, w * 0.4), 0.018, Math.min(0.13, d * 0.4), 0, h - 0.018, 0, m.metal, 0.006); }
  function pied(hauteur, x = 0, z = 0) {
    if (p.forme === 'trepied' || p.variante === 'japandi') {
      for (let i = 0; i < 3; i++) { const angle = i / 3 * TOUR, xx = x + Math.cos(angle) * w * 0.35, zz = z + Math.sin(angle) * d * 0.35; barre([xx, 0.012, zz], [x, hauteur - 0.01, z], 0.014, m.bois); cyl(0.014, 0.014, 0.012, xx, 0, zz, m.bois, 12); }
    } else if (p.variante === 'classique') revolution([[w * 0.18, 0], [w * 0.18, 0.025], [0.025, 0.06], [0.015, hauteur * 0.5], [0.025, hauteur]], x, 0, z, m.metal);
    else {
      const base = cyl(w * 0.22, w * 0.25, 0.025, x, 0, z, p.variante === 'boheme' ? m.bois : m.metal, 24); base.scale.z = d / w;
      cyl(0.013, 0.016, hauteur - 0.025, x, 0.025, z, m.metal, 12);
    }
  }
  if (type === 'suspension') {
    plafond();
    const haut = Math.min(h * 0.7, Math.max(w, d) * (p.forme === 'papier' ? 0.9 : 0.72));
    abatjour(w, d, haut, 0, 0, 0);
    cyl(p.variante === 'industriel' ? 0.007 : 0.003, 0.003, h - haut - 0.015, 0, haut, 0, m.metal, 8);
    if (p.variante === 'artdeco') cyl(0.02, 0.02, Math.min(0.1, h - haut), 0, haut, 0, m.metal, 12);
  } else if (type === 'grappe') {
    plafond();
    const largeur = w * 0.26, profondeur = d * 0.26, haut = Math.min(h * 0.3, Math.max(largeur, profondeur));
    const poses = [[-w / 2 + largeur / 2, 0, 0], [w / 2 - largeur / 2, h * 0.22, 0], [0, h * 0.1, -d / 2 + profondeur / 2], [0, h * 0.27, d / 2 - profondeur / 2], [0, h * 0.38, 0]];
    for (const [x, y, z] of poses) { abatjour(largeur, profondeur, haut, x, y, z, 'globe'); barre([x, y + haut, z], [x * 0.15, h - 0.02, z * 0.15], p.variante === 'classique' ? 0.007 : 0.003, m.metal); }
  } else if (type === 'longue') {
    plafond();
    box(w, 0.025, d * 0.25, 0, h * 0.3, 0, p.variante === 'japandi' ? m.bois : m.metal, 0.008);
    for (const x of [-w * 0.3, w * 0.3]) barre([x, h * 0.3 + 0.025, 0], [x, h - 0.01, 0], 0.003, m.metal);
    for (let i = 0; i < 3; i++) abatjour(w * 0.22, d, h * 0.27, -w * 0.32 + i * w * 0.32, 0, 0, p.variante === 'boheme' ? 'rotin' : 'globe');
  } else if (type === 'lustre') {
    plafond(); cyl(0.018, 0.024, h - 0.02, 0, 0, 0, m.metal, 16);
    const n = p.id.includes('lineaire') ? 6 : 8, largeur = Math.min(0.11, w * 0.15), profondeur = Math.min(0.11, d * 0.15), haut = Math.min(0.16, h * 0.25);
    for (let i = 0; i < n; i++) {
      const angle = i / n * TOUR, x = p.id.includes('lineaire') ? (Math.floor(i / 2) - 1) * (w / 2 - largeur / 2) : Math.cos(angle) * (w / 2 - largeur / 2), z = p.id.includes('lineaire') ? (i % 2 ? 1 : -1) * (d / 2 - profondeur / 2) : Math.sin(angle) * (d / 2 - profondeur / 2);
      const y = p.id.includes('lineaire') ? h * 0.12 : h * 0.2;
      tube([[0, h * 0.42, 0], [x * 0.72, h * 0.12, z * 0.72], [x, y + 0.03, z]], 0.009, m.metal);
      abatjour(largeur, profondeur, haut, x, y, z, p.variante === 'classique' ? 'plisse' : 'globe');
    }
  } else if (type === 'plafonnier') {
    const haut = h - 0.02;
    const base = cyl(w / 2, w / 2, 0.02, 0, h - 0.02, 0, m.metal, 32); base.scale.z = d / w;
    abatjour(w, d, haut, 0, 0, 0, p.variante === 'japandi' || p.variante === 'boheme' ? 'papier' : 'globe');
  } else if (type === 'applique') {
    box(Math.min(0.09, w * 0.35), h, 0.018, 0, 0, -d / 2 + 0.009, m.metal, 0.015);
    const haut = Math.min(h * 0.7, w), profondeur = Math.min(d * 0.72, w), z = d / 2 - profondeur / 2;
    if (p.id.includes('articule') || p.id.includes('liseuse')) tube([[0, h * 0.32, -d / 2 + 0.02], [-w * 0.2, h * 0.55, 0], [0, h * 0.75, z]], 0.009, m.metal);
    else barre([0, h * 0.4, -d / 2 + 0.02], [0, h * 0.4, z], 0.012, p.variante === 'japandi' ? m.bois : m.metal);
    abatjour(w, profondeur, haut, 0, h * 0.15, z, p.id.includes('globe') ? 'globe' : p.variante === 'classique' ? 'plisse' : 'cloche');
  } else if (type === 'lampadaire') {
    if (p.forme === 'arc') {
      const largeur = Math.min(w * 0.4, d), profondeur = Math.min(d * 0.95, largeur), haut = Math.min(0.35, h * 0.2), xBase = -w / 2 + w * 0.18, xTete = w / 2 - largeur / 2;
      const base = cyl(w * 0.18, w * 0.18, 0.035, xBase, 0, 0, m.metal, 24); base.scale.z = d / (w * 0.36);
      const arc = tube([[xBase, 0.035, 0], [xBase, h * 0.65, 0], [xBase + w * 0.3, h - 0.01, 0], [xTete, h - 0.12, 0]], 0.01, m.metal); arc.geometry.computeBoundingBox(); arc.geometry.scale(1, h / arc.geometry.boundingBox.max.y, 1);
      abatjour(largeur, profondeur, haut, xTete, h - haut - 0.12, 0, 'cloche');
    } else {
      const haut = p.forme === 'papier' ? h * 0.73 : Math.min(h * 0.35, Math.max(w, d) * 0.8);
      pied(h - haut);
      abatjour(w, d, haut, 0, h - haut, 0, p.forme === 'trepied' || p.forme === 'liseuse' ? (p.variante === 'classique' ? 'plisse' : 'cloche') : p.forme);
    }
  } else if (type === 'lampe') {
    const haut = Math.min(h * 0.48, Math.max(w, d) * 0.65), corps = h - haut;
    if (p.forme === 'bureau') {
      const base = cyl(w / 2, w / 2, 0.025, 0, 0, 0, m.metal, 24); base.scale.z = d / w;
      const bras = tube([[-w * 0.2, 0.025, 0], [-w * 0.2, h * 0.45, 0], [w * 0.2, h - 0.015, 0]], 0.012, m.metal); bras.geometry.computeBoundingBox(); bras.geometry.scale(1, h / bras.geometry.boundingBox.max.y, 1);
      abatjour(w * 0.55, d * 0.7, h * 0.25, w * 0.15, h * 0.72, 0, 'cloche');
    } else {
      if (p.forme === 'ceramique' || p.forme === 'pierre') {
        const o = revolution([[0, 0], [w * 0.2, 0], [w * 0.25, corps * 0.25], [w * 0.21, corps * 0.65], [w * 0.09, corps], [0, corps]], 0, 0, 0, p.forme === 'pierre' ? matiere('travertin', '#D3C3A8') : matiere('ceramique', p.cols[0])); o.scale.z = d / w;
      } else pied(corps);
      abatjour(w, d, haut, 0, corps, 0, p.forme === 'ceramique' || p.forme === 'pierre' ? (p.variante === 'classique' ? 'plisse' : 'cloche') : p.forme);
    }
  }
}
