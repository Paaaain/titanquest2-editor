/* Reusable Form Controls & Searchable Popovers for Titan Quest II Save Editor */
(function (root) {
'use strict';

const app = root.TQ2App;
const G = app.G, T = app.T;
const $ = app.$, $$ = app.$$, el = app.el, elHtml = app.elHtml, escapeHtml = app.escapeHtml;

function numField(label, value, onChange, step = 1, min = null, max = null) {
  const wrap = el('label', 'fld');
  wrap.appendChild(el('span', 'lbl', label));
  const stepper = el('div', 'num-stepper');
  const inp = el('input');
  inp.type = 'number';
  inp.value = typeof value === 'number' ? (Number.isInteger(value) ? value : Number(value.toFixed(2))) : value;
  inp.step = step;
  if (min !== null) inp.min = min;
  if (max !== null) inp.max = max;

  inp.onchange = () => {
    let v = parseFloat(inp.value);
    if (isNaN(v)) v = 0;
    v = Math.round(v * 1000) / 1000;
    inp.value = v;
    onChange(v);
  };
  stepper.appendChild(inp);

  const deltas = step < 1 ? [0.1, 0.5, 1.0] : [1, 5, 10];
  deltas.forEach(delta => {
    const b = el('button', 'step-btn', '+' + delta);
    b.type = 'button';
    b.onclick = () => {
      let v = (parseFloat(inp.value) || 0) + delta;
      v = Math.round(v * 1000) / 1000;
      inp.value = v;
      onChange(v);
    };
    stepper.appendChild(b);
  });
  wrap.appendChild(stepper);
  return wrap;
}

function scalarField(label, sc, step) {
  if (sc.kind === 'i64') {
    return numField(label, Number(sc.v), x => {
      sc.set(BigInt(Math.round(x)));
      app.markDirty();
    }, 1);
  }
  const isF = (sc.kind === 'f32' || sc.kind === 'f64');
  return numField(label, sc.v, x => {
    sc.set(isF ? x : Math.round(x));
    app.markDirty();
  }, step || (isF ? 0.1 : 1));
}

function selField(label, value, options, onChange) {
  const wrap = el('label', 'fld');
  wrap.appendChild(el('span', 'lbl', label));
  const sel = el('select');
  const opts = options.slice();
  if (value && !opts.includes(value)) opts.unshift(value);
  for (const o of opts) {
    const op = el('option', '', o.split('::').pop());
    op.value = o;
    if (o === value) op.selected = true;
    sel.appendChild(op);
  }
  sel.onchange = () => onChange(sel.value);
  wrap.appendChild(sel);
  return wrap;
}

function createSearchableBaseItemSelect({ currentAsset, onSelect }) {
  const container = el('div', 'searchable-select searchable-item-select');

  const trigger = el('button', 'searchable-select-trigger');
  trigger.type = 'button';

  const hum = T.humanizeTQ2Item(currentAsset);
  const currentTitle = hum.title || currentAsset || '— Select Base Item Template —';
  const currentSub = hum.subtitle || '';

  const triggerContent = el('div', 'trigger-content');
  const dot = el('span', 'dot r-' + (hum.cat === 'relic' ? 'epic' : (hum.cat === 'weapon' ? 'rare' : 'magic')));
  const labelSpan = el('span', 'searchable-select-label', currentTitle);
  const subBadge = el('span', 'hint small2', currentSub ? ` (${currentSub})` : '');
  subBadge.style.opacity = '0.75';
  subBadge.style.marginLeft = '6px';
  subBadge.style.fontSize = '11.5px';

  triggerContent.appendChild(dot);
  triggerContent.appendChild(labelSpan);
  triggerContent.appendChild(subBadge);

  const chevron = el('span', 'searchable-select-chevron', '▼');
  trigger.appendChild(triggerContent);
  trigger.appendChild(chevron);
  container.appendChild(trigger);

  let popover = null;
  let activeIndex = -1;
  let currentFilteredList = [];

  function closePopover() {
    if (popover && popover.parentNode) {
      popover.parentNode.removeChild(popover);
      popover = null;
      container.classList.remove('is-open');
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleGlobalKeydown);
    }
  }

  function handleOutsideClick(e) {
    if (!container.contains(e.target) && (!popover || !popover.contains(e.target))) {
      closePopover();
    }
  }

  function handleGlobalKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePopover();
      trigger.focus();
    }
  }

  function openPopover() {
    $$('.searchable-select.is-open').forEach(other => {
      if (other !== container && other._closePopover) other._closePopover();
    });

    container.classList.add('is-open');
    popover = el('div', 'searchable-select-popover');

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 420 && rect.top > 420) {
      popover.style.top = 'auto';
      popover.style.bottom = 'calc(100% + 4px)';
    }

    const header = el('div', 'searchable-select-search-wrap');
    const searchRow = el('div', 'searchable-select-search-row');
    const searchIcon = el('span', 'searchable-select-search-icon', '🔍');
    const searchInput = el('input', 'searchable-select-search-input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search item name, type, element, or asset identifier...';
    searchInput.autocomplete = 'off';
    searchInput.spellcheck = false;

    const clearBtn = el('button', 'searchable-select-clear-btn', '✕');
    clearBtn.type = 'button';
    clearBtn.title = 'Clear search';
    clearBtn.style.display = 'none';
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      searchInput.value = '';
      clearBtn.style.display = 'none';
      filterOptions('');
      searchInput.focus();
    };

    searchRow.appendChild(searchIcon);
    searchRow.appendChild(searchInput);
    searchRow.appendChild(clearBtn);
    header.appendChild(searchRow);

    const catCounts = { 'All': 0, 'Unique': 0, 'Weapons': 0, 'Armor': 0, 'Shields': 0, 'Jewelry': 0, 'Relics': 0, 'Charms': 0, 'Materials': 0, 'Potions': 0 };
    const allOptions = [];

    app.state.CAT.i.forEach(([pkg, asset]) => {
      const h = T.humanizeTQ2Item(asset, pkg);
      let cat = 'Other';
      if (asset.includes('_unique_')) cat = 'Unique';
      else if (asset.startsWith('da_socket_relic_')) cat = 'Relics';
      else if (asset.startsWith('da_socket_charm_')) cat = 'Charms';
      else if (asset.includes('weapon_offhand_shield') || asset.includes('weapon_offhand_talisman')) cat = 'Shields';
      else if (asset.includes('weapon_')) cat = 'Weapons';
      else if (asset.includes('armor_')) cat = 'Armor';
      else if (asset.includes('jewelry_')) cat = 'Jewelry';
      else if (asset.includes('item_mat_') || asset.includes('item_embers') || asset.includes('lootbox_')) cat = 'Materials';
      else if (asset.includes('potion_') || asset.includes('gold') || asset.includes('obol') || asset.includes('tears') || asset.includes('quest_') || asset.includes('coin')) cat = 'Potions';

      catCounts['All'] = (catCounts['All'] || 0) + 1;
      if (catCounts[cat] !== undefined) catCounts[cat] = (catCounts[cat] || 0) + 1;

      allOptions.push({
        pkg,
        asset,
        title: h.title,
        subtitle: h.subtitle,
        cat,
        gearCat: h.cat,
        searchText: `${h.title} ${h.subtitle} ${asset} ${cat}`.toLowerCase()
      });
    });

    allOptions.sort((a, b) => a.title.localeCompare(b.title));

    const pillsRow = el('div', 'searchable-select-pills');
    pillsRow.style.overflowX = 'auto';
    pillsRow.style.whiteSpace = 'nowrap';
    pillsRow.style.paddingBottom = '4px';

    let activeCat = 'All';
    const tabKeys = ['All', 'Unique', 'Weapons', 'Armor', 'Shields', 'Jewelry', 'Relics', 'Charms', 'Materials', 'Potions'];
    tabKeys.forEach(cat => {
      const p = el('button', 's-pill sp-' + cat + (cat === 'All' ? ' active' : ''), `${cat} (${catCounts[cat] || 0})`);
      p.type = 'button';
      p.onclick = (e) => {
        e.stopPropagation();
        pillsRow.querySelectorAll('.s-pill').forEach(b => b.classList.remove('active'));
        p.classList.add('active');
        activeCat = cat;
        filterOptions(searchInput.value);
      };
      pillsRow.appendChild(p);
    });
    header.appendChild(pillsRow);

    const listWrap = el('div', 'searchable-select-list searchable-select-options');
    popover.appendChild(header);
    popover.appendChild(listWrap);
    container.appendChild(popover);

    function filterOptions(query) {
      const q = query.trim().toLowerCase();
      const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
      clearBtn.style.display = q ? 'inline-flex' : 'none';

      let items = allOptions;
      if (activeCat !== 'All') {
        items = items.filter(it => it.cat === activeCat);
      }
      if (tokens.length > 0) {
        items = items.filter(it => tokens.every(tok => it.searchText.includes(tok)));
      }

      currentFilteredList = items;
      activeIndex = -1;
      listWrap.innerHTML = '';

      if (items.length === 0) {
        const empty = el('div', 'searchable-select-empty', 'No matching items found for "' + query + '"');
        listWrap.appendChild(empty);
        return;
      }

      const countHeader = el('div', 'searchable-select-count', `${items.length} item${items.length === 1 ? '' : 's'} available`);
      countHeader.style.padding = '4px 10px';
      countHeader.style.fontSize = '11px';
      countHeader.style.color = 'var(--text-dim)';
      listWrap.appendChild(countHeader);

      items.forEach((item, idx) => {
        const opt = el('div', 'searchable-select-option' + (item.asset === currentAsset ? ' is-selected' : ''));
        opt.setAttribute('data-idx', idx);

        const row = el('div', 'opt-row');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.gap = '8px';
        row.style.width = '100%';

        const left = el('div', 'opt-left');
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '8px';
        left.style.minWidth = '0';

        const dot = el('span', 'dot r-' + (item.cat === 'Relics' || item.cat === 'Unique' ? 'epic' : (item.cat === 'Weapons' || item.cat === 'Shields' ? 'rare' : 'magic')));
        const titleSpan = el('span', 'opt-title', item.title);
        titleSpan.style.fontWeight = '600';
        titleSpan.style.color = 'var(--text-main)';

        left.appendChild(dot);
        left.appendChild(titleSpan);

        const right = el('div', 'opt-right');
        const badge = el('span', 's-pill sp-' + (item.cat || 'Other'), item.cat);
        badge.style.fontSize = '10px';
        badge.style.padding = '1px 6px';
        badge.style.margin = '0';
        right.appendChild(badge);

        row.appendChild(left);
        row.appendChild(right);

        const subRow = el('div', 'opt-subrow');
        subRow.style.fontSize = '11px';
        subRow.style.color = 'var(--text-muted)';
        subRow.style.marginTop = '2px';
        subRow.style.display = 'flex';
        subRow.style.justifyContent = 'space-between';
        subRow.style.gap = '8px';
        subRow.style.width = '100%';

        const subDesc = el('span', '', item.subtitle || '');
        const assetCode = el('code', '', item.asset);
        assetCode.style.fontSize = '10px';
        assetCode.style.opacity = '0.6';

        subRow.appendChild(subDesc);
        subRow.appendChild(assetCode);

        const optContent = el('div', 'opt-content');
        optContent.style.width = '100%';
        optContent.appendChild(row);
        optContent.appendChild(subRow);

        opt.appendChild(optContent);

        opt.onmouseenter = () => {
          activeIndex = idx;
          updateHighlight();
        };

        opt.onclick = (e) => {
          e.stopPropagation();
          closePopover();
          if (onSelect) onSelect(item.pkg, item.asset);
        };

        listWrap.appendChild(opt);
      });

      if (currentAsset) {
        const selIdx = items.findIndex(x => x.asset === currentAsset);
        if (selIdx >= 0) {
          activeIndex = selIdx;
          updateHighlight(true);
        }
      }
    }

    function updateHighlight(scrollTo = false) {
      const opts = listWrap.querySelectorAll('.searchable-select-option');
      opts.forEach((o, i) => {
        if (i === activeIndex) {
          o.classList.add('is-highlighted');
          if (scrollTo) o.scrollIntoView({ block: 'nearest' });
        } else {
          o.classList.remove('is-highlighted');
        }
      });
    }

    filterOptions('');

    setTimeout(() => {
      searchInput.focus();
      document.addEventListener('pointerdown', handleOutsideClick);
      document.addEventListener('keydown', handleGlobalKeydown);
    }, 20);
  }

  trigger.onclick = (e) => {
    e.stopPropagation();
    if (container.classList.contains('is-open')) closePopover();
    else openPopover();
  };

  container._closePopover = closePopover;
  return container;
}

