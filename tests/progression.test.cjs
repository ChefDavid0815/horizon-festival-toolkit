const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const profile=require('../electron/profile.cjs'),p=require('../electron/progression.cjs'),{decode}=require('../electron/resources.cjs');
const sample=fs.readFileSync(require('node:path').join(__dirname,'../qa/cli-roundtrip.bin'));
function preserve(before,after,allowed){const a=profile.parse(before),b=profile.parse(after);for(const s of a.states){if(allowed.includes(s.type))continue;const t=b.states.find(t=>t.type===s.type);assert(before.subarray(s.start,s.end).equals(after.subarray(t.start,t.end)),s.type)}assert(before.subarray(a.database.start,a.database.end).equals(after.subarray(b.database.start,b.database.end)))}
const xml=b=>{const s=profile.parse(b).sections.find(s=>s.tag===0xb60261fc);return decode(b.subarray(s.start,s.end))};
test('real isolated sample resolves 38 categories, 2833 items and exact currency ledgers without changing bytes',()=>{
  const hash=profile.sha(sample),r=p.inspectProgression(sample);assert.equal(r.collectionError,null);assert.equal(r.wristbandError,null);assert.equal(r.categories.length,38);assert.equal(r.categories.reduce((n,c)=>n+c.total,0),2833);
  for(const c of r.categories)assert.equal(c.points,c.items.reduce((n,i)=>n+(i.complete?i.points:0),0));
  for(const c of r.campaigns)assert.equal(c.points,r.categories.filter(x=>c.categories.includes(x.id)).reduce((n,x)=>n+x.points,0));assert.equal(profile.sha(sample),hash);
});
test('single item updates only that journal record and its category/campaign currency',()=>{
  const before=p.inspectProgression(sample),category=before.categories.find(c=>c.key==='photography_category'),item=category.items.find(i=>!i.complete),result=p.patchProgression(sample,{items:[item.id]}),after=p.inspectProgression(result.buffer);
  preserve(sample,result.buffer,['CollectionCampaignSaveState']);assert.equal(after.categories.find(c=>c.id===category.id).points,category.points+item.points);
  const a=p.parseCollections(sample),b=p.parseCollections(result.buffer);for(const [id,r]of a.records){if(id===item.id)continue;const s=b.records.get(id);assert(sample.subarray(r.start,r.end).equals(result.buffer.subarray(s.start,s.end)),id)}
  const oldXml=xml(sample),newXml=xml(result.buffer);function strip(n){if(n.tag==='map_element'&&n.children.some(c=>c.tag==='key'&&Object.hasOwn(result.audit.points,c.a.value))){const total=n.children.find(c=>c.tag==='value').children.find(c=>c.a.id==='Total');total.a.value='CHANGED'}n.children.forEach(strip)}strip(oldXml);strip(newXml);assert.deepEqual(oldXml,newXml);
});
test('complete category, complete path and complete all are exact and idempotent',()=>{
  for(const items of [p.catalog.categories.find(c=>c.key==='photography_category').items,p.catalog.items.filter(i=>p.catalog.campaigns.find(c=>c.key==='discovery').categories.includes(i.category)).map(i=>i.id),p.catalog.items.map(i=>i.id)]){
    const r=p.patchProgression(sample,{items});assert(p.patchProgression(r.buffer,{items}).buffer.equals(r.buffer));preserve(sample,r.buffer,['CollectionCampaignSaveState']);
    const data=p.inspectProgression(r.buffer);for(const id of items)assert(data.categories.some(c=>c.items.some(i=>i.id===id&&i.complete)));
    if(items.length===2833)assert(data.campaigns.every(c=>c.points===c.max&&c.completed===c.total));
  }
});
test('wristband insertion supports partial inventories, preserves other states and does not duplicate colours',()=>{
  const payload=Buffer.from([1,0,0,0,2,0,0,0,0,1]),partial=profile.replaceState(sample,'PlayerWristbandSaveState',payload);
  const r=p.patchProgression(partial,{wristbands:[2,3,4,5,6,7]});assert(p.inspectProgression(r.buffer).wristbands.every(w=>w.owned));preserve(partial,r.buffer,['PlayerWristbandSaveState']);assert(p.patchProgression(r.buffer,{wristbands:[7]}).buffer.equals(r.buffer));assert(xml(partial)&&JSON.stringify(xml(partial))===JSON.stringify(xml(r.buffer)));
});
test('unsupported schema, wrong objective hashes, bad currency and malformed requests fail before mutation',()=>{
  const selected=p.catalog.items.map(i=>i.id),hash=profile.sha(sample);for(const req of [{items:['invalid']},{items:[selected[0],selected[0]]},{wristbands:[8]},{items:[],wristbands:[]}])assert.throws(()=>p.patchProgression(sample,req));
  const s=profile.parse(sample).states.find(s=>s.type==='CollectionCampaignSaveState');for(const offset of [s.start,s.start+12,s.start+44]){const b=Buffer.from(sample);b[offset]^=1;const h=profile.sha(b);assert.throws(()=>p.patchProgression(b,{items:selected}));assert.equal(profile.sha(b),h)}
  const bad=p.patchBuckets(sample,new Map([['CurrencyBucket_DiscoveryCollectionCampaignProgress_cc_discovery',1]]));assert.throws(()=>p.patchProgression(bad,{items:selected}),/积分与记录不一致/);assert.equal(profile.sha(sample),hash);
});
test('binary state framing contains complete payloads and sequential record indexes',()=>{const parsed=profile.parse(sample);for(const s of parsed.states){assert.equal(s.end-s.start,sample.readUInt32LE(s.sizeOffset));assert.equal(sample.readUInt32LE(s.end),s.i)}assert.equal(parsed.states.at(-1).end+4,parsed.binary.end)});
