// Draws the app icons (the same "D" mark as the favicon) with no dependencies.
// Run once: node scripts/make-icons.mjs  — the PNG files are committed.
import {deflateSync,crc32} from 'node:zlib';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const BACKGROUND=[0x10,0x2c,0x23],MARK=[0xc9,0xef,0x9f];

// Outline of the mark in the 40x40 design space: M11 10 h8 c14 0 14 20 0 20 h-8 z
function outline(){
  const points=[[11,10],[19,10]];
  for(let i=1;i<=24;i++){
    const t=i/24,u=1-t;
    points.push([u**3*19+3*u*u*t*33+3*u*t*t*33+t**3*19,u**3*10+3*u*u*t*10+3*u*t*t*30+t**3*30]);
  }
  points.push([11,30]);
  return points;
}
const polygon=outline();
function inside(x,y){
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [xi,yi]=polygon[i],[xj,yj]=polygon[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;
  }
  return hit;
}
function roundedRect(x,y,size,radius){
  const dx=Math.max(radius-x,0,x-(size-radius)),dy=Math.max(radius-y,0,y-(size-radius));
  return dx*dx+dy*dy<=radius*radius;
}

// scale: share of the canvas the 40-unit design occupies. rounded: transparent corners.
function render(size,{scale,rounded}){
  const pixels=Buffer.alloc(size*size*4),samples=3;
  const unit=size*scale/40,offset=(size-size*scale)/2;
  for(let py=0;py<size;py++)for(let px=0;px<size;px++){
    let bg=0,mark=0;
    for(let sy=0;sy<samples;sy++)for(let sx=0;sx<samples;sx++){
      const x=px+(sx+.5)/samples,y=py+(sy+.5)/samples;
      if(!rounded||roundedRect(x,y,size,size*.225))bg++;
      if(inside((x-offset)/unit,(y-offset)/unit))mark++;
    }
    const total=samples*samples,alpha=bg/total,m=mark/total;
    const o=(py*size+px)*4;
    for(let c=0;c<3;c++)pixels[o+c]=Math.round(BACKGROUND[c]*(1-m)+MARK[c]*m);
    pixels[o+3]=Math.round(255*alpha);
  }
  return pixels;
}

function png(size,pixels){
  const chunk=(type,data)=>{
    const body=Buffer.concat([Buffer.from(type),data]),out=Buffer.alloc(body.length+8);
    out.writeUInt32BE(data.length,0);body.copy(out,4);out.writeUInt32BE(crc32(body)>>>0,body.length+4);
    return out;
  };
  const header=Buffer.alloc(13);
  header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header.set([8,6,0,0,0],8);
  const rows=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++){rows[y*(size*4+1)]=0;pixels.copy(rows,y*(size*4+1)+1,y*size*4,(y+1)*size*4);}
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

const dir=path.join(fileURLToPath(new URL('../',import.meta.url)),'icons');
mkdirSync(dir,{recursive:true});
const files={
  'icon-192.png':[192,{scale:.7,rounded:true}],
  'icon-512.png':[512,{scale:.7,rounded:true}],
  // Android crops maskable icons to a circle or squircle: keep the mark inside the safe zone.
  'icon-maskable-512.png':[512,{scale:.52,rounded:false}],
  // iOS rounds the corners itself.
  'apple-touch-icon.png':[180,{scale:.62,rounded:false}],
};
for(const [name,[size,options]] of Object.entries(files)){
  writeFileSync(path.join(dir,name),png(size,render(size,options)));
  console.log('icons/'+name);
}
