/* Demo dataset generator */
(function (root) {
'use strict';
const G = root.GVAS, T = root.TQ2;

function markAll(v) {
  if (!v) return v;
  if (v.mark) v.mark();
  if (v instanceof G.PropList) { for (const prop of v.props) markAll(prop.value); }
  if (v instanceof G.Struct || v instanceof G.SGD) markAll(v.body);
  if (v instanceof G.Handle) { for (const [, pl] of v.insts) markAll(pl); }
  if (v instanceof G.Arr) { for (const item of v.items) markAll(item); }
  if (v instanceof G.MapV) { for (const [k, val] of v.pairs) { markAll(k); markAll(val); } }
  return v;
}

function p(name, type, val) {
  let sc;
  if (type === 'i32') sc = new G.Scalar('i32', val);
  else if (type === 'f32') sc = new G.Scalar('f32', val);
  else if (type === 'str') sc = new G.Scalar('str', val);
  else if (type === 'name') sc = new G.Scalar('name', val);
  else if (type === 'enum') sc = new G.Scalar('enum', val);
  else sc = val;
  sc.mark();
  const tn = new G.TN(type === 'i32' ? 'IntProperty' : (type === 'f32' ? 'FloatProperty' : (type === 'str' ? 'StrProperty' : (type === 'enum' ? 'EnumProperty' : 'StructProperty'))));
  return new G.Prop(name, tn, 0, 0, null, sc, new Uint8Array(0));
}

function makeHeader(klass = '/Script/TQ2.TQ2PlayerSaveGame') {
  const hw = new G.W();
  hw.raw(new Uint8Array([0x47, 0x56, 0x41, 0x53]));
  hw.i32(3); hw.i32(0); hw.i32(0);
  hw.raw(new Uint8Array(6)); hw.u32(0);
  hw.str('++UE5+Release-5.5');
  hw.i32(0); hw.i32(0);
  hw.str(klass);
  return hw.done();
}

function makeAffixFromCat(CAT, key, category = null, level = 1, scale = 1.0) {
  const info = CAT.a[key];
  if (!info) return null;
  const rawBytes = info.tb || (info.t ? Uint8Array.from(atob(info.t), c => c.charCodeAt(0)) : null);
  if (!rawBytes) return null;
  const node = G.parseAffixTemplate(rawBytes);
  if (category) {
    const catProp = T.affixField(node, 'Category');
    if (catProp) catProp.set('EGrimItemAffixCategory::' + category);
  }
  const lvlProp = T.affixField(node, 'Level');
  if (lvlProp) lvlProp.set(level);
  const scProp = T.affixField(node, 'Scale');
  if (scProp) scProp.set(scale);
  markAll(node);
  return node;
}

function makeItem(CAT, pkg, asset, rarity, level, affixesList = [], stack = 1, extraStats = {}) {
  const itemProps = [
    p('m_Rarity', 'enum', 'EGrimItemRarity::' + rarity),
    p('m_Level', 'i32', level),
    p('m_PowerLevel', 'i32', level * 10),
    p('m_RequiredLevel', 'i32', Math.max(1, level - 2)),
    p('m_DamageMin', 'f32', extraStats.damageMin || (80.0 + level * 4)),
    p('m_DamageMax', 'f32', extraStats.damageMax || (120.0 + level * 6)),
    p('m_Armor', 'f32', extraStats.armor || (100.0 + level * 5)),
  ];

  if (affixesList.length > 0) {
    const affixItems = [];
    for (const a of affixesList) {
      const node = typeof a === 'string' ? makeAffixFromCat(CAT, a) : makeAffixFromCat(CAT, a.key, a.category, a.level, a.scale);
      if (node) affixItems.push(node);
    }
    if (affixItems.length > 0) {
      const arrVal = new G.Arr(new G.TN('StructProperty', [new G.TN('GrimItemAffixInstance')]), affixItems);
      arrVal.mark();
      const arrProp = new G.Prop('m_Affixes', new G.TN('ArrayProperty', [new G.TN('StructProperty', [new G.TN('GrimItemAffixInstance')])]), 0, 0, null, arrVal, new Uint8Array(0));
      itemProps.push(arrProp);
    }
  }

  const pl = new G.PropList(itemProps);
  pl.mark();
  const handle = new G.Handle('GrimItemInstanceHandle', pkg, asset, '', [[0, pl, 0]], 0);
  handle.mark();
  const slotProps = [
    new G.Prop('ItemHandle', new G.TN('StructProperty', [new G.TN('GrimItemInstanceHandle')]), 0, 0, null, handle, new Uint8Array(0)),
    p('Num', 'i32', stack)
  ];
  const slot = new G.Struct('GrimItemSlot', new G.PropList(slotProps));
  slot.mark();
  return slot;
}

function createContainerStruct(numSlots, itemsBySlot) {
  const pairs = [];
  itemsBySlot.forEach((item, slotIdx) => {
    const k = new G.Scalar('i32', slotIdx);
    k.mark();
    pairs.push([k, item]);
  });
  const mapV = new G.MapV(0, pairs);
  mapV.mark();
  const mapProp = new G.Prop('ItemsBySlot', new G.TN('MapProperty', [new G.TN('IntProperty'), new G.TN('StructProperty', [new G.TN('GrimItemSlot')])]), 0, 0, null, mapV, new Uint8Array(0));
  const numProp = p('NumSlots', 'i32', numSlots);
  const cPl = new G.PropList([numProp, mapProp]);
  cPl.mark();
  const st = new G.Struct('GrimItemContainerSaveData', cPl);
  st.mark();
  return st;
}

function createDemoPlayerSave(CAT) {
  const keys = Object.keys(CAT.a || {});
  const equipItems = [
    makeItem(CAT, '/JsonData/TQ2/Items/2h_axe_light_physical/da_weapon_2h_axe_unique_t1_harpe', 'da_weapon_2h_axe_unique_t1_harpe', 'Epic', 28, [
      keys[0] || '/Game/TQ2/Items/Affixes/Implicits/Weapon/Axe2H/da_implicit_axe2h_Greek3Glaive_Light.da_implicit_axe2h_Greek3Glaive_Light',
      keys[2] || '/Game/TQ2/Items/Affixes/Prefixes/da_prefix_1_PerIncreasedPierceDmg.da_prefix_1_PerIncreasedPierceDmg',
      keys[3] || '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_PerIncreasedAttackSpeed.da_suffix_1_PerIncreasedAttackSpeed'
    ], 1, { damageMin: 145, damageMax: 210 }),
    makeItem(CAT, '/JsonData/TQ2/Items/armor_chest_heavy/da_armor_torso_greek_knight', 'da_armor_torso_greek_knight', 'Rare', 27, [
      keys[1] || '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_FlatCritChance.da_suffix_1_FlatCritChance'
    ], 1, { armor: 320 }),
    makeItem(CAT, '/JsonData/TQ2/Items/armor_head_heavy/da_armor_head_ichthian_fighter', 'da_armor_head_ichthian_fighter', 'Rare', 26, [], 1, { armor: 195 }),
    makeItem(CAT, '/JsonData/TQ2/Items/charm/da_socket_charm_boarhide1_01', 'da_socket_charm_boarhide1_01', 'Infrequent', 25, [], 1),
    makeItem(CAT, '/JsonData/TQ2/Items/relic/da_socket_relic_hermes_01', 'da_socket_relic_hermes_01', 'Epic', 28, [], 1)
  ];

  const invItems = [
    makeItem(CAT, '/JsonData/TQ2/Items/weapon_2h_blunt/da_weapon_2h_blunt_unique_t1_funguslog_poison', 'da_weapon_2h_blunt_unique_t1_funguslog_poison', 'Epic', 28, [], 1, { damageMin: 155, damageMax: 225 }),
    makeItem(CAT, '/JsonData/TQ2/Items/relic/da_socket_relic_theseus_01', 'da_socket_relic_theseus_01', 'Epic', 28, [], 1),
    makeItem(CAT, '/JsonData/TQ2/Items/relic/da_socket_relic_apollo_01', 'da_socket_relic_apollo_01', 'Epic', 28, [], 1),
    makeItem(CAT, '/JsonData/TQ2/Items/charm/da_socket_charm_turtleshell_01', 'da_socket_charm_turtleshell_01', 'Magic', 20, [], 3),
    makeItem(CAT, '/JsonData/TQ2/Items/quest/da_quest_01_ff_s_ng_moly', 'da_quest_01_ff_s_ng_moly', 'Magic', 1, [], 1),
  ];

  const equipContainer = createContainerStruct(12, equipItems);
  const invContainer = createContainerStruct(40, invItems);

  const curW = new G.W();
  curW.i32(0); curW.i32(3);
  curW.str('/JsonData/TQ2/Currencies/da_item_currency_gold'); curW.str('da_item_currency_gold'); curW.i32(0); curW.i32(125000);
  curW.str('/JsonData/TQ2/Currencies/da_item_currency_obol'); curW.str('da_item_currency_obol'); curW.i32(0); curW.i32(350);
  curW.str('/JsonData/TQ2/Currencies/da_item_currency_tears'); curW.str('da_item_currency_tears'); curW.i32(0); curW.i32(45);

  const curRaw = new G.Raw(curW.done());
  curRaw.mark();
  const curProp = new G.Prop('m_TotalEarnedCurrencies', new G.TN('MapProperty', [new G.TN('StructProperty', [new G.TN('TQ2ItemDescriptionSoftPtr')]), new G.TN('IntProperty')]), 0, 0, null, curRaw, new Uint8Array(0));

  const attrProps = [
    p('m_CharacterLevel', 'i32', 28),
    p('m_CurrentLevelProgress', 'f32', 0.72),
    p('m_CharacterAP', 'i32', 8),
    p('m_AttributePointsMight', 'i32', 45),
    p('m_AttributePointsAgility', 'i32', 35),
    p('m_AttributePointsKnowledge', 'i32', 15),
    p('m_AttributePointsVigor', 'i32', 60),
  ];
  const attrSGD = new G.SGD('TQ2CharacterAttributes', 'UTQ2CharacterAttributesSaveGameData', 0, new G.PropList(attrProps));
  attrSGD.mark();

  const metaProps = [
    p('m_KillCounter', 'i32', 2150),
    p('m_DeathCounter', 'i32', 4),
    p('m_TotalPlayTimeSeconds', 'i32', 64800),
    p('m_TotalPlaytimeAtLastDeath', 'i32', 41200)
  ];
  const metaSGD = new G.SGD('MetaStats', 'UTQ2MetaStatsSaveGameData', 0, new G.PropList(metaProps));
  metaSGD.mark();

  const rootProps = [
    new G.Prop('m_Equipment', new G.TN('StructProperty', [new G.TN('GrimItemContainerSaveData')]), 0, 0, null, equipContainer, new Uint8Array(0)),
    new G.Prop('m_Inventories', new G.TN('StructProperty', [new G.TN('GrimItemContainerSaveData')]), 0, 0, null, invContainer, new Uint8Array(0)),
    curProp,
    new G.Prop('TQ2CharacterAttributes', new G.TN('StructProperty', [new G.TN('SaveGameData')]), 0, 0, null, attrSGD, new Uint8Array(0)),
    new G.Prop('MetaStats', new G.TN('StructProperty', [new G.TN('SaveGameData')]), 0, 0, null, metaSGD, new Uint8Array(0)),
  ];

  const rootPl = new G.PropList(rootProps);
  markAll(rootPl);

  return {
    header: makeHeader('/Script/TQ2.TQ2PlayerSaveGame'),
    extra: 0,
    root: rootPl,
    trailer: new Uint8Array(0),
    klass: '/Script/TQ2.TQ2PlayerSaveGame',
    branch: '++UE5+Release-5.5',
    saveVer: 3
  };
}

function makeTagBuffer(tagList) {
  const tw = new G.W();
  tw.i32(tagList.length);
  for (const t of tagList) tw.str(t);
  const raw = new G.Raw(tw.done());
  raw.mark();
  return raw;
}

function makeAbility(nameTag, rank, modSlots = [], featSlots = []) {
  const props = [
    p('InvestedPoints', 'i32', rank),
    new G.Prop('AbilityDescriptionTags', new G.TN('StructProperty', [new G.TN('GameplayTagContainer')]), 0, 0, null, new G.Struct('GameplayTagContainer', makeTagBuffer([nameTag])), new Uint8Array(0))
  ];

  if (modSlots.length > 0) {
    const slotStructs = modSlots.map(m => {
      const sProps = [
        p('ModifierClass', 'name', m.cls || 'None'),
        p('Level', 'i32', m.level || -1)
      ];
      const sPl = new G.PropList(sProps);
      sPl.mark();
      const st = new G.Struct('TQ2AbilityModifierSlot', sPl);
      st.mark();
      return st;
    });
    const arr = new G.Arr(new G.TN('StructProperty', [new G.TN('TQ2AbilityModifierSlot')]), slotStructs);
    arr.mark();
    props.push(new G.Prop('ModifierSlots', new G.TN('ArrayProperty', [new G.TN('StructProperty', [new G.TN('TQ2AbilityModifierSlot')])]), 0, 0, null, arr, new Uint8Array(0)));
  }

  if (featSlots.length > 0) {
    const fScalars = featSlots.map(f => {
      const sc = new G.Scalar('name', f || 'None');
      sc.mark();
      return sc;
    });
    const arr = new G.Arr(new G.TN('NameProperty'), fScalars);
    arr.mark();
    props.push(new G.Prop('FeatSlots', new G.TN('ArrayProperty', [new G.TN('NameProperty')]), 0, 0, null, arr, new Uint8Array(0)));
  }

  const pl = new G.PropList(props);
  pl.mark();
  const st = new G.Struct('TQ2AbilityInstance', pl);
  st.mark();
  return st;
}

function makeMastery(masteryNameTag, activeAbilities = [], passiveAbilities = []) {
  const descW = new G.W();
  descW.str('/JsonData/TQ2/Masteries/da_mastery_' + masteryNameTag);
  descW.str('da_mastery_' + masteryNameTag);
  const descRaw = new G.Raw(descW.done());
  descRaw.mark();

  const actArr = new G.Arr(new G.TN('StructProperty', [new G.TN('TQ2AbilityInstance')]), activeAbilities);
  actArr.mark();
  const passArr = new G.Arr(new G.TN('StructProperty', [new G.TN('TQ2AbilityInstance')]), passiveAbilities);
  passArr.mark();

  const mProps = [
    p('InvestedMasteryPoints', 'i32', 24),
    new G.Prop('pMasteryDescription', new G.TN('StructProperty', [new G.TN('TQ2MasteryDescriptionSoftPtr')]), 0, 0, null, new G.Struct('TQ2MasteryDescriptionSoftPtr', descRaw), new Uint8Array(0)),
    new G.Prop('ActiveAbilities', new G.TN('ArrayProperty', [new G.TN('StructProperty', [new G.TN('TQ2AbilityInstance')])]), 0, 0, null, actArr, new Uint8Array(0)),
    new G.Prop('PassiveAbilities', new G.TN('ArrayProperty', [new G.TN('StructProperty', [new G.TN('TQ2AbilityInstance')])]), 0, 0, null, passArr, new Uint8Array(0)),
  ];
  const pl = new G.PropList(mProps);
  pl.mark();
  const st = new G.Struct('TQ2MasteryInstance', pl);
  st.mark();
  return st;
}

function createDemoPlayerLocalSave(CAT) {
  const modKeys = Object.keys(CAT.m || {});
  const featKeys = Object.keys(CAT.f || {});

  const warfareActives = [
    makeAbility('TQ2.Ability.Player.Warfare.Whirlwind', 8, [
      { cls: modKeys[0] || 'bp_gam_player_wa_whirlwind_dmg', level: 3 },
      { cls: 'None', level: -1 }
    ]),
    makeAbility('TQ2.Ability.Player.Warfare.ShieldCharge', 6, [
      { cls: modKeys[1] || 'bp_gam_player_wa_charge_stun', level: 2 }
    ]),
    makeAbility('TQ2.Ability.Player.Warfare.BattleRage', 4, [])
  ];

  const warfarePassives = [
    makeAbility('TQ2.Ability.Player.Warfare.Passive.WeaponMastery', 10, [], [
      featKeys[0] || 'bp_bge_player_wa_feat_crit',
      'None'
    ]),
    makeAbility('TQ2.Ability.Player.Warfare.Passive.DodgeReflex', 5, [], [])
  ];

  const earthActives = [
    makeAbility('TQ2.Ability.Player.Earth.FlameSurge', 7, [
      { cls: modKeys[2] || 'bp_gam_player_ea_flame_radius', level: 2 }
    ]),
    makeAbility('TQ2.Ability.Player.Earth.Volcano', 5, [])
  ];

  const earthPassives = [
    makeAbility('TQ2.Ability.Player.Earth.Passive.EarthEnchantment', 8, [], [
      featKeys[1] || 'bp_bge_player_ea_feat_burn'
    ])
  ];

  const masteriesList = [
    makeMastery('warfare', warfareActives, warfarePassives),
    makeMastery('earth', earthActives, earthPassives)
  ];

  const mList = new G.Arr(new G.TN('StructProperty', [new G.TN('TQ2MasteryInstance')]), masteriesList);
  mList.mark();

  const mInnerProps = [
    p('ActivePoints', 'i32', 4),
    p('PassivePoints', 'i32', 2),
    p('MasteryPoints', 'i32', 6),
    new G.Prop('Masteries', new G.TN('ArrayProperty', [new G.TN('StructProperty', [new G.TN('TQ2MasteryInstance')])]), 0, 0, null, mList, new Uint8Array(0))
  ];

  const mContainer = new G.Struct('TQ2MasteryContainer', new G.PropList(mInnerProps));
  mContainer.mark();

  const masterySGD = new G.SGD('Mastery', 'UTQ2MasterySaveGameData', 0, new G.PropList([
    new G.Prop('m_Masteries', new G.TN('StructProperty', [new G.TN('TQ2MasteryContainer')]), 0, 0, null, mContainer, new Uint8Array(0))
  ]));
  masterySGD.mark();

  const rootProps = [
    new G.Prop('Mastery', new G.TN('StructProperty', [new G.TN('SaveGameData')]), 0, 0, null, masterySGD, new Uint8Array(0))
  ];
  const rootPl = new G.PropList(rootProps);
  markAll(rootPl);

  return {
    header: makeHeader('/Script/TQ2.TQ2PlayerLocalSaveGame'),
    extra: 0,
    root: rootPl,
    trailer: new Uint8Array(0),
    klass: '/Script/TQ2.TQ2PlayerLocalSaveGame',
    branch: '++UE5+Release-5.5',
    saveVer: 3
  };
}

function createDemoStashSave(CAT) {
  const stash1Items = [
    makeItem(CAT, '/JsonData/TQ2/Items/relic/da_socket_relic_apollo_01', 'da_socket_relic_apollo_01', 'Epic', 28, [], 1),
    makeItem(CAT, '/JsonData/TQ2/Items/charm/da_socket_charm_venomsac_01', 'da_socket_charm_venomsac_01', 'Magic', 18, [], 10),
    makeItem(CAT, '/JsonData/TQ2/Items/charm/da_socket_charm_necroticbones_01', 'da_socket_charm_necroticbones_01', 'Magic', 24, [], 5),
    makeItem(CAT, '/JsonData/TQ2/Items/2h_axe_light_physical/da_weapon_2h_axe_unique_t1_ragingbull_stun', 'da_weapon_2h_axe_unique_t1_ragingbull_stun', 'Rare', 26, [
      '/Game/TQ2/Items/Affixes/Prefixes/da_prefix_1_PerIncreasedPhysicalDmg.da_prefix_1_PerIncreasedPhysicalDmg'
    ], 1)
  ];
  const stash2Items = [
    makeItem(CAT, '/JsonData/TQ2/Items/armor_chest_heavy/da_armor_torso_greek_knight', 'da_armor_torso_greek_knight', 'Epic', 28, [], 1),
    makeItem(CAT, '/JsonData/TQ2/Items/relic/da_socket_relic_hermes_01', 'da_socket_relic_hermes_01', 'Epic', 28, [], 2)
  ];

  const stash1 = createContainerStruct(40, stash1Items);
  const stash2 = createContainerStruct(40, stash2Items);

  const arrVal = new G.Arr(new G.TN('StructProperty', [new G.TN('GrimItemContainerSaveData')]), [stash1, stash2]);
  arrVal.mark();
  const caravanProp = new G.Prop('CaravanTabs', new G.TN('ArrayProperty', [new G.TN('StructProperty', [new G.TN('GrimItemContainerSaveData')])]), 0, 0, null, arrVal, new Uint8Array(0));

  const rootPl = new G.PropList([caravanProp]);
  markAll(rootPl);

  return {
    header: makeHeader('/Script/TQ2.TQ2PublicCrossCharacterSaveGame'),
    extra: 0,
    root: rootPl,
    trailer: new Uint8Array(0),
    klass: '/Script/TQ2.TQ2PublicCrossCharacterSaveGame',
    branch: '++UE5+Release-5.5',
    saveVer: 3
  };
}

function createDemoHeaderSave() {
  const props = [
    p('m_CharacterName', 'str', 'Achilles'),
    p('m_Level', 'i32', 28),
    p('m_TotalPlayTimeSeconds', 'i32', 64800)
  ];
  const rootPl = new G.PropList(props);
  markAll(rootPl);

  return {
    header: makeHeader('/Script/TQ2.TQ2SaveGameHeader'),
    extra: 0,
    root: rootPl,
    trailer: new Uint8Array(0),
    klass: '/Script/TQ2.TQ2SaveGameHeader',
    branch: '++UE5+Release-5.5',
    saveVer: 3
  };
}

function generateDemoFiles(CAT) {
  const pSave = createDemoPlayerSave(CAT);
  const plSave = createDemoPlayerLocalSave(CAT);
  const sSave = createDemoStashSave(CAT);
  const hSave = createDemoHeaderSave();

  return [
    { name: 'Achilles_2026-08-19_Data_Player.sav', save: pSave, items: T.listItems(pSave), orig: G.serializeSave(pSave), dirty: false },
    { name: 'Achilles_2026-08-19_Data_PlayerLocal.sav', save: plSave, items: T.listItems(plSave), orig: G.serializeSave(plSave), dirty: false },
    { name: 'PublicCrossCharacterSaveData.sav', save: sSave, items: T.listItems(sSave), orig: G.serializeSave(sSave), dirty: false },
    { name: 'Achilles_Header.sav', save: hSave, items: T.listItems(hSave), orig: G.serializeSave(hSave), dirty: false }
  ];
}

root.TQ2Demo = { generateDemoFiles };
})(typeof globalThis !== 'undefined' ? globalThis : this);
