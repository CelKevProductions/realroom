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
    "id": "table-repas-rectangulaire",
    "nom": "Table de repas rectangulaire",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.8,
      0.9,
      0.75
    ],
    "dimMin": [
      1.26,
      0.63,
      0.562
    ],
    "dimMax": [
      2.88,
      1.35,
      1.013
    ],
    "forme": "rectangle",
    "usage": "table-repas"
  },
  {
    "id": "table-repas-ronde",
    "nom": "Table de repas ronde",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.2,
      1.2,
      0.75
    ],
    "dimMin": [
      0.84,
      0.84,
      0.562
    ],
    "dimMax": [
      1.92,
      1.8,
      1.013
    ],
    "forme": "rond",
    "usage": "table-repas"
  },
  {
    "id": "table-repas-ovale",
    "nom": "Table de repas ovale",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      2,
      1,
      0.75
    ],
    "dimMin": [
      1.4,
      0.7,
      0.562
    ],
    "dimMax": [
      3.2,
      1.5,
      1.013
    ],
    "forme": "ovale",
    "usage": "table-repas"
  },
  {
    "id": "table-repas-carree",
    "nom": "Table de repas carrée",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1,
      1,
      0.75
    ],
    "dimMin": [
      0.7,
      0.7,
      0.562
    ],
    "dimMax": [
      1.6,
      1.5,
      1.013
    ],
    "forme": "rectangle",
    "usage": "table-repas"
  },
  {
    "id": "table-repas-rallonge",
    "nom": "Table à rallonge",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.8,
      0.9,
      0.75
    ],
    "dimMin": [
      1.26,
      0.63,
      0.562
    ],
    "dimMax": [
      2.88,
      1.35,
      1.013
    ],
    "forme": "rectangle",
    "usage": "table-repas"
  },
  {
    "id": "table-repas-pied-central",
    "nom": "Table à pied central",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.2,
      1.2,
      0.75
    ],
    "dimMin": [
      0.84,
      0.84,
      0.562
    ],
    "dimMax": [
      1.92,
      1.8,
      1.013
    ],
    "forme": "rond",
    "usage": "table-repas",
    "central": true
  },
  {
    "id": "table-repas-compas",
    "nom": "Table à pieds en compas",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.8,
      0.9,
      0.75
    ],
    "dimMin": [
      1.26,
      0.63,
      0.562
    ],
    "dimMax": [
      2.88,
      1.35,
      1.013
    ],
    "forme": "rectangle",
    "usage": "table-repas"
  },
  {
    "id": "table-repas-marbre",
    "nom": "Table de repas en marbre",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.8,
      0.9,
      0.75
    ],
    "dimMin": [
      1.26,
      0.63,
      0.562
    ],
    "dimMax": [
      2.88,
      1.35,
      1.013
    ],
    "forme": "ovale",
    "usage": "table-repas"
  },
  {
    "id": "table-ferme",
    "nom": "Table de ferme",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      2,
      0.9,
      0.76
    ],
    "dimMin": [
      1.4,
      0.63,
      0.57
    ],
    "dimMax": [
      3.2,
      1.35,
      1.026
    ],
    "forme": "rectangle",
    "usage": "table-repas"
  },
  {
    "id": "table-basse-rectangulaire",
    "nom": "Table basse rectangulaire",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.1,
      0.6,
      0.38
    ],
    "dimMin": [
      0.77,
      0.42,
      0.285
    ],
    "dimMax": [
      1.76,
      0.9,
      0.513
    ],
    "forme": "rectangle",
    "usage": "table-basse"
  },
  {
    "id": "table-basse-ronde",
    "nom": "Table basse ronde",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      0.85,
      0.85,
      0.38
    ],
    "dimMin": [
      0.595,
      0.595,
      0.285
    ],
    "dimMax": [
      1.36,
      1.275,
      0.513
    ],
    "forme": "rond",
    "usage": "table-basse"
  },
  {
    "id": "table-basse-ovale",
    "nom": "Table basse ovale",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.2,
      0.65,
      0.38
    ],
    "dimMin": [
      0.84,
      0.455,
      0.285
    ],
    "dimMax": [
      1.92,
      0.975,
      0.513
    ],
    "forme": "ovale",
    "usage": "table-basse"
  },
  {
    "id": "tables-gigognes-2",
    "nom": "Tables gigognes par deux",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.1,
      0.7,
      0.42
    ],
    "dimMin": [
      0.77,
      0.49,
      0.315
    ],
    "dimMax": [
      1.76,
      1.05,
      0.567
    ],
    "forme": "rond",
    "usage": "table-basse",
    "nombre": 2
  },
  {
    "id": "tables-gigognes-3",
    "nom": "Tables gigognes par trois",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.25,
      0.8,
      0.45
    ],
    "dimMin": [
      0.875,
      0.56,
      0.338
    ],
    "dimMax": [
      2.0,
      1.2,
      0.608
    ],
    "forme": "rond",
    "usage": "table-basse",
    "nombre": 3
  },
  {
    "id": "table-basse-pierre",
    "nom": "Table basse en pierre",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1,
      0.6,
      0.35
    ],
    "dimMin": [
      0.7,
      0.42,
      0.262
    ],
    "dimMax": [
      1.6,
      0.9,
      0.472
    ],
    "forme": "ovale",
    "usage": "table-basse"
  },
  {
    "id": "table-basse-relevable",
    "nom": "Table basse relevable",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.1,
      0.6,
      0.43
    ],
    "dimMin": [
      0.77,
      0.42,
      0.323
    ],
    "dimMax": [
      1.76,
      0.9,
      0.581
    ],
    "forme": "rectangle",
    "usage": "table-basse"
  },
  {
    "id": "table-basse-verre",
    "nom": "Table basse en verre",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.1,
      0.6,
      0.38
    ],
    "dimMin": [
      0.77,
      0.42,
      0.285
    ],
    "dimMax": [
      1.76,
      0.9,
      0.513
    ],
    "forme": "rectangle",
    "usage": "table-basse"
  },
  {
    "id": "table-appoint",
    "nom": "Table d’appoint",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      0.45,
      0.45,
      0.52
    ],
    "dimMin": [
      0.315,
      0.315,
      0.39
    ],
    "dimMax": [
      0.72,
      0.675,
      0.702
    ],
    "forme": "rond",
    "usage": "table-appoint"
  },
  {
    "id": "gueridon",
    "nom": "Guéridon",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      0.5,
      0.5,
      0.64
    ],
    "dimMin": [
      0.35,
      0.35,
      0.48
    ],
    "dimMax": [
      0.8,
      0.75,
      0.864
    ],
    "forme": "rond",
    "usage": "table-appoint",
    "central": true
  },
  {
    "id": "bout-canape-en-c",
    "nom": "Bout de canapé en C",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      0.4,
      0.32,
      0.58
    ],
    "dimMin": [
      0.28,
      0.224,
      0.435
    ],
    "dimMax": [
      0.64,
      0.48,
      0.783
    ],
    "forme": "rectangle",
    "usage": "table-appoint"
  },
  {
    "id": "bureau-droit",
    "nom": "Bureau droit",
    "type": "bureau",
    "fam": "bureau",
    "pose": "sol",
    "dim": [
      1.3,
      0.65,
      0.75
    ],
    "dimMin": [
      0.91,
      0.455,
      0.562
    ],
    "dimMax": [
      2.08,
      0.975,
      1.013
    ],
    "usage": "bureau"
  },
  {
    "id": "bureau-angle",
    "nom": "Bureau d’angle",
    "type": "bureau",
    "fam": "bureau",
    "pose": "sol",
    "dim": [
      1.6,
      1.2,
      0.75
    ],
    "dimMin": [
      1.12,
      0.84,
      0.562
    ],
    "dimMax": [
      2.56,
      1.8,
      1.013
    ],
    "usage": "bureau"
  },
  {
    "id": "bureau-secretaire",
    "nom": "Secrétaire",
    "type": "bureau",
    "fam": "bureau",
    "pose": "sol",
    "dim": [
      0.9,
      0.5,
      1.2
    ],
    "dimMin": [
      0.63,
      0.35,
      0.9
    ],
    "dimMax": [
      1.44,
      0.75,
      1.62
    ],
    "usage": "bureau"
  },
  {
    "id": "bureau-caissons",
    "nom": "Bureau à caissons",
    "type": "bureau",
    "fam": "bureau",
    "pose": "sol",
    "dim": [
      1.5,
      0.7,
      0.75
    ],
    "dimMin": [
      1.05,
      0.49,
      0.562
    ],
    "dimMax": [
      2.4,
      1.05,
      1.013
    ],
    "usage": "bureau"
  },
  {
    "id": "bureau-assis-debout",
    "nom": "Bureau assis-debout",
    "type": "bureau",
    "fam": "bureau",
    "pose": "sol",
    "dim": [
      1.4,
      0.7,
      1.05
    ],
    "dimMin": [
      0.98,
      0.49,
      0.788
    ],
    "dimMax": [
      2.24,
      1.05,
      1.418
    ],
    "usage": "bureau"
  },
  {
    "id": "coiffeuse",
    "nom": "Coiffeuse",
    "type": "bureau",
    "fam": "bureau",
    "pose": "sol",
    "dim": [
      1,
      0.45,
      1.4
    ],
    "dimMin": [
      0.7,
      0.315,
      1.05
    ],
    "dimMax": [
      1.6,
      0.675,
      1.89
    ],
    "usage": "bureau"
  },
  {
    "id": "console",
    "nom": "Console",
    "type": "table",
    "fam": "table",
    "pose": "sol",
    "dim": [
      1.1,
      0.32,
      0.8
    ],
    "dimMin": [
      0.77,
      0.224,
      0.6
    ],
    "dimMax": [
      1.76,
      0.48,
      1.08
    ],
    "forme": "rectangle",
    "usage": "console"
  },
  {
    "id": "lit-90",
    "nom": "Lit 90 cm",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      0.9,
      2.1,
      1.05
    ],
    "dimMin": [
      0.63,
      1.47,
      0.788
    ],
    "dimMax": [
      1.44,
      3.15,
      1.418
    ]
  },
  {
    "id": "lit-140",
    "nom": "Lit 140 cm",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      1.4,
      2.1,
      1.05
    ],
    "dimMin": [
      0.98,
      1.47,
      0.788
    ],
    "dimMax": [
      2.24,
      3.15,
      1.418
    ]
  },
  {
    "id": "lit-160",
    "nom": "Lit 160 cm",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      1.6,
      2.1,
      1.05
    ],
    "dimMin": [
      1.12,
      1.47,
      0.788
    ],
    "dimMax": [
      2.56,
      3.15,
      1.418
    ]
  },
  {
    "id": "lit-180",
    "nom": "Lit 180 cm",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      1.8,
      2.1,
      1.05
    ],
    "dimMin": [
      1.26,
      1.47,
      0.788
    ],
    "dimMax": [
      2.88,
      3.15,
      1.418
    ]
  },
  {
    "id": "lit-tete-tapissee",
    "nom": "Lit à tête tapissée",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      1.6,
      2.1,
      1.15
    ],
    "dimMin": [
      1.12,
      1.47,
      0.862
    ],
    "dimMax": [
      2.56,
      3.15,
      1.552
    ]
  },
  {
    "id": "lit-tete-cannee",
    "nom": "Lit à tête cannée",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      1.6,
      2.1,
      1.1
    ],
    "dimMin": [
      1.12,
      1.47,
      0.825
    ],
    "dimMax": [
      2.56,
      3.15,
      1.485
    ]
  },
  {
    "id": "lit-tete-bois",
    "nom": "Lit à tête en bois",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      1.6,
      2.1,
      1.05
    ],
    "dimMin": [
      1.12,
      1.47,
      0.788
    ],
    "dimMax": [
      2.56,
      3.15,
      1.418
    ]
  },
  {
    "id": "lit-tete-capitonnee",
    "nom": "Lit à tête capitonnée",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      1.6,
      2.1,
      1.25
    ],
    "dimMin": [
      1.12,
      1.47,
      0.938
    ],
    "dimMax": [
      2.56,
      3.15,
      1.688
    ]
  },
  {
    "id": "lit-plateforme",
    "nom": "Lit plateforme bas",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      1.6,
      2.1,
      0.52
    ],
    "dimMin": [
      1.12,
      1.47,
      0.39
    ],
    "dimMax": [
      2.56,
      3.15,
      0.702
    ]
  },
  {
    "id": "lit-baldaquin",
    "nom": "Lit à baldaquin",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      1.6,
      2.1,
      2.1
    ],
    "dimMin": [
      1.12,
      1.47,
      1.575
    ],
    "dimMax": [
      2.56,
      3.15,
      2.835
    ]
  },
  {
    "id": "lit-coffre",
    "nom": "Lit coffre",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      1.6,
      2.1,
      1.1
    ],
    "dimMin": [
      1.12,
      1.47,
      0.825
    ],
    "dimMax": [
      2.56,
      3.15,
      1.485
    ]
  },
  {
    "id": "lit-superpose",
    "nom": "Lit superposé",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      1,
      2.1,
      1.85
    ],
    "dimMin": [
      0.7,
      1.47,
      1.388
    ],
    "dimMax": [
      1.6,
      3.15,
      2.498
    ]
  },
  {
    "id": "lit-mezzanine",
    "nom": "Lit mezzanine",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      1.4,
      2.1,
      1.95
    ],
    "dimMin": [
      0.98,
      1.47,
      1.462
    ],
    "dimMax": [
      2.24,
      3.15,
      2.633
    ]
  },
  {
    "id": "lit-enfant",
    "nom": "Lit enfant",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      0.9,
      1.7,
      0.88
    ],
    "dimMin": [
      0.63,
      1.19,
      0.66
    ],
    "dimMax": [
      1.44,
      2.55,
      1.188
    ]
  },
  {
    "id": "berceau",
    "nom": "Berceau",
    "type": "lit",
    "fam": "lit",
    "pose": "sol",
    "dim": [
      0.65,
      1.2,
      0.9
    ],
    "dimMin": [
      0.455,
      0.84,
      0.675
    ],
    "dimMax": [
      1.04,
      1.8,
      1.215
    ]
  },
  {
    "id": "chevet-flottant",
    "nom": "Chevet flottant",
    "type": "chevet",
    "fam": "table",
    "pose": "mur",
    "dim": [
      0.45,
      0.32,
      0.25
    ],
    "dimMin": [
      0.315,
      0.224,
      0.188
    ],
    "dimMax": [
      0.72,
      0.48,
      0.338
    ],
    "usage": "chevet",
    "forme": "rectangle"
  },
  {
    "id": "chevet-tiroir",
    "nom": "Chevet à tiroir",
    "type": "chevet",
    "fam": "table",
    "pose": "sol",
    "dim": [
      0.45,
      0.38,
      0.52
    ],
    "dimMin": [
      0.315,
      0.266,
      0.39
    ],
    "dimMax": [
      0.72,
      0.57,
      0.702
    ],
    "usage": "chevet",
    "forme": "rectangle"
  },
  {
    "id": "chevet-rond",
    "nom": "Chevet rond",
    "type": "chevet",
    "fam": "table",
    "pose": "sol",
    "dim": [
      0.42,
      0.42,
      0.5
    ],
    "dimMin": [
      0.294,
      0.294,
      0.375
    ],
    "dimMax": [
      0.672,
      0.63,
      0.675
    ],
    "usage": "chevet",
    "forme": "rond"
  },
  {
    "id": "chevet-pierre",
    "nom": "Chevet en pierre",
    "type": "chevet",
    "fam": "table",
    "pose": "sol",
    "dim": [
      0.4,
      0.4,
      0.48
    ],
    "dimMin": [
      0.28,
      0.28,
      0.36
    ],
    "dimMax": [
      0.64,
      0.6,
      0.648
    ],
    "usage": "chevet",
    "forme": "rond"
  }
];

