# Verification / 验证说明

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
