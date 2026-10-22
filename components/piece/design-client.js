// Credentials live only in module memory, never in browser storage or project exports.
let connection = { key: "", code: "", model: "gpt-6-astra" };
export async function inspirationViews(piece) {
  const { reduireImage } = await import('./image.js');
  return Promise.all((piece.photos || []).filter(p => p.role === 'inspiration').slice(0,3).map(async (photo,index) => {
    if (!/^data:image\//.test(photo.url || '')) throw Error('Ajoutez les inspirations depuis un fichier image dans la démo.');
    const source=await (await fetch(photo.url)).blob();
    const {blob}=await reduireImage(source,900,.8);
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
    return {label:'Inspiration du client '+(index+1)+' — ambiance à interpréter, géométrie du plan à conserver',kind:'inspiration',data};
  }));
}
export const getDesignConnection = () => ({ ...connection });
export const setDesignConnection = (value) => {
  connection = { ...connection, ...value };
};
export const designHeaders = () => ({
  "Content-Type": "application/json",
  ...(connection.key ? { "x-realroom-key": connection.key } : {}),
  ...(connection.code ? { "x-realroom-code": connection.code } : {}),
  "x-realroom-model": connection.model,
});
export async function designRequest(
  input,
  { signal, onEvent = () => {} } = {},
) {
  const response = await fetch("/api/design", {
    method: "POST",
    cache: "no-store",
    signal,
    headers: designHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Object.assign(
      Error(body.error || "Le serveur ne peut pas composer cette pièce."),
      { code: body.code },
    );
  }
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    result = null;
  const consume = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    onEvent(event);
    if (event.type === "error") throw Error(event.error);
    if (event.type === "result") result = event.result;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) consume(line);
    }
    buffer += decoder.decode();
    consume(buffer);
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  }
  if (!result)
    throw Error(
      "La génération a été interrompue. La pièce actuelle est conservée.",
    );
  return result;
}
export async function captureCandidateViews(candidates, piece, room, signal) {
  const { planImage } = await import("../Plan.jsx");
  const { pieceFromScene } = await import("../../lib/design-adapter.mjs");
  const images = [];
  for (const [index, candidate] of candidates.entries()) {
    signal?.throwIfAborted();
    const svg = document.getElementById("design-candidate-" + index);
    if (svg)
      images.push({
        label: candidate.scene.id + " — plan coté exact",
        kind: "plan",
        data: await planImage(svg),
      });
  }
  let ed, canvas;
  try {
    const [{ creerEditeur }, { chargerCatalogue }] = await Promise.all([
      import("@/moteur/editeur.js"),
      import("../catalogueClient.js"),
    ]);
    const cat = await chargerCatalogue();
    canvas = document.createElement("canvas");
    Object.assign(canvas.style, {
      position: "fixed",
      left: "-12000px",
      width: "1000px",
      height: "750px",
    });
    document.body.appendChild(canvas);
    ed = creerEditeur(canvas, {
      produits: cat.produits,
      navigationActive: false,
    });
    for (const candidate of candidates) {
      signal?.throwIfAborted();
      const p = pieceFromScene(piece, candidate.scene);
      ed.charger(p.modele, p.agencement);
      for (const angle of ["entree", "fond"])
        images.push({
          label: candidate.scene.id + " — maquette 3D RealRoom, vue " + angle,
          kind: "3d",
          data: ed.capture({
            angle,
            largeur: 1000,
            hauteur: 750,
            qualite: 0.82,
          }),
        });
    }
  } catch (e) {
    if (e.name === "AbortError")
      throw e; /* The exact plans remain available when WebGL is unavailable. */
  } finally {
    ed?.detruire();
    canvas?.remove();
  }
  return images;
}
