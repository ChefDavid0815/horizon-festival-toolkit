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
  tuningGarage: () => invoke("tuningGarage"),
  tuningCar: (id) => invoke("tuningCar", id),
  tuningCalc: (id, options) => invoke("tuningCalc", id, options),
  tuningPreview: (requests) => invoke("tuningPreview", requests),
  libraryGet: (id) => invoke("libraryGet", id),
  libraryCapture: (id, options) => invoke("libraryCapture", id, options),
  librarySaveCalc: (id, options, name) => invoke("librarySaveCalc", id, options, name),
  libraryUpdate: (id, value) => invoke("libraryUpdate", id, value),
  libraryRemove: (id) => invoke("libraryRemove", id),
  libraryImport: () => invoke("libraryImport"),
  libraryExport: (ids) => invoke("libraryExport", ids),
  communitySearch: (car) => invoke("communitySearch", car),
  communityTunes: (slug) => invoke("communityTunes", slug),
  openCommunity: (url) => invoke("openCommunity", url),
  copyShareCode: (code) => invoke("copyShareCode", code),
  onProgress: (fn) => {
    const cb = (_e, data) => fn(data);
    ipcRenderer.on("progress", cb);
    return () => ipcRenderer.removeListener("progress", cb);
  },
});
