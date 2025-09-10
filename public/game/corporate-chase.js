/* Corporate Chase — windowed UI in Shadow DOM (immune to theme overrides) */

/* ============== GAME STATE ============== */
let gameState = "menu"; // "menu" | "running" | "paused" | "levelup" | "gameover"
let level = 1, lives = 3;
let isInvulnerable = false;
const INVULN_TIME = 2000;
let soundOn = true;

/* Power-ups */
let effects = { speedUntil: 0, freezeUntil: 0 };
const now = () => Date.now();
const msLeft = (t) => Math.max(0, t - now());

/* Persistent stats */
const STORAGE_KEY = "corporate_chase_stats";
const loadStats = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { bestScore: 0, bestLevel: 1 }; } catch { return { bestScore: 0, bestLevel: 1 }; } };
const saveStats = (s) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} };
let stats = loadStats();

/* ============== CANVAS ============== */
let canvas, ctx;
function bindCanvas() {
  canvas = document.getElementById("gameCanvas");
  if (!canvas) return false;
  ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return false;
  ctx.imageSmoothingEnabled = false;
  return true;
}
if (!bindCanvas()) document.addEventListener("DOMContentLoaded", bindCanvas, { once: true });

/* ============== HUD ============== */
const hud = {
  score: document.getElementById("scoreText"),
  level: document.getElementById("levelText"),
  lives: document.getElementById("livesText"),
};
function setHUD() {
  if (hud.score) hud.score.textContent = "Score: " + player.score;
  if (hud.level) hud.level.textContent = "Level: " + level;
  if (hud.lives) hud.lives.textContent = "Lives: " + lives;
}

/* ---------- Fullscreen (user-gesture) helpers ---------- */
function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
         (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
}
function isFullscreenActive() {
  return !!document.fullscreenElement;
}
async function tryEnterFullscreen() {
  const el = document.querySelector(".game-shell"); // fullscreen the whole game card
  if (!el) return;
  if (el.requestFullscreen) {
    try { await el.requestFullscreen(); } catch {}
  }
}
async function tryExitFullscreen() {
  if (document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch {}
  }
}
/* Keep the FS button label in sync when user exits via browser UI */
document.addEventListener("fullscreenchange", () => {
  if (!uiRoot) return;
  const fsBtn = uiRoot.querySelector("#fs-btn");
  if (fsBtn) fsBtn.textContent = isFullscreenActive() ? "Exit Fullscreen" : "Fullscreen";
});


/* ============== MAP / CONSTANTS ============== */
const map = [
  [9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,6],
  [7,0,1,14,1,0,1,12,0,3,1,1,0,1,0,0,0,13,0,6],
  [7,0,1,0,0,0,1,1,0,0,0,1,0,2,1,0,1,1,0,6],
  [7,0,1,0,13,0,0,0,0,0,0,1,0,0,0,0,0,0,0,6],
  [7,0,2,0,1,1,0,1,1,14,0,3,0,1,1,5,0,0,0,6],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,6],
  [7,2,1,10,0,3,1,1,0,1,2,1,0,0,0,1,0,2,2,6],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6],
  [7,0,1,1,0,0,1,12,1,0,1,1,1,0,3,13,5,0,0,6],
  [7,0,0,1,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,6],
  [7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,6],
  [7,0,0,0,0,3,0,0,0,0,0,0,0,0,2,0,0,0,0,6],
  [8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8]
];
const mapRows = map.length, mapCols = map[0].length;

const TILE_SIZE_FACTOR = 0.9;
let TILE_SIZE = 32, mapOffsetX = 0, mapOffsetY = 0;
const PLAYER_SPEED = 5, MANAGER_SPEED = 3;

