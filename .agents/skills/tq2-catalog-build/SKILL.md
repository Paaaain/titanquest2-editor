---
name: tq2-catalog-build
description: >-
  Rules, specifications, CSV parsing logic, UTOC/PAK asset whitelisting, decimal scale modifier mechanics (GrimVentory.EffectScalingModifier.Decimal), save file standard (D:\TQ2Saves), log/crash locations (AppData\Local\TQ2\Saved\Logs & Crashes), and verification procedures for building and auditing the Titan Quest 2 Item Editor catalog (catalog.js, build_catalog.js, text parsing, Spirit/Mastery affix mappings).
---

# Titan Quest 2 - Catalog Building, Affix Auditing & Decimal Scale Skill

This skill contains the authoritative reference, specifications, and workflows for extracting, maintaining, auditing, and compiling the game catalog (`catalog.js`) from raw game CSVs (`Text/Items/`), PAK/UTOC asset packages (`TQ2-Windows.utoc`), and live save files (`D:\TQ2Saves`) for the Titan Quest 2 Item Editor.

---

## 0. Save File Directory Standard (Live Save Source of Truth)

> [!IMPORTANT]
> **Primary Live Save Location**: The latest game save files are **ALWAYS** located at:
> `D:\TQ2Saves` (Node / POSIX path: `D:/TQ2Saves`)
>
> Anytime you or any script, task, subagent, or inspector needs to check, read, parse, or debug save files, you **MUST ALWAYS inspect `D:\TQ2Saves` first**.

### Key Save File Architecture:
- `Huy_<timestamp>_Data_Player.sav`: Core character save containing attributes (`m_CharacterLevel`, `m_CharacterAP`, might/agility/knowledge/vigor), skill allocations, equipped gear (`m_Equipment`), and backpack items (`m_Inventories[0]`).
- `Huy_<timestamp>_Data_PlayerLocal.sav`: Personal stash containers (`m_Inventories[3..4]`) and local character configuration.
- `Huy_<timestamp>_Header.sav`: Metadata header containing `m_CharacterName`, `m_Level`, and `m_TotalPlayTimeSeconds`.
- `PublicCrossCharacterSaveData.sav` / `PublicCrossCharacterSaveData_Local.sav`: Shared caravan stash & currency storage across characters.
- `Saving.sav`: CRC32 checksum manifest file used by Unreal Engine / TQ2.

### Syncing & Testing Saves:
When the game saves or user updates `D:\TQ2Saves`, sync the repository copies and test bundles with:
```bash
node scratch/sync_saves.js
```
This updates:
1. `d:\TitanQuest2\SaveGames` (repository local copy)
2. `d:\TitanQuest2\js\data\sample-saves.js` (`window.__HUY_SAVES__` embedded test bundle)
3. `d:\TitanQuest2\Huy_SaveGames.zip` (downloadable zip archive)

---

## 0.1 Game Logs & Crash Diagnostics Standard

> [!IMPORTANT]
> **Game Logs & Crash Diagnostics Locations**:
> Whenever you need to read or diagnose game activity, asset resolution warnings, save loading errors, or game crashes, inspect these standard locations:
> 
> 1. **Live Game Logs Directory**:
>    `C:\Users\huy4vn\AppData\Local\TQ2\Saved\Logs` (POSIX / Node: `C:/Users/huy4vn/AppData/Local/TQ2/Saved/Logs`)
>    - **Active Session Log**: `TQ2.log` (Primary live log generated during gameplay / save loading)
>    - **Timestamped Backups**: `TQ2-backup-<YYYY.MM.DD-HH.MM.SS>.log`
> 
> 2. **Game Crash Reports Directory**:
>    `C:\Users\huy4vn\AppData\Local\TQ2\Saved\Crashes` (POSIX / Node: `C:/Users/huy4vn/AppData/Local/TQ2/Saved/Crashes`)
>    - Contains Unreal Engine Crash Reporter folders (`UECC-Windows-...`) with minidumps (`.dmp`), crash logs, and XML diagnostic manifests when a crash occurs.

---

## 1. UTOC / PAK Asset Whitelisting & Ghost CSV Filtering

> [!CAUTION]
> **Never blindly generate affixes from raw CSV keys without verifying existence in `TQ2-Windows.utoc`!**
> 
> The game's raw CSV localization files (`Text/Items/st_item_names_prefix.csv`, `st_item_effectdesc_generic.csv`, etc.) contain **over 400 draft, deprecated, or unreleased affixes** that do not have corresponding DataAssets or GameplayEffects inside the game PAK files.
> If the Item Editor presents non-existent affixes (e.g. `da_prefix_1_PerIncreasedMight` or `da_prefix_1_PerIncreasedMightTooltipText`), Unreal Engine's `GrimVentory` loader fails to resolve them on load and **strips the affix slot completely, leaving only real affixes**.

