import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bounds, footprint, walls, openingFrame, doorZone } from '../../lib/geometry.mjs';
import { CATALOG, ceilingMounted } from '../../lib/catalog.mjs';

export function planPrimitives(room, scene) {
  return {
    bounds: bounds(room.polygon), polygon: room.polygon, title: scene.title,
    walls: walls(room).map(w => ({ a:w.a, b:w.b, label:`M${w.id} · ${w.length.toFixed(2)} m` })),
    openings: room.openings.map(o => ({ ...openingFrame(room, o), type:o.type, zone:o.type === 'door' ? doorZone(room, o) : null })),
    items: scene.items.filter(i => !ceilingMounted(CATALOG[i.sku])).sort((a,b) => a.y-b.y || Number(CATALOG[b.sku].fam === 'tapis')-Number(CATALOG[a.sku].fam === 'tapis')).map(i => ({
      polygon:footprint(i, CATALOG[i.sku]), x:i.x, z:i.z, id:i.id, label:CATALOG[i.sku].nom,
      y:i.y, family:CATALOG[i.sku].fam, rotation:i.rotation, dimensions:CATALOG[i.sku].dim,
    })),
  };
}
export function renderPlan(room, scene, signal) {
  return new Promise((resolve, reject) => {
    const child = execFile(process.env.REALROOM_PYTHON || 'python3', [fileURLToPath(new URL('./render-plan.py', import.meta.url))],
      { signal, timeout:20000, maxBuffer:2_000_000 }, (error, stdout) => {
        if (error) reject(Error('Le rendu du plan de contrôle a échoué.', { cause:error }));
        else resolve({ kind:'plan', label:scene.id+' — plan exact : empreintes réelles, ouvertures et zones des portes, vue du dessus (+Z vers le bas)', data:'data:image/png;base64,'+stdout.trim() });
      });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(planPrimitives(room, scene)));
  });
}
