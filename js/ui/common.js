/* Common State, DOM Helpers, Constants & Data Catalog Loader for Titan Quest II Save Editor */
(function (root) {
'use strict';

const G = root.GVAS, T = root.TQ2;
const I18N = root.TQ2_I18N || (typeof require !== 'undefined' ? (function() { try { return require('../core/i18n.js'); } catch(e) { return null; } })() : null);
const t = (k, p) => (I18N && typeof I18N.t === 'function' ? I18N.t(k, p) : (p ? k : k));

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};
const elHtml = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const fmtNum = n => (typeof n === 'number' && !isNaN(n)) ? n.toLocaleString('en-US') : (n ?? '–');
const escapeHtml = str => {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
};

// Global App State
const state = {
  CAT: null,
  files: [],
  curItem: null,
  curSec: null,
  filterText: '',
  filterCat: 'all',
  filterRarity: 'all',

  // Folder & Profile State
  loadedFolderFiles: new Map(),
  discoveredProfiles: [],
  activeProfile: null,
  sharedStashFiles: [],
  currentDirectoryHandle: null,
  fileHandlesMap: new Map()
};

const LABELS = {
  m_CharacterLevel: 'Character Level',
  m_CurrentLevelProgress: 'Level Progress (0.00 – 1.00)',
  m_CharacterAP: 'Unspent Attribute Points Pool',
  m_AttributePointsMight: 'Might',
  m_AttributePointsAgility: 'Agility',
  m_AttributePointsKnowledge: 'Knowledge',
  m_AttributePointsVigor: 'Vigor',
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
  LastTelemetrySnapshotId: 'Telemetry ID',
  m_DeathCounter: 'Total Deaths',
  m_KillCounter: 'Total Monsters Slain',
  m_TotalPlaytimeAtLastDeath: 'Playtime at Last Death (s)',
  m_TotalPlayTimeSeconds: 'Total Playtime (Seconds)',
  Tears: 'Tears of the Gods',
  Gold: 'Gold',
  Obols: 'Sacred Obols',
};
const lbl = n => {
  const trans = t ? t('labels.' + n) : null;
  if (trans && !trans.startsWith('labels.')) return trans;
  return LABELS[n] || n.replace(/^m_/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
};

const RARITIES = ['EGrimItemRarity::Magic', 'EGrimItemRarity::Infrequent', 'EGrimItemRarity::Rare', 'EGrimItemRarity::Epic'];
const CATEGORIES = ['EGrimItemAffixCategory::Base', 'EGrimItemAffixCategory::Random', 'EGrimItemAffixCategory::Implicit'];
const RARITY_CLASS = { Magic: 'r-magic', Infrequent: 'r-infreq', Rare: 'r-rare', Epic: 'r-epic' };

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

async function loadCatalog() {
  const bin = Uint8Array.from(atob(window.__CATALOG__), c => c.charCodeAt(0));
  let json;
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([bin]).stream().pipeThrough(ds);
    json = await new Response(stream).text();
  } else {
    throw new Error('DecompressionStream not supported in this browser.');
  }
  state.CAT = JSON.parse(json);
  state.CAT.itemSet = new Set(state.CAT.i.map(x => x[1]));
  state.CAT.m = state.CAT.m || {};
  state.CAT.f = state.CAT.f || {};
  state.CAT.names = state.CAT.names || {};
  reindex();
}

function reindex() {
  if (!state.CAT) return;
  state.CAT.keys = Object.keys(state.CAT.a).sort((a, b) => T.affixShortName(a).localeCompare(T.affixShortName(b)));
  state.CAT.itemNames = state.CAT.i.map(x => x[1]).sort();
  const dl = $('#itemlist');
  if (dl) {
    dl.innerHTML = '';
    for (const n of state.CAT.itemNames) {
      const o = el('option');
      o.value = n;
      o.label = T.friendlyItemName(n);
      dl.appendChild(o);
    }
  }
}

function learn(save) {
  if (!state.CAT) return;
  let nAff = 0, nItem = 0, nRanke = 0;
  for (const it of T.listItems(save)) {
    const asset = it.handle.asset;
    if (asset && !state.CAT.itemSet.has(asset)) {
      state.CAT.i.push([it.handle.pkg, asset]);
      state.CAT.itemSet.add(asset);
      nItem++;
    }
    const af = T.affixes(it);
    if (!af) continue;
    for (const a of af.items) {
      const pf = T.affixField(a, 'pAffix');
      const path = pf ? pf.v : null;
      if (!path || path === 'None') continue;
      const cf = T.affixField(a, 'Category');
      const cshort = cf ? String(cf.v).split('::').pop() : null;
      let info = state.CAT.a[path];
      if (!info) {
        const w = new G.W();
        a.ser(w);
        info = state.CAT.a[path] = { c: cshort, cs: cshort ? [cshort] : [], g: [], tb: w.done() };
        nAff++;
      } else if (cshort && info.cs.indexOf(cshort) < 0) {
        info.cs.push(cshort);
      }
      for (const e of T.affixEffects(a)) {
        const gf = T.affixField(e, 'pSoftGameplayEffect');
        const sf = T.affixField(e, 'Scale');
        if (!gf || !sf || typeof sf.v !== 'number') continue;
        const key = path + '|' + gf.v;
        if (VERIFIED_MAX_OVERRIDES[key]) {
          state.CAT.s[key] = [...VERIFIED_MAX_OVERRIDES[key]];
          continue;
        }
        const r = state.CAT.s[key];
        if (!r) {
          state.CAT.s[key] = [sf.v, sf.v];
        } else if (sf.v < r[0]) {
          r[0] = sf.v;
          nRanke++;
        } else if (sf.v > r[1]) {
          r[1] = sf.v;
          nRanke++;
        }
      }
    }
  }
  if (nAff || nItem || nRanke) {
    log(`Database extended: +${nAff} affixes, +${nItem} item templates, ${nRanke} bounds.`);
    reindex();
  }
}

function learnSkills(save) {
  if (!state.CAT) return;
  let nM = 0, nF = 0;
  const sg = T.sgds(save);
  if (!sg.Mastery || !(sg.Mastery.body instanceof G.PropList)) return;
  const md = sg.Mastery.body.get('m_Masteries');
  if (!md || !(md.value.body instanceof G.PropList)) return;
  const list = md.value.body.get('Masteries');
  if (!list || !(list.value instanceof G.Arr)) return;
  for (const m of list.value.items) {
    for (const key of ['ActiveAbilities', 'PassiveAbilities']) {
      const ap = m.body && m.body.get ? m.body.get(key) : null;
      if (!ap || !(ap.value instanceof G.Arr)) continue;
      for (const e of ap.value.items) {
        const nm = T.abilityName(e);
        const sl = e.body.get('ModifierSlots');
        if (sl && sl.value instanceof G.Arr) for (const x of sl.value.items) {
          const mc = x.body.get('ModifierClass'), lv = x.body.get('Level');
          const v = mc && mc.value instanceof G.Scalar ? mc.value.v : null;
          if (!v || v === 'None') continue;
          let info = state.CAT.m[v];
          if (!info) { info = state.CAT.m[v] = { lv: [1, 1], ab: [] }; nM++; }
          if (lv && lv.value.v > 0) {
            info.lv[0] = Math.min(info.lv[0], lv.value.v);
            info.lv[1] = Math.max(info.lv[1], lv.value.v);
          }
          if (info.ab.indexOf(nm) < 0) info.ab.push(nm);
        }
        const fs = e.body.get('FeatSlots');
        if (fs && fs.value instanceof G.Arr) for (const x of fs.value.items) {
          const v = x instanceof G.Scalar ? x.v : null;
          if (!v || v === 'None') continue;
          let info = state.CAT.f[v];
          if (!info) { info = state.CAT.f[v] = { ab: [] }; nF++; }
          if (info.ab.indexOf(nm) < 0) info.ab.push(nm);
        }
      }
    }
  }
  if (nM || nF) log(`Skill database updated: +${nM} modifiers, +${nF} feats.`);
}

function scaleRanke(affixPath, gePath) {
  if (!state.CAT || !state.CAT.s) return null;
  return state.CAT.s[affixPath + '|' + gePath] || null;
}

let logTotal = 0;
function log(msg, isErr, isSucc) {
  const box = $('#log');
  if (!box) return;
  const line = el('div', isErr ? 'err' : (isSucc ? 'succ' : ''), `[${new Date().toLocaleTimeString()}] ${msg}`);
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
  logTotal++;
  const cnt = $('#log-count');
  if (cnt) cnt.textContent = `${logTotal} events`;
}

function toast(msg, type = 'info') {
  const c = $('#toast-container');
  if (!c) return;
  const t = el('div', 'toast ' + (type === 'err' ? 'err' : (type === 'succ' ? 'succ' : '')), msg);
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3500);
}