/* ============== SPRITES ============== */
const SPRITE_SRC = {
  player: "/game/sprites/player.png",
  manager: "/game/sprites/manager.png",
  coin: "/game/sprites/coin.png",
  cash: "/game/sprites/cash.png",
  tile: "/game/sprites/cubicle.png",
  shelf: "/game/sprites/shelf.png",
  shelf2: "/game/sprites/shelf2.png",
  plant: "/game/sprites/plant.png",
  water: "/game/sprites/water.png",
  plant1: "/game/sprites/plant1.png",
  plant2: "/game/sprites/plant2.png",
  plant3: "/game/sprites/plant3.png",
  plant4: "/game/sprites/plant4.png",
  printer: "/game/sprites/printer.png",
  wallFRONT: "/game/sprites/wallFRONT.png",
  wallBACK: "/game/sprites/wallBACK.png",
  wallLEFT: "/game/sprites/wallLEFT.png",
  wallRIGHT: "/game/sprites/wallRIGHT.png",
  speed: "/game/sprites/power_speed.png",
  freeze: "/game/sprites/power_freeze.png",
  extraLife: "/game/sprites/power_life.png"
};
const SPRITES = {};
for (const k in SPRITE_SRC) SPRITES[k] = new Image();
const loadImageSafe = (img, src, key) => new Promise((res) => { img.onload = res; img.onerror = () => { console.warn("sprite failed:", key); res(); }; img.src = src; });
async function preloadSprites() { await Promise.all(Object.entries(SPRITE_SRC).map(([k,s]) => loadImageSafe(SPRITES[k], s, k))); }

/* ============== ENTITIES ============== */
const keys = { up:false, down:false, left:false, right:false };
const player = { x:0, y:0, width:0, height:0, speed:PLAYER_SPEED, score:0 };
let managers = [];
let collectibles = [];

/* ============== DRAW ============== */
function drawBackground(){ ctx.fillStyle="#1e1e1e"; ctx.fillRect(0,0,canvas.width,canvas.height); }
function drawMap(){
  const spriteMap={1:"tile",2:"shelf",3:"plant",4:"plant1",5:"plant2",10:"plant3",11:"printer",6:"wallRIGHT",7:"wallLEFT",8:"wallBACK",9:"wallFRONT",12:"shelf2",13:"printer",14:"plant4",15:"water"};
  for(let r=0;r<map.length;r++){ for(let c=0;c<map[r].length;c++){ const tile=map[r][c]; const k=spriteMap[tile]; const x=mapOffsetX+c*TILE_SIZE; const y=mapOffsetY+r*TILE_SIZE; if(k&&SPRITES[k]) ctx.drawImage(SPRITES[k],x,y,TILE_SIZE,TILE_SIZE); } }
}
function drawCollectibles(){
  for(const it of collectibles){
    if(it.collected) continue;
    const img=SPRITES[it.type];
    if(img&&img.complete&&img.naturalWidth) ctx.drawImage(img,it.x-it.radius,it.y-it.radius,it.radius*2,it.radius*2);
    else{ ctx.beginPath(); ctx.arc(it.x,it.y,it.radius,0,Math.PI*2); ctx.fillStyle= it.type==="cash"?"#9acd32": it.type==="speed"?"#2d9cdb": it.type==="freeze"?"#56ccf2": it.type==="extraLife"?"#eb5757":"#f1c40f"; ctx.fill(); }
  }
}
function drawPlayer(){ if(isInvulnerable && Math.floor(Date.now()/150)%2===0) return; ctx.drawImage(SPRITES.player,player.x,player.y,player.width,player.height); }
function drawManagers(){
  const frozen = msLeft(effects.freezeUntil)>0;
  for(const m of managers){ if(frozen) ctx.globalAlpha=.5; ctx.drawImage(SPRITES.manager,m.x,m.y,m.width,m.height); ctx.globalAlpha=1; }
}

/* ============== COLLISION / UPDATE ============== */
function getTile(x,y){ const col=Math.floor((x-mapOffsetX)/TILE_SIZE); const row=Math.floor((y-mapOffsetY)/TILE_SIZE); if(row<0||col<0||row>=map.length||col>=map[0].length) return 1; return map[row][col]; }
function isBlocked(x,y,w,h){ const b=[1,2,3,5,6,7,8,9,10,12,13,14]; return b.includes(getTile(x,y))||b.includes(getTile(x+w-1,y))||b.includes(getTile(x,y+h-1))||b.includes(getTile(x+w-1,y+h-1)); }

