const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
for(const file of ['board-geometry.js','src/rules.js','src/save-store.js','src/app.js','scripts/build.cjs','scripts/check.cjs'])execFileSync(process.execPath,['--check',path.join(root,file)]);
const html=fs.readFileSync(path.join(root,'skybound_flight_chess_interface.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  if(!/^(?:#|[a-z]+:)/i.test(match[1]))assert.ok(fs.existsSync(path.join(root,match[1])),'Missing '+match[1]);
}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
const rules=require('../src/rules.js'),geometry=require('../board-geometry.js');
assert.ok(rules.BOARD_VALIDATION.ok);assert.ok(geometry.validate(geometry.create(rules.BOARD),rules.BOARD).ok);
console.log('Syntax, asset references, unique IDs and board specification: passed.');
