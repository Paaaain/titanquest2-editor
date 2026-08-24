/* Item List, Filtering, Item Details, Affix Editor & Live Tooltip for Titan Quest II Save Editor */
(function (root) {
'use strict';

const app = root.TQ2App;
const G = app.G, T = app.T;
const t = (k, p) => (app && typeof app.t === 'function' ? app.t(k, p) : (p ? k : k));
const $ = app.$, $$ = app.$$, el = app.el, elHtml = app.elHtml, fmtNum = app.fmtNum, escapeHtml = app.escapeHtml;
const log = app.log, toast = app.toast, lbl = app.lbl;

const SKIP_PROPS = new Set([
  'm_Affixes', 'm_CombinedTags', 'm_GenerationTags', 'm_InstanceGuid',
  'm_pDescription', 'm_EquippedAppearances', 'm_WorldAppearanceOverride',
  'm_CraftingHistory', 'm_pSocketedItem', 'm_BaseMesh', 'm_Modifications'
]);

let autoOpenAffixIdx = -1;

function getUnifiedSections() {
  const out = [];
  app.state.files.forEach((f, fi) => {
    const secs = T.charSections(f.save);
    secs.forEach(s => {
      if (s.key === 'header') return;
      out.push({
        key: s.key,
        label: s.label,
        fileIdx: fi,
        node: s.node,
        file: f
      });
    });
  });
  return out;
}

function getAllUnifiedItems() {
  const out = [];
  app.state.files.forEach((f, fi) => {
    f.items.forEach((it, itemIdx) => {
      const hum = T.humanizeTQ2Item(it.handle.asset, it.handle.pkg, T.pval(it, 'm_Rarity') || '');
      out.push({
        fileIdx: fi,
        itemIdx,
        file: f,
        it,
        human: hum,
        container: it.container
      });
    });
  });
  return out;
}

function itemMatches(entry) {
  const it = entry.it;
  const hum = entry.human;
  const f = (app.state.filterText || '').toLowerCase().trim();

  if (f) {
    const fNorm = f.replace(/\bsurfix(es)?\b/g, 'suffix')
                   .replace(/\bpreffix(es)?\b/g, 'prefix')
                   .replace(/\bimplicits?\b/g, 'implicit');
    const match = hum.title.toLowerCase().includes(fNorm) || hum.subtitle.toLowerCase().includes(fNorm)
               || (it.handle.asset || '').toLowerCase().includes(fNorm);
    if (!match) {
      const a = T.affixes(it);
      let afMatch = false;
      if (a) {
        for (const x of a.items) {
          const p = T.affixField(x, 'pAffix');
          if (p) {
            const pVal = (p.v || '').toLowerCase();
            const sName = T.affixShortName(p.v).toLowerCase();
            const kind = T.affixKind(p.v).toLowerCase();
            if (sName.includes(fNorm) || pVal.includes(fNorm) || kind.includes(fNorm)) {
              afMatch = true;
              break;
            }
          }
        }
      }
      if (!afMatch) return false;
    }
  }

  if (app.state.filterCat !== 'all') {
    if (hum.cat !== app.state.filterCat) return false;
  }

  if (app.state.filterRarity !== 'all') {
    const r = (T.pval(it, 'm_Rarity') || '').split('::').pop();
    if (r !== app.state.filterRarity) return false;
  }

  return true;
}

function renderList() {
  const box = $('#items');
  if (!box) return;
  const keepScroll = box.scrollTop;
  box.innerHTML = '';
  if (!app.state.files.length) return;

  if (!app.state.collapsedGroups) {
    app.state.collapsedGroups = new Set();
  }

  const secs = getUnifiedSections();
  const allItems = getAllUnifiedItems();
  const groups = new Map();
  let totalVisibleItems = 0;

  allItems.forEach(entry => {
    if (!itemMatches(entry)) return;
    if (!groups.has(entry.container)) groups.set(entry.container, []);
    groups.get(entry.container).push(entry);
    totalVisibleItems++;
  });

  const isFiltering = !!(app.state.filterText || app.state.filterCat !== 'all' || app.state.filterRarity !== 'all');

  // Auto-expand group of selected item or section
  if (app.state.curSec && app.state.collapsedGroups.has('profile')) {
    app.state.collapsedGroups.delete('profile');
  }
  if (app.state.curItem && app.state.collapsedGroups.has(app.state.curItem.container)) {
    app.state.collapsedGroups.delete(app.state.curItem.container);
  }

  // --- List Control Toolbar (Expand All / Collapse All / Batch Blacksmith Reset) ---
  const toolbar = el('div', 'list-ctrl-toolbar');
  
  const countSpan = el('span', 'list-stat-badge', t('left.stat_badge', { count: totalVisibleItems, groups: groups.size + (secs.length ? 1 : 0) }));
  toolbar.appendChild(countSpan);

  const btnGroup = el('div', 'list-ctrl-btn-group');

  const expandAllBtn = el('button', 'btn tiny ghost list-ctrl-btn', t('left.expand_all'));
  expandAllBtn.title = t('left.expand_all_title');
  expandAllBtn.onclick = (e) => {
    e.stopPropagation();
    app.state.collapsedGroups.clear();
    renderList();
  };
  btnGroup.appendChild(expandAllBtn);

  const collapseAllBtn = el('button', 'btn tiny ghost list-ctrl-btn', t('left.collapse_all'));
  collapseAllBtn.title = t('left.collapse_all_title');
  collapseAllBtn.onclick = (e) => {
    e.stopPropagation();
    if (secs.length) app.state.collapsedGroups.add('profile');
    for (const cName of groups.keys()) {
      app.state.collapsedGroups.add(cName);
    }
    renderList();
  };
  btnGroup.appendChild(collapseAllBtn);

  const resetAllForgeBtn = el('button', 'btn tiny ghost danger list-ctrl-btn', t('left.reset_forge'));
  resetAllForgeBtn.title = t('left.reset_forge_title');
  resetAllForgeBtn.onclick = (e) => {
    e.stopPropagation();
    confirmResetAllBlacksmith();
  };
  btnGroup.appendChild(resetAllForgeBtn);

  toolbar.appendChild(btnGroup);
  box.appendChild(toolbar);

  // --- 1. Character Profile & Skills Section ---
  if (secs.length) {
    const isProfileCollapsed = !isFiltering && app.state.collapsedGroups.has('profile');
    const h = el('div', 'grp clickable' + (isProfileCollapsed ? ' is-collapsed' : ''));
    h.title = isProfileCollapsed ? (t ? t('left.expand_all_title') : 'Expand') : (t ? t('left.collapse_all_title') : 'Collapse');
    
    const leftTitle = el('span', 'grp-title');
    leftTitle.innerHTML = `<span class="grp-toggle-icon">${isProfileCollapsed ? '▶' : '▼'}</span> ${t('left.grp_profile')}`;
    h.appendChild(leftTitle);
    h.appendChild(el('span', 'grp-count', t('left.sections_count', { n: secs.length })));

    h.onclick = () => {
      if (app.state.collapsedGroups.has('profile')) {
        app.state.collapsedGroups.delete('profile');
      } else {
        app.state.collapsedGroups.add('profile');
      }
      renderList();
    };
    box.appendChild(h);

    if (!isProfileCollapsed) {
      secs.forEach(s => {
        const isSel = (app.state.curSec && app.state.curSec.key === s.key);
        const row = el('div', 'item' + (isSel ? ' sel' : ''));
        row.appendChild(el('span', 'dot r-rare'));

        const textWrap = el('div', 'item-text');
        textWrap.appendChild(el('span', 'nm', s.label));
        textWrap.appendChild(el('span', 'subnm', s.key === 'attr' ? t('char.sec_attr_sub') : (s.key === 'mastery' ? t('char.sec_mastery_sub') : (s.key === 'currency' ? t('char.sec_currency_sub') : t('char.sec_stats_sub')))));
        row.appendChild(textWrap);

        row.onclick = () => {
          app.state.curSec = s;
          app.state.curItem = null;
          if (app.render) app.render();
        };
        box.appendChild(row);
      });
    }
  }

  // --- 2. Item Container Groups ---
  for (const [cName, list] of groups) {
    const isGrpCollapsed = !isFiltering && app.state.collapsedGroups.has(cName);
    const h = el('div', 'grp clickable' + (isGrpCollapsed ? ' is-collapsed' : ''));
    h.title = isGrpCollapsed ? (t ? t('left.expand_all_title') : 'Expand') : (t ? t('left.collapse_all_title') : 'Collapse');
    
    const leftTitle = el('span', 'grp-title');
    leftTitle.innerHTML = `<span class="grp-toggle-icon">${isGrpCollapsed ? '▶' : '▼'}</span> ${cName}`;
    h.appendChild(leftTitle);
    h.appendChild(el('span', 'grp-count', t('left.items_count', { n: list.length })));

    h.onclick = () => {
      if (app.state.collapsedGroups.has(cName)) {
        app.state.collapsedGroups.delete(cName);
      } else {
        app.state.collapsedGroups.add(cName);
      }
      renderList();
    };
    box.appendChild(h);

    if (!isGrpCollapsed) {
      list.forEach(entry => {
        const it = entry.it;
        const hum = entry.human;
        const rar = (T.pval(it, 'm_Rarity') || '').split('::').pop();
        const isSel = (app.state.curItem === entry);
        const hasCraftHistory = T.hasCraftingHistory ? T.hasCraftingHistory(it) : (it.props && !!it.props.get('m_CraftingHistory'));

        const row = el('div', 'item' + (isSel ? ' sel' : ''));
        const dot = el('span', 'dot ' + (app.RARITY_CLASS[rar] || 'r-common'));
        row.appendChild(dot);

        const textWrap = el('div', 'item-text');
        textWrap.appendChild(el('span', 'nm', hum.title));
        textWrap.appendChild(el('span', 'subnm', hum.subtitle));
        row.appendChild(textWrap);

        const badges = el('div', 'meta-badges');
        if (hasCraftHistory) {
          const craftBadge = el('span', 'badge-tag craft-tag', '🔨');
          craftBadge.title = t('left.craft_tag_title');
          badges.appendChild(craftBadge);
        }
        const lvl = T.pval(it, 'm_Level');
        if (lvl !== null) badges.appendChild(el('span', 'badge-tag', 'Lv' + lvl));
        const a = T.affixes(it);
        if (a && a.items.length) badges.appendChild(el('span', 'badge-tag', a.items.length + '⚑'));
        row.appendChild(badges);

        row.onclick = () => {
          app.state.curItem = entry;
          app.state.curSec = null;
          if (app.render) app.render();
        };
        box.appendChild(row);
      });
    }
  }

  box.scrollTop = keepScroll;
}

function renderDetail() {
  const box = $('#detail');
  if (!box) return;
  box.innerHTML = '';
  if (app.state.curSec) return app.renderChar(box, app.state.curSec);
  if (!app.state.curItem) {
    box.appendChild(el('div', 'hint', 'Select an item or a character section from the list on the left to edit.'));
    return;
  }

  const entry = app.state.curItem;
  const it = entry.it;
  const hum = entry.human;

  const layout = el('div', 'detail-layout');
  const leftCol = el('div', 'editor-col');
  const rightCol = el('div', 'preview-col');

  const head = el('div', 'dhead');
  head.appendChild(el('h2', '', hum.title));
  head.appendChild(el('div', 'path', hum.subtitle + ' · Container: ' + it.container));
  leftCol.appendChild(head);

  /* --- Base item card --- */
  const base = el('div', 'card');
  base.appendChild(el('h3', '', 'Base Item Template'));
  const bw = el('label', 'fld wide');
  bw.appendChild(el('span', 'lbl', 'Swap Base Item Identifier (Human-Readable & Unreal Asset)'));

  const itemSelect = app.createSearchableBaseItemSelect({
    currentAsset: it.handle.asset,
    onSelect: (pkg, asset) => {
      const hit = app.state.CAT.i.find(x => x[1] === asset) || [pkg || '/JsonData/TQ2/Items/' + asset, asset];
      T.setBaseItem(it, hit[0], hit[1]);
      entry.human = T.humanizeTQ2Item(hit[1]);
      app.markDirty();
      if (app.render) app.render();
      toast('Base item updated to ' + entry.human.title, 'succ');
    }
  });
  bw.appendChild(itemSelect);
  base.appendChild(bw);
  base.appendChild(el('div', 'hint small2', `Current Asset: <code>${it.handle.asset}</code><br>Swap for an item of the same gear category to preserve gameplay animations and equip tags.`));
  leftCol.appendChild(base);

  /* --- Values & Attributes --- */
  const stats = el('div', 'card');
  stats.appendChild(el('h3', '', 'Item Values & Requirements'));
  const grid = el('div', 'grid');
  const rar = it.props && it.props.get('m_Rarity');
  if (rar) {
    grid.appendChild(app.selField('Rarity Grade', rar.value.v, app.RARITIES, v => {
      rar.value.set(v);
      app.markDirty();
      if (app.render) app.render();
      if (v.includes('Epic')) toast('Note: Epic rarity grade disables socket filling in TQ2.', 'info');
    }));
  }
  if (it.props) {
    for (const p of it.props.props) {
      if (SKIP_PROPS.has(p.name) || p.name === 'm_Rarity') continue;
      const v = p.value;
      if (!(v instanceof G.Scalar)) continue;
      if (['i32', 'u32', 'f32', 'f64', 'i64'].includes(v.kind)) {
        grid.appendChild(app.numField(lbl(p.name), v.v, x => {
          v.set(v.kind === 'f32' || v.kind === 'f64' ? x : Math.round(x));
          app.markDirty();
          updateLiveTooltip();
        }, v.kind === 'f32' ? 0.5 : 1));
      }
    }
  }
  if (it.num) {
    grid.appendChild(app.numField('Stack Size', it.num.v, x => {
      it.num.set(Math.max(1, Math.round(x)));
      app.markDirty();
      updateLiveTooltip();
    }));
  }
  stats.appendChild(grid);
  leftCol.appendChild(stats);

  /* --- Affixes --- */
  const af = T.affixes(it);
  const card = el('div', 'card');
  const h3Wrap = el('div', '');
  h3Wrap.innerHTML = `<h3 style="margin:0">Affixes &amp; Stat Modifiers</h3>`;
  const h3 = h3Wrap.firstChild;

  const cardHdrActions = el('div', 'card-header-actions');
  const autoFixTopBtn = el('button', 'btn tiny ghost', '🛠️ Auto-Fix All');
  autoFixTopBtn.title = 'Tự động sửa đúng Category (Random/Base), giới hạn Tier và chuẩn hóa chỉ số an toàn cho game';
  autoFixTopBtn.onclick = () => {
    const res = T.autoFixItemAffixes(it, getTierRange);
    app.markDirty();
    if (app.render) app.render();
    toast(`Đã tối ưu: ${res.fixedCategories} Category, ${res.clampedTiers} Tier, ${res.clampedScales} Chỉ số an toàn!`, 'succ');
  };
  cardHdrActions.appendChild(autoFixTopBtn);

  const maxAllBtn = el('button', 'btn tiny ghost', '⚡ Max All Rolls');
  maxAllBtn.onclick = () => {
    if (!af) return;
    let nMax = 0;
    const CAT = app.state.CAT;
    af.items.forEach(a => {
      const p = T.affixField(a, 'pAffix');
      const path = p ? p.v : '';
      const lvl = T.affixField(a, 'Level');
      const info = (CAT && CAT.a && CAT.a[path]) || {};
      const metaObj = (CAT && CAT.names && CAT.names[path]) || {};
      const maxLvl = (info.maxLevel !== undefined) ? info.maxLevel : (metaObj.maxLevel !== undefined ? metaObj.maxLevel : 10);
      const curTier = lvl ? lvl.v : maxLvl;

      T.affixEffects(a).forEach(e => {
        const ge = T.affixField(e, 'pSoftGameplayEffect');
        const geStr = ge ? (ge.pkg || ge.v || '') : '';
        let effTier = curTier;
        const tm = geStr.match(/T(\d+)$/);
        if (tm) effTier = parseInt(tm[1], 10) - 1;
        if (geStr) {
          const tr = getTierRange(path, geStr, effTier, maxLvl);
          if (tr) {
            if (T.setEffectScale) T.setEffectScale(e, tr[1]);
            else {
              const scv = T.affixField(e, 'Scale');
              if (scv) scv.set(tr[1]);
            }
            nMax++;
          }
        }
      });
    });
    af.mark();
    app.markDirty();
    if (app.render) app.render();
    toast(`Maximized ${nMax} affix rolls to their safe tier maximums!`, 'succ');
  };
  cardHdrActions.appendChild(maxAllBtn);
  h3.appendChild(cardHdrActions);
  card.appendChild(h3);

  if (!af) {
    card.appendChild(el('div', 'hint', 'This item has no affix table (currencies or raw crafting components).'));
  } else {
    // Health / Validation Banner
    const valInfo = T.validateItemAffixes(it);
    const healthBanner = el('div', 'affix-health-banner ' + (valInfo.issues.length ? 'danger' : (valInfo.warnings.length ? 'warn' : 'safe')));
    const healthHdr = el('div', 'affix-health-hdr');
    const healthTitle = el('div', 'affix-health-title');
    if (valInfo.issues.length > 0) {
      healthTitle.innerHTML = `⚠️ Phát hiện xung đột TQ2 (${valInfo.issues.length} lỗi xung đột)`;
    } else if (valInfo.warnings.length > 0) {
      healthTitle.innerHTML = `⚠️ Cảnh báo cấu trúc (${valInfo.warnings.length} lưu ý)`;
    } else if (valInfo.isCustomMultiAffix) {
      healthTitle.innerHTML = `✨ Chuẩn Engine TQ2: An toàn · Mở khóa Đa dòng (Custom Mod)`;
    } else {
      healthTitle.innerHTML = `✅ Chuẩn Engine TQ2: An toàn, không xung đột`;
    }
    healthHdr.appendChild(healthTitle);
    healthBanner.appendChild(healthHdr);

    const chipsRow = el('div', 'affix-health-chips');
    const slotName = T.getItemSlotLabel(valInfo.slot);
    chipsRow.appendChild(el('span', 'affix-chip chip-slot', `📦 ${slotName}`));
    chipsRow.appendChild(el('span', 'affix-chip ' + (valInfo.prefixes > 2 ? 'chip-mod' : 'chip-safe'), `Prefixes: ${valInfo.prefixes}${valInfo.prefixes > 2 ? ' (Đa dòng)' : ''}`));
    chipsRow.appendChild(el('span', 'affix-chip ' + (valInfo.suffixes > 2 ? 'chip-mod' : 'chip-safe'), `Suffixes: ${valInfo.suffixes}${valInfo.suffixes > 2 ? ' (Đa dòng)' : ''}`));
    if (valInfo.implicits > 0) chipsRow.appendChild(el('span', 'affix-chip chip-safe', `Implicits: ${valInfo.implicits}`));
    healthBanner.appendChild(chipsRow);

    if (valInfo.issues.length > 0) {
      const ul = el('ul', 'affix-issues-list');
      valInfo.issues.forEach(iss => {
        const li = el('li', '', iss.message);
        ul.appendChild(li);
      });
      healthBanner.appendChild(ul);
    }
    if (valInfo.warnings.length > 0) {
      const ul = el('ul', 'affix-warnings-list');
      valInfo.warnings.forEach(w => {
        const li = el('li', '', w.message);
        ul.appendChild(li);
      });
      healthBanner.appendChild(ul);
    }
    card.appendChild(healthBanner);

    af.items.forEach((a, i) => card.appendChild(renderAffix(it, af, a, i)));
    const bar = el('div', 'add-affix-suite');
    bar.style.marginTop = '16px';
    bar.style.display = 'flex';
    bar.style.flexDirection = 'column';
    bar.style.gap = '10px';
    bar.style.padding = '12px 14px';
    bar.style.background = 'rgba(0,0,0,0.3)';
    bar.style.border = '1px solid var(--border-gold)';
    bar.style.borderRadius = 'var(--radius-md)';

    const isVi = (app.getLanguage && app.getLanguage() === 'vi');
    const barHdr = el('div', 'add-affix-hdr');
    barHdr.style.display = 'flex';
    barHdr.style.alignItems = 'center';
    barHdr.style.justifyContent = 'space-between';
    barHdr.innerHTML = `<span style="font-size:12px; font-weight:700; color:var(--gold-primary); text-transform:uppercase; letter-spacing:0.06em;">${isVi ? '✨ Thêm Dòng Kỹ Năng &amp; Chỉ Số' : '✨ Add Affixes &amp; Stat Modifiers'}</span>`;

    const barBtnRow = el('div', 'add-affix-btn-row');
    barBtnRow.style.display = 'flex';
    barBtnRow.style.flexWrap = 'wrap';
    barBtnRow.style.gap = '8px';
    barBtnRow.style.alignItems = 'center';

    // 1. Single Slot
    const addSingleBtn = el('button', 'btn', isVi ? '➕ Thêm Slot Riêng Lẻ' : '➕ Add Single Slot');
    addSingleBtn.title = isVi ? 'Thêm 1 slot Affix độc lập mới (Prefix / Suffix / Implicit / Unique) và chọn chỉ số riêng' : 'Add a new independent affix slot (Prefix / Suffix / Implicit / Unique)';
    addSingleBtn.onclick = () => {
      const CAT = app.state.CAT;
      const slotType = T.getItemSlotType(it.handle ? it.handle.asset : '');
      const bestKey = (CAT && CAT.keys) ? (CAT.keys.find(k => {
        const comp = T.checkAffixSlotCompatibility(k, slotType);
        return comp.compatible && (CAT.names && CAT.names[k] && CAT.names[k].authentic);
      }) || CAT.keys[0]) : '';

      const newNode = makeAffix(bestKey);
      const newKind = T.affixKind(bestKey);
      const newCat = T.affixField(newNode, 'Category');
      const isUnique = it.handle && it.handle.asset && it.handle.asset.includes('_unique_');
      if (newCat) {
        if (newKind === 'Implicit') newCat.set('EGrimItemAffixCategory::Base');
        else if (isUnique) newCat.set('EGrimItemAffixCategory::Implicit');
        else newCat.set('EGrimItemAffixCategory::Random');
      }

      autoOpenAffixIdx = af.items.length;
      af.items.push(newNode);
      af.mark();
      app.markDirty();
      if (app.render) app.render();
      toast(isVi ? 'Đã thêm slot Affix riêng lẻ mới' : 'Added new single affix slot', 'succ');
    };
    barBtnRow.appendChild(addSingleBtn);

    // 2. Multi-Stat Bundled Slot
    const addBundleBtn = el('button', 'btn ghost primary', isVi ? '📦 Thêm Gói Gộp Đa Chỉ Số' : '📦 Add Bundled Slot');
    addBundleBtn.title = isVi ? 'Tạo 1 slot Affix gộp nhiều chỉ số con bên trong' : 'Create an affix slot containing multiple sub-effects';
    addBundleBtn.onclick = () => {
      showBundlePresetModal(it, af);
    };
    barBtnRow.appendChild(addBundleBtn);

    // 3. Presets Dropdown
    const presetSelect = el('select', 'txt tiny');
    presetSelect.style.maxWidth = '260px';
    presetSelect.style.color = 'var(--gold-primary)';
    presetSelect.style.fontWeight = '600';
    presetSelect.appendChild(el('option', '', isVi ? '⚡ Nạp nhanh Combo Preset...' : '⚡ Quick Affix Presets...'));
    
    const PRESETS = isVi ? [
      { id: 'forge_full', label: '🔨 Combo Lò Rèn (T1~T5 Active + Passive)' },
      { id: 'spirit_full', label: '👻 Combo Linh Hồn (T1~T5 Active + Passive)' },
      { id: 'warfare_full', label: '⚔️ Combo Chiến Trận (T1~T5 Active + Passive)' },
      { id: 'earth_full', label: '🌍 Combo Đất (T1~T5 Active + Passive)' },
      { id: 'storm_full', label: '⚡ Combo Bão Tố (T1~T5 Active + Passive)' },
      { id: 'rogue_full', label: '🗡️ Combo Thích Khách (T1~T5 Active + Passive)' },
      { id: 'all_attrs', label: '🌟 Combo 4 Thuộc Tính (Might + Agility + Knowledge + Vigor)' },
      { id: 'all_res', label: '🛡️ Combo 5 Kháng (Lửa + Băng + Sét + Độc + Vật lý)' },
      { id: 'speed_crit', label: '💥 Combo Tốc Độ & Chí Mạng (Speed + Crit)' },
      { id: 'energy_barrier', label: '✨ Combo Năng Lượng & Khiên (Energy & Barrier)' }
    ] : [
      { id: 'forge_full', label: '🔨 Forge Combo (T1~T5 Active + Passive)' },
      { id: 'spirit_full', label: '👻 Spirit Combo (T1~T5 Active + Passive)' },
      { id: 'warfare_full', label: '⚔️ Warfare Combo (T1~T5 Active + Passive)' },
      { id: 'earth_full', label: '🌍 Earth Combo (T1~T5 Active + Passive)' },
      { id: 'storm_full', label: '⚡ Storm Combo (T1~T5 Active + Passive)' },
      { id: 'rogue_full', label: '🗡️ Rogue Combo (T1~T5 Active + Passive)' },
      { id: 'all_attrs', label: '🌟 All 4 Attributes (Might + Agility + Knowledge + Vigor)' },
      { id: 'all_res', label: '🛡️ All 5 Resistances (Fire + Cold + Lightning + Poison + Physical)' },
      { id: 'speed_crit', label: '💥 Speed & Critical Combo' },
      { id: 'energy_barrier', label: '✨ Energy & Barrier Combo' }
    ];

    PRESETS.forEach(pr => {
      const op = el('option', '', pr.label);
      op.value = pr.id;
      presetSelect.appendChild(op);
    });

    presetSelect.onchange = () => {
      const val = presetSelect.value;
      presetSelect.value = '';
      if (!val) return;
      applyAffixPreset(it, af, val);
    };
    barBtnRow.appendChild(presetSelect);

    bar.appendChild(barHdr);
    bar.appendChild(barBtnRow);
    card.appendChild(bar);
  }
  leftCol.appendChild(card);

  /* --- Blacksmith / Crafting History Card --- */
  const craftCard = el('div', 'card crafting-card');
  const hasHistory = T.hasCraftingHistory ? T.hasCraftingHistory(it) : (it.props && !!it.props.get('m_CraftingHistory'));

  const craftHdr = el('div', 'dhead');
  craftHdr.style.display = 'flex';
  craftHdr.style.alignItems = 'center';
  craftHdr.style.justifyContent = 'space-between';
  craftHdr.style.margin = '0 0 10px 0';

  const isVi = (app.getLanguage && app.getLanguage() === 'vi');
  const craftH3 = el('h3', '', isVi ? '🔨 Thợ Rèn & Lịch Sử Chế Tạo' : '🔨 Blacksmith & Crafting History');
  craftH3.style.margin = '0';
  craftHdr.appendChild(craftH3);
  craftCard.appendChild(craftHdr);

  const craftBody = el('div', 'crafting-body');
  if (hasHistory) {
    craftBody.innerHTML = `
      <div class="crafting-status-box has-history">
        <div class="crafting-status-title">⚠️ <b>${isVi ? 'Đã có Lịch Sử Rèn (Crafting History: Active)' : 'Crafting History Recorded (Active)'}</b></div>
        <div class="crafting-status-desc">${isVi ? 'Trang bị này đang lưu dữ liệu <code>m_CraftingHistory</code> từ lò rèn thợ rèn. Game sẽ giới hạn các lần rèn tiếp theo.' : 'This item contains <code>m_CraftingHistory</code> from the blacksmith. Future in-game crafts may be restricted.'}</div>
      </div>
    `;
    const btnResetCraft = el('button', 'btn danger', isVi ? '🔄 Xóa Lịch Sử Rèn (Reset Blacksmith)' : '🔄 Reset Blacksmith History');
    btnResetCraft.style.marginTop = '10px';
    btnResetCraft.title = isVi ? 'Xóa sạch m_CraftingHistory để trang bị trở về trạng thái nguyên bản' : 'Remove all m_CraftingHistory modifications to restore pristine state';
    btnResetCraft.onclick = () => {
      if (T.resetCraftingHistory && T.resetCraftingHistory(it)) {
        app.markDirty();
        if (app.render) app.render();
        toast(isVi ? `Đã xóa sạch lịch sử thợ rèn cho "${hum.title}"!` : `Reset blacksmith crafting history for "${hum.title}"!`, 'succ');
      }
    };
    craftBody.appendChild(btnResetCraft);
  } else {
    craftBody.innerHTML = `
      <div class="crafting-status-box pristine">
        <div class="crafting-status-title">✨ <b>${isVi ? 'Trạng Thái Nguyên Bản (Pristine / No Craft History)' : 'Pristine State (No Craft History)'}</b></div>
        <div class="crafting-status-desc">${isVi ? 'Trang bị chưa có lịch sử rèn hoặc đã được reset sạch. Bạn có thể mang đến Thợ Rèn trong game để rèn lại tự do.' : 'This item has no blacksmith modification history. It can be freely crafted and upgraded in-game.'}</div>
      </div>
    `;
  }
  craftCard.appendChild(craftBody);
  leftCol.appendChild(craftCard);

  /* --- Copy Item --- */
  const copy = el('div', 'card');
  copy.appendChild(el('h3', '', 'Copy / Transfer Item'));
  const targets = [];
  app.state.files.forEach((f, fi) => {
    T.containerInfos(f.save).forEach(info => {
      if (T.freeSlot(info) < 0) return;
      targets.push({
        fi,
        info,
        label: info.label + ' (' + info.used + '/' + info.numSlots + ' slots)'
      });
    });
  });
  if (!targets.length) {
    copy.appendChild(el('div', 'hint small2', 'No container currently has a free slot.'));
  } else {
    const row = el('div', 'arow');
    const sel = el('select');
    sel.style.flex = '1';
    targets.forEach((t, i) => {
      const o = el('option', '', t.label);
      o.value = String(i);
      sel.appendChild(o);
    });
    row.appendChild(sel);
    const btn = el('button', 'btn', 'Duplicate Item Here');
    btn.onclick = () => {
      const t = targets[parseInt(sel.value)];
      const slotStruct = findSlotStruct(it, entry.fileIdx);
      if (!slotStruct) {
        log('Item slot not found.', true);
        return;
      }
      const n = T.copyItemTo(slotStruct, t.info);
      if (n < 0) {
        log('No free slot in ' + t.info.label + '.', true);
        return;
      }
      app.state.files[t.fi].items = T.listItems(app.state.files[t.fi].save);
      app.markFileDirty(t.fi);
      toast(`Copied ${hum.title} to ${t.info.label} (Slot ${n})`, 'succ');
      if (app.render) app.render();
    };
    row.appendChild(btn);
    copy.appendChild(row);
    copy.appendChild(el('div', 'hint small2', 'Generates a unique item GUID to prevent save conflicts.'));
  }
  leftCol.appendChild(copy);

  /* --- RPG Item Tooltip Preview --- */
  const previewBox = el('div', 'item-card-preview');
  renderLiveTooltip(previewBox, it);
  rightCol.appendChild(previewBox);

  layout.appendChild(leftCol);
  layout.appendChild(rightCol);
  box.appendChild(layout);
}

function renderLiveTooltip(box, it) {
  const hum = T.humanizeTQ2Item(it.handle.asset, it.handle.pkg, T.pval(it, 'm_Rarity') || '');
  const rar = (T.pval(it, 'm_Rarity') || '').split('::').pop() || 'Common';
  box.className = 'item-card-preview preview-' + rar;
  box.innerHTML = '';

  const hdr = el('div', 'preview-header');
  const title = el('div', 'preview-title', hum.title);
  const rarColors = { Magic: 'var(--r-magic)', Infrequent: 'var(--r-infreq)', Rare: 'var(--r-rare)', Epic: 'var(--r-epic)' };
  title.style.color = rarColors[rar] || 'var(--r-common)';
  hdr.appendChild(title);
  hdr.appendChild(el('div', 'preview-sub', rar + ' · ' + hum.subtitle));
  box.appendChild(hdr);

  const statsBox = el('div', 'preview-stats');
  const dMin = T.pval(it, 'm_DamageMin'), dMax = T.pval(it, 'm_DamageMax');
  if (dMin !== null || dMax !== null) {
    const row = el('div', 'preview-stat-row');
    row.appendChild(el('span', '', 'Physical Damage:'));
    row.appendChild(el('span', 'val', `${Math.round(dMin || 0)} – ${Math.round(dMax || 0)}`));
    statsBox.appendChild(row);
  }
  const arm = T.pval(it, 'm_Armor');
  if (arm !== null && arm > 0) {
    const row = el('div', 'preview-stat-row');
    row.appendChild(el('span', '', 'Armor Rating:'));
    row.appendChild(el('span', 'val', Math.round(arm)));
    statsBox.appendChild(row);
  }
  const stack = it.num ? it.num.v : null;
  if (stack !== null && stack > 1) {
    const row = el('div', 'preview-stat-row');
    row.appendChild(el('span', '', 'Stack Quantity:'));
    row.appendChild(el('span', 'val', stack));
    statsBox.appendChild(row);
  }
  if (statsBox.children.length) box.appendChild(statsBox);

  const af = T.affixes(it);
  if (af && af.items.length) {
    const afBox = el('div', 'preview-affixes');
    const CAT = app.state.CAT;
    af.items.forEach(a => {
      const p = T.affixField(a, 'pAffix');
      const path = p ? p.v : '';
      const kind = T.affixKind(path);
      const sName = T.affixShortName(path);
      const lvl = T.affixField(a, 'Level');
      const curTier = lvl ? lvl.v : 0;
      const metaObj = (CAT && CAT.names && CAT.names[path]) || {};
      const effs = T.affixEffects(a);

      if (effs.length > 0) {
        effs.forEach(e => {
          const ge = T.affixField(e, 'pSoftGameplayEffect');
          const gePath = ge && ge.v ? ge.v : '';
          const valNum = T.getEffectScale ? T.getEffectScale(e) : (T.affixField(e, 'Scale') ? T.affixField(e, 'Scale').v : 1);
          const valStr = Number.isInteger(valNum) ? String(valNum) : (Math.round(valNum * 100) / 100).toFixed(1);

          let effTier = curTier;
          const geTierMatch = gePath.match(/T(\d+)$/);
          if (geTierMatch) {
            effTier = parseInt(geTierMatch[1], 10) - 1;
          }

          let lineText = '';
          const tierDesc = (metaObj.tierTooltips && metaObj.tierTooltips[effTier]) || (metaObj.tierTooltips && Object.values(metaObj.tierTooltips)[effTier]);
          if (tierDesc) {
            lineText = tierDesc.replace(/\{value\}(\|fmt\([^)]*\))?/gi, (valNum >= 0 ? '+' : '') + valStr)
                               .replace(/\{Value\}(\|fmt\([^)]*\))?/gi, (valNum >= 0 ? '+' : '') + valStr);
          } else if (metaObj.tooltip && metaObj.tooltip !== '{Value}') {
            lineText = metaObj.tooltip.replace(/\{value\}(\|fmt\([^)]*\))?/gi, (valNum >= 0 ? '+' : '') + valStr)
                                       .replace(/\{Value\}(\|fmt\([^)]*\))?/gi, (valNum >= 0 ? '+' : '') + valStr);
          } else {
            const effName = T.humanizeEffectName(ge ? ge.v : '', sName);
            lineText = `+${valStr} ${effName}`;
          }

          const line = el('div', 'preview-affix-line line-' + kind);
          line.textContent = lineText;
          afBox.appendChild(line);
        });
      } else if (metaObj.tooltip) {
        const line = el('div', 'preview-affix-line line-' + kind);
        line.textContent = metaObj.tooltip;
        afBox.appendChild(line);
      }
    });
    box.appendChild(afBox);
  }

  const reqBox = el('div', 'preview-req');
  const reqLvl = T.pval(it, 'm_RequiredLevel') || T.pval(it, 'm_Level') || 1;
  reqBox.textContent = `Required Character Level: ${reqLvl}`;
  box.appendChild(reqBox);
}

