/* =========================================================
   Help Desk Hero — Slap or Serve (Ping.Trace.SSH)
   - 50 baked-in scenarios (names, titles, valid/invalid, fixes)
   - Levels: promotion every 10 questions (5 levels total)
   - Corporate windows in Shadow DOM (start/pause/game over/promotion)
   - Slap effects: pose swap, character shake, screen shake
   - Background image layer behind characters
   ========================================================= */

/* ======== Background image behind characters (optional) ======== */
const BACKGROUND_URL = "/help-desk-hero/bg-office.png"; // leave "" to disable

/* ================== COMPLETE SCENARIOS (50) ================== */
const SCENARIOS = [
  {name:"Sarah Miller",title:"Marketing Manager",gender:"F",report:"My email stopped working so I restarted the coffee machine.",isValid:false},
  {name:"Tom Jenkins",title:"Network Engineer",gender:"M",report:"My VPN drops every hour after the company’s DHCP lease expires.",isValid:true,fixes:["Replace the VPN client with Zoom","Increase the DHCP lease time or configure a static IP for VPN clients.","Tell the user to restart their coffee machine"],correctFix:"Increase the DHCP lease time or configure a static IP for VPN clients."},
  {name:"Linda Perez",title:"HR Specialist",gender:"F",report:"My keyboard isn’t typing, so I put it in the microwave to dry it off.",isValid:false},
  {name:"James Wu",title:"Software Developer",gender:"M",report:"Git commits fail because SSH keys aren’t configured on my new laptop.",isValid:true,fixes:["Delete all repositories","Generate and add SSH keys to your Git service account.","Install more RAM"],correctFix:"Generate and add SSH keys to your Git service account."},
  {name:"Karen Smith",title:"Accountant",gender:"F",report:"I can’t open Excel because the internet is down.",isValid:false},
  {name:"Mike Brown",title:"Systems Administrator",gender:"M",report:"The RAID array is degraded after a disk failure.",isValid:true,fixes:["Defrag the array","Replace the failed disk and rebuild the RAID array.","Turn the server off and on again"],correctFix:"Replace the failed disk and rebuild the RAID array."},
  {name:"Rachel Adams",title:"Receptionist",gender:"F",report:"I spilled coffee on my keyboard, so I put it in the freezer.",isValid:false},
  {name:"Paul Rivera",title:"Sales Executive",gender:"M",report:"My CRM app won’t load after the latest Windows update.",isValid:true,fixes:["Switch to a Mac","Clear cache, reinstall the CRM client, or use compatibility mode per vendor docs.","Buy a new monitor"],correctFix:"Clear cache, reinstall the CRM client, or use compatibility mode per vendor docs."},
  {name:"Jessica Lee",title:"UX Designer",gender:"F",report:"I can’t connect to Wi‑Fi because my mouse battery is dead.",isValid:false},
  {name:"Alex Carter",title:"Help Desk Intern",gender:"M",report:"A user’s laptop won’t boot after a failed BIOS update.",isValid:true,fixes:["Install Windows updates","Re‑flash the BIOS using recovery mode or replace the motherboard if bricked.","Remove the Wi‑Fi card"],correctFix:"Re‑flash the BIOS using recovery mode or replace the motherboard if bricked."},

  {name:"George Mason",title:"Warehouse Supervisor",gender:"M",report:"I can’t print labels because the lights are off.",isValid:false},
  {name:"Emily Chen",title:"Data Analyst",gender:"F",report:"My database queries are slow because indexes are missing.",isValid:true,fixes:["Delete half the data","Add appropriate indexes to critical columns and analyze query plans.","Switch the monitor cable"],correctFix:"Add appropriate indexes to critical columns and analyze query plans."},
  {name:"Derek Hall",title:"HR Manager",gender:"M",report:"My webcam light is on, so I unplugged the building’s fire alarm system.",isValid:false},
  {name:"Nina Gomez",title:"Security Officer",gender:"F",report:"My access card won’t scan after the system maintenance.",isValid:true,fixes:["Replace the door","Re‑enroll the badge in the access control system and verify permissions.","Format your hard drive"],correctFix:"Re‑enroll the badge in the access control system and verify permissions."},
  {name:"Owen Davis",title:"Software Tester",gender:"M",report:"The test environment isn’t syncing with production.",isValid:true,fixes:["Reboot your phone","Check replication services, credentials, and network connectivity to prod.","Lower the screen brightness"],correctFix:"Check replication services, credentials, and network connectivity to prod."},
  {name:"Mia Torres",title:"Customer Support Rep",gender:"F",report:"I can’t log in because I forgot my password.",isValid:true,fixes:["Send them a meme","Verify identity and reset the account password via the official process.","Tell them to turn it off and on"],correctFix:"Verify identity and reset the account password via the official process."},
  {name:"Liam Brooks",title:"Copywriter",gender:"M",report:"My monitor is too bright so I unplugged my Ethernet cable.",isValid:false},
  {name:"Sofia Mitchell",title:"Project Manager",gender:"F",report:"My shared drive folder disappeared after I deleted it.",isValid:true,fixes:["Ignore the issue","Restore the folder from the recycle bin or backup.","Uninstall Microsoft Office"],correctFix:"Restore the folder from the recycle bin or backup."},
  {name:"Ethan Ross",title:"Cloud Engineer",gender:"M",report:"Our VM auto‑scaling stopped after hitting the CPU limit.",isValid:true,fixes:["Unplug the server","Raise autoscaling thresholds or optimize workloads; confirm metrics pipeline.","Replace the mouse batteries"],correctFix:"Raise autoscaling thresholds or optimize workloads; confirm metrics pipeline."},
  {name:"Hannah Price",title:"Content Strategist",gender:"F",report:"My phone’s camera isn’t working so I restarted the coffee machine.",isValid:false},

  {name:"Noah Evans",title:"IT Director",gender:"M",report:"Firewall rules are blocking legitimate business traffic.",isValid:true,fixes:["Remove the firewall entirely","Review logs and adjust rules/objects; implement allowlists with change control.","Switch Wi‑Fi networks"],correctFix:"Review logs and adjust rules/objects; implement allowlists with change control."},
  {name:"Isabella Ward",title:"Finance Assistant",gender:"F",report:"I can’t use my calculator app because the printer is jammed.",isValid:false},
  {name:"Daniel Foster",title:"DevOps Engineer",gender:"M",report:"Deployment pipeline is failing due to missing environment variables.",isValid:true,fixes:["Delete the repo","Add required environment variables/secrets to CI/CD config and rerun.","Install more RAM"],correctFix:"Add required environment variables/secrets to CI/CD config and rerun."},
  {name:"Ava Gray",title:"Recruiter",gender:"F",report:"I can’t email candidates because my stapler is jammed.",isValid:false},
  {name:"Matthew Hughes",title:"IT Support Specialist",gender:"M",report:"Outlook crashes when opening large attachments.",isValid:true,fixes:["Switch to Gmail","Update/repair Office and increase PST/OST size limits; check add‑ins.","Lower the screen resolution"],correctFix:"Update/repair Office and increase PST/OST size limits; check add‑ins."},
  {name:"Zoe Bennett",title:"Legal Counsel",gender:"F",report:"I deleted all my case files to free up space; now I need them back.",isValid:true,fixes:["Reinstall the OS","Restore from backups or previous versions; stop using the drive.","Change the keyboard"],correctFix:"Restore from backups or previous versions; stop using the drive."},
  {name:"Henry Cooper",title:"Operations Manager",gender:"M",report:"My desk phone stopped working so I rebooted the main router.",isValid:false},
  {name:"Chloe Richardson",title:"Graphic Designer",gender:"F",report:"My color profile isn’t loading after the last OS update.",isValid:true,fixes:["Replace the monitor","Re‑import the correct color profile and set it as default; update GPU driver.","Reboot the coffee machine"],correctFix:"Re‑import the correct color profile and set it as default; update GPU driver."},
  {name:"Samuel Howard",title:"Facilities Manager",gender:"M",report:"The lights flicker when I open my Excel spreadsheets.",isValid:false},
  {name:"Ella Murphy",title:"SEO Specialist",gender:"F",report:"My analytics dashboard stopped updating after an API key expired.",isValid:true,fixes:["Unplug the server","Create a new API key and update the dashboard’s credentials/config.","Defrag the SSD"],correctFix:"Create a new API key and update the dashboard’s credentials/config."},

  {name:"Patrick Quinn",title:"Procurement Specialist",gender:"M",report:"Label printer won’t print; it says toner empty.",isValid:true,fixes:["Reinstall Windows","Replace the toner cartridge and reset the printer’s supply counter.","Switch to dark mode"],correctFix:"Replace the toner cartridge and reset the printer’s supply counter."},
  {name:"Bianca Rossi",title:"Social Media Manager",gender:"F",report:"Instagram is down; should I reboot the corporate firewall?",isValid:false},
  {name:"Victor Han",title:"Database Administrator",gender:"M",report:"Replication lag increased after last network change.",isValid:true,fixes:["Disable replication","Verify MTU, latency, and firewall ports; tune replication settings.","Delete the primary"],correctFix:"Verify MTU, latency, and firewall ports; tune replication settings."},
  {name:"Grace Patel",title:"Executive Assistant",gender:"F",report:"I left my laptop at home—can you email me the company master password?",isValid:false},
  {name:"Omar Rahman",title:"Field Technician",gender:"M",report:"Barcode scanner won’t pair over Bluetooth after OS update.",isValid:true,fixes:["Replace the router","Remove/forget the device, update drivers/firmware, and re‑pair.","Turn off Bluetooth forever"],correctFix:"Remove/forget the device, update drivers/firmware, and re‑pair."},
  {name:"Julia Novak",title:"Research Scientist",gender:"F",report:"I spilled ethanol on my laptop and now it won’t power on.",isValid:true,fixes:["Use a hair dryer on high heat","Power off, disconnect battery/power, do not turn on; open a damage ticket and arrange data recovery.","Shake it really hard"],correctFix:"Power off, disconnect battery/power, do not turn on; open a damage ticket and arrange data recovery."},
  {name:"Diego Alvarez",title:"Finance Director",gender:"M",report:"Excel crashes when loading a specific add‑in.",isValid:true,fixes:["Buy a new keyboard","Disable/remove the faulty add‑in; repair Office; update the add‑in.","Lower screen resolution"],correctFix:"Disable/remove the faulty add‑in; repair Office; update the add‑in."},
  {name:"Nora Kim",title:"QA Analyst",gender:"F",report:"I lost my 2FA phone and can’t log into the bug tracker.",isValid:true,fixes:["Create a new account","Verify identity and reset MFA via admin; enroll new device per policy.","Disable 2FA for everyone"],correctFix:"Verify identity and reset MFA via admin; enroll new device per policy."},
  {name:"Peter Long",title:"Sales Operations",gender:"M",report:"Battery shows “plugged in, not charging”.",isValid:true,fixes:["Replace the monitor","Use the correct wattage adapter/port; reseat cable; update BIOS/battery driver.","Disable the battery"],correctFix:"Use the correct wattage adapter/port; reseat cable; update BIOS/battery driver."},

  {name:"Serena Blake",title:"PR Coordinator",gender:"F",report:"Wi‑Fi is weak in Boardroom B since the new metal wall art.",isValid:true,fixes:["Change the desktop wallpaper","Perform a site survey; add/move APs or adjust channels/power.","Block all guest devices"],correctFix:"Perform a site survey; add/move APs or adjust channels/power."},
  {name:"Ahmed Aziz",title:"Data Scientist",gender:"M",report:"CUDA toolkit mismatch after GPU driver update.",isValid:true,fixes:["Use integrated graphics only","Install compatible NVIDIA driver/CUDA versions; match toolkit to framework.","Delete the .nv folder blindly"],correctFix:"Install compatible NVIDIA driver/CUDA versions; match toolkit to framework."},
  {name:"Keisha Johnson",title:"Office Manager",gender:"F",report:"Opened 'invoice.zip'; now files have strange extensions.",isValid:true,fixes:["Keep working; it’s fine","Isolate the device from the network; contact security; begin ransomware response.","Email the file to colleagues to check"],correctFix:"Isolate the device from the network; contact security; begin ransomware response."},
  {name:"Mark O’Neil",title:"Copy Editor",gender:"M",report:"Keys type wrong characters; keyboard layout seems off.",isValid:true,fixes:["Replace the CPU","Switch to the correct keyboard layout and remove unwanted layouts.","Bang the keyboard"],correctFix:"Switch to the correct keyboard layout and remove unwanted layouts."},
  {name:"Tatiana Sokolov",title:"Legal Operations",gender:"F",report:"PDFs print as gibberish from the new printer.",isValid:true,fixes:["Print more pages","Install correct driver/PS interpreter; try 'Print as Image' in Adobe.","Convert PDF to TXT and print"],correctFix:"Install correct driver/PS interpreter; try 'Print as Image' in Adobe."},
  {name:"Brad Young",title:"Facilities Technician",gender:"M",report:"I plugged Ethernet into the phone port and saw a spark. Is that okay?",isValid:false},
  {name:"Holly Nguyen",title:"Product Manager",gender:"F",report:"Slack notifications don’t arrive during meetings (Focus mode).",isValid:true,fixes:["Reinstall Slack hourly","Disable OS Focus/Do Not Disturb for Slack; allow Slack to bypass Focus.","Turn off Wi‑Fi during meetings"],correctFix:"Disable OS Focus/Do Not Disturb for Slack; allow Slack to bypass Focus."},
  {name:"Jorge Mendes",title:"Warehouse Picker",gender:"M",report:"Handheld scanner won’t read barcodes; lens looks cloudy.",isValid:true,fixes:["Factory reset the ERP","Clean the scanner window; check symbology settings and brightness.","Reduce warehouse lighting"],correctFix:"Clean the scanner window; check symbology settings and brightness."},
  {name:"Mei Lin",title:"Research Intern",gender:"F",report:"Found a USB drive in the parking lot; should I plug it in to find the owner?",isValid:false},
  {name:"Quentin Dupont",title:"CEO",gender:"M",report:"I need admin rights to install Solitaire.",isValid:false},
  {name:"Riley Cooper",title:"Site Reliability Engineer",gender:"M",report:"PagerDuty didn’t call after I changed my phone number.",isValid:true,fixes:["Mute the runbook","Update contact methods; re‑verify phone; confirm escalation routing.","Disable all alerts"],correctFix:"Update contact methods; re‑verify phone; confirm escalation routing."},

  // 6 more to hit 50
  {name:"Priya Shah",title:"Product Analyst",gender:"F",report:"JIRA emails stopped after I created a mail filter.",isValid:true,fixes:["Delete JIRA","Adjust or disable the mail filter; whitelist the sender/domain.","Switch to SMS"],correctFix:"Adjust or disable the mail filter; whitelist the sender/domain."},
  {name:"Gordon Pike",title:"Janitorial Lead",gender:"M",report:"The breaker tripped when I charged my phone with an Ethernet cable.",isValid:false},
  {name:"Ana Morales",title:"Customer Success Manager",gender:"F",report:"Calendar invites show the wrong time zone.",isValid:true,fixes:["Upgrade the monitor","Set correct time zone in OS and calendar profile; resync accounts.","Disable daylight saving globally"],correctFix:"Set correct time zone in OS and calendar profile; resync accounts."},
  {name:"Yusuf Ali",title:"Mobile Engineer",gender:"M",report:"Android build fails: SDK path not found on the CI agent.",isValid:true,fixes:["Reboot the microwave","Install/point to the correct Android SDK; update PATH/ANDROID_HOME.","Buy a new chair"],correctFix:"Install/point to the correct Android SDK; update PATH/ANDROID_HOME."},
  {name:"Amelia Stone",title:"Finance Ops",gender:"F",report:"I shared a sheet publicly by accident and need it locked down.",isValid:true,fixes:["Ignore it","Restrict link sharing; remove public access; rotate any exposed data","Print the sheet to PDF"],correctFix:"Restrict link sharing; remove public access; rotate any exposed data"},
  {name:"Chris Nolan",title:"Video Producer",gender:"M",report:"4K renders fail after disk fills up.",isValid:true,fixes:["Delete the OS","Free disk space; move scratch/cache to high‑capacity drive; resume render.","Replace HDMI cable"],correctFix:"Free disk space; move scratch/cache to high‑capacity drive; resume render."}
];

