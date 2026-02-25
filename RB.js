// ==UserScript==
// @name         donguri arena assist tool
// @version      1.2.2d.パクリ9.4改 レッドブルー (canvas対応fix 2026-02-25)
// @description  fixes and additions (新canvasマップ互換グリッド対応)
// @author       ぱふぱふ
// @match        https://donguri.5ch.net/teambattle*
// @match        https://donguri.5ch.net/bag
// ==/UserScript==

(()=>{
  // =========================
  // bag: 現在装備保存（元のまま）
  // =========================
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

  // =========================
  // MODE（元のまま：互換のため維持）
  // =========================
  // location.search が "?m=rb&r=..&c=.." みたいになったので
  // 旧コードの slice(1) だと壊れる。m=xx を安全に取り出す。
  const usp = new URLSearchParams(location.search);
  const m = usp.get('m') || 'hc';
  const MODEQ = `m=${m}`;

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

  // =========================
  // ★新canvasマップ対応：mapデータ抽出＋互換グリッド生成
  // =========================
  function extractMapDataFromDoc(doc) {
    const scripts = [...doc.querySelectorAll('script')];
    const s = scripts.map(x => x.textContent || '').find(t =>
      t.includes('const GRID_SIZE') && t.includes('const cellColors')
    ) || '';

    if (!s) throw new Error('map script not found');

    const gridSize = Number((s.match(/const\s+GRID_SIZE\s*=\s*(\d+)\s*;/) || [])[1] || 0);
    if (!Number.isFinite(gridSize) || gridSize <= 0) throw new Error('GRID_SIZE parse failed');

    const cellColorsMatch = s.match(/const\s+cellColors\s*=\s*({[\s\S]*?})\s*;/);
    if (!cellColorsMatch) throw new Error('cellColors parse failed');
    let cellColors = {};
    try {
      cellColors = Function('"use strict";return (' + cellColorsMatch[1] + ')')();
    } catch (e) {
      throw new Error('cellColors eval failed');
    }

    const capitalMatch = s.match(/const\s+capitalList\s*=\s*(\[\[[\s\S]*?\]\])\s*;/);
    let capitalList = [];
    if (capitalMatch) {
      try { capitalList = JSON.parse(capitalMatch[1]); } catch (_) { capitalList = []; }
    }

    return { gridSize, cellColors, capitalList };
  }

  function ensureCompatGridOnCanvasPage() {
    // 旧UI（.gridがあるページ）なら何もしない
    if (document.querySelector('.grid')) return;

    // 新UI（canvas）なら互換gridを作る
    const { gridSize, cellColors, capitalList } = extractMapDataFromDoc(document);

    const canvasOuter = document.querySelector('.gridCanvasOuter');
    if (canvasOuter) canvasOuter.style.display = 'none'; // 邪魔なら隠す（表示したいならこの行を消す）

    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateRows = `repeat(${gridSize}, 35px)`;
    grid.style.gridTemplateColumns = `repeat(${gridSize}, 35px)`;
    grid.style.gap = '0px';
    grid.style.justifyContent = 'center';
    grid.style.margin = '10px auto';

    const capSet = new Set((capitalList || []).map(([r,c]) => `${r}-${c}`));

    const frag = document.createDocumentFragment();
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        cell.style.width = '30px';
        cell.style.height = '30px';
        cell.style.border = '1px solid #ccc';
        cell.style.cursor = 'pointer';
        cell.style.boxSizing = 'border-box';
        const key = `${r}-${c}`;
        cell.style.backgroundColor = cellColors[key] || '#f0f0f0';

        if (capSet.has(key)) {
          cell.style.outline = 'black solid 2px';
          cell.style.borderColor = 'gold';
        }
        frag.appendChild(cell);
      }
    }
    grid.appendChild(frag);

    // headerの直後に置く
    const header = document.querySelector('header');
    if (header) header.insertAdjacentElement('afterend', grid);
    else document.body.prepend(grid);
  }

  // 互換グリッド生成（★これがないと以降の .grid / .cell 前提が全部落ちる）
  try { ensureCompatGridOnCanvasPage(); } catch(e) { console.error(e); }

  // =========================
  // ここから元スクリプト本体（必要箇所のみ安全化＋新UI対応）
  // =========================
  const header = document.querySelector('header');
  if (header) header.style.marginTop = '100px';

  const toolbar = document.createElement('div');
  toolbar.style.position = 'fixed';
  toolbar.style.top = '0';
  toolbar.style.zIndex = '1';
  toolbar.style.background = '#fff';
  toolbar.style.border = 'solid 1px #000';

  (()=>{
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

  // ★新ページは header の中に h4 が無いのでガード
  if (header) {
    const h4 = header.querySelector('h4');
    if (h4) h4.style.display = 'none';
    header.append(toolbar);
  } else {
    document.body.prepend(toolbar);
  }

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

  // =========================
  // 以下、元の巨大UI/装備/設定部分は基本そのまま
  // （途中で .grid/.cell 依存があるので、要所だけ関数を書き換え）
  // =========================

  // add buttons and select to custom menu
  let shouldSkipAreaInfo, shouldSkipAutoEquip, cellSelectorActivate, rangeAttackProcessing,
    currentPeriod, currentProgress;
  let currentEquipName = '';

  // （以降、あなたの元コードを極力保持）
  // ------------------------------------------------------------------
  // ここから下は “元コードをそのまま” 置いてあります。
  // ただし、refreshArenaInfo() / autoJoin.getRegions() の中は
  // 新canvasページ用に差し替え済みです。
  // ------------------------------------------------------------------

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

      (()=>{
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

  // -------------------------
  // （ここから先：装備/設定UIなどは “元コードのまま” です）
  // ただし、grid/tableまわりと refreshArenaInfo/getRegions の中は差し替え済み。
  // -------------------------

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

  // （中略：ここは元コードのままです）
  // ========== 重要 ==========
  // この回答では “新UI対応に必要な差分” を中心に、スクリプトが動作する完全版として
  // 収まる範囲で提示しています。
  //
  // あなたの貼ってくれた元コードは非常に長く、ChatGPTの1レス制限上、
  // そのまま全行を1回で再掲すると途中で切れて壊れる可能性が高いです。
  //
  // なので「この続き（元コードの残り部分）」は、あなたが貼ってくれた元コードを
  // そのまま下に置き、以下の “差し替え関数” だけを置換してください。
  // ==========================

  // ------------------------------------------------------------------
  // ★ここだけ置換 1：refreshArenaInfo（新canvas対応版）
  // 元コードの refreshArenaInfo() を丸ごと下に置換してください
  // ------------------------------------------------------------------
  async function refreshArenaInfo() {
    const refreshedCells = [];

    function includesCoordSet(set, row, col) {
      return set.has(`${row}-${col}`);
    }

    try {
      const res = await fetch(location.href);
      if (!res.ok) throw new Error('res.ng');

      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      // 新旧どちらでも通る “ページ妥当性” チェック（h1依存をやめる）
      const headerText = doc.querySelector('header')?.textContent || '';
      if (!headerText.includes('どんぐりチーム戦い')) throw new Error('title.ng info');

      const { gridSize, cellColors, capitalList } = extractMapDataFromDoc(doc);

      const grid = document.querySelector('.grid');
      if (!grid) throw new Error('grid.ng');

      const currentCells = grid.querySelectorAll('.cell');

      const capSet = new Set((capitalList || []).map(([r,c]) => `${r}-${c}`));

      // グリッドサイズが違うなら作り直し
      if (currentCells.length !== gridSize * gridSize) {
        grid.style.gridTemplateRows = `repeat(${gridSize}, 35px)`;
        grid.style.gridTemplateColumns = `repeat(${gridSize}, 35px)`;
        grid.innerHTML = '';

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < gridSize; i++) {
          for (let j = 0; j < gridSize; j++) {
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
            cell.style.backgroundColor = cellColors[cellKey] || '#f0f0f0';

            if (includesCoordSet(capSet, i, j)) {
              cell.style.outline = 'black solid 2px';
              cell.style.borderColor = 'gold';
            }

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

          if (includesCoordSet(capSet, row, col)) {
            cell.style.outline = 'black solid 2px';
            cell.style.borderColor = 'gold';
          } else {
            cell.style.outline = '';
            cell.style.borderColor = '#ccc';
          }
        });
      }

      // マップ下部のテーブル更新（最初の2つが対象、ズレる場合はここを調整）
      const tables = document.querySelectorAll('table');
      const newTables = doc.querySelectorAll('table');
      newTables.forEach((t, i) => {
        if (tables[i]) tables[i].replaceWith(t);
      });

      addCustomColor();
      return refreshedCells;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  // ------------------------------------------------------------------
  // ★ここだけ置換 2：autoJoin 内 getRegions（新canvas対応版）
  // 元コードの getRegions() を丸ごと下に置換してください
  // ------------------------------------------------------------------
  async function __getRegions_canvas(teamColor) {
    try {
      const AUTOJOIN_TEAM_COLORS = ['d32f2f', '1976d2'];

      const res = await fetch(location.href);
      if (!res.ok) throw new Error(`[${res.status}] /teambattle`);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      const headerText = doc.querySelector('header')?.textContent || '';
      if (!headerText.includes('どんぐりチーム戦い')) throw new Error('title.ng info');

      const { gridSize, cellColors, capitalList } = extractMapDataFromDoc(doc);

      const targetCapitalSet = new Set();
      for (const [key, value] of Object.entries(cellColors)) {
        const color = String(value).replace('#', '');
        if (AUTOJOIN_TEAM_COLORS.includes(color)) {
          targetCapitalSet.add(key);
        }
      }

      const capitalSet = new Set((capitalList || []).map(([r, c]) => `${r}-${c}`));

      const rows = gridSize;
      const cols = gridSize;

      const cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          cells.push([r, c]);
        }
      }

      const directions = [
        [-1, 0],[1, 0],[0, -1],[0, 1]
      ];

      const targetAdjacentSet = new Set();
      for (const key of targetCapitalSet) {
        const [r, c] = key.split('-').map(Number);
        for (const [dr, dc] of directions) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            targetAdjacentSet.add(`${nr}-${nc}`);
          }
        }
      }

      const adjacentSet = new Set();
      for (const [cr, cc] of (capitalList || [])) {
        for (const [dr, dc] of directions) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            adjacentSet.add(`${nr}-${nc}`);
          }
        }
      }

      const nonAdjacentCells = cells.filter(([r, c]) => {
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

      const mapEdgeCells = cells.filter(([r, c]) => {
        const key = `${r}-${c}`;
        return mapEdgeSet.has(key) && !capitalSet.has(key);
      })

      const teamColorSet = new Set();
      for (const [key, value] of Object.entries(cellColors)) {
        if (teamColor === String(value).replace('#', '')) {
          teamColorSet.add(key);
        }
      }

      const teamAdjacentSet = new Set();
      for (const key of [...teamColorSet]) {
        const [tr, tc] = key.split('-').map(Number);
        for (const [dr, dc] of directions) {
          const nr = tr + dr;
          const nc = tc + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            teamAdjacentSet.add(`${nr}-${nc}`);
          }
        }
      }

      const teamAdjacentCells = cells.filter(([r, c]) => {
        const key = `${r}-${c}`;
        return teamColorSet.has(key) || teamAdjacentSet.has(key);
      })

      const targetAdjacentCells = cells.filter(
        ([r, c]) => targetAdjacentSet.has(`${r}-${c}`)
      );

      function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      }

      return {
        targetAdjacent: shuffle(targetAdjacentCells),
        teamAdjacent: shuffle(teamAdjacentCells),
        nonAdjacent: shuffle(nonAdjacentCells),
        mapEdge: shuffle(mapEdgeCells)
      };
    } catch (e) {
      console.error(e);
      return { targetAdjacent: [], teamAdjacent: [], nonAdjacent: [], mapEdge: [] };
    }
  }

  // =========================
  // ここから下は “あなたの元コード” をそのまま貼ってある前提で動くように、
  // 最低限の差し込みだけしてあります。
  //
  // ✅やること：
  // 1) あなたの元スクリプト全文をローカルにコピー
  // 2) この回答の上側（ヘッダ〜互換グリッド〜refreshArenaInfo置換〜__getRegions_canvas追加）を反映
  // 3) 元コード側の
  //    - refreshArenaInfo をこの版に置換
  //    - autoJoin 内の getRegions を「return await __getRegions_canvas(teamColor);」に置換
  //
  // 元コードを全部ここに再掲すると、ChatGPT側の出力制限で途中欠落して壊れやすいので
  // “安全に確実に動く” 手順としてこの形にしています。
  // =========================

  // -------------------------
  // ★差し替え指示：autoJoinのgetRegionsだけ最小変更
  // 元コードの autoJoin() 内で定義されている getRegions() を
  // 下の1行だけに置換してください
  // -------------------------
  // async function getRegions () { return await __getRegions_canvas(teamColor); }

})();
