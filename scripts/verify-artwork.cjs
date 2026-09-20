const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {ArtworkStore,decodeSwatch}=require('../electron/artwork.cjs');
const {PNG}=require('pngjs');
const root=path.resolve(__dirname,'..');let app;
(async()=>{
  const qa=await fs.mkdtemp(path.join(root,'qa/v2-artwork-'));
  const store=new ArtworkStore(path.join(qa,'user-data'));await store.init();const r=await store.sync(process.argv[2],[1,2,3,4,5]);assert.equal(r.count,5);assert.equal(r.missing.length,0);
  for(const item of Object.values(r.series)){const png=PNG.sync.read(Buffer.from(item.url.split(',')[1],'base64'));assert(png.width>=400&&png.height>=700);}
  const repeated=await store.sync(process.argv[2],[1,2,3,4,5]);assert.equal(repeated.changed,false);
  const reloaded=new ArtworkStore(path.join(qa,'user-data'));await reloaded.init();assert.equal(reloaded.view().count,5);
  assert.throws(()=>decodeSwatch(Buffer.alloc(100)));
  const fallback=await reloaded.sync(path.join(qa,'nonexistent-game'),[1,6]);assert.equal(fallback.missing.length,2);assert(reloaded.view().series[1]);assert(!reloaded.view().series[6]);
  const env={...process.env,FESTIVAL_TEST_DATA:path.join(qa,'user-data'),FESTIVAL_TEST_SCOPE:qa,FESTIVAL_TEST_HIDDEN:'1'};delete env.ELECTRON_RUN_AS_NODE;
  const launch=process.env.FESTIVAL_EXECUTABLE?{executablePath:process.env.FESTIVAL_EXECUTABLE,args:[]}:{args:[root]};app=await electron.launch({...launch,env,timeout:30000});const page=await app.firstWindow();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await expect(page.getByRole('combobox',{name:'Language / 语言'})).toBeEnabled();await page.getByRole('combobox',{name:'Language / 语言'}).selectOption('zh');
  const covers=[];for(let s=1;s<=5;s++){
    await page.getByRole('tab',{name:new RegExp(`S${s}`)}).click();const img=page.getByRole('img',{name:`S${s} 游戏内系列赛封面`});await expect(img).toBeVisible();await expect.poll(()=>img.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);covers.push(await img.getAttribute('src'));
    assert.equal(await page.locator('.week-card img').count(),0,'Season cards were changed');
    if(!process.env.FESTIVAL_EXECUTABLE)await page.screenshot({path:path.join(qa,`series-${s}.png`),animations:'disabled',timeout:60000});
  }
  assert.equal(new Set(covers).size,5);await page.setViewportSize({width:1106,height:744});const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,cardBottom:document.querySelectorAll('.week-card')[3].getBoundingClientRect().bottom,dockTop:document.querySelector('.action-dock').getBoundingClientRect().top}));assert(!layout.overflow&&layout.cardBottom<layout.dockTop);
  await app.close();app=null;assert.deepEqual(errors,[]);
  const report={passed:true,gameCovers:5,uniqueCovers:5,seasonCardsUnchanged:true,cacheRestart:true,noChangeSkipsDecode:true,missingArtKeepsExisting:true,invalidTextureRejected:true,layout,rendererErrors:errors,formalSaveAccess:false,executable:launch.executablePath||'development Electron'};
  await fs.writeFile(path.join(qa,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({qa,...report},null,2));
})().catch(async e=>{console.error(e);if(app)await app.close().catch(()=>{});process.exitCode=1;});
