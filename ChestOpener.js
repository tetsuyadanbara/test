// ==UserScript==
// @name         donguri Chest Opener
// @version      1.2c改
// @description  Automated box opening and recycling
// @author       7234e634
// @match        https://donguri.5ch.net/bag
// @match        https://donguri.5ch.net/chest
// @match        https://donguri.5ch.net/battlechest
// ==/UserScript==

(()=>{
  const container = document.createElement('div');
  const details = document.createElement('details');
  details.open = true;
  details.classList.add('chest-opener');
  details.style.background = '#ddd';
  const summary = document.createElement('summary');
  summary.textContent = 'Chest Opener v1.2c改 ATK&DEF合算値Ver.';

  const fieldset = document.createElement('fieldset');
  fieldset.style.border = 'none';
  fieldset.style.padding = '0';

  const isBattleChestPage = location.href.startsWith('https://donguri.5ch.net/battlechest');

  // switch chest
  const switchChestField = fieldset.cloneNode();
  (()=>{
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
    equipChest.addEventListener('click',()=>{
      equipChestField.style.display = '';
      equipChestButton.style.display = '';
      battleChestField.style.display = 'none';
      battleChestButton.style.display = 'none';
    })
    battleChest.addEventListener('click',()=>{
      equipChestField.style.display = 'none';
      equipChestButton.style.display = 'none';
      battleChestField.style.display = '';
      battleChestButton.style.display = '';
    })

    const equipLabel = document.createElement('label');
    equipLabel.style.display = 'inline-flex';
    equipLabel.append(equipChest, '宝箱');
    const battleLabel = document.createElement('label');
    battleLabel.style.display = 'inline-flex';
    battleLabel.append(battleChest, 'バトル宝箱');
    switchChestField.append(equipLabel, battleLabel);
    details.append(switchChestField);
  })();

  const shouldNotRecycle = document.createElement('input');
  shouldNotRecycle.type = 'checkbox';
  (()=>{
    const div = document.createElement('div');
    const label = document.createElement('label');
    label.style.fontSize = '16px';

    label.append(shouldNotRecycle, 'ロック・分解しないモード');
    div.append(label);
    details.append(div);
  })();

  const form = document.createElement('form');
  const equipChestField = fieldset.cloneNode();
  if(isBattleChestPage) equipChestField.style.display = 'none';
  form.append(equipChestField);
  equipChestField.addEventListener('change', saveInputData);

  const battleChestField = fieldset.cloneNode();
  if(!isBattleChestPage) battleChestField.style.display = 'none';
  form.append(battleChestField);
  battleChestField.addEventListener('change', saveInputData);

  details.append(summary,equipChestField,battleChestField);

  // item settings
  (()=>{
    const div = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = '== 残すアイテム([錠]) ==';
    div.append(p);

    const ranks = ['[UR]','[SSR]','[SR]','[R]','[N]'];
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

for(const v of ranks){
  const label = document.createElement('label');
  label.style.display = 'flex';
  label.style.flexDirection = 'column'; // ここで縦に並べる

  const span_ = span.cloneNode();
  const chkbox_ = chkbox.cloneNode();
  chkbox_.value = v;
  span_.append(chkbox_, v);

  const input_1 = input.cloneNode();
  input_1.dataset.rank = v + "_1"; // rankにユニークな識別子を追加
  const input_2 = input.cloneNode();
  input_2.dataset.rank = v + "_2"; // rankにユニークな識別子を追加

  label.append(span_, input_1, input_2); // フォームを2つ追加
  div.append(label);

  input_1.addEventListener('input',()=>{
    if(input_1.value !== ''){
      chkbox_.checked = true;
    }
  });
  input_2.addEventListener('input',()=>{
    if(input_2.value !== ''){
      chkbox_.checked = true;
    }
  });
};

    const description = document.createElement('p');
    description.innerHTML = 'さらなる条件を追加したプロ仕様 - ATK&DEF合算値Ver.<br>F5アタック:20 → ATK最小最大の合計20以上対象<br>F5アタック::25 → SPD25以上対象<br>F5アタック[火]:20 → 火属性でATK最小最大の合計20以上対象<br>F5アタック[火]:20:25 → 火属性でATK最小最大の合計20以上かつSPD25以上対象<br><br>硬化木の鎧:13 → DEF最小最大の合計13以上対象<br>硬化木の鎧::8 → WT8以上対象<br>硬化木の鎧[水]:13 → 水属性でDEF最小最大の合計13以上対象<br>硬化木の鎧[水]:13:8 → 水属性でDEF最小最大の合計13以上かつWT8以上対象';
    description.style.fontSize = '14px';
    div.append(description);
    equipChestField.append(div);
  })();

  // loop options
  const loopField = fieldset.cloneNode();
  details.append(loopField);
  const loopNum = document.createElement('input');
  (()=>{
    const div = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = '== 箱を開ける回数 ==';
    div.append(p);
    loopNum.type = 'number';
    loopNum.style.width = '5em';

    const loopConds = [
      {value:'max',item:'無制限',checked:true},
      {value:'num',item:loopNum,checked:false},
    ];

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'loopCond';
    radio.classList.add('loopCond');

    const radios = [];
    for(let i=0; i<loopConds.length; i++){
      radios[i] = radio.cloneNode();
      radios[i].value = loopConds[i].value;
      const label = document.createElement('label');
      label.style.display = 'inline-block';
      label.append(radios[i], loopConds[i].item);
      radios[0].checked = true;
      div.append(label);
    }
    loopNum.addEventListener('input',(event)=>{
      if(event.target.value !== ''){
        radios[1].checked = true;
      } else {
        radios[0].checked = true;
      }
    })
    loopField.append(div);
  })();

  // battle chest
  (()=>{
    const div = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = '== 残すアイテム ==';
    div.append(p);

    const lockInfo = document.createElement('p');
    lockInfo.textContent = '[Pt]・[Au] は強制ロック';
    div.append(lockInfo);

  // アイテムランク
    const ranks = {
      Pt:7,
      Au:6,
      Ag:5,
      CuSn:4,
      Cu:3
    };

    const span = document.createElement('span');
    span.style.width = '64px';
    span.style.fontSize = '18px';
    span.style.whiteSpace = 'nowrap';

    const select = document.createElement('select');
    select.style.height = 'fit-content';
    select.style.width = 'fit-content';

    for(const key of Object.keys(ranks)){
      if (key === 'Pt' || key === 'Au') {
    continue; // Pt と Au をスキップ
  }
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.display.whiteSpace = 'nowrap';

      const span_ = span.cloneNode();
      span_.textContent = `[${key}]`;

      const buffSelect = select.cloneNode();
      buffSelect.dataset.rank = key;
      buffSelect.classList.add('min-buffs');
      const debuffSelect = select.cloneNode();
      debuffSelect.dataset.rank = key;
      debuffSelect.classList.add('max-debuffs');

      for(let i=0; i<ranks[key]+1; i++){
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

      label.append(span_, 'バフ', buffSelect, 'デバフ', debuffSelect);
      div.append(label);
      battleChestField.append(div);
    };

    const description = document.createElement('p');
    description.innerHTML = 'レアリティごとに下限バフ数と上限デバフ数を選択。（不要なものは「分解」を選択）<br>例: 「バフ3以上 デバフ0以下」の場合、バフが2つ以下のものとデバフが1つでもあるものは分解<br>武器・防具と異なりロックはしないので注意';
    description.style.fontSize = '14px';
    div.append(description);
  })();

  const equipChestButton = document.createElement('button');
  equipChestButton.type = 'button';
  equipChestButton.textContent = '開始';
  if(isBattleChestPage) equipChestButton.style.display = 'none';
  details.append(equipChestButton);

  const battleChestButton = document.createElement('button');
  battleChestButton.type = 'button';
  battleChestButton.textContent = '開始';
  if(!isBattleChestPage) battleChestButton.style.display = 'none';
  details.append(battleChestButton);

  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.textContent = '中断';
  pauseButton.style.display = 'none';
  details.appendChild(pauseButton);

  let pausePressed = false;
  pauseButton.addEventListener('click', ()=>{
    pausePressed = true;
  });

  const stats = document.createElement('div');
  const count = document.createElement('p');
  const epic = document.createElement('p');
  epic.style.height = '64px';
  epic.style.overflowY = 'auto';
  epic.style.fontSize = '80%';
  stats.append(count,epic);

  details.append(stats);
  container.append(details);
  document.body.prepend(container);
  loadInputData();


  equipChestButton.addEventListener('click',async function() {
    switchChestField.disabled = true;
    equipChestField.disabled = true;
    loopField.disabled = true;
    equipChestButton.style.display = 'none';
    pauseButton.style.display = '';

    // too fast対策の待機
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
    }

    let chestCount = 0;
    const loopCond = document.querySelector('input[name="loopCond"]:checked').value;
    const maxCount = Number(loopNum.value);

    while (loopCond === 'max' || chestCount < maxCount){
      const startTime = Date.now();
      let stat = 'initial';
      try {
        const response = await fetch('https://donguri.5ch.net/open', {
          method: 'POST',
          body: 'chestsize=B70', /* 小: A65, 大: B70 */
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to open chest');
        }
        const res = await response.text();

        try {
          if (res.includes('Left No room in inventory')){
            throw new Error('Left No room in Inventory');
          }
          if (res.includes('どんぐりが見つかりませんでした。')){
            throw new Error('どんぐりが見つかりませんでした。');
          }
          if (res.includes('too fast')){
            throw new Error('too fast');
          }
          if (res.includes('Left Wrong chest')){
            throw new Error('宝箱がありません。*要不具合報告');
          }
          const parser = new DOMParser();
          const doc = parser.parseFromString(res, 'text/html');

          const title = doc.querySelector('title');
          const h1 = doc.querySelector('h1');

          if (title.textContent.includes('鉄のキーバンドル') || h1.textContent.includes('鉄のキーバンドル')) {
            throw new Error('lessKey');
          }
          if (!h1.textContent.includes('アイテムバッグ')) {
            throw new Error('不明なエラー1');
          }

          if(h1.textContent.includes('アイテムバッグ')){
            const itemLockLinks = doc.querySelectorAll('a[href^="https://donguri.5ch.net/lock/"]');

            for(const elm of itemLockLinks){
              const itemName = elm.closest('tr').firstChild.textContent;
              // URとSSRを表示
              if(itemName.includes('[UR]') || itemName.includes('[SSR]')) {
                const p = document.createElement('p');
                p.textContent = itemName;
                if(itemName.includes('[UR]')) p.style.background = '#f45d01';
                if(itemName.includes('[SSR]')) p.style.background = '#a633d6';
                p.style.color = '#fff';
                p.style.margin = '1px';
                epic.prepend(p);
              }
            }

            if(!shouldNotRecycle.checked){
              // アイテムロック
              try {
                await itemLocking(doc);
              } catch (error) {
                forceStop(error);
                break;
              }

              // 残りを分解
              try {
                const response = await fetch('https://donguri.5ch.net/recycleunlocked', {method: 'POST'});
                if (!response.ok) {
                  throw new Error('Failed to recycle unlocked item');
                }
              } catch(error) {
                forceStop(error);
                break;
              }
            }
            chestCount++;
            count.textContent = chestCount;
            if (loopCond === 'num') loopNum.value = maxCount - chestCount;
            stat = 'success';
          }
          if(stat !== 'success') {
            throw new Error('不明なエラー2');
          }
        } catch (error) {
          forceStop(error);
          break;
        }

        if(pausePressed) {
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
  })

  async function itemLocking(doc) {
    const itemLockLinks = doc.querySelectorAll('a[href^="https://donguri.5ch.net/lock/"]');
    const checkedRanks = Array.from(document.querySelectorAll('.keep-item:checked')).map(elm => elm.value);
    const itemInputs = document.querySelectorAll('.wishlist');
    const results = [];

    itemInputs.forEach(input => {
      const rank = input.dataset.rank.replace(/_.+$/, '');
      const rawValue = input.value.trim();

      if (!checkedRanks.includes(rank)) return;

 const patterns = rawValue
   ? rawValue
      .split(',')
      .map(item => item.trim())
      .filter(item => item !== '')
      .map(item => {
            const parts = item.split(':').map(v => v.trim());
            const namePart = parts[0] ?? '';
            const minRangeSum = parts[1] !== undefined && parts[1] !== '' ? Number(parts[1]) : undefined;
            const minValue = parts[2] !== undefined && parts[2] !== '' ? Number(parts[2]) : undefined;

            const match = namePart.match(/^([^[]*)(?:\[(.+)\])?/);
            return {
              name: match[1].trim(),
              elems: match[2]
                ? match[2].replace('無', 'な').split('')
                : null,
              minRangeSum,
              minValue
            };
          })
        : null;
      if (patterns && patterns.length === 0) {
        patterns = null;
      }

      itemLockLinks.forEach(link => {
        const row = link.closest('tr');
        const cells = row.querySelectorAll('td');

        const itemName = cells[0].textContent;
        const rangeText = cells[3].textContent;
        const valueText = cells[4].textContent;
        const itemElem = cells[6].textContent;

        if (!itemName.includes(rank)) return;

        // 入力なし → rank一致のみでロック
        if (!patterns) {
          results.push(link);
          return;
        }

        for (const pattern of patterns) {
          // 名前
          if (!itemName.includes(pattern.name)) continue;

          // 属性
          if (pattern.elems && !pattern.elems.some(e => itemElem.includes(e))) continue;

          // 4番目（範囲合計）
          if (pattern.minRangeSum !== undefined) {
            const m = rangeText.match(/^(\d+)\s*~\s*(\d+)$/);
            if (m) {
              const sum = Number(m[1]) + Number(m[2]);
              if (sum < pattern.minRangeSum) continue;
            }
            // 数値~数値でない場合はロック側に倒す（何もしない）
          }

          // 5番目（数値以上）
          if (pattern.minValue !== undefined) {
            const v = Number(valueText);
            if (!Number.isNaN(v)) {
              if (v < pattern.minValue) continue;
            }
            // 数値でない場合はロック側に倒す
          }

          results.push(link);
          break;
        }
      });
    });

    const promises = results.map(async link => {
      const response = await fetch(link.href, { method: 'GET' });
      if (!response.ok) {
        throw new Error('Failed to lock item');
      }
    });

    await Promise.all(promises);
  }


  battleChestButton.addEventListener('click',async function () {
    switchChestField.disabled = true;
    loopField.disabled = true;
    battleChestField.disabled = true;
    battleChestButton.style.display = 'none';
    pauseButton.style.display = '';

    // too fast対策の待機
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
    }

    let chestCount = 0;
    const loopCond = document.querySelector('input[name="loopCond"]:checked').value;
    const maxCount = Number(loopNum.value);

    const minBuffs = {};
    document.querySelectorAll('.min-buffs').forEach(elm => {
      const rank = elm.dataset.rank;
      minBuffs[rank] = Number(elm.value);
    });

    const maxDebuffs = {};
    document.querySelectorAll('.max-debuffs').forEach(elm => {
      const rank = elm.dataset.rank;
      maxDebuffs[rank] = Number(elm.value);
    });

    const buffs = ['増幅された','強化された','加速した','高まった','力を増した','クリアになった','増幅された','固くなった','尖らせた'];
    const debuffs = ['静まった','薄まった','弱まった','減速した','減少した','砕けた','ぼやけた','制限された','緩んだ','鈍らせた','侵食された'];

    while (loopCond === 'max' || chestCount < maxCount){
      const startTime = Date.now();
      let stat = 'initial';
      try {
        const response = await fetch('https://donguri.5ch.net/openbattlechest', {
          method: 'POST',
          headers:{
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        try {
          if (!response.ok) {
            throw new Error('Failed to open chest');
          }
          const res = await response.text();
          if (res.includes('Left No room in inventory')){
            throw new Error('Left No room in Inventory');
          }
          if (res.includes('どんぐりが見つかりませんでした。')){
            throw new Error('どんぐりが見つかりませんでした。');
          }
          if (res.includes('too fast')){
            count.textContent = chestCount + ', Please wait...';
            await new Promise(r => setTimeout(r, 10000));
            continue;
          }
          if (res.includes('Left Not enough battle tokens')){
            throw new Error('Left Not enough battle tokens');
          }
          if (res.includes('Left Wrong chest')){
            throw new Error('宝箱がありません。*要不具合報告');
          }
          const parser = new DOMParser();
          const doc = parser.parseFromString(res, 'text/html');

          const h1 = doc.querySelector('h1');

          if (!h1.textContent.includes('アイテムバッグ')) {
            throw new Error('不明なエラー1');
          }

          if(h1.textContent.includes('アイテムバッグ')){
            const necklaceTable = doc.querySelector('#necklaceTable');
            const lastItem = necklaceTable.rows.item(necklaceTable.rows.length - 1);
            const itemName = lastItem.firstChild.textContent;

            const itemRank = itemName.match(/\[(\w+)\d\]/)[1];

// PtまたはAuの場合、無条件でロック処理を実行
        if (itemRank === 'Pt' || itemRank === 'Au') {
              try {
                  const lockLink = lastItem.querySelectorAll('a')[1];
                  if (lockLink && lockLink.href.includes('/lock/')) {
                      await fetch(lockLink.href);
                      await new Promise(resolve => setTimeout(resolve, 200));
                  }
              } catch (error) {
                  count.textContent = chestCount + ', ロック失敗: ' + error.message;
              }
          }
            if(itemRank === 'Pt' || itemRank === 'Au' || itemRank === 'Ag'){
              const p = document.createElement('p');
              p.textContent = itemName;
              if(itemRank === 'Pt') p.style.background = '#f45d01';
              if(itemRank === 'Au') p.style.background = '#a633d6';
              if(itemRank === 'Ag') p.style.background = '#2175d9';
              p.style.color = '#fff';
              p.style.margin = '1px';
              epic.prepend(p);
            }


            if(!shouldNotRecycle.checked){
              const itemEffectsLi = lastItem.cells[3].querySelectorAll('li');
              const itemEffects = [...itemEffectsLi].map(elm => {
                const v = elm.textContent;
                const match = v.match(/^(.+): (\d+)% (.+)$/);
                const [, type, value, effect] = match;
                return [type, effect, value];
              });

              const buffCount = itemEffects.filter(effects => buffs.includes(effects[1])).length;
              const debuffCount = itemEffects.filter(effects => debuffs.includes(effects[1])).length;
              // 分解
              if (itemRank !== 'Pt' && itemRank !== 'Au' && (buffCount < minBuffs[itemRank] || debuffCount > maxDebuffs[itemRank])) {
                console.log(itemEffects);
                try {
                  const recycleLink = lastItem.querySelectorAll('a')[3];
                  const response = await fetch(recycleLink.href);
                  if (!response.ok) {
                    throw new Error('Fail to recycle an item');
                  }
                } catch (error) {
                  forceStop(error);
                  break;
                }
              }
              chestCount++;
              count.textContent = chestCount;
              if (loopCond === 'num') loopNum.value = maxCount - chestCount;
              stat = 'success';
            }
          }

          if(stat !== 'success') {
            throw new Error('不明なエラー2');
          }
        } catch (error) {
          forceStop(error);
          break;
        }

        if(pausePressed) {
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
  })

  function saveInputData(){
    const checkedRanks = Array.from(document.querySelectorAll('.keep-item:checked')).map(elm => elm.value);
    const itemInputs = document.querySelectorAll('.wishlist');
    const itemFilters = {};
      itemInputs.forEach(input => {
       const rank = input.dataset.rank;
        if (!itemFilters[rank]) {
          itemFilters[rank] = [];
        }
       itemFilters[rank].push(input.value);
      });
    const minBuffs = {};
    document.querySelectorAll('.min-buffs').forEach(elm => {
      const rank = elm.dataset.rank;
      minBuffs[rank] = Number(elm.value);
    });

    const maxDebuffs = {};
    document.querySelectorAll('.max-debuffs').forEach(elm => {
      const rank = elm.dataset.rank;
      maxDebuffs[rank] = Number(elm.value);
    });

    const data = {
      ranks: checkedRanks,
      itemFilters: itemFilters,
      shouldNotRecycle: shouldNotRecycle.checked,
      minBuffs: minBuffs,
      maxDebuffs: maxDebuffs
    }
    localStorage.setItem('chestOpener', JSON.stringify(data));
  }
function loadInputData() {
  if (localStorage.hasOwnProperty('chestOpener')) {
    const data = JSON.parse(localStorage.getItem('chestOpener'));

    // 「ロック・分解しないモード」のチェックを反映
    if (data.shouldNotRecycle) shouldNotRecycle.checked = true;

    // 「残すアイテム」のチェックを反映
    data.ranks.forEach(rank => {
      document.querySelector('.keep-item[value="' + rank + '"]').checked = true;
    });

    // 「アイテムフィルタ」の値を設定
    for (const [key, value] of Object.entries(data.itemFilters)) {
      const elements = document.querySelectorAll('.wishlist[data-rank="' + key + '"]');
      elements.forEach((element) => {
        element.value = value; // 一致するすべての要素に値を設定
      });
    }

    // 「最小バフ数」の値を設定
    for (const [key, value] of Object.entries(data.minBuffs)) {
      const elements = document.querySelectorAll('.min-buffs[data-rank="' + key + '"]');
      elements.forEach((element) => {
        element.value = value; // 最小バフ数に対応するすべての要素に値を設定
      });
    }

    // 「最大デバフ数」の値を設定
    for (const [key, value] of Object.entries(data.maxDebuffs)) {
      const elements = document.querySelectorAll('.max-debuffs[data-rank="' + key + '"]');
      elements.forEach((element) => {
        element.value = value; // 最大デバフ数に対応するすべての要素に値を設定
      });
    }
  }
}
})();
