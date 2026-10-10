// Le worker est servi localement, sans CDN ni envoi de documents à un tiers.
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public/pdf',{recursive:true});
await copyFile('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs','public/pdf/pdf.worker.min.mjs');
