// =====================
// Corporate Chase — mobile canvas fullscreen + D‑pad + styled Game Over
// =====================

// ---------- GAME STATE ----------
let gameState = "menu"; // "menu" | "running" | "paused" | "levelup" | "gameover"
let level = 1;
let lives = 3;
let isGameOver = false;
let isInvulnerable = false;
const INVULN_TIME = 2000;

// Power-up effect timers
let effects = { speedUntil: 0, freezeUntil: 0 };
const now = () => Date.now();
const msLeft = (t) => Math.max(0, t - now());

// Persistent stats
const STORAGE_KEY = "corporate_chase_stats";
const loadStats = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { bestScore: 0, bestLevel: 1 }; }
  catch { return { bestScore: 0, bestLevel: 1 }; }
};
const saveStats = (s) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} };
let stats = loadStats();

// ---------- CANVAS ----------
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

// ---------- HUD ----------
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

// ---------- MOBILE / FULLSCREEN ----------
function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
         (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
}
function disableMobileZoom() {
  document.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const t = Date.now();
    if (t - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = t;
  }, { passive: false });
  ["gesturestart","gesturechange","gestureend"].forEach(ev =>
    document.addEventListener(ev, (e)=>e.preventDefault(), { passive:false })
  );
}

// Toggle mobile overlay UI
function showMobileUI(show) {
  const ui = document.getElementById("mobile-ui");
  if (!ui) return;
  ui.setAttribute("aria-hidden", show ? "false" : "true");
  ui.style.display = show ? "block" : "none";
}

let canvasFS = false;
let prevBodyOverflow = "";
let prevHeaderDisplay = "";
let prevFooterDisplay = "";
let fsUnderlay = null;

function enterCanvasFullscreen() {
  if (!isMobileDevice() || !canvas) return;
  canvasFS = true;

  const header = document.querySelector(".site-header");
  const footer = document.querySelector(".site-footer");
  if (header) { prevHeaderDisplay = header.style.display; header.style.display = "none"; }
  if (footer) { prevFooterDisplay = footer.style.display; footer.style.display = "none"; }

  prevBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.touchAction = "none";
  document.body.style.touchAction = "none";
  canvas.style.touchAction = "none";
  document.body.classList.add("mobile-play"); // CSS hides header/footer

  if (!fsUnderlay) {
    fsUnderlay = document.createElement("div");
    Object.assign(fsUnderlay.style, {
      position: "fixed", inset: "0", background: "#000", zIndex: "9996"
    });
    document.body.appendChild(fsUnderlay);
  } else fsUnderlay.style.display = "block";

  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  canvas.style.height = vh + "px";
  canvas.style.zIndex = "9997";
  canvas.style.backgroundColor = "#000";

  showMobileUI(true);
  recalcLayout();
}
function exitCanvasFullscreen() {
  if (!canvasFS) return;
  canvasFS = false;

  const header = document.querySelector(".site-header");
  const footer = document.querySelector(".site-footer");
  if (header) header.style.display = prevHeaderDisplay || "";
  if (footer) footer.style.display = prevFooterDisplay || "";

  document.body.style.overflow = prevBodyOverflow || "";
  document.documentElement.style.touchAction = "";
  document.body.style.touchAction = "";
  canvas.style.touchAction = "";
  document.body.classList.remove("mobile-play");

  if (fsUnderlay) fsUnderlay.style.display = "none";

  canvas.style.position = "";
  canvas.style.top = "";
  canvas.style.left = "";
  canvas.style.width = "";
  canvas.style.height = "";
  canvas.style.zIndex = "";
  canvas.style.backgroundColor = "";

  showMobileUI(false);
  recalcLayout();
}

// ---------- MAP ----------
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
const mapRows = map.length;
const mapCols = map[0].length;

// ---------- CONSTANTS ----------
const TILE_SIZE_FACTOR = 0.9;
let TILE_SIZE = 32;
let mapOffsetX = 0;
let mapOffsetY = 0;
const PLAYER_SPEED = 5;
const MANAGER_SPEED = 3;

