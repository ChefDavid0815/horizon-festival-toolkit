const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const bundledSeasons = require('../data/seasons.json');
const bundledCars = require('../data/cars.json');
const LIMIT = 24 * 1024 * 1024;
const digest = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
function validatePack(pack) {
  assert(pack && pack.format === 'festival-catalog' && pack.version === 2, '不支持的数据包版本');
  assert(typeof pack.resourceBuild === 'string' && pack.resourceBuild.length <= 100, '数据包缺少资源版本');
  assert(pack.seasons || pack.cars, '数据包没有内容');
  if (pack.seasons) {
    const weeks = pack.seasons.weeks;
    assert(Array.isArray(weeks) && weeks.length > 0 && weeks.length <= 2048, '季节目录大小无效');
    const keys = new Set();
    for (const w of weeks) {
      assert(Number.isInteger(w.series) && w.series > 0 && w.series < 10000 && Number.isInteger(w.week) && w.week >= 0 && w.week < 4, '无效系列赛编号');
      assert(w.key === `${w.series}:${w.week}` && !keys.has(w.key), '重复或无效的季节键'); keys.add(w.key);
      assert(typeof w.title === 'string' && w.title.length <= 160 && typeof w.season === 'string' && typeof w.seasonEn === 'string', '季节标题无效');
      assert(Array.isArray(w.events) && w.events.length > 0 && w.events.length <= 1000, '季节活动列表无效');
      const ids = new Set();
      for (const e of w.events) {
        assert([0,1,2,4,5,6,9,10,12,13,14,15,17,18,22].includes(e.type) && /^0x[\da-f]{16}$/i.test(e.id), '活动类型或编号尚未适配');
        const key = `${e.type}:${e.id.toLowerCase()}`; assert(!ids.has(key), '重复的活动编号'); ids.add(key);
        assert(Number.isInteger(e.points) && e.points >= 0 && e.points <= 100, '活动积分无效');
        assert(e.parts === (e.type === 4 ? 7 : e.type === 5 ? 4 : 0), '活动子状态格式无效');
      }
      assert(Number.isInteger(w.maxPoints) && w.maxPoints > 0 && w.maxPoints < 1000 && w.maxPoints === w.events.reduce((n,e) => n + e.points, 0), '活动积分合计不匹配');
    }
  }
  if (pack.cars) {
    assert(Array.isArray(pack.cars.cars) && pack.cars.cars.length > 0 && pack.cars.cars.length <= 10000, '车辆目录大小无效');
    const ids = new Set();
    for (const c of pack.cars.cars) {
      assert(Number.isInteger(c.id) && c.id > 0 && c.id < 10000000 && !ids.has(c.id), '重复或无效的车辆编号'); ids.add(c.id);
      for (const k of ['name','make','media']) assert(typeof c[k] === 'string' && c[k].length > 0 && c[k].length < 160, '车辆名称无效');
      assert(Number.isInteger(c.year) && c.year >= 1800 && c.year <= 3000 && Number.isFinite(c.pi), '车辆参数无效');
      assert(c.row && c.row.CarId === c.id && Number.isInteger(c.row.Engine) && Number.isInteger(c.row.CarBody), '车辆原厂部件缺失');
      assert(Object.keys(c.row).length <= 350, '车辆字段过多');
      for (const [k,v] of Object.entries(c.row)) {
        assert(/^[A-Za-z][A-Za-z0-9_]*$/.test(k) && !['__proto__','constructor','prototype'].includes(k), '无效车辆字段');
        assert(v === null || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 1024), '无效车辆字段值');
      }
    }
  }
  return pack;
}
class CatalogStore {
  constructor(directory) { this.file = path.join(directory,'catalog-v2.json'); this.pack = { format:'festival-catalog', version:2, resourceBuild:bundledSeasons.resourceBuild, seasons:bundledSeasons, cars:bundledCars, source:'bundled', updatedAt:null }; this.warning = null; }
  async init() {
    try { const stat = await fs.stat(this.file); assert(stat.size <= LIMIT); this.pack = validatePack(JSON.parse(await fs.readFile(this.file,'utf8'))); }
    catch (e) { if (e.code !== 'ENOENT') this.warning = '本地目录缓存无效，已使用内置目录'; }
  }
  get seasons() { return this.pack.seasons; }
  get cars() { return this.pack.cars; }
  summary() { return { resourceBuild:this.pack.resourceBuild, source:this.pack.source, updatedAt:this.pack.updatedAt, series:[...new Set(this.seasons.weeks.map(w=>w.series))], weeks:this.seasons.weeks.length, cars:this.cars.cars.length, warning:this.warning, fingerprint:digest({seasons:this.seasons,cars:this.cars}) }; }
  preview(incoming, source) {
    validatePack(incoming);
    const weeks = new Map(this.seasons.weeks.map(w=>[w.key,w]));
    for (const w of incoming.seasons?.weeks || []) weeks.set(w.key,w);
    const cars = new Map(this.cars.cars.map(c=>[c.id,c]));
    for (const c of incoming.cars?.cars || []) cars.set(c.id,c);
    return validatePack({format:'festival-catalog',version:2,resourceBuild:incoming.resourceBuild,source,updatedAt:new Date().toISOString(),
      seasons:{...this.seasons,...incoming.seasons,weeks:[...weeks.values()].sort((a,b)=>a.series-b.series||a.week-b.week)},
      cars:{...this.cars,...incoming.cars,cars:[...cars.values()].sort((a,b)=>a.id-b.id)}});
  }
  async commit(pack) {
    validatePack(pack);
    const temp = this.file + '.' + randomUUID() + '.tmp';
    try { await fs.writeFile(temp,JSON.stringify(pack),{flag:'wx'}); await fs.rename(temp,this.file); }
    finally { await fs.rm(temp,{force:true}); }
    this.pack = pack; this.warning = null;
    return this.summary();
  }
  async readFile(file) { const stat = await fs.stat(file); assert(stat.isFile() && stat.size <= LIMIT,'数据包文件过大'); return validatePack(JSON.parse(await fs.readFile(file,'utf8'))); }
}
module.exports = { CatalogStore, validatePack, digest, LIMIT };
