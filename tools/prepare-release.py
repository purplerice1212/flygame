"""One-time hash-guarded migration for PR #97. Remove after verified generation."""
from pathlib import Path
import hashlib,re
root=Path(__file__).resolve().parents[1]
path=root/'skybound_flight_chess_interface.html'
s=path.read_text()
if 'src/app.js' in s and (root/'src/app.js').exists():
    raise SystemExit('Source already migrated; no changes made.')
b=path.read_bytes()
assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()=='cf6171f30fc1cfe19b356e910849dc6889b1fa04','Unexpected source revision; review before applying'
def swap(a,b):
 global s
 assert s.count(a)==1,('nonunique/missing',a[:100],s.count(a))
 s=s.replace(a,b,1)
def span(a,b,replacement):
 global s
 start=s.index(a);end=s.index(b,start+len(a))
 s=s[:start]+replacement+s[end:]
span("          if(current.idx===entryIdx){\n            const allowEntry", "        } else if(current.kind==='home'){", "")
swap("    function canTakeoffWith(dice,rules){", "    function canTakeoffWith(dice,rules){\n      if(!Number.isInteger(dice)||dice<1||dice>6) return false;")
swap("      generateLegalMoves.lastWarnings=[];", "      generateLegalMoves.lastWarnings=[];\n      if(!Number.isInteger(dice)||dice<1||dice>6) return [];")
swap("      let current=clone(fromPos); let remaining=dice; let events=[];", "      if(!Number.isInteger(dice)||dice<1||dice>6) return {legal:false,reason:'invalid-dice',events:[]};\n      let current=clone(fromPos); let remaining=dice; let events=[];")
s=s.replace("if(typeof pos.idx!=='number' || Number.isNaN(pos.idx)) continue;", "if(!Number.isInteger(pos.idx) || pos.idx<0 || pos.idx>=(pos.kind==='track'?BOARD.track.length:BOARD.homeLane.length)) continue;")
swap("      if(pos.kind!=='track' || !rules.captureOnLand) return null;", "      if(pos.kind!=='track') return null;")
swap("      if(context?.viaFlight && (!boardAllowsFlightCapture || flightRule.captureOnLanding===false)) return null;", "      const flightCaptureDisabled=context?.viaFlight && (!boardAllowsFlightCapture || flightRule.captureOnLanding===false);")
swap("      if(isSafeTrackTile(player.color,pos.idx,rules)) return {captured:[]};", "      if(!rules.captureOnLand || flightCaptureDisabled || isSafeTrackTile(player.color,pos.idx,rules)) return {captured:[]};")
swap("const css=getComputedStyle(document.documentElement);", "const css=getComputedStyle(document.body);")
swap("const tileSize=isCompact?40:44;", "const tileSize=geom.tileSize;")
swap("const borderGroup=el('g',{transform:`rotate(${tangentDeg})`});", "const borderGroup=el('g',{'data-tile-face':'true'});")
swap("const gTile=el('g',{transform:`translate(${x} ${y})`});", "const gTile=el('g',{transform:`translate(${x} ${y})`,'data-track-index':i});")
swap("const parseHex=(hex)=>{ const h=hex.replace('#',''); const parts=h.length===3?h.split('').map(c=>parseInt(c+c,16)):h.match(/.{2}/g).map(v=>parseInt(v,16)); return{r:parts[0],g:parts[1],b:parts[2]}; };", """const parseHex=(value)=>{
        const raw=String(value||'').trim();
        const hex=raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if(hex){
          const h=hex[1].length===3?hex[1].split('').map(c=>c+c).join(''):hex[1];
          const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
          return {r,g,b};
        }
        const rgb=raw.match(/^rgba?\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)/i);
        if(rgb){const [r,g,b]=rgb.slice(1,4).map(v=>Math.max(0,Math.min(255,Math.round(Number(v)))));return {r,g,b};}
        return {r:56,g:189,b:248};
      };""")