/* ================== STATE ================== */
let currentIndex = 0;         // 0..SCENARIOS.length-1
let lives = 3;
let wrongSlaps = 0;
let soundOn = true;

/* derived */
function levelFromIndex(i){ return Math.floor(i/10) + 1; } // Level 1..5
function isLevelBoundary(i){ return i>0 && i%10===0; }     // after 10,20,30,40

/* ================== DOM ================== */
const gameEl = document.getElementById("game");
const charBgEl = document.getElementById("char-bg");
const heroImg = document.getElementById("hero-img");
const userImg = document.getElementById("user-img");
const slapEffect = document.getElementById("slap-effect");
const userNameEl = document.getElementById("user-name");
const userTitleEl = document.getElementById("user-title");
const userReportEl = document.getElementById("user-report");
const resultEl = document.getElementById("result");
const btnValid = document.getElementById("btn-valid");
const btnRidiculous = document.getElementById("btn-ridiculous");
const btnPause = document.getElementById("btn-pause");
const fixOptionsEl = document.getElementById("fix-options");
const fixButtonsEl = document.getElementById("fix-buttons");

/* ================== AUDIO SYSTEM ================== */
const sounds = {
  slapYou: new Audio("/help-desk-hero/sfx/slap-you.mp3"),
  slapThem: new Audio("/help-desk-hero/sfx/slap-them.mp3"),
  correct: new Audio("/help-desk-hero/sfx/correct.mp3"),
};

