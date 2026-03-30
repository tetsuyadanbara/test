// ==UserScript==
// @name         Donguri Battle Assistant
// @namespace    https://donguri.5ch.io/
// @version      5.3.15.6
// @description  5ちゃんねるのどんぐりシステムから派生したゲームの操作性を改善するためのユーザースクリプト
// @author       福呼び草
// @assistant    ChatGPT (OpenAI)
// @license      BSD-3-Clause license
// @match        https://donguri.5ch.io/teambattle*
// @match        https://donguri.5ch.io/bag
// @match        https://donguri.5ch.io/
// @match        https://donguri.world/teambattle*
// @match        https://donguri.world/bag
// @match        https://donguri.world/
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function() {
  'use strict';

  // =========================
  // スクリプト自身のバージョン（スクリプト情報表示用）
  // =========================
  const DBA_VERSION = '5.3.15.6';

  console.log('[DBA] BOOT', 'ver=', DBA_VERSION, 'href=', location.href);

  // =========================
  // 現在地セル 調査用デバッグ
  //  - 通常運用では不要なため既定OFF
  //  - 再調査が必要になった時だけ enabled を true に戻す
  //  - console 出力タグ: [DBA-RTDBG]
  // =========================
  const DBA_RT_COORD_DEBUG = {
    enabled: false,
    installed: false,
    tickTimer: 0,
    lastProbeSig: '',
    lastResolveSig: '',
    lastFetchSig: '',
    lastRenderSig: '',
    windowKeysLogged: false
  };

  function isRtCoordDebugEnabled(){
    return !!DBA_RT_COORD_DEBUG.enabled;
  }

  // =========================
  // マーカー再描画を遅延させる
  // =========================
  const DBA_CURRENT_MARKER_REFRESH = {
    timer: 0,
    raf1: 0,
    raf2: 0
  };

  function cancelDeferredCurrentCellMarkerRefresh(){
    if(DBA_CURRENT_MARKER_REFRESH.timer){
      clearTimeout(DBA_CURRENT_MARKER_REFRESH.timer);
      DBA_CURRENT_MARKER_REFRESH.timer = 0;
    }
    if(DBA_CURRENT_MARKER_REFRESH.raf1){
      cancelAnimationFrame(DBA_CURRENT_MARKER_REFRESH.raf1);
      DBA_CURRENT_MARKER_REFRESH.raf1 = 0;
    }
    if(DBA_CURRENT_MARKER_REFRESH.raf2){
      cancelAnimationFrame(DBA_CURRENT_MARKER_REFRESH.raf2);
      DBA_CURRENT_MARKER_REFRESH.raf2 = 0;
    }
  }

  function cancelDeferredCurrentCellMarkerRefreshFramesOnly(){
    if(DBA_CURRENT_MARKER_REFRESH.raf1){
      cancelAnimationFrame(DBA_CURRENT_MARKER_REFRESH.raf1);
      DBA_CURRENT_MARKER_REFRESH.raf1 = 0;
    }
    if(DBA_CURRENT_MARKER_REFRESH.raf2){
      cancelAnimationFrame(DBA_CURRENT_MARKER_REFRESH.raf2);
      DBA_CURRENT_MARKER_REFRESH.raf2 = 0;
    }
  }

  function sanitizeCurrentMarkerDelayMs(v){
    const n = Number(v);
    if(!Number.isFinite(n)) return 500;
    const clamped = Math.max(0, Math.min(5000, n));
    return Math.round(clamped);
  }

  function sanitizeCurrentMarkerDelaySec(v){
    const n = Number(v);
    if(!Number.isFinite(n)) return 0.5;
    const clamped = Math.max(0, Math.min(5, n));
    return Math.round(clamped * 10) / 10;
  }

  function markerDelaySecToMs(sec){
    return sanitizeCurrentMarkerDelayMs(sanitizeCurrentMarkerDelaySec(sec) * 1000);
  }

  function markerDelayMsToSec(ms){
    return sanitizeCurrentMarkerDelaySec(sanitizeCurrentMarkerDelayMs(ms) / 1000);
  }

  function sanitizeCurrentMarkerColorName(v){
    const s = String(v || '').trim().toLowerCase();
    switch(s){
      case 'silver':
      case 'gold':
      case 'purple':
      case 'crimson':
      case 'cyan':
        return s;
      default:
        return 'silver';
    }
  }

  function buildCurrentMarkerSvgDataUri(palette){
    const body0 = String(palette?.body0 || '#585e66');
    const body1 = String(palette?.body1 || '#f8fbff');
    const body2 = String(palette?.body2 || '#8d97a2');
    const body3 = String(palette?.body3 || '#ffffff');
    const body4 = String(palette?.body4 || '#858e99');
    const body5 = String(palette?.body5 || '#e8edf3');
    const body6 = String(palette?.body6 || '#4a515a');
    const rim0  = String(palette?.rim0  || '#ffffff');
    const rim1  = String(palette?.rim1  || '#858e98');
    const stroke = String(palette?.stroke || '#313a44');
    const tip = String(palette?.tip || '#656d77');
    const topGlow = String(palette?.topGlow || 'rgba(255,255,255,0.58)');
    const shineMid = String(palette?.shineMid || 'rgba(255,255,255,0.22)');
    const tipOpacity = String(palette?.tipOpacity || '0.82');

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 180">` +
        `<defs>` +
          `<linearGradient id="body" x1="0%" y1="0%" x2="100%" y2="0%">` +
            `<stop offset="0%" stop-color="${body0}"/>` +
            `<stop offset="14%" stop-color="${body1}"/>` +
            `<stop offset="31%" stop-color="${body2}"/>` +
            `<stop offset="50%" stop-color="${body3}"/>` +
            `<stop offset="67%" stop-color="${body4}"/>` +
            `<stop offset="84%" stop-color="${body5}"/>` +
            `<stop offset="100%" stop-color="${body6}"/>` +
          `</linearGradient>` +
          `<linearGradient id="rim" x1="0%" y1="0%" x2="0%" y2="100%">` +
            `<stop offset="0%" stop-color="${rim0}"/>` +
            `<stop offset="100%" stop-color="${rim1}"/>` +
          `</linearGradient>` +
          `<radialGradient id="shine" cx="38%" cy="24%" r="48%">` +
            `<stop offset="0%" stop-color="rgba(255,255,255,1)"/>` +
            `<stop offset="58%" stop-color="${shineMid}"/>` +
            `<stop offset="100%" stop-color="rgba(255,255,255,0)"/>` +
          `</radialGradient>` +
        `</defs>` +
        `<ellipse cx="60" cy="24" rx="34" ry="14" fill="url(#rim)" stroke="${stroke}" stroke-width="3.4"/>` +
        `<path d="M28 26 L60 154 L92 26 Z" fill="url(#body)" stroke="${stroke}" stroke-width="3.4" stroke-linejoin="round"/>` +
        `<path d="M41 28 L60 140 L72 28 Z" fill="url(#shine)" opacity="0.98"/>` +
        `<ellipse cx="60" cy="24" rx="22" ry="8" fill="${topGlow}"/>` +
        `<ellipse cx="60" cy="155" rx="9" ry="4.5" fill="${tip}" opacity="${tipOpacity}"/>` +
      `</svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  function getCurrentMarkerThemePreset(colorName){
    const name = sanitizeCurrentMarkerColorName(colorName);
    switch(name){
      case 'gold':
        return {
          image: buildCurrentMarkerSvgDataUri({
            body0: '#7a5a00',
            body1: '#fff7c2',
            body2: '#d0a42c',
            body3: '#fff3a0',
            body4: '#c58c10',
            body5: '#ffe082',
            body6: '#6c4d00',
            rim0: '#fffbe2',
            rim1: '#c99816',
            stroke: '#5f4300',
            tip: '#8a6508',
            topGlow: 'rgba(255,248,190,0.62)',
            shineMid: 'rgba(255,245,180,0.24)',
            tipOpacity: '0.86'
          }),
          filter: 'drop-shadow(0 0 2px rgba(255,255,220,0.98)) drop-shadow(0 0 6px rgba(255,220,80,1)) drop-shadow(0 2px 2px rgba(255,190,0,0.98)) drop-shadow(0 5px 8px rgba(40,20,0,0.9))'
        };
      case 'purple':
        return {
          image: buildCurrentMarkerSvgDataUri({
            body0: '#4e2a78',
            body1: '#f3e7ff',
            body2: '#9b73c9',
            body3: '#f7f0ff',
            body4: '#7b51ab',
            body5: '#dbc7ff',
            body6: '#3d1f63',
            rim0: '#fff7ff',
            rim1: '#9d78c8',
            stroke: '#2f194a',
            tip: '#5b3688',
            topGlow: 'rgba(246,232,255,0.64)',
            shineMid: 'rgba(234,210,255,0.25)',
            tipOpacity: '0.86'
          }),
          filter: 'drop-shadow(0 0 2px rgba(255,245,255,0.98)) drop-shadow(0 0 6px rgba(200,120,255,0.98)) drop-shadow(0 2px 2px rgba(155,80,230,0.95)) drop-shadow(0 5px 8px rgba(25,0,45,0.9))'
        };
      case 'crimson':
        return {
          image: buildCurrentMarkerSvgDataUri({
            body0: '#7a1f30',
            body1: '#ffe4ea',
            body2: '#d36a83',
            body3: '#fff3f6',
            body4: '#b94662',
            body5: '#ffc4d1',
            body6: '#651828',
            rim0: '#fff6f8',
            rim1: '#cc6b85',
            stroke: '#4f1320',
            tip: '#8c2941',
            topGlow: 'rgba(255,232,238,0.62)',
            shineMid: 'rgba(255,205,220,0.24)',
            tipOpacity: '0.86'
          }),
          filter: 'drop-shadow(0 0 2px rgba(255,245,247,0.98)) drop-shadow(0 0 6px rgba(255,120,160,0.98)) drop-shadow(0 2px 2px rgba(235,70,110,0.95)) drop-shadow(0 5px 8px rgba(45,0,10,0.9))'
        };
      case 'cyan':
        return {
          image: buildCurrentMarkerSvgDataUri({
            body0: '#1f5d73',
            body1: '#e7fcff',
            body2: '#74c7dd',
            body3: '#f3feff',
            body4: '#4aa6bf',
            body5: '#c8f4ff',
            body6: '#18495b',
            rim0: '#f2ffff',
            rim1: '#79c7d8',
            stroke: '#123948',
            tip: '#2b7287',
            topGlow: 'rgba(232,251,255,0.64)',
            shineMid: 'rgba(190,245,255,0.24)',
            tipOpacity: '0.86'
          }),
          filter: 'drop-shadow(0 0 2px rgba(245,255,255,0.98)) drop-shadow(0 0 6px rgba(110,235,255,0.98)) drop-shadow(0 2px 2px rgba(70,205,235,0.95)) drop-shadow(0 5px 8px rgba(0,30,40,0.9))'
        };
      case 'silver':
      default:
        return {
          image: buildCurrentMarkerSvgDataUri({
            body0: '#585e66',
            body1: '#f8fbff',
            body2: '#8d97a2',
            body3: '#ffffff',
            body4: '#858e99',
            body5: '#e8edf3',
            body6: '#4a515a',
            rim0: '#ffffff',
            rim1: '#858e98',
            stroke: '#313a44',
            tip: '#656d77',
            topGlow: 'rgba(255,255,255,0.58)',
            shineMid: 'rgba(255,255,255,0.22)',
            tipOpacity: '0.82'
          }),
          filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.95)) drop-shadow(0 0 6px rgba(255,255,180,0.95)) drop-shadow(0 2px 2px rgba(255,220,0,0.95)) drop-shadow(0 5px 8px rgba(20,0,0,0.88))'
        };
    }
  }

  function applyCurrentCellMarkerThemeFromSettings(settings){
    try{
      const theme = getCurrentMarkerThemePreset(settings?.rbLayer?.currentCellMarkerColor);
      document.documentElement.style.setProperty('--dba-current-marker-image', `url("${theme.image}")`);
      document.documentElement.style.setProperty('--dba-current-marker-filter', String(theme.filter || 'none'));
    }catch(_e){}
  }

  function scheduleDeferredCurrentCellMarkerRefresh(){
    cancelDeferredCurrentCellMarkerRefresh();

    const settings = loadSettings();
    const delayMs = sanitizeCurrentMarkerDelayMs(settings?.rbLayer?.currentCellMarkerDelayMs);

    DBA_CURRENT_MARKER_REFRESH.timer = setTimeout(() => {
      DBA_CURRENT_MARKER_REFRESH.timer = 0;
      try{
        flushPendingCurrentCellMarkerCache(true);
        scheduleBattlemapLayerSync();
      }catch(_e){}
    }, delayMs);
  }

  function dbaRtDbg(){
    if(!isRtCoordDebugEnabled()) return;
    try{
      console.log('[DBA-RTDBG]', ...arguments);
    }catch(_e){}
  }

  function dbaRtDbgWarn(){
    if(!isRtCoordDebugEnabled()) return;
    try{
      console.warn('[DBA-RTDBG]', ...arguments);
    }catch(_e){}
  }

  function dbaCoordFromMaybe(obj){
    if(!obj || typeof obj !== 'object') return null;
    const r = Number(obj.row ?? obj.r ?? obj.bapRow);
    const c = Number(obj.col ?? obj.c ?? obj.bapCol);
    if(!Number.isFinite(r) || !Number.isFinite(c)) return null;
    return { row: r, col: c };
  }

  function dbaCoordKey(coord){
    if(!coord) return 'null';
    const r = Number(coord.row);
    const c = Number(coord.col);
    if(!Number.isFinite(r) || !Number.isFinite(c)) return 'null';
    return `${r},${c}`;
  }

  function dbaSummarizeWindowAvatars(root){
    if(!root || typeof root !== 'object'){
      return {
        hasRoot: false,
        direct: null,
        selfMarked: [],
        avatarCount: 0
      };
    }

    const direct = dbaCoordFromMaybe(
      (root.myAvatar && typeof root.myAvatar === 'object')
        ? root.myAvatar
        : ((root.selfAvatar && typeof root.selfAvatar === 'object') ? root.selfAvatar : null)
    );

    const avatars = Array.isArray(root.avatars) ? root.avatars : [];
    const selfMarked = [];
    for(const av of avatars){
      if(!av || typeof av !== 'object') continue;
      if(!(av.isSelf === true || av.self === true || av.mine === true)) continue;
      const rc = dbaCoordFromMaybe(av);
      if(!rc) continue;
      selfMarked.push({
        row: rc.row,
        col: rc.col,
        flags: {
          isSelf: av.isSelf === true,
          self: av.self === true,
          mine: av.mine === true
        }
      });
      if(selfMarked.length >= 6) break;
    }

    return {
      hasRoot: true,
      direct,
      selfMarked,
      avatarCount: avatars.length
    };
  }

  function dbaListInterestingWindowKeys(){
    try{
      const keys = Object.getOwnPropertyNames(window);
      return keys
        .filter((k) => /avatar|coord|tile|battle|fow|grid|self/i.test(String(k || '')))
        .sort()
        .slice(0, 120);
    }catch(_e){
      return [];
    }
  }

  function dbaExtractCoordCandidatesFromText(text){
    const src = String(text || '');
    if(!src) return [];

    const out = [];
    const seen = new Set();
    const push = (label, row, col) => {
      const r = Number(row);
      const c = Number(col);
      if(!Number.isFinite(r) || !Number.isFinite(c)) return;
      const key = `${label}:${r},${c}`;
      if(seen.has(key)) return;
      seen.add(key);
      out.push({ label, row: r, col: c });
    };

    {
      const re = /"myAvatar"\s*:\s*\{[\s\S]{0,400}?"(?:row|r|bapRow)"\s*:\s*(\d+)[\s\S]{0,200}?"(?:col|c|bapCol)"\s*:\s*(\d+)/g;
      let m;
      while((m = re.exec(src)) !== null){
        push('myAvatar', m[1], m[2]);
        if(out.length >= 8) break;
      }
    }

    {
      const re = /"selfAvatar"\s*:\s*\{[\s\S]{0,400}?"(?:row|r|bapRow)"\s*:\s*(\d+)[\s\S]{0,200}?"(?:col|c|bapCol)"\s*:\s*(\d+)/g;
      let m;
      while((m = re.exec(src)) !== null){
        push('selfAvatar', m[1], m[2]);
        if(out.length >= 8) break;
      }
    }

    {
      const re = /"isSelf"\s*:\s*true[\s\S]{0,400}?"(?:row|r|bapRow)"\s*:\s*(\d+)[\s\S]{0,200}?"(?:col|c|bapCol)"\s*:\s*(\d+)/g;
      let m;
      while((m = re.exec(src)) !== null){
        push('isSelf', m[1], m[2]);
        if(out.length >= 8) break;
      }
    }

    {
      const re = /"currentAvatarCoord"[\s\S]{0,200}?"r"\s*:\s*(\d+)[\s\S]{0,120}?"c"\s*:\s*(\d+)/g;
      let m;
      while((m = re.exec(src)) !== null){
        push('currentAvatarCoord', m[1], m[2]);
        if(out.length >= 8) break;
      }
    }

    return out;
  }

  function dbaBuildInterestingPreview(text){
    const src = String(text || '').replace(/\s+/g, ' ').trim();
    if(!src) return '';
    const hit = src.match(/(.{0,120}(?:myAvatar|selfAvatar|isSelf|currentAvatarCoord|avatarsByTile).{0,220})/i);
    return hit ? String(hit[1] || '') : src.slice(0, 240);
  }

  function dbaShouldInspectDebugUrl(url){
    const u = String(url || '');
    if(!u) return false;
    return /teambattle|teamchallenge|avatar|battle|map|fow/i.test(u);
  }

  function dbaProbeRuntimeCurrentCell(reason){
    if(!isRtCoordDebugEnabled()) return;
    if(mode !== 'rb') return;

    let live = null;
    let fromDoc = null;
    let snapSelf = null;
    let urlCoord = null;
    let cache = null;
    let currentAvatarCoordValue = null;
    let avatarsByTileSelf = [];
    let winSummary = null;

    try{ live = readCurrentBattleCellCoordFromLiveWindow(); }catch(_e){}
    try{ fromDoc = readCurrentBattleCellCoordFromDocument(document); }catch(_e){}
    try{
      const snap = getBattlemapSnapshotFromDoc(document);
      const cands = [
        (snap && snap.selfAvatar && typeof snap.selfAvatar === 'object') ? snap.selfAvatar : null,
        (snap && snap.myAvatar && typeof snap.myAvatar === 'object') ? snap.myAvatar : null,
        (snap && snap.self && typeof snap.self === 'object') ? snap.self : null
      ];
      for(const self of cands){
        const rc = dbaCoordFromMaybe(self);
        if(rc){
          snapSelf = rc;
          break;
        }
      }
    }catch(_e){}
    try{
      const u = new URL(location.href);
      const r = Number(u.searchParams.get('r'));
      const c = Number(u.searchParams.get('c'));
      if(Number.isFinite(r) && Number.isFinite(c)){
        urlCoord = { row: r, col: c };
      }
    }catch(_e){}
    try{ cache = getCurrentCellMarkerCache(); }catch(_e){}
    try{
      if(typeof window.currentAvatarCoord === 'function'){
        currentAvatarCoordValue = dbaCoordFromMaybe(window.currentAvatarCoord());
      }
    }catch(_e){}
    try{
      const src = window.avatarsByTile;
      if(src && typeof src === 'object'){
        const keys = Object.keys(src);
        for(const k of keys){
          const arr = Array.isArray(src[k]) ? src[k] : [];
          for(const av of arr){
            if(!av || typeof av !== 'object') continue;
            if(!(av.isSelf === true || av.self === true || av.mine === true)) continue;
            const rc = dbaCoordFromMaybe(av);
            if(!rc) continue;
            avatarsByTileSelf.push({
              tile: String(k),
              row: rc.row,
              col: rc.col
            });
            if(avatarsByTileSelf.length >= 6) break;
          }
          if(avatarsByTileSelf.length >= 6) break;
        }
      }
    }catch(_e){}
    try{
      winSummary = dbaSummarizeWindowAvatars(window.__AVATARS);
    }catch(_e){
      winSummary = null;
    }

    const payload = {
      reason: String(reason || ''),
      href: location.href,
      live,
      fromDoc,
      snapSelf,
      urlCoord,
      cache,
      currentAvatarCoord: currentAvatarCoordValue,
      windowAvatars: winSummary,
      avatarsByTileSelf
    };
    const sig = JSON.stringify(payload);
    if(sig === DBA_RT_COORD_DEBUG.lastProbeSig && reason !== 'install'){
      return;
    }
    DBA_RT_COORD_DEBUG.lastProbeSig = sig;

    if(!DBA_RT_COORD_DEBUG.windowKeysLogged){
      DBA_RT_COORD_DEBUG.windowKeysLogged = true;
      dbaRtDbg('WINDOW_KEYS', dbaListInterestingWindowKeys());
    }

    dbaRtDbg('PROBE', payload);
  }

  function dbaLogCurrentCellResolved(source, coord){
    if(!isRtCoordDebugEnabled()) return;
    if(mode !== 'rb') return;

    const sig = `${String(source || '')}|${dbaCoordKey(coord)}`;
    if(sig === DBA_RT_COORD_DEBUG.lastResolveSig) return;
    DBA_RT_COORD_DEBUG.lastResolveSig = sig;
    dbaRtDbg('RESOLVE', {
      source: String(source || ''),
      coord: coord || null
    });
  }

  function dbaInspectDebugResponseText(kind, url, text){
    if(!isRtCoordDebugEnabled()) return;
    if(mode !== 'rb') return;

    const src = String(text || '');
    if(!src) return;

    const responseCoord = updateCurrentCellMarkerCacheFromResponseText(
      src,
      `${String(kind || 'response')}:myAvatar`
    );

    const candidates = dbaExtractCoordCandidatesFromText(src);
    const preview = dbaBuildInterestingPreview(src);
    const interesting =
      !!responseCoord ||
      candidates.length > 0 ||
      /myAvatar|selfAvatar|isSelf|currentAvatarCoord|avatarsByTile/i.test(src);

    if(!interesting) return;

    const sig = JSON.stringify({
      kind: String(kind || ''),
      url: String(url || ''),
      responseCoord,
      candidates,
      preview
    });
    if(sig === DBA_RT_COORD_DEBUG.lastFetchSig) return;
    DBA_RT_COORD_DEBUG.lastFetchSig = sig;

    dbaRtDbg(`${String(kind || '').toUpperCase()}_HIT`, {
      url: String(url || ''),
      responseCoord,
      candidates,
      preview
    });

    setTimeout(() => {
      dbaProbeRuntimeCurrentCell(`${String(kind || '')}:after-response`);
    }, 60);
  }

  function installRuntimeCurrentCellDebugProbes(){
    if(!isRtCoordDebugEnabled()) return false;
    if(mode !== 'rb') return false;
    if(DBA_RT_COORD_DEBUG.installed) return true;
    DBA_RT_COORD_DEBUG.installed = true;

    dbaRtDbg('INSTALL', { mode, href: location.href });

    if(!DBA_RT_COORD_DEBUG.tickTimer){
      DBA_RT_COORD_DEBUG.tickTimer = window.setInterval(() => {
        dbaProbeRuntimeCurrentCell('interval');
      }, 1200);
    }

    const queueProbe = (reason, delay) => {
      setTimeout(() => {
        dbaProbeRuntimeCurrentCell(reason);
      }, Math.max(0, Number(delay || 0)));
    };

    document.addEventListener('click', () => queueProbe('click', 80), true);
    document.addEventListener('pointerup', () => queueProbe('pointerup', 80), true);
    window.addEventListener('popstate', () => queueProbe('popstate', 50));

    queueProbe('install', 0);
    queueProbe('install+500ms', 500);
    return true;
  }

  // =========================
  // fetch レスポンス監視フック（実働用）
  // =========================
  const DBA_CURRENT_CELL_RESPONSE_HOOK = {
    installed: false
  };

  function installCurrentCellResponseHooks(){
    if(mode !== 'rb') return false;
    if(DBA_CURRENT_CELL_RESPONSE_HOOK.installed) return true;
    DBA_CURRENT_CELL_RESPONSE_HOOK.installed = true;

    try{
      const rawFetch = (typeof window.fetch === 'function') ? window.fetch.bind(window) : null;
      if(rawFetch){
        window.fetch = async function(){
          const resp = await rawFetch(...arguments);
          try{
            const req0 = arguments[0];
            const reqUrl = (resp && resp.url)
              ? String(resp.url)
              : (typeof req0 === 'string'
                  ? req0
                  : ((req0 && typeof req0.url === 'string') ? req0.url : ''));

            if(dbaShouldInspectDebugUrl(reqUrl) && resp && typeof resp.clone === 'function'){
              resp.clone().text().then((text) => {
                try{
                  updateCurrentCellMarkerCacheFromResponseText(
                    text,
                    'fetch:myAvatar'
                  );
                }catch(_e){}

                try{
                  if(isRtCoordDebugEnabled()){
                    dbaInspectDebugResponseText('fetch', reqUrl, text);
                  }
                }catch(_e){}
              }).catch(() => {});
            }
          }catch(_e){}
          return resp;
        };
      }
    }catch(e){
      dbaRtDbgWarn('FETCH_HOOK_FAILED', String(e && e.message ? e.message : e));
    }

    try{
      if(window.XMLHttpRequest && window.XMLHttpRequest.prototype){
        const proto = window.XMLHttpRequest.prototype;
        const rawOpen = proto.open;
        const rawSend = proto.send;

        proto.open = function(method, url){
          try{
            this.__dbaCurrentCellHookMethod = String(method || '');
            this.__dbaCurrentCellHookUrl = String(url || '');
          }catch(_e){}
          return rawOpen.apply(this, arguments);
        };

        proto.send = function(){
          try{
            const xhr = this;
            const url = String(xhr.__dbaCurrentCellHookUrl || '');
            if(dbaShouldInspectDebugUrl(url)){
              xhr.addEventListener('load', function(){
                try{
                  const finalUrl = String(xhr.responseURL || url || '');
                  const text = (typeof xhr.responseText === 'string') ? xhr.responseText : '';

                  try{
                    updateCurrentCellMarkerCacheFromResponseText(
                      text,
                      'xhr:myAvatar'
                    );
                  }catch(_e){}

                  try{
                    if(isRtCoordDebugEnabled()){
                      dbaInspectDebugResponseText('xhr', finalUrl, text);
                    }
                  }catch(_e){}
                }catch(_e){}
              }, { once:true });
            }
          }catch(_e){}
          return rawSend.apply(this, arguments);
        };
      }
    }catch(e){
      dbaRtDbgWarn('XHR_HOOK_FAILED', String(e && e.message ? e.message : e));
    }

    return true;
  }

  // =========================
  // fetch レスポンス中の myAvatar から現在地座標を読む
  // =========================
  function dbaExtractObjectLiteralTextByProp(srcText, propName){
    const src = String(srcText || '');
    const prop = String(propName || '');
    if(!src || !prop) return '';

    const re = new RegExp(`"${prop}"\\s*:\\s*\\{`, 'g');
    const m = re.exec(src);
    if(!m) return '';

    const openIdx = src.indexOf('{', m.index);
    if(openIdx < 0) return '';

    let depth = 0;
    let inString = false;
    let escaped = false;

    for(let i = openIdx; i < src.length; i++){
      const ch = src[i];

      if(inString){
        if(escaped){
          escaped = false;
          continue;
        }
        if(ch === '\\'){
          escaped = true;
          continue;
        }
        if(ch === '"'){
          inString = false;
        }
        continue;
      }

      if(ch === '"'){
        inString = true;
        continue;
      }
      if(ch === '{'){
        depth += 1;
        continue;
      }
      if(ch === '}'){
        depth -= 1;
        if(depth === 0){
          return src.slice(openIdx, i + 1);
        }
      }
    }

    return '';
  }

  function dbaParseCoordFromObjectLiteralText(objText){
    const src = String(objText || '');
    if(!src) return null;

    const rowMatch =
      src.match(/"(?:row|r|bapRow)"\s*:\s*(-?\d+)/) ||
      src.match(/(?:^|[,{]\s*)(?:row|r|bapRow)\s*:\s*(-?\d+)/);
    const colMatch =
      src.match(/"(?:col|c|bapCol)"\s*:\s*(-?\d+)/) ||
      src.match(/(?:^|[,{]\s*)(?:col|c|bapCol)\s*:\s*(-?\d+)/);

    if(!rowMatch || !colMatch) return null;

    const row = Number(rowMatch[1]);
    const col = Number(colMatch[1]);
    if(!Number.isFinite(row) || !Number.isFinite(col)) return null;
    return { row, col };
  }

  function readCurrentBattleCellCoordFromResponseText(text){
    if(mode !== 'rb') return null;

    const src = String(text || '');
    if(!src) return null;

    const directKeys = ['myAvatar', 'selfAvatar'];
    for(const key of directKeys){
      const objText = dbaExtractObjectLiteralTextByProp(src, key);
      const rc = dbaParseCoordFromObjectLiteralText(objText);
      if(rc) return rc;
    }

    return null;
  }

  function updateCurrentCellMarkerCacheFromResponseText(text, source){
    if(mode !== 'rb') return null;

    const rc = readCurrentBattleCellCoordFromResponseText(text);
    if(!rc) return null;

    const settings = loadSettings();
    const delayMs = sanitizeCurrentMarkerDelayMs(settings?.rbLayer?.currentCellMarkerDelayMs);

    setPendingCurrentCellMarkerCache(rc.row, rc.col, delayMs);
    dbaLogCurrentCellResolved(String(source || 'response-text-pending'), {
      row: rc.row,
      col: rc.col
    });

    try{
      scheduleDeferredCurrentCellMarkerRefresh();
    }catch(_e){}

    return rc;
  }

  // =========================
  // URL / ドメイン集中管理
  //  今後ドメインが変わった場合は、まずここを直す
  // =========================
  const DBA_ALLOWED_ORIGINS = new Set([
    'https://donguri.5ch.io',
    'https://donguri.world'
  ]);
  const DBA_BASE_ORIGIN = DBA_ALLOWED_ORIGINS.has(location.origin)
    ? location.origin
    : 'https://donguri.world';

  function makeSiteUrl(path){
    const p = String(path || '');
    return `${DBA_BASE_ORIGIN}${p.startsWith('/') ? p : `/${p}`}`;
  }

  function makeTeambattleUrl(params){
    const usp = new URLSearchParams();
    const src = params || {};
    for(const [k, v] of Object.entries(src)){
      if(v == null) continue;
      usp.set(k, String(v));
    }
    return `${makeSiteUrl('/teambattle')}?${usp.toString()}`;
  }

  function makeTopPageUrl(){
    return makeSiteUrl('/');
  }

  function makeBagUrl(){
    return makeSiteUrl('/bag');
  }

  function makeEquipUrl(id){
    return makeSiteUrl(`/equip/${Number(id)}`);
  }

  function makeTeamChallengeUrl(modeValue){
    return makeSiteUrl(`/teamchallenge?m=${encodeURIComponent(String(modeValue || ''))}`);
  }

  // URL判定
  const urlObj = new URL(location.href);
  const mode = urlObj.searchParams.get('m');
  const isTopPage = (urlObj.origin === DBA_BASE_ORIGIN && urlObj.pathname === '/' && !mode);

  // トップページ（どんぐり基地）は「経過時間」プログレス取得だけ行う
  if(isTopPage){
    const run = () => {
      try{ captureTopPageElapsedProgress(); }catch(_e){}
    };
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', run, { once:true });
    }else{
      run();
    }
    return;
  }

  // teambattle 対象モード（hc / l / rb）以外では動かさない
  if (!['hc', 'l', 'rb'].includes(mode)) return;

  // ============================================================
  // ▽ここから▽ CSS 定義ゾーン（集中管理）
  // ============================================================
  const CSS = `
    :root {
      --dba-fn-bg: #f0f0f0;
      --dba-fn-fg: #111;
      --dba-fn-border: #000;
      --dba-fn-shadow: rgba(0,0,0,0.15);
      --dba-fn-height: 50px; /* ファンクションセクションの高さ（JSで実測値に更新） */
      --dba-base-font-size: 17px; /* DBA全体の基準文字サイズ */
      --dba-layer-text-opacity: 1; /* 0.0 - 1.0（レイヤー上の文字濃度） */
      --dba-current-marker-filter: drop-shadow(0 0 2px rgba(255,255,255,0.95)) drop-shadow(0 0 6px rgba(255,255,180,0.95)) drop-shadow(0 2px 2px rgba(255,220,0,0.95)) drop-shadow(0 5px 8px rgba(20,0,0,0.88));
      --dba-current-marker-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 180'%3E%3Cdefs%3E%3ClinearGradient id='body' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' stop-color='%23585e66'/%3E%3Cstop offset='14%25' stop-color='%23f8fbff'/%3E%3Cstop offset='31%25' stop-color='%238d97a2'/%3E%3Cstop offset='50%25' stop-color='%23ffffff'/%3E%3Cstop offset='67%25' stop-color='%23858e99'/%3E%3Cstop offset='84%25' stop-color='%23e8edf3'/%3E%3Cstop offset='100%25' stop-color='%234a515a'/%3E%3C/linearGradient%3E%3ClinearGradient id='rim' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23ffffff'/%3E%3Cstop offset='100%25' stop-color='%23858e98'/%3E%3C/linearGradient%3E%3CradialGradient id='shine' cx='38%25' cy='24%25' r='48%25'%3E%3Cstop offset='0%25' stop-color='rgba(255,255,255,1)'/%3E%3Cstop offset='58%25' stop-color='rgba(255,255,255,0.22)'/%3E%3Cstop offset='100%25' stop-color='rgba(255,255,255,0)'/%3E%3C/radialGradient%3E%3C/defs%3E%3Cellipse cx='60' cy='24' rx='34' ry='14' fill='url(%23rim)' stroke='%23313a44' stroke-width='3.4'/%3E%3Cpath d='M28 26 L60 154 L92 26 Z' fill='url(%23body)' stroke='%23313a44' stroke-width='3.4' stroke-linejoin='round'/%3E%3Cpath d='M41 28 L60 140 L72 28 Z' fill='url(%23shine)' opacity='0.98'/%3E%3Cellipse cx='60' cy='24' rx='22' ry='8' fill='rgba(255,255,255,0.58)'/%3E%3Cellipse cx='60' cy='155' rx='9' ry='4.5' fill='%23656d77' opacity='0.82'/%3E%3C/svg%3E");
    }

    input[type="checkbox"] {
      display: inline-block;
      margin: 4px 0 0 0;
      width: 20px;
      height: 20px;
      cursor: pointer;
    }

    /* ファンクションセクション本体 */
    #dba-function-section {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      font-size: var(--dba-base-font-size);
      width: min(700px, calc(100svw - 8px));
      max-width: calc(100svw - 8px);
      height: auto;                 /* ★2段構造になるので固定高をやめる（高さはJSで追従） */
      display: flex;
      flex-direction: column;       /* ★縦積み（上=progress / 下=ボタン群） */
      align-items: stretch;
      justify-content: flex-start;
      gap: 0;
      margin: 0 auto;
      padding: 2px 8px 4px 8px;             /* ★内側余白を少し確保 */
      box-sizing: border-box;
      background: var(--dba-fn-bg);
      color: var(--dba-fn-fg);
      border-bottom: 1px solid var(--dba-fn-border);
      box-shadow: 0 2px 8px var(--dba-fn-shadow);
      z-index: 999999;
      max-height: min(60svh, calc(100svh - 8px)); /* ★大きくなりすぎたらfnbar内で収める */
      overflow-y: auto;                            /* ★縦方向のみfnbar内でスクロール */
      overflow-x: clip;                            /* ★横方向へはみ出してページ全体を広げない */
      scrollbar-gutter: stable both-edges;
    }

    /* fnbar：上段（<header>情報）／中段（progress）／下段（ボタン群） */
    #dba-fn-header-host {
      width: 100%;
      min-width: 0;
    }
    #dba-fn-header-info {
      width: 100%;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
      gap: 4px;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      border: 0 none #000;
      background: transparent;
    }
    .dba-fn-header-info__line1 {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-start;
      gap: 10px;
      row-gap: 4px;
      min-width: 0;
    }
    .dba-fn-header-info__title {
      font-size: 1.1em;
      font-weight: 900;
      line-height: 1.2;
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .dba-fn-header-info__mode {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 6px;
      min-width: 0;
      flex-wrap: wrap;
      font-size: 1.1em;
      font-weight: 800;
      line-height: 1.2;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .dba-fn-header-info__reg {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0;
      min-width: 0;
      flex-wrap: wrap;
      font-size: 1.1em;
      font-weight: 800;
      line-height: 1.2;
    }
    .dba-fn-header-info__reg-label,
    .dba-fn-header-info__reg-value,
    .dba-fn-header-info__sep {
      white-space: nowrap;
    }
    .dba-fn-header-info__team {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0;
      margin-left: 0;
      min-width: 0;
      flex-wrap: wrap;
      font-size: 1.1em;
      font-weight: 800;
      line-height: 1.2;
    }
    .dba-fn-header-info__team-label {
      white-space: nowrap;
    }
    .dba-fn-header-info__team-name {
      margin-right: 6px;
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .dba-fn-header-info__team-dot {
      display: inline-block;
      width: 18px;
      height: 18px;
      min-width: 18px;
      min-height: 18px;
      border-radius: 999px;
      border: 1px solid #00000022;
      vertical-align: middle;
      box-sizing: border-box;
      flex: 0 0 auto;
    }
    .dba-fn-header-info__anim-bracket {
      white-space: nowrap;
    }
    .dba-fn-header-info__prevmenu {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 6px;
      margin-left: 8px;
      min-width: 0;
      flex-wrap: wrap;
      font-size: 1em;
      font-weight: 700;
      line-height: 1.2;
    }
    .dba-fn-header-info__prevmenu-bracket {
      white-space: nowrap;
      user-select: none;
    }
    .dba-fn-header-info__prevmenu-btn {
      appearance: none;
      border: none;
      background: transparent;
      padding: 0;
      margin: 0;
      color: #0040c0;
      text-decoration: underline;
      text-underline-offset: 2px;
      font: inherit;
      font-weight: 700;
      line-height: 1.2;
      cursor: pointer;
      white-space: nowrap;
    }
    .dba-fn-header-info__prevmenu-btn:hover {
      color: #0000e0;
    }
    /* 前回のチームバトルの結果 */
    .dba-fn-header-info__prevmenu-panel {
      position: absolute;
      top: calc(100% + 6px);
      left: -70px;
      min-width: 240px;
      max-width: min(360px, calc(100vw - 24px));
      padding: 6px;
      border: 2px solid #000;
      border-radius: 12px;
      background: rgba(255,255,255,0.98);
      box-shadow: 0 10px 24px rgba(0,0,0,0.24);
      z-index: 1000000;
      display: none;
      box-sizing: border-box;
    }
    .dba-fn-header-info__prevmenu-panel[data-open="1"] {
      display: block;
    }
    .dba-fn-header-info__prevmenu-row {
      display: block;
      margin: 0;
      padding: 0;
    }
    .dba-fn-header-info__prevmenu-link {
      display: block;
      padding: 8px 10px;
      border-radius: 10px;
      color: #0040c0;
      text-decoration: underline;
      text-underline-offset: 2px;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .dba-fn-header-info__prevmenu-link:hover {
      background: #f3f6ff;
      color: #0000e0;
    }

    #dba-fn-progress-host {
      width: 100%;
      min-width: 0;
    }

    /* 設定・オート装備・ラピッド攻撃などのボタン群 */
    #dba-fn-buttons-row {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0;   /* ボタン自体に padding が設定されているため */
      flex-wrap: wrap;   /* ボタンが多い場合は折り返し */
      min-width: 0;
    }

    /* 既存ページを隠さないため、上に余白を確保 */
    html.dba-has-fnbar body {
      padding-top: calc(var(--dba-fn-height) + 4px) !important;
    }

    /* ===== トップページ「経過時間」プログレスバー表示（teambattle側へ移植） ===== */
    #dba-top-progress {
      margin: 0;                /* ★fnbar内に入るので外側マージンは0 */
      padding: 2px 0 0 0;
      border: 0 none #000;
      background: transparent;
      min-width: 100px;
      width: auto;
      box-sizing: border-box;
    }
    #dba-top-progress .dba-top-progress__metaRow {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-start;
      gap: 20px;
      row-gap: 4px;
      min-width: 0;
      margin: 0 0 2px 0;
      font-weight: 900;
      line-height: 1.2;
    }
    #dba-top-progress .dba-top-progress__metaTerm,
    #dba-top-progress .dba-top-progress__metaMatch,
    #dba-top-progress .dba-top-progress__metaTime {
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    #dba-top-progress .dba-top-progress__barRow {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 10px;
      flex-wrap: wrap;
      min-width: 0;
    }
    /* 「同期」ボタン */
    #dba-top-progress-sync-now {
      margin-left: 0;
      flex: 0 0 auto;
    }
    #dba-top-progress-sync-now[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }
    /* プログレスバー */
    #dba-top-progress .dba-top-progress__matchBar {
      height: 20px;
      background: #ccc;
      border-radius: 10px;
      font-size: 15px;
      line-height: 17px;
      overflow: hidden;
      margin-top: 0;
      flex: 1 1 auto;
      min-width: 0;
      width: auto;
      cursor: pointer;
      position: relative;
    }
    #dba-top-progress .dba-top-progress__matchBar > div {
      height: 100%;
      background: #428bca;
      width: 0%;
      text-align: right;
      padding-right: 5px;
      box-sizing: border-box;
      color: white;
      font-weight: 800;
    }
    #dba-top-progress-pop {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 1000000;
      display: none;
      width: min(420px, calc(100vw - 24px));
      padding: 12px 14px;
      border: 2px solid #000;
      border-radius: 14px;
      background: rgba(255,255,255,0.98);
      color: #111;
      box-shadow: 0 10px 24px rgba(0,0,0,0.24);
      box-sizing: border-box;
    }
    #dba-top-progress-pop[data-open="1"] {
      display: block;
    }
    .dba-top-progress-pop__title {
      font-size: 1.05em;
      font-weight: 900;
      line-height: 1.2;
      text-align: left;
      margin: 0 0 8px 0;
      white-space: nowrap;
    }
    .dba-top-progress-pop__bar {
      height: 18px;
      background: #ccc;
      border-radius: 10px;
      font-size: 15px;
      line-height: 17px;
      overflow: hidden;
      margin: 0 0 10px 0;
    }
    .dba-top-progress-pop__bar > div {
      height: 100%;
      background: #428bca;
      width: 0%;
      text-align: right;
      padding-right: 5px;
      box-sizing: border-box;
      color: #fff;
      font-weight: 800;
    }
    .dba-top-progress-pop__line {
      font-size: 0.92em;
      font-weight: 800;
      text-align: left;
      line-height: 1.35em;
      margin: 0 0 6px 0;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    /* ===== バトルマップ透明レイヤー（将来の拡張用土台） ===== */
    #dba-battlemap-layer {
      position: fixed;
      left: 0;
      top: 0;
      width: 0;
      height: 0;
      font-size: var(--dba-base-font-size);
      line-height: 1;
      z-index: 999990; /* fnbar(999999)より下、マップより上 */
      pointer-events: none; /* 現段階ではページ既存操作を妨げない */
      background: transparent;
      overflow: hidden;
      contain: layout paint style;
      isolation: isolate;
      transform: translateZ(0);
      backface-visibility: hidden;
    }
    #dba-battlemap-layer[data-syncing="1"] .dba-layer-cell__content {
      visibility: hidden;
    }
    #dba-battlemap-layer-grid {
      width: 100%;
      height: 100%;
      display: grid;
      font-size: inherit;
      line-height: inherit;
      background: transparent;
      box-sizing: border-box;
      contain: layout paint style;
    }
    .dba-layer-cell__deco {
      position: absolute;
      inset: 0;
      display: block;
      font-size: inherit;
      line-height: inherit;
      pointer-events: none;
      user-select: none;
      background: transparent;
      background-repeat: no-repeat;
      transform: translateZ(0);
      backface-visibility: hidden;
    }
    .dba-layer-cell {
      position: relative;
      font-size: inherit;
      line-height: inherit;
      background: transparent;
      box-sizing: border-box;
      overflow: visible;
      contain: layout paint style;
      min-width: 0;
      min-height: 0;
    }
    .dba-layer-cell[data-dba-current-marker="1"] {
      /* 現在地マーカーだけはセル外へ少しはみ出させたいので、
         paint containment を外して overflow:visible を効かせる */
      contain: layout style;
      z-index: 3;
    }
    .dba-layer-cell__content {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: block;
      font-size: 0.93em; /* dba-battlemap-layer の基準文字サイズを親として相対指定 */
      font-weight: 700;
      letter-spacing: -0.04em;
      line-height: 0.95em;
      opacity: var(--dba-layer-text-opacity);
      user-select: none;
      pointer-events: none;
      /* 左上寄せ + 折り返し + 下方向は隠す */
      padding: 1.5px 2px;
      box-sizing: border-box;
      overflow: hidden;           /* 下にあふれた分は非表示 */
      white-space: pre-wrap;      /* 改行を維持しつつ折り返し */
      overflow-wrap: anywhere;    /* 長い単語も折り返し */
      word-break: break-word;     /* 互換用 */
      text-align: left;
      transform: translateZ(0);
      backface-visibility: hidden;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      text-shadow:
        0 0 3px rgba(255,255,255,1),
        0 0 6px rgba(255,255,255,0.7),
        0 0 8px rgba(255,255,255,0.4);
    }

    /* ===== 自チーム首都攻撃の阻止 ===== */
    .dba-layer-cell__blocker {
      position: absolute;
      inset: 0;
      display: none;
      pointer-events: auto;
      user-select: none;
      z-index: 6;
      box-sizing: border-box;
      background: rgba(128, 128, 128, 0.28);
      outline: 2px solid rgba(80, 80, 80, 0.75);
      outline-offset: -2px;
      cursor: not-allowed;
    }
    .dba-layer-cell__blocker[data-active="1"] {
      display: block;
    }
    .dba-layer-cell__blocker::before {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 72%;
      border-top: 3px solid rgba(70, 70, 70, 0.88);
      transform: translate(-50%, -50%) rotate(-28deg);
      pointer-events: none;
    }

    .dba-own-capital-attack-disabled {
      color: #666 !important;
      background: #bfbfbf !important;
      border-color: #777 !important;
      cursor: not-allowed !important;
      filter: grayscale(1);
      opacity: 1 !important;
      box-shadow: none !important;
    }

    /* ===== 現在地セルを指し示すSVGマーカー ===== */
    .dba-layer-cell[data-dba-current-marker="1"]::before {
      content: "";
      position: absolute;
      left: 50%;
      top: -38%;
      width: 58%;
      height: 58%;
      transform: translateX(-50%);
      pointer-events: none;
      user-select: none;
      z-index: 4;
      background-repeat: no-repeat;
      background-position: center top;
      background-size: contain;
      filter: var(--dba-current-marker-filter);
      background-image: var(--dba-current-marker-image);
    }

    .dba-layer-cell[data-dba-capital-crown="1"]::after {
      content: "??";
      position: absolute;
      right: 2px;
      bottom: 1px;
      font-size: 1.6em;
      line-height: 1.6;
      pointer-events: none;
      user-select: none;
      z-index: 2;
      text-shadow:
        0 0 8px rgba(0,0,0,0.8),
        0 0 8px rgba(0,0,0,0.8);
    }

    /* ===== バトルマップ直下の情報テーブル（2連table）の共通化
       RB / HC / ラダーで、マップ直下の2表ブロックだけを狙って
       レイアウト・余白・文字サイズ・見た目を統一する ===== */
    .gridCanvasOuter + div[style*="display:inline-flex"],
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] {
      display: flex !important;
      align-items: stretch !important;
      justify-content: center !important;
      gap: 10px;
      flex-wrap: wrap !important;
      width: min(100%, 680px);
      max-width: 100%;
      margin: 8px auto 0 !important;
      padding: 0 6px;
      box-sizing: border-box;
    }
    .gridCanvasOuter + div[style*="display:inline-flex"] > table,
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table {
      align-self: stretch !important;
      flex: 1 1 320px !important;
      width: min(100%, 330px);
      min-width: 0 !important;
      max-width: 100%;
      margin: 0 !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      table-layout: fixed;
      background: #ffffff;
      border: 1px solid #cfcfcf !important;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      font-size: 0.95em;
      line-height: 1.35;
    }

    .gridCanvasOuter + div[style*="display:inline-flex"] > table thead tr,
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table thead tr {
      background: #f7f7f7 !important;
    }
    .gridCanvasOuter + div[style*="display:inline-flex"] > table tbody tr:nth-child(even),
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table tbody tr:nth-child(even) {
      background: #fcfcfc !important;
    }

    .gridCanvasOuter + div[style*="display:inline-flex"] > table th,
    .gridCanvasOuter + div[style*="display:inline-flex"] > table td,
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table th,
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table td {
      min-width: 0 !important;
      padding: 6px 8px !important;
      box-sizing: border-box;
      overflow-wrap: anywhere;
      word-break: break-word;
      text-align: center !important;
      font-size: 0.95em;
      line-height: 1.35;
      border: 0 !important;
      border-bottom: 1px solid #e7e7e7 !important;
      background-clip: padding-box;
    }
    .gridCanvasOuter + div[style*="display:inline-flex"] > table tr:last-child td,
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table tr:last-child td {
      border-bottom: 0 !important;
    }
    .gridCanvasOuter + div[style*="display:inline-flex"] > table th,
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table th {
      font-weight: 800;
      color: #222;
      background: #f7f7f7 !important;
      white-space: normal !important;
    }

    /* 1つ目の「保有地域数」テーブル */
    .gridCanvasOuter + div[style*="display:inline-flex"] > table:first-child th:nth-child(1),
    .gridCanvasOuter + div[style*="display:inline-flex"] > table:first-child td:nth-child(1),
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table:first-child th:nth-child(1),
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table:first-child td:nth-child(1) {
      width: 4.4em;
      max-width: 4.4em;
      white-space: nowrap !important;
    }
    .gridCanvasOuter + div[style*="display:inline-flex"] > table:first-child th:nth-child(2),
    .gridCanvasOuter + div[style*="display:inline-flex"] > table:first-child td:nth-child(2),
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table:first-child th:nth-child(2),
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table:first-child td:nth-child(2) {
      width: auto;
      white-space: normal !important;
    }
    .gridCanvasOuter + div[style*="display:inline-flex"] > table:first-child th:nth-child(3),
    .gridCanvasOuter + div[style*="display:inline-flex"] > table:first-child td:nth-child(3),
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table:first-child th:nth-child(3),
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table:first-child td:nth-child(3) {
      width: 8.4em;
      max-width: 8.4em;
      white-space: nowrap !important;
    }

    /* 2つ目の「戦闘強度」テーブル */
    .gridCanvasOuter + div[style*="display:inline-flex"] > table:last-child th:nth-child(1),
    .gridCanvasOuter + div[style*="display:inline-flex"] > table:last-child td:nth-child(1),
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table:last-child th:nth-child(1),
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table:last-child td:nth-child(1) {
      width: auto;
      white-space: normal !important;
    }
    .gridCanvasOuter + div[style*="display:inline-flex"] > table:last-child th:nth-child(2),
    .gridCanvasOuter + div[style*="display:inline-flex"] > table:last-child td:nth-child(2),
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table:last-child th:nth-child(2),
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table:last-child td:nth-child(2) {
      width: 6em;
      max-width: 6em;
      white-space: nowrap !important;
    }

    @media (max-width: 640px) {
      .gridCanvasOuter + div[style*="display:inline-flex"],
      div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] {
        width: 100%;
        gap: 8px;
        padding: 0 4px;
      }
      .gridCanvasOuter + div[style*="display:inline-flex"] > table,
      div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table {
        flex-basis: 100% !important;
        width: 100%;
      }
      .gridCanvasOuter + div[style*="display:inline-flex"] > table th,
      .gridCanvasOuter + div[style*="display:inline-flex"] > table td,
      div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table th,
      div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] > table td {
        padding: 5px 6px !important;
        font-size: 0.92em;
      }
    }

    /* ===== ハードコア / ラダー：巨大マップが上下の領域へ潜り込む問題の抑制 =====
        元ページ側は「display:flex; justify-content:center; align-items:center; height:70svh; ...」
        の固定高コンテナ内に .grid を置いているため、セル数やセルサイズが大きいと
        .grid がコンテナからはみ出し、上の fnbar や下の table に重なりやすい。
        ここでは HC / ラダー系のそのコンテナだけを「自動高＋上寄せ」に変えて、
        マップが大きい時は外枠ごと自然に伸びるようにする。 */
    p[style*="text-align:center"][style*="margin:0 auto;"] {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
    }
    p[style*="text-align:center"][style*="margin:0 auto;"] > div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] {
      width: 100%;
      height: auto !important;
      min-height: min(70svh, calc(100svh - var(--dba-fn-height) - 160px));
      padding: 12px 8px;
      box-sizing: border-box;
      align-items: flex-start !important;
      overflow: visible !important;
    }
    p[style*="text-align:center"][style*="margin:0 auto;"] > div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"]  .grid {
      flex: 0 0 auto;
      margin: 0 auto;
    }
    p[style*="text-align:center"][style*="margin:0 auto;"] > div[style*="display:inline-flex"],
    div[style*="display: flex"][style*="justify-content: center"][style*="align-items: center"][style*="background-color: #f0f0f0"] + div[style*="display:inline-flex"] {
      flex-wrap: wrap !important;
      justify-content: center !important;
      align-items: flex-start !important;
      max-width: 100%;
      margin-top: 0 !important;
    }

    /* 汎用ボタン（機能系ボタン共通） */
    .dba-btn-fn {
      appearance: none;
      min-height: 3em;
      margin:4px;
      padding: 4px 6px;
      border: 2px solid #000;
      border-radius: 12px;
      background: #f08800;
      color: #fff;
      font-size: 1em;
      font-weight: 500;
      line-height: 1.1em;
      cursor: pointer;
      user-select: none;
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
      transition: transform 0.05s ease, box-shadow 0.15s ease, background 0.15s ease;
      white-space: normal;
      text-align: center;
    }
    /* ラピッド攻撃：ON状態の視認性 */
    .dba-btn-fn[data-on="1"] {
      background: #33a033;
      color: #fff;
    }
    .dba-btn-fn:hover {
      background: #0000e0;
      box-shadow: 0 2px 6px rgba(0,0,0,0.16);
    }
    /* ON状態hoverは“青”に上書きされないようにする */
    .dba-btn-fn[data-on="1"]:hover {
      background: #2a8c2a;
    }
    .dba-btn-fn:active {
      transform: translateY(1px);
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
    }
    .dba-btn-fn:focus {
      outline: 2px solid #ea0000;
      outline-offset: 2px;
    }
    /* ===== ファンクションボタン用ホバーヒント ===== */
    #dba-fn-tooltip {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 1000001; /* fnbar(999999)より上 */
      display: none;
      font-size: calc(var(--dba-base-font-size) * 0.95);
      max-width: min(320px, calc(100vw - 24px));
      padding: 8px 10px;
      border: 2px solid #000;
      border-radius: 12px;
      background: rgba(255, 255, 225, 0.98);
      color: #111;
      font-weight: 700;
      line-height: 1.35;
      white-space: pre-line;
      box-shadow: 0 6px 18px rgba(0,0,0,0.28);
      pointer-events: none;
      user-select: none;
    }
    #dba-fn-tooltip[data-open="1"] {
      display: block;
    }
    #dba-fn-tooltip::after {
      content: "";
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: -10px;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 10px solid rgba(255, 255, 225, 0.98);
      filter: drop-shadow(0 1px 0 #000);
    }
    #dba-fn-tooltip[data-pos="below"]::after {
      top: -10px;
      bottom: auto;
      border-top: none;
      border-bottom: 10px solid rgba(255, 255, 225, 0.98);
    }
    /* ===== モーダル（標準） ===== */
    .dba-m-std {
      border: 4px solid #080;
      border-radius: 12px;
      padding: 0;
      margin: auto;
      font-size: var(--dba-base-font-size);
      width: min(640px, 100svw);
      max-height: min(80svh, calc(100svh));
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden;
      background: #f8f8f8;
      color: #111;
      box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    }
    .dba-m-std:not([open]) {
      display: none !important;
    }
    .dba-m-std::backdrop {
      background: rgba(0,0,0,0.55);
    }
    .dba-m-std .dba-modal__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      border-bottom: 1px solid #000;
      background: #f0f0f0;
    }
    .dba-m-std .dba-modal__title {
      font-size: 1.25em;
      font-weight: 700;
      margin: 0;
      padding: 0;
    }
    .dba-m-std .dba-modal__mid {
      flex: 1 1 auto;
      min-height: 0;
      padding: 12px;
      overflow: auto;
      max-height: calc(min(80svh, calc(100svh - 24px)) - 110px);
    }
    .dba-m-std .dba-modal__bot {
      display: flex;
      flex: 0 0 auto;
      justify-content: center;
      gap: 10px;
      padding: 12px 12px 16px;
      min-height: 72px;
      box-sizing: border-box;
      overflow: visible;
      border-top: 1px solid #000;
      background: #f0f0f0;
    }

    /* ===== セル詳細モーダル（サイズ最適化） ===== */
    #dba-m-cell-detail.dba-m-std {
      width: min(760px, calc(100vw - 24px));
      max-height: min(88svh, calc(100svh - 24px));
    }
    #dba-m-cell-detail.dba-m-std .dba-modal__mid {
      /* 標準(80svh)の計算を、セル詳細(88svh)に合わせて上書き */
      max-height: calc(min(88svh, calc(100svh - 24px)) - 110px);
    }

    /* ===== 戦闘結果モーダル（サイズ最適化 + スクロール） ===== */
    #dba-m-battle-result.dba-m-std {
      width: min(820px, calc(100vw - 24px));
      /* 長い時はここで上限、短い時は content に合わせて自然に縮む */
      max-height: min(88svh, calc(100svh - 24px));
      /* スクロールは mid のみに限定（dialog全体にはスクロールを出さない） */
      overflow: hidden;
    }

    /* 戦闘結果モーダル：トップ欄を「左=タイトル / 中央=チェック / 右=×」にする */
    #dba-m-battle-result.dba-m-std .dba-modal__top {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      column-gap: 10px;
    }
    #dba-m-battle-result.dba-m-std .dba-modal__title {
      justify-self: start;
    }
    .dba-br-top-center {
      justify-self: center;
      display: inline-flex;
      align-items: center;
    }

    /* 戦闘結果：オプションボタン */
    .dba-br-btn-opt {
      appearance: none;
      border: 2px solid #000;
      border-radius: 10px;
      padding: 6px 10px;
      margin: 0;
      font-size: 0.95em;
      font-weight: 800;
      cursor: pointer;
      user-select: none;
      background: #eee;
      color: #000;
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
    }
    .dba-br-btn-opt:hover { filter: brightness(0.97); }
    .dba-br-btn-opt:active { transform: translateY(1px); }

    /* 戦闘結果：クリック透過モード（Close/Option以外は透過） */
    #dba-m-battle-result.dba-m-std.dba-br-pass {
      opacity: 0.55;
      pointer-events: none; /* 基本はクリックを下に通す */
    }
    /* 透過中でも「Close」「オプション」だけはクリック可 */
    #dba-m-battle-result.dba-m-std.dba-br-pass #dba-br-btn-option,
    #dba-m-battle-result.dba-m-std.dba-br-pass .dba-btn-close {
      pointer-events: auto;
    }
    /* ★透過中でも Close/Option は不透過（親opacityの影響を打ち消す） */
    #dba-m-battle-result.dba-m-std.dba-br-pass #dba-br-btn-option,
    #dba-m-battle-result.dba-m-std.dba-br-pass .dba-btn-close {
      opacity: 1 !important;
      filter: none !important;
    }
    /* 透過中は × を完全に消す（見た目＋クリック判定なし） */
    #dba-m-battle-result.dba-m-std.dba-br-pass .dba-btn-x {
      display: none !important;
    }

    /* ===== 戦闘結果：透過ON時の表示は dialog を使わずフロートパネルで表示 ===== */
    #dba-br-float {
      position: fixed;
      top: calc(var(--dba-fn-height) + 0px);  /* フロートパネルの表示位置（高さ） */
      left: 12px;
      right: 12px;
      margin: 0 auto;
      font-size: var(--dba-base-font-size);
      width: min(360px, calc(100vw - 24px));
      max-height: min(88svh, calc(100svh - 24px));
      border: 4px solid #080;
      border-radius: 12px;
      padding: 0;
      background: rgba(248,248,248,0.55); /* 半透明 */
      color: #111;
      box-shadow: 0 12px 40px rgba(0,0,0,0.25);
      z-index: 999995; /* fnbar(999999)より下、マップより上 */
      display: none;
      overflow: hidden;
      pointer-events: none; /* まずは全体を透過 */
    }
    #dba-br-float[data-open="1"] { display: block; }
    #dba-br-float .dba-modal__top,
    #dba-br-float .dba-modal__mid,
    #dba-br-float .dba-modal__bot {
      pointer-events: none; /* パネル自体は透過（ボタンのみ例外） */
    }
    #dba-br-float #dba-br-float-btn-option,
    #dba-br-float .dba-btn-close {
      pointer-events: auto; /* Option/Closeだけ押せる */
      opacity: 1 !important; /* 不透過 */
    }
    /* フロート内は × は表示しない（透過要件に合わせる） */
    #dba-br-float .dba-btn-x { display:none !important; }
    #dba-br-float .dba-modal__mid {
      overflow: auto;
      max-height: calc(min(88svh, calc(100svh - 24px)) - 110px);
      scrollbar-gutter: stable both-edges;
    }
    #dba-br-float .dba-modal__mid[data-dba-wheel-scrollable="1"] {
      overscroll-behavior: contain;
    }

    #dba-m-battle-result.dba-m-std .dba-modal__mid {
      /* 常にスクロール可能（短い時はスクロールは出ない） */
      overflow: auto;
      /* 上限は max-height で決まる。短文なら高さは自然に小さくなる */
      max-height: calc(min(88svh, calc(100svh - 24px)) - 110px);
      /* スクロールバーを見やすく（OS依存だが効く環境では効く） */
      scrollbar-gutter: stable both-edges;
    }

    /* 戦闘結果テキストをそのまま読みやすく表示 */
    .dba-battle-result-text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
      line-height: 1.25em;
      font-weight: 600;
      font-size: 0.98em;
      text-align: left; /* 戦闘結果は左寄せ */
    }

    /* ===== モーダル（アラート） ===== */
    .dba-m-alert {
      border: 4px solid #e00;
      border-radius: 12px;
      padding: 0;
      margin: auto;
      font-size: var(--dba-base-font-size);
      width: min(420px, calc(100vw - 24px));
      background: #f0f0cc;
      color: #000;
      box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    }
    .dba-m-alert:not([open]) {
      display: none !important;
    }
    .dba-m-alert::backdrop {
      background: rgba(0,0,0,0.55);
    }
    .dba-m-alert .dba-alert__title,
    .dba-m-alert .dba-modal__top {
      padding: 10px 12px;
      border-bottom: 1px solid #000;
      background: #f0f0e0;
      text-align: left;
    }
    .dba-m-alert .dba-alert__title,
    .dba-m-alert .dba-modal__title {
      font-size: 1.2em;
      font-weight: 800;
      line-height: 1.2em;
    }
    .dba-m-alert .dba-alert__mid,
    .dba-m-alert .dba-modal__mid {
      padding: 14px 12px;
      font-size: 1.15em;
      font-weight: 700;
      line-height: 1.3em;
      white-space: pre-wrap;
      text-align: left;
    }
    .dba-m-alert .dba-alert__bot,
    .dba-m-alert .dba-modal__bot {
      display: flex;
      justify-content: center;
      gap: 10px;
      padding: 10px 12px;
      border-top: 1px solid #000;
      background: #f0f0e0;
    }

    /* ===== モーダル用ボタン（標準化） ===== */
    .dba-btn-ok,
    .dba-btn-apply,
    .dba-btn-del,
    .dba-btn-close,
    .dba-btn-x {
      appearance: none;
      width: fit-content;
      border: 2px solid #000;
      border-radius: 12px;
      margin: 4px 8px;
      padding: 10px 16px;
      font-size: 1em;
      font-weight: 600;
      line-height: 1.1em;
      cursor: pointer;
      user-select: none;
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
      transition: transform 0.05s ease, box-shadow 0.15s ease, filter 0.15s ease;
      background: #f00;
      color: #fff;
    }
    .dba-btn-ok:hover,
    .dba-btn-apply:hover,
    .dba-btn-del:hover,
    .dba-btn-close:hover,
    .dba-btn-x:hover {
      filter: brightness(0.97);
      box-shadow: 0 2px 6px rgba(0,0,0,0.16);
    }
    .dba-btn-ok:active,
    .dba-btn-apply:active,
    .dba-btn-del:active,
    .dba-btn-close:active,
    .dba-btn-x:active {
      transform: translateY(1px);
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
    }
    .dba-btn-ok {
      background: #3399ee;
      color: #fff;
      }
    .dba-btn-apply {
      background: #50aa50;
      color: #fff;
      }
    .dba-btn-del {
      background: #d02f2f;
      color: #fff;
      }
    .dba-btn-close {
      background: #ea4a4a;
      color: #fff;
      }
    .dba-btn-x {
      width: 34px;
      height: 34px;
      padding: 0;
      border-radius: 999px;
      background: #e02222;
      color: #fff;
      font-size: 1.4rem;
      line-height: 1.4rem;
    }
    .dba-btn-mini {
      appearance: none;
      border: 2px solid #000;
      border-radius: 10px;
      padding: 10px 6px;
      margin: 0 0 0 6px;
      font-size: 0.95em;
      font-weight: 700;
      cursor: pointer;
      user-select: none;
      background: #eee;
      color: #000;
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
    }
    .dba-btn-mini:hover { filter: brightness(0.97); }
    .dba-btn-mini:active { transform: translateY(1px); }
    .dba-btn-mini--danger { background:#f3d0d0; }
    .dba-btn-mini--ok { background:#cfe3ff; }


    /* ===== 「設定」modal ===== */
    .dba-setting-row {
      display: block;
      margin: 0 0 12px 0;
      padding: 8px 12px;
      border: 1px solid #00000022;
      border-radius: 10px;
      background: #fff;
      box-sizing: border-box;
    }
    .dba-setting-row label {
      text-align: left;
      font-weight: 700;
    }
    .dba-setting-row-sub {
      display: block;
      margin: 0 0 0 30px;
      padding: 8px 12px;
      border: 1px solid #00000022;
      border-radius: 10px;
      background: #fff;
      box-sizing: border-box;
    }
    .dba-setting-checkline {
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      gap: 8px;
      text-align: left;
      font-weight: 700;
      cursor: pointer;
    }
    .dba-setting-checktext {
      display: block;
      min-width: 0;
      flex: 1 1 auto;
      line-height: 1.4;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }
    .dba-setting-subgroup {
      margin-top: 8px;
      margin-left: 26px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .dba-setting-subgroup .dba-setting-checkline {
      font-weight: 600;
    }
    .dba-setting-subgroup .dba-setting-checktext {
      line-height: 1.35;
    }
    .dba-setting-row input[type="number"] {
      width: 60px;
      box-sizing: border-box;
      padding: 4px 6px;
      border: 1px solid #00000055;
      border-radius: 10px;
      font-size: 1em;
      text-align: right;
    }
    .dba-setting-row input[type="range"] {
      width: 100%;
      box-sizing: border-box;
    }
    .dba-setting-block-title {
      text-align: left;
      font-size: 1em;
      font-weight: 700;
      margin: 0 0 8px 0;
    }
    .dba-setting-deflist {
      display: grid;
      grid-template-columns: 8em 1fr;
      gap: 6px 10px;
      margin: 0;
      text-align: left;
      align-items: start;
    }
    .dba-setting-deflist dt {
      margin: 0;
      font-weight: 700;
    }
    .dba-setting-deflist dd {
      margin: 0;
      font-weight: 400;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .dba-setting-cellsize-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .dba-setting-cellsize-line {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      justify-content: flex-start;
      gap: 4px;
      text-align: left;
      white-space: nowrap;
    }
    .dba-setting-cellsize-name {
      width:11em;
      font-weight: 700;
      text-align: left;
      white-space: wrap;
    }
    .dba-setting-cellsize-unit {
      white-space: nowrap;
    }
    .dba-setting-cellsize-sep {
      white-space: nowrap;
      margin: 0 2px;
    }

    .dba-setting-radio-group {
      margin: 0 0 0 30px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 18px;
      flex-wrap: wrap;
      text-align: left;
    }
    .dba-setting-radio-line {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      font-weight: 700;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    .dba-setting-radio-line input[type="radio"] {
      margin: 0;
      width: 18px;
      height: 18px;
      cursor: pointer;
      flex: 0 0 auto;
    }

    /* ===== 装備ロスター ===== */
    #dba-m-roster.dba-m-std {
      width: min(920px, calc(100vw - 24px));
      max-height: min(88svh, calc(100svh - 24px));
      overflow: hidden;
    }
    #dba-m-roster.dba-m-std .dba-modal__mid {
      max-height: calc(min(88svh, calc(100svh - 24px)) - 110px);
      overflow: hidden; /* mid全体はスクロールさせず、内部のリストだけをスクロール */
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
    }
    #dba-roster-box {
      display: flex;
      flex-direction: column;
      gap: 0;
      flex: 1 1 auto;
      min-height: 0;
    }
    .dba-roster-head {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
      border-bottom: 2px solid #999999;
      padding-bottom: 8px;
    }
    .dba-roster-title {
      font-size: 1.15em;
      font-weight: 800;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dba-roster-head-btns {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .dba-btn-progress-mini {
      appearance: none;
      width: 4.5em !important;
      border: 2px solid #000;
      border-radius: 10px;
      padding: 6px 2px !important;
      margin: 0 0 0 6px;
      font-size: 0.95em;
      font-weight: 700;
      cursor: pointer;
      user-select: none;
      background: #eee;
      color: #000;
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
    }
    .dba-btn-progress-mini:hover { filter: brightness(0.97); }
    .dba-btn-progress-mini:active { transform: translateY(1px); }

    .dba-roster-row2 {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: flex-start;
      margin: 10px 0;
      flex: 0 0 auto;
    }
    .dba-roster-list {
      border: 1px solid #000;
      border-radius: 12px;
      background: #fff;
      padding: 8px;
      overflow: auto;
      position: relative;
      flex: 1 1 auto;
      min-height: 0;
      max-height: none;
      scrollbar-gutter: stable both-edges;
      overscroll-behavior: contain;
      overscroll-behavior-y: contain;
      -webkit-overflow-scrolling: touch;
    }
    .dba-roster-list--insertpick {
      touch-action: pan-y;
    }
    .dba-roster-list--insertpick .dba-roster-item {
      cursor: default;
    }
    .dba-roster-insert-line {
      position: absolute;
      left: 6px;
      right: 6px;
      height: 0;
      border-top: 4px solid #ea0000;
      border-radius: 999px;
      pointer-events: none;
      z-index: 5;
      display: none;
    }
    .dba-roster-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid #00000022;
      margin: 6px 0;
      cursor: pointer;
      user-select: none;
    }
    .dba-roster-item:hover { background: #f7f7f7; }
    .dba-roster-item[data-selected="1"] {
      outline: 3px solid #ea0000;
      outline-offset: 0px;
      background: #fff2f2;
    }
    .dba-roster-item__name {
      font-weight: 800;
      text-align: left;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .dba-roster-item__meta {
      font-size: 0.9em;
      font-weight: 700;
      opacity: 0.9;
      display: grid;
      grid-template-columns: repeat(3, max-content);
      gap: 2px 10px;
      align-items: center;
      justify-items: end;
      text-align: right;
      white-space: nowrap;
    }
    .dba-preset-meta__part {
      display: block;
    }

    .dba-roster-item__actions {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 8px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #00000022;
    }
    .dba-roster-item__actions .dba-btn-mini {
      width: 100%;
      margin: 0;
      padding: 10px 12px;
      text-align: center;
      box-sizing: border-box;
    }
    .dba-roster-item__actions .dba-btn-mini--cancel {
      background: #f3d0d0;
    }

    /* 装備変更結果（ロスター）テキスト表示 */
    .dba-roster-result-text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
      line-height: 1.25em;
      font-weight: 600;
      font-size: 0.98em;
      text-align: left;
    }

    /* ===== プリセット並び替えモーダル ===== */
    #dba-m-roster-sort.dba-m-std {
      width: min(760px, calc(100vw - 24px));
      max-height: min(88svh, calc(100svh - 24px));
      overflow: hidden;
    }
    #dba-m-roster-sort.dba-m-std .dba-modal__mid {
      max-height: calc(min(88svh, calc(100svh - 24px)) - 110px);
      overflow: hidden; /* リスト側でスクロール */
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
    }
    .dba-sort-hint {
      font-weight: 800;
      text-align: left;
      margin: 0;
      padding: 0;
    }
    .dba-sort-list {
      border: 1px solid #000;
      border-radius: 12px;
      background: #fff;
      padding: 8px;
      overflow: auto;
      min-height: 120px;
      max-height: 52svh; /* 画面が小さい時も暴れにくく */
      scrollbar-gutter: stable both-edges;
      position: relative; /* 挿入ラインの absolute 基準 */
    }
    /* 挿入予定位置の赤いライン */
    .dba-sort-insert-line {
      position: absolute;
      left: 6px;
      right: 6px;
      height: 0;
      border-top: 4px solid #ea0000;
      border-radius: 999px;
      pointer-events: none;
      z-index: 5;
      display: none;
    }
    .dba-sort-item {
      display: grid;
      grid-template-columns: 28px 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid #00000022;
      margin: 6px 0;
      user-select: none;
      background: #fff;
    }
    .dba-sort-handle {
      font-weight: 900;
      text-align: center;
      cursor: grab;
      opacity: 0.9;
    }
    .dba-sort-item[draggable="true"] { cursor: grab; }
    .dba-sort-item.dba-sort-dragging {
      opacity: 0.55;
      border-style: dashed;
    }
    .dba-sort-item.dba-sort-over {
      outline: 3px solid #ea0000;
      outline-offset: 0px;
      background: #fff2f2;
    }
    .dba-sort-name {
      font-weight: 900;
      text-align: left;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .dba-sort-meta {
      font-size: 0.9em;
      font-weight: 800;
      opacity: 0.85;
      display: grid;
      grid-template-columns: repeat(3, max-content);
      gap: 2px 10px;
      align-items: center;
      justify-items: end;
      text-align: right;
      white-space: nowrap;
    }

    @media (max-width: 720px) {
      .dba-roster-item {
        grid-template-columns: minmax(0, 1fr);
        align-items: start;
      }
      .dba-roster-item__meta {
        grid-template-columns: 1fr;
        justify-items: start;
        text-align: left;
      }
      .dba-roster-item__actions {
        grid-template-columns: 1fr;
      }

      .dba-sort-item {
        grid-template-columns: 28px minmax(0, 1fr);
        align-items: start;
      }
      .dba-sort-handle {
        grid-column: 1;
        grid-row: 1;
      }
      .dba-sort-name {
        grid-column: 2;
        grid-row: 1;
      }
      .dba-sort-meta {
        grid-column: 1 / -1;
        grid-row: 2;
        grid-template-columns: 1fr;
        justify-items: start;
        text-align: left;
        padding-left: 38px;
      }
    }

    /* ===== 装備プリセット追加モーダル ===== */
    #dba-m-roster-add.dba-m-std {
      width: min(760px, calc(100vw - 24px));
      max-height: min(88svh, calc(100svh - 24px));
      overflow: hidden;
    }
    #dba-m-roster-add.dba-m-std .dba-modal__mid {
      max-height: calc(min(88svh, calc(100svh - 24px)) - 110px);
      overflow: auto;
    }
    /* ===== 装備プリセット再編集モーダル ===== */
    #dba-m-roster-edit.dba-m-std {
      width: min(760px, calc(100vw - 24px));
      max-height: min(88svh, calc(100svh - 24px));
      overflow: hidden;
    }
    #dba-m-roster-edit.dba-m-std .dba-modal__mid {
      max-height: calc(min(88svh, calc(100svh - 24px)) - 110px);
      overflow: auto;
    }
    .dba-add-wrap {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 10px;
      align-items: start;
    }
    .dba-add-left {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: stretch;
    }
    .dba-add-right {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: stretch;
    }
    .dba-add-sel {
      border: 1px solid #000;
      border-radius: 12px;
      background: #fff;
      padding: 8px 10px;
      min-height: 2.4em;
      font-weight: 700;
      text-align: left;
      overflow-wrap: anywhere;
    }
    .dba-add-name {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border: 2px solid #000;
      border-radius: 12px;
      font-size: 1em;
      font-weight: 700;
    }
    .dba-add-bot {
      display: flex;
      gap: 12px;
      justify-content: flex-start;
      align-items: center;
      margin-top: 10px;
    }

    /* ===== アイテム選択（バッグ表） ===== */
    #dba-m-pick-item.dba-m-std {
      width: min(1100px, calc(100vw - 24px));
      max-height: min(90svh, calc(100svh - 24px));
      overflow: hidden;
    }
    #dba-m-pick-item.dba-m-std .dba-modal__mid {
      max-height: calc(min(90svh, calc(100svh - 24px)) - 110px);
      overflow: auto;
    }
    .dba-pick-hint {
      font-weight: 700;
      margin: 0 0 10px 0;
      text-align: left;
    }

    /* ===== アイテム選択：レアリティフィルタ ===== */
    .dba-pick-filterbar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-start;
      margin: 0 0 10px 0;
      padding: 8px 10px;
      border: 1px solid #000;
      border-radius: 12px;
      background: #fff;
    }
    .dba-pick-filterbtn {
      appearance: none;
      border: 2px solid #000;
      border-radius: 10px;
      padding: 6px 10px;
      margin: 0;
      font-size: 0.95em;
      font-weight: 800;
      cursor: pointer;
      user-select: none;
      background: #eee;
      color: #000;
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
    }
    .dba-pick-filterbtn:hover { filter: brightness(0.97); }
    .dba-pick-filterbtn:active { transform: translateY(1px); }
    .dba-pick-filterbtn[data-active="1"] {
      outline: 3px solid #ea0000;
      outline-offset: 0px;
      background: #fff2f2;
    }
    .dba-pick-filterbtn--all { background:#e8e8e8; }
    .dba-pick-filterbtn--n { background:#ffffff; }
    .dba-pick-filterbtn--r { background:#3fa435; color:#fff; }
    .dba-pick-filterbtn--sr { background:#2175d9; color:#fff; }
    .dba-pick-filterbtn--ssr { background:#a633d6; color:#fff; }
    .dba-pick-filterbtn--ur { background:#f45d01; color:#fff; }

    /* ===== アイテム選択：MOD 0 フィルタ ===== */
    .dba-pick-filterchk {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-start;
      font-weight: 800;
      user-select: none;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 10px;
      border: 1px solid #00000022;
      background: #fafafa;
    }
    .dba-pick-filterchk[data-disabled="1"] {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .dba-pick-filterchk[data-disabled="1"] input {
      cursor: not-allowed;
    }

    .dba-pick-row-selected {
      /* tr 自体に背景が乗らない実装もあるため、td 側も別途指定する */
      background: rgba(255,0,0,0.22) !important;
      outline: 3px solid rgba(255,0,0,0.75) !important;
      outline-offset: -2px !important;
    }
    /* 多くのテーブルは td に背景が乗っているため、td にも強制適用する */
    .dba-pick-row-selected > td,
    .dba-pick-row-selected > th {
      background: rgba(255,0,0,0.22) !important;
      /* “赤いフィルタ”っぽく見せるため、内側に薄赤のシェードも追加 */
      box-shadow: inset 0 0 0 9999px rgba(255,0,0,0.10) !important;
    }
    /* クリック対象が a 等でも選択が分かりやすいように */
    .dba-pick-row-selected a {
      color: #000 !important;
      font-weight: 800;
    }
    .dba-backup-textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 240px;
      resize: vertical;
      padding: 10px 12px;
      border: 2px solid #000;
      border-radius: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 0.95em;
      line-height: 1.25em;
    }
    /* ===== 装備ロスター：オプション ===== */
    #dba-m-roster-option.dba-m-std {
      width: min(720px, calc(100vw - 24px));
      max-height: min(88svh, calc(100svh - 24px));
      overflow: hidden;
      margin: calc(var(--dba-fn-height) + 12px) auto auto;
    }
    #dba-m-roster-option.dba-m-std .dba-modal__mid {
      max-height: calc(min(88svh, calc(100svh - 24px)) - 110px);
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
      justify-content: flex-start;
      align-items: stretch;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }
    .dba-roster-opt-section {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin: 0 0 8px 0;
      padding: 12px 12px;
      border: 1px solid #00000022;
      border-radius: 12px;
      background: #fff;
      box-sizing: border-box;
      align-items: stretch;
      justify-content: flex-start;
    }
    .dba-roster-opt-section__title {
      margin: 0;
      padding: 0 0 8px 0;
      border-bottom: 1px solid #00000022;
      font-size: 1.02em;
      font-weight: 800;
      text-align: left;
      line-height: 1.35;
    }
    .dba-roster-opt-section__body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: stretch;
      justify-content: flex-start;
      padding: 10px 0 0 0;
      margin: 0;
      min-height: 0;
      box-sizing: border-box;
    }
    .dba-roster-opt-row {
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      gap: 8px;
      margin: 0;
      padding: 0;
      text-align: left;
      font-weight: 700;
      cursor: pointer;
      box-sizing: border-box;
    }
    .dba-roster-opt-row input[type="checkbox"] {
      flex: 0 0 auto;
      margin: 2px 0 0 0;
    }
    .dba-roster-opt-rowtext {
      display: block;
      min-width: 0;
      flex: 1 1 auto;
      line-height: 1.4;
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }
    .dba-roster-opt-note {
      margin: 0 0 0 24px;
      padding: 0;
      font-size: 0.92em;
      font-weight: 600;
      line-height: 1.45;
      text-align: left;
      color: #333;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .dba-roster-opt-radio-group {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 18px;
      flex-wrap: wrap;
      margin: 0;
      padding: 0;
      text-align: left;
    }
    .dba-roster-opt-radio-line {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      font-weight: 700;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    .dba-roster-opt-radio-line input[type="radio"] {
      margin: 0;
      width: 18px;
      height: 18px;
      cursor: pointer;
      flex: 0 0 auto;
    }
    .dba-roster-opt-btngrid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
      align-items: stretch;
    }
    .dba-roster-opt-btngrid .dba-btn-mini {
      width: 100%;
      min-height: 44px;
      margin: 0;
      padding: 10px 12px;
      text-align: center;
      box-sizing: border-box;
    }
    @media (max-width: 640px), (pointer: coarse) {
      #dba-m-roster-option.dba-m-std {
        position: fixed;
        left: 8px;
        right: 8px;
        top: calc(var(--dba-fn-height) + 8px);
        bottom: 8px;
        width: auto;
        height: auto;
        max-height: none;
        margin: 0;
      }
      #dba-m-roster-option.dba-m-std .dba-modal__mid {
        flex: 1 1 auto;
        max-height: none;
        min-height: 0;
      }
      .dba-roster-opt-btngrid {
        grid-template-columns: 1fr;
      }
    }
    /* ===== 装備ロスター：バックアップ直接編集 ===== */
    #dba-m-roster-backup-editor.dba-m-std {
      width: min(1040px, calc(100vw - 16px));
      height: min(94svh, calc(100svh - 16px));
      max-height: min(94svh, calc(100svh - 16px));
      overflow: hidden;
    }
    #dba-m-roster-backup-editor.dba-m-std .dba-modal__mid {
      flex: 1 1 auto;
      min-height: 0;
      height: auto;
      max-height: none;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 12px;
    }
    #dba-m-roster-backup-editor .dba-backup-textarea {
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
      max-height: none;
      resize: none;
    }
    /* ===== オート装備（候補ポップアップ / 設定） ===== */
    #dba-auto-equip-pop {
      position: fixed;
      z-index: 999998; /* fnbar(999999)より下 */
      display: none;
      font-size: var(--dba-base-font-size);
      min-width: 180px;
      max-width: min(360px, 92vw);
      max-height: min(60svh, 520px);
      overflow: auto;
      border: 2px solid #000;
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 10px 28px rgba(0,0,0,0.25);
      padding: 8px;
      box-sizing: border-box;
    }
    #dba-auto-equip-pop[data-open="1"] { display: block; }
    .dba-ae-pop-title {
      font-weight: 900;
      margin: 0 0 6px 0;
      text-align: left;
    }
    .dba-ae-pop-btn {
      width: 100%;
      text-align: left;
      appearance: none;
      border: 2px solid #000;
      border-radius: 10px;
      padding: 8px 10px;
      margin: 6px 0;
      font-size: 0.98em;
      font-weight: 800;
      cursor: pointer;
      background: #eee;
      color: #000;
    }
    .dba-ae-pop-btn:hover { filter: brightness(0.97); }
    .dba-ae-pop-btn:active { transform: translateY(1px); }

    #dba-m-auto-equip.dba-m-std {
      width: min(980px, calc(100vw - 24px));
      max-height: min(88svh, calc(100svh - 24px));
      overflow: hidden;
    }
    #dba-m-auto-equip.dba-m-std .dba-modal__mid {
      max-height: calc(min(88svh, calc(100svh - 24px)) - 110px);
      /* ★ここが重要：mid全体スクロールを抑止して、内部（左右ゾーン）でスクロールさせる */
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
    }
    @media (max-width: 640px), (pointer: coarse) {
      #dba-m-roster-option.dba-m-std,
      #dba-m-roster-backup-editor.dba-m-std,
      #dba-m-auto-equip.dba-m-std {
        position: fixed;
        left: 8px;
        right: 8px;
        top: calc(var(--dba-fn-height) + 8px);
        bottom: 8px;
        width: auto;
        height: auto;
        max-height: none;
        margin: 0;
      }
      #dba-m-roster-option.dba-m-std .dba-modal__mid,
      #dba-m-roster-backup-editor.dba-m-std .dba-modal__mid,
      #dba-m-auto-equip.dba-m-std .dba-modal__mid {
        flex: 1 1 auto;
        min-height: 0;
        max-height: none;
      }
      #dba-m-roster-option.dba-m-std .dba-modal__mid {
        overflow: auto;
      }
      #dba-m-roster-backup-editor .dba-backup-textarea {
        min-height: 160px;
        height: 100%;
      }
      .dba-roster-opt-btngrid {
        grid-template-columns: 1fr;
      }
    }
    .dba-ae-topbtns {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: flex-start;
      margin: 0 0 10px 0;
    }
    .dba-ae-autoclose {
      margin-left: auto; /* 右寄せ */
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 900;
      user-select: none;
      white-space: nowrap;
      padding: 4px 8px;
      border-radius: 10px;
      border: 1px solid #00000022;
      background: #fafafa;
    }
    .dba-ae-autoclose input[type="number"] {
      width: 72px;
      box-sizing: border-box;
      padding: 6px 8px;
      border: 1px solid #00000055;
      border-radius: 10px;
      font-size: 1em;
      font-weight: 800;
    }
    .dba-ae-tabs {
      display: flex;
      gap: 8px;
      align-items: stretch;
      justify-content: flex-start;
      margin: 10px 0 8px 0;
    }
    .dba-ae-tab {
      flex: 1 1 0;
      appearance: none;
      border: 2px solid #000;
      border-radius: 12px;
      padding: 8px 10px;
      margin: 0;
      font-size: 1em;
      font-weight: 900;
      cursor: pointer;
      background: #e8e8e8;
      color: #000;
    }
    .dba-ae-tab[data-active="1"] {
      outline: 3px solid #ea0000;
      outline-offset: 0px;
      background: #fff2f2;
    }
    .dba-ae-wrap {
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 2px;
      /* ★grid item が縮められるようにする（min-height:auto を避ける） */
      align-items: stretch;
      flex: 1 1 auto;  /* #dba-m-auto-equip .dba-modal__mid（flex）配下で残り領域を占有 */
      min-height: 0;   /* これが無いと子が溢れて mid がスクロールしやすい */
    }
    .dba-ae-leftpane {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 10px;
      align-items: stretch;
      /* ★左ペインも高さが親より大きくならないようにし、溢れは左ペイン内でスクロール */
      overflow: auto;
      width: 100%;
      min-height: 0;
      max-height: 100%;
      scrollbar-gutter: stable both-edges;
    }
    .dba-ae-rpane {
      display: grid;
      grid-template-columns: 1fr 90px 1fr;
      gap: 0;
      align-items: stretch;
      min-height: 0; /* ★子（左右box）が親高さ以内に収まれるように */
    }
    .dba-ae-box {
      border: 1px solid #000;
      border-radius: 8px;
      background: #fff;
      padding: 8px 4px ;
      /* 左右ゾーンは内容が溢れたらゾーン内スクロール */
      overflow: auto;
      /* ★min-height 固定だと親より大きくなって mid がスクロールするので解除 */
      min-height: 0;
      max-height: 100%;
      scrollbar-gutter: stable both-edges;
    }
    .dba-ae-box-title {
      font-weight: 900;
      margin: 0;
      text-align: left;
    }
    .dba-ae-item {
      padding: 8px 6px;
      border-radius: 10px;
      border: 1px solid #00000022;
      margin: 0;
      cursor: pointer;
      user-select: none;
      font-weight: 800;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .dba-ae-item:hover { background:#f7f7f7; }
    .dba-ae-item[data-selected="1"] {
      outline: 3px solid #ea0000;
      outline-offset: 0px;
      background: #fff2f2;
    }
    .dba-ae-midbtns {
      display: flex;
      flex-direction: column;
      /* 中央ゾーン：ボタン間隔 30px */
      gap: 30px;
      align-items: stretch;
      justify-content: center;
      padding: 10px 6px;
    }

    /* ===== オート装備：オプションモーダル ===== */
    .dba-ae-opt-row {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 10px;
      padding: 8px 8px 8px 16px;
      border: 1px solid #00000022;
      border-radius: 12px;
      background: #fff;
      margin: 10px 0;
      font-weight: 800;
      text-align: left;
    }
    #dba-ae-opt-autoclose-sec {
      margin: 0 2px;
      width: 5em;
      height: 1.8em;
      text-align: center;
    }

    /* ===== 装備ロスター：ロスター切替ポップアップ（ボタン近く） ===== */
    #dba-roster-switch-pop {
      position: fixed;
      z-index: 999998; /* fnbar(999999)より下 */
      display: none;
      font-size: var(--dba-base-font-size);
      min-width: 220px;
      max-width: min(420px, 92vw);
      max-height: min(60svh, 520px);
      overflow: auto;
      border: 2px solid #000;
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 10px 28px rgba(0,0,0,0.25);
      padding: 8px;
      box-sizing: border-box;
    }
    #dba-roster-switch-pop[data-open="1"] { display: block; }
    .dba-rs-pop-title {
      font-weight: 900;
      margin: 0 0 6px 0;
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dba-rs-pop-btn {
      width: 100%;
      text-align: left;
      appearance: none;
      border: 2px solid #000;
      border-radius: 10px;
      padding: 8px 10px;
      margin: 6px 0;
      font-size: 0.98em;
      font-weight: 800;
      cursor: pointer;
      background: #eee;
      color: #000;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dba-rs-pop-btn:hover { filter: brightness(0.97); }
    .dba-rs-pop-btn:active { transform: translateY(1px); }
    .dba-rs-pop-btn[data-active="1"] {
      outline: 3px solid #ea0000;
      outline-offset: 0px;
      background: #fff2f2;
    }
    .dba-rs-pop-btn--new {
      background: #cfe3ff;
    }

    /* ===== 長押しゲージ（クリック/長押しで機能分岐する時の視覚フィードバック） ===== */
    #dba-lp-gauge {
      position: fixed;
      left: 0;
      top: 0;
      width: 46px;
      height: 46px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 1000000; /* fnbar(999999)より上に出す */
      opacity: 0;
      transition: opacity 0.12s ease;
    }
    #dba-lp-gauge[data-on="1"] { opacity: 1; }

    #dba-lp-gauge .dba-lp-gauge__ring {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      /* 初期は薄いグレー（JSで上書きして進捗描画） */
      background: conic-gradient(from -90deg, #c8c8c8 0deg 360deg);
      /* リング化（中央を抜く） */
      -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 9px));
      mask: radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 9px));
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.25));
    }
    @media (max-width: 600px) {
      #dba-function-section {
        width: calc(100svw - 4px);
        max-width: calc(100svw - 4px);
        padding: 2px 4px 4px 4px;
      }
      .dba-fn-header-info__title {
        display: none;
      }
      .dba-fn-header-info__line1 {
        gap: 6px;
      }
      .dba-fn-header-info__title,
      .dba-fn-header-info__mode,
      .dba-fn-header-info__reg,
      .dba-fn-header-info__team,
      .dba-fn-header-info__prevmenu {
        font-size: 0.98em;
        line-height: 1.2;
      }
      .dba-fn-header-info__team-dot {
        display: inline-block;
        width: 12px;
        height: 12px;
        min-width: 12px;
        min-height: 12px;
        border-radius: 999px;
        border: 1px solid #00000022;
        vertical-align: middle;
        box-sizing: border-box;
        flex: 0 0 auto;
      }
      #dba-top-progress .dba-top-progress__metaRow {
        gap: 8px;
      }
      #dba-top-progress .dba-top-progress__barRow {
        gap: 6px;
      }
      /* プログレスバー */
      #dba-top-progress .dba-top-progress__matchBar {
        flex: 1 1 100%;
        max-width: 140px
      }
      #dba-top-progress-sync-now {
        flex: 0 0 auto;
      }
      #dba-fn-buttons-row {
        justify-content: center;
      }
      .dba-btn-fn {
        margin: 3px;
        padding: 4px 5px;
        font-size: 0.96em;
      }
    }
  `;
  // ============================================================
  // △ここまで△ CSS 定義ゾーン（集中管理）
  // ============================================================

  function addStyle(cssText) {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(cssText);
      return;
    }
    const style = document.createElement('style');
    style.textContent = cssText;
    document.documentElement.appendChild(style);
  }

  // =========================
  // 長押しゲージ（クリック/長押しで機能が分岐する場合の視覚フィードバック）
  //  - pointerdown で開始（押下座標中心）
  //  - 0時→時計回りで進捗（黄→赤）
  //  - 完了で全周グリーンにして短時間で消す
  //  - pointerup/cancel/leave で即キャンセル
  // =========================
  const DBA_LP_GAUGE = {
    raf: 0,
    t0: 0,
    dur: 0,
    on: false,
    hideTimer: 0,
    lastXY: { x: 0, y: 0 }
  };

  function ensureLongPressGauge(){
    if(document.getElementById('dba-lp-gauge')) return;
    const el = document.createElement('div');
    el.id = 'dba-lp-gauge';
    el.dataset.on = '0';
    const ring = document.createElement('div');
    ring.className = 'dba-lp-gauge__ring';
    el.appendChild(ring);
    (document.body || document.documentElement).appendChild(el);
  }

  function setLongPressGaugePos(x, y){
    ensureLongPressGauge();
    const el = document.getElementById('dba-lp-gauge');
    if(!el) return;
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
  }

  function drawLongPressGaugeProgress(pct01){
    ensureLongPressGauge();
    const el = document.getElementById('dba-lp-gauge');
    if(!el) return;
    const ring = el.querySelector('.dba-lp-gauge__ring');
    if(!(ring instanceof HTMLElement)) return;

    const p = Math.max(0, Math.min(1, Number(pct01 || 0)));
    const ang = 360 * p;
    const mid = ang * 0.70; // 黄→赤の中間点

    // 灰ベース + 進捗（黄→赤）
    ring.style.background =
      `conic-gradient(from -90deg, ` +
      `#ffd400 0deg, ` +
      `#ffd400 ${mid}deg, ` +
      `#ff0000 ${ang}deg, ` +
      `#c8c8c8 ${ang}deg 360deg)`;
  }

  function drawLongPressGaugeComplete(){
    ensureLongPressGauge();
    const el = document.getElementById('dba-lp-gauge');
    if(!el) return;
    const ring = el.querySelector('.dba-lp-gauge__ring');
    if(!(ring instanceof HTMLElement)) return;
    ring.style.background = 'conic-gradient(from -90deg, #33a033 0deg 360deg)';
  }

  function longPressGaugeCancel(){
    if(DBA_LP_GAUGE.raf){
      cancelAnimationFrame(DBA_LP_GAUGE.raf);
      DBA_LP_GAUGE.raf = 0;
    }
    if(DBA_LP_GAUGE.hideTimer){
      clearTimeout(DBA_LP_GAUGE.hideTimer);
      DBA_LP_GAUGE.hideTimer = 0;
    }
    DBA_LP_GAUGE.on = false;
    const el = document.getElementById('dba-lp-gauge');
    if(el) el.dataset.on = '0';
  }

  function longPressGaugeStart(x, y, durationMs){
    ensureLongPressGauge();
    const el = document.getElementById('dba-lp-gauge');
    if(!el) return;

    // 既存を強制リセット
    longPressGaugeCancel();

    DBA_LP_GAUGE.on = true;
    DBA_LP_GAUGE.t0 = performance.now();
    DBA_LP_GAUGE.dur = Math.max(1, Number(durationMs || 1));
    DBA_LP_GAUGE.lastXY = { x: Number(x || 0), y: Number(y || 0) };

    setLongPressGaugePos(DBA_LP_GAUGE.lastXY.x, DBA_LP_GAUGE.lastXY.y);
    el.dataset.on = '1';
    drawLongPressGaugeProgress(0);

    const tick = () => {
      if(!DBA_LP_GAUGE.on) return;
      const now = performance.now();
      const p = (now - DBA_LP_GAUGE.t0) / DBA_LP_GAUGE.dur;
      drawLongPressGaugeProgress(p);
      if(p >= 1){
        // 完了は呼び出し側の「長押し成立」と一致させるため、ここでは止めるだけ
        return;
      }
      DBA_LP_GAUGE.raf = requestAnimationFrame(tick);
    };
    DBA_LP_GAUGE.raf = requestAnimationFrame(tick);
  }

  function longPressGaugeComplete(){
    // 長押し成立：全周グリーン → すぐ消える
    if(DBA_LP_GAUGE.raf){
      cancelAnimationFrame(DBA_LP_GAUGE.raf);
      DBA_LP_GAUGE.raf = 0;
    }
    if(!DBA_LP_GAUGE.on) return;
    DBA_LP_GAUGE.on = false;
    drawLongPressGaugeComplete();
    const el = document.getElementById('dba-lp-gauge');
    if(el) el.dataset.on = '1';
    DBA_LP_GAUGE.hideTimer = setTimeout(() => {
      const el2 = document.getElementById('dba-lp-gauge');
      if(el2) el2.dataset.on = '0';
      DBA_LP_GAUGE.hideTimer = 0;
    }, 220);
  }

  // =========================
  // ファンクションボタン用ホバーヒント
  //  - マウスカーソルを一定時間静止で表示
  //  - 長押しやタッチ操作は対象外
  // =========================
  const DBA_FN_TOOLTIP = {
    timer: 0,
    anchor: null,
    text: '',
    mouseX: 0,
    mouseY: 0
  };

  function ensureFnTooltip(){
    let el = document.getElementById('dba-fn-tooltip');
    if(el) return el;
    el = document.createElement('div');
    el.id = 'dba-fn-tooltip';
    el.dataset.open = '0';
    el.dataset.pos = 'above';
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function hideFnTooltip(){
    if(DBA_FN_TOOLTIP.timer){
      clearTimeout(DBA_FN_TOOLTIP.timer);
      DBA_FN_TOOLTIP.timer = 0;
    }
    DBA_FN_TOOLTIP.anchor = null;
    const el = document.getElementById('dba-fn-tooltip');
    if(el){
      el.dataset.open = '0';
      el.textContent = '';
    }
  }

  function showFnTooltipNearButton(btn, text, preferredPos){
    if(!(btn instanceof HTMLElement)) return;
    const el = ensureFnTooltip();
    if(!el) return;

    el.textContent = String(text || '');
    el.dataset.open = '1';

    const rect = btn.getBoundingClientRect();
    const margin = 10;
    const pref = String(preferredPos || '').toLowerCase();

    // 一旦表示して実寸取得
    el.style.left = '0px';
    el.style.top = '0px';

    const tipRect = el.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
    left = Math.max(12, Math.min(left, window.innerWidth - tipRect.width - 12));

    let top;
    let pos;

    if(pref === 'below'){
      top = rect.bottom + margin;
      pos = 'below';
      if(top + tipRect.height > window.innerHeight - 8){
        top = Math.max(8, rect.top - tipRect.height - margin);
        pos = 'above';
      }
    }else{
      top = rect.top - tipRect.height - margin;
      pos = 'above';
      if(top < 8){
        top = rect.bottom + margin;
        pos = 'below';
      }
    }

    el.dataset.pos = pos;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  }

  function scheduleFnTooltip(btn, text, preferredPos){
    const s = loadSettings();
    if(s?.rbLayer?.hideFnTooltip){
      hideFnTooltip();
      return;
    }

    if(DBA_FN_TOOLTIP.timer){
      clearTimeout(DBA_FN_TOOLTIP.timer);
      DBA_FN_TOOLTIP.timer = 0;
    }
    DBA_FN_TOOLTIP.anchor = btn;
    DBA_FN_TOOLTIP.text = String(text || '');
    DBA_FN_TOOLTIP.timer = setTimeout(() => {
      DBA_FN_TOOLTIP.timer = 0;
      if(DBA_FN_TOOLTIP.anchor !== btn) return;
      showFnTooltipNearButton(btn, DBA_FN_TOOLTIP.text, preferredPos);
    }, 600);   // ヘルプバルーンの待機時間（ミリ秒）
  }

  function bindFnButtonTooltip(btn, text, preferredPos){
    if(!(btn instanceof HTMLElement)) return;
    const hintText = String(text || '');
    const hintPos = String(preferredPos || '').toLowerCase();

    btn.addEventListener('mouseenter', (e) => {
      if(!(e instanceof MouseEvent)) return;
      const s = loadSettings();
      if(s?.rbLayer?.hideFnTooltip){
        hideFnTooltip();
        return;
      }
      hideFnTooltip();
      scheduleFnTooltip(btn, hintText, hintPos);
    });

    btn.addEventListener('mousemove', (e) => {
      if(!(e instanceof MouseEvent)) return;
      const s = loadSettings();
      if(s?.rbLayer?.hideFnTooltip){
        hideFnTooltip();
        return;
      }
      const x = Number(e.clientX || 0);
      const y = Number(e.clientY || 0);
      const dx = Math.abs(x - DBA_FN_TOOLTIP.mouseX);
      const dy = Math.abs(y - DBA_FN_TOOLTIP.mouseY);
      DBA_FN_TOOLTIP.mouseX = x;
      DBA_FN_TOOLTIP.mouseY = y;

      // 静止時間を満たすため、ある程度動いたらタイマーをやり直す
      if(dx > 2 || dy > 2){
        const el = document.getElementById('dba-fn-tooltip');
        if(el && el.dataset.open === '1'){
          showFnTooltipNearButton(btn, hintText, hintPos);
        }else{
          scheduleFnTooltip(btn, hintText, hintPos);
        }
      }
    });

    btn.addEventListener('mouseleave', hideFnTooltip);
    btn.addEventListener('blur', hideFnTooltip);
    btn.addEventListener('mousedown', hideFnTooltip);
    btn.addEventListener('pointerdown', hideFnTooltip);
  }

  // =========================
  // fnbar（#dba-function-section）の高さを実測し、CSS変数へ反映
  //  - body の padding-top が常に最新のfnbar高さに追従するための仕組み
  // =========================
  let DBA_FNBAR_HSYNC_RAF = 0;
  function syncFnbarHeightVar(){
    const bar = document.getElementById('dba-function-section');
    if(!bar) return;
    const h = Math.max(1, Math.round(bar.getBoundingClientRect().height));
    document.documentElement.style.setProperty('--dba-fn-height', `${h}px`);
  }
  function scheduleFnbarHeightSync(){
    if(DBA_FNBAR_HSYNC_RAF) return;
    DBA_FNBAR_HSYNC_RAF = requestAnimationFrame(() => {
      DBA_FNBAR_HSYNC_RAF = 0;
      try{ syncFnbarHeightVar(); }catch(_e){}
    });
  }

  // =========================
  // 設定（保存・適用）
  // =========================
  const LS_KEY = 'dba.settings.v1';
  const LS_RAPID_KEY = 'dba.rapidAttack.v1'; // ラピッド攻撃 ON/OFF
  const LS_AUTO_EQUIP_KEY = 'dba.autoEquip.enabled.v1'; // オート装備 ON/OFF
  const LS_AUTO_EQUIP_CAND_KEY = 'dba.autoEquip.candidates.v1'; // レギュレーション→装備候補（プリセット名配列）
  const LS_AUTO_EQUIP_LAST_KEY = 'dba.autoEquip.lastPreset.v1'; // 最後にオート装備で適用したプリセット名
  const LS_AUTO_EQUIP_NOTIFY_AUTOCLOSE_KEY = 'dba.autoEquip.notifyAutoClose.enabled.v1'; // 0/1
  const LS_AUTO_EQUIP_NOTIFY_AUTOCLOSE_SEC_KEY = 'dba.autoEquip.notifyAutoClose.sec.v1'; // number
  const LS_AUTO_EQUIP_PREFER_TOP_KEY = 'dba.autoEquip.preferTop.enabled.v1'; // 0/1 「一番上の装備候補を常に優先する」
  const LS_CURRENT_PRESET_NAME_KEY = 'dba.roster.currentPresetName.v1'; // string 現在装備中として扱うプリセット名
  const LS_ROSTER_SCROLL_REMEMBER_KEY = 'dba.roster.scrollRemember.v1'; // 0/1
  const LS_ROSTER_SCROLL_TOP_KEY = 'dba.roster.scrollTop.v1'; // number
  const LS_ROSTER_PRESET_CLICK_ACTION_KEY = 'dba.roster.presetClickAction.v1'; // equip / menu
  const LS_ROSTER_HIDE_MENU_ROW2_KEY = 'dba.roster.hideMenuRow2.v1'; // 0/1
  const LS_BR_TAIL2_KEY = 'dba.battleResult.tail2.v1'; // 戦闘結果「末尾2行のみ表示」ON/OFF
  const LS_BR_ALIGN_KEY = 'dba.battleResult.align.v1'; // left / center / right
  const LS_BR_PASS_KEY  = 'dba.battleResult.passThrough.v1'; // 0/1 クリック透過
  const LS_BR_TOP_KEY   = 'dba.battleResult.topOffsetPx.v1'; // number 上端からの距離(px)
  const LS_BR_WIDTH_KEY = 'dba.battleResult.widthPx.v1'; // number 横幅(px)
  const LS_BR_HIDE_CLOSE_KEY = 'dba.battleResult.hideClose.v1'; // 0/1 「戦闘結果」ウインドウのCloseボタン非表示
  const LS_BR_HIDE_OPT_KEY   = 'dba.battleResult.hideOption.v1'; // 0/1 「戦闘結果」ウインドウのオプションボタン非表示

  const DBA_ROSTER_UI_STATE = {
    scrollTop: 0
  };

  // トップページ「経過時間」プログレス（同期用）
  const LS_TOP_ELAPSED_PROGRESS_KEY = 'dba.topElapsedProgress.v1';
  const DBA_TOP_PROGRESS_CYCLE_MS = 60 * 60 * 1000; // 1サイクル=約1時間（ユーザー説明に基づく）
  const LS_TOP_SYNCINFO_SHOW_KEY = 'dba.topElapsedProgress.showInfo.v1'; // 0/1
  const LS_SHOW_ORIGINAL_HEADER_KEY = 'dba.showOriginalHeader.v1'; // 0/1
  const LS_SHOW_LIGHT_REFRESH_BUTTON_KEY = 'dba.showLightRefreshButton.v1'; // 0/1
  const LS_PICK_HIDE_MOD0_PREFIX = 'dba.pick.hideModZero.v1.'; // weapon / armor / necklace

  function makePickHideModZeroKey(kind){
    const k = (kind === 'weapon' || kind === 'armor' || kind === 'necklace') ? kind : 'unknown';
    return `${LS_PICK_HIDE_MOD0_PREFIX}${k}`;
  }

  function loadPickHideModZero(kind){
    try{
      const raw = localStorage.getItem(makePickHideModZeroKey(kind));
      if(raw == null) return false; // デフォルトOFF
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function savePickHideModZero(kind, on){
    try{
      localStorage.setItem(makePickHideModZeroKey(kind), on ? '1' : '0');
    }catch(_e){}
  }

  function loadTopSyncInfoShow(){
    try{
      const raw = localStorage.getItem(LS_TOP_SYNCINFO_SHOW_KEY);
      if(raw == null) return false; // デフォルトOFF（右ペイン非表示）
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function saveTopSyncInfoShow(on){
    try{
      localStorage.setItem(LS_TOP_SYNCINFO_SHOW_KEY, on ? '1' : '0');
    }catch(_e){}
  }

  function loadShowOriginalHeader(){
    try{
      const raw = localStorage.getItem(LS_SHOW_ORIGINAL_HEADER_KEY);
      if(raw == null) return false; // デフォルトOFF
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function saveShowOriginalHeader(on){
    try{
      localStorage.setItem(LS_SHOW_ORIGINAL_HEADER_KEY, on ? '1' : '0');
    }catch(_e){}
  }

  function loadShowLightRefreshButton(){
    try{
      const raw = localStorage.getItem(LS_SHOW_LIGHT_REFRESH_BUTTON_KEY);
      if(raw == null) return false; // デフォルトOFF
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function saveShowLightRefreshButton(on){
    try{
      localStorage.setItem(LS_SHOW_LIGHT_REFRESH_BUTTON_KEY, on ? '1' : '0');
    }catch(_e){}
  }

  function applyOriginalHeaderVisibility(show){
    const header = document.querySelector('header');
    if(!header) return false;
    header.style.display = show ? '' : 'none';
    return true;
  }

  function reapplyOriginalHeaderVisibilityFromSettings(){
    try{
      const s = loadSettings();
      return applyOriginalHeaderVisibility(!!s?.header?.showOriginalHeader);
    }catch(_e){
      return applyOriginalHeaderVisibility(loadShowOriginalHeader());
    }
  }

  let DBA_ORIGINAL_HEADER_VIS_OBS = null;
  let DBA_ORIGINAL_HEADER_VIS_RAF = 0;

  function scheduleReapplyOriginalHeaderVisibility(){
    if(DBA_ORIGINAL_HEADER_VIS_RAF) return;
    DBA_ORIGINAL_HEADER_VIS_RAF = requestAnimationFrame(() => {
      DBA_ORIGINAL_HEADER_VIS_RAF = 0;
      reapplyOriginalHeaderVisibilityFromSettings();
    });
  }

  function startOriginalHeaderVisibilityObserver(){
    if(DBA_ORIGINAL_HEADER_VIS_OBS) return;

    const root = document.body || document.documentElement;
    if(!root) return;

    DBA_ORIGINAL_HEADER_VIS_OBS = new MutationObserver((mutations) => {
      let shouldReapply = false;

      for(const m of mutations){
        if(m.type === 'childList'){
          for(const n of m.addedNodes){
            if(!(n instanceof Element)) continue;
            if(
              n.matches('header') ||
              n.querySelector('header')
            ){
              shouldReapply = true;
              break;
            }
          }
          if(shouldReapply) break;
        }
      }

      if(shouldReapply){
        scheduleReapplyOriginalHeaderVisibility();
      }
    });

    DBA_ORIGINAL_HEADER_VIS_OBS.observe(root, {
      childList: true,
      subtree: true
    });
  }

  function loadTopElapsedProgress(){
    try{
      const raw = localStorage.getItem(LS_TOP_ELAPSED_PROGRESS_KEY);
      if(!raw) return null;
      const obj = JSON.parse(raw);
      if(!obj || typeof obj !== 'object') return null;
      const pct = Number(obj.pct);
      const fetchedAt = Number(obj.fetchedAt);
      if(!Number.isFinite(pct) || !Number.isFinite(fetchedAt)) return null;
      return {
        pct: clampInt(pct, 0, 100),
        fetchedAt,
        cycleMs: Number.isFinite(Number(obj.cycleMs)) ? Number(obj.cycleMs) : DBA_TOP_PROGRESS_CYCLE_MS,
        term: (obj.term != null) ? String(obj.term) : '' // 例: "第 15816 期"
      };
    }catch(_e){
      return null;
    }
  }

  function saveTopElapsedProgress(pct, term){
    try{
      const n = clampInt(pct, 0, 100);
      const obj = {
        pct: n,
        fetchedAt: Date.now(),
        cycleMs: DBA_TOP_PROGRESS_CYCLE_MS,
        term: (term != null) ? String(term) : ''
      };
      localStorage.setItem(LS_TOP_ELAPSED_PROGRESS_KEY, JSON.stringify(obj));
    }catch(_e){}
  }

  function estimateTopElapsedProgressPct(){
    const data = loadTopElapsedProgress();
    if(!data) return 0;
    const now = Date.now();
    const dt = Math.max(0, now - (data.fetchedAt || 0));
    const cycle = Math.max(1, Number(data.cycleMs || DBA_TOP_PROGRESS_CYCLE_MS));
    const adv = (dt / cycle) * 100;
    // 0..100 の範囲で周回
    const v = (Number(data.pct || 0) + adv) % 100;
    return clampInt(Math.floor(v), 0, 100);
  }

  // 秒計算用：floorしない（0..100未満で周回）
  function estimateTopElapsedProgressPctFloat(){
    const data = loadTopElapsedProgress();
    if(!data) return 0;
    const now = Date.now();
    const dt = Math.max(0, now - (data.fetchedAt || 0));
    const cycle = Math.max(1, Number(data.cycleMs || DBA_TOP_PROGRESS_CYCLE_MS));
    const adv = (dt / cycle) * 100;
    const v = (Number(data.pct || 0) + adv) % 100;
    // 0 <= v < 100（念のため丸め）
    const x = Number.isFinite(v) ? v : 0;
    return Math.max(0, Math.min(99.999999, x));
  }

  function getMatchSpecByMode(){
    // 期=約60分。モード別に「1期あたり試合数」「1試合あたり分数」を決める
    // - hc / l : 2試合（30分ずつ）
    // - rb     : 6試合（10分ずつ）
    if(mode === 'rb'){
      return { totalMatches: 6, matchSec: 10 * 60 };
    }
    // hc / l
    return { totalMatches: 2, matchSec: 30 * 60 };
  }

  // =========================
  // 試合進捗アンカー
  //  - 「期」の整数percentをそのまま毎秒試合進捗へ変換すると丸め誤差の影響を受けやすい
  //  - 同期時点で「何試合目の何秒地点か」を一度アンカー化し、
  //    以後は実時間で滑らかに進める
  // =========================
  const DBA_MATCH_PROGRESS_ANCHOR = {
    term: '',
    matchSec: 0,
    totalMatches: 0,
    matchIndex: 0,       // 0-based
    inMatchSec: 0,       // アンカー時点の試合内経過秒
    anchorAt: 0,         // Date.now()
    sourceElapsedSec: 0  // 同期元の期内経過秒（デバッグ用）
  };

  function resetMatchProgressAnchor(){
    DBA_MATCH_PROGRESS_ANCHOR.term = '';
    DBA_MATCH_PROGRESS_ANCHOR.matchSec = 0;
    DBA_MATCH_PROGRESS_ANCHOR.totalMatches = 0;
    DBA_MATCH_PROGRESS_ANCHOR.matchIndex = 0;
    DBA_MATCH_PROGRESS_ANCHOR.inMatchSec = 0;
    DBA_MATCH_PROGRESS_ANCHOR.anchorAt = 0;
    DBA_MATCH_PROGRESS_ANCHOR.sourceElapsedSec = 0;
  }

  function normalizeElapsedSecondInTerm(sec){
    const n = Number(sec);
    if(!Number.isFinite(n)) return 0;
    let v = n % 3600;
    if(v < 0) v += 3600;
    return v;
  }

  function getNearestMatchBoundarySecond(elapsedSec, matchSec){
    const cur = normalizeElapsedSecondInTerm(elapsedSec);
    const span = Math.max(1, Number(matchSec || 1));
    const q = Math.round(cur / span);
    const raw = q * span;
    if(raw >= 3600) return 0;
    return raw;
  }

  function getCircularSecondDistance(a, b){
    const x = normalizeElapsedSecondInTerm(a);
    const y = normalizeElapsedSecondInTerm(b);
    const d = Math.abs(x - y);
    return Math.min(d, 3600 - d);
  }

  function maybeSnapElapsedSecondToMatchBoundary(elapsedSec, matchSec){
    const cur = normalizeElapsedSecondInTerm(elapsedSec);
    const span = Math.max(1, Number(matchSec || 1));
    const nearest = getNearestMatchBoundarySecond(cur, span);
    // トップページの整数percentは 1% = 36秒 粒度なので、
    // 境界近辺は少し広めに吸着してズレを抑える
    const SNAP_TOLERANCE_SEC = 24;
    const dist = getCircularSecondDistance(cur, nearest);
    return (dist <= SNAP_TOLERANCE_SEC) ? nearest : cur;
  }

  function setMatchProgressAnchorFromElapsedSec(elapsedSec, termText){
    const spec = getMatchSpecByMode();
    const totalMatches = Math.max(1, Number(spec.totalMatches || 1));
    const matchSec = Math.max(1, Number(spec.matchSec || 1));

    const snappedElapsedSec = maybeSnapElapsedSecondToMatchBoundary(elapsedSec, matchSec);
    const matchIndex = Math.max(0, Math.min(totalMatches - 1, Math.floor(snappedElapsedSec / matchSec)));
    const inMatchSec = snappedElapsedSec - (matchIndex * matchSec);

    DBA_MATCH_PROGRESS_ANCHOR.term = String(termText || '');
    DBA_MATCH_PROGRESS_ANCHOR.matchSec = matchSec;
    DBA_MATCH_PROGRESS_ANCHOR.totalMatches = totalMatches;
    DBA_MATCH_PROGRESS_ANCHOR.matchIndex = matchIndex;
    DBA_MATCH_PROGRESS_ANCHOR.inMatchSec = Math.max(0, Math.min(matchSec, inMatchSec));
    DBA_MATCH_PROGRESS_ANCHOR.anchorAt = Date.now();
    DBA_MATCH_PROGRESS_ANCHOR.sourceElapsedSec = normalizeElapsedSecondInTerm(elapsedSec);
  }

  function syncMatchProgressAnchorFromStoredTopProgress(){
    const data = loadTopElapsedProgress();
    if(!data){
      resetMatchProgressAnchor();
      return false;
    }

    const pct = estimateTopElapsedProgressPctFloat();
    const elapsedSec = pctToElapsedSecond(pct);
    setMatchProgressAnchorFromElapsedSec(elapsedSec, data.term || '');
    return true;
  }

  function isMatchProgressAnchorExpired(nowMs){
    const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    if(!(DBA_MATCH_PROGRESS_ANCHOR.anchorAt > 0)) return true;

    const ageMs = Math.max(0, now - Number(DBA_MATCH_PROGRESS_ANCHOR.anchorAt || 0));
    // 1期=約60分。バックグラウンド復帰などでこの程度を超えたら、
    // 古いアンカーとして扱って同期値の採用を優先する。
    return ageMs >= (DBA_TOP_PROGRESS_CYCLE_MS + 15000);
  }

  function getAnchoredMatchProgressState(){
    const data = loadTopElapsedProgress();
    if(!data) return null;

    const spec = getMatchSpecByMode();
    const totalMatches = Math.max(1, Number(spec.totalMatches || 1));
    const matchSec = Math.max(1, Number(spec.matchSec || 1));
    const termText = String(data.term || '');

    const anchorUsable =
      DBA_MATCH_PROGRESS_ANCHOR.anchorAt > 0 &&
      DBA_MATCH_PROGRESS_ANCHOR.matchSec === matchSec &&
      DBA_MATCH_PROGRESS_ANCHOR.totalMatches === totalMatches &&
      DBA_MATCH_PROGRESS_ANCHOR.term === termText;

    if(!anchorUsable){
      const ok = syncMatchProgressAnchorFromStoredTopProgress();
      if(!ok) return null;
    }

    const now = Date.now();
    const dtSec = Math.max(0, Math.floor((now - DBA_MATCH_PROGRESS_ANCHOR.anchorAt) / 1000));
    const totalElapsedSec =
      (DBA_MATCH_PROGRESS_ANCHOR.matchIndex * matchSec) +
      DBA_MATCH_PROGRESS_ANCHOR.inMatchSec +
      dtSec;

    // v5.3.6.4 までは 3600秒超を 3599 に固定していたため、
    // バックグラウンド復帰後などに 99% で張り付くことがあった。
    // ここでは1期(3600秒)単位で周回させ、ローカル時計側は止めない。
    const wrappedTotal = normalizeElapsedSecondInTerm(totalElapsedSec);

    let matchIndex = Math.floor(wrappedTotal / matchSec);
    let inMatchSec = wrappedTotal - (matchIndex * matchSec);

    if(matchIndex >= totalMatches){
      matchIndex = totalMatches - 1;
      inMatchSec = 0;
    }

    inMatchSec = Math.max(0, Math.min(matchSec, inMatchSec));

    const remainSec = Math.max(0, Math.min(matchSec, matchSec - inMatchSec));
    const matchPct = (matchSec <= 0) ? 0 : Math.max(0, Math.min(100, (inMatchSec / matchSec) * 100));

    return {
      matchNo: clampInt(matchIndex + 1, 1, totalMatches),
      totalMatches,
      inMatchSec,
      remainSec,
      matchPct
    };
  }

  function extractFnHeaderInfoFromCurrentHeader(){
    const out = {
      title: 'どんぐりチーム戦い',
      teamName: '',
      teamColor: '',
      prevHref: '',
      prevText: '',
      animHref: '',
      animText: ''
    };

    const header = document.querySelector('header');
    if(!header) return out;

    const root = header.querySelector('div') || header;
    if(!root) return out;

    // RB専用：「チーム: 色名」ブロック + 色ドット
    if(mode === 'rb'){
      const spans = Array.from(root.querySelectorAll('span'));
      let teamLabelSpan = null;
      for(const sp of spans){
        const txt = String(sp.textContent || '').replace(/\s+/g, ' ').trim();
        const ownText = String(
          sp.childNodes[0] && sp.childNodes[0].nodeType === Node.TEXT_NODE
            ? sp.childNodes[0].textContent
            : ''
        ).replace(/\s+/g, ' ').trim();
        const st = String(sp.getAttribute('style') || '');
        const hasBg = /background\s*:/i.test(st);
        if(/^チーム\s*:/.test(txt) && !hasBg && (!teamLabelSpan || /^チーム\s*:/.test(ownText))){
          teamLabelSpan = sp;
        }
      }
      if(teamLabelSpan){
        const txt = String(teamLabelSpan.textContent || '').replace(/\s+/g, ' ').trim();
        const m = txt.match(/チーム\s*:\s*(.+)$/);
        if(m) out.teamName = String(m[1] || '').trim();

        const colorSearchRoots = [];
        if(teamLabelSpan.parentElement) colorSearchRoots.push(teamLabelSpan.parentElement);
        if(teamLabelSpan.parentElement && teamLabelSpan.parentElement.parentElement){
          colorSearchRoots.push(teamLabelSpan.parentElement.parentElement);
        }

        let fallbackColor = '';
        for(const sr of colorSearchRoots){
          const elems = Array.from(sr.querySelectorAll('span, div, i, b, em, strong'));
          for(const el of elems){
            if(!(el instanceof HTMLElement)) continue;
            if(el === teamLabelSpan) continue;

            const st = String(el.getAttribute('style') || '');
            const mBg = st.match(/background\s*:\s*([^;]+)/i);
            if(!mBg) continue;

            const hasWidth = /(?:^|;)\s*width\s*:/i.test(st);
            const hasHeight = /(?:^|;)\s*height\s*:/i.test(st);
            const hasRadius = /border-radius\s*:/i.test(st);

            if(hasWidth && hasHeight && hasRadius){
              out.teamColor = String(mBg[1] || '').trim();
              break;
            }

            if(!fallbackColor){
              fallbackColor = String(mBg[1] || '').trim();
            }
          }
          if(out.teamColor) break;
        }

        if(!out.teamColor && fallbackColor){
          out.teamColor = fallbackColor;
        }
      }
    }

    // 「前回のチームバトルの結果」「[アニメーション]」
    const links = Array.from(root.querySelectorAll('a'));
    for(const a of links){
      const txt = String(a.textContent || '').replace(/\s+/g, ' ').trim();
      const href = String(a.getAttribute('href') || '').trim();
      if(!out.prevHref && txt.includes('前回のチームバトルの結果')){
        out.prevHref = href;
        out.prevText = txt || '前回のチームバトルの結果';
        continue;
      }
      if(!out.animHref && txt.includes('[アニメーション]')){
        out.animHref = href;
        out.animText = txt || '[アニメーション]';
        continue;
      }
    }

    return out;
  }

  const DBA_RB_UNIFIED_REG = {
    value: '---',
    lastCellKey: '',
    inFlight: null
  };

  function getRbUnifiedRegDisplayText(){
    const v = sanitizeText(DBA_RB_UNIFIED_REG.value || '');
    return v || '---';
  }

  function pickRbUnifiedRegProbeCell(docLike){
    if(mode !== 'rb') return null;

    let snap = null;
    try{
      snap = getBattlemapSnapshotFromDoc(docLike || document);
    }catch(_e){
      snap = null;
    }

    const tryLists = [
      Array.isArray(snap?.visibleList) ? snap.visibleList : [],
      Array.isArray(snap?.exploredList) ? snap.exploredList : []
    ];

    for(const list of tryLists){
      for(const rc of list){
        if(!Array.isArray(rc) || rc.length < 2) continue;
        const row = Number(rc[0]);
        const col = Number(rc[1]);
        if(!Number.isFinite(row) || !Number.isFinite(col)) continue;
        if(row < 0 || col < 0) continue;
        return { row, col };
      }
    }

    const colorKeys = Object.keys((snap && snap.cellColors) ? snap.cellColors : {});
    if(colorKeys.length > 0){
      const m = String(colorKeys[0] || '').match(/^(\d+)-(\d+)$/);
      if(m){
        return { row: Number(m[1]), col: Number(m[2]) };
      }
    }

    const rows = Number(snap?.rows || 0);
    const cols = Number(snap?.cols || 0);
    if(Number.isFinite(rows) && Number.isFinite(cols) && rows > 0 && cols > 0){
      return { row: 0, col: 0 };
    }

    return null;
  }

  async function updateRbUnifiedRegDisplay(force){
    if(mode !== 'rb') return '---';

    if(DBA_RB_UNIFIED_REG.inFlight){
      try{
        await DBA_RB_UNIFIED_REG.inFlight;
      }catch(_e){}
      return getRbUnifiedRegDisplayText();
    }

    const probe = pickRbUnifiedRegProbeCell(document);
    if(!probe){
      DBA_RB_UNIFIED_REG.value = '---';
      if(document.getElementById('dba-fn-header-info')){
        renderFnHeaderInfo();
        scheduleFnbarHeightSync();
      }
      return '---';
    }

    const probeKey = `${probe.row},${probe.col}`;
    if(
      !force &&
      DBA_RB_UNIFIED_REG.lastCellKey === probeKey &&
      sanitizeText(DBA_RB_UNIFIED_REG.value || '')
    ){
      return getRbUnifiedRegDisplayText();
    }

    const p = (async () => {
      try{
        const d = await fetchCellDetail(probe.row, probe.col);
        const reg = sanitizeText(d && d.reg ? d.reg : '');
        DBA_RB_UNIFIED_REG.value = reg || '---';
        DBA_RB_UNIFIED_REG.lastCellKey = probeKey;
      }catch(_e){
        if(!sanitizeText(DBA_RB_UNIFIED_REG.value || '')){
          DBA_RB_UNIFIED_REG.value = '---';
        }
      }

      if(document.getElementById('dba-fn-header-info')){
        renderFnHeaderInfo();
        scheduleFnbarHeightSync();
      }

      return getRbUnifiedRegDisplayText();
    })();

    DBA_RB_UNIFIED_REG.inFlight = p;
    try{
      return await p;
    }finally{
      if(DBA_RB_UNIFIED_REG.inFlight === p){
        DBA_RB_UNIFIED_REG.inFlight = null;
      }
    }
  }

  function normalizeAnimLinkText(text){
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    if(!raw) return { left: '[', body: 'アニメーション', right: ']' };

    const m = raw.match(/^(.*?)(アニメーション)(.*?)$/);
    if(m){
      return {
        left: String(m[1] || '').trim() || '[',
        body: String(m[2] || '').trim() || 'アニメーション',
        right: String(m[3] || '').trim() || ']'
      };
    }

    return { left: '[', body: raw, right: ']' };
  }

  function closeFnHeaderPrevMenu(){
    const panel = document.getElementById('dba-fn-header-info-prevmenu-panel');
    if(panel) panel.dataset.open = '0';
  }

  function bindFnHeaderPrevMenuAutoClose(){
    if(document.documentElement.dataset.dbaFnPrevMenuBound === '1') return;
    document.documentElement.dataset.dbaFnPrevMenuBound = '1';

    document.addEventListener('pointerdown', (e) => {
      const root = document.getElementById('dba-fn-header-info-prevmenu');
      if(!root) return;
      if(root.contains(e.target)) return;
      closeFnHeaderPrevMenu();
    }, true);
  }

  const DBA_TOP_PROGRESS_POP_STATE = {
    hideTimer: 0
  };

  function ensureTopProgressPopup(){
    let pop = document.getElementById('dba-top-progress-pop');
    if(pop) return pop;

    pop = document.createElement('div');
    pop.id = 'dba-top-progress-pop';
    pop.dataset.open = '0';

    const ttl = document.createElement('div');
    ttl.className = 'dba-top-progress-pop__title';
    ttl.id = 'dba-top-progress-pop-title';
    ttl.textContent = '第 ? 期';

    const bar = document.createElement('div');
    bar.className = 'dba-top-progress-pop__bar';

    const inner = document.createElement('div');
    inner.id = 'dba-top-progress-pop-inner';
    inner.style.width = '0%';
    inner.textContent = '0%';
    bar.appendChild(inner);

    const line1 = document.createElement('div');
    line1.className = 'dba-top-progress-pop__line';
    line1.id = 'dba-top-progress-pop-sync';
    line1.textContent = '最終同期（手動＆自動）： --- 秒前';

    const line2 = document.createElement('div');
    line2.className = 'dba-top-progress-pop__line';
    line2.id = 'dba-top-progress-pop-auto';
    line2.textContent = '最終補正（自動）： --- 秒前';

    pop.appendChild(ttl);
    pop.appendChild(bar);
    pop.appendChild(line1);
    pop.appendChild(line2);

    pop.addEventListener('pointerenter', () => {
      if(DBA_TOP_PROGRESS_POP_STATE.hideTimer){
        clearTimeout(DBA_TOP_PROGRESS_POP_STATE.hideTimer);
        DBA_TOP_PROGRESS_POP_STATE.hideTimer = 0;
      }
    });
    pop.addEventListener('pointerleave', () => {
      hideTopProgressPopupSoon();
    });

    (document.body || document.documentElement).appendChild(pop);
    return pop;
  }

  function updateTopProgressPopupContent(){
    const pop = ensureTopProgressPopup();
    if(!pop) return;

    const title = document.getElementById('dba-top-progress-pop-title');
    const inner = document.getElementById('dba-top-progress-pop-inner');
    const lineSync = document.getElementById('dba-top-progress-pop-sync');
    const lineAuto = document.getElementById('dba-top-progress-pop-auto');

    const pct = estimateTopElapsedProgressPct();
    const data = loadTopElapsedProgress();
    const now = Date.now();
    const titleText = (data && data.term) ? data.term : '第 ? 期';

    if(title) title.textContent = titleText;
    if(inner){
      inner.style.width = `${pct}%`;
      inner.textContent = `${pct}%`;
    }
    if(lineSync){
      lineSync.textContent = !data
        ? '最終同期（手動＆自動）： --- 秒前'
        : `最終同期（手動＆自動）： ${Math.floor(Math.max(0, now - data.fetchedAt) / 1000)} 秒前`;
    }
    if(lineAuto){
      lineAuto.textContent = (DBA_TOP_PROGRESS_AUTOSYNC.lastAutoAt > 0)
        ? `最終補正（自動）： ${Math.floor(Math.max(0, now - DBA_TOP_PROGRESS_AUTOSYNC.lastAutoAt) / 1000)} 秒前`
        : '最終補正（自動）： --- 秒前';
    }
  }

  function hideTopProgressPopup(){
    if(DBA_TOP_PROGRESS_POP_STATE.hideTimer){
      clearTimeout(DBA_TOP_PROGRESS_POP_STATE.hideTimer);
      DBA_TOP_PROGRESS_POP_STATE.hideTimer = 0;
    }
    const pop = document.getElementById('dba-top-progress-pop');
    if(pop) pop.dataset.open = '0';
  }

  function hideTopProgressPopupSoon(){
    if(DBA_TOP_PROGRESS_POP_STATE.hideTimer){
      clearTimeout(DBA_TOP_PROGRESS_POP_STATE.hideTimer);
      DBA_TOP_PROGRESS_POP_STATE.hideTimer = 0;
    }
    DBA_TOP_PROGRESS_POP_STATE.hideTimer = setTimeout(() => {
      DBA_TOP_PROGRESS_POP_STATE.hideTimer = 0;
      hideTopProgressPopup();
    }, 120);
  }

  function showTopProgressPopupNearAnchor(anchor){
    if(!(anchor instanceof HTMLElement)) return;
    const pop = ensureTopProgressPopup();
    if(!pop) return;

    updateTopProgressPopupContent();
    pop.dataset.open = '1';

    const rect = anchor.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();

    let left = rect.left + (rect.width / 2) - (popRect.width / 2);
    left = Math.max(12, Math.min(left, window.innerWidth - popRect.width - 12));

    let top = rect.bottom + 10;
    if(top + popRect.height > window.innerHeight - 8){
      top = Math.max(8, rect.top - popRect.height - 10);
    }

    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
  }

  function bindTopProgressPopup(anchor){
    if(!(anchor instanceof HTMLElement)) return;
    if(anchor.dataset.dbaTopProgressPopupBound === '1') return;
    anchor.dataset.dbaTopProgressPopupBound = '1';

    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pop = ensureTopProgressPopup();
      if(pop && pop.dataset.open === '1'){
        hideTopProgressPopup();
      }else{
        showTopProgressPopupNearAnchor(anchor);
      }
    });

    document.addEventListener('pointerdown', (e) => {
      const pop = document.getElementById('dba-top-progress-pop');
      if(anchor.contains(e.target)) return;
      if(pop && pop.contains(e.target)) return;
      hideTopProgressPopup();
    }, true);

    window.addEventListener('resize', hideTopProgressPopup, { passive:true });
    window.addEventListener('orientationchange', hideTopProgressPopup, { passive:true });
  }

  function ensureFnHeaderInfoContainer(targetParent){
    const existed = document.getElementById('dba-fn-header-info');
    if(existed){
      if(targetParent && existed.parentNode !== targetParent){
        try{ targetParent.appendChild(existed); }catch(_e){}
      }
      return existed;
    }

    const wrap = document.createElement('div');
    wrap.id = 'dba-fn-header-info';

    if(targetParent){
      try{ targetParent.appendChild(wrap); }catch(_e){}
    }
    return wrap;
  }

  function renderFnHeaderInfo(){
    const wrap = document.getElementById('dba-fn-header-info');
    if(!wrap) return;

    const info = extractFnHeaderInfoFromCurrentHeader();
    wrap.textContent = '';

    const line1 = document.createElement('div');
    line1.className = 'dba-fn-header-info__line1';

    const title = document.createElement('span');
    title.className = 'dba-fn-header-info__title';
    title.textContent = 'どんぐりチーム戦い';
    line1.appendChild(title);

    const modeLabel = document.createElement('span');
    modeLabel.className = 'dba-fn-header-info__mode';
    if(mode === 'hc'){
      modeLabel.textContent = '《 ハードコア 》';
    }else if(mode === 'l'){
      modeLabel.textContent = '《 ラダー 》';
    }else if(mode === 'rb'){
      modeLabel.textContent = '《 レッドvsブルー 》';
    }else{
      modeLabel.textContent = '《 unknown mode 》';
    }
    line1.appendChild(modeLabel);

    if(mode === 'rb'){
      const reg = document.createElement('span');
      reg.className = 'dba-fn-header-info__reg';
      reg.style.cursor = 'help';

      const regLabel = document.createElement('span');
      regLabel.className = 'dba-fn-header-info__reg-label';
      regLabel.textContent = 'Reg.：';
      reg.appendChild(regLabel);

      const regValue = document.createElement('span');
      regValue.className = 'dba-fn-header-info__reg-value';
      regValue.textContent = getRbUnifiedRegDisplayText();
      reg.appendChild(regValue);

      bindFnButtonTooltip(
        reg,
        'レギュレーションの短縮表示\n' +
        '[α]だけ … α\n' +
        '[α]まで … ?α\n' +
        '[α]から[β]まで … α-β\n' +
        '[α]だけ|[エリート] … α?\n' +
        '[α]まで|[警備員]だけ … ?α警\n' +
        '[α]だけ|[警備員]だけ|[エリート] … α警?',
        'below'
      );

      line1.appendChild(reg);
    }

    if(mode === 'rb' && (info.teamName || info.teamColor)){
      const team = document.createElement('span');
      team.className = 'dba-fn-header-info__team';

      const sep = document.createElement('span');
      sep.className = 'dba-fn-header-info__sep';
      sep.textContent = ' ／ ';
      team.appendChild(sep);

      const lab = document.createElement('span');
      lab.className = 'dba-fn-header-info__team-label';
      lab.textContent = 'Team：';
      team.appendChild(lab);

      if(info.teamName){
        const nm = document.createElement('span');
        nm.className = 'dba-fn-header-info__team-name';
        nm.textContent = info.teamName;
        team.appendChild(nm);
      }

      if(info.teamColor){
        const dot = document.createElement('span');
        dot.className = 'dba-fn-header-info__team-dot';
        dot.style.background = info.teamColor;
        team.appendChild(dot);
      }

      line1.appendChild(team);
    }

    if(info.prevHref || info.animHref){
      const menuWrap = document.createElement('span');
      menuWrap.className = 'dba-fn-header-info__prevmenu';
      menuWrap.id = 'dba-fn-header-info-prevmenu';

      const bracketL = document.createElement('span');
      bracketL.className = 'dba-fn-header-info__prevmenu-bracket';
      bracketL.textContent = '[';

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'dba-fn-header-info__prevmenu-btn';
      trigger.textContent = '前の試合';

      const bracketR = document.createElement('span');
      bracketR.className = 'dba-fn-header-info__prevmenu-bracket';
      bracketR.textContent = ']';

      const panel = document.createElement('div');
      panel.className = 'dba-fn-header-info__prevmenu-panel';
      panel.id = 'dba-fn-header-info-prevmenu-panel';
      panel.dataset.open = '0';

      if(info.prevHref){
        const row = document.createElement('div');
        row.className = 'dba-fn-header-info__prevmenu-row';

        const aPrev = document.createElement('a');
        aPrev.href = info.prevHref;
        aPrev.target = '_self';
        aPrev.className = 'dba-fn-header-info__prevmenu-link';
        aPrev.textContent = '前回のチームバトルの結果';

        row.appendChild(aPrev);
        panel.appendChild(row);
      }

      if(info.animHref){
        const row = document.createElement('div');
        row.className = 'dba-fn-header-info__prevmenu-row';

        const aAnim = document.createElement('a');
        aAnim.href = info.animHref;
        aAnim.target = '_self';
        aAnim.className = 'dba-fn-header-info__prevmenu-link';
        aAnim.textContent = 'アニメーション';

        row.appendChild(aAnim);
        panel.appendChild(row);
      }

      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        panel.dataset.open = (panel.dataset.open === '1') ? '0' : '1';
      });

      menuWrap.appendChild(bracketL);
      menuWrap.appendChild(trigger);
      menuWrap.appendChild(bracketR);
      menuWrap.appendChild(panel);
      line1.appendChild(menuWrap);
      bindFnHeaderPrevMenuAutoClose();
    }
    wrap.appendChild(line1);
  }

  function ensureTopProgressContainer(targetParent){
    const existed = document.getElementById('dba-top-progress');
    if(existed){
      // 既に存在する場合：指定親があればそこへ移動
      if(targetParent && existed.parentNode !== targetParent){
        try{ targetParent.appendChild(existed); }catch(_e){}
      }
      return;
    }
    const header = document.querySelector('header');
    const hostParent = header && header.parentNode ? header.parentNode : (document.body || document.documentElement);

    const wrap = document.createElement('div');
    wrap.id = 'dba-top-progress';
    wrap.dataset.showinfo = loadTopSyncInfoShow() ? '1' : '0';

    const metaRow = document.createElement('div');
    metaRow.className = 'dba-top-progress__metaRow';

    const metaTerm = document.createElement('span');
    metaTerm.className = 'dba-top-progress__metaTerm';
    metaTerm.id = 'dba-top-progress-meta-term';
    metaTerm.textContent = '第 ? 期';

    const metaMatch = document.createElement('span');
    metaMatch.className = 'dba-top-progress__metaMatch';
    metaMatch.id = 'dba-top-progress-match-label';
    metaMatch.textContent = '第 1 試合／?';

    const metaTime = document.createElement('span');
    metaTime.className = 'dba-top-progress__metaTime';
    metaTime.id = 'dba-top-progress-match-time';
    metaTime.textContent = '残り: --分--秒（誤差あり）';

    bindFnButtonTooltip(
      metaTime,
      'サーバーから時間の送信はなく、プログレスバーも 36秒 が最小単位なので誤差が出ます。',
      'below'
    );

    metaRow.appendChild(metaTerm);
    metaRow.appendChild(metaMatch);
    metaRow.appendChild(metaTime);

    // 「今すぐ同期」ボタン
    const btnSync = document.createElement('button');
    btnSync.type = 'button';
    btnSync.id = 'dba-top-progress-sync-now';
    btnSync.className = 'dba-btn-progress-mini';
    btnSync.textContent = '同期';
    btnSync.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if(DBA_TOP_PROGRESS_AUTOSYNC.inFlight) return;
      fetchTopElapsedProgressFromTopPageOnce('manual').catch(()=>{});
    });

    const barRow = document.createElement('div');
    barRow.className = 'dba-top-progress__barRow';

    const bar = document.createElement('div');
    bar.className = 'dba-top-progress__matchBar';
    bar.id = 'dba-top-progress-match-bar';

    const inner = document.createElement('div');
    inner.id = 'dba-top-progress-match-inner';
    inner.style.width = '0%';
    inner.textContent = '0%';
    bar.appendChild(inner);

    bindFnButtonTooltip(
      bar,
      '「同期」ボタンで同期を取ると良いタイミング\n' +
      '・プログレスバーが100％になる前に、次の試合が始まった時。\n' +
      '・しばらく放置した後や、別タブや別アプリから戻った時。\n' +
      '・通信が不安定になり、その後に回復した時。\n' +
      '・プログレスバーが動かない等の異常時。',
      'below'
    );

    barRow.appendChild(bar);
    barRow.appendChild(btnSync);

    wrap.appendChild(metaRow);
    wrap.appendChild(barRow);

    bindTopProgressPopup(bar);
    ensureTopProgressPopup();

    // ★設置先：targetParent が指定されていれば fnbar 内へ、無ければ従来通り header 直後
    if(targetParent){
      try{ targetParent.appendChild(wrap); }catch(_e){}
    }else{
      // 従来互換：<header> タグの直後に設置
      if(header && header.parentNode){
        const next = header.nextSibling;
        if(next){
          hostParent.insertBefore(wrap, next);
        }else{
          hostParent.appendChild(wrap);
        }
      }else{
        hostParent.insertBefore(wrap, hostParent.firstChild);
      }
    }
  }

  const DBA_TOP_PROGRESS_RENDER_CACHE = {
    termPct: null,
    matchLabel: '',
    matchTime: '',
    matchPct: null,
    termTitle: '',
    syncDisabled: null,
    syncText: ''
  };

  function renderTopProgress(){
    const matchInner = document.getElementById('dba-top-progress-match-inner');
    const termTitle = document.getElementById('dba-top-progress-meta-term');
    const btnSync = document.getElementById('dba-top-progress-sync-now');
    const infoAuto = document.getElementById('dba-top-progress-info-auto');
    const matchLabel = document.getElementById('dba-top-progress-match-label');
    const matchTime  = document.getElementById('dba-top-progress-match-time');

    if(!matchInner) return;
    let needsHeightSync = false;

    const termPct = estimateTopElapsedProgressPct();
    if(DBA_TOP_PROGRESS_RENDER_CACHE.termPct !== termPct){
      DBA_TOP_PROGRESS_RENDER_CACHE.termPct = termPct;
    }

    // ===== 試合番号 / 残り時間 / 試合プログレス =====
    // 期percentを毎回そのまま使うのではなく、同期時に作ったアンカーを基準に進める
    try{
      const st = getAnchoredMatchProgressState();
      if(st){
        const m = Math.floor(st.remainSec / 60);
        const s = Math.floor(st.remainSec % 60);
        const matchLabelText = `第 ${st.matchNo} 試合／${st.totalMatches}`;
        const matchTimeText = `残り: ${m}分${s}秒（誤差あり）`;

        if(matchLabel){
          if(DBA_TOP_PROGRESS_RENDER_CACHE.matchLabel !== matchLabelText){
            DBA_TOP_PROGRESS_RENDER_CACHE.matchLabel = matchLabelText;
            matchLabel.textContent = matchLabelText;
          }
        }
        if(matchTime){
          if(DBA_TOP_PROGRESS_RENDER_CACHE.matchTime !== matchTimeText){
            DBA_TOP_PROGRESS_RENDER_CACHE.matchTime = matchTimeText;
            matchTime.textContent = matchTimeText;
          }
        }
        if(matchInner){
          const mp = Math.floor(st.matchPct);
          if(DBA_TOP_PROGRESS_RENDER_CACHE.matchPct !== mp){
            DBA_TOP_PROGRESS_RENDER_CACHE.matchPct = mp;
            matchInner.style.width = `${mp}%`;
            matchInner.textContent = `${mp}%`;
          }
        }
      }else{
        const matchLabelText = '第 1 試合／?';
        const matchTimeText = '残り: --分--秒（誤差あり）';
        if(matchLabel){
          if(DBA_TOP_PROGRESS_RENDER_CACHE.matchLabel !== matchLabelText){
            DBA_TOP_PROGRESS_RENDER_CACHE.matchLabel = matchLabelText;
            matchLabel.textContent = matchLabelText;
          }
        }
        if(matchTime){
          if(DBA_TOP_PROGRESS_RENDER_CACHE.matchTime !== matchTimeText){
            DBA_TOP_PROGRESS_RENDER_CACHE.matchTime = matchTimeText;
            matchTime.textContent = matchTimeText;
          }
        }
        if(matchInner){
          if(DBA_TOP_PROGRESS_RENDER_CACHE.matchPct !== 0){
            DBA_TOP_PROGRESS_RENDER_CACHE.matchPct = 0;
            matchInner.style.width = '0%';
            matchInner.textContent = '0%';
          }
        }
      }
    }catch(_e){}

    // 期（第 xxxx 期）表示を最新保存値で更新
    if(termTitle){
      const d0 = loadTopElapsedProgress();
      const titleText = (d0 && d0.term) ? d0.term : '第 ? 期';
      if(DBA_TOP_PROGRESS_RENDER_CACHE.termTitle !== titleText){
        DBA_TOP_PROGRESS_RENDER_CACHE.termTitle = titleText;
        termTitle.textContent = titleText;
        needsHeightSync = true;
      }
    }

    // 「同期」ボタン状態
    if(btnSync){
      const inflight = !!DBA_TOP_PROGRESS_AUTOSYNC.inFlight;
      const syncText = inflight ? '同期中…' : '同期';
      if(DBA_TOP_PROGRESS_RENDER_CACHE.syncDisabled !== inflight){
        DBA_TOP_PROGRESS_RENDER_CACHE.syncDisabled = inflight;
        btnSync.disabled = inflight;
      }
      if(DBA_TOP_PROGRESS_RENDER_CACHE.syncText !== syncText){
        DBA_TOP_PROGRESS_RENDER_CACHE.syncText = syncText;
        btnSync.textContent = syncText;
        needsHeightSync = true;
      }
    }

    // レイアウトに影響する更新があった時だけ fnbar 高さを再同期
    if(needsHeightSync){
      try{ scheduleFnbarHeightSync(); }catch(_e){}
    }

    updateTopProgressPopupContent();
  }

  // =========================
  // トップページ進捗：同期制御
  // 方針：
  //  - 通常時はローカル時計で進める
  //  - 自動同期は「試合境界の前後」だけ行う
  //  - ただし、長時間未同期の時だけ低頻度の保険的な同期を行う
  //  - タブ復帰 / ページ復帰後、一定時間以上止まっていたら再同期候補を取る
  //  - 手動同期/自動同期とも、取得結果が有用な場合だけ採用し、
  //    ズレが大きく連続性に欠ける場合は破棄する
  //  - 同期は「試合境界の前後」ではなく、「その試合の中で決めた時点」に行う
  //  - RB は「切替直後 + 終盤安全帯 1回」を基本とする
  //  - HC / ラダーは「切替直後 + 中間 1回」を基本とし、終盤は条件付きの保険にする
  //  - タブ復帰 / ページ復帰は即同期せず、終盤保険を許可する条件として扱う
  // =========================
  const DBA_TOP_PROGRESS_SYNC_ACCEPT_SEC = 60;                     // 通常時の許容ズレ
  const DBA_TOP_PROGRESS_SYNC_ACCEPT_SEC_NEAR_BOUNDARY = 60;      // 期切替付近の許容ズレ
  const DBA_TOP_PROGRESS_SYNC_ACCEPT_SEC_LATE = 45;               // 終盤同期の許容ズレ
  const DBA_BATTLEINFO_RB_BOUNDARY_RETRY_WINDOW_SEC = 45;         // RBの「戦況情報」クリック時、境界直後の旧マップ掴みを再確認する範囲
  const DBA_BATTLEINFO_RB_BOUNDARY_RETRY_DELAYS_MS = [1500, 2500, 3500, 4500, 5500, 6500, 7500]; // 合計31.5秒
  const DBA_TOP_PROGRESS_RECENT_SYNC_SUPPRESS_MS = 90 * 1000;     // 直近同期後の自動同期抑止
  const DBA_TOP_PROGRESS_RESUME_SYNC_MIN_PAUSE_MS = 45 * 1000;    // 復帰イベントとして記録する最小停止時間
  const DBA_TOP_PROGRESS_RESUME_SYNC_COOLDOWN_MS = 90 * 1000;     // 復帰イベント記録の連発抑止
  const DBA_TOP_PROGRESS_MATCH_START_SYNC_SUPPRESS_MS = 20 * 1000; // 切替直後同期の近接抑止
  const DBA_TOP_PROGRESS_MATCH_SWITCH_GUARD_MS = 8 * 1000;        // 切替直後、他phase判定を待つ時間
  const DBA_TOP_PROGRESS_RB_LATE_MIN_SEC = 180;                   // RB 終盤同期：残り3分00秒
  const DBA_TOP_PROGRESS_RB_LATE_MAX_SEC = 270;                   // RB 終盤同期：残り4分30秒
  const DBA_TOP_PROGRESS_RB_RESCUE_MIN_SEC = 60;                  // RB 保険同期：残り1分00秒
  const DBA_TOP_PROGRESS_RB_RESCUE_MAX_SEC = 120;                 // RB 保険同期：残り2分00秒
  const DBA_TOP_PROGRESS_HCL_MID_MIN_SEC = 600;                   // HC/L 中間同期：残り10分00秒
  const DBA_TOP_PROGRESS_HCL_MID_MAX_SEC = 720;                   // HC/L 中間同期：残り12分00秒
  const DBA_TOP_PROGRESS_HCL_LATE_MIN_SEC = 180;                  // HC/L 終盤保険：残り3分00秒
  const DBA_TOP_PROGRESS_HCL_LATE_MAX_SEC = 270;                  // HC/L 終盤保険：残り4分30秒
  const DBA_TOP_PROGRESS_HCL_FORCE_RESCUE_AFTER_MS = 12 * 60 * 1000; // HC/L 長時間未補正で終盤保険を許可
  const DBA_TOP_PROGRESS_AUTOSYNC = {
    inFlight: false,
    doneAt: 0,
    lastManualAt: 0,
    lastAutoAt: 0, // 最終補正（自動）専用
    lastRejectedAt: 0,
    lastResumeAt: 0,
    hiddenAt: 0,
    lastTickAt: 0,
    failCount: 0,
    nextRetryAt: 0
  };

  const DBA_MATCH_SYNC_PLAN = {
    matchKey: '',
    mode: '',
    term: '',
    matchNo: 0,
    startedAt: 0,
    switchedAt: 0,
    lastAcceptedAt: 0,
    startDone: false,
    midDone: false,
    lateDone: false,
    rescueDone: false,
    midScheduledRemainSec: null,
    lateScheduledRemainSec: null,
    rbRescueScheduledRemainSec: null,
    midWindowMissed: false,
    lateWindowMissed: false,
    rbRescueWindowMissed: false,
    lastSyncReason: '',
    hadFailureInThisMatch: false,
    hadResumeEventInThisMatch: false,
    pendingResumeEventAt: 0
  };

  function pctToElapsedSecond(pct){
    // 0..100% -> 0..3599秒（floor）
    const p = Math.max(0, Math.min(100, Number(pct)));
    const sec = Math.floor((p / 100) * 60 * 60);
    return clampInt(sec, 0, 3599);
  }

  function getTopProgressIdleSyncMsByMode(){
    return (mode === 'rb')
      ? DBA_TOP_PROGRESS_IDLE_SYNC_MS_RB
      : DBA_TOP_PROGRESS_IDLE_SYNC_MS_HC_L;
  }

  function hasRecentAcceptedOrManualTopSync(now){
    const currentNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();

    const lastManualAgoMs = currentNow - Number(DBA_TOP_PROGRESS_AUTOSYNC.lastManualAt || 0);
    const hadRecentManualSync =
      DBA_TOP_PROGRESS_AUTOSYNC.lastManualAt > 0 &&
      lastManualAgoMs >= 0 &&
      lastManualAgoMs <= DBA_TOP_PROGRESS_RECENT_SYNC_SUPPRESS_MS;

    const lastAcceptedAgoMs = currentNow - Number(DBA_TOP_PROGRESS_AUTOSYNC.doneAt || 0);
    const hadRecentAcceptedSync =
      DBA_TOP_PROGRESS_AUTOSYNC.doneAt > 0 &&
      lastAcceptedAgoMs >= 0 &&
      lastAcceptedAgoMs <= DBA_TOP_PROGRESS_RECENT_SYNC_SUPPRESS_MS;

    return hadRecentManualSync || hadRecentAcceptedSync;
  }

  function noteTopProgressResumeEvent(reason, pauseMs){
    const currentNow = Date.now();
    const stoppedMs = Math.max(0, Number(pauseMs || 0));
    if(stoppedMs < DBA_TOP_PROGRESS_RESUME_SYNC_MIN_PAUSE_MS) return false;
    if(!ensureMatchSyncPlan(getAnchoredMatchProgressState(), currentNow)) return false;
    if(!noteResumeEventForCurrentMatch(currentNow)) return false;
    void reason;
    return true;
  }

  function installTopProgressResumeHooks(){
    if(document.documentElement.dataset.dbaTopProgressResumeHookBound === '1') return;
    document.documentElement.dataset.dbaTopProgressResumeHookBound = '1';

    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'hidden'){
        DBA_TOP_PROGRESS_AUTOSYNC.hiddenAt = Date.now();
        return;
      }

      const hiddenAt = Number(DBA_TOP_PROGRESS_AUTOSYNC.hiddenAt || 0);
      const pauseMs = hiddenAt > 0 ? (Date.now() - hiddenAt) : 0;
      DBA_TOP_PROGRESS_AUTOSYNC.hiddenAt = 0;
      noteTopProgressResumeEvent('visibility', pauseMs);
    });

    window.addEventListener('focus', () => {
      const lastTickAt = Number(DBA_TOP_PROGRESS_AUTOSYNC.lastTickAt || 0);
      const pauseMs = lastTickAt > 0 ? (Date.now() - lastTickAt) : 0;
      noteTopProgressResumeEvent('focus', pauseMs);
    }, true);

    window.addEventListener('pageshow', (e) => {
      const persisted = !!(e && e.persisted);
      const lastTickAt = Number(DBA_TOP_PROGRESS_AUTOSYNC.lastTickAt || 0);
      const pauseMs = lastTickAt > 0 ? (Date.now() - lastTickAt) : 0;
      if(persisted || pauseMs >= DBA_TOP_PROGRESS_RESUME_SYNC_MIN_PAUSE_MS){
        noteTopProgressResumeEvent('pageshow', pauseMs);
      }
    });
  }

  function getExpectedElapsedSecondFromCurrentMatchState(){
    const st = getAnchoredMatchProgressState();
    if(!st) return null;
    const spec = getMatchSpecByMode();
    const matchSec = Math.max(1, Number(spec.matchSec || 1));
    const v = ((Math.max(1, Number(st.matchNo || 1)) - 1) * matchSec) + Number(st.inMatchSec || 0);
    return normalizeElapsedSecondInTerm(v);
  }

  function buildCurrentMatchSyncKey(matchState, termText){
    const st = matchState || getAnchoredMatchProgressState();
    const term = String(termText != null ? termText : (loadTopElapsedProgress()?.term || '') || '');
    if(!st || !term) return '';
    const matchNo = Math.max(1, Number(st.matchNo || 1));
    return `${String(mode || '')}|${term}|${matchNo}`;
  }

  function randIntInclusive(min, max, salt){
    const lo = Math.min(Number(min || 0), Number(max || 0));
    const hi = Math.max(Number(min || 0), Number(max || 0));
    const span = Math.max(1, Math.floor(hi - lo + 1));

    let seed = 0x9e3779b9;
    const text = String(salt || '');
    for(let i = 0; i < text.length; i++){
      seed = Math.imul(seed ^ text.charCodeAt(i), 0x85ebca6b) >>> 0;
      seed = ((seed << 13) | (seed >>> 19)) >>> 0;
    }

    const value = rand01(seed);
    return Math.floor(lo + (value * span));
  }

  function shouldAllowLateRescueForCurrentMatch(now){
    const currentNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    if(mode === 'rb') return false;

    if(DBA_MATCH_SYNC_PLAN.hadFailureInThisMatch) return true;
    if(DBA_MATCH_SYNC_PLAN.hadResumeEventInThisMatch) return true;
    if(DBA_MATCH_SYNC_PLAN.midWindowMissed) return true;

    const baseAt = Math.max(
      Number(DBA_MATCH_SYNC_PLAN.lastAcceptedAt || 0),
      Number(DBA_TOP_PROGRESS_AUTOSYNC.lastManualAt || 0),
      Number(DBA_TOP_PROGRESS_AUTOSYNC.doneAt || 0)
    );
    if(baseAt > 0 && (currentNow - baseAt) >= DBA_TOP_PROGRESS_HCL_FORCE_RESCUE_AFTER_MS){
      return true;
    }

    return false;
  }

  function resetMatchSyncPlan(){
    DBA_MATCH_SYNC_PLAN.matchKey = '';
    DBA_MATCH_SYNC_PLAN.mode = String(mode || '');
    DBA_MATCH_SYNC_PLAN.term = '';
    DBA_MATCH_SYNC_PLAN.matchNo = 0;
    DBA_MATCH_SYNC_PLAN.startedAt = 0;
    DBA_MATCH_SYNC_PLAN.switchedAt = 0;
    DBA_MATCH_SYNC_PLAN.lastAcceptedAt = 0;
    DBA_MATCH_SYNC_PLAN.startDone = false;
    DBA_MATCH_SYNC_PLAN.midDone = false;
    DBA_MATCH_SYNC_PLAN.lateDone = false;
    DBA_MATCH_SYNC_PLAN.rescueDone = false;
    DBA_MATCH_SYNC_PLAN.midScheduledRemainSec = null;
    DBA_MATCH_SYNC_PLAN.lateScheduledRemainSec = null;
    DBA_MATCH_SYNC_PLAN.rbRescueScheduledRemainSec = null;
    DBA_MATCH_SYNC_PLAN.midWindowMissed = false;
    DBA_MATCH_SYNC_PLAN.lateWindowMissed = false;
    DBA_MATCH_SYNC_PLAN.rbRescueWindowMissed = false;
    DBA_MATCH_SYNC_PLAN.lastSyncReason = '';
    DBA_MATCH_SYNC_PLAN.hadFailureInThisMatch = false;
    DBA_MATCH_SYNC_PLAN.hadResumeEventInThisMatch = false;
    DBA_MATCH_SYNC_PLAN.pendingResumeEventAt = 0;
  }

  function initializeMatchSyncPlan(matchState, now){
    const st = matchState || getAnchoredMatchProgressState();
    if(!st) return false;

    const currentNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const term = String(loadTopElapsedProgress()?.term || '');
    const key = buildCurrentMatchSyncKey(st, term);
    if(!key) return false;
    if(DBA_MATCH_SYNC_PLAN.matchKey === key) return false;

    const prevAcceptedAt = Number(DBA_TOP_PROGRESS_AUTOSYNC.doneAt || 0);
    const prevManualAt = Number(DBA_TOP_PROGRESS_AUTOSYNC.lastManualAt || 0);
    const recentAccepted = prevAcceptedAt > 0 && (currentNow - prevAcceptedAt) <= DBA_TOP_PROGRESS_MATCH_START_SYNC_SUPPRESS_MS;
    const recentManual = prevManualAt > 0 && (currentNow - prevManualAt) <= DBA_TOP_PROGRESS_MATCH_START_SYNC_SUPPRESS_MS;

    resetMatchSyncPlan();
    DBA_MATCH_SYNC_PLAN.matchKey = key;
    DBA_MATCH_SYNC_PLAN.mode = String(mode || '');
    DBA_MATCH_SYNC_PLAN.term = term;
    DBA_MATCH_SYNC_PLAN.matchNo = Math.max(1, Number(st.matchNo || 1));
    DBA_MATCH_SYNC_PLAN.startedAt = currentNow;
    DBA_MATCH_SYNC_PLAN.switchedAt = currentNow;
    DBA_MATCH_SYNC_PLAN.lastAcceptedAt = prevAcceptedAt;
    DBA_MATCH_SYNC_PLAN.startDone = recentAccepted || recentManual;

    if(mode === 'rb'){
      DBA_MATCH_SYNC_PLAN.lateScheduledRemainSec = randIntInclusive(
        DBA_TOP_PROGRESS_RB_LATE_MIN_SEC,
        DBA_TOP_PROGRESS_RB_LATE_MAX_SEC,
        `${key}|late`
      );
      DBA_MATCH_SYNC_PLAN.rbRescueScheduledRemainSec = randIntInclusive(
        DBA_TOP_PROGRESS_RB_RESCUE_MIN_SEC,
        DBA_TOP_PROGRESS_RB_RESCUE_MAX_SEC,
        `${key}|rb-rescue`
      );
    }else{
      DBA_MATCH_SYNC_PLAN.midScheduledRemainSec = randIntInclusive(
        DBA_TOP_PROGRESS_HCL_MID_MIN_SEC,
        DBA_TOP_PROGRESS_HCL_MID_MAX_SEC,
        `${key}|mid`
      );
      DBA_MATCH_SYNC_PLAN.lateScheduledRemainSec = randIntInclusive(
        DBA_TOP_PROGRESS_HCL_LATE_MIN_SEC,
        DBA_TOP_PROGRESS_HCL_LATE_MAX_SEC,
        `${key}|late`
      );
    }

    return true;
  }

  function ensureMatchSyncPlan(matchState, now){
    const st = matchState || getAnchoredMatchProgressState();
    if(!st) return false;
    const term = String(loadTopElapsedProgress()?.term || '');
    const key = buildCurrentMatchSyncKey(st, term);
    if(!key) return false;
    if(DBA_MATCH_SYNC_PLAN.matchKey !== key){
      initializeMatchSyncPlan(st, now);
    }
    return DBA_MATCH_SYNC_PLAN.matchKey === key;
  }

  function noteResumeEventForCurrentMatch(now){
    const currentNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    if(DBA_TOP_PROGRESS_AUTOSYNC.lastResumeAt > 0){
      const agoMs = currentNow - Number(DBA_TOP_PROGRESS_AUTOSYNC.lastResumeAt || 0);
      if(agoMs >= 0 && agoMs <= DBA_TOP_PROGRESS_RESUME_SYNC_COOLDOWN_MS){
        return false;
      }
    }

    DBA_TOP_PROGRESS_AUTOSYNC.lastResumeAt = currentNow;
    DBA_MATCH_SYNC_PLAN.pendingResumeEventAt = currentNow;
    DBA_MATCH_SYNC_PLAN.hadResumeEventInThisMatch = true;
    return true;
  }

  function shouldConsumeResumeEventForCurrentMatch(now){
    const currentNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const pendingAt = Number(DBA_MATCH_SYNC_PLAN.pendingResumeEventAt || 0);
    if(!(pendingAt > 0)) return false;
    if((currentNow - pendingAt) > DBA_TOP_PROGRESS_RESUME_SYNC_COOLDOWN_MS){
      DBA_MATCH_SYNC_PLAN.pendingResumeEventAt = 0;
      return false;
    }
    return true;
  }

  function markMatchSyncAccepted(reason, now){
    const currentNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    DBA_MATCH_SYNC_PLAN.lastAcceptedAt = currentNow;
    DBA_MATCH_SYNC_PLAN.lastSyncReason = String(reason || '');
    DBA_MATCH_SYNC_PLAN.pendingResumeEventAt = 0;

    const rs = String(reason || '');
    if(rs === 'start-switch'){
      DBA_MATCH_SYNC_PLAN.startDone = true;
      return;
    }
    if(rs === 'rb-late'){
      DBA_MATCH_SYNC_PLAN.lateDone = true;
      return;
    }
    if(rs === 'rb-rescue'){
      DBA_MATCH_SYNC_PLAN.rescueDone = true;
      return;
    }
    if(rs === 'hc-mid' || rs === 'l-mid'){
      DBA_MATCH_SYNC_PLAN.midDone = true;
      return;
    }
    if(rs === 'hc-late-rescue' || rs === 'l-late-rescue'){
      DBA_MATCH_SYNC_PLAN.lateDone = true;
      return;
    }
  }

  function markMatchSyncFailure(reason){
    const rs = String(reason || '');
    if(!rs || rs === 'manual' || rs === 'unsynced') return;
    DBA_MATCH_SYNC_PLAN.hadFailureInThisMatch = true;
  }

  function consumeMatchSyncPhase(state, now){
    const currentNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const st = state || getAnchoredMatchProgressState();
    if(!st) return null;
    if(!ensureMatchSyncPlan(st, currentNow)) return null;
    if(currentNow < Number(DBA_TOP_PROGRESS_AUTOSYNC.nextRetryAt || 0)) return null;
    if(DBA_TOP_PROGRESS_AUTOSYNC.inFlight) return null;

    const matchAgeMs = currentNow - Number(DBA_MATCH_SYNC_PLAN.switchedAt || 0);
    const remainSec = Math.max(0, Number(st.remainSec || 0));
    const shouldAllowStart = !DBA_MATCH_SYNC_PLAN.startDone && matchAgeMs >= 0;

    if(shouldAllowStart){
      const recentAccepted = DBA_TOP_PROGRESS_AUTOSYNC.doneAt > 0
        && (currentNow - Number(DBA_TOP_PROGRESS_AUTOSYNC.doneAt || 0)) <= DBA_TOP_PROGRESS_MATCH_START_SYNC_SUPPRESS_MS;
      const recentManual = DBA_TOP_PROGRESS_AUTOSYNC.lastManualAt > 0
        && (currentNow - Number(DBA_TOP_PROGRESS_AUTOSYNC.lastManualAt || 0)) <= DBA_TOP_PROGRESS_MATCH_START_SYNC_SUPPRESS_MS;
      if(recentAccepted || recentManual){
        DBA_MATCH_SYNC_PLAN.startDone = true;
      }else{
        return 'start-switch';
      }
    }

    if(matchAgeMs < DBA_TOP_PROGRESS_MATCH_SWITCH_GUARD_MS) return null;
    if(hasRecentAcceptedOrManualTopSync(currentNow)) return null;

    if(mode === 'rb'){
      const lateTarget = Number(DBA_MATCH_SYNC_PLAN.lateScheduledRemainSec || 0);
      if(!DBA_MATCH_SYNC_PLAN.lateDone && lateTarget > 0){
        if(remainSec <= lateTarget){
          return 'rb-late';
        }
      }
      if(!DBA_MATCH_SYNC_PLAN.lateDone && !DBA_MATCH_SYNC_PLAN.midDone && lateTarget > 0 && remainSec < DBA_TOP_PROGRESS_RB_LATE_MIN_SEC){
        DBA_MATCH_SYNC_PLAN.lateWindowMissed = true;
      }

      const rescueTarget = Number(DBA_MATCH_SYNC_PLAN.rbRescueScheduledRemainSec || 0);
      const rescueAllowed =
        !DBA_MATCH_SYNC_PLAN.rescueDone &&
        DBA_MATCH_SYNC_PLAN.hadFailureInThisMatch &&
        DBA_MATCH_SYNC_PLAN.lateWindowMissed;
      if(rescueAllowed && rescueTarget > 0 && remainSec <= rescueTarget){
        return 'rb-rescue';
      }
      if(rescueAllowed && rescueTarget > 0 && remainSec < DBA_TOP_PROGRESS_RB_RESCUE_MIN_SEC){
        DBA_MATCH_SYNC_PLAN.rbRescueWindowMissed = true;
      }
      return null;
    }

    const midTarget = Number(DBA_MATCH_SYNC_PLAN.midScheduledRemainSec || 0);
    if(!DBA_MATCH_SYNC_PLAN.midDone && midTarget > 0){
      if(remainSec <= midTarget){
        return `${mode}-mid`;
      }
    }
    if(!DBA_MATCH_SYNC_PLAN.midDone && midTarget > 0 && remainSec < DBA_TOP_PROGRESS_HCL_MID_MIN_SEC){
      DBA_MATCH_SYNC_PLAN.midWindowMissed = true;
    }

    const allowLateRescue = shouldAllowLateRescueForCurrentMatch(currentNow) || shouldConsumeResumeEventForCurrentMatch(currentNow);
    const lateTarget = Number(DBA_MATCH_SYNC_PLAN.lateScheduledRemainSec || 0);
    if(allowLateRescue && !DBA_MATCH_SYNC_PLAN.lateDone && lateTarget > 0){
      if(remainSec <= lateTarget){
        return `${mode}-late-rescue`;
      }
    }
    if(allowLateRescue && !DBA_MATCH_SYNC_PLAN.lateDone && lateTarget > 0 && remainSec < DBA_TOP_PROGRESS_HCL_LATE_MIN_SEC){
      DBA_MATCH_SYNC_PLAN.lateWindowMissed = true;
      DBA_MATCH_SYNC_PLAN.pendingResumeEventAt = 0;
    }

    return null;
  }

  function getNearestMatchBoundaryInfo(elapsedSec){
    const spec = getMatchSpecByMode();
    const matchSec = Math.max(1, Number(spec.matchSec || 1));
    const cur = normalizeElapsedSecondInTerm(elapsedSec);
    const nearest = getNearestMatchBoundarySecond(cur, matchSec);

    let signedDelta = cur - nearest;
    if(signedDelta > 1800) signedDelta -= 3600;
    if(signedDelta < -1800) signedDelta += 3600;

    return {
      nearestSecond: nearest,
      signedDeltaSec: signedDelta,
      distanceSec: Math.abs(signedDelta),
      key: `${matchSec}:${nearest}`
    };
  }

  function isNearMatchBoundary(elapsedSec, padSec){
    const info = getNearestMatchBoundaryInfo(elapsedSec);
    return info.distanceSec <= Math.max(0, Number(padSec || 0));
  }

  function evaluateTopProgressSyncCandidate(pct, term, reason){
    const nextElapsedSec = pctToElapsedSecond(pct);
    const currentElapsedSec = getExpectedElapsedSecondFromCurrentMatchState();
    const currentData = loadTopElapsedProgress();
    const isManual = (String(reason || '') === 'manual');
    const anchorExpired = isMatchProgressAnchorExpired(Date.now());

    if(currentElapsedSec == null || anchorExpired){
      return {
        accept: true,
        elapsedSec: nextElapsedSec,
        reason: (currentElapsedSec == null) ? 'no-current-anchor' : 'expired-anchor'
      };
    }

    if(
      currentData &&
      currentData.term &&
      term &&
      String(currentData.term) !== String(term)
    ){
      const allowAcrossTermBoundary =
        isNearMatchBoundary(currentElapsedSec, DBA_TOP_PROGRESS_SYNC_ACCEPT_SEC_NEAR_BOUNDARY) ||
        isNearMatchBoundary(nextElapsedSec, DBA_TOP_PROGRESS_SYNC_ACCEPT_SEC_NEAR_BOUNDARY);

      if(!allowAcrossTermBoundary){
        return {
          accept: isManual,
          elapsedSec: nextElapsedSec,
          reason: isManual
            ? `manual-override-term-mismatch:${String(reason || '')}`
            : `term-mismatch:${String(reason || '')}`
        };
      }
    }

    const rs = String(reason || '');
    const isLateSync = (
      rs === 'rb-late' ||
      rs === 'rb-rescue' ||
      rs === 'hc-late-rescue' ||
      rs === 'l-late-rescue'
    );
    const allowSec = isLateSync
      ? DBA_TOP_PROGRESS_SYNC_ACCEPT_SEC_LATE
      : DBA_TOP_PROGRESS_SYNC_ACCEPT_SEC;

    const driftSec = getCircularSecondDistance(nextElapsedSec, currentElapsedSec);
    if(driftSec > allowSec){
      return {
        accept: false,
        elapsedSec: nextElapsedSec,
        reason: `drift=${driftSec}s:${String(reason || '')}`
      };
    }

    return {
      accept: true,
      elapsedSec: nextElapsedSec,
      reason: isLateSync ? 'accept-late' : 'accept-normal'
    };
  }

  async function fetchTopElapsedProgressFromTopPageOnce(reason){
    if(DBA_TOP_PROGRESS_AUTOSYNC.inFlight) return false;

    const now = Date.now();
    const isManual = (String(reason || '') === 'manual');
    if(!isManual && now < Number(DBA_TOP_PROGRESS_AUTOSYNC.nextRetryAt || 0)){
      return false;
    }

    DBA_TOP_PROGRESS_AUTOSYNC.inFlight = true;
    try{
      // メタ表示を更新（見た目だけ）
      try{ renderTopProgress(); }catch(_e){}

      const res = await fetch(makeTopPageUrl(), {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      });
      if(!res.ok) return false;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const pct = parseElapsedProgressPctFromTopDoc(doc);
      if(pct == null) return false;
      const term = parseElapsedTermFromTopDoc(doc);
      const judged = evaluateTopProgressSyncCandidate(pct, term, reason);

      if(!judged.accept){
        if(isManual){
          DBA_TOP_PROGRESS_AUTOSYNC.lastManualAt = Date.now();
          // 手動同期で候補が棄却された場合でも、アンカー期限切れなら
          // ローカル側を保存値基準へ立て直して「99%張り付き」を避ける。
          if(isMatchProgressAnchorExpired(Date.now())){
            try{
              saveTopElapsedProgress(pct, term);
              setMatchProgressAnchorFromElapsedSec(
                pctToElapsedSecond(pct),
                term
              );
              DBA_TOP_PROGRESS_AUTOSYNC.doneAt = Date.now();
              DBA_TOP_PROGRESS_AUTOSYNC.failCount = 0;
              DBA_TOP_PROGRESS_AUTOSYNC.nextRetryAt = 0;
            }catch(_e){}
          }
        }
        DBA_TOP_PROGRESS_AUTOSYNC.lastRejectedAt = Date.now();
        markMatchSyncFailure(reason);
        try{ renderTopProgress(); }catch(_e){}
        return false;
      }

      saveTopElapsedProgress(pct, term);
      DBA_TOP_PROGRESS_AUTOSYNC.doneAt = Date.now();
      try{
        setMatchProgressAnchorFromElapsedSec(
          pctToElapsedSecond(pct),
          term
        );
      }catch(_e){}
      if(isManual){
        DBA_TOP_PROGRESS_AUTOSYNC.lastManualAt = DBA_TOP_PROGRESS_AUTOSYNC.doneAt;
      }
      DBA_TOP_PROGRESS_AUTOSYNC.failCount = 0;
      DBA_TOP_PROGRESS_AUTOSYNC.nextRetryAt = 0;
      // manual 以外は「自動補正」としても記録
      if(String(reason || '') !== 'manual'){
        DBA_TOP_PROGRESS_AUTOSYNC.lastAutoAt = DBA_TOP_PROGRESS_AUTOSYNC.doneAt;
        markMatchSyncAccepted(reason, DBA_TOP_PROGRESS_AUTOSYNC.doneAt);
      }

      // 反映（「期」側だけでなく「試合」側プログレスバーもここで更新）
      try{ renderTopProgress(); }catch(_e){}
      return true;
    }catch(_e){
      const failCount = Math.max(0, Number(DBA_TOP_PROGRESS_AUTOSYNC.failCount || 0)) + 1;
      DBA_TOP_PROGRESS_AUTOSYNC.failCount = failCount;
      const retryMs = Math.min(60000, 5000 * failCount);
      DBA_TOP_PROGRESS_AUTOSYNC.nextRetryAt = Date.now() + retryMs;
      return false;
    }finally{
      DBA_TOP_PROGRESS_AUTOSYNC.inFlight = false;
      // reason はログ用途（必要なら dbgLog に流してもOK）
      void reason;
    }
  }

  function maybeAutoSyncTopProgress(){
    // まだコンテナが無い/表示不要なら何もしない
    if(!document.getElementById('dba-top-progress-match-inner')) return;

    const now = Date.now();
    DBA_TOP_PROGRESS_AUTOSYNC.lastTickAt = now;
    if(now < Number(DBA_TOP_PROGRESS_AUTOSYNC.nextRetryAt || 0)){
      return;
    }

    const data = loadTopElapsedProgress();

    // 未同期：1回だけ自動補正
    if(!data){
      if(DBA_TOP_PROGRESS_AUTOSYNC.doneAt === 0 && !DBA_TOP_PROGRESS_AUTOSYNC.inFlight){
        fetchTopElapsedProgressFromTopPageOnce('unsynced').catch(()=>{});
      }
      return;
    }

    const st = getAnchoredMatchProgressState();
    if(!st) return;
    ensureMatchSyncPlan(st, now);

    const reason = consumeMatchSyncPhase(st, now);
    if(!reason) return;

    fetchTopElapsedProgressFromTopPageOnce(reason).catch(()=>{});
  }

  let DBA_TOP_PROGRESS_TID = 0;
  function startTopProgressTicker(){
    if(DBA_TOP_PROGRESS_TID) return;
    installTopProgressResumeHooks();
    // 初回描画
    try{ syncMatchProgressAnchorFromStoredTopProgress(); }catch(_e){}
    DBA_TOP_PROGRESS_AUTOSYNC.lastTickAt = Date.now();
    renderTopProgress();
    // 軽めに 1s 更新（見た目の「進行感」用）
    DBA_TOP_PROGRESS_TID = window.setInterval(() => {
      try{
        renderTopProgress();
        maybeAutoSyncTopProgress();
      }catch(_e){}
    }, 1000);
  }

  function parseElapsedProgressPctFromTopDoc(doc){
    if(!doc) return null;
    // 例: 「経過時間: 第 xxxx 期」の直後に progress-bar が来る（添付HTML） :contentReference[oaicite:3]{index=3}
    const candidates = Array.from(doc.querySelectorAll('.progress-bar'));
    if(candidates.length === 0) return null;

    // 優先：親テキストに「経過時間」を含むもの
    let best = null;
    for(const pb of candidates){
      const parentText = sanitizeText(pb.parentElement ? pb.parentElement.textContent : '');
      if(parentText.includes('経過時間')){
        best = pb;
        break;
      }
    }
    if(!best) best = candidates[0];

    const inner = best.querySelector('div');
    if(!inner) return null;
    // text "88%" か style width "width:88%" のどちらかから読む
    const t = sanitizeText(inner.textContent || '');
    const m1 = t.match(/(\d+)\s*%/);
    if(m1) return clampInt(Number(m1[1]), 0, 100);

    const st = String(inner.getAttribute('style') || '');
    const m2 = st.match(/width\s*:\s*(\d+)\s*%/i);
    if(m2) return clampInt(Number(m2[1]), 0, 100);

    return null;
  }

  function parseElapsedTermFromTopDoc(doc){
    // 例: "経過時間: 第 15816 期"（添付HTML） :contentReference[oaicite:7]{index=7}
    if(!doc) return '';
    const candidates = Array.from(doc.querySelectorAll('.progress-bar'));
    if(candidates.length === 0) return '';

    // 優先：親テキストに「経過時間」を含むもの
    let best = null;
    for(const pb of candidates){
      const parentText = sanitizeText(pb.parentElement ? pb.parentElement.textContent : '');
      if(parentText.includes('経過時間')){
        best = pb;
        break;
      }
    }
    if(!best) best = candidates[0];

    const parentText = sanitizeText(best.parentElement ? best.parentElement.textContent : '');
    // parentText には "経過時間: 第 15816 期 88%" のように混ざるので、"第 n 期" 部分だけ抜く
    const m = parentText.match(/(第\s*\d+\s*期)/);
    return m ? sanitizeText(m[1]) : '';
  }

  function captureTopPageElapsedProgress(){
    try{
      const pct = parseElapsedProgressPctFromTopDoc(document);
      if(pct == null) return false;
      const term = parseElapsedTermFromTopDoc(document);
      // 保存（＝teambattle側の表示を補正する基準）
      saveTopElapsedProgress(pct, term);
      try{
        setMatchProgressAnchorFromElapsedSec(
          pctToElapsedSecond(pct),
          term
        );
      }catch(_e){}
      return true;
    }catch(_e){
      return false;
    }
  }

  // セルサイズ及びレイヤー文字濃度のデフォルト値
  const DEFAULT_SETTINGS = {
    // セルサイズ（width、heightを px で指定）
    cellSize: {
      rb: { width: 64, height: 64 },
      hc: { width: 72, height: 64 },
      l:  { width: 72, height: 64 }
    },
    // DBA全体の基準文字サイズ
    ui: { baseFontPx: getDefaultBaseFontPxForDevice() },
    // 攻撃後の自動差分取得
    postBattle: {
      autoDiffSync: false,
      suppressOwnCapitalFriendlyFire: false
    },
    // 一定回数ごとにページ再読込して軽量化
    lightRefresh: {
      enabled: false,
      battleCount: 20
    },
    // ファンクションセクションの軽量化ボタン表示
    functionButtons: {
      showLightRefreshButton: false
    },
    // レッドvsブルー：Reg.表示・境界線・アニメーション・首都王冠・誰もいない
    rbLayer: {
      showCellRegulation: false,
      showOriginalBorder: false,
      borderOpacity: 80,
      stopAnimation: false,
      showCapitalCrown: false,
      showCurrentCellMarker: false,
      currentCellMarkerColor: 'silver',
      currentCellMarkerDelayMs: 500,
      showNobodyHolder: false,
      hideFnTooltip: false
    },
    // レイヤー文字濃度（範囲：0?100）
    layer: { textOpacity: 100 },
    // オリジナルHTMLの<header>要素を表示するか
    header: { showOriginalHeader: false }
  };

  function isSmallViewportCellSizePreset(){
    try{
      return !!(window.matchMedia && window.matchMedia('(max-width: 600px)').matches);
    }catch(_e){
      return window.innerWidth <= 600;
    }
  }

  function getResponsiveDefaultCellSize(modeKey){
    if(isSmallViewportCellSizePreset()){
      if(modeKey === 'rb'){
        return { width: 32, height: 32 };
      }
      if(modeKey === 'hc' || modeKey === 'l'){
        return { width: 36, height: 32 };
      }
    }

    return {
      width: DEFAULT_SETTINGS.cellSize[modeKey]?.width ?? DEFAULT_SETTINGS.cellSize.rb.width,
      height: DEFAULT_SETTINGS.cellSize[modeKey]?.height ?? DEFAULT_SETTINGS.cellSize.rb.height
    };
  }

  function loadBattleResultTail2Enabled(){
    try{
      const raw = localStorage.getItem(LS_BR_TAIL2_KEY);
      // デフォルトOFF
      if(raw == null) return false;
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function saveBattleResultTail2Enabled(on){
    try{
      localStorage.setItem(LS_BR_TAIL2_KEY, on ? '1' : '0');
    }catch(_e){}
  }

  function loadBattleResultAlign(){
    try{
      const raw = localStorage.getItem(LS_BR_ALIGN_KEY);
      if(raw === 'left' || raw === 'right' || raw === 'center') return raw;
      return 'center';
    }catch(_e){
      return 'center';
    }
  }

  function saveBattleResultAlign(v){
    const x = (v === 'left' || v === 'right' || v === 'center') ? v : 'center';
    try{ localStorage.setItem(LS_BR_ALIGN_KEY, x); }catch(_e){}
  }

  function loadBattleResultPassThrough(){
    try{
      const raw = localStorage.getItem(LS_BR_PASS_KEY);
      if(raw == null) return false;
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function saveBattleResultPassThrough(on){
    try{ localStorage.setItem(LS_BR_PASS_KEY, on ? '1' : '0'); }catch(_e){}
  }

  function loadBattleResultHideClose(){
    try{
      const raw = localStorage.getItem(LS_BR_HIDE_CLOSE_KEY);
      if(raw == null) return false; // デフォルトOFF
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function saveBattleResultHideClose(on){
    try{ localStorage.setItem(LS_BR_HIDE_CLOSE_KEY, on ? '1' : '0'); }catch(_e){}
  }

  function loadBattleResultHideOption(){
    try{
      const raw = localStorage.getItem(LS_BR_HIDE_OPT_KEY);
      if(raw == null) return false; // デフォルトOFF
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function saveBattleResultHideOption(on){
    try{ localStorage.setItem(LS_BR_HIDE_OPT_KEY, on ? '1' : '0'); }catch(_e){}
  }

  function loadBattleResultTopOffsetPx(){
    try{
      const raw = localStorage.getItem(LS_BR_TOP_KEY);
      // 未設定は 0px（今回要望）
      if(raw == null) return 0;
      const n = Number.parseInt(raw, 10);
      if(!Number.isFinite(n)) return 0;
      return clampInt(n, 0, 2000);
    }catch(_e){
      return 0;
    }
  }

  function saveBattleResultTopOffsetPx(px){
    const n = clampInt(px, 0, 2000);
    try{ localStorage.setItem(LS_BR_TOP_KEY, String(n)); }catch(_e){}
  }

  // 戦闘結果ウインドウの width のデフォルト値：300px
  function loadBattleResultWidthPx(){
    try{
      const raw = localStorage.getItem(LS_BR_WIDTH_KEY);
    if(raw == null) return 300;
      const n = Number.parseInt(raw, 10);
      if(!Number.isFinite(n)) return 300;
      return clampInt(n, 120, 2000);
    }catch(_e){
      return 300;
    }
  }

  function saveBattleResultWidthPx(px){
    const n = clampInt(px, 120, 2000);
    try{ localStorage.setItem(LS_BR_WIDTH_KEY, String(n)); }catch(_e){}
  }

  function loadRapidAttackEnabled(){
    try{
      const raw = localStorage.getItem(LS_RAPID_KEY);
      // デフォルトOFF
      if(raw == null) return false;
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function saveRapidAttackEnabled(on){
    try{
      localStorage.setItem(LS_RAPID_KEY, on ? '1' : '0');
    }catch(_e){}
  }

  function loadAutoEquipEnabled(){
    try{
      const raw = localStorage.getItem(LS_AUTO_EQUIP_KEY);
      if(raw == null) return false; // デフォルトOFF
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function saveAutoEquipEnabled(on){
    try{ localStorage.setItem(LS_AUTO_EQUIP_KEY, on ? '1' : '0'); }catch(_e){}
  }

  // =========================
  // オート装備（候補/lastPreset）は「装備ロスター」内に保存する
  //  - roster.autoEquip = { candidates: { [AE_KEY]: [presetName...] }, lastPreset: string }
  //  - 旧LS（LS_AUTO_EQUIP_CAND_KEY / LS_AUTO_EQUIP_LAST_KEY）からの移行もここで行う
  // =========================
  function ensureRosterAutoEquipBlock(roster){
    if(!roster || typeof roster !== 'object') return { candidates:{}, lastPreset:'' };
    if(!roster.autoEquip || typeof roster.autoEquip !== 'object'){
      roster.autoEquip = { candidates:{}, lastPreset:'' };
    }
    if(!roster.autoEquip.candidates || typeof roster.autoEquip.candidates !== 'object'){
      roster.autoEquip.candidates = {};
    }
    if(typeof roster.autoEquip.lastPreset !== 'string'){
      roster.autoEquip.lastPreset = '';
    }
    return roster.autoEquip;
  }

  // 旧LS→ロスターへ1回だけ移行（ロスターにautoEquipが空のときだけ）
  function migrateLegacyAutoEquipToRosterIfNeeded(){
    const { store, roster } = getActiveRoster();
    if(!roster) return;
    const ae = ensureRosterAutoEquipBlock(roster);

    // 既にロスター側に何か入っているなら移行しない
    const hasAny =
      (ae && ae.candidates && Object.keys(ae.candidates).length > 0) ||
      (ae && sanitizeText(ae.lastPreset || '') !== '');
    if(hasAny) return;

    let cand = null;
    let last = '';
    try{
      const raw = localStorage.getItem(LS_AUTO_EQUIP_CAND_KEY);
      if(raw){
        const obj = JSON.parse(raw);
        if(obj && typeof obj === 'object') cand = obj;
      }
    }catch(_e){}
    try{
      const raw2 = localStorage.getItem(LS_AUTO_EQUIP_LAST_KEY);
      last = raw2 ? String(raw2) : '';
    }catch(_e2){}

    if(cand && typeof cand === 'object'){
      ae.candidates = cand;
    }
    if(last){
      ae.lastPreset = last;
    }

    // 反映（ロスター更新）
    roster.autoEquip = ae;
    roster.updatedAt = nowIso();
    store.rosters[store.activeId] = roster;
    saveRosterStore(store);
  }

  function loadAutoEquipCandidates(){
    try{
      migrateLegacyAutoEquipToRosterIfNeeded();
      const { roster } = getActiveRoster();
      const ae = ensureRosterAutoEquipBlock(roster);
      const obj = ae && ae.candidates && typeof ae.candidates === 'object' ? ae.candidates : {};
      return normalizeAutoEquipCandidateStore(obj);
    }catch(_e){
      return {};
    }
  }

  function normalizeAutoEquipCandidateKey(key){
    const s0 = sanitizeText(key || '');
    if(!s0) return '';

    // 旧表記 → 新表記
    // 例:
    //   N.エ   -> N?
    //   SR.警  -> SR警
    //   UR.警エ -> UR警?
    let s = s0;
    s = s.replace(/\.警エ$/u, '警?');
    s = s.replace(/\.警$/u, '警');
    s = s.replace(/\.エ$/u, '?');

    // 念のため、すでに新表記のものもそのまま正規形へ寄せる
    const m = s.match(/^(N|R|SR|SSR|UR)(警?|警|?)?$/u);
    if(!m) return s0;
    return `${m[1]}${m[2] || ''}`;
  }

  function normalizeAutoEquipCandidateStore(obj){
    const src = (obj && typeof obj === 'object') ? obj : {};
    const out = {};

    for(const rawKey of Object.keys(src)){
      const normKey = normalizeAutoEquipCandidateKey(rawKey);
      if(!normKey) continue;

      const arr0 = Array.isArray(src[rawKey]) ? src[rawKey] : [];
      const arr = arr0.map(x => sanitizeText(x)).filter(Boolean);

      if(!Array.isArray(out[normKey])) out[normKey] = [];
      out[normKey].push(...arr);
    }

    // 配列内の重複除去
    for(const k of Object.keys(out)){
      const seen = new Set();
      out[k] = out[k].filter((name) => {
        if(seen.has(name)) return false;
        seen.add(name);
        return true;
      });
    }

    return out;
  }

  function saveAutoEquipCandidates(obj){
    try{
      const { store, roster } = getActiveRoster();
      const ae = ensureRosterAutoEquipBlock(roster);
      ae.candidates = normalizeAutoEquipCandidateStore(obj);
      roster.autoEquip = ae;
      roster.updatedAt = nowIso();
      store.rosters[store.activeId] = roster;
      saveRosterStore(store);
    }catch(_e){}
  }

  function loadAutoEquipLastPreset(){
    try{
      migrateLegacyAutoEquipToRosterIfNeeded();
      const { roster } = getActiveRoster();
      const ae = ensureRosterAutoEquipBlock(roster);
      return ae && typeof ae.lastPreset === 'string' ? ae.lastPreset : '';
    }catch(_e){
      return '';
    }
  }

  function saveAutoEquipLastPreset(name){
    try{
      const { store, roster } = getActiveRoster();
      const ae = ensureRosterAutoEquipBlock(roster);
      ae.lastPreset = String(name || '');
      roster.autoEquip = ae;
      roster.updatedAt = nowIso();
      store.rosters[store.activeId] = roster;
      saveRosterStore(store);
    }catch(_e){}
  }

  // =========================
  // オート装備：候補リストから「プリセット名」を除去
  //  - 装備ロスター側でプリセット削除された時に参照整合性を保つ
  //  - 全キー（N/R/SR/.../UR.警エ etc）を横断して該当名を削除する
  // =========================
  function removePresetFromAutoEquipCandidates(presetName){
    const nm = sanitizeText(presetName);
    if(!nm) return false;

    let changed = false;
    const store = loadAutoEquipCandidates();
    if(store && typeof store === 'object'){
      for(const k of Object.keys(store)){
        const arr0 = store[k];
        if(!Array.isArray(arr0)) continue;
        const before = arr0.length;
        const cleaned = arr0
          .map(x => sanitizeText(x))
          .filter(Boolean)
          .filter(x => x !== nm);
        if(cleaned.length !== before){
          store[k] = cleaned;
          changed = true;
        }else{
          // ついでに正規化（空白などで汚れていた場合の掃除）
          store[k] = cleaned;
        }
      }
    }

    // 「最後にオート装備で適用したプリセット」が消えた場合はクリア
    try{
      const last = loadAutoEquipLastPreset();
      if(last && last === nm){
        saveAutoEquipLastPreset('');
        changed = true;
      }
    }catch(_e){}

    if(changed){
      saveAutoEquipCandidates(store);
    }
    return changed;
  }

  function removePresetNamesFromAutoEquipCandidates(names){
    const list = Array.isArray(names) ? names.map(x => sanitizeText(x)).filter(Boolean) : [];
    if(list.length === 0) return false;
    let changed = false;
    for(const nm of list){
      if(removePresetFromAutoEquipCandidates(nm)) changed = true;
    }
    return changed;
  }

  function loadAutoEquipNotifyAutoCloseEnabled(){
    try{
      const raw = localStorage.getItem(LS_AUTO_EQUIP_NOTIFY_AUTOCLOSE_KEY);
      if(raw == null) return false; // デフォルトOFF
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function saveAutoEquipNotifyAutoCloseEnabled(on){
    try{ localStorage.setItem(LS_AUTO_EQUIP_NOTIFY_AUTOCLOSE_KEY, on ? '1' : '0'); }catch(_e){}
  }

  function sanitizeAutoEquipNotifyAutoCloseSec(sec){
    const n = Number(sec);
    if(!Number.isFinite(n)) return 1.5;   // 通知close デフォルト 1.5 秒
    const clamped = Math.max(0.1, Math.min(60, n));
    return Math.round(clamped * 10) / 10;
  }

  function formatAutoEquipNotifyAutoCloseSec(sec){
    return sanitizeAutoEquipNotifyAutoCloseSec(sec).toFixed(1);
  }

  function loadAutoEquipNotifyAutoCloseSec(){
    try{
      const raw = localStorage.getItem(LS_AUTO_EQUIP_NOTIFY_AUTOCLOSE_SEC_KEY);
      if(raw == null) return 1.5;   // 通知close デフォルト 1.5 秒
      return sanitizeAutoEquipNotifyAutoCloseSec(raw);
    }catch(_e){
      return 1.5;   // 通知close デフォルト 1.5 秒
    }
  }

  function saveAutoEquipNotifyAutoCloseSec(sec){
    const n = sanitizeAutoEquipNotifyAutoCloseSec(sec);
    try{ localStorage.setItem(LS_AUTO_EQUIP_NOTIFY_AUTOCLOSE_SEC_KEY, String(n)); }catch(_e){}
  }

  function loadAutoEquipPreferTopEnabled(){
    try{
      const raw = localStorage.getItem(LS_AUTO_EQUIP_PREFER_TOP_KEY);
      if(raw == null) return false; // デフォルトOFF
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function saveAutoEquipPreferTopEnabled(on){
    try{ localStorage.setItem(LS_AUTO_EQUIP_PREFER_TOP_KEY, on ? '1' : '0'); }catch(_e){}
  }

  function loadCurrentPresetName(){
    try{
      const raw = localStorage.getItem(LS_CURRENT_PRESET_NAME_KEY);
      return raw ? String(raw) : '';
    }catch(_e){
      return '';
    }
  }

  function saveCurrentPresetName(name){
    try{
      localStorage.setItem(LS_CURRENT_PRESET_NAME_KEY, String(name || ''));
    }catch(_e){}
  }

  function loadRosterScrollRememberEnabled(){
    try{
      const raw = localStorage.getItem(LS_ROSTER_SCROLL_REMEMBER_KEY);
      if(raw == null) return false; // デフォルトOFF
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function saveRosterScrollRememberEnabled(on){
    try{
      localStorage.setItem(LS_ROSTER_SCROLL_REMEMBER_KEY, on ? '1' : '0');
    }catch(_e){}
  }

  function loadRosterSavedScrollTop(){
    try{
      const raw = localStorage.getItem(LS_ROSTER_SCROLL_TOP_KEY);
      if(raw == null) return 0;
      const n = Number.parseInt(raw, 10);
      if(!Number.isFinite(n)) return 0;
      return Math.max(0, n);
    }catch(_e){
      return 0;
    }
  }

  function saveRosterSavedScrollTop(v){
    try{
      const n = Number.parseInt(v, 10);
      localStorage.setItem(LS_ROSTER_SCROLL_TOP_KEY, String(Number.isFinite(n) ? Math.max(0, n) : 0));
    }catch(_e){}
  }

  function clearRosterSavedScrollTop(){
    try{
      localStorage.removeItem(LS_ROSTER_SCROLL_TOP_KEY);
    }catch(_e){}
  }

  function loadRosterPresetClickAction(){
    try{
      const raw = localStorage.getItem(LS_ROSTER_PRESET_CLICK_ACTION_KEY);
      return (raw === 'menu') ? 'menu' : 'equip';
    }catch(_e){
      return 'equip';
    }
  }

  function saveRosterPresetClickAction(modeValue){
    const v = (modeValue === 'menu') ? 'menu' : 'equip';
    try{
      localStorage.setItem(LS_ROSTER_PRESET_CLICK_ACTION_KEY, v);
    }catch(_e){}
  }

  function loadRosterHideMenuRow2Enabled(){
    try{
      const raw = localStorage.getItem(LS_ROSTER_HIDE_MENU_ROW2_KEY);
      if(raw == null) return false; // デフォルトOFF
      return raw === '1';
    }catch(_e){
      return false;
    }
  }

  function saveRosterHideMenuRow2Enabled(on){
    try{
      localStorage.setItem(LS_ROSTER_HIDE_MENU_ROW2_KEY, on ? '1' : '0');
    }catch(_e){}
  }

  function captureRosterListScrollState(){
    const list = document.getElementById('dba-roster-list');
    if(!(list instanceof HTMLElement)) return 0;
    const top = Math.max(0, Math.round(list.scrollTop || 0));
    DBA_ROSTER_UI_STATE.scrollTop = top;
    if(loadRosterScrollRememberEnabled()){
      saveRosterSavedScrollTop(top);
    }
    return top;
  }

  function prepareRosterScrollStateForOpen(){
    if(loadRosterScrollRememberEnabled()){
      DBA_ROSTER_UI_STATE.scrollTop = loadRosterSavedScrollTop();
    }else{
      DBA_ROSTER_UI_STATE.scrollTop = 0;
      clearRosterSavedScrollTop();
    }
  }

  function finalizeRosterScrollStateOnClose(){
    const top = captureRosterListScrollState();
    if(loadRosterScrollRememberEnabled()){
      saveRosterSavedScrollTop(top);
    }else{
      DBA_ROSTER_UI_STATE.scrollTop = 0;
      clearRosterSavedScrollTop();
    }
  }

  function getTeamChallengeUrl(){
    return makeTeamChallengeUrl(mode);
  }

  const DBA_POST_BATTLE_DIFF_SYNC = {
    running: false,
    pending: false
  };

  const DBA_POST_TEAMCHALLENGE_SYNC = {
    running: false,
    pending: false
  };

  async function fetchLatestTopPageDoc(){
    const topUrl = makeTeambattleUrl({ m: mode });
    const res = await fetch(topUrl, { method:'GET', credentials:'include', cache:'no-store' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return { topUrl, html, doc };
  }

  function shouldUseFullScanForFetchedTopDoc(curSnap, newSnap){
    if(!curSnap || !newSnap) return true;

    const curRows = Number(curSnap.rows);
    const curCols = Number(curSnap.cols);
    const newRows = Number(newSnap.rows);
    const newCols = Number(newSnap.cols);

    if(
      !Number.isFinite(curRows) || !Number.isFinite(curCols) ||
      !Number.isFinite(newRows) || !Number.isFinite(newCols)
    ){
      return true;
    }

    if(curRows <= 0 || curCols <= 0 || newRows <= 0 || newCols <= 0){
      return true;
    }

    if(curRows !== newRows || curCols !== newCols){
      return true;
    }

    return false;
  }

  async function scheduleBattleInfoSyncAfterTeamChallenge(){
    const btn = document.getElementById('dba-btn-battleinfo');
    if(!btn) return false;
    if(!findCurrentBattlemapRoot()) return false;

    if(DBA_POST_TEAMCHALLENGE_SYNC.running){
      DBA_POST_TEAMCHALLENGE_SYNC.pending = true;
      return true;
    }

    DBA_POST_TEAMCHALLENGE_SYNC.running = true;
    try{
      do{
        DBA_POST_TEAMCHALLENGE_SYNC.pending = false;

        const { topUrl, doc } = await fetchLatestTopPageDoc();
        const curSnap = getCurrentBattlemapSnapshot();
        const newSnap = getBattlemapSnapshotFromDoc(doc);

        if(shouldUseFullScanForFetchedTopDoc(curSnap, newSnap)){
          await scanAllCellsAndRenderFromFetchedDoc(doc, {
            topUrl,
            snapshot: newSnap,
            showAlertOnError: false
          });
        }else{
          await updateOnlyChangedCellsFromFetchedDoc(doc, {
            topUrl,
            snapshot: newSnap,
            showAlertOnError: false
          });
        }
      }while(DBA_POST_TEAMCHALLENGE_SYNC.pending);

      return true;
    }catch(_e){
      return false;
    }finally{
      DBA_POST_TEAMCHALLENGE_SYNC.running = false;
    }
  }

  function hasBattleLogText(text){
    const t = sanitizeText(text || '');
    if(!t) return false;
    return (
      t.includes('アリーナチャレンジ開始') ||
      t.includes('ターン') ||
      t.includes('が勝った') ||
      t.includes('チャレンジに成功') ||
      t.includes('アリーナリーダー') ||
      t.includes('リーダーになった') ||
      t.includes('リーダーになりました') ||
      t.includes('あなたはリーダー')
    );
  }

  const DBA_LIGHT_REFRESH_STATE = {
    battleCount: 0,
    timer: 0,
    running: false
  };

  function resetLightRefreshCounter(){
    DBA_LIGHT_REFRESH_STATE.battleCount = 0;
    if(DBA_LIGHT_REFRESH_STATE.timer){
      clearTimeout(DBA_LIGHT_REFRESH_STATE.timer);
      DBA_LIGHT_REFRESH_STATE.timer = 0;
    }
    DBA_LIGHT_REFRESH_STATE.running = false;
    setLightRefreshButtonBusyState(false);
  }

  function applyLightRefreshButtonVisibility(btnOrSettingsObj, settingsObj){
    let btn = null;
    let s = null;

    if(btnOrSettingsObj instanceof HTMLElement){
      btn = btnOrSettingsObj;
      s = settingsObj || loadSettings();
    }else{
      btn = document.getElementById('dba-btn-light-refresh');
      if(!btn) return false;
      s = btnOrSettingsObj || loadSettings();
    }

    const show = !!s?.functionButtons?.showLightRefreshButton;

    btn.style.display = show ? '' : 'none';
    return true;
  }

  function setLightRefreshButtonBusyState(running){
    const btn = document.getElementById('dba-btn-light-refresh');
    if(!btn) return;
    btn.disabled = !!running;
    btn.dataset.dbaBusy = running ? '1' : '0';
    btn.textContent = running ? '軽量化中…' : '軽量化';
  }

  function triggerLightRefreshNow(){
    if(DBA_LIGHT_REFRESH_STATE.running) return false;

    DBA_LIGHT_REFRESH_STATE.running = true;
    DBA_LIGHT_REFRESH_STATE.battleCount = 0;

    try{
      setLightRefreshButtonBusyState(true);
    }catch(_e){}

    DBA_LIGHT_REFRESH_STATE.timer = setTimeout(() => {
      try{
        const url = makeTeambattleUrl({
          m: mode,
          dba_light_refresh: Date.now()
        });
        location.replace(url);
      }catch(_e){
        location.reload();
      }
    }, 600);

    return true;
  }

  function scheduleLightRefreshAfterBattleLog(){
    const s = loadSettings();
    if(!s?.lightRefresh?.enabled) return false;
    if(DBA_LIGHT_REFRESH_STATE.running) return true;

    DBA_LIGHT_REFRESH_STATE.battleCount += 1;
    const threshold = sanitizeLightRefreshBattleCount(s?.lightRefresh?.battleCount);
    if(DBA_LIGHT_REFRESH_STATE.battleCount < threshold){
      return false;
    }

  return triggerLightRefreshNow();
  }

  async function scheduleAutoBattleInfoSyncAfterBattleResult(){
    const s = loadSettings();
    if(!s?.postBattle?.autoDiffSync) return false;

    // 戦闘後の自動同期は /teamchallenge 後同期へ一本化する
    // （失敗ダイアログを出さない / 二重実行しにくくする）
    return scheduleBattleInfoSyncAfterTeamChallenge();
  }

  async function scheduleBattleInfoDiffSyncAfterBattleLog(){
    const s = loadSettings();
    if(!s?.postBattle?.autoDiffSync) return false;

    const btn = document.getElementById('dba-btn-battleinfo');
    if(!btn) return false;
    if(!findCurrentBattlemapRoot()) return false;

    if(DBA_POST_BATTLE_DIFF_SYNC.running){
      DBA_POST_BATTLE_DIFF_SYNC.pending = true;
      return true;
    }

    DBA_POST_BATTLE_DIFF_SYNC.running = true;
    try{
      do{
        DBA_POST_BATTLE_DIFF_SYNC.pending = false;
        const { topUrl, doc } = await fetchLatestTopPageDoc();
        const newSnap = getBattlemapSnapshotFromDoc(doc);
        await updateOnlyChangedCellsFromFetchedDoc(doc, {
          topUrl,
          snapshot: newSnap,
          showAlertOnError: false
        });
      }while(DBA_POST_BATTLE_DIFF_SYNC.pending);
      return true;
    }catch(_e){
      return false;
    }finally{
      DBA_POST_BATTLE_DIFF_SYNC.running = false;
    }
  }

  async function rapidAttackAt(row, col){
    if(consumeOwnCapitalAttackIfNeeded(row, col)){
      return;
    }

    // セル詳細を経由せず、teamchallenge に直接 POST
    // ※占領済み/空きセルの分岐はサーバー側が判断（＝「このエリアを捕らえよ」or「エリアに挑む」相当）
    openBattleResultModalWithNode('戦闘結果を取得中…', 'ラピッド攻撃');

    const fd = new FormData();
    fd.append('row', String(row));
    fd.append('col', String(col));

    const res = await fetch(getTeamChallengeUrl(), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      body: fd
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const bodyText = await res.text();

    // 返却がHTMLではなく短文だけのケースにも対応（既存 battle-result と同じ方針）
    if(!ct.includes('text/html')){
      const resultText = bodyText || '結果を表示できませんでした。';
      openBattleResultModalWithNode(resultText, 'ラピッド攻撃');
      scheduleAutoBattleInfoSyncAfterBattleResult().catch(()=>{});
      if(hasBattleLogText(resultText)){
        scheduleLightRefreshAfterBattleLog();
      }
      return;
    }

    const doc = new DOMParser().parseFromString(bodyText, 'text/html');
    const block = extractBattleResultBlock(doc);
    if(block){
      const text = (doc.body && doc.body.innerText) ? doc.body.innerText : sanitizeText(block.textContent || '');
      const resultText = text || '結果を表示できませんでした。';
      openBattleResultModalWithNode(resultText, 'ラピッド攻撃');
      scheduleAutoBattleInfoSyncAfterBattleResult().catch(()=>{});
      if(hasBattleLogText(resultText)){
        scheduleLightRefreshAfterBattleLog();
      }
      return;
    }
    {
      const resultText = (doc.body && doc.body.innerText) ? doc.body.innerText : '結果を表示できませんでした。';
      openBattleResultModalWithNode(resultText, 'ラピッド攻撃');
      scheduleBattleInfoSyncAfterTeamChallenge().catch(()=>{});
      if(hasBattleLogText(resultText)){
        scheduleLightRefreshAfterBattleLog();
        scheduleBattleInfoDiffSyncAfterBattleLog().catch(()=>{});
      }
    }
  }

  function clampInt(n, min, max){
    const x = Number.parseInt(n, 10);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
  }

  function sanitizeCellPx(v, fallback){
    const fb = Number.isFinite(Number(fallback)) ? Number(fallback) : 30;
    const x = Number.parseInt(v, 10);
    if (!Number.isFinite(x)) return fb;
    if (x < 8) return 8;
    if (x > 256) return 256;
    return x;
  }

  function sanitizeOpacity(v){
    const x = Number.parseInt(v, 10);
    if(!Number.isFinite(x)) return 100;
    if(x < 0) return 0;
    if(x > 100) return 100;
    return x;
  }

  function getDefaultBaseFontPxForDevice(){
    try{
      const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      const narrow = Math.max(0, window.innerWidth || 0) <= 640;
      const tabletLike = Math.max(0, window.innerWidth || 0) <= 1024;

      if(coarse && narrow) return 14;     // スマホ
      if(coarse || tabletLike) return 16;   // タブレット
      return 17;   // パソコン
    }catch(_e){
      return 17;   // 基準文字サイズ
    }
  }

  function sanitizeBaseFontPx(v, fallback){
    const fb = (fallback === 12 || fallback === 14 || fallback === 16 || fallback === 17)   // 基準文字サイズ
      ? fallback
      : getDefaultBaseFontPxForDevice();
    const x = Number(v);
    if(x === 12 || x === 14 || x === 16 || x === 17) return x;   // 基準文字サイズ
    return fb;
  }

  function applyBaseFontSize(baseFontPx){
    const px = sanitizeBaseFontPx(baseFontPx, getDefaultBaseFontPxForDevice());
    document.documentElement.style.setProperty('--dba-base-font-size', `${px}px`);
  }

  function sanitizeRbBorderOpacity(v){
    const x = Number.parseInt(v, 10);
    if(!Number.isFinite(x)) return 100;
    if(x < 50) return 50;
    if(x > 100) return 100;
    return x;
  }

  function sanitizeLightRefreshBattleCount(v){
    const x = Number.parseInt(v, 10);
    if(!Number.isFinite(x)) return DEFAULT_SETTINGS.lightRefresh.battleCount;
    if(x < 1) return 1;
    if(x > 9999) return 9999;
    return x;
  }

  function loadSettings(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(!raw){
        const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        for(const k of ['rb','hc','l']){
          const def = getResponsiveDefaultCellSize(k);
          out.cellSize[k].width = def.width;
          out.cellSize[k].height = def.height;
        }
        return out;
      }
      const obj = JSON.parse(raw);
      const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      if(obj && obj.cellSize){
        for(const k of ['rb','hc','l']){
          const base = getResponsiveDefaultCellSize(k);
          const src = obj.cellSize[k] || {};
          out.cellSize[k].width  = sanitizeCellPx(src.width,  base.width);
          out.cellSize[k].height = sanitizeCellPx(src.height, base.height);
        }
      }else if(obj && obj.scale){
        // 旧scale設定からの緩やかな移行
        const legacyBase = { rb: 32, hc: 30, l: 30 };
        for(const k of ['rb','hc','l']){
          const pct = clampInt(obj.scale[k], 100, 200);
          const px = Math.max(8, Math.round(legacyBase[k] * (pct / 100)));
          out.cellSize[k].width = px;
          out.cellSize[k].height = px;
        }
      }
      if(obj && obj.ui){
        out.ui.baseFontPx = sanitizeBaseFontPx(obj.ui.baseFontPx, getDefaultBaseFontPxForDevice());
      }
      if(obj && obj.postBattle){
        out.postBattle.autoDiffSync = !!obj.postBattle.autoDiffSync;
        if(typeof obj.postBattle.suppressOwnCapitalFriendlyFire !== 'undefined'){
          out.postBattle.suppressOwnCapitalFriendlyFire = !!obj.postBattle.suppressOwnCapitalFriendlyFire;
        }else if(typeof obj.postBattle.disableOwnCapitalProtection !== 'undefined'){
          // 旧設定の互換:
          // disableOwnCapitalProtection === true  -> 新設定 suppressOwnCapitalFriendlyFire === false
          // disableOwnCapitalProtection === false -> 新設定 suppressOwnCapitalFriendlyFire === true
          out.postBattle.suppressOwnCapitalFriendlyFire = !obj.postBattle.disableOwnCapitalProtection;
        }
      }
      if(obj && obj.lightRefresh){
        out.lightRefresh.enabled = !!obj.lightRefresh.enabled;
        out.lightRefresh.battleCount = sanitizeLightRefreshBattleCount(obj.lightRefresh.battleCount);
      }
      if(obj && obj.functionButtons){
        out.functionButtons.showLightRefreshButton = !!obj.functionButtons.showLightRefreshButton;
      }else{
        // 旧版からの移行：専用LSがあれば引き継ぐ
        out.functionButtons.showLightRefreshButton = loadShowLightRefreshButton();
      }
      if(obj && obj.rbLayer){
        out.rbLayer.showCellRegulation = !!obj.rbLayer.showCellRegulation;
        out.rbLayer.showOriginalBorder = !!obj.rbLayer.showOriginalBorder;
        out.rbLayer.borderOpacity = sanitizeRbBorderOpacity(obj.rbLayer.borderOpacity);
        out.rbLayer.stopAnimation = !!obj.rbLayer.stopAnimation;
        out.rbLayer.showCapitalCrown = !!obj.rbLayer.showCapitalCrown;
        out.rbLayer.showCurrentCellMarker = !!obj.rbLayer.showCurrentCellMarker;
        out.rbLayer.currentCellMarkerColor = sanitizeCurrentMarkerColorName(obj.rbLayer.currentCellMarkerColor);
        out.rbLayer.currentCellMarkerDelayMs = sanitizeCurrentMarkerDelayMs(obj.rbLayer.currentCellMarkerDelayMs);
        out.rbLayer.showNobodyHolder = !!obj.rbLayer.showNobodyHolder;
        out.rbLayer.hideFnTooltip = !!obj.rbLayer.hideFnTooltip;
      }
      if(obj && obj.layer){
        out.layer.textOpacity = sanitizeOpacity(obj.layer.textOpacity);
      }
      if(obj && obj.header){
        out.header.showOriginalHeader = !!obj.header.showOriginalHeader;
      }else{
        // 旧版からの移行：専用LSがあれば引き継ぐ
        out.header.showOriginalHeader = loadShowOriginalHeader();
      }
      return out;
    }catch(_e){
      const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      for(const k of ['rb','hc','l']){
        const def = getResponsiveDefaultCellSize(k);
        out.cellSize[k].width = def.width;
        out.cellSize[k].height = def.height;
      }
      return out;
    }
  }

  function saveSettings(s){
    try{
      const out = {
        cellSize: {
          rb: {
            width:  sanitizeCellPx(s?.cellSize?.rb?.width,  DEFAULT_SETTINGS.cellSize.rb.width),
            height: sanitizeCellPx(s?.cellSize?.rb?.height, DEFAULT_SETTINGS.cellSize.rb.height)
          },
          hc: {
            width:  sanitizeCellPx(s?.cellSize?.hc?.width,  DEFAULT_SETTINGS.cellSize.hc.width),
            height: sanitizeCellPx(s?.cellSize?.hc?.height, DEFAULT_SETTINGS.cellSize.hc.height)
          },
          l: {
            width:  sanitizeCellPx(s?.cellSize?.l?.width,  DEFAULT_SETTINGS.cellSize.l.width),
            height: sanitizeCellPx(s?.cellSize?.l?.height, DEFAULT_SETTINGS.cellSize.l.height)
          }
        },
        ui: {
          baseFontPx: sanitizeBaseFontPx(s?.ui?.baseFontPx, getDefaultBaseFontPxForDevice())
        },
        postBattle: {
          autoDiffSync: !!s?.postBattle?.autoDiffSync,
          suppressOwnCapitalFriendlyFire: !!s?.postBattle?.suppressOwnCapitalFriendlyFire
        },
        lightRefresh: {
          enabled: !!s?.lightRefresh?.enabled,
          battleCount: sanitizeLightRefreshBattleCount(s?.lightRefresh?.battleCount)
        },
        functionButtons: {
          showLightRefreshButton: !!s?.functionButtons?.showLightRefreshButton
        },
        rbLayer: {
          showCellRegulation: !!s?.rbLayer?.showCellRegulation,
          showOriginalBorder: !!s?.rbLayer?.showOriginalBorder,
          borderOpacity: sanitizeRbBorderOpacity(s?.rbLayer?.borderOpacity),
          stopAnimation: !!s?.rbLayer?.stopAnimation,
          showCapitalCrown: !!s?.rbLayer?.showCapitalCrown,
          showCurrentCellMarker: !!s?.rbLayer?.showCurrentCellMarker,
          currentCellMarkerColor: sanitizeCurrentMarkerColorName(s?.rbLayer?.currentCellMarkerColor),
          currentCellMarkerDelayMs: sanitizeCurrentMarkerDelayMs(s?.rbLayer?.currentCellMarkerDelayMs),
          showNobodyHolder: !!s?.rbLayer?.showNobodyHolder,
          hideFnTooltip: !!s?.rbLayer?.hideFnTooltip
        },
        layer: { textOpacity: sanitizeOpacity(s?.layer?.textOpacity) },
        header: { showOriginalHeader: !!s?.header?.showOriginalHeader }
      };
      localStorage.setItem(LS_KEY, JSON.stringify(out));
      saveShowLightRefreshButton(out.functionButtons.showLightRefreshButton);
      saveShowOriginalHeader(out.header.showOriginalHeader);
    }catch(_e){}
  }

  function getModeLabel(m){
    if(m === 'rb') return 'レッドvsブルーモード';
    if(m === 'hc') return 'ハードコアモード';
    if(m === 'l') return 'ラダーモード';
    return m;
  }

  function getDefaultCellSizeForMode(modeKey){
    const responsiveDef = getResponsiveDefaultCellSize(modeKey);

    if(modeKey === 'rb'){
      const gridSize = getRbGridSizeFromPageScript() || 14;
      const wrap = document.getElementById('gridWrap');
      if(wrap){
        const rect = wrap.getBoundingClientRect();
        const w = Math.round(rect.width / gridSize);
        const h = Math.round(rect.height / gridSize);
        return {
          width: sanitizeCellPx(w, responsiveDef.width),
          height: sanitizeCellPx(h, responsiveDef.height)
        };
      }
      return {
        width: responsiveDef.width,
        height: responsiveDef.height
      };
    }

    const grid = document.querySelector('.grid');
    if(grid){
      const spec = getHcLGridSpec(grid);
      const colCount = Math.max(0, Number(spec.cols) || 0);
      const rowCount = Math.max(0, Number(spec.rows) || 0);
      const csGrid = window.getComputedStyle(grid);

      let w = 0;
      let h = 0;

      if(colCount > 0){
        const gridRect = grid.getBoundingClientRect();
        const colGapPx = Math.max(0, parseCssPx(spec.colGap || csGrid.columnGap || '0px'));
        const totalGapW = Math.max(0, colCount - 1) * colGapPx;
        w = Math.round((Math.max(0, gridRect.width) - totalGapW) / colCount);
      }
      if(rowCount > 0){
        const gridRect = grid.getBoundingClientRect();
        const rowGapPx = Math.max(0, parseCssPx(spec.rowGap || csGrid.rowGap || '0px'));
        const totalGapH = Math.max(0, rowCount - 1) * rowGapPx;
        h = Math.round((Math.max(0, gridRect.height) - totalGapH) / rowCount);
      }

      if(!(w > 0) || !(h > 0)){
        const gtc = String(grid.style.gridTemplateColumns || spec.gtc || '');
        const gtr = String(grid.style.gridTemplateRows || spec.gtr || '');
        const m1 = gtc.match(/repeat\(\s*(\d+)\s*,\s*(\d+)px\s*\)/);
        const m2 = gtr.match(/repeat\(\s*(\d+)\s*,\s*(\d+)px\s*\)/);
        if(!(w > 0) && m1){
          w = Number(m1[2]) || 0;
        }
        if(!(h > 0) && m2){
          h = Number(m2[2]) || 0;
        }
      }

      if(!(w > 0) || !(h > 0)){
        const cell = grid.querySelector('.cell');
        if(cell){
          const csCell = window.getComputedStyle(cell);
          if(!(w > 0)){
            w = Math.round(parseFloat(csCell.width) || parseFloat(cell.style.width) || 0);
          }
          if(!(h > 0)){
            h = Math.round(parseFloat(csCell.height) || parseFloat(cell.style.height) || 0);
          }
        }
      }

      if(w > 0 || h > 0){
        return {
          width: sanitizeCellPx(w, responsiveDef.width),
          height: sanitizeCellPx(h, responsiveDef.height)
        };
      }
    }

    return {
      width: responsiveDef.width,
      height: responsiveDef.height
    };
  }

  function getEffectiveCellSizeForMode(modeKey, settingsObj){
    const s = settingsObj || loadSettings();
    const def = getDefaultCellSizeForMode(modeKey);
    const src = (s && s.cellSize && s.cellSize[modeKey]) ? s.cellSize[modeKey] : {};
    return {
      width: sanitizeCellPx(src.width, def.width),
      height: sanitizeCellPx(src.height, def.height)
    };
  }

  function getBattlemapScaleTargetElement(modeKey){
    if(modeKey === 'rb'){
      return document.getElementById('gridWrap');
    }
    return document.querySelector('.grid');
  }

  function getBattlemapScaleHostElement(modeKey){
    const target = getBattlemapScaleTargetElement(modeKey);
    if(!target) return null;

    if(modeKey === 'rb'){
      return target.parentElement || target;
    }

    return target.parentElement || target;
  }

  function getBattlemapColumnCountForMode(modeKey){
    if(modeKey === 'rb'){
      const n = getRbGridSizeFromPageScript();
      return Number.isFinite(n) ? n : 0;
    }

    const grid = document.querySelector('.grid');
    if(!grid) return 0;
    const spec = getHcLGridSpec(grid);
    return Number(spec.cols) || 0;
  }

  function getBattlemapColumnGapPxForMode(modeKey){
    if(modeKey === 'rb') return 0;

    const grid = document.querySelector('.grid');
    if(!grid) return 0;

    const cs = getComputedStyle(grid);
    return Math.max(0, Math.round(parseCssPx(cs.columnGap || cs.gap || '0px')));
  }

  function getBattlemapAvailableWidthPx(modeKey){
    const host = getBattlemapScaleHostElement(modeKey);
    if(host instanceof HTMLElement){
      const rect = host.getBoundingClientRect();
      const cs = getComputedStyle(host);
      const padL = parseCssPx(cs.paddingLeft || '0px');
      const padR = parseCssPx(cs.paddingRight || '0px');
      const inner = Math.floor((rect.width || host.clientWidth || 0) - padL - padR);
      if(inner > 0) return inner;
    }

    return Math.max(0, Math.floor((window.innerWidth || 0) * 0.96));
  }

  function getBattlemapFittedCellSizeForMode(modeKey, settingsObj){
    const base = getEffectiveCellSizeForMode(modeKey, settingsObj);
    const cols = Math.max(0, getBattlemapColumnCountForMode(modeKey));
    const gapPx = Math.max(0, getBattlemapColumnGapPxForMode(modeKey));
    const availW = Math.max(0, getBattlemapAvailableWidthPx(modeKey));

    if(cols <= 0 || availW <= 0){
      return {
        width: base.width,
        height: base.height,
        scale: 1
      };
    }

    const naturalW = (cols * base.width) + (Math.max(0, cols - 1) * gapPx);
    if(naturalW <= 0 || naturalW <= availW){
      return {
        width: base.width,
        height: base.height,
        scale: 1
      };
    }

    const scale = Math.max(0.1, Math.min(1, availW / naturalW));
    const fittedW = Math.max(8, Math.floor(base.width * scale));
    const fittedH = Math.max(8, Math.floor(base.height * scale));
    const actualScale = Math.max(
      0.1,
      Math.min(
        1,
        fittedW / Math.max(1, base.width),
        fittedH / Math.max(1, base.height)
      )
    );

    return {
      width: sanitizeCellPx(fittedW, base.width),
      height: sanitizeCellPx(fittedH, base.height),
      scale: actualScale
    };
  }

  function applyBattlemapLayerScaledFont(baseFontPx, scale){
    const root = document.getElementById('dba-battlemap-layer');
    if(!root) return false;

    const basePx = sanitizeBaseFontPx(baseFontPx, getDefaultBaseFontPxForDevice());
    const s = Math.max(0.1, Math.min(1, Number(scale) || 1));
    root.style.fontSize = `${Math.max(8, Math.round(basePx * s * 100) / 100)}px`;
    return true;
  }

  function beginBattlemapFitPrepare(){
    const root = document.getElementById('dba-battlemap-layer');
    if(!root) return;
    root.dataset.fitPreparing = '1';
  }

  function endBattlemapFitPrepare(){
    const root = document.getElementById('dba-battlemap-layer');
    if(!root) return;
    root.dataset.fitPreparing = '0';
  }

  function applyCellSizeToGrid(widthPx, heightPx){
    const grid = document.querySelector('.grid');
    if(!grid) return false;

    const width = sanitizeCellPx(widthPx, 30);
    const height = sanitizeCellPx(heightPx, 30);

    // grid-template-columns / rows を更新
    const gtc = grid.style.gridTemplateColumns || '';
    const gtr = grid.style.gridTemplateRows || '';
    const m1 = gtc.match(/repeat\(\s*(\d+)\s*,\s*(\d+)px\s*\)/);
    const m2 = gtr.match(/repeat\(\s*(\d+)\s*,\s*(\d+)px\s*\)/);

    if(m1){
      const n = Number(m1[1]);
      grid.style.gridTemplateColumns = `repeat(${n}, ${width}px)`;
    }
    if(m2){
      const n = Number(m2[1]);
      grid.style.gridTemplateRows = `repeat(${n}, ${height}px)`;
    }

    // 各セルサイズ（ページ側で inline 指定されても上書き）
    for(const el of grid.querySelectorAll('.cell')){
      el.style.width = width + 'px';
      el.style.height = height + 'px';
    }

    scheduleBattlemapLayerSync();
    return true;
  }

  function applyCellSizeToCanvasWrap(widthPx, heightPx){
    const wrap = document.getElementById('gridWrap');
    if(!wrap) return false;

    const gridSize = getRbGridSizeFromPageScript() || 14;
    const width = sanitizeCellPx(widthPx, DEFAULT_SETTINGS.cellSize.rb.width);
    const height = sanitizeCellPx(heightPx, DEFAULT_SETTINGS.cellSize.rb.height);
    const totalW = width * gridSize;
    const totalH = height * gridSize;

    wrap.style.transformOrigin = '';
    wrap.style.transform = '';
    wrap.style.width = `${totalW}px`;
    wrap.style.height = `${totalH}px`;

    for(const id of ['gridBase', 'gridFog', 'gridOverlay']){
      const cv = document.getElementById(id);
      if(!cv) continue;
      cv.style.width = `${totalW}px`;
      cv.style.height = `${totalH}px`;
    }

    scheduleBattlemapLayerSync();
    return true;
  }

  function syncHcLMapContainerHeight(){
    try{
      if(mode === 'rb') return false;

      const grid = document.querySelector('.grid');
      if(!(grid instanceof HTMLElement)) return false;

      const outer = grid.parentElement;
      if(!(outer instanceof HTMLElement)) return false;

      const host = outer.parentElement;
      const tables = host ? host.querySelector(':scope > div[style*="display:inline-flex"]') : null;

      const gridRect = grid.getBoundingClientRect();
      const outerRect = outer.getBoundingClientRect();
      const gridH = Math.ceil(gridRect.height || 0);
      const gridW = Math.ceil(gridRect.width || 0);

      if(gridH <= 0 || gridW <= 0) return false;

      const fnhRaw = getComputedStyle(document.documentElement).getPropertyValue('--dba-fn-height');
      const fnh = Math.max(0, Number.parseInt(fnhRaw, 10) || 0);
      const viewportFloor = Math.max(0, Math.floor(Math.min(window.innerHeight * 0.70, window.innerHeight - fnh - 160)));

      const padY = Math.max(24, Math.ceil(outerRect.height - gridRect.height));
      const needH = Math.max(gridH + padY, viewportFloor);

      outer.style.width = '100%';
      outer.style.height = `${needH}px`;
      outer.style.minHeight = `${needH}px`;
      outer.style.boxSizing = 'border-box';
      outer.style.alignItems = 'flex-start';
      outer.style.justifyContent = 'center';
      outer.style.overflow = 'visible';

      if(host instanceof HTMLElement){
        host.style.display = 'flex';
        host.style.flexDirection = 'column';
        host.style.alignItems = 'center';
        host.style.justifyContent = 'flex-start';
        host.style.gap = '12px';
      }

      if(tables instanceof HTMLElement){
        tables.style.marginTop = '0';
        tables.style.flexWrap = 'wrap';
        tables.style.justifyContent = 'center';
        tables.style.maxWidth = '100%';
      }

      return true;
    }catch(_e){
      return false;
    }
  }

  function applyLayerTextOpacity(opacityPct){
    const s = sanitizeOpacity(opacityPct);
    const v = (s / 100).toFixed(2);
    document.documentElement.style.setProperty('--dba-layer-text-opacity', v);
  }

  function getRbGridSizeFromPageScript(){
    // RBページの IIFE スクリプト内に "const GRID_SIZE = N;" がある想定
    const scripts = Array.from(document.querySelectorAll('script'));
    for(const sc of scripts){
      const t = sc.textContent || '';
      if(!t) continue;
      if(t.includes('const GRID_SIZE') && t.includes('modeQS') && t.includes('&m=rb')){
        const m = t.match(/const\s+GRID_SIZE\s*=\s*(\d+)\s*;/);
        if(m) return Number(m[1]);
      }
      // modeQS が無いサンプルにも備えて、rb らしさで緩めに判定
      if(t.includes('const GRID_SIZE') && t.includes('gridWrap') && t.includes('gridOverlay')){
        const m = t.match(/const\s+GRID_SIZE\s*=\s*(\d+)\s*;/);
        if(m) return Number(m[1]);
      }
    }
    return null;
  }

  function ensureRbPointerFix(){
    // gridOverlay の既存クリックを潰し、スケール後も正しく座標→r,c を解釈する
    // さらに、オート装備のクリック/長押し（0.4s）にも対応する
    const overlay = document.getElementById('gridOverlay');
    if(!overlay) return false;

    if(overlay.dataset.dbaPointerFix === '1') return true;
    overlay.dataset.dbaPointerFix = '1';

    function clientXY(evt){
      if(evt.touches && evt.touches[0]) return {x: evt.touches[0].clientX, y: evt.touches[0].clientY};
      if(evt.changedTouches && evt.changedTouches[0]) return {x: evt.changedTouches[0].clientX, y: evt.changedTouches[0].clientY};
      return {x: evt.clientX, y: evt.clientY};
    }

    function calcRC(evt){
      const GRID_SIZE = getRbGridSizeFromPageScript() || 16;
      const rect = overlay.getBoundingClientRect();
      const {x,y} = clientXY(evt);
      const rx = x - rect.left;
      const ry = y - rect.top;
      if(rx < 0 || ry < 0 || rx >= rect.width || ry >= rect.height) return null;
      const cellCss = rect.width / GRID_SIZE; // 見た目上のセルサイズ
      const c = Math.floor(rx / cellCss);
      const r = Math.floor(ry / cellCss);
      if(r<0||c<0||r>=GRID_SIZE||c>=GRID_SIZE) return null;
      return { r, c, x, y };
    }

    // 長押し（0.6秒）
    const LP_MS = 600;
    let lpTimer = 0;
    let lpFired = false;
    let lpCtx = null;

    function clearLP(){
      if(lpTimer){
        clearTimeout(lpTimer);
        lpTimer = 0;
      }
      longPressGaugeCancel();
    }

    // iOS Safari 対策：touch と pointer の二重発火を抑止
    let lastTouchAt = 0;
    let suppressUntil = 0;

    function isTouchLikeEvent(evt){
      return !!(evt && (evt.type === 'touchstart' || evt.type === 'touchend' || evt.type === 'touchcancel'
        || evt.pointerType === 'touch'
        || (evt.touches && evt.touches.length)
        || (evt.changedTouches && evt.changedTouches.length)));
    }

    function isPrimaryActivationEvent(evt){
      if(isTouchLikeEvent(evt)) return true;
      if(evt instanceof MouseEvent || (typeof PointerEvent !== 'undefined' && evt instanceof PointerEvent)){
        return evt.button === 0;
      }
      return true;
    }

    function armContextMenuGuard(ms){
      suppressUntil = Date.now() + Math.max(300, Number(ms || 700));
    }

    function isContextMenuGuardActive(){
      return Date.now() < suppressUntil;
    }

    function onPointerDown(evt){
      if(evt.type === 'touchstart') lastTouchAt = Date.now();
      if(evt.type === 'pointerdown' && (Date.now() - lastTouchAt) < 800) return;

      if(isContextMenuGuardActive()){
        clearLP();
        lpFired = false;
        lpCtx = null;
        return;
      }

      if(!isPrimaryActivationEvent(evt)){
        armContextMenuGuard(900);
        clearLP();
        lpFired = false;
        lpCtx = null;
        return;
      }

      // 既存ハンドラを無効化
      evt.preventDefault();
      evt.stopImmediatePropagation();

      lpFired = false;
      clearLP();
      lpCtx = calcRC(evt);
      if(!lpCtx) return;

      // 長押しメニューは、オート装備OFFでも開けるようにする
      // （タイル操作「要塞を建設」「レーダーを設置」も同じメニュー内にあるため）
      longPressGaugeStart(lpCtx.x, lpCtx.y, LP_MS);
      lpTimer = setTimeout(async () => {
        lpFired = true;
        try{
          longPressGaugeComplete();
          await handleAutoEquipLongPress(lpCtx.r, lpCtx.c, lpCtx.x, lpCtx.y);
        }catch(_e){
          // noop
        }
      }, LP_MS);
    }

    function onPointerUp(evt){
      if(evt.type === 'touchend') lastTouchAt = Date.now();
      if(evt.type === 'pointerup' && (Date.now() - lastTouchAt) < 800) return;

      if(isContextMenuGuardActive()){
        clearLP();
        lpFired = false;
        lpCtx = null;
        return;
      }

      if(!isPrimaryActivationEvent(evt)){
        armContextMenuGuard(900);
        clearLP();
        lpFired = false;
        lpCtx = null;
        return;
      }

      evt.preventDefault();
      evt.stopImmediatePropagation();

      clearLP();
      const ctx = lpCtx || calcRC(evt);
      lpCtx = null;
      if(!ctx) return;
      if(lpFired) return;

      // 通常クリック
      (async () => {
        try{
          if(loadAutoEquipEnabled()){
            await handleAutoEquipClick(ctx.r, ctx.c);
            return;
          }
          if(loadRapidAttackEnabled()){
            await rapidAttackAt(ctx.r, ctx.c);
          }else{
            await openCellDetailModal(ctx.r, ctx.c);
          }
        }catch(_e){
          alert('操作に失敗しました。');
        }
      })();
    }

    overlay.addEventListener('pointerdown', onPointerDown, true);
    overlay.addEventListener('pointerup', onPointerUp, true);
    overlay.addEventListener('pointercancel', (e)=>{ clearLP(); }, true);
    overlay.addEventListener('contextmenu', (evt) => {
      armContextMenuGuard(1200);
      clearLP();
      lpFired = false;
      lpCtx = null;
    }, true);
    overlay.addEventListener('auxclick', (evt) => {
      armContextMenuGuard(900);
      clearLP();
      lpFired = false;
      lpCtx = null;
      evt.preventDefault();
      evt.stopImmediatePropagation();
    }, true);
    // iOS Safari 用（passive:false が重要）
    overlay.addEventListener('touchstart', onPointerDown, { capture:true, passive:false });
    overlay.addEventListener('touchend', onPointerUp, { capture:true, passive:false });
    overlay.addEventListener('touchcancel', (e)=>{ clearLP(); }, { capture:true, passive:false });
    // ★重要：一部環境で pointer で止めても click が別途発火してページ側ハンドラが動く事があるため、
    //        click を capture で確実に遮断する（遷移/既存処理の暴発を防ぐ）
    overlay.addEventListener('click', (evt) => {
      if(isContextMenuGuardActive()){
        evt.preventDefault();
        evt.stopImmediatePropagation();
        return;
      }
      evt.preventDefault();
      evt.stopImmediatePropagation();
    }, true);
    return true;
  }

  // =========================
  // セル詳細モーダル（セルクリックで表示）
  //  - 詳細ページ: makeTeambattleUrl({ r: row, c: col, m: mode })
  //  - <header> の次にある <table> を抽出して表示
  //  - table内の form（「エリアに挑む」「アリーナを強化する」「アリーナを弱体化する」等）はそのまま機能
  // =========================
  // セル詳細：多重open防止（同一セルの二重起動・close直後の再ポップ抑止）
  const DBA_CELL_DETAIL_GUARD = {
    inFlight: false,    // openCellDetailModal の fetch?show 中
    isOpen: false,      // dialog が open 状態
    lastKey: '',        // `${mode}:${row},${col}`
    lastCloseAt: 0      // Date.now()
  };


  function buildCellDetailModal(){
    if(document.getElementById('dba-m-cell-detail')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-cell-detail';
    dlg.className = 'dba-m-std';

    // Top
    const top = document.createElement('div');
    top.className = 'dba-modal__top';

    const title = document.createElement('div');
    title.className = 'dba-modal__title';
    title.textContent = 'セル詳細';

    const btnX = document.createElement('button');
    btnX.type = 'button';
    btnX.className = 'dba-btn-x';
    btnX.textContent = '×';

    top.appendChild(title);
    top.appendChild(btnX);

    // Mid
    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    const box = document.createElement('div');
    box.id = 'dba-cell-detail-box';
    box.textContent = '';
    mid.appendChild(box);

    // Bot（Close）
    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';

    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'dba-btn-close';
    btnClose.textContent = 'Close';
    bot.appendChild(btnClose);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);

    document.body.appendChild(dlg);

    function closeDirect(){
      // close直後に同一セルの open 要求が残っていると再ポップするため、ここで状態を確定させる
      DBA_CELL_DETAIL_GUARD.isOpen = false;
      DBA_CELL_DETAIL_GUARD.lastCloseAt = Date.now();
      try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
    }

    btnX.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeDirect();
    });

    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeDirect();
    });

    // ESC で閉じる
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeDirect();
    });

    // ★重要：セル詳細内で無効化された攻撃ボタンが押された時は、submit させず alert を出す
    dlg.addEventListener('click', (e) => {
      const trigger = (e.target instanceof Element)
        ? e.target.closest('input[type="submit"], input[type="image"], button[type="submit"], button:not([type])')
        : null;
      if(!trigger) return;
      if(!box.contains(trigger)) return;

      if(trigger.matches('.dba-own-capital-attack-disabled, [aria-disabled="true"]') || trigger.disabled){
        e.preventDefault();
        e.stopImmediatePropagation();
        openOwnCapitalAttackBlockedModal();
        return;
      }

      const submitText = sanitizeText(trigger.textContent || trigger.value || '');
      if(
        !submitText.includes('エリアに挑む') &&
        !submitText.includes('エリアに挑戦') &&
        !submitText.includes('このエリアを捕らえよ')
      ) return;

      const form = trigger.closest('form');
      const coord = resolveOwnCapitalAttackCoordFromForm(form);
      if(!coord) return;
      if(!consumeOwnCapitalAttackIfNeeded(coord.row, coord.col)) return;

      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);

    // ★重要：セル詳細内の form submit（例：「エリアに挑む」）を捕捉して遷移抑止 → 戦闘結果モーダル表示
    // - capture で先に止める
    dlg.addEventListener('submit', (e) => {
      const form = e.target;
      if(!(form instanceof HTMLFormElement)) return;
      // セル詳細ボックス配下の form だけ対象
      if(!box.contains(form)) return;

      const disabledAttackBtn = form.querySelector('.dba-own-capital-attack-disabled, [aria-disabled="true"]');
      if(disabledAttackBtn){
        e.preventDefault();
        e.stopImmediatePropagation();
        openOwnCapitalAttackBlockedModal();
        return;
      }

      // 「エリアに挑む」以外（強化/弱体化等）は従来通り遷移させても良いが、
      // ここでは要望に合わせて
      //  - 「エリアに挑む / エリアに挑戦」
      //  - 「このエリアを捕らえよ」
      // を戦闘結果モーダル化する
      // （他の2ボタンは現状の機能維持：＝通常submitで遷移）
      const submitter = e.submitter;
      const submitText = sanitizeText(submitter && (submitter.textContent || submitter.value || ''));
      if(
        !submitText.includes('エリアに挑む') &&
        !submitText.includes('エリアに挑戦') &&
        !submitText.includes('このエリアを捕らえよ')
      ) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      fetchFormAndShowBattleResult(form, submitter).catch(() => {
        // 失敗時は控えめに
        alert('戦闘結果の取得に失敗しました。');
      });
    }, true);
  }

  // =========================
  // 戦闘結果モーダル（「エリアに挑む」結果を表示）
  // =========================
  function buildBattleResultModal(){
    if(document.getElementById('dba-m-battle-result')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-battle-result';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';

    const title = document.createElement('div');
    title.className = 'dba-modal__title';
    title.textContent = '戦闘結果';

    const center = document.createElement('div');
    center.className = 'dba-br-top-center';

    // オプションボタン（戦闘結果専用オプションmodalを開く）
    const btnOpt = document.createElement('button');
    btnOpt.type = 'button';
    btnOpt.id = 'dba-br-btn-option';
    btnOpt.className = 'dba-br-btn-opt';
    btnOpt.textContent = 'オプション';
    center.appendChild(btnOpt);

    const btnX = document.createElement('button');
    btnX.type = 'button';
    btnX.className = 'dba-btn-x';
    btnX.textContent = '×';

    top.appendChild(title);
    top.appendChild(center);
    top.appendChild(btnX);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    const box = document.createElement('div');
    box.id = 'dba-battle-result-box';
    box.textContent = '';
    mid.appendChild(box);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';

    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'dba-btn-close';
    btnClose.textContent = 'Close';
    bot.appendChild(btnClose);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){
      try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
    }

    btnX.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeDirect();
    });
    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeDirect();
    });

    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeDirect();
    });

    // オプションボタン
    btnOpt.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openBattleResultOptionsModal();
    });

    // 初期状態（配置/透過）を反映
    applyBattleResultOptionsToModal();
  }

  // =========================
  // 戦闘結果：透過ON時の表示用フロートパネル（dialogを使わない）
  //  - dialog(top-layer)が下のクリックを塞ぐ環境対策
  // =========================
  function ensureBattleResultFloatPanel(){
    if(document.getElementById('dba-br-float')) return;
    const root = document.createElement('div');
    root.id = 'dba-br-float';
    root.dataset.open = '0';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';

    const title = document.createElement('div');
    title.className = 'dba-modal__title';
    title.id = 'dba-br-float-title';
    title.textContent = '戦闘結果';

    const center = document.createElement('div');
    center.className = 'dba-br-top-center';
    const btnOpt = document.createElement('button');
    btnOpt.type = 'button';
    btnOpt.id = 'dba-br-float-btn-option';
    btnOpt.className = 'dba-br-btn-opt';
    btnOpt.textContent = 'オプション';
    center.appendChild(btnOpt);

    top.appendChild(title);
    top.appendChild(center);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';
    const box = document.createElement('div');
    box.id = 'dba-br-float-box';
    mid.appendChild(box);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';
    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'dba-btn-close';
    btnClose.textContent = 'Close';
    bot.appendChild(btnClose);

    root.appendChild(top);
    root.appendChild(mid);
    root.appendChild(bot);
    document.body.appendChild(root);

    btnOpt.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openBattleResultOptionsModal();
    });
    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeBattleResultFloatPanel();
    });
  }

  function openBattleResultFloatPanelWithText(text, titleText){
    ensureBattleResultFloatPanel();
    const root = document.getElementById('dba-br-float');
    const box = document.getElementById('dba-br-float-box');
    const title = document.getElementById('dba-br-float-title');
    if(!root || !box) return;
    if(title) title.textContent = titleText || '戦闘結果';

    // 全文保持（末尾2行切替用）
    root.dataset.dbaBattleFullText = String(text ?? '');

    const showText = loadBattleResultTail2Enabled() ? getLastTwoLines(root.dataset.dbaBattleFullText) : root.dataset.dbaBattleFullText;
    box.textContent = '';
    const pre = document.createElement('div');
    pre.className = 'dba-battle-result-text';
    pre.textContent = showText;
    box.appendChild(pre);

    root.dataset.open = '1';
    const mid = root.querySelector('.dba-modal__mid'); if(mid instanceof HTMLElement) mid.dataset.dbaWheelScrollable = '1';
    applyBattleResultOptionsToFloat(); // 位置など（透過機能に紐づけない）
  }

  function closeBattleResultFloatPanel(){
    const root = document.getElementById('dba-br-float');
    if(!root) return;
    root.dataset.open = '0';
  }

  function getBattleResultFloatScrollableMid(){
    const root = document.getElementById('dba-br-float');
    if(!root || root.dataset.open !== '1') return null;
    const mid = root.querySelector('.dba-modal__mid');
    if(!(mid instanceof HTMLElement)) return null;
    return mid;
  }

  function isPointInsideRect(x, y, rect){
    return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function canScrollBattleResultFloatMid(mid, deltaY){
    if(!(mid instanceof HTMLElement)) return false;
    const scrollRange = mid.scrollHeight - mid.clientHeight;
    if(scrollRange <= 0) return false;

    if(deltaY > 0){
      return mid.scrollTop < scrollRange;
    }
    if(deltaY < 0){
      return mid.scrollTop > 0;
    }
    return false;
  }

  function handleBattleResultFloatWheel(evt){
    if(!loadBattleResultPassThrough()) return;

    const mid = getBattleResultFloatScrollableMid();
    if(!mid) return;

    const root = document.getElementById('dba-br-float');
    if(!root) return;

    const rect = root.getBoundingClientRect();
    const x = Number(evt.clientX || 0);
    const y = Number(evt.clientY || 0);

    // フロート上でホイールされた時だけ拾う
    if(!isPointInsideRect(x, y, rect)) return;

    const deltaY = Number(evt.deltaY || 0);
    if(!canScrollBattleResultFloatMid(mid, deltaY)) return;

    evt.preventDefault();
    evt.stopPropagation();

    mid.scrollTop += deltaY;
  }

  function ensureBattleResultFloatWheelBridge(){
    if(document.documentElement.dataset.dbaBrFloatWheelBridge === '1') return;
    document.documentElement.dataset.dbaBrFloatWheelBridge = '1';

    document.addEventListener('wheel', handleBattleResultFloatWheel, {
      capture: true,
      passive: false
    });
  }

  function applyBattleResultOptionsToFloat(){
    const root = document.getElementById('dba-br-float');
    if(!root) return;

    // 上端からの距離（fnbar の下 + 指定px）
    const topPx = loadBattleResultTopOffsetPx();
    root.style.top = `calc(var(--dba-fn-height) + ${topPx}px)`;

    // 横幅
    const widthPx = loadBattleResultWidthPx();
    root.style.width = `min(${widthPx}px, calc(100vw - 24px))`;

    // Closeボタンの表示/非表示
    try{
      const hideClose = loadBattleResultHideClose();
      const btnClose = root.querySelector('.dba-btn-close');
      if(btnClose) btnClose.style.display = hideClose ? 'none' : '';
    }catch(_e){}

    // オプションボタンの表示/非表示
    try{
      const hideOpt = loadBattleResultHideOption();
      const btnOpt = root.querySelector('#dba-br-float-btn-option');
      if(btnOpt) btnOpt.style.display = hideOpt ? 'none' : '';
    }catch(_e){}

    // ※「配置移動」機能は passThrough と独立（ここでは align のみ反映）
    const align = loadBattleResultAlign();
    if(align === 'left'){
      root.style.left = '12px';
      root.style.right = 'auto';
    }else if(align === 'right'){
      root.style.left = 'auto';
      root.style.right = '12px';
    }else{
      root.style.left = '12px';
      root.style.right = '12px';
    }
  }

  // =========================
  // 戦闘結果：オプションモーダル（dba-m-battle-result専用）
  // =========================
  function applyBattleResultOptionsToModal(){
    const dlg = document.getElementById('dba-m-battle-result');
    if(!dlg) return;

    // 横幅
    const widthPx = loadBattleResultWidthPx();
    dlg.style.width = `min(${widthPx}px, calc(100vw - 24px))`;

    // 配置（dialogの左右余白で寄せる）
    const align = loadBattleResultAlign();
    if(align === 'left'){
      dlg.style.marginLeft = '12px';
      dlg.style.marginRight = 'auto';
    }else if(align === 'right'){
      dlg.style.marginLeft = 'auto';
      dlg.style.marginRight = '12px';
    }else{
      dlg.style.marginLeft = 'auto';
      dlg.style.marginRight = 'auto';
    }

    // 上端からの距離（fnbar の下 + 指定px）
    const topPx = loadBattleResultTopOffsetPx();
    dlg.style.marginTop = `calc(var(--dba-fn-height) + ${topPx}px)`;
    dlg.style.marginBottom = 'auto';

    // クリック透過（Close/Option以外は透過 + 半透明 + ×非表示はCSS側）
    const pass = loadBattleResultPassThrough();
    if(pass) dlg.classList.add('dba-br-pass');
    else dlg.classList.remove('dba-br-pass');

    // Closeボタンの表示/非表示
    try{
      const hideClose = loadBattleResultHideClose();
      const btnClose = dlg.querySelector('.dba-btn-close');
      if(btnClose) btnClose.style.display = hideClose ? 'none' : '';
    }catch(_e){}

    // オプションボタンの表示/非表示
    try{
      const hideOpt = loadBattleResultHideOption();
      const btnOpt = dlg.querySelector('#dba-br-btn-option');
      if(btnOpt) btnOpt.style.display = hideOpt ? 'none' : '';
    }catch(_e){}
  }

  function buildBattleResultOptionsModal(){
    if(document.getElementById('dba-m-battle-result-opt')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-battle-result-opt';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';

    const title = document.createElement('div');
    title.className = 'dba-modal__title';
    title.textContent = '戦闘結果：オプション';

    const btnX = document.createElement('button');
    btnX.type = 'button';
    btnX.className = 'dba-btn-x';
    btnX.textContent = '×';

    top.appendChild(title);
    top.appendChild(btnX);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    // (1) 末尾2行のみ表示
    const tail2 = document.createElement('label');
    tail2.className = 'dba-ae-opt-row';
    tail2.id = 'dba-br-opt-tail2-wrap';
    const tail2Chk = document.createElement('input');
    tail2Chk.type = 'checkbox';
    tail2Chk.id = 'dba-br-opt-tail2';
    const tail2Text = document.createElement('span');
    tail2Text.textContent = '戦闘ログの末尾2行のみを表示する。';
    tail2.appendChild(tail2Chk);
    tail2.appendChild(tail2Text);
    mid.appendChild(tail2);

    // (2) 配置場所（ラジオ）
    const placeWrap = document.createElement('div');
    placeWrap.style.marginTop = '12px';
    placeWrap.style.border = '1px solid #00000022';
    placeWrap.style.borderRadius = '12px';
    placeWrap.style.background = '#fff';
    placeWrap.style.padding = '10px 10px';

    const placeTitle = document.createElement('div');
    placeTitle.style.fontWeight = '900';
    placeTitle.style.textAlign = 'left';
    placeTitle.style.marginBottom = '8px';
    placeTitle.textContent = '配置場所';
    placeWrap.appendChild(placeTitle);

    const mkRadio = (value, label) => {
      const lab = document.createElement('label');
      lab.style.display = 'inline-flex';
      lab.style.alignItems = 'center';
      lab.style.gap = '8px';
      lab.style.marginRight = '14px';
      lab.style.fontWeight = '800';
      lab.style.cursor = 'pointer';
      const r = document.createElement('input');
      r.type = 'radio';
      r.name = 'dba-br-opt-align';
      r.value = value;
      const sp = document.createElement('span');
      sp.textContent = label;
      lab.appendChild(r);
      lab.appendChild(sp);
      return lab;
    };

    placeWrap.appendChild(mkRadio('left', '左寄り'));
    placeWrap.appendChild(mkRadio('center', '中央'));
    placeWrap.appendChild(mkRadio('right', '右寄り'));

    // 上端からの距離（数値）
    const topOffsetRow = document.createElement('div');
    topOffsetRow.style.marginTop = '10px';
    topOffsetRow.style.display = 'flex';
    topOffsetRow.style.alignItems = 'center';
    topOffsetRow.style.justifyContent = 'flex-start';
    topOffsetRow.style.gap = '8px';
    topOffsetRow.style.fontWeight = '800';
    topOffsetRow.style.textAlign = 'left';

    const topOffsetLab = document.createElement('span');
    topOffsetLab.textContent = '上端からの距離';

    const topOffsetInp = document.createElement('input');
    topOffsetInp.type = 'number';
    topOffsetInp.min = '0';
    topOffsetInp.max = '2000';
    topOffsetInp.step = '1';
    topOffsetInp.id = 'dba-br-opt-top';
    topOffsetInp.style.width = '92px';

    const topOffsetUnit = document.createElement('span');
    topOffsetUnit.textContent = 'px';

    topOffsetRow.appendChild(topOffsetLab);
    topOffsetRow.appendChild(topOffsetInp);
    topOffsetRow.appendChild(topOffsetUnit);
    placeWrap.appendChild(topOffsetRow);

    // ウィンドウの横幅（数値）
    const widthRow = document.createElement('div');
    widthRow.style.marginTop = '10px';
    widthRow.style.display = 'flex';
    widthRow.style.alignItems = 'center';
    widthRow.style.justifyContent = 'flex-start';
    widthRow.style.gap = '8px';
    widthRow.style.fontWeight = '800';
    widthRow.style.textAlign = 'left';

    const widthLab = document.createElement('span');
    widthLab.textContent = 'ウィンドウの横幅';

    const widthInp = document.createElement('input');
    widthInp.type = 'number';
    widthInp.min = '120';
    widthInp.max = '2000';
    widthInp.step = '1';
    widthInp.id = 'dba-br-opt-width';
    widthInp.style.width = '92px';

    const widthUnit = document.createElement('span');
    widthUnit.textContent = 'px';

    widthRow.appendChild(widthLab);
    widthRow.appendChild(widthInp);
    widthRow.appendChild(widthUnit);
    placeWrap.appendChild(widthRow);

    mid.appendChild(placeWrap);

    // (3) クリック透過
    const passWrap = document.createElement('label');
    passWrap.className = 'dba-ae-opt-row';
    passWrap.id = 'dba-br-opt-pass-wrap';
    passWrap.style.marginTop = '12px';

    const passChk = document.createElement('input');
    passChk.type = 'checkbox';
    passChk.id = 'dba-br-opt-pass';
    const passText = document.createElement('span');
    passText.textContent = '「Close」「オプション」ボタン以外はクリック判定を透過させる。';
    passWrap.appendChild(passChk);
    passWrap.appendChild(passText);
    mid.appendChild(passWrap);

    // (4) Closeボタン非表示
    const hideCloseWrap = document.createElement('label');
    hideCloseWrap.className = 'dba-ae-opt-row';
    hideCloseWrap.id = 'dba-br-opt-hideclose-wrap';
    hideCloseWrap.style.marginTop = '12px';

    const hideCloseChk = document.createElement('input');
    hideCloseChk.type = 'checkbox';
    hideCloseChk.id = 'dba-br-opt-hideclose';
    const hideCloseText = document.createElement('span');
    hideCloseText.textContent = '「Close」ボタンを非表示にする。';
    hideCloseWrap.appendChild(hideCloseChk);
    hideCloseWrap.appendChild(hideCloseText);
    mid.appendChild(hideCloseWrap);

    // (5) オプションボタン非表示
    const hideOptWrap = document.createElement('label');
    hideOptWrap.className = 'dba-ae-opt-row';
    hideOptWrap.id = 'dba-br-opt-hideopt-wrap';
    hideOptWrap.style.marginTop = '12px';

    const hideOptChk = document.createElement('input');
    hideOptChk.type = 'checkbox';
    hideOptChk.id = 'dba-br-opt-hideopt';
    const hideOptText = document.createElement('span');
    hideOptText.textContent = '「オプション」ボタンを非表示にする。';
    hideOptWrap.appendChild(hideOptChk);
    hideOptWrap.appendChild(hideOptText);
    mid.appendChild(hideOptWrap);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';
    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'dba-btn-close';
    btnClose.textContent = 'Close';
    bot.appendChild(btnClose);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){
      try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
    }

    btnX.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeDirect(); });
    btnClose.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeDirect(); });

    // 初期値反映（open時にも更新するが、念のため）
    tail2Chk.checked = loadBattleResultTail2Enabled();
    passChk.checked = loadBattleResultPassThrough();
    hideCloseChk.checked = loadBattleResultHideClose();
    hideOptChk.checked = loadBattleResultHideOption();
    const align = loadBattleResultAlign();
    for(const r of Array.from(dlg.querySelectorAll('input[type="radio"][name="dba-br-opt-align"]'))){
      r.checked = (r.value === align);
    }
    const topInp = dlg.querySelector('#dba-br-opt-top');
    if(topInp) topInp.value = String(loadBattleResultTopOffsetPx());
    const widthInp0 = dlg.querySelector('#dba-br-opt-width');
    if(widthInp0) widthInp0.value = String(loadBattleResultWidthPx());

    // 変更イベント
    tail2Chk.addEventListener('change', (e) => {
      e.stopPropagation();
      saveBattleResultTail2Enabled(!!tail2Chk.checked);
      updateBattleResultModalTextView();
    });
    passChk.addEventListener('change', (e) => {
      e.stopPropagation();
      saveBattleResultPassThrough(!!passChk.checked);
      applyBattleResultOptionsToModal();
      // 透過ON/OFFでモーダルの開き方が変わるため、開いてるなら表示形態を揃える
      normalizeBattleResultDialogOpenMode();
    });

    hideCloseChk.addEventListener('change', (e) => {
      e.stopPropagation();
      saveBattleResultHideClose(!!hideCloseChk.checked);
      applyBattleResultOptionsToModal();
      applyBattleResultOptionsToFloat();
    });

    hideOptChk.addEventListener('change', (e) => {
      e.stopPropagation();
      saveBattleResultHideOption(!!hideOptChk.checked);
      applyBattleResultOptionsToModal();
      applyBattleResultOptionsToFloat();
    });

    // 上端からの距離
    const topInp2 = dlg.querySelector('#dba-br-opt-top');
    if(topInp2){
      topInp2.addEventListener('change', (e) => {
        e.stopPropagation();
        saveBattleResultTopOffsetPx(topInp2.value);
        applyBattleResultOptionsToModal();
        applyBattleResultOptionsToFloat();
      });
    }

    // 横幅
    const widthInp2 = dlg.querySelector('#dba-br-opt-width');
    if(widthInp2){
      widthInp2.addEventListener('change', (e) => {
        e.stopPropagation();
        saveBattleResultWidthPx(widthInp2.value);
        applyBattleResultOptionsToModal();
        applyBattleResultOptionsToFloat();
      });
    }

    dlg.addEventListener('change', (e) => {
      const t = e.target;
      if(!(t instanceof HTMLInputElement)) return;
      if(t.type !== 'radio') return;
      if(t.name !== 'dba-br-opt-align') return;
      saveBattleResultAlign(t.value);
      applyBattleResultOptionsToModal();
      applyBattleResultOptionsToFloat();
    }, true);
  }

  function openBattleResultOptionsModal(){
    buildBattleResultOptionsModal();
    const dlg = document.getElementById('dba-m-battle-result-opt');
    if(!dlg) return;

    // 開くたびに最新の保存値を反映
    const tail2Chk = dlg.querySelector('#dba-br-opt-tail2');
    if(tail2Chk) tail2Chk.checked = loadBattleResultTail2Enabled();
    const passChk = dlg.querySelector('#dba-br-opt-pass');
    if(passChk) passChk.checked = loadBattleResultPassThrough();
    const hideCloseChk = dlg.querySelector('#dba-br-opt-hideclose');
    if(hideCloseChk) hideCloseChk.checked = loadBattleResultHideClose();
    const hideOptChk = dlg.querySelector('#dba-br-opt-hideopt');
    if(hideOptChk) hideOptChk.checked = loadBattleResultHideOption();
    const align = loadBattleResultAlign();
    for(const r of Array.from(dlg.querySelectorAll('input[type="radio"][name="dba-br-opt-align"]'))){
      r.checked = (r.value === align);
    }
    const topInp = dlg.querySelector('#dba-br-opt-top');
    if(topInp) topInp.value = String(loadBattleResultTopOffsetPx());
    const widthInp = dlg.querySelector('#dba-br-opt-width');
    if(widthInp) widthInp.value = String(loadBattleResultWidthPx());

    try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
  }

  // ★重要：戦闘結果のオプション modal は常に最前面（top-layerの一番上）に保つ
  // - battle-result 側を showModal で出し直す等で前後関係が崩れるケースの対策
  // - 状態は localStorage に保存されているため、閉じて即再表示してもUIは復元できる
  function bringBattleResultOptionsModalToFront(){
    const opt = document.getElementById('dba-m-battle-result-opt');
    if(!opt) return;
    const isOpen = !!(opt.open || opt.hasAttribute('open'));
    if(!isOpen) return;
    try{ opt.close(); }catch(_e){ opt.removeAttribute('open'); }
    try{ opt.showModal(); }catch(_e2){ opt.setAttribute('open',''); }
  }

  function normalizeBattleResultDialogOpenMode(){
    // クリック透過ON：dialog(top-layer)自体がクリックを塞ぐ環境があるため、
    // dialogを閉じ、floatへ切り替える
    const dlg = document.getElementById('dba-m-battle-result');
    if(!dlg) return;
    const pass = loadBattleResultPassThrough();
    const isDlgOpen = dlg.hasAttribute('open');

    if(pass){
      if(isDlgOpen){
        const ttl = dlg.querySelector('.dba-modal__title')?.textContent || '戦闘結果';
        const full = dlg.dataset.dbaBattleFullText || (document.getElementById('dba-battle-result-box')?.textContent || '');
        try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
        openBattleResultFloatPanelWithText(full, ttl);
      }
      // 既にfloat表示なら、位置だけ合わせる
      applyBattleResultOptionsToFloat();
    }else{
      // pass OFF：floatが出ていれば閉じ、必要なら dialog を再表示（全文保持がある時だけ）
      const floatRoot = document.getElementById('dba-br-float');
      if(floatRoot && floatRoot.dataset.open === '1'){
        const ttl = document.getElementById('dba-br-float-title')?.textContent || '戦闘結果';
        const full = floatRoot.dataset.dbaBattleFullText || '';
        closeBattleResultFloatPanel();
        if(full){
          openBattleResultModalWithNode(full, ttl);
          // ★battle-result が前に出て opt が操作不能になるのを防ぐ
          bringBattleResultOptionsModalToFront();
        }
      }
    }
  }

  function getLastTwoLines(text){
    const raw = String(text ?? '');
    // 改行正規化
    let lines = raw.replace(/\r/g, '').split('\n');
    // 末尾の空行は落とす（「最後の2行」を安定化）
    while(lines.length > 0 && lines[lines.length - 1] === ''){
      lines.pop();
    }
    if(lines.length <= 2) return lines.join('\n');
    return lines.slice(-2).join('\n');
  }

  function updateBattleResultModalTextView(){
    const on = loadBattleResultTail2Enabled();
    const dlg = document.getElementById('dba-m-battle-result');
    const box = document.getElementById('dba-battle-result-box');
    const floatRoot = document.getElementById('dba-br-float');
    const floatBox  = document.getElementById('dba-br-float-box');

    const full =
      (floatRoot && floatRoot.dataset.open === '1' && floatRoot.dataset.dbaBattleFullText)
        ? (floatRoot.dataset.dbaBattleFullText || '')
        : (dlg ? (dlg.dataset.dbaBattleFullText || '') : '');

    // full が無い場合は何もしない（node表示やエラー文などに干渉しない）
    if(!full) return;

    const showText = on ? getLastTwoLines(full) : full;
    // dialog側
    if(dlg && box){
      box.textContent = '';
      const pre = document.createElement('div');
      pre.className = 'dba-battle-result-text';
      pre.textContent = showText;
      box.appendChild(pre);
    }
    // float側
    if(floatRoot && floatRoot.dataset.open === '1' && floatBox){
      floatBox.textContent = '';
      const pre2 = document.createElement('div');
      pre2.className = 'dba-battle-result-text';
      pre2.textContent = showText;
      floatBox.appendChild(pre2);
    }
  }

  function openBattleResultModalWithNode(nodeOrText, titleText){
    buildBattleResultModal();
    ensureBattleResultFloatWheelBridge();
    const dlg = document.getElementById('dba-m-battle-result');
    const box = document.getElementById('dba-battle-result-box');
    const title = dlg ? dlg.querySelector('.dba-modal__title') : null;
    if(!dlg || !box) return;
    if(title) title.textContent = titleText || '戦闘結果';
    // オプション（配置/透過）を反映
    applyBattleResultOptionsToModal();

    // クリック透過ON：dialog(top-layer)を使うと下のクリックが塞がる環境があるため、
    // ここでは dialog を開かず、透過フロートで表示する
    const pass = loadBattleResultPassThrough();
    if(pass){
      // dialogが開いていたら閉じる（底辺へ飛ぶ副作用も回避）
      try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
      // floatへ表示
      if(typeof nodeOrText === 'string'){
        openBattleResultFloatPanelWithText(nodeOrText, titleText || '戦闘結果');
      }else if(nodeOrText instanceof Node){
        // nodeの場合はテキスト化して表示（透過モードは軽量優先）
        const txt = sanitizeText(nodeOrText.textContent || '') || '結果を表示できませんでした。';
        openBattleResultFloatPanelWithText(txt, titleText || '戦闘結果');
      }else{
        openBattleResultFloatPanelWithText('結果を表示できませんでした。', titleText || '戦闘結果');
      }
      return;
    }else{
      // passThrough OFF のときは float が出ていたら消す
      closeBattleResultFloatPanel();
    }

    box.textContent = '';
    if(typeof nodeOrText === 'string'){
      // 全文を保持（チェックON時に末尾2行表示へ切替するため）
      dlg.dataset.dbaBattleFullText = nodeOrText;
      const pre = document.createElement('div');
      pre.className = 'dba-battle-result-text';
      // 初期描画はチェック状態に従う
      pre.textContent = loadBattleResultTail2Enabled() ? getLastTwoLines(nodeOrText) : nodeOrText;
      box.appendChild(pre);
    }else if(nodeOrText instanceof Node){
      // node 表示時は「全文保持」をクリア（チェック表示切替の対象外）
      delete dlg.dataset.dbaBattleFullText;
      box.appendChild(nodeOrText);
    }else{
      delete dlg.dataset.dbaBattleFullText;
      const pre = document.createElement('div');
      pre.className = 'dba-battle-result-text';
      pre.textContent = '結果を表示できませんでした。';
      box.appendChild(pre);
    }
    // passThrough OFF：従来通り dialog で表示
    try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
    // ★battle-result を表示しても、オプションが開いているなら必ずオプションを最前面へ
    bringBattleResultOptionsModalToFront();
  }

  function openRosterProgressAlertModal(text, titleText){
    buildRosterResultModal();
    const dlg = document.getElementById('dba-m-roster-result');
    const ttl = dlg ? dlg.querySelector('.dba-modal__title') : null;
    const box = document.getElementById('dba-roster-result-box');
    if(!dlg || !box) return;

    setRosterResultModalAlertMode(true);
    if(ttl) ttl.textContent = titleText || 'オート装備';
    box.textContent = String(text ?? '');

    try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open', ''); }
  }

  function closeRosterProgressAlertModal(){
    const dlg = document.getElementById('dba-m-roster-result');
    if(!dlg) return;
    try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
    setRosterResultModalAlertMode(false);
  }

  // =========================
  // 装備変更結果モーダル（装備ロスター専用）
  //  - 戦闘結果(dba-m-battle-result)とは分離
  //  - 汎用レイアウト(dba-m-std)を使用
  // =========================
  function buildRosterResultModal(){
    if(document.getElementById('dba-m-roster-result')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-roster-result';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';

    const title = document.createElement('div');
    title.className = 'dba-modal__title';
    title.textContent = '装備変更結果';

    const btnX = document.createElement('button');
    btnX.type = 'button';
    btnX.className = 'dba-btn-x';
    btnX.textContent = '×';

    top.appendChild(title);
    top.appendChild(btnX);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    const box = document.createElement('div');
    box.id = 'dba-roster-result-box';
    box.textContent = '';
    mid.appendChild(box);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';

    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'dba-btn-close';
    btnClose.textContent = 'Close';
    bot.appendChild(btnClose);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){
      try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
    }
    btnX.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeDirect();
    });
    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeDirect();
    });
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeDirect();
    });
  }

  function setRosterResultModalAlertMode(on){
    const dlg = document.getElementById('dba-m-roster-result');
    if(!dlg) return;
    if(on){
      dlg.classList.remove('dba-m-std');
      dlg.classList.add('dba-m-alert');
    }else{
      dlg.classList.remove('dba-m-alert');
      dlg.classList.add('dba-m-std');
    }
  }

  function openRosterResultModalWithNode(nodeOrText, titleText){
    buildRosterResultModal();
    const dlg = document.getElementById('dba-m-roster-result');
    const box = document.getElementById('dba-roster-result-box');
    const title = dlg ? dlg.querySelector('.dba-modal__title') : null;
    if(!dlg || !box) return;
    setRosterResultModalAlertMode(false);
    if(title) title.textContent = titleText || '装備変更結果';

    // 既存の自動クローズ予約があれば解除
    try{
      const tid = Number(dlg.dataset.dbaAutoCloseTimer || '0');
      if(tid) clearTimeout(tid);
    }catch(_e){}
    dlg.dataset.dbaAutoCloseTimer = '0';


    box.textContent = '';
    if(typeof nodeOrText === 'string'){
      const pre = document.createElement('div');
      pre.className = 'dba-roster-result-text';
      pre.textContent = nodeOrText;
      box.appendChild(pre);
    }else if(nodeOrText instanceof Node){
      box.appendChild(nodeOrText);
    }else{
      const pre = document.createElement('div');
      pre.className = 'dba-roster-result-text';
      pre.textContent = '結果を表示できませんでした。';
      box.appendChild(pre);
    }

    try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }

    // ★オート装備の「装備切替完了」通知だけ、設定に応じて自動クローズ
    try{
      const isAutoEquip = sanitizeText(titleText || '') === 'オート装備';
      const isDoneMsg = (typeof nodeOrText === 'string') && String(nodeOrText).includes('装備切替完了');
      if(isAutoEquip && isDoneMsg && loadAutoEquipNotifyAutoCloseEnabled()){
        const sec = loadAutoEquipNotifyAutoCloseSec();
        const ms = Math.max(1, Number(sec) * 1000);
        const tid = setTimeout(() => {
          // 既に閉じていたら何もしない
          const d = document.getElementById('dba-m-roster-result');
          if(!d) return;
          try{ d.close(); }catch(_e2){ d.removeAttribute('open'); }
        }, ms);
        dlg.dataset.dbaAutoCloseTimer = String(tid);
      }
    }catch(_e){}
  }

  function closeRosterResultModal(){
    const dlg = document.getElementById('dba-m-roster-result');
    if(!dlg) return;
    try{
      const tid = Number(dlg.dataset.dbaAutoCloseTimer || '0');
      if(tid) clearTimeout(tid);
    }catch(_e){}
    dlg.dataset.dbaAutoCloseTimer = '0';
    try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
  }

  function buildPresetMissingAlertModal(){
    if(document.getElementById('dba-m-preset-missing-alert')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-preset-missing-alert';
    dlg.className = 'dba-m-alert';

    const title = document.createElement('div');
    title.className = 'dba-alert__title';
    title.textContent = 'Alert:';

    const mid = document.createElement('div');
    mid.className = 'dba-alert__mid';
    mid.id = 'dba-preset-missing-alert-text';
    mid.textContent = 'アイテムが見つかりませんでした。\nこのプリセットを削除しますか？';

    const bot = document.createElement('div');
    bot.className = 'dba-alert__bot';

    const btnYes = document.createElement('button');
    btnYes.type = 'button';
    btnYes.className = 'dba-btn-ok';
    btnYes.textContent = 'はい';

    const btnNo = document.createElement('button');
    btnNo.type = 'button';
    btnNo.className = 'dba-btn-close';
    btnNo.textContent = 'いいえ';

    bot.appendChild(btnYes);
    bot.appendChild(btnNo);

    dlg.appendChild(title);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);
  }

  function openPresetMissingAlertModal(presetName){
    buildPresetMissingAlertModal();
    const dlg = document.getElementById('dba-m-preset-missing-alert');
    const mid = document.getElementById('dba-preset-missing-alert-text');
    if(!dlg || !mid) return Promise.resolve(false);

    const nm = sanitizeText(presetName);
    mid.textContent = 'アイテムが見つかりませんでした。\nこのプリセットを削除しますか？';

    return new Promise((resolve) => {
      const btnYes = dlg.querySelector('.dba-btn-ok');
      const btnNo = dlg.querySelector('.dba-btn-close');

      const finalize = (answer) => {
        try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
        resolve(answer);
      };

      if(btnYes){
        btnYes.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          finalize(true);
        };
      }
      if(btnNo){
        btnNo.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          finalize(false);
        };
      }
      dlg.oncancel = (e) => {
        e.preventDefault();
        finalize(false);
      };

      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
    });
  }

  function ensurePresetDuplicateRenameModal(){
    if(document.getElementById('dba-m-preset-dup-rename')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-preset-dup-rename';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';

    const title = document.createElement('div');
    title.className = 'dba-modal__title';
    title.textContent = '重複したプリセット名の変更';

    const btnX = document.createElement('button');
    btnX.type = 'button';
    btnX.className = 'dba-btn-x';
    btnX.textContent = '×';

    top.appendChild(title);
    top.appendChild(btnX);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    const msg = document.createElement('div');
    msg.id = 'dba-preset-dup-rename-msg';
    msg.style.textAlign = 'left';
    msg.style.fontWeight = '700';
    msg.style.lineHeight = '1.45';
    msg.style.whiteSpace = 'pre-wrap';
    msg.style.marginBottom = '10px';
    mid.appendChild(msg);

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'dba-preset-dup-rename-input';
    input.className = 'dba-add-name';
    input.placeholder = '新しいプリセット名';
    mid.appendChild(input);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';

    const btnOk = document.createElement('button');
    btnOk.type = 'button';
    btnOk.className = 'dba-btn-ok';
    btnOk.textContent = '決定';

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'dba-btn-close';
    btnCancel.textContent = 'Cancel';

    bot.appendChild(btnOk);
    bot.appendChild(btnCancel);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){
      try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
    }
    btnX.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeDirect();
    });
    btnCancel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeDirect();
    });
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeDirect();
    });
  }

  function openPresetDuplicateRenameModal(oldName, occurrence){
    ensurePresetDuplicateRenameModal();
    const dlg = document.getElementById('dba-m-preset-dup-rename');
    const msg = document.getElementById('dba-preset-dup-rename-msg');
    const input = document.getElementById('dba-preset-dup-rename-input');
    if(!dlg || !msg || !input) return Promise.resolve(null);

    const nm = sanitizeText(oldName);
    const occ = Math.max(2, Number(occurrence) || 2);
    msg.textContent =
      `重複したプリセット名を検出しました。\n` +
      `後から追加・編集された側の「${nm}」（${occ}件目）の名前を変更してください。`;
    input.value = '';

    return new Promise((resolve) => {
      const btnOk = dlg.querySelector('.dba-btn-ok');
      const btnCancel = dlg.querySelector('.dba-btn-close');

      const finalize = (value) => {
        try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
        resolve(value);
      };

      if(btnOk){
        btnOk.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          finalize(String(input.value || ''));
        };
      }
      if(btnCancel){
        btnCancel.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          finalize(null);
        };
      }
      dlg.oncancel = (e) => {
        e.preventDefault();
        finalize(null);
      };

      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
      try{ input.focus(); input.select(); }catch(_e){}
    });
  }

  function buildPresetDeleteResultModal(){
    if(document.getElementById('dba-m-preset-delete-result')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-preset-delete-result';
    dlg.className = 'dba-m-alert';

    const title = document.createElement('div');
    title.className = 'dba-alert__title';
    title.textContent = 'Result:';

    const mid = document.createElement('div');
    mid.className = 'dba-alert__mid';
    mid.id = 'dba-preset-delete-result-text';
    mid.textContent = 'プリセットを削除しました。';

    const bot = document.createElement('div');
    bot.className = 'dba-alert__bot';

    const btnOk = document.createElement('button');
    btnOk.type = 'button';
    btnOk.className = 'dba-btn-ok';
    btnOk.textContent = 'OK';

    bot.appendChild(btnOk);

    dlg.appendChild(title);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);
  }

  function openPresetDeleteResultModal(messageText){
    buildPresetDeleteResultModal();
    const dlg = document.getElementById('dba-m-preset-delete-result');
    const mid = document.getElementById('dba-preset-delete-result-text');
    if(!dlg || !mid) return Promise.resolve();

    mid.textContent = sanitizeText(messageText) || 'プリセットを削除しました。';

    return new Promise((resolve) => {
      const btnOk = dlg.querySelector('.dba-btn-ok');

      const finalize = () => {
        try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
        resolve();
      };

      if(btnOk){
        btnOk.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          finalize();
        };
      }
      dlg.oncancel = (e) => {
        e.preventDefault();
        finalize();
      };

      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
    });
  }

  function isItemMissingResponseText(text){
    return sanitizeText(text) === 'アイテムが見つかりませんでした。';
  }

  async function handleMissingPresetDuringEquip(presetName){
    closeRosterResultModal();

    const nm = sanitizeText(presetName);
    const yes = await openPresetMissingAlertModal(nm);
    if(!yes){
      return { ok:false, missing:true, deleted:false };
    }

    const deleted = deletePreset(nm);
    try{
      const rosterDlg = document.getElementById('dba-m-roster');
      if(rosterDlg && (rosterDlg.open || rosterDlg.hasAttribute('open'))){
        renderRosterModalState(null);
      }
    }catch(_e){}

    await openPresetDeleteResultModal(
      deleted
        ? `プリセットを削除しました。\n${nm}`
        : `プリセットの削除に失敗しました。\n${nm}`
    );

    return { ok:false, missing:true, deleted:!!deleted };
  }

  function extractBattleResultBlock(doc){
    // 戦闘結果はページ実装差があり得るため、特徴語を含む要素を優先して拾う
    // 例（サンプル）: 「アリーナチャレンジ開始」「ターン」「が勝った！」等 :contentReference[oaicite:2]{index=2}
    const keywords = [
      'アリーナチャレンジ開始',
      'ターン',
      'が勝った',
      'チャレンジに成功',
      'アリーナリーダー',
      // 空きセルの「このエリアを捕らえよ」→「リーダーになった」等の短文返却対策
      'リーダーになった',
      'リーダーになりました',
      'あなたはリーダー'
    ];

    const all = Array.from(doc.querySelectorAll('body *'));
    let best = null;
    let bestScore = 0;
    for(const el of all){
      const t = sanitizeText(el.textContent || '');
      if(!t) continue;
      let score = 0;
      for(const k of keywords){
        if(t.includes(k)) score++;
      }
      if(score > bestScore){
        bestScore = score;
        best = el;
      }
    }

    // ほどほど以上ヒットしている要素があれば、それを（親がpre/divなら親を）返す
    // ただし「リーダーになった」系の短文はヒット数が1でも拾えるようにする
    if(best && (bestScore >= 2 || (bestScore >= 1 && sanitizeText(best.textContent || '').includes('リーダー')))){
      const p = best.closest('pre, div, section, article, main') || best;
      return p;
    }

    // fallback：header の次の主要ブロック
    const header = doc.querySelector('header');
    if(header){
      let el = header.nextElementSibling;
      // table（セル詳細）を飛ばす
      while(el && el.tagName && el.tagName.toLowerCase() === 'table'){
        el = el.nextElementSibling;
      }
      if(el) return el;
    }

    return doc.body || null;
  }

  async function fetchFormAndShowBattleResult(form, submitter){
    // submitter がある場合、その name/value も FormData に含める（ボタン識別が必要な実装に備える）
    const method = (form.method || 'GET').toUpperCase();
    const action = form.getAttribute('action') || location.href;
    const url = new URL(action, location.origin);

    const fd = new FormData(form);
    if(submitter && submitter.name){
      // 同名が既に入っていても上書きせず追加（サーバー実装依存）
      fd.append(submitter.name, submitter.value || sanitizeText(submitter.textContent || ''));
    }

    {
      const row = Number(fd.get('row'));
      const col = Number(fd.get('col'));
      const isTeamChallenge =
        /\/teamchallenge(?:\?|$)/.test(`${url.pathname}${url.search}`) ||
        /\/teamchallenge(?:\?|$)/.test(String(action || ''));
      if(isTeamChallenge && consumeOwnCapitalAttackIfNeeded(row, col)){
        return;
      }
    }

    // 戦闘結果モーダルを先に開いて「取得中…」を出す（体感をよくする）
    openBattleResultModalWithNode('戦闘結果を取得中…', '戦闘結果');

    let fetchUrl = url.toString();
    let init = { method, credentials:'include', cache:'no-store' };

    if(method === 'GET'){
      // GET は query へ
      for(const [k,v] of fd.entries()){
        url.searchParams.append(k, String(v));
      }
      fetchUrl = url.toString();
    }else{
      // POST 等は body に
      init.body = fd;
    }

    const res = await fetch(fetchUrl, init);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const bodyText = await res.text();

    // 返却が HTML ではなく、短いテキスト（例：「リーダーになった」）だけのケースに備える
    if(!ct.includes('text/html')){
      const resultText = bodyText || '結果を表示できませんでした。';
      openBattleResultModalWithNode(resultText, '戦闘結果');
      scheduleAutoBattleInfoSyncAfterBattleResult().catch(()=>{});
      if(hasBattleLogText(resultText)){
        scheduleLightRefreshAfterBattleLog();
      }
      return;
    }

    const doc = new DOMParser().parseFromString(bodyText, 'text/html');

    const block = extractBattleResultBlock(doc);
    if(block){
      // 表示用に import（scriptは inert なので、結果表示だけなら問題なし）
      const imported = document.importNode(block, true);
      // ただし余計なフォーム等が混ざっても良い（表示目的）。見やすさ優先でテキスト整形 fallback を用意。
      const text = sanitizeText(imported.textContent || '');
      // 中身が薄い場合は body のテキストを表示
      if(text.length < 8){
        const resultText = (doc.body && doc.body.innerText) ? doc.body.innerText : '結果を表示できませんでした。';
        openBattleResultModalWithNode(resultText, '戦闘結果');
        scheduleAutoBattleInfoSyncAfterBattleResult().catch(()=>{});
        if(hasBattleLogText(resultText)){
          scheduleLightRefreshAfterBattleLog();
        }
        return;
      }

      // できるだけ「結果本文」っぽく見せるため、imported をテキスト表示に寄せる（縦長にも対応）
      // （DOMそのまま表示が崩れる場合があるので、まずはテキストで確実に見せる）
      {
        const resultText = (doc.body && doc.body.innerText) ? doc.body.innerText : imported.textContent;
        openBattleResultModalWithNode(resultText, '戦闘結果');
        scheduleBattleInfoSyncAfterTeamChallenge().catch(()=>{});
        scheduleAutoBattleInfoSyncAfterBattleResult().catch(()=>{});
        if(hasBattleLogText(resultText)){
          scheduleLightRefreshAfterBattleLog();
        }
      }
      return;
    }

    {
      const resultText = (doc.body && doc.body.innerText) ? doc.body.innerText : '結果を表示できませんでした。';
      openBattleResultModalWithNode(resultText, '戦闘結果');
      scheduleBattleInfoSyncAfterTeamChallenge().catch(()=>{});
      if(hasBattleLogText(resultText)){
        scheduleLightRefreshAfterBattleLog();
        scheduleBattleInfoDiffSyncAfterBattleLog().catch(()=>{});
      }
    }
  }

  function findFirstTableAfterHeader(doc){
    const tables = Array.from(doc.querySelectorAll('table'));
    if(tables.length === 0) return null;
    const header = doc.querySelector('header');
    if(!header) return tables[0];
    for(const t of tables){
      try{
        const pos = header.compareDocumentPosition(t);
        if(pos & Node.DOCUMENT_POSITION_FOLLOWING) return t;
      }catch(_e){}
    }
    return tables[0];
  }

  async function openCellDetailModal(row, col){
    const openNow = async () => {
      buildCellDetailModal();
      const dlg = document.getElementById('dba-m-cell-detail');
      const box = document.getElementById('dba-cell-detail-box');
      const title = dlg ? dlg.querySelector('.dba-modal__title') : null;
      if(!dlg || !box) return;

      // ===== 多重open防止（同一セルの連続openを抑止）=====
      const key = `${mode}:${row},${col}`;
      const now = Date.now();
      // 同一セルについて、(A) open中 (B) open済 (C) close直後の短時間 なら無視
      if(DBA_CELL_DETAIL_GUARD.lastKey === key){
        if(DBA_CELL_DETAIL_GUARD.inFlight) return;
        if(DBA_CELL_DETAIL_GUARD.isOpen) return;
        if((now - (DBA_CELL_DETAIL_GUARD.lastCloseAt || 0)) < 450) return;
      }
      DBA_CELL_DETAIL_GUARD.lastKey = key;
      DBA_CELL_DETAIL_GUARD.inFlight = true;

      if(title) title.textContent = `セル詳細 (${row},${col})`;
      box.textContent = '読み込み中…';

      try{
        const url = makeTeambattleUrl({ r: row, c: col, m: mode });
        const res = await fetch(url, { method:'GET', credentials:'include', cache:'no-store' });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const table = findFirstTableAfterHeader(doc);
        if(!table){
          box.textContent = 'テーブルが見つかりませんでした。';
        }else{
          // table をそのまま移植（form submit を維持）
          const imported = document.importNode(table, true);
          box.textContent = '';
          box.appendChild(imported);
          disableOwnCapitalAttackControlsInCellDetail(box, row, col);
          neutralizeOwnCapitalAttackFormsInCellDetail(box, row, col);
        }
      }catch(_e){
        box.textContent = '取得に失敗しました。';
      }

      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
      DBA_CELL_DETAIL_GUARD.inFlight = false;
      DBA_CELL_DETAIL_GUARD.isOpen = true;
    };

    if(document.body) await openNow();
    else document.addEventListener('DOMContentLoaded', () => { openNow(); }, { once:true });
  }

  // HC/L：バトルマップ内クリックを捕捉して遷移を抑止→モーダル表示
  //  - a[href*="teambattle?r="] があれば URL から r,c を読む
  //  - それが無い場合は .cell の index と列数から r,c を推定
  function initBattlemapCellClickIntercept(){
    if(document.documentElement.dataset.dbaCellIntercept === '1') return;
    document.documentElement.dataset.dbaCellIntercept = '1';

    const LP_MS = 400;
    let lpTimer = 0;
    let lpFired = false;
    let lpCtx = null;

    function clearLP(){
      if(lpTimer){
        clearTimeout(lpTimer);
        lpTimer = 0;
      }
      longPressGaugeCancel();
    }

    function getRCFromEvent(evt){
      const grid = document.querySelector('.grid');
      if(!grid) return null;
      if(!evt.target) return null;

      const t = evt.target;
      const inGrid = (t instanceof Element) ? !!t.closest('.grid') : false;
      if(!inGrid) return null;

      // 1) リンクから読む
      const a = (t instanceof Element) ? t.closest('a[href]') : null;
      if(a && a.getAttribute('href')){
        const href = a.getAttribute('href');
        if(href && href.includes('teambattle') && href.includes('r=') && href.includes('c=')){
          try{
            const u = new URL(href, location.origin);
            const r = Number(u.searchParams.get('r'));
            const c = Number(u.searchParams.get('c'));
            if(Number.isFinite(r) && Number.isFinite(c)){
              return { r, c };
            }
          }catch(_e){}
        }
      }

      // 2) .cell の index から推定
      const cell = (t instanceof Element) ? t.closest('.cell') : null;
      if(!cell) return null;
      const cells = Array.from(grid.querySelectorAll('.cell'));
      const idx = cells.indexOf(cell);
      if(idx < 0) return null;

      const spec = getHcLGridSpec(grid);
      const cols = spec.cols || 0;
      if(cols <= 0) return null;
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      return { r, c };
    }

    function clientXY(evt){
      if(evt.touches && evt.touches[0]) return {x: evt.touches[0].clientX, y: evt.touches[0].clientY};
      if(evt.changedTouches && evt.changedTouches[0]) return {x: evt.changedTouches[0].clientX, y: evt.changedTouches[0].clientY};
      return {x: evt.clientX, y: evt.clientY};
    }

    // iOS Safari 対策：
    // - PointerEvent が発火しない/ preventDefault が効かず click/遷移が走る事があるため、
    //   touchstart/touchend を passive:false + capture で拾う
    // - touch と pointer が両方来る環境では二重実行を抑止
    let lastTouchAt = 0;
    let suppressUntil = 0;

    function isTouchLikeEvent(evt){
      return !!(evt && (evt.type === 'touchstart' || evt.type === 'touchend' || evt.type === 'touchcancel'
        || evt.pointerType === 'touch'
        || (evt.touches && evt.touches.length)
        || (evt.changedTouches && evt.changedTouches.length)));
    }

    function isPrimaryActivationEvent(evt){
      if(isTouchLikeEvent(evt)) return true;
      if(evt instanceof MouseEvent || (typeof PointerEvent !== 'undefined' && evt instanceof PointerEvent)){
        return evt.button === 0;
      }
      return true;
    }

    function armContextMenuGuard(ms){
      suppressUntil = Date.now() + Math.max(300, Number(ms || 700));
    }

    function isContextMenuGuardActive(){
      return Date.now() < suppressUntil;
    }

    function onDown(evt){
      if(mode === 'rb') return;

      if(evt.type === 'touchstart') lastTouchAt = Date.now();
      if(evt.type === 'pointerdown' && (Date.now() - lastTouchAt) < 800) return;

      if(isContextMenuGuardActive()){
        clearLP();
        lpFired = false;
        lpCtx = null;
        return;
      }

      if(!isPrimaryActivationEvent(evt)){
        armContextMenuGuard(900);
        clearLP();
        lpFired = false;
        lpCtx = null;
        return;
      }

      const rc = getRCFromEvent(evt);
      if(!rc) return;

      // grid 内の操作なので既存遷移より先に止める
      evt.preventDefault();
      evt.stopImmediatePropagation();

      lpFired = false;
      clearLP();
      const {x,y} = clientXY(evt);
      // ★重要：rc を確実に保持（spreading 記法や誤記で壊れないよう明示）
      lpCtx = { r: rc.r, c: rc.c, x, y };

      // 長押しメニューは、オート装備OFFでも開けるようにする
      // （オート装備候補の確認用途もあるため）
      longPressGaugeStart(lpCtx.x, lpCtx.y, LP_MS);
      lpTimer = setTimeout(async () => {
        lpFired = true;
        try{
          longPressGaugeComplete();
          await handleAutoEquipLongPress(lpCtx.r, lpCtx.c, lpCtx.x, lpCtx.y);
        }catch(_e){
          // noop
        }
      }, LP_MS);
    }

    function onUp(evt){
      if(mode === 'rb') return;

      if(evt.type === 'touchend') lastTouchAt = Date.now();
      if(evt.type === 'pointerup' && (Date.now() - lastTouchAt) < 800) return;

      if(isContextMenuGuardActive()){
        clearLP();
        lpFired = false;
        lpCtx = null;
        return;
      }

      if(!isPrimaryActivationEvent(evt)){
        armContextMenuGuard(900);
        clearLP();
        lpFired = false;
        lpCtx = null;
        return;
      }

      const rc = lpCtx ? { r: lpCtx.r, c: lpCtx.c } : getRCFromEvent(evt);
      // ★重要：
      // pointerdown 時に保持した lpCtx は、この pointerup / touchend の処理が終わったら
      // 必ず破棄する。これを残すと、次回以降にグリッド外で pointerup しても
      // 「前回のセル座標」が再利用され、最後にクリックしたセル詳細が誤って開いてしまう。
      lpCtx = null;
      if(!rc) return;

      evt.preventDefault();
      evt.stopImmediatePropagation();

      clearLP();
      const fired = lpFired;
      lpFired = false;

      if(fired) return;

      (async () => {
        try{
          if(loadAutoEquipEnabled()){
            await handleAutoEquipClick(rc.r, rc.c);
            return;
          }
          if(loadRapidAttackEnabled()){
            await rapidAttackAt(rc.r, rc.c);
          }else{
            await openCellDetailModal(rc.r, rc.c);
          }
        }catch(_e){
          alert('操作に失敗しました。');
        }
      })();
    }

    function onCancel(){
      clearLP();
      lpFired = false;
      lpCtx = null;
    }

    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onCancel, true);
    document.addEventListener('contextmenu', (evt) => {
      if(mode === 'rb') return;
      const grid = document.querySelector('.grid');
      if(!grid || !evt.target) return;
      const t = evt.target;
      const inGrid = (t instanceof Element) ? !!t.closest('.grid') : false;
      if(!inGrid) return;
      armContextMenuGuard(1200);
      clearLP();
      lpFired = false;
      lpCtx = null;
    }, true);
    document.addEventListener('auxclick', (evt) => {
      if(mode === 'rb') return;
      const grid = document.querySelector('.grid');
      if(!grid || !evt.target) return;
      const t = evt.target;
      const inGrid = (t instanceof Element) ? !!t.closest('.grid') : false;
      if(!inGrid) return;
      armContextMenuGuard(900);
      clearLP();
      lpFired = false;
      lpCtx = null;
      evt.preventDefault();
      evt.stopImmediatePropagation();
    }, true);
    // iOS Safari 用（passive:false が重要）
    document.addEventListener('touchstart', onDown, { capture:true, passive:false });
    document.addEventListener('touchend', onUp, { capture:true, passive:false });
    document.addEventListener('touchcancel', onCancel, { capture:true, passive:false });

    // ★重要：一部環境で pointer 系で preventDefault しても click が発火し、
    //        a[href] のデフォルト遷移が走る事があるため、grid内の click を capture で確実に潰す
    document.addEventListener('click', (evt) => {
      if(mode === 'rb') return;
      const grid = document.querySelector('.grid');
      if(!grid || !evt.target) return;
      const t = evt.target;
      const inGrid = (t instanceof Element) ? !!t.closest('.grid') : false;
      if(!inGrid) return;
      if(isContextMenuGuardActive()){
        evt.preventDefault();
        evt.stopImmediatePropagation();
        return;
      }
      // HC/L のセルクリックは、DBA側が
      //   - オート装備ON なら handleAutoEquipClick()
      //   - ラピッド攻撃ON なら rapidAttackAt()
      //   - 両方OFF     なら openCellDetailModal()
      // を担当するため、後続の click 既定遷移は常に止める。
      // ここを条件付きにすると、OFF/OFF 時に環境依存で <a> の遷移が生き残り、
      // セル詳細 modal が出る前にページ遷移してしまうことがある。
      evt.preventDefault();
      evt.stopImmediatePropagation();
    }, true);
  }

  // =========================
  // バトルマップ透明レイヤー
  // =========================
  let dbaLayerInited = false;
  let dbaLayerRAF = 0;
  let dbaLayerLastStructKey = '';
  let dbaLayerResizeObs = null;
  let dbaLayerMutObs = null;
  let dbaLayerCellDecoMap = new Map();
  let dbaLayerCellContentMap = new Map();
  let dbaLayerCellBlockerMap = new Map();
  let dbaLayerLastRectKey = '';
  let dbaLayerLastGridStyleKey = '';
  let dbaLayerPendingRectKey = '';
  let dbaLayerPendingRectCount = 0;
  let dbaLayerSyncRetryCount = 0;
  let dbaLayerInitHydrateStarted = false;
  let dbaLayerInitHydratePromise = null;
  const DBA_LAYER_RECT_STABLE_FRAMES = 2;
  const DBA_LAYER_SYNC_RETRY_LIMIT = 12;
  // light reload 時にセル内テキストの再表示待機フレーム数
  const DBA_LAYER_TEXT_SHOW_DELAY_FRAMES = 2;
  let dbaLayerShowRAFs = [];

  function resetBattlemapLayerRectStabilizer(){
    dbaLayerPendingRectKey = '';
    dbaLayerPendingRectCount = 0;
  }

  function cancelBattlemapLayerShowReserve(){
    if(!Array.isArray(dbaLayerShowRAFs)) dbaLayerShowRAFs = [];
    for(const rafId of dbaLayerShowRAFs){
      if(rafId){
        cancelAnimationFrame(rafId);
      }
    }
    dbaLayerShowRAFs = [];
  }

  function beginBattlemapLayerTextFreeze(){
    const root = document.getElementById('dba-battlemap-layer');
    if(!root) return;
    cancelBattlemapLayerShowReserve();
    root.dataset.syncing = '1';
  }

  function endBattlemapLayerTextFreeze(){
    const root = document.getElementById('dba-battlemap-layer');
    if(!root) return;
    cancelBattlemapLayerShowReserve();

    const waitFrames = clampInt(DBA_LAYER_TEXT_SHOW_DELAY_FRAMES, 1, 60);
    let rest = waitFrames;

    const step = () => {
      const rafId = requestAnimationFrame(() => {
        const idx = dbaLayerShowRAFs.indexOf(rafId);
        if(idx >= 0) dbaLayerShowRAFs.splice(idx, 1);

        rest -= 1;
        if(rest > 0){
          step();
          return;
        }

        const root2 = document.getElementById('dba-battlemap-layer');
        if(!root2) return;
        root2.dataset.syncing = '0';
      });
      dbaLayerShowRAFs.push(rafId);
    };

    step();
  }

  function ensureBattlemapLayerDOM(){
    if(document.getElementById('dba-battlemap-layer')) return;
    const root = document.createElement('div');
    root.id = 'dba-battlemap-layer';
    const grid = document.createElement('div');
    grid.id = 'dba-battlemap-layer-grid';
    root.appendChild(grid);
    (document.body || document.documentElement).appendChild(root);
  }

  function rebuildLayerCells(rows, cols){
    const grid = document.getElementById('dba-battlemap-layer-grid');
    if(!grid) return;
    beginBattlemapLayerTextFreeze();
    resetBattlemapLayerRectStabilizer();
    dbaLayerInitHydrateStarted = false;
    dbaLayerInitHydratePromise = null;
    grid.textContent = '';
    dbaLayerCellDecoMap = new Map();
    dbaLayerCellContentMap = new Map();
    dbaLayerCellBlockerMap = new Map();
    const frag = document.createDocumentFragment();
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const cell = document.createElement('div');
        cell.className = 'dba-layer-cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);

        const deco = document.createElement('div');
        deco.className = 'dba-layer-cell__deco';
        deco.style.background = 'transparent';

        const content = document.createElement('div');
        content.className = 'dba-layer-cell__content';
        content.textContent = ''; // 将来：ここに文字列/絵文字を配置

        const blocker = document.createElement('div');
        blocker.className = 'dba-layer-cell__blocker';
        blocker.dataset.active = '0';
        blocker.title = '';

        const blockEvent = (e) => {
          if(blocker.dataset.active !== '1') return;
          e.preventDefault();
          e.stopImmediatePropagation();
          openOwnCapitalAttackBlockedModal();
        };
        blocker.addEventListener('pointerdown', blockEvent, true);
        blocker.addEventListener('click', blockEvent, true);
        blocker.addEventListener('touchstart', blockEvent, { capture:true, passive:false });

        cell.appendChild(deco);
        cell.appendChild(content);
        cell.appendChild(blocker);
        dbaLayerCellDecoMap.set(`${r},${c}`, deco);
        dbaLayerCellContentMap.set(`${r},${c}`, content);
        dbaLayerCellBlockerMap.set(`${r},${c}`, blocker);
        frag.appendChild(cell);
      }
    }
    grid.appendChild(frag);
  }

  function getHcLGridSpec(gridEl){
    const cs = getComputedStyle(gridEl);
    const cols = (cs.gridTemplateColumns || '').trim().split(/\s+/).filter(Boolean);
    const rows = (cs.gridTemplateRows || '').trim().split(/\s+/).filter(Boolean);
    const colN = cols.length || 0;
    const rowN = rows.length || 0;
    return {
      rows: rowN,
      cols: colN,
      gtc: cs.gridTemplateColumns,
      gtr: cs.gridTemplateRows,
      gap: cs.gap || `${cs.rowGap || '0px'} ${cs.columnGap || '0px'}`,
      rowGap: cs.rowGap || '0px',
      colGap: cs.columnGap || '0px'
    };
  }

  function parseCssPx(value){
    const n = Number.parseFloat(String(value || '').trim());
    return Number.isFinite(n) ? n : 0;
  }

  function buildStableGridTrackList(totalPx, count){
    const n = Math.max(0, Number(count) || 0);
    const total = Math.max(0, Math.round(Number(totalPx) || 0));
    if(n <= 0) return '';
    if(n === 1) return `${total}px`;

    const base = Math.floor(total / n);
    let rem = total - (base * n);
    const out = [];
    for(let i=0;i<n;i++){
      const add = rem > 0 ? 1 : 0;
      out.push(`${base + add}px`);
      if(rem > 0) rem--;
    }
    return out.join(' ');
  }

  function getStableLayerTargetMetrics(target){
    if(!target) return null;
    const rect = target.getBoundingClientRect();
    const left = Math.round(rect.left);
    const top = Math.round(rect.top);
    const width = Math.max(
      0,
      Math.round(
        target.clientWidth ||
        target.offsetWidth ||
        rect.width ||
        0
      )
    );
    const height = Math.max(
      0,
      Math.round(
        target.clientHeight ||
        target.offsetHeight ||
        rect.height ||
        0
      )
    );
    return { left, top, width, height };
  }

  function isBattlemapLayerRectStable(rectKey){
    if(!rectKey) return false;
    if(dbaLayerPendingRectKey !== rectKey){
      dbaLayerPendingRectKey = rectKey;
      dbaLayerPendingRectCount = 1;
      return false;
    }
    dbaLayerPendingRectCount += 1;
    return dbaLayerPendingRectCount >= clampInt(DBA_LAYER_RECT_STABLE_FRAMES, 1, 10);
  }

  function syncBattlemapLayer(){
    const root = document.getElementById('dba-battlemap-layer');
    const grid = document.getElementById('dba-battlemap-layer-grid');
    if(!root || !grid) return false;

    let target = null;
    let spec = null;
    let layoutChanged = false;

    if(mode === 'rb'){
      target = document.getElementById('gridWrap');
      if(!target) return false;
      const n = getRbGridSizeFromPageScript();
      const size = Number.isFinite(n) ? n : 16;
      spec = {
        rows: size,
        cols: size,
        gtc: `repeat(${size}, 1fr)`,
        gtr: `repeat(${size}, 1fr)`,
        gap: '0px'
      };
    }else{
      target = document.querySelector('.grid');
      if(!target) return false;
      spec = getHcLGridSpec(target);
      if(!spec.rows || !spec.cols) return false;
    }

    const metrics = getStableLayerTargetMetrics(target);
    if(!metrics) return false;
    // rectがゼロのときはまだ描画途中
    if(metrics.width <= 1 || metrics.height <= 1) return false;

    // 位置・サイズ追従（position:fixed）
    const rectKey = [
      metrics.left,
      metrics.top,
      metrics.width,
      metrics.height
    ].join('|');
    if(rectKey !== dbaLayerLastRectKey){
      if(!isBattlemapLayerRectStable(rectKey)){
        return null;
      }
      layoutChanged = true;
      dbaLayerLastRectKey = rectKey;
      resetBattlemapLayerRectStabilizer();
      root.style.left = metrics.left + 'px';
      root.style.top = metrics.top + 'px';
      root.style.width = metrics.width + 'px';
      root.style.height = metrics.height + 'px';
    }else{
      resetBattlemapLayerRectStabilizer();
    }

    const colGapPx = Math.max(0, Math.round(parseCssPx(spec.colGap || '0px')));
    const rowGapPx = Math.max(0, Math.round(parseCssPx(spec.rowGap || '0px')));
    const tracksTotalW = Math.max(0, metrics.width - (Math.max(0, spec.cols - 1) * colGapPx));
    const tracksTotalH = Math.max(0, metrics.height - (Math.max(0, spec.rows - 1) * rowGapPx));
    const stableGtc = buildStableGridTrackList(tracksTotalW, spec.cols);
    const stableGtr = buildStableGridTrackList(tracksTotalH, spec.rows);
    const stableGap = `${rowGapPx}px ${colGapPx}px`;

    // グリッド仕様追従
    const gridStyleKey = `${stableGtc}|${stableGtr}|${stableGap}`;
    if(gridStyleKey !== dbaLayerLastGridStyleKey){
      layoutChanged = true;
      dbaLayerLastGridStyleKey = gridStyleKey;
      grid.style.gridTemplateColumns = stableGtc;
      grid.style.gridTemplateRows = stableGtr;
      grid.style.gap = stableGap;
    }

    const structKey = `${mode}:${spec.rows}x${spec.cols}`;
    if(structKey !== dbaLayerLastStructKey){
      layoutChanged = true;
      dbaLayerLastStructKey = structKey;
      rebuildLayerCells(spec.rows, spec.cols);
    }

    {
      const snap = getBattlemapSnapshotFromDoc(document);
      renderRbOriginalBorders(snap);
      renderRbCapitalCrowns(snap);
      renderCurrentCellMarker(snap);
      renderOwnCapitalRapidAttackBlockers(snap);
    }

    return true;
  }

  function scheduleBattlemapLayerSync(){
    if(dbaLayerRAF) return;
    dbaLayerRAF = requestAnimationFrame(() => {
      dbaLayerRAF = 0;
      const ok = syncBattlemapLayer();
      if(ok === true){
        cancelDeferredCurrentCellMarkerRefreshFramesOnly();
        dbaLayerSyncRetryCount = 0;
        endBattlemapFitPrepare();
        endBattlemapLayerTextFreeze();
        return;
      }

      cancelDeferredCurrentCellMarkerRefreshFramesOnly();
      dbaLayerSyncRetryCount += 1;
      if(dbaLayerSyncRetryCount < clampInt(DBA_LAYER_SYNC_RETRY_LIMIT, 1, 60)){
        scheduleBattlemapLayerSync();
        return;
      }

      dbaLayerSyncRetryCount = 0;
      endBattlemapFitPrepare();
      endBattlemapLayerTextFreeze();
    });
  }

  function collectInitLayerHydrateJobs(){
    const cells = Array.from(document.querySelectorAll('#dba-battlemap-layer-grid .dba-layer-cell'));
    if(cells.length === 0) return [];

    let baseJobs = null;
    if(mode === 'rb'){
      const known = extractRbKnownCoordsFromDoc(document);
      baseJobs = (known && known.length > 0)
        ? known
        : cells.map((c) => ({ row: Number(c.dataset.row), col: Number(c.dataset.col) }));
    }else{
      baseJobs = cells.map((c) => ({ row: Number(c.dataset.row), col: Number(c.dataset.col) }));
    }

    const out = [];
    const seen = new Set();
    for(const job of baseJobs){
      if(!job) continue;
      const row = Number(job.row);
      const col = Number(job.col);
      if(!Number.isFinite(row) || !Number.isFinite(col)) continue;

      const key = `${row}-${col}`;
      if(seen.has(key)) continue;
      seen.add(key);

      const currentText = sanitizeText(getLayerCellText(row, col));
      const alreadyHydrated =
        currentText &&
        currentText !== '…' &&
        !currentText.startsWith('ERR');

      if(alreadyHydrated) continue;
      out.push({ row, col });
    }

    return out;
  }

  async function hydrateBattlemapLayerTextsOnInit(){
    if(dbaLayerInitHydratePromise) return dbaLayerInitHydratePromise;
    if(dbaLayerInitHydrateStarted) return null;
    dbaLayerInitHydrateStarted = true;

    const p = (async () => {
      try{
        await raf2();
        resetBattlemapLayerRectStabilizer();
        scheduleBattlemapLayerSync();
        await raf2();

        const jobs = collectInitLayerHydrateJobs();
        if(jobs.length === 0){
          const snap0 = getBattlemapSnapshotFromDoc(document);
          renderRbOriginalBorders(snap0);
          renderRbCapitalCrowns(snap0);
          endBattlemapLayerTextFreeze();
          return true;
        }

        beginBattlemapLayerTextFreeze();

        // 文字レイヤーの非表示待機時間
        const CONCURRENCY = 2;
        await mapLimit(jobs, CONCURRENCY, async (job) => {
          const { row, col } = job;
          try{
            const { holder, reg } = await fetchCellDetail(row, col);
            setLayerCellText(row, col, buildLayerCellDisplayText(reg, holder, row, col));
          }catch(_e){
            setLayerCellText(row, col, '');
          }
          return true;
        });

        const snap = getBattlemapSnapshotFromDoc(document);
        renderRbOriginalBorders(snap);
        renderRbCapitalCrowns(snap);
        endBattlemapLayerTextFreeze();
        return true;
      }catch(_e){
        try{
          const snap = getBattlemapSnapshotFromDoc(document);
          renderRbOriginalBorders(snap);
          renderRbCapitalCrowns(snap);
        }catch(_e2){}
        endBattlemapLayerTextFreeze();
        return false;
      }finally{
        dbaLayerInitHydratePromise = null;
      }
    })();

    dbaLayerInitHydratePromise = p;
    return p;
  }

  function initBattlemapLayer(){
    if(dbaLayerInited) return;
    dbaLayerInited = true;

    // bodyが無い可能性を考慮
    const start = () => {
      cancelDeferredCurrentCellMarkerRefresh();
      ensureBattlemapLayerDOM();
      installCurrentCellResponseHooks();
      installRuntimeCurrentCellDebugProbes();
      dbaProbeRuntimeCurrentCell('initBattlemapLayer:start');
      // 初期値反映（文字濃度・セルサイズ）
      const s = loadSettings();
      applyBaseFontSize(s?.ui?.baseFontPx);
      applyLayerTextOpacity(s.layer.textOpacity);
      applyCurrentModeScale();

      // まず同期
      scheduleBattlemapLayerSync();
      setTimeout(() => {
        dbaProbeRuntimeCurrentCell('initBattlemapLayer:post-sync');
      }, 250);
      hydrateBattlemapLayerTextsOnInit().catch(()=>{});

      // スクロール・リサイズ追従
      window.addEventListener('scroll', scheduleBattlemapLayerSync, { passive: true });
      window.addEventListener('resize', scheduleBattlemapLayerSync, { passive: true });
      window.addEventListener('orientationchange', scheduleBattlemapLayerSync, { passive: true });
      if(window.visualViewport){
        window.visualViewport.addEventListener('resize', scheduleBattlemapLayerSync, { passive: true });
        window.visualViewport.addEventListener('scroll', scheduleBattlemapLayerSync, { passive: true });
      }

      // ターゲットの変化追従（サイズ・DOM）
      const target = (mode === 'rb') ? document.getElementById('gridWrap') : document.querySelector('.grid');
      if(target && typeof ResizeObserver === 'function'){
        dbaLayerResizeObs = new ResizeObserver(() => scheduleBattlemapLayerSync());
        dbaLayerResizeObs.observe(target);
      }
      dbaLayerMutObs = new MutationObserver(() => scheduleBattlemapLayerSync());
      dbaLayerMutObs.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    };

    if(document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  }

  function applyCurrentModeScale(){
    const settings = loadSettings();
    const baseFontPx = settings?.ui?.baseFontPx;
    applyBaseFontSize(baseFontPx);
    applyLayerTextOpacity(settings.layer.textOpacity);

    if(mode === 'rb'){
      const sz = getBattlemapFittedCellSizeForMode('rb', settings);
      beginBattlemapFitPrepare();
      applyCellSizeToCanvasWrap(sz.width, sz.height);
      applyBattlemapLayerScaledFont(baseFontPx, sz.scale);
      ensureRbPointerFix();
      scheduleBattlemapLayerSync();
      return;
    }
    if(mode === 'hc'){
      const sz = getBattlemapFittedCellSizeForMode('hc', settings);
      beginBattlemapFitPrepare();
      applyCellSizeToGrid(sz.width, sz.height);
      applyBattlemapLayerScaledFont(baseFontPx, sz.scale);
      syncHcLMapContainerHeight();
      scheduleBattlemapLayerSync();
      return;
    }
    if(mode === 'l'){
      const sz = getBattlemapFittedCellSizeForMode('l', settings);
      beginBattlemapFitPrepare();
      applyCellSizeToGrid(sz.width, sz.height);
      applyBattlemapLayerScaledFont(baseFontPx, sz.scale);
      syncHcLMapContainerHeight();
      scheduleBattlemapLayerSync();
      return;
    }
  }

  // =========================
  // 戦況情報（全セル巡回→レイヤー表示）
  // =========================
  function raf2(){
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function sanitizeText(s){
    if(!s) return '';
    return String(s).replace(/\s+/g,' ').trim();
  }

  // =========================
  // レギュレーション表示の簡略化
  // 例：
  //  [N]だけ                      -> N
  //  [SSR]まで                    -> ?SSR
  //  [R]から[SSR]まで             -> R-SSR
  //  [SSR]だけ|[エリート]         -> SSR?
  //  [R]まで|[警備員]だけ         -> ?R警
  //  [SSR]だけ|[警備員]だけ|[エリート] -> SSR警?
  // =========================
  function simplifyRegulationText(raw){
    const src0 = sanitizeText(raw || '');
    if(!src0) return '---';

    // 区切り文字などを正規化（"|" をスペースへ、全角空白もまとめる）
    const src = src0.replace(/\|/g, ' ').replace(/\u3000/g, ' ');

    // 特殊フラグ
    const hasElite = src.includes('エリート');
    const hasGuard = src.includes('警備員'); // 表記ゆれ（[警備員]だけ / 警備員だけ）を広く拾う

    // レアリティ（想定：N/R/SR/SSR/UR）
    // - 「だけ」
    let m = src.match(/\[(N|R|SR|SSR|UR)\]\s*だけ/);
    if(m){
      let out = m[1];
      if(hasGuard && hasElite) out += '警?';
      else if(hasGuard) out += '警';
      else if(hasElite) out += '?';
      return out;
    }

    // - 「まで」
    m = src.match(/\[(N|R|SR|SSR|UR)\]\s*まで/);
    if(m){
      let out = `?${m[1]}`;
      if(hasGuard && hasElite) out += '警?';
      else if(hasGuard) out += '警';
      else if(hasElite) out += '?';
      return out;
    }

    // - 「～から～まで」
    m = src.match(/\[(N|R|SR|SSR|UR)\]\s*から\s*\[(N|R|SR|SSR|UR)\]\s*まで/);
    if(m){
      let out = `${m[1]}-${m[2]}`;
      if(hasGuard && hasElite) out += '警?';
      else if(hasGuard) out += '警';
      else if(hasElite) out += '?';
      return out;
    }

    // 想定外フォーマットは、最低限の整形だけして返す（デバッグしやすくする）
    // 例：未知の表現が来ても "空" にはしない
    return src0;
  }

  // =========================
  // オート装備（レギュレーション → 候補キー）
  //  - simplifyRegulationText() の出力（例：N / ?SSR / R-UR警?）を受け取る前提
  //  - 上限レアリティ + 特殊サフィックス（? / 警 / 警?）で候補キーを決める
  // =========================
  function mapRegToAutoEquipKey(reg){
    const s0 = sanitizeText(reg || '');
    if(!s0 || s0 === '---') return '';
    let s = s0;

    // 特殊サフィックス
    let suffix = '';
    if(s.includes('警?')){
      suffix = '警?';
      s = s.replace('警?','');
    }else if(s.includes('警')){
      suffix = '警';
      s = s.replace('警','');
    }else if(s.includes('?')){
      suffix = '?';
      s = s.replace('?','');
    }

    // 上限レアリティ
    // ?R / R / N-R / R-SR など
    let top = '';
    if(s.startsWith('?')){
      top = s.slice(1);
    }else if(s.includes('-')){
      const parts = s.split('-');
      top = parts[parts.length - 1];
    }else{
      top = s;
    }
    top = sanitizeText(top).replace(/^\[/,'').replace(/\]$/,''); // 念のため

    if(!top) return '';
    // 期待するのは N/R/SR/SSR/UR
    if(!['N','R','SR','SSR','UR'].includes(top)) return '';
    return normalizeAutoEquipCandidateKey(`${top}${suffix}`);
  }

  function getAutoEquipCandidatesForReg(reg){
    const key = mapRegToAutoEquipKey(reg);
    if(!key) return { key:'', list: [] };
    const store = normalizeAutoEquipCandidateStore(loadAutoEquipCandidates());
    const list = Array.isArray(store[key]) ? store[key].map(x => sanitizeText(x)).filter(Boolean) : [];
    // 重複除去（保存データの汚れ対策）
    const seen = new Set();
    const uniq = [];
    for(const n of list){
      if(seen.has(n)) continue;
      seen.add(n);
      uniq.push(n);
    }
    return { key, list: uniq };
  }

  // =========================
  // オート装備：候補ポップアップ
  // =========================
  function sleepMs(ms){
    return new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
  }

  function normalizeColorTokenForCompare(v){
    const s0 = String(v || '').trim().toLowerCase();
    if(!s0) return '';

    if(/^#([0-9a-f]{3})$/.test(s0)){
      return '#' + s0.slice(1).split('').map(ch => ch + ch).join('');
    }
    if(/^#([0-9a-f]{6})$/.test(s0)){
      return s0;
    }

    const m = s0.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$/);
    if(m){
      const r = Math.max(0, Math.min(255, Number(m[1])));
      const g = Math.max(0, Math.min(255, Number(m[2])));
      const b = Math.max(0, Math.min(255, Number(m[3])));
      const hh = (n) => n.toString(16).padStart(2, '0');
      return `#${hh(r)}${hh(g)}${hh(b)}`;
    }

    return s0.replace(/\s+/g, '');
  }

  function getRbTeamKeyFromColorOrName(colorValue, teamName){
    const color = normalizeColorTokenForCompare(colorValue);
    const name = sanitizeText(teamName).toLowerCase();

    if(name.includes('レッド') || name.includes('red')) return 'red';
    if(name.includes('ブルー') || name.includes('blue')) return 'blue';

    if(color === '#d32f2f') return 'red';
    if(color === '#1976d2') return 'blue';

    return '';
  }

  function getCurrentRbTeamInfo(){
    if(mode !== 'rb') return { teamKey:'', teamColor:'', teamName:'' };
    const info = extractFnHeaderInfoFromCurrentHeader();
    const teamColor = normalizeColorTokenForCompare(info?.teamColor || '');
    const teamName = sanitizeText(info?.teamName || '');
    const teamKey = getRbTeamKeyFromColorOrName(teamColor, teamName);
    return { teamKey, teamColor, teamName };
  }

  function getCurrentRbTileColor(row, col){
    if(mode !== 'rb') return '';
    try{
      const snap = getBattlemapSnapshotFromDoc(document);
      const raw = snap?.cellColors?.[`${row}-${col}`] || '';
      return normalizeColorTokenForCompare(raw);
    }catch(_e){
      return '';
    }
  }

  function isRbTileOwnedByCurrentTeam(row, col){
    if(mode !== 'rb') return false;
    const team = getCurrentRbTeamInfo();
    if(!team.teamColor) return false;
    const tileColor = getCurrentRbTileColor(row, col);
    if(!tileColor) return false;
    return tileColor === team.teamColor;
  }

  function parseBattleCoordKey(key){
    const m = String(key || '').match(/^(-?\d+)[,-](-?\d+)$/);
    if(!m) return null;
    const row = Number(m[1]);
    const col = Number(m[2]);
    if(!Number.isFinite(row) || !Number.isFinite(col)) return null;
    return { row, col };
  }

  function isOwnCapitalFriendlyFireSuppressed(){
    const s = loadSettings();
    return !!s?.postBattle?.suppressOwnCapitalFriendlyFire;
  }

  function getCurrentRbOwnCapitalCoord(snapshot){
    if(mode !== 'rb') return null;

    const snap = snapshot || getCurrentBattlemapSnapshot();
    const capitalSet = (snap && snap.capitalSet instanceof Set) ? snap.capitalSet : new Set();
    if(!capitalSet.size) return null;

    for(const key of capitalSet){
      const rc = parseBattleCoordKey(key);
      if(!rc) continue;
      const row = Number(rc.row);
      const col = Number(rc.col);
      if(isRbTileOwnedByCurrentTeam(row, col)){
        return { row, col };
      }
    }

    return null;
  }

  function shouldBlockOwnCapitalAttack(row, col, snapshot){
    if(mode !== 'rb') return false;
    if(!isOwnCapitalFriendlyFireSuppressed()) return false;

    const r = Number(row);
    const c = Number(col);
    if(!Number.isFinite(r) || !Number.isFinite(c)) return false;

    const snap = snapshot || getCurrentBattlemapSnapshot();
    const current = getCurrentBattleCellCoord(snap);
    if(!current) return false;
    if(Number(current.row) !== r || Number(current.col) !== c) return false;

    const capitalSet = (snap && snap.capitalSet instanceof Set) ? snap.capitalSet : new Set();
    const hitCapital =
      capitalSet.has(`${r},${c}`) ||
      capitalSet.has(`${r}-${c}`);
    if(!hitCapital) return false;

    if(isRbTileOwnedByCurrentTeam(r, c)) return true;

    const ownCapital = getCurrentRbOwnCapitalCoord(snap);
    if(!ownCapital) return false;
    return Number(ownCapital.row) === r && Number(ownCapital.col) === c;
  }

  function consumeOwnCapitalAttackIfNeeded(row, col, snapshot){
    if(!shouldBlockOwnCapitalAttack(row, col, snapshot)) return false;
    openOwnCapitalAttackBlockedModal();
    return true;
  }

  function shouldBlockOwnCapitalRapidAttackOnLayer(row, col, snapshot){
    if(mode !== 'rb') return false;
    if(!loadRapidAttackEnabled()) return false;
    return shouldBlockOwnCapitalAttack(row, col, snapshot);
  }

  function disableOwnCapitalAttackControlsInCellDetail(root, row, col, snapshot){
    if(!(root instanceof Element)) return false;
    if(!shouldBlockOwnCapitalAttack(row, col, snapshot)) return false;

    const controls = Array.from(
      root.querySelectorAll('input[type="submit"], input[type="image"], button[type="submit"], button:not([type])')
    );

    let changed = false;
    for(const ctrl of controls){
      const txt = sanitizeText(ctrl.textContent || ctrl.value || '');
      if(
        !txt.includes('エリアに挑む') &&
        !txt.includes('エリアに挑戦') &&
        !txt.includes('このエリアを捕らえよ')
      ) continue;

      if('disabled' in ctrl) ctrl.disabled = true;
      ctrl.classList.add('dba-own-capital-attack-disabled');
      ctrl.setAttribute('aria-disabled', 'true');
      ctrl.setAttribute('title', '自分のチームの首都を攻撃することは推奨されません。');

      if(ctrl instanceof HTMLInputElement){
        ctrl.value = '攻撃不可';
      }else{
        ctrl.textContent = '攻撃不可';
      }
      changed = true;
    }

    return changed;
  }

  function neutralizeOwnCapitalAttackFormsInCellDetail(root, row, col, snapshot){
    if(!(root instanceof Element)) return false;
    if(!shouldBlockOwnCapitalAttack(row, col, snapshot)) return false;

    const forms = Array.from(root.querySelectorAll('form'));
    let changed = false;

    for(const form of forms){
      if(!(form instanceof HTMLFormElement)) continue;

      const action = String(form.getAttribute('action') || '');
      const fd = new FormData(form);
      const fr = Number(fd.get('row'));
      const fc = Number(fd.get('col'));

      const isTeamChallenge =
        /\/teamchallenge(?:\?|$)/.test(action) ||
        /teamchallenge/.test(action);

      if(!isTeamChallenge) continue;
      if(Number.isFinite(fr) && Number.isFinite(fc)){
        if(fr !== Number(row) || fc !== Number(col)) continue;
      }

      form.dataset.dbaOwnCapitalBlocked = '1';
      form.setAttribute('action', 'javascript:void(0)');
      form.setAttribute('onsubmit', 'return false;');
      form.method = 'post';

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        openOwnCapitalAttackBlockedModal();
        return false;
      }, true);

      changed = true;
    }

    return changed;
  }

  function renderOwnCapitalRapidAttackBlockers(snapshot){
    if(mode !== 'rb'){
      for(const blocker of dbaLayerCellBlockerMap.values()){
        blocker.dataset.active = '0';
        blocker.title = '';
      }
      return;
    }

    for(const [key, blocker] of dbaLayerCellBlockerMap.entries()){
      const rc = parseBattleCoordKey(key);
      if(!rc){
        blocker.dataset.active = '0';
        blocker.title = '';
        continue;
      }

      const row = Number(rc.row);
      const col = Number(rc.col);
      const active = shouldBlockOwnCapitalRapidAttackOnLayer(row, col, snapshot);
      blocker.dataset.active = active ? '1' : '0';
      blocker.title = active ? '自分のチームの首都を攻撃することは推奨されません。' : '';
    }
  }

  function resolveOwnCapitalAttackCoordFromForm(form){
    if(!(form instanceof HTMLFormElement)) return null;

    const fd = new FormData(form);
    const row = Number(fd.get('row'));
    const col = Number(fd.get('col'));
    if(!Number.isFinite(row) || !Number.isFinite(col)) return null;

    return { row, col };
  }

  function buildOwnCapitalAttackBlockedModal(){
    if(document.getElementById('dba-m-own-capital-attack-blocked')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-own-capital-attack-blocked';
    dlg.className = 'dba-m-alert';

    const title = document.createElement('div');
    title.className = 'dba-alert__title';
    title.textContent = 'Alert:';

    const mid = document.createElement('div');
    mid.className = 'dba-alert__mid';
    mid.textContent = '自分のチームの首都を攻撃することは推奨されません。';

    const bot = document.createElement('div');
    bot.className = 'dba-alert__bot';

    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'dba-btn-close';
    btnClose.textContent = 'Close';

    bot.appendChild(btnClose);
    dlg.appendChild(title);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    const closeDirect = () => {
      try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
    };

    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeDirect();
    });
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeDirect();
    });
  }

  function openOwnCapitalAttackBlockedModal(){
    buildOwnCapitalAttackBlockedModal();
    const dlg = document.getElementById('dba-m-own-capital-attack-blocked');
    if(!dlg) return;
    try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open', ''); }
  }

  function installOwnCapitalAttackGlobalGuards(){
    if(document.documentElement.dataset.dbaOwnCapitalGlobalGuardInstalled === '1') return;
    document.documentElement.dataset.dbaOwnCapitalGlobalGuardInstalled = '1';

    document.addEventListener('click', (e) => {
      const target = (e.target instanceof Element) ? e.target.closest('#gridActionAttack') : null;
      if(!target) return;
      if(!shouldBlockOwnCapitalAttack(
        Number((window.__gridActionMenuState && window.__gridActionMenuState.row) ?? getCurrentBattleCellCoord()?.row),
        Number((window.__gridActionMenuState && window.__gridActionMenuState.col) ?? getCurrentBattleCellCoord()?.col)
      )){
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      openOwnCapitalAttackBlockedModal();
    }, true);

    document.addEventListener('submit', (e) => {
      const form = e.target;
      if(!(form instanceof HTMLFormElement)) return;
      const action = String(form.getAttribute('action') || '');
      if(!/\/teamchallenge(?:\?|$)|teamchallenge/.test(action)) return;

      const fd = new FormData(form);
      const row = Number(fd.get('row'));
      const col = Number(fd.get('col'));
      if(!consumeOwnCapitalAttackIfNeeded(row, col)) return;

      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  }

  function buildDisableOwnCapitalProtectionConfirmModal(){
    if(document.getElementById('dba-m-disable-own-capital-protection-confirm')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-disable-own-capital-protection-confirm';
    dlg.className = 'dba-m-alert';

    const title = document.createElement('div');
    title.className = 'dba-alert__title';
    title.textContent = 'Confirm:';

    const mid = document.createElement('div');
    mid.className = 'dba-alert__mid';
    mid.textContent = '本当に自チーム首都保護を解除しますか？';

    const bot = document.createElement('div');
    bot.className = 'dba-alert__bot';

    const btnYes = document.createElement('button');
    btnYes.type = 'button';
    btnYes.className = 'dba-btn-ok';
    btnYes.textContent = 'はい';

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'dba-btn-close';
    btnCancel.textContent = 'Cancel';

    bot.appendChild(btnYes);
    bot.appendChild(btnCancel);
    dlg.appendChild(title);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);
  }

  function openDisableOwnCapitalProtectionConfirmModal(){
    buildDisableOwnCapitalProtectionConfirmModal();
    const dlg = document.getElementById('dba-m-disable-own-capital-protection-confirm');
    if(!dlg) return Promise.resolve(false);

    return new Promise((resolve) => {
      const btnYes = dlg.querySelector('.dba-btn-ok');
      const btnCancel = dlg.querySelector('.dba-btn-close');

      const finalize = (answer) => {
        try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
        resolve(answer);
      };

      if(btnYes){
        btnYes.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          finalize(true);
        };
      }
      if(btnCancel){
        btnCancel.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          finalize(false);
        };
      }
      dlg.oncancel = (e) => {
        e.preventDefault();
        finalize(false);
      };

      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open', ''); }
    });
  }

  async function triggerBattleInfoShortPress(){
    const btn = document.getElementById('dba-btn-battleinfo');
    if(btn && btn.disabled) return false;
    await updateOnlyChangedCellsFromTopPage();
    return true;
  }

  async function buildOnRbTileFromPopup(row, col, kind){
    if(mode !== 'rb') return false;

    const team = getCurrentRbTeamInfo();
    if(!team.teamKey){
      alert('チーム情報を取得できません。');
      return false;
    }

    const body = new URLSearchParams();
    body.set('mode', String(mode || ''));
    body.set('team', team.teamKey);
    body.set('r', String(row));
    body.set('c', String(col));
    body.set('type', String(kind || ''));

    try{
      const res = await fetch(makeSiteUrl('/build'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: body.toString()
      });

      const data = await res.json().catch(() => ({ ok:false, error:'server_error' }));
      if(!(res.ok && data && data.ok)){
        const msg = (data && data.error) ? String(data.error) : '建設に失敗しました。';
        alert(msg);
        return false;
      }

      closeAutoEquipPopup(false);
      // 「タイル操作」の後に「戦況情報」を自動実行する待機ミリ秒
      await sleepMs(1000);
      await triggerBattleInfoShortPress();
      return true;
    }catch(_e){
      alert('建設に失敗しました。');
      return false;
    }
  }

  function ensureAutoEquipPopup(){
    if(document.getElementById('dba-auto-equip-pop')) return;
    const pop = document.createElement('div');
    pop.id = 'dba-auto-equip-pop';
    pop.dataset.open = '0';
    document.body.appendChild(pop);

    // 外側クリックで閉じる
    document.addEventListener('pointerdown', (e) => {
      if(pop.dataset.open !== '1') return;
      const t = e.target;
      if(t instanceof Node && pop.contains(t)) return;
      closeAutoEquipPopup(true);
    }, true);
  }

  function closeAutoEquipPopup(cancel){
    const pop = document.getElementById('dba-auto-equip-pop');
    if(!pop) return;
    pop.dataset.open = '0';
    pop.textContent = '';
    if(cancel){
      // 何もしない（キャンセル扱い）
    }
  }

  function placePopupNearPoint(pop, x, y){
    const vw = window.innerWidth || document.documentElement.clientWidth || 800;
    const vh = window.innerHeight || document.documentElement.clientHeight || 600;

    // まず仮位置
    let left = x;
    let top = y;

    // “表示領域の中心に近い方向”へ出す
    if(x < vw/2){
      left = x + 12;
    }else{
      left = x - 12;
    }
    if(y < vh/2){
      top = y + 12;
    }else{
      top = y - 12;
    }

    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    pop.style.right = 'auto';
    pop.style.bottom = 'auto';

    const rect = pop.getBoundingClientRect();
    let nx = rect.left;
    let ny = rect.top;

    if(rect.right > vw - 8) nx -= (rect.right - (vw - 8));
    if(rect.left < 8) nx = 8;
    if(rect.bottom > vh - 8) ny -= (rect.bottom - (svh - 8));
    if(rect.top < 8) ny = 8;

    pop.style.left = nx + 'px';
    pop.style.top = ny + 'px';
  }

  // =========================
  // オート装備：装備完了後の「次の動作」をラピッド攻撃へ引き継ぐ
  //  - ラピッド攻撃ON: rapidAttackAt
  //  - ラピッド攻撃OFF: セル詳細モーダル
  // =========================
  async function proceedAfterAutoEquip(row, col){
    if(loadRapidAttackEnabled()){
      await rapidAttackAt(row, col);
    }else{
      await openCellDetailModal(row, col);
    }
  }

  async function autoEquipThenAttack(row, col, presetName){
    const nm = sanitizeText(presetName);
    if(!nm) return false;

    // 既に同じプリセットをオートで装備した直後ならスキップ（過剰なequip連打を防ぐ）
    const last = loadAutoEquipLastPreset();
    if(last && last === nm){
      await proceedAfterAutoEquip(row, col);
      return true;
    }

    closeRosterResultModal();
    openRosterProgressAlertModal(`装備切替中…\n${nm}`, 'オート装備');
    try{
      const result = await equipPresetByName(nm);
      if(result && result.missing){
        closeRosterProgressAlertModal();
        return false;
      }
      saveAutoEquipLastPreset(nm);
      await new Promise((resolve) => setTimeout(resolve, 300));
      closeRosterProgressAlertModal();
      openRosterResultModalWithNode(`装備切替完了\n${nm}`, 'オート装備');
    }catch(_e){
      closeRosterProgressAlertModal();
      openRosterResultModalWithNode(`装備切替に失敗しました\n${nm}`, 'オート装備');
      // 装備に失敗しても攻撃はしない（誤装備のまま突撃を防ぐ）
      return false;
    }

    // 装備変更完了後は、ラピッド攻撃機能へ引き継ぐ（ON/OFFに応じて分岐）
    await proceedAfterAutoEquip(row, col);
    return true;
  }

  async function handleAutoEquipClick(row, col){
    // クリック：候補があれば先頭を装備して突撃、無ければ通常動作（ラピッド/セル詳細）
    try{
      const { reg } = await fetchCellDetail(row, col);
      const { list } = getAutoEquipCandidatesForReg(reg);
      if(list.length > 0){
        // ★現在装備中（として扱う）プリセット名
        const cur = sanitizeText(loadCurrentPresetName());
        const hasCurMatch = !!(cur && list.includes(cur));

        // OFF（デフォルト）：レギュレーションと現在プリセットが合致しているなら変更せず突撃
        // ON：合致していても「先頭」以外なら先頭へ変更してから突撃
        if(hasCurMatch){
          const preferTop = loadAutoEquipPreferTopEnabled();
          if(preferTop){
            if(cur !== list[0]){
              await autoEquipThenAttack(row, col, list[0]);
              return true;
            }
            // 既に先頭ならそのまま
            await proceedAfterAutoEquip(row, col);
            return true;
          }
          // preferTop OFF：合致していれば変更しない
          await proceedAfterAutoEquip(row, col);
          return true;
        }

        // 現在プリセットが候補に無い：従来通り先頭を適用して突撃
        await autoEquipThenAttack(row, col, list[0]);
        return true;
      }
    }catch(_e){
      // noop（通常動作へフォールバック）
    }
    // 候補無し or 取得失敗 → 既存動作へ
    if(loadRapidAttackEnabled()){
      await rapidAttackAt(row, col);
    }else{
      await openCellDetailModal(row, col);
    }
    return true;
  }

  async function handleAutoEquipLongPress(row, col, clientX, clientY){
    ensureAutoEquipPopup();
    const pop = document.getElementById('dba-auto-equip-pop');
    if(!pop) return false;

    // 取得中表示
    pop.textContent = '';
    pop.dataset.open = '1';
    const ttl = document.createElement('div');
    ttl.className = 'dba-ae-pop-title';
    ttl.textContent = '装備候補（取得中…）';
    pop.appendChild(ttl);
    placePopupNearPoint(pop, clientX, clientY);

    let reg = '';
    let canTileOps = false;
    try{
      const d = await fetchCellDetail(row, col);
      reg = d?.reg || '';
    }catch(_e){
      reg = '';
    }
    canTileOps = isRbTileOwnedByCurrentTeam(row, col);
    const { key, list } = getAutoEquipCandidatesForReg(reg);

    pop.textContent = '';

    if(canTileOps){
      const tileTtl = document.createElement('div');
      tileTtl.className = 'dba-ae-pop-title';
      tileTtl.textContent = 'タイル操作';
      pop.appendChild(tileTtl);

      const btnFort = document.createElement('button');
      btnFort.type = 'button';
      btnFort.className = 'dba-ae-pop-btn';
      btnFort.textContent = '要塞を建設';
      btnFort.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        btnFort.disabled = true;
        btnRadar.disabled = true;
        try{
          await buildOnRbTileFromPopup(row, col, 'f');
        }finally{
          btnFort.disabled = false;
          btnRadar.disabled = false;
        }
      });
      pop.appendChild(btnFort);

      const btnRadar = document.createElement('button');
      btnRadar.type = 'button';
      btnRadar.className = 'dba-ae-pop-btn';
      btnRadar.textContent = 'レーダーを設置';
      btnRadar.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        btnFort.disabled = true;
        btnRadar.disabled = true;
        try{
          await buildOnRbTileFromPopup(row, col, 'r');
        }finally{
          btnFort.disabled = false;
          btnRadar.disabled = false;
        }
      });
      pop.appendChild(btnRadar);
    }

    const ttl2 = document.createElement('div');
    ttl2.className = 'dba-ae-pop-title';
    ttl2.textContent = key ? `装備候補：${key}` : '装備候補';
    pop.appendChild(ttl2);

    const btnNoEquip = document.createElement('button');
    btnNoEquip.type = 'button';
    btnNoEquip.className = 'dba-ae-pop-btn';
    btnNoEquip.textContent = '装備変更せずに攻撃する';
    btnNoEquip.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAutoEquipPopup(false);
      await proceedAfterAutoEquip(row, col);
    });
    pop.appendChild(btnNoEquip);

    if(list.length === 0){
      const empty = document.createElement('div');
      empty.style.fontWeight = '800';
      empty.style.padding = '6px 2px';
      empty.style.textAlign = 'left';
      empty.textContent = '候補が登録されていません。';
      pop.appendChild(empty);
      placePopupNearPoint(pop, clientX, clientY);
      return true;
    }

    for(const nm of list){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dba-ae-pop-btn';
      b.textContent = nm;
      b.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeAutoEquipPopup(false);
        await autoEquipThenAttack(row, col, nm);
      });
      pop.appendChild(b);
    }



    placePopupNearPoint(pop, clientX, clientY);
    return true;
  }

  // =========================
  // 装備ロスター（保存・UI）
  // =========================
  const ROSTER_LS_KEY = 'dba.roster.v1';

  // =========================
  // 保存データ世代（Gen1/Gen2/Gen3）
  //  - Gen1: ロスター保存とオート装備保存を別管理
  //  - Gen2: ロスター内に autoEquip を内包して統合保存
  //  - Gen3: Gen2 + createdAt / updatedAt を「年月日時分秒」のローカル時刻で保持
  // =========================
  const DBA_SAVE_GEN_CURRENT = 3; // 現行フォーマット（Gen3）

  function normalizeGenValue(v){
    const n = Number.parseInt(v, 10);
    if(!Number.isFinite(n)) return 1;
    if(n <= 1) return 1;
    if(n === 2) return 2;
    return 3;
  }

  function detectStoreGen(store){
    // gen が明示されていればそれを採用
    if(store && typeof store === 'object' && ('gen' in store)){
      return normalizeGenValue(store.gen);
    }
    // 明示が無い場合は内容から推定：
    // roster に autoEquip が1つでもあれば少なくとも Gen2
    // さらに createdAt / updatedAt が「YYYY-MM-DD HH:MM:SS」なら Gen3 とみなす
    try{
      const rosters = store && store.rosters ? store.rosters : {};
      let inferred = 1;
      for(const id of Object.keys(rosters || {})){
        const r = rosters[id];
        if(!r || typeof r !== 'object') continue;
        if(r.autoEquip && typeof r.autoEquip === 'object'){
          inferred = Math.max(inferred, 2);
        }
        const createdAt = sanitizeText(r.createdAt || '');
        const updatedAt = sanitizeText(r.updatedAt || '');
        if(
          /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(createdAt) ||
          /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(updatedAt)
        ){
          inferred = 3;
        }
      }
      return inferred;
    }catch(_e){}
    return 1;
  }

  // teambattle起動時に呼ぶ：Gen1/Gen2 → Gen3 自動移行
  function migrateSaveDataToGen3IfNeeded(){
    try{
      const store = loadRosterStore();
      const gen = detectStoreGen(store);
      if(gen >= DBA_SAVE_GEN_CURRENT){
        // genが未設定なら付与だけしておく（Gen判定の固定化）
        if(!('gen' in store)){
          store.gen = DBA_SAVE_GEN_CURRENT;
          saveRosterStore(store);
        }
        return true;
      }

      // ---- Gen1 / Gen2 → Gen3 へ移行 ----
      store.gen = DBA_SAVE_GEN_CURRENT;
      store.rosters = (store.rosters && typeof store.rosters === 'object') ? store.rosters : {};

      // 1) すべてのロスターに autoEquip ブロックを生やし、日時形式を Gen3 へ正規化
      for(const id of Object.keys(store.rosters)){
        const r = store.rosters[id];
        if(!r || typeof r !== 'object') continue;
        ensureRosterAutoEquipBlock(r);

        const createdAt0 = normalizeRosterDateTimeValue(r.createdAt, '');
        const updatedAt0 = normalizeRosterDateTimeValue(r.updatedAt, '');
        const nowText = nowIso();
        r.createdAt = createdAt0 || updatedAt0 || nowText;
        r.updatedAt = updatedAt0 || createdAt0 || nowText;
      }

      // 2) 旧LSのオート装備（候補/last）を active roster に統合
      //    （Gen1は “全ロスター共通” だったため、最小副作用で active に寄せる）
      const activeId = store.activeId;
      if(activeId && store.rosters[activeId]){
        const rAct = store.rosters[activeId];
        const ae = ensureRosterAutoEquipBlock(rAct);

        // active側が空のときだけ、旧LSを取り込む
        const hasAny =
          (ae && ae.candidates && Object.keys(ae.candidates).length > 0) ||
          (ae && sanitizeText(ae.lastPreset || '') !== '');
        if(!hasAny){
          let cand = null;
          let last = '';
          try{
            const raw = localStorage.getItem(LS_AUTO_EQUIP_CAND_KEY);
            if(raw){
              const obj = JSON.parse(raw);
              if(obj && typeof obj === 'object') cand = obj;
            }
          }catch(_e){}
          try{
            const raw2 = localStorage.getItem(LS_AUTO_EQUIP_LAST_KEY);
            last = raw2 ? String(raw2) : '';
          }catch(_e2){}

          if(cand && typeof cand === 'object') ae.candidates = cand;
          if(last) ae.lastPreset = last;

          rAct.autoEquip = ae;
          rAct.updatedAt = nowIso();
          store.rosters[store.activeId] = rAct;
        }
      }

      // 3) 移行が完了したら旧LSを削除（“古いGen”判定で再移行しないため）
      try{ localStorage.removeItem(LS_AUTO_EQUIP_CAND_KEY); }catch(_e){}
      try{ localStorage.removeItem(LS_AUTO_EQUIP_LAST_KEY); }catch(_e){}

      saveRosterStore(store);
      return true;
    }catch(_e){
      return false;
    }
  }

  // =========================
  // 装備ロスター：ロスター切替（長押しポップアップ）
  // =========================
  function ensureRosterSwitchPopup(){
    if(document.getElementById('dba-roster-switch-pop')) return;
    const pop = document.createElement('div');
    pop.id = 'dba-roster-switch-pop';
    pop.dataset.open = '0';
    document.body.appendChild(pop);

    // 外側クリックで閉じる
    document.addEventListener('pointerdown', (e) => {
      if(pop.dataset.open !== '1') return;
      const t = e.target;
      if(t instanceof Node && pop.contains(t)) return;
      closeRosterSwitchPopup(true);
    }, true);

    // ESC で閉じる
    document.addEventListener('keydown', (e) => {
      if(pop.dataset.open !== '1') return;
      if(e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      closeRosterSwitchPopup(true);
    }, true);
  }

  function closeRosterSwitchPopup(_cancel){
    const pop = document.getElementById('dba-roster-switch-pop');
    if(!pop) return;
    pop.dataset.open = '0';
    pop.textContent = '';
  }

  function placePopupUnderButton(pop, btn){
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth || 800;
    const svh = window.innerHeight || document.documentElement.clientHeight || 600;

    // ボタンの“下”を基本
    let x = rect.left;
    let y = rect.bottom + 8;

    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
    pop.style.right = 'auto';
    pop.style.bottom = 'auto';

    // はみ出し補正（描画後にrect取得）
    const r2 = pop.getBoundingClientRect();
    let nx = r2.left;
    let ny = r2.top;
    if(r2.right > vw - 8) nx -= (r2.right - (vw - 8));
    if(r2.left < 8) nx = 8;
    if(r2.bottom > svh - 8) ny -= (r2.bottom - (svh - 8));
    if(r2.top < 8) ny = 8;

    pop.style.left = nx + 'px';
    pop.style.top = ny + 'px';
  }

  function listRosterSummaries(){
    const store = loadRosterStore();
    const rosters = store && store.rosters ? store.rosters : {};
    const out = [];
    for(const id of Object.keys(rosters)){
      const r = rosters[id];
      if(!r) continue;
      out.push({
        id,
        title: sanitizeText(r.title || '') || '(無題)',
        updatedAt: sanitizeText(r.updatedAt || ''),
        presetCount: (r.presets && typeof r.presets === 'object') ? Object.keys(r.presets).length : 0
      });
    }
    // 並びは「更新が新しい順」へ（※ロスター“名一覧”の体験優先）
    out.sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return { store, list: out, activeId: store.activeId };
  }

  function switchActiveRosterById(nextId){
    const { store } = listRosterSummaries();
    if(!nextId || !store.rosters || !store.rosters[nextId]) return false;
    // 念のため、現在の状態をもう一度保存（“展開中データ保存”の保険）
    try{ saveRosterStore(loadRosterStore()); }catch(_e){}
    store.activeId = nextId;
    saveRosterStore(store);
    // activeId 破損対策も兼ねて生成系を通す
    createRosterIfNeeded();
    // 既存ロスターへ切り替えた直後は、切替先ロスター上で
    // 「最後にオート装備で適用したプリセット」記録をクリアする。
    // これにより、切替前ロスター時点の装備状態や記録を引きずって
    // 次回オート装備が再装備を誤って省略することを防ぐ。
    saveAutoEquipLastPreset('');
    return true;
  }

  function createNewRosterAndSwitch(){
    const store = loadRosterStore();
    store.rosters = store.rosters && typeof store.rosters === 'object' ? store.rosters : {};
    const id = `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // 既存タイトルの重複を避ける（軽く連番）
    const base = `装備ロスター_${yyyymmddLocal()}`;
    const titles = new Set(Object.values(store.rosters).map(r => sanitizeText(r && r.title)));
    let title = base;
    let n = 2;
    while(titles.has(title)){
      title = `${base}_${n}`;
      n++;
      if(n > 99) break;
    }

    store.rosters[id] = {
      id,
      title,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      presets: {},
      presetOrder: [],
      autoEquip: { candidates: {}, lastPreset: '' } // ★ロスター内にオート装備データを内包
    };
    store.activeId = id;
    saveRosterStore(store);
    createRosterIfNeeded();
    // 新しい装備ロスターを作成して切り替えた直後も、
    // 念のため「最後にオート装備で適用したプリセット」記録を明示的にクリアする。
    // 新規ロスターは autoEquip.lastPreset='' で生成しているが、
    // ここでも明示しておくことで、既存ロスター切替時と意図を揃える。
    saveAutoEquipLastPreset('');
    return id;
  }

  function openRosterSwitchPopupNearButton(btn){
    if(!btn) return false;
    ensureRosterSwitchPopup();
    const pop = document.getElementById('dba-roster-switch-pop');
    if(!pop) return false;

    const { list, activeId } = listRosterSummaries();
    pop.textContent = '';
    pop.dataset.open = '1';

    const ttl = document.createElement('div');
    ttl.className = 'dba-rs-pop-title';
    ttl.textContent = '装備ロスター：切替';
    pop.appendChild(ttl);

    if(list.length === 0){
      const empty = document.createElement('div');
      empty.style.fontWeight = '800';
      empty.style.padding = '6px 2px';
      empty.style.textAlign = 'left';
      empty.textContent = 'ロスターがありません。';
      pop.appendChild(empty);
    }else{
      for(const it of list){
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dba-rs-pop-btn';
        b.textContent = `${it.title}（${it.presetCount}）`;
        b.dataset.active = (it.id === activeId) ? '1' : '0';
        b.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeRosterSwitchPopup(false);
          switchActiveRosterById(it.id);

          // ロスターmodalが開いていれば再描画、無ければ開く
          const dlg = document.getElementById('dba-m-roster');
          const open = dlg && (dlg.open || dlg.hasAttribute('open'));
          if(open){
            renderRosterModalState(null);
          }else{
            openRosterModal();
          }
        });
        pop.appendChild(b);
      }
    }

    // 末尾：新規作成
    const bNew = document.createElement('button');
    bNew.type = 'button';
    bNew.className = 'dba-rs-pop-btn dba-rs-pop-btn--new';
    bNew.textContent = '新しい装備ロスターを作る';
    bNew.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeRosterSwitchPopup(false);
      // “作る”の時も、現ロスター状態を保存してから新規作成→即切替
      try{ saveRosterStore(loadRosterStore()); }catch(_e){}
      createNewRosterAndSwitch();
      const dlg = document.getElementById('dba-m-roster');
      const open = dlg && (dlg.open || dlg.hasAttribute('open'));
      if(open){
        renderRosterModalState(null);
      }else{
        openRosterModal();
      }
    });
    pop.appendChild(bNew);

    placePopupUnderButton(pop, btn);
    return true;
  }

  function pad2(n){ return String(n).padStart(2,'0'); }
  function yyyymmddLocal(){
    const d = new Date();
    return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}`;
  }
  function formatLocalDateTimeSec(d){
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }
  function nowIso(){ try{ return formatLocalDateTimeSec(new Date()); }catch(_e){ return ''; } }
  function normalizeRosterDateTimeValue(v, fallback = ''){
    const s = sanitizeText(v || '');
    if(!s) return String(fallback || '');
    if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)){
      return s;
    }
    const t = Date.parse(s);
    if(Number.isFinite(t)){
      try{ return formatLocalDateTimeSec(new Date(t)); }catch(_e){}
    }
    return String(fallback || '');
  }

  function loadRosterStore(){
    try{
      const raw = localStorage.getItem(ROSTER_LS_KEY);
      if(!raw){
        return { gen: DBA_SAVE_GEN_CURRENT, activeId: null, rosters: {} };
      }
      const obj = JSON.parse(raw);
      if(!obj || typeof obj !== 'object') return { gen: DBA_SAVE_GEN_CURRENT, activeId: null, rosters: {} };
      if(!obj.rosters || typeof obj.rosters !== 'object') obj.rosters = {};
      if(!('activeId' in obj)) obj.activeId = null;
      // gen が無い/不正なら推定して入れておく（この時点では“書き戻し”はしない）
      if(!('gen' in obj)){
        obj.gen = detectStoreGen(obj);
      }else{
        obj.gen = normalizeGenValue(obj.gen);
      }
      for(const id of Object.keys(obj.rosters || {})){
        const r = obj.rosters[id];
        if(!r || typeof r !== 'object') continue;
        const createdAt0 = normalizeRosterDateTimeValue(r.createdAt, '');
        const updatedAt0 = normalizeRosterDateTimeValue(r.updatedAt, '');
        if(createdAt0) r.createdAt = createdAt0;
        if(updatedAt0) r.updatedAt = updatedAt0;
      }
      return obj;
    }catch(_e){
      return { gen: DBA_SAVE_GEN_CURRENT, activeId: null, rosters: {} };
    }
  }

  function saveRosterStore(store){
    try{
      localStorage.setItem(ROSTER_LS_KEY, JSON.stringify(store));
    }catch(_e){}
  }

  function createRosterIfNeeded(){
    const store = loadRosterStore();
    // teambattle 起動時の自動移行後であっても、保険で gen を正規化
    store.gen = normalizeGenValue(store.gen);
    const ids = Object.keys(store.rosters || {});
    if(store.activeId && store.rosters[store.activeId]){
      return store;
    }
    if(ids.length > 0){
      store.activeId = ids[0];
      saveRosterStore(store);
      return store;
    }
    // 新規作成
    const id = `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const title = `装備ロスター_${yyyymmddLocal()}`;
    store.rosters[id] = {
      id,
      title,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      presets: {}, // { "name": [weaponId, armorId, necklaceId] }
      presetOrder: [], // 表示順を保持（追加順／バックアップJSON記述順）
      autoEquip: { candidates: {}, lastPreset: '' } // ★ロスター内にオート装備データを内包
    };
    store.activeId = id;
    store.gen = DBA_SAVE_GEN_CURRENT;
    saveRosterStore(store);
    return store;
  }

  function getActiveRoster(){
    const store = createRosterIfNeeded();
    const r = store.rosters[store.activeId];
    return { store, roster: r };
  }

  function setRosterTitle(newTitle){
    const { store, roster } = getActiveRoster();
    roster.title = sanitizeText(newTitle) || roster.title;
    roster.updatedAt = nowIso();
    store.rosters[store.activeId] = roster;
    saveRosterStore(store);
  }

  function hasPresetName(name, excludeName){
    const { roster } = getActiveRoster();
    const presets = (roster && roster.presets && typeof roster.presets === 'object') ? roster.presets : {};
    const target = sanitizeText(name);
    const exclude = sanitizeText(excludeName);
    if(!target) return false;
    for(const raw of Object.keys(presets)){
      const nm = sanitizeText(raw);
      if(!nm) continue;
      if(exclude && nm === exclude) continue;
      if(nm === target) return true;
    }
    return false;
  }

  function assertPresetNameAvailable(name, excludeName){
    const target = sanitizeText(name);
    if(!target) throw new Error('プリセット名が空です');
    if(hasPresetName(target, excludeName)){
      throw new Error(`同名のプリセットが既に存在します: ${target}`);
    }
    return target;
  }

  function renamePreset(oldName, newName){
    const { store, roster } = getActiveRoster();
    const oldNm = sanitizeText(oldName);
    const newNm = sanitizeText(newName);
    if(!oldNm) throw new Error('変更前のプリセット名が不正です');
    if(!newNm) throw new Error('変更後のプリセット名が空です');

    roster.presets = (roster && roster.presets && typeof roster.presets === 'object') ? roster.presets : {};
    roster.presetOrder = Array.isArray(roster.presetOrder) ? roster.presetOrder : [];

    if(!Object.prototype.hasOwnProperty.call(roster.presets, oldNm)){
      throw new Error(`プリセットが見つかりません: ${oldNm}`);
    }

    if(oldNm === newNm){
      return false;
    }

    assertPresetNameAvailable(newNm, oldNm);

    const triple = roster.presets[oldNm];
    delete roster.presets[oldNm];
    roster.presets[newNm] = Array.isArray(triple) ? triple.slice(0, 3) : [null, null, null];
    roster.presetOrder = roster.presetOrder.map((nm) => (sanitizeText(nm) === oldNm ? newNm : nm));

    try{
      const ae = ensureRosterAutoEquipBlock(roster);
      if(ae && ae.candidates && typeof ae.candidates === 'object'){
        for(const k of Object.keys(ae.candidates)){
          const arr0 = ae.candidates[k];
          if(!Array.isArray(arr0)) continue;
          ae.candidates[k] = arr0.map((x) => {
            const nm = sanitizeText(x);
            return (nm === oldNm) ? newNm : nm;
          });
        }
      }
      if(ae && sanitizeText(ae.lastPreset || '') === oldNm){
        ae.lastPreset = newNm;
      }
      roster.autoEquip = ae;
    }catch(_e){}

    try{
      if(sanitizeText(loadCurrentPresetName()) === oldNm){
        saveCurrentPresetName(newNm);
      }
    }catch(_e){}

    roster.updatedAt = nowIso();
    store.rosters[store.activeId] = roster;
    saveRosterStore(store);
    return true;
  }

  function findDuplicatePresetNamesInBackupText(text){
    const src = String(text || '');
    const keyIdx = src.search(/"presets"\s*:/);
    if(keyIdx < 0) return [];

    let i = keyIdx;
    while(i < src.length && src[i] !== ':') i++;
    if(i >= src.length) return [];
    i += 1;
    while(i < src.length && /\s/.test(src[i])) i++;
    if(src[i] !== '{') return [];

    const readJsonString = (startIdx) => {
      let j = startIdx + 1;
      while(j < src.length){
        const ch = src[j];
        if(ch === '\\'){
          j += 2;
          continue;
        }
        if(ch === '"'){
          return { end: j, raw: src.slice(startIdx, j + 1) };
        }
        j += 1;
      }
      throw new Error('Unterminated JSON string');
    };

    const seen = new Set();
    const dup = new Set();

    let depth = 1;
    let inString = false;
    let escape = false;
    let expectKey = true;

    for(let pos = i + 1; pos < src.length; pos++){
      const ch = src[pos];

      if(inString){
        if(escape){
          escape = false;
          continue;
        }
        if(ch === '\\'){
          escape = true;
          continue;
        }
        if(ch === '"'){
          inString = false;
        }
        continue;
      }

      if(ch === '"'){
        if(depth === 1 && expectKey){
          const parsed = readJsonString(pos);
          let key = '';
          try{ key = JSON.parse(parsed.raw); }catch(_e){ key = ''; }
          const name = sanitizeText(key);
          if(name){
            if(seen.has(name)) dup.add(name);
            else seen.add(name);
          }
          pos = parsed.end;
          expectKey = false;
          continue;
        }
        inString = true;
        continue;
      }

      if(ch === '{'){
        depth += 1;
        continue;
      }
      if(ch === '}'){
        depth -= 1;
        if(depth <= 0) break;
        if(depth === 1) expectKey = true;
        continue;
      }
      if(depth !== 1) continue;
      if(ch === ','){
        expectKey = true;
        continue;
      }
    }

    return Array.from(dup);
  }

  function collectPresetKeyEntriesInBackupText(text){
    const src = String(text || '');
    const keyIdx = src.search(/"presets"\s*:/);
    if(keyIdx < 0) return [];

    let i = keyIdx;
    while(i < src.length && src[i] !== ':') i++;
    if(i >= src.length) return [];
    i += 1;
    while(i < src.length && /\s/.test(src[i])) i++;
    if(src[i] !== '{') return [];

    const readJsonString = (startIdx) => {
      let j = startIdx + 1;
      while(j < src.length){
        const ch = src[j];
        if(ch === '\\'){
          j += 2;
          continue;
        }
        if(ch === '"'){
          return { end: j, raw: src.slice(startIdx, j + 1) };
        }
        j += 1;
      }
      throw new Error('Unterminated JSON string');
    };

    const entries = [];
    const seenCount = new Map();

    let depth = 1;
    let inString = false;
    let escape = false;
    let expectKey = true;

    for(let pos = i + 1; pos < src.length; pos++){
      const ch = src[pos];

      if(inString){
        if(escape){
          escape = false;
          continue;
        }
        if(ch === '\\'){
          escape = true;
          continue;
        }
        if(ch === '"'){
          inString = false;
        }
        continue;
      }

      if(ch === '"'){
        if(depth === 1 && expectKey){
          const parsed = readJsonString(pos);
          let key = '';
          try{ key = JSON.parse(parsed.raw); }catch(_e){ key = ''; }
          const name = sanitizeText(key);
          const occ = (seenCount.get(name) || 0) + 1;
          seenCount.set(name, occ);
          entries.push({
            name,
            occurrence: occ,
            start: pos,
            end: parsed.end
          });
          pos = parsed.end;
          expectKey = false;
          continue;
        }
        inString = true;
        continue;
      }

      if(ch === '{'){
        depth += 1;
        continue;
      }
      if(ch === '}'){
        depth -= 1;
        if(depth <= 0) break;
        if(depth === 1) expectKey = true;
        continue;
      }
      if(depth !== 1) continue;
      if(ch === ','){
        expectKey = true;
        continue;
      }
    }

    return entries;
  }

  function findFirstDuplicatePresetEntryInBackupText(text){
    const entries = collectPresetKeyEntriesInBackupText(text);
    for(const ent of entries){
      if(ent.name && ent.occurrence >= 2){
        return ent;
      }
    }
    return null;
  }

  function replacePresetKeyNameInBackupText(text, entry, newName){
    const src = String(text || '');
    const ent = entry || {};
    const start = Number(ent.start);
    const end = Number(ent.end);
    if(!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start){
      throw new Error('重複プリセット名の置換位置を特定できませんでした');
    }
    const newKeyRaw = JSON.stringify(String(newName || ''));
    return src.slice(0, start) + newKeyRaw + src.slice(end + 1);
  }

  async function resolveDuplicatePresetNamesInBackupTextViaModal(text){
    let current = String(text || '');

    for(;;){
      const dupEntry = findFirstDuplicatePresetEntryInBackupText(current);
      if(!dupEntry) return current;

      for(;;){
        const candidate = await openPresetDuplicateRenameModal(dupEntry.name, dupEntry.occurrence);
        if(candidate == null){
          throw new Error('キャンセルしました。');
        }

        const nextName = sanitizeText(candidate);
        if(!nextName){
          alert('プリセット名を入力してください。');
          continue;
        }

        const allEntries = collectPresetKeyEntriesInBackupText(current);
        const used = new Set();
        for(const ent of allEntries){
          if(ent === dupEntry) continue;
          const nm = sanitizeText(ent.name);
          if(nm) used.add(nm);
        }

        if(used.has(nextName)){
          alert(`同名のプリセットが既に存在します: ${nextName}`);
          continue;
        }

        current = replacePresetKeyNameInBackupText(current, dupEntry, nextName);
        break;
      }
    }
  }

  function validatePresetNamesFromPresetObject(presets){
    const src = (presets && typeof presets === 'object') ? presets : {};
    const seen = new Set();
    const dup = new Set();

    for(const raw of Object.keys(src)){
      const name = sanitizeText(raw);
      if(!name) continue;
      if(seen.has(name)) dup.add(name);
      else seen.add(name);
    }

    if(dup.size > 0){
      throw new Error(`プリセット名が重複しています: ${Array.from(dup).join(', ')}`);
    }
  }

  function rebuildPresetMapByOrder(presets, presetOrder){
    const src = (presets && typeof presets === 'object') ? presets : {};
    const order = Array.isArray(presetOrder) ? presetOrder : [];

    const out = {};
    const seen = new Set();

    for(const nm of order){
      const name = sanitizeText(nm);
      if(!name) continue;
      if(seen.has(name)) continue;
      if(!Object.prototype.hasOwnProperty.call(src, name)) continue;
      out[name] = src[name];
      seen.add(name);
    }

    for(const nm of Object.keys(src)){
      const name = sanitizeText(nm);
      if(!name) continue;
      if(seen.has(name)) continue;
      out[name] = src[nm];
      seen.add(name);
    }

    return out;
  }

  function overwriteRosterFromObject(obj){
    // バックアップ用：active roster の全体を上書き（最低限 title/presets を使用）
    const { store, roster } = getActiveRoster();
    if(!obj || typeof obj !== 'object') throw new Error('Invalid JSON object');
    const inGen = ('gen' in obj) ? normalizeGenValue(obj.gen) : 1; // gen無しは Gen1 とみなす
    const title = sanitizeText(obj.title || roster.title);
    const createdAtIn = normalizeRosterDateTimeValue(obj.createdAt, '');
    const updatedAtIn = normalizeRosterDateTimeValue(obj.updatedAt, '');
    const presets = (obj.presets && typeof obj.presets === 'object') ? obj.presets : {};
    // ★オート装備（任意）：無ければ既存維持
    const aeIn = (obj.autoEquip && typeof obj.autoEquip === 'object') ? obj.autoEquip : null;
    const aeCandidates = (aeIn && aeIn.candidates && typeof aeIn.candidates === 'object') ? aeIn.candidates : null;
    const aeLast = (aeIn && typeof aeIn.lastPreset === 'string') ? aeIn.lastPreset : null;
    validatePresetNamesFromPresetObject(presets);

    const cleaned = {};
    const order = [];
    for(const k of Object.keys(presets)){
      // バックアップJSONの記述順を尊重して order に積む
      const name = sanitizeText(k);
      if(!name) continue;
      const v = presets[k];
      if(!Array.isArray(v) || v.length !== 3) continue;
      cleaned[name] = [
        (v[0] === null || Number.isFinite(Number(v[0]))) ? (v[0] === null ? null : Number(v[0])) : null,
        (v[1] === null || Number.isFinite(Number(v[1]))) ? (v[1] === null ? null : Number(v[1])) : null,
        (v[2] === null || Number.isFinite(Number(v[2]))) ? (v[2] === null ? null : Number(v[2])) : null
      ];
      order.push(name);
    }
    roster.title = title || roster.title;
    roster.presets = cleaned;
    // 表示順はバックアップの記述順にする（ここで並び替えない）
    roster.presetOrder = order;
    roster.createdAt = createdAtIn || normalizeRosterDateTimeValue(roster.createdAt, nowIso());

    // ★Gen2/Gen3：autoEquip が入っていれば復元
    // ★Gen1：autoEquip が無い想定。空の autoEquip を確保しつつ、旧LSが残っていれば統合する
    try{
      const ae = ensureRosterAutoEquipBlock(roster);
      if(aeCandidates) ae.candidates = aeCandidates;
      if(aeLast != null) ae.lastPreset = String(aeLast || '');
      roster.autoEquip = ae;

      if(inGen <= 1){
        // 旧バックアップ（Gen1）で、かつ旧LSが残っている場合は active roster に統合
        // （“保存データ世代”を上げる要件に合わせる）
        migrateSaveDataToGen3IfNeeded();
      }
    }catch(_e){}

    roster.updatedAt = updatedAtIn || nowIso();
    store.rosters[store.activeId] = roster;
    store.gen = DBA_SAVE_GEN_CURRENT;
    saveRosterStore(store);
  }

  function deleteActiveRosterAndSwitch(){
    const store = loadRosterStore();
    if(store.activeId && store.rosters && store.rosters[store.activeId]){
      delete store.rosters[store.activeId];
    }
    const ids = Object.keys(store.rosters || {});
    if(ids.length > 0){
      store.activeId = ids[0];
      saveRosterStore(store);
      createRosterIfNeeded();
      // ロスター削除後に既存の別ロスターへ自動切替した直後も、
      // 切替先ロスター上で「最後にオート装備で適用したプリセット」記録をクリアする。
      // これにより、削除前ロスター時点の装備状態や記録を引きずって
      // 次回オート装備が再装備を誤って省略することを防ぐ。
      saveAutoEquipLastPreset('');
      return true;
    }
    // 1つも無ければ新規作成
    store.activeId = null;
    store.rosters = {};
    saveRosterStore(store);
    createRosterIfNeeded();
    // 最後の1件を削除して新規ロスターへ切り替わった直後も、
    // 念のため「最後にオート装備で適用したプリセット」記録を明示的にクリアする。
    // 新規ロスター生成側でも空になる設計だが、
    // ロスター削除後の自動切替経路として意図をここでも揃えておく。
    saveAutoEquipLastPreset('');
    return true;
  }

  function setPresetAt(name, triple, insertIndex, options){
    const { store, roster } = getActiveRoster();
    const n = sanitizeText(name);
    if(!n) throw new Error('プリセット名が空です');
    roster.presets = roster.presets || {};
    roster.presetOrder = Array.isArray(roster.presetOrder) ? roster.presetOrder : [];
    const existed = !!(roster.presets && Object.prototype.hasOwnProperty.call(roster.presets, n));
    const allowOverwrite = !!(options && options.allowOverwrite);
    if(!(allowOverwrite && existed)){
      assertPresetNameAvailable(n);
    }
    if(!Array.isArray(triple) || triple.length !== 3) throw new Error('Invalid preset triple');
    roster.presets[n] = [
      (triple[0] === null) ? null : Number(triple[0]),
      (triple[1] === null) ? null : Number(triple[1]),
      (triple[2] === null) ? null : Number(triple[2])
    ];
    // 既存プリセットを上書きする場合は順序は維持。
    // 新規プリセットだけ、指定位置へ挿入する。
    if(!existed){
      const idxRaw = Number(insertIndex);
      const idx = Number.isFinite(idxRaw)
        ? Math.max(0, Math.min(roster.presetOrder.length, Math.floor(idxRaw)))
        : roster.presetOrder.length;
      roster.presetOrder.splice(idx, 0, n);
    }
    roster.updatedAt = nowIso();
    store.rosters[store.activeId] = roster;
    saveRosterStore(store);
  }

  function setPreset(name, triple){
    setPresetAt(name, triple, null);
  }

  function makeDuplicatedPresetName(sourceName){
    const src = sanitizeText(sourceName);
    if(!src) throw new Error('複製元のプリセット名が不正です');

    const base = `コピー：${src}`;
    if(!hasPresetName(base)){
      return base;
    }

    let n = 2;
    while(n <= 9999){
      const cand = `${base} (${n})`;
      if(!hasPresetName(cand)){
        return cand;
      }
      n += 1;
    }

    throw new Error(`複製先のプリセット名を確保できませんでした: ${base}`);
  }

  function duplicatePresetBelow(name){
    const { roster } = getActiveRoster();
    const nm = sanitizeText(name);
    if(!nm) throw new Error('複製元のプリセット名が不正です');

    roster.presets = (roster && roster.presets && typeof roster.presets === 'object') ? roster.presets : {};
    roster.presetOrder = Array.isArray(roster.presetOrder) ? roster.presetOrder : [];

    if(!Object.prototype.hasOwnProperty.call(roster.presets, nm)){
      throw new Error(`プリセットが見つかりません: ${nm}`);
    }

    const triple = roster.presets[nm];
    if(!Array.isArray(triple) || triple.length !== 3){
      throw new Error(`プリセット内容が不正です: ${nm}`);
    }

    const baseIdx = roster.presetOrder.indexOf(nm);
    const insertIdx = (baseIdx >= 0) ? (baseIdx + 1) : roster.presetOrder.length;
    const newName = makeDuplicatedPresetName(nm);

    setPresetAt(newName, [
      (triple[0] === null) ? null : Number(triple[0]),
      (triple[1] === null) ? null : Number(triple[1]),
      (triple[2] === null) ? null : Number(triple[2])
    ], insertIdx);

    return newName;
  }

  function movePresetBy(name, delta){
    const { store, roster } = getActiveRoster();
    const nm = sanitizeText(name);
    const d = Number(delta);

    if(!nm) return false;
    if(!Number.isFinite(d) || d === 0) return false;

    roster.presets = (roster && roster.presets && typeof roster.presets === 'object') ? roster.presets : {};
    roster.presetOrder = Array.isArray(roster.presetOrder) ? roster.presetOrder.slice() : [];

    const from = roster.presetOrder.indexOf(nm);
    if(from < 0) return false;

    const to = from + (d < 0 ? -1 : 1);
    if(to < 0 || to >= roster.presetOrder.length) return false;

    const tmp = roster.presetOrder[from];
    roster.presetOrder[from] = roster.presetOrder[to];
    roster.presetOrder[to] = tmp;

    roster.updatedAt = nowIso();
    store.rosters[store.activeId] = roster;
    saveRosterStore(store);
    return true;
  }

  function deletePreset(name){
    const { store, roster } = getActiveRoster();
    const n = sanitizeText(name);
    if(!n) return false;
    if(roster.presets && roster.presets[n]){
      delete roster.presets[n];
      // 表示順配列からも削除
      if(Array.isArray(roster.presetOrder)){
        roster.presetOrder = roster.presetOrder.filter(x => x !== n);
      }
      roster.updatedAt = nowIso();
      store.rosters[store.activeId] = roster;
      saveRosterStore(store);
      // ★オート装備候補（セル長押しリスト）からも同名を削除
      try{ removePresetFromAutoEquipCandidates(n); }catch(_e){}
        // ★現在装備中として扱うプリセット名が同名ならクリア
        try{
          if(sanitizeText(loadCurrentPresetName()) === n){
            saveCurrentPresetName('');
          }
        }catch(_e){}
      return true;
    }
    return false;
  }

  function calcRosterInsertIndexFromClientY(listEl, clientY){
    if(!(listEl instanceof HTMLElement)) return 0;

    const items = Array.from(listEl.querySelectorAll('.dba-roster-item'));
    if(items.length === 0) return 0;

    for(let i = 0; i < items.length; i++){
      const rect = items[i].getBoundingClientRect();
      const midY = rect.top + (rect.height / 2);
      if(clientY < midY){
        return i;
      }
    }
    return items.length;
  }

  function showRosterInsertLineAtIndex(listEl, idx){
    if(!(listEl instanceof HTMLElement)) return;
    const line = listEl.querySelector('.dba-roster-insert-line');
    if(!(line instanceof HTMLElement)) return;

    const items = Array.from(listEl.querySelectorAll('.dba-roster-item'));
    const listRect = listEl.getBoundingClientRect();
    let y = 0;

    if(items.length === 0){
      y = 8;
    }else if(idx <= 0){
      const r0 = items[0].getBoundingClientRect();
      y = (r0.top - listRect.top) + listEl.scrollTop;
    }else if(idx >= items.length){
      const last = items[items.length - 1];
      const rl = last.getBoundingClientRect();
      const mb = parseFloat(getComputedStyle(last).marginBottom || '0') || 0;
      y = (rl.bottom - listRect.top) + listEl.scrollTop + mb;
    }else{
      const rt = items[idx].getBoundingClientRect();
      y = (rt.top - listRect.top) + listEl.scrollTop;
    }

    listEl.dataset.dbaInsertIndex = String(idx);
    line.style.top = `${Math.max(0, Math.floor(y))}px`;
    line.style.display = 'block';
  }

  function updateRosterInsertLineFromClientY(listEl, clientY){
    if(!(listEl instanceof HTMLElement)) return 0;
    const idx = calcRosterInsertIndexFromClientY(listEl, clientY);
    showRosterInsertLineAtIndex(listEl, idx);
    return idx;
  }

  function canScrollElementByDelta(el, deltaY){
    if(!(el instanceof HTMLElement)) return false;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    if(max <= 0) return false;
    if(deltaY > 0) return el.scrollTop < max;
    if(deltaY < 0) return el.scrollTop > 0;
    return false;
  }

  function installRosterInsertPickScrollLock(listEl){
    if(!(listEl instanceof HTMLElement)) return () => {};
    if(listEl.dataset.dbaInsertPickScrollLock === '1'){
      return () => {};
    }
    listEl.dataset.dbaInsertPickScrollLock = '1';

    let touchStartY = 0;

    const onWheelCapture = (e) => {
      const rosterDlg = document.getElementById('dba-m-roster');
      if(!rosterDlg || rosterDlg.dataset.dbaAddPickMode !== '1') return;

      const target = e.target;
      if(!(target instanceof Node) || !listEl.contains(target)) return;

      const dy = Number(e.deltaY || 0);

      // list 自身がスクロール可能なら、ネイティブスクロールをそのまま使い、
      // 背面 modal / page への伝播だけを止める
      if(canScrollElementByDelta(listEl, dy)){
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // 端まで来ていても、背面 modal / page 本体へ連鎖させない
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    const onTouchStartCapture = (e) => {
      const rosterDlg = document.getElementById('dba-m-roster');
      if(!rosterDlg || rosterDlg.dataset.dbaAddPickMode !== '1') return;
      const t = e.touches && e.touches[0];
      if(!t) return;
      touchStartY = t.clientY;
    };

    const onTouchMoveCapture = (e) => {
      const rosterDlg = document.getElementById('dba-m-roster');
      if(!rosterDlg || rosterDlg.dataset.dbaAddPickMode !== '1') return;

      const target = e.target;
      if(!(target instanceof Node) || !listEl.contains(target)) return;

      const t = e.touches && e.touches[0];
      if(!t) return;

      const deltaY = touchStartY - t.clientY;

      if(canScrollElementByDelta(listEl, deltaY)){
        // list 内だけネイティブスクロールさせ、背面の modal / page には渡さない
        e.stopPropagation();
        e.stopImmediatePropagation();
        touchStartY = t.clientY;
        return;
      }

      // 端でも背面へスクロールを漏らさない
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      touchStartY = t.clientY;
    };

    const onScrollChainBlock = (e) => {
      const rosterDlg = document.getElementById('dba-m-roster');
      if(!rosterDlg || rosterDlg.dataset.dbaAddPickMode !== '1') return;
      const target = e.target;
      if(!(target instanceof Node) || !listEl.contains(target)) return;
      e.stopPropagation();
    };

    document.addEventListener('wheel', onWheelCapture, { capture: true, passive: false });
    document.addEventListener('touchstart', onTouchStartCapture, { capture: true, passive: true });
    document.addEventListener('touchmove', onTouchMoveCapture, { capture: true, passive: false });
    listEl.addEventListener('scroll', onScrollChainBlock, { capture: true, passive: true });

    return () => {
      delete listEl.dataset.dbaInsertPickScrollLock;
      document.removeEventListener('wheel', onWheelCapture, { capture: true });
      document.removeEventListener('touchstart', onTouchStartCapture, { capture: true });
      document.removeEventListener('touchmove', onTouchMoveCapture, { capture: true });
      listEl.removeEventListener('scroll', onScrollChainBlock, { capture: true });
    };
  }

  function presetMetaText(triple){
    const w = (triple && triple[0] != null) ? `W:${triple[0]}` : 'W:-';
    const a = (triple && triple[1] != null) ? `A:${triple[1]}` : 'A:-';
    const n = (triple && triple[2] != null) ? `N:${triple[2]}` : 'N:-';
    return `${w} ${a} ${n}`;
  }

  function buildPresetMetaNode(triple, className){
    const wrap = document.createElement('div');
    wrap.className = className;

    const parts = [
      (triple && triple[0] != null) ? `W:${triple[0]}` : 'W:-',
      (triple && triple[1] != null) ? `A:${triple[1]}` : 'A:-',
      (triple && triple[2] != null) ? `N:${triple[2]}` : 'N:-'
    ];

    for(const txt of parts){
      const part = document.createElement('span');
      part.className = 'dba-preset-meta__part';
      part.textContent = txt;
      wrap.appendChild(part);
    }

    return wrap;
  }

  async function equipById(id){
    if(id == null) return { ok:true, missing:false };
    const url = makeEquipUrl(id);
    const res = await fetch(url, { method:'GET', credentials:'include', cache:'no-store' });
    if(!res.ok) throw new Error(`equip failed: ${res.status}`);
    const bodyText = await res.text();
    if(isItemMissingResponseText(bodyText)){
      return {
        ok: false,
        missing: true,
        text: bodyText
      };
    }
    return {
      ok: true,
      missing: false,
      text: bodyText
    };
  }

  async function equipPresetByName(name){
    const { roster } = getActiveRoster();
    const n = sanitizeText(name);
    const triple = roster && roster.presets ? roster.presets[n] : null;
    if(!triple) throw new Error('preset not found');
    // 順番：武器→防具→首
    {
      const r = await equipById(triple[0]);
      if(r && r.missing){
        return await handleMissingPresetDuringEquip(n);
      }
    }
    {
      const r = await equipById(triple[1]);
      if(r && r.missing){
        return await handleMissingPresetDuringEquip(n);
      }
    }
    {
      const r = await equipById(triple[2]);
      if(r && r.missing){
        return await handleMissingPresetDuringEquip(n);
      }
    }
    // ★「現在装備中として扱うプリセット名」を保存（オート装備の判定に使う）
    saveCurrentPresetName(n);
    return { ok:true, missing:false, deleted:false };
  }

  // =========================
  // 装備ロスター：モーダル UI
  // =========================
  function buildRosterModal(){
    if(document.getElementById('dba-m-roster')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-roster';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';
    const title = document.createElement('div');
    title.className = 'dba-modal__title';
    title.textContent = '装備ロスター';
    const btnX = document.createElement('button');
    btnX.type = 'button';
    btnX.className = 'dba-btn-x';
    btnX.textContent = '×';
    top.appendChild(title);
    top.appendChild(btnX);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    const box = document.createElement('div');
    box.id = 'dba-roster-box';
    box.style.minHeight = '0';
    mid.appendChild(box);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';
    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'dba-btn-close';
    btnClose.textContent = 'Close';
    bot.appendChild(btnClose);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){
      finalizeRosterScrollStateOnClose();
      try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
    }
    btnX.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeDirect(); });
    btnClose.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeDirect(); });
  }

  function renderRosterModalState(selectedPresetName){
    const box = document.getElementById('dba-roster-box');
    if(!box) return;
    {
      const prevList = document.getElementById('dba-roster-list');
      if(prevList instanceof HTMLElement){
        const prevTop = Math.max(0, Math.round(prevList.scrollTop || 0));
        DBA_ROSTER_UI_STATE.scrollTop = prevTop;
        if(loadRosterScrollRememberEnabled()){
          saveRosterSavedScrollTop(prevTop);
        }
      }
    }
    const { roster } = getActiveRoster();
    const title = roster ? roster.title : '装備ロスター';
    const presets = roster && roster.presets ? roster.presets : {};
    // 削除モード（「削除」→対象選択 方式）
    const rosterDlg = document.getElementById('dba-m-roster');
    const delMode = !!(rosterDlg && rosterDlg.dataset.dbaDelMode === '1');
    // 再編集モード（「再編集」→対象選択 方式）
    const editMode = !!(rosterDlg && rosterDlg.dataset.dbaEditMode === '1');
    // 複製モード（「複製」→対象選択 方式）
    const dupMode = !!(rosterDlg && rosterDlg.dataset.dbaDupMode === '1');
    // 追加位置選択モード（「追加」→挿入位置選択 方式）
    const addPickMode = !!(rosterDlg && rosterDlg.dataset.dbaAddPickMode === '1');
    const presetClickAction = loadRosterPresetClickAction();
    const expandedMenuPresetName = sanitizeText(rosterDlg && rosterDlg.dataset.dbaMenuPresetName ? rosterDlg.dataset.dbaMenuPresetName : '');
    // ★並び替え禁止：表示順は presetOrder（追加順／バックアップ記述順）を優先
    const order = Array.isArray(roster && roster.presetOrder) ? roster.presetOrder : [];
    const seen = new Set();
    const names = [];
    // まず order の順に並べる（存在するものだけ）
    for(const nm of order){
      if(!nm) continue;
      if(seen.has(nm)) continue;
      if(Object.prototype.hasOwnProperty.call(presets, nm)){
        names.push(nm);
        seen.add(nm);
      }
    }
    // order に無いキーがあれば末尾に追加（ここでも sort しない）
    for(const nm of Object.keys(presets)){
      if(seen.has(nm)) continue;
      names.push(nm);
      seen.add(nm);
    }

    box.textContent = '';

    // 1段目：ロスタータイトル + 右ボタン群
    const head = document.createElement('div');
    head.className = 'dba-roster-head';

    const headTitle = document.createElement('div');
    headTitle.className = 'dba-roster-title';
    headTitle.textContent = title;

    const headBtns = document.createElement('div');
    headBtns.className = 'dba-roster-head-btns';

    const btnAuto = document.createElement('button');
    btnAuto.type = 'button';
    btnAuto.className = 'dba-btn-mini';
    btnAuto.textContent = 'オート装備設定';

    const btnOption = document.createElement('button');
    btnOption.type = 'button';
    btnOption.className = 'dba-btn-mini';
    btnOption.textContent = 'ロスターオプション';


    headBtns.appendChild(btnAuto);
    headBtns.appendChild(btnOption);

    head.appendChild(headTitle);
    head.appendChild(headBtns);
    const hideMenuRow2 = loadRosterHideMenuRow2Enabled();
    if(hideMenuRow2){
      head.style.borderBottom = '0';
    }
    box.appendChild(head);

    // 2段目：追加/削除
    const row2 = document.createElement('div');
    row2.className = 'dba-roster-row2';

    const btnAdd = document.createElement('button');
    btnAdd.type = 'button';
    btnAdd.className = 'dba-btn-mini dba-btn-mini--ok';
    btnAdd.textContent = addPickMode ? '追加位置:選択してください' : '追加';

    const btnDuplicate = document.createElement('button');
    btnDuplicate.type = 'button';
    btnDuplicate.className = 'dba-btn-mini';
    btnDuplicate.textContent = dupMode ? '複製:選択してください' : '複製';
    btnDuplicate.disabled = false;

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.className = 'dba-btn-mini';
    btnEdit.textContent = editMode ? '再編集:選択してください' : '再編集';
    // 「再編集」→「対象選択」方式なので、ボタン自体は常に押せる
    btnEdit.disabled = false;

    const btnSort = document.createElement('button');
    btnSort.type = 'button';
    btnSort.className = 'dba-btn-mini';
    btnSort.textContent = '並び替え';
    btnSort.disabled = false;

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'dba-btn-mini dba-btn-mini--danger';
    btnDel.textContent = delMode ? '削除:選択してください' : '削除';
    // 「削除」→「対象選択」方式なので、ボタン自体は常に押せる
    btnDel.disabled = false;

    row2.appendChild(btnAdd);
    row2.appendChild(btnDuplicate);
    row2.appendChild(btnEdit);
    row2.appendChild(btnSort);

    row2.appendChild(btnDel);
    if(hideMenuRow2){
      row2.style.display = 'none';
      row2.hidden = true;
    }
    box.appendChild(row2);

    // リスト
    const list = document.createElement('div');
    list.id = 'dba-roster-list';
    list.className = addPickMode ? 'dba-roster-list dba-roster-list--insertpick' : 'dba-roster-list';
    list.dataset.dbaInsertIndex = String(names.length);

    const insertLine = document.createElement('div');
    insertLine.className = 'dba-roster-insert-line';
    list.appendChild(insertLine);

    if(names.length === 0){
      const empty = document.createElement('div');
      empty.style.padding = '10px';
      empty.style.fontWeight = '700';
      empty.textContent = 'プリセットがありません。';
      list.appendChild(empty);
    }else{
      for(const nm of names){
        const triple = presets[nm];
        const item = document.createElement('div');
        item.className = 'dba-roster-item';
        item.dataset.name = nm;
        // 削除モード中は「選択＝装備適用」ではないため、選択強調はOFFにする
        item.dataset.selected = (
          !delMode && !dupMode && (
            (nm === selectedPresetName) ||
            (presetClickAction === 'menu' && nm === expandedMenuPresetName)
          )
        ) ? '1' : '0';

        const n = document.createElement('div');
        n.className = 'dba-roster-item__name';
        n.textContent = nm;

        const m = buildPresetMetaNode(triple, 'dba-roster-item__meta');

        item.appendChild(n);
        item.appendChild(m);

        const runEquipPreset = async () => {
          renderRosterModalState(nm);
          try{
            closeRosterResultModal();
            openRosterProgressAlertModal(`装備切替中…\n${nm}\n${presetMetaText(presets[nm])}`, '装備ロスター');
            const result = await equipPresetByName(nm);
            if(result && result.missing){
              closeRosterProgressAlertModal();
              return;
            }
            saveAutoEquipLastPreset('');
            if(rosterDlg) rosterDlg.dataset.dbaMenuPresetName = '';
            closeRosterProgressAlertModal();
            openRosterResultModalWithNode(`装備切替完了\n${nm}`, '装備ロスター');
          }catch(_e2){
            closeRosterProgressAlertModal();
            openRosterResultModalWithNode(`装備切替に失敗しました\n${nm}`, '装備ロスター');
          }
        };

        item.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          // 追加位置選択モード中：クリック＝その位置で追加
          if(rosterDlg && rosterDlg.dataset.dbaAddPickMode === '1'){
            const idx = updateRosterInsertLineFromClientY(list, e.clientY);
            try{
              if(typeof releaseScrollLock === 'function') releaseScrollLock();
            }catch(_e){}
            rosterDlg.dataset.dbaAddPickMode = '0';
            renderRosterModalState(null);
            openRosterAddPresetModal(() => {
              renderRosterModalState(null);
            }, idx);
            return;
          }
          // 削除モード中：クリック＝削除対象の選択（装備はしない）
          if(rosterDlg && rosterDlg.dataset.dbaDelMode === '1'){
            const ok = confirm(`プリセット「${nm}」を削除しますか？`);
            if(!ok) return;
            deletePreset(nm);
            // 削除が終わったら削除モード解除
            rosterDlg.dataset.dbaDelMode = '0';
            renderRosterModalState(null);
            return;
          }

          // 複製モード中：クリック＝複製対象の選択（装備はしない）
          if(rosterDlg && rosterDlg.dataset.dbaDupMode === '1'){
            let duplicatedName = '';
            try{
              duplicatedName = duplicatePresetBelow(nm);
            }catch(err){
              alert(err && err.message ? err.message : 'プリセットの複製に失敗しました。');
              return;
            }
            rosterDlg.dataset.dbaDupMode = '0';
            rosterDlg.dataset.dbaMenuPresetName = duplicatedName;
            renderRosterModalState(duplicatedName);
            return;
          }

          // 再編集モード中：クリック＝再編集対象の選択（装備はしない）
          if(rosterDlg && rosterDlg.dataset.dbaEditMode === '1'){
            // 再編集モード解除（選択後は通常に戻す）
            rosterDlg.dataset.dbaEditMode = '0';
            renderRosterModalState(null);
            openRosterEditPresetModal(nm, () => {
              renderRosterModalState(nm);
            });
            return;
          }

          if(presetClickAction === 'menu'){
            if(rosterDlg){
              rosterDlg.dataset.dbaMenuPresetName = (expandedMenuPresetName === nm) ? '' : nm;
            }
            renderRosterModalState(selectedPresetName || null);
            return;
          }

          // 通常：クリック＝選択 + 装備適用
          await runEquipPreset();
        });

        if(presetClickAction === 'menu' && expandedMenuPresetName === nm){
          const actionWrap = document.createElement('div');
          actionWrap.className = 'dba-roster-item__actions';

          const baseIdx = names.indexOf(nm);
          const canMoveUp = baseIdx > 0;
          const canMoveDown = baseIdx >= 0 && baseIdx < (names.length - 1);

          const btnCancelMenu = document.createElement('button');
          btnCancelMenu.type = 'button';
          btnCancelMenu.className = 'dba-btn-mini dba-btn-mini--cancel';
          btnCancelMenu.textContent = 'キャンセル';

          const btnEquipMenu = document.createElement('button');
          btnEquipMenu.type = 'button';
          btnEquipMenu.className = 'dba-btn-mini dba-btn-mini--ok';
          btnEquipMenu.textContent = '装備';

          const btnReeditMenu = document.createElement('button');
          btnReeditMenu.type = 'button';
          btnReeditMenu.className = 'dba-btn-mini';
          btnReeditMenu.textContent = '再編集';

          const btnDuplicateMenu = document.createElement('button');
          btnDuplicateMenu.type = 'button';
          btnDuplicateMenu.className = 'dba-btn-mini';
          btnDuplicateMenu.textContent = '複製';

          const btnAddAboveMenu = document.createElement('button');
          btnAddAboveMenu.type = 'button';
          btnAddAboveMenu.className = 'dba-btn-mini';
          btnAddAboveMenu.textContent = '上に追加';

          const btnAddBelowMenu = document.createElement('button');
          btnAddBelowMenu.type = 'button';
          btnAddBelowMenu.className = 'dba-btn-mini';
          btnAddBelowMenu.textContent = '下に追加';

          const btnMoveUpMenu = document.createElement('button');
          btnMoveUpMenu.type = 'button';
          btnMoveUpMenu.className = 'dba-btn-mini';
          btnMoveUpMenu.textContent = '1つ上げる';
          btnMoveUpMenu.disabled = !canMoveUp;

          const btnMoveDownMenu = document.createElement('button');
          btnMoveDownMenu.type = 'button';
          btnMoveDownMenu.className = 'dba-btn-mini';
          btnMoveDownMenu.textContent = '1つ下げる';
          btnMoveDownMenu.disabled = !canMoveDown;

          const btnDeleteMenu = document.createElement('button');
          btnDeleteMenu.type = 'button';
          btnDeleteMenu.className = 'dba-btn-mini dba-btn-mini--danger';
          btnDeleteMenu.textContent = '削除';

          btnCancelMenu.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if(rosterDlg) rosterDlg.dataset.dbaMenuPresetName = '';
            renderRosterModalState(selectedPresetName || null);
          });

          btnEquipMenu.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await runEquipPreset();
          });

          btnReeditMenu.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if(rosterDlg) rosterDlg.dataset.dbaDupMode = '0';
            if(rosterDlg) rosterDlg.dataset.dbaMenuPresetName = '';
            renderRosterModalState(null);
            openRosterEditPresetModal(nm, () => {
              renderRosterModalState(nm);
            });
          });

          btnDuplicateMenu.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            let duplicatedName = '';
            try{
              duplicatedName = duplicatePresetBelow(nm);
            }catch(err){
              alert(err && err.message ? err.message : 'プリセットの複製に失敗しました。');
              return;
            }
            if(rosterDlg) rosterDlg.dataset.dbaMenuPresetName = duplicatedName;
            renderRosterModalState(selectedPresetName || null);
          });

          btnAddAboveMenu.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const baseIdx = names.indexOf(nm);
            const insertIdx = (baseIdx >= 0) ? baseIdx : 0;
            if(rosterDlg) rosterDlg.dataset.dbaMenuPresetName = '';
            if(rosterDlg) rosterDlg.dataset.dbaAddPickMode = '0';
            if(rosterDlg) rosterDlg.dataset.dbaDelMode = '0';
            if(rosterDlg) rosterDlg.dataset.dbaDupMode = '0';
            if(rosterDlg) rosterDlg.dataset.dbaEditMode = '0';
            renderRosterModalState(null);
            openRosterAddPresetModal(() => {
              renderRosterModalState(null);
            }, insertIdx);
          });

          btnAddBelowMenu.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const baseIdx = names.indexOf(nm);
            const insertIdx = (baseIdx >= 0) ? (baseIdx + 1) : names.length;
            if(rosterDlg) rosterDlg.dataset.dbaMenuPresetName = '';
            if(rosterDlg) rosterDlg.dataset.dbaAddPickMode = '0';
            if(rosterDlg) rosterDlg.dataset.dbaDelMode = '0';
            if(rosterDlg) rosterDlg.dataset.dbaDupMode = '0';
            if(rosterDlg) rosterDlg.dataset.dbaEditMode = '0';
            renderRosterModalState(null);
            openRosterAddPresetModal(() => {
              renderRosterModalState(null);
            }, insertIdx);
          });

          btnMoveUpMenu.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if(!canMoveUp) return;
            const moved = movePresetBy(nm, -1);
            if(!moved) return;
            if(rosterDlg) rosterDlg.dataset.dbaMenuPresetName = nm;
            renderRosterModalState(selectedPresetName || null);
          });

          btnMoveDownMenu.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if(!canMoveDown) return;
            const moved = movePresetBy(nm, 1);
            if(!moved) return;
            if(rosterDlg) rosterDlg.dataset.dbaMenuPresetName = nm;
            renderRosterModalState(selectedPresetName || null);
          });

          btnDeleteMenu.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const ok = confirm(`プリセット「${nm}」を削除しますか？`);
            if(!ok) return;
            deletePreset(nm);
            if(rosterDlg) rosterDlg.dataset.dbaMenuPresetName = '';
            renderRosterModalState(null);
          });

          actionWrap.appendChild(btnCancelMenu);
          actionWrap.appendChild(btnEquipMenu);
          actionWrap.appendChild(btnReeditMenu);
          actionWrap.appendChild(btnDuplicateMenu);
          actionWrap.appendChild(btnAddAboveMenu);
          actionWrap.appendChild(btnAddBelowMenu);
          actionWrap.appendChild(btnMoveUpMenu);
          actionWrap.appendChild(btnMoveDownMenu);
          actionWrap.appendChild(btnDeleteMenu);
          item.appendChild(actionWrap);
        }

        list.appendChild(item);
      }
    }
    box.appendChild(list);

    list.addEventListener('scroll', () => {
      const top = Math.max(0, Math.round(list.scrollTop || 0));
      DBA_ROSTER_UI_STATE.scrollTop = top;
      if(loadRosterScrollRememberEnabled()){
        saveRosterSavedScrollTop(top);
      }
    }, { passive: true });

    requestAnimationFrame(() => {
      const restoreTop = Math.max(
        0,
        loadRosterScrollRememberEnabled()
          ? loadRosterSavedScrollTop()
          : Number(DBA_ROSTER_UI_STATE.scrollTop || 0)
      );
      list.scrollTop = restoreTop;
    });

    if(addPickMode){
      const releaseScrollLock = installRosterInsertPickScrollLock(list);

      const touchState = {
        active: false,
        moved: false,
        scrolled: false,
        startAt: 0,
        startX: 0,
        startY: 0,
        startScrollTop: 0
      };

      const INSERT_PICK_TAP_MAX_MS = 250;
      const INSERT_PICK_TAP_MOVE_PX = 6;
      const INSERT_PICK_TAP_SCROLL_PX = 2;

      const getTouchClientY = (evt) => {
        if(evt && evt.touches && evt.touches[0]) return evt.touches[0].clientY;
        if(evt && evt.changedTouches && evt.changedTouches[0]) return evt.changedTouches[0].clientY;
        return null;
      };

      const resetTouchState = () => {
        touchState.active = false;
        touchState.moved = false;
        touchState.scrolled = false;
        touchState.startAt = 0;
        touchState.startX = 0;
        touchState.startY = 0;
        touchState.startScrollTop = 0;
      };

      showRosterInsertLineAtIndex(list, names.length);

      list.addEventListener('mousemove', (e) => {
        updateRosterInsertLineFromClientY(list, e.clientY);
      });

      list.addEventListener('mouseleave', () => {
        showRosterInsertLineAtIndex(list, Number(list.dataset.dbaInsertIndex || names.length));
      });

      list.addEventListener('click', (e) => {
        if(!rosterDlg || rosterDlg.dataset.dbaAddPickMode !== '1') return;
        if((e.target instanceof Element) && e.target.closest('.dba-roster-item')) return;
        e.preventDefault();
        e.stopPropagation();
        const idx = updateRosterInsertLineFromClientY(list, e.clientY);
        rosterDlg.dataset.dbaAddPickMode = '0';
        renderRosterModalState(null);
        openRosterAddPresetModal(() => {
          renderRosterModalState(null);
        }, idx);
      });

      list.addEventListener('click', (e) => {
        if(!rosterDlg) return;
        if(rosterDlg.dataset.dbaAddPickMode === '1') return;
        if(loadRosterPresetClickAction() !== 'menu') return;
        if((e.target instanceof Element) && e.target.closest('.dba-roster-item')) return;
        if(!sanitizeText(rosterDlg.dataset.dbaMenuPresetName || '')) return;
        e.preventDefault();
        e.stopPropagation();
        rosterDlg.dataset.dbaMenuPresetName = '';
        renderRosterModalState(selectedPresetName || null);
      });

      list.addEventListener('touchstart', (e) => {
        const y = getTouchClientY(e);
        if(y == null) return;
        const x = (e.touches && e.touches[0]) ? e.touches[0].clientX : 0;
        touchState.active = true;
        touchState.moved = false;
        touchState.scrolled = false;
        touchState.startAt = Date.now();
        touchState.startX = x;
        touchState.startY = y;
        touchState.startScrollTop = list.scrollTop;
        updateRosterInsertLineFromClientY(list, y);
      }, { passive: true });

      list.addEventListener('touchmove', (e) => {
        if(!touchState.active) return;
        const y = getTouchClientY(e);
        if(y == null) return;
        const x = (e.touches && e.touches[0]) ? e.touches[0].clientX : 0;
        if(
          Math.abs(x - touchState.startX) > INSERT_PICK_TAP_MOVE_PX ||
          Math.abs(y - touchState.startY) > INSERT_PICK_TAP_MOVE_PX
        ){
          touchState.moved = true;
        }
        if(Math.abs(list.scrollTop - touchState.startScrollTop) > INSERT_PICK_TAP_SCROLL_PX){
          touchState.scrolled = true;
        }
        updateRosterInsertLineFromClientY(list, y);
      }, { passive: true });

      list.addEventListener('scroll', () => {
        if(!touchState.active) return;
        if(Math.abs(list.scrollTop - touchState.startScrollTop) > INSERT_PICK_TAP_SCROLL_PX){
          touchState.scrolled = true;
        }
      }, { passive: true });

      list.addEventListener('touchend', (e) => {
        if(!rosterDlg || rosterDlg.dataset.dbaAddPickMode !== '1') return;
        const y = getTouchClientY(e);
        if(y == null){
          resetTouchState();
          return;
        }
        const elapsed = touchState.startAt > 0 ? (Date.now() - touchState.startAt) : Number.POSITIVE_INFINITY;
        if(touchState.moved || touchState.scrolled || elapsed > INSERT_PICK_TAP_MAX_MS){
          resetTouchState();
          return;
        }
        const idx = updateRosterInsertLineFromClientY(list, y);
        try{ releaseScrollLock(); }catch(_e){}
        rosterDlg.dataset.dbaAddPickMode = '0';
        renderRosterModalState(null);
        openRosterAddPresetModal(() => {
          renderRosterModalState(null);
        }, idx);
        resetTouchState();
      }, { passive: true });

      list.addEventListener('touchcancel', () => {
        resetTouchState();
      }, { passive: true });

      list.addEventListener('click', () => {
        if(!rosterDlg || rosterDlg.dataset.dbaAddPickMode !== '1') return;
        try{ releaseScrollLock(); }catch(_e){}
      }, { capture: true });
    }

    // ----- Handlers (1) -----
    btnOption.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if(rosterDlg) rosterDlg.dataset.dbaDelMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaDupMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaEditMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaAddPickMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaMenuPresetName = '';
      openRosterOptionsModal(() => {
        renderRosterModalState(selectedPresetName || null);
      });
    });

    // ----- Handlers (2) -----
    btnAdd.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if(rosterDlg) rosterDlg.dataset.dbaDelMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaDupMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaEditMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaMenuPresetName = '';
      if(!rosterDlg) return;
      const next = (rosterDlg.dataset.dbaAddPickMode === '1') ? '0' : '1';
      rosterDlg.dataset.dbaAddPickMode = next;
      renderRosterModalState(null);
    });

    // ----- Handlers (3) -----
    btnDuplicate.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if(!rosterDlg) return;
      rosterDlg.dataset.dbaDelMode = '0';
      rosterDlg.dataset.dbaEditMode = '0';
      rosterDlg.dataset.dbaAddPickMode = '0';
      rosterDlg.dataset.dbaMenuPresetName = '';
      const next = (rosterDlg.dataset.dbaDupMode === '1') ? '0' : '1';
      rosterDlg.dataset.dbaDupMode = next;
      if(next === '1'){
        renderRosterModalState(null);
      }else{
        renderRosterModalState(selectedPresetName || null);
      }
    });

    // ----- Handlers (4) -----
    btnEdit.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      // 「再編集」→「対象選択」へ切り替え
      if(!rosterDlg) return;
      // 再編集モードに入るときは削除モードをOFF（誤操作防止）
      rosterDlg.dataset.dbaDelMode = '0';
      rosterDlg.dataset.dbaDupMode = '0';
      rosterDlg.dataset.dbaAddPickMode = '0';
      rosterDlg.dataset.dbaMenuPresetName = '';
      const next = (rosterDlg.dataset.dbaEditMode === '1') ? '0' : '1';
      rosterDlg.dataset.dbaEditMode = next;
      // 再編集モードON時は、誤操作防止のため選択状態をクリアして描画
      if(next === '1'){
        renderRosterModalState(null);
      }else{
        renderRosterModalState(selectedPresetName || null);
      }
    });

    // ----- Handlers (5) -----
    btnSort.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if(rosterDlg) rosterDlg.dataset.dbaDelMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaDupMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaEditMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaMenuPresetName = '';
      openRosterSortModal(() => {
        renderRosterModalState(selectedPresetName || null);
      });
    });

    // ----- Handlers (6) -----
    btnAuto.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if(rosterDlg) rosterDlg.dataset.dbaDelMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaDupMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaEditMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaAddPickMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaMenuPresetName = '';
      openAutoEquipSettingsModal();
    });

    // ----- Handlers (7) -----
    btnDel.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      // 「削除」→「対象選択」へ切り替え
      if(!rosterDlg) return;
      // 削除モードに入るときは再編集モードをOFF（誤操作防止）
      rosterDlg.dataset.dbaDupMode = '0';
      rosterDlg.dataset.dbaEditMode = '0';
      rosterDlg.dataset.dbaAddPickMode = '0';
      const next = (rosterDlg.dataset.dbaDelMode === '1') ? '0' : '1';
      rosterDlg.dataset.dbaDelMode = next;
      // 削除モードON時は、誤操作防止のため選択状態をクリアして描画
      if(next === '1'){
        renderRosterModalState(null);
      }else{
        renderRosterModalState(selectedPresetName || null);
      }
    });
  }

  function openRosterModal(){
    const openNow = () => {
      buildRosterModal();
      createRosterIfNeeded();
      prepareRosterScrollStateForOpen();
      const dlg = document.getElementById('dba-m-roster');
      if(dlg){
        dlg.dataset.dbaAddPickMode = '0';
        dlg.dataset.dbaDelMode = '0';
        dlg.dataset.dbaDupMode = '0';
        dlg.dataset.dbaEditMode = '0';
        dlg.dataset.dbaMenuPresetName = '';
      }
      renderRosterModalState(null);
      const dlg2 = document.getElementById('dba-m-roster');
      if(!dlg2) return;
      try{ dlg2.showModal(); }catch(_e){ dlg2.setAttribute('open',''); }
    };
    if(document.body) openNow();
    else document.addEventListener('DOMContentLoaded', openNow, { once:true });
  }

  // =========================
  // オート装備設定モーダル（候補登録）
  // =========================
  const AE_KEYS_GENERAL = ['N','R','SR','SSR','UR','N?','R?','SR?','SSR?','UR?'];
  const AE_KEYS_GUARD   = ['N警','R警','SR警','SSR警','UR警','N警?','R警?','SR警?','SSR警?','UR警?'];

  function buildAutoEquipSettingsModal(){
    if(document.getElementById('dba-m-auto-equip')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-auto-equip';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';
    const title = document.createElement('div');
    title.className = 'dba-modal__title';
    title.textContent = 'オート装備設定';
    const btnX = document.createElement('button');
    btnX.type = 'button';
    btnX.className = 'dba-btn-x';
    btnX.textContent = '×';
    top.appendChild(title);
    top.appendChild(btnX);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    // mid上部：決定 / Cancel
    const topBtns = document.createElement('div');
    topBtns.className = 'dba-ae-topbtns';

    const btnDecide = document.createElement('button');
    btnDecide.type = 'button';
    btnDecide.className = 'dba-btn-apply';
    btnDecide.id = 'dba-ae-btn-decide';
    btnDecide.textContent = '決定';

    const btnOption = document.createElement('button');
    btnOption.type = 'button';
    btnOption.className = 'dba-btn-mini';
    btnOption.id = 'dba-ae-btn-option';
    btnOption.textContent = 'オプション';

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'dba-btn-close';
    btnCancel.id = 'dba-ae-btn-cancel';
    btnCancel.textContent = 'Cancel';

    topBtns.appendChild(btnDecide);
    topBtns.appendChild(btnOption);
    topBtns.appendChild(btnCancel);

    mid.appendChild(topBtns);

    // tabs
    const tabs = document.createElement('div');
    tabs.className = 'dba-ae-tabs';

    const tabGen = document.createElement('button');
    tabGen.type = 'button';
    tabGen.className = 'dba-ae-tab';
    tabGen.id = 'dba-ae-tab-general';
    tabGen.textContent = '一般';
    tabGen.dataset.active = '1';

    const tabGuard = document.createElement('button');
    tabGuard.type = 'button';
    tabGuard.className = 'dba-ae-tab';
    tabGuard.id = 'dba-ae-tab-guard';
    tabGuard.textContent = '警備員だけ';
    tabGuard.dataset.active = '0';

    tabs.appendChild(tabGen);
    tabs.appendChild(tabGuard);
    mid.appendChild(tabs);

    // main wrap
    const wrap = document.createElement('div');
    wrap.className = 'dba-ae-wrap';
    wrap.id = 'dba-ae-wrap';

    // left pane (keys)
    const lp = document.createElement('div');
    lp.className = 'dba-ae-leftpane';
    lp.id = 'dba-ae-leftpane';

    // right pane (3 zones)
    const rp = document.createElement('div');
    rp.className = 'dba-ae-rpane';

    const leftBox = document.createElement('div');
    leftBox.className = 'dba-ae-box';
    leftBox.id = 'dba-ae-leftbox';

    const midBtns = document.createElement('div');
    midBtns.className = 'dba-ae-midbtns';

    const rightBox = document.createElement('div');
    rightBox.className = 'dba-ae-box';
    rightBox.id = 'dba-ae-rightbox';

    rp.appendChild(leftBox);
    rp.appendChild(midBtns);
    rp.appendChild(rightBox);

    wrap.appendChild(lp);
    wrap.appendChild(rp);
    mid.appendChild(wrap);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';
    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'dba-btn-close';
    btnClose.textContent = 'Close';
    bot.appendChild(btnClose);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }

    btnX.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    btnClose.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    btnCancel.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });
  }

  // =========================
  // オート装備：オプションモーダル
  //  - 「装備変更完了通知を * 秒で自動的に閉じる」をこちらへ移設
  //  - 「一番上の装備候補を常に優先する」チェックを追加
  // =========================
  function buildAutoEquipOptionsModal(){
    if(document.getElementById('dba-m-auto-equip-opt')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-auto-equip-opt';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';

    const title = document.createElement('div');
    title.className = 'dba-modal__title';
    title.textContent = 'オート装備：オプション';

    const btnX = document.createElement('button');
    btnX.type = 'button';
    btnX.className = 'dba-btn-x';
    btnX.textContent = '×';

    top.appendChild(title);
    top.appendChild(btnX);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    // (1) 「一番上の装備候補を常に優先する」
    const preferWrap = document.createElement('label');
    preferWrap.className = 'dba-ae-opt-row';
    preferWrap.id = 'dba-ae-opt-preferTop-wrap';

    const preferChk = document.createElement('input');
    preferChk.type = 'checkbox';
    preferChk.id = 'dba-ae-opt-preferTop';

    const preferText = document.createElement('span');
    preferText.innerText = '一番上のプリセットを最優先する。\n（装備を変更して戦闘したら、次回に自動で戻す）';

    preferWrap.appendChild(preferChk);
    preferWrap.appendChild(preferText);
    mid.appendChild(preferWrap);

    // (2) 装備変更完了通知の自動クローズ
    const acRow = document.createElement('div');
    acRow.className = 'dba-ae-opt-row';

    const acChk = document.createElement('input');
    acChk.type = 'checkbox';
    acChk.id = 'dba-ae-opt-autoclose-chk';

    const acText1 = document.createElement('span');
    acText1.textContent = '装備変更完了通知を';

    const acSec = document.createElement('input');
    acSec.type = 'number';
    acSec.min = '0.1';
    acSec.max = '60';
    acSec.step = '0.1';
    acSec.id = 'dba-ae-opt-autoclose-sec';

    const acText2 = document.createElement('span');
    acText2.textContent = '秒で自動的に閉じる。';

    acRow.appendChild(acChk);
    acRow.appendChild(acText1);
    acRow.appendChild(acSec);
    acRow.appendChild(acText2);
    mid.appendChild(acRow);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';

    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'dba-btn-close';
    btnClose.textContent = 'Close';
    bot.appendChild(btnClose);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }

    btnX.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    btnClose.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });

    // 初期値反映 & 保存（常時同期）
    preferChk.checked = loadAutoEquipPreferTopEnabled();
    preferChk.addEventListener('change', (e) => {
      e.stopPropagation();
      saveAutoEquipPreferTopEnabled(!!preferChk.checked);
    });

    acChk.checked = loadAutoEquipNotifyAutoCloseEnabled();
    acChk.addEventListener('change', (e) => {
      e.stopPropagation();
      saveAutoEquipNotifyAutoCloseEnabled(!!acChk.checked);
    });

    acSec.value = formatAutoEquipNotifyAutoCloseSec(loadAutoEquipNotifyAutoCloseSec());

    function commitAutoEquipNotifyAutoCloseSecValue(normalizeDisplay){
      const raw = String(acSec.value || '').trim();

      if(raw === ''){
        if(normalizeDisplay){
          acSec.value = formatAutoEquipNotifyAutoCloseSec(loadAutoEquipNotifyAutoCloseSec());
        }
        return;
      }

      if(!/^\d+(?:\.\d*)?$/.test(raw)){
        if(normalizeDisplay){
          acSec.value = formatAutoEquipNotifyAutoCloseSec(loadAutoEquipNotifyAutoCloseSec());
        }
        return;
      }

      const num = Number(raw);
      if(!Number.isFinite(num)){
        if(normalizeDisplay){
          acSec.value = formatAutoEquipNotifyAutoCloseSec(loadAutoEquipNotifyAutoCloseSec());
        }
        return;
      }

      saveAutoEquipNotifyAutoCloseSec(num);

      if(normalizeDisplay){
        acSec.value = formatAutoEquipNotifyAutoCloseSec(loadAutoEquipNotifyAutoCloseSec());
      }
    }

    acSec.addEventListener('input', (e) => {
      e.stopPropagation();
      commitAutoEquipNotifyAutoCloseSecValue(false);
    });

    acSec.addEventListener('change', (e) => {
      e.stopPropagation();
      commitAutoEquipNotifyAutoCloseSecValue(true);
    });

    acSec.addEventListener('blur', (e) => {
      e.stopPropagation();
      commitAutoEquipNotifyAutoCloseSecValue(true);
    });
  }

  function openAutoEquipOptionsModal(){
    buildAutoEquipOptionsModal();
    const dlg = document.getElementById('dba-m-auto-equip-opt');
    if(!dlg) return;

    // 開くたびに最新値を反映
    const preferChk = dlg.querySelector('#dba-ae-opt-preferTop');
    const acChk = dlg.querySelector('#dba-ae-opt-autoclose-chk');
    const acSec = dlg.querySelector('#dba-ae-opt-autoclose-sec');
    if(preferChk) preferChk.checked = loadAutoEquipPreferTopEnabled();
    if(acChk) acChk.checked = loadAutoEquipNotifyAutoCloseEnabled();
    if(acSec) acSec.value = String(loadAutoEquipNotifyAutoCloseSec());

    try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
  }

  function openAutoEquipSettingsModal(){
    const openNow = () => {
      buildAutoEquipSettingsModal();

      const dlg = document.getElementById('dba-m-auto-equip');
      const lp = document.getElementById('dba-ae-leftpane');
      const leftBox = document.getElementById('dba-ae-leftbox');
      const rightBox = document.getElementById('dba-ae-rightbox');
      const tabGen = document.getElementById('dba-ae-tab-general');
      const tabGuard = document.getElementById('dba-ae-tab-guard');
      const btnDecide = document.getElementById('dba-ae-btn-decide');
      const btnOpt = document.getElementById('dba-ae-btn-option');
      if(!dlg || !lp || !leftBox || !rightBox || !tabGen || !tabGuard || !btnDecide) return;

      // オプションボタン：オート装備オプションmodalを開く
      if(btnOpt){
        btnOpt.onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          openAutoEquipOptionsModal();
        };
      }

      // 仮保持（モーダル内で維持）
      const saved = loadAutoEquipCandidates();
      const temp = JSON.parse(JSON.stringify(saved || {})); // deep-ish

      // state
      let activeTab = 'general';
      let activeKey = AE_KEYS_GENERAL[0];
      let selectedLeftPreset = '';
      let selectedRightPreset = '';

      function setTab(tab){
        activeTab = tab;
        tabGen.dataset.active = (tab === 'general') ? '1' : '0';
        tabGuard.dataset.active = (tab === 'guard') ? '1' : '0';
        const keys = (tab === 'general') ? AE_KEYS_GENERAL : AE_KEYS_GUARD;
        // activeKeyがタブ外なら先頭へ
        if(!keys.includes(activeKey)) activeKey = keys[0];
        renderLeftPaneKeys();
        renderThreeZones();
      }

      function renderLeftPaneKeys(){
        const keys = (activeTab === 'general') ? AE_KEYS_GENERAL : AE_KEYS_GUARD;
        lp.textContent = '';
        for(const k of keys){
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'dba-btn-mini';
          b.textContent = k;
          b.dataset.key = k;
          if(k === activeKey){
            b.style.outline = '3px solid #ea0000';
            b.style.outlineOffset = '0px';
            b.style.background = '#fff2f2';
          }
          b.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            activeKey = k;
            selectedLeftPreset = '';
            selectedRightPreset = '';
            renderLeftPaneKeys();
            renderThreeZones();
          });
          lp.appendChild(b);
        }
      }

      function getRosterPresetNames(){
        const { roster } = getActiveRoster();
        const presets = roster && roster.presets ? roster.presets : {};
        const order = Array.isArray(roster && roster.presetOrder) ? roster.presetOrder : [];
        const seen = new Set();
        const names = [];
        for(const nm of order){
          if(!nm) continue;
          if(seen.has(nm)) continue;
          if(Object.prototype.hasOwnProperty.call(presets, nm)){
            names.push(nm);
            seen.add(nm);
          }
        }
        for(const nm of Object.keys(presets)){
          if(seen.has(nm)) continue;
          names.push(nm);
          seen.add(nm);
        }
        return names;
      }

      function ensureListForKey(k){
        if(!Array.isArray(temp[k])) temp[k] = [];
        // 重複除去
        const seen = new Set();
        temp[k] = temp[k].map(x => sanitizeText(x)).filter(Boolean).filter(x => (seen.has(x) ? false : (seen.add(x), true)));
        return temp[k];
      }

      function renderThreeZones(){
        // (A) 左ゾーン：activeKey の候補リスト
        const list = ensureListForKey(activeKey);

        leftBox.textContent = '';
        const lt = document.createElement('div');
        lt.className = 'dba-ae-box-title';
        lt.textContent = `候補（${activeKey}）`;
        leftBox.appendChild(lt);

        if(list.length === 0){
          const empty = document.createElement('div');
          empty.style.fontWeight = '800';
          empty.style.padding = '8px 2px';
          empty.style.textAlign = 'left';
          empty.textContent = '（未登録）';
          leftBox.appendChild(empty);
        }else{
          for(const nm of list){
            const it = document.createElement('div');
            it.className = 'dba-ae-item';
            it.dataset.name = nm;
            it.dataset.selected = (nm === selectedLeftPreset) ? '1' : '0';
            it.textContent = nm;
            it.addEventListener('click', (e) => {
              e.preventDefault(); e.stopPropagation();
              selectedLeftPreset = nm;
              renderThreeZones();
            });
            leftBox.appendChild(it);
          }
        }

        // (B) 中央ゾーン：ボタン4つ
        const midBtns = leftBox.nextElementSibling; // gridの2列目
        if(midBtns){
          midBtns.textContent = '';

          const mkMid = (label, id, danger) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = danger ? 'dba-btn-mini dba-btn-mini--danger' : 'dba-btn-mini';
            b.textContent = label;
            b.id = id;
            return b;
          };
          const bUp = mkMid('上げる','dba-ae-btn-up');
          const bDown = mkMid('下げる','dba-ae-btn-down');
          const bAdd = mkMid('←追加','dba-ae-btn-add', false);
          const bRem = mkMid('外す→','dba-ae-btn-rem', true);

          midBtns.appendChild(bUp);
          midBtns.appendChild(bDown);
          midBtns.appendChild(bAdd);
          midBtns.appendChild(bRem);

          bAdd.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const nm = sanitizeText(selectedRightPreset);
            if(!nm) return;
            const arr = ensureListForKey(activeKey);
            if(arr.includes(nm)) return;
            arr.push(nm);
            selectedLeftPreset = nm;
            renderThreeZones();
          });

          bRem.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const nm = sanitizeText(selectedLeftPreset);
            if(!nm) return;
            const arr = ensureListForKey(activeKey);
            const idx = arr.indexOf(nm);
            if(idx < 0) return;
            arr.splice(idx, 1);
            selectedLeftPreset = '';
            renderThreeZones();
          });

          bUp.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const nm = sanitizeText(selectedLeftPreset);
            if(!nm) return;
            const arr = ensureListForKey(activeKey);
            const idx = arr.indexOf(nm);
            if(idx <= 0) return;
            const tmp = arr[idx-1];
            arr[idx-1] = arr[idx];
            arr[idx] = tmp;
            renderThreeZones();
          });

          bDown.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const nm = sanitizeText(selectedLeftPreset);
            if(!nm) return;
            const arr = ensureListForKey(activeKey);
            const idx = arr.indexOf(nm);
            if(idx < 0 || idx >= arr.length-1) return;
            const tmp = arr[idx+1];
            arr[idx+1] = arr[idx];
            arr[idx] = tmp;
            renderThreeZones();
          });
        }

        // (C) 右ゾーン：ロスターのプリセット一覧（名前だけ）
        const rnames = getRosterPresetNames();
        rightBox.textContent = '';
        const rt = document.createElement('div');
        rt.className = 'dba-ae-box-title';
        rt.textContent = 'プリセット（装備ロスター）';
        rightBox.appendChild(rt);

        if(rnames.length === 0){
          const empty2 = document.createElement('div');
          empty2.style.fontWeight = '800';
          empty2.style.padding = '8px 2px';
          empty2.style.textAlign = 'left';
          empty2.textContent = 'プリセットがありません。';
          rightBox.appendChild(empty2);
        }else{
          for(const nm of rnames){
            const it = document.createElement('div');
            it.className = 'dba-ae-item';
            it.dataset.name = nm;
            it.dataset.selected = (nm === selectedRightPreset) ? '1' : '0';
            it.textContent = nm;
            it.addEventListener('click', (e) => {
              e.preventDefault(); e.stopPropagation();
              selectedRightPreset = nm;
              renderThreeZones();
            });
            rightBox.appendChild(it);
          }
        }
      }

      // Tabs
      tabGen.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setTab('general'); };
      tabGuard.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setTab('guard'); };

      // 決定＝保存
      btnDecide.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        // 空配列は保存しても良いが、念のため整形
        const out = {};
        for(const k of [...AE_KEYS_GENERAL, ...AE_KEYS_GUARD]){
          const arr = Array.isArray(temp[k]) ? temp[k].map(x => sanitizeText(x)).filter(Boolean) : [];
          // 重複除去
          const seen = new Set();
          const uniq = [];
          for(const nm of arr){
            if(seen.has(nm)) continue;
            seen.add(nm);
            uniq.push(nm);
          }
          out[k] = uniq;
        }
        saveAutoEquipCandidates(out);
        alert('保存しました。');
      };

      // 初期描画
      setTab('general');

      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
    };

    if(document.body) openNow();
    else document.addEventListener('DOMContentLoaded', openNow, { once:true });
  }

  // ---- 名前変更 modal ----
  function openRosterRenameModal(currentTitle, onOK){
    const ensure = () => {
      if(document.getElementById('dba-m-roster-rename')) return;
      const dlg = document.createElement('dialog');
      dlg.id = 'dba-m-roster-rename';
      dlg.className = 'dba-m-std';

      const top = document.createElement('div');
      top.className = 'dba-modal__top';
      const t = document.createElement('div');
      t.className = 'dba-modal__title';
      t.textContent = '名前変更';
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'dba-btn-x';
      x.textContent = '×';
      top.appendChild(t); top.appendChild(x);

      const mid = document.createElement('div');
      mid.className = 'dba-modal__mid';
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'dba-roster-rename-input';
      input.className = 'dba-add-name';
      input.value = currentTitle || '';
      mid.appendChild(input);

      const bot = document.createElement('div');
      bot.className = 'dba-modal__bot';
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'dba-btn-ok';
      ok.textContent = 'OK';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'dba-btn-close';
      cancel.textContent = 'Cancel';
      bot.appendChild(ok); bot.appendChild(cancel);

      dlg.appendChild(top); dlg.appendChild(mid); dlg.appendChild(bot);
      document.body.appendChild(dlg);

      function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }
      x.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
      cancel.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
      dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });
      ok.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        const v = document.getElementById('dba-roster-rename-input')?.value || '';
        try{ onOK && onOK(v); }catch(_e2){}
        closeDirect();
      });
    };

    const openNow = () => {
      ensure();
      const dlg = document.getElementById('dba-m-roster-rename');
      const input = document.getElementById('dba-roster-rename-input');
      if(input) input.value = currentTitle || '';
      if(dlg){
        try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
        try{ input && input.focus(); input && input.select(); }catch(_e2){}
      }
    };
    if(document.body) openNow(); else document.addEventListener('DOMContentLoaded', openNow, { once:true });
  }

  // ---- 全削除（ロスター削除） modal ----
  function openRosterWipeModal(onWipe){
    const ensure = () => {
      if(document.getElementById('dba-m-roster-wipe')) return;
      const dlg = document.createElement('dialog');
      dlg.id = 'dba-m-roster-wipe';
      dlg.className = 'dba-m-std';

      const top = document.createElement('div');
      top.className = 'dba-modal__top';
      const t = document.createElement('div');
      t.className = 'dba-modal__title';
      t.textContent = '全削除';
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'dba-btn-x';
      x.textContent = '×';
      top.appendChild(t); top.appendChild(x);

      const mid = document.createElement('div');
      mid.className = 'dba-modal__mid';
      const msg = document.createElement('div');
      msg.style.fontWeight = '800';
      msg.style.marginBottom = '10px';
      msg.style.textAlign = 'left';
      msg.textContent = '現在読み込んでいる「装備ロスター」データを削除します。よろしいですか？';
      const chkRow = document.createElement('label');
      chkRow.style.display = 'flex';
      chkRow.style.gap = '8px';
      chkRow.style.alignItems = 'center';
      chkRow.style.fontWeight = '800';
      chkRow.style.textAlign = 'left';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.id = 'dba-roster-wipe-chk';
      const span = document.createElement('span');
      span.textContent = '削除することを確認しました';
      chkRow.appendChild(chk); chkRow.appendChild(span);
      mid.appendChild(msg);
      mid.appendChild(chkRow);

      const bot = document.createElement('div');
      bot.className = 'dba-modal__bot';
      const wipe = document.createElement('button');
      wipe.type = 'button';
      wipe.className = 'dba-btn-del';
      wipe.textContent = '装備ロスターを削除';
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'dba-btn-ok';
      back.textContent = 'やめる';
      bot.appendChild(wipe); bot.appendChild(back);

      dlg.appendChild(top); dlg.appendChild(mid); dlg.appendChild(bot);
      document.body.appendChild(dlg);

      function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }
      x.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
      back.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
      dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });
      wipe.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        const c = document.getElementById('dba-roster-wipe-chk');
        if(!c || !c.checked){
          alert('確認チェックを入れてください。');
          return;
        }
        try{ onWipe && onWipe(); }catch(_e2){}
        closeDirect();
      });
    };

    const openNow = () => {
      ensure();
      const chk = document.getElementById('dba-roster-wipe-chk');
      if(chk) chk.checked = false;
      const dlg = document.getElementById('dba-m-roster-wipe');
      if(dlg){
        try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
      }
    };
    if(document.body) openNow(); else document.addEventListener('DOMContentLoaded', openNow, { once:true });
  }

  // ---- 装備ロスター バックアップ helper ----
  function buildRosterBackupJsonObject(roster){
    const r = roster || {};
    const orderedPresets = rebuildPresetMapByOrder(
      (r.presets && typeof r.presets === 'object') ? r.presets : {},
      Array.isArray(r.presetOrder) ? r.presetOrder : []
    );
    return {
      gen: DBA_SAVE_GEN_CURRENT,
      title: sanitizeText(r.title || ''),
      createdAt: normalizeRosterDateTimeValue(r.createdAt, ''),
      updatedAt: normalizeRosterDateTimeValue(r.updatedAt, ''),
      presets: orderedPresets,
      autoEquip: (r.autoEquip && typeof r.autoEquip === 'object')
        ? r.autoEquip
        : { candidates: {}, lastPreset: '' }
    };
  }

  function stringifyRosterBackupObject(obj){
    try{
      let text = JSON.stringify(obj, null, 2);
      text = text.replace(
        /\[\s*\n\s*(null|\d+)\s*,\s*\n\s*(null|\d+)\s*,\s*\n\s*(null|\d+)\s*\n\s*\]/g,
        '[$1,$2,$3]'
      );
      return text;
    }catch(_e){
      return '';
    }
  }

  function parseRosterBackupObject(text){
    const obj = JSON.parse(String(text || ''));
    if(!obj || typeof obj !== 'object') throw new Error('Invalid JSON object');
    return obj;
  }

  function rosterDateTimeToMs(v){
    const s = normalizeRosterDateTimeValue(v, '');
    if(!s) return 0;
    const t = Date.parse(s.replace(' ', 'T'));
    return Number.isFinite(t) ? t : 0;
  }

  function cloneJsonSafe(obj){
    try{
      return JSON.parse(JSON.stringify(obj));
    }catch(_e){
      return null;
    }
  }

  function sanitizeFileNamePart(s){
    const raw = sanitizeText(s || '') || 'roster';
    return raw.replace(/[\\\/:*?"<>|]/g, '_');
  }

  function downloadRosterJsonFile(obj, fallbackTitle){
    const title = sanitizeFileNamePart((obj && obj.title) || fallbackTitle || 'roster');
    const stamp = normalizeRosterDateTimeValue((obj && obj.updatedAt) || nowIso(), nowIso())
      .replace(/[: ]/g, '-');
    const filename = `${title}_${stamp}.json`;
    const text = stringifyRosterBackupObject(obj);
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try{
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }finally{
      setTimeout(() => {
        try{ URL.revokeObjectURL(url); }catch(_e){}
      }, 1000);
    }
  }

  function chooseJsonFileFromDisk(){
    return new Promise((resolve, reject) => {
      try{
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.style.display = 'none';
        document.body.appendChild(input);

        const cleanup = () => {
          try{ input.remove(); }catch(_e){}
        };

        input.addEventListener('change', async () => {
          try{
            const file = input.files && input.files[0] ? input.files[0] : null;
            cleanup();
            if(!file){
              reject(new Error('NO_FILE'));
              return;
            }
            const text = await file.text();
            resolve({ file, text });
          }catch(err){
            cleanup();
            reject(err);
          }
        }, { once:true });

        input.click();
      }catch(err){
        reject(err);
      }
    });
  }

  function getAllRosterEntriesForUi(){
    const store = loadRosterStore();
    const ids = Object.keys(store.rosters || {});
    return ids.map((id) => {
      const r = store.rosters[id] || {};
      return {
        id,
        title: sanitizeText(r.title || ''),
        updatedAt: normalizeRosterDateTimeValue(r.updatedAt, ''),
        createdAt: normalizeRosterDateTimeValue(r.createdAt, '')
      };
    });
  }

  function makeRosterUniqueTitle(baseTitle, excludeId){
    const store = loadRosterStore();
    const used = new Set();
    for(const id of Object.keys(store.rosters || {})){
      if(excludeId && id === excludeId) continue;
      const t = sanitizeText(store.rosters[id]?.title || '');
      if(t) used.add(t);
    }
    const base = sanitizeText(baseTitle || '') || `装備ロスター_${yyyymmddLocal()}`;
    if(!used.has(base)) return base;
    let i = 2;
    while(used.has(`${base} (${i})`)) i++;
    return `${base} (${i})`;
  }

  function buildNormalizedRosterFromBackupObject(obj, opt = {}){
    if(!obj || typeof obj !== 'object') throw new Error('Invalid JSON object');
    const fallbackTitle = sanitizeText(opt.fallbackTitle || `装備ロスター_${yyyymmddLocal()}`);
    const title = sanitizeText(obj.title || fallbackTitle) || fallbackTitle;
    const createdAtIn = normalizeRosterDateTimeValue(obj.createdAt, '');
    const updatedAtIn = normalizeRosterDateTimeValue(obj.updatedAt, '');
    const presets = (obj.presets && typeof obj.presets === 'object') ? obj.presets : {};
    const aeIn = (obj.autoEquip && typeof obj.autoEquip === 'object') ? obj.autoEquip : null;
    const aeCandidates = (aeIn && aeIn.candidates && typeof aeIn.candidates === 'object') ? aeIn.candidates : {};
    const aeLast = (aeIn && typeof aeIn.lastPreset === 'string') ? aeIn.lastPreset : '';
    validatePresetNamesFromPresetObject(presets);

    const cleaned = {};
    const order = [];
    for(const k of Object.keys(presets)){
      const name = sanitizeText(k);
      if(!name) continue;
      const v = presets[k];
      if(!Array.isArray(v) || v.length !== 3) continue;
      cleaned[name] = [
        (v[0] === null || Number.isFinite(Number(v[0]))) ? (v[0] === null ? null : Number(v[0])) : null,
        (v[1] === null || Number.isFinite(Number(v[1]))) ? (v[1] === null ? null : Number(v[1])) : null,
        (v[2] === null || Number.isFinite(Number(v[2]))) ? (v[2] === null ? null : Number(v[2])) : null
      ];
      order.push(name);
    }

    return {
      title,
      createdAt: createdAtIn || nowIso(),
      updatedAt: updatedAtIn || nowIso(),
      presets: cleaned,
      presetOrder: order,
      autoEquip: {
        candidates: aeCandidates,
        lastPreset: String(aeLast || '')
      }
    };
  }

  function installRosterBackupObjectAsSeparate(obj){
    const store = loadRosterStore();
    const normalized = buildNormalizedRosterFromBackupObject(obj);
    const id = `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    store.rosters[id] = {
      id,
      title: makeRosterUniqueTitle(normalized.title),
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
      presets: normalized.presets,
      presetOrder: normalized.presetOrder,
      autoEquip: normalized.autoEquip
    };
    store.gen = DBA_SAVE_GEN_CURRENT;
    saveRosterStore(store);
    return id;
  }

  function closeDialogById(id){
    const dlg = document.getElementById(id);
    if(!dlg) return;
    try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
  }

  function ensureRosterBackupEditorModal(){
    if(document.getElementById('dba-m-roster-backup-editor')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-roster-backup-editor';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';
    const t = document.createElement('div');
    t.className = 'dba-modal__title';
    t.textContent = 'ファイルを直接編集';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'dba-btn-x';
    x.textContent = '×';
    top.appendChild(t); top.appendChild(x);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';
    const ta = document.createElement('textarea');
    ta.id = 'dba-roster-backup-editor-ta';
    ta.className = 'dba-backup-textarea';
    mid.appendChild(ta);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'dba-btn-apply';
    save.textContent = '保存';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'dba-btn-close';
    cancel.textContent = 'Cancel';
    bot.appendChild(save); bot.appendChild(cancel);

    dlg.appendChild(top); dlg.appendChild(mid); dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }
    x.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    cancel.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });
  }

  function openRosterBackupEditorModal(onDone){
    const openNow = () => {
      ensureRosterBackupEditorModal();
      const { roster } = getActiveRoster();
      const obj = buildRosterBackupJsonObject(roster);
      const ta = document.getElementById('dba-roster-backup-editor-ta');
      const dlg = document.getElementById('dba-m-roster-backup-editor');
      if(ta) ta.value = stringifyRosterBackupObject(obj);
      if(!dlg) return;

      const save = dlg.querySelector('.dba-btn-apply');
      if(save){
        save.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          let text = document.getElementById('dba-roster-backup-editor-ta')?.value || '';
          try{
            if(findDuplicatePresetNamesInBackupText(text).length > 0){
              text = await resolveDuplicatePresetNamesInBackupTextViaModal(text);
              const ta2 = document.getElementById('dba-roster-backup-editor-ta');
              if(ta2) ta2.value = text;
            }
            const parsed = parseRosterBackupObject(text);
            overwriteRosterFromObject(parsed);
            try{ onDone && onDone(); }catch(_e2){}
            closeDialogById('dba-m-roster-backup-editor');
          }catch(_e2){
            const msg = String(_e2 && _e2.message ? _e2.message : 'JSONの解析に失敗しました。');
            if(msg !== 'キャンセルしました。'){
              alert(msg);
            }
          }
        };
      }

      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
    };
    if(document.body) openNow(); else document.addEventListener('DOMContentLoaded', openNow, { once:true });
  }

  function ensureRosterExportPickModal(){
    if(document.getElementById('dba-m-roster-export-pick')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-roster-export-pick';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';
    const t = document.createElement('div');
    t.className = 'dba-modal__title';
    t.textContent = 'エクスポートする装備ロスターを選択';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'dba-btn-x';
    x.textContent = '×';
    top.appendChild(t); top.appendChild(x);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';
    const list = document.createElement('div');
    list.id = 'dba-roster-export-pick-list';
    list.className = 'dba-roster-list';
    mid.appendChild(list);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'dba-btn-apply';
    ok.textContent = '決定';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'dba-btn-close';
    cancel.textContent = 'Cancel';
    bot.appendChild(ok); bot.appendChild(cancel);

    dlg.appendChild(top); dlg.appendChild(mid); dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }
    x.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    cancel.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });
  }

  function openRosterExportPickModal(onDone){
    const openNow = () => {
      ensureRosterExportPickModal();
      const dlg = document.getElementById('dba-m-roster-export-pick');
      const list = document.getElementById('dba-roster-export-pick-list');
      if(!dlg || !list) return;

      const store = loadRosterStore();
      const ids = Object.keys(store.rosters || {});
      let selectedId = ids.includes(store.activeId) ? store.activeId : (ids[0] || '');

      list.textContent = '';
      for(const id of ids){
        const r = store.rosters[id] || {};
        const item = document.createElement('div');
        item.className = 'dba-roster-item';
        item.dataset.id = id;
        item.dataset.selected = (id === selectedId) ? '1' : '0';

        const n = document.createElement('div');
        n.className = 'dba-roster-item__name';
        n.textContent = sanitizeText(r.title || '(無題)');

        const m = document.createElement('div');
        m.className = 'dba-roster-item__meta';
        m.textContent = normalizeRosterDateTimeValue(r.updatedAt, '');

        item.appendChild(n);
        item.appendChild(m);
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectedId = id;
          for(const el of list.querySelectorAll('.dba-roster-item')){
            el.dataset.selected = (el.dataset.id === selectedId) ? '1' : '0';
          }
        });
        list.appendChild(item);
      }

      const ok = dlg.querySelector('.dba-btn-apply');
      if(ok){
        ok.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if(!selectedId || !store.rosters[selectedId]){
            alert('装備ロスターを選択してください。');
            return;
          }
          const obj = buildRosterBackupJsonObject(store.rosters[selectedId]);
          downloadRosterJsonFile(obj, store.rosters[selectedId].title);
          try{ onDone && onDone(); }catch(_e2){}
          closeDialogById('dba-m-roster-export-pick');
        };
      }

      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
    };
    if(document.body) openNow(); else document.addEventListener('DOMContentLoaded', openNow, { once:true });
  }

  function ensureRosterImportConflictModal(){
    if(document.getElementById('dba-m-roster-import-conflict')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-roster-import-conflict';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';
    const t = document.createElement('div');
    t.className = 'dba-modal__title';
    t.textContent = 'インポート方法を選択';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'dba-btn-x';
    x.textContent = '×';
    top.appendChild(t); top.appendChild(x);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = '1fr 1fr';
    wrap.style.gap = '10px';

    const curBox = document.createElement('div');
    curBox.id = 'dba-roster-import-cur';
    curBox.className = 'dba-roster-item';
    curBox.style.display = 'block';
    curBox.style.cursor = 'pointer';

    const impBox = document.createElement('div');
    impBox.id = 'dba-roster-import-imp';
    impBox.className = 'dba-roster-item';
    impBox.style.display = 'block';
    impBox.style.cursor = 'pointer';

    wrap.appendChild(curBox);
    wrap.appendChild(impBox);
    mid.appendChild(wrap);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';
    bot.style.flexWrap = 'wrap';

    const btnNew = document.createElement('button');
    btnNew.type = 'button';
    btnNew.className = 'dba-btn-ok';
    btnNew.innerHTML = '別データとして<br>インストール';
    btnNew.style.width = '8.5em';

    const btnOverwrite = document.createElement('button');
    btnOverwrite.type = 'button';
    btnOverwrite.className = 'dba-btn-apply';
    btnOverwrite.innerHTML = '上書きして<br>インストール';
    btnOverwrite.style.width = '8.5em';

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'dba-btn-close';
    btnCancel.textContent = 'Cancel';

    bot.appendChild(btnNew);
    bot.appendChild(btnOverwrite);
    bot.appendChild(btnCancel);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }
    x.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    btnCancel.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });
  }

  function openRosterImportConflictModal(activeRosterObj, importedObj, onDone){
    const openNow = () => {
      ensureRosterImportConflictModal();
      const dlg = document.getElementById('dba-m-roster-import-conflict');
      const curBox = document.getElementById('dba-roster-import-cur');
      const impBox = document.getElementById('dba-roster-import-imp');
      if(!dlg || !curBox || !impBox) return;

      let selectedSide = 'imported';
      const renderSideSelection = () => {
        curBox.dataset.selected = (selectedSide === 'current') ? '1' : '0';
        impBox.dataset.selected = (selectedSide === 'imported') ? '1' : '0';
      };

      curBox.textContent = '';
      impBox.textContent = '';

      const curName = document.createElement('div');
      curName.className = 'dba-roster-item__name';
      curName.textContent = `展開中\n${sanitizeText(activeRosterObj.title || '(無題)')}`;
      const curMeta = document.createElement('div');
      curMeta.className = 'dba-roster-item__meta';
      curMeta.style.marginTop = '8px';
      curMeta.textContent = normalizeRosterDateTimeValue(activeRosterObj.updatedAt, '');
      curBox.appendChild(curName);
      curBox.appendChild(curMeta);

      const impName = document.createElement('div');
      impName.className = 'dba-roster-item__name';
      impName.textContent = `インポート予定\n${sanitizeText(importedObj.title || '(無題)')}`;
      const impMeta = document.createElement('div');
      impMeta.className = 'dba-roster-item__meta';
      impMeta.style.marginTop = '8px';
      impMeta.textContent = normalizeRosterDateTimeValue(importedObj.updatedAt, '');
      impBox.appendChild(impName);
      impBox.appendChild(impMeta);

      curBox.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectedSide = 'current';
        renderSideSelection();
      };
      impBox.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectedSide = 'imported';
        renderSideSelection();
      };
      renderSideSelection();

      const btns = dlg.querySelectorAll('.dba-modal__bot button');
      const btnNew = btns[0];
      const btnOverwrite = btns[1];
      if(btnNew){
        btnNew.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if(!selectedSide){
            alert('どちらかを選択してください。');
            return;
          }
          installRosterBackupObjectAsSeparate(importedObj);
          try{ onDone && onDone(); }catch(_e2){}
          closeDialogById('dba-m-roster-import-conflict');
        };
      }
      if(btnOverwrite){
        btnOverwrite.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if(!selectedSide){
            alert('どちらかを選択してください。');
            return;
          }
          overwriteRosterFromObject(importedObj);
          try{ onDone && onDone(); }catch(_e2){}
          closeDialogById('dba-m-roster-import-conflict');
        };
      }

      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
    };
    if(document.body) openNow(); else document.addEventListener('DOMContentLoaded', openNow, { once:true });
  }

  function exportRosterViaUi(onDone){
    const store = loadRosterStore();
    const ids = Object.keys(store.rosters || {});
    if(ids.length <= 0){
      alert('装備ロスターがありません。');
      return;
    }
    if(ids.length === 1){
      const only = store.rosters[ids[0]];
      downloadRosterJsonFile(buildRosterBackupJsonObject(only), only.title);
      try{ onDone && onDone(); }catch(_e){}
      return;
    }
    openRosterExportPickModal(onDone);
  }

  async function importRosterViaUi(onDone){
    let picked;
    try{
      picked = await chooseJsonFileFromDisk();
    }catch(err){
      if(err && String(err.message || err) === 'NO_FILE') return;
      alert('ファイルの読み込みに失敗しました。');
      return;
    }

    let importedObj;
    try{
      let text = String(picked.text || '');
      if(findDuplicatePresetNamesInBackupText(text).length > 0){
        text = await resolveDuplicatePresetNamesInBackupTextViaModal(text);
      }
      importedObj = parseRosterBackupObject(text);
    }catch(_e){
      const msg = String(_e && _e.message ? _e.message : 'JSONの解析に失敗しました。');
      if(msg !== 'キャンセルしました。'){
        alert(msg);
      }
      return;
    }

    const { roster } = getActiveRoster();
    const activeObj = buildRosterBackupJsonObject(roster);
    const activeName = sanitizeText(activeObj.title || '');
    const importedName = sanitizeText(importedObj.title || '');
    const activeMs = rosterDateTimeToMs(activeObj.updatedAt);
    const importedMs = rosterDateTimeToMs(importedObj.updatedAt);

    const needConfirm =
      (activeName !== importedName) ||
      (importedMs > 0 && activeMs > 0 && importedMs < activeMs);

    if(needConfirm){
      openRosterImportConflictModal(activeObj, importedObj, onDone);
      return;
    }

    overwriteRosterFromObject(importedObj);
    try{ onDone && onDone(); }catch(_e){}
  }

  function ensureRosterOptionsModal(){
    if(document.getElementById('dba-m-roster-option')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-roster-option';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';
    const t = document.createElement('div');
    t.className = 'dba-modal__title';
    t.textContent = '装備ロスター：オプション';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'dba-btn-x';
    x.textContent = '×';
    top.appendChild(t);
    top.appendChild(x);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    const actionSection = document.createElement('section');
    actionSection.className = 'dba-roster-opt-section';

    const actionTitle = document.createElement('div');
    actionTitle.className = 'dba-roster-opt-section__title';
    actionTitle.textContent = 'プリセットをクリック／タップした時の動作';
    actionSection.appendChild(actionTitle);

    const actionBody = document.createElement('div');
    actionBody.className = 'dba-roster-opt-section__body';

    const actionRadioGroup = document.createElement('div');
    actionRadioGroup.className = 'dba-roster-opt-radio-group';

    const actionEquipLabel = document.createElement('label');
    actionEquipLabel.className = 'dba-roster-opt-radio-line';
    const actionEquipRadio = document.createElement('input');
    actionEquipRadio.type = 'radio';
    actionEquipRadio.name = 'dba-roster-option-preset-click-action';
    actionEquipRadio.id = 'dba-roster-option-preset-click-equip';
    actionEquipRadio.value = 'equip';
    const actionEquipText = document.createElement('span');
    actionEquipText.textContent = 'プリセットを装備';
    actionEquipLabel.appendChild(actionEquipRadio);
    actionEquipLabel.appendChild(actionEquipText);

    const actionMenuLabel = document.createElement('label');
    actionMenuLabel.className = 'dba-roster-opt-radio-line';
    const actionMenuRadio = document.createElement('input');
    actionMenuRadio.type = 'radio';
    actionMenuRadio.name = 'dba-roster-option-preset-click-action';
    actionMenuRadio.id = 'dba-roster-option-preset-click-menu';
    actionMenuRadio.value = 'menu';
    const actionMenuText = document.createElement('span');
    actionMenuText.textContent = 'メニューを展開';
    actionMenuLabel.appendChild(actionMenuRadio);
    actionMenuLabel.appendChild(actionMenuText);

    actionRadioGroup.appendChild(actionEquipLabel);
    actionRadioGroup.appendChild(actionMenuLabel);
    actionBody.appendChild(actionRadioGroup);

    const actionNote = document.createElement('p');
    actionNote.className = 'dba-roster-opt-note';
    actionNote.textContent = '「メニューを展開」を選ぶと、プリセットを クリック／タップ した時に「キャンセル・装備・再編集・複製・上に追加・下に追加・1つ上げる・1つ下げる・削除」のメニューを表示します。';
    actionBody.appendChild(actionNote);

    actionSection.appendChild(actionBody);
    mid.appendChild(actionSection);

    const rememberSection = document.createElement('section');
    rememberSection.className = 'dba-roster-opt-section';

    const rememberTitle = document.createElement('div');
    rememberTitle.className = 'dba-roster-opt-section__title';
    rememberTitle.textContent = '表示オプション';
    rememberSection.appendChild(rememberTitle);

    const rememberBody = document.createElement('div');
    rememberBody.className = 'dba-roster-opt-section__body';

    const hideMenuRow2Label = document.createElement('label');
    hideMenuRow2Label.className = 'dba-roster-opt-row';
    const hideMenuRow2Chk = document.createElement('input');
    hideMenuRow2Chk.type = 'checkbox';
    hideMenuRow2Chk.id = 'dba-roster-option-hide-menu-row2';
    const hideMenuRow2Text = document.createElement('span');
    hideMenuRow2Text.className = 'dba-roster-opt-rowtext';
    hideMenuRow2Text.textContent = '装備ロスターのメニュー2段目を隠す。';
    hideMenuRow2Label.appendChild(hideMenuRow2Chk);
    hideMenuRow2Label.appendChild(hideMenuRow2Text);
    rememberBody.appendChild(hideMenuRow2Label);

    const hideMenuRow2Note = document.createElement('p');
    hideMenuRow2Note.className = 'dba-roster-opt-note';
    hideMenuRow2Note.textContent = '2段目の「追加」「複製」…「削除」等のメニューを非表示化し、空間を詰めます。';
    rememberBody.appendChild(hideMenuRow2Note);

    const rememberLabel = document.createElement('label');
    rememberLabel.className = 'dba-roster-opt-row';
    const rememberChk = document.createElement('input');
    rememberChk.type = 'checkbox';
    rememberChk.id = 'dba-roster-option-scroll-remember';
    const rememberText = document.createElement('span');
    rememberText.className = 'dba-roster-opt-rowtext';
    rememberText.textContent = 'プリセットリストのスクロール位置を記憶する。';
    rememberLabel.appendChild(rememberChk);
    rememberLabel.appendChild(rememberText);
    rememberBody.appendChild(rememberLabel);

    const rememberNote = document.createElement('p');
    rememberNote.className = 'dba-roster-opt-note';
    rememberNote.textContent = '次に「装備ロスター」を開いた時、プリセットリストのスクロール位置を復元します。';
    rememberBody.appendChild(rememberNote);

    rememberSection.appendChild(rememberBody);

    mid.appendChild(rememberSection);

    const manageSection = document.createElement('section');
    manageSection.className = 'dba-roster-opt-section';

    const manageTitle = document.createElement('div');
    manageTitle.className = 'dba-roster-opt-section__title';
    manageTitle.textContent = '装備ロスター管理';
    manageSection.appendChild(manageTitle);

    const manageBody = document.createElement('div');
    manageBody.className = 'dba-roster-opt-section__body';

    const manageNote = document.createElement('p');
    manageNote.className = 'dba-roster-opt-note';
    manageNote.textContent = '現在読み込んでいる装備ロスターの名前変更や削除を行います。';
    manageBody.appendChild(manageNote);

    const manageWrap = document.createElement('div');
    manageWrap.className = 'dba-roster-opt-btngrid';

    const btnRename = document.createElement('button');
    btnRename.type = 'button';
    btnRename.id = 'dba-roster-option-btn-rename';
    btnRename.className = 'dba-btn-mini';
    btnRename.textContent = '名前変更';

    const btnWipe = document.createElement('button');
    btnWipe.type = 'button';
    btnWipe.id = 'dba-roster-option-btn-wipe';
    btnWipe.className = 'dba-btn-mini dba-btn-mini--danger';
    btnWipe.textContent = 'ロスター削除';

    manageWrap.appendChild(btnRename);
    manageWrap.appendChild(btnWipe);
    manageBody.appendChild(manageWrap);
    manageSection.appendChild(manageBody);
    mid.appendChild(manageSection);

    const backupSection = document.createElement('section');
    backupSection.className = 'dba-roster-opt-section';

    const backupTitle = document.createElement('div');
    backupTitle.className = 'dba-roster-opt-section__title';
    backupTitle.textContent = 'バックアップ';
    backupSection.appendChild(backupTitle);

    const backupBody = document.createElement('div');
    backupBody.className = 'dba-roster-opt-section__body';

    const backupNote = document.createElement('p');
    backupNote.className = 'dba-roster-opt-note';
    backupNote.textContent = '現在の装備ロスターを保存・復元したり、JSON を直接編集したりできます。';
    backupBody.appendChild(backupNote);

    const backupWrap = document.createElement('div');
    backupWrap.className = 'dba-roster-opt-btngrid';

    const btnExport = document.createElement('button');
    btnExport.type = 'button';
    btnExport.id = 'dba-roster-option-btn-export';
    btnExport.className = 'dba-btn-mini';
    btnExport.textContent = 'エクスポート';

    const btnImport = document.createElement('button');
    btnImport.type = 'button';
    btnImport.id = 'dba-roster-option-btn-import';
    btnImport.className = 'dba-btn-mini';
    btnImport.textContent = 'インポート';

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.id = 'dba-roster-option-btn-edit';
    btnEdit.className = 'dba-btn-mini';
    btnEdit.textContent = 'ファイルを直接編集';

    backupWrap.appendChild(btnExport);
    backupWrap.appendChild(btnImport);
    backupWrap.appendChild(btnEdit);
    backupBody.appendChild(backupWrap);
    backupSection.appendChild(backupBody);
    mid.appendChild(backupSection);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'dba-btn-close';
    cancel.textContent = 'Close';
    bot.appendChild(cancel);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){
      try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
    }
    x.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    cancel.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });
  }

  function openRosterOptionsModal(onDone){
    const openNow = () => {
      ensureRosterOptionsModal();
      const dlg = document.getElementById('dba-m-roster-option');
      if(!dlg) return;

      const btnX = dlg.querySelector('.dba-btn-x');
      const btnClose = dlg.querySelector('.dba-btn-close');
      const chkHideMenuRow2 = document.getElementById('dba-roster-option-hide-menu-row2');
      const chkRemember = document.getElementById('dba-roster-option-scroll-remember');
      const radioEquip = document.getElementById('dba-roster-option-preset-click-equip');
      const radioMenu = document.getElementById('dba-roster-option-preset-click-menu');
      const btnExport = document.getElementById('dba-roster-option-btn-export');
      const btnImport = document.getElementById('dba-roster-option-btn-import');
      const btnEdit = document.getElementById('dba-roster-option-btn-edit');
      const btnRename = document.getElementById('dba-roster-option-btn-rename');
      const btnWipe = document.getElementById('dba-roster-option-btn-wipe');

      const initialClickAction = loadRosterPresetClickAction();
      let pendingClickAction = initialClickAction;
      let pendingHideMenuRow2 = loadRosterHideMenuRow2Enabled();
      let pendingRemember = loadRosterScrollRememberEnabled();
      let appliedOnClose = false;

      const applyPendingOptions = () => {
        if(appliedOnClose) return;
        appliedOnClose = true;

        saveRosterPresetClickAction(pendingClickAction);
        saveRosterHideMenuRow2Enabled(pendingHideMenuRow2);
        saveRosterScrollRememberEnabled(pendingRemember);

        if(pendingRemember){
          const top = captureRosterListScrollState();
          saveRosterSavedScrollTop(top);
        }else{
          clearRosterSavedScrollTop();
        }

        if(typeof onDone === 'function'){
          try{ onDone(); }catch(_e){}
        }
      };

      const closeDirect = () => {
        applyPendingOptions();
        try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
      };

      const clickAction = loadRosterPresetClickAction();
      if(radioEquip) radioEquip.checked = (clickAction === 'equip');
      if(radioMenu) radioMenu.checked = (clickAction === 'menu');

      if(radioEquip){
        radioEquip.onchange = () => {
          if(radioEquip.checked){
            pendingClickAction = 'equip';
          }
        };
      }
      if(radioMenu){
        radioMenu.onchange = () => {
          if(radioMenu.checked){
            pendingClickAction = 'menu';
          }
        };
      }

      if(chkHideMenuRow2){
        chkHideMenuRow2.checked = pendingHideMenuRow2;
        chkHideMenuRow2.onchange = () => {
          pendingHideMenuRow2 = !!chkHideMenuRow2.checked;
        };
      }

      if(chkRemember){
        chkRemember.checked = pendingRemember;
        chkRemember.onchange = () => {
          pendingRemember = !!chkRemember.checked;
        };
      }

      if(btnX){
        btnX.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeDirect();
        };
      }
      if(btnClose){
        btnClose.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeDirect();
        };
      }
      dlg.oncancel = (e) => {
        e.preventDefault();
        closeDirect();
      };

      if(btnExport){
        btnExport.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          exportRosterViaUi(onDone);
        };
      }
      if(btnImport){
        btnImport.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await importRosterViaUi(onDone);
        };
      }
      if(btnEdit){
        btnEdit.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          openRosterBackupEditorModal(onDone);
        };
      }
      if(btnRename){
        btnRename.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          openRosterRenameModal(getActiveRoster().roster?.title || '', (newName) => {
            setRosterTitle(newName);
            if(typeof onDone === 'function'){
              try{ onDone(); }catch(_e){}
            }
          });
        };
      }
      if(btnWipe){
        btnWipe.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          openRosterWipeModal(() => {
            deleteActiveRosterAndSwitch();
            if(typeof onDone === 'function'){
              try{ onDone(); }catch(_e){}
            }
          });
        };
      }

      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
    };
    if(document.body) openNow(); else document.addEventListener('DOMContentLoaded', openNow, { once:true });
  }

  function ensureRosterBackupModal(){
    if(document.getElementById('dba-m-roster-backup')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-roster-backup';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';
    const t = document.createElement('div');
    t.className = 'dba-modal__title';
    t.textContent = '装備ロスター バックアップ管理';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'dba-btn-x';
    x.textContent = '×';
    top.appendChild(t); top.appendChild(x);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '12px';
    wrap.style.alignItems = 'stretch';

    const btnExport = document.createElement('button');
    btnExport.type = 'button';
    btnExport.id = 'dba-roster-backup-btn-export';
    btnExport.className = 'dba-btn-mini';
    btnExport.textContent = 'エクスポート';
    btnExport.style.padding = '12px 10px';

    const btnImport = document.createElement('button');
    btnImport.type = 'button';
    btnImport.id = 'dba-roster-backup-btn-import';
    btnImport.className = 'dba-btn-mini';
    btnImport.textContent = 'インポート';
    btnImport.style.padding = '12px 10px';

    const btnEdit = document.createElement('button');
    btnEdit.type = 'button';
    btnEdit.id = 'dba-roster-backup-btn-edit';
    btnEdit.className = 'dba-btn-mini';
    btnEdit.textContent = 'ファイルを直接編集';
    btnEdit.style.padding = '12px 10px';

    wrap.appendChild(btnExport);
    wrap.appendChild(btnImport);
    wrap.appendChild(btnEdit);
    mid.appendChild(wrap);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'dba-btn-close';
    cancel.textContent = 'Cancel';
    bot.appendChild(cancel);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }
    x.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    cancel.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });
  }

  // ---- バックアップ modal（エクスポート / インポート / 直接編集） ----
  function openRosterBackupModal(onDone){
    const openNow = () => {
      ensureRosterBackupModal();
      const dlg = document.getElementById('dba-m-roster-backup');
      if(!dlg) return;

      const btnExport = document.getElementById('dba-roster-backup-btn-export');
      const btnImport = document.getElementById('dba-roster-backup-btn-import');
      const btnEdit = document.getElementById('dba-roster-backup-btn-edit');

      if(btnExport){
        btnExport.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          exportRosterViaUi(onDone);
        };
      }
      if(btnImport){
        btnImport.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await importRosterViaUi(onDone);
        };
      }
      if(btnEdit){
        btnEdit.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          openRosterBackupEditorModal(onDone);
        };
      }

      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
    };
    if(document.body) openNow(); else document.addEventListener('DOMContentLoaded', openNow, { once:true });
  }

  // ---- プリセット追加 modal ----
  function buildRosterAddModal(){
    if(document.getElementById('dba-m-roster-add')) return;
    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-roster-add';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';
    const t = document.createElement('div');
    t.className = 'dba-modal__title';
    t.textContent = 'プリセット追加';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'dba-btn-x';
    x.textContent = '×';
    top.appendChild(t); top.appendChild(x);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    const wrap = document.createElement('div');
    wrap.className = 'dba-add-wrap';

    const left = document.createElement('div');
    left.className = 'dba-add-left';

    const btnW = document.createElement('button');
    btnW.type = 'button';
    btnW.className = 'dba-btn-mini';
    btnW.textContent = '武器';
    btnW.id = 'dba-add-btn-weapon';

    const btnA = document.createElement('button');
    btnA.type = 'button';
    btnA.className = 'dba-btn-mini';
    btnA.textContent = '防具';
    btnA.id = 'dba-add-btn-armor';

    const btnN = document.createElement('button');
    btnN.type = 'button';
    btnN.className = 'dba-btn-mini';
    btnN.textContent = 'ネックレス';
    btnN.id = 'dba-add-btn-necklace';

    left.appendChild(btnW);
    left.appendChild(btnA);
    left.appendChild(btnN);

    const right = document.createElement('div');
    right.className = 'dba-add-right';

    const selW = document.createElement('div');
    selW.className = 'dba-add-sel';
    selW.id = 'dba-add-sel-weapon';
    selW.textContent = '未選択（武器）';

    const selA = document.createElement('div');
    selA.className = 'dba-add-sel';
    selA.id = 'dba-add-sel-armor';
    selA.textContent = '未選択（防具）';

    const selN = document.createElement('div');
    selN.className = 'dba-add-sel';
    selN.id = 'dba-add-sel-necklace';
    selN.textContent = '未選択（ネックレス）';

    right.appendChild(selW);
    right.appendChild(selA);
    right.appendChild(selN);

    wrap.appendChild(left);
    wrap.appendChild(right);
    mid.appendChild(wrap);

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'dba-add-name';
    name.id = 'dba-add-preset-name';
    name.placeholder = 'プリセット名';
    mid.appendChild(name);

    const botRow = document.createElement('div');
    botRow.className = 'dba-add-bot';
    const reg = document.createElement('button');
    reg.type = 'button';
    reg.className = 'dba-btn-apply';
    reg.textContent = '登録';
    reg.id = 'dba-add-btn-register';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'dba-btn-close';
    cancel.textContent = '中止';
    cancel.id = 'dba-add-btn-cancel';
    botRow.appendChild(reg);
    botRow.appendChild(cancel);
    mid.appendChild(botRow);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'dba-btn-close';
    close.textContent = 'Close';
    bot.appendChild(close);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }
    x.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    close.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    cancel.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });
  }

  // ---- プリセット再編集 modal ----
  function buildRosterEditModal(){
    if(document.getElementById('dba-m-roster-edit')) return;
    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-roster-edit';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';
    const t = document.createElement('div');
    t.className = 'dba-modal__title';
    t.textContent = 'プリセット再編集';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'dba-btn-x';
    x.textContent = '×';
    top.appendChild(t); top.appendChild(x);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    const wrap = document.createElement('div');
    wrap.className = 'dba-add-wrap';

    const left = document.createElement('div');
    left.className = 'dba-add-left';

    const btnW = document.createElement('button');
    btnW.type = 'button';
    btnW.className = 'dba-btn-mini';
    btnW.textContent = '武器';
    btnW.id = 'dba-edit-btn-weapon';

    const btnA = document.createElement('button');
    btnA.type = 'button';
    btnA.className = 'dba-btn-mini';
    btnA.textContent = '防具';
    btnA.id = 'dba-edit-btn-armor';

    const btnN = document.createElement('button');
    btnN.type = 'button';
    btnN.className = 'dba-btn-mini';
    btnN.textContent = 'ネックレス';
    btnN.id = 'dba-edit-btn-necklace';

    left.appendChild(btnW);
    left.appendChild(btnA);
    left.appendChild(btnN);

    const right = document.createElement('div');
    right.className = 'dba-add-right';

    const selW = document.createElement('div');
    selW.className = 'dba-add-sel';
    selW.id = 'dba-edit-sel-weapon';
    selW.textContent = '未選択（武器）';

    const selA = document.createElement('div');
    selA.className = 'dba-add-sel';
    selA.id = 'dba-edit-sel-armor';
    selA.textContent = '未選択（防具）';

    const selN = document.createElement('div');
    selN.className = 'dba-add-sel';
    selN.id = 'dba-edit-sel-necklace';
    selN.textContent = '未選択（ネックレス）';

    right.appendChild(selW);
    right.appendChild(selA);
    right.appendChild(selN);

    wrap.appendChild(left);
    wrap.appendChild(right);
    mid.appendChild(wrap);

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'dba-add-name';
    name.id = 'dba-edit-preset-name';
    name.placeholder = 'プリセット名';
    // 再編集ではプリセット名の変更も許可する
    name.disabled = false;
    mid.appendChild(name);

    const botRow = document.createElement('div');
    botRow.className = 'dba-add-bot';
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'dba-btn-apply';
    done.textContent = '再編集完了';
    done.id = 'dba-edit-btn-done';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'dba-btn-close';
    cancel.textContent = '中止';
    cancel.id = 'dba-edit-btn-cancel';
    botRow.appendChild(done);
    botRow.appendChild(cancel);
    mid.appendChild(botRow);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'dba-btn-close';
    close.textContent = 'Close';
    bot.appendChild(close);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }
    x.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    close.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    cancel.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });
  }

  function openRosterAddPresetModal(onDone, insertIndex){
    const openNow = () => {
      buildRosterAddModal();
      // 状態初期化
      const st = { weaponId: null, armorId: null, necklaceId: null, weaponLabel:'未選択（武器）', armorLabel:'未選択（防具）', necklaceLabel:'未選択（ネックレス）' };
      const selW = document.getElementById('dba-add-sel-weapon');
      const selA = document.getElementById('dba-add-sel-armor');
      const selN = document.getElementById('dba-add-sel-necklace');
      const name = document.getElementById('dba-add-preset-name');
      if(selW) selW.textContent = st.weaponLabel;
      if(selA) selA.textContent = st.armorLabel;
      if(selN) selN.textContent = st.necklaceLabel;
      if(name) name.value = '';

      const btnW = document.getElementById('dba-add-btn-weapon');
      const btnA = document.getElementById('dba-add-btn-armor');
      const btnN = document.getElementById('dba-add-btn-necklace');
      const btnReg = document.getElementById('dba-add-btn-register');
      const dlg = document.getElementById('dba-m-roster-add');
      if(!dlg) return;
      const rosterDlg = document.getElementById('dba-m-roster');

      function refreshLabels(){
        if(selW) selW.textContent = st.weaponLabel;
        if(selA) selA.textContent = st.armorLabel;
        if(selN) selN.textContent = st.necklaceLabel;
      }

      if(btnW){
        btnW.onclick = async (e) => {
          e.preventDefault(); e.stopPropagation();
          try{
            const picked = await openPickItemModal('weapon');
            st.weaponId = picked.id;
            st.weaponLabel = picked.label;
            refreshLabels();
          }catch(_e2){}
        };
      }
      if(btnA){
        btnA.onclick = async (e) => {
          e.preventDefault(); e.stopPropagation();
          try{
            const picked = await openPickItemModal('armor');
            st.armorId = picked.id;
            st.armorLabel = picked.label;
            refreshLabels();
          }catch(_e2){}
        };
      }
      if(btnN){
        btnN.onclick = async (e) => {
          e.preventDefault(); e.stopPropagation();
          try{
            const picked = await openPickItemModal('necklace');
            st.necklaceId = picked.id;
            st.necklaceLabel = picked.label;
            refreshLabels();
          }catch(_e2){}
        };
      }

      if(btnReg){
        btnReg.onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          const pn = sanitizeText(name && name.value ? name.value : '');
          if(!pn){
            alert('プリセット名を入力してください。');
            return;
          }
          try{
            assertPresetNameAvailable(pn);
            setPresetAt(pn, [st.weaponId, st.armorId, st.necklaceId], insertIndex);
            try{ onDone && onDone(); }catch(_e2){}
            try{ dlg.close(); }catch(_e2){ dlg.removeAttribute('open'); }
          }catch(_e2){
            alert(String(_e2 && _e2.message ? _e2.message : '登録に失敗しました。'));
          }
        };
      }

      if(dlg){
        try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
      }

    };
    if(document.body) openNow(); else document.addEventListener('DOMContentLoaded', openNow, { once:true });
  }

  function openRosterEditPresetModal(presetName, onDone){
    const openNow = () => {
      buildRosterEditModal();

      const nm = sanitizeText(presetName);
      if(!nm){
        alert('再編集対象のプリセット名が不正です。');
        return;
      }
      const { roster } = getActiveRoster();
      const presets = roster && roster.presets ? roster.presets : {};
      const triple = presets[nm];
      if(!triple){
        alert(`プリセットが見つかりません: ${nm}`);
        return;
      }


      // 状態初期化（既存値を反映）
      const st = {
        weaponId: (triple[0] == null ? null : Number(triple[0])),
        armorId: (triple[1] == null ? null : Number(triple[1])),
        necklaceId: (triple[2] == null ? null : Number(triple[2])),
        weaponLabel: (triple[0] == null ? '未選択（武器）' : '復元中…（武器）'),
        armorLabel: (triple[1] == null ? '未選択（防具）' : '復元中…（防具）'),
        necklaceLabel: (triple[2] == null ? '未選択（ネックレス）' : '復元中…（ネックレス）')
      };

      const selW = document.getElementById('dba-edit-sel-weapon');
      const selA = document.getElementById('dba-edit-sel-armor');
      const selN = document.getElementById('dba-edit-sel-necklace');
      const name = document.getElementById('dba-edit-preset-name');
      if(selW) selW.textContent = st.weaponLabel;
      if(selA) selA.textContent = st.armorLabel;
      if(selN) selN.textContent = st.necklaceLabel;
      if(name) name.value = nm;

      const btnW = document.getElementById('dba-edit-btn-weapon');
      const btnA = document.getElementById('dba-edit-btn-armor');
      const btnN = document.getElementById('dba-edit-btn-necklace');
      const btnDone = document.getElementById('dba-edit-btn-done');
      const dlg = document.getElementById('dba-m-roster-edit');

      function refreshLabels(){
        if(selW) selW.textContent = st.weaponLabel;
        if(selA) selA.textContent = st.armorLabel;
        if(selN) selN.textContent = st.necklaceLabel;
      }

      // 既存IDが入っている場合、/bag から名称込みラベルを復元して上書き
      // （openPickItemModal と同じ extractRowLabel() 形式）
      (async () => {
        const need =
          (st.weaponId != null) ||
          (st.armorId != null) ||
          (st.necklaceId != null);
        if(!need) return;
        try{
          const bagDoc = await fetchBagTableDoc();
          if(st.weaponId != null)   st.weaponLabel   = makeLabelByIdFromDoc(bagDoc, 'weapon',   st.weaponId);
          if(st.armorId != null)    st.armorLabel    = makeLabelByIdFromDoc(bagDoc, 'armor',    st.armorId);
          if(st.necklaceId != null) st.necklaceLabel = makeLabelByIdFromDoc(bagDoc, 'necklace', st.necklaceId);
          refreshLabels();
        }catch(_e2){
          // 復元失敗時は「復元中…」のままだと不親切なのでフォールバックを入れる
          if(st.weaponId != null && String(st.weaponLabel).includes('復元中'))   st.weaponLabel   = `武器: (復元失敗) / ID:${Number(st.weaponId)}`;
          if(st.armorId != null && String(st.armorLabel).includes('復元中'))    st.armorLabel    = `防具: (復元失敗) / ID:${Number(st.armorId)}`;
          if(st.necklaceId != null && String(st.necklaceLabel).includes('復元中')) st.necklaceLabel = `ネックレス: (復元失敗) / ID:${Number(st.necklaceId)}`;
          refreshLabels();
        }
      })();

      if(btnW){
        btnW.onclick = async (e) => {
          e.preventDefault(); e.stopPropagation();
          try{
            const picked = await openPickItemModal('weapon');
            st.weaponId = picked.id;
            st.weaponLabel = picked.label;
            refreshLabels();
          }catch(_e2){}
        };
      }
      if(btnA){
        btnA.onclick = async (e) => {
          e.preventDefault(); e.stopPropagation();
          try{
            const picked = await openPickItemModal('armor');
            st.armorId = picked.id;
            st.armorLabel = picked.label;
            refreshLabels();
          }catch(_e2){}
        };
      }
      if(btnN){
        btnN.onclick = async (e) => {
          e.preventDefault(); e.stopPropagation();
          try{
            const picked = await openPickItemModal('necklace');
            st.necklaceId = picked.id;
            st.necklaceLabel = picked.label;
            refreshLabels();
          }catch(_e2){}
        };
      }

      if(btnDone){
        btnDone.onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          const nextName = sanitizeText(name && name.value ? name.value : '');
          if(!nextName){
            alert('プリセット名を入力してください。');
            return;
          }
          try{
            if(nextName !== nm){
              renamePreset(nm, nextName);
            }
            setPresetAt(
              nextName,
              [st.weaponId, st.armorId, st.necklaceId],
              null,
              { allowOverwrite:true }
            );
            try{ onDone && onDone(); }catch(_e2){}
            try{ dlg.close(); }catch(_e2){ dlg.removeAttribute('open'); }
          }catch(_e2){
            alert(String(_e2 && _e2.message ? _e2.message : '再編集の反映に失敗しました。'));
          }
        };
      }

      if(dlg){
        try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
      }
    };
    if(document.body) openNow(); else document.addEventListener('DOMContentLoaded', openNow, { once:true });
  }

  // ---- プリセット並び替え modal ----
  function buildRosterSortModal(){
    if(document.getElementById('dba-m-roster-sort')) return;
    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-roster-sort';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';
    const t = document.createElement('div');
    t.className = 'dba-modal__title';
    t.textContent = 'プリセット並び替え';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'dba-btn-x';
    x.textContent = '×';
    top.appendChild(t);
    top.appendChild(x);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    const hint = document.createElement('div');
    hint.className = 'dba-sort-hint';
    hint.textContent = 'ドラッグ＆ドロップで並び替えできます（上下端に近づくとゆっくりスクロールします）。';
    mid.appendChild(hint);

    const list = document.createElement('div');
    list.id = 'dba-roster-sort-list';
    list.className = 'dba-sort-list';

    // 挿入予定位置ライン（ドラッグ中のみ表示）
    const ins = document.createElement('div');
    ins.id = 'dba-roster-sort-insert-line';
    ins.className = 'dba-sort-insert-line';
    list.appendChild(ins);

    mid.appendChild(list);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';
    const btnDecide = document.createElement('button');
    btnDecide.type = 'button';
    btnDecide.className = 'dba-btn-apply';
    btnDecide.id = 'dba-roster-sort-decide';
    btnDecide.textContent = '決定';
    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'dba-btn-close';
    btnCancel.id = 'dba-roster-sort-cancel';
    btnCancel.textContent = 'Cancel';
    bot.appendChild(btnDecide);
    bot.appendChild(btnCancel);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }
    x.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    btnCancel.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });
  }

  function openRosterSortModal(onDone){
    const openNow = () => {
      buildRosterSortModal();

      const { store, roster } = getActiveRoster();
      const presets = roster && roster.presets ? roster.presets : {};

      // 現在の表示順（renderRosterModalState と同じルール）
      const order = Array.isArray(roster && roster.presetOrder) ? roster.presetOrder : [];
      const seen = new Set();
      const names = [];
      for(const nm of order){
        if(!nm) continue;
        if(seen.has(nm)) continue;
        if(Object.prototype.hasOwnProperty.call(presets, nm)){
          names.push(nm);
          seen.add(nm);
        }
      }
      for(const nm of Object.keys(presets)){
        if(seen.has(nm)) continue;
        names.push(nm);
        seen.add(nm);
      }

      const dlg = document.getElementById('dba-m-roster-sort');
      const list = document.getElementById('dba-roster-sort-list');
      const btnDecide = document.getElementById('dba-roster-sort-decide');
      const btnCancel = document.getElementById('dba-roster-sort-cancel');
      if(!dlg || !list || !btnDecide || !btnCancel) return;

      const insertLine = document.getElementById('dba-roster-sort-insert-line');

      const hideInsertLine = () => {
        if(!insertLine) return;
        insertLine.style.display = 'none';
      };
      const showInsertLineAtIndex = (idx) => {
        if(!insertLine) return;
        const items = Array.from(list.querySelectorAll('.dba-sort-item'));
        const listRect = list.getBoundingClientRect();

        let y = 0;
        if(items.length === 0){
          y = 8; // ほぼ空の時
        }else if(idx <= 0){
          const r0 = items[0].getBoundingClientRect();
          y = (r0.top - listRect.top) + list.scrollTop;
        }else if(idx >= items.length){
          const last = items[items.length - 1];
          const rl = last.getBoundingClientRect();
          // margin-bottom 分だけ少し下へ（見た目の“間”に合わせる）
          const mb = parseFloat(getComputedStyle(last).marginBottom || '0') || 0;
          y = (rl.bottom - listRect.top) + list.scrollTop + mb;
        }else{
          const rt = items[idx].getBoundingClientRect();
          y = (rt.top - listRect.top) + list.scrollTop;
        }

        insertLine.style.top = `${Math.max(0, Math.floor(y))}px`;
        insertLine.style.display = 'block';
      };

      // 使い回し時の多重bind対策：一旦クローンで差し替え
      const btnDecide2 = btnDecide.cloneNode(true);
      const btnCancel2 = btnCancel.cloneNode(true);
      btnDecide.parentNode.replaceChild(btnDecide2, btnDecide);
      btnCancel.parentNode.replaceChild(btnCancel2, btnCancel);

      let draggingName = null;
      let rafId = 0;
      let scrollV = 0; // px/frame（符号あり）

      const stopAutoScroll = () => {
        scrollV = 0;
        if(rafId){
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      };
      const tickAutoScroll = () => {
        if(!scrollV){ rafId = 0; return; }
        // 速度キャップ済みの scrollV をそのまま使う
        list.scrollTop += scrollV;
        rafId = requestAnimationFrame(tickAutoScroll);
      };
      const setAutoScrollByPointerY = (clientY) => {
        const rect = list.getBoundingClientRect();
        const edge = 56;      // 端からこの距離でスクロール開始
        const maxSpeed = 6;  // ★速度キャップ（px/frame）
        const distTop = clientY - rect.top;
        const distBot = rect.bottom - clientY;
        let v = 0;
        if(distTop < edge){
          const p = Math.max(0, Math.min(1, (edge - distTop) / edge));
          v = -Math.ceil(p * maxSpeed);
        }else if(distBot < edge){
          const p = Math.max(0, Math.min(1, (edge - distBot) / edge));
          v = Math.ceil(p * maxSpeed);
        }
        scrollV = v;
        if(scrollV && !rafId){
          rafId = requestAnimationFrame(tickAutoScroll);
        }
        if(!scrollV){
          stopAutoScroll();
        }
      };

      const render = () => {
        // ★挿入ラインは list 内に常駐させる（textContent='' で消えるため、毎回復帰させる）
        list.textContent = '';
        if(insertLine) list.appendChild(insertLine);
        hideInsertLine();
        if(names.length === 0){
          const empty = document.createElement('div');
          empty.style.padding = '10px';
          empty.style.fontWeight = '800';
          empty.textContent = 'プリセットがありません。';
          list.appendChild(empty);
          return;
        }

        for(const nm of names){
          const triple = presets[nm];
          const row = document.createElement('div');
          row.className = 'dba-sort-item';
          row.draggable = true;
          row.dataset.name = nm;

          const h = document.createElement('div');
          h.className = 'dba-sort-handle';
          h.textContent = '≡';
          const n = document.createElement('div');
          n.className = 'dba-sort-name';
          n.textContent = nm;
          const m = buildPresetMetaNode(triple, 'dba-sort-meta');

          row.appendChild(h);
          row.appendChild(n);
          row.appendChild(m);

          row.addEventListener('dragstart', (e) => {
            draggingName = nm;
            row.classList.add('dba-sort-dragging');
            try{ e.dataTransfer.effectAllowed = 'move'; }catch(_e2){}

            // ドラッグ開始時点の位置に“挿入予定ライン”を表示
            try{
              const i0 = names.indexOf(nm);
              showInsertLineAtIndex((i0 < 0) ? 0 : i0);
            }catch(_e3){}
          });
          row.addEventListener('dragend', () => {
            draggingName = null;
            row.classList.remove('dba-sort-dragging');
            for(const el of list.querySelectorAll('.dba-sort-over')){
              el.classList.remove('dba-sort-over');
            }
            stopAutoScroll();
            hideInsertLine();
          });

          row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
          });

          list.appendChild(row);
        }
      };

      // drop時にだけ確定する（dragoverでは“予定位置”を計算して保持する）
      let pendingDropIndex = null; // 0..names.length（挿入位置）

      function calcDropIndex(clientY){
        // 要件：
        // - 放した位置が “他プリセットの上” → そのプリセットの直上に挿入
        // - 放した位置が “プリセットとプリセットの間” → その間に挿入
        //
        // 実装方針：
        // 1) まず「ポインタ直下のアイテム」があるなら、そのアイテムの index（=直上）を返す
        // 2) 無い（=間/余白）なら、全アイテムの midY を走査して「最初に midY を超えた位置」を返す
        //    （= “その間” の index になる。最後まで無ければ末尾）

        const over = document.elementFromPoint( (window.innerWidth/2), clientY );
        void over; // 使わない（互換用の抑止）

        const hit = (eTargetForHit && eTargetForHit.closest) ? eTargetForHit.closest('.dba-sort-item') : null;
        if(hit && hit.dataset && hit.dataset.name){
          const toName = hit.dataset.name;
          const idx = names.indexOf(toName);
          if(idx >= 0) return idx; // ★直上
        }

        const items = Array.from(list.querySelectorAll('.dba-sort-item'));
        for(const it of items){
          const r = it.getBoundingClientRect();
          const midY = r.top + r.height/2;
          if(clientY < midY){
            const nm = it.dataset ? it.dataset.name : '';
            const idx = names.indexOf(nm);
            if(idx >= 0) return idx;
          }
        }
        return names.length; // 末尾
      }

      // ★スクロールしたら、現在の“挿入予定位置”に赤ラインを追従させる（登録は1回だけ）
      list.addEventListener('scroll', () => {
        try{
          if(draggingName && typeof pendingDropIndex === 'number'){
            showInsertLineAtIndex(pendingDropIndex);
          }
        }catch(_e){}
      }, { passive:true });

      // list上での dragover：予定位置を計算し、ハイライトだけ更新
      list.addEventListener('dragover', (e) => {
        if(!draggingName) return;
        e.preventDefault();
        e.stopPropagation();

        setAutoScrollByPointerY(e.clientY);

        // “直下の要素”を基準に、ドロップ予定indexを計算
        // - calcDropIndex 内で参照するため、一時的に保持
        eTargetForHit = e.target;
        pendingDropIndex = (typeof e.clientY === 'number') ? calcDropIndex(e.clientY) : null;

        // ★“今ドロップしたら挿入される予定位置”に赤ラインを表示
        try{
          if(typeof pendingDropIndex === 'number') showInsertLineAtIndex(pendingDropIndex);
        }catch(_e2){}

        // 見た目：ポインタ直下に item がある時だけ赤枠（.dba-sort-over）を付ける
        for(const el of list.querySelectorAll('.dba-sort-over')){
          el.classList.remove('dba-sort-over');
        }
        const overEl = (e.target && e.target.closest) ? e.target.closest('.dba-sort-item') : null;
        if(overEl) overEl.classList.add('dba-sort-over');
      }, { passive:false });

      // drop：ここで並び替えを確定する
      //  - “他プリセットの上” ならその直上（index=to）
      //  - “間” ならその位置（midY走査で決定した index）
      let eTargetForHit = null; // calcDropIndex 用（dragover/drop の e.target を渡す）
      list.addEventListener('drop', (e) => {
        if(!draggingName) return;
        e.preventDefault();
        e.stopPropagation();
        stopAutoScroll();

        eTargetForHit = e.target;
        const idx0 = (typeof e.clientY === 'number') ? calcDropIndex(e.clientY) : pendingDropIndex;
        pendingDropIndex = null;

        const from = names.indexOf(draggingName);
        if(from < 0) return;

        let dst = (idx0 == null) ? from : Number(idx0);
        if(!Number.isFinite(dst)) dst = from;

        // remove → insert（同一要素移動なので、fromより後ろへ入れる時は1つズレる）
        names.splice(from, 1);
        if(dst > from) dst = dst - 1;
        dst = Math.max(0, Math.min(names.length, dst));
        names.splice(dst, 0, draggingName);

        render();
      });

      // 初期描画
      render();

      btnCancel2.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        stopAutoScroll();
        try{ dlg.close(); }catch(_e2){ dlg.removeAttribute('open'); }
      });

      btnDecide2.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        stopAutoScroll();
        try{
          // 上書き保存（表示順配列＋presets のキー順も更新）
          roster.presetOrder = names.slice();
          roster.presets = rebuildPresetMapByOrder(
            roster && roster.presets ? roster.presets : {},
            roster.presetOrder
          );
          roster.updatedAt = nowIso();
          store.rosters[store.activeId] = roster;
          saveRosterStore(store);
          try{ onDone && onDone(); }catch(_e2){}
          try{ dlg.close(); }catch(_e2){ dlg.removeAttribute('open'); }
        }catch(_e2){
          alert('並び替えの保存に失敗しました。');
        }
      });

      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
    };
    if(document.body) openNow(); else document.addEventListener('DOMContentLoaded', openNow, { once:true });
  }

  // ---- アイテム選択 modal（/bag から table 抜き出し） ----
  function buildPickItemModal(){
    if(document.getElementById('dba-m-pick-item')) return;
    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-pick-item';
    dlg.className = 'dba-m-std';

    const top = document.createElement('div');
    top.className = 'dba-modal__top';
    const t = document.createElement('div');
    t.className = 'dba-modal__title';
    t.id = 'dba-pick-title';
    t.textContent = 'アイテム選択';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'dba-btn-x';
    x.textContent = '×';
    top.appendChild(t); top.appendChild(x);

    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';
    const hint = document.createElement('div');
    hint.className = 'dba-pick-hint';
    hint.id = 'dba-pick-hint';
    hint.textContent = '行をクリックして選択してください。';
    const box = document.createElement('div');
    box.id = 'dba-pick-box';
    mid.appendChild(hint);
    mid.appendChild(box);

    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'dba-btn-ok';
    ok.textContent = 'OK';
    ok.id = 'dba-pick-ok';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'dba-btn-close';
    cancel.textContent = 'Cancel';
    cancel.id = 'dba-pick-cancel';
    bot.appendChild(ok);
    bot.appendChild(cancel);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);
    document.body.appendChild(dlg);

    function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }
    x.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    cancel.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });
  }

  function hideColumnsByHeaderText(table, headerTexts){
    if(!table) return [];
    const ths = Array.from(table.querySelectorAll('thead th'));
    const idxs = [];
    for(let i=0;i<ths.length;i++){
      const ht = sanitizeText(ths[i].textContent || '');
      if(headerTexts.includes(ht)){
        idxs.push(i);
      }
    }
    // display none for each index (td/th)
    for(const i of idxs){
      for(const tr of Array.from(table.querySelectorAll('tr'))){
        const cells = Array.from(tr.children);
        const cell = cells[i];
        if(cell && cell.style){
          cell.style.display = 'none';
        }
      }
    }
    return idxs;
  }

  function extractEquipIdFromRow(row){
    if(!row) return null;
    const a = row.querySelector('a[href*="/equip/"]');
    if(!a) return null;
    const href = a.getAttribute('href') || '';
    const m = href.match(/\/equip\/(\d+)/);
    if(!m) return null;
    return Number(m[1]);
  }

  function extractRowLabel(row, kind){
    // 1列目（名前セル）を優先
    const td0 = row ? row.querySelector('td') : null;
    const nm = sanitizeText(td0 ? td0.innerText : '');
    const id = extractEquipIdFromRow(row);
    const k = (kind === 'weapon') ? '武器' : (kind === 'armor') ? '防具' : 'ネックレス';
    if(id != null){
      return `${k}: ${nm || '(名称不明)'} / ID:${id}`;
    }
    return `${k}: ${nm || '(未選択)'} / ID:-`;
  }

  function findEquipRowByIdFromDoc(doc, kind, equipId){
    if(!doc || equipId == null) return null;
    const idNum = Number(equipId);
    if(!Number.isFinite(idNum)) return null;
    const tableId = pickTableIdByKind(kind);
    const table = doc.getElementById(tableId);
    if(!table) return null;
    // /equip/{id} へのリンクを含む行を探す
    // ※href は "/equip/123" のような相対が基本だが、念のため部分一致でも拾う
    const a = table.querySelector(`a[href*="/equip/${idNum}"]`);
    if(!a) return null;
    const tr = a.closest('tr');
    return tr || null;
  }

  function makeLabelByIdFromDoc(doc, kind, equipId){
    const k = (kind === 'weapon') ? '武器' : (kind === 'armor') ? '防具' : 'ネックレス';
    if(equipId == null) return `未選択（${k}）`;
    const tr = findEquipRowByIdFromDoc(doc, kind, equipId);
    if(!tr){
      // 見つからない場合はフォールバック（IDは保持されているので、最低限表示する）
      return `${k}: (見つかりません) / ID:${Number(equipId)}`;
    }
    return extractRowLabel(tr, kind);
  }

  async function fetchBagTableDoc(){
    const url = makeBagUrl();
    const res = await fetch(url, { method:'GET', credentials:'include', cache:'no-store' });
    if(!res.ok) throw new Error(`bag fetch failed: ${res.status}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc;
  }

  function pickTableIdByKind(kind){
    if(kind === 'weapon') return 'weaponTable';
    if(kind === 'armor') return 'armorTable';
    return 'necklaceTable';
  }

  function normalizeRgb(s){
    // getComputedStyle() の "rgb(r, g, b)" / "rgba(r, g, b, a)" を比較しやすく
    const t = sanitizeText(String(s || '')).toLowerCase();
    if(!t) return '';
    if(t === 'white') return 'rgb(255, 255, 255)';
    // rgba を rgb に寄せる（a は無視）
    const m = t.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/);
    if(m) return `rgb(${Number(m[1])}, ${Number(m[2])}, ${Number(m[3])})`;
    return t;
  }

  function detectRarityFromRow(tr){
    // ルール：
    // N   … 名称欄に [N] / 背景色 white
    // R   … 名称欄に [R] / 背景色 rgb(63,164,53)
    // SR  … 名称欄に [SR] / 背景色 rgb(33,117,217)
    // SSR … 名称欄に [SSR] / 背景色 rgb(166,51,214)
    // UR  … 名称欄に [UR] / 背景色 rgb(244,93,1)
    const td0 = tr ? tr.querySelector('td') : null;
    const nameText = sanitizeText(td0 ? td0.innerText : '');
    // まずは文字の [XXX] を優先（背景色が上書きされるケースでも安定）
    if(nameText.includes('[UR]')) return 'UR';
    if(nameText.includes('[SSR]')) return 'SSR';
    if(nameText.includes('[SR]')) return 'SR';
    // [R] は [SR]/[SSR]/[UR] に含まれないよう上で先に判定
    if(nameText.includes('[R]')) return 'R';
    if(nameText.includes('[N]')) return 'N';

    // 背景色（td0優先→tr→最初のtd）
    let bg = '';
    try{
      if(td0) bg = normalizeRgb(getComputedStyle(td0).backgroundColor);
      if(!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)'){
        bg = normalizeRgb(getComputedStyle(tr).backgroundColor);
      }
      if((!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') && tr){
        const anyTd = tr.querySelector('td,th');
        if(anyTd) bg = normalizeRgb(getComputedStyle(anyTd).backgroundColor);
      }
    }catch(_e){}

    // 背景色で判定（getComputedStyle は rgb で返る想定）
    if(bg === 'rgb(63, 164, 53)') return 'R';
    if(bg === 'rgb(33, 117, 217)') return 'SR';
    if(bg === 'rgb(166, 51, 214)') return 'SSR';
    if(bg === 'rgb(244, 93, 1)') return 'UR';
    if(bg === 'rgb(255, 255, 255)') return 'N';

    // 何も判定できない場合は N 扱いに寄せる（見落とし回避）
    return 'N';
  }

  function getHeaderIndexByText(table, headerText){
    if(!table) return -1;
    const ths = Array.from(table.querySelectorAll('thead th'));
    for(let i=0;i<ths.length;i++){
      const t = sanitizeText(ths[i].textContent || '');
      if(t === headerText) return i;
    }
    return -1;
  }

  function getRowCellTextByIndex(tr, idx){
    if(!tr || idx < 0) return '';
    const cells = Array.from(tr.children);
    const cell = cells[idx];
    if(!cell) return '';
    return sanitizeText(cell.textContent || '');
  }

  function isModZeroRow(tr, modIdx){
    // MOD 列の値が 0（"0" / "0.0" / "0%" 等）なら true
    if(modIdx < 0) return false;
    const t = getRowCellTextByIndex(tr, modIdx);
    if(!t) return false;
    // 0, 0.0, 0.00, 0%, 0.0% などを 0 扱い
    const m = t.match(/-?\d+(?:\.\d+)?/);
    if(!m) return false;
    const v = Number(m[0]);
    if(!Number.isFinite(v)) return false;
    return Math.abs(v) === 0;
  }

  async function openPickItemModal(kind){
    buildPickItemModal();
    const dlg = document.getElementById('dba-m-pick-item');
    const mid = dlg ? dlg.querySelector('.dba-modal__mid') : null;
    const title = document.getElementById('dba-pick-title');
    const hint = document.getElementById('dba-pick-hint');
    const box = document.getElementById('dba-pick-box');
    const ok = document.getElementById('dba-pick-ok');
    const cancel = document.getElementById('dba-pick-cancel');
    if(!dlg || !box || !ok || !cancel) throw new Error('pick modal missing');

    const kLabel = (kind === 'weapon') ? '武器' : (kind === 'armor') ? '防具' : 'ネックレス';
    if(title) title.textContent = `${kLabel}を選択`;
    if(hint) hint.textContent = '行をクリックして選択してください（装/解/分解列は非表示）。';
    box.textContent = '読み込み中…';

    // dba-m-pick-item は使い回しなので、前回のスクロール位置を毎回破棄する
    try{ dlg.scrollTop = 0; }catch(_e){}
    try{ if(mid) mid.scrollTop = 0; }catch(_e){}
    try{ box.scrollTop = 0; }catch(_e){}

    let selectedRow = null;
    let activeRarity = 'ALL';
    let hideModZero = loadPickHideModZero(kind);
    let modColIdx = -1;

    // 表を取得して表示
    const doc = await fetchBagTableDoc();
    const tableId = pickTableIdByKind(kind);
    const srcTable = doc.getElementById(tableId);
    if(!srcTable){
      box.textContent = 'テーブルが見つかりませんでした。';
    }else{
      const imported = document.importNode(srcTable, true);

      // 装/解/分解列を非表示（列は残して ID 抽出に使う）
      hideColumnsByHeaderText(imported, ['装','解','分解']);

      // MOD 列 index（無ければ -1）
      modColIdx = getHeaderIndexByText(imported, 'MOD');

      // フィルタ適用（レアリティ + MOD0）
      const applyPickFilters = () => {
        const trs = Array.from(imported.querySelectorAll('tbody tr'));
        for(const tr of trs){
          const r = detectRarityFromRow(tr);
          const okRarity = (activeRarity === 'ALL') ? true : (r === activeRarity);
          const okMod = (!hideModZero) ? true : (!isModZeroRow(tr, modColIdx));
          const show = okRarity && okMod;
          tr.style.display = show ? '' : 'none';
        }
        // 選択行が非表示になったら選択解除
        if(selectedRow && selectedRow.style && selectedRow.style.display === 'none'){
          try{
            selectedRow.classList.remove('dba-pick-row-selected');
            for(const td of Array.from(selectedRow.querySelectorAll('td,th'))){
              td.classList.remove('dba-pick-row-selected');
            }
          }catch(_e2){}
          selectedRow = null;
        }
      };

      // レアリティフィルタUI（テーブルの上に設置）
      // - box の先頭にバーを挿入し、以降にテーブルを置く
      const filterBar = document.createElement('div');
      filterBar.className = 'dba-pick-filterbar';
      filterBar.id = 'dba-pick-filterbar';

      const mkBtn = (label, rar, cls) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `dba-pick-filterbtn ${cls || ''}`.trim();
        b.textContent = label;
        b.dataset.rarity = rar;
        b.dataset.active = (rar === 'ALL') ? '1' : '0';
        b.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          activeRarity = rar;
          // active 表示
          for(const x of Array.from(filterBar.querySelectorAll('.dba-pick-filterbtn'))){
            x.dataset.active = (x.dataset.rarity === rar) ? '1' : '0';
          }
          applyPickFilters();
        });
        return b;
      };

      filterBar.appendChild(mkBtn('ALL', 'ALL', 'dba-pick-filterbtn--all'));
      filterBar.appendChild(mkBtn('N',   'N',   'dba-pick-filterbtn--n'));
      filterBar.appendChild(mkBtn('R',   'R',   'dba-pick-filterbtn--r'));
      filterBar.appendChild(mkBtn('SR',  'SR',  'dba-pick-filterbtn--sr'));
      filterBar.appendChild(mkBtn('SSR', 'SSR', 'dba-pick-filterbtn--ssr'));
      filterBar.appendChild(mkBtn('UR',  'UR',  'dba-pick-filterbtn--ur'));

      // チェックボックス：MOD 0 は表示しない
      const chkWrap = document.createElement('label');
      chkWrap.className = 'dba-pick-filterchk';
      chkWrap.id = 'dba-pick-chk-mod0-wrap';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.id = 'dba-pick-chk-mod0';
      chk.checked = !!hideModZero;

      const chkText = document.createElement('span');
      chkText.textContent = 'MOD 0 は表示しない';

      chkWrap.appendChild(chk);
      chkWrap.appendChild(chkText);
      filterBar.appendChild(chkWrap);

      // MOD列が無いテーブルでは無効化（例：ネックレス等のケース）
      if(modColIdx < 0){
        chk.disabled = true;
        chkWrap.dataset.disabled = '1';
      }else{
        chkWrap.dataset.disabled = '0';
        chk.addEventListener('change', (e) => {
          e.stopPropagation();
          hideModZero = !!chk.checked;
          savePickHideModZero(kind, hideModZero);
          applyPickFilters();
        });
      }

      // 初期状態をUIへ反映
      chk.checked = !!hideModZero;

      // 選択ハンドラ
      for(const tr of Array.from(imported.querySelectorAll('tbody tr'))){
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // 以前の選択を解除（tr と td の両方）
          if(selectedRow){
            try{
              selectedRow.classList.remove('dba-pick-row-selected');
              for(const td of Array.from(selectedRow.querySelectorAll('td,th'))){
                td.classList.remove('dba-pick-row-selected');
              }
            }catch(_e2){}
          }

          selectedRow = tr;

          // 新しい選択に “赤フィルタ” を適用（tr と td の両方）
          try{
            selectedRow.classList.add('dba-pick-row-selected');
            for(const td of Array.from(selectedRow.querySelectorAll('td,th'))){
              td.classList.add('dba-pick-row-selected');
            }
          }catch(_e2){}
        });
      }

      box.textContent = '';
      // 先にフィルタバー、その下にテーブル
      box.appendChild(filterBar);
      box.appendChild(imported);

      // 中身を差し替えた直後にも先頭へ戻す
      try{ dlg.scrollTop = 0; }catch(_e){}
      try{ if(mid) mid.scrollTop = 0; }catch(_e){}
      try{ box.scrollTop = 0; }catch(_e){}

      // 初期状態でフィルタ適用（念のため）
      applyPickFilters();
    }

    // promise で OK/CANCEL を待つ
    return await new Promise((resolve, reject) => {
      function cleanup(){
        ok.onclick = null;
        cancel.onclick = null;
      }
      function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }

      ok.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        if(!selectedRow){
          // 未選択は null を返す（要件：未選択は null で埋める）
          cleanup();
          closeDirect();
          resolve({ id: null, label: `未選択（${kLabel}）` });
          return;
        }
        // 念のため、非表示行は選択不可扱い（フィルタで隠れている時）
        if(selectedRow.style && selectedRow.style.display === 'none'){
          cleanup();
          closeDirect();
          resolve({ id: null, label: `未選択（${kLabel}）` });
          return;
        }
        const id = extractEquipIdFromRow(selectedRow);
        const label = extractRowLabel(selectedRow, kind);
        cleanup();
        closeDirect();
        resolve({ id: (id == null ? null : Number(id)), label });
      };
      cancel.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        cleanup();
        closeDirect();
        reject(new Error('cancel'));
      };

      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
      try{ dlg.scrollTop = 0; }catch(_e){}
      try{ if(mid) mid.scrollTop = 0; }catch(_e){}
      try{ box.scrollTop = 0; }catch(_e){}
    });
  }

  const DBA_BATTLEINFO_LOG_PREFIX = '[DBA][BattleInfo]';
  // ============================================================
  // ▽ここから▽ Debug スイッチ（機能ごとにON/OFF）
  //  - デフォルトは全て OFF
  //  - 将来的に問題切り分けが必要になったら、該当フラグだけ true にする
  // ============================================================
  const DBA_DEBUG = {
    battleInfo: false, // 戦況情報 fetch/parse 周り
    battlemapRefresh: false, // 戦況情報の前にトップページからバトルマップのみ差し替え
    layerSync:  false, // 透明レイヤー追従（必要になったら追加でログ出し）
    rbPointer:  false  // RBの座標計算（必要になったら追加でログ出し）
  };
  // ============================================================
  // △ここまで△ Debug スイッチ（機能ごとにON/OFF）
  // ============================================================

  function dbgLog(flagKey, level, msg, obj){
    if(!DBA_DEBUG || !DBA_DEBUG[flagKey]) return;
    const fn = (level === 'warn') ? console.warn
              : (level === 'error') ? console.error
              : (level === 'info') ? console.info
              : console.log;
    try{
      fn(`${DBA_BATTLEINFO_LOG_PREFIX} ${msg}`, obj || {});
    }catch(_e){
      // noop
    }
  }

  // =========================
  // バトルマップ差し替え（トップページから取得→マップ部分だけ再構成）
  //  - 目的：スクロールや更新時のちらつきを抑えつつ、最新マップへ更新してから詳細取得へ進む
  //  - 注意：DOMParser由来の <script> は inert（非実行）なので、差し替え後に再生成して実行する
  //
  // header + チーム情報2テーブル差し替え（トップページHTMLから）
  //  - 戦況情報ボタン（クリック/長押し）実行時に、ページ上部の表示も最新化する
  //  - 対象：
  //    (A) <header> ブロック
  //    (B) <div style="display:inline-flex;"> で始まる「2つの<table>」ブロック
  // =========================

  function tableHasThTexts(table, required){
    if(!table) return false;
    const ths = Array.from(table.querySelectorAll('thead th, th'))
      .map(th => sanitizeText(th.textContent || ''))
      .filter(Boolean);
    if(ths.length === 0) return false;
    return required.every(x => ths.some(t => t.includes(x)));
  }

  function isTeamTablesWrap(el){
    if(!(el instanceof Element)) return false;
    // style="display:inline-flex;" を優先しつつ、将来のstyle変更に備えて tables 構造でも判定
    const style = (el.getAttribute('style') || '').toLowerCase().replace(/\s+/g,'');
    const hasInlineFlex = style.includes('display:inline-flex') || style.includes('display:inline-flex;');
    const tables = Array.from(el.querySelectorAll(':scope > table'));
    if(tables.length < 2) return false;
    const t1 = tables[0];
    const t2 = tables[1];
    // 1つ目：カラー/チーム/保有地域数
    const ok1 =
      tableHasThTexts(t1, ['カラー', 'チーム']) &&
      (tableHasThTexts(t1, ['保有地域数']) || tableHasThTexts(t1, ['保有']));
    // 2つ目：名前/戦闘強度
    const ok2 =
      tableHasThTexts(t2, ['名前']) &&
      (tableHasThTexts(t2, ['戦闘強度']) || tableHasThTexts(t2, ['強度']));
    // style が inline-flex なら優先的にOK、無くても構造が一致すればOK
    return (ok1 && ok2) && (hasInlineFlex || true);
  }

  function findTeamTablesWrap(root){
    const base = (root && root.querySelector) ? root : document;
    // まず "style に inline-flex を含む div" を優先
    const cands = Array.from(base.querySelectorAll('div[style*="inline-flex"], div[style*="inline-flex"] *'))
      .map(x => (x instanceof Element) ? x.closest('div') : null)
      .filter((x, i, a) => x && a.indexOf(x) === i);
    for(const el of cands){
      if(isTeamTablesWrap(el)) return el;
    }
    // fallback：全divから形で探す
    for(const el of Array.from(base.querySelectorAll('div'))){
      if(isTeamTablesWrap(el)) return el;
    }
    return null;
  }

  function getOwnershipInfoTableFromWrap(wrap){
    if(!(wrap instanceof Element)) return null;
    const tables = Array.from(wrap.querySelectorAll(':scope > table'));
    if(tables.length < 1) return null;
    const t1 = tables[0];
    if(
      tableHasThTexts(t1, ['カラー', 'チーム']) &&
      (tableHasThTexts(t1, ['保有地域数']) || tableHasThTexts(t1, ['保有']))
    ){
      return t1;
    }
    return null;
  }

  function normalizeTeamColorCode(raw){
    let s = sanitizeText(raw || '').replace(/^#/, '').toUpperCase();
    if(!s) return '';

    if(/^[0-9A-F]{8}$/.test(s)){
      if(s.endsWith('00')) return '';
      s = s.slice(0, 6);
    }
    if(/^[0-9A-F]{6}$/.test(s)) return s;
    return '';
  }

  function extractTeamColorCodeFromRowColorCell(td){
    if(!(td instanceof HTMLElement)) return '';

    // 最優先：セル内テキスト（例: c0c0c0, FF0101, BadDad）
    let code = normalizeTeamColorCode(td.textContent || '');
    if(code) return code;

    // 次点：style属性の background-color
    const styleAttr = String(td.getAttribute('style') || '');
    const m1 = styleAttr.match(/background-color\s*:\s*#?([0-9a-fA-F]{6,8})/i);
    if(m1){
      code = normalizeTeamColorCode(m1[1] || '');
      if(code) return code;
    }

    // 念のため bgcolor 属性
    const bg = td.getAttribute('bgcolor');
    code = normalizeTeamColorCode(bg || '');
    if(code) return code;

    return '';
  }

  function buildLocalOwnershipCountMap(snapshot){
    const out = Object.create(null);
    const snap = snapshot && typeof snapshot === 'object'
      ? snapshot
      : getBattlemapSnapshotFromDoc(document);

    const cellColors = (snap && snap.cellColors && typeof snap.cellColors === 'object')
      ? snap.cellColors
      : Object.create(null);

    for(const v of Object.values(cellColors)){
      const code = normalizeTeamColorCode(v);
      if(!code) continue;
      out[code] = Number(out[code] || 0) + 1;
    }
    return out;
  }

  function buildLocalOwnershipSampleCellMap(snapshot){
    const out = Object.create(null);
    const snap = snapshot && typeof snapshot === 'object'
      ? snapshot
      : getBattlemapSnapshotFromDoc(document);

    const cellColors = (snap && snap.cellColors && typeof snap.cellColors === 'object')
      ? snap.cellColors
      : Object.create(null);

    for(const [key, v] of Object.entries(cellColors)){
      const code = normalizeTeamColorCode(v);
      if(!code) continue;
      if(out[code]) continue;

      const m = String(key).match(/^(\d+)-(\d+)$/);
      if(!m) continue;

      out[code] = {
        row: Number(m[1]),
        col: Number(m[2])
      };
    }
    return out;
  }

  function getCellDetailUrl(row, col){
    return makeTeambattleUrl({
      r: Number(row),
      c: Number(col),
      m: mode
    });
  }

  function extractTeamInfoTextFromCellDetailDoc(doc){
    if(!doc) return '';

    const tables = Array.from(doc.querySelectorAll('table'));
    for(const table of tables){
      const ths = Array.from(table.querySelectorAll('thead th, th'))
        .map(th => sanitizeText(th.textContent || ''));

      const idx = ths.findIndex(t => t.includes('チーム情報'));
      if(idx < 0) continue;

      const row = table.querySelector('tbody tr') || table.querySelector('tr');
      if(!row) continue;

      const tds = Array.from(row.querySelectorAll('td'));
      if(idx >= tds.length) continue;

      const txt = sanitizeText(tds[idx].textContent || '');
      if(txt) return txt;
    }
    return '';
  }

  async function fetchTeamInfoNameFromCell(row, col){
    try{
      const url = getCellDetailUrl(row, col);
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      });
      if(!res.ok) return '';
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return extractTeamInfoTextFromCellDetailDoc(doc);
    }catch(_e){
      return '';
    }
  }

  function ensureOwnershipTableTbody(table){
    let tbody = table.querySelector('tbody');
    if(tbody) return tbody;

    tbody = document.createElement('tbody');
    const rows = Array.from(table.querySelectorAll(':scope > tr'));
    for(const tr of rows){
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return tbody;
  }

  function makeOwnershipTableRow(colorCode, teamName, serverCount, localCount){
    const tr = document.createElement('tr');
    tr.style.backgroundColor = 'white';

    const tdColor = document.createElement('td');
    tdColor.style.textAlign = 'center';
    tdColor.style.backgroundColor = `#${colorCode}`;
    tdColor.textContent = colorCode;

    const tdTeam = document.createElement('td');
    tdTeam.style.textAlign = 'center';
    tdTeam.textContent = teamName || '不明';

    const tdCount = document.createElement('td');
    tdCount.style.textAlign = 'center';
    tdCount.style.whiteSpace = 'normal';
    tdCount.style.lineHeight = '1.25';
    tdCount.dataset.dbaServerCount = String(Number(serverCount || 0));
    tdCount.dataset.dbaLocalCount = String(Number(localCount || 0));
    tdCount.innerHTML = `\
      <span style="font-size:1.05em;">ローカル：${localCount}</span><br>\
      <span style="font-size:0.95em; color:#666;">（サーバー：${serverCount}）</span>`;

    tr.appendChild(tdColor);
    tr.appendChild(tdTeam);
    tr.appendChild(tdCount);
    return tr;
  }

  async function applyLocalOwnershipCountsToTeamTable(rootOrWrap, snapshot){
    const wrap = isTeamTablesWrap(rootOrWrap)
      ? rootOrWrap
      : findTeamTablesWrap(rootOrWrap || document);
    if(!wrap) return false;

    const table = getOwnershipInfoTableFromWrap(wrap);
    if(!table) return false;

    const tbody = ensureOwnershipTableTbody(table);
    const countMap = buildLocalOwnershipCountMap(snapshot);
    const sampleCellMap = buildLocalOwnershipSampleCellMap(snapshot);
    const rows = Array.from(tbody.querySelectorAll(':scope > tr'))
      .filter(tr => tr.querySelectorAll('td').length >= 3);

    const rowMap = new Map();
    const teamNameMap = new Map();
    let changed = false;

    for(const tr of rows){
      const tds = Array.from(tr.querySelectorAll('td'));
      if(tds.length < 3) continue;

      const tdColor = tds[0];
      const tdTeam  = tds[1];
      const tdCount = tds[2];

      const colorCode = extractTeamColorCodeFromRowColorCell(tdColor);
      if(!colorCode) continue;

      const teamName = sanitizeText(tdTeam.textContent || '');
      if(teamName) teamNameMap.set(colorCode, teamName);

      const rawServerText = tdCount.dataset.dbaServerCount || sanitizeText(tdCount.textContent || '');
      const m = rawServerText.match(/(\d+)/);
      const serverCount = m ? Number(m[1]) : 0;
      const localCount = Number(countMap[colorCode] || 0);

      tdCount.dataset.dbaServerCount = String(serverCount);
      tdCount.dataset.dbaLocalCount = String(localCount);
      tdCount.style.whiteSpace = 'normal';
      tdCount.style.lineHeight = '1.25';

      tdCount.innerHTML = `\
        <span style="font-size:1.05em;">ローカル：${localCount}</span><br>\
        <span style="font-size:0.95em; color:#666;">（サーバー：${serverCount}）</span>`;

      rowMap.set(colorCode, tr);
      changed = true;
    }

    const missingColorCodes = Object.keys(countMap)
      .map(c => normalizeTeamColorCode(c))
      .filter(Boolean)
      .filter(colorCode => Number(countMap[colorCode] || 0) > 0)
      .filter(colorCode => !rowMap.has(colorCode));

    for(const colorCode of missingColorCodes){
      let teamName = teamNameMap.get(colorCode) || '';
      if(!teamName){
        const rc = sampleCellMap[colorCode];
        if(rc){
          teamName = await fetchTeamInfoNameFromCell(rc.row, rc.col);
        }
      }

      const tr = makeOwnershipTableRow(
        colorCode,
        teamName || '不明',
        0,
        Number(countMap[colorCode] || 0)
      );
      tbody.appendChild(tr);
      rowMap.set(colorCode, tr);
      if(teamName) teamNameMap.set(colorCode, teamName);
      changed = true;
    }

    const sortableRows = Array.from(tbody.querySelectorAll(':scope > tr'))
      .filter(tr => tr.querySelectorAll('td').length >= 3);

    sortableRows.sort((a, b) => {
      const aTds = Array.from(a.querySelectorAll('td'));
      const bTds = Array.from(b.querySelectorAll('td'));
      const aColor = extractTeamColorCodeFromRowColorCell(aTds[0]);
      const bColor = extractTeamColorCodeFromRowColorCell(bTds[0]);

      const aLocal = Number((aTds[2] && aTds[2].dataset.dbaLocalCount) || countMap[aColor] || 0);
      const bLocal = Number((bTds[2] && bTds[2].dataset.dbaLocalCount) || countMap[bColor] || 0);
      if(bLocal !== aLocal) return bLocal - aLocal;

      const aServer = Number((aTds[2] && aTds[2].dataset.dbaServerCount) || 0);
      const bServer = Number((bTds[2] && bTds[2].dataset.dbaServerCount) || 0);
      if(bServer !== aServer) return bServer - aServer;

      return String(aColor).localeCompare(String(bColor), 'ja');
    });

    for(const tr of sortableRows){
      tbody.appendChild(tr);
    }

    return changed;
  }

  async function refreshHeaderAndTeamTablesFromFetchedDoc(doc, meta){
    const topUrl = meta?.topUrl || makeTeambattleUrl({ m: mode });
    const snapshot = meta?.snapshot || (doc ? getBattlemapSnapshotFromDoc(doc) : getBattlemapSnapshotFromDoc(document));
    const sx = window.scrollX;
    const sy = window.scrollY;

    try{
      // (A) header 差し替え
      const curHeader = document.querySelector('header');
      const newHeader = doc ? doc.querySelector('header') : null;
      if(curHeader && newHeader && curHeader.parentNode){
        const importedHeader = document.importNode(newHeader, true);
        curHeader.parentNode.replaceChild(importedHeader, curHeader);
      }

      // (B) チーム情報2テーブル差し替え
      let effectiveWrap = findTeamTablesWrap(document);
      const curWrap = effectiveWrap;
      const newWrap = doc ? findTeamTablesWrap(doc) : null;
      if(curWrap && newWrap && curWrap.parentNode){
        const importedWrap = document.importNode(newWrap, true);
        curWrap.parentNode.replaceChild(importedWrap, curWrap);
        effectiveWrap = importedWrap;
      }

      // (B-2) 「保有地域数」を ローカル／サーバー 併記へ置き換え
      // - サーバー値は差し替えた table の元数値を保持
      // - ローカル値は snapshot.cellColors を累積して算出
      // - サーバー側に行が無い色でも、ローカル保有数が1以上なら新規行を追加
      // - 行順はローカル保有数の多い順へ並べ替え
      await applyLocalOwnershipCountsToTeamTable(effectiveWrap || document, snapshot);

      // (C) fnbar 上段の「チームカラー」表示も、差し替え後の header を元に再描画
      // - 戦況情報のクリック時/長押し時の双方で、サーバーHTML由来の最新色へ追従させる
      // - fnbar 未生成のタイミングでは何もしない
      if(document.getElementById('dba-fn-header-info')){
        renderFnHeaderInfo();
        await updateRbUnifiedRegDisplay(true);
        scheduleFnbarHeightSync();
      }

      if(mode === 'rb'){
        const rbApi = window.__DBA_RB_API;
        const cur = loadSettings();
        if(rbApi && typeof rbApi === 'object'){
          try{
            if(cur?.rbLayer?.stopAnimation){
              if(typeof rbApi.stopAnimation === 'function'){
                rbApi.stopAnimation();
              }else if(typeof rbApi.redrawOverlay === 'function'){
                rbApi.redrawOverlay();
              }
            }else{
              if(typeof rbApi.resumeAnimation === 'function'){
                rbApi.resumeAnimation();
              }else if(typeof rbApi.redrawOverlay === 'function'){
                rbApi.redrawOverlay();
              }
            }
          }catch(_e){}
        }
      }

      // 差し替えで微妙にレイアウトが動いても、スクロールは維持
      try{ window.scrollTo(sx, sy); }catch(_e){}
      dbgLog('battlemapRefresh', 'info', 'REFRESH header/team-tables done', { mode, topUrl });
      return true;
    }catch(e){
      dbgLog('battlemapRefresh', 'warn', 'REFRESH header/team-tables failed', { mode, topUrl, error: String(e && e.message ? e.message : e) });
      try{ window.scrollTo(sx, sy); }catch(_e){}
      return false;
    }
  }

  function findCurrentBattlemapRoot(){
    if(mode === 'rb'){
      return document.querySelector('.gridCanvasOuter') || document.getElementById('gridWrap');
    }
    return document.querySelector('.grid');
  }

  function findFetchedBattlemapRoot(doc){
    if(mode === 'rb'){
      return doc.querySelector('.gridCanvasOuter') || doc.getElementById('gridWrap');
    }
    return doc.querySelector('.grid');
  }

  function normalizeExecutableScriptType(typeValue){
    const raw = String(typeValue || '').trim();
    if(!raw) return '';

    const low = raw.toLowerCase();

    // Cloudflare Rocket Loader が
    //   type="xxxxxxxx-text/javascript"
    // のように変形している場合がある。
    // これをそのまま引き継ぐとブラウザが実行しないため、
    // 通常の executable な JavaScript type に正規化する。
    if(
      low === 'text/javascript' ||
      low === 'application/javascript' ||
      low === 'module' ||
      low.endsWith('-text/javascript') ||
      low.endsWith('-application/javascript')
    ){
      return (low === 'module') ? 'module' : 'text/javascript';
    }

    // それ以外で "javascript" を含むタイプも安全側で実行可能扱いに寄せる
    if(low.includes('javascript')){
      return 'text/javascript';
    }

    // JSON 等の非JS type はそのまま維持
    return raw;
  }

  function patchRbBattlemapScriptForDbaApi(scriptText){
    const src = String(scriptText || '');
    if(!src) return src;
    if(mode !== 'rb') return src;
    if(src.includes('window.__DBA_RB_API')) return src;
    if(!src.includes('const GRID_SIZE') || !src.includes('function drawStatic()') || !src.includes('const buildingsPayload')) return src;

    let patched = src;

    patched = patched.replace(
      'const HAS_CAPITAL = !!(fow && fow.hasCapital);',
      'let HAS_CAPITAL = !!(fow && fow.hasCapital);'
    );

    patched = patched.replace(
      'let borderPx = 2;',
      `let borderPx = 2;
        let dbaAnimRaf = 0;
        function dbaShouldStopAnimation(){
          try{
            const raw = localStorage.getItem('dba.settings.v1');
            if(!raw) return false;
            const obj = JSON.parse(raw);
            return !!(obj && obj.rbLayer && obj.rbLayer.stopAnimation);
          }catch(_e){
            return false;
          }
        }
        function dbaOverlayTime(t){
          return dbaShouldStopAnimation() ? 0 : (t || 0);
        }`
    );

    patched = patched.replace(
      'octx.lineDashOffset = -(t * ANT_SPEED);',
      'octx.lineDashOffset = -(dbaOverlayTime(t) * ANT_SPEED);'
    );

    patched = patched.replace(
      /function\s+loop\s*\(\s*t\s*\)\s*\{\s*drawOverlay\s*\(\s*t\s*\|\|\s*0\s*\)\s*;\s*requestAnimationFrame\s*\(\s*loop\s*\)\s*;\s*\}/,
      `function loop(t){
         dbaAnimRaf = 0;
         drawOverlay(t||0);
         if(dbaShouldStopAnimation()) return;
         dbaAnimRaf = requestAnimationFrame(loop);
       }`
    );

    patched = patched.replace(
      /drawStatic\s*\(\s*\)\s*;\s*drawOverlay\s*\(\s*performance\.now\s*\(\s*\)\s*\)\s*;\s*requestAnimationFrame\s*\(\s*loop\s*\)\s*;/,
      `drawStatic();
       drawOverlay(performance.now());
       if(!dbaShouldStopAnimation()){
         dbaAnimRaf = requestAnimationFrame(loop);
       }`
    );

    const injected = `
      function dbaClearPlainObject(obj){
        if(!obj || typeof obj !== 'object') return;
        for(const k in obj){
          if(Object.prototype.hasOwnProperty.call(obj, k)) delete obj[k];
        }
      }

      function dbaReplacePlainObject(dst, src){
        dbaClearPlainObject(dst);
        if(!src || typeof src !== 'object') return;
        for(const k of Object.keys(src)){
          dst[k] = src[k];
        }
      }

      function dbaReplaceSet(dst, values){
        if(!dst || typeof dst.clear !== 'function') return;
        dst.clear();
        if(!Array.isArray(values)) return;
        for(const v of values){
          dst.add(String(v));
        }
      }

      function dbaStopAnimationLoopHard(){
        try{
          if(dbaAnimRaf){
            cancelAnimationFrame(dbaAnimRaf);
            dbaAnimRaf = 0;
          }
        }catch(_e){}
      }

      function dbaFogStateAt(r,c){
        if(!fow) return 2;
        if(!HAS_CAPITAL) return 2;
        const k = String(r) + '-' + String(c);
        if(visibleSet.has(k)) return 2;
        if(exploredSet.has(k)) return 1;
        return 0;
      }

      function dbaClearFogCellWithCtx(ctx, r, c){
        if(!ctx) return;
        const dx = c * CELL;
        const dy = r * CELL;
        ctx.clearRect(dx, dy, CELL, CELL);
      }

      function dbaClearFogCell(r,c){
        dbaClearFogCellWithCtx(fctx, r, c);
      }

      function dbaPaintFogCellWithCtx(ctx, r, c){
        if(!ctx) return;
        dbaClearFogCellWithCtx(ctx, r, c);
        const s = dbaFogStateAt(r,c);
        if(s===2) return;

        const n = (s===0 ? FOG_CLOUD_PUFFS_UNKNOWN : FOG_CLOUD_PUFFS_EXPLORED);
        const a = (s===0 ? 0.12 : 0.07);
        const baseSeed = u32((r+1)*73856093 ^ (c+1)*19349663 ^ (GRID_SIZE*83492791) ^ (CELL*2654435761));

        for(let i=0;i<n;i++){
          const r1 = rand01(baseSeed ^ u32(i*0x9e3779b1));
          const r2 = rand01(baseSeed ^ u32(i*0x85ebca6b));
          const r3 = rand01(baseSeed ^ u32(i*0xc2b2ae35));

          const x   = c*CELL + r1*CELL;
          const y   = r*CELL + r2*CELL;
          const rad = r3*(CELL*0.7);

          ctx.beginPath();
          ctx.arc(x,y,rad,0,Math.PI*2);
          ctx.fillStyle = 'rgba(0,0,0,' + String(a) + ')';
          ctx.fill();
        }
      }

      function dbaPaintFogCell(r,c){
        dbaPaintFogCellWithCtx(fctx, r, c);
      }

      function dbaClearBaseCellWithCtx(ctx, r, c){
        if(!ctx) return;
        const dx = c * CELL;
        const dy = r * CELL;
        ctx.clearRect(dx, dy, CELL, CELL);
      }

      function dbaPaintTerrainCellWithCtx(ctx, r, c){
        if(!ctx) return;
        if(r<0 || c<0 || r>=GRID_SIZE || c>=GRID_SIZE) return;

        const k = String(r) + '-' + String(c);
        const dx = c * CELL;
        const dy = r * CELL;

        dbaClearBaseCellWithCtx(ctx, r, c);

        const tidx = terrainMap[k] ?? 0;
        const tsx = tidx * 128;
        ctx.drawImage(terrainImg, tsx, 0, 128, 128, dx, dy, CELL, CELL);
      }

      function dbaPaintColorCellWithCtx(ctx, r, c){
        if(!ctx) return;
        if(r<0 || c<0 || r>=GRID_SIZE || c>=GRID_SIZE) return;

        const k = String(r) + '-' + String(c);
        const dx = c * CELL;
        const dy = r * CELL;

        if(showTint){
          const t = teamMap[k] || 0;
          const fill = tintForTeam(t);
          if(fill){
            ctx.fillStyle = fill;
            ctx.fillRect(dx, dy, CELL, CELL);
          }
        }
      }

      function dbaPaintBuildingCellWithCtx(ctx, r, c){
        if(!ctx) return;
        if(r<0 || c<0 || r>=GRID_SIZE || c>=GRID_SIZE) return;

        const k = String(r) + '-' + String(c);
        const dx = c * CELL;
        const dy = r * CELL;

        const s = dbaFogStateAt(r,c);
        const b = buildingsMap[k];
        if(!b || s === 0) return;

        const WALLS_COL = 3;
        const RADAR_COL = 4;
        const col = (b.kind==='f' ? WALLS_COL : RADAR_COL);

        // 建造物の所有者は、snapshot 側では buildingsMap[k].owner に入っている。
        // まず owner を優先し、無ければ従来どおり teamMap にフォールバックする。
        let ownerTeam = 0;
        const ownerRaw = String(b.owner ?? '').trim().toLowerCase();
        if(ownerRaw === 'red'){
          ownerTeam = 1;
        }else if(ownerRaw === 'blue'){
          ownerTeam = 2;
        }else{
          ownerTeam = teamMap[k] || 0;
        }

        const ownerRow = (ownerTeam===2 ? 1 : (ownerTeam===1 ? 2 : 0));

        if(s===1){
          ctx.save();
          ctx.globalAlpha = 0.60;
          ctx.drawImage(buildingImg, col * 128, 0, 128, 128, dx, dy, CELL, CELL);
          ctx.restore();
        }else{
          ctx.drawImage(buildingImg, col * 128, ownerRow * 128, 128, 128, dx, dy, CELL, CELL);
        }
      }

      function dbaPaintCapitalCellWithCtx(ctx, r, c){
        if(!ctx) return;
        if(r<0 || c<0 || r>=GRID_SIZE || c>=GRID_SIZE) return;

        const k = String(r) + '-' + String(c);
        if(!capitalSet.has(k)) return;

        const dx = c * CELL;
        const dy = r * CELL;
        const OUTPOST_COL = 0;
        const COMMAND_COL = 1;
        const HQ_COL      = 2;

        function capColForTeam(team){
          const WEAK = 0.20;
          const OK   = 0.55;
          if(team===1){
            const f = ownership.redFrac;
            if(f < WEAK) return OUTPOST_COL;
            if(f < OK)   return COMMAND_COL;
            return HQ_COL;
          }
          if(team===2){
            const f = ownership.blueFrac;
            if(f < WEAK) return OUTPOST_COL;
            if(f < OK)   return COMMAND_COL;
            return HQ_COL;
          }
          return HQ_COL;
        }

        const team = teamMap[k] || 0;
        const row = (team===2 ? 1 : (team===1 ? 2 : 0));
        const col = capColForTeam(team);
        ctx.drawImage(buildingImg, col * 128, row * 128, 128, 128, dx, dy, CELL, CELL);
      }

      function dbaPaintBaseOverlayCellWithCtx(ctx, r, c){
        if(!ctx) return;
        if(r<0 || c<0 || r>=GRID_SIZE || c>=GRID_SIZE) return;
        dbaPaintColorCellWithCtx(ctx, r, c);
        dbaPaintBuildingCellWithCtx(ctx, r, c);
        dbaPaintCapitalCellWithCtx(ctx, r, c);
      }







      function dbaPaintBaseCellWithCtx(ctx, r, c){
        if(!ctx) return;
        if(r<0 || c<0 || r>=GRID_SIZE || c>=GRID_SIZE) return;
        dbaPaintTerrainCellWithCtx(ctx, r, c);
        dbaPaintBaseOverlayCellWithCtx(ctx, r, c);
      }

      function dbaPaintBaseCell(r,c){
        dbaPaintBaseCellWithCtx(bctx, r, c);
      }

      function dbaCreateCanvasBufferLike(canvasId){
        try{
          const src = document.getElementById(canvasId);
          if(!src || !src.width || !src.height) return null;
          const cv = document.createElement('canvas');
          cv.width = src.width;
          cv.height = src.height;
          const ctx = cv.getContext('2d');
          if(!ctx) return null;
          ctx.drawImage(src, 0, 0);
          return { canvas: cv, ctx: ctx };
        }catch(_e){
          return null;
        }
      }

      function dbaCreateBlankCanvasLike(canvasId){
        try{
          const src = document.getElementById(canvasId);
          if(!src || !src.width || !src.height) return null;
          const cv = document.createElement('canvas');
          cv.width = src.width;
          cv.height = src.height;
          const ctx = cv.getContext('2d');
          if(!ctx) return null;
          return { canvas: cv, ctx: ctx };
        }catch(_e){
          return null;
        }
      }

      const dbaTerrainOnlyBuf = dbaCreateBlankCanvasLike('gridBase');
      let dbaTerrainOnlyBufReady = false;

      function dbaEnsureTerrainOnlyBuffer(){
        if(!dbaTerrainOnlyBuf || !dbaTerrainOnlyBuf.ctx) return null;
        if(dbaTerrainOnlyBufReady) return dbaTerrainOnlyBuf;
        for(let rr=0; rr<GRID_SIZE; rr++){
          for(let cc=0; cc<GRID_SIZE; cc++){
            dbaPaintTerrainCellWithCtx(dbaTerrainOnlyBuf.ctx, rr, cc);
          }
        }
        dbaTerrainOnlyBufReady = true;
        return dbaTerrainOnlyBuf;
      }

      function dbaCopyCellFromCanvas(ctx, srcCanvas, r, c){
        try{
          if(!ctx || !srcCanvas) return;
          if(r<0 || c<0 || r>=GRID_SIZE || c>=GRID_SIZE) return;
          const dx = c * CELL;
          const dy = r * CELL;
          ctx.clearRect(dx, dy, CELL, CELL);
          ctx.drawImage(srcCanvas, dx, dy, CELL, CELL, dx, dy, CELL, CELL);
        }catch(_e){}
      }

      function dbaBlitCellFromBuffer(ctx, srcCanvas, r, c){
        try{
          if(!ctx || !srcCanvas) return;
          if(r<0 || c<0 || r>=GRID_SIZE || c>=GRID_SIZE) return;
          const dx = c * CELL;
          const dy = r * CELL;
          ctx.drawImage(srcCanvas, dx, dy, CELL, CELL, dx, dy, CELL, CELL);
        }catch(_e){}
      }

      function dbaCommitCanvasBuffer(ctx, dstCanvas, srcCanvas, opts){
        try{
          if(!ctx || !dstCanvas || !srcCanvas) return false;

          const clearFirst = !!(opts && opts.clearFirst);

          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          if(clearFirst){
            ctx.clearRect(0, 0, dstCanvas.width, dstCanvas.height);
          }
          ctx.drawImage(srcCanvas, 0, 0);
          ctx.restore();
          return true;
        }catch(_e){
          return false;
        }
      }

      function dbaNormalizeChangedMeta(changedMeta){
        const out = Object.create(null);
        if(!Array.isArray(changedMeta)) return out;
        for(const it of changedMeta){
          if(!it) continue;
          const r = Number(it.row);
          const c = Number(it.col);
          if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
          const k = String(r) + '-' + String(c);
          out[k] = {
            base: !!it.base,
            fog: !!it.fog,
            overlay: !!it.overlay,
            terrain: !!it.terrain,
            color: !!it.color,
            building: !!it.building,
            capital: !!it.capital,
            avatar: !!it.avatar
          };
        }
        return out;
      }

      function dbaReplaceAvatarTiles(nextTiles){
        try{
          for(const k in avatarsByTile){
            if(Object.prototype.hasOwnProperty.call(avatarsByTile, k)){
              delete avatarsByTile[k];
            }
          }
          const src = (nextTiles && typeof nextTiles === 'object') ? nextTiles : Object.create(null);
          for(const k of Object.keys(src)){
            const arr = Array.isArray(src[k]) ? src[k] : [];
            avatarsByTile[k] = arr.map((it) => ({
              row: Number((k.split('-')[0])) || 0,
              col: Number((k.split('-')[1])) || 0,
              team: Number(it && it.team || 0),
              armor: null,
              key: String(it && it.key || 'ac'),
              isSelf: !!(it && it.isSelf)
            }));
          }
          if(typeof sortAvatarsForDraw === 'function'){
            sortAvatarsForDraw();
          }
          return true;
        }catch(_e){
          return false;
        }
      }

      function dbaApplySnapshot(nextSnap, changedCells, changedMeta){
        try{
          if(!nextSnap || typeof nextSnap !== 'object') return false;
          if(Number(nextSnap.rows) !== GRID_SIZE || Number(nextSnap.cols) !== GRID_SIZE) return false;
          if(!!nextSnap.hasCapital !== !!HAS_CAPITAL) return false;

          const beforeRed = ownership.redTiles;
          const beforeBlue = ownership.blueTiles;

          dbaReplacePlainObject(teamMap, dbaBuildTeamMapFromCellColors(nextSnap.cellColors || Object.create(null)));
          dbaReplaceSet(capitalSet, Array.isArray(nextSnap.capitalKeys) ? nextSnap.capitalKeys : []);
          dbaReplacePlainObject(terrainMap, nextSnap.terrainMap || Object.create(null));
          dbaReplacePlainObject(buildingsMap, nextSnap.buildingsMap || Object.create(null));
          dbaReplaceAvatarTiles(nextSnap.avatarsMap || Object.create(null));
          dbaReplaceSet(visibleSet, Array.isArray(nextSnap.visibleKeys) ? nextSnap.visibleKeys : []);
          dbaReplaceSet(exploredSet, Array.isArray(nextSnap.exploredKeys) ? nextSnap.exploredKeys : []);

          if(fow && typeof fow === 'object'){
            fow.hasCapital = !!nextSnap.hasCapital;
            fow.visible = Array.isArray(nextSnap.visibleList) ? nextSnap.visibleList.slice() : [];
            fow.explored = Array.isArray(nextSnap.exploredList) ? nextSnap.exploredList.slice() : [];
          }

          if(avatarsPayload && typeof avatarsPayload === 'object'){
            const nextRows = [];
            const amap = (nextSnap && nextSnap.avatarsMap && typeof nextSnap.avatarsMap === 'object') ? nextSnap.avatarsMap : Object.create(null);
            for(const kk of Object.keys(amap)){
              const parts = String(kk).split('-');
              const rr = Number(parts[0]);
              const cc = Number(parts[1]);
              if(!Number.isFinite(rr) || !Number.isFinite(cc)) continue;
              const arr = Array.isArray(amap[kk]) ? amap[kk] : [];
              for(const av of arr){
                nextRows.push({
                  row: rr,
                  col: cc,
                  team: Number(av && av.team || 0) === 1 ? 'red' : (Number(av && av.team || 0) === 2 ? 'blue' : ''),
                  armor: String(av && av.key || 'ac'),
                  isSelf: !!(av && av.isSelf)
                });
              }
            }
            avatarsPayload.avatars = nextRows;
            if(nextSnap.selfAvatar && typeof nextSnap.selfAvatar === 'object'){
              avatarsPayload.myAvatar = {
                row: Number(nextSnap.selfAvatar.row),
                col: Number(nextSnap.selfAvatar.col),
                team: Number(nextSnap.selfAvatar.team || 0) === 1 ? 'red' : (Number(nextSnap.selfAvatar.team || 0) === 2 ? 'blue' : ''),
                armor: String(nextSnap.selfAvatar.key || 'ac')
              };
            }
          }

          HAS_CAPITAL = !!nextSnap.hasCapital;
          recomputeOwnership();

          const paint = new Set();
          if(Array.isArray(changedCells)){
            for(const rc of changedCells){
              if(!rc) continue;
              const r = Number(rc.row);
              const c = Number(rc.col);
              if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
              paint.add(String(r) + '-' + String(c));
            }
          }

          if(beforeRed !== ownership.redTiles || beforeBlue !== ownership.blueTiles){
            for(const k of capitalSet){
              paint.add(String(k));
            }
          }

          const paintList = Array.from(paint);
          const metaMap = dbaNormalizeChangedMeta(changedMeta);
          const baseBuf = (paintList.length > 0) ? dbaCreateCanvasBufferLike('gridBase') : null;
          const fogBuf  = (paintList.length > 0) ? dbaCreateCanvasBufferLike('gridFog')  : null;
          const terrainBuf = (paintList.length > 0) ? dbaEnsureTerrainOnlyBuffer() : null;
          const useBufferedBlit = !!(baseBuf && baseBuf.ctx && fogBuf && fogBuf.ctx);
          let needOverlayRedraw = false;

          for(const k of paintList){
            const m = String(k).match(/^(\\d+)-(\\d+)$/);
            if(!m) continue;
            const r = Number(m[1]);
            const c = Number(m[2]);
            const meta = metaMap[k] || {
              base:true,
              fog:false,
              overlay:false,
              terrain:false,
              color:false,
              building:false,
              capital:true,
              avatar:false
            };

            const doBase = !!meta.base;
            const doFog = !!meta.fog;
            const doOverlay = !!meta.overlay;

            if(doOverlay) needOverlayRedraw = true;

            if(useBufferedBlit){
              if(doBase){
                if(terrainBuf && terrainBuf.ctx){
                  const needsWholeBaseRebuild = !!(meta.terrain || meta.color || meta.capital || meta.building);

                  if(needsWholeBaseRebuild){
                    if(meta.terrain){
                      dbaPaintTerrainCellWithCtx(terrainBuf.ctx, r, c);
                    }
                    dbaCopyCellFromCanvas(baseBuf.ctx, terrainBuf.canvas, r, c);
                    dbaPaintBaseOverlayCellWithCtx(baseBuf.ctx, r, c);
                  }else{
                    // 念のための保険
                    dbaCopyCellFromCanvas(baseBuf.ctx, terrainBuf.canvas, r, c);
                    dbaPaintBaseOverlayCellWithCtx(baseBuf.ctx, r, c);
                  }
                }else{
                  dbaPaintBaseCellWithCtx(baseBuf.ctx, r, c);
                }
              }
              if(doFog){
                dbaPaintFogCellWithCtx(fogBuf.ctx, r, c);
              }
            }else{
              if(doBase){
                dbaPaintBaseCell(r,c);
              }
              if(doFog){
                dbaPaintFogCell(r,c);
              }
            }
          }

          if(useBufferedBlit){
            let needBaseCommit = false;
            let needFogCommit = false;

            for(const k of paintList){
              const m = String(k).match(/^(\\d+)-(\\d+)$/);
              if(!m) continue;
              const r = Number(m[1]);
              const c = Number(m[2]);
              const meta = metaMap[k] || {
                base:true,
                fog:false,
                overlay:false,
                terrain:false,
                color:false,
                building:false,
                capital:true,
                avatar:false
              };

              if(meta.base){
                needBaseCommit = true;
              }
              if(meta.fog){
                needFogCommit = true;
              }
            }

            // 画面に出ている canvas をセル単位で clearRect しながら更新すると、
            // 差分更新時に黒いちらつきが見えやすい。
            // そのため、オフスクリーン側で差分反映を済ませてから、
            // 最後に 1 回だけまとめてコミットする。
            const baseCanvasEl = document.getElementById('gridBase');
            const fogCanvasEl  = document.getElementById('gridFog');

            if(needBaseCommit && baseCanvasEl){
              dbaCommitCanvasBuffer(bctx, baseCanvasEl, baseBuf.canvas, { clearFirst:false });
            }
            if(needFogCommit && fogCanvasEl){
              dbaCommitCanvasBuffer(fctx, fogCanvasEl, fogBuf.canvas, { clearFirst:true });
            }
          }

          fogDirty = false;
          if(needOverlayRedraw){
            drawOverlay(performance.now());
          }
          return true;
        }catch(_e){
          return false;
        }
      }

      window.__DBA_RB_API = {
        version: 3,
        applySnapshot: dbaApplySnapshot,
        redrawOverlay: function(){
          try{
            drawOverlay(dbaShouldStopAnimation() ? 0 : performance.now());
            return true;
          }catch(_e){
            return false;
          }
        },
        stopAnimation: function(){
          try{
            dbaStopAnimationLoopHard();
            drawOverlay(0);
            return true;
          }catch(_e){
            return false;
          }
        },
        resumeAnimation: function(){
          try{
            dbaStopAnimationLoopHard();
            drawOverlay(performance.now());
            if(!dbaShouldStopAnimation()){
              dbaAnimRaf = requestAnimationFrame(loop);
            }
            return true;
          }catch(_e){
            return false;
          }
        }
      };
    `;

    if(/\}\)\(\);\s*$/.test(patched)){
      patched = patched.replace(/\}\)\(\);\s*$/, injected + '\n})();');
    }
    return patched;
  }

  function prepareImportedBattlemapScripts(root){
    if(mode !== 'rb' || !root) return;
    const scripts = Array.from(root.querySelectorAll('script'));
    for(const sc of scripts){
      const txt = String(sc.textContent || '');
      if(!txt) continue;
      if(!txt.includes('const GRID_SIZE')) continue;
      if(!txt.includes('function drawStatic()')) continue;
      if(!txt.includes('const buildingsPayload')) continue;
      const patched = patchRbBattlemapScriptForDbaApi(txt);
      sc.textContent = patched;
      try{
        const okLoop = patched.includes('if(dbaShouldStopAnimation()) return;');
        const okMain = patched.includes('if(!dbaShouldStopAnimation()){');
        console.log('[DBA][RB][PATCH]', { okLoop, okMain });
      }catch(_e){}
      break;
    }
  }

  function reactivateScriptsWithin(root){
    if(!root) return 0;
    const scripts = Array.from(root.querySelectorAll('script'));
    let count = 0;
    for(const old of scripts){
      const s = document.createElement('script');

      // Rocket Loader 由来の変形 type を実行可能な JavaScript type に戻す
      const normalizedType = normalizeExecutableScriptType(old.type);
      if(normalizedType){
        s.type = normalizedType;
      }

      if(old.noModule) s.noModule = true;

      // src は本ページでは基本使われていない想定だが、一応コピー
      if(old.src){
        s.src = old.src;
      }else{
        s.textContent = old.textContent || '';
      }
      old.replaceWith(s);
      count++;
    }
    return count;
  }

  function validateBattlemapAfterRefresh(){
    try{
      if(mode === 'rb'){
        const wrap = document.getElementById('gridWrap');
        const base = document.getElementById('gridBase');
        const ovl  = document.getElementById('gridOverlay');
        const ok = !!(wrap && base && ovl);
        return { ok, detail: { hasGridWrap: !!wrap, hasGridBase: !!base, hasGridOverlay: !!ovl } };
      }
      const grid = document.querySelector('.grid');
      if(!grid) return { ok:false, detail:{ hasGrid:false, cellCount:0 } };
      const cellCount = grid.querySelectorAll('.cell').length;
      // 0 だと、差し替え後のIIFEが実行されていない可能性が高い
      const ok = cellCount > 0;
      return { ok, detail:{ hasGrid:true, cellCount } };
    }catch(e){
      return { ok:false, detail:{ error: String(e && e.message ? e.message : e) } };
    }
  }

  // =========================
  // バトルマップ差し替え（fetch済み doc を使って差し替え）
  //  - updateOnlyChangedCellsFromTopPage の (2-3) で、
  //    既に取得済みの最新HTML/Docを再利用して「最新版への差し替え（再描画）」を行うためのヘルパー
  // =========================
  async function refreshBattlemapFromFetchedDoc(doc, meta){
    const topUrl = meta?.topUrl || makeTeambattleUrl({ m: mode });
    const t0 = performance.now();
    const sx = window.scrollX;
    const sy = window.scrollY;

    dbgLog('battlemapRefresh', 'info', 'REFRESH(pre-fetched) start', { mode, topUrl, scrollX: sx, scrollY: sy });

    const curRoot = findCurrentBattlemapRoot();
    if(!curRoot){
      dbgLog('battlemapRefresh', 'warn', 'REFRESH(pre-fetched) skipped: current battlemap root not found', { mode, topUrl });
      return false;
    }
    if(!doc){
      dbgLog('battlemapRefresh', 'warn', 'REFRESH(pre-fetched) skipped: doc is null', { mode, topUrl });
      return false;
    }

    try{
      const fetchedRoot = findFetchedBattlemapRoot(doc);
      if(!fetchedRoot){
        dbgLog('battlemapRefresh', 'warn', 'REFRESH(pre-fetched) failed: fetched battlemap root not found', { mode, topUrl });
        return false;
      }

      const parent = curRoot.parentNode;
      if(!parent){
        dbgLog('battlemapRefresh', 'warn', 'REFRESH(pre-fetched) failed: current root has no parent', { mode, topUrl });
        return false;
      }

      // ★追加：header + チーム情報2テーブル も最新ページ情報で差し替え
      // （マップ差し替え前後どちらでも良いが、ここでは同じ doc を使って先に更新）
      await refreshHeaderAndTeamTablesFromFetchedDoc(doc, {
        topUrl,
        snapshot: getBattlemapSnapshotFromDoc(doc)
      });

      const imported = document.importNode(fetchedRoot, true);
      prepareImportedBattlemapScripts(imported);
      parent.replaceChild(imported, curRoot);

      const reactivated = reactivateScriptsWithin(imported);
      dbgLog('battlemapRefresh', 'info', 'REFRESH(pre-fetched) scripts reactivated', { mode, topUrl, scripts: reactivated });

      await raf2();
      window.scrollTo(sx, sy);

      applyCurrentModeScale();
      if(mode === 'rb') ensureRbPointerFix();
      scheduleBattlemapLayerSync();

      const v = validateBattlemapAfterRefresh();
      const dt = Math.round(performance.now() - t0);
      if(v.ok){
        setBattlemapSnapshotCache(meta?.snapshot || getBattlemapSnapshotFromDoc(doc), 'refreshBattlemapFromFetchedDoc');
        dbgLog('battlemapRefresh', 'info', 'REFRESH(pre-fetched) success', { mode, topUrl, ms: dt, ...v.detail });
      }else{
        dbgLog('battlemapRefresh', 'warn', 'REFRESH(pre-fetched) failed: validation NG', { mode, topUrl, ms: dt, ...v.detail });
      }
      return v.ok;
    }catch(e){
      dbgLog('battlemapRefresh', 'error', 'REFRESH(pre-fetched) exception', { mode, topUrl, error: String(e && e.message ? e.message : e) });
      try{ window.scrollTo(sx, sy); }catch(_e){}
      return false;
    }
  }

  async function refreshBattlemapFromTopPage(){
    const topUrl = makeTeambattleUrl({ m: mode });
    const t0 = performance.now();
    const sx = window.scrollX;
    const sy = window.scrollY;

    dbgLog('battlemapRefresh', 'info', 'REFRESH start', { mode, topUrl, scrollX: sx, scrollY: sy });

    const curRoot = findCurrentBattlemapRoot();
    if(!curRoot){
      dbgLog('battlemapRefresh', 'warn', 'REFRESH skipped: current battlemap root not found', { mode, topUrl });
      return false;
    }

    try{
      const res = await fetch(topUrl, { method:'GET', credentials:'include', cache:'no-store' });
      if(!res.ok){
        dbgLog('battlemapRefresh', 'warn', 'REFRESH fetch failed', { mode, topUrl, status: res.status, statusText: res.statusText });
        return false;
      }
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // ★追加：戦況情報実行時は header + チーム情報2テーブル も最新版へ差し替え
      await refreshHeaderAndTeamTablesFromFetchedDoc(doc, {
        topUrl,
        snapshot: getBattlemapSnapshotFromDoc(doc)
      });

      const fetchedRoot = findFetchedBattlemapRoot(doc);
      if(!fetchedRoot){
        dbgLog('battlemapRefresh', 'warn', 'REFRESH failed: fetched battlemap root not found', { mode, topUrl, htmlLen: html?.length || 0 });
        return false;
      }

      // DOM差し替え（位置/スクロール維持）
      const parent = curRoot.parentNode;
      if(!parent){
        dbgLog('battlemapRefresh', 'warn', 'REFRESH failed: current root has no parent', { mode, topUrl });
        return false;
      }

      const imported = document.importNode(fetchedRoot, true);
      parent.replaceChild(imported, curRoot);

      // inert script を再生成して実行
      const reactivated = reactivateScriptsWithin(imported);
      dbgLog('battlemapRefresh', 'info', 'REFRESH scripts reactivated', { mode, topUrl, scripts: reactivated });

      // 2 raf 待機（スクリプトによるDOM反映・描画を待つ）
      await raf2();

      // スクロール維持（差し替えによる微妙なレイアウト変動でズレるのを戻す）
      window.scrollTo(sx, sy);

      // スケール・ポインタ補正・レイヤー追従を再適用
      applyCurrentModeScale();
      if(mode === 'rb') ensureRbPointerFix();
      scheduleBattlemapLayerSync();

      const v = validateBattlemapAfterRefresh();
      const dt = Math.round(performance.now() - t0);
      if(v.ok){
        setBattlemapSnapshotCache(getBattlemapSnapshotFromDoc(doc), 'refreshBattlemapFromTopPage');
        dbgLog('battlemapRefresh', 'info', 'REFRESH success', { mode, topUrl, ms: dt, ...v.detail });
      }else{
        dbgLog('battlemapRefresh', 'warn', 'REFRESH failed: validation NG', { mode, topUrl, ms: dt, ...v.detail });
      }
      return v.ok;
    }catch(e){
      dbgLog('battlemapRefresh', 'error', 'REFRESH exception', { mode, topUrl, error: String(e && e.message ? e.message : e) });
      try{ window.scrollTo(sx, sy); }catch(_e){}
      return false;
    }
  }

  function textIncludesJP(s, keyword){
    return sanitizeText(s).includes(keyword);
  }

  function parseCellDetailHTML(htmlText, ctx){
    try{
      const doc = new DOMParser().parseFromString(htmlText, 'text/html');
      const tables = Array.from(doc.querySelectorAll('table'));
      dbgLog('battleInfo', 'info', 'PARSE start', {
        row: ctx?.row, col: ctx?.col, mode: ctx?.mode, url: ctx?.url,
        tables: tables.length,
        htmlLen: (htmlText && htmlText.length) ? htmlText.length : 0
      });

      if(tables.length === 0){
        dbgLog('battleInfo', 'warn', 'PARSE no table', { row: ctx?.row, col: ctx?.col, mode: ctx?.mode, url: ctx?.url });
        return { holder: '---', reg: '---' };
      }

      // 「ホルダー」ヘッダーを持つ table を優先して探す（モード差・余計なtable混在対策）
      let targetTable = null;
      for(const t of tables){
        const ths = Array.from(t.querySelectorAll('tr th')).map(th => sanitizeText(th.textContent));
        if(ths.some(x => x.includes('ホルダー'))){
          targetTable = t;
          break;
        }
      }
      if(!targetTable) targetTable = tables[0];

      // ヘッダー行（th を含む tr）を特定
      const headerTr = targetTable.querySelector('tr:has(th)') || targetTable.querySelector('tr');
      const thList = headerTr ? Array.from(headerTr.querySelectorAll('th')).map(th => sanitizeText(th.textContent)) : [];
      let holderIdx = -1;
      for(let i=0;i<thList.length;i++){
        if(thList[i].includes('ホルダー')){
          holderIdx = i;
          break;
        }
      }

      dbgLog('info', 'PARSE table selected', {
        row: ctx?.row, col: ctx?.col, mode: ctx?.mode, url: ctx?.url,
        ths: thList,
        holderIdx
      });
      dbgLog('battleInfo', 'info', 'PARSE table selected', {
        row: ctx?.row, col: ctx?.col, mode: ctx?.mode, url: ctx?.url,
        ths: thList,
        holderIdx
      });

      // データ行を取得（th行を避けて最初のtd行）
      const trs = Array.from(targetTable.querySelectorAll('tr'));
      let dataTr = null;
      for(const tr of trs){
        if(tr.querySelector('td')){
          dataTr = tr;
          break;
        }
      }
      if(!dataTr){
        dbgLog('battleInfo', 'warn', 'PARSE no data tr', {
          row: ctx?.row, col: ctx?.col, mode: ctx?.mode, url: ctx?.url,
          trCount: trs.length
        });
        return { holder: '---', reg: '---' };
      }

      const tds = Array.from(dataTr.querySelectorAll('td'));
      dbgLog('battleInfo', 'info', 'PARSE data row', {
        row: ctx?.row, col: ctx?.col, mode: ctx?.mode, url: ctx?.url,
        tdCount: tds.length
      });

      // holderIdx が取れない/範囲外のときは、従来通り “2列目” をフォールバック
      const idx = (holderIdx >= 0 && holderIdx < tds.length) ? holderIdx : 1;
      const tdHolder = (tds.length > idx) ? tds[idx] : null;
      if(!tdHolder){
        dbgLog('battleInfo', 'warn', 'PARSE no holder td', {
          row: ctx?.row, col: ctx?.col, mode: ctx?.mode, url: ctx?.url,
          idx
        });
        return { holder: '---', reg: '---' };
      }

      // 抽出（strong/small 優先、無ければテキストから推測）
      const holderEl = tdHolder.querySelector('strong');
      const regEl = tdHolder.querySelector('small');

      const tdTextRaw = sanitizeText(tdHolder.textContent);
      let holder = sanitizeText(holderEl ? holderEl.textContent : '');
      let reg = sanitizeText(regEl ? regEl.textContent : '');

      if(!holder){
        // 「エリアに挑む」等のボタン文言以降は捨てる
        holder = tdTextRaw
          .replace(/エリアに挑む.*$/,'')
          .replace(/エリアに挑戦.*$/,'')
          .trim();
      }
      if(!reg){
        // [N]から[SR]まで / [SSR]まで 等をテキストから拾う
        const m = tdTextRaw.match(/\[[^\]]+\](?:から\[[^\]]+\])?まで/);
        reg = sanitizeText(m ? m[0] : '');
      }

      // ★追加：レギュレーション表示を指定ルールで簡略化
      // - regEl が短い（例：[R]まで）場合でも、tdTextRaw 側に [警備員] / [エリート] が混在する可能性があるため、
      //   ここでは tdTextRaw を優先して判定材料にする（ただし base の抽出は [N]/[R]/[SR]/[SSR]/[UR] に限定している）
      reg = simplifyRegulationText(tdTextRaw || reg);

      dbgLog('battleInfo', 'info', 'PARSE extracted', {
        row: ctx?.row, col: ctx?.col, mode: ctx?.mode, url: ctx?.url,
        holder, reg,
        tdTextSample: tdTextRaw.slice(0, 140)
      });

      const out = { holder: holder || '---', reg: reg || '---' };
      if(out.holder === '---' && out.reg === '---'){
        // 失敗時だけ、HTML先頭を少し出す（巨大ログ回避）
        dbgLog('battleInfo', 'warn', 'PARSE result is ---/---', {
          row: ctx?.row, col: ctx?.col, mode: ctx?.mode, url: ctx?.url,
          htmlHead: String(htmlText || '').slice(0, 400)
        });
      }
      return out;
    }catch(_e){
      dbgLog('battleInfo', 'error', 'PARSE exception', {
        row: ctx?.row, col: ctx?.col, mode: ctx?.mode, url: ctx?.url,
        error: String(_e && _e.message ? _e.message : _e)
      });
      return { holder: '---', reg: '---' };
    }
  }

  async function fetchCellDetail(row, col){
    const url = makeTeambattleUrl({ r: row, c: col, m: mode });
    try{
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      });
      if(!res.ok){
        dbgLog('battleInfo', 'warn', 'FAIL fetch', { row, col, mode, status: res.status, statusText: res.statusText, url });
        throw new Error(`HTTP ${res.status}`);
      }
      dbgLog('battleInfo', 'info', 'OK fetch', { row, col, mode, status: res.status, url });
      const html = await res.text();
      const parsed = parseCellDetailHTML(html, { row, col, mode, url });
      if(parsed && parsed.holder === '---' && parsed.reg === '---'){
        dbgLog('battleInfo', 'warn', 'FETCH ok but PARSE returned ---/---', { row, col, mode, url });
      }
      return parsed;
    }catch(e){
      dbgLog('battleInfo', 'warn', 'FAIL fetch (exception)', { row, col, mode, url, error: String(e && e.message ? e.message : e) });
      throw e;
    }
  }

  async function mapLimit(items, limit, mapper){
    const results = new Array(items.length);
    let i = 0;
    let active = 0;
    return await new Promise((resolve) => {
      const next = () => {
        while(active < limit && i < items.length){
          const idx = i++;
          active++;
          Promise.resolve()
            .then(() => mapper(items[idx], idx))
            .then((val) => { results[idx] = val; })
            .catch((err) => { results[idx] = { error: err }; })
            .finally(() => {
              active--;
              if(i >= items.length && active === 0) resolve(results);
              else next();
            });
        }
        if(items.length === 0) resolve([]);
      };
      next();
    });
  }

  function setLayerCellText(row, col, text){
    const cell = dbaLayerCellContentMap.get(`${row},${col}`) || null;
    if(cell) cell.textContent = text;
  }

  function setLayerCellCapitalCrown(row, col, on){
    const content = dbaLayerCellContentMap.get(`${row},${col}`) || null;
    const cell = content && content.parentElement ? content.parentElement : null;
    if(!cell) return;
    if(on){
      cell.dataset.dbaCapitalCrown = '1';
    }else{
      delete cell.dataset.dbaCapitalCrown;
    }
  }

  function setLayerCellCurrentMarker(row, col, on){
    const content = dbaLayerCellContentMap.get(`${row},${col}`) || null;
    const cell = content && content.parentElement ? content.parentElement : null;
    if(!cell) return;
    if(on){
      cell.dataset.dbaCurrentMarker = '1';
    }else{
      delete cell.dataset.dbaCurrentMarker;
    }
  }

  function setLayerCellDecoBackground(row, col, backgroundValue){
    const cell = dbaLayerCellDecoMap.get(`${row},${col}`) || null;
    if(cell) cell.style.background = String(backgroundValue || 'transparent');
  }

  function getLayerCellText(row, col){
    const cell = dbaLayerCellContentMap.get(`${row},${col}`) || null;
    return cell ? String(cell.textContent || '') : '';
  }

  function clearLayerTexts(){
    for(const el of dbaLayerCellContentMap.values()){
      el.textContent = '';
    }
  }

  function snapshotLayerTexts(){
    const out = Object.create(null);
    for(const [key, el] of dbaLayerCellContentMap.entries()){
      out[key] = String(el && el.textContent ? el.textContent : '');
    }
    return out;
  }

  function buildAllCellJobsFromSnapshot(snapshot){
    const out = [];
    if(!snapshot || typeof snapshot !== 'object') return out;

    if(mode === 'rb'){
      const known = new Set();
      for(const k of Array.from(snapshot.visibleSet || [])) known.add(k);
      for(const k of Array.from(snapshot.exploredSet || [])) known.add(k);
      for(const k of known){
        const m = String(k).match(/^(\d+)-(\d+)$/);
        if(!m) continue;
        out.push({ row: Number(m[1]), col: Number(m[2]) });
      }
      out.sort((a,b) => (a.row - b.row) || (a.col - b.col));
      return out;
    }

    const rows = Math.max(0, Number(snapshot.rows || 0));
    const cols = Math.max(0, Number(snapshot.cols || 0));
    for(let r = 0; r < rows; r++){
      for(let c = 0; c < cols; c++){
        out.push({ row:r, col:c });
      }
    }
    return out;
  }

  function buildAllowedLayerTextKeySet(snapshot){
    const set = new Set();
    for(const job of buildAllCellJobsFromSnapshot(snapshot)){
      if(!job) continue;
      set.add(`${job.row},${job.col}`);
    }
    return set;
  }

  function restoreLayerTextsFromSnapshot(textSnapshot, allowedKeys){
    const snap = (textSnapshot && typeof textSnapshot === 'object') ? textSnapshot : Object.create(null);
    const allow = (allowedKeys instanceof Set) ? allowedKeys : null;

    for(const [key, el] of dbaLayerCellContentMap.entries()){
      if(!(el instanceof HTMLElement)) continue;

      if(allow && !allow.has(key)){
        el.textContent = '';
        continue;
      }

      el.textContent = Object.prototype.hasOwnProperty.call(snap, key)
        ? String(snap[key] || '')
        : '';
    }
  }

  function clearLayerDecos(){
    for(const el of dbaLayerCellDecoMap.values()){
      el.style.background = 'transparent';
    }
  }

  function shouldShowRbOriginalBorder(){
    try{
      const s = loadSettings();
      return !!(mode === 'rb' && s?.rbLayer?.showOriginalBorder);
    }catch(_e){
      return false;
    }
  }

  function getRbOriginalBorderOpacity(){
    try{
      const s = loadSettings();
      return sanitizeRbBorderOpacity(s?.rbLayer?.borderOpacity);
    }catch(_e){
      return 100;
    }
  }

  function colorTokenToRgba(colorValue, alpha){
    const s = normalizeColorTokenForCompare(colorValue);
    const a = Math.max(0, Math.min(1, Number(alpha)));
    const m = s.match(/^#([0-9a-f]{6})$/i);
    if(m){
      const hex = m[1];
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    if(/^rgba?\(/i.test(s)){
      return s.replace(/^rgba?\(([^)]+)\)$/i, (_all, inner) => {
        const parts = String(inner).split(',').map(v => String(v).trim());
        const r = clampInt(parts[0], 0, 255);
        const g = clampInt(parts[1], 0, 255);
        const b = clampInt(parts[2], 0, 255);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      });
    }
    return `rgba(0, 0, 0, ${a})`;
  }

  function buildRbOriginalBorderBackgroundForCell(snapshot, row, col){
    if(!snapshot || mode !== 'rb') return 'transparent';

    const selfKey = `${row}-${col}`;
    const selfColor = normalizeColorTokenForCompare(snapshot?.cellColors?.[selfKey] || '');
    if(!selfColor) return 'transparent';

    const rows = Math.max(0, Number(snapshot?.rows || 0));
    const cols = Math.max(0, Number(snapshot?.cols || 0));
    if(rows <= 0 || cols <= 0) return 'transparent';

    const borderOpacity = getRbOriginalBorderOpacity() / 100;
    const opaque = colorTokenToRgba(selfColor, borderOpacity);
    const fade = colorTokenToRgba(selfColor, 0);
    // チーム境界グレデーションの幅（セル幅に対する％）
    const size = '20%';
    const layers = [];

    const isSameOwner = (r, c) => {
      if(r < 0 || c < 0 || r >= rows || c >= cols) return false;
      const color = normalizeColorTokenForCompare(snapshot?.cellColors?.[`${r}-${c}`] || '');
      if(!color) return false;
      return color === selfColor;
    };

    if(!isSameOwner(row - 1, col)){
      layers.push(`linear-gradient(to bottom, ${opaque} 0%, ${fade} 100%) top center / 100% ${size} no-repeat`);
    }
    if(!isSameOwner(row + 1, col)){
      layers.push(`linear-gradient(to top, ${opaque} 0%, ${fade} 100%) bottom center / 100% ${size} no-repeat`);
    }
    if(!isSameOwner(row, col - 1)){
      layers.push(`linear-gradient(to right, ${opaque} 0%, ${fade} 100%) left center / ${size} 100% no-repeat`);
    }
    if(!isSameOwner(row, col + 1)){
      layers.push(`linear-gradient(to left, ${opaque} 0%, ${fade} 100%) right center / ${size} 100% no-repeat`);
    }

    return layers.length > 0 ? layers.join(', ') : 'transparent';
  }

  function renderRbOriginalBorders(snapshot){
    if(mode !== 'rb'){
      clearLayerDecos();
      return;
    }

    if(!shouldShowRbOriginalBorder()){
      clearLayerDecos();
      return;
    }

    const snap = snapshot || getBattlemapSnapshotFromDoc(document);
    const rows = Math.max(0, Number(snap?.rows || 0));
    const cols = Math.max(0, Number(snap?.cols || 0));
    if(rows <= 0 || cols <= 0){
      clearLayerDecos();
      return;
    }

    for(let r = 0; r < rows; r++){
      for(let c = 0; c < cols; c++){
        setLayerCellDecoBackground(r, c, buildRbOriginalBorderBackgroundForCell(snap, r, c));
      }
    }
  }

  function renderRbCapitalCrowns(snapshot){
    const snap = snapshot || getBattlemapSnapshotFromDoc(document);
    const rows = Math.max(0, Number(snap?.rows || 0));
    const cols = Math.max(0, Number(snap?.cols || 0));

    if(rows <= 0 || cols <= 0){
      return;
    }

    const show = shouldShowRbCapitalCrown();
    const capitalSet = snap?.capitalSet instanceof Set ? snap.capitalSet : new Set();

    for(let r = 0; r < rows; r++){
      for(let c = 0; c < cols; c++){
        const key = `${r}-${c}`;
        setLayerCellCapitalCrown(r, c, show && capitalSet.has(key));
      }
    }
  }

  const DBA_CURRENT_CELL_MARKER_STATE = {
    row: NaN,
    col: NaN,
    hasValue: false
  };

  const DBA_PENDING_CURRENT_CELL_MARKER_STATE = {
    row: NaN,
    col: NaN,
    dueAt: 0,
    hasValue: false
  };

  function setCurrentCellMarkerCache(row, col){
    const r = Number(row);
    const c = Number(col);
    if(!Number.isFinite(r) || !Number.isFinite(c)) return false;
    DBA_CURRENT_CELL_MARKER_STATE.row = r;
    DBA_CURRENT_CELL_MARKER_STATE.col = c;
    DBA_CURRENT_CELL_MARKER_STATE.hasValue = true;
    return true;
  }

  function getCurrentCellMarkerCache(){
    if(!DBA_CURRENT_CELL_MARKER_STATE.hasValue) return null;
    const r = Number(DBA_CURRENT_CELL_MARKER_STATE.row);
    const c = Number(DBA_CURRENT_CELL_MARKER_STATE.col);
    if(!Number.isFinite(r) || !Number.isFinite(c)) return null;
    return { row: r, col: c };
  }

  function clearPendingCurrentCellMarkerCache(){
    DBA_PENDING_CURRENT_CELL_MARKER_STATE.row = NaN;
    DBA_PENDING_CURRENT_CELL_MARKER_STATE.col = NaN;
    DBA_PENDING_CURRENT_CELL_MARKER_STATE.dueAt = 0;
    DBA_PENDING_CURRENT_CELL_MARKER_STATE.hasValue = false;
  }

  function setPendingCurrentCellMarkerCache(row, col, delayMs){
    const r = Number(row);
    const c = Number(col);
    if(!Number.isFinite(r) || !Number.isFinite(c)) return false;

    const delay = sanitizeCurrentMarkerDelayMs(delayMs);
    DBA_PENDING_CURRENT_CELL_MARKER_STATE.row = r;
    DBA_PENDING_CURRENT_CELL_MARKER_STATE.col = c;
    DBA_PENDING_CURRENT_CELL_MARKER_STATE.dueAt = Date.now() + delay;
    DBA_PENDING_CURRENT_CELL_MARKER_STATE.hasValue = true;
    return true;
  }

  function flushPendingCurrentCellMarkerCache(force){
    if(!DBA_PENDING_CURRENT_CELL_MARKER_STATE.hasValue) return null;

    const r = Number(DBA_PENDING_CURRENT_CELL_MARKER_STATE.row);
    const c = Number(DBA_PENDING_CURRENT_CELL_MARKER_STATE.col);
    const dueAt = Number(DBA_PENDING_CURRENT_CELL_MARKER_STATE.dueAt || 0);
    if(!Number.isFinite(r) || !Number.isFinite(c)){
      clearPendingCurrentCellMarkerCache();
      return null;
    }

    if(!force && Date.now() < dueAt){
      return null;
    }

    clearPendingCurrentCellMarkerCache();
    setCurrentCellMarkerCache(r, c);
    return { row: r, col: c };
  }

  function readCurrentBattleCellCoordFromLiveWindow(){
    try{
      if(mode !== 'rb') return null;

      const root = window.__AVATARS;
      if(!root || typeof root !== 'object') return null;

      const direct = (root.myAvatar && typeof root.myAvatar === 'object')
        ? root.myAvatar
        : ((root.selfAvatar && typeof root.selfAvatar === 'object') ? root.selfAvatar : null);

      if(direct){
        const r = Number(direct.row ?? direct.r ?? direct.bapRow);
        const c = Number(direct.col ?? direct.c ?? direct.bapCol);
        if(Number.isFinite(r) && Number.isFinite(c)){
          return { row: r, col: c };
        }
      }

      const rows = Array.isArray(root.avatars) ? root.avatars : [];
      for(const av of rows){
        if(!av || typeof av !== 'object') continue;
        if(!(av.isSelf === true || av.self === true || av.mine === true)) continue;

        const r = Number(av.row ?? av.r ?? av.bapRow);
        const c = Number(av.col ?? av.c ?? av.bapCol);
        if(Number.isFinite(r) && Number.isFinite(c)){
          return { row: r, col: c };
        }
      }
    }catch(_e){}

    return null;
  }

  function readCurrentBattleCellCoordFromDocument(doc){
    try{
      if(mode !== 'rb') return null;
      if(!doc) return null;

      const payload = extractRbAvatarsPayloadFromDoc(doc);
      if(!payload || typeof payload !== 'object') return null;

      const direct = (payload.myAvatar && typeof payload.myAvatar === 'object')
        ? payload.myAvatar
        : ((payload.selfAvatar && typeof payload.selfAvatar === 'object') ? payload.selfAvatar : null);

      if(direct){
        const r = Number(
          direct.row ??
          direct.r ??
          direct.bapRow
        );
        const c = Number(
          direct.col ??
          direct.c ??
          direct.bapCol
        );
        if(Number.isFinite(r) && Number.isFinite(c)){
          return { row: r, col: c };
        }
      }

      const avatars = Array.isArray(payload.avatars) ? payload.avatars : [];
      for(const av of avatars){
        if(!av || typeof av !== 'object') continue;
        if(!(av.isSelf === true || av.self === true || av.mine === true)) continue;

        const r = Number(
          av.row ??
          av.r ??
          av.bapRow
        );
        const c = Number(
          av.col ??
          av.c ??
          av.bapCol
        );
        if(Number.isFinite(r) && Number.isFinite(c)){
          return { row: r, col: c };
        }
      }

      {
        const avatarsKey = normalizeAvatarsPayload(payload);
        const avInfo = avatarsKeyToMap(avatarsKey);
        const self = avInfo && avInfo.selfAvatar ? avInfo.selfAvatar : null;
        if(self){
          const r = Number(self.row);
          const c = Number(self.col);
          if(Number.isFinite(r) && Number.isFinite(c)){
            return { row: r, col: c };
          }
        }
      }
    }catch(_e){}

    return null;
  }

  // 現在地座標の取得
  function getCurrentBattleCellCoord(snapshot){
    const snap = snapshot || null;

    {
      const live = readCurrentBattleCellCoordFromLiveWindow();
      if(live){
        setCurrentCellMarkerCache(live.row, live.col);
        dbaLogCurrentCellResolved('live-window', live);
        return live;
      }
    }

    {
      const fromDoc = readCurrentBattleCellCoordFromDocument(document);
      if(fromDoc){
        setCurrentCellMarkerCache(fromDoc.row, fromDoc.col);
        dbaLogCurrentCellResolved('document', fromDoc);
        return fromDoc;
      }
    }

    if(mode === 'rb'){
      const candidates = [
        (snap && snap.selfAvatar && typeof snap.selfAvatar === 'object') ? snap.selfAvatar : null,
        (snap && snap.myAvatar && typeof snap.myAvatar === 'object') ? snap.myAvatar : null,
        (snap && snap.self && typeof snap.self === 'object') ? snap.self : null
      ];

      for(const self of candidates){
        if(!self) continue;

        const sr = Number(
          self.row ??
          self.r ??
          self.bapRow
        );
        const sc = Number(
          self.col ??
          self.c ??
          self.bapCol
        );

        if(Number.isFinite(sr) && Number.isFinite(sc)){
          const rc = { row: sr, col: sc };
          setCurrentCellMarkerCache(sr, sc);
          dbaLogCurrentCellResolved('snapshot', rc);
          return rc;
        }
      }
    }

    {
      const flushed = flushPendingCurrentCellMarkerCache(false);
      if(flushed){
        dbaLogCurrentCellResolved('pending-cache', flushed);
        return flushed;
      }
    }

    const u = new URL(location.href);
    const rawR = u.searchParams.get('r');
    const rawC = u.searchParams.get('c');
    if(rawR != null && rawC != null && rawR !== '' && rawC !== ''){
      const r = Number(rawR);
      const c = Number(rawC);
      if(Number.isFinite(r) && Number.isFinite(c)){
        const rc = { row: r, col: c };
        setCurrentCellMarkerCache(r, c);
        dbaLogCurrentCellResolved('url', rc);
        return rc;
      }
    }

    const cached = getCurrentCellMarkerCache();
    if(cached){
      dbaLogCurrentCellResolved('cache', cached);
      return cached;
    }

    dbaLogCurrentCellResolved('none', null);
    return null;

    dbaLogCurrentCellResolved('none', null);
    return null;
  }

  // 現在地マーカー描画
  function renderCurrentCellMarker(snapshot){
    const snap = snapshot || getBattlemapSnapshotFromDoc(document);
    const rows = Math.max(0, Number(snap?.rows || 0));
    const cols = Math.max(0, Number(snap?.cols || 0));

    if(rows <= 0 || cols <= 0){
      return;
    }

    const show = shouldShowCurrentCellMarker();
    const cur = show ? getCurrentBattleCellCoord(snap) : null;
    const cached = show ? getCurrentCellMarkerCache() : null;
    const eff = cur || cached || null;
    const curRow = eff ? Number(eff.row) : NaN;
    const curCol = eff ? Number(eff.col) : NaN;

    {
      const sig = JSON.stringify({
        show,
        rows,
        cols,
        eff: eff ? { row: curRow, col: curCol } : null
      });
      if(isRtCoordDebugEnabled() && sig !== DBA_RT_COORD_DEBUG.lastRenderSig){
        DBA_RT_COORD_DEBUG.lastRenderSig = sig;
        dbaRtDbg('RENDER_MARKER', {
          show,
          rows,
          cols,
          eff: eff ? { row: curRow, col: curCol } : null
        });
      }
    }

    for(let r = 0; r < rows; r++){
      for(let c = 0; c < cols; c++){
        const on = (
          show &&
          Number.isFinite(curRow) &&
          Number.isFinite(curCol) &&
          r === curRow &&
          c === curCol
        );
        setLayerCellCurrentMarker(r, c, on);
      }
    }
  }

  function shouldShowRbCellRegulation(){
    try{
      const s = loadSettings();
      return !!(mode === 'rb' && s?.rbLayer?.showCellRegulation);
    }catch(_e){
      return false;
    }
  }

  function shouldShowRbCapitalCrown(){
    try{
      const s = loadSettings();
      return !!s?.rbLayer?.showCapitalCrown;
    }catch(_e){
      return false;
    }
  }

  function shouldShowCurrentCellMarker(){
    try{
      const s = loadSettings();
      return !!s?.rbLayer?.showCurrentCellMarker;
    }catch(_e){
      return false;
    }
  }

  function shouldShowRbNobodyHolder(){
    try{
      const s = loadSettings();
      return !!(mode === 'rb' && s?.rbLayer?.showNobodyHolder);
    }catch(_e){
      return false;
    }
  }

  function shouldHideRbNobodyHolder(row, col, holder){
    if(mode !== 'rb') return false;
    if(shouldShowRbNobodyHolder()) return false;

    const holderText = sanitizeText(holder || '');
    if(holderText !== '誰もいない') return false;

    const tileColor = getCurrentRbTileColor(row, col);
    if(tileColor){
      // チームカラー付きセルの「誰もいない」は、プレイヤー名の可能性があるので隠さない
      return false;
    }

    return true;
  }

  function buildLayerCellDisplayText(reg, holder, row, col){
    const regText = sanitizeText(reg || '---') || '---';
    const holderTextRaw = sanitizeText(holder || '---') || '---';
    const holderText = shouldHideRbNobodyHolder(row, col, holderTextRaw) ? '' : holderTextRaw;

    if(mode === 'rb' && !shouldShowRbCellRegulation()){
      return holderText;
    }

    if(!holderText){
      return regText;
    }
    return `${regText}\n${holderText}`;
  }

  // =========================
  // RB専用：トップページHTML内の window.__FOW から「既知領域」を抽出（visible + explored の union）
  //  - explored / visible をそれぞれ配列としてJSON.parseし、座標を union する
  //  - 返り値: [{row, col}, ...]
  // =========================
  function extractRbFowStateFromDoc(doc){
    try{
      if(mode !== 'rb') return { visible: [], explored: [], hasCapital: false };
      if(!doc) return { visible: [], explored: [], hasCapital: false };

      const scripts = Array.from(doc.querySelectorAll('script'));
      let src = '';
      for(const s of scripts){
        const t = (s && s.textContent) ? String(s.textContent) : '';
        if(t.includes('window.__FOW') && t.includes('"hasCapital"') && (t.includes('"explored"') || t.includes('"visible"'))){
          src = t;
          break;
        }
      }
      if(!src) return { visible: [], explored: [], hasCapital: false };

      const mx = src.match(/"explored"\s*:\s*(\[[\s\S]*?\])\s*,\s*"hasCapital"/);
      const mh = src.match(/"hasCapital"\s*:\s*(true|false)/);
      const mv = src.match(/"visible"\s*:\s*(\[[\s\S]*?\])\s*}\s*;?/);

      const explored = (mx && mx[1]) ? JSON.parse(mx[1]) : [];
      const visible  = (mv && mv[1]) ? JSON.parse(mv[1]) : [];
      const hasCapital = !!(mh && mh[1] === 'true');

      return {
        visible: Array.isArray(visible) ? visible : [],
        explored: Array.isArray(explored) ? explored : [],
        hasCapital
      };
    }catch(_e){
      return { visible: [], explored: [], hasCapital: false };
    }
  }

  // =========================
  // RB専用：トップページHTML内の window.__BUILDINGS から建造物payloadを抽出
  //  - 元ページでは main script 内の buildingsPayload は
  //      (window.__BUILDINGS && typeof window.__BUILDINGS === 'object') ? window.__BUILDINGS : null
  //    という参照式であり、JSONリテラルではない。
  //  - 実データは別 script の
  //      window.__BUILDINGS = {...};
  //    側に入っているため、そこを直接読む。
  // =========================
  function extractRbBuildingsPayloadFromDoc(doc){
    try{
      if(mode !== 'rb') return null;
      if(!doc) return null;

      const scripts = Array.from(doc.querySelectorAll('script'));
      let src = '';
      for(const s of scripts){
        const t = (s && s.textContent) ? String(s.textContent) : '';
        if(!t) continue;
        if(t.includes('window.__BUILDINGS') && t.includes('"buildings"')){
          src = t;
          break;
        }
      }
      if(!src) return null;

      const m = src.match(/window\.__BUILDINGS\s*=\s*(\{[\s\S]*?\})\s*;?/);
      if(!m || !m[1]) return null;

      const obj = JSON.parse(m[1]);
      return (obj && typeof obj === 'object') ? obj : null;
    }catch(_e){
      return null;
    }
  }

// =========================
// RB専用：トップページHTML内の window.__AVATARS からアバターpayloadを抽出
//  - 元ページでは
//      const avatarsPayload = (window.__AVATARS && typeof window.__AVATARS === 'object') ? window.__AVATARS : null;
//    という参照式で使われているため、
//      window.__AVATARS = {...};
//    側を直接読む
// =========================
function extractRbAvatarsPayloadFromDoc(doc){
  try{
    if(mode !== 'rb') return null;
    if(!doc) return null;

    const scripts = Array.from(doc.querySelectorAll('script'));
    let src = '';
    for(const s of scripts){
      const t = (s && s.textContent) ? String(s.textContent) : '';
      if(!t) continue;
      if(t.includes('window.__AVATARS') && (t.includes('"avatars"') || t.includes('"myAvatar"') || t.includes('"selfAvatar"'))){
        src = t;
        break;
      }
    }
    if(!src) return null;

    const m = src.match(/window\.__AVATARS\s*=\s*(\{[\s\S]*?\})\s*;?/);
    if(!m || !m[1]) return null;

    const obj = JSON.parse(m[1]);
    return (obj && typeof obj === 'object') ? obj : null;
  }catch(_e){
    return null;
  }
}

function rbAvatarRowOf(av){
  if(!av || typeof av !== 'object') return null;
  const r = av.bapRow ?? av.row ?? av.r;
  return Number.isFinite(r) ? Number(r) : null;
}

function rbAvatarColOf(av){
  if(!av || typeof av !== 'object') return null;
  const c = av.bapCol ?? av.col ?? av.c;
  return Number.isFinite(c) ? Number(c) : null;
}

function rbAvatarTeamCodeOf(av){
  if(!av || typeof av !== 'object') return 0;
  const raw = av.bapTeam ?? av.team ?? av.t;
  if(typeof raw === 'string'){
    const s = raw.trim().toLowerCase();
    if(s === 'red') return 1;
    if(s === 'blue') return 2;
    return 0;
  }
  if(raw === 1 || raw === 2) return Number(raw);
  if(raw && typeof raw === 'object'){
    const s = raw.tag ?? raw.team ?? raw.name ?? null;
    if(typeof s === 'string'){
      const x = s.trim().toLowerCase();
      if(x === 'red') return 1;
      if(x === 'blue') return 2;
    }
  }
  return 0;
}

function rbAvatarArmorOf(av){
  if(!av || typeof av !== 'object') return null;
  return av.bapArmor ?? av.armor ?? av.a ?? null;
}

function rbAvatarKeyFromArmor(armor){
  if(armor == null) return 'ac';
  if(typeof armor === 'string') return armor;
  if(typeof armor !== 'object') return 'ac';
  const t0 = armor.armorType ?? armor._armorType ?? armor.at ?? armor.type ?? null;
  if(typeof t0 === 'string') return t0;
  if(t0 && typeof t0 === 'object'){
    const t1 = t0.tag ?? t0.value ?? t0.contents ?? t0.name ?? null;
    if(typeof t1 === 'string') return t1;
  }
  return 'ac';
}

function normalizeAvatarsPayload(payload){
  try{
    if(!payload || typeof payload !== 'object') return '';

    const rows = [];
    const avatars = Array.isArray(payload.avatars) ? payload.avatars : [];
    for(const av of avatars){
      if(!av || typeof av !== 'object') continue;
      const r = rbAvatarRowOf(av);
      const c = rbAvatarColOf(av);
      if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
      rows.push({
        r,
        c,
        team: rbAvatarTeamCodeOf(av),
        key: String(rbAvatarKeyFromArmor(rbAvatarArmorOf(av)) || 'ac'),
        isSelf: !!(av.isSelf === true || av.self === true || av.mine === true)
      });
    }

    rows.sort((a, b) =>
      (a.r - b.r) ||
      (a.c - b.c) ||
      (a.team - b.team) ||
      (a.key < b.key ? -1 : (a.key > b.key ? 1 : 0)) ||
      (Number(a.isSelf) - Number(b.isSelf))
    );

    let self = null;
    const selfSrc =
      (payload.myAvatar && typeof payload.myAvatar === 'object') ? payload.myAvatar :
      (payload.selfAvatar && typeof payload.selfAvatar === 'object') ? payload.selfAvatar :
      null;

    if(selfSrc){
      const r = rbAvatarRowOf(selfSrc);
      const c = rbAvatarColOf(selfSrc);
      if(Number.isFinite(r) && Number.isFinite(c)){
        self = {
          r,
          c,
          team: rbAvatarTeamCodeOf(selfSrc),
          key: String(rbAvatarKeyFromArmor(rbAvatarArmorOf(selfSrc)) || 'ac')
        };
      }
    }else{
      const tagged = rows.find((it) => !!it.isSelf);
      if(tagged){
        self = {
          r: tagged.r,
          c: tagged.c,
          team: tagged.team,
          key: tagged.key
        };
      }
    }

    return JSON.stringify({
      avatars: rows,
      self
    });
  }catch(_e){
    return '';
  }
}

function avatarsKeyToMap(avatarsKey){
  const map = Object.create(null);
  const keys = new Set();
  let selfKey = '';
  let selfAvatar = null;
  try{
    const s = String(avatarsKey || '');
    if(!s) return { map, keys, selfKey, selfAvatar };

    const obj = JSON.parse(s);
    const rows = Array.isArray(obj?.avatars) ? obj.avatars : [];
    for(const it of rows){
      if(!it) continue;
      const r = Number(it.r);
      const c = Number(it.c);
      if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
      const k = `${r}-${c}`;
      if(!Array.isArray(map[k])) map[k] = [];
      map[k].push({
        team: Number(it.team || 0),
        key: String(it.key || 'ac'),
        isSelf: !!it.isSelf
      });
      keys.add(k);
    }

    for(const k of keys){
      map[k].sort((a, b) =>
        (a.team - b.team) ||
        (a.key < b.key ? -1 : (a.key > b.key ? 1 : 0)) ||
        (Number(a.isSelf) - Number(b.isSelf))
      );
      map[k] = JSON.stringify(map[k]);
    }

    if(obj && obj.self && typeof obj.self === 'object'){
      const r = Number(obj.self.r);
      const c = Number(obj.self.c);
      if(Number.isFinite(r) && Number.isFinite(c)){
        selfKey = `${r}-${c}`;
        selfAvatar = {
          row: r,
          col: c,
          team: Number(obj.self.team || 0),
          key: String(obj.self.key || 'ac')
        };
      }
    }

    return { map, keys, selfKey, selfAvatar };
  }catch(_e){
    return { map, keys, selfKey, selfAvatar };
  }
}

  function extractRbKnownCoordsFromDoc(doc){
    try{
      if(mode !== 'rb') return [];
      if(!doc) return [];

      const fow = extractRbFowStateFromDoc(doc);
      const explored = fow.explored;
      const visible  = fow.visible;
      if(!Array.isArray(explored) || !Array.isArray(visible)) return [];

      const out = [];
      const seen = new Set();

      // union: visible → explored の順に足す（順序に意味は無いが、安定化しやすい）
      const addList = (arr) => {
        for(const rc of arr){
          if(!rc || rc.length < 2) continue;
          const r = Number(rc[0]);
          const c = Number(rc[1]);
          if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
          const k = `${r}-${c}`;
          if(seen.has(k)) continue;
          seen.add(k);
          out.push({ row: r, col: c });
        }
      };
      addList(visible);
      addList(explored);

      // 安定化
      out.sort((a,b) => (a.row - b.row) || (a.col - b.col));
      return out;
    }catch(_e){
      return [];
    }
  }

  function normalizeRcList(list){
    const rows = [];
    if(!Array.isArray(list)) return rows;
    for(const rc of list){
      if(!Array.isArray(rc) || rc.length < 2) continue;
      const r = Number(rc[0]);
      const c = Number(rc[1]);
      if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
      rows.push([r, c]);
    }
    rows.sort((a,b) => (a[0] - b[0]) || (a[1] - b[1]));
    return rows;
  }

  function normalizeBuildingsPayload(payload){
    try{
      const arr = payload && payload.buildings;
      if(!Array.isArray(arr)) return '';
      const rows = [];
      for(const it of arr){
        if(!it) continue;
        const rc = it.rc;
        if(!Array.isArray(rc) || rc.length < 2) continue;
        const r = Number(rc[0]);
        const c = Number(rc[1]);
        if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
        const b = it.b || {};
        const kind = String(b.buildingType ?? b.t ?? '').trim();
        const owner = String(b.buildingOwner ?? b.owner ?? '').trim();
        rows.push({ r, c, kind, owner });
      }
      rows.sort((a,b) =>
        (a.r - b.r) ||
        (a.c - b.c) ||
        (a.kind < b.kind ? -1 : (a.kind > b.kind ? 1 : 0)) ||
        (a.owner < b.owner ? -1 : (a.owner > b.owner ? 1 : 0))
      );
      return JSON.stringify(rows);
    }catch(_e){
      return '';
    }
  }

  function buildingsKeyToMap(buildingsKey){
    const map = Object.create(null);
    const keys = new Set();
    try{
      const s = String(buildingsKey || '');
      if(!s) return { map, keys };
      const rows = JSON.parse(s);
      if(!Array.isArray(rows)) return { map, keys };
      for(const it of rows){
        if(!it) continue;
        const r = Number(it.r);
        const c = Number(it.c);
        const kind = String(it.kind ?? '').trim();
        const owner = String(it.owner ?? '').trim();
        if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
        const k = `${r}-${c}`;
        keys.add(k);
        map[k] = `${kind}|${owner}`;
      }
      return { map, keys };
    }catch(_e){
      return { map, keys };
    }
  }

  async function scanAllCellsAndRenderFromFetchedDoc(doc, meta){
    const btn = document.getElementById('dba-btn-battleinfo');
    const showAlertOnError = (meta && Object.prototype.hasOwnProperty.call(meta, 'showAlertOnError'))
      ? !!meta.showAlertOnError
      : true;
    if(btn){
      btn.disabled = true;
      btn.dataset.dbaBusy = '1';
      btn.textContent = 'マップ更新中…';
    }

    const topUrl = meta?.topUrl || makeTeambattleUrl({ m: mode });
    let refreshed = false;
    let newSnap = meta?.snapshot || null;
    let jobs = [];

    try{
      if(!doc) throw new Error('doc is null');
      if(!newSnap){
        newSnap = getBattlemapSnapshotFromDoc(doc);
      }
      jobs = buildAllCellJobsFromSnapshot(newSnap);

      refreshed = await refreshBattlemapFromFetchedDoc(doc, {
        topUrl,
        snapshot: newSnap
      });
      if(!refreshed){
        throw new Error('battlemap refresh failed');
      }
    }catch(_e){
      refreshed = false;
    }

    if(btn){
      btn.textContent = refreshed ? '戦況取得中…' : '戦況取得中…(マップ更新失敗)';
    }

    if(!refreshed || !newSnap){
      if(btn){
        btn.disabled = false;
        btn.dataset.dbaBusy = '0';
        btn.innerHTML = '戦況<br>情報';
      }
      if(showAlertOnError){
        alert('戦況情報の取得に失敗しました。');
      }
      return;
    }

    initBattlemapLayer();
    resetBattlemapLayerRectStabilizer();
    scheduleBattlemapLayerSync();
    await raf2();

    const CONCURRENCY = 16;
    await mapLimit(jobs, CONCURRENCY, async (job) => {
      const { row, col } = job;
      try{
        const { holder, reg } = await fetchCellDetail(row, col);
        setLayerCellText(row, col, buildLayerCellDisplayText(reg, holder, row, col));
      }catch(_e){
        setLayerCellText(row, col, `ERR\n(${row},${col})`);
      }
      return true;
    });

    {
      const snap = getCurrentBattlemapSnapshot();
      renderRbOriginalBorders(snap);
      renderRbCapitalCrowns(snap);
      renderCurrentCellMarker(snap);
      endBattlemapLayerTextFreeze();
    }

    if(btn){
      btn.disabled = false;
      btn.dataset.dbaBusy = '0';
      btn.innerHTML = '戦況<br>情報';
    }
  }

  async function scanAllCellsAndRender(){
    const { topUrl, doc } = await fetchLatestTopPageDoc();
    const newSnap = getBattlemapSnapshotFromDoc(doc);
    return scanAllCellsAndRenderFromFetchedDoc(doc, {
      topUrl,
      snapshot: newSnap,
      showAlertOnError: true
    });
  }

  // =========================
  // 戦況情報（クリック：差分だけ更新）
  //  - 長押し：全セル巡回（scanAllCellsAndRender）
  //  - クリック：最新マップの const 群を取得し、差分セルだけ詳細ページを取りにいってレイヤー表示を更新
  // =========================
  function parseJsValueLiteral(lit){
    // 同一オリジンのページ内スクリプトから抽出する前提（安全性より堅牢性を優先）
    // eslint-disable-next-line no-new-func
    return Function('"use strict"; return (' + lit + ');')();
  }

  function pickScriptText(doc, mustInclude){
    const scripts = Array.from(doc.querySelectorAll('script'));
    for(const sc of scripts){
      const t = sc.textContent || '';
      if(!t) continue;
      let ok = true;
      for(const kw of mustInclude){
        if(!t.includes(kw)){ ok = false; break; }
      }
      if(ok) return t;
    }
    return '';
  }

  function extractConstLiteral(scriptText, constName){
    // 例: const cellColors = { ... };
    // Cloudflare / 圧縮後HTML では
    //   const cellColors = {...};const capitalMap = [...];
    // のように「改行なしで次の const が続く」ことがある。
    // そのため、「セミコロンの直後が改行 or 文末」という条件では
    // hc / l の cellColors を取りこぼしてしまう。
    const src = String(scriptText || '');
    if(!src) return null;

    // 第1候補：
    //   const <name> = ... ;
    // の末尾を「次の const / let / var / function の直前」または文末までで取る
    const re1 = new RegExp(
      `const\\s+${constName}\\s*=\\s*([\\s\\S]*?);\\s*(?=(?:const|let|var|function)\\b|$)`
    );
    let m = src.match(re1);
    if(m) return (m[1] || '').trim();

    // 第2候補（後方互換）：
    // 旧来どおり「改行 or 文末」で終わる形も許容
    const re2 = new RegExp(
      `const\\s+${constName}\\s*=\\s*([\\s\\S]*?);\\s*(?:\\n|$)`
    );
    m = src.match(re2);
    if(m) return (m[1] || '').trim();

    return null;
  }

  function normalizeCellColors(obj){
    const out = Object.create(null);
    if(!obj || typeof obj !== 'object') return out;
    for(const [k,v] of Object.entries(obj)){
      const key = String(k).trim();
      if(!key) continue;
      out[key] = (v == null) ? null : String(v).trim();
    }
    return out;
  }

  function normalizeCapitalSet(list){
    const set = new Set();
    if(!Array.isArray(list)) return set;
    for(const rc of list){
      if(!Array.isArray(rc) || rc.length < 2) continue;
      const r = Number(rc[0]);
      const c = Number(rc[1]);
      if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
      set.add(`${r}-${c}`);
    }
    return set;
  }

  function normalizeTerrainsPayload(payload){
    // RB専用：terrainsPayload.terrains の中身だけを正規化して比較
    try{
      const arr = payload && payload.terrains;
      if(!Array.isArray(arr)) return '';
      const rows = [];
      for(const cell of arr){
        if(!cell) continue;
        const r = Number(cell.r ?? cell.row ?? cell.x);
        const c = Number(cell.c ?? cell.col ?? cell.y);
        const t = String(cell.t ?? cell.terrain ?? '').trim();
        if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
        rows.push({ r, c, t });
      }
      rows.sort((a,b) => (a.r - b.r) || (a.c - b.c) || (a.t < b.t ? -1 : (a.t > b.t ? 1 : 0)));
      return JSON.stringify(rows);
    }catch(_e){
      return '';
    }
  }

  // =========================
  // RB専用：normalizeTerrainsPayload() の戻り値（JSON文字列）を
  // 「座標キー(k='r-c') → 地形(t)」へ展開して扱う
  //  - (2)(3)(5) の判定に使う
  // =========================
  function terrainsKeyToMap(terrainsKey){
    const map = Object.create(null); // k -> t
    const keys = new Set();          // k
    try{
      const s = String(terrainsKey || '');
      if(!s) return { map, keys };
      const rows = JSON.parse(s);
      if(!Array.isArray(rows)) return { map, keys };
      for(const it of rows){
        if(!it) continue;
        const r = Number(it.r);
        const c = Number(it.c);
        const t = String(it.t ?? '').trim();
        if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
        const k = `${r}-${c}`;
        keys.add(k);
        map[k] = t;
      }
      return { map, keys };
    }catch(_e){
      return { map, keys };
    }
  }

  function getHcLGridSpecFromDoc(doc){
    const grid = doc.querySelector('.grid');
    if(!grid) return { rows:0, cols:0 };
    // fetched doc では computedStyle が使えないことがあるので style から読む
    const style = grid.getAttribute('style') || '';
    const m1 = style.match(/grid-template-columns:\s*repeat\(\s*(\d+)\s*,/);
    const m2 = style.match(/grid-template-rows:\s*repeat\(\s*(\d+)\s*,/);
    const cols = m1 ? Number(m1[1]) : 0;
    const rows = m2 ? Number(m2[1]) : 0;
    return { rows, cols };
  }

  function getCurrentHcLGridSize(){
    const grid = document.querySelector('.grid');
    if(!grid) return { rows:0, cols:0 };
    const spec = getHcLGridSpec(grid);
    return { rows: spec.rows, cols: spec.cols };
  }

  // =========================
  // 現在のバトルマップ比較元スナップショット
  //  - 差分更新の「部分描画成功後」は document 内の script が古いまま残るため、
  //    比較元を別キャッシュでも保持する
  //  - 全体差し替え成功時 / 部分更新成功時にこのキャッシュを更新する
  // =========================
  const DBA_BATTLEMAP_SNAPSHOT_CACHE = {
    snapshot: null,
    source: ''
  };

  function cloneBattlemapSnapshotForCache(snap){
    if(!snap || typeof snap !== 'object') return null;
    return {
      mode: String(snap.mode || mode),
      rows: Number(snap.rows || 0),
      cols: Number(snap.cols || 0),
      cellColors: Object.assign(Object.create(null), snap.cellColors || {}),
      capitalSet: new Set(Array.from(snap.capitalSet || [])),
      terrainsKey: String(snap.terrainsKey || ''),
      visibleList: Array.isArray(snap.visibleList) ? snap.visibleList.map((rc) => [Number(rc[0]), Number(rc[1])]) : [],
      exploredList: Array.isArray(snap.exploredList) ? snap.exploredList.map((rc) => [Number(rc[0]), Number(rc[1])]) : [],
      visibleSet: new Set(Array.from(snap.visibleSet || [])),
      exploredSet: new Set(Array.from(snap.exploredSet || [])),
      hasCapital: !!snap.hasCapital,
      buildingsKey: String(snap.buildingsKey || ''),
      avatarsKey: String(snap.avatarsKey || ''),
      selfAvatar: (snap.selfAvatar && typeof snap.selfAvatar === 'object') ? {
        row: Number(snap.selfAvatar.row),
        col: Number(snap.selfAvatar.col),
        team: Number(snap.selfAvatar.team || 0),
        key: String(snap.selfAvatar.key || 'ac')
      } : null
    };
  }

  function setBattlemapSnapshotCache(snap, source){
    const cloned = cloneBattlemapSnapshotForCache(snap);
    if(!cloned) return false;
    DBA_BATTLEMAP_SNAPSHOT_CACHE.snapshot = cloned;
    DBA_BATTLEMAP_SNAPSHOT_CACHE.source = String(source || '');
    return true;
  }

  function getCurrentBattlemapSnapshot(){
    if(DBA_BATTLEMAP_SNAPSHOT_CACHE.snapshot){
      return cloneBattlemapSnapshotForCache(DBA_BATTLEMAP_SNAPSHOT_CACHE.snapshot);
    }
    const snap = getBattlemapSnapshotFromDoc(document);
    setBattlemapSnapshotCache(snap, 'document');
    return snap;
  }

  function getBattlemapSnapshotFromDoc(doc){
    const out = {
      mode,
      rows: 0,
      cols: 0,
      cellColors: Object.create(null),
      capitalSet: new Set(),
      terrainsKey: '', // RBのみ
      visibleList: [],
      exploredList: [],
      visibleSet: new Set(),
      exploredSet: new Set(),
      hasCapital: false,
      buildingsKey: '',
      avatarsKey: '',
      selfAvatar: null
    };

    if(mode === 'rb'){
      const t = pickScriptText(doc, ['const GRID_SIZE', 'const cellColors', 'terrainsPayload']);
      const litSize = extractConstLiteral(t, 'GRID_SIZE');
      const litColors = extractConstLiteral(t, 'cellColors');
      const litCap = extractConstLiteral(t, 'capitalList') || extractConstLiteral(t, 'capitalMap');
      const litTerr = extractConstLiteral(t, 'terrainsPayload');
      const fowState = extractRbFowStateFromDoc(doc);
      const buildingsPayloadObj = extractRbBuildingsPayloadFromDoc(doc);
      const avatarsPayloadObj = extractRbAvatarsPayloadFromDoc(doc);

      let size = 0;
      try{ size = Number(parseJsValueLiteral(litSize)); }catch(_e){ size = 0; }
      if(!Number.isFinite(size) || size <= 0) size = 16;
      out.rows = size;
      out.cols = size;

      try{ out.cellColors = normalizeCellColors(parseJsValueLiteral(litColors)); }catch(_e){ out.cellColors = Object.create(null); }
      try{ out.capitalSet = normalizeCapitalSet(parseJsValueLiteral(litCap)); }catch(_e){ out.capitalSet = new Set(); }
      try{ out.terrainsKey = normalizeTerrainsPayload(parseJsValueLiteral(litTerr)); }catch(_e){ out.terrainsKey = ''; }
      try{ out.buildingsKey = normalizeBuildingsPayload(buildingsPayloadObj); }catch(_e){ out.buildingsKey = ''; }
      try{ out.avatarsKey = normalizeAvatarsPayload(avatarsPayloadObj); }catch(_e){ out.avatarsKey = ''; }
      {
        const avInfo = avatarsKeyToMap(out.avatarsKey);
        out.selfAvatar = avInfo && avInfo.selfAvatar ? {
          row: Number(avInfo.selfAvatar.row),
          col: Number(avInfo.selfAvatar.col),
          team: Number(avInfo.selfAvatar.team || 0),
          key: String(avInfo.selfAvatar.key || 'ac')
        } : null;
      }
      out.visibleList = normalizeRcList(fowState.visible);
      out.exploredList = normalizeRcList(fowState.explored);
      out.visibleSet = new Set(out.visibleList.map((rc) => `${rc[0]}-${rc[1]}`));
      out.exploredSet = new Set(out.exploredList.map((rc) => `${rc[0]}-${rc[1]}`));
      out.hasCapital = !!fowState.hasCapital;
      return out;
    }

    // hc / l
    const t = pickScriptText(doc, ['const cellColors', 'const capitalMap', 'createGrid']);
    const litColors = extractConstLiteral(t, 'cellColors');
    const litCap = extractConstLiteral(t, 'capitalMap') || extractConstLiteral(t, 'capitalList');

    if(doc === document){
      const sz = getCurrentHcLGridSize();
      out.rows = sz.rows;
      out.cols = sz.cols;
    }else{
      const sz = getHcLGridSpecFromDoc(doc);
      out.rows = sz.rows;
      out.cols = sz.cols;
    }

    try{ out.cellColors = normalizeCellColors(parseJsValueLiteral(litColors)); }catch(_e){ out.cellColors = Object.create(null); }
    try{ out.capitalSet = normalizeCapitalSet(parseJsValueLiteral(litCap)); }catch(_e){ out.capitalSet = new Set(); }
    return out;
  }

  function diffChangedCells(curSnap, newSnap){
    const changed = [];
    const keys = new Set();
    const curTerr = terrainsKeyToMap(curSnap?.terrainsKey || '');
    const newTerr = terrainsKeyToMap(newSnap?.terrainsKey || '');
    const curBld = buildingsKeyToMap(curSnap?.buildingsKey || '');
    const newBld = buildingsKeyToMap(newSnap?.buildingsKey || '');

    // 全セルキー（サイズ範囲）を対象にする：地形/色/首都/建造物の変化検出を漏らさない
    for(let r=0;r<curSnap.rows;r++){
      for(let c=0;c<curSnap.cols;c++){
        keys.add(`${r}-${c}`);
      }
    }
    for(let r=0;r<newSnap.rows;r++){
      for(let c=0;c<newSnap.cols;c++){
        keys.add(`${r}-${c}`);
      }
    }
    // cellColors / terrains / buildings にだけ存在するキーも対象（念のため）
    for(const k of Object.keys(curSnap.cellColors||{})) keys.add(k);
    for(const k of Object.keys(newSnap.cellColors||{})) keys.add(k);
    for(const k of curTerr.keys || []) keys.add(k);
    for(const k of newTerr.keys || []) keys.add(k);
    for(const k of curBld.keys || []) keys.add(k);
    for(const k of newBld.keys || []) keys.add(k);

    for(const k of keys){
      const t1 = Number(curTerr.map[k] ?? -1);
      const t2 = Number(newTerr.map[k] ?? -1);
      const c1 = (curSnap.cellColors && (k in curSnap.cellColors)) ? curSnap.cellColors[k] : null;
      const c2 = (newSnap.cellColors && (k in newSnap.cellColors)) ? newSnap.cellColors[k] : null;
      const b1 = (k in (curBld.map || {})) ? String(curBld.map[k] || '') : '';
      const b2 = (k in (newBld.map || {})) ? String(newBld.map[k] || '') : '';
      const cap1 = curSnap.capitalSet ? curSnap.capitalSet.has(k) : false;
      const cap2 = newSnap.capitalSet ? newSnap.capitalSet.has(k) : false;
      if(t1 !== t2 || c1 !== c2 || cap1 !== cap2 || b1 !== b2){
        const m = k.match(/^(\d+)-(\d+)$/);
        if(!m) continue;
        changed.push({ row: Number(m[1]), col: Number(m[2]) });
      }
    }
    // 走査順を安定化
    changed.sort((a,b) => (a.row - b.row) || (a.col - b.col));
    return changed;
  }

  // =========================
  // RBクリック専用：指定座標（window.__FOW の visible+explored union 等）だけを差分判定対象にする
  //  - coords: [{row, col}, ...]
  // =========================
  function diffChangedCellsWithinCoords(curSnap, newSnap, coords){
    const changed = [];
    const keys = new Set();
    const curTerr = terrainsKeyToMap(curSnap?.terrainsKey || '');
    const newTerr = terrainsKeyToMap(newSnap?.terrainsKey || '');
    const curBld = buildingsKeyToMap(curSnap?.buildingsKey || '');
    const newBld = buildingsKeyToMap(newSnap?.buildingsKey || '');

    // coords 由来のキーだけを見る（＝既知領域だけ）
    if(Array.isArray(coords)){
      for(const rc of coords){
        if(!rc) continue;
        const r = Number(rc.row);
        const c = Number(rc.col);
        if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
        keys.add(`${r}-${c}`);
      }
    }

    // coords が取れない/空の場合は「安全側」に全セル差分へフォールバック
    if(keys.size === 0){
      return diffChangedCells(curSnap, newSnap);
    }

    for(const k of keys){
      const t1 = Number(curTerr.map[k] ?? -1);
      const t2 = Number(newTerr.map[k] ?? -1);
      const c1 = (curSnap.cellColors && (k in curSnap.cellColors)) ? curSnap.cellColors[k] : null;
      const c2 = (newSnap.cellColors && (k in newSnap.cellColors)) ? newSnap.cellColors[k] : null;
      const b1 = (k in (curBld.map || {})) ? String(curBld.map[k] || '') : '';
      const b2 = (k in (newBld.map || {})) ? String(newBld.map[k] || '') : '';
      const cap1 = curSnap.capitalSet ? curSnap.capitalSet.has(k) : false;
      const cap2 = newSnap.capitalSet ? newSnap.capitalSet.has(k) : false;
      if(t1 !== t2 || c1 !== c2 || cap1 !== cap2 || b1 !== b2){
        const m = k.match(/^(\d+)-(\d+)$/);
        if(!m) continue;
        changed.push({ row: Number(m[1]), col: Number(m[2]) });
      }
    }

    changed.sort((a,b) => (a.row - b.row) || (a.col - b.col));
    return changed;
  }

  function buildRbPatchedApiSnapshot(snap){
    const terrainObj = Object.create(null);
    const terr = terrainsKeyToMap(snap?.terrainsKey || '');
    for(const k of terr.keys){
      terrainObj[k] = terr.map[k];
    }

    const buildingObj = Object.create(null);
    const bld = buildingsKeyToMap(snap?.buildingsKey || '');
    for(const k of bld.keys){
      const raw = String(bld.map[k] || '');
      const p = raw.split('|');
      buildingObj[k] = {
        kind: String(p[0] || ''),
        owner: String(p[1] || '')
      };
    }

  const avatarObj = Object.create(null);
  const av = avatarsKeyToMap(snap?.avatarsKey || '');
  for(const k of av.keys){
    try{
      avatarObj[k] = JSON.parse(String(av.map[k] || '[]'));
    }catch(_e){
      avatarObj[k] = [];
    }
  }

    return {
      rows: Number(snap?.rows || 0),
      cols: Number(snap?.cols || 0),
      hasCapital: !!snap?.hasCapital,
      cellColors: Object.assign(Object.create(null), snap?.cellColors || {}),
      capitalKeys: Array.from(snap?.capitalSet || []).sort(),
      terrainMap: terrainObj,
      buildingsMap: buildingObj,
      avatarsMap: avatarObj,
      selfAvatar: av.selfAvatar ? {
        row: Number(av.selfAvatar.row),
        col: Number(av.selfAvatar.col),
        team: Number(av.selfAvatar.team || 0),
        key: String(av.selfAvatar.key || 'ac')
      } : null,
      visibleKeys: Array.from(snap?.visibleSet || []).sort(),
      exploredKeys: Array.from(snap?.exploredSet || []).sort(),
      visibleList: Array.isArray(snap?.visibleList) ? snap.visibleList.map((rc) => [Number(rc[0]), Number(rc[1])]) : [],
      exploredList: Array.isArray(snap?.exploredList) ? snap.exploredList.map((rc) => [Number(rc[0]), Number(rc[1])]) : []
    };
  }

  function getHcLCellElement(row, col){
    return document.querySelector(`.grid .cell[data-row="${row}"][data-col="${col}"]`);
  }

  function applyHcLCellVisualPatch(row, col, color, hasCapital){
    const cell = getHcLCellElement(row, col);
    if(!cell) return false;

    const bg = (color == null || color === '') ? '#ffffff00' : String(color);
    cell.style.backgroundColor = bg;
    cell.style.outline = hasCapital ? '2px solid gold' : '';
    return true;
  }

  function applyHcLBattlemapPartialUpdate(newSnap, changed){
    try{
      if(mode === 'rb') return false;
      if(!newSnap || typeof newSnap !== 'object') return false;
      if(!Array.isArray(changed) || changed.length === 0){
        setBattlemapSnapshotCache(newSnap, 'applyHcLBattlemapPartialUpdate(empty)');
        return true;
      }

      let okCount = 0;
      for(const rc of changed){
        if(!rc) continue;
        const row = Number(rc.row);
        const col = Number(rc.col);
        if(!Number.isFinite(row) || !Number.isFinite(col)) continue;

        const key = `${row}-${col}`;
        const color = (newSnap.cellColors && Object.prototype.hasOwnProperty.call(newSnap.cellColors, key))
          ? newSnap.cellColors[key]
          : null;
        const hasCapital = !!(newSnap.capitalSet && newSnap.capitalSet.has(key));

        if(applyHcLCellVisualPatch(row, col, color, hasCapital)){
          okCount++;
        }
      }

      const ok = (okCount === changed.length);
      if(ok){
        setBattlemapSnapshotCache(newSnap, 'applyHcLBattlemapPartialUpdate');
      }
      return ok;
    }catch(_e){
      return false;
    }
  }

  function buildRbChangedCellMeta(curSnap, newSnap, changed){
    const out = [];
    const list = Array.isArray(changed) ? changed : [];

    const curTerr = terrainsKeyToMap(curSnap?.terrainsKey || '');
    const newTerr = terrainsKeyToMap(newSnap?.terrainsKey || '');
    const curBld  = buildingsKeyToMap(curSnap?.buildingsKey || '');
    const newBld  = buildingsKeyToMap(newSnap?.buildingsKey || '');
    const curAv   = avatarsKeyToMap(curSnap?.avatarsKey || '');
    const newAv   = avatarsKeyToMap(newSnap?.avatarsKey || '');

    const curCap = (curSnap?.capitalSet instanceof Set)
      ? curSnap.capitalSet
      : new Set(Array.isArray(curSnap?.capitalList) ? curSnap.capitalList.map(([r,c]) => `${r}-${c}`) : []);
    const newCap = (newSnap?.capitalSet instanceof Set)
      ? newSnap.capitalSet
      : new Set(Array.isArray(newSnap?.capitalList) ? newSnap.capitalList.map(([r,c]) => `${r}-${c}`) : []);

    const curVis = (curSnap?.visibleSet instanceof Set)
      ? curSnap.visibleSet
      : new Set(Array.isArray(curSnap?.visibleList) ? curSnap.visibleList.map(([r,c]) => `${r}-${c}`) : []);
    const newVis = (newSnap?.visibleSet instanceof Set)
      ? newSnap.visibleSet
      : new Set(Array.isArray(newSnap?.visibleList) ? newSnap.visibleList.map(([r,c]) => `${r}-${c}`) : []);

    const curExp = (curSnap?.exploredSet instanceof Set)
      ? curSnap.exploredSet
      : new Set(Array.isArray(curSnap?.exploredList) ? curSnap.exploredList.map(([r,c]) => `${r}-${c}`) : []);
    const newExp = (newSnap?.exploredSet instanceof Set)
      ? newSnap.exploredSet
      : new Set(Array.isArray(newSnap?.exploredList) ? newSnap.exploredList.map(([r,c]) => `${r}-${c}`) : []);

    for(const rc of list){
      if(!rc) continue;
      const row = Number(rc.row);
      const col = Number(rc.col);
      if(!Number.isFinite(row) || !Number.isFinite(col)) continue;

      const key = `${row}-${col}`;

      const colorChanged = String((curSnap?.cellColors && curSnap.cellColors[key]) || '') !== String((newSnap?.cellColors && newSnap.cellColors[key]) || '');
      const terrainChanged = Number(curTerr.map[key] ?? -1) !== Number(newTerr.map[key] ?? -1);
      const buildingChanged = String(curBld.map[key] || '') !== String(newBld.map[key] || '');
      const avatarChanged = String(curAv.map[key] || '') !== String(newAv.map[key] || '');
      const capitalChanged = curCap.has(key) !== newCap.has(key);
      const visibleChanged = curVis.has(key) !== newVis.has(key);
      const exploredChanged = curExp.has(key) !== newExp.has(key);

      const needBase = !!(colorChanged || terrainChanged || buildingChanged || capitalChanged);
      const needFog = !!(visibleChanged || exploredChanged || capitalChanged);
      const needOverlay = !!(colorChanged || avatarChanged);

      out.push({
        row,
        col,
        base: needBase,
        fog: needFog,
        overlay: needOverlay,
        terrain: terrainChanged,
        color: colorChanged,
        building: buildingChanged,
        capital: capitalChanged,
        avatar: avatarChanged
      });
    }

    return out;
  }

  function applyRbBattlemapPartialUpdate(newSnap, changed){
    try{
      if(mode !== 'rb') return false;
      const api = window.__DBA_RB_API;
      if(!api || typeof api.applySnapshot !== 'function') return false;
      const curSnap = getCurrentBattlemapSnapshot();
      const changedMeta = buildRbChangedCellMeta(curSnap, newSnap, changed);
      const ok = !!api.applySnapshot(
        buildRbPatchedApiSnapshot(newSnap),
        Array.isArray(changed) ? changed : [],
        changedMeta
      );
      if(ok){
        setBattlemapSnapshotCache(newSnap, 'applyRbBattlemapPartialUpdate');
      }
      return ok;
    }catch(_e){
      return false;
    }
  }

  function buildDetailFetchJobsForChangedCells(curSnap, newSnap, changed){
    const list = Array.isArray(changed) ? changed : [];
    if(list.length === 0) return [];

    const out = [];
    for(const job of list){
      if(!job) continue;
      const row = Number(job.row);
      const col = Number(job.col);
      if(!Number.isFinite(row) || !Number.isFinite(col)) continue;

      const key = `${row}-${col}`;
      const c1 = (curSnap?.cellColors && Object.prototype.hasOwnProperty.call(curSnap.cellColors, key))
        ? String(curSnap.cellColors[key] || '')
        : '';
      const c2 = (newSnap?.cellColors && Object.prototype.hasOwnProperty.call(newSnap.cellColors, key))
        ? String(newSnap.cellColors[key] || '')
        : '';

      // 再設計方針：
      // - マップ本体は常に server HTML を正として丸ごと差し替える
      // - 文字レイヤーだけを detail で補完する
      // - 差分更新で detail を取りに行くのは「チームカラーが変わったセル」のみ
      //   （= 無色→有色 / 有色→無色 / 有色A→有色B を含む）
      if(c1 !== c2){
        out.push({ row, col });
      }
    }

    return out;
  }

  async function updateOnlyChangedCellsFromFetchedDoc(doc, meta){
    const btn = document.getElementById('dba-btn-battleinfo');
    const showAlertOnError = (meta && Object.prototype.hasOwnProperty.call(meta, 'showAlertOnError'))
      ? !!meta.showAlertOnError
      : true;
    if(btn){
      btn.disabled = true;
      btn.dataset.dbaBusy = '1';
      btn.textContent = '差分確認中…';
    }

    let topUrl = meta?.topUrl || makeTeambattleUrl({ m: mode });
    try{
      if(!doc) throw new Error('doc is null');

      // (2) 現在と最新を比較
      const curSnap = getCurrentBattlemapSnapshot();
      let activeDoc = doc;
      let newSnap = meta?.snapshot || getBattlemapSnapshotFromDoc(activeDoc);

      if(curSnap.rows !== newSnap.rows || curSnap.cols !== newSnap.cols){
        if(btn) btn.textContent = '全更新（サイズ差）…';
        await scanAllCellsAndRenderFromFetchedDoc(activeDoc, {
          topUrl,
          snapshot: newSnap,
          showAlertOnError
        });
        return;
      }

      let changed = diffChangedCells(curSnap, newSnap);

      // RBの試合境界付近では、最初の1回が「まだ旧試合マップ」のことがある。
      // 差分0件かつ境界近辺の時だけ少し待って再取得し、新試合マップへの切り替わりを待つ。
      if(mode === 'rb' && changed.length === 0){
        const expectedElapsedSec = getExpectedElapsedSecondFromCurrentMatchState();
        const shouldRetryBoundary =
          Number.isFinite(expectedElapsedSec) &&
          isNearMatchBoundary(
            expectedElapsedSec,
            DBA_BATTLEINFO_RB_BOUNDARY_RETRY_WINDOW_SEC
          );

        if(shouldRetryBoundary){
          for(let i = 0; i < DBA_BATTLEINFO_RB_BOUNDARY_RETRY_DELAYS_MS.length; i++){
            const waitMs = Number(DBA_BATTLEINFO_RB_BOUNDARY_RETRY_DELAYS_MS[i] || 0);
            if(btn){
              btn.textContent = `境界再確認中…(${i + 1}/${DBA_BATTLEINFO_RB_BOUNDARY_RETRY_DELAYS_MS.length})`;
            }

            await sleepMs(waitMs);

            const latest = await fetchLatestTopPageDoc();
            topUrl = latest.topUrl;
            activeDoc = latest.doc;
            newSnap = getBattlemapSnapshotFromDoc(activeDoc);

            if(curSnap.rows !== newSnap.rows || curSnap.cols !== newSnap.cols){
              if(btn) btn.textContent = '全更新（サイズ差）…';
              await scanAllCellsAndRenderFromFetchedDoc(activeDoc, {
                topUrl,
                snapshot: newSnap,
                showAlertOnError
              });
              return;
            }

            changed = diffChangedCells(curSnap, newSnap);
            if(changed.length > 0){
              break;
            }

            const retryElapsedSec = getExpectedElapsedSecondFromCurrentMatchState();
            const stillNearBoundary =
              Number.isFinite(retryElapsedSec) &&
              isNearMatchBoundary(
                retryElapsedSec,
                DBA_BATTLEINFO_RB_BOUNDARY_RETRY_WINDOW_SEC
              );

            if(!stillNearBoundary){
              break;
            }
          }
        }
      }

      // ★追加：クリック（短押し）でも header + チーム情報2テーブル を最新化
      // （差分セルが0でも、上部の情報は更新したい）
      await refreshHeaderAndTeamTablesFromFetchedDoc(activeDoc, {
        topUrl,
        snapshot: newSnap
      });

      const oldTexts = snapshotLayerTexts();

      if(btn) btn.textContent = 'マップ差し替え中…';
      const refreshed = await refreshBattlemapFromFetchedDoc(activeDoc, {
        topUrl,
        snapshot: newSnap
      });
      if(!refreshed){
        throw new Error('battlemap refresh failed');
      }

      initBattlemapLayer();
      resetBattlemapLayerRectStabilizer();
      scheduleBattlemapLayerSync();
      await raf2();

      restoreLayerTextsFromSnapshot(oldTexts, buildAllowedLayerTextKeySet(newSnap));

      if(changed.length === 0){
        {
          const snap = getCurrentBattlemapSnapshot();
          renderRbOriginalBorders(snap);
          renderRbCapitalCrowns(snap);
          renderCurrentCellMarker(snap);
          endBattlemapLayerTextFreeze();
        }
        if(btn){
          btn.disabled = false;
          btn.dataset.dbaBusy = '0';
          btn.innerHTML = '戦況<br>情報';
        }
        return;
      }

      const detailJobs = buildDetailFetchJobsForChangedCells(curSnap, newSnap, changed);

      if(detailJobs.length === 0){
        {
          const snap = getCurrentBattlemapSnapshot();
          renderRbOriginalBorders(snap);
          renderRbCapitalCrowns(snap);
          renderCurrentCellMarker(snap);
          endBattlemapLayerTextFreeze();
        }
        if(btn){
          btn.disabled = false;
          btn.dataset.dbaBusy = '0';
          btn.innerHTML = '戦況<br>情報';
        }
        return;
      }

      if(btn) btn.textContent = `差分更新中…(${detailJobs.length})`;

      const CONCURRENCY = 12;
      await mapLimit(detailJobs, CONCURRENCY, async (job, idx) => {
        const { row, col } = job;
        try{
          const { holder, reg } = await fetchCellDetail(row, col);
          setLayerCellText(row, col, buildLayerCellDisplayText(reg, holder, row, col));
        }catch(_e){
          setLayerCellText(row, col, `ERR\n(${row},${col})`);
        }
        if(btn && (idx % 10 === 0)){
          const done = idx + 1;
          btn.textContent = `差分更新中…(${done}/${detailJobs.length})`;
        }
        return true;
      });

      {
        const snap = getCurrentBattlemapSnapshot();
        renderRbOriginalBorders(snap);
        renderRbCapitalCrowns(snap);
        renderCurrentCellMarker(snap);
        endBattlemapLayerTextFreeze();
      }

      if(btn){
        btn.disabled = false;
        btn.dataset.dbaBusy = '0';
        btn.innerHTML = '戦況<br>情報';
      }
    }catch(e){
      dbgLog('battleInfo', 'warn', 'CLICK update failed', { mode, error: String(e && e.message ? e.message : e) });
      if(btn){
        btn.disabled = false;
        btn.dataset.dbaBusy = '0';
        btn.innerHTML = '戦況<br>情報';
      }
      if(showAlertOnError){
        alert('戦況情報の取得に失敗しました。');
      }
    }
  }

  async function updateOnlyChangedCellsFromTopPage(){
    const { topUrl, doc } = await fetchLatestTopPageDoc();
    const newSnap = getBattlemapSnapshotFromDoc(doc);
    return updateOnlyChangedCellsFromFetchedDoc(doc, {
      topUrl,
      snapshot: newSnap,
      showAlertOnError: true
    });
  }

  function waitAndApplyScale(){
    let mo = null;
    let retryTimer = 0;
    let retryCount = 0;
    let settled = false;

    const clearRetryTimer = () => {
      if(retryTimer){
        clearTimeout(retryTimer);
        retryTimer = 0;
      }
    };

    const stopWatching = () => {
      clearRetryTimer();
      if(mo){
        mo.disconnect();
        mo = null;
      }
    };

    const applyOnce = () => {
      const settings = loadSettings();
      if(mode === 'rb'){
        const sz = getEffectiveCellSizeForMode('rb', settings);
        if(applyCellSizeToCanvasWrap(sz.width, sz.height)){
          ensureRbPointerFix();
          scheduleBattlemapLayerSync();
          return true;
        }
      }else{
        const sz = getEffectiveCellSizeForMode(mode, settings);
        if(applyCellSizeToGrid(sz.width, sz.height)){
          syncHcLMapContainerHeight();
          scheduleBattlemapLayerSync();
          return true;
        }
      }
      return false;
    };

    const scheduleRetry = () => {
      clearRetryTimer();
      if(settled) return;
      if(retryCount >= 8) return;

      const delays = [0, 40, 120, 250, 500, 800, 1200, 1800];
      const delay = delays[Math.min(retryCount, delays.length - 1)];
      retryCount += 1;

      retryTimer = setTimeout(() => {
        retryTimer = 0;
        if(settled) return;

        const ok = applyOnce();
        if(ok){
          // ページ側の後続処理で上書きされる場合に備えて、
          // 少しだけ再試行を続けて保存値を定着させる
          if(retryCount < 8){
            scheduleRetry();
          }else{
            settled = true;
            stopWatching();
          }
          return;
        }

        scheduleRetry();
      }, delay);
    };

    if(applyOnce()){
      scheduleRetry();
      return;
    }

    mo = new MutationObserver(() => {
      if(applyOnce()){
        scheduleRetry();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    scheduleRetry();
  }

  // =========================
  // 設定モーダル（UI）
  // =========================
  function buildSettingsModal(){
    if(document.getElementById('dba-m-settings')) return;

    const dlg = document.createElement('dialog');
    dlg.id = 'dba-m-settings';
    dlg.className = 'dba-m-std';

    // Top
    const top = document.createElement('div');
    top.className = 'dba-modal__top';

    const title = document.createElement('div');
    title.className = 'dba-modal__title';
    title.textContent = '設定';

    const btnX = document.createElement('button');
    btnX.type = 'button';
    btnX.className = 'dba-btn-x';
    btnX.textContent = '×';

    top.appendChild(title);
    top.appendChild(btnX);

    // Mid
    const mid = document.createElement('div');
    mid.className = 'dba-modal__mid';

    const settings = loadSettings();

    function mkCellSizeLine(modeKey){
      const line = document.createElement('div');
      line.className = 'dba-setting-cellsize-line';

      const name = document.createElement('span');
      name.className = 'dba-setting-cellsize-name';
      name.textContent = getModeLabel(modeKey);

      const widthLabel = document.createElement('span');
      widthLabel.className = 'dba-setting-cellsize-unit';
      widthLabel.textContent = 'width';

      const sz = getEffectiveCellSizeForMode(modeKey, settings);

      const wInput = document.createElement('input');
      wInput.style.margin = '0 1px';
      wInput.type = 'number';
      wInput.min = '8';
      wInput.max = '256';
      wInput.step = '1';
      wInput.value = String(sz.width);
      wInput.dataset.modeKey = modeKey;
      wInput.dataset.axis = 'width';

      const wPx = document.createElement('span');
      wPx.className = 'dba-setting-cellsize-unit';
      wPx.textContent = 'px';

      const sep = document.createElement('span');
      sep.className = 'dba-setting-cellsize-sep';
      sep.style.fontSize = '1.1em';
      sep.style.lineHeight = '1.1em';
      sep.style.verticalAlign = 'text-top';
      sep.textContent = '|';

      const heightLabel = document.createElement('span');
      heightLabel.className = 'dba-setting-cellsize-unit';
      heightLabel.textContent = 'height';

      const hInput = document.createElement('input');
      hInput.style.margin = '0 1px';
      hInput.type = 'number';
      hInput.min = '8';
      hInput.max = '256';
      hInput.step = '1';
      hInput.value = String(sz.height);
      hInput.dataset.modeKey = modeKey;
      hInput.dataset.axis = 'height';

      const hPx = document.createElement('span');
      hPx.className = 'dba-setting-cellsize-unit';
      hPx.textContent = 'px';

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'dba-btn-mini';
      resetBtn.textContent = 'リセット';
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const def = getResponsiveDefaultCellSize(modeKey);
        wInput.value = String(def.width);
        hInput.value = String(def.height);
        dirty = true;
      });

      line.appendChild(name);
      line.appendChild(widthLabel);
      line.appendChild(wInput);
      line.appendChild(wPx);
      line.appendChild(sep);
      line.appendChild(heightLabel);
      line.appendChild(hInput);
      line.appendChild(hPx);
      line.appendChild(resetBtn);
      return line;
    }

    // 設定全体に対する注意説明
    (function mkSettingsNoticeBlock(){
      const box = document.createElement('div');
      box.className = 'dba-setting-row';
      box.style.background = '#fff8e6';
      box.style.border = '1px solid #e0b84a';

      const note = document.createElement('div');
      note.style.fontSize = '0.95em';
      note.style.fontWeight = '700';
      note.style.textAlign = 'left';
      note.style.lineHeight = '1.2';
      note.style.whiteSpace = 'normal';
      note.style.overflowWrap = 'anywhere';
      note.style.wordBreak = 'break-word';
      note.textContent = '【 案内 】??項目は設定後に、全セル更新（「戦況情報」長押し）か、ブラウザによるページ再読み込みが必要なときもあります。';

      box.appendChild(note);
      mid.appendChild(box);
    })();

    // ショートカット
    (function mkShortcutBlock(){
      const box = document.createElement('div');
      box.className = 'dba-setting-row';

      const t = document.createElement('div');
      t.style.fontSize = '1em';
      t.style.fontWeight = '700';
      t.style.textAlign = 'left';
      t.style.marginBottom = '8px';
      t.textContent = '各「オプション」画面へのショートカット';
      box.appendChild(t);

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.flexWrap = 'wrap';
      row.style.gap = '8px';
      row.style.justifyContent = 'flex-start';
      row.style.alignItems = 'center';

      const btnBrOpt = document.createElement('button');
      btnBrOpt.type = 'button';
      btnBrOpt.className = 'dba-btn-mini';
      btnBrOpt.textContent = '戦闘結果';

      const btnRosterOpt = document.createElement('button');
      btnRosterOpt.type = 'button';
      btnRosterOpt.className = 'dba-btn-mini';
      btnRosterOpt.textContent = '装備ロスター';

      const btnAeOpt = document.createElement('button');
      btnAeOpt.type = 'button';
      btnAeOpt.className = 'dba-btn-mini';
      btnAeOpt.textContent = 'オート装備設定';

      btnBrOpt.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openBattleResultOptionsModal(); // dba-m-battle-result-opt
      });
      btnRosterOpt.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openRosterOptionsModal(); // dba-m-roster-option
      });
      btnAeOpt.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openAutoEquipOptionsModal(); // dba-m-auto-equip-opt
      });

      row.appendChild(btnBrOpt);
      row.appendChild(btnRosterOpt);
      row.appendChild(btnAeOpt);
      box.appendChild(row);
      mid.appendChild(box);
    })();

    // 戦闘オプション
    (function mkPostBattleAutoDiffBlock(){
      const row = document.createElement('div');
      row.className = 'dba-setting-row';

      const title = document.createElement('div');
      title.className = 'dba-setting-block-title';
      title.textContent = '戦闘オプション';
      row.appendChild(title);

      const body = document.createElement('div');
      body.className = 'dba-setting-subgroup';

      const labAutoDiff = document.createElement('label');
      labAutoDiff.className = 'dba-setting-checkline';

      const inputAutoDiff = document.createElement('input');
      inputAutoDiff.type = 'checkbox';
      inputAutoDiff.checked = !!settings?.postBattle?.autoDiffSync;
      inputAutoDiff.dataset.postBattleAutoDiff = '1';

      const txtAutoDiff = document.createElement('span');
      txtAutoDiff.className = 'dba-setting-checktext';
      txtAutoDiff.textContent = '攻撃した後に自動で「戦況情報（差分取得）」を行う。';

      labAutoDiff.appendChild(inputAutoDiff);
      labAutoDiff.appendChild(txtAutoDiff);
      body.appendChild(labAutoDiff);

      const noteAutoDiff = document.createElement('div');
      noteAutoDiff.className = 'dba-roster-opt-note';
      noteAutoDiff.textContent = '画面のちらつきが発生しやすくなります。';
      body.appendChild(noteAutoDiff);

      const labSuppressFriendlyFire = document.createElement('label');
      labSuppressFriendlyFire.className = 'dba-setting-checkline';

      const inputSuppressFriendlyFire = document.createElement('input');
      inputSuppressFriendlyFire.type = 'checkbox';
      inputSuppressFriendlyFire.checked = !!settings?.postBattle?.suppressOwnCapitalFriendlyFire;
      inputSuppressFriendlyFire.setAttribute('data-suppress-own-capital-friendly-fire', '1');

      const txtSuppressFriendlyFire = document.createElement('span');
      txtSuppressFriendlyFire.className = 'dba-setting-checktext';
      txtSuppressFriendlyFire.textContent = '自チーム首都へのフレンドリファイアを抑止する。';

      inputSuppressFriendlyFire.addEventListener('change', async () => {
        if(!inputSuppressFriendlyFire.checked){
          const ok = await openDisableOwnCapitalProtectionConfirmModal();
          if(!ok){
            inputSuppressFriendlyFire.checked = true;
            return;
          }
        }
        dirty = true;
      });

      labSuppressFriendlyFire.appendChild(inputSuppressFriendlyFire);
      labSuppressFriendlyFire.appendChild(txtSuppressFriendlyFire);
      body.appendChild(labSuppressFriendlyFire);

      const note = document.createElement('div');
      note.className = 'dba-roster-opt-note';
      note.innerText = '仕様変更で突然機能しなくなる可能性があるので、過信しないでください。\nこの機能を解除する時には確認画面が出ます。';
      body.appendChild(note);

      row.appendChild(body);
      mid.appendChild(row);
    })();

    // レッドvsブルー：表示オプション
    (function mkRbLayerDisplayBlock(){
      const row = document.createElement('div');
      row.className = 'dba-setting-row';

      const lab = document.createElement('label');
      lab.className = 'dba-setting-checkline';

      const txt = document.createElement('span');
      txt.className = 'dba-setting-checktext';
      txt.textContent = '表示オプション　※現在「レッドvsブルーモード」限定';

      lab.appendChild(txt);
      row.appendChild(lab);

      const sub = document.createElement('div');
      sub.className = 'dba-setting-subgroup';

      const labBorder = document.createElement('label');
      labBorder.className = 'dba-setting-checkline';

      const inputBorder = document.createElement('input');
      inputBorder.type = 'checkbox';
      inputBorder.checked = !!settings?.rbLayer?.showOriginalBorder;
      inputBorder.dataset.rbShowOriginalBorder = '1';

      const txtBorder = document.createElement('span');
      txtBorder.className = 'dba-setting-checktext';
      txtBorder.textContent = 'DBAオリジナルの境界カラーを表示する。';

      labBorder.appendChild(inputBorder);
      labBorder.appendChild(txtBorder);
      sub.appendChild(labBorder);

      const rowBorderOpacity = document.createElement('div');
      rowBorderOpacity.className = 'dba-setting-row-sub';

      const titleBorderOpacity = document.createElement('div');
      titleBorderOpacity.className = 'dba-setting-block-title';
      titleBorderOpacity.textContent = '境界線の濃さ（不透明度：100～50％）';
      rowBorderOpacity.appendChild(titleBorderOpacity);

      const lineBorderOpacity = document.createElement('div');
      lineBorderOpacity.style.display = 'grid';
      lineBorderOpacity.style.gridTemplateColumns = '1fr auto';
      lineBorderOpacity.style.alignItems = 'center';
      lineBorderOpacity.style.gap = '10px';

      const inputBorderOpacity = document.createElement('input');
      inputBorderOpacity.type = 'range';
      inputBorderOpacity.min = '50';
      inputBorderOpacity.max = '100';
      inputBorderOpacity.step = '1';
      inputBorderOpacity.value = String(150 - sanitizeRbBorderOpacity(settings?.rbLayer?.borderOpacity));
      inputBorderOpacity.dataset.rbBorderOpacity = '1';

      const txtBorderOpacity = document.createElement('span');
      txtBorderOpacity.textContent = `${150 - sanitizeRbBorderOpacity(inputBorderOpacity.value)}%`;

      inputBorderOpacity.addEventListener('input', () => {
        txtBorderOpacity.textContent = `${150 - sanitizeRbBorderOpacity(inputBorderOpacity.value)}%`;
      });

      lineBorderOpacity.appendChild(inputBorderOpacity);
      lineBorderOpacity.appendChild(txtBorderOpacity);
      rowBorderOpacity.appendChild(lineBorderOpacity);
      sub.appendChild(rowBorderOpacity);

      const labCrown = document.createElement('label');
      labCrown.className = 'dba-setting-checkline';

      const inputCrown = document.createElement('input');
      inputCrown.type = 'checkbox';
      inputCrown.checked = !!settings?.rbLayer?.showCapitalCrown;
      inputCrown.dataset.rbShowCapitalCrown = '1';

      const txtCrown = document.createElement('span');
      txtCrown.className = 'dba-setting-checktext';
      txtCrown.textContent = '首都セルに??を表示する。';

      labCrown.appendChild(inputCrown);
      labCrown.appendChild(txtCrown);
      sub.appendChild(labCrown);

      const labCurrentMarker = document.createElement('label');
      labCurrentMarker.className = 'dba-setting-checkline';

      const inputCurrentMarker = document.createElement('input');
      inputCurrentMarker.type = 'checkbox';
      inputCurrentMarker.checked = !!settings?.rbLayer?.showCurrentCellMarker;
      inputCurrentMarker.dataset.rbShowCurrentCellMarker = '1';

      const txtCurrentMarker = document.createElement('span');
      txtCurrentMarker.className = 'dba-setting-checktext';
      txtCurrentMarker.textContent = '現在地セルを指し示すマーカーを表示する。';

      labCurrentMarker.appendChild(inputCurrentMarker);
      labCurrentMarker.appendChild(txtCurrentMarker);
      sub.appendChild(labCurrentMarker);

      const markerColorRow = document.createElement('div');
      markerColorRow.className = 'dba-setting-row-sub';
      markerColorRow.style.marginTop = '4px';

      const markerColorTitle = document.createElement('div');
      markerColorTitle.className = 'dba-setting-block-title';
      markerColorTitle.style.margin = '0 0 6px 26px';
      markerColorTitle.textContent = 'マーカーの色名';
      markerColorRow.appendChild(markerColorTitle);

      const markerColorGroup = document.createElement('div');
      markerColorGroup.className = 'dba-setting-radio-group';

      const markerColorItems = [
        { value: 'silver',  label: '銀色' },
        { value: 'gold',    label: '金色' },
        { value: 'purple',  label: '紫色' },
        { value: 'crimson', label: '紅色' },
        { value: 'cyan',    label: '水色' }
      ];
      const currentMarkerColor = sanitizeCurrentMarkerColorName(settings?.rbLayer?.currentCellMarkerColor);

      for(const item of markerColorItems){
        const line = document.createElement('label');
        line.className = 'dba-setting-radio-line';

        const inp = document.createElement('input');
        inp.type = 'radio';
        inp.name = 'dba-rb-current-marker-color';
        inp.value = item.value;
        inp.checked = (currentMarkerColor === item.value);
        inp.dataset.rbCurrentCellMarkerColor = '1';

        const txt = document.createElement('span');
        txt.textContent = item.label;

        line.appendChild(inp);
        line.appendChild(txt);
        markerColorGroup.appendChild(line);
      }

      markerColorRow.appendChild(markerColorGroup);
      sub.appendChild(markerColorRow);

      const markerDelayRow = document.createElement('div');
      markerDelayRow.className = 'dba-setting-row-sub';
      markerDelayRow.style.marginTop = '4px';

      const markerDelayLine = document.createElement('label');
      markerDelayLine.className = 'dba-setting-checkline';
      markerDelayLine.style.cursor = 'default';

      const markerDelayDummy = document.createElement('span');
      markerDelayDummy.style.display = 'inline-block';
      markerDelayDummy.style.width = '20px';
      markerDelayDummy.style.height = '20px';
      markerDelayDummy.style.flex = '0 0 20px';

      const markerDelayTextWrap = document.createElement('span');
      markerDelayTextWrap.className = 'dba-setting-checktext';

      const markerDelayText = document.createElement('span');
      markerDelayText.textContent = 'マーカーの移動を ';

      const markerDelayInput = document.createElement('input');
      markerDelayInput.type = 'number';
      markerDelayInput.min = '0';
      markerDelayInput.max = '5';
      markerDelayInput.step = '0.1';
      markerDelayInput.value = String(markerDelayMsToSec(settings?.rbLayer?.currentCellMarkerDelayMs));
      markerDelayInput.dataset.rbCurrentCellMarkerDelaySec = '1';
      markerDelayInput.style.width = '5em';
      markerDelayInput.style.margin = '0 6px';
      markerDelayInput.style.textAlign = 'center';

      const markerDelayUnit = document.createElement('span');
      markerDelayUnit.textContent = '秒 遅延させる。';

      markerDelayTextWrap.appendChild(markerDelayText);
      markerDelayTextWrap.appendChild(markerDelayInput);
      markerDelayTextWrap.appendChild(markerDelayUnit);

      markerDelayLine.appendChild(markerDelayDummy);
      markerDelayLine.appendChild(markerDelayTextWrap);
      markerDelayRow.appendChild(markerDelayLine);
      sub.appendChild(markerDelayRow);

      const labReg = document.createElement('label');
      labReg.className = 'dba-setting-checkline';

      const inputReg = document.createElement('input');
      inputReg.type = 'checkbox';
      inputReg.checked = !!settings?.rbLayer?.showCellRegulation;
      inputReg.dataset.rbShowCellRegulation = '1';

      const txtReg = document.createElement('span');
      txtReg.className = 'dba-setting-checktext';
      txtReg.textContent = '??各セルごとのレギュレーションを表示する。';

      labReg.appendChild(inputReg);
      labReg.appendChild(txtReg);
      sub.appendChild(labReg);

      const labNobody = document.createElement('label');
      labNobody.className = 'dba-setting-checkline';

      const inputNobody = document.createElement('input');
      inputNobody.type = 'checkbox';
      inputNobody.checked = !!settings?.rbLayer?.showNobodyHolder;
      inputNobody.dataset.rbShowNobodyHolder = '1';

      const txtNobody = document.createElement('span');
      txtNobody.className = 'dba-setting-checktext';
      txtNobody.textContent = '??未占領セルと占領不可地形セルの「誰もいない」を表示する。';

      labNobody.appendChild(inputNobody);
      labNobody.appendChild(txtNobody);
      sub.appendChild(labNobody);

      const labHideFnTooltip = document.createElement('label');
      labHideFnTooltip.className = 'dba-setting-checkline';

      const inputHideFnTooltip = document.createElement('input');
      inputHideFnTooltip.type = 'checkbox';
      inputHideFnTooltip.checked = !!settings?.rbLayer?.hideFnTooltip;
      inputHideFnTooltip.dataset.rbHideFnTooltip = '1';

      const txtHideFnTooltip = document.createElement('span');
      txtHideFnTooltip.className = 'dba-setting-checktext';
      txtHideFnTooltip.textContent = 'ヒントバルーンを表示しない。';

      labHideFnTooltip.appendChild(inputHideFnTooltip);
      labHideFnTooltip.appendChild(txtHideFnTooltip);
      sub.appendChild(labHideFnTooltip);

      row.appendChild(sub);
      mid.appendChild(row);
    })();

    (function mkLightRefreshBlock(){
      const row = document.createElement('div');
      row.className = 'dba-setting-row';

      const title = document.createElement('div');
      title.style.fontSize = '1.05em';
      title.style.fontWeight = '700';
      title.style.textAlign = 'left';
      title.style.margin = '0 0 8px 0';
      title.textContent = '軽量化措置';
      row.appendChild(title);

      const sub = document.createElement('div');
      sub.className = 'dba-setting-subgroup';

      const labStopAnim = document.createElement('label');
      labStopAnim.className = 'dba-setting-checkline';

      const inputStopAnim = document.createElement('input');
      inputStopAnim.type = 'checkbox';
      inputStopAnim.checked = !!settings?.rbLayer?.stopAnimation;
      inputStopAnim.dataset.rbStopAnimation = '1';

      const txtStopAnim = document.createElement('span');
      txtStopAnim.className = 'dba-setting-checktext';
      txtStopAnim.textContent = '??境界線やアバターのアニメーションを停止する。';

      labStopAnim.appendChild(inputStopAnim);
      labStopAnim.appendChild(txtStopAnim);
      sub.appendChild(labStopAnim);

      // 「軽量化」ボタン
      const labShowLightBtn = document.createElement('label');
      labShowLightBtn.className = 'dba-setting-checkline';

      const inputShowLightBtn = document.createElement('input');
      inputShowLightBtn.type = 'checkbox';
      inputShowLightBtn.checked = !!settings?.functionButtons?.showLightRefreshButton;
      inputShowLightBtn.dataset.showLightRefreshButton = '1';

      const txtShowLightBtn = document.createElement('span');
      txtShowLightBtn.className = 'dba-setting-checktext';
      txtShowLightBtn.textContent = '??ファンクションセクションに「軽量化」ボタンを表示する。';

      labShowLightBtn.appendChild(inputShowLightBtn);
      labShowLightBtn.appendChild(txtShowLightBtn);
      sub.appendChild(labShowLightBtn);

      const noteShowLightBtn = document.createElement('div');
      noteShowLightBtn.style.margin = '0 0 0 50px';
      noteShowLightBtn.style.padding = '0';
      noteShowLightBtn.style.fontSize = '0.92em';
      noteShowLightBtn.style.lineHeight = '1.35';
      noteShowLightBtn.style.opacity = '0.9';
      noteShowLightBtn.style.textAlign = 'left';
      noteShowLightBtn.textContent =
        'ブラウザの「再読み込み」に近い動作ですが、普通の再読み込みよりも、ページを少しきれいな状態で開き直すためのボタンです。動作が重い時、表示がおかしい時、なんとなく不安定な時に使うと、改善することがあります。ブラウザ全体ではなく DBA を立て直したい時に「軽量化」ボタンがおすすめです。';
      sub.appendChild(noteShowLightBtn);

      // 一定回数ごとの軽量化再読込
      const lab = document.createElement('label');
      lab.className = 'dba-setting-checkline';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!settings?.lightRefresh?.enabled;
      input.dataset.lightRefreshEnabled = '1';

      const txt = document.createElement('span');
      txt.className = 'dba-setting-checktext';
      txt.textContent = '??「戦闘ログ」を指定回数受信するごとに「軽量化」処理を行う。';

      lab.appendChild(input);
      lab.appendChild(txt);
      sub.appendChild(lab);

      const subline = document.createElement('div');
      subline.style.margin = '0 0 0 50px';
      subline.style.display = 'flex';
      subline.style.alignItems = 'center';
      subline.style.justifyContent = 'flex-start';
      subline.style.gap = '6px';
      subline.style.flexWrap = 'wrap';
      subline.style.textAlign = 'left';

      const pre = document.createElement('span');
      pre.textContent = '「戦闘ログ」受信';

      const cnt = document.createElement('input');
      cnt.type = 'number';
      cnt.min = '1';
      cnt.max = '9999';
      cnt.step = '1';
      cnt.value = String(sanitizeLightRefreshBattleCount(settings?.lightRefresh?.battleCount));
      cnt.dataset.lightRefreshBattleCount = '1';

      const suf = document.createElement('span');
      suf.textContent = '回ごと。';

      const note = document.createElement('div');
      note.style.width = '100%';
      note.style.fontSize = '0.92em';
      note.style.lineHeight = '1.35';
      note.style.opacity = '0.9';
      note.textContent = '「軽量化」機能を自動的・定期的に実行する機能です。「軽量化」ボタンを押すことが多い場合に有効化してください。';

      subline.appendChild(pre);
      subline.appendChild(cnt);
      subline.appendChild(suf);
      subline.appendChild(note);
      sub.appendChild(subline);

      row.appendChild(sub);
      mid.appendChild(row);
    })();

    (function mkCellSizeBlock(){
      const row = document.createElement('div');
      row.className = 'dba-setting-row';

      const title = document.createElement('div');
      title.style.fontSize = '1.05em';
      title.style.fontWeight = '700';
      title.style.textAlign = 'left';
      title.style.margin = '0 0 8px 0';
      title.textContent = 'セルサイズ調整';

      const note = document.createElement('div');
      note.style.fontSize = '1em';
      note.style.fontWeight = '400';
      note.style.textAlign = 'left';
      note.style.margin = '0 0 12px 30px';
      note.textContent = 'バトルマップの セル の大きさを設定できます。';

      const list = document.createElement('div');
      list.className = 'dba-setting-cellsize-list';
      list.appendChild(mkCellSizeLine('rb'));
      list.appendChild(mkCellSizeLine('l'));
      list.appendChild(mkCellSizeLine('hc'));

      row.appendChild(title);
      row.appendChild(note);
      row.appendChild(list);
      mid.appendChild(row);
    })();

    (function mkBaseFontRow(){
      const row = document.createElement('div');
      row.className = 'dba-setting-row';

      const title = document.createElement('div');
      title.style.fontSize = '1.05em';
      title.style.fontWeight = '700';
      title.style.textAlign = 'left';
      title.style.margin = '0 0 8px 0';
      title.textContent = '基準文字サイズ';

      const group = document.createElement('div');
      group.className = 'dba-setting-radio-group';

      const currentBase = sanitizeBaseFontPx(settings?.ui?.baseFontPx, getDefaultBaseFontPxForDevice());

      function mkRadio(px){
        const lab = document.createElement('label');
        lab.className = 'dba-setting-radio-line';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'dba-base-font-size';
        input.value = String(px);
        input.checked = currentBase === px;
        input.dataset.baseFontPx = '1';

        const txt = document.createElement('span');
        txt.textContent = `${px}px`;

        input.addEventListener('change', () => {
          if(!input.checked) return;
          applyBaseFontSize(px);
        });

        lab.appendChild(input);
        lab.appendChild(txt);
        return lab;
      }

      group.appendChild(mkRadio(17));
      group.appendChild(mkRadio(16));
      group.appendChild(mkRadio(14));
      group.appendChild(mkRadio(12));

      row.appendChild(title);
      row.appendChild(group);
      mid.appendChild(row);
    })();

    // レイヤー文字濃度（将来のテキスト/絵文字表示のための事前準備）
    (function mkOpacityRow(){
      const row = document.createElement('div');
      row.className = 'dba-setting-row';

      const lab = document.createElement('label');
      lab.textContent = 'レイヤー文字濃度（100?0）';

      const wrap = document.createElement('div');
      wrap.style.margin = '0 0 0 60px';
      wrap.style.display = 'grid';
      wrap.style.gridTemplateColumns = '1fr 36px';
      wrap.style.gap = '8px';
      wrap.style.alignItems = 'center';

      const input = document.createElement('input');
      input.style.margin = '0';
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.step = '1';
      input.value = String(100 - sanitizeOpacity(settings.layer.textOpacity));
      input.dataset.layerOpacity = '1';

      const out = document.createElement('div');
      out.textContent = String(100 - sanitizeOpacity(input.value));
      out.style.textAlign = 'right';
      out.style.fontWeight = '700';

      input.addEventListener('input', () => {
        out.textContent = String(100 - sanitizeOpacity(input.value));
        // 即時反映（保存は Apply/OK）
        applyLayerTextOpacity(100 - sanitizeOpacity(input.value));
      }, { passive: true });

      wrap.appendChild(input);
      wrap.appendChild(out);

      row.appendChild(lab);
      row.appendChild(wrap);
      mid.appendChild(row);
    })();

    // オリジナルHTMLの<header>要素の表示/非表示
    (function mkHeaderVisibleRow(){
      const row = document.createElement('div');
      row.className = 'dba-setting-row';

      const lab = document.createElement('label');
      lab.className = 'dba-setting-checkline';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!settings.header.showOriginalHeader;
      input.dataset.showOriginalHeader = '1';

      const txt = document.createElement('span');
      txt.className = 'dba-setting-checktext';
      txt.textContent = 'HTMLソースの<header>要素を表示する';

      lab.appendChild(input);
      lab.appendChild(txt);
      row.appendChild(lab);
      mid.appendChild(row);
    })();

    // スクリプト情報
    (function mkScriptInfoBlock(){
      const row = document.createElement('div');
      row.className = 'dba-setting-row';

      const title = document.createElement('div');
      title.className = 'dba-setting-block-title';
      title.textContent = 'スクリプト情報';

      const dl = document.createElement('dl');
      dl.className = 'dba-setting-deflist';

      const addDef = (dtText, ddText) => {
        const dt = document.createElement('dt');
        dt.textContent = dtText;
        const dd = document.createElement('dd');
        dd.textContent = ddText;
        dl.appendChild(dt);
        dl.appendChild(dd);
      };

      addDef('スクリプト名', 'Donguri Battle Assistant');
      addDef('バージョン', DBA_VERSION);
      addDef('作者名', '福呼び草');
      addDef('アシスタント', 'ChatGPT');

      row.appendChild(title);
      row.appendChild(dl);
      mid.appendChild(row);
    })();

    // Bot
    const bot = document.createElement('div');
    bot.className = 'dba-modal__bot';

    const btnOK = document.createElement('button');
    btnOK.type = 'button';
    btnOK.className = 'dba-btn-ok';
    btnOK.textContent = 'OK';

    const btnApply = document.createElement('button');
    btnApply.type = 'button';
    btnApply.className = 'dba-btn-apply';
    btnApply.textContent = 'Apply';

    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'dba-btn-close';
    btnClose.textContent = 'Close';

    bot.appendChild(btnOK);
    bot.appendChild(btnApply);
    bot.appendChild(btnClose);

    dlg.appendChild(top);
    dlg.appendChild(mid);
    dlg.appendChild(bot);

    document.body.appendChild(dlg);

    // Alert modal
    const adlg = document.createElement('dialog');
    adlg.id = 'dba-m-alert';
    adlg.className = 'dba-m-alert';

    const amid = document.createElement('div');
    amid.className = 'dba-alert__mid';
    amid.textContent = '変更を保存せずに閉じますか？';

    const abot = document.createElement('div');
    abot.className = 'dba-alert__bot';

    const aYes = document.createElement('button');
    aYes.type = 'button';
    aYes.className = 'dba-btn-ok';
    aYes.textContent = 'はい';

    const aBack = document.createElement('button');
    aBack.type = 'button';
    aBack.className = 'dba-btn-close';
    aBack.textContent = '戻る';

    abot.appendChild(aYes);
    abot.appendChild(aBack);

    adlg.appendChild(amid);
    adlg.appendChild(abot);
    document.body.appendChild(adlg);

    // dirty tracking
    let initial = JSON.stringify(readModalValues());
    let dirty = false;

    function readModalValues(){
      const out = {
        rb: { width: 32, height: 32 },
        hc: { width: 30, height: 30 },
        l:  { width: 30, height: 30 },
        baseFontPx: getDefaultBaseFontPxForDevice(),
        postBattleAutoDiff: false,
        suppressOwnCapitalFriendlyFire: false,
        lightRefreshEnabled: false,
        lightRefreshBattleCount: DEFAULT_SETTINGS.lightRefresh.battleCount,
        showLightRefreshButton: false,
        rbShowOriginalBorder: false,
        rbBorderOpacity: 100,
        rbStopAnimation: false,
        rbShowCapitalCrown: false,
        rbShowCurrentCellMarker: false,
        rbCurrentCellMarkerColor: 'silver',
        rbShowCellRegulation: false,
        rbShowNobodyHolder: false,
        layerTextOpacity: 100,
        showOriginalHeader: false
      };
      for(const inp of dlg.querySelectorAll('input[type="number"][data-mode-key][data-axis]')){
        const k = inp.dataset.modeKey;
        const axis = inp.dataset.axis;
        out[k][axis] = Number.parseInt(inp.value, 10);
      }
      const baseFont = dlg.querySelector('input[type="radio"][data-base-font-px="1"]:checked');
      if(baseFont){
        out.baseFontPx = Number.parseInt(baseFont.value, 10);
      }
      const pb = dlg.querySelector('input[type="checkbox"][data-post-battle-auto-diff="1"]');
      if(pb) out.postBattleAutoDiff = !!pb.checked;
      const soff = dlg.querySelector('input[type="checkbox"][data-suppress-own-capital-friendly-fire="1"]');
      if(soff) out.suppressOwnCapitalFriendlyFire = !!soff.checked;
      const lre = dlg.querySelector('input[type="checkbox"][data-light-refresh-enabled="1"]');
      if(lre) out.lightRefreshEnabled = !!lre.checked;
      const lrc = dlg.querySelector('input[type="number"][data-light-refresh-battle-count="1"]');
      if(lrc) out.lightRefreshBattleCount = Number.parseInt(lrc.value, 10);
      const slrb = dlg.querySelector('input[type="checkbox"][data-show-light-refresh-button="1"]');
      if(slrb) out.showLightRefreshButton = !!slrb.checked;
      const rbBorder = dlg.querySelector('input[type="checkbox"][data-rb-show-original-border="1"]');
      if(rbBorder) out.rbShowOriginalBorder = !!rbBorder.checked;
      const rbBorderOpacity = dlg.querySelector('input[type="range"][data-rb-border-opacity="1"]');
      if(rbBorderOpacity) out.rbBorderOpacity = 150 - Number.parseInt(rbBorderOpacity.value, 10);
      const rbStopAnim = dlg.querySelector('input[type="checkbox"][data-rb-stop-animation="1"]');
      if(rbStopAnim) out.rbStopAnimation = !!rbStopAnim.checked;
      const rbCrown = dlg.querySelector('input[type="checkbox"][data-rb-show-capital-crown="1"]');
      if(rbCrown) out.rbShowCapitalCrown = !!rbCrown.checked;
      const rbCurrentMarker = dlg.querySelector('input[type="checkbox"][data-rb-show-current-cell-marker="1"]');
      if(rbCurrentMarker) out.rbShowCurrentCellMarker = !!rbCurrentMarker.checked;
      const rbCurrentMarkerColor = dlg.querySelector('input[type="radio"][data-rb-current-cell-marker-color="1"]:checked');
      if(rbCurrentMarkerColor){
        out.rbCurrentCellMarkerColor = sanitizeCurrentMarkerColorName(rbCurrentMarkerColor.value);
      }
      const rbCurrentMarkerDelay = dlg.querySelector('input[type="number"][data-rb-current-cell-marker-delay-sec="1"]');
      if(rbCurrentMarkerDelay){
        out.rbCurrentCellMarkerDelayMs = markerDelaySecToMs(rbCurrentMarkerDelay.value);
      }
      const rbReg = dlg.querySelector('input[type="checkbox"][data-rb-show-cell-regulation="1"]');
      if(rbReg) out.rbShowCellRegulation = !!rbReg.checked;
      const rbNobody = dlg.querySelector('input[type="checkbox"][data-rb-show-nobody-holder="1"]');
      if(rbNobody) out.rbShowNobodyHolder = !!rbNobody.checked;
      const rbHideFnTooltip = dlg.querySelector('input[type="checkbox"][data-rb-hide-fn-tooltip="1"]');
      if(rbHideFnTooltip) out.rbHideFnTooltip = !!rbHideFnTooltip.checked;
      const op = dlg.querySelector('input[type="range"][data-layer-opacity="1"]');
      if(op) out.layerTextOpacity = 100 - Number.parseInt(op.value, 10);
      const hd = dlg.querySelector('input[type="checkbox"][data-show-original-header="1"]');
      if(hd) out.showOriginalHeader = !!hd.checked;
      return out;
    }

    function setInputsFromSettings(s){
      for(const inp of dlg.querySelectorAll('input[type="number"][data-mode-key][data-axis]')){
        const k = inp.dataset.modeKey;
        const axis = inp.dataset.axis;
        const eff = getEffectiveCellSizeForMode(k, s);
        inp.value = String(axis === 'width' ? eff.width : eff.height);
      }
      {
        const basePx = sanitizeBaseFontPx(s?.ui?.baseFontPx, getDefaultBaseFontPxForDevice());
        for(const inp of dlg.querySelectorAll('input[type="radio"][data-base-font-px="1"]')){
          inp.checked = Number.parseInt(inp.value, 10) === basePx;
        }
      }
      const lre = dlg.querySelector('input[type="checkbox"][data-light-refresh-enabled="1"]');
      if(lre){
        lre.checked = !!s?.lightRefresh?.enabled;
      }
      const lrc = dlg.querySelector('input[type="number"][data-light-refresh-battle-count="1"]');
      if(lrc){
        lrc.value = String(sanitizeLightRefreshBattleCount(s?.lightRefresh?.battleCount));
      }
      const slrb = dlg.querySelector('input[type="checkbox"][data-show-light-refresh-button="1"]');
      if(slrb){
        slrb.checked = !!s?.functionButtons?.showLightRefreshButton;
      }
      const rbBorder = dlg.querySelector('input[type="checkbox"][data-rb-show-original-border="1"]');
      if(rbBorder){
        rbBorder.checked = !!s?.rbLayer?.showOriginalBorder;
      }
      const rbBorderOpacity = dlg.querySelector('input[type="range"][data-rb-border-opacity="1"]');
      if(rbBorderOpacity){
        rbBorderOpacity.value = String(150 - sanitizeRbBorderOpacity(s?.rbLayer?.borderOpacity));
        const disp = rbBorderOpacity.parentElement && rbBorderOpacity.parentElement.children ? rbBorderOpacity.parentElement.children[1] : null;
        if(disp && disp.textContent != null) disp.textContent = `${150 - sanitizeRbBorderOpacity(rbBorderOpacity.value)}%`;
      }
      const rbStopAnim = dlg.querySelector('input[type="checkbox"][data-rb-stop-animation="1"]');
      if(rbStopAnim){
        rbStopAnim.checked = !!s?.rbLayer?.stopAnimation;
      }
      const rbCrown = dlg.querySelector('input[type="checkbox"][data-rb-show-capital-crown="1"]');
      if(rbCrown){
        rbCrown.checked = !!s?.rbLayer?.showCapitalCrown;
      }
      const rbCurrentMarker = dlg.querySelector('input[type="checkbox"][data-rb-show-current-cell-marker="1"]');
      if(rbCurrentMarker){
        rbCurrentMarker.checked = !!s?.rbLayer?.showCurrentCellMarker;
      }
      {
        const currentMarkerColor = sanitizeCurrentMarkerColorName(s?.rbLayer?.currentCellMarkerColor);
        for(const inp of dlg.querySelectorAll('input[type="radio"][data-rb-current-cell-marker-color="1"]')){
          inp.checked = (sanitizeCurrentMarkerColorName(inp.value) === currentMarkerColor);
        }
      }
      const rbCurrentMarkerDelay = dlg.querySelector('input[type="number"][data-rb-current-cell-marker-delay-sec="1"]');
      if(rbCurrentMarkerDelay){
        rbCurrentMarkerDelay.value = String(markerDelayMsToSec(s?.rbLayer?.currentCellMarkerDelayMs));
      }
      const pb = dlg.querySelector('input[type="checkbox"][data-post-battle-auto-diff="1"]');
      if(pb){
        pb.checked = !!s?.postBattle?.autoDiffSync;
      }
      const soff = dlg.querySelector('input[type="checkbox"][data-suppress-own-capital-friendly-fire="1"]');
      if(soff){
        soff.checked = !!s?.postBattle?.suppressOwnCapitalFriendlyFire;
      }
      const rbReg = dlg.querySelector('input[type="checkbox"][data-rb-show-cell-regulation="1"]');
      if(rbReg){
        rbReg.checked = !!s?.rbLayer?.showCellRegulation;
      }
      const rbNobody = dlg.querySelector('input[type="checkbox"][data-rb-show-nobody-holder="1"]');
      if(rbNobody){
        rbNobody.checked = !!s?.rbLayer?.showNobodyHolder;
      }
      const rbHideFnTooltip = dlg.querySelector('input[type="checkbox"][data-rb-hide-fn-tooltip="1"]');
      if(rbHideFnTooltip){
        rbHideFnTooltip.checked = !!s?.rbLayer?.hideFnTooltip;
      }
      const op = dlg.querySelector('input[type="range"][data-layer-opacity="1"]');
      if(op){
        op.value = String(100 - sanitizeOpacity(s.layer.textOpacity));
        // 表示側の数値も更新
        const disp = op.parentElement && op.parentElement.children ? op.parentElement.children[1] : null;
        if(disp && disp.textContent != null) disp.textContent = String(100 - sanitizeOpacity(op.value));
      }
      const hd = dlg.querySelector('input[type="checkbox"][data-show-original-header="1"]');
      if(hd){
        hd.checked = !!s?.header?.showOriginalHeader;
      }
    }

    function refreshInitial(){
      initial = JSON.stringify(readModalValues());
      dirty = false;
    }

    function isDirty(){
      return JSON.stringify(readModalValues()) !== initial;
    }

    function commitFromModal(){
      const cur = loadSettings();
      const v = readModalValues();
      cur.cellSize.rb.width  = sanitizeCellPx(v.rb.width,  DEFAULT_SETTINGS.cellSize.rb.width);
      cur.cellSize.rb.height = sanitizeCellPx(v.rb.height, DEFAULT_SETTINGS.cellSize.rb.height);
      cur.cellSize.hc.width  = sanitizeCellPx(v.hc.width,  DEFAULT_SETTINGS.cellSize.hc.width);
      cur.cellSize.hc.height = sanitizeCellPx(v.hc.height, DEFAULT_SETTINGS.cellSize.hc.height);
      cur.cellSize.l.width   = sanitizeCellPx(v.l.width,   DEFAULT_SETTINGS.cellSize.l.width);
      cur.cellSize.l.height  = sanitizeCellPx(v.l.height,  DEFAULT_SETTINGS.cellSize.l.height);
      cur.ui.baseFontPx = sanitizeBaseFontPx(v.baseFontPx, getDefaultBaseFontPxForDevice());
      cur.postBattle.autoDiffSync = !!v.postBattleAutoDiff;
      cur.postBattle.suppressOwnCapitalFriendlyFire = !!v.suppressOwnCapitalFriendlyFire;
      cur.lightRefresh.enabled = !!v.lightRefreshEnabled;
      cur.lightRefresh.battleCount = sanitizeLightRefreshBattleCount(v.lightRefreshBattleCount);
      cur.functionButtons.showLightRefreshButton = !!v.showLightRefreshButton;
      cur.rbLayer.showOriginalBorder = !!v.rbShowOriginalBorder;
      cur.rbLayer.borderOpacity = sanitizeRbBorderOpacity(v.rbBorderOpacity);
      cur.rbLayer.stopAnimation = !!v.rbStopAnimation;
      cur.rbLayer.showCapitalCrown = !!v.rbShowCapitalCrown;
      cur.rbLayer.showCurrentCellMarker = !!v.rbShowCurrentCellMarker;
      cur.rbLayer.currentCellMarkerColor = sanitizeCurrentMarkerColorName(v.rbCurrentCellMarkerColor);
      cur.rbLayer.currentCellMarkerDelayMs = sanitizeCurrentMarkerDelayMs(v.rbCurrentCellMarkerDelayMs);
      cur.rbLayer.showCellRegulation = !!v.rbShowCellRegulation;
      cur.layer.textOpacity = sanitizeOpacity(v.layerTextOpacity);
      cur.rbLayer.showNobodyHolder = !!v.rbShowNobodyHolder;
      cur.rbLayer.hideFnTooltip = !!v.rbHideFnTooltip;
      cur.header.showOriginalHeader = !!v.showOriginalHeader;

      /// 範囲外入力はここで px に補正し、UIにも反映
      saveSettings(cur);
      setInputsFromSettings(cur);
      hideFnTooltip();

      // 「設定」の反映
      applyCurrentModeScale();
      applyCurrentCellMarkerThemeFromSettings(cur);
      reapplyOriginalHeaderVisibilityFromSettings();
      applyLightRefreshButtonVisibility(cur);
      scheduleBattlemapLayerSync();
      if(mode === 'rb'){
        try{
          renderCurrentCellMarker(getCurrentBattlemapSnapshot());
        }catch(_e){}
      }

      if(mode === 'rb'){
        const rbApi = window.__DBA_RB_API;
        if(rbApi && typeof rbApi === 'object'){
          try{
            if(cur?.rbLayer?.stopAnimation){
              if(typeof rbApi.stopAnimation === 'function'){
                rbApi.stopAnimation();
              }else if(typeof rbApi.redrawOverlay === 'function'){
                rbApi.redrawOverlay();
              }
            }else{
              if(typeof rbApi.resumeAnimation === 'function'){
                rbApi.resumeAnimation();
              }else if(typeof rbApi.redrawOverlay === 'function'){
                rbApi.redrawOverlay();
              }
            }
          }catch(_e){}
        }
      }

      if(mode === 'rb'){
        const showReg = !!cur?.rbLayer?.showCellRegulation;
        for(const el of document.querySelectorAll('#dba-battlemap-layer-grid .dba-layer-cell__content')){
          const raw = String(el.textContent || '');
          if(!raw) continue;
          const row = Number(el.parentElement?.dataset?.row);
          const col = Number(el.parentElement?.dataset?.col);
          const parts = raw.split('\n');
          const regPart = (parts.length >= 2) ? parts[0] : '';
          const holderPart = (parts.length >= 2) ? parts.slice(1).join('\n') : raw;

          if(showReg){
            // ONに戻しただけでは、過去に非表示化した holder / reg をここでは復元できない。
            // 次回の「戦況情報」クリック/長押し、または攻撃後自動差分取得で再描画される。
            if(shouldHideRbNobodyHolder(row, col, holderPart)){
              el.textContent = regPart || '';
            }
            continue;
          }

          if(shouldHideRbNobodyHolder(row, col, holderPart)){
            el.textContent = '';
            continue;
          }

          if(parts.length >= 2){
            el.textContent = holderPart;
          }
        }
        renderRbCapitalCrowns(getBattlemapSnapshotFromDoc(document));
      }

      refreshInitial();
    }

    function closeDirect(){
      try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); }
    }

    function askCloseIfDirty(){
      if(!isDirty()){
        closeDirect();
        return;
      }
      try{ adlg.showModal(); }catch(_e){ adlg.setAttribute('open',''); }
    }

    // input change -> mark dirty
    dlg.addEventListener('input', () => { dirty = true; }, true);

    // Buttons
    btnApply.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      commitFromModal();
    });

    btnOK.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      commitFromModal();
      closeDirect();
    });

    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      askCloseIfDirty();
    });

    btnX.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      askCloseIfDirty();
    });

    // Alert buttons
    aYes.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 破棄して閉じる：設定値は保存しない、UIも復元
      {
        const saved = loadSettings();
        setInputsFromSettings(saved);
        applyBaseFontSize(saved?.ui?.baseFontPx);
        applyLayerTextOpacity(saved?.layer?.textOpacity);
      }
      refreshInitial();
      try{ adlg.close(); }catch(_e){ adlg.removeAttribute('open'); }
      closeDirect();
    });

    aBack.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try{ adlg.close(); }catch(_e){ adlg.removeAttribute('open'); }
      // 元の設定モーダルに戻る（既に開いている）
      try{
        // noop
      }catch(_e){}
    });

    // ESC で閉じる時も同じ挙動にする（ダイアログの cancel を抑止）
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      askCloseIfDirty();
    });

    // アラート側 ESC は戻る扱い
    adlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      try{ adlg.close(); }catch(_e){ adlg.removeAttribute('open'); }
    });
  }

  function openSettingsModal(){
    // body が無い可能性があるので待つ
    const openNow = () => {
      buildSettingsModal();
      const dlg = document.getElementById('dba-m-settings');
      if(!dlg) return;
      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
    };

    if(document.body) openNow();
    else document.addEventListener('DOMContentLoaded', openNow, { once: true });
  }

  function buildFunctionSection() {
    const bar = document.createElement('section');
    bar.id = 'dba-function-section';

    // 3段構造：上=header情報 / 中=progress / 下=ボタン群
    const headerHost = document.createElement('div');
    headerHost.id = 'dba-fn-header-host';
    const progressHost = document.createElement('div');
    progressHost.id = 'dba-fn-progress-host';
    const buttonsRow = document.createElement('div');
    buttonsRow.id = 'dba-fn-buttons-row';

    const btnSettings = document.createElement('button');
    btnSettings.type = 'button';
    btnSettings.className = 'dba-btn-fn';
    btnSettings.textContent = '設定';
    btnSettings.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSettingsModal();
    });

    const btnRapid = document.createElement('button');
    btnRapid.type = 'button';
    btnRapid.className = 'dba-btn-fn';
    btnRapid.id = 'dba-btn-rapid-attack';
    function syncRapidBtn(){
      const on = loadRapidAttackEnabled();
      btnRapid.dataset.on = on ? '1' : '0';
      btnRapid.innerHTML = on ? 'ラピッド攻撃<br>ON' : 'ラピッド攻撃<br>OFF';
    }
    syncRapidBtn();
    btnRapid.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = !loadRapidAttackEnabled();
      saveRapidAttackEnabled(next);
      syncRapidBtn();
    });
    bindFnButtonTooltip(
      btnRapid,
      '「セル詳細」を経由せず 攻撃や移動 を行います'
    );

    const btnRoster = document.createElement('button');
    btnRoster.type = 'button';
    btnRoster.className = 'dba-btn-fn';
    btnRoster.innerHTML = '装備<br>ロスター';
    btnRoster.id = 'dba-btn-roster';
    // 長押し（1.4秒）：ロスター名一覧ポップアップ（ボタン直下）
    // 短押し：従来通りロスター本体modal
    let rosterLpTimer = 0;
    let rosterLpFired = false;
    const ROSTER_LP_MS = 1400;
    function clearRosterLP(){
      if(rosterLpTimer){
        clearTimeout(rosterLpTimer);
        rosterLpTimer = 0;
      }
      // 長押しゲージを消す
      longPressGaugeCancel();
    }
    btnRoster.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      rosterLpFired = false;
      clearRosterLP();
      // 長押し分岐があるので、ゲージ開始（押下位置）
      longPressGaugeStart(e.clientX, e.clientY, ROSTER_LP_MS);
      rosterLpTimer = setTimeout(() => {
        rosterLpFired = true;
        longPressGaugeComplete();
        try{
          openRosterSwitchPopupNearButton(btnRoster);
        }catch(_e2){
          // noop
        }
      }, ROSTER_LP_MS);
    });
    btnRoster.addEventListener('pointerup', clearRosterLP);
    btnRoster.addEventListener('pointercancel', clearRosterLP);
    btnRoster.addEventListener('pointerleave', clearRosterLP);
    btnRoster.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if(rosterLpFired) return;
      openRosterModal();
    });
    bindFnButtonTooltip(
      btnRoster,
      'クリック：「装備ロスター」画面を表示\n長押し：装備ロスターの切替や新規作成'
    );

    const btnBattleInfo = document.createElement('button');
    btnBattleInfo.type = 'button';
    btnBattleInfo.className = 'dba-btn-fn';
    btnBattleInfo.innerHTML = '戦況<br>情報';
    btnBattleInfo.id = 'dba-btn-battleinfo';

    // 長押し（1.4秒）で全セル巡回してレイヤーに表示
    let lpTimer = 0;
    let lpFired = false;
    const LP_MS = 1400;

    function clearLP(){
      if(lpTimer){
        clearTimeout(lpTimer);
        lpTimer = 0;
      }
      longPressGaugeCancel();
    }

    btnBattleInfo.addEventListener('pointerdown', (e) => {
      if(btnBattleInfo.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      lpFired = false;
      clearLP();
      longPressGaugeStart(e.clientX, e.clientY, LP_MS);
      lpTimer = setTimeout(async () => {
        lpFired = true;
        longPressGaugeComplete();
        try{
          await scanAllCellsAndRender();
        }catch(_e){
          // 何かあれば控えめに
          alert('戦況情報の取得に失敗しました。');
        }
      }, LP_MS);
    });
    btnBattleInfo.addEventListener('pointerup', clearLP);
    btnBattleInfo.addEventListener('pointercancel', clearLP);
    btnBattleInfo.addEventListener('pointerleave', clearLP);

    // 通常クリック（短押し）：差分更新（必要なセルだけ詳細ページを取りに行って更新）
    btnBattleInfo.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if(lpFired) return;
      if(btnBattleInfo.disabled) return;
      await updateOnlyChangedCellsFromTopPage();
    });
    bindFnButtonTooltip(
      btnBattleInfo,
      'クリック：差分更新\n長押し：全セル更新'
    );

    const btnLightRefresh = document.createElement('button');
    btnLightRefresh.type = 'button';
    btnLightRefresh.className = 'dba-btn-fn';
    btnLightRefresh.textContent = '軽量化';
    btnLightRefresh.id = 'dba-btn-light-refresh';
    btnLightRefresh.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerLightRefreshNow();
    });
    bindFnButtonTooltip(
      btnLightRefresh,
      'ページ再読込し不要データ削除等'
    );

    const btnAutoEquip = document.createElement('button');
    btnAutoEquip.type = 'button';
    btnAutoEquip.className = 'dba-btn-fn';
    btnAutoEquip.id = 'dba-btn-auto-equip';
    function syncAutoEquipBtn(){
      const on = loadAutoEquipEnabled();
      btnAutoEquip.dataset.on = on ? '1' : '0';
      btnAutoEquip.innerHTML = on ? 'オート装備<br>ON' : 'オート装備<br>OFF';
    }
    syncAutoEquipBtn();
    btnAutoEquip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = !loadAutoEquipEnabled();
      saveAutoEquipEnabled(next);
      syncAutoEquipBtn();
    });
    bindFnButtonTooltip(
      btnAutoEquip,
      '攻撃時「装備ロスター」の「オート装備設定」に応じて装備を変えます'
    );

    buttonsRow.appendChild(btnSettings);
    buttonsRow.appendChild(btnAutoEquip);
    buttonsRow.appendChild(btnRapid);
    buttonsRow.appendChild(btnLightRefresh);
    buttonsRow.appendChild(btnRoster);
    buttonsRow.appendChild(btnBattleInfo);

    applyLightRefreshButtonVisibility(btnLightRefresh);

    bar.appendChild(headerHost);
    bar.appendChild(progressHost);
    bar.appendChild(buttonsRow);
    return bar;
  }

  function injectWhenReady() {
    // ★保存データの世代を確認し、Gen1/Gen2ならGen3へ自動移行
    //   （/teambattle?m=* を開いた時に行う要件）
    try{ migrateSaveDataToGen3IfNeeded(); }catch(_e){}

    addStyle(CSS);
    installOwnCapitalAttackGlobalGuards();
    try{
      const s = loadSettings();
      applyBaseFontSize(s?.ui?.baseFontPx);
      applyCurrentCellMarkerThemeFromSettings(s);
    }catch(_e){}

    const doInsert = async () => {
      // 二重挿入防止
      if (document.getElementById('dba-function-section')) return;

      // 保存設定に従って、元の<header>表示を反映
      reapplyOriginalHeaderVisibilityFromSettings();

      document.documentElement.classList.add('dba-has-fnbar');

      const bar = buildFunctionSection();

      const header = document.querySelector('header');
      if (header && header.parentNode) {
        header.parentNode.insertBefore(bar, header);
      } else {
        // header が見つからない場合は body 先頭に
        (document.body || document.documentElement).insertBefore(bar, (document.body || document.documentElement).firstChild);
      }

      // fnbar 最上段に、header由来の情報ブロックを設置
      const hh = bar.querySelector('#dba-fn-header-host');
      ensureFnHeaderInfoContainer(hh || null);
      renderFnHeaderInfo();
      await updateRbUnifiedRegDisplay(true);

      // 初回表示時点でも「保有地域数」をローカル算出つき表示へ置き換える
      try{
        await applyLocalOwnershipCountsToTeamTable(document, getBattlemapSnapshotFromDoc(document));
      }catch(_e){}

      // fnbar 内（上段）に、トップページ同期の「経過時間」プログレスバーを設置
      const ph = bar.querySelector('#dba-fn-progress-host');
      ensureTopProgressContainer(ph || null);
      startTopProgressTicker();
      setLightRefreshButtonBusyState(!!DBA_LIGHT_REFRESH_STATE.running);

      // fnbar高さを実測して反映（初回 + 画面変化に追従）
      scheduleFnbarHeightSync();
      window.addEventListener('resize', scheduleFnbarHeightSync, { passive: true });
      window.addEventListener('orientationchange', scheduleFnbarHeightSync, { passive: true });

      // バトルマップのセルスケール（保存値）を適用
      waitAndApplyScale();
      // 透明レイヤーを初期化（バトルマップ追従）
      initBattlemapLayer();
      // セルクリックで詳細モーダル（遷移抑止）
      initBattlemapCellClickIntercept();
      // 後から<header>が差し替わっても表示設定を再適用
      startOriginalHeaderVisibilityObserver();
    };

    // document-start なので body がまだ無いことがある：DOM 構築を待つ
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doInsert, { once: true });
    } else {
      doInsert();
    }
  }

  injectWhenReady();
})();
