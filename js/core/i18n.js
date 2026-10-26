/* Internationalization (i18n) Engine for Titan Quest II Save & Item Editor */
(function (root) {
'use strict';

const DICT = {
  en: {
    lang_name: 'English',
    lang_code: 'en',
    
    // Header & Global Actions
    header: {
      title: 'Titan Quest II · Character & Save Editor',
      subtitle: 'Unified Character View · Inventory & Sockets · Attributes · Masteries',
      profile_label: 'Character: {name} (Lv {level})',
      profile_switch_title: 'Click to switch between character profiles in your SaveGames folder',
      reload_folder: 'Reload:',
      reload_folder_title: 'Instantly reload saves from your previously selected folder',
      select_folder: 'Select Folder',
      select_folder_title: 'Select a SaveGames folder (e.g. D:\\TQ2Saves) for 1-click loading & direct overwriting',
      open_files: 'Open .sav Files',
      open_files_title: 'Select .sav files directly (bypasses AppData blocks)',
      save_direct: 'Save & Overwrite',
      save_direct_title: 'Directly overwrite modified save files to disk and auto-delete Saving.sav',
      export_zip: 'Export (.zip)',
      export_zip_title: 'Export all modified save files as a single .zip archive (extract to SaveGames)',
      guide_btn: '❓ Guide',
      guide_btn_title: 'View save file guide and checksum instructions',
      lang_btn: '🌐 English',
      lang_btn_title: 'Switch language / Đổi sang Tiếng Việt',
      unsaved_tag: '({n} unsaved)'
    },

    // Step Banner
    banner: {
      guide_title: 'SaveGames Guide:',
      step_1: 'Drop SaveGames folder / .sav files (or Select files)',
      step_2: 'Edit attributes, skills & gear',
      step_3: 'Delete Saving.sav (Auto-deleted when using Save & Overwrite)',
      why_saving: 'Why delete Saving.sav?'
    },

    // Left Panel / Search / Filters / Toolbar
    left: {
      search_placeholder: 'Search gear, unique name, affix, stat…',
      filter_all: 'All Items',
      filter_weapon: 'Weapons',
      filter_armor: 'Armor',
      filter_relic: 'Relics & Charms',
      filter_currency: 'Currencies',
      rarity_all: 'All Ranks',
      rarity_magic: 'Magic',
      rarity_infrequent: 'Infrequent',
      rarity_rare: 'Rare',
      rarity_epic: 'Epic',
      drop_title: 'Drop SaveGames folder or .sav files here',
      drop_sub: 'Drag & drop bypasses browser AppData blocks · Auto-detects profiles',
      switch_hero: 'Switch ▾',
      stat_badge: '📦 {count} items ({groups} groups)',
      expand_all: '🔽 Expand',
      expand_all_title: 'Expand all groups',
      collapse_all: '🔼 Collapse',
      collapse_all_title: 'Collapse all groups',
      reset_forge: '🔨 Reset Forge',
      reset_forge_title: 'Clear blacksmith crafting history (m_CraftingHistory) for all items in bag and stash',
      grp_profile: '🌟 Character Profile & Skills',
      items_count: '{n} items',
      sections_count: '{n} sections',
      craft_tag_title: 'This item has blacksmith crafting history'
    },

    // Right Panel / Hero Box
    hero: {
      title: 'Titan Quest II Character & Item Editor',
      desc: 'Select your SaveGames folder or .sav files to automatically discover all your character profiles in a single unified view. Runs 100% offline in your browser.',
      reload_last: 'Reload Previous Folder',
      select_folder: 'Select Folder',
      select_files: 'Select .sav Files (Ctrl+A)',
      card1_title: '👤 Single Unified Character View',
      card1_desc: 'No more switching between confusing separate .sav file tabs. Equipment, Backpack Inventory, Core Attributes, Masteries, and Currencies are all seamlessly integrated into one character dashboard.',
      card2_title: '⚔️ Human-Readable Item Names',
      card2_desc: 'Items and unique weapons like Harpe, Raging Bull, Funguslog, and Greek Knight Cuirass are clearly labeled with in-game RPG names instead of raw Unreal Engine asset codes.',
      card3_title: '⚡ Mastery & Skill Trees',
      card3_desc: 'Add free active, passive, and mastery points. Expand any ability to configure active Modifier Slots (with tier ranks 1–3) and passive Feat Slots—even ones not yet unlocked in-game.',
      card4_title: '⚠️ The Saving.sav Manifest',
      card4_desc: 'TQ2 stores a CRC32 checksum file named Saving.sav. If a save file\'s checksum doesn\'t match, the game rolls back to the .bak file. Deleting Saving.sav forces the game to load your edits and create a fresh valid manifest.'
    },

    // Containers
    containers: {
      m_Equipment: 'Equipped Gear',
      backpack_main: 'Backpack Inventory',
      backpack_special: 'Backpack · Special Slot',
      quest_pouch: 'Quest Items & Pouch',
      personal_stash_1: 'Personal Stash Tab 1',
      personal_stash_2: 'Personal Stash Tab 2',
      personal_stash_n: 'Personal Stash {n}',
      caravan_materials: 'Caravan · Materials Storage',
      caravan_stash_n: 'Caravan · Stash Tab {n}',
      shared_materials: 'Shared · Materials Storage',
      shared_stash_n: 'Shared · Stash Tab {n}'
    },

    // Labels & Stats
    labels: {
      m_CharacterLevel: 'Character Level',
      m_CurrentLevelProgress: 'Level Progress (0.00 – 1.00)',
      m_CharacterAP: 'Unspent Attribute Points Pool',
      m_AttributePointsMight: 'Might (Increases Physical / Pierce Damage)',
      m_AttributePointsAgility: 'Agility (Increases Crit Chance / Attack Speed)',
      m_AttributePointsKnowledge: 'Knowledge (Increases Spell Damage / Cast Speed)',
      m_AttributePointsVigor: 'Vigor (Increases Max Health / Health Regen)',
      ActivePoints: 'Active Skill Points',
      PassivePoints: 'Passive Skill Points',
      MasteryPoints: 'Mastery Points Pool',
      InvestedMasteryPoints: 'Invested Mastery Points',
      m_BaseAttackDamage: 'Base Attack Damage',
      m_AttackDamageVariance: 'Damage Variance %',
      m_AttackSpeedFactor: 'Attack Speed Factor',
      m_Armor: 'Armor Rating',
      m_Level: 'Item Level',
      m_RequiredLevel: 'Required Character Level',
      m_Rarity: 'Rarity Grade',
      m_GoldValue: 'Gold Value',
      m_MaxStack: 'Max Stack Size',
      Num: 'Quantity / Stack Count',
      LastTelemetrySnapshotId: 'Telemetry Snapshot ID',
      m_DeathCounter: 'Total Deaths',
      m_KillCounter: 'Total Monsters Slain',
      m_TotalPlaytimeAtLastDeath: 'Playtime at Last Death (s)',
      m_TotalPlayTimeSeconds: 'Total Playtime (Seconds)',
      Tears: 'Tears of the Gods',
      Gold: 'Gold',
      Obols: 'Sacred Obols'
    },

    // Effects & Stat Names
    effects: {
      stat_modifier: 'Stat Modifier',
      attack_speed: '+ % Attack Speed',
      cast_speed: '+ % Cast Speed',
      move_speed: '+ % Movement Speed',
      cooldown_speed: '+ % Cooldown Speed',
      crit_chance: '+ % Critical Strike Chance',
      crit_dmg: '+ % Critical Damage Multiplier',
      attack_cast_speed: '+ % Attack & Cast Speed',
      energy_regen: '+ Energy Regen / sec',
      energy_barrier: '+ Energy Barrier',
      less_energy_reserved: 'Less % Energy Reserved',
      res_fire: '+ % Fire Resistance',
      res_cold: '+ % Cold Resistance',
      res_lightning: '+ % Lightning Resistance',
      res_poison: '+ % Poison Resistance',
      res_physical: '+ % Physical Resistance',
      res_impair: '+ % Impairment Resistance',
      res_ailment: '+ % Ailment Resistance',
      res_all: '+ % All Resistances',
      might: '+ Might',
      agility: '+ Agility',
      knowledge: '+ Knowledge',
      vigor: '+ Vigor',
      max_energy: '+ Max Energy',
      max_health: '+ Max Health',
      all_damage: '+ % All Damage',
      speed: '+ % Speed',
      skill_activations: '+ % Skill Activations',
      fire_damage: '+ % Fire Damage',
      cold_damage: '+ % Cold Damage',
      lightning_damage: '+ % Lightning Damage',
      poison_damage: '+ % Poison Damage',
      pierce_damage: '+ % Pierce Damage',
      vitality_damage: '+ % Vitality Damage',
      spell_damage: '+ % Spell Damage',
      area_damage: '+ % Area Damage',
      projectile_damage: '+ % Projectile Damage',
      strike_damage: '+ % Strike Damage',
      ailment_chance: '+ % Ailment Chance',
      ailment_power: '+ % Ailment Power',
      potion_instant_recovery: '+ % Instant Health Recovery',
      potion_charges_consumed: 'Less Charges Consumed',
      potion_effect_duration: '+ % Potion Effect Duration'
    },

    // Slot Names
    slots: {
      armor_head: 'Helm',
      armor_torso: 'Cuirass / Chest Armor',
      armor_leg: 'Leg Armor / Greaves',
      armor_arm: 'Arm Armor / Vambraces',
      armor_shield: 'Shield',
      weapon_1h_sword: '1H Sword',
      weapon_1h_axe: '1H Axe',
      weapon_1h_club: '1H Club / Mace',
      weapon_2h_sword: '2H Greatsword',
      weapon_2h_axe: '2H Great Axe',
      weapon_2h_hammer: '2H Warhammer',
      weapon_2h_spear: 'Spear',
      weapon_2h_staff: 'Staff',
      weapon_2h_bow: 'Bow',
      jewelry_ring: 'Ring',
      jewelry_amulet: 'Amulet',
      relic: 'Relic / Charm',
      potion: 'Potion',
      unknown: 'Unknown Item'
    },

    // Compatibility warnings
    compat: {
      potion_only: 'Potion affixes only work on Health/Energy Potions (stripped by game on gear)',
      potion_valid: 'Potion Affix (Valid on Potions)',
      movespeed_slot: 'Movement Speed only rolls on Greaves (Legs) and Amulets',
      movespeed_valid: 'Movement Speed (Greaves / Amulets)',
      armor_flat_slot: 'Flat Armor & Retaliation only apply to Armor and Shields',
      armor_flat_valid: 'Armor & Defense (Armor / Shield)',
      skill_passive_slot: 'Passive Skill Level affixes only roll on Helms, Amulets, and Relics',
      skill_active_slot: 'Active Skill Capacity affixes only roll on Helms, Rings, Amulets, and Relics',
      skill_points_slot: 'Mastery Passives affixes only roll on Helms, Amulets, and Relics',
      generic_incompat: 'Affix is not naturally compatible with this item slot ({slot})'
    },

    // Character Editor
    char: {
      profile_head: 'Character Profile',
      sec_attr: 'Attributes & Progression',
      sec_attr_sub: 'Might, Agility, Knowledge, Vigor & AP Pool',
      sec_mastery: 'Mastery & Skill Trees',
      sec_mastery_sub: 'Warfare / Earth / Rogue / Storm abilities & feats',
      sec_currency: 'Currencies & Materials',
      sec_currency_sub: 'Gold, Obols, Tears & Bag synchronization',
      sec_stats: 'Gameplay Statistics & Progress',
      sec_stats_sub: 'Kills & death records',
      char_name: 'Character Name: {name}',
      configure_slots: 'Configure Slots ({used}/{total})',
      modifier_slot: 'Modifier {n}',
      feat_slot: 'Feat {n}',
      tier: 'Tier',
      rank: 'Rank',
      cur_card_title: 'Currencies, Materials & Quest Spending',
      sync_all_btn: '⚡ Sync All to Bag (Fix Negative Spent)',
      sync_all_title: 'Sets Total Earned = Held in Bag for any currency where Bag holdings exceed Total Earned, fixing negative spent values.',
      sync_all_toast: 'Synced {count} currencies! Total Earned updated to match Bag holdings.',
      sync_all_none: 'All currency totals are already properly synchronized.',
      held_in_bag: 'In Bag: {n}',
      spent_amount: 'Spent: {n}',
      calc_spent: 'Spent = Total Earned ({earned}) − Bag ({bag})',
      spent_fixed: 'Spent = 0 (Total Earned matched to Bag)',
      spent_negative_fix: 'Fixed: Bag exceeds Total Earned (Total adjusted to {bag})',
      sync_row_btn: 'Sync Total = Bag',
      mastery_panel_title: 'Mastery Selection & Skill Points',
      spendable_points_title: 'Spendable Skill Points Pool',
      reset_mastery_btn: '🔄 Reset Mastery (Clear Class)',
      reset_mastery_title: 'Wipe chosen masteries, refund 100% of points, and allow picking classes again from scratch.',
      refund_skills_btn: '⚡ Refund Skill Ranks (Keep Class)',
      refund_skills_title: 'Reset all ability ranks to 0 and refund points into spendable pools while keeping chosen masteries.',
      mastery_status_label: 'Current Class / Masteries:',
      unblessed_title: 'No Masteries Selected (Unblessed)',
      unblessed_badge: 'Unblessed',
      unblessed_desc: 'This character currently has no active masteries. When you load this save file into Titan Quest II, the game will present the Mastery selection screen where you can pick any two Masteries and allocate points from scratch.',
      unblessed_catalog_title: 'Available Masteries in Titan Quest II:',
      invested_summary: 'Invested Points: <b>{act}</b> Active | <b>{pas}</b> Passive | <b>{mas}</b> Mastery',
      mastery_tree_title: 'Mastery Tree: {name}',
      active_abilities_title: 'Active Abilities',
      passive_abilities_title: 'Passive Abilities',
      attr_card_title: 'Attributes & Core Stats',
      reset_attr_btn: '🔄 Reset Attributes',
      reset_attr_title: 'Reset all allocated Might, Agility, Knowledge, and Vigor points to 0, refunding all points back to your free unspent AP pool.'
    },

    // Gameplay Effects
    effects: {
      stat_modifier: 'Stat Modifier',
      physical_damage_flat: '+ Flat Physical Damage',
      physical_damage: '+ % Physical Damage',
      attack_speed: '+ % Attack Speed',
      cast_speed: '+ % Cast Speed',
      move_speed: '+ % Movement Speed',
      cooldown_speed: '+ % Cooldown Speed',
      crit_chance: '+ % Critical Strike Chance',
      crit_dmg: '+ % Critical Damage',
      attack_cast_speed: '+ % Attack & Cast Speed',
      energy_regen: '+ Energy Regen / sec',
      energy_barrier: '+ Energy Barrier',
      less_energy_reserved: 'Less % Energy Reserved',
      res_fire: '+ % Fire Resistance',
      res_cold: '+ % Cold Resistance',
      res_lightning: '+ % Lightning Resistance',
      res_poison: '+ % Poison Resistance',
      res_physical: '+ % Physical Resistance',
      res_impair: '+ % Impairment Resistance',
      res_ailment: '+ % Ailment Resistance',
      res_all: '+ % All Resistances',
      might: '+ Might',
      agility: '+ Agility',
      knowledge: '+ Knowledge',
      vigor: '+ Vigor',
      max_energy: '+ Max Energy',
      max_health: '+ Max Health',
      all_damage: '+ % All Damage',
      speed: '+ % Speed',
      skill_activations: '+ % Skill Activations',
      fire_damage: '+ % Fire Damage',
      cold_damage: '+ % Cold Damage',
      lightning_damage: '+ % Lightning Damage',
      poison_damage: '+ % Poison Damage',
      pierce_damage: '+ % Pierce Damage',
      vitality_damage: '+ % Vitality Damage',
      spell_damage: '+ % Spell Damage',
      area_damage: '+ % Area Damage',
      projectile_damage: '+ % Projectile Damage',
      strike_damage: '+ % Strike Damage',
      ailment_chance: '+ % Ailment Chance',
      ailment_power: '+ % Ailment Power',
      potion_instant_recovery: '+ % Instant Health Recovery',
      potion_charges_consumed: 'Less Charges Consumed',
      potion_effect_duration: '+ % Potion Effect Duration'
    },

    // Item Editor
    item: {
      select_prompt: 'Select an item or a character section from the list on the left to edit.',
      container_path: '{subtitle} · Container: {container}',
      base_template: 'Base Item Template',
      base_stats: 'Base Item Properties',
      sockets_title: 'Socket Slots (Gems & Runes)',
      affixes_title: 'Item Affixes & Modifiers',
      add_prefix: '+ Add Prefix',
      add_suffix: '+ Add Suffix',
      add_implicit: '+ Add Implicit',
      add_unique: '+ Add Unique Effect',
      delete_affix: '✕ Delete Affix',
      reset_crafting_btn: '🔨 Reset Crafting History',
      reset_crafting_title: 'Remove blacksmith modifications so this item can be re-crafted in-game',
      reset_crafting_toast: 'Crafting history removed from {name}!',
      incompat_title: 'Affix Slot Incompatibility Warning',
      incompat_desc: 'The following affixes on this item may be stripped or ignored by the game on load because they are incompatible with this item type ({slot}):',
      incompat_autofix: '⚡ Auto-Remove Incompatible Affixes',
      autofix_toast: 'Removed {count} incompatible affixes from {name}.',
      scale_label: 'Effect Value / Scalar',
      tier_label: 'Tier Level (0–5)',
      preview_title: 'Live In-Game Tooltip Preview'
    },

    // Modals & Dialogs
    modals: {
      // Profile Selector
      profile_modal_title: 'Select Character Profile to Edit',
      profile_modal_sub: 'Found {count} character profile(s). Pick a character to load all its equipment, attributes & masteries in one view:',
      profile_active_badge: '★ Active',
      profile_saved: 'Saved: {time}',
      profile_playtime: 'Playtime: {time}',
      profile_files: 'Files: {files}',
      profile_reload_btn: 'Reload Profile',
      profile_edit_btn: 'Edit Character',
      profile_include_shared: 'Include Shared Stash files (PublicCrossCharacterSaveData.sav)',
      
      // Blacksmith Confirmation
      reset_all_confirm_title: '⚠️ Confirm Reset Crafting History for All Items?',
      reset_all_confirm_body: 'This will remove the blacksmith modification record (m_CraftingHistory) from ALL items in your active save files, allowing you to re-craft and re-roll items at the Blacksmith in-game.\n\nAre you sure you want to proceed?',
      reset_all_toast: 'Reset blacksmith history on {count} modified item(s)!',
      reset_all_none: 'No items with crafting history were found in current save files.',
      
      // Mastery Reset Confirmation
      reset_mastery_confirm_title: '⚠️ Confirm Reset Masteries / Clear Class?',
      reset_mastery_confirm_body: 'Are you sure you want to reset all masteries for {name}?\n\n• Classes removed: {classes}\n• Active Skill Points refunded: +{active} pts\n• Passive Skill Points refunded: +{passive} pts\n• Mastery Points refunded: +{mastery} pts\n\nYour action bar bindings for previous mastery skills will be safely cleaned, and character status will be set to Unblessed. Upon loading the game, you can freely pick new masteries and allocate your points from scratch.',
      reset_mastery_toast: 'Successfully reset masteries for {name}! Refunded {active} Active, {passive} Passive, and {mastery} Mastery points.',
      refund_skills_confirm_title: '⚡ Confirm Refund Skill Points?',
      refund_skills_confirm_body: 'This will reset all ability ranks to 0 and refund +{active} Active and +{passive} Passive skill points back into your spendable pool, while keeping your current Masteries ({classes}) intact.\n\nAre you sure you want to proceed?',
      refund_skills_toast: 'Refunded {active} Active and {passive} Passive skill points!',
      refund_skills_none: 'No points are currently invested in abilities.',
      
      // Attribute Reset Confirmation
      reset_attr_confirm_title: '⚠️ Confirm Reset Attribute Points?',
      reset_attr_confirm_body: 'Are you sure you want to reset all attribute points for {name}?\n\n• Might refunded: +{might} pts\n• Agility refunded: +{agility} pts\n• Knowledge refunded: +{knowledge} pts\n• Vigor refunded: +{vigor} pts\n• Total Free AP: +{total} pts\n\nAll attributes will return to base (50 pre-gear), and you will have {totalAP} unspent points to allocate freely.',
      reset_attr_toast: 'Successfully reset attributes for {name}! {total} Attribute Points are now free to spend.',
      reset_attr_none: 'No attribute points are currently allocated.',
      
      // Help / Guide
      guide_modal_title: 'Titan Quest II – Save File & Checksum Guide',
      guide_section_primary: '1. Standard Save File Directory (D:\\TQ2Saves)',
      guide_section_primary_body: 'Your live Titan Quest II save files are located at D:\\TQ2Saves (or AppData\\Local\\TQ2\\Saved\\SaveGames). Keep this folder selected in the editor for instant 1-click loading and saving.',
      guide_section_saving: '2. Why Delete Saving.sav?',
      guide_section_saving_body: 'TQ2 uses Saving.sav to store CRC32 checksums of each .sav file. If you edit a save file and its checksum doesn\'t match Saving.sav, the game will ignore your changes and roll back to the .bak backup. Deleting Saving.sav forces the game to read the newly modified files and generate a brand-new valid checksum manifest on next launch.',
      guide_section_steps: '3. Recommended Editing Workflow',
      guide_step1: 'Select your SaveGames folder (e.g. D:\\TQ2Saves) using the "Select Folder" button.',
      guide_step2: 'Choose a character profile, then customize attributes, mastery skills, currencies, and item affixes.',
      guide_step3: 'Click "Save & Overwrite". The editor will automatically overwrite your save files and delete Saving.sav for you.',
      guide_step4: 'Launch Titan Quest II and enjoy your updated character!',
      modal_close: 'Close'
    },

    // Searchable Select
    select: {
      search_placeholder: 'Search by name or keyword…',
      no_results: 'No matching items found',
      all_categories: 'All Categories',
      choose_template: '— Select Base Item Template —',
      choose_affix: '— Select Affix —'
    },

    // Activity Log
    log: {
      header: 'Activity Log & Save Diagnostics',
      events_count: '{count} events',
      scanned_folder: 'Scanned SaveGames: {files} files, {profiles} character profile(s).',
      direct_save_success: 'Saved {count} files directly to disk! (Saving.sav automatically deleted)',
      export_zip_success: 'Exported {count} save files as zip archive: {filename}'
    }
  },

  vi: {
    lang_name: 'Tiếng Việt',
    lang_code: 'vi',

    // Header & Global Actions
    header: {
      title: 'Titan Quest II · Trình Chỉnh Sửa Nhân Vật & Save',
      subtitle: 'Xem thông tin hợp nhất · Túi đồ & Khảm ngọc · Thuộc tính · Tinh thông',
      profile_label: 'Nhân vật: {name} (Lv {level})',
      profile_switch_title: 'Bấm để chuyển đổi giữa các nhân vật trong thư mục SaveGames',
      reload_folder: 'Tải lại:',
      reload_folder_title: 'Tải lại ngay các file save từ thư mục đã chọn trước đó',
      select_folder: 'Chọn Thư mục',
      select_folder_title: 'Chọn thư mục SaveGames (VD: D:\\TQ2Saves) để nạp 1-chạm & lưu ghi đè trực tiếp',
      open_files: 'Mở File .sav',
      open_files_title: 'Chọn trực tiếp các file .sav (vượt qua giới hạn bảo mật AppData)',
      save_direct: 'Lưu & Ghi đè',
      save_direct_title: 'Ghi đè trực tiếp các file save đã sửa xuống ổ cứng và tự động xoá Saving.sav',
      export_zip: 'Xuất (.zip)',
      export_zip_title: 'Xuất toàn bộ file save đã chỉnh sửa thành 1 file .zip (giải nén vào SaveGames)',
      guide_btn: '❓ Hướng dẫn',
      guide_btn_title: 'Xem hướng dẫn thư mục save và cơ chế checksum',
      lang_btn: '🌐 Tiếng Việt',
      lang_btn_title: 'Đổi ngôn ngữ / Switch to English',
      unsaved_tag: '({n} chưa lưu)'
    },

    // Step Banner
    banner: {
      guide_title: 'Hướng dẫn SaveGames:',
      step_1: 'Kéo thả thư mục SaveGames / file .sav (hoặc Chọn file)',
      step_2: 'Chỉnh sửa thuộc tính, kỹ năng & trang bị',
      step_3: 'Xoá Saving.sav (Tự động xoá khi dùng Lưu & Ghi đè)',
      why_saving: 'Tại sao cần xoá Saving.sav?'
    },

    // Left Panel / Search / Filters / Toolbar
    left: {
      search_placeholder: 'Tìm kiếm trang bị, tên unique, dòng affix, chỉ số…',
      filter_all: 'Tất cả',
      filter_weapon: 'Vũ khí',
      filter_armor: 'Giáp',
      filter_relic: 'Relic & Bùa',
      filter_currency: 'Tiền tệ & Kho',
      rarity_all: 'Tất cả phẩm',
      rarity_magic: 'Magic',
      rarity_infrequent: 'Infrequent',
      rarity_rare: 'Rare',
      rarity_epic: 'Epic',
      drop_title: 'Kéo thả thư mục SaveGames hoặc file .sav vào đây',
      drop_sub: 'Kéo thả giúp vượt qua giới hạn AppData của trình duyệt · Tự động nhận diện nhân vật',
      switch_hero: 'Đổi NV ▾',
      stat_badge: '📦 {count} đồ ({groups} nhóm)',
      expand_all: '🔽 Mở',
      expand_all_title: 'Mở rộng tất cả các nhóm',
      collapse_all: '🔼 Thu',
      collapse_all_title: 'Thu gọn tất cả các nhóm',
      reset_forge: '🔨 Reset Rèn',
      reset_forge_title: 'Xóa sạch lịch sử thợ rèn (m_CraftingHistory) cho tất cả trang bị trong túi và rương',
      grp_profile: '🌟 Hồ sơ Nhân vật & Kỹ năng',
      items_count: '{n} đồ',
      sections_count: '{n} mục',
      craft_tag_title: 'Trang bị này có lịch sử rèn (Crafting History)'
    },

    // Right Panel / Hero Box
    hero: {
      title: 'Trình chỉnh sửa Nhân vật & Trang bị Titan Quest II',
      desc: 'Chọn thư mục SaveGames hoặc các file .sav để tự động nhận diện tất cả nhân vật trong một giao diện hợp nhất. Hoạt động 100% offline ngay trên trình duyệt.',
      reload_last: 'Tải lại Thư mục trước',
      select_folder: 'Chọn Thư mục',
      select_files: 'Chọn File .sav (Ctrl+A)',
      card1_title: '👤 Giao diện Nhân vật Hợp nhất',
      card1_desc: 'Không còn phải chuyển đổi giữa các tab file .sav riêng lẻ. Trang bị, Túi đồ, Thuộc tính cốt lõi, Tinh thông và Tiền tệ đều được tích hợp liền mạch trong một trang tổng quan.',
      card2_title: '⚔️ Tên Trang bị Dễ đọc',
      card2_desc: 'Các trang bị và vũ khí độc bản như Harpe, Raging Bull, Funguslog, Greek Knight Cuirass được hiển thị rõ ràng bằng tên trong game thay vì mã asset thô của Unreal Engine.',
      card3_title: '⚡ Cây Kỹ năng & Tinh thông',
      card3_desc: 'Thêm điểm kỹ năng chủ động, bị động và tinh thông tự do. Mở rộng bất kỳ kỹ năng nào để cấu hình các ô Bổ trợ (Modifier Slots cấp 1–3) và ô Kỳ tài (Feat Slots)—kể cả những kỹ năng chưa mở khoá trong game.',
      card4_title: '⚠️ File Kiểm tra Checksum Saving.sav',
      card4_desc: 'TQ2 lưu trữ file checksum CRC32 tên Saving.sav. Nếu checksum của file save không khớp, game sẽ khôi phục lại file .bak. Xóa Saving.sav sẽ buộc game đọc các chỉnh sửa của bạn và tạo lại manifest hợp lệ mới.'
    },

    // Containers
    containers: {
      m_Equipment: 'Trang bị Đang mặc',
      backpack_main: 'Túi đồ Hành trang',
      backpack_special: 'Túi đồ · Ô Đặc biệt',
      quest_pouch: 'Túi Đồ Nhiệm vụ',
      personal_stash_1: 'Rương Cá nhân Tab 1',
      personal_stash_2: 'Rương Cá nhân Tab 2',
      personal_stash_n: 'Rương Cá nhân Ô {n}',
      caravan_materials: 'Đoàn buôn · Kho Nguyên liệu',
      caravan_stash_n: 'Đoàn buôn · Rương Tab {n}',
      shared_materials: 'Dùng chung · Kho Nguyên liệu',
      shared_stash_n: 'Dùng chung · Rương Tab {n}'
    },

    // Labels & Stats
    labels: {
      m_CharacterLevel: 'Cấp độ Nhân vật',
      m_CurrentLevelProgress: 'Tiến trình Cấp độ (0.00 – 1.00)',
      m_CharacterAP: 'Điểm Thuộc tính Chưa cộng',
      m_AttributePointsMight: 'Sức mạnh (Might - Tăng Sát thương Vật lý / Xuyên)',
      m_AttributePointsAgility: 'Nhanh nhẹn (Agility - Tăng Chí mạng / Tốc độ Đánh)',
      m_AttributePointsKnowledge: 'Trí tuệ (Knowledge - Tăng Sát thương Phép / Tốc độ Niệm)',
      m_AttributePointsVigor: 'Sinh lực (Vigor - Tăng Máu tối đa / Hồi phục)',
      ActivePoints: 'Điểm Kỹ năng Chủ động',
      PassivePoints: 'Điểm Kỹ năng Bị động',
      MasteryPoints: 'Điểm Tinh thông Chưa cộng',
      InvestedMasteryPoints: 'Điểm Tinh thông Đã cộng',
      m_BaseAttackDamage: 'Sát thương Vũ khí Cơ bản',
      m_AttackDamageVariance: 'Dao động Sát thương %',
      m_AttackSpeedFactor: 'Hệ số Tốc độ Đánh',
      m_Armor: 'Chỉ số Giáp Bảo vệ',
      m_Level: 'Cấp độ Vật phẩm',
      m_RequiredLevel: 'Cấp độ Yêu cầu',
      m_Rarity: 'Độ hiếm Trang bị',
      m_GoldValue: 'Giá trị Bán Vàng',
      m_MaxStack: 'Cộng dồn Tối đa',
      Num: 'Số lượng Vật phẩm',
      LastTelemetrySnapshotId: 'Mã Telemetry ID',
      m_DeathCounter: 'Số lần Tử trận',
      m_KillCounter: 'Số Quái vật Đã tiêu diệt',
      m_TotalPlaytimeAtLastDeath: 'Thời gian chơi khi chết (giây)',
      m_TotalPlayTimeSeconds: 'Tổng Thời gian chơi (Giây)',
      Tears: 'Nước mắt Thần linh (Tears)',
      Gold: 'Tiền Vàng (Gold)',
      Obols: 'Đồng Obol Thần thánh (Obols)'
    },

    // Effects & Stat Names
    effects: {
      stat_modifier: 'Chỉ số Điều chỉnh',
      attack_speed: '+ % Tốc độ Tấn công',
      cast_speed: '+ % Tốc độ Niệm phép',
      move_speed: '+ % Tốc độ Di chuyển',
      cooldown_speed: '+ % Tốc độ Hồi chiêu',
      crit_chance: '+ % Tỷ lệ Chí mạng Cơ bản',
      crit_dmg: '+ % Sát thương Chí mạng',
      attack_cast_speed: '+ % Tốc độ Đánh & Niệm',
      energy_regen: '+ Hồi Năng lượng / giây',
      energy_barrier: '+ Khiên Năng lượng',
      less_energy_reserved: 'Giảm % Năng lượng Dự trữ',
      res_fire: '+ % Kháng Lửa',
      res_cold: '+ % Kháng Băng',
      res_lightning: '+ % Kháng Sét',
      res_poison: '+ % Kháng Độc',
      res_physical: '+ % Kháng Vật lý',
      res_impair: '+ % Kháng Làm suy yếu',
      res_ailment: '+ % Kháng Hiệu ứng Bất lợi',
      res_all: '+ % Kháng Tất cả',
      might: '+ Sức mạnh',
      agility: '+ Nhanh nhẹn',
      knowledge: '+ Trí tuệ',
      vigor: '+ Sinh lực',
      max_energy: '+ Năng lượng Tối đa',
      max_health: '+ Máu Tối đa',
      all_damage: '+ % Tăng Toàn bộ Sát thương',
      speed: '+ % Tăng Tốc độ',
      skill_activations: '+ % Lần Kích hoạt Kỹ năng',
      fire_damage: '+ % Tăng Sát thương Lửa',
      cold_damage: '+ % Tăng Sát thương Băng',
      lightning_damage: '+ % Tăng Sát thương Sét',
      poison_damage: '+ % Tăng Sát thương Độc',
      pierce_damage: '+ % Tăng Sát thương Xuyên',
      vitality_damage: '+ % Tăng Sát thương Sinh lực',
      spell_damage: '+ % Tăng Sát thương Phép',
      area_damage: '+ % Tăng Sát thương Diện rộng',
      projectile_damage: '+ % Tăng Sát thương Bắn xa',
      strike_damage: '+ % Tăng Sát thương Đòn đánh',
      ailment_chance: '+ % Tỷ lệ Gây Hiệu ứng Bất lợi',
      ailment_power: '+ % Sức mạnh Hiệu ứng Bất lợi',
      potion_instant_recovery: '+ % Hồi Máu Tức thì',
      potion_charges_consumed: 'Giảm Số lượt Dược phẩm Tiêu hao',
      potion_effect_duration: '+ % Thời lượng Dược phẩm'
    },

    // Slot Names
    slots: {
      armor_head: 'Mũ giáp / Giáp đầu',
      armor_torso: 'Áo giáp / Giáp ngực',
      armor_leg: 'Giáp chân / Xà cạp',
      armor_arm: 'Giáp tay / Hộ thủ',
      armor_shield: 'Khiên bảo vệ',
      weapon_1h_sword: 'Kiếm 1 tay',
      weapon_1h_axe: 'Rìu 1 tay',
      weapon_1h_club: 'Chùy 1 tay',
      weapon_2h_sword: 'Đại kiếm 2 tay',
      weapon_2h_axe: 'Rìu chiến 2 tay',
      weapon_2h_hammer: 'Đại chùy 2 tay',
      weapon_2h_spear: 'Thương chiến',
      weapon_2h_staff: 'Gậy phép',
      weapon_2h_bow: 'Cung tên',
      jewelry_ring: 'Nhẫn',
      jewelry_amulet: 'Dây chuyền',
      relic: 'Relic / Bùa chú',
      potion: 'Dược phẩm',
      unknown: 'Vật phẩm không xác định'
    },

    // Compatibility warnings
    compat: {
      potion_only: 'Dòng Potion chỉ dùng cho Bình Máu/Mana (bị game xoá trên trang bị)',
      potion_valid: 'Dành riêng cho Dược phẩm',
      movespeed_slot: 'Tốc độ chạy chỉ xuất hiện trên Giày (Legs) và Dây chuyền (Amulet)',
      movespeed_valid: 'Tốc độ chạy (Giày / Dây chuyền)',
      armor_flat_slot: 'Giáp cơ bản & Phản đòn chỉ hoạt động trên Giáp và Khiên',
      armor_flat_valid: 'Giáp & Phòng thủ (Giáp / Khiên)',
      skill_passive_slot: 'Dòng cộng Cấp Kỹ năng Bị động chỉ hoạt động trên Mũ, Dây chuyền và Relic',
      skill_active_slot: 'Dòng cộng Dung tích Kỹ năng Chủ động chỉ hoạt động trên Mũ, Nhẫn, Dây chuyền và Relic',
      skill_points_slot: 'Dòng cộng Điểm Kỹ năng Tinh thông chỉ hoạt động trên Mũ, Dây chuyền và Relic',
      generic_incompat: 'Dòng thuộc tính không tự nhiên tương thích với vị trí trang bị này ({slot})'
    },

    // Character Editor
    char: {
      profile_head: 'Hồ sơ Nhân vật',
      sec_attr: 'Thuộc tính & Tiến trình',
      sec_attr_sub: 'Sức mạnh, Nhanh nhẹn, Trí tuệ, Sinh lực & Điểm cộng',
      sec_mastery: 'Cây Kỹ năng & Tinh thông',
      sec_mastery_sub: 'Kỹ năng Warfare / Earth / Rogue / Storm & Kỳ tài',
      sec_currency: 'Tiền tệ & Nguyên liệu',
      sec_currency_sub: 'Tính toán Vàng, Obols, Tears & Đồng bộ Túi đồ',
      sec_stats: 'Thống kê & Tiến độ chơi',
      sec_stats_sub: 'Số quái đã hạ gục & số lần tử trận',
      char_name: 'Tên Nhân vật: {name}',
      configure_slots: 'Cấu hình Ô Bổ trợ ({used}/{total})',
      modifier_slot: 'Bổ trợ {n}',
      feat_slot: 'Kỳ tài {n}',
      tier: 'Cấp',
      rank: 'Bậc',
      cur_card_title: 'Tiền tệ, Nguyên liệu & Tiêu hao Nhiệm vụ',
      sync_all_btn: '⚡ Đồng bộ Tất cả theo Túi (Sửa Lỗi Tiêu hao Âm)',
      sync_all_title: 'Đặt Tổng Đã Kiếm = Số lượng trong Túi cho bất kỳ loại tiền nào bị lỗi chi tiêu âm.',
      sync_all_toast: 'Đã đồng bộ {count} loại tiền! Tổng Đã Kiếm đã được điều chỉnh bằng số lượng trong Túi.',
      sync_all_none: 'Tất cả các loại tiền đều đã đồng bộ chuẩn xác.',
      held_in_bag: 'Trong Túi: {n}',
      spent_amount: 'Đã Tiêu: {n}',
      calc_spent: 'Đã Tiêu = Tổng Kiếm ({earned}) − Trong Túi ({bag})',
      spent_fixed: 'Đã Tiêu = 0 (Tổng Kiếm bằng số lượng trong Túi)',
      spent_negative_fix: 'Đã sửa: Số trong Túi lớn hơn Tổng Kiếm (Tổng đã chỉnh lên {bag})',
      sync_row_btn: 'Đồng bộ Tổng = Túi',
      mastery_panel_title: 'Chọn Tinh Thông & Điểm Kỹ Năng',
      spendable_points_title: 'Kho Điểm Kỹ Năng Khả Dụng',
      reset_mastery_btn: '🔄 Reset Mastery (Xoá Class & Chọn Lại)',
      reset_mastery_title: 'Xóa các class đã chọn, hoàn trả 100% điểm kỹ năng & tinh thông, cho phép chọn lại class từ đầu trong game.',
      refund_skills_btn: '⚡ Tẩy Điểm Kỹ Năng (Giữ Class)',
      refund_skills_title: 'Đặt lại cấp độ kỹ năng về 0 và hoàn trả điểm Active/Passive mà không xoá class đã chọn.',
      mastery_status_label: 'Class / Tinh thông Hiện tại:',
      unblessed_title: 'Chưa Chọn Tinh Thông (Unblessed)',
      unblessed_badge: 'Chưa chọn Class',
      unblessed_desc: 'Nhân vật hiện chưa kích hoạt Tinh thông (Class). Khi bạn lưu và mở file save này trong Titan Quest II, game sẽ tự động hiện giao diện "Choose a Mastery" để bạn chọn lại 2 Tinh thông bất kỳ và nâng điểm tự do từ đầu.',
      unblessed_catalog_title: 'Danh sách 6 Tinh thông trong Titan Quest II:',
      invested_summary: 'Điểm đã nâng: <b>{act}</b> Chủ động (Active) | <b>{pas}</b> Bị động (Passive) | <b>{mas}</b> Tinh thông (Mastery)',
      mastery_tree_title: 'Cây Tinh Thông: {name}',
      active_abilities_title: 'Kỹ năng Chủ động (Active)',
      passive_abilities_title: 'Kỹ năng Bị động (Passive)',
      attr_card_title: 'Thuộc Tính & Chỉ Số Cốt Lõi',
      reset_attr_btn: '🔄 Reset Thuộc Tính',
      reset_attr_title: 'Đặt toàn bộ điểm Sức mạnh, Khéo léo, Tri thức, Sinh lực về 0 và hoàn trả 100% về kho AP tự do.'
    },

    // Gameplay Effects
    effects: {
      stat_modifier: 'Dòng Chỉ số',
      physical_damage_flat: '+ Sát thương Vật lý',
      physical_damage: '+ % Sát thương Vật lý',
      attack_speed: '+ % Tốc độ Đánh',
      cast_speed: '+ % Tốc độ Niệm phép',
      move_speed: '+ % Tốc độ Di chuyển',
      cooldown_speed: '+ % Tốc độ Hồi chiêu',
      crit_chance: '+ % Tỷ lệ Chí mạng',
      crit_dmg: '+ % Sát thương Chí mạng',
      attack_cast_speed: '+ % Tốc độ Đánh & Niệm phép',
      energy_regen: '+ Hồi Năng lượng / giây',
      energy_barrier: '+ Khiên Năng lượng (Barrier)',
      less_energy_reserved: 'Giảm % Năng lượng Duy trì (Reserved)',
      res_fire: '+ % Kháng Lửa',
      res_cold: '+ % Kháng Băng',
      res_lightning: '+ % Kháng Sét',
      res_poison: '+ % Kháng Độc',
      res_physical: '+ % Kháng Vật lý',
      res_impair: '+ % Kháng Làm suy yếu',
      res_ailment: '+ % Kháng Hiệu ứng Xấu',
      res_all: '+ % Tất cả Kháng nguyên tố',
      might: '+ Điểm Sức mạnh (Might)',
      agility: '+ Điểm Khéo léo (Agility)',
      knowledge: '+ Điểm Tri thức (Knowledge)',
      vigor: '+ Điểm Sinh lực (Vigor)',
      max_energy: '+ Năng lượng Tối đa',
      max_health: '+ Máu Tối đa',
      all_damage: '+ % Toàn bộ Sát thương',
      speed: '+ % Toàn bộ Tốc độ',
      skill_activations: '+ % Kích hoạt Kỹ năng',
      fire_damage: '+ % Sát thương Lửa',
      cold_damage: '+ % Sát thương Băng',
      lightning_damage: '+ % Sát thương Sét',
      poison_damage: '+ % Sát thương Độc',
      pierce_damage: '+ % Sát thương Xuyên giáp (Pierce)',
      vitality_damage: '+ % Sát thương Sinh lực (Vitality)',
      spell_damage: '+ % Sát thương Phép thuật',
      area_damage: '+ % Sát thương Diện rộng (AoE)',
      projectile_damage: '+ % Sát thương Đạn bay (Projectile)',
      strike_damage: '+ % Sát thương Đòn đánh',
      ailment_chance: '+ % Tỷ lệ Gây hiệu ứng xấu',
      ailment_power: '+ % Sức mạnh Hiệu ứng xấu',
      potion_instant_recovery: '+ % Hồi máu Ngay lập tức',
      potion_charges_consumed: 'Tiêu hao Ít Lần dùng hơn',
      potion_effect_duration: '+ % Thời gian Tác dụng của Bình'
    },

    // Item Editor
    item: {
      select_prompt: 'Chọn một vật phẩm hoặc một mục nhân vật từ danh sách bên trái để chỉnh sửa.',
      container_path: '{subtitle} · Vị trí: {container}',
      base_template: 'Bản mẫu Vật phẩm Gốc',
      base_stats: 'Chỉ số Cơ bản của Vật phẩm',
      sockets_title: 'Ô Khảm Ngọc (Gems & Runes)',
      affixes_title: 'Dòng Thuộc tính (Affixes & Modifiers)',
      add_prefix: '+ Thêm Tiền tố (Prefix)',
      add_suffix: '+ Thêm Hậu tố (Suffix)',
      add_implicit: '+ Thêm Nội tại (Implicit)',
      add_unique: '+ Thêm Hiệu ứng Độc bản (Unique)',
      delete_affix: '✕ Xoá Dòng',
      reset_crafting_btn: '🔨 Reset Lịch sử Thợ Rèn',
      reset_crafting_title: 'Xoá lịch sử rèn để vật phẩm có thể được tinh chỉnh lại tại Thợ rèn trong game',
      reset_crafting_toast: 'Đã xóa lịch sử rèn của {name}!',
      incompat_title: 'Cảnh báo Dòng Thuộc tính Không Tương thích',
      incompat_desc: 'Các dòng thuộc tính sau trên vật phẩm này có thể bị game tự động xóa hoặc bỏ qua khi tải vì không tương thích với loại trang bị ({slot}):',
      incompat_autofix: '⚡ Tự động Xóa các Dòng Không Tương thích',
      autofix_toast: 'Đã xóa {count} dòng không tương thích khỏi {name}.',
      scale_label: 'Chỉ số Giá trị / Tỉ lệ',
      tier_label: 'Cấp độ Tier (0–5)',
      preview_title: 'Xem Trước Tooltip Trực Quan'
    },

    // Modals & Dialogs
    modals: {
      // Profile Selector
      profile_modal_title: 'Chọn Nhân vật để Chỉnh sửa',
      profile_modal_sub: 'Tìm thấy {count} hồ sơ nhân vật. Chọn một nhân vật để tải toàn bộ trang bị, thuộc tính & tinh thông trong một giao diện:',
      profile_active_badge: '★ Đang chọn',
      profile_saved: 'Lưu lúc: {time}',
      profile_playtime: 'Thời gian chơi: {time}',
      profile_files: 'Các file: {files}',
      profile_reload_btn: 'Tải lại Nhân vật',
      profile_edit_btn: 'Chỉnh sửa Nhân vật',
      profile_include_shared: 'Bao gồm Rương dùng chung (PublicCrossCharacterSaveData.sav)',

      // Blacksmith Confirmation
      reset_all_confirm_title: '⚠️ Xác nhận Reset Lịch sử Thợ Rèn cho Tất cả Trang bị?',
      reset_all_confirm_body: 'Thao tác này sẽ xoá bản ghi lịch sử rèn (m_CraftingHistory) của TẤT CẢ trang bị trong file save hiện tại, cho phép bạn rèn lại và tái tạo dòng tại Thợ rèn trong game.\n\nBạn có chắc chắn muốn thực hiện?',
      reset_all_toast: 'Đã xóa lịch sử thợ rèn trên {count} trang bị!',
      reset_all_none: 'Không tìm thấy trang bị nào có lịch sử rèn trong các file save hiện tại.',
      
      // Mastery Reset Confirmation
      reset_mastery_confirm_title: '⚠️ Xác Nhận Reset Mastery / Xoá Class?',
      reset_mastery_confirm_body: 'Bạn có chắc chắn muốn tẩy tinh thông cho nhân vật {name}?\n\n• Class sẽ bị xoá: {classes}\n• Điểm kỹ năng Chủ động hoàn trả: +{active} điểm\n• Điểm kỹ năng Bị động hoàn trả: +{passive} điểm\n• Điểm phát triển Tinh thông hoàn trả: +{mastery} điểm\n\nThanh phím tắt Action Bar sẽ được dọn dẹp an toàn và danh hiệu nhân vật đổi về Unblessed. Khi vào game, bạn có thể tự do chọn lại Class và nâng điểm lại từ đầu.',
      reset_mastery_toast: 'Đã reset tinh thông thành công cho {name}! Hoàn trả {active} Active, {passive} Passive, và {mastery} điểm Tinh thông.',
      refund_skills_confirm_title: '⚡ Xác Nhận Hoàn Trả Điểm Kỹ Năng?',
      refund_skills_confirm_body: 'Thao tác này sẽ đặt cấp độ của tất cả kỹ năng về 0 và hoàn trả +{active} điểm Active và +{passive} điểm Passive vào kho điểm khả dụng, đồng thời giữ nguyên các Class ({classes}) hiện tại.\n\nBạn có muốn tiếp tục?',
      refund_skills_toast: 'Đã hoàn trả {active} điểm Active và {passive} điểm Passive!',
      refund_skills_none: 'Hiện không có kỹ năng nào đang được nâng điểm.',

      // Attribute Reset Confirmation
      reset_attr_confirm_title: '⚠️ Xác Nhận Reset Điểm Thuộc Tính?',
      reset_attr_confirm_body: 'Bạn có chắc chắn muốn reset toàn bộ điểm thuộc tính của nhân vật {name}?\n\n• Sức mạnh (Might): +{might} điểm hoàn trả\n• Khéo léo (Agility): +{agility} điểm hoàn trả\n• Tri thức (Knowledge): +{knowledge} điểm hoàn trả\n• Sinh lực (Vigor): +{vigor} điểm hoàn trả\n• Tổng điểm AP tự do nhận lại: +{total} điểm\n\nTất cả 4 chỉ số sẽ trở về mức cơ bản (50), và bạn sẽ có {totalAP} điểm AP tự do để cộng lại tùy ý.',
      reset_attr_toast: 'Đã reset điểm thuộc tính thành công cho {name}! {total} điểm AP hiện đang sẵn sàng để nâng lại.',
      reset_attr_none: 'Hiện không có điểm thuộc tính nào đang được nâng.',

      // Help / Guide
      guide_modal_title: 'Titan Quest II – Hướng Dẫn File Save & Checksum',
      guide_section_primary: '1. Thư mục File Save Tiêu Chuẩn (D:\\TQ2Saves)',
      guide_section_primary_body: 'File save Titan Quest II của bạn nằm tại D:\\TQ2Saves (hoặc AppData\\Local\\TQ2\\Saved\\SaveGames). Giữ thư mục này được chọn trong trình chỉnh sửa để nạp và lưu 1-chạm thuận tiện nhất.',
      guide_section_saving: '2. Tại Sao Cần Xoá Saving.sav?',
      guide_section_saving_body: 'TQ2 sử dụng file Saving.sav để lưu mã kiểm tra CRC32 cho từng file .sav. Nếu bạn sửa file save mà checksum không khớp với Saving.sav, game sẽ bỏ qua các chỉnh sửa và khôi phục lại từ file sao lưu .bak. Việc xoá Saving.sav sẽ ép game đọc các file mới sửa và tạo lại manifest checksum chuẩn xác ở lần mở game tiếp theo.',
      guide_section_steps: '3. Quy Trình Chỉnh Sửa Khuyến Nghị',
      guide_step1: 'Chọn thư mục SaveGames (VD: D:\\TQ2Saves) bằng nút "Chọn Thư mục".',
      guide_step2: 'Chọn nhân vật, tùy chỉnh thuộc tính, kỹ năng tinh thông, tiền tệ và các dòng trang bị.',
      guide_step3: 'Bấm nút "Lưu & Ghi đè". Trình chỉnh sửa sẽ tự động lưu đè file save và tự động xoá Saving.sav.',
      guide_step4: 'Khởi động Titan Quest II và trải nghiệm nhân vật của bạn!',
      modal_close: 'Đóng'
    },

    // Searchable Select
    select: {
      search_placeholder: 'Tìm theo tên hoặc từ khóa…',
      no_results: 'Không tìm thấy kết quả phù hợp',
      all_categories: 'Tất cả danh mục',
      choose_template: '— Chọn Bản Mẫu Trang Bị Gốc —',
      choose_affix: '— Chọn Dòng Thuộc Tính —'
    },

    // Activity Log
    log: {
      header: 'Nhật ký hoạt động & Chẩn đoán Save',
      events_count: '{count} sự kiện',
      scanned_folder: 'Đã quét SaveGames: {files} file, {profiles} hồ sơ nhân vật.',
      direct_save_success: 'Đã lưu trực tiếp {count} file xuống ổ cứng! (Saving.sav đã được tự động xoá)',
      export_zip_success: 'Đã xuất {count} file save thành file nén zip: {filename}'
    }
  },

  zh: {
    lang_name: '中文',
    lang_code: 'zh',
    header: {
      title: 'Titan Quest II · 角色与存档编辑器',
      subtitle: '统一角色视图 · 背包与镶嵌 · 属性 · 专精',
      profile_label: '角色：{name}（等级 {level}）',
      profile_switch_title: '点击切换 SaveGames 文件夹中的角色',
      reload_folder: '重新加载：',
      reload_folder_title: '从上次选择的文件夹重新加载存档',
      select_folder: '选择文件夹',
      select_folder_title: '选择 SaveGames 文件夹以加载并直接覆盖存档',
      open_files: '打开 .sav 文件',
      open_files_title: '直接选择 .sav 文件',
      save_direct: '保存并覆盖',
      save_direct_title: '直接覆盖存档文件并自动删除 Saving.sav',
      export_zip: '导出 (.zip)',
      export_zip_title: '将所有已修改的存档导出为一个 .zip 文件',
      guide_btn: '❓ 使用指南',
      guide_btn_title: '查看存档文件与校验和指南',
      lang_btn: '🌐 中文',
      lang_btn_title: '切换语言 / Switch language',
      unsaved_tag: '（{n} 个未保存）'
    },
    banner: {
      guide_title: 'SaveGames 使用指南：',
      step_1: '拖入 SaveGames 文件夹或 .sav 文件（也可选择文件）',
      step_2: '编辑属性、技能和装备',
      step_3: '删除 Saving.sav（使用“保存并覆盖”时会自动删除）',
      why_saving: '为什么要删除 Saving.sav？'
    },
    left: {
      search_placeholder: '搜索装备、独特物品名称、词缀或属性…',
      filter_all: '全部物品',
      filter_weapon: '武器',
      filter_armor: '护甲',
      filter_relic: '圣物与护符',
      filter_currency: '货币与仓库',
      rarity_all: '全部品质',
      rarity_magic: '魔法',
      rarity_infrequent: '非凡',
      rarity_rare: '稀有',
      rarity_epic: '史诗',
      drop_title: '将 SaveGames 文件夹或 .sav 文件拖到这里',
      drop_sub: '拖放可绕过浏览器对 AppData 的限制 · 自动识别角色',
      switch_hero: '切换角色 ▾',
      stat_badge: '📦 {count} 件物品（{groups} 组）',
      expand_all: '🔽 展开',
      expand_all_title: '展开所有分组',
      collapse_all: '🔼 折叠',
      collapse_all_title: '折叠所有分组',
      reset_forge: '🔨 重置锻造',
      reset_forge_title: '清除背包和仓库中所有物品的铁匠锻造记录',
      grp_profile: '🌟 角色档案与技能',
      items_count: '{n} 件物品',
      sections_count: '{n} 个区域',
      craft_tag_title: '此物品有铁匠锻造记录'
    },
    hero: {
      title: 'Titan Quest II 角色与物品编辑器',
      desc: '选择 SaveGames 文件夹或 .sav 文件，即可在统一界面中自动识别角色。所有操作均在浏览器本地离线完成。',
      reload_last: '重新加载上次的文件夹',
      select_folder: '选择文件夹',
      select_files: '选择 .sav 文件 (Ctrl+A)',
      card1_title: '👤 统一角色界面',
      card1_desc: '无需在多个 .sav 文件标签间切换。装备、背包、核心属性、专精和货币都整合在同一个角色面板中。',
      card2_title: '⚔️ 易读的物品名称',
      card2_desc: '物品和独特武器会显示游戏内名称，而不是难以辨认的 Unreal Engine 资源代码。',
      card3_title: '⚡ 专精与技能树',
      card3_desc: '自由调整主动、被动和专精点数，并配置技能修正槽与特性槽。',
      card4_title: '⚠️ Saving.sav 校验清单',
      card4_desc: 'TQ2 使用 Saving.sav 保存 CRC32 校验和。不匹配时游戏可能恢复 .bak 备份。删除此文件可让游戏读取修改后的存档并重新生成校验清单。'
    },
    containers: {
      m_Equipment: '已装备物品',
      backpack_main: '背包',
      backpack_special: '背包 · 特殊栏位',
      quest_pouch: '任务物品与袋子',
      personal_stash_1: '个人仓库栏位 1',
      personal_stash_2: '个人仓库栏位 2',
      personal_stash_n: '个人仓库 {n}',
      caravan_materials: '商队 · 材料仓库',
      caravan_stash_n: '商队 · 仓库栏位 {n}',
      shared_materials: '共享 · 材料仓库',
      shared_stash_n: '共享 · 仓库栏位 {n}'
    },
    labels: {
      m_CharacterLevel: '角色等级',
      m_CurrentLevelProgress: '等级进度 (0.00–1.00)',
      m_CharacterAP: '未分配属性点',
      m_AttributePointsMight: '力量（增加物理/穿刺伤害）',
      m_AttributePointsAgility: '敏捷（增加暴击率/攻击速度）',
      m_AttributePointsKnowledge: '知识（增加法术伤害/施法速度）',
      m_AttributePointsVigor: '活力（增加最大生命值/生命回复）',
      ActivePoints: '主动技能点',
      PassivePoints: '被动技能点',
      MasteryPoints: '未分配专精点',
      InvestedMasteryPoints: '已投入专精点',
      m_BaseAttackDamage: '基础攻击伤害',
      m_AttackDamageVariance: '伤害浮动 %',
      m_AttackSpeedFactor: '攻击速度系数',
      m_Armor: '护甲值',
      m_Level: '物品等级',
      m_RequiredLevel: '需求角色等级',
      m_Rarity: '稀有度',
      m_GoldValue: '金币价值',
      m_MaxStack: '最大堆叠数量',
      Num: '数量/堆叠数',
      m_DeathCounter: '死亡次数',
      m_KillCounter: '击杀怪物数',
      m_TotalPlayTimeSeconds: '总游戏时间（秒）',
      Tears: '诸神之泪',
      Gold: '金币',
      Obols: '神圣奥博尔'
    },
    effects: {
      stat_modifier: '属性修正',
      physical_damage_flat: '+ 固定物理伤害',
      physical_damage: '+ % 物理伤害',
      attack_speed: '+ % 攻击速度',
      cast_speed: '+ % 施法速度',
      move_speed: '+ % 移动速度',
      cooldown_speed: '+ % 冷却速度',
      crit_chance: '+ % 暴击率',
      crit_dmg: '+ % 暴击伤害',
      attack_cast_speed: '+ % 攻击与施法速度',
      energy_regen: '+ 能量回复 / 秒',
      energy_barrier: '+ 能量护盾',
      less_energy_reserved: '减少 % 能量保留',
      res_fire: '+ % 火焰抗性',
      res_cold: '+ % 冰霜抗性',
      res_lightning: '+ % 闪电抗性',
      res_poison: '+ % 毒素抗性',
      res_physical: '+ % 物理抗性',
      res_impair: '+ % 削弱抗性',
      res_ailment: '+ % 异常状态抗性',
      res_all: '+ % 全部抗性',
      might: '+ 力量',
      agility: '+ 敏捷',
      knowledge: '+ 知识',
      vigor: '+ 活力',
      max_energy: '+ 最大能量',
      max_health: '+ 最大生命值',
      all_damage: '+ % 全部伤害',
      speed: '+ % 速度',
      skill_activations: '+ % 技能触发次数',
      fire_damage: '+ % 火焰伤害',
      cold_damage: '+ % 冰霜伤害',
      lightning_damage: '+ % 闪电伤害',
      poison_damage: '+ % 毒素伤害',
      pierce_damage: '+ % 穿刺伤害',
      vitality_damage: '+ % 活力伤害',
      spell_damage: '+ % 法术伤害',
      area_damage: '+ % 范围伤害',
      projectile_damage: '+ % 投射物伤害',
      strike_damage: '+ % 打击伤害',
      ailment_chance: '+ % 异常状态几率',
      ailment_power: '+ % 异常状态强度',
      potion_instant_recovery: '+ % 即时生命恢复',
      potion_charges_consumed: '减少药剂消耗次数',
      potion_effect_duration: '+ % 药剂效果持续时间'
    },
    slots: {
      armor_head: '头盔',
      armor_torso: '胸甲',
      armor_leg: '腿甲',
      armor_arm: '臂甲',
      armor_shield: '盾牌',
      weapon_1h_sword: '单手剑',
      weapon_1h_axe: '单手斧',
      weapon_1h_club: '单手棍棒',
      weapon_2h_sword: '双手巨剑',
      weapon_2h_axe: '双手巨斧',
      weapon_2h_hammer: '双手战锤',
      weapon_2h_spear: '长矛',
      weapon_2h_staff: '法杖',
      weapon_2h_bow: '弓',
      jewelry_ring: '戒指',
      jewelry_amulet: '项链',
      relic: '圣物/护符',
      potion: '药剂',
      unknown: '未知物品'
    },
    compat: {
      potion_only: '药剂词缀仅适用于生命/能量药剂（装备上的此类词缀会被游戏移除）',
      potion_valid: '药剂词缀（适用于药剂）',
      movespeed_slot: '移动速度词缀仅适用于腿甲和项链',
      movespeed_valid: '移动速度（腿甲/项链）',
      armor_flat_slot: '固定护甲与反击仅适用于护甲和盾牌',
      armor_flat_valid: '护甲与防御（护甲/盾牌）',
      skill_passive_slot: '被动技能等级词缀仅适用于头盔、项链和圣物',
      skill_active_slot: '主动技能容量词缀仅适用于头盔、戒指、项链和圣物',
      skill_points_slot: '专精被动技能词缀仅适用于头盔、项链和圣物',
      generic_incompat: '此词缀通常不适用于该装备栏位（{slot}）'
    },
    char: {
      profile_head: '角色档案',
      sec_attr: '属性与进度',
      sec_attr_sub: '力量、敏捷、知识、活力与属性点',
      sec_mastery: '专精与技能树',
      sec_mastery_sub: 'Warfare / Earth / Rogue / Storm 技能与特性',
      sec_currency: '货币与材料',
      sec_currency_sub: '金币、奥博尔、诸神之泪与背包同步',
      sec_stats: '游戏统计与进度',
      sec_stats_sub: '击杀与死亡记录',
      char_name: '角色名称：{name}',
      configure_slots: '配置栏位（{used}/{total}）',
      modifier_slot: '修正 {n}',
      feat_slot: '特性 {n}',
      tier: '阶级',
      rank: '等级',
      cur_card_title: '货币、材料与任务消耗',
      sync_all_btn: '⚡ 全部同步至背包（修复负数消耗）',
      sync_all_title: '当背包数量超过已获取总数时，将已获取总数调整为背包数量。',
      sync_all_toast: '已同步 {count} 种货币！',
      sync_all_none: '所有货币数量均已同步。',
      held_in_bag: '背包中：{n}',
      spent_amount: '已消耗：{n}',
      calc_spent: '已消耗 = 已获取总数（{earned}）− 背包数量（{bag}）',
      spent_fixed: '已消耗 = 0（已获取总数与背包数量一致）',
      spent_negative_fix: '已修复：背包数量超过已获取总数（总数已调整为 {bag}）',
      sync_row_btn: '同步总数 = 背包',
      mastery_panel_title: '专精选择与技能点',
      spendable_points_title: '可用技能点',
      reset_mastery_btn: '🔄 重置专精（清除职业）',
      refund_skills_btn: '⚡ 返还技能点（保留职业）',
      mastery_status_label: '当前职业/专精：',
      unblessed_title: '尚未选择专精',
      unblessed_badge: '未选择专精',
      unblessed_catalog_title: 'Titan Quest II 中可用的专精：',
      mastery_tree_title: '专精树：{name}',
      active_abilities_title: '主动技能',
      passive_abilities_title: '被动技能',
      attr_card_title: '属性与核心数值',
      reset_attr_btn: '🔄 重置属性'
    },
    item: {
      select_prompt: '从左侧列表选择物品或角色区域进行编辑。',
      container_path: '{subtitle} · 容器：{container}',
      base_template: '基础物品模板',
      base_stats: '物品基础属性',
      sockets_title: '镶嵌栏位（宝石与符文）',
      affixes_title: '物品词缀与修正',
      add_prefix: '+ 添加前缀',
      add_suffix: '+ 添加后缀',
      add_implicit: '+ 添加固有词缀',
      add_unique: '+ 添加独特效果',
      delete_affix: '✕ 删除词缀',
      reset_crafting_btn: '🔨 重置锻造记录',
      reset_crafting_title: '移除铁匠改造记录，以便在游戏中重新锻造此物品',
      reset_crafting_toast: '已移除 {name} 的锻造记录！',
      incompat_title: '词缀栏位不兼容警告',
      incompat_desc: '此物品上的以下词缀可能因与装备类型（{slot}）不兼容，而在游戏加载时被移除或忽略：',
      incompat_autofix: '⚡ 自动移除不兼容词缀',
      autofix_toast: '已从 {name} 移除 {count} 个不兼容词缀。',
      scale_label: '效果数值/倍率',
      tier_label: '词缀阶级（0–5）',
      preview_title: '游戏内提示实时预览'
    },
    modals: {
      profile_modal_title: '选择要编辑的角色',
      profile_modal_sub: '找到 {count} 个角色档案。选择角色以在一个界面中加载其装备、属性与专精：',
      profile_active_badge: '★ 当前角色',
      profile_saved: '保存时间：{time}',
      profile_playtime: '游戏时间：{time}',
      profile_files: '文件：{files}',
      profile_reload_btn: '重新加载角色',
      profile_edit_btn: '编辑角色',
      profile_include_shared: '包含共享仓库文件 (PublicCrossCharacterSaveData.sav)',
      reset_all_confirm_title: '⚠️ 确认重置所有物品的锻造记录？',
      reset_all_confirm_body: '这将移除当前存档中所有物品的铁匠改造记录，使其可以再次锻造。\n\n确定继续吗？',
      reset_all_toast: '已重置 {count} 件物品的锻造记录！',
      reset_all_none: '当前存档中没有带锻造记录的物品。',
      reset_mastery_confirm_title: '⚠️ 确认重置专精/清除职业？',
      refund_skills_confirm_title: '⚡ 确认返还技能点？',
      reset_attr_confirm_title: '⚠️ 确认重置属性点？',
      modal_close: '关闭'
    },
    select: {
      search_placeholder: '按名称或关键词搜索…',
      no_results: '没有匹配的物品',
      all_categories: '全部类别',
      choose_template: '— 选择基础物品模板 —',
      choose_affix: '— 选择词缀 —'
    },
    log: {
      header: '活动日志与存档诊断',
      events_count: '{count} 个事件',
      scanned_folder: '已扫描 SaveGames：{files} 个文件，{profiles} 个角色档案。',
      direct_save_success: '已将 {count} 个文件直接保存到磁盘！',
      export_zip_success: '已将 {count} 个存档导出为压缩文件：{filename}'
    }
  }
};

const LANGUAGE_CODES = Object.keys(DICT);
let currentLang = 'vi';

function detectInitialLanguage() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('tq2_lang');
    if (saved && LANGUAGE_CODES.includes(saved)) return saved;
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    const browserLanguage = navigator.language.toLowerCase();
    if (browserLanguage.startsWith('vi')) return 'vi';
    if (browserLanguage.startsWith('zh')) return 'zh';
    return 'en';
  }
  return 'vi';
}