function playSound(key) {
  if (!soundOn || !sounds[key]) return;
  try {
    // rewind to start in case the same sound is triggered quickly again
    sounds[key].currentTime = 0;
    sounds[key].play();
  } catch (e) {
    console.warn("Sound playback failed:", e);
  }
}

const sfx = {
  slapYou: () => playSound("slapYou"),
  slapThem: () => playSound("slapThem"),
  correct: () => playSound("correct"),
};

/* ================== AVATARS / POSES ================== */
function stablePick01(name){ let h=0; for(let i=0;i<name.length;i++) h=(h+name.charCodeAt(i))&0xffff; return h%2; }
function characterFor(gender,name){ const i=stablePick01(name||""); return gender==="F" ? (i? "female2":"female1") : (i? "male2":"male1"); }

let currentScenario = null;
function setPose(who, pose) {
  if (who === "hero") {
    heroImg.src = `/help-desk-hero/hero-${pose}.png`;
  } else if (who === "user") {
    const ch = (currentScenario && currentScenario.character) ? currentScenario.character : "male1";
    userImg.src = `/help-desk-hero/${ch}-${pose}.png`;
  }
}

/* ================== ANIMATIONS ================== */
function shakeElement(el, cycles=5, px=8, ms=45){
  let i=0; const t=setInterval(()=>{ el.style.transform=`translateX(${i%2===0?-px:px}px)`; if(++i>cycles){clearInterval(t); el.style.transform="translateX(0)";}},ms);
}
function screenShake(){ gameEl.classList.remove("shake"); void gameEl.offsetWidth; gameEl.classList.add("shake"); setTimeout(()=>gameEl.classList.remove("shake"),260); }
function playSlapAnimation(correct){
  slapEffect.style.display="block"; slapEffect.style.opacity="1";
  if (correct){ setPose("hero","slap"); setPose("user","slapped"); shakeElement(userImg); sfx.slapThem(); }
  else { setPose("hero","slapped"); setPose("user","slap"); shakeElement(heroImg); sfx.slapYou(); }
  screenShake();
  setTimeout(()=>{ setPose("hero","neutral"); setPose("user","neutral"); slapEffect.style.display="none"; },600);
}

