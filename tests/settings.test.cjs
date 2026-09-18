const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {Preferences,resolveLocale}=require('../electron/settings.cjs');
test('first launch follows Chinese system locales and falls back to English',()=>{
 for(const tag of ['zh-CN','zh-TW','zh_HK','zh'])assert.equal(resolveLocale('system',tag),'zh');
 for(const tag of ['en-US','en-GB','de-DE','ja-JP',''])assert.equal(resolveLocale('system',tag),'en');
 assert.equal(resolveLocale('en','zh-CN'),'en');assert.equal(resolveLocale('zh','en-US'),'zh');
});
test('language override survives restart and system mode follows current OS language',async()=>{
 const dir=await fs.mkdtemp(path.resolve(__dirname,'../qa/settings-'));let system='en-US';
 const first=new Preferences(dir,()=>system);assert.equal((await first.init()).preference,'system');
 await first.setLanguage('zh');const restarted=new Preferences(dir,()=>system);assert.equal((await restarted.init()).locale,'zh');
 await restarted.setLanguage('system');system='zh-CN';assert.equal(restarted.current().locale,'zh');system='en-GB';assert.equal(restarted.current().locale,'en');
 await assert.rejects(()=>restarted.setLanguage('../bad'),/无效语言/);assert.equal(restarted.current().preference,'system');
});
