// ==UserScript==
// @name         Donguri Arena Assist Tool Rev
// @version      1.0.2.1
// @description  A revised (unofficial) version of "donguri Arena Assist Tool".
// @author       Original: 7234e634 / Rev: other volunteer players from the Donguri community
// @license      All rights to this script belong to the original author, 7234e634.
// @match        https://donguri.5ch.net/teambattle?m=*
// @match        https://donguri.5ch.net/bag
// @run-at       document-end
// @grant        none
// ==/UserScript==

(()=>{
  if (location.origin === 'https://donguri.5ch.net' && location.pathname === '/bag') {
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

  // teambattle は @match で広く拾うため、ここで対象ページ（m=hc/l/rb）だけに限定する
  const __params = new URLSearchParams(location.search);
  const __battleMode = __params.get('m');
  const __ALLOWED_BATTLE_MODES = new Set(['hc','l','rb']);
  if (location.origin !== 'https://donguri.5ch.net' || location.pathname !== '/teambattle' || !__ALLOWED_BATTLE_MODES.has(__battleMode)) {
    return;
  }

  // ──────────────────────────────────────────────────────────
  // モード表示（ページタイトル「どんぐりチーム戦い」の直下に表示）
  //  */teambattle?m=hc → ハードコア モード
  //  */teambattle?m=l  → ラダー モード
  //  */teambattle?m=rb → レッド vs ブルー モード
  // ──────────────────────────────────────────────────────────
  const __AAT_MODE_LABEL_TEXT = {
    'hc': '【 ハードコア モード 】',
    'l':  '【 ラダー モード 】',
    'rb': '【 レッド vs ブルー モード 】',
  };

  function aatInsertBattleModeLabel(){
    const text = __AAT_MODE_LABEL_TEXT[__battleMode];
    if (!text) return;

    // 基本は header 内 h1（「どんぐりチーム戦い」）の直下
    const h1 = Array.from(document.querySelectorAll('header h1, h1'))
      .find(h => (h.textContent || '').trim() === 'どんぐりチーム戦い')
      || document.querySelector('header h1')
      || document.querySelector('h1');
    if (!h1) return;

    let el = document.getElementById('aat-battle-mode-label');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aat-battle-mode-label';
      Object.assign(el.style, {
        fontSize: '1.2em',
        margin: '2px 0 6px',
      });
      h1.insertAdjacentElement('afterend', el);
    }
    el.textContent = text;
  }

  // DOM 構築タイミング差対策：1フレーム遅延で挿入
  requestAnimationFrame(() => { try { aatInsertBattleModeLabel(); } catch(_){} });


  // 現在の m を保持した teambattle URL を生成（row/col を付ける場合も必ず m を維持）
  function buildTeambattleUrl(row, col){
    const u = new URL(location.href);
    u.pathname = '/teambattle';
    u.search = '';
    if (__battleMode) u.searchParams.set('m', __battleMode);
    if (row !== undefined && row !== null) u.searchParams.set('r', String(row));
    if (col !== undefined && col !== null) u.searchParams.set('c', String(col));
    return u.toString();
  }

  // POST 送信でも m を保持（サーバが無視してもOK、必要な場合に効く）
  function buildBattleBody(row, col, extra){
    let body = `row=${encodeURIComponent(String(row))}&col=${encodeURIComponent(String(col))}`;
    if (__battleMode) body += `&m=${encodeURIComponent(__battleMode)}`;
    if (extra) body += `&${extra}`;
    return body;
  }

  const vw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
  const vh = Math.min(document.documentElement.clientHeight, window.innerHeight || 0);

  const settings = JSON.parse(localStorage.getItem('aat_settings')) || {};

  // ──────────────────────────────────────────────────────────
  // Long-press progress ring (release-to-trigger)
  //  - pointerdown で青リング進捗開始
  //  - 所定時間到達で青→緑（長押し完了）
  //  - 押している間は緑リング維持
  //  - pointerup（放した瞬間）に緑リングを消して長押し機能を起動
  // ──────────────────────────────────────────────────────────
  const AAT_LONGPRESS_MENU_MS = 1200;             // メニュー（戦況更新/装備ロスター）長押し完了までの時間（ミリ秒）
  const AAT_LONGPRESS_CELL_MS = 400;            // マップのエリアマス長押し完了までの時間（ミリ秒）
  const AAT_RING_PROGRESS_COLOR = '#4466ff';     // 進捗（青）
  const AAT_RING_COMPLETE_COLOR = '#22aa44';     // 完了（緑）
  const AAT_RING_BG_COLOR = 'rgba(0,0,0,0.22)';  // 背景リング（薄い）

  function aatCreatePressProgressRing(target, opt = {}){
    const size = opt.size ?? 22;    // px
    const stroke = opt.stroke ?? 3; // px
    const right = opt.right ?? 4;   // px
    const top = opt.top ?? 4;       // px

    // 重ね置きのため relative 化（必要時）
    try{
      const cs = getComputedStyle(target);
      if (cs.position === 'static' && !target.style.position) target.style.position = 'relative';
    }catch(_){
      if (!target.style.position) target.style.position = 'relative';
    }

    const wrap = document.createElement('span');
    wrap.className = 'aat-press-ring';
    Object.assign(wrap.style, {
      position: 'absolute',
      right: right + 'px',
      top: top + 'px',
      width: size + 'px',
      height: size + 'px',
      pointerEvents: 'none',
      zIndex: '5',
      opacity: '0.95',
    });

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    Object.assign(svg.style, { display:'block' });

    const r = 42;
    const cx = 50, cy = 50;
    const c = 2 * Math.PI * r;

    const bg = document.createElementNS(svgNS, 'circle');
    bg.setAttribute('cx', String(cx));
    bg.setAttribute('cy', String(cy));
    bg.setAttribute('r', String(r));
    bg.setAttribute('fill', 'none');
    bg.setAttribute('stroke', AAT_RING_BG_COLOR);
    bg.setAttribute('stroke-width', String(stroke * (100/size)));
    bg.setAttribute('stroke-linecap', 'butt');

    const fg = document.createElementNS(svgNS, 'circle');
    fg.setAttribute('cx', String(cx));
    fg.setAttribute('cy', String(cy));
    fg.setAttribute('r', String(r));
    fg.setAttribute('fill', 'none');
    fg.setAttribute('stroke', AAT_RING_PROGRESS_COLOR);
    fg.setAttribute('stroke-width', String(stroke * (100/size)));
    fg.setAttribute('stroke-linecap', 'round');
    fg.setAttribute('stroke-dasharray', String(c));
    fg.setAttribute('stroke-dashoffset', String(c)); // 0%
    fg.setAttribute('transform', 'rotate(-90 50 50)'); // 12時開始

    svg.appendChild(bg);
    svg.appendChild(fg);
    wrap.appendChild(svg);
    target.appendChild(wrap);

    function setProgress(p){
      const t = Math.max(0, Math.min(1, p));
      fg.setAttribute('stroke-dashoffset', String(c * (1 - t)));
    }
    function setCompleted(){
      // リング全体を緑へ（押している間は維持）
      bg.setAttribute('stroke', AAT_RING_COMPLETE_COLOR);
      fg.setAttribute('stroke', AAT_RING_COMPLETE_COLOR);
      setProgress(1);
    }
    function remove(){
      try { wrap.remove(); } catch(_) {}
    }
    return { setProgress, setCompleted, remove, el: wrap };
  }

  // 長押し：完了（青→緑）までは「判定中」
  // 完了後は「押している間は緑維持」し、放した瞬間に onLongRelease を起動
  function aatAttachLongPressWithProgressRelease(el, {
    onShort,
    onLongRelease,
    delay = AAT_LONGPRESS_MENU_MS,
    moveTolerance = 10,
    ring = { size: 22, stroke: 3, right: 4, top: 4 },
  } = {}){
    let timer = null;
    let rafId = 0;
    let ringCtl = null;
    let pressed = false;
    let longReady = false; // delay 経過（青→緑）したか
    let sx = 0, sy = 0;
    let startAt = 0;

    function clearTimer(){
      if (timer) { clearTimeout(timer); timer = null; }
    }
    function stopAnim(){
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    }
    function removeRing(){
      if (ringCtl) { try { ringCtl.remove(); } catch(_){} ringCtl = null; }
    }
    function cleanupAll(){
      clearTimer();
      stopAnim();
      removeRing();
    }

    function tick(now){
      if (!pressed || longReady || !ringCtl) return;
      const p = (now - startAt) / delay;
      ringCtl.setProgress(p);
      if (p < 1) rafId = requestAnimationFrame(tick);
    }

    el.addEventListener('pointerdown', (e) => {
      // 左クリック/タップ以外は無視
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pressed = true;
      longReady = false;
      sx = e.clientX; sy = e.clientY;

      // 既存リングがあれば掃除してから開始
      cleanupAll();

      // リング表示＆進捗開始（押した瞬間）
      ringCtl = aatCreatePressProgressRing(el, ring);
      ringCtl.setProgress(0);
      startAt = performance.now();
      rafId = requestAnimationFrame(tick);

      // 2秒経過で青→緑（ここで長押し完了。ただし実行は放した瞬間）
      timer = setTimeout(() => {
        if (!pressed || !ringCtl) return;
        longReady = true;
        stopAnim();
        ringCtl.setCompleted(); // 緑にして維持
      }, delay);

      try { el.setPointerCapture(e.pointerId); } catch(_) {}
    }, { passive: true });

    el.addEventListener('pointermove', (e) => {
      if (!pressed || !timer) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.hypot(dx, dy) > moveTolerance) {
        // 指が大きく動いたらキャンセル
        pressed = false;
        longReady = false;
        cleanupAll();
      }
    }, { passive: true });

    el.addEventListener('pointerup', (e) => {
      if (!pressed) return;
      pressed = false;

      // 放した瞬間にリングを消す（緑もここで消える）
      const wasLong = longReady;
      cleanupAll();

      if (wasLong) {
        try { onLongRelease?.(e); } catch(_) {}
      } else {
        try { onShort?.(e); } catch(_) {}
      }
      longReady = false;
    }, { passive: true });

    el.addEventListener('pointercancel', () => {
      pressed = false;
      longReady = false;
      cleanupAll();
    }, { passive: true });

    // モバイル等の長押しコンテキストメニュー抑止（必要なら）
    el.addEventListener('contextmenu', (e) => {
      if (pressed) e.preventDefault();
    });
  }

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
  header.querySelector('h4').style.display = 'none';
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
  let shouldSkipAreaInfo, shouldSkipAutoEquip, shouldBattleCondOnly,
    currentPeriod, currentProgress;
  let currentEquipName = '';

  // ──────────────────────────────────────────────────────────
  //  装備ロスター（複数）管理
  //  - ロスターは個別保存（プリセット + オート装備変更を1対1で紐付け）
  //  - 現在ロード中のロスターは、互換のため従来キー（equipPresets / autoEquipItems）へも展開する
  //  - 旧版（単一ロスター）からは初回起動時に自動移行
  // ──────────────────────────────────────────────────────────
  const AAT_EQUIP_ROSTERS_KEY = 'aat_equip_rosters';                 // Array<{id,name,presets,autoEquipItems,savedAt:number}>
  const AAT_CURRENT_ROSTER_ID_KEY = 'aat_current_equip_roster_id';   // string
  const AAT_EQUIP_ROSTER_NAME_KEY = 'equipRosterName';              // 互換用（現行ロスター名のミラー）

  function aatPad2(n){ return String(n).padStart(2,'0'); }
  function aatMakeDefaultEquipRosterName(date = new Date()){
    const mm = aatPad2(date.getMonth() + 1);
    const dd = aatPad2(date.getDate());
    const hh = aatPad2(date.getHours());
    const mi = aatPad2(date.getMinutes());
    return `装備ロスター_${mm}${dd}${hh}${mi}`;
  }

  function aatSafeJsonParse(text, fallback){
    try{
      if(text == null) return fallback;
      return JSON.parse(text);
    }catch(_){
      return fallback;
    }
  }

  function aatGetAllRosters(){
    const raw = localStorage.getItem(AAT_EQUIP_ROSTERS_KEY);
    const v = aatSafeJsonParse(raw, null);
    if(Array.isArray(v)) return v;
    return [];
  }
  function aatSetAllRosters(list){
    localStorage.setItem(AAT_EQUIP_ROSTERS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  }
  function aatGetCurrentRosterId(){
    return String(localStorage.getItem(AAT_CURRENT_ROSTER_ID_KEY) || '');
  }
  function aatSetCurrentRosterId(id){
    if(!id) localStorage.removeItem(AAT_CURRENT_ROSTER_ID_KEY);
    else localStorage.setItem(AAT_CURRENT_ROSTER_ID_KEY, String(id));
  }

  function aatFindRosterById(list, id){
    if(!id) return null;
    return (list || []).find(r => r && String(r.id) === String(id)) || null;
  }

  function aatMakeRosterId(){
    // yyyyMMddHHmmss + 乱数
    const d = new Date();
    const y = String(d.getFullYear());
    const mo = aatPad2(d.getMonth()+1);
    const da = aatPad2(d.getDate());
    const hh = aatPad2(d.getHours());
    const mi = aatPad2(d.getMinutes());
    const ss = aatPad2(d.getSeconds());
    const rnd = Math.random().toString(16).slice(2,8);
    return `r_${y}${mo}${da}${hh}${mi}${ss}_${rnd}`;
  }

  function aatMirrorRosterNameToCompatKey(name){
    try{
      const v = (name == null) ? '' : String(name).trim();
      if(!v) localStorage.removeItem(AAT_EQUIP_ROSTER_NAME_KEY);
      else localStorage.setItem(AAT_EQUIP_ROSTER_NAME_KEY, v);
    }catch(_){}
  }

  function aatEnsureRostersInitialized(){
    let rosters = aatGetAllRosters();
    let curId = aatGetCurrentRosterId();
    let cur = aatFindRosterById(rosters, curId);

    if(rosters.length === 0 || !cur){
      // 旧データ（単一ロスター）を初期ロスターへ移行
      const oldPresets = aatSafeJsonParse(localStorage.getItem('equipPresets'), {}) || {};
      const oldAuto = aatSafeJsonParse(localStorage.getItem('autoEquipItems'), {}) || {};
      const oldName = String(localStorage.getItem(AAT_EQUIP_ROSTER_NAME_KEY) || '').trim();

      const id = aatMakeRosterId();
      const name = oldName || aatMakeDefaultEquipRosterName();
      rosters = [{
        id,
        name,
        presets: oldPresets,
        autoEquipItems: oldAuto,
        savedAt: Date.now(),
      }];
      curId = id;
      aatSetAllRosters(rosters);
      aatSetCurrentRosterId(curId);

      // 現行ロスター名を互換キーへミラー
      aatMirrorRosterNameToCompatKey(name);

      // 互換キー（equipPresets/autoEquipItems）は既に存在している想定だが、
      // 念のため整合させる
      localStorage.setItem('equipPresets', JSON.stringify(oldPresets));
      localStorage.setItem('autoEquipItems', JSON.stringify(oldAuto));
      return { rosters, current: rosters[0] };
    }

    // 互換キーへミラー（未設定なら埋める）
    let __dirty = false;
    if(!cur.name || !String(cur.name).trim()){
      cur.name = aatMakeDefaultEquipRosterName();
      __dirty = true;
    }
    if(typeof cur.savedAt !== 'number' || !isFinite(cur.savedAt)){
      cur.savedAt = Date.now();
      __dirty = true;
    }
    if(__dirty){
      aatSetAllRosters(rosters);
    }
    aatMirrorRosterNameToCompatKey(cur.name);
    return { rosters, current: cur };
  }

  function aatGetCurrentRoster(){
    const { rosters, current } = aatEnsureRostersInitialized();
    return current || (rosters[0] || null);
  }

  function aatSaveCurrentRosterFromLocalStorage(){
    const { rosters, current } = aatEnsureRostersInitialized();
    if(!current) return;

    const presets = aatSafeJsonParse(localStorage.getItem('equipPresets'), {}) || {};
    const autoEquipItems = aatSafeJsonParse(localStorage.getItem('autoEquipItems'), {}) || {};

    // 現行ロスターへ反映
    current.presets = presets;
    current.autoEquipItems = autoEquipItems;
    current.savedAt = Date.now();

    // 保存
    aatSetAllRosters(rosters);
  }

  function aatLoadRosterToLocalStorage(roster){
    const r = roster || null;
    if(!r) return;
    const presets = (r.presets && typeof r.presets === 'object') ? r.presets : {};
    const autoEquipItems = (r.autoEquipItems && typeof r.autoEquipItems === 'object') ? r.autoEquipItems : {};
    localStorage.setItem('equipPresets', JSON.stringify(presets));
    localStorage.setItem('autoEquipItems', JSON.stringify(autoEquipItems));
    aatMirrorRosterNameToCompatKey(r.name || '');
  }

  function aatSetEquipRosterName(name){
    const v = (name == null) ? '' : String(name).trim();
    const { rosters, current } = aatEnsureRostersInitialized();
    if(!current) return;
    if(!v){
      // 空は「未設定」に戻す（次回 ensure で自動命名）
      current.name = '';
    }else{
      current.name = v;
    }
    aatSetAllRosters(rosters);
    aatMirrorRosterNameToCompatKey(current.name || '');
  }

  function aatGetEquipRosterName(){
    const cur = aatGetCurrentRoster();
    return cur ? String(cur.name || '') : '';
  }

  function aatEnsureEquipRosterName(){
    let name = aatGetEquipRosterName();
    if(!name){
      name = aatMakeDefaultEquipRosterName();
      aatSetEquipRosterName(name);
    }
    return name;
  }

  function aatListRostersMeta(){
    const { rosters, current } = aatEnsureRostersInitialized();
    const curId = current ? String(current.id) : '';
    return (rosters || []).map(r => ({
      id: String(r.id || ''),
      name: String(r.name || ''),
      isCurrent: String(r.id || '') === curId,
    }));
  }

  function aatSwitchRosterById(id){
    // まず現在ロスターを保存してから切替
    aatSaveCurrentRosterFromLocalStorage();

    const rosters = aatGetAllRosters();
    const next = aatFindRosterById(rosters, id);
    if(!next) return false;
    aatSetCurrentRosterId(String(next.id));
    aatLoadRosterToLocalStorage(next);
    return true;
  }

  function aatCreateNewRosterAndSwitch(){
    aatSaveCurrentRosterFromLocalStorage();
    const rosters = aatGetAllRosters();
    const id = aatMakeRosterId();
    const name = aatMakeDefaultEquipRosterName();
    const roster = { id, name, presets: {}, autoEquipItems: {}, savedAt: Date.now() };
    rosters.push(roster);
    aatSetAllRosters(rosters);
    aatSetCurrentRosterId(String(id));
    aatLoadRosterToLocalStorage(roster);
    return roster;
  }

  function aatParseRosterIdToMs(id){
    const m = String(id || '').match(/^r_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_/);
    if(!m) return 0;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const da = Number(m[3]);
    const hh = Number(m[4]);
    const mi = Number(m[5]);
    const ss = Number(m[6]);
    const d = new Date(y, mo, da, hh, mi, ss);
    const t = d.getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function aatGetRosterSavedAtMs(r){
    if(!r) return 0;
    const v = r.savedAt;
    if(typeof v === 'number' && Number.isFinite(v)) return v;
    return aatParseRosterIdToMs(r.id);
  }

  function aatPickMostRecentRoster(list){
    const rosters = Array.isArray(list) ? list : [];
    let best = null;
    let bestT = -1;
    for(const r of rosters){
      const t = aatGetRosterSavedAtMs(r);
      if(t > bestT){ bestT = t; best = r; }
    }
    return best || (rosters[rosters.length - 1] || null);
  }

  // 現在ロスターを削除し、残っていれば「直近に保存した」ロスターをロード。
  // 1つも残らなければ新規ロスターを作成してロード。
  function aatDeleteCurrentRosterAndLoadLatestOrNew(){
    aatSaveCurrentRosterFromLocalStorage();
    const { rosters, current } = aatEnsureRostersInitialized();
    const curId = current ? String(current.id) : aatGetCurrentRosterId();

    const nextList = (rosters || []).filter(r => r && String(r.id) !== curId);
    aatSetAllRosters(nextList);

    if(nextList.length > 0){
      const next = aatPickMostRecentRoster(nextList);
      aatSetCurrentRosterId(String(next.id));
      aatLoadRosterToLocalStorage(next);
      return { deletedId: curId, loadedId: String(next.id), created: false };
    }

    // すべて消えた場合は新規作成
    const id = aatMakeRosterId();
    const name = aatMakeDefaultEquipRosterName();
    const roster = { id, name, presets: {}, autoEquipItems: {}, savedAt: Date.now() };
    aatSetAllRosters([roster]);
    aatSetCurrentRosterId(String(id));
    aatLoadRosterToLocalStorage(roster);
    return { deletedId: curId, loadedId: String(id), created: true };
  }

  (()=>{
    const button = document.createElement('button');
    button.type = 'button';
    button.style.flexShrink = '1';
    button.style.flexGrow = '0';
    button.style.whiteSpace = 'nowrap';
    button.style.overflow = 'hidden';
    button.style.boxSizing = 'border-box';
    button.style.width = '5.5em';
    button.style.border = 'none';
    button.style.padding = '2px 1px';
    button.style.fontSize = '64%';
    button.style.lineHeight = '1.25em';

    if (vw < 768) {
      progressBarContainer.style.fontSize = '60%';
    }

    // 1段目へ「設定」ボタンを移設（左端）
    const settingsButton = button.cloneNode();
    settingsButton.textContent = '設定';
    settingsButton.style.background = '#ffb300';
    settingsButton.style.color = '#000';
    settingsButton.addEventListener('click', ()=>{
      settingsDialog.show();
    });

    // 1段目へ「オート装備変更」ボタンを移設（設定の右隣）
    const skipAutoEquipButton = button.cloneNode();
    skipAutoEquipButton.innerText = 'オート\n装備変更';
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

    const toggleViewButton = button.cloneNode();
    toggleViewButton.innerText = 'バトル条件\nのみ表示';
    toggleViewButton.style.color = '#fff';
    if (settings.battleCondOnly) {
      toggleViewButton.style.background = '#46f';
      shouldBattleCondOnly = true;
    } else {
      toggleViewButton.style.background = '#888';
      shouldBattleCondOnly = false;
    }
    toggleViewButton.addEventListener('click', ()=>{
      toggleCellViewMode();
      shouldBattleCondOnly = (currentViewMode === 'compact');
      toggleViewButton.style.background = shouldBattleCondOnly ? '#46f' : '#888';
      settings.battleCondOnly = shouldBattleCondOnly;
      localStorage.setItem('aat_settings', JSON.stringify(settings));
    })

    
    const refreshButton = button.cloneNode();
    refreshButton.innerText = '戦況更新\nフラッシュ\n(リロード)';
    // 「戦況更新全リロード」機能を「戦況更新フラッシュ（リロード）」ボタン長押しへ割り当て
    //  - 短押し: フラッシュ（refreshAll=false）
    //  - 長押し完了→放す: 全リロード（refreshAll=true）
    aatAttachLongPressWithProgressRelease(refreshButton, {
      delay: AAT_LONGPRESS_MENU_MS,
      onShort: () => {
        fetchAreaInfo(false);
      },
      onLongRelease: () => {
        fetchAreaInfo(true);
      },
      ring: { size: 22, stroke: 3, right: 4, top: 4 },
    });

    const skipAreaInfoButton = button.cloneNode();
    skipAreaInfoButton.innerText = 'ラピッド\n攻撃';
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

    const equipButton = button.cloneNode();
    equipButton.innerText = '装備\nロスター\n(切り替え)';
    // ──────────────────────────────────────────────────────────
    //  装備ロスター：長押しサブメニュー
    //   - 短押し: 従来どおり装備ロスターウィンドウ開閉
    //   - 長押し完了→放す: 右隣にサブメニュー展開（上辺は表示領域上辺に接する）
    // ──────────────────────────────────────────────────────────
    const rosterSubMenu = document.createElement('div');
    rosterSubMenu.dataset.aatRosterSubmenu = '1';
    rosterSubMenu.style.position = 'fixed';
    rosterSubMenu.style.top = '0';
    rosterSubMenu.style.left = '0';
    rosterSubMenu.style.display = 'none';
    rosterSubMenu.style.background = '#fff';
    rosterSubMenu.style.color = '#000';
    rosterSubMenu.style.border = '1px solid #000';
    rosterSubMenu.style.zIndex = '3';
    rosterSubMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.25)';
    rosterSubMenu.style.padding = '2px';
    rosterSubMenu.style.margin = '0';
    rosterSubMenu.style.maxHeight = '100vh';
    rosterSubMenu.style.overflow = 'auto'; // 表示領域に収まらない場合はスクロール
    rosterSubMenu.style.minWidth = '14em';
    rosterSubMenu.style.maxWidth = 'min(90vw, 520px)';

    function aatCloseRosterSubMenu(){
      rosterSubMenu.style.display = 'none';
      try { rosterSubMenu.replaceChildren(); } catch(_) {}
    }

    function aatOpenRosterSubMenu(){
      // ロスター一覧を最新化
      const metas = aatListRostersMeta();

      // 位置：ボタン右隣 / 上辺は表示領域上辺に接する
      const rect = equipButton.getBoundingClientRect();
      let left = Math.round(rect.right + 2);
      const top = 0;

      // いったん内容を組む（幅が決まるので、後でオーバーフロー調整）
      rosterSubMenu.replaceChildren();

      const itemBtnBase = document.createElement('button');
      itemBtnBase.type = 'button';
      Object.assign(itemBtnBase.style, {
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '8px 10px',
        border: 'none',
        background: 'none',
        color: '#000',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        lineHeight: '1.2',
        fontSize: '13px',
      });

      function makeMenuItem(label, { onClick, isCurrent } = {}){
        const b = itemBtnBase.cloneNode();
        b.textContent = (isCurrent ? '✅ ' : '') + String(label);
        if(isCurrent){
          b.style.background = '#e8f0ff';
          b.style.fontWeight = 'bold';
        }
        b.addEventListener('mouseenter', ()=>{ b.style.background = isCurrent ? '#dbe8ff' : '#f3f3f3'; });
        b.addEventListener('mouseleave', ()=>{ b.style.background = isCurrent ? '#e8f0ff' : 'none'; });
        b.addEventListener('click', (e)=>{
          e.preventDefault();
          e.stopPropagation();
          try { onClick?.(); } catch(_) {}
        });
        return b;
      }

      // 先頭：「新規ロスター作成」
      rosterSubMenu.append(
        makeMenuItem('新規ロスター作成', {
          onClick: ()=>{
            aatCloseRosterSubMenu();
            aatCreateNewRosterAndSwitch();
            // UI反映
            currentEquipName = '';
            if (typeof panel.__aatRefreshRoster === 'function') panel.__aatRefreshRoster();
            // そのまま装備ロスターウィンドウ展開（短押し時と同様）
            panel.style.display = 'flex';
            if (typeof panel.__aatOnOpen === 'function') panel.__aatOnOpen();
          }
        })
      );

      // セパレーター（必ず存在）
      const hr = document.createElement('div');
      hr.style.height = '1px';
      hr.style.background = '#000';
      hr.style.opacity = '0.25';
      hr.style.margin = '2px 0';
      rosterSubMenu.append(hr);

      // ロスター一覧（ロスター(1) は必ず存在、以降はユーザーが追加した場合）
      metas.forEach(m => {
        const label = (m.name && m.name.trim()) ? m.name.trim() : '(名称未設定)';
        rosterSubMenu.append(
          makeMenuItem(label, {
            isCurrent: !!m.isCurrent,
            onClick: ()=>{
              aatCloseRosterSubMenu();
              const ok = aatSwitchRosterById(m.id);
              if(!ok) return;
              currentEquipName = '';
              if (typeof panel.__aatRefreshRoster === 'function') panel.__aatRefreshRoster();
            }
          })
        );
      });

      // DOMへ出してから表示
      if(!rosterSubMenu.isConnected) document.body.append(rosterSubMenu);
      rosterSubMenu.style.top = top + 'px';
      rosterSubMenu.style.left = left + 'px';
      rosterSubMenu.style.display = 'block';

      // 右側へはみ出す場合は左に寄せる
      const mw = rosterSubMenu.offsetWidth || 0;
      const maxLeft = (window.innerWidth || vw || 0) - mw - 2;
      if(Number.isFinite(maxLeft) && left > maxLeft){
        left = Math.max(2, maxLeft);
        rosterSubMenu.style.left = left + 'px';
      }
    }

    // 長押し：短押しでウィンドウ開閉／長押しでサブメニュー
    aatAttachLongPressWithProgressRelease(equipButton, {
      delay: AAT_LONGPRESS_MENU_MS,
      onShort: () => {
        // 切り替え（表示/非表示）
        if (panel.style.display === 'none' || panel.style.display === '') {
          panel.style.display = 'flex';
          if (typeof panel.__aatOnOpen === 'function') panel.__aatOnOpen();
        } else {
          panel.style.display = 'none';
        }
      },
      onLongRelease: () => {
        // サブメニュー展開（右隣）
        if(rosterSubMenu.style.display === 'block'){
          aatCloseRosterSubMenu();
        }else{
          aatOpenRosterSubMenu();
        }
      },
      ring: { size: 22, stroke: 3, right: 4, top: 4 },
    });

    const main = document.createElement('div');
    main.style.display = 'flex';
    main.style.flexWrap = 'nowrap';
    main.style.gap = '2px';
    main.style.justifyContent = 'center';
    // 1段目：左から
    //   設定 / オート装備変更 / ラピッド攻撃 / バトル条件のみ表示 / 戦況更新フラッシュ / 装備ロスター
    // ※指定の3ボタンの並び：バトル条件のみ表示 → 戦況更新フラッシュ（リロード） → 装備ロスター（切り替え）
    main.append(settingsButton, skipAutoEquipButton, skipAreaInfoButton, toggleViewButton, refreshButton, equipButton);

    // 「サブメニュー展開▼」ボタン＆サブメニューは撤去
    toolbar.append(main);
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

  // ──────────────────────────────────────────────────────────
  //  マップ更新プログレスバー描画（v0.0.1.1 相当を復旧）
  //  - currentPeriod / currentProgress を更新
  //  - wood / steel もホームから取得して同期（改造等で使用）
  //  ※自動参加モードは削除済みのため、ここは単独で動かす
  // ──────────────────────────────────────────────────────────
  async function drawProgressBar(){
    try {
      const res = await fetch('https://donguri.5ch.net/', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      // まずは従来セレクタで取得（構造変化に備えてフォールバックあり）
      let period = null;
      let progress = null;

      const container =
        doc.querySelector('div.stat-block:nth-child(2)>div:nth-child(5)') ||
        doc.querySelector('.stat-block:nth-of-type(2) > div:nth-child(5)') ||
        doc.querySelector('.stat-block:nth-of-type(2) div:nth-child(5)');

      if (container) {
        const p1 = (container.firstChild && container.firstChild.textContent)
          ? container.firstChild.textContent
          : container.textContent;
        const p2 = (container.lastElementChild && container.lastElementChild.textContent)
          ? container.lastElementChild.textContent
          : container.textContent;
        const mPeriod = String(p1).match(/\d+/);
        const mProg = String(p2).match(/\d+/);
        period = mPeriod ? Number(mPeriod[0]) : null;
        progress = mProg ? parseInt(mProg[0], 10) : null;
      }

      if (!Number.isFinite(period) || !Number.isFinite(progress)) {
        // フォールバック：stat-block 内の「◯期」「◯%」を含む行から推定
        const candidates = [...doc.querySelectorAll('.stat-block div')]
          .map(el => el.textContent || '')
          .filter(t => /\d+\s*期/.test(t) && /\d+\s*%/.test(t));

        for (const t of candidates) {
          const m1 = t.match(/(\d+)\s*期/);
          const m2 = t.match(/(\d+)\s*%/);
          if (m1 && m2) {
            period = Number(m1[1]);
            progress = parseInt(m2[1], 10);
            break;
          }
        }
      }

      if (!Number.isFinite(period) || !Number.isFinite(progress)) {
        throw new Error('progress.parse.ng');
      }

      currentPeriod = period;
      currentProgress = progress;

      let str, min, totalSec, sec, margin;

      // ────────────────────────────────────────────────────────
      //  試合時間（マップ更新まで）表示
      //   - hc / l : 1試合 = 1/2期（0 → 50 → 100）
      //   - rb     : 1試合 = 1/6期（0 → 17 → 33 → 50 → 67 → 83 → 100 付近）
      //  ※期≒1時間（1%≒36秒）という前提は従来ロジックを踏襲
      // ────────────────────────────────────────────────────────
      const matchSplit = (__battleMode === 'rb') ? 6 : 2;
      const step = 100 / matchSplit;        // %（小数あり）
      const secPerPercent = 36;             // 1期≒1時間 → 3600sec / 100%
      const endFudgeSec = 10;               // 100%到達後のズレ補正（既存ロジック踏襲）

      // 表示用の境界（整数%）… rb は 16.666..%刻みのため近い整数へ丸める
      const boundaries = Array.from({length: matchSplit + 1}, (_, i) => Math.round(i * step))
        .filter((v, i, arr) => i === 0 || v !== arr[i - 1]);

      const isBoundary = boundaries.includes(currentProgress);

      if (isBoundary && currentProgress !== 100) {
        str = '（マップ更新時）';
      } else {
        if (currentProgress === 100) {
          // 既存挙動：100%表示中は「間もなく更新」扱い（完全一致しないズレ対策）
          min = 0;
          sec = 20;
          margin = 10;
        } else {
          // 次の境界（小数のまま計算して秒精度を上げる）
          const idx = Math.floor(currentProgress / step) + 1;
          const nextBoundary = Math.min(100, idx * step);

          totalSec = Math.max(0, Math.round((nextBoundary - currentProgress) * secPerPercent));
          if (nextBoundary >= 100 - 1e-6) totalSec += endFudgeSec;

          min = Math.trunc(totalSec / 60);
          sec = totalSec % 60;
          margin = 20;
        }
        str = '（マップ更新まで' + min + '分' + sec + '秒 \xb1' + margin + '秒）';
      }

      // ★ここが無いと、プログレスバーが「枠だけ」になって更新されない
      progressBarBody.textContent = currentProgress + '%';
      progressBarBody.style.width = currentProgress + '%';
      progressBarInfo.textContent = `第 ${currentPeriod} 期${str}`;

      // 資源数（wood/steel）も同期（改造等で利用）
      const statBlock = doc.querySelector('.stat-block');
      const woodMatch = (statBlock && statBlock.textContent) ? statBlock.textContent.match(/木材の数:\s*(\d+)/) : null;
      const steelMatch = (statBlock && statBlock.textContent) ? statBlock.textContent.match(/鉄の数:\s*(\d+)/) : null;
      if (woodMatch) wood = Number(woodMatch[1]);
      if (steelMatch) steel = Number(steelMatch[1]);
    } catch (e) {
      console.error(e + ' drawProgressBar()');
    }
  }

  // 初回描画＋定期更新
  drawProgressBar();
  let progressBarIntervalId = setInterval(drawProgressBar, 18000);

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
      await autoEquipAndChallenge(row, col, rank, { anchorX: e.clientX, anchorY: e.clientY });
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
        body: `row=${encodeURIComponent(String(row))}&col=${encodeURIComponent(String(col))}&action=${encodeURIComponent(String(action))}&amt=${encodeURIComponent(String(amt))}${__battleMode ? `&m=${encodeURIComponent(__battleMode)}` : ''}`
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
    if (!arenaResult.contains(event.target)) {
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
    // 装備ロスター：サブメニュー外クリックで閉じる
    const sm = document.querySelector('div[data-aat-roster-submenu="1"]');
    if (sm && !sm.contains(event.target)) { try{ sm.style.display = 'none'; }catch(_){} }
  });
  document.body.append(arenaResult, arenaField, helpDialog);

  const grid = document.querySelector('.grid');
  grid.parentNode.style.height = null;
  grid.style.maxWidth = '100%';

  // ──────────────────────────────────────────────────────────
  // Map cell long-press: force "equip selection" dialog even when
  // the current equipment already matches the cell's rarity condition.
  //
  // - Short press: existing behavior (area info or immediate attack)
  // - Long press (default 1200ms): always open the equip selection dialog
  //   (when "オート装備変更" is enabled and the click would attack)
  //
  // ★ 長押し時間は AAT_LONGPRESS_CELL_MS を調整（微調整しやすいよう定数化）
  // ──────────────────────────────────────────────────────────
  let __aatCellPressInstalled = false;
  function aatInstallCellPressHandlersOnce(){
    if (__aatCellPressInstalled) return;
    __aatCellPressInstalled = true;

    const MOVE_TOL = 10;

    let pressed = false;
    let longReady = false;
    let timer = null;
    let rafId = 0;
    let ringCtl = null;
    let targetCell = null;
    let sx = 0, sy = 0;
    let startAt = 0;
    let pointerId = null;

    function clearTimer(){
      if (timer) { clearTimeout(timer); timer = null; }
    }
    function stopAnim(){
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    }
    function removeRing(){
      if (ringCtl) { try { ringCtl.remove(); } catch(_){} ringCtl = null; }
    }
    function cleanupAll(){
      clearTimer();
      stopAnim();
      removeRing();
      pressed = false;
      longReady = false;
      targetCell = null;
      pointerId = null;
    }

    function tick(now){
      if (!pressed || longReady || !ringCtl) return;
      const p = (now - startAt) / AAT_LONGPRESS_CELL_MS;
      ringCtl.setProgress(p);
      if (p < 1) rafId = requestAnimationFrame(tick);
    }

    grid.addEventListener('pointerdown', (e) => {
      const cell = e.target?.closest?.('.cell');
      if (!cell || !grid.contains(cell)) return;

      // 左クリック/タップ以外は無視
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      // 既存が残っていれば掃除してから開始
      cleanupAll();

      pressed = true;
      longReady = false;
      targetCell = cell;
      pointerId = e.pointerId;
      sx = e.clientX; sy = e.clientY;

      // リング表示＆進捗開始（押した瞬間）
      ringCtl = aatCreatePressProgressRing(cell, { size: 22, stroke: 3, right: 4, top: 4 });
      ringCtl.setProgress(0);
      startAt = performance.now();
      rafId = requestAnimationFrame(tick);

      // AAT_LONGPRESS_CELL_MS 経過で青→緑（ここで長押し完了。ただし実行は放した瞬間）
      timer = setTimeout(() => {
        if (!pressed || !ringCtl) return;
        longReady = true;
        stopAnim();
        ringCtl.setCompleted(); // 緑にして維持
      }, AAT_LONGPRESS_CELL_MS);

      try { cell.setPointerCapture(e.pointerId); } catch(_) {}
    }, { passive: true });

    grid.addEventListener('pointermove', (e) => {
      if (!pressed || e.pointerId !== pointerId) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.hypot(dx, dy) > MOVE_TOL) {
        // 指が大きく動いたらキャンセル
        cleanupAll();
      }
    }, { passive: true });

    grid.addEventListener('pointerup', (e) => {
      if (!pressed || e.pointerId !== pointerId) return;

      const cell = targetCell;
      const wasLong = longReady;

      // 放した瞬間にリングを消す（緑もここで消える）
      clearTimer();
      stopAnim();
      removeRing();
      pressed = false;
      longReady = false;
      targetCell = null;
      pointerId = null;

      if (!cell) return;

      if (wasLong) {
        // 長押し：レアリティ一致でも装備選択ダイアログを必ず出す
        try { handleCellClick(cell, { forceEquipDialog: true, anchorX: e.clientX, anchorY: e.clientY }); } catch(_) {}
      } else {
        // 短押し：従来通り
        try { handleCellClick(cell); } catch(_) {}
      }
    }, { passive: true });

    grid.addEventListener('pointercancel', (e) => {
      if (pointerId == null || e.pointerId !== pointerId) return;
      cleanupAll();
    }, { passive: true });

    // モバイル等の長押しコンテキストメニュー抑止（必要なら）
    grid.addEventListener('contextmenu', (e) => {
      if (pressed) e.preventDefault();
    });
  }

  // ここで一度だけインストール（セル自体は差し替わっても grid で拾える）
  aatInstallCellPressHandlersOnce();

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
      link.style.color = '#666';
      link.style.textDecoration = 'underline';
      link.textContent = 'arena assist tool - v1.2.2d';
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
    // 初回：ロスター初期化（旧データがあれば移行）
    try{
      aatEnsureRostersInitialized();
    }catch(_){}

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

      // 装備ロスター名称（プリセット集合体）
      const rosterNameBar = document.createElement('div');
      rosterNameBar.style.display = 'flex';
      rosterNameBar.style.alignItems = 'center';
      rosterNameBar.style.gap = '2px';
      rosterNameBar.style.marginBottom = '2px';
      rosterNameBar.style.padding = '2px';
      rosterNameBar.style.border = 'solid 1px #000';
      rosterNameBar.style.background = '#fff';

      const rosterNameLabel = document.createElement('span');
      rosterNameLabel.style.flex = '1 1 auto';
      rosterNameLabel.style.whiteSpace = 'nowrap';
      rosterNameLabel.style.overflow = 'hidden';
      rosterNameLabel.style.textOverflow = 'ellipsis';
      rosterNameLabel.style.fontWeight = 'bold';

      function refreshRosterNameUI(){
        rosterNameLabel.textContent = aatEnsureEquipRosterName();
      }
      rosterNameLabel.textContent = aatGetEquipRosterName() || '';
      panel.__aatOnOpen = refreshRosterNameUI;
      // ロスター切替時に外から呼べる更新関数（リストやモードも含めて整合させる）
      panel.__aatRefreshRoster = () => { try{ refreshRosterNameUI(); showEquipPreset(); resetMode(); }catch(_){} };

      const rosterRenameButton = button.cloneNode();
      rosterRenameButton.textContent = '名称変更';
      rosterRenameButton.style.width = '6em';
      rosterRenameButton.style.flex = '0 0 auto';

      const rosterAllDeleteButton = button.cloneNode();
      rosterAllDeleteButton.textContent = '全削除';
      rosterAllDeleteButton.style.width = '5.5em';
      rosterAllDeleteButton.style.flex = '0 0 auto';
      rosterAllDeleteButton.style.background = '#caa';

      rosterNameBar.append(rosterNameLabel, rosterRenameButton, rosterAllDeleteButton);

      // 名称変更ダイアログ
      const rosterRenameDialog = document.createElement('dialog');
      rosterRenameDialog.style.padding = '8px';
      rosterRenameDialog.style.border = '1px solid #000';
      rosterRenameDialog.style.background = '#fff';
      rosterRenameDialog.style.color = '#000';
      rosterRenameDialog.style.maxWidth = 'min(90vw, 360px)';

      const renameWrap = document.createElement('div');
      renameWrap.style.display = 'flex';
      renameWrap.style.flexDirection = 'column';
      renameWrap.style.gap = '6px';

      const renameInput = document.createElement('input');
      renameInput.type = 'text';
      renameInput.style.width = '12em';
      renameInput.style.padding = '4px';
      renameInput.placeholder = '装備ロスター名';

      const renameBtns = document.createElement('div');
      renameBtns.style.display = 'flex';
      renameBtns.style.gap = '6px';
      renameBtns.style.justifyContent = 'center';

      const renameOk = button.cloneNode();
      renameOk.textContent = '確定する';

      const renameCancel = button.cloneNode();
      renameCancel.textContent = 'キャンセル';
      renameCancel.style.background = '#caa';

      renameBtns.append(renameOk, renameCancel);
      renameWrap.append(renameInput, renameBtns);
      rosterRenameDialog.append(renameWrap);

      rosterRenameButton.addEventListener('click', ()=>{
        refreshRosterNameUI(); // 未設定なら自動命名
        renameInput.value = aatGetEquipRosterName();
        rosterRenameDialog.showModal();
        setTimeout(()=>{ try{ renameInput.focus(); renameInput.select(); }catch(_){} }, 0);
      });

      renameOk.addEventListener('click', ()=>{
        const v = renameInput.value.trim();
        if(!v){
          rosterRenameDialog.close(); // 空はキャンセル扱い
          return;
        }
        aatSetEquipRosterName(v);
        refreshRosterNameUI();
        rosterRenameDialog.close();
      });

      renameCancel.addEventListener('click', ()=>{
        rosterRenameDialog.close();
      });

      renameInput.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter'){
          e.preventDefault();
          renameOk.click();
        }
      });

      rosterRenameDialog.addEventListener('close', ()=>{
        renameInput.value = '';
      });

      // 全削除ダイアログ（現在ロスターをファイルごと削除）
      const rosterAllDeleteDialog = document.createElement('dialog');
      rosterAllDeleteDialog.style.padding = '8px';
      rosterAllDeleteDialog.style.border = '1px solid #000';
      rosterAllDeleteDialog.style.background = '#fff';
      rosterAllDeleteDialog.style.color = '#000';
      rosterAllDeleteDialog.style.maxWidth = 'min(90vw, 380px)';

      const delWrap = document.createElement('div');
      delWrap.style.display = 'flex';
      delWrap.style.flexDirection = 'column';
      delWrap.style.gap = '8px';

      const delMsg = document.createElement('div');
      delMsg.textContent = '展開中の装備ロスターとオート装備変更のデータをすべて削除してもよろしいですか？';
      delMsg.style.fontSize = '90%';
      delMsg.style.lineHeight = '1.35';

      const delCheckLabel = document.createElement('label');
      delCheckLabel.style.display = 'flex';
      delCheckLabel.style.alignItems = 'center';
      delCheckLabel.style.gap = '6px';
      delCheckLabel.style.fontSize = '90%';

      const delCheck = document.createElement('input');
      delCheck.type = 'checkbox';
      delCheckLabel.append(delCheck, '確認しました（チェックで有効化）');

      const delBtns = document.createElement('div');
      delBtns.style.display = 'flex';
      delBtns.style.gap = '6px';
      delBtns.style.justifyContent = 'center';

      const delOk = button.cloneNode();
      delOk.textContent = '全削除する';
      delOk.style.background = '#caa';
      delOk.disabled = true;

      const delCancel = button.cloneNode();
      delCancel.textContent = 'キャンセル';

      delBtns.append(delOk, delCancel);
      delWrap.append(delMsg, delCheckLabel, delBtns);
      rosterAllDeleteDialog.append(delWrap);

      rosterAllDeleteButton.addEventListener('click', ()=>{
        delCheck.checked = false;
        delOk.disabled = true;
        rosterAllDeleteDialog.showModal();
      });

      delCheck.addEventListener('change', ()=>{
        delOk.disabled = !delCheck.checked;
      });

      delOk.addEventListener('click', ()=>{
        if(!delCheck.checked) return;
        aatDeleteCurrentRosterAndLoadLatestOrNew();
        try{ panel.__aatRefreshRoster && panel.__aatRefreshRoster(); }catch(_){}
        rosterAllDeleteDialog.close();
      });

      delCancel.addEventListener('click', ()=>{
        rosterAllDeleteDialog.close();
      });

      rosterAllDeleteDialog.addEventListener('close', ()=>{
        delCheck.checked = false;
        delOk.disabled = true;
      });

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
            
            const target = 'autoEquipItems';
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
        div2.append(label);
        
        const description = document.createElement('div');
        description.innerText = '対戦に使用する装備を選択してください。バトル開始前に自動的に装備を変更します。複数登録した場合は開始時に装備するものを選択します。\nヒント: メインとなる1つのセットを使うことがほとんどなら、「ランダム装備」をOFFにするのがおすすめです。ランダム装備にチェックを入れると、登録してある中から自動でランダムに選択';
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

            const validKeys = new Set(Object.keys(equipPresets));

            for (const key of Object.keys(autoEquipItems)) {
              autoEquipItems[key] = autoEquipItems[key].filter(v => validKeys.has(v));
            }
            localStorage.setItem('autoEquipItems', JSON.stringify(autoEquipItems));
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

        // バックアップ書式（プリセット1つにつき1行）
        // 例:
        // {
        //   "_meta": {"rosterName": "装備ロスター_01051800", "savedAt": "2026-01-05_20-38-47"},
        //   "presets": {
        //     "A": {"id":["...","...","..."],"rank":["...","...","..."]},
        //     "B": {"id":["...","...","..."],"rank":["...","...","..."]}
        //   }
        // }
        function aatFormatBackupSavedAt(date = new Date()){
          const y = String(date.getFullYear());
          const mo = aatPad2(date.getMonth() + 1);
          const da = aatPad2(date.getDate());
          const hh = aatPad2(date.getHours());
          const mi = aatPad2(date.getMinutes());
          const ss = aatPad2(date.getSeconds());
          return `${y}-${mo}-${da}_${hh}-${mi}-${ss}`;
        }

        function formatEquipRosterBackupJson(rosterName, savedAt, presets, autoEquipItems){
          const lines = [];
          lines.push('{');
          lines.push(`  "_meta": {"rosterName": ${JSON.stringify(String(rosterName || ''))}, "savedAt": ${JSON.stringify(String(savedAt || ''))}},`);
          lines.push('  "presets": {');

          const entries = Object.entries(presets || {});
          for (let i = 0; i < entries.length; i++) {
            const [k, v] = entries[i];
            const comma = (i < entries.length - 1) ? ',' : '';
            // キーは JSON.stringify で安全にエスケープ（" や \ を含んでもOK）
            // 値も JSON.stringify で1行化（武器/防具/首の3部位をまとめて1行）
            lines.push(`    ${JSON.stringify(String(k))}: ${JSON.stringify(v)}${comma}`);
          }

          lines.push('  },');
          lines.push('  "autoEquipItems": {');

          const aEntries = Object.entries(autoEquipItems || {});
          for (let i = 0; i < aEntries.length; i++) {
            const [k, v] = aEntries[i];
            const comma = (i < aEntries.length - 1) ? ',' : '';
            // 値は JSON.stringify で1行化（rankごとに配列を1行にまとめる）
            lines.push(`    ${JSON.stringify(String(k))}: ${JSON.stringify(v)}${comma}`);
          }

          lines.push('  }');
          lines.push('}');
          return lines.join('\n');
        }

        backupButton.addEventListener('click', ()=>{
          aatSaveCurrentRosterFromLocalStorage(); // 念のため最新化
          const data = localStorage.getItem('equipPresets');
          let presets = {};
          if(data) {
            presets = JSON.parse(data);
          }
          const autoData = localStorage.getItem('autoEquipItems');
          let autoEquipItems = {};
          if(autoData) {
            autoEquipItems = JSON.parse(autoData);
          }
          const rosterName = aatEnsureEquipRosterName();
          const savedAt = aatFormatBackupSavedAt(new Date());
          textarea.value = formatEquipRosterBackupJson(rosterName, savedAt, presets, autoEquipItems);
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
      div.append(rosterNameBar, buttonsContainer, rosterRenameDialog, rosterAllDeleteDialog, equipSettingsDialog, backupDialog, stat);
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
      applyEquipFilters();
    });

    // register
    const registerButton = button.cloneNode();
    registerButton.textContent = '登録';
    registerButton.style.width = '4em';
    registerButton.style.height = '42px';
    registerButton.style.fontSize = '';

    // MOD=0 toggle
    const mod0ToggleLabel = document.createElement('label');
    mod0ToggleLabel.style.display = 'inline-flex';
    mod0ToggleLabel.style.alignItems = 'center';
    mod0ToggleLabel.style.gap = '4px';
    mod0ToggleLabel.style.margin = '2px';
    mod0ToggleLabel.style.height = '42px';
    mod0ToggleLabel.style.whiteSpace = 'nowrap';
    mod0ToggleLabel.style.fontSize = '75%';
    mod0ToggleLabel.style.userSelect = 'none';
    const mod0Toggle = document.createElement('input');
    mod0Toggle.type = 'checkbox';
    mod0Toggle.style.margin = '0';
    const mod0ToggleText = document.createElement('span');
    mod0ToggleText.textContent = 'MOD=0 も表示';
    mod0ToggleLabel.append(mod0Toggle, mod0ToggleText);
    mod0Toggle.addEventListener('change', ()=>{ applyEquipFilters(); });

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

    bar.append(rankSelect, equipSwitchButton, registerButton, mod0ToggleLabel, p);
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

    const AAT_ELEM_COLORS = { '火':'#FFEEEE','氷':'#EEEEFF','雷':'#FFFFEE','風':'#EEFFEE','地':'#FFF0E0','水':'#EEFFFF','光':'#FFFFF0','闇':'#F0E0FF' };

    function getHeaderIndex(table, headerText){
      try{
        const ths = Array.from(table.querySelectorAll('thead tr th'));
        return ths.findIndex(th => (th.textContent||'').trim() === headerText);
      }catch(_){
        return -1;
      }
    }

    function getCurrentEquipTable(){
      if(weaponTable && !weaponTable.style.display) return weaponTable;
      if(armorTable && !armorTable.style.display) return armorTable;
      if(necklaceTable && !necklaceTable.style.display) return necklaceTable;
      return weaponTable || armorTable || necklaceTable || null;
    }

    function applyElemColors(table){
      const idx = getHeaderIndex(table, 'ELEM');
      if(idx < 0) return;
      const rows = (table.tBodies && table.tBodies[0]) ? Array.from(table.tBodies[0].rows) : [];
      rows.forEach(tr => {
        const cell = tr.cells[idx];
        if(!cell) return;
        const raw = (cell.textContent||'').trim();
        const elem = (raw.match(/[^\d]+$/) || ['なし'])[0].trim();
        if(elem === 'なし') { cell.style.background = ''; cell.style.color = ''; return; }
        const col = AAT_ELEM_COLORS[elem];
        if(!col) return;
        cell.style.background = col;
        cell.style.color = '#000';
      });
    }

    let mod0Prompted = false;
    function applyEquipFilters(){
      const cur = getCurrentEquipTable();
      if(!cur) return;

      const modIdx = getHeaderIndex(cur, 'MOD');
      const rows = (cur.tBodies && cur.tBodies[0]) ? Array.from(cur.tBodies[0].rows) : [];

      let hasRankPass = false;
      let hasModGte1 = false;

      rows.forEach(tr => {
        const rankPass = (tr.dataset.aatRankPass !== '0'); // default: pass
        if(rankPass) hasRankPass = true;

        let mod = 0;
        if(modIdx >= 0){
          const t = (tr.cells[modIdx]?.textContent || '').trim();
          const m = t.match(/-?\d+/);
          mod = m ? parseInt(m[0],10) : 0;
          if(rankPass && mod >= 1) hasModGte1 = true;
        }

        const modPass = (modIdx < 0) ? true : (mod0Toggle.checked ? true : (mod >= 1));
        tr.style.display = (rankPass && modPass) ? '' : 'none';
      });

      // MOD>=1 が 0 件なら、見落とし防止のため自動で「MOD=0 も表示」を ON にする（1回だけ）
      if(modIdx >= 0 && hasRankPass && !hasModGte1 && !mod0Toggle.checked && !mod0Prompted){
        mod0Prompted = true;
        alert('「MOD=0 も表示」をONにします');
        mod0Toggle.checked = true;
        applyEquipFilters();
      }
    }

    async function showEquipList(){
      // 「追加」ボタン押下時は、/bag から毎回最新情報を取得する（古い候補リストを避ける）
      try {
        const res = await fetch('https://donguri.5ch.net/bag', { credentials: 'include' });
        if(!res.ok) throw new Error('bag response error');
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const h1 = doc.querySelector('h1');
        if(h1?.textContent !== 'アイテムバッグ') throw new Error(text);

        // 常に新しい DOM を生成して差し替える（キャッシュを使わない）
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
          if(index !== 2) applyElemColors(table);
        });

        tableContainer.replaceChildren(weaponTable, armorTable, necklaceTable);
      } catch(e) {
        console.error(e);
        // 通信失敗時は、既に取得済みの候補（キャッシュ）がある場合のみそれを表示
        if(!weaponTable || !armorTable || !necklaceTable) return;
      }

      mod0Prompted = false;
      mod0Toggle.checked = false;

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
          row.dataset.aatRankPass = itemName.includes(`[${rank}]`) ? '1' : '0';
        })
      })
      applyEquipFilters();
    }
    function saveEquipPreset(name, obj){
      let equipPresets = JSON.parse(localStorage.getItem('equipPresets')) || {};
      equipPresets[name] = obj;
      localStorage.setItem('equipPresets', JSON.stringify(equipPresets));
      aatSaveCurrentRosterFromLocalStorage();
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
          localStorage.removeItem('autoEquipItems');
          aatSetEquipRosterName('');
          aatSaveCurrentRosterFromLocalStorage();
          showEquipPreset();
          return true;
        }
        const json = JSON.parse(text);

        // 新形式: { _meta: { rosterName }, presets: {...}, autoEquipItems: {...} }
        let rosterName = '';
        let presets = null;
        let autoEquipItems = {};

        if (json && typeof json === 'object' && !Array.isArray(json)) {
          if (json._meta && typeof json._meta === 'object' && json._meta.rosterName != null) {
            rosterName = String(json._meta.rosterName || '').trim();
          }
          if (json.presets && typeof json.presets === 'object' && !Array.isArray(json.presets)) {
            presets = json.presets;
          }
          if (json.autoEquipItems && typeof json.autoEquipItems === 'object' && !Array.isArray(json.autoEquipItems)) {
            autoEquipItems = json.autoEquipItems;
          }
        }

        // 旧形式（素のオブジェクト）の場合は json を presets とみなす
        if (!presets) presets = json;
        if (!presets || typeof presets !== 'object' || Array.isArray(presets)) {
          alert('書式エラー');
          return false;
        }

        if (rosterName) aatSetEquipRosterName(rosterName);
        else aatSetEquipRosterName('');

        localStorage.setItem('equipPresets', JSON.stringify(presets));

        // autoEquipItems（存在しなければ空）
        try {
          const keys = new Set(Object.keys(presets));
          const filtered = {};
          for (const [rank, arr] of Object.entries(autoEquipItems || {})) {
            if (!Array.isArray(arr)) continue;
            filtered[rank] = arr.filter((name) => keys.has(name));
          }
          localStorage.setItem('autoEquipItems', JSON.stringify(filtered));
        } catch (_) {
          localStorage.setItem('autoEquipItems', JSON.stringify({}));
        }

        aatSaveCurrentRosterFromLocalStorage();
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
      localStorage.setItem('equipPresets', JSON.stringify(equipPresets));
      localStorage.setItem('autoEquipItems', JSON.stringify(autoEquipItems));
      aatSaveCurrentRosterFromLocalStorage();
      showEquipPreset();
    }

    function selectAutoEquipItems(li, name, rank) {      
      const target = 'autoEquipItems';
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
      aatSaveCurrentRosterFromLocalStorage();
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

  let __aatScaling = false;
  function scaleContentsToFit(container, contents){
    if (!container || !contents) return;
    if (__aatScaling) return;
    __aatScaling = true;
    try{
      // 既に transform/height が入っている状態だと scrollWidth/scrollHeight が「前回の見かけ値」に引っ張られ、
      // 初回更新前のトグルでスケール計算が崩れることがあるため、計測前に一旦リセットして素の寸法を測る。
      contents.style.transform = 'none';
      contents.style.height = 'auto';

      const containerWidth = container.clientWidth || (typeof vw === 'number' ? vw : 0) || window.innerWidth || 0;
      const contentsWidth = contents.scrollWidth || 0;
      if (!containerWidth || !contentsWidth) {
        contents.style.transform = 'scale(1)';
        contents.style.transformOrigin = 'top left';
        contents.style.height = 'auto';
        return;
      }

      const scaleFactor = Math.min(1, containerWidth / contentsWidth);
      contents.style.transform = `scale(${scaleFactor})`;
      contents.style.transformOrigin = 'top left';

      const scaledHeight = (contents.scrollHeight || 0) * scaleFactor;
      contents.style.height = `${scaledHeight}px`;
    } finally {
      __aatScaling = false;
    }
  }

  // scaleContentsToFit は scrollWidth/scrollHeight を参照するため頻繁に呼ぶと重くなる。
  // rAF で間引いて「1フレームに最大1回」だけ実行する。
  let __aatScaleScheduled = false;
  function scheduleScale(){
    if (__aatScaleScheduled) return;
    __aatScaleScheduled = true;
    requestAnimationFrame(() => {
      __aatScaleScheduled = false;
      try { scaleContentsToFit(grid.parentNode, grid); } catch(_) {}
    });
  }

  scheduleScale();

async function refreshArenaInfo() {
    const refreshedCells = [];
    function includesCoord(arr, row, col) {
      return arr.some(([r, c]) => r === Number(row) && c === Number(col));
    }

    function parseTeambattleScript(scriptContent) {
      const mCellColors = scriptContent.match(/const\s+cellColors\s*=\s*({[\s\S]*?})\s*;/);
      if (!mCellColors) throw new Error('cellColors.ng');
      const cellColorsJson = mCellColors[1]
        .replace(/'/g, '"')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      const cellColors = JSON.parse(cellColorsJson);

      const mCapitalMap = scriptContent.match(/const\s+capitalMap\s*=\s*(\[[\s\S]*?\])\s*;/);
      if (!mCapitalMap) throw new Error('capitalMap.ng');
      const capitalMap = JSON.parse(mCapitalMap[1]);

      return { cellColors, capitalMap };
    }

    function rgbToHex(rgbStr) {
      const m = String(rgbStr || '').match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(',').map(s => s.trim());
      const r = Math.max(0, Math.min(255, parseInt(parts[0], 10) || 0));
      const g = Math.max(0, Math.min(255, parseInt(parts[1], 10) || 0));
      const b = Math.max(0, Math.min(255, parseInt(parts[2], 10) || 0));
      let a = 1;
      if (parts.length >= 4) {
        const v = parseFloat(parts[3]);
        a = Number.isFinite(v) ? v : 1;
      }
      const aa = Math.max(0, Math.min(255, Math.round(a * 255)));

      // 透明扱いは既存ロジックに合わせて #ffffff00 に正規化
      if (parts.length >= 4 && aa === 0) return '#ffffff00';
      return '#' + [r, g, b].map(v => v.toString(16).toLowerCase().padStart(2, '0')).join('');
    }

    function applyTextColor(cell) {
      const rgb = getComputedStyle(cell).backgroundColor.match(/\d+/g);
      if (!rgb || rgb.length < 3) return;
      const r = Number(rgb[0]), g = Number(rgb[1]), b = Number(rgb[2]);
      const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      cell.style.color = brightness > 128 ? '#000' : '#fff';
    }

    // m=rb の「チーム: レッド/ブルー」表示（テキスト＋色付き●）を、取得した最新HTMLに合わせて更新
    function updateTeamBadgeFromDoc(doc) {
      if (__battleMode !== 'rb') return;
      if (!doc) return;

      // 取得した doc 側の「チーム: ○○」span を探す（header 内）
      const srcLabel = Array.from(doc.querySelectorAll('header span'))
        .find(s => /^チーム:/.test((s.textContent || '').trim()));
      if (!srcLabel) return;

      const m = (srcLabel.textContent || '').match(/チーム:\s*(レッド|ブルー)/);
      if (!m) return;
      const team = m[1];

      // 取得した doc 側の色付き●（label の次の span）から背景色を拾う（なければ既定色）
      const srcDot = (srcLabel.nextElementSibling && srcLabel.nextElementSibling.tagName === 'SPAN')
        ? srcLabel.nextElementSibling : null;
      const dotBg = (srcDot && (srcDot.style.background || srcDot.style.backgroundColor)) || '';
      const bg = dotBg || (team === 'ブルー' ? '#1976d2' : '#d32f2f');

      // 現在ページ側の「チーム: ○○」span を更新
      const dstLabel = Array.from(document.querySelectorAll('header span'))
        .find(s => /^チーム:/.test((s.textContent || '').trim()));
      if (!dstLabel) return;

      // 《テキスト（レッド/ブルー）》を更新
      dstLabel.textContent = `チーム: ${team}`;

      // 《border-radius:999px で擬似的に着色●》を更新（無ければ生成）
      let dstDot = dstLabel.nextElementSibling;
      if (!dstDot || dstDot.tagName !== 'SPAN') {
        dstDot = document.createElement('span');
        dstLabel.insertAdjacentElement('afterend', dstDot);
      }
      Object.assign(dstDot.style, {
        display: 'inline-block',
        marginLeft: '8px',
        width: '10px',
        height: '10px',
        borderRadius: '999px',
        background: bg,
        border: '1px solid #00000022',
      });
    }

    try {
      // 常に「マップ本体（r/cなし）」を取りに行く（現在URLが r/c 付きでも壊れないように）
      const res = await fetch(buildTeambattleUrl());
      if (!res.ok) throw new Error(`[${res.status}] /teambattle`);

      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const h1 = doc?.querySelector('h1')?.textContent;
      if (h1 !== 'どんぐりチーム戦い') throw new Error('title.ng info');

      // ヘッダーの「チーム: レッド/ブルー」＋色付き● を最新に更新（m=rb のみ）
      updateTeamBadgeFromDoc(doc);

      const scriptElm = doc.querySelector('.grid > script');
      const newGrid = doc.querySelector('.grid');
      if (!scriptElm || !newGrid) throw new Error('grid.ng info');

      const { cellColors, capitalMap } = parseTeambattleScript(scriptElm.textContent || '');

      const mRows = (newGrid.style.gridTemplateRows || '').match(/repeat\((\d+),\s*35px\)/);
      const mCols = (newGrid.style.gridTemplateColumns || '').match(/repeat\((\d+),\s*35px\)/);
      if (!mRows || !mCols) throw new Error('gridSize.ng info');

      const rows = Number(mRows[1]);
      const cols = Number(mCols[1]);

      const currentCells = Array.from(grid.querySelectorAll('.cell'));
      const needRebuild = currentCells.length !== rows * cols;

      if (needRebuild) {
        // サイズが変わった場合は作り直し
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
              cell.style.borderColor = '#ccc';
            }

            const cellKey = `${i}-${j}`;
            if (cellColors[cellKey]) {
              cell.style.backgroundColor = cellColors[cellKey];
            } else {
              cell.style.backgroundColor = '#ffffff00';
            }
            applyTextColor(cell);

            // クリック/長押しは grid 側の pointer ハンドラで処理（セル個別に listener を付けない）

            grid.appendChild(cell);
            refreshedCells.push(cell);
          }
        }
      } else {
        // サイズが同じなら「色・首都枠」だけ差分更新
        for (const cell of currentCells) {
          const { row, col } = cell.dataset;
          const cellKey = `${row}-${col}`;
          const newColor = cellColors[cellKey] ? cellColors[cellKey] : '#ffffff00';

          const nowHex = rgbToHex(getComputedStyle(cell).backgroundColor);
          if (newColor === '#ffffff00') {
            if (nowHex !== '#ffffff00') {
              cell.style.backgroundColor = '#ffffff00';
              refreshedCells.push(cell);
            }
          } else if (!nowHex || nowHex.toLowerCase() !== newColor.toLowerCase()) {
            cell.style.backgroundColor = newColor;
            refreshedCells.push(cell);
          }

          applyTextColor(cell);

          if (includesCoord(capitalMap, row, col)) {
            cell.style.outline = 'black solid 2px';
            cell.style.borderColor = 'gold';
          } else {
            cell.style.outline = '';
            cell.style.borderColor = '#ccc';
          }
        }
      }

      // テーブル更新（dialog 内の table は除外して、teambattle 本体の表だけを差し替える）
      const tables = Array.from(document.querySelectorAll('table'))
        .filter(t => !t.closest('dialog'));
      const newTables = Array.from(doc.querySelectorAll('table'));

      const n = Math.min(tables.length, newTables.length);
      for (let i = 0; i < n; i++) {
        tables[i].replaceWith(newTables[i]);
      }

      addCustomColor();
      // DOM差し替え後にスケール再計算（※MutationObserver 依存にしない）
      scheduleScale();
      return refreshedCells;
    } catch (e) {
      console.error(e);
      return refreshedCells;
    }
  }


  function updateTeamTable() {
    // 集計
    const cells = document.querySelectorAll('.cell');
    const total = cells.length;
    const counts = {};
    cells.forEach(cell => {
      const color = cell.style.backgroundColor;
      counts[color] = (counts[color] || 0) + 1;
    });
    // チームテーブルを一行ずつ更新
    document.querySelectorAll('table:nth-child(1) > tbody > tr').forEach(row => {
      const color = row.firstChild.style.backgroundColor;
      const count = counts[color] || 0;
      row.lastChild.replaceChildren(...[
        `実測: ${count}`,
        (count * 100 / total).toFixed(1) + '%'
      ].map(text => {
        const tag = document.createElement('div');
        tag.textContent = text;
        return tag;
      }));
    });
  }


