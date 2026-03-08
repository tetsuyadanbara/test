// ==UserScript==
// @name         5ch donguri item modify keepalive
// @namespace    https://greasyfork.org/ja/users/1513015-81f32c5c
// @version      1.2.0
// @description  アイテム強化ボタンを常時表示し、消えても自動再表示
// @license      MIT
// @author       81f32c5c
// @match        https://donguri.5ch.io/modify/weapon/*
// @match        https://donguri.5ch.io/modify/armor/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';

  if (!/^\/modify\/(weapon|armor)\//.test(location.pathname)) return;

  const PANEL_ID = 'donguri-item-modify-panel-fixed';
  const SETTING_ID = 'donguri-item-mod-style';
  const SETTINGS_KEY = (() => {
    const parts = location.pathname.split('/');
    return `/modify/${parts[2]}`;
  })();

  function getPageInfo() {
    const parts = location.pathname.split('/');
    // ["", "modify", "weapon", "view|dmghigh|speed|critical...", "19762984"]
    if (parts.length < 5) return null;

    const itemType = parts[2];
    const itemId = parts[4];

    if (!['weapon', 'armor'].includes(itemType)) return null;
    if (!itemId) return null;

    return { itemType, itemId };
  }

  function loadSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      return Array.isArray(parsed) && parsed.length === 8 ? parsed : Array(8).fill(false);
    } catch (e) {
      return Array(8).fill(false);
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {}
  }

  function ensureStyle() {
    if (document.getElementById(SETTING_ID)) return;

    const style = document.createElement('style');
    style.id = SETTING_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: sticky;
        top: 0;
        z-index: 99999;
        background: #fff;
        border-bottom: 1px solid #ccc;
        box-shadow: 0 2px 8px rgba(0,0,0,.08);
        padding: 10px;
        margin-bottom: 12px;
      }
      #${PANEL_ID} .dg-head {
        font-weight: bold;
        margin-bottom: 8px;
      }
      #${PANEL_ID} .dg-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(140px, 1fr));
        gap: 8px;
      }
      #${PANEL_ID} form,
      #${PANEL_ID} .dg-toggle-box {
        margin: 0;
      }
      #${PANEL_ID} button {
        width: 100%;
        padding: 8px 10px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }
      #${PANEL_ID} .dg-up {
        background: #428bca;
        color: #fff;
      }
      #${PANEL_ID} .dg-down {
        background: darkred;
        color: #fff;
      }
      #${PANEL_ID} .dg-toggle {
        background: #666;
        color: #fff;
      }
      #${PANEL_ID} .dg-hidden {
        opacity: .45;
      }
      @media (max-width: 900px) {
        #${PANEL_ID} .dg-grid {
          grid-template-columns: repeat(2, minmax(140px, 1fr));
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createButton(label, className, type = 'button') {
    const btn = document.createElement('button');
    btn.type = type;
    btn.textContent = label;
    btn.className = className;
    return btn;
  }

  function optionDefs(itemType) {
    return itemType === 'weapon'
      ? [
          { name: 'DMG（最小値）', path: 'dmglow' },
          { name: 'DMG（最大値）', path: 'dmghigh' },
          { name: 'SPD', path: 'speed' },
          { name: 'CRIT', path: 'critical' }
        ]
      : [
          { name: 'DEF（最小値）', path: 'deflow' },
          { name: 'DEF（最大値）', path: 'defhigh' },
          { name: 'WT.', path: 'weight' },
          { name: 'CRIT', path: 'critical' }
        ];
  }

  function makeActionUrl(itemType, itemId, actionPath) {
    return `${location.origin}/modify/${itemType}/${actionPath}/${itemId}`;
  }

  function buildPanel() {
    const info = getPageInfo();
    if (!info) return null;

    const { itemType, itemId } = info;
    const defs = optionDefs(itemType);
    const settings = loadSettings();

    const panel = document.createElement('div');
    panel.id = PANEL_ID;

    const head = document.createElement('div');
    head.className = 'dg-head';
    head.textContent = `簡易強化パネル (${itemType} #${itemId})`;
    panel.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'dg-grid';
    panel.appendChild(grid);

    defs.forEach((def, index) => {
      // 上昇
      const upForm = document.createElement('form');
      upForm.method = 'POST';
      upForm.action = makeActionUrl(itemType, itemId, def.path);

      const upBtn = createButton(`${def.name}↑`, 'dg-up', 'submit');
      upForm.appendChild(upBtn);

      if (settings[index]) upForm.style.display = 'none';
      upForm.addEventListener('submit', () => {
        setTimeout(ensurePanel, 50);
        setTimeout(ensurePanel, 500);
        setTimeout(ensurePanel, 1500);
      });

      // 下降
      const downForm = document.createElement('form');
      downForm.method = 'POST';
      downForm.action = makeActionUrl(itemType, itemId, def.path + 'down');

      const downBtn = createButton(`${def.name}↓`, 'dg-down', 'submit');
      downForm.appendChild(downBtn);

      if (settings[index + 4]) downForm.style.display = 'none';
      downForm.addEventListener('submit', () => {
        setTimeout(ensurePanel, 50);
        setTimeout(ensurePanel, 500);
        setTimeout(ensurePanel, 1500);
      });

      // 表示切替
      const upToggleBox = document.createElement('div');
      upToggleBox.className = 'dg-toggle-box';
      const upToggleBtn = createButton(`${def.name}↑ 表示切替`, 'dg-toggle');
      if (settings[index]) upToggleBtn.classList.add('dg-hidden');
      upToggleBtn.addEventListener('click', () => {
        settings[index] = !settings[index];
        saveSettings(settings);
        upForm.style.display = settings[index] ? 'none' : '';
        upToggleBtn.classList.toggle('dg-hidden', settings[index]);
      });
      upToggleBox.appendChild(upToggleBtn);

      const downToggleBox = document.createElement('div');
      downToggleBox.className = 'dg-toggle-box';
      const downToggleBtn = createButton(`${def.name}↓ 表示切替`, 'dg-toggle');
      if (settings[index + 4]) downToggleBtn.classList.add('dg-hidden');
      downToggleBtn.addEventListener('click', () => {
        settings[index + 4] = !settings[index + 4];
        saveSettings(settings);
        downForm.style.display = settings[index + 4] ? 'none' : '';
        downToggleBtn.classList.toggle('dg-hidden', settings[index + 4]);
      });
      downToggleBox.appendChild(downToggleBtn);

      grid.appendChild(upForm);
      grid.appendChild(downForm);
      grid.appendChild(upToggleBox);
      grid.appendChild(downToggleBox);
    });

    return panel;
  }

  function getMountTarget() {
    return document.body || document.documentElement;
  }

  function ensurePanel() {
    const info = getPageInfo();
    if (!info) return;

    ensureStyle();

    const old = document.getElementById(PANEL_ID);
    if (old && old.dataset.itemId === info.itemId && old.dataset.itemType === info.itemType) {
      return;
    }
    if (old) old.remove();

    const panel = buildPanel();
    if (!panel) return;

    panel.dataset.itemId = info.itemId;
    panel.dataset.itemType = info.itemType;

    const mount = getMountTarget();
    if (!mount) return;

    if (mount.firstChild) {
      mount.insertBefore(panel, mount.firstChild);
    } else {
      mount.appendChild(panel);
    }
  }

  // 初回
  ensurePanel();

  // DOM再構築対策
  document.addEventListener('DOMContentLoaded', ensurePanel);
  window.addEventListener('load', ensurePanel);
  window.addEventListener('pageshow', ensurePanel);

  const observer = new MutationObserver(() => {
    ensurePanel();
  });

  const startObserve = () => {
    const target = document.body || document.documentElement;
    if (!target) return;
    observer.observe(target, {
      childList: true,
      subtree: true
    });
  };

  startObserve();

  // 最終保険
  setInterval(ensurePanel, 1000);
})();
