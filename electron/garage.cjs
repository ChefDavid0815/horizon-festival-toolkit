const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const initSqlJs = require('sql.js');
const {parse,replaceDatabase,sha} = require('./profile.cjs');
const catalog = require('../data/cars.json');
let sqlPromise;
async function sql(){return sqlPromise??=initSqlJs({locateFile:file=>require.resolve('sql.js/dist/'+file)});}
function rows(db,query,params=[]){const stmt=db.prepare(query);try{stmt.bind(params);const out=[];while(stmt.step())out.push(stmt.getAsObject());return out;}finally{stmt.free();}}
function check(db){assert.equal(rows(db,'PRAGMA integrity_check')[0].integrity_check,'ok','车库数据库检查失败');const cols=rows(db,'PRAGMA table_info(Career_Garage)');for(const k of ['Id','CarId','Guid','Engine','CarBody','OriginalOwner','Tuning_frontTirePressure'])assert(cols.some(c=>c.name===k),`缺少车库字段 ${k}`);return cols;}
async function open(b){const SQL=await sql(),p=parse(b),db=new SQL.Database(Uint8Array.from(b.subarray(p.database.start,p.database.end)));try{check(db);return db;}catch(e){db.close();throw e;}}
async function inspectGarage(b,data=catalog){const db=await open(b);try{const all=rows(db,'SELECT Id,CarId FROM Career_Garage');const counts=new Map();for(const c of all)counts.set(c.CarId,(counts.get(c.CarId)||0)+1);return {total:all.length,unique:counts.size,capacity:2000,catalogTotal:data.cars.length,ownedCatalog:data.cars.filter(c=>counts.has(c.id)).length,missing:data.cars.filter(c=>!counts.has(c.id)).map(c=>c.id),counts:Object.fromEntries(counts)};}finally{db.close();}}
async function patchGarage(b,options={},data=catalog){
  assert(options && typeof options==='object' && Object.keys(options).every(k=>['allCars','cars'].includes(k)),'车辆请求无效');
  const {allCars=false,cars=[]}=options;
  assert(typeof allCars==='boolean'&&Array.isArray(cars)&&cars.length<=2000&&!(allCars&&cars.length),'车辆选择无效');
  const index=new Map(data.cars.map(c=>[c.id,c]));const seen=new Set();
  for(const c of cars){assert(c && Number.isInteger(c.id)&&index.has(c.id)&&!seen.has(c.id),'未知或重复的车辆编号');assert(Number.isInteger(c.quantity)&&c.quantity>=1&&c.quantity<=20,'每辆车一次可添加 1–20 台');seen.add(c.id);}
  const db=await open(b);try{
    const cols=check(db),all=rows(db,'SELECT * FROM Career_Garage ORDER BY Id'),owned=new Set(all.map(c=>c.CarId));
    const requests=allCars?data.cars.filter(c=>!owned.has(c.id)).map(c=>({id:c.id,quantity:1})):cars;
    const added=requests.reduce((n,c)=>n+c.quantity,0);
    if(!added)return {buffer:Buffer.from(b),audit:{kind:'garage',added:0,ids:[],unchanged:true}};
    assert(all.length+added<=2000,'添加后超过本工具支持的 2,000 辆车库上限');
    const tables=rows(db,"SELECT name FROM sqlite_master WHERE type='table' AND name<>'Career_Garage'").map(r=>r.name);
    const quote=s=>'"'+s.replaceAll('"','""')+'"';
    const beforeOther=new Map(tables.map(t=>[t,JSON.stringify(rows(db,`SELECT * FROM ${quote(t)}`))]));
    const owner=rows(db,"SELECT OriginalOwner,count(*) n FROM Career_Garage WHERE OriginalOwner IS NOT NULL AND OriginalOwner<>'' GROUP BY OriginalOwner ORDER BY n DESC LIMIT 1")[0]?.OriginalOwner;
    assert(owner!==undefined,'车库没有可识别的原车主记录，请先在游戏中获得一辆车');
    let id=all.reduce((m,c)=>Math.max(m,c.Id),0);assert(Number.isSafeInteger(id)&&id+added<2147483647,'车辆库存编号超出范围');
    const existingGuids=new Set(all.map(c=>c.Guid));assert(existingGuids.size===all.length,'已有车辆 GUID 重复');
    db.run('BEGIN IMMEDIATE');
    for(const request of requests)for(let n=0;n<request.quantity;n++){
      const c=index.get(request.id),row={...c.row,Id:++id,CarId:c.id,Guid:randomUUID(),OriginalOwner:owner,FrontTireAspectRatioOffset:-1,RearTireAspectRatioOffset:-1};
      for(const col of cols)assert(Object.hasOwn(row,col.name)||!col.notnull||col.dflt_value!==null,`未适配的必填车库字段: ${col.name}`);
      const fields=cols.filter(x=>Object.hasOwn(row,x.name)).map(x=>x.name);
      db.run(`INSERT INTO Career_Garage (${fields.map(quote).join(',')}) VALUES (${fields.map(()=>'?').join(',')})`,fields.map(f=>row[f]));
    }
    db.run('COMMIT');check(db);
    const after=rows(db,'SELECT * FROM Career_Garage ORDER BY Id');assert.equal(after.length,all.length+added);
    const afterIndex=new Map(after.map(r=>[r.Id,r]));for(const r of all)assert.deepEqual(afterIndex.get(r.Id),r,'已有车辆发生变化');
    assert.equal(new Set(after.map(r=>r.Guid)).size,after.length,'车辆 GUID 冲突');
    for(const t of tables)assert.equal(JSON.stringify(rows(db,`SELECT * FROM ${quote(t)}`)),beforeOther.get(t),'非车库表发生变化');
    const output=replaceDatabase(b,Buffer.from(db.export())),final=await inspectGarage(output,data);
    assert.equal(final.total,all.length+added);for(const r of requests)assert.equal(final.counts[r.id],all.filter(c=>c.CarId===r.id).length+r.quantity);
    const a=parse(b),z=parse(output);for(const s of a.sections)if(s!==a.database){const other=z.sections.find(v=>v.tag===s.tag);assert(other&&b.subarray(s.start,s.end).equals(output.subarray(other.start,other.end)),'非车库状态块发生变化');}
    return {buffer:output,audit:{kind:'garage',added,requests,ids:requests.map(c=>c.id),preservedVehicles:all.length,stockPartsFromGameDatabase:true,beforeSha256:sha(b),afterSha256:sha(output),validation:'数据库与原厂部件校验；游戏内驾驶未验证'}};
  }finally{db.close();}
}
module.exports={inspectGarage,patchGarage,catalog,rows,open};