swap("        if(hudStatic && i%5===0){", "        if(hudStatic && i%5===0 && !this.state.settings.debugBoard){")
span("        chevronData.forEach(({x,y,angle,idx})=>{", "        hudStatic.appendChild(chevronGroup);", """        chevronData.forEach(({x,y,angle,idx})=>{
          if(idx%3!==0) return;
          const next=geom.track[(idx+1)%total];
          // Small arrows sit in the gap, never over a special icon or a plane.
          drawChevron(chevronGroup,(x+next.x)/2,(y+next.y)/2,angle,2.5);
        });
""")
swap("const k=0.32;", "const k=0.12;")
swap("'stroke-width':4,fill:'none',opacity:.78", "'stroke-width':2.4,fill:'none',opacity:.38")
swap("      gSpecials.appendChild(flightGroup);", "      flightGroup.setAttribute('class','flight-paths');\n      flightGroup.setAttribute('pointer-events','none');\n      flightGroup.style.display=this.state.rules?.dashedFlight?.enabled===false?'none':'';\n      gBack.appendChild(flightGroup);")
swap("        gSpecials.appendChild(portalLines);", "        portalLines.setAttribute('class','portal-paths');\n        portalLines.setAttribute('pointer-events','none');\n        portalLines.style.display=this.state.rules?.specials?.enabled===false?'none':'';\n        gBack.appendChild(portalLines);")
swap("const fill=isGoal?withAlpha(laneHex,0.85):'rgba(148,163,184,0.18)';", "const fill=isGoal?withAlpha(laneHex,0.85):withAlpha(laneHex,0.24);")
swap("const stroke=isGoal?withAlpha(laneHex,0.85):withAlpha(laneHex,0.4);", "const stroke=withAlpha(laneHex,isGoal?0.95:0.65);")
swap("gTiles.appendChild(el('polygon',{points:`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`", "gTiles.appendChild(el('polygon',{'data-home-color':col,'data-home-index':i,points:`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`")
swap("token.setAttribute('x',-12);", "token.setAttribute('x',0);")
swap("token.setAttribute('y',-12);", "token.setAttribute('y',0);")
swap("token.setAttribute('width',24);", "token.setAttribute('width',24);\n          token.setAttribute('transform','scale(1.35)');")
swap("glyph.setAttribute('x',0);", "glyph.setAttribute('x',12);")
swap("glyph.setAttribute('y',-7);", "glyph.setAttribute('y',-12);")
swap("label.setAttribute('x',0);", "label.setAttribute('x',12);")
swap("label.setAttribute('y','0.6');", "label.setAttribute('y',13);")
swap("          wrapper.style.cursor='pointer';", """          wrapper.style.cursor='pointer';
          const hit=document.createElementNS(SVG_NS,'circle');
          hit.setAttribute('r',23); hit.setAttribute('fill','transparent');
          hit.setAttribute('data-player',p.id);hit.setAttribute('data-index',String(idx));
          wrapper.appendChild(hit);""")
swap("    posToXY(color,pos,pieceIndex=null,piece=null){", "    posToXY(color,pos,pieceIndex=null,piece=null){\n      if(!pos || !this.geom?.home?.[color]) return null;")
swap("      this.state.boardAudit=this.auditGeometry(geom);", """      this.state.boardAudit=this.auditGeometry(geom);
      if(this.state.settings.debugBoard){
        const debug=el('g',{'class':'board-debug','pointer-events':'none','aria-hidden':'true'});
        geom.track.forEach((p,i)=>{
          debug.appendChild(el('circle',{cx:p.x,cy:p.y,r:2,fill:'#fff'}));
          debug.appendChild(el('text',{x:p.x,y:p.y-15,'text-anchor':'middle','font-size':10,fill:'var(--fg)',stroke:'var(--bg)','stroke-width':2,'paint-order':'stroke'},[document.createTextNode(String(i))]));
        });
        gHud.appendChild(debug);
      }""")
swap("    init(){", """    cancelPendingActions(){
      this._gameEpoch=(this._gameEpoch||0)+1;
      for(const key of ['_aiTimer','_noMoveTimer','_inputUnlockTimer']){
        if(this[key]!=null) clearTimeout(this[key]);
        this[key]=null;
      }
      this.clearTurnTimer();
      this.state.animating=false;
      this.state.inputLockUntil=0;
    },
    init(){""")
