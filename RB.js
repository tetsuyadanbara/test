// ==UserScript==
// @name         donguri arena assist tool FIXED
// @version      2.0
// @description  arena assist (new map compatible + auto join + equip panel)
// @match        https://donguri.5ch.net/teambattle*
// @match        https://donguri.5ch.net/bag
// ==/UserScript==

(function(){

/* -------------------------------
   ページ判定
--------------------------------*/
const isBag = location.pathname === "/bag";

/* -------------------------------
   BAGページ：装備保存
--------------------------------*/
if(isBag){

  function saveEquip(url,index){
    let current = JSON.parse(localStorage.getItem("current_equip")||"[]");
    const id = url.match(/equip\/(\d+)/)?.[1];
    if(!id) return;
    current[index]=id;
    localStorage.setItem("current_equip",JSON.stringify(current));
  }

  const tables=["weaponTable","armorTable","necklaceTable"];

  tables.forEach((id,i)=>{
    document.querySelectorAll(`#${id} a[href*="/equip/"]`)
      .forEach(a=>{
        a.addEventListener("click",()=>saveEquip(a.href,i));
      });
  });

  return;
}

/* -------------------------------
   TOOLBAR
--------------------------------*/

const style=document.createElement("style");
style.textContent=`
#aatToolbar{
 position:fixed;
 top:0;
 left:0;
 right:0;
 background:#fff;
 border-bottom:1px solid #000;
 z-index:999999;
 font-size:13px;
}

#aatWrap{
 max-width:1100px;
 margin:auto;
 padding:6px;
}

#aatRow{
 display:flex;
 gap:6px;
 flex-wrap:wrap;
 align-items:center;
}

#aatBar{
 width:350px;
 height:16px;
 background:#ddd;
 border-radius:8px;
 overflow:hidden;
}

#aatBar div{
 height:100%;
 background:#428bca;
 color:#fff;
 text-align:right;
 padding-right:4px;
 font-size:12px;
}

#aatEquip{
 display:none;
 border-top:1px solid #000;
 margin-top:6px;
 padding-top:6px;
 gap:6px;
 flex-wrap:wrap;
}

#aatLog{
 display:none;
 max-height:40vh;
 overflow:auto;
 border-top:1px solid #000;
 margin-top:6px;
 padding-top:6px;
 font-size:12px;
}
`;
document.head.append(style);

/* toolbar DOM */

const bar=document.createElement("div");
bar.id="aatToolbar";

bar.innerHTML=`
<div id="aatWrap">

<div id="aatRow">
<span id="aatInfo"></span>
<div id="aatBar"><div id="aatBarInner"></div></div>
</div>

<div id="aatRow">
<button id="aatEquipBtn">装備</button>
<button id="aatRefreshBtn">更新</button>
<button id="aatAutoBtn">自動参戦</button>
</div>

<div id="aatEquip">
武:<span data-w>-</span>
防:<span data-a>-</span>
首:<span data-n>-</span>
<button id="aatEquipReload">更新</button>
</div>

<div id="aatLog"></div>

</div>
`;

document.body.prepend(bar);
document.body.style.paddingTop="90px";

/* -------------------------------
   DOM
--------------------------------*/

const info=document.getElementById("aatInfo");
const barInner=document.getElementById("aatBarInner");
const equipPanel=document.getElementById("aatEquip");
const logBox=document.getElementById("aatLog");

/* -------------------------------
   LOG
--------------------------------*/

function log(t){
 const d=document.createElement("div");
 d.textContent=new Date().toLocaleTimeString()+" "+t;
 logBox.prepend(d);
}

/* -------------------------------
   装備表示
--------------------------------*/

async function loadEquip(){

 try{

  const res=await fetch("/bag");
  const html=await res.text();
  const doc=new DOMParser().parseFromString(html,"text/html");

  const tables=[
   doc.querySelector("#weaponTable"),
   doc.querySelector("#armorTable"),
   doc.querySelector("#necklaceTable")
  ];

  const roles=["w","a","n"];

  tables.forEach((t,i)=>{

    const name=t?.querySelector("tbody tr td")?.textContent||"-";
    const span=equipPanel.querySelector(`[data-${roles[i]}]`);
    if(span) span.textContent=name;

  });

 }catch(e){

  log("装備取得失敗");

 }

}

/* -------------------------------
   ボタン
--------------------------------*/

document.getElementById("aatEquipBtn").onclick=()=>{
 equipPanel.style.display=
 equipPanel.style.display==="flex"?"none":"flex";
};

document.getElementById("aatEquipReload").onclick=loadEquip;

document.getElementById("aatRefreshBtn").onclick=updateProgress;

/* -------------------------------
   progress
--------------------------------*/

async function updateProgress(){

 try{

 const res=await fetch("/");
 const html=await res.text();

 const doc=new DOMParser().parseFromString(html,"text/html");

 const bar=doc.querySelector(".stat-block div div");

 if(!bar) return;

 const percent=parseInt(bar.textContent);

 barInner.style.width=percent+"%";
 barInner.textContent=percent+"%";

 info.textContent="map "+percent+"%";

 }catch(e){}

}

/* -------------------------------
   マップクリック
--------------------------------*/

function getCanvas(){

 return document.querySelector("#gridOverlay")
     ||document.querySelector("canvas");

}

function detectGrid(){

 const script=[...document.querySelectorAll("script")]
 .find(s=>s.textContent.includes("GRID_SIZE"));

 if(!script) return 7;

 const m=script.textContent.match(/GRID_SIZE\s*=\s*(\d+)/);
 return m?parseInt(m[1]):7;

}

function getCell(e){

 const canvas=getCanvas();
 const rect=canvas.getBoundingClientRect();
 const size=detectGrid();

 const x=e.clientX-rect.left;
 const y=e.clientY-rect.top;

 const cellSize=rect.width/size;

 return {
  r:Math.floor(y/cellSize),
  c:Math.floor(x/cellSize)
 };

}

/* -------------------------------
   自動参戦
--------------------------------*/

let auto=false;

document.getElementById("aatAutoBtn").onclick=()=>{
 auto=!auto;
 log(auto?"AUTO ON":"AUTO OFF");
 if(auto) autoLoop();
};

async function challenge(r,c){

 try{

 const body=`row=${r}&col=${c}`;

 const res=await fetch("/teamchallenge"+location.search,{
  method:"POST",
  headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body
 });

 const text=await res.text();

 log(`(${r},${c}) ${text.split("\n").pop()}`);

 if(text.includes("too fast"))
  await sleep(2000);

 }catch(e){
  log("error");
 }

}

function sleep(ms){
 return new Promise(r=>setTimeout(r,ms));
}

async function autoLoop(){

 while(auto){

  const r=Math.floor(Math.random()*detectGrid());
  const c=Math.floor(Math.random()*detectGrid());

  await challenge(r,c);

  await sleep(1500);

 }

}

/* -------------------------------
   canvas click
--------------------------------*/

function hookCanvas(){

 const canvas=getCanvas();

 if(!canvas) return;

 canvas.addEventListener("click",e=>{

  const cell=getCell(e);

  challenge(cell.r,cell.c);

 });

}

setTimeout(hookCanvas,1000);

/* -------------------------------
   init
--------------------------------*/

updateProgress();
loadEquip();
setInterval(updateProgress,20000);

})();
