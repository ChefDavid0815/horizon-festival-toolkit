# Changelog / 版本记录

## 0.4.2 · 2026-10-19 · Current / 当前版本

- Playlist: saves that have entered only some series are located again. The game keeps points totals and week records only for series the player has entered, while maximums cover every series, so the three lists can differ in length; 0.4.1 required them to match and stopped with "playlist data could not be located". Series the save has never entered show as "Not in this save yet" and cannot be written. / 只参加过部分系列赛的存档不再提示“未能在存档中定位季节赛数据”；未参加过的系列赛显示为尚未记录，不可写入。
- See [0.4.2 notes](docs/RELEASE-0.4.2.md).

## 0.4.1 · 2026-10-18 · Previous / 历史版本

- Playlist: located by complete parsing and byte-exact re-encoding instead of requiring a week with more than three activity kinds, so saves with little playlist history read correctly; errors now say whether the data was not found, ambiguous or inconsistent with the catalog. / 季节赛不再要求某周有 4 种以上活动，进度少的存档也能识别；报错说明具体原因。
- Journal: a category with no points record yet reads as 0 and gets its record created on write; entries added by a game update are read by their framing and kept byte for byte; entries revised by an update are shown read-only. / 收藏手册缺少积分记录、含新项目或修订项目时都能正常读写。
- Series 6 Horizon Meets playlist and rewards built in. / 内置第 6 季。
- Export diagnostics from Help or the error banners: playlist, journal and wristband states plus journal point totals, without player ID, garage or paths. / 新增诊断信息导出。
- See [0.4.1 notes](docs/RELEASE-0.4.1.md).

## 0.4.0 · 2026-10-16 · Previous / 历史版本

- Tuning workshop: every car's tune read from the save, with tyre pressure, gearing, alignment, anti-roll, damping, brakes and differential in real units; tune source (stock, local, own, downloaded with creator) shown per car. / 调校工坊：读取每辆车完整调校，换算实际单位并标注调校来源。
- Scenario calculator for road, street, dirt, cross country, drift, drag, snow and top speed; keeps existing gearing. / 八种场景调校计算，保留原有齿比。
- Same-model tune and build transfer priced from real purchase records; reset to stock; garage upgrade ledger by class. / 同车型调校与改装复制，按实际成交价计算 CR；车库改装账本。
- Local tune library with validated import/export packs; CODMunity share-code lookup on demand. / 本机调校库与导入导出；按需搜索社区分享码。
- Playlist follows game updates: Steam/Xbox install auto-detected, resources checked every minute; week, series and event reward cars shown with ownership, and missing ones can be staged for the garage. / 季节赛随游戏更新自动读取，显示奖励车辆并可补齐。
- Complete visual redesign: vehicle-register world, side navigation, staged-change seals, rolling figures, self-hosted Noto Serif SC and Barlow Semi Condensed. / 全新车检证风格界面。
- See [0.4 guide and boundaries](docs/RELEASE-0.4.0.md). In-game effects of written tunes and builds are not verified. / 游戏内效果未验证。

## 0.3.0 · 2026-09-22 · Previous / 历史版本

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
