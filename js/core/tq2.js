/* TQ2 domain helpers on top of GVAS */
(function (root) {
'use strict';
const G = root.GVAS || (typeof require !== 'undefined' ? require('./gvas.js') : null);
const I18N = root.TQ2_I18N || (typeof require !== 'undefined' ? (function() { try { return require('./i18n.js'); } catch(e) { return null; } })() : null);
const t = (k, p) => (I18N && typeof I18N.t === 'function' ? I18N.t(k, p) : null);

const CONTAINER_NAMES = {
  m_Equipment: 'Equipped Gear',
  m_Inventories: 'Backpack Inventory',
  m_SharedCurrenciesInventory: 'Currencies',
};

function collectContainers(save) {
  const out = [];
  const seen = new Set();
  function scan(v, path) {
    if (!v || seen.has(v)) return;
    if (v instanceof G.Struct) {
      if (v.sname === 'GrimItemContainerSaveData') { out.push({ path, c: v }); return; }
      return scan(v.body, path);
    }
    if (v instanceof G.Handle) { for (const [, pl] of v.insts) scan(pl, path); return; }
    if (v instanceof G.SGD) return scan(v.body, path + '/' + v.name);
    if (v instanceof G.PropList) {
      for (const p of v.props) {
        const idxStr = (p.flags & 1) ? `[${p.arrIndex}]` : '';
        scan(p.value, path + '/' + p.name + idxStr);
      }
      return;
    }
    if (v instanceof G.Arr) { v.items.forEach((x, i) => scan(x, path + '[' + i + ']')); return; }
    if (v instanceof G.MapV) { v.pairs.forEach(([k, val], i) => scan(val, path + '{' + i + '}')); return; }
  }
  scan(save.root, '');
  return out;
}

function containerLabel(path, idx) {
  if (path.indexOf('m_Equipment') >= 0) return (t && t('containers.m_Equipment')) || 'Trang bị Đang mặc (Equipped Gear)';

  if (path.indexOf('PlayerState/m_Inventories') >= 0 || (path.indexOf('m_Inventories') >= 0 && path.indexOf('Caravan') < 0)) {
    const m = path.match(/m_Inventories(?:\[(\d+)\])?/);
    const arrIdx = m && m[1] !== undefined ? parseInt(m[1]) : 0;
    switch (arrIdx) {
      case 0: return (t && t('containers.backpack_main')) || 'Túi đồ Hành trang (Backpack Inventory)';
      case 1: return (t && t('containers.backpack_special')) || 'Túi đồ · Ô Đặc biệt (Backpack Special Slot)';
      case 2: return (t && t('containers.quest_pouch')) || 'Túi Đồ Nhiệm vụ (Quest Items & Pouch)';
      case 3: return (t && t('containers.personal_stash_1')) || 'Rương Cá nhân Tab 1 (Personal Stash Tab 1)';
      case 4: return (t && t('containers.personal_stash_2')) || 'Rương Cá nhân Tab 2 (Personal Stash Tab 2)';
      default: return (t && t('containers.personal_stash_n', { n: arrIdx + 1 })) || `Rương Cá nhân Ô ${arrIdx + 1} (Personal Stash ${arrIdx + 1})`;
    }
  }

  if (path.indexOf('SoloSelfFoundCaravan') >= 0) {
    if (path.indexOf('m_SharedCurrenciesInventory') >= 0) return (t && t('containers.caravan_materials')) || 'Đoàn buôn · Kho Nguyên liệu (Caravan Materials)';
    const m = path.match(/m_Inventories(?:\[(\d+)\])?/);
    const arrIdx = m && m[1] !== undefined ? parseInt(m[1]) : 0;
    return (t && t('containers.caravan_stash_n', { n: arrIdx + 1 })) || `Đoàn buôn · Rương Tab ${arrIdx + 1} (Caravan Stash ${arrIdx + 1})`;
  }

  if (path.indexOf('CrossCharacterCaravan') >= 0) {
    if (path.indexOf('m_SharedCurrenciesInventory') >= 0) return (t && t('containers.shared_materials')) || 'Dùng chung · Kho Nguyên liệu (Shared Materials)';
    const m = path.match(/m_Inventories(?:\[(\d+)\])?/);
    const arrIdx = m && m[1] !== undefined ? parseInt(m[1]) : 0;
    return (t && t('containers.shared_stash_n', { n: arrIdx + 1 })) || `Dùng chung · Rương Tab ${arrIdx + 1} (Shared Stash ${arrIdx + 1})`;
  }

  const parts = path.split('/').filter(Boolean);
  const last = parts[parts.length - 1].replace(/\[\d+\]$/, '');
  const arrIdx = /\[(\d+)\]$/.exec(parts[parts.length - 1]);
  let base = CONTAINER_NAMES[last] || last;
  if (arrIdx) base += ' ' + (parseInt(arrIdx[1]) + 1);
  return base;
}

function listItems(save) {
  const items = [];
  collectContainers(save).forEach((entry, ci) => {
    const body = entry.c.body;
    if (!body || !body.get) return;
    const ib = body.get('ItemsBySlot');
    if (!ib || !(ib.value instanceof G.MapV)) return;
    ib.value.pairs.forEach(([k, slotStruct], pi) => {
      const hp = slotStruct.get && slotStruct.get('ItemHandle');
      if (!hp) return;
      const h = hp.value;
      if (!(h instanceof G.Handle)) return;
      const numProp = slotStruct.get('Num');
      items.push({
        container: containerLabel(entry.path, ci),
        containerPath: entry.path,
        slot: k instanceof G.Scalar ? k.v : pi,
        handle: h,
        num: numProp ? numProp.value : null,
        props: h.body,
      });
    });
  });
  return items;
}

function prop(item, name) {
  return item.props ? item.props.get(name) : null;
}
function pval(item, name) {
  const p = prop(item, name);
  return p && p.value instanceof G.Scalar ? p.value.v : null;
}
function affixes(item) {
  const p = prop(item, 'm_Affixes');
  return p && p.value instanceof G.Arr ? p.value : null;
}
function affixField(a, name) {
  const p = a.body && a.body.get ? a.body.get(name) : null;
  return p ? p.value : null;
}
function affixEffects(a) {
  const v = affixField(a, 'AffixEffectInstances');
  return v instanceof G.Arr ? v.items : [];
}

function setBaseItem(item, pkg, asset) {
  item.handle.pkg = pkg; item.handle.asset = asset; item.handle.mark();
  const d = prop(item, 'm_pDescription');
  if (d && d.value instanceof G.Struct && d.value.body instanceof G.Raw) {
    const w = new G.W();
    w.str(pkg); w.str(asset); w.i32(0);
    d.value.body = new G.Raw(w.done());
    d.value.mark();
  }
}

function parseUnrealAssetPath(path) {
  if (!path) return '';
  const last = path.split('/').pop();
  const dupMatch = last.match(/^(.*?)\.\1$/);
  if (dupMatch) return dupMatch[1];
  const subMatch = last.match(/\.((?:da|bp|BP)_[^.]+)$/);
  if (subMatch) return subMatch[1];
  const dotIdx = last.lastIndexOf('.');
  if (dotIdx > 0 && !last.slice(0, dotIdx).includes('.')) return last.slice(0, dotIdx);
  return last;
}

function affixShortName(path) {
  if (!path) return '(None)';
  const m = affixMeta(path);
  if (m && m.englishTitle) return m.englishTitle;

  let s = parseUnrealAssetPath(path);
  s = s.replace(/^da_(prefix|suffix|implicit|affix)_\d*_?/, '')
       .replace(/^Unique_/, '')
       .replace(/_unrestricted$/, '')
       .replace(/_High$/i, ' (High)')
       .replace(/_Med$/i, ' (Medium)')
       .replace(/_Low$/i, ' (Low)')
       .replace(/PerIncreased/g, '% Inc. ')
       .replace(/PerRes/g, '% Resistance: ')
       .replace(/Per/g, '% ')
       .replace(/Flat/g, '+ Flat ')
       .replace(/Incr/g, '% Inc. ')
       .replace(/Dmg/g, 'Damage')
       .replace(/([a-z])([A-Z])/g, '$1 $2')
       .replace(/_/g, ' ')
       .replace(/\s+/g, ' ');
  return s.trim();
}

function affixMeta(path) {
  if (typeof CAT !== 'undefined' && CAT.names && CAT.names[path]) {
    return CAT.names[path];
  }
  return null;
}

function affixLocalizedName(path) {
  const m = affixMeta(path);
  return m && m.title ? m.title : '';
}

function affixTooltip(path) {
  const m = affixMeta(path);
  return m && m.tooltip ? m.tooltip : '';
}

function affixTierTitle(path, level) {
  const m = affixMeta(path);
  if (!m) return affixShortName(path);
  if (level !== undefined && level !== null && m.tiers && m.tiers[level]) {
    return m.tiers[level];
  }
  return m.title || m.englishTitle || affixShortName(path);
}

function affixKind(path) {
  if (!path) return 'Other';
  if (path.indexOf('/Prefixes/') >= 0) return 'Prefix';
  if (path.indexOf('/Suffixes/') >= 0) return 'Suffix';
  if (path.indexOf('/Implicits/') >= 0) return 'Implicit';
  return 'Other';
}

function humanizeEffectName(path, fallback) {
  if (!path) return fallback || (t ? t('effects.stat_modifier') : 'Stat Modifier');
  let s = parseUnrealAssetPath(path);
  const p = path.toLowerCase();
  
  if (p.includes('perincreasedattackspeed')) return (t && t('effects.attack_speed')) || '+ % Attack Speed';
  if (p.includes('perincreasedcastspeed')) return (t && t('effects.cast_speed')) || '+ % Cast Speed';
  if (p.includes('perincreasedmovementspeed')) return (t && t('effects.move_speed')) || '+ % Movement Speed';
  if (p.includes('perincreasedcooldownspeed')) return (t && t('effects.cooldown_speed')) || '+ % Cooldown Speed';
  if (p.includes('flatcritchance')) return (t && t('effects.crit_chance')) || '+ % Critical Strike Chance';
  if (p.includes('incrcritdmgmultiplier')) return (t && t('effects.crit_dmg')) || '+ % Critical Damage';
  if (p.includes('incrattackcastspeed')) return (t && t('effects.attack_cast_speed')) || '+ % Attack & Cast Speed';
  if (p.includes('energyregenpersecond')) return (t && t('effects.energy_regen')) || '+ Energy Regen / sec';
  if (p.includes('energybarrier')) return (t && t('effects.energy_barrier')) || '+ Energy Barrier';
  if (p.includes('lessenergyreserved')) return (t && t('effects.less_energy_reserved')) || 'Less % Energy Reserved';
  if (p.includes('perresfire')) return (t && t('effects.res_fire')) || '+ % Fire Resistance';
  if (p.includes('perrescold')) return (t && t('effects.res_cold')) || '+ % Cold Resistance';
  if (p.includes('perreslightning')) return (t && t('effects.res_lightning')) || '+ % Lightning Resistance';
  if (p.includes('perrespoison')) return (t && t('effects.res_poison')) || '+ % Poison Resistance';
  if (p.includes('perresphysical')) return (t && t('effects.res_physical')) || '+ % Physical Resistance';
  if (p.includes('perresimpairment')) return (t && t('effects.res_impair')) || '+ % Impairment Resistance';
  if (p.includes('perresailments')) return (t && t('effects.res_ailment')) || '+ % Ailment Resistance';
  if (p.includes('perresall')) return (t && t('effects.res_all')) || '+ % All Resistances';
  if (p.includes('might')) return (t && t('effects.might')) || '+ Might';
  if (p.includes('agility')) return (t && t('effects.agility')) || '+ Agility';
  if (p.includes('knowledge')) return (t && t('effects.knowledge')) || '+ Knowledge';
  if (p.includes('vigor')) return (t && t('effects.vigor')) || '+ Vigor';
  if (p.includes('energy')) return (t && t('effects.max_energy')) || '+ Max Energy';
  if (p.includes('health')) return (t && t('effects.max_health')) || '+ Max Health';
  if (p.includes('perincreasedalldmg')) return (t && t('effects.all_damage')) || '+ % All Damage';
  if (p.includes('perincreasedspeed')) return (t && t('effects.speed')) || '+ % Speed';
  if (p.includes('activations_perincreasedamount')) return (t && t('effects.skill_activations')) || '+ % Skill Activations';
  if (p.includes('perincreasedfiredmg')) return (t && t('effects.fire_damage')) || '+ % Fire Damage';
  if (p.includes('perincreasedcolddmg')) return (t && t('effects.cold_damage')) || '+ % Cold Damage';
  if (p.includes('perincreasedlightningdmg')) return (t && t('effects.lightning_damage')) || '+ % Lightning Damage';
  if (p.includes('perincreasedpoisondmg')) return (t && t('effects.poison_damage')) || '+ % Poison Damage';
  if (p.includes('perincreasedpiercedmg')) return (t && t('effects.pierce_damage')) || '+ % Pierce Damage';
  if (p.includes('perincreasedvitalitydmg')) return (t && t('effects.vitality_damage')) || '+ % Vitality Damage';
  if (p.includes('perincreasedspelldmg')) return (t && t('effects.spell_damage')) || '+ % Spell Damage';
  if (p.includes('perincreasedareadmg')) return (t && t('effects.area_damage')) || '+ % Area Damage';
  if (p.includes('perincreasedprojectiledmg')) return (t && t('effects.projectile_damage')) || '+ % Projectile Damage';
  if (p.includes('perincreasedstrikedmg')) return (t && t('effects.strike_damage')) || '+ % Strike Damage';
  if (p.includes('perincreasedailmentchance')) return (t && t('effects.ailment_chance')) || '+ % Ailment Chance';
  if (p.includes('perincreasedailmentpower')) return (t && t('effects.ailment_power')) || '+ % Ailment Power';
  if (p.includes('potion_instanthealthrecovery')) return (t && t('effects.potion_instant_recovery')) || '+ % Instant Health Recovery';
  if (p.includes('potion_health_chargesconsumed')) return (t && t('effects.potion_charges_consumed')) || 'Less Charges Consumed';
  if (p.includes('potion_energy_increffectduration')) return (t && t('effects.potion_effect_duration')) || '+ % Potion Effect Duration';

  s = s.replace(/^bp_ge_(implicit_|affix_|UniqueEffect_)?\d*_?/, '')
       .replace(/^PerIncreased/, '% Inc. ')
       .replace(/^PerRes/, '+ % Resistance: ')
       .replace(/^Per/, '% ')
       .replace(/^\+?EnergyRegenPerSecond/, '+ Energy Regen / sec')
       .replace(/^IncrCritDmgMultiplier/, '+ % Critical Damage')
       .replace(/^IncrAttackCastSpeed/, '+ % Attack & Cast Speed')
       .replace(/^Incr/, '+ % ')
       .replace(/Dmg/g, 'Damage')
       .replace(/([a-z])([A-Z])/g, '$1 $2')
       .replace(/_/g, ' ')
       .replace(/\s+/g, ' ');
  return s.trim();
}

const KNOWN_ITEMS = {
  "da_armor_arm_greek_battlemage": {
    "title": "Greek Battlemage Vambraces",
    "subtitle": "Greek Battlemage Vambraces",
    "cat": "armor"
  },
  "da_armor_arm_greek_fighter": {
    "title": "Greek Fighter Vambraces",
    "subtitle": "Greek Fighter Vambraces",
    "cat": "armor"
  },
  "da_armor_arm_greek_paladin": {
    "title": "Greek Paladin Vambraces",
    "subtitle": "Arm Armor · Paladin",
    "cat": "armor"
  },
  "da_armor_arm_greek_rogue": {
    "title": "Greek Rogue Vambraces",
    "subtitle": "Greek Rogue Vambraces",
    "cat": "armor"
  },
  "da_armor_arm_greek_sorcerer": {
    "title": "Greek Sorcerer Vambraces",
    "subtitle": "Greek Sorcerer Vambraces",
    "cat": "armor"
  },
  "da_armor_arm_ichthian_sorcerer": {
    "title": "Ichthian Sorcerer Vambraces",
    "subtitle": "Ichthian Sorcerer Vambraces",
    "cat": "armor"
  },
  "da_armor_arm_ichthian_sorcerer_MI": {
    "title": "Ichthian Sorcerer Vambraces (MI)",
    "subtitle": "Ichthian Sorcerer Vambraces · Monster Infrequent",
    "cat": "armor"
  },
  "da_armor_head_greek_battlemage": {
    "title": "Greek Battlemage Helm",
    "subtitle": "Greek Battlemage Helm",
    "cat": "armor"
  },
  "da_armor_head_greek_rogue": {
    "title": "Greek Rogue Helm",
    "subtitle": "Greek Rogue Helm",
    "cat": "armor"
  },
  "da_armor_head_greek_sorcerer": {
    "title": "Greek Sorcerer Helm",
    "subtitle": "Greek Sorcerer Helm",
    "cat": "armor"
  },
  "da_armor_head_ichthian_fighter": {
    "title": "Ichthian Fighter Helm",
    "subtitle": "Head Armor · Monster Infrequent",
    "cat": "armor"
  },
  "da_armor_head_ichthian_fighter_MI": {
    "title": "Ichthian Fighter Helm (MI)",
    "subtitle": "Ichthian Fighter Helm · Monster Infrequent",
    "cat": "armor"
  },
  "da_armor_leg_greek_battlemage": {
    "title": "Greek Battlemage Vambraces",
    "subtitle": "Greek Battlemage Vambraces",
    "cat": "armor"
  },
  "da_armor_leg_greek_knight": {
    "title": "Greek Knight Vambraces",
    "subtitle": "Greek Knight Vambraces",
    "cat": "armor"
  },
  "da_armor_leg_greek_rogue": {
    "title": "Greek Rogue Vambraces",
    "subtitle": "Greek Rogue Vambraces",
    "cat": "armor"
  },
  "da_armor_leg_greek_sorcerer": {
    "title": "Greek Sorcerer Vambraces",
    "subtitle": "Greek Sorcerer Vambraces",
    "cat": "armor"
  },
  "da_armor_leg_ichthian_fighter_MI": {
    "title": "Ichthian Fighter Greaves",
    "subtitle": "Leg Armor · Monster Infrequent",
    "cat": "armor"
  },
  "da_armor_shoulder_greek_rogue": {
    "title": "Greek Rogue Pauldrons",
    "subtitle": "Shoulder Armor · Rogue",
    "cat": "armor"
  },
  "da_armor_shoulder_greek_sorcerer": {
    "title": "Greek Sorcerer Pauldrons",
    "subtitle": "Greek Sorcerer Pauldrons",
    "cat": "armor"
  },
  "da_armor_shoulder_ichthian_fighter": {
    "title": "Ichthian Fighter Pauldrons",
    "subtitle": "Ichthian Fighter Pauldrons",
    "cat": "armor"
  },
  "da_armor_shoulder_ichthian_sorcerer_MI": {
    "title": "Ichthian Sorcerer Pauldrons (MI)",
    "subtitle": "Ichthian Sorcerer Pauldrons · Monster Infrequent",
    "cat": "armor"
  },
  "da_armor_torso_greek_battlemage": {
    "title": "Greek Battlemage Cuirass",
    "subtitle": "Greek Battlemage Cuirass",
    "cat": "armor"
  },
  "da_armor_torso_greek_knight": {
    "title": "Greek Knight Cuirass",
    "subtitle": "Torso Armor · Knight",
    "cat": "armor"
  },
  "da_armor_torso_greek_paladin": {
    "title": "Greek Paladin Cuirass",
    "subtitle": "Greek Paladin Cuirass",
    "cat": "armor"
  },
  "da_armor_torso_greek_sorcerer": {
    "title": "Greek Sorcerer Cuirass",
    "subtitle": "Greek Sorcerer Cuirass",
    "cat": "armor"
  },
  "da_armor_torso_ichthian_fighter": {
    "title": "Ichthian Fighter Cuirass",
    "subtitle": "Ichthian Fighter Cuirass",
    "cat": "armor"
  },
  "da_armor_torso_ichthian_paladin_MI": {
    "title": "Ichthian Paladin Cuirass (MI)",
    "subtitle": "Ichthian Paladin Cuirass · Monster Infrequent",
    "cat": "armor"
  },
  "da_item_02_nb_s_lucky_coin": {
    "title": "Lucky Coin",
    "subtitle": "Special Quest Item",
    "cat": "currency"
  },
  "da_item_embers_of_night": {
    "title": "Embers of Night",
    "subtitle": "Relic Material · Night Essence",
    "cat": "relic"
  },
  "da_item_embers_tier1_active_00": {
    "title": "Embers of Active",
    "subtitle": "Tier 1 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier1_attribute_00": {
    "title": "Embers of Attribute",
    "subtitle": "Tier 1 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier1_attribute_01": {
    "title": "Embers of Attribute",
    "subtitle": "Tier 1 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier1_passive_00": {
    "title": "Embers of Passive",
    "subtitle": "Tier 1 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier2_active_00": {
    "title": "Embers of Active",
    "subtitle": "Tier 2 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier2_attribute_00": {
    "title": "Embers of Attribute",
    "subtitle": "Tier 2 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier2_attribute_01": {
    "title": "Embers of Attribute",
    "subtitle": "Tier 2 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier2_passive_00": {
    "title": "Embers of Passive",
    "subtitle": "Tier 2 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier3_active_00": {
    "title": "Embers of Active",
    "subtitle": "Tier 3 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier3_attribute_00": {
    "title": "Embers of Attribute",
    "subtitle": "Tier 3 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier3_attribute_01": {
    "title": "Embers of Attribute",
    "subtitle": "Tier 3 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier3_passive_00": {
    "title": "Embers of Passive",
    "subtitle": "Tier 3 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier4_active_00": {
    "title": "Embers of Active",
    "subtitle": "Tier 4 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier4_attribute_00": {
    "title": "Embers of Attribute",
    "subtitle": "Tier 4 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier4_attribute_01": {
    "title": "Embers of Attribute",
    "subtitle": "Tier 4 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier4_passive_00": {
    "title": "Embers of Passive",
    "subtitle": "Tier 4 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier5_active_00": {
    "title": "Embers of Active",
    "subtitle": "Tier 5 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier5_active_01": {
    "title": "Embers of Active",
    "subtitle": "Tier 5 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier5_attribute_00": {
    "title": "Embers of Attribute",
    "subtitle": "Tier 5 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier5_attribute_01": {
    "title": "Embers of Attribute",
    "subtitle": "Tier 5 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier5_attribute_02": {
    "title": "Embers of Attribute",
    "subtitle": "Tier 5 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier5_passive_00": {
    "title": "Embers of Passive",
    "subtitle": "Tier 5 Relic Component",
    "cat": "relic"
  },
  "da_item_embers_tier5_passive_01": {
    "title": "Embers of Passive",
    "subtitle": "Tier 5 Relic Component",
    "cat": "relic"
  },
  "da_item_gold": {
    "title": "Gold",
    "subtitle": "Primary Currency",
    "cat": "currency"
  },
  "da_item_mat_tier1_crude_fragments": {
    "title": "Crude Fragments",
    "subtitle": "Tier 1 Crafting Material",
    "cat": "currency"
  },
  "da_item_mat_tier2_mystic_shards": {
    "title": "Mystic Shards",
    "subtitle": "Tier 2 Crafting Material",
    "cat": "currency"
  },
  "da_item_mat_tier3_amplified_energy": {
    "title": "Amplified Energy",
    "subtitle": "Tier 3 Crafting Material",
    "cat": "currency"
  },
  "da_item_mat_tier3_vital_flame": {
    "title": "Vital Flame",
    "subtitle": "Tier 3 Crafting Material",
    "cat": "currency"
  },
  "da_item_mat_tier4_bound_essence": {
    "title": "Bound Essence",
    "subtitle": "Tier 4 Crafting Material",
    "cat": "currency"
  },
  "da_item_mat_tier5_golden_spark": {
    "title": "Golden Spark",
    "subtitle": "Tier 5 Crafting Material",
    "cat": "currency"
  },
  "da_jewelry_neck_normal_greek_agility_t1": {
    "title": "Greek Amulet of Agility",
    "subtitle": "Tier 1 Greek Amulet · +Agility",
    "cat": "relic"
  },
  "da_jewelry_neck_normal_ichthian_knowledge_t1": {
    "title": "Ichthian Amulet of Knowledge",
    "subtitle": "Tier 1 Ichthian Amulet · +Knowledge",
    "cat": "relic"
  },
  "da_jewelry_neck_normal_ichthian_might_t1": {
    "title": "Ichthian Amulet of Might",
    "subtitle": "Tier 1 Ichthian Amulet · +Might",
    "cat": "relic"
  },
  "da_jewelry_neck_unique_t1_questreward_crabtrinket": {
    "title": "Crab Trinket Amulet",
    "subtitle": "Unique Amulet · Water Res",
    "cat": "relic"
  },
  "da_jewelry_neck_unique_t1_venomheart": {
    "title": "Venomheart Amulet",
    "subtitle": "Unique Amulet · Poison Res",
    "cat": "relic"
  },
  "da_jewelry_ring_normal_greek_agility_t1": {
    "title": "Greek Ring of Agility",
    "subtitle": "Tier 1 Greek Ring · +Agility",
    "cat": "relic"
  },
  "da_jewelry_ring_normal_greek_knowledge_t1": {
    "title": "Greek Ring of Knowledge",
    "subtitle": "Tier 1 Greek Ring · +Knowledge",
    "cat": "relic"
  },
  "da_jewelry_ring_normal_greek_might_t1": {
    "title": "Greek Ring of Might",
    "subtitle": "Tier 1 Greek Ring · +Might",
    "cat": "relic"
  },
  "da_jewelry_ring_normal_ichthian_agility_t1": {
    "title": "Ichthian Ring of Agility",
    "subtitle": "Tier 1 Ichthian Ring · +Agility",
    "cat": "relic"
  },
  "da_jewelry_ring_normal_ichthian_knowledge_t1": {
    "title": "Ichthian Ring of Knowledge",
    "subtitle": "Tier 1 Ichthian Ring · +Knowledge",
    "cat": "relic"
  },
  "da_jewelry_ring_unique_t1_captainssignet": {
    "title": "Captain's Signet",
    "subtitle": "Unique Ring · Might/Defense",
    "cat": "relic"
  },
  "da_jewelry_ring_unique_t1_cartouchering": {
    "title": "Cartouche Ring",
    "subtitle": "Unique Ring · Magic/Knowledge",
    "cat": "relic"
  },
  "da_jewelry_ring_unique_t1_cratuscoil": {
    "title": "Cratus' Coil",
    "subtitle": "Unique Ring · Attack Speed",
    "cat": "relic"
  },
  "da_lootbox_embers_tier1_charm_normal_00": {
    "title": "Charm Normal Cache",
    "subtitle": "Tier 1 Loot Container",
    "cat": "relic"
  },
  "da_lootbox_embers_tier1_charm_normal_01": {
    "title": "Charm Normal Cache",
    "subtitle": "Tier 1 Loot Container",
    "cat": "relic"
  },
  "da_lootbox_embers_tier1_unique_00": {
    "title": "Unique Cache",
    "subtitle": "Tier 1 Loot Container",
    "cat": "relic"
  },
  "da_lootbox_embers_tier2_charm_normal_00": {
    "title": "Charm Normal Cache",
    "subtitle": "Tier 2 Loot Container",
    "cat": "relic"
  },
  "da_lootbox_embers_tier2_relic_normal_00": {
    "title": "Relic Normal Cache",
    "subtitle": "Tier 2 Loot Container",
    "cat": "relic"
  },
  "da_lootbox_embers_tier2_unique_00": {
    "title": "Unique Cache",
    "subtitle": "Tier 2 Loot Container",
    "cat": "relic"
  },
  "da_lootbox_embers_tier3_charm_normal_00": {
    "title": "Charm Normal Cache",
    "subtitle": "Tier 3 Loot Container",
    "cat": "relic"
  },
  "da_lootbox_embers_tier3_relic_normal_00": {
    "title": "Relic Normal Cache",
    "subtitle": "Tier 3 Loot Container",
    "cat": "relic"
  },
  "da_lootbox_embers_tier3_unique_00": {
    "title": "Unique Cache",
    "subtitle": "Tier 3 Loot Container",
    "cat": "relic"
  },
  "da_lootbox_embers_tier4_charm_normal_00": {
    "title": "Charm Normal Cache",
    "subtitle": "Tier 4 Loot Container",
    "cat": "relic"
  },
  "da_lootbox_embers_tier4_relic_normal_00": {
    "title": "Relic Normal Cache",
    "subtitle": "Tier 4 Loot Container",
    "cat": "relic"
  },
  "da_lootbox_embers_tier4_relic_normal_01": {
    "title": "Relic Normal Cache",
    "subtitle": "Tier 4 Loot Container",
    "cat": "relic"
  },
  "da_lootbox_embers_tier5_unique_00": {
    "title": "Unique Cache",
    "subtitle": "Tier 5 Loot Container",
    "cat": "relic"
  },
  "da_lootbox_embers_tier5_unique_01": {
    "title": "Unique Cache",
    "subtitle": "Tier 5 Loot Container",
    "cat": "relic"
  },
  "da_potion_energy_L1": {
    "title": "Energy Potion (L1)",
    "subtitle": "Restores 350 Energy",
    "cat": "currency"
  },
  "da_potion_energy_startinggear": {
    "title": "Novice Energy Potion",
    "subtitle": "Consumable Potion",
    "cat": "currency"
  },
  "da_potion_health_L1": {
    "title": "Health Potion (L1)",
    "subtitle": "Restores 450 Health",
    "cat": "currency"
  },
  "da_potion_health_startinggear": {
    "title": "Novice Health Potion",
    "subtitle": "Consumable Potion",
    "cat": "currency"
  },
  "da_quest_01_ff_s_ng_moly": {
    "title": "Moly Flower",
    "subtitle": "Quest Item · Greece",
    "cat": "currency"
  },
  "da_socket_charm_beasttail": {
    "title": "Beast Tail Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_blightedessence_01": {
    "title": "Blighted Essence Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_boarblood_01": {
    "title": "Boarblood Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_boarhide1_01": {
    "title": "Boar Hide Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_crabpincer": {
    "title": "Crab Pincer Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_equilibriumessence_01": {
    "title": "Equilibrium Essence Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_glacialshard_01": {
    "title": "Glacial Shard Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_hollowessence_01": {
    "title": "Hollow Essence Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_hollowfang_01": {
    "title": "Hollow Fang Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_ichthianfin_01": {
    "title": "Ichthian Fin Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_ichthianpearl1_01": {
    "title": "Ichthian Pearl Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_lupineclaw_01": {
    "title": "Lupine Claw Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_marbleheart_01": {
    "title": "Marble Heart Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_mechanicalparts_01": {
    "title": "Mechanical Parts Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_membranewings_01": {
    "title": "Membrane Wings Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_necroticbones_01": {
    "title": "Necrotic Bones Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_primalmagma_01": {
    "title": "Primal Magma Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_primaltempest_01": {
    "title": "Primal Tempest Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_pristineplumage_01": {
    "title": "Pristine Plumage Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_rigidcarapace_01": {
    "title": "Rigid Carapace Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_spectralmatter_01": {
    "title": "Spectral Matter Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_torturedsoul_01": {
    "title": "Tortured Soul Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_turtleshell_01": {
    "title": "Turtle Shell Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_venomsac_01": {
    "title": "Venom Sac Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_charm_vileichor_01": {
    "title": "Vile Ichor Charm",
    "subtitle": "Socketable Creature Essence",
    "cat": "relic"
  },
  "da_socket_relic_achilles_01": {
    "title": "Relic of Achilles",
    "subtitle": "Socketable Divine Relic · Achilles",
    "cat": "relic"
  },
  "da_socket_relic_ajax_01": {
    "title": "Relic of Ajax",
    "subtitle": "Socketable Divine Relic · Ajax",
    "cat": "relic"
  },
  "da_socket_relic_apollo_01": {
    "title": "Relic of Apollo",
    "subtitle": "Socketable Divine Relic · Apollo",
    "cat": "relic"
  },
  "da_socket_relic_archimedes_01": {
    "title": "Relic of Archimedes",
    "subtitle": "Socketable Divine Relic · Archimedes",
    "cat": "relic"
  },
  "da_socket_relic_ares_01": {
    "title": "Relic of Ares",
    "subtitle": "Socketable Divine Relic · Ares",
    "cat": "relic"
  },
  "da_socket_relic_athena_01": {
    "title": "Relic of Athena",
    "subtitle": "Socketable Divine Relic · Athena",
    "cat": "relic"
  },
  "da_socket_relic_charon_01": {
    "title": "Relic of Charon",
    "subtitle": "Socketable Divine Relic · Charon",
    "cat": "relic"
  },
  "da_socket_relic_demeter_01": {
    "title": "Relic of Demeter",
    "subtitle": "Socketable Divine Relic · Demeter",
    "cat": "relic"
  },
  "da_socket_relic_hector_01": {
    "title": "Relic of Hector",
    "subtitle": "Socketable Divine Relic · Hector",
    "cat": "relic"
  },
  "da_socket_relic_hephaistos_01": {
    "title": "Relic of Hephaistos",
    "subtitle": "Socketable Divine Relic · Hephaistos",
    "cat": "relic"
  },
  "da_socket_relic_hera_01": {
    "title": "Relic of Hera",
    "subtitle": "Socketable Divine Relic · Hera",
    "cat": "relic"
  },
  "da_socket_relic_hermes_01": {
    "title": "Relic of Hermes",
    "subtitle": "Socketable Divine Relic · Hermes",
    "cat": "relic"
  },
  "da_socket_relic_hestia_01": {
    "title": "Relic of Hestia",
    "subtitle": "Socketable Divine Relic · Hestia",
    "cat": "relic"
  },
  "da_socket_relic_minos_01": {
    "title": "Relic of Minos",
    "subtitle": "Socketable Divine Relic · Minos",
    "cat": "relic"
  },
  "da_socket_relic_pandora_01": {
    "title": "Relic of Pandora",
    "subtitle": "Socketable Divine Relic · Pandora",
    "cat": "relic"
  },
  "da_socket_relic_persephone_01": {
    "title": "Relic of Persephone",
    "subtitle": "Socketable Divine Relic · Persephone",
    "cat": "relic"
  },
  "da_socket_relic_perseus_01": {
    "title": "Relic of Perseus",
    "subtitle": "Socketable Divine Relic · Perseus",
    "cat": "relic"
  },
  "da_socket_relic_poseidon_01": {
    "title": "Relic of Poseidon",
    "subtitle": "Socketable Divine Relic · Poseidon",
    "cat": "relic"
  },
  "da_socket_relic_prometheus_01": {
    "title": "Relic of Prometheus",
    "subtitle": "Socketable Divine Relic · Prometheus",
    "cat": "relic"
  },
  "da_socket_relic_tartaros_01": {
    "title": "Relic of Tartaros",
    "subtitle": "Socketable Divine Relic · Tartaros",
    "cat": "relic"
  },
  "da_socket_relic_thanatos_01": {
    "title": "Relic of Thanatos",
    "subtitle": "Socketable Divine Relic · Thanatos",
    "cat": "relic"
  },
  "da_socket_relic_theia_01": {
    "title": "Relic of Theia",
    "subtitle": "Socketable Divine Relic · Theia",
    "cat": "relic"
  },
  "da_socket_relic_theseus_01": {
    "title": "Relic of Theseus",
    "subtitle": "Socketable Divine Relic · Theseus",
    "cat": "relic"
  },
  "da_socket_relic_typhon_01": {
    "title": "Relic of Typhon",
    "subtitle": "Socketable Divine Relic · Typhon",
    "cat": "relic"
  },
  "da_socket_relic_zeus_01": {
    "title": "Relic of Zeus",
    "subtitle": "Socketable Divine Relic · Zeus",
    "cat": "relic"
  },
  "da_weapon_1h_axe_normal_physical-cold_greek_t2": {
    "title": "Greek 1H War Axe (Physical & Cold)",
    "subtitle": "Tier 2 1H War Axe",
    "cat": "weapon"
  },
  "da_weapon_1h_axe_normal_physical-lightning_undead_t1_MI": {
    "title": "Undead 1H War Axe (Physical & Lightning) (MI)",
    "subtitle": "Tier 1 Monster Infrequent 1H War Axe",
    "cat": "weapon"
  },
  "da_weapon_1h_axe_unique_t1_onager_regen": {
    "title": "Onager",
    "subtitle": "Unique 1H War Axe · Regen",
    "cat": "weapon"
  },
  "da_weapon_1h_blunt_normal_strike_greek_t1": {
    "title": "Greek 1H Mace (Strike)",
    "subtitle": "Tier 1 1H Mace",
    "cat": "weapon"
  },
  "da_weapon_1h_blunt_normal_strike_greek_t1_MI_bandit": {
    "title": "Bandit's Bludgeon",
    "subtitle": "1H Mace · Monster Infrequent",
    "cat": "weapon"
  },
  "da_weapon_1h_blunt_unique_t1_coralmace": {
    "title": "Coral Mace",
    "subtitle": "Unique 1H Mace · Tier 1",
    "cat": "weapon"
  },
  "da_weapon_1h_blunt_unique_t1_lycurguswisdom": {
    "title": "Lycurgus' Wisdom",
    "subtitle": "Unique 1H Mace · Tier 1",
    "cat": "weapon"
  },
  "da_weapon_1h_blunt_unique_t1_ratcatcherstick_poison": {
    "title": "Ratcatcher Stick",
    "subtitle": "Unique 1H Mace · Poison",
    "cat": "weapon"
  },
  "da_weapon_1h_blunt_unique_t2_thornymaul_piercing": {
    "title": "Thorny Maul",
    "subtitle": "Unique 1H Mace · Piercing",
    "cat": "weapon"
  },
  "da_weapon_1h_dagger_normal_pierce_greek_t1": {
    "title": "Greek Dagger (Pierce)",
    "subtitle": "Tier 1 Dagger",
    "cat": "weapon"
  },
  "da_weapon_1h_dagger_normal_pierce_greek_t1_MI_bandit": {
    "title": "Greek Dagger (Pierce) (MI)",
    "subtitle": "Tier 1 Monster Infrequent Dagger",
    "cat": "weapon"
  },
  "da_weapon_1h_dagger_normal_pierce-lightning_greek_t2": {
    "title": "Greek Dagger (Lightning & Pierce)",
    "subtitle": "Tier 2 Dagger",
    "cat": "weapon"
  },
  "da_weapon_1h_dagger_startinggear": {
    "title": "Novice Dagger (Starting Gear)",
    "subtitle": "Dagger",
    "cat": "weapon"
  },
  "da_weapon_1h_dagger_unique_t1_fellblade_fire": {
    "title": "Fellblade",
    "subtitle": "Unique Dagger · Fire",
    "cat": "weapon"
  },
  "da_weapon_1h_dagger_unique_t1_mamertimesap_strike": {
    "title": "Mamertime Sap",
    "subtitle": "Unique Dagger · Strike",
    "cat": "weapon"
  },
  "da_weapon_1h_dagger_unique_t1_trygonstail_poison": {
    "title": "Trygon's Tail",
    "subtitle": "Unique Dagger · Poison",
    "cat": "weapon"
  },
  "da_weapon_1h_dagger_unique_t2_oathbreaker": {
    "title": "Oathbreaker",
    "subtitle": "Unique Dagger · Tier 2",
    "cat": "weapon"
  },
  "da_weapon_1h_spear_ornate_pierce-cold_ichthian_t1_MI": {
    "title": "Ichthian 1H Spear (Cold & Pierce) (MI)",
    "subtitle": "Tier 1 Monster Infrequent 1H Spear",
    "cat": "weapon"
  },
  "da_weapon_1h_spear_ornate_pierce-fire_greek_t2": {
    "title": "Greek 1H Spear (Fire & Pierce)",
    "subtitle": "Tier 2 1H Spear",
    "cat": "weapon"
  },
  "da_weapon_1h_spear_unique_t1_shadowsting_vitality": {
    "title": "Shadowsting",
    "subtitle": "Unique 1H Spear · Vitality",
    "cat": "weapon"
  },
  "da_weapon_1h_spear_unique_t1_shiverblood_cold": {
    "title": "Shiverblood",
    "subtitle": "Unique 1H Spear · Cold",
    "cat": "weapon"
  },
  "da_weapon_1h_spear_unique_t2_myrinesspear_poison": {
    "title": "Myrine's Spear",
    "subtitle": "Unique 1H Spear · Poison",
    "cat": "weapon"
  },
  "da_weapon_1h_sword_magic_spirit-lightning_greek_t3": {
    "title": "Greek 1H Sword (Lightning & Spirit)",
    "subtitle": "Tier 3 1H Sword",
    "cat": "weapon"
  },
  "da_weapon_1h_sword_normal_physical_greek_t1": {
    "title": "Greek 1H Sword (Physical)",
    "subtitle": "Tier 1 1H Sword",
    "cat": "weapon"
  },
  "da_weapon_1h_sword_normal_physical-poison_ichthian_t1_MI": {
    "title": "Ichthian 1H Sword (Physical & Poison) (MI)",
    "subtitle": "Tier 1 Monster Infrequent 1H Sword",
    "cat": "weapon"
  },
  "da_weapon_1h_sword_unique_t1_bonesaw_pierce": {
    "title": "Bonesaw",
    "subtitle": "Unique 1H Sword · Pierce",
    "cat": "weapon"
  },
  "da_weapon_1h_sword_unique_t1_questreward_kaenas_physical": {
    "title": "Kaenas' Blade",
    "subtitle": "Unique 1H Sword · Physical",
    "cat": "weapon"
  },
  "da_weapon_1h_sword_unique_t1_soulcarver_spirit": {
    "title": "Soulcarver",
    "subtitle": "Unique 1H Sword · Spirit",
    "cat": "weapon"
  },
  "da_weapon_1h_sword_unique_t2_nessusrage": {
    "title": "Nessus' Rage",
    "subtitle": "Unique 1H Sword · Bleed",
    "cat": "weapon"
  },
  "da_weapon_1h_sword_unique_t2_swordofdarkness_vitality": {
    "title": "Sword of Darkness",
    "subtitle": "Unique 1H Sword · Vitality",
    "cat": "weapon"
  },
  "da_weapon_2h_axe_light_physical_greek_t2": {
    "title": "Greek 2H Great Axe (Physical)",
    "subtitle": "Tier 2 2H Great Axe",
    "cat": "weapon"
  },
  "da_weapon_2h_axe_light_physical-lightning_greek_t2": {
    "title": "Greek 2H Great Axe (Physical & Lightning)",
    "subtitle": "Tier 2 2H Great Axe",
    "cat": "weapon"
  },
  "da_weapon_2h_axe_normal_physical_ichthian_t1": {
    "title": "Ichthian Battle Axe",
    "subtitle": "2H Great Axe · Tier 1",
    "cat": "weapon"
  },
  "da_weapon_2h_axe_unique_t1_harpe": {
    "title": "Harpe",
    "subtitle": "Unique 2H Great Axe",
    "cat": "weapon"
  },
  "da_weapon_2h_axe_unique_t1_megalos_lightning": {
    "title": "Megalos",
    "subtitle": "Unique 2H Great Axe · Lightning",
    "cat": "weapon"
  },
  "da_weapon_2h_axe_unique_t1_questreward_hippospine_poisoncold": {
    "title": "Hippospine",
    "subtitle": "Unique 2H Great Axe · Poison/Cold",
    "cat": "weapon"
  },
  "da_weapon_2h_axe_unique_t1_ragingbull_stun": {
    "title": "Raging Bull",
    "subtitle": "Unique 2H Great Axe · Stun",
    "cat": "weapon"
  },
  "da_weapon_2h_blunt_ornate_fire-strike_greek_t2": {
    "title": "Greek 2H Great Maul (Fire & Strike)",
    "subtitle": "Tier 2 2H Great Maul",
    "cat": "weapon"
  },
  "da_weapon_2h_blunt_unique_t1_dambreaker_strike": {
    "title": "Dambreaker",
    "subtitle": "Unique 2H Great Maul · Strike",
    "cat": "weapon"
  },
  "da_weapon_2h_blunt_unique_t1_funguslog_poison": {
    "title": "Funguslog",
    "subtitle": "Unique 2H Great Maul · Poison",
    "cat": "weapon"
  },
  "da_weapon_2h_blunt_unique_t2_crushstick": {
    "title": "Crushstick",
    "subtitle": "Unique 2H Great Maul · Strike",
    "cat": "weapon"
  },
  "da_weapon_2h_blunt_unique_t2_orionsmace_elemental": {
    "title": "Orion's Mace",
    "subtitle": "Unique 2H Great Maul · Elemental",
    "cat": "weapon"
  },
  "da_weapon_2h_bow_unique_t1_Barrage_speed": {
    "title": "Barrage",
    "subtitle": "Unique Bow · Attack Speed",
    "cat": "weapon"
  },
  "da_weapon_2h_bow_unique_t1_rambow_fire": {
    "title": "Rambow",
    "subtitle": "Unique Bow · Fire",
    "cat": "weapon"
  },
  "da_weapon_2h_bow_unique_t2_archofiris": {
    "title": "Arch of Iris",
    "subtitle": "Unique Bow · Prismatic",
    "cat": "weapon"
  },
  "da_weapon_2h_staff_magic_cold_ichthian_t1_MI": {
    "title": "Ichthian Magic Staff (Cold) (MI)",
    "subtitle": "Tier 1 Monster Infrequent Magic Staff",
    "cat": "weapon"
  },
  "da_weapon_2h_staff_magic_fire_greek_t1": {
    "title": "Greek Magic Staff (Fire)",
    "subtitle": "Tier 1 Magic Staff",
    "cat": "weapon"
  },
  "da_weapon_2h_staff_magic_lightning_greek_t1": {
    "title": "Greek Magic Staff (Lightning)",
    "subtitle": "Tier 1 Magic Staff",
    "cat": "weapon"
  },
  "da_weapon_2h_staff_magic_lightning_greek_t1_MI_undead": {
    "title": "Greek Magic Staff (Lightning) (MI)",
    "subtitle": "Tier 1 Monster Infrequent Magic Staff",
    "cat": "weapon"
  },
  "da_weapon_2h_staff_magic_poison_greek_t2": {
    "title": "Greek Magic Staff (Poison)",
    "subtitle": "Tier 2 Magic Staff",
    "cat": "weapon"
  },
  "da_weapon_2h_staff_magic_spirit_greek_t3": {
    "title": "Greek Magic Staff (Spirit)",
    "subtitle": "Tier 3 Magic Staff",
    "cat": "weapon"
  },
  "da_weapon_2h_staff_unique_t1_ilektrismos_lightning": {
    "title": "Ilektrismos",
    "subtitle": "Unique Lightning Staff",
    "cat": "weapon"
  },
  "da_weapon_2h_staff_unique_t1_telekinos_strike": {
    "title": "Telekinos",
    "subtitle": "Unique Staff · Strike",
    "cat": "weapon"
  },
  "da_weapon_2h_staff_unique_t1_thyrsus_poison": {
    "title": "Thyrsus",
    "subtitle": "Unique Staff · Poison",
    "cat": "weapon"
  },
  "da_weapon_2h_staff_unique_t2_chromaticstaff_elements": {
    "title": "Chromatic Staff",
    "subtitle": "Unique Staff · All Elements",
    "cat": "weapon"
  },
  "da_weapon_offhand_shield_heavy_greek_t2": {
    "title": "Greek Heavy Shield",
    "subtitle": "Tier 2 Heavy Shield",
    "cat": "armor"
  },
  "da_weapon_offhand_shield_heavy_ichthian_t1_MI": {
    "title": "Ichthian Heavy Shield (MI)",
    "subtitle": "Tier 1 Monster Infrequent Heavy Shield",
    "cat": "armor"
  },
  "da_weapon_offhand_shield_unique_t1_ceremonialbowl": {
    "title": "Ceremonial Bowl",
    "subtitle": "Unique Shield · Spell Ward",
    "cat": "armor"
  },
  "da_weapon_offhand_shield_unique_t1_thornwall": {
    "title": "Thornwall",
    "subtitle": "Unique Shield · Retaliation",
    "cat": "armor"
  },
  "da_weapon_offhand_talisman_cunning_greek_t1": {
    "title": "Greek Offhand Talisman",
    "subtitle": "Tier 1 Offhand Talisman",
    "cat": "armor"
  },
  "da_weapon_offhand_talisman_unique_t1_conchtalisman": {
    "title": "Conch Talisman",
    "subtitle": "Unique Talisman · Cold Res",
    "cat": "armor"
  },
  "da_weapon_offhand_talisman_unique_t1_crimsonviper": {
    "title": "Crimson Viper",
    "subtitle": "Unique Talisman · Bleed/Poison",
    "cat": "armor"
  },
  "da_weapon_offhand_talisman_unique_t1_mistletoe": {
    "title": "Mistletoe Talisman",
    "subtitle": "Unique Talisman · Health Regen",
    "cat": "armor"
  }
};

function humanizeTQ2Item(asset, pkg = '', rarity = '') {
  if (asset && typeof asset === 'object') {
    asset = (asset.handle && asset.handle.asset) || asset.asset || '';
  }
  if (!asset || typeof asset !== 'string') return { title: '(Unknown Item)', subtitle: '', cat: 'misc' };
  if (typeof CAT !== 'undefined' && CAT.names && CAT.names[asset]) {
    const meta = CAT.names[asset];
    const cat = meta.cat || (asset.includes('wp_') || asset.includes('weapon_') ? 'weapon' : (asset.includes('ar_') || asset.includes('armor_') || asset.includes('shield') ? 'armor' : (asset.includes('socket_') || asset.includes('item_') ? 'relic' : 'misc')));
    const sub = meta.flavor || (meta.cat ? meta.cat.charAt(0).toUpperCase() + meta.cat.slice(1) : '');
    return { title: meta.title, subtitle: sub, cat: cat };
  }
  if (KNOWN_ITEMS[asset]) return KNOWN_ITEMS[asset];

  let raw = asset.replace(/^da_/, '');

  if (raw === 'item_gold' || raw === 'gold' || raw.includes('currency_gold')) return { title: 'Gold', subtitle: 'Primary Currency', cat: 'currency' };
  if (raw.includes('currency_obol') || raw === 'obol') return { title: 'Obols', subtitle: 'Sacred Currency', cat: 'currency' };
  if (raw.includes('currency_tears') || raw === 'tears') return { title: 'Tears of the Gods', subtitle: 'Crafting Currency', cat: 'currency' };
  if (raw.includes('potion_health')) return { title: 'Health Potion', subtitle: 'Consumable', cat: 'currency' };
  if (raw.includes('potion_energy')) return { title: 'Energy Potion', subtitle: 'Consumable', cat: 'currency' };

  // Crafting Materials: da_item_mat_tier1_crude_fragments, da_item_mat_tiers_golden_spark
  const matMatch = raw.match(/^item_mat_(tier(\d+)|tiers)_([a-z0-9_]+)$/i);
  if (matMatch) {
    const tier = matMatch[2] ? 'Tier ' + matMatch[2] : (matMatch[1].toLowerCase() === 'tiers' ? 'Tier 5' : 'Crafting Material');
    const name = matMatch[3].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { title: name, subtitle: tier + ' Crafting Material', cat: 'currency' };
  }

  // Embers Components: da_item_embers_tier1_attribute_00
  const emberMatch = raw.match(/^item_embers_tier(\d+)_([a-z0-9_]+)$/i);
  if (emberMatch) {
    const tier = 'Tier ' + emberMatch[1];
    const kind = emberMatch[2].replace(/_\d+$/, '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { title: 'Embers of ' + kind, subtitle: tier + ' Relic Component', cat: 'relic' };
  }

  // Loot Caches: da_lootbox_embers_tier1_charm_normal_00
  const boxMatch = raw.match(/^lootbox_embers_tier(\d+)_([a-z0-9_]+)$/i);
  if (boxMatch) {
    const tier = 'Tier ' + boxMatch[1];
    const kind = boxMatch[2].replace(/_\d+$/, '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { title: kind + ' Cache', subtitle: tier + ' Loot Container', cat: 'relic' };
  }

  if (raw.includes('socket_relic_') || raw.startsWith('relic_')) {
    let n = raw.replace(/^socket_relic_/, '').replace(/^relic_/, '').replace(/_\d+$/, '');
    n = n.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { title: 'Relic of ' + n, subtitle: 'Socketable Relic', cat: 'relic' };
  }
  if (raw.includes('socket_charm_') || raw.startsWith('charm_')) {
    let n = raw.replace(/^socket_charm_/, '').replace(/^charm_/, '').replace(/_\d+$/, '');
    n = n.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { title: n + ' Charm', subtitle: 'Socketable Charm', cat: 'relic' };
  }

  if (raw.startsWith('quest_') || raw.includes('_s_ng_') || raw.includes('_nb_s_')) {
    let q = raw.replace(/^quest_\d+_?/, '').replace(/^[0-9]+_?[a-z]+_s_/, '').replace(/^ff_s_ng_/, '').replace(/^nb_s_/, '');
    q = q.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { title: q, subtitle: 'Quest Item', cat: 'currency' };
  }

  let gearType = 'Equipment', catType = 'armor';
  if (raw.includes('2h_axe')) { gearType = '2H Great Axe'; catType = 'weapon'; }
  else if (raw.includes('1h_axe')) { gearType = '1H War Axe'; catType = 'weapon'; }
  else if (raw.includes('2h_blunt') || raw.includes('2h_hammer') || raw.includes('2h_mace')) { gearType = '2H Great Maul'; catType = 'weapon'; }
  else if (raw.includes('1h_blunt') || raw.includes('1h_mace')) { gearType = '1H Mace'; catType = 'weapon'; }
  else if (raw.includes('2h_sword')) { gearType = '2H Greatsword'; catType = 'weapon'; }
  else if (raw.includes('1h_sword')) { gearType = '1H Sword'; catType = 'weapon'; }
  else if (raw.includes('spear')) { gearType = 'Spear'; catType = 'weapon'; }
  else if (raw.includes('staff')) { gearType = 'Staff'; catType = 'weapon'; }
  else if (raw.includes('bow')) { gearType = 'Bow'; catType = 'weapon'; }
  else if (raw.includes('shield')) { gearType = 'Shield'; catType = 'armor'; }
  else if (raw.includes('head') || raw.includes('helmet') || raw.includes('helm')) { gearType = 'Helm'; catType = 'armor'; }
  else if (raw.includes('shoulder') || raw.includes('pauldrons')) { gearType = 'Pauldrons'; catType = 'armor'; }
  else if (raw.includes('torso') || raw.includes('chest') || raw.includes('cuirass')) { gearType = 'Cuirass'; catType = 'armor'; }
  else if (raw.includes('arm') || raw.includes('bracer') || raw.includes('gloves') || raw.includes('vambraces')) { gearType = 'Vambraces'; catType = 'armor'; }
  else if (raw.includes('leg') || raw.includes('boot') || raw.includes('greaves')) { gearType = 'Greaves'; catType = 'armor'; }
  else if (raw.includes('jewelry_neck') || raw.includes('amulet') || raw.includes('necklace')) { gearType = 'Amulet'; catType = 'relic'; }
  else if (raw.includes('jewelry_ring') || raw.includes('ring')) { gearType = 'Ring'; catType = 'relic'; }

  let tier = '';
  const tm = raw.match(/_t(\d+)/i);
  if (tm) tier = 'Tier ' + tm[1];

  if (raw.includes('_unique_')) {
    let uPart = raw.split('_unique_')[1] || '';
    uPart = uPart.replace(/^t\d+_/, '');
    const tags = ['poison', 'stun', 'strike', 'physical', 'fire', 'cold', 'lightning', 'bleed', 'pierce', 'vitality', 'spirit', 'agility', 'knowledge'];
    const parts = uPart.split('_');
    let nameParts = [], traitParts = [];
    parts.forEach(p => {
      if (tags.includes(p.toLowerCase())) traitParts.push(p.charAt(0).toUpperCase() + p.slice(1));
      else nameParts.push(p.charAt(0).toUpperCase() + p.slice(1));
    });
    let name = nameParts.join(' ');
    if (name.toLowerCase() === 'archofiris') name = 'Arch of Iris';
    if (name.toLowerCase() === 'swordofdarkness') name = 'Sword of Darkness';
    if (name.toLowerCase() === 'soulcarver') name = 'Soulcarver';
    if (name.toLowerCase() === 'ragingbull') name = 'Raging Bull';
    if (name.toLowerCase() === 'dambreaker') name = 'Dambreaker';
    if (name.toLowerCase() === 'funguslog') name = 'Funguslog';
    if (name.toLowerCase() === 'ilektrismos') name = 'Ilektrismos';
    if (name.toLowerCase() === 'shiverblood') name = 'Shiverblood';
    if (name.toLowerCase() === 'thornwall') name = 'Thornwall';

    const sub = [tier, gearType, traitParts.length ? traitParts.join('/') : ''].filter(Boolean).join(' · ');
    return { title: name || 'Unique ' + gearType, subtitle: 'Unique ' + sub, cat: catType };
  }

  let name = raw.replace(/^(weapon|armor|jewelry|item)_/, '').replace(/_t\d+/, '').replace(/_0\d+/, '');
  name = name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const sub = [tier, gearType].filter(Boolean).join(' · ');
  return { title: name, subtitle: sub, cat: catType };
}

function getItemSlotType(asset) {
  if (!asset) return 'misc';
  const a = asset.toLowerCase();

  // Potions
  if (a.includes('potion_health') || a.includes('potion_energy') || a.includes('potion')) return 'potion';

  // Relics & Charms & Crafting
  if (a.includes('socket_relic') || a.includes('socket_charm') || a.includes('relic_') || a.includes('charm_') || a.includes('embers_') || a.includes('mat_')) return 'relic';

  // Currencies & Quest
  if (a.includes('item_gold') || a.includes('currency_') || a.includes('quest_') || a.includes('_s_ng_') || a.includes('_nb_s_') || a.includes('lootbox_')) return 'currency';

  // Jewelry
  if (a.includes('jewelry_neck') || a.includes('amulet') || a.includes('necklace') || a.includes('venomheart') || a.includes('crabtrinket')) return 'jewelry_neck';
  if (a.includes('jewelry_ring') || a.includes('ring') || a.includes('signet') || a.includes('coil')) return 'jewelry_ring';

  // Armor by Slot
  if (a.includes('armor_head') || a.includes('head_') || a.includes('helm') || a.includes('helmet')) return 'armor_head';
  if (a.includes('armor_shoulder') || a.includes('shoulder_') || a.includes('pauldrons')) return 'armor_shoulder';
  if (a.includes('armor_torso') || a.includes('torso_') || a.includes('cuirass') || a.includes('chest') || a.includes('robe')) return 'armor_torso';
  if (a.includes('armor_arm') || a.includes('arm_') || a.includes('vambraces') || a.includes('gloves') || a.includes('bracer')) return 'armor_arm';
  if (a.includes('armor_leg') || a.includes('leg_') || a.includes('greaves') || a.includes('boot')) return 'armor_leg';
  if (a.includes('shield')) return 'shield';

  // Weapons
  if (a.includes('weapon_2h_axe') || a.includes('axe2h') || a.includes('2h_axe')) return 'weapon_2h_axe';
  if (a.includes('weapon_1h_axe') || a.includes('axe1h') || a.includes('1h_axe')) return 'weapon_1h_axe';
  if (a.includes('weapon_2h_sword') || a.includes('sword2h') || a.includes('2h_sword')) return 'weapon_2h_sword';
  if (a.includes('weapon_1h_sword') || a.includes('sword1h') || a.includes('1h_sword')) return 'weapon_1h_sword';
  if (a.includes('weapon_2h_blunt') || a.includes('weapon_2h_mace') || a.includes('weapon_2h_hammer') || a.includes('blunt2h')) return 'weapon_2h_mace';
  if (a.includes('weapon_1h_blunt') || a.includes('weapon_1h_mace') || a.includes('blunt1h')) return 'weapon_1h_mace';
  if (a.includes('bow')) return 'weapon_bow';
  if (a.includes('staff')) return 'weapon_staff';
  if (a.includes('spear')) return 'weapon_spear';
  if (a.includes('dagger')) return 'weapon_dagger';
  if (a.includes('wp_') || a.includes('weapon_')) return 'weapon';

  return 'misc';
}

function getItemSlotLabel(slot) {
  const trans = t ? t('slots.' + slot) : null;
  if (trans && !trans.startsWith('slots.')) return trans;
  const map = {
    weapon: 'Vũ khí (Weapon)',
    weapon_1h_sword: 'Kiếm 1 tay (1H Sword)',
    weapon_2h_sword: 'Đại kiếm 2 tay (2H Greatsword)',
    weapon_1h_axe: 'Rìu 1 tay (1H Axe)',
    weapon_2h_axe: 'Rìu chiến 2 tay (2H Great Axe)',
    weapon_1h_mace: 'Chùy 1 tay (1H Mace)',
    weapon_2h_mace: 'Đại chùy 2 tay (2H Great Maul)',
    weapon_bow: 'Cung tên (Bow)',
    weapon_staff: 'Gậy phép / Trượng (Staff)',
    weapon_spear: 'Giáo mác (Spear)',
    weapon_dagger: 'Dao găm (Dagger)',
    armor_head: 'Mũ giáp / Giáp đầu (Helm)',
    armor_shoulder: 'Giáp vai (Pauldrons)',
    armor_torso: 'Áo giáp / Giáp ngực (Cuirass)',
    armor_arm: 'Găng tay / Giáp tay (Vambraces)',
    armor_leg: 'Giày / Giáp chân (Greaves)',
    shield: 'Khiên chắn (Shield)',
    jewelry_neck: 'Dây chuyền (Amulet)',
    jewelry_ring: 'Nhẫn (Ring)',
    potion: 'Dược phẩm (Potion)',
    relic: 'Ngọc / Phù hiệu (Relic / Charm)',
    currency: 'Nguyên liệu / Nhiệm vụ (Material / Quest)',
    misc: 'Khác (Misc)'
  };
  return map[slot] || slot;
}

function isWeaponSlot(slot) {
  return slot ? slot.startsWith('weapon') : false;
}

function isArmorSlot(slot) {
  return slot ? (slot.startsWith('armor') || slot === 'shield') : false;
}

function isJewelrySlot(slot) {
  return slot ? slot.startsWith('jewelry') : false;
}

function checkAffixSlotCompatibility(affixPath, slot) {
  if (!affixPath || !slot) return { compatible: true, reason: 'Universal' };
  const p = affixPath.toLowerCase();

  // Potion affixes
  const isPotionAffix = p.includes('/potions/') || p.includes('_potion_') || p.includes('chargesconsumed') || p.includes('perhealedinstantly') || p.includes('movespeedonpotion') || p.includes('ailmentchanceonuse');
  if (isPotionAffix) {
    if (slot === 'potion') return { compatible: true, reason: (t && t('compat.potion_valid')) || 'Dành riêng cho Dược phẩm (Potion Only)' };
    return { compatible: false, reason: (t && t('compat.potion_only')) || 'Dòng Potion chỉ dùng cho Bình Máu/Mana (bị game xoá trên trang bị)' };
  }
  if (slot === 'potion') {
    return { compatible: false, reason: (t && t('compat.potion_only')) || 'Bình Dược phẩm chỉ nhận các dòng Potion (da_prefix_1_Potion_* / da_suffix_1_Potion_*)' };
  }

  // Unique Modifiers
  if (p.includes('/unique/') || p.includes('_unique_') || p.includes('da_affix_1_unique')) {
    return { compatible: true, reason: 'Unique Affix' };
  }

  // Implicits
  if (p.includes('/implicits/') || p.includes('da_implicit_')) {
    if (p.includes('axe2h') && slot !== 'weapon_2h_axe') return { compatible: false, reason: 'Implicit affix specific to 2H Axes' };
    if (p.includes('sword') && !slot.includes('sword')) return { compatible: false, reason: 'Implicit affix specific to Swords' };
    if (p.includes('bow') && slot !== 'weapon_bow') return { compatible: false, reason: 'Implicit affix specific to Bows' };
    if (p.includes('staff') && slot !== 'weapon_staff') return { compatible: false, reason: 'Implicit affix specific to Staves' };
    if (p.includes('armor_') && !isArmorSlot(slot)) return { compatible: false, reason: 'Implicit affix specific to Armor / Shields' };
    return { compatible: true, reason: 'Implicit Base Affix' };
  }

  // Movement Speed
  if (p.includes('perincreasedmovementspeed') || p.includes('movespeed')) {
    if (slot === 'armor_leg' || slot === 'jewelry_neck') return { compatible: true, reason: (t && t('compat.movespeed_valid')) || 'Tốc độ chạy (Giày / Dây chuyền)' };
    return { compatible: false, reason: (t && t('compat.movespeed_slot')) || 'Tốc độ chạy chỉ xuất hiện trên Giày (Legs) và Dây chuyền (Amulet)' };
  }

  // Weapon Flat Damage
  const isWeaponFlatDmg = /da_(prefix|suffix)_\d+_(physical|fire|cold|lightning|poison|pierce|vitality|spirit|strike)dmg/i.test(affixPath);
  if (isWeaponFlatDmg) {
    if (isWeaponSlot(slot)) return { compatible: true, reason: 'Weapon Flat Damage' };
    return { compatible: false, reason: 'Weapon Flat Damage only works on Weapons (stripped on Armor/Jewelry)' };
  }

  // Flat Armor & Deflect & Retaliation
  if (p.includes('armorflat') || p.includes('flatarmor') || p.includes('retaliation') || p.includes('deflect')) {
    if (isArmorSlot(slot)) return { compatible: true, reason: (t && t('compat.armor_flat_valid')) || 'Giáp & Phòng thủ (Giáp / Khiên)' };
    return { compatible: false, reason: (t && t('compat.armor_flat_slot')) || 'Giáp cơ bản & Phản đòn chỉ hoạt động trên Giáp và Khiên' };
  }

  // Attack Speed
  if (p.includes('perincreasedattackspeed')) {
    if (isWeaponSlot(slot) || slot === 'armor_arm' || isJewelrySlot(slot)) return { compatible: true, reason: 'Attack Speed (Weapon / Arms / Jewelry)' };
    return { compatible: false, reason: 'Attack Speed is only allowed on Weapons, Arm Armor, and Jewelry' };
  }

  // Cast Speed
  if (p.includes('perincreasedcastspeed')) {
    if (slot === 'weapon_staff' || slot === 'armor_arm' || isJewelrySlot(slot)) return { compatible: true, reason: 'Cast Speed (Staff / Arms / Jewelry)' };
    return { compatible: false, reason: 'Cast Speed is only allowed on Staves, Arm Armor, and Jewelry' };
  }

  // Projectile Damage
  if (p.includes('perincreasedprojectiledmg')) {
    if (slot === 'weapon_bow' || isJewelrySlot(slot) || slot === 'armor_arm') return { compatible: true, reason: 'Projectile Damage (Bow / Arms / Jewelry)' };
    return { compatible: false, reason: 'Projectile Damage is only allowed on Bows, Arm Armor, and Jewelry' };
  }

  // Energy Barrier / Shielding
  if (p.includes('energybarrier')) {
    if (isArmorSlot(slot) || isJewelrySlot(slot)) return { compatible: true, reason: 'Energy Barrier (Armor / Jewelry)' };
    return { compatible: false, reason: 'Energy Barrier only applies to Armor and Jewelry' };
  }

  return { compatible: true, reason: 'Universal' };
}

function validateItemAffixes(it) {
  const asset = it.handle ? it.handle.asset : '';
  const slot = getItemSlotType(asset);
  const af = affixes(it);
  const issues = [];
  const warnings = [];

  if (!af || !af.items || af.items.length === 0) {
    return { issues, warnings, prefixes: 0, suffixes: 0, implicits: 0, total: 0, slot, isSafe: true };
  }

  let prefixes = 0;
  let suffixes = 0;
  let implicits = 0;
  const seenPaths = new Set();

  af.items.forEach((a, idx) => {
    const pf = affixField(a, 'pAffix');
    const path = pf ? pf.v : '';
    const cat = affixField(a, 'Category');
    const catStr = cat ? String(cat.v) : '';
    const kind = affixKind(path);
    const short = affixShortName(path);

    // Corrupt / Empty check
    if (!path || path === 'None') {
      issues.push({ idx, type: 'corrupt_affix', message: `Dòng rỗng hoặc "None" bị lỗi! Sẽ làm hỏng cấu trúc khiến game xoá sạch toàn bộ option của đồ.` });
      return;
    }

    // Duplicate check
    if (seenPaths.has(path)) {
      issues.push({ idx, type: 'duplicate', message: `Trùng lặp dòng: "${short}" được gắn nhiều lần. Game sẽ xoá bỏ dòng trùng khi vào game.` });
    }
    seenPaths.add(path);

    // Category Check
    if (kind === 'Prefix' || kind === 'Suffix') {
      if (kind === 'Prefix') prefixes++;
      if (kind === 'Suffix') suffixes++;
      if (catStr !== 'EGrimItemAffixCategory::Random') {
        warnings.push({ idx, type: 'category', message: `Category nên là "EGrimItemAffixCategory::Random" cho ${kind} (hiện tại là "${catStr.split('::').pop()}").` });
      }
    } else if (kind === 'Implicit') {
      implicits++;
      if (catStr === 'EGrimItemAffixCategory::Random') {
        warnings.push({ idx, type: 'category', message: `Dòng ẩn Implicit nên có Category là "Base" hoặc "Implicit", không phải "Random".` });
      }
    }

    // Slot Compatibility
    const compat = checkAffixSlotCompatibility(path, slot);
    if (!compat.compatible) {
      issues.push({ idx, type: 'slot_incompatible', message: `Xung đột vị trí đồ: ${compat.reason}` });
    }
  });

  // Unlimited Affixes: Game engine GrimVentory supports dynamic multi-affix arrays
  const isCustomMultiAffix = (prefixes > 2 || suffixes > 2);

  return {
    issues,
    warnings,
    prefixes,
    suffixes,
    implicits,
    total: af.items.length,
    slot,
    isCustomMultiAffix,
    isSafe: (issues.length === 0)
  };
}

function autoFixItemAffixes(it, getTierRangeFn) {
  const af = affixes(it);
  if (!af || !af.items) return { fixedCategories: 0, clampedTiers: 0, clampedScales: 0, removedCorrupt: 0 };
  let fixedCategories = 0, clampedTiers = 0, clampedScales = 0;
  const isUnique = it.handle && it.handle.asset && it.handle.asset.includes('_unique_');

  // Strip any corrupt None / empty affix nodes
  const origCount = af.items.length;
  af.items = af.items.filter(a => {
    const p = affixField(a, 'pAffix');
    return p && p.v && p.v !== 'None' && p.v !== '';
  });
  const removedCorrupt = origCount - af.items.length;

  af.items.forEach(a => {
    const pf = affixField(a, 'pAffix');
    const path = pf ? pf.v : '';
    const kind = affixKind(path);
    const cat = affixField(a, 'Category');

    // Fix category
    if (cat) {
      let targetCat = 'EGrimItemAffixCategory::Random';
      if (kind === 'Implicit') targetCat = 'EGrimItemAffixCategory::Base';
      else if (kind === 'Unique' || path.includes('/Unique/')) targetCat = 'EGrimItemAffixCategory::Unique';
      else if (isUnique) targetCat = 'EGrimItemAffixCategory::Implicit';

      if (cat.v !== targetCat) {
        cat.set(targetCat);
        fixedCategories++;
      }
    }

    // Fix level/tier
    const lvl = affixField(a, 'Level');
    const metaObj = (typeof CAT !== 'undefined' && CAT.names && CAT.names[path]) || {};
    const info = (typeof CAT !== 'undefined' && CAT.a && CAT.a[path]) || {};
    const maxLvl = (info.maxLevel !== undefined) ? info.maxLevel : (metaObj.maxLevel !== undefined ? metaObj.maxLevel : 10);
    if (lvl) {
      if (lvl.v > maxLvl) { lvl.set(maxLvl); clampedTiers++; }
      if (lvl.v < 0) { lvl.set(0); clampedTiers++; }
    }

    // Ensure all GameplayEffects have proper SoftObj asset name ending with _C
    affixEffects(a).forEach(e => {
      const geProp = e.body && e.body.get && e.body.get('pSoftGameplayEffect');
      if (geProp && geProp.value) {
        if (typeof G !== 'undefined' && geProp.value instanceof G.SoftObj) {
          if (!geProp.value.asset || geProp.value.asset === 'None' || geProp.value.asset === '(none)') {
            const base = geProp.value.pkg.split('/').pop().split('.')[0];
            geProp.value.asset = base + '_C';
            geProp.value.mark();
          }
        }
      }

      // Sanitize ScaleModifiers Map: remove corrupt/None/duplicate tag keys
      const smProp = e.body && e.body.get && e.body.get('ScaleModifiers');
      if (smProp && smProp.value && smProp.value instanceof G.MapV) {
        const seenTags = new Set();
        const validPairs = [];
        for (const [k, v] of smProp.value.pairs) {
          if (k instanceof G.Struct && k.body instanceof G.PropList) {
            const tn = k.body.get('TagName');
            const tagStr = tn && tn.value ? (tn.value.v || '') : '';
            if (tagStr && tagStr !== 'None' && tagStr !== '' && !seenTags.has(tagStr)) {
              seenTags.add(tagStr);
              // Ensure TagName prop is marked dirty if raw was empty
              if (tn && (!tn.raw || tn.raw.length === 0)) {
                tn.value.mark();
              }
              validPairs.push([k, v]);
            }
          }
        }
        smProp.value.pairs = validPairs;
        smProp.value.mark();
      }
    });

    // Only for single-effect tiered affixes without an explicit tier suffix, initialize tier
    const effsList = affixEffects(a);
    let maxTierFound = 0;
    effsList.forEach(e => {
      const geProp = e.body && e.body.get && e.body.get('pSoftGameplayEffect');
      const geStr = geProp && geProp.value ? (geProp.value.pkg || geProp.value.v || '') : '';
      const m = geStr.match(/_1_(?:ActiveCapacity|PassiveLevel)[A-Za-z]+T(\d+)$/);
      if (m) {
        maxTierFound = Math.max(maxTierFound, parseInt(m[1], 10));
      }
    });

    if (maxTierFound > 0 && lvl && lvl.v < (maxTierFound - 1)) {
      lvl.set(maxTierFound - 1);
    }

    if (effsList.length === 1 && (path.includes('ActiveCapacity') || path.includes('PassiveLevel'))) {
      const e = effsList[0];
      const geProp = e.body && e.body.get && e.body.get('pSoftGameplayEffect');
      if (geProp && geProp.value) {
        let curGePath = geProp.value.pkg || geProp.value.v || '';
        if (curGePath.match(/_1_(ActiveCapacity|PassiveLevel)[A-Za-z]+$/) && !curGePath.endsWith('Core')) {
          const curLvl = lvl ? lvl.v : 0;
          const tNum = curLvl + 1;
          const newGePath = curGePath + 'T' + tNum;
          const newGeAsset = newGePath.split('/').pop() + '_C';
          if (typeof geProp.value === 'object' && geProp.value.pkg !== undefined) {
            geProp.value.pkg = newGePath;
            geProp.value.asset = newGeAsset;
            if (typeof geProp.value.mark === 'function') geProp.value.mark();
          } else if (typeof geProp.value.set === 'function') {
            geProp.value.set(newGePath);
          }
        }
      }
    }
  });

  af.mark();
  return { fixedCategories, clampedTiers, clampedScales };
}

function friendlyItemName(asset) {
  return humanizeTQ2Item(asset).title;
}

function itemName(item) {
  return humanizeTQ2Item(item.handle.asset).title;
}

function sgds(save) {
  const out = {};
  const walk = v => {
    if (!v) return;
    if (v instanceof G.SGD) { out[v.name] = v; return walk(v.body); }
    if (v instanceof G.Struct) return walk(v.body);
    if (v instanceof G.PropList) { for (const p of v.props) walk(p.value); return; }
    if (v instanceof G.Arr) { for (const x of v.items) walk(x); return; }
  };
  walk(save.root);
  return out;
}

function charSections(save) {
  const s = sgds(save), out = [];
  const at = s.TQ2CharacterAttributes;
  if (at && at.body instanceof G.PropList) out.push({ key: 'attr', label: (t && t('char.sec_attr')) || 'Attributes & Core Stats', node: at.body });
  const ma = s.Mastery;
  if (ma && ma.body instanceof G.PropList) {
    const m = ma.body.get('m_Masteries');
    if (m && m.value.body instanceof G.PropList) out.push({ key: 'mastery', label: (t && t('char.sec_mastery')) || 'Masteries & Skill Trees', node: m.value.body });
  }
  const cur = earnedCurrencies(save);
  if (cur && cur.entries.length) out.push({ key: 'currency', label: (t && t('char.sec_currency')) || 'Currencies (Gold, Obols, Tears)', node: cur });
  const st = s.MetaStats;
  if (st && st.body instanceof G.PropList) out.push({ key: 'meta', label: (t && t('char.sec_stats')) || 'Gameplay Statistics & Progress', node: st.body });
  return out;
}

function readTags(raw) {
  try {
    const r = new G.Reader(raw);
    const n = r.i32();
    if (n < 0 || n > 512) return [];
    const out = [];
    for (let i = 0; i < n; i++) out.push(r.str());
    return out;
  } catch (e) { return []; }
}

function cleanAbilityName(raw) {
  if (!raw) return 'Ability';
  let s = raw.replace(/^bp_(selector|bga|bge|ge)_/, '').replace(/^player_/, '')
             .replace(/^(st|ea|wa|hu|ne|de|ro|sp|core|generic|fo)_/, '')
             .replace(/_p$/, '').replace(/^passive_/, '').replace(/^fos+passives+/i, '').replace(/^fos+/i, '');
  s = s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/_/g, ' ');
  s = s.replace(/\bFortifiedarmor\b/i, 'Fortified Armor')
       .replace(/\bArmorspikes\b/i, 'Armor Spikes')
       .replace(/\bBladeTrap\b/i, 'Blade Trap')
       .replace(/\bForceField\b/i, 'Force Field')
       .replace(/\bDeathchillAura\b/i, 'Deathchill Aura')
       .replace(/\bDeathwardBeam\b/i, 'Deathward Beam')
       .replace(/\bEidolonGuard\b/i, 'Eidolon Guard')
       .replace(/\bChthonicPulse\b/i, 'Chthonic Pulse')
       .replace(/\bSoulVortex\b/i, 'Soul Vortex')
       .replace(/\bDarkPact\b/i, 'Dark Pact')
       .replace(/\bSpectralBolt\b/i, 'Spectral Bolt')
       .replace(/\bSpectralArc\b/i, 'Spectral Arc')
       .replace(/\bDeathNova\b/i, 'Death Nova')
       .replace(/\bShadowForce\b/i, 'Shadow Force')
       .replace(/\bUmbralRites\b/i, 'Umbral Rites')
       .replace(/\bArtifactsOfTheUnderworld\b/i, 'Artifacts of the Underworld')
       .replace(/\bNetherCurrent\b/i, 'Nether Current')
       .replace(/\bOtherworldlyArmy\b/i, 'Otherworldly Army')
       .replace(/\bEphemeralRites\b/i, 'Ephemeral Rites')
       .replace(/\bWitheringTouch\b/i, 'Withering Touch')
       .replace(/\bSpiritConduit\b/i, 'Spirit Conduit')
       .replace(/\bEnervatingCurrent\b/i, 'Enervating Current')
       .replace(/\bLayeredVeil\b/i, 'Layered Veil')
       .replace(/\bUndyingHost\b/i, 'Undying Host')
       .replace(/\bDeathsDoor\b/i, "Death's Door")
       .replace(/\bUnrelentingHorde\b/i, 'Unrelenting Horde')
       .replace(/\bStolenBreath\b/i, 'Stolen Breath')
       .replace(/\bTollOfPassage\b/i, 'Toll of Passage')
       .replace(/\bFrozenLament\b/i, 'Frozen Lament')
       .replace(/\bIchorSurge\b/i, 'Ichor Surge')
       .replace(/\bEchoingWard\b/i, 'Echoing Ward')
       .replace(/\bBitterMalice\b/i, 'Bitter Malice')
       .replace(/\bUnlivingDomain\b/i, 'Unliving Domain')
       .replace(/\bFoulMiasma\b/i, 'Foul Miasma')
       .replace(/\bEtherealReach\b/i, 'Ethereal Reach');
  return s.trim();
}

function abilityName(entry) {
  for (const key of ['AbilityDescriptionTags', 'PassiveEffectTags']) {
    const p = entry.body && entry.body.get ? entry.body.get(key) : null;
    if (p && p.value && p.value.body && p.value.body.b) {
      const tags = readTags(p.value.body.b);
      if (tags.length) {
        let n = String(tags[0]).split('.').pop();
        return cleanAbilityName(n);
      }
    }
  }
  return '(Unnamed Ability)';
}

function masteryName(ms) {
  const d = ms.body && ms.body.get ? ms.body.get('pMasteryDescription') : null;
  if (d && d.value && d.value.body && d.value.body.b) {
    try {
      const r = new G.Reader(d.value.body.b); r.str();
      const n = r.str().replace(/^da_mastery_/, '');
      return n.charAt(0).toUpperCase() + n.slice(1);
    }
    catch (e) { /* ignore */ }
  }
  return 'Mastery';
}

function findProp(save, name) {
  let found = null;
  const walk = v => {
    if (found || !v) return;
    if (v instanceof G.PropList) {
      for (const p of v.props) { if (p.name === name) { found = p; return; } walk(p.value); }
      return;
    }
    if (v instanceof G.Struct || v instanceof G.SGD) return walk(v.body);
    if (v instanceof G.Handle) { for (const [, pl] of v.insts) walk(pl); return; }
    if (v instanceof G.Arr) { for (const x of v.items) walk(x); return; }
    if (v instanceof G.MapV) { for (const [, val] of v.pairs) walk(val); return; }
  };
  walk(save.root);
  return found;
}

function earnedCurrencies(save) {
  const prop = findProp(save, 'm_TotalEarnedCurrencies');
  if (!prop || !(prop.value instanceof G.Raw) || prop.value.b.length < 8) return null;
  const raw = prop.value.b;
  const r = new G.Reader(raw);
  const entries = [];
  try {
    r.i32();
    const n = r.i32();
    for (let i = 0; i < n; i++) {
      const pkg = r.str(), asset = r.str();
      r.i32();
      const off = r.o, value = r.i32();
      entries.push({ pkg, asset, value, off });
    }
  } catch (e) { return null; }
  return { prop, entries };
}

function setEarned(cur, entry, value) {
  const b = new Uint8Array(cur.prop.value.b);
  new DataView(b.buffer).setInt32(entry.off, value, true);
  cur.prop.value.b = b;
  cur.prop.value.mark();
  entry.value = value;
}

function containerInfos(save) {
  const out = [];
  collectContainers(save).forEach((e, i) => {
    const body = e.c.body;
    if (!body || !body.get) return;
    const ib = body.get('ItemsBySlot');
    const ns = body.get('NumSlots');
    if (!ib || !(ib.value instanceof G.MapV)) return;
    out.push({
      label: containerLabel(e.path, i),
      map: ib.value,
      numSlots: ns && ns.value instanceof G.Scalar ? ns.value.v : 0,
      used: ib.value.pairs.length,
    });
  });
  return out;
}

function freeSlot(info) {
  const used = new Set(info.map.pairs.map(([k]) => (k instanceof G.Scalar ? k.v : -1)));
  for (let i = 0; i < Math.max(info.numSlots, 1); i++) if (!used.has(i)) return i;
  return -1;
}

function cloneSlot(slotStruct) {
  const w = new G.W();
  slotStruct.ser(w);
  const bytes = w.done();
  const tn = new G.TN('StructProperty', [new G.TN('GrimItemSlot')]);
  const node = G.readSized(new G.Reader(bytes), tn, { errors: [] });
  node.mark();
  return node;
}

function randomGuid() {
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = (i * 37 + 11) & 0xff;
  return b;
}

function copyItemTo(slotStruct, info) {
  const slot = freeSlot(info);
  if (slot < 0) return -1;
  const node = cloneSlot(slotStruct);
  const hp = node.get && node.get('ItemHandle');
  if (hp && hp.value instanceof G.Handle) {
    const g = hp.value.get('m_InstanceGuid');
    if (g && g.value instanceof G.Struct && g.value.body instanceof G.Raw) {
      g.value.body = new G.Raw(randomGuid());
      g.value.mark();
    }
  }
  info.map.pairs.push([new G.Scalar('i32', slot), node]);
  info.map.mark();
  return slot;
}

function ensureIntProp(pl, name, value) {
  if (!(pl instanceof G.PropList)) return null;
  const found = pl.get(name);
  if (found) return found;
  const val = new G.Scalar('i32', value || 0);
  val.mark();
  const p = new G.Prop(name, new G.TN('IntProperty'), 0, 0, null, val, new Uint8Array(0));
  pl.props.push(p);
  pl.mark();
  return p;
}

const ATTR_FIELDS = ['m_CharacterLevel', 'm_CharacterAP', 'm_AttributePointsMight',
  'm_AttributePointsAgility', 'm_AttributePointsKnowledge', 'm_AttributePointsVigor'];
const POINT_FIELDS = ['ActivePoints', 'PassivePoints', 'MasteryPoints'];

function ensureAttrFields(pl) { for (const n of ATTR_FIELDS) ensureIntProp(pl, n, 0); }
function ensurePointFields(pl) { for (const n of POINT_FIELDS) ensureIntProp(pl, n, 0); }
function createEffectScalingModifierTag(tagName = 'GrimVentory.EffectScalingModifier.Decimal') {
  const pTagVal = new G.Scalar('name', tagName);
  pTagVal.mark();
  const pTag = new G.Prop('TagName', new G.TN('NameProperty'), 0, 0, null, pTagVal, new Uint8Array(0));
  pTag.value.mark();
  const pl = new G.PropList([pTag]);
  pl.mark();
  const st = new G.Struct('GrimEffectScalingModifierTag', pl);
  st.mark();
  return st;
}

function getEffectScale(effNode) {
  if (!effNode || !effNode.body) return 1;
  const smProp = effNode.body.get('ScaleModifiers');
  if (smProp && smProp.value instanceof G.MapV) {
    for (const [k, v] of smProp.value.pairs) {
      if (k instanceof G.Struct && k.body instanceof G.PropList) {
        const tn = k.body.get('TagName');
        if (tn && tn.value && (tn.value.v === 'GrimVentory.EffectScalingModifier.Decimal' || tn.value.pkg === 'GrimVentory.EffectScalingModifier.Decimal')) {
          return v.v;
        }
      }
    }
  }
  const scProp = effNode.body.get('Scale');
  return (scProp && scProp.value) ? scProp.value.v : 1;
}

function setEffectScale(effNode, val, forceDecimal = null) {
  if (!effNode || !effNode.body) return;
  const numVal = parseFloat(val) || 0;

  const scProp = effNode.body.get('Scale');
  if (scProp && scProp.value) {
    scProp.value.set(numVal);
  }

  const smProp = effNode.body.get('ScaleModifiers');
  const isDecimal = forceDecimal !== null ? forceDecimal : (
    !Number.isInteger(numVal) ||
    (smProp && smProp.value instanceof G.MapV && smProp.value.pairs.some(([k]) => {
      const tn = k.body && k.body.get ? k.body.get('TagName') : null;
      const tagStr = tn && tn.value ? (tn.value.v || tn.value.pkg || '') : '';
      return tagStr === 'GrimVentory.EffectScalingModifier.Decimal';
    }))
  );

  if (smProp && smProp.value instanceof G.MapV) {
    // Filter out invalid/corrupt pairs
    const seenTags = new Set();
    const cleanPairs = [];
    for (const [k, v] of smProp.value.pairs) {
      if (k instanceof G.Struct && k.body instanceof G.PropList) {
        const tn = k.body.get('TagName');
        const tagStr = tn && tn.value ? (tn.value.v || tn.value.pkg || '') : '';
        if (tagStr && tagStr !== 'None' && tagStr !== '' && !seenTags.has(tagStr)) {
          seenTags.add(tagStr);
          cleanPairs.push([k, v]);
        }
      }
    }
    smProp.value.pairs = cleanPairs;

    let found = false;
    for (const [k, v] of smProp.value.pairs) {
      if (k instanceof G.Struct && k.body instanceof G.PropList) {
        const tn = k.body.get('TagName');
        const tagStr = tn && tn.value ? (tn.value.v || tn.value.pkg || '') : '';
        if (tagStr === 'GrimVentory.EffectScalingModifier.Decimal') {
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
    }
    smProp.value.mark();
  }
  effNode.mark();
}

function hasCraftingHistory(item) {
  if (!item || !item.props || !item.props.props) return false;
  return item.props.props.some(p => p.name === 'm_CraftingHistory' || p.name === 'm_Modifications');
}

function resetCraftingHistory(item) {
  if (!item || !item.props || !item.props.props) return false;
  const initialLen = item.props.props.length;
  item.props.props = item.props.props.filter(p => p.name !== 'm_CraftingHistory' && p.name !== 'm_Modifications');
  if (item.props.props.length !== initialLen) {
    item.props.mark();
    if (item.handle && typeof item.handle.mark === 'function') item.handle.mark();
    return true;
  }
  return false;
}

function resetAllCraftingHistory(files, markFileDirtyFn) {
  if (!files || !Array.isArray(files)) return 0;
  let totalReset = 0;
  files.forEach((f, fi) => {
    if (!f || !f.items) return;
    let fileModified = false;
    f.items.forEach(it => {
      if (resetCraftingHistory(it)) {
        totalReset++;
        fileModified = true;
      }
    });
    if (fileModified && typeof markFileDirtyFn === 'function') {
      markFileDirtyFn(fi);
    }
  });
  return totalReset;
}

const API = { ensureIntProp, ensureAttrFields, ensurePointFields, ATTR_FIELDS, POINT_FIELDS, earnedCurrencies, setEarned, containerInfos, freeSlot, copyItemTo, findProp, sgds, charSections, readTags, cleanAbilityName, abilityName, masteryName, collectContainers, listItems, prop, pval, affixes, affixField, affixEffects,
  createEffectScalingModifierTag, getEffectScale, setEffectScale,
  setBaseItem, parseUnrealAssetPath, affixShortName, affixKind, affixMeta, affixLocalizedName, affixTierTitle, affixTooltip, humanizeEffectName, friendlyItemName, itemName, humanizeTQ2Item, containerLabel,
  getItemSlotType, getItemSlotLabel, isWeaponSlot, isArmorSlot, isJewelrySlot, checkAffixSlotCompatibility, validateItemAffixes, autoFixItemAffixes,
  hasCraftingHistory, resetCraftingHistory, resetAllCraftingHistory };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.TQ2 = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