### A. UTOC Scanning in `build_catalog.js`:
The catalog compiler scans `D:/Titan.Quest.II/TQ2/Content/Paks/TQ2-Windows.utoc` to extract all genuine `da_prefix_`, `da_suffix_`, `da_implicit_`, `da_affix_`, and `da_unique_` DataAssets.
Only affixes that are:
1. Authentic from player save drops (`authenticAffixes`), OR
2. Present in the `utocDaSet` whitelist
are registered into `CAT.a` (total ~217 verified real affixes in Early Access).

### B. Attribute Affixes Architecture:
- **Flat Attributes (Suffixes)**:
  - `da_suffix_1_Might` $\rightarrow$ `bp_ge_affix_1_Might` (`+55 Might`)
  - `da_suffix_1_Agility` $\rightarrow$ `bp_ge_affix_1_Agility` (`+55 Agility`)
  - `da_suffix_1_Knowledge` $\rightarrow$ `bp_ge_affix_1_Knowledge` (`+55 Knowledge`)
  - `da_suffix_1_Vigor` $\rightarrow$ `bp_ge_affix_1_Vigor` (`+55 Vigor`)
- **Percentage Attributes (Prefix)**:
  - `da_prefix_1_PerIncreasedAttributes` $\rightarrow$ `bp_ge_affix_1_PerIncreasedAttributes` (`+% All Attributes`)
- **Note**: Single `% Inc. Might` / `% Inc. Agility` affixes do NOT exist in the game. Any CSV entry like `prefix_1_PerIncreasedMight` or `prefix_1_PerIncreasedMightTooltipText` is an unreleased draft/corrupted key and must be filtered out.

---

## 2. Float / Decimal Scaling & `GrimVentory.EffectScalingModifier.Decimal`

> [!IMPORTANT]
> **Decimal Affix Values (Energy Regen, Attribute Scaling, Decimals)**:
> In Titan Quest 2 save files, float values (such as `+5.2 Energy Regeneration/s` or `0.4x DmgAttributeScaling`) are NOT stored directly in the `Scale` property of `GrimItemAffixEffectInstance`.
> Instead, they are stored inside a `MapProperty` named **`ScaleModifiers`** with:
> - **Key Struct**: `GrimEffectScalingModifierTag` with `TagName: 'GrimVentory.EffectScalingModifier.Decimal'`
> - **Value**: Float scalar (`Scalar('f32', 5.2)`)
> 
> The outer `Scale` property only holds the rounded integer base (e.g. `5`).
> If `ScaleModifiers` is empty or missing the `Decimal` tag, the game calculates the decimal modifier as **`0`**!

### Implementation Standard in `js/core/tq2.js`:
```javascript
// Reading float values:
function getEffectScale(effNode) {
  if (!effNode || !effNode.body) return 1;
  const smProp = effNode.body.get('ScaleModifiers');
  if (smProp && smProp.value instanceof G.MapV) {
    for (const [k, v] of smProp.value.pairs) {
      if (k instanceof G.Struct && k.body instanceof G.PropList) {
        const tn = k.body.get('TagName');
        if (tn && tn.value && tn.value.v === 'GrimVentory.EffectScalingModifier.Decimal') {
          return v.v;
        }
      }
    }
  }
  const scProp = effNode.body.get('Scale');
  return (scProp && scProp.value) ? scProp.value.v : 1;
}

// Writing float values:
function setEffectScale(effNode, val, forceDecimal = null) {
  if (!effNode || !effNode.body) return;
  const numVal = parseFloat(val) || 0;
  const scProp = effNode.body.get('Scale');
  if (scProp && scProp.value) scProp.value.set(numVal);

  const smProp = effNode.body.get('ScaleModifiers');
  const isDecimal = forceDecimal !== null ? forceDecimal : !Number.isInteger(numVal);

  if (smProp && smProp.value instanceof G.MapV) {
    let found = false;
    for (const [k, v] of smProp.value.pairs) {
      if (k instanceof G.Struct && k.body instanceof G.PropList) {
        const tn = k.body.get('TagName');
        if (tn && tn.value && tn.value.v === 'GrimVentory.EffectScalingModifier.Decimal') {
          v.set(numVal);
          found = true;
          break;
        }
      }
    }
    if (!found && isDecimal) {
      const tagStruct = createEffectScalingModifierTag('GrimVentory.EffectScalingModifier.Decimal');
      const valScalar = new G.Scalar('f32', numVal);
      valScalar.mark();
      smProp.value.pairs.push([tagStruct, valScalar]);
      smProp.value.mark();
    }
  }
  effNode.mark();
}
```

### UI Stepper Standard:
In `js/ui/components.js` and `js/ui/item-editor.js`:
- For decimal-enabled affixes (`Regen`, `Scaling`, float values), `step` is `0.1` and stepper buttons render as `+0.1`, `+0.5`, `+1.0`.
- All float values are rounded to 2 decimal places (`Math.round(v * 100) / 100`) to avoid JavaScript floating point precision artifacts.

