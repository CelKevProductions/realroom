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
    "id": "canape-2-places",
    "nom": "Canapé 2 places",
    "type": "canape",
    "fam": "canape",
    "pose": "sol",
    "dim": [
      1.6,
      0.9,
      0.86
    ],
    "dimMin": [
      1.12,
      0.63,
      0.645
    ],
    "dimMax": [
      2.56,
      1.35,
      1.161
    ],
    "places": 2
  },
  {
    "id": "canape-3-places",
    "nom": "Canapé 3 places",
    "type": "canape",
    "fam": "canape",
    "pose": "sol",
    "dim": [
      2.1,
      0.9,
      0.86
    ],
    "dimMin": [
      1.47,
      0.63,
      0.645
    ],
    "dimMax": [
      3.36,
      1.35,
      1.161
    ],
    "places": 3
  },
  {
    "id": "canape-4-places",
    "nom": "Canapé 4 places",
    "type": "canape",
    "fam": "canape",
    "pose": "sol",
    "dim": [
      2.7,
      0.9,
      0.86
    ],
    "dimMin": [
      1.89,
      0.63,
      0.645
    ],
    "dimMax": [
      4.32,
      1.35,
      1.161
    ],
    "places": 4
  },
  {
    "id": "canape-angle-gauche",
    "nom": "Canapé d’angle gauche",
    "type": "canape",
    "fam": "canape",
    "pose": "sol",
    "dim": [
      2.7,
      1.65,
      0.87
    ],
    "dimMin": [
      1.89,
      1.155,
      0.652
    ],
    "dimMax": [
      4.32,
      2.475,
      1.175
    ],
    "places": 3,
    "cote": -1
  },
  {
    "id": "canape-angle-droit",
    "nom": "Canapé d’angle droit",
    "type": "canape",
    "fam": "canape",
    "pose": "sol",
    "dim": [
      2.7,
      1.65,
      0.87
    ],
    "dimMin": [
      1.89,
      1.155,
      0.652
    ],
    "dimMax": [
      4.32,
      2.475,
      1.175
    ],
    "places": 3,
    "cote": 1
  },
  {
    "id": "meridienne",
    "nom": "Méridienne",
    "type": "canape",
    "fam": "meridienne",
    "pose": "sol",
    "dim": [
      1.75,
      0.85,
      0.78
    ],
    "dimMin": [
      1.225,
      0.595,
      0.585
    ],
    "dimMax": [
      2.8,
      1.275,
      1.053
    ],
    "places": 2
  },
  {
    "id": "canape-modulable",
    "nom": "Canapé modulable",
    "type": "canape",
    "fam": "canape",
    "pose": "sol",
    "dim": [
      2.8,
      0.95,
      0.82
    ],
    "dimMin": [
      1.96,
      0.665,
      0.615
    ],
    "dimMax": [
      4.48,
      1.425,
      1.107
    ],
    "modules": 4
  },
  {
    "id": "canape-arrondi",
    "nom": "Canapé arrondi",
    "type": "canape",
    "fam": "canape",
    "pose": "sol",
    "dim": [
      2.3,
      1,
      0.85
    ],
    "dimMin": [
      1.61,
      0.7,
      0.637
    ],
    "dimMax": [
      3.68,
      1.5,
      1.147
    ],
    "places": 3
  },
  {
    "id": "canape-convertible",
    "nom": "Canapé convertible",
    "type": "canape",
    "fam": "canape",
    "pose": "sol",
    "dim": [
      2.1,
      0.96,
      0.88
    ],
    "dimMin": [
      1.47,
      0.672,
      0.66
    ],
    "dimMax": [
      3.36,
      1.44,
      1.188
    ],
    "places": 3
  },
  {
    "id": "canape-chesterfield",
    "nom": "Canapé Chesterfield",
    "type": "canape",
    "fam": "canape",
    "pose": "sol",
    "dim": [
      2.1,
      0.9,
      0.82
    ],
    "dimMin": [
      1.47,
      0.63,
      0.615
    ],
    "dimMax": [
      3.36,
      1.35,
      1.107
    ],
    "places": 3
  },
  {
    "id": "canape-japonais",
    "nom": "Canapé bas japonais",
    "type": "canape",
    "fam": "canape",
    "pose": "sol",
    "dim": [
      2,
      0.9,
      0.63
    ],
    "dimMin": [
      1.4,
      0.63,
      0.473
    ],
    "dimMax": [
      3.2,
      1.35,
      0.851
    ],
    "places": 3
  },
  {
    "id": "futon",
    "nom": "Futon",
    "type": "canape",
    "fam": "canape",
    "pose": "sol",
    "dim": [
      1.95,
      0.9,
      0.62
    ],
    "dimMin": [
      1.365,
      0.63,
      0.465
    ],
    "dimMax": [
      3.12,
      1.35,
      0.837
    ],
    "places": 3
  },
  {
    "id": "fauteuil-club",
    "nom": "Fauteuil club",
    "type": "fauteuil",
    "fam": "fauteuil",
    "pose": "sol",
    "dim": [
      0.86,
      0.86,
      0.83
    ],
    "dimMin": [
      0.602,
      0.602,
      0.622
    ],
    "dimMax": [
      1.376,
      1.29,
      1.121
    ]
  },
  {
    "id": "fauteuil-bergere",
    "nom": "Bergère",
    "type": "fauteuil",
    "fam": "fauteuil",
    "pose": "sol",
    "dim": [
      0.76,
      0.82,
      1.02
    ],
    "dimMin": [
      0.532,
      0.574,
      0.765
    ],
    "dimMax": [
      1.216,
      1.23,
      1.377
    ]
  },
  {
    "id": "fauteuil-oreilles",
    "nom": "Fauteuil à oreilles",
    "type": "fauteuil",
    "fam": "fauteuil",
    "pose": "sol",
    "dim": [
      0.8,
      0.85,
      1.08
    ],
    "dimMin": [
      0.56,
      0.595,
      0.81
    ],
    "dimMax": [
      1.28,
      1.275,
      1.458
    ]
  },
  {
    "id": "fauteuil-cocoon",
    "nom": "Fauteuil cocoon",
    "type": "fauteuil",
    "fam": "fauteuil",
    "pose": "sol",
    "dim": [
      0.95,
      0.94,
      0.85
    ],
    "dimMin": [
      0.665,
      0.658,
      0.637
    ],
    "dimMax": [
      1.52,
      1.41,
      1.147
    ]
  },
  {
    "id": "fauteuil-lounge",
    "nom": "Fauteuil lounge",
    "type": "fauteuil",
    "fam": "fauteuil",
    "pose": "sol",
    "dim": [
      0.78,
      0.94,
      0.78
    ],
    "dimMin": [
      0.546,
      0.658,
      0.585
    ],
    "dimMax": [
      1.248,
      1.41,
      1.053
    ]
  },
  {
    "id": "fauteuil-rotin",
    "nom": "Fauteuil en rotin",
    "type": "fauteuil",
    "fam": "fauteuil",
    "pose": "sol",
    "dim": [
      0.75,
      0.8,
      0.94
    ],
    "dimMin": [
      0.525,
      0.56,
      0.705
    ],
    "dimMax": [
      1.2,
      1.2,
      1.269
    ]
  },
  {
    "id": "fauteuil-bascule",
    "nom": "Fauteuil à bascule",
    "type": "fauteuil",
    "fam": "fauteuil",
    "pose": "sol",
    "dim": [
      0.76,
      1,
      1
    ],
    "dimMin": [
      0.532,
      0.7,
      0.75
    ],
    "dimMax": [
      1.216,
      1.5,
      1.35
    ]
  },
  {
    "id": "fauteuil-pivotant",
    "nom": "Fauteuil pivotant",
    "type": "fauteuil",
    "fam": "fauteuil",
    "pose": "sol",
    "dim": [
      0.8,
      0.84,
      0.85
    ],
    "dimMin": [
      0.56,
      0.588,
      0.637
    ],
    "dimMax": [
      1.28,
      1.26,
      1.147
    ]
  },
  {
    "id": "chauffeuse",
    "nom": "Chauffeuse",
    "type": "fauteuil",
    "fam": "fauteuil",
    "pose": "sol",
    "dim": [
      0.72,
      0.84,
      0.73
    ],
    "dimMin": [
      0.504,
      0.588,
      0.547
    ],
    "dimMax": [
      1.152,
      1.26,
      0.986
    ]
  },
  {
    "id": "fauteuil-bureau-ergonomique",
    "nom": "Fauteuil de bureau ergonomique",
    "type": "bureau",
    "fam": "fauteuil",
    "pose": "sol",
    "dim": [
      0.68,
      0.68,
      1.18
    ],
    "dimMin": [
      0.476,
      0.476,
      0.885
    ],
    "dimMax": [
      1.088,
      1.02,
      1.593
    ]
  },
  {
    "id": "chaise-repas-bois",
    "nom": "Chaise de repas en bois",
    "type": "chaise",
    "fam": "chaise",
    "pose": "sol",
    "dim": [
      0.46,
      0.51,
      0.84
    ],
    "dimMin": [
      0.322,
      0.357,
      0.63
    ],
    "dimMax": [
      0.736,
      0.765,
      1.134
    ]
  },
  {
    "id": "chaise-tapissee",
    "nom": "Chaise tapissée",
    "type": "chaise",
    "fam": "chaise",
    "pose": "sol",
    "dim": [
      0.5,
      0.56,
      0.86
    ],
    "dimMin": [
      0.35,
      0.392,
      0.645
    ],
    "dimMax": [
      0.8,
      0.84,
      1.161
    ]
  },
  {
    "id": "chaise-cannee",
    "nom": "Chaise cannée",
    "type": "chaise",
    "fam": "chaise",
    "pose": "sol",
    "dim": [
      0.47,
      0.53,
      0.87
    ],
    "dimMin": [
      0.329,
      0.371,
      0.652
    ],
    "dimMax": [
      0.752,
      0.795,
      1.175
    ]
  },
  {
    "id": "chaise-metal",
    "nom": "Chaise en métal",
    "type": "chaise",
    "fam": "chaise",
    "pose": "sol",
    "dim": [
      0.46,
      0.53,
      0.84
    ],
    "dimMin": [
      0.322,
      0.371,
      0.63
    ],
    "dimMax": [
      0.736,
      0.795,
      1.134
    ]
  },
  {
    "id": "chaise-bistrot",
    "nom": "Chaise bistrot",
    "type": "chaise",
    "fam": "chaise",
    "pose": "sol",
    "dim": [
      0.44,
      0.48,
      0.86
    ],
    "dimMin": [
      0.308,
      0.336,
      0.645
    ],
    "dimMax": [
      0.704,
      0.72,
      1.161
    ]
  },
  {
    "id": "chaise-accoudoirs",
    "nom": "Chaise à accoudoirs",
    "type": "chaise",
    "fam": "chaise",
    "pose": "sol",
    "dim": [
      0.58,
      0.58,
      0.86
    ],
    "dimMin": [
      0.406,
      0.406,
      0.645
    ],
    "dimMax": [
      0.928,
      0.87,
      1.161
    ]
  },
  {
    "id": "chaise-empilable",
    "nom": "Chaise empilable",
    "type": "chaise",
    "fam": "chaise",
    "pose": "sol",
    "dim": [
      0.48,
      0.53,
      0.82
    ],
    "dimMin": [
      0.336,
      0.371,
      0.615
    ],
    "dimMax": [
      0.768,
      0.795,
      1.107
    ]
  },
  {
    "id": "chaise-windsor",
    "nom": "Chaise Windsor",
    "type": "chaise",
    "fam": "chaise",
    "pose": "sol",
    "dim": [
      0.48,
      0.54,
      0.92
    ],
    "dimMin": [
      0.336,
      0.378,
      0.69
    ],
    "dimMax": [
      0.768,
      0.81,
      1.242
    ]
  },
  {
    "id": "chaise-haute-bar",
    "nom": "Chaise haute de bar",
    "type": "chaise",
    "fam": "chaise",
    "pose": "sol",
    "dim": [
      0.48,
      0.52,
      1.06
    ],
    "dimMin": [
      0.336,
      0.364,
      0.795
    ],
    "dimMax": [
      0.768,
      0.78,
      1.431
    ]
  },
  {
    "id": "tabouret-bar-fixe",
    "nom": "Tabouret de bar fixe",
    "type": "tabouret",
    "fam": "tabouret",
    "pose": "sol",
    "dim": [
      0.42,
      0.42,
      0.76
    ],
    "dimMin": [
      0.294,
      0.294,
      0.57
    ],
    "dimMax": [
      0.672,
      0.63,
      1.026
    ]
  },
  {
    "id": "tabouret-cuisine-fixe",
    "nom": "Tabouret de cuisine fixe",
    "type": "tabouret",
    "fam": "tabouret",
    "pose": "sol",
    "dim": [
      0.4,
      0.4,
      0.65
    ],
    "dimMin": [
      0.28,
      0.28,
      0.488
    ],
    "dimMax": [
      0.64,
      0.6,
      0.878
    ]
  },
  {
    "id": "tabouret-reglable",
    "nom": "Tabouret réglable",
    "type": "tabouret",
    "fam": "tabouret",
    "pose": "sol",
    "dim": [
      0.42,
      0.42,
      0.76
    ],
    "dimMin": [
      0.294,
      0.294,
      0.57
    ],
    "dimMax": [
      0.672,
      0.63,
      1.026
    ]
  },
  {
    "id": "tabouret-tapisse",
    "nom": "Tabouret tapissé",
    "type": "tabouret",
    "fam": "tabouret",
    "pose": "sol",
    "dim": [
      0.44,
      0.44,
      0.7
    ],
    "dimMin": [
      0.308,
      0.308,
      0.525
    ],
    "dimMax": [
      0.704,
      0.66,
      0.945
    ]
  },
  {
    "id": "tabouret-bar-reglable",
    "nom": "Tabouret de bar réglable",
    "type": "tabouret",
    "fam": "tabouret",
    "pose": "sol",
    "dim": [
      0.42,
      0.42,
      0.78
    ],
    "dimMin": [
      0.294,
      0.294,
      0.585
    ],
    "dimMax": [
      0.672,
      0.63,
      1.053
    ]
  },
  {
    "id": "tabouret-cuisine-reglable",
    "nom": "Tabouret de cuisine réglable",
    "type": "tabouret",
    "fam": "tabouret",
    "pose": "sol",
    "dim": [
      0.42,
      0.42,
      0.65
    ],
    "dimMin": [
      0.294,
      0.294,
      0.488
    ],
    "dimMax": [
      0.672,
      0.63,
      0.878
    ]
  },
  {
    "id": "tabouret-bar-tapisse",
    "nom": "Tabouret de bar tapissé",
    "type": "tabouret",
    "fam": "tabouret",
    "pose": "sol",
    "dim": [
      0.44,
      0.44,
      0.76
    ],
    "dimMin": [
      0.308,
      0.308,
      0.57
    ],
    "dimMax": [
      0.704,
      0.66,
      1.026
    ]
  },
  {
    "id": "tabouret-cuisine-tapisse",
    "nom": "Tabouret de cuisine tapissé",
    "type": "tabouret",
    "fam": "tabouret",
    "pose": "sol",
    "dim": [
      0.44,
      0.44,
      0.65
    ],
    "dimMin": [
      0.308,
      0.308,
      0.488
    ],
    "dimMax": [
      0.704,
      0.66,
      0.878
    ]
  },
  {
    "id": "banc-entree",
    "nom": "Banc d’entrée",
    "type": "banc",
    "fam": "banc",
    "pose": "sol",
    "dim": [
      1.1,
      0.38,
      0.45
    ],
    "dimMin": [
      0.77,
      0.266,
      0.338
    ],
    "dimMax": [
      1.76,
      0.57,
      0.608
    ]
  },
  {
    "id": "banc-bout-lit",
    "nom": "Banc de bout de lit",
    "type": "banc",
    "fam": "banc",
    "pose": "sol",
    "dim": [
      1.4,
      0.43,
      0.45
    ],
    "dimMin": [
      0.98,
      0.301,
      0.338
    ],
    "dimMax": [
      2.24,
      0.645,
      0.608
    ]
  },
  {
    "id": "banc-repas",
    "nom": "Banc de repas",
    "type": "banc",
    "fam": "banc",
    "pose": "sol",
    "dim": [
      1.6,
      0.38,
      0.46
    ],
    "dimMin": [
      1.12,
      0.266,
      0.345
    ],
    "dimMax": [
      2.56,
      0.57,
      0.621
    ]
  },
  {
    "id": "banquette",
    "nom": "Banquette",
    "type": "banc",
    "fam": "banc",
    "pose": "sol",
    "dim": [
      1.5,
      0.6,
      0.85
    ],
    "dimMin": [
      1.05,
      0.42,
      0.637
    ],
    "dimMax": [
      2.4,
      0.9,
      1.147
    ]
  },
  {
    "id": "pouf-rond",
    "nom": "Pouf rond",
    "type": "pouf",
    "fam": "pouf",
    "pose": "sol",
    "dim": [
      0.55,
      0.55,
      0.4
    ],
    "dimMin": [
      0.385,
      0.385,
      0.3
    ],
    "dimMax": [
      0.88,
      0.825,
      0.54
    ]
  },
  {
    "id": "pouf-carre",
    "nom": "Pouf carré",
    "type": "pouf",
    "fam": "pouf",
    "pose": "sol",
    "dim": [
      0.55,
      0.55,
      0.4
    ],
    "dimMin": [
      0.385,
      0.385,
      0.3
    ],
    "dimMax": [
      0.88,
      0.825,
      0.54
    ]
  },
  {
    "id": "pouf-cuir",
    "nom": "Pouf en cuir",
    "type": "pouf",
    "fam": "pouf",
    "pose": "sol",
    "dim": [
      0.6,
      0.6,
      0.4
    ],
    "dimMin": [
      0.42,
      0.42,
      0.3
    ],
    "dimMax": [
      0.96,
      0.9,
      0.54
    ]
  },
  {
    "id": "pouf-tresse",
    "nom": "Pouf tressé",
    "type": "pouf",
    "fam": "pouf",
    "pose": "sol",
    "dim": [
      0.55,
      0.55,
      0.38
    ],
    "dimMin": [
      0.385,
      0.385,
      0.285
    ],
    "dimMax": [
      0.88,
      0.825,
      0.513
    ]
  },
  {
    "id": "repose-pieds",
    "nom": "Repose-pieds",
    "type": "pouf",
    "fam": "pouf",
    "pose": "sol",
    "dim": [
      0.55,
      0.42,
      0.38
    ],
    "dimMin": [
      0.385,
      0.294,
      0.285
    ],
    "dimMax": [
      0.88,
      0.63,
      0.513
    ]
  },
  {
    "id": "chaise-longue",
    "nom": "Chaise longue",
    "type": "longue",
    "fam": "meridienne",
    "pose": "sol",
    "dim": [
      0.72,
      1.55,
      0.85
    ],
    "dimMin": [
      0.504,
      1.085,
      0.637
    ],
    "dimMax": [
      1.152,
      2.325,
      1.147
    ]
  }
];

