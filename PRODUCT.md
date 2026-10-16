# Product

<!-- impeccable:product-schema 1 -->

> Written 2026-10-16 from repository evidence (README, CHANGELOG, docs, source). The owner delegated design and product framing decisions ("随你便"); facts marked *inferred* were not separately confirmed.

## Platform

web

Rendered inside an Electron desktop shell on Windows x64 (window min 1120×780, default 1440×940). Save operations require the desktop shell; `npm run dev` serves the renderer only.

## Users

PC players of Forza Horizon 6 (Japan setting) who play single-player progression and care about their garage: completing festival playlist weeks, filling the Discover Japan / Festival journals, collecting cars and wristbands, and tuning and upgrading cars. Chinese-first audience with full English support. *Inferred:* they use the tool at their gaming desk between play sessions, with the game closed, often in the evening.

## Product Purpose

An unofficial local workshop that opens the player's own FH6 save, shows what the festival has recorded (playlist weeks, journal entries, wristbands, garage, tunes, upgrade spending), and writes only the changes the player picks back to the save, with a backup first. Success: the player sees their save truthfully, understands exactly what will change, and can always return to the previous version.

## Positioning

Reads the real save rather than guessing: playlist events, journal records, the garage database, every car's tuning slider values, upgrade parts and the CR price actually paid for each. Changes are verified at the data layer (unchanged rows, tables and states are compared byte-for-byte) and every write is preceded by a restorable backup.

## Operating Context

- Workflow: quit the game → connect a save (`C_ProfileData`, encrypted saves round-trip through ForzaCryptoTool's online service at forzamods.dev) → browse and select → "Back up & apply" → reopen the game.
- Areas: Festival playlist (series × four seasonal weeks), Garage (add catalog cars), Journey (journals and wristbands), Tuning workshop (tunes, upgrades, CR ledger, scenario calculator, tune library, community share codes), Content updates (local game resource sync, content packs, GitHub release checks), Backups & restore.
- Community tunes are share codes from codmunity.gg; full settings only exist on Forza servers and are downloaded in-game.

## Capabilities and Constraints

- Never edits a save automatically; nothing is written until the player applies.
- Refuses unsupported save schemas instead of inventing data.
- Tuning values are slider positions; tyre pressure, gearing, alignment, anti-roll, damping, brakes and differential decode to real units, while springs, ride height, aero and final drive stay as slider positions until the game database is available.
- Does not change the player's CR balance; upgrade costs are reported, not charged.
- In-game effects, rewards and online sync are not verified and must not be claimed.

## Brand Commitments

- Name: Horizon Festival Toolkit ("Festival Toolkit"), Windows edition; independent and unofficial, not affiliated with Microsoft, Xbox or Playground Games.
- Bilingual: Simplified Chinese, English, or follow system.
- Tagline in use: "YOUR FESTIVAL. YOUR WAY."

## Evidence on Hand

- Real catalog data: 647 car models (`data/cars.json`), 38 journal categories / 2,833 entries (`data/progression.json`), playlist series (`data/seasons.json`).
- In-game series cover art is read from the player's local game files at runtime; it belongs to its rights holders and is not bundled.
- No testimonials, user counts or download figures exist; do not fabricate them.

## Product Principles

1. Show the save as it is before offering to change it.
2. Every change is previewed, scoped and reversible.
3. Say plainly what is verified and what is not.
4. The player's choice is the only trigger for a write or a network request to a third party.

## Accessibility & Inclusion

Full keyboard operation, visible focus, reduced-motion support, and complete Chinese/English parity for every control and message (existing commitments in the codebase).
