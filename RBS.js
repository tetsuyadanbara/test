// ==UserScript==
// @name         donguri arena assist tool
// @version      1.3
// @description  fix arena ui and add functions (updated specs & removed auto join)
// @author       7234e634
// @match        https://donguri.5ch.net/teambattle*
// @match        https://donguri.5ch.net/bag*
// ==/UserScript==


(async()=>{
  try {

  // ===== Bag: save current equip (from Red Blue new) =====
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
  

  if(location.pathname === '/bag') {
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

  // 現在のモードクエリ（m=hc / m=l / m=rb）
  const _mParam = new URLSearchParams(location.search).get('m') || 'rb';
  const MODE = `m=${_mParam}`;

  let currentPeriod = 0;
  let currentProgress = 0;
  let nextProgress = null;
  let wood = 0;
  let steel = 0;

  const BASE_BATTLE_URL = `https://donguri.5ch.net/teambattle?${MODE}`;
let MODENAME;
  if (MODE === 'm=hc') MODENAME = '［ハード］';
  else if (MODE === 'm=l') MODENAME = '［ラダー］';
  else if (MODE === 'm=rb') MODENAME = '［赤vs青］';
  else MODENAME = '［アリーナ］';

  const vw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
  const vh = Math.min(document.documentElement.clientHeight, window.innerHeight || 0);

  const settings = JSON.parse(localStorage.getItem('aat_settings')) || {};


// ---- init helpers (prevent early null crashes) ----
async function waitForSelector(selector, timeoutMs = 8000, intervalMs = 50) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

  const header = await waitForSelector('header');
  if (!header) { console.error('[AAT] header not found'); return; }
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

  progressBarContainer.append(progressBarInfo,progressBar);
  progressBar.append(progressBarBody)
  toolbar.append(progressBarContainer);

  // add buttons and select to custom menu
  let shouldSkipAreaInfo, shouldSkipAutoEquip, cellSelectorActivate, rangeAttackProcessing, currentPeriod, currentProgress;
  let currentEquipName = '';
  let setPresetItems;
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

      const skipAutoEquipButton = subButton.cloneNode();
      skipAutoEquipButton.textContent = '自動装備';
      skipAutoEquipButton.style.color = '#fff';
      skipAutoEquipButton.classList.add('skip-auto-equip');
      if (settings.skipAutoEquip) {
        skipAutoEquipButton.style.background = '#888';
        shouldSkipAutoEquip = true;
      } else {
        skipAutoEquipButton.style.background = '#46f';
        shouldSkipAutoEquip = false;
      }
      skipAutoEquipButton.addEventListener('click', ()=> {
        if (shouldSkipAutoEquip) {
          skipAutoEquipButton.style.background = '#46f';
          shouldSkipAutoEquip = false;
        } else {
          skipAutoEquipButton.style.background = '#888';
          shouldSkipAutoEquip = true;
        }
        settings.skipAutoEquip = shouldSkipAutoEquip;
        localStorage.setItem('aat_settings', JSON.stringify(settings));
      });

      const rangeAttackButton = subButton.cloneNode();
      rangeAttackButton.textContent = '範囲攻撃';
      rangeAttackButton.style.background = '#f64';
      rangeAttackButton.style.color = '#fff';
      rangeAttackButton.addEventListener('click', ()=>{
        slideMenu.style.transform = 'translateX(-100%)';
        cellSelectorActivate = true;
      })

      // --- Auto Join (from Red/Blue new) ---
      const autoJoinButton = subButton.cloneNode();
      autoJoinButton.innerText = '自動参加\nモード';
      autoJoinButton.style.background = '#ffb300';
      autoJoinButton.style.color = '#000';

      const autoJoinDialog = document.createElement('dialog');
      autoJoinDialog.classList.add('auto-join');
      autoJoinDialog.style.background = '#fff';
      autoJoinDialog.style.color = '#000';
      autoJoinDialog.style.width = '90vw';
      autoJoinDialog.style.height = '90vh';
      autoJoinDialog.style.fontSize = '80%';
      autoJoinDialog.style.textAlign = 'center';
      autoJoinDialog.style.marginTop = '2vh';

      const autoJoinSettingsDialog = document.createElement('dialog');
      autoJoinSettingsDialog.style.background = '#fff';
      autoJoinSettingsDialog.style.color = '#000';
      autoJoinSettingsDialog.style.textAlign = 'left';

      // settings inputs
      (()=>{
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.width = '100%';
        const span = document.createElement('span');
        span.style.whiteSpace = 'nowrap';
        span.style.width = '50%';
        const span2 = document.createElement('span');
        span2.style.width = '50%';
        const inputT = document.createElement('input');
        const inputC = document.createElement('input');

        const inputs = {
          teamName: [inputT,'チーム名'],
          teamColor: [inputC,'チームカラー(6桁HEX)']
        };
        for (const key of Object.keys(inputs)) {
          const l = label.cloneNode();
          const s1 = span.cloneNode();
          const s2 = span2.cloneNode();
          s1.textContent = inputs[key][1];
          s2.append(inputs[key][0]);
          l.append(s1, s2);
          div.append(l);

          inputs[key][0].value = settings[key] || '';
          inputs[key][0].addEventListener('input', ()=>{
            if (key === 'teamColor') inputs[key][0].value = inputs[key][0].value.replace(/[^0-9a-fA-F]/g,'').slice(0,6);
            settings[key] = inputs[key][0].value;
            localStorage.setItem('aat_settings', JSON.stringify(settings));
          });
        }

        const p = document.createElement('p');
        p.style.fontSize = '90%';
        p.innerText = 'チームカラーは 6桁HEX（例: d32f2f）で入力してください。\n自動装備パネルで各ランクの装備セットを登録しておくと成功率が上がります。';

        const ok = document.createElement('button');
        ok.type = 'button';
        ok.textContent = 'OK';
        ok.addEventListener('click', ()=>{
          autoJoinSettingsDialog.close();
          if (!autoJoinDialog.open) autoJoinDialog.showModal();
          startAutoJoin();
        });

        div.append(p, ok);
        autoJoinSettingsDialog.append(div);
      })();

      // auto join main dialog UI
      (()=>{
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.height = '100%';
        container.style.color = '#000';

        const log = document.createElement('div');
        log.classList.add('auto-join-log');
        log.style.margin = '2px';
        log.style.border = 'solid 1px #000';
        log.style.overflow = 'auto';
        log.style.flexGrow = '1';
        log.style.textAlign = 'left';

        const p = document.createElement('p');
        p.textContent = 'この画面を開いたままにしておくこと';
        p.style.margin = '0';

        const settingsBtn = document.createElement('button');
        settingsBtn.textContent = '設定';
        settingsBtn.addEventListener('click', ()=>{
          autoJoinSettingsDialog.showModal();
          stopAutoJoin();
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '自動参加モードを終了';
        closeBtn.addEventListener('click', ()=>{
          autoJoinDialog.close();
          stopAutoJoin();
        });

        container.append(log, p, settingsBtn, closeBtn);
        autoJoinDialog.append(container);
        autoJoinDialog.append(autoJoinSettingsDialog);
        document.body.append(autoJoinDialog);
      })();

      autoJoinButton.addEventListener('click', ()=>{
        autoJoinDialog.showModal();
        // Start immediately if settings are already present
        setTimeout(() => { if (settings.teamColor) { try { startAutoJoin(); } catch(e){ console.error(e);} } }, 0);
        if (!settings.teamColor) {
          autoJoinSettingsDialog.showModal();
        } else {
          startAutoJoin();
        }
      });

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

      div.append(skipAutoEquipButton, rangeAttackButton, autoJoinButton, settingsButton, cellButton);
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
    if ((typeof arenaResult !== 'undefined' && arenaResult) && !arenaResult.contains(event.target) && !rangeAttackProcessing) {
      arenaResult.close();
    }
    if (typeof arenaModDialog !== 'undefined' && arenaModDialog && !arenaModDialog.contains(event.target)) {
      arenaModDialog.close();
    }
    if (typeof settingsDialog !== 'undefined' && settingsDialog && !settingsDialog.contains(event.target)) {
      settingsDialog.close();
    }
    if (typeof panel !== 'undefined' && panel && !panel.contains(event.target)) {
      panel.style.display = 'none';
    }
  });
  document.body.append(arenaResult);

  const autoEquipDialog = document.createElement('dialog');
  autoEquipDialog.style.padding = '0';
  autoEquipDialog.style.background = '#fff';
  autoEquipDialog.style.border = 'solid 1px #000';
  autoEquipDialog.style.color = '#000';
  document.body.append(autoEquipDialog);

  document.body.append(arenaField);

  // Click on the info table to challenge that cell (and auto-equip if enabled)
  arenaField.addEventListener('click', (e) => {
    const table = e.target.closest('table');
    if (!table || !table.dataset.row || !table.dataset.col) return;
    const row = Number(table.dataset.row);
    const col = Number(table.dataset.col);
    const rank = table.dataset.rank;
    if (Number.isNaN(row) || Number.isNaN(col)) return;

    if (shouldSkipAutoEquip) {
      arenaChallenge(row, col);
    } else {
      autoEquipAndChallenge(row, col, rank);
    }
  });

  
  
  // (ResBlue1.3 map preserved: removed auto grid regeneration block)

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
    const equipCond = newTable.querySelector('td small')?.textContent || '';
    if (equipCond) newTable.dataset.rank = equipCond;
      }
      newTable.style.background = '#fff';
      newTable.style.color = '#000';
      newTable.style.margin = '0';
      newTable.append(tbody);
      arenaField.querySelector('table').replaceWith(newTable);
      arenaField.show();
    }
  }

  async function handleCellClick (cell){
    if (cellSelectorActivate) {
      if (cell.classList.contains('selected')) {
        cell.style.borderColor = '#ccc';
        cell.classList.remove('selected');
      } else {
        cell.style.borderColor = '#f64';
        cell.classList.add('selected');
      }
    } else if (shouldSkipAreaInfo) {
      const { row, col, rank } = cell.dataset;
      if (arenaField.open) fetchArenaTable(row, col);
      await autoEquipAndChallenge(row, col, rank, 'normal');
    } else {
      const row = cell.dataset.row;
      const col = cell.dataset.col;
      fetchArenaTable(row, col);
    }
  }

  
  
async function autoEquipAndChallenge (row, col, rank, mode = 'normal') {

    // If rank is missing (e.g., cells without cached info), fetch it from the arena page.
    if (!rank) {
      try {
        const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&` + MODE;
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const t = await res.text();
          const doc = new DOMParser().parseFromString(t, 'text/html');
          const small = doc.querySelector('table td small, small');
          rank = small ? small.textContent : '';
        }
      } catch (e) {
        console.error(e);
      }
    }
  // mode: 'normal' (cell click / manual) or 'autojoin' (auto join mode)
  try {
    if (shouldSkipAutoEquip) {
      await arenaChallenge(row, col);
      return;
    }

    const normalizedRank = (rank || '')
      .toString()
      .replace('エリート', 'e')
      .replace(/.+から|\w+-|まで|だけ|警備員|警|\s|\[|\]|\|/g, '');

    const autoEquipItems = JSON.parse(localStorage.getItem('autoEquipItems')) || {};
    const autoEquipItemsAutojoin = JSON.parse(localStorage.getItem('autoEquipItemsAutojoin')) || {};

    let list = [];
    if (
      mode === 'autojoin' &&
      Array.isArray(autoEquipItemsAutojoin[normalizedRank]) &&
      autoEquipItemsAutojoin[normalizedRank].length > 0
    ) {
      list = autoEquipItemsAutojoin[normalizedRank];
    } else if (
      Array.isArray(autoEquipItems[normalizedRank]) &&
      autoEquipItems[normalizedRank].length > 0
    ) {
      list = autoEquipItems[normalizedRank];
    } else {
      await arenaChallenge(row, col);
      return;
    }

    // already equipped
    if (currentEquipName && list.includes(currentEquipName)) {
      await arenaChallenge(row, col);
      return;
    }

    // choose preset
    if (list.length === 1 || settings.autoEquipRandomly) {
      const idx = (list.length === 1) ? 0 : Math.floor(Math.random() * list.length);
      await setPresetItems(list[idx]);
      await arenaChallenge(row, col);
      return;
    }

    // manual select dialog (multiple presets)
    while (autoEquipDialog.firstChild) autoEquipDialog.firstChild.remove();

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

    list.forEach(name => {
      const li = liTemplate.cloneNode();
      li.textContent = name;
      li.addEventListener('click', async () => {
        autoEquipDialog.close();
        await setPresetItems(name);
        await arenaChallenge(row, col);
      });
      ul.append(li);
    });

    autoEquipDialog.append(ul);
    autoEquipDialog.showModal();
  } catch (e) {
    console.error(e);
    try {
      arenaResult.innerText = e?.message || String(e);
      arenaResult.show();
    } catch (_) {}
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
  
    return arenaResult;
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
  
  
  // ===== Auto Join core =====
  let autoJoinIntervalId;
  let isAutoJoinRunning = false;
  const sleep = s => new Promise(r=>setTimeout(r,s));
  async function autoJoin() {
    const dialog = document.querySelector('.auto-join');

    const logArea = dialog.querySelector('.auto-join-log');
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    let teamColor = settings.teamColor;
    let teamName = settings.teamName;


    function logMessage(region, message, next) {
      const date = new Date();
      const ymd = date.toLocaleDateString('sv-SE').slice(2);
      const time = date.toLocaleTimeString('sv-SE');
      const timestamp = document.createElement('div');
      timestamp.innerText = `${ymd}\n${time}`;
      timestamp.style.fontSize = '90%';
      timestamp.style.color = '#666';
      timestamp.style.borderRight = 'solid 0.5px #888';
      timestamp.style.whiteSpace = 'nowrap';

      const regionDiv = document.createElement('div');
      const progress = `${currentPeriod}期 ${currentProgress}%`;
      if (region) regionDiv.innerText = `${progress}\ntarget: ${region}\n${next}`;
      else regionDiv.innerText = next;
      regionDiv.style.fontSize = '90%';
      regionDiv.style.color = '#444';
      regionDiv.style.borderRight = 'dotted 0.5px #888';
      regionDiv.style.whiteSpace = 'nowrap';

      const messageDiv = document.createElement('div');
      messageDiv.textContent = message;

      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.gap = '4px';
      div.style.alignItems = 'center';
      div.style.marginBottom = '-0.5px';
      div.style.marginTop = '-0.5px';
      div.style.border = 'solid 0.5px #888';

      div.append(timestamp, regionDiv, messageDiv);
      logArea.prepend(div);
    }

    const messageTypes = {
      breaktime: [
        'チームに参加または離脱してから間もないため、次のバトルが始まるまでお待ちください。',
        'もう一度バトルに参加する前に、待たなければなりません。',
        'ng: ちょっとゆっくり'
      ],
      toofast: [
        'ng<>too fast'
      ],
      retry: [
        'あなたのチームは動きを使い果たしました。しばらくお待ちください。'
      ],
      reset: [
        'このタイルは攻撃できません。範囲外です。'
      ],
      quit: [
        '最初にチームに参加する必要があります。',
        'どんぐりが見つかりませんでした。',
        'あなたのどんぐりが理解できませんでした。',
        'レベルが低すぎます。'
      ],
      guardError: [
        '[警備員]だけ'
      ],
      equipError: [
        '武器と防具を装備しなければなりません。',
        '装備している防具と武器が力不足です。',
        '装備している防具と武器が強すぎます',
        '装備しているものは改造が多すぎます。改造の少ない他のものをお試しください',
        '参加するには、装備中の武器と防具のアイテムID'
      ],
      nonAdjacent: [
        'このタイルは攻撃できません。あなたのチームが首都を持つまで、どの首都にも隣接するタイルを主張することはできません。',
        'あなたのチームは首都を持っていないため、他のチームの首都に攻撃できません。'
      ],
      teamAdjacent: [
        'このタイルは攻撃できません。あなたのチームの制御領土に隣接していなければなりません。',
        'このタイルは攻撃できません。首都を奪取するには、隣接タイルを少なくとも3つ支配している必要があります。',
        'このタイルは攻撃できません。首都を奪取するには、隣接タイルを少なくとも2つ支配している必要があります。',
        'このタイルは攻撃できません。首都を奪取するには、隣接タイルを少なくとも1つ支配している必要があります。',
        'このタイルは攻撃できません。自分の首都は攻撃できません。',
        'この首都は攻撃できません。相手の総タイル数の少なくとも'
      ],
      capitalAdjacent: [
        'このタイルは攻撃できません。混雑したマップでは、初期主張は正確に1つの首都に隣接していなければなりません。'
      ],
      mapEdge: [
        'このタイルは攻撃できません。混雑したマップでは、初期主張はマップの端でなければなりません。'
      ]
    }

    function getMessageType (text) {
      const result = Object.keys(messageTypes)
        .find(key => messageTypes[key]
          .some(v => text.includes(v))
        )
      return result;
    }


    let nextProgress;
    async function attackRegion () {
      await drawProgressBar();
      if (isAutoJoinRunning || Math.abs(nextProgress - currentProgress) >= 3) {
        return;
      }

    if (location.href.includes('/teambattle?m=rb')) {
        try {
          const res = await fetch(`/teambattle?m=rb&t=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) {
            const text = await res.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const target = Array.from(doc.querySelectorAll('header span')).find(s => s.textContent.includes('チーム:'));
            if (target) {
              const raw = target.textContent;
              if (raw.includes('レッド')) {
                teamName = 'レッド';
                teamColor = 'd32f2f';
              } else if (raw.includes('ブルー')) {
                teamName = 'ブルー';
                teamColor = '1976d2';
              }
            }
          }
        } catch (e) { console.error(e); }
      }

      let regions = await getRegions();
      const excludeSet = new Set();

      let cellType;
      if (regions.nonAdjacent.length > 0) {
        cellType = 'nonAdjacent';
      } else if (regions.teamAdjacent.length > 0) {
        cellType = 'teamAdjacent';
      } else if (regions.capitalAdjacent.length > 0) {
        cellType = 'capitalAdjacent';
      } else {
        cellType = 'mapEdge';
      }

      while(dialog.open) {
        let success = false;
        isAutoJoinRunning = true;

        regions[cellType] = regions[cellType]
          .filter(e => !excludeSet.has(e.join(',')));
        for (const region of regions[cellType]) {
          let errorCount = 0;
          let next;
          try {
            const [cellRank, equipChangeStat] = await equipChange(region);
            if (equipChangeStat === 'noEquip') {
              excludeSet.add(region.join(','));
              continue;
            }

            const [ text, lastLine ] = await challenge(region);
            const messageType = getMessageType(lastLine);
            let message = lastLine;
            let processType;
            let sleepTime = 2;

            if (text.startsWith('アリーナチャレンジ開始')||text.startsWith('リーダーになった')) {
              success = true;
              message = '[成功] ' + lastLine;
              processType = 'return';
            } else if (messageType === 'breaktime') {
              success = true;
              message = lastLine;
              processType = 'return';
            } else if (messageType === 'toofast') {
              sleepTime = 3;
              processType = 'continue';
            } else if (messageType === 'retry') {
              sleepTime = 20;
              processType = 'continue';
            } else if (messageType === 'guardError') {
              message = lastLine;
              processType = 'continue';
            } else if (messageType === 'equipError') {
              message += ` (${cellRank}, ${currentEquipName})`;
              processType = 'continue';
            } else if (lastLine.length > 100) {
              message = 'どんぐりシステム';
              processType = 'continue';
            } else if (messageType === 'quit') {
              message = '[停止] ' + lastLine;
              processType = 'return';
              clearInterval(autoJoinIntervalId);
            } else if (messageType === 'reset') {
              processType = 'break';
            } else if (messageType in regions) {
              excludeSet.add(region.join(','));
              if (messageType === cellType) {
                processType = 'continue';
              } else if (messageType === 'nonAdjacent') {
                cellType = 'nonAdjacent';
                processType = 'break';
              } else if (messageType === 'teamAdjacent') {
                cellType = 'teamAdjacent';
                processType = 'break';
              } else if (messageType === 'capitalAdjacent') {
                cellType = 'capitalAdjacent';
                processType = 'break';
              } else if (messageType === 'mapEdge') {
                cellType = 'mapEdge';
                processType = 'break';
              }
            }

            if (success) {
              if (currentProgress < 16) {
                nextProgress = 26;
               } else if (currentProgress < 33) {
                nextProgress = 43;
               } else if (currentProgress < 50) {
                nextProgress = 60;
               } else if (currentProgress < 66) {
                nextProgress = 76;
               } else if (currentProgress < 83) {
                nextProgress = 93;
               } else {
                nextProgress = 10;
               }
              next = `→ ${nextProgress}±2%`;
              isAutoJoinRunning = false;
            } else if (processType === 'return') {
              next = '';
              isAutoJoinRunning = false;
            } else {
              next = `→ ${sleepTime}s`;
            }

            logMessage(region, message, next);
            await sleep(sleepTime * 1000);

            if (processType === 'break') {
              regions = await getRegions();
              break;
            } else if (processType === 'return') {
              return;
            }
          } catch (e){
            let message = '';
            switch (e) {
              case 403:
                message = `[403] Forbidden`;
                break;
              case 404:
                message = `[404] Not Found`;
                break;
              case 500:
                message = `[500] Internal Server Error`;
                break;
              case 502:
                message = `[502] Bad Gateway`;
                break;
              default:
                message = e;
                break;
            }
            if (e.message === '再ログインしてください') {
              logMessage(region, '[停止] どんぐりが見つかりませんでした', '');
              isAutoJoinRunning = false;
              clearInterval(autoJoinIntervalId);
              return;
            } else if (e === 403) {
              logMessage(region, message, '');
              isAutoJoinRunning = false;
              clearInterval(autoJoinIntervalId);
              return;
            } else if ([404,500,502].includes(e)) {
              errorCount++;
              let sleepTime = 20 * errorCount;
              if(sleepTime > 600) sleepTime = 600;
              logMessage(region, message, `→ ${sleepTime}s`);
              await sleep(sleepTime * 1000);
            } else {
              let sleepTime = 20;
              logMessage(region, e, `→ ${sleepTime}s`);
              await sleep(sleepTime * 1000);
            }
          }
        }
        if (!success && regions[cellType].length === 0) {
              if (currentProgress < 16) {
                nextProgress = 26;
               } else if (currentProgress < 33) {
                nextProgress = 43;
               } else if (currentProgress < 50) {
                nextProgress = 60;
               } else if (currentProgress < 66) {
                nextProgress = 76;
               } else if (currentProgress < 83) {
                nextProgress = 93;
               } else {
                nextProgress = 10;
               }
          const next = `→ ${nextProgress}±2%`;
          isAutoJoinRunning = false;
          logMessage(null, '攻撃可能なタイルが見つかりませんでした。', next);
          return;
        }
      }
    }

    async function getRegions () {
      try {
        const res = await fetch('');
        if (!res.ok) throw new Error(`[${res.status}] /teambattle`);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const headerText = doc?.querySelector('header')?.textContent || '';
        if (!headerText.includes('どんぐりチーム戦い')) throw new Error('title.ng info');

        const scriptContent = doc.querySelector('.grid > script, #gridWrap + script')?.textContent || '';

        let cellColors, capitalMap, rows, cols;

        if (location.href.includes('m=rb')) {
          //rb
          const cellColorsMatch = scriptContent.match(/const cellColors = ({.+?});/s);
          const validJsonStr = cellColorsMatch[1].replace(/'/g, '"').replace(/,\s*}/, '}');
          cellColors = JSON.parse(validJsonStr);

          const capitalListMatch = scriptContent.match(/const capitalList = (\[.*?\]);/s);
          capitalMap = JSON.parse(capitalListMatch[1]);

          const gridSizeMatch = scriptContent.match(/const GRID_SIZE = (\d+);/);
          rows = cols = Number(gridSizeMatch[1]);
        } else {
          //hc/l
          const cellColorsString = scriptContent.match(/const cellColors = ({.+?})/s)[1];
          const validJsonStr = cellColorsString.replace(/'/g, '"').replace(/,\s*}/, '}');
          cellColors = JSON.parse(validJsonStr);
          const capitalMapString = scriptContent.match(/const capitalMap = (\[.*?\]);/s)[1];
          capitalMap = JSON.parse(capitalMapString);

          const grid = doc.querySelector('.grid');
          if (!grid) return;
          rows = Number(grid.style.gridTemplateRows.match(/repeat\((\d+), 35px\)/)[1]);
          cols = Number(grid.style.gridTemplateColumns.match(/repeat\((\d+), 35px\)/)[1]);
        }

        const cells = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            cells.push([r, c]);
          }
        }

        const directions = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1]
        ];

        const adjacentSet = new Set();
        for (const [cr, cc] of capitalMap) {
          for (const [dr, dc] of directions) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              adjacentSet.add(`${nr}-${nc}`);
            }
          }
        }

        const capitalSet = new Set(capitalMap.map(([r, c]) => `${r}-${c}`));

        const nonAdjacentCells = cells.filter(([r, c]) => {
          const key = `${r}-${c}`;
          return !capitalSet.has(key) && !adjacentSet.has(key);
        });

        const capitalAdjacentCells = cells.filter(([r, c]) => {
          const key = `${r}-${c}`;
          return adjacentSet.has(key);
        });

        const teamColorSet = new Set();
        for(const [key, value] of Object.entries(cellColors)) {
          if (teamColor === value.replace('#','')) {
            teamColorSet.add(key);
          }
        }

        const teamAdjacentSet = new Set();
        for (const key of [...teamColorSet]) {
          const [tr, tc] = key.split('-');
          for (const [dr, dc] of directions) {
            const nr = Number(tr) + dr;
            const nc = Number(tc) + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              teamAdjacentSet.add(`${nr}-${nc}`);
            }
          }
        }

        const teamAdjacentCells = cells.filter(([r, c]) => {
          const key = `${r}-${c}`;
          return teamColorSet.has(key) || teamAdjacentSet.has(key);
        })

        const mapEdgeSet = new Set();
        for (let i=0; i<rows; i++) {
          mapEdgeSet.add(`${i}-0`);
          mapEdgeSet.add(`${i}-${cols-1}`);
        }
        for (let i=0; i<cols; i++) {
          mapEdgeSet.add(`0-${i}`);
          mapEdgeSet.add(`${rows-1}-${i}`);
        }

        const mapEdgeCells = cells.filter(([r, c]) => {
          const key = `${r}-${c}`;
          return mapEdgeSet.has(key) && !capitalSet.has(key);
        })

        function shuffle(arr) {
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        }

        const regions = {
          nonAdjacent: shuffle(nonAdjacentCells),
          capitalAdjacent: shuffle(capitalAdjacentCells),
          teamAdjacent: shuffle(teamAdjacentCells),
          mapEdge: shuffle(mapEdgeCells)
        };
        return regions;
      } catch (e) {
        console.error(e);
        return;
      }
    }

    async function challenge (region) {
      const [ row, col ] = region;
      const body = `row=${row}&col=${col}`;
      try {
        const res = await fetch('/teamchallenge?'+MODE, {
          method: 'POST',
          body: body,
          headers: headers
        })

        if(!res.ok) throw new Error(res.status);
        const text = await res.text();
        const lastLine = text.trim().split('\n').pop();
        return [ text, lastLine ];
      } catch (e) {
        console.error(e);
        throw e;
      }

    }
    async function equipChange (region) {
      const [ row, col ] = region;
      const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&`+MODE;
      try {
        const res = await fetch(url);
        if(!res.ok) throw new Error(`[${res.status}] /teambattle?r=${row}&c=${col}`);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text,'text/html');
        const headerText = doc?.querySelector('header')?.textContent || '';
        if(!headerText.includes('どんぐりチーム戦い')) return Promise.reject(`title.ng`);
        const table = doc.querySelector('table');
        if(!table) throw new Error('table.ng');
        const equipCond = table.querySelector('td small').textContent;
        const rank = equipCond
          .replace('エリート','e')
          .replace(/.+から|\w+-|まで|だけ|警備員|警|\s|\[|\]|\|/g,'');
        const autoEquipItems = JSON.parse(localStorage.getItem('autoEquipItems')) || {};
        const autoEquipItemsAutojoin = JSON.parse(localStorage.getItem('autoEquipItemsAutojoin')) || {};

        if (autoEquipItemsAutojoin[rank]?.length > 0) {
          const index = Math.floor(Math.random() * autoEquipItemsAutojoin[rank].length);
          await setPresetItems(autoEquipItemsAutojoin[rank][index]);
          return [rank, 'success'];
        } else if (autoEquipItems[rank]?.length > 0) {
          const index = Math.floor(Math.random() * autoEquipItems[rank].length);
          await setPresetItems(autoEquipItems[rank][index]);
          return [rank, 'success'];
        } else {
          return [rank, 'noEquip'];
        }
      } catch (e) {
        console.error(e);
        throw e;
      }
    }

    if (!isAutoJoinRunning) {
      attackRegion();
    }
    autoJoinIntervalId = setInterval(attackRegion,60000);
  };

  

function drawProgressBar(){
    try {
      const res = await fetch('https://donguri.5ch.net/');
      if (!res.ok) throw new Error(res.status);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const container = doc.querySelector('div.stat-block:nth-child(2)>div:nth-child(5)').cloneNode(true);
      currentPeriod = Number(container.firstChild.textContent.match(/\d+/)[0]);
      currentProgress = parseInt(container.lastElementChild.textContent);
      let str,min,totalSec,sec,margin;

      if (currentProgress === 0 || currentProgress === 50 || (location.href.includes('/teambattle?m=rb') && (currentProgress === 16 || currentProgress === 33 || currentProgress === 66 || currentProgress === 83))) {
        str = '（マップ更新）';
      } else {
        if (currentProgress === 100) {
          min = 0;
          sec = 20;
          margin = 10;
        } else {
          if (location.href.includes('/teambattle?m=rb')) {
             if (currentProgress <= 16) {
               totalSec = (16 - currentProgress) * 600 / 16.6;
             } else if (currentProgress <= 33) {
               totalSec = (33 - currentProgress) * 600 / 16.6;
             } else if (currentProgress <= 50) {
               totalSec = (50 - currentProgress) * 600 / 16.6;
             } else if (currentProgress <= 66) {
               totalSec = (66 - currentProgress) * 600 / 16.6;
             } else if (currentProgress <= 83) {
               totalSec = (83 - currentProgress) * 600 / 16.6;
             } else if (currentProgress <= 100) {
               totalSec = (100 - currentProgress) * 600 / 16.6;
             }
          } else {
          totalSec = (currentProgress < 50) ? (50 - currentProgress) * 36 : (100 - currentProgress) * 36 + 10;
          }
          totalSec = Math.floor(totalSec);
          min = Math.trunc(totalSec / 60);
          sec = totalSec % 60;
          margin = 20;
        }
        str = '（残り' + min + '分' + sec + '秒 \xb1' + margin + '秒）';
      }
      progressBarBody.textContent = currentProgress + '%';
      progressBarBody.style.width = currentProgress + '%';
      progressBarInfo.textContent = `${MODENAME}第${currentPeriod}期${str}`;

      const statBlock = doc.querySelector('.stat-block');
      wood = statBlock.textContent.match(/木材の数: (\d+)/)[1];
      steel = statBlock.textContent.match(/鉄の数: (\d+)/)[1];
    } catch (e) {
      console.error(e+' drawProgressBar()')
    }
  }

  drawProgressBar();
  setInterval(drawProgressBar, 18000);

  // --- Robust cell click handling (event delegation) ---
  // Some map implementations recreate / replace .cell nodes; delegation keeps clicks working.
  document.addEventListener('click', (event) => {
    const cell = event.target.closest && event.target.closest('.cell');
    if (!cell) return;
    // Only handle clicks inside the battle grid area
    const gridRoot = document.getElementById('gridWrap') || document.querySelector('.grid') || document.getElementById('aat_tool_layer');
    if (gridRoot && !gridRoot.contains(cell)) return;
    if (cell.dataset && cell.dataset.row !== undefined && cell.dataset.col !== undefined) {
      // Prevent other handlers from consuming the click first
      event.stopPropagation();
      handleCellClick(cell);
    }
  }, true);

  document.addEventListener('touchstart', (event) => {
    const cell = event.target.closest && event.target.closest('.cell');
    if (!cell) return;
    const gridRoot = document.getElementById('gridWrap') || document.querySelector('.grid') || document.getElementById('aat_tool_layer');
    if (gridRoot && !gridRoot.contains(cell)) return;
    if (cell.dataset && cell.dataset.row !== undefined && cell.dataset.col !== undefined) {
      event.stopPropagation();
      handleCellClick(cell);
    }
  }, { capture: true, passive: true });
  } catch (e) {
    console.error("[AAT] fatal", e);
    alert("AATエラー: " + (e && e.message ? e.message : e));
  }
})();