export const ELEMENTS = figer(Object.fromEntries(DONNEES.map(d => { const f = definirFiche(d); return [f.id, f]; })));

function dessiner(a) {
  const { p, w, d, h, s, m, box, cyl, mesh, ellipsoide, barre, tube, anneau, instances, pieds } = a;
  const type = p.type, cuir = p.id.includes('cuir') || p.id.includes('club') || p.id.includes('chesterfield');
  const tissu = cuir ? matiere('cuir', p.cols[0]) : m.tissu;
  function capitons(largeur, hauteur, y, z) {
    const nx = Math.min(14, Math.max(3, Math.round(largeur / 0.18))), ny = Math.max(2, Math.round(hauteur / 0.16)), poses = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) poses.push({ position: [-largeur / 2 + (i + 0.5) * largeur / nx, y + (j + 0.5) * hauteur / ny, z], echelle: [0.009, 0.009, 0.005] });
    instances(new THREE.SphereGeometry(1, 6, 4), tissu, poses);
  }
  function dossier(largeur, y, haut, z, epaisseur, mat = tissu, incline = false) {
    if (p.variante === 'artdeco') {
      const n = Math.max(3, Math.min(11, Math.round(largeur / 0.18)));
      for (let i = 0; i < n; i++) { const hv = haut - 0.035 * Math.abs(i - (n - 1) / 2) / n; box(largeur / n - 0.004, hv, epaisseur, -largeur / 2 + largeur * (i + 0.5) / n, y, z, mat, 0.035); }
    } else if (p.variante === 'boheme') {
      box(largeur, haut, epaisseur * 0.6, 0, y, z - epaisseur * 0.15, m.facade, 0.018);
      for (const x of [-largeur / 2 + 0.012, largeur / 2 - 0.012]) cyl(0.012, 0.012, haut, x, y, z + epaisseur * 0.3, m.bois, 12);
      box(largeur, 0.024, epaisseur, 0, y + haut - 0.024, z, m.bois, 0.012);
    } else if (p.variante === 'japandi' && mat !== tissu) {
      const n = Math.max(3, Math.min(22, Math.round(largeur / 0.065)));
      for (let i = 0; i < n; i++) box(0.025, haut, epaisseur, -largeur / 2 + 0.0125 + (largeur - 0.025) * i / (n - 1), y, z, m.bois, 0.005);
    } else {
      const o = box(largeur, haut, epaisseur, 0, y, z, mat, p.id.includes('cocoon') ? 0.09 : s.rayon);
      if (incline) {
        const angle = -0.19;
        o.rotation.x = angle;
        o.position.y = h - haut / 2 * Math.cos(angle) - epaisseur / 2 * Math.abs(Math.sin(angle));
        o.position.z = -d / 2 + haut / 2 * Math.abs(Math.sin(angle)) + epaisseur / 2 * Math.cos(angle);
      }
    }
    if (p.variante === 'classique' || p.id.includes('chesterfield')) capitons(largeur * 0.85, haut * 0.7, y + haut * 0.12, z + epaisseur / 2 + 0.004);
  }
  if (type === 'canape' || type === 'fauteuil' || type === 'longue') {
    const japonais = p.id.includes('japonais') || p.id.includes('futon');
    const sol = japonais ? 0.06 : Math.min(0.16, h * (p.variante === 'japandi' ? 0.13 : 0.18));
    const assiseY = japonais ? h * 0.28 : Math.min(0.43, h * 0.48), ep = Math.min(0.15, h * 0.17);
    const bras = type === 'longue' || p.id.includes('chauffeuse') || p.id.includes('futon') ? 0 : Math.min(0.16, w * (type === 'canape' ? 0.08 : 0.14));
    const angle = p.cote || 0, profond = angle ? Math.min(d * 0.58, 0.95) : d;
    const zAssise = -d / 2 + profond / 2;
    const courbe=p.id.includes('arrondi')||p.id.includes('cocoon');
    const piedsD = type === 'longue' ? d * 0.9 : d * 0.88;
    if(angle){
      const debut=a.g.children.length;pieds(w*.91,profond*.88,sol);for(const o of a.g.children.slice(debut))o.position.z+=zAssise;
      const largeurModule=(w-bras*2)/(p.places||3),centre=angle*(w/2-bras-largeurModule/2);
      for(const x of [centre-largeurModule*.3,centre+largeurModule*.3])cyl(.014,.02,sol,x,0,d/2-.05,p.variante==='industriel'||p.variante==='contemporain'?m.metal:m.bois,12);
    }else pieds(w*(courbe?.62:.91),courbe?d*.62:piedsD,sol);
    if(courbe){const base=cyl(w/2,w/2,Math.max(.04,assiseY-sol),0,sol,zAssise,p.variante==='japandi'?m.bois:tissu,32);base.scale.z=profond/w;}
    else box(w, Math.max(0.04, assiseY - sol), profond, 0, sol, zAssise, p.variante === 'japandi' || p.variante === 'boheme' ? m.bois : tissu, s.rayon);
    const n = p.modules ? Math.max(2, Math.min(8, Math.round(p.modules))) : p.places || (type === 'canape' ? 3 : 1);
    if (p.id.includes('arrondi') || p.id.includes('cocoon')) {
      const o = cyl(w / 2, w / 2, ep, 0, assiseY, zAssise, tissu, 32); o.scale.z = profond / w;
    } else for (let i = 0; i < n; i++) box((w - bras * 2) / n - 0.012, ep, profond - Math.min(0.13, d * 0.15), -w / 2 + bras + (i + 0.5) * (w - bras * 2) / n, assiseY + 0.004, zAssise + 0.045, tissu, p.variante === 'contemporain' ? 0.045 : 0.018);
    if (angle) {
      const largeur = (w - bras * 2) / n, x = angle * (w / 2 - bras - largeur / 2);
      box(largeur, assiseY - sol, d - profond, x, sol, profond / 2, tissu, s.rayon);
      box(largeur - 0.012, ep, d - profond - 0.006, x, assiseY + 0.004, profond / 2, tissu, 0.025);
    }
    const hautDossier = h - assiseY - ep;
    const zDossier = -d / 2 + 0.06;
    if(courbe){
      const points=[],epaisseur=Math.min(.16,w*.14)+s.rayon;
      for(let i=0;i<=32;i++){const angle=Math.PI+i/32*Math.PI;points.push([Math.cos(angle)*w/2,-Math.sin(angle)*d/2]);}
      for(let i=32;i>=0;i--){const angle=Math.PI+i/32*Math.PI;points.push([Math.cos(angle)*(w/2-epaisseur),-Math.sin(angle)*(d/2-epaisseur)]);}
      const forme=new THREE.Shape(points.map(p=>new THREE.Vector2(...p))),geo=new THREE.ExtrudeGeometry(forme,{depth:hautDossier,bevelEnabled:false});geo.rotateX(-Math.PI/2);mesh(geo,p.variante==='boheme'?m.facade:tissu,0,assiseY+ep,0);
    } else dossier(w - bras * 2, assiseY + ep, hautDossier, zDossier, 0.12, p.id.includes('rotin') ? m.facade : tissu, p.id.includes('lounge') || type === 'longue');
    if (bras&&!courbe) for (const cote of [-1, 1]) {
      if (p.id.includes('meridienne') && cote === 1) continue;
      const x = cote * (w / 2 - bras / 2), accH = Math.min(h - 0.04, assiseY + ep + 0.18);
      if (p.id.includes('chesterfield')) {
        const o = cyl(bras / 2, bras / 2, profond - 0.01, x, 0, 0, tissu, 16); o.rotation.x = Math.PI / 2; o.position.set(x, h - bras / 2, zAssise);
        box(bras, h - bras / 2 - sol, profond - 0.015, x, sol, zAssise, tissu, 0.018);
      } else if (p.variante === 'industriel' || p.variante === 'japandi' || p.id.includes('rotin')) {
        for (const z of [-d / 2 + 0.06, -d / 2 + profond - 0.05]) box(Math.min(0.035, bras), accH - assiseY, 0.035, x, assiseY, z, p.variante === 'industriel' ? m.metal : m.bois);
        box(bras, 0.035, profond - 0.012, x, accH - 0.035, zAssise, p.variante === 'industriel' ? m.metal : m.bois, 0.01);
      } else box(bras, accH - sol, profond - 0.012, x, sol, zAssise, tissu, p.id.includes('club') ? 0.055 : s.rayon);
    }
    if (p.id.includes('oreilles') || p.id.includes('bergere')) for (const cote of [-1, 1]) box(0.08, hautDossier * 0.58, Math.min(0.26, d * 0.35), cote * (w / 2 - bras - 0.015), h - hautDossier * 0.58, -d / 2 + 0.14, tissu, 0.025);
    if (p.id.includes('convertible')) box(w * 0.6, 0.012, 0.012, 0, assiseY - 0.02, d / 2 - 0.007, m.metal, 0.004);
    if (p.id.includes('bascule')) for (const x of [-w * 0.34, w * 0.34]) tube([[x, 0.035, -d / 2 + 0.02], [x, 0.005, 0], [x, 0.035, d / 2 - 0.02]], 0.014, m.bois);
    if (p.id.includes('pivotant')) cyl(Math.min(w, d) * 0.28, Math.min(w, d) * 0.32, 0.035, 0, 0, 0, m.metal, 24);
  } else if (type === 'chaise' || type === 'tabouret' || type === 'bureau') {
    const tabouret = type === 'tabouret', reglable = p.id.includes('reglable') || type === 'bureau';
    const assise = tabouret ? h - Math.min(0.14, h * 0.16) : type === 'bureau' ? h * 0.43 : h * (p.id.includes('haute') ? 0.65 : 0.52);
    const ep = Math.min(0.07, h * 0.09);
    const boisNu = p.id.includes('bois') || p.id.includes('windsor') || p.id.includes('bistrot');
    const materiauAssise = boisNu ? m.bois : p.id.includes('metal') ? m.metal : tissu;
    if (reglable) {
      const base = cyl(w / 2, w / 2, 0.025, 0, 0, 0, m.metal, 24); base.scale.z = d / w;
      cyl(0.022, 0.035, assise - 0.025, 0, 0.025, 0, m.chrome);
      if (type === 'bureau') for (let i = 0; i < 5; i++) { const angle = i / 5 * TOUR; barre([0, 0.04, 0], [Math.cos(angle) * (w / 2 - 0.03), 0.04, Math.sin(angle) * (d / 2 - 0.03)], 0.014, m.metal); }
    } else pieds(w, d, assise, 0, p.id.includes('metal') ? 'cadre' : s.pied);
    if (tabouret && reglable && (p.variante === 'classique' || p.variante === 'industriel')) box(w,h-assise,d,0,assise,0,materiauAssise,p.variante==='classique'?0.045:0.004);
    else if (tabouret && (p.id.includes('rond') || reglable || p.variante === 'boheme')) { const o = cyl(w / 2, w / 2, h - assise, 0, assise, 0, materiauAssise, p.variante==='artdeco'?16:p.variante==='japandi'?32:24); o.scale.z = d / w; if(p.variante==='boheme') { const rebord=cyl(w*.48,w*.5,0.025,0,h-.025,0,m.facade,24);rebord.scale.z=d/w; } }
    else box(w, tabouret ? h - assise : ep, d, 0, assise, 0, materiauAssise, p.variante === 'contemporain' ? 0.035 : 0.012);
    if (!tabouret) {
      const dosY = assise + ep + 0.04, haut = h - dosY;
      if (p.id.includes('windsor')) {
        for (let i = 0; i < 7; i++) barre([-w * 0.4 + i * w * 0.8 / 6, dosY, -d * 0.37], [-w * 0.43 + i * w * 0.86 / 6, h - 0.025, -d / 2 + 0.025], 0.009, m.bois);
        box(w, 0.035, 0.04, 0, h - 0.035, -d / 2 + 0.02, m.bois, 0.015);
      } else if (p.id.includes('bistrot')) {
        tube([[-w * 0.42, dosY, -d / 2 + 0.025], [-w * 0.4, h - 0.06, -d / 2 + 0.025], [0, h - 0.014, -d / 2 + 0.025], [w * 0.4, h - 0.06, -d / 2 + 0.025], [w * 0.42, dosY, -d / 2 + 0.025]], 0.012, m.bois);
        box(w * 0.7, 0.045, 0.025, 0, h * 0.77, -d / 2 + 0.025, m.bois, 0.01);
      } else dossier(w * (type === 'bureau' ? 0.8 : 0.93), dosY, haut, -d / 2 + 0.035, 0.07, p.id.includes('cannee') ? m.facade : boisNu ? m.bois : type === 'bureau' && p.variante === 'industriel' ? m.facade : materiauAssise);
      if (p.id.includes('accoudoirs') || type === 'bureau') for (const cote of [-1, 1]) {
        const x = cote * (w / 2 - 0.02), y = assise + ep + 0.16;
        box(0.035, 0.03, d * 0.6, x, y, d * 0.07, boisNu ? m.bois : m.metal, 0.01);
        box(0.025, 0.16, 0.025, x, assise + ep, d * 0.2, m.metal);
      }
    } else if (!reglable) {
      const o = anneau(w * 0.32, d * 0.32, 0.009, 0, assise * 0.35, 0, m.metal); o.rotation.x = Math.PI / 2;
    }
  } else if (type === 'banc' || type === 'pouf') {
    const rond = p.id.includes('rond') || p.id.includes('tresse') || p.variante === 'boheme';
    const matPouf=p.id.includes('tresse')?matiere('cannage',p.cols[1]):tissu;
    const sol = type === 'pouf' ? (p.variante === 'artdeco' ? 0.035 : 0) : Math.min(0.34, h * 0.7);
    if (sol) pieds(w * 0.93, d * 0.88, sol);
    if (rond && type === 'pouf') {
      if(p.variante==='contemporain') ellipsoide(w,h-sol,d,0,sol,0,matPouf);
      else if(p.variante==='classique') { const o=cyl(w/2,w/2,h-sol-0.035,0,sol,0,matPouf,32);o.scale.z=d/w;ellipsoide(w,0.07,d,0,h-.07,0,tissu); }
      else if(p.variante==='japandi') { const base=cyl(w*.47,w*.49,.065,0,0,0,m.bois,24);base.scale.z=d/w; const o=cyl(w/2,w/2,h-.065,0,.065,0,matPouf,32);o.scale.z=d/w; }
      else { const o = cyl(w / 2, w / 2, h - sol, 0, sol, 0, p.id.includes('tresse') ? m.facade : tissu, p.variante==='industriel'?8:32); o.scale.z = d / w; }
    }
    else box(w, p.id.includes('banquette') ? Math.min(.12,h*.15) : h - sol, d, 0, sol, 0, p.id.includes('repas') ? m.bois : tissu, s.rayon + 0.02);
    if (p.variante === 'classique' && !rond) capitons(w * 0.85, Math.max(0.03, h - sol - 0.02), sol, d / 2 - 0.004);
    if (p.id.includes('banquette')) {const y=sol+Math.min(.12,h*.15);dossier(w,y,h-y,-d/2+.04,.08,tissu);}
  }
}
