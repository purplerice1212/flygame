/* Versioned, validated local saves. No accounts, credentials or network storage. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.GameStorage=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const VERSION='skybound-variant-v2';
  const COLORS=['red','blue','yellow','green'];
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const fail=message=>{throw new Error(message);};
  const record=(o,label)=>o&&typeof o==='object'&&!Array.isArray(o)?o:fail(label+' 必須是物件');
  function integer(v,min,max,label){
    if(!Number.isSafeInteger(v)||v<min||v>max) fail(label+' 超出範圍');
    return v;
  }
  function text(v,fallback,max=120){
    if(v==null) return fallback;
    if(typeof v!=='string') fail('文字欄位無效');
    return v.slice(0,max);
  }
  function choice(v,allowed,fallback,label){
    if(v==null) return fallback;
    if(!allowed.includes(v)) fail(label+' 無效');
    return v;
  }
  function bool(v,fallback){
    if(v==null) return fallback;
    if(typeof v!=='boolean') fail('布林欄位無效');
    return v;
  }
  function position(value){
    const p=record(value,'棋子位置');
    if(p.kind==='base') return {kind:'base',slot:integer(p.slot??0,0,3,'基地位置')};
    if(p.kind==='track') return {kind:'track',idx:integer(p.idx,0,51,'棋格')};
    if(p.kind==='home') return {kind:'home',idx:integer(p.idx,0,5,'家路')};
    if(p.kind==='finished') return {kind:'finished'};
    return fail('棋子位置種類無效');
  }
  function rules(input,defaults){
    const source=input==null?{}:record(input,'規則');
    const out=JSON.parse(JSON.stringify(defaults));
    const booleans=['extraTurnOnSix','tripleSixPenalty','captureOnLand','stackEnabled','stackMovesTogether','blockadePassThrough','homeLaneExactEntry','undoEnabled'];
    booleans.forEach(key=>{out[key]=bool(source[key],out[key]);});
    out.takeoff=choice(source.takeoff,['six','fiveOrSix','even'],out.takeoff,'起飛規則');
    out.finishExact=choice(source.finishExact,['exact','noMoveIfOver','bounceBack'],out.finishExact,'終點規則');
    out.animSpeed=choice(source.animSpeed,['slow','normal','fast'],out.animSpeed,'動畫速度');
    out.turnTimerSec=integer(source.turnTimerSec??out.turnTimerSec,0,3600,'回合時間');
    out.takeoffAdvanceSteps=integer(source.takeoffAdvanceSteps??out.takeoffAdvanceSteps,0,12,'起飛步數');
    const jump=record(source.ownColorJump??{},'跳格規則');
    out.ownColorJump={enabled:bool(jump.enabled,out.ownColorJump.enabled),steps:integer(jump.steps??out.ownColorJump.steps,1,6,'跳格步數')};
    const flight=record(source.dashedFlight??{},'飛線規則');
    out.dashedFlight={enabled:bool(flight.enabled,out.dashedFlight.enabled),captureOnLanding:bool(flight.captureOnLanding,out.dashedFlight.captureOnLanding)};
    const safe=record(source.safeTiles??{},'安全格');
    const list=safe.list??out.safeTiles.list;
    if(!Array.isArray(list)||list.length>52) fail('安全格清單無效');
    out.safeTiles={start:bool(safe.start,out.safeTiles.start),list:[...new Set(list.map(n=>integer(n,0,51,'安全格')))]};
    const special=record(source.specials??{},'特殊格規則');
    out.specials={enabled:bool(special.enabled,out.specials.enabled),portalLimit:integer(special.portalLimit??out.specials.portalLimit,0,2,'傳送次數'),portalBypassBlockade:bool(special.portalBypassBlockade,out.specials.portalBypassBlockade)};
    return out;
  }
  function normalize(raw,game){
    const s=record(raw,'對局');
    if(!Array.isArray(s.players)||s.players.length<2||s.players.length>4) fail('需要 2–4 位玩家');
    const ids=new Set(),colors=new Set();
    const players=s.players.map((rawPlayer,i)=>{
      const p=record(rawPlayer,'玩家');
      if(typeof p.id!=='string'||!/^P[1-4]$/.test(p.id)||ids.has(p.id)) fail('玩家識別碼無效或重複');
      if(!COLORS.includes(p.color)||colors.has(p.color)) fail('玩家顏色無效或重複');
      ids.add(p.id);colors.add(p.color);
      const type=choice(p.type,['human','ai'],'human','玩家類型');
      return {id:p.id,name:text(p.name,'玩家'+(i+1),80),color:p.color,type,
        control:choice(p.control,['auto','keyboard','mouse'],'auto','控制方式'),
        difficulty:type==='ai'?choice(p.difficulty,['easy','normal','hard'],'normal','AI 難度'):null};
    });
    const rawPieces=record(s.pieces,'棋子'),pieces={},finishedSlots={},complete=new Set();
    for(const p of players){
      const list=rawPieces[p.id];
      if(!Array.isArray(list)||list.length!==4) fail('每位玩家需要四架飛機');
      pieces[p.id]=list.map((rawPiece,i)=>{
        const piece=record(rawPiece,'飛機');
        let pos=position(piece.pos);
        if(pos.kind==='home'&&pos.idx===5) pos={kind:'finished'};
        const result={pos,baseSlot:integer(piece.baseSlot??i,0,3,'停泊位置')};
        if(pos.kind==='finished') result.finishedSlot=integer(piece.finishedSlot??i,0,3,'完賽位置');
        return result;
      });
      finishedSlots[p.id]={};
      pieces[p.id].forEach((pc,i)=>{if(pc.pos.kind==='finished')finishedSlots[p.id][i]=pc.finishedSlot;});
      if(pieces[p.id].every(pc=>pc.pos.kind==='finished')) complete.add(p.id);
    }
    const finishOrder=[];
    for(const id of Array.isArray(s.finishOrder)?s.finishOrder:[]){
      if(!ids.has(id)||!complete.has(id)||finishOrder.includes(id)) fail('完賽名次無效');
      finishOrder.push(id);
    }
    complete.forEach(id=>{if(!finishOrder.includes(id))finishOrder.push(id);});
    let turn=s.turn??null;
    if(turn!==null&&!ids.has(turn)) fail('當前玩家無效');
    if(turn===null&&complete.size!==players.length) fail('對局未完結但沒有當前玩家');
    if(turn!==null&&complete.has(turn)) turn=players.find(p=>!complete.has(p.id))?.id??null;
    const settings=record(s.settings??{},'設定');
    const normalizedRules=rules(s.rules,game.DEFAULT_RULES);
    // Without the optional penalty, the engine may legitimately roll any number
    // of consecutive sixes. Preserve that count through save/export and import.
    const sixesLimit=normalizedRules.tripleSixPenalty?3:Number.MAX_SAFE_INTEGER;
    const counters=(key,max)=>Object.fromEntries(players.map(p=>[p.id,integer(s[key]?.[p.id]??0,0,max,key)]));
    let pendingBonus=null;
    if(s.pendingBonus!=null){
      const bonus=record(s.pendingBonus,'增益');
      pendingBonus={dice:integer(bonus.dice,1,6,'增益步數'),pieceIndex:integer(bonus.pieceIndex,0,3,'增益飛機'),
        restrict:choice(bonus.restrict,['same','others'],'same','增益限制'),description:text(bonus.description,'增益移動'),source:'power-up',autoResolve:bool(bonus.autoResolve,true)};
    }
    let summary=null;
    if(s.lastMoveSummary!=null){
      const m=record(s.lastMoveSummary,'上一步');
      const player=players.find(p=>p.id===m.player?.id);
      if(player&&Array.isArray(m.path)&&m.path.length<=80){
        summary={player:{id:player.id,name:player.name,color:player.color},dice:integer(m.dice,1,6,'上一步骰值'),
          description:text(m.description,'移動'),path:m.path.map(position),pieceIndex:integer(m.pieceIndex,0,3,'上一步飛機'),
          stackSize:integer(m.stackSize??1,1,4,'疊子數'),kind:choice(m.kind,['move','takeoff'],'move','移動種類'),
          captured:(Array.isArray(m.captured)?m.captured:[]).slice(0,12).map(c=>({color:choice(c.color,COLORS,'red','被吃子顏色')}))};
      }
    }
    return {players,pieces,turn,rules:normalizedRules,dice:s.dice==null?null:integer(s.dice,1,6,'骰值'),
      consecutiveSixes:counters('consecutiveSixes',sixesLimit),
      // Extra rolls can accumulate traps before the next scheduled turn.
      skipTurns:counters('skipTurns',Number.MAX_SAFE_INTEGER),
      turbulenceRecoveries:Object.fromEntries(players.map(p=>[p.id,0])),
      bonusSelecting:bool(s.bonusSelecting,false)&&!!pendingBonus,pendingBonus,pendingExtraTurn:bool(s.pendingExtraTurn,false),
      settings:{keyboardMode:choice(settings.keyboardMode,['shared','dual','custom'],'shared','鍵盤模式'),theme:choice(settings.theme,['dark','light','high'],'dark','主題'),debugBoard:bool(settings.debugBoard,false)},
      lastMoveSummary:summary,finishOrder,winner:finishOrder[0]??null,disabledColors:Object.fromEntries([...complete].map(id=>[id,true])),finishedSlots};
  }
  function parse(raw,game){
    if(typeof raw!=='string'||raw.length>200000) fail('存檔過大或格式無效');
    const parsed=JSON.parse(raw,(key,value)=>{
      if(['__proto__','prototype','constructor'].includes(key)) fail('存檔含不安全欄位');
      return value;
    });
    record(parsed,'存檔');
    let state=parsed;
    if(own(parsed,'state')){
      if(parsed.version!==VERSION||parsed.board!==game.BOARD.boardSpecVersion) fail('存檔版本不相容');
      state=parsed.state;
    }
    return {version:VERSION,board:game.BOARD.boardSpecVersion,state:normalize(state,game)};
  }
  function pack(state,game){return {version:VERSION,board:game.BOARD.boardSpecVersion,state:normalize(state,game)};}
  return Object.freeze({VERSION,parse,pack,normalize});
});