/* ================== SHADOW DOM WINDOWS ================== */
let uiRoot=null;
const SHADOW_CSS=`:host{all:initial;contain:layout style;font:13px/1.5 ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;color:#e7eefc}
.window-card{width:min(720px,92%);background:#16181d;border:1px solid #2a2f37;border-radius:14px;box-shadow:0 16px 60px rgba(0,0,0,.55);overflow:hidden}
.window-bar{display:flex;align-items:center;justify-content:center;background:#1c1f25;border-bottom:1px solid #2a2f37;padding:10px 12px}
.window-title{font-weight:800;letter-spacing:.2px;color:#dfe6f2}
.window-body{padding:14px 16px 16px}
.menu-sub{margin:0 0 .75rem;color:#aeb7c2;font-size:1.05rem;text-align:center}
.stats{display:flex;flex-wrap:wrap;gap:.6rem .75rem;justify-content:center;margin:.6rem 0 1rem}
.chip{border:1px solid #343a43;background:#1b1f24;padding:.45rem .65rem;border-radius:999px;color:#d7dde6}
.menu-actions{display:flex;flex-wrap:wrap;gap:.6rem;justify-content:center;margin:.5rem 0 .25rem}
.btn{appearance:none;border:1px solid #2a3347;color:#e7eefc;background:linear-gradient(180deg,#1a2030,#121726);padding:.65rem .95rem;border-radius:12px;cursor:pointer;font:600 14px/1 ui-sans-serif,system-ui}
.btn-primary{background:linear-gradient(180deg,#4da3ff,#7cc4ff);color:#081018;border-color:#1a5db8;box-shadow:0 10px 24px rgba(77,163,255,.35)}
.kbd{border:1px solid #2a3347;background:#111726;border-radius:6px;padding:2px 6px}
.menu-footer{border-top:1px solid #262a30;padding:10px 4px 0;color:#9aa3ad;text-align:center}
@keyframes popIn{from{transform:translateY(-4px) scale(.98);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
`;
function overlayHost(){ return document.getElementById("overlay"); }
function ensureShadow(){ const host=overlayHost(); if(!host) return null; if(!uiRoot) uiRoot=host.attachShadow({mode:"open"}); return uiRoot; }
function showOverlay(html){ const root=ensureShadow(); if(!root) return; root.innerHTML=`<style>${SHADOW_CSS}</style><div class="window-card" role="dialog" aria-modal="true" style="animation:popIn .18s ease-out"><div class="window-bar"><div class="window-title">Help Desk Hero</div></div><div class="window-body">${html}</div></div>`; overlayHost().style.display="grid"; root.addEventListener("click",onShadowClick,{passive:false}); }
function hideOverlay(){ const host=overlayHost(); if(!host) return; host.style.display="none"; if(uiRoot) uiRoot.innerHTML=""; }
function onShadowClick(e){ const el=e.composedPath().find(n=>n&&n.id); if(!el) return; switch(el.id){ case "start-btn": startGame(); break; case "resume-btn": hideOverlay(); break; case "pause-settings-btn": renderSettings("paused"); break; case "menu-btn": renderStartMenu(); break; case "restart-btn": startGame(true); break; case "howto-btn": renderHowTo(); break; case "settings-btn": renderSettings("menu"); break; case "toggle-sound": soundOn=!soundOn; el.textContent=soundOn?"On":"Off"; break; }}

