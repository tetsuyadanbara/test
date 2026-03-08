// ==UserScript==
// @name         5ch donguri item modify
// @namespace    https://greasyfork.org/ja/users/1513015-81f32c5c
// @version      1.1.1
// @description  アイテム強化ボタンをページ上部に常時表示
// @license      MIT
// @author       81f32c5c
// @match        https://donguri.5ch.io/modify/weapon/*
// @match        https://donguri.5ch.io/modify/armor/*
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  if (!location.pathname.startsWith('/modify/')) return;

  const pathParts = location.pathname.split('/');
  // ["", "modify", "weapon", "view|dmghigh|speed|critical...", "19762984"]
  if (pathParts.length < 5) return;

  const itemType = pathParts[2];
  const itemId = pathParts[4];

  if (!['weapon', 'armor'].includes(itemType) || !itemId) return;

  const settingsKey = `/modify/${itemType}`;

  // CSSを1回だけ追加
  if (!document.getElementById('donguri-item-mod-style')) {
    const style = document.createElement('style');
    style.id = 'donguri-item-mod-style';
    style.textContent = `
      .gray {
        color: black !important;
        background-color: gray !important;
      }
      .donguri-item-modify-panel {
        margin-bottom: 16px;
      }
      .donguri-item-modify-panel .upgrade-option button {
        width: 100%;
      }
    `;
    document.head.appendChild(style);
  }

  let settings;
  try {
    const parsed = JSON.parse(localStorage.getItem(settingsKey));
    settings = Array.isArray(parsed) && parsed.length === 8 ? parsed : Array(8).fill(false);
  } catch (e) {
    settings = Array(8).fill(false);
  }

  const saveSettings = () => {
    try {
      localStorage.setItem(settingsKey, JSON.stringify(settings));
    } catch (e) {}
  };

  const createElement = (tag, cls) => {
    const el = document.createElement(tag);
    if (cls) el.classList.add(cls);
    return el;
  };

  const makeActionUrl = (actionPath) => {
    return `${location.origin}/modify/${itemType}/${actionPath}/${itemId}`;
  };

  const toggle = (targetForm, toggleButton, index) => {
    settings[index] = toggleButton.classList.toggle('gray');
    if (settings[index]) {
      targetForm.style.display = 'none';
    } else {
      targetForm.style.removeProperty('display');
    }
  };

  const optionDefs = itemType === 'weapon'
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

  const groups = [[], [], [], []];

  optionDefs.forEach((info, index) => {
    const nameUp = `${info.name}↑`;
    const nameDown = `${info.name}↓`;

    // 上昇フォーム
    const upForm = createElement('form', 'upgrade-option');
    upForm.action = makeActionUrl(info.path);
    upForm.method = 'POST';

    const upButton = upForm.appendChild(document.createElement('button'));
    upButton.type = 'submit';
    upButton.textContent = nameUp;
    groups[0].push(upForm);

    // 下降フォーム
    const downForm = createElement('form', 'upgrade-option');
    downForm.action = makeActionUrl(info.path + 'down');
    downForm.method = 'POST';

    const downButton = downForm.appendChild(createElement('button', 'downgrade'));
    downButton.type = 'submit';
    downButton.textContent = nameDown;
    groups[1].push(downForm);

    // 上昇表示切替
    const upToggleBox = createElement('div', 'upgrade-option');
    const upTitle = upToggleBox.appendChild(document.createElement('h4'));
    upTitle.textContent = nameUp;

    const upToggleButton = upToggleBox.appendChild(document.createElement('button'));
    upToggleButton.type = 'button';
    upToggleButton.textContent = 'ボタン表示';
    upToggleButton.onclick = () => {
      toggle(upForm, upToggleButton, index);
      saveSettings();
    };
    groups[2].push(upToggleBox);

    // 下降表示切替
    const downToggleBox = createElement('div', 'upgrade-option');
    const downTitle = downToggleBox.appendChild(document.createElement('h4'));
    downTitle.textContent = nameDown;

    const downToggleButton = downToggleBox.appendChild(createElement('button', 'downgrade'));
    downToggleButton.type = 'button';
    downToggleButton.textContent = 'ボタン表示';
    downToggleButton.onclick = () => {
      toggle(downForm, downToggleButton, index + 4);
      saveSettings();
    };
    groups[3].push(downToggleBox);

    // 保存済み状態を復元
    if (settings[index]) {
      toggle(upForm, upToggleButton, index);
    }
    if (settings[index + 4]) {
      toggle(downForm, downToggleButton, index + 4);
    }
  });

  // 二重生成防止
  document.querySelectorAll('.donguri-item-modify-panel').forEach(el => el.remove());

  const topContainer = createElement('div', 'container');
  topContainer.classList.add('donguri-item-modify-panel');
  const topOptions = topContainer.appendChild(createElement('div', 'upgrade-options'));
  topOptions.append(...groups[0], ...groups[1]);

  const bottomContainer = createElement('div', 'container');
  bottomContainer.classList.add('donguri-item-modify-panel');
  const bottomOptions = bottomContainer.appendChild(createElement('div', 'upgrade-options'));
  bottomOptions.append(...groups[2], ...groups[3]);

  document.body.prepend(topContainer);
  document.body.append(bottomContainer);
})();
