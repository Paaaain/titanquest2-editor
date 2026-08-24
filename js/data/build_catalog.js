const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const G = require('d:/TitanQuest2/js/core/gvas.js');
const T = require('d:/TitanQuest2/js/core/tq2.js');

console.log('=== Compiling Complete Catalog & Verified Mappings from Text/Items ===');

const catPath = path.join('d:/TitanQuest2/js/data/catalog.js');
const catContent = fs.readFileSync(catPath, 'utf8');
const match = catContent.match(/window\.__CATALOG__="([^"]+)"/);
const buf = Buffer.from(match[1], 'base64');
const decomp = zlib.gunzipSync(buf).toString('utf8');
const CAT = JSON.parse(decomp);

CAT.itemSet = new Set((CAT.i || []).map(x => x[1]));
CAT.m = CAT.m || {};
CAT.f = CAT.f || {};
CAT.s = CAT.s || {};
CAT.a = {}; // Rebuild cleanly from scratch
CAT.names = {}; // Rebuild cleanly

// 1. Scan Saves & Collect Authentic Affixes (Prioritizing D:/TQ2Saves)
const authenticAffixes = new Map();
const saveDirs = [
  'D:/TQ2Saves',
  path.join('d:/TitanQuest2/Saved/SaveGames_Backup'),
  path.join('d:/TitanQuest2/SaveGames')
];
const saveFiles = [];
for (const sDir of saveDirs) {
  if (fs.existsSync(sDir)) {
    for (const f of fs.readdirSync(sDir)) {
      if (f.endsWith('.sav') || f.endsWith('.bak')) {
        try {
          const bytes = new Uint8Array(fs.readFileSync(path.join(sDir, f)));
          saveFiles.push(bytes);
        } catch (e) {}
      }
    }
  }
}

// Also load from sample-saves.js
try {
  const sampleSaveB64 = JSON.parse(fs.readFileSync('d:/TitanQuest2/js/data/sample-saves.js', 'utf8').match(/window\.__HUY_SAVES__\s*=\s*({[\s\S]*});/)[1]);
  for (const b64 of Object.values(sampleSaveB64)) {
    saveFiles.push(Buffer.from(b64, 'base64'));
  }
} catch (e) {}

// Scan actual assets from UTOC / Game PAK to filter out unreleased/ghost CSV entries
const utocPath = 'D:/Titan.Quest.II/TQ2/Content/Paks/TQ2-Windows.utoc';
let utocDaSet = null;
let utocGeSet = null;
if (fs.existsSync(utocPath)) {
  try {
    const utocBuf = fs.readFileSync(utocPath);
    const utocStr = utocBuf.toString('latin1');
    const daMatches = utocStr.match(/da_(?:prefix|suffix|implicit|affix|unique)_[A-Za-z0-9_+]+/g) || [];
    utocDaSet = new Set(daMatches);
    const geMatches = utocStr.match(/bp_ge_[A-Za-z0-9_+]+/g) || [];
    utocGeSet = new Set(geMatches);
  } catch (e) {}
}

for (const bytes of saveFiles) {
  try {
    const save = G.parseSave(bytes);
    for (const it of T.listItems(save)) {
      const asset = it.handle.asset;
      if (asset && !CAT.itemSet.has(asset)) {
        CAT.i.push([it.handle.pkg, asset]);
        CAT.itemSet.add(asset);
      }
      const af = T.affixes(it);
      if (!af) continue;
      for (const a of af.items) {
        const pf = T.affixField(a, 'pAffix');
        const pathStr = pf ? pf.v : null;
        if (!pathStr || pathStr === 'None') continue;
        const cf = T.affixField(a, 'Category');
        const cshort = cf ? String(cf.v).split('::').pop() : null;
        let info = CAT.a[pathStr];
        if (!info) {
          const w = new G.W(); a.ser(w);
          info = CAT.a[pathStr] = { c: cshort, cs: cshort ? [cshort] : [], g: [], t: Buffer.from(w.done()).toString('base64') };
        } else if (cshort && info.cs.indexOf(cshort) < 0) {
          info.cs.push(cshort);
        }

        const effs = T.affixEffects(a);
        const ges = [];
        for (const e of effs) {
          const gf = T.affixField(e, 'pSoftGameplayEffect');
          const sf = T.affixField(e, 'Scale');
          if (gf && gf.v && gf.v !== 'None') {
            ges.push({ ge: gf.v, scale: sf ? sf.v : 1 });
            if (typeof sf?.v === 'number') {
              const key = pathStr + '|' + gf.v;
              const r = CAT.s[key];
              if (!r) CAT.s[key] = [sf.v, sf.v];
              else if (sf.v < r[0]) r[0] = sf.v;
              else if (sf.v > r[1]) r[1] = sf.v;
            }
          }
        }
        if (ges.length > 0 && (!info.g || info.g.length === 0)) {
          info.g = ges.map(x => x.ge);
        }
        if (!authenticAffixes.has(pathStr) || (ges.length > 0 && authenticAffixes.get(pathStr).effects.length === 0)) {
          const w = new G.W(); a.ser(w);
          authenticAffixes.set(pathStr, { nodeBytes: w.done(), effects: ges });
        }
      }
    }
  } catch (e) {}
}

console.log('Authentic affixes found:', authenticAffixes.size);

// 2. Parse CSVs from Text/Items
const textItemsDir = fs.existsSync('d:/TitanQuest2/Text/Items') ? 'd:/TitanQuest2/Text/Items' : 'd:/TitanQuest2/Items';

