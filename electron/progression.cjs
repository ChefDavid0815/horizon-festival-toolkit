const assert=require('node:assert/strict');
const profile=require('./profile.cjs');
const catalog=require('../data/progression.json');
const {decode}=require('./resources.cjs');
const itemIndex=new Map(catalog.items.map(i=>[i.id,i]));
const categoryIndex=new Map(catalog.categories.map(c=>[c.id,c]));
const error='此收藏手册存档结构尚未适配，已停止进度编辑。可在“使用说明”中导出诊断信息反馈。';
const versionError='收藏手册存档版本尚未适配，已停止进度编辑。可在“使用说明”中导出诊断信息反馈。';
const knownErrors=new Set([error,versionError]);
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
  assert(state&&state.schema===0x948e86fc,versionError);const r=new Reader(b,state.start,state.end);
  assert(r.u32()===2&&r.u32()===1,error);const count=r.count(10000),records=new Map(),unknown=new Map();
  for(let k=0;k<count;k++){
    // Items added by a game update after this catalog are read by their framing alone and kept exactly as stored.
    const start=r.p,id=r.hash(),repeat=r.hash(),challenge=r.hash(),version=r.u32(),n=r.count(32),item=itemIndex.get(id);
    assert(id===repeat&&!records.has(id)&&!unknown.has(id),error);
    // A known item whose challenge or objectives changed is treated like a new one; a version bump alone marks it revised.
    let matches=!!item&&challenge===item.challenge&&n===item.objectives.length;
    const objectives=[];
    for(let j=0;j<n;j++){
      const id=r.hash(),donePos=r.p,done=r.byte(),type=r.byte(),valuePos=r.p;
      assert([1,2,3,13].includes(type)&&done<=1,error);
      if(matches&&id!==item.objectives[j].id)matches=false;
      const value=type===13?r.byte():r.u32();assert(type!==13||value<=1,error);
      // These are stored objective counters, not float percentage values.
      const def=matches?item.objectives[j]:null;assert(!def||type===13||Number.isSafeInteger(def.threshold)&&def.threshold>=0&&def.threshold<=0xffffffff&&def.comparison==='GreaterThanOrEqual',error);
      objectives.push({id,donePos,done,type,valuePos,value,threshold: type===13?1:def?.threshold??null});
    }
    const enabled=r.byte(),activePos=r.p,active=r.hash(),completedPos=r.p,completed=r.count(100000),pending=r.count(100000),timestampPos=r.p,timestamp=r.hash(),salt=r.u32();
    assert(enabled<=1&&(active==='0x0000000000000000'||objectives.some(o=>o.id===active)),error);
    const record={id,start,end:r.p,objectives,activePos,completedPos,completed,pending,timestampPos,timestamp,salt,revised:matches&&version!==item.version};
    (matches?records:unknown).set(id,record);
  }
  // Preserve photos, reward status and campaign tier state exactly. Validate their framing.
  const photos=r.count(10000);for(let i=0;i<photos;i++){r.hash();r.u32();r.take(r.count(4096)*2)}
  const tiers=[];for(let i=r.count(2);i;i--){const campaign=r.byte();assert(campaign<=1,error);const levels=[];for(let j=r.count(16);j;j--){const level=r.byte(),status=r.byte();assert(level<=15&&status<=2,error);levels.push({level,status})}tiers.push({campaign,levels})}
  assert(r.end-r.p===6,error);r.take(6);
  const xmlSection=parsed.sections.find(s=>s.tag===0xb60261fc);assert(xmlSection,error);
  const xml=decode(b.subarray(xmlSection.start,xmlSection.end)),buckets=maps(xml);
  // The game creates a points bucket only once a category or path earns points, so a newer save may lack some.
  function total(key){if(!buckets.has(key))return 0;const node=property(buckets.get(key),'Total');assert(node?.a.type==='int'&&/^\d+$/.test(node.a.value),error);const n=Number(node.a.value);assert(Number.isSafeInteger(n)&&n<=0x7fffffff,error);return n}
  const categories=catalog.categories.map(c=>{
    const items=c.items.map(id=>{const item=itemIndex.get(id),record=records.get(id);return {...item,available:!!record&&!record.revised,revised:!!record?.revised,complete:!!record?.completed,progress:record?record.objectives.filter(o=>o.done).length:null,objectives:record?.objectives.length??item.objectives.length}});
    const key=`CurrencyBucket_CollectionCategoryProgress_${c.bucket}`;
    const knownPoints=items.reduce((n,i)=>n+(i.complete&&!i.revised?i.points:0),0);
    return {...c,items,points:total(key),knownPoints,bucketMissing:!buckets.has(key),completed:items.filter(i=>i.complete).length,total:items.length};
  });
  const campaigns=catalog.campaigns.map(c=>{const key=`CurrencyBucket_${c.currency}_${c.bucket}`;return {...c,points:total(key),bucketMissing:!buckets.has(key),completed:categories.filter(cat=>c.categories.includes(cat.id)).reduce((n,cat)=>n+cat.completed,0),total:categories.filter(cat=>c.categories.includes(cat.id)).reduce((n,cat)=>n+cat.total,0)}});
  return {state,records,unknown,categories,campaigns,xmlSection,tiers};
}
function parseWristbands(b){const state=profile.parse(b).states.find(s=>s.type==='PlayerWristbandSaveState');assert(state&&state.schema===0xb471534c,error);const r=new Reader(b,state.start,state.end);assert.equal(r.u32(),1,error);const ids=Array.from({length:r.count(8)},()=>r.byte());assert(ids.every(n=>n<=7)&&new Set(ids).size===ids.length&&r.p===r.end,error);return {state,ids}}
function inspectProgression(b){
  let collection=null,collectionError=null,wrist=null,wristbandError=null;
  try{collection=parseCollections(b)}catch(e){collectionError=knownErrors.has(e.message)?e.message:error}
  try{wrist=parseWristbands(b)}catch{wristbandError='此腕带存档结构尚未适配，已停止腕带编辑。'}
  const unknownItems=collection?{count:collection.unknown.size,completed:[...collection.unknown.values()].filter(r=>r.completed).length,revised:[...collection.records.values()].filter(r=>r.revised).length}:null;
  return {campaigns:collection?.campaigns||[],categories:collection?.categories||[],tiers:collection?.tiers||[],unknownItems,wristbands:catalog.wristbands.filter(w=>w.visible).map(w=>({...w,owned:wrist? wrist.ids.includes(w.id):null})),collectionError,wristbandError};
}
// Edit bucket totals in place. A bucket the game has not created yet is inserted by copying an existing
// CurrencyBucket entry as a template, in key order. Strings, flags, node order and unrelated bytes are kept.
function patchBuckets(input,changes,defs=new Map()){
  const section=profile.parse(input).sections.find(s=>s.tag===0xb60261fc),b=input.subarray(section.start,section.end);
  assert(b.toString('ascii',0,4)==='BXML'&&b[4]===2,error);
  const count=b.readUInt32LE(5),size=b.readUInt32LE(9),width=count>65535?4:count>255?2:1;
  let pos=13;const strings=[];for(let i=0;i<count;i++){const n=b.readUInt16LE(pos);pos+=2;strings.push(b.toString('utf8',pos,pos+n));pos+=n}assert(pos===13+size,error);
  const treeStart=pos+1,tree=Buffer.from(b.subarray(treeStart));pos=treeStart;
  const str=()=>{const off=pos,index=b.readUIntLE(pos,width);pos+=width;assert(index<strings.length,error);return {value:strings[index],off}};
  function node(){const start=pos,flags=b[pos++],tag=str().value,a={},offsets={},children=[];let countPos=null;assert((flags&~7)===0,error);if(flags&2){let n=b[pos++];while(n--){const key=str().value,v=str();a[key]=v.value;offsets[key]=v.off}}if(flags&4){countPos=pos;let n=b.readUInt16LE(pos);pos+=2;while(n--)children.push(node())}return {tag,a,offsets,children,start,end:pos,countPos}}
  const root=node();assert(pos===b.length,error);const entries=maps(root),extra=[],at=off=>off-treeStart;
  const index=value=>{let i=strings.indexOf(value);if(i<0){i=strings.length;strings.push(value);const encoded=Buffer.from(value),length=Buffer.alloc(2);length.writeUInt16LE(encoded.length);extra.push(length,encoded)}assert(i<2**(8*width),error);return i};
  const missing=[];let treeOut=tree;
  for(const [key,value]of changes){
    assert(Number.isSafeInteger(value)&&value>=0&&value<=0x7fffffff,error);
    const entry=entries.get(key);
    if(entry){const attr=property(entry,'Total');assert(attr,error);if(attr.a.value!==String(value))tree.writeUIntLE(index(String(value)),at(attr.offsets.value),width);continue}
    if(!value)continue;
    const def=defs.get(key);assert(def&&typeof def.name==='string'&&typeof def.type==='string',error);missing.push({key,value,def});
  }
  if(missing.length){
    const keyOf=n=>n.tag==='map_element'?n.children.find(c=>c.tag==='key')?.a.value:undefined;
    const isBucket=n=>{const v=n.children.find(c=>c.tag==='value');return /^CurrencyBucket_/.test(keyOf(n)||'')&&v?.a.type==='CurrencyBucket'&&v.children.length===3&&['Name','Type','Total'].every((id,i)=>v.children[i].tag==='property'&&v.children[i].a.id===id)};
    let parent=null;(function find(n){if(parent)return;if(n.children.some(isBucket)){parent=n;return}n.children.forEach(find)})(root);
    assert(parent&&parent.countPos!==null,error);
    const template=parent.children.find(isBucket),value=template.children.find(c=>c.tag==='value'),keyNode=template.children.find(c=>c.tag==='key');
    const slot=(n,attr)=>n.offsets[attr]-template.start;
    const keys=parent.children.map(keyOf);assert(keys.every((k,i)=>!i||keys[i-1]<k),error);
    assert(parent.children.length+missing.length<=0xffff,error);
    tree.writeUInt16LE(parent.children.length+missing.length,at(parent.countPos));
    const pieces=missing.map(({key,value:total,def})=>{
      assert(!keys.includes(key),error);
      const bytes=Buffer.from(b.subarray(template.start,template.end));
      bytes.writeUIntLE(index(key),slot(keyNode,'value'),width);
      bytes.writeUIntLE(index(def.name),slot(value.children[0],'value'),width);
      bytes.writeUIntLE(index(def.type),slot(value.children[1],'value'),width);
      bytes.writeUIntLE(index(String(total)),slot(value.children[2],'value'),width);
      const next=parent.children.find(c=>keyOf(c)>key);
      return {offset:at(next?next.start:parent.children.at(-1).end),key,bytes};
    }).sort((x,y)=>y.offset-x.offset||(y.key<x.key?-1:1));
    for(const p of pieces)treeOut=Buffer.concat([treeOut.subarray(0,p.offset),p.bytes,treeOut.subarray(p.offset)]);
  }
  if(!extra.length&&treeOut.equals(b.subarray(treeStart)))return input;
  const added=Buffer.concat(extra),header=Buffer.from(b.subarray(0,13));header.writeUInt32LE(strings.length,5);header.writeUInt32LE(size+added.length,9);
  // The byte before the tree is a format marker, and belongs after the string table.
  const corrected=Buffer.concat([header,b.subarray(13,13+size),added,b.subarray(13+size,treeStart),treeOut]);
  const out=Buffer.concat([input.subarray(0,section.start),corrected,input.subarray(section.end)]);out.writeUInt32LE(corrected.length,section.header+4);profile.parse(out);
  const check=maps(decode(out.subarray(section.start,section.start+corrected.length)));
  for(const [key,value]of changes)if(value||check.has(key))assert.equal(property(check.get(key),'Total')?.a.value,String(value),error);
  return out;
}
function patchProgression(input,{items=[],wristbands=[]}={}){
  assert(Array.isArray(items)&&items.length<=catalog.items.length&&Array.isArray(wristbands)&&wristbands.length<=7&&(items.length||wristbands.length),'请选择要修改的进度');
  assert(new Set(items).size===items.length&&new Set(wristbands).size===wristbands.length,'进度选择存在重复项目');
  let b=Buffer.from(input),changed=0;const changes=new Map(),defs=new Map();
  if(items.length){
    const parsed=parseCollections(b),categoryDelta=new Map(),campaignDelta=new Map();
    const newer=parsed.unknown.size>0||[...parsed.records.values()].some(r=>r.revised),ledger='收藏积分与记录不一致，请在游戏内保存后重新连接。';
    for(const c of parsed.categories)assert(newer?c.points>=c.knownPoints:c.points===c.knownPoints,ledger);
    for(const c of parsed.campaigns){const sum=parsed.categories.filter(x=>c.categories.includes(x.id)).reduce((n,x)=>n+x.points,0);assert(newer?c.points>=sum:c.points===sum,ledger)}
    for(const id of items){const r=parsed.records.get(id),def=itemIndex.get(id);assert(r&&def,'存档中没有此进度项目');if(r.completed)continue;assert(!r.revised,'此项目已被游戏更新修改，暂不支持编辑。');
      assert(r.pending===0,error);
      for(const o of r.objectives){b[o.donePos]=1;if(o.type===13)b[o.valuePos]=1;else b.writeUInt32LE(Math.max(o.value,o.threshold),o.valuePos)}
      b.writeBigUInt64LE(0n,r.activePos);b.writeUInt32LE(1,r.completedPos);
      // Preserve the game's timestamps and reward bookkeeping; no fabricated reward claims.
      const category=categoryIndex.get(def.category),campaign=catalog.campaigns.find(c=>c.categories.includes(category.id));assert(campaign,error);
      categoryDelta.set(category.id,(categoryDelta.get(category.id)||0)+def.points);campaignDelta.set(campaign.key,(campaignDelta.get(campaign.key)||0)+def.points);changed++;
    }
    for(const [id,delta]of categoryDelta){const c=parsed.categories.find(c=>c.id===id),key=`CurrencyBucket_CollectionCategoryProgress_${c.bucket}`;assert(c.knownPoints+delta<=c.max,error);changes.set(key,c.points+delta);defs.set(key,{name:c.bucket,type:'CollectionCategoryProgress'})}
    for(const [id,delta]of campaignDelta){const c=parsed.campaigns.find(c=>c.key===id),key=`CurrencyBucket_${c.currency}_${c.bucket}`,known=parsed.categories.filter(x=>c.categories.includes(x.id)).reduce((n,x)=>n+x.knownPoints,0);assert(known+delta<=c.max,error);changes.set(key,c.points+delta);defs.set(key,{name:c.bucket,type:c.currency})}
    b=patchBuckets(b,changes,defs);
  }
  if(wristbands.length){const {ids}=parseWristbands(b);assert(wristbands.every(n=>Number.isInteger(n)&&n>=1&&n<=7),'未知腕带');const next=[...new Set([...ids,...wristbands])].sort((a,b)=>a-b);if(next.length!==ids.length){const payload=Buffer.alloc(8+next.length);payload.writeUInt32LE(1);payload.writeUInt32LE(next.length,4);Buffer.from(next).copy(payload,8);b=profile.replaceState(b,'PlayerWristbandSaveState',payload)}}
  const after=inspectProgression(b);assert(!items.length||!after.collectionError,error);assert(!wristbands.length||!after.wristbandError,error);
  for(const id of items)assert(after.categories.some(c=>c.items.some(i=>i.id===id&&i.complete)),error);
  for(const id of wristbands)assert(after.wristbands.find(w=>w.id===id)?.owned,error);
  return {buffer:b,audit:{kind:'progression',items,wristbands,changed,points:Object.fromEntries(changes),beforeSha256:profile.sha(input),afterSha256:profile.sha(b),validation:'收藏记录、积分与腕带持有记录已回读；游戏内奖励及解锁未验证'}};
}
module.exports={catalog,parseCollections,parseWristbands,inspectProgression,patchProgression,patchBuckets};
