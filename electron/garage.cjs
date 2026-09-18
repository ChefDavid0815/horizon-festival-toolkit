const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const initSqlJs=require('sql.js');
const {parse,replaceDatabase,sha}=require('./profile.cjs');
const catalog=require('../data/cars.json');
let sqlPromise;
async function sql(){return sqlPromise??=initSqlJs({locateFile:file=>require.resolve('sql.js/dist/'+file)});}
function rows(db,query,params=[]){const stmt=db.prepare(query);try{stmt.bind(params);const out=[];while(stmt.step())out.push(stmt.getAsObject());return out;}finally{stmt.free();}}
function check(db){assert.equal(rows(db,'PRAGMA integrity_check')[0].integrity_check,'ok','车库数据库检查失败');const cols=rows(db,'PRAGMA table_info(Career_Garage)');for(const k of ['Id','CarId','Guid','Engine','CarBody','OriginalOwner','Tuning_frontTirePressure'])assert(cols.some(c=>c.name===k),`缺少车库字段 ${k}`);return cols;}
async function open(b){const SQL=await sql(),p=parse(b),db=new SQL.Database(Uint8Array.from(b.subarray(p.database.start,p.database.end)));try{check(db);return db;}catch(e){db.close();throw e;}}
async function inspectGarage(b){const db=await open(b);try{const all=rows(db,'SELECT Id,CarId FROM Career_Garage');const owned=new Set(all.map(r=>r.CarId));return {total:all.length,unique:owned.size,catalogTotal:catalog.cars.length,ownedCatalog:catalog.cars.filter(c=>owned.has(c.id)).length,missing:catalog.cars.filter(c=>!owned.has(c.id)).map(({row,...c})=>c),cars:catalog.cars.map(({row,...c})=>({...c,owned:owned.has(c.id)}))};}finally{db.close();}}
async function patchGarage(b){
 const db=await open(b);try{
  const cols=check(db),all=rows(db,'SELECT * FROM Career_Garage ORDER BY Id');const owned=new Set(all.map(c=>c.CarId));const missing=catalog.cars.filter(c=>!owned.has(c.id));
  if(!missing.length)return {buffer:Buffer.from(b),audit:{kind:'garage',added:0,ids:[],unchanged:true}};
  assert(all.length+missing.length<=2000,'添加后超过本工具支持的 2,000 辆车库上限');
  const tables=rows(db,"SELECT name FROM sqlite_master WHERE type='table' AND name<>'Career_Garage'").map(r=>r.name);
  const beforeOther=new Map(tables.map(t=>[t,JSON.stringify(rows(db,`SELECT * FROM "${t.replaceAll('"','""')}"`))]));
  const owner=rows(db,"SELECT OriginalOwner,count(*) n FROM Career_Garage WHERE OriginalOwner IS NOT NULL AND OriginalOwner<>'' GROUP BY OriginalOwner ORDER BY n DESC LIMIT 1")[0]?.OriginalOwner||'';
  let id=Math.max(0,...all.map(c=>c.Id));
  db.run('BEGIN IMMEDIATE');
  for(const c of missing){
   const row={...c.row,Id:++id,Guid:randomUUID(),OriginalOwner:owner};
   // Schema-added aspect offsets use their actual default (-1), while the
   // original FrontAspectRatio/RearAspectRatio keep their stock part IDs.
   row.FrontTireAspectRatioOffset=-1;row.RearTireAspectRatioOffset=-1;
   const fields=cols.filter(x=>Object.hasOwn(row,x.name)).map(x=>x.name);
   db.run(`INSERT INTO Career_Garage (${fields.map(f=>'"'+f+'"').join(',')}) VALUES (${fields.map(()=>'?').join(',')})`,fields.map(f=>row[f]));
  }
  db.run('COMMIT');check(db);
  const after=rows(db,'SELECT * FROM Career_Garage ORDER BY Id');assert.equal(after.length,all.length+missing.length);
  const index=new Map(after.map(r=>[r.Id,r]));for(const r of all)assert.deepEqual(index.get(r.Id),r,'已有车辆发生变化');
  assert.equal(new Set(after.map(r=>r.Guid)).size,after.length,'车辆 GUID 冲突');
  for(const t of tables)assert.equal(JSON.stringify(rows(db,`SELECT * FROM "${t.replaceAll('"','""')}"`)),beforeOther.get(t),'非车库表发生变化');
  const output=replaceDatabase(b,Buffer.from(db.export()));
  const final=await inspectGarage(output);assert.equal(final.missing.length,0);
  const a=parse(b),z=parse(output);for(const s of a.sections)if(s!==a.database){const other=z.sections.find(v=>v.tag===s.tag);assert(b.subarray(s.start,s.end).equals(output.subarray(other.start,other.end)),'非车库状态块发生变化');}
  return {buffer:output,audit:{kind:'garage',added:missing.length,ids:missing.map(c=>c.id),preservedVehicles:all.length,stockPartsFromGameDatabase:true,beforeSha256:sha(b),afterSha256:sha(output),validation:'数据库与原厂部件校验；游戏内驾驶未验证'}};
 }finally{db.close();}
}
module.exports={inspectGarage,patchGarage,catalog,rows,open};