/* windows */
function renderStartMenu(){
  showOverlay(`
    <p class="menu-sub">Read the ticket. If it’s ridiculous, slap. If it’s valid, choose the correct fix. Three mistakes and you’re fired.</p>
    <div class="stats">
      <span class="chip">Scenarios: <strong>${SCENARIOS.length}</strong></span>
      <span class="chip">Levels: <strong>5</strong> (10 questions each)</span>
      <span class="chip">Lives per run: <strong>3</strong></span>
    </div>
    <div class="menu-actions">
      <button id="start-btn" class="btn btn-primary">Start Game</button>
      <button id="howto-btn" class="btn">How to Play</button>
      <button id="settings-btn" class="btn">Settings</button>
    </div>
    <div class="menu-footer">Press <span class="kbd">Enter</span> to start</div>
  `);
}
function renderPause(){
  showOverlay(`
    <p class="menu-sub">Paused</p>
    <div class="menu-actions">
      <button id="resume-btn" class="btn btn-primary">Resume</button>
      <button id="pause-settings-btn" class="btn">Settings</button>
      <button id="menu-btn" class="btn">Main Menu</button>
    </div>
  `);
}
function renderSettings(from="menu"){
  showOverlay(`
    <p class="menu-sub">Settings</p>
    <div class="menu-actions" style="gap:1rem;">
      <div style="display:flex;align-items:center;gap:.6rem;">
        <span>Sound</span>
        <button id="toggle-sound" class="btn">${soundOn ? "On" : "Off"}</button>
      </div>
    </div>
    <div class="menu-actions" style="margin-top:1rem;">
      <button id="${from==='menu' ? 'menu-btn' : 'resume-btn'}" class="btn">Back</button>
    </div>
  `);
}
function renderHowTo(){
  showOverlay(`
    <p class="menu-sub">Judge each ticket. If valid, pick the right fix. If ridiculous, slap. Every 10 tickets you’re <strong>promoted</strong> to the next level.</p>
    <ul style="margin:.6rem auto 0;max-width:520px;color:#c9d2dd;line-height:1.5;">
      <li><strong>Ridiculous</strong> → slap the user (correct).</li>
      <li><strong>Valid</strong> → choose the correct fix; wrong fix costs a life.</li>
      <li>Slapping a valid request adds a <strong>Wrong Slap</strong> strike.</li>
      <li>3 Wrong Slaps or 0 Lives → <strong>You’re Fired</strong>.</li>
      <li>Levels (1–5): every 10 tickets. Keep going!</li>
    </ul>
    <div class="menu-actions" style="margin-top:1rem;">
      <button id="menu-btn" class="btn">Back</button>
    </div>
  `);
}
function renderGameOver(reason="Bad call on that last ticket."){
  showOverlay(`
    <p class="menu-sub" style="font-size:1.25rem;font-weight:800;margin-bottom:.4rem;">You’re Fired!</p>
    <p class="menu-sub" style="margin-top:-.25rem;">${reason}</p>
    <div class="menu-actions">
      <button id="restart-btn" class="btn btn-primary">Play Again</button>
      <button id="menu-btn" class="btn">Main Menu</button>
    </div>
  `);
}
function renderPromotion(level){
  showOverlay(`
    <p class="menu-sub" style="font-size:1.25rem;font-weight:800;margin-bottom:.4rem;">Promotion!</p>
    <p class="menu-sub" style="margin-top:-.25rem;">Welcome to <strong>Level ${level}</strong>. Tickets get trickier.</p>
    <div class="menu-actions">
      <button id="resume-btn" class="btn btn-primary">Continue</button>
    </div>
  `);
}

