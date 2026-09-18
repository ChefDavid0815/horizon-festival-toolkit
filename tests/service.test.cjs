const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Service } = require("../electron/service.cjs");
const root = path.resolve(__dirname, "../qa");
async function setup() {
  const dir = await fs.mkdtemp(path.join(root, "service-test-"));
  const s = new Service({
    dataDir: path.join(dir, "state"),
    toolPath: "unused",
    testRoot: dir,
  });
  await s.init();
  return { s, dir };
}
test("isolated mode never scans local game saves and rejects outside paths", async () => {
  const { s, dir } = await setup();
  assert.deepEqual(await s.scan(), []);
  assert.throws(() => s.checkPath(path.join(dir, "../outside")), /隔离/);
  await assert.rejects(
    () => s.transaction([path.join(root, "outside")], Buffer.from("x"), []),
    /隔离/,
  );
});
test("all car operations are rejected by the backend", async () => {
  const { s } = await setup();
  await assert.rejects(
    () => s.apply({ weeks: ["1:0"], allCars: true }),
    /不提供加车/,
  );
});
test("transaction and restore preserve distinct original file pairs", async () => {
  const { s, dir } = await setup();
  s.gameClosed = async () => {};
  const a = path.join(dir, "C_ProfileData"),
    b = a + "_SCopy";
  await fs.writeFile(a, "ORIGINAL");
  await fs.writeFile(b, "DISTINCT-COPY");
  const backup = await s.transaction([a, b], Buffer.from("UPDATED"), []);
  assert.equal(await fs.readFile(a, "utf8"), "UPDATED");
  assert.equal(await fs.readFile(b, "utf8"), "UPDATED");
  await s.restore(backup.id);
  assert.equal(await fs.readFile(a, "utf8"), "ORIGINAL");
  assert.equal(await fs.readFile(b, "utf8"), "DISTINCT-COPY");
  assert.equal((await s.backups()).length, 2);
});
test("corrupted backup is rejected before restoring anything", async () => {
  const { s, dir } = await setup();
  s.gameClosed = async () => {};
  const file = path.join(dir, "C_ProfileData");
  await fs.writeFile(file, "ORIGINAL");
  const backup = await s.transaction([file], Buffer.from("UPDATED"), []);
  await fs.writeFile(path.join(backup.dir, "0.original"), "CORRUPT");
  await assert.rejects(() => s.restore(backup.id), /校验不一致/);
  assert.equal(await fs.readFile(file, "utf8"), "UPDATED");
});
