import {test} from 'node:test';import assert from 'node:assert/strict';
import {REFERENCES_STYLES,etiquettesStyle,referencesStylesDe,affiniteReference} from '../../lib/references-styles.js';
import {affinitePatron} from '../../lib/patrons.js';
import {scoreStyle} from '../../lib/styles.js';
test('les onze styles ont des références publiques avec provenance et sans photos copiées',()=>{
 for(const style of ['epure','chaleureux','classique','boheme','artdeco','japandi','audacieux','mediterraneen','scandinave','industriel','contemporain'])assert.ok(referencesStylesDe([style]).length,style);
 assert.ok(REFERENCES_STYLES.every(r=>r.url.startsWith('https://')&&r.consulteLe==='2026-10-10'&&r.source==='editorial'&&r.aVerifier));
});
test('les indices matériels améliorent les étiquettes sans transformer une couleur en certitude',()=>{
 assert.equal(etiquettesStyle({nom:'Canapé'}).length,0);
 const p={nom:'Console industrielle métal noir bois foncé'};
 assert.ok(etiquettesStyle(p).some(x=>x.style==='industriel'&&x.source==='editorial'&&x.indices.length>=2));
 assert.ok(scoreStyle(p,'industriel')>scoreStyle(p,'japandi'));
 assert.equal(referencesStylesDe(['absent']).length,0);
});
test('les références classent les patrons avec un bonus borné, même en mélange de styles',()=>{
 assert.ok(affiniteReference('salon-conversation',['boheme'])>0);
 assert.ok(affiniteReference('salon-conversation',['boheme','japandi'])<=2);
 assert.ok(affinitePatron('chambre-laterale',{styles:['boheme']})>0);
});
