const {test}=require('node:test');
const assert=require('node:assert/strict');
const p=require('../electron/profile.cjs');
// Builds a decrypted save around a synthetic FestivalPassSaveState. No private save is needed.
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b},u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b};
const str=s=>Buffer.concat([u32(Buffer.byteLength(s)),Buffer.from(s)]);
const leaf=v=>Buffer.concat([u32(1),u64(0x949dbe1845545d4dn),u64(v)]);
function save(payload,series){
  const tree=name=>Buffer.concat([u64(p.fnv(name)),u32(series.length),...series.map(id=>Buffer.concat([u64(p.fnv(String(id))),leaf(0)]))]);
  const stats=Buffer.concat([tree('Freeroam/FestivalPass/SeasonsCompleted'),tree('Freeroam/FestivalPass/FestivalPassTotalSeriesProgress'),u64(p.fnv('Freeroam/FestivalPass/CompletedSeriesCount')),leaf(0)]);
  const state=(i,type,schema,body)=>Buffer.concat([str(type),str(type),u32(schema),u32(body.length),body,u32(i)]);
  const binary=Buffer.concat([u32(2),u64(0x0009000000000001n),state(0,'FestivalPassSaveState',0x6efc7e34,payload),state(1,'Stats',1,stats)]);
  const sec=(tag,body)=>Buffer.concat([u32(tag),u32(body.length),body]);
  return Buffer.concat([sec(0x4a8bf2b6,Buffer.alloc(24)),sec(0x986ca5cb,binary),sec(0xa9f1f729,Buffer.concat([Buffer.from('SQLite format 3\0'),Buffer.alloc(84)]))]);
}
// totals: [[series, points]]; weeks: {series: [[week, points]]}; every catalog series gets a maximum.
function playlist({totals,weeks}){
  const ids=[0,...new Set(p.seasons.weeks.map(w=>w.series))],max=s=>p.seasons.weeks.filter(w=>w.series===s).reduce((n,w)=>n+w.maxPoints,0);
  const events=Object.keys(weeks).map(Number).map(id=>({id,weeks:weeks[id].map(([week])=>{
    const defs=p.seasons.weeks.find(w=>w.series===id&&w.week===week)?.events||[{type:11,id:'0x1'}];
    return {week,types:[...new Set(defs.map(d=>d.type))].sort((a,b)=>a-b).map(type=>({type,events:defs.filter(d=>d.type===type).map(d=>type===4||type===5?{id:d.id,parts:Array(d.parts||1).fill(0)}:{id:d.id,status:0,progress:0})}))};
  })}));
  return Buffer.concat([u32(4),u32(0),
    u32(totals.length),...totals.flatMap(([id,v])=>[u32(id),u32(v)]),
    u32(events.length),...events.flatMap(s=>[u32(s.id),u32(weeks[s.id].length),...weeks[s.id].flatMap(([w,v])=>[u32(w),u32(v)])]),
    u32(ids.length),...ids.flatMap(id=>[u32(id),u64(0x42af11aa449a56a8n),u32(max(id)),u32(1),u32(820),u32(0)]),
    u32(0),p.encodeEvents(events),u32(3),Buffer.alloc(200)]);
}
const all=[0,1,2,3],partial=a=>a.map(w=>[w,0]);
// Reported on 0.4.1: a player who entered only Series 1 and 6. Totals exist for five series, week points
// and events for three, maximums for seven. Series 6 holds 2 points, so the tail of the totals list
// (series 2 and 3) also reads as a well-formed two-entry list.
const reported=save(playlist({totals:[[0,0],[1,0],[6,2],[2,0],[3,0]],weeks:{0:[[3,0]],1:partial(all),6:[[0,2],...partial([1,2,3])]}}),[1,6]);
test('playlist with fewer totals and week records than series maximums is located once',()=>{
  const f=p.festival(reported);
  assert.deepEqual(f.totals.map(t=>t.id),[0,1,6,2,3]);assert.deepEqual(f.events.map(s=>s.id),[0,1,6]);assert.equal(f.max.length,7);
  const weeks=p.inspectSeasons(reported);
  assert.deepEqual(weeks.filter(w=>w.available).map(w=>w.key),['1:0','1:1','1:2','1:3','6:0','6:1','6:2','6:3']);
  assert.equal(weeks.find(w=>w.key==='6:0').points,2);
});
test('only entered series are writable and a write keeps the other series and weeks',()=>{
  assert.throws(()=>p.patchSeasons(reported,['2:0']),/尚未存在/);
  const before=p.inspectSeasons(reported),out=p.patchSeasons(reported,['6:1']),after=p.inspectSeasons(out.buffer),f=p.festival(out.buffer);
  assert(after.find(w=>w.key==='6:1').complete);
  for(const w of before.filter(w=>w.key!=='6:1'))assert.deepEqual(after.find(x=>x.key===w.key),w);
  assert.deepEqual(f.totals.map(t=>[t.id,t.value]),[[0,0],[1,0],[6,55],[2,0],[3,0]]);
  assert(p.patchSeasons(out.buffer,['6:1']).buffer.equals(out.buffer));
});
test('older layout with one entry per series in every list still reads',()=>{
  const ids=[0,1,2,3,4,5,6],b=save(playlist({totals:ids.map(id=>[id,0]),weeks:Object.fromEntries(ids.map(id=>[id,partial(all)]))}),ids);
  assert.equal(p.inspectSeasons(b).filter(w=>w.available).length,24);
  assert(p.inspectSeasons(p.patchSeasons(b,['3:2']).buffer).find(w=>w.key==='3:2').complete);
});
