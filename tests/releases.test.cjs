const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {ReleaseChecker,isNewer,normalizeRelease,RELEASES_URL}=require('../electron/releases.cjs');
const release={tag_name:'v0.4.0',html_url:RELEASES_URL+'/tag/v0.4.0',body:'A new stable release',draft:false,prerelease:false};
const setup=async(fetcher,now=()=>new Date(2026,8,22,10))=>new ReleaseChecker({dataDir:await fs.mkdtemp(path.join(os.tmpdir(),'festival-release-test-')),version:'0.3.0',fetcher,now});
test('version ordering is numeric, published version and rejects arbitrary URLs',()=>{
  assert(isNewer('v0.10.0','0.3.0'));assert(!isNewer('v0.2.0','0.3.0'));assert(!isNewer('0.3.0','0.3.0'));assert(!isNewer('0.4.0-beta','0.3.0'));assert(!isNewer('v01.0.0','0.3.0'));
  assert.equal(normalizeRelease({...release,prerelease:true}).prerelease,true);assert.equal(normalizeRelease({...release,draft:true}),null);
  for(const html_url of ['https://evil.example/a','file:///c:/a.exe',RELEASES_URL+'/tag/v0.4.0?x=1'])assert.throws(()=>normalizeRelease({...release,html_url}));
});
test('one request per local day across restarts, a new day rechecks, manual check bypasses daily cache',async()=>{
  let calls=0,now=new Date(2026,8,22,10);const fetcher=async()=>{calls++;return Response.json([release],{headers:{etag:'"test"'}})},checker=await setup(fetcher,()=>now);
  const first=await checker.check();assert(first.notify);assert.equal(calls,1);assert.equal((await checker.check()).notify,false);assert.equal(calls,1);
  const reopened=new ReleaseChecker({dataDir:path.dirname(checker.file),version:'0.3.0',fetcher,now:()=>now});await reopened.init();assert((await reopened.check()).cached);assert.equal(calls,1);
  await reopened.check({force:true});assert.equal(calls,2);now=new Date(2026,8,23,0);assert((await reopened.check()).notify);assert.equal(calls,3);
});
test('concurrent callers share a request; ETag 304 retains release; failed/offline checks stay quiet and preserve cache',async()=>{
  let calls=0,mode='release';const checker=await setup(async(_url,options)=>{calls++;if(mode==='fail')throw Error('Offline');if(mode==='304'){assert.equal(options.headers['If-None-Match'],'"test"');return new Response(null,{status:304})}await new Promise(r=>setTimeout(r,15));return Response.json([release],{headers:{etag:'"test"'}})});
  await Promise.all([checker.check(),checker.check()]);assert.equal(calls,1);
  mode='304';assert((await checker.check({force:true})).available);mode='fail';const failed=await checker.check({force:true});assert.equal(failed.status,'offline');assert.equal(failed.notify,false);assert(failed.available);assert.equal((await checker.check()).notify,false);
});
test('404, malformed responses, rate limits and oversized bodies never produce a new-version prompt',async()=>{
  for(const response of [()=>new Response(null,{status:404}),()=>new Response(null,{status:429}),()=>Response.json([{...release,html_url:'https://evil.example'}]),()=>new Response('x'.repeat(2200000)),()=>Response.json([{...release,tag_name:'v0.2.0',html_url:RELEASES_URL+'/tag/v0.2.0'}])]){
    const c=await setup(async()=>response());const result=await c.check();assert.equal(result.notify,false);
  }
});
test('cached release is compared against the newly installed app version',async()=>{
  const c=await setup(async()=>Response.json([release]));await c.check();const updated=new ReleaseChecker({dataDir:path.dirname(c.file),version:'0.4.0'});await updated.init();assert.equal(updated.view().available,false);
});
