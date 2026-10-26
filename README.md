<div align="center">

# ⚡ Titan Quest II — Character, Item & Save Editor

[![Live Web App](https://img.shields.io/badge/Live%20App-titanquest2--editor.vercel.app-gold?style=for-the-badge&logo=vercel&logoColor=white)](https://titanquest2-editor.vercel.app)
[![Unreal Engine](https://img.shields.io/badge/Unreal%20Engine-5.5%20GVAS-blue?style=for-the-badge&logo=unrealengine&logoColor=white)](https://www.unrealengine.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Pure%20Vanilla%20JS)-orange?style=for-the-badge)](#)
[![Offline Ready](https://img.shields.io/badge/Offline%20First-100%25%20Client--Side-brightgreen?style=for-the-badge)](#)

<p align="center">
  <b>A modern, lightning-fast, offline-first Web Save &amp; Item Editor for Titan Quest II (Early Access).</b><br>
  Edit character attributes, mastery &amp; skill trees, build custom gear, socket relics, reset blacksmith limits, and auto-clean save manifests without corrupting game files.
</p>

[🎮 Launch Live Web App](https://titanquest2-editor.vercel.app) · [✨ Features](#-key-features) · [📖 Save Guide](#-savegames-guide--file-locations) · [🛠️ Technical Deep Dive](#%EF%B8%8F-technical-architecture--engine-mechanics) · [🚀 Local Setup](#-running-locally)

---

</div>

## 🌟 Key Features

### 🌐 Multilingual UI
- The editor interface supports English, Vietnamese, and Simplified Chinese, detects the browser language, and lets you switch languages from the header.

### 👤 Single Unified Character View
- **No file juggling**: Integrates equipped gear (`m_Equipment`), backpack items (`m_Inventories[0]`), personal stash tabs (`m_Inventories[3..4]`), and caravan shared stash into a single dashboard.
- **Smart profile auto-detection**: Drop your entire `SaveGames` folder, and the editor instantly scans and indexes all your character profiles (e.g. `Player_01`, `Hero_Warrior`, etc.) with their levels and classes.

### 🔨 Blacksmith Crafting Reset (Xóa Lịch Sử Rèn)
- **Reset forged limits**: In Titan Quest II, forging items at the Blacksmith marks them with `m_CraftingHistory`, capping further modifications.
- **Single-Item Reset**: Clear crafting history on any specific weapon or armor piece to restore it to **Pristine** state for unlimited re-forging.
- **Batch Reset (1-Click)**: Reset all items across equipped slots, bags, and stashes at once.
- **Visual indicators**: Items with active crafting history are clearly labeled with a `🔨` badge in the inventory list.

### 📂 Collapsible & Organized Item List
- **Interactive category headers**: Click on any group header (*Equipped Gear*, *Backpack*, *Stash Tabs*, *Profile Skills*) to expand/collapse with smooth chevron indicators (`▼` / `▶`).
- **Quick controls**: Toolbar with **`🔽 Expand All`** and **`🔼 Collapse All`** buttons to eliminate excessive scrolling.
- **Smart auto-expansion**: Matching categories automatically expand when searching or filtering.

### ⚔️ Authentic Affix & Item Engine
- **PAK/UTOC Whitelisted Catalog**: Scans authentic game PAK files (`TQ2-Windows.utoc`) and filters out 400+ unreleased/corrupt draft CSV keys that crash the engine.
- **Decimal Float Scaling**: Implements native `GrimVentory.EffectScalingModifier.Decimal` tag structs for accurate Energy Regen, Attribute Scaling, and decimal multipliers.
- **Mastery Skill Affixes (T1–T5)**: Full support for both hierarchical `Levels(N)` and Spirit flat `_TN` formats with dynamic level-to-gameplay-effect resolution (`bp_ge_affix_1_ActiveCapacityForgeT1..T5`).
- **Multi-Stat Bundles & Presets**: 1-click combo loader for Forge, Spirit, Warfare, Earth, Storm, Rogue masteries, All-Attributes (+55 Might/Agility/Knowledge/Vigor), and All-Resistances (+32% 5-Res).
- **Affix Slot Conflict Validator**: Real-time validation preventing illegal affix placements (e.g. potion mods on armor, weapon flat dmg on rings) that get stripped by the game engine.

### ⚡ 1-Click Save & Direct Overwrite
- **Direct disk overwriting**: Use the browser File System Access API to select your `SaveGames` folder once, then save changes directly with `Ctrl+S` or 1-click **Save & Overwrite**.
- **Automatic `Saving.sav` cleanup**: TQ2 uses CRC32 checksum manifests in `Saving.sav`. The editor automatically cleans the manifest on save so the game boots directly into your modified saves without rollbacks.
- **Offline backup export**: Export modified profiles as standalone `.zip` archives at any time.

### 🔮 Currency & Quest Spent Synchronization
- **Fix negative quest spending**: Tracks `Spent = Total Earned − Held in Bag`. Easily synchronize Gold, Obols, and Tears to prevent quest progression blockers.

---

## 📸 Overview & Layout

```
┌───────────────────────────────────────┐  ┌────────────────────────────────────────────────────────┐
│ 🌟 Character Profile & Skills         │  │ 🗡️ Greek Knight Cuirass                               │
│  ├─ Attributes & Core Stats (AP Pool) │  │  ├─ Base Item Template (da_armor_torso_greek_knight)   │
│  ├─ Masteries (Earth / Warfare)       │  │  ├─ Values & Rarity Grade (Epic / Rare / Infrequent)   │
│  └─ Currencies & Quest Materials      │  │  ├─ 🌟 Affixes & Stat Modifiers (Prefix / Suffix)      │
│ 📦 Trang bị Đang mặc (Equipped Gear)  │  │  │   ├─ +55 Might (Suffix Tier 10)                     │
│  ├─ 🛡️ Greek Knight Cuirass 🔨        │  │  │   └─ +32% Fire Resistance (Prefix Tier 5)           │
│  └─ ⚔️ Harpe (Unique 1H Sword)         │  │  ├─ 🔨 Thợ Rèn: [🔄 Xóa Lịch Sử Rèn (Reset Blacksmith)]│
│ 🎒 Túi đồ Hành trang (Backpack)       │  │  ├─ 📦 Copy / Transfer to Stash                        │
│ 🏛️ Rương Cá nhân (Personal Stash)     │  │  └─ 🔮 Live RPG Item Tooltip Preview                  │
└───────────────────────────────────────┘  └────────────────────────────────────────────────────────┘
```

---

## 📖 SaveGames Guide & File Locations

### 📍 Save Folder Directory
Titan Quest II saves are located in your local Windows user profile:
```
%LOCALAPPDATA%\TQ2\Saved\SaveGames
```
*Full Path:* `C:\Users\<YourUsername>\AppData\Local\TQ2\Saved\SaveGames`

### 🗂️ Key Save Files
| File Name | Purpose |
| :--- | :--- |
| `<Name>_<Timestamp>_Data_Player.sav` | Core character save (Level, Attributes, Masteries, Equipped Gear, Backpack). |
| `<Name>_<Timestamp>_Data_PlayerLocal.sav` | Personal Stash containers (Tabs 1–2) and local character settings. |
| `<Name>_<Timestamp>_Header.sav` | Metadata header displayed in the game main menu (Name, Level, Playtime). |
| `PublicCrossCharacterSaveData.sav` | Caravan Stash & shared material storage across characters. |
| `Saving.sav` | Unreal Engine CRC32 checksum manifest. |

> [!TIP]
> **Why delete `Saving.sav`?**
> When you modify `.sav` files, their CRC32 checksums change. If `Saving.sav` still has old hashes, the game considers the saves corrupted and rolls back to `.bak` files. Deleting `Saving.sav` (or using **Save & Overwrite**) forces the game to regenerate a fresh valid manifest.

---

## 🚀 Running Locally

The editor requires **no build tools, no Node.js runtime, and zero external packages** to run—it is 100% pure vanilla modern JavaScript (ES6+).

### Option 1: Open Directly in Browser
Simply clone the repository and double-click `index.html` in Chrome, Edge, or Brave:
```bash
git clone https://github.com/huy4vn/titanquest2-editor.git
cd titanquest2-editor
# Open index.html in your browser
```

### Option 2: Run Local Dev Server
```bash
# Using Python
python -m http.server 8080

# Or using Node
npx serve .
```
Navigate to `http://localhost:8080` in your web browser.

---

## 🛠️ Technical Architecture & Engine Mechanics

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Titan Quest II Save Editor                    │
├──────────────────────┬──────────────────────────┬───────────────────────┤
│   Core GVAS Engine   │     Domain & Catalog     │       UI Modules      │
│   (js/core/gvas.js)  │     (js/core/tq2.js)     │       (js/ui/*)       │
├──────────────────────┼──────────────────────────┼───────────────────────┤
│ • GVAS Binary Parser │ • Item & Container Models│ • Unified Character   │
│ • UE 5.5 Tagged Props│ • Affix Slot Compatibility│ • Item & Affix Editor │
│ • Struct & Handle Map│ • Decimal Scale Modifier │ • Live RPG Tooltip    │
│ • CRC32 & Zip Worker │ • Blacksmith Reset Logic │ • Searchable Popovers │
└──────────────────────┴──────────────────────────┴───────────────────────┘
```

### 1. Decimal Scaling Modifiers (`GrimVentory.EffectScalingModifier.Decimal`)
In Titan Quest II, decimal affixes (e.g. `+5.2 Energy Regen/s`) are not written into integer `Scale` properties. They are stored inside a `ScaleModifiers` MapProperty with:
- **Key Struct**: `GrimEffectScalingModifierTag` (`TagName: 'GrimVentory.EffectScalingModifier.Decimal'`)
- **Value Scalar**: Float (`f32`)
The editor automatically serializes and deserializes these tags safely.

### 2. Blacksmith Reset (`m_CraftingHistory`)
Forging items at the blacksmith adds a struct named `m_CraftingHistory` to the item's property list. Removing this struct resets the item's crafting counter to 0, restoring full forging capacity in-game.

### 3. Rebuilding the Game Catalog
If game patches release new item CSVs or PAK assets:
```bash
# Rebuild compressed catalog
node js/data/build_catalog.js

# Run verification test suite
node scratch/verify_all_modules.js
```

---

## 🤝 Contributing

Contributions, bug reports, and affix research are warmly welcomed!
1. Fork the Project (`https://github.com/huy4vn/titanquest2-editor/fork`)
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">
  <sub>Titan Quest II is a registered trademark of THQ Nordic GmbH / Grimlore Games. This project is an open-source fan tool and is not affiliated with or endorsed by THQ Nordic.</sub>
</div>
