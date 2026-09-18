const { _electron: electron, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const profile = require("../electron/profile.cjs");
const root = path.resolve(__dirname, "..");
let app;
(async () => {
  const qa = await fs.mkdtemp(path.join(root, "qa/desktop-"));
  const sample = await fs.readFile(path.join(root, "qa/cli-roundtrip.bin"));
  const fixture = path.join(qa, "C_ProfileData");
  await fs.writeFile(fixture, sample);
  await fs.writeFile(fixture + "_SCopy", sample);
  const env = {
    ...process.env,
    FESTIVAL_TEST_DATA: path.join(qa, "user-data"),
    FESTIVAL_TEST_SCOPE: qa,
    FESTIVAL_TEST_HIDDEN: "1",
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = process.env.FESTIVAL_EXECUTABLE
    ? { executablePath: process.env.FESTIVAL_EXECUTABLE, args: [] }
    : { args: [root] };
  app = await electron.launch({ ...launch, env, timeout: 30000 });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page.getByRole("combobox", {name:"Language / 语言"})).toBeEnabled();
  await page.getByRole("combobox", {name:"Language / 语言"}).selectOption("zh");
  await expect(
    page.getByRole("heading", { name: "每一周，都值得点亮。" }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    (await page.evaluate(() => window.festival.state())).summary,
    null,
  );
  await expect(
    page.getByRole("button", { name: /车辆收藏|补齐全部车辆/ }),
  ).toHaveCount(0);
  if (!process.env.FESTIVAL_EXECUTABLE) await page.screenshot({ path: path.join(root, "qa/desktop-start.png") });
  await page.getByRole("button", { name: "使用说明" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "连接存档", exact: true }).click();
  await page.getByLabel("存档文件", { exact: true }).fill(fixture);
  await page.getByRole("button", { name: "连接并解密" }).click();
  await expect(page.getByText("本地存档已连接", { exact: true })).toBeVisible({
    timeout: 25000,
  });
  assert(
    (await fs.readFile(fixture)).equals(sample),
    "read operation modified fixture",
  );
  await page.getByRole("tab", { name: /S5/ }).click();
  await page.getByRole("button", { name: "选择 S5 第2周 秋季" }).click();
  await expect(
    page.getByRole("button", { name: "选择 S5 第2周 秋季" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "备份并应用修改" })).toHaveCSS(
    "background-color",
    "rgb(237, 22, 128)",
  );
  const layout = await page.evaluate(() => {
    const card = document
        .querySelectorAll(".week-card")[3]
        .getBoundingClientRect(),
      dock = document.querySelector(".action-dock").getBoundingClientRect();
    return { cardBottom: card.bottom, dockTop: dock.top };
  });
  assert(
    layout.cardBottom < layout.dockTop,
    "season cards are covered by the action dock",
  );
  if (!process.env.FESTIVAL_EXECUTABLE) await page.screenshot({ path: path.join(root, "qa/desktop-selected.png") });
  await page.getByRole("button", { name: "备份并应用修改" }).click();
  await expect(
    page.getByText("已写回所选季节赛进度，自动备份已保存。"),
  ).toBeVisible({ timeout: 60000 });
  const changed = await fs.readFile(fixture),
    a = profile.parse(sample),
    b = profile.parse(changed);
  assert(profile.inspectSeasons(changed).find((w) => w.key === "5:1").complete);
  assert(
    sample
      .subarray(a.database.start, a.database.end)
      .equals(changed.subarray(b.database.start, b.database.end)),
    "garage database changed",
  );
  assert(changed.equals(await fs.readFile(fixture + "_SCopy")));
  await page.getByRole("button", { name: "备份与恢复 RECOVERY" }).click();
  await expect(page.getByRole("button", { name: "恢复此版本" })).toBeVisible();
  if (!process.env.FESTIVAL_EXECUTABLE) await page.screenshot({ path: path.join(root, "qa/desktop-backups.png") });
  await page.getByRole("button", { name: "恢复此版本" }).click();
  await page.getByRole("button", { name: "恢复存档", exact: true }).click();
  await expect(
    page.getByText("原存档已恢复；恢复前的版本也已备份。重新连接可查看结果。"),
  ).toBeVisible({ timeout: 20000 });
  assert((await fs.readFile(fixture)).equals(sample));
  assert((await fs.readFile(fixture + "_SCopy")).equals(sample));
  assert.deepEqual(errors, []);
  const security = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    const p = w.webContents.getLastWebPreferences();
    return {
      nodeIntegration: p.nodeIntegration,
      contextIsolation: p.contextIsolation,
      sandbox: p.sandbox,
    };
  });
  assert.deepEqual(security, {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
  });
  await app.close();
  app = null;
  const report = {
    passed: true,
    scope: qa,
    source: "existing QA copy only",
    formalSaveAccess: false,
    carWrites: false,
    fixtureRestored: true,
    rendererErrors: errors,
    security,
    executable: launch.executablePath || "development Electron",
  };
  await fs.writeFile(
    path.join(qa, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
})().catch(async (error) => {
  console.error(error);
  if (app) await app.close().catch(() => {});
  process.exitCode = 1;
});
