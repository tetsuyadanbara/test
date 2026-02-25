// ==UserScript==
// @name         donguri arena assist tool (canvas対応 修正版)
// @version      1.2.2d.パクリ9.4改 レッドブルー + canvasfix-full
// @description  canvas版teambattleに対応（旧 .grid/.cell 互換生成）+ 既存機能（自動装備/範囲攻撃/自動参加/ログ/進捗バー）を維持
// @author       ぱふぱふ + patch by ChatGPT
// @match        https://donguri.5ch.net/teambattle?m=hc
// @match        https://donguri.5ch.net/teambattle?m=l
// @match        https://donguri.5ch.net/teambattle?m=rb
// @match        https://donguri.5ch.net/bag
// @run-at       document-idle
// ==/UserScript==

(()=>{

  // ---------------------------
  // bag: current_equip 保存
  // ---------------------------
  if(location.href === 'https://donguri.5ch.net/bag') {
    function saveCurrentEquip(url, index) {
      let currentEquip = JSON.parse(localStorage.getItem('current_equip')) || [];
      const regex = /https:\/\/donguri\.5ch\.net\/equip\/(\d+)/;
      const m = url.match(regex);
      if(!m) return;
      const equipId = m[1];
      currentEquip[index] = equipId;
      localStorage.setItem('current_equip', JSON.stringify(currentEquip));
    }
    const tableIds = ['weaponTable', 'armorTable', 'necklaceTable'];
    tableIds.forEach((elm, index)=>{
      const equipLinks = document.querySelectorAll(`#${elm} a[href^="https://donguri.5ch.net/equip/"]`);
      [...equipLinks].forEach(link => {
        link.addEventListener('click', ()=>{
          saveCurrentEquip(link.href, index);
        });
      });
    });
    return;
  }

  // ---------------------------
  // mode
  // ---------------------------
  const MODEQ = location.search.slice(1);

  let MODENAME;
  if (MODEQ === 'm=l') MODENAME = '[ﾗﾀﾞｰ]';
  else if (MODEQ === 'm=rb') MODENAME = '[ﾚﾄﾞﾌﾞﾙ]';
  else MODENAME = '[ﾊｰﾄﾞｺｱ]';

  let MODEM;
  if (MODEQ === 'm=l') MODEM = 'l';
  else if (MODEQ === 'm=rb') MODEM = 'rb';
  else MODEM = 'hc';

  const vw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
  const settings = JSON.parse(localStorage.getItem('aat_settings')) || {};

  // ============================================================
  // [PATCH] canvas版 teambattle → 旧 .grid/.cell 互換レイヤ
  // ============================================================
  function getBattleScriptTextFromDoc(doc) {
    const scripts = [...doc.querySelectorAll('script')];
    const s = scripts.find(sc => {
      const t = sc.textContent || '';
      return t.includes('const GRID_SIZE') && t.includes('const cellColors');
    });
    return s?.textContent || '';
  }

  function parseConstObject(scriptText, constName) {
    const re = new RegExp(`const\\s+${constName}\\s*=\\s*({[\\s\\S]*?})\\s*;`);
    const m = scriptText.match(re);
    if (!m) return null;
    try { return Function('"use strict";return (' + m[1] + ')')(); } catch { return null; }
  }

  function parseConstArray(scriptText, constName) {
    const re = new RegExp(`const\\s+${constName}\\s*=\\s*(\\[[\\s\\S]*?\\])\\s*;`);
    const m = scriptText.match(re);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch { return null; }
  }

  function parseGridSize(scriptText) {
    const m = scriptText.match(/const\s+GRID_SIZE\s*=\s*(\d+)\s*;/);
    return m ? Number(m[1]) : 13;
  }

  function ensureLegacyGrid() {
    let grid = document.querySelector('.grid');
    if (grid) return grid;

    const canvasWrap = document.getElementById('gridWrap');
    if (!canvasWrap) return null;

    const scriptText = getBattleScriptTextFromDoc(document);
    const GRID_SIZE = parseGridSize(scriptText);

    const cellColors = parseConstObject(scriptText, 'cellColors') || {};
    const capitalList = parseConstArray(scriptText, 'capitalList') || [];

    grid = document.createElement('div');
    grid.className = 'grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateRows = `repeat(${GRID_SIZE}, 35px)`;
    grid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 35px)`;
    grid.style.gap = '0';
    grid.style.margin = '12px auto';
    grid.style.width = 'fit-content';
    grid.style.maxWidth = '100%';

    const capitalSet = new Set((capitalList || []).map(([r,c]) => `${r}-${c}`));
    const frag = document.createDocumentFragment();

    for (let r=0; r<GRID_SIZE; r++) {
      for (let c=0; c<GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.style.width = '30px';
        cell.style.height = '30px';
        cell.style.border = '1px solid #ccc';
        cell.style.cursor = 'pointer';
        cell.style.overflow = 'hidden';

        const key = `${r}-${c}`;
        const color = cellColors[key];
        cell.style.backgroundColor = color ? color : '#f0f0f0';

        if (capitalSet.has(key)) {
          cell.style.outline = 'black solid 2px';
          cell.style.borderColor = 'gold';
        }
        frag.appendChild(cell);
      }
    }
    grid.appendChild(frag);

    const outer = document.querySelector('.gridCanvasOuter') || canvasWrap.parentElement;
    outer?.insertAdjacentElement('afterend', grid);
    return grid;
  }

  // teambattle読み込み直後に旧DOMを復活
  const grid = ensureLegacyGrid();

  // ============================================================
  // UI（ツールバー/ログ/アリーナ情報/設定/装備）
  // ============================================================
  const header = document.querySelector('header');
  if(header) header.style.marginTop = '100px';

  const toolbar = document.createElement('div');
  toolbar.style.position = 'fixed';
  toolbar.style.top = '0';
  toolbar.style.zIndex = '9999';
  toolbar.style.background = '#fff';
  toolbar.style.border = 'solid 1px #000';

  // settings.toolbarPosition
  (()=>{
    const position = settings.toolbarPosition || 'left';
    let distance = settings.toolbarPositionLength || '0px';

    const match = String(distance).match(/^(\d+)(px|%|vw)?$/);
    let value = match ? parseFloat(match[1]) : 0;
    let unit = match ? (match[2] || 'px') : 'px';

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

  // h4が存在しない場合があるので安全化
  if (header) {
    const __h4 = header.querySelector('h4');
    if (__h4) __h4.style.display = 'none';
    header.append(toolbar);
  } else {
    document.body.append(toolbar);
  }

  // progress bar
  const progressBarContainer = document.createElement('div');
  const progressBar = document.createElement('div');
  const progressBarBody = document.createElement('div');
  const progressBarInfo = document.createElement('p');

  progressBar.classList.add('progress-bar');
  progressBar.style.display = 'inline-block';
  progressBar.style.width = '400px';
  progressBar.style.maxWidth = '100vw';
  progressBar.style.height = '20px';
  progressBar.style.background = '#ccc';
  progressBar.style.borderRadius = '8px';
  progressBar.style.fontSize = '16px';
  progressBar.style.overflow = 'hidden';
  progressBar.style.marginTop = '5px';

  progressBarBody.style.height = '100%';
  progressBarBody.style.lineHeight = 'normal';
  progressBarBody.style.background = '#428bca';
  progressBarBody.style.textAlign = 'right';
  progressBarBody.style.paddingRight = '5px';
  progressBarBody.style.boxSizing = 'border-box';
  progressBarBody.style.color = 'white';

  progressBarInfo.style.marginTop = '0';
  progressBarInfo.style.marginBottom = '0';
  progressBarInfo.style.overflow = 'auto';
  progressBarInfo.style.whiteSpace = 'nowrap';

  progressBar.append(progressBarBody);
  progressBarContainer.append(progressBarInfo, progressBar);
  toolbar.append(progressBarContainer);

  // buttons
  let shouldSkipAreaInfo = !!settings.skipArenaInfo;
  let shouldSkipAutoEquip = !!settings.skipAutoEquip;
  let cellSelectorActivate = false;
  let rangeAttackProcessing = false;
  let currentPeriod = 0, currentProgress = 0;
  let wood = 0, steel = 0;
  let currentEquipName = '';
  let currentViewMode = 'detail';
  let rangeAttackQueue = [];

  const btnTmpl = document.createElement('button');
  btnTmpl.type = 'button';
  btnTmpl.style.flexShrink = '1';
  btnTmpl.style.flexGrow = '0';
  btnTmpl.style.whiteSpace = 'nowrap';
  btnTmpl.style.overflow = 'hidden';
  btnTmpl.style.boxSizing = 'border-box';
  btnTmpl.style.padding = '2px';
  btnTmpl.style.width = '6em';
  btnTmpl.style.fontSize = '65%';
  btnTmpl.style.border = 'none';

  if (vw < 768) progressBarContainer.style.fontSize = '60%';

  const mainButtons = document.createElement('div');
  mainButtons.style.display = 'flex';
  mainButtons.style.flexWrap = 'nowrap';
  mainButtons.style.gap = '2px';
  mainButtons.style.justifyContent = 'center';

  const subMenu = document.createElement('div');
  subMenu.style.display = 'none';
  subMenu.style.flexWrap = 'nowrap';
  subMenu.style.overflowX = 'hidden';
  subMenu.style.position = 'relative';

  const menuButton = btnTmpl.cloneNode();
  menuButton.textContent = '▼メニュー';
  menuButton.addEventListener('click', ()=>{
    subMenu.style.display = (subMenu.style.display === 'flex') ? 'none' : 'flex';
  });

  const skipAreaInfoButton = btnTmpl.cloneNode();
  skipAreaInfoButton.innerText = 'セル情報\nスキップ';
  skipAreaInfoButton.style.color = '#fff';
  skipAreaInfoButton.style.background = shouldSkipAreaInfo ? '#46f' : '#888';
  skipAreaInfoButton.addEventListener('click', ()=>{
    shouldSkipAreaInfo = !shouldSkipAreaInfo;
    skipAreaInfoButton.style.background = shouldSkipAreaInfo ? '#46f' : '#888';
    settings.skipArenaInfo = shouldSkipAreaInfo;
    localStorage.setItem('aat_settings', JSON.stringify(settings));
  });

  const equipButton = btnTmpl.cloneNode();
  equipButton.textContent = '■装備';
  equipButton.addEventListener('click', ()=>{ panel.style.display = 'flex'; });

  const toggleViewButton = btnTmpl.cloneNode();
  toggleViewButton.innerText = '表示\n切り替え';
  toggleViewButton.addEventListener('click', ()=>{ toggleCellViewMode(); });

  const refreshButton = btnTmpl.cloneNode();
  refreshButton.innerText = 'エリア情報\n更新';
  refreshButton.addEventListener('click', ()=>{ fetchAreaInfo(false); });

  mainButtons.append(menuButton, skipAreaInfoButton, equipButton, toggleViewButton, refreshButton);
  toolbar.append(mainButtons, subMenu);

  // ---------------------------
  // dialogs: arenaField / arenaResult / help
  // ---------------------------
  const arenaField = document.createElement('dialog');
  arenaField.style.position = 'fixed';
  arenaField.style.background = '#fff';
  arenaField.style.color = '#000';
  arenaField.style.border = 'solid 1px #000';
  if(vw < 768) arenaField.style.fontSize = '85%';

  arenaField.style.bottom = settings.arenaFieldBottom ? settings.arenaFieldBottom : '4vh';
  if (settings.arenaFieldPosition === 'left') {
    arenaField.style.right = 'auto';
    arenaField.style.left = settings.arenaFieldPositionLength || '0';
  } else if (settings.arenaFieldPosition === 'right') {
    arenaField.style.left = 'auto';
    arenaField.style.right = settings.arenaFieldPositionLength || '0';
  }
  arenaField.style.maxWidth = '100vw';
  arenaField.style.width = settings.arenaFieldWidth || '480px';

  const arenaModDialog = document.createElement('dialog');

  const arenaResult = document.createElement('dialog');
  arenaResult.style.position = 'fixed';
  arenaResult.style.bottom = settings.arenaResultBottom ? settings.arenaResultBottom : '4vh';
  arenaResult.style.left = 'auto';
  arenaResult.style.background = '#fff';
  arenaResult.style.color = '#000';
  arenaResult.style.fontSize = '70%';
  arenaResult.style.border = 'solid 1px #000';
  arenaResult.style.margin = '0';
  arenaResult.style.textAlign = 'left';
  arenaResult.style.overflowY = 'auto';
  arenaResult.style.zIndex = '1';
  arenaResult.style.height = settings.arenaResultHeight || '60vh';
  arenaResult.style.maxHeight = '100vh';
  arenaResult.style.width = settings.arenaResultWidth || '60%';
  arenaResult.style.maxWidth = '480px';
  if (settings.arenaResultPosition === 'left') arenaResult.style.left = settings.arenaResultPositionLength || '0';

  const helpDialog = document.createElement('dialog');
  helpDialog.style.background = '#fff';
  helpDialog.style.color = '#000';
  helpDialog.style.fontSize = '80%';
  helpDialog.style.textAlign = 'left';
  helpDialog.style.maxHeight = '60vh';
  helpDialog.style.width = '80vw';
  helpDialog.style.overflow = 'auto';
  helpDialog.style.position = 'fixed';
  helpDialog.style.bottom = '8vh';
  helpDialog.style.left = 'auto';

  window.addEventListener('mousedown', (event) => {
    if (!arenaResult.contains(event.target) && !rangeAttackProcessing) arenaResult.close();
    if (!arenaModDialog.contains(event.target)) arenaModDialog.close();
    if (!panel.contains(event.target)) panel.style.display = 'none';
    if (!helpDialog.contains(event.target)) helpDialog.close();
  });

  document.body.append(arenaResult, arenaField, helpDialog);

  // ---------------------------
  // grid 表示調整
  // ---------------------------
  if (grid) {
    grid.parentNode.style.height = null;
    grid.style.maxWidth = '100%';
  }

  // ============================================================
  // 装備パネル（元のlocalStorage形式を維持：equipPresets/current_equip/autoEquipItems）
  // ※超巨大な「装備一覧UI」は省略せず、動作に必須な部分を含めた“実用版”です
  // ============================================================
  const panel = document.createElement('div');
  panel.style.position = 'fixed';
  panel.style.top = '0';
  panel.style.background = '#f0f0f0';
  panel.style.border = 'solid 1px #000';
  panel.style.padding = '2px';
  panel.style.zIndex = '9999';
  panel.style.textAlign = 'left';
  panel.style.display = 'none';
  panel.style.flexDirection = 'column';

  if (settings.equipPanelPosition === 'left') panel.style.left = '0';
  else panel.style.right = '0';
  panel.style.width = settings.equipPanelWidth || '400px';
  panel.style.maxWidth = '75vw';
  panel.style.height = settings.equipPanelHeight || '96vh';
  panel.style.maxHeight = '100vh';

  const equipTop = document.createElement('div');
  equipTop.style.marginTop = '2px';
  equipTop.style.lineHeight = 'normal';

  const equipButtons = document.createElement('div');
  equipButtons.style.display = 'flex';
  equipButtons.style.flexWrap = 'nowrap';
  equipButtons.style.overflowX = 'auto';

  const equipStat = document.createElement('p');
  equipStat.style.margin = '0';
  equipStat.style.height = '24px';
  equipStat.style.fontSize = '16px';
  equipStat.style.whiteSpace = 'nowrap';
  equipStat.style.overflow = 'hidden';
  equipStat.classList.add('equip-preset-stat');

  const presetList = document.createElement('ul');
  presetList.style.listStyle = 'none';
  presetList.style.margin = '0';
  presetList.style.padding = '0';
  presetList.style.borderTop = 'solid 1px #000';
  presetList.style.height = '100%';
  presetList.style.overflowY = 'auto';
  presetList.style.flexGrow = '1';

  const resetCurrentEquip = document.createElement('div');
  resetCurrentEquip.textContent = '装備情報をリセット';
  resetCurrentEquip.style.borderTop = 'solid 1px #000';
  resetCurrentEquip.style.cursor = 'pointer';
  resetCurrentEquip.style.color = '#a62';
  resetCurrentEquip.style.whiteSpace = 'nowrap';
  resetCurrentEquip.style.overflow = 'hidden';
  resetCurrentEquip.addEventListener('click', ()=>{
    localStorage.removeItem('current_equip');
    equipStat.textContent = '現在の装備情報を初期化';
  });

  function showEquipPreset(){
    const equipPresets = JSON.parse(localStorage.getItem('equipPresets')) || {};
    const liTemplate = document.createElement('li');
    liTemplate.style.display = 'flex';
    liTemplate.style.justifyContent = 'space-between';
    liTemplate.style.borderBottom = 'solid 1px #000';
    liTemplate.style.color = '#428bca';
    liTemplate.style.cursor = 'pointer';

    const span1 = document.createElement('span');
    span1.style.flexGrow = '1';
    span1.style.whiteSpace = 'nowrap';
    span1.style.overflow = 'hidden';

    const span2 = document.createElement('span');
    span2.style.whiteSpace = 'nowrap';
    span2.style.textAlign = 'right';
    span2.style.overflow = 'hidden';
    span2.style.fontSize = '90%';

    liTemplate.append(span1, span2);

    const frag = document.createDocumentFragment();
    for (const [name, value] of Object.entries(equipPresets)) {
      const li = liTemplate.cloneNode(true);
      const spans = li.querySelectorAll('span');
      spans[0].textContent = name;
      spans[1].textContent = (value?.rank || []).join(',');
      frag.appendChild(li);
    }
    presetList.replaceChildren(frag);
  }

  async function setPresetItems(presetName){
    let currentEquip = JSON.parse(localStorage.getItem('current_equip')) || [];
    if (equipStat.textContent === '装備中...') return;

    const equipPresets = JSON.parse(localStorage.getItem('equipPresets')) || {};
    const preset = equipPresets[presetName];
    if(!preset || !Array.isArray(preset.id)) {
      equipStat.textContent = 'プリセットが見つかりません';
      return;
    }

    const fetchPromises = preset.id
      .filter(id => id !== undefined && id !== null && !currentEquip.includes(id))
      .map(id => fetch('https://donguri.5ch.net/equip/' + id));

    equipStat.textContent = '装備中...';
    try {
      const responses = await Promise.all(fetchPromises);
      const texts = await Promise.all(responses.map(async r=>{
        if(!r.ok) throw new Error(`[${r.status}] /equip/`);
        return r.text();
      }));

      if(texts.includes('どんぐりが見つかりませんでした。')) throw new Error('再ログインしてください');
      if(texts.includes('アイテムが見つかりませんでした。')) throw new Error('アイテムが見つかりませんでした');

      const docs = texts.map(t => new DOMParser().parseFromString(t,'text/html'));
      const titles = docs.map(d => d.querySelector('h1')?.textContent);
      if(titles.includes('どんぐり基地')) throw new Error('再ログインしてください');
      if(!titles.every(t => t === 'アイテムバッグ')) throw new Error('装備エラー');

      equipStat.textContent = '完了: ' + presetName;
      localStorage.setItem('current_equip', JSON.stringify(preset.id));
      currentEquipName = presetName;
    } catch(e){
      equipStat.textContent = e;
      localStorage.removeItem('current_equip');
      throw e;
    }
  }

  presetList.addEventListener('click', async(e)=>{
    const li = e.target.closest('li');
    if(!li) return;
    const name = li.querySelector('span')?.textContent;
    if(!name) return;
    try{
      await setPresetItems(name);
      // 自動装備OFF（元スクリプト互換）
      shouldSkipAutoEquip = true;
      settings.skipAutoEquip = true;
      localStorage.setItem('aat_settings', JSON.stringify(settings));
    }catch(_){}
  });

  const btnSkipAutoEquip = btnTmpl.cloneNode();
  btnSkipAutoEquip.textContent = '自動装備';
  btnSkipAutoEquip.style.color = '#fff';
  btnSkipAutoEquip.style.background = shouldSkipAutoEquip ? '#888' : '#46f';
  btnSkipAutoEquip.addEventListener('click', ()=>{
    shouldSkipAutoEquip = !shouldSkipAutoEquip;
    btnSkipAutoEquip.style.background = shouldSkipAutoEquip ? '#888' : '#46f';
    settings.skipAutoEquip = shouldSkipAutoEquip;
    localStorage.setItem('aat_settings', JSON.stringify(settings));
  });

  const btnClosePanel = btnTmpl.cloneNode();
  btnClosePanel.textContent = '閉じる';
  btnClosePanel.style.background = '#caa';
  btnClosePanel.addEventListener('click', ()=>{ panel.style.display = 'none'; });

  equipButtons.append(btnSkipAutoEquip, btnClosePanel);
  equipTop.append(equipButtons, equipStat);
  panel.append(equipTop, resetCurrentEquip, presetList);
  document.body.append(panel);
  showEquipPreset();

  // ============================================================
  // refreshArenaInfo（canvas対応版：丸ごと置換）
  // ============================================================
  async function refreshArenaInfo() {
    const refreshedCells = [];

    function includesCoord(arr, row, col) {
      const coordSet = new Set(arr.map(([r, c]) => `${r}-${c}`));
      return coordSet.has(`${row}-${col}`);
    }

    try {
      const res = await fetch('');
      if (!res.ok) throw new Error('res.ng');

      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      const headerText = doc.querySelector('header')?.textContent || '';
      if (!headerText.includes('どんぐりチーム戦い')) throw new Error('title.ng info');

      const scriptContent = getBattleScriptTextFromDoc(doc);

      let cellColors = parseConstObject(scriptContent, 'cellColors') || {};
      let capitalMap = parseConstArray(scriptContent, 'capitalList') || [];

      const rows = parseGridSize(scriptContent);
      const cols = rows;

      const grid = ensureLegacyGrid();
      if (!grid) throw new Error('grid.ng');

      const currentCells = grid.querySelectorAll('.cell');

      if (currentCells.length !== rows * cols) {
        grid.style.gridTemplateRows = `repeat(${rows}, 35px)`;
        grid.style.gridTemplateColumns = `repeat(${cols}, 35px)`;
        grid.innerHTML = '';

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = i;
            cell.dataset.col = j;
            cell.style.width = '30px';
            cell.style.height = '30px';
            cell.style.border = '1px solid #ccc';
            cell.style.cursor = 'pointer';
            cell.style.transition = 'background-color 0.3s';

            if (includesCoord(capitalMap, i, j)) {
              cell.style.outline = 'black solid 2px';
              cell.style.borderColor = 'gold';
            }

            const cellKey = `${i}-${j}`;
            cell.style.backgroundColor = cellColors[cellKey] || '#f0f0f0';
            fragment.appendChild(cell);
            refreshedCells.push(cell);
          }
        }
        grid.appendChild(fragment);
      } else {
        currentCells.forEach(cell => {
          const row = Number(cell.dataset.row);
          const col = Number(cell.dataset.col);
          const cellKey = `${row}-${col}`;
          cell.style.backgroundColor = cellColors[cellKey] || '#f0f0f0';

          if (includesCoord(capitalMap, row, col)) {
            cell.style.outline = 'black solid 2px';
            cell.style.borderColor = 'gold';
          } else {
            cell.style.outline = '';
            cell.style.borderColor = '#ccc';
          }
        });
      }

      // 下部のテーブル更新（存在する分だけ）
      const tables = document.querySelectorAll('table');
      const newTables = doc.querySelectorAll('table');
      newTables.forEach((table, i) => {
        if (tables[i]) tables[i].replaceWith(table);
      });

      addCustomColor();
      attachCellHandlers(); // クリック復活

      return refreshedCells;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  // ============================================================
  // fetchAreaInfo / fetchSingleArenaInfo
  // ============================================================
  async function fetchAreaInfo(refreshAll){
    await refreshArenaInfo();

    const grid = ensureLegacyGrid();
    if(!grid) return;

    if (currentViewMode === 'detail') {
      grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace('35px','65px');
      grid.style.gridTemplateColumns = grid.style.gridTemplateColumns.replace('35px','105px');
    }

    grid.parentNode.style.height = null;
    grid.parentNode.style.padding = '20px 0';

    const cells = [...grid.querySelectorAll('.cell')];

    // 過負荷防止：並列数制限
    const CONC = 6;
    let idx = 0;
    const workers = Array.from({length: CONC}, async()=>{
      while(idx < cells.length){
        const i = idx++;
        await fetchSingleArenaInfo(cells[i]);
      }
    });
    await Promise.all(workers);
  }

  async function fetchSingleArenaInfo(elm) {
    try {
      const row = Number(elm.dataset.row);
      const col = Number(elm.dataset.col);
      const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&`+MODEQ;
      const res = await fetch(url);
      if(!res.ok) throw new Error(res.status + ' res.ng');
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      const headerText = doc.querySelector('header')?.textContent || '';
      if(!headerText.includes('どんぐりチーム戦い')) throw new Error(`title.ng [${row}][${col}]`);

      const rank = doc.querySelector('small')?.textContent || '';
      if(!rank) return;

      const leader = doc.querySelector('strong')?.textContent || '';
      const shortenRank = rank
        .replace('[エリート]','e')
        .replace('[警備員]だけ','警')
        .replace('から','-')
        .replace(/(まで|\[|\]|\||\s)/g,'');

      const teamname = doc.querySelector('table')?.rows?.[1]?.cells?.[2]?.textContent || '';

      const cell = elm.cloneNode(false);

      if (currentViewMode === 'detail') {
        const p0 = document.createElement('p');
        const p1 = document.createElement('p');
        p0.textContent = shortenRank;
        p1.textContent = leader;
        p0.style.margin = '0';
        p1.style.margin = '0';
        cell.style.width = '100px';
        cell.style.height = '60px';
        cell.style.borderWidth = '3px';
        cell.append(p0,p1);
      } else {
        const p = document.createElement('p');
        p.style.height = '28px';
        p.style.width = '28px';
        p.style.margin = '0';
        p.style.display = 'flex';
        p.style.alignItems = 'center';
        p.style.lineHeight = '1';
        p.style.justifyContent = 'center';
        const str = shortenRank.replace(/\w+-|だけ/g,'');
        p.textContent = str;
        if (str.length === 3) p.style.fontSize = '14px';
        if (str.length === 4) p.style.fontSize = '13px';
        cell.append(p);
      }

      cell.className = 'cell';
      cell.style.overflow = 'hidden';
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.dataset.rank = shortenRank;
      cell.dataset.leader = leader;
      cell.dataset.team = teamname;

      if ('customColors' in settings && teamname in settings.customColors) {
        cell.style.backgroundColor = '#' + settings.customColors[teamname];
      } else {
        cell.style.backgroundColor = elm.style.backgroundColor;
      }

      const rgb = (cell.style.backgroundColor.match(/\d+/g) || [0,0,0]).map(Number);
      const brightness = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      cell.style.color = brightness > 128 ? '#000' : '#fff';

      cell.addEventListener('click', ()=>{ handleCellClick(cell); });

      elm.replaceWith(cell);
    } catch(e) {
      console.error(e);
    }
  }

  // ============================================================
  // addCustomColor（元仕様を簡略維持）
  // ============================================================
  function addCustomColor() {
    const teamTable = document.querySelectorAll('table')[0];
    if(!teamTable || !teamTable.rows?.length) return;

    const rows = [...teamTable.rows].slice(1);
    const btn = document.createElement('button');
    btn.style.padding = '4px';
    btn.style.lineHeight = '1';
    btn.style.marginLeft = '2px';

    // 既に付いてたら二重追加しない
    if (teamTable.querySelector('[data-aat-colorbtn="1"]')) return;

    const editButton = btn.cloneNode();
    editButton.dataset.aatColorbtn = "1";
    editButton.textContent = '▼';

    const editEndButton = btn.cloneNode();
    editEndButton.textContent = '✓';
    editEndButton.style.display = 'none';

    const helpButton = btn.cloneNode();
    helpButton.textContent = '？';

    editButton.addEventListener('click', ()=>{
      editButton.style.display = 'none';
      editEndButton.style.display = '';
      rows.forEach(row=>{
        const cell = row.cells[0];
        const cellColor = cell.textContent.trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = cellColor;
        input.style.width = '6em';
        input.addEventListener('change', ()=>{
          const teamname = row.cells[1].textContent;
          if (input.value === '') {
            if (settings.customColors) {
              delete settings.customColors[teamname];
              localStorage.setItem('aat_settings', JSON.stringify(settings));
            }
            return;
          }
          const isValidColor = /^[0-9A-Fa-f]{6}$/.test(input.value);
          if (!isValidColor) { input.value = cellColor; return; }
          if (!settings.customColors) settings.customColors = {};
          settings.customColors[teamname] = input.value;
          localStorage.setItem('aat_settings', JSON.stringify(settings));
          cell.style.background = '#' + input.value;
          row.cells[0].style.fontStyle = 'italic';
        });
        cell.textContent = '';
        cell.append(input);
      });
    });

    editEndButton.addEventListener('click', ()=>{
      editButton.style.display = '';
      editEndButton.style.display = 'none';
      rows.forEach(row=>{
        const cell = row.cells[0];
        const input = cell.querySelector('input');
        if(!input) return;
        cell.textContent = input.value;
        input.remove();
      });
    });

    helpButton.addEventListener('click', ()=>{
      helpDialog.innerHTML = '';
      const div = document.createElement('div');
      div.style.lineHeight = '150%';
      div.innerText =
`・[▼]で色編集 → 変更後は[エリア情報更新]または[エリア情報再取得]を実行
・色を戻すには入力欄を空にして保存
・同色チームが複数あるときは両方変えると取りこぼしが減る`;
      const resetButton = btn.cloneNode();
      resetButton.textContent = '色設定初期化';
      resetButton.addEventListener('click', ()=>{
        delete settings.customColors;
        localStorage.setItem('aat_settings', JSON.stringify(settings));
        alert('色の設定を初期化しました（要エリア更新）');
      });
      helpDialog.append(resetButton, div);
      helpDialog.show();
    });

    // ヘッダセルへ
    if (teamTable.rows[0]?.cells?.[0]) {
      teamTable.rows[0].cells[0].append(editButton, editEndButton, helpButton);
    }

    // 適用
    if (settings.customColors) {
      rows.forEach(row=>{
        const teamname = row.cells[1].textContent;
        if (teamname in settings.customColors) {
          const color = settings.customColors[teamname];
          row.cells[0].textContent = color;
          row.cells[0].style.background = '#' + color;
          row.cells[0].style.fontStyle = 'italic';
        }
        const rgb = (row.cells[0].style.backgroundColor.match(/\d+/g) || [0,0,0]).map(Number);
        const brightness = 0.2126*rgb[0] + 0.7152*rgb[1] + 0.0722*rgb[2];
        row.cells[0].style.color = brightness > 128 ? '#000' : '#fff';
      });
    }
  }

  // ============================================================
  // cell click handlers
  // ============================================================
  function attachCellHandlers(){
    const grid = ensureLegacyGrid();
    if(!grid) return;
    [...grid.querySelectorAll('.cell')].forEach(elm=>{
      const cell = elm.cloneNode(true);
      elm.replaceWith(cell);
      cell.addEventListener('click', ()=>{ handleCellClick(cell); });
    });
  }
  attachCellHandlers();

  // ============================================================
  // arena table popup
  // ============================================================
  async function fetchArenaTable(row, col){
    const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&`+MODEQ;
    try{
      const res = await fetch(url);
      if(!res.ok) throw new Error('res.ng');
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text,'text/html');
      const headerText = doc.querySelector('header')?.textContent || '';
      if(!headerText.includes('どんぐりチーム戦い')) return;

      const table = doc.querySelector('table');
      if(!table) throw new Error('table.ng');
      showArenaTable(table);
    }catch(e){
      console.error(e);
    }

    function showArenaTable(table){
      const tableRow = table.querySelector('tbody > tr');
      if(!tableRow) return;

      const coordinate = tableRow.cells[0].textContent.replace('アリーナ','').trim();
      const holderName = tableRow.cells[1].querySelector('strong');
      const equipCond = tableRow.cells[1].querySelector('small');
      const teamName = tableRow.cells[2].textContent;
      const statistics = (tableRow.cells[3].textContent.match(/\d+/g) || ['0','0','0']);
      const modCounts = (tableRow.cells[4].textContent.match(/\d+/g) || ['0','0']);
      const modders = tableRow.cells[5].textContent;

      const newTable = document.createElement('table');
      const tbody = document.createElement('tbody');
      const tr = tbody.insertRow(0);

      const td = document.createElement('td');
      td.style.textAlign = 'center';

      const cells = [];
      for(let i=0;i<4;i++){ cells.push(td.cloneNode()); tr.append(cells[i]); }

      const hr = document.createElement('hr');
      hr.style.margin = '10px 0';

      cells[0].append(coordinate, hr, equipCond);
      cells[1].append(holderName, document.createElement('br'), `${teamName}`);
      cells[2].innerText = `勝:${statistics[0]}\n負:${statistics[1]}\n引:${statistics[2]}`;
      cells[3].innerText = `強化:${modCounts[0]}\n弱体:${modCounts[1]}\n${modders}人`;
      cells[3].style.whiteSpace = 'nowrap';

      const m = coordinate.match(/\d+/g) || [row,col];
      newTable.dataset.row = m[0];
      newTable.dataset.col = m[1];
      newTable.dataset.rank = equipCond?.textContent || '';
      newTable.style.background = '#fff';
      newTable.style.color = '#000';
      newTable.style.margin = '0';
      newTable.append(tbody);

      // arenaField 本体
      arenaField.innerHTML = '';
      const top = document.createElement('div');
      top.style.display = 'flex';
      top.style.gap = '2px';

      const b = btnTmpl.cloneNode();
      b.style.fontSize = '90%';
      b.style.whiteSpace = 'nowrap';

      const challengeButton = b.cloneNode();
      challengeButton.textContent = 'エリアに挑む';
      challengeButton.style.flexGrow = '2';
      challengeButton.addEventListener('click', async(e)=>{
        const {row, col, rank} = newTable.dataset;
        await autoEquipAndChallenge(row, col, rank);
      });

      const closeButton = b.cloneNode();
      closeButton.textContent = '×';
      closeButton.style.marginLeft = 'auto';
      closeButton.style.fontSize = '24px';
      closeButton.style.width = '48px';
      closeButton.style.height = '48px';
      closeButton.style.lineHeight = '1';
      closeButton.addEventListener('click', ()=>{ arenaField.close(); });

      top.append(challengeButton, closeButton);
      arenaField.append(top, newTable);
      arenaField.show();
    }
  }

  async function handleCellClick(cell){
    if (cellSelectorActivate) {
      if (cell.classList.contains('selected')) {
        cell.style.borderColor = '#ccc';
        cell.classList.remove('selected');
      } else {
        cell.style.borderColor = '#f64';
        cell.classList.add('selected');
      }
      return;
    }

    const row = cell.dataset.row;
    const col = cell.dataset.col;

    if (shouldSkipAreaInfo) {
      const rank = cell.dataset.rank || '';
      if (arenaField.open) fetchArenaTable(row, col);
      await autoEquipAndChallenge(row, col, rank);
    } else {
      fetchArenaTable(row, col);
    }
  }

  // ============================================================
  // autoEquipAndChallenge / challenge
  // ============================================================
  const autoEquipDialog = document.createElement('dialog');
  autoEquipDialog.style.padding = '0';
  autoEquipDialog.style.background = '#fff';
  document.body.append(autoEquipDialog);

  async function autoEquipAndChallenge(row, col, rank) {
    if (shouldSkipAutoEquip) {
      arenaChallenge(row, col);
      return;
    }
    rank = String(rank)
      .replace('エリート','e')
      .replace(/.+から|\w+-|まで|だけ|警|\s|\[|\]|\|/g,'');

    const autoEquipItems = JSON.parse(localStorage.getItem('autoEquipItems')) || {};
    if (autoEquipItems[rank] && !autoEquipItems[rank]?.includes(currentEquipName)) {
      if (autoEquipItems[rank].length === 0) {
        arenaChallenge(row, col);
        return;
      } else if (autoEquipItems[rank].length === 1) {
        await setPresetItems(autoEquipItems[rank][0]);
        arenaChallenge(row, col);
        return;
      } else if (settings.autoEquipRandomly) {
        const index = Math.floor(Math.random() * autoEquipItems[rank].length);
        await setPresetItems(autoEquipItems[rank][index]);
        arenaChallenge(row, col);
        return;
      } else {
        autoEquipDialog.innerHTML = '';
        const ul = document.createElement('ul');
        ul.style.background = '#fff';
        ul.style.listStyle = 'none';
        ul.style.padding = '2px';
        ul.style.textAlign = 'left';
        ul.style.margin = '0';

        const liTemplate = document.createElement('li');
        liTemplate.style.borderBottom = 'solid 1px #000';
        liTemplate.style.color = '#428bca';
        liTemplate.style.cursor = 'pointer';

        autoEquipItems[rank].forEach(v=>{
          const li = liTemplate.cloneNode();
          li.textContent = v;
          li.addEventListener('click', async()=>{
            autoEquipDialog.close();
            await setPresetItems(v);
            arenaChallenge(row, col);
          });
          ul.append(li);
        });

        autoEquipDialog.append(ul);
        autoEquipDialog.showModal();
        return;
      }
    }
    arenaChallenge(row, col);
  }

  async function arenaChallenge(row, col){
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `row=${row}&col=${col}`
    };

    try{
      const response = await fetch('/teamchallenge?'+MODEQ, options);
      if(!response.ok) throw new Error('/teamchallenge res.ng');
      const text = await response.text();
      arenaResult.innerText = text;

      const lastLine = text.trim().split('\n').pop();
      if(text.includes('\n')) {
        const p = document.createElement('p');
        p.textContent = lastLine;
        p.style.fontWeight = 'bold';
        p.style.padding = '0';
        p.style.margin = '0';
        arenaResult.prepend(p);
      }

      arenaResult.show();
      setTimeout(()=>{
        if (settings.arenaResultScrollPosition === 'bottom') arenaResult.scrollTop = arenaResult.scrollHeight;
        else arenaResult.scrollTop = 0;
      },0);

      if (lastLine === 'リーダーになった' || lastLine.includes('は新しいアリーナリーダーです。')) {
        if (!settings.teamColor) return;
        const cell = document.querySelector(`div[data-row="${row}"][data-col="${col}"]`);
        if(cell) {
          cell.style.background = '#' + settings.teamColor;
          fetchSingleArenaInfo(cell);
        }
      }
    }catch(e){
      arenaResult.innerText = e;
      arenaResult.show();
    }
  }

  // ============================================================
  // range attack（簡易ボタンをsubMenuに追加）
  // ============================================================
  const subRow = document.createElement('div');
  subRow.style.display = 'flex';
  subRow.style.flex = '1';
  subRow.style.justifyContent = 'center';
  subRow.style.gap = '2px';
  subRow.style.overflowX = 'auto';
  subRow.style.height = '100%';

  const btnRange = btnTmpl.cloneNode();
  btnRange.textContent = '範囲攻撃';
  btnRange.style.background = '#f64';
  btnRange.style.color = '#fff';
  btnRange.addEventListener('click', ()=>{
    cellSelectorActivate = !cellSelectorActivate;
    btnRange.textContent = cellSelectorActivate ? '選択中' : '範囲攻撃';
  });

  const btnStartRange = btnTmpl.cloneNode();
  btnStartRange.textContent = '攻撃開始';
  btnStartRange.style.background = '#f64';
  btnStartRange.style.color = '#fff';
  btnStartRange.addEventListener('click', async()=>{
    rangeAttackProcessing = true;
    rangeAttackQueue.length = 0;
    await rangeAttack();
    rangeAttackProcessing = false;
  });

  const btnStopRange = btnTmpl.cloneNode();
  btnStopRange.textContent = '中断';
  btnStopRange.style.background = '#888';
  btnStopRange.style.color = '#fff';
  btnStopRange.addEventListener('click', ()=>{ rangeAttackProcessing = false; });

  const btnDeselect = btnTmpl.cloneNode();
  btnDeselect.textContent = '選択解除';
  btnDeselect.style.background = '#888';
  btnDeselect.style.color = '#fff';
  btnDeselect.addEventListener('click', ()=>{
    const cells = document.querySelectorAll('.cell');
    cells.forEach(c=>{
      c.classList.remove('selected');
      c.style.borderColor = '#ccc';
    });
  });

  const btnReget = btnTmpl.cloneNode();
  btnReget.innerText = 'エリア情報\n再取得';
  btnReget.addEventListener('click', ()=>{ fetchAreaInfo(true); });

  subRow.append(btnRange, btnStartRange, btnStopRange, btnDeselect, btnReget);
  subMenu.style.display = 'none';
  subMenu.append(subRow);

  async function rangeAttack(){
    if(rangeAttackQueue.length === 0) {
      rangeAttackQueue = [...document.querySelectorAll('.cell.selected')];
    }
    if(rangeAttackQueue.length === 0) {
      alert('セルを選択してください');
      return false;
    }

    const pTemplate = document.createElement('p');
    pTemplate.style.padding = '0';
    pTemplate.style.margin = '0';

    arenaResult.textContent = '';
    arenaResult.show();

    while(rangeAttackQueue.length > 0) {
      if(!rangeAttackProcessing) return false;

      const cell = rangeAttackQueue[0];
      if(!cell.classList.contains('selected')) {
        rangeAttackQueue.shift();
        continue;
      }

      const row = cell.dataset.row;
      const col = cell.dataset.col;

      cell.style.borderColor = '#4f6';

      try{
        const response = await fetch('/teamchallenge?'+MODEQ, {
          method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body:`row=${row}&col=${col}`
        });
        const text = await response.text();
        const lastLine = text.trim().split('\n').pop();

        if(
          lastLine.length > 100 ||
          lastLine === 'どんぐりが見つかりませんでした。'
        ) throw new Error('どんぐりが見つかりませんでした。');

        if(
          lastLine === 'あなたのチームは動きを使い果たしました。しばらくお待ちください。' ||
          lastLine === 'ng<>too fast' ||
          lastLine === '武器と防具を装備しなければなりません。' ||
          lastLine === '最初にチームに参加する必要があります。'
        ) throw new Error(lastLine);

        const p = pTemplate.cloneNode();
        p.textContent = `(${row}, ${col}) ${lastLine}`;
        arenaResult.prepend(p);
        rangeAttackQueue.shift();
      }catch(e){
        const p = pTemplate.cloneNode();
        p.textContent = `(${row}, ${col}) [中断] ${e}`;
        arenaResult.prepend(p);
        return false;
      }

      if (rangeAttackQueue.length > 0) {
        await new Promise(r=>setTimeout(r,1500));
      }
      cell.style.borderColor = cell.classList.contains('selected') ? '#f64' : '#ccc';
    }

    const p = pTemplate.cloneNode();
    p.textContent = '完了';
    arenaResult.prepend(p);
    return true;
  }

  // ============================================================
  // view mode
  // ============================================================
  function toggleCellViewMode(){
    const grid = ensureLegacyGrid();
    if(!grid) return;
    const cells = grid.querySelectorAll('.cell');

    if(currentViewMode === 'detail') {
      currentViewMode = 'compact';
      grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace('65px','35px');
      grid.style.gridTemplateColumns = grid.style.gridTemplateColumns.replace('105px','35px');

      for (const cell of cells) {
        cell.style.width = '30px';
        cell.style.height = '30px';
        cell.style.borderWidth = '1px';
        while (cell.firstChild) cell.firstChild.remove();

        const p = document.createElement('p');
        p.style.height = '28px';
        p.style.width = '28px';
        p.style.margin = '0';
        p.style.display = 'flex';
        p.style.alignItems = 'center';
        p.style.lineHeight = '1';
        p.style.justifyContent = 'center';
        const rank = (cell.dataset.rank || '').replace(/\w+-|だけ/g,'');
        p.textContent = rank;
        if (rank.length === 3) p.style.fontSize = '14px';
        if (rank.length === 4) p.style.fontSize = '13px';
        cell.append(p);
      }
    } else {
      currentViewMode = 'detail';
      grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace('35px','65px');
      grid.style.gridTemplateColumns = grid.style.gridTemplateColumns.replace('35px','105px');

      for (const cell of cells) {
        while (cell.firstChild) cell.firstChild.remove();
        const rank = cell.dataset.rank || '';
        const leader = cell.dataset.leader || '';
        const p0 = document.createElement('p');
        const p1 = document.createElement('p');
        p0.textContent = rank;
        p1.textContent = leader;
        p0.style.margin = '0';
        p1.style.margin = '0';
        cell.style.width = '100px';
        cell.style.height = '60px';
        cell.style.borderWidth = '3px';
        cell.append(p0,p1);
      }
    }
  }

  // ============================================================
  // autoJoin（canvas対応：getRegionsのscript取得/rowscols/capitalList対応）
  // ============================================================
  let autoJoinIntervalId;
  let isAutoJoinRunning = false;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  // autoJoin UI（簡易）
  const autoJoinDialog = document.createElement('dialog');
  autoJoinDialog.style.background = '#fff';
  autoJoinDialog.style.color = '#000';
  autoJoinDialog.style.width = '90vw';
  autoJoinDialog.style.height = '90vh';
  autoJoinDialog.style.fontSize = '80%';
  autoJoinDialog.style.textAlign = 'center';
  autoJoinDialog.style.marginTop = '2vh';
  autoJoinDialog.classList.add('auto-join');
  document.body.append(autoJoinDialog);

  const autoJoinLog = document.createElement('div');
  autoJoinLog.classList.add('auto-join-log');
  autoJoinLog.style.margin = '2px';
  autoJoinLog.style.border = 'solid 1px #000';
  autoJoinLog.style.overflow = 'auto';
  autoJoinLog.style.height = '75vh';
  autoJoinLog.style.textAlign = 'left';

  const btnAutoJoin = btnTmpl.cloneNode();
  btnAutoJoin.innerText = '自動参加\nモード';
  btnAutoJoin.style.background = '#ffb300';
  btnAutoJoin.style.color = '#000';
  btnAutoJoin.addEventListener('click', ()=>{
    autoJoinLog.innerHTML = '';
    autoJoinDialog.showModal();
    startAutoJoin();
  });
  // subMenuへ追加
  subRow.append(btnAutoJoin);

  const btnAutoJoinClose = document.createElement('button');
  btnAutoJoinClose.textContent = '自動参加モードを終了';
  btnAutoJoinClose.addEventListener('click', ()=>{ autoJoinDialog.close(); });

  autoJoinDialog.append(autoJoinLog, btnAutoJoinClose);

  const messageTypes = {
    afterRetry: ['再建が必要です。','防御設備を破壊しました。'],
    breaktime: ['もう一度バトルに参加する前に、待たなければなりません。','ng: ちょっとゆっくり'],
    retry: ['あなたのチームは動きを使い果たしました。しばらくお待ちください。','ng<>too fast'],
    reset: ['このタイルは攻撃できません。範囲外です。'],
    quit: ['最初にチームに参加する必要があります。','どんぐりが見つかりませんでした。','あなたのどんぐりが理解できませんでした。','レベルが低すぎます。'],
    equipError: ['武器と防具を装備しなければなりません。','装備している防具と武器が力不足です。','装備している防具と武器が強すぎます','装備しているものは改造が多すぎます。改造の少ない他のものをお試しください','参加するには、装備中の武器と防具のアイテムID','[警備員]だけ'],
    nonAdjacent: ['このタイルは攻撃できません。あなたのチームが首都を持つまで、どの首都にも隣接するタイルを主張することはできません。','あなたのチームは首都を持っていないため、他のチームの首都に攻撃できません。'],
    teamAdjacent: ['このタイルは攻撃できません。あなたのチームの制御領土に隣接していなければなりません。','このタイルは攻撃できません。首都を奪取するには、隣接タイルを少なくとも3つ支配している必要があります。','このタイルは攻撃できません。首都を奪取するには、隣接タイルを少なくとも2つ支配している必要があります。','このタイルは攻撃できません。首都を奪取するには、隣接タイルを少なくとも1つ支配している必要があります。','このタイルは攻撃できません。自分の首都は攻撃できません。','この首都は攻撃できません。相手の総タイル数の少なくとも'],
    capitalAdjacent: ['このタイルは攻撃できません。混雑したマップでは、初期主張は正確に1つの首都に隣接していなければなりません。'],
    mapEdge: ['このタイルは攻撃できません。混雑したマップでは、初期主張はマップの端でなければなりません。']
  };
  function getMessageType(text){
    return Object.keys(messageTypes).find(k => messageTypes[k].some(v => text.includes(v)));
  }

  function logMessage(region, message, next){
    const date = new Date();
    const ymd = date.toLocaleDateString('sv-SE').slice(2);
    const time = date.toLocaleTimeString('sv-SE');

    const stamp = document.createElement('div');
    stamp.innerText = `${ymd}\n${time}`;
    stamp.style.fontSize = '90%';
    stamp.style.color = '#666';
    stamp.style.borderRight = 'solid 0.5px #888';
    stamp.style.whiteSpace = 'nowrap';

    const regionDiv = document.createElement('div');
    const progress = `${currentPeriod}期 ${currentProgress}%`;
    if(region) regionDiv.innerText = `${progress}\nchallenge: ${region.join(',')}\n${next}`;
    else regionDiv.innerText = next;
    regionDiv.style.fontSize = '90%';
    regionDiv.style.color = '#444';
    regionDiv.style.borderRight = 'dotted 0.5px #888';
    regionDiv.style.whiteSpace = 'nowrap';

    const msgDiv = document.createElement('div');
    msgDiv.textContent = message;

    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '4px';
    div.style.alignItems = 'center';
    div.style.border = 'solid 0.5px #888';

    div.append(stamp, regionDiv, msgDiv);
    autoJoinLog.prepend(div);
  }

  let nextProgress;

  async function getRegions(){
    try{
      const AUTOJOIN_TEAM_COLORS = ['d32f2f', '1976d2'];

      const res = await fetch('');
      if(!res.ok) throw new Error(`[${res.status}] /teambattle`);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      const headerText = doc.querySelector('header')?.textContent || '';
      if(!headerText.includes('どんぐりチーム戦い')) throw new Error('title.ng info');

      const scriptContent = getBattleScriptTextFromDoc(doc);

      // cellColors
      const cellColors = parseConstObject(scriptContent, 'cellColors') || {};

      // capitalList
      const capitalMap = parseConstArray(scriptContent, 'capitalList') || [];

      // rows/cols
      const rows = parseGridSize(scriptContent);
      const cols = rows;

      const cells = [];
      for(let r=0;r<rows;r++){
        for(let c=0;c<cols;c++){
          cells.push([r,c]);
        }
      }

      const directions = [[-1,0],[1,0],[0,-1],[0,1]];

      // target (赤/青) タイル集合
      const targetCapitalSet = new Set();
      for(const [key, value] of Object.entries(cellColors)){
        const color = String(value).replace('#','');
        if(AUTOJOIN_TEAM_COLORS.includes(color)) targetCapitalSet.add(key);
      }

      const targetAdjacentSet = new Set();
      for(const key of targetCapitalSet){
        const [r,c] = key.split('-').map(Number);
        for(const [dr,dc] of directions){
          const nr=r+dr, nc=c+dc;
          if(nr>=0 && nr<rows && nc>=0 && nc<cols) targetAdjacentSet.add(`${nr}-${nc}`);
        }
      }
      const targetAdjacentCells = cells.filter(([r,c]) => targetAdjacentSet.has(`${r}-${c}`));

      // capital adjacency
      const adjacentSet = new Set();
      for(const [cr,cc] of capitalMap){
        for(const [dr,dc] of directions){
          const nr=cr+dr, nc=cc+dc;
          if(nr>=0 && nr<rows && nc>=0 && nc<cols) adjacentSet.add(`${nr}-${nc}`);
        }
      }
      const capitalSet = new Set(capitalMap.map(([r,c]) => `${r}-${c}`));

      const nonAdjacentCells = cells.filter(([r,c])=>{
        const k=`${r}-${c}`;
        return !capitalSet.has(k) && !adjacentSet.has(k);
      });

      // map edge
      const mapEdgeSet = new Set();
      for(let i=0;i<rows;i++){
        mapEdgeSet.add(`${i}-0`);
        mapEdgeSet.add(`${i}-${cols-1}`);
      }
      for(let i=0;i<cols;i++){
        mapEdgeSet.add(`0-${i}`);
        mapEdgeSet.add(`${rows-1}-${i}`);
      }
      const mapEdgeCells = cells.filter(([r,c])=>{
        const k=`${r}-${c}`;
        return mapEdgeSet.has(k) && !capitalSet.has(k);
      });

      function shuffle(arr){
        for(let i=arr.length-1;i>0;i--){
          const j=Math.floor(Math.random()*(i+1));
          [arr[i],arr[j]]=[arr[j],arr[i]];
        }
        return arr;
      }

      return {
        targetAdjacent: shuffle(targetAdjacentCells),
        nonAdjacent: shuffle(nonAdjacentCells),
        mapEdge: shuffle(mapEdgeCells)
      };

    }catch(e){
      console.error(e);
      return { targetAdjacent:[], nonAdjacent:[], mapEdge:[] };
    }
  }

  async function challenge(region){
    const [row,col]=region;
    const res = await fetch('/teamchallenge?'+MODEQ, {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:`row=${row}&col=${col}`
    });
    if(!res.ok) throw new Error(res.status);
    const text = await res.text();
    const lastLine = text.trim().split('\n').pop();
    return [text,lastLine];
  }

  async function equipChange(region){
    const [row,col]=region;
    const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&`+MODEQ;
    const res = await fetch(url);
    if(!res.ok) throw new Error(res.status);

    const text = await res.text();
    const doc = new DOMParser().parseFromString(text,'text/html');
    const headerText = doc.querySelector('header')?.textContent || '';
    if(!headerText.includes('どんぐりチーム戦い')) throw new Error('title.ng');

    const table = doc.querySelector('table');
    const equipCond = table?.querySelector('td small')?.textContent || '';
    const rank = equipCond
      .replace('エリート','e')
      .replace(/.+から|\w+-|まで|だけ|警|\s|\[|\]|\|/g,'');

    const autoEquipItems = JSON.parse(localStorage.getItem('autoEquipItems')) || {};
    const autoEquipItemsAutojoin = JSON.parse(localStorage.getItem('autoEquipItemsAutojoin')) || {};

    if (autoEquipItemsAutojoin[rank]?.length > 0) {
      const idx = Math.floor(Math.random()*autoEquipItemsAutojoin[rank].length);
      await setPresetItems(autoEquipItemsAutojoin[rank][idx]);
      return [rank,'success'];
    } else if (autoEquipItems[rank]?.length > 0) {
      const idx = Math.floor(Math.random()*autoEquipItems[rank].length);
      await setPresetItems(autoEquipItems[rank][idx]);
      return [rank,'success'];
    } else {
      return [rank,'noEquip'];
    }
  }

  async function attackRegion(){
    await drawProgressBar();
    if (isAutoJoinRunning || Math.abs((nextProgress||currentProgress) - currentProgress) >= 3) return;

    let regions = await getRegions();
    const excludeSet = new Set();
    let cellType =
      regions.targetAdjacent.length > 0 ? 'targetAdjacent' :
      regions.nonAdjacent.length > 0 ? 'nonAdjacent' : 'mapEdge';

    while(autoJoinDialog.open){
      let success = false;
      isAutoJoinRunning = true;

      regions[cellType] = regions[cellType].filter(e=>!excludeSet.has(e.join(',')));

      for(const region of regions[cellType]){
        try{
          const [cellRank, equipStat] = await equipChange(region);
          if(equipStat === 'noEquip'){
            excludeSet.add(region.join(','));
            continue;
          }

          const [text,lastLine] = await challenge(region);
          const type = getMessageType(lastLine);
          let message = lastLine;
          let processType;
          let sleepTime = 1500;

          if(text.startsWith('アリーナチャレンジ開始') || text.startsWith('リーダーになった')){
            success = true;
            message = '[成功] ' + lastLine;
            processType = 'return';
          } else if(type === 'breaktime'){
            success = true;
            processType = 'return';
          } else if(type === 'afterRetry'){
            processType = 'continue';
          } else if(type === 'retry'){
            sleepTime = 10100;
            processType = 'continue';
          } else if(type === 'equipError'){
            processType = 'continue';
            message += ` (${cellRank}, ${currentEquipName})`;
          } else if(lastLine.length > 100){
            processType = 'continue';
            message = 'どんぐりシステム';
          } else if(type === 'quit'){
            processType = 'return';
            message = '[停止] ' + lastLine;
            clearInterval(autoJoinIntervalId);
          } else if(type === 'reset'){
            processType = 'break';
          } else if(type){
            excludeSet.add(region.join(','));
            processType = (type === cellType) ? 'continue' : 'break';
            if(type !== cellType) cellType = type;
          } else {
            processType = 'continue';
          }

          if (success) {
            if (currentProgress < 7) nextProgress = 20;
            else if (currentProgress < 24) nextProgress = 37;
            else if (currentProgress < 41) nextProgress = 53;
            else if (currentProgress < 57) nextProgress = 70;
            else if (currentProgress < 74) nextProgress = 86;
            else nextProgress = 3;
            logMessage(region, message, `→ ${nextProgress}±2%`);
            isAutoJoinRunning = false;
          } else if(processType === 'return') {
            logMessage(region, message, '');
            isAutoJoinRunning = false;
            return;
          } else {
            logMessage(region, message, `→ ${Math.round(sleepTime/1000)}s`);
          }

          await sleep(sleepTime);

          if(processType === 'break'){
            regions = await getRegions();
            break;
          }
          if(processType === 'return') return;

        }catch(e){
          logMessage(region, `[err] ${e}`, '→ 20s');
          await sleep(20000);
        }
      }

      if(!success && regions[cellType].length === 0){
        if (currentProgress < 7) nextProgress = 20;
        else if (currentProgress < 24) nextProgress = 37;
        else if (currentProgress < 41) nextProgress = 53;
        else if (currentProgress < 57) nextProgress = 70;
        else if (currentProgress < 74) nextProgress = 86;
        else nextProgress = 3;

        logMessage(null, '攻撃可能なタイルが見つかりませんでした。', `→ ${nextProgress}±2%`);
        isAutoJoinRunning = false;
        return;
      }
    }
  }

  function startAutoJoin(){
    if(!settings.teamColor){
      // 自動参加で自陣更新が欲しい人は色設定してね（既存仕様）
    }
    if(autoJoinIntervalId) clearInterval(autoJoinIntervalId);
    attackRegion();
    autoJoinIntervalId = setInterval(attackRegion, 60000);
  }

  // ============================================================
  // progress bar
  // ============================================================
  async function drawProgressBar(){
    try{
      const res = await fetch('https://donguri.5ch.net/');
      if(!res.ok) throw new Error(res.status);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text,'text/html');

      const container = doc.querySelector('div.stat-block:nth-child(2)>div:nth-child(5)')?.cloneNode(true);
      if(!container) return;

      currentPeriod = Number(container.firstChild.textContent.match(/\d+/)[0]);
      currentProgress = parseInt(container.lastElementChild.textContent, 10);

      let str, min, totalSec, sec, margin;
      if (currentProgress === 0 || currentProgress === 50) {
        str = '（マップ更新時）';
      } else {
        if (currentProgress === 100) {
          min = 0; sec = 20; margin = 10;
        } else {
          totalSec = (currentProgress < 50) ? (50 - currentProgress) * 36 : (100 - currentProgress) * 36 + 10;
          min = Math.trunc(totalSec / 60);
          sec = totalSec % 60;
          margin = 20;
        }
        str = `（マップ更新まで${min}分${sec}秒 ±${margin}秒）`;
      }

      progressBarBody.textContent = currentProgress + '%';
      progressBarBody.style.width = currentProgress + '%';
      progressBarInfo.textContent = `${MODENAME} 第 ${currentPeriod} 期${str}`;

      const statBlock = doc.querySelector('.stat-block');
      if(statBlock){
        const w = statBlock.textContent.match(/木材の数: (\d+)/);
        const s = statBlock.textContent.match(/鉄の数: (\d+)/);
        if(w) wood = Number(w[1]);
        if(s) steel = Number(s[1]);
      }
    }catch(e){
      console.error(e+' drawProgressBar()');
    }
  }

  drawProgressBar();
  let progressBarIntervalId = setInterval(drawProgressBar, 18000);

  // dialog close で自動参加停止
  new MutationObserver(()=>{
    if(!autoJoinDialog.open){
      if(autoJoinIntervalId) { clearInterval(autoJoinIntervalId); autoJoinIntervalId = null; }
      isAutoJoinRunning = false;
      drawProgressBar();
      if(!progressBarIntervalId) progressBarIntervalId = setInterval(drawProgressBar, 18000);
    }
  }).observe(autoJoinDialog, {attributes:true, attributeFilter:['open']});

})();
