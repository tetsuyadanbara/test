// ==UserScript==
// @name         Donguri Battle Assistant
// @namespace    https://donguri.5ch.net/
// @version      0.0.21.1
// @description  5ちゃんねるのどんぐりシステムから派生したゲームの操作性を改善するためのユーザースクリプト
// @author       福呼び草
// @match        https://donguri.5ch.net/teambattle*
// @match        https://donguri.5ch.net/bag
// @match        https://donguri.5ch.net/
// @run-at       document-start
// @grant        GM_addStyle
// ==/UserScript==

(function() {
  'use strict';

  console.log('[DBA] BOOT', 'ver=', (typeof DBA_VERSION !== 'undefined' ? DBA_VERSION : '(meta)'), 'href=', location.href);

  // URL判定
  const urlObj = new URL(location.href);
  const mode = urlObj.searchParams.get('m');
  const isTopPage = (urlObj.origin === 'https://donguri.5ch.net' && urlObj.pathname === '/' && !mode);

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
    :root{
      --dba-fn-bg: #f0f0f0;
      --dba-fn-fg: #111;
      --dba-fn-border: #000;
      --dba-fn-shadow: rgba(0,0,0,0.15);
      --dba-fn-height: 50px; /* ファンクションセクションの高さ（JSで実測値に更新） */
      --dba-layer-text-opacity: 1; /* 0.0 - 1.0（レイヤー上の文字濃度） */
    }

    /* ファンクションセクション本体 */
    #dba-function-section{
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: auto;                 /* ★2段構造になるので固定高をやめる（高さはJSで追従） */
      display: flex;
      flex-direction: column;       /* ★縦積み（上=progress / 下=ボタン群） */
      align-items: stretch;
      justify-content: flex-start;
      gap: 6px;
      margin: 0;
      padding: 6px 8px;             /* ★内側余白を少し確保 */
      box-sizing: border-box;
      background: var(--dba-fn-bg);
      color: var(--dba-fn-fg);
      border-bottom: 1px solid var(--dba-fn-border);
      box-shadow: 0 2px 8px var(--dba-fn-shadow);
      z-index: 999999;
      max-height: min(60vh, calc(100vh - 8px)); /* ★大きくなりすぎたらfnbar内で収める */
      overflow: auto;                              /* ★あふれはfnbar内でスクロール */
      scrollbar-gutter: stable both-edges;
    }

    /* fnbar：上段（progress）/下段（ボタン群） */
    #dba-fn-progress-host{
      width: 100%;
      min-width: 0;
    }
    #dba-fn-buttons-row{
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      flex-wrap: wrap;   /* ボタンが多い場合は折り返し */
      min-width: 0;
    }

    /* 既存ページを隠さないため、上に余白を確保 */
    html.dba-has-fnbar body{
      padding-top: calc(var(--dba-fn-height) + 4px) !important;
    }

    /* ===== トップページ「経過時間」プログレス表示（teambattle側へ移植） ===== */
    #dba-top-progress{
      margin: 0;                /* ★fnbar内に入るので外側マージンは0 */
      padding: 6px 8px;         /* ★fnbar内向けに少し圧縮 */
      border: 2px solid #000;
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      width: 100%;
      box-sizing: border-box;
    }
    /* 3ペイン（左：進捗 / 中央：ボタン / 右：同期情報） */
    #dba-top-progress .dba-top-progress__panes{
      display: flex;
      gap: 12px;
      align-items: stretch;
      justify-content: space-between;
      min-width: 0; /* はみ出し抑止 */
    }
    #dba-top-progress .dba-top-progress__paneM{
      flex: 0 0 auto;
      min-width: 130px;
      max-width: 180px;
      border-left: 1px solid #00000022;
      border-right: 1px solid #00000022;
      padding: 0 12px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
      gap: 8px;
    }
    #dba-top-progress .dba-top-progress__paneL{
      flex: 1 1 auto;
      min-width: 0; /* はみ出し抑止 */
    }
    #dba-top-progress .dba-top-progress__paneR{
      flex: 0 0 auto;
      min-width: 240px;
      max-width: 420px;
      /* ★中央ペインが境界線を持つので、右ペインは余白だけにする */
      border-left: none;
      padding-left: 0;
      display: none; /* 通常は非表示 */
    }
    /* 同期情報ONで右ペイン表示 */
    #dba-top-progress[data-showinfo="1"] .dba-top-progress__paneR{
      display: block;
    }
    /* ★中央ペイン：縦並びボタン（右のマージン系は無効化） */
    #dba-top-progress .dba-top-progress__paneM #dba-top-progress-sync-info,
    #dba-top-progress .dba-top-progress__paneM #dba-top-progress-sync-now{
      margin-left: 0;
      width: 100%;
      border-radius: 10px;
      padding: 6px 10px;
    }
    #dba-top-progress .dba-top-progress__paneM #dba-top-progress-sync-now[disabled]{
      opacity: 0.6;
      cursor: not-allowed;
    }
    /* ★「第xx期」＋プログレスバー＋ボタンを1行にまとめる */
    #dba-top-progress .dba-top-progress__termRow{
      font-weight: 900;
      margin: 0 0 6px 0;
      text-align: left;
      line-height: 1.2em;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 10px;
      min-width: 0; /* 子要素（term/bar）が縮められるように */
    }
    /* 「第xx期」テキストが長い時は省略（はみ出し抑止） */
    #dba-top-progress-title{
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 12em; /* ★バー領域を確保 */
      display: inline-block;
    }
    /* 「今すぐ同期」ボタン（第xx期の右） */
    #dba-top-progress-sync-now{
      margin-left: 1.2em; /* 1～2em 程度 */
      padding: 4px 10px;
      border-radius: 10px;
    }
    #dba-top-progress-sync-now[disabled]{
      opacity: 0.6;
      cursor: not-allowed;
    }
    /* 「同期情報」ボタン（スイッチ） */
    #dba-top-progress-sync-info{
      margin-left: 0.6em;
      padding: 4px 10px;
      border-radius: 10px;
    }
    #dba-top-progress-sync-info[data-on="1"]{
      background: #33a033;
      color: #fff;
    }
    /* ★termRow内で横に伸びるバー */
    #dba-top-progress .progress-bar{      height: 20px;
      background: #ccc;
      border-radius: 8px;
      font-size: 16px;
      overflow: hidden;
      margin-top: 0;     /* ★同一行なので上マージン不要 */
      flex: 1 1 auto;    /* ★横に伸びる */
      min-width: 140px;  /* ★極端に潰れないよう最低幅 */
    }
    #dba-top-progress .progress-bar > div{
      height: 100%;
      background: #428bca;
      width: 0%;
      text-align: right;
      padding-right: 5px;
      box-sizing: border-box;
      color: white;
      font-weight: 800;
    }
    /* ===== 期の下：試合進捗（第n試合/総数 + 1試合内バー） ===== */
    #dba-top-progress .dba-top-progress__matchRow{
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 1.2em; /* テキストと進捗バーの間隔 */
      margin-top: 8px;
      min-width: 0;
    }
    #dba-top-progress .dba-top-progress__matchLabel{
      font-weight: 900;
      white-space: nowrap;
      flex: 0 0 auto;
    }
    #dba-top-progress .dba-top-progress__matchRight{
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1 1 auto;
      min-width: 0;
    }
    #dba-top-progress .dba-top-progress__matchTime{
      font-weight: 900;
      font-size: 0.95em;
      opacity: 0.9;
      text-align: left;
      line-height: 1.1em;
      white-space: nowrap;
    }
    /* 試合バー */
    #dba-top-progress .progress-bar.dba-match-progress{
      height: 20px;
      font-size: 16px;
      margin-top: 0;
      border-radius: 8px;
    }
    /* 右ペイン：同期情報（縦に1行ずつ） */
    #dba-top-progress .dba-top-progress__infoLine{
      font-size: 0.92em;
      font-weight: 800;
      opacity: 0.88;
      text-align: left;
      line-height: 1.35em;
      margin: 0 0 6px 0;
      white-space: nowrap;
    }

    /* ===== バトルマップ透明レイヤー（将来の拡張用土台） ===== */
    #dba-battlemap-layer{
      position: fixed;
      left: 0;
      top: 0;
      width: 0;
      height: 0;
      z-index: 999990; /* fnbar(999999)より下、マップより上 */
      pointer-events: none; /* 現段階ではページ既存操作を妨げない */
      background: transparent;
    }
    #dba-battlemap-layer-grid{
      width: 100%;
      height: 100%;
      display: grid;
      background: transparent;
      box-sizing: border-box;
    }
    .dba-layer-cell{
      position: relative;
      background: transparent;
      box-sizing: border-box;
    }
    .dba-layer-cell__content{
      position: absolute;
      inset: 0;
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      font-size: 0.95rem; /* レイヤー上のセルのフォントサイズ */
      font-weight: 700;
      letter-spacing: -0.08rem;
      line-height: 0.95rem;
      opacity: var(--dba-layer-text-opacity);
      user-select: none;
      pointer-events: none;
      /* 左上寄せ + 折り返し + 下方向は隠す */
      padding: 2px 2px;
      box-sizing: border-box;
      overflow: hidden;           /* 下にあふれた分は非表示 */
      white-space: pre-wrap;      /* 改行を維持しつつ折り返し */
      overflow-wrap: anywhere;    /* 長い単語も折り返し */
      word-break: break-word;     /* 互換用 */
      text-align: left;
      text-shadow:
        0 0 4px rgba(255,255,255,1),
        0 0 8px rgba(255,255,255,0.75);
    }

    /* 汎用ボタン（機能系ボタン共通） */
    .dba-btn-fn{
      appearance: none;
      margin:4px;
      padding: 8px 4px;
      border: 2px solid #000;
      border-radius: 12px;
      background: #f08800;
      color: #fff;
      font-size: 1em;
      font-weight: 500;
      line-height: 1em;
      cursor: pointer;
      user-select: none;
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
      transition: transform 0.05s ease, box-shadow 0.15s ease, background 0.15s ease;
    }
    /* ラピッド攻撃：ON状態の視認性 */
    .dba-btn-fn[data-on="1"]{
      background: #33a033;
      color: #fff;
    }
    .dba-btn-fn:hover{
      background: #0000e0;
      box-shadow: 0 2px 6px rgba(0,0,0,0.16);
    }
    /* ON状態hoverは“青”に上書きされないようにする */
    .dba-btn-fn[data-on="1"]:hover{
      background: #2a8c2a;
    }
    .dba-btn-fn:active{
      transform: translateY(1px);
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
    }
    .dba-btn-fn:focus{
      outline: 2px solid #ea0000;
      outline-offset: 2px;
    }
    /* ===== モーダル（標準） ===== */
    .dba-m-std{
      border: 4px solid #080;
      border-radius: 12px;
      padding: 0;
      margin: auto;
      width: min(560px, calc(100vw - 24px));
      max-height: min(80vh, calc(100vh - 24px));
      background: #f8f8f8;
      color: #111;
      box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    }
    .dba-m-std::backdrop{
      background: rgba(0,0,0,0.55);
    }
    .dba-m-std .dba-modal__top{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      border-bottom: 1px solid #000;
      background: #f0f0f0;
    }
    .dba-m-std .dba-modal__title{
      font-size: 1.25em;
      font-weight: 700;
      margin: 0;
      padding: 0;
    }
    .dba-m-std .dba-modal__mid{
      padding: 12px;
      overflow: auto;
      max-height: calc(min(80vh, calc(100vh - 24px)) - 110px);
    }
    .dba-m-std .dba-modal__bot{
      display: flex;
      justify-content: center;
      gap: 10px;
      padding: 10px 12px;
      border-top: 1px solid #000;
      background: #f0f0f0;
    }

    /* ===== セル詳細モーダル（サイズ最適化） ===== */
    #dba-m-cell-detail.dba-m-std{
      width: min(760px, calc(100vw - 24px));
      max-height: min(88vh, calc(100vh - 24px));
    }
    #dba-m-cell-detail.dba-m-std .dba-modal__mid{
      /* 標準(80vh)の計算を、セル詳細(88vh)に合わせて上書き */
      max-height: calc(min(88vh, calc(100vh - 24px)) - 110px);
    }

    /* ===== 戦闘結果モーダル（サイズ最適化 + スクロール） ===== */
    #dba-m-battle-result.dba-m-std{
      width: min(820px, calc(100vw - 24px));
      /* 長い時はここで上限、短い時は content に合わせて自然に縮む */
      max-height: min(88vh, calc(100vh - 24px));
      /* スクロールは mid のみに限定（dialog全体にはスクロールを出さない） */
      overflow: hidden;
    }

    /* 戦闘結果モーダル：トップ欄を「左=タイトル / 中央=チェック / 右=×」にする */
    #dba-m-battle-result.dba-m-std .dba-modal__top{
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      column-gap: 10px;
    }
    #dba-m-battle-result.dba-m-std .dba-modal__title{
      justify-self: start;
    }
    .dba-br-top-center{
      justify-self: center;
      display: inline-flex;
      align-items: center;
    }

    /* 戦闘結果：オプションボタン */
    .dba-br-btn-opt{
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
    .dba-br-btn-opt:hover{ filter: brightness(0.97); }
    .dba-br-btn-opt:active{ transform: translateY(1px); }

    /* 戦闘結果：クリック透過モード（Close/Option以外は透過） */
    #dba-m-battle-result.dba-m-std.dba-br-pass{
      opacity: 0.55;
      pointer-events: none; /* 基本はクリックを下に通す */
    }
    /* 透過中でも「Close」「オプション」だけはクリック可 */
    #dba-m-battle-result.dba-m-std.dba-br-pass #dba-br-btn-option,
    #dba-m-battle-result.dba-m-std.dba-br-pass .dba-btn-close{
      pointer-events: auto;
    }
    /* ★透過中でも Close/Option は不透過（親opacityの影響を打ち消す） */
    #dba-m-battle-result.dba-m-std.dba-br-pass #dba-br-btn-option,
    #dba-m-battle-result.dba-m-std.dba-br-pass .dba-btn-close{
      opacity: 1 !important;
      filter: none !important;
    }
    /* 透過中は × を完全に消す（見た目＋クリック判定なし） */
    #dba-m-battle-result.dba-m-std.dba-br-pass .dba-btn-x{
      display: none !important;
    }

    /* ===== 戦闘結果：透過ON時の表示は dialog を使わずフロートパネルで表示 ===== */
    #dba-br-float{
      position: fixed;
      top: calc(var(--dba-fn-height) + 480px);  /* フロートパネルの表示位置（高さ） */
      left: 12px;
      right: 12px;
      margin: 0 auto;
      width: min(360px, calc(100vw - 24px));
      max-height: min(88vh, calc(100vh - 24px));
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
    #dba-br-float[data-open="1"]{ display: block; }
    #dba-br-float .dba-modal__top,
    #dba-br-float .dba-modal__mid,
    #dba-br-float .dba-modal__bot{
      pointer-events: none; /* パネル自体は透過（ボタンのみ例外） */
    }
    #dba-br-float #dba-br-float-btn-option,
    #dba-br-float .dba-btn-close{
      pointer-events: auto; /* Option/Closeだけ押せる */
      opacity: 1 !important; /* 不透過 */
    }
    /* フロート内は × は表示しない（透過要件に合わせる） */
    #dba-br-float .dba-btn-x{ display:none !important; }
    #dba-br-float .dba-modal__mid{
      overflow: auto;
      max-height: calc(min(88vh, calc(100vh - 24px)) - 110px);
      scrollbar-gutter: stable both-edges;
    }

    #dba-m-battle-result.dba-m-std .dba-modal__mid{
      /* 常にスクロール可能（短い時はスクロールは出ない） */
      overflow: auto;
      /* 上限は max-height で決まる。短文なら高さは自然に小さくなる */
      max-height: calc(min(88vh, calc(100vh - 24px)) - 110px);
      /* スクロールバーを見やすく（OS依存だが効く環境では効く） */
      scrollbar-gutter: stable both-edges;
    }

    /* 戦闘結果テキストをそのまま読みやすく表示 */
    .dba-battle-result-text{
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
      line-height: 1.25em;
      font-weight: 600;
      font-size: 0.98em;
      text-align: left; /* 戦闘結果は左寄せ */
    }

    /* ===== 戦闘結果：タイトル欄の「末尾2行のみ表示」チェック ===== */
    .dba-br-tail2-chk{
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
      white-space: nowrap;
    }
    .dba-br-tail2-chk input[type="checkbox"]{
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: #ea0000;
    }

    /* ===== モーダル（アラート） ===== */
    #dba-m-alert.dba-m-alert{
      border: 4px solid #e00;
      border-radius: 12px;
      padding: 0;
      margin: auto;
      width: min(420px, calc(100vw - 24px));
      background: #f0f0cc;
      color: #000;
      box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    }
    #dba-m-alert.dba-m-alert::backdrop{
      background: rgba(0,0,0,0.55);
    }
    #dba-m-alert .dba-alert__mid{
      padding: 14px 12px;
      font-size: 1.15em;
      font-weight: 700;
      line-height: 1.3em;
    }
    #dba-m-alert .dba-alert__bot{
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
    .dba-btn-close,
    .dba-btn-x{
      appearance: none;
      width: 4em;
      border: 2px solid #000;
      border-radius: 12px;
      margin: 4px 8px;
      padding: 8px auto;
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
    .dba-btn-close:hover,
    .dba-btn-x:hover{
      filter: brightness(0.97);
      box-shadow: 0 2px 6px rgba(0,0,0,0.16);
    }
    .dba-btn-ok:active,
    .dba-btn-apply:active,
    .dba-btn-close:active,
    .dba-btn-x:active{
      transform: translateY(1px);
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
    }
    .dba-btn-ok{ background:#2280e0; color:#fff; }
    .dba-btn-apply{ background:#33a033; color:#fff; }
    .dba-btn-close{ background:#e02222; color:#fff; }
    .dba-btn-x{
      width: 32px;
      height: 32px;
      padding: 0;
      border-radius: 16px;
      background:#e02222;
      color:#fff;
      font-size: 1.4rem;
      line-height: 1.4rem;
    }

    /* 設定UI小物 */
    .dba-setting-row{
      display: grid;
      grid-template-columns: 1fr 120px;
      gap: 10px;
      align-items: center;
      padding: 8px 6px;
      border: 1px solid #00000022;
      border-radius: 10px;
      background: #fff;
      margin-bottom: 10px;
    }
    .dba-setting-row label{
      text-align: left;
      font-weight: 700;
    }
    .dba-setting-row input[type="number"]{
      width: 100%;
      box-sizing: border-box;
      padding: 6px 8px;
      border: 1px solid #00000055;
      border-radius: 10px;
      font-size: 1em;
    }
    .dba-setting-row input[type="range"]{
      width: 100%;
      box-sizing: border-box;
    }

    /* ===== 装備ロスター ===== */
    #dba-m-roster.dba-m-std{
      width: min(920px, calc(100vw - 24px));
      max-height: min(88vh, calc(100vh - 24px));
      overflow: hidden;
    }
    #dba-m-roster.dba-m-std .dba-modal__mid{
      max-height: calc(min(88vh, calc(100vh - 24px)) - 110px);
      overflow: auto;
    }
    .dba-roster-head{
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    }
    .dba-roster-title{
      font-size: 1.15em;
      font-weight: 800;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dba-roster-head-btns{
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .dba-btn-mini{
      appearance: none;
      border: 2px solid #000;
      border-radius: 10px;
      padding: 6px 10px;
      margin: 0;
      font-size: 0.95em;
      font-weight: 700;
      cursor: pointer;
      user-select: none;
      background: #eee;
      color: #000;
      box-shadow: 0 1px 2px rgba(0,0,0,0.12);
    }
    .dba-btn-mini:hover{ filter: brightness(0.97); }
    .dba-btn-mini:active{ transform: translateY(1px); }
    .dba-btn-mini--danger{ background:#f3d0d0; }
    .dba-btn-mini--ok{ background:#cfe3ff; }

    .dba-roster-row2{
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: flex-start;
      margin: 12px 0;
    }
    .dba-roster-list{
      border: 1px solid #000;
      border-radius: 12px;
      background: #fff;
      padding: 8px;
      overflow: hidden;
    }
    .dba-roster-item{
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid #00000022;
      margin: 6px 0;
      cursor: pointer;
      user-select: none;
    }
    .dba-roster-item:hover{ background: #f7f7f7; }
    .dba-roster-item[data-selected="1"]{
      outline: 3px solid #ea0000;
      outline-offset: 0px;
      background: #fff2f2;
    }
    .dba-roster-item__name{
      font-weight: 800;
      text-align: left;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .dba-roster-item__meta{
      font-size: 0.9em;
      font-weight: 700;
      opacity: 0.9;
      white-space: nowrap;
    }

    /* 装備変更結果（ロスター）テキスト表示 */
    .dba-roster-result-text{
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
      line-height: 1.25em;
      font-weight: 600;
      font-size: 0.98em;
      text-align: left;
    }

    /* ===== プリセット並び替えモーダル ===== */
    #dba-m-roster-sort.dba-m-std{
      width: min(760px, calc(100vw - 24px));
      max-height: min(88vh, calc(100vh - 24px));
      overflow: hidden;
    }
    #dba-m-roster-sort.dba-m-std .dba-modal__mid{
      max-height: calc(min(88vh, calc(100vh - 24px)) - 110px);
      overflow: hidden; /* リスト側でスクロール */
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
    }
    .dba-sort-hint{
      font-weight: 800;
      text-align: left;
      margin: 0;
      padding: 0;
    }
    .dba-sort-list{
      border: 1px solid #000;
      border-radius: 12px;
      background: #fff;
      padding: 8px;
      overflow: auto;
      min-height: 120px;
      max-height: 52vh; /* 画面が小さい時も暴れにくく */
      scrollbar-gutter: stable both-edges;
      position: relative; /* 挿入ラインの absolute 基準 */
    }
    /* 挿入予定位置の赤いライン */
    .dba-sort-insert-line{
      position: absolute;
      left: 6px;
      right: 6px;
      height: 0;
      border-top: 3px solid #ea0000;
      border-radius: 999px;
      pointer-events: none;
      z-index: 5;
      display: none;
    }
    .dba-sort-item{
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
    .dba-sort-handle{
      font-weight: 900;
      text-align: center;
      cursor: grab;
      opacity: 0.9;
    }
    .dba-sort-item[draggable="true"]{ cursor: grab; }
    .dba-sort-item.dba-sort-dragging{
      opacity: 0.55;
      border-style: dashed;
    }
    .dba-sort-item.dba-sort-over{
      outline: 3px solid #ea0000;
      outline-offset: 0px;
      background: #fff2f2;
    }
    .dba-sort-name{
      font-weight: 900;
      text-align: left;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .dba-sort-meta{
      font-size: 0.9em;
      font-weight: 800;
      opacity: 0.85;
      white-space: nowrap;
    }

    /* ===== 装備プリセット追加モーダル ===== */
    #dba-m-roster-add.dba-m-std{
      width: min(760px, calc(100vw - 24px));
      max-height: min(88vh, calc(100vh - 24px));
      overflow: hidden;
    }
    #dba-m-roster-add.dba-m-std .dba-modal__mid{
      max-height: calc(min(88vh, calc(100vh - 24px)) - 110px);
      overflow: auto;
    }
    /* ===== 装備プリセット再編集モーダル ===== */
    #dba-m-roster-edit.dba-m-std{
      width: min(760px, calc(100vw - 24px));
      max-height: min(88vh, calc(100vh - 24px));
      overflow: hidden;
    }
    #dba-m-roster-edit.dba-m-std .dba-modal__mid{
      max-height: calc(min(88vh, calc(100vh - 24px)) - 110px);
      overflow: auto;
    }
    .dba-add-wrap{
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 10px;
      align-items: start;
    }
    .dba-add-left{
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: stretch;
    }
    .dba-add-right{
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: stretch;
    }
    .dba-add-sel{
      border: 1px solid #000;
      border-radius: 12px;
      background: #fff;
      padding: 8px 10px;
      min-height: 2.4em;
      font-weight: 700;
      text-align: left;
      overflow-wrap: anywhere;
    }
    .dba-add-name{
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border: 2px solid #000;
      border-radius: 12px;
      font-size: 1em;
      font-weight: 700;
    }
    .dba-add-bot{
      display: flex;
      gap: 12px;
      justify-content: flex-start;
      align-items: center;
      margin-top: 10px;
    }

    /* ===== アイテム選択（バッグ表） ===== */
    #dba-m-pick-item.dba-m-std{
      width: min(1100px, calc(100vw - 24px));
      max-height: min(90vh, calc(100vh - 24px));
      overflow: hidden;
    }
    #dba-m-pick-item.dba-m-std .dba-modal__mid{
      max-height: calc(min(90vh, calc(100vh - 24px)) - 110px);
      overflow: auto;
    }
    .dba-pick-hint{
      font-weight: 700;
      margin: 0 0 10px 0;
      text-align: left;
    }

    /* ===== アイテム選択：レアリティフィルタ ===== */
    .dba-pick-filterbar{
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
    .dba-pick-filterbtn{
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
    .dba-pick-filterbtn:hover{ filter: brightness(0.97); }
    .dba-pick-filterbtn:active{ transform: translateY(1px); }
    .dba-pick-filterbtn[data-active="1"]{
      outline: 3px solid #ea0000;
      outline-offset: 0px;
      background: #fff2f2;
    }
    .dba-pick-filterbtn--all{ background:#e8e8e8; }
    .dba-pick-filterbtn--n{ background:#ffffff; }
    .dba-pick-filterbtn--r{ background:#3fa435; color:#fff; }
    .dba-pick-filterbtn--sr{ background:#2175d9; color:#fff; }
    .dba-pick-filterbtn--ssr{ background:#a633d6; color:#fff; }
    .dba-pick-filterbtn--ur{ background:#f45d01; color:#fff; }

    /* ===== アイテム選択：MOD 0 フィルタ ===== */
    .dba-pick-filterchk{
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
    .dba-pick-filterchk input[type="checkbox"]{
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: #ea0000;
    }
    .dba-pick-filterchk[data-disabled="1"]{
      opacity: 0.45;
      cursor: not-allowed;
    }
    .dba-pick-filterchk[data-disabled="1"] input{
      cursor: not-allowed;
    }

    .dba-pick-row-selected{
      /* tr 自体に背景が乗らない実装もあるため、td 側も別途指定する */
      background: rgba(255,0,0,0.22) !important;
      outline: 3px solid rgba(255,0,0,0.75) !important;
      outline-offset: -2px !important;
    }
    /* 多くのテーブルは td に背景が乗っているため、td にも強制適用する */
    .dba-pick-row-selected > td,
    .dba-pick-row-selected > th{
      background: rgba(255,0,0,0.22) !important;
      /* “赤いフィルタ”っぽく見せるため、内側に薄赤のシェードも追加 */
      box-shadow: inset 0 0 0 9999px rgba(255,0,0,0.10) !important;
    }
    /* クリック対象が a 等でも選択が分かりやすいように */
    .dba-pick-row-selected a{
      color: #000 !important;
      font-weight: 800;
    }
    .dba-backup-textarea{
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
      /* ===== オート装備（候補ポップアップ / 設定） ===== */
    #dba-auto-equip-pop{
      position: fixed;
      z-index: 999998; /* fnbar(999999)より下 */
      display: none;
      min-width: 180px;
      max-width: min(360px, 92vw);
      max-height: min(60vh, 520px);
      overflow: auto;
      border: 2px solid #000;
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 10px 28px rgba(0,0,0,0.25);
      padding: 8px;
      box-sizing: border-box;
    }
    #dba-auto-equip-pop[data-open="1"]{ display: block; }
    .dba-ae-pop-title{
      font-weight: 900;
      margin: 0 0 6px 0;
      text-align: left;
    }
    .dba-ae-pop-btn{
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
    .dba-ae-pop-btn:hover{ filter: brightness(0.97); }
    .dba-ae-pop-btn:active{ transform: translateY(1px); }

    #dba-m-auto-equip.dba-m-std{
      width: min(980px, calc(100vw - 24px));
      max-height: min(88vh, calc(100vh - 24px));
      overflow: hidden;
    }
    #dba-m-auto-equip.dba-m-std .dba-modal__mid{
      max-height: calc(min(88vh, calc(100vh - 24px)) - 110px);
      /* ★ここが重要：mid全体スクロールを抑止して、内部（左右ゾーン）でスクロールさせる */
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .dba-ae-topbtns{
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: flex-start;
      margin: 0 0 10px 0;
    }
    .dba-ae-autoclose{
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
    .dba-ae-autoclose input[type="checkbox"]{
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: #ea0000;
    }
    .dba-ae-autoclose input[type="number"]{
      width: 72px;
      box-sizing: border-box;
      padding: 6px 8px;
      border: 1px solid #00000055;
      border-radius: 10px;
      font-size: 1em;
      font-weight: 800;
    }
    .dba-ae-tabs{
      display: flex;
      gap: 8px;
      align-items: stretch;
      justify-content: flex-start;
      margin: 10px 0 8px 0;
    }
    .dba-ae-tab{
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
    .dba-ae-tab[data-active="1"]{
      outline: 3px solid #ea0000;
      outline-offset: 0px;
      background: #fff2f2;
    }
    .dba-ae-wrap{
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 10px;
      /* ★grid item が縮められるようにする（min-height:auto を避ける） */
      align-items: stretch;
      flex: 1 1 auto;  /* #dba-m-auto-equip .dba-modal__mid（flex）配下で残り領域を占有 */
      min-height: 0;   /* これが無いと子が溢れて mid がスクロールしやすい */
    }
    .dba-ae-leftpane{
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: stretch;
      /* ★左ペインも高さが親より大きくならないようにし、溢れは左ペイン内でスクロール */
      overflow: auto;
      min-height: 0;
      max-height: 100%;
      scrollbar-gutter: stable both-edges;
    }
    .dba-ae-rpane{
      display: grid;
      grid-template-columns: 1fr 100px 1fr;
      gap: 10px;
      align-items: stretch;
      min-height: 0; /* ★子（左右box）が親高さ以内に収まれるように */
    }
    .dba-ae-box{
      border: 1px solid #000;
      border-radius: 12px;
      background: #fff;
      padding: 8px;
      /* 左右ゾーンは内容が溢れたらゾーン内スクロール */
      overflow: auto;
      /* ★min-height 固定だと親より大きくなって mid がスクロールするので解除 */
      min-height: 0;
      max-height: 100%;
      scrollbar-gutter: stable both-edges;
    }
    .dba-ae-box-title{
      font-weight: 900;
      margin: 0 0 8px 0;
      text-align: left;
    }
    .dba-ae-item{
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid #00000022;
      margin: 6px 0;
      cursor: pointer;
      user-select: none;
      font-weight: 800;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .dba-ae-item:hover{ background:#f7f7f7; }
    .dba-ae-item[data-selected="1"]{
      outline: 3px solid #ea0000;
      outline-offset: 0px;
      background: #fff2f2;
    }
    .dba-ae-midbtns{
      display: flex;
      flex-direction: column;
      /* 中央ゾーン：ボタン間隔 30px */
      gap: 30px;
      align-items: stretch;
      justify-content: center;
      padding: 10px 6px;
    }

    /* ===== オート装備：オプションモーダル ===== */
    .dba-ae-opt-row{
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 10px;
      padding: 10px 10px;
      border: 1px solid #00000022;
      border-radius: 12px;
      background: #fff;
      margin: 10px 0;
      font-weight: 800;
      text-align: left;
    }
    .dba-ae-opt-row input[type="number"]{
      width: 84px;
      box-sizing: border-box;
      padding: 6px 8px;
      border: 1px solid #00000055;
      border-radius: 10px;
      font-size: 1em;
      font-weight: 800;
    }

    /* ===== 装備ロスター：ロスター切替ポップアップ（ボタン近く） ===== */
    #dba-roster-switch-pop{
      position: fixed;
      z-index: 999998; /* fnbar(999999)より下 */
      display: none;
      min-width: 220px;
      max-width: min(420px, 92vw);
      max-height: min(60vh, 520px);
      overflow: auto;
      border: 2px solid #000;
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 10px 28px rgba(0,0,0,0.25);
      padding: 8px;
      box-sizing: border-box;
    }
    #dba-roster-switch-pop[data-open="1"]{ display: block; }
    .dba-rs-pop-title{
      font-weight: 900;
      margin: 0 0 6px 0;
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dba-rs-pop-btn{
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
    .dba-rs-pop-btn:hover{ filter: brightness(0.97); }
    .dba-rs-pop-btn:active{ transform: translateY(1px); }
    .dba-rs-pop-btn[data-active="1"]{
      outline: 3px solid #ea0000;
      outline-offset: 0px;
      background: #fff2f2;
    }
    .dba-rs-pop-btn--new{
      background: #cfe3ff;
    }

    /* ===== 長押しゲージ（クリック/長押しで機能分岐する時の視覚フィードバック） ===== */
    #dba-lp-gauge{
      position: fixed;
      left: 0;
      top: 0;
      width: 56px;
      height: 56px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 1000000; /* fnbar(999999)より上に出す */
      opacity: 0;
      transition: opacity 0.12s ease;
    }
    #dba-lp-gauge[data-on="1"]{ opacity: 1; }

    #dba-lp-gauge .dba-lp-gauge__ring{
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
  const LS_BR_TAIL2_KEY = 'dba.battleResult.tail2.v1'; // 戦闘結果「末尾2行のみ表示」ON/OFF
  const LS_BR_ALIGN_KEY = 'dba.battleResult.align.v1'; // left / center / right
  const LS_BR_PASS_KEY  = 'dba.battleResult.passThrough.v1'; // 0/1 クリック透過
  const LS_BR_TOP_KEY   = 'dba.battleResult.topOffsetPx.v1'; // number 上端からの距離(px)

  // トップページ「経過時間」プログレス（同期用）
  const LS_TOP_ELAPSED_PROGRESS_KEY = 'dba.topElapsedProgress.v1';
  const DBA_TOP_PROGRESS_CYCLE_MS = 60 * 60 * 1000; // 1サイクル=約1時間（ユーザー説明に基づく）
  const LS_TOP_SYNCINFO_SHOW_KEY = 'dba.topElapsedProgress.showInfo.v1'; // 0/1

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

    // --- panes root ---
    const panes = document.createElement('div');
    panes.className = 'dba-top-progress__panes';

    // --- left pane ---
    const paneL = document.createElement('div');
    paneL.className = 'dba-top-progress__paneL';

    // --- middle pane (buttons) ---
    const paneM = document.createElement('div');
    paneM.className = 'dba-top-progress__paneM';

    // ★termRow（左=期 / 中=プログレスバー / 右=ボタン）
    const termRow = document.createElement('div');
    termRow.className = 'dba-top-progress__termRow';
    const d0 = loadTopElapsedProgress();

    // 「第 xx 期」表示（span）
    const termSpan = document.createElement('span');
    termSpan.id = 'dba-top-progress-title';
    termSpan.textContent = (d0 && d0.term) ? d0.term : '第 ? 期';

    // 「今すぐ同期」ボタン
    const btnSync = document.createElement('button');
    btnSync.type = 'button';
    btnSync.id = 'dba-top-progress-sync-now';
    btnSync.className = 'dba-btn-mini';
    btnSync.textContent = '今すぐ同期';
    btnSync.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if(DBA_TOP_PROGRESS_AUTOSYNC.inFlight) return;
      fetchTopElapsedProgressFromTopPageOnce('manual').catch(()=>{});
    });

    // 「同期情報」ボタン（スイッチ）
    const btnInfo = document.createElement('button');
    btnInfo.type = 'button';
    btnInfo.id = 'dba-top-progress-sync-info';
    btnInfo.className = 'dba-btn-mini';
    btnInfo.textContent = '同期情報';
    btnInfo.dataset.on = (wrap.dataset.showinfo === '1') ? '1' : '0';
    btnInfo.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const on = (wrap.dataset.showinfo === '1') ? false : true;
      wrap.dataset.showinfo = on ? '1' : '0';
      btnInfo.dataset.on = on ? '1' : '0';
      saveTopSyncInfoShow(on);
      renderTopProgress();
    });

    const bar = document.createElement('div');
    bar.className = 'progress-bar';

    const inner = document.createElement('div');
    inner.id = 'dba-top-progress-inner';
    inner.style.width = '0%';
    inner.textContent = '0%';
    bar.appendChild(inner);

    // ★左ペイン：期 → バー（ボタンは中央ペインへ）
    termRow.appendChild(termSpan);
    termRow.appendChild(bar);

    paneL.appendChild(termRow);

    // ★中央ペイン：上から「同期情報」→「今すぐ同期」
    paneM.appendChild(btnInfo);
    paneM.appendChild(btnSync);

    // --- match progress (under term progress) ---
    const matchRow = document.createElement('div');
    matchRow.className = 'dba-top-progress__matchRow';

    const matchLabel = document.createElement('div');
    matchLabel.className = 'dba-top-progress__matchLabel';
    matchLabel.id = 'dba-top-progress-match-label';
    matchLabel.textContent = '第 1 試合／?';

    const matchRight = document.createElement('div');
    matchRight.className = 'dba-top-progress__matchRight';

    const matchTime = document.createElement('div');
    matchTime.className = 'dba-top-progress__matchTime';
    matchTime.id = 'dba-top-progress-match-time';
    matchTime.textContent = '残り時間： --分--秒';

    const matchBar = document.createElement('div');
    matchBar.className = 'progress-bar dba-match-progress';

    const matchInner = document.createElement('div');
    matchInner.id = 'dba-top-progress-match-inner';
    matchInner.style.width = '0%';
    matchInner.textContent = '0%';
    matchBar.appendChild(matchInner);

    matchRight.appendChild(matchTime);
    matchRight.appendChild(matchBar);

    matchRow.appendChild(matchLabel);
    matchRow.appendChild(matchRight);
    paneL.appendChild(matchRow);

    // --- right pane ---
    const paneR = document.createElement('div');
    paneR.className = 'dba-top-progress__paneR';

    const line1 = document.createElement('div');
    line1.className = 'dba-top-progress__infoLine';
    line1.id = 'dba-top-progress-info-sync';
    line1.textContent = '最終同期（手動＆自動）： --- 秒前';

    const line2 = document.createElement('div');
    line2.className = 'dba-top-progress__infoLine';
    line2.id = 'dba-top-progress-info-pct';
    line2.textContent = 'その時のプログレスバー： -- ％';

    const line3 = document.createElement('div');
    line3.className = 'dba-top-progress__infoLine';
    line3.id = 'dba-top-progress-info-auto';
    line3.textContent = '最終補正（自動）： --- 秒前';

    paneR.appendChild(line1);
    paneR.appendChild(line2);
    paneR.appendChild(line3);

    panes.appendChild(paneL);
    panes.appendChild(paneM);
    panes.appendChild(paneR);
    wrap.appendChild(panes);

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

  function renderTopProgress(){
    const inner = document.getElementById('dba-top-progress-inner');
    const title = document.getElementById('dba-top-progress-title');
    const btnSync = document.getElementById('dba-top-progress-sync-now');
    const btnInfo = document.getElementById('dba-top-progress-sync-info');
    const wrap = document.getElementById('dba-top-progress');
    const infoSync = document.getElementById('dba-top-progress-info-sync');
    const infoPct  = document.getElementById('dba-top-progress-info-pct');
    const infoAuto = document.getElementById('dba-top-progress-info-auto');
    const matchLabel = document.getElementById('dba-top-progress-match-label');
    const matchTime  = document.getElementById('dba-top-progress-match-time');
    const matchInner = document.getElementById('dba-top-progress-match-inner');

    if(!inner) return;

    const pct = estimateTopElapsedProgressPct();
    inner.style.width = `${pct}%`;
    inner.textContent = `${pct}%`;

    // ===== 期内の「試合番号」&「1試合内進捗」 =====
    try{
      const spec = getMatchSpecByMode();
      const totalMatches = spec.totalMatches;
      const matchSec = spec.matchSec;

      // 期(=3600s)の中の経過秒
      const pctF = estimateTopElapsedProgressPctFloat(); // 0..100未満
      const totalSec = (pctF / 100) * 60 * 60; // 0..3600

      // 境界（ちょうどの時）を「前の試合の100%」として扱う
      const eps = 0.001; // 1ms相当（十分小さく）
      let t = totalSec;
      let boundary = false;
      if(t > 0){
        const mod = t % matchSec;
        if(mod < eps || (matchSec - mod) < eps){
          boundary = true;
        }
      }

      let matchNo = 1;
      let inSec = 0;
      if(pctF >= 99.999){ // 期末付近は最後の試合100%に寄せる
        matchNo = totalMatches;
        inSec = matchSec;
      }else if(boundary){
        const t2 = Math.max(0, t - eps);
        matchNo = Math.floor(t2 / matchSec) + 1;
        inSec = matchSec;
      }else{
        matchNo = Math.floor(t / matchSec) + 1;
        inSec = t - (Math.floor(t / matchSec) * matchSec);
      }

      // clamp
      matchNo = clampInt(matchNo, 1, totalMatches);
      inSec = Math.max(0, Math.min(matchSec, inSec));

      // 残り時間（試合終了まで）
      const remainSec = Math.max(0, Math.min(matchSec, (matchSec - inSec)));
      const m = Math.floor(remainSec / 60);
      const s = Math.floor(remainSec % 60);
      const matchPct = (matchSec <= 0) ? 0 : Math.max(0, Math.min(100, (inSec / matchSec) * 100));

      if(matchLabel){
        matchLabel.textContent = `第 ${matchNo} 試合／${totalMatches}`;
      }
      if(matchTime){
        matchTime.textContent = `残り時間： ${m}分${s}秒 （およそ±20秒？の誤差あり）`;
      }
      if(matchInner){
        const mp = Math.floor(matchPct);
        matchInner.style.width = `${mp}%`;
        matchInner.textContent = `${mp}%`;
      }
    }catch(_e){}

    // 期（第 xxxx 期）表示を最新保存値で更新
    if(title){
      const d0 = loadTopElapsedProgress();
      title.textContent = (d0 && d0.term) ? d0.term : '第 ? 期';
    }

    // 「今すぐ同期」ボタン状態
    if(btnSync){
      const inflight = !!DBA_TOP_PROGRESS_AUTOSYNC.inFlight;
      btnSync.disabled = inflight;
      btnSync.textContent = inflight ? '同期中…' : '今すぐ同期';
    }

    // 「同期情報」スイッチ状態（見た目だけ同期）
    if(btnInfo && wrap){
      const on = (wrap.dataset.showinfo === '1');
      btnInfo.dataset.on = on ? '1' : '0';
    }

    // 右ペイン（同期情報）更新
    const data = loadTopElapsedProgress();
    const now = Date.now();
    if(infoSync){
      if(!data){
        infoSync.textContent = '最終同期（手動＆自動）： --- 秒前';
      }else{
        const sec = Math.floor(Math.max(0, now - data.fetchedAt) / 1000);
        infoSync.textContent = `最終同期（手動＆自動）： ${sec} 秒前`;
      }
    }
    if(infoPct){
      if(!data){
        infoPct.textContent = 'その時のプログレスバー： -- ％';
      }else{
        infoPct.textContent = `その時のプログレスバー： ${clampInt(data.pct, 0, 100)} ％`;
      }
    }
    if(infoAuto){
      if(DBA_TOP_PROGRESS_AUTOSYNC.lastAutoAt > 0){
        const sec = Math.floor(Math.max(0, now - DBA_TOP_PROGRESS_AUTOSYNC.lastAutoAt) / 1000);
        infoAuto.textContent = `最終補正（自動）： ${sec} 秒前`;
      }else{
        infoAuto.textContent = '最終補正（自動）： --- 秒前';
      }
    }
    // progress内容で高さが変わる可能性があるため、fnbar高さを再同期
    try{ scheduleFnbarHeightSync(); }catch(_e){}
  }

  // =========================
  // トップページ進捗：自動補正（裏でトップページを1回だけfetch）
  // 条件：
  //  - 未同期の場合：ページロード後に1回だけ自動fetch
  //  - 進捗を 60分換算したときに 8/18/28/38/48/58 分のとき：その分境で1回だけ自動fetch
  // =========================
  const DBA_TOP_PROGRESS_TARGET_MINUTES = new Set([8, 18, 28, 38, 48, 58]);
  const DBA_TOP_PROGRESS_AUTOSYNC = {
    inFlight: false,
    doneAt: 0,
    lastMinute: -1,
    lastAutoAt: 0 // 最終補正（自動）専用
  };

  function pctToMinute(pct){
    // 0..100% -> 0..59分（floor）
    const p = Math.max(0, Math.min(100, Number(pct)));
    const m = Math.floor((p / 100) * 60);
    return clampInt(m, 0, 59);
  }

  async function fetchTopElapsedProgressFromTopPageOnce(reason){
    if(DBA_TOP_PROGRESS_AUTOSYNC.inFlight) return false;
    DBA_TOP_PROGRESS_AUTOSYNC.inFlight = true;
    try{
      // メタ表示を更新（見た目だけ）
      try{ renderTopProgress(); }catch(_e){}

      const res = await fetch('https://donguri.5ch.net/', {
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

      saveTopElapsedProgress(pct, term);
      DBA_TOP_PROGRESS_AUTOSYNC.doneAt = Date.now();
      // manual 以外は「自動補正」としても記録
      if(String(reason || '') !== 'manual'){
        DBA_TOP_PROGRESS_AUTOSYNC.lastAutoAt = DBA_TOP_PROGRESS_AUTOSYNC.doneAt;
      }

      // 反映
      try{ renderTopProgress(); }catch(_e){}
      return true;
    }catch(_e){
      return false;
    }finally{
      DBA_TOP_PROGRESS_AUTOSYNC.inFlight = false;
      // reason はログ用途（必要なら dbgLog に流してもOK）
      void reason;
    }
  }

  function maybeAutoSyncTopProgress(){
    // まだコンテナが無い/表示不要なら何もしない
    if(!document.getElementById('dba-top-progress-inner')) return;

    const data = loadTopElapsedProgress();
    const pct = estimateTopElapsedProgressPct();
    const minute = pctToMinute(pct);

    // (A) 未同期：1回だけ自動補正
    if(!data){
      if(DBA_TOP_PROGRESS_AUTOSYNC.doneAt === 0 && !DBA_TOP_PROGRESS_AUTOSYNC.inFlight){
        fetchTopElapsedProgressFromTopPageOnce('unsynced').catch(()=>{});
      }
      return;
    }

    // (B) 分境（8/18/…/58分）に来たら、その分境で1回だけ自動補正
    //  - 同じ minute が続く間は繰り返さない
    if(DBA_TOP_PROGRESS_TARGET_MINUTES.has(minute) && minute !== DBA_TOP_PROGRESS_AUTOSYNC.lastMinute){
      DBA_TOP_PROGRESS_AUTOSYNC.lastMinute = minute;
      fetchTopElapsedProgressFromTopPageOnce(`minute=${minute}`).catch(()=>{});
    }
  }

  let DBA_TOP_PROGRESS_TID = 0;
  function startTopProgressTicker(){
    if(DBA_TOP_PROGRESS_TID) return;
    // 初回描画
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
      return true;
    }catch(_e){
      return false;
    }
  }

  const DEFAULT_SETTINGS = {
    scale: { rb: 100, hc: 100, l: 100 },
    layer: { textOpacity: 100 } // 0〜100（レイヤー文字濃度）
  };

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

  function loadBattleResultTopOffsetPx(){
    try{
      const raw = localStorage.getItem(LS_BR_TOP_KEY);
      // 未設定は現状のフロート既定値(480px)に合わせる
      if(raw == null) return 480;
      const n = Number.parseInt(raw, 10);
      if(!Number.isFinite(n)) return 480;
      return clampInt(n, 0, 2000);
    }catch(_e){
      return 480;
    }
  }

  function saveBattleResultTopOffsetPx(px){
    const n = clampInt(px, 0, 2000);
    try{ localStorage.setItem(LS_BR_TOP_KEY, String(n)); }catch(_e){}
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
      return obj;
    }catch(_e){
      return {};
    }
  }

  function saveAutoEquipCandidates(obj){
    try{
      const { store, roster } = getActiveRoster();
      const ae = ensureRosterAutoEquipBlock(roster);
      ae.candidates = (obj && typeof obj === 'object') ? obj : {};
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

  function loadAutoEquipNotifyAutoCloseSec(){
    try{
      const raw = localStorage.getItem(LS_AUTO_EQUIP_NOTIFY_AUTOCLOSE_SEC_KEY);
      if(raw == null) return 2; // デフォルト 2 秒
      const n = Number.parseInt(raw, 10);
      if(!Number.isFinite(n)) return 2;
      return clampInt(n, 1, 60);
    }catch(_e){
      return 2;
    }
  }

  function saveAutoEquipNotifyAutoCloseSec(sec){
    const n = clampInt(sec, 1, 60);
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

  function getTeamChallengeUrl(){
    return `https://donguri.5ch.net/teamchallenge?m=${mode}`;
  }

  async function rapidAttackAt(row, col){
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
      openBattleResultModalWithNode(bodyText || '結果を表示できませんでした。', 'ラピッド攻撃');
      return;
    }

    const doc = new DOMParser().parseFromString(bodyText, 'text/html');
    const block = extractBattleResultBlock(doc);
    if(block){
      const text = (doc.body && doc.body.innerText) ? doc.body.innerText : sanitizeText(block.textContent || '');
      openBattleResultModalWithNode(text || '結果を表示できませんでした。', 'ラピッド攻撃');
      return;
    }
    openBattleResultModalWithNode((doc.body && doc.body.innerText) ? doc.body.innerText : '結果を表示できませんでした。', 'ラピッド攻撃');
  }

  function clampInt(n, min, max){
    const x = Number.parseInt(n, 10);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
  }

  function sanitizeScale(v){
    // 指定範囲外や不正値は 100 に戻す
    const x = Number.parseInt(v, 10);
    if (!Number.isFinite(x)) return 100;
    if (x < 100 || x > 200) return 100;
    return x;
  }

  function sanitizeOpacity(v){
    const x = Number.parseInt(v, 10);
    if(!Number.isFinite(x)) return 100;
    if(x < 0) return 0;
    if(x > 100) return 100;
    return x;
  }

  function loadSettings(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(!raw) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      const obj = JSON.parse(raw);
      const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      if(obj && obj.scale){
        for(const k of ['rb','hc','l']){
          out.scale[k] = sanitizeScale(obj.scale[k]);
        }
      }
      if(obj && obj.layer){
        out.layer.textOpacity = sanitizeOpacity(obj.layer.textOpacity);
      }
      return out;
    }catch(_e){
      return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
  }

  function saveSettings(s){
    try{
      const out = {
        scale: { rb: sanitizeScale(s?.scale?.rb), hc: sanitizeScale(s?.scale?.hc), l: sanitizeScale(s?.scale?.l) },
        layer: { textOpacity: sanitizeOpacity(s?.layer?.textOpacity) }
      };
      localStorage.setItem(LS_KEY, JSON.stringify(out));
    }catch(_e){}
  }

  function getModeLabel(m){
    if(m === 'rb') return 'レッドvsブルーモード';
    if(m === 'hc') return 'ハードモード';
    if(m === 'l') return 'ラダーモード';
    return m;
  }

  function applyScaleToGrid(scalePct){
    const grid = document.querySelector('.grid');
    if(!grid) return false;

    const s = sanitizeScale(scalePct);
    const scale = s / 100;

    // grid-template-columns / rows を更新（repeat(n, 35px) の px を拡大）
    const gtc = grid.style.gridTemplateColumns || '';
    const gtr = grid.style.gridTemplateRows || '';
    const m1 = gtc.match(/repeat\(\s*(\d+)\s*,\s*(\d+)px\s*\)/);
    const m2 = gtr.match(/repeat\(\s*(\d+)\s*,\s*(\d+)px\s*\)/);

    if(m1){
      const n = Number(m1[1]);
      const base = Number(m1[2]);
      const px = Math.max(1, Math.round(base * scale));
      grid.style.gridTemplateColumns = `repeat(${n}, ${px}px)`;
    }
    if(m2){
      const n = Number(m2[1]);
      const base = Number(m2[2]);
      const px = Math.max(1, Math.round(base * scale));
      grid.style.gridTemplateRows = `repeat(${n}, ${px}px)`;
    }

    // 各セルサイズ（ページ側で inline 指定されても上書き）
    const cellPx = Math.max(1, Math.round(30 * scale));
    for(const el of grid.querySelectorAll('.cell')){
      el.style.width = cellPx + 'px';
      el.style.height = cellPx + 'px';
    }

    scheduleBattlemapLayerSync();
    return true;
  }

  function applyScaleToCanvasWrap(scalePct){
    const wrap = document.getElementById('gridWrap');
    if(!wrap) return false;
    const s = sanitizeScale(scalePct);
    const scale = s / 100;
    wrap.style.transformOrigin = 'left top';
    wrap.style.transform = `scale(${scale})`;
    scheduleBattlemapLayerSync();
    return true;
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

    // 長押し（0.4秒）
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

    // iOS Safari 対策：touch と pointer の二重発火を抑止
    let lastTouchAt = 0;

    function onPointerDown(evt){
      if(evt.type === 'touchstart') lastTouchAt = Date.now();
      if(evt.type === 'pointerdown' && (Date.now() - lastTouchAt) < 800) return;

      // 既存ハンドラを無効化
      evt.preventDefault();
      evt.stopImmediatePropagation();

      lpFired = false;
      clearLP();
      lpCtx = calcRC(evt);
      if(!lpCtx) return;

      // 「クリック/長押し」分岐はオート装備ONの時だけ意味があるので、その時だけ表示
      if(loadAutoEquipEnabled()){
        longPressGaugeStart(lpCtx.x, lpCtx.y, LP_MS);
      }
      lpTimer = setTimeout(async () => {
        lpFired = true;
        try{
          if(loadAutoEquipEnabled()){
            longPressGaugeComplete();
            await handleAutoEquipLongPress(lpCtx.r, lpCtx.c, lpCtx.x, lpCtx.y);
          }
        }catch(_e){
          // noop
        }
      }, LP_MS);
    }

    function onPointerUp(evt){
      if(evt.type === 'touchend') lastTouchAt = Date.now();
      if(evt.type === 'pointerup' && (Date.now() - lastTouchAt) < 800) return;

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
    // iOS Safari 用（passive:false が重要）
    overlay.addEventListener('touchstart', onPointerDown, { capture:true, passive:false });
    overlay.addEventListener('touchend', onPointerUp, { capture:true, passive:false });
    overlay.addEventListener('touchcancel', (e)=>{ clearLP(); }, { capture:true, passive:false });
    // ★重要：一部環境で pointer で止めても click が別途発火してページ側ハンドラが動く事があるため、
    //        click を capture で確実に遮断する（遷移/既存処理の暴発を防ぐ）
    overlay.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopImmediatePropagation();
    }, true);
    return true;
  }

  // =========================
  // セル詳細モーダル（セルクリックで表示）
  //  - 詳細ページ: https://donguri.5ch.net/teambattle?r={row}&c={col}&m={mode}
  //  - <header> の次にある <table> を抽出して表示
  //  - table内の form（「エリアに挑む」「アリーナを強化する」「アリーナを弱体化する」等）はそのまま機能
  // =========================
  // セル詳細：多重open防止（同一セルの二重起動・close直後の再ポップ抑止）
  const DBA_CELL_DETAIL_GUARD = {
    inFlight: false,    // openCellDetailModal の fetch〜show 中
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

    // ★重要：セル詳細内の form submit（例：「エリアに挑む」）を捕捉して遷移抑止 → 戦闘結果モーダル表示
    // - capture で先に止める
    dlg.addEventListener('submit', (e) => {
      const form = e.target;
      if(!(form instanceof HTMLFormElement)) return;
      // セル詳細ボックス配下の form だけ対象
      if(!box.contains(form)) return;

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
    applyBattleResultOptionsToFloat(); // 位置など（透過機能に紐づけない）
  }

  function closeBattleResultFloatPanel(){
    const root = document.getElementById('dba-br-float');
    if(!root) return;
    root.dataset.open = '0';
  }

  function applyBattleResultOptionsToFloat(){
    const root = document.getElementById('dba-br-float');
    if(!root) return;

    // 上端からの距離（fnbar の下 + 指定px）
    const topPx = loadBattleResultTopOffsetPx();
    root.style.top = `calc(var(--dba-fn-height) + ${topPx}px)`;

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
    tail2.className = 'dba-br-tail2-chk';
    tail2.id = 'dba-br-opt-tail2-wrap';
    const tail2Chk = document.createElement('input');
    tail2Chk.type = 'checkbox';
    tail2Chk.id = 'dba-br-opt-tail2';
    const tail2Text = document.createElement('span');
    tail2Text.textContent = '末尾2行のみ表示';
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

    mid.appendChild(placeWrap);

    // (3) クリック透過
    const passWrap = document.createElement('label');
    passWrap.className = 'dba-br-tail2-chk';
    passWrap.id = 'dba-br-opt-pass-wrap';
    passWrap.style.marginTop = '12px';

    const passChk = document.createElement('input');
    passChk.type = 'checkbox';
    passChk.id = 'dba-br-opt-pass';
    const passText = document.createElement('span');
    passText.textContent = '「Close」「オプション」ボタン以外はクリック判定を透過';
    passWrap.appendChild(passChk);
    passWrap.appendChild(passText);
    mid.appendChild(passWrap);

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
    const align = loadBattleResultAlign();
    for(const r of Array.from(dlg.querySelectorAll('input[type="radio"][name="dba-br-opt-align"]'))){
      r.checked = (r.value === align);
    }
    const topInp = dlg.querySelector('#dba-br-opt-top');
    if(topInp) topInp.value = String(loadBattleResultTopOffsetPx());

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
    const align = loadBattleResultAlign();
    for(const r of Array.from(dlg.querySelectorAll('input[type="radio"][name="dba-br-opt-align"]'))){
      r.checked = (r.value === align);
    }
    const topInp = dlg.querySelector('#dba-br-opt-top');
    if(topInp) topInp.value = String(loadBattleResultTopOffsetPx());

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
      const pre = document.cr
      eateElement('div');
      pre.className = 'dba-battle-result-text';
      pre.textContent = '結果を表示できませんでした。';
      box.appendChild(pre);
    }
    // passThrough OFF：従来通り dialog で表示
    try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
    // ★battle-result を表示しても、オプションが開いているなら必ずオプションを最前面へ
    bringBattleResultOptionsModalToFront();
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

  function openRosterResultModalWithNode(nodeOrText, titleText){
    buildRosterResultModal();
    const dlg = document.getElementById('dba-m-roster-result');
    const box = document.getElementById('dba-roster-result-box');
    const title = dlg ? dlg.querySelector('.dba-modal__title') : null;
    if(!dlg || !box) return;
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
      openBattleResultModalWithNode(bodyText || '結果を表示できませんでした。', '戦闘結果');
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
        openBattleResultModalWithNode((doc.body && doc.body.innerText) ? doc.body.innerText : '結果を表示できませんでした。', '戦闘結果');
        return;
      }

      // できるだけ「結果本文」っぽく見せるため、imported をテキスト表示に寄せる（縦長にも対応）
      // （DOMそのまま表示が崩れる場合があるので、まずはテキストで確実に見せる）
      openBattleResultModalWithNode((doc.body && doc.body.innerText) ? doc.body.innerText : imported.textContent, '戦闘結果');
      return;
    }

    openBattleResultModalWithNode((doc.body && doc.body.innerText) ? doc.body.innerText : '結果を表示できませんでした。', '戦闘結果');
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
        const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&m=${mode}`;
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

    function onDown(evt){
      if(mode === 'rb') return;

      if(evt.type === 'touchstart') lastTouchAt = Date.now();
      if(evt.type === 'pointerdown' && (Date.now() - lastTouchAt) < 800) return;

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

      // 「クリック/長押し」分岐はオート装備ONの時だけ意味があるので、その時だけ表示
      if(loadAutoEquipEnabled()){
        longPressGaugeStart(lpCtx.x, lpCtx.y, LP_MS);
      }
      lpTimer = setTimeout(async () => {
        lpFired = true;
        try{
          if(loadAutoEquipEnabled()){
            longPressGaugeComplete();
            await handleAutoEquipLongPress(lpCtx.r, lpCtx.c, lpCtx.x, lpCtx.y);
          }
        }catch(_e){
          // noop
        }
      }, LP_MS);
    }

    function onUp(evt){
      if(mode === 'rb') return;

      if(evt.type === 'touchend') lastTouchAt = Date.now();
      if(evt.type === 'pointerup' && (Date.now() - lastTouchAt) < 800) return;

      const rc = lpCtx ? { r: lpCtx.r, c: lpCtx.c } : getRCFromEvent(evt);
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
      // DBA側のセル操作が有効な時のみ “遷移” を潰す（通常時のページ既定挙動は残す）
      if(!loadAutoEquipEnabled() && !loadRapidAttackEnabled()) return;
      evt.preventDefault();
      evt.stopImmediatePropagation();
    }, true);
  }

  // =========================
  // バトルマップ透明レイヤー
  // =========================
  let dbaLayerInited = false;
  let dbaLayerRAF = 0;
  let dbaLayerLastKey = '';
  let dbaLayerResizeObs = null;
  let dbaLayerMutObs = null;

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
    grid.textContent = '';
    const frag = document.createDocumentFragment();
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const cell = document.createElement('div');
        cell.className = 'dba-layer-cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        const content = document.createElement('div');
        content.className = 'dba-layer-cell__content';
        content.textContent = ''; // 将来：ここに文字列/絵文字を配置
        cell.appendChild(content);
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
      gap: cs.gap || `${cs.rowGap || '0px'} ${cs.columnGap || '0px'}`
    };
  }

  function syncBattlemapLayer(){
    const root = document.getElementById('dba-battlemap-layer');
    const grid = document.getElementById('dba-battlemap-layer-grid');
    if(!root || !grid) return false;

    let target = null;
    let spec = null;

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

    const rect = target.getBoundingClientRect();
    // rectがゼロのときはまだ描画途中
    if(rect.width <= 1 || rect.height <= 1) return false;

    // 位置・サイズ追従（position:fixed）
    root.style.left = rect.left + 'px';
    root.style.top = rect.top + 'px';
    root.style.width = rect.width + 'px';
    root.style.height = rect.height + 'px';

    // グリッド仕様追従
    grid.style.gridTemplateColumns = spec.gtc;
    grid.style.gridTemplateRows = spec.gtr;
    grid.style.gap = spec.gap;

    const key = `${mode}:${spec.rows}x${spec.cols}:${spec.gtc}|${spec.gtr}|${spec.gap}`;
    if(key !== dbaLayerLastKey){
      dbaLayerLastKey = key;
      rebuildLayerCells(spec.rows, spec.cols);
    }

    return true;
  }

  function scheduleBattlemapLayerSync(){
    if(dbaLayerRAF) return;
    dbaLayerRAF = requestAnimationFrame(() => {
      dbaLayerRAF = 0;
      syncBattlemapLayer();
    });
  }

  function initBattlemapLayer(){
    if(dbaLayerInited) return;
    dbaLayerInited = true;

    // bodyが無い可能性を考慮
    const start = () => {
      ensureBattlemapLayerDOM();
      // 初期値反映（文字濃度）
      const s = loadSettings();
      applyLayerTextOpacity(s.layer.textOpacity);

      // まず同期
      scheduleBattlemapLayerSync();

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
      dbaLayerMutObs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    };

    if(document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  }

  function applyCurrentModeScale(){
    const settings = loadSettings();
    applyLayerTextOpacity(settings.layer.textOpacity);
    if(mode === 'rb'){
      applyScaleToCanvasWrap(settings.scale.rb);
      ensureRbPointerFix();
      scheduleBattlemapLayerSync();
      return;
    }
    if(mode === 'hc'){
      applyScaleToGrid(settings.scale.hc);
      scheduleBattlemapLayerSync();
      return;
    }
    if(mode === 'l'){
      applyScaleToGrid(settings.scale.l);
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
  //  [SSR]まで                    -> --SSR
  //  [R]から[SSR]まで             -> R-SSR
  //  [SSR]だけ|[エリート]         -> SSR.エ
  //  [R]まで|[警備員]だけ         -> --R.警
  //  [SSR]だけ|[警備員]だけ|[エリート] -> SSR.警エ
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
      if(hasGuard && hasElite) out += '.警エ';
      else if(hasGuard) out += '.警';
      else if(hasElite) out += '.エ';
      return out;
    }

    // - 「まで」
    m = src.match(/\[(N|R|SR|SSR|UR)\]\s*まで/);
    if(m){
      let out = `--${m[1]}`;
      if(hasGuard && hasElite) out += '.警エ';
      else if(hasGuard) out += '.警';
      else if(hasElite) out += '.エ';
      return out;
    }

    // - 「～から～まで」
    m = src.match(/\[(N|R|SR|SSR|UR)\]\s*から\s*\[(N|R|SR|SSR|UR)\]\s*まで/);
    if(m){
      let out = `${m[1]}-${m[2]}`;
      if(hasGuard && hasElite) out += '.警エ';
      else if(hasGuard) out += '.警';
      else if(hasElite) out += '.エ';
      return out;
    }

    // 想定外フォーマットは、最低限の整形だけして返す（デバッグしやすくする）
    // 例：未知の表現が来ても "空" にはしない
    return src0;
  }

  // =========================
  // オート装備（レギュレーション → 候補キー）
  //  - simplifyRegulationText() の出力（例：N / --SSR / R-UR.警エ）を受け取る前提
  //  - 上限レアリティ + 特殊サフィックス（.エ / .警 / .警エ）で候補キーを決める
  // =========================
  function mapRegToAutoEquipKey(reg){
    const s0 = sanitizeText(reg || '');
    if(!s0 || s0 === '---') return '';
    let s = s0;

    // 特殊サフィックス
    let suffix = '';
    if(s.includes('.警エ')){
      suffix = '.警エ';
      s = s.replace('.警エ','');
    }else if(s.includes('.警')){
      suffix = '.警';
      s = s.replace('.警','');
    }else if(s.includes('.エ')){
      suffix = '.エ';
      s = s.replace('.エ','');
    }

    // 上限レアリティ
    // --R / R / N-R / R-SR など
    let top = '';
    if(s.startsWith('--')){
      top = s.slice(2);
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
    return `${top}${suffix}`;
  }

  function getAutoEquipCandidatesForReg(reg){
    const key = mapRegToAutoEquipKey(reg);
    if(!key) return { key:'', list: [] };
    const store = loadAutoEquipCandidates();
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
    if(rect.bottom > vh - 8) ny -= (rect.bottom - (vh - 8));
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

    openRosterResultModalWithNode(`装備切替中…\n${nm}`, 'オート装備');
    try{
      await equipPresetByName(nm);
      saveAutoEquipLastPreset(nm);
      openRosterResultModalWithNode(`装備切替完了\n${nm}`, 'オート装備');
    }catch(_e){
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
    try{
      const d = await fetchCellDetail(row, col);
      reg = d?.reg || '';
    }catch(_e){
      reg = '';
    }
    const { key, list } = getAutoEquipCandidatesForReg(reg);

    pop.textContent = '';
    const ttl2 = document.createElement('div');
    ttl2.className = 'dba-ae-pop-title';
    ttl2.textContent = key ? `装備候補：${key}` : '装備候補';
    pop.appendChild(ttl2);

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
  // 保存データ世代（Gen1/Gen2）
  //  - Gen1: ロスター保存とオート装備保存を別管理
  //  - Gen2: ロスター内に autoEquip を内包して統合保存
  // =========================
  const DBA_SAVE_GEN_CURRENT = 2; // 現行フォーマット（Gen2）

  function normalizeGenValue(v){
    const n = Number.parseInt(v, 10);
    if(!Number.isFinite(n)) return 1;
    if(n <= 1) return 1;
    return 2;
  }

  function detectStoreGen(store){
    // gen が明示されていればそれを採用
    if(store && typeof store === 'object' && ('gen' in store)){
      return normalizeGenValue(store.gen);
    }
    // 明示が無い場合は内容から推定：
    // roster に autoEquip が1つでもあれば Gen2 とみなす
    try{
      const rosters = store && store.rosters ? store.rosters : {};
      for(const id of Object.keys(rosters || {})){
        const r = rosters[id];
        if(r && typeof r === 'object' && r.autoEquip && typeof r.autoEquip === 'object'){
          return 2;
        }
      }
    }catch(_e){}
    return 1;
  }

  // teambattle起動時に呼ぶ：Gen1→Gen2 自動移行
  function migrateSaveDataToGen2IfNeeded(){
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

      // ---- Gen1 → Gen2 へ移行 ----
      store.gen = DBA_SAVE_GEN_CURRENT;
      store.rosters = (store.rosters && typeof store.rosters === 'object') ? store.rosters : {};

      // 1) すべてのロスターに autoEquip ブロックを生やす
      for(const id of Object.keys(store.rosters)){
        const r = store.rosters[id];
        if(!r || typeof r !== 'object') continue;
        ensureRosterAutoEquipBlock(r);
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
          store.rosters[activeId] = rAct;
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
    const vh = window.innerHeight || document.documentElement.clientHeight || 600;

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
    if(r2.bottom > vh - 8) ny -= (r2.bottom - (vh - 8));
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
  function nowIso(){ try{ return new Date().toISOString(); }catch(_e){ return ''; } }

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

  function overwriteRosterFromObject(obj){
    // バックアップ用：active roster の全体を上書き（最低限 title/presets を使用）
    const { store, roster } = getActiveRoster();
    if(!obj || typeof obj !== 'object') throw new Error('Invalid JSON object');
    const inGen = ('gen' in obj) ? normalizeGenValue(obj.gen) : 1; // gen無しは Gen1 とみなす
    const title = sanitizeText(obj.title || roster.title);
    const presets = (obj.presets && typeof obj.presets === 'object') ? obj.presets : {};
    // ★オート装備（任意）：無ければ既存維持
    const aeIn = (obj.autoEquip && typeof obj.autoEquip === 'object') ? obj.autoEquip : null;
    const aeCandidates = (aeIn && aeIn.candidates && typeof aeIn.candidates === 'object') ? aeIn.candidates : null;
    const aeLast = (aeIn && typeof aeIn.lastPreset === 'string') ? aeIn.lastPreset : null;
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

    // ★Gen2：autoEquip が入っていれば復元
    // ★Gen1：autoEquip が無い想定。空の autoEquip を確保しつつ、旧LSが残っていれば統合する
    try{
      const ae = ensureRosterAutoEquipBlock(roster);
      if(aeCandidates) ae.candidates = aeCandidates;
      if(aeLast != null) ae.lastPreset = String(aeLast || '');
      roster.autoEquip = ae;

      if(inGen <= 1){
        // 旧バックアップ（Gen1）で、かつ旧LSが残っている場合は active roster に統合
        // （“保存データ世代”を上げる要件に合わせる）
        migrateSaveDataToGen2IfNeeded();
      }
    }catch(_e){}

    roster.updatedAt = nowIso();
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
      return createRosterIfNeeded();
    }
    // 1つも無ければ新規作成
    store.activeId = null;
    store.rosters = {};
    saveRosterStore(store);
    return createRosterIfNeeded();
  }

  function setPreset(name, triple){
    const { store, roster } = getActiveRoster();
    const n = sanitizeText(name);
    if(!n) throw new Error('プリセット名が空です');
    if(!Array.isArray(triple) || triple.length !== 3) throw new Error('Invalid preset triple');
    roster.presets = roster.presets || {};
    roster.presetOrder = Array.isArray(roster.presetOrder) ? roster.presetOrder : [];
    const existed = !!(roster.presets && Object.prototype.hasOwnProperty.call(roster.presets, n));
    roster.presets[n] = [
      (triple[0] === null) ? null : Number(triple[0]),
      (triple[1] === null) ? null : Number(triple[1]),
      (triple[2] === null) ? null : Number(triple[2])
    ];
    // 既存プリセットを上書きする場合は順序は維持、新規だけ末尾追加
    if(!existed){
      roster.presetOrder.push(n);
    }
    roster.updatedAt = nowIso();
    store.rosters[store.activeId] = roster;
    saveRosterStore(store);
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
      return true;
    }
    return false;
  }

  function presetMetaText(triple){
    const w = (triple && triple[0] != null) ? `W:${triple[0]}` : 'W:-';
    const a = (triple && triple[1] != null) ? `A:${triple[1]}` : 'A:-';
    const n = (triple && triple[2] != null) ? `N:${triple[2]}` : 'N:-';
    return `${w} ${a} ${n}`;
  }

  async function equipById(id){
    if(id == null) return true;
    const url = `https://donguri.5ch.net/equip/${Number(id)}`;
    const res = await fetch(url, { method:'GET', credentials:'include', cache:'no-store' });
    if(!res.ok) throw new Error(`equip failed: ${res.status}`);
    return true;
  }

  async function equipPresetByName(name){
    const { roster } = getActiveRoster();
    const n = sanitizeText(name);
    const triple = roster && roster.presets ? roster.presets[n] : null;
    if(!triple) throw new Error('preset not found');
    // 順番：武器→防具→首
    await equipById(triple[0]);
    await equipById(triple[1]);
    await equipById(triple[2]);
    // ★「現在装備中として扱うプリセット名」を保存（オート装備の判定に使う）
    saveCurrentPresetName(n);
    return true;
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
    btnX.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeDirect(); });
    btnClose.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeDirect(); });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeDirect(); });
  }

  function renderRosterModalState(selectedPresetName){
    const box = document.getElementById('dba-roster-box');
    if(!box) return;
    const { roster } = getActiveRoster();
    const title = roster ? roster.title : '装備ロスター';
    const presets = roster && roster.presets ? roster.presets : {};
    // 削除モード（「削除」→対象選択 方式）
    const rosterDlg = document.getElementById('dba-m-roster');
    const delMode = !!(rosterDlg && rosterDlg.dataset.dbaDelMode === '1');
    // 再編集モード（「再編集」→対象選択 方式）
    const editMode = !!(rosterDlg && rosterDlg.dataset.dbaEditMode === '1');
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

    const btnRename = document.createElement('button');
    btnRename.type = 'button';
    btnRename.className = 'dba-btn-mini';
    btnRename.textContent = '名前変更';

    const btnWipe = document.createElement('button');
    btnWipe.type = 'button';
    btnWipe.className = 'dba-btn-mini dba-btn-mini--danger';
    btnWipe.textContent = '全削除';

    const btnBackup = document.createElement('button');
    btnBackup.type = 'button';
    btnBackup.className = 'dba-btn-mini';
    btnBackup.textContent = 'バックアップ';

    headBtns.appendChild(btnRename);
    headBtns.appendChild(btnWipe);
    headBtns.appendChild(btnBackup);

    head.appendChild(headTitle);
    head.appendChild(headBtns);
    box.appendChild(head);

    // 2段目：追加/削除
    const row2 = document.createElement('div');
    row2.className = 'dba-roster-row2';

    const btnAdd = document.createElement('button');
    btnAdd.type = 'button';
    btnAdd.className = 'dba-btn-mini dba-btn-mini--ok';
    btnAdd.textContent = '追加';

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
    row2.appendChild(btnEdit);
    row2.appendChild(btnSort);

    const btnAuto = document.createElement('button');
    btnAuto.type = 'button';
    btnAuto.className = 'dba-btn-mini';
    btnAuto.textContent = '自動候補登録';

    row2.appendChild(btnAuto);
    row2.appendChild(btnDel);
    box.appendChild(row2);

    // リスト
    const list = document.createElement('div');
    list.className = 'dba-roster-list';
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
        item.dataset.selected = (!delMode && (nm === selectedPresetName)) ? '1' : '0';

        const n = document.createElement('div');
        n.className = 'dba-roster-item__name';
        n.textContent = nm;

        const m = document.createElement('div');
        m.className = 'dba-roster-item__meta';
        m.textContent = presetMetaText(triple);

        item.appendChild(n);
        item.appendChild(m);

        item.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
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

          // 通常：クリック＝選択 + 装備適用
          renderRosterModalState(nm);
          try{
            // 装備ロスター専用の結果モーダルで表示
            openRosterResultModalWithNode(`装備切替中…\n${nm}\n${presetMetaText(presets[nm])}`, '装備ロスター');
            await equipPresetByName(nm);
            openRosterResultModalWithNode(`装備切替完了\n${nm}`, '装備ロスター');
          }catch(_e2){
            openRosterResultModalWithNode(`装備切替に失敗しました\n${nm}`, '装備ロスター');
          }
        });

        list.appendChild(item);
      }
    }
    box.appendChild(list);

    // --- handlers ---
    btnRename.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if(rosterDlg) rosterDlg.dataset.dbaDelMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaEditMode = '0';
      openRosterRenameModal(title, (newName) => {
        setRosterTitle(newName);
        renderRosterModalState(selectedPresetName || null);
      });
    });

    btnWipe.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if(rosterDlg) rosterDlg.dataset.dbaDelMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaEditMode = '0';
      openRosterWipeModal(() => {
        deleteActiveRosterAndSwitch();
        renderRosterModalState(null);
      });
    });

    btnBackup.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if(rosterDlg) rosterDlg.dataset.dbaDelMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaEditMode = '0';
      openRosterBackupModal(() => {
        renderRosterModalState(selectedPresetName || null);
      });
    });

    btnAdd.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if(rosterDlg) rosterDlg.dataset.dbaDelMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaEditMode = '0';
      openRosterAddPresetModal(() => {
        renderRosterModalState(null);
      });
    });

    btnEdit.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      // 「再編集」→「対象選択」へ切り替え
      if(!rosterDlg) return;
      // 再編集モードに入るときは削除モードをOFF（誤操作防止）
      rosterDlg.dataset.dbaDelMode = '0';
      const next = (rosterDlg.dataset.dbaEditMode === '1') ? '0' : '1';
      rosterDlg.dataset.dbaEditMode = next;
      // 再編集モードON時は、誤操作防止のため選択状態をクリアして描画
      if(next === '1'){
        renderRosterModalState(null);
      }else{
        renderRosterModalState(selectedPresetName || null);
      }
    });

    btnSort.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if(rosterDlg) rosterDlg.dataset.dbaDelMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaEditMode = '0';
      openRosterSortModal(() => {
        renderRosterModalState(selectedPresetName || null);
      });
    });

    btnAuto.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if(rosterDlg) rosterDlg.dataset.dbaDelMode = '0';
      if(rosterDlg) rosterDlg.dataset.dbaEditMode = '0';
      openAutoEquipSettingsModal();
    });

    btnDel.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      // 「削除」→「対象選択」へ切り替え
      if(!rosterDlg) return;
      // 削除モードに入るときは再編集モードをOFF（誤操作防止）
      rosterDlg.dataset.dbaEditMode = '0';
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
      renderRosterModalState(null);
      const dlg = document.getElementById('dba-m-roster');
      if(!dlg) return;
      try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
    };
    if(document.body) openNow();
    else document.addEventListener('DOMContentLoaded', openNow, { once:true });
  }

  // =========================
  // オート装備設定モーダル（候補登録）
  // =========================
  const AE_KEYS_GENERAL = ['N','R','SR','SSR','UR','N.エ','R.エ','SR.エ','SSR.エ','UR.エ'];
  const AE_KEYS_GUARD   = ['N.警','R.警','SR.警','SSR.警','UR.警','N.警エ','R.警エ','SR.警エ','SSR.警エ','UR.警エ'];

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
    preferWrap.className = 'dba-br-tail2-chk';
    preferWrap.id = 'dba-ae-opt-preferTop-wrap';

    const preferChk = document.createElement('input');
    preferChk.type = 'checkbox';
    preferChk.id = 'dba-ae-opt-preferTop';

    const preferText = document.createElement('span');
    preferText.textContent = '一番上の装備候補を常に優先する';

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
    acSec.min = '1';
    acSec.max = '60';
    acSec.step = '1';
    acSec.id = 'dba-ae-opt-autoclose-sec';

    const acText2 = document.createElement('span');
    acText2.textContent = '秒で自動的に閉じる';

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

    acSec.value = String(loadAutoEquipNotifyAutoCloseSec());
    acSec.addEventListener('change', (e) => {
      e.stopPropagation();
      saveAutoEquipNotifyAutoCloseSec(acSec.value);
      acSec.value = String(loadAutoEquipNotifyAutoCloseSec());
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
      wipe.className = 'dba-btn-close';
      wipe.textContent = '全削除';
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

  // ---- バックアップ modal（json表示・保存で上書き） ----
  function openRosterBackupModal(onDone){
    const ensure = () => {
      if(document.getElementById('dba-m-roster-backup')) return;
      const dlg = document.createElement('dialog');
      dlg.id = 'dba-m-roster-backup';
      dlg.className = 'dba-m-std';

      const top = document.createElement('div');
      top.className = 'dba-modal__top';
      const t = document.createElement('div');
      t.className = 'dba-modal__title';
      t.textContent = 'バックアップ';
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'dba-btn-x';
      x.textContent = '×';
      top.appendChild(t); top.appendChild(x);

      const mid = document.createElement('div');
      mid.className = 'dba-modal__mid';
      const ta = document.createElement('textarea');
      ta.id = 'dba-roster-backup-ta';
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
      cancel.textContent = '中止';
      bot.appendChild(save); bot.appendChild(cancel);

      dlg.appendChild(top); dlg.appendChild(mid); dlg.appendChild(bot);
      document.body.appendChild(dlg);

      function closeDirect(){ try{ dlg.close(); }catch(_e){ dlg.removeAttribute('open'); } }
      x.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
      cancel.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeDirect(); });
      dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); closeDirect(); });
      save.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        const text = document.getElementById('dba-roster-backup-ta')?.value || '';
        try{
          const obj = JSON.parse(text);
          overwriteRosterFromObject(obj);
          try{ onDone && onDone(); }catch(_e2){}
          closeDirect();
        }catch(_e2){
          alert('JSONの解析に失敗しました。');
        }
      });
    };

    const openNow = () => {
      ensure();
      const { roster } = getActiveRoster();
      const obj = {
        gen: DBA_SAVE_GEN_CURRENT,
        title: roster.title,
        presets: roster.presets || {},
        autoEquip: (roster && roster.autoEquip && typeof roster.autoEquip === 'object')
          ? roster.autoEquip
          : { candidates: {}, lastPreset: '' }
      };
      const ta = document.getElementById('dba-roster-backup-ta');
      if(ta){
        try{
          // バックアップ表示の改行を減らす：
          // プリセットの [weaponId, armorId, necklaceId]（長さ3配列）を 1 行に圧縮する
          let text = JSON.stringify(obj, null, 2);
          // 例：
          // [
          //   111111111,
          //   222222222,
          //   333333333
          // ]
          // → [111111111,222222222,333333333]
          text = text.replace(
            /\[\s*\n\s*(null|\d+)\s*,\s*\n\s*(null|\d+)\s*,\s*\n\s*(null|\d+)\s*\n\s*\]/g,
            '[$1,$2,$3]'
          );
          ta.value = text;
        }catch(_e){
          ta.value = '';
        }
      }
      const dlg = document.getElementById('dba-m-roster-backup');
      if(dlg){
        try{ dlg.showModal(); }catch(_e){ dlg.setAttribute('open',''); }
      }
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
    // 再編集では「選んだプリセット名」を固定（※名前変更はこのモーダルでは扱わない）
    name.disabled = true;
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

  function openRosterAddPresetModal(onDone){
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
            setPreset(pn, [st.weaponId, st.armorId, st.necklaceId]);
            try{ onDone && onDone(); }catch(_e2){}
            try{ dlg.close(); }catch(_e2){ dlg.removeAttribute('open'); }
          }catch(_e2){
            alert('登録に失敗しました。');
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
          try{
            // setPreset は「既存上書きなら順序維持」の実装なので、名前を変えずに上書きする
            setPreset(nm, [st.weaponId, st.armorId, st.necklaceId]);
            try{ onDone && onDone(); }catch(_e2){}
            try{ dlg.close(); }catch(_e2){ dlg.removeAttribute('open'); }
          }catch(_e2){
            alert('再編集の反映に失敗しました。');
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
          const m = document.createElement('div');
          m.className = 'dba-sort-meta';
          m.textContent = presetMetaText(triple);

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
          // 上書き保存（表示順配列のみ更新）
          roster.presetOrder = names.slice();
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
    const url = 'https://donguri.5ch.net/bag';
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

    let selectedRow = null;
    let activeRarity = 'ALL';
    let hideModZero = false;
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
          applyPickFilters();
        });
      }

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

  function refreshHeaderAndTeamTablesFromFetchedDoc(doc, meta){
    const topUrl = meta?.topUrl || `https://donguri.5ch.net/teambattle?m=${mode}`;
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
      const curWrap = findTeamTablesWrap(document);
      const newWrap = doc ? findTeamTablesWrap(doc) : null;
      if(curWrap && newWrap && curWrap.parentNode){
        const importedWrap = document.importNode(newWrap, true);
        curWrap.parentNode.replaceChild(importedWrap, curWrap);
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

  function reactivateScriptsWithin(root){
    if(!root) return 0;
    const scripts = Array.from(root.querySelectorAll('script'));
    let count = 0;
    for(const old of scripts){
      const s = document.createElement('script');
      // type属性を維持（基本は未指定のIIFE想定）
      if(old.type) s.type = old.type;
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
    const topUrl = meta?.topUrl || `https://donguri.5ch.net/teambattle?m=${mode}`;
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
      refreshHeaderAndTeamTablesFromFetchedDoc(doc, { topUrl });

      const imported = document.importNode(fetchedRoot, true);
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
    const topUrl = `https://donguri.5ch.net/teambattle?m=${mode}`;
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
      refreshHeaderAndTeamTablesFromFetchedDoc(doc, { topUrl });

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
    const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&m=${mode}`;
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
    const cell = document.querySelector(`#dba-battlemap-layer-grid .dba-layer-cell[data-row="${row}"][data-col="${col}"] .dba-layer-cell__content`);
    if(cell) cell.textContent = text;
  }

  function clearLayerTexts(){
    for(const el of document.querySelectorAll('#dba-battlemap-layer-grid .dba-layer-cell__content')){
      el.textContent = '';
    }
  }

  async function scanAllCellsAndRender(opts){
      const opt = (opts && typeof opts === 'object') ? opts : {};
      const keySet = (opt.keySet instanceof Set) ? opt.keySet : null;

    const btn = document.getElementById('dba-btn-battleinfo');
    if(btn){
      btn.disabled = true;
      btn.dataset.dbaBusy = '1';
      btn.textContent = 'マップ更新中…';
    }

    // 先にトップページからバトルマップだけ更新（スクロール/ちらつき抑制）
    // 失敗しても戦況取得自体は続行（ただし debug ON 時に成否ログが出る）
    const refreshed = await refreshBattlemapFromTopPage();
    if(btn){
      btn.textContent = refreshed ? '戦況取得中…' : '戦況取得中…(マップ更新失敗)';
    }

    // レイヤーが未生成なら生成＆同期（マップ更新後にやる：セル数変動に追従させる）
    initBattlemapLayer();
    scheduleBattlemapLayerSync();
    await raf2(); // cells が rebuild されるのを待つ

      // 対象セル（全セル or explored限定）
      const allCells = Array.from(document.querySelectorAll('#dba-battlemap-layer-grid .dba-layer-cell'));
      const targetCells = keySet
        ? allCells.filter((c) => keySet.has(`${c.dataset.row}-${c.dataset.col}`))
        : allCells;


    // まず全セルにプレースホルダ
    clearLayerTexts();
      // 全セルに '…' を置くと explored 限定時にノイズになるので、対象セルのみプレースホルダを置く
      for(const c of targetCells){
        setLayerCellText(c.dataset.row, c.dataset.col, '…');
      }

    // fetch の並列数（多すぎると重いので抑制）
    const CONCURRENCY = 9;

    const jobs = targetCells.map((c) => ({ row: Number(c.dataset.row), col: Number(c.dataset.col) }));
    await mapLimit(jobs, CONCURRENCY, async (job) => {
      const { row, col } = job;
      try{
        const { holder, reg } = await fetchCellDetail(row, col);
        // 表示：レギュレーション + ホルダー
        setLayerCellText(row, col, `${reg}\n${holder}`);
      }catch(_e){
        setLayerCellText(row, col, `ERR\n(${row},${col})`);
      }
      return true;
    });

    if(btn){
      btn.disabled = false;
      btn.dataset.dbaBusy = '0';
      btn.textContent = '戦況情報';
    }
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
    const re1 = new RegExp(`const\\s+${constName}\\s*=\\s*([\\s\\S]*?);\\s*(?:\\n|$)`);
    const m = scriptText.match(re1);
    if(!m) return null;
    return (m[1] || '').trim();
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

  function getBattlemapSnapshotFromDoc(doc){
    const out = {
      mode,
      rows: 0,
      cols: 0,
      cellColors: Object.create(null),
      capitalSet: new Set(),
      terrainsKey: '' // RBのみ
    };

    if(mode === 'rb'){
      const t = pickScriptText(doc, ['const GRID_SIZE', 'const cellColors', 'terrainsPayload']);
      const litSize = extractConstLiteral(t, 'GRID_SIZE');
      const litColors = extractConstLiteral(t, 'cellColors');
      const litCap = extractConstLiteral(t, 'capitalList') || extractConstLiteral(t, 'capitalMap');
      const litTerr = extractConstLiteral(t, 'terrainsPayload');

      let size = 0;
      try{ size = Number(parseJsValueLiteral(litSize)); }catch(_e){ size = 0; }
      if(!Number.isFinite(size) || size <= 0) size = 16;
      out.rows = size;
      out.cols = size;

      try{ out.cellColors = normalizeCellColors(parseJsValueLiteral(litColors)); }catch(_e){ out.cellColors = Object.create(null); }
      try{ out.capitalSet = normalizeCapitalSet(parseJsValueLiteral(litCap)); }catch(_e){ out.capitalSet = new Set(); }
      try{ out.terrainsKey = normalizeTerrainsPayload(parseJsValueLiteral(litTerr)); }catch(_e){ out.terrainsKey = ''; }
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

    // 全セルキー（サイズ範囲）を対象にする：色/首都の変化検出を漏らさない
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
    // cellColors にだけ存在するキーも対象（念のため）
    for(const k of Object.keys(curSnap.cellColors||{})) keys.add(k);
    for(const k of Object.keys(newSnap.cellColors||{})) keys.add(k);

    for(const k of keys){
      const c1 = (curSnap.cellColors && (k in curSnap.cellColors)) ? curSnap.cellColors[k] : null;
      const c2 = (newSnap.cellColors && (k in newSnap.cellColors)) ? newSnap.cellColors[k] : null;
      const cap1 = curSnap.capitalSet ? curSnap.capitalSet.has(k) : false;
      const cap2 = newSnap.capitalSet ? newSnap.capitalSet.has(k) : false;
      if(c1 !== c2 || cap1 !== cap2){
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
    // RB: window.__FOW の "explored" 解析＆比較
    //  - explored の座標数/内容を比較し、短押し処理の対象セルを explored に限定するためのヘルパ
    // =========================
    function setEquals(a, b){
      if(!(a instanceof Set) || !(b instanceof Set)) return false;
      if(a.size !== b.size) return false;
      for(const v of a){
        if(!b.has(v)) return false;
      }
      return true;
    }
  
    function parseRbExploredSetFromDoc(doc){
      // return: { ok:boolean, set:Set<string>, count:number }
      const out = { ok:false, set:new Set(), count:0 };
      try{
        if(!doc) return out;
        const scripts = Array.from(doc.querySelectorAll('script'));
        for(const sc of scripts){
          const t = sc.textContent || '';
          if(!t) continue;
          // window.__FOW = {"explored":[[r,c]...],"hasCapital":true,"visible":[...]}
          if(!t.includes('window.__FOW') || !t.includes('explored')) continue;
  
          // "explored":[ ... ] を最短で抜く（hasCapital までを目印にする）
          let m = t.match(/"explored"\s*:\s*(\[[\s\S]*?\])\s*,\s*"hasCapital"/);
          if(!m){
            // 予備：hasCapital が無い/順序が違う場合に備えて、次のカンマまで
            m = t.match(/"explored"\s*:\s*(\[[\s\S]*?\])\s*,/);
          }
          if(!m) continue;
  
          const arr = JSON.parse(m[1]); // [[r,c], ...]
          if(!Array.isArray(arr)) continue;
  
          const s = new Set();
          for(const rc of arr){
            if(!rc || rc.length < 2) continue;
            const r = Number(rc[0]);
            const c = Number(rc[1]);
            if(!Number.isFinite(r) || !Number.isFinite(c)) continue;
            s.add(`${r}-${c}`);
          }
          out.ok = true;
          out.set = s;
          out.count = s.size;
          return out;
        }
      }catch(_e){
        // noop
      }
      return out;
    }
  
    // RB短押し用：キー集合（例: exploredSet）に限定して差分セルを検出
    function diffChangedCellsInKeys(curSnap, newSnap, keySet){
      const changed = [];
      const keys = (keySet instanceof Set) ? keySet : new Set();
      for(const k of keys){
        const c1 = (curSnap.cellColors && (k in curSnap.cellColors)) ? curSnap.cellColors[k] : null;
        const c2 = (newSnap.cellColors && (k in newSnap.cellColors)) ? newSnap.cellColors[k] : null;
        const cap1 = curSnap.capitalSet ? curSnap.capitalSet.has(k) : false;
        const cap2 = newSnap.capitalSet ? newSnap.capitalSet.has(k) : false;
        if(c1 !== c2 || cap1 !== cap2){
          const m = k.match(/^(\d+)-(\d+)$/);
          if(!m) continue;
          changed.push({ row: Number(m[1]), col: Number(m[2]) });
        }
      }
      changed.sort((a,b) => (a.row - b.row) || (a.col - b.col));
      return changed;
    }

  async function updateOnlyChangedCellsFromTopPage(){
    const btn = document.getElementById('dba-btn-battleinfo');
    if(btn){
      btn.disabled = true;
      btn.dataset.dbaBusy = '1';
      btn.textContent = '差分確認中…';
    }

    const topUrl = `https://donguri.5ch.net/teambattle?m=${mode}`;
    try{
      // (1) 最新ページを取得
      const res = await fetch(topUrl, { method:'GET', credentials:'include', cache:'no-store' });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // ★追加：クリック（短押し）でも header + チーム情報2テーブル を最新化
      // （差分セルが0でも、上部の情報は更新したい）
      refreshHeaderAndTeamTablesFromFetchedDoc(doc, { topUrl });

      // (2) 現在と最新を比較
      const curSnap = getBattlemapSnapshotFromDoc(document);
      const newSnap = getBattlemapSnapshotFromDoc(doc);

        // (2-RB-FOW) RB限定：explored の比較結果で「短押しの対象セル」を決める
        // 条件：
        //  - ローカル explored 数 < サーバ explored 数 → サーバ explored のみで短押し処理
        //  - ローカル explored 数 == サーバ explored 数 かつ 座標一致 → サーバ explored のみで短押し処理
        //  - それ以外 → 短押しはやめて「長押し処理」（=全セル巡回）へフォールバック
        let rbExploredKeySet = null;
        if(mode === 'rb'){
          const localFow = parseRbExploredSetFromDoc(document);
          const serverFow = parseRbExploredSetFromDoc(doc);
  
          const lc = Number(localFow.count || 0);
          const sc = Number(serverFow.count || 0);
          const same = (lc === sc) && setEquals(localFow.set, serverFow.set);
          const allowShort = !!(serverFow.ok && ((lc < sc) || same));
  
          if(!allowShort){
            if(btn) btn.textContent = '全更新（探索差）…';
            await scanAllCellsAndRender();
            return;
          }
  
          // サーバ側 explored を「短押し対象セル」として採用
          rbExploredKeySet = serverFow.set;
        }

      // (2-1) サイズ違い → 長押しと同じ
      if(curSnap.rows !== newSnap.rows || curSnap.cols !== newSnap.cols){
        if(btn) btn.textContent = '全更新（サイズ差）…';
        await scanAllCellsAndRender();
        return;
      }

      // (2-2) RBのみ terrainsPayload が違う → 長押しと同じ
      if(mode === 'rb'){
        if((curSnap.terrainsKey || '') !== (newSnap.terrainsKey || '')){
          if(btn) btn.textContent = '全更新（地形差）…';
          await scanAllCellsAndRender();
          return;
        }
      }

      // (2-3) 差分セルだけ詳細取得
        const changed = (mode === 'rb' && rbExploredKeySet)
          ? diffChangedCellsInKeys(curSnap, newSnap, rbExploredKeySet)
          : diffChangedCells(curSnap, newSnap);

      // ★追加要件： (2-3) に該当する場合は、差分セルの詳細取得に加えて
      // 「バトルマップの最新版への差し替え（最新データを使っての再描画）」も実施する
      // - ここでは既に取得済みの doc を再利用し、余計な再fetchを避ける
      // - 差分が0の時は差し替え不要（軽量化）
      if(changed.length > 0){
        if(btn) btn.textContent = 'マップ差し替え中…';
        const refreshed = await refreshBattlemapFromFetchedDoc(doc, { topUrl });
        if(btn){
          btn.textContent = refreshed
            ? `差分更新中…(${changed.length})`
            : `差分更新中…(${changed.length}) (マップ更新失敗)`;
        }
      }

      // レイヤーが未生成なら生成＆同期
      initBattlemapLayer();
      scheduleBattlemapLayerSync();
      await raf2();

      if(changed.length === 0){
        if(btn){
          btn.textContent = '差分なし';
          setTimeout(() => {
            btn.disabled = false;
            btn.dataset.dbaBusy = '0';
            btn.textContent = '戦況情報';
          }, 600);
        }
        return;
      }

      // 上でマップ差し替えが走った場合も、ここで改めて表示を揃える
      if(btn && btn.textContent.indexOf('差分更新中…') !== 0)
        btn.textContent = `差分更新中…(${changed.length})`;

      const CONCURRENCY = 9;
      await mapLimit(changed, CONCURRENCY, async (job, idx) => {
        const { row, col } = job;
        try{
          const { holder, reg } = await fetchCellDetail(row, col);
          setLayerCellText(row, col, `${reg}\n${holder}`);
        }catch(_e){
          setLayerCellText(row, col, `ERR\n(${row},${col})`);
        }
        if(btn && (idx % 10 === 0)){
          const done = idx + 1;
          btn.textContent = `差分更新中…(${done}/${changed.length})`;
        }
        return true;
      });

      if(btn){
        btn.disabled = false;
        btn.dataset.dbaBusy = '0';
        btn.textContent = '戦況情報';
      }
    }catch(e){
      dbgLog('battleInfo', 'warn', 'CLICK update failed', { mode, error: String(e && e.message ? e.message : e) });
      if(btn){
        btn.disabled = false;
        btn.dataset.dbaBusy = '0';
        btn.textContent = '戦況情報';
      }
      alert('戦況情報の取得に失敗しました。');
    }
  }

  function waitAndApplyScale(){
    const tryApply = () => {
      if(mode === 'rb'){
        if(applyScaleToCanvasWrap(loadSettings().scale.rb)){
          ensureRbPointerFix();
          scheduleBattlemapLayerSync();
          return true;
        }
      }else{
        if(applyScaleToGrid(loadSettings().scale[mode])){
          scheduleBattlemapLayerSync();
          return true;
        }
      }
      return false;
    };

    if(tryApply()) return;

    const mo = new MutationObserver(() => {
      if(tryApply()){
        mo.disconnect();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
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

    const hint = document.createElement('div');
    hint.style.textAlign = 'left';
    hint.style.marginBottom = '10px';
    hint.style.fontSize = '0.95em';
    hint.textContent = '各モードのバトルマップのセルサイズ（%）を設定できます（100〜200、範囲外は100に補正）。';
    mid.appendChild(hint);

    const settings = loadSettings();

    function mkRow(modeKey){
      const row = document.createElement('div');
      row.className = 'dba-setting-row';

      const lab = document.createElement('label');
      lab.textContent = getModeLabel(modeKey);

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '100';
      input.max = '200';
      input.step = '1';
      input.value = String(sanitizeScale(settings.scale[modeKey]));
      input.dataset.modeKey = modeKey;

      row.appendChild(lab);
      row.appendChild(input);
      return row;
    }

    mid.appendChild(mkRow('rb'));
    mid.appendChild(mkRow('hc'));
    mid.appendChild(mkRow('l'));

    // レイヤー文字濃度（将来のテキスト/絵文字表示のための事前準備）
    (function mkOpacityRow(){
      const row = document.createElement('div');
      row.className = 'dba-setting-row';

      const lab = document.createElement('label');
      lab.textContent = 'レイヤー文字濃度（0〜100）';

      const wrap = document.createElement('div');
      wrap.style.display = 'grid';
      wrap.style.gridTemplateColumns = '1fr 52px';
      wrap.style.gap = '8px';
      wrap.style.alignItems = 'center';

      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.step = '1';
      input.value = String(sanitizeOpacity(settings.layer.textOpacity));
      input.dataset.layerOpacity = '1';

      const out = document.createElement('div');
      out.textContent = input.value;
      out.style.textAlign = 'right';
      out.style.fontWeight = '700';

      input.addEventListener('input', () => {
        out.textContent = input.value;
        // 即時反映（保存は Apply/OK）
        applyLayerTextOpacity(input.value);
      }, { passive: true });

      wrap.appendChild(input);
      wrap.appendChild(out);

      row.appendChild(lab);
      row.appendChild(wrap);
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
      const out = { rb: 100, hc: 100, l: 100, layerTextOpacity: 100 };
      for(const inp of dlg.querySelectorAll('input[type="number"][data-mode-key]')){
        const k = inp.dataset.modeKey;
        out[k] = Number.parseInt(inp.value, 10);
      }
      const op = dlg.querySelector('input[type="range"][data-layer-opacity="1"]');
      if(op) out.layerTextOpacity = Number.parseInt(op.value, 10);
      return out;
    }

    function setInputsFromSettings(s){
      for(const inp of dlg.querySelectorAll('input[type="number"][data-mode-key]')){
        const k = inp.dataset.modeKey;
        inp.value = String(sanitizeScale(s.scale[k]));
      }
      const op = dlg.querySelector('input[type="range"][data-layer-opacity="1"]');
      if(op){
        op.value = String(sanitizeOpacity(s.layer.textOpacity));
        // 表示側の数値も更新
        const disp = op.parentElement && op.parentElement.children ? op.parentElement.children[1] : null;
        if(disp && disp.textContent != null) disp.textContent = op.value;
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
      cur.scale.rb = sanitizeScale(v.rb);
      cur.scale.hc = sanitizeScale(v.hc);
      cur.scale.l  = sanitizeScale(v.l);
      cur.layer.textOpacity = sanitizeOpacity(v.layerTextOpacity);

      // 範囲外入力はここで 100 に補正し、UIにも反映
      saveSettings(cur);
      setInputsFromSettings(cur);

      // 反映
      applyCurrentModeScale();
      scheduleBattlemapLayerSync();

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
      setInputsFromSettings(loadSettings());
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

    // 2段構造：上=progress / 下=ボタン群
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
      btnRapid.textContent = on ? 'ラピッド攻撃:ON' : 'ラピッド攻撃:OFF';
    }
    syncRapidBtn();
    btnRapid.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = !loadRapidAttackEnabled();
      saveRapidAttackEnabled(next);
      syncRapidBtn();
    });

    const btnRoster = document.createElement('button');
    btnRoster.type = 'button';
    btnRoster.className = 'dba-btn-fn';
    btnRoster.textContent = '装備ロスター';
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

    const btnBattleInfo = document.createElement('button');
    btnBattleInfo.type = 'button';
    btnBattleInfo.className = 'dba-btn-fn';
    btnBattleInfo.textContent = '戦況情報';
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
            // RB限定：explored の比較結果で「長押し対象セル」を絞り込む
            // 条件：
            //  - ローカル explored 数 < サーバ explored 数 → サーバ explored のみ
            //  - ローカル explored 数 == サーバ explored 数 かつ 座標一致 → サーバ explored のみ
            //  - それ以外 → 全座標（従来通り）
            if(mode === 'rb'){
              const topUrl = `https://donguri.5ch.net/teambattle?m=${mode}`;
              try{
                const res = await fetch(topUrl, { method:'GET', credentials:'include', cache:'no-store' });
                if(!res.ok) throw new Error(`HTTP ${res.status}`);
                const html = await res.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');

                const localFow  = parseRbExploredSetFromDoc(document);
                const serverFow = parseRbExploredSetFromDoc(doc);
                const lc = Number(localFow.count || 0);
                const sc = Number(serverFow.count || 0);
                const same = (lc === sc) && setEquals(localFow.set, serverFow.set);
                const allowExploredOnly = !!(serverFow.ok && ((lc < sc) || same));

                if(allowExploredOnly){
                  await scanAllCellsAndRender({ keySet: serverFow.set });
                }else{
                  await scanAllCellsAndRender(); // 全座標
                }
                return;
              }catch(_e2){
                // fetch/parse 失敗時は安全側（全座標）
                await scanAllCellsAndRender();
                return;
              }
            }
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

    const btnAutoEquip = document.createElement('button');
    btnAutoEquip.type = 'button';
    btnAutoEquip.className = 'dba-btn-fn';
    btnAutoEquip.id = 'dba-btn-auto-equip';
    function syncAutoEquipBtn(){
      const on = loadAutoEquipEnabled();
      btnAutoEquip.dataset.on = on ? '1' : '0';
      btnAutoEquip.textContent = on ? 'オート装備:ON' : 'オート装備:OFF';
    }
    syncAutoEquipBtn();
    btnAutoEquip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = !loadAutoEquipEnabled();
      saveAutoEquipEnabled(next);
      syncAutoEquipBtn();
    });

    buttonsRow.appendChild(btnSettings);
    buttonsRow.appendChild(btnAutoEquip);
    buttonsRow.appendChild(btnRapid);
    buttonsRow.appendChild(btnRoster);
    buttonsRow.appendChild(btnBattleInfo);

    bar.appendChild(progressHost);
    bar.appendChild(buttonsRow);
    return bar;
  }

  function injectWhenReady() {
    // ★保存データの世代を確認し、Gen1ならGen2へ自動移行
    //   （/teambattle?m=* を開いた時に行う要件）
    try{ migrateSaveDataToGen2IfNeeded(); }catch(_e){}

    addStyle(CSS);

    const doInsert = () => {
      // 二重挿入防止
      if (document.getElementById('dba-function-section')) return;

      document.documentElement.classList.add('dba-has-fnbar');

      const bar = buildFunctionSection();

      const header = document.querySelector('header');
      if (header && header.parentNode) {
        header.parentNode.insertBefore(bar, header);
      } else {
        // header が見つからない場合は body 先頭に
        (document.body || document.documentElement).insertBefore(bar, (document.body || document.documentElement).firstChild);
      }

      // fnbar 内（上段）に、トップページ同期の「経過時間」プログレスバーを設置
      const ph = bar.querySelector('#dba-fn-progress-host');
      ensureTopProgressContainer(ph || null);
      startTopProgressTicker();

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