// ---------- SPRITES ----------
const SPRITE_SRC = {
  player: "/game/sprites/player.png",
  manager: "/game/sprites/manager.png",
  coin: "/game/sprites/coin.png",
  cash: "/game/sprites/cash.png",
  tile: "/game/sprites/cubicle.png",
  shelf: "/game/sprites/shelf.png",
  shelf2: "/game/sprites/shelf2.png",
  plant: "/game/sprites/plant.png",
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
const loadImageSafe = (img, src, key) => new Promise((res) => {
  img.onload = res;
  img.onerror = () => { console.warn("[sprites] Failed to load", key, src); res(); };
  img.src = src;
});
async function preloadSprites() {
  await Promise.all(Object.entries(SPRITE_SRC).map(([k, s]) => loadImageSafe(SPRITES[k], s, k)));
}

// ---------- ENTITIES ----------
const keys = { up: false, down: false, left: false, right: false };
const player = { x: 0, y: 0, width: 0, height: 0, speed: PLAYER_SPEED, score: 0 };
let managers = [];
let collectibles = [];

// ---------- DRAW ----------
function drawBackground() {
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function drawMap() {
  const spriteMap = {
    1: "tile", 2: "shelf", 3: "plant", 4: "plant1", 5: "plant2", 10: "plant3",
    11: "printer", 6: "wallRIGHT", 7: "wallLEFT", 8: "wallBACK", 9: "wallFRONT",
    12: "shelf2", 13: "printer", 14: "plant4"
  };
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      const tile = map[r][c];
      const spriteKey = spriteMap[tile];
      const x = mapOffsetX + c * TILE_SIZE;
      const y = mapOffsetY + r * TILE_SIZE;
      if (spriteKey && SPRITES[spriteKey]) {
        ctx.drawImage(SPRITES[spriteKey], x, y, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}
function drawCollectibles() {
  for (const item of collectibles) {
    if (item.collected) continue;
    const img = SPRITES[item.type];
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, item.x - item.radius, item.y - item.radius, item.radius * 2, item.radius * 2);
    } else {
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
      ctx.fillStyle =
        item.type === "cash" ? "#9acd32" :
        item.type === "speed" ? "#2d9cdb" :
        item.type === "freeze" ? "#56ccf2" :
        item.type === "extraLife" ? "#eb5757" : "#f1c40f";
      ctx.fill();
    }
  }
}
function drawPlayer() {
  if (isInvulnerable && Math.floor(Date.now() / 150) % 2 === 0) return;
  ctx.drawImage(SPRITES.player, player.x, player.y, player.width, player.height);
}
function drawManagers() {
  const frozenNow = msLeft(effects.freezeUntil) > 0;
  for (const m of managers) {
    if (frozenNow) ctx.globalAlpha = 0.5;
    ctx.drawImage(SPRITES.manager, m.x, m.y, m.width, m.height);
    ctx.globalAlpha = 1.0;
  }
}

// ---------- COLLISION ----------
function getTile(x, y) {
  const col = Math.floor((x - mapOffsetX) / TILE_SIZE);
  const row = Math.floor((y - mapOffsetY) / TILE_SIZE);
  if (row < 0 || col < 0 || row >= map.length || col >= map[0].length) return 1;
  return map[row][col];
}
function isBlocked(x, y, w, h) {
  const blocking = [1, 2, 3, 5, 6, 7, 8, 9, 10, 12, 13, 14];
  return blocking.includes(getTile(x, y)) ||
         blocking.includes(getTile(x + w - 1, y)) ||
         blocking.includes(getTile(x, y + h - 1)) ||
         blocking.includes(getTile(x + w - 1, y + h - 1));
}

// ---------- UPDATE ----------
function updatePlayer() {
  const nextX = player.x + (Number(keys.right) - Number(keys.left)) * player.speed;
  const nextY = player.y + (Number(keys.down) - Number(keys.up)) * player.speed;
  if (!isBlocked(nextX, player.y, player.width, player.height)) player.x = nextX;
  if (!isBlocked(player.x, nextY, player.width, player.height)) player.y = nextY;

  for (const item of collectibles) {
    if (item.collected) continue;
    const dx = player.x + player.width / 2 - item.x;
    const dy = player.y + player.height / 2 - item.y;
    if (Math.hypot(dx, dy) < item.radius + TILE_SIZE * 0.3) {
      item.collected = true;
      if (item.type === "cash") player.score += 10;
      else if (item.type === "coin") player.score += 1;
      else if (item.type === "speed") { effects.speedUntil = now() + 5000; player.speed = PLAYER_SPEED * 1.8; }
      else if (item.type === "freeze") { effects.freezeUntil = now() + 5000; }
      else if (item.type === "extraLife") { if (lives < 5) lives++; }
      setHUD();
    }
  }
  if (msLeft(effects.speedUntil) === 0 && player.speed !== PLAYER_SPEED) player.speed = PLAYER_SPEED;

  if (allScorableCollected()) levelUp();
}

function moveManagers() {
  const frozenNow = msLeft(effects.freezeUntil) > 0;
  for (const m of managers) {
    if (frozenNow) continue;
    const pcx = player.x + player.width / 2;
    const pcy = player.y + player.height / 2;
    const mcx = m.x + m.width / 2;
    const mcy = m.y + m.height / 2;
    let dx = pcx - mcx, dy = pcy - mcy;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      dx /= dist; dy /= dist;
      const nx = m.x + dx * m.speed;
      const ny = m.y + dy * m.speed;
      if (!isBlocked(nx, m.y, m.width, m.height)) m.x = nx;
      if (!isBlocked(m.x, ny, m.width, m.height)) m.y = ny;
    }
  }
}

function checkManagerCollision() {
  if (isInvulnerable) return;
  for (const m of managers) {
    const pcx = player.x + player.width / 2, pcy = player.y + player.height / 2;
    const mcx = m.x + m.width / 2, mcy = m.y + m.height / 2;
    if (Math.hypot(pcx - mcx, pcy - mcy) < (player.width + m.width) * 0.35) {
      lives--; setHUD();
      if (lives > 0) respawnPlayer(); else gameOver();
      break;
    }
  }
}

function respawnPlayer() {
  // Put the player back at the starting tile
  player.x = mapOffsetX + TILE_SIZE;
  player.y = mapOffsetY + TILE_SIZE;

  // Keep the same number of managers; just reset their positions
  managers.forEach((m, i) => {
    const pos = getManagerSpawn(i);
    m.x = pos.x;
    m.y = pos.y;
  });

  // Reset effects/invulnerability
  effects.freezeUntil = 0;
  effects.speedUntil = 0;
  player.speed = PLAYER_SPEED;

  isInvulnerable = true;
  setTimeout(() => { isInvulnerable = false; }, INVULN_TIME);
}

function tileAt(col, row) {
  if (row < 0 || col < 0 || row >= map.length || col >= map[0].length) return 1;
  return map[row][col];
}
function isWalkableTile(col, row) {
  return tileAt(col, row) === 0;
}
function canPlaceAtXY(x, y, w, h) {
  return !isBlocked(x, y, w, h);
}
function centerInTile(col, row, w, h) {
  const x = mapOffsetX + col * TILE_SIZE + (TILE_SIZE - w) / 2;
  const y = mapOffsetY + row * TILE_SIZE + (TILE_SIZE - h) / 2;
  return { x, y };
}

/** Find the nearest walkable tile center from an initial (col,row) */
function findNearestWalkable(col, row, w, h, maxRadius = 6) {
  for (let r = 0; r <= maxRadius; r++) {
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== r) continue; // ring only
        const c2 = col + dc, r2 = row + dr;
        if (!isWalkableTile(c2, r2)) continue;
        const pos = centerInTile(c2, r2, w, h);
        if (canPlaceAtXY(pos.x, pos.y, w, h)) return pos;
      }
    }
  }
  // fallback to original tile center
  return centerInTile(col, row, w, h);
}



