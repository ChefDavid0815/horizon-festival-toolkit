const fs = require('node:fs/promises');
const path = require('node:path');
const RESOURCE = ['media', 'ObjectModelGame.zip'];
const isFile = (p) => fs.stat(p).then((s) => s.isFile(), () => false);
const list = (p) => fs.readdir(p, { withFileTypes: true }).then((e) => e.filter((x) => x.isDirectory()).map((x) => x.name), () => []);
const isGame = (dir) => isFile(path.join(dir, ...RESOURCE));
async function drives() {
  const out = [];
  for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ') if (await fs.access(`${letter}:\\`).then(() => true, () => false)) out.push(`${letter}:\\`);
  return out;
}
// Steam libraries come from the registry SteamPath plus each libraryfolders.vdf; Xbox installs live in <drive>:\XboxGames.
async function candidates(run) {
  const roots = new Set(), found = [];
  try { const m = /SteamPath\s+REG_SZ\s+(.+)/i.exec(await run('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], 8000)); if (m) roots.add(path.normalize(m[1].trim())); } catch {}
  const all = await drives();
  for (const d of all) for (const name of ['Steam', 'SteamLibrary', 'Program Files (x86)\\Steam', 'Program Files\\Steam', 'Games\\Steam']) roots.add(path.join(d, name));
  const libraries = new Set();
  for (const root of roots) {
    libraries.add(root);
    try { const vdf = await fs.readFile(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8'); for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libraries.add(path.normalize(m[1].replace(/\\\\/g, '\\'))); } catch {}
  }
  for (const lib of libraries) for (const dir of await list(path.join(lib, 'steamapps', 'common'))) if (/forza\s*horizon\s*6/i.test(dir)) found.push(path.join(lib, 'steamapps', 'common', dir));
  for (const d of all) for (const dir of await list(path.join(d, 'XboxGames'))) if (/forza\s*horizon\s*6/i.test(dir)) found.push(path.join(d, 'XboxGames', dir, 'Content'), path.join(d, 'XboxGames', dir));
  const seen = new Set();
  return found.filter((p) => !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()));
}
async function detectGame(run) {
  let best = null;
  for (const dir of await candidates(run)) {
    if (!(await isGame(dir))) continue;
    const time = (await fs.stat(path.join(dir, ...RESOURCE))).mtimeMs;
    if (!best || time > best.time) best = { dir, time };
  }
  return best?.dir || null;
}
// A cheap fingerprint of the resources content sync reads; it changes when a game update replaces them.
async function resourceStamp(gamePath) {
  const parts = [];
  for (const file of [path.join(gamePath, ...RESOURCE), path.join(gamePath, 'media', 'Stripped', 'gamedbRC.slt')]) {
    try { const s = await fs.stat(file); parts.push(`${s.size}:${Math.round(s.mtimeMs)}`); } catch { if (!parts.length) return null; parts.push('-'); }
  }
  return parts.join('|');
}
module.exports = { detectGame, resourceStamp, candidates, isGame };
