import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {build} from 'esbuild';
import {rectangle} from '../fixtures/bench-chambres.js';

test('le plan expose les deux symétries réversibles et la sauvegarde dans les deux langues',async()=>{
  const racine=path.resolve(import.meta.dirname,'../..');
  const b=await build({stdin:{contents:`import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import Plan from './components/piece/PlanPiece.js';
    export const afficher=props=>renderToStaticMarkup(React.createElement(Plan,props));`,resolveDir:racine},
    absWorkingDir:racine,bundle:true,format:'esm',platform:'node',write:false,outfile:path.join(racine,'node_modules/.cache/orientation-interface.mjs'),
    banner:{js:`import {createRequire} from 'node:module'; const require=createRequire(${JSON.stringify(path.join(racine,'package.json'))});`},
    alias:{'@':racine},loader:{'.js':'jsx','.css':'empty'},jsx:'automatic',logLevel:'silent'});
  const {afficher}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
  for(const [lang,x,z,save]of [['fr','Inverser gauche/droite','Inverser haut/bas','Enregistrer le plan'],['en','Flip left/right','Flip top/bottom','Save room plan']]){
    const html=afficher({modele:rectangle(6,5),items:[],produits:{},lang});
    assert.match(html,/<dialog[^>]+aria-labelledby=/);
    for(const label of [x,z])assert.ok(html.includes(`aria-pressed="false">${label}</button>`));
    assert.ok(html.includes(save));assert.match(html,/<polygon points=/);
  }
});