// ---------- LEVEL ----------
function allScorableCollected() {
  return !collectibles.some(c => !c.collected && (c.type === "coin" || c.type === "cash"));
}
function levelUp() {
  level += 1;
  setHUD();

  // Rebuild enemy count/speeds based on the new level
  rebuildManagersForLevel();

  // New items for the new floor
  initCollectibles();

  showLevelUpMessage(level);
}


// ---------- LOOP ----------
function gameLoop() {
  if (gameState !== "running") return;
  updatePlayer();
  moveManagers();
  checkManagerCollision();
  drawBackground();
  drawMap();
  drawCollectibles();
  drawManagers();
  drawPlayer();
  requestAnimationFrame(gameLoop);
}

// ---------- COLLECTIBLES ----------
function initCollectibles() {
  collectibles = [];
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      if (map[r][c] === 0) {
        const rand = Math.random();
        let type = "coin";
        let radius = TILE_SIZE * 0.2;
        if (rand < 0.05) { type = ["speed","freeze","extraLife"][Math.floor(Math.random()*3)]; radius = TILE_SIZE * 0.3; }
        else if (rand < 0.15) { type = "cash"; radius = TILE_SIZE * 0.3; }
        collectibles.push({
          x: mapOffsetX + c * TILE_SIZE + TILE_SIZE / 2,
          y: mapOffsetY + r * TILE_SIZE + TILE_SIZE / 2,
          radius, type, collected: false
        });
      }
    }
  }
}