export const ELEMENTS = figer(Object.fromEntries(DONNEES.map(d => { const f = definirFiche(d); return [f.id, f]; })));

function dessiner(a) {
  const { p, w, d, h, s, m, box, cyl, mesh, barre, instances, pieds, facade, poignee } = a;
  const type = p.type;
  function plateau(largeur, profondeur, y, epaisseur, x = 0, z = 0, forme = p.forme) {
    const mat = p.id.includes('marbre') || p.id.includes('pierre') || p.variante === 'artdeco' ? matiere(p.variante === 'japandi' ? 'travertin' : 'marbre', p.variante === 'artdeco' ? '#DACEB6' : '#E9E6DF') : p.id.includes('verre') ? m.verre : m.bois;
    if (forme === 'rond' || forme === 'ovale') { const o = cyl(largeur / 2, largeur / 2, epaisseur, x, y, z, mat, 32); o.scale.z = profondeur / largeur; }
    else box(largeur, epaisseur, profondeur, x, y, z, mat, p.variante === 'contemporain' || forme === 'organique' ? Math.min(0.06, profondeur * 0.2) : s.rayon);
  }
  function table(largeur, profondeur, hauteur, x = 0, z = 0, forme = p.forme) {
    const ep = Math.min(0.04, hauteur * 0.1), sous = hauteur - ep;
    plateau(largeur, profondeur, sous, ep, x, z, forme);
    if (p.central || p.variante === 'artdeco' || (p.variante === 'contemporain' && forme === 'rond')) {
      const rayon = Math.min(largeur, profondeur) * 0.2;
      if(p.variante==='classique') a.revolution([[rayon*.75,0],[rayon,.04],[rayon*.4,sous*.3],[rayon*.5,sous*.65],[rayon*.3,sous]],x,0,z,m.bois);
      else if(p.variante==='japandi') for(let i=0;i<3;i++){const angle=i/3*TOUR;box(rayon*.28,sous,rayon*.5,x+Math.cos(angle)*rayon*.55,0,z+Math.sin(angle)*rayon*.55,m.bois,0.006);}
      else if(p.variante==='boheme') for(let i=0;i<4;i++){const angle=i/4*TOUR;cyl(rayon*.23,rayon*.25,sous,x+Math.cos(angle)*rayon*.65,0,z+Math.sin(angle)*rayon*.65,m.bois,12);}
      else cyl(rayon * 0.72, rayon, sous, x, 0, z, p.variante === 'artdeco' ? m.facade : m.bois, p.variante === 'industriel' ? 8 : 24);
      if (p.variante === 'artdeco') for (let i = 0; i < 16; i++) { const angle = i / 16 * TOUR; cyl(0.009, 0.009, sous - 0.03, x + Math.cos(angle) * rayon * 0.78, 0.015, z + Math.sin(angle) * rayon * 0.78, m.bois, 8); }
    } else {
      const retrait = Math.min(0.07, Math.max(0.045, Math.min(largeur * 0.12, profondeur * 0.12))), px = largeur / 2 - retrait, pz = profondeur / 2 - retrait;
      for (const dx of [-px, px]) for (const dz of [-pz, pz]) {
        if (p.variante === 'classique') a.revolution([[0.02, 0], [0.03, 0.05], [0.021, sous * 0.6], [0.036, sous]], x + dx, 0, z + dz, m.bois);
        else if (p.variante === 'japandi' || p.id.includes('compas')) { const retraitHaut=p.variante==='japandi'?0.63:0.78; barre([x + dx, 0.015, z + dz], [x + dx * retraitHaut, sous - 0.015, z + dz * retraitHaut], 0.023, m.bois); cyl(0.022, 0.022, 0.015, x + dx, 0, z + dz, m.bois, 12); }
        else box(p.variante === 'industriel' ? 0.035 : 0.027, sous, 0.03, x + dx, 0, z + dz, p.variante === 'industriel' || p.variante === 'contemporain' ? m.metal : m.bois, 0.004);
      }
      if (p.variante === 'classique' || p.id.includes('ferme')) {
        for (const dz of [-pz, pz]) box(largeur - retrait * 2, 0.08, 0.022, x, Math.max(0.01, sous - 0.08), z + dz, m.bois);
        if (p.id.includes('ferme')) box(largeur - retrait * 2, 0.05, 0.04, x, sous * 0.25, z, m.bois);
      }
      if (p.variante === 'industriel') for (const dx of [-px, px]) box(0.035, 0.025, profondeur - retrait, x + dx, 0.005, z, m.metal, 0);
      if (p.variante === 'boheme') box(largeur * 0.7, 0.018, profondeur * 0.65, x, sous * 0.3, z, m.facade, 0.005);
    }
  }
  function caisson(largeur, profondeur, hauteur, x, bas, z) {
    for (const dx of [-largeur / 2 + 0.009, largeur / 2 - 0.009]) box(0.018, hauteur, profondeur, x + dx, bas, z, m.bois);
    for (const y of [bas, bas + hauteur - 0.018]) box(largeur, 0.018, profondeur, x, y, z, m.bois);
    box(largeur - 0.036, hauteur - 0.036, 0.012, x, bas + 0.018, z - profondeur / 2 + 0.006, m.bois);
  }
  if (type === 'table') {
    if (p.id.includes('gigogne')) {
      const n = p.nombre || 2;
      table(w * 0.78, d, h, -w * 0.11, 0, 'rond');
      table(w * 0.55, d * 0.68, h * 0.73, w * 0.225, d * 0.08, 'rond');
      if (n === 3) table(w * 0.4, d * 0.48, h * 0.5, w * 0.24, d * 0.13, 'rond');
    } else if (p.id.includes('en-c')) {
      plateau(w, d, h - 0.025, 0.025);
      box(w, 0.018, d, 0, 0, 0, m.metal, 0.004);
      if(p.variante==='japandi'||p.variante==='boheme') for(const z of [-d*.22,d*.22])box(0.024,h-.043,.024,-w/2+.012,.018,z,m.bois,0.006);
      else box(0.024, h - 0.043, d * 0.55, -w / 2 + 0.012, 0.018, 0, m.metal, 0.004);
      if(p.variante==='boheme')box(w*.6,.018,d*.55,-w*.16,h*.24,0,m.facade,0.005);
      if(p.variante==='artdeco')for(let i=0;i<4;i++)box(.012,h-.05,.012,-w/2+.012,.018,-d*.21+i*d*.14,m.metal,0.003);
    } else {
      table(w, d, h);
      if (p.id.includes('rallonge')) { box(0.006, 0.004, d - 0.015, -w * 0.2, h - 0.004, 0, m.noir, 0); box(0.006, 0.004, d - 0.015, w * 0.2, h - 0.004, 0, m.noir, 0); }
      if (p.id.includes('relevable')) for (const x of [-w * 0.28, w * 0.28]) { barre([x, h * 0.3, -d * 0.25], [x, h - 0.05, d * 0.25], 0.012, m.metal); barre([x, h * 0.3, d * 0.25], [x, h - 0.05, -d * 0.25], 0.012, m.metal); }
    }
  } else if (type === 'bureau') {
    const ecriture = p.id.includes('secretaire') || p.id.includes('coiffeuse') ? Math.min(0.76, h * 0.6) : h;
    if (p.id.includes('angle')) {
      table(w, d * 0.45, ecriture, 0, -d * 0.275);
      table(w * 0.35, d, ecriture, -w * 0.325, 0);
    } else table(w, d, ecriture);
    if (p.id.includes('caissons')) for (const x of [-w * 0.32, w * 0.32]) {
      const largeur = Math.min(0.4, w * 0.25), haut = ecriture - 0.05;
      caisson(largeur, d * 0.8, haut, x, 0, 0);
      for (let i = 0; i < 3; i++) { facade(largeur - 0.008, haut / 3 - 0.006, x, i * haut / 3 + 0.003, d * 0.4 - 0.03); poignee(x, (i + 0.65) * haut / 3, d * 0.4 - 0.006); }
    }
    if (p.id.includes('secretaire')) {
      const hauteur = h - ecriture;
      caisson(w, d * 0.42, hauteur, 0, ecriture, -d * 0.29);
      facade(w - 0.02, hauteur * 0.5, 0, h - hauteur * 0.5, -d * 0.08 - 0.03);
      box(w - 0.04, 0.018, d * 0.4, 0, ecriture + hauteur * 0.4, -d * 0.29, m.bois);
    }
    if (p.id.includes('coiffeuse')) {
      const haut = h - ecriture - 0.04, largeur = Math.min(w * 0.65, haut * 0.9);
      box(largeur, haut, 0.018, 0, ecriture + 0.04, -d / 2 + 0.012, m.metal, 0.04);
      box(largeur - 0.018, haut - 0.018, 0.005, 0, ecriture + 0.049, -d / 2 + 0.0265, matiere('miroir'), 0.035);
    }
    if (p.id.includes('assis-debout')) for (const x of [-w * 0.3, w * 0.3]) {
      box(0.07, ecriture * 0.5, 0.07, x, 0.035, 0, m.metal, 0.005);
      box(0.052, ecriture * 0.45, 0.052, x, ecriture * 0.5, 0, m.chrome, 0.004);
      box(0.07, 0.025, d * 0.9, x, 0, 0, m.metal, 0.005);
    }
  } else if (type === 'chevet') {
    if (p.forme === 'rond' || p.id.includes('pierre')) table(w, d, h, 0, 0, 'rond');
    else {
      const bas = p.pose === 'mur' ? 0 : p.variante === 'japandi' ? 0.1 : 0.06;
      if (bas) pieds(w * 0.9, d * 0.86, bas);
      caisson(w, d, h - bas, 0, bas, 0);
      facade(w - 0.012, (h - bas) * 0.55, 0, h - (h - bas) * 0.55, d / 2 - 0.032);
      poignee(0, h - 0.08, d / 2 - 0.008);
    }
  } else if (type === 'lit') {
    const berceau = p.id.includes('berceau'), superpose = p.id.includes('superpose'), mezzanine = p.id.includes('mezzanine'), baldaquin = p.id.includes('baldaquin');
    function couchage(y, hauteurMatelas = 0.2, tete = true) {
      const ep = 0.1;
      box(w, ep, d, 0, y, 0, m.bois, 0.012);
      box(w - 0.07, hauteurMatelas, d - 0.11, 0, y + ep + 0.003, 0.025, matiere('lin', '#EAE4D9'), 0.035);
      const dessus = y + ep + hauteurMatelas + 0.006;
      box(w - 0.08, 0.016, d * 0.68, 0, dessus, d * 0.14, m.tissu, 0.012);
      const n = w > 1.1 ? 2 : 1, oreillerH = Math.min(0.095, Math.max(0.025, h - dessus - 0.025));
      for (let i = 0; i < n; i++) box((w - 0.16) / n - 0.02, oreillerH, Math.min(0.42, d * 0.23), -w / 2 + 0.08 + (i + 0.5) * (w - 0.16) / n, dessus + 0.02, -d / 2 + Math.min(0.3, d * 0.18), matiere('lin', '#DED6C8'), 0.035);
    }
    if (berceau) {
      pieds(w * 0.9, d * 0.9, 0.13);
      const matelasY = h * 0.27;
      box(w, 0.06, d, 0, matelasY, 0, m.bois, 0.006);
      box(w - 0.06, 0.06, d - 0.06, 0, matelasY + 0.063, 0, m.tissu, 0.018);
      for (const z of [-d / 2 + 0.012, d / 2 - 0.012]) {
        box(w, 0.025, 0.024, 0, h - 0.025, z, m.bois, 0.008);
        const n = Math.max(5, Math.floor(w / 0.065));
        for (let i = 0; i < n; i++) cyl(0.006, 0.006, h - matelasY - 0.06, -w / 2 + 0.025 + i * (w - 0.05) / (n - 1), matelasY + 0.035, z, m.bois, 8);
      }
      for (const x of [-w / 2 + 0.012, w / 2 - 0.012]) box(0.024, h - 0.13, d, x, 0.13, 0, m.facade, 0.008);
    } else if (superpose || mezzanine) {
      const hautY = h - 0.47;
      for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) for (const z of [-d / 2 + 0.02, d / 2 - 0.02]) box(0.04, h, 0.04, x, 0, z, m.bois, 0.005);
      couchage(hautY, 0.15);
      if (superpose) couchage(0.18, 0.15);
      else box(w - 0.08, 0.028, d * 0.35, 0, Math.min(0.75, hautY * 0.55), -d * 0.27, m.bois);
      for (const x of [-w / 2 + 0.025, w / 2 - 0.025]) box(0.025, 0.065, d - 0.04, x, h - 0.08, 0, m.bois);
      if(p.variante==='boheme')box(w-.08,.3,.012,0,h-.4,-d/2+.03,m.facade,.018);
      const echelleW = Math.min(0.36, w * 0.4), x = w / 2 - echelleW / 2 - 0.04;
      for (const dx of [-echelleW / 2, echelleW / 2]) box(0.025, hautY + 0.12, 0.025, x + dx, 0, d / 2 - 0.015, m.bois);
      for (let y = 0.22; y < hautY; y += 0.24) box(echelleW, 0.025, 0.025, x, y, d / 2 - 0.015, m.bois);
    } else {
      const sommier = Math.min(0.22, h * 0.28), hauteurMatelas = Math.min(0.2, h * 0.23), sol = Math.min(0.1, sommier * 0.5);
      pieds(w * 0.92, d * 0.9, sommier);
      couchage(sommier, hauteurMatelas);
      const teteH = baldaquin ? Math.min(1.05, h * 0.48) : h;
      if (p.id.includes('cannee') || p.variante === 'boheme') {
        box(w, teteH - sol, 0.04, 0, sol, -d / 2 + 0.02, m.facade, 0.02);
        box(w, 0.035, 0.05, 0, teteH - 0.035, -d / 2 + 0.025, m.bois, 0.015);
        if(p.variante==='artdeco')for(let i=0;i<7;i++)box(.012,teteH-sol-.025,.008,-w*.42+i*w*.14,sol+.01,-d/2+.048,m.metal,0.003);
      } else {
        box(w, teteH - sol, 0.06, 0, sol, -d / 2 + 0.03, p.id.includes('bois') || p.variante === 'japandi' || p.variante === 'industriel' ? m.bois : m.tissu, p.variante === 'contemporain' ? 0.055 : s.rayon);
        if (p.id.includes('capitonnee') || p.variante === 'classique' || p.variante === 'artdeco') {
          const n = Math.max(4, Math.floor(w / 0.14)), poses = [];
          const basCapitons=Math.min(teteH-.07,sommier+.3),hautCapitons=Math.max(.02,teteH-basCapitons-.018);
          for (let j = 0; j < 3; j++) for (let i = 0; i < n; i++) poses.push({ position: [-w / 2 + (i + 0.5) * w / n, basCapitons+(j+.5)*hautCapitons/3, -d / 2 + 0.065], echelle: [0.008, 0.008, 0.004] });
          instances(new THREE.SphereGeometry(1, 6, 4), m.tissu, poses);
        }
      }
      if (baldaquin) {
        for (const x of [-w / 2 + 0.018, w / 2 - 0.018]) for (const z of [-d / 2 + 0.018, d / 2 - 0.018]) box(0.036, h, 0.036, x, 0, z, m.bois);
        for (const z of [-d / 2 + 0.018, d / 2 - 0.018]) box(w, 0.036, 0.036, 0, h - 0.036, z, m.bois);
        for (const x of [-w / 2 + 0.018, w / 2 - 0.018]) box(0.036, 0.036, d, x, h - 0.036, 0, m.bois);
      }
      if (p.id.includes('coffre')) box(w * 0.24, 0.014, 0.006, 0, sommier + 0.04, d / 2 - 0.003, m.metal);
    }
  }
}