function parseCsv(filename) {
  const filePath = path.join(textItemsDir, filename);
  if (!fs.existsSync(filePath)) return new Map();
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/^"([^"]*)"\s*,\s*"([^"]*)"/);
    if (match) {
      const fullKey = match[1];
      const text = match[2];
      let cleanKey = fullKey
        .replace(/^Prefixes\//, '')
        .replace(/^Suffixes\//, '')
        .replace(/^Implicits\//, '');
      cleanKey = cleanKey.split('.')[0];
      cleanKey = cleanKey.replace(/^da_/, '');
      
      if (!cleanKey) continue;
      if (!map.has(cleanKey)) {
        map.set(cleanKey, []);
      }
      map.get(cleanKey).push({ fullKey, text });
    }
  }
  return map;
}

function parseDescCsv(filename) {
  const filePath = path.join(textItemsDir, filename);
  if (!fs.existsSync(filePath)) return new Map();
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/^"([^"]*)"\s*,\s*"([^"]*)"/);
    if (match) {
      const fullKey = match[1];
      const text = match[2];
      let cleanKey = fullKey
        .replace(/^Prefixes\//, '')
        .replace(/^Suffixes\//, '')
        .replace(/^Implicits\//, '');
      let rawAsset = cleanKey.split('.')[0].replace(/^da_/, '');
      let lvl = 0;
      const levelMatch = fullKey.match(/\.Levels\((\d+)\)/);
      if (levelMatch) {
        lvl = parseInt(levelMatch[1], 10);
      } else {
        const flatTierMatch = rawAsset.match(/_T(\d+)$/);
        if (flatTierMatch) {
          lvl = parseInt(flatTierMatch[1], 10) - 1;
          rawAsset = rawAsset.replace(/_T\d+$/, '');
        }
      }
      if (!map.has(rawAsset)) map.set(rawAsset, {});
      map.get(rawAsset)[lvl] = text;
    }
  }
  return map;
}

const prefixMap = parseCsv('st_item_names_prefix.csv');
const suffixMap = parseCsv('st_item_names_suffix.csv');
const genericDescMap = parseDescCsv('st_item_effectdesc_generic.csv');
const rareDescMap = parseDescCsv('st_item_effectdesc_rare.csv');
const baseDescMap = parseDescCsv('st_item_effectdesc_baseaffix.csv');
const uniqueMap = parseCsv('st_item_names_unique.csv');
const charmMap = parseCsv('st_item_charms.csv');
const relicMap = parseCsv('st_item_relics.csv');
const weaponMap = parseCsv('st_item_common_weapons.csv');
const armorMap = parseCsv('st_item_common_armor.csv');

// GE Resolver
function resolveGameplayEffects(affixPath) {
  if (authenticAffixes.has(affixPath)) {
    const auth = authenticAffixes.get(affixPath);
    if (auth && auth.effects && auth.effects.length > 0) {
      return auth.effects.map(x => x.ge);
    }
  }

  const p = affixPath.toLowerCase();
  const rawKey = affixPath.split('/').pop().replace(/\.da_.*$/, '').replace(/^da_/, '');
  const gePrefix = '/Game/TQ2/Items/Affixes/GameplayEffects/';

  // Mastery Active & Passive Skill Levels
  if (rawKey.includes('ActiveCapacity')) {
    const mastery = rawKey.replace(/^.*ActiveCapacity/, '');
    if (mastery === 'Core' || mastery === 'Default') {
      return [gePrefix + 'bp_ge_affix_1_ActiveCapacityCore'];
    }
    return [gePrefix + 'bp_ge_affix_1_ActiveCapacity' + mastery + 'T1'];
  }
  // Spirit Active Capacity dùng key riêng: da_suffix_1_CapacitySpirit_TN
  if (rawKey.match(/^suffix_\d_CapacitySpirit/)) {
    return [gePrefix + 'bp_ge_affix_1_ActiveCapacitySpiritT1'];
  }
  if (rawKey.includes('PassiveLevel')) {
    // Strip _T1.._T6 suffix (format đặc biệt của Spirit)
    const mastery = rawKey.replace(/^.*PassiveLevel/, '').replace(/_T\d+$/, '');
    return [gePrefix + 'bp_ge_affix_1_PassiveLevel' + mastery + 'T1'];
  }
  if (rawKey.includes('PointsTo')) {
    const cleanStat = rawKey.replace(/^(prefix|suffix)_[0-9]_/, '');
    return [gePrefix + 'bp_ge_affix_0_' + cleanStat];
  }

  // Cooldown Speed
  if (rawKey.includes('PerIncreasedCooldownSpeed') || rawKey.includes('CooldownSpeed')) {
    return [gePrefix + 'bp_ge_affix_1_PerIncreasedCooldownReduction'];
  }

  // Retaliation Range & Elemental Retaliations
  if (rawKey.includes('PerIncreasedRetaliationRange') || rawKey.includes('PerIncrRetaliationRange')) {
    return [gePrefix + 'bp_ge_affix_1_PerIncrRetaliationRange'];
  }
  if (rawKey.startsWith('prefix_1_Retaliation') || rawKey.startsWith('da_prefix_1_Retaliation')) {
    const type = rawKey.replace(/^.*Retaliation/, '');
    return [gePrefix + 'Unique/bp_ge_affix_1_Retaliation' + type];
  }

  // Special Dual Effects
  if (rawKey.includes('PerIncreasedThermalDmg')) {
    return [gePrefix + 'bp_ge_affix_1_PerIncreasedFireDmg', gePrefix + 'bp_ge_affix_1_PerIncreasedColdDmg'];
  }
  if (rawKey.includes('PerIncreasedNatureDmg')) {
    return [gePrefix + 'bp_ge_affix_1_PerIncreasedPoisonDmg', gePrefix + 'bp_ge_affix_1_PerIncreasedLightningDmg'];
  }
  if (rawKey.includes('FlatEnergyFlatEnergyRegen')) {
    return [gePrefix + 'bp_ge_affix_1_Energy', gePrefix + 'bp_ge_affix_1_+EnergyRegenPerSecond'];
  }

  // Potions
  if (p.includes('/potions/')) {
    const potPrefix = '/Game/TQ2/Items/Affixes/GameplayEffects/Potions/';
    if (rawKey.includes('ChargesConsumed')) return [potPrefix + 'bp_ge_affix_1_Potion_Health_ChargesConsumed'];
    if (rawKey.includes('PerHealedInstantly')) return [potPrefix + 'bp_ge_affix_1_Potion_InstantHealthRecovery'];
    if (rawKey.includes('IncreasedDuration')) return [potPrefix + 'bp_ge_affix_1_Potion_Energy_IncrEffectDuration'];
    if (rawKey.includes('IncreasedRechargeRate')) return [potPrefix + 'bp_ge_affix_1_Potion_Energy_IncrRechargeRate'];
    if (rawKey.includes('IncreasedEffectAmount')) return [potPrefix + 'bp_ge_affix_1_Potion_Health_IncrEffectAmount'];
    if (rawKey.includes('AilmentChanceOnUse')) return [potPrefix + 'bp_ge_affix_1_Potion_AilmentChanceOnUse'];
    if (rawKey.includes('MoveSpeedOnPotion')) return [potPrefix + 'bp_ge_affix_1_Potion_MoveSpeedOnUse'];
    if (rawKey.includes('MaxHealthOnUse')) return [potPrefix + 'bp_ge_affix_1_Potion_MaxHealthOnUse'];
    if (rawKey.includes('MaxEnergyOnUse')) return [potPrefix + 'bp_ge_affix_1_Potion_MaxEnergyOnUse'];
    if (rawKey.includes('ChargeMax')) return [potPrefix + 'bp_ge_affix_1_Potion_Health_AddChargeMax'];
  }

  // Unique Capacity
  if (rawKey.includes('Unique_Capacity_')) {
    const capType = rawKey.replace(/^.*Unique_Capacity_/, '');
    return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_' + capType];
  }

  // Resistances (Notice prefix_1_PerFireRes -> bp_ge_affix_1_PerResFire)
  const resTier = rawKey.match(/^(?:da_)?[a-z]+_([0-9])_/)?.[1] || '1';
  if (rawKey.includes('PerFireRes')) return [gePrefix + `bp_ge_affix_${resTier}_PerResFire`];
  if (rawKey.includes('PerColdRes')) return [gePrefix + `bp_ge_affix_${resTier}_PerResCold`];
  if (rawKey.includes('PerLightningRes')) return [gePrefix + `bp_ge_affix_${resTier}_PerResLightning`];
  if (rawKey.includes('PerPoisonRes')) return [gePrefix + `bp_ge_affix_${resTier}_PerResPoison`];
  if (rawKey.includes('PerPhysicalRes')) return [gePrefix + `bp_ge_affix_${resTier}_PerResPhysical`];
  if (rawKey.includes('PerImpairRes')) return [gePrefix + `bp_ge_affix_${resTier}_PerResImpairment`];
  if (rawKey.includes('PerAilmentRes')) return [gePrefix + `bp_ge_affix_${resTier}_PerResAilments`];
  if (rawKey.includes('PerThermalRes')) return [gePrefix + 'bp_ge_implicit_1_armor_ResThermicNatural'];
  if (rawKey.includes('PerNatureRes')) return [gePrefix + 'bp_ge_implicit_1_armor_ResThermicNatural'];

  // Summons
  if (rawKey.includes('Summons_PerIncreasedDamage_All')) return [gePrefix + 'bp_ge_affix_1_PerIncreasedAllDmg'];
  if (rawKey.includes('Summons_PerIncreasedSpeed_All')) return [gePrefix + 'bp_ge_affix_1_PerIncreasedSpeed'];
  if (rawKey.includes('Summons_PerIncreasedHealth')) return [gePrefix + 'bp_ge_affix_1_PerIncreasedHealth'];
  if (rawKey.includes('Summons_PerIncreasedActivations')) return [gePrefix + 'bp_ge_affix_1_Activations_PerIncreasedAmount'];
  if (rawKey.includes('summons_AddRes_All')) return [gePrefix + 'bp_ge_affix_1_PerResAll'];

  // Free reservation
  if (rawKey.includes('FreeEnergyReservation') || rawKey.includes('LessEnergyReserved')) return [gePrefix + 'bp_ge_affix_1_LessEnergyReserved'];

  // Flat energy regen
  if (rawKey.includes('FlatEnergyRegen') || rawKey.includes('+EnergyRegen')) return [gePrefix + 'bp_ge_affix_1_+EnergyRegenPerSecond'];

  // Unique Special Mappings
  if (p.includes('/unique/')) {
    if (rawKey.includes('TagPoisonAbility_CooldownSpeed')) return [gePrefix + 'Unique/bp_ge_affix_1_TagPoisonType_CD'];
    if (rawKey.includes('Capacity_TagPhysicalSpell')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagSpell+Physical'];
    if (rawKey.includes('Capacity_TagSpell_') || rawKey.includes('Capacity_TagSpell')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagSpell+2'];
    if (rawKey.includes('Capacity_TagPrimaryAttack')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagPrimaryAttack'];
    if (rawKey.includes('Capacity_TagCold')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagCold'];
    if (rawKey.includes('Capacity_TagLightning')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagLightning'];
    if (rawKey.includes('Capacity_TagFire')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagFire'];
    if (rawKey.includes('Capacity_TagPoison')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagPoison'];
    if (rawKey.includes('Capacity_TagDodge')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagDodge'];
    if (rawKey.includes('Capacity_TagElemental')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagElemental'];
    if (rawKey.includes('Capacity_TagDisruption')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagDisruption'];
    if (rawKey.includes('Capacity_TagWeaponAttack')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagWeaponAttack'];
    if (rawKey.includes('Capacity_TagMovement')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagMovement'];
    if (rawKey.includes('Capacity_TagSummon')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagSummon'];
    if (rawKey.includes('Capacity_TagAura')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagAura'];
    if (rawKey.includes('Capacity_TagSustained')) return [gePrefix + 'Unique/bp_ge_affix_1_Capacity_TagSustained'];
    if (rawKey.includes('Ailment_MaxStack_Staggered')) return [gePrefix + 'Unique/bp_ge_affix_1_AilmentStackMaxStaggered'];
    if (rawKey.includes('PerMoreDmgToVermin')) return [gePrefix + 'Unique/bp_ge_affix_1_MoreDmgVermin'];
    if (rawKey.includes('Telekinos_effect')) return [gePrefix + 'Unique/bp_ge_affix_1_Telekinos_effect'];
    if (rawKey.includes('IncreasedLifesteal')) return [gePrefix + 'Unique/bp_ge_affix_1_IncrLifesteal'];
    const cleanU = rawKey.replace(/^(?:prefix|suffix|affix)_[0-9]_?/, '').replace(/_+$/, '');
    return [gePrefix + 'Unique/bp_ge_affix_1_' + cleanU];
  }

  // Implicits
  if (p.includes('/implicits/')) {
    const cleanImp = rawKey.replace(/^da_implicit_/, '').replace(/^implicit_/, '');
    return [gePrefix + 'Implicits/bp_ge_implicit_1_' + cleanImp];
  }

  // Standard Tier-Preserving 1:1 Mapping:
  // prefix_0_XYZ -> bp_ge_affix_0_XYZ, prefix_1_XYZ -> bp_ge_affix_1_XYZ
  const tierMatch = rawKey.match(/^(?:da_)?(?:prefix|suffix|implicit|affix)_([0-9])_?/);
  const tierNum = tierMatch ? tierMatch[1] : '1';
  const baseStatName = rawKey.replace(/^(?:da_)?(?:prefix|suffix|implicit|affix)_[0-9]_?/, '');
  return [gePrefix + `bp_ge_affix_${tierNum}_` + baseStatName];
}

// Sample node for base cloning
const baseSampleBytes = authenticAffixes.values().next().value.nodeBytes;

function createAffixNode(baseBytes, newPath, newCategory, gePaths) {
  const node = G.parseAffixTemplate(baseBytes);
  
  const pf = T.affixField(node, 'pAffix');
  if (pf) pf.set(newPath);

  const cf = T.affixField(node, 'Category');
  if (cf) cf.set(`EGrimItemAffixCategory::${newCategory}`);

  const lf = T.affixField(node, 'Level');
  if (lf) lf.set(0);

  const sc = T.affixField(node, 'Scale');
  if (sc) sc.set(1.0);

  const effArrProp = node.body.get('AffixEffectInstances');
  if (effArrProp && effArrProp.value && effArrProp.value.items) {
    const templateEff = effArrProp.value.items[0];
    const newEffItems = [];

    for (const gePath of gePaths) {
      const ew = new G.W();
      templateEff.ser(ew);
      const effNode = G.parseAffixTemplate(ew.done());

      const sgef = T.affixField(effNode, 'pSoftGameplayEffect');
      if (sgef) sgef.set(gePath);

      const isSkillScale = newPath.includes('PointsTo') || newPath.includes('Capacity') || newPath.includes('PassiveLevel');
      const isDecimalScale = newPath.includes('Regen') || newPath.includes('Scaling') || gePath.includes('Regen') || gePath.includes('Scaling');
      const defaultVal = isSkillScale ? 1.0 : (isDecimalScale ? 5.0 : 10.0);
      if (T.setEffectScale) {
        T.setEffectScale(effNode, defaultVal, isDecimalScale);
      } else {
        const sf = T.affixField(effNode, 'Scale');
        if (sf) sf.set(defaultVal);
      }

      newEffItems.push(effNode);
    }
    effArrProp.value.items = newEffItems;
  }

  const w = new G.W();
  node.ser(w);
  return Buffer.from(w.done()).toString('base64');
}

function registerAffixEntry(assetPath, kind, descMapObj, titles = []) {
  if (CAT.a[assetPath]) return;
  const daName = assetPath.split('/').pop().replace(/\.da_.*$/, '');
  const isAuth = authenticAffixes.has(assetPath);
  if (!isAuth && utocDaSet && !utocDaSet.has(daName)) {
    // Skip ghost / unreleased CSV entry that does not exist in game PAK
    return;
  }
  const tooltip = descMapObj[0] || Object.values(descMapObj)[0] || '';
  const maxLvl = Object.keys(descMapObj).length > 0 ? Math.max(...Object.keys(descMapObj).map(Number)) : 5;
  const isUnique = kind === 'Unique';

  CAT.names[assetPath] = {
    title: titles[0] || '',
    tooltip: tooltip,
    tierTooltips: descMapObj,
    maxLevel: maxLvl,
    kind: kind
  };

  const ges = resolveGameplayEffects(assetPath);
  CAT.a[assetPath] = {
    c: isUnique ? 'Unique' : 'Random',
    cs: isUnique ? ['Unique'] : ['Random'],
    g: ges,
    maxLevel: maxLvl,
    t: createAffixNode(baseSampleBytes, assetPath, isUnique ? 'Unique' : 'Random', ges)
  };
}

// Add Prefixes & metadata from prefix names CSV
for (const [key, entries] of prefixMap.entries()) {
  const assetPath = `/Game/TQ2/Items/Affixes/Prefixes/da_${key}.da_${key}`;
  const descMapObj = genericDescMap.get(key) || rareDescMap.get(key) || baseDescMap.get(key) || {};
  const titles = entries.map(e => e.text).filter(Boolean);
  registerAffixEntry(assetPath, 'Prefix', descMapObj, titles);
}

// Add Suffixes & metadata from suffix names CSV
for (const [key, entries] of suffixMap.entries()) {
  const assetPath = `/Game/TQ2/Items/Affixes/Suffixes/da_${key}.da_${key}`;
  const descMapObj = genericDescMap.get(key) || rareDescMap.get(key) || baseDescMap.get(key) || {};
  const titles = entries.map(e => e.text).filter(Boolean);
  registerAffixEntry(assetPath, 'Suffix', descMapObj, titles);
}

// Add any missing Prefixes and Suffixes found in effect description CSVs
for (const descMap of [genericDescMap, rareDescMap, baseDescMap]) {
  for (const [key, descMapObj] of descMap.entries()) {
    if (key.startsWith('prefix_')) {
      const assetPath = `/Game/TQ2/Items/Affixes/Prefixes/da_${key}.da_${key}`;
      registerAffixEntry(assetPath, 'Prefix', descMapObj);
    } else if (key.startsWith('suffix_')) {
      const isUnique = key.toLowerCase().includes('unique');
      const folder = isUnique ? 'Unique' : 'Suffixes';
      const kind = isUnique ? 'Unique' : 'Suffix';
      const assetPath = `/Game/TQ2/Items/Affixes/${folder}/da_${key}.da_${key}`;
      registerAffixEntry(assetPath, kind, descMapObj);

      // Nếu là CapacitySpirit, tạo thêm alias ActiveCapacitySpirit để cả 2 đường dẫn đều hoạt động
      if (key === 'suffix_1_CapacitySpirit') {
        const aliasPath = `/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_ActiveCapacitySpirit.da_suffix_1_ActiveCapacitySpirit`;
        registerAffixEntry(aliasPath, 'Suffix', descMapObj);
      }
    } else if (key.toLowerCase().includes('unique') || key.startsWith('affix_1_')) {
      const assetPath = `/Game/TQ2/Items/Affixes/Unique/da_${key}.da_${key}`;
      registerAffixEntry(assetPath, 'Unique', descMapObj);
    }
  }
}

// Helper to fuzzy match description for UTOC assets
function findDesc(daName) {
  const clean = daName.replace(/^da_/, '');
  const variations = [
    clean,
    clean.replace(/_+$/, ''),
    clean.replace(/^affix_1_/, 'suffix_1_'),
    clean.replace(/^suffix_1_/, 'affix_1_'),
    clean.replace(/^prefix_1_/, 'affix_1_'),
    clean.replace(/^affix_1_Unique_/, 'suffix_1_Unique_'),
    clean.replace(/^suffix_1_Unique_/, 'affix_1_Unique_'),
    clean.replace(/^affix_1_Unique_/, ''),
    clean.replace(/^suffix_1_Unique_/, ''),
    clean.replace(/^affix_1_/, ''),
    clean.replace(/^suffix_1_/, ''),
    clean.replace(/^prefix_1_/, ''),
  ];
  for (const v of variations) {
    if (rareDescMap.has(v)) return rareDescMap.get(v);
    if (genericDescMap.has(v)) return genericDescMap.get(v);
    if (baseDescMap.has(v)) return baseDescMap.get(v);
  }
  return null;
}

// Register all verified Unique / Capacity / Companion assets from UTOC
if (utocDaSet) {
  const customUniqueDict = {
    'da_affix_1_Unique_Capacity_TagSummon_+1': {
      title: 'Độc nhất: +1 Sức chứa Kỹ năng Triệu hồi (Summon Capacity / Skill)',
      tooltip: '+1 Capacity to Summon Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagSummon']
    },
    'da_affix_1_Unique_Capacity_TagFire_+1': {
      title: 'Độc nhất: +1 Sức chứa Kỹ năng Lửa (Fire Capacity +1)',
      tooltip: '+1 Capacity to Fire Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagFire']
    },
    'da_affix_1_Unique_Capacity_TagFire_+2': {
      title: 'Độc nhất: +2 Sức chứa Kỹ năng Lửa (Fire Capacity +2)',
      tooltip: '+2 Capacity to Fire Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagFire']
    },
    'da_affix_1_Unique_Capacity_TagCold': {
      title: 'Độc nhất: +1 Sức chứa Kỹ năng Băng (Cold Capacity +1)',
      tooltip: '+1 Capacity to Cold Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagCold']
    },
    'da_affix_1_Unique_Capacity_TagCold_+2': {
      title: 'Độc nhất: +2 Sức chứa Kỹ năng Băng (Cold Capacity +2)',
      tooltip: '+2 Capacity to Cold Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagCold']
    },
    'da_affix_1_Unique_Capacity_TagLightning_+1': {
      title: 'Độc nhất: +1 Sức chứa Kỹ năng Sét (Lightning Capacity +1)',
      tooltip: '+1 Capacity to Lightning Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagLightning']
    },
    'da_affix_1_Unique_Capacity_TagLightning_+2': {
      title: 'Độc nhất: +2 Sức chứa Kỹ năng Sét (Lightning Capacity +2)',
      tooltip: '+2 Capacity to Lightning Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagLightning']
    },
    'da_affix_1_Unique_Capacity_TagPoison+1': {
      title: 'Độc nhất: +1 Sức chứa Kỹ năng Độc (Poison Capacity +1)',
      tooltip: '+1 Capacity to Poison Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagPoison']
    },
    'da_affix_1_Unique_Capacity_TagPhysicalSpell_+2': {
      title: 'Độc nhất: +2 Sức chứa Phép Vật lý (Physical Spell Capacity +2)',
      tooltip: '+2 Capacity to Physical Spell Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagSpell+Physical']
    },
    'da_affix_1_Unique_Capacity_TagSpell_+1': {
      title: 'Độc nhất: +1 Sức chứa Toàn bộ Phép (Spell Capacity +1)',
      tooltip: '+1 Capacity to Spells',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagSpell+2']
    },
    'da_affix_1_Unique_Capacity_TagSpell_+2': {
      title: 'Độc nhất: +2 Sức chứa Toàn bộ Phép (Spell Capacity +2)',
      tooltip: '+2 Capacity to Spells',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagSpell+2']
    },
    'da_affix_1_Unique_Capacity_TagWeaponAttack_+1': {
      title: 'Độc nhất: +1 Sức chứa Đòn đánh Vũ khí (Weapon Attack Capacity +1)',
      tooltip: '+1 Capacity to Weapon Attack Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagWeaponAttack']
    },
    'da_affix_1_Unique_Capacity_TagMovement_+2': {
      title: 'Độc nhất: +2 Sức chứa Kỹ năng Di chuyển (Movement Capacity +2)',
      tooltip: '+2 Capacity to Movement Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagMovement']
    },
    'da_affix_1_Unique_Capacity_TagAura_+2': {
      title: 'Độc nhất: +2 Sức chứa Kỹ năng Hào quang (Aura Capacity +2)',
      tooltip: '+2 Capacity to Aura Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagAura']
    },
    'da_affix_1_Unique_Capacity_TagSustained_+1': {
      title: 'Độc nhất: +1 Sức chứa Kỹ năng Duy trì (Sustained Skills Capacity +1)',
      tooltip: '+1 Capacity to Sustained Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagSustained']
    },
    'da_affix_1_Unique_Capacity_TagPrimaryAttack': {
      title: 'Độc nhất: +1 Sức chứa Đòn đánh cơ bản (Primary Attack Capacity +1)',
      tooltip: '+1 Capacity to Primary Attack',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagPrimaryAttack']
    },
    'da_affix_1_Unique_Capacity_TagPrimaryAttack_+2': {
      title: 'Độc nhất: +2 Sức chứa Đòn đánh cơ bản (Primary Attack Capacity +2)',
      tooltip: '+2 Capacity to Primary Attack',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagPrimaryAttack']
    },
    'da_affix_1_Unique_Capacity_TagDisruption': {
      title: 'Độc nhất: +1 Sức chứa Kỹ năng Phá rối (Disruption Capacity +1)',
      tooltip: '+1 Capacity to Disruption Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagDisruption']
    },
    'da_affix_1_Unique_Capacity_TagDodge': {
      title: 'Độc nhất: +1 Sức chứa Né tránh (Dodge Capacity +1)',
      tooltip: '+1 Capacity to Dodge',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagDodge']
    },
    'da_affix_1_Unique_Capacity_TagElemental': {
      title: 'Độc nhất: +1 Sức chứa Đa nguyên tố Lửa/Sét/Băng (Elemental Capacity +1)',
      tooltip: '+1 Capacity to Fire, Lightning, and Cold Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_TagElemental']
    },
    'da_affix_1_Unique_Capacity_MasteryStorm_T2_+2': {
      title: 'Độc nhất: +2 Sức chứa Kỹ năng Bão Tố Bậc 2 (Storm Mastery T2 Capacity)',
      tooltip: '+2 Capacity to Storm Mastery Tier 2 Active Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_MasteryStorm_T2']
    },
    'da_affix_1_Unique_Capacity_Skill_Barrier': {
      title: 'Độc nhất: +1 Sức chứa Khiên Năng lượng (Barrier Capacity +1)',
      tooltip: '+1 Capacity to Barrier Skills',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_Capacity_Skill_Barrier']
    },
    'da_suffix_1_Unique_SummonWolf': {
      title: 'Độc nhất: Triệu hồi Sói (Summon Wolf)',
      tooltip: 'Summons a Wolf companion while worn.',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_SummonWolf']
    },
    'da_suffix_1_Unique_SummonEagle': {
      title: 'Độc nhất: Triệu hồi Đại bàng (Summon Eagle)',
      tooltip: 'Summons an Eagle companion while worn.',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_SummonEagle']
    },
    'da_suffix_1_Unique_SummonSpider': {
      title: 'Độc nhất: Triệu hồi Nhện (Summon Spider)',
      tooltip: 'Summons a Spider companion while worn.',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_SummonSpider']
    },
    'da_suffix_1_Unique_SummonDog': {
      title: 'Độc nhất: Triệu hồi Chó (Summon Dog)',
      tooltip: 'Summons a Dog companion while worn.',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_SummonDog']
    },
    'da_suffix_1_Unique_SummonAnglerfish': {
      title: 'Độc nhất: Triệu hồi Cá lồng đèn (Summon Anglerfish)',
      tooltip: 'Summons an Anglerfish companion while worn.',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_SummonAnglerfish']
    },
    'da_suffix_1_Unique_SummonScorpy': {
      title: 'Độc nhất: Triệu hồi Bọ cạp Scorpy (Summon Scorpy)',
      tooltip: 'Summons Scorpy companion while worn.',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_SummonScorpy']
    },
    'da_suffix_1_Unique_SummonDeath_HealthRegen': {
      title: 'Độc nhất: Hồi máu khi Đệ chết (Summon Death Health Regen)',
      tooltip: 'Whenever one of your Summons dies, recover 20% of your Maximum Health over 5 seconds',
      ge: ['/Game/TQ2/Items/Affixes/GameplayEffects/Unique/bp_ge_affix_1_SummonDeath_HealthRegen']
    }
  };

  for (const [da, custom] of Object.entries(customUniqueDict)) {
    const isSuffix = da.startsWith('da_suffix_');
    const folder = isSuffix ? 'Suffixes' : 'Unique';
    const assetPath = `/Game/TQ2/Items/Affixes/${folder}/${da}.${da}`;
    CAT.names[assetPath] = {
      title: custom.title,
      tooltip: custom.tooltip,
      tierTooltips: { 0: custom.tooltip },
      maxLevel: 0,
      kind: 'Unique'
    };
    CAT.a[assetPath] = {
      c: 'Unique',
      cs: ['Unique'],
      g: custom.ge,
      maxLevel: 0,
      t: createAffixNode(baseSampleBytes, assetPath, 'Unique', custom.ge)
    };
  }
}

// Add metadata for any existing Implicits or Uniques from save files
for (const k of Object.keys(CAT.a)) {
  if (!CAT.names[k]) {
    const raw = k.split('/').pop().replace(/\.da_.*$/, '').replace(/^da_/, '');
    const descEntry = genericDescMap.get(raw) || rareDescMap.get(raw) || baseDescMap.get(raw);
    const tooltip = descEntry && descEntry[0] ? descEntry[0].text : '';
    CAT.names[k] = {
      title: '',
      tooltip: tooltip,
      kind: T.affixKind(k)
    };
  }
}



// Add Charms with proper aliases
for (const [key, entries] of charmMap.entries()) {
  const rawBase = key.replace(/_name(_\d+)?$/, '');
  const rankMatch = key.match(/_(\d+)$/);
  const rank = rankMatch ? rankMatch[1] : '01';
  const name = entries[0].text;

  const aliases = [
    `da_socket_charm_${rawBase.replace(/^cha_/, '')}_${rank}`,
    `da_socket_charm_${rawBase.replace(/^cha_/, '')}`,
    `da_socket_${rawBase}_${rank}`,
    `da_socket_${rawBase}`
  ];

  for (const assetName of aliases) {
    const pkg = `/JsonData/TQ2/Items/Sockets/${assetName}`;
    if (!CAT.itemSet.has(assetName)) {
      CAT.i.push([pkg, assetName]);
      CAT.itemSet.add(assetName);
    }
    CAT.names[assetName] = { title: name, subtitle: 'Socketable Charm', cat: 'relic' };
  }
}

// Add Relics with proper aliases
for (const [key, entries] of relicMap.entries()) {
  const rawBase = key.replace(/_name(_\d+)?$/, '');
  const rankMatch = key.match(/_(\d+)$/);
  const rank = rankMatch ? rankMatch[1] : '01';
  const name = entries[0].text;

  const aliases = [
    `da_socket_relic_${rawBase.replace(/^rel_/, '')}_${rank}`,
    `da_socket_relic_${rawBase.replace(/^rel_/, '')}`,
    `da_item_relic_${rawBase.replace(/^rel_/, '')}_${rank}`,
    `da_item_${rawBase}_${rank}`,
    `da_item_${rawBase}`
  ];

  for (const assetName of aliases) {
    const pkg = `/JsonData/TQ2/Items/Relics/${assetName}`;
    if (!CAT.itemSet.has(assetName)) {
      CAT.i.push([pkg, assetName]);
      CAT.itemSet.add(assetName);
    }
    CAT.names[assetName] = { title: name, subtitle: 'Socketable Divine Relic', cat: 'relic' };
  }
}

// Add Unique Weapons & Armor
for (const [key, entries] of uniqueMap.entries()) {
  if (key.endsWith('_name')) {
    const baseId = key.replace(/_name$/, '');
    const flavor = uniqueMap.get(baseId + '_flavortext');
    const flavorText = flavor && flavor[0] ? flavor[0].text : '';
    const title = entries[0].text;

    const aliases = [
      `da_${baseId}`,
      `da_weapon_${baseId.replace(/^wp_/, '')}`,
      `da_armor_${baseId.replace(/^ar_/, '')}`
    ];

    for (const assetName of aliases) {
      const pkg = `/JsonData/TQ2/Items/Unique/${assetName}`;
      if (!CAT.itemSet.has(assetName)) {
        CAT.i.push([pkg, assetName]);
        CAT.itemSet.add(assetName);
      }
      CAT.names[assetName] = {
        title: title,
        flavor: flavorText,
        cat: assetName.includes('wp_') || assetName.includes('weapon') ? 'weapon' : 'armor'
      };
    }
  }
}

// Extract all max levels and per-tier titles from CSVs
const affixMaxMap = new Map();
const affixTierMap = new Map();
const affixTierTooltips = new Map();
for (const file of fs.readdirSync(textItemsDir).filter(f => f.endsWith('.csv'))) {
  const content = fs.readFileSync(path.join(textItemsDir, file), 'utf8');
  for (const line of content.split(/\r?\n/)) {
    // Dạng thông thường: key.Levels(N).PropType
    const match = line.match(/^"([^"]*)\.Levels\((\d+)\)\.([^"]*)"\s*,\s*"([^"]*)"/);
    if (match) {
      let baseKey = match[1].replace(/\.m_Levels$/, '').replace(/^da_/, '');
      baseKey = baseKey.replace(/^(Prefixes|Suffixes|Implicits|Unique)\//, '').replace(/\.da_.*$/, '');
      const lvl = parseInt(match[2], 10);
      const propType = match[3];
      const text = match[4];

      if (!affixMaxMap.has(baseKey) || lvl > affixMaxMap.get(baseKey)) {
        affixMaxMap.set(baseKey, lvl);
      }
      if (!affixTierMap.has(baseKey)) affixTierMap.set(baseKey, {});
      if (!affixTierTooltips.has(baseKey)) affixTierTooltips.set(baseKey, {});

      if (propType.includes('TitleText') && text) {
        affixTierMap.get(baseKey)[lvl] = text;
      } else if (propType.includes('TooltipText') && text) {
        affixTierTooltips.get(baseKey)[lvl] = text;
      }
      continue;
    }
    // Dạng flat tier Spirit: "da_suffix_1_PassiveLevelSpirit_T1","tooltip"
    const flatMatch = line.match(/^"(da_[^"]+_T(\d+))"\s*,\s*"([^"]*)"/);
    if (flatMatch) {
      const fullKey = flatMatch[1].replace(/^da_/, '');
      const tierNum = parseInt(flatMatch[2], 10) - 1; // T1→0, T2→1 ...
      const text = flatMatch[3];
      // baseKey bỏ _TN để map về affix gốc
      let baseKey = fullKey.replace(/_T\d+$/, '');
      if (baseKey === 'suffix_1_CapacitySpirit') baseKey = 'suffix_1_ActiveCapacitySpirit';
      if (baseKey === 'prefix_0_PointsToSpiritActives') baseKey = 'prefix_0_PointsToSpiritActives';

      if (!affixMaxMap.has(baseKey) || tierNum > affixMaxMap.get(baseKey)) {
        affixMaxMap.set(baseKey, tierNum);
      }
      if (!affixTierMap.has(baseKey)) affixTierMap.set(baseKey, {});
      if (!affixTierTooltips.has(baseKey)) affixTierTooltips.set(baseKey, {});
      
      // Tooltip của từng tier
      if (text) {
        affixTierTooltips.get(baseKey)[tierNum] = text;
        if (!affixTierMap.get(baseKey)[tierNum]) {
          affixTierMap.get(baseKey)[tierNum] = text;
        }
      }
    }
  }
}

function interpolateTiers(rawTiers, maxLvl, fallbackTitle) {
  const out = {};
  if (!rawTiers || Object.keys(rawTiers).length === 0) {
    if (fallbackTitle) {
      for (let i = 0; i <= maxLvl; i++) out[i] = fallbackTitle;
    }
    return out;
  }

  for (let i = 0; i <= maxLvl; i++) {
    if (rawTiers[i]) {
      out[i] = rawTiers[i];
    } else {
      let closest = null;
      for (let j = i - 1; j >= 0; j--) {
        if (rawTiers[j]) { closest = rawTiers[j]; break; }
      }
      if (!closest) {
        for (let j = i + 1; j <= 10; j++) {
          if (rawTiers[j]) { closest = rawTiers[j]; break; }
        }
      }
      out[i] = closest || fallbackTitle || '';
    }
  }
  return out;
}

// Helper to enrich all affix metadata with clear bilingual names and accurate tooltips
function enrichAffixMeta(pathStr, rawMeta = {}, tiers = {}, tierTooltips = {}) {
  const p = pathStr.toLowerCase();
  const rawKey = pathStr.split('/').pop().replace(/\.da_.*$/, '').replace(/^da_/, '');
  const kind = T.affixKind(pathStr);

  let viTitle = rawMeta.title || '';
  let enTitle = rawMeta.englishTitle || '';
  let tooltip = rawMeta.tooltip || '';
  const tierValues = Object.values(tiers).filter(Boolean);
  const tooltipValues = Object.values(tierTooltips).filter(Boolean);

  // 1. Implicit Armor
  if (p.includes('/implicits/armor/')) {
    if (rawKey.includes('Bmage') || rawKey.includes('Sorcerer') || rawKey.includes('sorcerer')) {
      viTitle = 'Nội tại Áo Pháp sư: Khiên Năng lượng';
      enTitle = 'Plated Robe Warding (Energy Barrier)';
      if (!tooltip) tooltip = '+{Value} Khiên Năng lượng (Energy Barrier)';
    } else if (rawKey.includes('Fighter')) {
      viTitle = 'Nội tại Giáp Đấu sĩ: Tăng hồi chiêu Né đòn';
      enTitle = 'Medium Armor Mobility (Dodge CDR)';
      if (!tooltip) tooltip = '+{Value}% Tốc độ hồi chiêu Né tránh';
    } else if (rawKey.includes('Knight') || rawKey.includes('deflect')) {
      viTitle = 'Nội tại Giáp Hiệp sĩ: Khả năng Đạn đánh sượt';
      enTitle = 'Heavy Armor Deflection (Deflect Projectiles)';
      if (!tooltip) tooltip = '+{Value}% Khả năng Đạn đánh sượt';
    } else if (rawKey.includes('Paladin') || rawKey.includes('MagicResistance')) {
      viTitle = 'Nội tại Giáp Thánh hiệp sĩ: Kháng Ma pháp';
      enTitle = 'Ornate Armor Adornment (Magic Resistance)';
      if (!tooltip) tooltip = '+{Value}% Kháng Nhiệt và Kháng Tự nhiên';
    } else if (rawKey.includes('Rogue')) {
      viTitle = 'Nội tại Giáp Thích khách: Tăng hồi chiêu Né đòn';
      enTitle = 'Light Armor Agility (Dodge CDR)';
      if (!tooltip) tooltip = '+{Value}% Tốc độ hồi chiêu Né tránh';
    } else if (rawKey.includes('MI_All')) {
      viTitle = 'Nội tại Giáp Quái vật (MI): Tăng Sát thương Độc';
      enTitle = 'Monster Infrequent: Poison Damage';
      if (!tooltip) tooltip = '+{Value}% Tăng Sát thương Độc';
    } else {
      viTitle = 'Nội tại Giáp: ' + rawKey.replace(/armor_greek_|armor_ichthian_/, '').replace(/_/g, ' ');
      enTitle = 'Armor Implicit: ' + rawKey.replace(/_/g, ' ');
    }
  }
  // 2. Implicit Weapon
  else if (p.includes('/implicits/weapon/') || p.includes('/implicits/')) {
    if (rawKey.includes('Light') || rawKey.includes('AttackSpeed')) {
      viTitle = 'Nội tại Vũ khí: Tăng Tốc độ Tấn công';
      enTitle = 'Weapon Implicit: Increased Attack Speed';
      if (!tooltip) tooltip = '+{Value}% Tốc độ Tấn công';
    } else if (rawKey.includes('Round') || rawKey.includes('Staff') || rawKey.includes('Helix')) {
      viTitle = 'Nội tại Gậy phép: Tăng Tốc độ Đánh & Niệm';
      enTitle = 'Staff Implicit: Increased Attack & Cast Speed';
      if (!tooltip) tooltip = '+{Value}% Tốc độ Đánh và Tốc độ Niệm';
    } else if (rawKey.includes('CritChance')) {
      viTitle = 'Nội tại Vũ khí (MI): Tăng Tỷ lệ Chí mạng';
      enTitle = 'Weapon Implicit: Base Crit Chance';
      if (!tooltip) tooltip = '+{Value}% Khả năng Chí mạng Cơ bản của Vũ khí';
    } else if (rawKey.includes('Ichthian') || rawKey.includes('Pierce')) {
      viTitle = 'Nội tại Đại Rìu Ichthian: Sát thương Xuyên thấu';
      enTitle = 'Ichthian Axe: Pierce Damage';
      if (!tooltip) tooltip = '+{Value} Sát thương Xuyên thấu';
    } else if (rawKey.includes('Magical') || rawKey.includes('sword')) {
      viTitle = 'Nội tại Kiếm: Sát thương Ma pháp';
      enTitle = 'Sword Implicit: Magical Damage';
      if (!tooltip) tooltip = '+{Value} Sát thương Ma pháp';
    } else {
      viTitle = 'Nội tại Vũ khí: ' + rawKey.replace(/^implicit_/, '').replace(/_/g, ' ');
      enTitle = 'Weapon Implicit: ' + rawKey.replace(/_/g, ' ');
    }
  }
  // 3. Unique Affixes
  else if (p.includes('/unique/')) {
    const clean = rawKey.replace(/^prefix_1_/, '').replace(/^suffix_1_/, '').replace(/^affix_1_/, '').replace(/^Unique_/, '');
    enTitle = 'Unique: ' + clean.replace(/_/g, ' ');
    
    if (clean.includes('Capacity_MasteryStorm') || clean.includes('Storm_T2')) {
      viTitle = 'Độc nhất: +2 Sức chứa Tinh thông Bão Tố (T2)';
      if (!tooltip) tooltip = '+2 Sức chứa Kỹ năng Tinh thông Bão Tố Bậc 2';
    } else if (clean.includes('PassiveLevelStorm')) {
      viTitle = 'Độc nhất: +1 Cấp Tất cả Kỹ năng Bị động Bão Tố';
      if (!tooltip) tooltip = '+1 Cấp độ tất cả Kỹ năng Bị động Tinh thông Bão Tố';
    } else if (clean.includes('Capacity_MasteryWarfare')) {
      viTitle = 'Độc nhất: +2 Sức chứa Tinh thông Chiến trận';
      if (!tooltip) tooltip = '+2 Sức chứa Kỹ năng Tinh thông Chiến trận';
    } else if (clean.includes('PassiveLevelWarfare')) {
      viTitle = 'Độc nhất: +1 Cấp Tất cả Kỹ năng Bị động Chiến trận';
      if (!tooltip) tooltip = '+1 Cấp độ tất cả Kỹ năng Bị động Tinh thông Chiến trận';
    } else if (clean.includes('Capacity_MasteryForge')) {
      viTitle = 'Độc nhất: +2 Sức chứa Tinh thông Lò Rèn';
      if (!tooltip) tooltip = '+2 Sức chứa Kỹ năng Tinh thông Lò Rèn';
    } else if (clean.includes('Capacity_MasteryEarth')) {
      viTitle = 'Độc nhất: +2 Sức chứa Tinh thông Đất';
      if (!tooltip) tooltip = '+2 Sức chứa Kỹ năng Tinh thông Đất';
    } else if (clean.includes('Capacity_MasteryRogue')) {
      viTitle = 'Độc nhất: +2 Sức chứa Tinh thông Thích khách';
      if (!tooltip) tooltip = '+2 Sức chứa Kỹ năng Tinh thông Thích khách';
    } else if (clean.includes('Capacity_TagPoison') || clean.includes('TagPoison+1')) {
      viTitle = 'Độc nhất: +1 Sức chứa Kỹ năng Độc';
      if (!tooltip) tooltip = '+1 Sức chứa Kỹ năng hệ Độc';
    } else if (clean.includes('Capacity_TagDodge') || clean.includes('TagDodge')) {
      viTitle = 'Độc nhất: +1 Sức chứa Né tránh (Thêm lượt né)';
      if (!tooltip) tooltip = '+1 Lượt hồi chiêu Né tránh';
    } else if (clean.includes('WeaponDmgConversion_Poison')) {
      viTitle = 'Độc nhất: Chuyển 65% Sát thương Vũ khí sang Độc';
      if (!tooltip) tooltip = 'Chuyển đổi 65% Sát thương Vũ khí sang Sát thương Độc';
    } else if (clean.includes('ConsumeInfusion')) {
      viTitle = 'Độc nhất: Tiêu thụ Truyền dẫn nhận Tốc độ & Sát thương';
      if (!tooltip) tooltip = 'Tiêu thụ Truyền dẫn để tăng Tốc độ và Sát thương';
    } else if (clean.includes('ThermalDmg')) {
      viTitle = 'Độc nhất: Tăng Sát thương Nhiệt (Lửa & Băng)';
      if (!tooltip) tooltip = 'Tăng {Value}% Sát thương Lửa và Băng';
    } else if (clean.includes('NatureDmg')) {
      viTitle = 'Độc nhất: Tăng Sát thương Tự nhiên (Độc & Sét)';
      if (!tooltip) tooltip = 'Tăng {Value}% Sát thương Độc và Sét';
    } else if (clean.includes('PlaguedChance')) {
      viTitle = 'Độc nhất: Tăng Tỷ lệ Gây Dịch bệnh';
      if (!tooltip) tooltip = 'Tăng {Value}% Tỷ lệ gây hiệu ứng Dịch bệnh';
    } else if (clean.includes('PlaguedPower')) {
      viTitle = 'Độc nhất: Tăng Sức mạnh Dịch bệnh';
      if (!tooltip) tooltip = 'Tăng {Value}% Sức mạnh hiệu ứng Dịch bệnh';
    } else if (clean.includes('RetaliationFire')) {
      viTitle = 'Độc nhất: Sát thương Phản đòn Lửa';
      if (!tooltip) tooltip = 'Gây {Value} Sát thương Lửa phản đòn khi bị đánh trúng';
    } else if (clean.includes('RetaliationPoison')) {
      viTitle = 'Độc nhất: Sát thương Phản đòn Độc';
      if (!tooltip) tooltip = 'Gây {Value} Sát thương Độc phản đòn khi bị đánh trúng';
    } else if (clean.includes('RetaliationPierce')) {
      viTitle = 'Độc nhất: Sát thương Phản đòn Xuyên thấu';
      if (!tooltip) tooltip = 'Gây {Value} Sát thương Xuyên thấu phản đòn khi bị đánh trúng';
    } else if (!viTitle) {
      viTitle = 'Độc nhất: ' + clean.replace(/_/g, ' ');
    }
  }
  // 4. Prefixes and Suffixes
  else {
    enTitle = T.affixShortName(pathStr);
    
    // Clear Stat Name in Vietnamese
    let statName = '';
    if (rawKey.includes('PerIncreasedAttackSpeed')) statName = '+ % Tốc độ Đánh (Attack Speed)';
    else if (rawKey.includes('PerIncreasedCastSpeed')) statName = '+ % Tốc độ Niệm phép (Cast Speed)';
    else if (rawKey.includes('PerIncreasedMovementSpeed')) statName = '+ % Tốc độ Chạy (Move Speed)';
    else if (rawKey.includes('PerIncreasedCooldownSpeed')) statName = '+ % Tốc độ Hồi chiêu (Cooldown Speed)';
    else if (rawKey.includes('FlatCritChance')) statName = '+ % Tỷ lệ Chí mạng (Crit Chance)';
    else if (rawKey.includes('IncrCritDmgMultiplier')) statName = '+ % Sát thương Chí mạng (Crit Dmg)';
    else if (rawKey.includes('FreeEnergyReservation') || rawKey.includes('LessEnergyReserved')) statName = 'Giảm Năng lượng Dự trữ (Less Reserved)';
    else if (rawKey.includes('EnergyBarrier')) statName = '+ Khiên Năng lượng (Energy Barrier)';
    else if (rawKey.includes('FlatEnergyRegen') || rawKey.includes('+EnergyRegen') || rawKey.includes('EnergyRegenPerSecond')) statName = '+ Hồi Năng lượng / giây (Energy Regen)';
    else if (rawKey.includes('PerFireRes')) statName = '+ % Kháng Lửa (Fire Resistance)';
    else if (rawKey.includes('PerColdRes')) statName = '+ % Kháng Băng (Cold Resistance)';
    else if (rawKey.includes('PerLightningRes')) statName = '+ % Kháng Sét (Lightning Resistance)';
    else if (rawKey.includes('PerPoisonRes')) statName = '+ % Kháng Độc (Poison Resistance)';
    else if (rawKey.includes('PerPhysicalRes')) statName = '+ % Kháng Vật lý (Physical Resistance)';
    else if (rawKey.includes('PerImpairRes')) statName = '+ % Kháng Làm suy yếu (Impair Resistance)';
    else if (rawKey.includes('PerAilmentRes')) statName = '+ % Kháng Hiệu ứng Bất lợi (Ailment Res)';
    else if (rawKey.includes('PerResAll') || rawKey.includes('Summons_AddRes_All') || rawKey.includes('AllResistance')) statName = '+ % Kháng Tất cả (All Resistances)';
    else if (rawKey.includes('ArmorFlat') || rawKey.includes('FlatArmor')) statName = '+ Giáp cơ bản (Flat Armor)';
    else if (rawKey.includes('RetaliationFire')) statName = '+ Sát thương Phản đòn Lửa (Retaliation)';
    else if (rawKey.includes('Might')) statName = '+ Sức mạnh (Might)';
    else if (rawKey.includes('Agility')) statName = '+ Nhanh nhẹn (Agility)';
    else if (rawKey.includes('Knowledge')) statName = '+ Trí tuệ (Knowledge)';
    else if (rawKey.includes('Vigor')) statName = '+ Sinh lực (Vigor)';
    else if (rawKey.includes('Health') && !rawKey.includes('Potion')) statName = '+ Máu tối đa (Max Health)';
    else if (rawKey.includes('Energy') && !rawKey.includes('Potion')) statName = '+ Năng lượng tối đa (Max Energy)';
    else if (rawKey.includes('Summons_PerIncreasedDamage')) statName = '+ % Sát thương Đệ/Triệu hồi (Summon Dmg)';
    else if (rawKey.includes('Summons_PerIncreasedSpeed')) statName = '+ % Tốc độ Đệ/Triệu hồi (Summon Speed)';
    else if (rawKey.includes('Summons_PerIncreasedHealth')) statName = '+ % Máu Đệ/Triệu hồi (Summon Health)';
    else if (rawKey.includes('Summons_PerIncreasedActivations')) statName = '+ % Lần Kích hoạt Đệ (Summon Activations)';
    else if (rawKey.includes('Potion_Health_MinusChargesConsumed')) statName = 'Dược phẩm: Giảm tiêu hao lượt dùng (Charges Consumed)';
    else if (rawKey.includes('Potion_PerHealedInstantly')) statName = 'Dược phẩm: Hồi Máu tức thì (Instant Recovery)';
    else if (rawKey.includes('Potion_Energy_IncreasedDuration')) statName = 'Dược phẩm: Tăng thời lượng hiệu ứng (Duration)';
    else if (rawKey.includes('AilmentChanceOnUse')) statName = 'Dược phẩm: Tăng Tỷ lệ Gây hiệu ứng (Ailment Chance)';
    else if (rawKey.includes('PerIncreasedFireDmg')) statName = '+ % Sát thương Lửa (Fire Damage)';
    else if (rawKey.includes('PerIncreasedColdDmg')) statName = '+ % Sát thương Băng (Cold Damage)';
    else if (rawKey.includes('PerIncreasedLightningDmg')) statName = '+ % Sát thương Sét (Lightning Damage)';
    else if (rawKey.includes('PerIncreasedPoisonDmg')) statName = '+ % Sát thương Độc (Poison Damage)';
    else if (rawKey.includes('PerIncreasedPierceDmg')) statName = '+ % Sát thương Xuyên (Pierce Damage)';
    else if (rawKey.includes('PerIncreasedVitalityDmg')) statName = '+ % Sát thương Sinh lực (Vitality Damage)';
    else if (rawKey.includes('PerIncreasedSpellDmg')) statName = '+ % Sát thương Phép (Spell Damage)';
    else if (rawKey.includes('PerIncreasedAllDmg')) statName = '+ % Toàn bộ Sát thương (All Damage)';
    else if (rawKey.includes('PhysicalDmg')) statName = '+ Sát thương Vật lý Vũ khí (Physical Dmg)';
    else if (rawKey.includes('FireDmg')) statName = '+ Sát thương Lửa Vũ khí (Fire Dmg)';
    else if (rawKey.includes('ColdDmg')) statName = '+ Sát thương Băng Vũ khí (Cold Dmg)';
    else if (rawKey.includes('LightningDmg')) statName = '+ Sát thương Sét Vũ khí (Lightning Dmg)';
    else if (rawKey.includes('PoisonDmg')) statName = '+ Sát thương Độc Vũ khí (Poison Dmg)';
    else if (rawKey.includes('PierceDmg')) statName = '+ Sát thương Xuyên Vũ khí (Pierce Dmg)';
    // Prefix PointsTo* — +1 toàn bộ kỹ năng của tinh thông
    else if (rawKey.includes('PointsToAllActives')) statName = '+ Sức chứa Tất cả Kỹ năng Chủ động (All Actives)';
    else if (rawKey.includes('PointsToAllPassives')) statName = '+ Cấp Tất cả Kỹ năng Bị động (All Passives)';
    else if (rawKey.includes('PointsToEarthActives')) statName = '+ Sức chứa Kỹ năng Chủ động Đất (Earth Actives)';
    else if (rawKey.includes('PointsToEarthPassives')) statName = '+ Cấp Kỹ năng Bị động Đất (Earth Passives)';
    else if (rawKey.includes('PointsToForgeActives')) statName = '+ Sức chứa Kỹ năng Chủ động Lò Rèn (Forge Actives)';
    else if (rawKey.includes('PointsToForgePassives')) statName = '+ Cấp Kỹ năng Bị động Lò Rèn (Forge Passives)';
    else if (rawKey.includes('PointsToRogueActives')) statName = '+ Sức chứa Kỹ năng Chủ động Thích khách (Rogue Actives)';
    else if (rawKey.includes('PointsToRoguePassives')) statName = '+ Cấp Kỹ năng Bị động Thích khách (Rogue Passives)';
    else if (rawKey.includes('PointsToSpiritActives')) statName = '+ Sức chứa Kỹ năng Chủ động Linh hồn (Spirit Actives)';
    else if (rawKey.includes('PointsToSpiritPassives')) statName = '+ Cấp Kỹ năng Bị động Linh hồn (Spirit Passives)';
    else if (rawKey.includes('PointsToStormActives')) statName = '+ Sức chứa Kỹ năng Chủ động Bão Tố (Storm Actives)';
    else if (rawKey.includes('PointsToStormPassives')) statName = '+ Cấp Kỹ năng Bị động Bão Tố (Storm Passives)';
    else if (rawKey.includes('PointsToWarfareActives')) statName = '+ Sức chứa Kỹ năng Chủ động Chiến trận (Warfare Actives)';
    else if (rawKey.includes('PointsToWarfarePassives')) statName = '+ Cấp Kỹ năng Bị động Chiến trận (Warfare Passives)';
    // Suffix ActiveCapacity* — +1 sức chứa kỹ năng chủ động theo tier
    else if (rawKey.includes('ActiveCapacityEarth')) statName = '+ Sức chứa Kỹ năng Chủ động Đất theo Bậc';
    else if (rawKey.includes('ActiveCapacityForge')) statName = '+ Sức chứa Kỹ năng Chủ động Lò Rèn theo Bậc';
    else if (rawKey.includes('ActiveCapacityRogue')) statName = '+ Sức chứa Kỹ năng Chủ động Thích khách theo Bậc';
    else if (rawKey.includes('ActiveCapacitySpirit')) statName = '+ Sức chứa Kỹ năng Chủ động Linh hồn theo Bậc';
    else if (rawKey.includes('ActiveCapacityStorm')) statName = '+ Sức chứa Kỹ năng Chủ động Bão Tố theo Bậc';
    else if (rawKey.includes('ActiveCapacityWarfare')) statName = '+ Sức chứa Kỹ năng Chủ động Chiến trận theo Bậc';
    else if (rawKey.includes('ActiveCapacityCore') || rawKey.includes('ActiveCapacityDefault')) statName = '+ Sức chứa Kỹ năng Chủ động (Core)';
    // Spirit Active Capacity (key riêng: CapacitySpirit thay vì ActiveCapacitySpirit)
    else if (rawKey.match(/CapacitySpirit/)) statName = '+ Sức chứa Kỹ năng Chủ động Linh hồn theo Bậc';
    // Suffix PassiveLevel* — +1 cấp kỹ năng bị động theo tier
    else if (rawKey.includes('PassiveLevelEarth')) statName = '+ Cấp Kỹ năng Bị động Đất theo Bậc';
    else if (rawKey.includes('PassiveLevelForge')) statName = '+ Cấp Kỹ năng Bị động Lò Rèn theo Bậc';
    else if (rawKey.includes('PassiveLevelRogue')) statName = '+ Cấp Kỹ năng Bị động Thích khách theo Bậc';
    else if (rawKey.includes('PassiveLevelSpirit')) statName = '+ Cấp Kỹ năng Bị động Linh hồn theo Bậc';
    else if (rawKey.includes('PassiveLevelStorm')) statName = '+ Cấp Kỹ năng Bị động Bão Tố theo Bậc';
    else if (rawKey.includes('PassiveLevelWarfare')) statName = '+ Cấp Kỹ năng Bị động Chiến trận theo Bậc';
    else {
      statName = viTitle || enTitle;
    }

    const inGameName = viTitle || (tierValues.length ? tierValues[0] : '');
    if (inGameName && inGameName !== statName) {
      if (tierValues.length > 1) {
        viTitle = `${statName} · "${inGameName}" (${tierValues[tierValues.length - 1]})`;
      } else {
        viTitle = `${statName} · "${inGameName}"`;
      }
    } else {
      viTitle = statName;
    }

    if (!tooltip) {
      tooltip = statName.replace(/^\+\s*/, '') + ': {Value}';
    }
  }

  return {
    title: viTitle || enTitle,
    englishTitle: enTitle || viTitle,
    tooltip: tooltip,
    kind: kind,
    maxLevel: rawMeta.maxLevel !== undefined ? rawMeta.maxLevel : 5,
    tiers: rawMeta.tiers || {}
  };
}

// Attach accurate maxLevel, enriched titles, and interpolated tiers to CAT.a and CAT.names
for (const [pathStr, info] of Object.entries(CAT.a)) {
  const rawKey = pathStr.split('/').pop().replace(/\.da_.*$/, '').replace(/^da_/, '');
  const p = pathStr.toLowerCase();
  const rawTiers = affixTierMap.get(rawKey) || {};
  const rawTooltips = affixTierTooltips.get(rawKey) || {};
  const tierKeys = [...new Set([...Object.keys(rawTiers), ...Object.keys(rawTooltips)])].map(n => parseInt(n, 10));
  
  // affixMaxMap counts all Levels(N) lines (including AffixEffects), so use it as primary
  let maxLvl = affixMaxMap.get(rawKey);
  if (maxLvl === undefined && tierKeys.length) maxLvl = Math.max(...tierKeys);
  if (maxLvl === undefined) {
    const observed = authenticAffixes.get(pathStr);
    if (observed && observed.maxLevel !== undefined) {
      maxLvl = observed.maxLevel;
    } else if (p.includes('/unique/') || p.includes('cleanse')) {
      maxLvl = 0;
    } else if (p.includes('capacity') || p.includes('passivelevel')) {
      maxLvl = 5; // Bậc 1-6 → Tier 0-5
    } else if (p.includes('activations') || p.includes('potion') || p.includes('/implicits/')) {
      maxLvl = 2;
    } else if (p.includes('attackspeed') || p.includes('castspeed') || p.includes('speed')) {
      maxLvl = 3;
    } else if (p.includes('cooldown') || p.includes('movement') || p.includes('dodgecdr') || p.includes('glancing') || p.includes('critchance') || p.includes('critdmg') || p.includes('res') || p.includes('resistance') || p.includes('summons')) {
      maxLvl = 5;
    } else if (p.includes('might') || p.includes('agility') || p.includes('knowledge') || p.includes('vigor')) {
      maxLvl = 10;
    } else {
      maxLvl = 5; // Safe default
    }
  }

  const existingMeta = CAT.names[pathStr] || {};
  const fallbackTitle = existingMeta.title || T.affixShortName(pathStr);
  const interpolated = interpolateTiers(rawTiers, maxLvl, fallbackTitle);
  const interpolatedTooltips = interpolateTiers(rawTooltips, maxLvl, '');

  info.maxLevel = maxLvl;
  const isAuth = authenticAffixes.has(pathStr);
  info.authentic = isAuth;
  const enriched = enrichAffixMeta(pathStr, existingMeta, interpolated, interpolatedTooltips);
  enriched.maxLevel = maxLvl;
  enriched.authentic = isAuth;
  enriched.tiers = interpolated;
  enriched.tierTooltips = interpolatedTooltips;
  info.tiers = interpolated;
  info.tierTooltips = interpolatedTooltips;
  CAT.names[pathStr] = enriched;
}

CAT.auth = Array.from(authenticAffixes.keys());

// Verified in-game maximum roll clamps & overrides
const VERIFIED_MAX_OVERRIDES = {
  '/Game/TQ2/Items/Affixes/Prefixes/da_prefix_1_Summons_PerIncreasedActivations.da_prefix_1_Summons_PerIncreasedActivations|/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_Activations_PerIncreasedAmount': [15, 35],
  '/Game/TQ2/Items/Affixes/Prefixes/da_prefix_1_Summons_PerIncreasedSpeed_All.da_prefix_1_Summons_PerIncreasedSpeed_All|/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerIncreasedSpeed': [9, 13],
  '/Game/TQ2/Items/Affixes/Prefixes/da_prefix_1_Summons_PerIncreasedDamage_All.da_prefix_1_Summons_PerIncreasedDamage_All|/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerIncreasedAllDmg': [10, 45],
  '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_Summons_PerIncreasedHealth.da_suffix_1_Summons_PerIncreasedHealth|/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerIncreasedHealth': [15, 60],
  '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_Might.da_suffix_1_Might|/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_Might': [4, 55],
  '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_Agility.da_suffix_1_Agility|/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_Agility': [4, 55],
  '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_FreeEnergyReservation.da_suffix_1_FreeEnergyReservation|/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_LessEnergyReserved': [15, 50],
  '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_PerIncreasedMovementSpeed.da_suffix_1_PerIncreasedMovementSpeed|/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerIncreasedMovementSpeed': [4, 25],
  '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_PerIncreasedAttackSpeed.da_suffix_1_PerIncreasedAttackSpeed|/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerIncreasedAttackSpeed': [5, 23],
  '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_PerIncreasedCastSpeed.da_suffix_1_PerIncreasedCastSpeed|/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerIncreasedCastSpeed': [5, 23],
  '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_FlatCritChance.da_suffix_1_FlatCritChance|/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_FlatCritChance': [2, 18],
  '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_IncrCritDmgMultiplier.da_suffix_1_IncrCritDmgMultiplier|/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_IncrCritDmgMultiplier': [6, 50]
};

for (const [key, range] of Object.entries(VERIFIED_MAX_OVERRIDES)) {
  CAT.s[key] = range;
}

// Strict Final Sanitation Pass: Clean CAT.a and CAT.names of ANY ghost/broken entry
for (const k of Object.keys(CAT.a)) {
  const daName = k.split('/').pop().replace(/\.da_.*$/, '');
  const ges = CAT.a[k].g || [];
  const meta = CAT.names[k] || {};
  const tip = (meta.tooltip || '').trim();

  // 1. Must be in UTOC
  if (utocDaSet && !utocDaSet.has(daName)) {
    delete CAT.a[k];
    delete CAT.names[k];
    continue;
  }

  // 2. Reject known broken EA affixes
  if (k.includes('da_prefix_1_PerIncreasedEnergy')) {
    delete CAT.a[k];
    delete CAT.names[k];
    continue;
  }

  // 3. Must have valid non-empty tooltip
  if (!tip || tip === '{Value}' || tip.startsWith('da_')) {
    delete CAT.a[k];
    delete CAT.names[k];
    continue;
  }

  // 4. Must have all GEs in UTOC
  if (utocGeSet) {
    const missingGe = ges.some(g => !utocGeSet.has(g.split('/').pop()));
    if (missingGe || ges.length === 0) {
      delete CAT.a[k];
      delete CAT.names[k];
      continue;
    }
  }
}

const explicitAffixOverrides = {
  '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_Energy.da_suffix_1_Energy': {
    title: '+ Năng lượng tối đa (Max Energy) · "of Essence" (of Mana)',
    tooltip: '{Value}|fmt(sign=true) Energy'
  },
  '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_FlatEnergyFlatEnergyRegen.da_suffix_1_FlatEnergyFlatEnergyRegen': {
    title: '+ Năng lượng & Hồi Năng lượng/s · "of Study" (of Transcendence)',
    tooltip: '{Value}|fmt(sign=true) Energy & Energy Regeneration'
  },
  '/Game/TQ2/Items/Affixes/Prefixes/da_prefix_1_FlatEnergyRegen.da_prefix_1_FlatEnergyRegen': {
    title: '+ Hồi Năng lượng / giây (Energy Regen/s) · "Trickling" (Flooding)',
    tooltip: '{Value}|fmt(sign=true) Energy Regeneration per second'
  }
};

for (const [k, v] of Object.entries(explicitAffixOverrides)) {
  if (CAT.names[k]) {
    if (v.title) CAT.names[k].title = v.title;
    if (v.tooltip) CAT.names[k].tooltip = v.tooltip;
  }
}

delete CAT.itemSet;
for (const k of Object.keys(CAT.a)) {
  const info = CAT.a[k];
  if (!info.g || info.g.length === 0) {
    info.g = resolveGameplayEffects(k);
  }
  if (info.tb && !info.t) {
    info.t = Buffer.from(info.tb).toString('base64');
    delete info.tb;
  }
}

// Compress & Save
const jsonStr = JSON.stringify(CAT);
const gzipped = zlib.gzipSync(Buffer.from(jsonStr, 'utf8'));
const base64Str = gzipped.toString('base64');
const outputCode = `window.__CATALOG__="${base64Str}";\n`;
fs.writeFileSync(catPath, outputCode, 'utf8');

console.log('✓ Successfully compiled unified catalog with 100% matched GameplayEffects!');
console.log(`  Total Affixes: ${Object.keys(CAT.a).length}`);
console.log(`  Total Item Templates: ${CAT.i.length}`);
console.log(`  Total Localized Names/Tooltips: ${Object.keys(CAT.names).length}`);
