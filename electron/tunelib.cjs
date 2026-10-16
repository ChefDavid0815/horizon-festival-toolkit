const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { SCENARIOS, CLASSES, cleanValues, validBuild } = require('./tuning.cjs');
const LIMIT = 8 * 1024 * 1024;
const text = (v, max) => typeof v === 'string' && v.length <= max;
function validEntry(x) {
  assert(x && typeof x === 'object', '调校记录无效');
  assert(text(x.name, 80) && x.name.trim(), '调校名称无效');
  assert(Number.isInteger(x.carId) && x.carId > 0, '车型编号无效');
  assert(text(x.make, 80) && text(x.car, 80) && (x.year === null || Number.isInteger(x.year)), '车型信息无效');
  assert(x.scenario === null || Object.hasOwn(SCENARIOS, x.scenario), '调校场景无效');
  assert(Number.isInteger(x.classId) && x.classId >= 0 && x.classId < CLASSES.length && (x.pi === null || Number.isInteger(x.pi)), '性能等级无效');
  assert((x.gears === null || (Number.isInteger(x.gears) && x.gears >= 0 && x.gears <= 10)) && Number.isInteger(x.transmission), '变速箱信息无效');
  assert(x.values || x.build, '调校记录为空');
  const values = x.values ? cleanValues(x.values, x.gears ?? 0) : null;
  if (x.meta !== null && x.meta !== undefined) assert(text(x.meta.TuneFileName, 128) && /^[\w.-]*$/.test(x.meta.TuneFileName) && /^[0-9a-f-]{36}$/i.test(x.meta.VersionedTuneId) && (x.meta.VersionedTuneXUID === null || Number.isSafeInteger(x.meta.VersionedTuneXUID)), '调校来源信息无效');
  assert(x.creator === null || x.creator === undefined || /^\d{1,20}$/.test(x.creator), '作者编号无效');
  assert(['own', 'downloaded', 'custom', 'calculator', 'stock', 'linked'].includes(x.origin), '调校来源无效');
  const build = x.build ? validBuild(x.build, x.carId) : null;
  assert(Number.isInteger(x.partsValue) && x.partsValue >= 0 && (x.notes === undefined || text(x.notes, 500)), '记录信息无效');
  return { id: typeof x.id === 'string' && /^[0-9a-f-]{36}$/.test(x.id) ? x.id : randomUUID(), created: typeof x.created === 'string' && !Number.isNaN(Date.parse(x.created)) ? x.created : new Date().toISOString(), name: x.name.trim(), notes: x.notes || '', carId: x.carId, make: x.make, car: x.car, year: x.year, scenario: x.scenario, classId: x.classId, pi: x.pi, gears: x.gears, transmission: x.transmission, values, meta: x.meta || null, creator: x.creator || null, origin: x.origin, build, partsValue: x.partsValue, imported: x.imported === true };
}
const fingerprint = (x) => createHash('sha256').update(JSON.stringify([x.carId, x.values, x.build?.parts])).digest('hex');
class TuneLibrary {
  constructor(dataDir) { this.file = path.join(dataDir, 'tune-library.json'); this.items = []; }
  async init() {
    try {
      const data = JSON.parse(await fs.readFile(this.file, 'utf8'));
      this.items = (Array.isArray(data.items) ? data.items : []).flatMap((x) => { try { return [validEntry(x)]; } catch { return []; } });
    } catch {}
    return this.list();
  }
  list() { return this.items.map(({ values, build, meta, ...x }) => ({ ...x, hasTune: !!values, hasBuild: !!build, tuneLinked: !!meta?.VersionedTuneId && meta.VersionedTuneId !== '00000000-0000-0000-0000-000000000000' })); }
  get(id) { return this.items.find((x) => x.id === id) || null; }
  async save() {
    const body = JSON.stringify({ format: 'festival-tune-library', version: 1, items: this.items });
    assert(Buffer.byteLength(body) <= LIMIT, '调校库超过 8 MB 上限');
    const tmp = this.file + '.' + randomUUID() + '.tmp';
    try { await fs.writeFile(tmp, body, { flag: 'wx' }); await fs.rename(tmp, this.file); } finally { await fs.rm(tmp, { force: true }); }
  }
  async add(entry) {
    assert(this.items.length < 2000, '调校库已满');
    const item = validEntry({ ...entry, id: undefined, created: undefined });
    const same = this.items.find((x) => fingerprint(x) === fingerprint(item));
    if (same) return { item: same, duplicate: true };
    this.items.unshift(item); await this.save(); return { item, duplicate: false };
  }
  async update(id, { name, notes }) {
    const item = this.get(id); assert(item, '调校库中没有这条记录');
    const next = validEntry({ ...item, name: name ?? item.name, notes: notes ?? item.notes });
    Object.assign(item, { name: next.name, notes: next.notes }); await this.save(); return item;
  }
  async remove(id) { const n = this.items.length; this.items = this.items.filter((x) => x.id !== id); assert(this.items.length < n, '调校库中没有这条记录'); await this.save(); }
  pack(ids) {
    const chosen = ids?.length ? this.items.filter((x) => ids.includes(x.id)) : this.items;
    assert(chosen.length, '没有可导出的调校');
    return { format: 'festival-tune-pack', version: 1, exported: new Date().toISOString(), items: chosen.map(({ imported, ...x }) => x) };
  }
  async importFile(file) {
    const st = await fs.stat(file); assert(st.isFile() && st.size <= LIMIT, '调校包大小无效');
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    assert(data && data.format === 'festival-tune-pack' && data.version === 1 && Array.isArray(data.items) && data.items.length <= 500, '不是有效的 Festival 调校包');
    const items = data.items.map((x) => validEntry({ ...x, id: undefined, imported: true }));
    let added = 0;
    for (const item of items) if (!this.items.some((x) => fingerprint(x) === fingerprint(item))) { this.items.unshift(item); added++; }
    assert(this.items.length <= 2000, '调校库已满');
    if (added) await this.save();
    return { added, skipped: items.length - added };
  }
}
module.exports = { TuneLibrary, validEntry };