function updatePlayer(){
  const nx=player.x+(+keys.right-+keys.left)*player.speed;
  const ny=player.y+(+keys.down-+keys.up)*player.speed;
  if(!isBlocked(nx,player.y,player.width,player.height)) player.x=nx;
  if(!isBlocked(player.x,ny,player.width,player.height)) player.y=ny;

  for(const it of collectibles){
    if(it.collected) continue;
    const dx=player.x+player.width/2-it.x, dy=player.y+player.height/2-it.y;
    if(Math.hypot(dx,dy)<it.radius+TILE_SIZE*0.3){
      it.collected=true;
      if(it.type==="cash") player.score+=10;
      else if(it.type==="coin") player.score+=1;
      else if(it.type==="speed"){ effects.speedUntil=now()+5000; player.speed=PLAYER_SPEED*1.8; }
      else if(it.type==="freeze"){ effects.freezeUntil=now()+5000; }
      else if(it.type==="extraLife"){ if(lives<5) lives++; }
      setHUD();
    }
  }
  if(msLeft(effects.speedUntil)===0 && player.speed!==PLAYER_SPEED) player.speed=PLAYER_SPEED;
  if(allScorableCollected()) levelUp();
}

function moveManagers(){
  const frozen=msLeft(effects.freezeUntil)>0;
  for(const m of managers){
    if(frozen) continue;
    const pcx=player.x+player.width/2, pcy=player.y+player.height/2;
    const mcx=m.x+m.width/2, mcy=m.y+m.height/2;
    let dx=pcx-mcx, dy=pcy-mcy; const d=Math.hypot(dx,dy);
    if(d>0){ dx/=d; dy/=d; const nx=m.x+dx*m.speed, ny=m.y+dy*m.speed; if(!isBlocked(nx,m.y,m.width,m.height)) m.x=nx; if(!isBlocked(m.x,ny,m.width,m.height)) m.y=ny; }
  }
}

function checkManagerCollision(){
  if(isInvulnerable) return;
  for(const m of managers){
    const pcx=player.x+player.width/2, pcy=player.y+player.height/2;
    const mcx=m.x+m.width/2, mcy=m.y+m.height/2;
    if(Math.hypot(pcx-mcx,pcy-mcy) < (player.width+m.width)*0.35){
      lives--; setHUD();
      if(lives>0) respawnPlayer(); else gameOver();
      break;
    }
  }
}

function respawnPlayer(){
  player.x=mapOffsetX+TILE_SIZE; player.y=mapOffsetY+TILE_SIZE;
  managers.forEach((m,i)=>{ const p=getManagerSpawn(i); m.x=p.x; m.y=p.y; });
  effects.freezeUntil=0; effects.speedUntil=0; player.speed=PLAYER_SPEED;
  isInvulnerable=true; setTimeout(()=>{isInvulnerable=false;}, INVULN_TIME);
}

function tileAt(c,r){ if(r<0||c<0||r>=map.length||c>=map[0].length) return 1; return map[r][c]; }
function isWalkableTile(c,r){ return tileAt(c,r)===0; }
function canPlaceAtXY(x,y,w,h){ return !isBlocked(x,y,w,h); }
function centerInTile(c,r,w,h){ return { x: mapOffsetX + c*TILE_SIZE + (TILE_SIZE-w)/2, y: mapOffsetY + r*TILE_SIZE + (TILE_SIZE-h)/2 }; }
function findNearestWalkable(c,r,w,h,maxR=6){
  for(let R=0;R<=maxR;R++){
    for(let dc=-R;dc<=R;dc++){ for(let dr=-R;dr<=R;dr++){
      if(Math.max(Math.abs(dc),Math.abs(dr))!==R) continue;
      const c2=c+dc, r2=r+dr; if(!isWalkableTile(c2,r2)) continue;
      const pos=centerInTile(c2,r2,w,h); if(canPlaceAtXY(pos.x,pos.y,w,h)) return pos;
    }}
  }
  return centerInTile(c,r,w,h);
}

/* ============== LEVELS ============== */
function allScorableCollected(){ return !collectibles.some(c=>!c.collected && (c.type==="coin"||c.type==="cash")); }
function levelUp(){
  level++; setHUD();
  rebuildManagersForLevel();
  initCollectibles();
  toast("Level "+level+"!");
}

/* ============== LOOP ============== */
function gameLoop(){
  if(gameState!=="running") return;
  updatePlayer(); moveManagers(); checkManagerCollision();
  drawBackground(); drawMap(); drawCollectibles(); drawManagers(); drawPlayer();
  requestAnimationFrame(gameLoop);
}

