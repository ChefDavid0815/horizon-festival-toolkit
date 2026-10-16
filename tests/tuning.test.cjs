const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const p=require('../electron/profile.cjs');
const g=require('../electron/garage.cjs');
const t=require('../electron/tuning.cjs');
const {TuneLibrary}=require('../electron/tunelib.cjs');
const {Community,parseTunes,score,isCommunityUrl}=require('../electron/community.cjs');
const {Service}=require('../electron/service.cjs');
const samplePath=path.resolve(__dirname,'../qa/cli-roundtrip.bin');
const sample=fs.existsSync(samplePath)?fs.readFileSync(samplePath):null;
const field=k=>t.FIELDS.find(f=>f.key===k);
async function pairWithTune(b){const {cars}=await t.readGarage(b),groups=new Map();for(const c of cars){if(!groups.has(c.carId))groups.set(c.carId,[]);groups.get(c.carId).push(c);}
  for(const list of groups.values()){const src=list.find(c=>c.gears),dst=list.find(c=>c!==src&&!c.gears&&c.partsValue===0);if(src&&dst)return {src,dst};}}
test('slider spans decode the saved grid and encode back onto it',()=>{
  assert.equal(t.decode(field('frontTirePressure'),0.272499979).toFixed(1),'25.9');
  assert.equal(t.decode(field('firstGear'),0.668478251).toFixed(2),'4.17');
  assert.equal(t.decode(field('frontCaster'),0.916666687).toFixed(1),'6.5');
  assert.equal(t.decode(field('frontSwaybar'),0.0546876565).toFixed(2),'4.50');
  for(const f of t.FIELDS.filter(f=>!f.carSpecific))for(const v of [0,.25,.5,1])assert(Math.abs(t.encode(f,t.decode(f,v))-v)<1e-9,f.key);
  assert.equal(t.encode(field('frontCamber'),-12),0);assert.equal(t.encode(field('frontCamber'),9),1);
  assert.equal(t.decode(field('frontCamber'),-1),null);
});
test('calculator keeps gearing, follows the drivetrain and stays inside the slider range',()=>{
  const gears=Object.fromEntries(t.FIELDS.map(f=>[f.key,/Gear$/.test(f.key)&&['eighthGear','ninthGear','tenthGear'].includes(f.key)?null:.4]));
  const car={values:gears,stats:{front:56}};
  for(const scenario of Object.keys(t.SCENARIOS))for(const drivetrain of ['RWD','FWD','AWD']){
    const r=t.calculate(car,{scenario,drivetrain,balance:1,stiffness:-1});
    for(const f of t.FIELDS){if(/Gear$|finalDrive/.test(f.key)){assert.equal(r.values[f.key],gears[f.key]);continue;}assert(r.values[f.key]>=0&&r.values[f.key]<=1,`${scenario} ${f.key}`);}
    if(drivetrain==='RWD')assert.equal(r.values.frontAccel,.4);
    if(drivetrain==='FWD')assert.equal(r.values.rearAccel,.4);
  }
  const drift=t.calculate(car,{scenario:'drift',drivetrain:'RWD'}),road=t.calculate(car,{scenario:'road',drivetrain:'RWD'});
  assert(drift.values.rearAccel>road.values.rearAccel&&drift.values.frontCaster>road.values.frontCaster);
  assert.throws(()=>t.calculate({values:null,stats:{}},{scenario:'road'}),/齿轮数量/);
  assert.throws(()=>t.calculate(car,{scenario:'moon'}),/场景/);
  assert.throws(()=>t.calculate(car,{scenario:'road',balance:3}),/微调/);
});
test('garage reading reports tune sources and exact upgrade spending',{skip:!sample},async()=>{
  const r=await t.readGarage(sample),db=await g.open(sample);
  try{assert.equal(r.totals.spent,g.rows(db,'SELECT sum(PricePaid) s FROM Career_PurchasedParts')[0].s);assert.equal(r.totals.cars,g.rows(db,'SELECT count(*) n FROM Career_Garage')[0].n);}finally{db.close();}
  assert(r.cars.every(c=>c.classLabel===t.CLASSES[c.classId]&&(c.pi===null||(c.pi>=100&&c.pi<=999))));
  const tuned=r.cars.find(c=>c.gears),d=await t.carDetail(sample,tuned.id);
  assert.equal(d.values.firstGear>0,true);assert(d.build.length===t.SLOTS.length);assert.equal(d.purchases.reduce((n,x)=>n+x.price,0),d.partsValue);
});
test('same-model tune and build transfer prices new parts and leaves everything else intact',{skip:!sample},async()=>{
  const {src,dst}=await pairWithTune(sample);
  const out=await t.patchTunes(sample,[{garageId:dst.id,source:{kind:'garage',garageId:src.id},tune:true,build:true}]);
  const a=await t.carDetail(out.buffer,dst.id),s=await t.carDetail(sample,src.id);
  assert.deepEqual(a.values,s.values);assert.equal(a.partsValue,out.audit.totalCost);assert.equal(a.classId,s.classId);
  assert.equal(out.audit.cars[0].cost,a.purchases.reduce((n,x)=>n+x.price,0));
  for(const slot of a.build)assert.equal(slot.part,s.build.find(x=>x.col===slot.col).part);
  const before=await g.open(sample),after=await g.open(out.buffer);
  try{for(const r of g.rows(before,'SELECT * FROM Career_Garage WHERE Id<>?',[dst.id]))assert.deepEqual(g.rows(after,'SELECT * FROM Career_Garage WHERE Id=?',[r.Id])[0],r);
    const x=g.rows(before,'SELECT * FROM Career_Garage WHERE Id=?',[dst.id])[0],y=g.rows(after,'SELECT * FROM Career_Garage WHERE Id=?',[dst.id])[0];for(const k of ['Guid','OriginalOwner','DistanceDriven','LiveryFileName','WheelStyle','CarId'])assert.deepEqual(y[k],x[k]);}
  finally{before.close();after.close();}
  const pa=p.parse(sample),pb=p.parse(out.buffer);assert(sample.subarray(pa.binary.start,pa.binary.end).equals(out.buffer.subarray(pb.binary.start,pb.binary.end)));
  const dry=await t.patchTunes(sample,[{garageId:dst.id,source:{kind:'garage',garageId:src.id},tune:true,build:true}],{dryRun:true});assert(!dry.buffer);assert.equal(dry.audit.totalCost,out.audit.totalCost);
});
test('calculator, manual and reset writes only touch tuning columns',{skip:!sample},async()=>{
  const {cars}=await t.readGarage(sample),car=cars.find(c=>c.gears&&c.gears<8);
  const out=await t.patchTunes(sample,[{garageId:car.id,source:{kind:'calculator'},options:{scenario:'dirt',drivetrain:'AWD'}}]);
  const d=await t.carDetail(out.buffer,car.id),before=await t.carDetail(sample,car.id);
  assert.equal(d.values.firstGear,before.values.firstGear);assert.equal(d.values.frontTirePressure,t.encode(field('frontTirePressure'),25));assert.equal(d.partsValue,before.partsValue);assert.equal(d.source.tuneId,null);
  const manual=await t.patchTunes(sample,[{garageId:car.id,source:{kind:'manual'},values:{frontCamber:.4}}]);assert.equal((await t.carDetail(manual.buffer,car.id)).values.frontCamber,.4);
  await assert.rejects(()=>t.patchTunes(sample,[{garageId:car.id,source:{kind:'manual'},values:{frontCamber:1.4}}]),/调校参数无效/);
  await assert.rejects(()=>t.patchTunes(sample,[{garageId:car.id,source:{kind:'manual'},values:{credits:1}}]),/未知调校参数/);
  await assert.rejects(()=>t.patchTunes(sample,[{garageId:car.id,source:{kind:'calculator'},options:{scenario:'road'},build:true}]),/只修改调校参数/);
  const reset=await t.patchTunes(sample,[{garageId:car.id,source:{kind:'reset'}}]),r=await t.carDetail(reset.buffer,car.id);assert.equal(r.values,null);assert.equal(r.tune,'stock');
  const stock=cars.find(c=>!c.gears);await assert.rejects(()=>t.patchTunes(sample,[{garageId:stock.id,source:{kind:'calculator'},options:{scenario:'road'}}]),/齿轮数量/);
});
test('transfers across models, gearboxes or duplicate targets are refused',{skip:!sample},async()=>{
  const {cars}=await t.readGarage(sample),tuned=cars.filter(c=>c.gears),other=cars.find(c=>c.carId!==tuned[0].carId);
  await assert.rejects(()=>t.patchTunes(sample,[{garageId:other.id,source:{kind:'garage',garageId:tuned[0].id}}]),/同一车型/);
  await assert.rejects(()=>t.patchTunes(sample,[{garageId:tuned[0].id,source:{kind:'reset'}},{garageId:tuned[0].id,source:{kind:'reset'}}]),/同一辆车/);
  await assert.rejects(()=>t.patchTunes(sample,[{garageId:999999,source:{kind:'reset'}}]),/没有目标车辆/);
  const {src,dst}=await pairWithTune(sample),db=await g.open(sample);
  try{const s=g.rows(db,'SELECT Transmission FROM Career_Garage WHERE Id=?',[src.id])[0],d=g.rows(db,'SELECT Transmission FROM Career_Garage WHERE Id=?',[dst.id])[0];
    if(s.Transmission!==d.Transmission)await assert.rejects(()=>t.patchTunes(sample,[{garageId:dst.id,source:{kind:'garage',garageId:src.id},tune:true}]),/变速箱不同/);}finally{db.close();}
});
test('library captures real builds, rejects foreign parts and round-trips through a pack',{skip:!sample},async()=>{
  const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'festival-tunes-')),lib=new TuneLibrary(dir);await lib.init();
  const {src,dst}=await pairWithTune(sample),entry=await t.capture(sample,src.id,{build:true});
  const {item}=await lib.add(entry);assert(item.build&&item.values);assert((await lib.add(entry)).duplicate);
  const out=await t.patchTunes(sample,[{garageId:dst.id,source:{kind:'library',id:item.id},tune:true,build:true}],{library:lib});
  assert.deepEqual((await t.carDetail(out.buffer,dst.id)).values,item.values);
  const bad=structuredClone(entry);bad.build.parts.CarBody=(entry.carId+1)*1000;await assert.rejects(()=>lib.add(bad),/不属于这款车/);
  const file=path.join(dir,'pack.json');await fsp.writeFile(file,JSON.stringify(lib.pack()));
  const other=new TuneLibrary(await fsp.mkdtemp(path.join(os.tmpdir(),'festival-tunes-')));await other.init();
  assert.deepEqual(await other.importFile(file),{added:1,skipped:0});assert.deepEqual(await other.importFile(file),{added:0,skipped:1});
  const reloaded=new TuneLibrary(dir);await reloaded.init();assert.equal(reloaded.list().length,1);
  await fsp.writeFile(file,JSON.stringify({format:'festival-tune-pack',version:1,items:[{...entry,values:{...entry.values,frontCamber:7}}]}));await assert.rejects(()=>other.importFile(file),/调校参数无效/);
});
test('service exposes tuning only for a connected save and previews without writing',{skip:!sample},async()=>{
  const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'festival-tuning-service-')),s=new Service({dataDir:dir,toolPath:'unused',testRoot:dir});await s.init();
  await assert.rejects(()=>s.tuningGarage(),/先连接/);
  s.session={plain:Buffer.from(sample)};const {cars}=await s.tuningGarage(),car=cars.find(c=>c.gears);
  const calc=await s.tuningCalc(car.id,{scenario:'snow',drivetrain:'AWD'});assert(calc.changed.length>10);
  const preview=await s.tuningPreview([{garageId:car.id,source:{kind:'calculator'},options:{scenario:'snow',drivetrain:'AWD'}}]);assert.equal(preview.totalCost,0);assert(s.session.plain.equals(sample));
  const saved=await s.librarySaveCalc(car.id,{scenario:'snow',drivetrain:'AWD'});assert.equal(saved.items[0].origin,'calculator');assert.equal(s.libraryGet(saved.item.id).values.frontTirePressure,calc.values.frontTirePressure);
  const inspected=await s.inspect(sample);assert.equal(inspected.tuning.cars,cars.length);
});
test('community pages parse share codes and only codmunity car pages are reachable',async()=>{
  const html='<div class="fz-tuning"><div class="fz-tuning-playstyle">Road</div><span class="fz-tuning-class-label">A</span><span class="fz-tuning-class-value">700</span><button type="button" class="fz-tuning-sharecode"><span>200 551 659</span></button><span class="fz-tuning-stat-label">Tune By</span><span class="fz-tuning-stat-value">Some &amp; One</span></div><article class="fz-community-tuning"><span class="fz-tuning-playstyle">Drift (AWD)</span><button type="button" class="fz-tuning-sharecode"><span>798732249</span></button><div class="fz-community-meta"><span>X<!-- --> 999</span><span>AWD</span></div></article><article class="fz-community-tuning"><button type="button" class="fz-tuning-sharecode"><span>12</span></button></article>';
  const tunes=parseTunes(html);assert.equal(tunes.length,2);assert.deepEqual([tunes[0].shareCode,tunes[0].author,tunes[0].pi,tunes[1].drive,tunes[1].classLabel],['200551659','Some & One',700,'AWD','X']);
  assert(score({name:'Miata',year:1994},{slug:'mx-5-miata-1994'})>score({name:'Miata',year:1994},{slug:'mx-5-miata-forza-edition-1994'}));
  assert(isCommunityUrl('https://codmunity.gg/forza/car/silvia-ks-1989'));for(const u of ['https://codmunity.gg/admin','http://codmunity.gg/forza','https://evil.example/forza','https://codmunity.gg/forza/car/../x'])assert(!isCommunityUrl(u));
  const calls=[],dir=await fsp.mkdtemp(path.join(os.tmpdir(),'festival-community-'));
  const c=new Community({dataDir:dir,fetcher:async url=>{calls.push(url);const body=url.endsWith('manufacturers')?'<a href="/forza/manufacturer/nissan">Nissan</a>':url.includes('/manufacturer/')?'<a href="/forza/car/silvia-ks-1989">Silvia</a><a href="/forza/car/silvia-ks-1994">Silvia</a>':html;return new Response(body,{status:200});}});await c.init();
  const r=await c.search({make:'Nissan',name:'SilviaKs',year:1989});assert.equal(r.candidates[0].slug,'silvia-ks-1989');
  assert.equal((await c.tunes('silvia-ks-1989')).tunes.length,2);await c.tunes('silvia-ks-1989');assert.equal(calls.length,3);
  await assert.rejects(()=>c.tunes('../admin'),/地址无效/);await assert.rejects(()=>c.page('/admin',1),/地址无效/);
});
