// Extract only the journal's labels and schema references from a local game install.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Zip=require('adm-zip');
const {decode}=require('../electron/resources.cjs'),{fnv,sha}=require('../electron/profile.cjs');
const game=process.argv[2];assert(game,'Pass the local FH6 install directory');
const prop=(n,k)=>n?.children.find(x=>x.tag==='property'&&x.a.id===k),val=(n,k)=>prop(n,k)?.a.value;
const descend=(n,p)=>{const out=[];function walk(x){if(p(x))out.push(x);x.children.forEach(walk)}if(n)walk(n);return out};
const ref=(n,k)=>descend(prop(n,k),x=>x.a.id==='Object')[0]?.a.value;
const objects=new Map();const bytes=fs.readFileSync(path.join(game,'media/ObjectModelGame.zip'));
for(const e of new Zip(bytes).getEntries())if(e.entryName.endsWith('.om.xml')){const o=decode(e.getData()).children.find(x=>x.tag==='object');if(o)objects.set(o.a.id.split('.')[0],o)}
const get=id=>objects.get(fnv(id).toString()), type=t=>[...objects.values()].filter(o=>o.a.type===t), h=id=>'0x'+fnv(id).toString(16).padStart(16,'0');
function strings(locale){const result={};for(const e of new Zip(path.join(game,`media/Stripped/StringTables/${locale}.zip`)).getEntries()){
  if(!/^(CollectionCampaign|CollectionCampaignCategory|CollectionItemChallenge|ChallengeData|ChallengeStatObjective|WristbandConfig|ProgressionThreads)\.str$/.test(e.entryName))continue;
  const b=e.getData();assert(b.readUInt16LE(0)===0x800);const table=start=>{const n=b.readUInt32LE(start+8),base=start+12+n*8,m=new Map();assert(n<100000&&base<=b.length);for(let i=0;i<n;i++){const key=b.readUInt32LE(start+12+i*8),off=base+b.readUInt32LE(start+16+i*8),end=b.indexOf(0,off);assert(end>=off);m.set(key,b.toString('utf8',off,end))}return m};
  const values=table(140),names=table(b.readUInt32LE(136));for(const [k,name]of names){assert(values.has(k));result[e.entryName.replace('.str','')+'.'+name]=values.get(k)}
}return result}
const en=strings('EN'),zh=strings('CHS');const clean=s=>(s||'').replace(/\[(?:highlight|color|colour):([^\]]*)\]/g,'$1').replace(/\[(?:currency|[^\]]*icon[^\]]*)\]/gi,'').replace(/<[^>]*>/g,'').trim();
const label=k=>({en:clean(en[k]||k),zh:clean(zh[k]||en[k]||k)});
const challengeEntries=type('ChallengeDataSet')[0].children[0].children;const challenges=new Map(challengeEntries.map(x=>[x.children[0].a.value,x.children[1]]));
const campaigns=type('CollectionCampaignData').map(o=>({id:o.a.id.split('.')[0],key:val(o,'ProgressBucket')==='cc_discovery'?'discovery':'festival',name:label(val(o,'Name')),max:+val(o,'TotalCurrency'),bucket:val(o,'ProgressBucket'),currency:val(o,'ProgressCurrencyType'),categories:descend(prop(o,'Categories'),x=>x.a.id==='Object').map(x=>h(x.a.value))}));
const categories=type('CollectionCampaignCategoryData').map(o=>{const thread=get(ref(o,'ProgressionThread'));return {id:'0x'+BigInt(o.a.id.split('.')[0]).toString(16).padStart(16,'0'),key:val(o,'EntityName'),name:label(val(o,'DisplayName')),max:+val(o,'Total'),bucket:val(thread,'BucketID'),items:descend(prop(o,'Challenges'),x=>x.a.id==='Key').map(x=>h(x.a.value))}});
const items=type('CollectionItemChallengeDataSet')[0].children[0].children.map(x=>{const guid=x.children[0].a.value,o=x.children[1],c=challenges.get(val(prop(o,'Challenge'),'Key'));assert(c);return {id:h(guid),category:h(val(o,'ParentCategoryId')),challenge:h(val(prop(o,'Challenge'),'Key')),version:+val(c,'DataVersion'),name:label(val(c,'Name')),description:label(val(c,'Description')),points:+val(o,'CampaignProgressReward'),comparison:val(c,'Comparison'),objectives:prop(c,'Objectives').children.map(n=>({id:h(val(n,'Id')),kind:val(n,'ObjectiveType'),threshold:+val(prop(n,'StatsBucket'),'ThresholdValue'),comparison:val(prop(n,'StatsBucket'),'ThresholdComparison')}))}});
for(const c of categories){assert(c.bucket);assert.equal(c.items.length,items.filter(i=>i.category===c.id).length)}
assert.equal(items.length,new Set(items.map(i=>i.id)).size);
const out={format:1,resourceSha256:sha(bytes),campaigns,categories,items,wristbands:type('WristbandConfigMap')[0].children[0].children.map(x=>{const n=x.children[1];return{id:+val(n,'WristbandId'),name:val(n,'WristbandName'),visible:val(n,'Visible')==='True'}})};
fs.writeFileSync(path.join(__dirname,'../data/progression.json'),JSON.stringify(out));console.log({campaigns:campaigns.length,categories:categories.length,items:items.length,sample:categories[0].name});
