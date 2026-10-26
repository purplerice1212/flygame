  // =============================== App ================================
  const SVG_NS='http://www.w3.org/2000/svg';
  const SAVE_KEY='ac_save_v1';
  const SAVE_VERSION='skybound-variant-v2';
  const $ = (selector)=>document.querySelector(selector);
  const supportsDialog = (()=>{
    try{
      const dlg=document.createElement('dialog');
      return typeof dlg.showModal==='function';
    }catch(e){ return false; }
  })();
  const COLOR_LABELS={red:'紅',blue:'藍',yellow:'黃',green:'綠'};
  const isDocumentHidden = () => {
    if (typeof document === 'undefined') return false;
    const state = document.visibilityState;
    if (typeof state === 'string') {
      return state === 'hidden' || state === 'prerender';
    }
    if (typeof document.hidden === 'boolean') return document.hidden;
    const prefixedHidden = document.webkitHidden ?? document.mozHidden ?? document.msHidden;
    return typeof prefixedHidden === 'boolean' ? prefixedHidden : false;
  };
  const openDialogSafe = (dialog)=>{
    if(!dialog) return;
    if(supportsDialog && typeof dialog.showModal==='function'){
      dialog.showModal();
      return;
    }
    dialog.setAttribute('open','');
    dialog.setAttribute('data-fallback-open','true');
    if(document.body) document.body.setAttribute('data-dialog-open','true');
  };
  const closeDialogSafe = (dialog)=>{
    if(!dialog) return;
    if(supportsDialog && typeof dialog.close==='function'){
      dialog.close();
      return;
    }
    dialog.removeAttribute('data-fallback-open');
    dialog.removeAttribute('open');
    if(document.body && !document.querySelector('dialog[data-fallback-open="true"]')){
      document.body.removeAttribute('data-dialog-open');
    }
  };
  const attachDialogFallback = (dialog)=>{
    if(!dialog) return;
    if(!(supportsDialog && typeof dialog.showModal==='function')){
      dialog.addEventListener('click',evt=>{ if(evt.target===dialog) closeDialogSafe(dialog); });
      dialog.addEventListener('submit',evt=>{ evt.preventDefault(); closeDialogSafe(dialog); });
    }else{
      dialog.addEventListener('cancel',()=>{ if(document.body) document.body.removeAttribute('data-dialog-open'); });
      dialog.addEventListener('close',()=>{ if(document.body) document.body.removeAttribute('data-dialog-open'); });
    }
  };
  if(!supportsDialog){
    document.addEventListener('keydown',evt=>{
      if(evt.key==='Escape'){
        const active=document.querySelector('dialog[data-fallback-open="true"]');
        if(active){ evt.preventDefault(); closeDialogSafe(active); }
      }
    });
  }
  const App = {
    state:{ view:'lobby', players:[], rules:null, pieces:{}, turn:null, dice:null, history:[], settings:{keyboardMode:'shared',theme:'dark'}, animating:false, consecutiveSixes:{}, turnTimerId:null, turnTimerRemaining:0, controlById:{}, inputLockUntil:0, bonusSelecting:false, pendingBonus:null, pendingExtraTurn:false, skipTurns:{}, turbulenceRecoveries:{}, lastMoveSummary:null, finishOrder:[], winner:null, disabledColors:{}, finishedSlots:{} },
    _lastWarningsSignature:'',
    _piecesObserver:null,
    geom:{ track:[], home:{}, bases:{}, runway:{}, finishedSlots:{} },
    runSoon(callback){
      if(typeof callback!=='function') return;
      const hasRAF = typeof window!=='undefined' && typeof window.requestAnimationFrame==='function';
      if(hasRAF && !isDocumentHidden()){
        window.requestAnimationFrame(()=>callback());
        return;
      }
      if(typeof queueMicrotask==='function'){
        queueMicrotask(()=>callback());
        return;
      }
      if(typeof Promise==='function'){
        Promise.resolve().then(()=>callback());
        return;
      }
      setTimeout(()=>callback(),0);
    },
    ensurePiecesOnTop(){
      const g=this.$?.gPieces;
      if(!g) return;
      const svg=g.ownerSVGElement || this.$?.svg;
      if(!svg) return;
      if(g.parentNode!==svg){
        svg.appendChild(g);
        return;
      }
      if(svg.lastElementChild!==g){
        svg.appendChild(g);
      }
    },
    observePiecesLayer(){
      const svg=this.$?.svg || this.$?.gPieces?.ownerSVGElement;
      if(typeof MutationObserver==='function' && svg){
        if(!this._piecesObserver){
          this._piecesObserver=new MutationObserver(()=>this.ensurePiecesOnTop());
        }else{
          this._piecesObserver.disconnect();
        }
        this._piecesObserver.observe(svg,{childList:true});
      }
      this.ensurePiecesOnTop();
    },
    cancelPendingActions(){
      this._gameEpoch=(this._gameEpoch||0)+1;
      for(const key of ['_aiTimer','_noMoveTimer','_inputUnlockTimer']){
        if(this[key]!=null) clearTimeout(this[key]);
        this[key]=null;
      }
      this.clearTurnTimer();
      this.state.animating=false;
      this.state.inputLockUntil=0;
    },
    init(){
      if(this._initialized) return;
      this._initialized=true;
      this.cache(); this.bind();
      this.observePiecesLayer();
      if(this.$.kbMode) this.$.kbMode.value=this.state.settings.keyboardMode||'shared';
      this.applyTheme();
      this.renderLastMove();
      this._hudLayers={static:null,dynamic:null};
      this.setDefaultRules();
      this.renderLobbyPlayers(2);
      this.bootstrapBoard();
      this.redrawPieces();
      this.updateViewVisibility();
      this.updateBoardOverlay();
      this.updateSpecialsLegend();
      if(this.hasSavedGame()) this.setButtonDisabled(this.$.btnContinue,false);
      window.addEventListener('resize',()=>this.onResize());
    },
    cache(){
      const rulesAdvanced=$('#rules-advanced');
      this.$={
        viewLobby:$('#view-lobby'), viewGame:$('#view-game'), playerCount:$('#playerCount'), playerList:$('#player-list'),
        formSetup:$('#form-setup'), btnQuick:$('#btn-quick'), btnStart:$('#btn-start'), btnLobby:$('#btn-lobby'), btnRoll:$('#btn-roll'),
        diceOut:$('#dice-output'), movables:$('#movables'), log:$('#log'), turn:$('#turn-indicator'), kbMode:$('#keyboard-mode'), timer:$('#timer'), hintCard:$('#hint-card'), turnBanner:$('#turn-banner'), toast:$('#toast-host'), saveStatus:$('#save-status'),
        btnUndo:$('#btn-undo'), btnRestart:$('#btn-restart'), btnContinue:$('#btn-continue'), svg:document.querySelector('svg.board'),
        gBack:$('#layer-background'), gGrid:$('#layer-grid'), gTiles:$('#layer-tiles'), gSpecials:$('#layer-specials'), gHud:$('#layer-hud'), gPieces:$('#layer-pieces'), gHL:$('#layer-highlights'),
        boardOverlay:$('#board-overlay'), specialsLegend:$('#specials-legend'), specialsStatus:document.querySelector('[data-specials-status]'), specialsOrder:$('#specials-order'), mapAuditStatus:$('#map-audit-status'), mapAuditErrors:$('#map-audit-errors'),
        theme:$('#theme'), rulesAdvanced, rulesAdvancedSummary:rulesAdvanced?rulesAdvanced.querySelector('summary'):null, lastMoveCard:$('#last-move-card'), lastMoveSummary:$('#last-move-summary'), lastMoveMeta:$('#last-move-meta'), lastMoveCaptured:$('#last-move-captured'), btnReplayLast:$('#btn-replay-last'),
        dialogVictory:$('#dialog-victory'), victoryWinnerName:document.querySelector('[data-winner-name]'), victoryWinnerColor:document.querySelector('[data-winner-color]'), victorySubtitle:document.querySelector('[data-victory-subtitle]'), victoryOrder:$('#victory-order'), victoryList:document.querySelector('[data-finish-order]')
      };
    },
    setButtonDisabled(button, disabled){
      if(!button) return;
      const isDisabled=!!disabled;
      button.disabled=isDisabled;
      if(isDisabled){
        button.setAttribute('aria-disabled','true');
      }else{
        button.removeAttribute('aria-disabled');
      }
    },
    hasSavedGame(){
      return !!this.loadGame();
    },
    bind(){
      if(this._bound) return;
      this._bound=true;
      this.$.playerCount.addEventListener('change',e=>this.renderLobbyPlayers(parseInt(e.target.value,10)));
      this.$.formSetup.addEventListener('submit',e=>{ e.preventDefault(); this.startGame(); });
      this.$.formSetup.addEventListener('change',e=>{
        const target=e.target;
        if(!target) return;
        if(target.name==='preset'){
          const value=target.value||'custom';
          if(value==='custom'){
            this.state.rules = this.cloneDefaultRules(this.readRulesFromForm());
            this.applyBoardDefaultsToRules();
            this.populateRulesForm(this.state.rules);
            this.updateSpecialsLegend();
          }else{
            this.applyPreset(value);
          }
          return;
        }
        if(this.$.rulesAdvanced && this.$.rulesAdvanced.contains(target)){
          const custom=this.$.formSetup.querySelector('input[name="preset"][value="custom"]');
          if(custom) custom.checked=true;
          this.state.rules = this.cloneDefaultRules(this.readRulesFromForm());
          this.applyBoardDefaultsToRules();
          this.updateSpecialsLegend();
        }
      });
      this.$.btnQuick.addEventListener('click',()=>{
        const radios=this.$.formSetup?.querySelectorAll('input[name="preset"]');
        const classic=this.$.formSetup?.querySelector('input[name="preset"][value="classic"]');
        if(radios && classic){
          radios.forEach(radio=>{ radio.checked = (radio===classic); });
        }
        this.applyPreset('classic');
        this.startGame();
      });
      this.$.btnContinue.addEventListener('click',()=>this.continueFromSave());
      this.$.btnLobby.addEventListener('click',()=>this.toLobby());
      if(this.$.btnReplayLast){
        this.$.btnReplayLast.addEventListener('click',()=>this.previewLastMove());
      }
      if(this.$.theme){
        this.$.theme.addEventListener('change',e=>{
          const value=e.target.value||'dark';
          this.state.settings.theme=value;
          this.applyTheme();
          this.bootstrapBoard();this.redrawPieces();
          if(this.state.view==='game') this.highlightMovables();
          this.saveGame();
          this.log(`主題已切換為：${value==='light'?'淺色':value==='high'?'高對比':'深色'}`);
        });
      }
      this.$.btnRoll.addEventListener('click',event=>{
        const isKeyboardActivation = (event instanceof MouseEvent && event.detail===0) || event?.detail===0;
        if(isKeyboardActivation){
          this.rollDice('keyboard');
          return;
        }
        const hasPointerEvents = typeof PointerEvent!=='undefined';
        if(hasPointerEvents && event instanceof PointerEvent){
          const pointerType = event.pointerType;
          if(pointerType==='mouse' || pointerType==='pen'){
            this.rollDice('mouse');
            return;
          }
        }
        this.rollDice('mouse');
      });
      this.$.btnUndo.addEventListener('click',()=>this.undo());
      this.$.btnRestart.addEventListener('click',()=>this.restartGame());
      if(this.$.playerList){
        this.$.playerList.addEventListener('change',evt=>{
          const target=evt.target;
          if(!target || typeof target.matches!=='function') return;
          if(target.matches('[data-color]')){
            const card=target.closest('[data-player-card]');
            this.syncPlayerCardColor(card);
          }
          if(target.matches('[data-type]')){
            const card=target.closest('[data-player-card]');
            this.syncPlayerCardType(card);
          }
          this.updateBoardOverlay();
        });
      }
      $('#btn-export').addEventListener('click',()=>this.exportSave());
      $('#btn-import').addEventListener('click',()=>$('#save-import').click());
      $('#save-import').addEventListener('change',e=>{this.importSave(e.target.files?.[0]);e.target.value='';});
      $('#board-debug').addEventListener('change',e=>{this.state.settings.debugBoard=e.target.checked;this.bootstrapBoard();this.redrawPieces();});
      document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{
        // Imports and control changes can render choices while a modal blocks
        // pointer input. Rebind them after it closes so the restored game plays.
        if(this.state.view==='game'){this.highlightMovables();this.renderHints();}
        this.maybeAutoPlayIfAI();
      }));
      const settingsDialog=$('#dialog-settings');
      const aboutDialog=$('#dialog-about');
      const victoryDialog=this.$.dialogVictory;
      attachDialogFallback(settingsDialog);
      attachDialogFallback(aboutDialog);
      attachDialogFallback(victoryDialog);
      $('#btn-settings').addEventListener('click',()=>openDialogSafe(settingsDialog));
      $('#btn-about').addEventListener('click',()=>openDialogSafe(aboutDialog));
      if(victoryDialog){
        const restartBtn=victoryDialog.querySelector('[data-action="restart"]');
        if(restartBtn){
          restartBtn.addEventListener('click',()=>{
            closeDialogSafe(victoryDialog);
            this.restartGame();
          });
        }
      }
      this.$.kbMode.addEventListener('change',e=>{ this.state.settings.keyboardMode=e.target.value; this.log(`鍵盤模式：${this.state.settings.keyboardMode}`); this.updateControlAssignments(); this.renderHints(); this.updateTurnPrompt(true); });
      if(this.$.rulesAdvanced){
        this.$.rulesAdvanced.addEventListener('toggle',()=>this.updateRulesAdvancedSummary());
        this.updateRulesAdvancedSummary();
      }
      if(!this._handleKeyDown){
        this._handleKeyDown=e=>this.onKey(e);
        window.addEventListener('keydown',this._handleKeyDown,true);
      }
    },
    updateRulesAdvancedSummary(){
      const details=this.$?.rulesAdvanced;
      if(!details) return;
      let summary=this.$?.rulesAdvancedSummary;
      if(!summary || !details.contains(summary)){
        summary=details.querySelector('summary');
        if(summary) this.$.rulesAdvancedSummary=summary;
      }
      if(!summary) return;
      const isOpen=!!details.open;
      const label=`自訂規則（${isOpen?'收合':'展開'}）`;
      if(summary.textContent!==label){
        summary.textContent=label;
      }
      summary.setAttribute('aria-expanded',isOpen?'true':'false');
    },
    updateViewVisibility(){
      const view=this.state.view||'lobby';
      document.body.dataset.view=view;
      if(this.$?.viewLobby) this.$.viewLobby.hidden = (view!=='lobby');
      if(this.$?.viewGame) this.$.viewGame.hidden = (view!=='game');
    },
    updateBoardOverlay(){
      const overlay=this.$?.boardOverlay; if(!overlay) return;
      const view=this.state.view||'lobby';
      if(view==='game'){ overlay.textContent=''; return; }
      if(this.hasSavedGame()){
        overlay.textContent='🗺️ 棋盤預覽 — 有儲存對局，可按「繼續上局」或重新開局';
        return;
      }
      const cardNodes=this.$?.playerList?.querySelectorAll('[data-player-card]')||[];
      const cards=Array.from(cardNodes);
      const seenColors=new Set();
      let hasDuplicate=false;
      cards.forEach(card=>{
        const colorSelect=card.querySelector('[data-color]');
        const color=(colorSelect?.value||'').trim();
        if(!color) return;
        if(seenColors.has(color)){
          hasDuplicate=true;
        }
        seenColors.add(color);
      });
      if(seenColors.size===0 && cards.length===0 && Array.isArray(this.state.players)){
        this.state.players.forEach(player=>{
          if(!player?.color) return;
          if(seenColors.has(player.color)){
            hasDuplicate=true;
          }
          seenColors.add(player.color);
        });
      }
      if(hasDuplicate){
        overlay.textContent='⚠️ 棋盤預覽 — 玩家顏色不可重複，請調整後再開始';
        return;
      }
      const uniqueCount=seenColors.size;
      if(uniqueCount>=2){
        overlay.textContent=`🗺️ 棋盤預覽 — ${uniqueCount} 位玩家準備就緒，按「開始遊戲」起飛`;
      }else{
        overlay.textContent='🗺️ 棋盤預覽 — 需至少 2 位玩家開始';
      }
    },
    syncPlayerCardColor(card){
      if(!card) return;
      const colorSelect=card.querySelector('[data-color]');
      const pill=card.querySelector('[data-color-pill]');
      if(!colorSelect) return;
      const value=colorSelect.value||'';
      card.dataset.color=value;
      if(pill){
        const markers=window.GameRules?.COLOR_MARKERS||{};
        const marker=markers[value];
        const label=(colorSelect.options && colorSelect.selectedIndex>=0)?(colorSelect.options[colorSelect.selectedIndex]?.textContent||''):'●';
        const trimmed=(label||'').trim();
        const displayLabel=marker?.symbol || (trimmed.length?trimmed:'●');
        pill.textContent=displayLabel;
        const ariaLabel=marker?`${marker.label}隊（${displayLabel}）`:(trimmed.length?trimmed:'未設定');
        pill.setAttribute('aria-label',`顏色：${ariaLabel}`);
        if(marker?.shape){ pill.dataset.shape=marker.shape; pill.title=`${marker.label}隊`; }
        else { pill.removeAttribute('data-shape'); pill.removeAttribute('title'); }
        if(value){
          pill.style.background=`var(--${value})`;
          pill.style.color='#0b0f14';
          pill.style.borderColor=`var(--${value})`;
        }else{
          pill.style.background='';
          pill.style.color='';
          pill.style.borderColor='';
        }
      }
    },
    syncPlayerCardType(card){
      if(!card) return;
      const typeSelect=card.querySelector('[data-type]');
      const difficultyRow=card.querySelector('[data-difficulty-row]');
      const difficultySelect=card.querySelector('[data-difficulty]');
      if(!typeSelect || !difficultyRow) return;
      const type=(typeSelect.value||'human').toLowerCase();
      const isAI=type==='ai';
      difficultyRow.hidden=!isAI;
      if(isAI){
        difficultyRow.removeAttribute('aria-hidden');
        if(difficultySelect){
          difficultySelect.disabled=false;
          difficultySelect.removeAttribute('aria-disabled');
          const normalized=this.normalizeDifficulty(difficultySelect.value||'normal');
          difficultySelect.value=normalized;
        }
      }else{
        difficultyRow.setAttribute('aria-hidden','true');
        if(difficultySelect){
          difficultySelect.disabled=true;
          difficultySelect.setAttribute('aria-disabled','true');
        }
      }
    },
    refreshPlayerCardColors(){
      const cards=this.$?.playerList?.querySelectorAll('[data-player-card]');
      if(!cards) return;
      cards.forEach(card=>{ this.syncPlayerCardColor(card); this.syncPlayerCardType(card); });
    },
    updateSpecialsLegend(){
      const legend=this.$?.specialsLegend; if(!legend) return;
      const enabled=!(this.state.rules?.specials?.enabled===false);
      legend.dataset.disabled=enabled?'false':'true';
      const statusEl=this.$?.specialsStatus; if(statusEl) statusEl.textContent=enabled?'啟用':'停用';
      if(this.$?.gSpecials) this.$.gSpecials.style.opacity=enabled?'1':'0.25';
      const orderEl=this.$?.specialsOrder;
      if(orderEl){
        const labels={
          'own-color-jump':'⤴️ 自色跳格',
          'flight':'🪂 虛線飛行',
          'portal':'🌀 傳送門',
          'power-up':'🎲 增壓',
          'trap':'⚠️ 亂流'
        };
        const order=(window.GameRules?.SPECIAL_RESOLUTION_ORDER||[]).map(key=>labels[key]||key).join(' → ');
        orderEl.textContent=order;
      }
      const auditStatusEl=this.$?.mapAuditStatus;
      const auditErrorsEl=this.$?.mapAuditErrors;
      const boardIssues=Array.isArray(window.GameRules?.BOARD_VALIDATION?.issues)?window.GameRules.BOARD_VALIDATION.issues:[];
      const geomIssues=Array.isArray(this.state?.boardAudit?.issues)?this.state.boardAudit.issues:[];
      const issues=[...boardIssues,...geomIssues];
      if(auditStatusEl){
        auditStatusEl.textContent=issues.length?`⚠ ${issues.length} 個問題`:'✅ 通過';
      }
      if(auditErrorsEl){
        auditErrorsEl.innerHTML='';
        if(issues.length){
          issues.forEach((msg)=>{
            const li=document.createElement('li');
            li.textContent=`• ${msg}`;
            auditErrorsEl.appendChild(li);
          });
          auditErrorsEl.hidden=false;
        }else{
          auditErrorsEl.hidden=true;
        }
      }
    },
    onResize(){
      if(this._resizeTimer){ clearTimeout(this._resizeTimer); }
      this._resizeTimer=setTimeout(()=>{
        this.bootstrapBoard();
        this.redrawPieces();
        this._resizeTimer=null;
      },160);
    },
    lockInput(ms=0){
      if(this._inputUnlockTimer){ clearTimeout(this._inputUnlockTimer); this._inputUnlockTimer=null; }
      if(!(ms>0)){ this.state.inputLockUntil=0; return; }
      this.state.inputLockUntil=Date.now()+ms;
      this._inputUnlockTimer=setTimeout(()=>{ this.state.inputLockUntil=0; this._inputUnlockTimer=null; },ms);
    },
    isInputLocked(){ return Date.now()< (this.state.inputLockUntil||0); },
    showToast(message,duration=1600){
      const host=document.querySelector('dialog[open] .dialog-feedback') || (this.state.view==='lobby'?$('#lobby-feedback'):this.$?.toast);
      if(!host) return;
      if(!this._toast){ this._toast=document.createElement('div'); this._toast.className='toast-message'; }
      if(this._toast.parentNode!==host) host.appendChild(this._toast);
      if(this._toastTimer){ clearTimeout(this._toastTimer); this._toastTimer=null; }
      if(!message){ this._toast.dataset.show='false'; this._toastTimer=setTimeout(()=>{ if(this._toast) this._toast.dataset.show='false'; },0); return; }
      this._toast.textContent=message;
      this._toast.dataset.show='true';
      this._toastTimer=setTimeout(()=>{ if(this._toast) this._toast.dataset.show='false'; },duration);
    },
    updateControlAssignments(){
      const mode=this.state.settings.keyboardMode||'shared';
      const map={};
      const fallbackFor=(targetMode,idx)=>{
        if(targetMode==='dual') return (idx<=1?'keyboard':'mouse');
        if(targetMode==='shared') return 'keyboard';
        if(targetMode==='custom') return 'keyboard';
        return 'mouse';
      };
      this.state.players.forEach((player,idx)=>{
        if(!player || !player.id) return;
        const pref=(player.control==='keyboard'||player.control==='mouse')?player.control:'auto';
        if(mode==='custom'){
          map[player.id]=(pref==='auto')?fallbackFor('shared',idx):pref;
          return;
        }
        if(pref==='keyboard'||pref==='mouse'){ map[player.id]=pref; return; }
        map[player.id]=fallbackFor(mode,idx);
      });
      this.state.controlById=map;
    },
    currentPlayer(){ return this.state.players.find(p=>p.id===this.state.turn)||null; },
    currentControlModeForTurn(){
      const player=this.currentPlayer();
      if(!player) return 'mouse';
      const mode=this.state.controlById?.[player.id];
      return mode||'mouse';
    },
    isInteractionPermitted(source){
      if(source==='system') return true;
      if(document.querySelector('dialog[open]')) return false;
      if(this.isInputLocked()){ return false; }
      const current=this.currentPlayer();
      if(current && this.isAI(current)) return false;
      if(current && this.state.disabledColors && this.state.disabledColors[current.id]) return false;
      const globalMode=this.state.settings?.keyboardMode||'shared';
      if(globalMode==='shared') return true;
      const control=this.currentControlModeForTurn();
      if(control==='keyboard' && source==='mouse') return false;
      if(control==='mouse' && source==='keyboard') return false;
      return true;
    },
    handleBlockedInteraction(source){
      const player=this.currentPlayer();
      if(this.isInputLocked()){ this.showToast('請稍候，提示顯示中…',900); return; }
      if(player && this.isAI(player)){ this.showToast('AI 執行中',1200); return; }
      if(!player) return;
      const control=this.currentControlModeForTurn();
      const label=this.formatPlayerName(player,{includeDifficulty:true});
      if(control==='keyboard' && source==='mouse') this.showToast(`${label} 回合需用鍵盤操作`,1400);
      else if(control==='mouse' && source==='keyboard') this.showToast(`${label} 回合請用滑鼠`,1400);
    },
    renderHints(){
      const host=this.$?.hintCard; if(!host) return;
      const player=this.currentPlayer();
      host.innerHTML='';
      if(!player){
        host.innerHTML='<p class="hint-meta">等待遊戲開始…</p>';
        return;
      }
      const control=this.currentControlModeForTurn();
      const stage=this.state.bonusSelecting?'bonus':(this.state.dice==null?'roll':'move');
      const list=document.createElement('ul');
      const title=document.createElement('h3');
      title.textContent=`${this.formatPlayerName(player,{includeDifficulty:true})} 的操作提示`;
      const hints=[];
      const moveCount=Array.isArray(this.state.legalMoves)?this.state.legalMoves.length:0;
      const mode=this.state.settings.keyboardMode||'shared';
      const playerIndex=this.state.players.findIndex(p=>p.id===player.id);
      if(this.isAI(player)){
        hints.push(stage==='roll'?'AI 正在準備擲骰…':'AI 正在選擇移動…');
        hints.push('稍候便會自動完成回合');
      }else if(mode==='shared'){
        if(stage==='roll') hints.push('點擊「擲骰 🎲」或按 Space');
        if(stage==='move') hints.push(moveCount>0?'點擊飛機／移動按鈕，或按 1–4 選棋':'沒有可移動棋子，等待換手');
        if(stage==='bonus'){
          hints.push(this.state.pendingBonus?.description||'選擇棋子完成增益');
          hints.push(moveCount>0?'觸控、滑鼠或數字鍵皆可選棋':'沒有可用的增益移動，稍後自動結束');
        }
        if(this.state.rules?.undoEnabled) hints.push('可點 Undo 或按 U 撤銷');
      }else if(control==='keyboard'){
        if(stage==='roll') hints.push('按 Space 擲骰 🎲');
        if(stage==='move' || stage==='bonus'){
          if(mode==='shared' || mode==='custom'){ hints.push('用 1–4 選棋'); }
          else if(mode==='dual'){
            if(playerIndex===0) hints.push('P1：用 1–4 選棋');
            else if(playerIndex===1) hints.push('P2：用 7–0 選棋');
            else hints.push('自選鍵盤：用 1–4 選棋');
          }
        }
        if(stage==='move'){
          if(moveCount>0) hints.push('選擇數字鍵執行移動');
          else hints.push('沒有可移動棋子，等待換手');
        }
        if(stage==='bonus'){
          const desc=this.state.pendingBonus?.description||'使用增益移動';
          hints.push(desc);
          if(moveCount>0) hints.push('選擇符合條件的棋子以完成增益');
          else hints.push('沒有可用的增益移動，稍後自動結束');
        }
        if(this.state.rules?.undoEnabled) hints.push('按 U 撤銷 (Undo)');
      }else{
        if(stage==='roll') hints.push('點擊「擲骰 🎲」開始');
        if(stage==='move'){
          if(moveCount>0) hints.push('點擊棋子或移動按鈕移動');
          else hints.push('目前沒有可行動的棋子');
        }
        if(stage==='bonus'){
          const desc=this.state.pendingBonus?.description||'執行增益移動';
          hints.push(desc);
          if(moveCount>0) hints.push('點擊符合條件的棋子完成增益');
          else hints.push('增益沒有可移動的棋子，稍後會自動略過');
        }
        if(this.state.rules?.undoEnabled) hints.push('如需撤銷，可點 Undo 按鈕');
      }
      hints.forEach(text=>{ const li=document.createElement('li'); li.textContent=text; list.appendChild(li); });
      const totalPieces=Math.max(1, window.GameRules?.BOARD?.bases?.perPlayer||1);
      const playerPieces=this.state.pieces[player.id]||[];
      const finishedCount=playerPieces.filter(pc=>pc.pos?.kind==='finished').length;
      const finishIdx=Array.isArray(this.state.finishOrder)?this.state.finishOrder.indexOf(player.id):-1;
      const finishText=finishedCount>=totalPieces && finishIdx>=0 ? `完成 ${finishedCount}/${totalPieces} · 第 ${finishIdx+1} 名` : `完成 ${finishedCount}/${totalPieces}`;
      const meta=document.createElement('div');
      meta.className='hint-meta';
      meta.textContent=`${this.isAI(player)?'AI 自動操作':mode==='shared'?'觸控、滑鼠、鍵盤皆可':control==='keyboard'?'此回合鎖定鍵盤操作':'此回合鎖定滑鼠操作'} · ${finishText}`;
      host.appendChild(title);
      host.appendChild(list);
      host.appendChild(meta);
    },
    applyTheme(){
      const allowed=['dark','light','high'];
      const theme=allowed.includes(this.state.settings?.theme)?this.state.settings.theme:'dark';
      this.state.settings.theme=theme;
      if(this.$.theme && this.$.theme.value!==theme) this.$.theme.value=theme;
      document.body.dataset.theme=theme;
    },
    renderLastMove(){
      const card=this.$?.lastMoveCard;
      if(!card) return;
      const summaryEl=this.$?.lastMoveSummary;
      const metaEl=this.$?.lastMoveMeta;
      const capturedEl=this.$?.lastMoveCaptured;
      const button=this.$?.btnReplayLast;
      const summary=this.state.lastMoveSummary;
      const resetStyles=()=>{
        card.dataset.empty='true';
        card.dataset.hasSummary='false';
        card.style.removeProperty('--last-move-accent');
        card.style.removeProperty('--last-move-accent-soft');
      };
      if(!summary){
        if(summaryEl){ summaryEl.textContent='尚未有移動記錄。'; summaryEl.classList.add('muted'); }
        if(metaEl){ metaEl.textContent=''; metaEl.hidden=true; }
        if(capturedEl){ capturedEl.innerHTML=''; capturedEl.hidden=true; }
        if(button) this.setButtonDisabled(button,true);
        resetStyles();
        return;
      }
      const colorNameMap={red:'紅',blue:'藍',yellow:'黃',green:'綠'};
      const player=summary.player||{};
      const actualPlayer=this.state.players.find(p=>p.id===player.id)||player;
      const diceText=typeof summary.dice==='number'?`擲出 ${summary.dice}`:'';
      const desc=summary.description||'完成移動';
      const colorValue=player.color||actualPlayer.color;
      const colorLabel=colorNameMap[colorValue]||colorValue||'';
      if(summaryEl){
        const colorDisplay=colorLabel?`（${colorLabel}）`:'';
        const diceDisplay=diceText?` ${diceText}`:'';
        summaryEl.textContent=`${this.formatPlayerName(actualPlayer,{includeDifficulty:true})}${colorDisplay}${diceDisplay}：${desc}`;
        summaryEl.classList.remove('muted');
      }
      const metaBits=[];
      if(Array.isArray(summary.path) && summary.path.length>0){ metaBits.push(`路徑節點 ${summary.path.length}`); }
      if(summary.stackSize && summary.stackSize>1){ metaBits.push(`疊子 ×${summary.stackSize}`); }
      if(metaEl){
        metaEl.textContent=metaBits.join(' · ');
        metaEl.hidden=metaBits.length===0;
      }
      if(capturedEl){
        capturedEl.innerHTML='';
        const capturedList=Array.isArray(summary.captured)?summary.captured:[];
        if(capturedList.length>0){
          capturedList.forEach(info=>{
            const li=document.createElement('li');
            const label=colorNameMap[info?.color]||info?.color||'敵機';
            li.textContent=`擊落 ${label}`;
            capturedEl.appendChild(li);
          });
          capturedEl.hidden=false;
        }else{
          capturedEl.hidden=true;
        }
      }
      if(button) this.setButtonDisabled(button,false);
      card.dataset.empty='false';
      card.dataset.hasSummary='true';
      const accentVar=player.color?`var(--${player.color})`:'var(--accent)';
      const ghostVar=player.color?`var(--${player.color}-ghost)`:'rgba(34,211,238,0.18)';
      card.style.setProperty('--last-move-accent',accentVar);
      card.style.setProperty('--last-move-accent-soft',ghostVar);
    },
    previewLastMove(force=false){
      const summary=this.state.lastMoveSummary;
      if(!summary || !Array.isArray(summary.path) || summary.path.length===0) return;
      if(!force){
        const deciding = (this.state.bonusSelecting===true) || (this.state.dice!=null && Array.isArray(this.state.legalMoves) && this.state.legalMoves.length>0);
        if(deciding) return;
      }
      const pieceIndex=typeof summary.pieceIndex==='number'?summary.pieceIndex:0;
      this.previewMove({path:summary.path,pieceIndex}, summary.player?.color||null);
    },
    buildTurnPrompt(){
      const player=this.currentPlayer();
      if(!player) return '';
      const control=this.currentControlModeForTurn();
      const stage=this.state.bonusSelecting?'bonus':(this.state.dice==null?'roll':'move');
      let action='準備中';
      if(this.isAI(player)){
        action=stage==='roll'?'AI 準備擲骰':'AI 選擇移動';
      }else if(this.state.settings.keyboardMode==='shared'){
        action=stage==='roll'?'點擊 🎲 或按 Space 擲骰':stage==='bonus'?'選擇棋子完成增益':'點擊飛機／移動按鈕，或按 1–4';
      }else if(stage==='roll') action = control==='keyboard' ? '按 Space 擲骰 🎲' : '點擊 🎲 擲骰';
      else if(stage==='move') action = control==='keyboard' ? '用數字鍵選棋' : '點擊棋子行動';
      else if(stage==='bonus') action = control==='keyboard' ? '用數字鍵觸發增益' : '選擇棋子完成增益';
      else action='等待下一步';
      const totalPieces=Math.max(1, window.GameRules?.BOARD?.bases?.perPlayer||1);
      const pcs=this.state.pieces[player.id]||[];
      const finishedCount=pcs.filter(pc=>pc.pos?.kind==='finished').length;
      let status='';
      if(finishedCount>=totalPieces){
        const placeIdx=(Array.isArray(this.state.finishOrder)?this.state.finishOrder.indexOf(player.id):-1);
        status=placeIdx>=0?`已完成（第 ${placeIdx+1} 名）`:'已完成';
      }else{
        status=`完成 ${finishedCount}/${totalPieces}`;
      }
      const label=this.formatPlayerName(player,{includeDifficulty:true});
      return `${label} 的回合 — ${action}（${status}）`;
    },
    showTurnPrompt(message,{duration=2200,force=false,lock=0,color=null}={}){
      const host=this.$?.turnBanner; if(!host) return;
      if(!message){ host.dataset.show='false'; host.setAttribute('hidden',''); this._currentPrompt=''; return; }
      if(!force && this._currentPrompt===message) return;
      this._currentPrompt=message;
      const accentColor=(typeof color==='string' && color.trim())?color.trim():'';
      if(accentColor){
        host.dataset.color=accentColor;
        host.style.setProperty('--turn-accent',`var(--${accentColor}, var(--accent))`);
        host.style.setProperty('--turn-accent-soft',`var(--${accentColor}-ghost, rgba(34,211,238,0.2))`);
        host.style.setProperty('--turn-accent-border',`var(--${accentColor}, var(--accent))`);
        host.style.setProperty('--turn-accent-ink',`var(--${accentColor}, var(--accent))`);
      }else{
        delete host.dataset.color;
        host.style.setProperty('--turn-accent','var(--accent)');
        host.style.setProperty('--turn-accent-soft','rgba(34,211,238,0.2)');
        host.style.setProperty('--turn-accent-border','rgba(34,211,238,0.45)');
        host.style.setProperty('--turn-accent-ink','var(--fg)');
      }
      host.textContent=message;
      host.dataset.show='true';
      host.removeAttribute('hidden');
      if(this._turnBannerTimer){ clearTimeout(this._turnBannerTimer); }
      this._turnBannerTimer=setTimeout(()=>{
        host.dataset.show='false';
        this._turnBannerTimer=setTimeout(()=>{ host.setAttribute('hidden',''); },220);
      },duration);
      if(lock>0) this.lockInput(lock);
    },
    updateTurnPrompt(force=false){
      const msg=this.buildTurnPrompt();
      const stage=this.state.bonusSelecting?'bonus':(this.state.dice==null?'roll':'move');
      const lock=force && stage==='roll'?320:0;
      const current=this.currentPlayer();
      const color=current?.color||null;
      if(msg) this.showTurnPrompt(msg,{force,duration:2200,lock,color});
      else this.showTurnPrompt('',{force:true});
    },
    log(message,options={}){
      const host=this.$?.log; if(!host) return;
      const opts=(options && typeof options==='object')?options:{};
      const color=(typeof opts.color==='string' && opts.color.trim())?opts.color.trim():null;
      const tone=(typeof opts.tone==='string' && opts.tone.trim())?opts.tone.trim():'';
      const entry=document.createElement('div');
      entry.className='log-entry';
      const accent=color?`var(--${color}, var(--accent))`:(tone==='warning'?'#f59e0b':'var(--accent)');
      const accentSoft=color?`var(--${color}-ghost, rgba(34,211,238,0.2))`:(tone==='warning'?'rgba(249,115,22,0.22)':'rgba(34,211,238,0.2)');
      entry.style.setProperty('--log-accent',accent);
      entry.style.setProperty('--log-accent-soft',accentSoft);
      if(color){ entry.dataset.color=color; } else { delete entry.dataset.color; }
      if(tone && tone!=='default'){ entry.dataset.tone=tone; } else { delete entry.dataset.tone; }
      const timeSpan=document.createElement('span');
      timeSpan.className='log-entry__time';
      const time=new Date().toLocaleTimeString('zh-HK',{hour12:false});
      timeSpan.textContent=`[${time}]`;
      const messageSpan=document.createElement('span');
      messageSpan.className='log-entry__message';
      messageSpan.textContent=message;
      entry.appendChild(timeSpan);
      entry.appendChild(messageSpan);
      host.appendChild(entry);
      while(host.childElementCount>80){ host.removeChild(host.firstChild); }
      host.scrollTop=host.scrollHeight;
    },
    getAnimDuration(base){
      if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;
      const speed=(this.state.rules?.animSpeed)||'normal';
      if(speed==='slow') return Math.round(base*1.35);
      if(speed==='fast') return Math.round(base*0.65);
      return base;
    },
    clearTurnTimer(){
      if(this.state.turnTimerId){ clearTimeout(this.state.turnTimerId); this.state.turnTimerId=null; }
      this.state.turnTimerRemaining=0;
      if(this.$?.timer) this.$.timer.textContent='';
    },
    beginTurnTimer(){
      const secs=Number(this.state.rules?.turnTimerSec||0);
      if(!(secs>0)){ this.clearTurnTimer(); return; }
      this.clearTurnTimer();
      this.state.turnTimerRemaining=secs;
      const tick=()=>{
        if(!this.$?.timer) return;
        if(document.querySelector('dialog[open]')){this.state.turnTimerId=setTimeout(tick,1000);return;}
        this.$.timer.textContent=`⏱️ ${Math.max(0,this.state.turnTimerRemaining)}s`;
        if(this.state.turnTimerRemaining<=0){
          this.state.turnTimerId=null;
          this.handleTurnTimerExpired();
          return;
        }
        this.state.turnTimerRemaining-=1;
        this.state.turnTimerId=setTimeout(tick,1000);
      };
      tick();
    },
    handleTurnTimerExpired(){
      if(this.state.view!=='game' || this.state.animating || document.querySelector('dialog[open]')) return;
      const player=this.currentPlayer();
      if(!player) return;
      const label=this.formatPlayerName(player,{includeDifficulty:true});
      this.log(`${label} 超時！`,{color:player?.color||null});
      if(this.state.dice==null){
        this.rollDice('system');
      }else{
        this.log('回合已自動結束');
        this.advanceTurn();
      }
    },
    refreshLegalMoves(){
      if(!this.state.rules){ this.state.legalMoves=[]; this.highlightMovables(); return; }
      let warnings=[];
      if(this.state.dice==null){
        this.state.legalMoves=[];
      }else{
        const snapshot={players:this.state.players,pieces:this.state.pieces,turn:this.state.turn};
        this.state.legalMoves=window.GameRules.generateLegalMoves(snapshot,this.state.rules,this.state.dice);
        warnings=Array.isArray(window.GameRules.generateLegalMoves.lastWarnings)?window.GameRules.generateLegalMoves.lastWarnings:[];
      }
      if(this.state.bonusSelecting && this.state.pendingBonus && Array.isArray(this.state.legalMoves)){
        const pb=this.state.pendingBonus;
        this.state.legalMoves=this.state.legalMoves.filter(m=>{
          if(pb.restrict==='same') return m.pieceIndex===pb.pieceIndex;
          if(pb.restrict==='others') return m.pieceIndex!==pb.pieceIndex;
          return true;
        });
      }
      this.handleMoveWarnings(warnings);
      this.highlightMovables();
    },
    handleNoMoves(player){
      this.clearTurnTimer();
      const name=this.formatPlayerName(player,{includeDifficulty:true});
      this.showTurnPrompt(`${name} 無步可走`,{duration:1600,force:true,lock:400,color:player?.color||null});
      this.renderHints();
      if(this._noMoveTimer){ clearTimeout(this._noMoveTimer); }
      const epoch=this._gameEpoch||0;
      this._noMoveTimer=setTimeout(()=>{
        this._noMoveTimer=null;
        if(epoch!==(this._gameEpoch||0)||this.state.view!=='game') return;
        this.finishNoMoveTurn();
      },1200);
    },
    finishNoMoveTurn(){
      if(this._noMoveTimer!=null){clearTimeout(this._noMoveTimer);this._noMoveTimer=null;}
      if(this.state.view!=='game'||this.state.animating||this.state.legalMoves?.length) return;
      if(document.querySelector('dialog[open]')) {this.handleNoMoves(this.currentPlayer());return;}
      if(this.state.dice===6&&this.state.rules.extraTurnOnSix){
        this.state.dice=null;this.updateTurnUI();this.saveGame();this.maybeAutoPlayIfAI();
      }else this.advanceTurn();
    },
    handleMoveWarnings(warnings){
      const list=Array.isArray(warnings)?warnings:[];
      if(list.length===0){
        this._lastWarningsSignature='';
        return;
      }
      const signature=list.map(w=>`${w.type||'?'}:${w.playerId||''}:${w.idx??''}:${w.source||''}`).join('|');
      if(this._lastWarningsSignature===signature) return;
      this._lastWarningsSignature=signature;
      list.forEach(warning=>{
        if(warning.type==='portal-blocked'){
          const player=this.state.players.find(p=>p.id===warning.playerId);
          const name=this.formatPlayerName(player,{includeDifficulty:true});
          const tileLabel=(typeof warning.idx==='number')?`格 ${warning.idx}`:'該格';
          this.showToast(`🌀 傳送門落點被堵住（${tileLabel}）`,1800);
          this.log(`${name} 起飛受阻：傳送門落點被敵方堵路（${tileLabel}）`,{color:player?.color||null});
        }else if(warning.type==='invalid-start'){
          const player=this.state.players.find(p=>p.id===warning.playerId);
          const name=this.formatPlayerName(player,{includeDifficulty:true});
          const colorLabel=(warning.color && COLOR_LABELS?.[warning.color])||warning.color||'該顏色';
          this.showToast('⚠️ 無法起飛：起點未定義',1600);
          this.log(`${name} 無法起飛：棋盤未定義 ${colorLabel} 的起點`,{tone:'warning',color:player?.color||null});
        }
      });
    },
    updateTurnUI(){
      const player=this.currentPlayer();
      this.$.turn.textContent=player?`當前：${this.formatPlayerName(player,{includeDifficulty:true})}`:'當前：—';
      if(this.$?.turn){
        if(player?.color){
          this.$.turn.dataset.color=player.color;
          this.$.turn.style.setProperty('--turn-indicator-accent',`var(--${player.color}, var(--accent))`);
        }else{
          delete this.$.turn.dataset.color;
          this.$.turn.style.setProperty('--turn-indicator-accent','var(--accent)');
        }
      }
      this.setButtonDisabled(this.$.btnRoll,!player||this.isAI(player)||this.state.animating||this.state.dice!=null);
      const canUndo=!!(this.state.rules?.undoEnabled && Array.isArray(this.state.history) && this.state.history.length>0);
      this.setButtonDisabled(this.$.btnUndo,!canUndo);
      this.$.diceOut.textContent=this.state.dice==null?'–':String(this.state.dice);
      if(player && this.state.turnTimerId==null && this.state.dice==null){
        this.beginTurnTimer();
      }
      this.refreshLegalMoves();
      this.renderHints();
      this.updateTurnPrompt();
    },
    cloneDefaultRules(extra={}){
      const base=window.GameRules?.DEFAULT_RULES||{};
      const copy=(window.structuredClone? structuredClone(base) : JSON.parse(JSON.stringify(base)));
      return Object.assign(copy,extra||{});
    },
    renderLobbyPlayers(n){
      const host=this.$.playerList; if(!host) return; host.innerHTML='';
      const colors=['red','blue','yellow','green'];
      for(let i=0;i<n;i++){
        const tpl=document.getElementById('tpl-player-card'); const fragment=tpl.content.cloneNode(true);
        const card=fragment.querySelector('[data-player-card]');
        const idxLabel=fragment.querySelector('[data-idx]');
        if(idxLabel) idxLabel.textContent=i+1;
        const nameInput=fragment.querySelector('[data-name]');
        if(nameInput) nameInput.value = i===0?'Mandy':(i===1?'Brian':'');
        const colorValue=colors[i%colors.length];
        const colorSelect=fragment.querySelector('[data-color]');
        if(colorSelect) colorSelect.value=colorValue;
        const typeSelect=fragment.querySelector('[data-type]');
        if(typeSelect) typeSelect.value = (i<2?'human':'ai');
        const difficultySelect=fragment.querySelector('[data-difficulty]');
        if(difficultySelect) difficultySelect.value='normal';
        if(card) card.dataset.color=colorValue;
        const controlSelect=fragment.querySelector('[data-control]');
        if(controlSelect){ controlSelect.value='auto'; }
        if(card) this.syncPlayerCardType(card);
        host.appendChild(fragment);
      }
      this.refreshPlayerCardColors();
      this.updateBoardOverlay();
    },
    applyPreset(name){
      if(name==='classic') this.state.rules=this.cloneDefaultRules({takeoff:'six',takeoffAdvanceSteps:0,tripleSixPenalty:true,specials:{enabled:false,portalLimit:1,portalBypassBlockade:true}});
      else if(name==='fast') this.state.rules=this.cloneDefaultRules({takeoff:'fiveOrSix',animSpeed:'fast',finishExact:'bounceBack'});
      else if(name==='family') this.state.rules=this.cloneDefaultRules({takeoff:'even',captureOnLand:false,finishExact:'bounceBack',ownColorJump:{enabled:false,steps:4},dashedFlight:{enabled:false,captureOnLanding:false},specials:{enabled:false,portalLimit:1,portalBypassBlockade:true}});
      else this.state.rules=this.cloneDefaultRules();
      this.applyBoardDefaultsToRules();
      this.populateRulesForm(this.state.rules);
      this.updateSpecialsLegend();
    },
    setDefaultRules(){
      this.state.rules = this.cloneDefaultRules();
      this.applyBoardDefaultsToRules();
      this.populateRulesForm(this.state.rules);
      this.updateSpecialsLegend();
      const custom=this.$?.formSetup?.querySelector('input[name="preset"][value="custom"]');
      if(custom) custom.checked=true;
      if(this.$?.rulesAdvanced){
        this.$.rulesAdvanced.open=true;
        this.updateRulesAdvancedSummary();
      }
    },
    applyBoardDefaultsToRules(){
      if(!this.state.rules) return;
      const extras=window.GameRules.BOARD.special?.safeTiles?.extra||[];
      const safeRaw=this.state.rules.safeTiles||{};
      const merged=new Set([...(safeRaw.list||[]), ...extras]);
      const safe={ start:(safeRaw.start!==false), list:Array.from(merged).sort((a,b)=>a-b) };
      this.state.rules.safeTiles=safe;
      const specialsRaw=this.state.rules.specials||{};
      const specials=Object.assign({},specialsRaw);
      if(typeof specials.portalLimit!=='number' || Number.isNaN(specials.portalLimit)) specials.portalLimit=1;
      if(typeof specials.enabled!=='boolean') specials.enabled=true;
      if(specials.portalBypassBlockade===undefined || specials.portalBypassBlockade===null) specials.portalBypassBlockade=true;
      this.state.rules.specials=specials;
    },
    populateRulesForm(rules){
      const form=this.$?.formSetup;
      if(!form || !rules) return;
      const setRadio=(name,value)=>{
        const inputs=form.querySelectorAll(`input[name="${name}"]`);
        let matched=false;
        inputs.forEach(input=>{
          if(input && input.tagName==='INPUT' && input.type==='radio'){
            const shouldCheck=String(input.value)===String(value);
            input.checked=shouldCheck;
            if(shouldCheck) matched=true;
          }
        });
        if(!matched && inputs.length>0){
          const first=inputs[0];
          if(first && first.tagName==='INPUT' && first.type==='radio'){ first.checked=true; }
        }
      };
      const setCheckbox=(name,value)=>{
        const input=form.querySelector(`input[name="${name}"]`);
        if(input && input.tagName==='INPUT' && input.type==='checkbox'){ input.checked=!!value; }
      };
      const setNumber=(name,value)=>{
        const input=form.querySelector(`input[name="${name}"]`);
        if(input && input.tagName==='INPUT'){
          if(value==null || Number.isNaN(value)) input.value='';
          else input.value=String(value);
        }
      };
      const setSelect=(name,value)=>{
        const select=form.querySelector(`[name="${name}"]`);
        if(!select || select.tagName!=='SELECT') return;
        const raw=String(value);
        const hasValue=Array.from(select.options).some(opt=>opt.value===raw);
        if(hasValue){ select.value=raw; }
      };
      setRadio('takeoff', rules.takeoff||'even');
      setNumber('takeoffAdvanceSteps', Math.max(0, parseInt(rules.takeoffAdvanceSteps ?? 1,10)||0));
      setCheckbox('extraTurnOnSix', rules.extraTurnOnSix!==false);
      setCheckbox('tripleSixPenalty', rules.tripleSixPenalty);
      setCheckbox('captureOnLand', rules.captureOnLand!==false);
      setCheckbox('stackEnabled', rules.stackEnabled!==false);
      setCheckbox('stackMovesTogether', !!rules.stackMovesTogether);
      setCheckbox('blockadePassThrough', !!rules.blockadePassThrough);
      const jumpRules=rules.ownColorJump||{};
      setCheckbox('ownColorJumpEnabled', jumpRules.enabled!==false);
      setNumber('ownColorJumpSteps', Math.max(1, parseInt(jumpRules.steps ?? 4,10)||4));
      const flightRules=rules.dashedFlight||{};
      setCheckbox('dashedFlightEnabled', flightRules.enabled!==false);
      setCheckbox('captureOnFlight', flightRules.captureOnLanding!==false);
      setCheckbox('homeLaneExactEntry', rules.homeLaneExactEntry!==false);
      setSelect('finishExact', rules.finishExact||'exact');
      const safeRules=rules.safeTiles||{};
      setCheckbox('startTileSafe', safeRules.start!==false);
      const specialsRules=rules.specials||{};
      setCheckbox('specialsEnabled', specialsRules.enabled!==false);
      setCheckbox('portalBypassBlockade', specialsRules.portalBypassBlockade!==false);
      const timer=Math.max(0, parseInt(rules.turnTimerSec??0,10)||0);
      setNumber('turnTimerSec', timer);
      setSelect('animSpeed', rules.animSpeed||'normal');
      setCheckbox('undoEnabled', rules.undoEnabled!==false);
    },
    readRulesFromForm(){
      const f=this.$.formSetup; const chk=n=>!!f.querySelector(`[name="${n}"]`)?.checked; const val=n=>f.querySelector(`[name="${n}"]:checked`)?.value; const num=(n,d)=>{const x=parseInt(f.querySelector(`[name="${n}"]`)?.value??d,10); return isNaN(x)?d:x;};
      return {
        takeoff: val('takeoff')||'even', extraTurnOnSix:chk('extraTurnOnSix'), tripleSixPenalty:chk('tripleSixPenalty'),
        captureOnLand:chk('captureOnLand'), stackEnabled:chk('stackEnabled'), stackMovesTogether:chk('stackMovesTogether'), blockadePassThrough:chk('blockadePassThrough'),
        ownColorJump:{enabled:chk('ownColorJumpEnabled'),steps:num('ownColorJumpSteps',4)}, dashedFlight:{enabled:chk('dashedFlightEnabled'),captureOnLanding:chk('captureOnFlight')},
        homeLaneExactEntry:chk('homeLaneExactEntry'), finishExact:(f.querySelector('[name="finishExact"]')?.value)||'exact',
        safeTiles:{start:chk('startTileSafe'),list:[]},
        specials:{enabled:chk('specialsEnabled'),portalLimit:1,portalBypassBlockade:chk('portalBypassBlockade')},
        turnTimerSec:Math.max(0,num('turnTimerSec',0)),
        takeoffAdvanceSteps:Math.max(0,num('takeoffAdvanceSteps',1)),
        animSpeed:(()=>{ const raw=(f.querySelector('[name="animSpeed"]')?.value)||'normal'; return ['slow','normal','fast'].includes(raw)?raw:'normal'; })(),
        undoEnabled:chk('undoEnabled')
      };
    },
    normalizePieces(){
      for(const player of this.state.players){
        const pcs=Array.isArray(this.state.pieces[player.id])?this.state.pieces[player.id]:[];
        if(!this.state.finishedSlots) this.state.finishedSlots={};
        if(!this.state.finishedSlots[player.id]) this.state.finishedSlots[player.id]={};
        const finishedMap=this.state.finishedSlots[player.id];
        pcs.forEach((pc,idx)=>{
          if(typeof pc.baseSlot!=='number') pc.baseSlot=idx;
          if(pc.pos?.kind==='base' && typeof pc.pos.slot!=='number') pc.pos.slot=pc.baseSlot;
          if(pc.pos?.kind==='finished'){
            if(typeof finishedMap[idx]!=='number'){
              const used=new Set(Object.values(finishedMap));
              let nextSlot=0;
              while(used.has(nextSlot) && nextSlot<4){ nextSlot+=1; }
              finishedMap[idx]=nextSlot;
            }
            pc.finishedSlot=finishedMap[idx];
          }else{
            if(finishedMap) delete finishedMap[idx];
            delete pc.finishedSlot;
          }
        });
        this.state.pieces[player.id]=pcs;
      }
    },
    normalizePlayerControls(){
      if(!Array.isArray(this.state.players)) return;
      this.state.players=this.state.players.map(player=>{
        if(!player || typeof player!=='object') return player;
        const control=(player.control==='keyboard'||player.control==='mouse')?player.control:'auto';
        const isAIPlayer=this.isAI(player);
        const difficulty=isAIPlayer?this.normalizeDifficulty(player.difficulty||'normal'):null;
        return Object.assign({},player,{control,difficulty:isAIPlayer?difficulty:null});
      });
    },
    startGame(){
      // players
      const cards=this.$.playerList.querySelectorAll('[data-player-card]'); const players=[]; const seen=new Set(); const duplicateColors=new Set();
      cards.forEach((card,idx)=>{
        const name=card.querySelector('[data-name]').value||`玩家${idx+1}`;
        const color=(card.querySelector('[data-color]')?.value||'').trim();
        const type=card.querySelector('[data-type]').value||'human';
        const controlRaw=card.querySelector('[data-control]')?.value||'auto';
        const control=(controlRaw==='keyboard'||controlRaw==='mouse')?controlRaw:'auto';
        const difficultySelect=card.querySelector('[data-difficulty]');
        const difficultyRaw=difficultySelect?difficultySelect.value:'normal';
        const difficulty=(type==='ai')?this.normalizeDifficulty(difficultyRaw):null;
        if(color && seen.has(color)){
          duplicateColors.add(color);
          return;
        }
        if(color){
          seen.add(color);
          players.push({id:`P${idx+1}`,name,color,type,control,difficulty});
        }
      });
      if(duplicateColors.size>0){
        this.showToast('⚠️ 玩家顏色不可重複，請為每位玩家選擇不同顏色');
        this.log('玩家顏色不可重複，請調整後再開始',{tone:'warning'});
        this.updateBoardOverlay();
        return;
      }
      if(players.length<2){ this.showToast('請至少設定 2 位擁有不同顏色的玩家'); this.log('至少需要 2 位玩家',{tone:'warning'}); this.updateBoardOverlay(); return; }
      if(this.$?.dialogVictory) closeDialogSafe(this.$.dialogVictory);
      const celebration=document.getElementById('winner-celebration');
      if(celebration && celebration.parentNode) celebration.parentNode.removeChild(celebration);
      this.cancelPendingActions();
      this.state.players=players; this.normalizePlayerControls(); this.state.turn=players[0].id; this.state.history=[]; this.state.pieces={};
      this.state.consecutiveSixes={};
      this.state.pendingExtraTurn=false;
      this.state.skipTurns={};
      this.state.turbulenceRecoveries={};
      this.state.bonusSelecting=false;
      this.state.pendingBonus=null;
      this.state.lastMoveSummary=null;
      this.state.finishOrder=[];
      this.state.winner=null;
      this.state.disabledColors={};
      this.state.finishedSlots={};
      this.updateControlAssignments();
      const preset=(this.$.formSetup.querySelector('input[name="preset"]:checked')?.value)||'custom';
      if(preset==='custom'){ this.state.rules = this.cloneDefaultRules(this.readRulesFromForm()); this.applyBoardDefaultsToRules(); this.populateRulesForm(this.state.rules); }
      else { this.applyPreset(preset); }
      const pieceCount=window.GameRules.BOARD.bases.perPlayer||1;
      for(const p of players){
        this.state.pieces[p.id]=Array.from({length:pieceCount},(_,idx)=>({pos:window.GameRules.Pos.base(idx), baseSlot:idx}));
        this.state.consecutiveSixes[p.id]=0;
        this.state.skipTurns[p.id]=0;
        this.state.turbulenceRecoveries[p.id]=0;
      }
      this.normalizePieces();
      this.state.legalMoves=[]; this.state.animating=false; this.state.dice=null;
      this.$.diceOut.textContent='–';
      this.$.movables.innerHTML='';
      this.$.gHL.innerHTML='';
      this.$.log.innerHTML='';
      this.state.players.filter(p=>this.isAI(p)).forEach(p=>{
        this.log(`${this.formatPlayerName(p,{includeDifficulty:true})} 將以此難度應戰`,{color:p?.color||null});
      });
      this.renderLastMove();
      this.clearGhostPath();
      this.clearTurnTimer();
      this.toGame(); this.bootstrapBoard(); this.redrawPieces(); this.updateTurnUI(); this.updateTurnPrompt(true); this.saveGame(); this.log('遊戲開始！');
      const toastMsg=this._pendingToast||'新局開始，祝你順風！';
      if(toastMsg) this.showToast(toastMsg);
      this._pendingToast=null;
      this.maybeAutoPlayIfAI();
      this.setButtonDisabled(this.$.btnContinue,false);
    },
    toGame(){
      this.state.view='game';
      if(this.$?.rulesAdvanced){
        this.$.rulesAdvanced.open=false;
        this.updateRulesAdvancedSummary();
      }
      this.updateViewVisibility();
      this.updateBoardOverlay();
      this.updateSpecialsLegend();
    },
    toLobby(){
      // Keep the paused game separate from edits to the next game's setup.
      if(this.state.view==='game') this._suspendedSnapshot=this.snapshot();
      this.cancelPendingActions();
      this.state.view='lobby';
      this.updateViewVisibility();
      this.updateBoardOverlay();
      this.updateSpecialsLegend();
      this.clearTurnTimer();
      const existingCount=Array.isArray(this.state.players)?this.state.players.length:0;
      const count=existingCount>0?existingCount:(parseInt(this.$?.playerCount?.value||'2',10)||2);
      if(this.$?.playerCount) this.$.playerCount.value=String(count);
      this.renderLobbyPlayers(count);
      const cards=this.$?.playerList?.querySelectorAll('[data-player-card]');
      if(cards){
        this.state.players?.forEach((player,idx)=>{
          const card=cards[idx];
          if(!card) return;
          const nameInput=card.querySelector('[data-name]');
          if(nameInput) nameInput.value=player.name||`玩家${idx+1}`;
          const colorSelect=card.querySelector('[data-color]');
          if(colorSelect && player.color){ colorSelect.value=player.color; }
          const typeSelect=card.querySelector('[data-type]');
          if(typeSelect && player.type){ typeSelect.value=player.type; }
          const difficultySelect=card.querySelector('[data-difficulty]');
          if(difficultySelect){
            const diff=this.normalizeDifficulty(player.difficulty||'normal');
            difficultySelect.value=diff;
          }
          const controlSelect=card.querySelector('[data-control]');
          if(controlSelect && player.control){ controlSelect.value=player.control; }
          this.syncPlayerCardType(card);
        });
        this.refreshPlayerCardColors();
      }
    },

    restartGame(){
      if(!Array.isArray(this.state.players) || this.state.players.length<2){
        this.log('未有進行中的對局',{tone:'warning'});
        return;
      }
      if(this.$?.dialogVictory) closeDialogSafe(this.$.dialogVictory);
      const celebration=document.getElementById('winner-celebration');
      if(celebration && celebration.parentNode) celebration.parentNode.removeChild(celebration);
      this.cancelPendingActions();
      this.updateControlAssignments();
      const pieceCount=window.GameRules.BOARD.bases.perPlayer||1;
      this.state.pieces={};
      this.state.consecutiveSixes={};
      this.state.pendingExtraTurn=false;
      this.state.skipTurns={};
      this.state.bonusSelecting=false;
      this.state.pendingBonus=null;
      this.state.lastMoveSummary=null;
      this.state.finishOrder=[];
      this.state.winner=null;
      this.state.disabledColors={};
      this.state.finishedSlots={};
      this.state.turbulenceRecoveries={};
      for(const p of this.state.players){
        this.state.pieces[p.id]=Array.from({length:pieceCount},(_,idx)=>({pos:window.GameRules.Pos.base(idx), baseSlot:idx}));
        this.state.consecutiveSixes[p.id]=0;
        this.state.skipTurns[p.id]=0;
        this.state.turbulenceRecoveries[p.id]=0;
      }
      this.normalizePieces();
      this.state.turn=this.state.players[0].id;
      this.state.history=[];
      this.state.legalMoves=[];
      this.state.animating=false;
      this.state.dice=null;
      this.$.diceOut.textContent='–';
      this.$.movables.innerHTML='';
      this.$.gHL.innerHTML='';
      this.$.log.innerHTML='';
      this.state.players.filter(p=>this.isAI(p)).forEach(p=>{
        this.log(`${this.formatPlayerName(p,{includeDifficulty:true})} 將以此難度應戰`,{color:p?.color||null});
      });
      this.renderLastMove();
      this.clearGhostPath();
      this.clearTurnTimer();
      this.toGame();
      this.bootstrapBoard();
      this.redrawPieces();
      this.updateTurnUI();
      this.updateTurnPrompt(true);
      this.saveGame();
      this.log('已重開新局');
      const toastMsg=this._pendingToast||'新局已重置';
      if(toastMsg) this.showToast(toastMsg);
      this._pendingToast=null;
      this.maybeAutoPlayIfAI();
      this.setButtonDisabled(this.$.btnContinue,false);
      this.updateSpecialsLegend();
    },

    rollDice(source='system'){
      if(this.state.view!=='game'){ return; }
      if(!this.isInteractionPermitted(source)){ this.handleBlockedInteraction(source); return; }
      if(this.state.animating){ this.log('動畫進行中，稍候再擲',{tone:'warning'}); return; }
      if(this.state.bonusSelecting){ this.showToast('先完成增益移動',1200); return; }
      if(this.state.dice!=null){ this.log('本回合已擲骰',{tone:'warning'}); return; }
      const player=this.currentPlayer();
      if(!player){ return; }
      const label=this.formatPlayerName(player,{includeDifficulty:true});
      const color=player?.color||null;
      const value=1+Math.floor(Math.random()*6);
      this.state.dice=value;
      this.setButtonDisabled(this.$.btnRoll,true);
      this.$.diceOut.textContent=String(value);
      this.log(`${label} 擲出 ${value}`,{color});
      const pid=player.id;
      const prev=this.state.consecutiveSixes?.[pid]||0;
      if(!this.state.consecutiveSixes) this.state.consecutiveSixes={};
      if(value===6){ this.state.consecutiveSixes[pid]=prev+1; }
      else { this.state.consecutiveSixes[pid]=0; }
      if(value===6 && this.state.rules?.tripleSixPenalty && this.state.consecutiveSixes[pid]>=3){
        this.log(`${label} 連續三次擲出 6，被判失去回合`,{color});
        this.state.consecutiveSixes[pid]=0;
        this.state.dice=null;
        this.$.diceOut.textContent='–';
        this.state.legalMoves=[];
        this.highlightMovables();
        this.renderHints();
        this.clearTurnTimer();
        this.updateTurnPrompt(true);
        this.advanceTurn();
        return;
      }
      this.refreshLegalMoves();
      this.renderHints();
      this.saveGame();
      const moveCount=(this.state.legalMoves||[]).length;
      if(moveCount===0){
        this.log(`${label} 無步可走`,{color});
        this.handleNoMoves(player);
        return;
      }
      this.clearTurnTimer();
      this.beginTurnTimer();
      this.updateTurnPrompt(true);
      this.maybeAutoPlayIfAI();
    },

    // --------- Board Rendering ---------

    bootstrapBoard(){
      const svg=this.$.svg; const W=1000,H=1000; svg.setAttribute('viewBox',`0 0 ${W} ${H}`); const cx=W/2,cy=H/2,r=380;
      const gBack=this.$.gBack,gGrid=this.$.gGrid,gTiles=this.$.gTiles,gSpecials=this.$.gSpecials,gHud=this.$.gHud,gPieces=this.$.gPieces,gHL=this.$.gHL;
      if(gBack) gBack.innerHTML='';
      if(gGrid){
        gGrid.innerHTML='';
        const gridColor=(getComputedStyle(document.body).getPropertyValue('--tile-grid')||'#374151').trim()||'#374151';
        const mkLine=(x1,y1,x2,y2)=>{
          const ln=document.createElementNS(SVG_NS,'line');
          ln.setAttribute('x1',x1); ln.setAttribute('y1',y1);
          ln.setAttribute('x2',x2); ln.setAttribute('y2',y2);
          ln.setAttribute('stroke',gridColor);
          ln.setAttribute('stroke-width','1.5');
          ln.setAttribute('stroke-dasharray','6 6');
          ln.setAttribute('opacity','0.6');
          return ln;
        };
        const center=500;
        gGrid.appendChild(mkLine(center,0,center,1000));
        gGrid.appendChild(mkLine(0,center,1000,center));
        const dot=document.createElementNS(SVG_NS,'circle');
        dot.setAttribute('cx',center); dot.setAttribute('cy',center);
        dot.setAttribute('r','5');
        dot.setAttribute('fill',gridColor);
        dot.setAttribute('opacity','0.6');
        gGrid.appendChild(dot);
      }
      gTiles.innerHTML=gSpecials.innerHTML=gPieces.innerHTML=gHL.innerHTML='';
      if(gHud){
        gHud.innerHTML='';
        const hudStatic=document.createElementNS(SVG_NS,'g');
        hudStatic.setAttribute('class','hud-static');
        const hudDynamic=document.createElementNS(SVG_NS,'g');
        hudDynamic.setAttribute('class','hud-dynamic');
        gHud.appendChild(hudStatic);
        gHud.appendChild(hudDynamic);
        this._hudLayers={static:hudStatic,dynamic:hudDynamic};
      }else{
        this._hudLayers={static:null,dynamic:null};
      }
      const existingDefs=svg.querySelector('defs');
      if(existingDefs) svg.removeChild(existingDefs);
      const defs=document.createElementNS(SVG_NS,'defs');
      svg.insertBefore(defs,svg.firstChild);
      const el=(n,a={},children=[])=>{ const node=document.createElementNS(SVG_NS,n); for(const [k,v] of Object.entries(a)){ node.setAttribute(k,String(v)); } children.forEach(child=>node.appendChild(child)); return node; };
      const planeShape=el('g',{id:'plane-shape'},[
        el('circle',{cx:0,cy:0,r:12,fill:'currentColor','fill-opacity':'0.16',stroke:'none'}),
        el('path',{d:'M0,-12 C1,-12 2,-10 2,-8 L2,-3 L10,2 L10,5 L2,2 L2,8 L5,10 L5,12 L0,10 L-5,12 L-5,10 L-2,8 L-2,2 L-10,5 L-10,2 L-2,-3 L-2,-8 C-2,-10 -1,-12 0,-12 Z',fill:'currentColor',stroke:'#0b0f14','stroke-width':0.8,'stroke-linejoin':'round'}),
        el('path',{d:'M0,-9 L0,6',stroke:'rgba(255,255,255,.65)','stroke-width':0.7,'stroke-linecap':'round','fill':'none'})
      ]);
      defs.appendChild(planeShape);
      const finishBadge=el('g',{id:'finish-badge'},[
        el('circle',{r:11,cx:0,cy:0,fill:'rgba(2,6,23,0.92)',stroke:'rgba(255,255,255,0.95)','stroke-width':2.4}),
        el('path',{d:'M-3.5,5 L-3.5,-6',stroke:'rgba(148,163,184,0.95)','stroke-width':1.6,'stroke-linecap':'round'}),
        el('path',{d:'M-3.5,-6 L4.6,-8 L4.6,0 L-3.5,-2 Z',fill:'rgba(248,250,252,0.94)',stroke:'rgba(15,23,42,0.45)','stroke-width':0.9,'stroke-linejoin':'round'}),
        el('path',{d:'M-6.6,2.2 Q-2.2,6.4 2.6,3.4',stroke:'rgba(34,197,94,0.95)','stroke-width':1.8,'stroke-linecap':'round','fill':'none'}),
        el('circle',{cx:-4.2,cy:-2.2,r:1.2,fill:'rgba(14,165,233,0.95)'})
      ]);
      defs.appendChild(finishBadge);
      const glow=el('filter',{id:'glow',x:'-50%',y:'-50%',width:'200%',height:'200%'});
      const blur=document.createElementNS(SVG_NS,'feGaussianBlur');
      blur.setAttribute('stdDeviation','3.5');
      blur.setAttribute('result','coloredBlur');
      const merge=document.createElementNS(SVG_NS,'feMerge');
      const mergeNode1=document.createElementNS(SVG_NS,'feMergeNode');
      mergeNode1.setAttribute('in','coloredBlur');
      const mergeNode2=document.createElementNS(SVG_NS,'feMergeNode');
      mergeNode2.setAttribute('in','SourceGraphic');
      merge.appendChild(mergeNode1);
      merge.appendChild(mergeNode2);
      glow.appendChild(blur);
      glow.appendChild(merge);
      defs.appendChild(glow);
      const css=getComputedStyle(document.body);
      const color=(name)=>css.getPropertyValue(name).trim();
      const ensureColor=(value,fallback)=>{ const trimmed=(value||'').trim(); return trimmed.length?trimmed:fallback; };
      const colorMarkers=window.GameRules?.COLOR_MARKERS||{};
      const markerForColor=(col)=>colorMarkers[col]||null;
      const markerSymbol=(col)=>markerForColor(col)?.symbol||'●';
      const geom=this.geom=window.BoardGeometry.create(window.GameRules.BOARD);
      const isCompact=window.matchMedia('(max-width: 959px)').matches;
      const tileSize=geom.tileSize;
      const hudSafetyMargin=isCompact?24:28;
      const hudTrackOutset=tileSize/2+hudSafetyMargin;
      const quadrantLabelOutset=hudTrackOutset+18;
      const parseHex=(value)=>{
        const raw=String(value||'').trim();
        const hex=raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if(hex){
          const h=hex[1].length===3?hex[1].split('').map(c=>c+c).join(''):hex[1];
          const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
          return {r,g,b};
        }
        const rgb=raw.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
        if(rgb){const [r,g,b]=rgb.slice(1,4).map(v=>Math.max(0,Math.min(255,Math.round(Number(v)))));return {r,g,b};}
        return {r:56,g:189,b:248};
      };
      const mixWithWhite=(hex,amount)=>{ const {r,g,b}=parseHex(hex); const mix=c=>Math.round(c+(255-c)*amount); return`rgb(${mix(r)},${mix(g)},${mix(b)})`; };
      const withAlpha=(hex,alpha)=>{ const {r,g,b}=parseHex(hex); return`rgba(${r},${g},${b},${alpha})`; };
      const tileBaseFill=withAlpha(ensureColor(color('--tile-grid'),'#1f2937'),0.28);
      const tileBorderColor=withAlpha(ensureColor(color('--tile-grid'),'#1f2937'),0.72);
      const rad=(deg)=>deg*Math.PI/180;
      // Geometry is calculated by BoardGeometry, not a stadium track.
      const normalFromAngle=(a)=>({nx:-Math.sin(a),ny:Math.cos(a)});
      const arcPath=(centerX,centerY,rInner,rOuter,startDeg,endDeg)=>{
        const startRad=rad(startDeg);
        const endRad=rad(endDeg);
        const outerStart={x:centerX+Math.cos(startRad)*rOuter,y:centerY+Math.sin(startRad)*rOuter};
        const outerEnd={x:centerX+Math.cos(endRad)*rOuter,y:centerY+Math.sin(endRad)*rOuter};
        const innerEnd={x:centerX+Math.cos(endRad)*rInner,y:centerY+Math.sin(endRad)*rInner};
        const innerStart={x:centerX+Math.cos(startRad)*rInner,y:centerY+Math.sin(startRad)*rInner};
        const sweep=Math.abs(endDeg-startDeg)>180?1:0;
        return`M ${outerStart.x} ${outerStart.y} A ${rOuter} ${rOuter} 0 ${sweep} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${rInner} ${rInner} 0 ${sweep} 0 ${innerStart.x} ${innerStart.y} Z`;
      };
      const starPoints=(centerX,centerY,outer,inner)=>{
        const pts=[];
        for(let i=0;i<10;i++){
          const angle=(Math.PI/2)+(i*Math.PI/5);
          const radius=(i%2===0)?outer:inner;
          const px=centerX+Math.cos(angle)*radius;
          const py=centerY-Math.sin(angle)*radius;
          pts.push(`${px},${py}`);
        }
        return pts.join(' ');
      };
      const drawChevron=(group,x,y,a,size=10)=>{
        const length=size*1.6;
        const tail=size*0.9;
        const tipX=x+Math.cos(a)*length;
        const tipY=y+Math.sin(a)*length;
        const tailX=x-Math.cos(a)*tail;
        const tailY=y-Math.sin(a)*tail;
        const normalX=-Math.sin(a);
        const normalY=Math.cos(a);
        const width=size*0.7;
        const base1X=tailX+normalX*width;
        const base1Y=tailY+normalY*width;
        const base2X=tailX-normalX*width;
        const base2Y=tailY-normalY*width;
        group.appendChild(el('line',{x1:tailX,y1:tailY,x2:tipX,y2:tipY,stroke:'rgba(255,255,255,0.32)','stroke-width':2.2,'stroke-linecap':'round'}));
        group.appendChild(el('polygon',{points:`${tipX},${tipY} ${base1X},${base1Y} ${base2X},${base2Y}`,fill:'rgba(255,255,255,0.7)'}));
      };
      const drawQuadrant=(startDeg,endDeg,colorHex,label)=>{
        const col={R:'red',B:'blue',Y:'yellow',G:'green'}[label];
        const base=geom.baseCenters[col];
        if(!base) return;
        const half=geom.baseSize/2;
        if(gBack) gBack.appendChild(el('rect',{
          x:base.x-half-8,y:base.y-half-8,width:geom.baseSize+16,
          height:geom.baseSize+16,rx:28,fill:withAlpha(colorHex,0.07)
        }));
        const hudStatic=this._hudLayers?.static;
        if(hudStatic) hudStatic.appendChild(el('text',{
          x:base.x,y:base.y-half+22,'text-anchor':'middle',
          'dominant-baseline':'central','font-size':13,
          fill:withAlpha(colorHex,0.52),'font-weight':'700'
        },[document.createTextNode(label)]));
      };
      const tooltipFor=(info)=>{
        if(!info) return '';
        const colorLabel={red:'紅',blue:'藍',yellow:'黃',green:'綠'};
        if(info.type==='safe') return '安全格：不可被吃';
        if(info.type==='start'){
          const marker=markerForColor(info.color);
          const suffix=marker?.symbol?`（${marker.symbol}）`:'';
          return `${colorLabel[info.color]||''} 起飛格${suffix}`;
        }
        if(info.type==='jump') return `${colorLabel[info.color]||''} 跳格入口`;
        if(info.type==='portal'){
          if(info.color) return `傳送門 ${info.label}（${colorLabel[info.color]||info.color} 專用）：${info.from} → ${info.to}`;
          return `傳送門 ${info.label}: ${info.from} → ${info.to}`;
        }
        if(info.type==='power'){
          if(info.effect==='extra-roll') return '增益：再擲一次';
          if(info.effect==='advance-2') return '增益：前進 2 格';
          if(info.effect==='command-other') return '增益：指揮其他棋 +1';
          return '增益格';
        }
        if(info.type==='trap'){
          if(info.effect==='skip-turn') return '陷阱：下回合停飛';
          return '陷阱格';
        }
        return '';
      };
      if(gBack){
        const outer=geom.gridSize*geom.cellSize+30;
        gBack.appendChild(el('rect',{
          x:cx-outer/2,y:cy-outer/2,width:outer,height:outer,rx:32,
          fill:withAlpha(ensureColor(color('--bg'),'#0a0a0a'),0.88),
          stroke:withAlpha(ensureColor(color('--tile-grid'),'#1f2937'),0.4),'stroke-width':2
        }));
      }
      const quadrants=[
        {label:'R',color:color('--red'),start:-135,end:-45},
        {label:'B',color:color('--blue'),start:-45,end:45},
        {label:'Y',color:color('--yellow'),start:45,end:135},
        {label:'G',color:color('--green'),start:135,end:225}
      ];
      quadrants.forEach(q=>drawQuadrant(q.start,q.end,q.color,q.label));
      const total=window.GameRules.BOARD.track.length; const startIdx=window.GameRules.BOARD.track.startIndex; const entryIdx=window.GameRules.BOARD.homeLane.entryIndex; const ownJumpData=window.GameRules.BOARD.special.ownColorJump||{};
      const points=geom.track;
      const specials=window.GameRules.BOARD.special||{};
      const safeExtras=new Set((specials.safeTiles?.extra)||[]);
      const specialByIdx=window.GameRules.SPECIAL_BY_IDX||{};
      const portalPairs=new Map();
      (specials.portals||[]).forEach(p=>{
        if(!p || !p.label) return;
        const key=p.color?`${p.label}-${p.color}`:p.label;
        if(!portalPairs.has(key)) portalPairs.set(key,{label:p.label,color:p.color||null,indices:new Set()});
        const entry=portalPairs.get(key);
        entry.indices.add(p.from);
        entry.indices.add(p.to);
      });
      const jumpPatterns={};
      const ensureJumpPattern=(col)=>{
        if(jumpPatterns[col]) return jumpPatterns[col];
        const hex=color(`--${col}`);
        const pattern=el('pattern',{id:`jump-${col}`,patternUnits:'userSpaceOnUse',width:10,height:10});
        pattern.appendChild(el('rect',{width:10,height:10,fill:withAlpha(hex,0.12)}));
        pattern.appendChild(el('circle',{cx:3,cy:3,r:1.4,fill:withAlpha(hex,0.35)}));
        pattern.appendChild(el('circle',{cx:8,cy:8,r:1.2,fill:withAlpha(hex,0.28)}));
        defs.appendChild(pattern); jumpPatterns[col]=pattern; return pattern;
      };
      const ownJumpLookup = ownJumpData.lookupByIndex || (()=>{
        const fallback={};
        Object.entries(ownJumpData.indices||{}).forEach(([col,arr])=>{
          if(!Array.isArray(arr)) return;
          arr.forEach(idx=>{ fallback[idx]=col; });
        });
        return fallback;
      })();
      const startIndexByColor=Object.fromEntries(Object.entries(startIdx).map(([col,idx])=>[idx,col]));
      const entryIndexByColor=Object.fromEntries(Object.entries(entryIdx).map(([col,idx])=>[idx,col]));
      const chevronData=[];
      const cardinalTargets=[0,90,180,270];
      const cardinalBest=cardinalTargets.map(()=>({idx:-1,delta:Infinity}));
      for(let i=0;i<total;i++){
        const {x,y,angle:tangent}=points[i];
        // Do not overwrite the canonical track position.
        const tangentDeg=tangent*180/Math.PI;
        const gTile=el('g',{transform:`translate(${x} ${y})`,'data-track-index':i});
        const borderGroup=el('g',{'data-tile-face':'true'});
        const baseAttrs={x:-tileSize/2,y:-tileSize/2,width:tileSize,height:tileSize,rx:10,fill:tileBaseFill,stroke:tileBorderColor,'stroke-width':2};
        const jumpCol=ownJumpLookup[i];
        if(jumpCol){ const hex=ensureColor(color(`--${jumpCol}`),'#38bdf8'); baseAttrs.fill=mixWithWhite(hex,0.16); baseAttrs.stroke=withAlpha(hex,0.65); baseAttrs['stroke-width']=2.5; }
        borderGroup.appendChild(el('rect',baseAttrs));
        if(jumpCol){ ensureJumpPattern(jumpCol); borderGroup.appendChild(el('rect',{x:-tileSize/2,y:-tileSize/2,width:tileSize,height:tileSize,rx:10,fill:`url(#jump-${jumpCol})`,opacity:0.45})); }
        gTile.appendChild(borderGroup);
        const gIcon=el('g',{transform:'rotate(0)'});
        gTile.appendChild(gIcon);
        gTiles.appendChild(gTile);
        const specialEntry=specialByIdx[i];
        const startColor=startIndexByColor[i];
        const isSafeExtra=safeExtras.has(i);
        if(isSafeExtra){
          gIcon.appendChild(el('circle',{r:tileSize*0.38,class:'tile-icon tile-ring',stroke:'#BEE3F8'}));
        }
        if(startColor){
          const hex=ensureColor(color(`--${startColor}`),'#38bdf8');
          gIcon.appendChild(el('circle',{r:tileSize*0.36,fill:withAlpha(hex,0.28),stroke:withAlpha(hex,0.85),'stroke-width':2.6}));
          const marker=markerForColor(startColor);
          const shapeSize=tileSize*0.34;
          const strokeColor='#0b0f14';
          if(marker?.shape==='triangle'){
            gIcon.appendChild(el('path',{d:`M 0 ${-shapeSize*0.6} L ${shapeSize*0.52} ${shapeSize*0.6} L ${-shapeSize*0.52} ${shapeSize*0.6} Z`,fill:hex,stroke:strokeColor,'stroke-width':1.6,'stroke-linejoin':'round'}));
          }else if(marker?.shape==='square'){
            const side=shapeSize*0.9;
            gIcon.appendChild(el('rect',{x:-side/2,y:-side/2,width:side,height:side,rx:4,fill:hex,stroke:strokeColor,'stroke-width':1.6}));
          }else if(marker?.shape==='diamond'){
            const diag=shapeSize*0.75;
            gIcon.appendChild(el('path',{d:`M 0 ${-diag} L ${diag} 0 L 0 ${diag} L ${-diag} 0 Z`,fill:hex,stroke:strokeColor,'stroke-width':1.6,'stroke-linejoin':'round'}));
          }else if(marker?.shape==='cross'){
            const arm=shapeSize*0.28;
            const half=shapeSize*0.72;
            const points=[
              {x:-arm,y:-half},{x:arm,y:-half},{x:arm,y:-arm},{x:half,y:-arm},
              {x:half,y:arm},{x:arm,y:arm},{x:arm,y:half},{x:-arm,y:half},
              {x:-arm,y:arm},{x:-half,y:arm},{x:-half,y:-arm},{x:-arm,y:-arm}
            ];
            const d=['M',`${points[0].x} ${points[0].y}`];
            for(let idx=1;idx<points.length;idx++){ d.push('L',`${points[idx].x} ${points[idx].y}`); }
            d.push('Z');
            gIcon.appendChild(el('path',{d:d.join(' '),fill:hex,stroke:strokeColor,'stroke-width':1.6,'stroke-linejoin':'round'}));
          }else{
            gIcon.appendChild(el('circle',{r:shapeSize*0.48,fill:hex,stroke:strokeColor,'stroke-width':1.6}));
          }
        }
        if(specialEntry?.type==='trap'){
          gIcon.appendChild(el('rect',{x:-8,y:-8,width:16,height:16,transform:'rotate(45)',fill:'rgba(255,95,109,.25)',stroke:'rgba(255,95,109,.9)',class:'tile-icon'}));
        }else if(specialEntry?.type==='power'){
          gIcon.appendChild(el('circle',{r:5,fill:'rgba(255,255,255,.9)'}));
          gIcon.appendChild(el('circle',{r:tileSize*0.32,class:'tile-icon tile-ring',stroke:'rgba(255,255,255,.82)'}));
        }else if(specialEntry?.type==='portal'){
          const accentBase=ensureColor(specialEntry.color?color(`--${specialEntry.color}`):color('--accent'),'#38bdf8');
          const stroke=withAlpha(accentBase,0.9);
          const fill=specialEntry.color?withAlpha(accentBase,0.24):'none';
          const textFill=specialEntry.color?'#0b0f14':'#fff';
          gIcon.appendChild(el('circle',{r:tileSize*0.34,class:'tile-icon',stroke,fill}));
          gIcon.appendChild(el('text',{y:1,'text-anchor':'middle','dominant-baseline':'central','font-weight':'700','font-size':14,'fill':textFill},[document.createTextNode(specialEntry.label||'●')]));
        }
        const tooltipCandidates=[];
        if(specialEntry) tooltipCandidates.push(tooltipFor(specialEntry));
        if(isSafeExtra) tooltipCandidates.push(tooltipFor({type:'safe'}));
        if(startColor) tooltipCandidates.push(tooltipFor({type:'start',color:startColor}));
        if(jumpCol) tooltipCandidates.push(tooltipFor({type:'jump',color:jumpCol}));
        const tooltipText=tooltipCandidates.find(Boolean);
        if(tooltipText){
          gIcon.appendChild(el('title',{},[document.createTextNode(tooltipText)]));
        }
        chevronData.push({x,y,angle:tangent,idx:i});
        const normDeg=(tangent*180/Math.PI+360)%360;
        cardinalTargets.forEach((target,ci)=>{
          const rawDiff=Math.abs(normDeg-target);
          const diff=Math.min(rawDiff,360-rawDiff);
          if(diff<cardinalBest[ci].delta){ cardinalBest[ci]={idx:i,delta:diff}; }
        });
        const hudStatic=this._hudLayers?.static;
        if(hudStatic && i%5===0 && !this.state.settings.debugBoard){
          const {nx,ny}=normalFromAngle(tangent);
          const outward={x:-nx,y:-ny};
          const tickDist=hudTrackOutset;
          const tx=x+outward.x*tickDist;
          const ty=y+outward.y*tickDist;
          hudStatic.appendChild(el('text',{x:tx,y:ty,'text-anchor':'middle','dominant-baseline':'central','font-size':10,'fill':'rgba(255,255,255,.7)'},[document.createTextNode(String(i))]));
        }
      }
      const cardinalSet=new Set(cardinalBest.map(entry=>entry.idx).filter(idx=>idx>=0));
      const hudStatic=this._hudLayers?.static;
      if(hudStatic){
        const chevronGroup=el('g',{class:'tile-chevron-group'});
        chevronData.forEach(({x,y,angle,idx})=>{
          if(idx%3!==0) return;
          const next=geom.track[(idx+1)%total];
          // Small arrows sit in the gap, never over a special icon or a plane.
          drawChevron(chevronGroup,(x+next.x)/2,(y+next.y)/2,angle,2.5);
        });
        hudStatic.appendChild(chevronGroup);
      }
      if(portalPairs.size>0){
        const portalLines=el('g',{opacity:0.55});
        const colorLabelMap={red:'紅',blue:'藍',yellow:'黃',green:'綠'};
        portalPairs.forEach(({indices,label,color:portalColor})=>{
          const points=Array.from(indices).map(idx=>geom.track[idx]).filter(Boolean);
          if(points.length>=2){
            const [p1,p2]=points;
            const portalBase=ensureColor(portalColor?color(`--${portalColor}`):color('--accent'),'#38bdf8');
            const strokeColor=withAlpha(portalBase,0.85);
            portalLines.appendChild(el('line',{x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y,stroke:strokeColor,'stroke-dasharray':'8 6','stroke-width':2.6,'stroke-linecap':'round'}));
            const mid={x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2};
            const textColor=portalColor?strokeColor:portalBase;
            const suffix=portalColor?`·${colorLabelMap[portalColor]||portalColor}`:'';
            portalLines.appendChild(el('text',{x:mid.x,y:mid.y-8,'text-anchor':'middle','font-size':'12','font-weight':'600','fill':textColor},[document.createTextNode(`🌀${label}${suffix}`)]));
          }
        });
        portalLines.setAttribute('class','portal-paths');
        portalLines.setAttribute('pointer-events','none');
        portalLines.style.display=this.state.rules?.specials?.enabled===false?'none':'';
        gBack.appendChild(portalLines);
      }
      const lanes=Object.fromEntries(Object.entries(geom.home).map(([col,cells])=>[
        col,{start:cells[0],end:cells[cells.length-1]}
      ]));
      for(const [idx,col] of Object.entries(entryIndexByColor)){
        const tile=geom.track[idx];
        if(!tile) continue;
        const {nx,ny}=normalFromAngle(tile.angle||0);
        const tip={x:tile.x+nx*(tileSize*0.28),y:tile.y+ny*(tileSize*0.28)};
        const baseCenter={x:tile.x-nx*(tileSize*0.34),y:tile.y-ny*(tileSize*0.34)};
        const perp={x:-ny,y:nx}; const baseHalf=tileSize*0.24;
        const p1={x:baseCenter.x+perp.x*baseHalf,y:baseCenter.y+perp.y*baseHalf};
        const p2={x:baseCenter.x-perp.x*baseHalf,y:baseCenter.y-perp.y*baseHalf};
        const laneHex=ensureColor(color(`--${col}`),'#38bdf8');
        gSpecials.appendChild(el('polygon',{points:`${tip.x},${tip.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`,fill:withAlpha(laneHex,0.82)}));
      }
      const flights=window.GameRules.BOARD.special.flightPaths.edges; const flightGroup=el('g',{});
      const bezierTangent=(t,p0,p1,p2)=>{ const mt=1-t; return{ x:2*mt*(p1.x-p0.x)+2*t*(p2.x-p1.x), y:2*mt*(p1.y-p0.y)+2*t*(p2.y-p1.y) }; };
      for(const [ck,edges] of Object.entries(flights)){
        const strokeColor=color(`--${ck}`);
        for(const e of edges){
          const p0=geom.track[e.from]; const p2=geom.track[e.to];
          const mid={x:(p0.x+p2.x)/2,y:(p0.y+p2.y)/2};
          const vec={x:p2.x-p0.x,y:p2.y-p0.y}; const segLen=Math.hypot(vec.x,vec.y)||1; const unit={x:vec.x/segLen,y:vec.y/segLen};
          let normal={x:-unit.y,y:unit.x};
          const midFromCenter={x:mid.x-cx,y:mid.y-cy};
          if(normal.x*midFromCenter.x+normal.y*midFromCenter.y<0){ normal={x:-normal.x,y:-normal.y}; }
          const k=0.12; const control={x:mid.x+normal.x*(segLen*k), y:mid.y+normal.y*(segLen*k)};
          const path=el('path',{d:`M ${p0.x} ${p0.y} Q ${control.x} ${control.y} ${p2.x} ${p2.y}`,stroke:strokeColor,'stroke-width':2.4,fill:'none',opacity:.38,'stroke-linecap':'round'});
          flightGroup.appendChild(path);
          // Remove the arrowhead to keep the map visuals cleaner while retaining the flight path curve
        }
      }
      flightGroup.setAttribute('class','flight-paths');
      flightGroup.setAttribute('pointer-events','none');
      flightGroup.style.display=this.state.rules?.dashedFlight?.enabled===false?'none':'';
      gBack.appendChild(flightGroup);
      const homeLen=window.GameRules.BOARD.homeLane.length; Object.entries(lanes).forEach(([col,lane])=>{
        if(!lane) return;
        const dir={x:lane.end.x-lane.start.x,y:lane.end.y-lane.start.y};
        const len=Math.hypot(dir.x,dir.y)||1;
        const ux=dir.x/len,uy=dir.y/len;
        const step=(homeLen>1)?len/(homeLen-1):len;
        const perp={x:-uy,y:ux};
        // The six home coordinates already exist in BoardGeometry.
        const laneHex=ensureColor(color(`--${col}`),'#38bdf8');
        for(let i=0;i<homeLen;i++){
          const dist=step*i;
          const x=lane.start.x+ux*dist; const y=lane.start.y+uy*dist;
          // Render the precomputed home coordinate without replacing it.
          const along=tileSize*0.5;
          const halfWidth=tileSize*0.46;
          const p1={x:x+perp.x*halfWidth+ux*along,y:y+perp.y*halfWidth+uy*along};
          const p2={x:x-perp.x*halfWidth+ux*along,y:y-perp.y*halfWidth+uy*along};
          const p3={x:x-perp.x*halfWidth-ux*along,y:y-perp.y*halfWidth-uy*along};
          const p4={x:x+perp.x*halfWidth-ux*along,y:y+perp.y*halfWidth-uy*along};
          const isGoal=i===homeLen-1;
          const fill=isGoal?withAlpha(laneHex,0.85):withAlpha(laneHex,0.24);
          const stroke=withAlpha(laneHex,isGoal?0.95:0.65);
          gTiles.appendChild(el('polygon',{'data-home-color':col,'data-home-index':i,points:`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`,'stroke-width':2,'stroke-linejoin':'round',stroke,fill}));
        }
      });
      const tileGridHex=ensureColor(color('--tile-grid'),'#1f2937');
      if(gGrid){
        gGrid.appendChild(el('rect',{x:cx-29,y:cy-29,width:58,height:58,rx:6,fill:'#0f172a',stroke:tileGridHex,'stroke-width':2}));
      }
      const accentHex=ensureColor(color('--accent'),'#38bdf8');
      gSpecials.appendChild(el('polygon',{points:starPoints(cx,cy,25,10),fill:withAlpha(accentHex,0.16),stroke:accentHex,'stroke-width':2.4}));
      const baseSize=geom.baseSize;
      const slotRadius=isCompact?18:22;
      const baseDefs=Object.fromEntries(Object.entries(geom.baseCenters).map(([col,pos])=>[
        col,{dx:pos.x-cx,dy:pos.y-cy}
      ]));
      geom.baseRadius=baseSize/2;
      const runwayTileSize=26;
      const gRunways=el('g',{class:'runway-layer','pointer-events':'none'});
      for(const [col,{dx,dy}] of Object.entries(baseDefs)){
        const group=el('g',{});
        const x=cx+dx,y=cy+dy,w=baseSize,h=baseSize;
        geom.baseCenters[col]={x,y};
        geom.runwayEntry[col]=startIdx[col];
        const baseHex=ensureColor(color(`--${col}`),'#38bdf8');
        group.appendChild(el('rect',{x:x-w/2,y:y-h/2,width:w,height:h,rx:isCompact?18:22,fill:withAlpha(baseHex,0.18),stroke:withAlpha(baseHex,0.6),'stroke-width':2}));
        const slots=geom.bases[col];
        slots.forEach(({x:sx,y:sy},i)=>{
          const label=i+1;
          group.appendChild(el('circle',{cx:sx,cy:sy,r:slotRadius,fill:'rgba(255,255,255,.10)',stroke:withAlpha(baseHex,0.65),'stroke-width':2}));
          group.appendChild(el('text',{x:sx,y:sy,'text-anchor':'middle','dominant-baseline':'central','font-size':12,'fill':withAlpha(baseHex,0.85),'font-weight':'600'},[document.createTextNode(String(label))]));
        });
        const startIndex=startIdx[col];
        const startTile=typeof startIndex==='number'?geom.track[startIndex]:null;
        const heading=startTile?Math.atan2(startTile.y-y,startTile.x-x):0;
        const runwayTiles=(geom.runway[col]||[]).map((pt,i)=>({...pt,heading,slotIndex:i}));
        runwayTiles.forEach(tile=>{
          const deg=tile.heading*180/Math.PI;
          const gTile=el('g',{transform:`translate(${tile.x},${tile.y}) rotate(${deg})`,'data-runway-col':col,'data-runway-slot':String(tile.slotIndex)});
          const rect=el('rect',{x:-runwayTileSize/2,y:-runwayTileSize/2,width:runwayTileSize,height:runwayTileSize,rx:4,ry:4,class:`runway-tile runway-${col}`,'pointer-events':'none',stroke:withAlpha(baseHex,0.55)});
          gTile.appendChild(rect);
          gRunways.appendChild(gTile);
        });
        const hudStatic=this._hudLayers?.static;
        if(hudStatic && runwayTiles.length>0){
          const tip=runwayTiles[runwayTiles.length-1];
          const heading=tip.heading;
          const labelDistance=hudTrackOutset+runwayTileSize;
          const lx=tip.x-Math.cos(heading)*labelDistance;
          const ly=tip.y-Math.sin(heading)*labelDistance;
          const textColor=withAlpha(baseHex,0.95);
          hudStatic.appendChild(el('text',{x:lx,y:ly,'text-anchor':'middle','font-size':11,'font-weight':'700','fill':textColor},[document.createTextNode(`${markerSymbol(col)} START`)]));
        }
        if(gGrid) gGrid.appendChild(group);
      }
      gSpecials.appendChild(gRunways);
      if(svg && this.$?.gHL) svg.appendChild(this.$.gHL);
      if(svg && this.$?.gPieces) svg.appendChild(this.$.gPieces);
      this.state.boardAudit=this.auditGeometry(geom);
      if(this.state.settings.debugBoard){
        const debug=el('g',{'class':'board-debug','pointer-events':'none','aria-hidden':'true'});
        geom.track.forEach((p,i)=>{
          debug.appendChild(el('circle',{cx:p.x,cy:p.y,r:2,fill:'#fff'}));
          debug.appendChild(el('text',{x:p.x,y:p.y-15,'text-anchor':'middle','font-size':10,fill:'var(--fg)',stroke:'var(--bg)','stroke-width':2,'paint-order':'stroke'},[document.createTextNode(String(i))]));
        });
        gHud.appendChild(debug);
      }
      this.clearGhostPath();
      this.observePiecesLayer();
    },
    auditGeometry(geom){
      return window.BoardGeometry.validate(geom,window.GameRules.BOARD);
    },
    clearGhostPath(){
      const layer=this._hudLayers?.dynamic;
      if(!layer) return;
      layer.querySelectorAll('.ghost-path').forEach(node=>node.remove());
    },
    buildTaxiPath(color,outboundTargetTrackIndex){
      const runway=(this.geom.runway&&this.geom.runway[color])||[];
      const path=[];
      if(Array.isArray(runway)&&runway.length>0){
        runway.forEach(tile=>{ path.push({x:tile.x,y:tile.y}); });
      }
      const finalCoord=(typeof outboundTargetTrackIndex==='number')?this.geom.track[outboundTargetTrackIndex]:outboundTargetTrackIndex;
      if(finalCoord){
        const last=path[path.length-1];
        if(!last || last.x!==finalCoord.x || last.y!==finalCoord.y){
          path.push({x:finalCoord.x,y:finalCoord.y});
        }
      }
      return path;
    },
    resolveMovePath(color,move,pieceIndex,piece=null){
      const coords=[];
      const rawPath=Array.isArray(move?.path)?move.path.slice():[];
      const fromPos=move?.from||piece?.pos||null;
      const toPos=move?.to||null;
      if(fromPos && (rawPath.length===0 || !window.GameRules.Pos.isEqual(rawPath[0],fromPos))){
        rawPath.unshift(fromPos);
      }
      if(toPos && (rawPath.length===0 || !window.GameRules.Pos.isEqual(rawPath[rawPath.length-1],toPos))){
        rawPath.push(toPos);
      }
      let skipNextTrack=false;
      for(let i=0;i<rawPath.length;i++){
        const pos=rawPath[i];
        if(skipNextTrack && pos.kind==='track'){ skipNextTrack=false; continue; }
        const xy=this.posToXY(color,pos,pieceIndex,piece);
        if(xy) coords.push({x:xy.x,y:xy.y});
        const next=rawPath[i+1];
        if(pos.kind==='base' && next && next.kind==='track'){
          const taxi=this.buildTaxiPath(color,next.idx);
          taxi.forEach(pt=>coords.push({x:pt.x,y:pt.y}));
          skipNextTrack=true;
        }
      }
      if(coords.length===0){
        const start=this.posToXY(color,fromPos||window.GameRules.Pos.base(pieceIndex||0),pieceIndex,piece);
        if(start) coords.push({x:start.x,y:start.y});
        const end=this.posToXY(color,toPos||fromPos,pieceIndex,piece);
        if(end){
          const last=coords[coords.length-1];
          if(!last || last.x!==end.x || last.y!==end.y){ coords.push({x:end.x,y:end.y}); }
        }
      }
      return coords;
    },
    previewMove(move,colorOverride=null){
      const layer=this._hudLayers?.dynamic;
      if(!layer) return;
      this.clearGhostPath();
      if(!move) return;
      const playerColor=colorOverride||this.currentPlayer()?.color;
      if(!playerColor) return;
      const coords=this.resolveMovePath(playerColor,move,move.pieceIndex);
      const points=coords.map(pt=>`${pt.x} ${pt.y}`);
      if(points.length<2) return;
      const poly=document.createElementNS(SVG_NS,'polyline');
      poly.setAttribute('points',points.join(' '));
      poly.setAttribute('fill','none');
      poly.setAttribute('stroke','rgba(255,255,255,.35)');
      poly.setAttribute('stroke-width','3');
      poly.setAttribute('stroke-linecap','round');
      poly.setAttribute('stroke-linejoin','round');
      poly.classList.add('ghost-path');
      layer.appendChild(poly);
      this.ensurePiecesOnTop();
    },
    clonePosition(pos){
      if(!pos || typeof pos!=='object') return null;
      if(pos.kind==='track') return window.GameRules.Pos.track(pos.idx);
      if(pos.kind==='home') return window.GameRules.Pos.home(pos.idx);
      if(pos.kind==='base'){
        const slot=typeof pos.slot==='number'?pos.slot:0;
        return window.GameRules.Pos.base(slot);
      }
      if(pos.kind==='finished') return window.GameRules.Pos.finished();
      try{
        return window.structuredClone? structuredClone(pos):JSON.parse(JSON.stringify(pos));
      }catch(err){
        if(typeof pos.idx==='number') return {kind:pos.kind,idx:pos.idx};
        if(typeof pos.slot==='number') return {kind:pos.kind,slot:pos.slot};
        return {kind:pos.kind};
      }
    },
    clonePath(path){
      if(!Array.isArray(path)) return [];
      return path.map(p=>this.clonePosition(p)).filter(Boolean);
    },
    highlightMovables(){
      const g=this.$.gHL; g.innerHTML='';
      const host=this.$.movables; host.innerHTML='';
      const player=this.currentPlayer(); if(!player) return;

      const mousePermitted=this.isInteractionPermitted('mouse');
      const keyboardPermitted=this.isInteractionPermitted('keyboard');
      if(mousePermitted){ host.removeAttribute('data-selection-disabled'); }
      else { host.setAttribute('data-selection-disabled','true'); }

      const selectionNotice=(()=>{
        if(mousePermitted) return '';
        if(this.isInputLocked()) return '提示顯示中，請稍候…';
        if(this.state.disabledColors && this.state.disabledColors[player.id]){
          return `${this.formatPlayerName(player,{includeDifficulty:true})} 已完成行動`;
        }
        if(this.isAI(player)){
          return `${this.formatPlayerName(player,{includeDifficulty:true})} 由 AI 操作中`;
        }
        if(!keyboardPermitted) return '目前無法選擇棋子';
        const mode=this.state.settings?.keyboardMode||'shared';
        const playerIndex=this.state.players.findIndex(p=>p.id===player.id);
        if(mode==='dual'){
          if(playerIndex===0) return '此回合需使用鍵盤（P1：用 1–4 選棋）';
          if(playerIndex===1) return '此回合需使用鍵盤（P2：用 7–0 選棋）';
          return '此回合需使用鍵盤選擇棋子';
        }
        if(mode==='custom') return '此回合需依自訂鍵位選擇棋子';
        return '此回合需使用鍵盤選擇棋子（用 1–4 選棋）';
      })();
      if(selectionNotice){
        const notice=document.createElement('p');
        notice.className='selection-notice muted';
        notice.textContent=selectionNotice;
        host.appendChild(notice);
      }

      const moves=this.state.legalMoves||[];
      const preserveLastPath = (!this.state.bonusSelecting && this.state.dice==null && (!moves || moves.length===0) && Array.isArray(this.state.lastMoveSummary?.path) && this.state.lastMoveSummary.path.length>0);
      if(preserveLastPath) this.previewLastMove(); else this.clearGhostPath();
      const defaultMove=moves[0]||null;
      const byPiece=new Map();
      moves.forEach(m=>{
        if(!byPiece.has(m.pieceIndex)) byPiece.set(m.pieceIndex,[]);
        byPiece.get(m.pieceIndex).push(m);
      });

      const isMouseLikeEvent=(evt)=>{
        if(!evt) return true;
        if(typeof evt.detail!=='number') return true;
        return evt.detail!==0;
      };

      const pcs=this.state.pieces[player.id]||[];
      pcs.forEach((pc,idx)=>{
        const where=this.posToXY(player.color,pc.pos,idx,pc);
        if(!where) return;
        const hasMove=byPiece.has(idx);
        const ring=document.createElementNS('http://www.w3.org/2000/svg','circle');
        ring.setAttribute('cx',where.x);
        ring.setAttribute('cy',where.y);
        ring.setAttribute('r',hasMove?28:22);
        ring.setAttribute('fill',hasMove?'rgba(34,211,238,0.12)':'rgba(255,255,255,0.03)');
        ring.setAttribute('stroke',hasMove?'var(--accent)':'transparent');
        ring.setAttribute('stroke-width',hasMove?'2':'0');
        if(hasMove){
          ring.style.cursor=mousePermitted?'pointer':'default';
          ring.addEventListener('click',(evt)=>{
            const usingMouse=isMouseLikeEvent(evt);
            if(usingMouse && !mousePermitted){
              evt.preventDefault();
              this.handleBlockedInteraction('mouse');
              return;
            }
            const source=usingMouse?'mouse':'keyboard';
            const options=byPiece.get(idx)||[];
            if(options.length===1){
              this.applyMove(options[0],source);
            }else if(options.length>1){
              const firstBtn=host.querySelector(`button[data-piece="${idx}"]`);
              if(firstBtn){
                firstBtn.focus();
                if(firstBtn.scrollIntoView){
                  firstBtn.scrollIntoView({block:'nearest'});
                }
              }
            }
          });
        }
        g.appendChild(ring);

        const txt=document.createElementNS('http://www.w3.org/2000/svg','text');
        txt.setAttribute('x',where.x);
        txt.setAttribute('y',where.y+4);
        txt.setAttribute('text-anchor','middle');
        txt.setAttribute('font-size','14');
        txt.setAttribute('fill','#e5e7eb');
        txt.textContent=String(idx+1);
        g.appendChild(txt);

        if(hasMove){
          const movesForPiece=byPiece.get(idx);
          const previewDefault=()=>{
            const first=movesForPiece?.[0];
            if(first) this.previewMove(first,player.color);
          };
          ring.addEventListener('pointerenter',previewDefault);
          ring.addEventListener('pointerleave',()=>{
            const fallback=movesForPiece?.[0]||defaultMove;
            if(fallback) this.previewMove(fallback,player.color); else this.clearGhostPath();
          });
          movesForPiece.forEach((mv,optIdx)=>{
            const btn=document.createElement('button');
            btn.type='button';
            btn.className='btn';
            btn.dataset.piece=String(idx);
            btn.dataset.option=String(optIdx);
            const prefix=movesForPiece.length>1?`${idx+1} 號棋（選項 ${optIdx+1}）`:`${idx+1} 號棋`;
            btn.textContent=`${prefix}：${this.describeMove(mv)}`;
            btn.addEventListener('click',(evt)=>{
              const usingMouse=isMouseLikeEvent(evt);
              if(usingMouse && !mousePermitted){
                evt.preventDefault();
                this.handleBlockedInteraction('mouse');
                return;
              }
              const source=usingMouse?'mouse':'keyboard';
              this.applyMove(mv,source);
            });
            btn.addEventListener('pointerenter',()=>this.previewMove(mv,player.color));
            btn.addEventListener('pointerleave',()=>{
              const fallback=movesForPiece?.[0]||defaultMove;
              if(fallback) this.previewMove(fallback,player.color); else this.clearGhostPath();
            });
            btn.addEventListener('focus',()=>this.previewMove(mv,player.color));
            btn.addEventListener('blur',()=>{
              const fallback=movesForPiece?.[0]||defaultMove;
              if(fallback) this.previewMove(fallback,player.color); else this.clearGhostPath();
            });
            host.appendChild(btn);
          });
        }
      });

      const hasButtons=host.querySelector('button')!=null;
      if(!hasButtons){
        const span=document.createElement('span');
        span.className='muted';
        span.textContent='沒有可移動棋子';
        host.appendChild(span);
        if(preserveLastPath) this.previewLastMove(); else this.clearGhostPath();
      }else if(moves.length>0){
        host.scrollTop=0;
        if(this.currentControlModeForTurn()==='keyboard' && !host.contains(document.activeElement)){
          const firstButton=host.querySelector('button');
          if(firstButton && typeof firstButton.focus==='function'){
            try{ firstButton.focus({preventScroll:true}); }
            catch(err){ firstButton.focus(); }
          }
        }
        this.previewMove(moves[0],player.color);
      }
      this.ensurePiecesOnTop();
    },
    describeMove(move){
      const parts=[];
      if(move.kind==='takeoff') parts.push('起飛');
      else if(typeof move.dice==='number') parts.push(`前進 ${move.dice}`);
      if(Array.isArray(move.stack) && move.stack.length>1) parts.push(`疊子×${move.stack.length}`);
      if(move.events){
        if(move.events.some(ev=>ev.type==='enter-home')) parts.push('入家路');
        if(move.events.some(ev=>ev.type==='bounce-back')) parts.push('折返');
        if(move.events.some(ev=>ev.type==='jump')) parts.push('跳格');
        if(move.events.some(ev=>ev.type==='flight')) parts.push('飛行');
        if(move.events.some(ev=>ev.type==='finish')) parts.push('終點');
        if(move.events.some(ev=>ev.type==='portal')) parts.push('傳送');
        if(move.events.some(ev=>ev.type==='power-up')) parts.push('增益');
        if(move.events.some(ev=>ev.type==='trap')) parts.push('陷阱');
      }
      const capturedCount=Array.isArray(move.capture?.captured)?move.capture.captured.length:0;
      if(capturedCount>0) parts.push('吃子');
      return parts.join(' → ')||'移動';
    },
    posToXY(color,pos,pieceIndex=null,piece=null){
      if(!pos || !this.geom?.home?.[color]) return null;
      if(pos.kind==='track') return this.geom.track[pos.idx];
      if(pos.kind==='home') return this.geom.home[color][pos.idx];
      if(pos.kind==='base'){
        const slots=this.geom.bases[color]||[];
        if(slots.length===0) return null;
        const slotFromPos=(typeof pos.slot==='number')?pos.slot:null;
        const idx=(slotFromPos!=null?slotFromPos:(pieceIndex!=null?pieceIndex:0));
        return slots[idx%slots.length];
      }
      if(pos.kind==='finished'){
        const slots=(this.geom.finishedSlots&&this.geom.finishedSlots[color])||[];
        if(slots.length===0) return null;
        const player=this.state.players.find(p=>p.color===color);
        const pid=player?.id;
        const assigned=pid!=null && this.state.finishedSlots?.[pid]? this.state.finishedSlots[pid][pieceIndex??0]:null;
        const pieceSlot=(piece && typeof piece.finishedSlot==='number')?piece.finishedSlot:null;
        const slotIdx=(typeof pos.slot==='number')?pos.slot:(typeof pos.index==='number')?pos.index:(pieceSlot!=null?pieceSlot:(assigned!=null?assigned:pieceIndex||0));
        const target=slots[(slotIdx||0)%slots.length]||slots[0];
        if(target) return {x:target.x,y:target.y};
      }
      return null;
    },
    redrawPieces(){
      this.ensurePiecesOnTop();
      const g=this.$.gPieces;
      if(!g) return;
      g.innerHTML='';
      g.onclick=(e)=>{
        if(this.state.animating) return;
        if(!this.isInteractionPermitted('mouse')){ this.handleBlockedInteraction('mouse'); return; }
        const target=e.target.closest('[data-player][data-index]');
        if(!target) return;
        const pid=target.dataset.player;
        const idx=parseInt(target.dataset.index,10);
        if(pid!==this.state.turn||Number.isNaN(idx)) return;
        if(this.state.disabledColors && this.state.disabledColors[pid]) return;
        const mv=(this.state.legalMoves||[]).find(m=>m.pieceIndex===idx);
        if(mv) this.applyMove(mv,'mouse');
      };
      const safeOffsets=new Map();
      const computeSafeOffsets=(count)=>{
        const preset={
          2:[{x:-7,y:0},{x:7,y:0}],
          3:[{x:0,y:-8},{x:-7,y:6},{x:7,y:6}],
          4:[{x:-7,y:-7},{x:7,y:-7},{x:-7,y:7},{x:7,y:7}]
        };
        if(preset[count]) return preset[count];
        const radius=8;
        return Array.from({length:count},(_,i)=>{
          const angle=-Math.PI/2 + (2*Math.PI*i/count);
          return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius};
        });
      };
      const board=window.GameRules?.BOARD;
      const markers=window.GameRules?.COLOR_MARKERS||{};
      const safeRules=this.state.rules?.safeTiles||{};
      const safeList=new Set(safeRules.list||[]);
      const includeStart=safeRules.start!==false;
      const startSet=new Set(Object.values(board?.track?.startIndex||{}).filter(idx=>typeof idx==='number'));
      const isSafeIdx=(idx)=>{
        if(typeof idx!=='number') return false;
        if(safeList.has(idx)) return true;
        return includeStart && startSet.has(idx);
      };
      const safeGroups=new Map();
      this.state.players.forEach(player=>{
        const pieces=this.state.pieces[player.id]||[];
        pieces.forEach((pc,idx)=>{
          if(pc?.pos?.kind==='track' && isSafeIdx(pc.pos.idx)){
            const key=pc.pos.idx;
            if(!safeGroups.has(key)) safeGroups.set(key,[]);
            safeGroups.get(key).push({playerId:player.id,color:player.color,pieceIndex:idx});
          }
        });
      });
      safeGroups.forEach((entries)=>{
        const distinctColors=new Set(entries.map(entry=>entry.color).filter(Boolean));
        if(distinctColors.size<=1) return;
        entries.sort((a,b)=>{
          if(a.color===b.color) return a.pieceIndex-b.pieceIndex;
          return String(a.color||'').localeCompare(String(b.color||''));
        });
        const offsets=computeSafeOffsets(entries.length);
        entries.forEach((entry,idx)=>{
          safeOffsets.set(`${entry.playerId}:${entry.pieceIndex}`,offsets[idx]||{x:0,y:0});
        });
      });
      const active=[];
      const finished=[];
      for(const p of this.state.players){
        const pcs=this.state.pieces[p.id]||[];
        pcs.forEach((pc,idx)=>{
          const xy=this.posToXY(p.color,pc.pos,idx,pc);
          if(!xy) return;
          const wrapper=document.createElementNS(SVG_NS,'g');
          wrapper.dataset.player=p.id;
          wrapper.dataset.index=String(idx);
          const offset=safeOffsets.get(`${p.id}:${idx}`);
          const tx=xy.x+(offset?.x||0);
          const ty=xy.y+(offset?.y||0);
          wrapper.setAttribute('transform',`translate(${tx},${ty})`);
          wrapper.style.cursor='pointer';
          const hit=document.createElementNS(SVG_NS,'circle');
          hit.setAttribute('r',23); hit.setAttribute('fill','transparent');
          hit.setAttribute('data-player',p.id);hit.setAttribute('data-index',String(idx));
          wrapper.appendChild(hit);
          if(this.state.disabledColors && this.state.disabledColors[p.id]){
            wrapper.setAttribute('data-disabled','true');
            wrapper.setAttribute('aria-disabled','true');
          }
          const token=document.createElementNS(SVG_NS,'use');
          token.setAttributeNS('http://www.w3.org/1999/xlink','href','#plane-shape');
          token.setAttribute('href','#plane-shape');
          token.setAttribute('class',`plane-token plane-${p.color}`);
          token.setAttribute('data-player',p.id);
          token.setAttribute('data-index',String(idx));
          token.setAttribute('role','img');
          token.setAttribute('aria-label',`${p.name||p.id} 的飛機 ${idx+1}`);
          token.setAttribute('pointer-events','auto');
          token.setAttribute('x',0);
          token.setAttribute('y',0);
          token.setAttribute('width',24);
          token.setAttribute('transform','scale(1.35)');
          token.setAttribute('height',24);
          wrapper.appendChild(token);
          const marker=markers[p.color];
          if(marker?.symbol){
            const glyph=document.createElementNS(SVG_NS,'text');
            glyph.setAttribute('x',12);
            glyph.setAttribute('y',-12);
            glyph.setAttribute('text-anchor','middle');
            glyph.setAttribute('dominant-baseline','middle');
            glyph.setAttribute('font-size','8.5');
            glyph.setAttribute('font-weight','700');
            glyph.setAttribute('class','plane-marker');
            glyph.setAttribute('pointer-events','none');
            glyph.setAttribute('aria-hidden','true');
            glyph.textContent=marker.symbol;
            wrapper.appendChild(glyph);
          }
          const label=document.createElementNS(SVG_NS,'text');
          label.setAttribute('x',12);
          label.setAttribute('y',13);
          label.setAttribute('text-anchor','middle');
          label.setAttribute('dominant-baseline','middle');
          label.setAttribute('font-size','11');
          label.setAttribute('class','plane-number');
          label.setAttribute('aria-hidden','true');
          label.textContent=String(idx+1);
          label.dataset.player=p.id;
          label.dataset.index=String(idx);
          label.setAttribute('pointer-events','none');
          wrapper.appendChild(label);
          if(pc.pos?.kind==='finished'){
            wrapper.setAttribute('data-finished','true');
            const badge=document.createElementNS(SVG_NS,'use');
            badge.setAttributeNS('http://www.w3.org/1999/xlink','href','#finish-badge');
            badge.setAttribute('href','#finish-badge');
            badge.setAttribute('class','finish-badge');
            badge.setAttribute('transform','translate(16,-16) scale(0.92)');
            badge.setAttribute('pointer-events','none');
            wrapper.appendChild(badge);
            finished.push(wrapper);
          }else{
            active.push(wrapper);
          }
        });
      }
      active.forEach(node=>g.appendChild(node));
      finished.forEach(node=>g.appendChild(node));
    },

    applyMove(move,source='system'){
      if(!move || this.state.view!=='game' || this.state.animating || !(this.state.legalMoves||[]).includes(move)) return;
      const epoch=this._gameEpoch||0;
      if(!this.isInteractionPermitted(source)){ this.handleBlockedInteraction(source); return; }
      const wasBonusMove=this.state.bonusSelecting===true;
      const carriedExtraTurn=this.state.pendingExtraTurn===true;
      this.pushHistory();
      const pid=this.state.turn;
      const player=this.currentPlayer();
      const playerLabel=this.formatPlayerName(player,{includeDifficulty:true});
      const playerColor=player?.color||null;
      let movingIndices=Array.isArray(move.stack)?move.stack.slice():[move.pieceIndex];
      if(!movingIndices.includes(move.pieceIndex)) movingIndices.push(move.pieceIndex);
      movingIndices=Array.from(new Set(movingIndices)).sort((a,b)=>a-b);
      const movingPieces=movingIndices.map(idx=>({idx,piece:this.state.pieces[pid]?.[idx]})).filter(entry=>entry.piece);
      const leadEntry=movingPieces.find(entry=>entry.idx===move.pieceIndex) || movingPieces[0];
      if(!leadEntry){ this.state.animating=false; return; }
      // The choice is complete. Animation time must not consume the player's
      // countdown or advance to another player before this move commits.
      this.clearTurnTimer();
      const piece=leadEntry.piece;
      const fromXY=this.posToXY(player.color,piece.pos,leadEntry.idx,piece);
      const toXY=this.posToXY(player.color,move.to,leadEntry.idx,piece)||fromXY;
      this.state.animating=true;
      const animCoords=this.resolveMovePath(player.color,move,leadEntry.idx,piece);
      if(Array.isArray(animCoords) && animCoords.length>0){
        const firstPoint=animCoords[0];
        if(!firstPoint || firstPoint.x!==fromXY.x || firstPoint.y!==fromXY.y){
          animCoords.unshift({x:fromXY.x,y:fromXY.y});
        }
        const lastPoint=animCoords[animCoords.length-1];
        if(!lastPoint || lastPoint.x!==toXY.x || lastPoint.y!==toXY.y){
          animCoords.push({x:toXY.x,y:toXY.y});
        }
      }
      return this.animatePiece(player,fromXY,toXY,520,animCoords).then(async()=>{
        if(epoch!==(this._gameEpoch||0) || this.state.view!=='game') return;
        const capturedInfos=[];
        if(move.capture && move.capture.captured && move.capture.captured.length>0 && move.to.kind==='track'){
          for(const opp of this.state.players){
            if(opp.id===pid) continue;
            const oppPieces=this.state.pieces[opp.id]||[];
            oppPieces.forEach((pc,idx)=>{
              if(pc.pos.kind==='track' && pc.pos.idx===move.to.idx){
                capturedInfos.push({opp,pieceIndex:idx});
              }
            });
          }
        }

        for(const info of capturedInfos){
          const from=this.geom.track[move.to.idx];
          const capturedPiece=this.state.pieces[info.opp.id]?.[info.pieceIndex];
          const slotIndex=typeof capturedPiece?.baseSlot==='number'?capturedPiece.baseSlot:info.pieceIndex;
          const targetBase=this.posToXY(info.opp.color, window.GameRules.Pos.base(slotIndex), slotIndex,capturedPiece);
          if(targetBase){
            await this.animatePiece({color:info.opp.color}, from, targetBase, 420);
            if(epoch!==(this._gameEpoch||0) || this.state.view!=='game') return;
          }
        }

        const toPosition=(target,slot)=>{
          if(!target) return null;
          if(target.kind==='track') return window.GameRules.Pos.track(target.idx);
          if(target.kind==='home') return window.GameRules.Pos.home(target.idx);
          if(target.kind==='finished') return window.GameRules.Pos.finished();
          if(target.kind==='base') return window.GameRules.Pos.base(slot);
          try{ return window.structuredClone? window.structuredClone(target):JSON.parse(JSON.stringify(target)); }catch(e){ return target; }
        };

        if(!this.state.finishedSlots) this.state.finishedSlots={};
        if(!this.state.finishedSlots[pid]) this.state.finishedSlots[pid]={};
        const finishedMap=this.state.finishedSlots[pid];
        movingPieces.forEach(({idx,piece:pc})=>{
          const slotIndex=typeof pc.baseSlot==='number'?pc.baseSlot:idx;
          pc.baseSlot=slotIndex;
          if(move.to.kind==='base'){
            pc.pos=window.GameRules.Pos.base(slotIndex);
            if(finishedMap) delete finishedMap[idx];
            delete pc.finishedSlot;
          }else{
            pc.pos=toPosition(move.to,slotIndex);
            if(pc.pos?.kind==='finished'){
              if(typeof finishedMap[idx]!=='number'){
                const used=new Set(Object.values(finishedMap));
                let nextSlot=0;
                while(used.has(nextSlot) && nextSlot<4){ nextSlot+=1; }
                finishedMap[idx]=nextSlot;
              }
              pc.finishedSlot=finishedMap[idx];
            }else{
              if(finishedMap) delete finishedMap[idx];
              delete pc.finishedSlot;
            }
          }
        });

        if(capturedInfos.length>0){
          for(const info of capturedInfos){
            const capturedPiece=this.state.pieces[info.opp.id]?.[info.pieceIndex];
            if(!capturedPiece) continue;
            const slot=typeof capturedPiece.baseSlot==='number'?capturedPiece.baseSlot:info.pieceIndex;
            capturedPiece.baseSlot=slot;
            capturedPiece.pos=window.GameRules.Pos.base(slot);
            if(this.state.finishedSlots?.[info.opp.id]) delete this.state.finishedSlots[info.opp.id][info.pieceIndex];
            delete capturedPiece.finishedSlot;
          }
          this.log(`${playerLabel} 吃子！把對手送回基地`,{color:playerColor});
        }

        if(movingPieces.length>1){
          this.log(`${playerLabel} 疊子合體移動（${movingPieces.length} 枚）`,{color:playerColor});
        }

        const effectsOutcome=this.applySpecialEffects({player,move,leadIndex:leadEntry.idx});
        const extraTurnFromEvent=!!effectsOutcome.extraTurn;
        let pendingBonusRequest=effectsOutcome.pendingBonus;

        this.state.finishOrder=this.state.finishOrder||[];
        this.state.disabledColors=this.state.disabledColors||{};
        const perPlayerPieces=(window.GameRules?.BOARD?.bases?.perPlayer)||4;
        const finishedCount=(this.state.pieces?.[pid]||[]).reduce((count,pc)=>{
          return count + ((pc?.pos?.kind==='finished')?1:0);
        },0);
        if(finishedCount>=perPlayerPieces && !this.state.finishOrder.includes(pid)){
          this.state.finishOrder.push(pid);
          const isFirstFinisher=!this.state.winner;
          if(isFirstFinisher) this.state.winner=pid;
          this.state.disabledColors[pid]=true;
          if(isFirstFinisher && typeof window!=='undefined' && typeof window.showWinnerEffect==='function'){
            try{ window.showWinnerEffect(pid); }catch(err){ console.warn('showWinnerEffect failed',err); }
          }
          if(isFirstFinisher && typeof window!=='undefined' && typeof window.showWinnerModal==='function'){
            try{ window.showWinnerModal(pid,{finishOrder:this.state.finishOrder}); }catch(err){ /* noop */ }
          }
          const emitter=(typeof window!=='undefined' && typeof window.emit==='function')?window.emit:null;
          if(emitter) emitter('playerFinished',{playerId:pid,finishOrder:this.state.finishOrder});
        }

        this.redrawPieces();
        this.$.gHL.innerHTML='';
        this.pulseAt(toXY.x,toXY.y,`var(--${player.color})`);
        if(move.to.kind==='track'){
          const faces=this.computeThreatFaces(move.to.idx);
          this.showThreatBadge(toXY.x,toXY.y,faces);
        }else{
          this.showThreatBadge(toXY.x,toXY.y,[]);
        }

        this.state.animating=false;

        const colorName=this.currentPlayer()?.color||player.color;
        const baseSummaryPath=this.clonePath(move.path||[]);
        const fromPos=this.clonePosition(move.from);
        const toPos=this.clonePosition(move.to);
        if(fromPos && (baseSummaryPath.length===0 || !window.GameRules.Pos.isEqual(baseSummaryPath[0],fromPos))){
          baseSummaryPath.unshift(fromPos);
        }
        if(toPos && baseSummaryPath.length===0){
          baseSummaryPath.push(toPos);
        }
        if(toPos && baseSummaryPath.length>0 && !window.GameRules.Pos.isEqual(baseSummaryPath[baseSummaryPath.length-1],toPos)){
          baseSummaryPath.push(toPos);
        }
        const summaryCaptured=Array.isArray(move.capture?.captured)?move.capture.captured.map(info=>Object.assign({},info)) : [];
        this.state.lastMoveSummary={
          player:{id:player.id,name:player.name,color:colorName},
          dice:move.dice,
          description:this.describeMove(move),
          captured:summaryCaptured,
          path:baseSummaryPath,
          pieceIndex:move.pieceIndex,
          stackSize:Array.isArray(move.stack)?move.stack.length:1,
          kind:move.kind
        };
        this.renderLastMove();

        const rolledValue=move.dice;
        const playerFinished=this.state.finishOrder?.includes(pid) || !!this.state.disabledColors?.[pid];
        const extraTurnEarned=!playerFinished && (((rolledValue===6)&&this.state.rules?.extraTurnOnSix) || extraTurnFromEvent);

        if(pendingBonusRequest){
          this.state.pendingExtraTurn=carriedExtraTurn || extraTurnEarned;
          this.state.pendingBonus=pendingBonusRequest;
          this.state.bonusSelecting=true;
          this.state.dice=pendingBonusRequest.dice;
          this.$.diceOut.textContent=String(pendingBonusRequest.dice);
          this.state.legalMoves=[];
          this.refreshLegalMoves();
          if((this.state.legalMoves||[]).length===0){
            this.log('增益移動未能觸發');
            this.state.bonusSelecting=false;
            this.state.pendingBonus=null;
            this.state.dice=null;
            this.$.diceOut.textContent='–';
          }else{
            this.renderHints();
            this.updateTurnUI();
            this.updateTurnPrompt(true);
            this.saveGame();
            const needsChoice=(pendingBonusRequest.autoResolve===false) || (this.state.legalMoves.length>1);
            if(needsChoice){
              this.beginTurnTimer();
              this.maybeAutoPlayIfAI();
            }
            if(pendingBonusRequest.autoResolve!==false && this.state.legalMoves.length===1){
              const autoMove=this.state.legalMoves[0];
              this.runSoon(()=>this.applyMove(autoMove,'system'));
            }
            return;
          }
        }

        if(wasBonusMove){
          this.state.bonusSelecting=false;
        }
        this.state.pendingBonus=null;
        this.state.dice=null;
        this.$.diceOut.textContent='–';
        this.state.legalMoves=[];
        this.previewLastMove();
        const shouldGrantExtraTurn=wasBonusMove ? (carriedExtraTurn || extraTurnEarned) : extraTurnEarned;
        this.state.pendingExtraTurn=false;
        this.renderHints();
        if(!shouldGrantExtraTurn){
          this.advanceTurn();
        }else{
          this.state.legalMoves=[];
          this.clearTurnTimer();
          this.beginTurnTimer();
          this.saveGame();
          this.updateTurnUI();
          this.updateTurnPrompt(true);
          this.maybeAutoPlayIfAI();
        }
      });
    },
    applySpecialEffects({player,move,leadIndex}){
      const outcome={extraTurn:false,pendingBonus:null};
      const events=Array.isArray(move?.events)?move.events:[];
      const playerLabel=this.formatPlayerName(player,{includeDifficulty:true});
      const playerColor=player?.color||null;
      events.forEach(ev=>{
        if(ev.type==='enter-home') this.log(`${playerLabel} 進入家路`,{color:playerColor});
        else if(ev.type==='jump') this.log(`${playerLabel} 觸發跳格 (+${this.state.rules?.ownColorJump?.steps||0})`,{color:playerColor});
        else if(ev.type==='flight') this.log(`${playerLabel} 走飛線`,{color:playerColor});
        else if(ev.type==='finish') this.log(`${playerLabel} 抵達終點！`,{color:playerColor});
        else if(ev.type==='bounce-back'){
          const steps=Math.max(1,ev.steps||0);
          this.log(`${playerLabel} 在終點折返 ${steps} 步`,{color:playerColor});
        }
        else if(ev.type==='portal'){
          const label=ev.label?` ${ev.label}`:'';
          this.log(`${playerLabel} 穿越傳送門${label}`,{color:playerColor});
          this.showToast(`🌀 傳送門${label||''}！`,1200);
        }
        else if(ev.type==='power-up'){
          if(ev.effect==='extra-roll'){
            this.log(`${playerLabel} 拿到增擲機會！`,{color:playerColor});
            this.showToast('🎲 加擲機會！',1400);
          }else if(ev.effect==='advance-2'){
            this.log(`${playerLabel} 動力提升，準備再飛 2 格`,{color:playerColor});
          }else if(ev.effect==='command-other'){
            this.log(`${playerLabel} 獲得指揮權，可讓另一架棋子前進 1 格`,{color:playerColor});
          }
        }
        else if(ev.type==='trap'){
          if(ev.effect==='skip-turn'){
            this.log(`${playerLabel} 遭遇亂流，下一回合將停飛`,{color:playerColor});
            this.showToast('⚠️ 亂流！下回合停飛',1600);
          }
        }
      });
      const effects=Array.isArray(move?.effects)?move.effects:[];
      effects.forEach(effect=>{
        if(effect.type==='power-up'){
          if(effect.effect==='extra-roll'){
            outcome.extraTurn=true;
          }else if(effect.effect==='advance-2'){
            if(!outcome.pendingBonus){ outcome.pendingBonus={dice:2,restrict:'same',pieceIndex:leadIndex??move.pieceIndex,description:'向前再飛 2 格',source:'power-up',autoResolve:true}; }
          }else if(effect.effect==='command-other'){
            outcome.pendingBonus={dice:1,restrict:'others',pieceIndex:leadIndex??move.pieceIndex,description:'指揮另一架飛機前進 1 格',source:'power-up',autoResolve:false};
          }
        }else if(effect.type==='trap' && effect.effect==='skip-turn'){
          if(!this.state.skipTurns) this.state.skipTurns={};
          const currentSkip=Math.max(0,this.state.skipTurns[player.id]||0);
          this.state.skipTurns[player.id]=currentSkip+1;
          if(!this.state.turbulenceRecoveries) this.state.turbulenceRecoveries={};
          this.state.turbulenceRecoveries[player.id]=0; // legacy field; trap only skips a scheduled turn
        }
      });
      return outcome;
    },
    advanceTurn(){
      const playersList=this.state.players||[];
      if(!Array.isArray(playersList) || playersList.length===0) return null;
      if(this._noMoveTimer){ clearTimeout(this._noMoveTimer); this._noMoveTimer=null; }
      // A timed-out bonus belongs only to the departing turn. Leaving it set
      // would prevent the next player from rolling at all.
      this.state.bonusSelecting=false;
      this.state.pendingBonus=null;
      this.state.pendingExtraTurn=false;
      const prevId=this.state.turn;
      if(prevId!=null && this.state.consecutiveSixes){ this.state.consecutiveSixes[prevId]=0; }
      const total=playersList.length;
      this.state.finishOrder=this.state.finishOrder||[];
      this.state.disabledColors=this.state.disabledColors||{};
      this.state.skipTurns=this.state.skipTurns||{};
      const isFinished=player=>this.state.finishOrder.includes(player.id) || !!this.state.disabledColors[player.id];
      const activePlayers=playersList.filter(player=>player && !isFinished(player));
      // When every remaining player is suspended, all of these complete
      // rotations contain only skips. Consume them in one bounded operation,
      // then visit players once in the normal order. This is equivalent to
      // repeated rotations even for large imported, valid skip counters.
      const skippedRounds=activePlayers.length ? Math.min(...activePlayers.map(player=>Math.max(0,this.state.skipTurns[player.id]||0))) : 0;
      if(skippedRounds>0){
        for(const player of playersList){
          if(!player) continue;
          const consumed=Math.min(skippedRounds,Math.max(0,this.state.skipTurns[player.id]||0));
          if(!consumed) continue;
          this.state.skipTurns[player.id]-=consumed;
          const label=this.formatPlayerName(player,{includeDifficulty:true});
          this.log(`${label} 被亂流困住，跳過 ${consumed} 回合`,{color:player.color||null});
        }
      }
      const currentIdx=playersList.findIndex(p=>p.id===prevId);
      let idx=(currentIdx<0?0:(currentIdx+1)%total);
      let attempts=0;
      let target=null;
      while(attempts<total){
        const candidate=playersList[idx];
        attempts++;
        idx=(idx+1)%total;
        if(!candidate){ continue; }
        const candidateId=candidate.id;
        const skipCount=Math.max(0,this.state.skipTurns?.[candidateId]||0);
        if(skipCount>0){
          this.state.skipTurns[candidateId]=skipCount-1;
          const candidateLabel=this.formatPlayerName(candidate,{includeDifficulty:true});
          this.log(`${candidateLabel} 被亂流困住，跳過此回合`,{color:candidate?.color||null});
          this.showToast(`${candidate.name} 暫停一回合`,1200);
          continue;
        }
        if(isFinished(candidate)){ continue; }
        target=candidate;
        break;
      }
      if(!target){
        this.state.turn=null;
        this.state.dice=null;
        this.state.legalMoves=[];
        this.$.diceOut.textContent='–';
        this.renderLastMove();
        this.previewLastMove();
        this.clearTurnTimer();
        this.updateTurnUI();
        this.saveGame();
        this.updateTurnPrompt(true);
        return null;
      }
      if(this.state.consecutiveSixes){ this.state.consecutiveSixes[target.id]=0; }
      this.state.turn=target.id;
      this.state.dice=null;
      this.state.legalMoves=[];
      this.$.diceOut.textContent='–';
      this.renderLastMove();
      this.previewLastMove();
      this.clearTurnTimer();
      this.updateTurnUI();
      this.saveGame();
      this.updateTurnPrompt(true);
      this.maybeAutoPlayIfAI();
      return target;
    },
    onKey(e){
      if(this.state.view!=='game' || this.state.animating || e.repeat) return;
      if(e.target?.closest?.('input,select,textarea,[contenteditable="true"],dialog') || document.querySelector('dialog[open]')) return;
      if(e.key==='u'||e.key==='U'){ this.undo(); return; }
      const isSpace = (e.code==='Space' || e.key===' ' || e.key==='Spacebar');
      if(isSpace){
        e.preventDefault();
        if(!this.isInteractionPermitted('keyboard')){ this.handleBlockedInteraction('keyboard'); return; }
        const legalMoves=Array.isArray(this.state.legalMoves)?this.state.legalMoves:[];
        const hasSingleLegalMove=(legalMoves.length===1);
        const hasDice=this.state.dice!=null;
        const bonusActive=!!(this.state.pendingBonus||this.state.bonusSelecting);
        if(hasSingleLegalMove && (hasDice || bonusActive)){
          this.applyMove(legalMoves[0],'keyboard');
        }else{
          this.rollDice('keyboard');
        }
        return;
      }
      if(!this.isInteractionPermitted('keyboard')){ this.handleBlockedInteraction('keyboard'); return; }
      const mode=this.state.settings.keyboardMode||'shared';
      const pIdx=this.state.players.findIndex(p=>p.id===this.state.turn);
      const pieces=this.state.pieces[this.state.turn]||[];
      const pieceCount=pieces.length;
      let selIndex=null;
      const keyPool=(()=>{
        if(mode==='dual'){
          if(pIdx===0) return ['1','2','3','4'];
          if(pIdx===1) return ['7','8','9','0'];
          return ['1','2','3','4','5','6','7','8','9'];
        }
        return ['1','2','3','4','5','6','7','8','9'];
      })();
      const idx=keyPool.indexOf(e.key);
      if(idx>-1 && idx<pieceCount) selIndex=idx;
      if(selIndex!=null){
        const movesForPiece=(this.state.legalMoves||[]).filter(m=>m.pieceIndex===selIndex);
        if(movesForPiece.length===1){
          this.applyMove(movesForPiece[0],'keyboard');
        }else if(movesForPiece.length>1){
          e.preventDefault();
          const firstMove=movesForPiece[0];
          const host=this.$?.movables;
          if(host){
            const firstBtn=host.querySelector(`button[data-piece="${selIndex}"]`);
            if(firstBtn){
              firstBtn.focus();
              if(firstBtn.scrollIntoView){
                try{ firstBtn.scrollIntoView({block:'nearest'}); }catch(err){ firstBtn.scrollIntoView(); }
              }
            }
          }
          if(firstMove){
            const player=this.currentPlayer();
            this.previewMove(firstMove,player?.color||null);
          }
          this.showToast('此棋有多個選項，選擇後按 Enter/Space 確認',1600);
        }
      }
    },

    // --------- Persistence / Undo ---------
    snapshot(){
      return JSON.parse(JSON.stringify({
        players:this.state.players,
        pieces:this.state.pieces,
        turn:this.state.turn,
        rules:this.state.rules,
        dice:this.state.dice,
        consecutiveSixes:this.state.consecutiveSixes,
        skipTurns:this.state.skipTurns,
        turbulenceRecoveries:this.state.turbulenceRecoveries,
        bonusSelecting:this.state.bonusSelecting,
        pendingBonus:this.state.pendingBonus,
        pendingExtraTurn:this.state.pendingExtraTurn,
        settings:this.state.settings,
        lastMoveSummary:this.state.lastMoveSummary,
        finishOrder:this.state.finishOrder,
        winner:this.state.winner,
        disabledColors:this.state.disabledColors,
        finishedSlots:this.state.finishedSlots
      }));
    },
    saveGame(){
      if(this.state.view!=='game' || !Array.isArray(this.state.players) || this.state.players.length===0) return false;
      try{
        const payload=window.GameStorage.pack(this.snapshot(),window.GameRules);
        localStorage.setItem(SAVE_KEY,JSON.stringify(payload));
        this.setButtonDisabled(this.$?.btnContinue,false);
        this._storageWarning=false;
        if(this.$?.saveStatus){this.$.saveStatus.dataset.state='saved';this.$.saveStatus.textContent='已自動儲存在此瀏覽器';}
        return true;
      }catch(error){
        if(this.$?.saveStatus){this.$.saveStatus.dataset.state='error';this.$.saveStatus.textContent='未能自動儲存。請在設定匯出存檔，保留目前進度。';}
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
        const snapshot=this.state.view==='game'?this.snapshot():this._suspendedSnapshot;
        const payload=snapshot?window.GameStorage.pack(snapshot,window.GameRules):this.loadGame();
        if(!payload) throw new Error('尚未有可匯出的對局');
        const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob),link=document.createElement('a');
        link.href=url;link.download='skybound-save-'+new Date().toISOString().slice(0,10)+'.json';
        link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        return true;
      }catch(error){this.showToast('無法匯出：'+error.message,3000);return false;}
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
    clearSave(){
      try{ localStorage.removeItem(SAVE_KEY); this.setButtonDisabled(this.$?.btnContinue,true); }catch(e){}
      this.updateBoardOverlay();
    },
    continueFromSave(data=null){
      let payload;
      try{payload=data?window.GameStorage.parse(JSON.stringify(data),window.GameRules):this.loadGame();}
      catch(error){this.showToast('無效存檔：'+error.message,2500);return false;}
      if(!payload){ this.log('冇儲存對局',{tone:'warning'}); return; }
      this.cancelPendingActions();
      const snapshot=payload.state||payload;
      this.state.settings=Object.assign({keyboardMode:'shared',theme:'dark'}, snapshot.settings||{});
      this.applyTheme();
      $('#board-debug').checked=!!this.state.settings.debugBoard;
      if(this.$.kbMode) this.$.kbMode.value=this.state.settings.keyboardMode||'shared';
      this.state.players=snapshot.players||[];
      this.normalizePlayerControls();
      this.state.pieces=snapshot.pieces||{};
      this.state.turn=snapshot.turn||null;
      const loadedRules=snapshot.rules? this.cloneDefaultRules(snapshot.rules) : this.cloneDefaultRules();
      this.state.rules=loadedRules;
      this.applyBoardDefaultsToRules();
      this.populateRulesForm(this.state.rules);
      this.state.dice=snapshot.dice??null;
      this.state.consecutiveSixes=snapshot.consecutiveSixes||{};
      this.state.skipTurns=snapshot.skipTurns||{};
      this.state.players.forEach(p=>{ if(this.state.skipTurns[p.id]==null) this.state.skipTurns[p.id]=0; });
      this.state.turbulenceRecoveries={};
      this.state.players.forEach(p=>{ if(this.state.turbulenceRecoveries[p.id]==null) this.state.turbulenceRecoveries[p.id]=0; });
      this.state.bonusSelecting=!!snapshot.bonusSelecting;
      this.state.pendingBonus=snapshot.pendingBonus||null;
      this.state.pendingExtraTurn=!!snapshot.pendingExtraTurn;
      this.state.history=[];
      this.state.lastMoveSummary=snapshot.lastMoveSummary||null;
      this.state.finishOrder=Array.isArray(snapshot.finishOrder)?snapshot.finishOrder.slice():[];
      this.state.winner=snapshot.winner||null;
      this.state.disabledColors=Object.assign({},snapshot.disabledColors||{});
      this.state.finishedSlots=JSON.parse(JSON.stringify(snapshot.finishedSlots||{}));
      this.normalizePieces();
      this.updateControlAssignments();
      this.renderLastMove();
      this.toGame();
      this.bootstrapBoard();
      this.redrawPieces();
      this.clearTurnTimer();
      this.beginTurnTimer();
      if(this.state.bonusSelecting && this.state.dice!=null){
        this.refreshLegalMoves();
      }else{
        this.state.legalMoves=[];
        this.highlightMovables();
      }
      this.renderHints();
      this.updateTurnUI();
      this.updateTurnPrompt(true);
      if(this.state.dice!=null && !this.state.legalMoves.length) this.handleNoMoves(this.currentPlayer());
      this.log('已載入上局');
      const toastMsg=this._pendingToast||'已載入上局';
      if(toastMsg) this.showToast(toastMsg);
      this._pendingToast=null;
      this.setButtonDisabled(this.$?.btnContinue,false);
      this.updateSpecialsLegend();
      this.updateBoardOverlay();
      this.maybeAutoPlayIfAI();
    },
    pushHistory(){
      if(!this.state.rules?.undoEnabled) return;
      const snap=this.snapshot();
      if(!Array.isArray(this.state.history)) this.state.history=[];
      this.state.history.push(snap);
      if(this.state.history.length>20) this.state.history.shift();
    },
    undo(){
      if(!this.state.rules?.undoEnabled){ this.log('未啟用 Undo',{tone:'warning'}); return; }
      const snap=this.state.history?.pop?.();
      if(!snap){ this.log('無可 Undo 嘅步',{tone:'warning'}); return; }
      this.cancelPendingActions();
      this.state.bonusSelecting=!!snap.bonusSelecting;
      this.state.players=snap.players; this.state.pieces=snap.pieces; this.state.turn=snap.turn; this.state.rules=snap.rules;
      this.normalizePlayerControls();
      this.updateControlAssignments();
      this.state.dice=snap.dice??null; this.state.consecutiveSixes=snap.consecutiveSixes||{};
      this.state.skipTurns=snap.skipTurns||{};
      this.state.turbulenceRecoveries=snap.turbulenceRecoveries||{};
      this.state.pendingBonus=snap.pendingBonus||null;
      this.state.pendingExtraTurn=!!snap.pendingExtraTurn;
      this.state.finishOrder=Array.isArray(snap.finishOrder)?snap.finishOrder.slice():[];
      this.state.winner=snap.winner||null;
      this.state.disabledColors=Object.assign({},snap.disabledColors||{});
      this.state.finishedSlots=JSON.parse(JSON.stringify(snap.finishedSlots||{}));
      this.state.settings=Object.assign({keyboardMode:'shared',theme:'dark'}, snap.settings||{});
      this.applyTheme();
      if(this.$.kbMode) this.$.kbMode.value=this.state.settings.keyboardMode||'shared';
      this.state.lastMoveSummary=snap.lastMoveSummary||null;
      this.normalizePieces();
      this.state.players.forEach(p=>{
        if(this.state.turbulenceRecoveries[p.id]==null) this.state.turbulenceRecoveries[p.id]=0;
        if(this.state.skipTurns[p.id]==null) this.state.skipTurns[p.id]=0;
      });
      this.$.diceOut.textContent=this.state.dice==null?'–':String(this.state.dice);
      this.clearTurnTimer();
      this.beginTurnTimer();
      this.redrawPieces(); this.$.gHL.innerHTML='';
      this.renderLastMove();
      this.updateTurnUI();
      this.saveGame();
      this.log('已撤銷一步');
      this.updateSpecialsLegend();
      this.maybeAutoPlayIfAI();
    },

    // --------- AI ---------
    isAI(player){
      if(!player || typeof player!=='object') return false;
      return (player.type||'human')==='ai';
    },
    normalizeDifficulty(value){
      const raw=(value==null?'':String(value)).toLowerCase();
      if(raw==='easy'||raw==='normal'||raw==='hard') return raw;
      return 'normal';
    },
    difficultyLabel(value){
      const labels={easy:'簡單',normal:'普通',hard:'困難'};
      const key=this.normalizeDifficulty(value);
      return labels[key]||labels.normal;
    },
    formatPlayerName(player,{includeDifficulty=false}={}){
      if(!player) return '該玩家';
      let label=player.name||player.id||'該玩家';
      if(includeDifficulty && this.isAI(player)){
        label+=`（AI·${this.difficultyLabel(player.difficulty)}）`;
      }
      return label;
    },
    chooseAIMove(context={}){
      const player=context?.player||this.currentPlayer();
      const difficulty=this.normalizeDifficulty(context?.difficulty||player?.difficulty||'normal');
      if(!player) return null;
      const moves=this.state.legalMoves||[];
      if(moves.length===0) return null;
      const rules=this.state.rules||window.GameRules.DEFAULT_RULES;
      const BOARD=window.GameRules.BOARD;
      const trackLength=BOARD.track.length;
      const distToFinish=(color,pos)=>{
        if(!pos||typeof pos!=='object') return 0;
        const entry=BOARD.homeLane.entryIndex[color];
        const homeLen=BOARD.homeLane.length;
        if(pos.kind==='finished') return 0;
        if(pos.kind==='home') return Math.max(0,(homeLen-1-pos.idx));
        if(pos.kind==='track'){
          const dToEntry=((entry-pos.idx)%trackLength+trackLength)%trackLength;
          return dToEntry+homeLen;
        }
        if(pos.kind==='base'){
          const start=BOARD.track.startIndex[color];
          const startDist=distToFinish(color,window.GameRules.Pos.track(start));
          return startDist+1;
        }
        return 0;
      };
      const isSafeTile=(color,idx)=>{
        if(idx==null) return false;
        const start=BOARD.track.startIndex[color];
        if(rules.safeTiles?.start && Object.values(BOARD.track.startIndex).includes(idx)) return true;
        const safeList=new Set(rules.safeTiles?.list||[]);
        const extra=window.GameRules.BOARD?.special?.safeTiles?.extra||[];
        extra.forEach(v=>safeList.add(v));
        return safeList.has(idx);
      };
      const weightsProfile={
        easy:{
          opening:{W_out:6,W_safe:4,W_eat:7,W_risk:2,W_progress:3,W_cluster:1,W_endfit:2,W_tempo:1},
          midgame:{W_out:3,W_safe:5,W_eat:7,W_risk:3,W_progress:4,W_cluster:1,W_endfit:2,W_tempo:2},
          endgame:{W_out:0,W_safe:4,W_eat:6,W_risk:2,W_progress:6,W_cluster:0,W_endfit:5,W_tempo:2}
        },
        normal:{
          opening:{W_out:7,W_safe:5,W_eat:8,W_risk:3,W_progress:4,W_cluster:2,W_endfit:2,W_tempo:3},
          midgame:{W_out:2,W_safe:6,W_eat:9,W_risk:5,W_progress:5,W_cluster:2,W_endfit:3,W_tempo:4},
          endgame:{W_out:0,W_safe:4,W_eat:7,W_risk:3,W_progress:7,W_cluster:1,W_endfit:7,W_tempo:3}
        },
        hard:{
          opening:{W_out:6,W_safe:6,W_eat:10,W_risk:7,W_progress:5,W_cluster:2,W_endfit:3,W_tempo:6},
          midgame:{W_out:1,W_safe:7,W_eat:10,W_risk:8,W_progress:6,W_cluster:3,W_endfit:4,W_tempo:7},
          endgame:{W_out:0,W_safe:5,W_eat:8,W_risk:5,W_progress:9,W_cluster:1,W_endfit:9,W_tempo:6}
        }
      };
      const myPieces=this.state.pieces[player.id]||[];
      const clonePos=(pos)=>this.clonePosition(pos);
      const buildTrackCounts=(positions)=>{
        const counts=Array(trackLength).fill(0);
        positions.forEach(pos=>{ if(pos?.kind==='track'){ counts[pos.idx]=(counts[pos.idx]||0)+1; } });
        return counts;
      };
      const allTrackPieces=this.state.players.flatMap(p=>(this.state.pieces[p.id]||[]).map(pc=>({color:p.color,pos:pc.pos})));
      const threatDetailAt=(idx,{stackSize=1,color=player.color}={})=>{
        if(idx==null) return {prob:0,faces:new Set(),intensity:0};
        if(isSafeTile(color,idx)) return {prob:0,faces:new Set(),intensity:0};
        if(stackSize>=2 && rules.blockadePassThrough===false) return {prob:0,faces:new Set(),intensity:0,blockade:true};
        const faces=new Set();
        let intensity=0;
        allTrackPieces.forEach(entry=>{
          if(entry.color===color) return;
          const pos=entry.pos;
          if(!pos || pos.kind!=='track') return;
          const d=((idx-pos.idx)%trackLength+trackLength)%trackLength;
          if(d>=1 && d<=6){
            faces.add(d);
            intensity+=1;
          }
        });
        return {prob:faces.size/6,faces,intensity};
      };
      const computeExposureSum=(positions,counts,color=player.color)=>{
        const seen=new Set();
        let total=0;
        positions.forEach(pos=>{
          if(!pos || pos.kind!=='track') return;
          if(seen.has(pos.idx)) return;
          seen.add(pos.idx);
          const stackSize=counts[pos.idx]||0;
          const detail=threatDetailAt(pos.idx,{stackSize,color});
          total+=detail.prob;
        });
        return total;
      };
      const snapshotFor=(color,pieces)=>{
        const positions=pieces.map(pc=>clonePos(pc?.pos));
        const counts=buildTrackCounts(positions);
        let finished=0;
        let out=0;
        let distSum=0;
        let closest=Number.POSITIVE_INFINITY;
        let furthest=0;
        positions.forEach(pos=>{
          if(!pos) return;
          if(pos.kind==='finished') finished+=1;
          if(pos.kind!=='base') out+=1;
          const dist=distToFinish(color,pos);
          distSum+=dist;
          if(pos.kind!=='base' && pos.kind!=='finished'){
            if(dist<closest) closest=dist;
            if(dist>furthest) furthest=dist;
          }
        });
        if(!Number.isFinite(closest)) closest=distSum;
        return {
          positions,
          counts,
          finished,
          out,
          distSum,
          closest,
          furthest,
          exposure:computeExposureSum(positions,counts,color)
        };
      };
      const mySnapshot=snapshotFor(player.color,myPieces);
      const myPositions=mySnapshot.positions;
      const myTrackCounts=mySnapshot.counts;
      const opponents=this.state.players.filter(p=>p.id!==player.id);
      const opponentSnapshots=opponents.map(opp=>{
        const pieces=this.state.pieces[opp.id]||[];
        const snap=snapshotFor(opp.color,pieces);
        return Object.assign({id:opp.id,color:opp.color},snap);
      });
      const opponentPieces=[];
      opponentSnapshots.forEach(snap=>{
        snap.positions.forEach(pos=>{ if(pos) opponentPieces.push({color:snap.color,pos}); });
      });
      const bestDist=opponentSnapshots.length>0?Math.min(...opponentSnapshots.map(s=>s.distSum)):mySnapshot.distSum;
      const worstDist=opponentSnapshots.length>0?Math.max(...opponentSnapshots.map(s=>s.distSum)):mySnapshot.distSum;
      const bestExposure=opponentSnapshots.length>0?Math.min(...opponentSnapshots.map(s=>s.exposure)):mySnapshot.exposure;
      const mostFinished=opponentSnapshots.length>0?Math.max(...opponentSnapshots.map(s=>s.finished)):mySnapshot.finished;
      const mostOut=opponentSnapshots.length>0?Math.max(...opponentSnapshots.map(s=>s.out)):mySnapshot.out;
      const behindCount=opponentSnapshots.filter(s=>s.distSum<mySnapshot.distSum).length;
      const aheadCount=opponentSnapshots.filter(s=>s.distSum>mySnapshot.distSum).length;
      const standing={
        distGapToLeader:mySnapshot.distSum-bestDist,
        distGapToLaggard:worstDist-mySnapshot.distSum,
        exposureGap:mySnapshot.exposure-bestExposure,
        finishedGap:mostFinished-mySnapshot.finished,
        outGap:mostOut-mySnapshot.out,
        behindCount,
        aheadCount,
        hasLead:mySnapshot.distSum<=bestDist && mySnapshot.finished>=mostFinished
      };
      const determinePhase=()=>{
        const totalPieces=Math.max(myPieces.length, window.GameRules?.BOARD?.bases?.perPlayer||4);
        let finished=0; let outCount=0; let distSum=0;
        myPositions.forEach(pos=>{
          if(!pos) return;
          if(pos.kind==='finished') finished+=1;
          if(pos.kind!=='base') outCount+=1;
          distSum+=distToFinish(player.color,pos);
        });
        if(finished>=Math.max(1,totalPieces-1) || distSum<=totalPieces*6) return 'endgame';
        if(outCount>=Math.max(2,Math.ceil(totalPieces/2)) || distSum<=totalPieces*20) return 'midgame';
        return 'opening';
      };
      const phase=determinePhase();
      const weights=(weightsProfile[difficulty]&&weightsProfile[difficulty][phase])||weightsProfile.normal.midgame;
      const baseExposure=computeExposureSum(myPositions,myTrackCounts);
      const SCALE={out:12,safe:10,eat:20,progress:6,cluster:5,endfit:9,tempo:8,riskPenalty:14,riskRelief:8};
      const movingSetFromMove=(move)=>{
        const indices=Array.isArray(move.stack)?move.stack.slice():[move.pieceIndex];
        return new Set(indices);
      };
      const projectAfterState=(move)=>{
        const positions=myPositions.map(pos=>clonePos(pos));
        const movingSet=movingSetFromMove(move);
        movingSet.forEach(idx=>{ positions[idx]=clonePos(move.to); });
        const counts=buildTrackCounts(positions);
        return {positions,counts,movingSet};
      };
      const computeClusterValue=(targetPos,positions,movingSet)=>{
        if(!targetPos || targetPos.kind!=='track') return 0;
        const idx=targetPos.idx;
        const range=3;
        let total=0;
        positions.forEach((pos,idx2)=>{
          if(!pos || pos.kind!=='track') return;
          if(movingSet && movingSet.has(idx2)) return;
          const diff=((pos.idx-idx)%trackLength+trackLength)%trackLength;
          const wrap=Math.min(diff,trackLength-diff);
          if(wrap===0) total+=1;
          else if(wrap<=range) total+=0.5;
        });
        return total;
      };
      const eventScore=(move)=>{
        const events=[...(move.events||[])];
        const effects=[...(move.effects||[])];
        let score=0;
        events.forEach(ev=>{
          if(ev.type==='jump') score+=(weights.W_progress+weights.W_tempo+6)*1.2;
          else if(ev.type==='flight') score+=(weights.W_progress+weights.W_tempo+5);
          else if(ev.type==='portal') score+=(weights.W_progress+4);
          else if(ev.type==='enter-home') score+=(weights.W_endfit+weights.W_progress+6);
          else if(ev.type==='finish') score+=(weights.W_endfit+weights.W_tempo+8)*1.4;
          else if(ev.type==='power-up') score+=(weights.W_tempo+6)*1.1;
          else if(ev.type==='trap') score-=(weights.W_risk+6)*1.4;
        });
        effects.forEach(effect=>{
          if(effect.type==='power-up') score+=(weights.W_tempo+6)*1.2;
          if(effect.type==='trap') score-=(weights.W_risk+6)*1.6;
        });
        return score;
      };
      const scored=moves.map(move=>{
        const beforePos=myPositions[move.pieceIndex]||window.GameRules.Pos.base();
        const beforeDist=distToFinish(player.color,beforePos);
        const projection=projectAfterState(move);
        const afterPos=move.to;
        const afterDist=distToFinish(player.color,afterPos);
        const progress=Math.max(0,beforeDist-afterDist);
        const captureCount=(move.capture?.captured||[]).length;
        const stackSizeAfter=(afterPos.kind==='track')?(projection.counts[afterPos.idx]||0):0;
        const stackSizeBefore=(beforePos.kind==='track')?(myTrackCounts[beforePos.idx]||0):0;
        const threatBefore=(beforePos.kind==='track')?threatDetailAt(beforePos.idx,{stackSize:Math.max(1,stackSizeBefore)}):{prob:0,faces:new Set(),intensity:0};
        const threatAfter=(afterPos.kind==='track')?threatDetailAt(afterPos.idx,{stackSize:Math.max(1,stackSizeAfter)}):{prob:0,faces:new Set(),intensity:0};
        const safeBefore=(beforePos.kind==='track')&&isSafeTile(player.color,beforePos.idx);
        let safeValue=0;
        let safePenalty=0;
        if(afterPos.kind==='finished') safeValue=1.3;
        else if(afterPos.kind==='home'){
          const remain=Math.max(0,(BOARD.homeLane.length-1)-afterPos.idx);
          safeValue=1+Math.max(0,1.2-remain*0.4);
        }else if(afterPos.kind==='track'){
          if(isSafeTile(player.color,afterPos.idx)) safeValue=1;
          else if(stackSizeAfter>=2 && rules.blockadePassThrough===false) safeValue=0.8;
          else if(captureCount>0) safeValue=0.4;
        }
        if(safeBefore && safeValue<0.8) safePenalty=1;
        const movingSet=projection.movingSet;
        const clusterBefore=computeClusterValue(beforePos,myPositions,movingSet)+Math.max(0,stackSizeBefore-movingSet.size);
        const clusterAfter=computeClusterValue(afterPos,projection.positions,movingSet)+((afterPos.kind==='track')?Math.max(0,stackSizeAfter-movingSet.size):0);
        const clusterDelta=clusterAfter-clusterBefore;
        let endfit=0;
        if(afterPos.kind==='finished') endfit=3;
        else if(afterPos.kind==='home'){
          const remain=Math.max(0,(BOARD.homeLane.length-1)-afterPos.idx);
          if(remain===0) endfit=2.6;
          else if(remain===1) endfit=2;
          else if(remain===2) endfit=1.3;
          else endfit=0.8;
        }else if(afterDist<=2) endfit=1.6;
        else if(afterDist<=4) endfit=1;
        else if(afterDist<=6) endfit=0.6;
        const tempoEvents=[...(move.events||[]),...(move.effects||[])];
        let tempo=0;
        if(captureCount>0) tempo+=1.1;
        if(move.dice===6 && rules.extraTurnOnSix!==false) tempo+=0.6;
        if(tempoEvents.some(ev=>ev.type==='power-up'&&ev.effect==='extra-roll')) tempo+=1.2;
        if(tempoEvents.some(ev=>ev.type==='jump'||ev.type==='flight'||ev.type==='portal')) tempo+=0.2;
        if(afterPos.kind==='finished') tempo+=0.4;
        const outGain=(beforePos.kind==='base' && afterPos.kind!=='base')?1:0;
        const heurScore=
          weights.W_out*SCALE.out*outGain+
          weights.W_safe*SCALE.safe*safeValue+
          weights.W_eat*SCALE.eat*captureCount+
          weights.W_progress*SCALE.progress*progress+
          weights.W_cluster*SCALE.cluster*clusterDelta+
          weights.W_endfit*SCALE.endfit*endfit+
          weights.W_tempo*SCALE.tempo*tempo;
        let score=heurScore;
        score+=eventScore(move);
        score-=weights.W_risk*SCALE.riskPenalty*threatAfter.prob;
        score+=weights.W_risk*SCALE.riskRelief*Math.max(0,threatBefore.prob-threatAfter.prob);
        if(safePenalty>0) score-=weights.W_risk*9*safePenalty;
        const afterExposure=computeExposureSum(projection.positions,projection.counts);
        const blockPressure=(()=>{
          if(afterPos.kind!=='track') return 0;
          if(projection.counts[afterPos.idx]<2 || rules.blockadePassThrough!==false) return 0;
          let pressure=0;
          opponentPieces.forEach(entry=>{
            const pos=entry.pos;
            if(!pos || pos.kind!=='track') return;
            const behind=((afterPos.idx-pos.idx)%trackLength+trackLength)%trackLength;
            if(behind>=1 && behind<=4) pressure+=1;
          });
          return pressure;
        })();
        return {
          move,
          score,
          progress,
          captureCount,
          safeValue,
          safePenalty,
          threat:threatAfter,
          threatBefore,
          outGain,
          clusterDelta,
          endfit,
          tempo,
          afterExposure,
          blockPressure
        };
      });
      const tuneByDifficulty=()=>{
        if(difficulty==='easy'){
          scored.forEach(entry=>{
            let adjust=0;
            if(entry.safeValue>=1) adjust+=weights.W_safe*3*entry.safeValue;
            if(entry.safePenalty>0) adjust-=weights.W_safe*4*entry.safePenalty;
            if(entry.outGain) adjust+=weights.W_out*2.5;
            if(entry.progress>=4) adjust+=weights.W_progress*0.4*entry.progress;
            if(entry.threat.prob>0.25) adjust-=weights.W_risk*5*(entry.threat.prob-0.25);
            entry.score+=adjust;
            entry.score+=(Math.random()-0.5)*weights.W_tempo*4;
          });
          return;
        }
        if(difficulty==='normal'){
          const catchUpFactor=Math.max(0,standing.distGapToLeader)/8;
          scored.forEach(entry=>{
            let adjust=0;
            if(standing.outGap>0 && entry.outGain) adjust+=weights.W_out*3*Math.min(standing.outGap,2);
            if(catchUpFactor>0 && entry.progress>0) adjust+=weights.W_progress*catchUpFactor*entry.progress*0.6;
            if(entry.threatBefore.prob>0.45 && entry.threat.prob<entry.threatBefore.prob) adjust+=weights.W_risk*4;
            if(standing.finishedGap<=0 && entry.endfit>0) adjust+=weights.W_endfit*3*entry.endfit;
            entry.score+=adjust;
            entry.score+=(Math.random()-0.5)*weights.W_tempo*2;
          });
          return;
        }
        if(difficulty==='hard'){
          const catchUpFactor=Math.max(0,standing.distGapToLeader)/6;
          const exposureRelief=Math.max(0,standing.exposureGap);
          scored.forEach(entry=>{
            let adjust=0;
            if(catchUpFactor>0 && entry.progress>0) adjust+=weights.W_progress*(catchUpFactor*entry.progress*1.1);
            if(entry.captureCount>0) adjust+=weights.W_eat*(2+Math.max(0,standing.finishedGap));
            if(entry.threat.prob<entry.threatBefore.prob) adjust+=weights.W_risk*8*Math.max(0,entry.threatBefore.prob-entry.threat.prob);
            if(entry.afterExposure<baseExposure) adjust+=weights.W_risk*6*(baseExposure-entry.afterExposure);
            if(entry.safePenalty===0 && entry.safeValue>=1 && standing.hasLead) adjust+=weights.W_safe*4*entry.safeValue;
            if(entry.endfit>2.4) adjust+=weights.W_endfit*6;
            if(entry.blockPressure>0) adjust+=weights.W_tempo*5*entry.blockPressure;
            if(entry.move?.to?.kind==='home' && entry.progress<=6) adjust+=weights.W_endfit*4;
            if(exposureRelief>0 && entry.afterExposure<mySnapshot.exposure) adjust+=weights.W_risk*4*exposureRelief;
            entry.score+=adjust;
          });
        }
      };
      tuneByDifficulty();
      if(difficulty==='normal' || difficulty==='hard'){
        scored.forEach(entry=>{
          const expectedLoss=entry.threat.prob*(entry.progress*0.6+(entry.captureCount>0?2:1)+(entry.safeValue<0.6?2:0));
          entry.score-=weights.W_risk*6*expectedLoss;
        });
      }
      if(difficulty==='hard'){
        const basePenaltyScale=weights.W_risk*18;
        scored.forEach(entry=>{
          const exposureDelta=entry.afterExposure-baseExposure;
          if(exposureDelta>0) entry.score-=basePenaltyScale*exposureDelta;
          else entry.score+=weights.W_risk*8*Math.abs(exposureDelta);
          entry.score-=weights.W_risk*4*entry.threat.intensity;
          if(entry.blockPressure>0) entry.score+=weights.W_tempo*4*entry.blockPressure;
          if(entry.endfit>2.4) entry.score+=weights.W_endfit*6;
        });
      }
      const sorted=scored.slice().sort((a,b)=>{
        if(!Number.isFinite(b.score) || !Number.isFinite(a.score)){
          if(Number.isFinite(b.score)) return 1;
          if(Number.isFinite(a.score)) return -1;
          return 0;
        }
        if(b.score!==a.score) return b.score-a.score;
        if(b.captureCount!==a.captureCount) return b.captureCount-a.captureCount;
        if(b.progress!==a.progress) return b.progress-a.progress;
        return (a.move.pieceIndex||0)-(b.move.pieceIndex||0);
      });
      if(sorted.length===0) return null;
      if(difficulty==='easy'){
        const capturing=sorted.filter(entry=>entry.captureCount>0);
        const safeMoves=sorted.filter(entry=>entry.safeValue>=1 || entry.move.to.kind!=='track');
        const maxProgress=Math.max(0,...sorted.map(entry=>entry.progress||0));
        let pool=null;
        if(capturing.length>0) pool=capturing;
        else if(safeMoves.length>0) pool=safeMoves;
        else pool=sorted.filter(entry=>entry.progress===maxProgress);
        if(pool.length===0) pool=sorted;
        const topPool=pool.slice().sort((a,b)=>b.score-a.score);
        if(topPool.length>1 && Math.random()<0.25){
          const idx=Math.random()<0.5?0:1;
          return topPool[Math.min(idx,topPool.length-1)].move;
        }
        return topPool[0].move;
      }
      if(difficulty==='normal'){
        const jitterThreshold=0.05+Math.random()*0.05;
        if(sorted.length>1 && Math.random()<jitterThreshold){
          const idx=Math.random()<0.5?0:1;
          return sorted[Math.min(idx,sorted.length-1)].move;
        }
        return sorted[0].move;
      }
      if(difficulty==='hard'){
        if(sorted.length>1){
          const top=sorted[0];
          const second=sorted[1];
          const base=Math.max(1,Math.abs(top.score));
          if(Math.abs(top.score-second.score)/base<0.01 && Math.random()<0.02){
            const pick=Math.random()<0.5?0:1;
            return sorted[pick].move;
          }
        }
        return sorted[0].move;
      }
      return sorted[0].move;
    },
    maybeAutoPlayIfAI(){
      if(this.state.view!=='game') return;
      const player=this.currentPlayer();
      if(!player) return;
      if(!this.isAI(player)) return;
      if(this._aiTimer!=null) return;
      const epoch=this._gameEpoch||0;
      this._aiTimer=setTimeout(()=>{
        this._aiTimer=null;
        if(epoch!==(this._gameEpoch||0) || this.state.view!=='game' || document.querySelector('dialog[open]')) return;
        if(this.state.animating){
          this.maybeAutoPlayIfAI();
          return;
        }
        const current=this.currentPlayer();
        if(!current || !this.isAI(current)) return;
        if(this.state.view!=='game') return;
        if(current.id!==player.id){
          this.maybeAutoPlayIfAI();
          return;
        }
        if(this.state.view!=='game') return;
        if(this.state.dice==null){
          this.rollDice('system');
          return;
        }
        if(this.state.view!=='game') return;
        const diff=this.normalizeDifficulty(current.difficulty||'normal');
        const mv=this.chooseAIMove({player:current,difficulty:diff});
        if(this.state.view!=='game') return;
        const label=this.formatPlayerName(current,{includeDifficulty:true});
        const color=current?.color||null;
        if(mv){
          this.log(`${label} 選擇：${this.describeMove(mv)}`,{color});
          this.applyMove(mv,'system');
        }else{
          this.log(`${label} 無步可走`,{color});
          this.handleNoMoves(current);
        }
      },300);
    },

    // --------- Anim / Effects ---------
    animatePiece(player,from,to,duration=480,path=null){ duration=this.getAnimDuration(duration); return new Promise(resolve=>{ const g=this.$.gHL; if(!g){ resolve(); return; } const NS='http://www.w3.org/2000/svg'; const ghost=document.createElementNS(NS,'circle'); ghost.setAttribute('cx',from.x); ghost.setAttribute('cy',from.y); ghost.setAttribute('r',18); ghost.setAttribute('fill',`var(--${player.color})`); ghost.setAttribute('stroke','#0b0f14'); ghost.setAttribute('stroke-width','3'); g.appendChild(ghost); this.ensurePiecesOnTop(); const cleanup=()=>{ if(ghost.parentNode) ghost.parentNode.removeChild(ghost); resolve(); }; const coords=Array.isArray(path)&&path.length>1?path.map(pt=>({x:pt.x,y:pt.y})):[{x:from.x,y:from.y},{x:to.x,y:to.y}]; if(coords.length<2){ coords.push({x:to.x,y:to.y}); } const segments=[]; for(let i=0;i<coords.length-1;i++){ const start=coords[i]; const end=coords[i+1]; const len=Math.hypot(end.x-start.x,end.y-start.y); segments.push({start,end,len:len||0.0001}); } if(segments.length===0 || duration<=0){ cleanup(); return; } const totalLen=segments.reduce((acc,seg)=>acc+seg.len,0)||1; const ease=t=>1-Math.pow(1-t,3); const t0=performance.now(); let fallbackTimerId=null; const scheduleStep=(handler)=>{ if(typeof window!=='undefined' && typeof window.requestAnimationFrame==='function' && !isDocumentHidden()){ window.requestAnimationFrame(handler); }else{ fallbackTimerId=setTimeout(()=>{ fallbackTimerId=null; handler(performance.now()); },16); } }; const step=(now)=>{ const raw=Math.min(1,(now-t0)/duration); const eased=ease(raw); const targetDist=totalLen*eased; let traversed=0; let segmentIndex=0; while(segmentIndex<segments.length-1 && traversed+segments[segmentIndex].len<targetDist){ traversed+=segments[segmentIndex].len; segmentIndex++; } const segment=segments[segmentIndex]; const segLen=segment.len||1; const local=(segLen===0)?1:Math.min(1,(targetDist-traversed)/segLen); const x=segment.start.x+(segment.end.x-segment.start.x)*local; const y=segment.start.y+(segment.end.y-segment.start.y)*local; ghost.setAttribute('cx',x); ghost.setAttribute('cy',y); if(raw<1){ scheduleStep(step); }else{ if(fallbackTimerId!=null){ clearTimeout(fallbackTimerId); fallbackTimerId=null; } cleanup(); } }; scheduleStep(step); }); },
    pulseAt(x,y,color){ if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return; const g=this.$.gHL; if(!g) return; const NS='http://www.w3.org/2000/svg'; const ring=document.createElementNS(NS,'circle'); ring.setAttribute('cx',x); ring.setAttribute('cy',y); ring.setAttribute('r','8'); ring.setAttribute('fill','none'); ring.setAttribute('stroke',color); ring.setAttribute('stroke-width','3'); ring.setAttribute('opacity','0.9'); g.appendChild(ring); this.ensurePiecesOnTop(); let r=8; const id=setInterval(()=>{ r+=4; ring.setAttribute('r',r); const op=parseFloat(ring.getAttribute('opacity')); ring.setAttribute('opacity',String(Math.max(0,op-0.12))); if(r>36){ clearInterval(id); if(ring.parentNode) ring.parentNode.removeChild(ring);} },16); },
    computeThreatFaces(targetIdx){
      const L=window.GameRules.BOARD.track.length;
      const me=this.currentPlayer();
      if(!me) return [];
      const myId=me.id;
      const faces=new Set();
      for(const opp of this.state.players){
        if(myId!=null && opp.id===myId) continue;
        const oppPieces=this.state.pieces[opp.id]||[];
        for(const pc of oppPieces){
          if(!pc?.pos || pc.pos.kind!=='track') continue;
          const d=((targetIdx-pc.pos.idx)%L+L)%L;
          if(d>=1 && d<=6) faces.add(d);
        }
      }
      return Array.from(faces).sort((a,b)=>a-b);
    },
    showThreatBadge(x,y,faces){ const g=this.$.gHL; g.querySelectorAll('.threat-badge').forEach(n=>n.remove()); if(!faces||faces.length===0) return; const NS='http://www.w3.org/2000/svg'; const bx=x+26,by=y-26; const badge=document.createElementNS(NS,'g'); badge.setAttribute('class','threat-badge'); const rect=document.createElementNS(NS,'rect'); const label=faces.join('/'); const padding=6; const width=Math.max(24,label.length*7+padding*2); rect.setAttribute('x',bx-width/2); rect.setAttribute('y',by-10); rect.setAttribute('width',width); rect.setAttribute('height',20); rect.setAttribute('rx',6); rect.setAttribute('fill','#ef4444'); rect.setAttribute('stroke','#000'); rect.setAttribute('stroke-width','2'); const txt=document.createElementNS(NS,'text'); txt.setAttribute('x',bx); txt.setAttribute('y',by+5); txt.setAttribute('text-anchor','middle'); txt.setAttribute('font-size','12'); txt.setAttribute('fill','#0b0f14'); txt.textContent=label; badge.appendChild(rect); badge.appendChild(txt); g.appendChild(badge); this.ensurePiecesOnTop(); }
  };
  const getPlayerInfoById=(playerId)=>{
    try{
      const players=App?.state?.players;
      if(!Array.isArray(players)) return null;
      return players.find(p=>p && p.id===playerId) || null;
    }catch(err){ return null; }
  };
  const formatPlayerDisplay=(player,fallbackId=null)=>{
    if(!player || typeof player!=='object'){
      const fallback=(fallbackId||'').toString().trim();
      return {name:fallback||'玩家',colorLabel:'',color:''};
    }
    const preferred=(player.name||'').trim();
    const fallback=(fallbackId||'').toString().trim();
    const name=preferred||fallback||'玩家';
    const color=(player.color||'').trim();
    const colorLabel=COLOR_LABELS[color]||color||'';
    return {name,colorLabel,color};
  };
  window.showWinnerEffect=(playerId)=>{
    try{
      const player=formatPlayerDisplay(getPlayerInfoById(playerId),playerId);
      const overlayId='winner-celebration';
      let overlay=document.getElementById(overlayId);
      if(!overlay){
        overlay=document.createElement('div');
        overlay.id=overlayId;
        overlay.className='winner-celebration';
        overlay.innerHTML='<div class="winner-celebration__confetti" aria-hidden="true"></div>'+
          '<div class="winner-celebration__banner" role="status" aria-live="assertive">'+
          '<p class="winner-celebration__title"></p>'+
          '<p class="winner-celebration__subtitle"></p>'+
          '</div>';
        document.body.appendChild(overlay);
      }
      const titleEl=overlay.querySelector('.winner-celebration__title');
      const subtitleEl=overlay.querySelector('.winner-celebration__subtitle');
      if(titleEl) titleEl.textContent=`${player.name} 勝出！`;
      if(subtitleEl){
        const detail=player.colorLabel?`（${player.colorLabel}）`:'';
        subtitleEl.textContent=`${detail?detail+' ':''}率先將所有飛機降落終點`;
      }
      overlay.setAttribute('data-active','true');
      if(player.color) overlay.dataset.color=player.color;
      const confettiHost=overlay.querySelector('.winner-celebration__confetti');
      if(confettiHost){
        const reduceMotion=typeof window!=='undefined' && typeof window.matchMedia==='function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        confettiHost.innerHTML='';
        if(!reduceMotion){
          const palette=[`var(--${player.color||'accent'})`,'var(--accent)','rgba(244,114,182,0.9)','rgba(250,204,21,0.95)','rgba(56,189,248,0.92)'];
          const pieces=120;
          for(let i=0;i<pieces;i++){
            const piece=document.createElement('span');
            piece.className='confetti-piece';
            piece.style.left=`${Math.random()*100}%`;
            piece.style.setProperty('--delay',`${(Math.random()*0.6).toFixed(2)}s`);
            piece.style.setProperty('--duration',`${(2.6+Math.random()*1.6).toFixed(2)}s`);
            piece.style.setProperty('--x-drift',`${(Math.random()*60-30).toFixed(2)}vw`);
            piece.style.background=palette[i%palette.length];
            confettiHost.appendChild(piece);
          }
        }
      }
      if(overlay._hideTimer) clearTimeout(overlay._hideTimer);
      if(overlay._removeTimer) clearTimeout(overlay._removeTimer);
      overlay._hideTimer=setTimeout(()=>{
        overlay.setAttribute('data-active','false');
        overlay._removeTimer=setTimeout(()=>{
          if(overlay && overlay.parentNode){
            overlay.parentNode.removeChild(overlay);
          }
        },420);
      },4600);
    }catch(err){
      console.warn('showWinnerEffect failed',err);
    }
  };
  window.showWinnerModal=(playerId,options={})=>{
    const dialog=(App?.$.dialogVictory)||document.getElementById('dialog-victory');
    if(!dialog) return;
    const player=formatPlayerDisplay(getPlayerInfoById(playerId),playerId);
    const nameEl=(App?.$.victoryWinnerName)||dialog.querySelector('[data-winner-name]');
    const colorEl=(App?.$.victoryWinnerColor)||dialog.querySelector('[data-winner-color]');
    const subtitleEl=(App?.$.victorySubtitle)||dialog.querySelector('[data-victory-subtitle]');
    const orderSection=(App?.$.victoryOrder)||dialog.querySelector('#victory-order');
    const listEl=(App?.$.victoryList)||dialog.querySelector('[data-finish-order]');
    if(nameEl) nameEl.textContent=player.name;
    if(colorEl){
      colorEl.textContent=player.colorLabel?`（${player.colorLabel}）`:'';
      colorEl.style.color=player.color?`var(--${player.color})`:'inherit';
    }
    if(subtitleEl) subtitleEl.textContent='想再戰一局嗎？按「重開局」即可立刻開始新回合。';
    if(listEl){
      listEl.innerHTML='';
      const finishOrder=Array.isArray(options.finishOrder)?options.finishOrder:[];
      if(finishOrder.length>0){
        finishOrder.forEach((pid,idx)=>{
          const info=formatPlayerDisplay(getPlayerInfoById(pid),pid);
          const li=document.createElement('li');
          let label=`${idx+1}. ${info.name}`;
          if(info.colorLabel) label+=`（${info.colorLabel}）`;
          if(pid===playerId) label+=' 🏆';
          li.textContent=label;
          listEl.appendChild(li);
        });
        if(orderSection) orderSection.hidden=false;
      }else if(orderSection){
        orderSection.hidden=true;
      }
    }
    openDialogSafe(dialog);
  };
  window.App = App; window.addEventListener('DOMContentLoaded',()=>App.init());
  // ============================= End App ===============================
