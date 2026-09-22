# Festival Toolkit 0.3.0 · The Journey Update

Windows x64 · 安装版 / 免安装版 · 未签名 / NotSigned

## 新的一程

- 每个本机自然日检查一次 GitHub 已发布版本；包括本项目沿用的预发布版本。使用 `vMAJOR.MINOR.PATCH` 版本标签进行数字比较，不会因 0.10 与 0.3 的字典顺序而判断错误。草稿不参与检查。
- 新版本弹窗显示版本号与更新说明，点击后打开固定官方仓库的 Release 页面。不会自行下载安装程序。断网、限流与异常响应不会中断存档操作；更新中心可手动重试。
- 新增“旅程进度”：Discover Japan 16 类 / 1,205 项，Horizon Festival 22 类 / 1,628 项，共 38 类 / 2,833 项。中文与英文名称、目标和分值来自本机游戏资源。
- 支持搜索、未完成筛选、单项、整类、当前路线与全部旅程选择。先形成待应用列表，点击底部“备份并应用修改”后写入收藏完成记录和对应分类 / 主路线积分。
- 腕带页读取七色腕带的持有记录，可选择一条或补齐全部缺失颜色。
- 沿用原有青柠绿、粉色、浅色背景和按钮结构，新增指南针与通行证动效、逐行入场、选择反馈、腕带材质与悬浮过渡；遵循减少动态效果设置。
- 更新中心加入客户端更新状态及 0.1.1 → 0.2.0 → 0.3.0 双语版本历史。

## 操作

1. 退出 FH6，在 Toolkit 中连接自己的 `C_ProfileData`。
2. 打开“旅程进度”，选择 Discover Japan、地平线嘉年华或腕带收藏。
3. 单击项目加入待应用列表，或使用“拉满此分类”“拉满整个进度”“拉满全部旅程”。已经完成的项目不会重复增加积分。
4. 点击“备份并应用修改”。季节、车辆和进度选择可以一起应用。
5. 需要撤销时在“备份与恢复”恢复相应版本；恢复操作本身也会留下恢复前快照。

收藏手册当前适配 `CollectionCampaignSaveState` v2 / `0x948e86fc`；腕带适配 v1 / `0xb471534c`。游戏更新后，未知项目、结构或积分与记录不一致会阻止对应写入。收藏目录目前随客户端发布，不会由旧版内容包覆盖。

## 范围与验证

这里编辑的是**收藏手册的完成记录、积分，以及腕带持有记录**。腕带持有、故事推进、赛事资格、地图事件和奖励领取有不同状态，本版本不把它们统称为“全部剧情已解锁”。车库收藏项目的完成记录也不会代替“车辆收藏”页面的实体车辆添加。

已通过隔离存档副本的逐项读写、分类 / 路线 / 全部修改、非目标状态保持、积分对账、幂等性、SCopy 一致性和备份恢复测试。桌面验证包含自动弹窗、每日缓存、GitHub 跳转、中英界面、历史展开、最小窗口、减少动态效果和安全隔离。测试不操作正式玩家存档。

尚未验证真实游戏读档、奖励派发、剧情 / 赛事解锁或云同步；加密玩家存档依旧由 ForzaCryptoTool 调用 `forzamods.dev`，会上传用户选择的存档，连接窗口保留说明。二进制文件未签名。

## English

Version 0.3 adds daily GitHub release checks, including this project's published prereleases, a download prompt, and bilingual release history. Discover Japan and Horizon Festival now have a journal workspace covering 38 categories and 2,833 entries, with search, individual/category/path/all selection, consistent point totals, and automatic backup/restore. Seven wristband ownership records can be inspected and completed separately.

The original festival palette and layout continue with coordinated motion and reduced-motion support. The release checks never upload saves. Download links are restricted to this project's GitHub releases.

These operations change journal completion records, currency totals and wristband ownership. They do not establish story unlocks, race eligibility, physical car ownership or reward delivery. Local fixture and desktop checks passed; actual in-game loading, rewards and cloud synchronization remain unverified. Windows binaries are unsigned.