/* ================== UTIL ================== */
function applyBackground(){
  if (!charBgEl) return;
  if (BACKGROUND_URL) {
    charBgEl.style.backgroundImage = `url("${BACKGROUND_URL}")`;
    charBgEl.style.display = "block";
  } else {
    charBgEl.style.display = "none";
  }
}
function updateHUD(){
  const q = Math.min(currentIndex+1, SCENARIOS.length);
  const level = levelFromIndex(currentIndex);
  document.getElementById("questions").textContent = `Question: ${q}/${SCENARIOS.length} — Level ${level}`;
  document.getElementById("lives").textContent = `Lives: ${lives}`;
  document.getElementById("slaps").textContent = `Wrong Slaps: ${wrongSlaps}`;
}

/* ================== GAME FLOW ================== */
function showScenario() {
  currentScenario = SCENARIOS[currentIndex];
  if (!currentScenario.character) {
    currentScenario.character = characterFor(currentScenario.gender || "M", currentScenario.name || "");
  }
  userNameEl.textContent = currentScenario.name || "";
  userTitleEl.textContent = currentScenario.title || "";
  userReportEl.textContent = currentScenario.report || "";
  setPose("hero", "neutral");
  setPose("user", "neutral");
  fixOptionsEl.style.display = "none";
  fixButtonsEl.innerHTML = "";
  resultEl.textContent = "";
  updateHUD();
}

