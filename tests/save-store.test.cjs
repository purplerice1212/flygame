const {test}=require('node:test');const assert=require('node:assert/strict');
const Store=require('../src/save-store.js');const R=require('../src/rules.js');
function snapshot(){
 const players=['red','blue'].map((color,i)=>({id:'P'+(i+1),name:color,type:'human',color,control:'auto',difficulty:null}));
 return {players,turn:'P1',pieces:Object.fromEntries(players.map(p=>[p.id,Array.from({length:4},(_,i)=>({pos:R.Pos.base(i),baseSlot:i}))])),rules:structuredClone(R.DEFAULT_RULES),dice:2,settings:{theme:'dark',keyboardMode:'shared'}};
}
test('current saves roundtrip players, pieces, dice and settings',()=>{
 const a=snapshot(),b=Store.parse(JSON.stringify(Store.pack(a,R)),R).state;
 assert.deepEqual(b.players,a.players);assert.deepEqual(b.pieces,a.pieces);assert.equal(b.dice,a.dice);assert.equal(b.settings.theme,'dark');
});
test('legacy bare snapshots migrate to the current envelope',()=>assert.equal(Store.parse(JSON.stringify(snapshot()),R).version,Store.VERSION));
test('save version or board mismatch is rejected without modifying input',()=>{
 const p=Store.pack(snapshot(),R);p.version='future';assert.throws(()=>Store.parse(JSON.stringify(p),R),/版本/);
});
test('invalid JSON, oversized input and prototype fields are rejected',()=>{
 assert.throws(()=>Store.parse('{',R));assert.throws(()=>Store.parse(' '.repeat(200001),R));assert.throws(()=>Store.parse('{"__proto__":{}}',R),/不安全/);
});
test('duplicate colours and invalid player ids are rejected',()=>{
 const a=snapshot();a.players[1].color='red';assert.throws(()=>Store.pack(a,R));a.players[1].color='blue';a.players[1].id='__proto__';assert.throws(()=>Store.pack(a,R));
});
test('out-of-range, non-integer and unknown piece locations are rejected',()=>{
 for(const pos of [{kind:'track',idx:52},{kind:'track',idx:1.1},{kind:'home',idx:6},{kind:'base',slot:-1},{kind:'bad'}]){const a=snapshot();a.pieces.P1[0].pos=pos;assert.throws(()=>Store.pack(a,R));}
});
test('invalid dice and enormous skip counters are rejected',()=>{
 const a=snapshot();a.dice=0;assert.throws(()=>Store.pack(a,R));a.dice=2;a.skipTurns={P1:100000};assert.throws(()=>Store.pack(a,R));
});
test('only whitelisted rule values survive import',()=>{
 const a=snapshot();a.rules.specials.portalLimit=1000;assert.throws(()=>Store.pack(a,R));a.rules.specials.portalLimit=1;a.rules.customScript='ignored';assert.equal(Store.pack(a,R).state.rules.customScript,undefined);
});
test('finished positions restore a consistent winner and exclude completed players',()=>{
 const a=snapshot();a.pieces.P1.forEach(pc=>pc.pos=R.Pos.finished());a.finishOrder=['P1'];const b=Store.pack(a,R).state;assert.equal(b.winner,'P1');assert.equal(b.turn,'P2');assert.equal(b.disabledColors.P1,true);
});
test('corrupt data never changes the valid source object',()=>{const a=snapshot(),before=JSON.stringify(a);Store.pack(a,R);assert.equal(JSON.stringify(a),before);});
