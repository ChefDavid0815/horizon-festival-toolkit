<img src="docs/assets/journey-v0.3.png" width="100%" alt="Festival Toolkit 0.3.0 — Discover Japan 旅程工作区，未连接存档" />

<p align="center"><a href="README.md">English</a> · <b>简体中文</b></p>


<p align="center"><a href="https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/tag/v0.3.0"><b>DOWNLOAD 0.3.0 ↓</b></a> &nbsp; / &nbsp; <a href="https://chefzc-homepage.vercel.app/gallery.html#festival-history">VERSION JOURNAL ↗</a> &nbsp; / &nbsp; <a href="CHANGELOG.md">CHANGELOG ↗</a></p>

# Horizon Festival Toolkit · V0.3.0

FH6 收藏手册、腕带、季节赛、车辆库存与内容工坊。0.3 延续荧光绿、粉色和浅色底，加入旅程工作区、统一精细动效、每日 GitHub 更新提醒与产品版本历史。

| 季节赛 | 车辆收藏 | 内容更新 | 语言 |
| --- | --- | --- | --- |
| 动态系列赛与周选择 | 内置 647 款车型 | 游戏资源同步与离线内容包 | 中文 / English / 跟随系统 |

## 新功能

- Discover Japan 与地平线嘉年华：**38 个分类、2,833 个子项目**，支持中文目标、搜索筛选、单项／分类／路线／全部选择，完成记录与积分一起写回。
- 读取七色腕带持有记录，单条补齐或补齐全部缺失颜色；持有记录与剧情、赛事资格分开处理。
- 每个本机自然日检查一次 GitHub，包含本项目使用的预发布版本。新版本弹窗跳转 Release 下载页，由用户自行下载、安装。
- 更新中心新增 0.1.1 → 0.2.0 → 0.3.0 双语产品历史。详细说明见 [0.3 使用指南与编辑范围](docs/RELEASE-0.3.0.md)。

- 左侧系列赛海报读取对应的游戏内总封面。S1–S5 各用自己的海报，四季卡片保留现有样式；内容同步也会更新新系列赛封面。

- 按车型、品牌、年份或车辆 ID 搜索；支持常用中文品牌别名。
- 单车一次增加 1–20 台库存，已有车型也能添加；一键补齐模式仅给缺失车型各添加 1 台。
- 选择一周、一个系列赛或全部已识别季节。车辆和季节赛修改可以一起应用。
- 从本地游戏资源读取新系列赛和新车辆配置。可在启动时及运行期间每 30 分钟同步；兼容的新内容无需重装 Toolkit。
- 导入、导出独立 JSON 内容包，保留历史目录。
- 写入前自动备份；恢复时分别校验原文件与 SCopy；加密存档先完成加密、解密回读再写回。

启动时不连接或修改存档。点击“备份并应用修改”才会执行所选变更。加车会检查原有车辆、其他数据库表和非目标状态块保持不变。

## 打开软件

**[下载 Windows x64 0.3.0](https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/tag/v0.3.0)** — 安装版、免安装版与 SHA-256 校验文件，安装包均未签名：

- [Horizon-Festival-Toolkit-0.3.0-Setup.exe](https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/download/v0.3.0/Horizon-Festival-Toolkit-0.3.0-Setup.exe)
- [Horizon-Festival-Toolkit-0.3.0-Portable.exe](https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/download/v0.3.0/Horizon-Festival-Toolkit-0.3.0-Portable.exe)
- [SHA256SUMS-0.3.0.txt](https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/download/v0.3.0/SHA256SUMS-0.3.0.txt)

源码启动需要 Node.js 与 npm：

```powershell
npm ci
npm run build
npm start
```

按 [tools/README.md](tools/README.md) 安装并核验上游工具后，运行 `npm run package` 打包。`npm run dev` 仅用于界面开发；存档功能依赖 Electron，没有独立可用的网页版。


## 打开工坊，看一看

真实 Windows 0.3.0 截图，中文界面，未连接存档。界面中的游戏海报归各自权利人所有。

<img src="docs/assets/workspace-v0.3.png" width="100%" alt="Festival Toolkit 0.3.0 — playlist and four seasonal cards" />

<details>
<summary><b>打开车库 / 647 款车型</b></summary>

<img src="docs/assets/garage-v0.3.png" width="100%" alt="Festival Toolkit 0.3.0 — searchable garage, disconnected" />

</details>

## 长期内容更新

在“更新中心”选择 FH6 安装目录。程序直接解析 `media/ObjectModelGame.zip` 中的季节赛定义，使用 `media/Stripped/gamedbRC.slt` 建立车辆原厂配置。新的加密车辆数据库需要启用在线解密或导入内容包；内容同步本身不读取玩家存档。

新系列赛必须已存在于所连接存档。可以先在游戏内打开新系列赛，再退出并重新连接。新事件类型、加密方式或存档 schema 变化仍需适配；不会因为导入了目录就凭空写入未知结构。

见 [V0.3 使用指南](docs/RELEASE-0.3.0.md) 和 [内容包格式](docs/CONTENT-PACKS.md)。

## 验证与边界

`npm test` 检查存档、车库、目录、恢复和语言偏好；完整测试与 `npm run verify:desktop` 需要开发者自己的 `qa/cli-roundtrip.bin`。私人样本不进入 Git，也不进入安装包。见 [验证记录](docs/VERIFICATION.md)。

加密**玩家存档**仍通过 [ForzaCryptoTool](https://github.com/DVS-code/Forza-Crypto-Tool) 在线处理，会上传所选文件到 `forzamods.dev`；连接弹窗会说明。启用新车辆资源在线解密则会发送**游戏资源** `gamedbRC.slt`。没有内置私人账号或密钥。

尚未验证真实游戏读档、驾驶、奖励、独立挑战子状态、线上同步或未来格式。加车不会授予 DLC 购买权益。当前季节赛适配 FestivalPass v4 / schema `0x6efc7e34`；工具自身限制车库总量不超过 2,000 台。

[版本记录](CHANGELOG.md) · [第三方来源](THIRD_PARTY.md)

个人非官方项目，与 Microsoft、Xbox、Playground Games 无隶属关系。游戏资源与商标属于其权利人。

**YOUR FESTIVAL. YOUR WAY.**
