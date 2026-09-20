const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const Zip=require('adm-zip');
const {seasonsFromArchive,carsFromDatabase}=require('../electron/resources.cjs');
const {Service}=require('../electron/service.cjs');
const bundled=require('../data/seasons.json');
const bundledCars=require('../data/cars.json');
const root=path.resolve(__dirname,'..');
(async()=>{
  const game=process.argv[2];if(!game)throw Error('Usage: node scripts/verify-resources.cjs GAME_ROOT [DECRYPTED_GAME_DB]');
  const qa=await fs.mkdtemp(path.join(root,'qa/v2-resources-'));
  const archive=await fs.readFile(path.join(game,'media/ObjectModelGame.zip'));
  const actual=seasonsFromArchive(archive,'test');
  assert.deepEqual(actual.weeks,bundled.weeks);
  const zip=new Zip(archive);let changed=0;
  for(const entry of zip.getEntries()){
    if(!entry.entryName.endsWith('.om.xml'))continue;
    const b=entry.getData(),needle=Buffer.from('Series5');let offset=0,modified=false;
    while((offset=b.indexOf(needle,offset))>=0){b[offset+6]=54;offset+=7;modified=true;}
    if(modified){zip.updateFile(entry.entryName,b);changed++;}
  }
  assert(changed>0);const future=seasonsFromArchive(zip.toBuffer(),'synthetic-S6');assert.equal(future.weeks.filter(w=>w.series===6).length,4);assert.equal(future.weeks.filter(w=>w.series===5).length,0);
  let generatedCars=null;
  if(process.argv[3]){const c=await carsFromDatabase(await fs.readFile(process.argv[3]),'test');assert.deepEqual(c.cars.map(c=>c.id),bundledCars.cars.map(c=>c.id));assert.equal(c.unresolved.length,0);for(const car of c.cars){const stock={...bundledCars.cars.find(c=>c.id===car.id).row,FrontTireAspectRatioOffset:-1,RearTireAspectRatioOffset:-1};assert.deepEqual(car.row,stock);}generatedCars=c.cars.length;}
  const isolated=path.join(qa,'game');await fs.mkdir(path.join(isolated,'media/Stripped'),{recursive:true});
  await fs.writeFile(path.join(isolated,'media/ObjectModelGame.zip'),archive);await fs.copyFile(path.join(game,'media/Stripped/gamedbRC.slt'),path.join(isolated,'media/Stripped/gamedbRC.slt'));
  const service=new Service({dataDir:path.join(qa,'state'),testRoot:qa,toolPath:'not-used'});await service.init();
  await service.configureSync({gamePath:isolated,autoSync:true,allowOnline:false});
  const sync=await service.syncCatalog();assert.equal(sync.catalog.weeks.length,20);assert.equal(sync.cars.length,647);assert.equal(sync.carsPending,false);
  const repeat=await service.syncCatalog();assert.equal(repeat.unchanged,true);
  await fs.writeFile(path.join(isolated,'media/ObjectModelGame.zip'),zip.toBuffer());const newContent=await service.syncCatalog();assert.equal(newContent.catalog.weeks.length,24);assert.equal(newContent.addedWeeks,4);
  const restarted=new Service({dataDir:path.join(qa,'state'),testRoot:qa,toolPath:'not-used'});await restarted.init();assert.equal(restarted.syncSettings.autoSync,true);assert.equal(restarted.catalogs.seasons.weeks.length,24);
  const report={passed:true,liveLocalArchive:true,knownWeeks:actual.weeks.length,generatedCars,syntheticFutureSeries:6,syntheticFutureWeeks:4,offlineSync:true,unchangedSyncPreservesSelections:true,persistentSettings:true,formalSaveAccess:false,onlineCryptoTested:false};
  await fs.writeFile(path.join(qa,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({qa,...report},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
