/* =================================================================
   RealRoom — modèles fidèles : registre
   Chaque meuble de la boutique refait d'après ses photos remplace la
   maquette générique de sa famille (moteur/meubles.js, construireProduit).
   ================================================================= */
import { enregistrerModeles } from '../meubles.js';
import { FAUTEUILS } from './fauteuils.js';
import { CANAPES } from './canapes.js';
import { LITS } from './lits.js';
import { LUMINAIRES } from './luminaires.js';

export const MODELES = { ...FAUTEUILS, ...CANAPES, ...LITS, ...LUMINAIRES };
enregistrerModeles(MODELES);
