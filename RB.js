// ==UserScript==
// @name         donguri teambattle assist (canvas対応・完全版)
// @version      2.0.0
// @description  teambattle canvas版対応: toolbar + progress + equip display + autoJoin / bag click save current equip
// @author       7234e634
// @match        https://donguri.5ch.net/teambattle*
// @match        https://donguri.5ch.net/bag
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';

  // -----------------------------
  // helpers
  // -----------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function safeJSON(str, fallback) {
    try { return JSON.parse(str); } catch { return fallback; }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function getModeQ() {
    // m=rb / m=l / default hc
    const qs = new URLSearchParams(location.search);
    const m = qs.get('m');
    if (m === 'rb') return { MODEQ: 'm=rb', MODEM: 'rb', MODENAME: '[ﾚﾄﾞﾌﾞﾙ]' };
    if (m === 'l')  return { MODEQ: 'm=l',  MODEM: 'l',  MODENAME: '[ﾗﾀﾞｰ]' };
    return { MODEQ: 'm=hc', MODEM: 'hc', MODENAME: '[ﾊｰﾄﾞｺｱ]' };
  }

  // -----------------------------
  // /bag: click save current equip
  // -----------------------------
  if (location.pathname === '/bag') {
    // table ids: weaponTable/armorTable/necklaceTable
    function saveCurrentEquip(url, index) {
      const currentEquip = safeJSON(localStorage.getItem('current_equip'), []) || [];
      const m = String(url).match(/https:\/\/donguri\.5ch\.net\/equip\/(\d+)/);
      if (!m) return;
      currentEquip[index] = m[1];
      localStorage.setItem('current_equip', JSON.stringify(currentEquip));
    }

    const tableIds = ['weaponTable', 'armorTable', 'necklaceTable'];
    tableIds.forEach((tid, index) => {
      const links = $$(`#${tid} a[href^="https://donguri.5ch.net/equip/"]`);
      links.forEach(a => {
        a.addEventListener('click', () => saveCurrentEquip(a.href, index), { passive: true });
      });
    });

    return;
  }

  // -----------------------------
  // teambattle main
  // -----------------------------
  const { MODEQ, MODEM, MODENAME } = getModeQ();

  // Guard: teambattle page?
  if (!location.pathname.startsWith('/teambattle')) return;

  // -----------------------------
  // settings
  // -----------------------------
  const settings = safeJSON(localStorage.getItem('aat_settings'), {}) || {};

  // -----------------------------
  // toolbar UI
  // -----------------------------
  const header = $('header');
  if (!header) return;

  header.style.marginTop = '110px';

  const toolbar = document.createElement('div');
  toolbar.style.position = 'fixed';
  toolbar.style.top = '0';
  toolbar.style.left = '0';
  toolbar.style.right = '0';
  toolbar.style.zIndex = '99999';
  toolbar.style.background = '#fff';
  toolbar.style.borderBottom = '1px solid #000';
  toolbar.style.padding = '6px 8px';
  toolbar.style.display = 'flex';
  toolbar.style.flexDirection = 'column';
  toolbar.style.gap = '6px';
  toolbar.style.boxSizing = 'border-box';

  // progress
  const progressRow = document.createElement('div');
  progressRow.style.display = 'flex';
  progressRow.style.alignItems = 'center';
  progressRow.style.gap = '8px';
  progressRow.style.flexWrap = 'wrap';

  const progressInfo = document.createElement('div');
  progressInfo.style.fontSize = '13px';
  progressInfo.style.whiteSpace = 'nowrap';

  const progressBar = document.createElement('div');
  progressBar.style.width = '380px';
  progressBar.style.maxWidth = '95vw';
  progressBar.style.height = '16px';
  progressBar.style.background = '#ddd';
  progressBar.style.borderRadius = '8px';
  progressBar.style.overflow = 'hidden';

  const progressBarBody = document.createElement('div');
  progressBarBody.style.height = '100%';
  progressBarBody.style.width = '0%';
  progressBarBody.style.background = '#428bca';
  progressBarBody.style.color = '#fff';
  progressBarBody.style.fontSize = '12px';
  progressBarBody.style.display = 'flex';
  progressBarBody.style.alignItems = 'center';
  progressBarBody.style.justifyContent = 'flex-end';
  progressBarBody.style.paddingRight = '6px';
  progressBarBody.style.boxSizing = 'border-box';
  progressBar.append(progressBarBody);

  progressRow.append(progressInfo, progressBar);

  // buttons
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '6px';
  btnRow.style.flexWrap = 'wrap';
  btnRow.style.alignItems = 'center';

  function mkBtn(text) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.style.border = '1px solid #000';
    b.style.background = '#eee';
    b.style.color = '#000';
    b.style.padding = '4px 8px';
    b.style.fontSize = '12px';
    b.style.borderRadius = '6px';
    b.style.whiteSpace = 'nowrap';
    return b;
  }

  const btnEquipPanelToggle = mkBtn('装備表示');
  const btnProgressRefresh = mkBtn('進捗更新');
  const btnAutoJoin = mkBtn('自動参戦');
  btnAutoJoin.style.background = '#ffb300';

  btnRow.append(btnEquipPanelToggle, btnProgressRefresh, btnAutoJoin);

  // equip display panel
  const equipPanel = document.createElement('div');
  equipPanel.style.display = 'none';
  equipPanel.style.gap = '6px';
  equipPanel.style.alignItems = 'center';
  equipPanel.style.flexWrap = 'wrap';
  equipPanel.style.borderTop = '1px solid #000';
  equipPanel.style.paddingTop = '6px';

  const equipTitle = document.createElement('span');
  equipTitle.textContent = '装備:';
  equipTitle.style.fontSize = '12px';
  equipTitle.style.fontWeight = '700';

  function mkEquipChip(label) {
    const wrap = document.createElement('span');
    wrap.style.display = 'inline-flex';
    wrap.style.gap = '4px';
    wrap.style.alignItems = 'center';
    wrap.style.border = '1px solid #000';
    wrap.style.background = '#fafafa';
    wrap.style.padding = '2px 6px';
    wrap.style.borderRadius = '6px';
    wrap.style.fontSize = '12px';
    const t = document.createElement('b');
    t.textContent = label;
    t.style.fontWeight = '700';
    const v = document.createElement('span');
    v.textContent = '-';
    v.dataset.role = 'value';
    wrap.append(t, v);
    return wrap;
  }

  const chipWeapon = mkEquipChip('武');
  const chipArmor  = mkEquipChip('防');
  const chipNeck   = mkEquipChip('首');

  const btnEquipRefresh = mkBtn('装備更新');
  btnEquipRefresh.style.background = '#ddd';

  equipPanel.append(equipTitle, chipWeapon, chipArmor, chipNeck, btnEquipRefresh);

  // autoJoin log
  const logBox = document.createElement('div');
  logBox.style.display = 'none';
  logBox.style.borderTop = '1px solid #000';
  logBox.style.paddingTop = '6px';
  logBox.style.maxHeight = '38vh';
  logBox.style.overflow = 'auto';
  logBox.style.fontSize = '12px';
  logBox.style.whiteSpace = 'pre-wrap';

  function logLine(s) {
    const now = new Date();
    const ts = now.toLocaleString('sv-SE');
    const div = document.createElement('div');
    div.textContent = `[${ts}] ${s}`;
    logBox.prepend(div);
  }

  toolbar.append(progressRow, btnRow, equipPanel, logBox);
  header.append(toolbar);

  // hide page h4 if exists (optional)
  const h4 = $('header h4');
  if (h4) h4.style.display = 'none';

  // -----------------------------
  // equip display logic
  // -----------------------------
  async function getEquipNameById(id) {
    try {
      const res = await fetch(`https://donguri.5ch.net/equip/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error(res.status);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const h = doc.querySelector('h1,h2,h3')?.textContent?.trim();
      if (h) return h;
      const tt = doc.querySelector('title')?.textContent?.trim();
      if (tt) return tt;
      return `#${id}`;
    } catch {
      return `#${id}`;
    }
  }

  async function renderEquipPanel() {
    const current = safeJSON(localStorage.getItem('current_equip'), []) || [];
    const ids = [current[0], current[1], current[2]];

    const valueNodes = [
      chipWeapon.querySelector('[data-role="value"]'),
      chipArmor.querySelector('[data-role="value"]'),
      chipNeck.querySelector('[data-role="value"]'),
    ];

    for (let i = 0; i < 3; i++) valueNodes[i].textContent = ids[i] ? `#${ids[i]}` : '-';
    if (!ids.some(Boolean)) return;

    const names = await Promise.all(ids.map(id => id ? getEquipNameById(id) : '-'));
    for (let i = 0; i < 3; i++) valueNodes[i].textContent = ids[i] ? names[i] : '-';
  }

  btnEquipPanelToggle.addEventListener('click', () => {
    equipPanel.style.display = (equipPanel.style.display === 'none') ? 'flex' : 'none';
    if (equipPanel.style.display !== 'none') renderEquipPanel().catch(console.error);
  });

  btnEquipRefresh.addEventListener('click', () => renderEquipPanel().catch(console.error));

  // -----------------------------
  // progress bar logic
  // -----------------------------
  let currentPeriod = null;
  let currentProgress = null;

  async function drawProgressBar() {
    try {
      const res = await fetch('https://donguri.5ch.net/', { credentials: 'include' });
      if (!res.ok) throw new Error(res.status);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      // 既存のあなたの実装に寄せる：stat-blockのどこかに「第 xxxx 期」「xx%」がある想定
      // 取り方が変わっても壊れにくいように雑に抽出
      const bodyText = doc.body?.textContent || '';
      const periodMatch = bodyText.match(/第\s*(\d+)\s*期/);
      const progressMatch = bodyText.match(/(\d+)\s*%/);

      currentPeriod = periodMatch ? Number(periodMatch[1]) : currentPeriod;
      currentProgress = progressMatch ? Number(progressMatch[1]) : currentProgress;

      if (Number.isFinite(currentProgress)) {
        progressBarBody.style.width = `${currentProgress}%`;
        progressBarBody.textContent = `${currentProgress}%`;
      }

      const str = (Number.isFinite(currentPeriod) && Number.isFinite(currentProgress))
        ? `${MODENAME} 第 ${currentPeriod} 期 / 進捗 ${currentProgress}%`
        : `${MODENAME} 進捗取得失敗（ログイン/制限の可能性）`;

      progressInfo.textContent = str;
    } catch (e) {
      console.error(e);
      progressInfo.textContent = `${MODENAME} 進捗取得エラー`;
    }
  }

  btnProgressRefresh.addEventListener('click', () => drawProgressBar().catch(console.error));
  drawProgressBar().catch(console.error);
  setInterval(() => drawProgressBar().catch(()=>{}), 18000);

  // -----------------------------
  // Canvas版 teambattle 情報抽出
  //   - 重要：.grid が無い。ページ内 <script> から
  //     GRID_SIZE / cellColors / capitalList / modeQS を取る
  // -----------------------------
  function parseBattleScriptFromHTML(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const scripts = $$('script', doc);

    // 目印：const GRID_SIZE = / const cellColors = / const capitalList =
    const s = scripts.find(x => {
      const t = x.textContent || '';
      return t.includes('const GRID_SIZE') && t.includes('const cellColors') && (t.includes('const capitalList') || t.includes('capitalList'));
    });

    if (!s) return null;
    const t = s.textContent || '';

    const gridMatch = t.match(/const\s+GRID_SIZE\s*=\s*(\d+)\s*;/);
    const gridSize = gridMatch ? Number(gridMatch[1]) : null;

    // cellColors = { '0-3': '#d32f2f', ... };
    const cellColorsMatch = t.match(/const\s+cellColors\s*=\s*({[\s\S]*?})\s*;/);
    let cellColors = {};
    if (cellColorsMatch) {
      try {
        // cellColors literal is JS object; safe eval as expression
        cellColors = Function('"use strict";return (' + cellColorsMatch[1] + ')')();
      } catch {
        cellColors = {};
      }
    }

    // capitalList = [[6,6],[1,3]];
    const capitalMatch = t.match(/const\s+capitalList\s*=\s*(\[[\s\S]*?\])\s*;/);
    let capitalList = [];
    if (capitalMatch) {
      try { capitalList = JSON.parse(capitalMatch[1]); } catch { capitalList = []; }
    }

    // modeQS = "&m=rb";
    const modeQSMatch = t.match(/const\s+modeQS\s*=\s*["']([^"']+)["']\s*;/);
    const modeQS = modeQSMatch ? modeQSMatch[1] : `&${MODEQ}`;

    return { gridSize, cellColors, capitalList, modeQS };
  }

  async function fetchBattleState() {
    const res = await fetch(`https://donguri.5ch.net/teambattle?${MODEQ}`, { credentials: 'include' });
    if (!res.ok) throw new Error(res.status);
    const html = await res.text();
    const parsed = parseBattleScriptFromHTML(html);
    if (!parsed || !parsed.gridSize) throw new Error('battle script parse failed');
    return parsed;
  }

  // -----------------------------
  // AutoJoin (軽量・確実版)
  //  - 近接候補：capitalList の4方向隣接セル
  //  - それでも無ければ：マップ端
  //  - 1回成功/休憩系/too fast で待つ
  // -----------------------------
  let autoJoinRunning = false;
  let autoJoinStopFlag = false;

  const BTN_AUTOJOIN_IDLE = '自動参戦';
  const BTN_AUTOJOIN_RUN  = '自動参戦停止';

  btnAutoJoin.addEventListener('click', async () => {
    if (autoJoinRunning) {
      autoJoinStopFlag = true;
      logLine('停止要求');
      return;
    }
    autoJoinStopFlag = false;
    autoJoinRunning = true;
    logBox.style.display = 'block';
    btnAutoJoin.textContent = BTN_AUTOJOIN_RUN;
    btnAutoJoin.style.background = '#f64';
    try {
      await autoJoinLoop();
    } finally {
      autoJoinRunning = false;
      btnAutoJoin.textContent = BTN_AUTOJOIN_IDLE;
      btnAutoJoin.style.background = '#ffb300';
      logLine('自動参戦終了');
    }
  });

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function inBounds(r, c, N) { return r >= 0 && c >= 0 && r < N && c < N; }

  function candidatesFromCapitals(capitalList, N) {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    const set = new Set();
    for (const [r, c] of (capitalList || [])) {
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc, N)) set.add(`${nr}-${nc}`);
      }
    }
    return [...set].map(k => k.split('-').map(Number));
  }

  function edgeCells(N) {
    const set = new Set();
    for (let i = 0; i < N; i++) {
      set.add(`${i}-0`);
      set.add(`${i}-${N-1}`);
      set.add(`0-${i}`);
      set.add(`${N-1}-${i}`);
    }
    return [...set].map(k => k.split('-').map(Number));
  }

  async function challengeCell(r, c) {
    const body = `row=${encodeURIComponent(r)}&col=${encodeURIComponent(c)}`;
    const res = await fetch(`/teamchallenge?${MODEQ}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      credentials: 'include'
    });
    const text = await res.text();
    const lastLine = text.trim().split('\n').pop();
    return { ok: res.ok, text, lastLine };
  }

  function classifyLastLine(lastLine) {
    if (!lastLine) return 'unknown';
    if (lastLine === 'ng<>too fast' || lastLine.includes('ちょっとゆっくり') || lastLine.includes('動きを使い果たしました')) return 'too_fast';
    if (lastLine.includes('最初にチームに参加する必要があります')) return 'need_team';
    if (lastLine.includes('どんぐりが見つかりませんでした')) return 'need_login';
    if (lastLine.includes('武器と防具を装備しなければなりません')) return 'need_equip';
    if (lastLine.includes('このタイルは攻撃できません')) return 'cant_attack';
    if (lastLine.startsWith('アリーナチャレンジ開始') || lastLine.includes('リーダーになった') || lastLine.includes('新しいアリーナリーダー')) return 'success';
    return 'other';
  }

  async function autoJoinLoop() {
    logLine(`開始 ${MODENAME} (${MODEQ})`);
    await drawProgressBar();

    // “装備が無い”で止まるのを避ける：武/防は保存されてる前提
    const current = safeJSON(localStorage.getItem('current_equip'), []) || [];
    if (!current[0] || !current[1]) {
      logLine('停止: /bag で武器と防具をクリックして current_equip を保存してください');
      return;
    }

    let retrySleep = 1500;

    while (!autoJoinStopFlag) {
      let state;
      try {
        state = await fetchBattleState();
      } catch (e) {
        logLine(`state取得失敗: ${String(e)} / 20s待機`);
        await sleep(20000);
        continue;
      }

      const N = state.gridSize;
      const capAdj = shuffle(candidatesFromCapitals(state.capitalList, N));
      const edges = shuffle(edgeCells(N));

      // まず首都隣接を叩く→ダメなら端へ
      const pools = [ { name: 'capital-adj', list: capAdj }, { name: 'edge', list: edges } ];

      let didAction = false;

      for (const pool of pools) {
        for (const [r, c] of pool.list) {
          if (autoJoinStopFlag) break;

          didAction = true;
          const { lastLine } = await challengeCell(r, c);
          const type = classifyLastLine(lastLine);

          logLine(`(${r},${c}) [${pool.name}] ${lastLine}`);

          if (type === 'success') {
            retrySleep = 1500;
            await sleep(1500);
            break; // 次のループで状態更新
          }

          if (type === 'too_fast') {
            // サーバ都合の待ち
            await sleep(10100);
            continue;
          }

          if (type === 'need_login' || type === 'need_team') {
            logLine(`停止: ${lastLine}`);
            return;
          }

          if (type === 'need_equip') {
            logLine('停止: 武器/防具が未装備扱い。/bag で装備保存→装備ページで装備状態確認して');
            return;
          }

          // other/cant_attack は次へ
          await sleep(retrySleep);
        }
        if (autoJoinStopFlag) break;
      }

      if (!didAction) {
        logLine('攻撃候補が空。20s待機');
        await sleep(20000);
      } else {
        // ほどほどに
        await sleep(2000);
      }
    }

    logLine('停止要求により停止');
  }

})();
