/* Main UI Entry Point & Event Controller for Titan Quest II Save & Item Editor */
(function (root) {
'use strict';

const app = root.TQ2App;
const $ = app.$, $$ = app.$$, log = app.log, toast = app.toast;

/* Main Render Orchestrator */
function render() {
  if (app.renderList) app.renderList();
  if (app.renderDetail) app.renderDetail();

  const emptyEl = $('#empty');
  if (emptyEl) emptyEl.style.display = app.state.files.length ? 'none' : '';

  const workEl = $('#work');
  if (workEl) workEl.style.display = app.state.files.length ? '' : 'none';

  const btnDirect = $('#btn-save-direct');
  if (btnDirect) btnDirect.disabled = !app.state.files.length;

  const saveBtn = $('#save');
  if (saveBtn) saveBtn.disabled = !app.state.files.length;
}

app.render = render;

/* Event Initialization */
if (typeof window !== 'undefined' && window.addEventListener) {
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await app.loadCatalog();
    const CAT = app.state.CAT;
    const prefCount = Object.keys(CAT.a).filter(k => k.includes('/Prefixes/')).length;
    const suffCount = Object.keys(CAT.a).filter(k => k.includes('/Suffixes/')).length;
    const implCount = Object.keys(CAT.a).filter(k => k.includes('/Implicits/')).length;
    const uniqCount = Object.keys(CAT.a).length - prefCount - suffCount - implCount;
    log(`Catalog ready: ${Object.keys(CAT.a).length} affixes (${prefCount} Prefixes, ${suffCount} Suffixes, ${implCount} Implicits, ${uniqCount} Unique/Other), ${CAT.i.length} item templates.`, false, true);
  } catch (e) {
    log('Catalog initialization failed: ' + e.message, true);
  }

  // Quick Action Buttons
  const btnSelectFolder = $('#btn-select-folder');
  if (btnSelectFolder) btnSelectFolder.onclick = app.triggerFolderPicker;
  const btnHeroFolder = $('#btn-hero-folder');
  if (btnHeroFolder) btnHeroFolder.onclick = app.triggerFolderPicker;

  const btnReloadLast = $('#btn-reload-last-folder');
  if (btnReloadLast) btnReloadLast.onclick = app.reloadFromPreviousFolder;
  const btnHeroReloadLast = $('#btn-hero-reload-last-folder');
  if (btnHeroReloadLast) btnHeroReloadLast.onclick = app.reloadFromPreviousFolder;

  // Restore previous folder indicator from IndexedDB / LocalStorage
  try {
    const storedHandle = await app.getStoredDirHandle();
    if (storedHandle) {
      app.updateReloadFolderUI(storedHandle.name);
    } else {
      const lastDirName = localStorage.getItem('tq2_last_dir_name');
      if (lastDirName) app.updateReloadFolderUI(lastDirName);
    }
  } catch (e) {}

  const btnSelectFiles = $('#btn-select-files');
  if (btnSelectFiles) btnSelectFiles.onclick = app.triggerFilePicker;
  const btnHeroFiles = $('#btn-hero-files');
  if (btnHeroFiles) btnHeroFiles.onclick = app.triggerFilePicker;

  // Profile Switcher Buttons
  const btnProfileSwitch = $('#btn-profile-switch');
  if (btnProfileSwitch) {
    btnProfileSwitch.onclick = () => {
      if (app.state.discoveredProfiles.length) {
        app.showProfileSelectModal(app.state.discoveredProfiles, app.state.sharedStashFiles);
      } else {
        toast('No folder profiles scanned yet. Please select a SaveGames folder or files.', 'info');
      }
    };
  }

  const btnChangeHero = $('#btn-change-hero');
  if (btnChangeHero) {
    btnChangeHero.onclick = () => {
      if (app.state.discoveredProfiles.length) {
        app.showProfileSelectModal(app.state.discoveredProfiles, app.state.sharedStashFiles);
      } else {
        toast('No folder profiles scanned yet. Please select a SaveGames folder or files.', 'info');
      }
    };
  }

  // File & Folder Input Handlers
  const folderInput = $('#folder-input');
  if (folderInput) {
    folderInput.onchange = e => {
      if (e.target.files && e.target.files.length) {
        app.handleFolderSelection(e.target.files);
      }
    };
  }

  const fileInput = $('#file-input');
  if (fileInput) {
    fileInput.onchange = e => {
      if (e.target.files && e.target.files.length) {
        app.handleFolderSelection(e.target.files);
      }
    };
  }

  const fileDropInput = $('#file');
  if (fileDropInput) {
    fileDropInput.onchange = e => {
      if (e.target.files && e.target.files.length) {
        app.handleFolderSelection(e.target.files);
      }
    };
  }

  // Help & Guide Modals
  const btnHelp = $('#btn-help');
  if (btnHelp) btnHelp.onclick = app.showHelpModal;
  const bannerWhySaving = $('#banner-why-saving');
  if (bannerWhySaving) bannerWhySaving.onclick = app.showHelpModal;

  // Drag and Drop Area
  const drop = $('#drop');
  if (drop) {
    ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.add('over');
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault();
      drop.classList.remove('over');
    }));
    drop.addEventListener('drop', async e => {
      e.preventDefault();
      drop.classList.remove('over');
      if (e.dataTransfer.items && e.dataTransfer.items.length) {
        const filesArr = [];
        for (const item of e.dataTransfer.items) {
          if (item.getAsFileSystemHandle) {
            try {
              const handle = await item.getAsFileSystemHandle();
              if (handle) {
                if (handle.kind === 'file') {
                  const f = await handle.getFile();
                  app.state.fileHandlesMap.set(f.name, handle);
                  filesArr.push(f);
                  continue;
                } else if (handle.kind === 'directory') {
                  app.state.currentDirectoryHandle = handle;
                  await app.saveStoredDirHandle(handle);
                  for await (const ent of handle.values()) {
                    if (ent.kind === 'file') {
                      const f = await ent.getFile();
                      app.state.fileHandlesMap.set(f.name, ent);
                      filesArr.push(f);
                    }
                  }
                  continue;
                }
              }
            } catch (err) {
              // fallback
            }
          }
          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
            if (entry && entry.isDirectory) {
              const dirReader = entry.createReader();
              const entries = await new Promise(resolve => dirReader.readEntries(resolve));
              for (const ent of entries) {
                if (ent.isFile) {
                  const f = await new Promise(resolve => ent.file(resolve));
                  filesArr.push(f);
                }
              }
            } else {
              const f = item.getAsFile();
              if (f) filesArr.push(f);
            }
          }
        }
        if (filesArr.length) {
          await app.handleFolderSelection(filesArr);
          return;
        }
      }
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        await app.handleFolderSelection(e.dataTransfer.files);
      }
    });
  }

  // Search & Filters
  const searchInput = $('#search');
  if (searchInput) {
    searchInput.oninput = e => {
      app.state.filterText = e.target.value;
      if (app.renderList) app.renderList();
    };
  }

  $$('.filter-pills [data-filter]').forEach(p => {
    p.onclick = () => {
      $$('.filter-pills [data-filter]').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      app.state.filterCat = p.getAttribute('data-filter');
      if (app.renderList) app.renderList();
    };
  });

  $$('.filter-pills [data-rarity]').forEach(p => {
    p.onclick = () => {
      $$('.filter-pills [data-rarity]').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      app.state.filterRarity = p.getAttribute('data-rarity');
      if (app.renderList) app.renderList();
    };
  });

  // Save Actions
  const btnDirectSave = $('#btn-save-direct');
  if (btnDirectSave) btnDirectSave.onclick = app.saveDirectlyToGame;

  const btnExport = $('#save');
  if (btnExport) btnExport.onclick = () => app.downloadAll(true);

  // Toggle Log
  const toggleLog = $('#toggle-log');
  if (toggleLog) {
    toggleLog.onclick = () => {
      const logBox = $('#log');
      if (logBox) logBox.style.display = logBox.style.display === 'none' ? 'block' : 'none';
    };
  }

  render();
});
}

})(typeof globalThis !== 'undefined' ? globalThis : this);
