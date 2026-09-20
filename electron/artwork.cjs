const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const Zip=require('adm-zip');
const {PNG}=require('pngjs');
const {sha}=require('./profile.cjs');
// PC TXCB/TXCH bundle layout documented by Nenkai/ForzaTools (MIT).
function decodeSwatch(b){
  assert(Buffer.isBuffer(b)&&b.length>=52&&b.toString('ascii',0,4)==='burG'&&b[4]===1&&b[5]>=1,'Unsupported texture bundle');
  const count=b.readUInt32LE(16);assert(count>0&&count<=16&&20+count*24<=b.length);
  for(let i=0;i<count;i++){
    const p=20+i*24;if(b.toString('ascii',p,p+4)!=='BCXT')continue;
    assert(b[p+4]===0,'Unsupported tiled texture');
    const metaCount=b.readUInt16LE(p+6),metaOffset=b.readUInt32LE(p+8),offset=b.readUInt32LE(p+12),size=b.readUInt32LE(p+16);
    assert(metaCount>0&&metaCount<=16&&metaOffset+metaCount*8<=b.length&&offset+size<=b.length);
    for(let j=0;j<metaCount;j++){
      const m=metaOffset+j*8;if(b.toString('ascii',m,m+4)!=='HCXT')continue;
      const h=m+b.readUInt16LE(m+6),length=b.readUInt16LE(m+4)>>4;assert(h+length<=b.length&&length>=52);
      const width=b.readUInt32LE(h+24),height=b.readUInt32LE(h+28),depth=b.readUInt32LE(h+32),slices=b.readUInt16LE(h+36),transcoding=b.readUInt32LE(h+40);
      assert(width>0&&height>0&&width<=4096&&height<=4096&&width*height<=8*1024*1024&&depth===1&&slices===1&&transcoding<=1,'Unsupported texture layout');
      const params=b.readUInt32LE(h);assert(params+8<=length);const encodingOffset=b.readUInt32LE(h+params);assert(encodingOffset+4<=length);
      const format=b.readUInt32LE(h+encodingOffset),formats={0:'decodeBC1',1:'decodeBC2',2:'decodeBC3',9:'decodeBC7'};
      assert(formats[format],'Unsupported texture encoding');const blockSize=format===0?8:16,bytes=Math.ceil(width/4)*Math.ceil(height/4)*blockSize;assert(bytes<=size,'Truncated texture payload');
      // The decoder works in whole blocks. Trim its padded edge pixels afterward.
      const alignedWidth=Math.ceil(width/4)*4,alignedHeight=Math.ceil(height/4)*4;
      const rgba=require('tex-decoder')[formats[format]](b.subarray(offset,offset+bytes),alignedWidth,alignedHeight);
      const png=new PNG({width,height});for(let y=0;y<height;y++)Buffer.from(rgba.buffer,rgba.byteOffset+y*alignedWidth*4,width*4).copy(png.data,y*width*4);
      return {width,height,format,png:PNG.sync.write(png)};
    }
  }
  throw Error('Texture content header not found');
}
class ArtworkStore{
  constructor(directory){this.directory=path.join(directory,'series-artwork');this.items={};this.report={count:0,missing:[]};}
  async init(){
    await fs.mkdir(this.directory,{recursive:true});
    try{const index=JSON.parse(await fs.readFile(path.join(this.directory,'index.json'),'utf8'));for(const [id,item]of Object.entries(index)){if(!/^\d{1,4}$/.test(id)||!/^s\d+-[a-f0-9]{16}\.png$/.test(item.file))continue;const b=await fs.readFile(path.join(this.directory,item.file));if(b.length<16*1024*1024&&sha(b)===item.sha256)this.items[id]={...item,dataUrl:'data:image/png;base64,'+b.toString('base64')};}}catch{}
    this.report={count:Object.keys(this.items).length,missing:[]};
  }
  view(){return {series:Object.fromEntries(Object.entries(this.items).map(([id,item])=>[id,{url:item.dataUrl,source:item.source,width:item.width,height:item.height}])),...this.report};}
  async sync(gamePath,seriesIds){
    const missing=[];let changed=false;
    for(const id of seriesIds){
      assert(Number.isInteger(id)&&id>0&&id<10000);
      let done=false,lastError='Artwork archive not found';
      for(const sub of ['HiRes/Data_Bound','Data_Bound']){
        const source=path.join('media','UI','Textures',sub,`Series${id}.zip`),file=path.join(gamePath,source);
        try{
          const stat=await fs.stat(file);assert(stat.size<=128*1024*1024);const zip=new Zip(await fs.readFile(file));
          const entry=zip.getEntries().find(e=>/FestivalPlaylist\/All\/SerieshistoryPoster\.swatchbin$/i.test(e.entryName))||zip.getEntries().find(e=>/FestivalPlaylist\/All\/SeriesBackground\.swatchbin$/i.test(e.entryName));
          assert(entry&&entry.header.size<=16*1024*1024,'Series cover is missing');const b=entry.getData(),hash=sha(b);
          if(this.items[id]?.sourceHash===hash){done=true;break;}
          const decoded=decodeSwatch(b),name=`s${id}-${hash.slice(0,16)}.png`,pngHash=sha(decoded.png);
          await fs.writeFile(path.join(this.directory,name),decoded.png);
          this.items[id]={file:name,width:decoded.width,height:decoded.height,sourceHash:hash,sha256:pngHash,source:`${source.replaceAll('\\','/')} → ${entry.entryName}`,dataUrl:'data:image/png;base64,'+decoded.png.toString('base64')};changed=true;done=true;break;
        }catch(e){lastError=e.message;}
      }
      if(!done)missing.push({series:id,reason:lastError});
      // Yield between series so the native window can remain responsive.
      await new Promise(resolve=>setImmediate(resolve));
    }
    if(changed){const index=Object.fromEntries(Object.entries(this.items).map(([id,{dataUrl,...item}])=>[id,item]));const file=path.join(this.directory,'index.json'),temp=file+'.tmp';await fs.writeFile(temp,JSON.stringify(index,null,2));await fs.rename(temp,file);}
    this.report={count:Object.keys(this.items).length,missing};return {...this.view(),changed};
  }
}
module.exports={decodeSwatch,ArtworkStore};
