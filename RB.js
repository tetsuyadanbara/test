// ==UserScript==
// @name         donguri arena assist tool (canvas compatible + auto join full)
// @version      2.0.0
// @description  Fix teambattle UI (canvas grid compatible), build DOM grid, add range select & auto join.
// @author       7234e634 (patched by ChatGPT)
// @match        https://donguri.5ch.net/teambattle*
// @match        https://donguri.5ch.net/bag
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // -----------------------------
  // Helpers
  // -----------------------------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
  const safeJSON = (s, dflt) => { try { return JSON.parse(s); } catch { return dflt; } };

  function getModeQ() {
    // location.search includes '?m=rb' or '&m=rb' (when r/c present)
    const sp = new URL(location.href).searchParams;
    const m = sp.get('m');
    if (m === 'l') return { MODEQ: 'm=l', MODENAME: '[ﾗﾀﾞｰ]', MODEM: 'l' };
    if (m === 'rb') return { MODEQ: 'm=rb', MODENAME: '[ﾚﾄﾞﾌﾞﾙ]', MODEM: 'rb' };
    return { MODEQ: 'm=hc', MODENAME: '[ﾊｰﾄﾞｺｱ]', MODEM: 'hc' };
  }

  function getSettings() {
    return safeJSON(localStorage.getItem('aat_settings'), {}) || {};
  }
  function saveSettings(settings) {
    localStorage.setItem('aat_settings', JSON.stringify(settings || {}));
  }

  function parseObjectLiteral(src) {
    // src is like "{ '0-1': '#d32f2f', ... }" or "{ '0-1': '#d32f2f', }"
    // Use Function to handle single quotes safely, but restrict context.
    try {
      // eslint-disable-next-line no-new-func
      return Function('"use strict"; return (' + src + ');')();
    } catch (e) {
      console.error('parseObjectLiteral failed', e);
      return {};
    }
  }

  function extractGridPayloadFromHtml(htmlText) {
    // We need GRID_SIZE, cellColors, capitalList (or capitalMap)
    const out = { GRID_SIZE: null, cellColors: {}, capitalList: [] };

    // GRID_SIZE
    const mGrid = htmlText.match(/const\s+GRID_SIZE\s*=\s*(\d+)\s*;/);
    if (mGrid) out.GRID_SIZE = Number(mGrid[1]);

    // cellColors
    // Matches: const cellColors = { ... };
    const mColors = htmlText.match(/const\s+cellColors\s*=\s*({[\s\S]*?})\s*;/);
    if (mColors) out.cellColors = parseObjectLiteral(mColors[1]) || {};

    // capitalList (new canvas source uses capitalList)
    const mCapList = htmlText.match(/const\s+capitalList\s*=\s*(\[[\s\S]*?\])\s*;/);
    if (mCapList) {
      try { out.capitalList = JSON.parse(mCapList[1]); } catch { out.capitalList = []; }
    }

    // fallback old name capitalMap
    if (!out.capitalList?.length) {
      const mCapMap = htmlText.match(/const\s+capitalMap\s*=\s*(\[[\s\S]*?\])\s*;/);
      if (mCapMap) {
        try { out.capitalList = JSON.parse(mCapMap[1]); } catch { out.capitalList = []; }
      }
    }

    return out;
  }

  async function fetchTeambattleHtml(MODEQ) {
    // MODEQ like 'm=rb'
    const url = `https://donguri.5ch.net/teambattle?${MODEQ}`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`[${res.status}] teambattle fetch failed`);
    return await res.text();
  }

  function getRgbBrightness(cssColor) {
    // cssColor may be "rgb(r,g,b)" or "#rrggbb"
    let r, g, b;
    if (!cssColor) return 255;
    const m = cssColor.match(/\d+/g);
    if (m && m.length >= 3) {
      r = Number(m[0]); g = Number(m[1]); b = Number(m[2]);
    } else if (cssColor.startsWith('#') && cssColor.length === 7) {
      r = parseInt(cssColor.slice(1, 3), 16);
      g = parseInt(cssColor.slice(3, 5), 16);
      b = parseInt(cssColor.slice(5, 7), 16);
    } else {
      return 255;
    }
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // -----------------------------
  // /bag: save current equip on click
  // -----------------------------
  if (location.href === 'https://donguri.5ch.net/bag') {
    function saveCurrentEquip(url, index) {
      const currentEquip = safeJSON(localStorage.getItem('current_equip'), []) || [];
      const regex = /https:\/\/donguri\.5ch\.net\/equip\/(\d+)/;
      const m = url.match(regex);
      if (!m) return;
      currentEquip[index] = m[1];
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

  // -----------------------------
  // teambattle main
  // -----------------------------
  const { MODEQ, MODENAME, MODEM } = getModeQ();
  const settings = getSettings();

  const vw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
  const header = qs('header');
  if (header) header.style.marginTop = '100px';

  // -----------------------------
  // Build toolbar
  // -----------------------------
  const toolbar = document.createElement('div');
  toolbar.style.position = 'fixed';
  toolbar.style.top = '0';
  toolbar.style.zIndex = '9999';
  toolbar.style.background = '#fff';
  toolbar.style.border = 'solid 1px #000';
  toolbar.style.padding = '4px';
  toolbar.style.display = 'flex';
  toolbar.style.flexDirection = 'column';
  toolbar.style.gap = '4px';
  toolbar.style.maxWidth = '100vw';

  (() => {
    const position = settings.toolbarPosition || 'left';
    let distance = settings.toolbarPositionLength || '0px';

    const match = String(distance).match(/^(\d+)(px|%|vw)?$/);
    let value = match ? parseFloat(match[1]) : 0;
    let unit = match ? match[2] || 'px' : 'px';

    const maxPx = vw / 3;
    const maxPercent = 33;
    const maxVw = 33;
    if (unit === 'px') value = Math.min(value, maxPx);
    else if (unit === '%') value = Math.min(value, maxPercent);
    else if (unit === 'vw') value = Math.min(value, maxVw);

    distance = `${value}${unit}`;

    if (position === 'left') toolbar.style.left = distance;
    else if (position === 'right') toolbar.style.right = distance;
    else { toolbar.style.left = distance; toolbar.style.right = distance; }
  })();

  // progress bar
  const progressBarInfo = document.createElement('div');
  progressBarInfo.style.fontSize = '12px';
  progressBarInfo.style.whiteSpace = 'nowrap';
  progressBarInfo.style.overflowX = 'auto';

  const progressBar = document.createElement('div');
  progressBar.style.width = '360px';
  progressBar.style.maxWidth = '95vw';
  progressBar.style.height = '18px';
  progressBar.style.background = '#ccc';
  progressBar.style.borderRadius = '8px';
  progressBar.style.overflow = 'hidden';

  const progressBarBody = document.createElement('div');
  progressBarBody.style.height = '100%';
  progressBarBody.style.background = '#428bca';
  progressBarBody.style.color = '#fff';
  progressBarBody.style.textAlign = 'right';
  progressBarBody.style.paddingRight = '6px';
  progressBarBody.style.boxSizing = 'border-box';
  progressBarBody.style.fontSize = '12px';
  progressBarBody.style.lineHeight = '18px';
  progressBar.append(progressBarBody);

  // buttons row
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '4px';
  btnRow.style.flexWrap = 'nowrap';
  btnRow.style.overflowX = 'auto';

  function mkBtn(text) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.style.padding = '4px 6px';
    b.style.border = '1px solid #000';
    b.style.background = '#eee';
    b.style.whiteSpace = 'nowrap';
    b.style.fontSize = '12px';
    return b;
  }

  const btnRefresh = mkBtn('エリア情報更新');
  const btnToggle = mkBtn('表示切替');
  const btnRange = mkBtn('範囲選択');
  btnRange.style.background = '#f64';
  btnRange.style.color = '#fff';
  const btnAutoJoin = mkBtn('自動参戦');
  btnAutoJoin.style.background = '#ffb300';

  btnRow.append(btnRefresh, btnToggle, btnRange, btnAutoJoin);
  toolbar.append(progressBarInfo, progressBar, btnRow);

  if (header) {
    const h4 = header.querySelector('h4');
    if (h4) h4.style.display = 'none';
    header.append(toolbar);
  } else {
    document.body.prepend(toolbar);
  }

  // -----------------------------
  // Auto-join dialog
  // -----------------------------
  const autoJoinDialog = document.createElement('dialog');
  autoJoinDialog.className = 'auto-join';
  autoJoinDialog.style.width = '92vw';
  autoJoinDialog.style.height = '86vh';
  autoJoinDialog.style.background = '#fff';
  autoJoinDialog.style.color = '#000';
  autoJoinDialog.style.border = '1px solid #000';
  autoJoinDialog.style.padding = '6px';

  const ajTitle = document.createElement('div');
  ajTitle.style.display = 'flex';
  ajTitle.style.alignItems = 'center';
  ajTitle.style.justifyContent = 'space-between';

  const ajH = document.createElement('b');
  ajH.textContent = '自動参戦ログ';

  const ajClose = mkBtn('閉じる');
  ajClose.addEventListener('click', () => autoJoinDialog.close());

  ajTitle.append(ajH, ajClose);

  const ajLog = document.createElement('div');
  ajLog.className = 'auto-join-log';
  ajLog.style.border = '1px solid #000';
  ajLog.style.height = '68vh';
  ajLog.style.overflow = 'auto';
  ajLog.style.padding = '4px';
  ajLog.style.fontSize = '12px';
  ajLog.style.textAlign = 'left';

  const ajControls = document.createElement('div');
  ajControls.style.display = 'flex';
  ajControls.style.gap = '6px';
  ajControls.style.marginTop = '6px';

  const ajStart = mkBtn('開始');
  ajStart.style.background = '#4f6';
  const ajStop = mkBtn('停止');
  ajStop.style.background = '#ddd';
  const ajSettings = mkBtn('設定(任意)');
  ajSettings.style.background = '#eee';

  ajControls.append(ajStart, ajStop, ajSettings);
  autoJoinDialog.append(ajTitle, ajLog, ajControls);
  document.body.append(autoJoinDialog);

  function autoJoinLog(msg) {
    const d = document.createElement('div');
    d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    ajLog.prepend(d);
  }

  // Minimal settings prompt (optional)
  ajSettings.addEventListener('click', () => {
    const s = getSettings();
    const teamName = prompt('チーム名（ログ表示用・任意）', s.teamName || '');
    if (teamName !== null) s.teamName = teamName;
    const teamColor = prompt('自チームカラー（例: d32f2f / 1976d2）※任意', s.teamColor || '');
    if (teamColor !== null) s.teamColor = teamColor.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    saveSettings(s);
    autoJoinLog('設定を保存しました（必要ならページ更新）');
  });

  // -----------------------------
  // DOM grid creation (canvas compatible)
  // -----------------------------
  let GRID_SIZE = 0;
  let cellColors = {};
  let capitalList = [];
  let grid; // .grid (our own)
  let currentViewMode = 'detail';
  let cellSelectorActive = false;

  function getTeambattleInlineScriptText(root = document) {
    // Prefer script under .gridCanvasOuter, fallback any script containing "const GRID_SIZE"
    const outer = qs('.gridCanvasOuter', root);
    if (outer) {
      const scr = qs('script', outer);
      if (scr && scr.textContent.includes('const GRID_SIZE')) return scr.textContent;
    }
    const scr2 = qsa('script', root).find(s => s.textContent && s.textContent.includes('const GRID_SIZE'));
    return scr2 ? scr2.textContent : '';
  }

  function ensureDomGridFromCurrentPage() {
    // If already exists, no-op
    if (qs('.grid')) return qs('.grid');

    const scriptText = getTeambattleInlineScriptText(document);
    const payload = extractGridPayloadFromHtml(scriptText);

    GRID_SIZE = payload.GRID_SIZE || 0;
    cellColors = payload.cellColors || {};
    capitalList = payload.capitalList || [];

    if (!GRID_SIZE) {
      // last resort: try from whole HTML
      const payload2 = extractGridPayloadFromHtml(document.documentElement.outerHTML);
      GRID_SIZE = payload2.GRID_SIZE || 0;
      cellColors = payload2.cellColors || {};
      capitalList = payload2.capitalList || [];
    }

    if (!GRID_SIZE) throw new Error('GRID_SIZE not found (page format changed)');

    const outer = qs('.gridCanvasOuter') || document.body;
    const wrap = qs('#gridWrap');
    if (wrap) wrap.style.display = 'none';

    const newGrid = document.createElement('div');
    newGrid.className = 'grid';
    newGrid.style.display = 'grid';
    newGrid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 35px)`;
    newGrid.style.gridTemplateRows = `repeat(${GRID_SIZE}, 35px)`;
    newGrid.style.gap = '2px';
    newGrid.style.justifyContent = 'center';
    newGrid.style.margin = '0 auto';
    newGrid.style.padding = '10px 0';

    const capSet = new Set((capitalList || []).map(([r, c]) => `${r}-${c}`));

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        cell.style.width = '30px';
        cell.style.height = '30px';
        cell.style.border = '1px solid #ccc';
        cell.style.cursor = 'pointer';
        cell.style.overflow = 'hidden';
        cell.style.background = cellColors[`${r}-${c}`] || 'transparent';

        if (capSet.has(`${r}-${c}`)) {
          cell.style.outline = '2px solid #000';
          cell.style.borderColor = 'gold';
        }

        newGrid.append(cell);
      }
    }

    // Insert near the original canvas
    outer.prepend(newGrid);
    return newGrid;
  }

  // -----------------------------
  // Fetch & refresh grid payload from server, then repaint DOM grid
  // -----------------------------
  async function refreshGridColorsFromServer() {
    const html = await fetchTeambattleHtml(MODEQ);
    const payload = extractGridPayloadFromHtml(html);

    if (!payload.GRID_SIZE) throw new Error('GRID_SIZE parse failed');
    GRID_SIZE = payload.GRID_SIZE;
    cellColors = payload.cellColors || {};
    capitalList = payload.capitalList || [];

    // If size changed, rebuild
    if (!grid || qsa('.cell', grid).length !== GRID_SIZE * GRID_SIZE) {
      const old = qs('.grid');
      if (old) old.remove();
      grid = ensureDomGridFromCurrentPage();
    }

    const capSet = new Set((capitalList || []).map(([r, c]) => `${r}-${c}`));
    qsa('.cell', grid).forEach(cell => {
      const r = cell.dataset.row;
      const c = cell.dataset.col;
      const key = `${r}-${c}`;
      cell.style.background = cellColors[key] || 'transparent';
      if (capSet.has(key)) {
        cell.style.outline = '2px solid #000';
        cell.style.borderColor = 'gold';
      } else {
        cell.style.outline = '';
        cell.style.borderColor = cell.classList.contains('selected') ? '#f64' : '#ccc';
      }
    });
  }

  // -----------------------------
  // Cell display mode (detail/compact)
  // (we keep it simple: show rank/leader requires per-cell fetch; here: compact only shows coordinates)
  // -----------------------------
  function setViewMode(mode) {
    currentViewMode = mode;
    if (!grid) return;

    if (mode === 'detail') {
      grid.style.gridTemplateRows = `repeat(${GRID_SIZE}, 65px)`;
      grid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 105px)`;
      qsa('.cell', grid).forEach(cell => {
        cell.style.width = '100px';
        cell.style.height = '60px';
        cell.style.borderWidth = '3px';
        // Keep existing children (if any) - optional
      });
    } else {
      grid.style.gridTemplateRows = `repeat(${GRID_SIZE}, 35px)`;
      grid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 35px)`;
      qsa('.cell', grid).forEach(cell => {
        cell.style.width = '30px';
        cell.style.height = '30px';
        cell.style.borderWidth = '1px';
        // remove children
        while (cell.firstChild) cell.firstChild.remove();
      });
    }
  }

  function toggleViewMode() {
    setViewMode(currentViewMode === 'detail' ? 'compact' : 'detail');
  }

  // -----------------------------
  // Click behavior
  // - range select: select cells
  // - normal: navigate to r/c
  // -----------------------------
  function attachCellHandlers() {
    if (!grid) return;
    qsa('.cell', grid).forEach(cell => {
      cell.addEventListener('click', () => {
        const r = cell.dataset.row;
        const c = cell.dataset.col;

        if (cellSelectorActive) {
          if (cell.classList.contains('selected')) {
            cell.classList.remove('selected');
            cell.style.borderColor = '#ccc';
          } else {
            cell.classList.add('selected');
            cell.style.borderColor = '#f64';
          }
          return;
        }

        // normal navigation
        location.href = `https://donguri.5ch.net/teambattle?r=${r}&c=${c}&${MODEQ}`;
      });
    });
  }

  // -----------------------------
  // Progress bar (kept from your logic, but safer)
  // -----------------------------
  let currentPeriod = 0;
  let currentProgress = 0;
  let wood = 0;
  let steel = 0;

  async function drawProgressBar() {
    try {
      const res = await fetch('https://donguri.5ch.net/', { credentials: 'include' });
      if (!res.ok) throw new Error(res.status);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      // This selector may change; keep tolerant
      const statBlock = doc.querySelector('.stat-block');
      if (statBlock) {
        const w = statBlock.textContent.match(/木材の数:\s*(\d+)/);
        const s = statBlock.textContent.match(/鉄の数:\s*(\d+)/);
        if (w) wood = Number(w[1]);
        if (s) steel = Number(s[1]);
      }

      // period/progress: match "第 15787 期" and "xx%"
      const head = doc.body.textContent;
      const p = head.match(/第\s*(\d+)\s*期/);
      if (p) currentPeriod = Number(p[1]);

      const pr = head.match(/(\d+)%/);
      if (pr) currentProgress = Number(pr[1]);

      // estimate
      let str = '';
      if (currentProgress === 0 || currentProgress === 50) {
        str = '（マップ更新時）';
      } else {
        let totalSec, min, sec, margin;
        if (currentProgress === 100) {
          min = 0; sec = 20; margin = 10;
        } else {
          totalSec = (currentProgress < 50)
            ? (50 - currentProgress) * 36
            : (100 - currentProgress) * 36 + 10;
          min = Math.trunc(totalSec / 60);
          sec = totalSec % 60;
          margin = 20;
        }
        str = `（マップ更新まで${min}分${sec}秒 ±${margin}秒）`;
      }

      progressBarBody.textContent = `${currentProgress}%`;
      progressBarBody.style.width = `${Math.max(0, Math.min(100, currentProgress))}%`;
      progressBarInfo.textContent = `${MODENAME} 第 ${currentPeriod} 期 ${str}  木:${wood} 鉄:${steel}`;
    } catch (e) {
      console.error('drawProgressBar()', e);
    }
  }

  // -----------------------------
  // Auto Join core
  // -----------------------------
  let autoJoinIntervalId = null;
  let isAutoJoinRunning = false;
  let backoffUntil = 0;

  function stopAutoJoin() {
    if (autoJoinIntervalId) clearInterval(autoJoinIntervalId);
    autoJoinIntervalId = null;
    isAutoJoinRunning = false;
    autoJoinLog('停止しました');
  }

  function isRetryLine(line) {
    return (
      line === 'あなたのチームは動きを使い果たしました。しばらくお待ちください。' ||
      line === 'ng<>too fast' ||
      line === 'ng: ちょっとゆっくり'
    );
  }
  function isHardStopLine(line) {
    return (
      line === '最初にチームに参加する必要があります。' ||
      line === '武器と防具を装備しなければなりません。' ||
      line === 'どんぐりが見つかりませんでした。'
    );
  }

  async function tryChallenge(row, col) {
    const res = await fetch('/teamchallenge?' + MODEQ, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `row=${row}&col=${col}`,
      credentials: 'include'
    });
    const text = await res.text();
    const lastLine = (text.trim().split('\n').pop() || '').trim();
    return { ok: res.ok, text, lastLine };
  }

  async function getRegionsFromLatestMap() {
    // Fetch the teambattle HTML and compute candidate cells from capitals / edges.
    // This is stable even when the current page is r/c detail view.
    const html = await fetchTeambattleHtml(MODEQ);
    const payload = extractGridPayloadFromHtml(html);

    const size = payload.GRID_SIZE;
    const caps = payload.capitalList || [];
    const colors = payload.cellColors || {};

    // Target colors (for rb, typical is red & blue)
    const AUTOJOIN_TEAM_COLORS = ['d32f2f', '1976d2'];

    // Find all cells that are those colors (capitals/territory)
    const targetColorSet = new Set();
    for (const [k, v] of Object.entries(colors)) {
      const c = String(v).replace('#', '').toLowerCase();
      if (AUTOJOIN_TEAM_COLORS.includes(c)) targetColorSet.add(k);
    }

    // Build all coords
    const cells = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) cells.push([r, c]);

    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];

    const capSet = new Set((caps || []).map(([r,c]) => `${r}-${c}`));

    // Adjacent to target colors
    const targetAdjSet = new Set();
    for (const key of targetColorSet) {
      const [r, c] = key.split('-').map(Number);
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) targetAdjSet.add(`${nr}-${nc}`);
      }
    }

    // Non-adjacent to any capital (initial claim region idea)
    const adjToCapital = new Set();
    for (const [cr, cc] of (caps || [])) {
      for (const [dr, dc] of dirs) {
        const nr = cr + dr, nc = cc + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) adjToCapital.add(`${nr}-${nc}`);
      }
    }

    const nonAdjacent = cells.filter(([r,c]) => {
      const key = `${r}-${c}`;
      return !capSet.has(key) && !adjToCapital.has(key);
    });

    // Edge cells
    const edgeSet = new Set();
    for (let i = 0; i < size; i++) {
      edgeSet.add(`${i}-0`);
      edgeSet.add(`${i}-${size-1}`);
      edgeSet.add(`0-${i}`);
      edgeSet.add(`${size-1}-${i}`);
    }
    const mapEdge = cells.filter(([r,c]) => {
      const key = `${r}-${c}`;
      return edgeSet.has(key) && !capSet.has(key);
    });

    // helper shuffle
    function shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    return {
      targetAdjacent: shuffle(cells.filter(([r,c]) => targetAdjSet.has(`${r}-${c}`))),
      nonAdjacent: shuffle(nonAdjacent),
      mapEdge: shuffle(mapEdge),
      GRID_SIZE: size
    };
  }

  async function autoJoinTick() {
    if (!isAutoJoinRunning) return;

    // backoff for too fast / exhausted moves
    if (Date.now() < backoffUntil) return;

    try {
      await drawProgressBar();

      const regions = await getRegionsFromLatestMap();
      const pools = [
        { name: 'targetAdjacent', list: regions.targetAdjacent || [] },
        { name: 'nonAdjacent', list: regions.nonAdjacent || [] },
        { name: 'mapEdge', list: regions.mapEdge || [] },
      ];

      const pool = pools.find(p => p.list.length > 0);
      if (!pool) {
        autoJoinLog('候補セルなし。待機…');
        return;
      }

      const [r, c] = pool.list[0];
      autoJoinLog(`${pool.name} -> (${r},${c}) に挑戦`);

      const { lastLine } = await tryChallenge(r, c);
      autoJoinLog(`結果: ${lastLine}`);

      if (isHardStopLine(lastLine)) {
        autoJoinLog(`停止: ${lastLine}`);
        stopAutoJoin();
        return;
      }

      if (isRetryLine(lastLine)) {
        // Wait longer to avoid spam
        const waitMs = lastLine.includes('動きを使い果たしました') ? 12000 : 8000;
        backoffUntil = Date.now() + waitMs;
        autoJoinLog(`待機 ${Math.round(waitMs/1000)}s`);
        return;
      }

      // Success-ish: small delay to avoid too fast
      backoffUntil = Date.now() + 2500;
      // optional: refresh colors occasionally
      // (do nothing; next ticks will naturally get updated candidates)
    } catch (e) {
      autoJoinLog('エラー: ' + (e?.message || String(e)));
      backoffUntil = Date.now() + 8000;
    }
  }

  function startAutoJoin() {
    if (isAutoJoinRunning) return;
    isAutoJoinRunning = true;
    backoffUntil = 0;
    autoJoinLog('開始しました');
    autoJoinTick();
    // Tick every 6.5s (safe)
    autoJoinIntervalId = setInterval(autoJoinTick, 6500);
  }

  // Buttons
  btnAutoJoin.addEventListener('click', () => {
    autoJoinDialog.showModal();
  });
  ajStart.addEventListener('click', startAutoJoin);
  ajStop.addEventListener('click', stopAutoJoin);

  // If dialog closes, stop auto join
  autoJoinDialog.addEventListener('close', stopAutoJoin);

  // -----------------------------
  // Range select helpers
  // -----------------------------
  const rangeMenu = document.createElement('div');
  rangeMenu.style.display = 'none';
  rangeMenu.style.gap = '4px';
  rangeMenu.style.marginTop = '4px';
  rangeMenu.style.flexWrap = 'nowrap';
  rangeMenu.style.overflowX = 'auto';

  const btnRangeDone = mkBtn('範囲選択終了');
  btnRangeDone.style.background = '#888';
  btnRangeDone.style.color = '#fff';

  const btnClearSel = mkBtn('選択解除');
  btnClearSel.style.background = '#888';
  btnClearSel.style.color = '#fff';

  const btnRangeAttack = mkBtn('選択セル参戦');
  btnRangeAttack.style.background = '#f64';
  btnRangeAttack.style.color = '#fff';

  rangeMenu.append(btnRangeDone, btnClearSel, btnRangeAttack);
  toolbar.append(rangeMenu);

  btnRange.addEventListener('click', () => {
    cellSelectorActive = true;
    rangeMenu.style.display = 'flex';
  });
  btnRangeDone.addEventListener('click', () => {
    cellSelectorActive = false;
    rangeMenu.style.display = 'none';
  });
  btnClearSel.addEventListener('click', () => {
    if (!grid) return;
    qsa('.cell.selected', grid).forEach(c => {
      c.classList.remove('selected');
      c.style.borderColor = '#ccc';
    });
  });

  let rangeAttackRunning = false;
  btnRangeAttack.addEventListener('click', async () => {
    if (rangeAttackRunning) return;
    if (!grid) return;
    const selected = qsa('.cell.selected', grid);
    if (!selected.length) { alert('セルを選択してください'); return; }

    rangeAttackRunning = true;
    try {
      for (const cell of selected) {
        const r = cell.dataset.row, c = cell.dataset.col;
        cell.style.borderColor = '#4f6';
        const { lastLine } = await tryChallenge(r, c);
        autoJoinLog(`[範囲] (${r},${c}) ${lastLine}`);

        if (isHardStopLine(lastLine)) {
          alert(`停止: ${lastLine}`);
          break;
        }
        if (isRetryLine(lastLine)) {
          await sleep(9000);
        } else {
          await sleep(1800);
        }
        cell.style.borderColor = cell.classList.contains('selected') ? '#f64' : '#ccc';
      }
    } finally {
      rangeAttackRunning = false;
    }
  });

  // -----------------------------
  // Init grid & handlers
  // -----------------------------
  try {
    grid = ensureDomGridFromCurrentPage();
    attachCellHandlers();
    setViewMode('compact'); // default safe (detail needs per-cell fetch; we keep compact stable)
  } catch (e) {
    console.error(e);
    alert('arena assist tool: グリッド生成に失敗しました（ページ仕様変更の可能性）');
  }

  // -----------------------------
  // Refresh / Toggle
  // -----------------------------
  btnRefresh.addEventListener('click', async () => {
    btnRefresh.disabled = true;
    try {
      await refreshGridColorsFromServer();
      attachCellHandlers(); // in case rebuilt
    } catch (e) {
      console.error(e);
      alert(String(e?.message || e));
    } finally {
      btnRefresh.disabled = false;
    }
  });

  btnToggle.addEventListener('click', () => toggleViewMode());

  // draw progress bar periodically
  drawProgressBar();
  setInterval(drawProgressBar, 18000);

})();
