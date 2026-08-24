/* Character Attributes, Mastery & Skills, and Currencies Panels for Titan Quest II Save Editor */
(function (root) {
'use strict';

const app = root.TQ2App;
const G = app.G, T = app.T;
const $ = app.$, $$ = app.$$, el = app.el, elHtml = app.elHtml, fmtNum = app.fmtNum;
const lbl = app.lbl, markDirty = app.markDirty, toast = app.toast;

const openSlots = new Set();

function renderChar(box, sec) {
  const head = el('div', 'dhead');
  head.appendChild(el('h2', '', sec.label));
  head.appendChild(el('div', 'path', 'Character Profile'));
  box.appendChild(head);
  if (sec.key === 'currency') return charCurrency(box, sec.node);
  if (sec.key === 'attr') return charAttr(box, sec.node);
  if (sec.key === 'mastery') return charMastery(box, sec.node);
  return charGeneric(box, sec.node, 'Gameplay Statistics & Progress');
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
  if (name && name.value instanceof G.Scalar) card.appendChild(el('div', 'hint small2', 'Character Name: ' + name.value.v));
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
    const f = app.scalarField('Rank', ip.value);
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
    const btn = el('button', 'btn tiny ghost', (openSlots.has(id) ? '▾ ' : '▸ ') + 'Configure Slots (' + used + '/' + nSlots + ')');
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
      row.appendChild(el('span', 'kind k-Prefix', 'Modifier ' + (i + 1)));
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
        const f = app.scalarField('Tier', lv.value);
        f.style.maxWidth = '100px';
        row.appendChild(f);
      }
      wrap.appendChild(row);
    });
    if (feats && feats.value instanceof G.Arr) feats.value.items.forEach((x, i) => {
      if (!(x instanceof G.Scalar)) return;
      const row = el('div', 'arow effect');
      row.appendChild(el('span', 'kind k-Suffix', 'Feat ' + (i + 1)));
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

  const h3 = el('h3', '', 'Currencies, Materials & Quest Spending');
  h3.style.margin = '0';
  cardHeader.appendChild(h3);

  // Sync all button to fix negative computed spent
  const syncAllBtn = el('button', 'btn tiny ghost', '⚡ Sync All to Bag (Fix Negative Spent)');
  syncAllBtn.title = 'Sets Total Earned = Held in Bag for any currency where Bag holdings exceed Total Earned, fixing negative spent values.';
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
      toast(`Synced ${fixed} currency totals to bag holdings!`, 'succ');
    } else {
      toast('All currencies already have Total Earned ≥ Held in Bag.', 'info');
    }
  };
  cardHeader.appendChild(syncAllBtn);
  card.appendChild(cardHeader);

  const hintBox = elHtml('div', 'hint small2 banner-alert',
    '<b>Quest Spending Logic:</b> Titan Quest II tracks quest spending thresholds dynamically as <code>Spent = Total Earned − Held in Bag</code>. When editing inventory quantities directly, ensure <b>Total Earned</b> is equal to or greater than <b>Held in Bag</b> so quest counters remain valid and non-negative.'
  );
  hintBox.style.marginBottom = '12px';
  card.appendChild(hintBox);

  const tbl = el('div', 'ctab');
  const hdr = el('div', 'crow chead');
  ['Currency / Material', 'Total Earned', 'Held in Bag', 'Computed Spent'].forEach(h => hdr.appendChild(el('span', '', h)));
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

function charAttr(box, pl) {
  T.ensureAttrFields(pl);
  const card = el('div', 'card');
  card.appendChild(el('h3', '', 'Attributes & Core Stats'));
  const val = n => {
    const p = pl.get(n);
    return p && p.value instanceof G.Scalar ? p.value.v : 0;
  };

  const summaryEl = el('div', 'hint small2');
  summaryEl.style.marginTop = '14px';

  const freeApBadge = el('div', 'hint small2');
  freeApBadge.style.marginTop = '4px';
  freeApBadge.style.fontSize = '11px';

  const updateSummary = () => {
    const totalPool = val('m_CharacterAP');
    const spent = val('m_AttributePointsMight') + val('m_AttributePointsAgility')
                + val('m_AttributePointsKnowledge') + val('m_AttributePointsVigor');
    const freeAP = Math.max(0, totalPool - spent);

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

function charMastery(box, pl) {
  T.ensurePointFields(pl);
  const card = el('div', 'card');
  card.appendChild(el('h3', '', 'Spendable Skill Points'));
  const pgrid = el('div', 'grid');
  const NAMES = { ActivePoints: 'Active Skill Points', PassivePoints: 'Passive Skill Points', MasteryPoints: 'Mastery Points' };
  for (const n of T.POINT_FIELDS) {
    const p = pl.get(n);
    if (!p || !(p.value instanceof G.Scalar)) continue;
    const wrap = el('div', 'fld');
    wrap.appendChild(el('span', 'lbl', NAMES[n] || n));
    const row = el('div', 'arow');
    const inp = el('input');
    inp.type = 'number';
    inp.value = p.value.v;
    inp.onchange = () => {
      p.value.set(Math.round(parseFloat(inp.value) || 0));
      markDirty();
    };
    row.appendChild(inp);
    [1, 5, 10].forEach(step => {
      const b = el('button', 'btn tiny ghost', '+' + step);
      b.onclick = () => {
        p.value.set(p.value.v + step);
        inp.value = p.value.v;
        markDirty();
      };
      row.appendChild(b);
    });
    wrap.appendChild(row);
    pgrid.appendChild(wrap);
  }
  card.appendChild(pgrid);
  box.appendChild(card);

  const mp = pl.get('Masteries');
  if (!mp || !(mp.value instanceof G.Arr)) return;
  mp.value.items.forEach(ms => {
    const c = el('div', 'card');
    const nm = T.masteryName(ms);
    c.appendChild(el('h3', '', 'Mastery Tree: ' + nm));
    c.appendChild(scalarGrid(ms.body));
    for (const [key, title] of [['ActiveAbilities', 'Active Abilities'], ['PassiveAbilities', 'Passive Abilities']]) {
      const ap = ms.body.get(key);
      if (!ap || !(ap.value instanceof G.Arr) || !ap.value.items.length) continue;

      // Filter out internal cheat skills from active view
      const validAbilities = ap.value.items.filter(entry => !T.abilityName(entry).toLowerCase().startsWith('cheat'));
      if (!validAbilities.length) continue;

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

})(typeof globalThis !== 'undefined' ? globalThis : this);
