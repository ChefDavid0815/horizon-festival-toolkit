const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("node:path");
const { Service } = require("./service.cjs");
const { Preferences } = require("./settings.cjs");
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
    progress: (p) => win?.webContents.send("progress", p),
  });
  await service.init();
  const preferences = new Preferences(
    app.getPath("userData"),
    () => app.getPreferredSystemLanguages()[0] || app.getLocale(),
  );
  await preferences.init();
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
    catalog: require("../data/seasons.json"),
    backups: await service.backups(),
    version: app.getVersion(),
    dataDir: app.getPath("userData"),
    language: preferences.current(),
  }));
  handle("language", (value) => preferences.setLanguage(value));
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
});
app.on("window-all-closed", () => app.quit());
