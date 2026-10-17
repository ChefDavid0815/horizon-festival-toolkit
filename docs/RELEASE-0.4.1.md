# Festival Toolkit 0.4.1 · 进度少的存档，也能读 / Newer saves read too

[下载 / Download](https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/tag/v0.4.1) · [0.4 说明 / 0.4 guide](RELEASE-0.4.0.md) · [版本记录 / Changelog](../CHANGELOG.md)

Windows x64 · 安装版 / 免安装版 · 未签名 / NotSigned

## 修复

有玩家反馈，季节赛页面提示“无法唯一识别季节赛布局”，旅程进度页面提示“此收藏手册存档结构尚未适配”。两个问题都与游戏平台无关，是工具对存档内容的假设过严：

- **季节赛**：旧版本要求至少有一周记录了 4 种以上的活动，以免认错数据位置。玩季节赛比较少的存档达不到这个条件。0.4.1 改为要求整段数据能完整解析、逐字节还原，且全存档只有一个位置符合，再用内容目录核对积分上限。这个检查更严格，也不再依赖玩家进度。报错会说明是“找不到”“有多个可能位置”，还是“积分与目录不一致”。
- **收藏手册**：
  - 某个分类从没拿过分时，游戏不会为它创建积分记录。0.4.1 按 0 分读取；完成该分类项目时，按游戏的格式补建记录，并逐项回读核对。
  - 10 月 5 日的游戏更新新增了收藏项目，并修订了少量已有项目。新增项目按结构读取、原样保留、不做修改；修订项目照常显示完成状态，但暂不开放编辑。其余项目照常编辑。以开发者自己 10 月 17 日的存档为例：共 2,855 条记录，其中 22 条为新增项目、2 条为修订项目，读写均正常。
- **内置第 6 季**：S6 Horizon Meets（地平线车聚）的 4 周季节赛与奖励已内置，没有安装游戏或还没同步内容的玩家也能识别。有 5 辆 S6 奖励车不在内置车辆目录中，会标为“目录外车辆”。
- **导出诊断信息**：在“使用说明”或报错条里导出。文件只包含季节赛、收藏手册、腕带三段数据和收藏积分，不含玩家编号、车库、文件路径。以后遇到问题，可以直接发给开发者定位。

## 验证

- `npm test` 共 49 项，全部通过。新增 4 项：活动种类少的季节赛存档、季节赛报错分类、删除分类积分记录后的读取与补建写入（含二次写入不重复）、新增与修订收藏项目。
- 开发者 10 月 17 日的真实存档：
  - 季节赛定位位置与 0.4.0 完全一致，S1–S6 共 24 周均可读。
  - 0.4.0 在这份存档上会停止收藏手册编辑，0.4.1 可正常读写：写入摄影 +100、车辆收藏 +5，新增项目逐字节保留，其他存档状态不变。
- 桌面端在打包版与免安装版上完成验证，详见发布页的 `VERIFICATION-0.4.1.json`。

游戏内读档效果、奖励发放与线上同步仍未验证。

## English

0.4.1 fixes two errors players reported on saves with less progress:

- **Playlist.** The playlist is now located by complete parsing and byte-exact re-encoding, instead of requiring a week with more than three activity kinds.
- **Journal points.** A journal category with no points record yet reads as zero. Completing one of its entries creates the record in the game's own format.
- **New and revised entries.** Journal entries added by the 5 October game update are kept byte for byte; entries the update revised are shown read-only.
- **Series 6.** Horizon Meets is built in.
- **Diagnostics.** A new Export diagnostics option writes only the playlist, journal and wristband data, without the player ID, garage or paths.
