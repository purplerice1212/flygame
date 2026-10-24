const assert=require('node:assert/strict');
const {test}=require('node:test');
const Geometry=require('../board-geometry.js');
const board={
  track:{length:52,startIndex:{red:0,blue:13,yellow:26,green:39}},
  homeLane:{length:6,entryIndex:{red:50,blue:11,yellow:24,green:37}},
  bases:{perPlayer:4}
};
test('52 distinct cells and four rotated starts',()=>{
  const geom=Geometry.create(board);
  assert.equal(geom.track.length,52);
  assert.equal(new Set(geom.track.map(p=>p.row+':'+p.col)).size,52);
  assert.deepEqual(geom.track.filter((_,i)=>i%13===0).map(p=>[p.row,p.col]),[[6,1],[1,8],[8,13],[13,6]]);
  assert.equal(Geometry.validate(geom,board).ok,true);
});
test('four contiguous six-cell home lanes',()=>{
  const geom=Geometry.create(board);
  for(const color of Geometry.COLORS){
    const lane=geom.home[color];
    assert.equal(lane.length,6);
    assert.equal(Math.hypot(lane[0].x-geom.track[board.homeLane.entryIndex[color]].x,lane[0].y-geom.track[board.homeLane.entryIndex[color]].y),Geometry.CELL);
    assert.equal(Math.hypot(lane[5].x-500,lane[5].y-500),Geometry.CELL);
  }
});
test('four unique bases and four piece positions each',()=>{
  const geom=Geometry.create(board);
  assert.ok(geom.baseCenters.red.x<500&&geom.baseCenters.red.y<500);
  assert.ok(geom.baseCenters.blue.x>500&&geom.baseCenters.blue.y<500);
  assert.ok(geom.baseCenters.yellow.x>500&&geom.baseCenters.yellow.y>500);
  assert.ok(geom.baseCenters.green.x<500&&geom.baseCenters.green.y>500);
  Geometry.COLORS.forEach(col=>assert.equal(geom.bases[col].length,4));
});
test('reject incompatible game metadata',()=>{
  assert.throws(()=>Geometry.create({...board,track:{...board.track,length:56}}),/52 track/);
  assert.throws(()=>Geometry.create({...board,homeLane:{...board.homeLane,entryIndex:{...board.homeLane.entryIndex,red:49}}}),/entry index/);
});
