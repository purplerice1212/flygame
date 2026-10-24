  // =========================== Rules Engine ============================
  (function(root){
      const BOARD = {
        boardSpecVersion: "skybound-variant-v2",
      track: { length: 52, orderClockwise: ["red","blue","yellow","green"], startIndex: { red:0, blue:13, yellow:26, green:39 } },
      homeLane: { length: 6, entryIndex: { red:50, blue:11, yellow:24, green:37 } },
      special: {
        safeTiles: {
          start:true,
          extra:[3,9,16,22,29,35,42,48]
        },
        powerTiles:[
          {idx:5,effect:'extra-roll',label:'🎲'},
          {idx:18,effect:'extra-roll',label:'🎲'},
          {idx:31,effect:'extra-roll',label:'🎲'},
          {idx:44,effect:'extra-roll',label:'🎲'}
        ],
        trapTiles:[
          {idx:12,effect:'skip-turn',label:'⚠'},
          {idx:25,effect:'skip-turn',label:'⚠'},
          {idx:38,effect:'skip-turn',label:'⚠'},
          {idx:51,effect:'skip-turn',label:'⚠'}
        ],
        portals:[
          {label:'A',from:7,to:33},
          {label:'A',from:33,to:7},
          {label:'B',from:20,to:46},
          {label:'B',from:46,to:20}
        ],
        ownColorJump: {
          enabled:true,
          steps:4,
          interval:4,
          firstOffset:2,
          indices:{}
        },
        flightPaths:{ enabled:true, captureOnLanding:true, edges:{
          red:[{from:4,to:17},{from:8,to:21}],
          blue:[{from:17,to:30},{from:21,to:34}],
          yellow:[{from:30,to:43},{from:34,to:47}],
          green:[{from:43,to:4},{from:47,to:8}],
        } }
      },
      bases:{ perPlayer:4 }
    };

    function buildOwnColorJumpData(board){
      const trackLength = Number(board?.track?.length) || 0;
      if(trackLength <= 0){
        return {
          indices:Object.freeze({}),
          lookupByColor:Object.freeze({}),
          lookupByIndex:Object.freeze({})
        };
      }
      const parseInteger = (value,fallback)=>{
        const parsed = parseInt(value,10);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      const startIndex = board?.track?.startIndex || {};
      const colorOrder = Array.isArray(board?.track?.orderClockwise) && board.track.orderClockwise.length
        ? board.track.orderClockwise
        : Object.keys(startIndex);
      const jumpSpec = board?.special?.ownColorJump || {};
      const rawOffset = parseInteger(jumpSpec.firstOffset, 2);
      const rawInterval = parseInteger(jumpSpec.interval, 4);
      const interval = Math.max(1, Math.abs(rawInterval));
      const wrap = (value)=> ((value % trackLength) + trackLength) % trackLength;
      const indicesResult = {};
      const lookupByColor = {};
      const lookupByIndex = {};
      for(const color of colorOrder){
        const start = startIndex[color];
        if(typeof start !== 'number'){
          indicesResult[color] = Object.freeze([]);
          lookupByColor[color] = new Set();
          continue;
        }
        const entries = [];
        const visited = new Set();
        let idx = wrap(start + rawOffset);
        while(!visited.has(idx)){
          entries.push(idx);
          visited.add(idx);
          lookupByIndex[idx] = color;
          idx = wrap(idx + interval);
        }
        indicesResult[color] = Object.freeze(entries);
        lookupByColor[color] = visited;
      }
      return {
        indices:Object.freeze(indicesResult),
        lookupByColor:Object.freeze(lookupByColor),
        lookupByIndex:Object.freeze(lookupByIndex)
      };
    }

    const OWN_COLOR_JUMP_DATA = buildOwnColorJumpData(BOARD);
    BOARD.special.ownColorJump.indices = OWN_COLOR_JUMP_DATA.indices;
    BOARD.special.ownColorJump.lookupByColor = OWN_COLOR_JUMP_DATA.lookupByColor;
    BOARD.special.ownColorJump.lookupByIndex = OWN_COLOR_JUMP_DATA.lookupByIndex;

    function validateBoard(BOARD){
      const issues=[];
      const safe = new Set([
        ...((BOARD.special?.safeTiles?.extra)||[]),
        ...((BOARD.special?.safeTiles?.list)||[])
      ]);
      if(BOARD.special?.safeTiles?.start!==false){
        Object.values(BOARD.track?.startIndex||{}).forEach(idx=>{
          if(typeof idx==='number') safe.add(idx);
        });
      }
      const map = new Map();
      const reg = (idx,type)=>{
        if(typeof idx!=='number') return;
        map.set(idx,(map.get(idx)||[]).concat(type));
      };
      const trackLength=Number(BOARD?.track?.length)||0;
      const isValidTrackIdx=(idx)=>Number.isInteger(idx)&&idx>=0&&idx<trackLength;
      (BOARD.special?.powerTiles||[]).forEach(p=>reg(p.idx,'power'));
      (BOARD.special?.trapTiles||[]).forEach(t=>reg(t.idx,'trap'));
      (BOARD.special?.portals||[]).forEach(p=>reg(p.from,'portal'));
      const conflicts=[...map.entries()].filter(([idx,types])=>types.length>1 || safe.has(idx));
      if(conflicts.length){
        issues.push(`特殊格重疊或與安全格衝突：${conflicts.map(([idx])=>idx).join(', ')}`);
      }
      const startValues=Object.values(BOARD?.track?.startIndex||{});
      const entryValues=Object.values(BOARD?.homeLane?.entryIndex||{});
      startValues.forEach((idx)=>{ if(!isValidTrackIdx(idx)) issues.push(`起飛格索引超出範圍：${idx}`); });
      entryValues.forEach((idx)=>{ if(!isValidTrackIdx(idx)) issues.push(`入家索引超出範圍：${idx}`); });
      if(trackLength>0 && startValues.length===4){
        const expectedGap=Math.floor(trackLength/4);
        const sorted=[...startValues].sort((a,b)=>a-b);
        const gaps=sorted.map((v,i)=>{
          const nxt=sorted[(i+1)%sorted.length];
          return (nxt-v+trackLength)%trackLength;
        });
        if(gaps.some(gap=>gap!==expectedGap)){
          issues.push(`四個起飛格間距不均（目前 ${gaps.join('/')}, 建議都為 ${expectedGap}）`);
        }
      }
      (BOARD.special?.portals||[]).forEach((p)=>{
        if(!isValidTrackIdx(p?.from)||!isValidTrackIdx(p?.to)){
          issues.push(`傳送門 ${p?.label||'?'} 索引超出範圍（${p?.from}→${p?.to}）`);
        }
      });
      Object.values(BOARD?.special?.flightPaths?.edges||{}).flat().forEach((edge)=>{
        if(!isValidTrackIdx(edge?.from)||!isValidTrackIdx(edge?.to)){
          issues.push(`飛行路徑索引超出範圍（${edge?.from}→${edge?.to}）`);
        }
      });
      if(issues.length) console.warn('Board validation issues:', issues);
      return Object.freeze({ok:issues.length===0,issues});
    }

    const BOARD_VALIDATION = validateBoard(BOARD);

    const COLOR_MARKERS = Object.freeze({
      red:{shape:'triangle',symbol:'▲',label:'紅'},
      blue:{shape:'square',symbol:'■',label:'藍'},
      yellow:{shape:'diamond',symbol:'◆',label:'黃'},
      green:{shape:'cross',symbol:'✚',label:'綠'}
    });

    const SPECIAL_BY_IDX = (()=>{
      const registry={};
      const assign=(idx,data)=>{
        if(typeof idx!=='number') return;
        registry[idx]=Object.freeze(data);
      };
      (BOARD.special?.powerTiles||[]).forEach(p=>{
        assign(p.idx,{type:'power',idx:p.idx,effect:p.effect,label:p.label});
      });
      (BOARD.special?.trapTiles||[]).forEach(t=>{
        assign(t.idx,{type:'trap',idx:t.idx,effect:t.effect,label:t.label});
      });
      (BOARD.special?.portals||[]).forEach(p=>{
        assign(p.from,{type:'portal',from:p.from,to:p.to,label:p.label,color:p.color||null});
      });
      return Object.freeze(registry);
    })();

    const DEFAULT_RULES = {
      takeoff:"even", extraTurnOnSix:true, tripleSixPenalty:false,
      captureOnLand:true, stackEnabled:true, stackMovesTogether:false, blockadePassThrough:false,
      ownColorJump:{enabled:true,steps:4}, dashedFlight:{enabled:true,captureOnLanding:true},
      homeLaneExactEntry:false, finishExact:"exact", safeTiles:{start:true,list:[3,9,16,22,29,35,42,48]},
      specials:{enabled:true,portalLimit:1,portalBypassBlockade:true},
      turnTimerSec:0, animSpeed:'normal', undoEnabled:true,
      takeoffAdvanceSteps:1, // 0 = stop on the start tile, 1 = step one tile after entering
    };

    const mod = (n,m)=>((n%m)+m)%m;
    const clone = (x)=> (typeof structuredClone==='function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));
    const SPECIAL_RESOLUTION_ORDER = Object.freeze(['own-color-jump','flight','portal','power-up','trap']);

    const Pos = {
      base:(slot=0)=>({kind:'base',slot}),
      track:(idx)=>({kind:'track',idx}),
      home:(idx)=>({kind:'home',idx}),
      finished:()=>({kind:'finished'}),
      isEqual:(a,b)=>{
        if(a.kind!==b.kind) return false;
        const key = (obj)=>{
          if(typeof obj.idx==='number') return obj.idx;
          if(typeof obj.slot==='number') return obj.slot;
          return -1;
        };
        return key(a)===key(b);
      }
    };

    function buildOccupancy(state){
      const occ={ track:Array(BOARD.track.length).fill(0).map(()=>({})), home:{} };
      const players=Array.isArray(state?.players)?state.players:[];
      const piecesByPlayer=(state&&typeof state==='object'&&state.pieces&&typeof state.pieces==='object')?state.pieces:{};
      for(const player of players){
        if(!player || typeof player!=='object') continue;
        const playerId=player.id;
        if(typeof playerId!=='string'&&typeof playerId!=='number') continue;
        const playerPieces=Array.isArray(piecesByPlayer[playerId])?piecesByPlayer[playerId]:[];
        for(const pc of playerPieces){
          const pos=pc?.pos;
          if(!pos) continue;
          if(pos.kind==='track'){
            if(!Number.isInteger(pos.idx) || pos.idx<0 || pos.idx>=(pos.kind==='track'?BOARD.track.length:BOARD.homeLane.length)) continue;
            const bucket=occ.track[pos.idx]||(occ.track[pos.idx]={});
            bucket[player.color]=(bucket[player.color]||0)+1;
          }else if(pos.kind==='home'){
            if(!Number.isInteger(pos.idx) || pos.idx<0 || pos.idx>=(pos.kind==='track'?BOARD.track.length:BOARD.homeLane.length)) continue;
            if(!occ.home[player.color]) occ.home[player.color]=Array(BOARD.homeLane.length).fill(0);
            occ.home[player.color][pos.idx]+=1;
          }
        }
      }
      return occ;
    }

    function canTakeoffWith(dice,rules){
      if(!Number.isInteger(dice)||dice<1||dice>6) return false;
      if(rules.takeoff==='six') return dice===6;
      if(rules.takeoff==='fiveOrSix') return dice===5||dice===6;
      if(rules.takeoff==='even') return dice%2===0;
      return dice===6;
    }

    function isOwnJumpTile(color,idx){
      if(!color || typeof idx !== 'number') return false;
      const lookup=BOARD.special?.ownColorJump?.lookupByColor?.[color];
      if(lookup instanceof Set) return lookup.has(idx);
      const list=BOARD.special?.ownColorJump?.indices?.[color];
      return Array.isArray(list) ? list.includes(idx) : false;
    }
    function flightTo(color,idx){
      const edges=BOARD?.special?.flightPaths?.edges;
      if(!edges) return null;
      const list=edges[color];
      if(!Array.isArray(list)) return null;
      const entry=list.find(e=>e?.from===idx);
      return entry?entry.to:null;
    }
    function isAnyStartTile(idx){ return Object.values(BOARD.track.startIndex).includes(idx); }
    function isSafeTrackTile(color,idx,rules){
      if(rules.safeTiles.start && isAnyStartTile(idx)) return true;
      return (rules.safeTiles.list||[]).includes(idx);
    }

    function generateLegalMoves(state,rules,dice){
      generateLegalMoves.lastWarnings=[];
      if(!Number.isInteger(dice)||dice<1||dice>6) return [];
      const player = state.players.find(p=>p.id===state.turn);
      if(!player) return [];
      const warnings=[];
      const occ = buildOccupancy(state);
      const myPieces = state.pieces[player.id]||[];
      const moves=[];
      const stackInfo=new Map();
      if(rules.stackMovesTogether && rules.stackEnabled!==false){
        const byIdx=new Map();
        myPieces.forEach((piece,idx)=>{
          if(piece.pos?.kind==='track'){
            if(!byIdx.has(piece.pos.idx)) byIdx.set(piece.pos.idx,[]);
            byIdx.get(piece.pos.idx).push(idx);
          }
        });
        byIdx.forEach((indices,idx)=>{
          indices.sort((a,b)=>a-b);
          stackInfo.set(idx,{indices,leader:indices[0]});
        });
      }
      myPieces.forEach((piece,i)=>{
        const pos=piece.pos; if(!pos || pos.kind==='finished') return;
        let stackGroup=null;
        if(rules.stackMovesTogether && rules.stackEnabled!==false && pos.kind==='track'){
          const info=stackInfo.get(pos.idx);
          if(info && info.indices.length>1){
            if(i!==info.leader) return;
            stackGroup=info.indices.slice();
          }
        }
        if(pos.kind==='base'){
          if(canTakeoffWith(dice,rules)){
            const startIndexMap = BOARD?.track?.startIndex || {};
            const rawDestIdx = startIndexMap[player.color];
            if(typeof rawDestIdx!=='number' || Number.isNaN(rawDestIdx)){
              warnings.push({type:'invalid-start',playerId:player.id,color:player.color});
              return;
            }
            const destIdx = mod(rawDestIdx, BOARD.track.length);
            const tileOcc = occ.track[destIdx] || {};
            const enemyCount = Object.entries(tileOcc).filter(([c,n])=>c!==player.color).reduce((a,[,n])=>a+n,0);
            const allyCount = tileOcc[player.color]||0;
            if(!(allyCount>0 && !rules.stackEnabled) && !(enemyCount>=2 && !rules.blockadePassThrough)){
              const events=[];
              const stepCount = Math.max(0, parseInt(rules.takeoffAdvanceSteps ?? 0, 10) || 0);
              let landingIdx = destIdx;
              const pathRecord=[clone(Pos.track(landingIdx))];
              for(let s=0; s<stepCount; s++){
                const nextIdx = mod(landingIdx + 1, BOARD.track.length);
                const nextOcc = occ.track[nextIdx] || {};
                const enemyBlock = Object.entries(nextOcc).some(([c,n])=>c!==player.color && n>=2);
                if(enemyBlock && !rules.blockadePassThrough){
                  break;
                }
                landingIdx = nextIdx;
                pathRecord.push(clone(Pos.track(landingIdx)));
              }
              let final=Pos.track(landingIdx);
              const special=resolveSpecialsAfterLanding(player,final,rules,occ,events,{recordPath:true,pathRecord});
              final=special.final; const eventLog=special.events; const effectsLog=special.effects||[];
              const capture=resolveCaptureOnTrack(player,final,rules,occ,{viaFlight:special.viaFlight,viaPortal:special.viaPortal});
              const path=(special.path&&special.path.length?special.path:pathRecord);
              let blockedByAlly=false;
              if(final.kind==='track' && rules.stackEnabled===false){
                const occDest=occ.track[final.idx]||{};
                if((occDest[player.color]||0)>0) blockedByAlly=true;
              }
              if(!(capture?.blocked) && !blockedByAlly){
                moves.push({pieceIndex:i,kind:'takeoff',dice,from:pos,to:final,events:eventLog,effects:effectsLog,capture,stack:[i],path});
              }else if(capture?.blocked && capture.reason==='enemy-blockade' && capture.viaPortal){
                warnings.push({type:'portal-blocked',idx:final.idx,playerId:player.id,source:'takeoff'});
              }
            }
          }
          return;
        }
        const sim = simulateMove(player,pos,dice,rules,occ,{recordPath:true});
        if(sim && sim.legal){
          const allowStack=rules.stackEnabled!==false;
          const group=(allowStack && stackGroup)?stackGroup.slice():[i];
          if(sim.final && sim.final.kind==='track' && rules.stackEnabled===false){
            const occDest=occ.track[sim.final.idx]||{};
            let allyCount=occDest[player.color]||0;
            const movingCount=group.reduce((sum,idx2)=>{
              const mover=myPieces[idx2];
              if(mover?.pos?.kind==='track' && mover.pos.idx===sim.final.idx) return sum+1;
              return sum;
            },0);
            allyCount=Math.max(0,allyCount-movingCount);
            if(allyCount>0) return;
          }
          moves.push({pieceIndex:i,kind:'move',dice,from:pos,to:sim.final,events:sim.events,effects:sim.effects||[],capture:sim.capture,stack:group,path:sim.path||[]});
        }
      });
      generateLegalMoves.lastWarnings=warnings;
      return moves;
    }

    function simulateMove(player,fromPos,dice,rules,occ,options={}){
      if(!Number.isInteger(dice)||dice<1||dice>6) return {legal:false,reason:'invalid-dice',events:[]};
      let current=clone(fromPos); let remaining=dice; let events=[];
      const entryIdx=BOARD.homeLane.entryIndex[player.color];
      const isEnemyBlockade=(idx)=>{ const tileOcc=occ.track[idx]; return Object.entries(tileOcc).filter(([c,n])=>c!==player.color).some(([,n])=>n>=2); };
      let stepsTaken=0;
      const recordPath=options.recordPath===true;
      const pathRecord=recordPath?[]:null;
      const recordPosition=(pos)=>{
        if(!recordPath || !pathRecord) return;
        pathRecord.push(clone(pos));
      };
      while(remaining>0){
        if(current.kind==='track'){
          if(current.idx===entryIdx){
            // 如有步數便可立即進入家路（經典）；若啟用精準入場則需剛好一步。
            const allowImmediateEntry = rules.homeLaneExactEntry ? (remaining===1) : (remaining>0);
            if(allowImmediateEntry){
              current=Pos.home(0);
              remaining-=1;
              stepsTaken+=1;
              events.push({type:'enter-home'});
              recordPosition(current);
              continue;
            }
          }
          const nextIdx = mod(current.idx+1, BOARD.track.length);
          if(!rules.blockadePassThrough && isEnemyBlockade(nextIdx)) return {legal:false,reason:'blocked-by-enemy-stack',events};
          current=Pos.track(nextIdx); remaining-=1; stepsTaken+=1; recordPosition(current);
        } else if(current.kind==='home'){
          const laneLength=BOARD.homeLane.length;
          const next=current.idx+1;
          if(next<laneLength){
            current=Pos.home(next);
            remaining-=1;
            stepsTaken+=1;
            recordPosition(current);
          } else {
            if(rules.finishExact==='exact') return {legal:false,reason:'need-exact-to-finish',events};
            if(rules.finishExact==='noMoveIfOver') return {legal:false,reason:'no-move-if-over',events};
            if(rules.finishExact==='bounceBack'){
              const last=laneLength-1;
              const overshootTotal=Math.max(0,remaining);
              let overshoot=overshootTotal;
              let idx=current.idx;
              let direction=-1;
              while(overshoot>0){
                let nextIdx=idx+direction;
                if(nextIdx<0){ direction=1; nextIdx=idx+direction; }
                if(nextIdx>last){ direction=-1; nextIdx=idx+direction; }
                idx=nextIdx;
                current=Pos.home(idx);
                recordPosition(current);
                stepsTaken+=1;
                overshoot-=1;
              }
              remaining=0;
              if(overshootTotal>0){
                events.push({type:'bounce-back',steps:overshootTotal});
              }
            }
          }
        } else if(current.kind==='base' || current.kind==='finished'){
          return {legal:false,reason:'invalid-start',events};
        }
      }
      let capture=null;
      let specialEffects=[];
      if(current.kind==='track'){
        const special=resolveSpecialsAfterLanding(player,current,rules,occ,events,{recordPath,pathRecord});
        current=special.final; events=special.events; specialEffects=special.effects||[];
        capture=resolveCaptureOnTrack(player,current,rules,occ,{viaFlight:special.viaFlight,viaPortal:special.viaPortal});
        if(capture?.blocked) return {legal:false,reason:'land-on-enemy-blockade',events};
      } else if(current.kind==='home'){
        if(current.idx===BOARD.homeLane.length-1){ current=Pos.finished(); events.push({type:'finish'}); if(recordPath && pathRecord) pathRecord.push(clone(current)); }
      }
      return {legal:true,final:current,events,capture,effects:specialEffects,path:recordPath?pathRecord:undefined};
    }

    function resolveSpecialsAfterLanding(player,pos,rules,occ,events,options={}){
      // The order of resolution is fixed (see SPECIAL_RESOLUTION_ORDER):
      // own-colour jump → flight → limited portal hops → power-ups → traps.
      let current=clone(pos);
      let viaFlight=false;
      let viaPortal=false;
      const effects=[];
      const recordPath=options.recordPath===true;
      const pathRecord=recordPath?(options.pathRecord||[]):null;
      const recordPosition=(p)=>{ if(!recordPath || !pathRecord) return; pathRecord.push(clone(p)); };
      // Ensure the own-colour jump runs at most once per landing resolution.
      let jumpConsumed = options.jumpConsumed === true;
      const playerColor = player?.color;
      const ownJumpRule = rules?.ownColorJump || {};
      const jumpEnabled = ownJumpRule.enabled !== false;
      const jumpDistance = Math.max(1, parseInt(ownJumpRule.steps ?? 4,10) || 4);
      if(
        !jumpConsumed &&
        jumpEnabled &&
        current.kind==='track' &&
        playerColor &&
        isOwnJumpTile(playerColor,current.idx)
      ){
        const target = mod(current.idx + jumpDistance, BOARD.track.length);
        current = Pos.track(target);
        events.push({type:'jump',from:pos.idx,to:target,color:playerColor});
        recordPosition(current);
        jumpConsumed = true;
        options.jumpConsumed = true;
      }
      const flightsEnabled = (BOARD.special.flightPaths?.enabled!==false);
      const flightRule = rules.dashedFlight||{};
      if(flightsEnabled && flightRule.enabled && current.kind==='track'){
        const to = flightTo(player.color,current.idx);
        if(to!=null){
          const flightFrom=current.idx;
          current=Pos.track(to);
          events.push({type:'flight',from:flightFrom,to});
          viaFlight=true;
          recordPosition(current);
        }
      }
      const specialsConfig = rules.specials||{};
      const specialsActive = specialsConfig.enabled!==false;
      const portalLimit = Math.max(0, specialsConfig.portalLimit ?? 1);
      const portalLookup = SPECIAL_BY_IDX || {};
      const visitedPortals=new Set();
      let portalCount=0;
      while(specialsActive && current.kind==='track'){
        const portal = portalLookup[current.idx];
        if(!portal || portal.type!=='portal' || visitedPortals.has(current.idx) || portalCount>=portalLimit) break;
        if(portal.color && portal.color!==player.color) break;
        visitedPortals.add(current.idx);
        portalCount+=1;
        current=Pos.track(portal.to); recordPosition(current);
        events.push({type:'portal',label:portal.label,from:portal.from,to:portal.to});
        viaPortal=true;
      }
      if(specialsActive && current.kind==='track'){
        const entry = portalLookup[current.idx];
        if(entry && entry.type==='power'){
          const detail={type:'power-up',effect:entry.effect,label:entry.label,idx:entry.idx};
          events.push(detail); effects.push(detail);
        } else if(entry && entry.type==='trap'){
          const detail={type:'trap',effect:entry.effect,label:entry.label,idx:entry.idx};
          events.push(detail); effects.push(detail);
        }
      }
      return {final:current,events,viaFlight,viaPortal,effects,path:pathRecord};
    }

    function resolveCaptureOnTrack(player,pos,rules,occ,context={}){
      if(pos.kind!=='track') return null;
      const boardAllowsFlightCapture = BOARD.special.flightPaths.captureOnLanding!==false;
      const flightRule = rules.dashedFlight||{};
      const flightCaptureDisabled=context?.viaFlight && (!boardAllowsFlightCapture || flightRule.captureOnLanding===false);
      const tileOcc=occ.track[pos.idx];
      const enemyEntries=Object.entries(tileOcc).filter(([c,n])=>c!==player.color && n>0);
      const hasEnemyBlockade = enemyEntries.some(([,n])=>n>=2);
      if(hasEnemyBlockade){
        const portalBypassAllowed = context?.viaPortal && !(rules?.specials?.portalBypassBlockade===false);
        const blockadeBypassAllowed = !!(rules && rules.blockadePassThrough) || portalBypassAllowed;
        if(!blockadeBypassAllowed){
          return {blocked:true,reason:'enemy-blockade',viaPortal:!!context?.viaPortal};
        }
      }
      if(!rules.captureOnLand || flightCaptureDisabled || isSafeTrackTile(player.color,pos.idx,rules)) return {captured:[]};
      const captured=[]; for(const [c,n] of enemyEntries){ for(let i=0;i<n;i++) captured.push({color:c}); }
      return {captured};
    }

    const api = { BOARD, BOARD_VALIDATION, DEFAULT_RULES, generateLegalMoves, simulateMove, buildOccupancy, Pos, canTakeoffWith, SPECIAL_RESOLUTION_ORDER, SPECIAL_BY_IDX, COLOR_MARKERS };

    root.GameRules=api;
    if(typeof module==='object' && module.exports) module.exports=api;
  })(typeof window!=='undefined'?window:globalThis);
  // ========================= End Rules Engine =========================