function updateLiveTooltip() {
  const box = $('.item-card-preview');
  if (box && app.state.curItem) renderLiveTooltip(box, app.state.curItem.it);
}

function findSlotStruct(it, fileIdx) {
  if (fileIdx === undefined) fileIdx = 0;
  const targetSave = app.state.files[fileIdx] ? app.state.files[fileIdx].save : null;
  if (!targetSave) return null;
  for (const info of T.containerInfos(targetSave)) {
    for (const [, v] of info.map.pairs) {
      const hp = v.get && v.get('ItemHandle');
      if (hp && hp.value === it.handle) return v;
    }
  }
  return null;
}

function makeAffix(key) {
  const CAT = app.state.CAT;
  const info = CAT ? CAT.a[key] : null;
  if (!info) return null;
  const bytes = info.tb || Uint8Array.from(atob(info.t), c => c.charCodeAt(0));
  const node = G.parseAffixTemplate(bytes);

  // Guarantee every pSoftGameplayEffect has the required _C Blueprint class name and 3-string SoftObj format
  const effs = T.affixEffects(node);
  effs.forEach(e => {
    const geProp = e.body && e.body.get && e.body.get('pSoftGameplayEffect');
    if (geProp && geProp.value) {
      if (geProp.value instanceof G.SoftObj) {
        if (!geProp.value.asset || geProp.value.asset === 'None' || geProp.value.asset === '(none)') {
          const base = geProp.value.pkg.split('/').pop().split('.')[0];
          geProp.value.asset = base + '_C';
        }
        geProp.value.mark();
      }
    }
    const gePath = geProp && geProp.value ? (geProp.value.pkg || geProp.value.v || '') : '';
    const isDecimal = key.includes('Regen') || key.includes('Scaling') || gePath.includes('Regen') || gePath.includes('Scaling');
    if (isDecimal && T.setEffectScale) {
      const curScale = T.getEffectScale(e);
      T.setEffectScale(e, curScale, true);
    }
  });

  node.mark();
  return node;
}

