# Changelog / 版本记录

## 0.3.0 · 2026-09-22 · Current / 当前版本

- Daily GitHub release checks, persistent local-day cache, offline handling, update dialog and a validated download-page link. Includes published prereleases used by this project. / 每日检查 GitHub 发布、更新弹窗与下载页跳转。
- Discover Japan and Festival journals: 38 categories / 2,833 items, localized labels, search, filters and individual/category/path/all selection. / 两条主路线、分类与子项目的读取和选择。
- Journal completion and point totals update together; seven wristband ownership records can be completed individually or together. / 收藏记录与积分同步写入；七色腕带持有记录补齐。
- Correct complete binary-state boundaries and validate sequential state indexes. Preserve unrelated states, garage data, photo metadata and reward bookkeeping. / 修正状态块边界并核对索引，保留非目标内容。
- Coordinated card/row/selection motion, compass and wristband artwork, reduced motion and bilingual in-app release history. / 延续视觉语言，精细化动效并加入双语版本历史。
- See [0.3 guide and boundaries](docs/RELEASE-0.3.0.md). Local fixture verification does not establish in-game rewards, story unlocks or cloud sync. / 存档层验证不等于游戏内奖励、剧情或云同步验证。

## 0.2.0 · 2026-09-20 · Previous / 历史版本

- Series posters use each series' actual in-game cover, extracted from local texture archives and cached across restarts. Season cards retain their original style. / 各系列赛读取对应游戏内总封面，四季卡片样式保留。

- Search 647 bundled car models by name, make, year or ID; common Chinese make aliases are supported. Add 1–20 copies per model or fill only missing models. / 搜索车辆、单车加库存、补齐目录内全车。
- Read local ObjectModelGame resources dynamically; no fixed S1–S5 list in the editor. Sync at launch and every 30 minutes when enabled. / 动态读取新系列赛，支持自动同步。
- Build new car configurations from the installed GameDB. Changed encrypted GameDB resources require optional online decryption through ForzaCryptoTool. / 从游戏数据库生成新车原厂配置。
- Import/export independent JSON content packs. Validate before merging and persist outside the application installation. / 独立内容包导入导出及持久化。
- Modernized festival palette, collection workspace, content center, transitions, hover motion and reduced-motion support. / 保留配色，升级界面与动效。
- Chinese, English and system-language preference cover the new workflows. / 新功能完整接入中英文与语言偏好。
- Existing vehicles and unrelated states are checked for preservation; the existing backup, restore and encrypted round-trip gates remain in place. / 原车与非目标状态保留检查。

Local fixture and desktop verification do not establish in-game driving, rewards, online sync or compatibility with an unreleased save schema. / 隔离验证不代表游戏内驾驶、奖励或未来格式已经验证。

## 0.1.1 · 2026-09-18 · Previous / 历史版本

- Simplified Chinese, English and system-language selection, with persistent manual preference. / 简体中文、English、跟随系统，并记住手动偏好。
- S1–S5 seasonal record workflow, 20 recognised weeks. / S1–S5 共 20 周季节赛记录流程。
- Pre-write backup, recognised SCopy handling and separate-file restoration. / 写入前备份、已有 SCopy 处理与原文件分别恢复。
- Public source, bilingual documentation and a matching Gallery exhibition. / 公开源码、双语说明与同风格 Gallery 展柜。

Early release. No car addition; in-game effects and online synchronisation remain unverified. / 早期版本；不包含加车，游戏内效果及线上同步未验证。
