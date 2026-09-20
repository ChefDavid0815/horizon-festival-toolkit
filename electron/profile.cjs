const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const seasons = require("../data/seasons.json");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const hex = (n) => "0x" + n.toString(16).padStart(16, "0");
function fnv(s) {
  let h = 0xcbf29ce484222325n;
  for (const b of Buffer.from(s)) {
    h = ((h ^ BigInt(b)) * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h;
}
class Reader {
  constructor(b, p = 0, end = b.length) {
    this.b = b;
    this.p = p;
    this.end = end;
  }
  take(n) {
    if (n < 0 || this.p + n > this.end) throw Error("存档数据截断。");
    const p = this.p;
    this.p += n;
    return p;
  }
  u32() {
    return this.b.readUInt32LE(this.take(4));
  }
  u64() {
    return this.b.readBigUInt64LE(this.take(8));
  }
  f32() {
    const f = this.b.readFloatLE(this.take(4));
    if (!Number.isFinite(f)) throw Error("无效进度值");
    return f;
  }
  count(max) {
    const n = this.u32();
    if (n > max) throw Error("不支持的存档结构");
    return n;
  }
  str() {
    const n = this.count(4096);
    return this.b.toString("utf8", this.take(n), this.p);
  }
}
function parse(b) {
  if (!Buffer.isBuffer(b) || b.length < 32 || b.readUInt32LE(0) !== 0x4a8bf2b6)
    throw Error("需要已解密的 FH6 存档。");
  const r = new Reader(b),
    sections = [];
  while (r.p < b.length) {
    const header = r.p,
      tag = r.u32(),
      size = r.count(256 * 1024 * 1024),
      start = r.take(size);
    sections.push({ tag, header, start, end: r.p, size });
  }
  const binary = sections.find((s) => s.tag === 0x986ca5cb),
    database = sections.find((s) => s.tag === 0xa9f1f729);
  assert(binary && database, "缺少存档状态块或车库数据库");
  const q = new Reader(b, binary.start, binary.end),
    count = q.count(2048),
    states = [];
  for (let i = 0; i < count; i++) {
    const header = q.p,
      id = q.u64(),
      type = q.str(),
      base = q.str(),
      schema = q.u32(),
      sizeOffset = q.p,
      size = q.count(128 * 1024 * 1024);
    assert(size >= 4);
    const start = q.take(size - 4);
    states.push({
      i,
      id,
      type,
      base,
      schema,
      header,
      sizeOffset,
      start,
      end: q.p,
    });
  }
  assert(
    binary.end - q.p === 8 &&
      b.subarray(q.p, binary.end).toString("hex") === "6374656470000000",
    "状态块尾标记不一致",
  );
  assert.equal(
    b.toString("ascii", database.start, database.start + 15),
    "SQLite format 3",
  );
  return { sections, binary, database, states };
}
function replaceState(b, type, payload) {
  const p = parse(b),
    s = p.states.find((s) => s.type === type);
  assert(s);
  const delta = payload.length - (s.end - s.start);
  const out = Buffer.concat([
    b.subarray(0, s.start),
    payload,
    b.subarray(s.end),
  ]);
  out.writeUInt32LE(payload.length + 4, s.sizeOffset);
  out.writeUInt32LE(p.binary.size + delta, p.binary.header + 4);
  parse(out);
  return out;
}
function replaceDatabase(b, payload) {
  const p = parse(b),
    s = p.database;
  const out = Buffer.concat([
    b.subarray(0, s.start),
    payload,
    b.subarray(s.end),
  ]);
  out.writeUInt32LE(payload.length, s.header + 4);
  parse(out);
  return out;
}
function readEvents(r) {
  const series = [];
  for (let a = r.count(512); a; a--) {
    const id = r.u32();
    assert(id < 10000);
    const weeks = [];
    for (let w = r.count(4); w; w--) {
      const week = r.u32();
      assert(week < 4);
      const types = [];
      for (let t = r.count(40); t; t--) {
        const type = r.u32();
        assert(type < 40);
        const events = [];
        for (let n = r.count(1000); n; n--) {
          const id = hex(r.u64());
          events.push(
            type === 4 || type === 5
              ? {
                  id,
                  parts: Array.from({ length: r.count(16) }, () => r.f32()),
                }
              : { id, status: r.u32(), progress: r.f32() },
          );
        }
        assert(new Set(events.map((e) => e.id)).size === events.length);
        types.push({ type, events });
      }
      assert(new Set(types.map((t) => t.type)).size === types.length);
      weeks.push({ week, types });
    }
    assert(new Set(weeks.map((w) => w.week)).size === weeks.length);
    series.push({ id, weeks });
  }
  assert(new Set(series.map((s) => s.id)).size === series.length);
  return series;
}
function encodeEvents(series) {
  const chunks = [];
  const u = (n) => {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(n);
      chunks.push(b);
    },
    h = (n) => {
      const b = Buffer.alloc(8);
      b.writeBigUInt64LE(BigInt(n));
      chunks.push(b);
    },
    f = (n) => {
      const b = Buffer.alloc(4);
      b.writeFloatLE(n);
      chunks.push(b);
    };
  u(series.length);
  for (const s of series) {
    u(s.id);
    u(s.weeks.length);
    for (const w of s.weeks) {
      u(w.week);
      u(w.types.length);
      for (const t of w.types) {
        u(t.type);
        u(t.events.length);
        for (const e of t.events) {
          h(e.id);
          if (t.type === 4 || t.type === 5) {
            u(e.parts.length);
            e.parts.forEach(f);
          } else {
            u(e.status);
            f(e.progress);
          }
        }
      }
    }
  }
  return Buffer.concat(chunks);
}
function festival(b, catalog = seasons) {
  const state = parse(b).states.find((s) => s.type === "FestivalPassSaveState");
  assert(state, "未找到季节赛状态");
  if (b.readUInt32LE(state.start) !== 4 || state.schema !== 0x6efc7e34)
    throw Error("此季节赛存档版本尚未适配；未修改文件。");
  const matches = [];
  for (
    let offset = state.start + 4;
    offset < Math.min(state.end - 100, state.start + 65536);
    offset++
  ) {
    const n = b.readUInt32LE(offset);
    if (n < 1 || n > 512) continue;
    try {
      const r = new Reader(b, offset, state.end);
      r.u32();
      const totals = [];
      for (let i = 0; i < n; i++) {
        const id = r.u32(),
          pos = r.p,
          value = r.u32();
        assert(id < 10000 && value < 10000);
        totals.push({ id, pos, value });
      }
      assert(new Set(totals.map((t) => t.id)).size === n);
      assert.equal(r.count(512), n);
      const weekPoints = [];
      for (let i = 0; i < n; i++) {
        const id = r.u32();
        assert.equal(id, totals[i].id);
        for (let j = r.count(4); j; j--) {
          const week = r.u32(),
            pos = r.p,
            value = r.u32();
          assert(week < 4 && value < 1000);
          weekPoints.push({ id, week, pos, value });
        }
      }
      assert.equal(r.count(512), n);
      const max = [];
      for (let i = 0; i < n; i++) {
        const id = r.u32();
        assert.equal(id, totals[i].id);
        r.u64();
        const points = r.u32();
        assert(points < 10000);
        max.push({ id, points });
        for (let j = r.count(16); j; j--) {
          r.u32();
          r.u32();
        }
      }
      r.u32();
      const eventStart = r.p,
        events = readEvents(r);
      assert.equal(events.length, n);
      assert(events.some((s) => s.weeks.some((w) => w.types.length > 3)));
      assert(b.subarray(eventStart, r.p).equals(encodeEvents(events)));
      assert.deepEqual(events.map(s=>s.id).sort((a,b)=>a-b), totals.map(s=>s.id).sort((a,b)=>a-b));
      const known = max.filter((m) => catalog.weeks.filter(w=>w.series===m.id).length === 4);
      assert(known.length);
      for (const m of known)
        assert.equal(
          m.points,
          catalog.weeks
            .filter((w) => w.series === m.id)
            .reduce((a, w) => a + w.maxPoints, 0),
        );
      matches.push({
        state,
        totals,
        weekPoints,
        max,
        eventStart,
        eventEnd: r.p,
        events,
      });
    } catch {}
  }
  if (matches.length !== 1)
    throw Error("无法唯一识别季节赛布局，请保留原存档。");
  return matches[0];
}
function weekRecords(f, s, w) {
  return f.events.find((e) => e.id === s)?.weeks.find((e) => e.week === w);
}
function isDone(e) {
  return (
    e &&
    ("parts" in e
      ? e.parts.length > 0 && e.parts.every((p) => p === 1)
      : e.status === 1 && e.progress === 1)
  );
}
function inspectSeasons(b, catalog = seasons) {
  const f = festival(b, catalog);
  return catalog.weeks.map((w) => {
    const stored = weekRecords(f, w.series, w.week);
    const completed = w.events.filter((e) =>
      isDone(
        stored?.types
          .find((t) => t.type === e.type)
          ?.events.find((v) => v.id === e.id),
      ),
    ).length;
    const points = f.weekPoints.find(
      (p) => p.id === w.series && p.week === w.week,
    )?.value;
    return {
      ...w,
      available: !!stored && points !== undefined,
      points: points ?? 0,
      completed,
      total: w.events.length,
      complete: completed === w.events.length && points === w.maxPoints,
    };
  });
}
function patchStats(b, f, touched, catalog = seasons) {
  const s = parse(b).states.find((s) => s.type === "Stats");
  assert(s);
  const out = Buffer.from(b);
  const magic = 0x949dbe1845545d4dn;
  const node = (r) => {
    const start = r.p;
    if (r.p + 20 <= r.end && r.b.readBigUInt64LE(r.p + 4) === magic) {
      r.u32();
      r.u64();
      const pos = r.p,
        value = r.u64();
      return { pos, value };
    }
    const values = [];
    for (let n = r.count(100000); n; n--) {
      const key = r.u64();
      values.push({ key, node: node(r) });
    }
    return { values, start };
  };
  const find = (name) => {
    const h = Buffer.alloc(8);
    h.writeBigUInt64LE(fnv(name));
    const p = b.indexOf(h, s.start);
    assert(
      (p >= s.start && p < s.end && b.indexOf(h, p + 1) > s.end) ||
        (p >= s.start && p < s.end && b.indexOf(h, p + 1) === -1),
      `统计字段未匹配: ${name}`,
    );
    return node(new Reader(b, p + 8, s.end));
  };
  const pointsBySeries = new Map(
    f.totals.map((t) => [t.id, out.readUInt32LE(t.pos)]),
  );
  let full = 0;
  for (const m of f.max)
    if (m.id > 0 && m.points > 0 && pointsBySeries.get(m.id) >= m.points)
      full++;
  const set = (n, v) => {
    assert(n.pos !== undefined);
    out.writeBigUInt64LE(BigInt(v), n.pos);
  };
  for (const [name, mode] of [
    ["Freeroam/FestivalPass/SeasonsCompleted", "weeks"],
    ["Freeroam/FestivalPass/FestivalPassTotalSeriesProgress", "points"],
  ]) {
    const tree = find(name);
    for (const entry of tree.values || []) {
      for (const id of touched)
        if (entry.key === fnv(String(id))) {
          const count = f.weekPoints.filter(
            (p) =>
              p.id === id &&
              catalog.weeks.some(
                (w) =>
                  w.series === id &&
                  w.week === p.week &&
                  out.readUInt32LE(p.pos) >= w.maxPoints,
              ),
          ).length;
          set(entry.node, mode === "weeks" ? count : pointsBySeries.get(id));
        }
    }
  }
  set(find("Freeroam/FestivalPass/CompletedSeriesCount"), full);
  return out;
}
function patchSeasons(input, keys, seasonCatalog = seasons) {
  assert(
    Array.isArray(keys) && keys.length && keys.length <= 2048,
    "请选择至少一周",
  );
  const chosen = new Set(keys);
  assert.equal(chosen.size, keys.length);
  const before = festival(input, seasonCatalog),
    catalog = inspectSeasons(input, seasonCatalog);
  for (const key of keys)
    assert(
      catalog.some((w) => w.key === key && w.available),
      "所选周尚未存在于当前存档中",
    );
  let b = Buffer.from(input);
  const touched = new Set();
  let added = 0;
  for (const w of catalog.filter((w) => chosen.has(w.key))) {
    touched.add(w.series);
    const sw = weekRecords(before, w.series, w.week);
    for (const def of w.events) {
      let t = sw.types.find((t) => t.type === def.type);
      if (!t) {
        t = { type: def.type, events: [] };
        sw.types.push(t);
        sw.types.sort((a, b) => a.type - b.type);
      }
      let e = t.events.find((e) => e.id === def.id);
      if (!e) {
        e = { id: def.id };
        t.events.push(e);
        added++;
      }
      if (def.parts) e.parts = Array(def.parts).fill(1);
      else {
        e.status = 1;
        e.progress = 1;
      }
    }
    // Preserve extra historical entries but mark them complete within selected weeks.
    for (const t of sw.types)
      for (const e of t.events)
        if ("parts" in e) e.parts = e.parts.map(() => 1);
        else {
          e.status = 1;
          e.progress = 1;
        }
    b.writeUInt32LE(
      w.maxPoints,
      before.weekPoints.find((p) => p.id === w.series && p.week === w.week).pos,
    );
  }
  for (const id of touched) {
    const sum = before.weekPoints
      .filter((p) => p.id === id)
      .reduce((n, p) => n + b.readUInt32LE(p.pos), 0);
    b.writeUInt32LE(sum, before.totals.find((t) => t.id === id).pos);
  }
  b = patchStats(b, before, touched, seasonCatalog);
  const payload = Buffer.concat([
    b.subarray(before.state.start, before.eventStart),
    encodeEvents(before.events),
    b.subarray(before.eventEnd, before.state.end),
  ]);
  b = replaceState(b, "FestivalPassSaveState", payload);
  const after = inspectSeasons(b, seasonCatalog);
  assert(after.filter((w) => chosen.has(w.key)).every((w) => w.complete));
  const initial = festival(input, seasonCatalog),
    final = festival(b, seasonCatalog);
  for (const s of initial.events)
    for (const w of s.weeks)
      if (!chosen.has(`${s.id}:${w.week}`))
        assert.deepEqual(weekRecords(final, s.id, w.week), w, "未选周被改变");
  return {
    buffer: b,
    audit: {
      kind: "seasons",
      weeks: keys,
      added,
      verified: true,
      beforeSha256: sha(input),
      afterSha256: sha(b),
      validation: "存档层校验；游戏内显示未验证",
    },
  };
}
module.exports = {
  parse,
  replaceState,
  replaceDatabase,
  festival,
  inspectSeasons,
  patchSeasons,
  sha,
  fnv,
  seasons,
  encodeEvents,
};
