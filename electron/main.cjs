const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require("electron");
const path = require("node:path");
const { Service } = require("./service.cjs");
const { Preferences } = require("./settings.cjs");
const { ReleaseChecker } = require('./releases.cjs');
const tuning = require('./tuning.cjs');
const { isCommunityUrl } = require('./community.cjs');
let win, service;
if (process.env.FESTIVAL_TEST_DATA)
  app.setPath("userData", process.env.FESTIVAL_TEST_DATA);
const root = path.join(__dirname, "..");
app.whenReady().then(async () => {
  service = new Service({
    dataDir: app.getPath("userData"),
    toolPath: path.join(
      app.isPackaged ? process.resourcesPath : root,
      "tools",
      "ForzaCryptoTool.exe",
    ),
    testRoot: process.env.FESTIVAL_TEST_SCOPE || null,
    version: app.getVersion(),
    progress: (p) => win?.webContents.send("progress", p),
  });
  await service.init();
  const preferences = new Preferences(
    app.getPath("userData"),
    () => app.getPreferredSystemLanguages()[0] || app.getLocale(),
  );
  await preferences.init();
  const releases = new ReleaseChecker({dataDir:app.getPath('userData'),version:app.getVersion()});
  await releases.init();
  win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1120,
    minHeight: 780,
    show: !process.env.FESTIVAL_TEST_HIDDEN,
    backgroundColor: "#e7e7e4",
    title: "Horizon Festival Toolkit",
    icon: path.join(root, "build/icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.on("close", (e) => {
    if (service.busy) e.preventDefault();
  });
  const handle = (name, fn) =>
    ipcMain.handle(name, async (e, ...args) => {
      if (
        e.sender !== win.webContents ||
        e.senderFrame !== win.webContents.mainFrame
      )
        throw Error("无效调用来源");
      try {
        return { ok: true, data: await fn(...args) };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    });
  handle("state", async () => ({
    summary: service.summary(),
    ...service.catalogState(),
    backups: await service.backups(),
    version: app.getVersion(),
    dataDir: app.getPath("userData"),
    language: preferences.current(),
    releases: releases.view(),
    progressionCatalog: require('./progression.cjs').catalog,
    tuningMeta: { fields: tuning.FIELDS, slots: tuning.SLOTS, classes: tuning.CLASSES, scenarios: Object.keys(tuning.SCENARIOS) },
    library: service.libraryList(),
  }));
  handle('tuningGarage', ()=>service.tuningGarage());
  handle('tuningCar', id=>service.tuningCar(id));
  handle('tuningCalc', (id,options)=>service.tuningCalc(id,options));
  handle('tuningPreview', requests=>service.tuningPreview(requests));
  handle('libraryGet', id=>service.libraryGet(id));
  handle('libraryCapture', (id,options)=>service.libraryCapture(id,options));
  handle('librarySaveCalc', (id,options,name)=>service.librarySaveCalc(id,options,name));
  handle('libraryUpdate', (id,value)=>service.libraryUpdate(id,value));
  handle('libraryRemove', id=>service.libraryRemove(id));
  handle('libraryImport', async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Festival tune pack',extensions:['json']}]});return r.canceled?null:service.libraryImport(r.filePaths[0]);});
  handle('libraryExport', async ids=>{if(ids!==undefined&&(!Array.isArray(ids)||ids.length>2000||!ids.every(id=>typeof id==='string')))throw Error('导出请求无效');const r=await dialog.showSaveDialog(win,{defaultPath:'festival-tunes.json',filters:[{name:'Festival tune pack',extensions:['json']}]});return r.canceled?null:service.libraryExport(r.filePath,ids);});
  handle('communitySearch', car=>service.communitySearch(car));
  handle('communityTunes', slug=>service.communityTunes(slug));
  handle('copyShareCode', code=>{if(typeof code!=='string'||!/^\d{9,11}$/.test(code))throw Error('分享码无效');clipboard.writeText(code);return true;});
  handle('openCommunity', url=>{if(!isCommunityUrl(url))throw Error('只能打开社区调校页面');return shell.openExternal(url);});
  handle('checkRelease', ()=>releases.check({force:true}));
  handle('openRelease', ()=>shell.openExternal(releases.openUrl()));
  handle("language", (value) => preferences.setLanguage(value));
  handle('contentSettings', value=>service.configureSync(value));
  handle('syncCatalog', ()=>service.syncCatalog());
  handle('chooseGame', async()=>{const r=await dialog.showOpenDialog(win,{properties:['openDirectory']});return r.canceled?null:r.filePaths[0];});
  handle('importCatalog', async()=>{const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Festival content pack',extensions:['json']}]});return r.canceled?null:service.importCatalog(r.filePaths[0]);});
  handle('exportCatalog', async()=>{const r=await dialog.showSaveDialog(win,{defaultPath:'festival-content-v2.json',filters:[{name:'Festival content pack',extensions:['json']}]});if(r.canceled)return null;service.checkPath(r.filePath);await require('node:fs/promises').writeFile(r.filePath,JSON.stringify(service.catalogs.pack,null,2));return r.filePath;});
  handle("scan", () => service.scan());
  handle("load", (p) => service.load(p));
  handle("apply", (o) => service.apply(o));
  handle("restore", (id) => service.restore(id));
  handle("backups", () => service.backups());
  handle("choose", async () => {
    const r = await dialog.showOpenDialog(win, {
      title:
        preferences.current().locale === "zh"
          ? "选择 FH6 存档 C_ProfileData"
          : "Select FH6 save C_ProfileData",
      properties: ["openFile"],
    });
    return r.canceled ? null : r.filePaths[0];
  });
  handle("openBackups", async () =>
    shell.openPath(path.join(app.getPath("userData"), "backups")),
  );
  await win.loadFile(path.join(root, "dist/index.html"));
  const checkDaily = async()=>{try{const result=await releases.check();if(!win?.isDestroyed())win.webContents.send('releaseChecked',result);}catch{if(!win?.isDestroyed())win.webContents.send('releaseChecked',{...releases.view(),status:'offline',notify:false});}};
  const releaseStart=setTimeout(checkDaily,2500);releaseStart.unref();
  const releaseTimer=setInterval(checkDaily,60*60*1000);releaseTimer.unref();
  win.on('closed',()=>{clearTimeout(releaseStart);clearInterval(releaseTimer);});
  const autoSync=async()=>{try{const result=await service.watchResources();if(result&&(!result.unchanged||result.carsPending||result.detected))win?.webContents.send('contentUpdated',{ok:true,...result});}catch(error){win?.webContents.send('contentUpdated',{ok:false,error:error.message});}};
  setTimeout(autoSync,2000).unref();
  const timer=setInterval(autoSync,60*1000);timer.unref();
  win.on('closed',()=>clearInterval(timer));
});
app.on("window-all-closed", () => app.quit());
