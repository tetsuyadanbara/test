// ==UserScript==
// @name         donguri arena assist tool (complete fixed)
// @version      1.2.3-complete-fix
// @description  fix arena ui + equip preset/auto equip + range attack + auto join (fixed getRegions + fetch targets)
// @author       ぱふぱふ (patched by ChatGPT)
// @match        https://donguri.5ch.net/teambattle?m=hc
// @match        https://donguri.5ch.net/teambattle?m=l
// @match        https://donguri.5ch.net/teambattle?m=rb
// @match        https://donguri.5ch.net/bag
// ==/UserScript==

(() => {
  "use strict";

  // ---------------------------
  // BAG: save current equip ids
  // ---------------------------
  if (location.href === "https://donguri.5ch.net/bag") {
    function saveCurrentEquip(url, index) {
      let currentEquip = JSON.parse(localStorage.getItem("current_equip")) || [];
      const regex = /https:\/\/donguri\.5ch\.net\/equip\/(\d+)/;
      const m = url.match(regex);
      if (!m) return;
      const equipId = m[1];
      currentEquip[index] = equipId;
      localStorage.setItem("current_equip", JSON.stringify(currentEquip));
    }

    const tableIds = ["weaponTable", "armorTable", "necklaceTable"];
    tableIds.forEach((elm, index) => {
      const equipLinks = document.querySelectorAll(
        `#${elm} a[href^="https://donguri.5ch.net/equip/"]`
      );
      [...equipLinks].forEach((link) => {
        link.addEventListener("click", () => saveCurrentEquip(link.href, index));
      });
    });
    return;
  }

  // ---------------------------
  // MODE / NAME
  // ---------------------------
  const MODE = location.search.slice(1); // "m=hc" etc
  let MODENAME;
  if (MODE === "m=hc") MODENAME = "［ハード］";
  else if (MODE === "m=l") MODENAME = "［ラダー］";
  else MODENAME = "［赤vs青］";

  const vw = Math.min(document.documentElement.clientWidth, window.innerWidth || 0);
  const vh = Math.min(document.documentElement.clientHeight, window.innerHeight || 0);

  // ---------------------------
  // SETTINGS (single source of truth)
  // ---------------------------
  const settings = JSON.parse(localStorage.getItem("aat_settings")) || {};

  // ---------------------------
  // UI: toolbar + progress bar
  // ---------------------------
  const header = document.querySelector("header");
  if (!header) return;
  header.style.marginTop = "100px";

  const toolbar = document.createElement("div");
  toolbar.style.position = "fixed";
  toolbar.style.top = "0";
  toolbar.style.zIndex = "1";
  toolbar.style.background = "#fff";
  toolbar.style.border = "solid 1px #000";

  // toolbar position clamp
  (() => {
    const position = settings.toolbarPosition || "left";
    let distance = settings.toolbarPositionLength || "0px";

    const match = distance.match(/^(\d+)(px|%|vw)?$/);
    let value = match ? parseFloat(match[1]) : 0;
    let unit = match ? match[2] || "px" : "px";

    const maxPx = vw / 3;
    const maxPercent = 33;
    const maxVw = 33;
    if (unit === "px") value = Math.min(value, maxPx);
    else if (unit === "%") value = Math.min(value, maxPercent);
    else if (unit === "vw") value = Math.min(value, maxVw);

    distance = `${value}${unit}`;

    if (position === "left") toolbar.style.left = distance;
    else if (position === "right") toolbar.style.right = distance;
    else {
      toolbar.style.left = distance;
      toolbar.style.right = distance;
    }
  })();

  const h4 = header.querySelector("h4");
  if (h4) h4.style.display = "none";
  header.append(toolbar);

  const progressBarContainer = document.createElement("div");
  const progressBar = document.createElement("div");
  const progressBarBody = document.createElement("div");
  const progressBarInfo = document.createElement("p");

  progressBar.classList.add("progress-bar");
  progressBar.style.display = "inline-block";
  progressBar.style.width = "400px";
  progressBar.style.maxWidth = "100vw";
  progressBar.style.height = "20px";
  progressBar.style.background = "#ccc";
  progressBar.style.borderRadius = "8px";
  progressBar.style.fontSize = "16px";
  progressBar.style.overflow = "hidden";
  progressBar.style.marginTop = "5px";

  progressBarBody.style.height = "100%";
  progressBarBody.style.lineHeight = "normal";
  progressBarBody.style.background = "#428bca";
  progressBarBody.style.textAlign = "right";
  progressBarBody.style.paddingRight = "5px";
  progressBarBody.style.boxSizing = "border-box";
  progressBarBody.style.color = "white";

  progressBarInfo.style.marginTop = "0";
  progressBarInfo.style.marginBottom = "0";
  progressBarInfo.style.overflow = "auto";
  progressBarInfo.style.whiteSpace = "nowrap";

  progressBarContainer.append(progressBarInfo, progressBar);
  progressBar.append(progressBarBody);
  toolbar.append(progressBarContainer);

  // ---------------------------
  // state vars
  // ---------------------------
  let currentViewMode = "detail";
  let shouldSkipAreaInfo = !!settings.skipArenaInfo;
  let shouldSkipAutoEquip = !!settings.skipAutoEquip;
  let cellSelectorActivate = false;
  let rangeAttackProcessing = false;

  let currentPeriod = 0;
  let currentProgress = 0;

  let wood = 0,
    steel = 0;

  let currentEquipName = "";

  // ---------------------------
  // UI: buttons
  // ---------------------------
  const buttonBase = document.createElement("button");
  buttonBase.type = "button";
  buttonBase.style.flexShrink = "1";
  buttonBase.style.flexGrow = "0";
  buttonBase.style.whiteSpace = "nowrap";
  buttonBase.style.overflow = "hidden";
  buttonBase.style.boxSizing = "border-box";
  buttonBase.style.padding = "2px";
  buttonBase.style.width = "6em";
  buttonBase.style.fontSize = "65%";
  buttonBase.style.border = "none";

  if (vw < 768) progressBarContainer.style.fontSize = "60%";

  const menuButton = buttonBase.cloneNode();
  menuButton.textContent = "▼メニュー";

  const equipButton = buttonBase.cloneNode();
  equipButton.textContent = "■装備";

  const toggleViewButton = buttonBase.cloneNode();
  toggleViewButton.innerText = "表示\n切り替え";

  const refreshButton = buttonBase.cloneNode();
  refreshButton.innerText = "エリア情報\n更新";

  const skipAreaInfoButton = buttonBase.cloneNode();
  skipAreaInfoButton.innerText = "セル情報\nスキップ";
  skipAreaInfoButton.style.color = "#fff";
  skipAreaInfoButton.style.background = shouldSkipAreaInfo ? "#46f" : "#888";

  // submenu container
  const subMenu = document.createElement("div");
  subMenu.style.display = "none";
  subMenu.style.flexWrap = "nowrap";
  subMenu.style.overflowX = "hidden";
  subMenu.style.position = "relative";

  menuButton.addEventListener("click", () => {
    subMenu.style.display = subMenu.style.display === "flex" ? "none" : "flex";
  });

  toggleViewButton.addEventListener("click", () => toggleCellViewMode());
  refreshButton.addEventListener("click", () => fetchAreaInfo(false));

  skipAreaInfoButton.addEventListener("click", () => {
    shouldSkipAreaInfo = !shouldSkipAreaInfo;
    skipAreaInfoButton.style.background = shouldSkipAreaInfo ? "#46f" : "#888";
    settings.skipArenaInfo = shouldSkipAreaInfo;
    localStorage.setItem("aat_settings", JSON.stringify(settings));
  });

  // main menu bar
  const main = document.createElement("div");
  main.style.display = "flex";
  main.style.flexWrap = "nowrap";
  main.style.gap = "2px";
  main.style.justifyContent = "center";
  main.append(menuButton, skipAreaInfoButton, equipButton, toggleViewButton, refreshButton);
  toolbar.append(main, subMenu);

  // ---------------------------
  // dialogs: arenaField / arenaResult / help
  // ---------------------------
  const arenaField = document.createElement("dialog");
  arenaField.style.position = "fixed";
  arenaField.style.background = "#fff";
  arenaField.style.color = "#000";
  arenaField.style.border = "solid 1px #000";
  if (vw < 768) arenaField.style.fontSize = "85%";

  arenaField.style.bottom = settings.arenaFieldBottom ? settings.arenaFieldBottom : "4vh";
  if (settings.arenaFieldPosition === "left") {
    arenaField.style.right = "auto";
    arenaField.style.left = settings.arenaFieldPositionLength || "0";
  } else {
    arenaField.style.left = "auto";
    arenaField.style.right = settings.arenaFieldPositionLength || "0";
  }
  arenaField.style.width = settings.arenaFieldWidth || "";
  arenaField.style.maxWidth = "100vw";
  if (!settings.arenaFieldWidth) arenaField.style.maxWidth = "480px";

  const arenaModDialog = document.createElement("dialog");
  const arenaResult = document.createElement("dialog");
  arenaResult.style.position = "fixed";
  arenaResult.style.bottom = settings.arenaResultBottom ? settings.arenaResultBottom : "4vh";
  arenaResult.style.left = "auto";
  arenaResult.style.background = "#fff";
  arenaResult.style.color = "#000";
  arenaResult.style.fontSize = "70%";
  arenaResult.style.border = "solid 1px #000";
  arenaResult.style.margin = "0";
  arenaResult.style.textAlign = "left";
  arenaResult.style.overflowY = "auto";
  arenaResult.style.zIndex = "1";

  arenaResult.style.height = settings.arenaResultHeight || "60vh";
  arenaResult.style.maxHeight = "100vh";
  arenaResult.style.width = settings.arenaResultWidth || "60%";
  arenaResult.style.maxWidth = settings.arenaResultWidth ? "100vw" : "480px";

  if (settings.arenaResultPosition === "left") {
    arenaResult.style.left = settings.arenaResultPositionLength || "0";
  } else {
    arenaResult.style.left = settings.arenaResultPositionLength || "auto";
  }

  const helpDialog = document.createElement("dialog");
  helpDialog.style.background = "#fff";
  helpDialog.style.color = "#000";
  helpDialog.style.fontSize = "80%";
  helpDialog.style.textAlign = "left";
  helpDialog.style.maxHeight = "60vh";
  helpDialog.style.width = "80vw";
  helpDialog.style.overflow = "auto";
  helpDialog.style.position = "fixed";
  helpDialog.style.bottom = "8vh";
  helpDialog.style.left = "auto";

  document.body.append(arenaResult, arenaField, helpDialog);

  // close behavior
  window.addEventListener("mousedown", (event) => {
    if (!arenaResult.contains(event.target) && !rangeAttackProcessing) arenaResult.close();
    if (!arenaModDialog.contains(event.target)) arenaModDialog.close();
    if (!helpDialog.contains(event.target)) helpDialog.close();
    if (!panel.contains(event.target)) panel.style.display = "none";
    if (settingsDialog && !settingsDialog.contains(event.target)) settingsDialog.close();
  });

  // ---------------------------
  // grid/table layout tweaks
  // ---------------------------
  const gridElm = document.querySelector(".grid");
  if (gridElm) {
    gridElm.parentNode.style.height = null;
    gridElm.style.maxWidth = "100%";
  }
  const targetTable = document.querySelector("table");
  if (targetTable) {
    targetTable.parentNode.style.maxWidth = "100%";
    targetTable.parentNode.style.overflow = "auto";
    targetTable.parentNode.style.height = "60vh";
  }

  // ---------------------------
  // SETTINGS dialog (kept minimal; your original had more items)
  // ---------------------------
  const settingsDialog = document.createElement("dialog");
  settingsDialog.style.position = "fixed";
  settingsDialog.style.top = "0";
  settingsDialog.style.background = "#f0f0f0";
  settingsDialog.style.border = "solid 1px #000";
  settingsDialog.style.padding = "2px";
  settingsDialog.style.margin = "0";
  settingsDialog.style.zIndex = "2";
  settingsDialog.style.textAlign = "left";
  settingsDialog.style.left = settings.settingsPanelPosition === "left" ? "0" : "auto";
  settingsDialog.style.width = settings.settingsPanelWidth || "400px";
  settingsDialog.style.maxWidth = "75vw";
  settingsDialog.style.height = settings.settingsPanelHeight || "96vh";
  settingsDialog.style.maxHeight = "100vh";
  document.body.append(settingsDialog);

  // open settings from submenu later
  // (your original had a “設定” button; keeping the plumbing)
  // ---------------------------
  // EQUIP panel (your original features kept mostly)
  // ---------------------------
  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.top = "0";
  panel.style.background = "#f0f0f0";
  panel.style.border = "solid 1px #000";
  panel.style.padding = "2px";
  panel.style.zIndex = "1";
  panel.style.textAlign = "left";
  panel.style.display = "none";
  panel.style.flexDirection = "column";

  if (settings.equipPanelPosition === "left") panel.style.left = "0";
  else panel.style.right = "0";
  panel.style.width = settings.equipPanelWidth || "400px";
  panel.style.maxWidth = "75vw";
  panel.style.height = settings.equipPanelHeight || "96vh";
  panel.style.maxHeight = "100vh";

  document.body.append(panel);

  equipButton.addEventListener("click", () => {
    panel.style.display = "flex";
  });

  // --- equip presets list ---
  const presetList = document.createElement("ul");
  presetList.style.listStyle = "none";
  presetList.style.margin = "0";
  presetList.style.padding = "0";
  presetList.style.borderTop = "solid 1px #000";
  presetList.style.height = "100%";
  presetList.style.overflowY = "auto";
  presetList.style.flexGrow = "1";

  const stat = document.createElement("p");
  stat.style.margin = "0";
  stat.style.height = "24px";
  stat.style.fontSize = "16px";
  stat.style.whiteSpace = "nowrap";
  stat.style.overflow = "hidden";
  stat.classList.add("equip-preset-stat");

  const topBar = document.createElement("div");
  topBar.style.marginTop = "2px";
  topBar.style.lineHeight = "normal";

  // mode
  let currentMode = "equip";
  let currentRank = "";
  let autoEquipMode = "normal";
  let selectedEquips = { id: [], rank: [] };
  let weaponTable, armorTable, necklaceTable;

  const smallBtn = document.createElement("button");
  smallBtn.type = "button";
  smallBtn.style.borderRadius = "unset";
  smallBtn.style.border = "solid 1px #000";
  smallBtn.style.background = "#ccc";
  smallBtn.style.color = "#000";
  smallBtn.style.margin = "2px";
  smallBtn.style.width = "6em";
  smallBtn.style.fontSize = "65%";
  smallBtn.style.whiteSpace = "nowrap";
  smallBtn.style.overflow = "hidden";
  smallBtn.style.lineHeight = "1";

  const addButton = smallBtn.cloneNode(true);
  addButton.textContent = "追加";
  const removeButton = smallBtn.cloneNode(true);
  removeButton.textContent = "削除";
  removeButton.dataset.text = "削除";
  removeButton.dataset.mode = "remove";

  const equipSettingsButton = smallBtn.cloneNode(true);
  equipSettingsButton.textContent = "装備登録";
  equipSettingsButton.dataset.text = "装備登録";
  equipSettingsButton.dataset.mode = "auto";

  const resetCurrentEquip = document.createElement("div");
  resetCurrentEquip.textContent = "装備情報をリセット";
  resetCurrentEquip.style.borderTop = "solid 1px #000";
  resetCurrentEquip.style.cursor = "pointer";
  resetCurrentEquip.style.color = "#a62";
  resetCurrentEquip.style.whiteSpace = "nowrap";
  resetCurrentEquip.style.overflow = "hidden";
  resetCurrentEquip.addEventListener("click", () => {
    localStorage.removeItem("current_equip");
    stat.textContent = "現在の装備情報を初期化";
    weaponTable = null;
    armorTable = null;
    necklaceTable = null;
  });

  function showEquipPreset() {
    let equipPresets = JSON.parse(localStorage.getItem("equipPresets")) || {};
    const liTemplate = document.createElement("li");
    liTemplate.style.display = "flex";
    liTemplate.style.justifyContent = "space-between";
    liTemplate.style.borderBottom = "solid 1px #000";
    liTemplate.style.color = "#428bca";
    liTemplate.style.cursor = "pointer";
    const span1 = document.createElement("span");
    span1.style.flexGrow = "1";
    span1.style.whiteSpace = "nowrap";
    span1.style.overflow = "hidden";
    const span2 = document.createElement("span");
    span2.style.whiteSpace = "nowrap";
    span2.style.textAlign = "right";
    span2.style.overflow = "hidden";
    span2.style.fontSize = "90%";
    liTemplate.append(span1, span2);

    const fragment = document.createDocumentFragment();
    Object.entries(equipPresets).forEach(([key, value]) => {
      const li = liTemplate.cloneNode(true);
      const spans = li.querySelectorAll("span");
      spans[0].textContent = key;
      spans[1].textContent = (value?.rank || []).join(",");
      fragment.append(li);
    });
    presetList.replaceChildren(fragment);
  }
  showEquipPreset();

  function saveEquipPreset(name, obj) {
    let equipPresets = JSON.parse(localStorage.getItem("equipPresets")) || {};
    equipPresets[name] = obj;
    localStorage.setItem("equipPresets", JSON.stringify(equipPresets));
    showEquipPreset();
  }

  function removePresetItems(presetName) {
    const userConfirmed = confirm(presetName + " を削除しますか？");
    if (!userConfirmed) return;

    const equipPresets = JSON.parse(localStorage.getItem("equipPresets")) || {};
    const autoEquipItems = JSON.parse(localStorage.getItem("autoEquipItems")) || {};
    const autoEquipItemsAutojoin = JSON.parse(localStorage.getItem("autoEquipItemsAutojoin")) || {};

    if (!equipPresets[presetName]) return;
    delete equipPresets[presetName];

    for (const key in autoEquipItems) {
      if (Array.isArray(autoEquipItems[key])) {
        autoEquipItems[key] = autoEquipItems[key].filter((v) => v !== presetName);
      }
    }
    for (const key in autoEquipItemsAutojoin) {
      if (Array.isArray(autoEquipItemsAutojoin[key])) {
        autoEquipItemsAutojoin[key] = autoEquipItemsAutojoin[key].filter((v) => v !== presetName);
      }
    }

    localStorage.setItem("equipPresets", JSON.stringify(equipPresets));
    localStorage.setItem("autoEquipItems", JSON.stringify(autoEquipItems));
    localStorage.setItem("autoEquipItemsAutojoin", JSON.stringify(autoEquipItemsAutojoin));
    showEquipPreset();
  }

  function selectAutoEquipItems(li, name, rank) {
    const target = autoEquipMode === "autojoin" ? "autoEquipItemsAutojoin" : "autoEquipItems";
    const items = JSON.parse(localStorage.getItem(target)) || {};
    items[rank] ||= [];

    if (getComputedStyle(li).color === "rgb(66, 139, 202)") {
      li.style.color = "rgb(202, 139, 66)";
      if (!items[rank].includes(name)) items[rank].push(name);
    } else {
      li.style.color = "rgb(66, 139, 202)";
      const idx = items[rank].indexOf(name);
      if (idx !== -1) items[rank].splice(idx, 1);
    }
    localStorage.setItem(target, JSON.stringify(items));
  }

  function resetMode() {
    const activeButton = panel.querySelector(".active");
    if (activeButton) {
      activeButton.textContent = activeButton.dataset.text;
      activeButton.classList.remove("active");
    }
    if (currentMode === "auto") {
      for (const li of presetList.querySelectorAll("li")) {
        li.style.color = "rgb(66, 139, 202)";
      }
    }
    currentMode = "equip";
    stat.textContent = "";
  }

  function setMode(mode, btn) {
    resetMode();
    currentMode = mode;
    btn.textContent = "完了";
    btn.classList.add("active");
    if (mode === "remove") stat.textContent = "削除したいものを選択";
    else if (mode === "auto") stat.textContent = "クリックで選択(複数選択可)";
  }

  removeButton.addEventListener("click", () => {
    const mode = removeButton.dataset.mode;
    if (currentMode === mode) resetMode();
    else setMode(mode, removeButton);
  });

  // equip list dialog (simplified but functional)
  const equipField = document.createElement("dialog");
  equipField.style.background = "#fff";
  equipField.style.color = "#000";
  equipField.style.maxWidth = "90vw";
  equipField.style.height = "95vh";

  const tableContainer = document.createElement("div");
  tableContainer.style.height = "75vh";
  tableContainer.style.overflow = "auto";

  const rankSelect = document.createElement("select");
  rankSelect.style.maxWidth = "64px";
  ["N", "R", "SR", "SSR", "UR"].forEach((rank) => {
    const option = document.createElement("option");
    option.textContent = rank;
    option.value = rank;
    rankSelect.append(option);
  });

  const equipSwitchButton = smallBtn.cloneNode(true);
  equipSwitchButton.textContent = "？武器";
  equipSwitchButton.style.width = "4em";
  equipSwitchButton.style.height = "42px";
  equipSwitchButton.style.fontSize = "";

  const registerButton = smallBtn.cloneNode(true);
  registerButton.textContent = "登録";
  registerButton.style.width = "4em";
  registerButton.style.height = "42px";
  registerButton.style.fontSize = "";

  const selectedP = document.createElement("p");
  selectedP.classList.add("equip-preset-selected");
  selectedP.style.background = "#fff";
  selectedP.style.color = "#000";
  selectedP.style.margin = "2px";
  selectedP.style.height = "28px";

  const bar = document.createElement("div");
  bar.style.textAlign = "center";
  bar.append(rankSelect, equipSwitchButton, registerButton, selectedP);

  const closeEquipField = smallBtn.cloneNode(true);
  closeEquipField.textContent = "×";
  closeEquipField.style.position = "absolute";
  closeEquipField.style.right = "2px";
  closeEquipField.style.top = "2px";
  closeEquipField.style.width = "40px";
  closeEquipField.style.height = "40px";
  closeEquipField.style.fontSize = "24px";
  closeEquipField.addEventListener("click", () => equipField.close());

  equipField.append(bar, tableContainer, closeEquipField);
  panel.append(equipField);

  function sortTable(table) {
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.rows);
    rows.sort((a, b) => a.cells[0].textContent.localeCompare(b.cells[0].textContent));
    rows.forEach((row) => tbody.appendChild(row));
  }

  function filterItemsByRank(rank) {
    [weaponTable, armorTable].forEach((table) => {
      if (!table) return;
      table.querySelectorAll("tbody > tr").forEach((row) => {
        const itemName = row.cells[0].textContent;
        row.style.display = itemName.includes(`[${rank}]`) ? "" : "none";
      });
    });
  }

  async function showEquipList() {
    if (!weaponTable || !armorTable || !necklaceTable) {
      const res = await fetch("https://donguri.5ch.net/bag", { cache: "no-store" });
      if (!res.ok) throw new Error("bag response error");
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/html");
      const h1 = doc.querySelector("h1");
      if (h1?.textContent !== "アイテムバッグ") throw new Error("bag parse error");

      weaponTable = doc.querySelector("#weaponTable");
      armorTable = doc.querySelector("#armorTable");
      necklaceTable = doc.querySelector("#necklaceTable");
      if (!weaponTable || !armorTable || !necklaceTable) throw new Error("table missing");

      [weaponTable, armorTable, necklaceTable].forEach((table, index) => {
        sortTable(table);
        table.style.color = "#000";
        table.style.margin = "0";

        const rows = table.querySelectorAll("tr");
        rows.forEach((row) => {
          const a = row.cells[1]?.querySelector("a");
          const id = a?.href?.replace("https://donguri.5ch.net/equip/", "");
          row.cells[0].style.textDecorationLine = "underline";
          row.cells[0].style.cursor = "pointer";
          row.cells[0].dataset.id = id || "";

          // hide bulky columns
          if (row.cells[1]) row.cells[1].style.display = "none";
          if (row.cells[2]) row.cells[2].style.display = "none";

          if (index !== 2) {
            const modLink = row.cells[7]?.querySelector("a");
            if (modLink) modLink.target = "_blank";
            if (row.cells[9]) row.cells[9].style.display = "none";
          } else {
            if (row.cells[3]) row.cells[3].style.whiteSpace = "nowrap";
            const ul = row.cells[3]?.querySelector("ul");
            if (ul) ul.style.padding = "0";
            if (row.cells[5]) row.cells[5].style.display = "none";
          }

          row.cells[0].addEventListener("click", (event) => {
            const td = event.target.closest("td");
            if (!td) return;
            const itemName = td.textContent;
            const m = itemName.match(/\[(.+?)\]/);
            if (!m) return;
            const rank = m[1];
            const id = td.dataset.id;
            selectedEquips.id[index] = id;
            selectedEquips.rank[index] = rank;
            selectedP.textContent = selectedEquips.id.join(",");
          });
        });
      });

      tableContainer.append(weaponTable, armorTable, necklaceTable);
    }

    equipSwitchButton.textContent = "？武器";
    weaponTable.style.display = "";
    armorTable.style.display = "none";
    necklaceTable.style.display = "none";

    filterItemsByRank(rankSelect.value);
    selectedP.textContent = "";
    equipField.showModal();
  }

  rankSelect.addEventListener("change", () => filterItemsByRank(rankSelect.value));
  equipSwitchButton.addEventListener("click", (e) => {
    if (weaponTable && weaponTable.style.display !== "none") {
      weaponTable.style.display = "none";
      armorTable.style.display = "";
      necklaceTable.style.display = "none";
      e.target.textContent = "？防具";
    } else if (armorTable && armorTable.style.display !== "none") {
      weaponTable.style.display = "none";
      armorTable.style.display = "none";
      necklaceTable.style.display = "";
      e.target.textContent = "？首";
    } else {
      weaponTable.style.display = "";
      armorTable.style.display = "none";
      necklaceTable.style.display = "none";
      e.target.textContent = "？武器";
    }
  });

  // register preset name dialog
  const registerDialog = document.createElement("dialog");
  registerDialog.style.background = "#fff";
  registerDialog.style.border = "solid 1px #000";
  registerDialog.style.color = "#000";
  registerDialog.style.textAlign = "center";

  const presetNameInput = document.createElement("input");
  presetNameInput.placeholder = "プリセット名";
  presetNameInput.style.background = "#fff";
  presetNameInput.style.color = "#000";

  const registerInfo = document.createElement("p");
  registerInfo.textContent = "同名のプリセットが存在する場合は上書きされます。";
  registerInfo.style.margin = "0";

  const savePresetBtn = smallBtn.cloneNode(true);
  savePresetBtn.textContent = "保存";
  savePresetBtn.addEventListener("click", () => {
    if (presetNameInput.value.trim() === "") return;
    saveEquipPreset(presetNameInput.value.substring(0, 32), selectedEquips);
    registerDialog.close();
    presetNameInput.value = "";
  });

  const cancelPresetBtn = smallBtn.cloneNode(true);
  cancelPresetBtn.textContent = "キャンセル";
  cancelPresetBtn.addEventListener("click", () => registerDialog.close());

  registerDialog.append(presetNameInput, savePresetBtn, cancelPresetBtn, registerInfo);
  equipField.append(registerDialog);

  registerButton.addEventListener("click", () => {
    if (!selectedEquips.id[0] && !selectedEquips.id[1] && !selectedEquips.id[2]) {
      alert("装備が未選択です");
      return;
    }
    registerDialog.showModal();
  });

  addButton.addEventListener("click", async () => {
    selectedEquips = { id: [], rank: [] };
    addButton.disabled = true;
    try {
      await showEquipList();
    } finally {
      addButton.disabled = false;
    }
  });

  // equip settings dialog (rank buttons)
  const equipSettingsDialog = document.createElement("dialog");
  equipSettingsDialog.style.background = "#fff";
  equipSettingsDialog.style.color = "#000";
  equipSettingsDialog.style.padding = "1px";
  equipSettingsDialog.style.maxWidth = "280px";

  (() => {
    const div = document.createElement("div");
    div.style.display = "grid";
    div.style.gap = "2px";
    div.style.gridTemplateColumns = "repeat(2, 4em)";
    div.style.justifyContent = "center";

    const ranks = ["N", "Ne", "R", "Re", "SR", "SRe", "SSR", "SSRe", "UR", "URe"];
    ranks.forEach((rank) => {
      const rankButton = smallBtn.cloneNode(true);
      rankButton.style.width = "100px";
      rankButton.textContent = rank;
      rankButton.addEventListener("click", () => {
        currentRank = rank;
        currentMode = "auto";
        setMode("auto", equipSettingsButton);

        const target = autoEquipMode === "autojoin" ? "autoEquipItemsAutojoin" : "autoEquipItems";
        const items = JSON.parse(localStorage.getItem(target)) || {};
        if (items[rank]) {
          const li = [...presetList.querySelectorAll("li")];
          const registeredItems = li.filter((elm) => items[rank].includes(elm.querySelector("span")?.textContent));
          for (const e of registeredItems) e.style.color = "rgb(202, 139, 66)";
        }
        equipSettingsDialog.close();
      });
      div.append(rankButton);
    });

    const closeButton = smallBtn.cloneNode(true);
    closeButton.style.width = "100px";
    closeButton.style.background = "#caa";
    closeButton.textContent = "×";
    closeButton.addEventListener("click", () => equipSettingsDialog.close());

    const div2 = document.createElement("div");
    div2.style.textAlign = "center";

    const toggleButton = smallBtn.cloneNode(true);
    toggleButton.textContent = "対戦用";
    toggleButton.style.width = "7em";
    toggleButton.style.background = "#acc";
    toggleButton.addEventListener("click", () => {
      if (autoEquipMode === "normal") {
        autoEquipMode = "autojoin";
        toggleButton.textContent = "自動参加用";
      } else {
        autoEquipMode = "normal";
        toggleButton.textContent = "対戦用";
      }
    });

    const label = document.createElement("label");
    label.style.fontSize = "80%";
    const checkRandom = document.createElement("input");
    checkRandom.type = "checkbox";
    if (settings.autoEquipRandomly) checkRandom.checked = true;
    checkRandom.addEventListener("change", () => {
      settings.autoEquipRandomly = checkRandom.checked;
      localStorage.setItem("aat_settings", JSON.stringify(settings));
    });
    label.append(checkRandom, "ランダム装備");

    div.append(closeButton);
    div2.append(toggleButton, label);

    const description = document.createElement("div");
    description.innerText =
      "対戦に使用する装備を選択してください。バトル開始前に自動的に装備を変更します。\n複数登録した場合は開始時に装備するものを選択します。\n※自動参加用が登録されていれば優先されます。";
    description.style.fontSize = "70%";

    equipSettingsDialog.append(div, div2, description);
  })();

  equipSettingsButton.addEventListener("click", () => {
    equipSettingsDialog.showModal();
    resetMode();
  });

  presetList.addEventListener("click", (event) => {
    const presetLi = event.target.closest("li");
    if (!presetLi) return;
    const presetName = presetLi.querySelector("span")?.textContent;
    if (!presetName) return;

    if (currentMode === "equip") {
      setPresetItems(presetName).catch(() => {});
      // auto equip OFF when manual equip
      shouldSkipAutoEquip = true;
      settings.skipAutoEquip = true;
      localStorage.setItem("aat_settings", JSON.stringify(settings));
    } else if (currentMode === "remove") {
      removePresetItems(presetName);
    } else if (currentMode === "auto") {
      selectAutoEquipItems(presetLi, presetName, currentRank);
    }
  });

  // buttons in topBar
  const buttonsContainer = document.createElement("div");
  buttonsContainer.style.display = "flex";
  const rowBtns = document.createElement("div");
  rowBtns.style.display = "flex";
  rowBtns.style.flexWrap = "nowrap";
  rowBtns.style.overflowX = "auto";
  rowBtns.style.width = "max-content";
  rowBtns.append(addButton, removeButton, equipSettingsButton);
  buttonsContainer.append(rowBtns);

  topBar.append(buttonsContainer, equipSettingsDialog, stat);
  panel.append(topBar, resetCurrentEquip, presetList);

  // ---------------------------
  // Equip: apply preset (your original logic)
  // ---------------------------
  async function setPresetItems(presetName) {
    let currentEquip = JSON.parse(localStorage.getItem("current_equip")) || [];
    if (stat.textContent === "装備中...") return;

    const equipPresets = JSON.parse(localStorage.getItem("equipPresets")) || {};
    if (!equipPresets[presetName]) throw new Error("プリセットが見つかりません");

    const fetchPromises = equipPresets[presetName].id
      .filter((id) => id !== undefined && id !== null && !currentEquip.includes(id))
      .map((id) => fetch("https://donguri.5ch.net/equip/" + id, { cache: "no-store" }));

    stat.textContent = "装備中...";
    try {
      const responses = await Promise.all(fetchPromises);
      const texts = await Promise.all(
        responses.map(async (response) => {
          if (!response.ok) throw new Error(`[${response.status}] /equip/`);
          return response.text();
        })
      );

      if (texts.some((t) => t.includes("どんぐりが見つかりませんでした。"))) {
        throw new Error("再ログインしてください");
      }
      if (texts.some((t) => t.includes("アイテムが見つかりませんでした。"))) {
        throw new Error("アイテムが見つかりませんでした");
      }

      const docs = texts.map((t) => new DOMParser().parseFromString(t, "text/html"));
      const titles = docs.map((doc) => doc.querySelector("h1")?.textContent);
      if (titles.includes("どんぐり基地")) throw new Error("再ログインしてください");
      if (!titles.every((title) => title === "アイテムバッグ")) throw new Error("装備エラー");

      stat.textContent = "完了: " + presetName;
      localStorage.setItem("current_equip", JSON.stringify(equipPresets[presetName].id));
      currentEquipName = presetName;
    } catch (e) {
      stat.textContent = String(e);
      localStorage.removeItem("current_equip");
      throw e;
    }
  }

  // ---------------------------
  // TOOL LAYER: refresh arena info (FIX: fetch url)
  // ---------------------------
  async function refreshArenaInfo() {
    const refreshedCells = [];
    const includesCoord = (arr, row, col) => arr.some(([r, c]) => r === Number(row) && c === Number(col));

    try {
      const url = location.pathname + location.search;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("res.ng");

      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/html");
      const headerText = doc?.querySelector("header")?.textContent || "";
      if (!headerText.includes("どんぐりチーム戦い")) throw new Error("title.ng info");

      const gridWrap = document.getElementById("gridWrap");
      if (!gridWrap) throw new Error("gridWrap not found");

      let toolLayer = document.getElementById("aat_tool_layer");
      if (!toolLayer) {
        toolLayer = document.createElement("div");
        toolLayer.id = "aat_tool_layer";
        toolLayer.style.position = "absolute";
        toolLayer.style.top = "0";
        toolLayer.style.left = "0";
        toolLayer.style.display = "grid";
        toolLayer.style.zIndex = "100";
        gridWrap.appendChild(toolLayer);
      }
      const grid = toolLayer;

      const inlineScripts = [...doc.querySelectorAll("script:not([src])")]
        .map((s) => s.textContent || "")
        .join("\n");

      // cellColors
      let cellColors = {};
      const cellColorsMatch = inlineScripts.match(/const\s+cellColors\s*=\s*({[\s\S]+?});/);
      if (cellColorsMatch) {
        const raw = cellColorsMatch[1].replace(/'/g, '"').replace(/,\s*}/g, "}");
        try {
          cellColors = JSON.parse(raw);
        } catch {}
      }

      // capital list/map
      let capitalMap = [];
      const cap1 = inlineScripts.match(/const\s+capitalList\s*=\s*(\[[\s\S]*?\]);/);
      const cap2 = inlineScripts.match(/const\s+capitalMap\s*=\s*(\[[\s\S]*?\]);/);
      const rawCap = (cap1 && cap1[1]) || (cap2 && cap2[1]);
      if (rawCap) {
        try {
          capitalMap = JSON.parse(rawCap);
        } catch {}
      }

      // grid size
      let rows = 0;
      const gridSizeMatch = inlineScripts.match(/const\s+GRID_SIZE\s*=\s*(\d+);/);
      rows = gridSizeMatch ? Number(gridSizeMatch[1]) : 13;
      const cols = rows;

      const gridBase = document.getElementById("gridBase");
      const currentCellSize = gridBase ? parseInt(gridBase.style.width) / rows + "px" : "32px";

      const currentCells = grid.querySelectorAll(".cell");

      if (currentCells.length !== rows * cols) {
        grid.style.gridTemplateRows = `repeat(${rows}, ${currentCellSize})`;
        grid.style.gridTemplateColumns = `repeat(${cols}, ${currentCellSize})`;
        grid.innerHTML = "";

        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.row = i;
            cell.dataset.col = j;
            cell.style.width = currentCellSize;
            cell.style.height = currentCellSize;
            cell.style.border = "1px solid rgba(204, 204, 204, 0.5)";
            cell.style.cursor = "pointer";
            cell.style.pointerEvents = "auto";
            cell.style.boxSizing = "border-box";
            cell.style.display = "flex";
            cell.style.alignItems = "center";
            cell.style.justifyContent = "center";
            cell.style.fontSize = "12px";
            cell.style.fontWeight = "bold";

            if (includesCoord(capitalMap, i, j)) {
              cell.style.outline = "2px solid gold";
              cell.style.outlineOffset = "-2px";
            }

            const cellKey = `${i}-${j}`;
            if (cellColors[cellKey]) {
              const hex = cellColors[cellKey];
              cell.style.backgroundColor = hex + "44";
            }

            cell.addEventListener("click", (e) => {
              e.stopPropagation();
              handleCellClick(cell);
            });

            grid.appendChild(cell);
            refreshedCells.push(cell);
          }
        }
      }

      // replace tables (team table etc)
      const tables = document.querySelectorAll("table");
      const newTables = doc.querySelectorAll("table");
      newTables.forEach((table, i) => {
        if (tables[i]) tables[i].replaceWith(table);
      });

      addCustomColor();
      return refreshedCells;
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async function fetchAreaInfo(refreshAll) {
    const refreshedCells = await refreshArenaInfo();
    const grid = document.getElementById("aat_tool_layer");
    if (!grid) return;

    if (currentViewMode === "detail") {
      grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace("35px", "65px");
      grid.style.gridTemplateColumns = grid.style.gridTemplateColumns.replace("35px", "105px");
    }

    if (grid.parentNode) {
      grid.parentNode.style.height = null;
      grid.parentNode.style.padding = "20px 0";
    }

    const cells = grid.querySelectorAll(".cell");
    cells.forEach((elm) => {
      const hasInfo = elm.dataset.rank !== undefined;
      const isRefreshed = (refreshedCells || []).includes(elm);
      if (refreshAll || !hasInfo || isRefreshed) fetchSingleArenaInfo(elm);
    });
  }

  async function fetchSingleArenaInfo(elm) {
    try {
      const { row, col } = elm.dataset;
      const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&` + MODE;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status + " res.ng");
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/html");

      const headerText = doc?.querySelector("header")?.textContent || "";
      if (!headerText.includes("どんぐりチーム戦い")) throw new Error(`title.ng [${row}][${col}]`);

      const rank = doc.querySelector("small")?.textContent || "";
      if (!rank) return;

      const leader = doc.querySelector("strong")?.textContent || "";
      const shortenRank = rank
        .replace("[エリート]", "e")
        .replace("[警備員]だけ", "警")
        .replace("から", "-")
        .replace(/(まで|\[|\]|\||\s)/g, "");
      const teamname = doc.querySelector("table")?.rows?.[1]?.cells?.[2]?.textContent || "";

      const cell = elm.cloneNode(false);
      cell.className = "cell";
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.style.width = elm.style.width;
      cell.style.height = elm.style.height;
      cell.style.cursor = "pointer";
      cell.style.pointerEvents = "auto";
      cell.style.boxSizing = "border-box";
      cell.style.display = "flex";
      cell.style.flexDirection = "column";
      cell.style.alignItems = "center";
      cell.style.justifyContent = "center";
      cell.style.overflow = "visible";

      if (currentViewMode === "detail") {
        const p0 = document.createElement("p");
        const p1 = document.createElement("p");
        p0.textContent = shortenRank;
        p1.textContent = leader;
        p0.style.cssText =
          "margin:0; line-height:1.1; color:#000; text-shadow:1px 1px 0 #fff; font-weight:bold; pointer-events:none;";
        p1.style.cssText =
          "margin:0; line-height:1.1; color:#000; text-shadow:1px 1px 0 #fff; font-size:12px; pointer-events:none;";
        cell.style.borderWidth = "3px";
        cell.append(p0, p1);
      } else {
        const p = document.createElement("p");
        p.style.cssText =
          "margin:0; display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:#000; text-shadow:1px 1px 0 #fff; font-weight:bold; pointer-events:none;";
        const str = shortenRank.replace(/\w+-|だけ/g, "");
        p.textContent = str;
        if (str.length === 3) p.style.fontSize = "14px";
        else if (str.length >= 4) p.style.fontSize = "12px";
        else p.style.fontSize = "16px";
        cell.append(p);
      }

      cell.dataset.rank = shortenRank;
      cell.dataset.leader = leader;
      cell.dataset.team = teamname;

      if (settings.customColors && teamname in settings.customColors) {
        cell.style.backgroundColor = "#" + settings.customColors[teamname];
      } else {
        cell.style.backgroundColor = elm.style.backgroundColor || "rgba(255,255,255,0.5)";
      }

      cell.addEventListener("click", (e) => {
        e.stopPropagation();
        handleCellClick(cell);
      });

      elm.replaceWith(cell);
    } catch (e) {
      console.error(e);
    }
  }

  // ---------------------------
  // Custom color editor (kept)
  // ---------------------------
  function addCustomColor() {
    const teamTable = document.querySelector("table");
    if (!teamTable) return;

    const rows = [...teamTable.rows];
    if (rows.length === 0) return;
    rows.shift();

    const btn = document.createElement("button");
    btn.style.padding = "4px";
    btn.style.lineHeight = "1";
    btn.style.marginLeft = "2px";

    const editButton = btn.cloneNode(true);
    editButton.textContent = "▼";

    const editEndButton = btn.cloneNode(true);
    editEndButton.textContent = "？";
    editEndButton.style.display = "none";

    editButton.addEventListener("click", () => {
      editButton.style.display = "none";
      editEndButton.style.display = "";

      rows.forEach((row) => {
        const cell = row.cells[0];
        const cellColor = cell.textContent;
        const input = document.createElement("input");
        input.type = "text";
        input.value = cellColor;
        input.style.width = "6em";
        input.addEventListener("change", () => {
          if (input.value === "") {
            if (settings.customColors) {
              const teamname = row.cells[1].textContent;
              delete settings.customColors[teamname];
              localStorage.setItem("aat_settings", JSON.stringify(settings));
            }
            return;
          }
          const isValidColor = /^[0-9A-Fa-f]{6}$/.test(input.value);
          if (!isValidColor) {
            input.value = cellColor;
            return;
          }
          const teamname = row.cells[1].textContent;
          settings.customColors ||= {};
          settings.customColors[teamname] = input.value;
          localStorage.setItem("aat_settings", JSON.stringify(settings));
          cell.style.background = "#" + input.value;
          row.cells[0].style.fontStyle = "italic";
        });
        cell.textContent = "";
        cell.append(input);
      });
    });

    editEndButton.addEventListener("click", () => {
      editButton.style.display = "";
      editEndButton.style.display = "none";
      rows.forEach((row) => {
        const cell = row.cells[0];
        const input = cell.querySelector("input");
        if (!input) return;
        cell.textContent = input.value;
        input.remove();
      });
    });

    const helpButton = btn.cloneNode(true);
    helpButton.textContent = "？";
    helpButton.addEventListener("click", () => {
      helpDialog.innerHTML = "";
      const div = document.createElement("div");
      div.style.lineHeight = "150%";
      div.innerText =
        "・[▼]を押すと色を編集できます。編集後は一度[エリア情報更新]を実行してください。\n" +
        "・入力欄の文字を全て消して保存すると、そのチームのカスタム色を解除します。";

      const resetButton = btn.cloneNode(true);
      resetButton.textContent = "色設定初期化";
      resetButton.addEventListener("click", () => {
        delete settings.customColors;
        localStorage.setItem("aat_settings", JSON.stringify(settings));
        alert("色の設定を初期化しました（要エリア更新）");
      });

      helpDialog.append(resetButton, div);
      helpDialog.show();
    });

    teamTable.rows[0].cells[0].append(editButton, editEndButton, helpButton);

    // apply saved colors
    if (!settings.customColors) return;
    rows.forEach((row) => {
      const teamname = row.cells[1].textContent;
      if (teamname in settings.customColors) {
        const color = settings.customColors[teamname];
        row.cells[0].textContent = color;
        row.cells[0].style.background = "#" + color;
        row.cells[0].style.fontStyle = "italic";
      }
    });
  }

  addCustomColor();

  // ---------------------------
  // Cell click behavior
  // ---------------------------
  async function handleCellClick(cell) {
    if (cellSelectorActivate) {
      if (cell.classList.contains("selected")) {
        cell.style.borderColor = "#ccc";
        cell.classList.remove("selected");
      } else {
        cell.style.borderColor = "#f64";
        cell.classList.add("selected");
      }
      return;
    }

    const { row, col, rank } = cell.dataset;

    if (shouldSkipAreaInfo) {
      if (arenaField.open) fetchArenaTable(row, col);
      await autoEquipAndChallenge(row, col, rank);
    } else {
      fetchArenaTable(row, col);
    }
  }

  // ---------------------------
  // Arena table dialog
  // ---------------------------
  async function fetchArenaTable(row, col) {
    const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&` + MODE;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("res.ng");
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/html");
      const headerText = doc?.querySelector("header")?.textContent || "";
      if (!headerText.includes("どんぐりチーム戦い")) throw new Error("title.ng");

      const table = doc.querySelector("table");
      if (!table) throw new Error("table.ng");
      showArenaTable(table);
    } catch (e) {
      console.error(e);
    }

    function showArenaTable(table) {
      const tableRow = table.querySelector("tbody > tr");
      if (!tableRow) return;

      const coordinate = tableRow.cells[0].textContent.replace("アリーナ", "").trim();
      const holderName = tableRow.cells[1].querySelector("strong");
      const equipCond = tableRow.cells[1].querySelector("small");
      const teamName = tableRow.cells[2].textContent;
      const statistics = tableRow.cells[3].textContent.match(/\d+/g) || ["0", "0", "0"];
      const modCounts = tableRow.cells[4].textContent.match(/\d+/g) || ["0", "0"];
      const modders = tableRow.cells[5].textContent;

      const newTable = document.createElement("table");
      const tbody = document.createElement("tbody");
      const tr = tbody.insertRow(0);

      const tdBase = document.createElement("td");
      tdBase.style.textAlign = "center";
      const cells = [];
      for (let i = 0; i < 4; i++) {
        cells.push(tdBase.cloneNode(true));
        tr.append(cells[i]);
      }
      const hr = document.createElement("hr");
      hr.style.margin = "10px 0";

      cells[0].append(coordinate, hr, equipCond);
      cells[1].append(holderName, document.createElement("br"), `${teamName}`);
      cells[2].innerText = `勝:${statistics[0]}\n負:${statistics[1]}\n引:${statistics[2]}`;
      cells[3].innerText = `強化:${modCounts[0]}\n弱体:${modCounts[1]}\n${modders}人`;
      cells[3].style.whiteSpace = "nowrap";

      const [dataRow, dataCol] = coordinate.match(/\d+/g) || [row, col];
      newTable.dataset.row = dataRow;
      newTable.dataset.col = dataCol;
      newTable.dataset.rank = equipCond?.textContent || "";
      newTable.style.background = "#fff";
      newTable.style.color = "#000";
      newTable.style.margin = "0";
      newTable.append(tbody);

      const old = arenaField.querySelector("table");
      if (old) old.replaceWith(newTable);
      else arenaField.append(newTable);
      arenaField.show();
    }
  }

  // ---------------------------
  // Auto equip + challenge
  // ---------------------------
  const autoEquipDialog = document.createElement("dialog");
  autoEquipDialog.style.padding = "0";
  autoEquipDialog.style.background = "#fff";
  document.body.append(autoEquipDialog);

  async function autoEquipAndChallenge(row, col, rank) {
    if (shouldSkipAutoEquip) {
      await arenaChallenge(row, col);
      return;
    }
    const normRank = String(rank || "")
      .replace("エリート", "e")
      .replace(/.+から|\w+-|まで|だけ|警備員|警|\s|\[|\]|\|/g, "");

    const autoEquipItems = JSON.parse(localStorage.getItem("autoEquipItems")) || {};
    const list = autoEquipItems[normRank];

    if (list && !list.includes(currentEquipName)) {
      if (list.length === 0) {
        await arenaChallenge(row, col);
        return;
      }
      if (list.length === 1) {
        await setPresetItems(list[0]);
        await arenaChallenge(row, col);
        return;
      }
      if (settings.autoEquipRandomly) {
        const idx = Math.floor(Math.random() * list.length);
        await setPresetItems(list[idx]);
        await arenaChallenge(row, col);
        return;
      }

      autoEquipDialog.replaceChildren();
      const ul = document.createElement("ul");
      ul.style.background = "#fff";
      ul.style.listStyle = "none";
      ul.style.padding = "2px";
      ul.style.textAlign = "left";
      ul.style.margin = "0";

      const liTemplate = document.createElement("li");
      liTemplate.style.borderBottom = "solid 1px #000";
      liTemplate.style.color = "#428bca";
      liTemplate.style.cursor = "pointer";

      list.forEach((v) => {
        const li = liTemplate.cloneNode(true);
        li.textContent = v;
        li.addEventListener("click", async () => {
          autoEquipDialog.close();
          await setPresetItems(v);
          await arenaChallenge(row, col);
        });
        ul.append(li);
      });

      autoEquipDialog.append(ul);
      autoEquipDialog.showModal();
      return;
    }

    await arenaChallenge(row, col);
  }

  async function arenaChallenge(row, col) {
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `row=${row}&col=${col}`,
    };

    try {
      const response = await fetch("/teamchallenge?" + MODE, options);
      if (!response.ok) throw new Error("/teamchallenge res.ng");

      const text = await response.text();
      const lastLine = text.trim().split("\n").pop() || "";

      arenaResult.textContent = "";
      if (text.includes("\n")) {
        const p = document.createElement("p");
        p.textContent = lastLine;
        p.style.fontWeight = "bold";
        p.style.padding = "0";
        p.style.margin = "0";
        arenaResult.append(p);
        arenaResult.append(document.createTextNode("\n" + text));
      } else {
        arenaResult.textContent = text;
      }

      arenaResult.show();

      setTimeout(() => {
        if (settings.arenaResultScrollPosition === "bottom") arenaResult.scrollTop = arenaResult.scrollHeight;
        else arenaResult.scrollTop = 0;
      }, 0);

      if (lastLine === "リーダーになった" || lastLine.includes("は新しいアリーナリーダーです。")) {
        if (!settings.teamColor) return;
        const cell = document.querySelector(`div[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
          cell.style.background = "#" + settings.teamColor;
          fetchSingleArenaInfo(cell);
        }
      }
    } catch (e) {
      arenaResult.textContent = String(e);
      arenaResult.show();
    }
  }

  // ---------------------------
  // Range attack (kept)
  // ---------------------------
  let rangeAttackQueue = [];
  async function rangeAttack() {
    if (rangeAttackQueue.length === 0) rangeAttackQueue = [...document.querySelectorAll(".cell.selected")];
    if (rangeAttackQueue.length === 0) {
      alert("セルを選択してください");
      return false;
    }

    const pTemplate = document.createElement("p");
    pTemplate.style.padding = "0";
    pTemplate.style.margin = "0";

    let errorOccurred = false;
    arenaResult.textContent = "";
    arenaResult.show();

    while (rangeAttackQueue.length > 0) {
      if (!rangeAttackProcessing) return false;

      const cell = rangeAttackQueue[0];
      if (!cell.classList.contains("selected")) {
        rangeAttackQueue.shift();
        continue;
      }

      const { row, col } = cell.dataset;
      const options = {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `row=${row}&col=${col}`,
      };
      cell.style.borderColor = "#4f6";

      try {
        const response = await fetch("/teamchallenge?" + MODE, options);
        const text = await response.text();
        const lastLine = text.trim().split("\n").pop() || "";

        if (
          lastLine.length > 100 ||
          lastLine === "どんぐりが見つかりませんでした。" ||
          lastLine === "あなたのチームは動きを使い果たしました。しばらくお待ちください。" ||
          lastLine === "ng<>too fast" ||
          lastLine === "武器と防具を装備しなければなりません。" ||
          lastLine === "最初にチームに参加する必要があります。"
        ) {
          throw new Error(lastLine || "error");
        }

        const p = pTemplate.cloneNode(true);
        p.textContent = `(${row}, ${col}) ${lastLine}`;
        arenaResult.prepend(p);
        rangeAttackQueue.shift();
      } catch (e) {
        const p = pTemplate.cloneNode(true);
        p.textContent = `(${row}, ${col}) [中断] ${e}`;
        arenaResult.prepend(p);
        errorOccurred = true;
        break;
      }

      if (rangeAttackQueue.length > 0) await new Promise((r) => setTimeout(r, 1500));
      cell.style.borderColor = cell.classList.contains("selected") ? "#f64" : "#ccc";
    }

    if (!errorOccurred) {
      const p = pTemplate.cloneNode(true);
      p.textContent = "完了";
      arenaResult.prepend(p);
      return true;
    }
    return false;
  }

  // ---------------------------
  // View toggle (tool layer only)
  // ---------------------------
  function toggleCellViewMode() {
    const grid = document.getElementById("aat_tool_layer");
    if (!grid) return;
    const cells = grid.querySelectorAll(".cell");

    if (currentViewMode === "detail") {
      currentViewMode = "compact";
      grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace("65px", "35px");
      grid.style.gridTemplateColumns = grid.style.gridTemplateColumns.replace("105px", "35px");

      for (const cell of cells) {
        cell.style.width = "30px";
        cell.style.height = "30px";
        cell.style.borderWidth = "1px";
        while (cell.firstChild) cell.firstChild.remove();

        const p = document.createElement("p");
        p.style.height = "28px";
        p.style.width = "28px";
        p.style.margin = "0";
        p.style.display = "flex";
        p.style.alignItems = "center";
        p.style.lineHeight = "1";
        p.style.justifyContent = "center";

        const rank = (cell.dataset.rank || "").replace(/\w+-|だけ/g, "");
        p.textContent = rank;
        if (rank.length === 3) p.style.fontSize = "14px";
        if (rank.length === 4) p.style.fontSize = "13px";
        cell.append(p);
      }
    } else {
      currentViewMode = "detail";
      grid.style.gridTemplateRows = grid.style.gridTemplateRows.replace("35px", "65px");
      grid.style.gridTemplateColumns = grid.style.gridTemplateColumns.replace("35px", "105px");

      for (const cell of cells) {
        while (cell.firstChild) cell.firstChild.remove();
        const { rank, leader } = cell.dataset;
        const p0 = document.createElement("p");
        const p1 = document.createElement("p");
        p0.textContent = rank || "";
        p1.textContent = leader || "";
        p0.style.margin = "0";
        p1.style.margin = "0";
        cell.style.width = "100px";
        cell.style.height = "60px";
        cell.style.borderWidth = "3px";
        cell.append(p0, p1);
      }
    }
  }

  // ---------------------------
  // AUTO JOIN (complete fix)
  //   - fixed getRegions(): no longer depends on ".grid > script"
  //   - fixed fetch(''): now fetch current teambattle page
  //   - added null-guard for regions
  // ---------------------------
  let autoJoinIntervalId = null;
  let isAutoJoinRunning = false;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function startAutoJoin() {
    if (progressBarIntervalId) clearInterval(progressBarIntervalId);
    progressBarIntervalId = null;
    autoJoin().catch(console.error);
  }

  // minimal autoJoin UI (log dialog)
  const autoJoinDialog = document.createElement("dialog");
  autoJoinDialog.style.background = "#fff";
  autoJoinDialog.style.color = "#000";
  autoJoinDialog.style.width = "90vw";
  autoJoinDialog.style.height = "90vh";
  autoJoinDialog.style.fontSize = "80%";
  autoJoinDialog.style.textAlign = "center";
  autoJoinDialog.style.marginTop = "2vh";
  autoJoinDialog.classList.add("auto-join");
  document.body.append(autoJoinDialog);

  const autoJoinLog = document.createElement("div");
  autoJoinLog.style.margin = "2px";
  autoJoinLog.style.border = "solid 1px #000";
  autoJoinLog.style.overflow = "auto";
  autoJoinLog.style.height = "75vh";
  autoJoinLog.style.textAlign = "left";
  autoJoinLog.classList.add("auto-join-log");

  const autoJoinClose = document.createElement("button");
  autoJoinClose.textContent = "自動参加モードを終了";
  autoJoinClose.addEventListener("click", () => autoJoinDialog.close());

  autoJoinDialog.append(autoJoinLog, autoJoinClose);

  // add submenu buttons: skipAutoEquip + autoJoin
  const subBtn = buttonBase.cloneNode(true);
  subBtn.style.fontSize = "65%";
  subBtn.style.width = "6em";
  subBtn.style.border = "none";
  subBtn.style.padding = "2px";

  const row2 = document.createElement("div");
  row2.style.display = "flex";
  row2.style.flex = "1";
  row2.style.justifyContent = "center";
  row2.style.gap = "2px";
  row2.style.overflowX = "auto";
  row2.style.height = "100%";

  const skipAutoEquipButton = subBtn.cloneNode(true);
  skipAutoEquipButton.textContent = "自動装備";
  skipAutoEquipButton.style.color = "#fff";
  skipAutoEquipButton.style.background = shouldSkipAutoEquip ? "#888" : "#46f";
  skipAutoEquipButton.addEventListener("click", () => {
    shouldSkipAutoEquip = !shouldSkipAutoEquip;
    skipAutoEquipButton.style.background = shouldSkipAutoEquip ? "#888" : "#46f";
    settings.skipAutoEquip = shouldSkipAutoEquip;
    localStorage.setItem("aat_settings", JSON.stringify(settings));
  });

  const autoJoinButton = subBtn.cloneNode(true);
  autoJoinButton.innerText = "自動参加\nモード";
  autoJoinButton.style.background = "#ffb300";
  autoJoinButton.style.color = "#000";
  autoJoinButton.addEventListener("click", () => {
    autoJoinDialog.showModal();
    startAutoJoin();
  });

  row2.append(skipAutoEquipButton, autoJoinButton);
  subMenu.append(row2);

  function logMessage(region, message, nextText) {
    const date = new Date();
    const ymd = date.toLocaleDateString("sv-SE").slice(2);
    const time = date.toLocaleTimeString("sv-SE");

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.gap = "4px";
    wrap.style.alignItems = "center";
    wrap.style.border = "solid 0.5px #888";

    const ts = document.createElement("div");
    ts.innerText = `${ymd}\n${time}`;
    ts.style.fontSize = "90%";
    ts.style.color = "#666";
    ts.style.borderRight = "solid 0.5px #888";
    ts.style.whiteSpace = "nowrap";

    const regionDiv = document.createElement("div");
    const progress = `${currentPeriod}期 ${currentProgress}%`;
    regionDiv.innerText = region ? `${progress}\ntarget: ${region}\n${nextText || ""}` : nextText || "";
    regionDiv.style.fontSize = "90%";
    regionDiv.style.color = "#444";
    regionDiv.style.borderRight = "dotted 0.5px #888";
    regionDiv.style.whiteSpace = "nowrap";

    const msg = document.createElement("div");
    msg.textContent = message;

    wrap.append(ts, regionDiv, msg);
    autoJoinLog.prepend(wrap);
  }

  const messageTypes = {
    breaktime: [
      "チームに参加または離脱してから間もないため、次のバトルが始まるまでお待ちください。",
      "もう一度バトルに参加する前に、待たなければなりません。",
      "ng: ちょっとゆっくり",
    ],
    toofast: ["ng<>too fast"],
    retry: ["あなたのチームは動きを使い果たしました。しばらくお待ちください。"],
    reset: ["このタイルは攻撃できません。範囲外です。"],
    quit: [
      "最初にチームに参加する必要があります。",
      "どんぐりが見つかりませんでした。",
      "あなたのどんぐりが理解できませんでした。",
      "レベルが低すぎます。",
    ],
    guardError: ["[警備員]だけ"],
    equipError: [
      "武器と防具を装備しなければなりません。",
      "装備している防具と武器が力不足です。",
      "装備している防具と武器が強すぎます",
      "装備しているものは改造が多すぎます。改造の少ない他のものをお試しください",
      "参加するには、装備中の武器と防具のアイテムID",
    ],
    nonAdjacent: [
      "このタイルは攻撃できません。あなたのチームが首都を持つまで、どの首都にも隣接するタイルを主張することはできません。",
      "あなたのチームは首都を持っていないため、他のチームの首都に攻撃できません。",
    ],
    teamAdjacent: [
      "このタイルは攻撃できません。あなたのチームの制御領土に隣接していなければなりません。",
      "このタイルは攻撃できません。首都を奪取するには、隣接タイルを少なくとも3つ支配している必要があります。",
      "このタイルは攻撃できません。首都を奪取するには、隣接タイルを少なくとも2つ支配している必要があります。",
      "このタイルは攻撃できません。首都を奪取するには、隣接タイルを少なくとも1つ支配している必要があります。",
      "このタイルは攻撃できません。自分の首都は攻撃できません。",
      "この首都は攻撃できません。相手の総タイル数の少なくとも",
    ],
    capitalAdjacent: ["このタイルは攻撃できません。混雑したマップでは、初期主張は正確に1つの首都に隣接していなければなりません。"],
    mapEdge: ["このタイルは攻撃できません。混雑したマップでは、初期主張はマップの端でなければなりません。"],
  };

  function getMessageType(text) {
    return Object.keys(messageTypes).find((key) => messageTypes[key].some((v) => text.includes(v)));
  }

  async function autoJoin() {
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };

    // team color/name (rb auto-detect)
    let teamColor = settings.teamColor || "";
    let teamName = settings.teamName || "";

    let nextProgress = null;

    async function challenge(region) {
      const [row, col] = region;
      const body = `row=${row}&col=${col}`;
      const res = await fetch("/teamchallenge?" + MODE, { method: "POST", body, headers });
      if (!res.ok) throw new Error(res.status);
      const text = await res.text();
      const lastLine = text.trim().split("\n").pop() || "";
      return [text, lastLine];
    }

    async function equipChange(region) {
      const [row, col] = region;
      const url = `https://donguri.5ch.net/teambattle?r=${row}&c=${col}&` + MODE;

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`[${res.status}] /teambattle?r=${row}&c=${col}`);

      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/html");
      const headerText = doc?.querySelector("header")?.textContent || "";
      if (!headerText.includes("どんぐりチーム戦い")) throw new Error("title.ng");

      const table = doc.querySelector("table");
      if (!table) throw new Error("table.ng");

      const equipCond = table.querySelector("td small")?.textContent || "";
      const rank = equipCond
        .replace("エリート", "e")
        .replace(/.+から|\w+-|まで|だけ|警備員|警|\s|\[|\]|\|/g, "");

      const autoEquipItems = JSON.parse(localStorage.getItem("autoEquipItems")) || {};
      const autoEquipItemsAutojoin = JSON.parse(localStorage.getItem("autoEquipItemsAutojoin")) || {};

      if (autoEquipItemsAutojoin[rank]?.length > 0) {
        const index = Math.floor(Math.random() * autoEquipItemsAutojoin[rank].length);
        await setPresetItems(autoEquipItemsAutojoin[rank][index]);
        return [rank, "success"];
      } else if (autoEquipItems[rank]?.length > 0) {
        const index = Math.floor(Math.random() * autoEquipItems[rank].length);
        await setPresetItems(autoEquipItems[rank][index]);
        return [rank, "success"];
      }
      return [rank, "noEquip"];
    }

    // ===== FIXED getRegions() =====
    async function getRegions() {
      const url = location.pathname + location.search;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`[${res.status}] /teambattle`);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/html");

      const headerText = doc?.querySelector("header")?.textContent || "";
      if (!headerText.includes("どんぐりチーム戦い")) throw new Error("title.ng info");

      const inlineScripts = [...doc.querySelectorAll("script:not([src])")]
        .map((s) => s.textContent || "")
        .join("\n");

      // cellColors
      let cellColors = {};
      const colorsMatch = inlineScripts.match(/const\s+cellColors\s*=\s*({[\s\S]+?});/);
      if (colorsMatch) {
        const raw = colorsMatch[1].replace(/'/g, '"').replace(/,\s*}/g, "}");
        try {
          cellColors = JSON.parse(raw);
        } catch {}
      }

      // capital list/map
      let capitalMap = [];
      const cap1 = inlineScripts.match(/const\s+capitalList\s*=\s*(\[[\s\S]*?\]);/);
      const cap2 = inlineScripts.match(/const\s+capitalMap\s*=\s*(\[[\s\S]*?\]);/);
      const rawCap = (cap1 && cap1[1]) || (cap2 && cap2[1]);
      if (rawCap) {
        try {
          capitalMap = JSON.parse(rawCap);
        } catch {}
      }

      // grid size
      let rows = 0;
      const sizeMatch = inlineScripts.match(/const\s+GRID_SIZE\s*=\s*(\d+)/);
      if (sizeMatch) rows = Number(sizeMatch[1]);
      if (!rows) rows = 13;
      const cols = rows;

      // cells list
      const cells = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([r, c]);

      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];

      const capitalSet = new Set(capitalMap.map(([r, c]) => `${r}-${c}`));
      const adjacentSet = new Set();
      for (const [cr, cc] of capitalMap) {
        for (const [dr, dc] of dirs) {
          const nr = cr + dr,
            nc = cc + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) adjacentSet.add(`${nr}-${nc}`);
        }
      }

      const nonAdjacent = cells.filter(([r, c]) => {
        const k = `${r}-${c}`;
        return !capitalSet.has(k) && !adjacentSet.has(k);
      });

      const capitalAdjacent = cells.filter(([r, c]) => adjacentSet.has(`${r}-${c}`));

      // team cells
      const teamColorSet = new Set();
      const tc = (teamColor || "").replace("#", "").toLowerCase();
      for (const [k, v] of Object.entries(cellColors)) {
        if (!v) continue;
        if (v.replace("#", "").toLowerCase() === tc) teamColorSet.add(k);
      }

      const teamAdjSet = new Set();
      for (const key of teamColorSet) {
        const [tr, tc2] = key.split("-").map(Number);
        for (const [dr, dc] of dirs) {
          const nr = tr + dr,
            nc = tc2 + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) teamAdjSet.add(`${nr}-${nc}`);
        }
      }

      const teamAdjacent = cells.filter(([r, c]) => {
        const k = `${r}-${c}`;
        return teamColorSet.has(k) || teamAdjSet.has(k);
      });

      // map edge
      const edgeSet = new Set();
      for (let i = 0; i < rows; i++) {
        edgeSet.add(`${i}-0`);
        edgeSet.add(`${i}-${cols - 1}`);
      }
      for (let i = 0; i < cols; i++) {
        edgeSet.add(`0-${i}`);
        edgeSet.add(`${rows - 1}-${i}`);
      }
      const mapEdge = cells.filter(([r, c]) => edgeSet.has(`${r}-${c}`) && !capitalSet.has(`${r}-${c}`));

      const shuffle = (arr) => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      return {
        nonAdjacent: shuffle(nonAdjacent),
        capitalAdjacent: shuffle(capitalAdjacent),
        teamAdjacent: shuffle(teamAdjacent),
        mapEdge: shuffle(mapEdge),
      };
    }

    function calcNextProgress(p) {
      if (p < 16) return 26;
      if (p < 33) return 43;
      if (p < 50) return 60;
      if (p < 66) return 76;
      if (p < 83) return 93;
      return 10;
    }

    async function attackRegion() {
      await drawProgressBar();

      // gate: only near target time
      if (isAutoJoinRunning || (nextProgress != null && Math.abs(nextProgress - currentProgress) >= 3)) return;

      // rb: detect team
      if (location.href.includes("/teambattle?m=rb")) {
        try {
          const res = await fetch(`/teambattle?m=rb&t=${Date.now()}`, { cache: "no-store" });
          if (res.ok) {
            const text = await res.text();
            const doc = new DOMParser().parseFromString(text, "text/html");
            const target = Array.from(doc.querySelectorAll("header span")).find((s) => s.textContent.includes("チーム:"));
            if (target) {
              const raw = target.textContent;
              if (raw.includes("レッド")) {
                teamName = "レッド";
                teamColor = "d32f2f";
              } else if (raw.includes("ブルー")) {
                teamName = "ブルー";
                teamColor = "1976d2";
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      let regions = null;
      try {
        regions = await getRegions();
      } catch (e) {
        console.error(e);
      }

      // ===== guard (your requested fix) =====
      if (!regions) {
        logMessage(null, "[停止] region取得失敗", "→60s");
        isAutoJoinRunning = false;
        return;
      }

      const excludeSet = new Set();

      let cellType;
      if (regions.nonAdjacent.length > 0) cellType = "nonAdjacent";
      else if (regions.teamAdjacent.length > 0) cellType = "teamAdjacent";
      else if (regions.capitalAdjacent.length > 0) cellType = "capitalAdjacent";
      else cellType = "mapEdge";

      while (autoJoinDialog.open) {
        let success = false;
        isAutoJoinRunning = true;

        regions[cellType] = regions[cellType].filter((e) => !excludeSet.has(e.join(",")));

        for (const region of regions[cellType]) {
          try {
            const [cellRank, equipChangeStat] = await equipChange(region);
            if (equipChangeStat === "noEquip") {
              excludeSet.add(region.join(","));
              continue;
            }

            const [text, lastLine] = await challenge(region);
            const messageType = getMessageType(lastLine) || "";
            let message = lastLine;
            let processType = "";
            let sleepSec = 2;

            if (text.startsWith("アリーナチャレンジ開始") || text.startsWith("リーダーになった")) {
              success = true;
              message = "[成功] " + lastLine;
              processType = "return";
            } else if (messageType === "breaktime") {
              success = true;
              processType = "return";
            } else if (messageType === "toofast") {
              sleepSec = 3;
              processType = "continue";
            } else if (messageType === "retry") {
              sleepSec = 20;
              processType = "continue";
            } else if (messageType === "guardError") {
              processType = "continue";
            } else if (messageType === "equipError") {
              message += ` (${cellRank}, ${currentEquipName})`;
              processType = "continue";
            } else if (lastLine.length > 100) {
              message = "どんぐりシステム";
              processType = "continue";
            } else if (messageType === "quit") {
              message = "[停止] " + lastLine;
              processType = "return";
              if (autoJoinIntervalId) clearInterval(autoJoinIntervalId);
            } else if (messageType === "reset") {
              processType = "break";
            } else if (messageType && messageType in regions) {
              excludeSet.add(region.join(","));
              if (messageType === cellType) processType = "continue";
              else {
                cellType = messageType;
                processType = "break";
              }
            }

            let nextText = "";
            if (success) {
              nextProgress = calcNextProgress(currentProgress);
              nextText = `→ ${nextProgress}±2%`;
              isAutoJoinRunning = false;
            } else if (processType === "return") {
              nextText = "";
              isAutoJoinRunning = false;
            } else {
              nextText = `→ ${sleepSec}s`;
            }

            logMessage(region, message, nextText);
            await sleep(sleepSec * 1000);

            if (processType === "break") {
              try {
                regions = await getRegions();
              } catch {}
              break;
            } else if (processType === "return") {
              return;
            }
          } catch (e) {
            const msg = e?.message === "再ログインしてください" ? "[停止] どんぐりが見つかりませんでした" : String(e);
            logMessage(region, msg, "→20s");
            await sleep(20000);
          }
        }

        if (!success && regions[cellType].length === 0) {
          nextProgress = calcNextProgress(currentProgress);
          isAutoJoinRunning = false;
          logMessage(null, "攻撃可能なタイルが見つかりませんでした。", `→ ${nextProgress}±2%`);
          return;
        }
      }
    }

    // first shot
    if (!isAutoJoinRunning) attackRegion();
    // then tick
    if (autoJoinIntervalId) clearInterval(autoJoinIntervalId);
    autoJoinIntervalId = setInterval(attackRegion, 60000);
  }

  // stop autoJoin when dialog closes
  (() => {
    const obs = new MutationObserver(() => {
      if (!autoJoinDialog.open) {
        if (autoJoinIntervalId) clearInterval(autoJoinIntervalId);
        autoJoinIntervalId = null;
        isAutoJoinRunning = false;
        drawProgressBar().catch(() => {});
        if (!progressBarIntervalId) progressBarIntervalId = setInterval(drawProgressBar, 18000);
      }
    });
    obs.observe(autoJoinDialog, { attributes: true, attributeFilter: ["open"] });
  })();

  // ---------------------------
  // Progress bar (kept, but safe)
  // ---------------------------
  async function drawProgressBar() {
    try {
      const res = await fetch("https://donguri.5ch.net/", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);

      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/html");

      const container = doc.querySelector("div.stat-block:nth-child(2)>div:nth-child(5)");
      if (!container) return;

      currentPeriod = Number((container.firstChild?.textContent || "").match(/\d+/)?.[0] || 0);
      currentProgress = parseInt(container.lastElementChild?.textContent || "0", 10);

      let str, min, totalSec, sec, margin;

      if (
        currentProgress === 0 ||
        currentProgress === 50 ||
        (location.href.includes("/teambattle?m=rb") &&
          (currentProgress === 16 || currentProgress === 33 || currentProgress === 66 || currentProgress === 83))
      ) {
        str = "（マップ更新）";
      } else {
        if (currentProgress === 100) {
          min = 0;
          sec = 20;
          margin = 10;
        } else {
          if (location.href.includes("/teambattle?m=rb")) {
            if (currentProgress <= 16) totalSec = ((16 - currentProgress) * 600) / 16.6;
            else if (currentProgress <= 33) totalSec = ((33 - currentProgress) * 600) / 16.6;
            else if (currentProgress <= 50) totalSec = ((50 - currentProgress) * 600) / 16.6;
            else if (currentProgress <= 66) totalSec = ((66 - currentProgress) * 600) / 16.6;
            else if (currentProgress <= 83) totalSec = ((83 - currentProgress) * 600) / 16.6;
            else totalSec = ((100 - currentProgress) * 600) / 16.6;
          } else {
            totalSec = currentProgress < 50 ? (50 - currentProgress) * 36 : (100 - currentProgress) * 36 + 10;
          }

          totalSec = Math.floor(totalSec);
          min = Math.trunc(totalSec / 60);
          sec = totalSec % 60;
          margin = 20;
        }
        str = "（残り" + min + "分" + sec + "秒 \xb1" + margin + "秒）";
      }

      progressBarBody.textContent = currentProgress + "%";
      progressBarBody.style.width = currentProgress + "%";
      progressBarInfo.textContent = `${MODENAME}第${currentPeriod}期${str}`;

      const statBlock = doc.querySelector(".stat-block");
      if (statBlock) {
        wood = Number(statBlock.textContent.match(/木材の数: (\d+)/)?.[1] || wood);
        steel = Number(statBlock.textContent.match(/鉄の数: (\d+)/)?.[1] || steel);
      }
    } catch (e) {
      console.error(e + " drawProgressBar()");
    }
  }

  // start progress bar loop
  drawProgressBar().catch(() => {});
  let progressBarIntervalId = setInterval(drawProgressBar, 18000);

  // initial area overlay fetch is optional; comment in if you want auto
  // fetchAreaInfo(false);

})();
