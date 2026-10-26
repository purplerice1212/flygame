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
test('four or more consecutive sixes survive save/export and import without the penalty',()=>{
 for(const count of [4,5,6,25,1000,Number.MAX_SAFE_INTEGER]){
  const a=snapshot();a.rules.tripleSixPenalty=false;a.dice=6;
  a.consecutiveSixes={P1:count,P2:0};a.pieces.P1[0].pos=R.Pos.track(18);
  const before=JSON.stringify(a),packed=Store.pack(a,R);
  const b=Store.parse(JSON.stringify(packed),R).state;
  assert.deepEqual(packed.state.consecutiveSixes,a.consecutiveSixes);
  assert.deepEqual(b.consecutiveSixes,a.consecutiveSixes);
  assert.deepEqual(b.pieces,a.pieces);assert.equal(b.turn,a.turn);assert.equal(b.dice,6);
  assert.equal(b.rules.tripleSixPenalty,false);assert.equal(JSON.stringify(a),before);
 }
});
test('legacy snapshots preserve long six streaks and default missing penalty rules correctly',()=>{
 for(const ruleSource of [undefined,{}, {tripleSixPenalty:false}]){
  const a=snapshot();a.rules=ruleSource;a.consecutiveSixes={P1:7,P2:0};a.dice=6;
  const b=Store.parse(JSON.stringify(a),R).state;
  assert.equal(b.rules.tripleSixPenalty,false);assert.deepEqual(b.consecutiveSixes,a.consecutiveSixes);
 }
});
test('enabled three-six penalty retains its counter bounds in current and legacy saves',()=>{
 const a=snapshot();a.rules.tripleSixPenalty=true;
 for(const count of [0,1,2,3]){
  a.consecutiveSixes={P1:count,P2:0};
  assert.equal(Store.parse(JSON.stringify(Store.pack(a,R)),R).state.consecutiveSixes.P1,count);
 }
 a.consecutiveSixes.P1=4;
 assert.throws(()=>Store.pack(a,R),/consecutiveSixes/);
 assert.throws(()=>Store.parse(JSON.stringify(a),R),/consecutiveSixes/);
 const envelope={version:Store.VERSION,board:R.BOARD.boardSpecVersion,state:a};
 assert.throws(()=>Store.parse(JSON.stringify(envelope),R),/consecutiveSixes/);
});
test('six counters reject negative, fractional, nonnumeric and unsafe values under either rule',()=>{
 for(const tripleSixPenalty of [false,true]){
  for(const count of [-1,1.5,'4',true,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1]){
   const a=snapshot();a.rules.tripleSixPenalty=tripleSixPenalty;a.consecutiveSixes={P1:count};
   assert.throws(()=>Store.pack(a,R),/consecutiveSixes/);
  }
 }
 const a=snapshot();a.consecutiveSixes={P1:1};
 const json=JSON.stringify(a).replace('"consecutiveSixes":{"P1":1}', '"consecutiveSixes":{"P1":1e309}');
 assert.throws(()=>Store.parse(json,R),/consecutiveSixes/);
});
test('missing six counters remain compatible and invalid penalty types cannot bypass validation',()=>{
 const a=snapshot();assert.deepEqual(Store.pack(a,R).state.consecutiveSixes,{P1:0,P2:0});
 a.consecutiveSixes={P1:4};a.rules.tripleSixPenalty='false';
 assert.throws(()=>Store.pack(a,R),/布林/);
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
test('invalid dice are rejected',()=>{
 const a=snapshot();a.dice=0;assert.throws(()=>Store.pack(a,R),/骰值/);
});
test('accumulated skip counters survive current and legacy saves without an arbitrary cap',()=>{
 for(const count of [21,100000,Number.MAX_SAFE_INTEGER]){
  const a=snapshot();a.skipTurns={P1:count,P2:3};const before=JSON.stringify(a);
  const packed=Store.pack(a,R);
  assert.deepEqual(packed.state.skipTurns,a.skipTurns);
  assert.deepEqual(Store.parse(JSON.stringify(packed),R).state.skipTurns,a.skipTurns);
  assert.deepEqual(Store.parse(JSON.stringify(a),R).state.skipTurns,a.skipTurns);
  assert.equal(JSON.stringify(a),before);
 }
});
test('legal repeated sixes and trap landings can accumulate more than twenty pending skips',()=>{
 const a=snapshot();
 a.rules.ownColorJump.enabled=false;a.rules.dashedFlight.enabled=false;
 a.rules.homeLaneExactEntry=true;a.rules.takeoffAdvanceSteps=0;
 a.dice=6;a.consecutiveSixes={P1:0,P2:0};a.skipTurns={P1:0,P2:0};
 for(let roll=0;roll<300&&a.skipTurns.P1<=20;roll++){
  const move=R.generateLegalMoves(a,a.rules,6).find(m=>m.pieceIndex===0);
  assert.ok(move,'The same plane can legally continue with its earned six bonus');
  assert.notEqual(move.to.kind,'finished');
  a.pieces.P1[0].pos=move.to;a.consecutiveSixes.P1++;
  a.skipTurns.P1+=(move.effects||[]).filter(e=>e.type==='trap'&&e.effect==='skip-turn').length;
 }
 assert.equal(a.skipTurns.P1,21);
 const restored=Store.parse(JSON.stringify(Store.pack(a,R)),R).state;
 assert.deepEqual(restored.skipTurns,a.skipTurns);assert.deepEqual(restored.consecutiveSixes,a.consecutiveSixes);
 assert.deepEqual(restored.pieces,a.pieces);
});
test('skip counters reject negative, fractional, nonnumeric and unsafe values',()=>{
 for(const count of [-1,1.5,'21',true,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1]){
  const a=snapshot();a.skipTurns={P1:count};assert.throws(()=>Store.pack(a,R),/skipTurns/);
 }
 const a=snapshot();a.skipTurns={P1:1};
 const json=JSON.stringify(a).replace('"skipTurns":{"P1":1}', '"skipTurns":{"P1":1e309}');
 assert.throws(()=>Store.parse(json,R),/skipTurns/);
});
test('only whitelisted rule values survive import',()=>{
 const a=snapshot();a.rules.specials.portalLimit=1000;assert.throws(()=>Store.pack(a,R));a.rules.specials.portalLimit=1;a.rules.customScript='ignored';assert.equal(Store.pack(a,R).state.rules.customScript,undefined);
});
test('finished positions restore a consistent winner and exclude completed players',()=>{
 const a=snapshot();a.pieces.P1.forEach(pc=>pc.pos=R.Pos.finished());a.finishOrder=['P1'];const b=Store.pack(a,R).state;assert.equal(b.winner,'P1');assert.equal(b.turn,'P2');assert.equal(b.disabledColors.P1,true);
});
test('corrupt data never changes the valid source object',()=>{const a=snapshot(),before=JSON.stringify(a);Store.pack(a,R);assert.equal(JSON.stringify(a),before);});
