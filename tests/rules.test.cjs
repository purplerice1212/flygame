const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../src/rules.js');
const clone=x=>structuredClone(x);
function state(count=2){
 const colors=['red','blue','yellow','green'];
 const players=colors.slice(0,count).map((color,i)=>({id:'P'+(i+1),color,type:'human',name:color}));
 return {players,turn:'P1',pieces:Object.fromEntries(players.map(p=>[p.id,Array.from({length:4},(_,i)=>({pos:R.Pos.base(i),baseSlot:i}))]))};
}
function plain(extra={}){const r=clone(R.DEFAULT_RULES);r.ownColorJump.enabled=false;r.dashedFlight.enabled=false;r.specials.enabled=false;return Object.assign(r,extra);}
function moves(s,dice,r=plain()){return R.generateLegalMoves(s,r,dice);}
test('board metadata and special priority are valid',()=>{
 assert.equal(R.BOARD_VALIDATION.ok,true);
 assert.deepEqual(R.SPECIAL_RESOLUTION_ORDER,['own-color-jump','flight','portal','power-up','trap']);
});
test('invalid dice never create takeoffs or moves',()=>{
 const s=state();
 for(const dice of [0,-1,7,NaN,Infinity,2.5,'6',null]){
   assert.equal(R.canTakeoffWith(dice,plain()),false);assert.deepEqual(moves(s,dice),[]);
 }
});
test('six, five-or-six and even takeoff policies',()=>{
 const s=state();
 for(const [policy,allowed] of [['six',[6]],['fiveOrSix',[5,6]],['even',[2,4,6]]]){
   for(let dice=1;dice<=6;dice++) assert.equal(moves(s,dice,plain({takeoff:policy})).length,allowed.includes(dice)?4:0);
 }
});
test('takeoff follows start then advance positions for every colour',()=>{
 const s=state(4);
 for(const p of s.players){s.turn=p.id;const m=moves(s,6)[0];assert.equal(m.kind,'takeoff');assert.equal(m.path[0].idx,R.BOARD.track.startIndex[p.color]);assert.equal(m.to.idx,R.BOARD.track.startIndex[p.color]+1);}
});
test('one pip advances one square; reaching home entry does not teleport',()=>{
 const s=state(4);
 for(const p of s.players){
  s.turn=p.id;const entry=R.BOARD.homeLane.entryIndex[p.color];s.pieces[p.id][0].pos=R.Pos.track((entry+51)%52);
  assert.deepEqual(moves(s,1)[0].to,R.Pos.track(entry));assert.deepEqual(moves(s,2)[0].to,R.Pos.home(0));assert.deepEqual(moves(s,6)[0].to,R.Pos.home(4));
 }
});
test('six from the entry reaches the sixth home cell and finishes',()=>{
 const s=state();s.pieces.P1[0].pos=R.Pos.track(50);
 const m=moves(s,6)[0];assert.deepEqual(m.to,R.Pos.finished());
 assert.deepEqual(m.path.slice(0,6).map(p=>p.idx),[0,1,2,3,4,5]);assert.ok(m.events.some(e=>e.type==='finish'));
});
test('exact-entry option requires the last pip to enter home',()=>{
 const s=state();s.pieces.P1[0].pos=R.Pos.track(50);
 assert.deepEqual(moves(s,1,plain({homeLaneExactEntry:true}))[0].to,R.Pos.home(0));
 assert.deepEqual(moves(s,2,plain({homeLaneExactEntry:true}))[0].to,R.Pos.track(0));
});
test('exact finish rejects overshoots; bounce-back consumes every remaining pip',()=>{
 const s=state();s.pieces.P1[0].pos=R.Pos.home(4);
 assert.deepEqual(moves(s,1)[0].to,R.Pos.finished());assert.equal(moves(s,2).filter(m=>m.pieceIndex===0).length,0);
 assert.deepEqual(moves(s,2,plain({finishExact:'bounceBack'}))[0].to,R.Pos.home(4));
 assert.deepEqual(moves(s,6,plain({finishExact:'bounceBack'}))[0].to,R.Pos.home(0));
});
test('capture sends the final unsafe landing through capture resolution',()=>{
 const s=state();s.pieces.P1[0].pos=R.Pos.track(4);s.pieces.P2[0].pos=R.Pos.track(5);
 assert.deepEqual(moves(s,1)[0].capture.captured,[{color:'blue'}]);
});
test('all starting squares and configured safe squares prevent capture',()=>{
 const s=state();
 for(const idx of [0,13,26,39,3]){
   s.pieces.P1[0].pos=R.Pos.track((idx+51)%52);s.pieces.P2[0].pos=R.Pos.track(idx);
   assert.deepEqual(moves(s,1)[0].capture.captured,[]);
 }
});
test('enemy blockades prevent transit and landing even with captures disabled',()=>{
 const s=state();s.pieces.P1[0].pos=R.Pos.track(4);s.pieces.P2[0].pos=s.pieces.P2[1].pos=R.Pos.track(5);
 for(const captureOnLand of [true,false])assert.equal(moves(s,2,plain({captureOnLand})).filter(m=>m.pieceIndex===0).length,0);
 assert.ok(moves(s,2,plain({blockadePassThrough:true})).length);
});
test('own-colour jump is applied once, without recursively jumping around the board',()=>{
 const s=state();s.pieces.P1[0].pos=R.Pos.track(1);const r=plain();r.ownColorJump.enabled=true;
 const m=moves(s,1,r)[0];assert.equal(m.to.idx,6);assert.equal(m.events.filter(e=>e.type==='jump').length,1);
});
test('flights use declared endpoints',()=>{
 const s=state();s.pieces.P1[0].pos=R.Pos.track(3);const r=plain();r.dashedFlight.enabled=true;
 const m=moves(s,1,r)[0];assert.equal(m.to.idx,17);assert.equal(m.events[0].type,'flight');
});
test('jumping onto a blockade is illegal when flight capture is disabled',()=>{
 const s=state();s.pieces.P1[0].pos=R.Pos.track(3);s.pieces.P2[0].pos=s.pieces.P2[1].pos=R.Pos.track(17);
 const r=plain({captureOnLand:false});r.dashedFlight={enabled:true,captureOnLanding:false};assert.equal(moves(s,1,r).length,0);
});
test('portal hops are bounded, and turning specials off prevents teleportation',()=>{
 const s=state();s.pieces.P1[0].pos=R.Pos.track(6);const r=plain();r.specials.enabled=true;
 const m=moves(s,1,r)[0];assert.equal(m.to.idx,33);assert.equal(m.events.filter(e=>e.type==='portal').length,1);assert.equal(moves(s,1)[0].to.idx,7);
});
test('portal bypass setting controls enemy destination blockade',()=>{
 const s=state();s.pieces.P1[0].pos=R.Pos.track(6);s.pieces.P2[0].pos=s.pieces.P2[1].pos=R.Pos.track(33);
 const r=plain();r.specials.enabled=true;r.specials.portalBypassBlockade=false;assert.equal(moves(s,1,r).length,0);r.specials.portalBypassBlockade=true;assert.equal(moves(s,1,r)[0].capture.captured.length,2);
});
test('power and trap effects are attached only to final active special tiles',()=>{
 const s=state(),r=plain();r.specials.enabled=true;
 s.pieces.P1[0].pos=R.Pos.track(4);assert.equal(moves(s,1,r)[0].effects[0].effect,'extra-roll');
 s.pieces.P1[0].pos=R.Pos.track(11);assert.equal(moves(s,1,r)[0].effects[0].effect,'skip-turn');assert.deepEqual(moves(s,1)[0].effects,[]);
});
test('combined stacks have one leader, while disabled stacking forbids allies on destination',()=>{
 const s=state();s.pieces.P1[0].pos=s.pieces.P1[1].pos=R.Pos.track(4);
 const ms=moves(s,1,plain({stackMovesTogether:true}));assert.equal(ms.length,1);assert.deepEqual(ms[0].stack,[0,1]);
 s.pieces.P1[1].pos=R.Pos.track(5);assert.equal(moves(s,1,plain({stackEnabled:false})).some(m=>m.pieceIndex===0),false);
});
test('generated moves do not mutate state or rules',()=>{
 const s=state(4),r=plain(),before=JSON.stringify({s,r});for(let d=1;d<=6;d++)moves(s,d,r);assert.equal(JSON.stringify({s,r}),before);
});