// ---------- UI ----------
function showLevelUpMessage(n) {
  const msg = document.createElement("div");
  msg.textContent = "Level " + n + "!";
  Object.assign(msg.style, {
    position: "fixed", top: "40%", left: "50%", transform: "translate(-50%, -50%)",
    background: "#222", color: "#fff", font: "2rem monospace", padding: "1rem 2rem",
    borderRadius: "18px", zIndex: 999999, boxShadow: "0 4px 32px #0008"
  });
  document.body.appendChild(msg);
  setTimeout(()=>{ if (document.body.contains(msg)) document.body.removeChild(msg); }, 1200);
}

// Styled Game Over (menu‑card)
function gameOver() {
  isGameOver = true; gameState = "gameover";

  stats = loadStats();
  if (player.score > stats.bestScore) stats.bestScore = player.score;
  if (level > stats.bestLevel) stats.bestLevel = level;
  saveStats(stats);

  showOverlay(
    '<div class="menu-card" role="dialog" aria-modal="true" aria-labelledby="go-title">'+
      '<div class="menu-hero">'+
        '<h1 id="go-title" class="menu-title">Game Over</h1>'+
        '<p class="menu-sub">Tough round. Ready to try again?</p>'+
      '</div>'+
      '<div class="stats">'+
        '<span class="chip">Score: <strong>'+player.score+'</strong></span>'+
        '<span class="chip">Best Score: <strong>'+stats.bestScore+'</strong></span>'+
        '<span class="chip">Best Level: <strong>'+stats.bestLevel+'</strong></span>'+
      '</div>'+
      '<div class="menu-actions">'+
        '<button id="restart-btn" class="btn btn-primary">Restart</button>'+
        '<button id="menu-btn" class="btn">Main Menu</button>'+
      '</div>'+
    '</div>'
  );

  const rb = document.getElementById("restart-btn");
  if (rb) rb.addEventListener("click", () => { hideOverlay(); startGame(); });

  const mb = document.getElementById("menu-btn");
  if (mb) mb.addEventListener("click", () => {
    hideOverlay();
    exitCanvasFullscreen();
    showMobileUI(false);
    showMainMenu();
  });
}

function resetStats() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ bestScore: 0, bestLevel: 1 })); stats = loadStats(); }
  catch {}
}

