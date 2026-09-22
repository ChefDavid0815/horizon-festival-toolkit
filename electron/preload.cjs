const { contextBridge, ipcRenderer } = require("electron");
const invoke = async (name, ...args) => {
  const r = await ipcRenderer.invoke(name, ...args);
  if (!r.ok) throw Error(r.error);
  return r.data;
};
contextBridge.exposeInMainWorld("festival", {
  state: () => invoke("state"),
  checkRelease: ()=>invoke('checkRelease'),
  openRelease: ()=>invoke('openRelease'),
  onReleaseChecked: fn=>{const cb=(_e,data)=>fn(data);ipcRenderer.on('releaseChecked',cb);return ()=>ipcRenderer.removeListener('releaseChecked',cb);},
  setLanguage: (value) => invoke("language", value),
  contentSettings: value=>invoke('contentSettings',value),
  syncCatalog: ()=>invoke('syncCatalog'),
  chooseGame: ()=>invoke('chooseGame'),
  importCatalog: ()=>invoke('importCatalog'),
  exportCatalog: ()=>invoke('exportCatalog'),
  onContentUpdated: fn=>{const cb=(_e,data)=>fn(data);ipcRenderer.on('contentUpdated',cb);return ()=>ipcRenderer.removeListener('contentUpdated',cb);},
  scan: () => invoke("scan"),
  load: (p) => invoke("load", p),
  choose: () => invoke("choose"),
  apply: (o) => invoke("apply", o),
  restore: (id) => invoke("restore", id),
  backups: () => invoke("backups"),
  openBackups: () => invoke("openBackups"),
  onProgress: (fn) => {
    const cb = (_e, data) => fn(data);
    ipcRenderer.on("progress", cb);
    return () => ipcRenderer.removeListener("progress", cb);
  },
});