function getTierRange(affixPath, gePath, curTier, maxTier) {
  const p = (affixPath || '').toLowerCase();
  const ge = (gePath || '').toLowerCase();

  maxTier = (maxTier !== undefined && maxTier !== null) ? maxTier : 10;
  curTier = (curTier !== undefined && curTier !== null) ? Math.max(0, Math.min(maxTier, curTier)) : maxTier;
  const tFrac = maxTier > 0 ? (curTier / maxTier) : 1;

  // Check verified overrides first
  const fullKey = affixPath + '|' + gePath;
  const verified = app.state.CAT && app.state.CAT.s && app.state.CAT.s[fullKey];
  if (verified && verified[0] !== verified[1]) {
    const minAll = verified[0];
    const maxAll = verified[1];
    const span = maxAll - minAll;
    const tMin = Math.round(minAll + span * (curTier / (maxTier + 1)));
    const tMax = Math.round(minAll + span * ((curTier + 1) / (maxTier + 1)));
    return [Math.min(tMin, maxAll), Math.min(Math.max(tMin, tMax), maxAll)];
  }

  // 1. Potion charges consumed (negative integer)
  if (p.includes('chargesconsumed') || ge.includes('chargesconsumed')) {
    const min = -1 - Math.round(tFrac * 2);
    const max = -1;
    return [Math.min(min, max), Math.max(min, max)];
  }

  // 2. Capacity / Skill / Passive Level (+1, +2)
  if (p.includes('capacity') || ge.includes('capacity') || p.includes('passivelevel') || ge.includes('passivelevel')) {
    if (maxTier === 0) return [1, 1];
    return [1, Math.min(3, 1 + Math.round(tFrac * 2))];
  }

  // 3. Attack Speed / Cast Speed / General Speed
  if (p.includes('attackspeed') || ge.includes('attackspeed') || p.includes('castspeed') || ge.includes('castspeed') || p.includes('perincreasedspeed') || ge.includes('perincreasedspeed') || p.includes('moreskillspeed') || ge.includes('moreskillspeed')) {
    const baseMin = 5 + tFrac * 12;
    const baseMax = 8 + tFrac * 15;
    return [Math.round(baseMin), Math.round(baseMax)];
  }

  // 4. Movement Speed
  if (p.includes('movementspeed') || ge.includes('movementspeed') || p.includes('movespeed') || ge.includes('movespeed')) {
    const baseMin = 4 + tFrac * 14;
    const baseMax = 6 + tFrac * 19;
    return [Math.round(baseMin), Math.round(baseMax)];
  }

  // 5. Cooldown Speed / Reduction
  if (p.includes('cooldown') || ge.includes('cooldown') || p.includes('dodgecdr') || ge.includes('dodgecdr') || p.includes('restorationrate') || ge.includes('restorationrate')) {
    const baseMin = 5 + tFrac * 21;
    const baseMax = 8 + tFrac * 27;
    return [Math.round(baseMin), Math.round(baseMax)];
  }

  // 6. Flat Crit Chance
  if (p.includes('flatcritchance') || ge.includes('flatcritchance') || p.includes('weaponcritchance') || ge.includes('weaponcritchance') || (p.includes('critchance') && !p.includes('perincreased'))) {
    const baseMin = 2 + tFrac * 11;
    const baseMax = 4 + tFrac * 14;
    return [Math.round(baseMin), Math.round(baseMax)];
  }

  // 7. Crit Damage Multiplier
  if (p.includes('critdmg') || ge.includes('critdmg') || p.includes('criticalhitdamage') || ge.includes('criticalhitdamage')) {
    const baseMin = 6 + tFrac * 29;
    const baseMax = 10 + tFrac * 40;
    return [Math.round(baseMin), Math.round(baseMax)];
  }

  // 8. Resistances
  if (p.includes('res') || ge.includes('res') || p.includes('resistance') || ge.includes('resistance')) {
    if (p.includes('max') || ge.includes('max')) {
      return [1, Math.min(5, 1 + Math.round(tFrac * 4))];
    }
    const baseMin = 5 + tFrac * 25;
    const baseMax = 8 + tFrac * 32;
    return [Math.round(baseMin), Math.round(baseMax)];
  }

  // 9. Primary Attributes (Might, Agility, Knowledge, Vigor)
  if (p.includes('might') || ge.includes('might') || p.includes('agility') || ge.includes('agility') || p.includes('knowledge') || ge.includes('knowledge') || p.includes('vigor') || ge.includes('vigor')) {
    const baseMin = 4 + tFrac * 46;
    const baseMax = 7 + tFrac * 53;
    return [Math.round(baseMin), Math.round(baseMax)];
  }

  // 10. Flat Health / Flat Energy
  if ((p.includes('health') || ge.includes('health') || p.includes('energy') || ge.includes('energy')) && !p.includes('perincreased') && !p.includes('regen') && !p.includes('cost') && !p.includes('reserved') && !p.includes('reservation')) {
    const baseMin = 20 + tFrac * 240;
    const baseMax = 35 + tFrac * 285;
    return [Math.round(baseMin), Math.round(baseMax)];
  }

  // 11. Energy / Health Regen
  if (p.includes('regen') || ge.includes('regen')) {
    const baseMin = 1 + tFrac * 21;
    const baseMax = 2 + tFrac * 28;
    return [Math.round(baseMin), Math.round(baseMax)];
  }

  // 12. Energy Reservation / Cost Reduction
  if (p.includes('energyreserved') || ge.includes('energyreserved') || p.includes('energycost') || ge.includes('energycost') || p.includes('freeenergyreservation') || ge.includes('freeenergyreservation')) {
    const baseMin = 10 + tFrac * 24;
    const baseMax = 15 + tFrac * 35;
    return [Math.round(baseMin), Math.round(baseMax)];
  }

  // 13. Retaliation Damage
  if (p.includes('retaliation') || ge.includes('retaliation')) {
    const baseMin = 30 + tFrac * 140;
    const baseMax = 45 + tFrac * 175;
    return [Math.round(baseMin), Math.round(baseMax)];
  }

  // 14. Glancing Hits / Deflect
  if (p.includes('glancing') || ge.includes('glancing') || p.includes('deflect') || ge.includes('deflect')) {
    const baseMin = 4 + tFrac * 18;
    const baseMax = 7 + tFrac * 23;
    return [Math.round(baseMin), Math.round(baseMax)];
  }

  // 15. % Damage Increase
  if (p.includes('damage') || ge.includes('damage') || p.includes('dmg') || ge.includes('dmg') || p.includes('power') || ge.includes('power') || p.includes('ailment') || ge.includes('ailment')) {
    if (maxTier <= 5) {
      const baseMin = 10 + tFrac * 42;
      const baseMax = 15 + tFrac * 50;
      return [Math.round(baseMin), Math.round(baseMax)];
    } else {
      const baseMin = 8 + tFrac * 87;
      const baseMax = 14 + tFrac * 101;
      return [Math.round(baseMin), Math.round(baseMax)];
    }
  }

  // Fallback
  if (maxTier === 0) return [1, 50];
  const baseMin = 5 + tFrac * 45;
  const baseMax = 10 + tFrac * 65;
  return [Math.round(baseMin), Math.round(baseMax)];
}

