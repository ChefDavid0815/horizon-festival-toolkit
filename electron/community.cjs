const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const BASE = 'https://codmunity.gg';
const DAY = 24 * 60 * 60 * 1000;
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#x27': "'", nbsp: ' ' };
const clean = (s) => String(s).replace(/<!--.*?-->/g, '').replace(/<[^>]*>/g, '').replace(/&(#?\w+);/g, (m, e) => entities[e.toLowerCase()] ?? m).replace(/\s+/g, ' ').trim();
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const words = (s) => String(s).replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/([0-9])([A-Za-z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
function links(html, kind) {
  const out = new Map(), re = new RegExp(`href="/forza/${kind}/([a-z0-9-]{1,120})"[^>]*>([^<]{1,120})<`, 'g');
  for (const m of html.matchAll(re)) if (!out.has(m[1])) out.set(m[1], clean(m[2]));
  return [...out].map(([slug, name]) => ({ slug, name }));
}
// CODMunity renders tunes server-side; only share codes and summary stats are public, the settings stay on Forza servers.
function parseTunes(html) {
  const tunes = [];
  for (const chunk of html.split('<div class="fz-tuning">').slice(1)) {
    const code = /fz-tuning-sharecode">\s*<span>([\d ]{9,13})<\/span>/.exec(chunk);
    if (!code) continue;
    const stats = {};
    for (const m of chunk.matchAll(/fz-tuning-stat-label">([^<]+)<\/span>\s*<span class="fz-tuning-stat-value">([^<]*)</g)) stats[clean(m[1]).toLowerCase()] = clean(m[2]);
    tunes.push({ kind: 'featured', shareCode: code[1].replace(/\s/g, ''), playstyle: clean(/fz-tuning-playstyle">([^<]+)</.exec(chunk)?.[1] || ''), classLabel: clean(/fz-tuning-class-label">([^<]+)</.exec(chunk)?.[1] || ''), pi: Number(/fz-tuning-class-value">(\d+)</.exec(chunk)?.[1]) || null, author: stats['tune by'] || null, stats: { speed: stats.speed, braking: stats.braking, offroad: stats.offroad, launch: stats.launch, handling: stats.handling, top: stats['top speed'], zeroToSixty: stats['0-60 mph'] } });
  }
  for (const chunk of html.split('<article class="fz-community-tuning">').slice(1)) {
    const code = /fz-tuning-sharecode">\s*<span>([\d ]{9,13})<\/span>/.exec(chunk);
    if (!code) continue;
    const meta = [...chunk.slice(chunk.indexOf('fz-community-meta')).matchAll(/<span>(.*?)<\/span>/g)].map((m) => clean(m[1])).filter(Boolean);
    tunes.push({ kind: 'community', shareCode: code[1].replace(/\s/g, ''), playstyle: clean(/fz-tuning-playstyle">([^<]+)</.exec(chunk)?.[1] || ''), drive: meta.find((m) => /^(AWD|RWD|FWD)$/.test(m)) || null, classLabel: /^(D|C|B|A|S1|S2|R|X)\b/.exec(meta.find((m) => /^(D|C|B|A|S1|S2|R|X)\b/.test(m)) || '')?.[1] || '', pi: null, author: null, stats: {} });
  }
  const seen = new Set();
  return tunes.filter((t) => /^\d{9,11}$/.test(t.shareCode) && !seen.has(t.shareCode) && seen.add(t.shareCode)).slice(0, 80);
}
function score(car, candidate) {
  const year = Number(/-(\d{4})$/.exec(candidate.slug)?.[1]), base = candidate.slug.replace(/-\d{4}$/, '');
  const a = norm(car.name), b = norm(base), mine = words(car.name), theirs = base.split('-');
  let s = year === car.year ? 4 : Math.abs(year - car.year) === 1 ? 1 : -4;
  if (a && a === b) s += 6; else if (a && (b.includes(a) || a.includes(b))) s += 3;
  s += 3 * mine.filter((w) => theirs.some((t) => t === w || (w.length > 2 && t.startsWith(w)))).length / Math.max(mine.length, 1);
  if (/forza-edition/.test(candidate.slug)) s -= /fe|forza/i.test(car.media || '') ? -1 : 1;
  return s;
}
class Community {
  constructor({ dataDir, version = '0', fetcher = (...a) => fetch(...a), now = () => Date.now() }) {
    this.file = path.join(dataDir, 'community-cache.json'); this.version = version; this.fetcher = fetcher; this.now = now; this.cache = { pages: {} };
  }
  async init() { try { const d = JSON.parse(await fs.readFile(this.file, 'utf8')); if (d && typeof d.pages === 'object') this.cache = d; } catch {} }
  async persist() { const tmp = this.file + '.' + randomUUID() + '.tmp'; try { await fs.writeFile(tmp, JSON.stringify(this.cache), { flag: 'wx' }); await fs.rename(tmp, this.file); } finally { await fs.rm(tmp, { force: true }); } }
  async page(route, ttl) {
    assert(/^\/forza\/(manufacturers|manufacturer\/[a-z0-9-]{1,80}|car\/[a-z0-9-]{1,120})$/.test(route), '社区地址无效');
    const hit = this.cache.pages[route];
    if (hit && this.now() - hit.at < ttl) return hit.data;
    const response = await this.fetcher(BASE + route, { headers: { 'User-Agent': `Horizon-Festival-Toolkit/${this.version} (+https://github.com/ChefDavid0815/horizon-festival-toolkit)`, Accept: 'text/html' }, signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok) throw Error(response.status === 404 ? '社区站点没有这款车的页面' : `社区站点暂时不可用 (${response.status})`);
    const reader = response.body.getReader(); let size = 0; const chunks = [];
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 4 * 1024 * 1024) throw Error('社区页面过大'); chunks.push(Buffer.from(value)); } } finally { await reader.cancel().catch(() => {}); }
    const html = Buffer.concat(chunks).toString('utf8');
    const data = route === '/forza/manufacturers' ? links(html, 'manufacturer') : route.startsWith('/forza/manufacturer/') ? links(html, 'car') : { title: clean(/<title>([^<]+)/.exec(html)?.[1] || '').replace(/\s*\|.*$/, ''), tunes: parseTunes(html) };
    this.cache.pages[route] = { at: this.now(), data };
    const pages = Object.entries(this.cache.pages).sort((a, b) => b[1].at - a[1].at).slice(0, 120);
    this.cache.pages = Object.fromEntries(pages); await this.persist().catch(() => {});
    return data;
  }
  async search(car) {
    assert(car && typeof car.make === 'string' && typeof car.name === 'string', '车型信息无效');
    const makers = await this.page('/forza/manufacturers', 7 * DAY), want = norm(car.make);
    const maker = makers.find((m) => norm(m.slug) === want || norm(m.name) === want) || makers.find((m) => want.length > 3 && (norm(m.slug).startsWith(want) || want.startsWith(norm(m.slug))));
    if (!maker) return { maker: null, candidates: [] };
    const cars = await this.page('/forza/manufacturer/' + maker.slug, DAY);
    const candidates = cars.map((c) => ({ ...c, url: `${BASE}/forza/car/${c.slug}`, year: Number(/-(\d{4})$/.exec(c.slug)?.[1]) || null, score: score(car, c) })).sort((a, b) => b.score - a.score).slice(0, 8);
    return { maker, candidates };
  }
  async tunes(slug) {
    assert(typeof slug === 'string' && /^[a-z0-9-]{1,120}$/.test(slug), '车型地址无效');
    const data = await this.page('/forza/car/' + slug, 6 * 60 * 60 * 1000);
    return { ...data, slug, url: `${BASE}/forza/car/${slug}`, fetchedAt: new Date(this.cache.pages['/forza/car/' + slug].at).toISOString() };
  }
}
const isCommunityUrl = (u) => typeof u === 'string' && /^https:\/\/codmunity\.gg\/forza(\/car\/[a-z0-9-]{1,120})?$/.test(u);
module.exports = { Community, parseTunes, links, score, isCommunityUrl, BASE };
