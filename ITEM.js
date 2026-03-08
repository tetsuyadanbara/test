// ==UserScript==
// @name         5ch donguri item modify
// @namespace    5ch donguri item modify
// @version      1.4.2
// @description  簡易MOD表示 + 非同期更新 + 成功失敗ポップアップ + 成功ステータス発光 + 連続MOD安定版
// @license      MIT
// @author       81f32c5c
// @match        https://donguri.5ch.io/modify/weapon/*
// @match        https://donguri.5ch.io/modify/armor/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';

  const STYLE_ID = 'donguri-mod-helper-style';
  const ROOT_ID = 'donguri-mod-helper-root';
  const TOAST_AREA_ID = 'donguri-mod-toast-area';
  const LOADING_ID = 'donguri-mod-helper-loading';
  const CONTENT_ID = 'donguri-mod-main-content';

  let isSubmitting = false;
  let autoModRunning = false;
  let autoModStopRequested = false;
  let autoModSession = null;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${CONTENT_ID} {
        display: block;
      }

      .donguri-mod-helper-root {
        margin-bottom: 12px;
      }
      .donguri-mod-helper-container {
        margin-bottom: 12px;
      }
      .donguri-mod-helper-root .upgrade-option button {
        margin-top: 8px;
      }
      .donguri-mod-helper-root .helper-heading {
        width: 100%;
        font-size: 1.1em;
        font-weight: bold;
        margin: 0 0 8px;
      }

      .donguri-mod-helper-loading {
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 99999;
        padding: 8px 12px;
        border-radius: 8px;
        background: rgba(0,0,0,.82);
        color: #fff;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,.25);
      }
      .donguri-mod-helper-loading[hidden] {
        display: none !important;
      }

      .donguri-mod-toast-area {
        position: fixed;
        top: 52px;
        right: 12px;
        z-index: 100000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }
      .donguri-mod-toast {
        min-width: 220px;
        max-width: 440px;
        padding: 10px 12px;
        border-radius: 10px;
        color: #fff;
        font-size: 14px;
        box-shadow: 0 4px 16px rgba(0,0,0,.25);
        opacity: 0;
        transform: translateY(-6px);
        animation: donguriModToastIn .18s ease-out forwards;
      }
      .donguri-mod-toast.success { background: rgba(25,135,84,.95); }
      .donguri-mod-toast.fail    { background: rgba(220,53,69,.95); }
      .donguri-mod-toast.info    { background: rgba(13,110,253,.95); }
      .donguri-mod-toast.warn    { background: rgba(255,153,0,.95); }

      @keyframes donguriModToastIn {
        to { opacity: 1; transform: translateY(0); }
      }

      .donguri-mod-highlight {
        animation: donguriModFlash 1.8s ease-out 1;
        border-radius: 4px;
        padding: 0 4px;
      }

      @keyframes donguriModFlash {
        0%   { background: rgba(255, 235, 59, 0.95); box-shadow: 0 0 0 rgba(255, 235, 59, 0); }
        35%  { background: rgba(255, 235, 59, 0.95); box-shadow: 0 0 12px rgba(255, 235, 59, 0.85); }
        100% { background: transparent; box-shadow: 0 0 0 rgba(255, 235, 59, 0); }
      }

      .donguri-automod-panel {
        margin-top: 12px;
        padding: 12px;
        border-radius: 8px;
        background: #f5f7fb;
      }
      .donguri-automod-panel .row {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .donguri-automod-panel select,
      .donguri-automod-panel input {
        font-size: 14px;
        padding: 6px 8px;
      }
      .donguri-automod-panel button {
        padding: 8px 12px;
      }
      .donguri-automod-status {
        margin-top: 8px;
        font-size: 14px;
        white-space: pre-wrap;
      }
    `;
    document.head.appendChild(style);
  }

  function getLoadingBox() {
    let box = document.getElementById(LOADING_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = LOADING_ID;
      box.className = 'donguri-mod-helper-loading';
      box.hidden = true;
      box.textContent = 'MOD実行中...';
      document.body.appendChild(box);
    }
    return box;
  }

  function setLoading(flag) {
    getLoadingBox().hidden = !flag;
  }

  function getToastArea() {
    let area = document.getElementById(TOAST_AREA_ID);
    if (!area) {
      area = document.createElement('div');
      area.id = TOAST_AREA_ID;
      area.className = 'donguri-mod-toast-area';
      document.body.appendChild(area);
    }
    return area;
  }

  function showToast(message, type = 'info', timeout = 2200) {
    const area = getToastArea();
    const toast = document.createElement('div');
    toast.className = `donguri-mod-toast ${type}`;
    toast.textContent = message;
    area.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      toast.style.transition = 'opacity .18s ease, transform .18s ease';
      setTimeout(() => toast.remove(), 220);
    }, timeout);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getPageInfo() {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length < 4 || parts[0] !== 'modify') return null;
    const itemType = parts[1];
    if (itemType !== 'weapon' && itemType !== 'armor') return null;
    const itemId = parts[3];
    if (!itemId) return null;
    return { itemType, itemId };
  }

  function createElement(tag, className) {
    const el = document.createElement(tag);
    if (className) el.classList.add(className);
    return el;
  }

  function makeAction(itemType, itemId, statPath) {
    return `${location.origin}/modify/${itemType}/${statPath}/${itemId}`;
  }

  function getStatConfig(itemType) {
    if (itemType === 'weapon') {
      return {
        countIds: { mod: 'weaponModCount', demod: 'weaponDeModCount' },
        fields: {
          dmglow:       { label: 'DMG（最小値）', valueId: 'weaponDMGmin' },
          dmghigh:      { label: 'DMG（最大値）', valueId: 'weaponHardnessMax' },
          speed:        { label: 'SPD', valueId: 'weaponSpeed' },
          critical:     { label: 'CRIT', valueId: 'weaponCritical' },
          dmglowdown:   { label: 'DMG（最小値）', valueId: 'weaponDMGmin' },
          dmghighdown:  { label: 'DMG（最大値）', valueId: 'weaponHardnessMax' },
          speeddown:    { label: 'SPD', valueId: 'weaponSpeed' },
          criticaldown: { label: 'CRIT', valueId: 'weaponCritical' }
        },
        buttons: [
          { name: 'DMG（最小値）↑', path: 'dmglow' },
          { name: 'DMG（最大値）↑', path: 'dmghigh' },
          { name: 'SPD↑', path: 'speed' },
          { name: 'CRIT↑', path: 'critical' },
          { name: 'DMG（最小値）↓', path: 'dmglowdown', className: 'downgrade' },
          { name: 'DMG（最大値）↓', path: 'dmghighdown', className: 'downgrade' },
          { name: 'SPD↓', path: 'speeddown', className: 'downgrade' },
          { name: 'CRIT↓', path: 'criticaldown', className: 'downgrade' }
        ]
      };
    }

    return {
      countIds: { mod: 'armorModCount', demod: 'armorDeModCount' },
      fields: {
        deflow:       { label: 'DEF（最小値）', valueId: 'armorDefenseMin' },
        defhigh:      { label: 'DEF（最大値）', valueId: 'armorDefenseMax' },
        weight:       { label: 'WT.', valueId: 'armorWeight' },
        critical:     { label: 'CRIT', valueId: 'armorCritical' },
        deflowdown:   { label: 'DEF（最小値）', valueId: 'armorDefenseMin' },
        defhighdown:  { label: 'DEF（最大値）', valueId: 'armorDefenseMax' },
        weightdown:   { label: 'WT.', valueId: 'armorWeight' },
        criticaldown: { label: 'CRIT', valueId: 'armorCritical' }
      },
      buttons: [
        { name: 'DEF（最小値）↑', path: 'deflow' },
        { name: 'DEF（最大値）↑', path: 'defhigh' },
        { name: 'WT.↑', path: 'weight' },
        { name: 'CRIT↑', path: 'critical' },
        { name: 'DEF（最小値）↓', path: 'deflowdown', className: 'downgrade' },
        { name: 'DEF（最大値）↓', path: 'defhighdown', className: 'downgrade' },
        { name: 'WT.↓', path: 'weightdown', className: 'downgrade' },
        { name: 'CRIT↓', path: 'criticaldown', className: 'downgrade' }
      ]
    };
  }

  function textOf(doc, id) {
    const el = doc.getElementById(id);
    return el ? el.textContent.trim() : '';
  }

  function normalizeValue(v) {
    return String(v || '').replace(/\s+/g, ' ').trim();
  }

  function parseIntSafe(text) {
    const m = String(text || '').replace(/,/g, '').match(/-?\d+/);
    return m ? Number(m[0]) : 0;
  }

  function parseActionPath(actionUrl) {
    try {
      const url = new URL(actionUrl, location.origin);
      const parts = url.pathname.split('/').filter(Boolean);
      return parts[2] || '';
    } catch {
      return '';
    }
  }

  function isDownAction(actionPath) {
    return /down$/.test(actionPath);
  }

  function hasTooFast(doc, rawHtml = '') {
    const bodyText = normalizeValue(doc?.body?.textContent || '');
    const htmlText = normalizeValue(String(rawHtml || ''))
      .replace(/&gt;/gi, '>')
      .replace(/&lt;/gi, '<')
      .replace(/&nbsp;/gi, ' ');

    return (
      /too\s*fast/i.test(bodyText) ||
      /too\s*fast/i.test(htmlText) ||
      /ng\s*>\s*too\s*fast/i.test(bodyText) ||
      /ng\s*>\s*too\s*fast/i.test(htmlText) ||
      /ng>\s*too\s*fast/i.test(bodyText) ||
      /ng>\s*too\s*fast/i.test(htmlText)
    );
  }

  function compareStats(oldDoc, newDoc, actionPath, rawHtml = '') {
    const info = getPageInfo();
    if (!info) {
      return { status: 'fail', success: false, changed: [], label: actionPath || 'MOD' };
    }

    const cfg = getStatConfig(info.itemType);
    const field = cfg.fields[actionPath];
    if (!field) {
      return { status: 'fail', success: false, changed: [], label: actionPath || 'MOD' };
    }

    const oldValue = normalizeValue(textOf(oldDoc, field.valueId));
    const newValue = normalizeValue(textOf(newDoc, field.valueId));
    const valueChanged = oldValue !== newValue;

    const oldModCount = parseIntSafe(textOf(oldDoc, cfg.countIds.mod));
    const newModCount = parseIntSafe(textOf(newDoc, cfg.countIds.mod));
    const oldDeModCount = parseIntSafe(textOf(oldDoc, cfg.countIds.demod));
    const newDeModCount = parseIntSafe(textOf(newDoc, cfg.countIds.demod));

    const modCountUp = newModCount > oldModCount;
    const demodCountUp = newDeModCount > oldDeModCount;
    const downAction = isDownAction(actionPath);
    const tooFast = hasTooFast(newDoc, rawHtml);

    let status = 'fail';
    let success = false;
    let skipCount = false;
    let suppressFailToast = false;

    if (tooFast) {
      status = 'too_fast';
      success = false;
      skipCount = true;
    } else if (downAction) {
      if (valueChanged || demodCountUp) {
        status = 'success';
        success = true;
        suppressFailToast = true;
      } else {
        status = 'fail';
      }
    } else {
      if (valueChanged || modCountUp) {
        status = 'success';
        success = true;
      } else {
        status = 'fail';
      }
    }

    return {
      status,
      success,
      skipCount,
      suppressFailToast,
      changed: valueChanged ? [field.valueId] : [],
      label: field.label,
      oldValue,
      newValue,
      oldModCount,
      newModCount,
      oldDeModCount,
      newDeModCount,
      downAction,
      tooFast
    };
  }

  function applyHighlights(ids) {
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('donguri-mod-highlight');
      void el.offsetWidth;
      el.classList.add('donguri-mod-highlight');
      setTimeout(() => el.classList.remove('donguri-mod-highlight'), 1900);
    });
  }

  function ensureContentWrapper() {
    let wrap = document.getElementById(CONTENT_ID);
    if (wrap) return wrap;

    wrap = document.createElement('div');
    wrap.id = CONTENT_ID;

    while (document.body.firstChild) {
      wrap.appendChild(document.body.firstChild);
    }
    document.body.appendChild(wrap);
    return wrap;
  }

  function extractBodyChildren(html) {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  function replaceMainContent(newDoc) {
    const currentWrap = ensureContentWrapper();
    const newWrap = document.createElement('div');
    newWrap.id = CONTENT_ID;

    Array.from(newDoc.body.childNodes).forEach(node => {
      newWrap.appendChild(document.importNode(node, true));
    });

    currentWrap.replaceWith(newWrap);
  }

  function removeOldHelper() {
    const old = document.getElementById(ROOT_ID);
    if (old) old.remove();
  }

  function buildHelper() {
    const info = getPageInfo();
    if (!info) return;

    const { itemType, itemId } = info;
    const cfg = getStatConfig(itemType);

    removeOldHelper();

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'donguri-mod-helper-root';

    const topContainer = createElement('div', 'container');
    topContainer.classList.add('donguri-mod-helper-container');

    const topTitle = document.createElement('div');
    topTitle.className = 'helper-heading';
    topTitle.textContent = '簡易MODボタン';
    topContainer.appendChild(topTitle);

    const topOptions = topContainer.appendChild(createElement('div', 'upgrade-options'));

    cfg.buttons.forEach((opt) => {
      const form = createElement('form', 'upgrade-option');
      form.action = makeAction(itemType, itemId, opt.path);
      form.method = 'POST';
      form.dataset.modHelper = '1';

      const button = form.appendChild(createElement('button', opt.className));
      button.type = 'submit';
      button.textContent = opt.name;

      topOptions.appendChild(form);
    });

    const autoPanel = createElement('div', 'donguri-automod-panel');
    autoPanel.innerHTML = `
      <div class="helper-heading">連続MOD</div>
      <div class="row">
        <label>対象:
          <select id="donguriAutoModTarget"></select>
        </label>
        <label>回数:
          <input id="donguriAutoModCount" type="number" min="1" max="9999" value="10" style="width:90px;">
        </label>
        <label>間隔(ms):
          <input id="donguriAutoModDelay" type="number" min="500" max="10000" value="1500" style="width:100px;">
        </label>
        <button type="button" id="donguriAutoModStart">開始</button>
        <button type="button" id="donguriAutoModStop">停止</button>
      </div>
      <div class="donguri-automod-status" id="donguriAutoModStatus">待機中</div>
    `;

    const select = autoPanel.querySelector('#donguriAutoModTarget');
    cfg.buttons.forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.path;
      option.textContent = opt.name;
      select.appendChild(option);
    });

    if (autoModSession) {
      select.value = autoModSession.target;
      autoPanel.querySelector('#donguriAutoModCount').value = String(autoModSession.totalTarget);
      autoPanel.querySelector('#donguriAutoModDelay').value = String(autoModSession.baseDelay);
    }

    autoPanel.querySelector('#donguriAutoModStart').addEventListener('click', startAutoMod);
    autoPanel.querySelector('#donguriAutoModStop').addEventListener('click', stopAutoMod);

    topContainer.appendChild(autoPanel);
    root.appendChild(topContainer);

    const wrap = ensureContentWrapper();
    wrap.prepend(root);
  }

  function setAutoModStatus(text) {
    const el = document.getElementById('donguriAutoModStatus');
    if (el) el.textContent = text;
  }

  async function submitByFetch(form, { silentLoading = false, showResultToast = true } = {}) {
    if (isSubmitting) return { ok: false, reason: 'busy' };
    isSubmitting = true;

    if (!silentLoading) {
      setLoading(true);
    } else {
      setLoading(false);
    }

    const oldDoc = document.cloneNode(true);
    const actionPath = parseActionPath(form.action);

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        credentials: 'same-origin'
      });

      const html = await res.text();
      const newDoc = extractBodyChildren(html);
      const result = compareStats(oldDoc, newDoc, actionPath, html);

      document.title = newDoc.title || document.title;
      replaceMainContent(newDoc);
      history.replaceState(null, '', res.url || form.action);

      injectStyle();
      getToastArea();
      getLoadingBox();
      buildHelper();

      if (showResultToast) {
        if (result.status === 'success') {
          if (result.oldValue && result.newValue && result.oldValue !== result.newValue) {
            showToast(`${result.label} 成功: ${result.oldValue} → ${result.newValue}`, 'success');
          } else {
            showToast(`${result.label} 実行成功`, 'success');
          }
        } else if (result.status === 'too_fast') {
          showToast(`${result.label} too fast`, 'warn', 1400);
        } else if (!(result.downAction && result.suppressFailToast)) {
          showToast(`${result.label} 失敗 / 変化なし`, 'fail');
        }
      }

      if (result.success && result.changed.length) {
        applyHighlights(result.changed);
      }

      setLoading(false);
      return { ok: true, result };
    } catch (e) {
      console.error('MOD fetch failed:', e);
      setLoading(false);
      showToast('MOD後の画面更新に失敗しました', 'fail', 2800);
      return { ok: false, reason: 'fetch_error', error: e };
    } finally {
      isSubmitting = false;
    }
  }

  function getHelperFormByPath(path) {
    const info = getPageInfo();
    if (!info) return null;
    return document.querySelector(`#${ROOT_ID} form[action="${makeAction(info.itemType, info.itemId, path)}"]`);
  }

  async function startAutoMod() {
    if (autoModRunning) {
      showToast('連続MODはすでに実行中です', 'info');
      return;
    }

    const info = getPageInfo();
    if (!info) return;

    const target = document.getElementById('donguriAutoModTarget')?.value;
    const totalTarget = Math.max(1, Math.floor(Number(document.getElementById('donguriAutoModCount')?.value || 1)));
    const baseDelay = Math.max(500, Math.floor(Number(document.getElementById('donguriAutoModDelay')?.value || 1500)));

    if (!target) {
      showToast('対象を選んでください', 'fail');
      return;
    }

    autoModRunning = true;
    autoModStopRequested = false;
    setLoading(false);

    autoModSession = {
      target,
      totalTarget,
      baseDelay,
      currentDelay: baseDelay,
      completed: 0,
      successCount: 0,
      failCount: 0,
      skippedTooFast: 0,
      attempts: 0
    };

    showToast(`連続MOD開始: ${target} × ${totalTarget} / 間隔 ${baseDelay}ms`, 'info', 3000);

    while (autoModSession.completed < autoModSession.totalTarget) {
      if (autoModStopRequested) break;

      const form = getHelperFormByPath(autoModSession.target);
      if (!form) {
        autoModSession.failCount++;
        setAutoModStatus(
          `フォームが見つかりません: ${autoModSession.target}\n` +
          `成功 ${autoModSession.successCount} / 失敗 ${autoModSession.failCount} / too fast ${autoModSession.skippedTooFast}`
        );
        break;
      }

      autoModSession.attempts++;

      setAutoModStatus(
        `実行中 ${autoModSession.completed}/${autoModSession.totalTarget}\n` +
        `成功 ${autoModSession.successCount} / 失敗 ${autoModSession.failCount} / too fast ${autoModSession.skippedTooFast}\n` +
        `現在間隔 ${autoModSession.currentDelay}ms`
      );

      const ret = await submitByFetch(form, {
        silentLoading: true,
        showResultToast: false
      });

      if (!ret.ok) {
        autoModSession.failCount++;
        setAutoModStatus(
          `通信失敗\n` +
          `実行中 ${autoModSession.completed}/${autoModSession.totalTarget}\n` +
          `成功 ${autoModSession.successCount} / 失敗 ${autoModSession.failCount} / too fast ${autoModSession.skippedTooFast}\n` +
          `現在間隔 ${autoModSession.currentDelay}ms`
        );
        showToast('通信失敗', 'fail', 1200);
        setLoading(false);
        await sleep(autoModSession.currentDelay);
        continue;
      }

      const result = ret.result;

      if (result.status === 'success') {
        autoModSession.completed++;
        autoModSession.successCount++;
        autoModSession.currentDelay = autoModSession.baseDelay;

        setAutoModStatus(
          `実行中 ${autoModSession.completed}/${autoModSession.totalTarget}\n` +
          `成功 ${autoModSession.successCount} / 失敗 ${autoModSession.failCount} / too fast ${autoModSession.skippedTooFast}\n` +
          `現在間隔 ${autoModSession.currentDelay}ms`
        );

        if (result.oldValue && result.newValue && result.oldValue !== result.newValue) {
          showToast(
            `${result.label} 成功 ${result.oldValue} → ${result.newValue} (${autoModSession.completed}/${autoModSession.totalTarget})`,
            'success',
            1200
          );
        } else {
          showToast(
            `${result.label} 実行成功 (${autoModSession.completed}/${autoModSession.totalTarget})`,
            'success',
            1200
          );
        }
      } else if (result.status === 'too_fast') {
        autoModSession.skippedTooFast++;
        autoModSession.currentDelay = Math.min(autoModSession.currentDelay + 500, 10000);

        setAutoModStatus(
          `too fast のため再試行\n` +
          `実行中 ${autoModSession.completed}/${autoModSession.totalTarget}\n` +
          `成功 ${autoModSession.successCount} / 失敗 ${autoModSession.failCount} / too fast ${autoModSession.skippedTooFast}\n` +
          `現在間隔 ${autoModSession.currentDelay}ms`
        );

        showToast(
          `too fast: カウントせず再試行 / 次回 ${autoModSession.currentDelay}ms`,
          'warn',
          1400
        );
      } else {
        autoModSession.completed++;
        autoModSession.failCount++;

        setAutoModStatus(
          `実行中 ${autoModSession.completed}/${autoModSession.totalTarget}\n` +
          `成功 ${autoModSession.successCount} / 失敗 ${autoModSession.failCount} / too fast ${autoModSession.skippedTooFast}\n` +
          `現在間隔 ${autoModSession.currentDelay}ms`
        );

        if (!(result.downAction && result.suppressFailToast)) {
          showToast(
            `${result.label} 失敗 / 変化なし (${autoModSession.completed}/${autoModSession.totalTarget})`,
            'fail',
            1200
          );
        }
      }

      if (autoModStopRequested) break;

      setLoading(false);

      if (autoModSession.completed < autoModSession.totalTarget) {
        setAutoModStatus(
          `待機中...\n` +
          `実行中 ${autoModSession.completed}/${autoModSession.totalTarget}\n` +
          `成功 ${autoModSession.successCount} / 失敗 ${autoModSession.failCount} / too fast ${autoModSession.skippedTooFast}\n` +
          `次回まで ${autoModSession.currentDelay}ms`
        );
        await sleep(autoModSession.currentDelay);
        setLoading(false);
      }
    }

    const stopped = autoModStopRequested;
    autoModRunning = false;
    autoModStopRequested = false;
    setLoading(false);

    const finalMsg =
      (stopped ? '連続MOD停止' : '連続MOD完了') +
      `: 成功 ${autoModSession.successCount} / 失敗 ${autoModSession.failCount} / too fast ${autoModSession.skippedTooFast}`;

    setAutoModStatus(finalMsg);
    showToast(finalMsg, stopped ? 'info' : 'success', 3500);

    autoModSession = null;
  }

  function stopAutoMod() {
    if (!autoModRunning) {
      showToast('連続MODは動いていません', 'info');
      return;
    }
    autoModStopRequested = true;
    setAutoModStatus('停止要求を送信しました...');
    showToast('連続MODを停止します', 'info');
  }

  function bindSubmitInterceptor() {
    document.addEventListener('submit', async (ev) => {
      const form = ev.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!form.action) return;
      if (!/https:\/\/donguri\.5ch\.io\/modify\/(weapon|armor)\//.test(form.action)) return;

      ev.preventDefault();
      await submitByFetch(form);
    }, true);
  }

  function init() {
    if (!getPageInfo()) return;
    injectStyle();
    ensureContentWrapper();
    buildHelper();
    getLoadingBox();
    getToastArea();
  }

  bindSubmitInterceptor();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