function handleChoice(isValidChoice) {
  if (currentScenario.isValid) {
    if (!isValidChoice) {
      wrongSlaps++; lives--;
      updateHUD();
      resultEl.textContent = "You slapped a valid request!";
      playSlapAnimation(false);
      checkGameOver("You slapped a valid request.");
    } else {
      const fixes = currentScenario.fixes || [];
      if (!fixes.length) { resultEl.textContent = "Correct! Handled."; sfx.correct(); nextQuestion(); return; }
      // Build fix buttons
      fixButtonsEl.innerHTML = "";
      for (const fix of fixes) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn";
        btn.textContent = fix;
        btn.onclick = () => handleFixChoice(fix);
        fixButtonsEl.appendChild(btn);
      }
      fixOptionsEl.style.display = "block";
    }
  } else {
    if (isValidChoice) {
      lives--; updateHUD(); resultEl.textContent = "You accepted a ridiculous request!";
      playSlapAnimation(false);
      checkGameOver("You accepted a ridiculous request.");
    } else {
      resultEl.textContent = "Correct! That was ridiculous.";
      playSlapAnimation(true);
      nextQuestion();
    }
  }
}

function handleFixChoice(selectedFix) {
  if (selectedFix === currentScenario.correctFix) {
    resultEl.textContent = "Correct fix applied!";
    sfx.correct();
    playSlapAnimation(true);
    nextQuestion();
  } else {
    lives--; updateHUD();
    resultEl.textContent = "Wrong fix! You got slapped!";
    playSlapAnimation(false);
    checkGameOver("You applied the wrong fix.");
  }
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex >= SCENARIOS.length) {
    renderGameOver("You handled all tickets! Promotion unlocked.");
    return;
  }
  // Promotion window at level boundaries (after Q10,20,30,40)
  if (isLevelBoundary(currentIndex)) {
    renderPromotion(levelFromIndex(currentIndex));
    // after closing, show next scenario
    const check = setInterval(() => {
      if (overlayHost().style.display === "none") { clearInterval(check); setTimeout(showScenario, 150); }
    }, 120);
  } else {
    setTimeout(showScenario, 800);
  }
}

function checkGameOver(reason) {
  if (lives <= 0 || wrongSlaps >= 3) {
    renderGameOver(reason);
  }
}

/* ================== START / PAUSE / INPUT ================== */
function startGame(){
  hideOverlay();
  currentIndex = 0; lives = 3; wrongSlaps = 0;
  setPose("hero","neutral"); setPose("user","neutral");
  resultEl.textContent = "";
  applyBackground();
  showScenario();
}

btnValid.addEventListener("click", () => handleChoice(true));
btnRidiculous.addEventListener("click", () => handleChoice(false));
btnPause.addEventListener("click", renderPause);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { renderPause(); }
  if ((e.key === "Enter" || e.key === " ") && overlayHost().style.display !== "none") {
    startGame();
  }
});

/* ================== INIT ================== */
window.addEventListener("DOMContentLoaded", () => {
  applyBackground();
  renderStartMenu();
});
