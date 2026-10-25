// Le rendu photo IA de l'accueil, au dernier étage : un balayage lumineux traverse la pièce et, derrière
// lui, la maquette devient une photo : parquet de chêne, murs à l'enduit, tissus, laiton, vraie lumière et
// vraies ombres, plus de traits de dessin. Deux versions de chaque meuble se partagent la pièce : la
// maquette (coupée devant le balayage) et sa copie réaliste (coupée derrière), par plans de coupe.
// La copie est enfant du meuble : elle le suit quand on le bouscule.
import * as THREE from 'three';
import { AL, AP, AH } from './immeuble.js';

// matières réalistes, par clé des matières de la maquette (matieresMeubles)
const REELLES = {
  gris: { color: '#CDBFAA', roughness: .97 },                    // lin
  clair: { color: '#EFEAE2', roughness: .55 },                   // laque claire, céramique
  fonce: { color: '#3B3633', roughness: .5, metalness: .2 },
  signal: { color: '#A65B3B', roughness: .85 },                  // terre cuite, cuir
  tapis: { color: '#CDBB9E', roughness: 1 },                     // laine
  beurre: { color: '#C8A35E', roughness: .3, metalness: .85 },   // laiton
  menthe: { color: '#55704A', roughness: .7 },                   // feuillage
  ecran: { color: '#121214', roughness: .15, metalness: .3 },
  bois: { color: '#A67B51', roughness: .5 }                      // chêne
};

