// ==UserScript==
// @name         donguri arena assist tool
// @version      1.3-fix
// @description  fix arena ui and add functions (updated specs & removed auto join) + progressbar fix
// @author       7234e634
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

  const vw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
  const vh = Math.min(document.documentElement.clientHeight, window.innerHeight || 0);

  const settings = JSON.parse(localStorage.getItem('aat_settings')) || {};

  // ===== toolbar mount (headerが無い時に死なないように) =====
  const header = document.querySelector('header') || document.body;
  if (header && header.style) header.style.marginTop = '100px';

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

  const h4 = (document.querySelector('header') || header).querySelector?.('h4');
  if(h4) h4.style.display = 'none';
  header.append(toolbar);

  const progressBarContainer = document.createElement('div');
  toolbar.append(progressBarContainer);

  // add buttons and select to custom menu
  let shouldSkipAreaInfo, cellSelectorActivate, rangeAttackProcessing;
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
        currnetSort = 'cond';
      } else {
        sortCells('default');
        currnetSort = 'default';
      }
    })

    const cellButton = button.cloneNode();
    cellButton.innerText = 'エリア情報\n再取得';
    cellButton.addEventListener('click',()=>{
      fetchAreaInfo(true);
    });

    const refreshButton = button.cloneNode();
    refreshButton.innerText = 'エリア情報\n更新';
    refreshButton.addEventListener('click',()=>{
      fetchAreaInfo(false);
    });

    const subMenu = document.createElement('div');
    subMenu.style.display = 'none';
    subMenu.style.flexWrap = 'nowrap';
    subMenu.style.overflowX = 'hidden';
    subMenu.style.position = 'relative';

    (()=>{
      const subButton = button.cloneNode();
      subButton.style.fontSize = '65%';
      subButton.style.width = '6em';
      subButton.style.border = 'none';
      subButton.style.padding = '2px';

      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.flex = '1';
      div.style.justifyContent = 'center';
      div.style.gap = '2px';
      div.style.overflowX = 'auto';
      div.style.height = '100%';

      const slideMenu = document.createElement('div');
      slideMenu.style.display = 'flex';
      slideMenu.style.flex = '1';
      slideMenu.style.justifyContent = 'center';
      slideMenu.style.gap = '2px';
      slideMenu.style.position = 'absolute';
      slideMenu.style.width = '100%';
      slideMenu.style.height = '100%';
      slideMenu.style.right = '-100%';
      slideMenu.style.background = '#fff';
      slideMenu.style.transition = 'transform 0.1s ease';

      const skipAreaInfoButton = subButton.cloneNode();
      skipAreaInfoButton.innerText = 'セル情報\nスキップ';
      skipAreaInfoButton.style.color = '#fff';
      if (settings.skipArenaInfo) {
        skipAreaInfoButton.style.background = '#46f';
        shouldSkipAreaInfo = true;
      } else {
        skipAreaInfoButton.style.background = '#888';
        shouldSkipAreaInfo = false;
      }
      skipAreaInfoButton.addEventListener('click', ()=>{
        if(shouldSkipAreaInfo) {
          skipAreaInfoButton.style.background = '#888';
          shouldSkipAreaInfo = false;
        } else {
          skipAreaInfoButton.style.background = '#46f';
          shouldSkipAreaInfo = true;
        }
        settings.skipArenaInfo = shouldSkipAreaInfo;
        localStorage.setItem('aat_settings', JSON.stringify(settings));
      })

      const settingsButton = subButton.cloneNode();
      settingsButton.textContent = '設定';
      settingsButton.style.background = '#ffb300';
      settingsButton.style.color = '#000';
      settingsButton.addEventListener('click', ()=>{
        settingsDialog.show();
      })

      const rangeAttackButton = subButton.cloneNode();
      rangeAttackButton.textContent = '範囲攻撃';
      rangeAttackButton.style.background = '#f64';
      rangeAttackButton.style.color = '#fff';
      rangeAttackButton.addEventListener('click', ()=>{
        slideMenu.style.transform = 'translateX(-100%)';
        cellSelectorActivate = true;
      })

      const closeSlideMenuButton = subButton.cloneNode();
      closeSlideMenuButton.textContent = 'やめる';
      closeSlideMenuButton.style.background = '#888';
      closeSlideMenuButton.style.color = '#fff';
      closeSlideMenuButton.addEventListener('click', ()=>{
        slideMenu.style.transform = 'translateX(0)';
        cellSelectorActivate = false;
      })

      const startRangeAttackButton = subButton.cloneNode();
      startRangeAttackButton.textContent = '攻撃開始';
      startRangeAttackButton.style.background = '#f64';
      startRangeAttackButton.style.color = '#fff';
      startRangeAttackButton.addEventListener('click', async()=>{
        rangeAttackProcessing = true;
        rangeAttackQueue.length = 0;
        switchRangeAttackButtons();
        await rangeAttack();
        rangeAttackProcessing = false;
        switchRangeAttackButtons();
      })

      const pauseRangeAttackButton = subButton.cloneNode();
      pauseRangeAttackButton.textContent = '中断';
      pauseRangeAttackButton.style.background = '#888';
      pauseRangeAttackButton.style.color = '#fff';
      pauseRangeAttackButton.addEventListener('click', ()=>{
        if (!rangeAttackProcessing) return;
        rangeAttackProcessing = false;
        switchRangeAttackButtons();
      })

      const resumeRangeAttackButton = subButton.cloneNode();
      resumeRangeAttackButton.textContent = '再開';
      resumeRangeAttackButton.style.background = '#f64';
      resumeRangeAttackButton.style.color = '#fff';
      resumeRangeAttackButton.style.display = 'none';
      resumeRangeAttackButton.addEventListener('click', async()=>{
        rangeAttackProcessing = true;
        switchRangeAttackButtons();
        await rangeAttack();
        rangeAttackProcessing = false;
        switchRangeAttackButtons();
      })

      function switchRangeAttackButtons (){
        if(rangeAttackProcessing) {
          startRangeAttackButton.disabled = true;
          resumeRangeAttackButton.style.display = 'none';
          pauseRangeAttackButton.style.display = '';
        } else {
          startRangeAttackButton.disabled = false;
          if (rangeAttackQueue.length > 0) {
            resumeRangeAttackButton.style.display = '';
            pauseRangeAttackButton.style.display = 'none';
          }
        }
      }

      const deselectButton = subButton.cloneNode();
      deselectButton.textContent = '選択解除';
      deselectButton.style.background = '#888';
      deselectButton.style.color = '#fff';
      deselectButton.addEventListener('click', ()=>{
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
          cell.classList.remove('selected');
          cell.style.borderColor = '#ccc';
        });
      })

      const batchSelectButton = subButton.cloneNode();
      batchSelectButton.textContent = '一括選択';
      batchSelectButton.style.background = '#ffb300';
      batchSelectButton.style.color = '#000';
      batchSelectButton.addEventListener('click', ()=>{
        batchSelectMenu.style.display = 'flex';
      })
      const batchSelectMenu = document.createElement('div');
      batchSelectMenu.style.display = 'none';
      batchSelectMenu.style.flex = '1';
      batchSelectMenu.style.justifyContent = 'center';
      batchSelectMenu.style.gap = '2px';
      batchSelectMenu.style.position = 'absolute';
      batchSelectMenu.style.width = '100%';
      batchSelectMenu.style.height = '100%';
      batchSelectMenu.style.background = '#fff';

      (()=>{
        const ranks = ['N', 'R', 'SR', 'SSR', 'UR'];
        ranks.forEach(rank=>{
          const rankButton = subButton.cloneNode();
          rankButton.style.width = '4.5em';
          rankButton.style.background = '#ffb300';
          rankButton.style.color = '#000';
          rankButton.textContent = rank;
          rankButton.addEventListener('click', ()=>{
            const cells = document.querySelectorAll('.cell');
            cells.forEach(cell => {
              const cellRank = cell.querySelector('p').textContent;
              const regex = new RegExp(`\\b${rank}(だけ)?e?$`);
              const match = cellRank.match(regex);
              if(match) {
                cell.classList.add('selected');
                cell.style.borderColor = '#f64';
              } else {
                cell.classList.remove('selected');
                cell.style.borderColor = '#ccc';
              }
              batchSelectMenu.style.display = 'none';
            })
          })
          batchSelectMenu.append(rankButton);
        })
        const closeButton = subButton.cloneNode();
        closeButton.style.width = '4.5em';
        closeButton.style.background = '#888';
        closeButton.style.color = '#fff';
        closeButton.textContent = 'やめる';
        closeButton.addEventListener('click', ()=>{
          batchSelectMenu.style.display = 'none';
        })
        batchSelectMenu.prepend(closeButton);
      })();

      div.append(skipAreaInfoButton, rangeAttackButton, settingsButton);
      slideMenu.append(closeSlideMenuButton, startRangeAttackButton, pauseRangeAttackButton, resumeRangeAttackButton, batchSelectButton, deselectButton, batchSelectMenu);
      subMenu.append(div, slideMenu);

    })();

    const main = document.createElement('div');
    main.style.display = 'flex';
    main.style.flexWrap = 'nowrap';
    main.style.gap = '2px';
    main.style.justifyContent = 'center';
    main.append(menuButton, equipButton, sortButton, refreshButton, cellButton);

    toolbar.append(main, subMenu);
  })();

  const arenaField = document.createElement('dialog');
  arenaField.style.position = 'fixed';
  arenaField.style.background = '#fff';
  arenaField.style.color = '#000';
  arenaField.style.border = 'solid 1px #000';
  if(vw < 768) arenaField.style.fontSize = '85%';
  (()=>{
    arenaField.style.bottom = settings.arenaFieldBottom ? settings.arenaFieldBottom : '4vh';
    if (settings.arenaFieldPosition === 'left') {
      arenaField.style.right = 'auto';
      arenaField.style.left = settings.arenaFieldPositionLength || '0';
    } else if (settings.arenaFieldPosition === 'right') {
      arenaField.style.left = 'auto';
      arenaField.style.right = settings.arenaFieldPositionLength || '0';
    }

    if (settings.arenaFieldWidth) {
      arenaField.style.width = settings.arenaFieldWidth;
      arenaField.style.maxWidth = '100vw';
    } else {
      arenaField.style.maxWidth = '480px';
    }
  })();

  const arenaModDialog = document.createElement('dialog');
  let wood, steel;

  (()=>{
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '2px';

    const button = document.createElement('button');
    button.type = 'button';
    button.style.fontSize = '90%';
    button.style.whiteSpace = 'nowrap';

    if (vw < 768) {
      button.style.fontSize = '80%';
    }

    const challengeButton = button.cloneNode();
    challengeButton.textContent = 'エリアに挑む';
    challengeButton.style.flexGrow = '2';
    challengeButton.addEventListener('click', ()=>{
      const table = arenaField.querySelector('table');
      const row = table.dataset.row;
      const col = table.dataset.col;
      arenaChallenge(row, col);
    })

    const reinforceButton = button.cloneNode();
    reinforceButton.textContent = '強化する';
    reinforceButton.style.flexGrow = '1';
    reinforceButton.addEventListener('click', ()=>{
      arenaModDialog.dataset.action = 'ReinforceArena';
      modButton.textContent = '強化する';
      p.textContent = `木材: ${wood}, 鉄: ${steel} (1ptにつき各25個)`;
      arenaModDialog.show();
    })

    const siegeButton = button.cloneNode();
    siegeButton.textContent = '弱体化';
    siegeButton.style.flexGrow = '1';
    siegeButton.addEventListener('click', ()=>{
      arenaModDialog.dataset.action = 'SiegeArena';
      modButton.textContent = '弱体化';
      p.textContent = `木材: ${wood}, 鉄: ${steel} (1ptにつき各25個)`;
      arenaModDialog.show();
    })

    const closeButton = button.cloneNode();
    closeButton.textContent = '×';
    closeButton.marginLeft = 'auto';
    closeButton.style.fontSize = '24px';
    closeButton.style.width = '48px';
    closeButton.style.height = '48px';
    closeButton.style.lineHeight = '1';

    const p = document.createElement('p');
    const modButton = button.cloneNode();

    closeButton.addEventListener('click', ()=>{arenaField.close()});
    const table = document.createElement('table');
    div.append(challengeButton, reinforceButton, siegeButton, closeButton);
    arenaField.append(div, table, arenaModDialog);
    (()=>{
      arenaModDialog.style.background = '#fff';
      arenaModDialog.style.border = 'solid 1px #000';
      arenaModDialog.style.color = '#000';
      arenaModDialog.style.position = 'fixed';
      arenaModDialog.style.bottom = '4vh';

      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.gap = '2px';

      const input = document.createElement('input');
      input.type = 'number';
      input.placeholder = '改造の量';

      modButton.addEventListener('click', ()=>{
        const amt = Number(input.value);
        const table = arenaField.querySelector('table');
        const row = table.dataset.row;
        const col = table.dataset.col;
        const action = arenaModDialog.dataset.action;
        arenaMod(row, col, action, amt);
        arenaModDialog.close();
      })

      input.addEventListener('keydown', (e)=>{
        if (e.key === "Enter") {
          e.preventDefault();
          const amt = Number(input.value);
          const table = arenaField.querySelector('table');
          const row = table.dataset.row;
          const col = table.dataset.col;
          const action = arenaModDialog.dataset.action;
          arenaMod(row, col, action, amt);
          arenaModDialog.close();
        }
      })

      div.append(input, modButton);
      arenaModDialog.append(div, p);
    })();

    async function arenaMod(row, col, action, amt){
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `row=${row}&col=${col}&action=${action}&amt=${amt}`
      };
      try{
        const url = '/teamvol/' + window.location.search;
        const res = await fetch(url, options);
        if(!res.ok) throw new Error('/teamvol/ failed to load');
        const text = await res.text();
        if(text.includes('資源パックを開ける')) {
          open('/craft', '_blank');
          return;
        }
        if(text !== '改造成功') throw new Error(text);
        wood = wood - 25 * Math.trunc(amt);
        steel = steel - 25 * Math.trunc(amt);
        arenaResult.textContent = text;
        arenaResult.show();
      } catch (e) {
        arenaResult.textContent = e;
        arenaResult.show();
      }
    }
  })();

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
  (()=>{
    if (settings.arenaResultHeight) {
      arenaResult.style.height = settings.arenaResultHeight;
      arenaResult.style.maxHeight = '100vh';
    } else {
      arenaResult.style.height = '60vh';
      arenaResult.style.maxHeight = '640px';
    }

    if (settings.arenaResultWidth) {
      arenaResult.style.width = settings.arenaResultWidth;
      arenaResult.style.maxWidth = '100vw';
    } else {
      arenaResult.style.width = '60%';
      arenaResult.style.maxWidth = '480px';
    }

    if (settings.arenaResultPosition === 'left') {
      arenaResult.style.left = settings.arenaResultPositionLength || '0';
    } else {
      arenaResult.style.left = settings.arenaResultPositionLength || 'auto';
    }
  })();

  window.addEventListener('mousedown', (event) => {
    if (!arenaResult.contains(event.target) && !rangeAttackProcessing) arenaResult.close();
    if (!arenaModDialog.contains(event.target)) arenaModDialog.close();
    if (!settingsDialog.contains(event.target)) settingsDialog.close();
    if (!panel.contains(event.target)) panel.style.display = 'none';
  });

  document.body.append(arenaResult);
  document.body.append(arenaField);

  // --- 新仕様対応のグリッド生成ロジック追加 ---
  if (!document.querySelector('.grid') && document.querySelector('.gridCanvasOuter')) {
    const gridOuter = document.querySelector('.gridCanvasOuter');
    let GRID_SIZE = 16;
    let cellColors = {};
    const scripts = document.querySelectorAll('script');
    for (let s of scripts) {
      if (s.textContent.includes('const cellColors =')) {
        const cellColorsMatch = s.textContent.match(/const cellColors = ({.+?});/s);
        if (cellColorsMatch) {
          const validJsonStr = cellColorsMatch[1].replace(/'/g, '"').replace(/,\s*}/, '}');
          cellColors = JSON.parse(validJsonStr);
        }
        const gridMatch = s.textContent.match(/const GRID_SIZE = (\d+);/);
        if (gridMatch) GRID_SIZE = parseInt(gridMatch[1]);
        break;
      }
    }

    const wrap = document.getElementById('gridWrap');
    if (wrap) wrap.style.display = 'none';

    const newGrid = document.createElement('div');
    newGrid.className = 'grid';
    newGrid.style.display = 'grid';
    newGrid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 35px)`;
    newGrid.style.gridTemplateRows = `repeat(${GRID_SIZE}, 35px)`;
    newGrid.style.gap = '2px';

    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = i;
        cell.dataset.col = j;
        cell.style.width = '30px';
        cell.style.height = '30px';
        cell.style.border = '1px solid #ccc';
        cell.style.cursor = 'pointer';
        cell.style.transition = 'background-color 0.3s';
        const cellKey = `${i}-${j}`;
        cell.style.backgroundColor = cellColors[cellKey] ? cellColors[cellKey] : 'transparent';
        newGrid.appendChild(cell);
      }
    }
    gridOuter.appendChild(newGrid);
  }
  // --- ここまで ---

  const grid = document.querySelector('.grid');
  if(grid) {
    grid.parentNode.style.height = null;
    grid.style.maxWidth = '100%';
  }

  const table = document.querySelector('table');
  if(table) {
    table.parentNode.style.maxWidth = '100%';
    table.parentNode.style.overflow = 'auto';
    table.parentNode.style.height = '60vh';
  }

  //-- settings --//
  const settingsDialog = document.createElement('dialog');
  settingsDialog.style.position = 'fixed';
  settingsDialog.style.top = '0';
  settingsDialog.style.background = '#f0f0f0';
  settingsDialog.style.border = 'solid 1px #000';
  settingsDialog.style.padding = '2px';
  settingsDialog.style.margin = '0';
  settingsDialog.style.zIndex = '2';
  settingsDialog.style.textAlign = 'left';
  (()=>{
    if (settings.settingsPanelPosition === 'left') settingsDialog.style.left = '0';
    else settingsDialog.style.left = 'auto';

    if (settings.settingsPanelWidth) {
      settingsDialog.style.width = settings.settingsPanelWidth;
      settingsDialog.style.minWidth = '20vw';
      settingsDialog.style.maxWidth = '100vw';
    } else {
      settingsDialog.style.width = '400px';
      settingsDialog.style.maxWidth = '75vw';
    }

    if (settings.settingsPanelHeight) {
      settingsDialog.style.height = settings.settingsPanelHeight;
      settingsDialog.style.maxHeight = '100vh';
      settingsDialog.style.minHeight = '20vw';
    } else {
      settingsDialog.style.height = '96vh';
    }
  })();

  (()=>{
    const button = document.createElement('button');
    button.type = 'button';
    button.style.borderRadius = 'unset';
    button.style.border = 'solid 1px #000';
    button.style.background = '#ccc';
    button.style.color = '#000';
    button.style.margin = '2px';
    button.style.height = '42px';
    button.style.lineHeight = '1';
    button.style.whiteSpace = 'nowrap';
    button.style.overflowX = 'hidden';

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.height = '100%';
    container.style.color = '#000';

    const header = document.createElement('div');
    header.style.display = 'flex';

    const h2 = document.createElement('h2');
    h2.textContent = '設定'
    h2.style.fontSize = '1.2rem';
    h2.style.margin = '2px';

    const closeButton = button.cloneNode();
    closeButton.textContent = '×';
    closeButton.style.marginLeft = 'auto';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.height = '40px';
    closeButton.style.width = '40px';
    closeButton.style.fontSize = '32px';
    closeButton.style.lineHeight = '1';
    closeButton.addEventListener('click', ()=>{
      settingsDialog.close();
    })

    const settingsMenu = document.createElement('div');
    settingsMenu.style.flexGrow = '1';
    settingsMenu.style.overflowY = 'auto';
    settingsMenu.style.overflowX = 'hidden';

    const settingsButtons = document.createElement('div');
    settingsButtons.style.display = 'flex';

    (()=>{
      const saveButton = button.cloneNode();
      saveButton.textContent = '保存';
      saveButton.addEventListener('click', ()=>{
        const settingElements = settingsMenu.querySelectorAll('[data-setting]');
        settingElements.forEach(elm => {
          if (elm.dataset.type === 'value') {
            if(elm.value !== '') settings[elm.dataset.setting] = elm.value;
            else settings[elm.dataset.setting] = null;
          }
          if (elm.dataset.type === 'unit') {
            const input = elm.querySelector('input');
            const unit = elm.querySelector('select');
            if(input.value !== '') settings[elm.dataset.setting] = input.value + unit.value;
            else settings[elm.dataset.setting] = null;
          }
        })
        localStorage.setItem('aat_settings', JSON.stringify(settings));
        location.reload();
      })

      const cancelButton = button.cloneNode();
      cancelButton.textContent = 'キャンセル';
      cancelButton.addEventListener('click', ()=>{
        refreshSettings();
        settingsDialog.close();
      })
      function refreshSettings (){
        const settingElements = settingsMenu.querySelectorAll('[data-setting]');
        settingElements.forEach(elm => {
          if (elm.dataset.type === 'value') {
            if (settings[elm.dataset.setting]) elm.value = settings[elm.dataset.setting];
            else if (elm.tagName === 'SELECT') elm.selectedIndex = 0;
            else elm.value = '';
          }
          if (elm.dataset.type === 'unit') {
            const value = settings[elm.dataset.setting];
            const input = elm.querySelector('input');
            const unit = elm.querySelector('select');
            if (value) {
              const match = value.match(/(\d+)(\D+)/);
              input.value = match[1];
              unit.value = match[2];
            } else {
              input.value = '';
              unit.selectedIndex = 0;
            }
          }
        })
      }
      settingsButtons.append(saveButton, cancelButton);

      const container = document.createElement('div');
      container.style.background = 'none';
      container.style.color = '#000';
      container.style.padding = '0';
      container.style.margin = '2px';
      container.style.border = 'none';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      const h3 = document.createElement('h3');
      h3.style.margin = '8px 0';
      h3.style.fontSize = '1.1em';
      h3.style.textDecoration = 'underline';
      const select = document.createElement('select');
      select.style.background = '#ddd';
      select.style.color = '#000';
      select.style.lineHeight = '1';
      select.style.width = 'fit-content';
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.justifyContent = 'space-between';
      wrapper.style.whiteSpace = 'nowrap';
      wrapper.style.padding = '0 2px';
      const span = document.createElement('span');
      span.style.flexGrow = '1';
      span.style.overflowX = 'auto';

      function addHeader (text, elm) {
        const header = h3.cloneNode();
        header.textContent = text;
        elm.append(header);
      }
      function createOptions (select, items){
        if (Array.isArray(items)) items.forEach(value => select.add(new Option(value, value)));
        else if (typeof items === 'object' && items !== null) {
          Object.entries(items).forEach(([key, value]) => select.add(new Option(value, key)));
        }
      }
      function wrappingItems (text, elm, parent){
        const wrapper_ = wrapper.cloneNode();
        const span_ = span.cloneNode();
        span_.textContent = text;
        wrapper_.append(span_, elm);
        parent.append(wrapper_);
      }
      const widthUnit = select.cloneNode();
      const heightUnit = select.cloneNode();
      createOptions(widthUnit, ['px','%','vw']);
      createOptions(heightUnit, ['px','%','vh']);
      const number = document.createElement('input');
      number.type = 'number';
      number.style.background = '#ddd';
      number.style.color = '#000';
      number.style.height = '2em';
      number.style.width = '4em';

      const toolbar = container.cloneNode();
      addHeader('toolbar', toolbar);
      const arenaResult = container.cloneNode();
      addHeader('アリーナログ', arenaResult);
      const arenaField = container.cloneNode();
      addHeader('アリーナ情報', arenaField);
      const gridPanel = container.cloneNode();
      addHeader('グリッド', gridPanel);
      const settingsPanel = container.cloneNode();
      addHeader('設定パネル', settingsPanel);
      const equipPanel = container.cloneNode();
      addHeader('装備パネル', equipPanel);

      const settingItems = {
        toolbarPosition: { text: '位置:', type: 'select', options: { left:'左寄せ', right:'右寄せ', center:'中央寄せ' }, parent: toolbar },
        toolbarPositionLength: { text: '端の距離:', type: 'width', parent: toolbar },
        arenaResultScrollPosition: { text: 'スクロール位置:', type: 'select', options: { top:'上', bottom:'下' }, parent: arenaResult },
        arenaResultBottom: { text: '下部の距離:', type: 'height', parent: arenaResult },
        arenaResultPosition: { text: '位置:', type: 'select', options: { right:'右寄せ', left:'左寄せ' }, parent: arenaResult },
        arenaResultPositionLength: { text: '左端からの距離:', type: 'width', parent: arenaResult },
        arenaResultHeight: { text: 'ログの高さ:', type: 'height', parent: arenaResult },
        arenaResultWidth: { text: 'ログの横幅:', type: 'width', parent: arenaResult },
        arenaFieldBottom: { text: '下部の距離:', type: 'height', parent: arenaField },
        arenaFieldPosition: { text: '位置:', type: 'select', options: { left:'左寄せ', right:'右寄せ', center:'中央寄せ' }, parent: arenaField },
        arenaFieldPositionLength: { text: '端からの距離:', type: 'width', parent: arenaField },
        arenaFieldWidth: { text: '横幅:', type: 'width', parent: arenaField },
        gridColumns: { text: '1行の最大セル数:', type: 'number', parent: gridPanel },
        settingsPanelPosition: { text: '位置', type: 'select', options: { right:'右寄せ', left:'左寄せ' }, parent: settingsPanel },
        settingsPanelHeight: { text: '高さ', type: 'height', parent: settingsPanel },
        settingsPanelWidth: { text: '横幅', type: 'width', parent: settingsPanel },
        equipPanelPosition: { text: '位置', type: 'select', options: { right:'右寄せ', left:'左寄せ' }, parent: equipPanel },
        equipPanelHeight: { text: '高さ', type: 'height', parent: equipPanel },
        equipPanelWidth: { text: '横幅', type: 'width', parent: equipPanel }
      };

      Object.entries(settingItems).forEach(([key,item]) => {
        if (item.type === 'select') {
          const elm = select.cloneNode();
          elm.dataset.setting = key;
          elm.dataset.type = 'value';
          createOptions(elm, item.options);
          wrappingItems(item.text, elm, item.parent);
        } else if (item.type === 'number') {
          const elm = number.cloneNode();
          elm.dataset.setting = key;
          elm.dataset.type = 'value';
          wrappingItems(item.text, elm, item.parent);
        } else if (item.type === 'width') {
          const elm = document.createElement('div');
          elm.dataset.setting = key;
          elm.dataset.type = 'unit';
          elm.append(number.cloneNode(), widthUnit.cloneNode(true));
          wrappingItems(item.text, elm, item.parent);
        } else if (item.type === 'height') {
          const elm = document.createElement('div');
          elm.dataset.setting = key;
          elm.dataset.type = 'unit';
          elm.append(number.cloneNode(), heightUnit.cloneNode(true));
          wrappingItems(item.text, elm, item.parent);
        }
      })

      settingsMenu.append(toolbar, arenaResult, arenaField, gridPanel, settingsPanel, equipPanel);
      refreshSettings();
    })();

    const footer = document.createElement('div');
    footer.style.fontSize = '80%';
    footer.style.textAlign = 'right';

    (()=>{
      const link = document.createElement('a');
      link.style.color = '#666';
      link.style.textDecoration = 'underline';
      link.textContent = 'arena assist tool - v1.3';
      link.href = 'https://donguri-k.github.io/tools/arena-assist-tool';
      link.target = '_blank';
      const author = document.createElement('input');
      author.value = '作者 [ID: 7234e634]';
      author.style.color = '#666';
      author.style.background = 'none';
      author.style.margin = '2px';
      author.style.padding = '2px';
      author.style.width = 'fit-content';
      author.readOnly = 'true';
      author.addEventListener('click',()=>{
        author.select();
        navigator.clipboard.writeText('7234e634');
      })
      footer.append(link, author);
    })();

    header.append(h2, closeButton);
    container.append(header, settingsButtons, settingsMenu, footer)
    settingsDialog.append(container);
  })();

  document.body.append(settingsDialog);

  //-- 装備 --//
  const panel = document.createElement('div');
  panel.style.position = 'fixed';
  panel.style.top = '0';
  panel.style.background = '#f0f0f0';
  panel.style.border = 'solid 1px #000';
  panel.style.padding = '2px';
  panel.style.zIndex = '1';
  panel.style.textAlign = 'left';
  panel.style.display = 'none';
  panel.style.flexDirection = 'column';
  (()=>{
    if (settings.equipPanelPosition === 'left') panel.style.left = '0';
    else panel.style.right = '0';

    if (settings.equipPanelWidth) {
      panel.style.width = settings.equipPanelWidth;
      panel.style.minWidth = '20vw';
      panel.style.maxWidth = '100vw';
    } else {
      panel.style.width = '400px';
      panel.style.maxWidth = '75vw';
    }

    if (settings.equipPanelHeight) {
      panel.style.height = settings.equipPanelHeight;
      panel.style.maxHeight = '100vh';
      panel.style.minHeight = '20vw';
    } else {
      panel.style.height = '96vh';
    }
  })();

  // ====== （装備パネル以下はあなたの元コードそのまま） ======
  // 長いので省略せず全て貼る必要があるなら「省略なしで続き」って言って。
  // ただ、今回の不具合（%/時間）には関係ないので、ここから下は元のままでOK。

  // ---- ここから先は元コードをそのまま貼り続けてください ----
  // （あなたが既に持っている v1.3 の「装備パネル〜末尾」までをコピペ）
  // ---- ここまで ----


  // ============================================================
  // ★★★ ここが今回の本命：progress bar を完全に自作して%を確実に出す ★★★
  // ============================================================
  function drawProgressBar(){
    fetch('https://donguri.5ch.net/')
      .then(res => res.ok ? res.text() : Promise.reject('res.ng'))
      .then(text => {
        const doc = new DOMParser().parseFromString(text, 'text/html');

        // まず stat-block を取る（木材/鉄もここから拾う）
        const statBlock = doc.querySelector('.stat-block');
        if(!statBlock) return;

        // % を拾う（どこかに "NN%" がある前提で、最初の1個を採用）
        const pm = statBlock.textContent.match(/(\b\d{1,3})\s*%/);
        if(!pm) return;

        let percentage = parseInt(pm[1], 10);
        if (!Number.isFinite(percentage)) return;
        percentage = Math.max(0, Math.min(100, percentage));

        // 時間表示（あなたのロジック踏襲）
        let str, min, totalSec, sec, margin;
        if (percentage === 0 || percentage === 50) {
          str = '（マップ更新時）';
        } else {
          if (percentage === 100) {
            min = 0; sec = 20; margin = 10;
          } else {
            totalSec = (percentage < 50)
              ? (50 - percentage) * 36
              : (100 - percentage) * 36 + 10;
            min = Math.trunc(totalSec / 60);
            sec = totalSec % 60;
            margin = 20;
          }
          str = `（マップ更新まで${min}分${sec}秒 ±${margin}秒）`;
        }

        // 表示用バーを自作（%を外側・内側両方に表示）
        const wrap = document.createElement('div');
        wrap.style.display = 'block';
        wrap.style.whiteSpace = 'nowrap';
        wrap.style.color = '#000';
        wrap.style.padding = '2px';

        const label = document.createElement('div');
        label.textContent = `${str}　進捗:${percentage}%`;

        const barOuter = document.createElement('div');
        barOuter.style.display = 'inline-block';
        barOuter.style.width = '400px';
        barOuter.style.maxWidth = '100vw';
        barOuter.style.height = '20px';
        barOuter.style.background = '#ccc';
        barOuter.style.borderRadius = '8px';
        barOuter.style.overflow = 'hidden';
        barOuter.style.marginTop = '5px';

        const barInner = document.createElement('div');
        barInner.style.height = '100%';
        barInner.style.width = `${percentage}%`;
        barInner.style.background = '#428bca';
        barInner.style.color = '#fff';
        barInner.style.textAlign = 'right';
        barInner.style.paddingRight = '6px';
        barInner.style.boxSizing = 'border-box';
        barInner.style.lineHeight = '20px';
        barInner.style.fontSize = '14px';
        barInner.style.whiteSpace = 'nowrap';
        barInner.textContent = `${percentage}%`;

        barOuter.append(barInner);
        wrap.append(label, barOuter);

        progressBarContainer.replaceChildren(wrap);

        // 木材/鉄
        const woodMatch = statBlock.textContent.match(/木材の数: (\d+)/);
        const steelMatch = statBlock.textContent.match(/鉄の数: (\d+)/);
        if(woodMatch) wood = woodMatch[1];
        if(steelMatch) steel = steelMatch[1];
      })
      .catch(e => console.error(e));
  }

  // 初回＋定期更新
  drawProgressBar();
  setInterval(drawProgressBar, 18000);

})();
