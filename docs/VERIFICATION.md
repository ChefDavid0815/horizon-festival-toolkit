# Verification / 验证说明

## V0.2.0 · 2026-09-20

- Production build passed. `npm test`: **22/22** passed.
- Actual S1–S5 texture archives decoded to five distinct in-game series covers. Desktop checks passed for all five image switches, unchanged season cards, persistent cache, missing-resource fallback and invalid-texture rejection. S1 uses the available standard-resolution cover; S2–S5 use 884 × 1416 high-resolution covers.
- Development Electron workflow passed with no renderer errors: Chinese/English car search, no-results state, adding two copies of a car, filling missing models, duplicate-free repeat, season-only garage preservation, paired-file restoration, S6 content-pack import, restart persistence, language persistence, minimum window layout and reduced motion.
- At the tested 1106 × 744 renderer size, the bottom season card ended at 603 px and the action dock started at 655 px. No horizontal overflow.
- Desktop renderer keeps `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
- Live local `ObjectModelGame.zip` parsing exactly reproduced all 20 bundled weeks. The previously decrypted game-resource database regenerated all **647** bundled car IDs and stock configurations, with zero unresolved cars. This game database is not a player save.
- Modified resource copies simulated Series 6. The parser discovered its four weeks, the catalog merged to 24 weeks, settings and catalog survived restart, and unchanged synchronization was a no-op.
- A transformed private QA save verified Series 6 inspection/editing, and a synthetic car definition verified the new-car import path. These are **synthetic future-content tests**, not evidence that real S6 or an unreleased car was tested.
- Garage tests check all existing vehicle rows, non-garage tables, non-garage profile sections, stock fields, unique GUIDs, input validation, the 2,000-car tool limit and all-cars idempotence.
- Invalid content packs fail before replacing the persisted catalog. Catalog imports cannot invent a missing series in a save. An unsupported playlist schema does not block an independently recognized garage.
- Packaging inspection found the garage module and SQLite WASM present and **no private save fixtures**.

Local detailed reports are written to `qa/v2-desktop-*/report.json` and `qa/v2-resources-*/report.json`. Packaged, installed and portable checks are recorded separately in the local release verification JSON. The `qa/` directory is excluded from Git and release packages.

**Not verified:** real gameplay loading/driving, vehicle entitlements, reward delivery, online synchronization, encrypted-player-save service availability, new encrypted GameDB service availability, and future save schemas. No formal game save was read or modified by V0.2 tests. The release is unsigned.

本次完成开发版桌面流程、22 项核心测试、真实本地资源目录比对，以及明确标注为模拟的 S6/新车兼容性测试。它们不代表未来内容或游戏内效果已经实测。最终安装版与免安装版结果保存在本地发布验证文件中。

## Publication check · 2026-09-18

- `npm run build`: passed. Vite 7 production renderer build.
- `npm test`: 12 / 12 passed using the existing private, decrypted QA fixture.
- Tests cover recognised catalogue structure, read-only inspection, selected-week scope, unchanged garage bytes, idempotence, invalid input rejection, file isolation, separate original/SCopy restoration, backup-integrity checks, locale resolution and preference persistence.
- Tests operate on in-memory data or temporary files under `qa/`; formal game saves were not scanned or modified.
- The actual app screenshots show the disconnected state. No player data is included.

The existing local release-verification record for 0.1.1 reports installed-workflow, portable/native-bridge and language-persistence checks as passed, no private save samples or car modification module in the package, no formal-save access in automated tests, `inGameVerified: false`, and `signed: false`. These desktop UI checks were completed before this publication task and were **not rerun** here.

本次重新执行构建与 12 项核心测试，全部通过。既有桌面 QA 记录通过安装版流程、免安装版与语言持久化检查，本次发布整理未重新运行这些桌面界面检查。私人测试存档不上传 GitHub，也不随安装包分发。

## Limits / 边界

No claims of in-game loading, rewards, online synchronisation, complete challenge substates or universal schema support. Encrypted-save service availability was not exercised during publication. No functional browser edition exists; the portfolio is a separate exhibition.
