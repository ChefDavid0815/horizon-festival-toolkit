const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  { execFile } = require("node:child_process"),
  { randomUUID } = require("node:crypto");
const profile = require("./profile.cjs");
const garage = require('./garage.cjs');
const { CatalogStore, digest } = require('./catalog.cjs');
const { readResources } = require('./resources.cjs');
const { ArtworkStore } = require('./artwork.cjs');
const TOOL_SHA =
  "4b08e2f42e581281c0409009f8ea53f828a0a23e6633d0b79cdc7585ca705212";
const run = (exe, args, timeout = 180000) =>
  new Promise((resolve, reject) =>
    execFile(
      exe,
      args,
      { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) =>
        error
          ? reject(Error((stderr || stdout || error.message).slice(-1600)))
          : resolve(stdout),
    ),
  );
const exists = (p) =>
  fs
    .access(p)
    .then(() => true)
    .catch(() => false);
class Service {
  constructor({ dataDir, toolPath, progress = () => {}, testRoot = null }) {
    this.dataDir = dataDir;
    this.toolPath = toolPath;
    this.progress = progress;
    this.testRoot = testRoot ? path.resolve(testRoot) : null;
    this.session = null;
    this.busy = false;
    this.catalogs = new CatalogStore(dataDir);
    this.artwork = new ArtworkStore(dataDir);
    this.syncSettings = { gamePath:'', autoSync:false, allowOnline:false };
  }
  checkPath(file) {
    if (this.testRoot) {
      const relative = path.relative(this.testRoot, path.resolve(file));
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
        throw Error("测试模式只能访问隔离目录中的样本");
    }
  }
  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(path.join(this.dataDir, "backups"), { recursive: true });
    if (!this.initialized) {
      await this.catalogs.init();
      await this.artwork.init();
      try { const config=JSON.parse(await fs.readFile(path.join(this.dataDir,'content-settings.json'),'utf8')); if(typeof config.gamePath==='string') this.syncSettings={gamePath:config.gamePath,autoSync:config.autoSync===true,allowOnline:config.allowOnline===true}; } catch {}
      this.initialized=true;
    }
  }
  catalogState() {
    return {catalog:this.catalogs.seasons,cars:this.catalogs.cars.cars.map(({row,...c})=>c),content:this.catalogs.summary(),artwork:this.artwork.view(),syncSettings:this.syncSettings,summary:this.summary()};
  }
  async configureSync(value) {
    return this.exclusive(async()=>{
      if(!value || typeof value.gamePath!=='string' || value.gamePath.length>1024 || (value.gamePath&&!path.isAbsolute(value.gamePath)) || typeof value.autoSync!=='boolean' || typeof value.allowOnline!=='boolean')throw Error('更新设置无效');
      if(value.gamePath)this.checkPath(path.join(value.gamePath,'media','ObjectModelGame.zip'));
      const config={gamePath:value.gamePath,autoSync:value.autoSync,allowOnline:value.allowOnline};
      const file=path.join(this.dataDir,'content-settings.json'),tmp=file+'.'+randomUUID()+'.tmp';
      try{await fs.writeFile(tmp,JSON.stringify(config),{flag:'wx'});await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true});}
      this.syncSettings=config;return config;
    });
  }
  async inspect(plain) {
    let weeks=[],carSummary=null,seasonError=null,garageError=null;
    try{weeks=profile.inspectSeasons(plain,this.catalogs.seasons);}catch(e){seasonError=e.message;}
    try{carSummary=await garage.inspectGarage(plain,this.catalogs.cars);}catch(e){garageError=e.message;}
    if(seasonError&&garageError)throw Error(seasonError+' / '+garageError);
    return {weeks,garage:carSummary,seasonError,garageError};
  }
  async acceptCatalog(incoming,source) {
    const pack=this.catalogs.preview(incoming,source);
    const before=this.catalogs.summary();
    if(digest({seasons:pack.seasons,cars:pack.cars})===before.fingerprint)return {...this.catalogState(),unchanged:true,addedWeeks:0,addedCars:0};
    await this.catalogs.commit(pack);
    if(this.session){try{Object.assign(this.session,await this.inspect(this.session.plain));}catch{this.session=null;}}
    return {...this.catalogState(),addedWeeks:this.catalogs.summary().weeks-before.weeks,addedCars:this.catalogs.summary().cars-before.cars};
  }
  async importCatalog(file) {
    return this.exclusive(async()=>{this.checkPath(file);return this.acceptCatalog(await this.catalogs.readFile(file),'import');});
  }
  async syncCatalog() {
    return this.exclusive(async()=>{
      const {gamePath,allowOnline}=this.syncSettings;
      this.checkPath(path.join(gamePath,'media','ObjectModelGame.zip'));
      const r=await readResources({gamePath,allowOnline,previousCars:this.catalogs.cars,toolPath:this.toolPath,ready:()=>this.ready(),run,tick:(p,m)=>this.tick(p,m)});
      const result=await this.acceptCatalog(r.pack,'game');
      this.tick(92,'读取游戏系列赛封面');
      const artwork=await this.artwork.sync(gamePath,this.catalogs.summary().series);
      this.tick(100,'内容目录已更新');return {...result,artwork,unchanged:!!result.unchanged&&!artwork.changed,carsPending:r.carsPending};
    });
  }
  async exclusive(fn) {
    if (this.busy) throw Error("另一个操作正在进行");
    this.busy = true;
    try {
      return await fn();
    } finally {
      this.busy = false;
    }
  }
  tick(percent, message) {
    this.progress({ percent, message });
  }
  async ready() {
    const b = await fs.readFile(this.toolPath);
    if (profile.sha(b) !== TOOL_SHA)
      throw Error("加解密工具版本或文件校验不符");
  }
  async gameClosed() {
    const text = await run(
      "tasklist.exe",
      ["/FI", "IMAGENAME eq forzahorizon6.exe", "/FO", "CSV", "/NH"],
      15000,
    );
    if (/forzahorizon6\.exe/i.test(text))
      throw Error("请先退出 Forza Horizon 6，再读取或写入存档。");
  }
  async scan() {
    if (this.testRoot) return [];
    const found = [];
    const roots = [
      "C:\\XboxGames\\GameSave\\pgs",
      path.join(os.homedir(), "AppData/Local/ForzaHorizon6"),
      path.join(
        process.env.PUBLIC || "C:\\Users\\Public",
        "Documents/MicrosoftStore/RUNE",
      ),
    ];
    let visited = 0;
    async function walk(dir, depth) {
      if (depth < 0 || visited++ > 7000) return;
      let es;
      try {
        es = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of es) {
        if (e.isSymbolicLink()) continue;
        const p = path.join(dir, e.name);
        if (e.isFile() && e.name === "C_ProfileData") {
          const st = await fs.stat(p);
          found.push({
            path: p,
            size: st.size,
            modified: st.mtime.toISOString(),
            account: (p.match(/User_([^\\/]+)/) || [])[1] || "本地玩家",
          });
        } else if (e.isDirectory() && !/cache|thumbnail|backup/i.test(e.name))
          await walk(p, depth - 1);
      }
    }
    for (const r of roots) await walk(r, 7);
    return found.sort((a, b) => b.modified.localeCompare(a.modified));
  }
  async load(file) {
    return this.exclusive(async () => {
      await this.init();
      await this.gameClosed();
      if (typeof file !== "string" || !path.isAbsolute(file))
        throw Error("请选择本地存档文件");
      this.checkPath(file);
      const info = await fs.lstat(file);
      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size > 128 * 1024 * 1024
      )
        throw Error("存档文件不受支持");
      const input = await fs.readFile(file),
        encrypted = input.readUInt32LE(0) !== 0x4a8bf2b6;
      let plain;
      this.tick(10, "读取存档");
      if (encrypted) {
        await this.ready();
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "festival-read-"));
        try {
          const src = path.join(tmp, "C_ProfileData"),
            out = path.join(tmp, "plain.bin");
          await fs.writeFile(src, input);
          this.tick(25, "解密存档 · ForzaCryptoTool");
          await run(this.toolPath, ["decrypt", src, "-o", out, "--force"]);
          plain = await fs.readFile(out);
        } finally {
          await cleanTemp(tmp);
        }
      } else plain = input;
      this.tick(60, "核对赛季");
      const inspected = await this.inspect(plain);
      const parsed = profile.parse(plain);
      const originalNow = await fs.readFile(file);
      if (!input.equals(originalNow))
        throw Error("读取期间存档发生变化，请重新连接");
      this.session = {
        file,
        plain: Buffer.from(plain),
        encrypted,
        sourceHash: profile.sha(input),
        ...inspected,
        xuid: parsed.states[0].id.toString(),
      };
      this.tick(100, "存档已连接");
      return this.summary();
    });
  }
  summary() {
    if (!this.session) return null;
    const { file, encrypted, sourceHash, weeks, garage, seasonError, garageError, xuid } = this.session;
    return { file, encrypted, sourceHash, weeks, garage, seasonError, garageError, xuid };
  }
  async backups() {
    await this.init();
    const dir = path.join(this.dataDir, "backups"),
      out = [];
    for (const id of await fs.readdir(dir)) {
      try {
        const m = JSON.parse(
          await fs.readFile(path.join(dir, id, "manifest.json"), "utf8"),
        );
        out.push({
          id,
          created: m.created,
          kind: m.kind,
          status: m.status,
          targets: m.targets.map((t) => t.path),
          audit: m.audit,
        });
      } catch {}
    }
    return out.sort((a, b) => b.created.localeCompare(a.created));
  }
  async transaction(targets, bytes, audit, kind = "apply") {
    for (const file of targets) this.checkPath(file);
    const id =
        new Date().toISOString().replace(/[:.]/g, "-") +
        "-" +
        randomUUID().slice(0, 8),
      dir = path.join(this.dataDir, "backups", id);
    await fs.mkdir(dir, { recursive: true });
    const manifest = {
      id,
      created: new Date().toISOString(),
      kind,
      status: "prepared",
      audit,
      targets: [],
    };
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i],
        st = await fs.lstat(p);
      if (st.isSymbolicLink() || !st.isFile())
        throw Error("目标必须是普通文件");
      const original = await fs.readFile(p),
        backup = `${i}.original`;
      await fs.writeFile(path.join(dir, backup), original, { flag: "wx" });
      manifest.targets.push({
        path: p,
        backup,
        before: profile.sha(original),
        after: profile.sha(bytes),
      });
    }
    const save = () =>
      fs.writeFile(
        path.join(dir, "manifest.json"),
        JSON.stringify(manifest, null, 2),
      );
    await save();
    const replaced = [];
    try {
      for (const target of manifest.targets) {
        if (profile.sha(await fs.readFile(target.path)) !== target.before)
          throw Error("写入前发现存档变化");
        const temp = target.path + ".festival-" + randomUUID() + ".tmp";
        const h = await fs.open(temp, "wx");
        try {
          await h.writeFile(bytes);
          await h.sync();
        } finally {
          await h.close();
        }
        try {
          await fs.rename(temp, target.path);
        } catch (e) {
          await fs.rm(temp, { force: true });
          throw e;
        }
        replaced.push(target);
        assertHash(await fs.readFile(target.path), target.after);
        manifest.status = "writing";
        await save();
      }
      manifest.status = "complete";
      await save();
      return { id, dir, manifest };
    } catch (error) {
      for (const t of replaced.reverse()) {
        const original = await fs.readFile(path.join(dir, t.backup));
        await fs.writeFile(t.path, original);
      }
      manifest.status = "rolled-back";
      manifest.error = error.message;
      await save();
      throw error;
    }
  }
  async apply(options = {}) {
    return this.exclusive(async () => {
      if (
        !options ||
        typeof options !== "object" ||
        Object.keys(options).some((k) => !['weeks','cars','allCars'].includes(k))
      )
        throw Error("修改请求无效");
      const { weeks = [], cars = [], allCars = false } = options;
      if (!this.session) throw Error("先连接一个存档");
      if (!Array.isArray(weeks) || !Array.isArray(cars) || typeof allCars!=='boolean' || (!weeks.length && !cars.length && !allCars))
        throw Error("请选择要修改的内容");
      await this.gameClosed();
      const s = this.session;
      assertHash(await fs.readFile(s.file), s.sourceHash);
      let b = Buffer.from(s.plain),
        audit = [];
      this.tick(8, "生成修改副本");
      if (weeks.length) {
        const p = profile.patchSeasons(b, weeks, this.catalogs.seasons);
        b = p.buffer;
        audit.push(p.audit);
      }
      if(cars.length || allCars){const p=await garage.patchGarage(b,{cars,allCars},this.catalogs.cars);b=p.buffer;audit.push(p.audit);}
      const inspected = await this.inspect(b);
      const originalDb = profile.parse(s.plain).database,
        editedDb = profile.parse(b).database;
      if (
        !cars.length && !allCars && !s.plain
          .subarray(originalDb.start, originalDb.end)
          .equals(b.subarray(editedDb.start, editedDb.end))
      )
        throw Error("车库数据库发生变化，已拒绝写入");
      if (b.equals(s.plain)) {
        this.tick(100, "所选内容已经完成，无需修改");
        return { unchanged: true, summary: this.summary(), audit };
      }
      const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "festival-write-"));
      let bytes;
      try {
        const plain = path.join(tmp, "edited.bin");
        await fs.writeFile(plain, b);
        await this.ready();
        this.tick(35, "验证修改后的存档");
        await run(this.toolPath, ["profile-inspect", plain]);
        if (s.encrypted) {
          const output = path.join(tmp, "C_ProfileData"),
            check = path.join(tmp, "check.bin");
          this.tick(50, "重新加密");
          await run(this.toolPath, ["encrypt", plain, "-o", output, "--force"]);
          this.tick(70, "解密回读校验");
          await run(this.toolPath, ["decrypt", output, "-o", check, "--force"]);
          assertHash(await fs.readFile(check), profile.sha(b));
          bytes = await fs.readFile(output);
        } else bytes = b;
        await this.gameClosed();
        assertHash(await fs.readFile(s.file), s.sourceHash);
        const targets = [s.file];
        const copy = s.file + "_SCopy";
        if (path.basename(s.file) === "C_ProfileData" && (await exists(copy)))
          targets.push(copy);
        this.tick(88, "自动备份并写回存档");
        const backup = await this.transaction(targets, bytes, audit);
        this.session = {
          ...s,
          plain: Buffer.from(b),
          sourceHash: profile.sha(bytes),
          ...inspected,
        };
        this.tick(100, "修改已写回，备份已保留");
        return { summary: this.summary(), backupId: backup.id, audit };
      } finally {
        await cleanTemp(tmp);
      }
    });
  }
  async restore(id) {
    return this.exclusive(async () => {
      if (!/^[\w.-]+$/.test(id)) throw Error("无效备份");
      await this.gameClosed();
      const dir = path.join(this.dataDir, "backups", id),
        m = JSON.parse(
          await fs.readFile(path.join(dir, "manifest.json"), "utf8"),
        );
      if (
        !Array.isArray(m.targets) ||
        !m.targets.length ||
        m.targets.length > 2
      )
        throw Error("无效备份记录");
      const loaded = [];
      for (const t of m.targets) {
        this.checkPath(t.path);
        const st = await fs.lstat(t.path);
        if (st.isSymbolicLink() || !st.isFile())
          throw Error("恢复目标必须是普通文件");
        if (!/^\d\.original$/.test(t.backup)) throw Error("无效备份路径");
        const b = await fs.readFile(path.join(dir, t.backup));
        assertHash(b, t.before);
        loaded.push({ target: t.path, b });
      }
      // Make a full recovery snapshot before restoring each original, including a
      // distinct SCopy when the original pair were not byte-identical.
      const restoreId =
          new Date().toISOString().replace(/[:.]/g, "-") +
          "-" +
          randomUUID().slice(0, 8),
        restoreDir = path.join(this.dataDir, "backups", restoreId);
      await fs.mkdir(restoreDir);
      const manifest = {
        id: restoreId,
        created: new Date().toISOString(),
        kind: "restore",
        status: "prepared",
        audit: { restoredFrom: id },
        targets: [],
      };
      for (let i = 0; i < loaded.length; i++) {
        const x = loaded[i],
          current = await fs.readFile(x.target);
        await fs.writeFile(path.join(restoreDir, `${i}.original`), current);
        manifest.targets.push({
          path: x.target,
          backup: `${i}.original`,
          before: profile.sha(current),
          after: profile.sha(x.b),
        });
      }
      const save = () =>
        fs.writeFile(
          path.join(restoreDir, "manifest.json"),
          JSON.stringify(manifest, null, 2),
        );
      await save();
      let written = 0;
      try {
        for (const x of loaded) {
          assertHash(
            await fs.readFile(x.target),
            manifest.targets[written].before,
          );
          const temp = x.target + ".restore-" + randomUUID() + ".tmp";
          await fs.writeFile(temp, x.b, { flag: "wx" });
          try {
            await fs.rename(temp, x.target);
          } catch (e) {
            await fs.rm(temp, { force: true });
            throw e;
          }
          written++;
          assertHash(await fs.readFile(x.target), profile.sha(x.b));
        }
        manifest.status = "complete";
        await save();
      } catch (e) {
        for (let i = 0; i < written; i++)
          await fs.copyFile(
            path.join(restoreDir, `${i}.original`),
            loaded[i].target,
          );
        manifest.status = "rolled-back";
        await save();
        throw e;
      }
      this.session = null;
      return { restored: true, backupId: restoreId };
    });
  }
}
async function cleanTemp(dir) {
  const parent = path.resolve(os.tmpdir()),
    target = path.resolve(dir);
  if (
    path.dirname(target) !== parent ||
    !/^festival-(read|write)-/.test(path.basename(target))
  )
    throw Error("临时目录范围校验失败");
  await fs.rm(target, { recursive: true, force: true });
}
function assertHash(b, h) {
  if (profile.sha(b) !== h)
    throw Error("文件校验不一致，操作已停止；请重新连接存档。");
}
module.exports = { Service, run, TOOL_SHA };
