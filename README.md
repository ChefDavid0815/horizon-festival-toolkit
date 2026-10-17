<a href="https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/tag/v0.4.1"><img src="docs/assets/cover-v0.4.0.png" width="100%" alt="Festival Toolkit 0.4 — Every tune has a source. Vehicle-register cover with a vermilion seal, a setup sheet showing staged tuning changes, and playlist reward cars." /></a>

<p align="center"><b>English</b> · <a href="README.zh-CN.md">简体中文</a></p>

<p align="center"><a href="https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/tag/v0.4.1"><b>DOWNLOAD 0.4.1 ↓</b></a> &nbsp; / &nbsp; <a href="docs/RELEASE-0.4.0.md">0.4 GUIDE ↗</a> &nbsp; / &nbsp; <a href="CHANGELOG.md">CHANGELOG ↗</a> &nbsp; / &nbsp; <a href="https://chefzc-homepage.vercel.app/gallery.html#project-festival-toolkit">EXHIBITION ↗</a></p>

# Horizon Festival Toolkit · V0.4.1

A Windows workshop for your own Forza Horizon 6 save. It reads every car's tune and upgrades, the CR you actually paid for each part, playlist weeks and their reward cars, journals, wristbands and the garage. You choose what to change; the toolkit backs up the save, checks the result and writes it back.

| Tuning | Playlist | Garage | Journey | Language |
| --- | --- | --- | --- | --- |
| Setup sheet, scenario calculator, build transfer, CR ledger | Follows game updates, reward cars | 647 models, add or fill missing | 38 categories, 2,833 entries, 7 wristbands | 简体中文 / English / System |

## Download

**[Windows x64 · 0.4.1](https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/tag/v0.4.1)** — installer, portable app, SHA-256 checksums and the verification report:

