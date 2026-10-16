import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { build } from 'esbuild';
import { rectangle } from '../fixtures/bench-chambres.js';

test('le dialogue natif expose les espaces, places, envies et actions dans les deux langues', async () => {
  const racine = path.resolve(import.meta.dirname, '../..');
  const b = await build({ stdin: { contents: `import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import Brief from './components/piece/BriefReamenagement.js';
    export const afficher = props => renderToStaticMarkup(React.createElement(Brief,props));`, resolveDir: racine },
    absWorkingDir: racine, bundle: true, format: 'esm', platform: 'node', write: false, outfile: path.join(racine, 'node_modules/.cache/brief-interface.mjs'),
    banner: { js: `import {createRequire} from 'node:module'; const require = createRequire(${JSON.stringify(path.join(racine, 'package.json'))});` },
    alias: { '@': racine }, loader: { '.js': 'jsx', '.css': 'empty' }, jsx: 'automatic', logLevel: 'silent' });
  const { afficher } = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
  const props = { piece: { fonction: 'salon', modele: rectangle(6, 6) }, demande: { envies: 'Bois clair et table près de la fenêtre', espaces: ['repas'], placesRepas: 6, budget: 3500 } };
  const fr = afficher({ ...props, lang: 'fr' });
  assert.match(fr, /<dialog[^>]+aria-labelledby=/); assert.match(fr, /Quelles idées pour cette pièce/);
  assert.match(fr, /Coin repas/); assert.match(fr, /Coin bureau/); assert.match(fr, /Coin lecture/);
  assert.match(fr, /<option value="6" selected="">6 places/); assert.match(fr, /Bois clair et table près de la fenêtre/);
  assert.match(fr, /type="submit"/); assert.match(fr, /Créer ma pièce meublée/); assert.match(fr, /Shuffle/); assert.match(fr, /Annuler/);
  const en = afficher({ ...props, lang: 'en' });
  assert.match(en, /What do you imagine for this room/); assert.match(en, /Dining area/); assert.match(en, /Create my furnished room/);
  const ia=afficher({...props,demande:{...props.demande,methode:'ia'},lang:'fr'});
  assert.match(ia,/Réaménager avec ces idées/);
  assert.doesNotMatch(ia,/utilise Shuffle/);
});
