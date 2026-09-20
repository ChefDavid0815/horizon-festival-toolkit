const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const p=require('../electron/profile.cjs');
const g=require('../electron/garage.cjs');
const {CatalogStore,validatePack}=require('../electron/catalog.cjs');
const {Service}=require('../electron/service.cjs');
const samplePath=path.resolve(__dirname,'../qa/cli-roundtrip.bin');
const sample=fs.existsSync(samplePath)?fs.readFileSync(samplePath):null;
const pack=()=>({format:'festival-catalog',version:2,resourceBuild:'test-S6',seasons:{...p.seasons,weeks:p.seasons.weeks.filter(w=>w.series===5).map(w=>({...structuredClone(w),key:`6:${w.week}`,series:6,title:'SERIES SIX'}))}});
test('content packs validate schema, IDs, points and stock parts',()=>{
  validatePack(pack());
  const bad=pack();bad.seasons.weeks[0].maxPoints++;assert.throws(()=>validatePack(bad));
  const duplicate=pack();duplicate.seasons.weeks.push(duplicate.seasons.weeks[0]);assert.throws(()=>validatePack(duplicate));
  const unknown=pack();unknown.seasons.weeks[0].events[0].type=39;assert.throws(()=>validatePack(unknown));
  assert.throws(()=>validatePack({format:'festival-catalog',version:2,resourceBuild:'x',cars:{cars:[{id:1,name:'test',make:'test',media:'x',year:2026,pi:1}]}}));
});
test('S6 content merges without losing history and survives a restart',async()=>{
  const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'festival-test-catalog-'));
  const store=new CatalogStore(dir);await store.init();await store.commit(store.preview(pack(),'import'));
  assert.equal(store.seasons.weeks.length,24);assert.deepEqual(store.summary().series,[1,2,3,4,5,6]);
  const reloaded=new CatalogStore(dir);await reloaded.init();assert.deepEqual(reloaded.pack,store.pack);
  const before=await fsp.readFile(store.file);assert.throws(()=>store.preview({...pack(),version:900},'import'));assert((await fsp.readFile(store.file)).equals(before));
});
test('single-car quantities preserve all existing vehicles and every non-garage state',{skip:!sample},async()=>{
  const before=await g.inspectGarage(sample),out=await g.patchGarage(sample,{cars:[{id:247,quantity:3}]});
  const after=await g.inspectGarage(out.buffer);assert.equal(after.total,before.total+3);assert.equal(after.counts[247],(before.counts[247]||0)+3);
  const a=p.parse(sample),b=p.parse(out.buffer);assert(sample.subarray(a.binary.start,a.binary.end).equals(out.buffer.subarray(b.binary.start,b.binary.end)));
  const da=await g.open(sample),db=await g.open(out.buffer);try{for(const r of g.rows(da,'SELECT * FROM Career_Garage'))assert.deepEqual(g.rows(db,'SELECT * FROM Career_Garage WHERE Id=?',[r.Id])[0],r);}finally{da.close();db.close();}
});
test('all-cars adds only missing models and a second pass is byte-idempotent',{skip:!sample},async()=>{
  const before=await g.inspectGarage(sample),out=await g.patchGarage(sample,{allCars:true}),after=await g.inspectGarage(out.buffer);
  assert.equal(out.audit.added,before.missing.length);assert.equal(after.missing.length,0);
  assert((await g.patchGarage(out.buffer,{allCars:true})).buffer.equals(out.buffer));
});
test('invalid car IDs, duplicate entries and invalid quantities are rejected',{skip:!sample},async()=>{
  for(const o of [{cars:[{id:999999,quantity:1}]},{cars:[{id:247,quantity:0}]},{cars:[{id:247,quantity:21}]},{cars:[{id:247,quantity:1.5}]},{cars:[{id:247,quantity:1},{id:247,quantity:1}]},{allCars:true,cars:[{id:247,quantity:1}]}])await assert.rejects(()=>g.patchGarage(sample,o));
});
test('garage capacity is enforced before producing an output',{skip:!sample},async()=>{
  await assert.rejects(()=>g.patchGarage(sample,{cars:g.catalog.cars.slice(0,70).map(c=>({id:c.id,quantity:20}))}),/2,000/);
});
test('a newly imported car definition is usable without changing application code',{skip:!sample},async()=>{
  const c=structuredClone(g.catalog.cars[0]);c.id=900001;c.name='SYNTHETIC FUTURE CAR';c.row.CarId=c.id;
  const cars={...g.catalog,cars:[...g.catalog.cars,c]};validatePack({format:'festival-catalog',version:2,resourceBuild:'fixture-only',cars});
  const result=await g.patchGarage(sample,{cars:[{id:c.id,quantity:1}]},cars);assert.equal((await g.inspectGarage(result.buffer,cars)).counts[c.id],1);
});
// Transform the existing QA fixture's S5 into S6, including its statistics keys.
// This simulates a future series; it is not a genuine unreleased game save.
function futureFixture(input){
  const out=Buffer.from(input),f=p.festival(out),ids=f.totals.map(t=>t.id);
  for(const t of f.totals)if(t.id===5)out.writeUInt32LE(6,t.pos-4);
  const first=f.weekPoints.find(w=>w.id===5);out.writeUInt32LE(6,first.pos-12);
  let offset=f.weekPoints.at(-1).pos+4;assert.equal(out.readUInt32LE(offset),ids.length);offset+=4;
  for(let i=0;i<ids.length;i++){if(out.readUInt32LE(offset)===5)out.writeUInt32LE(6,offset);const count=out.readUInt32LE(offset+16);offset+=20+count*8;}
  for(const s of f.events)if(s.id===5)s.id=6;
  const stats=p.parse(out).states.find(s=>s.type==='Stats'),key=Buffer.alloc(8);key.writeBigUInt64LE(p.fnv('5'));for(let i=stats.start;i<stats.end-8;i++)if(out.subarray(i,i+8).equals(key))out.writeBigUInt64LE(p.fnv('6'),i);
  return p.replaceState(out,'FestivalPassSaveState',Buffer.concat([out.subarray(f.state.start,f.eventStart),p.encodeEvents(f.events),out.subarray(f.eventEnd,f.state.end)]));
}
test('new S6 series can be inspected and edited from external catalog data',{skip:!sample},()=>{
  const future=futureFixture(sample),catalog={...p.seasons,weeks:[...p.seasons.weeks,...pack().seasons.weeks]};
  const before=p.inspectSeasons(future,catalog);assert(before.find(w=>w.key==='6:0').available);assert(!before.find(w=>w.key==='5:0').available);
  const out=p.patchSeasons(future,['6:0','6:1','6:2','6:3'],catalog);assert(p.inspectSeasons(out.buffer,catalog).filter(w=>w.series===6).every(w=>w.complete));
  const a=p.parse(future),b=p.parse(out.buffer);assert(future.subarray(a.database.start,a.database.end).equals(out.buffer.subarray(b.database.start,b.database.end)));
});
test('a catalog update does not invent series absent from a player save',{skip:!sample},()=>{
  const catalog={...p.seasons,weeks:[...p.seasons.weeks,...pack().seasons.weeks]};
  assert(p.inspectSeasons(sample,catalog).filter(w=>w.series===6).every(w=>!w.available));assert.throws(()=>p.patchSeasons(sample,['6:0'],catalog),/尚未存在/);
});
test('garage remains usable when the playlist schema is unsupported',{skip:!sample},async()=>{
  const b=Buffer.from(sample),state=p.parse(b).states.find(s=>s.type==='FestivalPassSaveState');b.writeUInt32LE(99,state.start);
  const s=new Service({dataDir:os.tmpdir(),toolPath:'unused'}),r=await s.inspect(b);assert(r.seasonError);assert(r.garage);assert.equal(r.weeks.length,0);
});
module.exports={futureFixture,pack};
