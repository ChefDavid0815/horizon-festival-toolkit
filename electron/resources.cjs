const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Zip = require('adm-zip');
const initSqlJs = require('sql.js');
const { fnv, sha } = require('./profile.cjs');
const { validatePack } = require('./catalog.cjs');
const { XMLParser } = require('fast-xml-parser');
const types = {SeasonalEvent:0,Trial:1,PRStunt:2,ForzathonDaily:4,ForzathonWeekly:5,MonthlyRival:6,PhotoChallenge:9,TreasureChest:10,HorizonOpen:12,Eliminator:13,Collectibles:14,StuntParty:15,HideSeek:17,SeasonalJob:18,HorizonLifeEvent:22};
const names = ['','WELCOME TO JAPAN','HORIZON DECADES','ITALIAN EXOTICS','MASCOT PARTY','BRITISH AUTOMOTIVE'];
const seasons = ['Summer','Autumn','Winter','Spring'];
const cn = ['夏季','秋季','冬季','春季'];
// BXML v2 framing described by Nenkai/ForzaTools (MIT); strict bounded reader.
function decode(b) {
  if (b.subarray(0,4).toString() !== 'BXML') {
    const xml = b.toString('utf8').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
    assert(!/<!DOCTYPE|<!ENTITY/i.test(xml),'XML entities are not supported');
    const data = new XMLParser({preserveOrder:true,ignoreAttributes:false,attributeNamePrefix:'',processEntities:false}).parse(xml);
    const convert = arr => arr.filter(x=>Object.keys(x).some(k=>!k.startsWith('?') && !k.startsWith('#') && k!==':@')).map(x=>{const tag=Object.keys(x).find(k=>k!==':@');return {tag,a:x[':@']||{},children:convert(x[tag]||[])};});
    return convert(data)[0];
  }
  assert(b.length >= 14 && b[4] === 2,'Unsupported BXML version');
  let p=5, nodes=0;
  const uint=n=>{assert(p+n<=b.length,'Truncated BXML');const x=b.readUIntLE(p,n);p+=n;return x;};
  const count=uint(4),size=uint(4); assert(count>0 && count<=1000000 && size<=b.length-13);
  const strings=[];
  for(let i=0;i<count;i++){const n=uint(2);assert(p+n<=13+size);strings.push(b.toString('utf8',p,p+n));p+=n;}
  assert(p===13+size); uint(1);
  const width=count>65535?4:count>255?2:1;
  const str=()=>{const i=uint(width);assert(i<strings.length);return strings[i];};
  const node=(depth=0)=>{assert(depth<128 && ++nodes<2000000);const flags=uint(1),tag=str(),a={},children=[];assert((flags&~7)===0);if(flags&2){for(let n=uint(1);n;n--){const k=str();a[k]=str();}}if(flags&4){for(let n=uint(2);n;n--)children.push(node(depth+1));}return {tag,a,children};};
  const out=node();assert(p===b.length,'BXML trailing data');return out;
}
const child=(n,tag)=>n?.children?.filter(x=>x.tag===tag)||[];
const prop=(n,k)=>child(n,'property').find(x=>x.a.id===k);
const val=(n,k)=>prop(n,k)?.a.value;
function descendants(n, predicate) { const out=[]; const visit=x=>{if(predicate(x))out.push(x);for(const c of x.children||[])visit(c);};if(n)visit(n);return out; }
const ref=(n,k)=>descendants(prop(n,k),x=>x.tag==='property'&&x.a.id==='Object')[0]?.a.value;
function seasonsFromArchive(bytes, build) {
  const zip=new Zip(bytes),objects=new Map(); let total=0;
  for(const e of zip.getEntries()){
    if(!e.entryName.endsWith('.om.xml'))continue;
    assert(e.header.size<=8*1024*1024 && (total+=e.header.size)<=256*1024*1024,'Resource archive is too large');
    assert(e.header.method===0||e.header.method===8,'游戏资源已加密，需要新的资源适配器');
    const o=child(decode(e.getData()),'object')[0];
    if(o) objects.set(o.a.id.split('.')[0],o);
  }
  const get=id=>{const o=objects.get(fnv(id).toString());assert(o,'Missing referenced resource');return o;};
  const seasonmap=new Map();
  for(const o of objects.values())if(o.a.type==='FestivalPassEventInfo'){
    const m=(val(o,'ImagePath')||'').match(/Series(\d+)[\\/]FestivalPlaylist[\\/](Summer|Autumn|Winter|Spring)/);
    if(m && +m[1]>0)seasonmap.set(ref(o,'LocalSeasonInstance'),[+m[1],seasons.indexOf(m[2])]);
  }
  const pointsObject=[...objects.values()].find(o=>o.a.type==='FestivalPassPointsSettings');
  const eventmap=[...objects.values()].find(o=>o.a.type==='FestivalPassEventDataMap');
  assert(pointsObject && eventmap,'未找到季节赛资源');
  const points={};
  for(const m of descendants(pointsObject,x=>x.tag==='map_element')){
    const k=child(m,'key')[0]?.a.value,v=child(m,'value')[0];
    if(k && val(v,'Points')!==undefined) points[k]=Number(val(v,'Points'));
  }
  const weeks=[];
  for(const p of child(eventmap,'property')) for(const m of child(p,'map_element')){
    const guid=child(m,'key')[0]?.a.value;if(!seasonmap.has(guid))continue;
    const [series,week]=seasonmap.get(guid),local=get(guid),events=new Map();
    const add=(type,id,source)=>{
      assert(Object.hasOwn(types,type) && Number.isFinite(points[type]),`Unknown event type: ${type}`);
      const value={type:types[type],id:'0x'+BigInt(id).toString(16).padStart(16,'0'),name:type,points:points[type]*(type==='ForzathonDaily'?7:1),parts:type==='ForzathonDaily'?7:type==='ForzathonWeekly'?4:0,source};
      events.set(`${type}:${value.id}`,value);
    };
    for(const r of descendants(child(m,'value')[0],x=>x.tag==='property'&&x.a.id==='Object')){
      const o=get(r.a.value),type=val(o,'EventType'),v=val(o,'EventId');
      if(type==='TreasureChest')continue;assert(typeof v==='string');add(type,/^\d+$/.test(v)?v:fnv(v),v);
    }
    for(const [field,type] of [['ForzathonDailySchedule','ForzathonDaily'],['ForzathonWeeklySchedule','ForzathonWeekly']]){const v=ref(local,field);assert(v);add(type,fnv(v),v);}
    for(const r of child(prop(local,'TreasureChests'),'element'))add('TreasureChest',r.a.value,r.a.value);
    const list=[...events.values()];weeks.push({key:`${series}:${week}`,series,week,season:cn[week],seasonEn:seasons[week],title:names[series]||`SERIES ${series}`,maxPoints:list.reduce((n,e)=>n+e.points,0),events:list});
  }
  weeks.sort((a,b)=>a.series-b.series||a.week-b.week);
  const data={version:1,resourceBuild:build,weeks};validatePack({format:'festival-catalog',version:2,resourceBuild:build,seasons:data});return data;
}
function rows(db,q){const r=db.exec(q)[0];return r?r.values.map(v=>Object.fromEntries(r.columns.map((c,i)=>[c,v[i]]))):[];}
async function carsFromDatabase(bytes,build){
  assert(bytes.subarray(0,16).toString()==='SQLite format 3\0','车辆数据库尚未解密');
  const SQL=await initSqlJs({locateFile:file=>require.resolve('sql.js/dist/'+file)}),db=new SQL.Database(bytes);
  try{
    assert.equal(rows(db,'PRAGMA integrity_check')[0]?.integrity_check,'ok');
    const parts=rows(db,'SELECT * FROM Data_UpgradePart WHERE Id<47 ORDER BY Id');assert(parts.length>30);
    const stock=new Map();
    for(const p of parts){assert(/^[A-Za-z0-9_]+$/.test(p.TableName));const index=new Map();for(const r of rows(db,`SELECT * FROM "${p.TableName}" WHERE IsStock=1`)){const col=Object.keys(r).find(k=>k.toLowerCase()===(p.CategoryName==='Car'?'ordinal':(p.CategoryName+'ID').toLowerCase()));const key=r[col];if(!index.has(key))index.set(key,[]);index.get(key).push(r);}for(const list of index.values())list.sort((a,b)=>(a.Level||0)-(b.Level||0)||a.Id-b.Id);stock.set(p.TableName,index);}
    const invalid=new Set(rows(db,'SELECT Ordinal,PartEnumValue FROM CarInvalidDefaultParts').map(r=>`${r.Ordinal}:${r.PartEnumValue}`));
    const excluded=new Set([...rows(db,'SELECT Ordinal FROM UnobtainableCars').map(r=>r.Ordinal),...rows(db,'SELECT CarId FROM TrafficCars').map(r=>r.CarId)]);
    const makes=new Map(rows(db,'SELECT * FROM List_CarMake').map(r=>[r.ID,r.IconPathBase]));
    const cols=rows(db,'PRAGMA table_info(NewProfile_Career_Garage)').map(r=>r.name);assert(cols.includes('CarId'));
    const cars=[],unresolved=[];
    for(const car of rows(db,'SELECT * FROM Data_Car ORDER BY Id')){
      const cid=car.Id;if(excluded.has(cid)||!car.IsDrivable||!car.IsInstalled)continue;
      const defaults={},groups={Car:cid},issues=[];
      for(const p of parts){const group=groups[p.CategoryName]??-1,r=invalid.has(`${cid}:${p.Id}`)||group===-1?null:stock.get(p.TableName).get(group)?.[0];defaults[p.PartName]=r?.Id??-1;if(!r&&!p.OkIfNoStockPart&&group!==-1&&!invalid.has(`${cid}:${p.Id}`))issues.push(p.PartName);if(['Engine','Drivetrain','CarBody','Motor'].includes(p.PartName))groups[p.PartName]=r?.[Object.keys(r).find(k=>k.toLowerCase()===(p.PartName+'ID').toLowerCase())]??-1;}
      if(issues.length){unresolved.push({id:cid,issues});continue;}
      const row=Object.fromEntries(cols.filter(k=>k!=='Id'&&Object.hasOwn(car,k)).map(k=>[k,car[k]]));
      Object.assign(row,defaults,{CarId:cid,PartsValue:0,PeakIntakePSI:0,TopSpeed:0,Flags:8,NumOwners:1,WheelStyle:-1,WheelStyleRear:-1,DefaultManufacturerColorIndex:0,LiveryFileName:'',TuneFileName:'',VersionedTuneId:'00000000-0000-0000-0000-000000000000',VersionedLiveryId:'00000000-0000-0000-0000-000000000000',HasCurrentOwnerViewedCar:0,SharedID:0,FrontTireAspectRatioOffset:-1,RearTireAspectRatioOffset:-1});
      const zero=['DistanceDriven','TimeDriven','TotalWinnings','TotalRepairs','NumVictories','NumPodiums','NumRaces','NumTimesSold','TimeDrivenInRoadTrips','CurOwnerNumRaces','CurOwnerWinnings','NumSkillPointsEarned','HighestSkillScore'];
      for(const k of cols){if(k.startsWith('Tuning_'))row[k]=-1;if(zero.includes(k))row[k]=0;}
      const media=car.MediaName.split('_');cars.push({id:cid,year:car.Year,make:makes.get(car.MakeID)||'Unknown',name:media.length>2?media.slice(1,-1).join(' '):car.MediaName,media:car.MediaName,classId:car.ClassID,pi:car.PI,contentId:car.ContentId,row});
    }
    const out={version:1,resourceBuild:build,dbSha256:sha(bytes),cars,excluded:[...excluded],unresolved};validatePack({format:'festival-catalog',version:2,resourceBuild:build,cars:out});return out;
  }finally{db.close();}
}
async function readResources({gamePath,previousCars,allowOnline,toolPath,ready,run,tick}){
  assert(typeof gamePath==='string'&&path.isAbsolute(gamePath),'请选择游戏安装目录');
  const archivePath=path.join(gamePath,'media','ObjectModelGame.zip'),dbPath=path.join(gamePath,'media','Stripped','gamedbRC.slt');
  for(const [f,max] of [[archivePath,128*1024*1024],[dbPath,256*1024*1024]]){const s=await fs.stat(f);assert(s.isFile()&&s.size<=max,'游戏资源文件大小无效');}
  const [archive,db]=await Promise.all([fs.readFile(archivePath),fs.readFile(dbPath)]);
  const fingerprint=sha(archive),dbHash=sha(db),build=`local-${fingerprint.slice(0,12)}`;
  tick(25,'读取本地季节赛资源');
  const seasonData=seasonsFromArchive(archive,build);
  let carData=null,carsPending=false;
  if(previousCars.sourceDbSha256!==dbHash){
    let plain=db;
    if(db.subarray(0,16).toString()!=='SQLite format 3\0'){
      if(!allowOnline)carsPending=true;
      else{
        await ready();tick(45,'解密车辆资源 · ForzaCryptoTool');
        const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'festival-catalog-'));
        try{const input=path.join(tmp,'gamedbRC.slt'),output=path.join(tmp,'gamedb.sqlite');await fs.writeFile(input,db);await run(toolPath,['decrypt',input,'-o',output,'--force']);plain=await fs.readFile(output);}
        finally{assert(path.dirname(path.resolve(tmp))===path.resolve(os.tmpdir())&&path.basename(tmp).startsWith('festival-catalog-'));await fs.rm(tmp,{recursive:true,force:true});}
      }
    }
    if(!carsPending){tick(65,'建立车辆原厂部件目录');carData=await carsFromDatabase(plain,build);carData.sourceDbSha256=dbHash;}
  }
  tick(85,'验证更新目录');
  return {pack:validatePack({format:'festival-catalog',version:2,resourceBuild:build,seasons:seasonData,...(carData?{cars:carData}:{})}),carsPending,fingerprint};
}
module.exports={decode,seasonsFromArchive,carsFromDatabase,readResources};
