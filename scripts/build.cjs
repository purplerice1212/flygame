const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const name of ['index.html','skybound_flight_chess_interface.html','board-geometry.js','src','styles','LICENSE']){
  fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true});
}
console.log('Built offline-capable static game in dist/');
