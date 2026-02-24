// ==UserScript==
// @name         donguri arena assist tool - Hybrid Version
// @version      1.4.0
// @description  コード1をベースにコード2の自動参戦・自動装備機能を統合
// @author       7234e634 & ぱふぱふ (Merged)
// @match        https://donguri.5ch.net/teambattle*
// @match        https://donguri.5ch.net/bag
// ==/UserScript==

(()=>{
  if(location.href === 'https://donguri.5ch.net/bag') {
    function saveCurrentEquip(url, index) {
      let currentEquip = JSON.parse(localStorage.getItem('current_equip')) || [];
      const regex = /https:\/\/donguri\.5ch\.net\/equip\/(\d+)/;
      const equipId = url.match(regex)[1];
      currentEquip[index] = equipId;
      localStorage.setItem('current_equip', JSON.stringify(currentEquip));
    }
    const tableIds = ['weaponTable', 'armorTable', 'necklaceTable'];
    tableIds.forEach((elm, index)=>{
      const equipLinks = document.querySelectorAll(`#${elm} a[href^="https://donguri.5ch.net/equip/"]`);
      [...equipLinks].forEach(link => {
        link.addEventListener('click', ()=>{
          saveCurrentEquip(link.href, index);
        })
      })
    })
    return;
  }

  // --- コード2: モード判定の統合 ---
  const MODEQ = location.search.slice(1);
  let MODENAME = '[ﾊｰﾄﾞｺｱ]';
  let MODEM = 'hc';
  if (MODEQ.includes('m=l')) {
      MODENAME = '[ﾗﾀﾞｰ]';
      MODEM = 'l';
  } else if (MODEQ.includes('m=rb')) {
      MODENAME = '[ﾚﾄﾞﾌﾞﾙ]';
      MODEM = 'rb';
  }

  const vw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
  const vh = Math.min(document.documentElement.clientHeight, window.innerHeight || 0);

  const settings = JSON.parse(localStorage.getItem('aat_settings')) || {};

  const header = document.querySelector('header');
  header.style.marginTop = '100px';
  const toolbar = document.createElement('div');
  toolbar.style.position = 'fixed';
  toolbar.style.top = '0';
  toolbar.style.zIndex = '1';
  toolbar.style.background = '#fff';
  toolbar.style.border = 'solid 1px #000';
  (()=>{ // settings.toolbarPosition
    const position = settings.toolbarPosition || 'left';
    let distance = settings.toolbarPositionLength || '0px';

    const match = distance.match(/^(\d+)(px|%|vw)?$/);
    let value = match ? parseFloat(match[1]) : 0;
    let unit = match ? match[2] || 'px' : 'px';

    const maxPx = vw / 3;
    const maxPercent = 33;
    const maxVw = 33;
    if (unit === 'px') value = Math.min(value, maxPx);
    else if (unit === '%') value = Math.min(value, maxPercent);
    else if (unit === 'vw') value = Math.min(value, maxVw);

    distance = `${value}${unit}`;

    if (position === 'left') {
      toolbar.style.left = distance;
    } else if (position === 'right') {
      toolbar.style.right = distance;
    } else if (position === 'center') {
      toolbar.style.left = distance;
      toolbar.style.right = distance;
    }
  })();
  const h4 = header.querySelector('h4');
  if(h4) h4.style.display = 'none';
  header.append(toolbar);
  const progressBarContainer = document.createElement('div');
  toolbar.append(progressBarContainer);

  // コード2ベースのプログレスバー要素初期化
  const progressBarBodyInfo = document.createElement('p');
  progressBarBodyInfo.style.margin = '0';
  progressBarBodyInfo.style.fontSize = '14px';

  let shouldSkipAreaInfo, shouldSkipAutoEquip, cellSelectorActivate, rangeAttackProcessing;
  let currentPeriod, currentProgress;
  let currentEquipName = '';

  (()=>{
    const button = document.createElement('button');
    button.type = 'button';
    button.style.flexShrink = '1';
    button.style.flexGrow = '0';
    button.style.whiteSpace = 'nowrap';
    button.style.overflow = 'hidden';
    button.style.boxSizing = 'border-box';
    button.style.padding = '2px';
    button.style.width = '6em';
    button.style.fontSize = '65%';

    if (vw < 768) {
      progressBarContainer.style.fontSize = '60%';
    }

    const menuButton = button.cloneNode();
    menuButton.textContent = '▼メニュー';
    menuButton.addEventListener('click', ()=>{
      const isSubMenuOpen = subMenu.style.display === 'flex';
      subMenu.style.display = isSubMenuOpen ? 'none' : 'flex';
    })
  
    const equipButton = button.cloneNode();
    equipButton.textContent = '■装備';
    equipButton.addEventListener('click', ()=>{
      panel.style.display = 'flex';
    });

    let currnetSort = 'default';
    const sortButton = button.cloneNode();
    sortButton.innerText = 'ソート\n切り替え';
    sortButton.addEventListener('click', ()=>{
      if(currnetSort === 'default') {
        sortCells('cond');
