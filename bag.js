// ==UserScript==
// @name         Donguri Bag Enhancer
// @namespace    https://donguri.5ch.net/
// @version      8.16.4.8
// @description  5ちゃんねる「どんぐりシステム」の「アイテムバッグ」ページ機能改良スクリプト。
// @author       福呼び草
// @assistant    ChatGPT (OpenAI)
// @contributor  "ID:YTtKPa4Z0"
// @license      BSD-3-Clause license
// @updateURL    https://github.com/Fukuyobisou/Donguri_Bag_Enhancer/raw/main/Donguri_Bag_Enhancer.user.js
// @downloadURL  https://github.com/Fukuyobisou/Donguri_Bag_Enhancer/raw/main/Donguri_Bag_Enhancer.user.js
// @match        https://donguri.5ch.net/bag
// @match        https://donguri.5ch.net/chest
// @match        https://donguri.5ch.net/battlechest
// @run-at       document-end
// @grant        none
// ==/UserScript==

// 〓〓〓〓〓〓 共通定義 〓〓〓〓〓〓
(function(){
  'use strict';
  // ============================================================
  // スクリプト自身のバージョン（About 表示用）
  // ============================================================
  const DBE_VERSION    = '8.16.4.8';

  // ============================================================
  // 多重起動ガード（同一ページで DBE が複数注入される事故を防ぐ）
  // - 既に同等以上のバージョンが動いている場合、このインスタンスは停止
  // - 旧版が後から注入された場合も、旧版側が停止する
  // ============================================================
  function dbeParseVersion(v){
    return String(v || '')
      .split('.')
      .map(s=>{
        const n = parseInt(s, 10);
        return Number.isFinite(n) ? n : 0;
      });
  }
  function dbeCompareVersion(a, b){
    const A = dbeParseVersion(a);
    const B = dbeParseVersion(b);
    const len = Math.max(A.length, B.length);
    for (let i = 0; i < len; i++){
      const x = A[i] || 0;
      const y = B[i] || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }
  try{
    const prev = window.__DBE_ACTIVE_VERSION;
    if (prev && dbeCompareVersion(prev, DBE_VERSION) >= 0){
      console.warn('[DBE] another instance already running (version=' + prev + '), skip current version=' + DBE_VERSION);
      return;
    }
    window.__DBE_ACTIVE_VERSION = DBE_VERSION;
  }catch(_){}

  // ============================================================
  // Chest 処理の診断ログ（必要に応じて false に）
  // ============================================================
  const DBE_CHEST_DIAG = true;
  const chestDiag = (...args)=>{ try{ if(DBE_CHEST_DIAG) console.log('[DBE][ChestDiag]', ...args);}catch(_){} };

  // ============================================================
  // DBE rarity parser (weapon/armor) - bracket-only
  // 例: 「ウサギの耳R」の末尾Rは名前の一部なのでレアリティ扱いしない
  // レアリティ表記は [UR][SSR][SR][R][N] のみを対象
  // ============================================================
  function dbePickRarityFromText(raw){
    const s = String(raw || '');
    // 1) ブラケット表記 [UR] [SSR] [SR] [R] [N]
    let m = s.match(/\[\s*(UR|SSR|SR|R|N)\s*\]/);
    if (m) return m[1];
    // 2) セルがレアリティ記号のみの場合（列が分かれているケース）
    m = s.trim().match(/^(UR|SSR|SR|R|N)$/);
    return m ? m[1] : '';
  }

  // ============================================================
  // DBE name-badge API bootstrap (ensure available before any usage) ---
  // ============================================================
  function dbeEnsureNameBadgeApi(){
    if (window.DBE_setNameBadge) return window.DBE_setNameBadge;
    function ensureNameBadgeHost(nameCell){
      if (!nameCell) return null;
      nameCell.style.position = nameCell.style.position || 'relative';
      let host = nameCell.querySelector('.dbe-name-badges');
      if (!host){
        host = document.createElement('span');
        host.className = 'dbe-name-badges';
        host.style.cssText = [
          'position:absolute','right:4px','top:0',
          'display:flex','gap:4px',
          'align-items:flex-start','justify-content:flex-end',
          'pointer-events:none','font-size:1.2em','white-space:nowrap'
        ].join(';');
        nameCell.appendChild(host);
      }
      return host;
    }
    function setBadge(nameCell, type, show){
      const host = ensureNameBadgeHost(nameCell);
      if (!host) return;
      const CLS   = {unknown:'dbe-badge-unknown', new:'dbe-badge-new', lock:'dbe-badge-lock'};
      const TXT   = {unknown:'❓',                new:'🔰',            lock:'🔒'};
      const ORDER = {unknown:'1',                 new:'2',             lock:'3'};
      const cls = CLS[type]; if (!cls) return;
      let el = host.querySelector('.'+cls);
      if (show){
        if (!el){
          el = document.createElement('span');
          el.className = cls;
          el.textContent = TXT[type] || '';
          el.style.cssText = 'order:'+ORDER[type]+';';
          host.appendChild(el);
        }
      } else {
        if (el) el.remove();
        if (!host.querySelector(':scope > span')) host.remove();
      }
    }
    window.DBE_setNameBadge = {
      unknown:(td,on)=>setBadge(td,'unknown',!!on),
      newbie :(td,on)=>setBadge(td,'new',!!on),
      lock   :(td,on)=>setBadge(td,'lock',!!on),
    };
    return window.DBE_setNameBadge;
  }

  // Ensure global chest namespace exists even for early handlers
  if (!('DBE_CHEST' in window)) { window.DBE_CHEST = {}; }
  chestDiag('BOOT: script loaded, DBE_VERSION=', DBE_VERSION, 'pathname=', location.pathname);

  // ============================================================
  // 設定キー
  // ============================================================
  const anchorKey   = 'donguriItemTableResetAnchor';
  const overlayId   = 'donguriLoadingOverlay';
  const tableIds    = ['necklaceTable','weaponTable','armorTable'];

  // 先に定義してからエイリアスで参照（未定義参照を防ぐ）
  const HIDE_KEY       = 'donguriHideRecycleBtn';
  const SHOW_DELTA_KEY = 'donguriShowDeltaColumn';

  // 新しい安定ID ↔ 既存キー のエイリアス）
  const DBE_KEYS = {
    unlockedColor: { id:'dbe-prm-panel0-setcol.ll-unlocked',        legacy:'unlockedColor',            def:'#ff6600'              },
    lockedColor:   { id:'dbe-prm-panel0-setcolor-cell-locked',      legacy:'lockedColor',              def:'#ffffff'              },
    showDelta:     { id:'dbe-prm-panel0-check-display-necClm-Dlta', legacy: SHOW_DELTA_KEY,            def:false                    },
    hideKindClass: { id:'dbe-prm-panel0-check-hide-NameSub',        legacy:null,                       def:false                    },
    hideLockCol:   { id:'dbe-prm-panel0-check-hide-Clm-Lock',       legacy:null,                       def:false                    },
    hideRyclCol:   { id:'dbe-prm-panel0-check-hide-Clm-Rycl',       legacy:'donguriHideColumn-global', def:false                    },
    hideAllBtn:    { id:'dbe-prm-panel0-check-hide-RyclUnLck',      legacy: HIDE_KEY,                  def:false                    },
    baseFontSize:  { id:'dbe-prm-panel0-fontsize',                  legacy:null,                       def:getDefaultBaseFontSize() },
    displayItemId: { id:'dbe-prm-panel0-check-display-ItemID',      legacy:null,                       def:false                    },
    elemUnknownInc:{ id:'dbe-prm-elem-unknown-include',             legacy:null,                       def:false                    },
  };

  // ============================================================
  // デバイスに応じた基準文字サイズの初期値（PC/タブレット=16px、スマホ=14px）
  // ============================================================
  function getDefaultBaseFontSize(){
    try{
      const ua = navigator.userAgent || '';
      const isMobi = /Mobi|iPhone|Windows Phone|Android.+Mobile/.test(ua);
      const vpMin  = Math.min(window.innerWidth || 0, window.innerHeight || 0);
      const isSmallViewport = vpMin > 0 ? (vpMin <= 768) : false;
      return (isMobi || isSmallViewport) ? '14px' : '16px';
    }catch(_e){
      return '16px';
    }
  }

  // ============================================================
  // セル余白（パディング）設定
  // ============================================================
  const CELL_PAD_V_KEY = 'dbe_cellpad_vertical_px';   // 上下(px)
  const CELL_PAD_H_KEY = 'dbe_cellpad_horizontal_px'; // 左右(px)
  const CELL_PAD_DEFAULT_V = 4; // 初期値: 上下 4px
  const CELL_PAD_DEFAULT_H = 4; // 初期値: 左右 8px

  // ============================================================
  // 新フォーム（《フィルタカード》新規作成フォーム）を有効化するフラグ
  // ============================================================
  const DBE_USE_NEW_FILTER_FORM = true;

  // ============================================================
  // 既定値ありの文字列読取（ID優先 → 旧キー → 既定値）
  // ============================================================
  function readStr(key){
    const { id, legacy, def } = DBE_KEYS[key];
    // 1) まず現行IDキー
    const v = localStorage.getItem(id);
    if (v !== null) return v;
    // 2) つぎに旧キー（レガシー互換）
    const wnd = legacy ? localStorage.getItem(legacy) : null;
    if (wnd !== null) return wnd;
    // 3) どちらも無ければ既定値
    return def;
  }
  // 真偽値読み取り
  function readBool(key){
    const v = readStr(key);
    return (v === 'true' || v === true);
  }
  // 既定値にフォールバックする「ID直読み」ヘルパ
  function readBoolById(id){
    const v = localStorage.getItem(id);
    if (v !== null) return v === 'true';
    const ent = Object.values(DBE_KEYS).find(e => e.id === id);
    return ent ? !!ent.def : false;
  }
  function writeStr(key,val){ const {id,legacy}=DBE_KEYS[key]; localStorage.setItem(id,val); if (legacy) localStorage.setItem(legacy,val); }
  function writeBool(key,val){ writeStr(key, String(!!val)); }

  // ============================================================
  // ラダーモードの制限値に照らし、アイテムIDによる抽出を行う初期値（テキストボックスのデフォルト値）
  // ※ UI の <input type="text"> には id="dbe-filterui-itemidfilter-threshold" を付与します
  // ============================================================
  const DEFAULT_ITEMIDFILTER_THRESHOLD = 169000000;

  // ============================================================
  // マッピング
  // ============================================================
  const titleMap    = { necklaceTable: 'necklaceTitle', weaponTable: 'weaponTitle', armorTable: 'armorTitle' };
  const labelMap    = { necklaceTable: '━━ ネックレス ━━', weaponTable: '━━ 武器 ━━', armorTable: '━━ 防具 ━━' };
  const columnIds   = {
    necklaceTable: { 'ネックレス':'necClm-Name','装':'necClm-Equp','解':'necClm-Lock','属性':'necClm-StEf','マリモ':'necClm-Mrim','分解':'necClm-Rycl','増減':'necClm-Dlta' },
    weaponTable:   { '武器':'wepClm-Name','装':'wepClm-Equp','解':'wepClm-Lock','ATK':'wepClm-Atk','SPD':'wepClm-Spd','CRIT':'wepClm-Crit','ELEM':'wepClm-Elem','MOD':'wepClm-Mod','マリモ':'wepClm-Mrim','分解':'wepClm-Rycl' },
    armorTable:    { '防具':'amrClm-Name','装':'amrClm-Equp','解':'amrClm-Lock','DEF':'amrClm-Def','WT.':'amrClm-Wgt','CRIT':'amrClm-Crit','ELEM':'amrClm-Elem','MOD':'amrClm-Mod','マリモ':'amrClm-Mrim','分解':'amrClm-Rycl' }
  };
  const elemColors  = { '火':'#FFEEEE','氷':'#EEEEFF','雷':'#FFFFEE','風':'#EEFFEE','地':'#FFF0E0','水':'#EEFFFF','光':'#FFFFF0','闇':'#F0E0FF','なし':'#FFFFFF' };
  const elemOrder   = { '火':0,'氷':1,'雷':2,'風':3,'地':4,'水':5,'光':6,'闇':7,'なし':8 };
  const rarityOrder = { 'UR':0,'SSR':1,'SR':2,'R':3,'N':4 };

  const gradeOrder  = { 'Pt':0,'Au':1,'Ag':2,'CuSn':3,'Cu':4 };
  const gradeNames  = { 'Pt':'プラチナ','Au':'金','Ag':'銀','CuSn':'青銅','Cu':'銅' };
  const buffKeywords   = ['強化された','増幅された','力を増した','クリアになった','加速した','高まった','固くなった','尖らせた'];
  const debuffKeywords = ['静まった','弱まった','制限された','ぼやけた','減速した','減少した','砕けた','薄まった','緩んだ','侵食された','鈍らせた'];
  const statusMap      = {
    '攻撃の嵐':'storm','元素の混沌':'chaos','破滅の打撃':'blow','解き放たれた力':'release',
    '精度の道':'accuracy','時間の流れ':'time','生命の本質':'life','石の守り':'stone',
    '守護者の直感':'intuition','影のヴェール':'veil','運命の手':'hand','運命の盾':'shield','運命の賭博':'bet'
  };

  // ============================================================
  // 統一レジストリ方式
  //   ※[表示名 { kana:読み仮名, limited:限定or常設 }]
  //   ※下のレジストリから派生構造（weaponKana/armorKana, limitedWeapon/limitedArmor）を自動生成します
  // ============================================================
  function makeKey(s){
    if (!s) return '';
    return s.normalize('NFKC').toUpperCase().trim();
  }
  // レジストリ（常設武器）
  const weaponRegistry = new Map([
    ['F5アタック',                 { kana:'F5アタック',                   limited:false }],
    ['怒りの黒電話',               { kana:'イカリノクロデンワ',           limited:false }],
    ['おたま',                     { kana:'オタマ',                       limited:false }],
    ['おにぎらず',                 { kana:'オニギラズ',                   limited:false }],
    ['熊手',                       { kana:'クマデ',                       limited:false }],
    ['高圧洗浄機',                 { kana:'コウアツセンジョウキ',         limited:false }],
    ['小枝',                       { kana:'コエダ',                       limited:false }],
    ['小枝の刀',                   { kana:'コエダノカタナ',               limited:false }],
    ['ゴムチキン',                 { kana:'ゴムチキン',                   limited:false }],
    ['白胡椒',                     { kana:'シロコショウ',                 limited:false }],
    ['スリングショット',           { kana:'スリングショット',             limited:false }],
    ['どんぐり大砲',               { kana:'ドングリタイホウ',             limited:false }],
    ['どんぐりハンマ',             { kana:'ドングリハンマ',               limited:false }],
    ['ヌンチャク',                 { kana:'ヌンチャク',                   limited:false }],
    ['伸び切ったゴム紐',           { kana:'ノビキッタゴムヒモ',           limited:false }],
    ['ハエ叩き',                   { kana:'ハエタタキ',                   limited:false }],
    ['はたき',                     { kana:'ハタキ',                       limited:false }],
    ['棒',                         { kana:'ボウ',                         limited:false }],
    ['ほうき',                     { kana:'ホウキ',                       limited:false }],
    ['ママさんダンプ',             { kana:'ママサンダンプ',               limited:false }],
    ['ムチ',                       { kana:'ムチ',                         limited:false }],
    ['モバイルバッテリー',         { kana:'モバイルバッテリー',           limited:false }],
    ['狩人罠',                     { kana:'カリウドワナ',                 limited:true  }],
    ['狐火閃光',                   { kana:'キツネビセンコウ',             limited:true  }],
    ['投縄網',                     { kana:'ナゲナワアミ',                 limited:true  }],
    ['猟犬笛',                     { kana:'リョウケンブエ',               limited:true  }],
    ['パンプキンランチャー',       { kana:'パンプキンランチャー',         limited:true  }],
    ['ゴーストネット',             { kana:'ゴーストネット',               limited:true  }],
    ['キャンディコーンブラスター', { kana:'キャンディコーンブラスター',   limited:true  }],
    ['魔女のおたま',               { kana:'マジョノオタマ',               limited:true  }],
    ['墓掘りシャベル',             { kana:'ハカホリシャベル',             limited:true  }],
    ['叫ぶランタン',               { kana:'サケブランタン',               limited:true  }],
    ['クモの巣のムチ',             { kana:'クモノスノムチ',               limited:true  }],
    ['呪いの鐘',                   { kana:'ノロイノカネ',                 limited:true  }],
    ['コウモリブーメラン',         { kana:'コウモリブーメラン',           limited:true  }],
    ['スカルマレット',             { kana:'スカルマレット',               limited:true  }],
  // レジストリ（限定武器）
    ['カエルの拡声器',             { kana:'カエルノカクセイキ',           limited:true  }],
    ['カエルのメガホン',           { kana:'カエルノメガホン',             limited:true  }],
    ['セミのソニックキャノン',     { kana:'セミノソニックキャノン',       limited:true  }],
    ['花火',                       { kana:'ハナビ',                       limited:true  }],
    ['うちわ',                     { kana:'ウチワ',                       limited:true  }],
    ['練達のバット',               { kana:'レンタツノバット',             limited:true  }],
    ['練達のバットR',              { kana:'レンタツノバットR',            limited:true  }],
    ['キャンディケインの剣',       { kana:'キャンディケインノケン',       limited:true  }],
    ['スレイストライカー',         { kana:'スレイストライカー',           limited:true  }],
    ['絶氷槍パーマフロスト',       { kana:'ゼツヒョウソウパーマフロスト', limited:true  }],
    ['凍盲の大鎌',                 { kana:'トウモウノオオガマ',           limited:true  }],
    ['氷縛のポールアックス',       { kana:'ヒョウバクノポールアックス',   limited:true  }],
    ['雹嵐チャクラム',             { kana:'ヒョウランチャクラム',         limited:true  }],
    ['真夜中氷河ランタン',         { kana:'マヨナカヒョウガランタン',     limited:true  }],
    ['凍傷スリング',               { kana:'トウショウスリング',           limited:true  }],
    ['花火R',                      { kana:'ハナビR',                      limited:true  }],
    ['うちわR',                    { kana:'ウチワR',                      limited:true  }],
    ['チョコレートハンマー',       { kana:'チョコレートハンマー',         limited:true  }],
  ]);
  // レジストリ（常設防具）
  const armorRegistry = new Map([
    ['SPF50+',                     { kana:'SPF50プラス',                  limited:false }],
    ['羽毛のマント',               { kana:'ウモウノマント',               limited:false }],
    ['割烹着',                     { kana:'カッポウギ',                   limited:false }],
    ['木の鎧',                     { kana:'キノヨロイ',                   limited:false }],
    ['硬化木の鎧',                 { kana:'コウカキノヨロイ',             limited:false }],
    ['座布団',                     { kana:'ザブトン',                     limited:false }],
    ['たぬきの着ぐるみ',           { kana:'タヌキノキグルミ',             limited:false }],
    ['段ボールの鎧',               { kana:'ダンボールノヨロイ',           limited:false }],
    ['デカすぎる兜',               { kana:'デカスギルカブト',             limited:false }],
    ['どんぐりかたびら',           { kana:'ドングリカタビラ',             limited:false }],
    ['葉っぱの鎧',                 { kana:'ハッパノヨロイ',               limited:false }],
    ['プチプチ巻き',               { kana:'プチプチマキ',                 limited:false }],
    ['布団',                       { kana:'フトン',                       limited:false }],
    ['防弾カバン',                 { kana:'ボウダンカバン',               limited:false }],
  // レジストリ（限定防具）
    ['セミの抜け殻',               { kana:'セミノヌケガラ',               limited:true  }],
    ['水着',                       { kana:'ミズギ',                       limited:true  }],
    ['ゆかた',                     { kana:'ユカタ',                       limited:true  }],
    ['ウサギの耳',                 { kana:'ウサギノミミ',                 limited:true  }],
    ['ウサギの耳R',                { kana:'ウサギノミミR',                limited:true  }],
    ['猫耳カチューシャ',           { kana:'ネコミミカチューシャ',         limited:true  }],
    ['ナイトロダッシュ',           { kana:'ナイトロダッシュ',             limited:true  }],
    ['ニトロダッシュ',             { kana:'ニトロダッシュ',               limited:true  }],
    ['トナカイの装',               { kana:'トナカイノヨソオイ',           limited:true  }],
    ['パンプキン外殻',             { kana:'パンプキンガイガク',           limited:true  }],
    ['墓蝋のヴェール',             { kana:'ハカロウノヴェール',           limited:true  }],
    ['塩結界の外套',               { kana:'シオケッカイノガイトウ',       limited:true  }],
    ['ミイラ包帯',                 { kana:'ミイラホウタイ',               limited:true  }],
    ['霜鬼のマント',               { kana:'ソウキのマント',               limited:true  }],
    ['鏡棺',                       { kana:'キョウカン',                   limited:true  }],
    ['灯守の外套',                 { kana:'トウモリノガイトウ',             limited:true  }],
    ['段ボールの鎧R',              { kana:'ダンボールノヨロイR',          limited:true  }],
    ['プチプチ巻きR',              { kana:'プチプチマキR',                limited:true  }],
    ['葉っぱの鎧R',                { kana:'ハッパノヨロイR',              limited:true  }],
    ['木の鎧R',                    { kana:'キノヨロイR',                  limited:true  }],
    ['SPF50+R',                    { kana:'SPF50プラスR',                 limited:true  }],
    ['デカすぎる兜R',              { kana:'デカスギルカブトR',            limited:true  }],
    ['どんぐりかたびらR',          { kana:'ドングリカタビラR',            limited:true  }],
    ['氷霜のシュラウド',           { kana:'ヒョウソウノシュラウド',       limited:true  }],
    ['雪崩の甲殻',                 { kana:'ナダレノコウカク',             limited:true  }],
    ['ツンドラ守護者の胴衣',       { kana:'ツンドラシュゴシャノドウイ',   limited:true  }],
    ['極光の冠兜',                 { kana:'キョッコウノカンムリカブト',   limited:true  }],
    ['月影の告白ゆかた',           { kana:'ツキカゲノコクハクユカタ',     limited:true  }]
  ]);

  // ============================================================
  // 派生構造（互換用：既存コードが参照）
  // ============================================================
  const weaponKana = new Map();
  const armorKana  = new Map();
  const limitedWeapon = new Set();
  const limitedArmor  = new Set();
  const weaponKeyToName = new Map();
  const armorKeyToName  = new Map();

  function buildDerivedStructures(){
    // 武器
    for (const [name, meta] of weaponRegistry.entries()){
      const key = makeKey(name);
      if (weaponKeyToName.has(key) && weaponKeyToName.get(key) !== name){
        console.warn('[DBE] weapon name key collision:', name, 'vs', weaponKeyToName.get(key));
      } else {
        weaponKeyToName.set(key, name);
      }
      if (meta && typeof meta.kana === 'string' && meta.kana.trim()){
        weaponKana.set(name, meta.kana.trim());
      }
      if (meta && meta.limited === true){
        limitedWeapon.add(name);
      }
    }
    // 防具
    for (const [name, meta] of armorRegistry.entries()){
      const key = makeKey(name);
      if (armorKeyToName.has(key) && armorKeyToName.get(key) !== name){
        console.warn('[DBE] armor name key collision:', name, 'vs', armorKeyToName.get(key));
      } else {
        armorKeyToName.set(key, name);
      }
      if (meta && typeof meta.kana === 'string' && meta.kana.trim()){
        armorKana.set(name, meta.kana.trim());
      }
      if (meta && meta.limited === true){
        limitedArmor.add(name);
      }
    }
  }
  buildDerivedStructures();

  // ============================================================
  // Lock/Unlockリンクの状態をソートするための順位付け
  // ============================================================
  const secrOrder = { 'secured': 0, 'released': 1 };

  // ============================================================
  // 共通定義: SVG矢印（基本サイズ1em、左右余白0.1em）
  // ============================================================
  const ARROW_SVG = {
    up: `<svg xmlns="http://www.w3.org/3000/svg" viewBox="0 0 10 10" width="1em" height="1em" style="vertical-align:middle;margin:0 0.1em"><path d="M1 6 L5 2 L9 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    down:`<svg xmlns="http://www.w3.org/3000/svg" viewBox="0 0 10 10" width="1em" height="1em" style="vertical-align:middle;margin:0 0.1em"><path d="M1 4 L5 8 L9 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
  };

  // ============================================================
  // ソートインジケーター更新ヘルパー
  // ============================================================
  /**
  * @param {HTMLElement} th - ヘッダー th
  * @param {'⬆'|'⬇'} arrow - 矢印
  * @param {'left'|'right'} position - インジケーター位置
  * @param {string=} label - インジケータ内に表示するテキスト（例: 'Rarity','限定','カナ'）
  */

  function updateSortIndicator(th, arrow, position, label) {
    // 既存のインジケーターを全て削除（ヘッダー行内）
    th.parentNode
      .querySelectorAll('.sort-indicator, .sort-indicator-left')
      .forEach(el => el.remove());
    const span = document.createElement('span');

    // 共通クラス付与
    if (position === 'left') {
      span.classList.add('sort-indicator-left');
    } else {
      span.classList.add('sort-indicator');
    }

    // インジケーター本体
    const svg = ARROW_SVG[ arrow === '⬇' ? 'down' : 'up' ];
    if (label) {
      // (SVG) テキスト の形で表示（ブラケット無し）、テキストは 0.8em
      span.innerHTML = `${svg}<span class="sort-label">${label}</span>`;
    } else {
      // 互換：矢印のみ
      span.innerHTML = svg;
    }

    // thの先頭 or 末尾に挿入
    if (position === 'left') {
      th.insertBefore(span, th.firstChild);
    } else {
      th.appendChild(span);
    }

    // 最終ソートをグローバルに記憶
    const allColumnClasses = [
      ...Object.values(columnIds.necklaceTable),
      ...Object.values(columnIds.weaponTable),
      ...Object.values(columnIds.armorTable),
    ];
    // th に付いている class のうち、columnIds のいずれかを見つける
    const colClass = Array.from(th.classList).find(c => allColumnClasses.includes(c)) || null;
    lastSortedColumn  = colClass;
    // '⬇' を正順、'⬆' を逆順とみなす
    lastSortAscending = (arrow === '⬇');
  }

  // --- 最後に使用したソート関数を記憶するマップ（先に初期化） ---
  const lastSortMap = {};

  // --- ソート履歴（安定ソートの多段復元用） ---
  const lastSortHistoryMap = {};
  const DBE_MAX_SORT_HISTORY = 12;

  function dbeClearSortHistory(id){
    try{ if (lastSortMap && typeof lastSortMap === 'object') lastSortMap[id] = null; }catch(_){}
    try{ lastSortHistoryMap[id] = []; }catch(_){}
  }

  function dbeRememberSort(id, fn, key){
    try{
      if (!fn || typeof fn !== 'function') return;
      // 直近（単発）も保持
      if (lastSortMap && typeof lastSortMap === 'object') lastSortMap[id] = fn;

      // 履歴（多段）も保持
      if (!Array.isArray(lastSortHistoryMap[id])) lastSortHistoryMap[id] = [];
      const arr = lastSortHistoryMap[id];

      // key 指定がある場合：同一キー（＝同一列）の過去履歴を除去して「最後の方向」だけを採用
      if (key != null) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const it = arr[i];
          const itKey = (typeof it === 'function') ? null : (it && typeof it === 'object' ? it.key : null);
          if (itKey === key) arr.splice(i, 1);
        }
        arr.push({ key, fn });
      } else {
        // 互換：key 無しは従来通り（クリック履歴を積む）
        arr.push(fn);
      }

      if (arr.length > DBE_MAX_SORT_HISTORY) {
        arr.splice(0, arr.length - DBE_MAX_SORT_HISTORY);
      }
    }catch(e){
      console.warn('[DBE] rememberSort failed:', e);
    }
  }

  function dbeApplySortHistory(id){
    try{
      const arr = lastSortHistoryMap[id];
      if (Array.isArray(arr) && arr.length){
        // 安定ソート前提：古い順に適用すると、後のソートほど優先度が高くなる
        arr.forEach(it => {
          try{
            if (typeof it === 'function') { it(); return; }
            if (it && typeof it === 'object' && typeof it.fn === 'function') { it.fn(); return; }
          }catch(e){
            console.warn('[DBE] applySortHistory step failed:', e);
          }
        });
        return true;
      }
      if (typeof lastSortMap[id] === 'function') {
        lastSortMap[id]();
        return true;
      }
    }catch(e){
      console.warn('[DBE] applySortHistory failed:', e);
    }
    return false;
  }

  // --- 最後にソートされた列と方向を記憶 ---
  let lastSortedColumn  = null;  // 最後にソートされた列の class 名 (columnIds のいずれか)
  let lastSortAscending = null;  // true=正順(⬇), false=逆順(⬆)

  // --- 状態管理変数 ---
  let lastClickedCellId = null;
  let recycleTableId    = null;
  let recycleItemId     = null;

  // ============================================================
  // Transfer ページ用: 送信先IDをデフォルト入力（サブウインドウからの遷移時のみ）
  // ============================================================
  if (location.pathname === '/transfer') {
    window.addEventListener('load', ()=>{
      if (localStorage.getItem('donguriAutoTransfer') === 'bb97c8d2') {
        const input = document.getElementById('recipientid');
        if (input) input.value = 'bb97c8d2';
        localStorage.removeItem('donguriAutoTransfer');
      }
    });
    return;
  }

  // ============================================================
  // 初期化処理
  // ============================================================
  function initAll(){
    // --- 関数呼び出し ---
    replaceTreasureLinks();
    insertItemSummary();

    (function insertEquippedSection(){
      const header = document.querySelector('header');
      if (!header) return;
      // 見出しの挿入
        header.insertAdjacentHTML('afterend',
          '<h2 style="font-size:1.5em; margin-top:1em;"><span style="color:red;">&block;</span> 装備中のアイテム</h2>'
        );
        document.querySelectorAll('h3').forEach(h3 => {
          const text = h3.textContent.trim();
          if (!text.includes('装備している')) return;
          // ★(1) 「この h3 の次の兄弟要素」から順にたどって先に見つかった <table> 要素を拾う
          let el = h3.nextElementSibling;
          while (el && el.tagName !== 'TABLE') {
            // <p>／<div> の中に table があればそれを使う
            if ((el.tagName === 'P' || el.tagName === 'DIV')
                && el.querySelector('table')) {
                el = el.querySelector('table');
                break;
                }
            el = el.nextElementSibling;
          }
          const table = (el && el.tagName === 'TABLE') ? el : null;
          if (!table) {
            console.warn('装備中テーブルが見つかりません:', text, h3);
            h3.remove();
            return;
          }

          // ★(2.5) 装備中テーブルの ELEM 列（/属性列）を着色
          function applyColor(){
            try{
              const body = table.tBodies && table.tBodies[0];
              if (!body) return;
              const elemIdx = findHeaderIndexByText(table, ['ELEM','属性','Elem','Element','属性/Element']);
              if (elemIdx < 0) return;
              Array.from(body.rows).forEach(r=>{
                const td = r.cells[elemIdx];
                if (!td) return;
                const raw = (td.textContent || '').trim();
                const elem = (raw.match(/[^\d]+$/) || ['なし'])[0].trim();
                td.style.backgroundColor = elemColors[elem] || '';
              });
            }catch(_){}
          }

          // ★(2) テキストに応じて ID を振る
          if (text.includes('ネックレス')) {
            table.id = 'necklaceEquipped';
          } else if (text.includes('防具')) {
            table.id = 'armorEquipped';
          } else if (text.includes('武器')) {
            table.id = 'weaponEquipped';
          }
          applyColor();
        // 見出し自体はもう不要なので削除
        h3.remove();
      });
    })();

    // --- 「アイテムバッグ」見出しの整理 ---
    (function replaceBagHeading(){
      const headings = Array.from(document.querySelectorAll('h1, h3'))
          .filter(el => el.textContent.trim().startsWith('アイテムバッグ'));
      if (headings.length < 2) return;
      const old = headings[1];
      const h2 = document.createElement('h2');
      h2.style.fontSize  = '1.5em';
      h2.style.marginTop = '1em';
      h2.innerHTML = '<span style="color:red;">&block;</span> 所持アイテム一覧';
      old.replaceWith(h2);
    })();

    // ============================================================
    // ▽ここから▽ スタイル（CSS）集中管理ブロック
    // ------------------------------------------------------------
    const style = document.createElement('style');
      style.textContent = `
      /* --- Pタグのマージンをクリア --- */
      p {
        margin-top:    unset;
        margin-right:  unset;
        margin-bottom: unset;
        margin-left:   unset;
      }

      /* --- どんぐりバッグの画像を右寄せ --- */
      @media (min-width:300px) {
        img[src*="acorn-bag.jpg"] {
          float: right;
          margin: 0 0 1em 1em;
          max-width: 40%;
        }
      }

      /* --- ページ上の「全て分解する」ボタンにのみ適用 --- */
      form[action="https://donguri.5ch.net/recycleunlocked"] > button {
        display: block;
        margin: 8px auto;
        font-size: 1em;
        padding: 4px 8px;
      }

      /* --- 宝箱リンク用のリストレイアウト --- */
      ul#treasurebox {
        list-style: none;
        padding: 0;
        margin: 0 auto;
        display: flex;
        justify-content: center;
        gap: 1em;
        flex-wrap: wrap;
        font-size: 1.2em;
        font-weight: bold;
      }

      /* --- 装備中テーブルの幅とマージンを整形 --- */
      table#weaponEquipped,
      table#armorEquipped,
      table#necklaceEquipped {
        min-width: 100%;
        margin: 0px auto 12px 0px;
      }

      /* --- ソートインジケーター定義 --- */
      .sort-indicator,
      .sort-indicator-left {
        display: inline-block;
        margin: 0;
        padding: 0;
        transform-origin: center center;
        color: red;
        font-weight: bold;
      }
      /* ソートラベルの文字サイズ（インジケーター内） */
      .sort-label {
        font-size: 0.8em;
        vertical-align: middle;
      }

      /* --- ネックレス「属性」列（DeBuff）：末尾文言を赤く（例: "...% 減速した"） --- */
      .dbe-nec-debuff {
        color: red;
      }

      /* --- 強制表示用：フィルターUI と バーガーメニュー --- */
      .filter-ui {
        display: flex !important;
        flex-direction: column !important;
        visibility: visible !important;
        opacity: 1 !important;
      }

      /* --- カラーパレット呼び出しボックスの隙間除去（id 指定で限定適用） --- */
      #dbe-prm-panel0-setcolor-cell-unlocked,
      #dbe-prm-panel0-setcolor-cell-locked {
        /* ブラウザ既定の余白を無効化 */
        appearance: none;
        -webkit-appearance: none;
        padding: 0;
      }
      /* WebKit の内側ラッパ余白を0に */
      #dbe-prm-panel0-setcolor-cell-unlocked::-webkit-color-swatch-wrapper,
      #dbe-prm-panel0-setcolor-cell-locked::-webkit-color-swatch-wrapper {
        padding: 0;
      }
      /* 内側スウォッチの枠を消して全面表示 */
      #dbe-prm-panel0-setcolor-cell-unlocked::-webkit-color-swatch,
      #dbe-prm-panel0-setcolor-cell-locked::-webkit-color-swatch {
        border: none;
      }
      #dbe-prm-panel0-setcolor-cell-unlocked::-moz-color-swatch, #dbe-prm-panel0-setcolor-cell-locked::-moz-color-swatch { border: none; }

      /* "dbe-W-Rules"ウインドウのタブ（武器/防具）を 8em 固定幅に */
      .dbe-tab {
        width: 8em !important;
        display: inline-block;
        text-align: center;
      }

      /* === ▽ここから▽ フィルタカード新規フォーム 共通 === */
      .fc-card {
        border: 3px solid #999;
        border-radius: 8px;
        padding: 8px;
        display: grid;
        gap: 8px;
      }
      /* 枠線の“外側”に見せるフッター（案内＋保存/キャンセル） */
      .fc-footer{
        margin-top: 6px;
        padding-top: 4px;
        display: flex;
        flex-direction: column; /* ← 1行目：案内、2行目：ボタン群 */
        align-items: stretch;   /* ← 子を横幅いっぱいに */
        gap: 6px;               /* 行間 */
      }
      .fc-footer .fc-note{
        font-size: 0.95em;
        opacity: .9;
        margin: 0;              /* 余計な左右マージンを排除 */
      }
      /* ボタン群は横並び＆折返し可 */
      .fc-ops{
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .fc-grid {
        display: grid;
        grid-template-columns: 8em minmax(10em, 1fr); /* 左ラベル列(固定8.5em) / 右入力列 */
        column-gap: 12px;
        row-gap: 8px;
        align-items: start;
      }
      .fc-row {
        display: contents; /* 各rowは2セル（左/右）を持つ。構成変更しやすいよう分離 */
      }
      .fc-left {
        align-self: start;
      }
      .fc-right {
        align-self: start;
      }
      .fc-title {
        font-size: 1.1em;
        font-weight: 700;
      }
      .fc-sec {
        font-size: 1.1em;
        font-weight: 600;
      }
      .fc-inline {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.3em;
      }
      .fc-input,
      .fc-select,
      .fc-textarea {
        font-size: 0.95em;
        font-weight: 400;
        padding: 1px 8px;              /* 要件：padding 1px 8px */
      }
      /* パラメータ（名称／SPD／WT.／マリモ）だけ 0.9em に */
      .fc-param-text{
        font-size: 0.9em;
      }
      /* ==== Rarity badges ==== */
      .rar-badge{
        display: inline-block;
        min-width: 3.5em;
        padding: 0 6px;
        border: 2px solid #666;
        border-radius: 6px;
        font-size: 1.1em;
        font-weight: 700;
        line-height: 1.3em;
        margin-right: 1px;
        color: #FFF;
        text-align: center;
        vertical-align: middle;
      }
      .rar-UR  { background-color: #F45D01; color: #FFF; padding: 2px 4px; border: 1px solid #AAA; border-radius: 4px; } /* 既出指定に準拠 */
      .rar-SSR { background-color: #A633D6; color: #FFF; padding: 2px 4px; border: 1px solid #AAA; border-radius: 4px; }
      .rar-SR  { background-color: #1E88E5; color: #FFF; padding: 2px 4px; border: 1px solid #AAA; border-radius: 4px; }
      .rar-R   { background-color: #2E7D32; color: #FFF; padding: 2px 4px; border: 1px solid #AAA; border-radius: 4px; }
      .rar-N   { background-color: #9E9E9E; color: #FFF; padding: 2px 4px; border: 1px solid #AAA; border-radius: 4px; }
      /* ==== Logic badges (AND/OR) ==== */
      .logic-badge{
        display: inline-block;
        min-width: 3em;
        padding: 0 6px;
        border: 2px solid #666;
        border-radius: 6px;
        font-size: 1.1em;
        font-weight: 700;
        line-height: 1.2em;
        margin-right: 1px;
        color: #FFF;
        text-align: center;
        vertical-align: middle;
      }
      .logic-AND { background-color: blue; color: #FFF; padding: 2px 4px; border: 1px solid #AAA; border-radius: 4px; }
      .logic-OR  { background-color: red;  color: #FFF; padding: 2px 4px; border: 1px solid #AAA; border-radius: 4px; }
      /* ==== Element badges ==== */
      .elem-badge{
        display: inline-block;
        padding: 2px 8px;
        border: 1px solid #666;
        border-radius: 6px;
        font-size: 0.9em;
        font-weight: 700;
        line-height: 1.6;
        margin-right: 1px;
        color: var(--elem-fg, #000);            /* 文字色はCSS変数で（既定は黒） */
        background: var(--elem-bg, #eee);       /* 背景はCSS変数 */
        vertical-align: middle;
      }
      .fc-textarea {
        min-height: 5.5em;
        width: min(72svw, 560px);
        resize: vertical;              /* 縦横サイズ可変要件に合わせて縦リサイズ */
      }
      .fc-note {
        font-size: 0.85em;
        opacity: 0.85;
      }
      .fc-dimmed {
        color: #AAA !important;        /* ホワイトアウト（文字色） */
      }
      .fc-dimmed input,
      .fc-dimmed select,
      .fc-dimmed textarea,
      .fc-dimmed label {
        color: #AAA !important;        /* ラベルやプレーンテキストも薄色に */
      }
      /* 入力系（テキスト/数値/セレクト/テキストエリア）の背景と枠線も薄色に */
      .fc-dimmed .fc-input,
      .fc-dimmed .fc-select,
      .fc-dimmed .fc-textarea,
      .fc-dimmed input[type="text"],
      .fc-dimmed input[type="number"],
      .fc-dimmed select,
      .fc-dimmed textarea {
        background-color: #EEEEEE !important; /* #AAA 系の白飛ばし感（視覚弱めのグレー） */
        border-color: #AAAAAA !important;
        color: #AAAAAA !important;
      }
      /* チェックボックス/ラジオの外観も薄色に（見た目のみ） */
      .fc-dimmed input[type="checkbox"],
      .fc-dimmed input[type="radio"] {
        /* 主要ブラウザ対応のトーン変更 */
        accent-color: #AAAAAA !important;
        /* 補助（未対応ブラウザ向けの見た目弱グレー化） */
        filter: grayscale(100%) brightness(10);
      }
      /* 「すべて」チェックのラベルを標準フォントに統一 */
      .fc-all-label{
        font-size: 1em;
        font-weight: 400; /* = normal */
      }
      .fc-actions {
        display: grid;
        grid-template-columns: 1fr 1fr; /* 左：初期化 / 右：追加する */
        gap: 8px;
      }
      .fc-actions .left,
      .fc-actions .right {
        display: flex;
        align-items: center;
      }
      .fc-actions .left  { justify-content: flex-start; }
      .fc-actions .right { justify-content: flex-end;   }
      /* ボタン行を中央寄せにする修飾クラス */
      .fc-ops--center{
        justify-content: center;
        width: 100%;            /* ← 横幅を持たせて中央寄せを効かせる */
      }
      /* パラメータ見出し《…》だけを小さくする */
      .fc-param-head{
        font-size: 0.9em;
      }
      /* section separator: 外枠色で1px、幅7割、中央寄せ */
      .fc-sep {
        height: 0;
        border-top: 1px solid var(--fc-border, #CCC);
        width: 85%;
        margin: 0 auto; /* 中央寄せ */
      }
      /* グリッド内に入れる区切り線（左右2カラムを横断） */
      .fc-sep-row {
        height: 0;
        border-top: 1px solid var(--fc-border, #999);
        width: 90%;
        margin: 0 auto; /* 中央寄せ */
        grid-column: 1 / -1; /* 左右2カラムをまたぐ */
      }
      /* セパレータ（タイプA/B）
        - A: 太さ/幅は現状、色だけ薄く（opacityで薄色化）
        - B: 太さ/色は現状、幅を長く
      */
      .fc-sep-row--a{
        opacity: 0.75;
      }
      .fc-sep-row--b{
        width: 97%;
        border-width: 3px;
        border-color: #999;
        margin: 0.5em 0;
      }
      /* 《マリモ》行のテキストボックス専用クラス（どのブラウザでも効く） */
      .mrm-input{ width: 10em !important; }

      /* ===== Filter Card builder: tighten control-to-label spacing ===== */
      #dbe-W-Rules .dbe-filter-card-builder label {
        display: inline-flex;
        align-items: center;
        gap: 0;
      }
      #dbe-W-Rules .dbe-filter-card-builder input[type="checkbox"],
      #dbe-W-Rules .dbe-filter-card-builder input[type="radio"] {
        margin: 0 !important;   /* ← ブラウザ既定の左右マージンを打ち消して 0px に統一 */
        vertical-align: middle;
      }
      /* 既存の label 内 span やテキストノードとの隙間をさらに詰めたい場合の保険 */
      #dbe-W-Rules label > span,
      #dbe-W-Rules label > i,
      #dbe-W-Rules label > b,
      #dbe-W-Rules label > em {
        margin-left: 0 !important;
      }
      /* 万一、古いCSSで .label や .form-row に大きな gap/margin がある場合の打ち消し */
    #dbe-W-Rules .dbe-filter-card-builder .form-row,
    #dbe-W-Rules .dbe-filter-card-builder .label,
    #dbe-W-Rules .dbe-filter-card-builder .field {
        gap: 0 !important;
      }

      /* ===== Rules: 指定ラベルだけ input を上寄せに揃える ===== */
      #dbe-W-Rules .va-top input[type="checkbox"],
      #dbe-W-Rules .va-top input[type="radio"] {
        vertical-align: top !important;
      }
      /* ===== Rules: va-top ラベルのテキストを 5px 上へシフト ===== */
      #dbe-W-Rules .va-top .va-shift {
        position: relative;
        top: -5px;     /* ← テキストを 5px 上げる */
      }
      /* ===== dbe-W-Rules: Accordion (注意書き) ===== */
      #dbe-W-Rules details.dbe-acc {
        margin: 8px 0 16px 0;
        padding: 6px 8px;
        border: 2px solid #FF0000;
        border-radius: 6px;
        background: #F6FFFF; /* 既存ウィンドウ色に合わせた薄水色 */
      }
      #dbe-W-Rules details.dbe-acc > summary {
        cursor: pointer;
        font-weight: 600;
        outline: none;
        list-style: none; /* Firefox などで summary の黒丸を消す */
      }
      /* WebKit のデフォルトマーカーも消してテキストのみ表示 */
      #dbe-W-Rules details.dbe-acc > summary::-webkit-details-marker { display: none; }
      /* 展開中のボディ領域 */
      #dbe-W-Rules details.dbe-acc[open] .dbe-acc-body {
        margin: 0 0 8px 0;
      }
      /* #dbe-W-Backup の段の間の余白指定 */
    #dbe-W-Backup { --dbe-backup-row-gap: 24px; }

      /* === △ここまで△ フィルタカード新規フォーム 共通 === */

      /* === 旧フォームの無力化（新フォームコンテナ内では旧要素を全て非表示） === */
      /* 新フォームの描画先に data-fc-new="1" を付与し、そこでは .fc-card 以外を出さない */
      .dbe-window-body[data-fc-new="1"] > :not(.fc-card) { display: none !important; }
      /* 念のため、良くある旧フォームのクラス/目印を潰す（存在すれば） */
      .dbe-window-body[data-fc-new="1"] .legacy-filter-form,
      .dbe-window-body[data-fc-new="1"] .old-filter-form,
      .dbe-window-body[data-fc-new="1"] .rule-form-legacy { display: none !important; }

      /* === ▽ここから▽ 既存フィルタカード一覧 用 === */
      .saved-filter-card{ padding:6px 8px; border:1px solid #ccc; border-radius:8px; background:var(--dbe-fc-bg, #fff); margin:6px 0; }
      .saved-filter-line{ line-height:1.6; word-break:keep-all; }
      /* 既存カード行：ネックレス／武器／防具の各フィルタカードに異なる背景色を設定する */
      #dbe-W-Rules{
        --dbe-fc-bg-nec:#F9F9F0; /* ネックレス */
        --dbe-fc-bg-wep:#FCF8F8; /* 武器 */
        --dbe-fc-bg-amr:#F6FFF6; /* 防具 */
      }
      #dbe-W-Rules .dbe-filter-card-row--nec{ --dbe-fc-bg:var(--dbe-fc-bg-nec); }
      #dbe-W-Rules .dbe-filter-card-row--wep{ --dbe-fc-bg:var(--dbe-fc-bg-wep); }
      #dbe-W-Rules .dbe-filter-card-row--amr{ --dbe-fc-bg:var(--dbe-fc-bg-amr); }
      /* === △ここまで△ 既存フィルタカード一覧 用 === */

      /* === ▽ここから▽ 保存完了ダイアログ === */
      .dbe-save-overlay{
        position: fixed; inset: 0;
        background: rgba(0,0,0,.25);
        z-index: 2147483647 !important; /* ほぼ最上位に */
        display: flex; align-items: center; justify-content: center;
      }
      .dbe-save-dialog{
        background: #fff;
        border: var(--dbe-frame-width, 1px) var(--dbe-frame-style, solid) var(--dbe-frame-color, #aaa);
        border-radius: var(--dbe-frame-radius, 10px);
        min-width: 260px; max-width: 80vw;
        padding: 16px 18px; box-shadow: 0 10px 30px rgba(0,0,0,.25);
        display: grid; gap: 12px; text-align: center;
        z-index: 2147483647 !important;
      }
      .dbe-save-title{ font-weight: 700; }
      .dbe-save-actions{ display:flex; justify-content:center; }
      .dbe-save-actions > button{
        padding: 6px 14px; border: 1px solid #888; border-radius: 8px; background:#fafafa;
        cursor: pointer;
      }
      /* === △ここまで△ 保存完了ダイアログ === */

      /* === ▽ここから▽ ダイアログ共通スキン（クラス付けで切替） === */
      /*
        dialogCommon = 通常の確認/情報/小ウインドウ
        dialogAlert  = アラート/エラー/要注意（confirm/二択なども含む）
        ※ ウインドウ本体（ensureWindowShellのdiv）や、独自ダイアログ本体要素に付与
      */
      .dialogCommon{
        /* 基本デザイン（必要に応じてここを差し替え） */
        background-color: #F6FFFF;
        border: 6px solid #009300;
        border-radius: 10px;
        padding: 4px;
        color: #000;
        /* 視覚的な“注意枠”感を少しだけ足す */
        box-shadow: inset 0 0 0 3px rgba(153,0,0,0.2);
      }
      .dialogAlert{
        /* 目立つ注意喚起カラー。必要ならここで強調度を調整 */
        background-color: #FFF9F9;
        border: 6px solid #FF0000;
        border-radius: 10px;
        padding: 4px;
        color: rgb(2, 2, 2);
        /* 視覚的な“注意枠”感を少しだけ足す */
        box-shadow: inset 0 0 0 3px rgba(153,0,0,0.2);
      }
      /* “条件がすべて/不問のみ” 保存禁止アラート用（軽めの赤枠） */
      .dialogAlertLite{
        background-color: #FFF9F9;
        border: 3px solid #B00000;
        border-radius: 10px;
        padding: 4px;
        color: #300;
        box-shadow: inset 0 0 0 3px rgba(153,0,0,0.2);
      }
      /* === △ここまで△ ダイアログ共通スキン === */

      /* === ▽ここから▽ 二択確認ダイアログ（共通） === */
      /* 役割クラス（confirmCommon / confirmAlert）は、ウインドウ本体(ensureWindowShell生成div)に付与 */
      .confirm-title {
        font-size:1.1em;
        font-weight:700;
      }
      .confirm-message { }
      .confirm-actions {
        display:flex;
        justify-content:center;
        gap:10px;
        margin-top:4px;
      }
      .confirm-actions > button {
        padding:6px 18px;
        border:6px solid #006600;
        border-radius:8px;
        background:#E9FFE9;
        cursor:pointer;
      }
      .confirm-actions > button:disabled {
        opacity:0.5;
        cursor:default;
      }
      /* 注意喚起バリアント（ボタン/見出しに強調色） */
      .confirmAlert .confirm-title {
        color:#300;
      }
      .confirmAlert .confirm-actions > .btn-yes {
        border-color:#FF0000;
        background:#FFE9E9;
      }
      /* === △ここまで△ 二択確認ダイアログ（共通） === */

      /* === ▽ここから▽ 主要ウインドウ 共通デザイン（ダイアログ/ポップアップを除く） === */
      .windowsCommon {
        display: inline-block;
        position: fixed;
        inset: 0px;
        margin: auto;
        box-shadow: 0 0 12px 0 rgba(51, 51, 51, 0.5);
        box-sizing: border-box;
        max-width: 97svw;
        max-height: 97svh;
        width: fit-content;
        height: fit-content;
        border: 8px solid #007A00;
        border-radius: 12px;
        padding: 16px;
        background-color: #F6FFFF;
        color: #000;
        overflow: auto;
        }
      /* === △ここまで△ 主要ウインドウ 共通デザイン（ダイアログ/ポップアップを除く） === */

      `;
    document.head.appendChild(style);
    // ------------------------------------------------------------
    // △ここまで△ スタイル（CSS）集中管理ブロック
    // ============================================================

    // 〓〓〓 空の <p> を削除 〓〓〓
    document.querySelectorAll('p').forEach(p => {
      if (!p.textContent.trim() && p.children.length === 0) {
        p.remove();
      }
    });

    // 〓〓〓 分解ボタンのラベル置換 〓〓〓
    document.querySelectorAll('form[action*="recycleunlocked"] button').forEach(btn => {
      if (btn.textContent.includes('ロックされていない武器防具を全て分解する')) {
        btn.textContent = 'ロックされていないアイテムを全て分解する';
      }
    });

    // 〓〓〓 宝箱リンクの置換 〓〓〓

    function replaceTreasureLinks(){
      const anchors = Array.from(document.querySelectorAll('h3>a'))
          .filter(a => a.getAttribute('href').endsWith('chest'));
      if (anchors.length === 0) return;
      const ul = document.createElement('ul');
      ul.id = 'treasurebox';
      ul.innerHTML = `
        <li><a href="https://donguri.5ch.net/chest">宝箱</a></li>
        <li><a href="https://donguri.5ch.net/battlechest">バトル宝箱</a></li>
      `;
      const firstH3 = anchors[0].parentNode;
      firstH3.parentNode.insertBefore(ul, firstH3);
      anchors.forEach(a => a.parentNode.remove());
    }

    // 〓〓〓 アイテム数サマリの挿入 〓〓〓

    function insertItemSummary(){
      // treasurebox がなければ necklaceTitle を代替に
      const ref = document.getElementById('treasurebox')
                || document.getElementById('necklaceTitle');
      if (!ref) return;

      function countRows(id) {
        const table = document.getElementById(id);
        return table?.tBodies[0]?.rows.length || 0;
      }

      const n   = countRows('necklaceTable'),
            w   = countRows('weaponTable'),
            a   = countRows('armorTable'),
            tot = n + w + a;

      const info = document.createElement('div');
      info.style.marginTop = '1em';
      info.innerHTML = `
        <div style="font-size:1.1em;font-weight:bold">所持アイテム総数：${tot}</div>
        <div style="font-size:1em">（ネックレス：${n}個／武器：${w}個／防具：${a}個）</div>
      `;
      ref.insertAdjacentElement('afterend', info);
    }

    // 〓〓〓 サーバー由来の h3/h4/h5 タグを div に置き換え 〓〓〓

    // ページ読み込み時に存在する h3/h4/h5 タグにマーカーを付与
    ['h3','h4','h5'].forEach(tag => {
      Array.from(document.getElementsByTagName(tag)).forEach(el => {
        el.setAttribute('data-donguri-original','true');
      });
    });
    // マーカー付き要素のみを div に置き換え
    const tagMap = {
      'H3': { size: '1.4em', bold: true,  margin: '6px' },
      'H4': { size: '1.2em', bold: false, margin: '4px' },
      'H5': { size: '1.1em', bold: false, margin: '4px' }
    };
    Object.entries(tagMap).forEach(([tag, { size, bold, margin }]) => {
      Array.from(document.getElementsByTagName(tag))
        .filter(el => el.getAttribute('data-donguri-original') === 'true')
        .forEach(el => {
          const d = document.createElement('div');
          d.innerHTML = el.innerHTML;
          d.style.fontSize   = size;
          d.style.margin     = margin;
          if (bold) d.style.fontWeight = 'bold';
          // 元の属性もコピー
          Array.from(el.attributes).forEach(a => d.setAttribute(a.name, a.value));
          el.replaceWith(d);
        });
    });

    // 〓〓〓 セル位置記憶＋自動スクロール 〓〓〓
    try {
      const id = sessionStorage.getItem(anchorKey);
      if (id) scrollToAnchorCell();
    } catch (_){ /* ignore */ }

    // --- 関数呼び出し ---
    initLockToggle();
    tableIds.forEach(processTable);
    initRecycle();
    initMenu();          // 必要なセクションを各 dbe-W-* に直接生成
    initBulkRecycle();
    initDockMenu();      // 新ドックメニューを生成
    ensureHideAllControlInRecycle();    // ← Recycleに「全て分解ボタンを隠す」UIを挿入
    dbeInstallWindowFrontingObserver(); // 《dbe-W-*》の表示変化を監視し自動で最前面化
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // 〓〓〓 「戻る」復帰（bfcache）等でUIを再同期 〓〓〓
  window.addEventListener('pageshow', (err)=>{
    if (err.persisted || (performance.getEntriesByType('navigation')[0]?.type === 'back_forward')) {
      syncMenuFromStorage();
      applyCellColors();
    }
  });
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'visible') { syncMenuFromStorage(); applyCellColors(); }
  });

  // 〓〓〓 UI初期化 〓〓〓
  function initMenu(){

    // ============================================================
    // ▽ここから▽ テキストの横方向の中心線を合わせる
    // ──────────────────────────────
    // 指定ラベルだけ vertical-align:top を適用するマーク付け
    // ============================================================
    (function(){
      function __dbe_applyVATopInRules(root){
        const wnd = root || document.getElementById('dbe-W-Rules');
        if (!wnd) return;

        // ラベル内の「INPUT 以外の子ノード」をまとめて <span class="va-shift"> に包む
        // すでに包まれていれば何もしない
        const wrapLabelTextForVATop = (lb) => {
          if (!lb || lb.querySelector('.va-shift')) return;
          const wrap = document.createElement('span');
          wrap.className = 'va-shift';
          // 子ノードをスナップショットしてから移動（ライブ NodeList を壊さない）
          const nodes = Array.from(lb.childNodes);
          nodes.forEach(node => {
            // INPUT はそのまま（位置維持）。それ以外を va-shift の中へ
            if (node.nodeType === 1 && node.tagName === 'INPUT') return;
            wrap.appendChild(node);
          });
          // 何か移せたときだけ append（空ラッパは作らない）
          if (wrap.childNodes.length) lb.appendChild(wrap);
        };

        // ラベルの textContent でマッチして .va-top を付与
        const markLabels = (container, targets) => {
          if (!container) return;
          container.querySelectorAll('label').forEach(lb=>{
            const t = (lb.textContent || '').trim();
            if (targets.has(t)) {
              lb.classList.add('va-top');
              wrapLabelTextForVATop(lb); // ← テキスト側を 2px 上へ
            }
          });
        };

        // セクション見出しから右側セル（入力群）を推定
        const rightOf = (secNode) => {
          if (!secNode) return null;
          // .fc-row（display:contents）で2カラム構成：見出し(.fc-left)の次が入力(.fc-right)
          const row = secNode.closest('.fc-row');
          if (row) {
            const next = row.querySelector('.fc-right');
            if (next) return next;
          }
          // フォールバック：見出しの親を使う
          return secNode.parentElement || wnd;
        };

        // 1) 《動作モード》 …「施錠」「分解」
        const modeSec = Array.from(wnd.querySelectorAll('.fc-sec, .fc-left'))
          .find(s => (s.textContent || '').includes('動作モード'));
        markLabels(rightOf(modeSec), new Set(['施錠','分解']));

        // 2) 《Rarity》 …「UR」「SSR」「SR」「R」「N」「不問」
        const rarSec = Array.from(wnd.querySelectorAll('.fc-sec, .fc-left'))
          .find(s => (s.textContent || '').includes('Rarity'));
        markLabels(rightOf(rarSec), new Set(['UR','SSR','SR','R','N','不問']));

        // 3) 《Rarity》《武器名》《防具名》《SPD》《WT.》《Element》《マリモ》の「不問」
        ['Rarity','武器名','防具名','SPD','WT.','Element','マリモ'].forEach(h => {
          const sec = Array.from(wnd.querySelectorAll('.fc-sec, .fc-left'))
            .find(s => (s.textContent || '').trim().includes(h));
          markLabels(rightOf(sec), new Set(['不問']));
        });
      }

      // openRulesModal() 実行後に適用（存在すればラップ）
      const installWrapper = () => {
        if (typeof window.openRulesModal === 'function' && !window.openRulesModal.__dbeWrappedForVATop) {
          const orig = window.openRulesModal;
          window.openRulesModal = function(){
            const ret = orig.apply(this, arguments);
            // 描画直後に少し待ってから適用（DOM構築完了を待つ）
            setTimeout(()=>{ try{ __dbe_applyVATopInRules(); }catch(_e){} }, 0);
            return ret;
          };
          window.openRulesModal.__dbeWrappedForVATop = true;
          return true;
        }
        return false;
      };

      // すぐにラップを試み、ダメなら #dbe-W-Rules の表示切替を監視（フォールバック）
      if (!installWrapper()) {
        const wnd = document.getElementById('dbe-W-Rules');
        if (wnd && window.MutationObserver) {
          const obs = new MutationObserver(() => {
            const shown = getComputedStyle(wnd).display !== 'none';
            if (shown) { try{ __dbe_applyVATopInRules(wnd); }catch(err){} }
          });
          obs.observe(wnd, { attributes:true, attributeFilter:['style','class'] });
        }
      }
    })();
    // ============================================================
    // △ここまで△ テキストの横方向の中心線を合わせる
    // ============================================================

    // 二重初期化ガード（戻る復帰時や二重実行対策）
    if (document.getElementById('dbe-panel0-Settings')) return;
    // 旧バーガーUIと旧ウィンドウIDは使用しない
    const menu = document.createElement('div'); // 一時コンテナ（IDは付与しない）
    // ── panel-0 を 4 区分に分割 ─────────────────────────────
    const secSettings  = document.createElement('div');  secSettings.id  = 'dbe-panel0-Settings';
    const secRecycle   = document.createElement('div');  secRecycle.id   = 'dbe-panel0-Recycle';
    const secNav       = document.createElement('div');  secNav.id       = 'dbe-panel0-Navigation';
    const secAbout     = document.createElement('div');  secAbout.id     = 'dbe-panel0-About';
    // 適度な余白（必要なければ削除可）
    [secSettings,secRecycle,secNav,secAbout].forEach(s=>{ s.style.margin='8px 0'; });

    Object.assign(menu.style,{
      position:'fixed',bottom:'50px',left:'0',maxWidth:'450px',
      border:'3px solid #009300',borderRadius:'8px',
      padding:'8px 8px 4px 8px',backgroundColor:'#F6FFFF',display:'none',
      flexDirection:'column',alignItems:'flex-start',zIndex:'999991',
      maxHeight:'80vh',overflowY:'auto'
    });
    const spacer = ()=>{ const sp=document.createElement('div'); sp.style.height='0.5em'; return sp; };

    // --- 基準文字サイズ（ページ全体） ---
    const fsRow = document.createElement('div');
    fsRow.style.display='flex'; fsRow.style.gap='0'; fsRow.style.alignItems='center'; fsRow.style.margin='0 0 4px 0';
    const fsLabel = document.createElement('span'); fsLabel.textContent='基準文字サイズ：';
    const fsName  = 'dbe-fontsize';
    const fsOptions = ['16px','14px','12px'];
    const fsContainer = document.createElement('div'); fsContainer.style.display='flex'; fsContainer.style.gap='12px';
    const currentFS = readStr('baseFontSize');
    fsOptions.forEach(val=>{
      const lab = document.createElement('label'); lab.style.display='flex'; lab.style.alignItems='center'; lab.style.gap='0px';
      const r = document.createElement('input'); r.type='radio'; r.name=fsName; r.value=val; r.id=`dbe-prm-panel0-fontsize-${val}`;
      r.checked = (currentFS===val);
      r.addEventListener('change', ()=>{
        if (r.checked){ writeStr('baseFontSize', val); applyBaseFontSize(); }
      });
      lab.append(r, document.createTextNode(val));
      fsContainer.appendChild(lab);
    });
    fsRow.append(fsLabel, fsContainer);
    secSettings.appendChild(fsRow);

    // --- カラー設定：[錠]セル・[解錠]セル背景色 ---    // [錠]セルの背景色
    const unlockedInput = document.createElement('input');
    unlockedInput.type  = 'color';
    // カラーパレット呼び出しボックスの大きさ
    unlockedInput.style.border  = '2px solid #666666';
    unlockedInput.style.width  = '27px';
    unlockedInput.style.height = '27px';
    unlockedInput.style.margin = '2px 0 2px 0';
    unlockedInput.style.padding = '0';
    // 注: ボックス内の黒い隙間は上のCSSで除去
    unlockedInput.id    = 'dbe-prm-panel0-setcolor-cell-unlocked';
    unlockedInput.value = readStr('unlockedColor');
    const unlockedText  = document.createElement('input');
    unlockedText.type   = 'text';
    unlockedText.id     = 'dbe-prm-panel0-text-unlocked';
    // 表示は常に大文字に
    unlockedText.style.textTransform = 'uppercase';
    unlockedText.value  = unlockedInput.value;
    // ラベル
    const unlockedLabelSpan = document.createElement('span'); unlockedLabelSpan.textContent = '［錠］の背景色：';
    unlockedText.style.width  = '5em';
    unlockedText.style.margin = '0 4px 2px 0';
    unlockedText.style.padding = '2px 8px';
    // 入力即時反映
    // HEX 正規化（#RRGGBB へ統一、返せない場合は null）
    function normalizeHex(v){
      if(!v) return null;
      v = String(v).trim();
      if(/^#?[0-9a-fA-F]{6}$/.test(v)){
        if(v[0] !== '#') v = '#' + v;
        return v.toUpperCase();
      }
      return null;
    }

    // カラーパレット側の変更 → テキストへ反映（大文字化）
    unlockedInput.addEventListener('input', ()=>{
      const hex = normalizeHex(unlockedInput.value) || unlockedInput.value;
      unlockedText.value = hex.toUpperCase();
      writeStr('unlockedColor', unlockedText.value);
      applyCellColors();
    });
    // テキスト側の変更 → カラーパレットへ反映（確定時に正規化）
    unlockedText.addEventListener('change', ()=>{
      const hex = normalizeHex(unlockedText.value);
      if(hex){
        unlockedText.value  = hex;
        unlockedInput.value = hex;
        writeStr('unlockedColor', hex);
        applyCellColors();
      } else {
        // 入力が不正なら直前値へ戻す
        unlockedText.value = normalizeHex(unlockedInput.value) || unlockedInput.value.toUpperCase();
      }
    });

    // 1行にまとめて Settings へ
    const rowUnlocked = document.createElement('div');
    rowUnlocked.style.display='flex'; rowUnlocked.style.gap='8px'; rowUnlocked.style.margin='0 0 4px 0'; rowUnlocked.style.alignItems='center';
    rowUnlocked.append(unlockedLabelSpan, unlockedInput, unlockedText);
    secSettings.appendChild(rowUnlocked);

    // [解錠]セルの背景色
    const lockedInput = document.createElement('input');
    lockedInput.type  = 'color';
    // カラーパレット呼び出しボックスの大きさ
    lockedInput.style.border  = '2px solid #666666';
    lockedInput.style.width  = '27px';
    lockedInput.style.height = '27px';
    lockedInput.style.margin = '2px 0 2px 0';
    lockedInput.style.padding = '0';
    // 注: ボックス内の黒い隙間は上のCSSで除去
    lockedInput.id    = 'dbe-prm-panel0-setcolor-cell-locked';
    lockedInput.value = readStr('lockedColor');
    const lockedText  = document.createElement('input');
    lockedText.type   = 'text';
    lockedText.id     = 'dbe-prm-panel0-text-locked';
    lockedText.value  = lockedInput.value;
    // 表示は常に大文字に
    lockedText.style.textTransform = 'uppercase';
    // ラベル
    const lockedLabelSpan = document.createElement('span'); lockedLabelSpan.textContent = '［解錠］の背景色：';
    lockedText.style.width  = '5em';
    lockedText.style.margin = '0 4px 2px 0';
    lockedText.style.padding = '2px 8px';

    // （参考）既存の applyCellColors／syncMenuFromStorage でも保存値はそのまま大文字で扱われます

    // カラーパレット側の変更 → テキストへ反映（大文字化）
    lockedInput.addEventListener('input', ()=>{
      const hex = normalizeHex(lockedInput.value) || lockedInput.value;
      lockedText.value = hex.toUpperCase();
      writeStr('lockedColor', lockedText.value);
      applyCellColors();
    });
    // テキスト側の変更 → カラーパレットへ反映（確定時に正規化）
    lockedText.addEventListener('change', ()=>{
      const hex = normalizeHex(lockedText.value);
      if(hex){
        lockedText.value  = hex;
        lockedInput.value = hex;
        writeStr('lockedColor', hex);
        applyCellColors();
      } else {
        // 入力が不正なら直前値へ戻す
        lockedText.value = normalizeHex(lockedInput.value) || lockedInput.value.toUpperCase();
      }
    });

    // 1行にまとめて Settings へ
    const rowLocked = document.createElement('div');
    rowLocked.style.display='flex'; rowLocked.style.gap='8px'; rowLocked.style.margin='0 0 4px 0'; rowLocked.style.alignItems='center';
    rowLocked.append(lockedLabelSpan, lockedInput, lockedText);
    secSettings.appendChild(rowLocked);

    // --- ネックレス「増減」列表示設定（未設定時はOFF＝false） ---
    const showDeltaCk  = document.createElement('input'); showDeltaCk.type = 'checkbox';
    showDeltaCk.id     = 'dbe-prm-panel0-check-display-necClm-Dlta';
    showDeltaCk.checked = readBool('showDelta');
    showDeltaCk.addEventListener('change', ()=>{
      const show = showDeltaCk.checked;
      toggleDeltaColumn(show);
      writeBool('showDelta', show);
      // 列構造を現在の設定に同期（重複生成/残骸を防ぐ）
      try{ refreshSortingForTableId('necklaceTable'); }catch(err){ console.warn('[DBE] refreshSortingForTableId(necklace) failed:', err); }
    });
    const rowDelta = document.createElement('label');
    rowDelta.style.display='flex'; rowDelta.style.gap='8px'; rowDelta.style.alignItems='center';
    rowDelta.append(showDeltaCk, document.createTextNode('ネックレスに「増減」列を表示する'));
    secSettings.appendChild(rowDelta);
    // 初期表示：前回の設定を反映
    toggleDeltaColumn(showDeltaCk.checked);

    // --- ネックレス、武器、防具の装備種とクラスを隠す ---
    const cbNameSub = document.createElement('input'); cbNameSub.type='checkbox';
    cbNameSub.id = 'dbe-prm-panel0-check-hide-NameSub';
    cbNameSub.checked = readBool('hideKindClass');
    // 初期適用
    toggleNameSubLine(cbNameSub.checked);
    cbNameSub.addEventListener('change', ()=>{
      writeBool('hideKindClass', cbNameSub.checked);
      toggleNameSubLine(cbNameSub.checked);
    });
    const rowHideNameSub = document.createElement('label');
    rowHideNameSub.style.display='flex'; rowHideNameSub.style.gap='8px'; rowHideNameSub.style.alignItems='center';
    rowHideNameSub.append(cbNameSub, document.createTextNode('ネックレス、武器、防具の装備種とクラスを隠す'));
    secSettings.appendChild(rowHideNameSub);

    // --- ネックレス、武器、防具の「錠／解錠」列を隠す（分解列の一つ上に配置） ---
    const cbLockCol = document.createElement('input'); cbLockCol.type='checkbox';
    cbLockCol.id = 'dbe-prm-panel0-check-hide-Clm-Lock';
    cbLockCol.checked = readBool('hideLockCol'); // デフォルト OFF
    // 初期適用
    toggleLockColumn(cbLockCol.checked);
    cbLockCol.addEventListener('change', ()=>{
      writeBool('hideLockCol', cbLockCol.checked);
      toggleLockColumn(cbLockCol.checked);
    });
    const rowHideLock = document.createElement('label');
    rowHideLock.style.display='flex'; rowHideLock.style.gap='8px'; rowHideLock.style.alignItems='center';
    rowHideLock.append(cbLockCol, document.createTextNode('ネックレス、武器、防具の「錠／解錠」列を隠す'));
    // 「分解列を隠す」の直前に挿入
    secSettings.appendChild(rowHideLock);

    // 〓〓〓 ネックレス・武器・防具の「分解」列を隠す 〓〓〓
    const cbg = document.createElement('input'); cbg.type='checkbox';
    cbg.id = 'dbe-prm-panel0-check-hide-Clm-Rycl';
    cbg.checked = readBool('hideRyclCol');    // 初期適用: 分解列
    if (cbg.checked) tableIds.forEach(id=> document.querySelectorAll(`.${columnIds[id]['分解']}`).forEach(el=>el.style.display='none'));
    cbg.addEventListener('change', ()=>{
      writeBool('hideRyclCol', cbg.checked);
      tableIds.forEach(id=> document.querySelectorAll(`.${columnIds[id]['分解']}`).forEach(el=>el.style.display=cbg.checked?'none':''));
    });
    const rowHideCol = document.createElement('label');
    rowHideCol.style.display='flex'; rowHideCol.style.gap='8px'; rowHideCol.style.alignItems='center';
    rowHideCol.append(cbg, document.createTextNode('ネックレス、武器、防具の「分解」列を隠す'));
    secSettings.appendChild(rowHideCol);

    // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
    // ★ 背景処理用：施錠/分解列の一時表示 ON/OFF スナップショット＆復元ヘルパ
    //   - 背景 iframe にもユーザースクリプトが入る環境で列が非表示だと、列検出やリンク探索が不安定になるため
    //   - startChestProcess() の頭で強制 ON、finishChest() で元の設定に戻す
    // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
    let __dbeColsBackup = null;
    function __dbeForceShowColsForRun(){
      // 現在値をスナップショット
      try{
        __dbeColsBackup = {
          hideLockCol: readBool('hideLockCol'),
          hideRyclCol: readBool('hideRyclCol'),
          showDelta  : readBool('showDelta'),
        };
      }catch(_){
        __dbeColsBackup = { hideLockCol:false, hideRyclCol:false, showDelta:false };
      }
      // 「錠／解錠」列：表示に一時強制（= 隠す設定をOFF）
      try{
        if (__dbeColsBackup.hideLockCol){
          writeBool('hideLockCol', false);
          if (typeof toggleLockColumn === 'function') toggleLockColumn(false);
        }
      }catch(err){ console.warn('[DBE] forceShowCols(lock) failed', err); }
      // 「分解」列：表示に一時強制（= 隠す設定をOFF）
      try{
        if (__dbeColsBackup.hideRyclCol){
          writeBool('hideRyclCol', false);
          tableIds.forEach(id=>{
            document.querySelectorAll(`.${columnIds[id]['分解']}`).forEach(el=> el.style.display='');
          });
        }
      }catch(err){ console.warn('[DBE] forceShowCols(recycle) failed', err); }
      // ネックレス「増減」列：表示に一時強制（= 有効化をON）
      try{
        if (!__dbeColsBackup.showDelta){
          writeBool('showDelta', true);
          if (typeof toggleDeltaColumn === 'function') toggleDeltaColumn(true);
          // 列未構築のケースも考慮して再ワイヤ
          if (typeof refreshSortingForTableId === 'function') refreshSortingForTableId('necklaceTable');
        }
      }catch(err){ console.warn('[DBE] forceShowCols(delta) failed', err); }
    }

    function __dbeRestoreColsAfterRun(){
      const b = __dbeColsBackup; __dbeColsBackup = null;
      if (!b) return;
      // 「錠／解錠」列：元に戻す
      try{
        writeBool('hideLockCol', b.hideLockCol);
        if (typeof toggleLockColumn === 'function') toggleLockColumn(b.hideLockCol);
      }catch(err){ console.warn('[DBE] restoreCols(lock) failed', err); }
      // 「分解」列：元に戻す
      try{
        writeBool('hideRyclCol', b.hideRyclCol);
        tableIds.forEach(id=>{
          document.querySelectorAll(`.${columnIds[id]['分解']}`).forEach(el=> el.style.display = b.hideRyclCol ? 'none' : '');
        });
      }catch(err){ console.warn('[DBE] restoreCols(recycle) failed', err); }
      // 「増減」列：元に戻す
      try{
        writeBool('showDelta', b.showDelta);
        if (typeof toggleDeltaColumn === 'function') toggleDeltaColumn(b.showDelta);
        if (typeof refreshSortingForTableId === 'function') refreshSortingForTableId('necklaceTable');
      }catch(err){ console.warn('[DBE] restoreCols(delta) failed', err); }
    }

    // 〓〓〓 対象行から「装」列のハイパーリンクを見つけてアイテムIDを抽出 〓〓〓
    function dbeExtractItemIdFromRow(kind, tr){
      try{
        if (!tr) return null;
        const equipCls =
          (kind === 'nec') ? 'necClm-Equp' :
          (kind === 'wep') ? 'wepClm-Equp' :
          (kind === 'amr') ? 'amrClm-Equp' : null;
        let cell = null;
        if (equipCls){
          cell = tr.querySelector(`td.${equipCls}`);
        }
        // 念のためフォールバック（多くのテーブルで2列目が「装」想定）
        if (!cell && tr.cells && tr.cells.length >= 2){
          cell = tr.cells[1];
        }
        if (!cell) return null;
        const a = cell.querySelector('a[href]'); // 最初のリンクを優先
        if (!a || !a.href) return null;
        // 典型的なパターンを網羅
        const href = a.href;
        // .../equip/12345, .../item/12345, ?id=12345, ?item=12345 など
        const m =
          href.match(/(?:equip|item|id)[=/](\d+)/i) ||
          href.match(/[?&](?:id|item)=(\d+)/i);
        return m ? m[1] : null;
      }catch(_){
        return null;
      }
    }

    // 〓〓〓 名称列と装備列の間にアイテムIDを表示 〓〓〓
    const cbItemId = document.createElement('input'); cbItemId.type='checkbox';
    cbItemId.id = 'dbe-prm-panel0-check-display-ItemID';
    // 既定OFF。readBool が無い環境でも落ちないように try/catch
    try { cbItemId.checked = typeof readBool === 'function' ? readBool('displayItemId') : false; } catch { cbItemId.checked = false; }

    // 初期適用（テーブル未構築でも安全に無視される）
    if (cbItemId.checked) toggleItemIdColumn(true);

    cbItemId.addEventListener('change', ()=>{
      const on = cbItemId.checked;
      try { if (typeof writeBool === 'function') writeBool('displayItemId', on); } catch {}
      toggleItemIdColumn(on);
    });

    const rowItemId = document.createElement('label');
    rowItemId.style.display='flex'; rowItemId.style.gap='8px'; rowItemId.style.alignItems='center';
    rowItemId.append(cbItemId, document.createTextNode('名称列と装備列の間にアイテムIDを表示する'));
    secSettings.appendChild(rowItemId);

    // -- 解析失敗の見える化（❓付与） ---
    const cbElemUnknown = document.createElement('input');
    cbElemUnknown.type = 'checkbox';
    cbElemUnknown.id   = 'dbe-prm-elem-unknown-include';
    cbElemUnknown.checked = readBoolById(cbElemUnknown.id); // 既定 false（DBE_KEYS）

    cbElemUnknown.addEventListener('change', ()=>{
      localStorage.setItem(cbElemUnknown.id, String(cbElemUnknown.checked));
    });

    const rowElemUnknown = document.createElement('label');
    rowElemUnknown.style.display = 'flex';
    rowElemUnknown.style.gap = '8px';
    rowElemUnknown.style.alignItems = 'center';
    rowElemUnknown.append(cbElemUnknown, document.createTextNode('解析失敗した装備に❓を付与する'));

    secSettings.appendChild(rowElemUnknown);

    // --- 分解アラート設定UI（Recycle セクションへ） ---
    const secRecycl_Button    = document.createElement('div');
    secRecycl_Button.style.cssText = 'margin:0px;padding:8px;border:1px solid #666;border-radius:8px';
    secRecycl_Button.id = 'dbe-recycle-bulk-alert';  // ← アンカーとして識別できるよう ID を付与
    // タイトル「全て分解」まきこみアラート
    const secRecycl_title  = document.createElement('div');
    secRecycl_title.textContent = '「全て分解」まきこみアラート';
    secRecycl_title.style.cssText = 'margin:4px 0;padding:0;font-size:1.1em;font-weight:bold';
    // グレードチェックボックス
    const secRecycl_alert_grade   = document.createElement('div');
    secRecycl_alert_grade.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;margin:0 12px 0 16px';
    { const defs = {'プラチナ':'Pt','金':'Au','銀':'Ag','青銅':'CuSn','銅':'Cu'};
      for(const [label,val] of Object.entries(defs)){
        const ck = document.createElement('input'); ck.type  = 'checkbox'; ck.value = val; ck.id    = `alert-grade-${val}`;
        ck.checked = localStorage.getItem(ck.id) === 'true';
        const lb = document.createElement('label'); lb.append(ck, document.createTextNode(' '+label));
        secRecycl_alert_grade.appendChild(lb);
        ck.addEventListener('change', ()=>{ localStorage.setItem(ck.id, ck.checked); });
      }
    }
    // レアリティチェックボックス
    const secRecycl_alert_rarity = document.createElement('div');
    secRecycl_alert_rarity.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;margin:0 12px 0 16px';
    for(const rk of ['UR','SSR','SR','R','N']){
      const ck = document.createElement('input'); ck.type  = 'checkbox'; ck.value = rk; ck.id    = `alert-rarity-${rk}`;
      ck.checked = localStorage.getItem(ck.id) === 'true';
      const lb = document.createElement('label'); lb.append(ck, document.createTextNode(' '+rk)); secRecycl_alert_rarity.appendChild(lb);
      ck.addEventListener('change', ()=>{ localStorage.setItem(ck.id, ck.checked); });
    }
    secRecycl_Button.appendChild(secRecycl_alert_grade);
    secRecycl_Button.appendChild(secRecycl_alert_rarity);
    secRecycl_Button.appendChild(secRecycl_title);
    secRecycle.appendChild(secRecycl_Button);

    // --- 「全て分解する」ボタン（アラート枠の内側へ） ---
    const allForm=document.createElement('form');
    allForm.action='https://donguri.5ch.net/recycleunlocked'; allForm.method='POST';
    const allBtn=document.createElement('button');
    allBtn.type='submit';
    allBtn.textContent='ロックされていないアイテムを全て分解する';
    allBtn.style.cssText='fontSize:0.9em; padding:4px 8px; margin:12px 0 4px 0;';
    allForm.appendChild(allBtn);
    secRecycl_Button.appendChild(allForm);

    // 〓〓〓 ナビ（ウィンドウ用：タイトル独立＋縦並び＋幅7em） 〓〓〓
    // タイトル（flex から分離）
    const navTitle = document.createElement('div');
    navTitle.textContent = 'ナビゲーション';
    navTitle.style.cssText = 'margin:4px auto 4px 8px;padding:0;white-space:nowrap;font-size:1.1em;font-weight:bold;';
    secNav.appendChild(navTitle);

   // ボタン群（縦並び）
    const navList = document.createElement('div');
    navList.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:flex-start;';
    secNav.appendChild(navList);

    const mkBtn = (label, onClick) => {
      const b = document.createElement('button');
      b.textContent = label;
      Object.assign(b.style, {
        width: '12em',
        margin: '8px auto',
        padding: '4px auto',
        textAlign: 'center',
        fontSize: '0.95em'
      });
      b.addEventListener('click', onClick);
      return b;
    };

    // PageTOP
    navList.appendChild(
      mkBtn('PageTOP', ()=>window.scrollTo({top:0, behavior:'smooth'}))
    );
    // セクションボタン
    for (const o of [
      { text:'ネックレス', id:'necklaceTitle' },
      { text:'武器',       id:'weaponTitle'   },
      { text:'防具',       id:'armorTitle'    },
    ]) {
      navList.appendChild(
        mkBtn(o.text, ()=>{
          const el = document.getElementById(o.id);
          if (el) el.scrollIntoView({behavior:'smooth', block:'start'});
        })
      );
    }
    // panel へ配置
    menu.appendChild(secNav);

    const link = document.createElement('div'); link.style.fontSize='0.8em';
      link.innerHTML = [ `Donguri Bag Enhancer ver ${DBE_VERSION}` ];
    secAbout.appendChild(link);

    // 「どんぐり転送サービス」リンククリック時にフラグをセット
    const transferLink = link.querySelector('#donguriTransferLink');
    if (transferLink) {
      transferLink.addEventListener('click', () => {
        localStorage.setItem('donguriAutoTransfer', 'bb97c8d2');
      });
    }

    // （旧ハンバーガーUIは廃止のため、menu を DOM に追加しない）
    // セクションを各 dbe-W-* に直載せ（secNav は Navi、Recycle/Settings は各ウィンドウ）
    ensureWindowShell('dbe-W-Settings').append(secSettings, secAbout);
    ensureWindowShell('dbe-W-Recycle').append(secRecycle);
    ensureWindowShell('dbe-W-Navi').append(secNav);
    // 初期描画直後に同期
    syncMenuFromStorage();
  } // ← initMenu の閉じ

  // 〓〓〓 Z-Index 前面制御（共通ユーティリティ） 〓〓〓
  //   - 新規に前面化が必要なときは dbeBringToFront(wnd) を呼ぶ
  //   - __DBE_Z_NEXT はグローバルな採番カウンタ
  function dbeIsWindowVisible(el){
    try{
      if (!el) return false;
      const cs = getComputedStyle(el);
      return !!cs && cs.display !== 'none' && cs.visibility !== 'hidden';
    }catch(_){
      return false;
    }
  }
  // dbe-W-Chest と dbe-W-ChestProgress が同時表示中は、常に Progress を前面に保つ
  function dbeEnsureChestProgressOnTop(){
    try{
      const chest = document.getElementById('dbe-W-Chest');
      const prog  = document.getElementById('dbe-W-ChestProgress');
      if (!chest || !prog) return;
      if (!dbeIsWindowVisible(chest) || !dbeIsWindowVisible(prog)) return;

      const zChest = parseInt(getComputedStyle(chest).zIndex||'0',10);
      const zProg  = parseInt(getComputedStyle(prog ).zIndex||'0',10);
      if (!isNaN(zChest) && !isNaN(zProg) && zProg > zChest) return;

      const z = ((window.__DBE_Z_NEXT = (window.__DBE_Z_NEXT||1000001) + 10));
      window.__DBE_Z_WINDOW_MAX = Math.max(window.__DBE_Z_WINDOW_MAX||1000000, z);
      prog.style.zIndex = String(z);
      prog.dataset.dbeFronted = '1';
      chestDiag('ensureChestProgressOnTop: fronted dbe-W-ChestProgress', '→ zIndex=', z);
    }catch(_){}
  }
  function dbeBringToFront(wnd){
    try{
      if (/^dbe-W-/.test(wnd.id||'')){
        const z = ((window.__DBE_Z_NEXT = (window.__DBE_Z_NEXT||1000001) + 10));
        window.__DBE_Z_WINDOW_MAX = Math.max(window.__DBE_Z_WINDOW_MAX||1000000, z);
        wnd.style.zIndex = String(z);
        wnd.dataset.dbeFronted = '1';
        chestDiag('bringToFront: window', wnd.id, '→ zIndex=', z);
      } else {
        // ダイアログは専用帯域で前面化
        dbeBringDialogToFront(wnd);
      }
    }catch(_){}
    // 例外ルール：宝箱ウィンドウより進行ウィンドウを常に前面へ
    try{ dbeEnsureChestProgressOnTop(); }catch(_){}
  }

  // 〓〓〓 《dbe-W-*》の表示切替を監視して自動前面化 〓〓〓
  //   - openRulesModal 等、外部実装で開くウインドウも対象にするためのフォールバック
  function dbeInstallWindowFrontingObserver(){
    try{
      if (!window.MutationObserver) return;
      // 属性変化（style/class）監視：display が「none → 可視」になった最初の1回だけ前面化
      const watchAttrs = (el)=>{
        try{
          if (!el || !el.id || !/^dbe-W-/.test(el.id)) return;
          const mo = new MutationObserver((_muts)=>{
            try{
              const disp = getComputedStyle(el).display;
              if (disp && disp !== 'none') {
                // 可視化された直後の1回だけ前面化（ループ抑止のためフラグで制御）
                if (el.dataset.dbeFronted !== '1') {
                  el.dataset.dbeFronted = '1';
                  dbeBringToFront(el);
                  chestDiag('frontingObserver: shown -> fronted', el.id);
                }
              } else {
                // 非表示になったらフラグ解除（次回の可視化で再び1回だけ前面化）
                if (el.dataset.dbeFronted === '1') delete el.dataset.dbeFronted;
                chestDiag('frontingObserver: hidden', el.id);
              }
            }catch(_){}
          });
          mo.observe(el, { attributes:true, attributeFilter:['style','class'] });
        }catch(_){}
      };
      // 既存の dbe-W-* を監視に載せる
      document.querySelectorAll('[id^="dbe-W-"]').forEach(watchAttrs);
      // 追加された要素も拾う
      const moAdd = new MutationObserver((muts)=>{
        muts.forEach(mu=>{
          (mu.addedNodes||[]).forEach(n=>{
            if (n && n.nodeType===1 && n.id && /^dbe-W-/.test(n.id)){
              watchAttrs(n);
              // 追加直後に可視なら直ちに前面化
              try{
                const disp = getComputedStyle(n).display;
                if (disp && disp !== 'none') {
                  if (n.dataset.dbeFronted !== '1') {
                    n.dataset.dbeFronted = '1';
                    dbeBringToFront(n);
                  }
                  chestDiag('frontingObserver(add): appended & visible', n.id);
                } else {
                  if (n.dataset.dbeFronted === '1') delete n.dataset.dbeFronted;
                  chestDiag('frontingObserver(add): appended but hidden', n.id);
                }
              }catch(_){}
            }
          });
        });
      });
      // 直接 body 配下に追加される dbe-W-* だけを監視（過剰な全サブツリー監視を抑止）
      moAdd.observe(document.body, { childList:true, subtree:false });
    }catch(_){}
  }

  // ============================================================
  // ▽追加▽ 宝箱：進行ウインドウ＆ログ
  // ============================================================
  (function(){
    // Rarity/Grade カラー（文字色に適用）
    const RAR_COLOR = { UR:'#F45D01', SSR:'#A633D6', SR:'#1E88E5', R:'#2E7D32', N:'#9E9E9E' };
    const GRD_COLOR = { Pt:'#F45D01', Au:'#A633D6', Ag:'#1E88E5', CuSn:'#2E7D32', Cu:'#9E9E9E' };
    const TYPE_LABEL = { normal:'標準の宝箱', large:'大型の宝箱', battle:'バトル宝箱' };

    function dbeEnsureChestProgressUI(){
      const wnd = ensureWindowShell('dbe-W-ChestProgress');
      // 見た目：主要ウインドウスキン
      wnd.classList.add('windowsCommon');
      // 右上の「×」は使わない（閉じるは下部ボタンのみ）
      (function(){
        const closeBtn = wnd.firstElementChild;
        if (closeBtn && closeBtn.tagName === 'BUTTON'){
          closeBtn.style.display = 'none';
          closeBtn.disabled = true;
        }
      })();
      // 本体再構築（×ボタン以外クリア）
      Array.from(wnd.children).forEach((ch,i)=>{ if(i>0) ch.remove(); });
      const wrap = document.createElement('div');
      Object.assign(wrap.style,{display:'grid',gap:'0.8em',minWidth:'min(70svw,480px)'});

      // タイトル
      const ttl = document.createElement('div');
      ttl.textContent = '宝箱の自動処理（進行状況）';
      ttl.style.cssText = 'font-size:1.15em;font-weight:700;';
      wrap.appendChild(ttl);

      // 対象＆回数
      const box = document.createElement('div');
      Object.assign(box.style,{display:'grid',gridTemplateColumns:'max-content 1fr',columnGap:'12px',rowGap:'6px',alignItems:'center'});
      const r1l = document.createElement('div'); r1l.textContent = '対象：'; r1l.style.fontWeight='700';
      const r1v = document.createElement('div'); r1v.id='dbe-chestprog-type';
      const r2l = document.createElement('div'); r2l.textContent = '回数：'; r2l.style.fontWeight='700';
      const r2v = document.createElement('div'); r2v.id='dbe-chestprog-count';
      box.append(r1l,r1v,r2l,r2v);
      wrap.appendChild(box);

      // 入手した高位装備のログ（固定高・スクロール）
      const logTitle = document.createElement('div');
      logTitle.textContent = '入手した高位装備のログ（Pt・Au・UR・SSR）：';
      logTitle.style.cssText='font-weight:700;margin-top:4px;';
      const log = document.createElement('div');
      log.id = 'dbe-chestprog-log';
      Object.assign(log.style,{
        border:'1px solid #999', borderRadius:'8px',
        padding:'0.4em 0.8em', background:'#fff',
        height:'8em', overflow:'auto', lineHeight:'1.1em'
      });
      wrap.append(logTitle, log);

      // 操作
      const ops = document.createElement('div');
      Object.assign(ops.style,{display:'flex',justifyContent:'center',gap:'18px',marginTop:'6px'});
      const btnAbort = document.createElement('button');
      btnAbort.id='dbe-chestprog-abort';
      btnAbort.textContent='中断する';
      Object.assign(btnAbort.style,{padding:'6px 14px',border:'2px solid #930000',borderRadius:'8px',background:'#FFE9E9',cursor:'pointer'});
      const btnClose = document.createElement('button');
      btnClose.id='dbe-chestprog-close';
      btnClose.textContent='閉じる';
      Object.assign(btnClose.style,{padding:'6px 14px',border:'2px solid #006600',borderRadius:'8px',background:'#E9FFE9',cursor:'default',opacity:'0.5'});
      btnClose.disabled = true; // 処理中は無効
      ops.append(btnAbort, btnClose);
      wrap.appendChild(ops);

      wnd.appendChild(wrap);
      chestDiag('progressUI: built content for', wnd.id);

      // ▼自動クローズ抑止：ユーザーが「閉じる」を押すまで開いたままにするガード
      //   - display が外部要因で none にされたら、ユーザー操作以外は即座に復元する
      try{
        const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
        if (window.MutationObserver){
          if (wnd.__dbe_keep_open_observer) { try{ wnd.__dbe_keep_open_observer.disconnect(); }catch(_){ } }
          const ob = new MutationObserver(()=>{
            try{
              const disp = getComputedStyle(wnd).display;
              // ユーザー操作以外で隠された（display:none）場合は復元
              if (disp === 'none' && !DBE_CHEST._userClosing){
                wnd.style.display = 'inline-block';
                dbeBringToFront(wnd);
                chestDiag('keep-open: prevented unexpected close, restored window');
              }
            }catch(_){}
          });
          ob.observe(wnd, { attributes:true, attributeFilter:['style','class'] });
          wnd.__dbe_keep_open_observer = ob;
          // 追加：ノードごと削除された場合の復活（document.body を監視）
          if (wnd.__dbe_keep_open_bodyObserver) { try{ wnd.__dbe_keep_open_bodyObserver.disconnect(); }catch(_){ } }
          const bodyOb = new MutationObserver(()=>{
            try{
              const alive = document.getElementById('dbe-W-ChestProgress');
              if (!alive && !DBE_CHEST._userClosing){
                chestDiag('keep-open: node removed -> re-create');
                const nw = dbeEnsureChestProgressUI();
                nw.style.display = 'inline-block';
                dbeBringToFront(nw);
              }
            }catch(_){}
          });
          bodyOb.observe(document.body, { childList:true, subtree:true });
          wnd.__dbe_keep_open_bodyObserver = bodyOb;
        }
      }catch(_){}

      // ハンドラ
      btnAbort.onclick = ()=>{
        const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
        DBE_CHEST._userAbort = true; // 次の宝箱実行を抑止
        btnAbort.textContent = '中断します…';
        btnAbort.disabled = true;
        btnAbort.style.opacity = '0.6';
      };
      btnClose.onclick = ()=>{
        // 安全に閉じる
        try{ (window.DBE_CHEST = window.DBE_CHEST || {})._userClosing = true; }catch(_){}
        wnd.style.display='none';
        try{ dbeHideOverlay(); }catch(_){}
        chestDiag('progressUI: close clicked');
        // ▼ 念のため：停止後に内部状態が残っても次回実行を阻害しないよう、ここでも解放しておく
        //   （ng<>too fast 等で handleServerErrorAndStopFlow が動いたケースの保険）
        try{
          const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
          // 進行タイマー停止
          clearInterval(DBE_CHEST._progressTimer); DBE_CHEST._progressTimer = null;
          // HUD停止
          try{ if (typeof stopProgressHud === 'function') stopProgressHud(); }catch(_){}
          // 列表示状態を復元（強制ONの解除）
          try{ __dbeRestoreColsAfterRun(); }catch(_){}
          // ループ/実行中フラグの解放
          DBE_CHEST.left         = 0;
          DBE_CHEST.unlimited    = false;
          DBE_CHEST._autoRunning = false;
          DBE_CHEST.didWork      = false;
          DBE_CHEST.stage        = 'idle';
          DBE_CHEST.busy         = false;
          // 次回実行で lootObserver が再アタッチできるように
          DBE_CHEST._lootObserved = false;
          // エラー状態もクリア（次回 start で再初期化されるが、残留防止）
          DBE_CHEST._serverError = false;
        }catch(_){}
        // ユーザー閉鎖フラグは少し後で解除（再オープン時の誤判定を避ける）
        setTimeout(()=>{ try{ (window.DBE_CHEST = window.DBE_CHEST || {})._userClosing = false; }catch(_){} }, 0);
        // ▼ ハードリロードの実行タイミングを「閉じる」押下時に集約
        try{
          if (window.__DBE_RELOAD_GUARD && typeof window.__DBE_RELOAD_GUARD.disable==='function'){
            window.__DBE_RELOAD_GUARD.disable({ executePending:true });
          }
        }catch(_){}
      };
      return wnd;
    }

    function dbeSetProgressHeader(type){
      const t = document.getElementById('dbe-chestprog-type');
      if (t) t.textContent = TYPE_LABEL[type] || String(type||'');
    }
    function dbeUpdateCount(){
      const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
      const el = document.getElementById('dbe-chestprog-count');
      if (!el) return;
      const done = Number(DBE_CHEST.processed||0);
      if (DBE_CHEST.unlimited){
        el.textContent = `${done} 回 / 無制限`;
      } else {
        const tot = DBE_CHEST._totalPlanned ?? 0;
        el.textContent = `${done} 回 / ${tot} 回`;
      }
    }

    // ──────────────────────────────────────────────
    // 分子カウント：実際に「宝箱を開ける」送信を行ったタイミングで加算する
    //  - 大型宝箱は 1回の送信で 10回相当として +10
    //  - URL監視の自動カウント(dbeChestMaybeCount)は _countFromUrl=true のときのみ有効
    // ──────────────────────────────────────────────
    function dbeChestOpenStep(){
      try{
        const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
        return (DBE_CHEST.type === 'large') ? 10 : 1;
      }catch(_){ return 1; }
    }
    function dbeChestBumpProcessed(step, src, url){
      try{
        const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
        const n = Number(step||0);
        if (!n) return;
        DBE_CHEST.processed = (Number(DBE_CHEST.processed||0) + n);
        dbeUpdateCount();
        chestDiag('ChestCount('+(src||'open')+'): +'+n, url || '');
      }catch(_){}
    }

    // ──────────────────────────────────────────────
    // 事前選別：手持ち（未施錠）のみ対象に、フィルタカードを上から適用 → 施錠/分解/保留（onHold付与）
    // 完了後に cb() を呼び出す。既存のキュー実行(schedLock→schedRecycle)を使う。
    // ──────────────────────────────────────────────
    function dbePreselectCurrentUnlockedOnce(cb){
      const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
      try{
        // 二重起動ガード
        if (DBE_CHEST._preselectBusy){ cb && cb(); return; }
        DBE_CHEST._preselectBusy = true;
        // キュー初期化
        DBE_CHEST.qLock    = Array.isArray(DBE_CHEST.qLock)? DBE_CHEST.qLock : [];
        DBE_CHEST.qRecycle = Array.isArray(DBE_CHEST.qRecycle)? DBE_CHEST.qRecycle : [];
        // 既存 onHold はクリア済みだが、保険で消しておく
        try{ document.querySelectorAll('tr.dbe-prm-Chest--onhold').forEach(tr=>tr.classList.remove('dbe-prm-Chest--onhold')); }catch(_){}
        // テーブル走査
        const sels = ['#weaponTable','#armorTable','#necklaceTable'];
        sels.forEach(sel=>{
          const table = document.querySelector(sel);
          if (!table || !table.tBodies || !table.tBodies[0]) return;
          const headerRow = table.tHead ? table.tHead.rows[0] : table.rows[0];
          if (!headerRow) return;
          // ヘッダ索引
          const idxMap = (typeof headerMap==='function') ? headerMap(table) : (()=>{
            const map = {};
            Array.from(headerRow.cells||[]).forEach((th,i)=>{
              const t = (th.textContent||'').trim();
              map[t] = i;
            });
            return map;
          })();
          const iLock = idxMap['解'];
          const iEqup = idxMap['装'];
          if (iLock==null || iEqup==null) return;
          const rows = Array.from(table.tBodies[0].rows||[]);
          rows.forEach(tr=>{
            try{
              // 未施錠（= 解列リンクが /lock/）
              const aLock = tr.cells[iLock]?.querySelector('a[href*="/lock/"]');
              if (!aLock) return;
              const aEq = tr.cells[iEqup]?.querySelector('a[href*="/equip/"]');
              const mId = aEq && aEq.href && aEq.href.match(/\/equip\/(\d+)/);
              const id  = mId ? mId[1] : null;
              if (!id) return;
              // ルール評価：既存の評価関数があれば利用（無ければ保留扱い）
              let decision = 'hold';
              try{
                if (typeof dbeDecideByFilterCards==='function'){
                  // 想定: dbeDecideByFilterCards(tr, kind) -> 'lock' | 'recycle' | 'hold'
                  const kind = sel.includes('weapon')?'weapon': sel.includes('armor')?'armor':'necklace';
                  decision = dbeDecideByFilterCards(tr, kind) || 'hold';
                }
              }catch(_){}
              if (decision === 'lock'){
                DBE_CHEST.qLock.push({id});
                try{ dbeChestLogActionById(id,'施錠'); }catch(_){}
              }else if (decision === 'recycle'){
                DBE_CHEST.qRecycle.push({id});
                try{ dbeChestLogActionById(id,'分解'); }catch(_){}
              }else{
                // 保留 = onHold マーキング付与
                tr.classList.add('dbe-prm-Chest--onhold');
                try{ dbeChestLogActionById(id,'保留'); }catch(_){}
              }
            }catch(_){}
          });
        });
        // キュー実行 → すべて空になったら解除して cb
        const done = ()=>{
          DBE_CHEST._preselectBusy = false;
          cb && cb();
        };
        // 既存のスケジューラを流用
        const waitDrain = ()=>{
          const busy = !!(DBE_CHEST._lockBusy || DBE_CHEST._recycleBusy);
          const hasQ = (DBE_CHEST.qLock && DBE_CHEST.qLock.length) || (DBE_CHEST.qRecycle && DBE_CHEST.qRecycle.length);
          if (!busy && !hasQ){ return done(); }
          setTimeout(waitDrain, 120);
        };
        try{
          if (DBE_CHEST.qLock.length){ scheduleNextLock(); }
          else if (DBE_CHEST.qRecycle.length){ scheduleNextRecycle(); }
        }catch(_){}
        waitDrain();
      }catch(_){
        try{ (cb && cb()); }catch(__){}
      }
    }

    // ──────────────────────────────────────────────
    // 追加：自動実行中のみ /chest /battlechest への実アクセスをカウントする共通関数
    //   - ネイティブ操作（自動実行外）ではカウントしない
    //   - 短時間デデュープ（同一URL連発の二重カウント抑止）
    //   - ProgressUI の表示を即時更新
    // ──────────────────────────────────────────────
    function dbeChestMaybeCount(url){
      try{
        const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
        // 自動実行プロセス中のみカウント
        if (!DBE_CHEST._autoRunning) return;
        // URL監視カウントは明示的に有効化された場合のみ
        if (!DBE_CHEST._countFromUrl) return;
        const u = String(url);
        if (!/\/(battlechest|chest)(?:[/?#]|$)/.test(u)) return;
        // デデュープ
        const recent = (DBE_CHEST._countDedup = DBE_CHEST._countDedup || new Set());
        const key = u + '@' + (Math.floor(Date.now()/250)); // 250msスロットで抑制
        if (recent.has(key)) return;
        recent.add(key);
        setTimeout(()=>{ try{ recent.delete(key); }catch(_){ } }, 3000);
        // 加算＆反映
        dbeChestBumpProcessed(1, 'auto', u);
      }catch(_){}
    }

    // ──────────────────────────────────────────────
    // 分子カウントフック：/chest /battlechest 送出時に +1
    //  - fetch / <a>.click() / <form>.submit() を監視
    //  - 連続送出の二重カウントを軽減（短時間デデュープ）
    // ──────────────────────────────────────────────
    function dbeInstallChestCountHooks(){
      const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
      if (DBE_CHEST._countHooksInstalled) return;
      DBE_CHEST._countHooksInstalled = true;
      const isChestUrl = (u)=>{
        try{
          if (!u) return false;
          const url = String(u);
          return /\/(battlechest|chest)(?:[/?#]|$)/.test(url);
        }catch(_){ return false; }
      };
      // fetch フック
      try{
        if (!DBE_CHEST._origFetch && typeof window.fetch === 'function'){
          DBE_CHEST._origFetch = window.fetch.bind(window);
          window.fetch = function(resource, init){
            try{
              const url = (typeof resource === 'string') ? resource : (resource && resource.url);
              if (isChestUrl(url)) dbeChestMaybeCount(url);
            }catch(_){}
            return DBE_CHEST._origFetch.apply(this, arguments);
          };
        }
      }catch(_){}
      // <a>.click() フック
      try{
        const AProto = window.HTMLAnchorElement && window.HTMLAnchorElement.prototype;
        if (AProto && !AProto.__dbeChestClickWrapped){
          const _orig = AProto.click;
          AProto.click = function(){
          const href = (this && this.href) ? String(this.href) : '';
            try{
              if (isChestUrl(href)) dbeChestMaybeCount(href);
            }catch(_){}
            return _orig.apply(this, arguments);
          };
          AProto.__dbeChestClickWrapped = true;
        }
      }catch(_){}
      // <form>.submit() フック
      try{
        const FProto = window.HTMLFormElement && window.HTMLFormElement.prototype;
        if (FProto && !FProto.__dbeChestSubmitWrapped){
          const _orig = FProto.submit;
          FProto.submit = function(){
            try{
              const action = this && this.action;
              if (isChestUrl(action)) dbeChestMaybeCount(action);
            }catch(_){}
            return _orig.apply(this, arguments);
          };
          FProto.__dbeChestSubmitWrapped = true;
        }
      }catch(_){}
      // ──────────────────────────────────────────────
      // 追加：ユーザーのネイティブ操作も確実に拾うための捕捉リスナー
      //  - ユーザーが素で <a> をクリックして遷移するケース
      //  - ユーザーがボタンでフォーム送信する（= Form#submit は呼ばれない）ケース
      // キャプチャ段階で拾い、離脱前に分子を +1 しておく
      // ──────────────────────────────────────────────
      try{
        if (!DBE_CHEST._docClickCountHooked){
          document.addEventListener('click', function(ev){
            try{
              const t = ev.target;
              const a = t && (t.closest ? t.closest('a[href]') : null);
              const href = a && a.href;
              if (href && isChestUrl(href)) dbeChestMaybeCount(href);
            }catch(_){}
          }, true); // capture
          DBE_CHEST._docClickCountHooked = true;
        }
      }catch(_){}
      try{
        if (!DBE_CHEST._docSubmitCountHooked){
          document.addEventListener('submit', function(ev){
            try{
              const f = ev && ev.target;
              const action = f && f.action;
              if (action && isChestUrl(action)) dbeChestMaybeCount(action);
            }catch(_){}
          }, true); // capture
          DBE_CHEST._docSubmitCountHooked = true;
        }
      }catch(_){}
    }

    function dbeAppendLog(htmlOrText){
      let log = document.getElementById('dbe-chestprog-log');
      // ログ枠が未生成なら ChestProgressUI を確実に生成してから取得を再試行
      if (!log){
        try{
          const wnd = dbeEnsureChestProgressUI(); // 生成 or 取得
          if (wnd) log = document.getElementById('dbe-chestprog-log');
        }catch(_){}
      }
      if (!log){
        console.warn('[DBE][ChestProg] log mount missing: #dbe-chestprog-log');
        return;
      }
      const line = document.createElement('div');
      line.style.whiteSpace = 'pre-wrap'; // 折返し安全
      if (/<[a-z][\s\S]*>/i.test(htmlOrText)) line.innerHTML = htmlOrText;
      else line.textContent = htmlOrText;
      log.appendChild(line);
      // スクロール最下部へ
      log.scrollTop = log.scrollHeight;
    }

    // ──────────────────────────────────────────────
    // onHold（= 保留）付与を検知してログを吐くオブザーバ
    //  - 出力対象は Pt/Au（ネックレス）、UR/SSR（武器/防具）のみ
    //  - 同一IDの重複ログは抑止
    // ──────────────────────────────────────────────
    function dbeInstallOnHoldLogObserver(){
      try{
        const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
        if (DBE_CHEST._onholdObs) return; // 多重装着ガード
        const posted = (DBE_CHEST._onholdLogged = DBE_CHEST._onholdLogged || new Set());
        const getIdFromRow = (tr)=>{
          try{
            const a = tr.querySelector('a[href*="/equip/"]');
            const m = a && a.href && a.href.match(/\/equip\/(\d+)/);
            return m ? m[1] : null;
          }catch(_){ return null; }
        };
        const onRow = (tr)=>{
          if (!tr || !tr.classList || !tr.classList.contains('dbe-prm-Chest--onhold')) return;
          const id = getIdFromRow(tr);
          if (!id || posted.has(id)) return;
          posted.add(id);
          try{ dbeChestLogActionById(id, '保留'); }catch(_){}
        };
        const obs = new MutationObserver((muts)=>{
          try{
            muts.forEach(mu=>{
              if (mu.type === 'attributes' && mu.target && mu.attributeName==='class'){
                onRow(mu.target);
              }
              (mu.addedNodes||[]).forEach(n=>{
                if (n && n.nodeType===1){
                  if (n.matches && n.matches('tr.dbe-prm-Chest--onhold')) onRow(n);
                  // サブツリー内も走査
                  if (n.querySelectorAll){
                    n.querySelectorAll('tr.dbe-prm-Chest--onhold').forEach(onRow);
                  }
                }
              });
            });
          }catch(_){}
        });
        obs.observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:['class'] });
        DBE_CHEST._onholdObs = obs;
      }catch(_){}
    }

    // ──────────────────────────────────────────────
    //  アクションログ出力のための判定＆取得ヘルパ（詳細ログ切替は廃止）
    //    - ネックレス: Pt/Au のみ
    //    - 武器/防具 : UR/SSR のみ
    // ──────────────────────────────────────────────
    function dbeChestIsDetailLogOn(){
      // 互換維持のため残置（常に false）
      return false;
    }
    function dbeChestShouldLogAction(info){
      try{
        if (!info) return false;
        if (info.kind === 'necklace') return (info.gradeKey === 'Pt' || info.gradeKey === 'Au');
        if (info.kind === 'weapon' || info.kind === 'armor') return (info.rarity === 'UR' || info.rarity === 'SSR');
        return false;
      }catch(_){ return false; }
    }
    function dbeChestFindRowInfoByItemIdInMain(id){
      try{
        id = String(id||'').trim();
        if (!id) return null;
        const sels = ['#weaponTable','#armorTable','#necklaceTable'];
        for (const sel of sels){
          const table = document.querySelector(sel);
          if (!table || !table.tBodies || !table.tBodies[0]) continue;
          const rows = Array.from(table.tBodies[0].rows||[]);
          for (const tr of rows){
            const a = tr.querySelector('a[href*="/equip/"]');
            const m = a && a.href && a.href.match(/\/equip\/(\d+)/);
            if (m && m[1] === id){
              let nameTd = Array.from(tr.cells||[]).find(td => td.querySelectorAll('span').length >= 2) || tr.cells?.[0] || null;
              let meta = null;
              try{ meta = (typeof dbeParseNameTd==='function') ? dbeParseNameTd(nameTd) : null; }catch(_){}
              const name = (meta?.name) || (nameTd?.textContent||'').trim() || `ID:${id}`;
              return {
                name,
                kind     : meta?.kind || (sel.includes('weapon')?'weapon':sel.includes('armor')?'armor':'necklace'),
                rarity   : meta?.rarity || null,
                gradeKey : meta?.gradeKey || null,
                number   : meta?.number || null
              };
            }
          }
        }
      }catch(_){}
      return null;
    }
    function dbeChestLogActionById(id, actionJa){
      try{
        const info = dbeChestFindRowInfoByItemIdInMain(id);
        if (!info) return;
        if (!dbeChestShouldLogAction(info)) return;
        if (info.kind === 'necklace'){
          dbeAppendLog(`${dbeLootLineNecklace(info.name, info.gradeKey, info.number)} を ${actionJa} しました`);
        } else {
          dbeAppendLog(`${dbeLootLineEquip(info.name, info.rarity)} を ${actionJa} しました`);
        }
      }catch(_){}
    }

    function dbeLootLineNecklace(name, gradeKey, numberStr){
      const color = GRD_COLOR[gradeKey] || '#333';
      const suffix = (typeof numberStr!=='undefined' && numberStr!==null) ? String(numberStr) : '';
      return `<span style="color:${color}">${name} [${gradeKey}${suffix}]</span>`;
    }
    function dbeLootLineEquip(name, rarity){
      const color = RAR_COLOR[rarity] || '#333';
      return `<span style="color:${color}">${name} [${rarity}]</span>`;
    }
    // --- DOM 解析ヘルパ：名称セル(td)から種別／名称／グレード/レアを抽出 ---
    function dbeParseNameTd(td){
      try{
        // 想定構造：<td> <span style="font-weight:600;">名前</span><br>
        //               <span style="font-size:0.7em;">【種別】 [Pt6|Au5|UR|SSR]</span> </td>
        const spans = td.querySelectorAll('span');
        if (spans.length < 2) return null;
        const name = (spans[0].textContent || '').trim();
        const meta = (spans[1].textContent || '').trim();
        // ネックレス（Pt/Au + 数字）
        let m = meta.match(/【\s*ネックレス\s*】\s*\[\s*(Pt|Au)\s*(\d+)\s*\]/);
        if (m){
          return { kind:'necklace', gradeKey:m[1], number:m[2], name };
        }
        // 武器/防具（UR/SSR）
        m = meta.match(/【\s*(武器|防具)\s*】\s*\[\s*(UR|SSR|SR|R|N)\s*\]/);
        if (m){
          const jkind = m[1]; const rarity = m[2];
          const kind = (jkind === '武器') ? 'weapon' : 'armor';
          return { kind, name, rarity };
        }
        return null;
      }catch(_){ return null; }
    }
    // --- DOM 解析：iframe 内の「onlyNew」マーキング行だけを走査して対象をログ出力 ---
    function dbeScanAndLogLoot(doc){
      try{
        if (!doc) return;
        // 対象テーブルに限定して「onlyNew」が付与された行だけを拾う
        const tables = ['#weaponTable','#armorTable','#necklaceTable']
          .map(sel => doc.querySelector(sel))
          .filter(Boolean);
        const rows = tables.flatMap(tbl => Array.from(tbl.tBodies?.[0]?.rows || []))
          .filter(tr => tr.classList?.contains('onlyNew'));
        for (const tr of rows){
          // 名前セルは「span×2（名前/メタ）」を含む td を優先、無ければ先頭セル
          const nameTd = Array.from(tr.cells || []).find(td => td.querySelectorAll('span').length >= 2)
                        || tr.cells?.[0] || null;
          if (!nameTd) continue;
          const info = dbeParseNameTd(nameTd);
          if (!info) continue;
          // ネックレス：Pt/Au のみを出力
          if (info.kind === 'necklace'){
            if (info.gradeKey === 'Pt' || info.gradeKey === 'Au'){
              dbeAppendLog(dbeLootLineNecklace(info.name, info.gradeKey, info.number));
              chestDiag && chestDiag('lootObserver: logged necklace', info);
            }
            continue;
          }
          // 武器/防具：UR/SSR のみを出力
          if ((info.kind === 'weapon' || info.kind === 'armor') &&
              (info.rarity === 'UR' || info.rarity === 'SSR')){
            dbeAppendLog(dbeLootLineEquip(info.name, info.rarity));
            chestDiag && chestDiag('lootObserver: logged equip', info);
          }
        }
      }catch(_){}
    }
    // 取得結果（iframe）監視：ロード毎に DOM を解析してログ出力
    function dbeAttachLootObserver(){
      const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
      if (!DBE_CHEST.iframe || DBE_CHEST._lootObserved) return;
      try{
        const ifr = DBE_CHEST.iframe;
        chestDiag('lootObserver: attach to iframe');
        const onload = ()=>{
          try{
            const doc = ifr.contentDocument || ifr.contentWindow?.document;
            if (!doc) return;
            dbeScanAndLogLoot(doc);
            chestDiag('lootObserver: iframe load -> scanned');
          }catch(_){}
        };
        ifr.removeEventListener('load', onload);
        ifr.addEventListener('load', onload);
        DBE_CHEST._lootObserved = true;
        chestDiag('lootObserver: attached OK');
      }catch(_){}
    }
    // 進行UIの開始／終了制御
    function dbeStartProgressUI(type){
      const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
      const wnd = dbeEnsureChestProgressUI();
      dbeSetProgressHeader(type);
      dbeUpdateCount();
      // 進行中：閉じる無効（オーバーレイは使用しない）
      wnd.style.display='inline-block';
      dbeBringToFront(wnd);
      chestDiag('progressUI: START', {type, unlimited:DBE_CHEST.unlimited, total:DBE_CHEST._totalPlanned});
      // ▼ ハードリロード抑止を有効化（finish で要求されても保留し、「閉じる」で実行）
      try{ if (window.__DBE_RELOAD_GUARD && typeof window.__DBE_RELOAD_GUARD.enable==='function'){ window.__DBE_RELOAD_GUARD.enable(); } }catch(_){}
      // カウントアップは「left」の減少を監視して逆算
      let prevLeft = DBE_CHEST.left;
      clearInterval(DBE_CHEST._progressTimer);
      DBE_CHEST._progressTimer = setInterval(()=>{
        try{
          dbeAttachLootObserver();
          // 分子は「送出時」に加算済み。ここでは表示更新のみ。
          dbeUpdateCount();
        }catch(_){}
      }, 300);
    }
    // 公開：他所からも開始UIを呼べるように
    window.DBE_StartProgressUI = dbeStartProgressUI;

    function dbeFinishProgressUI(){
      const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
      clearInterval(DBE_CHEST._progressTimer); DBE_CHEST._progressTimer = null;
      // (12) 正常終了メッセージ（ユーザー中断／サーバーエラー時は表示しない）
      try{
        if (!DBE_CHEST._userAbort && !DBE_CHEST._serverError){
          dbeAppendLog('プロセスは正常に終了しました');
        }
      }catch(_){}
      // 「閉じる」を有効化、オーバーレイは解除（ページ操作を解放）
      try{
        const btnClose = document.getElementById('dbe-chestprog-close');
        if (btnClose){ btnClose.disabled = false; btnClose.style.opacity='1'; btnClose.style.cursor='pointer'; }
      }catch(_){}
      // オーバーレイは使用しない
      // 自動では閉じない：ウインドウは表示を維持し、ユーザーが「閉じる」を押すまで残す
      try{
        const wnd = document.getElementById('dbe-W-ChestProgress');
        if (wnd){ wnd.style.display = 'inline-block'; }
      }catch(_){}
      chestDiag('progressUI: FINISH (close enabled, window kept open)');
    }
    // 公開：他所からも終了UIを畳めるように
    window.DBE_FinishProgressUI = dbeFinishProgressUI;

    // ──────────────────────────────────────────────
    //  ハードリロード抑止ガード
    //    - start 時に enable()
    //    - 「閉じる」押下時に disable({executePending:true})
    //    - 外部が location.reload() を呼んでも保留
    // ──────────────────────────────────────────────
    (function(){
      if (window.__DBE_RELOAD_GUARD) return; // 多重定義防止
      const guard = {
        _enabled:false,
        _pending:false,
        _origReload:null,
        _origReplace:null,
        _origAssign:null,
        enable(){
          if (this._enabled) return;
          this._enabled = true;
          // reload をフック
          try{
            if (!this._origReload) this._origReload = window.location.reload.bind(window.location);
            const self = this;
            window.location.reload = function(){
              self._pending = true;
              chestDiag('reload-guard: captured location.reload() -> pending');
            };
          }catch(_){}
          // replace/assign も代表的にフック（完全ではないが多くのケースを吸収）
          try{
            if (!this._origReplace) this._origReplace = window.location.replace.bind(window.location);
            const self = this;
            window.location.replace = function(){
              self._pending = true;
              chestDiag('reload-guard: captured location.replace(...) -> pending');
            };
          }catch(_){}
          try{
            if (!this._origAssign) this._origAssign = window.location.assign.bind(window.location);
            const self = this;
            window.location.assign = function(){
              self._pending = true;
              chestDiag('reload-guard: captured location.assign(...) -> pending');
            };
          }catch(_){}
        },
        disable(opt){
          const exec = !!(opt && opt.executePending);
          // 元に戻す
          try{ if (this._origReload)  window.location.reload  = this._origReload;  }catch(_){}
          try{ if (this._origReplace) window.location.replace = this._origReplace; }catch(_){}
          try{ if (this._origAssign)  window.location.assign  = this._origAssign;  }catch(_){}
          const wasPending = this._pending;
          this._enabled = false;
          this._pending = false;
          chestDiag('reload-guard: disabled. pending=', wasPending, ' executeNow=', exec);
          if (exec && wasPending){
            try{
              // 実リロードを「今」実行
              this._origReload ? this._origReload() : window.location.reload();
            }catch(_){
              // 保険：失敗したら通常APIで
              try{ window.location.reload(); }catch(__){}
            }
          }
        }
      };
      window.__DBE_RELOAD_GUARD = guard;
    })();

    // 既存 startChestProcess / DBE_finishChest を「必ず」ラップできるよう遅延フックを実装
    (function wrapChestFlow(){
      const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
      chestDiag('wrapChestFlow: begin');

      // 共通：startChestProcess のラッパ本体
      function __wrapStart(orig){
        if (orig && orig.__dbeWrappedForProgress) return orig;
        const wrapped = function(type){
          try{
            // 事前初期化（回数の読み取り）
            const rLimited   = document.getElementById('dbe-radio-Chest--limited');
            const rUnlimited = document.getElementById('dbe-radio-Chest--unlimited');
            const nTimes     = document.getElementById('dbe-prm-Chest--open-times');
            DBE_CHEST.unlimited     = !!(rUnlimited && rUnlimited.checked);
            // 分母：標準/バトル＝×1回、大型＝×10回
            const factor = (String(type)==='large') ? 10 : 1;
            DBE_CHEST._totalPlanned = DBE_CHEST.unlimited ? null : Math.max(1, Number(nTimes?.value||1)) * factor;
            DBE_CHEST.processed     = 0;
            DBE_CHEST._userAbort    = false;
            DBE_CHEST._serverError  = false;
            // 自動実行フラグ ON（この間だけカウント対象）
            DBE_CHEST._autoRunning  = true;
            // (4) onHold / onlyNew / 🔰 を開始時にクリア
            try{
              // onHold クラス除去
              document.querySelectorAll('tr.dbe-prm-Chest--onhold').forEach(tr=>tr.classList.remove('dbe-prm-Chest--onhold'));
              // onlyNew マーキング（将来拡張を含む）除去
              document.querySelectorAll('tr.dbe-prm-Chest--onlynew,[data-dbe-onlynew="1"]').forEach(tr=>{
                tr.classList.remove('dbe-prm-Chest--onlynew');
                if (tr.dataset) delete tr.dataset.dbeOnlynew;
              });
              // 🔰（newbie）除去：name-badge API が存在すれば利用
              if (typeof window.DBE_setNameBadge === 'object' && window.DBE_setNameBadge){
                ['#weaponTable','#armorTable','#necklaceTable'].forEach(sel=>{
                  const tb = document.querySelector(sel);
                  if (!tb || !tb.tBodies || !tb.tBodies[0]) return;
                  Array.from(tb.tBodies[0].rows||[]).forEach(tr=>{
                    const nameTd = Array.from(tr.cells||[]).find(td => td.querySelectorAll('span').length>=2) || tr.cells?.[0] || null;
                    if (nameTd) try{ window.DBE_setNameBadge.newbie(nameTd, false); }catch(_){}
                  });
                });
              }
            }catch(_){}
            // （詳細ログ UI は廃止）
            // (5) onHold 付与検知 → ログ出力
            // 分子カウント用のフックを装着（fetch/a.click/form.submit を監視）
            try{ dbeInstallChestCountHooks(); }catch(_){}
            // ▼ リロード抑止を確実に有効化（ここでも保険で有効化）
            try{ if (window.__DBE_RELOAD_GUARD && typeof window.__DBE_RELOAD_GUARD.enable==='function'){ window.__DBE_RELOAD_GUARD.enable(); } }catch(_){}
            dbeStartProgressUI(type);
            chestDiag('startChestProcess(wrapped): called with type=', type);
          }catch(_){}
          // ── ここで「新規装備のみ」が OFF なら、宝箱送出より先に“手持ち（未施錠）”へフィルタ選別を一巡適用 ──
          try{
            const onlyNewCk = document.getElementById('dbe-chest-only-new');
            const onlyNewOn = !!(onlyNewCk && onlyNewCk.checked);
            if (!onlyNewOn){
              // 事前選別 → 完了後に本来の start を実行
              dbePreselectCurrentUnlockedOnce(()=>{ try{ orig && orig.apply(this, arguments); }catch(_){} });
              return;
            }
          }catch(_){}
          const ret = orig ? orig.apply(this, arguments) : undefined;
          // 進行監視：iframe 監視装着トライ
          setTimeout(()=>{ try{ dbeAttachLootObserver(); }catch(_){} }, 0);
          return ret;
        };
        Object.defineProperty(wrapped, '__dbeWrappedForProgress', { value:true });
        chestDiag('wrapChestFlow: startChestProcess wrapped');
        return wrapped;
      }

      // ★追加：DBE_startChestProxy のラッパ（送出直前の最終ゲート）
      function __wrapProxy(origP){
        if (origP && origP.__dbeWrappedForProgress) return origP;
        const wrappedP = function(){
          try{
            // 表示経由を切り替える：onlynew チェック有無で事前選別をスキップする
            const onlyNewCk = document.getElementById('dbe-check-Chest--onlynew');
            const onlyNewOn = !!(onlyNewCk && onlyNewCk.checked);
            // OFF のときは「事前選別(4-b)」が完了してから送出する
            if (!onlyNewOn){
              // 事前選別が既に完了していれば即実行。進行中なら完了時に呼ぶ
              if (DBE_CHEST._preselectBusy){
                chestDiag('proxy: wait preselect to finish before send');
                const retry = ()=>{
                  if (!DBE_CHEST._preselectBusy){
                    try{ origP && origP.apply(this, arguments); }catch(_){}
                  }else{
                    setTimeout(retry, 120);
                  }
                };
                retry();
                return;
              }
            }
          }catch(_){}
          return origP ? origP.apply(this, arguments) : undefined;
        };
        Object.defineProperty(wrappedP, '__dbeWrappedForProgress', { value:true });
        chestDiag('wrapChestFlow: DBE_startChestProxy wrapped');
        return wrappedP;
      }

      // 共通：DBE_finishChest のラッパ本体
      function __wrapFinish(origF){
        if (origF && origF.__dbeWrappedForProgress) return origF;
        const wrappedF = function(){
          try{ (window.DBE_CHEST = window.DBE_CHEST || {})._autoRunning = false; }catch(_){}
          try{ dbeFinishProgressUI(); }catch(_){}
          chestDiag('DBE_finishChest(wrapped): called');
          return origF ? origF.apply(this, arguments) : undefined;
        };
        Object.defineProperty(wrappedF, '__dbeWrappedForProgress', { value:true });
        chestDiag('wrapChestFlow: DBE_finishChest wrapped');
        return wrappedF;
      }

      // 1) すでに存在するなら即ラップ
      if (typeof window.startChestProcess === 'function' && !window.startChestProcess.__dbeWrappedForProgress){
        window.startChestProcess = __wrapStart(window.startChestProcess);
        chestDiag('wrapChestFlow: immediate wrap of existing startChestProcess');
      }
      if (typeof window.DBE_startChestProxy === 'function' && !window.DBE_startChestProxy.__dbeWrappedForProgress){
        window.DBE_startChestProxy = __wrapProxy(window.DBE_startChestProxy);
        chestDiag('wrapChestFlow: immediate wrap of existing DBE_startChestProxy');
      }
      if (typeof window.DBE_finishChest === 'function' && !window.DBE_finishChest.__dbeWrappedForProgress){
        window.DBE_finishChest = __wrapFinish(window.DBE_finishChest);
        chestDiag('wrapChestFlow: immediate wrap of existing DBE_finishChest');
      }
      if (typeof window.DBE_finishChest !== 'function'){
        // フォールバック：まだ無い場合はプレースホルダを入れておく
        window.DBE_finishChest = __wrapFinish(null);
        chestDiag('wrapChestFlow: installed placeholder DBE_finishChest');
      }

      // 2) 後から代入される場合に備えて「setter」で捕まえてラップ
      try{
        if (!window.startChestProcess || !window.startChestProcess.__dbeWrappedForProgress){
          let _scp = typeof window.startChestProcess === 'function' ? window.startChestProcess : null;
          Object.defineProperty(window, 'startChestProcess', {
            configurable: true,
            get(){ return _scp || null; },
            set(fn){
              _scp = __wrapStart(fn);
              chestDiag('wrapChestFlow: setter captured startChestProcess');
            }
          });
        }
      }catch(_){}
      try{
        if (!window.DBE_startChestProxy || !window.DBE_startChestProxy.__dbeWrappedForProgress){
          let _prx = typeof window.DBE_startChestProxy === 'function' ? window.DBE_startChestProxy : null;
          Object.defineProperty(window, 'DBE_startChestProxy', {
            configurable: true,
            get(){ return _prx || null; },
            set(fn){
              _prx = __wrapProxy(fn);
              chestDiag('wrapChestFlow: setter captured DBE_startChestProxy');
            }
          });
        }
      }catch(_){}
      try{
        if (!window.DBE_finishChest || !window.DBE_finishChest.__dbeWrappedForProgress){
          let _fin = typeof window.DBE_finishChest === 'function' ? window.DBE_finishChest : null;
          Object.defineProperty(window, 'DBE_finishChest', {
            configurable: true,
            get(){ return _fin || null; },
            set(fn){
              _fin = __wrapFinish(fn);
              chestDiag('wrapChestFlow: setter captured DBE_finishChest');
            }
          });
        }
      }catch(_){}

      // 3) 念のための保険：一定時間だけポーリングし、未ラップなら捕捉
      (function pollWrap(attempt=0){
        try{
          if (typeof window.startChestProcess === 'function' && !window.startChestProcess.__dbeWrappedForProgress){
            window.startChestProcess = __wrapStart(window.startChestProcess);
            chestDiag('wrapChestFlow: poll', attempt, 'wrapped startChestProcess');
          }
          if (typeof window.DBE_startChestProxy === 'function' && !window.DBE_startChestProxy.__dbeWrappedForProgress){
            window.DBE_startChestProxy = __wrapProxy(window.DBE_startChestProxy);
            chestDiag('wrapChestFlow: poll', attempt, 'wrapped DBE_startChestProxy');
          }
          if (typeof window.DBE_finishChest === 'function' && !window.DBE_finishChest.__dbeWrappedForProgress){
            window.DBE_finishChest = __wrapFinish(window.DBE_finishChest);
            chestDiag('wrapChestFlow: poll', attempt, 'wrapped DBE_finishChest');
          }
        }catch(_){}
        if (attempt < 40){ // 約8秒（300ms×40）の保険
          setTimeout(()=>pollWrap(attempt+1), 300);
        } else {
          const hasStart = typeof window.startChestProcess === 'function' && !!window.startChestProcess.__dbeWrappedForProgress;
          const hasProxy = typeof window.DBE_startChestProxy === 'function' && !!window.DBE_startChestProxy.__dbeWrappedForProgress;
          const hasFin   = typeof window.DBE_finishChest === 'function' && !!window.DBE_finishChest.__dbeWrappedForProgress;
          chestDiag('wrapChestFlow: poll finished. wrapped?', { start:hasStart, proxy:hasProxy, finish:hasFin });
        }
      })();
    })();
  })();
  // ============================================================
  // △追加ここまで△ 宝箱：進行ウインドウ＆ログ
  // ============================================================

  // =========================
  // 共通：ウインドウシェルの確保
  // =========================
  function ensureWindowShell(wndID){
    let wnd = document.getElementById(wndID);
    if (wnd){ chestDiag('ensureWindowShell: reuse', wndID); return wnd; }
    wnd = document.createElement('div');
    wnd.id = wndID;
    // 主要ウインドウ(dbe-W-*)は windowsCommon を適用。ダイアログは dialogCommon を維持。
    if (/^dbe-W-/.test(wndID)) {
      wnd.classList.add('windowsCommon');
      // 念のためダイアログ系のベースクラスが付いていれば外す
      wnd.classList.remove('dialogCommon', 'dialogAlert', 'confirmCommon', 'confirmAlert');
    } else {
      // ダイアログ/小ウインドウ
      wnd.classList.add('dialogCommon');
      // ※重要※ ダイアログは固定配置＋中央化＋常に z-index 帯域をダイアログ側へ
      Object.assign(wnd.style, {
        position: 'fixed',
        inset: '0',
        margin: 'auto',
        maxWidth: 'min(95vw, 720px)',
        maxHeight: '90vh',
        width: 'fit-content',
        height: 'fit-content',
        overflow: 'auto',
        boxShadow: '0 10px 30px rgba(0,0,0,.25)'
      });
    }
    // 個別指定（集中管理しないプロパティのみ）
    // 初期 z-index 設定
    if (/^dbe-W-/.test(wndID)) {
      const z = ((window.__DBE_Z_NEXT = (window.__DBE_Z_NEXT||1000001) + 1));
      window.__DBE_Z_WINDOW_MAX = Math.max(window.__DBE_Z_WINDOW_MAX||1000000, z);
      Object.assign(wnd.style,{ zIndex:String(z), display:'none' });
    } else {
      // ダイアログ：主要ウインドウの最大より十分高く
      dbeGetWindowMaxZ();
      window.__DBE_Z_DIALOG = (window.__DBE_Z_DIALOG||0) + 100;
      const z = window.__DBE_Z_WINDOW_MAX + 1000 + window.__DBE_Z_DIALOG;
      Object.assign(wnd.style,{ zIndex:String(z), display:'none' });
    }    // クリック／タップで前面化
    try{ wnd.addEventListener('pointerdown', ()=> dbeBringToFront(wnd), {passive:true}); }catch(_){}
    // 閉じるボタン
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    Object.assign(closeBtn.style,{
      position:'sticky', float:'right', top:'0', right:'0',
      fontSize:'1.2em', margin:'0 0 6px auto', padding:'2px 10px', display:'block'
    });
    closeBtn.addEventListener('click', ()=>{
      wnd.style.display='none';
      // オーバーレイ処理は撤去済み
      if (wnd.dataset.dbeFronted === '1') delete wnd.dataset.dbeFronted;
    });    wnd.appendChild(closeBtn);
    document.body.appendChild(wnd);
    chestDiag('ensureWindowShell: created', wndID, 'z=', wnd.style.zIndex);
    return wnd;
  }

  // =========================
  // Z-index ユーティリティ
  // =========================
  function dbeGetWindowMaxZ(){
    try{
      const wins = document.querySelectorAll('[id^="dbe-W-"]');
      let maxZ = 1000000;
      wins.forEach(el=>{
        const cs = getComputedStyle(el);
        const z  = parseInt(cs.zIndex||'0',10);
        if (!isNaN(z)) maxZ = Math.max(maxZ, z);
      });
      // 既知の実働値と照合
      if (typeof window.__DBE_Z_WINDOW_MAX === 'number'){
        maxZ = Math.max(maxZ, window.__DBE_Z_WINDOW_MAX);
      }
      window.__DBE_Z_WINDOW_MAX = maxZ;
      return maxZ;
    }catch(_){
      return (window.__DBE_Z_WINDOW_MAX = (window.__DBE_Z_WINDOW_MAX||1000000));
    }
  }
  function dbeBringDialogToFront(wnd){
    const baseWin = dbeGetWindowMaxZ();
    // ダイアログ帯域 = 主要ウインドウ最大 + 1000 以降
    window.__DBE_Z_DIALOG = (window.__DBE_Z_DIALOG||0) + 2;
    const z = baseWin + 1000 + window.__DBE_Z_DIALOG;
    wnd.style.zIndex = String(z);
    // フロント印
    wnd.dataset.dbeFronted = '1';
    chestDiag('bringDialogToFront:', wnd.id, '→ zIndex=', z);
    return z;
  }

  function openWindowWithContent(wndID, nodes){
    const wnd = ensureWindowShell(wndID);
    // 既存の内容（閉じるボタン以外）をクリア
    Array.from(wnd.children).forEach((ch,i)=>{ if(i>0) ch.remove(); });
    // 指定ノードを追加
    const add = (n)=>{ if (n) wnd.appendChild(n); };
    if (Array.isArray(nodes)) nodes.forEach(add); else add(nodes);
    wnd.style.display = 'block';
    dbeBringToFront(wnd);
  }

  // ──────────────────────────────────────────────────────────
  //  サーバーエラーダイアログ（dbe-W-Chest の枠デザイン踏襲）
  // ──────────────────────────────────────────────────────────
  function showServerErrorDialog(messageText){
    try{
      const wndID = 'dbe-Dialog-ServerError';
      const wnd = ensureWindowShell(wndID);
      // 特別な注意喚起デザイン
      wnd.classList.add('dialogAlert');
      // 外枠の角丸と余白を付与
      try{
        wnd.style.borderRadius = '10px';
        wnd.style.padding = '1em';
      }catch(_){}
      // 先頭子要素は ensureWindowShell が生成した「×」ボタン → このダイアログでは閉じ手段を「OK」のみにする
      const closeBtn = wnd.firstElementChild;
      if (closeBtn && closeBtn.tagName === 'BUTTON') {
        closeBtn.style.display = 'none';
        closeBtn.disabled = true;
      }
      // コンテンツを再構築
      Array.from(wnd.children).forEach((ch,i)=>{ if(i>0) ch.remove(); });
      const wrap = document.createElement('div');
      Object.assign(wrap.style,{display:'grid',gap:'10px',minWidth:'320px',maxWidth:'64ch'});
      // 1段目：固定ラベル
      const line1 = document.createElement('div');
      line1.textContent = 'Server Error :';
      Object.assign(line1.style,{fontWeight:'bold',fontSize:'1.05em',color:'#300'});
      // 2段目：サーバーからの実メッセージ（複数行許可）
      const line2 = document.createElement('div');
      line2.textContent = String(messageText||'').trim();
      Object.assign(line2.style,{whiteSpace:'pre-wrap',wordBreak:'break-word',lineHeight:'1.5'});
      // 3段目：「OK」ボタン
      const line3 = document.createElement('div');
      // OK ボタンを中央寄せ
      Object.assign(line3.style,{textAlign:'center'});
      const ok = document.createElement('button');
      ok.textContent = 'OK';
      Object.assign(ok.style,{display:'inline-block',padding:'6px 18px',fontSize:'1.0em',border:'2px solid #006600',borderRadius:'6px',background:'#E9FFE9',cursor:'pointer',margin:'0.5em auto'});
      ok.addEventListener('click', ()=>{ wnd.style.display = 'none'; });
      line3.appendChild(ok);
      wrap.append(line1,line2,line3);
      wnd.appendChild(wrap);
      // サーバーエラー提示時は ProgressUI 側でオーバーレイを既に解除済み。
      // ここでは新規オーバーレイを表示しない（ダイアログのみ前面に出す）。
      dbeBringDialogToFront(wnd);
      wnd.style.display = 'block';
    }catch(err){
      console.error('[DBE] showServerErrorDialog error:', err);
      alert('Server Error :\n' + String(messageText||'').trim());
    }
  }

  // ──────────────────────────────────────────────────────────
  //  サーバーエラーメッセージ抽出（iframe内ドキュメントの本文/タイトルから推定）
  //  対象：
  //   - Server Error / サーバーエラー / ng<>too fast
  //   - No room in inventory / どんぐりが見つかりませんでした。
  //   - 404 / Not Found / 403 / 300 などの一般的なHTTPエラー文言
  // ──────────────────────────────────────────────────────────
  function extractServerErrorText(doc){
    try{
      const bodyText = (doc && doc.body && doc.body.textContent) ? doc.body.textContent : '';
      const titleText = (doc && doc.title) ? String(doc.title) : '';
      const text = [titleText, bodyText].filter(Boolean).join('\n');
      if (!text) return null;

      // 代表的なキーワードを網羅（大小無視）
      const patterns = [
        /Server\s*Error/i,
        /サーバーエラー/i,
        /ng<>too\s*fast/i,
        /No\s*room\s*in\s*inventory/i,     // Left No room in inventory（前半の"Left"有無どちらも拾う）
        /どんぐりが見つかりませんでした。/i,
        /\b404\b/i, /\b403\b/i, /\b300\b/i,
        /Not\s*Found/i, /Forbidden/i, /Internal\s*Server\s*Error/i
      ];
      const hit = patterns.some(re => re.test(text));
      if (!hit) return null;

      // 表示するメッセージは本文優先で丸める
      const raw = (bodyText || titleText).trim();
      return raw.replace(/\s+\n/g,'\n').replace(/\n{3,}/g,'\n\n').slice(0, 300);
    }catch(_){
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────
  //  未知のサーバーエラーメッセージ抽出（既知パターンに当てはまらない場合のフォールバック）
  //   - /bag が正規HTML（necklaceTable/weaponTable/armorTable）を含まない等の異常時に使用する想定
  //   - 文字列が空の場合は null を返す（呼び出し側で 'Unknown Error' へフォールバック）
  // ──────────────────────────────────────────────────────────
  function extractLooseErrorText(doc){
    try{
      const bodyText = (doc && doc.body && doc.body.textContent) ? doc.body.textContent : '';
      const titleText = (doc && doc.title) ? String(doc.title) : '';
      const raw = (bodyText || titleText || '').trim();
      if (!raw) return null;

      const cleaned = raw
        .replace(/\r/g,'')
        .replace(/[ \t]+\n/g,'\n')
        .replace(/\n{3,}/g,'\n\n')
        .replace(/[ \t]{2,}/g,' ')
        .trim();

      return cleaned ? cleaned.slice(0, 300) : null;
    }catch(_){
      return null;
    }
  }

  // /bag が「正規のアイテムバッグHTML」かどうか（主要テーブルが存在するか）を判定
  function isValidBagHtml(doc){
    try{
      if (!doc || !doc.querySelector) return false;
      return !!doc.querySelector('#necklaceTable,#weaponTable,#armorTable');
    }catch(_){
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────
  //  サーバーエラー時の共通ハンドラ（評価選別は“完全にスキップ”）
  //    - 次の開封は行わない（unlimited/left を強制停止）
  //    - lock/recycle/unlock のキューも破棄
  //    - ChestProgressUI は閉じずにエラーを表示（要件(7-a)）
  //    - アラートダイアログ表示（OKボタンのみで閉じる）
  // ──────────────────────────────────────────────────────────
  function handleServerErrorAndStopFlow(doc, messageText){
    const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
    try{
      // (0-e) ProgressUI にもサーバーエラー内容を記録
      try{
        DBE_CHEST._serverError = true;
        const msg = String(messageText||'Server Error').trim();
        dbeAppendLog('【サーバーエラー】' + (msg ? (' ' + msg) : ''));
      }catch(_){}
      // 1) 以降の開封ループを完全停止
      DBE_CHEST.left = 0;
      DBE_CHEST.unlimited = false;
      // 2) 評価選別をスキップするため、キューを掃除
      try{
        DBE_CHEST.qLock = [];
        DBE_CHEST.qRecycle = [];
        DBE_CHEST.qUnlock = [];
      }catch(_){}
      // 3) onHold を全て消去し、onlyNew マーキング済みの行に🔰を付与（要件(7-a)）
      try{
        // onHold 解除
        document.querySelectorAll('tr.dbe-prm-Chest--onhold').forEach(tr=>tr.classList.remove('dbe-prm-Chest--onhold'));
        // onlyNew の行を検出（クラスまたは data 属性）→ 🔰 付与
        const onlyNewRows = document.querySelectorAll('tr.dbe-prm-Chest--onlynew,[data-dbe-onlynew="1"]');
        if (typeof window.DBE_setNameBadge === 'object' && window.DBE_setNameBadge){
          onlyNewRows.forEach(tr=>{
            const nameTd = Array.from(tr.cells||[]).find(td => td.querySelectorAll('span').length>=2) || tr.cells?.[0] || null;
            if (nameTd) try{ window.DBE_setNameBadge.newbie(nameTd, true); }catch(_){}
          });
        }
        // onlyNew マーキング自体は残す（🔰可視のため）。必要ならここで消す:
        // onlyNewRows.forEach(tr=>{ tr.classList.remove('dbe-prm-Chest--onlynew'); if (tr.dataset) delete tr.dataset.dbeOnlynew; });
      }catch(_){}
      // 4) 進行UIの操作状態を「停止」見た目に強制変更（中断=無効 / 閉じる=有効）＋オーバーレイ解除
      try{
        const btnAbort = document.getElementById('dbe-chestprog-abort');
        const btnClose = document.getElementById('dbe-chestprog-close');
        if (btnAbort){
          btnAbort.disabled = true;
          btnAbort.style.opacity = '0.6';
          btnAbort.style.cursor = 'default';
        }
        if (btnClose){
          btnClose.disabled = false;
          btnClose.style.opacity = '1';
          btnClose.style.cursor = 'pointer';
        }
      }catch(_){}
      // 5) ChestProgressUI は開いたままにする（終了処理は呼ばない）
      // 6) 進行用オーバーレイはここで解除（サーバーエラー時は処理停止のため）
      try{ dbeHideOverlay(); }catch(_){}
      // 6.5) ★重要★ 内部状態を完全停止（busy解除など）
      //      サーバーエラー停止後でも、ページリロード無しで再度「宝箱の自動開封」を開始できるようにする
      try{
        DBE_CHEST._autoRunning  = false;
        DBE_CHEST.didWork       = false;   // 誤って finishChest が呼ばれてもハードリロードしない
        DBE_CHEST.stage         = 'idle';
        DBE_CHEST.busy          = false;
        DBE_CHEST._lootObserved = false;   // 次回実行で lootObserver を再アタッチ可能に
      }catch(_){}
      // 進行UIタイマーを止め、閉じるを有効化（ウインドウ自体は自動で閉じない）
      try{ if (typeof dbeFinishProgressUI === 'function') dbeFinishProgressUI(); }catch(_){}
      // HUD停止
      try{ if (typeof stopProgressHud === 'function') stopProgressHud(); }catch(_){}
      // ★ 自動で OFF → ON と切り替えた列表示状態を元に戻す
      try{ __dbeRestoreColsAfterRun(); }catch(_){}
    }finally{
      // 7) アラート提示（OK を押すまで閉じない。×は隠している）
      showServerErrorDialog(messageText);
    }
  }

  // ☆ 追加：OKのみの簡易ダイアログ（dbe-W-Chest の枠デザインを踏襲）
  function dbeShowOkDialog(title, message){
    try{
      const wndID = 'dbe-Dialog-Ok';
      const wnd = ensureWindowShell(wndID); // 共通殻
      wnd.classList.add('dialogCommon');    // 念のため（ensureWindowShell でも付与済み）
      // 先頭の「×」ボタンは本ダイアログでは非表示（OKのみで閉じる）
      const closeBtn = wnd.firstElementChild;
      if (closeBtn && closeBtn.tagName === 'BUTTON') {
        closeBtn.style.display = 'none';
        closeBtn.disabled = true;
      }
      // 既存の内容（閉じるボタン以外）をクリア
      Array.from(wnd.children).forEach((ch,i)=>{ if(i>0) ch.remove(); });
      // 本文
      const wrap = document.createElement('div');
      Object.assign(wrap.style,{display:'grid',gap:'10px',minWidth:'320px',maxWidth:'64ch'});
      // 1行目：タイトル
      const line1 = document.createElement('div');
      line1.textContent = String(title||'');
      Object.assign(line1.style,{
        fontWeight:'300',
        fontSize:'1.3em',
        color:'#006600',
        letterSpacing:'1em',
        textAlign:'center',
        margin:'0.5em'
      });
      // 2行目以降：メッセージ（3行構成に分解して余白指定）
      const msg = String(message||'').trim();
      const parts = msg.split(/\r?\n/);
      // 既定のテキストスタイル
      const baseTextStyle = { whiteSpace:'pre-wrap', wordBreak:'break-word', lineHeight:'1.5' };
      // A行（1段目のテキスト）
      const line2a = document.createElement('div');
      line2a.textContent = parts[0] ? parts[0] : '';
      Object.assign(line2a.style, baseTextStyle, { margin:'0.5em' });
      // B行（未入力項目の列挙を中央狭めで）
      const line2b = document.createElement('div');
      line2b.textContent = parts[1] ? parts[1] : '';
      Object.assign(line2b.style, baseTextStyle, { margin:'0.5em 3em' });
      // C行（3段目のテキスト。3行目以降があればまとめて出す）
      const line2c = document.createElement('div');
      line2c.textContent = parts.length > 2 ? parts.slice(2).join('\n') : '';
      Object.assign(line2c.style, baseTextStyle, { margin:'0.5em' });
      // 3行目：OKボタン
      const line3 = document.createElement('div');
      const ok = document.createElement('button');
      ok.textContent = 'OK';
      Object.assign(ok.style,{
        cursor:'pointer', padding:'6px 18px',
        border:'2px solid #006600', borderRadius:'6px', background:'#E9FFE9',
        display:'block', margin:'0.5em auto' // 中央寄せ＋指定margin
      });
      ok.addEventListener('click', ()=>{ wnd.style.display = 'none'; });
      line3.appendChild(ok);
      // メッセージの表示：分割結果に応じて追加
      wrap.append(line1);
      if (line2a.textContent) wrap.append(line2a);
      if (line2b.textContent) wrap.append(line2b);
      if (line2c.textContent) wrap.append(line2c);
      wrap.append(line3);
      wnd.appendChild(wrap);
      // ダイアログ帯域で前面化
      dbeBringDialogToFront(wnd);
      wnd.style.display = 'block';
      try{ setTimeout(()=> ok.focus(), 0); }catch(_){}
      // OK で閉じると同時にオーバーレイも畳む
      ok.addEventListener('click', ()=>{ try{ dbeHideOverlay(); }catch(_){}} , {once:true});
    }catch(err){
      console.error('[DBE] dbeShowOkDialog error:', err);
      alert(String(title||'') + (message?('\n'+String(message)):''));
    }
  }

  // ☆ 追加：赤枠の Alert ダイアログ（条件なしカードの保存禁止などに使用）
  // - タイトル「Alert:」は左寄せ
  // - 本文は中央寄せ
  // - OK ボタンは中央寄せ
  // - OK で閉じた後、focusBack があればフォーカスを戻す
  function dbeShowAlertDialog(message, focusBack){
    try{
      const wndID = 'dbe-Dialog-Alert';
      const wnd = ensureWindowShell(wndID); // 共通殻
      // “保存禁止”アラート専用の軽め赤枠デザイン
      wnd.classList.remove('dialogCommon','dialogAlert','dialogAlertLite');
      wnd.classList.add('dialogAlertLite');

      // 先頭の「×」ボタンは非表示（OKのみで閉じる）
      const closeBtn = wnd.firstElementChild;
      if (closeBtn && closeBtn.tagName === 'BUTTON') {
        closeBtn.style.display = 'none';
        closeBtn.disabled = true;
      }
      // 既存の内容（閉じるボタン以外）をクリア
      Array.from(wnd.children).forEach((ch,i)=>{ if(i>0) ch.remove(); });

      const wrap = document.createElement('div');
      Object.assign(wrap.style,{display:'grid',gap:'12px',minWidth:'320px',maxWidth:'64ch'});

      // タイトル（左寄せ）
      const line1 = document.createElement('div');
      line1.textContent = 'Alert:';
      Object.assign(line1.style,{
        fontWeight:'700',
        fontSize:'1.05em',
        color:'#B00000',
        textAlign:'left',
        margin:'0.5em 0.75em 0 0.75em'
      });

      // 本文（中央寄せ）
      const line2 = document.createElement('div');
      line2.textContent = String(message||'').trim();
      Object.assign(line2.style,{
        whiteSpace:'pre-wrap',
        wordBreak:'break-word',
        lineHeight:'1.6',
        textAlign:'center',
        margin:'0.25em 0.75em 0.5em 0.75em'
      });

      // OK（中央寄せ）
      const line3 = document.createElement('div');
      const ok = document.createElement('button');
      ok.textContent = 'OK';
      Object.assign(ok.style,{
        cursor:'pointer',
        padding:'6px 20px',
        border:'2px solid #B00000',
        borderRadius:'6px',
        background:'#FFE9E9',
        display:'block',
        margin:'0.25em auto 0.75em auto'
      });
      line3.appendChild(ok);

      ok.addEventListener('click', ()=>{
        wnd.style.display = 'none';
        try{ dbeHideOverlay(); }catch(_){}
        try{
          if (focusBack && typeof focusBack.focus === 'function') focusBack.focus();
        }catch(_){}
      });

      wrap.append(line1, line2, line3);
      wnd.appendChild(wrap);
      dbeBringDialogToFront(wnd);
      wnd.style.display = 'block';
      try{ setTimeout(()=> ok.focus(), 0); }catch(_){}
    }catch(err){
      console.error('[DBE] dbeShowAlertDialog failed:', err);
      alert(String(message||''));
      try{
        if (focusBack && typeof focusBack.focus === 'function') focusBack.focus();
      }catch(_){}
    }
  }

  // ☆ 追加：二択確認ダイアログ（共通デザイン）
  // 返り値: Promise<boolean> （true=Yes/OK, false=No/Cancel）
  function dbeConfirmCommon(title, message, yesLabel, noLabel){
    return new Promise((resolve)=>{
      try{
        const wndID = 'dbe-Dialog-Confirm';
        const wnd = ensureWindowShell(wndID);
        // ×ボタンは非表示（必ず明示選択させる）
        const closeBtn = wnd.firstElementChild;
        if (closeBtn && closeBtn.tagName === 'BUTTON') {
          closeBtn.style.display = 'none';
          closeBtn.disabled = true;
        }
        // クラス（役割）を付与
        wnd.classList.remove('confirmAlert');
        wnd.classList.add('confirmCommon');
        // 既存の内容（閉じるボタン以外）をクリア
        Array.from(wnd.children).forEach((ch,i)=>{ if(i>0) ch.remove(); });
        // 本文
        const wrap = document.createElement('div');
        Object.assign(wrap.style,{display:'grid',gap:'10px',minWidth:'320px',maxWidth:'64ch'});
        // 1行目：タイトル
        const line1 = document.createElement('div');
        line1.textContent = String(title||'確認');
        line1.className = 'confirm-title';
        Object.assign(line1.style,{fontWeight:'bold',fontSize:'1.05em'});
        // 2行目：本文
        const line2 = document.createElement('div');
        line2.textContent = String(message||'').trim();
        line2.className = 'confirm-message';
        Object.assign(line2.style,{whiteSpace:'pre-wrap',wordBreak:'break-word',lineHeight:'1.5'});
        // 3行目：アクション
        const line3 = document.createElement('div');
        line3.className = 'confirm-actions';
        const yes = document.createElement('button');
        yes.textContent = String(yesLabel||'OK');
        yes.className = 'btn-yes';
        const no  = document.createElement('button');
        no.textContent = String(noLabel||'キャンセル');
        no.className = 'btn-no';
        // ボタン装飾（CSSでも当てるが、最低限の保険として）
        [yes,no].forEach(b=>Object.assign(b.style,{
          cursor:'pointer', padding:'6px 18px',
          border:'2px solid #006600', borderRadius:'6px', background:'#E9FFE9'
        }));
        // クリック挙動
        yes.addEventListener('click', ()=>{ wnd.style.display='none'; resolve(true); });
        no .addEventListener('click', ()=>{ wnd.style.display='none'; resolve(false); });
        // キー操作（Enter=yes / Esc=no）
        const onKey = (ev)=>{
          if (ev.key === 'Enter'){ ev.preventDefault(); yes.click(); }
          else if (ev.key === 'Escape'){ ev.preventDefault(); no.click(); }
        };
        wnd.addEventListener('keydown', onKey, { once:false });
        // DOM構築
        line3.append(yes,no);
        wrap.append(line1,line2,line3);
        wnd.appendChild(wrap);
        // ダイアログ帯域で前面化 → 表示 & フォーカス
        dbeBringDialogToFront(wnd);
        wnd.style.display = 'block';
        setTimeout(()=> yes.focus(), 0);
        // どちらでも閉じると同時にオーバーレイも畳む
        const hideOvOnce = ()=>{ try{ dbeHideOverlay(); }catch(_){} };
        yes.addEventListener('click', hideOvOnce, {once:true});
        no .addEventListener('click', hideOvOnce, {once:true});
      }catch(err){
        console.error('[DBE] dbeConfirmCommon error:', err);
        // フォールバック
        resolve(window.confirm(String(title||'確認') + (message?('\\n'+String(message)):'') ));
      }
    });
  }

  // ☆ 追加：二択確認ダイアログ（注意喚起デザイン）
  // 返り値: Promise<boolean> （true=Yes/OK, false=No/Cancel）
  function dbeConfirmAlert(title, message, yesLabel, noLabel){
    return new Promise((resolve)=>{
      try{
        const wndID = 'dbe-Dialog-Confirm';
        const wnd = ensureWindowShell(wndID);
        // ×ボタンは非表示
        const closeBtn = wnd.firstElementChild;
        if (closeBtn && closeBtn.tagName === 'BUTTON') {
          closeBtn.style.display = 'none';
          closeBtn.disabled = true;
        }
        // クラス（役割）を付与
        wnd.classList.remove('confirmCommon');
        wnd.classList.add('confirmAlert');
        // 既存の内容（閉じるボタン以外）をクリア
        Array.from(wnd.children).forEach((ch,i)=>{ if(i>0) ch.remove(); });
        // 本文
        const wrap = document.createElement('div');
        Object.assign(wrap.style,{display:'grid',gap:'10px',minWidth:'320px',maxWidth:'64ch'});
        // 1行目：タイトル（強調色）
        const line1 = document.createElement('div');
        line1.textContent = String(title||'確認');
        line1.className = 'confirm-title';
        Object.assign(line1.style,{fontWeight:'bold',fontSize:'1.05em',color:'#300'});
        // 2行目：本文
        const line2 = document.createElement('div');
        line2.textContent = String(message||'').trim();
        line2.className = 'confirm-message';
        Object.assign(line2.style,{whiteSpace:'pre-wrap',wordBreak:'break-word',lineHeight:'1.5'});
        // 3行目：アクション
        const line3 = document.createElement('div');
        line3.className = 'confirm-actions';
        const yes = document.createElement('button');
        yes.textContent = String(yesLabel||'はい');
        yes.className = 'btn-yes';
        const no  = document.createElement('button');
        no.textContent = String(noLabel||'いいえ');
        no.className = 'btn-no';
        // ボタン装飾（注意色）
        Object.assign(yes.style,{cursor:'pointer',padding:'6px 18px',border:'2px solid #930000',borderRadius:'6px',background:'#FFE9E9'});
        Object.assign(no .style,{cursor:'pointer',padding:'6px 18px',border:'2px solid #006600',borderRadius:'6px',background:'#E9FFE9'});
        // クリック挙動
        yes.addEventListener('click', ()=>{ wnd.style.display='none'; resolve(true); });
        no .addEventListener('click', ()=>{ wnd.style.display='none'; resolve(false); });
        // キー操作（Enter=yes / Esc=no）
        const onKey = (ev)=>{
          if (ev.key === 'Enter'){ ev.preventDefault(); yes.click(); }
          else if (ev.key === 'Escape'){ ev.preventDefault(); no.click(); }
        };
        wnd.addEventListener('keydown', onKey, { once:false });
        // DOM構築
        line3.append(yes,no);
        wrap.append(line1,line2,line3);
        wnd.appendChild(wrap);
        // ダイアログ帯域で前面化 → 表示 & フォーカス
        dbeBringDialogToFront(wnd);
        wnd.style.display = 'block';
        setTimeout(()=> yes.focus(), 0);
        // どちらでも閉じると同時にオーバーレイも畳む
        const hideOvOnce = ()=>{ try{ dbeHideOverlay(); }catch(_){} };
        yes.addEventListener('click', hideOvOnce, {once:true});
        no .addEventListener('click', hideOvOnce, {once:true});
      }catch(err){
        console.error('[DBE] dbeConfirmAlert error:', err);
        resolve(window.confirm(String(title||'確認') + (message?('\\n'+String(message)):'') ));
      }
    });
  }

  // ☆ 追加：列検出エラー時の中断ハンドラ
  function dbeAbortChest(reason){
    console.error('[DBE][ABORT] %s', reason);
    try{ dbeShowOkDialog('列検出エラー', reason + '\n処理を中断しました。'); }catch(_){}
    try{
      if (window.DBE_CHEST){
        DBE_CHEST._unlockBusy=false;
        DBE_CHEST._openBusy=false;
        DBE_CHEST._aborted=true;
        DBE_CHEST.onHoldIds && DBE_CHEST.onHoldIds.clear && DBE_CHEST.onHoldIds.clear();
      }
    }catch(_){}
    try{ window.DBE_finishChest && window.DBE_finishChest(); }catch(_){}
  }


  // 〓〓〓 旧メニューボタンID → 新メニューボタンID へ移行 〓〓〓
  //   - 旧: dbe-Menu-*（legacy） / 新: dbe-MenuBar-*
  //   - 新IDが無い場合: 旧IDをその場で新IDへ rename（id を付け替え）
  //   - 新旧が両方ある場合: 旧ID側を削除（重複防止）
  function dbeMigrateLegacyMenuIds(){
    try{
      const pairs = [
        ['dbe-Menu-navi'    , 'dbe-MenuBar-navi'],
        ['dbe-Menu-Navi'    , 'dbe-MenuBar-navi'],
        ['dbe-Menu-chest'   , 'dbe-MenuBar-chest'],
        ['dbe-Menu-recycle' , 'dbe-MenuBar-recycle'],
        ['dbe-Menu-settings', 'dbe-MenuBar-settings'],
      ];
      for (const [oldId, newId] of pairs){
        const oldEl = document.getElementById(oldId);
        const newEl = document.getElementById(newId);
        if (oldEl && !newEl){
          // 旧だけある → その場で新IDに改名
          oldEl.id = newId;
        } else if (oldEl && newEl){
          // 両方ある → 旧を削除（重複を排除）
          try{ oldEl.remove(); }catch(_){}
        }
      }
    }catch(_){}
  }

  // ============================================================
  // ▽ここから▽ メニューバー"dbe-MenuBar"と各ボタン群の生成
  // ============================================================
  function initDockMenu(){
    // まずレイアウト互換：旧IDが残っていても新IDへ統一
    dbeMigrateLegacyMenuIds();

    // ── 既存の状態を点検しつつ再生成/修復する堅牢化ガード ──
    const existingDock   = document.getElementById('dbe-Menu');
    let   legacyWrap     = document.getElementById('dbe-MenuBar');
    // 1) 旧ラッパがあるが display:none 等で不可視なら、ここで修復
    if (legacyWrap) {
      const cs = getComputedStyle(legacyWrap);
      if (cs && (cs.display === 'none')) {
        legacyWrap.style.display = 'contents';
      }
    }
    // 2) 旧ラッパがある & 中に dbe-Menu が居る → そのまま使う（早期復帰）
    // ※ ここで "return" せず、以降の再配線（イベント付与）処理まで通す
    // 3) 旧ラッパはあるが中身が無い → 中身だけ新規生成する
    // 4) 旧ラッパが無く、孤立した dbe-Menu が居る → ラッパを作って移設
    // 5) どちらも無ければ、両方を新規生成

    // ここから生成 / or 再利用
    const dock = existingDock || document.createElement('div');
    dock.id = 'dbe-Menu';
    Object.assign(dock.style, {
      position: 'fixed',
      display: 'flex',
      gap: '2.5rem',
      pointerEvents: 'auto',
      zIndex: '1000000'
    });

    // ボタン生成ヘルパ
    const makeBtn = (id, label)=>{
      const b = document.createElement('button');
      b.id = id;
      b.textContent = label;
      Object.assign(b.style,{
        pointerEvents:'auto',     // ← ボタンだけ受け止める
        margin:'0', padding:'0 0 5px 1px',
        width:'4rem', height:'4rem',
        boxShadow:'0 0 8px 0 rgba(51, 51, 51, 0.5)',
        border:'4px solid #006600',
        borderRadius:'8px',
        background:'#e9ffe9', color:'#ff0000',
        fontSize:'2.5rem', fontWeight:'bold',
        cursor:'pointer'
      });
      return b;
    };
    // 既存/新規を問わず、ここで確実にボタン参照を用意して、無ければ生成する（新IDを優先）
    let bNavi    = dock.querySelector('#dbe-MenuBar-navi');
    let bChest   = dock.querySelector('#dbe-MenuBar-chest');
    let bRecycle = dock.querySelector('#dbe-MenuBar-recycle');
    let bSettings= dock.querySelector('#dbe-MenuBar-settings');
    if (!bNavi || !bChest || !bRecycle || !bSettings) {
      // 既存の子を一度クリア（壊れている可能性もあるため）
      while (dock.firstChild) dock.firstChild.remove();
      bNavi     = makeBtn('dbe-MenuBar-navi',     '↕️');
      bChest    = makeBtn('dbe-MenuBar-chest',    '🎁');
      bRecycle  = makeBtn('dbe-MenuBar-recycle',  '♻️');
      bSettings = makeBtn('dbe-MenuBar-settings', '⚙️');
      dock.append(bNavi, bChest, bRecycle, bSettings);
    }
    // ラッパ（#dbe-MenuBar）を用意して dbe-Menu を格納
    if (!legacyWrap) {
      legacyWrap = document.createElement('div');
      legacyWrap.id = 'dbe-MenuBar';           // 旧名と互換
      legacyWrap.style.display = 'contents';   // レイアウトに干渉しない
      document.body.appendChild(legacyWrap);
    }
    // 既に別の場所にある場合は移設
    if (dock.parentElement !== legacyWrap) {
      legacyWrap.appendChild(dock);
    }

    // 〓〓〓 CSSだけで固定配置（スクロールやアドレスバー変化に影響されない）〓〓〓
    if (!document.getElementById('dbe-dock-style')){
      const st = document.createElement('style');
      st.id = 'dbe-dock-style';
      st.textContent = `
        /* 共通：画面に固定し、ボタンは中央寄せ */
        #dbe-Menu{
          position: fixed;
          pointer-events: auto;
          display: flex;
          gap: 12px;
          z-index: 1000000;
        }
        #dbe-Menu > *{ pointer-events: auto; }
        /* 縦長：画面下中央に張り付く */
        @media (orientation: portrait){
          #dbe-Menu{
            left: 0; right: 0; bottom: calc(env(safe-area-inset-bottom,0px) + 0px);
            top: auto;
            margin: 0 auto;
            flex-direction: row;
            justify-content: center;
            align-items: center;
          }
        }
        /* 横長：画面左中央に張り付く */
        @media (orientation: landscape){
          #dbe-Menu{
            top: 0; bottom: 0; left: calc(env(safe-area-inset-left,0px) + 0px);
            right: auto;
            margin: auto 0;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
        }
      `;
      document.head.appendChild(st);
    }
    // ※ レイアウトは CSS に移管。JSの再計算は不要。

    // dbe-Menu ボタンクリックのトグル動作（存在チェック付きで安全に付与）
    if (bNavi) bNavi.addEventListener('click', ()=>{
      const wnd = document.getElementById('dbe-W-Navi') || ensureWindowShell('dbe-W-Navi');
      if (wnd.style.display !== 'none'){
        wnd.style.display = 'none';
        if (wnd.dataset.dbeFronted === '1') delete wnd.dataset.dbeFronted;
        return;
      }
      wnd.style.display = 'inline-block';
      dbeBringToFront(wnd);
    });
    // Chest：本実装ウィンドウのトグル表示
    if (bChest) bChest.addEventListener('click', ()=>{
      const wnd = document.getElementById('dbe-W-Chest') || ensureWindowShell('dbe-W-Chest');
      if (wnd.style.display !== 'none'){
        wnd.style.display = 'none';
        if (wnd.dataset.dbeFronted === '1') delete wnd.dataset.dbeFronted;
        return;
      }
      if (wnd.children.length <= 1){
        // 初回構築
          try{
            wnd.appendChild(buildChestWindow());
          } catch(err){
            console.error('[DBE] buildChestWindow error:', err);
            const msg = document.createElement('div');
            msg.textContent = 'UI の構築中にエラーが発生しました。コンソールをご確認ください。';
            msg.style.color = '#c00';
            wnd.appendChild(msg);
          }
      }
      wnd.style.display = 'inline-block';
      dbeBringToFront(wnd);
      // ▼「詳細なログを表示する」チェック UI を必ず設置/同期
      try{ dbeEnsureChestDetailLogControl(wnd); }catch(_){}
    });
    if (bRecycle) bRecycle.addEventListener('click', ()=>{
      const wnd = document.getElementById('dbe-W-Recycle') || ensureWindowShell('dbe-W-Recycle');
      if (wnd.style.display !== 'none'){
        wnd.style.display = 'none';
        if (wnd.dataset.dbeFronted === '1') delete wnd.dataset.dbeFronted;
        return;
      }
      wnd.style.display = 'inline-block';
      dbeBringToFront(wnd);
    });
    if (bSettings) bSettings.addEventListener('click', ()=>{
      const wnd = document.getElementById('dbe-W-Settings') || ensureWindowShell('dbe-W-Settings');
      if (wnd.style.display !== 'none'){
        wnd.style.display = 'none';
        if (wnd.dataset.dbeFronted === '1') delete wnd.dataset.dbeFronted;
        return;
      }
      wnd.style.display = 'inline-block';
      dbeBringToFront(wnd);
      // 開くタイミングで保存値をUIへ反映
      syncMenuFromStorage();
    });
    // ============================================================
    //  △ここまで△ メニューバー"dbe-MenuBar"と各ボタン群の生成
    // ============================================================

    // ============================================================
    //  ▽ここから▽ フィルタカード Export/Import ヘルパ群
    // ============================================================

    // 形を強制整形（順序維持）
    function dbeNormalizeCardsShape(obj){
      const safeArr = v => Array.isArray(v)? v : [];
      const x = (obj && typeof obj==='object') ? obj : {};
      return { wep: safeArr(x.wep), amr: safeArr(x.amr), nec: safeArr(x.nec) };
    }
    function dbeLooksLikeRules(x){
      return !!(x && typeof x==='object'
        && Array.isArray(x.wep) && Array.isArray(x.amr) && Array.isArray(x.nec));
    }

    // ローカルストレージから候補キーを順に試す
    function dbeLoadRulesFromStorage(){
      try{
        const candidates = [
          'dbe-rules-v1',              // 本流（RULES_STORE_KEY）
          'DBE_RULES',                 // 想定キー（実装差対応）
          'DBE_RULES_EXPORT_CACHE',    // 本スクリプトのバックアップ
          'dbe_rules',
          'DonguriRules',
        ];
        for (const k of candidates){
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          try{
            const obj = JSON.parse(raw);
            if (dbeLooksLikeRules(obj)) return obj;
            // エクスポート形式 {type:'dbe-filter-cards', data:{...}}
            if (obj && obj.type==='dbe-filter-cards' && dbeLooksLikeRules(obj.data)) return obj.data;
          }catch(_){}
        }
        // 既知キーに無ければ、全キーを総当りして wep/amr/nec を持つものを拾う
        for (let i=0;i<localStorage.length;i++){
          const k = localStorage.key(i);
          if (!k) continue;
          try{
            const obj = JSON.parse(localStorage.getItem(k));
            if (dbeLooksLikeRules(obj)) return obj;
            if (obj && obj.type==='dbe-filter-cards' && dbeLooksLikeRules(obj.data)) return obj.data;
          }catch(_){}
        }
      }catch(_){}
      return null;
    }
    // 現在有効なカード構造を取得（順序を保持）: 本流(_rulesData/本流ストレージ) → 互換グローバル → ストレージ候補 → 空
    function dbeGetAllFilterCards(){
      try{
        let src = null;
        // 1) 本流：スクリプト内部の _rulesData を最優先（window 側の古い/部分データに引っ張られない）
        try{
          if (typeof _rulesData === 'object' && dbeLooksLikeRules(_rulesData)) src = _rulesData;
        }catch(_){}
        // 2) 本流：本体の loadRulesFromStorage() があれば、それも試す（dbe-rules-v1 を正とする）
        if (!src){
          try{
            if (typeof loadRulesFromStorage === 'function'){
              const r = loadRulesFromStorage();
              if (dbeLooksLikeRules(r)) src = r;
            }
          }catch(_){}
        }
        // 3) 互換：グローバル → ヘルパ側ストレージ探索
        if (!src){
          src =
            (window.DBE_RULES && typeof window.DBE_RULES==='object' && dbeLooksLikeRules(window.DBE_RULES)) ? window.DBE_RULES :
            (window._rulesData && typeof window._rulesData==='object' && dbeLooksLikeRules(window._rulesData)) ? window._rulesData :
            dbeLoadRulesFromStorage();
        }
        const base = src || { wep:[], amr:[], nec:[] };
        return dbeNormalizeCardsShape(JSON.parse(JSON.stringify(base)));
      }catch(_){
        return {wep:[],amr:[],nec:[]};
      }
    }
    // 保存：可能なら本体の保存関数(saveRulesToStorage)を使い、それが無ければ互換キーへ保存
    function dbeSaveAllFilterCards(newData){
      const data = dbeNormalizeCardsShape(newData);

      // 1) まず本流の _rulesData を更新（可能なら同一参照のまま更新して破壊的変更に追随）
      try{
        if (typeof _rulesData === 'object' && _rulesData){
          _rulesData.wep = data.wep;
          _rulesData.amr = data.amr;
          _rulesData.nec = data.nec;
        } else {
          // 参照できない場合は最小の形で置換（以降の保存で永続化）
          _rulesData = { wep:data.wep, amr:data.amr, nec:data.nec };
        }
      }catch(_){}

      // 2) 本体の saveRulesToStorage() が使えるなら最優先で永続化（= dbe-rules-v1 に保存）
      try{
        if (typeof saveRulesToStorage === 'function'){
          const ok = saveRulesToStorage();
          // 互換のために window 側も同期（他所が参照していても崩れないように）
          try{ window._rulesData = _rulesData; }catch(_){}
          try{ window.DBE_RULES  = _rulesData; }catch(_){}
          if (ok) return true;
        }
      }catch(_){}

      // 3) もし window.saveRulesToStorage が生えている環境ならそれも試す
      if (typeof window.saveRulesToStorage === 'function'){
        try{
          try{ window._rulesData = _rulesData; }catch(_){}
          try{ window.DBE_RULES  = _rulesData; }catch(_){}
          window.saveRulesToStorage();
          return true;
        }catch(_){}
      }

      // 4) フォールバック：互換キー＋本流キーにも保存（できる限りズレを無くす）
      try{
        try{ window._rulesData = _rulesData; }catch(_){}
        try{ window.DBE_RULES  = _rulesData; }catch(_){}
        // 本流キー（RULES_STORE_KEY 相当）にも保存
        try{ localStorage.setItem('dbe-rules-v1', JSON.stringify(_rulesData)); }catch(_){}
        // 主要キーにも保存（「上書き」時は完全置換となる）
        try{ localStorage.setItem('DBE_RULES', JSON.stringify(_rulesData)); }catch(_){}
        // 互換：旧/別名キーにも保存（UI 実装差吸収）
        try{ localStorage.setItem('dbe_rules', JSON.stringify(_rulesData)); }catch(_){}
        try{ localStorage.setItem('DonguriRules', JSON.stringify(_rulesData)); }catch(_){}
        // バックアップ用キーにも保存
        try{ localStorage.setItem('DBE_RULES_EXPORT_CACHE', JSON.stringify(_rulesData)); }catch(_){}
        return true;
      }catch(_){ return false; }
    }
    // 形を強制整形（順序維持）
    function dbeNormalizeCardsShape(obj){
      const safeArr = v => Array.isArray(v)? v : [];
      const x = (obj && typeof obj==='object') ? obj : {};
      return {
        wep: safeArr(x.wep),
        amr: safeArr(x.amr),
        nec: safeArr(x.nec)
      };
    }

    // エクスポート（JSON; 順序含め完全復元可能）— OSの保存ダイアログ使用（標準名のみ・記憶しない）
    async function dbeExportFilterCards(){
      try{
        const payload = {
          type: 'dbe-filter-cards',
          version: '1',
          exported_at: new Date().toISOString(),
          dbe_version: DBE_VERSION,
          data: dbeGetAllFilterCards()
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
        const pad = n=> String(n).padStart(2,'0');
        const d = new Date();
        const name = `dbe-filter-cards_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
        // 1) Chromium系: showSaveFilePicker で OS ダイアログ
        if (window.showSaveFilePicker){
          try{
            const handle = await window.showSaveFilePicker({
              suggestedName: name,
              types: [{ description:'JSON file', accept:{'application/json':['.json']} }]
            });
            const stream = await handle.createWritable();
            await stream.write(blob);
            await stream.close();
            return;
          }catch(err){
            // キャンセルなら静かに戻る
            if (err && err.name === 'AbortError') return;
            console.warn('[DBE] showSaveFilePicker fallback:', err);
          }
        }
        // 2) Firefox/Tampermonkey 等: GM_download(saveAs:true) で OS ダイアログ
        try{
          if (typeof GM_download === 'function'){
            const url = URL.createObjectURL(blob);
            GM_download({
              url, name, saveAs:true,
              onload:()=>URL.revokeObjectURL(url),
              ontimeout:()=>URL.revokeObjectURL(url),
              onerror:()=>URL.revokeObjectURL(url)
            });
            return;
          }
        }catch(_){}
        // 3) フォールバック：通常の自動ダウンロード（保存先はブラウザ設定依存）
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 50);
      }catch(err){
        console.error('[DBE] export failed:', err);
        try{ dbeShowOkDialog('エクスポート失敗','フィルタカードのエクスポートに失敗しました。'); }catch(_){}
      }
    }

    // インポート（上書き or 末尾追加）
    function dbeImportFilterCards(file, mode){ // mode: 'overwrite' | 'append'
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async ()=>{
        try{
          const raw = JSON.parse(String(reader.result||'{}'));

          // ★ 追加：エクスポート元DBEバージョンが現在より新しい場合は警告（続行/キャンセル）
          try{
            const exportedVer =
              (raw && typeof raw==='object' && raw.type==='dbe-filter-cards')
                ? (raw.dbe_version || raw.dbeVersion || raw.DBE_VERSION || raw.exported_dbe_version || null)
                : null;
            if (exportedVer && dbeCompareVersion(DBE_VERSION, exportedVer) < 0){
              const msg = [
                `このファイルは DBE v${exportedVer} でエクスポートされています。`,
                `現在ご使用の DBE は v${DBE_VERSION} のため、より古いです。`,
                'このままインポートすると、新しい項目が正しく反映されない恐れがあります。',
                'DBE を更新してからインポートすることを推奨します。',
                '',
                'このままインポートを続行しますか？'
              ].join('\n');
              const ok = await dbeConfirmAlert('警告', msg, '続行', 'キャンセル');
              if (!ok) return;
            }
          }catch(_){}

          const data = raw && raw.type==='dbe-filter-cards' && raw.data ? dbeNormalizeCardsShape(raw.data) : dbeNormalizeCardsShape(raw);
          const cur  = dbeGetAllFilterCards();
          let next;
          if (mode==='overwrite'){
            // 既存一覧を丸ごと置き換え（wep/amr/nec すべて）
            next = data;
          } else {
            // 既存一覧は保持し、末尾に追加
            next = {
              wep: [...cur.wep, ...data.wep],
              amr: [...cur.amr, ...data.amr],
              nec: [...cur.nec, ...data.nec]
            };
          }
          if (!dbeSaveAllFilterCards(next)) throw new Error('save failed');
          // ルール一覧UI（dbe-W-Rules）が開いていれば即時反映（強制再生成）
          try{
            const wnd = document.getElementById('dbe-W-Rules');
            const isOpen = wnd && getComputedStyle(wnd).display !== 'none';
            if (isOpen){
              // モーダルの DOM を一旦破棄 → 再オープンで完全再構築させる
              wnd.remove();
              // グローバルへも反映しておく（UI 側が参照する前提）
              window._rulesData = next;
              window.DBE_RULES  = next;
              // openRulesModal があれば呼び出し、無ければボタンクリックをシミュレート
              if (typeof window.openRulesModal === 'function'){
                setTimeout(()=>{ try{ window.openRulesModal(); }catch(_){} }, 0);
              } else {
                const btn = document.querySelector('#dbe-W-Chest button, #dbe-Menu button');
                setTimeout(()=>{ try{ btn && btn.click && btn.click(); }catch(_){} }, 0);
              }
            } else {
              // 閉じている場合もグローバルへ反映（次回オープン時に反映）
              window._rulesData = next;
              window.DBE_RULES  = next;
            }
          }catch(_){}
          try{ dbeShowOkDialog('インポート完了', mode==='overwrite' ? '既存一覧を上書きしました。' : '既存一覧の末尾に追加しました。'); }catch(_){}
        }catch(err){
          console.error('[DBE] import failed:', err);
          try{ dbeShowOkDialog('インポート失敗','ファイルの読み取りまたは保存に失敗しました。'); }catch(_){}
        }
      };
      reader.onerror = ()=> {
        try{ dbeShowOkDialog('インポート失敗','ファイルの読み取りに失敗しました。'); }catch(_){}
      };
      reader.readAsText(file);
    }
    // ============================================================
    // △ここまで△ フィルタカード Export/Import ヘルパ群
    // ============================================================

    // ============================================================
    // フィルタカード（選別設定）ブロック（共通部品）
    //   - 他のウィンドウ/機能からも呼び出せるように独立
    //   - 生成要素に id="filtercard" を付与
    // ============================================================
    function buildFilterCardPanel(){
      // 既に同IDが存在する場合は退避（重複IDの回避）
      try{
        const existing = document.getElementById('filtercard');
        if (existing){
          existing.id = 'filtercard--old-' + Date.now();
        }
      }catch(_){}

      const grp2 = document.createElement('div');
      grp2.id = 'filtercard';
      Object.assign(grp2.style,{
        border:'1px solid #CCC',
        borderRadius:'8px',
        padding:'8px',
        display:'grid',
        gap:'8px'
      });

      // 見出し（タイトル）
      const grp2Title = document.createElement('div');
      grp2Title.textContent = 'フィルタカード';
      Object.assign(grp2Title.style,{ fontSize:'1.1em' });

      // 注記（説明文）
      const grp2Annot = document.createElement('div');
      grp2Annot.textContent = '※ 装備を施錠や分解または保留するための条件を、カード形式で設定します。';
      Object.assign(grp2Annot.style,{ fontSize:'0.9em', margin:'0', padding:'0 1em 0 3em' });

      // ボタン行
      const grp2Btns = document.createElement('div');
      Object.assign(grp2Btns.style,{
        display:'flex',
        justifyContent:'center',
        gap:'8px',
        flexWrap:'wrap'
      });

      const btnRules = document.createElement('button');
      btnRules.type = 'button'; // ← フォーム送信によるページ遷移を抑止
      btnRules.textContent = 'フィルタカードを設定';
      Object.assign(btnRules.style,{ fontSize:'0.9em', margin:'0.5em', padding:'8px 12px' });
      btnRules.addEventListener('click', (ev) => {
        try {
          if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
          if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
          openRulesModal();
        } catch (err) {
          console.error('[DBE] failed to open rules modal:', err);
        }
      });

      const btnBackup = document.createElement('button');
      btnBackup.type = 'button';
      btnBackup.textContent = 'バックアップと復元';
      Object.assign(btnBackup.style,{ fontSize:'0.9em', margin:'0.5em', padding:'8px 12px' });
      btnBackup.addEventListener('click', (ev) => {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        openBackupWindow();
      });

      grp2Btns.append(btnRules, btnBackup);
      grp2.append(grp2Title, grp2Annot, grp2Btns);
      return grp2;
    }
    // ============================================================
    // △ここまで△ フィルタカード（選別設定）ブロック（共通部品）
    // ============================================================

    function buildChestWindow(){
      const wrap = document.createElement('div');
      Object.assign(wrap.style,{display:'flex',flexDirection:'column',gap:'10px',minWidth:'min(70svw,560px)'});

      // ◇1段目：タイトル
      const ttl = document.createElement('div');
      ttl.textContent = '宝箱の開封と選別条件の設定';
      ttl.style.fontSize = '1.15em';
      ttl.style.fontWeight = 'bold';
      wrap.appendChild(ttl);

      // ◇2段目：フィルタカード（選別設定）ブロック（共通部品）
      wrap.appendChild(buildFilterCardPanel());

      // ◇3段目：テキスト＋宝箱3ボタン（枠内）
      const grp3 = document.createElement('div');
      Object.assign(grp3.style,{border:'1px solid #CCC', borderRadius:'8px', padding:'8px', display:'grid', gap:'8px'});
      // 1行目：テキスト
      const row3a = document.createElement('div');
      const desc = document.createElement('div');
      desc.textContent='宝箱を開けてフィルタカードで選別する';
      Object.assign(desc.style,{fontSize:'1.1em'});
      row3a.appendChild(desc);

      // 2行目：3ボタン（標準／大型／バトル）
      const row3b = document.createElement('div');
      const btns = document.createElement('div');
      Object.assign(btns.style,{margin:'0.5em',display:'flex',gap:'20px',flexWrap:'wrap',justifyContent:'center',alignItems:'center',width:'100%'});
      const btnNormal = document.createElement('button'); btnNormal.id = 'dbe-btn-Chest--normal'; btnNormal.innerHTML='標準の宝箱<br>（武器と防具）';
      const btnLarge  = document.createElement('button'); btnLarge.id  = 'dbe-btn-Chest--large';  btnLarge.innerHTML='大型の宝箱<br>（武器と防具）';
      const btnBattle = document.createElement('button'); btnBattle.id = 'dbe-btn-Chest--battle'; btnBattle.innerHTML='バトル宝箱<br>（ネックレス）';
      [btnBattle, btnLarge, btnNormal].forEach(b=>Object.assign(b.style,{padding:'6px 10px'}));
      btns.append(btnBattle, btnLarge, btnNormal);
      row3b.append(btns);
      grp3.append(row3a, row3b);

      // 「新規装備のみを選別の対象にする」チェックボックス
      const rowOnlyNew = document.createElement('div');
      Object.assign(rowOnlyNew.style,{margin:'0.2em',display:'flex',gap:'12px',flexWrap:'wrap',justifyContent:'center',alignItems:'center',width:'100%'});
      const cbOnlyNew = document.createElement('input');
      cbOnlyNew.type='checkbox';
      cbOnlyNew.id='dbe-check-Chest--onlynew';
      cbOnlyNew.checked = true;
      const lbOnlyNew = document.createElement('label');
      lbOnlyNew.htmlFor = cbOnlyNew.id;
      lbOnlyNew.textContent = '新規装備のみを選別の対象にする';
      rowOnlyNew.append(cbOnlyNew, lbOnlyNew);
      grp3.appendChild(rowOnlyNew);
      wrap.appendChild(grp3);

      // ▼改修：進行UIを必ず出してから元の処理へ（ローカル参照を捕捉）
      const __DBE_local_startChestProcess = startChestProcess;
      function __DBE_prepProgressUI(type){
        try{
          const rLimited   = document.getElementById('dbe-radio-Chest--limited');
          const rUnlimited = document.getElementById('dbe-radio-Chest--unlimited');
          const nTimes     = document.getElementById('dbe-prm-Chest--open-times');
          const DBE_CHEST  = (window.DBE_CHEST = window.DBE_CHEST || {});
          DBE_CHEST.unlimited      = !!(rUnlimited && rUnlimited.checked);
          DBE_CHEST._totalPlanned  = DBE_CHEST.unlimited ? null : Math.max(1, Number(nTimes?.value||1));
          DBE_CHEST.processed      = 0;
          DBE_CHEST._userAbort     = false;
          // 進行UIの起動（window 公開関数経由。未定義でも安全に無視）
          if (window.DBE_StartProgressUI) { window.DBE_StartProgressUI(type); }
          else { /* オーバーレイ(dbeShowOverlay)は撤去済みのため何もしない */ }
          try{ chestDiag && chestDiag('proxy: START', type, {unlimited:DBE_CHEST.unlimited, total:DBE_CHEST._totalPlanned}); }catch(_){}
        }catch(_){}
      }
      btnNormal.addEventListener('click', ()=>{ __DBE_prepProgressUI('normal'); const fn = (window.startChestProcess || __DBE_local_startChestProcess); if (typeof fn==='function') return fn('normal'); });
      btnLarge .addEventListener('click', ()=>{ __DBE_prepProgressUI('large');  const fn = (window.startChestProcess || __DBE_local_startChestProcess); if (typeof fn==='function') return fn('large');  });
      btnBattle.addEventListener('click', ()=>{ __DBE_prepProgressUI('battle'); const fn = (window.startChestProcess || __DBE_local_startChestProcess); if (typeof fn==='function') return fn('battle'); });

      // ◇4段目：回数指定/無制限 ラジオ
      const row4 = document.createElement('div');
      Object.assign(row4.style,{display:'flex',alignItems:'center',gap:'24px',flexWrap:'wrap',width:'100%',justifyContent:'center'});
      const grp = 'dbe-Chest-count-group';
      // 回数指定
      const rLimited = document.createElement('input'); rLimited.type='radio'; rLimited.name=grp; rLimited.id='dbe-radio-Chest--limited';
      const nTimes   = document.createElement('input'); nTimes.type='number'; nTimes.id='dbe-prm-Chest--open-times';
      nTimes.min = '1';
      nTimes.value = '1';
      Object.assign(nTimes.style,{width:'4em', padding:'2px 0 2px 8px'});
      const partLimited = document.createElement('label'); partLimited.htmlFor = rLimited.id;
      Object.assign(partLimited.style,{display:'inline-flex',alignItems:'center',gap:'2px'});
      partLimited.append(rLimited, document.createTextNode('回数指定：'));
      const spanTimes = document.createElement('span'); spanTimes.append(nTimes, document.createTextNode(' 回'));
      // 無制限
      const rUnlimited = document.createElement('input'); rUnlimited.type='radio'; rUnlimited.name=grp; rUnlimited.id='dbe-radio-Chest--unlimited';
      const partUnlimited = document.createElement('label'); partUnlimited.htmlFor = rUnlimited.id;
      partUnlimited.append(rUnlimited, document.createTextNode(' 無制限'));
      // 相互排他と有効/無効
      const syncTimes = ()=>{ nTimes.disabled = !rLimited.checked; };
      rLimited.addEventListener('change', syncTimes);
      rUnlimited.addEventListener('change', syncTimes);
      // 既定は「回数指定」＋ 初期値=1（1未満不可）
      rLimited.checked = true;
      syncTimes();
      nTimes.addEventListener('input', ()=>{
        if (nTimes.value==='' || Number(nTimes.value) < 1) nTimes.value = '1';
      });
      row4.append(partUnlimited, partLimited);
      partLimited.appendChild(spanTimes);
      grp3.appendChild(row4);

      return wrap;
    }

    // 〓〓〓 Chest 背景処理（標準／大型／バトル）→ ロック & 行ごと分解クリック 〓〓〓
    const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
    Object.assign(DBE_CHEST, {
      busy:false,
      iframe:null,
      pre:{wep:new Set(), amr:new Set()},   // 既存ID（新規判定用）
      lastNew:{wep:new Set(), amr:new Set(), nec:new Set()}, // 直近の🔰保持（付替え用）
      qLock:[],                              // ロック用キュー [{table:'wep'|'amr', id:'123'}]
      qRecycle:[],                           // 分解用キュー（DOM の a[href*="/recycle/"] を順次 click）
      qUnlock:[],                            // 最終解除用キュー
      stage:'idle',
      type:null,                             // 'normal' | 'large' | 'battle'
      onlyNew:true,                          // 「新規のみ」フラグ
      onHoldIds:new Set(),                   // メインページで onhold 済ID
      delay:()=>300,                        // 待機ms（間隔±揺らぎ）
      left:1,                                // 残回数（無制限は Infinity）
      unlimited:false,
      liveDom:true,                           // ← 追加：可視DOM適用＆可視DOMで施錠/分解を実行するモード
      didWork:false,                          // ← 追加：作業実施フラグ（ハードリロード安全弁）
      newFound:0,
      // 進行ウインドウ連携用
      processed:0,             // 処理済み回数
      _totalPlanned:null,      // 回数指定の合計（無制限は null）
      _progressTimer:null,     // 進行UI更新用タイマー
      _lootObserved:false,     // 取得結果監視の装着済みフラグ
      _userAbort:false         // 「中断する」押下フラグ（次の実行を抑止）
    });

// ============================================================
    //  バックアップ管理ウインドウ（dbe-W-Backup）
    //    1段目：左＝タイトル(1.1em)、右＝閉じる
    //    2段目：左＝エクスポート、右＝注記
    //    3段目：左＝上書きインポート、右＝注記
    //    4段目：左＝追加インポート、右＝注記
    //    段間の余白は CSS 変数 --dbe-backup-row-gap で後から調整可能
// ============================================================
    function openBackupWindow(){
      const wnd = ensureWindowShell('dbe-W-Backup');
      // max-width を 表示領域の95%か860pxの小さい方に設定（ウインドウ本体）
      try{ Object.assign(wnd.style, { maxWidth: 'min(95vw, 860px)' }); }catch(_){}
      // 既存内容（×ボタン以外）をクリア
      Array.from(wnd.children).forEach((ch,i)=>{ if(i>0) ch.remove(); });
      // コンテナ（2カラム・行間は変数で調整可能）
      const box = document.createElement('div');
      Object.assign(box.style,{
        display:'grid',
        gridTemplateColumns:'11em 1fr',
        columnGap:'0.7em',
        rowGap:'var(--dbe-backup-row-gap, 20px)',
        minWidth:'min(92svw, 560px)',
        maxWidth:'min(95vw, 860px)'
      });
      // 共通：左セル/右セルを作るヘルパ
      const makeRow = ()=>[document.createElement('div'), document.createElement('div')];
      // 1段目：タイトル／閉じる
      {
        const [l,r] = makeRow();
        l.textContent = 'バックアップと復元';
        Object.assign(l.style,{fontSize:'1.1em',fontWeight:'bold',display:'flex',alignItems:'center'});
        // 右側は空（×ボタンはウインドウ標準のものを使用）
        box.append(l,r);
      }
      // 2段目：エクスポート
      {
        const [l,r] = makeRow();
        const b = document.createElement('button');
        Object.assign(l.style,{display:'flex',justifyContent:'flex-end',alignItems:'center'});
        b.textContent = 'エクスポート';
        Object.assign(b.style,{padding:'6px 12px',width:'fit-content'});
        b.addEventListener('click',()=>{ Promise.resolve(dbeExportFilterCards()); });
        l.appendChild(b);
        const t = document.createElement('div');
        t.textContent = 'フィルタカード一覧を .json 形式で書き出します。保存プロセス（保存場所の指定など）は使用ブラウザに依存します。';
        Object.assign(t.style,{opacity:0.9});
        r.appendChild(t);
        box.append(l,r);
      }
      // 3段目：追加インポート
      {
        const [l,r] = makeRow();
        Object.assign(l.style,{display:'flex',justifyContent:'flex-end',alignItems:'center'});
        const fileAP = document.createElement('input');
        fileAP.type = 'file';
        fileAP.accept = '.json,application/json';
        fileAP.style.display = 'none';
        const b = document.createElement('button');
        b.textContent = '追加インポート';
        Object.assign(b.style,{padding:'6px 12px',width:'fit-content'});
        b.addEventListener('click',()=>{ fileAP.click(); });
        fileAP.onchange = async ()=>{
          const f = fileAP.files && fileAP.files[0];
          if (f){
            const ok = await dbeConfirmCommon('確認','インポートしたカードを末尾に追加します。よろしいですか？','OK','キャンセル');
            if (ok) dbeImportFilterCards(f,'append');
          }
          fileAP.value='';
        };
        l.append(b, fileAP);
        const t = document.createElement('div');
        t.textContent = '既存のフィルタカードは維持され、その下にインポートしたカードが追加されます。';
        Object.assign(t.style,{opacity:0.9});
        r.appendChild(t);
        box.append(l,r);
      }
      // 4段目：上書きインポート
      {
        const [l,r] = makeRow();
        Object.assign(l.style,{display:'flex',justifyContent:'flex-end',alignItems:'center'});
        const fileOW = document.createElement('input');
        fileOW.type = 'file';
        fileOW.accept = '.json,application/json';
        fileOW.style.display = 'none';
        const b = document.createElement('button');
        b.textContent = '上書きインポート';
        Object.assign(b.style,{padding:'6px 12px',width:'fit-content'});
        b.addEventListener('click',()=>{ fileOW.click(); });
        fileOW.onchange = async ()=>{
          const f = fileOW.files && fileOW.files[0];
          if (f){
            const ok = await dbeConfirmAlert('警告','既存のフィルタカードをすべて破棄してインポートします。よろしいですか？','はい','いいえ');
            if (ok) dbeImportFilterCards(f,'overwrite');
          }
          fileOW.value='';
        };        l.append(b, fileOW);
        const t = document.createElement('div');
        t.textContent = '既存のフィルタカードはすべて破棄されて、インポートするカードに置き換えられます。';
        Object.assign(t.style,{opacity:0.9});
        r.appendChild(t);
        box.append(l,r);
      }
      wnd.appendChild(box);
      wnd.style.display = 'block';
    }

    function startChestProcess(kind){
      if (DBE_CHEST.busy) { console.warn('[DBE] Chest already running'); return; }
      DBE_CHEST.busy = true;
      DBE_CHEST.qLock = [];
      DBE_CHEST.qRecycle = [];
      DBE_CHEST.qUnlock = [];
      DBE_CHEST.stage = 'init';
      DBE_CHEST.type  = kind;
      DBE_CHEST.didWork = true;              // ← 追加：フロー開始時に作業フラグON
      // ★ 処理の安定化のため、列表示を一時的に「錠/解錠＝表示」「分解＝表示」「ネックレス増減＝表示」に強制
      try{ loadRulesFromStorage(); }catch(_){}
      try{ __dbeForceShowColsForRun(); }catch(_){}
      // オプション取得
      DBE_CHEST.onlyNew = document.getElementById('dbe-check-Chest--onlynew')?.checked !== false;
      const limited = document.getElementById('dbe-radio-Chest--limited')?.checked;
      const nTimes  = Math.max(1, parseInt(document.getElementById('dbe-prm-Chest--open-times')?.value||'1',10));
      DBE_CHEST.unlimited = !limited;
      DBE_CHEST.left      = limited ? nTimes : Infinity;
      // ★ 進捗HUD開始：ループ総数を記録し、HUDを起動（無限の場合は総数未設定）
      try{
        if (typeof startProgressHud === 'function') {
          if (Number.isFinite(DBE_CHEST.left)) DBE_CHEST.total = DBE_CHEST.left;
          startProgressHud();
        }
      }catch(_){}
      // 現在表示中の既存IDを収集
      DBE_CHEST.pre.wep = collectIdsFromMain('wep');
      DBE_CHEST.pre.amr = collectIdsFromMain('amr');
      DBE_CHEST.pre.nec = collectIdsFromMain('nec');
      // onlyNew が OFF の場合：未ロック行を onhold マークして ID控え
      if (DBE_CHEST.onlyNew){
        // 《新規装備のみを選別の対象にする》が ON のとき：
        // 施錠されていない既存装備をフィルタリング対象から外すため、既存未ロックに onhold マークを付与
        // → 以降の選別（ロック／分解）から除外される
        markOnHoldInMain();
        DBE_CHEST.onHoldIds = collectOnHoldIds();
      }
      // 背景iframeを起動
      const fr = ensureBgFrame();
      DBE_CHEST.stage = 'load_chest';
      fr.src = (kind==='battle')
        ? 'https://donguri.5ch.net/battlechest'
        : 'https://donguri.5ch.net/chest';
    }

    function ensureBgFrame(){
      if (DBE_CHEST.iframe && DBE_CHEST.iframe.isConnected) return DBE_CHEST.iframe;
      const fr = document.createElement('iframe');
      fr.id = 'dbe-bg-frame';
      Object.assign(fr.style,{position:'fixed',width:'0',height:'0',border:'0',left:'-9999px',top:'-9999px',visibility:'hidden'});
      fr.addEventListener('load', onBgFrameLoad);
      document.body.appendChild(fr);
      DBE_CHEST.iframe = fr;
      return fr;
    }

    // ──────────────────────────────────────────────────────────
    //  可視DOMパッチャ：iframe/文字列HTMLから /bag の主要テーブルを実ページへ反映
    // ──────────────────────────────────────────────────────────
    function patchBagFromDoc(srcDoc){
      try{
        const ids = ['necklaceTable','weaponTable','armorTable'];
        for (const id of ids){
          const newEl = srcDoc.getElementById(id);
          const oldEl = document.getElementById(id);
          if (newEl && oldEl){
            // クローンしてから置き換え（srcDoc のノードを生で移すと所有ドキュメントが変わる）
            oldEl.replaceWith(newEl.cloneNode(true));
          }
        }
        // ★重要：
        // patchBagFromDoc は table 要素そのものを置き換えるため、
        // initLockToggle/initRecycle が付与していた click リスナーが失われる。
        // 宝箱自動開封の終了後でも /unlock /lock /recycle のリロード抑止が効くように再配線する。
        try{ initLockToggle(); }catch(_){}
        try{ initRecycle(); }catch(_){}
        try{ applyCellColors(); }catch(_){}
      }catch(err){
        console.error('[DBE] patchBagFromDoc error:', err);
      }
    }
    function patchBagFromHTML(html){
      try{
        const doc = new DOMParser().parseFromString(html,'text/html');
        patchBagFromDoc(doc);
      }catch(err){
        console.error('[DBE] patchBagFromHTML error:', err);
      }
    }
    // /lock/:id /recycle/:id /recycleunlocked などを HTTP で実行し、返りの /bag を可視DOMへ適用
    function doActionAndApply(url){
      const needs = (re)=>typeof re==='string' && (re.includes('id="weaponTable"')||re.includes("id='weaponTable'"));
      const cred = {credentials:'include', redirect:'follow'};
      const wait = (ms)=>new Promise(r=>setTimeout(r, ms));
      const nextDelay = (typeof DBE_CHEST.delay==='function'? DBE_CHEST.delay(): 300);
      return fetch(url, cred)
        .then(r=>r.text())
        .then(html=>{
          if (!needs(html)){
            // リダイレクト等で /bag 全文になっていない場合は /bag を明示取得
            return fetch('/bag', cred).then(r=>r.text()).then(patchBagFromHTML);
          } else {
            patchBagFromHTML(html);
          }
        })
        .then(()=>wait(nextDelay))
        .catch(err=>{
          console.error('[DBE] doActionAndApply error:', err);
        });
    }

    // ──────────────────────────────────────────────────────────
    //  iframe ロードハンドラ（宝箱オープンをバックグラウンドで実行）
    // ──────────────────────────────────────────────────────────
    // ---- ID収集：各行の「装備」リンク /equip/{id} を拾う ----
    function collectRowIdsFromTable(tableId, doc){
      const root = doc || document;
      const table = root.getElementById(tableId); if (!table) return new Set();
      const body  = table.tBodies && table.tBodies[0]; if (!body) return new Set();
      const ids = new Set();
      Array.from(body.rows).forEach(row=>{
        const a = row.querySelector('a[href*="/equip/"]');
        const m = a && a.getAttribute('href').match(/\/equip\/(\d+)/);
        if (m) ids.add(m[1]);
      });
      return ids;
    }

    function clearNewbieBadgesInTable(tableId){
      const table = document.getElementById(tableId); if (!table) return;
      const body  = table.tBodies && table.tBodies[0]; if (!body) return;
      Array.from(body.rows).forEach(row=>{
        const nameTd = getNameCell(row);
        if (nameTd) window.DBE_setNameBadge.newbie(nameTd,false);
      });
    }

    function addNewbieBadgeByIds(tableId, idSet){
      const BADGE = dbeEnsureNameBadgeApi();
      const table = document.getElementById(tableId); if (!table) return;
      const body  = table.tBodies && table.tBodies[0]; if (!body) return;
      Array.from(body.rows).forEach(row=>{
        const a = row.querySelector('a[href*="/equip/"]');
        const m = a && a.getAttribute('href').match(/\/equip\/(\d+)/);
        if (!m) return;
        if (idSet.has(m[1])){
          const nameTd = getNameCell(row);
          if (nameTd) BADGE.newbie(nameTd,true);
        }
      });
    }

    function dbeMarkOnlyNewByIds(tableId, idSet){
      const table = document.getElementById(tableId); if (!table) return;
      const body  = table.tBodies && table.tBodies[0]; if (!body) return;
      Array.from(body.rows||[]).forEach(row=>{
        try{
          const a = row.querySelector('a[href*="/equip/"]');
          const m = a && a.getAttribute('href') && a.getAttribute('href').match(/\/equip\/(\d+)/);
          if (!m) return;
          const id = m[1];
          if (idSet && idSet.has(id)){
            row.classList.add('dbe-prm-Chest--onlynew');
            if (row.dataset) row.dataset.dbeOnlynew = '1';
          }
        }catch(_){}
      });
    }

    function dbeLogOnlyNewHighLootOnce(){
      try{
        const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
        const posted = (DBE_CHEST._onlyNewLogged = DBE_CHEST._onlyNewLogged || new Set());
        const tables = ['#necklaceTable','#weaponTable','#armorTable'];
        for (const sel of tables){
          const table = document.querySelector(sel);
          if (!table || !table.tBodies || !table.tBodies[0]) continue;
          const rows = Array.from(table.tBodies[0].rows||[]);
          for (const tr of rows){
            try{
              if (!tr.classList || (!tr.classList.contains('dbe-prm-Chest--onlynew') && tr.dataset?.dbeOnlynew!=='1')) continue;
              const a = tr.querySelector('a[href*="/equip/"]');
              const m = a && a.getAttribute('href') && a.getAttribute('href').match(/\/equip\/(\d+)/);
              const id = m ? m[1] : null;
              if (!id || posted.has(id)) continue;
              const nameTd = Array.from(tr.cells||[]).find(td => td.querySelectorAll('span').length >= 2) || tr.cells?.[0] || null;
              const meta = nameTd ? dbeParseNameTd(nameTd) : null;
              if (!meta) continue;
              // ネックレス：Pt/Au
              if (meta.kind === 'necklace' && (meta.gradeKey==='Pt' || meta.gradeKey==='Au')){
                dbeAppendLog(dbeLootLineNecklace(meta.name, meta.gradeKey, meta.number));
                posted.add(id);
                continue;
              }
              // 武器/防具：UR/SSR
              if ((meta.kind==='weapon' || meta.kind==='armor') && (meta.rarity==='UR' || meta.rarity==='SSR')){
                dbeAppendLog(dbeLootLineEquip(meta.name, meta.rarity));
                posted.add(id);
                continue;
              }
            }catch(_){}
          }
        }
      }catch(_){}
    }

    // 直前ループでの新規セットを一括反映（武器・防具 or ネックレス）
    function updateNewbieBadgesAfterChest(kind, doc){
      // kind: 'normal'|'large'|'battle'
      if (kind==='battle'){
        // ネックレスのみ：前の🔰を全消し → 今回の新規だけ付ける
        clearNewbieBadgesInTable('necklaceTable');
        const currentIds = collectRowIdsFromTable('necklaceTable', document);
        // 直前の chest 前と比較して「増えた分」を新規とみなす
        const preSet = DBE_CHEST.pre && DBE_CHEST.pre.nec || new Set(); // 無ければ空
        const newly = new Set([...currentIds].filter(id=> !preSet.has(id)));
        DBE_CHEST.lastNew.nec = newly;
        addNewbieBadgeByIds('necklaceTable', newly);
        dbeMarkOnlyNewByIds('necklaceTable', newly);
        dbeLogOnlyNewHighLootOnce();
        return;
      }
      // 標準／大型：武器・防具
      ['weaponTable','armorTable'].forEach((tid, i)=>{
        const key = i===0 ? 'wep' : 'amr';
        clearNewbieBadgesInTable(tid);
        const currentIds = collectRowIdsFromTable(tid, document);
        const preSet = (DBE_CHEST.pre && DBE_CHEST.pre[key]) || new Set();
        const newly = new Set([...currentIds].filter(id=> !preSet.has(id)));
        DBE_CHEST.lastNew[key] = newly;
        addNewbieBadgeByIds(tid, newly);
        dbeMarkOnlyNewByIds(tid, newly);
      });
      dbeLogOnlyNewHighLootOnce();
    }

    // ──────────────────────────────────────────────────────────
    //  背景タブ/非アクティブ時でも宝箱処理を止めないための “次フレーム” ヘルパ
    //   - requestAnimationFrame は非表示タブで停止/極端に間引かれることがある
    //   - その場合は setTimeout(0) にフォールバックしてフロー継続
    // ──────────────────────────────────────────────────────────
    function dbeChestNextFrame(fn){
      try{
        const vis = (typeof document !== 'undefined' && document.visibilityState) ? document.visibilityState : 'visible';
        if (vis === 'visible' && typeof requestAnimationFrame === 'function'){
          requestAnimationFrame(fn);
        } else {
          setTimeout(fn, 0);
        }
      }catch(_){
        setTimeout(fn, 0);
      }
    }

    function onBgFrameLoad(){
      const DBE_CHEST = (window.DBE_CHEST = window.DBE_CHEST || {});
      try{
        console.assert(typeof scheduleNextLock === 'function', '[DBE] scheduleNextLock is not a function');
        const fr = DBE_CHEST.iframe;
        if (!fr || !fr.contentDocument) return;
        const doc = fr.contentDocument;
        const loc = fr.contentWindow.location.href;
        // URL種別（誤検知防止のため先に判定）
        const isBag   = /\/bag(?:$|[?#])/.test(loc);
        const isChest = /\/(?:battlechest|chest)(?:$|[?#])/.test(loc);
        // ステージごとの処理
        if (DBE_CHEST.stage === 'load_chest'){
          // 背景ページの送信ボタンをクリック
          // ページ実体は「バトル宝箱を開く  」等となっており、末尾スペースや表記ゆれを吸収する
          const type = DBE_CHEST.type;
          const val = (s)=> (s||'').replace(/\s+/g,'').trim();
          // 種別ごとの候補（正規表現／文字列の両方で吸収）
          const matcher = (el)=>{
            const v = val(el.value);
            if (type==='battle')   return /バトル?宝箱を開(く|ける)/.test(v);
            if (type==='normal')   return /標準サイズの宝箱を開ける/.test(v);
            /* large */            return /大型サイズの宝箱を開ける/.test(v);
          };
          // まず input[type=submit] を走査、見つからなければ form[action*="battlechest"] 直下の submit を拾う
          let btn = Array.from(doc.querySelectorAll('input[type="submit"]')).find(matcher);
          if (!btn && type==='battle'){
            btn = doc.querySelector('form[action*="battlechest"] input[type="submit"], form[action*="openbattlechest"] input[type="submit"]');
          }
          if (!btn){
            // 送信ボタンが見つからない場合のみサーバーエラー推定を実施
            const errText = !isChest ? extractServerErrorText(doc) : null;
            if (errText){
              console.warn('[DBE] Server error detected during chest-open flow');
              handleServerErrorAndStopFlow(doc, errText);
              return;
            }
            console.error('[DBE] submit button not found:', label);
            (window.DBE_finishChest ? window.DBE_finishChest() : finishChest());
            return;
          }
          // 中断要求がある場合は、次の宝箱を開ける前に終了（現在の選別処理は完了している想定）
          if (DBE_CHEST._userAbort){
            chestDiag('userAbort: stop before next open');
            (window.DBE_finishChest ? window.DBE_finishChest() : finishChest());
            return;
          }
          // 分子（開封回数）を加算：送信の直前にカウント
          try{ dbeChestBumpProcessed(dbeChestOpenStep(), 'open', loc); }catch(_){ }
          DBE_CHEST.stage = 'submit_chest';
          setTimeout(()=>btn.click(), 50);
          return;
        }
        // 宝箱オープン後は /bag が返る想定
        if (/\/bag(?:$|[?#])/.test(loc)){
          if (DBE_CHEST.stage === 'submit_chest'){
            // ① 返ってきた /bag を“可視DOMへ”適用（書き込みは rAF に寄せてレイアウト強制を避ける）
            const targetDoc = DBE_CHEST.liveDom ? document : doc; // 読み取り対象を先に確定
            // 読み取り（キュー構築に必要な情報はなるべくここで収集）
            // ※ buildLockQueuesAfterOpen は読む→書くが混在しやすいので、先に読む処理へ寄せられるなら寄せる
            // 書き込みは rAF でフレーム境界に回す
            dbeChestNextFrame(()=>{
              if (DBE_CHEST.liveDom){ patchBagFromDoc(doc); } // 書き込み
              // ② onhold ロック＋ ルールでロック／分解対象をキュー化（可視DOMを基準に組み立て）
              buildLockQueuesAfterOpen(targetDoc);            // 読み→一部書きがあっても同一フレームで完結
              // ③ 🔰（新規）バッジの付替えと ❓（解析失敗）の再評価
              try{ updateNewbieBadgesAfterChest(DBE_CHEST.type, targetDoc); }catch(_){}
              try{ refreshUnknownBadges(); }catch(_){}
              // ④ 以降の分岐決定も同フレーム内で行う
              if (DBE_CHEST.qLock.length>0){
                DBE_CHEST.stage = 'locking';
                scheduleNextLock();
              } else if (DBE_CHEST.qRecycle && DBE_CHEST.qRecycle.length>0){
                DBE_CHEST.stage = 'recycling';
                scheduleNextRecycle();
              } else {
                if (DBE_CHEST.unlimited
                    && DBE_CHEST.qLock.length===0
                    && (!DBE_CHEST.qRecycle || DBE_CHEST.qRecycle.length===0)
                    && (DBE_CHEST.onlyNew ? (DBE_CHEST.newFound||0)===0 : false)) {
                  window.DBE_finishChest && window.DBE_finishChest();
                } else {
                  afterIterationStep(targetDoc);
                }
              }
            });
            return;
          }
          if (DBE_CHEST.stage === 'locking'){
            // ロック操作は scheduleNextLock() 内で次を決める
            return;
          }
          if (DBE_CHEST.stage === 'recycling'){
            // 分解列リンクの逐次実行（/bag → /recycle/ → /bag …）
            if (DBE_CHEST.qRecycle && DBE_CHEST.qRecycle.length>0){
              scheduleNextRecycle();
            } else {
              afterIterationStep(DBE_CHEST.liveDom ? document : doc);
            }
            return;
          }
          if (DBE_CHEST.stage === 'recycle_unlocked'){
            // /recycleunlocked の戻り（/bag）→ 次ループ or 最終解除へ
            afterIterationStep(DBE_CHEST.liveDom ? document : doc);
            return;
          }
          if (DBE_CHEST.stage === 'unlock_onhold_prep'){
            // 最終：onhold ID の解除キューを組んで解除へ
            buildUnlockQueueFromIframe(DBE_CHEST.liveDom ? document : doc);
            if (DBE_CHEST.qUnlock.length>0){
              DBE_CHEST.stage = 'unlocking';
              scheduleNextUnlock();
            }else{
              (window.DBE_finishChest ? window.DBE_finishChest() : finishChest());
            }
            return;
          }
          if (DBE_CHEST.stage === 'unlocking'){
            // 解除操作は scheduleNextUnlock() 内で次を決める
            return;
          }
        } else {
          // /bag でも /chest でもないページに遷移している（開封フロー中）→ 既知/未知に関わらずサーバーエラー扱い
          const errText = (!isBag && !isChest && DBE_CHEST.stage !== 'idle')
            ? (extractServerErrorText(doc) || extractLooseErrorText(doc) || 'Unknown Error')
            : null;
          if (errText){
            console.warn('[DBE] Server error detected during chest-open flow');
            handleServerErrorAndStopFlow(doc, errText);
            return;
          }
        }
      }catch(err){
        console.error('[DBE] onBgFrameLoad error:', err);
        (window.DBE_finishChest && window.DBE_finishChest());
      }
    }

    // === patch (post-define): ensure battlechest opens on iframe load ===
    function dbePatchBattleOpenPostDefine(){
      const orig = window.onBgFrameLoad; // 直前に定義された“本体”を確実に捕まえる
      function findOpenBtn(doc, type){
        const root = doc || document;
        const queries = [];
        if (type === 'battle'){
          // バトル宝箱向けセレクタ
          queries.push(
            'form[action*="openbattlechest"] button[type="submit"]',
            'form[action*="openbattlechest"] input[type="submit"]',
            'form[action*="battlechest"] button[type="submit"]',
            'form[action*="battlechest"] input[type="submit"]'
          );
        } else {
          // 通常宝箱セレクタ
          queries.push(
            'form[action*="openchest"] button[type="submit"]',
            'form[action*="openchest"] input[type="submit"]',
            'form[action*="chest"] button[type="submit"]',
            'form[action*="chest"] input[type="submit"]'
          );
        }
        for (const sel of queries){
          const el = root.querySelector(sel);
          if (el) return el;
        }
        return null;
      }
      window.onBgFrameLoad = function(ev){
        try{
          const fr  = ev && ev.currentTarget;
          const doc = fr && fr.contentDocument;
          const type = (window.DBE_CHEST && window.DBE_CHEST.type) || null;
          // サーバーエラー検知（エラー時は以降の処理を完全停止）
          const err = extractServerErrorText(doc);
          if (err) return handleServerErrorAndStopFlow(doc, err);
          if (type === 'battle' && doc){
            // バトル宝箱：まず「開ける」要素を見つけてクリック（ラベル不一致でも action で拾う）
            const openEl = findOpenBtn(doc, 'battle');
            if (openEl){
              if (window.DBE_CHEST && window.DBE_CHEST._userAbort){
                chestDiag('userAbort: stop before next open (battle patch)');
                (window.DBE_finishChest ? window.DBE_finishChest() : undefined);
                return;
              }
              try{ dbeChestBumpProcessed(dbeChestOpenStep(), 'open', (doc && doc.URL) || ''); }catch(_){ }
              openEl.click();
              return; // 次の load で /bag へ戻る想定（本体は /bag 側で動作）
            } else {
              console.warn('[DBE] battlechest open element not found (post-define)');
            }
          }
        } catch (e) {
          console.warn('[DBE] battle open patch (post-define) failed:', e);
        }
        // 既存本体も必ず実行（通常/大型フローや後段処理を保持）
        return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
      };
    }
    dbePatchBattleOpenPostDefine();

    function finishChest(){
      // 進行UIの停止（中断/完了共通）
      try{ (window.DBE_CHEST = window.DBE_CHEST || {})._autoRunning = false; }catch(_){ }
      try{ if (typeof dbeFinishProgressUI === 'function') dbeFinishProgressUI(); }catch(_){ }
      // 終了メッセージ
      hideOverlay();
      DBE_CHEST.stage   = 'idle';
      DBE_CHEST.busy    = false;
      // HUD終了
      try{ stopProgressHud(); }catch(_){}
      console.log('[DBE] Chest flow finished');
      // 追加マーキング：未ロックかつ未マーキングへ onhold を付与（失敗は握りつぶし）
      try{ applyOnHoldToCurrentUnlocked(/*onlyNotMarked=*/true); }catch(_){}
      // ★ 自動で OFF → ON と切り替えた列表示状態を元に戻す
      try{ __dbeRestoreColsAfterRun(); }catch(_){}
      DBE_CHEST.onHoldIds = new Set();
      // 何も操作していなければハードリロードは抑止
      if (!DBE_CHEST.didWork) {
        console.warn('[DBE] finishChest: skip hard reload (no work performed)');
        return;
      }
      DBE_CHEST.didWork = false;
      try{
        const now = Date.now();
        const key = 'dbe-last-hard-reload';
        const last = Number(sessionStorage.getItem(key) || 0);
        if (now - last < 3000) return;             // 3秒以内の連続リロードを抑止
        sessionStorage.setItem(key, String(now));

        // トップウィンドウを通常リロード（ブラウザの更新と同等：ユーザースクリプト再実行を担保）
        const topWin = (window.top || window);
        if (topWin && topWin.location && typeof topWin.location.reload === 'function'){
          topWin.location.reload();                 // キャッシュはブラウザ設定に従う
        } else {
          window.location.href = window.location.href; // フォールバック
        }
      }catch(_){
       /* 失敗時は静かにスキップ（無限ループ回避） */
      }
    }
    // expose for external handlers
    window.DBE_finishChest = finishChest;

    // ── 新規ID抽出（表示中メイン） ──
    function collectIdsFromMain(kind){
      const doc = document;
      const ids = new Set();
      const sel = kind==='wep' ? '#weaponTable' : (kind==='amr' ? '#armorTable' : '#necklaceTable');
      const table = doc.querySelector(sel);
      if (!table || !table.tBodies[0]) return ids;
      const map = headerMap(table);
      const iEqup = map['装']; // 装列（装備リンク）からIDを取る
      if (iEqup<0) return ids;
      Array.from(table.tBodies[0].rows).forEach(tr=>{
        const a = tr.cells[iEqup]?.querySelector('a[href*="/equip/"]');
        const id = a?.href?.match(/\/equip\/(\d+)/)?.[1];
        if (id) ids.add(id);
      });
      return ids;
    }

   // ── メインページで未ロック（/lock/）の行にマーキング付与 ──
    function markOnHoldInMain(){
      const mark = (tableSel)=>{
        const table = document.querySelector(tableSel);
        if (!table || !table.tBodies[0]) return;
        const map = headerMap(table);
        const iEqup = map['装'], iLock = map['解'];
        if (iEqup<0 || iLock<0) return;
        Array.from(table.tBodies[0].rows).forEach(tr=>{
          const lockA = tr.cells[iLock]?.querySelector('a[href]');
          const aEqup = tr.cells[iEqup]?.querySelector('a[href*="/equip/"]');
          const id = aEqup?.href?.match(/\/equip\/(\d+)/)?.[1];
          if (!id || !lockA) return;
          const href = String(lockA.getAttribute('href')||'');
          if (href.includes('/lock/')){ // 未ロック（＝ロック操作が可能）
            tr.classList.add('dbe-prm-Chest--onhold');
          }
        });
      };
      ['#necklaceTable','#weaponTable','#armorTable'].forEach(mark);
    }

    // ── メインページから onhold マーク済みIDを収集 ──
    function collectOnHoldIds(){
      const ids = new Set();
      const collect = (tableSel)=>{
        const table = document.querySelector(tableSel);
        if (!table || !table.tBodies[0]) return;
        const map = headerMap(table);
        const iEqup = map['装'];
        if (iEqup<0) return;
        Array.from(table.tBodies[0].rows).forEach(tr=>{
          if (!tr.classList.contains('dbe-prm-Chest--onhold')) return;
          const a = tr.cells[iEqup]?.querySelector('a[href*="/equip/"]');
          const id = a?.href?.match(/\/equip\/(\d+)/)?.[1];
          if (id) ids.add(id);
        });
      };
      ['#necklaceTable','#weaponTable','#armorTable'].forEach(collect);
      return ids;
    }

    // ── 未ロック（/lock/）かつ未マーキングの行へ onhold を付与 ──
    function applyOnHoldToCurrentUnlocked(onlyNotMarked){
      const apply = (tableSel)=>{
        const table = document.querySelector(tableSel);
        if (!table || !table.tBodies[0]) return;
        const map = headerMap(table);
        const iLock = map['解'];
        if (iLock<0) return;
        Array.from(table.tBodies[0].rows).forEach(tr=>{
          const lockA = tr.cells[iLock]?.querySelector('a[href]');
          if (!lockA) return;
          const href = String(lockA.getAttribute('href')||'');
          if (href.includes('/lock/')){ // 未ロック
            if (!onlyNotMarked || !tr.classList.contains('dbe-prm-Chest--onhold')){
              tr.classList.add('dbe-prm-Chest--onhold');
            }
          }
        });
      };
      ['#necklaceTable','#weaponTable','#armorTable'].forEach(apply);
    }

    // 〓〓〓 宝箱を連続開封し、選別して施錠or分解or保留する 〓〓〓
    function buildLockQueuesAfterOpen(doc){

      // 宝箱の開封間隔：三角分布（最小0秒, 最頻0.1秒, 最大0.3秒）
      DBE_CHEST.delay = ()=> {
        const min = 0, mode = 0.1, max = 0.3;
        const u = Math.random();
        const c = (mode - min) / (max - min);
        let x;
        if (u < c) {
          x = min + Math.sqrt(u * (max - min) * (mode - min));
        } else {
          x = max - Math.sqrt((1 - u) * (max - min) * (max - mode));
        }
        return x * 1000;
      };

      // 共通ヘルパー：ネックレス効果解析（Buff/DeBuffの個数、増減％合計、unknown）
      function dbeParseNecEffects(tr, iAttr, iName){
        // 診断フラグ：window.DBE_DEBUG===true もしくは window.DBE_DEBUG.nec が真なら詳細ログを出力
        const DBG = !!(window.DBE_DEBUG && (window.DBE_DEBUG===true || window.DBE_DEBUG.nec));
        let buffCnt = 0, debuffCnt = 0, deltaTot = NaN, unknownCnt = 0;
        const details = []; // {k,v,type}
        if (iAttr >= 0){
          const cell = tr.cells[iAttr];
          const _buff   = Array.isArray(buffKeywords)   ? buffKeywords   : [];
          const _debuff = Array.isArray(debuffKeywords) ? debuffKeywords : [];
          if (cell){
            cell.querySelectorAll('li').forEach(function(li){
              const mm = (li.textContent||'').trim().match(/(\d+)%\s*(.+)$/);
              if (!mm) return;
              const v = +mm[1], k = mm[2].trim();
              if (_buff.includes(k)) {
                buffCnt++;
                deltaTot = (isNaN(deltaTot)?0:deltaTot) + v;
                if (DBG) details.push({k,v,type:'buff'});
              } else if (_debuff.includes(k)) {
                debuffCnt++;
                deltaTot = (isNaN(deltaTot)?0:deltaTot) - v;
                if (DBG) details.push({k,v,type:'debuff'});
              } else {
                unknownCnt++;
                if (DBG) details.push({k,v,type:'unknown'});
              }
            });
          }
        }
        // unknown があれば名称列に❓バッジを付与（重複付与防止）
        if (unknownCnt>0 && iName>=0) {
          const nameCell = tr.cells[iName];
          if (nameCell && !nameCell.querySelector('.dbe-unk-badge')){
            const sp = document.createElement('span');
            sp.textContent = '❓';
            sp.className = 'dbe-unk-badge';
            Object.assign(sp.style,{ marginLeft:'0.3em', fontWeight:'bold' });
            nameCell.appendChild(sp);
          }
        }
        if (DBG){
          try{
            const unk = details.filter(d=>d.type==='unknown').map(d=>d.k);
            console.debug('[DBE][NEC] effects buff=%d debuff=%d delta=%s unknown=%d', buffCnt, debuffCnt, (isNaN(deltaTot)?'NaN':deltaTot), unknownCnt);
            if (details.length){
              console.debug('[DBE][NEC] details:', details);
            }
            if (unk.length){
              console.debug('[DBE][NEC] unknown keys:', Array.from(new Set(unk)));
            }
          }catch(_e){}
        }
        return { buffCnt, debuffCnt, delta: deltaTot, unknownCnt, hasUnknown: unknownCnt>0 };
      }

      const onlyNew  = !!DBE_CHEST.onlyNew;
      const onHoldId = DBE_CHEST.onHoldIds || new Set();
      const newIdsLoop = new Set();   // この関数の1回の走査で見付けた「新規」ID

      const pushNewFrom = (sel, kind, preSet)=>{
        const table = doc.querySelector(sel);
        if (!table || !table.tBodies[0]) return;
        const map = headerMap(table);
        const iName  = map[kind==='wep'?'武器':(kind==='amr'?'防具':'ネックレス')];
        const iEqup  = map['装'];
        const iElem  = map['ELEM']>=0 ? map['ELEM'] : (map['属性']>=0? map['属性'] : -1);
        const iMrm   = map['マリモ'];
        const iRar   = map['Rarity']>=0 ? map['Rarity'] : (map['レアリティ']>=0? map['レアリティ'] : -1);
        const iLock  = map['解'];
        const iAttr  = (map['属性']>=0 ? map['属性'] : (map['ELEM']>=0? map['ELEM'] : -1));
        // 分解リンク列（/recycle/）の列インデクス
        const iRycl  = map['分解'];

        // ☆ 追加：武器は SPD、防具は WT. の列インデクスを拾う
        // テーブル見出しから SPD（武器） と WT.（防具） の列インデクスを取得
        // rowInfo に spd／wt 数値を格納（行セルから数値抽出）
        // ** 注意点として、防具の「WT.」見出しはドット付きが前提です（headerMap で 'WT.' を引いています）。
        // ** もし実ページ側ヘッダーが「WT」等へ変わるとインデクスが取れず、このパッチでも評価できません
        // ** 実ヘッダー表記が「WT.」であることを維持ください。
          const iSpd   = (kind==='wep') ? map['SPD']  : -1;
          const iWgt   = (kind==='amr') ? map['WT.']  : -1;
          const iAtk   = (kind==='wep') ? map['ATK']  : -1;
          const iDef   = (kind==='amr') ? map['DEF']  : -1;
          const iCrit  = (kind==='wep' || kind==='amr') ? map['CRIT'] : -1;

          // ☆ どの列が必要かは、現在のカード内容から動的に決める
          //    可能な限り両方の保存先に対応（_rulesData / DBE_RULES）
          const rulesRaw =
            (window.DBE_RULES && Array.isArray(window.DBE_RULES[kind]) ? window.DBE_RULES[kind] :
            (Array.isArray(window._rulesData?.[kind]) ? window._rulesData[kind] : [])) || [];

          const needRar  = rulesRaw.some(r => Array.isArray(r.rar)  ? r.rar.length>0  : !!r.rar);
          const needElem = rulesRaw.some(r => Array.isArray(r.elem) ? r.elem.length>0 : !!r.elem);
          const needMrm  = rulesRaw.some(r => r.mrm && r.mrm.mode === 'spec');
          // 武器/防具の数値比較フラグ（SPD / WT.）
          const needSpd  = (kind==='wep') && rulesRaw.some(r => r && r.spd && String(r.spd.value ?? '') !== '');
          const needWgt  = (kind==='amr') && rulesRaw.some(r => r && r.wt  && String(r.wt.value  ?? '') !== '');
          // 追加：武器 ATK(min/max) / 防具 DEF(min/max) / 武器・防具 CRIT
          const needAtk  = (kind==='wep') && rulesRaw.some(r => {
            const mn = r && r.minATK && String(r.minATK.value ?? '') !== '';
            const mx = r && r.maxATK && String(r.maxATK.value ?? '') !== '';
            return mn || mx;
          });
          const needDef  = (kind==='amr') && rulesRaw.some(r => {
            const mn = r && r.minDEF && String(r.minDEF.value ?? '') !== '';
            const mx = r && r.maxDEF && String(r.maxDEF.value ?? '') !== '';
            return mn || mx;
          });
          const needCrit = (kind==='wep' || kind==='amr') && rulesRaw.some(r => {
            const c = (r && (r.crit || r.CRIT));
            if (!c) return false;
            return String(c.value ?? '') !== '';
          });
          // 分解ルールが1つでもあれば「分解」列を必須扱いにする
          const needRecycle = rulesRaw.some(r => r && r.type === 'del');

          const needGrade = (kind==='nec') && rulesRaw.some(r => r && r.grade && !r.grade.all && Array.isArray(r.grade.list) && r.grade.list.length>0);
          const needProp  = (kind==='nec') && rulesRaw.some(r => r && (r.prop || r.propCount || r.property) && !(r.prop || r.propCount || r.property).all);
          const needBuff  = (kind==='nec') && rulesRaw.some(r => r && r.buff   && !r.buff.all);
          const needDebuff= (kind==='nec') && rulesRaw.some(r => r && r.debuff && !r.debuff.all);
          const needDelta = (kind==='nec') && rulesRaw.some(r => r && r.delta  && !r.delta.all && String(r.delta.value ?? '') !== '');

          // ☆ 必須列の検証（不足があれば一覧を出して中断）
          const missing = [];

          // 名前列：武器 or 防具（rowInfo.name 正常化に使用）
          if (iName < 0) missing.push(kind==='wep' ? '武器' : '防具');

          // 動作列：装/解（施錠・分解のクリックに必須）
          // ※ map での重複チェックは不要。iEqup / iLock に一本化する。
          if (iEqup < 0) missing.push('装');
          if (iLock < 0) missing.push('解');
          if (needRecycle && (map['分解'] ?? -1) < 0) missing.push('分解');

          // 条件列：カードが使っているものだけ必須化
          if (needElem && (map['ELEM'] ?? -1) < 0) missing.push('ELEM');
          if (needMrm  && iMrm < 0)              missing.push('マリモ');
          if (needRar  && iRar < 0)              missing.push('Rarity/レアリティ');
          if (needSpd  && iSpd < 0)              missing.push('SPD');
          if (needWgt  && iWgt < 0)              missing.push('WT.');
          if (needAtk  && iAtk < 0)              missing.push('ATK');
          if (needDef  && iDef < 0)              missing.push('DEF');
          if (needCrit && iCrit < 0)             missing.push('CRIT');
          if (kind==='nec' && (needProp || needBuff || needDebuff || needDelta) && iAttr < 0) missing.push('属性');
          if (missing.length > 0){
            // 重複除去
            { const uniq=[]; for (const m of missing){ if(!uniq.includes(m)) uniq.push(m);} missing.length=0; missing.push(...uniq); }
            const tbl = table.id || '(no id)';
            const msg = [
              '以下の列を検出できませんでした：',
              ' - ' + missing.join('\n - '),
              `テーブル: ${tbl}`,
              '',
              '列ヘッダーの表記ゆれ（例：WT. のドット有無）や列の非表示化が原因の可能性があります。'
            ].join('\n');
            console.error('[DBE][ERROR] Missing columns: %o (table=%s)', missing, tbl);
            dbeAbortChest(msg);
            return;
          }

          // ☆ 参考ログ（見つかった主な列のインデクス）
          console.debug('[DBE] header indices: table=%s kind=%s name=%d equip(装)=%d unlock(解)=%d elem=%d mrm=%d rar=%d spd=%d wt.=%d atk=%d def=%d crit=%d',
            table.id || '(no id)', kind, iName, iEqup, iLock, map['ELEM'] ?? -1, iMrm, iRar, iSpd, iWgt, iAtk, iDef, iCrit);

          // ☆ 追加：数値抽出ヘルパー（空や非数値は NaN になる＝判定時に不一致で落とす）
          const numFromCell = (td)=> {
          const t = (td?.textContent || '').replace(/[^\d.\-]/g,'').trim();
          // 小数が来ても parseInt で整数化（必要に応じて parseFloat に切替可）
          const v = t ? parseFloat(t) : NaN;
          return Number.isFinite(v) ? v : NaN;
        };

          // ☆ 追加：範囲（min/max）抽出ヘルパー（ATK/DEF 用）
          const rangeFromCell = (td)=>{
            const nums = String(td?.textContent || '').match(/\d+/g);
            if (!nums || !nums.length) return {min:NaN, max:NaN};
            const a = parseInt(nums[0],10);
            const b = (nums.length>1) ? parseInt(nums[1],10) : a;
            return {min:(Number.isFinite(a)?a:NaN), max:(Number.isFinite(b)?b:NaN)};
          };

        Array.from(table.tBodies[0].rows).forEach(tr=>{

          const a = tr.cells[iEqup]?.querySelector('a[href*="/equip/"]');
          const id = a?.href?.match(/\/equip\/(\d+)/)?.[1];
          if (!id) return;
          // ① onhold 付与済みは「保留」＝選別（ロック/分解）対象からスキップ
          if (onHoldId.has(id)) return;
          // ↓ ここを追加（preSetに無ければ「新規」）
          if (!preSet.has(id)) newIdsLoop.add(id);
          // ロック/解錠セル（列特定に失敗した場合は行全体から推定）
          const lockCand = (iLock>=0 ? tr.cells[iLock] : tr);
          const aLock = lockCand?.querySelector?.('a[href*="/lock/"], a[href*="/unlock/"]');
          const hrefL = String(aLock?.getAttribute?.('href')||'');
          // onlyNew=ON（既定）：既存は対象外（新規のみ評価）
          if (onlyNew && preSet.has(id)) return;
          // ルール評価：'lock'→ロックキュー、'del'→分解キュー、null→保留
          // ★ rarity フォールバック強化：行全体からも抽出
          const _rawName = iName>=0 ? (tr.cells[iName]?.textContent||'') : '';
          const _rawRar  = iRar>=0  ? (tr.cells[iRar]?.textContent||'')  : '';
          const _rowText = tr.textContent || '';
          const _rarHit  = dbePickRarityFromText(_rawRar)
                          || dbePickRarityFromText(_rawName)
                          || dbePickRarityFromText(_rowText)
                          || '';
          // ★ element フォールバック強化：行全体からも抽出
          const pickElem = ()=>{
            // 1) 明示列があれば、それを正規化して採用
            if (iElem>=0){
              const norm = normalizeElem(tr.cells[iElem]?.textContent||'');
              return norm || '__unknown__';
            }
            // 2) 行テキストから推測（正規化）
            const candidates=['火','氷','雷','風','地','水','光','闇','なし'];
            const t = _rowText;
            for (const err of candidates){ if (t.includes(err)) return err; }
            // 3) 見つからなければ「未特定」
            return '__unknown__';
          };
          const atkR = (kind==='wep' && iAtk>=0) ? rangeFromCell(tr.cells[iAtk]) : null;
          const defR = (kind==='amr' && iDef>=0) ? rangeFromCell(tr.cells[iDef]) : null;
          const rowInfo = {
            id,
            name : normalizeItemName(_rawName),
            elem : pickElem(),
            mrm  : iMrm>=0 ? parseInt((tr.cells[iMrm]?.textContent||'0').replace(/[^\d]/g,''),10)||0 : 0,
            rar  : _rarHit,
            kind,
            // ☆ 追加：行から SPD / WT. / ATK / DEF / CRIT を数値抽出（なければ NaN）
            spd  : (kind==='wep' && iSpd>=0) ? numFromCell(tr.cells[iSpd]) : NaN,
            wt   : (kind==='amr' && iWgt>=0) ? numFromCell(tr.cells[iWgt]) : NaN,
            atkMin : atkR ? atkR.min : NaN,
            atkMax : atkR ? atkR.max : NaN,
            defMin : defR ? defR.min : NaN,
            defMax : defR ? defR.max : NaN,
            crit : ((kind==='wep' || kind==='amr') && iCrit>=0) ? numFromCell(tr.cells[iCrit]) : NaN
          };
          if (kind==='nec'){
            // ネックレス: グレード／Buff個数／DeBuff個数／増減（％合計）
            const grade = (function(){
              const m = (_rowText||'').match(/プラチナ|金|銀|青銅|銅/);
              return m ? m[0] : '';
            })();
            const nec = dbeParseNecEffects(tr, iAttr, iName);
            rowInfo.grade = grade;
            rowInfo.buffCnt = nec.buffCnt;
            rowInfo.debuffCnt = nec.debuffCnt;
            rowInfo.delta = nec.delta;
            rowInfo.unknownCnt = nec.unknownCnt;
            rowInfo.hasUnknown = nec.hasUnknown;
          }

          const act = decideAction(rowInfo); // 'lock' | 'del' | null
          if (act==='lock' && hrefL.includes('/lock/')){
            DBE_CHEST.qLock.push({table:kind, id});
          } else if (act==='del'){
            // 分解は「未ロック」かつ「分解リンクが存在」する行だけを対象にする
            const recCand = (iRycl>=0 ? tr.cells[iRycl] : tr);
            const ryclA = recCand?.querySelector?.('a[href*="/recycle/"]');
            if (hrefL.includes('/lock/') && ryclA){
              // 仕様上：wep/amr のみ（necklaceTable は今回対象外）
              DBE_CHEST.qRecycle.push({table:kind, id});
            }
          } else {
            // 保留（どちらにも該当しない）:
            // 同一セッション内での再判定を避けるため、未ロック行に限り即 onhold を付与
            if (hrefL.includes('/lock/')){
              tr.classList.add('dbe-prm-Chest--onhold');
              onHoldId.add(id); // この Set は DBE_CHEST.onHoldIds を参照している
            }
          }
        });
        // HUD更新：このテーブルで積まれた残件を即時反映
        try{ tickProgressHud(); }catch(_){}
      };
    pushNewFrom('#weaponTable', 'wep', DBE_CHEST.pre.wep);
    pushNewFrom('#armorTable',  'amr', DBE_CHEST.pre.amr);
    pushNewFrom('#necklaceTable', 'nec', DBE_CHEST.pre.nec);
    DBE_CHEST.newFound = newIdsLoop.size;
    console.log('[DBE] new-found=', DBE_CHEST.newFound);
    console.log('[DBE] lock-queue=', DBE_CHEST.qLock);
    console.log('[DBE] recycle-queue=', DBE_CHEST.qRecycle);
    }

    // 〓〓〓 名前の正規化: 装飾（【武器】【防具】や [UR|SSR|SR|R|N]）を外し、全角/半角空白を圧縮 〓〓〓
    function normalizeItemName(raw){
      const s = String(raw || '');
      return s
        .replace(/【[^】]*】/g, '')       // 【武器】【防具】などを除去
        .replace(/\[(UR|SSR|SR|R|N)\]/g, '') // [UR][SSR] 等を除去
        .replace(/\s+/g, ' ')            // 半角空白の連続を1つに
        .replace(/[\u3000]+/g, ' ')      // 全角空白→半角1つ
        .trim();
    }

    // 〓〓〓 エレメント名の正規化（表記ゆれ吸収） 〓〓〓
    function normalizeElem(raw){
      const s = String(raw||'').trim();
      if(!s) return '';
      // 全角空白除去・角括弧などのノイズ削除
      const t = s.replace(/[\u3000\s]+/g,' ').replace(/[［\[]?[属性]?[］\]]?/g,'').trim();
      // 同義語 → 正規化
      const map = { '無':'なし', '無属性':'なし', 'none':'なし', 'ナシ':'なし' };
      const v = map[t] || t;
      const allow = new Set(['火','氷','雷','風','地','水','光','闇','なし']);
      return allow.has(v) ? v : '';
    }

    // 〓〓〓 エレメント一致判定（'不問'（旧:すべて）なら無条件通過。unknownは既定で不一致、設定ONで許容） 〓〓〓
    function matchElementRule(rule, elemVal){
      // 1) ルールの目標を配列化
      let targets = [];
      if (rule.elm && Array.isArray(rule.elm.selected) && rule.elm.selected.length){
        targets = rule.elm.selected.map(normalizeElem).filter(Boolean);
      } else if (rule.elem){
        if (rule.elem === '不問' || rule.elem === 'すべて') return true; // 無条件通過（互換）
        targets = [ normalizeElem(rule.elem) ].filter(Boolean);
      } else {
        // 指定なし → 通過
        return true;
      }
      // 2) unknown の扱い
      const allowUnknown = readBoolById('dbe-prm-elem-unknown-include'); // 既定 false（DBE_KEYS）
      if (elemVal === '__unknown__') return !!allowUnknown;
      // 3) 厳密一致
      return targets.includes(elemVal);
    }

    // 〓〓〓 規則評価：最初に合致したルールの action を採用（上から順=「▲」の並び順） 〓〓〓
      function decideAction(rowInfo){
        // rowInfo: {id,name,elem,mrm,rar,kind, spd, wt, atkMin, atkMax, defMin, defMax, crit, (nec: grade,buffCnt,debuffCnt,delta,unknown...) }
        if (rowInfo && rowInfo.kind==='nec' && rowInfo.hasUnknown) {
          return null;
        }
        // rowInfo: { id, name, elem, mrm, rar, kind, spd, wt }
        // _rulesData: { nec[], wep[], amr[] }
        const list = (rowInfo.kind==='wep') ? _rulesData.wep : (rowInfo.kind==='amr' ? _rulesData.amr : _rulesData.nec);

        for (const r of list){

          // ============================================================
          // 武器/防具：指定仕様（カードを上から順に1枚ずつ処理）
          // (1) まず《武器名/防具名》でフィルタ（該当しないなら以降スキップ＝保留）
          // (2) 続いて《Rarity》でフィルタ（該当しないなら以降スキップ＝保留）
          // (3) 続いて《Element》でフィルタ（該当しないなら以降スキップ＝保留）
          // (4) 《動作モード》は r.type（lock/del）として現状維持
          // (5) 《ロジック》AND/OR を反映（r.fop）
          // (6) 5条件 {SPD/WT, min, max, CRIT, マリモ} を AND/OR 評価（Element は必須フィルタ側）
          // ============================================================
          if (rowInfo.kind==='wep' || rowInfo.kind==='amr'){
            // 前段アクティブ判定（“完全に条件なしカード”の安全弁用）
            let nameActive = false;
            let rarityActive = false;
            let elemActive = false;
            // (1) 名前で先にフィルタ
            if (r.name && r.name.mode==='spec'){
              const words = String(r.name.keywords||'')
                .split(/[;；]+/)
                .map(s=> normalizeItemName(s))
                .filter(Boolean);
              const lhs = normalizeItemName(rowInfo.name);
              nameActive = (words.length > 0);
              if (words.length && !words.some(wnd => lhs === wnd)) continue; // ← 名前不一致なら以降スキップ（保留）
            }

            {
              let active = false;
              let matched = true;
              const raw = r.rarity;
              // 「すべて」扱い（null/undefined だけでなく、旧形式の all/全5種 なども含む）
              const isAll = (!raw) ? true : (typeof rarityIsAll==='function' ? rarityIsAll(raw) : (raw==='すべて'));
              if (!isAll && raw && raw!=='選択してください'){
                if (Array.isArray(raw)){
                  active = (raw.length > 0);
                  matched = !active ? true : raw.includes(rowInfo.rar);
                } else if (typeof raw === 'string'){
                  active = true;
                  matched = (raw === rowInfo.rar);
                } else if (typeof raw === 'object'){
                  // 旧形式：{UR:true,...} のような形も許容
                  const picked = ['UR','SSR','SR','R','N'].filter(k=>raw[k]);
                  active = (picked.length > 0);
                  matched = !active ? true : picked.includes(rowInfo.rar);
                } else {
                  active = false;
                  matched = true;
                }
              }
              rarityActive = !!active;
              // Rarity 不一致なら以降スキップ（保留）
              if (active && !matched) continue;
            }

            // (3) Element でフィルタ（※「すべて」は非アクティブ＝判定スキップ）
            {
              let active = false;
              let matched = true;
              if (r.elm){
                const picks = Array.isArray(r.elm.selected) ? r.elm.selected : [];
                active = (!r.elm.all && picks.length>0);
              } else if (r.elem){
                active = (r.elem !== '不問' && r.elem !== 'すべて');
              }
              if (active){
                matched = matchElementRule(r, rowInfo.elem);
              }
              elemActive = !!active;
              // Element 不一致なら以降スキップ（保留）
              if (active && !matched) continue;
            }

            const op = String(r.fop || 'AND').toUpperCase();
            const useOr = (op === 'OR');
            let anyActive = false;
            let anyMatch  = false;
            let allMatch  = true;
            const apply = (active, matched)=>{
              if (!active) return;
              anyActive = true;
              if (matched) anyMatch = true;
              else allMatch = false;
            };

            // ── SPD（武器）/ WT.（防具） ※未指定（all）は extra に入らないので非アクティブ
            if (rowInfo.kind==='wep'){
              const st = r.spd;
              if (st){
                const v  = rowInfo.spd;
                const th = Number(st.value)||0;
                const matched =
                  Number.isFinite(v) &&
                  ((st.border==='以上') ? (v>=th) : (st.border==='未満') ? (v<th) : false);
                apply(true, matched);
              }
            } else if (rowInfo.kind==='amr'){
              const st = r.wt;
              if (st){
                const v  = rowInfo.wt;
                const th = Number(st.value)||0;
                const matched =
                  Number.isFinite(v) &&
                  ((st.border==='以上') ? (v>=th) : (st.border==='未満') ? (v<th) : false);
                apply(true, matched);
              }
            }

            // ── min/max（武器：ATK / 防具：DEF） ※未指定（all）は extra に入らないので非アクティブ
            if (rowInfo.kind==='wep'){
              if (r.minATK){
                const th = Number(String(r.minATK.value ?? '').replace(/[^\d.\-]/g,''));
                const v  = rowInfo.atkMin;
                const matched =
                  Number.isFinite(v) && Number.isFinite(th) &&
                  ((r.minATK.border==='以上') ? (v>=th) : (r.minATK.border==='未満') ? (v<th) : false);
                apply(true, matched);
              }
              if (r.maxATK){
                const th = Number(String(r.maxATK.value ?? '').replace(/[^\d.\-]/g,''));
                const v  = rowInfo.atkMax;
                const matched =
                  Number.isFinite(v) && Number.isFinite(th) &&
                  ((r.maxATK.border==='以上') ? (v>=th) : (r.maxATK.border==='未満') ? (v<th) : false);
                apply(true, matched);
              }
            } else if (rowInfo.kind==='amr'){
              if (r.minDEF){
                const th = Number(String(r.minDEF.value ?? '').replace(/[^\d.\-]/g,''));
                const v  = rowInfo.defMin;
                const matched =
                  Number.isFinite(v) && Number.isFinite(th) &&
                  ((r.minDEF.border==='以上') ? (v>=th) : (r.minDEF.border==='未満') ? (v<th) : false);
                apply(true, matched);
              }
              if (r.maxDEF){
                const th = Number(String(r.maxDEF.value ?? '').replace(/[^\d.\-]/g,''));
                const v  = rowInfo.defMax;
                const matched =
                  Number.isFinite(v) && Number.isFinite(th) &&
                  ((r.maxDEF.border==='以上') ? (v>=th) : (r.maxDEF.border==='未満') ? (v<th) : false);
                apply(true, matched);
              }
            }

            // ── CRIT（未指定（all）は extra に入らないので非アクティブ）
            {
              const cr = (r.crit || r.CRIT);
              if (cr){
                const th = Number(String(cr.value ?? '').replace(/[^\d.\-]/g,''));
                const v  = rowInfo.crit;
                const matched =
                  Number.isFinite(v) && Number.isFinite(th) &&
                  ((cr.border==='以上') ? (v>=th) : (cr.border==='未満') ? (v<th) : false);
                apply(true, matched);
              }
            }

            // ── マリモ（mode==='spec' のときだけアクティブ）
            {
              const mm = r.mrm;
              if (mm && mm.mode==='spec'){
                const v  = Number(rowInfo.mrm)||0;
                const th = Number(mm.value)||0;
                const matched =
                  (mm.border==='以上') ? (v>=th) :
                  (mm.border==='未満') ? (v<th) : false;
                apply(true, matched);
              }
            }

            // ── AND/OR 判定
            // “完全に条件なしカード”はヒット禁止（安全弁）
            //   - 前段（名前/Rarity/Element）が全部「すべて」
            //   - かつ 5条件（SPD/WT/min/max/CRIT/マリモ）が全部「不問」
            // の場合は、例外なくマッチさせない（保留）。
            const frontAll = (!nameActive && !rarityActive && !elemActive);
            if (frontAll && !anyActive) continue;

            // 5条件がすべて非アクティブ（= 不問のみ）の場合は、
            // 前段フィルタ（名前/Rarity/Element）を通過した時点でヒット扱いとする。
            // 5条件にアクティブがある場合のみ、AND/OR 判定で最終評価する。
            if (anyActive){
              if (useOr){
                if (!anyMatch) continue;
              } else {
                if (!allMatch) continue;
              }
            }

            // ここまで到達でマッチ → 動作モードに従う
            return r.type==='lock' ? 'lock' : (r.type==='del' ? 'del' : null);
          }

          // ─────────────────────────────────────────
          // ネックレス：現状維持
          // ─────────────────────────────────────────
          if (r.grade && !r.grade.all){
            const lst = Array.isArray(r.grade.list) ? r.grade.list : [];
            if (lst.length && !lst.includes(rowInfo.grade)) continue;
          }
          // プロパティ数：Buff + DeBuff の合計（新仕様）
          {
            const pr = r.prop || r.propCount || r.property;
            if (pr && !pr.all){
              const n = (Number(rowInfo.buffCnt)||0) + (Number(rowInfo.debuffCnt)||0);
              const th = Number(pr.num)||0;
              if (pr.op==='以上' && !(n>=th)) continue;
              if (pr.op==='未満' && !(n<th)) continue;
            }
          }
          
          // 互換：旧仕様の Buff 個数（既存カード救済）
          if (r.buff && !r.buff.all){
            const n = Number(rowInfo.buffCnt)||0;
            const th = Number(r.buff.num)||0;
            if (r.buff.op==='以上' && !(n>=th)) continue;
            if (r.buff.op==='未満' && !(n<th)) continue;
          }

          if (r.debuff && !r.debuff.all){
            const n = Number(rowInfo.debuffCnt)||0;
            const th = Number(r.debuff.num)||0;
            if (r.debuff.op==='以上' && !(n>=th)) continue;
            if (r.debuff.op==='未満' && !(n<th)) continue;
          }
          if (r.delta && !r.delta.all){
            const v = Number(rowInfo.delta);
            const th = parseFloat(r.delta.value)||0;
            if (!Number.isFinite(v)) continue;
            if (r.delta.op==='以上' && !(v>=th)) continue;
            if (r.delta.op==='未満' && !(v<th)) continue;
          }

          // ここまで到達でマッチ
          return r.type==='lock' ? 'lock' : (r.type==='del' ? 'del' : null);
        }

        return null; // 保留
      }

    // 〓〓〓 ヘッダマップ（列名→index）＋tbodyフォールバック 〓〓〓
    function headerMap(table){
      const map = new Proxy(Object.create(null), { get:(t,k)=> (k in t? t[k] : -1) });
      const ths = table.tHead ? table.tHead.querySelectorAll('th') : [];
      Array.from(ths).forEach((th,i)=>{
        const key = (th.textContent||'').trim();
        if (!key) return;
        map[key] = i;
      });
      // ─ フォールバック: tbody から列を推定 ─
      const body = table.tBodies && table.tBodies[0];
      if (body){
        const rows = Array.from(body.rows).slice(0, 10);
        const colCount = rows.reduce((m,r)=>Math.max(m, r.cells.length), 0);
        const has = (k)=> (map[k] ?? -1) >= 0;
        // 装: /equip/
        if (!has('装')){
          outer1: for (let j=0;j<colCount;j++){
            for (const r of rows){
              if (r.cells[j]?.querySelector?.('a[href*="/equip/"]')){ map['装']=j; break outer1; }
            }
          }
        }
        // 解: /lock/ or /unlock/
        if (!has('解')){
          outer2: for (let j=0;j<colCount;j++){
            for (const r of rows){
              const a = r.cells[j]?.querySelector?.('a[href]');
              const href = a && String(a.getAttribute('href')||'');
              if (href && (href.includes('/lock/') || href.includes('/unlock/'))){ map['解']=j; break outer2; }
            }
          }
        }
        // 分解: /recycle/
        if (!has('分解')){
          outer3: for (let j=0;j<colCount;j++){
            for (const r of rows){
              if (r.cells[j]?.querySelector?.('a[href*="/recycle/"]')){ map['分解']=j; break outer3; }
            }
          }
        }
        // 武器/防具（名前列）: どちらも未検出なら、文字量が最も多い列を採用（装/解/分解を除外）
        if (!has('武器') && !has('防具')){
          const avoid = new Set([map['装'], map['解'], map['分解']].filter(i=>i>=0));
          let bestJ=-1, bestLen=-1;
          for (let j=0;j<colCount;j++){
            if (avoid.has(j)) continue;
            const sum = rows.reduce((s,r)=> s + ((r.cells[j]?.textContent||'').trim().length), 0);
            if (sum>bestLen){ bestLen=sum; bestJ=j; }
          }
          if (bestJ>=0){ map['武器']=bestJ; map['防具']=bestJ; }
        }
        // Rarity/レアリティ
        if (!has('Rarity') && !has('レアリティ')){
          const RSET = new Set(['UR','SSR','SR','R','N']);
          outer4: for (let j=0;j<colCount;j++){
            for (const r of rows){
              const t=(r.cells[j]?.textContent||'').trim();
              if (RSET.has(t)){ map['Rarity']=j; map['レアリティ']=j; break outer4; }
            }
          }
        }
        // ELEM/属性
        if (!has('ELEM') && !has('属性')){
          const ESET = new Set(['火','氷','雷','風','地','水','光','闇','なし']);
          outer5: for (let j=0;j<colCount;j++){
            for (const r of rows){
              const t=(r.cells[j]?.textContent||'').trim();
              if (ESET.has(t)){ map['ELEM']=j; map['属性']=j; break outer5; }
            }
          }
        }
      }
      return map;
    }

    // 〓〓〓 ロックキューを逐次実行（ライブDOM対応） 〓〓〓
    function scheduleNextLock(){
      // ロックが尽きたら、分解キューへ移行
      if (DBE_CHEST.qLock.length===0){
        if (DBE_CHEST.qRecycle && DBE_CHEST.qRecycle.length>0){
          DBE_CHEST.stage = 'recycling';
          scheduleNextRecycle();
        } else {
          // 何も無ければ次工程へ
          const workDoc = DBE_CHEST.liveDom ? document : (DBE_CHEST.iframe?.contentDocument);
          afterIterationStep(workDoc);
        }
        return;
      }
      // 1件ずつ処理
      try{
        const task = DBE_CHEST.qLock.shift();
        if (DBE_CHEST.liveDom){
          // クリックは行わず、HTTPで施錠→返りの /bag を可視DOMへ適用
          // ▼ログ追加：施錠の記録
          try{ dbeChestLogActionById(task.id,'施錠'); }catch(_){ }
          doActionAndApply(`/lock/${task.id}`).then(()=>scheduleNextLock());
        }else{
          // 従来：iframe 内のリンクを click
          const doc = DBE_CHEST.iframe?.contentDocument;
          if (!doc){ finishChest(); return; }
          const table = doc.querySelector(
            task.table==='wep' ? '#weaponTable' :
            (task.table==='amr' ? '#armorTable' : '#necklaceTable')
          );
          if (!table || !table.tBodies[0]){ scheduleNextLock(); return; }
          const map  = headerMap(table);
          const iEqup = map['装'], iLock = map['解'];
          let link = null;
          outer: for (const tr of Array.from(table.tBodies[0].rows)){
            const a  = tr.cells[iEqup]?.querySelector('a[href*="/equip/"]');
            const id = a?.href?.match(/\/equip\/(\d+)/)?.[1];
            if (id===task.id){
              const cand = tr.cells[iLock]?.querySelector('a[href]');
              const href = String(cand?.getAttribute('href')||'');
              if (href.includes('/lock/')) link = cand;
              break outer;
            }
          }
          // 「錠」クリック直前にウェイトを入れる
          {
            const d = (typeof DBE_CHEST.delay === 'function') ? DBE_CHEST.delay() : 300;
            setTimeout(()=>{
              if (link){
                // ▼ログ追加：施錠の記録
                try{ dbeChestLogActionById(task.id,'施錠'); }catch(_){ }
                link.click();
              } else {
                console.warn('[DBE] lock link not found for', task);
                scheduleNextLock();
              }
            }, d);
          }
        }
      }catch(err){
        console.error('[DBE] scheduleNextLock error:', err);
        // ロックに失敗しても分解キューがあれば続行
        if (DBE_CHEST.qRecycle && DBE_CHEST.qRecycle.length>0){
          DBE_CHEST.stage = 'recycling';
          scheduleNextRecycle();
        } else {
          const workDoc = DBE_CHEST.liveDom ? document : (DBE_CHEST.iframe?.contentDocument);
          afterIterationStep(workDoc);
        }
      }
    }

    // 〓〓〓 分解キューを逐次実行（ライブDOM対応） 〓〓〓
    function scheduleNextRecycle(){
      if (!DBE_CHEST.qRecycle || DBE_CHEST.qRecycle.length===0){
        const workDoc = DBE_CHEST.liveDom ? document : (DBE_CHEST.iframe?.contentDocument);
        afterIterationStep(workDoc);
        return;
      }
      try{
        const task = DBE_CHEST.qRecycle.shift(); // {table:'wep'|'amr'|'nec', id:'123'}
        if (DBE_CHEST.liveDom){
          // ▼ログ追加：分解の記録
          try{ dbeChestLogActionById(task.id,'分解'); }catch(_){ }
          doActionAndApply(`/recycle/${task.id}`).then(()=>scheduleNextRecycle());
        }else{
          const doc = DBE_CHEST.iframe?.contentDocument;
          if (!doc){ finishChest(); return; }
          const table = doc.querySelector(
            task.table==='wep' ? '#weaponTable' :
            (task.table==='amr' ? '#armorTable' : '#necklaceTable')
          );
          const map = headerMap(table);
          const iEqup = map['装'], iRec = map['分解'];
          let link=null;
          outer: for (const tr of Array.from(table.tBodies[0].rows)){
            const a = tr.cells[iEqup]?.querySelector('a[href*="/equip/"]');
            const id = a?.href?.match(/\/equip\/(\d+)/)?.[1];
            if (id===task.id){
              const cand = tr.cells[iRec]?.querySelector('a[href]');
              const href = String(cand?.getAttribute('href')||'');
              if (href.includes('/recycle/')) link = cand;
              break outer;
            }
          }
          // 「分解」クリック直前にウェイトを入れる
          {
            const d = (typeof DBE_CHEST.delay === 'function') ? DBE_CHEST.delay() : 300;
            setTimeout(()=>{
              if (link){
                // ▼ログ追加：分解の記録
                try{ dbeChestLogActionById(task.id,'分解'); }catch(_){ }
                link.click();
            } else {
              console.warn('[DBE] recycle link not found for', task);
                scheduleNextRecycle();
              }
            }, d);
          }
        }
      }catch(err){
        console.error('[DBE] scheduleNextRecycle error:', err);
        scheduleNextRecycle();
      }
    }

    // 〓〓〓 1ループ完了後：次のループ or 最終解除 〓〓〓
    function afterIterationStep(doc){
      // onhold の施錠/解錠運用は廃止。onhold 付与済みは常に「保留」扱いとし、ここでは何もしない。
      // ユーザーが「中断する」を押していたら、次の宝箱を開ける段階で停止する
      // （= 現在ループのフィルタカード適用／施錠／分解は完了済みの想定）
      if (DBE_CHEST._userAbort){
        (window.DBE_finishChest ? window.DBE_finishChest() : finishChest());
        return;
      }
      if (DBE_CHEST.unlimited || --DBE_CHEST.left > 0){
        // 次ループ：背景ページを /chest or /battlechest へ
        DBE_CHEST.qLock = [];
        DBE_CHEST.stage = 'load_chest';
        DBE_CHEST.iframe.src = (DBE_CHEST.type==='battle')
          ? 'https://donguri.5ch.net/battlechest'
          : 'https://donguri.5ch.net/chest';
        try{ tickProgressHud(); }catch(_){}
      }else{
        // 最終：onhold 解除フェーズは廃止 → 直接終了
        (window.DBE_finishChest ? window.DBE_finishChest() : finishChest());
      }
    }

    // 〓〓〓 最終解除用キューを組み立て（/unlock/ をクリック） 〓〓〓
    function buildUnlockQueueFromIframe(doc){
      DBE_CHEST.qUnlock = [];
      const onHoldId = DBE_CHEST.onHoldIds || new Set();
      const pushFrom = (sel)=>{
        const table = doc.querySelector(sel);
        if (!table || !table.tBodies[0]) return;
        const map = headerMap(table);
        const iEqup = map['装'], iLock = map['解'];
        if (iEqup<0 || iLock<0) return;
        Array.from(table.tBodies[0].rows).forEach(tr=>{
          const a = tr.cells[iEqup]?.querySelector('a[href*="/equip/"]');
          const id = a?.href?.match(/\/equip\/(\d+)/)?.[1];
          if (!id || !onHoldId.has(id)) return;
          const cand = tr.cells[iLock]?.querySelector('a[href]');
          const href = String(cand?.getAttribute('href')||'');
          if (href.includes('/unlock/')){
            const kind = sel==='#weaponTable'?'wep':(sel==='#armorTable'?'amr':'nec');
            DBE_CHEST.qUnlock.push({table:kind, id});
          }
        });
      };
      ['#weaponTable','#armorTable','#necklaceTable'].forEach(pushFrom);
      console.log('[DBE] unlock-queue=', DBE_CHEST.qUnlock);
    }

    // ── 解除キューを逐次実行 ──
    function scheduleNextUnlock(){
      if (DBE_CHEST.qUnlock.length===0){ finishChest(); return; }
      const delay = DBE_CHEST.delay ? DBE_CHEST.delay() : 300;
      setTimeout(()=>{
        try{
          const fr = DBE_CHEST.iframe;
          const doc = fr?.contentDocument;
          if (!doc){ finishChest(); return; }
          const task = DBE_CHEST.qUnlock.shift();
          const table = doc.querySelector(task.table==='wep' ? '#weaponTable' : (task.table==='amr' ? '#armorTable' : '#necklaceTable'));
          if (!table || !table.tBodies[0]){ scheduleNextUnlock(); return; }
          const map = headerMap(table);
          const iEqup = map['装'], iLock = map['解'];
          let link=null;
          outer: for (const tr of Array.from(table.tBodies[0].rows)){
            const a = tr.cells[iEqup]?.querySelector('a[href*="/equip/"]');
            const id = a?.href?.match(/\/equip\/(\d+)/)?.[1];
            if (id===task.id){
              const cand = tr.cells[iLock]?.querySelector('a[href]');
              const href = String(cand?.getAttribute('href')||'');
              if (href.includes('/unlock/')) link = cand;
              break outer;
            }
          }
          // 「解錠」クリック直前にウェイトを入れる
          {
            const d = (typeof DBE_CHEST.delay === 'function') ? DBE_CHEST.delay() : 300;
            setTimeout(()=>{
              if (link){
                link.click();
              } else {
                console.warn('[DBE] lock link not found for', task);
                scheduleNextLock();
              }
            }, d);
          }          // クリック後は onBgFrameLoad 経由で /bag が再読込 → stage:'unlocking' のまま戻る
        }catch(err){
          console.error('[DBE] scheduleNextUnlock error:', err);
          finishChest();
        }
      }, delay);
    }

    function closeRulesModal(){
      const overlay = document.getElementById('dbe-modal-overlay');
      const wnd = document.getElementById('dbe-W-Rules');
      if (wnd) wnd.style.display='none';
      if (overlay) overlay.style.display='none';
      document.body.style.overflow='';
    }
    function reopenChest(){
      const wnd = document.getElementById('dbe-W-Chest') || ensureWindowShell('dbe-W-Chest');
      if (wnd.children.length <= 1) wnd.appendChild(buildChestWindow());
      wnd.style.display='inline-block';
    }

    // 〓〓〓 フォーム部品ヘルパ（最小実装） 〓〓〓
    function rowRadio(name, pairs, required){
      const node=document.createElement('div'); Object.assign(node.style,{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'});
      const group='grp-'+name+'-'+Math.random().toString(36).slice(2);
      let val=null;
      pairs.forEach(([v,l])=>{
        const r=document.createElement('input'); r.type='radio'; r.name=group; r.value=v;
        const lb=document.createElement('label'); lb.append(r, document.createTextNode(' '+l));
        r.addEventListener('change',()=>{ val=v; });
        node.append(lb);
      });
      return {node, value:()=>val};
    }
    function rowSelect(id, options){
      const node=document.createElement('div');
      const sel=document.createElement('select'); if (id) sel.id=id;
      options.forEach(o=>{ const op=document.createElement('option'); op.value=o; op.textContent=o; sel.append(op); });
      node.append(sel); return {node, select:sel, value:()=>sel.value};
    }
    function rowCheck(id, label){
      const node=document.createElement('div');
      const c=document.createElement('input'); c.type='checkbox'; c.id=id;
      const lb=document.createElement('label'); lb.htmlFor=id; lb.append(document.createTextNode(' '+label));
      node.append(c, lb); return {node, value:()=>c.checked};
    }
    function rowCompare(idNum, labelText, idSel, opts){
      const node=document.createElement('div'); Object.assign(node.style,{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'});
      const lab=document.createElement('span'); lab.textContent=labelText;
      const num=document.createElement('input'); num.type='number'; num.step='0.1'; num.id=idNum; Object.assign(num.style,{fontSize:'0.9em',width:'3em',padding:'2px 8px'});
      const sel=rowSelect(idSel, opts);
      node.append(lab, num, sel.node);
      return {node, data:()=>({value:num.value, border:sel.value()}), label:()=> (sel.value()&&sel.value()!=='選択してください'&&num.value!==''?`${labelText}:${num.value}${sel.value()}`:'' )};
    }
    function rowRadioText(name, pairs, hint){
      const node=document.createElement('div'); Object.assign(node.style,{display:'grid',gap:'6px'});
      const group='grp-'+name+'-'+Math.random().toString(36).slice(2);
      let mode=null;
      const line=document.createElement('div'); Object.assign(line.style,{display:'flex',gap:'12px',flexWrap:'wrap',alignItems:'center'});
      pairs.forEach(([v,l])=>{
        const r=document.createElement('input'); r.type='radio'; r.name=group; r.value=v;
        const lb=document.createElement('label'); lb.append(r, document.createTextNode(' '+l));
        r.addEventListener('change',()=>{ mode=v; ta.disabled=(v!=='spec'); });
        line.append(lb);
      });
      const ta=document.createElement('textarea'); Object.assign(ta.style,{fontSize:'0.9em',padding:'2px 8px',width:'min(72svw,560px)'});
        ta.disabled = true; // 初期は未選択→入力不可
        node.append(line, ta);
        if (hint) {
          const hintEl=document.createElement('div');
          Object.assign(hintEl.style,{fontSize:'0.85em',opacity:'0.8'});
          hintEl.textContent=hint;
          node.append(hintEl);
        }
      function valid(){
        if (mode==='spec'){
          const text=ta.value.trim();
          if (!text) { alert('キーワードを入力してください。'); return false; }
            // 区切りは半角/全角「;」を許可。連続数は不問。
            // 例: "A;B；C;;；；D" → ["A","B","C","D"]
        }
        if (!mode){ alert('「不問」または「指定」を選択してください。'); return false; }
        return true;
      }
      // 半角/全角セミコロンの連続を1つの区切りに正規化し、前後空白を除去して「；」で結合
      const normalize = (s)=>
        s.split(/[;；]+/).map(t=>t.trim()).filter(Boolean).join('；');
      return {
        node, valid,
        data:()=>({
          mode,
          keywords: normalize(ta.value.trim())
        }),
        label:()=> (mode==='all' ? '不問' : `指定:${normalize(ta.value)}`)
      };
    }
    function rowElmChecks(baseId){
      const node=document.createElement('div'); Object.assign(node.style,{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'});
      const names=['不問','||','火','氷','雷','風','地','水','光','闇','なし'];
      const boxes=[];
      names.forEach(n=>{
        if (n==='||'){ const sep=document.createElement('span'); sep.textContent='||'; node.append(sep); return; }
        const id = baseId+'-'+n;
        const c=document.createElement('input'); c.type='checkbox'; c.id=id;
        const lb=document.createElement('label'); lb.htmlFor=id; lb.append(document.createTextNode(' '+n));
        boxes.push({n,c}); node.append(c,lb);
      });
      const all = boxes.find(b=>b.n==='不問').c;
      const rests = boxes.filter(b=>b.n!=='不問');
      const sync = ()=>{
        if (all.checked){ rests.forEach(({c})=>{ c.checked=true; c.disabled=true; }); }
        else { rests.forEach(({c})=>{ c.disabled=false; }); }
      };
      all.addEventListener('change', sync);
      const data = ()=>({
        all: all.checked,
        selected: rests.filter(({c})=>c.checked).map(({n})=>n) // ← 選択された属性ラベルを配列で保持
      });
      const label = ()=>{
        const picked = rests.filter(({c})=>c.checked).length;
        rreturn (all.checked || rests.every(({c})=>c.checked)) ? '不問' : `属性${picked}種`;
      };
      return {node, data, label};
    }
    function rowCompareText(idTxt, labelText, idSel, opts, width){
      const node=document.createElement('div'); Object.assign(node.style,{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'});
      const txt=document.createElement('input'); txt.type='text'; txt.id=idTxt; Object.assign(txt.style,{fontSize:'0.9em',width:width||'10em',padding:'2px 8px'});
      const lab=document.createElement('span'); lab.textContent=labelText;
      const sel=rowSelect(idSel, opts);
      node.append(txt, lab, sel.node);
      return {node, data:()=>({text:txt.value,border:sel.value()}), label:()=> (sel.value()&&sel.value()!=='選択してください'&&txt.value!==''?`${labelText}:${txt.value}${sel.value()}`:'')};
    }

    // ★ 新規カード作成用「決定／初期化」ボタン作成ヘルパ（完全版）
    function makeDecideReset(onDecide, onReset){
      const node = document.createElement('div');
      Object.assign(node.style, {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        marginTop: '6px',
        flexWrap: 'wrap'
      });
      const btnOk  = document.createElement('button');
      const btnClr = document.createElement('button');
      btnOk.textContent  = '決定';
      btnClr.textContent = '初期化';
      [btnOk, btnClr].forEach(b=>{
        b.type = 'button';
        b.style.padding = '4px 12px';
        b.style.border = '1px solid #666';
        b.style.background = '#fff';
        b.style.borderRadius = '6px';
        b.style.cursor = 'pointer';
      });
      if (typeof onDecide === 'function') {
        btnOk.addEventListener('click', (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          onDecide();
        });
      }
      if (typeof onReset === 'function') {
        btnClr.addEventListener('click', (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          onReset();
        });
      }
      node.append(btnClr, btnOk);
      return node;
    }
  }
  // ============================================================
  // △ここまで△ "dbe-MenuBar"のコンテナとボタン群の生成ロジック
  // ============================================================

  // 〓〓〓 dbe-W-Rules（モーダル）〓〓〓
  // 選別フィルタの保持領域（ネックレス／武器／防具）
  let _rulesData = { nec:[], wep:[], amr:[] };

  // ============================================================
  // ▽ここから▽ 新フォーム（《フィルタカード》新規作成フォーム）モーダル内容を構築
  // ============================================================
  function buildNewFilterModalContent(){
    // 新フォーム専用のモーダル内容を、単一スコープ内で完結して構築する。
    // 変数は「宣言 → 参照」の順序に統一し、同名の関数/変数衝突を廃止。

    // === 保存完了ダイアログ：表示・クローズ（window に共通化） ===
    // タブ切替等で buildNewFilterModalContent が再実行されても同じ関数を使う
    if (typeof window.__dbeShowSavedDialog !== 'function'){
      window.__dbeShowSavedDialog = function __dbeShowSavedDialog(){
      // 既に存在すればタイマーだけ更新
      let overlay = document.getElementById('dbe-save-overlay');
      if (!overlay){
        overlay = document.createElement('div');
        overlay.id = 'dbe-save-overlay';
        overlay.className = 'dbe-save-overlay';
        overlay.innerHTML = (
            '<div class="dbe-save-dialog dialogCommon" role="dialog" aria-modal="true" aria-labelledby="dbe-save-title">'+
            '<div id="dbe-save-title" class="dbe-save-title">保存しました</div>'+
            '<div style="font-size:.95em;color:#555;">編集内容は保存されました。</div>'+
            '<div class="dbe-save-actions"><button type="button" id="dbe-save-ok">OK</button></div>'+
          '</div>'
        );
        document.body.appendChild(overlay);
        overlay.querySelector('#dbe-save-ok').addEventListener('click', window.__dbeCloseSavedDialog);
        // Escキーでも閉じる
        overlay.addEventListener('keydown', function(ev){ if (ev.key==='Escape') window.__dbeCloseSavedDialog(); });
        // フォーカスをOKへ
        setTimeout(()=> overlay.querySelector('#dbe-save-ok')?.focus(), 0);
      }
      // 参照枠（dbe-W-Rules）から枠線スタイルを引き継ぐ
      try{
        const ref = document.getElementById('dbe-W-Rules');
        const dlg = overlay.querySelector('.dbe-save-dialog');
        if (ref && dlg){
          const cs = getComputedStyle(ref);
          const c  = cs.borderTopColor || cs.outlineColor || '#aaa';
          const wnd  = cs.borderTopWidth || '1px';
          const st = cs.borderTopStyle || 'solid';
          const r  = cs.borderTopLeftRadius || '10px';
          dlg.style.setProperty('--dbe-frame-color',  c);
          dlg.style.setProperty('--dbe-frame-width',  wnd);
          dlg.style.setProperty('--dbe-frame-style',  st);
          dlg.style.setProperty('--dbe-frame-radius', r);
        }
      }catch(_){}
      // すでにあっても最前面へ（末尾に付け直し & 念のため z-index を直指定）
      try{
        document.body.appendChild(overlay); // 末尾へ移動＝前面化
        overlay.style.zIndex = '2147483647';
      }catch(_){}
      // 10秒で自動クローズ（再表示時は延長）
      clearTimeout(overlay.__dbe_timer);
      overlay.__dbe_timer = setTimeout(window.__dbeCloseSavedDialog, 10000);
      };
    }
    if (typeof window.__dbeCloseSavedDialog !== 'function'){
      window.__dbeCloseSavedDialog = function __dbeCloseSavedDialog(){
      const overlay = document.getElementById('dbe-save-overlay');
      if (!overlay) return;
      clearTimeout(overlay.__dbe_timer);
      overlay.remove();
      };
    }

    // === 保存フック：saveRulesToStorage をラップ（あれば）。後から生えるケースがあるのでリトライする。
    //     ※ 「保存しました」ダイアログは “実際に saveRulesToStorage が成功した時” かつ
    //        “ユーザーが直前に「保存する」を押した意図がある時” のみに限定して誤表示を防ぐ
    (function __dbeInstallSaveHook(){
      // 多重インストール防止
      if (window.__DBE_SAVE_HOOK_INSTALLED) return;
      window.__DBE_SAVE_HOOK_INSTALLED = true;

      // 「保存する」クリック意図（短時間だけ有効）
      try{
        if (!window.__DBE_SAVE_INTENT_WATCH_INSTALLED){
          window.__DBE_SAVE_INTENT_WATCH_INSTALLED = true;
          window.__DBE_SAVE_DIALOG_INTENT = false;
          window.__DBE_SAVE_DIALOG_BLOCK_ONCE = false;
          window.__DBE_SAVE_INTENT_TIMER = null;
          document.addEventListener('click', function(ev){
            try{
              if (!ev || !ev.isTrusted) return;
              const btn = ev.target && ev.target.closest && ev.target.closest('button');
              if (!btn) return;
              const txt = (btn.textContent || '').trim();
              if (txt !== '保存する') return;
              // ルールウィンドウ内の「保存する」だけを対象
              const rulesWnd = document.getElementById('dbe-W-Rules');
              if (!rulesWnd) return;
              if (!btn.closest || !btn.closest('#dbe-W-Rules')) return;

              window.__DBE_SAVE_DIALOG_INTENT = true;
              // 2秒で自動解除（タブ切替などの別トリガー誤表示防止）
              clearTimeout(window.__DBE_SAVE_INTENT_TIMER);
              window.__DBE_SAVE_INTENT_TIMER = setTimeout(function(){
                try{ window.__DBE_SAVE_DIALOG_INTENT = false; }catch(_){}
              }, 2000);
            }catch(_){}
          }, true);
        }
      }catch(_){}

      function onSaved(){
        try{
          // 安全弁などで「保存禁止」を出した直後は、保存完了表示を1回だけ抑止
          if (window.__DBE_SAVE_DIALOG_BLOCK_ONCE){
            window.__DBE_SAVE_DIALOG_BLOCK_ONCE = false;
            return;
          }
          // 直前にユーザーが「保存する」を押した時だけ出す
          if (!window.__DBE_SAVE_DIALOG_INTENT) return;
          window.__DBE_SAVE_DIALOG_INTENT = false;
        }catch(_){}
        try{ __dbeShowSavedDialog(); }catch(_){}
      }

      function tryWrap(){
        let ok = false;
        try{
          if (typeof window.saveRulesToStorage === 'function' && !window.saveRulesToStorage.__dbeWrapped){
            const orig = window.saveRulesToStorage;
            const wrappedFn = function(){
              try{
                const ret = orig.apply(this, arguments);
                // Promise/同期の両対応：成功時だけ表示
                Promise.resolve(ret).then(onSaved).catch(()=>{});
                return ret;
              }catch(_e){
                throw _e;
              }
            };
            wrappedFn.__dbeWrapped = true;
            window.saveRulesToStorage = wrappedFn;
            ok = true;
          }else if (typeof window.saveRulesToStorage === 'function' && window.saveRulesToStorage.__dbeWrapped){
            ok = true; // 既にラップ済み
          }
        }catch(_){}
        return ok;
      }

      // まず即時トライ
      if (tryWrap()) return;

      // 後から定義されるケースに備えて短時間リトライ（※フォールバックの click 監視で「保存完了」を出すのは禁止）
      let tries = 0;
      const maxTries = 50;      // 200ms * 50 = 約10秒
      const interval = 200;
      const timer = setInterval(function(){
        tries++;
        if (tryWrap()){
          clearInterval(timer);
          return;
        }
        if (tries >= maxTries){
          clearInterval(timer);
          // ここではフォールバック表示は行わない（誤表示の温床になるため）
        }
      }, interval);
    })()

    // ラッパ（モーダルの body に入る中身）
    const wrap = document.createElement('div');
    wrap.className = 'dbe-window-body';

    // 見出し
    const titleEl = document.createElement('div');
    titleEl.textContent = '装備の選別フィルタ';
    Object.assign(titleEl.style, { fontSize:'1.2em', fontWeight:'bold' });

    // 注意書き（アコーディオン：details/summary）
    const noteEl = document.createElement('div');
    noteEl.innerHTML = `
      <details id="dbe-rules-note" class="dbe-acc">
        <summary>注意事項（クリックして展開）</summary>
        <div class="dbe-acc-body">
          <ul style="font-size:0.9em; margin:6px 0 0 1.2em; padding:0;">
            <li>フィルタカードを編集したら忘れず保存してください。保存しなかった情報は破棄されます。</li>
            <li>「保存する」ボタンは《動作モード（施錠／分解）》の区別なく、すべてのフィルタカード情報を保存します。</li>
            <li>《動作モード》の選択に加え、各項目の設定が必須です。各項目について、「すべて」や「不問」を選ぶか、具体的な条件を入力・選択してください。未設定の項目がある場合はカードを追加できません。</li>
            <li>「不問」に設定された条件は装備の選別において判定がスキップされます。</li>
            <li>異常が生じた場合は「全データを消去」実施により改善する可能性があります。（その際、すべてのフィルタカードが消去されます。あらかじめご了承ください。）</li>
            <li>いかなる不利益が生じても補償等はできません。“永遠のβバージョン”と思ってください。</li>
          </ul>
        </div>
      </details>
    `;
    // （任意）開閉状態の永続化
    try{
      const NOTE_OPEN_KEY = 'dbe-rules-note-open';
      const det = noteEl.querySelector('#dbe-rules-note');
      if (localStorage.getItem(NOTE_OPEN_KEY) === 'true') det.setAttribute('open','');
      det.addEventListener('toggle', ()=> {
        localStorage.setItem(NOTE_OPEN_KEY, det.open ? 'true':'false');
      });
    }catch(_){}

    // 操作ボタン（保存 / キャンセル）
    const opsEl = document.createElement('div');
    opsEl.className = 'fc-ops fc-ops--center';
    Object.assign(opsEl.style, { display:'flex', gap:'8px', flexWrap:'wrap' });
    const btnSave = document.createElement('button');
    btnSave.textContent = '保存する';
    Object.assign(btnSave.style, { fontSize:'0.9em', padding:'4px 10px', margin:'0 3em 0 0' });
    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'キャンセル';
    Object.assign(btnCancel.style, { fontSize:'0.9em', padding:'4px 10px', margin:'0' });
    opsEl.append(btnSave, btnCancel);

    // タブ（ネックレス / 武器 / 防具）
    const tabsEl = document.createElement('div');
    Object.assign(tabsEl.style, {
      display:'flex',
      gap:'8px',
      flexWrap:'wrap',
      justifyContent:'center',
      alignItems:'center',
      width:'100%',
      margin:'6px 0 10px'
    });    const tabN = document.createElement('button');
    tabN.textContent = 'ネックレス';
    Object.assign(tabN.style, { fontSize:'0.9em', padding:'4px 10px' });
    const tabW = document.createElement('button');
    tabW.textContent = '武器';
    Object.assign(tabW.style, { fontSize:'0.9em', padding:'4px 10px' });
    const tabA = document.createElement('button');
    tabA.textContent = '防具';
    Object.assign(tabA.style, { fontSize:'0.9em', padding:'4px 10px' });
    tabsEl.append(tabN, tabW, tabA);

    // 本体（上段：既存カード、下段：新規作成フォーム）
    const bodyEl = document.createElement('div');
    Object.assign(bodyEl.style, { display:'grid', gap:'8px' });
    const areaTop  = document.createElement('div'); // 既存カード一覧
    const areaForm = document.createElement('div'); // 新規カードフォーム
    areaForm.style.minWidth = 'min(92svw, 560px)';
    bodyEl.append(areaTop, areaForm);

    // ─────────────────────────────────────────────
    // グリッド内に区切り線を挿入（《動作モード》〜《マリモ》の5か所の「間」）
    // ─────────────────────────────────────────────
    function __mkSepRow(card){
      var d = document.createElement('div');
      d.className = 'fc-sep-row';
      try{
        var bc = getComputedStyle(card).borderTopColor || '#CCC';
        d.style.setProperty('--fc-border', bc);
      }catch(_){}
      return d;
    }
    function __insertGridSeparators(container){
      var card = container.querySelector('.fc-card');
      if (!card) return false;
      var grid = card.querySelector('.fc-grid');
      if (!grid) return false;
      // 左セル(.fc-left)のラベルで行を特定 → 右セルの直後に <div.fc-sep-row> を差し込む
      function findRightAfterLabel(labels){
        var kids = Array.from(grid.children);
        for (var i=0;i<kids.length;i++){
          var el = kids[i];
          if (!(el.classList && el.classList.contains('fc-left'))) continue;
          var t = (el.textContent || '').trim();
          for (var j=0;j<labels.length;j++){
            if (t.indexOf(labels[j]) !== -1){
              // 右セルは直後の兄弟
              var right = el.nextElementSibling;
              return right || null;
            }
          }
        }
        return null;
      }
      function needSepAfter(rightCell){
        if (!rightCell || !rightCell.parentNode) return false;
        for (var n = rightCell.nextSibling; n; n = n.nextSibling){
          if (n.nodeType !== 1) continue;
          if (n.classList && n.classList.contains('fc-sep-row')) return false; // 既にある
          if (n.classList && n.classList.contains('fc-left')) break;           // 次の行が始まった
        }
        return true;
      }
      var afters = [
        findRightAfterLabel(['《動作モード》','動作モード']),
        findRightAfterLabel(['《Rarity》','Rarity','レアリティ','《グレード》','グレード']),
        findRightAfterLabel(['《武器名》','《防具名》','武器名','防具名','《プロパティ数》','プロパティ数','《Buff》','Buff']),
        findRightAfterLabel(['《SPD》','《WT.》','SPD','WT.','《DeBuff》','DeBuff']),
        findRightAfterLabel(['《Element》','Element','属性','《増減値》','増減値']),
        findRightAfterLabel(['《マリモ》','マリモ'])
      ];
      var inserted = 0;
      for (var k=0;k<afters.length;k++){
        var cell = afters[k];
        if (cell && needSepAfter(cell)){
          grid.insertBefore(__mkSepRow(card), cell.nextSibling);
          inserted++;
        }
      }
      return inserted === afters.length; // 5本入ったら true
    }

    // ─────────────────────────────────────────────
    // 常駐監視：タブ切替や再描画のたびに強化処理を適用（重複しないよう冪等化）
    // ─────────────────────────────────────────────
    function __markMarimoInput(root){
      try{
        var checks = root.querySelectorAll('input[id$="-mrm-all"]'); // 例: fc-wep-mrm-all / fc-amr-mrm-all
        checks.forEach(function(chk){
          var left  = chk.closest('.fc-left');
          var right = left && left.nextElementSibling;
          var inp   = right && right.querySelector('input.fc-input[type="text"]');
          if (inp){ inp.classList.add('mrm-input'); } // 幅 10em は CSS .mrm-input で固定
        });
      }catch(_){}
    }
    function __applyFormEnhancements(){
      __insertGridSeparators(areaForm); // セパレータ（区切り線）を、あるべき場所にだけ挿入。（既にあれば何もしない）
      __markMarimoInput(areaForm);      // 《マリモ》入力にクラス付与。（再描画時も冪等）
    }
    // 初回適用
    __applyFormEnhancements();
    // 以後の変化を監視して都度適用（切断しない）
    var __formEnhancerObserver = new MutationObserver(function(){
      __applyFormEnhancements();
    });
    __formEnhancerObserver.observe(areaForm, {childList:true, subtree:true});

    // ─────────────────────────────────────────────
    // タブ幅を固定化（ネックレス/武器/防具の文字にマッチする要素へクラス .dbe-tab 付与）
    // ─────────────────────────────────────────────
    function __applyTabWidth(root){
      try{
        // 候補：button / [role=tab] / a.tab など（幅広に拾ってテキストで判定）
        const candidates = root.querySelectorAll('button, [role="tab"], a, .tab, .tabs button, .tabs [role="tab"]');
        candidates.forEach(el=>{
          const t = (el.textContent || '').trim();
          if (t === 'ネックレス' || t === '武器' || t === '防具'){
            el.classList.add('dbe-tab');
          }
        });
      }catch(_){}
    }
    // 初回適用
    __applyTabWidth(document);
    // タブやフォームの再構築にも追随
    const __tabObserver = new MutationObserver(()=>{ __applyTabWidth(document); });
    __tabObserver.observe(document.body, {childList:true, subtree:true});

    // （削除）《Element》自動ONのグローバル監視は撤去しました。
    // 以降は各フォームの「カードを追加」クリック内でローカルに実施します。

    // ─────────────────────────────────────────────
    // 表示整形のローカル実装（外部 formatRuleHTML に依存しない）
    // ─────────────────────────────────────────────
    function makeBadge(text, style){
      const span = document.createElement('span');
      span.textContent = text;
      Object.assign(span.style, {
        display:'inline-block',
        border:'2px solid #666',
        fontSize:'1.1em',
        fontWeight:'bold',
        width:'4em',
        textAlign:'center',
        lineHeight:'1.6'
      });
      span.style.backgroundColor = style?.bg || '#FFF';
      span.style.color = style?.fg || '#000';
      return span.outerHTML;
    }
    function typeBadge(type){
      return makeBadge(type==='lock'?'施錠':'分解', {
        bg: type==='lock' ? '#00F' : '#F00',
        fg:'#FFF'
      });
    }
    function rarityBadge(r){
      const map = { UR:{bg:'#F45D01',fg:'#FFF'}, SSR:{bg:'#A633D6',fg:'#FFF'}, SR:{bg:'#2175D9',fg:'#FFF'}, R:{bg:'#3FA435',fg:'#FFF'}, N:{bg:'#FFFFFF',fg:'#000'} };
      const sty = map[r] || {bg:'#FFF',fg:'#000'};
      return makeBadge(r || '', sty);
    }
    function namesText(kind, nameObj){
      const head = kind==='wep' ? '《武器名》' : '《防具名》';
      if (!nameObj || nameObj.mode==='all') return head + 'すべて';
      const raw = (nameObj.keywords||'').trim();
      const list = raw.split(/[；;]+/).map(s=>s.trim()).filter(Boolean);
      return head + (list.length ? list.join('；') : '不問');
    }
    // 先頭の《…》だけを <span class="fc-param-head"> で包む
    function wrapParamHead(s){
      try{
        return String(s).replace(/^《[^》]+》/, function(m){ return '<span class="fc-param-head">'+m+'</span>'; });
      }catch(_){ return s; }
    }
    function elementText(elmObj){
      if (!elmObj || elmObj.all) return '《Element》不問';
      const sel = Array.isArray(elmObj.selected) ? elmObj.selected : [];
      return '《Element》' + (sel.length ? sel.join('；') : '不問');
    }
    function marimoText(mrmObj){
      if (!mrmObj || mrmObj.mode!=='spec') return '《マリモ》不問';
      const num = (mrmObj.text ?? mrmObj.value ?? '').toString().trim();
      const bd  = (mrmObj.border || '').trim();
      if (!num || !bd) return '《マリモ》不問';
      return '《マリモ》' + num + ' ' + bd;
    }
    // ==== 表示専用（Rarityバッジ & SPD/WT テキスト） ====
    function rarityBadgesHTML(raw){
      // "all"/"すべて" / 配列 / {UR:true,...} / {all:true} に広く対応
      const ALL = ['UR','SSR','SR','R','N'];
      function isAll(obj){
        if (!obj) return false;
        if (obj==='すべて' || obj==='不問') return true;
        if (typeof obj==='string' && obj.toLowerCase()==='all') return true;
        if (Array.isArray(obj)) return ALL.every(v=>obj.includes(v));
        if (typeof obj==='object'){
          if (obj.all===true) return true;
          const picked = ALL.filter(v=>obj[v]);
          return picked.length===ALL.length;
        }
        return false;
      }
      let list = [];
      if (!raw || isAll(raw)) list = ALL;
      else if (Array.isArray(raw)) list = raw.slice();
      else if (typeof raw==='object') list = ALL.filter(v=>raw[v]);
      else list = [String(raw)];
      // バッジHTML列
      return list.map(rv => `<span class="rar-badge rar-${rv}">${rv}</span>`).join('');
    }

    // ==== 表示専用（ロジック：AND/OR バッジ） ====
    function logicBadgeHTML(op){
      const v = (String(op || 'AND').toUpperCase() === 'OR') ? 'OR' : 'AND';
      return `<span class="logic-badge logic-${v}">${v}</span>`;
    }

    function statPretty(label, raw){
      // 表示ヘッダ（《SPD》/《WT.》）
      function head(){ return '《' + label + '》'; }
       // 未指定 → 不問
      if (!raw) return head() + '不問';
      // 文字列
      if (typeof raw === 'string'){
        var s = raw.trim();
        if (s.toLowerCase && s.toLowerCase() === 'all' || s === 'すべて' || s === '不問') return head() + '不問';
        var n = Number(s);
        return Number.isFinite(n) ? (head() + n) : (head() + s);
      }
      // 配列
      if (Array.isArray(raw)){
        return raw.length ? (head() + raw.join('；')) : (head() + '不問');
      }
      // オブジェクト
      if (typeof raw === 'object'){
        if (raw.all === true) return head() + '不問';
        if (Array.isArray(raw.list) && raw.list.length){
          return head() + raw.list.join('；');
        }
        // { value, border } 形式
        var val = (raw.value == null ? '' : String(raw.value)).trim();
        var bd  = (raw.border == null ? '' : String(raw.border)).trim();
        if (val !== '' && bd !== '') return head() + (val + ' ' + bd);
        // range: {min, max}
        var hasMin = Number.isFinite(raw.min);
        var hasMax = Number.isFinite(raw.max);
        if (hasMin && hasMax) return head() + (raw.min + '〜' + raw.max);
        if (hasMin)           return head() + (raw.min + '以上');
        if (hasMax)           return head() + (raw.max + '以下');
        // ここまで該当なし → すべて
        return head() + '不問';
      }
      return head() + '不問';
    }

    // ==== Element 色の自動取得 & バッジHTML化 ====
    const __elemColorCache = new Map();
    const __elemFallback = {
      '火':'#E74C3C','氷':'#5DADE2','雷':'#F1C40F','風':'#27AE60',
      '地':'#8E7D62','水':'#3498DB','光':'#F5E663','闇':'#6C5B7B','なし':'#9E9E9E'
    };
    function sniffElemColor(sym){
      if (!sym) return '#9E9E9E';
      if (__elemColorCache.has(sym)) return __elemColorCache.get(sym);
      // 1) 武器/防具テーブルのセルから既存の色を取得（最初に見つかった1件）
      const tds = document.querySelectorAll('#weaponTable td, #armorTable td');
      for (let i=0; i<tds.length && i<3000; i++){  // 安全のため上限
        const td = tds[i];
        if (td.textContent.trim() === sym){
          const col = getComputedStyle(td).color;
          if (col && col !== 'rgb(0, 0, 0)'){ // 初期値っぽい黒は弾く
            __elemColorCache.set(sym, col);
            return col;
          }
        }
      }
      // 2) 既存の色付け関数があれば試す（将来拡張用）
      try{
        if (typeof window.DBE_getElementColor === 'function'){
          const c = window.DBE_getElementColor(sym);
          if (c){ __elemColorCache.set(sym, c); return c; }
        }
      }catch(_){}
      // 3) フォールバック
      const fb = __elemFallback[sym] || '#9E9E9E';
      __elemColorCache.set(sym, fb);
      return fb;
    }

    function elemBadgesHTML(raw){
      // 受理形式:
      //  'all' / 'すべて' / {all:true} / {mode:'all'}
      //  ['火','氷',...] / {selected:[...]} / {list:[...]}
      //  {flags:{火:true,...}} / {火:true,...}
      var ALL = ['火','氷','雷','風','地','水','光','闇','なし'];

      function isAllString(s){
        return (typeof s === 'string') && (s.toLowerCase() === 'all' || s === 'すべて' || s === '不問');
      }

      // 1) 明示的「すべて」判定
      var isExplicitAll = false;
      if (raw != null){
        if (typeof raw === 'string'){
          if (isAllString(raw)) isExplicitAll = true;
        } else if (typeof raw === 'object'){
          if (raw.all === true || raw.mode === 'all') isExplicitAll = true;
        }
      }

      // 2) 選択の抽出
      var picked = [];
      if (raw != null){
        if (typeof raw === 'string'){
          if (!isExplicitAll && raw) picked = [raw];
        } else if (Array.isArray(raw)){
          picked = raw.slice();
        } else if (typeof raw === 'object'){
          if (Array.isArray(raw.selected)) picked = raw.selected.slice();
          else if (Array.isArray(raw.list)) picked = raw.list.slice();
          else if (raw.flags && typeof raw.flags === 'object'){
            picked = ALL.filter(function(k){ return !!raw.flags[k]; });
          } else {
            var keys = Object.keys(raw);
            if (keys.length && keys.every(function(k){ return ALL.indexOf(k) !== -1; })){
              picked = ALL.filter(function(k){ return !!raw[k]; });
            }
          }
        }
      }

      // 3) 正規化（未知要素除外・重複排除・順序安定化）
      picked = picked.filter(function(v, i, arr){
        return ALL.indexOf(v) !== -1 && arr.indexOf(v) === i;
      });
      picked.sort(function(a,b){ return ALL.indexOf(a) - ALL.indexOf(b); });

      // 4) 表示ルール
      //   ・明示的 all か、9要素すべて選択 → 《Element》すべて
      //   ・部分選択 → バッジ列
      //   ・完全未選択/不明 → 空（セパレータ抑止のため）
      if (isExplicitAll || picked.length === ALL.length){
        return '《Element》すべて';
      }
      if (picked.length === 0){
        return '';
      }
      // 背景色から読みやすい文字色を決める（相対輝度で黒/白を選択）
      function contrastTextFor(bg){
        // rgb(...) / rgba(...) / #RRGGBB / #RGB に対応
        var r=0,g=0,b=0, m;
        if ((m = String(bg||'').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i))){
          var hex = m[1].length===3
            ? m[1].split('').map(function(c){ return c + c; }).join('')
            : m[1];
          r = parseInt(hex.slice(0,2),16);
          g = parseInt(hex.slice(2,4),16);
          b = parseInt(hex.slice(4,6),16);
        } else if ((m = String(bg||'').trim().match(/^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i))){
          r = +m[1]; g = +m[2]; b = +m[3];
        } else {
          // 不明な表記 → 既定：黒文字
          return '#000';
        }
        // 相対輝度（sRGB -> linear）から単純判定
        function lin(c){ c/=255; return (c<=0.03928) ? (c/12.92) : Math.pow((c+0.055)/1.055, 2.4); }
        var L = 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
        return (L < 0.5) ? '#FFF' : '#000';
      }
      return picked.map(function(sym){
        var bg = sniffElemColor(sym);
        var fg = contrastTextFor(bg);
        // CSS変数で背景/枠色と文字色を渡す
        return '<span class="elem-badge" style="--elem-bg:' + bg + ';--elem-fg:' + fg + ';">' + sym + '</span>';
      }).join('');
    }

    // ▼▼▼ ここから追加：表示専用のサマリー関数 ▼▼▼
    function rarityIsAll(raw){
      // 受け取りうる形式を網羅的に許容
      if (!raw) return false;
      if (raw === 'すべて' || raw === '不問') return true;
      if (typeof raw === 'string' && raw.toLowerCase() === 'all') return true;
      if (Array.isArray(raw)) {
        const SET = new Set(raw);
        return ['UR','SSR','SR','R','N'].every(x=>SET.has(x));
      }
      if (typeof raw === 'object') {
        if (raw.all === true) return true;
        const picked = ['UR','SSR','SR','R','N'].filter(k=>raw[k]);
        return picked.length === 5;
      }
      return false;
    }
    function rarityView(raw){
      if (!raw || rarityIsAll(raw)) return 'Rarity（不問）';
      // 単一・複数いずれも「／」区切りで表示
      if (Array.isArray(raw)) return 'Rarity（' + raw.join('／') + '）';
      if (typeof raw === 'object'){
        const picked = ['UR','SSR','SR','R','N'].filter(k=>raw[k]);
        return picked.length ? 'Rarity（' + picked.join('／') + '）' : '';
      }
      return 'Rarity（' + String(raw) + '）';
    }
    function statView(label, raw){
      // 想定形式の例：
      //  - 'all' / 'すべて'
      //  - {all:true}
      //  - {min:10,max:20} / {min:10} / {max:20}
      //  - [12,14,18]
      //  - {list:[..]}
      if (!raw) return ''; // 未指定は非表示
      if (typeof raw === 'string'){
        if (raw.toLowerCase?.()==='all' || raw==='すべて' || raw==='不問') return `${label}（不問）`;
        const num = Number(raw);
        return Number.isFinite(num) ? `${label}（${num}）` : `${label}（${raw}）`;
      }
      if (Array.isArray(raw)){
        return raw.length ? `${label}（${raw.join('／')}）` : '';
      }
      if (typeof raw === 'object'){
        if (raw.all === true) return `${label}（不問）`;
        if (Array.isArray(raw.list) && raw.list.length){
          return `${label}（${raw.list.join('／')}）`;
        }
        const hasMin = Number.isFinite(raw.min);
        const hasMax = Number.isFinite(raw.max);
        if (hasMin && hasMax) return `${label}（${raw.min}〜${raw.max}）`;
        if (hasMin)            return `${label}（${raw.min}以上）`;
        if (hasMax)            return `${label}（${raw.max}以下）`;
      }
      return '';
    }
    // ▲▲▲ 追加ここまで ▲▲▲

    // 既存フィルタカード（個別）のレイアウト
    function formatRuleHTMLLocal(kind, card){
      const chunks = [];
      const unasked = []; // 「不問」になっている項目名を末尾にまとめる

      function isUnaskedText(s){
        try{
          if (typeof s !== 'string') return false;
          const t = s.trim();
          return t.endsWith('不問') || t.endsWith('すべて');
        }catch(_){ return false; }
      }
      function pushOrUnasked(html, itemName, isUnasked){
        if (isUnasked){
          if (itemName) unasked.push(itemName);
          return;
        }
        if (html) chunks.push('／' + html);
      }

      // 「《...》すべて」を少し大きめに表示したい時だけ個別に適用する
      function bigAll(html){
        return `<span style="font-size:1.12em;">${html}</span>`;
      }

      // 1) 施錠/分解
      chunks.push(typeBadge(card.type));

      if (kind==='wep' || kind==='amr'){
        // 2) 武器/防具名
        {
          // ※「武器名/防具名」だけは「不問まとめ（末尾の【不問】）」を適用しない
          //   「すべて」や「不問」でも常に《ロジック》の前（本来位置）に表示する
          const fallback = `《${kind==='wep'?'武器名':'防具名'}》すべて`;
          const nameTxt = namesText(kind, card.name) || fallback;
          const nameHtml = wrapParamHead(nameTxt);
          const isAllName = /^《(?:武器名|防具名)》\s*すべて$/.test(String(nameTxt || '').trim());
          chunks.push('／' + (isAllName ? bigAll(nameHtml) : nameHtml));
        }

         // 3) Rarity（バッジ）
        {
          // 「すべて」の場合：バッヂではなく「《Rarity》すべて」の文字列を表示（不問グループへは移動しない）
          const isAll = (!card.rarity || rarityIsAll(card.rarity));
          if (isAll){
            chunks.push('／' + bigAll(wrapParamHead('《Rarity》すべて')));
          } else {
            chunks.push('／' + rarityBadgesHTML(card.rarity));
          }
        }

        // 4) Element（バッジ・テーブル配色を反映／空なら出さない）
        {
          const ehtml = elemBadgesHTML(card.elm);
          // 「すべて」の場合：バッヂではなく「《Element》すべて」の文字列を表示（不問グループへは移動しない）
          const isAll = (!ehtml || ehtml === '《Element》すべて');
          if (isAll){
            chunks.push('／' + bigAll(wrapParamHead('《Element》すべて')));
          } else {
            // バッジHTMLならそのまま、テキスト（《...》形式）なら見出しだけ縮小
            const out = (ehtml[0] === '《') ? wrapParamHead(ehtml) : ehtml;
            chunks.push('／' + out);
          }
        }

        // 5) ロジック（AND/OR）
        {
          const op = String(card.fop || 'AND').toUpperCase();
          chunks.push('／' + logicBadgeHTML(op));
        }

        // 6) SPD / WT.
        if (kind==='wep'){
          const s = statPretty('SPD', card.spd || card.SPD);
          pushOrUnasked(wrapParamHead(s), 'SPD', isUnaskedText(s));
        } else {
          const wnd = statPretty('WT.', card.wt || card.WT || card['WT.']);
          pushOrUnasked(wrapParamHead(wnd), 'WT.', isUnaskedText(wnd));
        }

        // 7) minATK/maxATK or minDEF/maxDEF
        if (kind==='wep'){
          const mn = statPretty('minATK', card.minATK);
          pushOrUnasked(wrapParamHead(mn), 'minATK', isUnaskedText(mn));
          const mx = statPretty('maxATK', card.maxATK);
          pushOrUnasked(wrapParamHead(mx), 'maxATK', isUnaskedText(mx));
        } else {
          const mn = statPretty('minDEF', card.minDEF);
          pushOrUnasked(wrapParamHead(mn), 'minDEF', isUnaskedText(mn));
          const mx = statPretty('maxDEF', card.maxDEF);
          pushOrUnasked(wrapParamHead(mx), 'maxDEF', isUnaskedText(mx));
        }

        // 8) CRIT
        {
          const cr = statPretty('CRIT', card.crit || card.CRIT);
          pushOrUnasked(wrapParamHead(cr), 'CRIT', isUnaskedText(cr));
        }

        // 9) マリモ
        {
          const mt = marimoText(card.mrm);
          pushOrUnasked(wrapParamHead(mt), 'マリモ', isUnaskedText(mt));
        }

        // 10) 末尾に「不問」項目をまとめて表示
        if (unasked.length){
          const uniq = Array.from(new Set(unasked));
          chunks.push('／' + `<span style="font-size:0.85em;color:#AAA;">【不問】${uniq.join('、')}</span>`);
        }

      } else {
        let rest = (card.label || '').replace(/^【(?:施錠|分解)】/,'').trim();
        if (rest){
          // 既存保存データの全角括弧（ ）は表示時に撤去
          rest = rest.replace(/[（）]/g, '');
          // 《グレード》の値と値の間に含まれる「／」だけを撤去（他セクションの区切りは保持）
          // 先頭の《グレード》〜次の「／」までの区間を取り出して、その中の「／」を空にする
          rest = rest.replace(/(《グレード》)([^／]*?)(?=／|$)/, (_m, head, body)=> head + body.replace(/／/g,''));
          // 《ネックレス》：グレード（プラチナ/金/銀/青銅/銅）をRarityと同じ配色で着色
          const GR_MAP = { 'プラチナ':'UR', '金':'SSR', '銀':'SR', '青銅':'R', '銅':'N' };
          rest = rest.replace(/プラチナ|青銅|金|銀|銅/g, (m)=>`<span class="rar-badge rar-${GR_MAP[m]}">${m}</span>`);
          chunks.push('／' + rest);
        }
      }
      return chunks.join('');
    }

    // ─────────────────────────────────────────────
    // 既存カードの描画
    // ─────────────────────────────────────────────
    function openEditRuleWindow(kind, idx){
      if (!(kind === 'wep' || kind === 'amr')) return;
      try{
        const arr = (kind==='wep') ? (_rulesData.wep || []) : (_rulesData.amr || []);
        const src = arr[idx];
        if (!src) return;

        const wnd = ensureWindowShell('dbe-W-RuleEdit');
        // closeBtn（先頭）以外をクリア
        Array.from(wnd.children).slice(1).forEach(n=>n.remove());

        const head = document.createElement('div');
        head.textContent = `フィルタカード再編集（${kind==='wep'?'武器':'防具'} #${idx+1}）`;
        Object.assign(head.style,{ fontWeight:'bold', margin:'0 0 6px 0' });

        const body = document.createElement('div');
        Object.assign(body.style,{ maxWidth:'min(97svw, 860px)', minWidth:'min(92svw, 560px)' });

        let initial;
        try{ initial = JSON.parse(JSON.stringify(src)); }catch(_e){ initial = src; }

        const onClose = ()=>{ try{ wnd.style.display='none'; }catch(_e){} };
        let built = null;
        try{
          built = buildFilterForm(kind, { edit:true, editIndex: idx, initialRule: initial, onClose });
        }catch(err){
          console.warn('[DBE] buildFilterForm(edit) failed:', err);
        }
        if (built) body.appendChild(built);

        wnd.append(head, body);
        wnd.style.display = 'block';
        try{ dbeBringToFront(wnd); }catch(_e){}
      }catch(err){
        console.error('[DBE] openEditRuleWindow failed:', err);
      }
    }

    // フィルタカード
    function renderCards(kind){
      areaTop.innerHTML = '';
      const list = (kind === 'wep')
        ? (_rulesData.wep || [])
        : (kind === 'amr')
          ? (_rulesData.amr || [])
          : (_rulesData.nec || []);
      const cap = document.createElement('div');
      cap.textContent = '作成したフィルタカードの一覧：' + (kind === 'wep' ? '武器' : (kind==='amr' ? '防具' : 'ネックレス'));
      cap.style.fontWeight = 'bold';
      areaTop.appendChild(cap);
      if (!list.length){
        const empty = document.createElement('div');
        empty.textContent = '（まだカードがありません）';
        areaTop.appendChild(empty);
        return;
      }
      list.forEach((card, idx)=>{
        // 行コンテナ（武器/防具=4段：1段目=操作列 / 2段目=《武器名/防具名》 / 3段目=《Rarity》+《Element》 / 4段目=《ロジック》+他条件+【不問】。ネックレスは従来通り）
        const row = document.createElement('div');
        // 種別ごとに背景色を変える（CSS変数で制御）
        row.classList.add('dbe-filter-card-row', `dbe-filter-card-row--${kind}`);
        Object.assign(row.style, {
          display:'flex',
          flexDirection:'column',
          alignItems:'stretch',
          gap:'12px',
          border:'1px solid #CCC', borderRadius:'12px', padding:'16px 8px', background:'var(--dbe-fc-bg, #FFF)',
          fontSize:'0.95em'
        });
        // 整形HTMLを取得
        let html = '';
        try{
          html = (typeof formatRuleHTML === 'function')
            ? formatRuleHTML(kind, card)
            : formatRuleHTMLLocal(kind, card);
        }catch(err){
          html = '';
        }
        // 施錠/分解（先頭バッジ）とパラメータ（以降）を分割
        const p = html.indexOf('／');
        const badgeHTML  = (p>=0 ? html.slice(0, p) : html) || '';
        const paramsHTML = (p>=0 ? html.slice(p+1) : '') || '';

        // params を「《武器名/防具名》」(2段目) / 《Rarity》+《Element》(3段目) / それ以外(4段目) に分割（武器/防具のみ）
        let nameHTML = '';
        let rarityHTML = '';
        let restHTML = '';
        if (kind === 'wep' || kind === 'amr'){
          const parts = (paramsHTML || '').split('／').filter(s=>s!=='' );
          nameHTML = (parts.length ? parts[0] : '') || '';
          const tail = parts.slice(1);
          const rIdx = tail.findIndex(s => {
            const t = String(s || '');
            // バッジ表示（rar-badge）だけでなく、「《Rarity》すべて」のテキスト表示も同段に拾う
            return t.includes('rar-badge') || t.includes('《Rarity》');
          });
          const eIdx = tail.findIndex(s => {
            const t = String(s || '');
            return t.includes('elem-badge') || t.includes('《Element》');
          });
          const picked = [];
          if (rIdx >= 0) picked.push(tail[rIdx] || '');
          if (eIdx >= 0 && eIdx !== rIdx) picked.push(tail[eIdx] || '');
          // 《Rarity》／《Element》は同段で見せたいので、区切りは折り返しに馴染む span にする
          rarityHTML = picked.filter(Boolean).join('<span style="margin:0 0.25em;">／</span>') || '';
          restHTML = tail.filter((_, i)=>i !== rIdx && i !== eIdx).join('／') || '';
        }else{
          // ネックレスは従来通り（2段目=名称 / 3段目=残り）
          const q = paramsHTML.indexOf('／');
          nameHTML = (q>=0 ? paramsHTML.slice(0, q) : paramsHTML) || '';
          restHTML = (q>=0 ? paramsHTML.slice(q+1) : '') || '';
        }

        // [1段目] 操作列：［通し番号＋上移動UI］ / 施錠or分解バッジ / 再編集 / 削除（概ね均等配置）
        const headRow = document.createElement('div');
        Object.assign(headRow.style, {
          display:'grid',
          // 4要素を均等に配置（ネックレスは「再編集」無しのため 3要素）
          gridTemplateColumns: (kind === 'wep' || kind === 'amr') ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr',
          alignItems:'center',
          columnGap:'6px'
        });

        // 通し番号（左端）…［数字］、右側に 1em margin
        const numBox = document.createElement('div');
        numBox.textContent = `[${idx+1}]`;
        Object.assign(numBox.style, { marginRight:'1em' });

        // ============================================================
        // ▽ここから▽ フィルタカードの上移動UI
        // ------------------------------------------------------------
        // ▲（上へ）…「▲」はボタン化（他のボタン意匠を踏襲）。数値ボックス（整数のみ）は左に併設
        // 数値: 初期値1 / min=1 / max=フィルタカード通し番号の最終番号（= list.length）
        // 動作: 指定数だけ上へ移動（最小0でクランプ）
        // ------------------------------------------------------------
        const moveBadge = document.createElement('span');
        Object.assign(moveBadge.style,{
          display:'inline-flex',
          alignItems:'stretch',
          gap:'0',
          border:'1px solid #AAA',
          borderRadius:'6px',
          overflow:'hidden',
          height:'var(--dbe-moveui-h)'
        });
        // ------------------------------------------------------------
        // ★この値を変えるだけで「① / 数値 / ▲」ひとかたまりの高さを調整できる
        moveBadge.style.setProperty('--dbe-moveui-h','1.8em');
        // ------------------------------------------------------------

        // gridColumn は使わず、左グループ（通し番号＋上移動UI）としてまとめて配置する

        const upStep = document.createElement('input');
        upStep.type = 'number';
        upStep.inputMode = 'numeric';
        upStep.step = '1';
        upStep.min = '1';
        upStep.max = String(list.length);
        // 初期値 1（永続化しない：ページリロード等で常に 1 に戻る）
        upStep.value = '1';
        Object.assign(upStep.style,{
          width:'3.6em',
          height:'100%',
          boxSizing:'border-box',
          padding:'0 6px',
          border:'0',
          borderRadius:'0',
          fontSize:'0.9em',
          textAlign:'center',
          outline:'none'
        });
        // ① と ▲ に挟まれた「区切り線」（外枠は moveBadge が担当）
        upStep.style.borderLeft  = '1px solid #AAA';
        upStep.style.borderRight = '1px solid #AAA';

        const normalizeUpStep = ()=>{
          let v = parseInt(upStep.value, 10);
          if (!Number.isFinite(v) || v < 1) v = 1;
          const mx = Math.max(1, list.length);
          if (v > mx) v = mx;
          upStep.value = String(v);
        };

        upStep.addEventListener('change', (ev)=>{
          ev.stopPropagation();
          normalizeUpStep();
        });
        // 入力操作がカード行のクリック等へ波及しないように抑止
        upStep.addEventListener('click', (ev)=>ev.stopPropagation());
        upStep.addEventListener('keydown', (ev)=>ev.stopPropagation());

        // ①（初期値へ戻す）…クリックで数値ボックスを 1 に戻す
        const btnOne = document.createElement('button');
        btnOne.type = 'button';
        btnOne.textContent = '①';
        btnOne.title = '数値を 1 に戻す';
        Object.assign(btnOne.style,{
          margin:'0',
          fontWeight:'700',
          fontSize:'1.1em',
          height:'100%',
          padding:'0 8px',
          border:'0',
          borderRadius:'0',
          lineHeight:'1',
          display:'inline-flex',
          alignItems:'center',
          justifyContent:'center',
          background:'#EEE',
          cursor:'pointer'
        });
        // 左側ボタンの右に区切り線
        btnOne.style.borderRight = '1px solid #AAA';
        btnOne.addEventListener('click', (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          upStep.value = '1';
          normalizeUpStep();
        });

        const btnUp = document.createElement('button');
        btnUp.type = 'button';
        btnUp.textContent = '▲';
        btnUp.title = 'このカードを上へ移動';
        Object.assign(btnUp.style,{
          margin:'0',
          fontWeight:'700',
          fontSize:'1.3em',
          height:'100%',
          padding:'0 10px',
          border:'0',
          borderRadius:'0',
          lineHeight:'1',
          display:'inline-flex',
          alignItems:'center',
          justifyContent:'center',
          background:'#EEE',
          cursor:'pointer'
        });
        // 右側ボタンの左に区切り線
        btnUp.style.borderLeft = '1px solid #AAA';

        btnUp.addEventListener('click', (ev)=>{
          ev.preventDefault();
          ev.stopPropagation();
          normalizeUpStep();
          const arr = (kind==='wep') ? _rulesData.wep : (kind==='amr' ? _rulesData.amr : _rulesData.nec);
          if (!arr || !arr.length) return;
          if (idx <= 0) return;
          const step = (()=>{ const v = parseInt(upStep.value, 10); return Number.isFinite(v) ? Math.max(1, Math.floor(v)) : 1; })();
          const to = Math.max(0, idx - step);
          if (to === idx) return;
          const cur = arr.splice(idx, 1)[0];
          arr.splice(to, 0, cur);
          try{ if (typeof saveRulesToStorage==='function') saveRulesToStorage(); }catch(_e){}
          renderCards(kind);
        });

        moveBadge.append(btnOne, upStep, btnUp);
        // ------------------------------------------------------------
        // △ここまで△ フィルタカードの上移動UI
        // ============================================================

        // 「施錠」または「分解」バッジ
        const badgeBox = document.createElement('div');
        Object.assign(badgeBox.style, { margin:'0', fontSize:'0.85em', justifySelf:'center' });
        badgeBox.innerHTML = badgeHTML || '';
        badgeBox.style.gridColumn = '2';

        // 「再編集」ボタン（武器/防具のみ）…1段目の中央寄りに配置
        let btnEdit = null;
        if (kind === 'wep' || kind === 'amr'){
          btnEdit = document.createElement('button');
          btnEdit.textContent = '再編集';
          btnEdit.title = 'このカードを再編集';
          Object.assign(btnEdit.style,{ padding:'2px 16px', justifySelf:'center' });
          btnEdit.addEventListener('click', (ev)=>{
            ev.stopPropagation();
            openEditRuleWindow(kind, idx);
          });
          btnEdit.style.gridColumn = '3';
        }

        // ③削除
        const btnDel = document.createElement('button');
        btnDel.textContent = '削除';
        btnDel.title = 'このカードを削除';
        Object.assign(btnDel.style, { padding:'2px 8px', justifySelf:'end' });
        btnDel.addEventListener('click', (ev)=>{
          ev.stopPropagation();
          const arr = (kind==='wep') ? _rulesData.wep : (kind==='amr' ? _rulesData.amr : _rulesData.nec);
          arr.splice(idx, 1);
          try{ if (typeof saveRulesToStorage==='function') saveRulesToStorage(); }catch(_e){}
          renderCards(kind);
        });
        btnDel.style.gridColumn = (kind === 'wep' || kind === 'amr') ? '4' : '3';

        // 左端：［通し番号＋上移動UI］を 1つの要素としてまとめる（左寄せ）
        const leftGroup = document.createElement('div');
        Object.assign(leftGroup.style,{
          display:'inline-flex',
          alignItems:'center',
          justifySelf:'start'
        });
        leftGroup.append(numBox, moveBadge);

        headRow.appendChild(leftGroup); // col 1
        headRow.appendChild(badgeBox);  // col 2
        if (btnEdit) headRow.appendChild(btnEdit); // col 3（武器/防具のみ）
        headRow.appendChild(btnDel);    // col 4（武器/防具） or col 3（ネックレス）

        // [2段目] 《武器名/防具名》 or ネックレス名
        const nameRow = document.createElement('div');
        Object.assign(nameRow.style, { padding:'0px' });
        nameRow.innerHTML = nameHTML || '';

        // [3段目] 《Rarity》（武器/防具のみ）
        let rarityRow = null;
          if (kind === 'wep' || kind === 'amr'){
            if (rarityHTML){
              rarityRow = document.createElement('div');
              // 《Rarity》と《Element》を同段に並べ、端で折り返す
              Object.assign(rarityRow.style, {
                padding:'0px',
                display:'flex',
                flexWrap:'wrap',
                alignItems:'center',
                gap:'0px',
                whiteSpace:'normal'
              });
              rarityRow.innerHTML = rarityHTML;
            }
          }

        // [4段目] 《ロジック》バッジ、6条件、【不問】グループ
        const bodyRow = document.createElement('div');
        bodyRow.innerHTML = restHTML || '';

        if (rarityRow){
          row.append(headRow, nameRow, rarityRow, bodyRow);
        }else{
          row.append(headRow, nameRow, bodyRow);
        }
        areaTop.appendChild(row);
      });
    }

    // ─────────────────────────────────────────────
    // 新規カードフォーム（ローカルビルダー）―― leftCol/rightCol を明示し参照順序を固定
    // ─────────────────────────────────────────────
    function buildFilterForm(kind, opts){
      opts = opts || {};
      const isEdit = !!opts.edit;
      const card = document.createElement('div');
      card.className = 'fc-card';
      // 「フィルタカード」ビルダー/再編集 でID衝突を避ける（同時に存在しうるため分離）
      const targetId = isEdit ? 'filtercard-editor' : 'filtercard-builder';
      try{
        const prev = document.getElementById(targetId);
        if (prev && prev !== card) prev.removeAttribute('id');
      }catch(_e){}
      card.id = targetId;
      // ── 重要：武器/防具タブ用の入力状態・要素参照を外側スコープに用意して、
      // ⑦「カードを追加」ハンドラ（ブロック外）からも参照できるようにする
      let stateRarity, nameState, fopState, compState, elemState, mrmState, minStatState, maxStatState, critState;
      let nameInput, compInput, compSel, compWrap, mrmInput, mrmSel, mrmWrap, minStatInput, minStatSel, minStatWrap, maxStatInput, maxStatSel, maxStatWrap, critInput, critSel, critWrap;
      // ── セパレータ生成：外枠の境界色を拾って CSS 変数に流し込む
      function mkSepRow(type){
        const s = document.createElement('div');
        const t = (type==='b') ? 'b' : 'a';
        s.className = 'fc-sep-row fc-sep-row--' + t;
        try{
          const bc = getComputedStyle(card).borderTopColor || '#CCC';
          s.style.setProperty('--fc-border', bc);
        }catch(_){}
        return s;
      }
      // タイトル
      const title = document.createElement('div');
      title.className = 'fc-title';
      const fcCaption = (card.id === 'filtercard-editor') ? 'エディター' : 'ビルダー';
      title.textContent = `「フィルタカード」${fcCaption}（${kind==='wep'?'武器':(kind==='amr'?'防具':'ネックレス')}${isEdit?'：再編集':''}）`;
      card.appendChild(title);
      // グリッド本体
      const grid = document.createElement('div');
      grid.className = 'fc-grid';
      Object.assign(grid.style, { gap:'0' });
      card.appendChild(grid);

      const addSep = (type)=>{ grid.appendChild(mkSepRow(type)); };

      // 小ユーティリティ
      const mkLeft = (txt)=>{
        const d=document.createElement('div');
        d.className='fc-left fc-sec';
        d.textContent=txt;
        Object.assign(d.style,{ textAlign:'right', alignSelf:'start', padding:'8px 0 2px 0' });
        return d;
      };
      const mkRight = ()=>{
        const d=document.createElement('div');
        d.className='fc-right';
        Object.assign(d.style,{ textAlign:'left', alignSelf:'center', padding:'8px 0 2px 12px' });
        return d;
      };
      const addRow = (leftCol,rightCol)=>{
        const r=document.createElement('div');
        r.className='fc-row';
        grid.append(leftCol,rightCol);
        return r;
      };
      const setDimmed = (wrap,on)=>{
        wrap.classList.toggle('fc-dimmed', !!on);
        Array.from(wrap.querySelectorAll('input,select,textarea,button')).forEach(el=>{ el.disabled = !!on; });
      };

      // 左列の「不問」レイアウト（7条件用）
      //  - 2行：1行目=《条件名》 / 2行目=チェックボックス「不問」
      //  - 「不問」は右寄せ＋右端から 1em の余白
      const setLeftAll2Lines = (leftCol, titleText, allWrap)=>{
        leftCol.textContent = '';
        Object.assign(leftCol.style,{
          display:'flex',
          flexDirection:'column',
          alignItems:'stretch',
          justifyContent:'flex-start'
        });
        const t = document.createElement('div');
        t.textContent = titleText;
        Object.assign(t.style,{ width:'100%', textAlign:'right' });
        const r = document.createElement('div');
        Object.assign(r.style,{ width:'100%', display:'flex', justifyContent:'flex-end', paddingRight:'1em' });
        r.appendChild(allWrap);
        leftCol.append(t, r);
      };

      // 武器/防具 共通（ネックレスでは非表示）
      if (kind==='wep' || kind==='amr') {

      // ① 動作モード
      {
        const leftCol = mkLeft('《動作モード》');
        const rightCol = mkRight();
        const gp = document.createElement('div');
        Object.assign(gp.style,{ display:'flex', alignItems:'center' });
        // 施錠
        const lb1=document.createElement('label');
        Object.assign(lb1.style,{ display:'inline-flex', alignItems:'center', gap:'0.1em', marginRight:'2em' });
        const r1 = document.createElement('input'); r1.type='radio'; r1.name=`fc-mode-${kind}`; r1.id=`fc-${kind}-mode-lock`;
        const t1 = document.createElement('span'); t1.textContent='施錠';
        lb1.htmlFor=r1.id; lb1.append(r1,t1);
        // 分解
        const lb2=document.createElement('label');
        Object.assign(lb2.style,{ display:'inline-flex', alignItems:'center', gap:'0.2em' });
        const r2 = document.createElement('input'); r2.type='radio'; r2.name=`fc-mode-${kind}`; r2.id=`fc-${kind}-mode-del`;
        const t2 = document.createElement('span'); t2.textContent='分解';
        lb2.htmlFor=r2.id; lb2.append(r2,t2);
        gp.append(lb1,lb2);
        rightCol.appendChild(gp);
        addRow(leftCol,rightCol);
      }
      addSep('b');

      // ② 名称（武器名/防具名）
      nameState = { all:false, text:'' }; nameInput = null;
      {
        const leftCol = mkLeft(`《${kind==='wep'?'武器名':'防具名'}》`);
        const rightCol = mkRight();
        const allWrap = document.createElement('label');
        allWrap.classList.add('fc-all-label');
        Object.assign(allWrap.style,{ display:'inline-flex', alignItems:'center', gap:'0' });
        const ckAll = document.createElement('input'); ckAll.type='checkbox'; ckAll.id=`fc-${kind}-name-all`;
        const allTxt = document.createElement('span'); allTxt.textContent='すべて';
        allWrap.htmlFor=ckAll.id; allWrap.append(ckAll, allTxt);
        setLeftAll2Lines(leftCol, leftCol.textContent.trim(), allWrap);
        const rightWrap = document.createElement('div');
        rightWrap.style.display='grid';
        nameInput = document.createElement('textarea');
        nameInput.className='fc-textarea';
        nameInput.placeholder='完全一致で指定。セミコロン「；」で区切り。（半角も全角もOK）';
        rightWrap.append(nameInput);
        const sync = ()=>{ nameState.all = ckAll.checked; setDimmed(rightWrap, ckAll.checked); };
        ckAll.addEventListener('change', sync);
        sync();
        rightCol.appendChild(rightWrap);
        addRow(leftCol,rightCol);
      }
      addSep('a');

      // ③ Rarity（v8.15.0.x で欠落していたため復活）
      stateRarity = { all:false, picks:new Set() };
      {
        const leftCol = mkLeft('《Rarity》');
        const rightCol = mkRight();
        const allWrap = document.createElement('label');
        allWrap.classList.add('fc-all-label');
        Object.assign(allWrap.style,{ display:'inline-flex', alignItems:'center', gap:'0' });
        const ckAll = document.createElement('input'); ckAll.type='checkbox'; ckAll.id=`fc-${kind}-rar-all`;
        const allTxt = document.createElement('span'); allTxt.textContent='すべて';
        allWrap.htmlFor=ckAll.id; allWrap.append(ckAll, allTxt);
        setLeftAll2Lines(leftCol, '《Rarity》', allWrap);
        const rightWrap = document.createElement('div');
        Object.assign(rightWrap.style,{ display:'flex', flexWrap:'wrap', gap:'1.5em' });
        ['UR','SSR','SR','R','N'].forEach(n=>{
          const pair = document.createElement('label');
          Object.assign(pair.style,{ display:'inline-flex', alignItems:'center', gap:'0.1em' });
          const c=document.createElement('input'); c.type='checkbox'; c.id=`fc-${kind}-rar-${n}`;
          const lb=document.createElement('span'); lb.textContent=n;
          pair.htmlFor=c.id; pair.append(c, lb);
          rightWrap.append(pair);
          c.addEventListener('change', ()=>{ if (c.checked) stateRarity.picks.add(n); else stateRarity.picks.delete(n); });
        });
        const sync = ()=>{ stateRarity.all = ckAll.checked; setDimmed(rightWrap, ckAll.checked); };
        ckAll.addEventListener('change', sync);
        sync();
        rightCol.appendChild(rightWrap);
        addRow(leftCol,rightCol);
      }
      addSep('a');

      // ④ Element
      elemState = { all:false, picks:new Set() };
      {
        const leftCol = mkLeft('《Element》');
        const rightCol = mkRight();
        const allWrap = document.createElement('label');
        allWrap.classList.add('fc-all-label');
        Object.assign(allWrap.style,{ display:'inline-flex', alignItems:'center', gap:'0' });
        const ckAll = document.createElement('input'); ckAll.type='checkbox'; ckAll.id=`fc-${kind}-elm-all`;
        const allTxt = document.createElement('span'); allTxt.textContent='すべて';
        allWrap.htmlFor=ckAll.id; allWrap.append(ckAll, allTxt);
        setLeftAll2Lines(leftCol, leftCol.textContent.trim(), allWrap);
        const rightWrap = document.createElement('div');
        Object.assign(rightWrap.style,{ display:'flex', flexWrap:'wrap', gap:'0.7em', 'vertical-align':'top'});
        ;['火','氷','雷','風','地','水','光','闇','なし'].forEach(n=>{
          const pair = document.createElement('label');
          Object.assign(pair.style,{ display:'inline-flex', alignItems:'center', gap:'0.1em' });
          const c=document.createElement('input'); c.type='checkbox'; c.id=`fc-${kind}-elm-${n}`;
          const lb=document.createElement('span'); lb.textContent=n;
          pair.htmlFor=c.id; pair.append(c, lb);
          rightWrap.append(pair);
          c.addEventListener('change', ()=>{ if (c.checked) elemState.picks.add(n); else elemState.picks.delete(n); });
        });
        const sync = ()=>{ elemState.all = ckAll.checked; setDimmed(rightWrap, ckAll.checked); };
        ckAll.addEventListener('change', sync);
        sync();
        rightCol.appendChild(rightWrap);
        addRow(leftCol,rightCol);
      }
      addSep('b');

      // ⑤ ロジック（AND/OR）
      // 初期状態：どちらも未選択（ユーザーが選んだ時点で AND/OR の排他が効く）
      fopState = { op:null };
      {
        const leftCol = mkLeft('《ロジック》');
        const rightCol = mkRight();
        const gp = document.createElement('div');
        Object.assign(gp.style,{ display:'flex', alignItems:'center' });
        // AND
        const lb1=document.createElement('label');
        Object.assign(lb1.style,{ display:'inline-flex', alignItems:'center', gap:'0.1em', marginRight:'2em' });
        const r1 = document.createElement('input'); r1.type='radio'; r1.name=`fc-fop-${kind}`; r1.id=`fc-${kind}-fop-and`;
        const t1 = document.createElement('span'); t1.textContent='AND';
        lb1.htmlFor=r1.id; lb1.append(r1,t1);
        // OR
        const lb2=document.createElement('label');
        Object.assign(lb2.style,{ display:'inline-flex', alignItems:'center', gap:'0.2em' });
        const r2 = document.createElement('input'); r2.type='radio'; r2.name=`fc-fop-${kind}`; r2.id=`fc-${kind}-fop-or`;
        const t2 = document.createElement('span'); t2.textContent='OR';
        lb2.htmlFor=r2.id; lb2.append(r2,t2);
        r1.addEventListener('change', ()=>{ if (r1.checked) fopState.op = 'AND'; });
        r2.addEventListener('change', ()=>{ if (r2.checked) fopState.op = 'OR';  });
        gp.append(lb1,lb2);
        rightCol.appendChild(gp);
        addRow(leftCol,rightCol);
      }
      addSep('a');

      // ⑥ SPD/WT
      compState = { all:false }; compInput = null; compSel = null; compWrap = null;
      {
        const leftCol = mkLeft(kind==='wep'?'《SPD》':'《WT.》');
        const rightCol = mkRight();
        const allWrap = document.createElement('label');
        allWrap.classList.add('fc-all-label');
        Object.assign(allWrap.style,{ display:'inline-flex', alignItems:'center', gap:'0' });
        const ckAll = document.createElement('input'); ckAll.type='checkbox'; ckAll.id=`fc-${kind}-cmp-all`;
        const allTxt = document.createElement('span'); allTxt.textContent='不問';
        allWrap.htmlFor=ckAll.id; allWrap.append(ckAll, allTxt);
        setLeftAll2Lines(leftCol, leftCol.textContent.trim(), allWrap);
        compWrap = document.createElement('div'); compWrap.className='fc-inline';
        compInput = document.createElement('input'); compInput.type='text'; compInput.className='fc-input'; compInput.style.width='5em';
        compSel = document.createElement('select'); compSel.className='fc-select';
        ['以上','未満'].forEach(o=>{ const op=document.createElement('option'); op.value=o; op.textContent=o; compSel.append(op); });
        Object.assign(compInput.style,{ height:'2em' });
        Object.assign(compSel.style,{ height:'2em' });
        compWrap.append(compInput, document.createTextNode(' '), compSel);
        const sync = ()=>{ compState.all = ckAll.checked; setDimmed(compWrap, ckAll.checked); };
        ckAll.addEventListener('change', sync);
        sync();
        rightCol.appendChild(compWrap);
        addRow(leftCol,rightCol);
      }
      addSep('a');

      // ④-2 minATK/maxATK（武器） or minDEF/maxDEF（防具） / CRIT
      minStatState = { all:false }; minStatInput = null; minStatSel = null; minStatWrap = null;
      maxStatState = { all:false }; maxStatInput = null; maxStatSel = null; maxStatWrap = null;
      critState    = { all:false }; critInput    = null; critSel    = null; critWrap    = null;
      {
        const labelMin = (kind==='wep') ? '《minATK》' : '《minDEF》';
        const labelMax = (kind==='wep') ? '《maxATK》' : '《maxDEF》';
        const idMin    = (kind==='wep') ? 'minATK' : 'minDEF';
        const idMax    = (kind==='wep') ? 'maxATK' : 'maxDEF';

        // minATK / minDEF
        {
          const leftCol  = mkLeft(labelMin);
          const rightCol = mkRight();
          const allWrap  = document.createElement('label');
          allWrap.classList.add('fc-all-label');
          Object.assign(allWrap.style,{ display:'inline-flex', alignItems:'center', gap:'0' });
          const ckAll = document.createElement('input'); ckAll.type='checkbox'; ckAll.id=`fc-${kind}-${idMin}-all`;
          const allTxt = document.createElement('span'); allTxt.textContent='不問';
          allWrap.htmlFor=ckAll.id; allWrap.append(ckAll, allTxt);
          setLeftAll2Lines(leftCol, leftCol.textContent.trim(), allWrap);

          minStatWrap  = document.createElement('div'); minStatWrap.className='fc-inline';
          minStatInput = document.createElement('input'); minStatInput.type='text'; minStatInput.className='fc-input'; minStatInput.style.width='5em';
          minStatSel   = document.createElement('select'); minStatSel.className='fc-select';
          ['以上','未満'].forEach(o=>{ const op=document.createElement('option'); op.value=o; op.textContent=o; minStatSel.append(op); });
          Object.assign(minStatInput.style,{ height:'2em' });
          Object.assign(minStatSel.style,{ height:'2em' });
          minStatWrap.append(minStatInput, document.createTextNode(' '), minStatSel);

          const sync = ()=>{ minStatState.all = ckAll.checked; setDimmed(minStatWrap, ckAll.checked); };
          ckAll.addEventListener('change', sync);
          sync();

          rightCol.appendChild(minStatWrap);
          addRow(leftCol,rightCol);
        }
        addSep('a');

        // maxATK / maxDEF
        {
          const leftCol  = mkLeft(labelMax);
          const rightCol = mkRight();
          const allWrap  = document.createElement('label');
          allWrap.classList.add('fc-all-label');
          Object.assign(allWrap.style,{ display:'inline-flex', alignItems:'center', gap:'0' });
          const ckAll = document.createElement('input'); ckAll.type='checkbox'; ckAll.id=`fc-${kind}-${idMax}-all`;
          const allTxt = document.createElement('span'); allTxt.textContent='不問';
          allWrap.htmlFor=ckAll.id; allWrap.append(ckAll, allTxt);
          setLeftAll2Lines(leftCol, leftCol.textContent.trim(), allWrap);

          maxStatWrap  = document.createElement('div'); maxStatWrap.className='fc-inline';
          maxStatInput = document.createElement('input'); maxStatInput.type='text'; maxStatInput.className='fc-input'; maxStatInput.style.width='5em';
          maxStatSel   = document.createElement('select'); maxStatSel.className='fc-select';
          ['以上','未満'].forEach(o=>{ const op=document.createElement('option'); op.value=o; op.textContent=o; maxStatSel.append(op); });
          Object.assign(maxStatInput.style,{ height:'2em' });
          Object.assign(maxStatSel.style,{ height:'2em' });
          maxStatWrap.append(maxStatInput, document.createTextNode(' '), maxStatSel);

          const sync = ()=>{ maxStatState.all = ckAll.checked; setDimmed(maxStatWrap, ckAll.checked); };
          ckAll.addEventListener('change', sync);
          sync();

          rightCol.appendChild(maxStatWrap);
          addRow(leftCol,rightCol);
        }
        addSep('a');

        // CRIT
        {
          const leftCol  = mkLeft('《CRIT》');
          const rightCol = mkRight();
          const allWrap  = document.createElement('label');
          allWrap.classList.add('fc-all-label');
          Object.assign(allWrap.style,{ display:'inline-flex', alignItems:'center', gap:'0' });
          const ckAll = document.createElement('input'); ckAll.type='checkbox'; ckAll.id=`fc-${kind}-crit-all`;
          const allTxt = document.createElement('span'); allTxt.textContent='不問';
          allWrap.htmlFor=ckAll.id; allWrap.append(ckAll, allTxt);
          setLeftAll2Lines(leftCol, leftCol.textContent.trim(), allWrap);

          critWrap  = document.createElement('div'); critWrap.className='fc-inline';
          critInput = document.createElement('input'); critInput.type='text'; critInput.className='fc-input'; critInput.style.width='5em';
          critSel   = document.createElement('select'); critSel.className='fc-select';
          ['以上','未満'].forEach(o=>{ const op=document.createElement('option'); op.value=o; op.textContent=o; critSel.append(op); });
          Object.assign(critInput.style,{ height:'2em' });
          Object.assign(critSel.style,{ height:'2em' });
          critWrap.append(critInput, document.createTextNode(' '), critSel);

          const sync = ()=>{ critState.all = ckAll.checked; setDimmed(critWrap, ckAll.checked); };
          ckAll.addEventListener('change', sync);
          sync();

          rightCol.appendChild(critWrap);
          addRow(leftCol,rightCol);
        }
      }
      addSep('a');

      // ⑥ マリモ
      mrmState = { all:false }; mrmInput = null; mrmSel = null; mrmWrap = null;
      {
        const leftCol = mkLeft('《マリモ》');
        const rightCol = mkRight();
        const allWrap = document.createElement('label');
        allWrap.classList.add('fc-all-label');
        Object.assign(allWrap.style,{ display:'inline-flex', alignItems:'center', gap:'0' });
        const ckAll = document.createElement('input'); ckAll.type='checkbox'; ckAll.id=`fc-${kind}-mrm-all`;
        const allTxt = document.createElement('span'); allTxt.textContent='不問';
        allWrap.htmlFor=ckAll.id; allWrap.append(ckAll, allTxt);
        setLeftAll2Lines(leftCol, leftCol.textContent.trim(), allWrap);
        mrmWrap = document.createElement('div'); mrmWrap.className='fc-inline';
        mrmInput = document.createElement('input'); mrmInput.type='text'; mrmInput.className='fc-input'; mrmInput.style.width='5em';
        const cap = document.createElement('span'); cap.textContent='マリモ';
        mrmSel = document.createElement('select'); mrmSel.className='fc-select';
        ['以上','未満'].forEach(o=>{ const op=document.createElement('option'); op.value=o; op.textContent=o; mrmSel.append(op); });
        Object.assign(mrmInput.style,{ height:'2em' });
        Object.assign(mrmSel.style,{ height:'2em' });
        mrmWrap.append(mrmInput, document.createTextNode(' '), cap, document.createTextNode(' '), mrmSel);
        const sync = ()=>{ mrmState.all = ckAll.checked; setDimmed(mrmWrap, ckAll.checked); };
        ckAll.addEventListener('change', sync);
        sync();
        rightCol.appendChild(mrmWrap);
        addRow(leftCol,rightCol);
      }
      addSep('b');
    }

      // ────────────────
      // ネックレス専用（grade / buff-count / debuff-count / delta%）
      // ────────────────
      if (kind === 'nec') {
        // 1) 動作モード（排他：施錠・分解のみ。左列の「すべて」チェックは撤去）
        (function(){
          const leftCol = mkLeft('《動作モード》');
          const rightCol = mkRight();
          // 右列：施錠/分解（ラジオ2択）
          const gp = document.createElement('div');
          Object.assign(gp.style,{ display:'flex', alignItems:'center' });
          const lb1=document.createElement('label');
          Object.assign(lb1.style,{ display:'inline-flex', alignItems:'center', gap:'0.1em', marginRight:'2em' });
          const r1 = document.createElement('input'); r1.type='radio'; r1.name=`fc-mode-${kind}`; r1.id=`fc-${kind}-mode-lock`;
          const t1 = document.createElement('span'); t1.textContent='施錠';
          lb1.htmlFor=r1.id; lb1.append(r1,t1);
          const lb2=document.createElement('label');
          Object.assign(lb2.style,{ display:'inline-flex', alignItems:'center', gap:'0.2em' });
          const r2 = document.createElement('input'); r2.type='radio'; r2.name=`fc-mode-${kind}`; r2.id=`fc-${kind}-mode-del`;
          const t2 = document.createElement('span'); t2.textContent='分解';
          lb2.htmlFor=r2.id; lb2.append(r2,t2);
          gp.append(lb1,lb2);
          rightCol.appendChild(gp);
          addRow(leftCol,rightCol);
        })();

        // 2) グレード（プラチナ/金/銀/青銅/銅）
        const gradeState = { all:false, picks:new Set() };
        (function(){
          const leftCol = mkLeft('《グレード》');
          const rightCol = mkRight();
          const leftStack = document.createElement('div');
          Object.assign(leftStack.style, { display:'flex', justifyContent:'flex-end', width:'100%' });
          const allLabel = document.createElement('label');
          allLabel.classList.add('fc-all-label');
          Object.assign(allLabel.style,{ display:'inline-flex', alignItems:'center', gap:'0' });
          const ckAll = document.createElement('input'); ckAll.type='checkbox'; ckAll.id=`fc-${kind}-grade-all`;
          const allTxt = document.createElement('span'); allTxt.textContent='不問';
          allLabel.htmlFor=ckAll.id; allLabel.append(ckAll, allTxt);
          leftStack.append(allLabel);
          leftCol.appendChild(leftStack);
          const rightWrap = document.createElement('div');
          Object.assign(rightWrap.style,{ display:'flex', flexWrap:'wrap', gap:'1.5em' });
          ['プラチナ','金','銀','青銅','銅'].forEach(n=>{
            const pair = document.createElement('label');
            Object.assign(pair.style,{ display:'inline-flex', alignItems:'center', gap:'0.1em' });
            const c=document.createElement('input'); c.type='checkbox'; c.id=`fc-${kind}-grade-${n}`;
            const lb=document.createElement('span'); lb.textContent=n;
            pair.htmlFor=c.id; pair.append(c, lb);
            rightWrap.append(pair);
            c.addEventListener('change', ()=>{ if (c.checked) gradeState.picks.add(n); else gradeState.picks.delete(n); });
          });
          const sync = ()=>{ gradeState.all = ckAll.checked; setDimmed(rightWrap, ckAll.checked); };
          ckAll.addEventListener('change', sync);
          sync();
          rightCol.appendChild(rightWrap);
          addRow(leftCol,rightCol);
        })();

        // 3) プロパティ数（項目数）0〜7・以上/未満　※ Buff + DeBuff の合計
        const propState = { all:false, num:'', op:'以上' }; let propInput, propSel, propWrap;
        (function(){
          // 左側は「《プロパティ数》」と「不問」を縦に2段表示（ユーザー要望）
          const leftCol = mkLeft('');
          leftCol.style.display = 'flex';
          leftCol.style.flexDirection = 'column';
          leftCol.style.alignItems = 'flex-end';
          leftCol.style.gap = '4px';

          const title = document.createElement('div');
          title.textContent = '《プロパティ数》';
          leftCol.appendChild(title);
          const rightCol = mkRight();
          const allWrap = document.createElement('label');
          allWrap.classList.add('fc-all-label');
          Object.assign(allWrap.style,{ display:'inline-flex', alignItems:'center', gap:'4px' });
          const ckAll = document.createElement('input'); ckAll.type='checkbox'; ckAll.id=`fc-${kind}-prop-all`;
          const allTxt = document.createElement('span'); allTxt.textContent='不問';
          allWrap.htmlFor=ckAll.id; allWrap.append(ckAll, allTxt);
          setLeftAll2Lines(leftCol, leftCol.textContent.trim(), allWrap);

          propWrap = document.createElement('div'); propWrap.className='fc-inline';
          propInput = document.createElement('input');
          propInput.type='number';
          propInput.min='0';
          propInput.max='7';
          propInput.step='1';
          propInput.className='fc-input';
          propInput.style.width='5em';
          propInput.id = `fc-${kind}-prop-num`;
          propSel = document.createElement('select');
          propSel.className='fc-select';
          propSel.id = `fc-${kind}-prop-op`;
          ['以上','未満'].forEach(o=>{ const op=document.createElement('option'); op.value=o; op.textContent=o; propSel.append(op); });
          Object.assign(propInput.style,{ height:'2em' });
          Object.assign(propSel.style,{ height:'2em' });
          propWrap.append(propInput, document.createTextNode(' '), propSel);

          const sync = ()=>{ propState.all = ckAll.checked; setDimmed(propWrap, ckAll.checked); };
          ckAll.addEventListener('change', sync);
          sync();
          rightCol.appendChild(propWrap);
          addRow(leftCol,rightCol);
        })();

        // 4) DeBuff（項目数）0〜7・以上/未満
        const debuffState = { all:false, num:'', op:'以上' }; let debuffInput, debuffSel, debuffWrap;
        (function(){
          const leftCol = mkLeft('《DeBuff》');
          const rightCol = mkRight();
          const allWrap = document.createElement('label');
          allWrap.classList.add('fc-all-label');
          Object.assign(allWrap.style,{ display:'inline-flex', alignItems:'center', gap:'0' });
          const ckAll = document.createElement('input'); ckAll.type='checkbox'; ckAll.id=`fc-${kind}-debuff-all`;
          const allTxt = document.createElement('span'); allTxt.textContent='不問';
          allWrap.htmlFor=ckAll.id; allWrap.append(ckAll, allTxt);
          setLeftAll2Lines(leftCol, leftCol.textContent.trim(), allWrap);
          debuffWrap = document.createElement('div'); debuffWrap.className='fc-inline';
          debuffInput = document.createElement('input');
          debuffInput.type='number';
          debuffInput.min='0';
          debuffInput.max='7';
          debuffInput.step='1';
          debuffInput.className='fc-input';
          debuffInput.style.width='5em';
          debuffInput.id = `fc-${kind}-debuff-num`;
          debuffSel = document.createElement('select');
          debuffSel.className='fc-select';
          debuffSel.id = `fc-${kind}-debuff-op`;
          ['以上','未満'].forEach(o=>{ const op=document.createElement('option'); op.value=o; op.textContent=o; debuffSel.append(op); });
          Object.assign(debuffInput.style,{ height:'2em' });
          Object.assign(debuffSel.style,{ height:'2em' });
          debuffWrap.append(debuffInput, document.createTextNode(' '), debuffSel);
          const sync = ()=>{ debuffState.all = ckAll.checked; setDimmed(debuffWrap, ckAll.checked); };
          ckAll.addEventListener('change', sync);
          sync();
          rightCol.appendChild(debuffWrap);
          addRow(leftCol,rightCol);
        })();

        // 5) 増減値（％）・以上/未満
        const deltaState = { all:false, num:'', op:'以上' }; let deltaInput, deltaSel, deltaWrap;
        (function(){
          const leftCol = mkLeft('《増減値》');
          const rightCol = mkRight();
          const allWrap = document.createElement('label');
          allWrap.classList.add('fc-all-label');
          Object.assign(allWrap.style,{ display:'inline-flex', alignItems:'center', gap:'0' });
          const ckAll = document.createElement('input'); ckAll.type='checkbox'; ckAll.id=`fc-${kind}-delta-all`;
          const allTxt = document.createElement('span'); allTxt.textContent='不問';
          allWrap.htmlFor=ckAll.id; allWrap.append(ckAll, allTxt);
          setLeftAll2Lines(leftCol, leftCol.textContent.trim(), allWrap);
          deltaWrap = document.createElement('div'); deltaWrap.className='fc-inline';
          deltaInput = document.createElement('input');
          deltaInput.type='text';
          deltaInput.className='fc-input';
          deltaInput.style.width='5em';
          deltaInput.id = `fc-${kind}-delta-val`;
          deltaSel = document.createElement('select');
          deltaSel.className='fc-select';
          deltaSel.id = `fc-${kind}-delta-op`;
          ['以上','未満'].forEach(o=>{ const op=document.createElement('option'); op.value=o; op.textContent=o; deltaSel.append(op); });
          Object.assign(deltaInput.style,{ height:'2em' });
          Object.assign(deltaSel.style,{ height:'2em' });
          deltaWrap.append(deltaInput, document.createTextNode(' '), deltaSel);
          const sync = ()=>{ deltaState.all = ckAll.checked; setDimmed(deltaWrap, ckAll.checked); };
          ckAll.addEventListener('change', sync);
          sync();
          rightCol.appendChild(deltaWrap);
          addRow(leftCol,rightCol);
        })();

        // 6) 追加/初期化/全消去（共通の ⑦ 行と同じ意匠でネックレスでも利用）
        // → この後の「⑦ ボタン列」でまとめて実装されるため、個別には行わない
        // 追加時のデータ収集を wep/amr と分岐させる（下の btnAdd ハンドラで kind==='nec' 分岐）
      }

      // ★ 再編集：初期値を反映（武器/防具のみ）
      if (isEdit && (kind==='wep' || kind==='amr') && opts && opts.initialRule){
        try{
          const rule0 = opts.initialRule || {};
          const fire = (el)=>{ try{ el && el.dispatchEvent(new Event('change', { bubbles:true })); }catch(_e){} };

          // 動作モード
          const rLock = card.querySelector(`#fc-${kind}-mode-lock`);
          const rDel  = card.querySelector(`#fc-${kind}-mode-del`);
          if (rule0.type === 'lock' && rLock){ rLock.checked = true; fire(rLock); }
          if (rule0.type === 'del'  && rDel ){ rDel.checked  = true; fire(rDel ); }

          // Rarity
          const ckRarAll = card.querySelector(`#fc-${kind}-rar-all`);
          const rarList = Array.isArray(rule0.rarity) ? rule0.rarity.slice() : null;
          if (ckRarAll){
            ckRarAll.checked = (!rarList || rarList.length===0);
            ['UR','SSR','SR','R','N'].forEach(n=>{
              const c = card.querySelector(`#fc-${kind}-rar-${n}`);
              if (c) c.checked = (!!rarList && rarList.indexOf(n) !== -1);
            });
            fire(ckRarAll);
            // state 同期
            if (stateRarity){
              stateRarity.all = !!ckRarAll.checked;
              if (stateRarity.picks && typeof stateRarity.picks.clear === 'function') stateRarity.picks.clear();
              ['UR','SSR','SR','R','N'].forEach(n=>{
                const c = card.querySelector(`#fc-${kind}-rar-${n}`);
                if (c && c.checked && stateRarity && stateRarity.picks) stateRarity.picks.add(n);
              });
            }
          }

          // 名称（武器名/防具名）
          const ckNameAll = card.querySelector(`#fc-${kind}-name-all`);
          if (ckNameAll && nameInput){
            const nm = rule0.name || {};
            const isAll = !(nm && nm.mode === 'spec' && (nm.keywords||'').trim());
            ckNameAll.checked = isAll;
            nameInput.value = isAll ? '' : String(nm.keywords||'').split(';').join('；');
            fire(ckNameAll);
            if (nameState){
              nameState.all = !!ckNameAll.checked;
              nameState.text = (nameInput.value||'');
            }
          }

          // ロジック（AND/OR）
          const rAnd = card.querySelector(`#fc-${kind}-fop-and`);
          const rOr  = card.querySelector(`#fc-${kind}-fop-or`);
          if (rule0.fop === 'OR' && rOr){ rOr.checked = true; fire(rOr); if (fopState) fopState.op = 'OR'; }
          else if (rAnd){ rAnd.checked = true; fire(rAnd); if (fopState) fopState.op = 'AND'; }

          // SPD / WT.
          const ckCmpAll = card.querySelector(`#fc-${kind}-cmp-all`);
          const cmpObj = (kind==='wep') ? (rule0.spd || null) : (rule0.wt || null);
          if (ckCmpAll && compInput && compSel){
            ckCmpAll.checked = (!cmpObj || !(String(cmpObj.value||'').trim()) || !(String(cmpObj.border||'').trim()));
            compInput.value = ckCmpAll.checked ? '' : String(cmpObj.value||'');
            compSel.value   = ckCmpAll.checked ? (compSel.value||'以上') : String(cmpObj.border||'以上');
            fire(ckCmpAll);
            if (compState) compState.all = !!ckCmpAll.checked;
          }

          // minATK/minDEF
          {
            const idMin = (kind==='wep') ? 'minATK' : 'minDEF';
            const obj = (kind==='wep') ? (rule0.minATK || null) : (rule0.minDEF || null);
            const ckAll = card.querySelector(`#fc-${kind}-${idMin}-all`);
            if (ckAll && minStatInput && minStatSel && minStatState){
              ckAll.checked = (!obj || !(String(obj.value||'').trim()) || !(String(obj.border||'').trim()));
              minStatInput.value = ckAll.checked ? '' : String(obj.value||'');
              minStatSel.value   = ckAll.checked ? (minStatSel.value||'以上') : String(obj.border||'以上');
              fire(ckAll);
              minStatState.all = !!ckAll.checked;
            }
          }

          // maxATK/maxDEF
          {
            const idMax = (kind==='wep') ? 'maxATK' : 'maxDEF';
            const obj = (kind==='wep') ? (rule0.maxATK || null) : (rule0.maxDEF || null);
            const ckAll = card.querySelector(`#fc-${kind}-${idMax}-all`);
            if (ckAll && maxStatInput && maxStatSel && maxStatState){
              ckAll.checked = (!obj || !(String(obj.value||'').trim()) || !(String(obj.border||'').trim()));
              maxStatInput.value = ckAll.checked ? '' : String(obj.value||'');
              maxStatSel.value   = ckAll.checked ? (maxStatSel.value||'以上') : String(obj.border||'以上');
              fire(ckAll);
              maxStatState.all = !!ckAll.checked;
            }
          }

          // CRIT
          {
            const obj = rule0.crit || null;
            const ckAll = card.querySelector(`#fc-${kind}-crit-all`);
            if (ckAll && critInput && critSel && critState){
              ckAll.checked = (!obj || !(String(obj.value||'').trim()) || !(String(obj.border||'').trim()));
              critInput.value = ckAll.checked ? '' : String(obj.value||'');
              critSel.value   = ckAll.checked ? (critSel.value||'以上') : String(obj.border||'以上');
              fire(ckAll);
              critState.all = !!ckAll.checked;
            }
          }

          // Element（elm）
          {
            const ckAll = card.querySelector(`#fc-${kind}-elm-all`);
            const elm = rule0.elm || {};
            const isAll = !!elm.all;
            const sel = Array.isArray(elm.selected) ? elm.selected.slice() : [];
            if (ckAll){
              ckAll.checked = isAll;
              const ALL = ['火','氷','雷','風','地','水','光','闇','なし'];
              ALL.forEach(n=>{
                const c = card.querySelector(`#fc-${kind}-elm-${n}`);
                if (c) c.checked = (!isAll && sel.indexOf(n)!==-1);
              });
              fire(ckAll);
              if (elemState){
                elemState.all = !!ckAll.checked;
                if (elemState.picks && typeof elemState.picks.clear === 'function') elemState.picks.clear();
                ALL.forEach(n=>{
                  const c = card.querySelector(`#fc-${kind}-elm-${n}`);
                  if (c && c.checked && elemState && elemState.picks) elemState.picks.add(n);
                });
              }
            }
          }

          // マリモ（mrm）
          {
            const ckAll = card.querySelector(`#fc-${kind}-mrm-all`);
            const mrm = rule0.mrm || {};
            const isAll = !(mrm && mrm.mode==='spec' && (String(mrm.value||'').trim()) && (String(mrm.border||'').trim()));
            if (ckAll && mrmInput && mrmSel && mrmState){
              ckAll.checked = isAll;
              mrmInput.value = isAll ? '' : String(mrm.value||'');
              mrmSel.value   = isAll ? (mrmSel.value||'以上') : String(mrm.border||'以上');
              fire(ckAll);
              mrmState.all = !!ckAll.checked;
            }
          }

        }catch(err){
          console.warn('[DBE] apply initial rule failed:', err);
        }
      }

      // ⑦ ボタン列
      {
        const line = document.createElement('div'); line.className='fc-actions';
        Object.assign(line.style,{ display:'flex', 'justify-content':'center', alignItems:'center', gap:'3em' });
        const btnAdd  = document.createElement('button'); btnAdd.type='button';  btnAdd.textContent='カードを追加';
        const btnInit = document.createElement('button'); btnInit.type='button'; btnInit.textContent='フォーム初期化';
        [btnInit, btnAdd].forEach(b=>Object.assign(b.style,{fontSize:'0.95em',padding:'4px 10px'}));
        const resetWrap = document.createElement('div');
        Object.assign(resetWrap.style,{ display:'inline-flex', alignItems:'center', gap:'0.1em' });
        const ckReset = document.createElement('input'); ckReset.type='checkbox'; ckReset.id=`fc-${kind}-reset-all`;
        const lbReset = document.createElement('label'); lbReset.htmlFor=ckReset.id; lbReset.textContent='全データを消去';
        const btnReset = document.createElement('button'); btnReset.type='button'; btnReset.textContent='実行';
        Object.assign(btnReset.style,{fontSize:'0.95em',padding:'4px 10px'});
        resetWrap.append(ckReset, lbReset, btnReset);
        line.append(btnAdd, btnInit, resetWrap);
        card.appendChild(line);

        // ★ 再編集モード：ボタンを「保存する」「キャンセル」に見せる
        if (isEdit){
          btnAdd.textContent = '保存する';
          btnInit.style.display = 'none';
          resetWrap.style.display = 'none';
          const btnCancelEdit = document.createElement('button');
          btnCancelEdit.type='button';
          btnCancelEdit.textContent='キャンセル';
          Object.assign(btnCancelEdit.style,{fontSize:'0.95em',padding:'4px 10px'});
          line.appendChild(btnCancelEdit);
          btnCancelEdit.addEventListener('click', ()=>{
            try{ if (opts && typeof opts.onClose === 'function') opts.onClose(); }catch(_e){}
          });
        }

        // 初期化
        btnInit.addEventListener('click', ()=>{
          // チェック状態と値のリセット
          card.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(el=>{ el.checked=false; });
          card.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(el=>{ el.value=''; });
          card.querySelectorAll('select').forEach(el=>{ el.selectedIndex=0; });
          // 視覚効果クラスの解除
          card.querySelectorAll('.fc-dimmed').forEach(el=>el.classList.remove('fc-dimmed'));
          // ★ 重要：disabled を必ず解除
          card.querySelectorAll('input, select, textarea, button').forEach(el=>{ el.disabled = false; });
          // 状態オブジェクトの初期化
          if (kind==='wep' || kind==='amr'){
            stateRarity.all=false; stateRarity.picks.clear();
            nameState.all=false; nameState.text='';
            if (fopState) fopState.op = null;
            compState.all=false;
            if (minStatState) minStatState.all=false;
            if (maxStatState) maxStatState.all=false;
            if (critState)    critState.all=false;
            elemState.all=false; elemState.picks.clear();
            mrmState.all=false;
          }
        });

        // データリセット
        btnReset.addEventListener('click', async ()=>{
          if (!ckReset.checked){
            try{ dbeShowOkDialog('確認','リセットする場合はチェックボックスをONにしてください。'); }catch(_){}
            return;
          }
          const ok = await dbeConfirmAlert('警告','フィルタカードの全データを消去します。よろしいですか？','はい','いいえ');
          if (!ok) return;
          try{
            if (Array.isArray(_rulesData.wep)) _rulesData.wep.length = 0;
            if (Array.isArray(_rulesData.amr)) _rulesData.amr.length = 0;
            if (Array.isArray(_rulesData.nec)) _rulesData.nec.length = 0;
            if (typeof saveRulesToStorage==='function') saveRulesToStorage();
            renderCards(kind);
            btnInit.click();
          }catch(err){
            console.error('[DBE] reset rules failed:', err);
          } finally {
            ckReset.checked = false;
          }
        });

        // 追加する
        btnAdd.addEventListener('click', ()=>{
          // ① 多重クリック防止（すでに処理中なら無視）
          if (btnAdd.disabled) return;
          btnAdd.disabled = true;
          const mode = (card.querySelector(`#fc-${kind}-mode-lock`)?.checked ? 'lock' :
                        (card.querySelector(`#fc-${kind}-mode-del`)?.checked  ? 'del'  : null));

          // ①-0) 必須入力チェック（未設定項目の収集）
          const missing = [];
          if (!mode) missing.push('動作モード');

          if (kind==='wep' || kind==='amr'){
            // ①-1) wep/amr の内部状態オブジェクトをガード（未定義/不正なら安全停止）
            const okState =
              (stateRarity && typeof stateRarity==='object') &&
              (nameState   && typeof nameState  ==='object') &&
              (fopState    && typeof fopState   ==='object') &&
              (compState   && typeof compState  ==='object') &&
              (elemState   && typeof elemState  ==='object') &&
              (mrmState    && typeof mrmState   ==='object');
            if (!okState){
              try{ dbeShowOkDialog('エラー','内部状態の初期化に失敗しました。フォームを初期化してから、もう一度お試しください。'); }catch(_){}
              console.error('[DBE] add-card: state objects missing', {stateRarity, nameState, fopState, compState, elemState, mrmState, kind});
              btnAdd.disabled = false;
              return;
            }

            // Rarity：『すべて』or 1つ以上選択
            const rarityOk = !!(stateRarity.all || (stateRarity.picks && stateRarity.picks.size>0));
            if (!rarityOk) missing.push('Rarity');

            // 名称（武器名/防具名）：『すべて』or テキスト入力あり
            const nmOk = !!(nameState.all || (nameInput && (nameInput.value||'').trim().length>0));
            if (!nmOk) missing.push(kind==='wep'?'武器名':'防具名');

            // ロジック：AND/OR のどちらかが選択されていること（初期は両方OFF）
            const fopOk = !!(fopState && (fopState.op==='AND' || fopState.op==='OR'));
            if (!fopOk) missing.push('ロジック');

            // SPD/WT.：『すべて』or 数値＋比較
            const compOk = !!(compState.all || ((compInput && (compInput.value||'').trim()) && (compSel && compSel.value)));
            if (!compOk) missing.push(kind==='wep'?'SPD':'WT.');

            // Element：『すべて』or 1つ以上選択（自動ONは廃止）
            const elemOk = !!(elemState.all || (elemState.picks && elemState.picks.size>0));
            if (!elemOk) missing.push('Element');

            // マリモ：『すべて』or 数値＋比較
            const mrmOk = !!(mrmState.all || ((mrmInput && (mrmInput.value||'').trim()) && (mrmSel && mrmSel.value)));
            if (!mrmOk) missing.push('マリモ');

          } else if (kind==='nec'){
            // グレード：『すべて』or 1つ以上選択
            const gAll = !!card.querySelector('#fc-nec-grade-all')?.checked;
            let gPick = false;
            card.querySelectorAll('input[id^="fc-nec-grade-"]:not(#fc-nec-grade-all)').forEach(cb=>{ if (cb.checked) gPick = true; });
            if (!(gAll || gPick)) missing.push('グレード');

            // プロパティ数：『すべて』or 数値＋比較（Buff + DeBuff の合計）
            const pAll = !!card.querySelector('#fc-nec-prop-all')?.checked;
            const pVal = (card.querySelector('#fc-nec-prop-num')?.value||'').trim();
            const pOp  = (card.querySelector('#fc-nec-prop-op')?.value||'').trim();
            if (!(pAll || (pVal && pOp))) missing.push('プロパティ数');

            // DeBuff：『すべて』or 数値＋比較
            const dAll = !!card.querySelector('#fc-nec-debuff-all')?.checked;
            const dVal = (card.querySelector('#fc-nec-debuff-num')?.value||'').trim();
            const dOp  = (card.querySelector('#fc-nec-debuff-op')?.value||'').trim();
            if (!(dAll || (dVal && dOp))) missing.push('DeBuff');

            // 増減値：『すべて』or 数値＋比較
            const zAll = !!card.querySelector('#fc-nec-delta-all')?.checked;
            const zVal = (card.querySelector('#fc-nec-delta-val')?.value||'').trim();
            const zOp  = (card.querySelector('#fc-nec-delta-op')?.value||'').trim();
            if (!(zAll || (zVal && zOp))) missing.push('増減値');
          }

          // 未設定があればカード追加を中断し、案内ダイアログを表示
          if (missing.length > 0){
            const line2 = '《' + missing.join('》、《') + '》';
            const act = isEdit ? '保存する' : 'カードを追加';
            const msg = ['下記の項目が未設定です。', line2, `すべての項目を設定してから「${act}」ボタンを押してください。`].join('\n');
            try{ dbeShowOkDialog('案内', msg); }catch(_){ alert(msg); }
            btnAdd.disabled = false;
            return;
          }

          // ★ 安全弁： “完全に条件なしカード” は保存禁止
          //   前段（武器名/防具名・Rarity・Element）が全部「すべて」
          //   かつ 5条件（SPD/WT, min, max, CRIT, マリモ）が全部「不問」
          //   → 意図せず大量ヒットを招くため、保存自体をブロックする
          if (kind==='wep' || kind==='amr'){
            const frontAll = !!(nameState?.all && stateRarity?.all && elemState?.all);
            const fiveAllUnasked = !!(compState?.all && minStatState?.all && maxStatState?.all && critState?.all && mrmState?.all);
            if (frontAll && fiveAllUnasked){
              // ☆ 保存完了ダイアログ誤表示の抑止：
              //   このケースでは保存は行われないため、
              //   「保存する」意図フラグを落とし、次回の保存ダイアログ表示を1回抑止する
              try{
                window.__DBE_SAVE_DIALOG_INTENT = false;
                window.__DBE_SAVE_DIALOG_BLOCK_ONCE = true;
              }catch(_){}
              try{
                dbeShowAlertDialog('条件が「すべて」「不問」のみのフィルタカードは作成できません。', btnAdd);
              }catch(_){
                alert('条件が「すべて」「不問」のみのフィルタカードは作成できません。');
                try{ btnAdd.focus(); }catch(_){}
              }
              btnAdd.disabled = false;
              return;
            }
          }

          // ② 保存健全性チェック（保存領域の存在保証＆例外安全化）
          //    - _rulesData 本体／各配列が欠けていてもここで初期化
          //    - 保存〜再描画は try/catch/finally で囲ってUXを担保
          try{
            if (!_rulesData || typeof _rulesData !== 'object'){
              window._rulesData = { nec:[], wep:[], amr:[] };
            } else {
              if (!Array.isArray(_rulesData.nec)) _rulesData.nec = [];
              if (!Array.isArray(_rulesData.wep)) _rulesData.wep = [];
              if (!Array.isArray(_rulesData.amr)) _rulesData.amr = [];
            }

            // （既存のカード収集→生成→push→保存→再描画の処理はこの try 内にそのまま残してください）
            // 例：_rulesData[kind].push(newRule); saveRules(); renderCards(kind);

          } catch(err){
            console.error('[DBE] add-card: save/render failed', err);
            try{
              dbeShowOkDialog('保存エラー','カードの保存または再描画に失敗しました。もう一度お試しください。');
            }catch(_){}
            // 失敗時：ここで終了（ボタンは finally で復帰）
            return;
          } finally {
            // 多重クリック解除
            btnAdd.disabled = false;
          }

          if (kind==='nec'){
            // ネックレス専用の収集（IDベースで明確に取得）
            // grade
            let grade = null;
            const ckAllGrade = card.querySelector(`#fc-${kind}-grade-all`);
            if (ckAllGrade && ckAllGrade.checked){
              grade = { all:true };
            } else {
              const picks = [];
              ['プラチナ','金','銀','青銅','銅'].forEach(n=>{
                const c = card.querySelector(`#fc-${kind}-grade-${n}`);
                if (c && c.checked) picks.push(n);
              });
              if (picks.length>0) grade = { list:picks };
            }
            // prop count（0〜7 / 以上・未満）※ Buff + DeBuff の合計
            let prop = null;
            {
              const ckAll = card.querySelector(`#fc-${kind}-prop-all`);
              if (ckAll && ckAll.checked){
                prop = { all:true };
              } else {
                const numEl = card.querySelector(`#fc-${kind}-prop-num`);
                const opEl  = card.querySelector(`#fc-${kind}-prop-op`);
                const num = Number((numEl?.value||'').trim());
                const op  = (opEl?.value||'').trim();
                if (Number.isFinite(num) && op){ prop = { num, op }; }
              }
            }
            // debuff count（0〜7 / 以上・未満）
            let debuff = null;
            {
              const ckAll = card.querySelector(`#fc-${kind}-debuff-all`);
              if (ckAll && ckAll.checked){
                debuff = { all:true };
              } else {
                const numEl = card.querySelector(`#fc-${kind}-debuff-num`);
                const opEl  = card.querySelector(`#fc-${kind}-debuff-op`);
                const num = Number((numEl?.value||'').trim());
                const op  = (opEl?.value||'').trim();
                if (Number.isFinite(num) && op){ debuff = { num, op }; }
              }
            }
            // delta%
            let delta = null;
            {
              const ckAll = card.querySelector(`#fc-${kind}-delta-all`);
              if (ckAll && ckAll.checked){
                delta = { all:true };
              } else {
                const val = (card.querySelector(`#fc-${kind}-delta-val`)?.value||'').trim();
                const op  = (card.querySelector(`#fc-${kind}-delta-op`)?.value||'').trim();
                if (val && op){ delta = { value:val, op }; }
              }
            }
            const rule = {
              type: mode,
              grade,
              prop,
              debuff,
              delta,
              // 一覧の第2列は label に任意整形文字列を流用（武器/防具のような細分バッジは使わない）
              label: [
                '《グレード》' + (grade ? (grade.all ? '不問' : `${(grade.list||[]).join('')}`) : '指定なし'),
                prop   ? ('《プロパティ数》' + (prop.all   ? '不問' : `${prop.num}${prop.op}`))     : '《プロパティ数》指定なし',
                debuff ? ('《DeBuff》' + (debuff.all ? '不問' : `${debuff.num}${debuff.op}`)) : '《DeBuff》指定なし',
                delta  ? ('《増減値》' + (delta.all  ? '不問' : `${delta.value}${delta.op}`))  : '《増減値》指定なし'
              ].join('／')
            };
            const target = _rulesData.nec;
            target.push(rule);
            try { if (typeof saveRulesToStorage==='function') saveRulesToStorage(); } catch(_e){}
            renderCards(kind);
            btnInit.click();
            return;
          }
          // ここから従来（武器/防具）の追加処理
          let rarity = null;
          if (!stateRarity.all){
            rarity = Array.from(stateRarity.picks);
            if (rarity.length===0) rarity = null;
          }
          let nameObj = { mode:'all', keywords:'' };
          if (!nameState.all){
            const raw = (nameInput.value||'').trim();
            if (/[,、，\/|｜]/.test(raw)){
              alert('区切り文字にセミコロン「；」以外は使用できません。');
              return;
            }
            if (raw){
              const norm = raw.replace(/[；;]+/g,';').split(';').map(s=>s.trim()).filter(Boolean).join(';');
              nameObj = { mode:'spec', keywords:norm };
            }
          }
          const extra = {};
          if (!compState.all){
            const v = (compInput.value||'').trim();
            const b = compSel.value||'';
            if (v && b) extra[ kind==='wep' ? 'spd' : 'wt' ] = { value:v, border:b };
          }
          // 追加：minATK/maxATK（武器） or minDEF/maxDEF（防具）
          if (kind==='wep'){
            if (minStatState && !minStatState.all){
              const v = (minStatInput?.value||'').trim();
              const b = (minStatSel?.value||'').trim();
              if (v && b) extra.minATK = { value:v, border:b };
            }
            if (maxStatState && !maxStatState.all){
              const v = (maxStatInput?.value||'').trim();
              const b = (maxStatSel?.value||'').trim();
              if (v && b) extra.maxATK = { value:v, border:b };
            }
          } else if (kind==='amr'){
            if (minStatState && !minStatState.all){
              const v = (minStatInput?.value||'').trim();
              const b = (minStatSel?.value||'').trim();
              if (v && b) extra.minDEF = { value:v, border:b };
            }
            if (maxStatState && !maxStatState.all){
              const v = (maxStatInput?.value||'').trim();
              const b = (maxStatSel?.value||'').trim();
              if (v && b) extra.maxDEF = { value:v, border:b };
            }
          }
          // 追加：CRIT（武器/防具）
          if (critState && !critState.all){
            const v = (critInput?.value||'').trim();
            const b = (critSel?.value||'').trim();
            if (v && b) extra.crit = { value:v, border:b };
          }
          let elmObj = { all:false, selected:[] };
          if (elemState.all){ elmObj = { all:true, selected:[] }; }
          else { elmObj.selected = Array.from(elemState.picks); }
          let mrmObj = { mode:'all' };
          if (!mrmState.all){
            const v = (mrmInput.value||'').trim();
            const b = mrmSel.value||'';
            if (v && b) mrmObj = { mode:'spec', value:v, border:b };
          }
          const rule = Object.assign({
            type: mode,
            fop: (fopState && (fopState.op==='AND' || fopState.op==='OR')) ? fopState.op : 'AND',
            rarity,
            name: nameObj,
            elm: elmObj,
            mrm: mrmObj
          }, extra);
          const target = (kind==='wep') ? _rulesData.wep : _rulesData.amr;
          if (isEdit && opts && typeof opts.editIndex === 'number' && opts.editIndex >= 0 && opts.editIndex < target.length){
            target[opts.editIndex] = rule;
          } else {
            target.push(rule);
          }
          try { if (typeof saveRulesToStorage==='function') saveRulesToStorage(); } catch(_e){}
          renderCards(kind);
          if (!isEdit){
            btnInit.click();
          } else {
            try{ if (opts && typeof opts.onClose === 'function') opts.onClose(); }catch(_e){}
          }
        });
      }
      // ★ 再編集モードでは、この下のフッター（保存/キャンセル）は表示しない
      if (isEdit){
        return card;
      }

      // ⑧ 見た目“枠線の外側”に出すフッター（案内＋保存/キャンセル）
      {
        const tip = document.createElement('div');
        tip.className = 'fc-note';
        tip.textContent = '編集を終えたら最後に「保存する」ボタンを押してください。';

        const ops = document.createElement('div');
        ops.className = 'fc-ops fc-ops--center';
        const btnSave2 = document.createElement('button'); btnSave2.textContent='保存する';
        const btnCancel2 = document.createElement('button'); btnCancel2.textContent='キャンセル';
        Object.assign(btnSave2.style,{fontSize:'0.9em',padding:'4px 10px',margin:'0 3em 1em 0'});
        Object.assign(btnCancel2.style,{fontSize:'0.9em',padding:'4px 10px',margin:'0 0 1em 0'});
        btnSave2.addEventListener('click', ()=>{ try{ if (typeof saveRulesToStorage==='function') saveRulesToStorage(); }catch(_e){} });
        btnCancel2.addEventListener('click', ()=>{
          const ov = document.getElementById('dbe-modal-overlay');
          const wnd = document.getElementById('dbe-W-Rules');
          if (wnd) wnd.style.display='none';
          if (ov) ov.style.display='none';
          document.body.style.overflow='';
        });
        ops.append(btnSave2, btnCancel2);

        // フッターを .fc-card の“外”に見せるため、別要素として返す
        const footer = document.createElement('div');
        footer.className = 'fc-footer';
        footer.append(tip, ops);

        // card と footer をまとめて返す（DocumentFragment OK）
        const frag = document.createDocumentFragment();
        frag.append(card, footer);
        return frag;
      }
    }

    // ─────────────────────────────────────────────
    // 新規カードフォームの組み立て + タブ切替
    // ─────────────────────────────────────────────
  function render(kind){
    // 下段をクリア
    areaForm.innerHTML = '';
    // ローカルビルダーで必ずフォームを構築
    try {
      const built = buildFilterForm(kind);
      if (built) areaForm.appendChild(built);
    } catch(err){
      // フォームが作れない場合でも上段一覧は描画する
      console.warn('[DBE] buildFilterForm failed:', err);
    }

    // 上段の既存カードを更新
    renderCards(kind);

    // タブの見た目を更新
    [tabN, tabW, tabA].forEach(b => b.style.background = '');
    (kind === 'nec' ? tabN : (kind === 'wep' ? tabW : tabA)).style.background = '#eef';
  }
    tabN.addEventListener('click', () => render('nec'));
    tabW.addEventListener('click', () => render('wep'));
    tabA.addEventListener('click', () => render('amr'));

    // 初期表示：武器
    render('wep');

    // 保存 / キャンセル
    if (typeof saveRulesToStorage === 'function') {
      btnSave.addEventListener('click', () => {
        try { saveRulesToStorage(); } catch (_e) { /* noop */ }
      });
    }
    btnCancel.addEventListener('click', () => {
      const wnd  = document.getElementById('dbe-W-Rules');
      const ov = document.getElementById('dbe-modal-overlay');
      if (wnd)  wnd.style.display  = 'none';
      if (ov) ov.style.display = 'none';
      document.body.style.overflow = '';
    });

    // レイアウト用グリッド（ウィンドウの幅制御は既存スタイルに合わせる）
    const grid = document.createElement('div');
    Object.assign(grid.style, {
      maxWidth:'min(97svw, 860px)',
      minWidth:'min(92svw, 560px)',
      display:'grid',
      gap:'8px'
    });
    grid.append(titleEl, noteEl, opsEl, tabsEl, bodyEl);
    wrap.appendChild(grid);
    return wrap;
  }
  // ============================================================
  // △ここまで△ 新フォーム（《フィルタカード》新規作成フォーム）モーダル内容を構築
  // ============================================================

  // 〓〓〓 進捗HUD（右上の小パネル）〓〓〓
  const DBE_PROGRESS = { timer:null };
  function ensureProgressHud(){
    let hud = document.getElementById('dbe-progress-hud');
    if (hud) return hud;
    hud = document.createElement('div');
    hud.id = 'dbe-progress-hud';
    Object.assign(hud.style, {
      position:'fixed', top:'10px', right:'10px', zIndex: '1000002',
      background:'rgba(0,0,0,0.75)', color:'#fff', padding:'8px 10px',
      borderRadius:'8px', fontSize:'12px', lineHeight:'1.4',
      boxShadow:'0 2px 6px rgba(0,0,0,0.25)', pointerEvents:'none'
    });
    const title = document.createElement('div');
    title.textContent = 'DBE 進捗';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '4px';

    body.className = 'body';
    body.textContent = '準備中…';
    hud.append(title, body);
    document.body.appendChild(hud);
    return hud;
  }
  function tickProgressHud(){
    const hud = document.getElementById('dbe-progress-hud');
    if (!hud) return;
    const body = hud.querySelector('.body');
    const S = (typeof DBE_CHEST==='object' && DBE_CHEST) ? DBE_CHEST : {};
    const stage = S.stage || 'idle';
    const ql = Array.isArray(S.qLock) ? S.qLock.length : 0;
    const qr = Array.isArray(S.qRecycle) ? S.qRecycle.length : 0;
    const left = (S.left!=null) ? S.left : (S.unlimited ? '∞' : 0);
    const did = (S.total!=null && S.left!=null) ? (S.total - S.left) : '';
    body.textContent =
      `Stage: ${stage}  /  Lock残: ${ql}  /  分解残: ${qr}` +
      `  /  ループ残: ${left}` + (did!=='' ? `（実行:${did}）` : '');
  }
  function startProgressHud(){
    ensureProgressHud();
    try{ clearInterval(DBE_PROGRESS.timer); }catch(_){}
    DBE_PROGRESS.timer = setInterval(tickProgressHud, 300);
    tickProgressHud();
  }
  function stopProgressHud(){
    try{ clearInterval(DBE_PROGRESS.timer); }catch(_){}
    DBE_PROGRESS.timer = null;
    const hud = document.getElementById('dbe-progress-hud');
    if (hud) hud.remove();
  }

  // 互換ヘルパ: 「決定／初期化」ボタン生成
  // 既存の makeDecideReset が定義されていればそれを流用。無ければフォールバック実装を使う。
  const makeDecideResetLocal = (typeof makeDecideReset === 'function')
    ? makeDecideReset
    : function(onDecide, onReset){
        const node = document.createElement('div');
        Object.assign(node.style, {
          display:'flex', gap:'8px', alignItems:'center', marginTop:'6px', flexWrap:'wrap'
        });
        const btnOk  = document.createElement('button'); btnOk.type='button';  btnOk.textContent  = '決定';
        const btnClr = document.createElement('button'); btnClr.type='button'; btnClr.textContent = '初期化';
        [btnOk, btnClr].forEach(b=>Object.assign(b.style,{fontSize:'0.9em',padding:'4px 10px'}));
        btnOk.addEventListener('click',(err)=>{ e.preventDefault(); try{ onDecide && onDecide(); } catch(err){ console.error('[DBE] decide error:', err); }});
        btnClr.addEventListener('click',(err)=>{ e.preventDefault(); try{ onReset  && onReset();  } catch(err){ console.error('[DBE] reset  error:', err); }});
        node.append(btnOk, btnClr);
        return node;
      };

  // 〓〓〓 共通ヘルパ：エレメント複数選択（「不問」対応）〓〓〓
  function rowElmChecks(baseId){
    const node=document.createElement('div');
    Object.assign(node.style,{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'});
    // 《Element》ラベルを先頭に追加
    const lab=document.createElement('span');
    lab.textContent='《Element》';
    Object.assign(lab.style,{fontWeight:'bold',fontSize:'1.1em'});
    node.appendChild(lab);
    const names=['不問','||','火','氷','雷','風','地','水','光','闇','なし'];
    const boxes=[];
    names.forEach(n=>{
      if (n==='||'){ const sep=document.createElement('span'); sep.textContent='||'; node.append(sep); return; }
      const id = baseId+'-'+n;
      const c=document.createElement('input'); c.type='checkbox'; c.id=id;
      const lb=document.createElement('label'); lb.htmlFor=id; lb.append(document.createTextNode(' '+n));
      boxes.push({n,c}); node.append(c,lb);
    });
    const all = boxes.find(b=>b.n==='不問').c;
    const rests = boxes.filter(b=>b.n!=='不問');
    const sync = ()=>{
      if (all.checked){ rests.forEach(({c})=>{ c.checked=true; c.disabled=true; }); }
      else { rests.forEach(({c})=>{ c.disabled=false; }); }
    };
    all.addEventListener('change', sync);
    const data = ()=>({
      all: all.checked,
      selected: rests.filter(({c})=>c.checked).map(({n})=>n)
    });
    const label = ()=>{
      const picked = rests.filter(({c})=>c.checked).length;
      return (all.checked || rests.every(({c})=>c.checked)) ? '不問' : `属性${picked}種`;
    };
    return {node, data, label};
  }

  // 〓〓〓 ルール永続化ヘルパ 〓〓〓
  const RULES_STORE_KEY = 'dbe-rules-v1';
  let _rulesSaved = null; // 直近に保存されたスナップショット
  function loadRulesFromStorage(){
    try{
      const raw = localStorage.getItem(RULES_STORE_KEY);
      if (raw){
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object' && obj.nec && obj.wep && obj.amr){
          _rulesData = obj;
          _rulesSaved = JSON.parse(JSON.stringify(_rulesData));
          return obj;
        }
      }
    }catch(err){
      console.warn('[DBE] loadRulesFromStorage error:', err);
    }
    // 保存がない／失敗した場合は現行を基準にスナップショット化
    _rulesSaved = JSON.parse(JSON.stringify(_rulesData));
    return _rulesData;
  }
  function saveRulesToStorage(){
    try{
      // 配列保証（欠損していてもここで自己修復）
      if (!_rulesData || typeof _rulesData !== 'object'){
        window._rulesData = { nec:[], wep:[], amr:[] };
      } else {
        if (!Array.isArray(_rulesData.nec)) _rulesData.nec = [];
        if (!Array.isArray(_rulesData.wep)) _rulesData.wep = [];
        if (!Array.isArray(_rulesData.amr)) _rulesData.amr = [];
      }
      // 保存（JSON.stringify エラーや容量超過も捕捉）
      const payload = JSON.stringify(_rulesData);
      localStorage.setItem(RULES_STORE_KEY, payload);
      return true;
    } catch(err){
      console.error('[DBE] saveRules failed', err);
      try{
        dbeShowOkDialog('保存エラー','ルールの保存に失敗しました。もう一度お試しください。');
      }catch(_){}
      return false;
    }
  }  // 起動時に一度ロード（ページ再読込後でも復元できるように）
  loadRulesFromStorage();

  // ============================================================
  // ▽ここから▽ openRulesModal 本流
  // ============================================================
  function openRulesModal(){
    try{
      // 背景スクロール抑止
      document.body.style.overflow = 'hidden';

      // 透過オーバーレイ
      let overlay = document.getElementById('dbe-modal-overlay');
      if (!overlay){
        overlay = document.createElement('div');
        overlay.id = 'dbe-modal-overlay';
        Object.assign(overlay.style, {
          position:'fixed', inset:'0', background:'rgba(0,0,0,0.45)', zIndex:'1000000'
        });
        document.body.appendChild(overlay);
      } else {
        overlay.style.display = 'block';
      }

      // Rules 用の共通ウィンドウシェル（×ボタンあり）
      const wnd = ensureWindowShell('dbe-W-Rules');

      // ×ボタン以外をクリア（既存の旧ビルダー等は完全に撤去する）
      Array.from(wnd.children).forEach((ch, i) => { if (i > 0) ch.remove(); });

      // 新ビルダー DOM を構築して挿入（※必ず新カードビルダーのみ）
      const content = buildNewFilterModalContent();
      if (!content){
        // ここに来る場合はビルダーが読み込まれていない。旧フォールバックは使わず明示的に例外にする
        throw new Error('Filter-card builder was not created.');
      }
      wnd.appendChild(content);

      // 表示
      wnd.style.display = 'inline-block';

      // ×ボタン (先頭ボタン) で閉じる時の後始末
      const closeBtn = wnd.querySelector('button');
      if (closeBtn && !closeBtn.__dbeBound){
        closeBtn.__dbeBound = true;
        closeBtn.addEventListener('click', ()=>{
          const ov = document.getElementById('dbe-modal-overlay');
          if (ov) ov.style.display = 'none';
          document.body.style.overflow = '';
        });
      }
    }catch(err){
      console.error('[DBE] failed to open rules modal:', err);
      // 失敗時でも UI が固まらないよう最低限の復帰
      const ov = document.getElementById('dbe-modal-overlay');
      if (ov) ov.style.display = 'none';
      document.body.style.overflow = '';
    }
  }
  // ============================================================
  // △ここまで△ openRulesModal 本流
  // ============================================================

  // 〓〓〓 Recycle ウィンドウに「全て分解ボタンを隠す」UIを挿入（Settingsからの移植） 〓〓〓
  function ensureHideAllControlInRecycle(){
    const rWnd = document.getElementById('dbe-W-Recycle');
    const rSec = document.getElementById('dbe-panel0-Recycle');
    if (!rWnd || !rSec) return;

    // 既に作成済みならスキップ
    if (document.getElementById('dbe-recycle-hideAll-container')) return;

    // 「『全て分解』まきこみアラート」コンテナ（直下の子）をアンカーにする
    const alertBox = rSec.querySelector('#dbe-recycle-bulk-alert') || null;

    // UIコンテナを作成
    const box = document.createElement('div');
    box.id = 'dbe-recycle-hideAll-container';
    box.style.cssText = 'margin:4px 0 8px 0; display:flex; align-items:center; gap:6px;';

    const ck = document.createElement('input');
    ck.type = 'checkbox';
    // Settings 側と同一の安定IDを使用（DBE_KEYS.hideAllBtn.id）
    ck.id = 'dbe-prm-panel0-check-hide-RyclUnLck';
    try { ck.checked = readBool('hideAllBtn'); } catch (err) { ck.checked = false; }

    const lb = document.createElement('label');
    lb.htmlFor = ck.id;
    lb.textContent = 'ページの「全て分解する」ボタンを隠す';
    lb.style.cssText = 'font-size:0.95em;';

    box.append(ck, lb);
    if (alertBox && alertBox.parentNode === rSec){
      // 直下の子ならその直前へ
      rSec.insertBefore(box, alertBox);
    } else if (alertBox && alertBox.parentNode){
      // 念のため：親が rSec でない場合も「コンテナの直前」に差し込む
      alertBox.parentNode.insertBefore(box, alertBox);
    } else {
      // フォールバック：Recycle セクションの先頭
      rSec.prepend(box);
    }

    // 対象ボタンの一括適用ヘルパ（ページ上の本物だけを対象にする）
    function applyHideAllBtnToPage(on){
      // Recycle ウィンドウ内ではなく、ページ上のフォームボタンを厳密に特定
      document.querySelectorAll('form[action="https://donguri.5ch.net/recycleunlocked"] > button')
        .forEach(btn=>{
          // rSec（Recycle ウィンドウ）外の「ページ本体」のボタンのみ隠す
          if (!rSec.contains(btn)) btn.style.display = on ? 'none' : '';
        });
    }
    // 変更イベント：保存＆即時反映（writeBool を使用してキー整合）
    ck.addEventListener('change', ()=>{
      try { writeBool('hideAllBtn', ck.checked); } catch (err) { /* noop */ }
      applyHideAllBtnToPage(ck.checked);
    });
    // Settingsウィンドウに旧UIが残っていたら撤去
    const oldInSettings = document.querySelector('#dbe-W-Settings #dbe-prm-panel0-check-hide-RyclUnLck');
    if (oldInSettings){
      const wrap = oldInSettings.closest('label, div') || oldInSettings.parentElement;
      if (wrap) wrap.remove(); else oldInSettings.remove();
    }
    // 現在値をページに反映
    try { applyHideAllBtnToPage(readBool('hideAllBtn')); } catch (err) { applyHideAllBtnToPage(false); }
  }

  // --- 名称セルの装備種＋クラス行（2行目）の表示/非表示を切替 ---
  //   クラスや style 文字列に依存せず、各テーブルの 1 列目の
  //   「2つ目の <span>（= 情報行）」と、その直前の <br> を対象とする。
  function toggleNameSubLine(hide) {
    ['necklaceTable','weaponTable','armorTable'].forEach(id => {
      const table = document.getElementById(id);
      if (!table) return;
      table.querySelectorAll('tbody > tr > td:first-child').forEach(cell => {
        if (!(cell && cell.querySelectorAll)) return;
        const spans = cell.querySelectorAll('span');
        const infoSpan = (spans.length >= 2) ? spans[1] : null; // 2行目：装備種＋クラス行
        if (infoSpan){
          infoSpan.style.display = hide ? 'none' : '';
          // 直前の <br> だけ切替（空行抑止）
          const prev = infoSpan.previousElementSibling;
          if (prev && prev.tagName === 'BR'){
            prev.style.display = hide ? 'none' : '';
          } else {
            // 後方互換：cell 内の先頭 <br> を対象
            const firstBr = cell.querySelector('br');
            if (firstBr) firstBr.style.display = hide ? 'none' : '';
          }
        }
      });
    });
  }

  // --- necklaceTableの増減列の表示/非表示を切替 ---
  function toggleDeltaColumn(show) {
    document.querySelectorAll(`.${columnIds['necklaceTable']['増減']}`)
      .forEach(el => el.style.display = show ? '' : 'none');
  }

  // --- 「錠／解錠」列の列インデックスを動的に検出 ---
  function findLockColumnIndex(table){
    try{
      const head = table.tHead && table.tHead.rows && table.tHead.rows[0];
      const body = table.tBodies && table.tBodies[0];
      if (!head || !body) return -1;
      // キャッシュ
      if (table.dataset.lockColIdx && table.dataset.lockColIdx !== 'NaN'){
        const cached = Number(table.dataset.lockColIdx);
        if (Number.isInteger(cached) && cached >= 0 && cached < head.cells.length) return cached;
      }
      const colCount = head.cells.length;
      const rows = Array.from(body.rows).slice(0, 80); // サンプル走査
      let bestIdx = -1, bestHit = 0;
      for (let c=0; c<colCount; c++){
        let hits = 0;
        for (const r of rows){
          const cell = r.cells[c]; if (!cell) continue;
          // 「解錠」「施錠」のリンクや表記を広めに判定
          if (cell.querySelector('a[href*="/unlock/"],a[href*="/lock/"]')) { hits++; continue; }
          const t = cell.textContent || '';
          if (/\[?\s*解錠\s*\]?/.test(t) || /\[?\s*施錠\s*\]?/.test(t)) hits++;
        }
        if (hits > bestHit){ bestHit = hits; bestIdx = c; }
      }
      if (bestIdx >= 0) table.dataset.lockColIdx = String(bestIdx);
      return bestIdx;
    }catch(_){ return -1; }
  }

  // --- 名称欄バッジ（❓🔰🔒）基盤：右寄せで整列するホストを用意し、個別バッジを管理 ---
  function ensureNameBadgeHost(nameCell){
    if (!nameCell) return null;
    nameCell.style.position = nameCell.style.position || 'relative';
    let host = nameCell.querySelector('.dbe-name-badges');
    if (!host){
      host = document.createElement('span');
      host.className = 'dbe-name-badges';
      // 右上寄せで重ねる（フレックスで右詰め）
      host.style.cssText = [
        'position:absolute', 'right:4px', 'top:0',
        'display:flex','gap:4px',
        'align-items:flex-start','justify-content:flex-end',
        'pointer-events:none','font-size:1.2em',
        // 絵文字が折返さないように最低限の制御
        'white-space:nowrap'
      ].join(';');
      nameCell.appendChild(host);
    }
    return host;
  }

  function setBadge(nameCell, type, show){
    const host = ensureNameBadgeHost(nameCell);
    if (!host) return;
    const CLS = {
      unknown: 'dbe-badge-unknown',
      new:     'dbe-badge-new',
      lock:    'dbe-badge-lock',
    };
    const TXT = {
      unknown: '❓',
      new:     '🔰',
      lock:    '🔒',
    };
    const ORDER = {
      // 並び順：❓ → 🔰 → 🔒
      unknown: '1',
      new:     '2',
      lock:    '3',
    };
    const cls = CLS[type];
    if (!cls) return;
    let el = host.querySelector('.' + cls);
    if (show){
      if (!el){
        el = document.createElement('span');
        el.className = cls;
        el.textContent = TXT[type] || '';
        el.style.cssText = 'order:'+ORDER[type]+';';
        host.appendChild(el);
      }
    } else {
      if (el) el.remove();
      // ホストが空になったら掃除
      if (!host.querySelector(':scope > span')) host.remove();
    }
  }

  // バッジのユーティリティ（外からも使えるように最低限公開）
  window.DBE_setNameBadge = {
    unknown: (td, on)=> setBadge(td,'unknown',!!on),
    newbie : (td, on)=> setBadge(td,'new',!!on),
    lock   : (td, on)=> setBadge(td,'lock',!!on),
  };

  // ---- ❓（解析失敗）自動付与：属性列を見て unknown を検出・反映 ----
  const KNOWN_ELEMS = ['火','氷','雷','風','地','水','光','闇','無','なし','None','NONE','none','-'];

  function findHeaderIndexByText(table, candidates){
    const thead = table.tHead; if (!thead) return -1;
    const tr = thead.rows[0]; if (!tr) return -1;
    const texts = Array.from(tr.cells).map(th=> (th.textContent||'').trim());
    for (let i=0;i<texts.length;i++){
      const t = texts[i];
      if (candidates.some(c=> t===c || t.includes(c))) return i;
    }
    return -1;
  }

  function getNameCell(row){
    return row && row.cells && row.cells[0] || null;
  }

  function isUnknownElemCell(td){
    if (!td) return false;
    const raw = (td.textContent||'').trim();
    if (!raw) return true; // 空は未知扱い
    // 絵文字やアイコンが入る想定：alt/title も拾う
    const hint = (td.getAttribute('data-elem')||td.title||'').trim();
    const val = hint || raw;
    // 既知群に1つもヒットしなければ unknown
    return !KNOWN_ELEMS.some(k=> val.includes(k));
  }

  function refreshUnknownBadgesForTable(tableId){
    const BADGE = dbeEnsureNameBadgeApi();
    const table = document.getElementById(tableId); if (!table) return;
    const body = table.tBodies && table.tBodies[0]; if (!body) return;
    const idx = findHeaderIndexByText(table, ['ELEM','属性','Elem','Element','属性/Element']);
    if (idx < 0) return;
    Array.from(body.rows).forEach(row=>{
      const tdElem = row.cells[idx];
      const nameTd = getNameCell(row);
      if (!nameTd) return;
      BADGE.unknown(nameTd, isUnknownElemCell(tdElem));
    });
  }

  function refreshUnknownBadges(){
    ['weaponTable','armorTable','necklaceTable'].forEach(refreshUnknownBadgesForTable);
  }

  // --- 名称セル（1列目）に🔒を右寄せ表示／削除（「解錠」行のみ対象） ---
  function applyPadlockMarkers(show){
    const BADGE = dbeEnsureNameBadgeApi();
    ['necklaceTable','weaponTable','armorTable'].forEach(id=>{
      const table = document.getElementById(id); if (!table) return;
      const body  = table.tBodies && table.tBodies[0]; if (!body) return;
      const lockIdx = findLockColumnIndex(table); if (lockIdx < 0) return;
      Array.from(body.rows).forEach(row=>{
        const lockCell = row.cells[lockIdx]; if (!lockCell) return;
        const isLocked = !!lockCell.querySelector('a[href*="/unlock/"]') || /\b解錠\b/.test(lockCell.textContent||'');
        const nameCell = row.querySelector('td:first-child'); if (!nameCell) return;
        // バッジ基盤で描画・削除
        window.DBE_setNameBadge.lock(nameCell, !!(show && isLocked));
      });
    });
  }

  // --- 「錠／解錠」列の表示/非表示を切替（ヘッダー含む） ---
  function toggleLockColumn(hide){
    ['necklaceTable','weaponTable','armorTable'].forEach(id=>{
      const table = document.getElementById(id); if (!table) return;
      const head = table.tHead && table.tHead.rows && table.tHead.rows[0];
      const body = table.tBodies && table.tBodies[0];
      if (!head || !body) return;
      const idx = findLockColumnIndex(table);
      if (idx < 0) return;
      // ヘッダー
      const th = head.cells[idx]; if (th) th.style.display = hide ? 'none' : '';
      // ボディ
      Array.from(body.rows).forEach(r=>{
        const td = r.cells[idx]; if (td) td.style.display = hide ? 'none' : '';
      });
    });
    // マーカーの反映
    applyPadlockMarkers(hide);
  }

  function recordClickedCell(cell, table){
    let cellId = cell.id;
    if (!cellId) {
      const rows = Array.from(table.tBodies[0].rows);
      const rowIndex = rows.indexOf(cell.parentElement);
      const cellIndex = Array.prototype.indexOf.call(cell.parentElement.cells, cell);
      cellId = `${table.id}-r${rowIndex}-c${cellIndex}`;
      cell.id = cellId;
    }
    lastClickedCellId = cellId;
    sessionStorage.setItem(anchorKey, cellId);
  }

  function scrollToAnchorCell(){
    if (!lastClickedCellId) return;
    const el = document.getElementById(lastClickedCellId);
    if (el) {
      const r = el.getBoundingClientRect();
      const y = window.pageYOffset + r.top + r.height/2 - window.innerHeight/2;
      window.scrollTo({ top: y, behavior: 'auto' });
    }
    lastClickedCellId = null;
    sessionStorage.removeItem(anchorKey);
  }

  function showOverlay(text){
    let ov = document.getElementById(overlayId);
    if (!ov) {
      ov = document.createElement('div');
      ov.id = overlayId;
      Object.assign(ov.style, {
        position:'fixed',top:0,left:0,width:'100%',height:'100%',
        backgroundColor:'rgba(0,0,0,0.5)',color:'#fff',
        display:'flex',justifyContent:'center',alignItems:'center',
        fontSize:'1.5em',zIndex:9999
      });
      document.body.appendChild(ov);
      chestDiag('overlay: created');
    }
    ov.textContent = text;
    ov.style.display = 'flex';
    ov.addEventListener('click', hideOverlay, { once:true });
  }

  function hideOverlay(){
    const ov = document.getElementById(overlayId);
    if (ov) ov.style.display = 'none';
  }

  // --- ネックレス「属性」列：DeBuff（例: "...% 減速した"）の末尾だけ赤く ---
  function dbeApplyNecklaceDebuffColoring(table){
    try{
      if (!table || table.id !== 'necklaceTable' || !table.tHead || !table.tBodies || !table.tBodies[0]) return;

      const hdrs = table.tHead.rows[0].cells;
      const attrIdx = Array.from(hdrs).findIndex(th=>th.classList.contains(columnIds['necklaceTable']['属性']));
      if (attrIdx < 0) return;

      Array.from(table.tBodies[0].rows).forEach(row=>{
        const cell = row.cells[attrIdx];
        if (!cell) return;

        cell.querySelectorAll('ul:not([id]) > li').forEach(li=>{
          // すでに加工済みならスキップ（重複加工防止）
          if (li.querySelector('span.dbe-nec-debuff')) return;

          const raw = (li.textContent || '').trim();
          const parts = raw.split('% ');
          if (parts.length < 2) return;

          // Buff（[SPD+] 等）は着色しない（DeBuff のみ）
          if (parts[0].includes('+]')) return;

          const head = parts[0] + '% ';
          const tail = parts.slice(1).join('% ').trim();
          if (!tail) return;

          li.textContent = '';
          li.appendChild(document.createTextNode(head));
          const sp = document.createElement('span');
          sp.className = 'dbe-nec-debuff';
          sp.textContent = tail;
          li.appendChild(sp);
        });
      });
    }catch(_){}
  }

  // --- [錠]/[解錠]セル背景色を適用 ---
  function applyCellColors(){
    const unlockedColor = readStr('unlockedColor');
    const lockedColor   = readStr('lockedColor');
    tableIds.forEach(id=>{
      const table = document.getElementById(id);
      if (!table?.tHead) return;
      // 「解」列インデックス
      const hdrs   = table.tHead.rows[0].cells;
      const lockIdx = Array.from(hdrs).findIndex(th=>th.classList.contains(columnIds[id]['解']));
      if (lockIdx < 0) return;
      Array.from(table.tBodies[0].rows).forEach(row=>{
        const cell = row.cells[lockIdx];
        // a[href*="/lock/"] があるなら「未ロック」→unlockedColor、それ以外を lockedColor
        const isUnlocked = !!cell.querySelector('a[href*="/lock/"]');
        const bg = isUnlocked ? unlockedColor : lockedColor;
        cell.style.backgroundColor = bg;
        // 明度計算して文字色を切り替え
        const r = parseInt(bg.slice(1,3),16), g = parseInt(bg.slice(3,5),16), b = parseInt(bg.slice(5,7),16);
        const lum = 0.299*r + 0.587*g + 0.114*b;
        const txt = lum > 186 ? '#FF0000' : '#FFFFFF';
        cell.style.color = txt;
        const a = cell.querySelector('a');
        if (a) a.style.color = txt;
      });

      // ネックレス「属性」列：DeBuff末尾テキストを赤く
      if (id === 'necklaceTable') { try{ dbeApplyNecklaceDebuffColoring(table); }catch(_){} }

    });
  }

  // 〓〓〓 追加：アイテムID列の ON/OFF ▼ここから▼ 〓〓〓
  function toggleItemIdColumn(enabled){
    const triplets = [
      { tableId:'necklaceTable', itemKey:'necClm-ItemID', nameKey:'necClm-Name', equpKey:'necClm-Equp' },
      { tableId:'weaponTable',   itemKey:'wepClm-ItemID', nameKey:'wepClm-Name', equpKey:'wepClm-Equp' },
      { tableId:'armorTable',    itemKey:'amrClm-ItemID', nameKey:'amrClm-Name', equpKey:'amrClm-Equp' },
    ];
    for (const t of triplets){
      const table = document.getElementById(t.tableId);
      if (!table) continue;

      // すでに目的の状態なら何もしない
      // （フォーカス復帰/visibilitychange のたびに refreshSortingForTableId が走ると、
      //  ソート状態やフィルタUIが作り直されて選択状態が解除されるため）
      let has = false;
      try{
        if (typeof getHeaderIndexByKey === 'function'){
          has = (getHeaderIndexByKey(table, t.itemKey) !== -1);
        } else {
          const thead = table.tHead || table.querySelector('thead');
          has = !!(thead && thead.querySelector(`th.${t.itemKey}, th[data-colkey="${t.itemKey}"]`));
        }
      }catch(_){
        has = false;
      }

      // thead に ID 列があるのに tbody 側が欠けている（＝列ズレが起きる）ケースだけ補修して抜ける
      if (enabled && has){
        try{
          const idx = (typeof getHeaderIndexByKey === 'function') ? getHeaderIndexByKey(table, t.itemKey) : -1;
          const r0  = (table.tBodies && table.tBodies[0] && table.tBodies[0].rows) ? table.tBodies[0].rows[0] : null;
          const okBody = !r0 || (idx >= 0 && r0.cells && r0.cells[idx] && r0.cells[idx].classList && r0.cells[idx].classList.contains(t.itemKey));
          if (!okBody){
            ensureItemIdColumn(table, t); // thead は既にある前提で tbody を同期
          }
        }catch(_){}
        continue;
      }
      if (!enabled && !has) continue;

      if (enabled){ ensureItemIdColumn(table, t); }
      else        { removeItemIdColumn(table, t); }

      // 列構造が変わったときだけ、ソート等のヘッダー配線を再構成する
      try { refreshSortingForTableId(t.tableId); } catch(err){ console.warn('[DBE] refreshSortingForTableId failed:', err); }
    }
    // 残留オーバーレイがあれば除去（クリックブロック防止）
    document.getElementById('dbe-toast-itemidcopy')?.remove();
  }

  // 追加：ヘッダーのイベントリスナーをリセットしてから processTable を再実行
  function refreshSortingForTableId(id){
    const table = document.getElementById(id);
    if (!table) return;
    const thead = table.tHead || table.querySelector('thead');
    if (!thead || !thead.rows || !thead.rows[0]) return;
    // ヘッダー行をクローン置換（既存のクリックハンドラを除去）
    const oldRow = thead.rows[0];
    const newRow = oldRow.cloneNode(true);
    thead.replaceChild(newRow, oldRow);
    // ネックレスはフィルターUIが個別実装のため、再ワイヤ前に重複を掃除（直前の .filter-ui / .dbe-necklace-filter を全削除）
    if (id === 'necklaceTable') {
      try{
        let probe = table.previousElementSibling;
          while (probe && probe.classList && (probe.classList.contains('filter-ui') || probe.classList.contains('dbe-necklace-filter'))) {
          const prev = probe.previousElementSibling;
          probe.remove();
          probe = prev;
        }
      }catch(err){
        console.warn('[DBE] cleanup necklace filter-ui failed:', err);
      }
    }
    // 直近のソート状態をクリアしてから再ワイヤ
    try { dbeClearSortHistory(id); } catch {}
    try { processTable(id); } catch(e){ console.warn('[DBE] processTable rebind failed:', e); }
  }

  function getHeaderIndexByClass(table, klass){
    const thead = table.tHead || table.querySelector('thead');
    if (!thead) return -1;
    const ths = thead.rows[0]?.cells || [];
    for (let i=0;i<ths.length;i++){
      const th = ths[i];
      if (th.classList?.contains(klass)) return i;
      if (th.dataset?.colkey === klass)  return i;
      if (th.getAttribute?.('data-colkey') === klass) return i;
    }
    return -1;
  }

  function getHeaderIndexByKey(table, key){
    const thead = table.tHead || table.querySelector('thead');
    if (!thead) return -1;
    const ths = thead.rows[0]?.cells || [];
    for (let i=0;i<ths.length;i++){
      const th = ths[i];
      if (th.dataset?.colkey === key) return i;
      if (th.classList?.contains(key)) return i;
      if (th.getAttribute?.('data-colkey') === key) return i;
    }
    return -1;
  }

  function createTh(key, text){
    const th = document.createElement('th');
    th.dataset.colkey = key;
    th.classList.add(key);
    th.textContent = text;
    th.style.whiteSpace = 'nowrap';
    return th;
  }

  function extractItemIdFromEqupCell(cell){
    if (!cell) return null;
  // 代表的なパターンを網羅（/equip/123, /lock/123, /recycle/123, ?equip=123 等）
  const hrefs = Array.from(cell.querySelectorAll('a')).map(a => a.getAttribute('href') || '');
    for (const href of hrefs){
      const m = href.match(/(?:\/(?:equip|lock|recycle)\/|[?&](?:equip|equipid)=)(\d+)/);
      if (m) return m[1];
    }
    // 最終手段：セルのテキストから数字を拾う（桁数制限なし）
    const txt = cell.textContent || '';
    const m2 = txt.match(/(\d+)/);
    return m2 ? m2[1] : null;
  }

  // ============================================================
  // ▽ここから▽ Soft Reload Utilities（テーブル単位の再読込）
  //  - /bag を fetch して対象 table の tbody だけを差し替える
  //  - 既存のフィルタ/ソート状態は保持（UIは作り直さない）
  // ============================================================
  async function dbeFetchBagHtmlDocument(){
    const url = location.href;
    const res = await fetch(url, { credentials:'include', cache:'no-store' });
    if (!res || !res.ok) throw new Error(`fetch failed: ${res ? res.status : 'no response'}`);
    const html = await res.text();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  async function dbeSoftReloadTableTbody(tableId){
    const table = document.getElementById(tableId);
    if (!table || !table.tBodies || !table.tBodies[0]) return false;
    const doc = await dbeFetchBagHtmlDocument();
    const newTable = doc.getElementById(tableId);
    if (!newTable || !newTable.tBodies || !newTable.tBodies[0]) return false;
    table.tBodies[0].innerHTML = newTable.tBodies[0].innerHTML;
    return true;
  }

  // ============================================================
  // ▽ここから▽ ItemID Copy Utilities（v13.11.4 用・互換実装）
  //  - /equip/<数字> 等から固有IDを抽出
  //  - ボタンのテキストにIDを表示
  //  - クリックでIDをコピー（clipboard / fallback）
  //  - dbeExtractItemIdFromRow の引数順（(tr,kind) と (kind,tr)）両対応
  // ============================================================

  /** 抽出: (tr, kind) と (kind, tr) の両方を受け付ける */
  function dbeExtractItemIdFromRow(a, b){
    try{
      let tr, kind;
      if (a instanceof HTMLTableRowElement){
        tr = a; kind = b;
      }else{
        kind = a; tr = b;
      }
      if (!tr) return null;
      const equipCls =
        (kind === 'nec') ? 'necClm-Equp' :
        (kind === 'wep') ? 'wepClm-Equp' :
        (kind === 'amr') ? 'amrClm-Equp' : null;
      let cell = null;
      if (equipCls){
        cell = tr.querySelector(`td.${equipCls}`);
      }
      // 念のためフォールバック（多くのテーブルで2列目が「装」想定）
      if (!cell && tr.cells && tr.cells.length >= 2){
        cell = tr.cells[1];
      }
      if (!cell) return null;
      const aTag = cell.querySelector('a[href]');
      if (!aTag || !aTag.href) return null;
      const href = aTag.href;
      // .../equip/12345, .../item/12345, ?id=12345, ?item=12345 などを許容
      const m =
        href.match(/(?:equip|item|id)[=/](\d+)/i) ||
        href.match(/[?&](?:id|item)=(\d+)/i);
      return m ? m[1] : null;
    }catch(_){
      return null;
    }
  }

  /** 文字列をクリップボードへ（失敗時は fallback） */
  async function dbeCopyTextToClipboard(text){
    try{
      if (navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(text);
        return true;
      }
    }catch(_){}
    try{
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    }catch(_){
      return false;
    }
  }

  /** 視覚フィードバック用の簡易トースト（任意） */
  function dbeShowItemIdToast(message){
    let toast = document.getElementById('dbe-toast-itemidcopy');
    if (!toast){
      toast = document.createElement('div');
      toast.id = 'dbe-toast-itemidcopy';
      Object.assign(toast.style, {
        position:'fixed', inset:'0', display:'flex',
        alignItems:'center', justifyContent:'center',
        background:'rgba(0,0,0,0.25)', zIndex: 2147483647,
      });
      const box = document.createElement('div');
      Object.assign(box.style, {
        background:'#fff', color:'#000', padding:'12px 16px',
        borderRadius:'10px', boxShadow:'0 4px 12px rgba(0,0,0,0.2)',
        maxWidth:'90%', textAlign:'center', fontSize:'1em'
      });
      box.id = 'dbe-toast-itemidcopy-box';
      toast.appendChild(box);
      document.body.appendChild(toast);
      toast.addEventListener('click', ()=> toast.remove());
    }
    const box = toast.querySelector('#dbe-toast-itemidcopy-box');
    if (box) box.textContent = message;
    toast.style.display = 'flex';
    clearTimeout(dbeShowItemIdToast._tid);
    dbeShowItemIdToast._tid = setTimeout(()=>{ toast.remove(); }, 1200);
  }

  /** ItemID コピー用ボタン（生成時にIDをラベル表示、クリックでコピー） */
  function dbeMakeItemIdCopyBtn(tr, kind){
    const id = dbeExtractItemIdFromRow(tr, kind);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dbe-btn-copyid';
    btn.textContent = id ?? '-';
    btn.title = id ? 'クリックでIDをコピー' : 'IDが見つかりません';
    btn.disabled = !id;
    btn.addEventListener('click', async (ev)=>{
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
      if (!id) return;
      const ok = await dbeCopyTextToClipboard(id);
      if (ok){
        const old = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(()=>{ btn.textContent = old; }, 1200);
        dbeShowItemIdToast('クリップボードに 装備ID:' + id + ' をコピーしました。');
      }else{
        dbeShowItemIdToast('IDコピーに失敗しました');
      }
    }, {passive:false});
    return btn;
  }

  /** 既存呼び出し互換：makeCopyBtn(tr, kind) を公開 */
  function makeCopyBtn(tr, kind){
    return dbeMakeItemIdCopyBtn(tr, kind);
  }

  /** 最低限の見た目（必要なら削ってOK） */
  (function ensureCopyBtnStyle(){
    try{
      if (document.getElementById('dbe-style-copyid')) return;
      const st = document.createElement('style');
      st.id = 'dbe-style-copyid';
      st.textContent = `
        .dbe-btn-copyid{
          margin:auto;
          padding: 0.2em 0.6em;
          font-size: 0.9em;
          line-height: 1.1em;
          cursor: pointer;
        }
        .dbe-btn-copyid[disabled]{ opacity: .5; cursor: not-allowed; }
      `;
      document.head.appendChild(st);
    }catch(_){}
  })();
  // ============================================================
  // △ここまで△ ItemID Copy Utilities
  // ============================================================

  function ensureItemIdColumn(table, {itemKey, nameKey, equpKey}){
    const thead = table.tHead || table.querySelector('thead');
    const tbody = table.tBodies?.[0] || table.querySelector('tbody');
    if (!thead || !tbody) return;
    const trh = thead.rows[0];
    if (!trh) return;

    // thead に既に ID 列がある場合は、その位置に tbody を同期する（再読込直後の列ズレ対策）
    let insertAt = -1;
    try{
      insertAt = getHeaderIndexByKey(table, itemKey);
    }catch(_){
      insertAt = -1;
    }

    if (insertAt === -1){
      const nameIdx = getHeaderIndexByClass(table, nameKey);
      const equpIdx = getHeaderIndexByClass(table, equpKey);
      if (nameIdx < 0 || equpIdx < 0) return;

      insertAt = nameIdx + 1; // 名称直後（＝名称と装備の間）

      // ヘッダに TH を挿入
      const th = createTh(itemKey, 'ID');
      // ← 追加：他ヘッダーの色をコピーして、中央寄せにする
      try {
        // 自分以外の既存ヘッダー（なければ先頭TH）を参照
        const ref = trh.querySelector(`th:not([data-colkey="${itemKey}"])`) || trh.querySelector('th');
          if (ref) {
          const cs = getComputedStyle(ref);
          th.style.backgroundColor = cs.backgroundColor;
          th.style.color = cs.color;
          // もし他ヘッダーが左右や上下の余白/枠線を指定していれば、必要に応じて下記を有効化
          // th.style.border = cs.border;
          // th.style.padding = cs.padding;
        }
        th.style.textAlign = 'center';
      } catch { th.style.textAlign = 'center'; }
      trh.insertBefore(th, trh.children[insertAt] || null);
    }

    // テーブルIDから kind を判定（ネックレス／武器／防具）
    const kind =
      (table.id === 'necklaceTable') ? 'nec' :
      (table.id === 'weaponTable')   ? 'wep' :
      (table.id === 'armorTable')    ? 'amr' : null;

    // ボディに TD を挿入。実IDの抽出はクリック時（makeCopyBtn）に行う。
    for (const tr of Array.from(tbody.rows)){
      // すでに正しい位置に存在するなら何もしない
      try{
        if (insertAt >= 0 && tr.children[insertAt] && tr.children[insertAt].classList && tr.children[insertAt].classList.contains(itemKey)) continue;
      }catch(_){}

      // 位置ズレも含め、既存の ID セルがあれば一旦除去
      try{
        tr.querySelectorAll(`td.${itemKey}, td[data-colkey="${itemKey}"]`).forEach(el=>el.remove());
      }catch(_){}
      const td = document.createElement('td');
      td.dataset.colkey = itemKey;
      td.classList.add(itemKey);
      td.style.textAlign = 'center';
      td.appendChild(makeCopyBtn(tr, kind));
      tr.insertBefore(td, tr.children[insertAt] || null);
    }
  }

  function removeItemIdColumn(table, {itemKey}){
    const thead = table.tHead || table.querySelector('thead');
    const tbody = table.tBodies?.[0] || table.querySelector('tbody');
    if (!thead || !tbody) return;
    const idx = getHeaderIndexByKey(table, itemKey);
    if (idx === -1) return;
    const trh = thead.rows[0];
    if (trh && trh.children[idx]) trh.removeChild(trh.children[idx]);
    for (const tr of Array.from(tbody.rows)){
      if (tr.children[idx]) tr.removeChild(tr.children[idx]);
    }
  }
  // 〓〓〓 追加：アイテムID列の ON/OFF ▲ここまで▲ 〓〓〓

  // ▼ここから▼======================================================================
  // 〓〓〓 テーブルセルの padding を適用する（necklace/weapon/armor 全体） 〓〓〓
  function applyCellPaddingCss(vPx, hPx){
    const v = Number.isFinite(+vPx) ? Math.max(0, (+vPx|0)) : CELL_PAD_DEFAULT_V;
    const h = Number.isFinite(+hPx) ? Math.max(0, (+hPx|0)) : CELL_PAD_DEFAULT_H;
    let style = document.getElementById('dbe-cellpad-style');
    if (!style){
      style = document.createElement('style');
      style.id = 'dbe-cellpad-style';
      document.head.appendChild(style);
    }
    style.textContent =
      `#necklaceTable td, #weaponTable td, #armorTable td { padding: ${v}px ${h}px !important; }`;
  }

  // 〓〓〓 dbe-Menu-settings（dbe-W-Settings）に「セルの余白指定」行を移植 〓〓〓
  function buildCellPaddingControlsInSettings(){
    const wnd = document.getElementById('dbe-W-Settings');
    const panel = wnd ? (wnd.querySelector('#dbe-panel0-Settings') || wnd) : null;
    if (!panel) return false;

    // すでに作成済みなら何もしない
    if (panel.querySelector('#dbe-cellpad-row')) return true;

    // 挿入位置：「基準文字サイズ」の直下（= 「［錠］の背景色」より前）
    const anchorLeaf = Array.from(panel.querySelectorAll('*'))
      .find(el => el.childElementCount === 0 && typeof el.textContent === 'string' && el.textContent.includes('基準文字サイズ'));
    const anchor = anchorLeaf ? (anchorLeaf.closest('div,li,section,p') || anchorLeaf) : null;

    // 行本体
    const row = document.createElement('div');
    row.id = 'dbe-cellpad-row';
    row.style.cssText = 'display:flex;align-items:center;gap:10px;margin:6px 0;flex-wrap:nowrap;white-space:nowrap;color:#000;';

    const title = document.createElement('span');
    title.id = 'dbe-cellpad-title';
    title.textContent = 'セルの余白指定：';
    Object.assign(title.style, {
      display:'inline-block',
      minWidth:'8em',
      whiteSpace:'nowrap',
      fontSize:'1em',
      fontWeight:'normal',
      color:'#000',
      flex:'0 0 auto'
    });
    row.appendChild(title);

    const makeBox = (title, key, defVal) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:4px;flex-wrap:nowrap;white-space:nowrap;';
      const t = document.createElement('span'); t.textContent = title;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.style.cssText = 'width:2.5em;padding:2px 4px;font-size:0.9em;flex:0 0 auto;'; // 縮まない
      input.value = localStorage.getItem(key) ?? String(defVal);
      const px = document.createElement('span'); px.textContent = 'px';
      wrap.appendChild(t); wrap.appendChild(input); wrap.appendChild(px);
      input.addEventListener('change', ()=>{
        const num = Math.max(0, (parseInt(input.value,10) || 0));
        localStorage.setItem(key, String(num));
        const vNow = parseInt(localStorage.getItem(CELL_PAD_V_KEY) ?? CELL_PAD_DEFAULT_V, 10) || CELL_PAD_DEFAULT_V;
        const hNow = parseInt(localStorage.getItem(CELL_PAD_H_KEY) ?? CELL_PAD_DEFAULT_H, 10) || CELL_PAD_DEFAULT_H;
        applyCellPaddingCss(vNow, hNow);
      });
      return {wrap, input};
    };

    const vCtl = makeBox('上下', CELL_PAD_V_KEY, CELL_PAD_DEFAULT_V);
    const hCtl = makeBox('左右', CELL_PAD_H_KEY, CELL_PAD_DEFAULT_H);
    row.appendChild(vCtl.wrap);
    row.appendChild(hCtl.wrap);

    // 挿入（アンカー直下。それが無ければ末尾）
    if (anchor && anchor.parentNode){
      anchor.parentNode.insertBefore(row, anchor.nextSibling);
    } else {
      panel.appendChild(row);
    }
    // 既存の保存値で CSS を適用しておく
    const v = parseInt(localStorage.getItem(CELL_PAD_V_KEY) ?? CELL_PAD_DEFAULT_V, 10) || CELL_PAD_DEFAULT_V;
    const h = parseInt(localStorage.getItem(CELL_PAD_H_KEY) ?? CELL_PAD_DEFAULT_H, 10) || CELL_PAD_DEFAULT_H;
    applyCellPaddingCss(v, h);
    return true;
  }

  // 〓〓〓 初期化（パネル生成時期に依存しない） 〓〓〓
  function initCellPaddingControls(){
    if (buildCellPaddingControlsInSettings()) return;
    const obs = new MutationObserver(()=>{
      if (buildCellPaddingControlsInSettings()){
        obs.disconnect();
      }
    });
    obs.observe(document.documentElement, {childList:true, subtree:true});
  }

  // 即時起動
  initCellPaddingControls();
  // ▲ここまで▲======================================================================

  // 〓〓〓 メニューUIを保存値から再同期 〓〓〓
  function syncMenuFromStorage(){
    // 新仕様：W-Settings を同期対象にする（旧パネルは廃止）
    const menu = document.getElementById('dbe-W-Settings');
    if (!menu) return;

    // 基準文字サイズ
    applyBaseFontSize();
    const fs = readStr('baseFontSize');
    menu.querySelectorAll('input[name="dbe-fontsize"]').forEach(r=>{
      r.checked = (r.value === fs);
    });

    // 色
    const uc = readStr('unlockedColor'), lc = readStr('lockedColor');
    const uColor = menu.querySelector('#dbe-prm-panel0-setcolor-cell-unlocked');
    const uText  = menu.querySelector('#dbe-prm-panel0-text-unlocked');
    const lColor = menu.querySelector('#dbe-prm-panel0-setcolor-cell-locked');
    const lText  = menu.querySelector('#dbe-prm-panel0-text-locked');
    if (uColor) uColor.value = uc; if (uText) uText.value = uc;
    if (lColor) lColor.value = lc; if (lText) lText.value = lc;
    applyCellColors();

    // ネックレス増減列
    const showDelta = readBool('showDelta');
    const deltaCk = menu.querySelector('#dbe-prm-panel0-check-display-necClm-Dlta');
    if (deltaCk) deltaCk.checked = showDelta;
    toggleDeltaColumn(showDelta);

    // 分解列の非表示
    const hideRycl = readBool('hideRyclCol');
    const ryclCk = menu.querySelector('#dbe-prm-panel0-check-hide-Clm-Rycl');
    if (ryclCk) ryclCk.checked = hideRycl;
    tableIds.forEach(id=>{
      document.querySelectorAll(`.${columnIds[id]['分解']}`)
        .forEach(el=> el.style.display = hideRycl ? 'none' : '');
    });

    // 「全て分解する」ボタンの非表示（移植先：Recycle ウィンドウ）
    const hideAll = readBool('hideAllBtn');
    const rWnd = document.getElementById('dbe-W-Recycle');
    const allCk = rWnd ? rWnd.querySelector('#dbe-prm-recycle-check-hide-RyclUnLck, #dbe-prm-panel0-check-hide-RyclUnLck') : null;
    if (allCk) allCk.checked = hideAll;
    document.querySelectorAll('button, a').forEach(el=>{
      if (el.textContent==='ロックされていないアイテムを全て分解する' && !(rWnd && rWnd.contains(el))) {
        el.style.display = hideAll ? 'none' : '';
      }
    });

    // アイテムID列の表示
    const showItemId = readBool('displayItemId');
    const itemIdCk = menu.querySelector('#dbe-prm-panel0-check-display-ItemID');
    if (itemIdCk) itemIdCk.checked = showItemId;
    toggleItemIdColumn(showItemId);

    // まきこみアラート（チェック状態を保存値に合わせ直す）
    menu.querySelectorAll('input[id^="alert-grade-"], input[id^="alert-rarity-"]').forEach(el=>{
      el.checked = localStorage.getItem(el.id) === 'true';
    });
  }

  // --- 基準文字サイズ適用 ---
  function applyBaseFontSize(){
    const size = readStr('baseFontSize');
    document.documentElement.style.fontSize = size;
  }

  // --- 確認ダイアログを出す ---
  function showConfirm(message){
    return new Promise(resolve => {
      const existing = document.getElementById('donguriConfirmOverlay');
      if (existing) existing.remove();
      const ov = document.createElement('div');
      ov.id = 'donguriConfirmOverlay';
      Object.assign(ov.style, {
        position:'fixed',top:0,left:0,width:'100%',height:'100%',
        backgroundColor:'rgba(0,0,0,0.5)',
        display:'flex',justifyContent:'center',alignItems:'center',zIndex:1001001
      });
      const box = document.createElement('div');
      Object.assign(box.style, {
        backgroundColor:'#fff',padding:'20px',borderRadius:'8px',
        border:'5px solid #FF6600',textAlign:'center',color:'#000',
        maxWidth:'80%',fontSize:'1.1em'
      });
      // 第一段落を引数で受け取る
      const p1 = document.createElement('p');
      p1.textContent = message;
      const p2 = document.createElement('p');
      p2.textContent = 'このまま分解を行いますか？';
      box.append(p1,p2);
      const btns = document.createElement('div'); btns.style.marginTop='16px';
      const ok = document.createElement('button');   ok.textContent='分解する'; ok.style.margin='10px';
      const no = document.createElement('button');   no.textContent='キャンセル'; no.style.margin='10px';
      btns.append(ok,no);
      box.appendChild(btns);
      ov.appendChild(box);
      document.body.appendChild(ov);
      ok.addEventListener('click', ()=>{ ov.remove(); resolve(true); });
      no.addEventListener('click', ()=>{ ov.remove(); resolve(false); });
    });
  }

  // --- 一括分解送信の保留＆確認機能 ---
  function initBulkRecycle(){
    const forms = document.querySelectorAll('form[action="https://donguri.5ch.net/recycleunlocked"][method="POST"]');
    forms.forEach(form=>{
      form.addEventListener('submit', async e=>{
        e.preventDefault();
        showOverlay('まとめて分解します…');
        // ユーザーがチェックしたグレード／レアリティを収集
        const selectedGrades    = Array.from(document.querySelectorAll('input[id^="alert-grade-"]:checked')).map(i=>i.value);
        const selectedRarities  = Array.from(document.querySelectorAll('input[id^="alert-rarity-"]:checked')).map(i=>i.value);
              const foundTypes = new Set();

         // テーブルを順に調べて
        for (const id of tableIds){
          const table = document.getElementById(id);
          if (!table?.tHead) continue;
          const hdrs = table.tHead.rows[0].cells;
          let lockIdx=-1,nameIdx=-1;
          for (let i=0;i<hdrs.length;i++){
            const t = hdrs[i].textContent.trim();
            if (t==='解')      lockIdx = i;
            if (t==='ネックレス' && id==='necklaceTable') nameIdx = i;
            if (t==='武器'     && id==='weaponTable')     nameIdx = i;
            if (t==='防具'     && id==='armorTable')      nameIdx = i;
          }
          if (lockIdx<0||nameIdx<0) continue;

          Array.from(table.tBodies[0].rows).forEach(row=>{
            // アンロック済みだけ対象
            if (!row.cells[lockIdx].querySelector('a[href*="/lock/"]')) return;
            const text = row.cells[nameIdx].textContent;
            // レアリティ
            selectedRarities.forEach(rk => {
              if (text.includes(rk)) foundTypes.add(rk);
            });
            // グレード
            selectedGrades.forEach(gd => {
              if (text.includes(gd)) foundTypes.add(gd);
            });
          });
        }

        // １つでもヒットしたら警告（ヒットしたグレードは日本語に置換）
        if (foundTypes.size > 0){
          const labels = Array.from(foundTypes)
            .map(type => gradeNames[type] || type)
            .join(', ');
          const ok = await showConfirm(`分解するアイテムに ${labels} が含まれています。`);
        if (!ok){
            hideOverlay();
            return;
        }
      }

      // 実行
      try {
        await fetch(form.action,{method:'POST'});
          location.reload();
        } catch{ hideOverlay(); }
      });
    });
  }

  // --- ロック/アンロック切替機能 ---
  function initLockToggle(){
    tableIds.forEach(id=>{
      const table = document.getElementById(id);
      if (!table || !table.tHead) return;
      // ★二重配線防止（patchBagFromDoc 後に再実行されるため）
      try{
        if (table.dataset && table.dataset.dbeLockToggleInit === '1') return;
        if (table.dataset) table.dataset.dbeLockToggleInit = '1';
      }catch(_){}

      const colMap = columnIds[id];
      const hdrs   = Array.from(table.tHead.rows[0].cells);
      let lockIdx=-1,ryclIdx=-1,equpIdx=-1;
      hdrs.forEach((th,i)=>{
        const t = th.textContent.trim();
        if (!colMap[t]) return;
        th.classList.add(colMap[t]);
        if (t==='解') lockIdx=i;
        if (t==='分解') ryclIdx=i;
        if (t==='装') equpIdx=i;
      });
      Array.from(table.tBodies[0].rows).forEach(row => {
        if (lockIdx >= 0) {
          const cell = row.cells[lockIdx];
          cell.classList.add(colMap['解']);
          const a = cell.querySelector('a');
          if (a) {
            if (a.href.includes('/lock/')) {
              cell.setAttribute('released', '');
            }
            else if (a.href.includes('/unlock/')) {
              cell.setAttribute('secured', '');
            }
          }
        }
        if (ryclIdx >= 0) {
          row.cells[ryclIdx].classList.add(colMap['分解']);
        }
      });
      // 初期色付け
      applyCellColors();
      // イベント
      table.addEventListener('click', async e=>{
        const a = e.target.closest('a[href*="/lock/"],a[href*="/unlock/"]');
        if (!a) return;
        const td = a.closest('td');
        if (!td) return;
        const tr = td.closest('tr');
        if (!tr) return;
        // 「名称列クリックで行を限定」等で class が失われた行でも動くように、
        // 見出しテキストから現在の列indexを動的取得して「解」列クリックだけを捕捉する
        const __getHdrIdx = (label)=>{
          try{
            const head = table.tHead && table.tHead.rows && table.tHead.rows[0];
            if (!head) return -1;
            const cells = head.cells || [];
            for (let i=0;i<cells.length;i++){
              if (((cells[i].textContent||'').trim()) === label) return i;
            }
          }catch(_){}
          return -1;
        };
        const __lockIdxNow = __getHdrIdx('解');
        const __tdIdxNow   = (tr && tr.cells) ? Array.prototype.indexOf.call(tr.cells, td) : -1;
        if (__lockIdxNow >= 0 && __tdIdxNow >= 0 && __tdIdxNow !== __lockIdxNow) return;
        e.preventDefault();
        // クリック位置を記憶（後でスクロール復帰）
        try{ recordClickedCell(td, table); }catch(_){}
        const isUnlock = a.href.includes('/unlock/');
        showOverlay(isUnlock ? 'アンロックしています...' : 'ロックしています...');
        try {
          // 1) 行の《装》セルから itemId を抽出（リンク書式に依存しない）
          let itemId = null;
          try{
            const __equpIdxNow = __getHdrIdx('装');
            const equpCell = (tr && __equpIdxNow>=0) ? tr.cells[__equpIdxNow] : ((tr && equpIdx>=0) ? tr.cells[equpIdx] : null);
            if (typeof extractItemIdFromEqupCell === 'function'){
              itemId = extractItemIdFromEqupCell(equpCell);
            }
            if (!itemId && equpCell){
              const m = (equpCell.textContent||'').match(/(\d+)/);
              itemId = m ? m[1] : null;
            }
            // フォールバック：行内の /equip/<id> から抽出（列位置/class に依存しない）
            if (!itemId && tr){
              const eqA = tr.querySelector('a[href*="/equip/"]');
              const href = eqA ? (eqA.getAttribute('href') || eqA.href || '') : '';
              const mm = href.match(/\/equip\/(\d+)/);
              itemId = mm ? mm[1] : null;
            }
          }catch(_){}

          // 2) 送信は form の有無で POST/GET を自動判定
          const form = a.closest('form');
          let html = '';
          if (form){
            const method = (form.method||'POST').toUpperCase();
            const action = form.action || a.href;
            const fd = new FormData(form);
            const res = await fetch(action, { method, body: method==='POST' ? fd : undefined });
            html = await res.text();
            // ログ：施錠／解錠の記録（itemId が取れていれば残す）
            try{ if (itemId) dbeChestLogActionById(itemId, isUnlock ? '解錠' : '施錠'); }catch(_){}
          } else {
            const res = await fetch(a.href, { method:'GET' });
            html = await res.text();
            // a.href に ID が含まれる形式ならログ化
            try{
              const mm = a.href.match(/\/(unlock|lock)\/(\d+)/);
              if (mm) dbeChestLogActionById(mm[2], mm[1]==='lock'?'施錠':'解錠');
            }catch(_){}
          }

          // 3) 返ってきた HTML からテーブルを取り出し、対象行の「解」「分解」セルだけ差し替え
          const doc  = new DOMParser().parseFromString(html,'text/html');
          const newTable = doc.getElementById(id);
          if (!newTable || !newTable.tHead || !newTable.tBodies[0]) { hideOverlay(); location.href = a.href; return; }
          let newLockIdx=-1,newRyclIdx=-1;
          Array.from(newTable.tHead.rows[0].cells).forEach((th,i)=>{
            if ((th.textContent||'').trim()==='解')   newLockIdx=i;
            if ((th.textContent||'').trim()==='分解') newRyclIdx=i;
          });
          if (newLockIdx<0){ hideOverlay(); location.href = a.href; return; }
          // itemId がなければフォールバックで a.href から推測
          if (!itemId){
            const mm = a.href.match(/\/(?:unlock|lock)\/(\d+)/);
            itemId = mm ? mm[1] : null;
          }
          const targetA = Array.from(newTable.tBodies[0].rows)
                                .map(r=>r.cells[newLockIdx])
                                .find(c=> itemId
                                  ? c.querySelector(`a[href*="/${itemId}"]`)
                                  : c.querySelector('a[href*="/unlock/"],a[href*="/lock/"]'));
          if (!targetA){ hideOverlay(); location.href = a.href; return; }
          const targetB = targetA.closest('tr')?.cells?.[newRyclIdx] || null;
          td.innerHTML = targetA.innerHTML;
          const __ryclIdxNow = __getHdrIdx('分解');
          const ryTd = (__ryclIdxNow>=0 && tr && tr.cells) ? tr.cells[__ryclIdxNow] : (tr ? tr.querySelector(`td.${colMap['分解']}`) : null);
          if (ryTd) ryTd.innerHTML = targetB?.innerHTML || '';
          // secured/released 属性を更新（色付け/マーカーの整合性）
          try{
            td.removeAttribute('secured'); td.removeAttribute('released');
            const __a2 = td.querySelector('a[href]');
            const __href2 = __a2 ? String(__a2.getAttribute('href')||__a2.href||'') : '';
            if (__href2.includes('/lock/')) td.setAttribute('released','');
            else if (__href2.includes('/unlock/')) td.setAttribute('secured','');
          }catch(_){}
          // 再色付け
          applyCellColors();
        } catch(_err){
          // 失敗時は通常遷移にフォールバック
          try{ hideOverlay(); }catch(_){}
          location.href = a.href;
          return;
        } finally {
          hideOverlay();
        }
      });
    });
  }

  // --- 分解機能改良 ---
  function initRecycle(){
    tableIds.forEach(id=>{
      const table = document.getElementById(id);
      if (!table) return;
      // ★二重配線防止（patchBagFromDoc 後に再実行されるため）
      try{
        if (table.dataset && table.dataset.dbeRecycleInit === '1') return;
        if (table.dataset) table.dataset.dbeRecycleInit = '1';
      }catch(_){}

      table.addEventListener('click', async e=>{
        const a = e.target.closest('a[href*="/recycle/"]');
        if (!a) return;
        e.preventDefault();
        const m = a.href.match(/\/recycle\/(\d+)/);
        if (!m) return;
        recycleTableId = id;
        recycleItemId  = m[1];
        showOverlay('分解しています...');
          try {
            // ▼ログ追加：分解の記録
            try{ dbeChestLogActionById(recycleItemId,'分解'); }catch(_){ }
          const res = await fetch(a.href);
          const html = await res.text();
          const doc  = new DOMParser().parseFromString(html,'text/html');
          const newTable = doc.getElementById(recycleTableId);
          let found = false;
          if (newTable?.tBodies[0]){
            Array.from(newTable.tBodies[0].rows).forEach(row=>{
              if (row.querySelector(`a[href*="/recycle/${recycleItemId}"]`)) found = true;
            });
          }
          if (found){
            hideOverlay();
            location.reload();
          } else {
            const curr = document.getElementById(recycleTableId);
            if (curr?.tBodies[0]){
              Array.from(curr.tBodies[0].rows).forEach(row=>{
                if (row.querySelector(`a[href*="/recycle/${recycleItemId}"]`)) row.remove();
              });
            }
            hideOverlay();
          }
        } catch{ hideOverlay(); }
        recycleTableId = null;
        recycleItemId  = null;
      });
    });
  }

  // 〓〓〓〓〓〓 テーブル加工機能 〓〓〓〓〓〓

  function processTable(id){
    const table = document.getElementById(id);
    if (!table || !table.tHead) return;
    table.style.margin = '8px 0 24px';
    const colMap = columnIds[id];
    // タイトル挿入
    if (!document.getElementById(titleMap[id])){
      const h3 = document.createElement('h3');
      h3.id = titleMap[id];
      h3.textContent = labelMap[id];
      Object.assign(h3.style,{margin:'0',padding:'0'});
      table.insertAdjacentElement('beforebegin', h3);
    }
    const headerRow = table.tHead.rows[0];
    const hdrs = Array.from(headerRow.cells);
    // テーブルごとにソート関数初期化
    dbeClearSortHistory(id);

    // ヘッダー整形
    hdrs.forEach(th=>{
      th.style.backgroundColor = '#F0F0F0';
      th.style.color           = '#000';
      th.style.cursor          = 'default';
      const cls = colMap[th.textContent.trim()];
      if (cls) th.classList.add(cls);
    });
    const idxMap = {};
    hdrs.forEach((th,i)=>{
      const t = th.textContent.trim();
      if (colMap[t]) idxMap[t] = i;
    });
    
    // 〓〓〓〓〓 名称ヘッダー（武器/防具）に 4段階サイクルソートをワイヤリング 〓〓〓〓〓
    wireNameColumnSort(table, id, idxMap, hdrs, headerRow);

    // 〓〓〓〓〓 「解」列ヘッダークリック：2段階（昇順/降順）＋インジケーターは右固定 〓〓〓〓〓
    const lockIdx = idxMap['解'];
    if (lockIdx != null) {
      const th = hdrs[lockIdx];
      th.style.cursor = 'pointer';

      // ソート状態: true=逆順, false=正順（インジケーターは右固定）
      let lockDesc = true;

      // 共通：マリモ列インデックス
      const mrimIdx = idxMap['マリモ'];
      // テーブル別：ランク／レアリティ列インデックス
      const nameIdx = id === 'necklaceTable'
        ? idxMap['ネックレス']
        : id === 'weaponTable'
        ? idxMap['武器']
        : idxMap['防具'];

      const sortByUnlock = (desc) => {
        const rows = Array.from(table.tBodies[0].rows);
        rows.sort((a,b)=>{
          // 1) 解リンク順
          const aKey = a.cells[lockIdx].hasAttribute('secured') ? 'secured'
                      : a.cells[lockIdx].hasAttribute('released') ? 'released'
                      : null;
          const bKey = b.cells[lockIdx].hasAttribute('secured') ? 'secured'
                      : b.cells[lockIdx].hasAttribute('released') ? 'released'
                      : null;
          const aSec = secrOrder[aKey] ?? 0;
          const bSec = secrOrder[bKey] ?? 0;

          // 2) ランク or レアリティ
          const aRank = id === 'necklaceTable'
            ? (gradeOrder[(a.cells[nameIdx].textContent.match(/Pt|Au|Ag|CuSn|Cu/)||['Cu'])[0]] || 0)
            : (rarityOrder[(dbePickRarityFromText(a.cells[nameIdx].textContent) || 'N')] || 0);
          const bRank = id === 'necklaceTable'
            ? (gradeOrder[(b.cells[nameIdx].textContent.match(/Pt|Au|Ag|CuSn|Cu/)||['Cu'])[0]] || 0)
            : (rarityOrder[(dbePickRarityFromText(b.cells[nameIdx].textContent) || 'N')] || 0);

          // 3) マリモ値
          const aMr = parseInt(a.cells[mrimIdx].textContent.replace(/\D/g,''),10) || 0;
          const bMr = parseInt(b.cells[mrimIdx].textContent.replace(/\D/g,''),10) || 0;

          // 「解→ランク→マリモ」を、全体として昇順/降順の2択に統一
          return desc
            ? ((bSec - aSec) || (bRank - aRank) || (bMr - aMr))
            : ((aSec - bSec) || (aRank - bRank) || (aMr - bMr));
        });

        // 行を再描画
        rows.forEach(r => table.tBodies[0].appendChild(r));

        // インジケーターは右固定
        updateSortIndicator(th, desc ? '⬆' : '⬇', 'right');
      };

      th.addEventListener('click', () => {
        const appliedDesc = lockDesc;
        sortByUnlock(appliedDesc);

        // 「再読込」後の再適用用として履歴に登録（同一列キーは最後の方向だけ残す）
        dbeRememberSort(id, () => sortByUnlock(appliedDesc), 'KAI');

        // 次回クリックは反転
        lockDesc = !lockDesc;
        scrollToAnchorCell();
      });
    }

    // 〓〓〓〓〓 増減列追加＆フィルターUI 〓〓〓〓〓
    if (id==='necklaceTable'){
      // --- 安全な挿入位置の決定（'属性' が見つからない場合は末尾に追加） ---
      const attrIdxByMap = Number.isInteger(idxMap['属性']) ? idxMap['属性'] : -1;
      const attrIdxByText = (() => {
        const hdrCells = Array.from(headerRow.cells);
        return hdrCells.findIndex(th => (th.textContent||'').trim() === '属性');
      })();
      const attrIdx = (attrIdxByMap >= 0 ? attrIdxByMap : (attrIdxByText >= 0 ? attrIdxByText : headerRow.cells.length - 1));
      const pos = Math.max(0, Math.min(headerRow.cells.length, attrIdx + 1));
      // 「装」列（necClm-Equp）インデックスを動的に検出（見つからなければ -1）
      const equpIdx = (() => {
        const hdrCells2 = Array.from(headerRow.cells);
        const idx = hdrCells2.findIndex(th => (th.textContent || '').trim() === '装');
        return (idx >= 0 ? idx : -1);
      })();
      // アイテムIDフィルター用の入力＆チェックボックス（applyFilter から参照するためスコープだけ先に用意）
      let idNum = null;
      let idChk = null;

      // 〓〓〓〓〓 列クラス名（未定義対策のフォールバック） 〓〓〓〓〓
      const deltaColClass = (columnIds && columnIds.necklaceTable && columnIds.necklaceTable['増減']) ? columnIds.necklaceTable['増減'] : 'neckClm-Delta';
      // ①重複防止：既存の「増減」列（ヘッダ/セル）を全て除去してから再構築
      try{
        table.querySelectorAll('th.'+deltaColClass+', td.'+deltaColClass).forEach(el=>el.remove());
      }catch(_){}
      // ②表示設定：OFFなら再構築せずスキップ（lastSortMapもクリア）
      const __showDelta = (typeof readBool==='function') ? readBool('showDelta') : true;
      if (__showDelta) {
      // 増減列ヘッダー
      const dTh = document.createElement('th');
      dTh.classList.add(deltaColClass);
      dTh.textContent='増減';
      Object.assign(dTh.style,{backgroundColor:'#F0F0F0',color:'#000',textAlign:'center',cursor:'pointer'});
      const thRef = headerRow.cells[pos] || null;
      thRef ? headerRow.insertBefore(dTh, thRef) : headerRow.appendChild(dTh);
              // 原則：'use strict' 直下で定義された buffKeywords / debuffKeywords を必ず使う
              const _buff   = Array.isArray(buffKeywords)   ? buffKeywords   : [];
              const _debuff = Array.isArray(debuffKeywords) ? debuffKeywords : [];
      // 各行に計算セル
      Array.from(table.tBodies[0].rows).forEach(row=>{
        const td = document.createElement('td');
        td.classList.add(deltaColClass);
        td.style.textAlign='center';
        const tdRef = row.cells[pos] || null;
        tdRef ? row.insertBefore(td, tdRef) : row.appendChild(td);
        let tot = 0;
        const attrCell = row.cells[attrIdx];
        if (attrCell){
          attrCell.querySelectorAll('li').forEach(li=>{
            const m = (li.textContent||'').trim().match(/(\d+)%\s*(.+)$/);
            if (!m) return;
            const v = +m[1], k = m[2].trim();
            tot += _buff.includes(k) ? v : (_debuff.includes(k) ? -v : 0);
          });
        }
        td.textContent = tot>0? ('△'+tot) : (tot<0? ('▼'+Math.abs(tot)) : '0');
      });

      // 〓〓〓〓〓 ソート（△はプラス、▼はマイナス）＋ インジケーター表示 〓〓〓〓〓
      // ascNum=true：逆順（tot 大→小）、ascNum=false：正順（tot 小→大）
      let ascNum = true;
      // ネックレス「増減」列の最後のソート方向を記憶（true=逆順(⬆), false=正順(⬇)）
      let necklaceLastSortDirection = null;
      const sortByDelta = (useAsc) => {
        const rows = Array.from(table.tBodies[0].rows);
        rows.sort((a, b) => {
          const txtA = (a.cells[pos]?.textContent||'').trim();
          const txtB = (b.cells[pos]?.textContent||'').trim();
          const va = txtA.startsWith('△') ? parseInt(txtA.slice(1),10)
                  : txtA.startsWith('▼') ? -parseInt(txtA.slice(1),10) : 0;
          const vb = txtB.startsWith('△') ? parseInt(txtB.slice(1),10)
                  : txtB.startsWith('▼') ? -parseInt(txtB.slice(1),10) : 0;
          return useAsc ? (vb - va) : (va - vb);
        });
        rows.forEach(r => table.tBodies[0].appendChild(r));
        // インジケーター更新（このヘッダー行内の既存を除去してから付与）
        (headerRow.closest('tr')||headerRow).querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        updateSortIndicator(dTh, useAsc ? '⬆' : '⬇', 'right');
        scrollToAnchorCell();
      };

      dTh.addEventListener('click', () => {
        // 現在のクリックで適用される方向でソートし、記憶
        const appliedDir = ascNum;
        sortByDelta(appliedDir);
        necklaceLastSortDirection = appliedDir;
        // 再適用用（＆多段復元の履歴）として登録
        dbeRememberSort(id, () => sortByDelta(appliedDir), 'DELTA');
        // 次回クリックは反転
        ascNum = !appliedDir;
      });
      } else {
        try{ dbeClearSortHistory(id); }catch(_){}
      }

      // 〓〓〓〓〓 フィルター UI 〓〓〓〓〓
      // 重複ガード：テーブル直前に既存のフィルターUI(.filter-ui / .dbe-necklace-filter)があれば全て掃除
      try{
        let probe = table.previousElementSibling;
        while (probe && probe.classList && (probe.classList.contains('filter-ui') || probe.classList.contains('dbe-necklace-filter'))) {
          const prev = probe.previousElementSibling;
          probe.remove();
          probe = prev;
        }
      }catch(err){
        console.warn('[DBE] cleanup necklace filter-ui failed:', err);
      }
      // ラッパー（この中に「ボタン行」「アイテムIDフィルター行」「チェックボックス行」を縦に配置）
      const wrap = document.createElement('div');
      wrap.className = 'dbe-necklace-filter';
      Object.assign(wrap.style, {
        display:'flex',
        flexDirection:'column',
        gap:'4px',
        alignItems:'flex-start',
        margin:'0px'
      });

      // ボタン行：《全解除》《再読込》
      const rowButtons = document.createElement('div');
      rowButtons.style.display = 'flex';
      rowButtons.style.gap = '8px';
      rowButtons.style.margin = '0px';

      const chks=[];
      async function dbeSoftReloadThisNecklaceTable(btn){
        let oldText = '';
        try{
          if (table.dataset.dbeSoftReloading === '1') return;
          table.dataset.dbeSoftReloading = '1';
          oldText = btn ? btn.textContent : '';
          if (btn){ btn.disabled = true; btn.textContent = '更新中...'; }

          const ok = await dbeSoftReloadTableTbody(id);
          if (!ok) throw new Error('tbody reload failed');

          // 設定（dbe-W-Settings）：「ネックレス、武器、防具の装備種とクラスを隠す」を再適用
          // ※tbody差し替え後は、名称セルの2行目（装備種/クラス）の表示状態が初期状態に戻るため
          try{
            const hide = (typeof readBool === 'function') ? readBool('hideKindClass') : false;
            if (typeof toggleNameSubLine === 'function') toggleNameSubLine(hide);
          }catch(_){}

          // 設定（dbe-W-Settings）：「名称列と装備列の間にアイテムIDを表示する」を再適用
          // ※theadにID列が残っている状態でtbodyを差し替えると、tbody側にIDセルが存在せず列ズレが起きる
          try{
            const showId = (typeof readBool === 'function') ? readBool('displayItemId') : false;
            if (showId){
              ensureItemIdColumn(table, { itemKey:'necClm-ItemID', nameKey:'necClm-Name', equpKey:'necClm-Equp' });
            }
          }catch(_){}

          // 増減列が有効な場合、tbody差し替え後に増減セルを再構築（新規行に追加）
          const __showDeltaNow = (typeof readBool === 'function') ? readBool('showDelta') : true;
          const hasDeltaHeader = !!(table.tHead && table.tHead.rows && table.tHead.rows[0] && table.tHead.rows[0].querySelector('th.'+deltaColClass));
          if (__showDeltaNow && hasDeltaHeader){
            // 念のため：既存の増減セルを除去してから再生成
            try{ table.querySelectorAll('td.'+deltaColClass).forEach(el=>el.remove()); }catch(_){}
            const _buff   = Array.isArray(buffKeywords)   ? buffKeywords   : [];
            const _debuff = Array.isArray(debuffKeywords) ? debuffKeywords : [];
            Array.from(table.tBodies[0].rows).forEach(row=>{
              const td = document.createElement('td');
              td.classList.add(deltaColClass);
              td.style.textAlign='center';
              const tdRef = row.cells[pos] || null;
              tdRef ? row.insertBefore(td, tdRef) : row.appendChild(td);
              let tot = 0;
              const attrCell = row.cells[attrIdx];
              if (attrCell){
                attrCell.querySelectorAll('li').forEach(li=>{
                  const m = (li.textContent||'').trim().match(/(\d+)%\s*(.+)$/);
                  if (!m) return;
                  const v = +m[1], k = m[2].trim();
                  tot += _buff.includes(k) ? v : (_debuff.includes(k) ? -v : 0);
                });
              }
              td.textContent = tot>0? ('△'+tot) : (tot<0? ('▼'+Math.abs(tot)) : '0');
            });
          }

          // フィルター＆（必要なら）最後のソートを再適用
          applyFilter();
          try{ applyCellColors(); }catch(_){}
        }catch(err){
          console.warn('[DBE] soft reload necklaceTable failed:', err);
          location.reload();
        }finally{
          try{ delete table.dataset.dbeSoftReloading; }catch(_){ table.dataset.dbeSoftReloading=''; }
          if (btn){
            btn.disabled = false;
            btn.textContent = oldText || '再読込';
          }
        }
      }

      [['全解除',()=>{ chks.forEach(c=>c.checked=false); if (idChk) idChk.checked=false; applyFilter(); }],
        ['再読込',(ev)=>{ Promise.resolve(dbeSoftReloadThisNecklaceTable(ev && ev.currentTarget)).catch(_=>{}); }]]
        .forEach(([t,fn])=>{
          const b=document.createElement('button');
          b.textContent=t;
          Object.assign(b.style,{fontSize:'0.9em',padding:'4px 8px',margin:'10px'});
          b.addEventListener('click',fn);
          rowButtons.appendChild(b);
        });

      // アイテムIDフィルターの行：《アイテムID：[textbox] 以上を抽出する [checkbox]》
      const rowItemFilter = document.createElement('div');
      Object.assign(rowItemFilter.style, {
        marginTop:'4px',
        display:'flex',
        alignItems:'center',
        gap:'8px',
        flexWrap:'wrap'
      });
      const idLbl1 = document.createElement('span');
      idLbl1.textContent = 'アイテムID：';
      idLbl1.style.fontSize = '1.0em';
      idNum = document.createElement('input');
      idNum.type = 'text';
      idNum.style.width = '10em';
      idNum.style.margin = '0';
      idNum.style.padding = '2px 8px';
      idNum.style.fontSize = '0.9em';
      // デフォルトのしきい値をテキストボックスの初期値として設定
      idNum.value = String(DEFAULT_ITEMIDFILTER_THRESHOLD);
      const idLbl2 = document.createElement('span');
      idLbl2.textContent = '以上を抽出する';
      idChk = document.createElement('input');
      idChk.type = 'checkbox';
      idChk.checked = false;
      // 変更反映
      idChk.addEventListener('change', ()=>{ applyFilter(); });
      idNum.addEventListener('input',  ()=>{ if (idChk && idChk.checked) applyFilter(); });
      rowItemFilter.append(idLbl1, idNum, idLbl2, idChk);

      // チェックボックス行（攻撃の嵐、元素の混沌、破滅の打撃…）
      const sc=document.createElement('div');
      sc.style.display='flex';
      sc.style.flexWrap='wrap';
      sc.style.gap='8px';
      sc.style.margin='4px 0 0 0';
      // ラベル集合：statusMap が未定義なら、テーブルから動的抽出
      const dynamicLabels = (()=> {
        const s=new Set();
        Array.from(table.tBodies[0].rows).forEach(r=>{
          const cell = r.cells[attrIdx];
          if (!cell) return;
          cell.querySelectorAll('li').forEach(li=>{
            const m = (li.textContent||'').trim().match(/(\d+)%\s*(.+)$/);
            if (m) s.add(m[2].trim());
          });
        });
        return Array.from(s);
      })();
      const labels = (typeof statusMap!=='undefined' && statusMap && typeof statusMap==='object')
                    ? Object.keys(statusMap) : dynamicLabels;
      labels.forEach(label=>{
        const lb=document.createElement('label');
        lb.style.fontSize='1.0em';
        const ck=document.createElement('input');
        ck.type='checkbox';
        ck.value=label;
        ck.checked=false;
        ck.addEventListener('change',applyFilter);
        chks.push(ck);
        lb.append(ck,document.createTextNode(' '+label));
        sc.appendChild(lb);
      });

      // ラッパーに「ボタン行」「アイテムID行」「チェックボックス行」を順番に追加して、テーブル直前へ挿入
      wrap.append(rowButtons, rowItemFilter, sc);
      table.insertAdjacentElement('beforebegin', wrap);

      function applyFilter(){
        const act = chks.filter(c=>c.checked).map(c=>c.value);
        // アイテムIDのしきい値（入力値が空 or 数字でない場合はデフォルト値）
        const useIdFilter = !!(idChk && idChk.checked);
        let threshold = DEFAULT_ITEMIDFILTER_THRESHOLD;
        if (useIdFilter && idNum){
          const raw = (idNum.value || '').trim();
          const m = raw.match(/\d+/);
          if (m){
            const v = parseInt(m[0],10);
            if (!Number.isNaN(v)) threshold = v;
          }
        }
        Array.from(table.tBodies[0].rows).forEach(r=>{
          let visible = true;
          // ステータス（属性）フィルター
          if (act.length > 0){
            const txt = (r.cells[attrIdx]?.textContent) || '';
            if (!act.every(a=>txt.includes(a))) visible = false;
          }
          // アイテムIDフィルター（necClm-Equp 列を参照）
          if (visible && useIdFilter && equpIdx >= 0){
            const cell = r.cells[equpIdx] || null;
            const idStr = extractItemIdFromEqupCell(cell);
            if (idStr){
              const val = parseInt(idStr,10);
              if (!Number.isNaN(val) && val < threshold){
                visible = false;
              }
            }
          }
          r.style.display = visible ? '' : 'none';
        });
      }
      applyFilter();
        // フィルター後：保存済みのソート履歴（多段）を再適用
      dbeApplySortHistory(id);
      scrollToAnchorCell();
    }

// 〓〓〓〓〓 weaponTable 固有 〓〓〓〓〓

    // --- 武器固有：ATK列多段ソート＋インジケーター ---
    if (id === 'weaponTable') {
      const atkIdx = idxMap['ATK'];
      const mrimIdx = idxMap['マリモ'];
      const atkTh = headerRow.cells[atkIdx];
      // ATK列ソート用の状態を管理（4段階）
      let atkState = 0;
      atkTh.style.cursor = 'pointer';
      const sortByAtk = (state) => {
        const rows = Array.from(table.tBodies[0].rows);
        // 既存のインジケーターを全列から削除
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        switch (state) {
          // (1) 最高ATK値による逆順
          case 0:
            rows.sort((a, b) =>
              parseInt(b.cells[atkIdx].textContent.split('~')[1]) - parseInt(a.cells[atkIdx].textContent.split('~')[1]) ||
              parseInt(b.cells[atkIdx].textContent.split('~')[0]) - parseInt(a.cells[atkIdx].textContent.split('~')[0]) ||
              parseInt(b.cells[mrimIdx].textContent) - parseInt(a.cells[mrimIdx].textContent)
            );
            updateSortIndicator(atkTh, '⬆', 'right');
            break;
          // (2) 最高ATK値による正順
          case 1:
            rows.sort((a, b) =>
              parseInt(a.cells[atkIdx].textContent.split('~')[1]) - parseInt(b.cells[atkIdx].textContent.split('~')[1]) ||
              parseInt(a.cells[atkIdx].textContent.split('~')[0]) - parseInt(b.cells[atkIdx].textContent.split('~')[0]) ||
              parseInt(a.cells[mrimIdx].textContent) - parseInt(b.cells[mrimIdx].textContent)
            );
            updateSortIndicator(atkTh, '⬇', 'right');
            break;
          // (3) 最低ATK値による逆順
          case 2:
            rows.sort((a, b) =>
              parseInt(b.cells[atkIdx].textContent.split('~')[0]) - parseInt(a.cells[atkIdx].textContent.split('~')[0]) ||
              parseInt(b.cells[atkIdx].textContent.split('~')[1]) - parseInt(a.cells[atkIdx].textContent.split('~')[1]) ||
              parseInt(b.cells[mrimIdx].textContent) - parseInt(a.cells[mrimIdx].textContent)
            );
            updateSortIndicator(atkTh, '⬆', 'left');
            break;
          // (4) 最低ATK値による正順
          case 3:
            rows.sort((a, b) =>
              parseInt(a.cells[atkIdx].textContent.split('~')[0]) - parseInt(b.cells[atkIdx].textContent.split('~')[0]) ||
              parseInt(a.cells[atkIdx].textContent.split('~')[1]) - parseInt(b.cells[atkIdx].textContent.split('~')[1]) ||
              parseInt(a.cells[mrimIdx].textContent) - parseInt(b.cells[mrimIdx].textContent)
            );
            updateSortIndicator(atkTh, '⬇', 'left');
            break;
        }
        rows.forEach(r => table.tBodies[0].appendChild(r));
      };

      atkTh.addEventListener('click', () => {
        const appliedState = atkState;
        sortByAtk(appliedState);

        // フィルター／再読込後の再適用用として lastSortMap に登録
        dbeRememberSort(id, () => sortByAtk(appliedState), 'ATK');

        atkState = (atkState + 1) % 4;
        scrollToAnchorCell();
      });
    }

  // 〓〓〓〓〓 武器固有：SPD列（単独ソート）＋インジケーター 〓〓〓〓〓
    if (id === 'weaponTable') {
      const spdIdx   = idxMap['SPD'];
      const spdTh    = headerRow.cells[spdIdx];

      // ソート状態: true=逆順(大→小), false=正順(小→大)
      let spdDesc = true;
      spdTh.style.cursor = 'pointer';

      const sortBySpd = (desc) => {
        const rows = Array.from(table.tBodies[0].rows);
        rows.sort((a, b) => {
          const aSpd = parseInt((a.cells[spdIdx]?.textContent || '').trim(), 10) || 0;
          const bSpd = parseInt((b.cells[spdIdx]?.textContent || '').trim(), 10) || 0;
          return desc ? (bSpd - aSpd) : (aSpd - bSpd);
        });
        rows.forEach(r => table.tBodies[0].appendChild(r));
        updateSortIndicator(spdTh, desc ? '⬆' : '⬇', 'right');
      };

      spdTh.addEventListener('click', () => {
        // 既存のインジケーターを全体から削除
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());

        // ソート実行（SPDのみ）
        const appliedDesc = spdDesc;
        sortBySpd(appliedDesc);

        // 再適用用として lastSortMap に登録
        dbeRememberSort(id, () => sortBySpd(appliedDesc), 'SPD');

        // 次回クリックは反転
        spdDesc = !spdDesc;
        scrollToAnchorCell();
      });
    }

    // 〓〓〓〓〓 武器固有：CRIT列（単独ソート）＋インジケーター 〓〓〓〓〓
    if (id === 'weaponTable') {
      const critIdx  = idxMap['CRIT'];
      const critTh   = headerRow.cells[critIdx];

      // ソート状態: true=逆順(大→小), false=正順(小→大)
      let critDesc = true;
      critTh.style.cursor = 'pointer';

      const sortByCrit = (desc) => {
        const rows = Array.from(table.tBodies[0].rows);
        rows.sort((a, b) => {
          const aCrit = parseInt((a.cells[critIdx]?.textContent || '').replace(/\D/g, ''), 10) || 0;
          const bCrit = parseInt((b.cells[critIdx]?.textContent || '').replace(/\D/g, ''), 10) || 0;
          return desc ? (bCrit - aCrit) : (aCrit - bCrit);
        });
        rows.forEach(r => table.tBodies[0].appendChild(r));
        updateSortIndicator(critTh, desc ? '⬆' : '⬇', 'right');
      };

      critTh.addEventListener('click', () => {
        // 既存のインジケーターを全体から削除
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());

        // ソート実行（CRITのみ）
        const appliedDesc = critDesc;
        sortByCrit(appliedDesc);

        // フィルター後の再適用用として lastSortMap に登録
        dbeRememberSort(id, () => sortByCrit(appliedDesc), 'CRIT');

        // 次回クリックは反転
        critDesc = !critDesc;
        scrollToAnchorCell();
      });
    }

    // 〓〓〓〓〓 武器固有：MOD列（単独ソート）＋インジケーター 〓〓〓〓〓
    if (id === 'weaponTable') {
      const modIdx  = idxMap['MOD'];
      const modTh   = headerRow.cells[modIdx];

      // ソート状態: true=逆順(大→小), false=正順(小→大)
      let modDesc = true;
      modTh.style.cursor = 'pointer';

      const sortByMod = (desc) => {
        const rows = Array.from(table.tBodies[0].rows);
        rows.sort((a, b) => {
          const aMod = parseInt((a.cells[modIdx]?.textContent || '').replace(/\D/g, ''), 10) || 0;
          const bMod = parseInt((b.cells[modIdx]?.textContent || '').replace(/\D/g, ''), 10) || 0;
          return desc ? (bMod - aMod) : (aMod - bMod);
        });
        rows.forEach(r => table.tBodies[0].appendChild(r));
        updateSortIndicator(modTh, desc ? '⬆' : '⬇', 'right');
      };

      modTh.addEventListener('click', () => {
        // 既存のインジケーターを全体から削除
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());

        // ソート実行（MODのみ）
        const appliedDesc = modDesc;
        sortByMod(appliedDesc);

        // フィルター後の再適用用として lastSortMap に登録
        ByMod(appliedDesc);

        // 次回クリックは反転
        modDesc = !modDesc;
        scrollToAnchorCell();
      });
    }

    // 〓〓〓〓〓 武器固有：マリモ列ソート＋インジケーター 〓〓〓〓〓
    if (id === 'weaponTable') {
      const rrimIdx = idxMap['マリモ'];
      const rrimTh  = headerRow.cells[rrimIdx];
      // マリモ列ソート用フラグ
      let rrimDesc = true;
      rrimTh.style.cursor = 'pointer';
      const sortByRrim = (desc) => {
        const rows = Array.from(table.tBodies[0].rows);
        // 既存の矢印をクリア
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        // 数値を抜き出してソート
        rows.sort((a, b) => {
          const aVal = parseInt(a.cells[rrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          const bVal = parseInt(b.cells[rrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          return desc ? bVal - aVal : aVal - bVal;
        });
        rows.forEach(r => table.tBodies[0].appendChild(r));
        // 矢印表示：右隣に⬆／⬇
        updateSortIndicator(rrimTh, desc ? '⬆' : '⬇', 'right');
      };

      rrimTh.addEventListener('click', () => {
        const appliedDesc = rrimDesc;
        sortByRrim(appliedDesc);

        // フィルター／再読込後の再適用用として lastSortMap に登録
        dbeRememberSort(id, () => sortByRrim(appliedDesc), 'MRIM');

        rrimDesc = !rrimDesc;
        scrollToAnchorCell();
      });
    }

    // 〓〓〓〓〓 防具固有：DEF列多段ソート＋インジケーター 〓〓〓〓〓
    if (id === 'armorTable') {
      const defIdx = idxMap['DEF'];
      const mrimIdx = idxMap['マリモ'];
      const defTh = headerRow.cells[defIdx];
      // DEF列ソート用の状態を管理（4段階）
      let defState = 0;
      defTh.style.cursor = 'pointer';
      const sortByDef = (state) => {
        const rows = Array.from(table.tBodies[0].rows);
        // 既存のインジケーターを全列から削除
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        switch (state) {
          // (1) 最高DEF値による逆順
          case 0:
            rows.sort((a, b) =>
              parseInt(b.cells[defIdx].textContent.split('~')[1]) - parseInt(a.cells[defIdx].textContent.split('~')[1]) ||
              parseInt(b.cells[defIdx].textContent.split('~')[0]) - parseInt(a.cells[defIdx].textContent.split('~')[0]) ||
              parseInt(b.cells[mrimIdx].textContent) - parseInt(a.cells[mrimIdx].textContent)
            );
            updateSortIndicator(defTh, '⬆', 'right');
            break;
          // (2) 最高DEF値による正順
          case 1:
            rows.sort((a, b) =>
              parseInt(a.cells[defIdx].textContent.split('~')[1]) - parseInt(b.cells[defIdx].textContent.split('~')[1]) ||
              parseInt(a.cells[defIdx].textContent.split('~')[0]) - parseInt(b.cells[defIdx].textContent.split('~')[0]) ||
              parseInt(a.cells[mrimIdx].textContent) - parseInt(b.cells[mrimIdx].textContent)
            );
            updateSortIndicator(defTh, '⬇', 'right');
            break;
          // (3) 最低DEF値による逆順
          case 2:
            rows.sort((a, b) =>
              parseInt(b.cells[defIdx].textContent.split('~')[0]) - parseInt(a.cells[defIdx].textContent.split('~')[0]) ||
              parseInt(b.cells[defIdx].textContent.split('~')[1]) - parseInt(a.cells[defIdx].textContent.split('~')[1]) ||
              parseInt(b.cells[mrimIdx].textContent) - parseInt(a.cells[mrimIdx].textContent)
            );
            updateSortIndicator(defTh, '⬆', 'left');
            break;
          // (4) 最低DEF値による正順
          case 3:
            rows.sort((a, b) =>
              parseInt(a.cells[defIdx].textContent.split('~')[0]) - parseInt(b.cells[defIdx].textContent.split('~')[0]) ||
              parseInt(a.cells[defIdx].textContent.split('~')[1]) - parseInt(b.cells[defIdx].textContent.split('~')[1]) ||
              parseInt(a.cells[mrimIdx].textContent) - parseInt(b.cells[mrimIdx].textContent)
            );
            updateSortIndicator(defTh, '⬇', 'left');
            break;
        }
        rows.forEach(r => table.tBodies[0].appendChild(r));
      };

      defTh.addEventListener('click', () => {
        const appliedState = defState;
        sortByDef(appliedState);

        // フィルター／再読込後の再適用用として lastSortMap に登録
        dbeRememberSort(id, () => sortByDef(appliedState), 'DEF');

        defState = (defState + 1) % 4;
        scrollToAnchorCell();
      });
    }

    // 〓〓〓〓〓 防具固有：WT列（単独ソート）＋インジケーター 〓〓〓〓〓
    if (id === 'armorTable') {
      const wgtIdx  = idxMap['WT.'];
      const wgtTh   = headerRow.cells[wgtIdx];

      // ソート状態: true=逆順(大→小), false=正順(小→大)
      let wgtDesc = true;
      wgtTh.style.cursor = 'pointer';

      const sortByWt = (desc) => {
        const rows = Array.from(table.tBodies[0].rows);
        rows.sort((a, b) => {
          const aW = parseFloat((a.cells[wgtIdx]?.textContent || '').trim()) || 0;
          const bW = parseFloat((b.cells[wgtIdx]?.textContent || '').trim()) || 0;
          return desc ? (bW - aW) : (aW - bW);
        });
        rows.forEach(r => table.tBodies[0].appendChild(r));
        updateSortIndicator(wgtTh, desc ? '⬆' : '⬇', 'right');
      };

      wgtTh.addEventListener('click', () => {
        // 既存のインジケーターをクリア
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());

        // ソート実行（WTのみ）
        const appliedDesc = wgtDesc;
        sortByWt(appliedDesc);

        // フィルター後の再適用用として lastSortMap に登録
        dbeRememberSort(id, () => sortByWt(appliedDesc), 'WT');

        // 次回クリックは反転
        wgtDesc = !wgtDesc;
        scrollToAnchorCell();
      });
    }

    // 〓〓〓〓〓 防具固有：CRIT列（単独ソート）＋インジケーター 〓〓〓〓〓
    if (id === 'armorTable') {
      const critIdx  = idxMap['CRIT'];
      const critTh   = headerRow.cells[critIdx];

      // ソート状態: true=逆順(大→小), false=正順(小→大)
      let critDesc = true;
      critTh.style.cursor = 'pointer';

      const sortByCrit = (desc) => {
        const rows = Array.from(table.tBodies[0].rows);
        rows.sort((a, b) => {
          const aCrit = parseInt((a.cells[critIdx]?.textContent || '').replace(/\D/g, ''), 10) || 0;
          const bCrit = parseInt((b.cells[critIdx]?.textContent || '').replace(/\D/g, ''), 10) || 0;
          return desc ? (bCrit - aCrit) : (aCrit - bCrit);
        });
        rows.forEach(r => table.tBodies[0].appendChild(r));
        updateSortIndicator(critTh, desc ? '⬆' : '⬇', 'right');
      };

      critTh.addEventListener('click', () => {
        // 既存のインジケーターをクリア
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());

        // ソート実行（CRITのみ）
        const appliedDesc = critDesc;
        sortByCrit(appliedDesc);

        // フィルター後の再適用用として lastSortMap に登録
        dbeRememberSort(id, () => sortByCrit(appliedDesc), 'CRIT');

        // 次回クリックは反転
        critDesc = !critDesc;
        scrollToAnchorCell();
      });
    }

    // 〓〓〓〓〓 防具固有：MOD列（単独ソート）＋インジケーター 〓〓〓〓〓
    if (id === 'armorTable') {
      const modIdx  = idxMap['MOD'];
      const modTh   = headerRow.cells[modIdx];

      // ソート状態: true=逆順(大→小), false=正順(小→大)
      let modDesc = true;
      modTh.style.cursor = 'pointer';

      const sortByMod = (desc) => {
        const rows = Array.from(table.tBodies[0].rows);
        rows.sort((a, b) => {
          const aMod = parseInt((a.cells[modIdx]?.textContent || '').replace(/\D/g, ''), 10) || 0;
          const bMod = parseInt((b.cells[modIdx]?.textContent || '').replace(/\D/g, ''), 10) || 0;
          return desc ? (bMod - aMod) : (aMod - bMod);
        });
        rows.forEach(r => table.tBodies[0].appendChild(r));
        updateSortIndicator(modTh, desc ? '⬆' : '⬇', 'right');
      };

      modTh.addEventListener('click', () => {
        // 既存のインジケーターを全体から削除
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());

        // ソート実行（MODのみ）
        const appliedDesc = modDesc;
        sortByMod(appliedDesc);

        // フィルター後の再適用用として lastSortMap に登録
        dbeRememberSort(id, () => sortByMod(appliedDesc), 'MOD');

        // 次回クリックは反転
        modDesc = !modDesc;
        scrollToAnchorCell();
      });
    }

    // 〓〓〓〓〓 防具固有：マリモ列ソート＋インジケーター 〓〓〓〓〓
    if (id === 'armorTable') {
      const mrimTh  = headerRow.querySelector('th.amrClm-Mrim');
      const mrimIdx = Array.prototype.indexOf.call(headerRow.cells, mrimTh);
      // マリモ列ソート用フラグ
      let mrimDesc = true;
      mrimTh.style.cursor = 'pointer';
      const sortByMrim = (desc) => {
        const rows = Array.from(table.tBodies[0].rows);
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        rows.sort((a, b) => {
          const aVal = parseInt(a.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          const bVal = parseInt(b.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          return desc ? bVal - aVal : aVal - bVal;
        });
        rows.forEach(r => table.tBodies[0].appendChild(r));
        updateSortIndicator(mrimTh, desc ? '⬆' : '⬇', 'right');
      };

      mrimTh.addEventListener('click', () => {
        const appliedDesc = mrimDesc;
        sortByMrim(appliedDesc);

        // フィルター／再読込後の再適用用として lastSortMap に登録
        dbeRememberSort(id, () => sortByMrim(appliedDesc), 'MRIM');

        mrimDesc = !mrimDesc;
        scrollToAnchorCell();
      });
    }
  }

  // 〓〓〓〓〓 weaponTable ＋ armorTable 固有 〓〓〓〓〓
  function wireNameColumnSort(table, id, idxMap, hdrs, headerRow){
    // ネックレス表は除外（個別名なし・別ロジックのため）
    if (id === 'necklaceTable') {
      return; // 既存のネックレス側ロジックに委ねる
    }

    // 武器・防具固有：レアリティ／属性フィルターUI（＋アイテムIDフィルター）
    if (id==='weaponTable'||id==='armorTable') {
      // 既存のフィルターUIが直前にある場合は再利用（中身だけ差し替え）
      let ui = table.previousElementSibling;
      if (ui && ui.classList && ui.classList.contains('filter-ui')) {
        ui.innerHTML = '';
      } else {
        ui = document.createElement('div');
        ui.className='filter-ui';
        ui.style.margin='0px';
        table.insertAdjacentElement('beforebegin',ui);
      }

      async function dbeSoftReloadThisWeaponArmorTable(btn){
        let oldText = '';
        try{
          if (table.dataset.dbeSoftReloading === '1') return;
          table.dataset.dbeSoftReloading = '1';
          oldText = btn ? btn.textContent : '';
          if (btn){ btn.disabled = true; btn.textContent = '更新中...'; }

          const ok = await dbeSoftReloadTableTbody(id);
          if (!ok) throw new Error('tbody reload failed');

          // 設定（dbe-W-Settings）：「ネックレス、武器、防具の装備種とクラスを隠す」を再適用
          // ※tbody差し替え後は、名称セルの2行目（装備種/クラス）の表示状態が初期状態に戻るため
          try{
            const hide = (typeof readBool === 'function') ? readBool('hideKindClass') : false;
            if (typeof toggleNameSubLine === 'function') toggleNameSubLine(hide);
          }catch(_){}

          // 設定（dbe-W-Settings）：「名称列と装備列の間にアイテムIDを表示する」を再適用
          // ※theadにID列が残っている状態でtbodyを差し替えると、tbody側にIDセルが存在せず列ズレが起きる
          try{
            const showId = (typeof readBool === 'function') ? readBool('displayItemId') : false;
            if (showId){
              const t =
                (id === 'weaponTable') ? { itemKey:'wepClm-ItemID', nameKey:'wepClm-Name', equpKey:'wepClm-Equp' } :
                (id === 'armorTable')  ? { itemKey:'amrClm-ItemID', nameKey:'amrClm-Name', equpKey:'amrClm-Equp' } :
                null;
              if (t) ensureItemIdColumn(table, t);
            }
          }catch(_){}

          // フィルター＆最後のソートを維持したまま再適用
          applyFilter();
          try{ applyColor(); }catch(_){}
          try{ applyCellColors(); }catch(_){}
        }catch(err){
          console.warn('[DBE] soft reload '+id+' failed:', err);
          location.reload();
        }finally{
          try{ delete table.dataset.dbeSoftReloading; }catch(_){ table.dataset.dbeSoftReloading=''; }
          if (btn){
            btn.disabled = false;
            btn.textContent = oldText || '再読込';
          }
        }
      }

      const r2=document.createElement('div');
      r2.style.marginTop='4px';
      [['全解除',()=>{setAll(false);try{delete table.dataset.dbeNamePick;}catch(_){table.dataset.dbeNamePick='';}applyFilter();applyColor();}],
        ['再読込',(ev)=>{ Promise.resolve(dbeSoftReloadThisWeaponArmorTable(ev && ev.currentTarget)).catch(_=>{}); }]].forEach(([txt,fn])=>{
        const b=document.createElement('button');
        b.textContent=txt;
        Object.assign(b.style,{fontSize:'0.9em',padding:'4px 8px',margin:'10px'});
        b.addEventListener('click',fn);
        r2.appendChild(b);
      });
      ui.appendChild(r2);

      // 〓〓〓〓〓 アイテムIDフィルターの行（《「全解除」「再読込」》と《Rarity》の間に挿入）〓〓〓〓〓
      const r2_5 = document.createElement('div');
      Object.assign(r2_5.style, { marginTop:'4px', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' });
      const idLbl1 = document.createElement('span'); idLbl1.textContent = 'アイテムID：'; idLbl1.style.fontSize = '1.1em';
      const idNum  = document.createElement('input');
      idNum.type = 'text';                                   // ← number から text に変更
      idNum.id   = 'dbe-filterui-itemidfilter-threshold';
      idNum.value = String(DEFAULT_ITEMIDFILTER_THRESHOLD);
      idNum.style.width = '10em';
      idNum.style.margin = '0';
      idNum.style.padding = '2px 8px';                       // ← 指定の内側余白
      idNum.style.fontSize = '0.9em';
      const idLbl2 = document.createElement('span'); idLbl2.textContent = '以上を抽出する';
      const idChk  = document.createElement('input'); idChk.type = 'checkbox'; idChk.checked = false;
      // 変更反映
      idChk.addEventListener('change', ()=>{ applyFilter(); });
      idNum.addEventListener('input',  ()=>{ if(idChk.checked) applyFilter(); });
      r2_5.append(idLbl1, idNum, idLbl2, idChk);
      ui.appendChild(r2_5);

      const r3=document.createElement('div');
      Object.assign(r3.style,{marginTop:'6px',display:'flex',alignItems:'center'});
      const s3=document.createElement('span'); s3.textContent='Rarity：'; s3.style.fontSize='1.2em';
      r3.appendChild(s3);
      const elm={};
      ['UR','SSR','SR','R','N'].forEach(rk=>{
        const lbl=document.createElement('label');
        lbl.style.margin='0 4px';
        const chk=document.createElement('input');
        chk.type='checkbox';
        chk.checked=false;
        chk.addEventListener('change',applyFilter);
        elm[rk]=chk;
        lbl.append(chk,document.createTextNode(' '+rk));
        r3.appendChild(lbl);
      });
      ui.appendChild(r3);

      const r4=document.createElement('div');
      Object.assign(r4.style,{marginTop:'6px',display:'flex',alignItems:'center'});
      const s4=document.createElement('span'); s4.textContent='Element：'; s4.style.fontSize='1.2em';
      r4.appendChild(s4);
      const rarObj={};
      Object.keys(elemColors).forEach(a=>{
        const lbl=document.createElement('label');
        lbl.style.margin='0 4px';
        const chk=document.createElement('input');
        chk.type='checkbox';
        chk.checked=false;
        chk.addEventListener('change',()=>{applyFilter();applyColor();});
        rarObj[a]=chk;
        lbl.append(chk,document.createTextNode(' '+a));
        r4.appendChild(lbl);
      });
      ui.appendChild(r4);

      const elemCol = idxMap['ELEM'];
      // 以降の 6段階サイクルやメタ抽出で参照する名称列タイトルを明示
      const nameTitle = (id === 'weaponTable') ? '武器' : '防具';
      // 名称セル（レアリティ表記を内包するセル）の列インデックス
      const nameCol   = idxMap[nameTitle];
      const mrimCol   = idxMap['マリモ'];
      let ascMulti = true;

      // 〓〓〓〓〓 名称列セルクリック：同名装備の抽出（weaponTable / armorTable） 〓〓〓〓〓
      // table.dataset.dbeNamePick に「抽出対象のアイテム名」を保持（同名を再クリックで解除）
      function dbeGetPureNameFromNameCell(td){
        try{
          const parsed = (typeof dbeParseNameTd === 'function') ? dbeParseNameTd(td) : null;
          const nm = (parsed && parsed.name != null) ? String(parsed.name).trim() : '';
          if (nm) return nm;
        }catch(_){}
        const txt = (td && td.textContent) ? String(td.textContent).trim() : '';
        if (!txt) return '';
        return txt.split('\n')[0].split('【')[0].trim();
      }

      function setAll(v){ Object.values(elm).forEach(x=>x.checked=v); Object.values(rarObj).forEach(x=>x.checked=v); }
      function applyColor(){ Array.from(table.tBodies[0].rows).forEach(r=>{ const v=r.cells[elemCol].textContent.replace(/[0-9]/g,'').trim()||'なし'; r.cells[elemCol].style.backgroundColor=elemColors[v]; }); }
      function applyFilter(){
        const selectedRarities = Object.keys(elm).filter(rk=>elm[rk].checked);
        const selectedElements = Object.keys(rarObj).filter(el=>rarObj[el].checked);
        const pickedName = (table.dataset.dbeNamePick || '').trim();
        // アイテムIDしきい値の取得（チェックON時のみ使用）
        // 仕様：weaponTable -> necClm-Equp 列、armorTable -> amrClm-Equp 列を参照
        // 実装：実セルから /equip/NNNNNN のリンクを直接抽出（列名変化に強い）
        const useIdFilter = !!idChk.checked;
        // UI から取得（見つからない場合は共通定義のデフォルトを使用）
        const uiInput = document.getElementById('dbe-filterui-itemidfilter-threshold');
        const rawIdInput = (uiInput?.value ?? '');
        // テキストボックスでも安定動作：先頭の数値列を抽出してパース（見つからない場合はデフォルト値）
        const idThreshold = (useIdFilter
          ? (parseInt((rawIdInput.match(/\d+/) || [''])[0], 10) || DEFAULT_ITEMIDFILTER_THRESHOLD)
          : null);

        Array.from(table.tBodies[0].rows).forEach(row=>{
          // 名称セルからレアリティを抽出
          const rt = dbePickRarityFromText(row.cells[nameCol].textContent) || 'N';
          const el = (row.cells[elemCol].textContent.replace(/[0-9]/g,'').trim()||'なし');
          const okR = selectedRarities.length === 0 || selectedRarities.includes(rt);
          const okE = selectedElements.length === 0 || selectedElements.includes(el);
          let okN = true;
          if (pickedName){
            const rowName = dbeGetPureNameFromNameCell(row.cells[nameCol]);
            okN = (rowName === pickedName);
          }

          // アイテムIDフィルター：チェックON時のみ評価
          let okId = true;
          if (useIdFilter) {
            // 行内の equip リンクから数値IDを抽出（例：/equip/69366417）
            const equipA = row.querySelector('a[href*="/equip/"]');
            const href = equipA?.getAttribute('href') || '';
            const m = href.match(/\/equip\/(\d+)/);
            const itemId = m ? parseInt(m[1], 10) : NaN;
            // 数値化できない場合は「通す」、数値化できた場合のみしきい値と比較
            okId = Number.isNaN(itemId) ? true : (itemId >= idThreshold);
          }

          row.style.display = (okR && okE && okId && okN) ? '' : 'none';
        });

        applyColor();
        // フィルター後：保存済みのソート履歴（多段）を再適用
        dbeApplySortHistory(id);
        scrollToAnchorCell();
      }

      // 〓〓〓〓〓 名称列セルクリックで「同名のみ表示」フィルターを切替 〓〓〓〓〓
      // （weaponTable / armorTable）既存の名称セルクリック処理は廃止し、ここで一元的に扱う
      if (!table.dataset.dbeNamePickWired){
        table.dataset.dbeNamePickWired = '1';
        // 見た目（クリック可能）
        try{
          Array.from(table.tBodies[0].rows).forEach(r=>{
            const c = r.cells[nameCol];
            if (c) c.style.cursor = 'pointer';
          });
        }catch(_){}
        table.addEventListener('click', (ev)=>{
          try{
            const a = ev.target.closest && ev.target.closest('a[href]');
            if (a) return; // リンク操作は邪魔しない
            const td = ev.target.closest && ev.target.closest('td');
            if (!td) return;
            const tr = td.closest && td.closest('tr');
            if (!tr || !table.tBodies || !table.tBodies[0] || tr.parentElement !== table.tBodies[0]) return;
            const idx = Array.prototype.indexOf.call(tr.cells, td);
            if (idx !== nameCol) return;
            ev.preventDefault(); ev.stopPropagation();
            recordClickedCell(td, table);
            const picked = dbeGetPureNameFromNameCell(td);
            if (!picked) return;
            if ((table.dataset.dbeNamePick || '') === picked){
              try{ delete table.dataset.dbeNamePick; }catch(_){ table.dataset.dbeNamePick=''; }
            } else {
              table.dataset.dbeNamePick = picked;
            }
            applyFilter();
          }catch(_){}
        }, {passive:false});
      }

      // ELEM列：Element（火/氷/雷/風/地/水/光/闇/なし）→ 数値（大→小）でソート
      // ※Element「なし」は直前の並び（直前ソート結果）を維持（相対順序を変えない）
      // ※クリックの昇順/逆順は「Element順のみ」を反転し、数値順（大→小）は固定
      function sortByElemHeader(ascElemOrder){
        const rows = Array.from(table.tBodies[0].rows).filter(r=>r.style.display!=='none');

        // 「なし」の相対順序を確実に維持するため、現在表示順を退避（安定ソート用）
        const prevIndex = new Map();
        rows.forEach((r,i)=>prevIndex.set(r,i));

        // Element順（昇順の基準）
        const elemSeq = ['火','氷','雷','風','地','水','光','闇','なし'];
        const rankOf = (elem)=>{
          const k = elemSeq.indexOf(elem);
          return (k >= 0) ? k : elemSeq.length;
        };

        // ELEMセルから {elem, num} を抽出
        function parseElemCellText(text){
          const t = (text || '').trim();
          if (!t || t === 'なし') return { elem:'なし', num:null };

          // 例: "25風" / "54氷"
          let m = t.match(/^\s*(\d+)\s*([火氷雷風地水光闇])\s*$/);
          if (m) return { elem:m[2], num:(parseInt(m[1],10) || 0) };

          // 念のためのフォールバック（数字＋属性がどこかに含まれている場合）
          m = t.match(/(\d+)\s*([火氷雷風地水光闇])/);
          if (m) return { elem:m[2], num:(parseInt(m[1],10) || 0) };

          // 属性だけが入っている場合は数値0扱い（通常は来ない想定）
          m = t.match(/([火氷雷風地水光闇])/);
          if (m) return { elem:m[1], num:0 };

          return { elem:'なし', num:null };
        }

        rows.sort((a,b)=>{
          const A = parseElemCellText(a.cells[elemCol]?.textContent);
          const B = parseElemCellText(b.cells[elemCol]?.textContent);

          // (1) Element順（クリックで昇順/逆順）
          const ra = rankOf(A.elem);
          const rb = rankOf(B.elem);
          let d = ascElemOrder ? (ra - rb) : (rb - ra);
          if (d) return d;

          // (2) 同Element内：数値 大→小（固定）
          // ただし Element「なし」は直前の並びを維持（＝相対順序を変えない）
          if (A.elem === 'なし') {
            return (prevIndex.get(a) ?? 0) - (prevIndex.get(b) ?? 0);
          }

          const na = (A.num == null) ? 0 : A.num;
          const nb = (B.num == null) ? 0 : B.num;
          d = (nb - na);
          if (d) return d;

          // 仕上げ：同値は直前の並びで安定化
          return (prevIndex.get(a) ?? 0) - (prevIndex.get(b) ?? 0);
        });

        rows.forEach(r=>table.tBodies[0].appendChild(r));
      }

      // ELEM列ヘッダークリック時はフィルターではなく ELEM 専用ソートのみ実行
      // ELEM列ソート用の状態を管理
      let elemState = 0; // 0=昇順, 1=降順
      hdrs[elemCol].style.cursor = 'pointer';
      hdrs[elemCol].addEventListener('click', () => {
        // 既存のインジケーターを全列から削除
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        // ソート実行
        const appliedState = elemState;
        sortByElemHeader(appliedState === 0);
        // インジケーター更新
        updateSortIndicator(hdrs[elemCol], appliedState === 0 ? '⬆' : '⬇', 'right');
        // ソート状態を保存
        const lastState = appliedState;
        dbeRememberSort(id, () => {
          sortByElemHeader(lastState === 0);
          updateSortIndicator(hdrs[elemCol], lastState === 0 ? '⬆' : '⬇', 'right');
          applyColor(); scrollToAnchorCell();
        }, 'ELEM');
        elemState = elemState === 0 ? 1 : 0;
        applyColor();
        scrollToAnchorCell();
      });

      // --- ELEM列セルクリックによるフィルター→ソート→スクロール ---
      Array.from(table.tBodies[0].rows).forEach(row=>{
        const cell = row.cells[elemCol];
        cell.style.cursor = 'pointer';
        cell.addEventListener('click',()=>{
          // クリックしたセルを記憶
          recordClickedCell(cell, table);
          // クリックしたセルから「火,氷…なし」を抽出
          const clicked = (cell.textContent.match(/[^\d]+$/)||['なし'])[0];
          // 対応するチェックボックスだけONに
          Object.keys(rarObj).forEach(el=> rarObj[el].checked = (el === clicked));
          // フィルタ・色・ソート・スクロール
        applyFilter();
        applyColor();
        scrollToAnchorCell();
        });
      });

      // 〓〓〓〓〓〓 4 段階サイクル（①〜④）【リニューアル版】 〓〓〓〓〓〓
      // 対象：weaponTable の wepClm-Name / armorTable の amrClm-Name
      // 名称・Rarity・Marimo・限定（未知/既知）・カナを用いた多段ソート

      const nameThOrig  = hdrs[idxMap[nameTitle]];
      const nameTh      = nameThOrig.cloneNode(true);
      nameThOrig.parentNode.replaceChild(nameTh, nameThOrig);
      nameTh.style.cursor = 'pointer';
      if (!table.dataset.nameSortPhase) table.dataset.nameSortPhase = '0';            // 次に実行する段階（0..3）
      if (!table.dataset.nameSortLastApplied) table.dataset.nameSortLastApplied = ''; // 直近適用の記憶

      // ヘッダー行・セルを都度取り直し（差し替えや再描画に強い）
      function getHeaderRowNow(){
        const th = (table.tHead && table.tHead.rows && table.tHead.rows[0] && table.tHead.rows[0].cells[idxMap[nameTitle]]) || nameTh;
        return (th && th.closest) ? th.closest('tr') : (table.tHead && table.tHead.rows && table.tHead.rows[0]) || headerRow;
      }
      function getNameThNow(){
        return (table.tHead && table.tHead.rows && table.tHead.rows[0] && table.tHead.rows[0].cells[idxMap[nameTitle]]) || nameTh;
      }

      // 各種レジストリ
      const metaCache  = new WeakMap();
      const kanaDict   = (id === 'weaponTable') ? weaponKana   : armorKana;    // Map<Name, Kana>
      const limitedSet = (id === 'weaponTable') ? limitedWeapon: limitedArmor; // Set<Name>
      const keyMap     = (id === 'weaponTable') ? weaponKeyToName : armorKeyToName; // Map<Key, CanonicalName>

      // 既知限定の判定（表示名 or 正規化キー→正規名）
      function isKnownLimited(name){
        if (limitedSet.has(name)) return true;
        const canonical = keyMap.get(makeKey(name));
        return canonical ? limitedSet.has(canonical) : false;
      }
      // 未知限定の検知：セル内にシリアル系表示があるが、レジストリに未登録
      function hasSerialLike(text){
        // 例: [54], [ 003 ], ( 1 of 20 ), （12／50）ほかを広めに吸収
        return /\[\s*\d+\s*\]|(?:\(\s*\d+\s*(?:of|\/|／)\s*\d+\s*\))|（\s*\d+\s*(?:of|\/|／)\s*\d+\s*）/i.test(text);
      }

      // フリガナ比較のための正規化
      function normalizeForFuri(s){
        if (!s) return '';
        // ひら→カナ、NFKC
        return [...s].map(ch => (ch >= '\u3041' && ch <= '\u3096') ? String.fromCharCode(ch.charCodeAt(0)+0x60) : ch).join('').normalize('NFKC');
      }
      // 文字カテゴリ: 0=記号, 1=数字, 2=英字, 3=日本語（カナ/かな/漢字）
      function charType(ch){
        const cp = ch.codePointAt(0);
        // 日本語（カタカナ/長音）
        if ((cp >= 0x30A0 && cp <= 0x30FF) || cp === 0x30FC) return 3;
        // ひらがな（normalize前後の保険）
        if (cp >= 0x3040 && cp <= 0x309F) return 3;
        // 漢字（CJK統合/拡張A/互換）
        if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) || (cp >= 0xF300 && cp <= 0xFAFF)) return 3;
        // 記号
        if (cp === 0x30FB) return 0; // ・（中黒）
        // 数字（半角/全角）
        if ((cp >= 0x30 && cp <= 0x39) || (cp >= 0xFF10 && cp <= 0xFF19)) return 1;
        // 英字（半角/全角）
        if ((cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A) || (cp >= 0xFF21 && cp <= 0xFF3A) || (cp >= 0xFF41 && cp <= 0xFF5A)) return 2;
        // それ以外は記号扱い（絵文字など）
        return 0;
      }
      function readChunk(s, i, type){
        let j = i;
        if (type === 1){ // 数字
          while (j < s.length && charType(s[j]) === 1) j++;
          const str = s.slice(i,j);
          const num = Number.parseInt(str,10);
          return { next:j, type, str, num: Number.isNaN(num) ? 0 : num };
        }
        if (type === 2){ // 英字
          while (j < s.length && charType(s[j]) === 2) j++;
          return { next:j, type, str:s.slice(i,j) };
        }
        if (type === 3){ // カナ
          while (j < s.length && charType(s[j]) === 3) j++;
          return { next:j, type, str:s.slice(i,j) };
        }
        // 記号
        while (j < s.length && charType(s[j]) === 0) j++;
        return { next:j, type, str:s.slice(i,j) };
      }

      function compareChunksAsc(A,B,type){
        if (type === 1){ // 数字は数値比較→桁数→文字列
          if (A.num !== B.num) return A.num - B.num;
          if (A.str.length !== B.str.length) return A.str.length - B.str.length;
          return A.str.localeCompare(B.str, 'ja', {sensitivity:'base', numeric:true});
        }
        if (type === 2){ // 英字は辞書式
          return A.str.localeCompare(B.str, 'ja', {sensitivity:'base'});
        }
        if (type === 3){ // 日本語（カナ/かな/漢字）
          return A.str.localeCompare(B.str, 'ja', {sensitivity:'base', numeric:true});
        }
        // 記号はコード順
        return A.str < B.str ? -1 : (A.str > B.str ? 1 : 0);
      }
      function compareChunksDesc(A,B,type){
        if (type === 1){ // 数字は数値降順→桁数→文字列
          if (A.num !== B.num) return B.num - A.num;
          if (A.str.length !== B.str.length) return B.str.length - A.str.length;
          return B.str.localeCompare(A.str, 'ja', {sensitivity:'base', numeric:true});
        }
        if (type === 2){ // 英字は辞書式（逆順）
          return B.str.localeCompare(A.str, 'ja', {sensitivity:'base'});
        }
        if (type === 3){ // 日本語（逆順）
          return B.str.localeCompare(A.str, 'ja', {sensitivity:'base', numeric:true});
        }
        // 記号は安定のためコード順の逆
        return A.str > B.str ? -1 : (A.str < B.str ? 1 : 0);
      }

      // フリガナ優先度：正順= 記号 < 数字(昇) < 英字(昇) < カナ(昇)
      //                 逆順= カナ(降) < 英字(降) < 数字(降) < 記号
      function cmpFuri(a,b,asc){
        const sa = normalizeForFuri(a.kana ?? a.name);
        const sb = normalizeForFuri(b.kana ?? b.name);
        let ia=0, ib=0;
        const rankAsc  = [0,1,2,3];
        const rankDesc = [3,2,1,0];
        while (ia < sa.length && ib < sb.length){
          const ta = charType(sa[ia]);
          const tb = charType(sb[ib]);
          const ra = asc ? rankAsc[ta] : rankDesc[ta];
          const rb = asc ? rankAsc[tb] : rankDesc[tb];
          if (ra !== rb) return ra - rb;
          const ca = readChunk(sa, ia, ta);
          const cb = readChunk(sb, ib, tb);
          const d  = asc ? compareChunksAsc(ca,cb,ta) : compareChunksDesc(ca,cb,ta);
          if (d) return d;
          ia = ca.next; ib = cb.next;
        }
        return sa.length - sb.length;
      }

      // 行→メタ抽出
      function getMeta(row){
        if (metaCache.has(row)) return metaCache.get(row);
        const cell = row.cells[idxMap[nameTitle]];
        const firstSpan = cell.querySelector('span');
        const name = (firstSpan ? firstSpan.textContent : cell.textContent).trim();
        const raw  = cell.textContent;
        const rarity = dbePickRarityFromText(raw) || 'N';
        const marimo = parseInt(row.cells[mrimCol].textContent.replace(/\D/g,''),10) || 0;
        const kana   = (kanaDict instanceof Map) ? (kanaDict.get(name) ?? null) : null;
        const knownLimited = isKnownLimited(name);
        const unknownLimited = !knownLimited && hasSerialLike(raw);
        const hasKana = !!kana;
       // ③④：未知限定→既知限定→非限定 の優先
        const catLimitedAsc  = unknownLimited ? 0 : (knownLimited ? 1 : 2);
        // ⑤⑥：未定義(kana無)を上位に
        const catDefinedAsc  = hasKana ? 1 : 0; // 0=未定義,1=定義済み
        const obj = { row, name, raw, rarity, marimo, kana, knownLimited, unknownLimited, hasKana,
                      catLimitedAsc, catDefinedAsc };
        metaCache.set(row, obj);
        return obj;
      }

      // 単純比較ヘルパー
      function cmpRarity(a,b,asc){ const ra = rarityOrder[a.rarity] ?? 99; const rb = rarityOrder[b.rarity] ?? 99; return asc ? (ra-rb) : (rb-ra); }
      function cmpMarimo(a,b,highFirst){ return highFirst ? (b.marimo - a.marimo) : (a.marimo - b.marimo); }
      function cmpName(a,b,asc){ return asc ? a.name.localeCompare(b.name,'ja') : b.name.localeCompare(a.name,'ja'); }

      // ソート本体
      function applyCycleSort(phase){
        // 念のため 0..3 に正規化（旧6段階の状態が混入しても落ちないように）
        phase = Number.isFinite(phase) ? phase : 0;
        phase = ((phase % 4) + 4) % 4;

        const body = table.tBodies[0];
        const rows = Array.from(body.rows);
        rows.sort((ra,rb)=>{
          const a = getMeta(ra), b = getMeta(rb);
          switch(phase){
            // ①【⬆限定】：未知限定→既知限定→非限定 → （各内：フリガナ正順。ただし未知限定は同名連結） → rarity 正順 → marimo 逆順
            case 0: {
              const c = a.catLimitedAsc - b.catLimitedAsc;
              if (c) return c;
              if (a.unknownLimited && b.unknownLimited){
                const g = cmpName(a,b,true);
                if (g) return g;
              } else {
                const g = cmpFuri(a,b,true);
                if (g) return g;
              }
              return cmpRarity(a,b,true) || cmpMarimo(a,b,true) || cmpName(a,b,true);
            }
            // ②【⬇限定】：カテゴリ順は据え置き（未知→既知→非）/ 各内の並びを逆（未知は同名 desc、他はフリガナ逆）→ rarity 逆順 → marimo 正順
            case 1: {
              const c = a.catLimitedAsc - b.catLimitedAsc;
              if (c) return c;
              if (a.unknownLimited && b.unknownLimited){
                const g = cmpName(a,b,false);
                if (g) return g;
              } else {
                const g = cmpFuri(a,b,false);
                if (g) return g;
              }
              return cmpRarity(a,b,false) || cmpMarimo(a,b,false) || cmpName(a,b,true);
            }
            // ③【⬆カナ】
            //   rarity 正順 → フリガナ正順 → （同名のみ）マリモ降順 → 名前
            case 2: {
              const r = cmpRarity(a,b,true);
              if (r) return r;
              const f = cmpFuri(a,b,true);
              if (f) return f;
              if (a.name === b.name) {
                const m = cmpMarimo(a,b,true);
                if (m) return m;
              }
              return cmpName(a,b,true);
            }
            // ④【⬇カナ】
            //   rarity 逆順 → フリガナ逆順 → （同名のみ）マリモ昇順 → 名前
            case 3: {
              const r = cmpRarity(a,b,false);
              if (r) return r;
              const f = cmpFuri(a,b,false);
              if (f) return f;
              if (a.name === b.name) {
                const m = cmpMarimo(a,b,false);
                if (m) return m;
              }
              return cmpName(a,b,true);
            }
          }
          return 0;
        });
        rows.forEach(r => body.appendChild(r));

        // ヘッダー右側にインジケーター（【⬆限定】等）
        const headerRowNow = getHeaderRowNow();
        if (headerRowNow) headerRowNow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        const labels = [
          ['⬆','限定'],
          ['⬇','限定'],
          ['⬆','カナ'],
          ['⬇','カナ'],
        ];
        const [arrow,label] = labels[phase];
        // 付与先のズレを回避：初期 clone 済みの nameTh を常にターゲットにする
        updateSortIndicator(nameTh, arrow, 'right', label); // テキストは updateSortIndicator 内で 0.8em 指定

        // 記憶（最後にソートされた列と方向）
        table.dataset.nameSortPhase = String(phase);
        table.dataset.nameSortLastApplied = `name:${phase}`;
        lastSortedColumn  = columnIds[id][nameTitle];
        lastSortAscending = (phase % 2 === 0); // 0,2=⬆（正順）, 1,3=⬇
      }

      // クリックで ①→②→③→④→… をループ（dataset リセット耐性）
      let nameSortPhase = Number(table.dataset.nameSortPhase || '0');
      nameSortPhase = Number.isFinite(nameSortPhase) ? nameSortPhase : 0;
      nameSortPhase = ((nameSortPhase % 4) + 4) % 4;
      nameTh.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        ev.preventDefault();
        // 現在段階を適用
        applyCycleSort(nameSortPhase);
        // 次段階へ
        nameSortPhase = (nameSortPhase + 1) % 4;
        table.dataset.nameSortPhase = String(nameSortPhase);
        // 再適用は「直近適用済み」を優先（別処理で dataset が変化しても安定）
        dbeRememberSort(id, ()=>applyCycleSort(Number((table.dataset.nameSortLastApplied||'name:0').split(':')[1])), 'NAME');
      });

      // 〓〓〓〓〓〓 テーブルソート状態の記憶 〓〓〓〓〓〓
      // rankCol（レアリティ列）を安全に取得し、見つからなければ本ブロックはスキップ
      const rankCol = (()=>{
        if (Number.isInteger(idxMap['レアリティ'])) return idxMap['レアリティ'];
        if (Number.isInteger(idxMap['ランク']))     return idxMap['ランク'];
        if (Number.isInteger(idxMap['Rarity']))    return idxMap['Rarity'];
        return -1;
      })();
      if (rankCol >= 0 && table.tBodies && table.tBodies[0]) {
        Array.from(table.tBodies[0].rows).forEach(r=>{
          const cell = r.cells[rankCol];
          cell.style.cursor='pointer';
          cell.addEventListener('click',()=>{
            const clicked=(dbePickRarityFromText(cell.textContent) || 'N');
            // rarity チェック群（elm）が存在する場合のみ同期（未定義でも落ちないように）
            if (typeof elm === 'object' && elm){
              Object.keys(elm).forEach(rk=>{
                if (elm[rk]) elm[rk].checked = (rk === clicked);
              });
            }
            applyColor();
            applyFilter();
            // フィルター後：保存済みのソート履歴（多段）を再適用
            dbeApplySortHistory(id);
            scrollToAnchorCell();
          });
        });
      }

      // 〓〓〓〓〓〓 初期適用：サーバー順を維持して色付けのみ 〓〓〓〓〓〓
      // weapon/armor ブロックでのみ定義される applyColor の未定義参照を回避
      if ((id === 'weaponTable' || id === 'armorTable') && typeof applyColor === 'function') {
        applyColor();
      }

    } // ← wireNameColumnSort の閉じ
  } // ← processTable の閉じ
})(); // ← IIFE の閉じ
