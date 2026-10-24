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
    "id": "meuble-tv-bas",
    "nom": "Meuble TV bas",
    "type": "meuble",
    "fam": "meuble",
    "pose": "sol",
    "dim": [
      1.6,
      0.42,
      0.48
    ],
    "dimMin": [
      1.12,
      0.294,
      0.36
    ],
    "dimMax": [
      2.56,
      0.63,
      0.648
    ],
    "usage": "meuble-tv"
  },
  {
    "id": "meuble-tv-suspendu",
    "nom": "Meuble TV suspendu",
    "type": "meuble",
    "fam": "meuble",
    "pose": "mur",
    "dim": [
      1.8,
      0.38,
      0.35
    ],
    "dimMin": [
      1.26,
      0.266,
      0.262
    ],
    "dimMax": [
      2.88,
      0.57,
      0.472
    ],
    "usage": "meuble-tv"
  },
  {
    "id": "buffet",
    "nom": "Buffet",
    "type": "buffet",
    "fam": "buffet",
    "pose": "sol",
    "dim": [
      1.5,
      0.45,
      0.85
    ],
    "dimMin": [
      1.05,
      0.315,
      0.637
    ],
    "dimMax": [
      2.4,
      0.675,
      1.147
    ],
    "portes": 2
  },
  {
    "id": "enfilade",
    "nom": "Enfilade",
    "type": "buffet",
    "fam": "buffet",
    "pose": "sol",
    "dim": [
      2,
      0.45,
      0.76
    ],
    "dimMin": [
      1.4,
      0.315,
      0.57
    ],
    "dimMax": [
      3.2,
      0.675,
      1.026
    ],
    "portes": 3
  },
  {
    "id": "vaisselier",
    "nom": "Vaisselier",
    "type": "buffet",
    "fam": "buffet",
    "pose": "sol",
    "dim": [
      1.2,
      0.42,
      1.85
    ],
    "dimMin": [
      0.84,
      0.294,
      1.388
    ],
    "dimMax": [
      1.92,
      0.63,
      2.498
    ],
    "portes": 2
  },
  {
    "id": "bibliotheque-ouverte",
    "nom": "Bibliothèque ouverte",
    "type": "bibliotheque",
    "fam": "etagere",
    "pose": "sol",
    "dim": [
      1.2,
      0.3,
      1.9
    ],
    "dimMin": [
      0.84,
      0.21,
      1.425
    ],
    "dimMax": [
      1.92,
      0.45,
      2.565
    ]
  },
  {
    "id": "bibliotheque-fermee",
    "nom": "Bibliothèque fermée",
    "type": "bibliotheque",
    "fam": "etagere",
    "pose": "sol",
    "dim": [
      1.2,
      0.34,
      1.9
    ],
    "dimMin": [
      0.84,
      0.238,
      1.425
    ],
    "dimMax": [
      1.92,
      0.51,
      2.565
    ]
  },
  {
    "id": "etagere-murale",
    "nom": "Étagère murale",
    "type": "murale",
    "fam": "etagere-murale",
    "pose": "mur",
    "dim": [
      1.1,
      0.25,
      0.24
    ],
    "dimMin": [
      0.77,
      0.175,
      0.18
    ],
    "dimMax": [
      1.76,
      0.375,
      0.324
    ]
  },
  {
    "id": "etagere-modulaire",
    "nom": "Étagère modulaire",
    "type": "etagere",
    "fam": "etagere",
    "pose": "sol",
    "dim": [
      1.6,
      0.32,
      1.6
    ],
    "dimMin": [
      1.12,
      0.224,
      1.2
    ],
    "dimMax": [
      2.56,
      0.48,
      2.16
    ]
  },
  {
    "id": "echelle-etageres",
    "nom": "Échelle à étagères",
    "type": "echelle",
    "fam": "etagere",
    "pose": "sol",
    "dim": [
      0.6,
      0.4,
      1.75
    ],
    "dimMin": [
      0.42,
      0.28,
      1.312
    ],
    "dimMax": [
      0.96,
      0.6,
      2.363
    ]
  },
  {
    "id": "commode",
    "nom": "Commode",
    "type": "commode",
    "fam": "commode",
    "pose": "sol",
    "dim": [
      0.9,
      0.45,
      0.85
    ],
    "dimMin": [
      0.63,
      0.315,
      0.637
    ],
    "dimMax": [
      1.44,
      0.675,
      1.147
    ],
    "tiroirs": 3
  },
  {
    "id": "chiffonnier",
    "nom": "Chiffonnier",
    "type": "commode",
    "fam": "commode",
    "pose": "sol",
    "dim": [
      0.45,
      0.4,
      1.25
    ],
    "dimMin": [
      0.315,
      0.28,
      0.938
    ],
    "dimMax": [
      0.72,
      0.6,
      1.688
    ],
    "tiroirs": 5
  },
  {
    "id": "armoire-1-portes",
    "nom": "Armoire 1 porte",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      0.55,
      0.6,
      2.05
    ],
    "dimMin": [
      0.385,
      0.42,
      1.537
    ],
    "dimMax": [
      0.88,
      0.9,
      2.768
    ],
    "portes": 1
  },
  {
    "id": "armoire-1-portes-miroir",
    "nom": "Armoire 1 porte avec miroir",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      0.55,
      0.6,
      2.05
    ],
    "dimMin": [
      0.385,
      0.42,
      1.537
    ],
    "dimMax": [
      0.88,
      0.9,
      2.768
    ],
    "portes": 1,
    "miroir": true
  },
  {
    "id": "armoire-2-portes",
    "nom": "Armoire 2 portes",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      1.0,
      0.6,
      2.05
    ],
    "dimMin": [
      0.7,
      0.42,
      1.537
    ],
    "dimMax": [
      1.6,
      0.9,
      2.768
    ],
    "portes": 2
  },
  {
    "id": "armoire-2-portes-miroir",
    "nom": "Armoire 2 portes avec miroir",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      1.0,
      0.6,
      2.05
    ],
    "dimMin": [
      0.7,
      0.42,
      1.537
    ],
    "dimMax": [
      1.6,
      0.9,
      2.768
    ],
    "portes": 2,
    "miroir": true
  },
  {
    "id": "armoire-3-portes",
    "nom": "Armoire 3 portes",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      1.5,
      0.6,
      2.05
    ],
    "dimMin": [
      1.05,
      0.42,
      1.537
    ],
    "dimMax": [
      2.4,
      0.9,
      2.768
    ],
    "portes": 3
  },
  {
    "id": "armoire-3-portes-miroir",
    "nom": "Armoire 3 portes avec miroir",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      1.5,
      0.6,
      2.05
    ],
    "dimMin": [
      1.05,
      0.42,
      1.537
    ],
    "dimMax": [
      2.4,
      0.9,
      2.768
    ],
    "portes": 3,
    "miroir": true
  },
  {
    "id": "armoire-4-portes",
    "nom": "Armoire 4 portes",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      2.0,
      0.6,
      2.05
    ],
    "dimMin": [
      1.4,
      0.42,
      1.537
    ],
    "dimMax": [
      3.2,
      0.9,
      2.768
    ],
    "portes": 4
  },
  {
    "id": "armoire-4-portes-miroir",
    "nom": "Armoire 4 portes avec miroir",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      2.0,
      0.6,
      2.05
    ],
    "dimMin": [
      1.4,
      0.42,
      1.537
    ],
    "dimMax": [
      3.2,
      0.9,
      2.768
    ],
    "portes": 4,
    "miroir": true
  },
  {
    "id": "armoire-coulissante-1",
    "nom": "Armoire coulissante 1 porte",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      0.6,
      0.65,
      2.1
    ],
    "dimMin": [
      0.42,
      0.455,
      1.575
    ],
    "dimMax": [
      0.96,
      0.975,
      2.835
    ],
    "portes": 1,
    "coulissant": true
  },
  {
    "id": "armoire-coulissante-1-miroir",
    "nom": "Armoire coulissante 1 porte avec miroir",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      0.6,
      0.65,
      2.1
    ],
    "dimMin": [
      0.42,
      0.455,
      1.575
    ],
    "dimMax": [
      0.96,
      0.975,
      2.835
    ],
    "portes": 1,
    "coulissant": true,
    "miroir": true
  },
  {
    "id": "armoire-coulissante-2",
    "nom": "Armoire coulissante 2 portes",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      1.2,
      0.65,
      2.1
    ],
    "dimMin": [
      0.84,
      0.455,
      1.575
    ],
    "dimMax": [
      1.92,
      0.975,
      2.835
    ],
    "portes": 2,
    "coulissant": true
  },
  {
    "id": "armoire-coulissante-2-miroir",
    "nom": "Armoire coulissante 2 portes avec miroir",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      1.2,
      0.65,
      2.1
    ],
    "dimMin": [
      0.84,
      0.455,
      1.575
    ],
    "dimMax": [
      1.92,
      0.975,
      2.835
    ],
    "portes": 2,
    "coulissant": true,
    "miroir": true
  },
  {
    "id": "armoire-coulissante-3",
    "nom": "Armoire coulissante 3 portes",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      1.7999999999999998,
      0.65,
      2.1
    ],
    "dimMin": [
      1.26,
      0.455,
      1.575
    ],
    "dimMax": [
      2.88,
      0.975,
      2.835
    ],
    "portes": 3,
    "coulissant": true
  },
  {
    "id": "armoire-coulissante-3-miroir",
    "nom": "Armoire coulissante 3 portes avec miroir",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      1.7999999999999998,
      0.65,
      2.1
    ],
    "dimMin": [
      1.26,
      0.455,
      1.575
    ],
    "dimMax": [
      2.88,
      0.975,
      2.835
    ],
    "portes": 3,
    "coulissant": true,
    "miroir": true
  },
  {
    "id": "armoire-coulissante-4",
    "nom": "Armoire coulissante 4 portes",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      2.4,
      0.65,
      2.1
    ],
    "dimMin": [
      1.68,
      0.455,
      1.575
    ],
    "dimMax": [
      3.84,
      0.975,
      2.835
    ],
    "portes": 4,
    "coulissant": true
  },
  {
    "id": "armoire-coulissante-4-miroir",
    "nom": "Armoire coulissante 4 portes avec miroir",
    "type": "armoire",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      2.4,
      0.65,
      2.1
    ],
    "dimMin": [
      1.68,
      0.455,
      1.575
    ],
    "dimMax": [
      3.84,
      0.975,
      2.835
    ],
    "portes": 4,
    "coulissant": true,
    "miroir": true
  },
  {
    "id": "dressing-ouvert",
    "nom": "Dressing ouvert",
    "type": "dressing",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      1.5,
      0.6,
      2.1
    ],
    "dimMin": [
      1.05,
      0.42,
      1.575
    ],
    "dimMax": [
      2.4,
      0.9,
      2.835
    ]
  },
  {
    "id": "vitrine",
    "nom": "Vitrine",
    "type": "vitrine",
    "fam": "armoire",
    "pose": "sol",
    "dim": [
      0.8,
      0.4,
      1.8
    ],
    "dimMin": [
      0.56,
      0.28,
      1.35
    ],
    "dimMax": [
      1.28,
      0.6,
      2.43
    ],
    "portes": 2
  },
  {
    "id": "bar",
    "nom": "Meuble bar",
    "type": "bar",
    "fam": "buffet",
    "pose": "sol",
    "dim": [
      1.2,
      0.5,
      1.05
    ],
    "dimMin": [
      0.84,
      0.35,
      0.788
    ],
    "dimMax": [
      1.92,
      0.75,
      1.418
    ]
  },
  {
    "id": "chariot-bar",
    "nom": "Chariot de bar",
    "type": "chariot",
    "fam": "meuble",
    "pose": "sol",
    "dim": [
      0.75,
      0.42,
      0.8
    ],
    "dimMin": [
      0.525,
      0.294,
      0.6
    ],
    "dimMax": [
      1.2,
      0.63,
      1.08
    ]
  },
  {
    "id": "desserte",
    "nom": "Desserte",
    "type": "chariot",
    "fam": "meuble",
    "pose": "sol",
    "dim": [
      0.65,
      0.42,
      0.85
    ],
    "dimMin": [
      0.455,
      0.294,
      0.637
    ],
    "dimMax": [
      1.04,
      0.63,
      1.147
    ]
  },
  {
    "id": "coffre",
    "nom": "Coffre",
    "type": "coffre",
    "fam": "meuble",
    "pose": "sol",
    "dim": [
      0.9,
      0.45,
      0.48
    ],
    "dimMin": [
      0.63,
      0.315,
      0.36
    ],
    "dimMax": [
      1.44,
      0.675,
      0.648
    ]
  },
  {
    "id": "meuble-entree",
    "nom": "Meuble d’entrée",
    "type": "entree",
    "fam": "meuble",
    "pose": "sol",
    "dim": [
      1,
      0.36,
      1.85
    ],
    "dimMin": [
      0.7,
      0.252,
      1.388
    ],
    "dimMax": [
      1.6,
      0.54,
      2.498
    ]
  },
  {
    "id": "rangement-chaussures",
    "nom": "Rangement à chaussures",
    "type": "commode",
    "fam": "meuble",
    "pose": "sol",
    "dim": [
      0.8,
      0.3,
      1
    ],
    "dimMin": [
      0.56,
      0.21,
      0.75
    ],
    "dimMax": [
      1.28,
      0.45,
      1.35
    ],
    "tiroirs": 3
  },
  {
    "id": "portemanteau-pied",
    "nom": "Portemanteau sur pied",
    "type": "portemanteau",
    "fam": "meuble",
    "pose": "sol",
    "dim": [
      0.5,
      0.5,
      1.75
    ],
    "dimMin": [
      0.35,
      0.35,
      1.312
    ],
    "dimMax": [
      0.8,
      0.75,
      2.363
    ]
  },
  {
    "id": "portemanteau-mural",
    "nom": "Portemanteau mural",
    "type": "portemanteau",
    "fam": "meuble",
    "pose": "mur",
    "dim": [
      0.7,
      0.12,
      0.18
    ],
    "dimMin": [
      0.49,
      0.084,
      0.135
    ],
    "dimMax": [
      1.12,
      0.18,
      0.243
    ]
  },
  {
    "id": "cache-radiateur",
    "nom": "Cache-radiateur",
    "type": "cache-radiateur",
    "fam": "meuble",
    "pose": "sol",
    "dim": [
      1.2,
      0.25,
      0.86
    ],
    "dimMin": [
      0.84,
      0.175,
      0.645
    ],
    "dimMax": [
      1.92,
      0.375,
      1.161
    ]
  },
  {
    "id": "paravent",
    "nom": "Paravent",
    "type": "paravent",
    "fam": "meuble",
    "pose": "sol",
    "dim": [
      1.5,
      0.35,
      1.75
    ],
    "dimMin": [
      1.05,
      0.245,
      1.312
    ],
    "dimMax": [
      2.4,
      0.525,
      2.363
    ]
  }
];