- [Horizon-Festival-Toolkit-0.4.1-Setup.exe](https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/download/v0.4.1/Horizon-Festival-Toolkit-0.4.1-Setup.exe)
- [Horizon-Festival-Toolkit-0.4.1-Portable.exe](https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/download/v0.4.1/Horizon-Festival-Toolkit-0.4.1-Portable.exe)
- [SHA256SUMS-0.4.1.txt](https://github.com/ChefDavid0815/horizon-festival-toolkit/releases/download/v0.4.1/SHA256SUMS-0.4.1.txt)

The binaries are unsigned, so Windows SmartScreen may ask for confirmation. Quit the game before connecting a save.

**0.4.1** fixes the playlist and journal stopping on saves with less progress or with journal entries from the 5 October game update, builds in Series 6 Horizon Meets, and adds **Export diagnostics**. See the [0.4.1 notes](docs/RELEASE-0.4.1.md).

## Tuning workshop

<img src="docs/assets/tuning-v0.4.png" width="100%" alt="Tuning workshop: car list on the left, Lotus Evija FE setup sheet on the right with a staged road tune shown as vermilion markers beside the current values. Player ID and file path masked." />

- **Setup sheet.** Every car's tune, read from the save. Tyre pressure (15–55 psi), gear ratios (0.48–6.00), camber and toe (±5°), caster (1–7°), anti-roll bars (1–65), rebound and bump (1–20), brake balance and pressure, and differential locking are converted to real units. These ranges were recovered from the slider grid of saved tunes. Springs, ride height, downforce and final drive have car-specific ranges and are shown as slider positions.
- **Where a tune came from.** Stock setup, your own tune, a local tune, or a downloaded tune with the creator's XUID suffix.
- **Scenario calculator.** Road, street, dirt, cross country, drift, drag, snow and top speed, with handling-balance and stiffness steps. It starts from the car's weight split and the drivetrain you choose, and keeps the existing gearing. Treat it as a starting point, not a tested setup.
- **Copy between cars of the same model.** Copy a tune, or a tune plus the whole upgrade build. The build's cost is priced from the parts the source car actually bought, and the PI change is shown before anything is written. Restoring the stock tune is one click.
- **Garage upgrade ledger.** The exact CR spent on upgrades, per car and per class (D to X). Click a class to filter the list. The toolkit never changes your CR balance.
- **Tune library.** Kept on your PC; import and export packs to share with other toolkit users.
- **Community tunes.** Look up share codes for the car on public CODMunity pages. Share codes are downloaded in game (Upgrades & Tuning → Find tuning setups); reconnect the save afterwards to keep the tune or copy it to other cars of that model.

<details><summary><b>Garage upgrade ledger</b></summary>

<img src="docs/assets/tuning-ledger-v0.4.png" width="100%" alt="Garage upgrade ledger: total CR spent on upgrades and a bar per class from D to X, above the car list and setup sheet." />

</details>

## Playlist

<img src="docs/assets/playlist-v0.4.png" width="100%" alt="Seasonal playlist, Series 5: four week cards, each showing points with reward thresholds as notches on the meter and the two reward cars beneath." />

- **Follows game updates.** With no folder set, the toolkit finds the Steam or Xbox install by itself and checks the game resources every minute while it is open. When an update replaces them, new series, weeks, events and rewards are read in. A game that is still downloading is simply waited for.
- **Reward cars.** Each week's point rewards, the series-total rewards and event rewards come from the game resources. Thresholds sit on each meter and turn green once reached, and cars you own carry a check mark. **Add missing** stages the reward cars you don't have for the garage.
- Choose a week, a whole series or everything, and write completion records and points together. A new series must exist in your save first: open it once in game, quit, then reconnect.

<details><summary><b>Reward cars for the whole series</b></summary>

<img src="docs/assets/rewards-v0.4.png" width="100%" alt="Reward cars for Series 5 by week: 20 and 40 point rewards and event rewards, with owned cars ticked and an Add 5 missing button." />

</details>

## Garage, journal and wristbands

- Search 647 models by name, make, year or ID (common Chinese make names work too). Add 1–20 copies of a model, or one of every missing model.
- Discover Japan and Horizon Festival journals: 38 categories and 2,833 entries. Select single entries, a category, a whole path or everything; completion records and point totals update together.
- Seven wristband ownership records, one at a time or all missing colours.

<details><summary><b>Garage and journal</b></summary>

<img src="docs/assets/garage-v0.4.png" width="100%" alt="Car collection: catalog fields, search, and car cards with class, PI and add buttons." />

<img src="docs/assets/journey-v0.4.png" width="100%" alt="Journey progress: completion, items and points fields above the category index and journal entries." />

</details>

## How changes are written

Nothing is written when you browse. Every selection, from playlist weeks and cars to journal entries and tunes, is staged and marked with a seal. **Back up & apply** then:

1. saves the original file and its `_SCopy`;
2. builds the edited save in memory and checks that untouched cars, columns, tables and save sections are unchanged byte for byte;
3. re-encrypts and decrypts the result to compare it;
4. writes both files.

**Backups & restore** brings back any earlier version and keeps a snapshot of the current one first.

## Content updates

The reader parses `media/ObjectModelGame.zip` for playlists and rewards, and builds car configurations from `media/Stripped/gamedbRC.slt`. A changed encrypted car database needs optional online decryption or an imported content pack. Content sync never reads or uploads player saves. Independent JSON content packs can be imported and exported; see the [content pack format](docs/CONTENT-PACKS.md).

## Build from source

```powershell
npm ci
npm run build
npm start
```

Install and verify the upstream tool as described in [tools/README.md](tools/README.md), then run `npm run package`. `npm run dev` serves only the renderer; save operations need Electron.

## Verification and boundaries

`npm test` runs 49 tests. They cover the save, garage, tuning, library, community parsing, rewards, live sync, catalog, backups and preferences. `npm run verify:desktop` and `npm run verify:journey` drive the real app against a private save copy, and include tuning and build writes end to end. That copy is never published. Details are in [VERIFICATION.md](docs/VERIFICATION.md) and the release's `VERIFICATION-0.4.1.json`.

- Encrypted **player saves** go through the bundled [ForzaCryptoTool](https://github.com/DVS-code/Forza-Crypto-Tool), which uploads the selected save to `forzamods.dev`; the connection dialog says so. Optional online decryption of the **game's** car database sends `gamedbRC.slt` to the same service.
- Community lookups request public codmunity.gg pages only when you open that tab.
- Not verified: in-game loading and driving with written tunes, how the game recalculates copied builds, reward delivery, online sync and future save schemas.
- The reward reader was checked against resources from game build 2.440.853.0, and the built-in Series 6 data comes from a game resource sync on 16 October 2026.
- Install detection was tested on Steam, but a full live sync on a freshly installed game has not been run yet.
- Added cars do not grant ownership of paid content.

[Changelog](CHANGELOG.md) · [Sources and third-party notices](THIRD_PARTY.md) · [Design notes](DESIGN.md)

Independent unofficial project, not affiliated with Microsoft, Xbox or Playground Games. Game content remains the property of its owners.
