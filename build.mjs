import {readFileSync,existsSync} from 'node:fs';
const fields=JSON.parse(readFileSync(new URL('./lib/fields.json',import.meta.url)));
const template=readFileSync(new URL('./public/editor.html',import.meta.url),'utf8');
for(const key of Object.keys(fields)) if(!template.includes(`data-bind="${key}"`))throw Error(`Missing field ${key}`);
for(const file of ['public/app.js','public/history.js','public/editor.js','api/service.js'])if(!existsSync(file))throw Error(`Missing ${file}`);
console.log(`Build verified: ${Object.keys(fields).length} structured fields, four-page template.`);