async function fetchAreaInfo(refreshAll){
    const refreshedCells = await refreshArenaInfo();
    const refreshedSet = new Set(Array.isArray(refreshedCells) ? refreshedCells : []);

    if (currentViewMode === 'detail') {
      grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace('35px','65px');
      grid.style.gridTemplateColumns = grid.style.gridTemplateColumns.replace('35px','105px');
    }
    grid.parentNode.style.height = null;
    grid.parentNode.style.padding = '20px 0';


    const cells = grid.querySelectorAll('.cell');
    const p = [...cells].map(async(elm) => {
      const hasInfo = elm.dataset.rank !== undefined;
      const isRefreshed = refreshedSet.has(elm);
      if(refreshAll || !hasInfo || isRefreshed) {
        return fetchSingleArenaInfo(elm)
      }
    })
    Promise.allSettled(p).then(() => updateTeamTable());
  }
  updateTeamTable();

  async function fetchSingleArenaInfo(elm) {
    try {
      const { row, col } = elm.dataset;
      const url = buildTeambattleUrl(row, col);
      const res = await fetch(url);
      if(!res.ok) throw new Error(res.status + ' res.ng');
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const h1 = doc?.querySelector('h1')?.textContent;
      if(h1 !== 'どんぐりチーム戦い') throw new Error(`title.ng [${row}][${col}][${h1}]`);
      const rank = doc.querySelector('small')?.textContent || '';
      if(!rank) return Promise.reject(`rank.ng [${row}][${col}][${h1}]`);
      const leader = doc.querySelector('strong')?.textContent || '';
      const shortenRank = rank.replace('[エリート]','e').replace('から','-').replace(/(まで|\[|\]|\||\s)/g,'');
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

      elm.replaceWith(cell);
    } catch(e) {
      console.error(e)
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

  (()=>{
    [...document.querySelectorAll('.cell')].forEach(elm => {
      const cell = elm.cloneNode();
      elm.replaceWith(cell);
    })
    // 初期差し替え後に一度だけ計測
    scheduleScale();
  })();

  // グリッド配下（cell）の style 変更まで監視すると MutationObserver が過剰発火して
  // レイアウト計算（scrollWidth/scrollHeight）を連打し、Firefox で「ページが遅い」警告の原因になる。
  // ここでは「grid 自体の属性変更」＋「直下の子要素増減」のみに限定し、スケール計算も rAF で間引く。
  const observer = new MutationObserver(() => { scheduleScale(); });
  observer.observe(grid, { attributes: true, childList: true, subtree: false });
  window.addEventListener('resize', scheduleScale, { passive: true });
  window.addEventListener('orientationchange', scheduleScale, { passive: true });

  async function fetchArenaTable(row, col){
    const url = buildTeambattleUrl(row, col);
    try {
      const res = await fetch(url);
      if(!res.ok) throw new Error('res.ng');
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text,'text/html');
      const h1 = doc?.querySelector('h1')?.textContent;
      if(h1 !== 'どんぐりチーム戦い') return Promise.reject(`title.ng`);
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

  async function handleCellClick (cell, opt = {}){
    if (shouldSkipAreaInfo) {
      const { row, col, rank } = cell.dataset;
      if (arenaField.open) fetchArenaTable(row, col);
      await autoEquipAndChallenge (row, col, rank, opt);
    } else {
      const { row, col } = cell.dataset;
      fetchArenaTable(row, col);
    }
  }

  const autoEquipDialog = document.createElement('dialog');
  autoEquipDialog.style.padding = '0';
  autoEquipDialog.style.background = '#fff';
  document.body.append(autoEquipDialog);
  async function autoEquipAndChallenge (row, col, rank, opt = {}) {
      if (shouldSkipAutoEquip) {
        arenaChallenge(row, col);
        return;
      }
  
      const forceEquipDialog = !!opt.forceEquipDialog;
      const anchorX = Number.isFinite(opt.anchorX) ? opt.anchorX : null;
      const anchorY = Number.isFinite(opt.anchorY) ? opt.anchorY : null;

      rank = rank
        .replace('エリート','e')
        .replace(/.+から|\w+-|まで|だけ|\s|\[|\]|\|/g,'');
  
      const autoEquipItems = JSON.parse(localStorage.getItem('autoEquipItems')) || {};
      const list = autoEquipItems[rank] || [];
  
      // 装備選択ダイアログを開く（force の場合は「必ず表示」）
      function openEquipDialog(){
        while (autoEquipDialog.firstChild) {
          autoEquipDialog.firstChild.remove();
        }
  
        const ul = document.createElement('ul');
        ul.style.background = '#fff';
        ul.style.listStyle = 'none';
        ul.style.padding = '2px';
        ul.style.textAlign = 'left';
        ul.style.margin = '0';
        // 文字列折り返し防止（ウィンドウ位置調整で可能な限り収める）
        ul.style.whiteSpace = 'nowrap';

        const liTemplate = document.createElement('li');
        liTemplate.style.borderBottom = 'solid 1px #000';
        liTemplate.style.color = '#428bca';
        liTemplate.style.cursor = 'pointer';
        liTemplate.style.whiteSpace = 'nowrap';
  
        // 「現装備のまま攻撃」も選べるようにしておく（候補ゼロでもダイアログは成立）
        const liCurrent = liTemplate.cloneNode();
        liCurrent.textContent = '（現装備のまま攻撃）';
        liCurrent.addEventListener('click', () => {
          autoEquipDialog.close();
          arenaChallenge(row, col);
        });
        ul.append(liCurrent);
  
        // 候補（プリセット）一覧
        list.forEach(v => {
          const li = liTemplate.cloneNode();
          li.textContent = v;
          li.addEventListener('click', async () => {
            autoEquipDialog.close();
            await setPresetItems(v);
            arenaChallenge(row, col);
          });
          ul.append(li);
        });
  
        autoEquipDialog.append(ul);
        autoEquipDialog.showModal();
        // 位置指定（長押し/クリック位置の近くにコンテキストメニュー風で表示）
        if (anchorX !== null && anchorY !== null) {
          const pad = 6; // 画面端からの最低余白
          const gap = 8; // 押下位置からのオフセット
          autoEquipDialog.dataset.aatAnchored = '1';
          autoEquipDialog.style.position = 'fixed';
          autoEquipDialog.style.left = `${Math.round(anchorX + gap)}px`;
          autoEquipDialog.style.top = `${Math.round(anchorY + gap)}px`;
          autoEquipDialog.style.transform = 'none';
          autoEquipDialog.style.margin = '0';
          // 折り返しを発生させず、入らない場合はスクロール（ただしまずは位置調整で回避）
          autoEquipDialog.style.width = 'max-content';
          autoEquipDialog.style.whiteSpace = 'nowrap';
          autoEquipDialog.style.maxWidth = `calc(100vw - ${pad * 2}px)`;
          autoEquipDialog.style.maxHeight = `calc(100vh - ${pad * 2}px)`;
          autoEquipDialog.style.overflowX = 'auto';
          autoEquipDialog.style.overflowY = 'auto';
          autoEquipDialog.style.border = 'solid 1px #000';
          autoEquipDialog.style.color = '#000';
          autoEquipDialog.style.zIndex = '2147483647';
          // 位置確定まで一瞬中央に出ないように隠す（rAF で最終位置にしてから表示）
          autoEquipDialog.style.visibility = 'hidden';
        } else if (autoEquipDialog.dataset.aatAnchored === '1') {
          // 通常表示へ戻す（前回が anchored のときのみ）
          delete autoEquipDialog.dataset.aatAnchored;
          autoEquipDialog.style.position = '';
          autoEquipDialog.style.left = '';
          autoEquipDialog.style.top = '';
          autoEquipDialog.style.transform = '';
          autoEquipDialog.style.margin = '';
          autoEquipDialog.style.maxWidth = '';
          autoEquipDialog.style.maxHeight = '';
          autoEquipDialog.style.overflowX = '';
          autoEquipDialog.style.overflowY = '';
          autoEquipDialog.style.border = '';
          autoEquipDialog.style.color = '';
          autoEquipDialog.style.zIndex = '';
          autoEquipDialog.style.width = '';
          autoEquipDialog.style.whiteSpace = '';
          autoEquipDialog.style.visibility = '';
        }

        autoEquipDialog.append(ul);
        autoEquipDialog.showModal();
        autoEquipDialog.append(ul);
        autoEquipDialog.showModal();

        // showModal 後にサイズ確定するため rAF で調整：
        // 1) まず右下に出す 2) 右が無理なら左へ 3) 下が無理なら上へ 4) 最後にクランプ
        if (anchorX !== null && anchorY !== null) {
          requestAnimationFrame(() => {
            try{
              const rect = autoEquipDialog.getBoundingClientRect();
              const pad = 6;
              const gap = 8;
              const vw = window.innerWidth;
              const vh = window.innerHeight;

              // 初期は右下
              let left = Math.round(anchorX + gap);
              let top  = Math.round(anchorY + gap);

              // 右にはみ出すなら左へ逃がす
              if (left + rect.width + pad > vw) {
                left = Math.round(anchorX - rect.width - gap);
              }
              // 下にはみ出すなら上へ逃がす
              if (top + rect.height + pad > vh) {
                top = Math.round(anchorY - rect.height - gap);
              }

              // 最終クランプ（上下左右の端に寄りすぎない）
              const maxLeft = Math.max(pad, vw - rect.width - pad);
              const maxTop  = Math.max(pad, vh - rect.height - pad);
              left = Math.min(Math.max(pad, left), maxLeft);
              top  = Math.min(Math.max(pad, top), maxTop);
              autoEquipDialog.style.left = left + 'px';
              autoEquipDialog.style.top  = top + 'px';
              autoEquipDialog.style.visibility = 'visible';
            }catch(_){}
          });
        }
      }
  
      if (forceEquipDialog) {
        // 長押し：一致/不一致に関わらず「必ず」ダイアログを出す
        openEquipDialog();
        return;
      }
  
      // 通常：一致していれば即攻撃、合致しなければ従来のオート装備ロジック
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
          openEquipDialog();
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
      body: buildBattleBody(row, col)
    };
    try {
      const response = await fetch('/teamchallenge', options);
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

  let currentViewMode = settings.battleCondOnly ? 'compact' : 'detail';
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
        const rankRaw = (cell.dataset.rank || '');
        const rank = rankRaw ? rankRaw.replace(/\w+-|だけ/g,'') : '';
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
    // 変形/高さを再計算（重いので rAF で間引く）
    scheduleScale();
  }
})();
