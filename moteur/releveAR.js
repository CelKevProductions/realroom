// Acquisition réelle WebXR/ARCore : poses métriques, pas de photographie ni de faux scan.
// Le contrôleur n'est chargé qu'après une action explicite du client.
export async function ouvrirReleveAR(session, racine, onEtat) {
  const THREE = await import('three');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  racine.prepend(canvas);
  let fini = false, renderer, hitSource, point = null, derniereMire = null;
  const coins = [], marqueurs = [], scene = new THREE.Scene();
  const finir = () => {
    if (fini) return;
    fini = true;
    hitSource?.cancel();
    renderer?.setAnimationLoop(null);
    const geometries = new Set(), matieres = new Set();
    scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) matieres.add(o.material); });
    geometries.forEach(g => g.dispose()); matieres.forEach(m => m.dispose());
    renderer?.dispose(); canvas.remove();
    session.removeEventListener('end', finir);
  };
  session.addEventListener('end', finir);
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    renderer.setSize(innerWidth, innerHeight);
    const camera = new THREE.PerspectiveCamera();
    const mire = new THREE.Mesh(new THREE.RingGeometry(.055, .075, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#C9A66B', side: THREE.DoubleSide }));
    mire.matrixAutoUpdate = false; mire.visible = false; scene.add(mire);
    const viewer = await session.requestReferenceSpace('viewer');
    if (fini) throw new Error('ar-annule');
    hitSource = await session.requestHitTestSource({ space: viewer, entityTypes: ['plane'] });
    if (fini) { hitSource.cancel(); throw new Error('ar-annule'); }
    await renderer.xr.setSession(session);
    if (fini) throw new Error('ar-annule');
    const reference = renderer.xr.getReferenceSpace();
    renderer.setAnimationLoop((_, frame) => {
      if (fini || !frame) return;
      const suivi = frame.getViewerPose(reference);
      const poses = suivi ? frame.getHitTestResults(hitSource).map(r => r.getPose(reference)).filter(Boolean) : [];
      // L'utilisateur vise le sol ; après le premier coin, imposer le même niveau horizontal.
      const pose = poses.find(p => p.transform.matrix[5] > .95
        && (coins.length === 0 || Math.abs(p.transform.position.y - coins[0][1]) <= .15));
      if (pose) {
        const p = pose.transform.position;
        point = { valeur: [p.x, p.y, p.z], t: performance.now() };
        mire.matrix.fromArray(pose.transform.matrix); mire.visible = true;
      } else { point = null; mire.visible = false; }
      if (derniereMire !== mire.visible) { derniereMire = mire.visible; onEtat({ coins: [...coins], mire: mire.visible }); }
      renderer.render(scene, camera);
    });
    return {
      validerCoin() {
        if (fini || !point || performance.now() - point.t > 300 || coins.length >= 32) throw new Error('ar-suivi');
        if (coins.some(p => Math.hypot(p[0] - point.valeur[0], p[2] - point.valeur[2]) < .2)) throw new Error('scan-coins');
        coins.push([...point.valeur]);
        const marqueur = new THREE.Mesh(new THREE.CircleGeometry(.045, 24).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: '#A6CA97', side: THREE.DoubleSide }));
        marqueur.position.set(point.valeur[0], point.valeur[1] + .005, point.valeur[2]);
        scene.add(marqueur); marqueurs.push(marqueur);
        onEtat({ coins: [...coins], mire: !!point });
        return coins.map(p => [...p]);
      },
      annulerCoin() {
        coins.pop(); const m = marqueurs.pop();
        if (m) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
        onEtat({ coins: [...coins], mire: !!point });
      },
      detruire: finir
    };
  } catch (e) { finir(); throw e; }
}