function openModal(title, html) {
  const modal = document.getElementById("modal");
  const body = document.getElementById("modal-body");
  const titleEl = document.getElementById("modal-title");
  if (!modal || !body || !titleEl) return;

  titleEl.textContent = title;
  body.innerHTML = html;
  modal.style.display = "grid";

  const closeBtn = document.getElementById("modal-close");
  const onClose = () => { modal.style.display = "none"; closeBtn && closeBtn.removeEventListener("click", onClose); };
  closeBtn && closeBtn.addEventListener("click", onClose);
  modal.addEventListener("click", (e) => { if (e.target === modal) onClose(); }, { once: true });
}

function showOverlay(html, show = true) {
  const overlay = document.getElementById("overlay");
  if (!overlay) return;
  overlay.innerHTML = html;
  overlay.style.display = show ? "grid" : "none";
}
const hideOverlay = () => showOverlay("", false);

// Desktop fit
function scaleGameToFit() {
  const header = document.querySelector(".site-header");
  const footer = document.querySelector(".site-footer");
  const shell = document.querySelector(".canvas-shell");
  if (!shell) return;
  const headerH = header ? header.offsetHeight : 0;
  const footerH = footer ? footer.offsetHeight : 0;
  const availableHeight = window.innerHeight - headerH - footerH;
  const naturalW = 1024, naturalH = 768;
  const scale = Math.min(availableHeight / naturalH, Math.min(window.innerWidth, 1200) / naturalW);
  shell.style.transformOrigin = "top center";
  shell.style.transform = "scale(" + Math.max(0.5, Math.min(1, scale)) + ")";
}

// Sizing / DPR
function resizeCanvasToDisplaySize() {
  if (!canvas || !ctx) return;

  let cssWidth, cssHeight;
  if (isMobileDevice() && canvasFS) {
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    cssWidth = window.innerWidth; cssHeight = vh;
  } else if (isMobileDevice()) {
    cssWidth = Math.min(window.innerWidth, 1024);
    cssHeight = Math.round(cssWidth * (768 / 1024));
  } else {
    const naturalW = 1024, naturalH = 768;
    const scale = Math.min(window.innerWidth / naturalW, (window.innerHeight - 140) / naturalH);
    cssWidth  = Math.round(naturalW * Math.max(0.6, Math.min(1, scale)));
    cssHeight = Math.round(naturalH * Math.max(0.6, Math.min(1, scale)));
  }

  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const targetW = Math.floor(cssWidth * dpr);
  const targetH = Math.floor(cssHeight * dpr);

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas.style.width = cssWidth + "px";
  canvas.style.height = cssHeight + "px";
}
function recalcLayout() {
  resizeCanvasToDisplaySize();
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  TILE_SIZE = Math.floor(TILE_SIZE_FACTOR * Math.min(cssW / mapCols, cssH / mapRows));
  mapOffsetX = Math.floor((cssW - TILE_SIZE * mapCols) / 2);
  mapOffsetY = Math.floor((cssH - TILE_SIZE * mapRows) / 2);
}

// ---------- INPUT ----------
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && gameState === "running") {
    gameState = "paused";
    showOverlay('<h1>Paused</h1><div class="menu-actions" style="margin-top:10px;"><button id="resume-btn" class="btn btn-primary">Resume</button></div>');
    const rb = document.getElementById("resume-btn");
    if (rb) rb.addEventListener("click", () => { hideOverlay(); gameState = "running"; gameLoop(); });
  }
  if (["ArrowUp","w","W"].includes(e.key)) keys.up = true;
  if (["ArrowDown","s","S"].includes(e.key)) keys.down = true;
  if (["ArrowLeft","a","A"].includes(e.key)) keys.left = true;
  if (["ArrowRight","d","D"].includes(e.key)) keys.right = true;
});
document.addEventListener("keyup", (e) => {
  if (["ArrowUp","w","W"].includes(e.key)) keys.up = false;
  if (["ArrowDown","s","S"].includes(e.key)) keys.down = false;
  if (["ArrowLeft","a","A"].includes(e.key)) keys.left = false;
  if (["ArrowRight","d","D"].includes(e.key)) keys.right = false;
});

