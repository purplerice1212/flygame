const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const rules=require('../src/rules.js');

// Execute the real application methods. Only browser rendering/storage and the
// animation boundary are replaced; turn selection and move resolution stay real.
function appFixture(count=2){
  const timers=new Map();let nextTimer=1,modalOpen=false;
  const browser={addEventListener(){},GameRules:rules};
  const document={
    createElement(){return {showModal(){}};},
    querySelector(selector){return selector==='dialog[open]'&&modalOpen?{}:null;}
  };
  const randomMath=Object.create(Math);randomMath.random=()=>0.25;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8'),{
    window:browser,document,console,structuredClone,Math:randomMath,
    setTimeout(fn){const id=nextTimer++;timers.set(id,fn);return id;},
    clearTimeout(id){timers.delete(id);}
  });
  const app=browser.App;
  app.$={diceOut:{textContent:''},timer:{textContent:''},gHL:{innerHTML:''},btnRoll:{setAttribute(){},removeAttribute(){}}};
  for(const name of ['log','renderLastMove','previewLastMove','updateTurnUI','saveGame',
    'updateTurnPrompt','maybeAutoPlayIfAI','showToast','redrawPieces','pulseAt',
    'showThreatBadge','renderHints','highlightMovables']) app[name]=()=>{};
  app.posToXY=()=>({x:0,y:0});app.resolveMovePath=()=>[];
  app.describeMove=()=>'';app.animatePiece=()=>Promise.resolve();
  const colors=['red','blue','yellow','green'];
  app.state.players=colors.slice(0,count).map((color,i)=>({id:'P'+(i+1),name:color,color,type:'human'}));
  app.state.pieces=Object.fromEntries(app.state.players.map(p=>[p.id,Array.from({length:4},(_,i)=>({pos:rules.Pos.base(i),baseSlot:i}))]));
  app.state.rules=structuredClone(rules.DEFAULT_RULES);
  app.state.rules.ownColorJump.enabled=false;app.state.rules.dashedFlight.enabled=false;app.state.rules.specials.enabled=false;
  app.state.rules.turnTimerSec=1;
  app.state.view='game';app.state.turn='P1';
  app.state.skipTurns=Object.fromEntries(app.state.players.map(p=>[p.id,0]));
  app.state.consecutiveSixes=Object.fromEntries(app.state.players.map(p=>[p.id,0]));
  return {app,timers,setModal(value){modalOpen=value;}};
}

function moveFor(app,dice,idx=3){
  app.state.pieces[app.state.turn][0].pos=rules.Pos.track(idx);
  app.state.dice=dice;
  app.state.legalMoves=rules.generateLegalMoves(app.state,app.state.rules,dice);
  const move=app.state.legalMoves.find(m=>m.pieceIndex===0);
  assert.ok(move,'fixture must produce a legal move');
  return move;
}

test('a committed choice cancels its deadline before animation and cannot skip the next player',async()=>{
  const {app,timers}=appFixture();
  const move=moveFor(app,1);
  app.beginTurnTimer();const deadline=app.state.turnTimerId;
  assert.ok(timers.has(deadline));
  let finishAnimation;app.animatePiece=()=>new Promise(resolve=>{finishAnimation=resolve;});
  const completion=app.applyMove(move,'system');
  assert.equal(app.state.animating,true);
  assert.equal(app.state.turnTimerId,null);
  assert.equal(timers.has(deadline),false);
  app.handleTurnTimerExpired();
  assert.equal(app.state.turn,'P1','a stale deadline must not change the player during animation');
  finishAnimation();await completion;
  assert.equal(app.state.pieces.P1[0].pos.idx,4);
  assert.equal(app.state.turn,'P2','the completed move advances exactly once');
});

test('deadline callbacks cannot change a game in the lobby or behind a dialog',()=>{
  const {app,setModal}=appFixture();
  app.state.dice=2;app.state.view='lobby';app.handleTurnTimerExpired();
  assert.equal(app.state.turn,'P1');
  app.state.view='game';setModal(true);app.handleTurnTimerExpired();
  assert.equal(app.state.turn,'P1');assert.equal(app.state.dice,2);
});

test('expiring a bonus choice releases the next player to roll normally',()=>{
  const {app}=appFixture();
  app.state.dice=1;
  app.state.bonusSelecting=true;
  app.state.pendingBonus={dice:1,restrict:'others',pieceIndex:0,autoResolve:false};
  app.state.pendingExtraTurn=true;
  app.handleTurnTimerExpired();
  assert.equal(app.state.turn,'P2');
  assert.equal(app.state.bonusSelecting,false);
  assert.equal(app.state.pendingBonus,null);
  assert.equal(app.state.pendingExtraTurn,false);
  app.rollDice('system');
  assert.equal(app.state.dice,2);
  assert.ok(app.state.legalMoves.length>0);
});

test('a bonus requiring a player choice receives a fresh deadline after animation',async()=>{
  const {app,timers}=appFixture();
  app.state.pieces.P1[1].pos=rules.Pos.track(8);
  const move=moveFor(app,1);
  // Command bonuses are supported by compatible saves and the app effect layer.
  move.effects=[{type:'power-up',effect:'command-other'}];
  await app.applyMove(move,'system');
  assert.equal(app.state.turn,'P1');
  assert.equal(app.state.bonusSelecting,true);
  assert.ok(app.state.legalMoves.length>0);
  assert.ok(timers.has(app.state.turnTimerId));
});

test('a trap does not consume an immediately earned extra roll',async()=>{
  const {app}=appFixture();app.state.rules.specials.enabled=true;
  const move=moveFor(app,6,6);
  await app.applyMove(move,'system');
  assert.equal(app.state.turn,'P1');
  assert.equal(app.state.skipTurns.P1,1);
  assert.equal(app.state.dice,null);
  app.advanceTurn();assert.equal(app.state.turn,'P2');assert.equal(app.state.skipTurns.P1,1);
  app.advanceTurn();assert.equal(app.state.turn,'P2');assert.equal(app.state.skipTurns.P1,0);
});

test('all-skipped players with maximum safe counters resume in bounded work',()=>{
  const {app}=appFixture();
  app.state.skipTurns={P1:Number.MAX_SAFE_INTEGER,P2:Number.MAX_SAFE_INTEGER};
  app.advanceTurn();
  assert.equal(app.state.turn,'P2');
  assert.equal(app.state.skipTurns.P1,0);assert.equal(app.state.skipTurns.P2,0);
});

test('bulk skipped rotations retain relative penalties and exclude finished players',()=>{
  const {app}=appFixture(4);
  app.state.finishOrder=['P2'];app.state.disabledColors={P2:true};
  const max=Number.MAX_SAFE_INTEGER;
  app.state.skipTurns={P1:max,P2:5,P3:max-1,P4:max-1};
  app.advanceTurn();
  assert.equal(app.state.turn,'P3');
  assert.equal(app.state.skipTurns.P1,1);assert.equal(app.state.skipTurns.P2,0);
  assert.equal(app.state.skipTurns.P3,0);assert.equal(app.state.skipTurns.P4,0);
  app.advanceTurn();assert.equal(app.state.turn,'P4');
  app.advanceTurn();assert.equal(app.state.turn,'P3');assert.equal(app.state.skipTurns.P1,0);
});
