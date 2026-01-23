// ==UserScript==
// @name         探検⇔採掘自動切替
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  探検→採掘→探検の切替
// @author       ぱふぱふ
// @match        https://donguri.5ch.net/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

const statusEl = document.createElement('div');
    statusEl.style = "position:fixed;top:10px;left:10px;z-index:9999;padding:10px;background:white;color:black;font-size:18px;border-radius:5px;pointer-events:none;line-height:1.4;border:2px solid #c0c0c0;box-shadow: 2px 2px 5px rgba(0,0,0,0.2);";
    document.body.appendChild(statusEl);

    const lastReloadTime = Date.now();
    //180秒ごとにリロード（単位はミリ秒）、もし変えるならこの部分を希望のミリ秒数にする
    const reloadInterval = 60000;

    function autoSwitch() {
        let elapsedPercent = -1;

        const divs = document.querySelectorAll('div.stat-block div');
        for (let div of divs) {
            if (div.innerText.includes('経過時間') && div.innerText.includes('期')) {
                const bar = div.querySelector('.progress-bar div');
                if (bar) {
                    elapsedPercent = parseInt(bar.style.width);
                    break;
                }
            }
        }

        if (elapsedPercent === -1 || isNaN(elapsedPercent)) {
            statusEl.innerText = "データ取得中...";
            return;
        }

        let isMiningNow = false;
        let isExplorationNow = false;
        const allStatDivs = document.querySelectorAll('div.stat-block div');
        allStatDivs.forEach(div => {
            const text = div.innerText;
            if (text.includes('採掘') && (text.includes('[修行中]') || text.includes('●'))) isMiningNow = true;
            if (text.includes('探検') && (text.includes('[修行中]') || text.includes('●'))) isExplorationNow = true;
        });

        let target = "";
        // 45～50%・95～100%・0% を採掘に設定、もし変えるならこの部分をリロード秒数から逆算して変える
        if (elapsedPercent === 0 || (elapsedPercent >= 47 && elapsedPercent <= 50) || elapsedPercent >= 97) {
            target = "mining";
        }
        // 1～44%・51～94% を探検に設定、もし変えるならこの部分をリロード秒数から逆算して変える
        else if ((elapsedPercent >= 1 && elapsedPercent <= 46) || (elapsedPercent >= 51 && elapsedPercent <= 96)) {
            target = "exploration";
        }

        const nextReloadIn = Math.max(0, Math.round((reloadInterval - (Date.now() - lastReloadTime)) / 1000));

        statusEl.innerHTML = `<b>探検⇔採掘自動切替</b><br>経過: ${elapsedPercent}%<br>現在: ${isMiningNow ? '<span style="color:#ca4252;font-weight:bold;background:#fff0f2;padding:2px 6px;border-radius:6px;">採掘中</span>' : isExplorationNow ? '<span style="color:#005bbb;font-weight:bold;background:#e6f3ff;padding:2px 6px;border-radius:6px;">探検中</span>' : 'その他'}<br><small>更新まで: ${nextReloadIn}秒</small>`;

        if (target === "mining" && !isMiningNow) {
            window.location.href = "/focus/mining";
            return;
        } else if (target === "exploration" && !isExplorationNow && isMiningNow) {
            window.location.href = "/focus/exploration";
            return;
        }

        if (Date.now() - lastReloadTime > reloadInterval) {
            window.location.href = "/auth";
        }
    }

    setInterval(autoSwitch, 1000);
})();
