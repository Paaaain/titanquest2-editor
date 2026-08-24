/* Character Attributes, Mastery & Skills, and Currencies Panels for Titan Quest II Save Editor */
(function (root) {
'use strict';

const app = root.TQ2App;
const G = app.G, T = app.T;
const t = (k, p) => (app && typeof app.t === 'function' ? app.t(k, p) : (p ? k : k));
const $ = app.$, $$ = app.$$, el = app.el, elHtml = app.elHtml, fmtNum = app.fmtNum;
const lbl = app.lbl, markDirty = app.markDirty, toast = app.toast;

const openSlots = new Set();

function renderChar(box, sec) {
  const head = el('div', 'dhead');
  head.appendChild(el('h2', '', sec.label));
  head.appendChild(el('div', 'path', t('char.profile_head')));
  box.appendChild(head);
  if (sec.key === 'currency') return charCurrency(box, sec.node);
  if (sec.key === 'attr') return charAttr(box, sec.node);
  if (sec.key === 'mastery') return charMastery(box, sec.node);
  return charGeneric(box, sec.node, t('char.sec_stats'));
}

function scalarGrid(pl, skip) {
  const grid = el('div', 'grid');
  for (const p of pl.props) {
    if (skip && skip.indexOf(p.name) >= 0) continue;
    const v = p.value;
    if (!(v instanceof G.Scalar)) continue;
    if (['i32', 'u32', 'f32', 'f64', 'i64'].indexOf(v.kind) < 0) continue;
    grid.appendChild(app.scalarField(lbl(p.name), v));
  }
  return grid;
}

function charGeneric(box, pl, title) {
  const card = el('div', 'card');
  card.appendChild(el('h3', '', title));
  const name = pl.get && pl.get('m_CharacterName');
  if (name && name.value instanceof G.Scalar) card.appendChild(el('div', 'hint small2', t('char.char_name', { name: name.value.v })));
  card.appendChild(scalarGrid(pl));
  box.appendChild(card);
}

function abilityRow(entry, id) {
  const ip = entry.body && entry.body.get ? entry.body.get('InvestedPoints') : null;
  const name = T.abilityName(entry);
  const wrap = el('div', 'affix');
  const top = el('div', 'arow');
  top.appendChild(el('span', 'ge', name));
  if (ip && ip.value instanceof G.Scalar) {
    const f = app.scalarField(t('char.rank'), ip.value);
    f.style.maxWidth = '130px';
    top.appendChild(f);
  }
  const mods = entry.body.get('ModifierSlots');
  const feats = entry.body.get('FeatSlots');
  const nSlots = (mods && mods.value instanceof G.Arr ? mods.value.items.length : 0)
               + (feats && feats.value instanceof G.Arr ? feats.value.items.length : 0);
  let used = 0;
  if (mods && mods.value instanceof G.Arr) for (const x of mods.value.items) {
    const mc = x.body.get('ModifierClass');
    if (mc && mc.value.v && mc.value.v !== 'None') used++;
  }
  if (feats && feats.value instanceof G.Arr) for (const x of feats.value.items) {
    if (x instanceof G.Scalar && x.v && x.v !== 'None') used++;
  }
  if (nSlots) {
    const btn = el('button', 'btn tiny ghost', (openSlots.has(id) ? '▾ ' : '▸ ') + t('char.configure_slots', { used, total: nSlots }));
    btn.onclick = () => {
      openSlots.has(id) ? openSlots.delete(id) : openSlots.add(id);
      if (app.render) app.render();
    };
    top.appendChild(btn);
  }
  wrap.appendChild(top);

  const CAT = app.state.CAT;
  if (openSlots.has(id) && CAT) {
    const takenMods = new Set();
    if (mods && mods.value instanceof G.Arr) for (const x of mods.value.items) {
      const mc = x.body.get('ModifierClass');
      if (mc && mc.value.v && mc.value.v !== 'None') takenMods.add(mc.value.v);
    }
    const takenFeats = new Set();
    if (feats && feats.value instanceof G.Arr) for (const x of feats.value.items) {
      if (x instanceof G.Scalar && x.v && x.v !== 'None') takenFeats.add(x.v);
    }
    if (mods && mods.value instanceof G.Arr) mods.value.items.forEach((x, i) => {
      const mc = x.body.get('ModifierClass'), lv = x.body.get('Level');
      const row = el('div', 'arow effect');
      row.appendChild(el('span', 'kind k-Prefix', t('char.modifier_slot', { n: i + 1 })));
      row.appendChild(app.slotSelect(CAT.m, mc.value.v, name, v => {
        if (!v) {
          mc.value.set('None');
          if (lv) lv.value.set(-1);
        } else {
          mc.value.set(v);
          const info = CAT.m[v];
          if (lv && lv.value.v < 1) lv.value.set(info && info.lv ? info.lv[1] : 1);
        }
        x.mark();
        markDirty();
        if (app.render) app.render();
      }, takenMods));
      if (lv && lv.value instanceof G.Scalar) {
        const f = app.scalarField(t('char.tier'), lv.value);
        f.style.maxWidth = '100px';
        row.appendChild(f);
      }
      wrap.appendChild(row);
    });
    if (feats && feats.value instanceof G.Arr) feats.value.items.forEach((x, i) => {
      if (!(x instanceof G.Scalar)) return;
      const row = el('div', 'arow effect');
      row.appendChild(el('span', 'kind k-Suffix', t('char.feat_slot', { n: i + 1 })));
      row.appendChild(app.slotSelect(CAT.f, x.v, name, v => {
        x.set(v || 'None');
        markDirty();
        if (app.render) app.render();
      }, takenFeats));
      wrap.appendChild(row);
    });
  }
  return wrap;
}

function charCurrency(box, cur) {
  const held = new Map();
  app.state.files.forEach(f => {
    f.items.forEach(it => {
      if (it.num) held.set(it.handle.asset, it.num);
    });
  });

  const card = el('div', 'card');
  const cardHeader = el('div', 'dhead');
  cardHeader.style.display = 'flex';
  cardHeader.style.alignItems = 'center';
  cardHeader.style.justifyContent = 'space-between';
  cardHeader.style.marginBottom = '10px';

  const h3 = el('h3', '', t('char.cur_card_title'));
  h3.style.margin = '0';
  cardHeader.appendChild(h3);

  // Sync all button to fix negative computed spent
  const syncAllBtn = el('button', 'btn tiny ghost', t('char.sync_all_btn'));
  syncAllBtn.title = t('char.sync_all_title');
  syncAllBtn.onclick = () => {
    let fixed = 0;
    for (const e of cur.entries) {
      const h = held.get(e.asset);
      if (h && e.value < h.v) {
        T.setEarned(cur, e, h.v);
        fixed++;
      }
    }
    if (fixed > 0) {
      markDirty();
      if (app.render) app.render();
      toast(t('char.sync_all_toast', { count: fixed }), 'succ');
    } else {
      toast(t('char.sync_all_none'), 'info');
    }
  };
  cardHeader.appendChild(syncAllBtn);
  card.appendChild(cardHeader);

  const isVi = (app.getLanguage && app.getLanguage() === 'vi');
  const hintText = isVi
    ? '<b>Cơ chế Tiêu hao:</b> TQ2 tính toán số lượng đã chi tiêu tự động bằng công thức <code>Đã Tiêu = Tổng Đã Kiếm − Trong Túi</code>. Khi sửa số lượng trong túi, hãy đảm bảo <b>Tổng Đã Kiếm</b> luôn lớn hơn hoặc bằng <b>Trong Túi</b> để tránh lỗi tiêu hao âm.'
    : '<b>Quest Spending Logic:</b> Titan Quest II tracks quest spending thresholds dynamically as <code>Spent = Total Earned − Held in Bag</code>. When editing inventory quantities directly, ensure <b>Total Earned</b> is equal to or greater than <b>Held in Bag</b> so quest counters remain valid and non-negative.';
  const hintBox = elHtml('div', 'hint small2 banner-alert', hintText);
  hintBox.style.marginBottom = '12px';
  card.appendChild(hintBox);

  const tbl = el('div', 'ctab');
  const hdr = el('div', 'crow chead');
  const headers = isVi
    ? ['Loại Tiền / Nguyên liệu', 'Tổng Đã Kiếm', 'Trong Túi đồ', 'Đã Tiêu (Tính toán)']
    : ['Currency / Material', 'Total Earned', 'Held in Bag', 'Computed Spent'];
  headers.forEach(h => hdr.appendChild(el('span', '', h)));
  tbl.appendChild(hdr);

  for (const e of cur.entries) {
    const row = el('div', 'crow');
    const hum = T.humanizeTQ2Item(e.asset);

    // Column 1: Human-Readable Name + Subtitle Badge + Internal Asset Tag
    const nameCol = el('div', 'cname-wrap');
    const titleRow = el('div', 'cname-row');
    const dot = el('span', 'dot r-' + (hum.cat === 'relic' ? 'epic' : (hum.cat === 'weapon' ? 'rare' : 'magic')));
    const titleSpan = el('span', 'cname-title', hum.title);
    titleRow.appendChild(dot);
    titleRow.appendChild(titleSpan);
    nameCol.appendChild(titleRow);

    const subRow = el('div', 'cname-sub');
    if (hum.subtitle) {
      const badge = el('span', 'badge-tag', hum.subtitle);
      subRow.appendChild(badge);
    }
    const codeBadge = el('span', 'badge-tag code-tag', e.asset);
    codeBadge.title = 'Internal Asset ID: ' + e.asset;
    subRow.appendChild(codeBadge);
    nameCol.appendChild(subRow);
    row.appendChild(nameCol);

    // Column 2: Total Earned (Number Input + Formatted Monospace Display)
    const colEarned = el('div', 'num-col');
    const inE = el('input');
    inE.type = 'number';
    inE.value = e.value;
    inE.className = 'cur-num-input';
    const fmtEarned = el('div', 'num-formatted', fmtNum(e.value));
    colEarned.appendChild(inE);
    colEarned.appendChild(fmtEarned);
    row.appendChild(colEarned);

    // Column 3: Held in Bag
    const h = held.get(e.asset);
    const colHeld = el('div', 'num-col');
    let inH = null;
    let fmtHeld = null;
    if (h) {
      inH = el('input');
      inH.type = 'number';
      inH.value = h.v;
      inH.className = 'cur-num-input';
      fmtHeld = el('div', 'num-formatted', fmtNum(h.v));
      colHeld.appendChild(inH);
      colHeld.appendChild(fmtHeld);
    } else {
      const notInBag = el('span', 'range', '– (None in Bag)');
      notInBag.style.fontSize = '11.5px';
      notInBag.style.color = 'var(--text-dim)';
      colHeld.appendChild(notInBag);
    }
    row.appendChild(colHeld);

    // Column 4: Computed Spent + Positive / Negative Indicators + 1-Click Fix
    const colSpent = el('div', 'spent-col');
    const spentVal = el('span', 'spent-val');
    const syncBtn = el('button', 'btn tiny ghost', '⚡ Sync Earned');
    syncBtn.style.fontSize = '10.5px';
    syncBtn.style.padding = '2px 7px';
    syncBtn.title = 'Set Total Earned equal to Held in Bag so spent becomes 0';

    const upd = () => {
      const earnedVal = Math.round(parseFloat(inE.value) || 0);
      fmtEarned.textContent = fmtNum(earnedVal);
      if (h && inH) {
        const bagVal = Math.round(parseFloat(inH.value) || 0);
        fmtHeld.textContent = fmtNum(bagVal);
        const diff = earnedVal - bagVal;
        if (diff < 0) {
          spentVal.innerHTML = `<span class="spent-neg">${fmtNum(diff)}</span> <span class="badge-tag danger-badge" title="Negative spent currency may stall quest progression">⚠️ Bag &gt; Earned</span>`;
          syncBtn.style.display = 'inline-flex';
        } else {
          spentVal.innerHTML = `<span class="spent-pos">${diff === 0 ? '0' : '+' + fmtNum(diff)}</span>`;
          syncBtn.style.display = 'none';
        }
      } else {
        spentVal.innerHTML = `<span class="spent-pos">+${fmtNum(earnedVal)}</span> <span style="font-size:10.5px;color:var(--text-dim)">(All spent)</span>`;
        syncBtn.style.display = 'none';
      }
    };

    inE.onchange = () => {
      const val = Math.round(parseFloat(inE.value) || 0);
      T.setEarned(cur, e, val);
      markDirty();
      upd();
    };
    inE.oninput = upd;

    if (h && inH) {
      inH.onchange = () => {
        const val = Math.round(parseFloat(inH.value) || 0);
        h.set(val);
        markDirty();
        upd();
      };
      inH.oninput = upd;

      syncBtn.onclick = () => {
        const bagVal = Math.round(parseFloat(inH.value) || 0);
        inE.value = bagVal;
        T.setEarned(cur, e, bagVal);
        markDirty();
        upd();
        toast(`Synced ${hum.title} Total Earned to ${fmtNum(bagVal)}!`, 'succ');
      };
    }

    colSpent.appendChild(spentVal);
    if (h) colSpent.appendChild(syncBtn);
    row.appendChild(colSpent);

    upd();
    tbl.appendChild(row);
  }
  card.appendChild(tbl);
  box.appendChild(card);
}

function showResetAttributesModal(pl, attrFile, status) {
  const existing = $('.modal-overlay');
  if (existing) existing.remove();

  const charName = (app.state.activeProfile && app.state.activeProfile.charName) || 'Hero';
  const overlay = el('div', 'modal-overlay');
  const box = el('div', 'modal-box');
  box.style.maxWidth = '520px';

  box.appendChild(el('h3', '', t('modals.reset_attr_confirm_title') || '⚠️ Confirm Reset Attribute Points?'));

  const descP = el('p', '', t('modals.reset_attr_confirm_body', {
    name: charName,
    might: status.might,
    agility: status.agility,
    knowledge: status.knowledge,
    vigor: status.vigor,
    total: status.allocated,
    totalAP: status.totalAP
  }));
  descP.style.lineHeight = '1.6';
  descP.style.whiteSpace = 'pre-line';
  box.appendChild(descP);

  const pillsWrap = el('div', 'reset-refund-pills');
  pillsWrap.style.display = 'grid';
  pillsWrap.style.gridTemplateColumns = 'repeat(4, 1fr)';
  pillsWrap.style.gap = '8px';
  pillsWrap.style.margin = '14px 0';

  const ATTRS_LIST = [
    { label: 'Might', val: status.might, color: 'var(--gold-primary)' },
    { label: 'Agility', val: status.agility, color: '#3ba7ff' },
    { label: 'Knowledge', val: status.knowledge, color: '#c576ff' },
    { label: 'Vigor', val: status.vigor, color: '#32d583' },
  ];

  ATTRS_LIST.forEach(at => {
    const cardEl = el('div', 'card');
    cardEl.style.padding = '8px';
    cardEl.style.textAlign = 'center';
    cardEl.innerHTML = `<div style="font-size:11px;color:var(--text-dim);">${at.label}</div><div style="font-size:16px;font-weight:bold;color:${at.color};">+${at.val}</div>`;
    pillsWrap.appendChild(cardEl);
  });
  box.appendChild(pillsWrap);

  const actions = el('div', 'modal-actions');
  const cancelBtn = el('button', 'btn ghost tiny', t('modals.modal_close') || 'Cancel');
  cancelBtn.onclick = () => overlay.remove();
  actions.appendChild(cancelBtn);

  const confirmBtn = el('button', 'btn danger-btn', t('char.reset_attr_btn') || 'Reset Attributes');
  confirmBtn.onclick = () => {
    overlay.remove();
    const res = T.resetCharacterAttributes(pl);
    if (res.success) {
      if (attrFile) attrFile.dirty = true;
      markDirty();
      if (app.render) app.render();
      toast(t('modals.reset_attr_toast', {
        name: charName,
        total: res.totalRefunded
      }), 'succ');
    } else {
      toast('Failed to reset attributes: ' + res.reason, 'err');
    }
  };
  actions.appendChild(confirmBtn);
  box.appendChild(actions);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function charAttr(box, pl) {
  T.ensureAttrFields(pl);
  const card = el('div', 'card');

  const cardHeader = el('div', 'dhead');
  cardHeader.style.display = 'flex';
  cardHeader.style.alignItems = 'center';
  cardHeader.style.justifyContent = 'space-between';
  cardHeader.style.marginBottom = '12px';

  const h3 = el('h3', '', t('char.attr_card_title') || 'Attributes & Core Stats');
  h3.style.margin = '0';
  cardHeader.appendChild(h3);

  const val = n => {
    const p = pl.get(n);
    return p && p.value instanceof G.Scalar ? p.value.v : 0;
  };

  const attrFile = app.state.files.find(f => f.name.includes('Data_Player')) || app.state.files[0];

  const resetBtn = el('button', 'btn tiny danger-btn', t('char.reset_attr_btn') || '🔄 Reset Attributes');
  resetBtn.title = t('char.reset_attr_title') || 'Reset all attribute points back to unspent free AP';
  cardHeader.appendChild(resetBtn);
  card.appendChild(cardHeader);

  const summaryEl = el('div', 'hint small2');
  summaryEl.style.marginTop = '14px';

  const freeApBadge = el('div', 'hint small2');
  freeApBadge.style.marginTop = '4px';
  freeApBadge.style.fontSize = '11px';

  const updateSummary = () => {
    const status = T.getAttributeStatus(pl);
    const totalPool = status ? status.totalAP : val('m_CharacterAP');
    const spent = status ? status.allocated : (val('m_AttributePointsMight') + val('m_AttributePointsAgility') + val('m_AttributePointsKnowledge') + val('m_AttributePointsVigor'));
    const freeAP = status ? status.freeAP : Math.max(0, totalPool - spent);

    resetBtn.disabled = (spent === 0);
    resetBtn.onclick = () => {
      if (status && status.allocated > 0) {
        showResetAttributesModal(pl, attrFile, status);
      } else {
        toast(t('modals.reset_attr_none') || 'No attribute points are currently allocated.', 'info');
      }
    };

    freeApBadge.innerHTML = `Unspent Free AP: <b style="color:${freeAP > 0 ? 'var(--gold-primary)' : 'var(--text-muted)'}">${freeAP} pts</b>`;
    summaryEl.innerHTML = `<b>Attribute Summary:</b> Total AP Pool: <b>${totalPool}</b> pts | Allocated: <b>${spent}</b> pts (Might: ${val('m_AttributePointsMight')}, Agility: ${val('m_AttributePointsAgility')}, Knowledge: ${val('m_AttributePointsKnowledge')}, Vigor: ${val('m_AttributePointsVigor')}) | Unspent / Free to Spend: <b style="color:${freeAP > 0 ? 'var(--gold-primary)' : 'inherit'}">${freeAP}</b> pts.<br>
      <b>In-Game Stat Formula:</b> <code>Total Stat = 50 (Base) + (Invested Points × 5) + Equipment Bonuses</code>.<br>
      <b>Note:</b> In TQ2, <code>m_CharacterAP</code> is the Lifetime Earned AP Pool (~3 AP per level + quests). Unspent points in-game = <code>Total AP Pool − Allocated Points</code>.`;
  };

  // Top Grid: Level, Level Progress, Total AP Pool
  const topGrid = el('div', 'grid');
  const levelProp = pl.get('m_CharacterLevel');
  if (levelProp && levelProp.value instanceof G.Scalar) {
    topGrid.appendChild(app.scalarField(lbl('m_CharacterLevel'), levelProp.value, 1));
  }
  const progProp = pl.get('m_CurrentLevelProgress');
  if (progProp && progProp.value instanceof G.Scalar) {
    topGrid.appendChild(app.scalarField(lbl('m_CurrentLevelProgress'), progProp.value, 0.01));
  }
  const apProp = pl.get('m_CharacterAP');
  if (apProp && apProp.value instanceof G.Scalar) {
    const apFld = el('div', 'fld');
    apFld.appendChild(el('span', 'lbl', 'Total Attribute Points Pool'));
    const apStepper = el('div', 'num-stepper');
    const apInp = el('input');
    apInp.type = 'number';
    apInp.value = apProp.value.v;
    apInp.min = 0;
    apInp.onchange = () => {
      const v = Math.max(0, Math.round(parseFloat(apInp.value) || 0));
      apInp.value = v;
      apProp.value.set(v);
      markDirty();
      updateSummary();
    };
    apStepper.appendChild(apInp);
    [1, 5, 10].forEach(delta => {
      const b = el('button', 'step-btn', '+' + delta);
      b.type = 'button';
      b.onclick = () => {
        const v = Math.max(0, (parseFloat(apInp.value) || 0) + delta);
        apInp.value = v;
        apProp.value.set(v);
        markDirty();
        updateSummary();
      };
      apStepper.appendChild(b);
    });
    apFld.appendChild(apStepper);
    apFld.appendChild(freeApBadge);
    topGrid.appendChild(apFld);
  }
  card.appendChild(topGrid);

  // Core Attributes Section
  const attrTitle = el('div', 'lbl', 'Invested Attribute Points (1 Point = +5 Stat Value in Game | 50 Base Stat)');
  attrTitle.style.margin = '14px 0 6px 0';
  attrTitle.style.fontWeight = 'bold';
  attrTitle.style.color = 'var(--gold-primary)';
  card.appendChild(attrTitle);

  const attrGrid = el('div', 'grid');
  const ATTRS = [
    { key: 'm_AttributePointsMight', name: 'Might', desc: 'Physical / Pierce Scaling' },
    { key: 'm_AttributePointsAgility', name: 'Agility', desc: 'Crit / Attack Speed' },
    { key: 'm_AttributePointsKnowledge', name: 'Knowledge', desc: 'Magic / Cast Speed' },
    { key: 'm_AttributePointsVigor', name: 'Vigor', desc: 'Max Health Lever' },
  ];

  ATTRS.forEach(at => {
    const prop = pl.get(at.key);
    if (!prop || !(prop.value instanceof G.Scalar)) return;
    const fld = el('div', 'fld');
    fld.appendChild(el('span', 'lbl', `${at.name} (${at.desc})`));

    const stepper = el('div', 'num-stepper');
    const inp = el('input');
    inp.type = 'number';
    inp.value = prop.value.v;
    inp.min = 0;

    const badge = el('div', 'hint small2');
    badge.style.marginTop = '4px';
    badge.style.fontSize = '11px';
    const refreshBadge = (pts) => {
      const bonus = pts * 5;
      const basePlusPts = 50 + bonus;
      badge.innerHTML = `<span style="color:var(--gold-primary);font-weight:600;">+${bonus} stat</span> (50 Base → <b>${basePlusPts}</b> pre-gear)`;
    };
    refreshBadge(prop.value.v);

    inp.onchange = () => {
      const pts = Math.max(0, Math.round(parseFloat(inp.value) || 0));
      inp.value = pts;
      prop.value.set(pts);
      refreshBadge(pts);
      markDirty();
      updateSummary();
    };
    stepper.appendChild(inp);

    [1, 5, 10].forEach(delta => {
      const b = el('button', 'step-btn', '+' + delta);
      b.type = 'button';
      b.onclick = () => {
        const pts = Math.max(0, (parseFloat(inp.value) || 0) + delta);
        inp.value = pts;
        prop.value.set(pts);
        refreshBadge(pts);
        markDirty();
        updateSummary();
      };
      stepper.appendChild(b);
    });

    fld.appendChild(stepper);
    fld.appendChild(badge);
    attrGrid.appendChild(fld);
  });

  card.appendChild(attrGrid);
  card.appendChild(summaryEl);
  updateSummary();

  box.appendChild(card);
}

function showResetMasteryModal(pLocalFile, headerFile, status) {
  const existing = $('.modal-overlay');
  if (existing) existing.remove();

  const charName = (app.state.activeProfile && app.state.activeProfile.charName) || 'Hero';
  const classesStr = status.masteries.join(' + ') || 'Masteries';

  const overlay = el('div', 'modal-overlay');
  const box = el('div', 'modal-box');
  box.style.maxWidth = '560px';

  box.appendChild(el('h3', '', t('modals.reset_mastery_confirm_title')));

  const descP = el('p', '', t('modals.reset_mastery_confirm_body', {
    name: charName,
    classes: classesStr,
    active: status.investedActive,
    passive: status.investedPassive,
    mastery: status.investedMastery
  }));
  descP.style.lineHeight = '1.6';
  descP.style.whiteSpace = 'pre-line';
  box.appendChild(descP);

  const pillsWrap = el('div', 'reset-refund-pills');
  pillsWrap.style.display = 'grid';
  pillsWrap.style.gridTemplateColumns = 'repeat(3, 1fr)';
  pillsWrap.style.gap = '10px';
  pillsWrap.style.margin = '14px 0';

  const p1 = el('div', 'card');
  p1.style.padding = '10px';
  p1.style.textAlign = 'center';
  p1.innerHTML = `<div style="font-size:11px;color:var(--text-dim);">Active Points</div><div style="font-size:18px;font-weight:bold;color:var(--gold-primary);">+${status.investedActive}</div>`;
  pillsWrap.appendChild(p1);

  const p2 = el('div', 'card');
  p2.style.padding = '10px';
  p2.style.textAlign = 'center';
  p2.innerHTML = `<div style="font-size:11px;color:var(--text-dim);">Passive Points</div><div style="font-size:18px;font-weight:bold;color:#4ecdc4;">+${status.investedPassive}</div>`;
  pillsWrap.appendChild(p2);

  const p3 = el('div', 'card');
  p3.style.padding = '10px';
  p3.style.textAlign = 'center';
  p3.innerHTML = `<div style="font-size:11px;color:var(--text-dim);">Mastery Points</div><div style="font-size:18px;font-weight:bold;color:#b388ff;">+${status.investedMastery}</div>`;
  pillsWrap.appendChild(p3);

  box.appendChild(pillsWrap);

  const alertBox = elHtml('div', 'hint small2 banner-alert',
    (app.getLanguage && app.getLanguage() === 'vi')
      ? '<b>Lưu ý:</b> Sau khi Reset, bạn hãy bấm <b>Lưu & Ghi đè</b> (hoặc Xuất .zip). Khi vào game Titan Quest II, mở cây kỹ năng sẽ hiện bảng chọn lại 2 Tinh thông mới từ đầu.'
      : '<b>Note:</b> After resetting, click <b>Save & Overwrite</b> (or Export .zip). Upon loading Titan Quest II, opening the Masteries screen will present the selection UI allowing you to pick 2 masteries from scratch.'
  );
  alertBox.style.marginBottom = '16px';
  box.appendChild(alertBox);

  const actions = el('div', 'modal-actions');
  const cancelBtn = el('button', 'btn ghost tiny', t('modals.modal_close') || 'Cancel');
  cancelBtn.onclick = () => overlay.remove();
  actions.appendChild(cancelBtn);

  const confirmBtn = el('button', 'btn danger-btn', t('char.reset_mastery_btn') || 'Confirm Reset');
  confirmBtn.onclick = () => {
    overlay.remove();
    const res = T.resetCharacterMasteries(pLocalFile.save, headerFile ? headerFile.save : null);
    if (res.success) {
      pLocalFile.dirty = true;
      if (headerFile) headerFile.dirty = true;
      markDirty();
      if (app.render) app.render();
      toast(t('modals.reset_mastery_toast', {
        name: charName,
        active: res.refundedActive,
        passive: res.refundedPassive,
        mastery: res.refundedMastery
      }), 'succ');
    } else {
      toast('Failed to reset masteries: ' + res.reason, 'err');
    }
  };
  actions.appendChild(confirmBtn);
  box.appendChild(actions);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showRefundSkillsModal(pLocalFile, status) {
  const existing = $('.modal-overlay');
  if (existing) existing.remove();

  const classesStr = status.masteries.join(' + ') || 'Mastery';
  const overlay = el('div', 'modal-overlay');
  const box = el('div', 'modal-box');
  box.style.maxWidth = '520px';

  box.appendChild(el('h3', '', t('modals.refund_skills_confirm_title')));

  const descP = el('p', '', t('modals.refund_skills_confirm_body', {
    active: status.investedActive,
    passive: status.investedPassive,
    classes: classesStr
  }));
  descP.style.lineHeight = '1.6';
  descP.style.whiteSpace = 'pre-line';
  box.appendChild(descP);

  const actions = el('div', 'modal-actions');
  const cancelBtn = el('button', 'btn ghost tiny', t('modals.modal_close') || 'Cancel');
  cancelBtn.onclick = () => overlay.remove();
  actions.appendChild(cancelBtn);

  const confirmBtn = el('button', 'btn', t('char.refund_skills_btn') || 'Refund Skills');
  confirmBtn.onclick = () => {
    overlay.remove();
    const res = T.refundCharacterSkillPoints(pLocalFile.save);
    if (res.success) {
      pLocalFile.dirty = true;
      markDirty();
      if (app.render) app.render();
      toast(t('modals.refund_skills_toast', {
        active: res.refundedActive,
        passive: res.refundedPassive
      }), 'succ');
    } else {
      toast('Failed to refund skill points: ' + res.reason, 'err');
    }
  };
  actions.appendChild(confirmBtn);
  box.appendChild(actions);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function charMastery(box, pl) {
  T.ensurePointFields(pl);

  const pLocalFile = app.state.files.find(f => f.name.includes('Data_PlayerLocal')) || app.state.files[0];
  const headerFile = app.state.files.find(f => f.name.includes('Header'));
  const masteryStatus = pLocalFile ? T.getMasteryStatus(pLocalFile.save, headerFile ? headerFile.save : null) : null;

  // 1. Mastery Status & Operations Action Card
  const statusCard = el('div', 'card mastery-status-card');
  const statusHeader = el('div', 'dhead');
  statusHeader.style.display = 'flex';
  statusHeader.style.alignItems = 'center';
  statusHeader.style.justifyContent = 'space-between';
  statusHeader.style.marginBottom = '12px';

  const statusLeft = el('div', '');
  const isVi = (app.getLanguage && app.getLanguage() === 'vi');
  const cardTitle = el('h3', '', t('char.mastery_panel_title') || 'Mastery Selection & Skill Points');
  cardTitle.style.margin = '0';
  statusLeft.appendChild(cardTitle);

  let badgeText = masteryStatus && !masteryStatus.isUnblessed
    ? masteryStatus.masteries.join(' + ')
    : (t('char.unblessed_badge') || 'Unblessed');

  const badgeSpan = el('span', 'badge-tag' + (masteryStatus && !masteryStatus.isUnblessed ? ' code-tag' : ' badge-gold'), badgeText);
  badgeSpan.style.fontSize = '12px';
  badgeSpan.style.padding = '3px 9px';
  badgeSpan.style.marginLeft = '8px';
  statusLeft.appendChild(badgeSpan);
  statusHeader.appendChild(statusLeft);

  // Action Buttons (Reset Mastery & Refund Skills)
  const btnGroup = el('div', 'arow');
  btnGroup.style.gap = '8px';

  if (masteryStatus && !masteryStatus.isUnblessed) {
    const refundSkillsBtn = el('button', 'btn tiny ghost', t('char.refund_skills_btn') || '⚡ Refund Skills');
    refundSkillsBtn.title = t('char.refund_skills_title') || 'Refund spent skill points without removing masteries';
    refundSkillsBtn.disabled = (masteryStatus.investedActive + masteryStatus.investedPassive) === 0;
    refundSkillsBtn.onclick = () => {
      if (pLocalFile) showRefundSkillsModal(pLocalFile, masteryStatus);
    };
    btnGroup.appendChild(refundSkillsBtn);

    const resetMasteryBtn = el('button', 'btn tiny danger-btn', t('char.reset_mastery_btn') || '🔄 Reset Mastery');
    resetMasteryBtn.title = t('char.reset_mastery_title') || 'Wipe masteries and allow choosing again from scratch';
    resetMasteryBtn.onclick = () => {
      if (pLocalFile) showResetMasteryModal(pLocalFile, headerFile, masteryStatus);
    };
    btnGroup.appendChild(resetMasteryBtn);
  }

  statusHeader.appendChild(btnGroup);
  statusCard.appendChild(statusHeader);

  // Invested Points Summary
  if (masteryStatus && !masteryStatus.isUnblessed) {
    const summaryBox = elHtml('div', 'hint small2', t('char.invested_summary', {
      act: masteryStatus.investedActive,
      pas: masteryStatus.investedPassive,
      mas: masteryStatus.investedMastery
    }) + ` | Total Pool: <b>${masteryStatus.totalActivePool}</b> Active, <b>${masteryStatus.totalPassivePool}</b> Passive, <b>${masteryStatus.totalMasteryPool}</b> Mastery.`);
    summaryBox.style.marginBottom = '12px';
    statusCard.appendChild(summaryBox);
  }
  box.appendChild(statusCard);

  // 2. Spendable Skill Points Card
  const card = el('div', 'card');
  card.appendChild(el('h3', '', t('char.spendable_points_title') || 'Spendable Skill Points Pool'));
  const pgrid = el('div', 'grid');
  const NAMES = {
    ActivePoints: isVi ? 'Điểm Kỹ năng Chủ động (Active Points)' : 'Active Skill Points',
    PassivePoints: isVi ? 'Điểm Kỹ năng Bị động (Passive Points)' : 'Passive Skill Points',
    MasteryPoints: isVi ? 'Điểm Phát triển Tinh thông (Mastery Points)' : 'Mastery Points'
  };

  for (const n of T.POINT_FIELDS) {
    const p = pl.get(n);
    if (!p || !(p.value instanceof G.Scalar)) continue;
    const wrap = el('div', 'fld');
    wrap.appendChild(el('span', 'lbl', NAMES[n] || n));
    const stepper = el('div', 'num-stepper');
    const inp = el('input');
    inp.type = 'number';
    inp.value = p.value.v;
    inp.min = 0;
    inp.onchange = () => {
      p.value.set(Math.max(0, Math.round(parseFloat(inp.value) || 0)));
      markDirty();
    };
    stepper.appendChild(inp);
    [1, 5, 10].forEach(step => {
      const b = el('button', 'step-btn', '+' + step);
      b.type = 'button';
      b.onclick = () => {
        const nextVal = Math.max(0, p.value.v + step);
        p.value.set(nextVal);
        inp.value = nextVal;
        markDirty();
      };
      stepper.appendChild(b);
    });
    wrap.appendChild(stepper);
    pgrid.appendChild(wrap);
  }
  card.appendChild(pgrid);
  box.appendChild(card);

  // 3. Render Unblessed Showcase OR Mastery Trees
  const mp = pl.get('Masteries');
  const hasMasteries = (mp && mp.value instanceof G.Arr && mp.value.items.length > 0);

  if (!hasMasteries) {
    // Unblessed Showcase Card
    const unblessedCard = el('div', 'card unblessed-showcase-card');
    const uHeader = el('div', 'unblessed-header');
    uHeader.innerHTML = `<h3 style="color:var(--gold-primary);margin-top:0;">🌟 ${t('char.unblessed_title')}</h3>
      <p style="line-height:1.6;color:var(--text);">${t('char.unblessed_desc')}</p>`;
    unblessedCard.appendChild(uHeader);

    const catTitle = el('h4', 'subh', t('char.unblessed_catalog_title') || 'Available Masteries in Titan Quest II:');
    catTitle.style.marginTop = '14px';
    unblessedCard.appendChild(catTitle);

    const masteriesCatalog = [
      { name: 'Earth', vi: 'Đất & Lửa', icon: '🔥', slogan: isVi ? 'Điều khiển sức mạnh của đất và ngọn lửa sâu thẳm!' : 'Bend the earth itself to your will!', desc: isVi ? 'Bậc thầy về phép thuật địa chấn và lửa ngầm, thiêu rụi và nghiền nát kẻ địch.' : 'Masters of Earth harness fire and stone to shape and ignite the battlefield.' },
      { name: 'Storm', vi: 'Bão tố & Sét', icon: '⚡', slogan: isVi ? 'Phóng ra những luồng sét hủy diệt!' : 'Throw lightning from your fingertips!', desc: isVi ? 'Triệu hồi sấm sét và băng giá trút xuống hàng ngũ kẻ thù.' : 'Masters of Storm control lightning and ice to rain destruction down on foes.' },
      { name: 'Warfare', vi: 'Chiến trận & Vũ khí', icon: '⚔️', slogan: isVi ? 'Thống trị chiến trường giáp lá cà!' : 'Dominate the battlefield!', desc: isVi ? 'Càn quét tiền tuyến với kỹ năng cận chiến và vũ khí hủy diệt.' : 'Masters of Warfare excel at confronting enemies directly on the frontline.' },
      { name: 'Rogue', vi: 'Sát thủ & Độc', icon: '🗡️', slogan: isVi ? 'Tấn công chí mạng từ trong bóng tối!' : 'Strike from the shadows!', desc: isVi ? 'Bậc thầy chính xác, né tránh, bẫy và các loại chất độc chí mạng.' : 'Masters of precision, evasion, traps, and deadly poisons.' },
      { name: 'Forge', vi: 'Rèn & Cơ khí', icon: '🔨', slogan: isVi ? 'Chế tạo những kỳ quan thần thánh!' : 'Craft divine wonders!', desc: isVi ? 'Xây dựng ụ súng, bẫy cơ khí và bộ giáp hộ thể kiên cố.' : 'Build clever contraptions, automated sentries, and unstoppable armors.' },
      { name: 'Spirit', vi: 'Linh hồn & Cõi âm', icon: '💀', slogan: isVi ? 'Triệu hồi sức mạnh từ thế giới bên kia!' : 'Summon the forces of the Underworld!', desc: isVi ? 'Triệu hồi vong linh, điều khiển pháp thuật cõi chết và hút sinh lực kẻ thù.' : 'Call on shades of the dead, spectral spells, and drain enemy life force.' }
    ];

    const catalogGrid = el('div', 'mastery-catalog-grid');
    catalogGrid.style.display = 'grid';
    catalogGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
    catalogGrid.style.gap = '12px';
    catalogGrid.style.marginTop = '10px';

    masteriesCatalog.forEach(mCat => {
      const mCard = el('div', 'mastery-catalog-card');
      mCard.style.padding = '12px';
      mCard.style.background = 'rgba(255, 255, 255, 0.03)';
      mCard.style.border = '1px solid rgba(255, 255, 255, 0.08)';
      mCard.style.borderRadius = '6px';

      const mHead = el('div', 'arow');
      mHead.style.alignItems = 'center';
      mHead.style.gap = '8px';
      mHead.style.marginBottom = '6px';

      const iconSpan = el('span', '', mCat.icon);
      iconSpan.style.fontSize = '18px';
      const nameStrong = el('strong', '', `${mCat.name} (${mCat.vi})`);
      nameStrong.style.color = 'var(--gold-primary)';
      mHead.appendChild(iconSpan);
      mHead.appendChild(nameStrong);
      mCard.appendChild(mHead);

      const sloganDiv = el('div', 'hint small2', `<i>"${mCat.slogan}"</i>`);
      sloganDiv.style.color = 'var(--text-dim)';
      sloganDiv.style.marginBottom = '6px';
      mCard.appendChild(sloganDiv);

      const descDiv = el('div', 'hint small2', mCat.desc);
      mCard.appendChild(descDiv);

      catalogGrid.appendChild(mCard);
    });

    unblessedCard.appendChild(catalogGrid);
    box.appendChild(unblessedCard);
    return;
  }

  // Mastery Trees
  mp.value.items.forEach(ms => {
    const c = el('div', 'card');
    const nm = T.masteryName(ms);
    c.appendChild(el('h3', '', t('char.mastery_tree_title', { name: nm }) || ('Mastery Tree: ' + nm)));
    c.appendChild(scalarGrid(ms.body));
    for (const [key, titleKey, fallback] of [
      ['ActiveAbilities', 'char.active_abilities_title', 'Active Abilities'],
      ['PassiveAbilities', 'char.passive_abilities_title', 'Passive Abilities']
    ]) {
      const ap = ms.body.get(key);
      if (!ap || !(ap.value instanceof G.Arr) || !ap.value.items.length) continue;

      // Filter out internal cheat skills from active view
      const validAbilities = ap.value.items.filter(entry => !T.abilityName(entry).toLowerCase().startsWith('cheat'));
      if (!validAbilities.length) continue;

      const title = t(titleKey) || fallback;
      c.appendChild(el('h4', 'subh', title + ' (' + validAbilities.length + ')'));
      validAbilities.forEach((entry, ai) => {
        c.appendChild(abilityRow(entry, nm + '/' + key + '/' + ai));
      });
    }
    box.appendChild(c);
  });
}

// Attach to TQ2App
app.renderChar = renderChar;
app.scalarGrid = scalarGrid;
app.charGeneric = charGeneric;
app.abilityRow = abilityRow;
app.charCurrency = charCurrency;
app.charAttr = charAttr;
app.charMastery = charMastery;
app.showResetMasteryModal = showResetMasteryModal;
app.showRefundSkillsModal = showRefundSkillsModal;
app.showResetAttributesModal = showResetAttributesModal;

})(typeof globalThis !== 'undefined' ? globalThis : this);
