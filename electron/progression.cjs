const assert=require('node:assert/strict');
const profile=require('./profile.cjs');
const catalog=require('../data/progression.json');
const {decode}=require('./resources.cjs');
const itemIndex=new Map(catalog.items.map(i=>[i.id,i]));
const categoryIndex=new Map(catalog.categories.map(c=>[c.id,c]));
const error='此收藏手册存档结构尚未适配，已停止进度编辑。';
class Reader {
  constructor(b,start,end){this.b=b;this.p=start;this.end=end;}
  take(n){assert(n>=0&&this.p+n<=this.end,error);const p=this.p;this.p+=n;return p;}
  byte(){return this.b[this.take(1)]}
  u32(){return this.b.readUInt32LE(this.take(4))}
  hash(){return '0x'+this.b.readBigUInt64LE(this.take(8)).toString(16).padStart(16,'0')}
  count(max){const n=this.u32();assert(n<=max,error);return n}
}
const property=(node,id)=>node?.children.find(x=>x.tag==='property'&&x.a.id===id);
function maps(root){const result=new Map();function visit(n){if(n.tag==='map_element'){const key=n.children.find(c=>c.tag==='key')?.a.value,value=n.children.find(c=>c.tag==='value');if(key&&(/^(CurrencyBucket_|progression_thread_)/.test(key))){assert(!result.has(key),error);result.set(key,value)}}n.children.forEach(visit)}visit(root);return result}
function parseCollections(b){
  const parsed=profile.parse(b),state=parsed.states.find(s=>s.type==='CollectionCampaignSaveState');
  assert(state&&state.schema===0x948e86fc,error);const r=new Reader(b,state.start,state.end);
  assert(r.u32()===2&&r.u32()===1,error);const count=r.count(10000),records=new Map();
  for(let k=0;k<count;k++){
    const start=r.p,id=r.hash(),repeat=r.hash(),challenge=r.hash(),version=r.u32(),n=r.count(32),item=itemIndex.get(id);
    assert(item&&id===repeat&&challenge===item.challenge&&version===item.version&&n===item.objectives.length&&!records.has(id),error);
    const objectives=[];
    for(let j=0;j<n;j++){
      const id=r.hash(),donePos=r.p,done=r.byte(),type=r.byte(),valuePos=r.p;
      assert([1,2,3,13].includes(type)&&done<=1&&id===item.objectives[j].id,error);
      const value=type===13?r.byte():r.u32();assert(type!==13||value<=1,error);
      // These are stored objective counters, not float percentage values.
      const def=item.objectives[j];assert(type===13||Number.isSafeInteger(def.threshold)&&def.threshold>=0&&def.threshold<=0xffffffff&&def.comparison==='GreaterThanOrEqual',error);
      objectives.push({id,donePos,done,type,valuePos,value,threshold: type===13?1:def.threshold});
    }
    const enabled=r.byte(),activePos=r.p,active=r.hash(),completedPos=r.p,completed=r.count(100000),pending=r.count(100000),timestampPos=r.p,timestamp=r.hash(),salt=r.u32();
    assert(enabled<=1&&(active==='0x0000000000000000'||objectives.some(o=>o.id===active)),error);
    records.set(id,{id,start,end:r.p,objectives,activePos,completedPos,completed,pending,timestampPos,timestamp,salt});
  }
  // Preserve photos, reward status and campaign tier state exactly. Validate their framing.
  const photos=r.count(10000);for(let i=0;i<photos;i++){r.hash();r.u32();r.take(r.count(4096)*2)}
  const tiers=[];for(let i=r.count(2);i;i--){const campaign=r.byte();assert(campaign<=1,error);const levels=[];for(let j=r.count(16);j;j--){const level=r.byte(),status=r.byte();assert(level<=15&&status<=2,error);levels.push({level,status})}tiers.push({campaign,levels})}
  assert(r.end-r.p===6,error);r.take(6);
  const xmlSection=parsed.sections.find(s=>s.tag===0xb60261fc);assert(xmlSection,error);
  const xml=decode(b.subarray(xmlSection.start,xmlSection.end)),buckets=maps(xml);
  function total(key){const node=property(buckets.get(key),'Total');assert(node?.a.type==='int'&&/^\d+$/.test(node.a.value),error);const n=Number(node.a.value);assert(Number.isSafeInteger(n)&&n<=0x7fffffff,error);return n}
  const categories=catalog.categories.map(c=>{
    const items=c.items.map(id=>{const item=itemIndex.get(id),record=records.get(id);return {...item,available:!!record,complete:!!record?.completed,progress:record?record.objectives.filter(o=>o.done).length:null,objectives:record?.objectives.length??item.objectives.length}});
    const points=total(`CurrencyBucket_CollectionCategoryProgress_${c.bucket}`);
    return {...c,items,points,completed:items.filter(i=>i.complete).length,total:items.length};
  });
  const campaigns=catalog.campaigns.map(c=>({...c,points:total(`CurrencyBucket_${c.currency}_${c.bucket}`),completed:categories.filter(cat=>c.categories.includes(cat.id)).reduce((n,cat)=>n+cat.completed,0),total:categories.filter(cat=>c.categories.includes(cat.id)).reduce((n,cat)=>n+cat.total,0)}));
  return {state,records,categories,campaigns,xmlSection,tiers};
}
function parseWristbands(b){const state=profile.parse(b).states.find(s=>s.type==='PlayerWristbandSaveState');assert(state&&state.schema===0xb471534c,error);const r=new Reader(b,state.start,state.end);assert.equal(r.u32(),1,error);const ids=Array.from({length:r.count(8)},()=>r.byte());assert(ids.every(n=>n<=7)&&new Set(ids).size===ids.length&&r.p===r.end,error);return {state,ids}}
function inspectProgression(b){
  let collection=null,collectionError=null,wrist=null,wristbandError=null;
  try{collection=parseCollections(b)}catch{collectionError=error}
  try{wrist=parseWristbands(b)}catch{wristbandError='此腕带存档结构尚未适配，已停止腕带编辑。'}
  return {campaigns:collection?.campaigns||[],categories:collection?.categories||[],tiers:collection?.tiers||[],wristbands:catalog.wristbands.filter(w=>w.visible).map(w=>({...w,owned:wrist? wrist.ids.includes(w.id):null})),collectionError,wristbandError};
}
// Change only selected attribute references in BXML. Keep original strings, flags,
// node order, unrelated attributes and payload bytes; append new string values.
function patchBuckets(input,changes){
  const section=profile.parse(input).sections.find(s=>s.tag===0xb60261fc),b=input.subarray(section.start,section.end);
  assert(b.toString('ascii',0,4)==='BXML'&&b[4]===2,error);
  const count=b.readUInt32LE(5),size=b.readUInt32LE(9),width=count>65535?4:count>255?2:1;
  let pos=13;const strings=[];for(let i=0;i<count;i++){const n=b.readUInt16LE(pos);pos+=2;strings.push(b.toString('utf8',pos,pos+n));pos+=n}assert(pos===13+size,error);
  const treeStart=pos+1,tree=Buffer.from(b.subarray(treeStart));pos=treeStart;
  const str=()=>{const off=pos,index=b.readUIntLE(pos,width);pos+=width;assert(index<strings.length,error);return {value:strings[index],off}};
  function node(){const flags=b[pos++],tag=str().value,a={},offsets={},children=[];assert((flags&~7)===0,error);if(flags&2){let n=b[pos++];while(n--){const key=str().value,v=str();a[key]=v.value;offsets[key]=v.off}}if(flags&4){let n=b.readUInt16LE(pos);pos+=2;while(n--)children.push(node())}return {tag,a,offsets,children}}
  const root=node();assert(pos===b.length,error);const entries=maps(root),extra=[];
  for(const [key,value]of changes){const attr=property(entries.get(key),'Total');assert(attr&&Number.isSafeInteger(value)&&value>=0&&value<=0x7fffffff,error);if(attr.a.value===String(value))continue;let index=strings.indexOf(String(value));if(index<0){index=strings.length;strings.push(String(value));const encoded=Buffer.from(String(value)),length=Buffer.alloc(2);length.writeUInt16LE(encoded.length);extra.push(length,encoded)}assert(strings.length<2**(8*width),error);tree.writeUIntLE(index,attr.offsets.value-treeStart,width)}
  if(!extra.length&&tree.equals(b.subarray(treeStart)))return input;
  const added=Buffer.concat(extra),header=Buffer.from(b.subarray(0,13));header.writeUInt32LE(strings.length,5);header.writeUInt32LE(size+added.length,9);
  // The byte before the tree is a format marker, and belongs after the string table.
  const corrected=Buffer.concat([header,b.subarray(13,13+size),added,b.subarray(13+size,treeStart),tree]);
  const out=Buffer.concat([input.subarray(0,section.start),corrected,input.subarray(section.end)]);out.writeUInt32LE(corrected.length,section.header+4);profile.parse(out);return out;
}
function patchProgression(input,{items=[],wristbands=[]}={}){
  assert(Array.isArray(items)&&items.length<=catalog.items.length&&Array.isArray(wristbands)&&wristbands.length<=7&&(items.length||wristbands.length),'请选择要修改的进度');
  assert(new Set(items).size===items.length&&new Set(wristbands).size===wristbands.length,'进度选择存在重复项目');
  let b=Buffer.from(input),changed=0;const changes=new Map();
  if(items.length){
    const parsed=parseCollections(b),categoryDelta=new Map(),campaignDelta=new Map();
    for(const c of parsed.categories)assert(c.points===c.items.reduce((n,i)=>n+(i.complete?i.points:0),0),'收藏积分与记录不一致，请在游戏内保存后重新连接。');
    for(const c of parsed.campaigns)assert(c.points===parsed.categories.filter(x=>c.categories.includes(x.id)).reduce((n,x)=>n+x.points,0),'收藏积分与记录不一致，请在游戏内保存后重新连接。');
    for(const id of items){const r=parsed.records.get(id),def=itemIndex.get(id);assert(r&&def,'存档中没有此进度项目');if(r.completed)continue;
      assert(r.pending===0,error);
      for(const o of r.objectives){b[o.donePos]=1;if(o.type===13)b[o.valuePos]=1;else b.writeUInt32LE(Math.max(o.value,o.threshold),o.valuePos)}
      b.writeBigUInt64LE(0n,r.activePos);b.writeUInt32LE(1,r.completedPos);
      // Preserve the game's timestamps and reward bookkeeping; no fabricated reward claims.
      const category=categoryIndex.get(def.category),campaign=catalog.campaigns.find(c=>c.categories.includes(category.id));assert(campaign,error);
      categoryDelta.set(category.id,(categoryDelta.get(category.id)||0)+def.points);campaignDelta.set(campaign.key,(campaignDelta.get(campaign.key)||0)+def.points);changed++;
    }
    for(const [id,delta]of categoryDelta){const c=parsed.categories.find(c=>c.id===id);assert(c.points+delta<=c.max,error);changes.set(`CurrencyBucket_CollectionCategoryProgress_${c.bucket}`,c.points+delta)}
    for(const [key,delta]of campaignDelta){const c=parsed.campaigns.find(c=>c.key===key);assert(c.points+delta<=c.max,error);changes.set(`CurrencyBucket_${c.currency}_${c.bucket}`,c.points+delta)}
    b=patchBuckets(b,changes);
  }
  if(wristbands.length){const {ids}=parseWristbands(b);assert(wristbands.every(n=>Number.isInteger(n)&&n>=1&&n<=7),'未知腕带');const next=[...new Set([...ids,...wristbands])].sort((a,b)=>a-b);if(next.length!==ids.length){const payload=Buffer.alloc(8+next.length);payload.writeUInt32LE(1);payload.writeUInt32LE(next.length,4);Buffer.from(next).copy(payload,8);b=profile.replaceState(b,'PlayerWristbandSaveState',payload)}}
  const after=inspectProgression(b);assert(!items.length||!after.collectionError,error);assert(!wristbands.length||!after.wristbandError,error);
  for(const id of items)assert(after.categories.some(c=>c.items.some(i=>i.id===id&&i.complete)),error);
  for(const id of wristbands)assert(after.wristbands.find(w=>w.id===id)?.owned,error);
  return {buffer:b,audit:{kind:'progression',items,wristbands,changed,points:Object.fromEntries(changes),beforeSha256:profile.sha(input),afterSha256:profile.sha(b),validation:'收藏记录、积分与腕带持有记录已回读；游戏内奖励及解锁未验证'}};
}
module.exports={catalog,parseCollections,parseWristbands,inspectProgression,patchProgression,patchBuckets};