---

## 3. GameplayEffect Mapping & Pathing Rules (`resolveGameplayEffects`)

Every synthetic affix node generated in `build_catalog.js` must resolve to an authentic Blueprint GameplayEffect (`bp_ge_...`) path matching the game's naming rules:

1. **Tier 0 Preservation**:
   - `prefix_0_XYZ` and `suffix_0_XYZ` MUST map to `bp_ge_affix_0_XYZ`.
   - Never hardcode `bp_ge_affix_1_` for tier 0 affixes.
2. **Abbreviation & Keyword Mappings**:
   - `PerIncreasedCooldownSpeed` $\rightarrow$ `bp_ge_affix_1_PerIncreasedCooldownReduction`
   - `PerIncrRetaliationRange` / `PerIncreasedRetaliationRange` $\rightarrow$ `bp_ge_affix_1_PerIncrRetaliationRange`
   - `Per<Type>Res` (Fire, Cold, Lightning, Poison, Physical, Impair, Ailment) $\rightarrow$ `bp_ge_affix_${tier}_PerRes<Type>`
   - `Summons_PerIncreasedDamage_All` $\rightarrow$ `bp_ge_affix_1_PerIncreasedAllDmg`
   - `Summons_PerIncreasedSpeed_All` $\rightarrow$ `bp_ge_affix_1_PerIncreasedSpeed`
   - `Summons_PerIncreasedActivations` $\rightarrow$ `bp_ge_affix_1_Activations_PerIncreasedAmount`
3. **Subdirectory Routing**:
   - Unique Affixes $\rightarrow$ `/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_...`
   - Implicit Affixes $\rightarrow$ `/Game/TQ2/Items/Affixes/GameplayEffects/Implicits/bp_ge_implicit_1_...`
   - Potion Affixes $\rightarrow$ `/Game/TQ2/Items/Affixes/GameplayEffects/Potions/bp_ge_affix_1_Potion_...`
4. **Scale Rules**:
   - `PointsTo`, `ActiveCapacity`, `PassiveLevel` default to `Scale = 1.0`.
   - Float / Decimal affixes default to `Scale = 5.0` with `GrimVentory.EffectScalingModifier.Decimal`.
   - Standard stat affixes default to `Scale = 10.0`.

---

## 4. Mastery Skill Affixes & CSV Parsing Specifications

### A. Two Distinct CSV Tier Formats:
1. **Hierarchical `Levels(N)` Format** (Earth, Storm, Warfare, Rogue, Generic):
   - Example: `"da_suffix_1_ActiveCapacityEarth.m_Levels.Levels(0).Levels.AffixEffects(0).AffixEffects.TooltipText"`
   - `Levels(N)` is 0-indexed (`0..5`).
   - `TitleText` goes into `affixTierMap` (Affix Name per tier).
   - `TooltipText` goes into `affixTierTooltips` (Effect description per tier).

2. **Flat `_TN` Format** (Spirit Mastery):
   - Example: `"da_suffix_1_PassiveLevelSpirit_T1"`, `"da_suffix_1_CapacitySpirit_T1"`
   - `_T1` .. `_T6` is 1-indexed; must subtract 1 (`T1 -> 0`, `T6 -> 5`).
   - **Crucial Alias Rule**: Game CSV uses `suffix_1_CapacitySpirit_TN`, but game asset is named `da_suffix_1_ActiveCapacitySpirit`. Must alias:
     ```javascript
     if (baseKey === 'suffix_1_CapacitySpirit') baseKey = 'suffix_1_ActiveCapacitySpirit';
     ```

### B. Valid Item Slots for Skill Modifiers:
- `PassiveLevel<Mastery>` (Suffix): Valid on **Helmets (Mũ)**, **Amulets (Dây chuyền)**, **Relics**.
- `PointsTo<Mastery>Passives` / `PointsToAllPassives` (Prefix): Valid on **Helmets**, **Amulets**, **Relics**.
- `ActiveCapacity<Mastery>` (Suffix): Valid on **Helmets**, **Rings (Nhẫn)**, **Amulets**, **Relics**.

---

## 5. Standard Rebuilding & Audit Workflow

Whenever game text, saves, or affix mappings are updated:

### Step 1: Recompile Catalog
```bash
node js/data/build_catalog.js
```
Verify summary:
- Authentic affixes: >100
- Total Affixes: ~217 verified real affixes
- Total Item Templates: >2000

### Step 2: Run Verification Audit Suite
```bash
node scratch/verify_all_modules.js
node scratch/correct_audit.js
```
Both test suites must return clean exit code 0.

### Step 3: Deploy to Production
```bash
npx vercel --prod --yes
```
Verify live app at: https://titanquest2-editor.vercel.app/
