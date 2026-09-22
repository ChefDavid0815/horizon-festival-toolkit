const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const REPO = 'ChefDavid0815/horizon-festival-toolkit';
const RELEASES_URL = `https://github.com/${REPO}/releases`;
function versionParts(value) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  return match ? match.slice(1).map(Number) : null;
}
function isNewer(candidate, current) {
  const a=versionParts(candidate), b=versionParts(current);
  if (!a || !b || [...a,...b].some(n=>!Number.isSafeInteger(n))) return false;
  for(let i=0;i<3;i++) if(a[i]!==b[i]) return a[i]>b[i];
  return false;
}
function normalizeRelease(data) {
  if(!data || data.draft || !versionParts(data.tag_name)) return null;
  const url = `${RELEASES_URL}/tag/${encodeURIComponent(data.tag_name)}`;
  if(data.html_url !== url) throw Error('更新地址校验失败');
  return { tag:data.tag_name, version:data.tag_name.replace(/^v/,''), prerelease:data.prerelease===true, name:String(data.name||data.tag_name).slice(0,180), notes:String(data.body||'').slice(0,8000), url, publishedAt: typeof data.published_at==='string'?data.published_at:null };
}
function dayKey(date) { return [date.getFullYear(),date.getMonth()+1,date.getDate()].join('-'); }
class ReleaseChecker {
  constructor({dataDir,version,fetcher=(...args)=>fetch(...args),now=()=>new Date()}) {
    this.file=path.join(dataDir,'release-check.json'); this.version=version; this.fetcher=fetcher;this.now=now;this.saved={};this.pending=null;
  }
  async init(){try{const data=JSON.parse(await fs.readFile(this.file,'utf8'));if(data && typeof data==='object')this.saved=data;}catch{}return this.view();}
  view(){
    let release=null;
    try{if(this.saved.release) release=normalizeRelease(this.saved.release);}catch{}
    return {currentVersion:this.version,release,available:!!release&&isNewer(release.tag,this.version),checkedAt:this.saved.checkedAt||null,status:this.saved.status||'idle',releasesUrl:RELEASES_URL};
  }
  async save(){await fs.mkdir(path.dirname(this.file),{recursive:true});const tmp=this.file+'.'+randomUUID()+'.tmp';try{await fs.writeFile(tmp,JSON.stringify(this.saved,null,2),{flag:'wx'});await fs.rename(tmp,this.file);}finally{await fs.rm(tmp,{force:true});}}
  check({force=false}={}) {
    if(this.pending)return this.pending;
    this.pending=this.perform(force).finally(()=>{this.pending=null;});return this.pending;
  }
  async perform(force){
    const now=this.now(), day=dayKey(now);
    if(!force&&this.saved.attemptDay===day)return {...this.view(),cached:true,notify:false};
    this.saved.attemptDay=day;await this.save();
    try{
      const headers={Accept:'application/vnd.github+json','User-Agent':`Horizon-Festival-Toolkit/${this.version}`,'X-GitHub-Api-Version':'2022-11-28'};
      if(this.saved.etag&&this.saved.release)headers['If-None-Match']=this.saved.etag;
      const response=await this.fetcher(`https://api.github.com/repos/${REPO}/releases?per_page=100`,{headers,signal:AbortSignal.timeout(12000),redirect:'error'});
      if(response.status!==304){
        if(!response.ok)throw Error(`GitHub ${response.status}`);
        // Bound remote release text before parsing it or passing it to the renderer.
        const reader=response.body.getReader();let size=0;const chunks=[];
        try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024)throw Error('Release response too large');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
        const list=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!Array.isArray(list)||list.length>100)throw Error('Invalid release list');
        let raw=null;for(const candidate of list){if(normalizeRelease(candidate)&&(!raw||isNewer(candidate.tag_name,raw.tag_name)))raw=candidate;}
        this.saved.release=raw?{tag_name:raw.tag_name,html_url:raw.html_url,name:String(raw.name||'').slice(0,180),body:String(raw.body||'').slice(0,8000),published_at:raw.published_at,draft:false,prerelease:raw.prerelease===true}:null;
        this.saved.etag=response.headers.get('etag');
      }
      this.saved.checkedAt=now.toISOString();this.saved.status='ok';await this.save();
      const result=this.view();return {...result,cached:false,notify:result.available};
    }catch(error){this.saved.status='offline';await this.save();return {...this.view(),cached:false,notify:false,error:'暂时无法连接 GitHub，请稍后重试。'};}
  }
  openUrl(){const result=this.view();return result.available?result.release.url:RELEASES_URL;}
}
module.exports={ReleaseChecker,isNewer,normalizeRelease,dayKey,RELEASES_URL};
