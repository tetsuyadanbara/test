// ==UserScript==
// @name         donguri arena assist tool (stable toolbar + equip fixed)
// @version      2.1
// @description  Stable toolbar (always clickable) + equip panel that reliably loads from /bag
// @match        https://donguri.5ch.net/teambattle*
// @match        https://donguri.5ch.net/bag
// ==/UserScript==

(() => {
  "use strict";

  const onReady = (fn) => {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn, { once: true });
  };

  const isBag = location.pathname === "/bag";

  /* -----------------------------
     BAG: クリックした装備を current_equip に保存（武器/防具/首）
  ------------------------------*/
  if (isBag) {
    function saveEquip(url, index) {
      const id = url.match(/\/equip\/(\d+)/)?.[1];
      if (!id) return;
      const current = JSON.parse(localStorage.getItem("current_equip") || "[]");
      current[index] = id;
      localStorage.setItem("current_equip", JSON.stringify(current));
    }

    const tableIds = ["weaponTable", "armorTable", "necklaceTable"];
    tableIds.forEach((tid, idx) => {
      document.querySelectorAll(`#${tid} a[href^="https://donguri.5ch.net/equip/"]`)
        .forEach((a) => a.addEventListener("click", () => saveEquip(a.href, idx)));
    });
    return;
  }

  onReady(() => {
    /* -----------------------------
       STYLE: ツールバー最前面 + クリック確実
    ------------------------------*/
    const style = document.createElement("style");
    style.textContent = `
#aatToolbar{
  position:fixed;
  top:0; left:0; right:0;
  background:#fff;
  border-bottom:1px solid #000;
  z-index:2147483647; /* 最強 */
  pointer-events:auto;
}
#aatWrap{
  max-width:1200px;
  margin:0 auto;
  padding:6px 8px;
  box-sizing:border-box;
}
#aatRow{
  display:flex;
  gap:6px;
  flex-wrap:wrap;
  align-items:center;
}
#aatBar{
  width:360px;
  height:16px;
  background:#ddd;
  border-radius:8px;
  overflow:hidden;
}
#aatBarInner{
  height:100%;
  background:#428bca;
  color:#fff;
  text-align:right;
  padding-right:6px;
  font-size:12px;
  line-height:16px;
  box-sizing:border-box;
  white-space:nowrap;
}
#aatEquip{
  display:none;
  border-top:1px solid #000;
  margin-top:6px;
  padding-top:6px;
  gap:10px;
  flex-wrap:wrap;
  align-items:center;
}
#aatEquip span{
  display:inline-block;
  min-width:10em;
  max-width:60vw;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
#aatLog{
  display:none;
  max-height:40vh;
  overflow:auto;
  border-top:1px solid #000;
  margin-top:6px;
  padding-top:6px;
  font-size:12px;
  line-height:1.35;
}
#aatToolbar button{
  padding:4px 8px;
  border:1px solid #000;
  background:#eee;
  cursor:pointer;
}
#aatToolbar button:active{ transform:translateY(1px); }
`;
    document.head.appendChild(style);

    /* -----------------------------
       TOOLBAR DOM
    ------------------------------*/
    const toolbar = document.createElement("div");
    toolbar.id = "aatToolbar";
    toolbar.innerHTML = `
<div id="aatWrap">
  <div id="aatRow">
    <b id="aatInfo">loading…</b>
    <div id="aatBar"><div id="aatBarInner" style="width:0%">0%</div></div>
    <button id="aatLogBtn">ログ</button>
  </div>

  <div id="aatRow" style="margin-top:6px;">
    <button id="aatEquipBtn">装備</button>
    <button id="aatEquipReload">装備更新</button>
    <button id="aatRefreshBtn">進行更新</button>
    <button id="aatAutoBtn">自動参戦:OFF</button>
  </div>

  <div id="aatEquip">
    <div>武器: <span data-w>-</span></div>
    <div>防具: <span data-a>-</span></div>
    <div>首  : <span data-n>-</span></div>
  </div>

  <div id="aatLog"></div>
</div>
`;
    document.body.prepend(toolbar);

    // body上部を空ける（ツールバー被り防止）
    const pad = 120;
    document.body.style.paddingTop = `${pad}px`;

    // canvasがクリックを奪う場合に備え、toolbar領域だけ最前面＋クリック可能にしておく（z-indexで解決するはず）
    // それでもダメな場合は gridOverlay が異常に高い z-index を持ってるケースなので下で補正する。

    /* -----------------------------
       REFERENCES
    ------------------------------*/
    const info = document.getElementById("aatInfo");
    const barInner = document.getElementById("aatBarInner");
    const equipPanel = document.getElementById("aatEquip");
    const logBox = document.getElementById("aatLog");
    const logBtn = document.getElementById("aatLogBtn");

    function log(msg) {
      const d = document.createElement("div");
      d.textContent = `${new Date().toLocaleTimeString()} ${msg}`;
      logBox.prepend(d);
    }

    /* -----------------------------
       「最近2つでボタンが死ぬ」対策：
       gridOverlay/canvasのz-indexがツールバーを超えてる時だけ強制補正
    ------------------------------*/
    function fixCanvasZ() {
      const cv =
        document.querySelector("#gridOverlay") ||
        document.querySelector("#gridBase") ||
        document.querySelector("canvas");
      if (!cv) return;

      // 変なz-indexが付いてるときだけ下げる
      const z = Number(getComputedStyle(cv).zIndex);
      if (Number.isFinite(z) && z >= 2147483000) {
        cv.style.zIndex = "1";
        log("canvas z-index を補正しました");
      }
    }
    fixCanvasZ();

    /* -----------------------------
       装備：/bag を取得して各テーブルの先頭アイテム名を表示
       ※ログイン切れ/DOM差でも「-(取得失敗)」表示にする
    ------------------------------*/
    async function loadEquip() {
      try {
        const res = await fetch("/bag", { credentials: "same-origin" });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const h1 = doc.querySelector("h1")?.textContent || "";
        if (!h1.includes("アイテムバッグ")) {
          // ログイン切れ等
          equipPanel.querySelector("[data-w]").textContent = "取得失敗（再ログイン？）";
          equipPanel.querySelector("[data-a]").textContent = "取得失敗（再ログイン？）";
          equipPanel.querySelector("[data-n]").textContent = "取得失敗（再ログイン？）";
          log("装備: /bag が想定外（ログイン切れの可能性）");
          return;
        }

        const ids = ["weaponTable", "armorTable", "necklaceTable"];
        const keys = ["w", "a", "n"];

        ids.forEach((tid, i) => {
          const t = doc.querySelector("#" + tid);
          // 1列目（名前）を拾う：tbody tr td の一番最初
          const name = t?.querySelector("tbody tr td")?.textContent?.trim() || "-";
          const span = equipPanel.querySelector(`[data-${keys[i]}]`);
          if (span) span.textContent = name;
        });

        log("装備を更新しました");
      } catch (e) {
        equipPanel.querySelector("[data-w]").textContent = "取得失敗";
        equipPanel.querySelector("[data-a]").textContent = "取得失敗";
        equipPanel.querySelector("[data-n]").textContent = "取得失敗";
        log("装備取得失敗: " + (e?.message || e));
      }
    }

    /* -----------------------------
       進行：トップページから % を読む（失敗しても壊れない）
    ------------------------------*/
    async function updateProgress() {
      try {
        const res = await fetch("/", { credentials: "same-origin" });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        // ここはサイト側の構造差が出やすいので「数字っぽいもの」を優先する
        const m = doc.body.textContent.match(/(\d{1,3})%/);
        const percent = m ? Math.max(0, Math.min(100, parseInt(m[1], 10))) : null;

        if (percent == null) {
          info.textContent = "進行: 取得失敗";
          return;
        }

        barInner.style.width = percent + "%";
        barInner.textContent = percent + "%";
        info.textContent = `進行 ${percent}%`;
      } catch (_) {
        info.textContent = "進行: 取得失敗";
      }
    }

    /* -----------------------------
       自動参戦（簡易）：ランダムセル叩く
       ※あなたの元コードの「進行%で次の%」ロジックは、UI安定後に合体するのが安全
    ------------------------------*/
    function detectGridSize() {
      // ページ内scriptから GRID_SIZE を拾う（あなたの貼ったバトルフィールドは const GRID_SIZE = 7）
      const scripts = [...document.querySelectorAll("script")];
      for (const s of scripts) {
        const m = s.textContent.match(/const\s+GRID_SIZE\s*=\s*(\d+)/);
        if (m) return parseInt(m[1], 10);
      }
      return 7;
    }

    async function challenge(r, c) {
      const body = `row=${r}&col=${c}`;
      const res = await fetch("/teamchallenge" + location.search, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        credentials: "same-origin"
      });
      const text = await res.text();
      const last = text.trim().split("\n").pop() || "";
      log(`(${r},${c}) ${last}`);
      return last;
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    let auto = false;
    async function autoLoop() {
      const size = detectGridSize();
      while (auto) {
        const r = Math.floor(Math.random() * size);
        const c = Math.floor(Math.random() * size);

        let last = "";
        try {
          last = await challenge(r, c);
        } catch (e) {
          log("自動参戦エラー: " + (e?.message || e));
          await sleep(5000);
          continue;
        }

        // too fast / 動き切れ の待機
        if (last.includes("too fast") || last.includes("動きを使い果たしました")) {
          await sleep(11000);
        } else {
          await sleep(1600);
        }
      }
    }

    /* -----------------------------
       BUTTONS
    ------------------------------*/
    document.getElementById("aatEquipBtn").addEventListener("click", async () => {
      // 「押しても出ない」対策：開くタイミングで必ず再取得する
      if (equipPanel.style.display === "flex") {
        equipPanel.style.display = "none";
      } else {
        equipPanel.style.display = "flex";
        await loadEquip();
      }
    });

    document.getElementById("aatEquipReload").addEventListener("click", loadEquip);
    document.getElementById("aatRefreshBtn").addEventListener("click", updateProgress);

    document.getElementById("aatAutoBtn").addEventListener("click", (e) => {
      auto = !auto;
      e.target.textContent = auto ? "自動参戦:ON" : "自動参戦:OFF";
      log(auto ? "自動参戦 ON" : "自動参戦 OFF");
      if (auto) autoLoop();
    });

    logBtn.addEventListener("click", () => {
      logBox.style.display = (logBox.style.display === "block") ? "none" : "block";
    });

    /* -----------------------------
       INIT
    ------------------------------*/
    updateProgress();
    setInterval(updateProgress, 20000);

    // 初回は装備パネル開いた時に取得するが、保険で一回だけ事前取得もしておく
    loadEquip();

  });
})();
