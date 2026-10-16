import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { build } from 'esbuild';
import { rectangle } from '../fixtures/bench-chambres.js';
import { signaturePiece } from '../../lib/variation-disposition.js';

test('les mini-plans identifient la sélection et bloquent Shuffle quand le brief ou la pièce change', async () => {
  const racine=path.resolve(import.meta.dirname,'../..');
  const b=await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
    import Variantes from './components/piece/Variantes.js';export const afficher=props=>renderToStaticMarkup(React.createElement(Variantes,props));`,resolveDir:racine},
    absWorkingDir:racine,bundle:true,format:'esm',platform:'node',write:false,outfile:path.join(racine,'node_modules/.cache/variantes-interface.mjs'),
    banner:{js:`import {createRequire} from 'node:module';const require=createRequire(${JSON.stringify(path.join(racine,'package.json'))});`},
    alias:{'@':racine},loader:{'.js':'jsx','.css':'empty'},jsx:'automatic',logLevel:'silent'});
  const {afficher}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
  const piece={fonction:'chambre',modele:rectangle(4,4),agencement:[{id:'lit',sku:'lit',origine:'catalogue',usageProgramme:'lit',x:1,z:0,rot:Math.PI/2}]};
  const brief={mode:'tout',envies:'Épuré',budget:2000,garder:[],aRemplacer:[]};
  const liste=[{id:'v0',numero:1,agencement:piece.agencement,proposition:{programme:{complet:true}}},
    {id:'v1',numero:2,agencement:[{...piece.agencement[0],x:-1}],proposition:{programme:{complet:true}}}];
  piece.proposition={variantes:{version:1,signaturePiece:signaturePiece(piece),brief,liste,selection:'v0'}};
  const props={piece,items:piece.agencement,demande:brief,produits:{lit:{fam:'lit',dim:[1.6,2,.9]}},lang:'fr'};
  const html=afficher(props);
  assert.match(html,/Propositions d’aménagement/);assert.match(html,/Shuffle/);
  assert.equal((html.match(/viewBox=/g)||[]).length,3,'deux plans et l’icône Shuffle');
  assert.match(html,/aria-pressed="true" disabled=""/);assert.match(html,/aria-pressed="false"/);
  assert.match(html,/Proposition 1/);assert.match(html,/Proposition 2/);
  const modifie=afficher({...props,demande:{...brief,budget:500}});
  assert.match(modifie,/choix ont changé/);assert.match(modifie,/<button[^>]*disabled=""[^>]*><svg[^]*Shuffle/);
  assert.doesNotMatch(modifie,/Proposition 2/);
  const meubleDeplace=afficher({...props,items:[{...piece.agencement[0],x:.5}]});
  assert.match(meubleDeplace,/Relance l’assistant/);
  assert.match(afficher({...props,lang:'en'}),/Room layout proposals/);
});
