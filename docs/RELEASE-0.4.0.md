# Festival Toolkit 0.4.0 · 调校工坊 / The Tuning Update

![Festival Toolkit 0.4 — Every tune has a source](https://raw.githubusercontent.com/ChefDavid0815/horizon-festival-toolkit/main/docs/assets/cover-v0.4.0.png)

[下载 / Download](https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/tag/v0.4.0) · [README](https://github.com/ChefDavid0815/horizon-festival-toolkit#readme) · [版本记录 / Changelog](https://github.com/ChefDavid0815/horizon-festival-toolkit/blob/main/CHANGELOG.md)

Windows x64 · 安装版 / 免安装版 · 未签名 / NotSigned

## 调校工坊

存档里的车库数据库保存了每辆车的调校滑块值、已安装部件，以及每个已购部件的实际成交价。0.4 直接读取这些记录。

- **调校表**：车库中每辆车的完整调校。胎压（15–55 psi）、各档齿比（0.48–6.00）、外倾与前束（±5°）、主销后倾（1–7°）、防倾杆（1–65）、回弹 / 压缩阻尼（1–20）、刹车平衡与力度、差速器锁止和中央分配按游戏滑块网格换算成实际单位。这些范围是从已保存调校的滑块步进反推出来的，例如胎压值全部落在 1/400 网格上，对应 0.1 psi。弹簧、车身高度、下压力和尾牙比的范围因车而异，在游戏数据库可用前以滑块位置显示。
- **调校来源**：区分原厂设定、本地调校、自己发布的调校、从其他玩家下载的调校（显示作者 XUID 尾号），以及只有调校编号没有参数的记录。
- **场景计算**：公路、街头、泥地、越野、漂移、直线加速、雪地、极速八种场景。根据存档里的前后配重、选定的驱动形式，以及“转向特性 / 悬挂软硬”微调，计算轮胎、定位、防倾杆、弹簧、车高、阻尼、空力、刹车与差速器。原有齿比和尾牙比保持不变。计算器只用于已经保存过调校的车，因为原厂车的存档里没有齿轮数量。
- **套用与复制**：在同一车型的车辆之间复制调校，或连同改装一起复制。只复制调校时要求变速箱相同；连同改装复制会带上变速箱、全部部件和游戏计算好的性能数据，并为目标车补记已购部件，价格取自来源车辆的实际成交价。也可以恢复原厂调校。
- **改装与花费**：每辆车的改装花费等于存档中全部已购部件成交价之和，换下的旧部件也计算在内。车库改装账本按 D / C / B / A / S1 / S2 / R / X 汇总，点击等级即可筛选。复制改装时会预先显示要花费的 CR 和性能等级变化。本工具不修改 CR 余额。
- **调校库**：保存在本机。可以存入车辆当前调校（可附带改装方案）或计算结果，导出为 `festival-tune-pack` JSON 分享，导入时校验参数范围、部件归属和重复记录。
- **社区调校**：只在打开该页面时，从 codmunity.gg 的公开车型页面读取分享码、作者、性能等级和评分，结果缓存 6 小时。分享码需要在游戏“升级与调校 → 寻找调校设置”中下载；下载并装上后重新连接存档，就可以在工坊里收藏或复制到同车型车辆。

所有修改先进入待写入列表，与季节赛、车辆、进度选择一起，通过“备份并应用修改”写入。写入前会核对：目标以外的车辆和字段、其他数据表、已有购买记录以及数据库以外的存档状态均保持不变，改装花费也能对账。

## 季节赛：最新内容与奖励车辆

- **跟随游戏更新**：没有设置游戏目录时，会自动寻找 Steam 与 Xbox 安装目录（包括 Steam 库文件夹），并开启自动同步。运行期间每分钟比对游戏资源，游戏更新后读取新的系列赛、季节周、活动和奖励，不需要重新安装客户端。游戏还在下载时会静默等待，下载完成后自动开始。新系列赛仍需先在游戏中打开过，存档里才会有对应记录。
- **奖励车辆**：每周的积分奖励车辆（例如 20 / 40 积分，S1 为 15 / 30）、整个赛季的总积分奖励车辆，以及各项赛事的奖励车辆，全部从游戏资源读取：`FestivalPassSchedule` → `FestivalPassBonusMap` → `OM::CarReward`，以及各项赛事的 `MainRewardRef`。积分条上的刻度显示奖励门槛，达到后变绿；已拥有的车辆带对勾。
- **补齐奖励车辆**：“加入未拥有的 N 辆”会把还没有的奖励车放进“车辆收藏”的待写入列表，与其他修改一起备份并写入。补满积分只修改季节赛记录，游戏是否另行发放奖励由游戏决定。
- 内置目录已补全当前 5 个系列赛的奖励：20 周、87 项赛事奖励、共 119 辆车，全部在车辆目录中。

## 全新界面

界面改用“车检证”风格：浅绿色防伪底纹纸面、带角标的字段框、墨色文字，以及一枚朱红印章。印章只用于待写入的修改和存档记录。左侧导航显示各区域的待写入数量，底部提交栏汇总全部待写入内容。待写入的数值逐位滚动，调校表用朱色标记显示新位置。字体为 Noto Serif SC（标题）和 Barlow Semi Condensed（数字），均以 woff2 本地打包。支持减少动态效果设置。

## 范围与验证

`npm test` 新增 12 项测试，全部 45 项通过。其中调校 9 项，奖励解析、目录校验与回填、资源指纹与自动同步 3 项：滑块单位换算、计算器边界、车库与花费读取、同车型调校和改装复制（逐字段核对非目标车辆和字段）、计算 / 手动 / 恢复原厂写入、跨车型 / 变速箱 / 重复请求拒绝、调校库导入导出与外车部件拒绝、服务层预览不写入，以及社区页面解析和地址限制。桌面版已用隔离的存档副本在 Electron 中逐页走查。

尚未验证游戏内读档、驾驶手感，也未验证游戏会如何重新计算复制过来的性能数据。场景计算基于常见的配重比例调校方法，只能作为起点，不代表实测结果。驱动形式由用户选择，界面会根据配重给出推测。

## English

0.4 adds the tuning workshop. It reads every car's tune, upgrade parts and the CR actually paid for each part from the save's garage database. Real units are decoded from the slider grids observed in saved tunes. Car-specific ranges stay as slider positions.

You can:
- generate scenario tunes that keep the existing gearing;
- copy a tune, or a tune plus the full build, between cars of the same model, priced from real purchase records;
- keep a local tune library that you can import and export;
- look up share codes on public codmunity.gg pages.

The playlist now follows game updates: the Steam or Xbox install is found automatically and checked every minute while the app is open. It shows each week's and each series' point-reward cars plus event reward cars, all read from game resources, and can stage the missing ones for your garage. The whole interface was redesigned as a vehicle register: tinted security paper, boxed fields with corner tabs, sumi ink, and a vermilion seal reserved for staged changes and archived records. In-game behaviour of written tunes and copied builds is not verified.