export const ELEMENTS = figer(Object.fromEntries(DONNEES.map(d => { const f = definirFiche(d); return [f.id, f]; })));

function dessiner(a) {
  const { p, g, w, d, h, s, m, box, cyl, barre, tube, instances, pieds, facade, poignee, hasard } = a;
  const type = p.type;
  function carcasse(largeur, profondeur, hauteur, x = 0, y = 0, z = 0, ouverte = false) {
    const ep = 0.018;
    for (const dx of [-largeur / 2 + ep / 2, largeur / 2 - ep / 2]) box(ep, hauteur, profondeur, x + dx, y, z, ouverte ? m.metal : m.bois);
    for (const dy of [0, hauteur - ep]) box(largeur, ep, profondeur, x, y + dy, z, m.bois);
    if (!ouverte) box(largeur - ep * 2, hauteur - ep * 2, 0.012, x, y + ep, z - profondeur / 2 + 0.006, m.bois);
  }
  function livres(y, largeur = w - 0.1, profondeur = d * 0.7, hauteur = 0.25) {
    const n = Math.min(55, Math.max(2, Math.floor(largeur / 0.065))), poses = [];
    for (let i = 0; i < n; i++) {
      if (hasard() < 0.22) continue;
      const hh = hauteur * (0.65 + hasard() * 0.35);
      poses.push({ position: [-largeur / 2 + (i + 0.5) * largeur / n, y + hh / 2, d / 2 - profondeur / 2 - 0.035], echelle: [0.028 + hasard() * 0.022, hh, profondeur] });
    }
    instances(new THREE.BoxGeometry(1, 1, 1), m.principal, poses, ['#C4B294', '#7C8B74', '#637883', '#9D795E', '#D4CCB9']);
  }
  function devant(y, hauteur, nombre, tiroirs = false, vitre = false) {
    const largeur = tiroirs ? w : w / nombre;
    for (let i = 0; i < nombre; i++) {
      const x = tiroirs ? 0 : -w / 2 + (i + 0.5) * largeur;
      const yy = tiroirs ? y + i * hauteur / nombre : y;
      const hh = tiroirs ? hauteur / nombre : hauteur;
      if (vitre || (p.miroir && i === nombre - 1)) {
        box(largeur - 0.012, hh - 0.008, 0.008, x, yy + 0.004, d / 2 - 0.024, p.miroir ? matiere('miroir') : m.verre, 0.003);
        for (const dx of [-largeur / 2 + 0.018, largeur / 2 - 0.018]) box(0.025, hh - 0.006, 0.02, x + dx, yy + 0.003, d / 2 - 0.012, m.bois);
        for (const dy of [0.003, hh - 0.028]) box(largeur - 0.025, 0.025, 0.02, x, yy + dy, d / 2 - 0.012, m.bois);
      } else facade(largeur - 0.008, hh - 0.008, x, yy + 0.004, d / 2 - (p.coulissant && i % 2 ? 0.05 : 0.034));
      poignee(x + (tiroirs ? 0 : largeur * 0.32), yy + hh * (tiroirs ? 0.72 : 0.54), d / 2 - 0.008, !tiroirs, Math.min(0.12, hh * 0.25));
    }
  }
  if (type === 'meuble' || type === 'armoire' || type === 'commode' || type === 'buffet' || type === 'vitrine') {
    const bas = p.pose === 'mur' ? 0 : p.variante === 'classique' ? 0.11 : p.variante === 'japandi' ? 0.13 : 0.06;
    if (bas) pieds(w * 0.94, d * 0.9, bas);
    carcasse(w, d, h - bas, 0, bas);
    if (p.id.includes('vaisselier')) {
      devant(bas + 0.005, (h - bas) * 0.4, p.portes || 2);
      devant(bas + (h - bas) * 0.42, (h - bas) * 0.57, p.portes || 2, false, true);
      for (let i = 1; i < 3; i++) box(w - 0.04, 0.014, d - 0.05, 0, h * (0.47 + i * 0.16), -0.008, m.bois);
    } else if (type === 'vitrine') {
      devant(bas + 0.004, h - bas - 0.008, p.portes || 2, false, true);
      for (let i = 1; i < 4; i++) box(w - 0.04, 0.008, d - 0.05, 0, bas + i * (h - bas) / 4, -0.01, m.verre, 0.002);
    } else if (p.id.includes('tv')) {
      const largeur = w * 0.27;
      for (const x of [-w / 2 + largeur / 2, w / 2 - largeur / 2]) { facade(largeur - 0.008, h - bas - 0.035, x, bas + 0.015, d / 2 - 0.034); poignee(x, h * 0.62, d / 2 - 0.008); }
      box(w * 0.42, 0.018, d - 0.03, 0, bas + (h - bas) * 0.48, -0.006, m.bois);
      box(w * 0.23, 0.045, d * 0.55, 0, bas + 0.027, 0, m.noir, 0.005);
    } else if (type === 'commode') devant(bas + 0.005, h - bas - 0.01, p.tiroirs || 3, true);
    else devant(bas + 0.005, h - bas - 0.01, p.portes || Math.max(1, Math.ceil(w / 0.6)));
  } else if (type === 'bibliotheque' || type === 'etagere' || type === 'dressing') {
    const ouverte = p.id.includes('ouverte') || p.id.includes('modulaire') || type === 'etagere';
    carcasse(w, d, h, 0, 0, 0, ouverte && p.variante === 'industriel');
    const niveaux = Math.max(2, Math.min(8, Math.round(h / 0.37))), colonnes = Math.max(1, Math.ceil(w / 0.8));
    if(type!=='dressing'){
      for (let j = 1; j < niveaux; j++) box(w - 0.036, 0.018, d - 0.02, 0, j * h / niveaux, 0.005, m.bois);
      for (let i = 1; i < colonnes; i++) box(0.018, h, d - 0.02, -w / 2 + i * w / colonnes, 0, 0.005, p.variante === 'industriel' ? m.metal : m.bois);
    }else{box(.018,h,d-.02,w*.16,0,.005,m.bois);for(let i=1;i<5;i++)box(w*.32-.02,.018,d-.03,w*.33,i*h/5,0,m.bois);for(const y of [h*.18,h*.86])box(w*.65-.025,.018,d-.03,-w*.17,y,0,m.bois);}
    if(p.variante==='japandi')box(w-.04,.028,d-.04,0,h*.22,0,m.bois,0.008);
    if(p.variante==='boheme')box(w-.05,h*.24,.012,0,h*.67,-d/2+.025,m.facade,0.025);
    if(p.variante==='artdeco')for(const x of [-w*.28,w*.28])box(.014,h-.04,.014,x,.02,d/2-.009,m.metal,0.004);
    if (type === 'bibliotheque') for (let j = 0; j < niveaux; j++) livres(j * h / niveaux + 0.022, w - 0.09, Math.min(d * 0.7, 0.22), Math.min(0.28, h / niveaux - 0.04));
    if (p.id.includes('fermee')) devant(0.004, h * 0.35, Math.max(1, Math.ceil(w / 0.55)));
    if (type === 'dressing') {
      barre([-w / 2 + 0.04, h * 0.78, 0], [w*.16-0.04, h * 0.78, 0], 0.013, m.metal);
      const n=Math.min(12,Math.max(3,Math.floor(w*.65/.12))),largeur=Math.min(.4,d*.7),vetH=Math.min(.9,h*.43);
      for (let i = 0; i < n; i++) { const x = -w / 2 + 0.06 + i * (w*.65-.12)/(n-1);const o=a.profil([[-largeur/2,0],[largeur/2,0],[largeur*.4,vetH*.72],[largeur*.18,vetH],[-largeur*.18,vetH],[-largeur*.4,vetH*.72]],.025,x,h*.76-vetH,0,i%2?m.tissu:m.principal);o.rotation.y=Math.PI/2; }
    }
  } else if (type === 'murale') {
    const ep = 0.022;
    box(w, ep, d, 0, h - ep, 0, m.bois, s.rayon * 0.35);
    for (const x of [-w * 0.33, w * 0.33]) {
      box(0.025, h - ep, 0.02, x, 0, -d / 2 + 0.01, m.metal, 0.003);
      if (p.variante === 'classique' || p.variante === 'industriel') barre([x, 0.02, -d / 2 + 0.018], [x, h - 0.04, d / 2 - 0.025], 0.01, m.metal);
      else box(0.025, 0.018, d - 0.02, x, h - ep - 0.021, 0, m.metal);
    }
  } else if (type === 'echelle') {
    for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) { barre([x, 0.018, d / 2 - 0.02], [x, h - 0.018, -d / 2 + 0.02], 0.018, m.bois); box(0.036, 0.025, 0.036, x, 0, d / 2 - 0.02, m.bois); }
    box(w, 0.025, Math.min(0.06, d * 0.2), 0, h - 0.025, -d / 2 + Math.min(0.03, d * 0.1), m.bois);
    if(p.variante==='boheme')box(w-.08,.2,.012,0,h-.25,-d/2+.035,m.facade,0.025);
    const n = Math.max(3, Math.round(h / 0.38));
    for (let i = 0; i < n; i++) {
      const profondeur = d * (1 - i / n * 0.65);
      box(w, 0.022, profondeur, 0, 0.08 + i * (h - 0.18) / (n - 1), -d / 2 + profondeur / 2, m.bois);
    }
  } else if (type === 'chariot' || type === 'bar') {
    const roulette = type === 'chariot' ? 0.06 : 0;
    for (const y of [roulette, h - 0.025]) box(w, 0.025, d, 0, y, 0, p.variante === 'artdeco' ? matiere('marbre', '#DACEB6') : m.bois, 0.01);
    for (const x of [-w / 2 + 0.018, w / 2 - 0.018]) for (const z of [-d / 2 + 0.018, d / 2 - 0.018]) {
      cyl(0.012, 0.012, h - roulette - 0.025, x, roulette, z, m.metal, 12);
      if (roulette) { const o = cyl(0.022, 0.022, 0.022, Math.sign(x) * (w / 2 - 0.024), 0.03, Math.sign(z) * (d / 2 - 0.024), m.noir, 12); o.rotation.x = Math.PI / 2; o.position.y = 0.022; }
    }
    box(w - 0.04, 0.018, d - 0.04, 0, h * 0.42, 0, m.bois);
    if(type==='chariot'&&p.variante==='japandi')for(const x of [-w/2+.02,w/2-.02])box(.018,.15,d*.72,x,h-.21,0,m.bois,0.008);
    if(type==='chariot'&&p.variante==='boheme')for(const z of [-d/2+.025,d/2-.025])box(w*.78,.12,.012,0,h-.18,z,m.facade,.025);
    if (type === 'bar') facade(w - 0.02, h * 0.64, 0, 0.025, d / 2 - 0.034);
    else for (const z of [-d / 2 + 0.012, d / 2 - 0.012]) box(w - 0.035, 0.025, 0.014, 0, h - 0.065, z, m.metal);
  } else if (type === 'coffre') {
    carcasse(w, d, h);
    facade(w - 0.012, h - 0.05, 0, 0.01, d / 2 - 0.032);
    box(w, 0.035, d, 0, h - 0.035, 0, m.bois, 0.008);
    poignee(0, h * 0.66, d / 2 - 0.008);
  } else if (type === 'entree') {
    const bas = Math.min(0.48, h * 0.32);
    carcasse(w, d, bas);
    devant(0.005, bas - 0.01, Math.max(1, Math.ceil(w / 0.5)));
    box(w, h - bas, 0.025, 0, bas, -d / 2 + 0.0125, m.bois);
    const miroirW = w * 0.45, miroirH = h - bas - 0.12;
    box(miroirW, miroirH, 0.005, -w * 0.23, bas + 0.06, -d / 2 + 0.031, matiere('miroir'), 0.025);
    for (let i = 0; i < 3; i++) tube([[w * 0.25, h * (0.57 + i * 0.12), -d / 2 + 0.03], [w * 0.25, h * (0.57 + i * 0.12), -d / 2 + 0.09], [w * 0.25, h * (0.57 + i * 0.12) + 0.03, -d / 2 + 0.1]], 0.009, m.metal);
  } else if (type === 'portemanteau') {
    if (p.pose === 'mur') {
      box(w, h, 0.022, 0, 0, -d / 2 + 0.011, m.bois, 0.009);
      const n = {contemporain:4,classique:3,japandi:5,industriel:6,boheme:2,artdeco:7}[p.variante];
      for (let i = 0; i < n; i++) tube([[-w / 2 + 0.05 + i * (w - 0.1) / (n - 1), h * 0.25, -d / 2 + 0.025], [-w / 2 + 0.05 + i * (w - 0.1) / (n - 1), h * 0.2, d / 2 - 0.02], [-w / 2 + 0.05 + i * (w - 0.1) / (n - 1), h - 0.01, d / 2 - 0.012]], 0.01, m.metal);
    } else {
      const base = cyl(w / 2, w / 2, 0.035, 0, 0, 0, m.bois, 24); base.scale.z = d / w;
      if(p.variante==='classique')a.revolution([[.035,0],[.027,h*.3],[.045,h*.62],[.018,h-.035]],0,.035,0,m.bois);else cyl(0.025, 0.04, h - 0.035, 0, 0.035, 0, m.bois, 16);
      const n={contemporain:6,classique:5,japandi:3,industriel:4,boheme:7,artdeco:8}[p.variante];
      for (let i = 0; i < n; i++) { const angle = i / n * TOUR, rayon = Math.min(w, d) * 0.38; tube([[0, h * 0.72, 0], [Math.cos(angle) * rayon, h * 0.82, Math.sin(angle) * rayon], [Math.cos(angle) * rayon, h * 0.92, Math.sin(angle) * rayon]], 0.012, p.variante === 'industriel' ? m.metal : m.bois); }
    }
  } else if (type === 'cache-radiateur') {
    carcasse(w, d, h, 0, 0, 0, true);
    const n = Math.max(3, Math.floor(w / (p.variante==='japandi'?0.065:p.variante==='artdeco'?0.028:0.04)));
    for (let i = 0; i < n; i++) box(0.018, h - 0.045, 0.018, -w / 2 + 0.03 + i * (w - 0.06) / (n - 1), 0.022, d / 2 - 0.012, p.variante === 'boheme' ? m.facade : m.bois, 0.003);
  } else if (type === 'paravent') {
    const n = 3, ep = 0.02, cellule = w / n;
    let bas = 0, haut = 1.4;
    for (let i = 0; i < 35; i++) { const angle = (bas + haut) / 2, largeur = (cellule - ep * Math.sin(angle)) / Math.cos(angle), profondeur = largeur * Math.sin(angle) + ep * Math.cos(angle); if (profondeur < d) bas = angle; else haut = angle; }
    const angle = (bas + haut) / 2, largeur = (cellule - ep * Math.sin(angle)) / Math.cos(angle);
    for (let i = 0; i < n; i++) {
      const debut = g.children.length, rotation = i % 2 ? angle : -angle;
      box(largeur-.048, h-.048, .012, 0, .024, 0, m.facade, p.variante === 'contemporain' ? 0.035 : 0.005);
      for (const x of [-largeur / 2 + 0.012, largeur / 2 - 0.012]) box(0.024, h, ep, x, 0, 0, m.bois);
      for(const y of [0,h-.024])box(largeur,.024,ep,0,y,0,m.bois);
      if(p.variante==='artdeco')for(let j=1;j<4;j++)box(largeur-.055,.009,.004,0,h*j/4,.008,m.metal,0.002);
      for (const o of g.children.slice(debut)) { o.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation); o.position.x += -w / 2 + (i + 0.5) * cellule; o.rotation.y += rotation; }
    }
  }
}
