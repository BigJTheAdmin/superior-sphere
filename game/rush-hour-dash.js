/* Rush Hour Dash — Full Build (car variety fix: round-robin selection, no player fallback)
   Asset root: /assets/rush-hour-dash/
*/
(function () {
  // ====== STORAGE KEYS ======
  const STATS_KEY = "rush_hour_dash_stats_v2";
  const META_KEY  = "rush_hour_dash_meta_v2";

  // ====== CONFIG ======
  const CONFIG = {
    lanes: 4,
    baseLevelTime: 25,
    minLevelTime: 18,
    spawnMsLvl1: 1200,
    spawnMsDecrementPerLevel: 25,
    spawnMsMin: 700,
    baseSpeed: 4.6,
    levelSpeedRamp: 0.35,
    waveStartLevel: 2,
    bossStartLevel: 4,
    waveSpawnAccel: 0.7,
    waveDurationRange: [6000, 9000],
    pickupsBaseMs: 3600,
    pickupsMinMs: 2200,
    pickupsLevelStep: 60,
    missionTargets: { scoreL1: 400, pickups: 6, surviveNoPowerups: 15, dodge: 100 },
    cosmeticUnlocks: [
      { id: "teal",    label: "Teal",    require: { streakDays: 2 } },
      { id: "orange",  label: "Orange",  require: { totalDodged: 500 } },
      { id: "purple",  label: "Purple",  require: { dailyMissionsDone: 5 } },
      { id: "gold",    label: "Gold",    require: { bestLevel: 8 } },
    ],
    playerColors: {
      blue:   "#3aa0ff",
      teal:   "#2dd4bf",
      orange: "#f59e0b",
      purple: "#a78bfa",
      gold:   "#fcd34d",
      greenInvuln: "#5cff9b"
    },
    spriteScale: 1.0,
    pickupParticleCount: 16,
    crashParticleCount: 24,

    // New: glow styling for invulnerability/ shield
    invulnGlow: {
      color: "#5cff9b",
      blur: 22,
      lineWidth: 8,
      alpha: 0.9
    }
  };

  // ====== ASSET PATHS ======
  const ASSETS = {
    img: {
      roadTile:        "/assets/rush-hour-dash/img/road_tile.png",
      laneDash:        "/assets/rush-hour-dash/img/lane_dash.png",
      player: {
        blue:   "/assets/rush-hour-dash/img/player_blue.png",
        teal:   "/assets/rush-hour-dash/img/player_teal.png",
        orange: "/assets/rush-hour-dash/img/player_orange.png",
        purple: "/assets/rush-hour-dash/img/player_purple.png",
        gold:   "/assets/rush-hour-dash/img/player_gold.png",
      },
      cars: [
        "/assets/rush-hour-dash/img/traffic_car1.png",
        "/assets/rush-hour-dash/img/traffic_car2.png",
        "/assets/rush-hour-dash/img/traffic_car3.png"
      ],
      bossVan:         "/assets/rush-hour-dash/img/van_boss.png",
      pickups: {
        shield: "/assets/rush-hour-dash/img/pickup_shield.png",
        slow:   "/assets/rush-hour-dash/img/pickup_slow.png",
        double: "/assets/rush-hour-dash/img/pickup_double.png"
      },
      spark:           "/assets/rush-hour-dash/img/particles/spark.png"
    },
    audio: {
      bgm:      "/assets/rush-hour-dash/audio/bgm_loop.wav",
      pickup:   "/assets/rush-hour-dash/audio/sfx_pickup.mp3",
      crash:    "/assets/rush-hour-dash/audio/sfx_crash.mp3",
      levelup:  "/assets/rush-hour-dash/audio/sfx_levelup.mp3",
      mission:  "/assets/rush-hour-dash/audio/sfx_mission.mp3",
      button:   "/assets/rush-hour-dash/audio/sfx_button.mp3"
    }
  };

  // ====== PLACEHOLDER IMG ======
  const PLACEHOLDER_PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAMklEQVR4nO3OMQEAIAwAsbP+v1pQyB4mXnA0m+g0h4o0mAqg8k4gYc9m3k6d0m+f0l2oYkKM0D5YbA8mV7eN3QAAAABJRU4ErkJggg==".replace("4Er","4Er"); // tiny noop

  const todayKey = () => new Date().toLocaleDateString("en-CA");

  // ====== HELPERS ======
  function loadImage(url, fallbackDataUrl = PLACEHOLDER_PNG) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        const f = new Image();
        f.onload = () => { f._placeholder = true; resolve(f); };
        f.src = fallbackDataUrl;
        console.warn("[RushHour] Image failed, using placeholder:", url);
      };
      img.src = url;
    });
  }

  async function loadAudioBuffer(ctx, url) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.arrayBuffer();
      return await ctx.decodeAudioData(arr);
    } catch {
      return null; // oscillator fallback
    }
  }

  function init() {
    // DOM
    const canvas = document.getElementById("commuteCanvas");
    const loader = document.getElementById("loader");
    const loadBar = document.getElementById("loadBar");
    const loadLabel = document.getElementById("loadLabel");
    const startBtn = document.getElementById("startBtn");

    const timeText = document.getElementById("timeText");
    const scoreText = document.getElementById("scoreText");
    const levelText = document.getElementById("levelText");
    const livesText = document.getElementById("livesText");
    const powerupsText = document.getElementById("powerupsText");
    const trafficText = document.getElementById("trafficText");
    const restartBtn = document.getElementById("restartBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const banner = document.getElementById("banner");
    const statsLine = document.getElementById("statsLine");

    const missionText = document.getElementById("missionText");
    const missionProgressEl = document.getElementById("missionProgress");
    const streakText = document.getElementById("streakText");

    const statTime = document.getElementById("statTime");
    const statDodged = document.getElementById("statDodged");
    const statPups = document.getElementById("statPups");

    const colorSelect = document.getElementById("colorSelect");
    const unlockHint = document.getElementById("unlockHint");

    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });

    // ====== DPR SCALING ======
    const base = { width: canvas.width, height: canvas.height };
    function resizeForDPR() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const cssWidth = canvas.clientWidth || base.width;
      const cssHeight = Math.round((base.height / base.width) * cssWidth);
      canvas.style.height = cssHeight + "px";
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      computeLanes();
      snapPlayerToRoad();
    }
    window.addEventListener("resize", resizeForDPR);

    // ====== PERSISTENCE ======
    function loadStats() {
      try { return JSON.parse(localStorage.getItem(STATS_KEY)) || { bestScore: 0, bestLevel: 1, runs: 0 }; }
      catch { return { bestScore: 0, bestLevel: 1, runs: 0 }; }
    }
    function saveStats(s) { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {} }

    function loadMeta() {
      try {
        return JSON.parse(localStorage.getItem(META_KEY)) || {
          lastMissionDay: null, mission: null, missionDone: false, lastCompletedDay: null, streak: 0, dailyMissionsDone: 0,
          totalTimeSurvived: 0, totalDodged: 0, powerupsCollected: 0,
          unlockedColors: ["blue"], selectedColor: "blue"
        };
      } catch {
        return {
          lastMissionDay: null, mission: null, missionDone: false, lastCompletedDay: null, streak: 0, dailyMissionsDone: 0,
          totalTimeSurvived: 0, totalDodged: 0, powerupsCollected: 0,
          unlockedColors: ["blue"], selectedColor: "blue"
        };
      }
    }
    function saveMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {} }

    let stats = loadStats();
    let meta = loadMeta();

    // ====== MISSION SYSTEM ======
    const MissionTypes = { SCORE_L1: "SCORE_L1", PICKUPS: "PICKUPS", SURVIVE_NO_PUPS: "SURVIVE_NO_PUPS", DODGE: "DODGE" };
    function rngFromDate(d){ const t=d.split("-").join(""); let x=Number(t)^0x9e3779b9; return ()=>{ x^=x<<13; x^=x>>>17; x^=x<<5; return (x>>>0)/0xffffffff; }; }
    function generateMissionFor(day){
      const r=rngFromDate(day), c=CONFIG.missionTargets;
      const pool=[ {type:MissionTypes.SCORE_L1,label:`Reach ${c.scoreL1} points`,target:c.scoreL1},
                   {type:MissionTypes.PICKUPS,label:`Collect ${c.pickups} power-ups in one run`,target:c.pickups},
                   {type:MissionTypes.SURVIVE_NO_PUPS,label:`Survive ${c.surviveNoPowerups}s without power-ups`,target:c.surviveNoPowerups},
                   {type:MissionTypes.DODGE,label:`Dodge ${c.dodge} cars in one run`,target:c.dodge} ];
      return pool[Math.floor(r()*pool.length)];
    }
    function ensureMissionForToday(){
      const tk=todayKey();
      if (meta.lastMissionDay!==tk){ meta.lastMissionDay=tk; meta.mission=generateMissionFor(tk); meta.missionDone=false; saveMeta(meta); }
      renderMissionUI();
    }
    function renderMissionUI(progress=null){
      if (missionText && meta.mission) missionText.textContent=meta.mission.label;
      if (streakText) streakText.textContent=`Streak: ${meta.streak} day${meta.streak===1?"":"s"}`;
      if (missionProgressEl) missionProgressEl.textContent=progress?progress:(meta.missionDone?"Completed ✅":"In Progress…");
    }

    // ====== CAREER & COSMETICS ======
    function updateCareerUI(){ if (statTime) statTime.textContent=`${Math.floor(meta.totalTimeSurvived)}s`; if (statDodged) statDodged.textContent=`${meta.totalDodged}`; if (statPups) statPups.textContent=`${meta.powerupsCollected}`; }
    function refreshCosmeticsUnlocks(){
      const unlocks=new Set(meta.unlockedColors);
      CONFIG.cosmeticUnlocks.forEach(u=>{
        const ok=(u.require.streakDays?meta.streak>=u.require.streakDays:true)
          &&(u.require.totalDodged?meta.totalDodged>=u.require.totalDodged:true)
          &&(u.require.dailyMissionsDone?meta.dailyMissionsDone>=u.require.dailyMissionsDone:true)
          &&(u.require.bestLevel?stats.bestLevel>=u.require.bestLevel:true);
        if (ok) unlocks.add(u.id);
      });
      meta.unlockedColors=Array.from(unlocks);
      if (!meta.unlockedColors.includes(meta.selectedColor)) meta.selectedColor="blue";
      saveMeta(meta); populateColorSelect();
    }
    function populateColorSelect(){
      if (!colorSelect) return;
      colorSelect.innerHTML="";
      meta.unlockedColors.forEach(id=>{
        const o=document.createElement("option"); o.value=id; o.textContent=id[0].toUpperCase()+id.slice(1);
        if (id===meta.selectedColor) o.selected=true; colorSelect.appendChild(o);
      });
      if (unlockHint){
        const locked=Object.keys(CONFIG.playerColors).filter(id=>id!=="greenInvuln" && !meta.unlockedColors.includes(id));
        unlockHint.textContent=locked.length?`Unlocks left: ${locked.join(", ")}`:"All colors unlocked—nice!";
      }
    }
    if (colorSelect){ colorSelect.addEventListener("change", ()=>{ meta.selectedColor=colorSelect.value; saveMeta(meta); }); }

    // ====== GAME STATE ======
    let level=1, levelTime=CONFIG.baseLevelTime, timeLeft=levelTime, score=0, lives=3;
    let gameRunning=false, paused=false, intermission=false;

    let player={ x:375, y:420, width:50, height:50, speed:7 };
    let invulnerableUntil=0;

    let runDodged=0, runPickups=0, runNoPowerupTimer=0;

    const lanes={ count:CONFIG.lanes, xCenters:[], laneWidth:0, roadLeft:0, roadRight:0, top:0, bottom:0 };
    function canvasWidth(){ return canvas.width/(window.devicePixelRatio||1); }
    function canvasHeight(){ return canvas.height/(window.devicePixelRatio||1); }
    function laneLeft(i){ return lanes.roadLeft+lanes.laneWidth*i; }
    function laneRight(i){ return laneLeft(i)+lanes.laneWidth; }
    function laneCenter(i){ return lanes.xCenters[i]; }
    function computeLanes(){
      const cw=canvasWidth(), ch=canvasHeight();
      lanes.top=0; lanes.bottom=ch;
      lanes.roadLeft=Math.round(cw*0.08); lanes.roadRight=Math.round(cw*0.92);
      const roadWidth=lanes.roadRight-lanes.roadLeft; lanes.laneWidth=roadWidth/lanes.count;
      lanes.xCenters=[]; for (let i=0;i<lanes.count;i++){ lanes.xCenters.push(Math.round(lanes.roadLeft+lanes.laneWidth*(i+0.5))); }
    }
    function snapPlayerToRoad(){ const cw=canvasWidth(), ch=canvasHeight(); player.x=Math.min(Math.max(player.x,0), cw-player.width); player.y=Math.min(Math.max(player.y,0), ch-player.height); }

    let obstacles=[]; let laneCooldown=[]; let globalSpawnMs=CONFIG.spawnMsLvl1;
    let waveActive=false; let waveTimeout=null; let bossAlive=false;
    let pickups=[]; let effects={ shieldUntil:0, slowUntil:0, doubleScoreUntil:0 };
    let particles=[];

    // Timers
    let animId=null, secondTimer=null, spawnTimer=null, pickupTimer=null;

    // ====== AUDIO ======
    let audioCtx=null, gainMaster=null;
    const buffers={}; let bgmSource=null; let bgmUnlocked=false;

    async function prepareAudio() {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      gainMaster = audioCtx.createGain(); gainMaster.gain.value = 0.5; gainMaster.connect(audioCtx.destination);
      buffers.pickup  = await loadAudioBuffer(audioCtx, ASSETS.audio.pickup);
      buffers.crash   = await loadAudioBuffer(audioCtx, ASSETS.audio.crash);
      buffers.levelup = await loadAudioBuffer(audioCtx, ASSETS.audio.levelup);
      buffers.mission = await loadAudioBuffer(audioCtx, ASSETS.audio.mission);
      buffers.button  = await loadAudioBuffer(audioCtx, ASSETS.audio.button);
      buffers.bgm     = await loadAudioBuffer(audioCtx, ASSETS.audio.bgm);
    }

    function playSfx(name, freq=440, dur=0.12) {
      if (!audioCtx) return;
      if (buffers[name]) {
        const src = audioCtx.createBufferSource();
        src.buffer = buffers[name]; src.connect(gainMaster); src.start();
      } else {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq; g.gain.value = 0.2;
        osc.connect(g); g.connect(gainMaster);
        osc.start(); setTimeout(()=>{ try{osc.stop();}catch{} osc.disconnect(); g.disconnect(); }, dur*1000);
      }
    }

    function startBgm() {
      if (!audioCtx) return;
      if (bgmSource) { try { bgmSource.stop(); } catch{} }
      if (buffers.bgm) {
        bgmSource = audioCtx.createBufferSource();
        bgmSource.buffer = buffers.bgm; bgmSource.loop = true; bgmSource.connect(gainMaster); bgmSource.start();
      } else {
        const osc = audioCtx.createOscillator(); const g = audioCtx.createGain();
        osc.type = "triangle"; osc.frequency.value = 110; g.gain.value = 0.02;
        osc.connect(g); g.connect(gainMaster); osc.start();
        bgmSource = { stop: ()=>{ try{osc.stop(); osc.disconnect(); g.disconnect(); } catch{} } };
      }
    }

    function resumeAudioOnGesture() {
      if (!audioCtx) return;
      if (audioCtx.state === "suspended") audioCtx.resume();
      if (!bgmUnlocked) { bgmUnlocked = true; startBgm(); }
    }

    // ====== SPRITES ======
    const sprites = {
      roadTile: null, laneDash: null, spark: null,
      player: { blue:null, teal:null, orange:null, purple:null, gold:null },
      cars: [],
      bossVan: null,
      pickups: { shield:null, slow:null, double:null }
    };

    // round-robin index for car variety
    let _carIndex = 0;
    function nextCarSprite() {
      if (!sprites.cars.length) return null;
      const img = sprites.cars[_carIndex % sprites.cars.length];
      _carIndex++;
      return img || null;
    }

    async function preloadImages() {
      const jobs = [];
      function push(assign, url){ jobs.push(loadImage(url).then(img => assign(img))); }

      push(v=>sprites.roadTile=v, ASSETS.img.roadTile);
      push(v=>sprites.laneDash=v, ASSETS.img.laneDash);
      push(v=>sprites.spark=v,    ASSETS.img.spark);

      Object.entries(ASSETS.img.player).forEach(([k, u]) => push(v=>sprites.player[k]=v, u));

      const carImgs = [];
      ASSETS.img.cars.forEach((u, i) => push(v=>carImgs[i]=v, u));
      push(v=>sprites.bossVan=v, ASSETS.img.bossVan);
      Object.entries(ASSETS.img.pickups).forEach(([k, u]) => push(v=>sprites.pickups[k]=v, u));

      const total = jobs.length;
      let done = 0;
      function bump(){ done++; if (loadBar) loadBar.style.width = Math.round((done/total)*100) + "%"; }

      for (const j of jobs) { await j; bump(); }

      // keep only real car images
      sprites.cars = (carImgs || []).filter(img => img && !img._placeholder && img.width > 0);

      // debug log
      console.info("[RushHour] Car sprites loaded:",
        sprites.cars.map(i => ({ src: (i && i.src) ? i.src.split("/").pop() : "(missing)", w: i?.width, h: i?.height })));

      if (!sprites.cars.length) {
        console.warn("[RushHour] No traffic car sprites loaded — check /public/assets/rush-hour-dash/img/traffic_car*.png");
      }

      if (loadLabel) loadLabel.textContent = "Tap or press any key to start";
      if (startBtn) startBtn.style.display = "inline-block";

      window._rushSprites = sprites;
    }

    // ====== BACKGROUND ======
    let bgScroll = 0;
    function drawBackground() {
      const cw = canvasWidth(), ch = canvasHeight();
      const tile = sprites.roadTile;
      if (tile && tile.width > 0) {
        const speed = 1.2;
        bgScroll = (bgScroll + speed) % tile.height;
        for (let y = -tile.height + bgScroll; y < ch; y += tile.height) {
          for (let x = 0; x < cw; x += tile.width) ctx.drawImage(tile, x, y);
        }
      } else {
        ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = "#000"; ctx.fillRect(0,0,cw,ch); ctx.restore();
      }

      if (sprites.laneDash && sprites.laneDash.width > 0) {
        const dash = sprites.laneDash;
        const dashH = dash.height, dashW = dash.width;
        const dashScroll = (bgScroll * 1.5) % dashH;
        for (let i=1; i<lanes.count; i++) {
          const x = Math.floor(lanes.roadLeft + lanes.laneWidth * i - dashW/2);
          for (let y = -dashH + dashScroll; y < ch; y += dashH) ctx.drawImage(dash, x, y);
        }
      } else {
        ctx.save(); ctx.strokeStyle="#fff"; ctx.globalAlpha=0.22; ctx.lineWidth=2; ctx.setLineDash([10,12]);
        for (let i=1;i<lanes.count;i++){ const x=lanes.roadLeft+lanes.laneWidth*i; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvasHeight()); ctx.stroke(); }
        ctx.restore();
      }
    }

    // ====== DRAW HELPERS ======
    function drawSpriteOrRect(img, x, y, w, h, fallbackColor="#fff") {
      if (img && img.width > 0) {
        const scale = CONFIG.spriteScale;
        ctx.drawImage(img, x, y, w*scale, h*scale);
      } else {
        ctx.fillStyle = fallbackColor; ctx.fillRect(x, y, w, h);
      }
    }

    // New: soft glow helper for invulnerability
    function drawGlowAroundRect(x, y, w, h) {
      const g = CONFIG.invulnGlow;
      ctx.save();
      ctx.globalAlpha = g.alpha;
      ctx.shadowColor = g.color;
      ctx.shadowBlur = g.blur;

      // Expand a touch so the glow sits just outside the sprite bounds
      const pad = Math.max(2, Math.floor(g.lineWidth / 2));
      ctx.strokeStyle = g.color;
      ctx.lineWidth = g.lineWidth;

      // Because shadow is based on drawn stroke, we stroke a rect slightly larger
      ctx.strokeRect(x - pad, y - pad, w + pad*2, h + pad*2);
      ctx.restore();
    }

    // ====== PARTICLES ======
    function spawnBurst(x, y, n, color="#fff", useSpark=true) {
      for (let i=0;i<n;i++){
        particles.push({
          x, y,
          vx: (Math.random()*2-1)*2.5,
          vy: (Math.random()*-1)*3 - 0.5,
          life: 30+Math.random()*20,
          color,
          spark: useSpark && sprites.spark
        });
      }
    }
    function updateParticles(){
      for (const p of particles){ p.x+=p.vx; p.y+=p.vy; p.vy+=0.06; p.life--; }
      particles = particles.filter(p=>p.life>0);
    }
    function drawParticles(){
      for (const p of particles){
        if (p.spark) {
          const s = Math.max(6, p.life*0.3);
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life/40));
          ctx.drawImage(p.spark, p.x - s/2, p.y - s/2, s, s);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, 2, 2);
        }
      }
    }

    // ====== SPAWNING & BEHAVIOR ======
    function laneXForRect(centerX,w){ return Math.round(centerX - w/2); }

    function createObstacleForLane(type, laneIndex){
      const center = laneCenter(laneIndex);
      const slowFactor = Date.now() < effects.slowUntil ? 0.55 : 1;

      if (type === "boss") {
        const baseLane = Math.max(0, Math.min(laneIndex, lanes.count - 2));
        const left = laneLeft(baseLane) + 8;
        const width = lanes.laneWidth * 2 - 16;
        return { type:"boss", lanes:[baseLane, baseLane+1], x:left, y:-100, w:Math.round(width), h:90, speed:(CONFIG.baseSpeed+level*0.2)*slowFactor, hp:1, sprite:sprites.bossVan };
      }

      // Round-robin car selection (no player fallback)
      const carSprite = nextCarSprite();

      const w = Math.random()<0.5? 44:60; const h=44;
      return {
        type, lane:laneIndex, x:laneXForRect(center,w), y:-h-8, w, h,
        speed:(CONFIG.baseSpeed+Math.random()*2+level*CONFIG.levelSpeedRamp)*slowFactor,
        sPhase: Math.random()*Math.PI*2, sRate:0.06+Math.random()*0.06, sAmp:Math.min((lanes.laneWidth-w)*0.45, 24+Math.random()*10),
        changing:false, targetLane:null, xTarget:null, changeSpeed:4.5+Math.random()*1.5,
        sprite: carSprite
      };
    }

    function chooseType(){
      if (level===1) return "car";
      if (level===2) return Math.random()<0.2? "swerve":"car";
      let weights=[ {t:"car",w:0.55}, {t:"swerve",w:0.22+Math.min(0.1,(level-3)*0.02)}, {t:"changer",w:0.18+Math.min(0.08,(level-3)*0.015)} ];
      if (waveActive){ weights[0].w-=0.12; weights[1].w+=0.08; weights[2].w+=0.08; }
      const total = weights.reduce((a,b)=>a+b.w,0); let roll=Math.random()*total, cum=0;
      for (const w of weights){ cum+=w.w; if (roll<=cum) return w.t; }
      return "car";
    }

    function spawnObstacle(){
      const now=performance.now(); const available=[];
      for (let i=0;i<lanes.count;i++) if (!laneCooldown[i] || now>=laneCooldown[i]) available.push(i);
      if (!available.length) return;

      if (!bossAlive && level>=CONFIG.bossStartLevel && waveActive && Math.random()<0.04){
        const candidates=[]; for (let i=0;i<lanes.count-1;i++) if (available.includes(i)&&available.includes(i+1)) candidates.push(i);
        if (candidates.length){
          const baseLane=candidates[Math.floor(Math.random()*candidates.length)];
          const boss=createObstacleForLane("boss", baseLane); obstacles.push(boss);
          laneCooldown[baseLane]=now+900; laneCooldown[baseLane+1]=now+900; bossAlive=true; return;
        }
      }

      const type=chooseType(); const laneIndex=available[Math.floor(Math.random()*available.length)];
      obstacles.push(createObstacleForLane(type, laneIndex));
      const intervalMs=Math.max(350, globalSpawnMs - level*CONFIG.spawnMsDecrementPerLevel);
      laneCooldown[laneIndex]=now+intervalMs;

      if (waveActive && Math.random()<0.35){
        const others=available.filter(i=>i!==laneIndex);
        if (others.length){
          const li2=others[Math.floor(Math.random()*others.length)];
          const type2=chooseType(); const obj2=createObstacleForLane(type2, li2);
          obj2.y -= 30 + Math.random()*30; obstacles.push(obj2); laneCooldown[li2]=now+intervalMs;
        }
      }
    }

    function spawnPickup(){
      const li=Math.floor(Math.random()*lanes.count); const c=laneCenter(li);
      const w=36, h=36; const types=level>=3? ["shield","slow","double"] : ["shield","double"];
      const img = (t)=> sprites.pickups[t];
      const slowFactor=Date.now()<effects.slowUntil? 0.55:1;
      const type = types[Math.floor(Math.random()*types.length)];
      pickups.push({ type, lane:li, x:laneXForRect(c,w), y:-h-8, w, h, speed:(4.0+level*0.3)*slowFactor, sprite: img(type) });
    }

    function moveThings(){
      for (const o of obstacles){
        o.y += o.speed;
        if (o.type==="swerve"){
          o.sPhase+=o.sRate;
          const left=laneLeft(o.lane)+6, right=laneRight(o.lane)-6-o.w;
          const baseX=laneXForRect(laneCenter(o.lane), o.w);
          const x=baseX + Math.sin(o.sPhase)*o.sAmp;
          o.x = Math.max(left, Math.min(right, x));
        }
        if (o.type==="changer" && level>=3){
          if (!o.changing && Math.random()<0.009+Math.min(0.015,(level-3)*0.001)){
            const dir=Math.random()<0.5?-1:1; const target=o.lane+dir;
            if (canChangeTo(o,target)){ o.changing=true; o.targetLane=target; o.xTarget=laneXForRect(laneCenter(target),o.w); }
          }
          if (o.changing){
            const dx=o.xTarget-o.x; const step=Math.sign(dx)*Math.min(Math.abs(dx), o.changeSpeed);
            o.x+=step;
            if (Math.abs(dx)<=0.5){ o.x=o.xTarget; o.lane=o.targetLane; o.targetLane=null; o.xTarget=null; o.changing=false; }
          }
        }
      }
      obstacles=obstacles.filter(o=>{ const keep=o.y<canvasHeight()+120; if (!keep){ if (o.type==="boss") bossAlive=false; runDodged++; } return keep; });

      for (const p of pickups) p.y += p.speed; pickups = pickups.filter(p=>p.y<canvasHeight()+80);
    }

    function canChangeTo(o, targetLane){
      if (targetLane<0 || targetLane>=lanes.count) return false;
      const futureY=o.y+o.h*0.5;
      for (const other of obstacles){
        if (other===o) continue;
        if (other.type==="boss"){
          if (other.lanes.includes(targetLane)) if (Math.abs((other.y+other.h/2)-futureY)<120) return false;
        } else if (other.lane===targetLane){
          if (Math.abs((other.y+other.h/2)-futureY)<100) return false;
        }
      }
      return true;
    }

    function aabb(a,b){ return a.x<b.x+b.w && a.x+a.width>b.x && a.y<b.y+b.h && a.y+a.height>b.y; }

    function applyPickup(p){
      const now=Date.now();
      if (p.type==="shield") effects.shieldUntil=Math.max(effects.shieldUntil, now+5000);
      else if (p.type==="slow") effects.slowUntil=Math.max(effects.slowUntil, now+4000);
      else effects.doubleScoreUntil=Math.max(effects.doubleScoreUntil, now+8000);
      runNoPowerupTimer=0;
      playSfx("pickup", 660, 0.08);
      spawnBurst(p.x+p.w/2, p.y+p.h/2, CONFIG.pickupParticleCount, "#9aa8ff", true);
    }

    function checkCollisions(){
      // pickups
      for (let i=pickups.length-1;i>=0;i--){
        const p=pickups[i];
        if (aabb(player,{x:p.x,y:p.y,w:p.w,h:p.h})){
          applyPickup(p); runPickups++; meta.powerupsCollected++; pickups.splice(i,1);
        }
      }

      const hasShield=Date.now()<effects.shieldUntil; const isInvuln=Date.now()<invulnerableUntil;
      if (isInvuln) return;

      for (let i=0;i<obstacles.length;i++){
        const o=obstacles[i];
        if (aabb(player,{x:o.x,y:o.y,w:o.w,h:o.h})){
          if (o.type==="boss"){
            if (hasShield){
              score+=150; obstacles.splice(i,1); bossAlive=false; effects.shieldUntil=0; invulnerableUntil=Date.now()+800;
              playSfx("pickup", 330, 0.15); spawnBurst(o.x+o.w/2,o.y+o.h/2, CONFIG.crashParticleCount, "#ffd966", true);
              return;
            } else {
              lives--; invulnerableUntil=Date.now()+1800; playSfx("crash", 120, 0.2);
              spawnBurst(player.x+player.width/2, player.y+player.height/2, CONFIG.crashParticleCount, "#ff6666", true);
              if (lives<=0) endRun(false); return;
            }
          } else {
            if (hasShield){
              effects.shieldUntil=0; invulnerableUntil=Date.now()+800; player.y=Math.max(0, player.y-16);
              playSfx("crash", 220, 0.08); spawnBurst(o.x+o.w/2,o.y+o.h/2, CONFIG.pickupParticleCount, "#ffd966", true);
              obstacles.splice(i,1); return;
            } else {
              lives--; invulnerableUntil=Date.now()+1800; playSfx("crash", 120, 0.2);
              spawnBurst(player.x+player.width/2, player.y+player.height/2, CONFIG.crashParticleCount, "#ff6666", true);
              if (lives<=0) endRun(false); return;
            }
          }
        }
      }
    }

    // ====== RENDER ======
    function drawAll(){
      drawBackground();

      // pickups
      for (const p of pickups){ drawSpriteOrRect(p.sprite, p.x, p.y, p.w, p.h, "#9aa8ff"); }

      // cars/boss
      for (const o of obstacles){
        if (o.type==="boss") drawSpriteOrRect(o.sprite, o.x, o.y, o.w, o.h, "#8a2be2");
        else drawSpriteOrRect(o.sprite, o.x, o.y, o.w, o.h, "#ff5151");
      }

      // player with optional invulnerability glow
      const isInvulnerableActive = Date.now()<invulnerableUntil || Date.now()<effects.shieldUntil;
      if (isInvulnerableActive) {
        // Draw the glow first so the sprite appears above it
        drawGlowAroundRect(player.x, player.y, player.width, player.height);
      }
      const key = (meta.selectedColor in sprites.player) ? meta.selectedColor : "blue";
      drawSpriteOrRect(sprites.player[key], player.x, player.y, player.width, player.height, CONFIG.playerColors[key] || "#3aa0ff");

      drawParticles();
    }

    // ====== HUD & LOOPS ======
    function updateHUD(){
      if (timeText)  timeText.textContent=`Time: ${timeLeft}`;
      if (scoreText) scoreText.textContent=`Score: ${score}`;
      if (levelText) levelText.textContent=`Level: ${level}`;
      if (livesText) livesText.textContent=`Lives: ${lives}`;
      if (trafficText) trafficText.textContent=`Traffic: ${waveActive?"Rush Hour!":"Normal"}`;
      const now=Date.now(); const bits=[];
      if (now<effects.shieldUntil) bits.push(`🛡️ ${Math.ceil((effects.shieldUntil-now)/1000)}s`);
      if (now<effects.slowUntil) bits.push(`🐌 ${Math.ceil((effects.slowUntil-now)/1000)}s`);
      if (now<effects.doubleScoreUntil) bits.push(`✖️2 ${Math.ceil((effects.doubleScoreUntil-now)/1000)}s`);
      if (powerupsText) powerupsText.textContent = bits.length? `Power-ups: ${bits.join(" | ")}`: "Power-ups: —";
    }

    function frame(){
      if (!gameRunning || paused || intermission) return;
      drawAll(); moveThings(); checkCollisions(); updateParticles();
      animId = requestAnimationFrame(frame);
    }

    function secondTick(){
      if (!gameRunning || paused || intermission) return;
      timeLeft--; runNoPowerupTimer++;
      let perSecond=10; if (Date.now()<effects.doubleScoreUntil) perSecond*=2;
      score+=perSecond; meta.totalTimeSurvived+=1; updateCareerUI(); updateHUD();
      if (timeLeft<=0){
        startIntermission(`Level ${level} Complete!`, `Score: ${score}`);
        playSfx("levelup", 523, 0.2);
        setTimeout(()=>{ level++; startLevel(); stopIntermission(); }, 1400);
      }
    }

    function drawOverlayText(title, sub){
      const cw=canvasWidth(), ch=canvasHeight();
      ctx.save(); ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(0,0,cw,ch);
      ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.font="bold 32px system-ui, Arial"; ctx.fillText(title, cw/2, ch/2-10);
      ctx.font="16px system-ui, Arial"; if (sub) ctx.fillText(sub, cw/2, ch/2+24); ctx.restore();
    }

    function startIntermission(title, sub){
      intermission=true; drawOverlayText(title, sub);
      if (banner){ banner.textContent=title + (sub?` — ${sub}`:""); banner.style.display="block"; }
    }
    function stopIntermission(){ intermission=false; if (banner) banner.style.display="none"; frame(); }

    // ====== WAVES ======
    function scheduleWave(){
      if (level<CONFIG.waveStartLevel) return;
      const wavesThisLevel = level>=5? 2:1;
      const starts=[]; for (let i=0;i<wavesThisLevel;i++) starts.push(4+Math.random()*Math.max(3, levelTime-10));
      starts.forEach(s=> setTimeout(()=>{ if (gameRunning) startWave(); }, s*1000));
    }
    function startWave(){
      if (!gameRunning || waveActive) return;
      waveActive=true; updateHUD(); setSpawnInterval(Math.max(380, Math.floor(globalSpawnMs*CONFIG.waveSpawnAccel)));
      clearTimeout(waveTimeout);
      const dur=CONFIG.waveDurationRange[0]+Math.random()*(CONFIG.waveDurationRange[1]-CONFIG.waveDurationRange[0]);
      waveTimeout=setTimeout(endWave, dur);
    }
    function endWave(){ waveActive=false; updateHUD(); setSpawnInterval(globalSpawnMs); }

    // ====== CONTROL ======
    function pauseResume(){ if (!gameRunning) return; paused=!paused; if (pauseBtn) pauseBtn.textContent=paused?"Resume":"Pause"; if (paused) drawOverlayText("Paused","Press P or click Resume"); else animId=requestAnimationFrame(frame); }

    function endRun(survived){
      gameRunning=false; paused=false; intermission=false; clearTimers(); clearTimeout(waveTimeout);
      waveActive=false; bossAlive=false;

      const tk=todayKey(); let completed=false;
      if (!meta.missionDone && meta.mission){
        if (meta.mission.type==="SCORE_L1" && score>=CONFIG.missionTargets.scoreL1) completed=true;
        if (meta.mission.type==="PICKUPS" && runPickups>=CONFIG.missionTargets.pickups) completed=true;
        if (meta.mission.type==="SURVIVE_NO_PUPS" && runNoPowerupTimer>=CONFIG.missionTargets.surviveNoPowerups) completed=true;
        if (meta.mission.type==="DODGE" && runDodged>=CONFIG.missionTargets.dodge) completed=true;
      }
      if (completed) {
        meta.missionDone=true;
        if (meta.lastCompletedDay!==tk){
          meta.streak = (meta.lastCompletedDay && daysBetween(meta.lastCompletedDay, tk)===1)? meta.streak+1: 1;
          meta.lastCompletedDay = tk;
          meta.dailyMissionsDone = (meta.dailyMissionsDone||0)+1;
        }
        saveMeta(meta); renderMissionUI("Completed ✅"); playSfx("mission", 784, 0.25);
      }

      stats.runs+=1; stats.bestScore=Math.max(stats.bestScore,score); stats.bestLevel=Math.max(stats.bestLevel,level); saveStats(stats);
      if (statsLine) statsLine.textContent=`Best: Level ${stats.bestLevel} • Score ${stats.bestScore} • Runs ${stats.runs}`;

      refreshCosmeticsUnlocks();

      drawOverlayText(survived? "✅ You made it to work!" : "❌ You were late!", `Final Score: ${score} • Level ${level}`);
      if (restartBtn) restartBtn.style.display="inline-block";
    }

    function daysBetween(d1,d2){ const a=new Date(d1+"T00:00:00"), b=new Date(d2+"T00:00:00"); return Math.round((b-a)/86400000); }

    function clearTimers(){ if (animId) cancelAnimationFrame(animId); if (secondTimer) clearInterval(secondTimer); if (spawnTimer) clearInterval(spawnTimer); if (pickupTimer) clearInterval(pickupTimer); animId=secondTimer=spawnTimer=pickupTimer=null; }
    function setSpawnInterval(ms){ if (spawnTimer) clearInterval(spawnTimer); spawnTimer=setInterval(spawnObstacle, ms); }
    function setPickupInterval(ms){ if (pickupTimer) clearInterval(pickupTimer); pickupTimer=setInterval(spawnPickup, ms); }

    function startLevel(){
      levelTime=Math.max(CONFIG.minLevelTime, CONFIG.baseLevelTime - Math.floor(level/2));
      timeLeft=levelTime;
      globalSpawnMs=Math.max(CONFIG.spawnMsMin, CONFIG.spawnMsLvl1 - (level-1)*CONFIG.spawnMsDecrementPerLevel);
      laneCooldown=new Array(lanes.count).fill(0);

      obstacles=[]; pickups=[]; bossAlive=false; waveActive=false; clearTimeout(waveTimeout);
      runDodged=0; runPickups=0; runNoPowerupTimer=0;

      const cw=canvasWidth(), ch=canvasHeight();
      player.x=cw/2 - player.width/2; player.y=ch - player.height - 24;

      clearTimers();
      secondTimer=setInterval(secondTick, 1000);
      setSpawnInterval(globalSpawnMs);
      const pickupMs=Math.max(CONFIG.pickupsMinMs, CONFIG.pickupsBaseMs - level*CONFIG.pickupsLevelStep);
      setPickupInterval(pickupMs);

      scheduleWave(); updateHUD(); gameRunning=true; animId=requestAnimationFrame(frame);
    }

    function restartGame(){
      clearTimers(); level=1; timeLeft=CONFIG.baseLevelTime; score=0; lives=3;
      invulnerableUntil=0; effects={ shieldUntil:0, slowUntil:0, doubleScoreUntil:0 };
      if (restartBtn) restartBtn.style.display="none"; paused=false; if (pauseBtn) pauseBtn.textContent="Pause";
      computeLanes(); snapPlayerToRoad(); startLevel();
    }

    // ====== INPUT: Keyboard & Swipe ======
    document.addEventListener("keydown", (e) => {
      if (e.key === "p" || e.key === "P") { e.preventDefault(); pauseResume(); return; }
      if (!gameRunning || paused || intermission) return;
      const cw=canvasWidth(), ch=canvasHeight();
      if (e.key==="ArrowLeft")  player.x=Math.max(0, player.x-player.speed);
      if (e.key==="ArrowRight") player.x=Math.min(cw-player.width, player.x+player.speed);
      if (e.key==="ArrowUp")    player.y=Math.max(0, player.y-player.speed);
      if (e.key==="ArrowDown")  player.y=Math.min(ch-player.height, player.y+player.speed);
    });

    let touchStartX=0, touchStartY=0;
    canvas.addEventListener("touchstart", (e)=>{ if (!gameRunning||paused||intermission) return; const t=e.touches[0]; touchStartX=t.clientX; touchStartY=t.clientY; e.preventDefault(); }, {passive:false});
    canvas.addEventListener("touchend", (e)=>{ if (!gameRunning||paused||intermission) return; const t=e.changedTouches[0]; const dx=t.clientX-touchStartX, dy=t.clientY-touchStartY; const cw=canvasWidth(), ch=canvasHeight(); if (Math.abs(dx)>Math.abs(dy)){ if (dx>0) player.x=Math.min(cw-player.width, player.x+player.speed); else player.x=Math.max(0, player.x-player.speed); } else { if (dy>0) player.y=Math.min(ch-player.height, player.y+player.speed); else player.y=Math.max(0, player.y-player.speed); } e.preventDefault(); }, {passive:false});

    document.addEventListener("gesturestart",(e)=>e.preventDefault());
    document.addEventListener("gesturechange",(e)=>e.preventDefault());
    document.addEventListener("gestureend",(e)=>e.preventDefault());

    if (pauseBtn)   pauseBtn.addEventListener("click", ()=>{ playSfx("button", 440, 0.05); pauseResume(); });
    if (restartBtn) restartBtn.addEventListener("click", ()=>{ playSfx("button", 520, 0.05); restartGame(); });

    // ====== ACCESSIBILITY: Toggleable On-Screen Directional Buttons (D-Pad) ======
    (function setupOnScreenControls(){
      if (!canvas) return;

      // Styles (scoped-ish)
      const style = document.createElement("style");
      style.textContent = `
      .rhd-ctrl-wrap { display:flex; flex-direction:column; align-items:center; gap:.5rem; margin-top:.75rem; }
      .rhd-ctrl-toggle { appearance:none; border:1px solid #444; background:#1e1e1e; color:#eaeaea; padding:.5rem .75rem; border-radius:.5rem; cursor:pointer; font:600 14px system-ui, Arial; }
      .rhd-ctrl-toggle:hover { background:#262626; }
      .rhd-dpad { display:none; user-select:none; touch-action:none; }
      .rhd-dpad.show { display:grid; grid-template-columns:60px 60px 60px; grid-template-rows:60px 60px 60px; gap:.5rem; }
      .rhd-btn { display:flex; align-items:center; justify-content:center; width:60px; height:60px; border-radius:.75rem; background:#2a2a2a; border:1px solid #3a3a3a; color:#eee; font:700 16px system-ui, Arial; box-shadow:0 2px 6px rgba(0,0,0,.25) inset; }
      .rhd-btn:active { transform:scale(0.98); }
      .rhd-btn[disabled] { opacity:.25; }
      @media (max-width: 480px) {
        .rhd-dpad.show { grid-template-columns:56px 56px 56px; grid-template-rows:56px 56px 56px; }
        .rhd-btn { width:56px; height:56px; }
      }`;
      document.head.appendChild(style);

      // Wrapper right after canvas
      const wrap = document.createElement("div");
      wrap.className = "rhd-ctrl-wrap";

      // Toggle button
      const toggle = document.createElement("button");
      toggle.className = "rhd-ctrl-toggle";
      toggle.type = "button";
      toggle.textContent = "Show Touch Controls";
      wrap.appendChild(toggle);

      // D-pad grid
      const dpad = document.createElement("div");
      dpad.className = "rhd-dpad";
      const mkBtn = (label, dx, dy, disabled=false) => {
        const b = document.createElement("button");
        b.className = "rhd-btn";
        b.type = "button";
        b.textContent = label;
        if (disabled) b.setAttribute("disabled", "true");
        attachDirectionalHandler(b, dx, dy);
        return b;
      };
      // Row 1
      dpad.appendChild(document.createElement("span"));
      dpad.appendChild(mkBtn("↑", 0, -1));
      dpad.appendChild(document.createElement("span"));
      // Row 2
      dpad.appendChild(mkBtn("←", -1, 0));
      dpad.appendChild(mkBtn("⦿", 0, 0, true));
      dpad.appendChild(mkBtn("→", 1, 0));
      // Row 3
      dpad.appendChild(document.createElement("span"));
      dpad.appendChild(mkBtn("↓", 0, 1));
      dpad.appendChild(document.createElement("span"));

      wrap.appendChild(dpad);
      canvas.parentNode.insertBefore(wrap, canvas.nextSibling);

      toggle.addEventListener("click", () => {
        const show = !dpad.classList.contains("show");
        dpad.classList.toggle("show", show);
        toggle.textContent = show ? "Hide Touch Controls" : "Show Touch Controls";
      });

      // Hold-to-move handler
      let holdTimer = null;
      let cancelDocHandlers = null;

      function attachDirectionalHandler(btn, dx, dy) {
        if (btn.hasAttribute("disabled")) return;
        const stepMove = () => {
          if (!gameRunning || paused || intermission) return;
          const cw = canvasWidth(), ch = canvasHeight();
          const px = player.x + dx * player.speed;
          const py = player.y + dy * player.speed;
          player.x = Math.min(Math.max(0, px), cw - player.width);
          player.y = Math.min(Math.max(0, py), ch - player.height);
        };
        const startHold = (ev) => {
          ev.preventDefault();
          stepMove();
          if (holdTimer) clearInterval(holdTimer);
          holdTimer = setInterval(stepMove, 30);
          const prevent = (e) => e.preventDefault();
          document.addEventListener("touchmove", prevent, { passive: false });
          document.addEventListener("wheel", prevent, { passive: false });
          cancelDocHandlers = () => {
            document.removeEventListener("touchmove", prevent);
            document.removeEventListener("wheel", prevent);
          };
        };
        const endHold = (ev) => {
          if (ev) ev.preventDefault();
          if (holdTimer) { clearInterval(holdTimer); holdTimer = null; }
          if (cancelDocHandlers) { cancelDocHandlers(); cancelDocHandlers = null; }
        };

        btn.addEventListener("mousedown", startHold);
        btn.addEventListener("mouseup", endHold);
        btn.addEventListener("mouseleave", endHold);
        btn.addEventListener("touchstart", startHold, { passive: false });
        btn.addEventListener("touchend", endHold, { passive: false });
        btn.addEventListener("touchcancel", endHold, { passive: false });
      }
    })();

    // ====== BOOT ======
    function updateStatsLine(){ if (statsLine) statsLine.textContent=`Best: Level ${stats.bestLevel} • Score ${stats.bestScore} • Runs ${stats.runs}`; }
    function renderAllMeta(){ ensureMissionForToday(); refreshCosmeticsUnlocks(); populateColorSelect(); updateCareerUI(); renderMissionUI(); }

    (async function boot(){
      resizeForDPR(); computeLanes(); snapPlayerToRoad();
      updateStatsLine(); renderAllMeta();
      await preloadImages();

      function startGameFlow(){
        if (!audioCtx) { prepareAudio().then(()=>{ resumeAudioOnGesture(); }); } else { resumeAudioOnGesture(); }
        if (loader) loader.style.display="none";
        startIntermission(`Level ${level} — Get to work!`, null);
        setTimeout(()=>{ stopIntermission(); startLevel(); }, 900);
        window.removeEventListener("keydown", startGameOnce);
        canvas.removeEventListener("touchstart", startGameOnce);
        if (startBtn) startBtn.removeEventListener("click", startGameOnce);
      }
      const startGameOnce = ()=> startGameFlow();
      window.addEventListener("keydown", startGameOnce, { once: true });
      canvas.addEventListener("touchstart", startGameOnce, { once: true, passive: true });
      if (startBtn) startBtn.addEventListener("click", startGameOnce, { once: true });
    })();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
