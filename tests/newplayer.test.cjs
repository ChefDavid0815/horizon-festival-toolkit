const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const p=require('../electron/profile.cjs');
const g=require('../electron/progression.cjs');
const {decode}=require('../electron/resources.cjs');
const samplePath=path.resolve(__dirname,'../qa/cli-roundtrip.bin');
const sample=fs.existsSync(samplePath)?fs.readFileSync(samplePath):null;
// A newer save: few activity kinds per playlist week.
function fewTypes(input){
  const f=p.festival(input);for(const s of f.events)for(const w of s.weeks)w.types=w.types.slice(0,3);
  return p.replaceState(input,'FestivalPassSaveState',Buffer.concat([input.subarray(f.state.start,f.eventStart),p.encodeEvents(f.events),input.subarray(f.eventEnd,f.state.end)]));
}
// A newer save: the game has not created points buckets for categories that never earned points.
function withoutBuckets(input,keys){
  const sec=p.parse(input).sections.find(s=>s.tag===0xb60261fc),b=input.subarray(sec.start,sec.end);
  const count=b.readUInt32LE(5),size=b.readUInt32LE(9),width=count>65535?4:count>255?2:1;
  let pos=13;const strings=[];for(let i=0;i<count;i++){const n=b.readUInt16LE(pos);pos+=2;strings.push(b.toString('utf8',pos,pos+n));pos+=n}
  const treeStart=pos+1;pos=treeStart;const str=()=>{const i=b.readUIntLE(pos,width);pos+=width;return strings[i]};
  function node(){const start=pos,flags=b[pos++],tag=str(),a={};let countPos=null;const children=[];if(flags&2){let n=b[pos++];while(n--){const k=str();a[k]=str()}}if(flags&4){countPos=pos;let n=b.readUInt16LE(pos);pos+=2;while(n--)children.push(node())}return {start,end:pos,tag,a,children,countPos}}
  const root=node(),keyOf=n=>n.children.find(c=>c.tag==='key')?.a.value;
  const doomed=root.children.filter(c=>keys.includes(keyOf(c)));assert.equal(doomed.length,keys.length);
  let tree=Buffer.from(b.subarray(treeStart));tree.writeUInt16LE(root.children.length-doomed.length,root.countPos-treeStart);
  for(const d of doomed.sort((x,y)=>y.start-x.start))tree=Buffer.concat([tree.subarray(0,d.start-treeStart),tree.subarray(d.end-treeStart)]);
  const section=Buffer.concat([b.subarray(0,treeStart),tree]),out=Buffer.concat([input.subarray(0,sec.start),section,input.subarray(sec.end)]);
  out.writeUInt32LE(section.length,sec.header+4);p.parse(out);return out;
}
const bucketTotals=b=>{const sec=p.parse(b).sections.find(s=>s.tag===0xb60261fc),out={};(function walk(n){if(n.tag==='map_element'){const k=n.children.find(c=>c.tag==='key')?.a.value;if(/^CurrencyBucket_/.test(k||''))out[k]=n.children.find(c=>c.tag==='value').children.find(c=>c.a.id==='Total')?.a.value}n.children.forEach(walk)})(decode(b.subarray(sec.start,sec.end)));return out};
test('playlist is located in a save with few activity kinds per week and stays editable',{skip:!sample},()=>{
  const few=fewTypes(sample),a=p.festival(sample),b=p.festival(few);
  assert.equal(b.eventStart,a.eventStart);assert(b.events.every(s=>s.weeks.every(w=>w.types.length<=3)));
  assert.equal(p.inspectSeasons(few).filter(w=>w.available).length,20);
  const out=p.patchSeasons(few,['5:1']);assert(p.inspectSeasons(out.buffer).find(w=>w.key==='5:1').complete);
});
test('playlist errors name the failed check',{skip:!sample},()=>{
  const catalog=structuredClone(p.seasons);catalog.weeks.find(w=>w.key==='5:0').maxPoints++;catalog.weeks.find(w=>w.key==='5:0').events[0].points++;
  assert.throws(()=>p.festival(sample,catalog),/积分与内容目录不一致/);
  const f=p.festival(sample),broken=Buffer.from(sample);broken.writeUInt32LE(0xffffffff,f.eventStart);
  assert.throws(()=>p.festival(broken),/未能在存档中定位季节赛数据/);
  const futureOnly={...p.seasons,weeks:p.seasons.weeks.map(w=>({...w,series:w.series+100,key:`${w.series+100}:${w.week}`}))};
  assert.equal(p.inspectSeasons(sample,futureOnly).filter(w=>w.available).length,0,'unknown series are read but not offered');
});
test('journal reads a save without category buckets and creates them on write',{skip:!sample},()=>{
  const keys=['CurrencyBucket_CollectionCategoryProgress_cc_drift_attack','CurrencyBucket_CollectionCategoryProgress_cc_brio_rivals'];
  const young=withoutBuckets(sample,keys),parsed=g.parseCollections(young);
  assert.equal(g.inspectProgression(young).collectionError,null);
  const drift=parsed.categories.find(c=>c.bucket==='cc_drift_attack');assert(drift.bucketMissing&&drift.points===0);
  const item=drift.items.find(i=>i.available&&!i.complete),campaign=parsed.campaigns.find(c=>c.categories.includes(drift.id));
  const before=bucketTotals(young),out=g.patchProgression(young,{items:[item.id]}),after=g.parseCollections(out.buffer),totals=bucketTotals(out.buffer);
  const fresh=after.categories.find(c=>c.id===drift.id);assert(!fresh.bucketMissing);assert.equal(fresh.points,item.points);
  assert.equal(after.campaigns.find(c=>c.key===campaign.key).points,campaign.points+item.points);
  for(const [k,v]of Object.entries(before))if(k!==`CurrencyBucket_${campaign.currency}_${campaign.bucket}`)assert.equal(totals[k],v,k);
  assert.equal(totals[keys[0]],String(item.points));assert.equal(totals[keys[1]],undefined,'untouched missing bucket stays absent');
  const a=p.parse(young),z=p.parse(out.buffer);for(const s of a.sections)if(s.tag!==0xb60261fc&&s!==a.binary)assert(young.subarray(s.start,s.end).equals(out.buffer.subarray(z.sections.find(x=>x.tag===s.tag).start,z.sections.find(x=>x.tag===s.tag).end)));
  for(const s of a.states)if(s.type!=='CollectionCampaignSaveState')assert(young.subarray(s.start,s.end).equals(out.buffer.subarray(z.states[s.i].start,z.states[s.i].end)),s.type);
  const second=drift.items.find(i=>i.available&&!i.complete&&i.id!==item.id),again=g.patchProgression(out.buffer,{items:[second.id]});
  assert.equal(g.parseCollections(again.buffer).categories.find(c=>c.id===drift.id).points,item.points+second.points);
  assert.equal(Object.keys(bucketTotals(again.buffer)).filter(k=>k===keys[0]).length,1,'bucket is not duplicated');
});
test('journal keeps items added by a game update and locks revised ones',{skip:!sample},()=>{
  // An item the catalog does not know: change one record's ID (and its repeat) to an unseen hash.
  const parsed=g.parseCollections(sample),first=[...parsed.records.values()][0],b=Buffer.from(sample);
  b.writeBigUInt64LE(0x1234567890abcdefn,first.start);b.writeBigUInt64LE(0x1234567890abcdefn,first.start+8);
  const r=g.inspectProgression(b);assert.equal(r.collectionError,null);assert.equal(r.unknownItems.count,1);
  const photo=g.parseCollections(b).categories.find(c=>c.bucket==='cc_photography'),item=photo.items.find(i=>i.available&&!i.complete);
  const out=g.patchProgression(b,{items:[item.id]}),after=g.parseCollections(out.buffer);
  assert.equal(after.categories.find(c=>c.id===photo.id).points,photo.points+item.points);
  assert(b.subarray(first.start,first.end).equals(out.buffer.subarray(after.unknown.get('0x1234567890abcdef').start,after.unknown.get('0x1234567890abcdef').end)),'new item kept byte for byte');
  // A version bump on a known item: shown, counted, but not editable.
  const open=[...parsed.records.values()].find(x=>!x.completed),v=Buffer.from(sample);v.writeUInt32LE(7,open.start+24);
  const revised=g.parseCollections(v),shown=revised.categories.flatMap(c=>c.items).find(i=>i.id===open.id);
  assert(shown.revised&&!shown.available);assert.equal(g.inspectProgression(v).unknownItems.revised,1);
  assert.throws(()=>g.patchProgression(v,{items:[open.id]}),/已被游戏更新修改/);
  // Framing failures still stop editing.
  const state=p.parse(sample).states.find(s=>s.type==='CollectionCampaignSaveState'),c=Buffer.from(sample);c.writeUInt32LE(9,state.start);
  assert.match(g.inspectProgression(c).collectionError,/收藏手册存档结构尚未适配/);
});