currentLang = detectInitialLanguage();

function getLanguage() {
  return currentLang;
}

function setLanguage(lang, triggerRender = true) {
  if (!LANGUAGE_CODES.includes(lang)) lang = 'vi';
  currentLang = lang;
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem('tq2_lang', lang); } catch (e) {}
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = lang;
  }
  applyStaticTranslations();
  if (triggerRender && root.TQ2App && typeof root.TQ2App.render === 'function') {
    root.TQ2App.render();
  }
  return currentLang;
}

function toggleLanguage() {
  const currentIndex = LANGUAGE_CODES.indexOf(currentLang);
  return setLanguage(LANGUAGE_CODES[(currentIndex + 1) % LANGUAGE_CODES.length], true);
}

function t(path, params = {}) {
  const dict = DICT[currentLang] || DICT.vi;
  const parts = path.split('.');
  let val = dict;
  for (const p of parts) {
    if (val && typeof val === 'object' && p in val) {
      val = val[p];
    } else {
      val = null;
      break;
    }
  }

  // English is the shared fallback for incomplete locale dictionaries.
  if (val === null || val === undefined) {
    const fallbackDict = DICT.en;
    let fbVal = fallbackDict;
    for (const p of parts) {
      if (fbVal && typeof fbVal === 'object' && p in fbVal) {
        fbVal = fbVal[p];
      } else {
        fbVal = null;
        break;
      }
    }
    val = (fbVal !== null && fbVal !== undefined) ? fbVal : path;
  }

  if (typeof val === 'string') {
    return val.replace(/\{(\w+)\}/g, (m, k) => {
      return params[k] !== undefined ? params[k] : m;
    });
  }

  return val;
}

