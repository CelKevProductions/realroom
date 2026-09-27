'use client';
// La maquette 3D dans React : le moteur (moteur/editeur.js) est chargé à la demande, après
// affichage ; React lui transmet l'agencement, la sélection et la vue.
import { useEffect, useImperativeHandle, useRef, useState } from 'react';

let catalogueP = null;
export const chargerCatalogue = () => (catalogueP ||= fetch('/catalogue.json').then(r => r.json()));

export default function Editeur3D({ ref, modele, items, selection, vue, surSelection, surDeplacement, surPret, erreurWebgl }) {
  const canvas = useRef(null);
  const ed = useRef(null);
  const rappels = useRef({});
  rappels.current = { surSelection, surDeplacement };
  const [panne, setPanne] = useState(false);
  const cle = JSON.stringify(modele && [modele.dims, modele.murs, modele.sol, modele.plafond]);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const [{ creerEditeur }, cat] = await Promise.all([import('@/moteur/editeur.js'), chargerCatalogue()]);
        if (!vivant || !canvas.current) return;
        ed.current = creerEditeur(canvas.current, {
          produits: cat.produits,
          surSelection: id => rappels.current.surSelection && rappels.current.surSelection(id),
          surDeplacement: d => rappels.current.surDeplacement && rappels.current.surDeplacement(d)
        });
        ed.current.charger(modele, items);
        ed.current.vue(vue, false);
        if (selection) ed.current.selectionner(selection);
        if (surPret) surPret(cat.produits);
      } catch (e) {
        console.error(e);
        if (vivant) setPanne(true);
      }
    })();
    return () => { vivant = false; if (ed.current) { ed.current.detruire(); ed.current = null; } };
    // le moteur est recréé quand la pièce elle-même change (dimensions, murs, sol)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  useEffect(() => { if (ed.current) ed.current.majItems(items); }, [items]);
  useEffect(() => { if (ed.current) ed.current.selectionner(selection); }, [selection]);
  useEffect(() => { if (ed.current && ed.current.mode !== vue) ed.current.vue(vue); }, [vue]);
  useEffect(() => { if (ed.current && modele && modele.vue) ed.current.majVuePhoto(modele.vue); }, [modele && modele.vue]);

  useImperativeHandle(ref, () => ({
    capture: o => (ed.current ? ed.current.capture(o) : null),
    projeter: id => (ed.current ? ed.current.projeter(id) : null),
    tourner: (id, d) => (ed.current ? ed.current.tourner(id, d) : null)
  }), []);

  if (panne) return <div className="attente"><p>{erreurWebgl}</p></div>;
  return <canvas ref={canvas} aria-label="3D" />;
}
