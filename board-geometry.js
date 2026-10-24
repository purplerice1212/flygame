/* Canonical Fly Chess geometry: one 15x15 cross grid supplies every SVG coordinate. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BoardGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const COLORS = Object.freeze(['red','blue','yellow','green']);
  const CELL = 56, CENTER = 500, GRID_SIZE = 15, TILE_SIZE = 46, BASE_SIZE = 320;
  const SECTOR = [[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8]];
  const HOME = {
    red: [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
    blue: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
    yellow: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
    green: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
  };
  const BASE_CENTERS = {red:[2.5,2.5],blue:[2.5,11.5],yellow:[11.5,11.5],green:[11.5,2.5]};
  function rotate([row,col], turns) {
    let r=row,c=col;
    for(let i=0;i<turns;i++) [r,c]=[c,GRID_SIZE-1-r];
    return [r,c];
  }
  function at(row,col){return {x:CENTER+(col-7)*CELL,y:CENTER+(row-7)*CELL,row,col};}
  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function create(board){
    if(board&&(board.track?.length!==52||board.homeLane?.length!==6||board.bases?.perPlayer!==4))
      throw new Error('Expected 52 track cells, 6 home cells and 4 base slots');
    if(board) COLORS.forEach((color,i)=>{
      if(board.track.startIndex?.[color]!==i*13||board.homeLane.entryIndex?.[color]!==((i*13+50)%52))
        throw new Error(color+' start or entry index mismatches canonical geometry');
    });
    const track=[];
    for(let q=0;q<4;q++) for(const cell of SECTOR) track.push(at(...rotate(cell,q)));
    track.forEach((p,i)=>{const next=track[(i+1)%track.length];p.idx=i;p.angle=Math.atan2(next.y-p.y,next.x-p.x);});
    const home={},bases={},baseCenters={},finishedSlots={},runway={},runwayEntry={};
    for(const color of COLORS){
      home[color]=HOME[color].map(([r,c],idx)=>({...at(r,c),idx}));
      const center=at(...BASE_CENTERS[color]);baseCenters[color]=center;
      const delta=CELL*1.15;
      bases[color]=[{x:center.x-delta,y:center.y-delta},{x:center.x-delta,y:center.y+delta},{x:center.x+delta,y:center.y-delta},{x:center.x+delta,y:center.y+delta}];
      finishedSlots[color]=[{x:center.x-24,y:center.y-24},{x:center.x-24,y:center.y+24},{x:center.x+24,y:center.y-24},{x:center.x+24,y:center.y+24}];
      const startIdx=board?.track?.startIndex?.[color]??COLORS.indexOf(color)*13;
      runwayEntry[color]=startIdx;
      const start=track[startIdx];
      runway[color]=[0.50,0.65].map(t=>({x:center.x+(start.x-center.x)*t,y:center.y+(start.y-center.y)*t}));
    }
    const geometry={schema:'flight-chess-cross-grid-v1',gridSize:GRID_SIZE,cellSize:CELL,tileSize:TILE_SIZE,baseSize:BASE_SIZE,baseRadius:BASE_SIZE/2,center:{x:CENTER,y:CENTER},track,home,bases,baseCenters,finishedSlots,runway,runwayEntry};
    const report=validate(geometry,board);
    if(!report.ok) throw new Error('Invalid board geometry: '+report.issues.join('; '));
    return geometry;
  }
  function validate(geom,board){
    const issues=[],track=geom?.track||[];
    if(track.length!==52) issues.push('Track must have 52 cells');
    const seen=new Set();
    for(let i=0;i<track.length;i++){
      const p=track[i],n=track[(i+1)%track.length];
      if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isInteger(p.row)||!Number.isInteger(p.col)){issues.push('Invalid track cell at '+i);continue;}
      const key=p.row+':'+p.col;
      if(seen.has(key)) issues.push('Duplicate track cell '+key);
      seen.add(key);
      if(n&&Math.abs(distance(p,n)-CELL)>0.01&&Math.abs(distance(p,n)-CELL*Math.SQRT2)>0.01) issues.push('Disconnected track step '+i);
    }
    if(seen.size!==52) issues.push('Track cells are not unique');
    const homeSeen=new Set();
    COLORS.forEach((color,index)=>{
      const lane=geom?.home?.[color]||[];
      const startIdx=board?.track?.startIndex?.[color]??index*13;
      const entryIdx=board?.homeLane?.entryIndex?.[color]??(startIdx+50)%52;
      if(startIdx!==index*13) issues.push(color+' start index mismatches geometry');
      if(entryIdx!==(startIdx+50)%52) issues.push(color+' entry index mismatches geometry');
      if(lane.length!==6) issues.push(color+' has no six-cell home lane');
      const entry=track[entryIdx];
      if(entry&&lane[0]&&Math.abs(distance(entry,lane[0])-CELL)>0.01) issues.push(color+' home lane is not adjacent to entry');
      lane.forEach((p,i)=>{
        if(!p){issues.push(color+' missing home cell');return;}
        const key=p.row+':'+p.col;
        if(seen.has(key)||homeSeen.has(key)) issues.push(color+' overlapping home cell '+key);
        homeSeen.add(key);
        if(i>0&&Math.abs(distance(p,lane[i-1])-CELL)>0.01) issues.push(color+' non-contiguous home lane');
      });
      if(lane.length&&Math.abs(distance(lane[lane.length-1],geom.center)-CELL)>0.01) issues.push(color+' goal must touch centre');
      if((geom.bases?.[color]||[]).length!==4) issues.push(color+' base must hold four planes');
      if((geom.finishedSlots?.[color]||[]).length!==4) issues.push(color+' finish slots missing');
      if((geom.runway?.[color]||[]).some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))) issues.push(color+' runway contains invalid coordinates');
    });
    const all=[...track,...COLORS.flatMap(c=>geom?.home?.[c]||[])];
    for(const point of all){
      if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)){issues.push('Non-finite cell anchor');continue;}
      if(point.x<23||point.y<23||point.x>977||point.y>977) issues.push('Cell outside board frame');
      if(Math.abs(point.x-(CENTER+(point.col-7)*CELL))>0.01||Math.abs(point.y-(CENTER+(point.row-7)*CELL))>0.01) issues.push('Cell anchor does not match its grid address');
    }
    for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
      if(all[i]&&all[j]&&Math.abs(all[i].x-all[j].x)<TILE_SIZE&&Math.abs(all[i].y-all[j].y)<TILE_SIZE) issues.push('Cell faces overlap');
    }
    for(const color of COLORS){
      const center=geom?.baseCenters?.[color];
      if(!center||!Number.isFinite(center.x)||!Number.isFinite(center.y)){issues.push(color+' missing base centre');continue;}
      const slots=geom?.bases?.[color]||[];
      for(const p of slots){
        if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x-center.x)>BASE_SIZE/2-24||Math.abs(p.y-center.y)>BASE_SIZE/2-24) issues.push(color+' parking slot outside base');
      }
      for(const p of track){
        if(p&&Math.abs(p.x-center.x)<BASE_SIZE/2+TILE_SIZE/2&&Math.abs(p.y-center.y)<BASE_SIZE/2+TILE_SIZE/2) issues.push(color+' base overlaps track');
      }
      for(const p of geom?.runway?.[color]||[]){
        if(!p)continue;
        if(track.some(q=>q&&distance(p,q)<36)||slots.some(q=>q&&distance(p,q)<36)) issues.push(color+' runway overlaps tile or plane');
      }
    }
    return {ok:issues.length===0,issues};
  }
  return Object.freeze({create,validate,COLORS,CELL,CENTER,GRID_SIZE,TILE_SIZE,BASE_SIZE});
});