/* ============== COLLECTIBLES ============== */
function initCollectibles(){
  collectibles=[];
  for(let r=0;r<map.length;r++){
    for(let c=0;c<map[r].length;c++){
      if(map[r][c]===0){
        const rand=Math.random(); let type="coin", radius=TILE_SIZE*0.2;
        if(rand<0.05){ type=["speed","freeze","extraLife"][Math.floor(Math.random()*3)]; radius=TILE_SIZE*0.3; }
        else if(rand<0.15){ type="cash"; radius=TILE_SIZE*0.3; }
        collectibles.push({ x: mapOffsetX + c*TILE_SIZE + TILE_SIZE/2, y: mapOffsetY + r*TILE_SIZE + TILE_SIZE/2, radius, type, collected:false });
      }
    }
  }
}

/* ============== SHADOW DOM WINDOW LAYER ============== */
let uiRoot = null; // ShadowRoot
const SHADOW_CSS = `
:host{ all:initial; contain:layout style; font: 13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; color:#e7eefc; }
.window-card{ width:min(720px,92%); background:#16181d; border:1px solid #2a2f37; border-radius:14px; box-shadow:0 16px 60px rgba(0,0,0,.55); overflow:hidden; }
.window-bar{ display:flex; align-items:center; justify-content:center; background:#1c1f25; border-bottom:1px solid #2a2f37; padding:10px 12px; }
.window-title{ font-weight:800; letter-spacing:.2px; color:#dfe6f2; }
.window-body{ padding:14px 16px 16px; }
.menu-sub{ margin:0 0 .75rem; color:#aeb7c2; font-size:1.05rem; }
.stats{ display:flex; flex-wrap:wrap; gap:.6rem .75rem; justify-content:center; margin:.6rem 0 1rem; }
.chip{ border:1px solid #343a43; background:#1b1f24; padding:.45rem .65rem; border-radius:999px; color:#d7dde6; }
.menu-actions{ display:flex; flex-wrap:wrap; gap:.6rem; justify-content:center; margin:.5rem 0 .25rem; }
.btn{ appearance:none; border:1px solid #2a3347; color:#e7eefc; background:linear-gradient(180deg,#1a2030,#121726); padding:.65rem .95rem; border-radius:12px; cursor:pointer; font:600 14px/1 ui-sans-serif,system-ui; }
.btn-primary{ background:linear-gradient(180deg,#4da3ff,#7cc4ff); color:#081018; border-color:#1a5db8; box-shadow:0 10px 24px rgba(77,163,255,.35); }
.kbd{ border:1px solid #2a3347; background:#111726; border-radius:6px; padding:2px 6px; }
.menu-footer{ border-top:1px solid #262a30; padding:10px 4px 0; color:#9aa3ad; text-align:center; }
@keyframes popIn { from{ transform:translateY(-4px) scale(.98); opacity:0; } to{ transform:translateY(0) scale(1); opacity:1; } }
`;