swap("      this.state.players=players; this.normalizePlayerControls();", "      this.cancelPendingActions();\n      this.state.players=players; this.normalizePlayerControls();")
swap("    toLobby(){\n      this.state.view='lobby';", "    toLobby(){\n      this.cancelPendingActions();\n      this.state.view='lobby';")
swap("      this.updateControlAssignments();\n      const pieceCount=window.GameRules.BOARD.bases.perPlayer||1;", "      this.cancelPendingActions();\n      this.updateControlAssignments();\n      const pieceCount=window.GameRules.BOARD.bases.perPlayer||1;")
swap("      if(!snap){ this.log('無可 Undo 嘅步',{tone:'warning'}); return; }", "      if(!snap){ this.log('無可 Undo 嘅步',{tone:'warning'}); return; }\n      this.cancelPendingActions();\n      this.state.bonusSelecting=!!snap.bonusSelecting;")
swap("      this.setButtonDisabled(this.$.btnRoll,this.state.animating||this.state.dice!=null);", "      this.setButtonDisabled(this.$.btnRoll,!player||this.state.animating||this.state.dice!=null);")
swap("      this.state.dice=value;", "      this.state.dice=value;\n      this.setButtonDisabled(this.$.btnRoll,true);")
swap("    applyMove(move,source='system'){\n      if(!move) return;", "    applyMove(move,source='system'){\n      if(!move || this.state.view!=='game' || this.state.animating || !(this.state.legalMoves||[]).includes(move)) return;\n      const epoch=this._gameEpoch||0;")
swap("this.animatePiece(player,fromXY,toXY,this.getAnimDuration(520),animCoords).then(async()=>{", "return this.animatePiece(player,fromXY,toXY,520,animCoords).then(async()=>{\n        if(epoch!==(this._gameEpoch||0) || this.state.view!=='game') return;")
swap("await this.animatePiece({color:info.opp.color}, from, targetBase, this.getAnimDuration(420));", "await this.animatePiece({color:info.opp.color}, from, targetBase, 420);\n            if(epoch!==(this._gameEpoch||0) || this.state.view!=='game') return;")
swap("      if(this.state.view!=='game' || this.state.animating) return;", "      if(this.state.view!=='game' || this.state.animating || e.repeat) return;\n      if(e.target?.closest?.('input,select,textarea,[contenteditable=\"true\"],dialog') || document.querySelector('dialog[open]')) return;")
swap("      if(source==='system') return true;", "      if(source==='system') return true;\n      if(document.querySelector('dialog[open]')) return false;")
span("      const skipRemaining=Math.max(0,this.state.skipTurns?.[player.id]||0);", "      const value=1+Math.floor(Math.random()*6);", "")
span("      const recoveringCount=Math.max(0,this.state.turbulenceRecoveries?.[pid]||0);", "      this.refreshLegalMoves();\n      this.renderHints();\n      this.saveGame();", "")
swap("          const currentRecovery=Math.max(0,this.state.turbulenceRecoveries[player.id]||0);\n          this.state.turbulenceRecoveries[player.id]=currentRecovery+1;", "          this.state.turbulenceRecoveries[player.id]=0; // legacy field; trap only skips a scheduled turn")
swap("      setTimeout(()=>{\n        if(this.state.view!=='game') return;", "      if(this._aiTimer!=null) return;\n      const epoch=this._gameEpoch||0;\n      this._aiTimer=setTimeout(()=>{\n        this._aiTimer=null;\n        if(epoch!==(this._gameEpoch||0) || this.state.view!=='game' || document.querySelector('dialog[open]')) return;")
swap("          const enterHomeStep=(dToEntry===0)?1:0;\n          return dToEntry+enterHomeStep+(homeLen-1);", "          return dToEntry+homeLen;")
swap("        if(rules.safeTiles?.start && idx===start) return true;", "        if(rules.safeTiles?.start && Object.values(BOARD.track.startIndex).includes(idx)) return true;")
swap("    getAnimDuration(base){", "    getAnimDuration(base){\n      if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;")
span("      this._noMoveTimer=setTimeout(()=>{", "    handleMoveWarnings(warnings){", """      const epoch=this._gameEpoch||0;
      this._noMoveTimer=setTimeout(()=>{
        this._noMoveTimer=null;
        if(epoch!==(this._gameEpoch||0)||this.state.view!=='game') return;
        if(this.state.dice===6 && this.state.rules.extraTurnOnSix){
          this.state.dice=null;
          this.updateTurnUI();this.saveGame();this.maybeAutoPlayIfAI();
        }else this.advanceTurn();
      },1200);
    },
""")
span("    hasSavedGame(){", "    bind(){", """    hasSavedGame(){
      return !!this.loadGame();
    },
""")
span("    saveGame(){", "    clearSave(){", """    saveGame(){
      if(!Array.isArray(this.state.players) || this.state.players.length===0) return false;
      try{
        const payload=window.GameStorage.pack(this.snapshot(),window.GameRules);
        localStorage.setItem(SAVE_KEY,JSON.stringify(payload));
        this.setButtonDisabled(this.$?.btnContinue,false);
        return true;
      }catch(error){
        if(!this._storageWarning){this._storageWarning=true;this.showToast('未能自動儲存，請用設定內「匯出存檔」備份',3000);}
        return false;
      }
    },
    loadGame(){
      try{
        const raw=localStorage.getItem(SAVE_KEY);
        return raw?window.GameStorage.parse(raw,window.GameRules):null;
      }catch(error){
        this._saveError=String(error.message||error);
        return null;
      }
    },
    exportSave(){
      try{
        const payload=window.GameStorage.pack(this.snapshot(),window.GameRules);
        const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=url;link.download='skybound-save-'+new Date().toISOString().slice(0,10)+'.json';
        link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }catch(error){this.showToast('未有可匯出的對局',2000);}
    },
    async importSave(file){
      if(!file) return false;
      try{
        if(file.size>200000) throw new Error('存檔過大');
        const payload=window.GameStorage.parse(await file.text(),window.GameRules);
        this.continueFromSave(payload);this.saveGame();
        closeDialogSafe($('#dialog-settings'));
        return true;
      }catch(error){this.showToast('無法匯入：'+error.message,3000);return false;}
    },
""")
swap("      const payload=data||this.loadGame();", "      let payload;\n      try{payload=data?window.GameStorage.parse(JSON.stringify(data),window.GameRules):this.loadGame();}\n      catch(error){this.showToast('無效存檔：'+error.message,2500);return false;}")
swap("      const snapshot=payload.state||payload;", "      this.cancelPendingActions();\n      const snapshot=payload.state||payload;")
swap("      this.state.turbulenceRecoveries=snapshot.turbulenceRecoveries||{};", "      this.state.turbulenceRecoveries={};")
swap("      this.log('已載入上局');", "      if(this.state.dice!=null && !this.state.legalMoves.length) this.handleNoMoves(this.currentPlayer());\n      this.log('已載入上局');")
swap("      const settingsDialog=$('#dialog-settings');", """      $('#btn-export').addEventListener('click',()=>this.exportSave());
      $('#btn-import').addEventListener('click',()=>$('#save-import').click());
      $('#save-import').addEventListener('change',e=>{this.importSave(e.target.files?.[0]);e.target.value='';});
      $('#board-debug').addEventListener('change',e=>{this.state.settings.debugBoard=e.target.checked;this.bootstrapBoard();this.redrawPieces();});
      document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>this.maybeAutoPlayIfAI()));
      const settingsDialog=$('#dialog-settings');""")
