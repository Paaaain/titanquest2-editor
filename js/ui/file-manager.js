/* SaveGames File & Profile Manager, Storage & Modals for Titan Quest II Save Editor */
(function (root) {
'use strict';

const app = root.TQ2App;
const G = app.G, T = app.T;
const t = (k, p) => (app && typeof app.t === 'function' ? app.t(k, p) : (p ? k : k));
const $ = app.$, $$ = app.$$, el = app.el, elHtml = app.elHtml, escapeHtml = app.escapeHtml;
const log = app.log, toast = app.toast;

/* ---------- SaveGames Folder & Profile Scanner ---------- */
function scanFileList(fileList) {
  const profilesMap = new Map();
  const shared = [];
  app.state.loadedFolderFiles.clear();

  for (const f of fileList) {
    const fileName = f.name;
    app.state.loadedFolderFiles.set(fileName, f);

    if (!fileName.endsWith('.sav')) continue;

    if (fileName.startsWith('PublicCrossCharacterSaveData')) {
      shared.push(fileName);
      continue;
    }

    if (fileName === 'Saving.sav' || fileName === 'SharedGameSettings.sav' || fileName === 'EnhancedInputUserSettings.sav') {
      continue;
    }

    const m = fileName.match(/^(.*?)_(\d{4}-\d{2}-\d{2}(?:--\d{2}-\d{2}-\d{2})?)_(Data_Player|Data_PlayerLocal|Data_WorldCampaign|Data_WorldFluff|Header)\.sav$/i);
    if (m) {
      const charName = m[1];
      const timestamp = m[2];
      const type = m[3];
      const prefix = `${charName}_${timestamp}`;
      if (!profilesMap.has(prefix)) {
        profilesMap.set(prefix, {
          prefix,
          charName,
          timestamp: timestamp.replace(/--/, ' ').replace(/-/g, ':'),
          files: {},
          level: null,
          playtime: null,
        });
      }
      profilesMap.get(prefix).files[type] = fileName;
    } else {
      const pm = fileName.match(/^(.*?)_(Data_Player|Data_PlayerLocal|Data_WorldCampaign|Data_WorldFluff|Header)\.sav$/i);
      if (pm) {
        const prefix = pm[1];
        if (!profilesMap.has(prefix)) {
          profilesMap.set(prefix, {
            prefix,
            charName: prefix,
            timestamp: '',
            files: {},
            level: null,
            playtime: null,
          });
        }
        profilesMap.get(prefix).files[pm[2]] = fileName;
      }
    }
  }

  app.state.discoveredProfiles = Array.from(profilesMap.values());
  app.state.sharedStashFiles = shared;
  return { profiles: app.state.discoveredProfiles, shared };
}

async function handleFolderSelection(fileList) {
  const { profiles, shared } = scanFileList(fileList);
  log(`Scanned SaveGames: ${fileList.length} files, ${profiles.length} character profile(s).`, false, true);

  if (!profiles.length && !shared.length) {
    await addFiles(Array.from(fileList).filter(f => f.name.endsWith('.sav')));
    return;
  }

  for (const prof of profiles) {
    if (prof.files.Header && app.state.loadedFolderFiles.has(prof.files.Header)) {
      try {
        const buf = new Uint8Array(await app.state.loadedFolderFiles.get(prof.files.Header).arrayBuffer());
        const s = G.parseSave(buf);
        const nameP = s.root.get('m_CharacterName'), lvlP = s.root.get('m_Level'), playP = s.root.get('m_TotalPlayTimeSeconds');
        if (nameP && nameP.value instanceof G.Scalar) prof.charName = nameP.value.v;
        if (lvlP && lvlP.value instanceof G.Scalar) prof.level = lvlP.value.v;
        if (playP && playP.value instanceof G.Scalar) {
          const sec = Number(playP.value.v);
          prof.playtime = `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
        }
      } catch (e) { /* ignore */ }
    } else if (prof.files.Data_Player && app.state.loadedFolderFiles.has(prof.files.Data_Player)) {
      try {
        const buf = new Uint8Array(await app.state.loadedFolderFiles.get(prof.files.Data_Player).arrayBuffer());
        const s = G.parseSave(buf);
        const sg = T.sgds(s);
        if (sg.TQ2CharacterAttributes && sg.TQ2CharacterAttributes.body instanceof G.PropList) {
          const lvl = sg.TQ2CharacterAttributes.body.get('m_CharacterLevel');
          if (lvl && lvl.value instanceof G.Scalar) prof.level = lvl.value.v;
        }
      } catch (e) { /* ignore */ }
    }
  }

  if (profiles.length === 1) {
    await loadProfile(profiles[0], shared.length > 0);
    return;
  }

  showProfileSelectModal(profiles, shared);
}

function showProfileSelectModal(profiles, shared) {
  const existing = $('.modal-overlay');
  if (existing) existing.remove();

  const overlay = el('div', 'modal-overlay');
  const box = el('div', 'modal-box');
  box.appendChild(el('h3', '', t('modals.profile_modal_title')));
  box.appendChild(el('div', 'm-sub', t('modals.profile_modal_sub', { count: profiles.length })));

  const list = el('div', 'profile-grid');
  profiles.forEach(prof => {
    const isAct = (app.state.activeProfile && app.state.activeProfile.prefix === prof.prefix);
    const card = el('div', 'profile-card' + (isAct ? ' active-prof' : ''));
    const info = el('div', 'profile-info');
    const avatar = el('div', 'profile-avatar', (prof.charName || 'Ω').charAt(0).toUpperCase());
    info.appendChild(avatar);

    const meta = el('div', 'profile-meta');
    meta.appendChild(el('div', 'profile-name', prof.charName + (prof.level ? ` (Level ${prof.level})` : '') + (isAct ? ` ${t('modals.profile_active_badge')}` : '')));
    const det = [];
    if (prof.timestamp) det.push(t('modals.profile_saved', { time: prof.timestamp }));
    if (prof.playtime) det.push(t('modals.profile_playtime', { time: prof.playtime }));
    meta.appendChild(el('div', 'profile-details', det.join(' • ') || 'TQ2 Character Save'));

    const fileTypes = Object.keys(prof.files).join(', ');
    meta.appendChild(el('div', 'profile-files-tag', t('modals.profile_files', { files: fileTypes || 'Player, Local, Header' })));
    info.appendChild(meta);
    card.appendChild(info);

    const selectBtn = el('button', 'btn', isAct ? t('modals.profile_reload_btn') : t('modals.profile_edit_btn'));
    selectBtn.onclick = async () => {
      overlay.remove();
      await loadProfile(prof, includeStashCheckbox.checked);
    };
    card.appendChild(selectBtn);
    list.appendChild(card);
  });
  box.appendChild(list);

  const stashRow = el('label', 'arow');
  stashRow.style.fontSize = '12px';
  stashRow.style.cursor = 'pointer';
  stashRow.style.margin = '10px 0';
  const includeStashCheckbox = el('input');
  includeStashCheckbox.type = 'checkbox';
  includeStashCheckbox.checked = true;
  stashRow.appendChild(includeStashCheckbox);
  stashRow.appendChild(document.createTextNode(' ' + t('modals.profile_include_shared')));
  box.appendChild(stashRow);

  const actions = el('div', 'modal-actions');
  const cancelBtn = el('button', 'btn ghost tiny', t('modals.modal_close'));
  cancelBtn.onclick = () => overlay.remove();
  actions.appendChild(cancelBtn);
  box.appendChild(actions);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

async function loadProfile(prof, includeStash = true) {
  app.state.files.length = 0;
  app.state.activeProfile = prof;

  const toLoad = [];
  ['Data_Player', 'Data_PlayerLocal', 'Header'].forEach(k => {
    if (prof.files[k] && app.state.loadedFolderFiles.has(prof.files[k])) {
      toLoad.push(app.state.loadedFolderFiles.get(prof.files[k]));
    }
  });

  if (includeStash) {
    app.state.sharedStashFiles.forEach(sName => {
      if (app.state.loadedFolderFiles.has(sName)) toLoad.push(app.state.loadedFolderFiles.get(sName));
    });
  }

  await addFiles(toLoad);
  updateActiveCharacterHeader(prof.charName, prof.level, prof.playtime);
  toast(`Loaded ${prof.charName} into unified view!`, 'succ');
}

function updateActiveCharacterHeader(name, level, playtime, classTitle = null) {
  const heroBox = $('#char-hero');
  if (heroBox) heroBox.style.display = 'flex';
  const heroAvatar = $('#hero-avatar');
  if (heroAvatar) heroAvatar.textContent = (name || 'Ω').charAt(0).toUpperCase();
  const heroName = $('#hero-name');
  if (heroName) heroName.textContent = name || 'Hero';
  const heroDetails = $('#hero-details');
  if (heroDetails) {
    let titleStr = classTitle || '';
    if (!titleStr && app.state && app.state.files && T.getMasteryStatus) {
      const pLocal = app.state.files.find(f => f.name.includes('Data_PlayerLocal'));
      const header = app.state.files.find(f => f.name.includes('Header'));
      if (pLocal) {
        const ms = T.getMasteryStatus(pLocal.save, header ? header.save : null);
        if (ms && !ms.isUnblessed) titleStr = ms.masteries.join(' + ');
      }
    }
    heroDetails.textContent = `Level ${level || 1}${titleStr ? ' · ' + titleStr : ''} · Playtime: ${playtime || '0h'}`;
  }

  const switcher = $('#btn-profile-switch');
  if (switcher) switcher.style.display = 'inline-flex';
  const currentProfileLabel = $('#current-profile-label');
  if (currentProfileLabel) currentProfileLabel.textContent = t('header.profile_label', { name: name || 'Hero', level: level || 1 });
}

/* File Loading */
async function addFiles(fileList) {
  for (const f of fileList) {
    const buf = new Uint8Array(await f.arrayBuffer());
    try {
      const save = G.parseSave(buf);
      const items = T.listItems(save);
      app.state.files.push({ name: f.name, save, items, orig: buf, dirty: false });
      log(`${f.name} loaded (${items.length} items)`, false, true);
      if (app.state.CAT) {
        try { app.learn(save); } catch (e) { /* ignore */ }
        try { app.learnSkills(save); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      log(`ERROR in ${f.name}: ${e.message}`, true);
      toast(`Failed to load ${f.name}: ${e.message}`, 'err');
    }
  }

  if (!app.state.activeProfile && app.state.files.length) {
    let heroName = 'Hero', lvl = 1, playtime = '';
    app.state.files.forEach(f => {
      if (f.name.includes('Header')) {
        const nameP = f.save.root.get('m_CharacterName'), lvlP = f.save.root.get('m_Level'), playP = f.save.root.get('m_TotalPlayTimeSeconds');
        if (nameP && nameP.value instanceof G.Scalar) heroName = nameP.value.v;
        if (lvlP && lvlP.value instanceof G.Scalar) lvl = lvlP.value.v;
        if (playP && playP.value instanceof G.Scalar) {
          const sec = Number(playP.value.v);
          playtime = `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
        }
      }
    });
    app.state.activeProfile = { prefix: heroName, charName: heroName, level: lvl, playtime, files: {} };
    updateActiveCharacterHeader(heroName, lvl, playtime);
  }

  const allSecs = app.getUnifiedSections ? app.getUnifiedSections() : [];
  if (allSecs.length) app.state.curSec = allSecs[0];
  else app.state.curItem = null;

  if (app.render) app.render();
}

/* Direct Save & Overwrite to Local Disk via File System Access API */
async function saveDirectlyToGame() {
  if (!app.state.files.length) {
    toast('No files loaded to save.', 'err');
    return;
  }

  const savedNames = [];
  const tierResolver = app.getTierRange || null;

  // Case 1: We have currentDirectoryHandle (from Junction or allowed directory)
  if (app.state.currentDirectoryHandle) {
    try {
      if (await app.state.currentDirectoryHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
        const perm = await app.state.currentDirectoryHandle.requestPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          toast('Write permission to SaveGames folder was denied by browser.', 'err');
          return;
        }
      }

      // Automatically run auto-clean on all items to prevent corrupt None nodes
      app.state.files.forEach(f => {
        if (!f.save) return;
        const items = T.listItems(f.save);
        items.forEach(it => T.autoFixItemAffixes(it, tierResolver));
      });

      for (const f of app.state.files) {
        const out = G.serializeSave(f.save);
        const fHandle = await app.state.currentDirectoryHandle.getFileHandle(f.name, { create: true });
        const writable = await fHandle.createWritable();
        await writable.write(out);
        await writable.close();
        f.dirty = false;
        savedNames.push(f.name);
        log(`Directly overwrote: ${f.name}`, false, true);
      }

      // Automatically delete Saving.sav
      let deletedSavingSav = false;
      try {
        await app.state.currentDirectoryHandle.removeEntry('Saving.sav');
        deletedSavingSav = true;
        log('Automatically deleted Saving.sav checksum manifest file.', false, true);
      } catch (err) {
        // Not present or already removed
      }

      const sp = $('#dirty');
      if (sp) sp.textContent = 'saved';
      toast(`✅ Successfully replaced ${savedNames.length} file(s) in SaveGames folder!`, 'succ');
      showDirectSaveSuccessModal(savedNames, deletedSavingSav, false);
      return;
    } catch (e) {
      log('Direct directory save error: ' + e.message, true);
      toast('Direct directory save failed: ' + e.message, 'err');
    }
  }

  // Case 2: Individual File Handles available (from showOpenFilePicker)
  let handleCount = 0;
  for (const f of app.state.files) {
    if (app.state.fileHandlesMap.has(f.name)) handleCount++;
  }

  if (handleCount > 0) {
    try {
      app.state.files.forEach(f => {
        if (!f.save) return;
        const items = T.listItems(f.save);
        items.forEach(it => T.autoFixItemAffixes(it, tierResolver));
      });

      for (const f of app.state.files) {
        const h = app.state.fileHandlesMap.get(f.name);
        if (!h) continue;
        if (await h.queryPermission({ mode: 'readwrite' }) !== 'granted') {
          const perm = await h.requestPermission({ mode: 'readwrite' });
          if (perm !== 'granted') {
            toast(`Permission to edit ${f.name} denied.`, 'err');
            continue;
          }
        }
        const out = G.serializeSave(f.save);
        const writable = await h.createWritable();
        await writable.write(out);
        await writable.close();
        f.dirty = false;
        savedNames.push(f.name);
        log(`Directly overwrote: ${f.name}`, false, true);
      }

      let clearedSavingSav = false;
      if (app.state.fileHandlesMap.has('Saving.sav')) {
        try {
          const hSaving = app.state.fileHandlesMap.get('Saving.sav');
          if (await hSaving.queryPermission({ mode: 'readwrite' }) === 'granted' || await hSaving.requestPermission({ mode: 'readwrite' }) === 'granted') {
            const wr = await hSaving.createWritable();
            await wr.write(new Uint8Array(0));
            await wr.close();
            clearedSavingSav = true;
            log('Automatically cleared Saving.sav checksum manifest file.', false, true);
          }
        } catch (err) {
          // ignore
        }
      }

      if (savedNames.length) {
        const sp = $('#dirty');
        if (sp) sp.textContent = 'saved';
        toast(`✅ Directly replaced ${savedNames.length} save file(s)!`, 'succ');
        showDirectSaveSuccessModal(savedNames, clearedSavingSav, true);
        return;
      }
    } catch (e) {
      log('Direct file overwrite error: ' + e.message, true);
      toast('Direct file overwrite failed: ' + e.message, 'err');
    }
  }

  // Fallback: If handles are not available, download zip
  toast('Direct save handle not available. Downloading .zip archive.', 'info');
  downloadAll(true);
}

