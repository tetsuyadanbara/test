// ==UserScript==
// @name         Donguri Arena Rotator FF Containers Rewrite
// @namespace    https://donguri.5ch.net/
// @version      3.0.0
// @description  どんぐりアリーナ: 指定ランクの指定地域を勝つまで連続挑戦し、リーダー陥落で次アカへ回す
// @match        https://donguri.5ch.net/arena*
// @match        https://donguri.5ch.io/arena*
// @match        https://donguri.5ch.net/challenge*
// @match        https://donguri.5ch.io/challenge*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    pollMs: 2000,
    minChallengeGapMs: 900,
    pendingTimeoutMs: 25000,
    resultStayMs: 350,
    winKeywords: ['勝利', '勝った', 'チャンピオン', 'リーダーになった', '王者'],
    lossKeywords: ['敗北', '負け', '敗れ', 'やられた', '勝てなかった'],
    drawKeywords: ['引き分け', 'ドロー'],
    cooldownKeywords: ['待機', '時間をおいて', 'しばらく待', '連続挑戦'],
    defaultAccounts: ['アカウント1', 'アカウント2', 'アカウント3'],
    defaultRank: 'UR'
  };

  const SHARED_KEY = 'dar_rotator_rewrite_shared_v1';
  const LOCAL_KEY = 'dar_rotator_rewrite_local_v1';
  const PINNED_MYNAME_KEY = 'dar_rotator_rewrite_pinned_myname_v1';

  let lastArenaRows = [];
  let reloadTimer = null;

  function now() {
    return Date.now();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function norm(v) {
    return String(v || '').replace(/\s+/g, ' ').trim();
  }

  function escHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hasAny(text, keywords) {
    return keywords.some(k => text.includes(k));
  }

  function uniq(values) {
    const out = [];
    const seen = new Set();
    values.forEach(v => {
      const n = norm(v);
      if (!n || seen.has(n)) return;
      seen.add(n);
      out.push(n);
    });
    return out;
  }

  function defaultState() {
    return {
      running: false,
      manuallyStopped: false,
      currentTurnIndex: 0,
      monitoringRegions: [],
      heldRegions: {},
      pending: null,
      runConfig: null,
      lastSubmitAt: 0,
      lastResult: '待機中',
      updatedAt: 0
    };
  }

  function defaultLocalSettings() {
    return {
      myName: '',
      teamOrderText: CONFIG.defaultAccounts.join('\n'),
      targetRank: CONFIG.defaultRank,
      targetRegionPrimary: '',
      targetRegionSecondary: '',
      requireEquipRegistration: false,
      regionEquipAssignments: {}
    };
  }

  async function loadState() {
    const state = await GM_getValue(SHARED_KEY, defaultState());
    return { ...defaultState(), ...state };
  }

  async function saveState(patch) {
    const prev = await loadState();
    const next = { ...prev, ...patch, updatedAt: now() };
    await GM_setValue(SHARED_KEY, next);
    return next;
  }

  function loadLocalSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
      const defaults = defaultLocalSettings();
      return {
        ...defaults,
        ...raw,
        regionEquipAssignments: {
          ...defaults.regionEquipAssignments,
          ...(raw.regionEquipAssignments || {})
        }
      };
    } catch (error) {
      console.warn('[DAR-REWRITE] local settings parse error', error);
      return defaultLocalSettings();
    }
  }

  function saveLocalSettings(patch) {
    const prev = loadLocalSettings();
    const next = {
      ...prev,
      ...patch,
      regionEquipAssignments: {
        ...prev.regionEquipAssignments,
        ...((patch && patch.regionEquipAssignments) || {})
      }
    };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    return next;
  }

  function getPinnedMyName() {
    try {
      return norm(localStorage.getItem(PINNED_MYNAME_KEY) || '');
    } catch (error) {
      return '';
    }
  }

  function setPinnedMyName(name) {
    const value = norm(name);
    try {
      if (value) {
        localStorage.setItem(PINNED_MYNAME_KEY, value);
      } else {
        localStorage.removeItem(PINNED_MYNAME_KEY);
      }
    } catch (error) {}
    return value;
  }

  function parseTeamOrderText(text) {
    const list = uniq(String(text || '').split(/\r?\n/));
    return list.length > 0 ? list : [...CONFIG.defaultAccounts];
  }

  function collectJsonStringValues(source, out, depth = 0) {
    if (depth > 4 || source == null) return;
    if (typeof source === 'string') {
      out.push(source);
      return;
    }
    if (Array.isArray(source)) {
      source.forEach(item => collectJsonStringValues(item, out, depth + 1));
      return;
    }
    if (typeof source === 'object') {
      Object.values(source).forEach(value => collectJsonStringValues(value, out, depth + 1));
    }
  }

  function pickUniqueTeamName(candidates, teamOrder) {
    const teamNames = (teamOrder || []).map(norm).filter(Boolean);
    const hits = [...new Set((candidates || []).map(norm).filter(Boolean))]
      .filter(value => teamNames.includes(value));
    return hits.length === 1 ? hits[0] : '';
  }

  function pickTrustedCandidateName(candidates, teamOrder) {
    const normalized = (candidates || []).map(norm).filter(Boolean);
    if (normalized.length === 0) return '';

    const strict = pickUniqueTeamName(normalized, teamOrder);
    if (strict) return strict;

    const counts = new Map();
    normalized.forEach(value => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });

    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

    if (ranked.length === 1) {
      return ranked[0][0];
    }

    if (ranked[0][1] >= 2 && ranked[0][1] > ranked[1][1]) {
      return ranked[0][0];
    }

    return '';
  }

  function extractNameFromUrlLike(value) {
    try {
      const url = new URL(value, location.origin);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length === 0) return '';

      const tail = decodeURIComponent(parts[parts.length - 1]);
      if (!tail) return '';
      if (/^\d+$/.test(tail)) return '';
      if (tail.length > 40) return '';
      if (/^(user|users|u|profile|profiles|mypage|account|accounts|member|members|id)$/i.test(tail)) return '';

      return norm(tail);
    } catch (error) {
      return '';
    }
  }

  function extractLabelledNamesFromText() {
    const out = [];
    const patterns = [
      /(?:ユーザー名|アカウント名|ニックネーム|名前)\s*[:：]\s*([^\s　,，/()<>[\]{}]+)/g,
      /([^\s　,，/()<>[\]{}]{1,24})\s*(?:さん|様)\b/g
    ];

    Array.from(document.querySelectorAll('body, header, nav, form, div, span, p, li, a'))
      .slice(0, 400)
      .forEach(el => {
        const text = norm(el.textContent);
        if (!text) return;
        patterns.forEach(re => {
          for (const match of text.matchAll(re)) {
            if (match[1]) out.push(norm(match[1]));
          }
        });
      });

    return out;
  }

  function readCandidateNamesFromStorage(storage) {
    const result = [];
    const directKeys = [
      'dar_auto_my_name',
      'donguri_name',
      'donguriName',
      'myName',
      'username',
      'nickname',
      'accountName',
      'account_name',
      'userName',
      'displayName',
      'display_name'
    ];

    directKeys.forEach(key => {
      try {
        result.push(storage.getItem(key));
      } catch (e) {}
    });

    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;
        const value = storage.getItem(key);
        if (!value) continue;

        if (/(name|user|nick|account|profile)/i.test(key)) {
          result.push(value);
        }

        if (value.startsWith('{') || value.startsWith('[')) {
          try {
            collectJsonStringValues(JSON.parse(value), result);
          } catch (e) {}
        }
      }
    } catch (e) {}

    return result;
  }

  function detectMyNameFromPage(teamOrder) {
    const cached = pickTrustedCandidateName([
      (() => { try { return localStorage.getItem('dar_auto_my_name'); } catch (e) { return ''; } })(),
      (() => { try { return sessionStorage.getItem('dar_auto_my_name'); } catch (e) { return ''; } })()
    ], teamOrder);
    if (cached) return cached;

    const storageMatch = pickTrustedCandidateName([
      ...readCandidateNamesFromStorage(localStorage),
      ...readCandidateNamesFromStorage(sessionStorage)
    ], teamOrder);
    if (storageMatch) return storageMatch;

    const attrMatch = pickTrustedCandidateName([
      document.querySelector('[data-user-name]')?.getAttribute('data-user-name'),
      document.querySelector('[data-username]')?.getAttribute('data-username'),
      document.querySelector('[data-name]')?.getAttribute('data-name'),
      document.querySelector('[data-nickname]')?.getAttribute('data-nickname'),
      document.querySelector('[data-account-name]')?.getAttribute('data-account-name'),
      document.querySelector('meta[name="user-name"]')?.getAttribute('content'),
      document.querySelector('meta[name="username"]')?.getAttribute('content'),
      document.querySelector('meta[name="nickname"]')?.getAttribute('content'),
      document.querySelector('input[name="username"]')?.value,
      document.querySelector('input[name="nickname"]')?.value,
      document.querySelector('input[name="name"]')?.value,
      document.querySelector('input[name="account"]')?.value
    ], teamOrder);
    if (attrMatch) return attrMatch;

    const hrefMatch = pickTrustedCandidateName(
      Array.from(document.querySelectorAll(
        'a[href*="user"],a[href*="profile"],a[href*="mypage"],a[href*="account"],a[href*="/u/"],form[action*="user"],form[action*="profile"]'
      ))
      .slice(0, 200)
      .flatMap(el => [
        extractNameFromUrlLike(el.getAttribute?.('href') || ''),
        extractNameFromUrlLike(el.getAttribute?.('action') || ''),
        el.textContent
      ]),
      teamOrder
    );
    if (hrefMatch) return hrefMatch;

    const labelledMatch = pickTrustedCandidateName(extractLabelledNamesFromText(), teamOrder);
    if (labelledMatch) return labelledMatch;

    const textMatch = pickUniqueTeamName(
      Array.from(document.querySelectorAll('a, strong, b, span, div, input')).slice(0, 400).flatMap(el => [
        el.textContent,
        el.getAttribute?.('title'),
        el.getAttribute?.('aria-label'),
        el.value
      ]),
      teamOrder
    );
    if (textMatch) return textMatch;

    return '';
  }

  function syncAutoMyName(settings = loadLocalSettings()) {
    const pinned = getPinnedMyName();
    if (pinned) {
      if (settings.myName !== pinned) {
        const next = saveLocalSettings({ myName: pinned });
        return { ...settings, ...next, myName: pinned };
      }
      return { ...settings, myName: pinned };
    }

    const teamOrder = parseTeamOrderText(settings.teamOrderText);
    const detected = detectMyNameFromPage(teamOrder);
    if (detected) {
      try { localStorage.setItem('dar_auto_my_name', detected); } catch (e) {}
      try { sessionStorage.setItem('dar_auto_my_name', detected); } catch (e) {}
      setPinnedMyName(detected);
    }
    if (detected && settings.myName !== detected) {
      const next = saveLocalSettings({ myName: detected });
      return { ...settings, ...next, myName: detected };
    }
    return settings;
  }

  function getMyName(settings = loadLocalSettings()) {
    const pinned = getPinnedMyName();
    if (pinned) return pinned;

    const teamOrder = parseTeamOrderText(settings.teamOrderText);
    const detected = norm(detectMyNameFromPage(teamOrder) || '');
    if (detected) {
      setPinnedMyName(detected);
      return detected;
    }

    return norm(settings.myName || '');
  }

  function buildDonguriUrl(path) {
    return `${location.origin}${path.startsWith('/') ? path : `/${path}`}`;
  }

  function clearArenaReload() {
    if (reloadTimer) {
      clearTimeout(reloadTimer);
      reloadTimer = null;
    }
  }

  function shouldPauseArenaReload() {
    const panel = document.getElementById('dar-rr-panel');
    const active = document.activeElement;
    if (!panel || !active) return false;
    return panel.contains(active) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(active.tagName);
  }

  function scheduleArenaReload(delay = CONFIG.pollMs) {
    clearArenaReload();
    reloadTimer = window.setTimeout(async () => {
      try {
        const state = await loadState();
        if (!state.running || state.manuallyStopped) return;
        if (shouldPauseArenaReload()) {
          scheduleArenaReload(1200);
          return;
        }
        location.reload();
      } catch (error) {
        console.error('[DAR-REWRITE] reload error', error);
      }
    }, delay);
  }

  function parseArenaRows() {
    return [...document.querySelectorAll('tbody tr')]
      .map(tr => {
        const form = tr.querySelector('form[action="/challenge"]');
        if (!form) return null;
        return {
          tr,
          form,
          region: norm(form.querySelector('input[name="region"]')?.value),
          arenaName: norm(tr.querySelector('td:nth-child(1)')?.textContent),
          leader: norm(tr.querySelector('td:nth-child(2) strong')?.textContent),
          rule: norm(tr.querySelector('td:nth-child(2) small')?.textContent)
        };
      })
      .filter(Boolean);
  }

  function normalizeArenaRankFromRule(ruleText = '') {
    const text = norm(ruleText);
    if (text.includes('[警備員]')) return 'GUARD_N';
    if (text.includes('[エリート]')) return 'ELITE';
    if (/\[UR\]/.test(text)) return 'UR';
    if (/\[SSR\]/.test(text)) return 'SSR';
    if (/\[SR\]/.test(text)) return 'SR';
    if (/\[R\]/.test(text)) return 'R';
    if (/\[N\]/.test(text)) return 'N';
    return '';
  }

  function normalizeSelectedRank(value = '') {
    const text = norm(value);
    if (['N', 'GUARD_N', 'R', 'SR', 'SSR', 'UR', 'ELITE'].includes(text)) return text;
    return normalizeArenaRankFromRule(text);
  }

  function getRankLabel(rank = '') {
    switch (normalizeSelectedRank(rank)) {
      case 'GUARD_N': return '警備員N';
      case 'ELITE': return 'エリート';
      case 'N': return 'N';
      case 'R': return 'R';
      case 'SR': return 'SR';
      case 'SSR': return 'SSR';
      case 'UR': return 'UR';
      default: return norm(rank);
    }
  }

  function getEffectiveArenaRanks(selectedRank = '') {
    const rank = normalizeSelectedRank(selectedRank);
    if (rank === 'GUARD_N') return ['GUARD_N', 'N'];
    return rank ? [rank] : [];
  }

  function getAvailableRules(rows = lastArenaRows) {
    const order = ['N', 'GUARD_N', 'R', 'SR', 'SSR', 'UR', 'ELITE'];
    const present = new Set(rows.map(row => normalizeArenaRankFromRule(row.rule)).filter(Boolean));
    const list = order.filter(rank => present.has(rank));
    return list.length > 0 ? list : order;
  }

  function getAvailableRegions(rows = lastArenaRows) {
    const list = [];
    const seen = new Set();
    rows.forEach(row => {
      const region = norm(row.region);
      if (!region || seen.has(region)) return;
      seen.add(region);
      list.push({ value: region, label: `${row.arenaName} (${region})` });
    });
    return list;
  }

  function getAvailableRuleRegions(rows = lastArenaRows, ruleText = '') {
    const ranks = getEffectiveArenaRanks(ruleText);
    if (ranks.length === 0) return [];
    return getAvailableRegions(rows.filter(row => ranks.includes(normalizeArenaRankFromRule(row.rule))));
  }

  function snapshotRunConfig(settings = loadLocalSettings()) {
    const teamOrder = parseTeamOrderText(settings.teamOrderText);
    return {
      myName: settings.myName,
      teamOrder,
      targetRank: normalizeSelectedRank(settings.targetRank) || CONFIG.defaultRank,
      targetRegionPrimary: norm(settings.targetRegionPrimary),
      targetRegionSecondary: norm(settings.targetRegionSecondary),
      requireEquipRegistration: !!settings.requireEquipRegistration,
      regionEquipAssignments: { ...(settings.regionEquipAssignments || {}) }
    };
  }

  function getRunConfig(state, settings = loadLocalSettings()) {
    if (state?.runConfig) {
      return {
        ...settings,
        ...state.runConfig,
        teamOrder: [...(state.runConfig.teamOrder || parseTeamOrderText(settings.teamOrderText))],
        regionEquipAssignments: {
          ...(settings.regionEquipAssignments || {}),
          ...(state.runConfig.regionEquipAssignments || {})
        }
      };
    }
    return {
      ...settings,
      teamOrder: parseTeamOrderText(settings.teamOrderText)
    };
  }

  function currentTurnName(state, settings = loadLocalSettings()) {
    const config = getRunConfig(state, settings);
    const teamOrder = config.teamOrder || [];
    if (!teamOrder.length) return '';
    return norm(teamOrder[state.currentTurnIndex % teamOrder.length]);
  }

  function nextTurnIndex(state, settings = loadLocalSettings()) {
    const config = getRunConfig(state, settings);
    const teamOrder = config.teamOrder || [];
    if (!teamOrder.length) return 0;
    return (state.currentTurnIndex + 1) % teamOrder.length;
  }

  function teamIndexOf(name, settings = loadLocalSettings()) {
    const teamOrder = parseTeamOrderText(settings.teamOrderText);
    return teamOrder.map(norm).indexOf(norm(name));
  }

  function isMyTurn(state, settings = loadLocalSettings()) {
    return norm(currentTurnName(state, settings)) === getMyName(settings);
  }

  function isOurMember(name, settings = loadLocalSettings(), state = null) {
    const config = state ? getRunConfig(state, settings) : { teamOrder: parseTeamOrderText(settings.teamOrderText) };
    return (config.teamOrder || []).map(norm).includes(norm(name));
  }

  function isHeldRegion(row, state, settings = loadLocalSettings()) {
    if (!row) return false;
    const region = norm(row.region);
    const leader = norm(row.leader);
    const heldBy = norm(state?.heldRegions?.[region] || '');

    // まず「この地域は誰が保持したか」の記録を優先
    if (heldBy && leader && heldBy === leader) {
      return true;
    }

    // 旧判定も保険で残す
    return isOurMember(leader, settings, state);
  }

  function getConfiguredChallengeRegions(settings = loadLocalSettings()) {
    return uniq([settings.targetRegionPrimary, settings.targetRegionSecondary]);
  }

  function getTargetRowsInPriority(rows, settings = loadLocalSettings()) {
    const selectedRanks = getEffectiveArenaRanks(settings.targetRank);
    const candidates = rows.filter(r => selectedRanks.includes(normalizeArenaRankFromRule(r.rule)));
    if (candidates.length === 0) return [];

    const preferredRegions = getConfiguredChallengeRegions(settings);
    if (preferredRegions.length === 0) {
      return candidates;
    }

    const ordered = [];
    for (const region of preferredRegions) {
      const row = candidates.find(candidate => norm(candidate.region) === region);
      if (row) ordered.push(row);
    }
    return ordered;
  }

  function getEquipPresetsStore() {
    return JSON.parse(localStorage.getItem('equipPresets') || '{}');
  }

  function getEquipPresetEntries() {
    return Object.entries(getEquipPresetsStore());
  }

  function getEquipPresetForRegion(region, settings = loadLocalSettings()) {
    return norm(settings.regionEquipAssignments?.[norm(region)] || '');
  }

  let darWeaponTable = null;
  let darArmorTable = null;
  let darNecklaceTable = null;
  let darSelectedEquips = { id: [], rank: [] };
  let darWeaponSortMode = 'modDesc';
  let darArmorSortMode = 'modDesc';
  let darNecklaceSortMode = 'nameAsc';

  function saveEquipPreset(name, obj) {
    const presetName = norm(name);
    if (!presetName) return false;

    const equipPresets = getEquipPresetsStore();
    equipPresets[presetName] = {
      id: Array.isArray(obj.id) ? [...obj.id] : [],
      rank: Array.isArray(obj.rank) ? [...obj.rank] : []
    };
    localStorage.setItem('equipPresets', JSON.stringify(equipPresets));
    return true;
  }

  function normalizeEquipPresetsForBackup(source) {
    const src = (source && typeof source === 'object') ? source : {};
    const ordered = {};
    const preferredOrder = ['N', 'R', 'SR', 'SSR', 'UR'];

    preferredOrder.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(src, key)) {
        ordered[key] = src[key];
      }
    });

    Object.keys(src).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(ordered, key)) {
        ordered[key] = src[key];
      }
    });

    return ordered;
  }

  function exportEquipPresetsText() {
    const presets = normalizeEquipPresetsForBackup(getEquipPresetsStore());
    const keys = Object.keys(presets);

    if (keys.length === 0) {
      return '{}';
    }

    const lines = keys.map((key, index) => {
      const value = presets[key] || {};
      const ids = Array.isArray(value.id) ? value.id : [];
      const ranks = Array.isArray(value.rank) ? value.rank : [];
      const comma = (index < keys.length - 1) ? ',' : '';

      return `  ${JSON.stringify(key)}: {"id":${JSON.stringify(ids)},"rank":${JSON.stringify(ranks)}}${comma}`;
    });

    return `{\n${lines.join('\n')}\n}`;
  }

  function importEquipPresets(text) {
    try {
      const raw = String(text || '').trim();

      if (!raw) {
        localStorage.removeItem('equipPresets');
        return { ok: true, reason: '空入力のため装備プリセットを全削除しました' };
      }

      const parsed = JSON.parse(raw);
      const normalized = normalizeEquipPresetsForBackup(parsed);
      localStorage.setItem('equipPresets', JSON.stringify(normalized));
      return { ok: true, reason: '装備プリセットを復元しました' };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  }

  function getEquipModValue(row) {
    const candidates = [
      row?.cells?.[8]?.textContent || '',
      row?.cells?.[7]?.textContent || '',
      row?.textContent || ''
    ];

    for (const text of candidates) {
      const match = String(text).match(/mod\s*([+-]?\d+)/i);
      if (match) {
        return parseInt(match[1], 10) || 0;
      }
    }

    for (const text of candidates) {
      const match = String(text).match(/^\s*([+-]?\d+)\s*$/);
      if (match) {
        return parseInt(match[1], 10) || 0;
      }
    }

    return -1;
  }

  function getEquipSortMode(tabName = 'weapon') {
    if (tabName === 'armor') return darArmorSortMode;
    if (tabName === 'necklace') return darNecklaceSortMode;
    return darWeaponSortMode;
  }

  function setEquipSortMode(tabName = 'weapon', mode = 'nameAsc') {
    const normalizedMode = (tabName === 'necklace')
      ? 'nameAsc'
      : (mode === 'modDesc' ? 'modDesc' : 'nameAsc');

    if (tabName === 'armor') {
      darArmorSortMode = normalizedMode;
    } else if (tabName === 'necklace') {
      darNecklaceSortMode = normalizedMode;
    } else {
      darWeaponSortMode = normalizedMode;
    }

    return normalizedMode;
  }

  function sortEquipTable(table, mode = 'nameAsc') {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.rows);

    rows.sort((a, b) => {
      if (mode === 'modDesc') {
        const modDiff = getEquipModValue(b) - getEquipModValue(a);
        if (modDiff !== 0) return modDiff;
      }

      const nameA = a.cells?.[0]?.textContent || '';
      const nameB = b.cells?.[0]?.textContent || '';
      return nameA.localeCompare(nameB);
    });

    rows.forEach(row => tbody.appendChild(row));
  }

  function getEquipIdFromLinkHref(href) {
    try {
      return new URL(href, location.origin).pathname.replace(/^\/equip\//, '');
    } catch (error) {
      return '';
    }
  }

  function applyEquipDialogTab(panel, tabName = 'weapon') {
    const tableContainer = panel.querySelector('.dar-equip-table-container');
    const equipField = panel.querySelector('.dar-equip-field');
    const rankSelect = panel.querySelector('.dar-equip-rank');
    const sortNameButton = panel.querySelector('.dar-equip-sort-name');
    const sortModButton = panel.querySelector('.dar-equip-sort-mod');

    const tableMap = {
      weapon: darWeaponTable,
      armor: darArmorTable,
      necklace: darNecklaceTable
    };

    const buttonMap = {
      weapon: panel.querySelector('.dar-equip-tab-weapon'),
      armor: panel.querySelector('.dar-equip-tab-armor'),
      necklace: panel.querySelector('.dar-equip-tab-necklace')
    };

    const table = tableMap[tabName] || darWeaponTable;
    if (!table) return;

    const sortMode = getEquipSortMode(tabName);
    const modAvailable = (tabName !== 'necklace');

    if (equipField) {
      equipField.dataset.currentTab = tabName;
      equipField.dataset.currentSortMode = sortMode;
    }

    Object.entries(buttonMap).forEach(([key, button]) => {
      if (!button) return;
      const active = (key === tabName);
      button.disabled = active;
      button.style.fontWeight = active ? '700' : '400';
      button.style.opacity = active ? '1' : '0.85';
    });

    if (sortNameButton) {
      const active = (sortMode === 'nameAsc');
      sortNameButton.disabled = active;
      sortNameButton.style.fontWeight = active ? '700' : '400';
      sortNameButton.style.opacity = active ? '1' : '0.85';
    }

    if (sortModButton) {
      const active = (sortMode === 'modDesc');
      sortModButton.disabled = !modAvailable || active;
      sortModButton.style.fontWeight = active ? '700' : '400';
      sortModButton.style.opacity = (!modAvailable) ? '0.45' : (active ? '1' : '0.85');
    }

    sortEquipTable(table, sortMode);
    tableContainer.replaceChildren(table);

    table.querySelectorAll('tbody > tr').forEach(row => {
      if (tabName === 'necklace') {
        row.style.display = '';
        return;
      }
      const itemName = row.cells?.[0]?.textContent || '';
      row.style.display = itemName.includes(`[${rankSelect.value}]`) ? '' : 'none';
    });
  }

  async function showDarEquipList(panel) {
    const equipField = panel.querySelector('.dar-equip-field');
    const selectedLabel = panel.querySelector('.dar-equip-selected');
    const presetNameInput = panel.querySelector('.dar-equip-preset-name');
    const saveStatus = panel.querySelector('.dar-equip-save-status');

    if (!darWeaponTable || !darArmorTable || !darNecklaceTable) {
      try {
        const res = await fetch(buildDonguriUrl('/bag'), { credentials: 'include' });
        if (!res.ok) throw new Error('bag response error');

        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const h1 = doc.querySelector('h1');
        if (h1?.textContent !== 'アイテムバッグ') {
          throw new Error('bag parse error');
        }

        darWeaponTable = doc.querySelector('#weaponTable');
        darArmorTable = doc.querySelector('#armorTable');
        darNecklaceTable = doc.querySelector('#necklaceTable');

        if (!darWeaponTable || !darArmorTable || !darNecklaceTable) {
          throw new Error('failed to find weapon/armor/necklace tables');
        }

        [darWeaponTable, darArmorTable, darNecklaceTable].forEach((table, index) => {
          sortEquipTable(table, index === 2 ? 'nameAsc' : 'modDesc');
          table.style.color = '#000';
          table.style.margin = '0';
          table.style.width = '100%';
          table.style.fontSize = '24px';

          table.querySelectorAll('tr').forEach(row => {
            if (!row.cells || !row.cells[0]) return;

            Array.from(row.cells).forEach(cell => {
              cell.style.fontSize = '24px';
              cell.style.padding = '6px 8px';
            });

            const link = row.cells[1]?.querySelector('a[href*="/equip/"]');
            const itemId = link ? getEquipIdFromLinkHref(link.href) : '';

            row.cells[0].style.textDecorationLine = 'underline';
            row.cells[0].style.cursor = 'pointer';
            row.cells[0].dataset.id = itemId;

            if (row.cells[1]) row.cells[1].style.display = 'none';
            if (row.cells[2]) row.cells[2].style.display = 'none';

            if (index !== 2) {
              if (row.cells[9]) row.cells[9].style.display = 'none';
            } else {
              if (row.cells[5]) row.cells[5].style.display = 'none';
            }

            row.cells[0].addEventListener('click', () => {
              const itemName = row.cells[0].textContent || '';
              const rankMatch = itemName.match(/\[(.+?)\]/);
              const rank = rankMatch ? rankMatch[1] : '';
              const itemId = row.cells[0].dataset.id || '';

              darSelectedEquips.id[index] = itemId;
              darSelectedEquips.rank[index] = rank;
              selectedLabel.textContent = darSelectedEquips.id.filter(Boolean).join(', ');
            });
          });
        });
      } catch (error) {
        console.error(error);
        alert(`装備一覧取得失敗: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
    }

    darSelectedEquips = { id: [], rank: [] };
    selectedLabel.textContent = '';
    presetNameInput.value = '';
    if (saveStatus) saveStatus.textContent = '';
    applyEquipDialogTab(panel, 'weapon');

    if (!equipField.open) {
      equipField.showModal();
    }
  }

  function fillPresetSelect(select, selectedValue = '') {
    const current = norm(selectedValue);
    const options = [{ value: '', label: '(未設定)' }].concat(
      getEquipPresetEntries().map(([name, value]) => ({
        value: name,
        label: `${name} [${(value.rank || []).join(',')}]`
      }))
    );

    const safeOptions = [...options];
    if (current && !safeOptions.some(opt => opt.value === current)) {
      safeOptions.push({ value: current, label: current });
    }

    select.innerHTML = safeOptions.map(opt => {
      const selected = opt.value === current ? ' selected' : '';
      return `<option value="${escHtml(opt.value)}"${selected}>${escHtml(opt.label)}</option>`;
    }).join('');
  }

  async function setPresetItems(presetName, force = false) {
    const preset = getEquipPresetsStore()[presetName];
    if (!preset || !Array.isArray(preset.id) || preset.id.length === 0) {
      return { ok: false, reason: `プリセット未登録: ${presetName}` };
    }

    const currentEquip = (JSON.parse(localStorage.getItem('current_equip') || '[]') || [])
      .map(v => v == null ? null : String(v));

    const presetIds = preset.id.filter(id => id !== undefined && id !== null).map(String);
    const targetIds = force ? presetIds : presetIds.filter(id => !currentEquip.includes(id));

    if (targetIds.length === 0) {
      localStorage.setItem('current_equip', JSON.stringify(presetIds));
      return { ok: true, reason: '装備済み', equipPreset: presetName };
    }

    try {
      const responses = await Promise.all(targetIds.map(id => fetch(buildDonguriUrl(`/equip/${id}`), { credentials: 'include' })));
      const texts = await Promise.all(responses.map(async response => {
        if (!response.ok) throw new Error(`[${response.status}] /equip/`);
        return response.text();
      }));

      if (texts.some(text => text.includes('どんぐりが見つかりませんでした。'))) {
        throw new Error('再ログインしてください');
      }
      if (texts.some(text => text.includes('アイテムが見つかりませんでした。'))) {
        throw new Error('アイテムが見つかりませんでした');
      }

      localStorage.setItem('current_equip', JSON.stringify(presetIds));
      return { ok: true, reason: force ? '再換装完了' : '換装完了', equipPreset: presetName };
    } catch (error) {
      localStorage.removeItem('current_equip');
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  async function applyRegisteredEquip(target, settings = loadLocalSettings()) {
    const equipPreset = getEquipPresetForRegion(target.region, settings);
    if (settings.requireEquipRegistration && !equipPreset) {
      return { ok: false, equipPreset: '', reason: `装備未登録: ${target.arenaName}` };
    }
    if (!equipPreset) {
      return { ok: true, equipPreset: '', reason: '装備登録なしで続行' };
    }
    if (!getEquipPresetsStore()[equipPreset]) {
      return { ok: false, equipPreset, reason: `プリセットが存在しません: ${equipPreset}` };
    }
    const result = await setPresetItems(equipPreset, true);
    if (!result.ok) {
      return { ok: false, equipPreset, reason: result.reason || '再換装失敗' };
    }
    return { ok: true, equipPreset, reason: result.reason || '再換装完了' };
  }

  function detectResult() {
    const text = norm(document.body?.innerText || '');
    if (hasAny(text, CONFIG.winKeywords)) return 'win';
    if (hasAny(text, CONFIG.lossKeywords)) return 'loss';
    if (hasAny(text, CONFIG.drawKeywords)) return 'draw';
    if (hasAny(text, CONFIG.cooldownKeywords)) return 'cooldown';
    return 'unknown';
  }

  async function submitChallenge(target, settings = loadLocalSettings()) {
    const state = await loadState();
    const myName = getMyName(settings);

    if (!state.running || state.manuallyStopped) return false;
    if (!isMyTurn(state, settings)) return false;
    if (!target) return false;
    if (now() - state.lastSubmitAt < CONFIG.minChallengeGapMs) return false;

    const equipResult = await applyRegisteredEquip(target, settings);
    if (!equipResult.ok) {
      await saveState({
        lastResult: `[装備エラー] ${myName} -> ${target.arenaName} / ${equipResult.reason}`,
        lastSubmitAt: now()
      });
      return false;
    }

    await saveState({
      lastSubmitAt: now(),
      pending: {
        by: myName,
        region: target.region,
        arenaName: target.arenaName,
        targetRule: target.rule,
        equipPreset: equipResult.equipPreset,
        leaderBefore: target.leader,
        createdAt: now(),
        manual: false
      },
      lastResult: `[挑戦] ${myName} -> ${target.arenaName} / ${target.rule} / 装備:${equipResult.equipPreset || '未指定'} / ${equipResult.reason}`
    });

    target.form.submit();
    return true;
  }

  async function submitManualChallenge(target, settings = loadLocalSettings()) {
    const myName = getMyName(settings);

    if (!target || !target.form) return false;

    const equipResult = await applyRegisteredEquip(target, settings);
    if (!equipResult.ok) {
      await saveState({
        lastResult: `[手動装備エラー] ${myName} -> ${target.arenaName} / ${equipResult.reason}`,
        lastSubmitAt: now()
      });
      alert(`[手動装備エラー]\n${target.arenaName}\n${equipResult.reason}`);
      return false;
    }

    await saveState({
      lastSubmitAt: now(),
      pending: {
        by: myName,
        region: target.region,
        arenaName: target.arenaName,
        targetRule: target.rule,
        equipPreset: equipResult.equipPreset,
        leaderBefore: target.leader,
        createdAt: now(),
        manual: true
      },
      lastResult: `[手動挑戦] ${myName} -> ${target.arenaName} / ${target.rule} / 装備:${equipResult.equipPreset || '未指定'} / ${equipResult.reason}`
    });

    target.form.submit();
    return true;
  }

  function bindManualChallengeForms(rows, settings = loadLocalSettings()) {
    rows.forEach(row => {
      const form = row?.form;
      if (!form) return;
      if (form.dataset.darManualEquipBound === '1') return;

      form.dataset.darManualEquipBound = '1';

      form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const currentSettings = loadLocalSettings();
        const currentRows = parseArenaRows();
        const latestTarget =
          currentRows.find(r =>
            norm(r.region) === norm(row.region) &&
            norm(r.rule) === norm(row.rule)
          ) || row;

        const submitButton =
          form.querySelector('button[type="submit"]') ||
          form.querySelector('input[type="submit"]');

        const prevDisabled = !!submitButton?.disabled;
        if (submitButton) submitButton.disabled = true;

        try {
          await submitManualChallenge(latestTarget, currentSettings);
        } finally {
          if (submitButton) submitButton.disabled = prevDisabled;
        }
      });
    });
  }

  async function markWin(reason, state, settings) {
    const myName = getMyName(settings);
    const region = norm(state?.pending?.region || '');
    const nextHeldRegions = {
      ...(state?.heldRegions || {})
    };

    if (region) {
      nextHeldRegions[region] = myName;
    }

    await saveState({
      heldRegions: nextHeldRegions,
      pending: null,
      lastSubmitAt: 0,
      lastResult: `[勝利] ${myName} ${reason}`
    });
  }

  async function markRetryableLoss(reason, state, settings) {
    const myName = getMyName(settings);
    await saveState({
      pending: null,
      lastSubmitAt: 0,
      lastResult: `[再挑戦] ${myName} ${reason}`
    });
  }

  function ensureManualChallengeLogControls() {
    let box = document.getElementById('dar-manual-challenge-controls');
    if (box) return box;

    box = document.createElement('div');
    box.id = 'dar-manual-challenge-controls';
    box.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:1000000',
      'background:#fff',
      'border:1px solid #999',
      'border-radius:10px',
      'box-shadow:0 4px 16px rgba(0,0,0,.25)',
      'padding:12px'
    ].join(';');

    box.innerHTML = `
      <button type="button" class="dar-manual-challenge-close"
        style="font-size:18px; padding:10px 16px; cursor:pointer;">
        ログを消してアリーナへ戻る
      </button>
    `;

    box.querySelector('.dar-manual-challenge-close')?.addEventListener('click', () => {
      location.href = `/arena?_=${Date.now()}`;
    });

    document.body.appendChild(box);
    return box;
  }

  async function handleChallengePage() {
    const state = await loadState();
    const settings = getRunConfig(state, loadLocalSettings());
    if (!state.pending) return;

    const wasManual = !!state.pending.manual;
    const result = detectResult();

    if (result === 'win') {
      await markWin('結果ページ判定', state, settings);
    } else if (result === 'loss' || result === 'draw' || result === 'cooldown') {
      await markRetryableLoss(`結果ページ判定:${result}`, state, settings);
    } else if (now() - (state.pending?.createdAt || 0) > CONFIG.pendingTimeoutMs) {
      await markRetryableLoss('結果ページタイムアウト', state, settings);
    }

    await refreshPanel(lastArenaRows, null, await loadState(), settings);

    if (wasManual) {
      ensureManualChallengeLogControls();
      return;
    }

    await sleep(CONFIG.resultStayMs);
    location.href = `/arena?_=${Date.now()}`;
  }

  async function handleArenaPage() {
    let state = await loadState();
    let settings = getRunConfig(state, loadLocalSettings());
    const rows = parseArenaRows();
    lastArenaRows = rows;

    bindManualChallengeForms(rows, settings);

    if (!state.running || state.manuallyStopped) {
      await refreshPanel(rows, null, state, settings);
      return;
    }

    const targetRows = getTargetRowsInPriority(rows, settings);
    const selectedRegions = uniq(targetRows.map(r => r.region));
    const primaryTarget = targetRows.find(r => !isHeldRegion(r, state, settings)) || targetRows[0] || null;

    await refreshPanel(rows, primaryTarget, state, settings);

    if (!isMyTurn(state, settings)) {
      return;
    }

    if (state.pending) {
      const pendingRow = rows.find(r => norm(r.region) === norm(state.pending.region));
      if (pendingRow && norm(pendingRow.leader) === norm(state.pending.by)) {
        await markWin(`${pendingRow.arenaName} leader=${pendingRow.leader}`, state, settings);
        state = await loadState();
        settings = getRunConfig(state, loadLocalSettings());
      } else if (now() - (state.pending.createdAt || 0) > CONFIG.pendingTimeoutMs) {
        await markRetryableLoss(`アリーナ再読込判定 leader=${pendingRow?.leader || '不明'}`, state, settings);
        state = await loadState();
        settings = getRunConfig(state, loadLocalSettings());
      } else {
        return;
      }
    }

    const monitoringRegions = uniq(state.monitoringRegions || []);
    if (monitoringRegions.length > 0) {
      const lostWatchedRow = monitoringRegions
        .map(region => rows.find(r => norm(r.region) === norm(region)))
        .find(r => {
          if (!r) return false;

          const region = norm(r.region);
          const rememberedLeader = norm(state?.heldRegions?.[region] || '');

          // 記録していた保持者と違うなら陥落
          if (rememberedLeader) {
            return norm(r.leader) !== rememberedLeader;
          }

          // 記録がない場合だけ旧判定
          return !isOurMember(r.leader, settings, state);
        });

      if (lostWatchedRow) {
        const nextIdx = nextTurnIndex(state, settings);
        const nextName = settings.teamOrder?.[nextIdx] || '';
        const region = norm(lostWatchedRow.region);
        const nextHeldRegions = { ...(state?.heldRegions || {}) };

        if (region) {
          delete nextHeldRegions[region];
        }

        await saveState({
          currentTurnIndex: nextIdx,
          monitoringRegions: [],
          heldRegions: nextHeldRegions,
          pending: null,
          lastSubmitAt: 0,
          lastResult: `[リーダー陥落] ${lostWatchedRow.arenaName} leader=${lostWatchedRow.leader || 'なし'} -> ${nextName || '次アカ'}`
        });
        return;
      }
    }

    const freshTargetRows = getTargetRowsInPriority(rows, settings);
    const attackableTargets = freshTargetRows.filter(r => !isHeldRegion(r, state, settings));

    if (attackableTargets.length > 0) {
      await submitChallenge(attackableTargets[0], settings);
      return;
    }

    if (selectedRegions.length > 0) {
      const monitorNow = uniq(state.monitoringRegions || []);
      const changed = monitorNow.join('|') !== selectedRegions.join('|');
      await saveState({
        monitoringRegions: selectedRegions,
        lastSubmitAt: 0,
        lastResult: changed
          ? `[監視開始] ${selectedRegions.join(' / ')}`
          : `[監視中] ${selectedRegions.join(' / ')}`
      });
      return;
    }

    await saveState({
      monitoringRegions: [],
      lastSubmitAt: 0,
      lastResult: `[待機] ランク ${getRankLabel(settings.targetRank)} の対象地域が見つかりません`
    });
  }

  function fillSelect(select, options, selectedValue) {
    const current = norm(selectedValue);
    const values = new Set(options.map(opt => norm(opt.value)));
    const safeOptions = [...options];
    if (current && !values.has(current)) {
      safeOptions.push({ value: current, label: current });
    }
    select.innerHTML = safeOptions.map(opt => {
      const selected = norm(opt.value) === current ? ' selected' : '';
      return `<option value="${escHtml(opt.value)}"${selected}>${escHtml(opt.label)}</option>`;
    }).join('');
  }

  function collectDraftSettings(panel, baseSettings = syncAutoMyName()) {
    const regionEquipAssignments = { ...(baseSettings.regionEquipAssignments || {}) };
    const pinnedMyName = getPinnedMyName();
    const detectedMyName = getMyName(baseSettings);
    const inputMyName = norm(panel.querySelector('.dar-my-name')?.value);

    panel.querySelectorAll('.dar-region-preset-select').forEach(select => {
      regionEquipAssignments[norm(select.dataset.region)] = norm(select.value);
    });

    return {
      ...baseSettings,
      myName: pinnedMyName || detectedMyName || inputMyName || '',
      teamOrderText: panel.querySelector('.dar-team-order')?.value || '',
      targetRank: panel.querySelector('.dar-target-rank')?.value || CONFIG.defaultRank,
      targetRegionPrimary: panel.querySelector('.dar-target-region-primary')?.value || '',
      targetRegionSecondary: panel.querySelector('.dar-target-region-secondary')?.value || '',
      requireEquipRegistration: !!panel.querySelector('.dar-require-equip')?.checked,
      regionEquipAssignments
    };
  }

  function ensurePanel() {
    let panel = document.getElementById('dar-rr-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'dar-rr-panel';
    panel.style.cssText = [
      'position:fixed',
      'right:12px',
      'bottom:12px',
      'z-index:999999',
      'width:460px',
      'max-height:85vh',
      'overflow:auto',
      'background:#fff',
      'color:#111',
      'border:1px solid #999',
      'border-radius:10px',
      'box-shadow:0 4px 18px rgba(0,0,0,.25)',
      'padding:10px',
      'font-size:12px',
      'line-height:1.45',
      'text-align:left'
    ].join(';');

    panel.innerHTML = `
      <div style="font-weight:700; font-size:14px; margin-bottom:6px;">Arena Rotator Rewrite</div>
      <div class="dar-summary" style="white-space:normal; margin-bottom:6px;"></div>
      <div class="dar-status" style="white-space:pre-wrap; background:#f7f7f7; border:1px solid #ddd; border-radius:6px; padding:6px; margin-bottom:8px;">待機中</div>

      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
        <button type="button" class="dar-start">開始</button>
        <button type="button" class="dar-stop">停止</button>
        <button type="button" class="dar-next">次アカへ</button>
        <button type="button" class="dar-reload">再読込</button>
      </div>

      <details open>
        <summary style="cursor:pointer; font-weight:700;">設定</summary>
        <div style="margin-top:8px; display:grid; gap:6px;">
          <label>
            <div>このコンテナのアカウント名</div>
            <input type="text" class="dar-my-name" style="width:100%;" placeholder="例: アカウント1">
          </label>

          <label>
            <div>アカウント順序（1行1アカウント）</div>
            <textarea class="dar-team-order" style="width:100%; height:84px;"></textarea>
          </label>

          <label>
            <div>挑戦ランク</div>
            <select class="dar-target-rank" style="width:100%;"></select>
          </label>

          <label>
            <div>挑戦地域1</div>
            <select class="dar-target-region-primary" style="width:100%;"></select>
          </label>

          <label>
            <div>挑戦地域2</div>
            <select class="dar-target-region-secondary" style="width:100%;"></select>
          </label>

          <label style="display:flex; gap:6px; align-items:center;">
            <input type="checkbox" class="dar-require-equip">
            <span>装備登録がない地域には挑戦しない</span>
          </label>

          <div style="font-weight:700; margin-top:6px;">地域別装備割当</div>
          <div class="dar-equip-list" style="display:grid; gap:4px;"></div>

          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
            <button type="button" class="dar-equip-register-open">装備登録</button>
            <button type="button" class="dar-equip-backup-open">バックアップ</button>
          </div>

          <button type="button" class="dar-save">設定を保存</button>
        </div>
      </details>
    `;

    const equipField = document.createElement('dialog');
    equipField.className = 'dar-equip-field';
    equipField.style.background = '#fff';
    equipField.style.color = '#000';
    equipField.style.maxWidth = '96vw';
    equipField.style.width = '96vw';
    equipField.style.height = '96vh';
    equipField.style.fontSize = '24px';
    equipField.dataset.currentTab = 'weapon';
    equipField.innerHTML = `
      <div style="text-align:center; margin-bottom:12px; font-size:24px;">
        <select class="dar-equip-rank" style="max-width:140px; height:52px; font-size:24px;">
          <option value="N">N</option>
          <option value="R">R</option>
          <option value="SR">SR</option>
          <option value="SSR">SSR</option>
          <option value="UR">UR</option>
        </select>
        <input type="text" class="dar-equip-preset-name" placeholder="プリセット名" style="width:320px; height:46px; font-size:24px;">
        <button type="button" class="dar-equip-save" style="height:52px; font-size:24px;">保存</button>
        <button type="button" class="dar-equip-done" style="height:52px; font-size:24px;">閉じる</button>
        <p class="dar-equip-selected" style="margin:10px 0 0 0; min-height:36px; font-size:24px;"></p>
        <div class="dar-equip-save-status" style="min-height:28px; color:#444; font-size:21px;"></div>
      </div>
      <div style="display:flex; gap:10px; justify-content:center; margin-bottom:10px;">
        <button type="button" class="dar-equip-tab-weapon" style="height:46px; font-size:24px;">武器</button>
        <button type="button" class="dar-equip-tab-armor" style="height:46px; font-size:24px;">防具</button>
        <button type="button" class="dar-equip-tab-necklace" style="height:46px; font-size:24px;">ネックレス</button>
      </div>
      <div style="display:flex; gap:10px; justify-content:center; margin-bottom:10px;">
        <button type="button" class="dar-equip-sort-name" style="height:44px; font-size:21px;">名前順</button>
        <button type="button" class="dar-equip-sort-mod" style="height:44px; font-size:21px;">mod順</button>
      </div>
      <div class="dar-equip-table-container" style="height:72vh; overflow:auto; font-size:24px;"></div>
      <button type="button" class="dar-equip-close" style="position:absolute; top:4px; right:10px; background:none; border:none; font-size:38px; line-height:1;">×</button>
    `;
    panel.appendChild(equipField);

    const backupDialog = document.createElement('dialog');
    backupDialog.className = 'dar-equip-backup-dialog';
    backupDialog.style.background = '#fff';
    backupDialog.style.color = '#000';
    backupDialog.style.maxWidth = '92vw';
    backupDialog.style.width = '72vw';
    backupDialog.innerHTML = `
      <div style="font-weight:700; margin-bottom:6px;">装備プリセット バックアップ</div>
      <textarea class="dar-equip-backup-text" style="width:100%; height:50vh; white-space:pre; font-family:monospace;"></textarea>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
        <button type="button" class="dar-equip-backup-copy">コピー</button>
        <button type="button" class="dar-equip-backup-save">保存</button>
        <button type="button" class="dar-equip-backup-close">閉じる</button>
      </div>
      <div class="dar-equip-backup-status" style="margin-top:6px; min-height:18px; color:#444;"></div>
    `;
    panel.appendChild(backupDialog);

    document.body.appendChild(panel);

    const onDraftChange = async (event) => {
      const currentRows = parseArenaRows();
      const effectiveRows = currentRows.length > 0 ? currentRows : lastArenaRows;
      if (effectiveRows.length > 0) lastArenaRows = effectiveRows;

      const draftSettings = collectDraftSettings(panel, syncAutoMyName());

      if (event?.target?.classList.contains('dar-target-rank')) {
        const matchedRegions = getAvailableRuleRegions(effectiveRows, draftSettings.targetRank);
        const values = matchedRegions.map(item => item.value).filter(Boolean);
        draftSettings.targetRegionPrimary = values[0] || '';
        draftSettings.targetRegionSecondary = values[1] || '';
        panel.querySelector('.dar-target-region-primary').value = draftSettings.targetRegionPrimary;
        panel.querySelector('.dar-target-region-secondary').value = draftSettings.targetRegionSecondary;
      }

      saveLocalSettings(draftSettings);
      if (draftSettings.myName) {
        setPinnedMyName(draftSettings.myName);
      }
      await refreshPanel(effectiveRows, null, await loadState(), draftSettings);
    };

    panel.querySelector('.dar-target-rank')?.addEventListener('change', onDraftChange);
    panel.querySelector('.dar-target-region-primary')?.addEventListener('change', onDraftChange);
    panel.querySelector('.dar-target-region-secondary')?.addEventListener('change', onDraftChange);
    panel.querySelector('.dar-my-name')?.addEventListener('change', onDraftChange);
    panel.querySelector('.dar-team-order')?.addEventListener('change', onDraftChange);
    panel.querySelector('.dar-require-equip')?.addEventListener('change', onDraftChange);

    panel.querySelector('.dar-start')?.addEventListener('click', async () => {
      const settings = collectDraftSettings(panel, syncAutoMyName());
      const myName = norm(settings.myName) || getMyName(settings);
      const teamOrder = parseTeamOrderText(settings.teamOrderText);
      const myIndex = teamOrder.map(norm).indexOf(norm(myName));

      if (!myName) {
        alert('このコンテナのアカウント名を設定してください。');
        return;
      }
      if (myIndex === -1) {
        alert(`myName="${myName}" がアカウント順序にありません。`);
        return;
      }

      settings.myName = myName;
      saveLocalSettings(settings);
      setPinnedMyName(myName);
      clearArenaReload();

      await saveState({
        running: true,
        manuallyStopped: false,
        currentTurnIndex: myIndex,
        monitoringRegions: [],
        heldRegions: {},
        pending: null,
        lastSubmitAt: 0,
        runConfig: snapshotRunConfig(settings),
        lastResult: `[開始] ${myName} から開始`
      });

      if (!location.pathname.startsWith('/arena')) {
        location.href = `/arena?_=${Date.now()}`;
        return;
      }

      const rows = parseArenaRows();
      lastArenaRows = rows;
      const startedState = await loadState();
      const activeSettings = getRunConfig(startedState, loadLocalSettings());
      const targetRows = getTargetRowsInPriority(rows, activeSettings);
      const attackableTarget = targetRows.find(r => !isOurMember(r.leader, activeSettings, startedState)) || null;
      if (attackableTarget) {
        await submitChallenge(attackableTarget, activeSettings);
      }
      await refreshPanel(rows, attackableTarget, await loadState(), activeSettings);
      scheduleArenaReload(CONFIG.pollMs);
    });

    panel.querySelector('.dar-stop')?.addEventListener('click', async () => {
      clearArenaReload();
      await saveState({
        running: false,
        manuallyStopped: true,
        monitoringRegions: [],
        heldRegions: {},
        pending: null,
        lastSubmitAt: 0,
        runConfig: null,
        lastResult: '[停止] 手動停止'
      });
      await refreshPanel(lastArenaRows, null, await loadState(), syncAutoMyName());
    });

    panel.querySelector('.dar-next')?.addEventListener('click', async () => {
      const state = await loadState();
      const settings = getRunConfig(state, loadLocalSettings());
      const nextIdx = nextTurnIndex(state, settings);
      await saveState({
        currentTurnIndex: nextIdx,
        monitoringRegions: [],
        pending: null,
        lastSubmitAt: 0,
        lastResult: `[手動] 次アカへ -> ${settings.teamOrder?.[nextIdx] || ''}`
      });
      await refreshPanel(lastArenaRows, null, await loadState(), settings);
    });

    panel.querySelector('.dar-reload')?.addEventListener('click', () => location.reload());

    panel.querySelector('.dar-equip-register-open')?.addEventListener('click', async () => {
      await showDarEquipList(panel);
    });

    panel.querySelector('.dar-equip-backup-open')?.addEventListener('click', () => {
      const dialog = panel.querySelector('.dar-equip-backup-dialog');
      const textarea = panel.querySelector('.dar-equip-backup-text');
      const status = panel.querySelector('.dar-equip-backup-status');

      textarea.value = exportEquipPresetsText();
      status.textContent = '現在の装備プリセットを指定書式で表示中';
      if (!dialog.open) {
        dialog.showModal();
      }
    });

    panel.querySelector('.dar-equip-tab-weapon')?.addEventListener('click', () => {
      applyEquipDialogTab(panel, 'weapon');
    });

    panel.querySelector('.dar-equip-tab-armor')?.addEventListener('click', () => {
      applyEquipDialogTab(panel, 'armor');
    });

    panel.querySelector('.dar-equip-tab-necklace')?.addEventListener('click', () => {
      applyEquipDialogTab(panel, 'necklace');
    });

    panel.querySelector('.dar-equip-sort-name')?.addEventListener('click', () => {
      const currentTab = panel.querySelector('.dar-equip-field')?.dataset.currentTab || 'weapon';
      setEquipSortMode(currentTab, 'nameAsc');
      applyEquipDialogTab(panel, currentTab);
    });

    panel.querySelector('.dar-equip-sort-mod')?.addEventListener('click', () => {
      const currentTab = panel.querySelector('.dar-equip-field')?.dataset.currentTab || 'weapon';
      setEquipSortMode(currentTab, 'modDesc');
      applyEquipDialogTab(panel, currentTab);
    });

    panel.querySelector('.dar-equip-rank')?.addEventListener('change', () => {
      const currentTab = panel.querySelector('.dar-equip-field')?.dataset.currentTab || 'weapon';
      applyEquipDialogTab(panel, currentTab);
    });

    panel.querySelector('.dar-equip-close')?.addEventListener('click', () => {
      panel.querySelector('.dar-equip-field')?.close();
    });

    panel.querySelector('.dar-equip-done')?.addEventListener('click', () => {
      panel.querySelector('.dar-equip-field')?.close();
    });

    panel.querySelector('.dar-equip-backup-close')?.addEventListener('click', () => {
      panel.querySelector('.dar-equip-backup-dialog')?.close();
    });

    panel.querySelector('.dar-equip-backup-copy')?.addEventListener('click', async () => {
      const textarea = panel.querySelector('.dar-equip-backup-text');
      const status = panel.querySelector('.dar-equip-backup-status');

      try {
        await navigator.clipboard.writeText(textarea.value || '');
        status.textContent = 'コピーしました';
      } catch (error) {
        status.textContent = `コピー失敗: ${error instanceof Error ? error.message : String(error)}`;
      }
    });

    panel.querySelector('.dar-equip-backup-save')?.addEventListener('click', async () => {
      const textarea = panel.querySelector('.dar-equip-backup-text');
      const status = panel.querySelector('.dar-equip-backup-status');
      const result = importEquipPresets(textarea.value);

      if (!result.ok) {
        status.textContent = `保存失敗: ${result.reason}`;
        return;
      }

      status.textContent = result.reason;
      await refreshPanel(lastArenaRows, null, await loadState(), loadLocalSettings());
    });

    panel.querySelector('.dar-equip-save')?.addEventListener('click', async () => {
      const presetNameInput = panel.querySelector('.dar-equip-preset-name');
      const selectedLabel = panel.querySelector('.dar-equip-selected');
      const saveStatus = panel.querySelector('.dar-equip-save-status');
      const presetName = norm(presetNameInput?.value || '');

      if (!presetName) {
        if (saveStatus) saveStatus.textContent = 'プリセット名を入力してください';
        return;
      }

      if (!darSelectedEquips.id.some(Boolean)) {
        if (saveStatus) saveStatus.textContent = '装備を選択してください';
        return;
      }

      if (getEquipPresetsStore()[presetName] && !confirm(`${presetName} は既にあります。上書きしますか？`)) {
        return;
      }

      saveEquipPreset(presetName, {
        id: darSelectedEquips.id,
        rank: darSelectedEquips.rank
      });

      await refreshPanel(lastArenaRows, null, await loadState(), loadLocalSettings());

      if (saveStatus) saveStatus.textContent = `装備登録しました: ${presetName}`;
      if (presetNameInput) presetNameInput.value = '';
      darSelectedEquips = { id: [], rank: [] };
      if (selectedLabel) selectedLabel.textContent = '';
    });

    panel.querySelector('.dar-save')?.addEventListener('click', async () => {
      const nextSettings = collectDraftSettings(panel, syncAutoMyName());
      saveLocalSettings(nextSettings);
      if (nextSettings.myName) {
        setPinnedMyName(nextSettings.myName);
      }
      await refreshPanel(lastArenaRows, null, await loadState(), nextSettings);
    });

    return panel;
  }

  async function refreshPanel(rows = lastArenaRows, target = null, state = null, settings = null) {
    const panel = ensurePanel();
    const resolvedState = state || await loadState();
    const resolvedSettings = settings ? { ...settings } : syncAutoMyName();
    const activeSettings = getRunConfig(resolvedState, resolvedSettings);
    const effectiveRows = (rows && rows.length) ? rows : (location.pathname.startsWith('/arena') ? parseArenaRows() : lastArenaRows);
    if (effectiveRows.length > 0) lastArenaRows = effectiveRows;

    const autoDetectedMyName = getMyName(activeSettings);
    const myName = autoDetectedMyName || activeSettings.myName || '';
    const teamOrder = activeSettings.teamOrder || parseTeamOrderText(activeSettings.teamOrderText);
    const currentTurn = currentTurnName(resolvedState, activeSettings);
    const targetRows = getTargetRowsInPriority(lastArenaRows, activeSettings);
    const selectedRegions = uniq(targetRows.map(r => r.region));
    const attackableTargets = targetRows.filter(r => !isHeldRegion(r, resolvedState, activeSettings));
    const primaryTarget = target || attackableTargets[0] || targetRows[0] || null;

    if (myName) {
      panel.querySelector('.dar-my-name').value = myName;
    }
    panel.querySelector('.dar-team-order').value = teamOrder.join('\n');
    panel.querySelector('.dar-require-equip').checked = !!activeSettings.requireEquipRegistration;

    fillSelect(
      panel.querySelector('.dar-target-rank'),
      getAvailableRules(lastArenaRows).map(rank => ({ value: rank, label: getRankLabel(rank) })),
      activeSettings.targetRank
    );

    const ruleRegions = getAvailableRuleRegions(lastArenaRows, activeSettings.targetRank);
    const regionOptions = [{ value: '', label: '(未指定)' }].concat(ruleRegions.map(item => ({ value: item.value, label: item.label })));
    fillSelect(panel.querySelector('.dar-target-region-primary'), regionOptions, activeSettings.targetRegionPrimary);
    fillSelect(panel.querySelector('.dar-target-region-secondary'), regionOptions, activeSettings.targetRegionSecondary);

    const equipList = panel.querySelector('.dar-equip-list');
    const regionRows = getAvailableRegions(lastArenaRows);
    equipList.innerHTML = regionRows.map(item => `
      <label style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; align-items:center;">
        <span>${escHtml(item.label)}</span>
        <select class="dar-region-preset-select" data-region="${escHtml(item.value)}"></select>
      </label>
    `).join('');
    equipList.querySelectorAll('.dar-region-preset-select').forEach(select => {
      fillPresetSelect(select, activeSettings.regionEquipAssignments?.[norm(select.dataset.region)] || '');
      select.addEventListener('change', async () => {
        const nextSettings = collectDraftSettings(panel, activeSettings);
        saveLocalSettings(nextSettings);
        await refreshPanel(lastArenaRows, primaryTarget, await loadState(), nextSettings);
      }, { once: true });
    });

    const summaryLines = [
      `状態: ${resolvedState.running && !resolvedState.manuallyStopped ? '稼働中' : '停止中'}`,
      `このコンテナ: ${myName || '(未設定)'}`,
      `現在の担当: ${currentTurn || '(なし)'}`,
      `挑戦ランク: ${getRankLabel(activeSettings.targetRank)}`,
      `挑戦地域: ${selectedRegions.length ? selectedRegions.join(' / ') : '(ランク一致の全地域)'}`
    ];
    panel.querySelector('.dar-summary').innerHTML = summaryLines.map(line => `<div>${escHtml(line)}</div>`).join('');

    const targetLabel = primaryTarget
      ? `${primaryTarget.arenaName} / leader=${primaryTarget.leader || 'なし'} / ${primaryTarget.rule}`
      : '対象なし';

    const statusLines = [
      resolvedState.lastResult || '待機中',
      `現在ターン: ${currentTurn || '(なし)'}`,
      `このコンテナ: ${myName || '(未設定)'}`,
      `自分の番: ${isMyTurn(resolvedState, activeSettings) ? 'はい' : 'いいえ'}`,
      `現在の対象: ${targetLabel}`,
      `未制圧対象数: ${attackableTargets.length}`,
      `監視対象: ${(resolvedState.monitoringRegions || []).length ? resolvedState.monitoringRegions.join(' / ') : '(なし)'}`,
      `pending: ${resolvedState.pending ? `${resolvedState.pending.arenaName} / by=${resolvedState.pending.by}` : '(なし)'}`
    ];
    panel.querySelector('.dar-status').textContent = statusLines.join('\n');
  }

  async function main() {
    clearArenaReload();
    ensurePanel();

    if (location.pathname.startsWith('/challenge')) {
      await refreshPanel();
      await handleChallengePage();
      return;
    }

    if (location.pathname.startsWith('/arena')) {
      await handleArenaPage();
      await refreshPanel(parseArenaRows(), null, await loadState(), syncAutoMyName());
      const stateAfter = await loadState();
      if (stateAfter.running && !stateAfter.manuallyStopped) {
        scheduleArenaReload(CONFIG.pollMs);
      }
      return;
    }

    await refreshPanel();
  }

  const listenerId = GM_addValueChangeListener(SHARED_KEY, async (_key, _oldValue, _newValue, remote) => {
    if (!remote) return;
    if (!location.pathname.startsWith('/arena') && !location.pathname.startsWith('/challenge')) return;

    const state = await loadState();
    if (!state.running || state.manuallyStopped) return;

    if (shouldPauseArenaReload()) {
      scheduleArenaReload(1200);
      return;
    }

    clearArenaReload();
    setTimeout(() => location.reload(), 450);
  });

  window.addEventListener('beforeunload', () => {
    clearArenaReload();
    try {
      GM_removeValueChangeListener(listenerId);
    } catch (e) {}
  });

  main().catch(error => console.error('[DAR-REWRITE]', error));
})();
