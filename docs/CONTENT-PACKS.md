# Independent content packs / 独立内容包

Export a complete pack from **Content updates → Export current catalog**. This is the canonical example; it contains resource metadata and stock vehicle configurations, never player saves. Import through the same page. No server deployment or client reinstall is required.

Top-level format:

```json
{
  "format": "festival-catalog",
  "version": 2,
  "resourceBuild": "game-resource-build-or-fingerprint",
  "seasons": { "version": 1, "weeks": [] },
  "cars": { "version": 1, "cars": [] }
}
```

The empty arrays above only illustrate the envelope and are **not a valid import**. Include at least one nonempty section. Inspect an exported pack for complete entries.

- A week has `key: "6:0"`, numeric `series` and zero-based `week`, `season`, `seasonEn`, `title`, `maxPoints`, and `events`. Event IDs are exact 64-bit hexadecimal strings; event types must be implemented, points must sum exactly, and daily/weekly sub-state shapes must match. Never derive event IDs from an announcement headline or invent them.
- Optional rewards (0.4): a week may carry `rewards`, a list of `{ points, type, car }` sorted by points, where `car` is a car ordinal or `null` for non-car rewards; an event may carry `reward: { car }`; `seasons.seriesRewards` maps a series number to the same list for series-total bonuses. They come from `FestivalPassSchedule` → `FestivalPassBonusMap` → `OM::CarReward` and each event's `MainRewardRef`. Catalogs without them stay valid and are backfilled from the bundled catalog.
- A car has an integer `id`, `name`, `make`, `media`, `year`, `pi`, `classId`, `contentId`, and a complete `row` containing stock parts and known garage properties. A name/ID list cannot create valid cars. Inventory ID, GUID and owner are generated from the destination save, not copied from the pack.
- Import merges recognized weeks by key and cars by ID. Historical records remain available. The whole incoming pack is validated before the cached catalog is replaced atomically. Invalid input leaves the current catalog intact. The limit is 24 MiB per pack.
- Importing new definitions does not create missing FestivalPass records in a player save. New game content must be installed and the series recorded by the game first. Unknown event types or save layouts require adapter changes.
- A pack is data, not executable code. Only import resource data you trust. The format is not a digital-signature scheme or an official Forza feed.

The bundled resource readers are `electron/resources.cjs` and `electron/catalog.cjs`. `scripts/verify-resources.cjs GAME_ROOT [DECRYPTED_GAME_DB]` checks current resources and a clearly synthetic future-series archive. The old Python catalog build script is retained for historical reference; the installed app uses the JavaScript reader and does not require Python.

客户端内的更新中心是主要入口。独立内容目录保存在用户数据目录的 `catalog-v2.json`，自动同步偏好与上次同步的资源指纹保存在 `content-settings.json`。0.4 起，未设置游戏目录时会自动寻找 Steam 与 Xbox 安装目录并开启自动同步；运行期间每分钟比对 `ObjectModelGame.zip` 与 `gamedbRC.slt` 的大小和修改时间，游戏更新替换这些文件且连续两次读取一致后才同步。应用关闭期间不运行后台任务，也不会自动写入玩家存档。
