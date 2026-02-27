// ==UserScript==
// @name         donguri arena assist tool
// @version      1.3
// @description  fix arena ui and add functions (updated specs & removed auto join)
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
  let wood, steel

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
          e.preventDefault(); // これが無いとdialogが閉じない
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
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
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
    if (!arenaResult.contains(event.target) && !rangeAttackProcessing) {
      arenaResult.close();
    }
    if (!arenaModDialog.contains(event.target)) {
      arenaModDialog.close();
    }
    if (!settingsDialog.contains(event.target)) {
      settingsDialog.close();
    }
    if (!panel.contains(event.target)) {
      panel.style.display = 'none';
    }
  });
  document.body.append(arenaResult);
  document.body.append(arenaField);
  
  // --- 新仕様対応のグリッド生成ロジック追加 ---
  if (!document.querySelector('.grid') && document.querySelector('.gridCanvasOuter')) {
    const gridOuter = document.querySelector('.gridCanvasOuter');
    let GRID_SIZE = 16; // 初期値
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
        if (gridMatch) {
          GRID_SIZE = parseInt(gridMatch[1]);
        }
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
        if (cellColors[cellKey]) {
          cell.style.backgroundColor = cellColors[cellKey];
        } else {
          cell.style.backgroundColor = 'transparent';
        }
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
    if (settings.settingsPanelPosition === 'left') {
      settingsDialog.style.left = '0';
    } else {
      settingsDialog.style.left = 'auto';
    }

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
            if(elm.value !== '') {
              settings[elm.dataset.setting] = elm.value;
            } else {
              settings[elm.dataset.setting] = null;
            }
          }
          if (elm.dataset.type === 'unit') {
            const input = elm.querySelector('input');
            const unit = elm.querySelector('select');
            if(input.value !== '') {
              settings[elm.dataset.setting] = input.value + unit.value;
            } else {
              settings[elm.dataset.setting] = null;
            }
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
        if (Array.isArray(items)) {
          items.forEach(value => select.add(new Option(value, value)));
        } else if (typeof items === 'object' && items !== null) {
          Object.entries(items)
            .forEach(([key, value]) => select.add(new Option(value, key)));
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
        toolbarPosition: {
          text: '位置:',
          type: 'select',
          options: {
            left: '左寄せ',
            right: '右寄せ',
            center: '中央寄せ'
          },
          parent: toolbar
        },
        toolbarPositionLength: {
          text: '端の距離:',
          type: 'width',
          parent: toolbar
        },
        arenaResultScrollPosition: {
          text: 'スクロール位置:',
          type: 'select',
          options: {
            top: '上',
            bottom: '下'
          },
          parent: arenaResult
        },
        arenaResultBottom: {
          text: '下部の距離:',
          type: 'height',
          parent: arenaResult
        },
        arenaResultPosition: {
          text: '位置:',
          type: 'select',
          options: {
            right: '右寄せ',
            left: '左寄せ'
          },
          parent: arenaResult
        },
        arenaResultPositionLength: {
          text: '左端からの距離:',
          type: 'width',
          parent: arenaResult
        },
        arenaResultHeight: {
          text: 'ログの高さ:',
          type: 'height',
          parent: arenaResult
        },
        arenaResultWidth: {
          text: 'ログの横幅:',
          type: 'width',
          parent: arenaResult
        },
        arenaFieldBottom: {
          text: '下部の距離:',
          type: 'height',
          parent: arenaField
        },
        arenaFieldPosition: {
          text: '位置:',
          type: 'select',
          options: {
            left: '左寄せ',
            right: '右寄せ',
            center: '中央寄せ'
          },
          parent: arenaField
        },
        arenaFieldPositionLength: {
          text: '端からの距離:',
          type: 'width',
          parent: arenaField
        },
        arenaFieldWidth: {
          text: '横幅:',
          type: 'width',
          parent: arenaField
        },
        gridColumns: {
          text: '1行の最大セル数:',
          type: 'number',
          parent: gridPanel
        },
        settingsPanelPosition: {
          text: '位置',
          type: 'select',
          options: {
            right: '右寄せ',
            left: '左寄せ'
          },
          parent: settingsPanel
        },
        settingsPanelHeight: {
          text: '高さ',
          type: 'height',
          parent: settingsPanel
        },
        settingsPanelWidth: {
          text: '横幅',
          type: 'width',
          parent: settingsPanel
        },
        equipPanelPosition: {
          text: '位置',
          type: 'select',
          options: {
            right: '右寄せ',
            left: '左寄せ'
          },
          parent: equipPanel
        },
        equipPanelHeight: {
          text: '高さ',
          type: 'height',
          parent: equipPanel
        },
        equipPanelWidth: {
          text: '横幅',
          type: 'width',
          parent: equipPanel
        }
      }

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
    if (settings.equipPanelPosition === 'left') {
      panel.style.left = '0';
    } else {
      panel.style.right = '0';
    }
  
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

  (()=>{
    const input = document.createElement('input');
    const button = document.createElement('button');
    button.type = 'button';
    button.style.borderRadius = 'unset';
    button.style.border = 'solid 1px #000';
    button.style.background = '#ccc';
    button.style.color = '#000';
    button.style.margin = '2px';
    button.style.width = '6em';
    button.style.fontSize = '65%';
    button.style.whiteSpace = 'nowrap';
    button.style.overflow = 'hidden';
    button.style.lineHeight = '1';

    let currentMode = 'equip';
    const presetList = document.createElement('ul');
    presetList.style.listStyle = 'none';
    presetList.style.margin = '0';
    presetList.style.padding = '0';
    presetList.style.borderTop = 'solid 1px #000';
    presetList.style.overflowY = 'auto';
    presetList.style.flexGrow = '1';
    showEquipPreset();

    const resetCurrentEquip = document.createElement('div');
    resetCurrentEquip.textContent = '装備情報をリセット';
    resetCurrentEquip.style.borderTop = 'solid 1px #000';
    resetCurrentEquip.style.cursor = 'pointer';
    resetCurrentEquip.style.color = '#a62';
    resetCurrentEquip.style.whiteSpace = 'nowrap';
    resetCurrentEquip.style.overflow = 'hidden';
    resetCurrentEquip.addEventListener('click', ()=>{
      localStorage.removeItem('current_equip');
      const stat = document.querySelector('.equip-preset-stat');
      stat.textContent = '現在の装備情報を初期化';
      weaponTable = null;
      armorTable = null;
      necklaceTable = null;
    })

    presetList.addEventListener('click', (event)=>{
      const presetLi = event.target.closest('li');
      if(!presetLi) return;
      const presetName = presetLi.querySelector('span').textContent;
      if(currentMode === 'equip') {
        setPresetItems(presetName);
      } else if (currentMode === 'remove') {
        removePresetItems(presetName);
      } else if (currentMode === 'edit') {
        alert('未実装');
      }
    });

    (()=>{
      const div = document.createElement('div');
      div.style.marginTop = '2px';
      div.style.lineHeight = 'normal';
      const buttonsContainer = document.createElement('div');
      buttonsContainer.style.display = 'flex';
  
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
        panel.style.display = 'none';
      })
  
      const addButton = button.cloneNode();
      addButton.textContent = '追加';
      addButton.addEventListener('click', async()=>{
        selectedEquips = {id:[], rank:[]};
        addButton.disabled = true;
        await showEquipList();
        addButton.disabled = false;
      })

      const removeButton = button.cloneNode();
      removeButton.textContent = '削除';
      removeButton.dataset.text = '削除';
      removeButton.dataset.mode = 'remove';
      
      const backupButton = button.cloneNode();
      backupButton.innerText = 'バック\nアップ';

      const backupDialog = document.createElement('dialog');
      backupDialog.style.background = '#fff';
      backupDialog.style.color = '#000';
      backupDialog.style.left = 'auto';
      (()=>{
        const textarea = document.createElement('textarea');
        textarea.style.background = '#fff';
        textarea.style.color = '#000';
        textarea.style.whiteSpace = 'nowrap';
        textarea.style.width = '70vw';
        textarea.style.height = '50vh';
        textarea.style.overflowX = 'auto';

        const div = document.createElement('div');
        const saveButton = button.cloneNode();
        saveButton.textContent = '保存';
        saveButton.addEventListener('click', ()=>{
          const isSuccess = importEquipPresets(textarea.value);
          if(isSuccess) backupDialog.close();
        });
        const copyButton = button.cloneNode();
        copyButton.textContent = 'コピー';
        copyButton.addEventListener('click', ()=>{navigator.clipboard.writeText(textarea.value).then(alert('copy'));})
        const closeButton = button.cloneNode();
        closeButton.textContent = '閉じる';
        closeButton.addEventListener('click', ()=>{backupDialog.close()})
        div.append(saveButton, copyButton, closeButton);
        backupDialog.append(textarea, div);
        backupButton.addEventListener('click', ()=>{
          const data = localStorage.getItem('equipPresets');
          if(data) {
            const json = JSON.parse(data);
            const formattedString = Object.entries(json)
              .map(([key, value]) => {return `  "${key.replace(/"/g,'\\"')}": ${JSON.stringify(value)}`;})
              .join(',\n');
            textarea.value = `{\n${formattedString}\n}`;
          }
          backupDialog.showModal();
        })
      })();

      [removeButton].forEach(button => {
        button.addEventListener('click', () => {
          const mode = button.dataset.mode;
          if (currentMode === mode) {
            resetMode(); 
            return;
          }
          setMode(mode, button);
        })
      });

      function setMode(mode, button) {
        resetMode(); 
        currentMode = mode;
        button.textContent = '終了';
        button.classList.add('active');
        if(mode === 'remove') stat.textContent = '削除したいものを選択';
        else if (mode === 'edit') stat.textContent = 'クリックで編集';
      }

      function resetMode() {
        if (currentMode) {
          const activeButton = document.querySelector('.active');
          if (activeButton) {
            activeButton.textContent = activeButton.dataset.text;
            activeButton.classList.remove('active');
          }
        }
        currentMode = 'equip';
        stat.textContent = '';
      }

      const stat = document.createElement('p');
      stat.style.margin = '0';
      stat.style.height = '24px';
      stat.style.fontSize = '16px';
      stat.style.whiteSpace = 'nowrap';
      stat.style.overflow = 'hidden';
      stat.classList.add('equip-preset-stat');
  
      buttonsContainer.append(addButton, removeButton, backupButton, closeButton);
      div.append(buttonsContainer, backupDialog, stat);
      panel.append(div);
    })();
  
    panel.append(resetCurrentEquip, presetList);
    document.body.append(panel);

    // equip item table dialog
    const equipField = document.createElement('dialog');
    equipField.style.background = '#fff';
    equipField.style.color = '#000';
    equipField.style.maxWidth = '90vw';
    equipField.style.height = '95vh';
    const closeButton = button.cloneNode();
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.height = '40px';
    closeButton.style.width = '40px';
    closeButton.style.fontSize = '32px';
    closeButton.style.top = '2px';
    closeButton.style.right = '2px';
    closeButton.style.lineHeight = '1';
    closeButton.addEventListener('click', ()=>{equipField.close()});
    const tableContainer = document.createElement('div');
    tableContainer.style.height = '75vh';
    tableContainer.style.overflow = 'auto';
    const rankSelect = document.createElement('select');
    rankSelect.style.maxWidth = '64px';
    const ranks = ['N','R','SR','SSR','UR'];
    ranks.forEach(rank => {
      const option = document.createElement('option');
      option.textContent = rank;
      option.value = rank;
      rankSelect.append(option);
    })
    rankSelect.addEventListener('change', ()=>{filterItemsByRank(rankSelect.value)});
    const bar = document.createElement('div');
    bar.style.textAlign = 'center';
    const p = document.createElement('p');
    p.classList.add('equip-preset-selected');
    p.style.background = '#fff';
    p.style.color = '#000';
    p.style.margin = '2px';
    p.style.height = '28px';

    const equipSwitchButton = button.cloneNode();
    equipSwitchButton.textContent = '?武器';
    equipSwitchButton.style.width = '4em';
    equipSwitchButton.style.height = '42px';
    equipSwitchButton.style.fontSize = '';

    equipSwitchButton.style.whiteSpace = 'nowrap';
    equipSwitchButton.addEventListener('click', (event)=>{
      if(!weaponTable.style.display) {
        weaponTable.style.display = 'none';
        armorTable.style.display = '';
        necklaceTable.style.display = 'none';
        event.target.textContent = '?防具';
      } else if (!armorTable.style.display) {
        weaponTable.style.display = 'none';
        armorTable.style.display = 'none';
        necklaceTable.style.display = '';
        event.target.textContent = '?首';
      } else if (!necklaceTable.style.display) {
        weaponTable.style.display = '';
        armorTable.style.display = 'none';
        necklaceTable.style.display = 'none';
        event.target.textContent = '?武器';
      }
    });

    // register
    const registerButton = button.cloneNode();
    registerButton.textContent = '登録';
    registerButton.style.width = '4em';
    registerButton.style.height = '42px';
    registerButton.style.fontSize = '';

    (()=>{
      const dialog = document.createElement('dialog');
      dialog.style.background = '#fff';
      dialog.style.border = 'solid 1px #000';
      dialog.style.color = '#000';
      dialog.style.textAlign = 'center';
      const presetNameInput = document.createElement('input');
      presetNameInput.placeholder = 'プリセット名';
      presetNameInput.style.background = '#fff';
      presetNameInput.style.color = '#000';
      const p = document.createElement('p');
      p.textContent = '同名のプリセットが存在する場合は上書きされます。';
      p.style.margin = '0';
      const confirmButton = button.cloneNode();
      confirmButton.textContent = '保存';
      confirmButton.addEventListener('click', ()=>{
        if(presetNameInput.value.trim() === '') return;
        saveEquipPreset(presetNameInput.value.substring(0,32), selectedEquips);
        dialog.close();
        presetNameInput.value = '';
      })
      presetNameInput.addEventListener('keydown', (e)=>{
        if (e.key === "Enter") {
          e.preventDefault(); // これが無いとdialogが閉じない
          if(presetNameInput.value.trim() === '') return;
          saveEquipPreset(presetNameInput.value.substring(0,32), selectedEquips);
          dialog.close();
          presetNameInput.value = '';  
        }
      })
      const cancelButton = button.cloneNode();
      cancelButton.textContent = 'キャンセル';
      cancelButton.addEventListener('click', ()=>{dialog.close()});
      dialog.append(presetNameInput, confirmButton, cancelButton, p);
      equipField.append(dialog);
      registerButton.addEventListener('click', ()=>{
        if(!selectedEquips.id[0] && !selectedEquips.id[1] && !selectedEquips.id[2]) {
          alert('装備が未選択です');
          return;
        }
        dialog.showModal();
      });
    })();

    bar.append(rankSelect, equipSwitchButton, registerButton, p);
    equipField.append(bar, tableContainer, closeButton);
    panel.append(equipField);

    let weaponTable, armorTable, necklaceTable;
    let selectedEquips = {id:[], rank:[]};

    function sortTable(table){
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.rows);
      rows.sort((a,b) => {
        const nameA = a.cells[0].textContent;
        const nameB = b.cells[0].textContent;
        return nameA.localeCompare(nameB);
      })
      rows.forEach(row => tbody.appendChild(row));
    }

    async function showEquipList(){
      if(!weaponTable || !armorTable || !necklaceTable) {
        try {
          const res = await fetch('https://donguri.5ch.net/bag');
          if(!res.ok) throw new Error('bag response error');
          const text = await res.text();
          const doc = new DOMParser().parseFromString(text, 'text/html');
          const h1 = doc.querySelector('h1');
          if(h1?.textContent !== 'アイテムバッグ') throw new Error(text);
          weaponTable = doc.querySelector('#weaponTable');
          armorTable = doc.querySelector('#armorTable');
          necklaceTable = doc.querySelector('#necklaceTable');
          if(!weaponTable || !armorTable || !necklaceTable) throw new Error('failed to find weapon/armor table');

          [weaponTable,armorTable,necklaceTable].forEach((table,index) => {
            sortTable(table);
            table.style.color = '#000';
            table.style.margin = '0';
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
              const id = row.cells[1].querySelector('a')?.href.replace('https://donguri.5ch.net/equip/','');
              row.cells[0].style.textDecorationLine = 'underline';
              row.cells[0].style.cursor = 'pointer';
              row.cells[0].dataset.id = id;
              row.cells[1].style.display = 'none';
              row.cells[2].style.display = 'none';
              if(index !== 2) {
                const modLink = row.cells[7].querySelector('a');
                if(modLink) modLink.target = '_blank';
                row.cells[9].style.display = 'none';
              } else if (index === 2) {
                row.cells[3].style.whiteSpace = 'nowrap';
                const ul = row.cells[3].querySelector('ul');
                if(ul) ul.style.padding = '0';
                row.cells[5].style.display = 'none';
              }
              row.cells[0].addEventListener('click', (event)=>{
                if(!event.target.closest('td')) return;
                const target = event.target.closest('td');
                const itemName = target.textContent;
                const rank = itemName.match(/\[(.+?)\]/)[1];
                const id = target.dataset.id;
                selectedEquips.id[index] = id;
                selectedEquips.rank[index] = rank;
                document.querySelector('.equip-preset-selected').textContent = selectedEquips.id;
              })
            })
          })
          tableContainer.append(weaponTable, armorTable, necklaceTable);
        } catch(e) {
          console.error(e);
          return;
        }
      }

      equipSwitchButton.textContent = '?武器';
      weaponTable.style.display = '';
      armorTable.style.display = 'none';
      necklaceTable.style.display = 'none';
      filterItemsByRank(rankSelect.value);
      document.querySelector('.equip-preset-selected').textContent = '';
      equipField.showModal();
    }
    function filterItemsByRank (rank){
      [weaponTable, armorTable].forEach(table => {
        table.querySelectorAll('tbody > tr').forEach(row => {
          const itemName = row.cells[0].textContent;
          row.style.display = itemName.includes(`[${rank}]`) ? null : 'none';
        })
      })
    }
    function saveEquipPreset(name, obj){
      let equipPresets = JSON.parse(localStorage.getItem('equipPresets')) || {};
      equipPresets[name] = obj;
      localStorage.setItem('equipPresets', JSON.stringify(equipPresets));
      showEquipPreset();
    }
    function showEquipPreset(){
      let equipPresets = JSON.parse(localStorage.getItem('equipPresets')) || {};
      const liTemplate = document.createElement('li');
      liTemplate.style.display = 'flex';
      liTemplate.style.justifyContent = 'space-between';
      liTemplate.style.borderBottom = 'solid 1px #000';
      liTemplate.style.color = '#428bca';
      liTemplate.style.cursor = 'pointer';
      const span1 = document.createElement('span');
      span1.style.flexGrow = '1';
      span1.style.whiteSpace = 'nowrap';
      span1.style.overflowX = 'hidden';
      const span2 = document.createElement('span');
      span2.style.whiteSpace = 'nowrap';
      span2.style.textAlign = 'right';
      span2.style.fontSize = '90%';
      liTemplate.append(span1,span2);
      const fragment = document.createDocumentFragment();
      Object.entries(equipPresets).forEach(([key, value])=>{
        const li = liTemplate.cloneNode(true);
        const span = li.querySelectorAll('span');
        span[0].textContent = key;
        span[1].textContent = value.rank.join(',');
        fragment.append(li);
      })
      presetList.replaceChildren(fragment);
    }
    function importEquipPresets(text){
      try{
        if(text.trim() === ''){
          localStorage.removeItem('equipPresets');
          showEquipPreset();
          return true;
        }
        const json = JSON.parse(text);
        localStorage.setItem('equipPresets', JSON.stringify(json));
        showEquipPreset();
        return true;
      } catch (e) {
        if (e instanceof SyntaxError) {
          alert('書式エラー');
        }
        return false;
      }

    }
    async function setPresetItems (presetName) {
      let currentEquip = JSON.parse(localStorage.getItem('current_equip')) || [];
      const stat = document.querySelector('.equip-preset-stat');
      if (stat.textContent === '装備中...') return;
      const equipPresets = JSON.parse(localStorage.getItem('equipPresets')) || [];
      const fetchPromises = equipPresets[presetName].id
        .filter(id => id !== undefined && id !== null && !currentEquip.includes(id)) // 未登録or既に装備中の部位は除外
        .map(id => fetch('https://donguri.5ch.net/equip/' + id));

      stat.textContent = '装備中...';

      try {
        const responses = await Promise.all(fetchPromises);
        const texts = await Promise.all(
          responses.map(async response => {
            if (!response.ok) {
              throw new Error('読み込み失敗');
            }
            return response.text();
          })
        );
        
        if(texts.includes('どんぐりが見つかりませんでした。')) {
          throw new Error('再ログインしてください');
        } else if(texts.includes('アイテムが見つかりませんでした。')) {
          throw new Error('アイテムが見つかりませんでした');
        }

        const docs = texts.map(text => new DOMParser().parseFromString(text,'text/html'));
        const titles = docs.map(doc => doc.querySelector('h1')?.textContent);
        if(titles.includes('どんぐり基地')) {
          throw new Error('再ログインしてください');
        } else if (!titles.every(title => title === 'アイテムバッグ')) {
          throw new Error('装備エラー');
        }
        stat.textContent = '完了: ' + presetName;
        localStorage.setItem('current_equip', JSON.stringify(equipPresets[presetName].id));  
      } catch (e) {
        stat.textContent = e;
        localStorage.removeItem('current_equip');
      }
    }
    function removePresetItems(presetName) {
      const userConfirmed = confirm(presetName + ' を削除しますか？');
      if(!userConfirmed) return;
      const stat = document.querySelector('.equip-preset-stat');
      const equipPresets = JSON.parse(localStorage.getItem('equipPresets')) || [];
      if(!equipPresets || !equipPresets[presetName]) {
        stat.textContent = '';
        return;
      }
      delete equipPresets[presetName];
      localStorage.setItem('equipPresets', JSON.stringify(equipPresets));
      showEquipPreset();
    }  
  })();

  function scaleContentsToFit(container, contents){
    const containerWidth = container.clientWidth;
    const contentsWidth = contents.scrollWidth;
    if (contentsWidth === 0) return;
    const scaleFactor = Math.min(1, containerWidth / contentsWidth);
    contents.style.transform = `scale(${scaleFactor})`;
    contents.style.transformOrigin = 'top left';

    const scaledHeight = contents.scrollHeight * scaleFactor;
  
    contents.style.height = `${scaledHeight}px`;
  }

  async function refreshArenaInfo() {
    const refreshedCells = [];
  
    try {
      const res = await fetch('');
      if (!res.ok) throw new Error('res.ng');
  
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      
      const h1Text = doc.querySelector('h1')?.textContent || '';
      const divText = doc.querySelector('header > div')?.textContent || '';
      if (h1Text !== 'どんぐりチーム戦い' && !divText.includes('どんぐりチーム戦い')) {
         throw new Error('title.ng info');
      }
  
      const currentCells = grid.querySelectorAll('.cell');
      
      let scriptContent = '';
      for (let s of doc.querySelectorAll('script')) {
        if (s.textContent.includes('const cellColors =')) {
          scriptContent = s.textContent;
          break;
        }
      }
      
      const cellColorsString = scriptContent.match(/const cellColors = ({.+?})/s)[1];
      const validJsonStr = cellColorsString.replace(/'/g, '"').replace(/,\s*}/, '}');
      const cellColors = JSON.parse(validJsonStr);
  
      let rows = 8, cols = 8;
      const gridMatch = scriptContent.match(/const GRID_SIZE = (\d+);/);
      if (gridMatch) {
        rows = cols = parseInt(gridMatch[1]);
      } else {
        const newGrid = doc.querySelector('.grid');
        if (newGrid) {
          rows = Number(newGrid.style.gridTemplateRows.match(/repeat\((\d+), 35px\)/)[1]);
          cols = Number(newGrid.style.gridTemplateColumns.match(/repeat\((\d+), 35px\)/)[1]);
        }
      }
  
      if (currentCells.length !== rows * cols) {
        grid.style.gridTemplateRows = `repeat(${rows}, 35px)`;
        grid.style.gridTemplateColumns = `repeat(${cols}, 35px)`;
        grid.innerHTML = '';
  
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
  
            const cellKey = `${i}-${j}`;
            if (cellColors[cellKey]) {
              cell.style.backgroundColor = cellColors[cellKey];
            } else {
              cell.style.backgroundColor = 'transparent';
            }
  
            grid.appendChild(cell);
            refreshedCells.push(cell);
          }
        }
      } else {
        currentCells.forEach(cell => {
          const row = cell.dataset.row;
          const col = cell.dataset.col;
          const cellKey = `${row}-${col}`;

          let cellColorCode = '';
          const rgbMatchCell = cell.style.backgroundColor.match(/\d+/g);
          if (rgbMatchCell && rgbMatchCell.length >= 3) {
            cellColorCode = '#' + rgbMatchCell
              .map(v => Number(v).toString(16).toLowerCase().padStart(2, '0'))
              .join('');
          }
  
          if (cellColors[cellKey]) {
            if (cellColorCode !== cellColors[cellKey].toLowerCase()) {
              cell.style.backgroundColor = cellColors[cellKey];
              refreshedCells.push(cell);
            }
          } else if (cellColorCode !== '' && cellColorCode !== '#ffffff00' && cell.style.backgroundColor !== 'transparent') {
            cell.style.backgroundColor = 'transparent';
            refreshedCells.push(cell);
          }
          
          const rgb = cell.style.backgroundColor.match(/\d+/g);
          if (rgb && rgb.length >= 3) {
            const brightness = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
            cell.style.color = brightness > 128 ? '#000' : '#fff';
          } else {
            cell.style.color = '#000';
          }
        });
      }
  
      const tables = document.querySelectorAll('table');
      const newTables = doc.querySelectorAll('table');
      newTables.forEach((table, i) => {
        if (tables[i]) tables[i].replaceWith(table);
      });
      console.log(refreshedCells);
      return refreshedCells;
    } catch (e) {
      console.error(e);
    }
  }
  
  async function fetchAreaInfo(refreshAll){
    const refreshedCells = await refreshArenaInfo();
    grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace('35px','65px');
    grid.style.gridTemplateColumns = grid.style.gridTemplateColumns.replace('35px','105px');
    grid.parentNode.style.height = null;
    grid.parentNode.style.padding = '20px 0';

    let maxGridColumns;
    if (settings.gridColumns >= 1) {
      maxGridColumns = Math.trunc(settings.gridColumns);
    } else if (vw < 768) {
      maxGridColumns = 8;
    }
    const cols = Number(grid.style.gridTemplateColumns.match(/repeat\((\d+),/)[1]);
    if (cols > maxGridColumns) {
      grid.style.gridTemplateColumns = `repeat(${maxGridColumns}, 105px)`;
    }

    const cells = grid.querySelectorAll('.cell');
    cells.forEach(elm => {
      const hasInfo = elm.querySelector('p') !== null;
      const isRefreshed = refreshedCells.includes(elm);
      if(refreshAll || !hasInfo || isRefreshed) {
        let row = elm.dataset.row,
        col = elm.dataset.col;
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.set('r', row);
        searchParams.set('c', col);
        const url = `https://donguri.5ch.net/teambattle?${searchParams.toString()}`;
        fetch(url)
          .then(res =>
            res.ok?res.text():Promise.reject('res.ng')
          )
          .then(text => {
            let doc = new DOMParser().parseFromString(text, 'text/html');
            const h1Text = doc.querySelector('h1')?.textContent || '';
            const divText = doc.querySelector('header > div')?.textContent || '';
            if (h1Text !== 'どんぐりチーム戦い' && !divText.includes('どんぐりチーム戦い')) {
              return Promise.reject(`title.ng [${row}][${col}]`);
            }
            let cond = doc.querySelector('small')?.textContent || '';
            if(!cond) return Promise.reject(`cond.ng [${row}][${col}]`);
            let holder = doc.querySelector('strong')?.textContent || '',
            shortenCond = cond.replace('[エリート]','e').replace('から','-').replace(/(まで|\[|\]|\||\s)/g,'');
            const p = [document.createElement('p'), document.createElement('p')];
            p[0].textContent = shortenCond;
            p[1].textContent = holder;
            p[0].style.margin = '0';
            p[1].style.margin = '0';
            const cell = elm.cloneNode();
            cell.append(p[0],p[1]);
            cell.style.overflow = 'hidden';
            cell.style.width = '100px';
            cell.style.height = '60px';
            cell.style.borderWidth = '3px';
            const rgb = cell.style.backgroundColor.match(/\d+/g);
            if(rgb && rgb.length >= 3){
              const brightness = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
              cell.style.color = brightness > 128 ? '#000' : '#fff';
            } else {
              cell.style.color = '#000';
            }
  
            cell.addEventListener('click', ()=>{
              handleCellClick (cell);
            });
            elm.replaceWith(cell);
          })
          .catch(e=>console.error(e))
      }
    })
  }

  const observer = new MutationObserver(() => {
    if(grid) scaleContentsToFit(grid.parentNode, grid);
  });
  
  if(grid) observer.observe(grid, { attributes: true, childList: true, subtree: true });

  (()=>{
    [...document.querySelectorAll('.cell')].forEach(elm => {
      const cell = elm.cloneNode();
      elm.replaceWith(cell);
      cell.addEventListener('click', ()=>{
        handleCellClick(cell);
      })
    })
  })();

  async function fetchArenaTable(row, col){
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('r', row);
    searchParams.set('c', col);
    const url = `https://donguri.5ch.net/teambattle?${searchParams.toString()}`; 
    try {
      const res = await fetch(url);
      if(!res.ok) throw new Error('res.ng');
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text,'text/html');
      const h1Text = doc.querySelector('h1')?.textContent || '';
      const divText = doc.querySelector('header > div')?.textContent || '';
      if (h1Text !== 'どんぐりチーム戦い' && !divText.includes('どんぐりチーム戦い')) {
        return Promise.reject(`title.ng`);
      }
      const table = doc.querySelector('table');
      if(!table) throw new Error('table.ng');
      showArenaTable(table);
    } catch (e) {
      console.error(e);
    }
    
    function showArenaTable (table){
      const tableRow = table.querySelector('tbody > tr');
      if(!tableRow) return;
      const coordinate = tableRow.cells[0].textContent.replace('アリーナ','').trim();
      const holderName = tableRow.cells[1].querySelector('strong');
      const equipCond = tableRow.cells[1].querySelector('small');
      const teamName = tableRow.cells[2].textContent;
      const statistics = tableRow.cells[3].textContent.match(/\d+/g);
      const modCounts = tableRow.cells[4].textContent.match(/\d+/g);
      const modders = tableRow.cells[5].textContent;

      const newTable = document.createElement('table');
      const tbody = document.createElement('tbody');
      const tr = tbody.insertRow(0);

      const cell = document.createElement('td');
      cell.style.textAlign = 'center';
      const cells = [];
      for(let i=0; i<4; i++){
        cells.push(cell.cloneNode());
        tr.append(cells[i]);
      }
      const hr = document.createElement('hr');
      hr.style.margin = '10px 0';

      cells[0].append(coordinate, hr, equipCond);
      cells[1].append(holderName, document.createElement('br'), teamName);
      cells[2].innerText = `勝:${statistics[0]}\n負:${statistics[1]}\n引:${statistics[2]}`;
      cells[3].innerText = `強化:${modCounts[0]}\n弱体:${modCounts[1]}\n${modders}人`;
      cells[3].style.whiteSpace = 'nowrap';

      const matchData = coordinate.match(/\d+/g);
      if (matchData && matchData.length >= 2) {
        newTable.dataset.row = matchData[0];
        newTable.dataset.col = matchData[1];
      } else {
        newTable.dataset.row = row;
        newTable.dataset.col = col;
      }
      newTable.style.background = '#fff';
      newTable.style.color = '#000';
      newTable.style.margin = '0';
      newTable.append(tbody);
      arenaField.querySelector('table').replaceWith(newTable);
      arenaField.show();
    }
  }

  function handleCellClick (cell){
    if (cellSelectorActivate) {
      if (cell.classList.contains('selected')) {
        cell.style.borderColor = '#ccc';
        cell.classList.remove('selected');
      } else {
        cell.style.borderColor = '#f64';
        cell.classList.add('selected');
      }
    } else if (shouldSkipAreaInfo) {
      const row = cell.dataset.row;
      const col = cell.dataset.col;
      if (arenaField.open) fetchArenaTable(row, col);
      arenaChallenge(row, col);
    } else {
      const row = cell.dataset.row;
      const col = cell.dataset.col;
      fetchArenaTable(row, col);
    }
  }

  async function arenaChallenge (row, col){
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `row=${row}&col=${col}`
    };
    try {
      const url = '/teamchallenge' + window.location.search;
      const response = await fetch(url, options);
      if(!response.ok){
        throw new Error('/teamchallenge res.ng');
      }
      const text = await response.text();
      arenaResult.innerText = text;

      if(text.includes('\n')) {
        const lastLine = text.trim().split('\n').pop();
        lastLine + '\n' + text;
        const p = document.createElement('p');
        p.textContent = lastLine;
        p.style.fontWeight = 'bold';
        p.style.padding = '0';
        p.style.margin = '0';
        arenaResult.prepend(p);
      }

      arenaResult.show();
      setTimeout(() => {
        if (settings.arenaResultScrollPosition === 'bottom') {
          arenaResult.scrollTop = arenaResult.scrollHeight;
        } else {
          arenaResult.scrollTop = 0;
        }
      }, 0);
      arenaResult.style.display = '';

    } catch (e) {
      arenaResult.innerText = e;
      arenaResult.show();
    }
  }

  let rangeAttackQueue = [];
  async function rangeAttack () {
    if(rangeAttackQueue.length === 0) {
      rangeAttackQueue = [...document.querySelectorAll('.cell.selected')];
    }

    if(rangeAttackQueue.length === 0) {
      alert('セルを選択してください');
      return;
    }

    const pTemplate = document.createElement('p');
    pTemplate.style.padding = '0';
    pTemplate.style.margin = '0';

    let errorOccurred = false;
    arenaResult.textContent = '';
    arenaResult.show();

    console.log(rangeAttackQueue);
    while(rangeAttackQueue.length > 0) {
      if(!rangeAttackProcessing) return;

      const cell = rangeAttackQueue[0];
      // 攻撃前に選択解除された場合
      if(!cell.classList.contains('selected')) {
        rangeAttackQueue.shift();
        continue;
      }
      const row = cell.dataset.row;
      const col = cell.dataset.col;
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `row=${row}&col=${col}`
      };
      cell.style.borderColor = '#4f6';

      try {
        const url = '/teamchallenge' + window.location.search;
        const response = await fetch(url, options);
        const text = await response.text();
        let lastLine = text.trim().split('\n').pop();
        if(
          lastLine.length > 100 ||
          lastLine === 'どんぐりが見つかりませんでした。'
        ) {
          throw new Error('どんぐりが見つかりませんでした。');
        }
        if(
          lastLine === 'あなたのチームは動きを使い果たしました。しばらくお待ちください。' ||
          lastLine === 'ng<>too fast' ||
          lastLine === '武器と防具を装備しなければなりません。' ||
          lastLine === '最初にチームに参加する必要があります。'
        ) {
          throw new Error(lastLine);
        }

        const p = pTemplate.cloneNode();
        p.textContent = `(${row}, ${col}) ${lastLine}`;
        arenaResult.prepend(p);
        rangeAttackQueue.shift();
      } catch (e) {
        const p = pTemplate.cloneNode();
        p.textContent = `(${row}, ${col}) [中断] ${e}`;
        arenaResult.prepend(p);
        errorOccurred = true;
        break;
      }
      if (rangeAttackQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      cell.style.borderColor = cell.classList.contains('selected') ? '#f64' : '#ccc';
    }
    if(!errorOccurred) {
      const p = pTemplate.cloneNode();
      p.textContent = `完了`;
      arenaResult.prepend(p);
      return true;
    } else {
      return false;
    }
  }

  function sortCells(type){
    if(!grid) return;
    const cells = [...document.querySelectorAll('.cell')];
    if(type === 'default') {
      cells.sort((a, b) => {
        const rowA = a.dataset.row;
        const rowB = b.dataset.row;
        const colA = a.dataset.col;
        const colB = b.dataset.col;
        return rowA - rowB || colA - colB;
      })
    }

    if(type === 'cond') {
      cells.sort((a, b) => {
        const condA = a.querySelector('p')?.textContent;;
        const condB = b.querySelector('p')?.textContent;;
        if (!condA || !condB) return 0;
      
        const splitA = condA.split('-');
        const splitB = condB.split('-');
      
        const isCompositeA = splitA.length > 1;
        const isCompositeB = splitB.length > 1;
      
        const order = ['N', 'R', 'SR', 'SSR', 'UR'];
      
        // '-' の後のランクを取得（ない場合はそのまま）
        const baseA = isCompositeA ? splitA[1] : condA;
        const baseB = isCompositeB ? splitB[1] : condB;
      
        const indexA = order.indexOf(baseA.replace(/だけ|e/g, ''));
        const indexB = order.indexOf(baseB.replace(/だけ|e/g, ''));

        // ランク順
        if (indexA !== indexB) return indexA - indexB;
      
        // 'だけ' > 'e' > 'だけe'
        const flag = s => 
          (s.includes('だけ') ? 1 : 0) + (s.includes('e') ? 2 : 0);
        const flagA = flag(condA);
        const flagB = flag(condB);

        if(flagA !== flagB) return flagA - flagB;

        // 同じランク内で '-' を含まないものを優先
        if (isCompositeA !== isCompositeB) return isCompositeA - isCompositeB;
      
        if (isCompositeA) {
          // '-' の前のランクで比較
          const frontA = splitA[0];
          const frontB = splitB[0];
          const indexFrontA = order.indexOf(frontA);
          const indexFrontB = order.indexOf(frontB);
          if (indexFrontA !== indexFrontB) return indexFrontA - indexFrontB;
        }
      });
    }
    grid.innerHTML = '';
    cells.forEach(cell => grid.append(cell));
  }
  
  function drawProgressBar(){
    fetch('https://donguri.5ch.net/')
    .then(res => res.ok ? res.text() : Promise.reject('res.ng'))
    .then(text => {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const statBlockDiv = doc.querySelector('div.stat-block:nth-child(2)>div:nth-child(5)');
      if(!statBlockDiv) return;
      const container = statBlockDiv.cloneNode(true);
      const progressBar = container.lastElementChild;
      if(!progressBar) return;
      const barBody = progressBar.lastElementChild;
      const percentage = parseInt(barBody.textContent);
      let str,min,totalSec,sec,margin;
      if (percentage === 0 || percentage === 50) {
        str = '（マップ更新時）';
      } else {
        if (percentage === 100) {
          min = 0;
          sec = 20;
          margin = 10;
        } else {
          totalSec = (percentage < 50) ? (50 - percentage) * 36 : (100 - percentage) * 36 + 10;
          min = Math.trunc(totalSec / 60);
          sec = totalSec % 60;
          margin = 20;
        }
        str = '（マップ更新まで' + min + '分' + sec + '秒 \xb1' + margin + '秒）';
      }
      progressBar.before(str, document.createElement('br'));
      progressBar.style.display = 'inline-block';
      progressBar.style.width = '400px';
      progressBar.style.maxWidth = '100vw';
      progressBar.style.height = '20px';
      progressBar.style.background = '#ccc';
      progressBar.style.borderRadius = '8px';
      progressBar.style.fontSize = '16px';
      progressBar.style.overflow = 'hidden';
      progressBar.style.marginTop = '5px';
      barBody.style.height = '100%';
      barBody.style.lineHeight = 'normal';
      barBody.style.background = '#428bca';
      barBody.style.textAlign = 'right';
      barBody.style.paddingRight = '5px';
      barBody.style.boxSizing = 'border-box';
      barBody.style.color = 'white';
      barBody.style.width = barBody.style.width;
      progressBarContainer.replaceChildren(container);

      const statBlock = doc.querySelector('.stat-block');
      if(statBlock) {
        const woodMatch = statBlock.textContent.match(/木材の数: (\d+)/);
        const steelMatch = statBlock.textContent.match(/鉄の数: (\d+)/);
        if(woodMatch) wood = woodMatch[1];
        if(steelMatch) steel = steelMatch[1];
      }
    })
    .catch(e => console.error(e))
  }

  drawProgressBar();
  setInterval(drawProgressBar, 18000);
})();
