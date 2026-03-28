// ==UserScript==
// @name         donguri arena assist tool
// @version      1.2.2d改 Red vs Blue 03/23版
// @description  fix arena ui and add functions
// @author       ぱふぱふ
// @match        https://donguri.5ch.io/teambattle?m=hc
// @match        https://donguri.5ch.io/teambattle?m=l
// @match        https://donguri.5ch.io/teambattle?m=rb
// @match        https://donguri.5ch.io/bag
// ==/UserScript==


(()=>{
  if(location.href === 'https://donguri.5ch.io/bag') {
    function saveCurrentEquip(url, index) {
      let currentEquip = JSON.parse(localStorage.getItem('current_equip')) || [];
      const regex = /https:\/\/donguri\.5ch\.io\/equip\/(\d+)/;
      const equipId = url.match(regex)[1];
      currentEquip[index] = equipId;
      localStorage.setItem('current_equip', JSON.stringify(currentEquip));
    }
    const tableIds = ['weaponTable', 'armorTable', 'necklaceTable'];
    tableIds.forEach((elm, index)=>{
      const equipLinks = document.querySelectorAll(`#${elm} a[href^="https://donguri.5ch.io/equip/"]`);
      [...equipLinks].forEach(link => {
        link.addEventListener('click', ()=>{
          saveCurrentEquip(link.href, index);
        })
      })
    })
    return;
  }

  const MODE = location.search.slice(1);

  let MODENAME;
  if (MODE === 'm=hc') {
      MODENAME = '［ハード］';
  } else if (MODE === 'm=l') {
      MODENAME = '［ラダー］';
  } else {
      MODENAME = '［赤vs青］';
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
  if (h4) h4.style.display = 'none';
  header.append(toolbar);

  const progressBarContainer = document.createElement('div');
  const progressBar = document.createElement('div');
  const progressBarBody = document.createElement('div');
  const progressBarInfo = document.createElement('p');

  const stageProgressBarContainer = document.createElement('div');
  const stageProgressBar = document.createElement('div');
  const stageProgressBarBody = document.createElement('div');
  const stageProgressBarInfo = document.createElement('p');

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

  stageProgressBarContainer.style.display = 'none';

  stageProgressBar.classList.add('stage-progress-bar');
  stageProgressBar.style.display = 'inline-block';
  stageProgressBar.style.width = '400px';
  stageProgressBar.style.maxWidth = '100vw';
  stageProgressBar.style.height = '14px';
  stageProgressBar.style.background = '#ddd';
  stageProgressBar.style.borderRadius = '8px';
  stageProgressBar.style.fontSize = '12px';
  stageProgressBar.style.overflow = 'hidden';
  stageProgressBar.style.marginTop = '2px';

  stageProgressBarBody.style.height = '100%';
  stageProgressBarBody.style.lineHeight = '14px';
  stageProgressBarBody.style.background = '#f0ad4e';
  stageProgressBarBody.style.textAlign = 'right';
  stageProgressBarBody.style.paddingRight = '5px';
  stageProgressBarBody.style.boxSizing = 'border-box';
  stageProgressBarBody.style.color = 'white';
  stageProgressBarBody.style.whiteSpace = 'nowrap';

  stageProgressBarInfo.style.marginTop = '2px';
  stageProgressBarInfo.style.marginBottom = '0';
  stageProgressBarInfo.style.fontSize = '12px';
  stageProgressBarInfo.style.overflow = 'auto';
  stageProgressBarInfo.style.whiteSpace = 'nowrap';

  progressBarContainer.append(progressBarInfo, progressBar);
  progressBar.append(progressBarBody);

  stageProgressBarContainer.append(stageProgressBarInfo, stageProgressBar);
  stageProgressBar.append(stageProgressBarBody);

  toolbar.append(progressBarContainer, stageProgressBarContainer);

  // add buttons and select to custom menu
  let shouldSkipAreaInfo, shouldSkipAutoEquip, cellSelectorActivate, rangeAttackProcessing,
    currentPeriod, currentProgress;
  let currentEquipName = '';

  function getRBStage(progress) {
    const p = Number(progress);
    if (!Number.isFinite(p)) return null;
    if (p <= 16) return 1;
    if (p <= 33) return 2;
    if (p <= 50) return 3;
    if (p <= 66) return 4;
    if (p <= 83) return 5;
    return 6;
  }

  function getRBStageInfo(progress) {
    const p = Number(progress);
    if (!Number.isFinite(p)) return null;

    if (p <= 16) return { stage: 1, start: 0,  end: 16,  label: '第1戦' };
    if (p <= 33) return { stage: 2, start: 17, end: 33,  label: '第2戦' };
    if (p <= 50) return { stage: 3, start: 34, end: 50,  label: '第3戦' };
    if (p <= 66) return { stage: 4, start: 51, end: 66,  label: '第4戦' };
    if (p <= 83) return { stage: 5, start: 67, end: 83,  label: '第5戦' };
    return { stage: 6, start: 84, end: 100, label: '第6戦' };
  }

  function getCurrentRBStage() {
    if (!isRedBlueMode()) return null;
    return getRBStage(currentProgress);
  }

  function isRBStageRefreshProgress(progress) {
    const p = Number(progress);
    if (!Number.isFinite(p)) return false;
    return p === 0 || p === 17 || p === 34 || p === 51 || p === 67 || p === 84;
  }

  function isRedBlueMode() {
    try {
      const params = new URLSearchParams(location.search);
      return params.get('m') === 'rb';
    } catch (e) {
      return String(location.search).includes('m=rb');
    }
  }

  function normalizeEquipIds(ids) {
    return (Array.isArray(ids) ? ids : [])
      .filter(id => id !== undefined && id !== null)
      .map(id => String(id));
  }

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
    button.style.border = 'none';

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

    const toggleViewButton = button.cloneNode();
    toggleViewButton.innerText = '表示\n切り替え';
    toggleViewButton.addEventListener('click', ()=>{
      toggleCellViewMode();
    })


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
      autoJoinButton.addEventListener('click',()=>{
        autoJoinDialog.showModal();
        if (!settings.teamColor) {
          autoJoinSettingsDialog.showModal();
        } else {
          startAutoJoin();
        }
      })

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
        })

        const inputs = {
          teamName: [input.cloneNode(),'チーム名'],
          teamColor: [input.cloneNode(),'チームカラー']
        }
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
          })
        }

        const description = document.createElement('p');
        description.style.fontSize = '90%';
        description.innerText = 'チームカラーは小文字/大文字も正確に入力してください。（自陣の隣接タイル取得に必要）\nあらかじめ装備パネルからエリートも含め各ランクの装備を登録してください。（所持していない場合は除く）\n※装備を登録していないと成功率が低下します。'
        div.append(description,closeButton);
        autoJoinSettingsDialog.append(div);
      })();

      //autoJoin
      (()=>{
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
        })
        const closeButton = document.createElement('button');
        closeButton.style.fontSize = '100%';
        closeButton.textContent = '自動参加モードを終了';
        closeButton.addEventListener('click', ()=>{
          if (typeof window.__stopAutoJoinNow === 'function') {
            window.__stopAutoJoinNow();
          }
          autoJoinDialog.close();
        })
        //closeButton.autofocus = true; // inputへのオートフォーカス阻止
        const p = document.createElement('p');
        //p.textContent = 'この画面を開いたままにしておくこと。最短600秒';
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

      div.append(skipAutoEquipButton, rangeAttackButton, autoJoinButton, settingsButton, cellButton);
      slideMenu.append(closeSlideMenuButton, startRangeAttackButton, pauseRangeAttackButton, resumeRangeAttackButton, batchSelectButton, deselectButton, batchSelectMenu);
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
    challengeButton.addEventListener('click', async(e)=>{
      const table = arenaField.querySelector('table');
      const { row, col, rank } = table.dataset;
      autoEquipDialog.style.top = `${e.clientY}px`;
      autoEquipDialog.style.transform = 'translateY(-60%)';
      await autoEquipAndChallenge(row, col, rank);
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
        const { row, col } = table.dataset;
        const action = arenaModDialog.dataset.action;
        arenaMod(row, col, action, amt);
        arenaModDialog.close();
      })

      input.addEventListener('keydown', (e)=>{
        if (e.key === "Enter") {
          e.preventDefault(); // これが無いとdialogが閉じない
          const amt = Number(input.value);
          const table = arenaField.querySelector('table');
          const { row, col } = table.dataset;
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
        body: `row=${row}&col=${col}&action=${action}&amt=${amt}&${MODE}`
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
    if (!helpDialog.contains(event.target)) {
      helpDialog.close();
    }
  });
  document.body.append(arenaResult, arenaField, helpDialog);

  const grid = document.querySelector('.grid') || document.querySelector('#gridWrap');

  if (grid && grid.parentNode) {
    grid.parentNode.style.height = null;
    grid.style.maxWidth = '100%';

    const canvases = grid.querySelectorAll('canvas');
    canvases.forEach(c => { c.style.display = 'none'; });

    grid.style.display = 'grid';
    grid.style.justifyContent = 'center';
  }

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

      const mapSettings = container.cloneNode();
      addHeader('マップ', mapSettings);
      const toolbar = container.cloneNode();
      addHeader('toolbar', toolbar);
      const arenaResult = container.cloneNode();
      addHeader('アリーナログ', arenaResult);
      const arenaField = container.cloneNode();
      addHeader('アリーナ情報', arenaField);
      //const grid = container.cloneNode();
      //addHeader('グリッド', grid);
      const settingsPanel = container.cloneNode();
      addHeader('設定パネル', settingsPanel);
      const equipPanel = container.cloneNode();
      addHeader('装備パネル', equipPanel);

      const settingItems = {
        mapPosition: {
          text: 'マップ位置:',
          type: 'select',
          options: {
            center: '中央寄せ',
            left: '左寄せ'
          },
         parent: mapSettings
       },
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
        settingsPanelPosition: {
          text: '位置:',
          type: 'select',
          options: {
            right: '右寄せ',
            left: '左寄せ'
          },
          parent: settingsPanel
        },
        settingsPanelHeight: {
          text: '高さ:',
          type: 'height',
          parent: settingsPanel
        },
        settingsPanelWidth: {
          text: '横幅:',
          type: 'width',
          parent: settingsPanel
        },
        equipPanelPosition: {
          text: '位置:',
          type: 'select',
          options: {
            right: '右寄せ',
            left: '左寄せ'
          },
          parent: equipPanel
        },
        equipPanelHeight: {
          text: '高さ:',
          type: 'height',
          parent: equipPanel
        },
        equipPanelWidth: {
          text: '横幅:',
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

      settingsMenu.append(mapSettings, toolbar, arenaResult, arenaField, settingsPanel, equipPanel);
      refreshSettings();
    })();

    const footer = document.createElement('div');
    footer.style.fontSize = '80%';
    footer.style.textAlign = 'right';

    (()=>{
      const link = document.createElement('a');
      link.style.color = '#333';
      link.textContent = '1.2.2d改 Red vs Blue';
      footer.append(link);
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
    // input.style.width = '100%';
    // input.style.boxSizing = 'border';
    // input.style.background = '#eee';
    // input.style.color = '#000';
    // input.style.borderRadius = 'unset';
    // input.placeholder = 'フィルタ…';
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
    let currentRank = '';
    let autoEquipMode = 'normal';
    const presetList = document.createElement('ul');
    presetList.style.listStyle = 'none';
    presetList.style.margin = '0';
    presetList.style.padding = '0';
    presetList.style.borderTop = 'solid 1px #000';
    presetList.style.height = '100%';
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
        const skipAutoEquipButton = document.querySelector('.skip-auto-equip');
        skipAutoEquipButton.style.background = '#888';
        shouldSkipAutoEquip = true;
        settings.skipAutoEquip = true;
        localStorage.setItem('aat_settings', JSON.stringify(settings));
      } else if (currentMode === 'remove') {
        removePresetItems(presetName);
      } else if (currentMode === 'auto') {
        selectAutoEquipItems(presetLi, presetName, currentRank);
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

      button.style.flex = '0 0 auto';

      /*
      const closeButton = button.cloneNode();
      closeButton.textContent = '×';
      closeButton.style.marginLeft = 'auto';
      closeButton.style.background = 'none';
      closeButton.style.border = 'none';
      //closeButton.style.height = '40px';
      closeButton.style.width = '40px';
      closeButton.style.fontSize = '32px';
      closeButton.style.lineHeight = '1';
      closeButton.addEventListener('click', ()=>{
        panel.style.display = 'none';
      })
      */

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
      /*
      const editButton = button.cloneNode();
      editButton.textContent = '編集';
      editButton.dataset.text = '編集';
      editButton.dataset.mode = 'edit';
      */

      const equipSettingsButton = button.cloneNode();
      equipSettingsButton.textContent = '装備登録';
      equipSettingsButton.dataset.text = '装備登録';
      equipSettingsButton.dataset.mode = 'auto';

      const equipSettingsDialog = document.createElement('dialog');
      equipSettingsDialog.style.background = '#fff';
      equipSettingsDialog.style.color = '#000';
      equipSettingsDialog.style.padding = '1px';
      equipSettingsDialog.style.maxWidth = '280px';
      (()=>{
        const div = document.createElement('div');
        div.style.display = 'grid';
        div.style.gap = '2px';
        div.style.gridTemplateColumns = 'repeat(2, 4em)';
        div.style.justifyContent = 'center';

        const ranks = ['N', 'Ne', 'R', 'Re', 'SR', 'SRe', 'SSR', 'SSRe', 'UR', 'URe'];
        ranks.forEach(rank => {
          const rankButton = button.cloneNode();
          rankButton.style.width = '100px';
          rankButton.textContent = rank;
          rankButton.addEventListener('click',()=>{
            currentRank = rank;
            currentMode = 'auto';
            setMode('auto', equipSettingsButton);

            const target = autoEquipMode === 'autojoin' ? 'autoEquipItemsAutojoin' : 'autoEquipItems';
            const items = JSON.parse(localStorage.getItem(target)) || {};
            if(items[rank]) {
              const li = [...presetList.querySelectorAll('li')];
              const registeredItems = li.filter(elm => {
                const name = elm.querySelector('span').textContent;
                return items[rank].includes(name);
              })
              for(const e of registeredItems) {
                e.style.color = 'rgb(202, 139, 66)';
              }
            }
            equipSettingsDialog.close();
          })
          div.append(rankButton);
        })

        const closeButton = button.cloneNode();
        closeButton.style.width = '100px';
        closeButton.style.background = '#caa';
        closeButton.textContent = '×';
        closeButton.addEventListener('click',()=>{
          equipSettingsDialog.close();
        })

        const div2 = document.createElement('div');
        div2.style.textAlign = 'center';
        const toggleButton = button.cloneNode();
        toggleButton.textContent = '対戦用';
        toggleButton.style.width = '7em';
        toggleButton.style.background = '#acc';
        toggleButton.addEventListener('click',()=>{
          if (autoEquipMode === 'normal') {
            autoEquipMode = 'autojoin';
            toggleButton.textContent = '自動参加用';
          } else {
            autoEquipMode = 'normal';
            toggleButton.textContent = '対戦用';
          }
        })

        const label = document.createElement('label');
        label.style.fontSize = '80%';
        const checkRandom = document.createElement('input');
        checkRandom.type = 'checkbox';
        if (settings.autoEquipRandomly) checkRandom.checked = true;
        checkRandom.addEventListener('change', ()=>{
          settings.autoEquipRandomly = checkRandom.checked;
          localStorage.setItem('aat_settings', JSON.stringify(settings));
        })
        label.append(checkRandom, 'ランダム装備');

        div.append(closeButton);
        div2.append(toggleButton,label);

        const description = document.createElement('div');
        description.innerText = '対戦に使用する装備を選択してください。バトル開始前に自動的に装備を変更します。複数登録した場合は開始時に装備するものを選択します。\nヒント: メインとなる1つのセットを使うことがほとんどなら1つのみ登録／複数の装備を使い分けることが多いなら複数登録しておくと切り替えの手間が少なくなる。\nまたは、ランダム装備にチェックを入れると、登録してある中から自動でランダムに選択\n\n自動参加用を登録しておくと、通常の対戦用とは別の装備を使用する。登録していない場合は対戦用装備を使用。';
        description.style.fontSize = '70%';

        equipSettingsDialog.append(div, div2, description);
      })();

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
          if(isSuccess) {
            backupDialog.close();
            const equipPresets = JSON.parse(localStorage.getItem('equipPresets')) || {};
            const autoEquipItems = JSON.parse(localStorage.getItem('autoEquipItems')) || {};
            const autoEquipItemsAutojoin = JSON.parse(localStorage.getItem('autoEquipItemsAutojoin')) || {};

            const validKeys = new Set(Object.keys(equipPresets));

            for (const target of [autoEquipItems, autoEquipItemsAutojoin]) {
              for (const key of Object.keys(target)) {
                target[key] = target[key].filter(v => validKeys.has(v))
              }
            }
            localStorage.setItem('autoEquipItems', JSON.stringify(autoEquipItems));
            localStorage.setItem('autoEquipItemsAutojoin', JSON.stringify(autoEquipItemsAutojoin));
          }
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

      equipSettingsButton.addEventListener('click',()=>{
        equipSettingsDialog.showModal();
        resetMode();
      })
      function setMode(mode, button) {
        resetMode();
        currentMode = mode;
        button.textContent = '完了';
        button.classList.add('active');
        if(mode === 'remove') stat.textContent = '削除したいものを選択';
        else if (mode === 'edit') stat.textContent = 'クリックで編集';
        else if (mode === 'auto') stat.textContent = 'クリックで選択(複数選択可)';
      }

      function resetMode() {
        if (currentMode) {
          const activeButton = document.querySelector('.active');
          if (activeButton) {
            activeButton.textContent = activeButton.dataset.text;
            activeButton.classList.remove('active');
          }
          if (currentMode === 'auto') {
            for(const li of presetList.querySelectorAll('li')) {
              li.style.color = 'rgb(66, 139, 202)';
            }
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

      (()=>{
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.flexWrap = 'nowrap';
        div.style.overflowX = 'auto';
        div.style.width = 'max-content';
        div.append(addButton, removeButton, equipSettingsButton, backupButton);
        buttonsContainer.append(div);
      })();
      div.append(buttonsContainer, equipSettingsDialog, backupDialog, stat);
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
          const res = await fetch('https://donguri.5ch.io/bag');
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
              const id = row.cells[1].querySelector('a')?.href.replace('https://donguri.5ch.io/equip/','');
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
      span1.style.overflow = 'hidden';
      const span2 = document.createElement('span');
      span2.style.whiteSpace = 'nowrap';
      span2.style.textAlign = 'right';
      span2.style.overflow = 'hidden';
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


    function removePresetItems(presetName) {
      const userConfirmed = confirm(presetName + ' を削除しますか？');
      if(!userConfirmed) return;
      const stat = document.querySelector('.equip-preset-stat');
      const equipPresets = JSON.parse(localStorage.getItem('equipPresets')) || {};
      const autoEquipItems = JSON.parse(localStorage.getItem('autoEquipItems')) || {};
      const autoEquipItemsAutojoin = JSON.parse(localStorage.getItem('autoEquipItemsAutojoin')) || {};

      if(!equipPresets || !equipPresets[presetName]) {
        stat.textContent = '';
        return;
      }
      delete equipPresets[presetName];
      for (const key in autoEquipItems) {
        if (Array.isArray(autoEquipItems[key])) {
          autoEquipItems[key] = autoEquipItems[key].filter(v => v !== presetName);
        }
      }
      for (const key in autoEquipItemsAutojoin) {
        if (Array.isArray(autoEquipItemsAutojoin[key])) {
          autoEquipItemsAutojoin[key] = autoEquipItemsAutojoin[key].filter(v => v !== presetName);
        }
      }
      localStorage.setItem('equipPresets', JSON.stringify(equipPresets));
      localStorage.setItem('autoEquipItems', JSON.stringify(autoEquipItems));
      localStorage.setItem('autoEquipItemsAutojoin', JSON.stringify(autoEquipItemsAutojoin));
      showEquipPreset();
    }

    function selectAutoEquipItems(li, name, rank) {
      const target = autoEquipMode === 'autojoin' ? 'autoEquipItemsAutojoin' : 'autoEquipItems';
      const items = JSON.parse(localStorage.getItem(target)) || {};

      if(getComputedStyle(li).color === 'rgb(66, 139, 202)') {
        li.style.color = 'rgb(202, 139, 66)';
        (items[rank] ||= []).push(name);
      } else {
        li.style.color = 'rgb(66, 139, 202)';
        const index = items[rank].indexOf(name);
        if (index !== -1){
          items[rank].splice(index,1);
        }
      }

      localStorage.setItem(target, JSON.stringify(items));
      console.log(items[rank]);
    }
  })();
  //-- ここまで --//
  async function setPresetItems (presetName, options = {}) {
    const { force = false } = options;
    const stat = document.querySelector('.equip-preset-stat');
    const equipPresets = JSON.parse(localStorage.getItem('equipPresets')) || {};
    const preset = equipPresets[presetName];

    if (!preset || !Array.isArray(preset.id)) {
      throw new Error(`装備プリセットが見つかりません: ${presetName}`);
    }

    const targetIds = normalizeEquipIds(preset.id);
    const currentIds = normalizeEquipIds(JSON.parse(localStorage.getItem('current_equip')) || []);

    if (!force && currentEquipName === presetName && JSON.stringify(targetIds) === JSON.stringify(currentIds)) {
      if (stat) stat.textContent = '維持: ' + presetName;
      return presetName;
    }

    if (!force && stat && stat.textContent === '装備中...') {
      return currentEquipName || null;
    }

    if (stat) stat.textContent = '装備中...';

    try {
      for (const id of targetIds) {
        const response = await fetch('https://donguri.5ch.io/equip/' + id);
        if (!response.ok) {
          throw new Error(`[${response.status}] /equip/`);
        }

        const text = await response.text();

        if (text.includes('どんぐりが見つかりませんでした。')) {
          throw new Error('再ログインしてください');
        } else if (text.includes('アイテムが見つかりませんでした。')) {
          throw new Error('アイテムが見つかりませんでした');
        }

        const doc = new DOMParser().parseFromString(text, 'text/html');
        const title = doc.querySelector('h1')?.textContent;
        if (title === 'どんぐり基地') {
          throw new Error('再ログインしてください');
        } else if (title !== 'アイテムバッグ') {
          throw new Error('装備エラー');
        }

        await sleep(300);
      }

      localStorage.setItem('current_equip', JSON.stringify(targetIds));
      currentEquipName = presetName;
      if (stat) stat.textContent = '完了: ' + presetName;
      return presetName;
    } catch (e) {
      if (stat) stat.textContent = String(e);
      currentEquipName = '';
      localStorage.removeItem('current_equip');
      throw e;
    }
  }

  function scaleContentsToFit(container, contents){
    const containerWidth = container.clientWidth;
    const contentsWidth = contents.scrollWidth;
    const scaleFactor = Math.min(1, containerWidth / contentsWidth);
    contents.style.transform = `scale(${scaleFactor})`;
    contents.style.transformOrigin = 'top left';

    const scaledHeight = contents.scrollHeight * scaleFactor;

    contents.style.height = `${scaledHeight}px`;
  }

  async function refreshArenaInfo() {
    const refreshedCells = [];
    function includesCoord(arr, row, col) {
      if (!arr) return false;
      return arr.some(([r, c]) => r === Number(row) && c === Number(col));
    }

    try {
      const res = await fetch('');
      if (!res.ok) throw new Error('res.ng');

      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      const allScripts = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');

      const cellColorsMatch = allScripts.match(/cellColors\s*=\s*({.+?})/s);
      const validJsonStr = cellColorsMatch[1].replace(/'/g, '"').replace(/,\s*}/g, '}');
      const cellColors = JSON.parse(validJsonStr);

      const capMatch = allScripts.match(/const (?:capitalMap|capitalList)\s*=\s*(\[.*?\]);/s);
      const capitalMap = capMatch ? JSON.parse(capMatch[1]) : [];

      const gridSizeMatch = allScripts.match(/const GRID_SIZE\s*=\s*(\d+);/);
      const rows = gridSizeMatch ? Number(gridSizeMatch[1]) : 5;
      const cols = rows;

      const avatarMatch = allScripts.match(/window\.__AVATARS\s*=\s*({[\s\S]*?});/);
      const myAvatar = avatarMatch ? JSON.parse(avatarMatch[1]).myAvatar : null;

      const terrainData = {};
      try {
        const terrainMatch = allScripts.match(/const terrainsPayload\s*=\s*({.+?});/s);
        if (terrainMatch) {
          const payload = JSON.parse(terrainMatch[1]);
          if (payload.terrains && Array.isArray(payload.terrains)) {
            payload.terrains.forEach(item => {
              if (item.t === 'w') {
                terrainData[`${item.x}-${item.y}`] = 'water';
              }
            });
          }
        }
      } catch (e) {
        console.error("Terrain parse error", e);
      }

      const currentCells = grid.querySelectorAll('.cell');

      grid.style.display = 'grid';
      grid.style.gridTemplateRows = `repeat(${rows}, 35px)`;
      grid.style.gridTemplateColumns = `repeat(${cols}, 35px)`;
      grid.style.gap = '2px';
      grid.style.justifyContent = settings.mapPosition === 'left' ? 'start' : 'center';
      grid.style.position = 'relative';

      grid.style.maxWidth = '100%';
      grid.style.boxSizing = 'border-box';

      if (currentCells.length !== rows * cols) {
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
            cell.style.zIndex = '100';

            const cellKey = `${i}-${j}`;

            if (terrainData[cellKey] === 'water') {
              cell.dataset.terrain = 'water';
              cell.style.backgroundColor = '#bbdefb';
            } else {
              cell.style.backgroundColor = cellColors[cellKey] || '#ffffff00';
            }

            if (includesCoord(capitalMap, i, j)) {
              cell.style.outline = 'black solid 2px';
              cell.style.borderColor = 'gold';
            }
            if (myAvatar && Number(myAvatar.row) === i && Number(myAvatar.col) === j) {
              cell.style.outline = '3px solid yellow';
            }
            grid.appendChild(cell);
            refreshedCells.push(cell);
          }
        }
      } else {
        currentCells.forEach(cell => {
          const { row, col } = cell.dataset;
          const cellKey = `${row}-${col}`;

          let targetColor;
          if (terrainData[cellKey] === 'water') {
            cell.dataset.terrain = 'water';
            targetColor = '#bbdefb';
          } else {
            delete cell.dataset.terrain;
            targetColor = cellColors[cellKey] || '#ffffff00';
          }

          if (cell.style.backgroundColor !== targetColor) {
            cell.style.backgroundColor = targetColor;
            refreshedCells.push(cell);
          }
          cell.style.outline = includesCoord(capitalMap, row, col) ? 'black solid 2px' : '';
          if (myAvatar && Number(myAvatar.row) === Number(row) && Number(myAvatar.col) === Number(col)) {
            cell.style.outline = '3px solid yellow';
          }
        });
      }

      const tables = document.querySelectorAll('table');
      const newTables = doc.querySelectorAll('table');
      newTables.forEach((table, i) => { if (tables[i]) tables[i].replaceWith(table); });
      //gridLegendを非表示化
      const legend = document.getElementById('gridLegend');
      if (legend) {
        legend.style.display = 'none';
      }

      addCustomColor();
      return refreshedCells;
    } catch (e) {
      console.error('refreshArenaInfo Error:', e);
      return [];
    }
  }

  async function fetchAreaInfo(refreshAll){
    const refreshedCells = await refreshArenaInfo();
    if (currentViewMode === 'detail') {
      if (grid) {
        grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace('35px','65px');
        grid.style.gridTemplateColumns = grid.style.gridTemplateColumns.replace('35px','105px');
      }
    }
    if (grid && grid.parentNode) {
      grid.parentNode.style.height = null;
      grid.parentNode.style.padding = '20px 0';
      grid.parentNode.style.maxWidth = '100%';
      grid.parentNode.style.overflowX = settings.mapPosition === 'left' ? 'auto' : '';
    }

    const cells = grid ? grid.querySelectorAll('.cell') : [];
    cells.forEach(async(elm) => {
      const hasInfo = elm.dataset.rank !== undefined;
      const isRefreshed = refreshedCells.includes(elm);
      if(refreshAll || !hasInfo || isRefreshed) {
        fetchSingleArenaInfo(elm)
      }
    })
  }

  async function fetchSingleArenaInfo(elm) {
    try {
      const { row, col } = elm.dataset;
      const url = `https://donguri.5ch.io/teambattle?r=${row}&c=${col}&`+MODE;
      const res = await fetch(url);
      if(!res.ok) throw new Error(res.status + ' res.ng');
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const headerText = doc?.querySelector('header')?.textContent || '';
      if(!headerText.includes('どんぐりチーム戦い')) return;
      const rank = doc.querySelector('small')?.textContent || '';
      if(!rank) return;
      const leader = doc.querySelector('strong')?.textContent || '';
      const shortenRank = rank.replace('[エリート]','e').replace('[警備員]だけ','警').replace('から','-').replace(/(まで|\[|\]|\||\s)/g,'');
      const teamname = doc.querySelector('table').rows[1]?.cells[2].textContent;

      const cell = elm.cloneNode();
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
      cell.style.zIndex = '100';
      cell.style.pointerEvents = 'auto';
      cell.style.position = 'relative';
      cell.style.overflow = 'hidden';
      cell.dataset.rank = shortenRank;
      cell.dataset.leader = leader;
      cell.dataset.team = teamname;

      if ('customColors' in settings && teamname in settings.customColors) {
        cell.style.backgroundColor = '#' + settings.customColors[teamname];
      }
      const rgb = cell.style.backgroundColor.match(/\d+/g);
      const brightness = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      cell.style.color = brightness > 128 ? '#000' : '#fff';

      cell.addEventListener('click', ()=>{
        handleCellClick(cell);
      });
      elm.replaceWith(cell);
    } catch(e) {
      console.error(e);
    }
  }

  function addCustomColor() {
    const teamTable = document.querySelector('table');
    const rows = [...teamTable.rows];
    rows.shift();
    const button = document.createElement('button');
    button.style.padding = '4px';
    button.style.lineHeight = '1';
    button.style.marginLeft = '2px';

    const editButton = button.cloneNode();
    editButton.textContent = '▼';
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
        })
        cell.textContent = '';
        cell.append(input);
      })
    })
    const editEndButton = button.cloneNode();
    editEndButton.textContent = '?';
    editEndButton.style.display = 'none';
    editEndButton.addEventListener('click', ()=>{
      editButton.style.display = '';
      editEndButton.style.display = 'none';

      rows.forEach(row => {
        const cell = row.cells[0];
        const input = cell.querySelector('input');
        cell.textContent = input.value;
        input.remove();
      })
    })

    const helpButton = button.cloneNode();
    helpButton.textContent = '？';
    helpButton.addEventListener('click', ()=>{
      helpDialog.innerHTML = '';
      const div = document.createElement('div');
      div.style.lineHeight = '150%';
      div.innerText = `・[▼]を押すと色を編集できます。編集後は一度[エリア情報再取得]を実行してください。
      ・変更したチームのセルは[エリア情報更新]時に必ず取得されるようになります。
      *更新時の読み込みを増やしたくない場合は、無闇に変更しないことを推奨します。
      ・同色のチームが複数存在する場合、それぞれの色を変更することで同色の塗り替えに対応可能です。(カスタムカラーで上書きされたセルは常に読み込みの対象になるため)
      ・編集した色を戻すには入力欄の文字を全て消した状態で保存してください。

      仕様 (読まなくてよい)：
      [エリア情報再取得]は全エリアにアクセスし情報を取得するのに対し、[エリア情報更新]は色が更新されたセルのみを取得するようにしてある。
      ここで、同色のAとBのチームが存在する状況を想定する。
      ・Bの色のみを編集した場合、Aが保持するセルをBが獲得した際、編集前の色情報が同一のためセル情報の取得が行われない。
      ・AとBの双方を編集しておくと、Aが保持するセルは常に色情報が更新された扱いとなり取得対象になる。
      要するに、同色の場合は全て色を変えておくとよいということ。同色がいなくなったら戻せばOK.
      `;
      const resetButton = button.cloneNode();
      resetButton.textContent = '色設定初期化';
      resetButton.addEventListener('click', ()=>{
        delete settings.customColors;
        localStorage.setItem('aat_settings', JSON.stringify(settings));
        alert('色の設定を初期化しました（要エリア更新）');
      })
      helpDialog.append(resetButton, div);
      helpDialog.show();
    })
    teamTable.rows[0].cells[0].append(editButton, editEndButton, helpButton);

    function setCustomColors(rows) {
      if (!settings.customColors) return;
      rows.forEach(row => {
        const teamname = row.cells[1].textContent;
        if ('customColors' in settings && teamname in settings.customColors){
          const color = settings.customColors[teamname];
          row.cells[0].textContent = color;
          row.cells[0].style.background = '#' + color;
          row.cells[0].style.fontStyle = 'italic';
        }
        const rgb = row.cells[0].style.backgroundColor.match(/\d+/g);
        const brightness = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
        row.cells[0].style.color = brightness > 128 ? '#000' : '#fff';
      })
    }
    setCustomColors(rows);
  }
  addCustomColor();

  const observer = new MutationObserver(() => {
    if (grid && grid.parentNode) {
      scaleContentsToFit(grid.parentNode, grid);
    }
  });

  if (grid) {
    observer.observe(grid, { attributes: true, childList: true, subtree: true });
  }

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
    const url = `https://donguri.5ch.io/teambattle?r=${row}&c=${col}&`+MODE;
    try {
      const res = await fetch(url);
      if(!res.ok) throw new Error('res.ng');
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text,'text/html');
      const headerText = doc?.querySelector('header')?.textContent || '';
      if(!headerText.includes('どんぐりチーム戦い')) return Promise.reject(`title.ng`);
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
      cells[1].append(holderName, document.createElement('br'), `${teamName}`);
      cells[2].innerText = `勝:${statistics[0]}\n負:${statistics[1]}\n引:${statistics[2]}`;
      cells[3].innerText = `強化:${modCounts[0]}\n弱体:${modCounts[1]}\n${modders}人`;
      cells[3].style.whiteSpace = 'nowrap';

      const [dataRow, dataCol] = coordinate.match(/\d+/g);
      newTable.dataset.row = dataRow;
      newTable.dataset.col = dataCol;
      newTable.dataset.rank = equipCond.textContent;
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

  const autoEquipDialog = document.createElement('dialog');
  autoEquipDialog.style.padding = '0';
  autoEquipDialog.style.background = '#fff';
  document.body.append(autoEquipDialog);
  async function autoEquipAndChallenge (row, col, rank) {
    if (shouldSkipAutoEquip) {
      arenaChallenge(row, col);
      return;
    }
    rank = rank
      .replace('エリート','e')
      .replace(/.+から|\w+-|まで|だけ|警備員|警|\s|\[|\]|\|/g,'');
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
      } else {
        while (autoEquipDialog.firstChild) {
          autoEquipDialog.firstChild.remove();
        }
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

        autoEquipItems[rank].forEach(v => {
          const li = liTemplate.cloneNode();
          li.textContent = v;
          li.addEventListener('click', async()=>{
            autoEquipDialog.close();
            await setPresetItems(v);
            arenaChallenge(row, col);
          })
          ul.append(li);
        })
        autoEquipDialog.append(ul);
        autoEquipDialog.showModal();
      }
    } else {
      arenaChallenge(row, col);
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
      const response = await fetch('/teamchallenge?'+MODE, options);
      if(!response.ok){
        throw new Error('/teamchallenge res.ng');
      }
      const text = await response.text();
      arenaResult.innerText = text;

      const lastLine = text.trim().split('\n').pop();
      if(text.includes('\n')) {
        lastLine + '\n' + text;
        const p = document.createElement('p');
        p.textContent = lastLine;
        p.style.fontWeight = 'bold';
        p.style.padding = '0';
        p.style.margin = '0';
        arenaResult.prepend(p);
      }

      arenaResult.show();
      // arenaResult.show();のあとでsetTimeoutを使用しないと位置がずれる
      setTimeout(() => {
        if (settings.arenaResultScrollPosition === 'bottom') {
          arenaResult.scrollTop = arenaResult.scrollHeight;
        } else {
          arenaResult.scrollTop = 0;
        }
      }, 0);
      arenaResult.style.display = '';

      if (lastLine === 'リーダーになった' || lastLine === 'この場所を占領しました。' || lastLine.includes('は新しいアリーナリーダーです。')) {
        if (!settings.teamColor) return;
        const cell = document.querySelector(`div[data-row="${row}"][data-col="${col}"]`);
        cell.style.background = '#' + settings.teamColor;
        fetchSingleArenaInfo(cell);
      }
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
    //for(const cell of rangeAttackQueue) {
    while(rangeAttackQueue.length > 0) {
      if(!rangeAttackProcessing) return;

      const cell = rangeAttackQueue[0];
      // 攻撃前に選択解除された場合
      if(!cell.classList.contains('selected')) {
        rangeAttackQueue.shift();
        continue;
      }
      const { row, col } = cell.dataset;

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `row=${row}&col=${col}`
      };
      cell.style.borderColor = '#4f6';

      try {
        const response = await fetch('/teamchallenge?'+MODE, options);
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

  let currentViewMode = 'detail';
  function toggleCellViewMode () {
    const grid = document.querySelector('.grid') || document.querySelector('#gridWrap');
    if (!grid) return;
    const cells = grid.querySelectorAll('.cell');
    const count = Math.sqrt(cells.length);

    if(currentViewMode === 'detail') {
      currentViewMode = 'compact';

      grid.style.gridTemplateRows = `repeat(${count}, 35px)`;
      grid.style.gridTemplateColumns = `repeat(${count}, 35px)`;

      for (const cell of cells) {
        if (!cell.dataset.rank) continue;

        cell.style.width = '30px';
        cell.style.height = '30px';
        cell.style.borderWidth = '1px';
        while (cell.firstChild) {
          cell.firstChild.remove();
        }
        const p = document.createElement('p');
        p.style.height = '28px';
        p.style.width = '28px';
        p.style.margin = '0';
        p.style.display = 'flex';
        p.style.alignItems = 'center';
        p.style.lineHeight = '1';
        p.style.justifyContent = 'center';
        const rank = cell.dataset.rank.replace(/\w+-|だけ/g,'');
        p.textContent = rank;
        if (rank.length === 3) p.style.fontSize = '14px';
        if (rank.length === 4) p.style.fontSize = '13px';
        cell.append(p);
      }
    } else {
      currentViewMode = 'detail';

      grid.style.gridTemplateRows = `repeat(${count}, 65px)`;
      grid.style.gridTemplateColumns = `repeat(${count}, 105px)`;

      for (const cell of cells) {
        if (!cell.dataset.rank) continue;

        while (cell.firstChild) {
          cell.firstChild.remove();
        }
        const {rank, leader } = cell.dataset;
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

  let autoJoinIntervalId;
  let isAutoJoinRunning = false;
  let lastAutoJoinStatusKey = '';
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
      else regionDiv.innerText = `${progress}\n${region ? `target: ${region}\n` : ''}${next}`;
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

    function logAutoJoinGuideOnce(key, message, region = null, extra = '') {
      if (lastAutoJoinGuideKey === key) return;
      lastAutoJoinGuideKey = key;
      logMessage(region, message, extra);
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
        'この場所には首都を建設できません（水で隣接が不足）',
        'このタイルは攻撃できません。水タイルは占領できません。',
        'このタイルは攻撃できません。あなたのチームが首都を持つまで、どの首都にも隣接するタイルを主張することはできません。',
        'あなたのチームは首都を持っていないため、他のチームの首都に攻撃できません。'
      ],
      teamAdjacent: [
        'このタイルには移動または攻撃できません。現在位置に隣接するタイルのみ選択できます。',
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
    };

    function getMessageType(text) {
      const result = Object.keys(messageTypes)
        .find(key => messageTypes[key]
          .some(v => text.includes(v))
        );
      return result;
    }

    function pickNextProgress() {
      if (currentProgress < 16) {
        return Math.floor(Math.random() * 7) + 23;
      } else if (currentProgress < 33) {
        return Math.floor(Math.random() * 7) + 40;
      } else if (currentProgress < 50) {
        return Math.floor(Math.random() * 7) + 56;
      } else if (currentProgress < 66) {
        return Math.floor(Math.random() * 7) + 73;
      } else if (currentProgress < 83) {
        return Math.floor(Math.random() * 7) + 90;
      }
      return Math.floor(Math.random() * 7) + 6;
    }

    function keyOf(r, c) {
      return `${r}-${c}`;
    }

    function orthNeighbors(state, rc) {
      const out = [];
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr, dc] of dirs) {
        const nr = rc.r + dr;
        const nc = rc.c + dc;
        if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) {
          out.push({ r: nr, c: nc });
        }
      }
      return out;
    }

    function isExplorable(state, r, c) {
      if (!state.hasCapital) return true;
      return state.exploredSet.has(keyOf(r, c));
    }

    function teamAt(state, r, c) {
      return state.teamMap[keyOf(r, c)] || 0;
    }

    function isWater(state, r, c) {
      return state.waterSet.has(keyOf(r, c));
    }

    function isFriendly(state, r, c) {
      return teamAt(state, r, c) === state.myTeamCode;
    }

    function isEnemy(state, r, c) {
      const t = teamAt(state, r, c);
      return state.myTeamCode !== 0 && t !== 0 && t !== state.myTeamCode;
    }

    function isEmpty(state, r, c) {
      return teamAt(state, r, c) === 0;
    }

    function canStepOn(state, r, c) {
      if (!isExplorable(state, r, c)) return false;
      if (isWater(state, r, c)) return false;
      return isFriendly(state, r, c) || isEmpty(state, r, c);
    }

    function findOwnCapital(state) {
      for (const [r, c] of state.capitalList) {
        if (isFriendly(state, r, c)) return { r, c };
      }
      for (const [r, c] of state.capitalList) {
        const friendlyAdj = orthNeighbors(state, { r, c }).filter(n => isFriendly(state, n.r, n.c)).length;
        if (friendlyAdj > 0) return { r, c };
      }
      return state.capitalList[0] ? { r: state.capitalList[0][0], c: state.capitalList[0][1] } : null;
    }

    function findOwnedCapitalStrict(state) {
      for (const [r, c] of state.capitalList) {
        if (isFriendly(state, r, c)) return { r, c };
      }
      for (const [r, c] of state.capitalList) {
        const friendlyAdj = orthNeighbors(state, { r, c }).filter(n => isFriendly(state, n.r, n.c)).length;
        if (friendlyAdj > 0) return { r, c };
      }
      return null;
    }

    function currentPos(state) {
      if (state.myAvatar) return { r: state.myAvatar.r, c: state.myAvatar.c };
      return null;
    }

    function isCapitalTile(state, r, c) {
      return state.capitalList.some(([cr, cc]) => cr === r && cc === c);
    }

    function isOwnFort(state, r, c) {
      const b = state.buildingMap?.[keyOf(r, c)];
      if (!b) return false;
      if (b.kind !== 'f') return false;
      return b.team === state.myTeamCode;
    }

    function countOwnFortsAround(state, center) {
      if (!center) return 0;
      return orthNeighbors(state, center).filter(v => isOwnFort(state, v.r, v.c)).length;
    }

    function getHomeAnchor(state) {
      const ownCapital = findOwnedCapitalStrict(state);
      if (ownCapital) {
        return { r: ownCapital.r, c: ownCapital.c };
      }
      return null;
    }

    function collectHomeRingEmptyCells(state, center) {
      if (!center) return [];

      const ringOrder = [
        { r: center.r - 1, c: center.c     },
        { r: center.r - 1, c: center.c + 1 },
        { r: center.r,     c: center.c + 1 },
        { r: center.r + 1, c: center.c + 1 },
        { r: center.r + 1, c: center.c     },
        { r: center.r + 1, c: center.c - 1 },
        { r: center.r,     c: center.c - 1 },
        { r: center.r - 1, c: center.c - 1 }
      ];

      const seen = new Set();
      const out = [];

      for (const v of ringOrder) {
        if (v.r < 0 || v.c < 0 || v.r >= state.rows || v.c >= state.cols) continue;
        const k = keyOf(v.r, v.c);
        if (seen.has(k)) continue;
        seen.add(k);
        if (!isExplorable(state, v.r, v.c)) continue;
        if (isWater(state, v.r, v.c)) continue;
        if (!isEmpty(state, v.r, v.c)) continue;
        out.push({ r: v.r, c: v.c });
      }

      return out;
    }

    function collectCapitalCollapseEmptyCells(state, capitalCoord) {
      const q = [{ r: capitalCoord.r, c: capitalCoord.c }];
      const seen = new Set([keyOf(capitalCoord.r, capitalCoord.c)]);
      const out = [];
      const outSet = new Set();

      while (q.length > 0) {
        const cur = q.shift();

        for (const nxt of orthNeighbors(state, cur)) {
          const nk = keyOf(nxt.r, nxt.c);
          if (seen.has(nk)) continue;
          seen.add(nk);

          if (!isExplorable(state, nxt.r, nxt.c)) continue;
          if (isWater(state, nxt.r, nxt.c)) continue;
          if (isEnemy(state, nxt.r, nxt.c)) continue;

          if (isEmpty(state, nxt.r, nxt.c)) {
            if (!outSet.has(nk)) {
              outSet.add(nk);
              out.push({ r: nxt.r, c: nxt.c });
            }
          }

          q.push(nxt);
        }
      }

      return out;
    }

    function reconstructPath(parentMap, goalKey) {
      const path = [];
      let curKey = goalKey;
      while (curKey) {
        const [r, c] = curKey.split('-').map(Number);
        path.push({ r, c });
        curKey = parentMap.get(curKey) || null;
      }
      path.reverse();
      return path;
    }

    function bfsToPriorityEmpty(state, start) {
      const priorityEmptyCells = Array.isArray(state.priorityEmptyCells) ? state.priorityEmptyCells : [];
      const prioritySet = new Set(
        priorityEmptyCells
          .filter(v => v && Number.isInteger(v.r) && Number.isInteger(v.c))
          .map(v => keyOf(v.r, v.c))
      );

      if (!prioritySet.size) return null;

      const q = [start];
      const seen = new Set([keyOf(start.r, start.c)]);
      const parent = new Map();

      while (q.length > 0) {
        const cur = q.shift();
        const curKey = keyOf(cur.r, cur.c);

        if (
          !(cur.r === start.r && cur.c === start.c) &&
          prioritySet.has(curKey) &&
          isEmpty(state, cur.r, cur.c)
        ) {
          return reconstructPath(parent, curKey);
        }

        for (const nxt of orthNeighbors(state, cur)) {
          const nk = keyOf(nxt.r, nxt.c);
          if (seen.has(nk)) continue;
          if (!canStepOn(state, nxt.r, nxt.c)) continue;
          seen.add(nk);
          parent.set(nk, curKey);
          q.push(nxt);
        }
      }

      return null;
    }

    function bfsToNearestEmpty(state, start) {
      const q = [start];
      const seen = new Set([keyOf(start.r, start.c)]);
      const parent = new Map();
      while (q.length > 0) {
        const cur = q.shift();
        const curKey = keyOf(cur.r, cur.c);
        if (!(cur.r === start.r && cur.c === start.c) && isEmpty(state, cur.r, cur.c)) {
          return reconstructPath(parent, curKey);
        }
        for (const nxt of orthNeighbors(state, cur)) {
          const nk = keyOf(nxt.r, nxt.c);
          if (seen.has(nk)) continue;
          if (!canStepOn(state, nxt.r, nxt.c)) continue;
          seen.add(nk);
          parent.set(nk, curKey);
          q.push(nxt);
        }
      }
      return null;
    }

    function canAttackEnemyCapital(state, r, c) {
      if (!isCapitalTile(state, r, c)) return true;

      const neighbors = orthNeighbors(state, { r, c });
      const requiredFriendlyCount = Math.max(1, neighbors.length - 1);
      const friendlyAdjCount = neighbors.filter(n => isFriendly(state, n.r, n.c)).length;

      return friendlyAdjCount >= requiredFriendlyCount;
    }

    function bfsToAttackableEnemyCapital(state, start) {
      const q = [start];
      const seen = new Set([keyOf(start.r, start.c)]);
      const parent = new Map();

      while (q.length > 0) {
        const cur = q.shift();
        const curKey = keyOf(cur.r, cur.c);

        for (const nxt of orthNeighbors(state, cur)) {
          if (!isExplorable(state, nxt.r, nxt.c)) continue;
          if (isWater(state, nxt.r, nxt.c)) continue;
          if (!isEnemy(state, nxt.r, nxt.c)) continue;
          if (!isCapitalTile(state, nxt.r, nxt.c)) continue;
          if (!canAttackEnemyCapital(state, nxt.r, nxt.c)) continue;

          const basePath = reconstructPath(parent, curKey);
          basePath.push({ r: nxt.r, c: nxt.c });
          return basePath;
        }

        for (const nxt of orthNeighbors(state, cur)) {
          const nk = keyOf(nxt.r, nxt.c);
          if (seen.has(nk)) continue;
          if (!canStepOn(state, nxt.r, nxt.c)) continue;
          seen.add(nk);
          parent.set(nk, curKey);
          q.push(nxt);
        }
      }

      return null;
    }

    function bfsToEnemyFrontier(state, start) {
      const q = [start];
      const seen = new Set([keyOf(start.r, start.c)]);
      const parent = new Map();
      let fallbackCapitalPath = null;

      while (q.length > 0) {
        const cur = q.shift();
        const curKey = keyOf(cur.r, cur.c);

        for (const nxt of orthNeighbors(state, cur)) {
          if (!isExplorable(state, nxt.r, nxt.c)) continue;
          if (isWater(state, nxt.r, nxt.c)) continue;
          if (!isEnemy(state, nxt.r, nxt.c)) continue;

          const isCapital = isCapitalTile(state, nxt.r, nxt.c);
          if (isCapital && !canAttackEnemyCapital(state, nxt.r, nxt.c)) {
            continue;
          }

          const basePath = reconstructPath(parent, curKey);
          basePath.push({ r: nxt.r, c: nxt.c });

          if (!isCapital) {
            return basePath;
          }

          if (!fallbackCapitalPath) {
            fallbackCapitalPath = basePath;
          }
        }

        for (const nxt of orthNeighbors(state, cur)) {
          const nk = keyOf(nxt.r, nxt.c);
          if (seen.has(nk)) continue;
          if (!canStepOn(state, nxt.r, nxt.c)) continue;
          seen.add(nk);
          parent.set(nk, curKey);
          q.push(nxt);
        }
      }

      return fallbackCapitalPath;
    }

    async function fetchBattleState() {
      const url = `/teambattle?${MODE}&t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`[${res.status}] ${url}`);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const headerText = doc?.querySelector('header')?.textContent || '';
      if (!headerText.includes('どんぐりチーム戦い')) throw new Error('title.ng info');

      const scripts = doc.querySelectorAll('.gridCanvasOuter script');
      const scriptContent = Array.from(scripts).map(s => s.textContent).join('\n');

      const gridSizeMatch = scriptContent.match(/const\s+GRID_SIZE\s*=\s*(\d+);/);
      const rows = gridSizeMatch ? Number(gridSizeMatch[1]) : 0;
      const cols = rows;

      let cellColors = {};
      const cellColorsMatch = scriptContent.match(/const\s+cellColors\s*=\s*({[\s\S]+?});/);
      if (cellColorsMatch && cellColorsMatch[1]) {
        const validJsonStr = cellColorsMatch[1].replace(/'/g, '"').replace(/,\s*}/g, '}');
        cellColors = JSON.parse(validJsonStr);
      }

      let capitalList = [];
      const capitalListMatch = scriptContent.match(/const\s+capitalList\s*=\s*(\[[\s\S]*?\]);/);
      if (capitalListMatch && capitalListMatch[1]) {
        capitalList = JSON.parse(capitalListMatch[1]);
      }

      const waterSet = new Set();
      const terrainMatch = scriptContent.match(/const\s+terrainsPayload\s*=\s*({[\s\S]+?});/);
      if (terrainMatch && terrainMatch[1]) {
        const payload = JSON.parse(terrainMatch[1]);
        if (Array.isArray(payload.terrains)) {
          payload.terrains.forEach(item => {
            const r = item.r ?? item.row ?? item.x;
            const c = item.c ?? item.col ?? item.y;
            if (item.t === 'w') waterSet.add(keyOf(r, c));
          });
        }
      }

      let hasCapital = false;
      const exploredSet = new Set();
      const fowMatch = scriptContent.match(/window\.__FOW\s*=\s*({[\s\S]+?});/);
      if (fowMatch && fowMatch[1]) {
        const fowData = JSON.parse(fowMatch[1]);
        hasCapital = !!fowData.hasCapital;
        if (Array.isArray(fowData.explored)) {
          fowData.explored.forEach(([r, c]) => exploredSet.add(keyOf(r, c)));
        }
        if (Array.isArray(fowData.visible)) {
          fowData.visible.forEach(([r, c]) => exploredSet.add(keyOf(r, c)));
        }
      }

      const buildingMap = Object.create(null);
      const buildingsMatch = scriptContent.match(/window\.__BUILDINGS\s*=\s*({[\s\S]+?});/);
      if (buildingsMatch && buildingsMatch[1]) {
        const buildingsPayload = JSON.parse(buildingsMatch[1]);
        if (Array.isArray(buildingsPayload.buildings)) {
          buildingsPayload.buildings.forEach(item => {
            const r = Number(item.row ?? item.r ?? item.rc?.[0]);
            const c = Number(item.col ?? item.c ?? item.rc?.[1]);

            let rawKind =
              item.type ?? item.kind ?? item.buildingType ??
              item.b?.type ?? item.b?.kind ?? item.b?.buildingType ?? item.b?.t ?? '';
            rawKind = String(rawKind).toLowerCase();

            const kind =
              rawKind === 'f' || rawKind === 'fort' ? 'f' :
              rawKind === 'r' || rawKind === 'radar' ? 'r' :
              rawKind;

            const rawOwner = String(
              item.team ?? item.owner ?? item.buildingOwner ??
              item.b?.team ?? item.b?.owner ?? item.b?.buildingOwner ?? ''
            ).toLowerCase();

            const team =
              rawOwner === 'red' ? 1 :
              rawOwner === 'blue' ? 2 :
              rawOwner === '1' ? 1 :
              rawOwner === '2' ? 2 : 0;

            if (Number.isFinite(r) && Number.isFinite(c) && kind) {
              buildingMap[keyOf(r, c)] = { kind, team };
            }
          });
        }
      }

      const avatarsMatch = scriptContent.match(/window\.__AVATARS\s*=\s*({[\s\S]+?});/);
      let avatars = null;
      if (avatarsMatch && avatarsMatch[1]) {
        avatars = JSON.parse(avatarsMatch[1]);
      }

      let headerTeamName = teamName;
      let headerTeamColor = teamColor;
      const target = Array.from(doc.querySelectorAll('header span')).find(s => s.textContent.includes('チーム:'));
      if (target) {
        const raw = target.textContent;
        if (raw.includes('レッド')) {
          headerTeamName = 'レッド';
          headerTeamColor = 'd32f2f';
        } else if (raw.includes('ブルー')) {
          headerTeamName = 'ブルー';
          headerTeamColor = '1976d2';
        }
      }
      teamName = headerTeamName;
      teamColor = headerTeamColor;

      const myTeamCode = teamColor === 'd32f2f' ? 1 : (teamColor === '1976d2' ? 2 : 0);
      const teamMap = Object.create(null);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = cellColors[keyOf(r, c)] || '';
          const hex = String(v).replace('#', '');
          if (hex === 'd32f2f') teamMap[keyOf(r, c)] = 1;
          else if (hex === '1976d2') teamMap[keyOf(r, c)] = 2;
          else teamMap[keyOf(r, c)] = 0;
        }
      }

      let myAvatar = null;
      if (avatars && avatars.myAvatar) {
        const r = Number(avatars.myAvatar.row ?? avatars.myAvatar.r);
        const c = Number(avatars.myAvatar.col ?? avatars.myAvatar.c);
        if (Number.isFinite(r) && Number.isFinite(c)) {
          myAvatar = { r, c };
        }
      }

      return {
        rows,
        cols,
        teamMap,
        waterSet,
        exploredSet,
        capitalList,
        myAvatar,
        myTeamCode,
        hasCapital,
        buildingMap,
      };
    }

    function getAutoFortifyKey() {
      const stage = location.href.includes('/teambattle?m=rb') ? (getCurrentRBStage() ?? '') : '';
      return `${MODE}|${currentPeriod ?? ''}|${stage}`;
    }

    async function buildFortAt(state, region) {
      const [r, c] = region;
      const myTeam = state.myTeamCode === 1 ? 'red' : (state.myTeamCode === 2 ? 'blue' : '');
      if (!myTeam) return [false, 'チーム情報を取得できません'];

      const body = new URLSearchParams();
      body.set('mode', MODE.replace(/^m=/, ''));
      body.set('team', myTeam);
      body.set('r', String(r));
      body.set('c', String(c));
      body.set('type', 'f');

      try {
        const resp = await fetch('/build', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': 'application/json'
          },
          body: body.toString(),
          credentials: 'same-origin'
        });
        const data = await resp.json().catch(() => ({ ok: false, error: 'server_error' }));

        if (resp.ok && data && data.ok) {
          return [true, '要塞を建設しました。'];
        }
        return [false, (data && data.error) ? String(data.error) : '建設に失敗しました'];
      } catch (e) {
        return [false, String(e)];
      }
    }

    async function autoBuildFortsAroundCapital(state) {
      let latestState = state || await fetchBattleState();
      const homeAnchor = getHomeAnchor(latestState);
      const fortifyKey = getAutoFortifyKey();

      if (!homeAnchor || !fortifyKey) {
        return {
          stop: false,
          keepWatching: false,
          waitSeconds: 0,
          state: latestState,
          built: 0,
          attempted: 0,
          message: ''
        };
      }

      let fortCount = countOwnFortsAround(latestState, homeAnchor);

      if (fortCount >= 2) {
        lastAutoFortifyKey = fortifyKey;
        return {
          stop: false,
          keepWatching: false,
          waitSeconds: 0,
          state: latestState,
          built: 0,
          attempted: 0,
          message: ''
        };
      }

      const candidates = orthNeighbors(latestState, homeAnchor)
        .filter(v => isExplorable(latestState, v.r, v.c))
        .filter(v => !isWater(latestState, v.r, v.c))
        .filter(v => isFriendly(latestState, v.r, v.c))
        .filter(v => !isOwnFort(latestState, v.r, v.c));

      if (!candidates.length) {
        return {
          stop: false,
          keepWatching: false,
          waitSeconds: 0,
          state: latestState,
          built: 0,
          attempted: 0,
          message: ''
        };
      }

      let built = 0;
      let attempted = 0;

      for (const cell of candidates) {
        if (fortCount >= 2) break;

        if (autoJoinStopRequested) {
          return {
            acted: false,
            stop: true,
            keepWatching: false,
            waitSeconds: 0,
            message: '自動参加モードを停止しました。',
            state: latestState
          };
        }

        attempted += 1;
        const [ok, buildMessage] = await buildFortAt(latestState, [cell.r, cell.c]);

        if (ok) {
          built += 1;
          await sleep(700);
          latestState = await fetchBattleState();
          fortCount = countOwnFortsAround(latestState, homeAnchor);
          continue;
        }

        return {
          stop: false,
          keepWatching: true,
          waitSeconds: 1,
          state: latestState,
          built,
          attempted,
          message: `[要塞待機] ${buildMessage}`
        };
      }

      fortCount = countOwnFortsAround(latestState, homeAnchor);
      if (fortCount >= 2) {
        lastAutoFortifyKey = fortifyKey;
      }

      return {
        stop: false,
        keepWatching: false,
        waitSeconds: 0,
        state: latestState,
        built,
        attempted,
        message: built > 0 ? `[要塞] 要塞を ${fortCount}/2 にしました。` : ''
      };
    }

    let nextProgress;

    function getRBStagePresetCandidates() {
      const stage = getCurrentRBStage();
      if (!stage) return [];
      return [
        `RB_STAGE${stage}`,
        `RB${stage}`,
        `第${stage}戦`,
        `第${stage}戦用`
      ];
    }

    async function challenge(region) {
      const [ row, col ] = region;
      const body = `row=${row}&col=${col}`;
      try {
        const res = await fetch('/teamchallenge?' + MODE, {
          method: 'POST',
          body: body,
          headers: headers
        });

        if (!res.ok) throw new Error(res.status);
        const text = await res.text();
        const lastLine = text.trim().split('\n').pop();
        return [ text, lastLine ];
      } catch (e) {
        console.error(e);
        throw e;
      }
    }

    async function equipChange(region, options = {}) {
      const {
        preferredPresetName = null,
        excludePresetNames = []
      } = options;

      const [ row, col ] = region;
      const url = `https://donguri.5ch.io/teambattle?r=${row}&c=${col}&` + MODE;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`[${res.status}] /teambattle?r=${row}&c=${col}`);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const headerText = doc?.querySelector('header')?.textContent || '';
        if (!headerText.includes('どんぐりチーム戦い')) return Promise.reject(`title.ng`);
        const table = doc.querySelector('table');
        if (!table) throw new Error('table.ng');
        const small = table.querySelector('td small');
        if (!small) throw new Error('equipCond.ng');

        const equipCond = small.textContent;
        const rank = equipCond
          .replace('エリート', 'e')
          .replace(/.+から|\w+-|まで|だけ|警備員|警|\s|\[|\]|\|/g, '');

        const autoEquipItems = JSON.parse(localStorage.getItem('autoEquipItems')) || {};
        const autoEquipItemsAutojoin = JSON.parse(localStorage.getItem('autoEquipItemsAutojoin')) || {};
        const equipPresets = JSON.parse(localStorage.getItem('equipPresets')) || {};

        const rankSourceList = autoEquipItemsAutojoin[rank]?.length > 0
          ? autoEquipItemsAutojoin[rank]
          : (autoEquipItems[rank] || []);

        const stageSourceList = getRBStagePresetCandidates()
          .filter(name => equipPresets[name]);

        // 明示登録した自動参加用/通常用ランク装備を優先し、
        // stage preset は補助候補として後ろに回す
        const sourceList = [...rankSourceList, ...stageSourceList];
        const uniqueSourceList = [...new Set(sourceList.filter(Boolean))];
        if (!uniqueSourceList.length) {
          return [rank, 'noEquip', null];
        }

        const excludeSet = new Set(
          (Array.isArray(excludePresetNames) ? excludePresetNames : [excludePresetNames])
            .filter(Boolean)
        );

        const candidates = [];

        if (
          preferredPresetName &&
          uniqueSourceList.includes(preferredPresetName) &&
          !excludeSet.has(preferredPresetName)
        ) {
          candidates.push(preferredPresetName);
        }

        for (const name of uniqueSourceList) {
          if (name === preferredPresetName) continue;
          if (excludeSet.has(name)) continue;
          candidates.push(name);
        }

        if (
          !candidates.length &&
          preferredPresetName &&
          uniqueSourceList.includes(preferredPresetName)
        ) {
          candidates.push(preferredPresetName);
        }

        if (!candidates.length) {
          return [rank, 'noAlternative', preferredPresetName];
        }

        let lastError = null;
        for (const presetName of candidates) {
          try {
            await setPresetItems(presetName, { force: true });
            return [rank, 'success', presetName];
          } catch (e) {
            lastError = e;
          }
        }

        if (lastError) throw lastError;
        return [rank, 'noAlternative', preferredPresetName];
      } catch (e) {
        console.error(e);
        throw e;
      }
    }

    function isDefeatMessage(text, lastLine) {
      const source = `${text}\n${lastLine}`;
      return [
        '敗北',
        '敗れ',
        '負け',
        '首都に戻され',
        '首都へ戻され',
        '首都に戻りました',
        '首都へ戻りました',
        '首都に戻る',
        '首都へ戻る',
        '返り討ち'
      ].some(v => source.includes(v));
    }

    async function executeStep(region, options = {}) {
      const { isEnemyStep = false, forceAutoEquip = false } = options;
      let equipRank = '';
      let usedPresetName = '';
      const shouldTryEquip = !shouldSkipAutoEquip && (forceAutoEquip || isEnemyStep || !currentEquipName);

      if (autoJoinStopRequested) {
        return { ok: false, stop: true, retry: false, stale: false, defeated: false, waitSeconds: 0, message: '自動参加モードを停止しました。' };
      }

      if (shouldTryEquip) {
        try {
          const [cellRank, equipChangeStat, presetName] = await equipChange(region);
          equipRank = cellRank;
          usedPresetName = presetName || '';

          if (autoJoinStopRequested) {
            return { ok: false, stop: true, retry: false, stale: false, defeated: false, waitSeconds: 0, message: '自動参加モードを停止しました。' };
          }

          if (equipChangeStat === 'noEquip') {
            return { ok: false, stop: false, retry: false, stale: false, defeated: false, waitSeconds: 0, message: `[装備なし] ${cellRank}` };
          }
          if (equipChangeStat === 'noAlternative') {
            return { ok: false, stop: false, retry: false, stale: false, defeated: false, waitSeconds: 0, message: `[装備候補不足] ${cellRank}` };
          }
        } catch (e) {
          if (autoJoinStopRequested) {
            return { ok: false, stop: true, retry: false, stale: false, defeated: false, waitSeconds: 0, message: '自動参加モードを停止しました。' };
          }
          return { ok: false, stop: false, retry: true, stale: false, defeated: false, waitSeconds: 3, message: String(e) };
        }
      }

      if (autoJoinStopRequested) {
        return { ok: false, stop: true, retry: false, stale: false, defeated: false, waitSeconds: 0, message: '自動参加モードを停止しました。' };
      }

      const [ text, lastLine ] = await challenge(region);

      if (autoJoinStopRequested) {
        return { ok: false, stop: true, retry: false, stale: false, defeated: false, waitSeconds: 0, message: '自動参加モードを停止しました。' };
      }

      const messageType = getMessageType(lastLine);

      if (
        text.startsWith('アリーナチャレンジ開始') ||
        text.startsWith('リーダーになった') ||
        text.startsWith('この場所を占領しました') ||
        text.startsWith('首都から出撃しました') ||
        text.startsWith('この場所へ移動しました')
      ) {
        return { ok: true, stop: false, retry: false, stale: false, defeated: false, waitSeconds: 0, message: '[成功] ' + lastLine };
      }
      if (isEnemyStep && isDefeatMessage(text, lastLine)) {
        return {
          ok: false,
          stop: false,
          retry: false,
          stale: false,
          defeated: true,
          waitSeconds: 0,
          message: '[敗北] ' + (lastLine || '首都へ戻されました。')
        };
      }
      if (messageType === 'breaktime') {
        return { ok: false, stop: true, retry: false, stale: false, defeated: false, waitSeconds: 0, message: lastLine };
      }
      if (messageType === 'quit') {
        clearInterval(autoJoinIntervalId);
        return { ok: false, stop: true, retry: false, stale: false, defeated: false, waitSeconds: 0, message: '[停止] ' + lastLine };
      }
      if (messageType === 'toofast') {
        return { ok: false, stop: false, retry: true, stale: false, defeated: false, waitSeconds: 3, message: lastLine };
      }
      if (messageType === 'retry') {
        return { ok: false, stop: false, retry: true, stale: false, defeated: false, waitSeconds: 20, message: lastLine };
      }
      if (messageType === 'equipError') {
        const failedPresetName = usedPresetName || currentEquipName || null;

        resetAutoJoinEquipState('equipError');
        equipRank = '';
        usedPresetName = '';

        if (!shouldSkipAutoEquip) {
          try {
            const [retryRank, retryStat, retryPresetName] = await equipChange(region, {
              preferredPresetName: failedPresetName,
              excludePresetNames: []
            });

            if (autoJoinStopRequested) {
              return { ok: false, stop: true, retry: false, stale: false, defeated: false, waitSeconds: 0, message: '自動参加モードを停止しました。' };
            }

            if (retryStat === 'success') {
              return {
                ok: false,
                stop: false,
                retry: true,
                stale: false,
                defeated: false,
                waitSeconds: 3,
                message: `${lastLine} → 装備再同期: ${retryPresetName}`
              };
            }
            if (retryStat === 'noAlternative') {
              return {
                ok: false,
                stop: false,
                retry: true,
                stale: false,
                defeated: false,
                waitSeconds: 3,
                message: `${lastLine} → 装備候補を再確認します`
              };
            }
            if (retryStat === 'noEquip') {
              return {
                ok: false,
                stop: false,
                retry: false,
                stale: false,
                defeated: false,
                waitSeconds: 0,
                message: `[装備なし] ${retryRank}`
              };
            }
          } catch (e) {
            if (autoJoinStopRequested) {
              return { ok: false, stop: true, retry: false, stale: false, defeated: false, waitSeconds: 0, message: '自動参加モードを停止しました。' };
            }
            return {
              ok: false,
              stop: false,
              retry: true,
              stale: false,
              defeated: false,
              waitSeconds: 3,
              message: `${lastLine} → ${String(e)}`
            };
          }
        }

        return {
          ok: false,
          stop: false,
          retry: true,
          stale: false,
          defeated: false,
          waitSeconds: 3,
          message: `${lastLine} → 装備再試行待ち`
        };
      }
      if (
        messageType === 'reset' ||
        messageType === 'nonAdjacent' ||
        messageType === 'teamAdjacent' ||
        messageType === 'capitalAdjacent' ||
        messageType === 'mapEdge'
      ) {
        return { ok: false, stop: false, retry: false, stale: true, defeated: false, waitSeconds: 1, message: lastLine };
      }
      if (messageType === 'guardError') {
        return { ok: false, stop: false, retry: false, stale: true, defeated: false, waitSeconds: 1, message: lastLine };
      }
      if (lastLine.length > 100) {
        return { ok: false, stop: false, retry: true, stale: false, defeated: false, waitSeconds: 2, message: 'どんぐりシステム' };
      }

      return { ok: false, stop: false, retry: false, stale: true, defeated: false, waitSeconds: 1, message: lastLine };
    }

    async function followPath(path, state) {
      if (!Array.isArray(path) || path.length < 2) {
        return { moved: false, stop: false, keepWatching: false, waitSeconds: 0, message: '経路が見つかりませんでした。' };
      }

      if (autoJoinStopRequested) {
        return { moved: false, stop: true, keepWatching: false, waitSeconds: 0, message: '自動参加モードを停止しました。', state };
      }

      let latestState = state;
      for (let i = 1; i < path.length; i++) {
        if (autoJoinStopRequested) {
          return { moved: false, stop: true, keepWatching: false, waitSeconds: 0, message: '自動参加モードを停止しました。', state: latestState };
        }

        const step = path[i];
        const isEnemyStep = i === path.length - 1 && isEnemy(latestState, step.r, step.c);
        const isCapitalTarget = isEnemyStep && isCapitalTile(latestState, step.r, step.c);
        const result = await executeStep([step.r, step.c], { isEnemyStep });

        if (autoJoinStopRequested) {
          return { moved: false, stop: true, keepWatching: false, waitSeconds: 0, message: '自動参加モードを停止しました。', state: latestState };
        }

        if (isSuppressibleAutoJoinWaitMessage(result.message)) {
          if (lastAutoJoinQuietMessage !== result.message) {
            logMessage(`${step.r},${step.c}`, result.message, '');
            lastAutoJoinQuietMessage = result.message;
          }
        } else {
          lastAutoJoinQuietMessage = '';
          logMessage(`${step.r},${step.c}`, result.message, '');
        }

        if (result.stop) {
          return { moved: false, stop: true, keepWatching: false, waitSeconds: 0, message: result.message, state: latestState };
        }

        if (result.defeated) {
          latestState = await fetchBattleState();

          if (autoJoinStopRequested) {
            return { moved: false, stop: true, keepWatching: false, waitSeconds: 0, message: '自動参加モードを停止しました。', state: latestState };
          }

          const ownCapital = findOwnCapital(latestState);

          if (ownCapital) {
            const redeployResult = await executeStep([ownCapital.r, ownCapital.c], { isEnemyStep: false });

            if (autoJoinStopRequested) {
              return { moved: false, stop: true, keepWatching: false, waitSeconds: 0, message: '自動参加モードを停止しました。', state: latestState };
            }

            logMessage(`${ownCapital.r},${ownCapital.c}`, '[再出撃] ' + redeployResult.message, '');

            if (redeployResult.stop) {
              return { moved: false, stop: true, keepWatching: false, waitSeconds: 0, message: redeployResult.message, state: latestState };
            }
            if (redeployResult.retry) {
              return {
                moved: false,
                stop: false,
                keepWatching: true,
                waitSeconds: redeployResult.waitSeconds || 3,
                message: redeployResult.message,
                state: latestState
              };
            }

            await sleep(1200);

            if (autoJoinStopRequested) {
              return { moved: false, stop: true, keepWatching: false, waitSeconds: 0, message: '自動参加モードを停止しました。', state: latestState };
            }

            latestState = await fetchBattleState();

            if (autoJoinStopRequested) {
              return { moved: false, stop: true, keepWatching: false, waitSeconds: 0, message: '自動参加モードを停止しました。', state: latestState };
            }

            return {
              moved: true,
              stop: false,
              keepWatching: false,
              waitSeconds: 0,
              message: `${result.message} → 首都から再出撃しました。`,
              state: latestState
            };
          }

          return {
            moved: false,
            stop: false,
            keepWatching: true,
            waitSeconds: 2,
            message: `${result.message} → 首都が見つからないため再出撃待機`,
            state: latestState
          };
        }

        if (result.retry) {
          return {
            moved: false,
            stop: false,
            keepWatching: true,
            waitSeconds: result.waitSeconds || 3,
            message: result.message,
            state: latestState
          };
        }
        if (!result.ok && !result.stale) {
          return { moved: false, stop: false, keepWatching: false, waitSeconds: 0, message: result.message, state: latestState };
        }

        await sleep(isEnemyStep ? 1500 : 900);

        if (autoJoinStopRequested) {
          return { moved: false, stop: true, keepWatching: false, waitSeconds: 0, message: '自動参加モードを停止しました。', state: latestState };
        }

        latestState = await fetchBattleState();

        if (autoJoinStopRequested) {
          return { moved: false, stop: true, keepWatching: false, waitSeconds: 0, message: '自動参加モードを停止しました。', state: latestState };
        }

        if (isCapitalTarget) {
          const capitalResolved =
            !isEnemy(latestState, step.r, step.c) ||
            !isCapitalTile(latestState, step.r, step.c);

          if (capitalResolved) {
            const priorityEmptyCells = collectCapitalCollapseEmptyCells(latestState, { r: step.r, c: step.c });

            if (priorityEmptyCells.length > 0) {
              latestState.priorityEmptyCells = priorityEmptyCells;
              return {
                moved: true,
                stop: false,
                keepWatching: false,
                waitSeconds: 0,
                message: `${result.message} → 首都周囲の空白を優先します。`,
                state: latestState
              };
            }
          }
        }

        if (result.stale) {
          return {
            moved: true,
            stop: false,
            keepWatching: true,
            waitSeconds: result.waitSeconds || 1,
            message: result.message,
            state: latestState
          };
        }
      }

      return { moved: true, stop: false, keepWatching: false, waitSeconds: 0, message: '経路完了', state: latestState };
    }

    function getOwnCapitalClaimCandidates(state) {
      const centerR = (state.rows - 1) / 2;
      const centerC = (state.cols - 1) / 2;

      const sortCandidates = (list) => list.sort((a, b) => {
        const score = (v) => {
          if (isFriendly(state, v.r, v.c)) return 0;
          if (isEmpty(state, v.r, v.c)) return 1;
          if (isEnemy(state, v.r, v.c)) return 2;
          return 3;
        };

        const scoreDiff = score(a) - score(b);
        if (scoreDiff !== 0) return scoreDiff;

        const distA = Math.abs(a.r - centerR) + Math.abs(a.c - centerC);
        const distB = Math.abs(b.r - centerR) + Math.abs(b.c - centerC);
        if (distA !== distB) return distA - distB;

        if (a.r !== b.r) return a.r - b.r;
        return a.c - b.c;
      });

      const fixedCandidates = (state.capitalList || [])
        .map(([r, c]) => ({ r, c, arbitrary: false }))
        .filter(v => !isWater(state, v.r, v.c));

      if (fixedCandidates.length > 0) {
        return sortCandidates(fixedCandidates);
      }

      const arbitraryCandidates = [];
      for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
          if (isWater(state, r, c)) continue;
          arbitraryCandidates.push({ r, c, arbitrary: true });
        }
      }

      return sortCandidates(arbitraryCandidates);
    }

    async function tryClaimOwnCapital(state) {
      let latestState = state || await fetchBattleState();
      let candidates = getOwnCapitalClaimCandidates(latestState);
      let arbitraryCapitalMode = !(latestState.capitalList && latestState.capitalList.length > 0);

      if (!candidates.length) {
        return {
          acted: false,
          stop: false,
          keepWatching: true,
          waitSeconds: 2,
          message: arbitraryCapitalMode ? '首都新設候補が見つかりませんでした。' : '首都候補が見つかりませんでした。',
          state: latestState
        };
      }

      for (const cap of candidates) {
        if (autoJoinStopRequested) {
          return {
            acted: false,
            stop: true,
            keepWatching: false,
            waitSeconds: 0,
            message: '自動参加モードを停止しました。',
            state: latestState
          };
        }

        const claimResult = await executeStep([cap.r, cap.c], {
          isEnemyStep: isEnemy(latestState, cap.r, cap.c),
          forceAutoEquip: true
        });
        logMessage(
          `${cap.r},${cap.c}`,
          (cap.arbitrary ? '[首都新設] ' : '[首都取得] ') + claimResult.message,
          ''
        );

        if (claimResult.stop) {
          return {
            acted: false,
            stop: true,
            keepWatching: false,
            waitSeconds: 0,
            message: claimResult.message,
            state: latestState
          };
        }

        if (claimResult.retry) {
          return {
            acted: false,
            stop: false,
            keepWatching: true,
            waitSeconds: claimResult.waitSeconds || 3,
            message: claimResult.message,
            state: latestState
          };
        }

        await sleep(1200);
        latestState = await fetchBattleState();
        arbitraryCapitalMode = !(latestState.capitalList && latestState.capitalList.length > 0);

        if (latestState.hasCapital) {
          return {
            acted: true,
            stop: false,
            keepWatching: false,
            waitSeconds: 0,
            message: cap.arbitrary ? '任意地点に首都を新設しました。' : '首都を取得しました。',
            state: latestState
          };
        }
      }

      return {
        acted: false,
        stop: false,
        keepWatching: true,
        waitSeconds: 2,
        message: arbitraryCapitalMode ? '任意地点への首都新設を再試行します。' : '首都取得を再試行します。',
        state: latestState
      };
    }

    async function planAndAct(stateOverride = null) {
      let state = stateOverride || await fetchBattleState();
      let pos = currentPos(state);

      if (!state.hasCapital) {
        const claimResult = await tryClaimOwnCapital(state);
        if (claimResult.stop) {
          return claimResult;
        }
        if (claimResult.keepWatching) {
          return claimResult;
        }

        state = claimResult.state || await fetchBattleState();
        pos = currentPos(state);

        if (!state.hasCapital) {
          return {
            acted: false,
            stop: false,
            keepWatching: true,
            waitSeconds: 2,
            message: '首都取得を優先して再試行します。',
            state
          };
        }
      }

      const homeAnchor = getHomeAnchor(state);

      if (homeAnchor) {
        const fortifyResult = await autoBuildFortsAroundCapital(state);

        if (fortifyResult.stop) {
          return fortifyResult;
        }

        if (fortifyResult.keepWatching) {
          return {
            acted: fortifyResult.built > 0,
            stop: false,
            keepWatching: true,
            waitSeconds: fortifyResult.waitSeconds || 3,
            message: fortifyResult.message || '要塞建設待機中です。',
            state: fortifyResult.state || state,
            phase: 'fort'
          };
        }

        if (fortifyResult.message) {
          logMessage(null, fortifyResult.message, '');
        }

        state = fortifyResult.state || state;
        pos = currentPos(state);
      }

      if (!pos && homeAnchor) {
        const startResult = await executeStep([homeAnchor.r, homeAnchor.c], {
          isEnemyStep: false,
          forceAutoEquip: true
        });
        logMessage(`${homeAnchor.r},${homeAnchor.c}`, startResult.message, '');

        if (startResult.stop) {
          return {
            acted: false,
            stop: true,
            keepWatching: false,
            waitSeconds: 0,
            message: startResult.message,
            state
          };
        }
        if (startResult.retry) {
          return {
            acted: false,
            stop: false,
            keepWatching: true,
            waitSeconds: startResult.waitSeconds || 3,
            message: startResult.message,
            state
          };
        }

        await sleep(1200);
        state = await fetchBattleState();
        pos = currentPos(state);
      }

      if (!pos) {
        return {
          acted: false,
          stop: false,
          keepWatching: true,
          waitSeconds: 2,
          message: '現在地を取得できませんでした。',
          state
        };
      }

      const latestHomeAnchor = getHomeAnchor(state);
      const ringEmptyCells = collectHomeRingEmptyCells(state, latestHomeAnchor);
      if (ringEmptyCells.length > 0) {
        const existing = Array.isArray(state.priorityEmptyCells) ? state.priorityEmptyCells : [];
        const seen = new Set(ringEmptyCells.map(v => keyOf(v.r, v.c)));
        state.priorityEmptyCells = [
          ...ringEmptyCells,
          ...existing.filter(v => v && !seen.has(keyOf(v.r, v.c)))
        ];
      }

      const priorityEmptyPath = bfsToPriorityEmpty(state, pos);
      if (priorityEmptyPath && priorityEmptyPath.length >= 2) {
        const result = await followPath(priorityEmptyPath, state);
        return {
          acted: result.moved,
          stop: result.stop,
          keepWatching: !!result.keepWatching,
          waitSeconds: result.waitSeconds || 1,
          message: result.message,
          state: result.state || state,
          phase: 'priorityEmpty'
        };
      }
      if (Array.isArray(state.priorityEmptyCells) && state.priorityEmptyCells.length > 0) {
        delete state.priorityEmptyCells;
      }

      const emptyPath = bfsToNearestEmpty(state, pos);
      if (emptyPath && emptyPath.length >= 2) {
        const result = await followPath(emptyPath, state);
        return {
          acted: result.moved,
          stop: result.stop,
          keepWatching: !!result.keepWatching,
          waitSeconds: result.waitSeconds || 1,
          message: result.message,
          state: result.state || state,
          phase: 'empty'
        };
      }

      const capitalAttackPath = bfsToAttackableEnemyCapital(state, pos);
      if (capitalAttackPath && capitalAttackPath.length >= 2) {
        const result = await followPath(capitalAttackPath, state);
        return {
          acted: result.moved,
          stop: result.stop,
          keepWatching: !!result.keepWatching,
          waitSeconds: result.waitSeconds || 1,
          message: result.message,
          state: result.state || state,
          phase: 'enemyCapital'
        };
      }

      const enemyPath = bfsToEnemyFrontier(state, pos);
      if (enemyPath && enemyPath.length >= 2) {
        const result = await followPath(enemyPath, state);
        return {
          acted: result.moved,
          stop: result.stop,
          keepWatching: !!result.keepWatching,
          waitSeconds: result.waitSeconds || 1,
          message: result.message,
          state: result.state || state,
          phase: 'enemy'
        };
      }

      return {
        acted: false,
        stop: false,
        keepWatching: true,
        waitSeconds: 10,
        message: '盤面を埋め終えたため監視を継続します。',
        state,
        phase: 'idle'
      };
    }

    async function runAutoBattleLoop() {
      let state = null;

      for (let loop = 0; loop < 100; loop++) {
        if (autoJoinStopRequested) {
          return {
            acted: false,
            stop: true,
            keepWatching: false,
            waitSeconds: 0,
            message: '自動参加モードを停止しました。',
            state
          };
        }

        await drawProgressBar();

        if (autoJoinStopRequested) {
          return {
            acted: false,
            stop: true,
            keepWatching: false,
            waitSeconds: 0,
            message: '自動参加モードを停止しました。',
            state
          };
        }

        if (location.href.includes('/teambattle?m=rb') && isRBStageRefreshProgress(currentProgress)) {
          return {
            acted: false,
            stop: false,
            keepWatching: true,
            waitSeconds: 3,
            message: '[待機] ステージ切替直後のため3秒間待機します。',
            state,
            phase: 'rbRefresh'
          };
        }

        const result = await planAndAct(state);

        if (autoJoinStopRequested) {
          return {
            acted: false,
            stop: true,
            keepWatching: false,
            waitSeconds: 0,
            message: '自動参加モードを停止しました。',
            state: result.state || state
          };
        }

        if (result.stop) {
          return result;
        }
        if (result.keepWatching) {
          return result;
        }
        if (!result.acted) {
          return result;
        }

        state = result.state || await fetchBattleState();
        const pos = currentPos(state);

        if (autoJoinStopRequested) {
          return {
            acted: false,
            stop: true,
            keepWatching: false,
            waitSeconds: 0,
            message: '自動参加モードを停止しました。',
            state
          };
        }

        if (!pos) {
          return {
            acted: false,
            stop: false,
            keepWatching: true,
            waitSeconds: 2,
            message: '現在地を取得できませんでした。',
            state
          };
        }

        const nextPriorityEmptyPath = bfsToPriorityEmpty(state, pos);
        if (nextPriorityEmptyPath && nextPriorityEmptyPath.length >= 2) {
          logAutoJoinGuideOnce('priorityEmpty', '[継続] 首都周囲の空白を優先して埋めます。', null, '');
          await sleep(300);
          if (autoJoinStopRequested) {
            return {
              acted: false,
              stop: true,
              keepWatching: false,
              waitSeconds: 0,
              message: '自動参加モードを停止しました。',
              state
            };
          }
          continue;
        }
        if (Array.isArray(state.priorityEmptyCells) && state.priorityEmptyCells.length > 0) {
          delete state.priorityEmptyCells;
        }

        const nextEmptyPath = bfsToNearestEmpty(state, pos);
        if (nextEmptyPath && nextEmptyPath.length >= 2) {
          logAutoJoinGuideOnce('empty', '[継続] 空白マスを優先して埋めます。', null, '');
          await sleep(600);
          if (autoJoinStopRequested) {
            return {
              acted: false,
              stop: true,
              keepWatching: false,
              waitSeconds: 0,
              message: '自動参加モードを停止しました。',
              state
            };
          }
          continue;
        }

        const nextEnemyPath = bfsToEnemyFrontier(state, pos);
        if (nextEnemyPath && nextEnemyPath.length >= 2) {
          logAutoJoinGuideOnce('enemy', '[継続] 空白が無いため敵マスへ進みます。', null, '');
          await sleep(900);
          if (autoJoinStopRequested) {
            return {
              acted: false,
              stop: true,
              keepWatching: false,
              waitSeconds: 0,
              message: '自動参加モードを停止しました。',
              state
            };
          }
          continue;
        }

        return {
          acted: true,
          stop: false,
          keepWatching: true,
          waitSeconds: 5,
          message: '盤面を埋め終えたため監視を継続します。',
          state
        };
      }

      return {
        acted: false,
        stop: false,
        keepWatching: true,
        waitSeconds: 3,
        message: '連続処理が長くなったため監視継続に戻ります。',
        state
      };
    }

    async function attackRegion() {
      if (autoJoinStopRequested) {
        return;
      }

      await drawProgressBar();

      if (autoJoinStopRequested) {
        return;
      }

      const currentRBStage = getCurrentRBStage();

      if (
        (lastAutoJoinBattlePeriod !== null && currentPeriod !== lastAutoJoinBattlePeriod) ||
        (
          location.href.includes('/teambattle?m=rb') &&
          lastAutoJoinRBStage !== null &&
          currentRBStage !== null &&
          currentRBStage !== lastAutoJoinRBStage
        )
      ) {
        resetAutoJoinEquipState('新しいバトルを検知');
        logMessage(null, '[装備初期化] 新しいバトルを検知したため装備状態をリセットしました。', '');
      }
      lastAutoJoinBattlePeriod = currentPeriod;
      lastAutoJoinRBStage = currentRBStage;

      if (location.href.includes('/teambattle?m=rb') && isRBStageRefreshProgress(currentProgress)) {
        const statusKey = `${currentPeriod}|rb-refresh-wait|${currentProgress}`;
        nextProgress = currentProgress;

        if (lastAutoJoinStatusKey !== statusKey) {
          logMessage(null, '[待機] ステージ切替直後のため3秒間待機します。', '');
          lastAutoJoinStatusKey = statusKey;
        }

        if (!autoJoinStopRequested && typeof window.__queueAutoJoinRetry === 'function') {
          window.__queueAutoJoinRetry(() => {
            const dialog = document.querySelector('.auto-join');
            if (!autoJoinStopRequested && dialog?.open && !isAutoJoinRunning) {
              attackRegion();
            }
          }, 3000);
        }
        return;
      }

      if (isAutoJoinRunning || Math.abs(nextProgress - currentProgress) >= 2) {
        return;
      }

      isAutoJoinRunning = true;
      try {
        const result = await runAutoBattleLoop();

        if (autoJoinStopRequested) {
          lastAutoJoinStatusKey = '';
          return;
        }

        if (result.stop) {
          lastAutoJoinStatusKey = '';
          return;
        }

        if (result.keepWatching) {
          const waitSeconds = Math.max(1, Number(result.waitSeconds) || 1);
          const statusKey = `${currentPeriod}|${result.phase || ''}|${result.message || ''}`;

          nextProgress = currentProgress;

          if (isSuppressibleAutoJoinWaitMessage(result.message)) {
            if (lastAutoJoinQuietMessage !== result.message) {
              logMessage(null, result.message, `→ ${waitSeconds}s後再試行`);
              lastAutoJoinQuietMessage = result.message;
            }
            lastAutoJoinStatusKey = statusKey;
          } else {
            lastAutoJoinQuietMessage = '';
            if (lastAutoJoinStatusKey !== statusKey) {
              logMessage(null, result.message, `→ ${waitSeconds}s後再試行`);
              lastAutoJoinStatusKey = statusKey;
            }
          }

          if (!autoJoinStopRequested && typeof window.__queueAutoJoinRetry === 'function') {
            window.__queueAutoJoinRetry(() => {
              const dialog = document.querySelector('.auto-join');
              if (!autoJoinStopRequested && dialog?.open && !isAutoJoinRunning) {
                attackRegion();
              }
            }, waitSeconds * 1000);
          }

          return;
        }

        lastAutoJoinStatusKey = '';
        lastAutoJoinGuideKey = '';
        lastAutoJoinQuietMessage = '';
        nextProgress = currentProgress;
        logMessage(null, result.message, '→ 継続監視');
      } catch (e) {
        console.error(e);
        lastAutoJoinStatusKey = '';
        logMessage(null, String(e), '');
      } finally {
        isAutoJoinRunning = false;
      }
    }

    if (!isAutoJoinRunning) {
      attackRegion();
    }
    autoJoinIntervalId = setInterval(attackRegion, 30000);
  }

  async function drawProgressBar(){
    try {
      const res = await fetch('https://donguri.5ch.io/');
      if (!res.ok) throw new Error(res.status);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const container = doc.querySelector('div.stat-block:nth-child(2)>div:nth-child(5)').cloneNode(true);
      currentPeriod = Number(container.firstChild.textContent.match(/\d+/)[0]);
      currentProgress = parseInt(container.lastElementChild.textContent);
      let str,min,totalSec,sec,margin;

      const rbMode = isRedBlueMode();

      if (
        (rbMode && isRBStageRefreshProgress(currentProgress)) ||
        (!rbMode && (currentProgress === 0 || currentProgress === 50))
      ) {
        str = '（マップ更新）';
      } else {
        if (currentProgress === 100) {
          min = 0;
          sec = 20;
          margin = 10;
        } else {
          if (rbMode) {
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
        str = '（残り' + min + '分' + sec + '秒 ±' + margin + '秒）';
      }
      progressBarBody.textContent = currentProgress + '%';
      progressBarBody.style.width = currentProgress + '%';

      const rbStageInfo = rbMode
        ? getRBStageInfo(currentProgress)
        : null;

      if (rbStageInfo) {
        const stageRange = Math.max(1, rbStageInfo.end - rbStageInfo.start);
        const stageProgress = Math.max(
          0,
          Math.min(100, ((currentProgress - rbStageInfo.start) * 100) / stageRange)
        );
        const stageProgressRounded = Math.round(stageProgress);

        progressBarInfo.textContent = `${MODENAME}第${currentPeriod}期 / ${rbStageInfo.label}${str}`;

        stageProgressBarContainer.style.display = '';
        stageProgressBarBody.textContent = stageProgressRounded + '%';
        stageProgressBarBody.style.width = stageProgress + '%';
        stageProgressBarInfo.textContent =
          `進行区間: ${rbStageInfo.label}（${rbStageInfo.start}～${rbStageInfo.end}%）`;
      } else {
        progressBarInfo.textContent = `${MODENAME}第${currentPeriod}期${str}`;
        stageProgressBarContainer.style.display = 'none';
      }

      const statBlock = doc.querySelector('.stat-block');
      wood = statBlock.textContent.match(/木材の数: (\d+)/)[1];
      steel = statBlock.textContent.match(/鉄の数: (\d+)/)[1];
    } catch (e) {
      console.error(e+' drawProgressBar()')
    }
  }

  drawProgressBar();

  let lastAutoJoinBattlePeriod = null;
  let lastAutoJoinRBStage = null;
  let lastAutoJoinGuideKey = '';
  let lastAutoJoinQuietMessage = '';
  let lastAutoFortifyKey = '';

  function isSuppressibleAutoJoinWaitMessage(message = '') {
    return typeof message === 'string' && (
      message.includes('行動回数をリセットするため') ||
      message.includes('しばらくお待ちください')
    );
  }

  function resetAutoJoinEquipState(reason = '次戦移行') {
    currentEquipName = '';
    localStorage.removeItem('current_equip');
    weaponTable = null;
    armorTable = null;
    necklaceTable = null;

    const stat = document.querySelector('.equip-preset-stat');
    if (stat) stat.textContent = `${reason}のため装備状態を初期化`;
  }

  function startAutoJoin() {
    if (typeof window.__resumeAutoJoinNow === 'function') {
      window.__resumeAutoJoinNow();
    }
    resetAutoJoinEquipState();
    lastAutoFortifyKey = '';
    lastAutoJoinBattlePeriod = currentPeriod || null;

    {
      const p = Number(currentProgress);
      if (!location.href.includes('/teambattle?m=rb') || !Number.isFinite(p)) {
        lastAutoJoinRBStage = null;
      } else if (p <= 16) {
        lastAutoJoinRBStage = 1;
      } else if (p <= 33) {
        lastAutoJoinRBStage = 2;
      } else if (p <= 50) {
        lastAutoJoinRBStage = 3;
      } else if (p <= 66) {
        lastAutoJoinRBStage = 4;
      } else if (p <= 83) {
        lastAutoJoinRBStage = 5;
      } else {
        lastAutoJoinRBStage = 6;
      }
    }

    clearInterval(progressBarIntervalId);
    progressBarIntervalId = null;
    autoJoin();
  }
  let progressBarIntervalId = setInterval(drawProgressBar, 18000);
  let autoJoinStopRequested = false;
  let autoJoinRetryTimeoutIds = new Set();

  (()=>{ // autoJoinとprogressBarのinterval管理
    function clearAutoJoinRetryTimeouts() {
      for (const id of autoJoinRetryTimeoutIds) {
        clearTimeout(id);
      }
      autoJoinRetryTimeoutIds.clear();
    }

    function stopAutoJoin() {
      autoJoinStopRequested = true;

      if (autoJoinIntervalId) {
        clearInterval(autoJoinIntervalId);
        autoJoinIntervalId = null;
      }

      clearAutoJoinRetryTimeouts();
      isAutoJoinRunning = false;
      lastAutoJoinGuideKey = '';
      lastAutoJoinQuietMessage = '';
      lastAutoFortifyKey = '';

      if (typeof lastAutoJoinStatusKey !== 'undefined') {
        lastAutoJoinStatusKey = '';
      }
    }

    function resumeAutoJoin() {
      autoJoinStopRequested = false;
      clearAutoJoinRetryTimeouts();
    }

    window.__stopAutoJoinNow = stopAutoJoin;
    window.__resumeAutoJoinNow = resumeAutoJoin;
    window.__queueAutoJoinRetry = function (fn, waitMs) {
      const timeoutId = setTimeout(() => {
        autoJoinRetryTimeoutIds.delete(timeoutId);
        if (autoJoinStopRequested) return;
        fn();
      }, waitMs);
      autoJoinRetryTimeoutIds.add(timeoutId);
      return timeoutId;
    };

    const dialog = document.querySelector('.auto-join');
    const observer = new MutationObserver(() => {
      if (!dialog.open) {
        stopAutoJoin();
        drawProgressBar();
        if (!progressBarIntervalId) {
          progressBarIntervalId = setInterval(drawProgressBar, 18000);
        }
      }
    });

    observer.observe(dialog, {
      attributes: true,
      attributeFilter: ['open']
    });
  })();
})();