function markFileDirty(fi) {
  if (fi >= 0 && fi < state.files.length) {
    state.files[fi].dirty = true;
    markDirty();
  }
}

function markDirty() {
  const n = state.files.filter(f => f.dirty).length;
  const sp = $('#dirty');
  if (sp) sp.textContent = n ? t('header.unsaved_tag', { n }) : '';
  const btnZip = $('#save');
  if (btnZip) btnZip.disabled = !state.files.length;
  const btnDirect = $('#btn-save-direct');
  if (btnDirect) {
    btnDirect.disabled = !state.files.length;
    btnDirect.classList.toggle('has-changes', n > 0);
  }
}

const TQ2App = {
  G, T, I18N, t,
  setLanguage: I18N ? I18N.setLanguage : null,
  getLanguage: I18N ? I18N.getLanguage : null,
  toggleLanguage: I18N ? I18N.toggleLanguage : null,
  $, $$, el, elHtml, fmtNum, escapeHtml,
  state,
  LABELS, lbl, RARITIES, CATEGORIES, RARITY_CLASS, VERIFIED_MAX_OVERRIDES,
  loadCatalog, reindex, learn, learnSkills, scaleRanke,
  log, toast,
  markFileDirty, markDirty
};

root.TQ2App = TQ2App;
})(typeof globalThis !== 'undefined' ? globalThis : this);