// Touch swipe on canvas
let touchStartX = 0, touchStartY = 0;
function bindTouchControls() {
  if (!canvas) return;
  canvas.addEventListener("touchstart", (e) => {
    if (!e.touches || !e.touches.length) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  canvas.addEventListener("touchend", (e) => {
    if (!e.changedTouches || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) keys[dx > 0 ? "right" : "left"] = true;
    else keys[dy > 0 ? "down" : "up"] = true;
    setTimeout(()=> (keys.up = keys.down = keys.left = keys.right = false), 100);
  }, { passive: true });

  ["touchmove","gesturestart","gesturechange","gestureend"].forEach(evt => {
    canvas.addEventListener(evt, (e)=>e.preventDefault(), { passive:false });
  });
}

// D‑pad (hold-to-move)
let holdTimer = null;
function startHold(dir) {
  stopHold();
  const press = () => {
    keys.up = keys.down = keys.left = keys.right = false;
    keys[dir] = true;
  };
  press();
  holdTimer = setInterval(press, 60);
}
function stopHold() {
  if (holdTimer) clearInterval(holdTimer);
  holdTimer = null;
  keys.up = keys.down = keys.left = keys.right = false;
}
function bindMobilePad() {
  const map = [["mb-up","up"],["mb-down","down"],["mb-left","left"],["mb-right","right"]];
  map.forEach(([id, dir]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const start = (e)=>{ e.preventDefault(); startHold(dir); };
    const end   = (e)=>{ e.preventDefault(); stopHold(); };
    el.addEventListener("touchstart", start, { passive:false });
    el.addEventListener("touchend",   end,   { passive:false });
    el.addEventListener("touchcancel",end,   { passive:false });
    el.addEventListener("mousedown",  start);
    el.addEventListener("mouseup",    end);
    el.addEventListener("mouseleave", end);
  });
  const exitBtn = document.getElementById("mb-exit");
  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      stopHold(); exitCanvasFullscreen(); showMobileUI(false); hideOverlay(); showMainMenu();
    });
  }
}

// ---------- STARTUP ----------
window.addEventListener("resize", recalcLayout);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", recalcLayout);
  window.visualViewport.addEventListener("scroll", recalcLayout);
}

document.addEventListener("DOMContentLoaded", () => {
  disableMobileZoom();
  if (!bindCanvas()) { console.error("Canvas not found"); return; }
  bindTouchControls();
  bindMobilePad();
  recalcLayout();
  preloadSprites().then(() => { showMainMenu(); });
  scaleGameToFit();
});

