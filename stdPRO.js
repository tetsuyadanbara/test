// ==UserScript==
// @name         donguri arena assist tool
// @version      1.2.2d改 Standard PRO
// @description  fix arena ui and add functions
// @author       ぱふぱふ
// @match        https://donguri.5ch.net/teambattle?m=hc
// @match        https://donguri.5ch.net/teambattle?m=l
// @match        https://donguri.5ch.net/teambattle?m=rb
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
  let shouldSkipAreaInfo, shouldSkipAutoEquip, cellSelectorActivate, rangeAttackProcessing,
    currentPeriod, currentProgress;
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

  const grid = document.querySelector('.grid');
  grid.parentNode.style.height = null;
  grid.style.maxWidth = '100%';

  const table = document.querySelector('table');
  table.parentNode.style.maxWidth = '100%';
  table.parentNode.style.overflow = 'auto';
  table.parentNode.style.height = '60vh';

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
      //const grid = container.cloneNode();
      //addHeader('グリッド', grid);
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

      settingsMenu.append(toolbar, arenaResult, arenaField, settingsPanel, equipPanel);
      refreshSettings();
    })();

    const footer = document.createElement('div');
    footer.style.fontSize = '80%';
    footer.style.textAlign = 'right';

    (()=>{
      const link = document.createElement('a');
      link.style.color = '#333';
      link.textContent = '1.2.2d改 Standard PRO';
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
    equipSwitchButton.textContent = '▶武器';
    equipSwitchButton.style.width = '4em';
    equipSwitchButton.style.height = '42px';
    equipSwitchButton.style.fontSize = '';

    equipSwitchButton.style.whiteSpace = 'nowrap';
    equipSwitchButton.addEventListener('click', (event)=>{
      if(!weaponTable.style.display) {
        weaponTable.style.display = 'none';
        armorTable.style.display = '';
        necklaceTable.style.display = 'none';
        event.target.textContent = '▶防具';
      } else if (!armorTable.style.display) {
        weaponTable.style.display = 'none';
        armorTable.style.display = 'none';
        necklaceTable.style.display = '';
        event.target.textContent = '▶首';
      } else if (!necklaceTable.style.display) {
        weaponTable.style.display = '';
        armorTable.style.display = 'none';
        necklaceTable.style.display = 'none';
        event.target.textContent = '▶武器';
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

      equipSwitchButton.textContent = '▶武器';
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
  async function setPresetItems (presetName) {
    let currentEquip = JSON.parse(localStorage.getItem('current_equip')) || [];
    const stat = document.querySelector('.equip-preset-stat');
    if (stat.textContent === '装備中...') return;
    const equipPresets = JSON.parse(localStorage.getItem('equipPresets')) || {};
    const fetchPromises = equipPresets[presetName].id
      .filter(id => id !== undefined && id !== null && !currentEquip.includes(id)) // 未登録or既に装備中の部位は除外
      .map(id => fetch('https://donguri.5ch.net/equip/' + id));

    stat.textContent = '装備中...';
    try {
      const responses = await Promise.all(fetchPromises);
      const texts = await Promise.all(
        responses.map(async response => {
          if (!response.ok) {
            throw new Error(`[${response.status}] /equip/`);
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
      currentEquipName = presetName;
    } catch (e) {
      stat.textContent = e;
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

  scaleContentsToFit(grid.parentNode, grid);

  async function refreshArenaInfo() {
    const refreshedCells = [];
    function includesCoord(arr, row, col) {
      return arr.some(([r, c]) => r === Number(row) && c === Number(col));
    }

    try {
      const res = await fetch('');
      if (!res.ok) throw new Error('res.ng');

      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const headerText = doc?.querySelector('header')?.textContent || '';
      if (!headerText.includes('どんぐりチーム戦い')) throw new Error('title.ng info');

      const currentCells = grid.querySelectorAll('.cell');
      const scriptContent = doc.querySelector('.grid > script').textContent;

      const cellColorsString = scriptContent.match(/const cellColors = ({.+?})/s)[1];
      const validJsonStr = cellColorsString.replace(/'/g, '"').replace(/,\s*}/, '}');
      const cellColors = JSON.parse(validJsonStr);
      const capitalMapString = scriptContent.match(/const capitalMap = (\[.*?\]);/s)[1];
      const capitalMap = JSON.parse(capitalMapString);

      const newGrid = doc.querySelector('.grid');
      const rows = Number(newGrid.style.gridTemplateRows.match(/repeat\((\d+), 35px\)/)[1]);
      const cols = Number(newGrid.style.gridTemplateColumns.match(/repeat\((\d+), 35px\)/)[1]);

      if (currentCells.length !== rows * cols) {
        grid.style.gridTemplateRows = newGrid.style.gridTemplateRows;
        grid.style.gridTemplateColumns = newGrid.style.gridTemplateColumns;
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

            if (includesCoord(capitalMap, i, j)) {
              cell.style.outline = 'black solid 2px';
              cell.style.borderColor = 'gold';
            } else {
              cell.style.outline = '';
            }
            const cellKey = `${i}-${j}`;
            /*
            const rgb = cellColors[cellKey].match(/[0-9a-fA-F]{2}/g);
            cell.style.outline = includesCoord(capitalMap, i, j) ? `${getOutlineColor(rgb)} solid 2px` : '';
            */
            if (cellColors[cellKey]) {
              cell.style.backgroundColor = cellColors[cellKey];
            } else {
              cell.style.backgroundColor = '#ffffff00';
            }

            grid.appendChild(cell);
            refreshedCells.push(cell);
          }
        }
      } else {
        currentCells.forEach(cell => {
          const { row, col } = cell.dataset;
          const cellKey = `${row}-${col}`;

          const cellColorCode = '#' + cell.style.backgroundColor.match(/\d+/g)
            .map(v => Number(v).toString(16).toLowerCase().padStart(2, '0'))
            .join('');

          if (cellColors[cellKey]) {
            if (cellColorCode !== cellColors[cellKey].toLowerCase()) {
              cell.style.backgroundColor = cellColors[cellKey];
              refreshedCells.push(cell);
            }
          } else if (cellColorCode !== '#ffffff00') {
            cell.style.backgroundColor = '#ffffff00';
            refreshedCells.push(cell);
          }

          const rgb = cell.style.backgroundColor.match(/\d+/g).map(Number);
          const brightness = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
          cell.style.color = brightness > 128 ? '#000' : '#fff';

          if (includesCoord(capitalMap, row, col)) {
            cell.style.outline = 'black solid 2px';
            cell.style.borderColor = 'gold';
          } else {
            cell.style.outline = '';
            cell.style.borderColor = '#ccc';
          }

          // cell.style.outline = includesCoord(capitalMap, row, col) ? `${getOutlineColor(rgb)} solid 2px` : '';
        });
      }

      const tables = document.querySelectorAll('table');
      const newTables = doc.querySelectorAll('table');
      newTables.forEach((table, i) => {
        tables[i].replaceWith(table);
      });
      addCustomColor();
      return refreshedCells;
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchAreaInfo(refreshAll){
    const refreshedCells = await refreshArenaInfo();
    if (currentViewMode === 'detail') {
      grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace('35px','65px');
      grid.style.gridTemplateColumns = grid.style.gridTemplateColumns.replace('35px','105px');
    }
    grid.parentNode.style.height = null;
    grid.parentNode.style.padding = '20px 0';


    const cells = grid.querySelectorAll('.cell');
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
      const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&`+MODE;
      const res = await fetch(url);
      if(!res.ok) throw new Error(res.status + ' res.ng');
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const headerText = doc?.querySelector('header')?.textContent || '';
      if(!headerText.includes('どんぐりチーム戦い')) throw new Error(`title.ng [${row}][${col}]`);
      const rank = doc.querySelector('small')?.textContent || '';
      if(!rank) return Promise.reject(`rank.ng [${row}][${col}]`);
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
    editEndButton.textContent = '✓';
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
    scaleContentsToFit(grid.parentNode, grid);
  });

  observer.observe(grid, { attributes: true, childList: true, subtree: true });

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
    const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&`+MODE;
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

      if (lastLine === 'リーダーになった' || lastLine.includes('は新しいアリーナリーダーです。')) {
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
    const grid = document.querySelector('.grid');
    const cells = grid.querySelectorAll('.cell');

    if(currentViewMode === 'detail') {
      currentViewMode = 'compact';

      grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace('65px','35px');
      grid.style.gridTemplateColumns = grid.style.gridTemplateColumns.replace('105px','35px');

      for (const cell of cells) {
        cell.style.width = '30px';
        cell.style.height = '30px';
        cell.style.borderWidth = '1px';
        while (cell.firstChild) {
          cell.firstChild.remove();
        }
        const p = document.createElement('p');
        p.style.height = '28px'; // cellsize - borderWidth*2
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

      grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace('35px','65px');
      grid.style.gridTemplateColumns = grid.style.gridTemplateColumns.replace('35px','105px');

      for (const cell of cells) {
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
      capitalAttack: [
        '再建が必要です。'
      ],
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
      let loop = 0;

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
        for (let i = 0; i < regions[cellType].length;) {
          const region = regions[cellType][i];
          let errorCount = 0;
          let next;
          try {
            const [cellRank, equipChangeStat] = await equipChange(region);
            if (equipChangeStat === 'noEquip') {
              excludeSet.add(region.join(','));
              i++;
              continue;
            }

            const [ text, lastLine ] = await challenge(region);
            const messageType = getMessageType(lastLine);
            let message = lastLine;
            let processType;
            let sleepTime = 2;

            if (messageType === 'capitalAttack') {
              if (loop < 7){
                loop += 1;
                message = '[ﾘﾄﾗｲ] ' + lastLine;
                processType = 'continue';
              } else {
                loop += 1;
                success = true;
                message = '[成功] ' + lastLine;
                processType = 'return';
                i++;
              }
            } else if (text.startsWith('リーダーになった')) {
              if (loop < 7){
                loop += 1;
                message = '[ﾘﾄﾗｲ] ' + lastLine;
                processType = 'continue';
              } else {
                loop += 1;
                success = true;
                message = '[成功] ' + lastLine;
                processType = 'return';
              }
              i++;
            } else if (text.startsWith('アリーナチャレンジ開始')) {
              loop += 1;
              success = true;
              message = '[成功] ' + lastLine;
              processType = 'return';
              i++;
            } else if (messageType === 'breaktime') {
              success = true;
              message = lastLine;
              processType = 'return';
              i++;
            } else if (messageType === 'toofast') {
              sleepTime = 3;
              processType = 'continue';
            } else if (messageType === 'retry') {
              sleepTime = 20;
              processType = 'continue';
            } else if (messageType === 'guardError') {
              message = lastLine;
              processType = 'continue';
              i++;
            } else if (messageType === 'equipError') {
              message += ` (${cellRank}, ${currentEquipName})`;
              processType = 'continue';
              i++;
            } else if (lastLine.length > 100) {
              message = 'どんぐりシステム';
              processType = 'continue';
              i++;
            } else if (messageType === 'quit') {
              message = '[停止] ' + lastLine;
              processType = 'return';
              clearInterval(autoJoinIntervalId);
              i++;
            } else if (messageType === 'reset') {
              processType = 'break';
              i++;
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
              i++;
            }

            if (success) {
              if (location.href.includes('/teambattle?m=rb')) {
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
              } else {
                if (currentProgress < 25) {
                  nextProgress = Math.floor(Math.random() * 8) + 31; // 31~38 -2~+1
                } else if (currentProgress < 50) {
                  nextProgress = Math.floor(Math.random() * 8) + 65; // 65~72 -2~+1
                } else if (currentProgress < 75) {
                  nextProgress = Math.floor(Math.random() * 8) + 81; // 81~88 -2~+1
                } else {
                  nextProgress = Math.floor(Math.random() * 8) + 15; // 15~22 -2~+1
                }
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
            i++;
          }
        }
        if (!success && regions[cellType].length === 0) {
            if (location.href.includes('/teambattle?m=rb')) {
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
            } else {
              if (currentProgress < 25) {
                nextProgress = Math.floor(Math.random() * 8) + 31; // 31~38 -2~+1
              } else if (currentProgress < 50) {
                nextProgress = Math.floor(Math.random() * 8) + 65; // 65~72 -2~+1
              } else if (currentProgress < 75) {
                nextProgress = Math.floor(Math.random() * 8) + 81; // 81~88 -2~+1
              } else {
                nextProgress = Math.floor(Math.random() * 8) + 15; // 15~22 -2~+1
              }
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

        const scriptContent = doc.querySelector('.grid > script').textContent;
        const cellColorsString = scriptContent.match(/const cellColors = ({.+?})/s)[1];
        const validJsonStr = cellColorsString.replace(/'/g, '"').replace(/,\s*}/, '}');
        const cellColors = JSON.parse(validJsonStr);
        const capitalMapString = scriptContent.match(/const capitalMap = (\[.*?\]);/s)[1];
        const capitalMap = JSON.parse(capitalMapString);

        const grid = doc.querySelector('.grid');
        //各末尾-1を消す
        const rows = Number(grid.style.gridTemplateRows.match(/repeat\((\d+), 35px\)/)[1]);
        const cols = Number(grid.style.gridTemplateColumns.match(/repeat\((\d+), 35px\)/)[1]);

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

  async function drawProgressBar(){
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
  function startAutoJoin() {
    clearInterval(progressBarIntervalId);
    progressBarIntervalId = null;
    autoJoin();
  }
  let progressBarIntervalId = setInterval(drawProgressBar, 18000);
  (()=>{ // autoJoinとprogressBarのinterval管理
    function stopAutoJoin() {
      if (autoJoinIntervalId) {
        clearInterval(autoJoinIntervalId);
        autoJoinIntervalId = null;
      }
      isAutoJoinRunning = false;
    }
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