function renderAffix(it, arr, a, idx) {
  const p = T.affixField(a, 'pAffix');
  const path = p ? p.v : '';
  const slot = T.getItemSlotType ? T.getItemSlotType(it.handle ? it.handle.asset : '') : 'misc';
  const compat = T.checkAffixSlotCompatibility ? T.checkAffixSlotCompatibility(path, slot) : { compatible: true, reason: 'Universal' };
  const CAT = app.state.CAT;
  const metaObj = (CAT && CAT.names && CAT.names[path]) || {};

  const wrap = el('div', 'affix' + (!compat.compatible ? ' has-slot-conflict' : ''));
  const top = el('div', 'arow');

  const picker = app.createSearchableAffixSelect({
    currentPath: path,
    itemAsset: it.handle ? it.handle.asset : '',
    autoOpen: (autoOpenAffixIdx === idx),
    onSelect: (newKey) => {
      const node = makeAffix(newKey);
      const newKind = T.affixKind(newKey);
      const newCat = T.affixField(node, 'Category');
      const isUnique = it.handle && it.handle.asset && it.handle.asset.includes('_unique_');
      if (newCat) {
        if (newKind === 'Implicit') newCat.set('EGrimItemAffixCategory::Base');
        else if (newKind === 'Unique' || newKey.includes('/Unique/')) newCat.set('EGrimItemAffixCategory::Unique');
        else if (isUnique) newCat.set('EGrimItemAffixCategory::Implicit');
        else newCat.set('EGrimItemAffixCategory::Random');
      }
      const oldLvl = T.affixField(a, 'Level'), newLvl = T.affixField(node, 'Level');
      if (oldLvl && newLvl) newLvl.set(oldLvl.v);

      arr.items[idx] = node;
      arr.mark();
      app.markDirty();
      if (app.render) app.render();
      toast('Affix changed to ' + T.affixShortName(newKey), 'succ');
    }
  });
  if (autoOpenAffixIdx === idx) autoOpenAffixIdx = -1;
  top.appendChild(picker);

  const del = el('button', 'btn tiny ghost danger', '✕');
  del.title = 'Remove this affix slot';
  del.onclick = () => {
    arr.items.splice(idx, 1);
    arr.mark();
    app.markDirty();
    if (app.render) app.render();
    toast('Affix slot removed', 'info');
  };
  top.appendChild(del);
  wrap.appendChild(top);

  if (!path || path === 'None') {
    const errorBox = el('div', 'affix-slot-warn');
    errorBox.style.background = 'rgba(255, 68, 68, 0.2)';
    errorBox.style.borderColor = '#ff4444';
    errorBox.style.color = '#ff9999';
    errorBox.innerHTML = `❌ <b>Lỗi Slot Rỗng ("None"):</b> Slot này bị hỏng sẽ làm mất toàn bộ option của đồ trong game! `;
    const cleanBtn = el('button', 'btn tiny danger', '🗑️ Xoá Slot Rỗng Này');
    cleanBtn.onclick = () => {
      arr.items.splice(idx, 1);
      arr.mark();
      app.markDirty();
      if (app.render) app.render();
      toast('Đã xoá slot rỗng', 'succ');
    };
    errorBox.appendChild(cleanBtn);
    wrap.appendChild(errorBox);
  } else {
    if (!compat.compatible) {
      const warnBox = el('div', 'affix-slot-warn', `❌ Xung đột vị trí: ${compat.reason} (Game TQ2 sẽ tự động xoá dòng này khi nạp map)`);
      wrap.appendChild(warnBox);
    }
  }

  const meta = el('div', 'arow small');
  const cat = T.affixField(a, 'Category');
  if (cat) {
    meta.appendChild(app.selField('Category Slot', cat.v, app.CATEGORIES, v => {
      cat.set(v);
      app.markDirty();
      updateLiveTooltip();
    }));
  }

  meta.appendChild(el('span', 'badge-pill ' + (compat.compatible ? 'badge-ok' : 'badge-warn'),
    compat.compatible ? '✓ Phù hợp ' + T.getItemSlotLabel(slot).split('(')[0] : '❌ Xung đột vị trí'));

  const info = CAT && CAT.a ? CAT.a[path] : null;
  if (info && info.cs) {
    const okCat = info.cs.indexOf((cat ? cat.v : '').split('::').pop()) >= 0;
    const note = el('span', 'range' + (okCat ? '' : ' warnCat'),
      (okCat ? '✓ Valid in game as: ' : '⚠ In game occurs only as: ') + info.cs.join(', '));
    meta.appendChild(note);
  }

  const lvl = T.affixField(a, 'Level');
  const tiers = metaObj.tiers || (info && info.tiers) || {};
  const maxLvl = (info && info.maxLevel !== undefined) ? info.maxLevel : (metaObj.maxLevel !== undefined ? metaObj.maxLevel : 10);

  if (lvl) {
    if (lvl.v > maxLvl) lvl.set(maxLvl);
    if (lvl.v < 0) lvl.set(0);
    const tierWrap = el('label', 'fld');
    tierWrap.appendChild(el('span', 'lbl', `Affix Tier (Max ${maxLvl})`));
    const tierSel = el('select');
    for (let i = 0; i <= maxLvl; i++) {
      const tierDesc = (metaObj.tierTooltips && metaObj.tierTooltips[i]) || (metaObj.tierTooltips && Object.values(metaObj.tierTooltips)[i]);
      const tierTitle = T.affixTierTitle ? T.affixTierTitle(path, i) : (tiers[i] || '');
      let titleSuffix = '';
      if (tierDesc) {
        titleSuffix = ` — ${tierDesc.replace(/\{value\}(\|fmt\([^)]*\))?/g, '+1')}`;
      } else if (tierTitle) {
        titleSuffix = ` — "${tierTitle}"`;
      } else {
        titleSuffix = (i === 0 ? ' (Bậc 1 / Base)' : ` (Bậc ${i + 1})`);
      }
      const op = el('option', '', `Tier ${i}${titleSuffix}`);
      op.value = String(i);
      if (i === lvl.v) op.selected = true;
      tierSel.appendChild(op);
    }
    tierSel.onchange = () => {
      const newTier = parseInt(tierSel.value, 10) || 0;
      lvl.set(newTier);
      const effs = T.affixEffects(a);
      // Auto-clamp child effects to the new tier's range & update tiered mastery GameplayEffect ONLY if exactly 1 child effect
      if (effs.length === 1) {
        const e = effs[0];
        const ge = e.body && e.body.get && e.body.get('pSoftGameplayEffect');
        const scv = T.affixField(e, 'Scale');
        if (ge && ge.value) {
          let curGePath = ge.value.pkg || ge.value.v || '';
          if (path.includes('ActiveCapacity') || path.includes('PassiveLevel')) {
            const tNum = newTier + 1;
            if (curGePath.match(/_1_(ActiveCapacity|PassiveLevel)[A-Za-z]+(T\d)?$/)) {
              const baseGe = curGePath.replace(/T\d+$/, '');
              if (!baseGe.endsWith('Core')) {
                const newGePath = baseGe + 'T' + tNum;
                const newGeAsset = newGePath.split('/').pop() + '_C';
                if (ge.value && typeof ge.value === 'object' && ge.value.pkg !== undefined) {
                  ge.value.pkg = newGePath;
                  ge.value.asset = newGeAsset;
                  if (typeof ge.value.mark === 'function') ge.value.mark();
                } else if (typeof ge.value.set === 'function') {
                  ge.value.set(newGePath);
                }
              }
            }
          }
          const geStr = ge.value.pkg || ge.value.v || '';
          const tr = getTierRange(path, geStr, newTier, maxLvl);
          if (tr && scv) {
            if (scv.v > tr[1]) scv.set(tr[1]);
            else if (scv.v < tr[0]) scv.set(tr[0]);
          }
        }
      }
      app.markDirty();
      if (app.render) app.render();
      updateLiveTooltip();
      const chosenTitle = T.affixTierTitle ? T.affixTierTitle(path, newTier) : (tiers[newTier] || '');
      toast(`Đã chọn Danh xưng: Tier ${newTier}${chosenTitle ? ` ("${chosenTitle}")` : ''}`, 'info');
    };
    tierWrap.appendChild(tierSel);
    meta.appendChild(tierWrap);
  }

  wrap.appendChild(meta);

  function cloneEffectNode(sample) {
    const w = new G.W();
    sample.ser(w);
    const bytes = w.done();
    const tn = new G.TN('StructProperty', [new G.TN('GrimItemAffixEffectInstanceSaveData')]);
    return G.readSized(new G.Reader(bytes), tn, { errors: [] });
  }

  function setEffectGe(effNode, newGePath) {
    const geProp = effNode.body && effNode.body.get && effNode.body.get('pSoftGameplayEffect');
    if (geProp && geProp.value) {
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

  T.affixEffects(a).forEach(e => {
    const ge = T.affixField(e, 'pSoftGameplayEffect');
    const gePath = ge && ge.v ? ge.v : '';
    const row = el('div', 'arow effect');
    const curTier = lvl ? lvl.v : (maxLvl || 0);
    let effTier = curTier;
    const geTierMatch = gePath.match(/T(\d+)$/);
    if (geTierMatch) {
      effTier = parseInt(geTierMatch[1], 10) - 1;
    }
    const tierDesc = (metaObj.tierTooltips && metaObj.tierTooltips[effTier]) || (metaObj.tierTooltips && Object.values(metaObj.tierTooltips)[effTier]);
    const fallbackName = T.humanizeEffectName(gePath, T.affixShortName(path));
    const effName = tierDesc ? tierDesc.replace(/\{value\}(\|fmt\([^)]*\))?/gi, '').replace(/\{Value\}(\|fmt\([^)]*\))?/gi, '').trim() : fallbackName;

    // Check if this effect is a tiered mastery effect (ActiveCapacity / PassiveLevel)
    const isTieredMasteryEffect = gePath.match(/^(.*_1_(?:ActiveCapacity|PassiveLevel)[A-Za-z]+)(?:T(\d+))?$/);
    const isTieredResEffect = gePath.match(/^(.*_)(\d+)(_PerRes[A-Za-z]+)$/);

    if (isTieredMasteryEffect && !isTieredMasteryEffect[1].endsWith('Core')) {
      const baseGe = isTieredMasteryEffect[1];
      const curEffTierNum = isTieredMasteryEffect[2] ? parseInt(isTieredMasteryEffect[2], 10) : (effTier + 1);

      const tierSelWrap = el('div', 'effect-tier-picker');
      tierSelWrap.style.display = 'inline-flex';
      tierSelWrap.style.alignItems = 'center';
      tierSelWrap.style.gap = '6px';
      tierSelWrap.style.flex = '1';

      const tSelect = el('select', 'txt tiny');
      tSelect.style.fontWeight = '600';
      tSelect.style.color = 'var(--gold-primary)';
      tSelect.style.maxWidth = '340px';
      for (let t = 1; t <= 6; t++) {
        const tDesc = (metaObj.tierTooltips && metaObj.tierTooltips[t - 1]) || `Bậc ${t} (Tier ${t})`;
        const cleanTDesc = tDesc.replace(/\{value\}(\|fmt\([^)]*\))?/gi, '').replace(/\{Value\}(\|fmt\([^)]*\))?/gi, '').trim();
        const opt = el('option', '', cleanTDesc ? `${cleanTDesc} (T${t})` : `Bậc ${t} (Tier ${t})`);
        opt.value = String(t);
        if (t === curEffTierNum) opt.selected = true;
        tSelect.appendChild(opt);
      }
      tSelect.onchange = () => {
        const chosenT = parseInt(tSelect.value, 10) || 1;
        setEffectGe(e, baseGe + 'T' + chosenT);
        app.markDirty();
        if (app.render) app.render();
        updateLiveTooltip();
        toast(`Đã chuyển sang Bậc ${chosenT}`, 'succ');
      };
      tierSelWrap.appendChild(tSelect);
      row.appendChild(tierSelWrap);
    } else if (isTieredResEffect) {
      const prefixBase = isTieredResEffect[1];
      const curResTier = parseInt(isTieredResEffect[2], 10);
      const suffixBase = isTieredResEffect[3];

      const tierSelWrap = el('div', 'effect-tier-picker');
      tierSelWrap.style.display = 'inline-flex';
      tierSelWrap.style.alignItems = 'center';
      tierSelWrap.style.gap = '6px';
      tierSelWrap.style.flex = '1';

      const tSelect = el('select', 'txt tiny');
      tSelect.style.fontWeight = '600';
      tSelect.style.color = 'var(--gold-primary)';
      tSelect.style.maxWidth = '340px';
      for (let t = 1; t <= 5; t++) {
        const opt = el('option', '', `${effName.replace(/\(Tier \d\)/i, '').trim()} (Tier ${t})`);
        opt.value = String(t);
        if (t === curResTier) opt.selected = true;
        tSelect.appendChild(opt);
      }
      tSelect.onchange = () => {
        const chosenT = parseInt(tSelect.value, 10) || 1;
        setEffectGe(e, prefixBase + chosenT + suffixBase);
        app.markDirty();
        if (app.render) app.render();
        updateLiveTooltip();
        toast(`Đã chuyển sang Tier ${chosenT}`, 'succ');
      };
      tierSelWrap.appendChild(tSelect);
      row.appendChild(tierSelWrap);
    } else {
      row.appendChild(el('span', 'ge', effName));
    }

    const valNum = T.getEffectScale ? T.getEffectScale(e) : (T.affixField(e, 'Scale') ? T.affixField(e, 'Scale').v : 1);
    const isDecimalEff = (path && (path.includes('Regen') || path.includes('Scaling') || path.includes('Decimal'))) ||
                         (gePath && (gePath.includes('Regen') || gePath.includes('Scaling') || gePath.includes('Decimal'))) ||
                         !Number.isInteger(valNum);
    const stepVal = isDecimalEff ? 0.1 : (gePath && gePath.includes('chargesconsumed') ? 1 : 0.5);
    const tr = ge ? getTierRange(path, gePath, effTier, maxLvl) : null;
    
    const f = app.numField('Value', valNum, v => {
      if (T.setEffectScale) T.setEffectScale(e, v, isDecimalEff);
      else {
        const scv = T.affixField(e, 'Scale');
        if (scv) scv.set(v);
      }
      app.markDirty();
      updateLiveTooltip();
    }, stepVal);
    row.appendChild(f);

    if (tr) {
      row.appendChild(el('span', 'range', `Safe Max: [${tr[0]} – ${tr[1]}]`));
      const mx = el('button', 'btn tiny', 'Max');
      mx.onclick = () => {
        if (T.setEffectScale) T.setEffectScale(e, tr[1], isDecimalEff);
        else {
          const scv = T.affixField(e, 'Scale');
          if (scv) scv.set(tr[1]);
        }
        app.markDirty();
        if (app.render) app.render();
        toast(`Rolled Tier ${effTier} to safe maximum: ${tr[1]}`, 'succ');
      };
      row.appendChild(mx);
    }

    const effsList = T.affixEffects(a);
    if (effsList.length > 1) {
      const delEff = el('button', 'btn tiny ghost danger', '✕');
      delEff.title = 'Xoá hàng hiệu ứng con này';
      delEff.onclick = () => {
        const effArrProp = a.body && a.body.get && a.body.get('AffixEffectInstances');
        if (effArrProp && effArrProp.value && effArrProp.value.items) {
          const idxToRemove = effArrProp.value.items.indexOf(e);
          if (idxToRemove >= 0) {
            effArrProp.value.items.splice(idxToRemove, 1);
            effArrProp.value.mark();
            a.mark();
            app.markDirty();
            if (app.render) app.render();
            toast('Đã xoá dòng hiệu ứng con', 'info');
          }
        }
      };
      row.appendChild(delEff);
    }

    wrap.appendChild(row);
  });

  // Action bar for adding Sub-Effects / Mastery Tiers / Combos
  const actionRow = el('div', 'affix-sub-actions');
  actionRow.style.display = 'flex';
  actionRow.style.flexWrap = 'wrap';
  actionRow.style.alignItems = 'center';
  actionRow.style.gap = '8px';
  actionRow.style.marginTop = '8px';
  actionRow.style.padding = '8px 10px';
  actionRow.style.background = 'rgba(0,0,0,0.2)';
  actionRow.style.borderRadius = 'var(--radius-sm)';
  actionRow.style.border = '1px dashed var(--border-subtle)';

  // 1. Searchable Sub-Affix Picker (Allows adding ANY stat/affix from entire catalog)
  if (app.createSearchableSubAffixSelect) {
    const subPicker = app.createSearchableSubAffixSelect({
      itemAsset: it.handle ? it.handle.asset : '',
      buttonText: '➕ Tìm & Gộp Suffix / Prefix bất kỳ...',
      buttonClass: 'btn tiny ghost primary',
      onSelect: (selectedItem) => {
        const effArrProp = a.body && a.body.get && a.body.get('AffixEffectInstances');
        if (!effArrProp || !effArrProp.value || !effArrProp.value.items || effArrProp.value.items.length === 0) return;
        const sample = effArrProp.value.items[0];
        const newEff = cloneEffectNode(sample);
        
        const targetGe = (selectedItem.ges && selectedItem.ges[0]) || (app.state.CAT.a[selectedItem.key] && app.state.CAT.a[selectedItem.key].g && app.state.CAT.a[selectedItem.key].g[0]) || '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_Might';
        setEffectGe(newEff, targetGe);

        const isSkillScale = selectedItem.key.includes('PointsTo') || selectedItem.key.includes('Capacity') || selectedItem.key.includes('PassiveLevel') || targetGe.includes('Capacity') || targetGe.includes('PassiveLevel');
        const isDecimalScale = selectedItem.key.includes('Regen') || selectedItem.key.includes('Scaling') || targetGe.includes('Regen') || targetGe.includes('Scaling');
        
        const tr = getTierRange(selectedItem.key, targetGe, selectedItem.maxLevel || 5, selectedItem.maxLevel || 5);
        const defaultVal = tr ? tr[1] : (isSkillScale ? 1.0 : (isDecimalScale ? 2.5 : 20.0));

        if (T.setEffectScale) {
          T.setEffectScale(newEff, defaultVal, isDecimalScale);
        } else {
          const scv = T.affixField(newEff, 'Scale');
          if (scv) scv.set(defaultVal);
        }

        effArrProp.value.items.push(newEff);
        effArrProp.value.mark();
        a.mark();
        app.markDirty();
        if (app.render) app.render();
        updateLiveTooltip();
        toast(`Đã gộp thêm "${selectedItem.localTitle || selectedItem.name}" vào dòng này!`, 'succ');
      }
    });
    actionRow.appendChild(subPicker);
  }

  const isMasteryTiered = path.includes('ActiveCapacity') || path.includes('PassiveLevel');
  if (isMasteryTiered) {
    const addTierBtn = el('button', 'btn tiny ghost', '➕ Thêm Bậc (+ Tier)');
    addTierBtn.onclick = () => {
      const effArrProp = a.body && a.body.get && a.body.get('AffixEffectInstances');
      if (!effArrProp || !effArrProp.value || !effArrProp.value.items || effArrProp.value.items.length === 0) return;
      const existingEffs = effArrProp.value.items;
      const sample = existingEffs[0];
      const newEff = cloneEffectNode(sample);
      
      const geProp = sample.body && sample.body.get && sample.body.get('pSoftGameplayEffect');
      const curGe = geProp && geProp.value ? (geProp.value.pkg || geProp.value.v || '') : '';
      const baseMatch = curGe.match(/^(.*_1_(?:ActiveCapacity|PassiveLevel)[A-Za-z]+)(?:T\d+)?$/);
      if (baseMatch) {
        const baseGe = baseMatch[1];
        const usedTiers = new Set();
        existingEffs.forEach(ef => {
          const g = T.affixField(ef, 'pSoftGameplayEffect');
          const str = g ? (g.v || '') : '';
          const tm = str.match(/T(\d+)$/);
          if (tm) usedTiers.add(parseInt(tm[1], 10));
        });
        let nextTier = 1;
        for (let t = 1; t <= 6; t++) {
          if (!usedTiers.has(t)) {
            nextTier = t;
            break;
          }
        }
        setEffectGe(newEff, baseGe + 'T' + nextTier);
        const lvlProp = a.body && a.body.get && a.body.get('Level');
        if (lvlProp && lvlProp.value) lvlProp.value.set(Math.max(lvlProp.value.v, nextTier - 1));
      }
      existingEffs.push(newEff);
      effArrProp.value.mark();
      a.mark();
      app.markDirty();
      if (app.render) app.render();
      toast('Đã thêm Bậc kỹ năng vào dòng này', 'succ');
    };
    actionRow.appendChild(addTierBtn);

    const combo3Btn = el('button', 'btn tiny ghost', '⚡ Gộp T1–T3');
    combo3Btn.onclick = () => {
      const effArrProp = a.body && a.body.get && a.body.get('AffixEffectInstances');
      if (!effArrProp || !effArrProp.value || !effArrProp.value.items || effArrProp.value.items.length === 0) return;
      const sample = effArrProp.value.items[0];
      const geProp = sample.body && sample.body.get && sample.body.get('pSoftGameplayEffect');
      const curGe = geProp && geProp.value ? (geProp.value.pkg || geProp.value.v || '') : '';
      const baseMatch = curGe.match(/^(.*_1_(?:ActiveCapacity|PassiveLevel)[A-Za-z]+)(?:T\d+)?$/);
      if (!baseMatch) return;
      const baseGe = baseMatch[1];
      const currentScale = T.getEffectScale ? T.getEffectScale(sample) : (T.affixField(sample, 'Scale') ? T.affixField(sample, 'Scale').v : 10);

      const newEffList = [1, 2, 3].map(tNum => {
        const ef = cloneEffectNode(sample);
        setEffectGe(ef, baseGe + 'T' + tNum);
        if (T.setEffectScale) T.setEffectScale(ef, currentScale);
        return ef;
      });

      effArrProp.value.items = newEffList;
      effArrProp.value.mark();
      const lvlProp = a.body && a.body.get && a.body.get('Level');
      if (lvlProp && lvlProp.value) lvlProp.value.set(Math.max(lvlProp.value.v, 2));
      a.mark();
      app.markDirty();
      if (app.render) app.render();
      toast('Đã gộp đầy đủ Bậc 1, 2, 3 vào dòng này', 'succ');
    };
    actionRow.appendChild(combo3Btn);

    const combo5Btn = el('button', 'btn tiny ghost', '⚡ Gộp T1–T5 Full Combo');
    combo5Btn.title = 'Tạo đầy đủ 5 bậc kỹ năng từ Bậc 1 đến Bậc 5';
    combo5Btn.onclick = () => {
      const effArrProp = a.body && a.body.get && a.body.get('AffixEffectInstances');
      if (!effArrProp || !effArrProp.value || !effArrProp.value.items || effArrProp.value.items.length === 0) return;
      const sample = effArrProp.value.items[0];
      const geProp = sample.body && sample.body.get && sample.body.get('pSoftGameplayEffect');
      const curGe = geProp && geProp.value ? (geProp.value.pkg || geProp.value.v || '') : '';
      const baseMatch = curGe.match(/^(.*_1_(?:ActiveCapacity|PassiveLevel)[A-Za-z]+)(?:T\d+)?$/);
      if (!baseMatch) return;
      const baseGe = baseMatch[1];
      const currentScale = T.getEffectScale ? T.getEffectScale(sample) : (T.affixField(sample, 'Scale') ? T.affixField(sample, 'Scale').v : 10);

      const newEffList = [1, 2, 3, 4, 5].map(tNum => {
        const ef = cloneEffectNode(sample);
        setEffectGe(ef, baseGe + 'T' + tNum);
        if (T.setEffectScale) T.setEffectScale(ef, currentScale);
        return ef;
      });

      effArrProp.value.items = newEffList;
      effArrProp.value.mark();
      const lvlProp = a.body && a.body.get && a.body.get('Level');
      if (lvlProp && lvlProp.value) lvlProp.value.set(4);
      a.mark();
      app.markDirty();
      if (app.render) app.render();
      toast('Đã tạo trọn bộ Bậc 1, 2, 3, 4, 5 vào dòng này!', 'succ');
    };
    actionRow.appendChild(combo5Btn);
  }

  // Quick Preset Combo buttons for current affix slot
  const quickAttrsBtn = el('button', 'btn tiny ghost', '🌟 +4 Thuộc Tính');
  quickAttrsBtn.title = 'Gộp thêm Sức mạnh, Nhanh nhẹn, Trí tuệ, Sinh lực vào dòng này';
  quickAttrsBtn.onclick = () => {
    const effArrProp = a.body && a.body.get && a.body.get('AffixEffectInstances');
    if (!effArrProp || !effArrProp.value || !effArrProp.value.items || effArrProp.value.items.length === 0) return;
    const sample = effArrProp.value.items[0];
    const attrs = [
      { ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_Might', scale: 55 },
      { ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_Agility', scale: 55 },
      { ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_Knowledge', scale: 55 },
      { ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_Vigor', scale: 55 }
    ];
    attrs.forEach(at => {
      const ef = cloneEffectNode(sample);
      setEffectGe(ef, at.ge);
      if (T.setEffectScale) T.setEffectScale(ef, at.scale);
      effArrProp.value.items.push(ef);
    });
    effArrProp.value.mark();
    a.mark();
    app.markDirty();
    if (app.render) app.render();
    toast('Đã gộp thêm 4 Thuộc Tính (+Might, +Agility, +Knowledge, +Vigor)!', 'succ');
  };
  actionRow.appendChild(quickAttrsBtn);

  const quickResBtn = el('button', 'btn tiny ghost', '🛡️ +5 Kháng');
  quickResBtn.title = 'Gộp thêm Kháng Lửa, Băng, Sét, Độc, Vật lý vào dòng này';
  quickResBtn.onclick = () => {
    const effArrProp = a.body && a.body.get && a.body.get('AffixEffectInstances');
    if (!effArrProp || !effArrProp.value || !effArrProp.value.items || effArrProp.value.items.length === 0) return;
    const sample = effArrProp.value.items[0];
    const resList = [
      { ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerResFire', scale: 32 },
      { ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerResCold', scale: 32 },
      { ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerResLightning', scale: 32 },
      { ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerResPoison', scale: 32 },
      { ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerResPhysical', scale: 32 }
    ];
    resList.forEach(r => {
      const ef = cloneEffectNode(sample);
      setEffectGe(ef, r.ge);
      if (T.setEffectScale) T.setEffectScale(ef, r.scale);
      effArrProp.value.items.push(ef);
    });
    effArrProp.value.mark();
    a.mark();
    app.markDirty();
    if (app.render) app.render();
    toast('Đã gộp thêm 5 loại Kháng vào dòng này!', 'succ');
  };
  actionRow.appendChild(quickResBtn);

  wrap.appendChild(actionRow);

  return wrap;
}

function applyAffixPreset(it, af, presetId) {
  const isUnique = it.handle && it.handle.asset && it.handle.asset.includes('_unique_');
  const targetCat = isUnique ? 'Implicit' : 'Random';

  const PRESET_DATA = {
    forge_full: {
      name: 'Combo Kỹ Năng Lò Rèn (T1~T5)',
      affixes: [
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_ActiveCapacityForge.da_suffix_1_ActiveCapacityForge',
          effects: [1, 2, 3, 4, 5].map(t => ({ ge: `/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_ActiveCapacityForgeT${t}`, scale: 10 }))
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_PassiveLevelForge.da_suffix_1_PassiveLevelForge',
          effects: [1, 2, 3, 4, 5].map(t => ({ ge: `/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PassiveLevelForgeT${t}`, scale: 10 }))
        }
      ]
    },
    spirit_full: {
      name: 'Combo Kỹ Năng Linh Hồn (T1~T5)',
      affixes: [
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_ActiveCapacitySpirit.da_suffix_1_ActiveCapacitySpirit',
          effects: [1, 2, 3, 4, 5].map(t => ({ ge: `/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_ActiveCapacitySpiritT${t}`, scale: 10 }))
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_PassiveLevelSpirit.da_suffix_1_PassiveLevelSpirit',
          effects: [1, 2, 3, 4, 5].map(t => ({ ge: `/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PassiveLevelSpiritT${t}`, scale: 10 }))
        }
      ]
    },
    warfare_full: {
      name: 'Combo Kỹ Năng Chiến Trận (T1~T5)',
      affixes: [
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_ActiveCapacityWarfare.da_suffix_1_ActiveCapacityWarfare',
          effects: [1, 2, 3, 4, 5].map(t => ({ ge: `/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_ActiveCapacityWarfareT${t}`, scale: 10 }))
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_PassiveLevelWarfare.da_suffix_1_PassiveLevelWarfare',
          effects: [1, 2, 3, 4, 5].map(t => ({ ge: `/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PassiveLevelWarfareT${t}`, scale: 10 }))
        }
      ]
    },
    earth_full: {
      name: 'Combo Kỹ Năng Đất (T1~T5)',
      affixes: [
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_ActiveCapacityEarth.da_suffix_1_ActiveCapacityEarth',
          effects: [1, 2, 3, 4, 5].map(t => ({ ge: `/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_ActiveCapacityEarthT${t}`, scale: 10 }))
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_PassiveLevelEarth.da_suffix_1_PassiveLevelEarth',
          effects: [1, 2, 3, 4, 5].map(t => ({ ge: `/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PassiveLevelEarthT${t}`, scale: 10 }))
        }
      ]
    },
    storm_full: {
      name: 'Combo Kỹ Năng Bão Tố (T1~T5)',
      affixes: [
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_ActiveCapacityStorm.da_suffix_1_ActiveCapacityStorm',
          effects: [1, 2, 3, 4, 5].map(t => ({ ge: `/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_ActiveCapacityStormT${t}`, scale: 10 }))
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_PassiveLevelStorm.da_suffix_1_PassiveLevelStorm',
          effects: [1, 2, 3, 4, 5].map(t => ({ ge: `/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PassiveLevelStormT${t}`, scale: 10 }))
        }
      ]
    },
    rogue_full: {
      name: 'Combo Kỹ Năng Thích Khách (T1~T5)',
      affixes: [
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_ActiveCapacityRogue.da_suffix_1_ActiveCapacityRogue',
          effects: [1, 2, 3, 4, 5].map(t => ({ ge: `/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_ActiveCapacityRogueT${t}`, scale: 10 }))
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_PassiveLevelRogue.da_suffix_1_PassiveLevelRogue',
          effects: [1, 2, 3, 4, 5].map(t => ({ ge: `/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PassiveLevelRogueT${t}`, scale: 10 }))
        }
      ]
    },
    all_attrs: {
      name: 'Combo Tứ Đại Thuộc Tính (Might/Agility/Knowledge/Vigor)',
      affixes: [
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_Might.da_suffix_1_Might',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_Might', scale: 55 }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_Agility.da_suffix_1_Agility',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_Agility', scale: 55 }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_Knowledge.da_suffix_1_Knowledge',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_Knowledge', scale: 55 }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_Vigor.da_suffix_1_Vigor',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_Vigor', scale: 55 }]
        }
      ]
    },
    all_res: {
      name: 'Combo Ngũ Đại Kháng (Kháng Toàn Phần)',
      affixes: [
        {
          key: '/Game/TQ2/Items/Affixes/Prefixes/da_prefix_1_PerFireRes.da_prefix_1_PerFireRes',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerResFire', scale: 32 }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Prefixes/da_prefix_1_PerColdRes.da_prefix_1_PerColdRes',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerResCold', scale: 32 }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Prefixes/da_prefix_1_PerLightningRes.da_prefix_1_PerLightningRes',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerResLightning', scale: 32 }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Prefixes/da_prefix_1_PerPoisonRes.da_prefix_1_PerPoisonRes',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerResPoison', scale: 32 }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Prefixes/da_prefix_1_PerStunRes.da_prefix_1_PerStunRes',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerResStun', scale: 32 }]
        }
      ]
    },
    speed_crit: {
      name: 'Combo Tốc Độ & Chí Mạng',
      affixes: [
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_PerIncreasedAttackSpeed.da_suffix_1_PerIncreasedAttackSpeed',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerIncreasedAttackSpeed', scale: 23 }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_PerIncreasedCastSpeed.da_suffix_1_PerIncreasedCastSpeed',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerIncreasedCastSpeed', scale: 23 }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_PerIncreasedMovementSpeed.da_suffix_1_PerIncreasedMovementSpeed',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_PerIncreasedMovementSpeed', scale: 25 }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_FlatCritChance.da_suffix_1_FlatCritChance',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_FlatCritChance', scale: 18 }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_IncrCritDmgMultiplier.da_suffix_1_IncrCritDmgMultiplier',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_IncrCritDmgMultiplier', scale: 50 }]
        }
      ]
    },
    energy_barrier: {
      name: 'Combo Năng Lượng & Khiên Bảo Vệ',
      affixes: [
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_Energy.da_suffix_1_Energy',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_Energy', scale: 285 }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Prefixes/da_prefix_1_FlatEnergyRegen.da_prefix_1_FlatEnergyRegen',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_+EnergyRegenPerSecond', scale: 28, isDecimal: true }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_EnergyBarrier.da_suffix_1_EnergyBarrier',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/Implicits/bp_ge_implicit_1_EnergyBarrier', scale: 100 }]
        },
        {
          key: '/Game/TQ2/Items/Affixes/Suffixes/da_suffix_1_FreeEnergyReservation.da_suffix_1_FreeEnergyReservation',
          effects: [{ ge: '/Game/TQ2/Items/Affixes/GameplayEffects/bp_ge_affix_1_LessEnergyReserved', scale: 50 }]
        }
      ]
    }
  };

  const pDef = PRESET_DATA[presetId];
  if (!pDef) return;

  pDef.affixes.forEach(aDef => {
    const node = makeAffix(aDef.key);
    if (!node) return;
    const cf = T.affixField(node, 'Category');
    if (cf) cf.set('EGrimItemAffixCategory::' + targetCat);

    const effArrProp = node.body && node.body.get && node.body.get('AffixEffectInstances');
    if (effArrProp && effArrProp.value && effArrProp.value.items) {
      const sample = effArrProp.value.items[0];
      const newItems = [];
      aDef.effects.forEach(eDef => {
        const w = new G.W();
        sample.ser(w);
        const bytes = w.done();
        const tn = new G.TN('StructProperty', [new G.TN('GrimItemAffixEffectInstanceSaveData')]);
        const effNode = G.readSized(new G.Reader(bytes), tn, { errors: [] });
        
        const geProp = effNode.body && effNode.body.get && effNode.body.get('pSoftGameplayEffect');
        if (geProp && geProp.value) {
          const gePath = eDef.ge;
          const geAsset = gePath.split('/').pop() + '_C';
          if (typeof geProp.value === 'object' && geProp.value.pkg !== undefined) {
            geProp.value.pkg = gePath;
            geProp.value.asset = geAsset;
            geProp.value.mark();
          } else if (typeof geProp.value.set === 'function') {
            geProp.value.set(gePath);
          }
        }
        
        const isDecimal = eDef.isDecimal || eDef.ge.includes('Regen') || eDef.ge.includes('Scaling');
        if (T.setEffectScale) {
          T.setEffectScale(effNode, eDef.scale, isDecimal);
        } else {
          const scv = T.affixField(effNode, 'Scale');
          if (scv) scv.set(eDef.scale);
        }
        newItems.push(effNode);
      });
      effArrProp.value.items = newItems;
      effArrProp.value.mark();
    }
    
    const lvlField = T.affixField(node, 'Level');
    if (lvlField) {
      let maxT = 0;
      aDef.effects.forEach(cur => {
        const match = cur.ge && cur.ge.match(/T(\d+)$/);
        if (match) maxT = Math.max(maxT, parseInt(match[1], 10));
      });
      if (maxT > 0) {
        lvlField.set(Math.max(lvlField.v || 0, maxT - 1));
      }
    }

    node.mark();
    af.items.push(node);
  });

  af.mark();
  app.markDirty();
  if (app.render) app.render();
  toast(`Đã nạp thành công ${pDef.name}!`, 'succ');
}