function showDirectSaveSuccessModal(fileNames, deletedSavingSav, isFileHandles) {
  const existing = $('.modal-overlay');
  if (existing) existing.remove();

  const overlay = el('div', 'modal-overlay');
  const box = el('div', 'modal-box');
  box.style.maxWidth = '560px';

  box.appendChild(el('h3', '', '⚡ Save Files Updated Directly to Game!'));

  const fileListHtml = fileNames.map(n => `<div style="color:var(--text-main); padding:2px 0;">✅ <code>${n}</code> (Overwritten)</div>`).join('');

  const savingStatusHtml = deletedSavingSav
    ? `<div style="background: rgba(56, 239, 125, 0.1); border: 1px solid rgba(56, 239, 125, 0.3); border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; color: #38ef7d; font-size: 13px;">
         <b>✨ Auto-deleted <code>Saving.sav</code></b> — Checksum manifest was removed so Titan Quest II will load your edited data cleanly without restoring backups!
       </div>`
    : `<div style="background: rgba(255, 208, 67, 0.1); border: 1px solid rgba(255, 208, 67, 0.3); border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; color: var(--gold-primary); font-size: 13px;">
         <b>⚠️ Note:</b> Remember to delete <code>Saving.sav</code> inside your <code>SaveGames</code> folder if present, so the game doesn't restore backup data.
       </div>`;

  box.innerHTML += `
    <p style="color:var(--text-main); font-size:13.5px; margin-bottom:8px;">
      Successfully replaced <b>${fileNames.length} save file(s)</b> directly on your local drive:
    </p>
    <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border-card); border-radius:6px; padding:8px 12px; margin-bottom:12px; font-size:12px; max-height:120px; overflow-y:auto;">
      ${fileListHtml}
    </div>
    ${savingStatusHtml}
    <ol style="line-height:1.7; font-size:13px; padding-left:20px; margin-bottom:14px; color:var(--text-muted);">
      <li>All save modifications are written directly to your disk.</li>
      <li>Launch <b>Titan Quest II</b> (if Steam Cloud asks, select <i>Use Local Files</i>).</li>
    </ol>
  `;

  const actions = el('div', 'modal-actions');
  const zipBtn = el('button', 'btn ghost tiny', '📦 Export .zip Backup');
  zipBtn.onclick = () => downloadAll(true);
  actions.appendChild(zipBtn);

  const closeBtn = el('button', 'btn', '🎮 Done, Launch TQ2');
  closeBtn.onclick = () => overlay.remove();
  actions.appendChild(closeBtn);

  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

/* Save & Export (Unified Character Export as ZIP Archive or Individual Files) */
function downloadAll(asZip = true) {
  if (!app.state.files.length) {
    toast('No files loaded to export.', 'err');
    return;
  }
  const exportedFiles = [];
  const zipEntries = [];
  const tierResolver = app.getTierRange || null;

  // Automatically run auto-clean on all items to prevent corrupt None nodes
  app.state.files.forEach(f => {
    if (!f.save) return;
    const items = T.listItems(f.save);
    items.forEach(it => T.autoFixItemAffixes(it, tierResolver));
  });

  app.state.files.forEach(f => {
    const out = G.serializeSave(f.save);
    f.dirty = false;
    exportedFiles.push(f.name);
    zipEntries.push({ name: f.name, data: out });
  });

  const rawCharName = app.state.activeProfile && app.state.activeProfile.charName ? app.state.activeProfile.charName : 'TQ2';
  const cleanCharName = rawCharName.replace(/[^a-zA-Z0-9_-]/g, '') || 'TQ2';
  const zipName = `${cleanCharName}_SaveGames.zip`;

  if (asZip && window.TQ2Zip && window.TQ2Zip.buildZip) {
    try {
      const zipData = window.TQ2Zip.buildZip(zipEntries);
      const blob = new Blob([zipData], { type: 'application/zip' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = zipName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);

      log(`Exported ${exportedFiles.length} file(s) bundled in archive: ${zipName}`, false, true);
      toast(`Exported ${exportedFiles.length} save files in ${zipName}!`, 'succ');
      const sp = $('#dirty');
      if (sp) sp.textContent = 'exported';
      showPostModal(exportedFiles, zipName);
      return;
    } catch (err) {
      log('ZIP archive generation failed, falling back to individual downloads: ' + err.message, true);
    }
  }

  // Fallback / Individual Files: stagger downloads by 250ms so browser doesn't block multi-file downloads
  zipEntries.forEach((entry, idx) => {
    setTimeout(() => {
      const blob = new Blob([entry.data], { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = entry.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, idx * 250);
  });

  log(`Exported ${exportedFiles.length} individual file(s): ${exportedFiles.join(', ')}`, false, true);
  toast(`Exported ${exportedFiles.length} character save file(s)!`, 'succ');
  const sp = $('#dirty');
  if (sp) sp.textContent = 'exported';
  showPostModal(exportedFiles, null);
}

function showPostModal(fileNames, zipName) {
  const overlay = el('div', 'modal-overlay');
  const box = el('div', 'modal-box');
  box.appendChild(el('h3', '', zipName ? '📦 Save Files Exported (.zip Archive)' : 'Save Files Exported – 3 Steps to Load in TQ2'));

  const fileListHtml = fileNames.map(n => `<div style="color:var(--text); padding:2px 0;">📄 <code>${n}</code></div>`).join('');
  const instructions = zipName
    ? `
      <p style="color:var(--gold); font-size:13.5px; margin-bottom:8px;">
        All <b>${fileNames.length} character save files</b> are safely bundled in <b><code>${zipName}</code></b> (single download):
      </p>
      <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border); border-radius:6px; padding:8px 12px; margin-bottom:14px; font-size:12px; max-height:140px; overflow-y:auto;">
        ${fileListHtml}
      </div>
      <ol style="line-height:1.7; font-size:13px; padding-left:20px; margin-bottom:14px;">
        <li>Open <b><code>${zipName}</code></b> and extract/copy all <code>.sav</code> files into:<br>
          <code style="word-break:break-all;">C:\\Users\\&lt;Name&gt;\\AppData\\Local\\TQ2\\Saved\\SaveGames</code>
        </li>
        <li><b>Delete <code>Saving.sav</code></b> in that folder (manifest checksum file).</li>
        <li>Launch Titan Quest II (select <i>Use Local Files</i> if Steam Cloud asks).</li>
      </ol>
    `
    : `
      <p style="font-size:13px; margin-bottom:8px;">Downloaded ${fileNames.length} individual <code>.sav</code> files:</p>
      <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border); border-radius:6px; padding:8px 12px; margin-bottom:14px; font-size:12px; max-height:140px; overflow-y:auto;">
        ${fileListHtml}
      </div>
      <ol style="line-height:1.7; font-size:13px; padding-left:20px; margin-bottom:14px;">
        <li>Copy the downloaded files into:<br>
          <code style="word-break:break-all;">C:\\Users\\&lt;Name&gt;\\AppData\\Local\\TQ2\\Saved\\SaveGames</code>
        </li>
        <li><b>Delete <code>Saving.sav</code></b> in that folder (manifest checksum file).</li>
        <li>Launch Titan Quest II (select <i>Use Local Files</i> if Steam Cloud asks).</li>
      </ol>
    `;

  box.innerHTML += instructions;

  const actions = el('div', 'modal-actions');
  if (zipName) {
    const rawBtn = el('button', 'btn ghost tiny', 'Download Individual .sav Files');
    rawBtn.title = 'Download raw .sav files separately instead of a zip archive';
    rawBtn.onclick = () => {
      downloadAll(false);
    };
    actions.appendChild(rawBtn);
  }

  const ok = el('button', 'btn', 'Got it, Close');
  ok.onclick = () => overlay.remove();
  actions.appendChild(ok);

  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showHelpModal() {
  const overlay = el('div', 'modal-overlay');
  const box = el('div', 'modal-box');
  box.style.maxWidth = '640px';
  const isVi = (app.getLanguage && app.getLanguage() === 'vi');
  box.appendChild(el('h3', '', isVi ? 'Titan Quest II – Hướng Dẫn Save & Saving.sav' : 'Save File Guide & Saving.sav Explained'));
  
  if (isVi) {
    box.innerHTML += `
      <div style="font-size:13px; line-height:1.6; color:var(--text-main); margin-bottom:12px;">
        <p class="hint"><b>Tại sao cần xóa <code>Saving.sav</code>?</b><br>
        Titan Quest II sử dụng file <code>Saving.sav</code> để lưu mã băm CRC32 cho từng file save. Nếu một file save bị chỉnh sửa mà không khớp với manifest, game sẽ bỏ qua thay đổi và nạp lại từ file sao lưu <code>.bak</code>.<br>
        Khi xóa <code>Saving.sav</code>, game sẽ đọc toàn bộ dữ liệu mới chỉnh sửa và tự động tạo lại một file manifest checksum chuẩn xác ở lần lưu tiếp theo.</p>
        <p class="hint"><b>Vị trí Thư mục Save Games Chuẩn:</b><br>
        <code>D:\\TQ2Saves</code> hoặc <code>%LOCALAPPDATA%\\TQ2\\Saved\\SaveGames</code></p>
        <p class="hint"><b>Quy trình khuyến nghị:</b><br>
        1. Bấm <b>"📂 Chọn Thư mục"</b> chọn <code>D:\\TQ2Saves</code>.<br>
        2. Tùy chỉnh nhân vật, điểm kỹ năng, thuộc tính và trang bị.<br>
        3. Bấm <b>"⚡ Lưu &amp; Ghi đè"</b> &rarr; Editor sẽ ghi đè trực tiếp và tự động xóa <code>Saving.sav</code>!</p>
      </div>
    `;
  } else {
    box.innerHTML += `
      <div style="font-size:13px; line-height:1.6; color:var(--text-main); margin-bottom:12px;">
        <p class="hint"><b>Why delete <code>Saving.sav</code>?</b><br>
        Titan Quest II maintains a checksum manifest file (<code>Saving.sav</code>). If a save file's CRC32 checksum does not match the manifest on game launch, the game discards your edits and restores from the <code>.bak</code> backup file.<br>
        Deleting <code>Saving.sav</code> forces TQ2 to load unverified and automatically write a fresh, valid manifest on next save.</p>
        <p class="hint"><b>Standard Save Location:</b><br>
        <code>D:\\TQ2Saves</code> or <code>%LOCALAPPDATA%\\TQ2\\Saved\\SaveGames</code></p>
        <p class="hint"><b>Recommended Workflow:</b><br>
        1. Click <b>"📂 Select Folder"</b> (e.g. <code>D:\\TQ2Saves</code>).<br>
        2. Customize your character attributes, masteries, currencies, and item affixes.<br>
        3. Click <b>"⚡ Save &amp; Overwrite"</b> &rarr; The editor overwrites files and auto-deletes <code>Saving.sav</code>!</p>
      </div>
    `;
  }

  const ok = el('button', 'btn ghost', t('modals.modal_close'));
  ok.onclick = () => overlay.remove();
  box.appendChild(ok);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showAppDataSecurityModal() {
  const existing = $('.modal-overlay');
  if (existing) existing.remove();
  const overlay = el('div', 'modal-overlay');
  const box = el('div', 'modal-box');
  box.style.maxWidth = '620px';
  box.appendChild(el('h3', '', '📁 Accessing SaveGames & Auto-Replace Setup'));
  box.innerHTML += `
    <p class="hint" style="color:var(--gold-primary); line-height:1.6; margin-bottom:14px;">
      <b>Tại sao Chrome/Edge báo "Không thể mở thư mục vì chứa file hệ thống"?</b><br>
      Trình duyệt có cơ chế bảo mật (Sandbox) chặn chọn trực tiếp toàn bộ cây thư mục <code>AppData</code> để bảo vệ dữ liệu nhạy cảm của người dùng.
    </p>
    <div style="margin: 14px 0; display: flex; flex-direction: column; gap: 12px;">
      <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px;">
        <b style="color:#38ef7d; font-size:13.5px;">⚡ Cách 1: Chọn File .sav (Nhanh nhất – Tự động ghi đè trực tiếp)</b><br>
        <span style="font-size:12.5px; color:var(--text-main); line-height:1.6; display:inline-block; margin-top:4px;">
          Chrome <b>cho phép chọn file trong AppData</b>! Bấm nút bên dưới, vào thư mục <code>SaveGames</code>, nhấn <kbd style="background:#222; border:1px solid #555; padding:1px 5px; border-radius:3px;">Ctrl + A</kbd> (chọn tất cả file) và bấm <b>Open</b>.<br>
          👉 Khi sửa xong, bấm <b>"⚡ Save &amp; Overwrite"</b>, Chrome sẽ hỏi <i>"Cho phép chỉnh sửa file?"</i> &rarr; Bấm <b>Allow / Save changes</b> là <b>file sẽ được ghi đè trực tiếp ngay trên máy tính</b>!
        </span>
      </div>
      <div style="background: rgba(229, 184, 87, 0.08); border: 1px solid rgba(229, 184, 87, 0.3); border-radius: 8px; padding: 12px;">
        <b style="color:var(--gold-primary); font-size:13.5px;">📁 Cách 2: Tạo liên kết thư mục (Junction 1-Click – Mở cả Folder &amp; Tự xóa Saving.sav)</b><br>
        <span style="font-size:12.5px; color:var(--text-main); line-height:1.6; display:inline-block; margin-top:4px;">
          Để Chrome mở được cả Folder mà không bị chặn, mở <b>CMD / PowerShell</b> (nhấn <kbd style="background:#222; border:1px solid #555; padding:1px 5px; border-radius:3px;">Win + R</kbd> gõ <code>cmd</code>) và chạy lệnh sau:
        </span>
        <div style="display:flex; align-items:center; gap:8px; margin:8px 0; background:rgba(0,0,0,0.5); padding:6px 10px; border-radius:6px; border:1px solid var(--border-card);">
          <code id="cmd-junction-text" style="font-family:'JetBrains Mono',monospace; font-size:11.5px; color:#ffd043; flex:1; overflow-x:auto;">mklink /J "%USERPROFILE%\\TQ2Saves" "%LOCALAPPDATA%\\TQ2\\Saved\\SaveGames"</code>
          <button class="btn tiny" id="btn-copy-junction" style="white-space:nowrap;">📋 Copy Lệnh</button>
        </div>
        <span style="font-size:12px; color:var(--text-muted); line-height:1.5; display:inline-block;">
          Sau khi chạy lệnh trên, trong web bấm <b>"📂 Select Folder"</b> và chọn thư mục <b><code>TQ2Saves</code></b>. Web sẽ mở 100% không bị chặn, và khi bấm <b>Save</b> sẽ <b>tự động ghi đè file + tự động XÓA luôn file <code>Saving.sav</code></b>!
        </span>
      </div>
    </div>
  `;
  const act = el('div', 'modal-actions');
  const pickFilesBtn = el('button', 'btn btn-save-direct', '📄 Chọn File .sav ngay (Ctrl+A trong SaveGames)');
  pickFilesBtn.onclick = () => {
    overlay.remove();
    triggerFilePicker();
  };
  act.appendChild(pickFilesBtn);

  const closeBtn = el('button', 'btn ghost tiny', 'Đóng');
  closeBtn.onclick = () => overlay.remove();
  act.appendChild(closeBtn);

  box.appendChild(act);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const copyBtn = $('#btn-copy-junction', box);
  if (copyBtn) {
    copyBtn.onclick = () => {
      const cmd = 'mklink /J "%USERPROFILE%\\TQ2Saves" "%LOCALAPPDATA%\\TQ2\\Saved\\SaveGames"';
      navigator.clipboard.writeText(cmd).then(() => {
        copyBtn.textContent = '✅ Đã Copy!';
        setTimeout(() => { copyBtn.textContent = '📋 Copy Lệnh'; }, 2500);
      });
    };
  }
}

function triggerFilePicker() {
  const fi = $('#file-input');
  if (fi) fi.click();
}

/* ---------- IndexedDB DirectoryHandle Persistence ---------- */
const IDB_NAME = 'TQ2_Editor_Storage';
const IDB_VERSION = 1;
const IDB_STORE = 'handles';

function openStorageDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) return resolve(null);
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    } catch (err) {
      resolve(null);
    }
  });
}

async function saveStoredDirHandle(handle) {
  if (!handle) return;
  try {
    const db = await openStorageDB();
    if (!db) return;
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(handle, 'last_save_dir');
    store.put(handle.name || 'SaveGames', 'last_dir_name');
    localStorage.setItem('tq2_last_dir_name', handle.name || 'SaveGames');
    updateReloadFolderUI(handle.name || 'SaveGames');
  } catch (e) {
    console.warn('Could not save directory handle to IndexedDB:', e);
  }
}

async function getStoredDirHandle() {
  try {
    const db = await openStorageDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get('last_save_dir');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

function updateReloadFolderUI(name) {
  const folderName = name || localStorage.getItem('tq2_last_dir_name') || 'SaveGames';
  const btnHdr = $('#btn-reload-last-folder');
  const btnHero = $('#btn-hero-reload-last-folder');
  const lblHdr = $('#last-folder-name');
  const lblHero = $('#last-folder-name-hero');

  if (lblHdr) lblHdr.textContent = folderName;
  if (lblHero) lblHero.textContent = folderName;
  if (btnHdr) btnHdr.style.display = 'inline-flex';
  if (btnHero) btnHero.style.display = 'inline-flex';
}

async function reloadFromPreviousFolder() {
  const dirHandle = await getStoredDirHandle();
  if (!dirHandle) {
    toast('No previously remembered folder found. Opening folder selector...', 'info');
    triggerFolderPicker();
    return;
  }

  try {
    let perm = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      perm = await dirHandle.requestPermission({ mode: 'readwrite' });
    }
    if (perm !== 'granted') {
      toast('Permission was not granted to read the previous folder.', 'err');
      return;
    }

    app.state.currentDirectoryHandle = dirHandle;
    app.state.fileHandlesMap.clear();
    const collectedFiles = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        app.state.fileHandlesMap.set(file.name, entry);
        collectedFiles.push(file);
      }
    }

    if (!collectedFiles.length) {
      toast(`No files found in folder "${dirHandle.name}".`, 'err');
      return;
    }

    toast(`Loading ${collectedFiles.length} files from "${dirHandle.name}"...`, 'info');
    await handleFolderSelection(collectedFiles);
    toast(`Successfully reloaded from "${dirHandle.name}"!`, 'succ');
  } catch (e) {
    if (e.name === 'AbortError') return;
    toast('Could not reload folder: ' + e.message, 'err');
    triggerFolderPicker();
  }
}

/* Pick Directory API or Fallback */
async function triggerFolderPicker() {
  if (window.showDirectoryPicker) {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      app.state.currentDirectoryHandle = dirHandle;
      await saveStoredDirHandle(dirHandle);
      const collectedFiles = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          app.state.fileHandlesMap.set(file.name, entry);
          collectedFiles.push(file);
        }
      }
      if (collectedFiles.length) {
        await handleFolderSelection(collectedFiles);
      }
      return;
    } catch (e) {
      if (e.name === 'AbortError') {
        return;
      }
      if (e.name === 'SecurityError' || (e.message && /system|sensitive|security/i.test(e.message))) {
        showAppDataSecurityModal();
        return;
      }
      toast('Could not open folder: ' + e.message, 'err');
    }
  }
  const fi = $('#folder-input');
  if (fi) fi.click();
}

// Attach to TQ2App
app.scanFileList = scanFileList;
app.handleFolderSelection = handleFolderSelection;
app.showProfileSelectModal = showProfileSelectModal;
app.loadProfile = loadProfile;
app.updateActiveCharacterHeader = updateActiveCharacterHeader;
app.addFiles = addFiles;
app.saveDirectlyToGame = saveDirectlyToGame;
app.showDirectSaveSuccessModal = showDirectSaveSuccessModal;
app.downloadAll = downloadAll;
app.showPostModal = showPostModal;
app.showHelpModal = showHelpModal;
app.showAppDataSecurityModal = showAppDataSecurityModal;
app.triggerFilePicker = triggerFilePicker;
app.openStorageDB = openStorageDB;
app.saveStoredDirHandle = saveStoredDirHandle;
app.getStoredDirHandle = getStoredDirHandle;
app.updateReloadFolderUI = updateReloadFolderUI;
app.reloadFromPreviousFolder = reloadFromPreviousFolder;
app.triggerFolderPicker = triggerFolderPicker;

})(typeof globalThis !== 'undefined' ? globalThis : this);