function createSearchableAffixSelect({ currentPath, onSelect, autoOpen, itemAsset }) {
  const container = el('div', 'searchable-select');

  const trigger = el('button', 'searchable-select-trigger');
  trigger.type = 'button';

  const CAT = app.state.CAT;
  const currentKind = T.affixKind(currentPath);
  const curMeta = (CAT.names && CAT.names[currentPath]) || {};
  const curLocal = curMeta.title || '';
  const curEng = curMeta.englishTitle || T.affixShortName(currentPath);
  let currentName = '— Select Affix —';
  if (currentPath) {
    if (curLocal && curEng && curLocal !== curEng) {
      currentName = `${curLocal} (${curEng})`;
    } else {
      currentName = curLocal || curEng;
    }
    if (!CAT.a[currentPath]) currentName += ' (from file)';
  }

  const slotType = T.getItemSlotType ? T.getItemSlotType(itemAsset) : 'misc';
  const curCompat = T.checkAffixSlotCompatibility ? T.checkAffixSlotCompatibility(currentPath, slotType) : { compatible: true, reason: 'Universal' };

  const triggerContent = el('div', 'trigger-content');
  if (currentPath) {
    const kindBadge = el('span', 'kind k-' + currentKind, currentKind);
    triggerContent.appendChild(kindBadge);
  }
  const labelSpan = el('span', 'searchable-select-label', currentName);
  triggerContent.appendChild(labelSpan);

  if (currentPath && !curCompat.compatible) {
    const warnBadge = el('span', 'badge-pill badge-warn', '⚠ Conflict');
    warnBadge.title = curCompat.reason;
    triggerContent.appendChild(warnBadge);
  }

  const chevron = el('span', 'searchable-select-chevron', '▼');
  trigger.appendChild(triggerContent);
  trigger.appendChild(chevron);
  container.appendChild(trigger);

  let popover = null;
  let activeIndex = -1;
  let currentFilteredList = [];

  function closePopover() {
    if (popover && popover.parentNode) {
      popover.parentNode.removeChild(popover);
      popover = null;
      container.classList.remove('is-open');
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleGlobalKeydown);
    }
  }

  function handleOutsideClick(e) {
    if (!container.contains(e.target) && (!popover || !popover.contains(e.target))) {
      closePopover();
    }
  }

  function handleGlobalKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePopover();
      trigger.focus();
    }
  }

  function openPopover() {
    $$('.searchable-select.is-open').forEach(other => {
      if (other !== container && other._closePopover) other._closePopover();
    });

    container.classList.add('is-open');
    popover = el('div', 'searchable-select-popover');

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 360 && rect.top > 360) {
      popover.style.top = 'auto';
      popover.style.bottom = 'calc(100% + 4px)';
    }

    const header = el('div', 'searchable-select-search-wrap');
    const searchRow = el('div', 'searchable-select-search-row');
    const searchIcon = el('span', 'searchable-select-search-icon', '🔍');
    const searchInput = el('input', 'searchable-select-search-input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search suffix, prefix, implicit, other or stat...';
    searchInput.autocomplete = 'off';
    searchInput.spellcheck = false;

    const clearBtn = el('button', 'searchable-select-clear-btn', '✕');
    clearBtn.type = 'button';
    clearBtn.title = 'Clear search';
    clearBtn.style.display = 'none';
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      searchInput.value = '';
      clearBtn.style.display = 'none';
      filterOptions('');
      searchInput.focus();
    };

    searchRow.appendChild(searchIcon);
    searchRow.appendChild(searchInput);
    searchRow.appendChild(clearBtn);
    header.appendChild(searchRow);

    const catCounts = { 'All': 0, 'Recommended': 0, 'Prefix': 0, 'Suffix': 0, 'Implicit': 0, 'Other': 0 };
    const allOptions = [];

    if (currentPath && !CAT.a[currentPath]) {
      const meta = (CAT.names && CAT.names[currentPath]) || {};
      const comp = T.checkAffixSlotCompatibility ? T.checkAffixSlotCompatibility(currentPath, slotType) : { compatible: true, reason: 'Universal' };
      allOptions.push({
        key: currentPath,
        name: T.affixShortName(currentPath),
        localTitle: meta.title || '',
        tooltip: meta.tooltip || '',
        kind: currentKind,
        allowedCats: '',
        isFileExtra: true,
        isCompatible: comp.compatible,
        compatReason: comp.reason
      });
      catCounts[currentKind] = (catCounts[currentKind] || 0) + 1;
      if (comp.compatible) catCounts['Recommended']++;
      catCounts['All']++;
    }

    for (const k of CAT.keys) {
      const kKind = T.affixKind(k);
      const kName = T.affixShortName(k);
      const meta = (CAT.names && CAT.names[k]) || {};
      const localTitle = meta.title || '';
      const tooltip = meta.tooltip || '';
      const info = CAT.a[k] || {};
      const allowed = (info.cs ? info.cs.join(', ') : (info.c || ''));
      const comp = T.checkAffixSlotCompatibility ? T.checkAffixSlotCompatibility(k, slotType) : { compatible: true, reason: 'Universal' };

      allOptions.push({
        key: k,
        name: kName,
        localTitle: localTitle,
        tooltip: tooltip,
        kind: kKind,
        info: info,
        allowedCats: allowed,
        isCompatible: comp.compatible,
        compatReason: comp.reason
      });

      if (catCounts[kKind] !== undefined) catCounts[kKind]++;
      if (comp.compatible) catCounts['Recommended']++;
      catCounts['All']++;
    }

    const pillsRow = el('div', 'searchable-select-pills');
    let activeCat = 'Recommended';

    ['All', 'Recommended', 'Prefix', 'Suffix', 'Implicit', 'Other'].forEach(cat => {
      let label = cat;
      if (cat === 'Recommended') label = '✨ Phù hợp';
      const p = el('button', 's-pill sp-' + cat + (cat === activeCat ? ' active' : ''), `${label} (${catCounts[cat] || 0})`);
      p.type = 'button';
      p.onclick = (e) => {
        e.stopPropagation();
        pillsRow.querySelectorAll('.s-pill').forEach(b => b.classList.remove('active'));
        p.classList.add('active');
        activeCat = cat;
        filterOptions(searchInput.value);
      };
      pillsRow.appendChild(p);
    });
    header.appendChild(pillsRow);

    const countInfo = el('div', 'searchable-select-count', `Showing all ${allOptions.length} affixes`);
    header.appendChild(countInfo);
    popover.appendChild(header);

    const listWrap = el('div', 'searchable-select-options');
    popover.appendChild(listWrap);
    container.appendChild(popover);

    function normalizeTokens(q) {
      let s = (q || '').toLowerCase().trim();
      s = s.replace(/\bsurfix(es)?\b/g, 'suffix')
           .replace(/\bpreffix(es)?\b/g, 'prefix')
           .replace(/\bimplicits?\b/g, 'implicit')
           .replace(/\bsuffixes\b/g, 'suffix')
           .replace(/\bprefixes\b/g, 'prefix')
           .replace(/\bothers?\b/g, 'other')
           .replace(/\ball\b/g, '')
           .replace(/\s+/g, ' ')
           .trim();
      return s ? s.split(' ').filter(Boolean) : [];
    }

    function filterOptions(query) {
      const tokens = normalizeTokens(query);
      clearBtn.style.display = query.trim() ? 'inline-flex' : 'none';

      let filtered = allOptions;
      if (activeCat === 'Recommended') {
        filtered = filtered.filter(opt => opt.isCompatible);
      } else if (activeCat !== 'All') {
        filtered = filtered.filter(opt => opt.kind === activeCat);
      }

      if (tokens.length > 0) {
        filtered = filtered.filter(opt => {
          const nameLower = opt.name.toLowerCase();
          const localLower = (opt.localTitle || '').toLowerCase();
          const tooltipLower = (opt.tooltip || '').toLowerCase();
          const kindLower = opt.kind.toLowerCase();
          const keyLower = opt.key.toLowerCase();
          const allowedLower = (opt.allowedCats || '').toLowerCase();
          const reasonLower = (opt.compatReason || '').toLowerCase();

          return tokens.every(tok => {
            return nameLower.includes(tok) ||
                   localLower.includes(tok) ||
                   tooltipLower.includes(tok) ||
                   kindLower.includes(tok) ||
                   keyLower.includes(tok) ||
                   allowedLower.includes(tok) ||
                   reasonLower.includes(tok);
          });
        });
      }

      // Sort: Compatible first, then alphabetical
      filtered = filtered.slice().sort((a, b) => {
        if (a.isCompatible !== b.isCompatible) return a.isCompatible ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      currentFilteredList = filtered;
      activeIndex = filtered.findIndex(opt => opt.key === currentPath);
      if (activeIndex < 0 && filtered.length > 0) activeIndex = 0;

      renderList(filtered, tokens);
      let catLabel = activeCat;
      if (activeCat === 'Recommended') catLabel = 'Phù hợp';
      countInfo.textContent = filtered.length === allOptions.length
        ? `Showing all ${allOptions.length} affixes`
        : `Showing ${filtered.length} of ${allOptions.length} affixes${activeCat !== 'All' ? ` (${catLabel})` : ''}`;
    }

    function highlightMatches(text, tokens) {
      if (!tokens || !tokens.length) return escapeHtml(text);
      const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean);
      if (!escaped.length) return escapeHtml(text);
      const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
      return escapeHtml(text).replace(regex, '<mark>$1</mark>');
    }

    function renderList(items, tokens) {
      listWrap.innerHTML = '';
      if (!items.length) {
        const empty = el('div', 'searchable-select-empty', 'No matching affixes found.');
        listWrap.appendChild(empty);
        return;
      }

      const showGroupHeaders = (activeCat === 'All' && tokens.length === 0);
      let lastKind = null;

      items.forEach((item, idx) => {
        if (showGroupHeaders && item.kind !== lastKind) {
          lastKind = item.kind;
          const gh = el('div', 'searchable-select-optgroup-title', `${item.kind} Affixes`);
          listWrap.appendChild(gh);
        }

        const isCur = (item.key === currentPath);
        const row = el('div', 'searchable-select-option' + (isCur ? ' is-selected' : '') + (idx === activeIndex ? ' is-highlighted' : '') + (!item.isCompatible ? ' is-incompatible' : ''));
        row.dataset.index = idx;

        const badge = el('span', 'kind k-' + item.kind, item.kind);
        const optContent = el('div', 'opt-content');

        const titleSpan = el('div', 'opt-title');
        let titleHtml = '';
        if (item.localTitle) {
          titleHtml = highlightMatches(item.localTitle, tokens);
          if (item.name && item.name !== item.localTitle) {
            titleHtml += ` <span class="opt-local">(${highlightMatches(item.name, tokens)})</span>`;
          }
        } else {
          titleHtml = highlightMatches(item.name, tokens);
        }

        // Add badges
        let tagHtml = '';
        if (item.isCompatible) {
          tagHtml += ` <span class="badge-pill badge-ok">✓ Phù hợp</span>`;
        } else {
          tagHtml += ` <span class="badge-pill badge-warn" title="${escapeHtml(item.compatReason)}">❌ Sai vị trí (${escapeHtml(item.compatReason)})</span>`;
        }
        titleSpan.innerHTML = titleHtml + tagHtml;
        optContent.appendChild(titleSpan);

        if (item.tooltip) {
          const descSpan = el('div', 'opt-desc');
          descSpan.innerHTML = highlightMatches(item.tooltip, tokens);
          optContent.appendChild(descSpan);
        }

        const subSpan = el('div', 'opt-sub');
        const shortAsset = item.key.split('/').pop().replace(/\.da_.*$/, '');
        let subText = `Slot: ${highlightMatches(item.allowedCats || 'Any', tokens)} · <span class="opt-key">${highlightMatches(shortAsset, tokens)}</span>`;
        if (!item.isCompatible) {
          subText += ` · <span style="color:#ff8b85">${escapeHtml(item.compatReason)}</span>`;
        }
        subSpan.innerHTML = subText;
        optContent.appendChild(subSpan);

        row.appendChild(badge);
        row.appendChild(optContent);

        if (isCur) {
          const check = el('span', 'searchable-select-check', '✓');
          row.appendChild(check);
        }

        row.onclick = (e) => {
          e.stopPropagation();
          selectItem(item.key);
        };

        row.onmouseenter = () => {
          activeIndex = idx;
          updateHighlight();
        };

        listWrap.appendChild(row);
      });

      scrollActiveIntoView();
    }

    function updateHighlight() {
      const rows = listWrap.querySelectorAll('.searchable-select-option');
      rows.forEach((r, i) => {
        if (i === activeIndex) r.classList.add('is-highlighted');
        else r.classList.remove('is-highlighted');
      });
    }

    function scrollActiveIntoView() {
      const activeEl = listWrap.querySelector(`.searchable-select-option[data-index="${activeIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }

    function selectItem(key) {
      closePopover();
      if (key !== currentPath) {
        onSelect(key);
      }
    }

    function handleKeyNavigation(e) {
      if (!popover) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentFilteredList.length > 0) {
          activeIndex = (activeIndex + 1) % currentFilteredList.length;
          updateHighlight();
          scrollActiveIntoView();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentFilteredList.length > 0) {
          activeIndex = (activeIndex - 1 + currentFilteredList.length) % currentFilteredList.length;
          updateHighlight();
          scrollActiveIntoView();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < currentFilteredList.length) {
          selectItem(currentFilteredList[activeIndex].key);
        }
      }
    }

    searchInput.addEventListener('keydown', handleKeyNavigation);
    searchInput.addEventListener('input', (e) => filterOptions(e.target.value));

    filterOptions('');

    setTimeout(() => {
      searchInput.focus();
      document.addEventListener('pointerdown', handleOutsideClick);
      document.addEventListener('keydown', handleGlobalKeydown);
    }, 20);
  }

  trigger.onclick = (e) => {
    e.stopPropagation();
    if (container.classList.contains('is-open')) closePopover();
    else openPopover();
  };

  container._closePopover = closePopover;
  if (autoOpen) {
    setTimeout(() => openPopover(), 50);
  }
  return container;
}

function createSearchableSlotSelect(catObj, current, abilityName, onPick, taken) {
  const container = el('div', 'searchable-select');
  const trigger = el('button', 'searchable-select-trigger');
  trigger.type = 'button';

  const short = k => k.split('/').pop().split('.')[0]
    .replace(/^bp_(gam|bge)_player_/, '').replace(/^(st|ea|wa|hu|ne|de|ro|sp|core|generic|fo)_/, '').replace(/_p$/, '')
    .replace(/_/g, ' ');

  const currentLabel = (!current || current === 'None')
    ? '— None (Empty Slot) —'
    : (short(current) + (!catObj[current] ? ' (from file)' : ''));

  const triggerContent = el('div', 'trigger-content');
  const labelSpan = el('span', 'searchable-select-label', currentLabel);
  triggerContent.appendChild(labelSpan);

  const chevron = el('span', 'searchable-select-chevron', '▼');
  trigger.appendChild(triggerContent);
  trigger.appendChild(chevron);
  container.appendChild(trigger);

  let popover = null;
  let activeIndex = -1;
  let currentFilteredList = [];

  function closePopover() {
    if (popover && popover.parentNode) {
      popover.parentNode.removeChild(popover);
      popover = null;
      container.classList.remove('is-open');
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleGlobalKeydown);
    }
  }

  function handleOutsideClick(e) {
    if (!container.contains(e.target) && (!popover || !popover.contains(e.target))) {
      closePopover();
    }
  }

  function handleGlobalKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePopover();
      trigger.focus();
    }
  }

  function openPopover() {
    $$('.searchable-select.is-open').forEach(other => {
      if (other !== container && other._closePopover) other._closePopover();
    });

    container.classList.add('is-open');
    popover = el('div', 'searchable-select-popover');

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 360 && rect.top > 360) {
      popover.style.top = 'auto';
      popover.style.bottom = 'calc(100% + 4px)';
    }

    const header = el('div', 'searchable-select-search-wrap');
    const searchRow = el('div', 'searchable-select-search-row');
    const searchIcon = el('span', 'searchable-select-search-icon', '🔍');
    const searchInput = el('input', 'searchable-select-search-input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search modifier or feat...';
    searchInput.autocomplete = 'off';

    const clearBtn = el('button', 'searchable-select-clear-btn', '✕');
    clearBtn.type = 'button';
    clearBtn.title = 'Clear search';
    clearBtn.style.display = 'none';
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      searchInput.value = '';
      clearBtn.style.display = 'none';
      filterOptions('');
      searchInput.focus();
    };

    searchRow.appendChild(searchIcon);
    searchRow.appendChild(searchInput);
    searchRow.appendChild(clearBtn);
    header.appendChild(searchRow);

    const keys = Object.keys(catObj);
    const fit = keys.filter(k => (catObj[k].ab || []).indexOf(abilityName) >= 0
      || k.toLowerCase().indexOf(String(abilityName).toLowerCase()) >= 0);
    const rest = keys.filter(k => fit.indexOf(k) < 0);

    const allOptions = [
      { key: '', name: '— None (Empty Slot) —', group: 'Default', isNone: true }
    ];

    if (current && current !== 'None' && !catObj[current]) {
      allOptions.push({ key: current, name: short(current) + ' (from file)', group: 'Custom', isFileExtra: true });
    }

    for (const k of fit.sort()) {
      const busy = taken && taken.has(k) && k !== current;
      allOptions.push({ key: k, name: short(k) + (busy ? ' (used)' : ''), group: 'Recommended', isRec: true, busy: !!busy });
    }
    for (const k of rest.sort()) {
      const busy = taken && taken.has(k) && k !== current;
      allOptions.push({ key: k, name: short(k) + (busy ? ' (used)' : ''), group: 'All Known', isRec: false, busy: !!busy });
    }

    const pillsRow = el('div', 'searchable-select-pills');
    let activeFilter = 'All';

    const pillLabels = [
      { id: 'All', label: `All (${allOptions.length})` },
      { id: 'Rec', label: `Recommended (${fit.length})` }
    ];
    pillLabels.forEach(pDef => {
      const p = el('button', 's-pill' + (pDef.id === 'All' ? ' active' : ''), pDef.label);
      p.type = 'button';
      p.onclick = (e) => {
        e.stopPropagation();
        pillsRow.querySelectorAll('.s-pill').forEach(b => b.classList.remove('active'));
        p.classList.add('active');
        activeFilter = pDef.id;
        filterOptions(searchInput.value);
      };
      pillsRow.appendChild(p);
    });
    header.appendChild(pillsRow);

    const countInfo = el('div', 'searchable-select-count', `Showing all ${allOptions.length} options`);
    header.appendChild(countInfo);
    popover.appendChild(header);

    const listWrap = el('div', 'searchable-select-options');
    popover.appendChild(listWrap);

    function filterOptions(rawQuery) {
      const q = (rawQuery || '').toLowerCase().trim();
      clearBtn.style.display = rawQuery ? 'block' : 'none';

      let filtered = allOptions;
      if (activeFilter === 'Rec') {
        filtered = filtered.filter(opt => opt.isNone || opt.isRec);
      }

      if (q) {
        filtered = filtered.filter(opt => opt.name.toLowerCase().includes(q) || opt.key.toLowerCase().includes(q));
      }

      currentFilteredList = filtered;
      activeIndex = filtered.findIndex(opt => opt.key === (current === 'None' ? '' : current));
      if (activeIndex < 0 && filtered.length > 0) activeIndex = 0;

      renderList(filtered, q);
      countInfo.textContent = `Showing ${filtered.length} of ${allOptions.length} options`;
    }

    function highlightMatches(text, q) {
      if (!q) return escapeHtml(text);
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      return escapeHtml(text).replace(regex, '<mark>$1</mark>');
    }

    function renderList(items, q) {
      listWrap.innerHTML = '';
      if (!items.length) {
        listWrap.appendChild(el('div', 'searchable-select-empty', 'No matching modifiers found.'));
        return;
      }

      const showHeaders = (!q && activeFilter === 'All');
      let lastGroup = null;

      items.forEach((item, idx) => {
        if (showHeaders && item.group !== lastGroup) {
          lastGroup = item.group;
          const gh = el('div', 'searchable-select-optgroup-title', item.group);
          listWrap.appendChild(gh);
        }

        const isCur = (item.key === current || (item.key === '' && (!current || current === 'None')));
        const row = el('div', 'searchable-select-option' + (isCur ? ' is-selected' : '') + (idx === activeIndex ? ' is-highlighted' : '') + (item.busy ? ' is-busy' : ''));
        row.dataset.index = idx;

        const optContent = el('div', 'opt-content');
        const titleSpan = el('div', 'opt-title');
        titleSpan.innerHTML = highlightMatches(item.name, q);
        optContent.appendChild(titleSpan);

        if (item.isRec) {
          const recBadge = el('span', 'kind k-Implicit', 'Recommended');
          row.appendChild(recBadge);
        }

        row.appendChild(optContent);

        if (isCur) {
          const check = el('span', 'searchable-select-check', '✓');
          row.appendChild(check);
        }

        row.onclick = (e) => {
          e.stopPropagation();
          selectItem(item.key);
        };

        row.onmouseenter = () => {
          activeIndex = idx;
          updateHighlight();
        };

        listWrap.appendChild(row);
      });

      scrollActiveIntoView();
    }

    function updateHighlight() {
      const rows = listWrap.querySelectorAll('.searchable-select-option');
      rows.forEach((r, i) => {
        if (i === activeIndex) r.classList.add('is-highlighted');
        else r.classList.remove('is-highlighted');
      });
    }

    function scrollActiveIntoView() {
      const activeEl = listWrap.querySelector(`.searchable-select-option[data-index="${activeIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }

    function selectItem(key) {
      closePopover();
      onPick(key);
    }

    searchInput.onkeydown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentFilteredList.length > 0) {
          activeIndex = (activeIndex + 1) % currentFilteredList.length;
          updateHighlight();
          scrollActiveIntoView();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentFilteredList.length > 0) {
          activeIndex = (activeIndex - 1 + currentFilteredList.length) % currentFilteredList.length;
          updateHighlight();
          scrollActiveIntoView();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentFilteredList[activeIndex]) {
          selectItem(currentFilteredList[activeIndex].key);
        }
      } else if (e.key === 'Tab') {
        closePopover();
      }
    };

    searchInput.oninput = () => {
      filterOptions(searchInput.value);
    };

    container.appendChild(popover);
    filterOptions('');

    setTimeout(() => {
      searchInput.focus();
      searchInput.select();
    }, 20);

    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleGlobalKeydown);
  }

  container._openPopover = openPopover;
  container._closePopover = closePopover;

  trigger.onclick = (e) => {
    e.stopPropagation();
    if (popover) closePopover();
    else openPopover();
  };

  return container;
}

