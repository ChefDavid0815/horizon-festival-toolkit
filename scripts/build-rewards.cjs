// Adds playlist reward cars to data/seasons.json from a decoded ObjectModelGame dump of the same game build.
// Usage: node scripts/build-rewards.cjs [qa/objects-v3.json]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { seasonsFromObjects } = require('../electron/resources.cjs');
const { validatePack } = require('../electron/catalog.cjs');
const root = path.join(__dirname, '..'), file = path.join(root, 'data', 'seasons.json');
const dump = JSON.parse(fs.readFileSync(path.resolve(root, process.argv[2] || 'qa/objects-v3.json'), 'utf8'));
const objects = new Map(dump.map(o => [o.a.id.split('.')[0], o]));
const bundled = JSON.parse(fs.readFileSync(file, 'utf8'));
const fresh = seasonsFromObjects(objects, bundled.resourceBuild);
// The dump must describe exactly the bundled playlist; only reward fields may be added.
const strip = w => ({ ...w, rewards: undefined, events: w.events.map(({ reward, ...e }) => e) });
assert.deepEqual(fresh.weeks.map(w => JSON.stringify(strip(w))), bundled.weeks.map(w => JSON.stringify(strip(w))), 'dump does not match the bundled playlist');
const out = { ...bundled, weeks: fresh.weeks, seriesRewards: fresh.seriesRewards };
validatePack({ format: 'festival-catalog', version: 2, resourceBuild: out.resourceBuild, seasons: out });
fs.writeFileSync(file, JSON.stringify(out));
const cars = new Set([...out.weeks.flatMap(w => [...(w.rewards || []), ...w.events.map(e => e.reward).filter(Boolean)]), ...Object.values(out.seriesRewards).flat()].map(r => r.car).filter(Boolean));
console.log(`weeks with rewards ${out.weeks.filter(w => w.rewards).length}/${out.weeks.length}, series ${Object.keys(out.seriesRewards).length}, event rewards ${out.weeks.reduce((n, w) => n + w.events.filter(e => e.reward).length, 0)}, distinct cars ${cars.size}`);
