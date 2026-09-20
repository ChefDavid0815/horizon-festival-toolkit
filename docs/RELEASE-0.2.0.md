# Festival Toolkit V0.2.0

Windows x64 · 本地安装版与免安装版 · 未签名 / unsigned

## 使用

1. 退出 FH6，打开 Toolkit，连接自己的 `C_ProfileData`。
2. 在“车辆收藏”搜索车型、品牌、年份或 ID。点“添加”可累加库存，每个车型单次最多 20 台；“一键补齐全车”给当前目录中未拥有的车型各添加 1 台，保留已有车辆。
3. 季节赛和车辆选择可以一起应用。底部会显示待处理周数和车辆数。点“备份并应用修改”后才会写回。
4. “更新中心”选择包含 `media` 的 FH6 安装文件夹，保存设置并同步。勾选自动同步后，在启动时和应用运行期间每 30 分钟检查一次。游戏本身必须先下载新内容。
5. 新加密车辆数据库需要勾选在线解密。它将 **游戏资源 `gamedbRC.slt`** 交给 `forzamods.dev`；内容同步不会扫描或上传玩家存档。也可以导入来自可信来源的独立 JSON 内容包。
6. 右上角切换简体中文、English 或跟随系统；偏好会保存。

## 后续系列赛与新车

左侧总系列赛海报使用各系列赛游戏内的 `SerieshistoryPoster`，优先读取高清纹理包，缺少高清资源时读取标准版；四季卡片不变。封面从本机 `media/UI/Textures/[HiRes/]Data_Bound/SeriesN.zip` 解码到应用用户数据目录，不改动游戏文件。内容同步自动更新封面，缺失或未知纹理格式时保留已有封面/默认背景。

季节赛目录直接解析 `media/ObjectModelGame.zip` 的 BXML/XML 对象、活动引用和积分配置。列表不再固定 S1–S5。新系列赛内容沿用已支持的事件类型和保存布局时，无需重新安装 Toolkit。游戏需要先在存档中建立对应周记录；工具不会凭空创建未知状态。可先在游戏内打开新系列赛，退出后重新连接。

车辆目录从 `media/Stripped/gamedbRC.slt` 建立，保留有效原厂部件、排除交通车及不可获得车辆。内置目录为 647 款。搜索支持英文车型名、年份、车辆 ID，以及常用中文品牌别名。单车模式可增加已经拥有车型的库存；全车模式跳过已有车型。

新事件类型、加密格式或存档 schema 变化仍需代码适配。缺少实际游戏资源、原厂配置或未获得对应游戏内容时，不能仅靠车型名称解锁；游戏的内容/权益校验仍适用。工具的车库写入容量上限是 2,000 台，这是本工具的校验边界，不声称是游戏通用上限。

## 数据与恢复

内容包格式见 [CONTENT-PACKS.md](CONTENT-PACKS.md)。目录、设置和备份保存在 Electron 用户数据目录中，应用更新不会清空它们。退出程序后备份仍保留；恢复会先备份当前文件。检测到原存档变化、未知布局或数据库完整性问题时停止写入。

加密**玩家存档**的连接/写回沿用 [ForzaCryptoTool](https://github.com/DVS-code/Forza-Crypto-Tool) 在线服务，会上传选定存档；应用连接弹窗会说明这一点。已解密隔离样本的测试不等于在线服务或游戏内验证。

## English quick start

Close FH6, connect `C_ProfileData`, then choose playlist weeks or cars. Search by model, make, year or ID. Add up to 20 copies of a model, or select **Add all missing cars** to add one of each missing catalog model. **Back up & apply** is the only save-write action.

In **Content updates**, choose the game installation folder and sync. Optional auto-sync runs on launch and every 30 minutes while open. New series and cars can load independently of toolkit releases when their resource and save formats remain compatible. Optional online GameDB decryption sends game resources to forzamods.dev; content sync never uploads player saves. Offline content packs are also supported.

Game loading, driving, rewards and online synchronization remain unverified. The installer is unsigned. See [VERIFICATION.md](VERIFICATION.md) for the actual verification scope.