// ---------- MENU / START ----------
function showMainMenu() {
  stats = loadStats();
  gameState = "menu";

  const controlsLine = '<span><span class="kbd">↑</span> <span class="kbd">↓</span> <span class="kbd">←</span> <span class="kbd">→</span> or <span class="kbd">WASD</span></span>';

  showOverlay(
    '<div class="menu-card" role="dialog" aria-modal="true" aria-labelledby="game-title">'+
      '<div class="menu-hero">'+
        '<h1 id="game-title" class="menu-title">Corporate Chase</h1>'+
        '<p class="menu-sub">Collect cash. Dodge managers. Clear the floor to level up.</p>'+
      '</div>'+
      '<div class="stats">'+
        '<span class="chip">Best Score: <strong>'+stats.bestScore+'</strong></span>'+
        '<span class="chip">Best Level: <strong>'+stats.bestLevel+'</strong></span>'+
        '<span class="chip">Lives per run: <strong>3</strong></span>'+
      '</div>'+
      '<div class="menu-actions">'+
        '<button id="start-btn" class="btn btn-primary">Start Game</button>'+
        '<button id="howto-btn" class="btn">How to Play</button>'+
        '<button id="settings-btn" class="btn">Settings</button>'+
        '<button id="reset-btn" class="btn" title="Clear local bests">Reset Stats</button>'+
      '</div>'+
      '<div class="menu-footer">'+
        '<div>'+controlsLine+'</div>'+
        '<div>Press <span class="kbd">Enter</span> to start</div>'+
      '</div>'+
    '</div>'
  );

  const startBtn = document.getElementById("start-btn");
  if (startBtn) startBtn.addEventListener("click", () => {
    if (isMobileDevice()) enterCanvasFullscreen();
    hideOverlay(); startGame();
  });

  const howBtn = document.getElementById("howto-btn");
  if (howBtn) howBtn.addEventListener("click", () => {
    openModal(
      "How to Play",
      "<p>Use the keys to move, collect <strong>coins</strong> and <strong>cash</strong>, and avoid the managers.</p>"+
      "<ul>"+
        "<li>Clear all scorable items to level up; each level adds another manager and speed ramps.</li>"+
        "<li><strong>Speed</strong> power-up: short burst of speed.</li>"+
        "<li><strong>Freeze</strong> power-up: managers pause briefly.</li>"+
        "<li><strong>Extra Life</strong>: up to 5 lives.</li>"+
        "<li>Press <span class='kbd'>Esc</span> to pause in-game.</li>"+
      "</ul>"
    );
  });

  const setBtn = document.getElementById("settings-btn");
  if (setBtn) setBtn.addEventListener("click", () => openModal("Settings", "<p>(Placeholder)</p>"));

  const resetBtn = document.getElementById("reset-btn");
  if (resetBtn) resetBtn.addEventListener("click", () => {
    if (confirm("Reset local best score and best level?")) { resetStats(); showMainMenu(); }
  });

  // Enter/Space starts
  const onEnter = (e) => {
    if (gameState === "menu" && (e.key === "Enter" || e.key === " ")) {
      document.removeEventListener("keydown", onEnter);
      if (isMobileDevice()) enterCanvasFullscreen();
      hideOverlay(); startGame();
    }
  };
  document.addEventListener("keydown", onEnter);

  // Tap to start on mobile (guard)
  if (isMobileDevice() && canvas) {
    const tapStart = () => {
      if (gameState === "menu") { enterCanvasFullscreen(); hideOverlay(); startGame(); }
    };
    canvas.addEventListener("click", tapStart, { once: true });
    canvas.addEventListener("touchend", tapStart, { once: true, passive: true });
  }
}

function getManagerSpawn(i = 0) {
  // Base spawn cell near bottom-right (matches your current coordinates)
  const baseX = mapOffsetX + TILE_SIZE * 18;
  const baseY = mapOffsetY + TILE_SIZE * 9;

  // Fan-out offsets so they don’t stack perfectly
  const offsets = [
    [0, 0], [0.6, 0], [0, 0.6], [-0.6, 0], [0, -0.6],
    [0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]
  ];
  const [ox, oy] = offsets[i % offsets.length];
  return { x: baseX + ox * TILE_SIZE, y: baseY + oy * TILE_SIZE };
}

function rebuildManagersForLevel() {
  managers = [];
  for (let i = 0; i < level; i++) {
    const pos = getManagerSpawn(i);
    managers.push({
      x: pos.x,
      y: pos.y,
      width: TILE_SIZE * 0.8,
      height: TILE_SIZE * 0.8,
      // Slight speed ramp per additional manager
      speed: MANAGER_SPEED + 0.4 * i,
      frozen: false
    });
  }
}


// ---------- START GAME ----------
function startGame() {
  recalcLayout();

  level = 1;
  lives = 3;
  isGameOver = false;
  isInvulnerable = false;

  player.score = 0;
  player.speed = PLAYER_SPEED;

  player.width = TILE_SIZE * 0.8;
  player.height = TILE_SIZE * 0.8;
  player.x = mapOffsetX + TILE_SIZE;
  player.y = mapOffsetY + TILE_SIZE;

  // Build exactly one manager for level 1
  rebuildManagersForLevel();

  effects.speedUntil = 0;
  effects.freezeUntil = 0;

  initCollectibles();
  setHUD();
  gameState = "running";
  requestAnimationFrame(gameLoop);
}