function getOverlayEl(){ return document.getElementById("overlay"); }
function ensureShadow(){
  const host = getOverlayEl();
  if (!host) return null;
  if (!uiRoot) {
    uiRoot = host.attachShadow({ mode: "open" });
  }
  return uiRoot;
}
function showOverlay(html){
  const root = ensureShadow(); if(!root) return;
  const style = `<style>${SHADOW_CSS}</style>`;
  const needsWrap = !/class\s*=\s*["'][^"']*window-card/i.test(html);
  const content = needsWrap
    ? `<div class="window-card" role="dialog" aria-modal="true" style="animation:popIn .18s ease-out"><div class="window-bar"><div class="window-title">Corporate Chase</div></div><div class="window-body">${html}</div></div>`
    : html;
  root.innerHTML = style + content;

  const host = getOverlayEl();
  host.style.display = "grid";

  // bind clicks within the shadow
  root.addEventListener("click", onShadowClick, { passive:false });
}
function hideOverlay(){
  const host = getOverlayEl(); if(!host) return;
  host.style.display = "none";
  if (uiRoot) uiRoot.innerHTML = ""; // keep the shadow root; just clear content
}

function onShadowClick(e){
  const el = e.composedPath().find(n => n && n.id);
  if(!el) return;
  const id = el.id;
  switch(id){
    case "start-btn": startGame(); break;
    case "howto-btn": renderHowTo(); break;
    case "settings-btn": renderSettings(); break;
    case "back-btn":
      if (gameState==="paused") renderPause(); else renderMainMenu();
      break;
    case "resume-btn":
      hideOverlay(); gameState="running"; requestAnimationFrame(gameLoop); break;
    case "endgame-btn":
      renderMainMenu(); break;
    case "restart-btn":
      startGame(); break;
    case "menu-btn":
      renderMainMenu(); break;
    case "toggle-sound":
      soundOn=!soundOn; el.textContent = soundOn ? "On" : "Off"; break;
    case "do-reset":
      if(confirm("Reset local best score and best level?")){
        saveStats({bestScore:0,bestLevel:1}); stats=loadStats();
        alert("Stats reset.");
        if (gameState==="menu") renderMainMenu();
      }
      break;
    case "fs-btn":
      if (isFullscreenActive()) {
        tryExitFullscreen();
        el.textContent = "Fullscreen";
      } else {
        tryEnterFullscreen();
        el.textContent = "Exit Fullscreen";
      }
      break;
  }
}

function toast(t){
  // lightweight toast inside page DOM (not shadow)
  const msg=document.createElement("div");
  msg.textContent=t;
  Object.assign(msg.style,{position:"absolute",left:"50%",top:"12%",transform:"translateX(-50%)",
    background:"rgba(26,28,32,.95)",color:"#fff",font:"bold 1.1rem ui-monospace,monospace",
    padding:"10px 14px",borderRadius:"12px",boxShadow:"0 6px 26px rgba(0,0,0,.45)",zIndex:50});
  const host=document.querySelector(".game-shell")||document.body; host.appendChild(msg);
  setTimeout(()=>host.removeChild(msg),1100);
}

/* ============== MENUS (render into Shadow DOM) ============== */
function renderMainMenu(){
  gameState="menu";
  stats = loadStats();
  showOverlay(
    `<div class="window-card">
      <div class="window-bar"><div class="window-title">Corporate Chase</div></div>
      <div class="window-body">
        <p class="menu-sub">Collect cash. Dodge managers. Clear the floor to level up.</p>
        <div class="stats">
          <span class="chip">Best Score: <strong id="bestScoreChip">${stats.bestScore||0}</strong></span>
          <span class="chip">Best Level: <strong id="bestLevelChip">${stats.bestLevel||1}</strong></span>
          <span class="chip">Lives per run: <strong>3</strong></span>
        </div>
        <div class="menu-actions">
          <button id="start-btn" class="btn btn-primary">Start Game</button>
          <button id="howto-btn" class="btn">How to Play</button>
          <button id="settings-btn" class="btn">Settings</button>
        </div>
        <div class="menu-footer">Press <span class="kbd">Enter</span> to start — <span class="kbd">↑</span> <span class="kbd">↓</span> <span class="kbd">←</span> <span class="kbd">→</span> or <span class="kbd">WASD</span></div>
      </div>
    </div>`
  );
}
function renderPause(){
  gameState="paused";
  showOverlay(
    `<div class="window-card">
      <div class="window-bar"><div class="window-title">Paused</div></div>
      <div class="window-body">
        <div class="stats" style="justify-content:center;margin-top:.25rem;">
          <span class="chip">Score: <strong>${player.score}</strong></span>
          <span class="chip">Level: <strong>${level}</strong></span>
          <span class="chip">Lives: <strong>${lives}</strong></span>
        </div>
        <div class="menu-actions">
          <button id="resume-btn" class="btn btn-primary">Resume</button>
          <button id="settings-btn" class="btn">Settings</button>
          <button id="endgame-btn" class="btn">End Game</button>
        </div>
      </div>
    </div>`
  );
}
function renderGameOver(){
  gameState="gameover";
  stats = loadStats();
  if(player.score>stats.bestScore) stats.bestScore=player.score;
  if(level>stats.bestLevel) stats.bestLevel=level;
  saveStats(stats);
  showOverlay(
    `<div class="window-card">
      <div class="window-bar"><div class="window-title">Game Over</div></div>
      <div class="window-body">
        <p class="menu-sub">Tough round. Ready to try again?</p>
        <div class="stats">
          <span class="chip">Score: <strong>${player.score}</strong></span>
          <span class="chip">Best Score: <strong>${stats.bestScore}</strong></span>
          <span class="chip">Best Level: <strong>${stats.bestLevel}</strong></span>
        </div>
        <div class="menu-actions">
          <button id="restart-btn" class="btn btn-primary">Restart</button>
          <button id="menu-btn" class="btn">Main Menu</button>
          <button id="settings-btn" class="btn">Settings</button>
        </div>
      </div>
    </div>`
  );
}
function renderSettings(){
  showOverlay(
    `<div class="window-card">
      <div class="window-bar"><div class="window-title">Settings</div></div>
      <div class="window-body">
        <div class="setting-row" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:.75rem;">
          <div><strong>Sound</strong><div style="color:#9aa3ad;font-size:.9rem;">Toggle game audio feedback</div></div>
          <button id="toggle-sound" class="btn">${soundOn ? "On" : "Off"}</button>
        </div>
        <div class="setting-row" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:.2rem;">
          <div><strong>Reset Stats</strong><div style="color:#9aa3ad;font-size:.9rem;">Clear local best score & level</div></div>
          <button id="do-reset" class="btn">Reset</button>
        </div>
        <div class="menu-actions" style="margin-top:1rem;"><button id="back-btn" class="btn">Back</button></div>
      </div>
    </div>`
  );
}
function renderHowTo(){
  showOverlay(
    `<div class="window-card">
      <div class="window-bar"><div class="window-title">How to Play</div></div>
      <div class="window-body">
        <p>Use the keys to move, collect <strong>coins</strong> and <strong>cash</strong>, and avoid the managers.</p>
        <ul>
          <li>Clear all scorable items to level up; each level adds another manager and speed ramps.</li>
          <li><strong>Speed</strong>: short burst of speed.</li>
          <li><strong>Freeze</strong>: managers pause briefly.</li>
          <li><strong>Extra Life</strong>: up to 5 lives.</li>
          <li>Press <span class="kbd">Esc</span> to pause in-game.</li>
        </ul>
        <div class="menu-actions"><button id="back-btn" class="btn">Back</button></div>
      </div>
    </div>`
  );
}

/* ============== DESKTOP FIT / SIZING ============== */
function resizeCanvasToDisplaySize(){
  if(!canvas||!ctx) return;
  const naturalW=1024, naturalH=768;
  const scale=Math.min(window.innerWidth/naturalW,(window.innerHeight-180)/naturalH);
  const cssW=Math.round(naturalW*Math.max(0.6,Math.min(1,scale)));
  const cssH=Math.round(naturalH*Math.max(0.6,Math.min(1,scale)));
  const dpr=Math.max(1,Math.min(3,window.devicePixelRatio||1));
  const targetW=Math.floor(cssW*dpr), targetH=Math.floor(cssH*dpr);
  if(canvas.width!==targetW||canvas.height!==targetH){ canvas.width=targetW; canvas.height=targetH; }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  canvas.style.width=cssW+"px"; canvas.style.height=cssH+"px";
}
function recalcLayout(){
  resizeCanvasToDisplaySize();
  const cssW=canvas.clientWidth||canvas.width, cssH=canvas.clientHeight||canvas.height;
  TILE_SIZE=Math.floor(TILE_SIZE_FACTOR*Math.min(cssW/mapCols, cssH/mapRows));
  mapOffsetX=Math.floor((cssW - TILE_SIZE*mapCols)/2);
  mapOffsetY=Math.floor((cssH - TILE_SIZE*mapRows)/2);
}

/* ============== INPUT ============== */
document.addEventListener("keydown",(e)=>{
  if(e.key==="Escape"){
    if(gameState==="running"){ renderPause(); return; }
    if(gameState==="paused"||gameState==="menu"||gameState==="gameover") renderMainMenu();
  }
  if(["ArrowUp","w","W"].includes(e.key)) keys.up=true;
  if(["ArrowDown","s","S"].includes(e.key)) keys.down=true;
  if(["ArrowLeft","a","A"].includes(e.key)) keys.left=true;
  if(["ArrowRight","d","D"].includes(e.key)) keys.right=true;

  if((e.key==="Enter" || e.key===" ") && gameState==="menu"){
    startGame();
  }
});
document.addEventListener("keyup",(e)=>{
  if(["ArrowUp","w","W"].includes(e.key)) keys.up=false;
  if(["ArrowDown","s","S"].includes(e.key)) keys.down=false;
  if(["ArrowLeft","a","A"].includes(e.key)) keys.left=false;
  if(["ArrowRight","d","D"].includes(e.key)) keys.right=false;
});

/* ============== STARTUP ============== */
window.addEventListener("resize", recalcLayout);
document.addEventListener("DOMContentLoaded", ()=>{
  if(!bindCanvas()){ console.error("Canvas not found"); return; }
  recalcLayout();
  injectControlsStyles();
  ensureControlsContainer(); // make sure container exists just under the gameplay screen
  mountControlsRow();       // mounts the Rush-Hour-style button right below the canvas
  preloadSprites().then(()=> renderMainMenu());
});

/* ============== SPAWN/LEVEL BUILDERS ============== */
function getManagerSpawn(i=0){
  const baseX=mapOffsetX+TILE_SIZE*18, baseY=mapOffsetY+TILE_SIZE*9;
  const offsets=[[0,0],[.6,0],[0,.6],[-.6,0],[0,-.6],[.6,.6],[-.6,.6],[.6,-.6],[-.6,-.6]];
  const [ox,oy]=offsets[i%offsets.length];
  return { x: baseX+ox*TILE_SIZE, y: baseY+oy*TILE_SIZE };
}
function rebuildManagersForLevel(){
  managers=[];
  for(let i=0;i<level;i++){
    const p=getManagerSpawn(i);
    managers.push({ x:p.x,y:p.y, width:TILE_SIZE*.8, height:TILE_SIZE*.8, speed:MANAGER_SPEED+0.4*i });
  }
}

/* ============== GAME OVER / START ============== */
function gameOver(){ renderGameOver(); }

function startGame(){
  hideOverlay();
  recalcLayout();
  level=1; lives=3; isInvulnerable=false;
  player.score=0; player.speed=PLAYER_SPEED;
  player.width=TILE_SIZE*.8; player.height=TILE_SIZE*.8;
  player.x=mapOffsetX+TILE_SIZE; player.y=mapOffsetY+TILE_SIZE;
  rebuildManagersForLevel();
  effects.speedUntil=0; effects.freezeUntil=0;
  initCollectibles();
  setHUD();
  gameState="running";
  requestAnimationFrame(gameLoop);
}

/* ===================================================================== */
/*         ONSCREEN CONTROLS — position like Rush Hour Dash              */
/* ===================================================================== */

let controlsMounted = false;

function injectControlsStyles(){
  if (document.getElementById("cc-controls-style")) return;
  const style = document.createElement("style");
  style.id = "cc-controls-style";
  style.textContent = `
    .rhd-ctrl-wrap { display:flex; flex-direction:column; align-items:center; gap:.5rem; margin-top:.75rem; }
    .rhd-ctrl-toggle {
      appearance:none; border:1px solid #444; background:#1e1e1e; color:#eaeaea;
      padding:.5rem .75rem; border-radius:.5rem; cursor:pointer; font:600 14px system-ui, Arial;
    }
    .rhd-ctrl-toggle:hover { background:#262626; }
    .rhd-dpad { display:none; user-select:none; touch-action:none; }
    .rhd-dpad.show { display:grid; grid-template-columns:60px 60px 60px; grid-template-rows:60px 60px 60px; gap:.5rem; }
    .rhd-btn {
      display:flex; align-items:center; justify-content:center; width:60px; height:60px;
      border-radius:.75rem; background:#2a2a2a; border:1px solid #3a3a3a; color:#eee;
      font:700 16px system-ui, Arial; box-shadow:0 2px 6px rgba(0,0,0,.25) inset;
    }
    .rhd-btn:active { transform:scale(0.98); }
    .rhd-btn[disabled] { opacity:.25; }
    @media (max-width: 480px) {
      .rhd-dpad.show { grid-template-columns:56px 56px 56px; grid-template-rows:56px 56px 56px; }
      .rhd-btn { width:56px; height:56px; }
    }
  `;
  document.head.appendChild(style);
}

/* Ensure the controls container exists INSIDE .game-shell and directly after the canvas/overlay */
function ensureControlsContainer(){
  const shell = document.querySelector(".game-shell");
  if (!shell) return;
  let container = document.getElementById("controls-container");
  const overlay = document.getElementById("overlay");
  const canvasEl = document.getElementById("gameCanvas");

  if (!container) {
    container = document.createElement("div");
    container.id = "controls-container";
  } else if (container.parentElement !== shell) {
    container.parentElement && container.parentElement.removeChild(container);
  }

  // Insert right after overlay (preferred) or canvas
  if (overlay && overlay.parentElement === shell) {
    overlay.insertAdjacentElement("afterend", container);
  } else if (canvasEl && canvasEl.parentElement === shell) {
    canvasEl.insertAdjacentElement("afterend", container);
  } else {
    shell.appendChild(container);
  }
}

function mountControlsRow(){
  if (controlsMounted) return;

  const container = document.getElementById("controls-container") || document.body;

  const wrap = document.createElement("div");
  wrap.className = "rhd-ctrl-wrap";

  const toggle = document.createElement("button");
  toggle.className = "rhd-ctrl-toggle";
  toggle.type = "button";
  toggle.textContent = "Show Touch Controls";

  const dpad = document.createElement("div");
  dpad.className = "rhd-dpad";

  const mkBtn = (label, dir, disabled=false) => {
    const b = document.createElement("button");
    b.className = "rhd-btn"; b.type = "button"; b.textContent = label;
    if (disabled) b.setAttribute("disabled","true");
    if (!disabled) b.dataset.dir = dir;
    return b;
  };

  // 3x3 grid with a cross-shaped pad
  dpad.appendChild(document.createElement("span"));
  dpad.appendChild(mkBtn("↑","up"));
  dpad.appendChild(document.createElement("span"));
  dpad.appendChild(mkBtn("←","left"));
  dpad.appendChild(mkBtn("⦿","",true));
  dpad.appendChild(mkBtn("→","right"));
  dpad.appendChild(document.createElement("span"));
  dpad.appendChild(mkBtn("↓","down"));
  dpad.appendChild(document.createElement("span"));

  wrap.appendChild(toggle);
  wrap.appendChild(dpad);
  container.appendChild(wrap);

  // Press helpers: map D-pad to the same key flags your keyboard uses
  const setDir = (dir, pressed) => {
    if (dir==="up") keys.up = pressed;
    else if (dir==="down") keys.down = pressed;
    else if (dir==="left") keys.left = pressed;
    else if (dir==="right") keys.right = pressed;
  };

  // While touching, prevent browser scroll/zoom
  let cancelDocHandlers = null;
  function beginPreventingScroll(){
    const prevent = (e)=> e.preventDefault();
    document.addEventListener("touchmove", prevent, { passive:false });
    document.addEventListener("wheel", prevent, { passive:false });
    cancelDocHandlers = () => {
      document.removeEventListener("touchmove", prevent);
      document.removeEventListener("wheel", prevent);
      cancelDocHandlers = null;
    };
  }
  function stopPreventingScroll(){ if (cancelDocHandlers) cancelDocHandlers(); }

  // Attach per-button listeners (pointer-like but using mouse/touch for wide support)
  dpad.querySelectorAll(".rhd-btn").forEach(btn=>{
    const dir = btn.dataset.dir;
    if (!dir) return;

    const start = (ev)=>{ ev.preventDefault(); setDir(dir, true); beginPreventingScroll(); };
    const end   = (ev)=>{ if (ev) ev.preventDefault(); setDir(dir, false); stopPreventingScroll(); };

    btn.addEventListener("mousedown", start);
    btn.addEventListener("mouseup", end);
    btn.addEventListener("mouseleave", end);

    btn.addEventListener("touchstart", start, { passive:false });
    btn.addEventListener("touchend", end, { passive:false });
    btn.addEventListener("touchcancel", end, { passive:false });
  });

  // Toggle visibility text like RHD; also release any pressed directions when hiding
  toggle.addEventListener("click", () => {
    const show = !dpad.classList.contains("show");
    dpad.classList.toggle("show", show);
    toggle.textContent = show ? "Hide Touch Controls" : "Show Touch Controls";
    if (!show) { // release any held virtual keys
      keys.up = keys.down = keys.left = keys.right = false;
      stopPreventingScroll();
    }
  });

  // Auto-show once on mobile
  try {
    const k="cc_auto_show_pad_v1";
    const seen=localStorage.getItem(k);
    if (isMobileDevice() && !seen) {
      toggle.click();
      localStorage.setItem(k,"1");
    }
  } catch {}

  controlsMounted = true;
}

/* ===================================================================== */