function createSearchableSubAffixSelect({ onSelect, itemAsset, buttonText, buttonClass }) {
  const container = el('div', 'searchable-select searchable-sub-select');

  const trigger = el('button', buttonClass || 'btn tiny ghost primary searchable-select-trigger');
  trigger.type = 'button';
  trigger.style.display = 'inline-flex';
  trigger.style.alignItems = 'center';
  trigger.style.gap = '6px';
  trigger.style.whiteSpace = 'nowrap';

  const triggerContent = el('div', 'trigger-content');
  const labelSpan = el('span', 'searchable-select-label', buttonText || '➕ Gộp thêm Suffix / Prefix / Chỉ số...');
  triggerContent.appendChild(labelSpan);

  const chevron = el('span', 'searchable-select-chevron', '▼');
  trigger.appendChild(triggerContent);
  trigger.appendChild(chevron);
  container.appendChild(trigger);

  let popover = null;
  let activeIndex = -1;
  let currentFilteredList = [];

  function closePopover() {
    if (popover && popover.parentNode) {
      popover.parentNode.removeChild(popover);
      popover = null;
      container.classList.remove('is-open');
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleGlobalKeydown);
    }
  }

  function handleOutsideClick(e) {
    if (!container.contains(e.target) && (!popover || !popover.contains(e.target))) {
      closePopover();
    }
  }

  function handleGlobalKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePopover();
      trigger.focus();
    }
  }

  function openPopover() {
    $$('.searchable-select.is-open').forEach(other => {
      if (other !== container && other._closePopover) other._closePopover();
    });

    container.classList.add('is-open');
    popover = el('div', 'searchable-select-popover');
    popover.style.minWidth = '380px';
    popover.style.maxWidth = '560px';

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 380 && rect.top > 380) {
      popover.style.top = 'auto';
      popover.style.bottom = 'calc(100% + 4px)';
    }

    const header = el('div', 'searchable-select-search-wrap');
    const searchRow = el('div', 'searchable-select-search-row');
    const searchIcon = el('span', 'searchable-select-search-icon', '🔍');
    const searchInput = el('input', 'searchable-select-search-input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Tìm Suffix, Prefix, Tinh thông, Kháng, Sát thương, Thuộc tính để gộp...';
    searchInput.autocomplete = 'off';
    searchInput.spellcheck = false;

    const clearBtn = el('button', 'searchable-select-clear-btn', '✕');
    clearBtn.type = 'button';
    clearBtn.title = 'Clear search';
    clearBtn.style.display = 'none';
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      searchInput.value = '';
      clearBtn.style.display = 'none';
      filterOptions('');
      searchInput.focus();
    };

    searchRow.appendChild(searchIcon);
    searchRow.appendChild(searchInput);
    searchRow.appendChild(clearBtn);
    header.appendChild(searchRow);

    const CAT = app.state.CAT;
    const slotType = T.getItemSlotType ? T.getItemSlotType(itemAsset) : 'misc';
    const catCounts = { 'All': 0, 'Recommended': 0, 'Popular': 0, 'Mastery': 0, 'Attack': 0, 'Defense': 0, 'Prefix': 0, 'Suffix': 0, 'Unique': 0 };
    const allOptions = [];

    for (const k of (CAT.keys || Object.keys(CAT.a))) {
      const kKind = T.affixKind(k);
      const kName = T.affixShortName(k);
      const meta = (CAT.names && CAT.names[k]) || {};
      const localTitle = meta.title || '';
      const tooltip = meta.tooltip || '';
      const info = CAT.a[k] || {};
      const allowed = (info.cs ? info.cs.join(', ') : (info.c || ''));
      const comp = T.checkAffixSlotCompatibility ? T.checkAffixSlotCompatibility(k, slotType) : { compatible: true, reason: 'Universal' };
      const ges = info.g || [];
      const isMastery = k.includes('ActiveCapacity') || k.includes('PassiveLevel') || k.includes('PointsTo');
      const isAttack = k.includes('Dmg') || k.includes('Speed') || k.includes('Crit') || k.includes('Damage') || k.includes('Strike');
      const isDefense = k.includes('Res') || k.includes('Armor') || k.includes('Health') || k.includes('Barrier') || k.includes('Deflect') || k.includes('Glancing');
      const isPopular = isMastery || k.includes('Might') || k.includes('Agility') || k.includes('Knowledge') || k.includes('Vigor') || k.includes('AttackSpeed') || k.includes('CritChance') || k.includes('Res') || k.includes('EnergyRegen');

      allOptions.push({
        key: k,
        name: kName,
        localTitle: localTitle,
        tooltip: tooltip,
        kind: kKind,
        info: info,
        ges: ges,
        maxLevel: meta.maxLevel !== undefined ? meta.maxLevel : (info.maxLevel || 5),
        tiers: meta.tiers || info.tiers || {},
        tierTooltips: meta.tierTooltips || info.tierTooltips || {},
        allowedCats: allowed,
        isCompatible: comp.compatible,
        compatReason: comp.reason,
        isMastery,
        isAttack,
        isDefense,
        isPopular
      });

      catCounts['All']++;
      if (comp.compatible) catCounts['Recommended']++;
      if (isPopular) catCounts['Popular']++;
      if (isMastery) catCounts['Mastery']++;
      if (isAttack) catCounts['Attack']++;
      if (isDefense) catCounts['Defense']++;
      if (catCounts[kKind] !== undefined) catCounts[kKind]++;
    }

    const pillsRow = el('div', 'searchable-select-pills');
    let activeCat = 'Popular';

    const pillDefs = [
      { id: 'Popular', label: '⭐ Phổ biến' },
      { id: 'Mastery', label: '🔥 Kỹ năng' },
      { id: 'Recommended', label: '✨ Phù hợp' },
      { id: 'Attack', label: '⚔️ Tấn công' },
      { id: 'Defense', label: '🛡️ Phòng thủ' },
      { id: 'Prefix', label: 'Prefix' },
      { id: 'Suffix', label: 'Suffix' },
      { id: 'All', label: 'Tất cả' }
    ];

    pillDefs.forEach(pDef => {
      const cat = pDef.id;
      const count = catCounts[cat] || 0;
      const p = el('button', 's-pill sp-' + cat + (cat === activeCat ? ' active' : ''), `${pDef.label} (${count})`);
      p.type = 'button';
      p.onclick = (e) => {
        e.stopPropagation();
        pillsRow.querySelectorAll('.s-pill').forEach(b => b.classList.remove('active'));
        p.classList.add('active');
        activeCat = cat;
        filterOptions(searchInput.value);
      };
      pillsRow.appendChild(p);
    });
    header.appendChild(pillsRow);

    const countInfo = el('div', 'searchable-select-count', `Showing all ${allOptions.length} affixes`);
    header.appendChild(countInfo);
    popover.appendChild(header);

    const listWrap = el('div', 'searchable-select-options');
    popover.appendChild(listWrap);
    container.appendChild(popover);

    function normalizeTokens(q) {
      let s = (q || '').toLowerCase().trim();
      s = s.replace(/\bsurfix(es)?\b/g, 'suffix')
           .replace(/\bpreffix(es)?\b/g, 'prefix')
           .replace(/\bimplicits?\b/g, 'implicit')
           .replace(/\bsuffixes\b/g, 'suffix')
           .replace(/\bprefixes\b/g, 'prefix')
           .replace(/\bothers?\b/g, 'other')
           .replace(/\ball\b/g, '')
           .replace(/\s+/g, ' ')
           .trim();
      return s ? s.split(' ').filter(Boolean) : [];
    }

    function filterOptions(query) {
      const tokens = normalizeTokens(query);
      clearBtn.style.display = query.trim() ? 'inline-flex' : 'none';

      let filtered = allOptions;
      if (activeCat === 'Recommended') {
        filtered = filtered.filter(opt => opt.isCompatible);
      } else if (activeCat === 'Popular') {
        filtered = filtered.filter(opt => opt.isPopular);
      } else if (activeCat === 'Mastery') {
        filtered = filtered.filter(opt => opt.isMastery);
      } else if (activeCat === 'Attack') {
        filtered = filtered.filter(opt => opt.isAttack);
      } else if (activeCat === 'Defense') {
        filtered = filtered.filter(opt => opt.isDefense);
      } else if (activeCat !== 'All') {
        filtered = filtered.filter(opt => opt.kind === activeCat);
      }

      if (tokens.length > 0) {
        filtered = filtered.filter(opt => {
          const nameLower = opt.name.toLowerCase();
          const localLower = (opt.localTitle || '').toLowerCase();
          const tooltipLower = (opt.tooltip || '').toLowerCase();
          const kindLower = opt.kind.toLowerCase();
          const keyLower = opt.key.toLowerCase();
          const allowedLower = (opt.allowedCats || '').toLowerCase();
          const reasonLower = (opt.compatReason || '').toLowerCase();

          return tokens.every(tok => {
            return nameLower.includes(tok) ||
                   localLower.includes(tok) ||
                   tooltipLower.includes(tok) ||
                   kindLower.includes(tok) ||
                   keyLower.includes(tok) ||
                   allowedLower.includes(tok) ||
                   reasonLower.includes(tok);
          });
        });
      }

      // Sort: Compatible first, then popular, then alphabetical
      filtered = filtered.slice().sort((a, b) => {
        if (a.isCompatible !== b.isCompatible) return a.isCompatible ? -1 : 1;
        if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      currentFilteredList = filtered;
      activeIndex = filtered.length > 0 ? 0 : -1;

      renderList(filtered, tokens);
      const catDef = pillDefs.find(p => p.id === activeCat);
      const catLabel = catDef ? catDef.label : activeCat;
      countInfo.textContent = filtered.length === allOptions.length
        ? `Showing all ${allOptions.length} affixes`
        : `Showing ${filtered.length} of ${allOptions.length} affixes (${catLabel})`;
    }

    function highlightMatches(text, tokens) {
      if (!tokens || !tokens.length) return escapeHtml(text);
      const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean);
      if (!escaped.length) return escapeHtml(text);
      const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
      return escapeHtml(text).replace(regex, '<mark>$1</mark>');
    }

    function renderList(items, tokens) {
      listWrap.innerHTML = '';
      if (!items.length) {
        const empty = el('div', 'searchable-select-empty', 'No matching stats found.');
        listWrap.appendChild(empty);
        return;
      }

      items.forEach((item, idx) => {
        const row = el('div', 'searchable-select-option' + (idx === activeIndex ? ' is-highlighted' : '') + (!item.isCompatible ? ' is-incompatible' : ''));
        row.dataset.index = idx;

        const badge = el('span', 'kind k-' + item.kind, item.kind);
        const optContent = el('div', 'opt-content');

        const titleSpan = el('div', 'opt-title');
        let titleHtml = '';
        if (item.localTitle) {
          titleHtml = highlightMatches(item.localTitle, tokens);
          if (item.name && item.name !== item.localTitle) {
            titleHtml += ` <span class="opt-local">(${highlightMatches(item.name, tokens)})</span>`;
          }
        } else {
          titleHtml = highlightMatches(item.name, tokens);
        }

        // Add badges
        let tagHtml = '';
        if (item.isCompatible) {
          tagHtml += ` <span class="badge-pill badge-ok">✓ Phù hợp</span>`;
        } else {
          tagHtml += ` <span class="badge-pill badge-warn" title="${escapeHtml(item.compatReason)}">❌ Sai vị trí</span>`;
        }
        titleSpan.innerHTML = titleHtml + tagHtml;
        optContent.appendChild(titleSpan);

        if (item.tooltip) {
          const descSpan = el('div', 'opt-desc');
          descSpan.innerHTML = highlightMatches(item.tooltip, tokens);
          optContent.appendChild(descSpan);
        }

        const subSpan = el('div', 'opt-sub');
        const shortAsset = item.key.split('/').pop().replace(/\.da_.*$/, '');
        let subText = `Slot: ${highlightMatches(item.allowedCats || 'Any', tokens)} · <span class="opt-key">${highlightMatches(shortAsset, tokens)}</span>`;
        if (item.maxLevel > 0) {
          subText += ` · <span class="badge-pill badge-auth">Max Tier ${item.maxLevel}</span>`;
        }
        subSpan.innerHTML = subText;
        optContent.appendChild(subSpan);

        row.appendChild(badge);
        row.appendChild(optContent);

        const addPlus = el('span', 'searchable-select-check', '➕ Gộp');
        addPlus.style.fontSize = '11px';
        addPlus.style.fontWeight = '600';
        addPlus.style.color = 'var(--gold-primary)';
        row.appendChild(addPlus);

        row.onclick = (e) => {
          e.stopPropagation();
          selectItem(item);
        };

        row.onmouseenter = () => {
          activeIndex = idx;
          updateHighlight();
        };

        listWrap.appendChild(row);
      });

      scrollActiveIntoView();
    }

    function updateHighlight() {
      const rows = listWrap.querySelectorAll('.searchable-select-option');
      rows.forEach((r, i) => {
        if (i === activeIndex) r.classList.add('is-highlighted');
        else r.classList.remove('is-highlighted');
      });
    }

    function scrollActiveIntoView() {
      const activeEl = listWrap.querySelector(`.searchable-select-option[data-index="${activeIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }

    function selectItem(item) {
      closePopover();
      if (onSelect) {
        onSelect(item);
      }
    }

    function handleKeyNavigation(e) {
      if (!popover) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentFilteredList.length > 0) {
          activeIndex = (activeIndex + 1) % currentFilteredList.length;
          updateHighlight();
          scrollActiveIntoView();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentFilteredList.length > 0) {
          activeIndex = (activeIndex - 1 + currentFilteredList.length) % currentFilteredList.length;
          updateHighlight();
          scrollActiveIntoView();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < currentFilteredList.length) {
          selectItem(currentFilteredList[activeIndex]);
        }
      }
    }

    searchInput.addEventListener('keydown', handleKeyNavigation);
    searchInput.addEventListener('input', (e) => filterOptions(e.target.value));

    filterOptions('');

    setTimeout(() => {
      searchInput.focus();
      document.addEventListener('pointerdown', handleOutsideClick);
      document.addEventListener('keydown', handleGlobalKeydown);
    }, 20);
  }

  trigger.onclick = (e) => {
    e.stopPropagation();
    if (container.classList.contains('is-open')) closePopover();
    else openPopover();
  };

  container._closePopover = closePopover;
  return container;
}

function slotSelect(catObj, current, abilityName, onPick, taken) {
  return createSearchableSlotSelect(catObj, current, abilityName, onPick, taken);
}

// Attach to TQ2App
app.numField = numField;
app.scalarField = scalarField;
app.selField = selField;
app.createSearchableBaseItemSelect = createSearchableBaseItemSelect;
app.createSearchableAffixSelect = createSearchableAffixSelect;
app.createSearchableSubAffixSelect = createSearchableSubAffixSelect;
app.createSearchableSlotSelect = createSearchableSlotSelect;
app.slotSelect = slotSelect;

})(typeof globalThis !== 'undefined' ? globalThis : this);