span("      if(name==='classic') this.state.rules", "      this.applyBoardDefaultsToRules();\n      this.populateRulesForm(this.state.rules);\n      this.updateSpecialsLegend();\n    },\n    setDefaultRules", """      if(name==='classic') this.state.rules=this.cloneDefaultRules({takeoff:'six',takeoffAdvanceSteps:0,tripleSixPenalty:true,specials:{enabled:false,portalLimit:1,portalBypassBlockade:true}});
      else if(name==='fast') this.state.rules=this.cloneDefaultRules({takeoff:'fiveOrSix',animSpeed:'fast',finishExact:'bounceBack'});
      else if(name==='family') this.state.rules=this.cloneDefaultRules({takeoff:'even',captureOnLand:false,finishExact:'bounceBack',ownColorJump:{enabled:false,steps:4},dashedFlight:{enabled:false,captureOnLanding:false},specials:{enabled:false,portalLimit:1,portalBypassBlockade:true}});
      else this.state.rules=this.cloneDefaultRules();
""")
s=re.sub(r'  <link[^\n]+fonts\.(?:googleapis|gstatic)\.com[^\n]*\n','',s)
swap('      <span class="muted">MVP</span>', '      <span class="muted">Skybound · 0.2</span>')
start=s.index('    <nav aria-label="global">');end=s.index('    </nav>',start)
buttons=re.findall(r'      (<button[^\n]+</button>)',s[start:end]);assert len(buttons)==3
s=s[:start]+'    <nav aria-label="全局導覽">\n      <ul class="nav-list">\n'+''.join('        <li>'+b+'</li>\n' for b in buttons)+'      </ul>\n'+s[end:]
swap('            <div class="row" id="preset-options">','''            <div class="row" id="preset-options">
              <label class="preset-card"><input type="radio" name="preset" value="family"><span class="preset-title">親子</span><span class="preset-note">偶數起飛，不吃子，終點折返</span></label>''')