function applyStaticTranslations() {
  if (typeof document === 'undefined') return;
  if (document.documentElement) document.documentElement.lang = currentLang;

  // 1. Text Content via data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const txt = t(key);
    if (txt) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = txt;
      } else {
        el.textContent = txt;
      }
    }
  });

  // 2. HTML Content via data-i18n-html
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (!key) return;
    const html = t(key);
    if (html) el.innerHTML = html;
  });

  // 3. Tooltips via data-i18n-title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (!key) return;
    const title = t(key);
    if (title) el.title = title;
  });

  // 4. Placeholders via data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (!key) return;
    const ph = t(key);
    if (ph) el.placeholder = ph;
  });

  // 5. Update Language Switcher Button in Header
  const langBtn = document.getElementById('btn-lang-switch');
  const langLabel = document.getElementById('current-lang-label');
  if (langLabel) {
    langLabel.textContent = t('lang_name');
  }
  if (langBtn) {
    langBtn.title = t('header.lang_btn_title');
  }
}

const i18n = {
  DICT,
  getLanguage,
  setLanguage,
  toggleLanguage,
  t,
  applyStaticTranslations
};

if (typeof module !== 'undefined' && module.exports) module.exports = i18n;
root.TQ2_I18N = i18n;
})(typeof globalThis !== 'undefined' ? globalThis : this);