function showBundlePresetModal(it, af) {
  const existing = $('.modal-overlay');
  if (existing) existing.remove();

  const overlay = el('div', 'modal-overlay');
  const box = el('div', 'modal-box');
  box.style.maxWidth = '620px';

  box.appendChild(el('h3', '', '📦 Thêm Gói Gộp Đa Chỉ Số (Multi-Stat Bundles)'));
  box.appendChild(el('div', 'm-sub', 'Chọn một gói combo cấu hình sẵn hoặc tạo slot gộp trống để tự do gộp mọi dòng từ catalog:'));

  const grid = el('div', 'guide-grid');
  grid.style.marginBottom = '16px';

  const BUNDLE_OPTIONS = [
    { id: 'forge_full', title: '🔨 Kỹ Năng Lò Rèn', desc: 'Bậc 1~5 Kỹ năng Chủ động & Bị động (+10 mỗi bậc)' },
    { id: 'spirit_full', title: '👻 Kỹ Năng Linh Hồn', desc: 'Bậc 1~5 Kỹ năng Chủ động & Bị động (+10 mỗi bậc)' },
    { id: 'warfare_full', title: '⚔️ Kỹ Năng Chiến Trận', desc: 'Bậc 1~5 Kỹ năng Chủ động & Bị động (+10 mỗi bậc)' },
    { id: 'earth_full', title: '🌍 Kỹ Năng Đất', desc: 'Bậc 1~5 Kỹ năng Chủ động & Bị động (+10 mỗi bậc)' },
    { id: 'storm_full', title: '⚡ Kỹ Năng Bão Tố', desc: 'Bậc 1~5 Kỹ năng Chủ động & Bị động (+10 mỗi bậc)' },
    { id: 'rogue_full', title: '🗡️ Kỹ Năng Thích Khách', desc: 'Bậc 1~5 Kỹ năng Chủ động & Bị động (+10 mỗi bậc)' },
    { id: 'all_attrs', title: '🌟 Tứ Đại Thuộc Tính', desc: '+55 Sức mạnh, +55 Nhanh nhẹn, +55 Trí tuệ, +55 Sinh lực' },
    { id: 'all_res', title: '🛡️ Ngũ Đại Kháng', desc: '+32% Kháng Lửa, Băng, Sét, Độc và Vật lý' },
    { id: 'speed_crit', title: '💥 Sát Thương & Tốc Độ', desc: '+23% Tốc đánh/niệm, +25% Chạy, +18% Chí mạng, +50% ST Chí mạng' },
    { id: 'energy_barrier', title: '✨ Hồi Phục & Khiên', desc: '+285 Năng lượng, +28 Hồi Mana/s, +100 Khiên, -50% Tiêu hao' },
    { id: 'custom_empty', title: '➕ Slot Gộp Trống (Tự do)', desc: 'Tạo 1 slot mở để tự do tìm kiếm & gộp các chỉ số bất kỳ' }
  ];

  BUNDLE_OPTIONS.forEach(opt => {
    const card = el('div', 'guide-card');
    card.style.cursor = 'pointer';
    card.style.padding = '12px';
    card.innerHTML = `
      <h4 style="margin:0 0 4px; font-size:13px;">${opt.title}</h4>
      <p style="margin:0; font-size:11.5px; color:var(--text-muted); line-height:1.4;">${opt.desc}</p>
    `;
    card.onclick = () => {
      overlay.remove();
      if (opt.id === 'custom_empty') {
        const slotType = T.getItemSlotType(it.handle ? it.handle.asset : '');
        const bestKey = (app.state.CAT && app.state.CAT.keys) ? (app.state.CAT.keys.find(k => {
          const comp = T.checkAffixSlotCompatibility(k, slotType);
          return comp.compatible && (app.state.CAT.names && app.state.CAT.names[k] && app.state.CAT.names[k].authentic);
        }) || app.state.CAT.keys[0]) : '';
        const newNode = makeAffix(bestKey);
        autoOpenAffixIdx = af.items.length;
        af.items.push(newNode);
        af.mark();
        app.markDirty();
        if (app.render) app.render();
        toast('Đã tạo slot gộp mới – hãy dùng nút "➕ Tìm & Gộp" để thêm các dòng con', 'succ');
      } else {
        applyAffixPreset(it, af, opt.id);
      }
    };
    grid.appendChild(card);
  });

  box.appendChild(grid);

  const actions = el('div', 'modal-actions');
  const cancelBtn = el('button', 'btn ghost tiny', 'Đóng');
  cancelBtn.onclick = () => overlay.remove();
  actions.appendChild(cancelBtn);
  box.appendChild(actions);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function confirmResetAllBlacksmith() {
  const existing = $('.modal-overlay');
  if (existing) existing.remove();

  const overlay = el('div', 'modal-overlay');
  const box = el('div', 'modal-box');
  box.style.maxWidth = '480px';

  box.appendChild(el('h3', '', '🔨 Reset Lịch Sử Thợ Rèn Cho Tất Cả Đồ?'));
  box.appendChild(el('div', 'm-sub', 'Thao tác này sẽ xóa sạch <code>m_CraftingHistory</code> trên toàn bộ trang bị (đang mặc, trong hành trang, rương cá nhân). Các trang bị sẽ trở về trạng thái nguyên bản để bạn có thể rèn lại tự do tại Thợ Rèn trong game.'));

  const actions = el('div', 'modal-actions');
  const cancelBtn = el('button', 'btn ghost', 'Hủy Bỏ');
  cancelBtn.onclick = () => overlay.remove();

  const confirmBtn = el('button', 'btn danger', '⚡ Xác Nhận Reset Tất Cả');
  confirmBtn.onclick = () => {
    overlay.remove();
    const total = T.resetAllCraftingHistory ? T.resetAllCraftingHistory(app.state.files, app.markFileDirty) : 0;
    if (total > 0) {
      app.markDirty();
      if (app.render) app.render();
      toast(`Đã xóa sạch lịch sử thợ rèn cho ${total} trang bị!`, 'succ');
    } else {
      toast('Tất cả trang bị đã ở trạng thái nguyên bản (không có lịch sử rèn cần xóa).', 'info');
    }
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  box.appendChild(actions);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// Attach to TQ2App
app.getUnifiedSections = getUnifiedSections;
app.getAllUnifiedItems = getAllUnifiedItems;
app.itemMatches = itemMatches;
app.renderList = renderList;
app.renderDetail = renderDetail;
app.renderLiveTooltip = renderLiveTooltip;
app.updateLiveTooltip = updateLiveTooltip;
app.findSlotStruct = findSlotStruct;
app.makeAffix = makeAffix;
app.getTierRange = getTierRange;
app.renderAffix = renderAffix;
app.applyAffixPreset = applyAffixPreset;
app.showBundlePresetModal = showBundlePresetModal;
app.confirmResetAllBlacksmith = confirmResetAllBlacksmith;

})(typeof globalThis !== 'undefined' ? globalThis : this);
