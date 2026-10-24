const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','skybound_flight_chess_interface.html'),'utf8');

test('original theme, player controls and board artwork are retained',()=>{
  const components=[
    ['original dark theme','--bg:#0a0a0a'],
    ['player plane CSS','.plane-token{'],
    ['player setup','id="form-setup"'],
    ['settings dialog','id="dialog-settings"'],
    ['plane artwork',"id:'plane-shape'"],
    ['finish artwork',"id:'finish-badge'"],
    ['jump-tile pattern','ensureJumpPattern'],
    ['portal connecting lines','portalLines'],
    ['curved flight connections','flightGroup'],
    ['turn-direction chevrons','tile-chevron-group'],
    ['styled taxi runway','runway-layer'],
    ['styled base outlines',"const baseHex=ensureColor"],
    ['game-state renderer','redrawPieces(){'],
    ['move previews','previewMove(move'],
    ['canonical geometry','window.BoardGeometry.create(window.GameRules.BOARD)'],
    ['geometry source import','<script src="board-geometry.js"></script>']
  ];
  for(const [name,fragment] of components){
    assert.ok(html.includes(fragment),'Missing '+name+': '+fragment);
  }
});

test('legacy stadium coordinates are not used as a board data source',()=>{
  assert.ok(!html.includes('const STADIUM_W='));
  assert.ok(!html.includes('stadiumPoint('));
  assert.ok(html.includes('const points=geom.track;'));
});
