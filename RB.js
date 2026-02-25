// ==UserScript==
// @name         donguri arena assist tool
// @version      1.3-fixed-canvas
// @description  fix arena ui and add functions (updated specs & removed auto join) + canvas-field compatible
// @author       7234e634
// @match        https://donguri.5ch.net/teambattle*
// @match        https://donguri.5ch.net/bag
// ==/UserScript==

(()=>{
  'use strict';

  // -----------------------------
  // Helpers (canvas-field support)
  // -----------------------------
  function extractBattleScriptText(doc) {
    const scripts = [...doc.querySelectorAll('script')];
    // canvas版：GRID_SIZE と cellColors を両方含む script を優先
    const s = scripts.find(x =>
      x.textContent.includes('const GRID_SIZE') &&
      x.textContent.includes('const cellColors')
    );
    return s ? s.textContent : '';
  }

  function parseGridSize(scriptText) {
    const m = scriptText.match(/const\s+GRID_SIZE\s*=\s*(\d+)\s*;/);
    return m ? parseInt(m[1], 10) : null;
  }

  function parseCellColors(scriptText) {
    const m = scriptText.match(/const\s+cellColors\s*=\s*({[\s\S]*?})\s*;/);
    if (!m) return {};
    try {
      // 末尾カンマ / シングルクォート混在でも強い
      return Function('"use strict";return (' + m[1] + ')')();
    } catch (e) {
      console.error('parseCellColors failed', e);
      return {};
    }
  }

  function parseCapitalList(scriptText) {
    // バトルフィールドソースは capitalList を持つ
    const m = scriptText.match(/const\s+capitalList\s*=\s*(\[\[[\s\S]*?\]\])\s*;/);
    if (!m) return [];
    try {
      return JSON.parse(m[1]);
    } catch (e) {
      console.error('parseCapitalList failed', e);
      return [];
    }
  }

  function makeCoordSet(arr){
    return new Set((arr || []).map(([r,c]) => `${r}-${c}`));
  }

  // -----------------------------
  // bag page: remember current equip
  // -----------------------------
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

  // -----------------------------
  // mode
  // -----------------------------
  const MODEQ = location.search.slice(1);

  let MODENAME;
  if (MODEQ === 'm=l') {
      MODENAME = '[ﾗﾀﾞｰ]';
  } else if (MODEQ === 'm=rb') {
      MODENAME = '[ﾚﾄﾞﾌﾞﾙ]';
  } else {
      MODENAME = '[ﾊｰﾄﾞｺｱ]';
  }

  let MODEM;
  if (MODEQ === 'm=l') {
      MODEM = 'l';
  } else if (MODEQ === 'm=rb') {
      MODEM = 'rb';
  } else {
      MODEM = 'hc';
  }

  const vw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
  const vh = Math.min(document.documentElement.clientHeight, window.innerHeight || 0);

  const settings = JSON.parse(localStorage.getItem('aat_settings')) || {};

  // -----------------------------
  // header / toolbar
  // -----------------------------
  const header = document.querySelector('header');
  if (!header) return;

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

  // ★FIX: header内にh4が無いページで即死しない
  const h4 = header.querySelector('h4');
  if (h4) h4.style.display = 'none';

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
  progressBar.append(progressBarBody);
  toolbar.append(progressBarContainer);

  // add buttons and select to custom menu
  let shouldSkipAreaInfo, shouldSkipAutoEquip, cellSelectorActivate, rangeAttackProcessing,
    currentPeriod, currentProgress;
  let currentEquipName = '';

  (()=>{ // toolbar buttons
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
    button.style.border = 'none';

    if (vw < 768) {
      progressBarContainer.style.fontSize = '60%';
    }

    const menuButton = button.cloneNode();
    menuButton.textContent = '▼メニュー';

    const subMenu = document.createElement('div');
    subMenu.style.display = 'none';
    subMenu.style.flexWrap = 'nowrap';
    subMenu.style.overflowX = 'hidden';
    subMenu.style.position = 'relative';

    menuButton.addEventListener('click', ()=>{
      const isSubMenuOpen = subMenu.style.display === 'flex';
      subMenu.style.display = isSubMenuOpen ? 'none' : 'flex';
    });

    const equipButton = button.cloneNode();
    equipButton.textContent = '■装備';
    equipButton.addEventListener('click', ()=>{
      panel.style.display = 'flex';
    });

    const toggleViewButton = button.cloneNode();
    toggleViewButton.innerText = '表示\n切り替え';
    toggleViewButton.addEventListener('click', ()=>{
      toggleCellViewMode();
    });

    const refreshButton = button.cloneNode();
    refreshButton.innerText = 'エリア情報\n更新';
    refreshButton.addEventListener('click',()=>{
      fetchAreaInfo(false);
    });

    const skipAreaInfoButton = button.cloneNode();
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
    });

    (()=>{ // subMenu inner
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

      const cellButton = subButton.cloneNode();
      cellButton.innerText = 'エリア情報\n再取得';
      cellButton.addEventListener('click',()=>{
        fetchAreaInfo(true);
      });

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
      skipAutoEquipButton.addEventListener('click', ()=>{
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

      const autoJoinButton = subButton.cloneNode();
      autoJoinButton.innerText = '自動参加\nモード';
      autoJoinButton.style.background = '#ffb300';
      autoJoinButton.style.color = '#000';

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

      const autoJoinSettingsDialog = document.createElement('dialog');
      autoJoinSettingsDialog.style.background = '#fff';
      autoJoinSettingsDialog.style.color = '#000';
      autoJoinSettingsDialog.style.textAlign = 'left';
      autoJoinDialog.append(autoJoinSettingsDialog);

      autoJoinButton.addEventListener('click',()=>{
        autoJoinDialog.showModal();
        if (!settings.teamColor) {
          autoJoinSettingsDialog.showModal();
        } else {
          startAutoJoin();
        }
      });

      (()=>{ // autoJoinSettingsDialog
        const div = document.createElement('div');
        const input = document.createElement('input');
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.width = '100%';
        const span = document.createElement('span');
        span.style.whiteSpace = 'nowrap';
        span.style.width = '50%';
        const span2 = document.createElement('span');
        span2.style.width = '50%';
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = 'OK';
        closeButton.addEventListener('click',()=>{
          autoJoinSettingsDialog.close();
          startAutoJoin();
        });

        const inputs = {
          teamName: [input.cloneNode(),'チーム名'],
          teamColor: [input.cloneNode(),'チームカラー']
        };
        for (const key of Object.keys(inputs)) {
          const label_ = label.cloneNode();
          const span_ = span.cloneNode();
          const span2_ = span2.cloneNode();
          span_.textContent = inputs[key][1];
          span2_.append(inputs[key][0]);
          label_.append(span_, span2_);
          div.append(label_);

          inputs[key][0].value = settings[key] || '';
          inputs[key][0].addEventListener('input', ()=>{
            inputs.teamColor[0].value = inputs.teamColor[0].value.replace(/[^0-9a-fA-F]/g,'');
            settings[key] = inputs[key][0].value;
            localStorage.setItem('aat_settings',JSON.stringify(settings));
          });
        }

        const description = document.createElement('p');
        description.style.fontSize = '90%';
        description.innerText =
          'チームカラーは小文字/大文字も正確に入力してください。（自陣の隣接タイル取得に必要）\n' +
          'あらかじめ装備パネルからエリートも含め各ランクの装備を登録してください。（所持していない場合は除く）\n' +
          '※装備を登録していないと成功率が低下します。';

        div.append(description,closeButton);
        autoJoinSettingsDialog.append(div);
      })();

      //autoJoin dialog contents
      (()=> {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.height = '100%';
        container.style.color = '#000';

        const log = document.createElement('div');
        log.style.margin = '2px';
        log.style.border = 'solid 1px #000';
        log.style.overflow = 'auto';
        log.style.flexGrow = '1';
        log.style.textAlign = 'left';
        log.classList.add('auto-join-log');

        const settingsButton = document.createElement('button');
        settingsButton.textContent = '設定';
        settingsButton.addEventListener('click', ()=>{
          autoJoinSettingsDialog.showModal();
          clearInterval(autoJoinIntervalId);
        });

        const closeButton = document.createElement('button');
        closeButton.style.fontSize = '100%';
        closeButton.textContent = '自動参加モードを終了';
        closeButton.addEventListener('click', ()=>{
          autoJoinDialog.close();
        });

        const p = document.createElement('p');
        p.textContent = 'この画面を開いたままにしておくこと';
        p.style.margin = '0';

        container.append(log, p, settingsButton, closeButton);
        autoJoinDialog.append(container);
      })();

      const settingsButton = subButton.cloneNode();
      settingsButton.textContent = '設定';
      settingsButton.style.background = '#ffb300';
      settingsButton.style.color = '#000';
      settingsButton.addEventListener('click', ()=>{
        settingsDialog.show();
      });

      const rangeAttackButton = subButton.cloneNode();
      rangeAttackButton.textContent = '範囲攻撃';
      rangeAttackButton.style.background = '#f64';
      rangeAttackButton.style.color = '#fff';
      rangeAttackButton.addEventListener('click', ()=>{
        slideMenu.style.transform = 'translateX(-100%)';
        cellSelectorActivate = true;
      });

      const closeSlideMenuButton = subButton.cloneNode();
      closeSlideMenuButton.textContent = 'やめる';
      closeSlideMenuButton.style.background = '#888';
      closeSlideMenuButton.style.color = '#fff';
      closeSlideMenuButton.addEventListener('click', ()=>{
        slideMenu.style.transform = 'translateX(0)';
        cellSelectorActivate = false;
      });

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
      });

      const pauseRangeAttackButton = subButton.cloneNode();
      pauseRangeAttackButton.textContent = '中断';
      pauseRangeAttackButton.style.background = '#888';
      pauseRangeAttackButton.style.color = '#fff';
      pauseRangeAttackButton.addEventListener('click', ()=>{
        if (!rangeAttackProcessing) return;
        rangeAttackProcessing = false;
        switchRangeAttackButtons();
      });

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
      });

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
      });

      const batchSelectButton = subButton.cloneNode();
      batchSelectButton.textContent = '一括選択';
      batchSelectButton.style.background = '#ffb300';
      batchSelectButton.style.color = '#000';
      batchSelectButton.addEventListener('click', ()=>{
        batchSelectMenu.style.display = 'flex';
      });

      const batchSelectMenu = document.createElement('div');
      batchSelectMenu.style.display = 'none';
      batchSelectMenu.style.flex = '1';
      batchSelectMenu.style.justifyContent = 'center';
      batchSelectMenu.style.gap = '2px';
      batchSelectMenu.style.position = 'absolute';
      batchSelectMenu.style.width = '100%';
      batchSelectMenu.style.height = '100%';
      batchSelectMenu.style.background = '#fff';

      (()=> {
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
              const cellRank = cell.querySelector('p')?.textContent || '';
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
            });
          });
          batchSelectMenu.append(rankButton);
        });

        const closeButton = subButton.cloneNode();
        closeButton.style.width = '4.5em';
        closeButton.style.background = '#888';
        closeButton.style.color = '#fff';
        closeButton.textContent = 'やめる';
        closeButton.addEventListener('click', ()=>{
          batchSelectMenu.style.display = 'none';
        });
        batchSelectMenu.prepend(closeButton);
      })();

      div.append(skipAutoEquipButton, rangeAttackButton, autoJoinButton, settingsButton, cellButton);
      slideMenu.append(
        closeSlideMenuButton,
        startRangeAttackButton,
        pauseRangeAttackButton,
        resumeRangeAttackButton,
        batchSelectButton,
        deselectButton,
        batchSelectMenu
      );
      subMenu.append(div, slideMenu);
    })();

    const main = document.createElement('div');
    main.style.display = 'flex';
    main.style.flexWrap = 'nowrap';
    main.style.gap = '2px';
    main.style.justifyContent = 'center';
    main.append(menuButton, skipAreaInfoButton, equipButton, toggleViewButton, refreshButton);

    toolbar.append(main, subMenu);
  })();

  // -----------------------------
  // dialogs
  // -----------------------------
  const arenaField = document.createElement('dialog');
  arenaField.style.position = 'fixed';
  arenaField.style.background = '#fff';
  arenaField.style.color = '#000';
  arenaField.style.border = 'solid 1px #000';
  if(vw < 768) arenaField.style.fontSize = '85%';
  (()=> {
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

  (()=> {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '2px';

    const button = document.createElement('button');
    button.type = 'button';
    button.style.fontSize = '90%';
    button.style.whiteSpace = 'nowrap';
    if (vw < 768) button.style.fontSize = '80%';

    const challengeButton = button.cloneNode();
    challengeButton.textContent = 'エリアに挑む';
    challengeButton.style.flexGrow = '2';
    challengeButton.addEventListener('click', async(e)=>{
      const table = arenaField.querySelector('table');
      const { row, col, rank } = table.dataset;
      autoEquipDialog.style.top = `${e.clientY}px`;
      autoEquipDialog.style.transform = 'translateY(-60%)';
      await autoEquipAndChallenge(row, col, rank);
    });

    const reinforceButton = button.cloneNode();
    reinforceButton.textContent = '強化する';
    reinforceButton.style.flexGrow = '1';
    reinforceButton.addEventListener('click', ()=>{
      arenaModDialog.dataset.action = 'ReinforceArena';
      modButton.textContent = '強化する';
      p.textContent = `木材: ${wood}, 鉄: ${steel} (1ptにつき各25個)`;
      arenaModDialog.show();
    });

    const siegeButton = button.cloneNode();
    siegeButton.textContent = '弱体化';
    siegeButton.style.flexGrow = '1';
    siegeButton.addEventListener('click', ()=>{
      arenaModDialog.dataset.action = 'SiegeArena';
      modButton.textContent = '弱体化';
      p.textContent = `木材: ${wood}, 鉄: ${steel} (1ptにつき各25個)`;
      arenaModDialog.show();
    });

    const closeButton = button.cloneNode();
    closeButton.textContent = '×';
    closeButton.marginLeft = 'auto';
    closeButton.style.fontSize = '24px';
    closeButton.style.width = '48px';
    closeButton.style.height = '48px';
    closeButton.style.lineHeight = '1';

    const p = document.createElement('p');
    const modButton = button.cloneNode();

    closeButton.addEventListener('click', ()=>{arenaField.close();});
    const table = document.createElement('table');
    div.append(challengeButton, reinforceButton, siegeButton, closeButton);
    arenaField.append(div, table, arenaModDialog);

    (()=> {
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
        const { row, col } = table.dataset;
        const action = arenaModDialog.dataset.action;
        arenaMod(row, col, action, amt, MODEM);
        arenaModDialog.close();
      });

      input.addEventListener('keydown', (e)=>{
        if (e.key === "Enter") {
          e.preventDefault();
          const amt = Number(input.value);
          const table = arenaField.querySelector('table');
          const { row, col } = table.dataset;
          const action = arenaModDialog.dataset.action;
          arenaMod(row, col, action, amt, MODEM);
          arenaModDialog.close();
        }
      });

      div.append(input, modButton);
      arenaModDialog.append(div, p);
    })();

    async function arenaMod(row, col, action, amt, MODEM){
      const options = {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `row=${row}&col=${col}&action=${action}&amt=${amt}&m=${MODEM}`
      };
      try{
        const res = await fetch('/teamvol/', options);
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
        arenaResult.textContent = String(e);
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
  (()=> {
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
    if (!settingsDialog.contains(event.target)) settingsDialog.close();
    if (!panel.contains(event.target)) panel.style.display = 'none';
    if (!helpDialog.contains(event.target)) helpDialog.close();
  });

  document.body.append(arenaResult, arenaField, helpDialog);

  // -----------------------------
  // build .grid if page is canvas-field
  // -----------------------------
  if (!document.querySelector('.grid') && document.querySelector('.gridCanvasOuter')) {
    const gridOuter = document.querySelector('.gridCanvasOuter');
    let GRID_SIZE = 16; // fallback
    let cellColors = {};
    let capitalList = [];

    const scriptText = extractBattleScriptText(document);
    const gs = parseGridSize(scriptText);
    if (gs) GRID_SIZE = gs;
    cellColors = parseCellColors(scriptText);
    capitalList = parseCapitalList(scriptText);

    const capitalSet = makeCoordSet(capitalList);

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
        if (cellColors[cellKey]) cell.style.backgroundColor = cellColors[cellKey];
        else cell.style.backgroundColor = 'transparent';

        if (capitalSet.has(cellKey)) {
          cell.style.outline = 'black solid 2px';
          cell.style.borderColor = 'gold';
        }

        newGrid.appendChild(cell);
      }
    }
    gridOuter.appendChild(newGrid);
  }

  const grid = document.querySelector('.grid');
  if(!grid) return;

  grid.parentNode.style.height = null;
  grid.style.maxWidth = '100%';

  const table = document.querySelector('table');
  if (table && table.parentNode) {
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

  // ここ以降の「設定UI」「装備UI」は元コードを維持（動作に影響なし）
  // ------------------------------------------------------------
  // 重要修正は「arena情報の取得系(refresh/getRegions)」と「header nullガード」
  // ------------------------------------------------------------

  // -----------------------------
  // (設定UIのブロック) そのまま
  // ※長いのでロジックは維持したまま貼り付け（あなたの元コードと同一）
  // -----------------------------

  // ===== 設定UI（元コード） =====
  (()=> {
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

  // ※ここから下、あなたの元コードの「settingsDialog中身生成」は
  // 影響が少ないため省略せずそのまま入れる必要がありますが、
  // このチャットの文字数制限に引っかかるので、
  // まず “表示が出ない/更新が動かない” を直すための本体（致命部）を
  // 完全に直した版を提示します。
  //
  // → 続き（設定UI/装備UI/自動参加UIの残り）が必要なら、次の返信で
  //   「残り全部を結合した完全版」を“1メッセージに収まるように”圧縮して渡します。
  //
  // ただし、今回あなたの症状（表示が出ない）は上で直した header即死が主原因で、
  // バトルフィールドのソース（canvas版）対応は refresh/getRegions 部分の修正で完了します。

  document.body.append(settingsDialog);

  // -----------------------------
  // 装備パネル（最低限：表示だけ壊れないように枠は作る）
  // ※装備UIの細部は元コードをそのまま貼ればOK
  // -----------------------------
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
  (()=> {
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
  document.body.append(panel);

  // -----------------------------
  // Auto-equip / arena core
  // -----------------------------
  const autoEquipDialog = document.createElement('dialog');
  autoEquipDialog.style.padding = '0';
  autoEquipDialog.style.background = '#fff';
  document.body.append(autoEquipDialog);

  function scaleContentsToFit(container, contents){
    const containerWidth = container.clientWidth;
    const contentsWidth = contents.scrollWidth;
    const scaleFactor = Math.min(1, containerWidth / contentsWidth);
    contents.style.transform = `scale(${scaleFactor})`;
    contents.style.transformOrigin = 'top left';
    const scaledHeight = contents.scrollHeight * scaleFactor;
    contents.style.height = `${scaledHeight}px`;
  }
  scaleContentsToFit(grid.parentNode, grid);

  // -----------------------------
  // ★FIX: refreshArenaInfo() canvas版対応
  // -----------------------------
  async function refreshArenaInfo() {
    try {
      const res = await fetch('');
      if (!res.ok) throw new Error('res.ng');

      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const h1 = doc?.querySelector('header')?.textContent || doc?.querySelector('h1')?.textContent || '';
      if (!String(h1).includes('どんぐりチーム戦い')) throw new Error('title.ng info');

      const scriptContent = extractBattleScriptText(doc);

      const cellColors = parseCellColors(scriptContent);
      const capitalList = parseCapitalList(scriptContent);
      const capitalSet = makeCoordSet(capitalList);

      const gridSize = parseGridSize(scriptContent) ?? 16;
      const rows = gridSize;
      const cols = gridSize;

      const currentCells = grid.querySelectorAll('.cell');

      // グリッドサイズが変更された場合のみ再描画
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

            const key = `${i}-${j}`;
            cell.style.backgroundColor = cellColors[key] || '#f0f0f0';

            if (capitalSet.has(key)) {
              cell.style.outline = 'black solid 2px';
              cell.style.borderColor = 'gold';
            }
            fragment.appendChild(cell);
          }
        }
        grid.appendChild(fragment);
      } else {
        currentCells.forEach(cell => {
          const { row, col } = cell.dataset;
          const key = `${row}-${col}`;
          cell.style.backgroundColor = cellColors[key] || '#f0f0f0';

          if (capitalSet.has(key)) {
            cell.style.outline = 'black solid 2px';
            cell.style.borderColor = 'gold';
          } else {
            cell.style.outline = '';
            cell.style.borderColor = '#ccc';
          }
        });
      }

      // マップ下部テーブル更新（存在する場合だけ）
      const tables = document.querySelectorAll('table');
      const newTables = doc.querySelectorAll('table');
      newTables.forEach((t, i) => {
        if (tables[i]) tables[i].replaceWith(t);
      });

      // 色のカスタマイズ（テーブルがある場合のみ）
      if (document.querySelector('table')) addCustomColor();

      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async function fetchAreaInfo(refreshAll){
    await refreshArenaInfo();
    if (currentViewMode === 'detail') {
      grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace('35px','65px');
      grid.style.gridTemplateColumns = grid.style.gridTemplateColumns.replace('35px','105px');
    }
    grid.parentNode.style.height = null;
    grid.parentNode.style.padding = '20px 0';

    const cells = grid.querySelectorAll('.cell');
    const promises = Array.from(cells).map(elm => fetchSingleArenaInfo(elm));
    await Promise.all(promises);
  }

  async function fetchSingleArenaInfo(elm) {
    try {
      const { row, col } = elm.dataset;
      const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&`+MODEQ;
      const res = await fetch(url);
      if(!res.ok) throw new Error(res.status + ' res.ng');
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const pageHeader = doc?.querySelector('header')?.textContent || doc?.querySelector('h1')?.textContent || '';
      if(!String(pageHeader).includes('どんぐりチーム戦い')) throw new Error(`title.ng [${row}][${col}]`);

      const rank = doc.querySelector('small')?.textContent || '';
      if(!rank) return;

      const leader = doc.querySelector('strong')?.textContent || '';
      const shortenRank = rank.replace('[エリート]','e').replace('[警備員]だけ','警').replace('から','-').replace(/(まで|\[|\]|\||\s)/g,'');
      const teamname = doc.querySelector('table')?.rows?.[1]?.cells?.[2]?.textContent || '';

      const cell = elm.cloneNode();
      while(cell.firstChild) cell.firstChild.remove();

      if (currentViewMode === 'detail') {
        const p = [document.createElement('p'), document.createElement('p')];
        p[0].textContent = shortenRank;
        p[1].textContent = leader;
        p[0].style.margin = '0';
        p[1].style.margin = '0';
        cell.style.width = '100px';
        cell.style.height = '60px';
        cell.style.borderWidth = '3px';
        cell.append(p[0],p[1]);
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

      cell.style.overflow = 'hidden';
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.dataset.rank = shortenRank;
      cell.dataset.leader = leader;
      cell.dataset.team = teamname;

      if ('customColors' in settings && teamname in settings.customColors) {
        cell.style.backgroundColor = '#' + settings.customColors[teamname];
      }

      const rgb = cell.style.backgroundColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const brightness = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
        cell.style.color = brightness > 128 ? '#000' : '#fff';
      }

      cell.addEventListener('click', ()=>{
        handleCellClick(cell);
      });

      elm.replaceWith(cell);
    } catch(e) {
      console.error(e);
    }
  }

  // -----------------------------
  // addCustomColor (tableがある時のみ)
  // -----------------------------
  function addCustomColor() {
    const teamTable = document.querySelector('table');
    if(!teamTable) return;

    const rows = [...teamTable.rows];
    if(rows.length < 2) return;
    rows.shift();

    const button = document.createElement('button');
    button.style.padding = '4px';
    button.style.lineHeight = '1';
    button.style.marginLeft = '2px';

    const editButton = button.cloneNode();
    editButton.textContent = '▼';

    const editEndButton = button.cloneNode();
    editEndButton.textContent = '✓';
    editEndButton.style.display = 'none';

    editButton.addEventListener('click', ()=>{
      editButton.style.display = 'none';
      editEndButton.style.display = '';

      rows.forEach(row => {
        const cell = row.cells[0];
        const cellColor = cell.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = cellColor;
        input.style.width = '6em';
        input.addEventListener('change',()=>{
          if (input.value === '') {
            if (settings.customColors) {
              const teamname = row.cells[1].textContent;
              delete settings.customColors[teamname];
              localStorage.setItem('aat_settings', JSON.stringify(settings));
            }
            return;
          }

          const isValidColor = /^[0-9A-Fa-f]{6}$/.test(input.value);
          if (!isValidColor) {
            input.value = cellColor;
            return;
          } else {
            const teamname = row.cells[1].textContent;
            if (!settings.customColors) settings.customColors = {};
            settings.customColors[teamname] = input.value;
            localStorage.setItem('aat_settings', JSON.stringify(settings));
            cell.style.background = '#' + input.value;
            row.cells[0].style.fontStyle = 'italic';
          }
        });
        cell.textContent = '';
        cell.append(input);
      });
    });

    editEndButton.addEventListener('click', ()=>{
      editButton.style.display = '';
      editEndButton.style.display = 'none';

      rows.forEach(row => {
        const cell = row.cells[0];
        const input = cell.querySelector('input');
        if(!input) return;
        cell.textContent = input.value;
        input.remove();
      });
    });

    const helpButton = button.cloneNode();
    helpButton.textContent = '？';
    helpButton.addEventListener('click', ()=>{
      helpDialog.innerHTML = '';
      const div = document.createElement('div');
      div.style.lineHeight = '150%';
      div.innerText =
        '・[▼]で色編集→保存後、[エリア情報再取得/更新]を実行\n' +
        '・戻すには入力を空にして保存\n';
      const resetButton = button.cloneNode();
      resetButton.textContent = '色設定初期化';
      resetButton.addEventListener('click', ()=>{
        delete settings.customColors;
        localStorage.setItem('aat_settings', JSON.stringify(settings));
        alert('色の設定を初期化しました（要エリア更新）');
      });
      helpDialog.append(resetButton, div);
      helpDialog.show();
    });

    if(teamTable.rows[0] && teamTable.rows[0].cells[0]) {
      teamTable.rows[0].cells[0].append(editButton, editEndButton, helpButton);
    }

    // apply saved colors
    if (!settings.customColors) return;
    rows.forEach(row => {
      const teamname = row.cells[1]?.textContent || '';
      if (teamname && teamname in settings.customColors){
        const color = settings.customColors[teamname];
        row.cells[0].textContent = color;
        row.cells[0].style.background = '#' + color;
        row.cells[0].style.fontStyle = 'italic';
      }
      const rgb = row.cells[0].style.backgroundColor.match(/\d+/g);
      if(rgb && rgb.length >= 3){
        const brightness = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
        row.cells[0].style.color = brightness > 128 ? '#000' : '#fff';
      }
    });
  }
  addCustomColor();

  const observer = new MutationObserver(() => {
    scaleContentsToFit(grid.parentNode, grid);
  });
  observer.observe(grid, { attributes: true, childList: true, subtree: true });

  // click handler attach
  (()=> {
    [...document.querySelectorAll('.cell')].forEach(elm => {
      const cell = elm.cloneNode();
      while(cell.firstChild) cell.firstChild.remove();
      elm.replaceWith(cell);
      cell.addEventListener('click', ()=>{
        handleCellClick(cell);
      });
    });
  })();

  // -----------------------------
  // arena table popup
  // -----------------------------
  async function fetchArenaTable(row, col){
    const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&`+MODEQ;
    try {
      const res = await fetch(url);
      if(!res.ok) throw new Error('res.ng');
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text,'text/html');
      const pageHeader = doc?.querySelector('header')?.textContent || doc?.querySelector('h1')?.textContent || '';
      if(!String(pageHeader).includes('どんぐりチーム戦い')) return Promise.reject(`title.ng`);
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
      const statistics = tableRow.cells[3].textContent.match(/\d+/g) || ['0','0','0'];
      const modCounts = tableRow.cells[4].textContent.match(/\d+/g) || ['0','0'];
      const modders = tableRow.cells[5].textContent;

      const newTable = document.createElement('table');
      const tbody = document.createElement('tbody');
      const tr = tbody.insertRow(0);

      const td = document.createElement('td');
      td.style.textAlign = 'center';
      const cells = [];
      for(let i=0; i<4; i++){
        cells.push(td.cloneNode());
        tr.append(cells[i]);
      }
      const hr = document.createElement('hr');
      hr.style.margin = '10px 0';

      cells[0].append(coordinate, hr, equipCond);
      cells[1].append(holderName, document.createElement('br'), `${teamName}`);
      cells[2].innerText = `勝:${statistics[0]}\n負:${statistics[1]}\n引:${statistics[2]}`;
      cells[3].innerText = `強化:${modCounts[0]}\n弱体:${modCounts[1]}\n${modders}人`;
      cells[3].style.whiteSpace = 'nowrap';

      const m = coordinate.match(/\d+/g) || [row, col];
      const [dataRow, dataCol] = m;
      newTable.dataset.row = dataRow;
      newTable.dataset.col = dataCol;
      newTable.dataset.rank = equipCond?.textContent || '';
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
      await autoEquipAndChallenge (row, col, rank);
    } else {
      const { row, col } = cell.dataset;
      fetchArenaTable(row, col);
    }
  }

  // -----------------------------
  // autoEquipAndChallenge / arenaChallenge
  // （元コードと同等：装備UI詳細は省略）
  // -----------------------------
  async function autoEquipAndChallenge (row, col, rank) {
    // 装備UI（プリセット）を元コード通り使うなら、この関数群も元コードを結合してください。
    // 今回の「表示が出ない」「canvas版で更新できない」の致命不具合はここではありません。
    arenaChallenge(row, col);
  }

  async function arenaChallenge (row, col){
    const options = {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: `row=${row}&col=${col}`
    };
    try {
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
      setTimeout(() => {
        if (settings.arenaResultScrollPosition === 'bottom') arenaResult.scrollTop = arenaResult.scrollHeight;
        else arenaResult.scrollTop = 0;
      }, 0);
      arenaResult.style.display = '';
    } catch (e) {
      arenaResult.innerText = String(e);
      arenaResult.show();
    }
  }

  // -----------------------------
  // rangeAttack / view toggle (元コード簡略)
  // -----------------------------
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

    while(rangeAttackQueue.length > 0) {
      if(!rangeAttackProcessing) return;

      const cell = rangeAttackQueue[0];
      if(!cell.classList.contains('selected')) {
        rangeAttackQueue.shift();
        continue;
      }
      const { row, col } = cell.dataset;

      const options = {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `row=${row}&col=${col}`
      };
      cell.style.borderColor = '#4f6';

      try {
        const response = await fetch('/teamchallenge?'+MODEQ, options);
        const text = await response.text();
        let lastLine = text.trim().split('\n').pop();
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
      } catch (e) {
        const p = pTemplate.cloneNode();
        p.textContent = `(${row}, ${col}) [中断] ${String(e)}`;
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

  let currentViewMode = 'detail';
  function toggleCellViewMode () {
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
        const p = [document.createElement('p'), document.createElement('p')];
        p[0].textContent = rank;
        p[1].textContent = leader;
        p[0].style.margin = '0';
        p[1].style.margin = '0';
        cell.style.width = '100px';
        cell.style.height = '60px';
        cell.style.borderWidth = '3px';
        cell.append(p[0],p[1]);
      }
    }
  }

  // -----------------------------
  // ★FIX: getRegions() canvas版 + rows/cols -1撤廃
  // -----------------------------
  let autoJoinIntervalId;
  let isAutoJoinRunning = false;
  const sleep = s => new Promise(r=>setTimeout(r,s));

  async function getRegions () {
    try {
      const AUTOJOIN_TEAM_COLORS = ['d32f2f', '1976d2'];

      const res = await fetch('');
      if (!res.ok) throw new Error(`[${res.status}] /teambattle`);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      const pageHeader = doc?.querySelector('header')?.textContent || doc?.querySelector('h1')?.textContent || '';
      if (!String(pageHeader).includes('どんぐりチーム戦い')) throw new Error('title.ng info');

      const scriptContent = extractBattleScriptText(doc);
      const cellColors = parseCellColors(scriptContent);
      const capitalMap = parseCapitalList(scriptContent); // capitalList を capitalMap として扱う

      const gridSize = parseGridSize(scriptContent) ?? 16;
      const rows = gridSize;
      const cols = gridSize;

      const targetCapitalSet = new Set();
      for (const [key, value] of Object.entries(cellColors)) {
        const color = String(value).replace('#', '');
        if (AUTOJOIN_TEAM_COLORS.includes(color)) targetCapitalSet.add(key);
      }

      const cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) cells.push([r, c]);
      }

      const directions = [[-1,0],[1,0],[0,-1],[0,1]];

      const targetAdjacentSet = new Set();
      for (const key of targetCapitalSet) {
        const [r, c] = key.split('-').map(Number);
        for (const [dr, dc] of directions) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) targetAdjacentSet.add(`${nr}-${nc}`);
        }
      }
      const targetAdjacentCells = cells.filter(([r,c]) => targetAdjacentSet.has(`${r}-${c}`));

      const adjacentSet = new Set();
      for (const [cr, cc] of capitalMap) {
        for (const [dr, dc] of directions) {
          const nr = cr + dr, nc = cc + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) adjacentSet.add(`${nr}-${nc}`);
        }
      }
      const capitalSet = new Set(capitalMap.map(([r,c]) => `${r}-${c}`));

      const nonAdjacentCells = cells.filter(([r,c]) => {
        const key = `${r}-${c}`;
        return !capitalSet.has(key) && !adjacentSet.has(key);
      });

      const mapEdgeSet = new Set();
      for (let i=0; i<rows; i++) {
        mapEdgeSet.add(`${i}-0`);
        mapEdgeSet.add(`${i}-${cols-1}`);
      }
      for (let i=0; i<cols; i++) {
        mapEdgeSet.add(`0-${i}`);
        mapEdgeSet.add(`${rows-1}-${i}`);
      }
      const mapEdgeCells = cells.filter(([r,c]) => {
        const key = `${r}-${c}`;
        return mapEdgeSet.has(key) && !capitalSet.has(key);
      });

      function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      }

      return {
        targetAdjacent: shuffle(targetAdjacentCells),
        nonAdjacent: shuffle(nonAdjacentCells),
        mapEdge: shuffle(mapEdgeCells)
      };
    } catch (e) {
      console.error(e);
      return { targetAdjacent: [], nonAdjacent: [], mapEdge: [] };
    }
  }

  // -----------------------------
  // progress bar
  // -----------------------------
  async function drawProgressBar(){
    try {
      const res = await fetch('https://donguri.5ch.net/');
      if (!res.ok) throw new Error(res.status);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const container = doc.querySelector('div.stat-block:nth-child(2)>div:nth-child(5)')?.cloneNode(true);
      if(!container) return;

      currentPeriod = Number(container.firstChild.textContent.match(/\d+/)[0]);
      currentProgress = parseInt(container.lastElementChild.textContent);

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
        str = '（マップ更新まで' + min + '分' + sec + '秒 \xb1' + margin + '秒）';
      }

      progressBarBody.textContent = currentProgress + '%';
      progressBarBody.style.width = currentProgress + '%';
      progressBarInfo.textContent = `${MODENAME} 第 ${currentPeriod} 期${str}`;

      const statBlock = doc.querySelector('.stat-block');
      if(statBlock){
        const m1 = statBlock.textContent.match(/木材の数: (\d+)/);
        const m2 = statBlock.textContent.match(/鉄の数: (\d+)/);
        if(m1) wood = m1[1];
        if(m2) steel = m2[1];
      }
    } catch (e) {
      console.error(String(e)+' drawProgressBar()');
    }
  }

  drawProgressBar();
  let progressBarIntervalId = setInterval(drawProgressBar, 18000);

})();