swap('          <p id="setup-help" class="muted">選擇玩家、顏色、規則。按「開始遊戲」。</p>','''          <p id="setup-help" class="muted">選擇玩家、顏色、規則。按「開始遊戲」。</p>
          <details class="quick-guide"><summary>第一次玩？快速上手</summary><p>先擲骰，再點飛機或右邊的移動按鈕。鍵盤可用 Space 擲骰、1–4 選棋、U 撤銷。四架飛機到達中央家路終點便完成；對局會自動儲存，設定內可匯出備份。</p></details>''')
swap('      <label>主題\n        <select id="theme">','''      <label><input id="board-debug" type="checkbox"> 顯示棋格編號／座標中心</label>
      <div class="row save-controls"><button class="btn" id="btn-export" type="button">匯出存檔</button><button class="btn" id="btn-import" type="button">匯入存檔</button><input id="save-import" type="file" accept="application/json,.json" hidden aria-label="選擇存檔 JSON"></div>
      <label>主題
        <select id="theme">''')
swap('  </style>', '''    .nav-list{display:flex;gap:8px;list-style:none;margin:0;padding:0;flex-wrap:wrap}
    .board-wrap{background:var(--bg);align-self:start;min-width:0}
    svg.board{max-width:none;width:100%;height:100%}
    .btn{min-height:44px;touch-action:manipulation}
    .btn:focus-visible,select:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
    .save-controls{margin:12px 0}
    .quick-guide{margin-bottom:12px;line-height:1.5}
    dialog{color:var(--fg);background:var(--card);border:1px solid var(--tile-grid);border-radius:18px;max-width:calc(100vw - 24px);padding:0}
    dialog form{min-width:0!important;max-width:100%;overflow-wrap:anywhere}
    dialog label{flex-wrap:wrap;margin:8px 0}
    dialog select{max-width:100%}
    body[data-theme="light"] #hint-card h3,body[data-theme="light"] #hint-card ul,body[data-theme="light"] #color-key .color-key-list,body[data-theme="light"] #specials-legend h4,body[data-theme="light"] #specials-legend .legend-list{color:var(--fg)}
    @media(max-width:600px){
      .container{padding:10px}.app-bar{align-items:flex-start;flex-wrap:wrap}.app-bar nav{width:100%}
      #view-game aside{padding:12px}#movables{min-height:0;max-height:240px}
      #movables .btn{font-size:.95rem;min-height:48px}#hint-card{min-height:0}
      #view-game aside .log{height:130px}#view-game{gap:12px}.board-wrap{border-radius:12px}
      .preset-card{min-width:130px;flex:1}label{flex-wrap:wrap}fieldset{min-width:0}
      #turn-banner{font-size:.88rem;top:4px;padding:8px 12px}
    }
    @media(prefers-reduced-motion:reduce){.confetti-piece{animation:none}.plane-token{transition:none}.winner-celebration{transition:none}}
  </style>''')
(root/'src').mkdir(exist_ok=True);(root/'styles').mkdir(exist_ok=True)
style=re.search(r'  <style>\n([\s\S]*?)  </style>',s)
(root/'styles/game.css').write_text(style.group(1))
s=s[:style.start()]+'  <link rel="stylesheet" href="styles/game.css">'+s[style.end():]
scripts=list(re.finditer(r'  <script>\n([\s\S]*?)  </script>',s));assert len(scripts)==2
rules=scripts[0].group(1).replace('(function(){','(function(root){',1).replace('    window.GameRules = {','    const api = {',1)
rules=rules.replace('    // (Tests removed in production build)\n  })();','    root.GameRules=api;\n    if(typeof module===\'object\' && module.exports) module.exports=api;\n  })(typeof window!==\'undefined\'?window:globalThis);')
(root/'src/rules.js').write_text(rules)
(root/'src/app.js').write_text(scripts[1].group(1))
for m,name in reversed(list(zip(scripts,['rules','app']))):
 s=s[:m.start()]+f'  <script src="src/{name}.js"></script>'+s[m.end():]
s=s.replace('  <script src="src/app.js"></script>','  <script src="src/save-store.js"></script>\n  <script src="src/app.js"></script>')
path.write_text(s)
app_path=root/'src/app.js';app=app_path.read_text()
def edit_app(old,new):
 global app
 assert app.count(old)==1,(old[:80],app.count(old))
 app=app.replace(old,new,1)