// parquet de chêne en lames (canevas) : teintes variées, fil du bois, joints
function texParquet() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const x = c.getContext('2d');
  const lames = 8, h = c.height / lames;
  let graine = 7;
  const hasard = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
  for (let j = 0; j < lames; j++) {
    let u = -hasard() * 400;
    while (u < c.width) {
      const l = 380 + hasard() * 420, t = hasard();
      x.fillStyle = `hsl(${30 + t * 6}, ${38 + t * 10}%, ${58 + t * 10}%)`;
      x.fillRect(u, j * h, l, h);
      // fil du bois
      for (let k = 0; k < 18; k++) {
        x.strokeStyle = `rgba(110, 72, 40, ${.05 + hasard() * .08})`;
        x.lineWidth = .6 + hasard() * 1.6;
        const y0 = j * h + hasard() * h;
        x.beginPath();
        x.moveTo(u, y0);
        for (let s = 0; s <= l; s += 40) x.lineTo(u + s, y0 + Math.sin(s * .012 + k) * (2 + hasard() * 3));
        x.stroke();
      }
      x.fillStyle = 'rgba(70, 45, 25, .55)';
      x.fillRect(u, j * h, 2, h);
      u += l;
    }
    x.fillStyle = 'rgba(70, 45, 25, .5)';
    x.fillRect(0, j * h, c.width, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
// enduit chaulé : un grain très léger et des nuances lentes
function texEnduit() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#EDE5D9';
  x.fillRect(0, 0, 512, 512);
  let graine = 11;
  const hasard = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
  for (let k = 0; k < 90; k++) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 40 + hasard() * 110);
    const a = .01 + hasard() * .015, clair = hasard() < .5;
    g.addColorStop(0, clair ? `rgba(255,255,255,${a})` : `rgba(150,120,90,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.save(); x.translate(hasard() * 512, hasard() * 512); x.fillStyle = g; x.fillRect(-160, -160, 320, 320); x.restore();
  }
  const img = x.getImageData(0, 0, 512, 512), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (hasard() - .5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ap : l'appartement du dernier étage ({ groupe, meubles, ordre }) ; mm : ses matières de maquette ;
// interieur : ses matières de pièce (immeuble.js)
export function creerRendu({ ap, mm, scene, environnement }) {
  // coupes (repère du monde ; l'étage est centré en x = 0) : la maquette garde x > s, le réel x < s
  const coupeMaquette = new THREE.Plane(new THREE.Vector3(1, 0, 0), 9);
  const coupeReel = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -9);
  const maquette = Object.entries(mm).filter(([, m]) => m.isMaterial);
  maquette.forEach(([, m]) => { m.clippingPlanes = [coupeMaquette]; });
  const cle = new Map(maquette.map(([k, m]) => [m, k]));
  const reel = {};
  for (const [k, o] of Object.entries(REELLES)) reel[k] = new THREE.MeshStandardMaterial({ ...o, envMap: environnement, envMapIntensity: .9, clippingPlanes: [coupeReel] });

  // copie réaliste de chaque meuble : mêmes géométries, matières réelles, sans traits ni ombre dessinée
  // les objets posés sur les meubles (tasses, feuillage…) ont leurs propres matières : une version coupée
  // pour la maquette, une autre pour le réel
  const autres = new Map(), origine = new Map(), propres = [];
  const coupee = (m, plan) => {
    if (!autres.has(m)) autres.set(m, {});
    const v = autres.get(m), cote = plan === coupeMaquette ? 'm' : 'r';
    if (!v[cote]) { v[cote] = m.clone(); v[cote].clippingPlanes = [plan]; origine.set(v[cote], m); propres.push(v[cote]); }
    return v[cote];
  };
  for (const id of ap.ordre) ap.meubles[id].objet.traverse(x => {
    if ((x.isMesh || x.isLine) && x.material?.isMaterial && !cle.has(x.material)) x.material = coupee(x.material, coupeMaquette);
  });
  const copies = [];
  for (const id of ap.ordre) {
    const o = ap.meubles[id].objet, c = o.clone(true);
    c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1);
    c.traverse(x => {
      if (x === c) return;
      if (x.isLineSegments || x.isLine) { x.visible = false; return; }
      if (!x.isMesh) return;
      const k = cle.get(x.material);
      if (k) { if (!reel[k]) { x.visible = false; return; } x.material = reel[k]; }
      else if (x.material.map) { x.visible = false; return; }  // ombre dessinée : la vraie lumière la remplace
      else x.material = coupee(origine.get(x.material) || x.material, coupeReel);
      x.castShadow = x.receiveShadow = true;
    });
    c.visible = false;
    o.add(c);
    copies.push(c);
  }

  // la pièce réelle : parquet, murs à l'enduit (posés juste devant ceux de la maquette)
  const parquet = texParquet(), enduit = texEnduit();
  parquet.repeat.set(AL / 2.2, AP / 2.2);
  const matSol = new THREE.MeshStandardMaterial({ map: parquet, roughness: .48, envMap: environnement, envMapIntensity: .7, clippingPlanes: [coupeReel] });
  const matMur = new THREE.MeshStandardMaterial({ map: enduit, roughness: .95, envMap: environnement, envMapIntensity: .5, clippingPlanes: [coupeReel] });
  const piece = new THREE.Group();
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(AL - .06, AP - .02).rotateX(-Math.PI / 2), matSol);
  sol.position.y = .003;
  sol.receiveShadow = true;
  const l = AL / 2, q = AP / 2;
  const fond = new THREE.Mesh(new THREE.PlaneGeometry(AL - .06, AH), matMur);
  fond.position.set(0, AH / 2, -q + .034);
  const murs = [-1, 1].map(s => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(AP, AH), matMur);
    m.rotation.y = -s * Math.PI / 2;
    m.position.set(s * (l - .034), AH / 2, 0);
    return m;
  });
  enduit.repeat.set(2, 1.1);
  [fond, ...murs].forEach(m => { m.receiveShadow = true; });
  piece.add(sol, fond, ...murs);
  piece.visible = false;
  ap.groupe.add(piece);

  // lumière du rendu : une douche chaude depuis le plafond, avec de vraies ombres
  const spot = new THREE.SpotLight('#FFE3BC', 0, 6, 1.25, .8, 1.4);
  spot.position.set(.3, AH - .12, .5);
  spot.target.position.set(-.1, 0, -.3);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -.0004;
  spot.shadow.normalBias = .02;
  spot.shadow.camera.near = .2;
  spot.shadow.camera.far = 4;
  ap.groupe.add(spot, spot.target);

  // le balayage : une lame de lumière qui traverse la pièce
  const matLame = new THREE.MeshBasicMaterial({ color: '#FFF4E4', transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const matFil = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: .9, depthWrite: false });
  const lame = new THREE.Group();
  const voile = new THREE.Mesh(new THREE.PlaneGeometry(AP - .04, AH - .02).rotateY(Math.PI / 2), matLame);
  voile.position.y = AH / 2;
  const fil = new THREE.Mesh(new THREE.BoxGeometry(.012, AH - .02, AP - .04), matFil);
  fil.position.y = AH / 2;
  lame.add(voile, fil);
  lame.visible = false;
  lame.renderOrder = 3;
  ap.groupe.add(lame);

  const _w = new THREE.Vector3();
  let vu = -1;
  return {
    // k : 0 maquette, 1 rendu photo ; entre les deux, la lame est à son abscisse
    appliquer(k) {
      if (Math.abs(k - vu) < 1e-4) return;
      vu = k;
      const x0 = -l - .15, x = x0 + k * (AL + .3);
      ap.groupe.getWorldPosition(_w);
      coupeMaquette.constant = -(_w.x + x);
      coupeReel.constant = _w.x + x;
      const reelVu = k > .001;
      copies.forEach(c => { c.visible = reelVu; });
      piece.visible = reelVu;
      lame.visible = k > .001 && k < .999;
      lame.position.x = x;
      matLame.opacity = .32 * Math.sin(Math.PI * Math.min(1, k * 1.05));
      spot.intensity = 11 * k;
      spot.visible = k > .001;
    },
    // l'ombre du rendu n'est calculée que quand elle se voit
    ombres(oui) { spot.castShadow = oui; },
    liberer() {
      Object.values(reel).forEach(m => m.dispose());
      [matSol, matMur, matLame, matFil, ...propres].forEach(m => m.dispose());
      parquet.dispose(); enduit.dispose();
      spot.shadow.map?.dispose();
      maquette.forEach(([, m]) => { m.clippingPlanes = null; });
      void scene;
    }
  };
}
