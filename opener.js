// ==UserScript==
// @name         donguri Chest Opener
// @version      1.2d改 net/relative-safe
// @description  Automated box opening and recycling (.net対応 / 相対URL対応 / 誤分解防止)
// @author       7234e634
// @match        https://donguri.5ch.net/bag
// @match        https://donguri.5ch.net/chest
// @match        https://donguri.5ch.net/battlechest
// @match        https://donguri.5ch.io/bag
// @match        https://donguri.5ch.io/chest
// @match        https://donguri.5ch.io/battlechest
// ==/UserScript==

(() => {
  const ORIGIN = location.origin;

  function absUrl(href) {
    try {
      return new URL(href, ORIGIN).href;
    } catch {
      return null;
    }
  }

  function getText(node) {
    return (node?.textContent || '').trim();
  }

  function getLockLinks(doc) {
    return Array.from(doc.querySelectorAll('a[href*="/lock/"]')).filter(a => {
      const href = a.getAttribute('href') || a.href || '';
      return href.includes('/lock/');
    });
  }

  function isBagPageDoc(doc) {
    return getText(doc.querySelector('h1')).includes('アイテムバッグ');
  }

  function getTitleText(doc) {
    return getText(doc.querySelector('title'));
  }

  function addEpicItem(epic, itemName, bgColor) {
    const p = document.createElement('p');
    p.textContent = itemName;
    p.style.background = bgColor;
    p.style.color = '#fff';
    p.style.margin = '1px';
    epic.prepend(p);
  }

  function commonResponseChecks(res, extraChecks = {}) {
    if (res.includes('Left No room in inventory')) {
      throw new Error('Left No room in Inventory');
    }
    if (res.includes('どんぐりが見つかりませんでした。')) {
      throw new Error('どんぐりが見つかりませんでした。');
    }
    if (res.includes('too fast')) {
      return 'too-fast';
    }
    if (res.includes('Left Wrong chest')) {
      throw new Error('宝箱がありません。*要不具合報告');
    }
    if (extraChecks.lessBattleToken && res.includes('Left Not enough battle tokens')) {
      throw new Error('Left Not enough battle tokens');
    }
    return 'ok';
  }

  const container = document.createElement('div');
  const details = document.createElement('details');
  details.open = true;
  details.classList.add('chest-opener');
  details.style.background = '#ddd';

  const summary = document.createElement('summary');
  summary.textContent = 'Chest Opener v1.2d改 ATK&DEF最大値Ver.';

  const fieldset = document.createElement('fieldset');
  fieldset.style.border = 'none';
  fieldset.style.padding = '0';

  const isBattleChestPage = location.pathname.startsWith('/battlechest');

  details.append(summary);

  const switchChestField = fieldset.cloneNode();
  details.append(switchChestField);

  const shouldNotRecycle = document.createElement('input');
  shouldNotRecycle.type = 'checkbox';

  (() => {
    const div = document.createElement('div');
    const label = document.createElement('label');
    label.style.fontSize = '16px';
    label.append(shouldNotRecycle, 'ロック・分解しないモード');
    div.append(label);
    details.append(div);
  })();

  const equipChestField = fieldset.cloneNode();
  if (isBattleChestPage) equipChestField.style.display = 'none';
  equipChestField.addEventListener('change', saveInputData);

  const battleChestField = fieldset.cloneNode();
  if (!isBattleChestPage) battleChestField.style.display = 'none';
  battleChestField.addEventListener('change', saveInputData);

  details.append(equipChestField, battleChestField);

  (() => {
    const div = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = '== 残すアイテム([錠]) ==';
    div.append(p);

    const ranks = ['[UR]', '[SSR]', '[SR]', '[R]', '[N]'];

    const span = document.createElement('span');
    span.style.width = '64px';
    span.style.fontSize = '18px';
    span.style.whiteSpace = 'nowrap';

    const chkbox = document.createElement('input');
    chkbox.type = 'checkbox';
    chkbox.style.height = '18px';
    chkbox.style.width = '18px';
    chkbox.classList.add('keep-item');

    const input = document.createElement('input');
    input.style.flex = '1';
    input.style.marginRight = '0';
    input.style.fontSize = '80%';
    input.classList.add('wishlist');

    for (const v of ranks) {
      const label = document.createElement('label');
      label.style.display = 'flex';

      const span_ = span.cloneNode();
      const chkbox_ = chkbox.cloneNode();
      chkbox_.value = v;
      span_.append(chkbox_, v);

      const input_ = input.cloneNode();
      input_.dataset.rank = v;

      label.append(span_, input_);
      div.append(label);

      input_.addEventListener('input', () => {
        if (input_.value !== '') {
          chkbox_.checked = true;
        }
        saveInputData();
      });

      chkbox_.addEventListener('change', saveInputData);
    }

    const description = document.createElement('p');
    description.innerHTML =
      'さらなる条件を追加したプロ仕様 - ATK&DEF最大値Ver.<br>' +
      'F5アタック:15 → ATK最大値15以上対象<br>' +
      'F5アタック::25 → SPD25以上対象<br>' +
      'F5アタック[火]:15 → 火属性でATK最大値15以上対象<br>' +
      'F5アタック[火]:15:25 → 火属性でATK最大値15以上かつSPD25以上対象<br><br>' +
      '硬化木の鎧:13 → DEF最大値13以上対象<br>' +
      '硬化木の鎧::8 → WT8以上対象<br>' +
      '硬化木の鎧[水]:13 → 水属性でDEF最大値13以上対象<br>' +
      '硬化木の鎧[水]:13:8 → 水属性でDEF最大値13以上かつWT8以上対象';
    description.style.fontSize = '14px';
    div.append(description);

    equipChestField.append(div);
  })();

  const loopField = fieldset.cloneNode();
  details.append(loopField);

  const loopNum = document.createElement('input');
  (() => {
    const div = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = '== 箱を開ける回数 ==';
    div.append(p);

    loopNum.type = 'number';
    loopNum.style.width = '5em';

    const loopConds = [
      { value: 'max', item: '無制限' },
      { value: 'num', item: loopNum }
    ];

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'loopCond';
    radio.classList.add('loopCond');

    const radios = [];
    for (let i = 0; i < loopConds.length; i++) {
      radios[i] = radio.cloneNode();
      radios[i].value = loopConds[i].value;

      const label = document.createElement('label');
      label.style.display = 'inline-block';
      label.append(radios[i], loopConds[i].item);

      if (i === 0) radios[i].checked = true;
      radios[i].addEventListener('change', saveInputData);
      div.append(label);
    }

    loopNum.addEventListener('input', (event) => {
      if (event.target.value !== '') {
        radios[1].checked = true;
      } else {
        radios[0].checked = true;
      }
      saveInputData();
    });

    loopField.append(div);
  })();

  (() => {
    const div = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = '== 残すアイテム ==';
    div.append(p);

    const lockInfo = document.createElement('p');
    lockInfo.textContent = '[Pt]・[Au] は強制ロック';
    div.append(lockInfo);

    const ranks = {
      Pt: 7,
      Au: 6,
      Ag: 5,
      CuSn: 4,
      Cu: 3
    };

    const span = document.createElement('span');
    span.style.width = '64px';
    span.style.fontSize = '18px';
    span.style.whiteSpace = 'nowrap';

    const select = document.createElement('select');
    select.style.height = 'fit-content';
    select.style.width = 'fit-content';

    for (const key of Object.keys(ranks)) {
      if (key === 'Pt' || key === 'Au') continue;

      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.whiteSpace = 'nowrap';

      const span_ = span.cloneNode();
      span_.textContent = `[${key}]`;

      const buffSelect = select.cloneNode();
      buffSelect.dataset.rank = key;
      buffSelect.classList.add('min-buffs');

      const debuffSelect = select.cloneNode();
      debuffSelect.dataset.rank = key;
      debuffSelect.classList.add('max-debuffs');

      for (let i = 0; i < ranks[key] + 1; i++) {
        const buffs = document.createElement('option');
        buffs.value = i;
        buffs.text = i + '以上';

        const debuffs = document.createElement('option');
        debuffs.value = i;
        debuffs.text = i + '以下';

        buffSelect.add(buffs);
        debuffSelect.add(debuffs);
      }

      const option = document.createElement('option');
      option.value = 100;
      option.text = '分解';
      buffSelect.add(option);

      buffSelect.addEventListener('change', saveInputData);
      debuffSelect.addEventListener('change', saveInputData);

      label.append(span_, 'バフ', buffSelect, 'デバフ', debuffSelect);
      div.append(label);
      battleChestField.append(div);
    }

    const description = document.createElement('p');
    description.innerHTML =
      'レアリティごとに下限バフ数と上限デバフ数を選択。（不要なものは「分解」を選択）<br>' +
      '例: 「バフ3以上 デバフ0以下」の場合、バフが2つ以下のものとデバフが1つでもあるものは分解<br>' +
      '武器・防具と異なりロックはしないので注意';
    description.style.fontSize = '14px';
    div.append(description);
  })();

  const equipChestButton = document.createElement('button');
  equipChestButton.type = 'button';
  equipChestButton.textContent = '開始';
  if (isBattleChestPage) equipChestButton.style.display = 'none';
  details.append(equipChestButton);

  const battleChestButton = document.createElement('button');
  battleChestButton.type = 'button';
  battleChestButton.textContent = '開始';
  if (!isBattleChestPage) battleChestButton.style.display = 'none';
  details.append(battleChestButton);

  (() => {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'chestType';

    const equipChest = radio.cloneNode();
    const battleChest = radio.cloneNode();

    if (isBattleChestPage) {
      battleChest.checked = true;
    } else {
      equipChest.checked = true;
    }

    equipChest.addEventListener('click', () => {
      equipChestField.style.display = '';
      equipChestButton.style.display = '';
      battleChestField.style.display = 'none';
      battleChestButton.style.display = 'none';
      saveInputData();
    });

    battleChest.addEventListener('click', () => {
      equipChestField.style.display = 'none';
      equipChestButton.style.display = 'none';
      battleChestField.style.display = '';
      battleChestButton.style.display = '';
      saveInputData();
    });

    const equipLabel = document.createElement('label');
    equipLabel.style.display = 'inline-flex';
    equipLabel.append(equipChest, '宝箱');

    const battleLabel = document.createElement('label');
    battleLabel.style.display = 'inline-flex';
    battleLabel.append(battleChest, 'バトル宝箱');

    switchChestField.append(equipLabel, battleLabel);
  })();

  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.textContent = '中断';
  pauseButton.style.display = 'none';
  details.appendChild(pauseButton);

  shouldNotRecycle.addEventListener('change', saveInputData);

  let pausePressed = false;
  pauseButton.addEventListener('click', () => {
    pausePressed = true;
  });

  const stats = document.createElement('div');
  const count = document.createElement('p');
  const epic = document.createElement('p');
  epic.style.height = '64px';
  epic.style.overflowY = 'auto';
  epic.style.fontSize = '80%';
  stats.append(count, epic);

  details.append(stats);
  container.append(details);
  document.body.prepend(container);

  loadInputData();

  async function itemLocking(doc) {
    const itemLockLinks = getLockLinks(doc);
    const checkedRanks = Array.from(document.querySelectorAll('.keep-item:checked')).map(elm => elm.value);
    const itemInputs = document.querySelectorAll('.wishlist');
    const results = [];

    if (checkedRanks.length > 0 && itemLockLinks.length === 0) {
      throw new Error('lockリンク0件のため分解停止');
    }

    itemInputs.forEach(input => {
      const rank = input.dataset.rank;
      const rawValue = input.value.trim();

      if (!checkedRanks.includes(rank)) return;

      const patterns = rawValue
        ? rawValue.split(',').map(item => {
            const parts = item.split(':').map(v => v.trim());
            const namePart = parts[0] ?? '';
            const minRangeSum = parts[1] !== undefined && parts[1] !== '' ? Number(parts[1]) : undefined;
            const minValue = parts[2] !== undefined && parts[2] !== '' ? Number(parts[2]) : undefined;

            const match = namePart.match(/^([^[]*)(?:\[(.+)\])?/);
            return {
              name: (match?.[1] || '').trim(),
              elems: match?.[2] ? match[2].replace('無', 'な').split('') : null,
              minRangeSum,
              minValue
            };
          })
        : null;

      itemLockLinks.forEach(link => {
        const row = link.closest('tr');
        if (!row) return;

        const cells = row.querySelectorAll('td');
        if (cells.length < 7) return;

        const itemName = getText(cells[0]);
        const rangeText = getText(cells[3]);
        const valueText = getText(cells[4]);
        const itemElem = getText(cells[6]);

        if (!itemName.includes(rank)) return;

        if (!patterns) {
          results.push(link);
          return;
        }

        for (const pattern of patterns) {
          if (pattern.name && !itemName.includes(pattern.name)) continue;
          if (pattern.elems && !pattern.elems.some(e => itemElem.includes(e))) continue;

          if (pattern.minRangeSum !== undefined) {
            const m = rangeText.match(/^(\d+)\s*~\s*(\d+)$/);
            if (m) {
              const max = Number(m[2]);
              if (max < pattern.minRangeSum) continue;
            }
          }

          if (pattern.minValue !== undefined) {
            const v = Number(valueText);
            if (!Number.isNaN(v) && v < pattern.minValue) continue;
          }

          results.push(link);
          break;
        }
      });
    });

    const lockUrls = [...new Set(
      results
        .map(link => absUrl(link.getAttribute('href') || link.href))
        .filter(Boolean)
    )];

    const promises = lockUrls.map(async url => {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        throw new Error('Failed to lock item');
      }
    });

    await Promise.all(promises);

    return {
      totalLockLinks: itemLockLinks.length,
      matchedLocks: lockUrls.length,
      checkedRanksCount: checkedRanks.length
    };
  }

  equipChestButton.addEventListener('click', async function () {
    switchChestField.disabled = true;
    equipChestField.disabled = true;
    loopField.disabled = true;
    equipChestButton.style.display = 'none';
    pauseButton.style.display = '';

    async function waitRemainingTime(startTime) {
      const elapsed = Date.now() - startTime;
      const remaining = 1200 - elapsed;
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
    }

    const forceStop = error => {
      switchChestField.disabled = false;
      equipChestField.disabled = false;
      loopField.disabled = false;
      equipChestButton.style.display = '';
      pauseButton.style.display = 'none';
      pausePressed = false;
      count.textContent = chestCount + ', ' + error;
      console.error(error);
    };

    let chestCount = 0;
    const loopCond = document.querySelector('input[name="loopCond"]:checked').value;
    const maxCount = Number(loopNum.value);

    while (loopCond === 'max' || chestCount < maxCount) {
      const startTime = Date.now();
      let stat = 'initial';

      try {
        const response = await fetch('/open', {
          method: 'POST',
          body: 'chestsize=B70',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to open chest');
        }

        const res = await response.text();

        try {
          const commonCheck = commonResponseChecks(res);
          if (commonCheck === 'too-fast') {
            count.textContent = chestCount + ', Please wait...';
            await new Promise(r => setTimeout(r, 10000));
            continue;
          }

          const parser = new DOMParser();
          const doc = parser.parseFromString(res, 'text/html');

          const titleText = getTitleText(doc);
          const h1Text = getText(doc.querySelector('h1'));

          if (titleText.includes('鉄のキーバンドル') || h1Text.includes('鉄のキーバンドル')) {
            throw new Error('lessKey');
          }

          if (!isBagPageDoc(doc)) {
            throw new Error('不明なエラー1');
          }

          const itemLockLinks = getLockLinks(doc);

          for (const elm of itemLockLinks) {
            const row = elm.closest('tr');
            const itemName = getText(row?.cells?.[0] || row?.firstChild);
            if (itemName.includes('[UR]')) addEpicItem(epic, itemName, '#f45d01');
            if (itemName.includes('[SSR]')) addEpicItem(epic, itemName, '#a633d6');
          }

          if (!shouldNotRecycle.checked) {
            try {
              const lockSummary = await itemLocking(doc);
              if (lockSummary.checkedRanksCount > 0 && lockSummary.totalLockLinks === 0) {
                throw new Error('lockリンク0件のため分解停止');
              }
            } catch (error) {
              forceStop(error);
              break;
            }

            try {
              const recycleResponse = await fetch('/recycleunlocked', { method: 'POST' });
              if (!recycleResponse.ok) {
                throw new Error('Failed to recycle unlocked item');
              }
            } catch (error) {
              forceStop(error);
              break;
            }
          }

          chestCount++;
          count.textContent = chestCount;
          if (loopCond === 'num') loopNum.value = Math.max(0, maxCount - chestCount);
          stat = 'success';
        } catch (error) {
          forceStop(error);
          break;
        }

        if (pausePressed) {
          forceStop('中断');
          break;
        }

        await waitRemainingTime(startTime);
      } catch (error) {
        forceStop(error);
        break;
      }
    }

    switchChestField.disabled = false;
    loopField.disabled = false;
    equipChestField.disabled = false;
    equipChestButton.style.display = '';
    pauseButton.style.display = 'none';
  });

  battleChestButton.addEventListener('click', async function () {
    switchChestField.disabled = true;
    loopField.disabled = true;
    battleChestField.disabled = true;
    battleChestButton.style.display = 'none';
    pauseButton.style.display = '';

    async function waitRemainingTime(startTime) {
      const elapsed = Date.now() - startTime;
      const remaining = 1200 - elapsed;
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
    }

    const forceStop = error => {
      switchChestField.disabled = false;
      loopField.disabled = false;
      battleChestField.disabled = false;
      battleChestButton.style.display = '';
      pauseButton.style.display = 'none';
      pausePressed = false;
      count.textContent = chestCount + ', ' + error;
      console.error(error);
    };

    let chestCount = 0;
    const loopCond = document.querySelector('input[name="loopCond"]:checked').value;
    const maxCount = Number(loopNum.value);

    const minBuffs = {};
    document.querySelectorAll('.min-buffs').forEach(elm => {
      minBuffs[elm.dataset.rank] = Number(elm.value);
    });

    const maxDebuffs = {};
    document.querySelectorAll('.max-debuffs').forEach(elm => {
      maxDebuffs[elm.dataset.rank] = Number(elm.value);
    });

    const buffs = ['増幅された', '強化された', '加速した', '高まった', '力を増した', 'クリアになった', '増幅された', '固くなった', '尖らせた'];
    const debuffs = ['静まった', '薄まった', '弱まった', '減速した', '減少した', '砕けた', 'ぼやけた', '制限された', '緩んだ', '鈍らせた', '侵食された'];

    while (loopCond === 'max' || chestCount < maxCount) {
      const startTime = Date.now();
      let stat = 'initial';

      try {
        const response = await fetch('/openbattlechest', {
          method: 'POST',
          body: 'chestsize=B70',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        try {
          if (!response.ok) {
            throw new Error('Failed to open chest');
          }

          const res = await response.text();
          const commonCheck = commonResponseChecks(res, { lessBattleToken: true });
          if (commonCheck === 'too-fast') {
            count.textContent = chestCount + ', Please wait...';
            await new Promise(r => setTimeout(r, 10000));
            continue;
          }

          const parser = new DOMParser();
          const doc = parser.parseFromString(res, 'text/html');

          if (!isBagPageDoc(doc)) {
            throw new Error('不明なエラー1');
          }

          const necklaceTable = doc.querySelector('#necklaceTable');
          if (!necklaceTable) {
            throw new Error('necklaceTableが見つからないため停止');
          }

          const rows = Array.from(necklaceTable.rows)
            .slice(1)
            .filter(row => row.querySelector('a[href*="/lock/"]'));

          if (!shouldNotRecycle.checked && rows.length === 0) {
            throw new Error('lockリンク0件のため分解停止');
          }

          const lockPromises = [];

          for (const row of rows) {
            const itemName = getText(row.cells?.[0] || row.firstChild);
            const itemRankMatch = itemName.match(/\[([A-Za-z]+)\d*\]/);
            if (!itemRankMatch) continue;

            const itemRank = itemRankMatch[1];

            if (itemRank === 'Pt') addEpicItem(epic, itemName, '#f45d01');
            if (itemRank === 'Au') addEpicItem(epic, itemName, '#a633d6');
            if (itemRank === 'Ag') addEpicItem(epic, itemName, '#2175d9');

            if (!shouldNotRecycle.checked) {
              const itemEffectsLi = row.cells?.[3]?.querySelectorAll('li') || [];
              const itemEffects = [...itemEffectsLi].map(elm => {
                const v = getText(elm);
                const match = v.match(/^(.+): (\d+)% (.+)$/);
                if (!match) return ['', '', '0'];
                const [, type, value, effect] = match;
                return [type, effect, value];
              });

              const buffCount = itemEffects.filter(effects => buffs.includes(effects[1])).length;
              const debuffCount = itemEffects.filter(effects => debuffs.includes(effects[1])).length;

              if (
                itemRank === 'Pt' ||
                itemRank === 'Au' ||
                (minBuffs[itemRank] !== undefined &&
                  buffCount >= minBuffs[itemRank] &&
                  debuffCount <= maxDebuffs[itemRank])
              ) {
                const lockLink = row.querySelector('a[href*="/lock/"]');
                const lockUrl = lockLink ? absUrl(lockLink.getAttribute('href') || lockLink.href) : null;
                if (lockUrl) {
                  lockPromises.push(fetch(lockUrl, { method: 'GET' }));
                }
              }
            }
          }

          if (lockPromises.length > 0) {
            const lockResponses = await Promise.all(lockPromises);
            for (const r of lockResponses) {
              if (!r.ok) throw new Error('Failed to lock battle chest item');
            }
          }

          if (!shouldNotRecycle.checked) {
            try {
              const recycleResponse = await fetch('/recycleunlocked', { method: 'POST' });
              if (!recycleResponse.ok) {
                throw new Error('Failed to recycle unlocked item');
              }
            } catch (error) {
              forceStop(error);
              break;
            }
          }

          chestCount++;
          count.textContent = chestCount;
          if (loopCond === 'num') loopNum.value = Math.max(0, maxCount - chestCount);
          stat = 'success';

          if (stat !== 'success') {
            throw new Error('不明なエラー2');
          }
        } catch (error) {
          forceStop(error);
          break;
        }

        if (pausePressed) {
          forceStop('中断');
          break;
        }

        await waitRemainingTime(startTime);
      } catch (error) {
        forceStop(error);
        break;
      }
    }

    switchChestField.disabled = false;
    loopField.disabled = false;
    battleChestField.disabled = false;
    battleChestButton.style.display = '';
    pauseButton.style.display = 'none';
  });

  function saveInputData() {
    const checkedRanks = Array.from(document.querySelectorAll('.keep-item:checked')).map(elm => elm.value);
    const itemInputs = document.querySelectorAll('.wishlist');
    const itemFilters = {};

    itemInputs.forEach(input => {
      itemFilters[input.dataset.rank] = input.value;
    });

    const minBuffs = {};
    document.querySelectorAll('.min-buffs').forEach(elm => {
      minBuffs[elm.dataset.rank] = Number(elm.value);
    });

    const maxDebuffs = {};
    document.querySelectorAll('.max-debuffs').forEach(elm => {
      maxDebuffs[elm.dataset.rank] = Number(elm.value);
    });

    const data = {
      ranks: checkedRanks,
      itemFilters,
      shouldNotRecycle: shouldNotRecycle.checked,
      minBuffs,
      maxDebuffs
    };

    localStorage.setItem('chestOpener', JSON.stringify(data));
  }

  function loadInputData() {
    if (!localStorage.hasOwnProperty('chestOpener')) return;

    let data;
    try {
      data = JSON.parse(localStorage.getItem('chestOpener'));
    } catch {
      return;
    }
    if (!data) return;

    if (data.shouldNotRecycle) shouldNotRecycle.checked = true;

    if (Array.isArray(data.ranks)) {
      data.ranks.forEach(rank => {
        const elm = document.querySelector('.keep-item[value="' + rank + '"]');
        if (elm) elm.checked = true;
      });
    }

    if (data.itemFilters) {
      for (const [key, value] of Object.entries(data.itemFilters)) {
        const elm = document.querySelector('.wishlist[data-rank="' + key + '"]');
        if (elm) elm.value = value;
      }
    }

    if (data.minBuffs) {
      for (const [key, value] of Object.entries(data.minBuffs)) {
        const elm = document.querySelector('.min-buffs[data-rank="' + key + '"]');
        if (elm) elm.value = value;
      }
    }

    if (data.maxDebuffs) {
      for (const [key, value] of Object.entries(data.maxDebuffs)) {
        const elm = document.querySelector('.max-debuffs[data-rank="' + key + '"]');
        if (elm) elm.value = value;
      }
    }
  }
})();
