const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const p = require("../electron/profile.cjs");
// Previously created, decrypted QA copy. No discovery or access to game saves.
const input = fs.readFileSync(path.join(__dirname, "../qa/cli-roundtrip.bin"));
const originalHash = p.sha(input);
function unchangedExcept(before, after, types) {
  const a = p.parse(before),
    b = p.parse(after);
  assert.equal(a.states.length, b.states.length);
  for (const s of a.states) {
    if (types.includes(s.type)) continue;
    const t = b.states.find((x) => x.type === s.type);
    assert(
      before.subarray(s.header, s.end).equals(after.subarray(t.header, t.end)),
      s.type,
    );
  }
  for (const s of a.sections) {
    if (s.tag === a.binary.tag) continue;
    const t = b.sections.find((x) => x.tag === s.tag);
    assert(
      before.subarray(s.header, s.end).equals(after.subarray(t.header, t.end)),
      `section ${s.tag}`,
    );
  }
}
test("catalog contains 20 unique weeks and verified series maximums", () => {
  assert.equal(p.seasons.weeks.length, 20);
  assert.equal(new Set(p.seasons.weeks.map((w) => w.key)).size, 20);
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((s) =>
      p.seasons.weeks
        .filter((w) => w.series === s)
        .reduce((n, w) => n + w.maxPoints, 0),
    ),
    [180, 200, 212, 211, 211],
  );
});
test("inspection is read-only and resolves all known weeks", () => {
  assert.equal(p.inspectSeasons(input).length, 20);
  assert.equal(p.sha(input), originalHash);
});
test("single-week patch preserves other weeks, garage database, and all other states", () => {
  const before = p.inspectSeasons(input),
    result = p.patchSeasons(input, ["5:1"]),
    after = p.inspectSeasons(result.buffer);
  assert(after.find((w) => w.key === "5:1").complete);
  for (const week of before.filter((w) => w.key !== "5:1"))
    assert.deepEqual(
      after.find((w) => w.key === week.key),
      week,
    );
  unchangedExcept(input, result.buffer, ["FestivalPassSaveState", "Stats"]);
  assert.equal(p.sha(input), originalHash);
});
test("full selection sets 20 weeks to maximum and is byte-idempotent", () => {
  const keys = p.seasons.weeks.map((w) => w.key),
    result = p.patchSeasons(input, keys);
  assert(
    p
      .inspectSeasons(result.buffer)
      .every((w) => w.complete && w.points === w.maxPoints),
  );
  assert(p.patchSeasons(result.buffer, keys).buffer.equals(result.buffer));
  unchangedExcept(input, result.buffer, ["FestivalPassSaveState", "Stats"]);
});
test("empty, duplicate, and unknown selections are refused", () => {
  for (const keys of [[], ["5:1", "5:1"], ["9:0"], ["5:4"]])
    assert.throws(() => p.patchSeasons(input, keys));
  assert.equal(p.sha(input), originalHash);
});
test("truncation and unknown schema are refused without changing input", () => {
  assert.throws(() => p.parse(input.subarray(0, input.length - 1)));
  const bad = Buffer.from(input),
    state = p.parse(bad).states.find((s) => s.type === "FestivalPassSaveState");
  bad.writeUInt32LE(99, state.start);
  const h = p.sha(bad);
  assert.throws(() => p.patchSeasons(bad, ["5:1"]), /尚未适配/);
  assert.equal(p.sha(bad), h);
});
