// ==UserScript==
// @name         5ch donguri item modify
// @namespace    https://greasyfork.org/ja/users/1513015-81f32c5c
// @version      1.0.0
// @description  アイテム強化のボタンをページ上部に追加
// @license      MIT
// @author       81f32c5c
// @match        https://donguri.5ch.net/modify/weapon/view/*
// @match        https://donguri.5ch.net/modify/armor/view/*
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/548831/5ch%20donguri%20item%20modify.user.js
// @updateURL https://update.greasyfork.org/scripts/548831/5ch%20donguri%20item%20modify.meta.js
// ==/UserScript==

(() => {
  'use strict';

  (() => {
    const style = document.createElement('style');
    style.textContent = '.gray { color: black !important; background-color: gray !important;}';
    document.head.append(style);
  })();

  (() => {
    const [settings_key, item_type] = (() => {
      const a = location.pathname.split('/');
      const key = a.slice(0, 3).join('/');
      return [key, a[2]];
    })();
    const settings = (() => {
      try {
        return JSON.parse(localStorage.getItem(settings_key));
      } catch(e) {
        return false;
      }
    })() || Array(8).fill(false);
    const saveSettings = () => {
      try {
        localStorage.setItem(settings_key, JSON.stringify(settings));
      } catch(e) {}
    };

    const createElement = (tag, cls) => {
      const el = document.createElement(tag);
      el.classList.add(cls);
      return el;
    };
    const href = location.href.split('/');
    const action = path => {
      href[5] = path;
      return href.join('/');
    };
    const toggle = (op, bt, index) => {
      settings[index] = bt.classList.toggle('gray');
      if (settings[index]) {
        op.style.display = 'none';
      } else {
        op.style.removeProperty('display');
      }
    };

    const options = (item_type === 'weapon' ? [
      { name: 'DMG（最小値）', path: 'dmglow' },
      { name: 'DMG（最大値）', path: 'dmghigh' },
      { name: 'SPD', path: 'speed' },
      { name: 'CRIT', path: 'critical' }
    ] : [
      { name: 'DEF（最小値）', path: 'deflow' },
      { name: 'DEF（最大値）', path: 'defhigh' },
      { name: 'WT.', path: 'weight' },
      { name: 'CRIT', path: 'critical' }
    ]).reduce((a, info, index) => {
      const nameup = info.name + '↑';
      const namedown = info.name + '↓';

      const op0 = createElement('form', 'upgrade-option');
      op0.action = action(info.path);
      op0.method = 'POST';
      const bt0 = op0.appendChild(document.createElement('button'));
      bt0.type = 'submit';
      bt0.textContent = nameup;
      a[0].push(op0);

      const op1 = createElement('form', 'upgrade-option');
      op1.action = action(info.path + 'down');
      op1.method = 'POST';
      const bt1 = op1.appendChild(createElement('button', 'downgrade'));
      bt1.type = 'submit';
      bt1.textContent = namedown;
      a[1].push(op1);

      const op2 = createElement('div', 'upgrade-option');
      const hd2 = op2.appendChild(document.createElement('h4'));
      hd2.textContent = nameup;
      const bt2 = op2.appendChild(document.createElement('button'));
      bt2.textContent = 'ボタン表示';
      bt2.type = 'button';
      bt2.onclick = () => {
        toggle(op0, bt2, index);
        saveSettings();
      };
      a[2].push(op2);

      const op3 = createElement('div', 'upgrade-option');
      const hd3 = op3.appendChild(document.createElement('h4'));
      hd3.textContent = namedown;
      const bt3 = op3.appendChild(createElement('button', 'downgrade'));
      bt3.textContent = 'ボタン表示';
      bt3.type = 'button';
      bt3.onclick = () => {
        toggle(op1, bt3, index + 4);
        saveSettings();
      };
      a[3].push(op3);

      settings[index] && toggle(op0, bt2);
      settings[index + 4] && toggle(op1, bt3);

      return a;
    }, [[], [], [], []]);

    const containerA = createElement('div', 'container');
    const optionsA = containerA.appendChild(createElement('div', 'upgrade-options'));
    optionsA.append(...options[0], ...options[1]);
    const containerB = createElement('div', 'container');
    const optionsB = containerB.appendChild(createElement('div', 'upgrade-options'));
    optionsB.append(...options[2], ...options[3]);

    document.body.prepend(containerA);
    document.body.append(containerB);
  })();
})();
