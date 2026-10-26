const assert=require('node:assert/strict');
const {test}=require('node:test');
const Geometry=require('../board-geometry.js');
const Rules=require('../src/rules.js');
const board={track:{length:52,startIndex:{red:0,blue:13,yellow:26,green:39}},homeLane:{length:6,entryIndex:{red:50,blue:11,yellow:24,green:37}},bases:{perPlayer:4}};
test('52 distinct cells and four rotated starts',()=>{
 const geom=Geometry.create(board);assert.equal(geom.track.length,52);assert.equal(new Set(geom.track.map(p=>p.row+':'+p.col)).size,52);
 assert.deepEqual(geom.track.filter((_,i)=>i%13===0).map(p=>[p.row,p.col]),[[6,1],[1,8],[8,13],[13,6]]);assert.equal(Geometry.validate(geom,board).ok,true);
});
test('four contiguous six-cell home lanes',()=>{
 const geom=Geometry.create(board);
 for(const color of Geometry.COLORS){const lane=geom.home[color];assert.equal(lane.length,6);assert.equal(Math.hypot(lane[0].x-geom.track[board.homeLane.entryIndex[color]].x,lane[0].y-geom.track[board.homeLane.entryIndex[color]].y),Geometry.CELL);assert.equal(Math.hypot(lane[5].x-500,lane[5].y-500),Geometry.CELL);}
});
test('four unique bases and four piece positions each',()=>{
 const geom=Geometry.create(board);assert.ok(geom.baseCenters.red.x<500&&geom.baseCenters.red.y<500);assert.ok(geom.baseCenters.blue.x>500&&geom.baseCenters.blue.y<500);assert.ok(geom.baseCenters.yellow.x>500&&geom.baseCenters.yellow.y>500);assert.ok(geom.baseCenters.green.x<500&&geom.baseCenters.green.y>500);Geometry.COLORS.forEach(col=>assert.equal(geom.bases[col].length,4));
});
test('reject incompatible game metadata',()=>{
 assert.throws(()=>Geometry.create({...board,track:{...board.track,length:56}}),/52 track/);assert.throws(()=>Geometry.create({...board,homeLane:{...board.homeLane,entryIndex:{...board.homeLane.entryIndex,red:49}}}),/entry index/);
});
test('runway markers do not cover takeoff tiles or parked aircraft',()=>{
 const geom=Geometry.create(board),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 for(const color of Geometry.COLORS){const taxi=geom.runway[color];assert.equal(taxi.length,2);const start=geom.track[board.track.startIndex[color]];for(const marker of taxi){assert.ok(distance(marker,start)>36,color+' taxi overlaps takeoff');for(const slot of geom.bases[color])assert.ok(distance(marker,slot)>36,color+' taxi overlaps aircraft');}assert.ok(distance(taxi[0],taxi[1])>26,color+' taxi markers overlap');}
});
test('SVG anchor drift, overlapping cells and missing base positions are rejected',()=>{
 let g=Geometry.create(board);g.track[0].x+=5;assert.equal(Geometry.validate(g,board).ok,false);
 g=Geometry.create(board);g.home.red[0].x=g.track[0].x;g.home.red[0].y=g.track[0].y;assert.equal(Geometry.validate(g,board).ok,false);
 g=Geometry.create(board);g.baseCenters.red=null;assert.equal(Geometry.validate(g,board).ok,false);
 g=Geometry.create(board);g.bases.red[0].x=999;assert.equal(Geometry.validate(g,board).ok,false);
});
test('all colours share the same clockwise route and inward home geometry after rotation',()=>{
 const geom=Geometry.create(Rules.BOARD),rotate=p=>({x:1000-p.y,y:p.x});
 const same=(a,b)=>{assert.equal(a.x,b.x);assert.equal(a.y,b.y);};
 for(let i=0;i<52;i++)same(rotate(geom.track[i]),geom.track[(i+13)%52]);
 for(let c=0;c<4;c++){
  const color=Geometry.COLORS[c],next=Geometry.COLORS[(c+1)%4];
  same(rotate(geom.baseCenters[color]),geom.baseCenters[next]);
  geom.home[color].forEach((p,i)=>same(rotate(p),geom.home[next][i]));
 }
 // The signed area distinguishes a continuous clockwise route from its reversal.
 const twiceArea=geom.track.reduce((sum,p,i)=>{const n=geom.track[(i+1)%52];return sum+p.x*n.y-n.x*p.y;},0);
 assert.ok(twiceArea>0);
});
test('every plain movement path agrees with adjacent rendered cells, including home entry',()=>{
 const geom=Geometry.create(Rules.BOARD),rules=structuredClone(Rules.DEFAULT_RULES);
 rules.ownColorJump.enabled=false;rules.dashedFlight.enabled=false;rules.specials.enabled=false;
 const point=(color,pos)=>pos.kind==='track'?geom.track[pos.idx]:geom.home[color][pos.idx];
 for(const color of Geometry.COLORS){
  const player={id:'P1',color},state={players:[player],pieces:{P1:[]}};
  const occ=Rules.buildOccupancy(state);
  for(let index=0;index<52;index++)for(let dice=1;dice<=6;dice++){
   const from=Rules.Pos.track(index),move=Rules.simulateMove(player,from,dice,rules,occ,{recordPath:true});
   assert.equal(move.legal,true,`${color} ${index} +${dice}`);
   const route=[from,...move.path.filter(pos=>pos.kind!=='finished')];
   assert.equal(route.length,dice+1);
   for(let i=1;i<route.length;i++){
    const a=point(color,route[i-1]),b=point(color,route[i]),distance=Math.hypot(a.x-b.x,a.y-b.y);
    assert.ok(Math.abs(distance-Geometry.CELL)<0.001||Math.abs(distance-Geometry.CELL*Math.SQRT2)<0.001,`${color} ${index} +${dice} pip ${i}`);
   }
  }
 }
});
