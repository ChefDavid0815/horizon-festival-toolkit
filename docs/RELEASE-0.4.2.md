# Festival Toolkit 0.4.2 · 只玩过几季，也能读 / Reads saves that skipped a series

[下载 / Download](https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/tag/v0.4.2) · [0.4.1 说明 / 0.4.1 notes](RELEASE-0.4.1.md) · [0.4 说明 / 0.4 guide](RELEASE-0.4.0.md) · [版本记录 / Changelog](../CHANGELOG.md)

Windows x64 · 安装版 / 免安装版 · 未签名 / NotSigned

## 修复

有玩家在 0.4.1 上反馈，季节赛页面提示“未能在存档中定位季节赛数据”，并附上了诊断信息。

- **原因**：季节赛数据里有三张按系列赛编号记录的表：累计积分、每周积分和积分上限。积分上限覆盖所有系列赛；累计积分和每周积分只在玩家参加过某个系列赛后才会建立。0.4.1 要求三张表的条目数一致，只参加过部分系列赛的存档不满足这个条件。反馈的存档里，三张表分别有 5、3、7 条（玩家参加过第 1 季和第 6 季）。
- **0.4.2**：三张表分别解析，不再要求条目数一致。仍然要求整段数据完整解析、逐字节还原，且全存档只有一个位置符合，再用内容目录核对积分上限。另外要求每个有周积分的系列赛都有累计积分；否则累计积分表的末尾几条可能被误读成一张更短的表，导致出现两个候选位置。
- **没参加过的系列赛**：存档里没有它们的周记录，显示为“此存档尚未记录”，不可写入。已参加的系列赛照常编辑。

## 验证

- `npm test` 共 52 项。新增 3 项，用合成存档覆盖：反馈中的布局（5/3/7 条，且末尾两条累计积分能被读成一张表）只定位到一处；未参加的系列赛拒绝写入，写入一周后其他周和其他系列赛不变，重复写入逐字节一致；旧布局（每张表条目数相同）照常读写。前两项在 0.4.1 代码上会复现“未能在存档中定位季节赛数据”。
- 反馈的诊断信息：把其中的季节赛数据放进最小存档容器后，0.4.1 复现同样的报错；0.4.2 定位到唯一位置，第 1、6 季共 8 周可读，写入第 6 季两周后积分与完成状态正确，重复写入逐字节一致。
- 依赖开发者私人存档的测试和桌面端验证需在本机重新运行，结果记录在发布页的 `VERIFICATION-0.4.2.json`。

游戏内读档效果、奖励发放与线上同步仍未验证。

## English

0.4.2 fixes the playlist reporting that its data could not be located on saves that have entered only some series.

- **Cause.** The playlist keeps three lists keyed by series: points totals, week points and maximums. Maximums cover every series; totals and week points appear only once the player has entered a series. 0.4.1 required the three lists to have the same length. The reported save has 5, 3 and 7 entries.
- **Fix.** Each list is parsed on its own. Complete parsing, byte-exact re-encoding, a single matching location and the catalog check on maximums are still required. Every series with week points must also have a total, which stops the tail of the totals list from reading as a second, shorter candidate.
- **Series never entered.** They have no week records, show as "Not in this save yet" and cannot be written.
