// ==UserScript==
// @name         donguri arena assist tool (safe boot)
// @version      1.3.2-safe
// @description  safe boot + toolbar always visible
// @author       7234e634
// @match        https://donguri.5ch.net/teambattle*
// @match        https://donguri.5ch.net/bag
// @run-at       document-end
// ==/UserScript==

(()=> {
  'use strict';

  // ---- SAFE BOOT WRAPPER ----
  const boot = async () => {
    // bag page part (same as before)
    if (location.href === 'https://donguri.5ch.net/bag') {
      function saveCurrentEquip(url, index) {
        let currentEquip = JSON.parse(localStorage.getItem('current_equip')) || [];
        const regex = /https:\/\/donguri\.5ch\.net\/equip\/(\d+)/;
        const m = url.match(regex);
        if (!m) return;
        const equipId = m[1];
        currentEquip[index] = equipId;
        localStorage.setItem('current_equip', JSON.stringify(currentEquip));
      }
      const tableIds = ['weaponTable', 'armorTable', 'necklaceTable'];
      tableIds.forEach((elm, index) => {
        const equipLinks = document.querySelectorAll(`#${elm} a[href^="https://donguri.5ch.net/equip/"]`);
        [...equipLinks].forEach(link => {
          link.addEventListener('click', () => saveCurrentEquip(link.href, index));
        });
      });
      return;
    }

    // ---- wait minimal DOM ----
    const waitFor = async (fn, ms = 8000, step = 100) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const v = fn();
        if (v) return v;
        await new Promise(r => setTimeout(r, step));
      }
      return null;
    };

    const vw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
    const settings = JSON.parse(localStorage.getItem('aat_settings')) || {};

    // ---- anchor: header may not exist -> fallback to body ----
    const header = await waitFor(() => document.querySelector('header')) || document.body;

    // ---- toolbar (always visible) ----
    const toolbar = document.createElement('div');
    toolbar.style.position = 'fixed';
    toolbar.style.top = '0';
    toolbar.style.left = '0';
    toolbar.style.zIndex = '99999';
    toolbar.style.background = '#fff';
    toolbar.style.border = 'solid 1px #000';
    toolbar.style.padding = '4px';
    toolbar.style.display = 'flex';
    toolbar.style.gap = '4px';
    toolbar.style.alignItems = 'center';

    const label = document.createElement('span');
    label.textContent = 'AAT';
    label.style.fontWeight = 'bold';

    const testBtn = document.createElement('button');
    testBtn.type = 'button';
    testBtn.textContent = '表示テスト';
    testBtn.addEventListener('click', () => alert('ツールバー表示OK'));

    toolbar.append(label, testBtn);
    document.body.appendChild(toolbar);

    // ---- if you want: show console mark ----
    console.log('[AAT] safe boot OK', location.href);

    // ここまでで「表示が出ない」が解決するかをまず確認してほしい。
    // 解決したら、次に “あなたの完全版コード” をこの safe boot の土台に戻して統合する。
  };

  try {
    boot();
  } catch (e) {
    console.error('[AAT] fatal', e);
    alert('[AAT] エラーで停止: ' + e);
  }
})();
