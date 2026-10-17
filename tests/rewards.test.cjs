const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {fnv}=require('../electron/profile.cjs');
const {rewardsFromObjects}=require('../electron/resources.cjs');
const {validatePack,withRewards}=require('../electron/catalog.cjs');
const {resourceStamp,isGame}=require('../electron/gamepath.cjs');
const {Service}=require('../electron/service.cjs');
const seasons=require('../data/seasons.json');
const prop=(id,value,children=[])=>({tag:'property',a:value===undefined?{id}:{id,value},children});
const ref=(id,guid)=>prop(id,undefined,[prop('LoadOnCreation','True'),prop('Id',undefined,[prop('Domain','zip'),prop('Object',guid)])]);
const object=(guid,type,children)=>[fnv(guid).toString(),{tag:'object',a:{id:`${fnv(guid)}.1`,type},children}];
test('playlist rewards resolve schedule bonuses and event main rewards to car ordinals',()=>{
  const bonus=(key,points,reward)=>({tag:'map_element',a:{},children:[{tag:'key',a:{value:key},children:[]},{tag:'value',a:{},children:[prop('Points',String(points)),ref('Reward',reward)]}]});
  const objects=new Map([
    object('map','FestivalPassBonusMap',[prop('Bonuses',undefined,[bonus('b1',40,'car1'),bonus('b2',20,'spin'),bonus('b3',160,'car2')])]),
    object('car1','OM::CarReward',[prop('Car','3655')]),object('car2','OM::CarReward',[prop('Car','3364')]),object('spin','OM::TombolaReward',[prop('Type','SuperWheelspin')]),
    object('schedule','FestivalPassSchedule',[prop('ImagePath','Game:\\Media\\UI\\Textures\\Data_Bound\\Series7\\FestivalPlaylist\\All\\SerieshistoryPoster.png'),prop('Season2Bonuses',undefined,[{tag:'element',a:{value:'b1'},children:[]},{tag:'element',a:{value:'b2'},children:[]}]),prop('SeriesBonuses',undefined,[{tag:'element',a:{value:'b3'},children:[]}])]),
  ]);
  const r=rewardsFromObjects(objects);
  assert.deepEqual(r.weeks.get('7:1'),[{points:20,type:'TombolaReward',car:null},{points:40,type:'car',car:3655}]);
  assert.equal(r.weeks.has('7:0'),false);assert.deepEqual(r.series[7],[{points:160,type:'car',car:3364}]);
  const event={tag:'object',a:{type:'FestivalPassEventInfo'},children:[ref('MainRewardRef','car1')]};assert.deepEqual(r.event(event),{car:3655});
  assert.equal(r.event({tag:'object',a:{},children:[ref('MainRewardRef','spin')]}),undefined);
});
test('bundled playlist carries rewards and the validator bounds them',()=>{
  assert(seasons.weeks.every(w=>w.rewards?.length===2&&w.rewards.every(r=>r.car>0)));assert.equal(Object.keys(seasons.seriesRewards).length,6);
  const pack=()=>({format:'festival-catalog',version:2,resourceBuild:'t',seasons:structuredClone(seasons)});validatePack(pack());
  for(const mutate of [p=>{p.seasons.weeks[0].rewards[0].car=-1},p=>{p.seasons.weeks[0].rewards[0].extra=1},p=>{p.seasons.weeks[0].rewards=Array(13).fill(p.seasons.weeks[0].rewards[0])},p=>{p.seasons.weeks[0].events.find(e=>e.reward).reward={car:1,note:'x'}},p=>{p.seasons.seriesRewards={abc:[]}}]){const p=pack();mutate(p);assert.throws(()=>validatePack(p));}
  const stale={...structuredClone(seasons),seriesRewards:undefined,weeks:seasons.weeks.map(({rewards,...w})=>({...w,events:w.events.map(({reward,...e})=>e)}))};
  const filled=withRewards(stale);assert.deepEqual(filled.weeks.map(w=>w.rewards),seasons.weeks.map(w=>w.rewards));assert.deepEqual(filled.seriesRewards,seasons.seriesRewards);
  assert.equal(filled.weeks.flatMap(w=>w.events).filter(e=>e.reward).length,seasons.weeks.flatMap(w=>w.events).filter(e=>e.reward).length);
});
test('resource fingerprint follows the game archives and the watcher syncs once per stable change',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'festival-game-')),zip=path.join(dir,'media','ObjectModelGame.zip');
  assert.equal(await resourceStamp(dir),null);assert.equal(await isGame(dir),false);
  await fs.mkdir(path.dirname(zip),{recursive:true});await fs.writeFile(zip,'v1');assert(await isGame(dir));const first=await resourceStamp(dir);assert.match(first,/^2:\d+\|-$/);
  const s=new Service({dataDir:path.join(dir,'state'),toolPath:'unused',testRoot:dir});await s.init();
  assert.equal(await s.watchResources(),null,'test mode never scans drives for a game');
  let syncs=0;s.syncCatalog=async()=>{syncs++;await s.saveSync({...s.syncSettings,resourceStamp:await resourceStamp(dir)});return {unchanged:false};};
  await s.saveSync({gamePath:dir,autoSync:true,allowOnline:false,autoDetected:false,resourceStamp:''});
  assert.deepEqual(await s.watchResources(),{unchanged:false,detected:false});assert.equal(syncs,1);
  assert.equal(await s.watchResources(),null);assert.equal(syncs,1);
  await fs.writeFile(zip,'version two');assert.notEqual(await resourceStamp(dir),first);await s.watchResources();assert.equal(syncs,2);
  await s.saveSync({...s.syncSettings,autoSync:false});await fs.writeFile(zip,'version three!');assert.equal(await s.watchResources(),null);assert.equal(syncs,2);
  const reloaded=new Service({dataDir:path.join(dir,'state'),toolPath:'unused',testRoot:dir});await reloaded.init();assert.equal(reloaded.syncSettings.gamePath,dir);assert.equal(reloaded.syncSettings.autoSync,false);
  await reloaded.configureSync({gamePath:dir,autoSync:true,allowOnline:false});assert.equal(reloaded.syncSettings.resourceStamp,s.syncSettings.resourceStamp,'same folder keeps its fingerprint');
});