edit_app("        if(this.state.dice===6 && this.state.rules.extraTurnOnSix){\n          this.state.dice=null;\n          this.updateTurnUI();this.saveGame();this.maybeAutoPlayIfAI();\n        }else this.advanceTurn();", "        this.finishNoMoveTurn();")
edit_app("    handleMoveWarnings(warnings){", """    finishNoMoveTurn(){
      if(this._noMoveTimer!=null){clearTimeout(this._noMoveTimer);this._noMoveTimer=null;}
      if(this.state.view!=='game'||this.state.animating||this.state.legalMoves?.length) return;
      if(document.querySelector('dialog[open]')) {this.handleNoMoves(this.currentPlayer());return;}
      if(this.state.dice===6&&this.state.rules.extraTurnOnSix){
        this.state.dice=null;this.updateTurnUI();this.saveGame();this.maybeAutoPlayIfAI();
      }else this.advanceTurn();
    },
    handleMoveWarnings(warnings){""")
edit_app("        if(!this.$?.timer) return;\n        this.$.timer.textContent", "        if(!this.$?.timer) return;\n        if(document.querySelector('dialog[open]')){this.state.turnTimerId=setTimeout(tick,1000);return;}\n        this.$.timer.textContent")
edit_app("      this.applyTheme();\n      if(this.$.kbMode) this.$.kbMode.value=this.state.settings.keyboardMode||'shared';\n      this.state.players=snapshot.players||[];", "      this.applyTheme();\n      $('#board-debug').checked=!!this.state.settings.debugBoard;\n      if(this.$.kbMode) this.$.kbMode.value=this.state.settings.keyboardMode||'shared';\n      this.state.players=snapshot.players||[];")
a=app.index("      const planeShape=el('g',");b=app.index('      defs.appendChild(planeShape);',a)
app=app[:a]+"""      const planeShape=el('g',{id:'plane-shape'},[
        el('circle',{cx:0,cy:0,r:12,fill:'currentColor','fill-opacity':'0.16',stroke:'none'}),
        el('path',{d:'M0,-12 C1,-12 2,-10 2,-8 L2,-3 L10,2 L10,5 L2,2 L2,8 L5,10 L5,12 L0,10 L-5,12 L-5,10 L-2,8 L-2,2 L-10,5 L-10,2 L-2,-3 L-2,-8 C-2,-10 -1,-12 0,-12 Z',fill:'currentColor',stroke:'#0b0f14','stroke-width':0.8,'stroke-linejoin':'round'}),
        el('path',{d:'M0,-9 L0,6',stroke:'rgba(255,255,255,.65)','stroke-width':0.7,'stroke-linecap':'round','fill':'none'})
      ]);
"""+app[b:]
app=app.replace("pulseAt(x,y,color){ const g=", "pulseAt(x,y,color){ if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return; const g=")
a=app.index('      const threatDetailAt=(idx,');b=app.index('      const determinePhase=()=>{',a)
helper=app[a:b].replace("const threatDetailAt=(idx,{stackSize=1}={})=>{","const threatDetailAt=(idx,{stackSize=1,color=player.color}={})=>{")
helper=helper.replace('isSafeTile(player.color,idx)','isSafeTile(color,idx)')
helper=helper.replace('opponentPieces.forEach(entry=>{','allTrackPieces.forEach(entry=>{\n          if(entry.color===color) return;')
helper=helper.replace('const computeExposureSum=(positions,counts)=>{','const computeExposureSum=(positions,counts,color=player.color)=>{')
helper=helper.replace('threatDetailAt(pos.idx,{stackSize});','threatDetailAt(pos.idx,{stackSize,color});')
helper="      const allTrackPieces=this.state.players.flatMap(p=>(this.state.pieces[p.id]||[]).map(pc=>({color:p.color,pos:pc.pos})));\n"+helper
app=app[:a]+app[b:]
anchor='      const snapshotFor=(color,pieces)=>{';assert app.count(anchor)==1
app=app.replace(anchor,helper+anchor,1)
app=app.replace('exposure:computeExposureSum(positions,counts)','exposure:computeExposureSum(positions,counts,color)',1)
a="          this.state.settings.theme=value;\n          this.applyTheme();"
b="""          this.state.settings.theme=value;
          this.applyTheme();
          this.bootstrapBoard();this.redrawPieces();
          if(this.state.view==='game') this.highlightMovables();
          this.saveGame();"""
assert app.count(a)==1;app=app.replace(a,b,1)
app_path.write_text(app)
print('Migrated geometry integration, rules, AI, persistence, lifecycle, style and source modules.')
