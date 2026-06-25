/* Drift Dash — a small top-down arcade drifter.
   Momentum-based drift physics, tire marks, smoke, and a risk/reward
   drift-scoring combo (bank it before you crash). No dependencies. */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

/* ---- world ---- */
const WORLD = { w: 2400, h: 1600 };
let VIEW = { w: 960, h: 600 };          // CSS pixel viewport (set on resize)

function resize() {
  const rect = canvas.getBoundingClientRect();
  // internal resolution matches displayed size for crisp rendering
  canvas.width = Math.round(rect.width);
  canvas.height = Math.round(rect.height);
  VIEW.w = canvas.width;
  VIEW.h = canvas.height;
}
window.addEventListener("resize", resize);

/* ---- HUD ---- */
const els = {
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  speed: document.getElementById("speed"),
  overlay: document.getElementById("overlay"),
  start: document.getElementById("start"),
  drift: document.getElementById("drift"),
  driftPts: document.getElementById("drift-pts"),
  driftMult: document.getElementById("drift-mult"),
};

let best = Number(localStorage.getItem("driftDashBest") || 0);
els.best.textContent = best;

/* ---- input ---- */
const keys = {};
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  keys[k] = true;
  if (k === "r") resetCar();
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

/* ---- game state ---- */
let car, cones, smoke, marks, cam, score, driftPending, driftMult, drifting, driftCool, wreckFlash, shake, running;

function resetCar() {
  if (!car) car = {};
  car.x = WORLD.w / 2;
  car.y = WORLD.h / 2;
  car.vx = 0; car.vy = 0;
  car.angle = -Math.PI / 2;
  bankDrift(true);   // crashing/resetting loses the pending drift
}

function makeCones() {
  cones = [];
  // a loose slalom ring plus scattered cones to drift around
  const cx = WORLD.w / 2, cy = WORLD.h / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    cones.push({ x: cx + Math.cos(a) * 620, y: cy + Math.sin(a) * 430, r: 14, hit: 0 });
  }
  for (let i = 0; i < 10; i++) {
    cones.push({
      x: 200 + Math.random() * (WORLD.w - 400),
      y: 200 + Math.random() * (WORLD.h - 400),
      r: 14, hit: 0,
    });
  }
  // keep spawn area clear
  cones = cones.filter((c) => Math.hypot(c.x - cx, c.y - cy) > 160);
}

function init() {
  resetCar();
  makeCones();
  smoke = [];
  marks = [];
  cam = { x: 0, y: 0 };
  score = 0;
  driftPending = 0;
  driftMult = 1;
  drifting = false;
  driftCool = 0;
  wreckFlash = 0;
  shake = 0;
  updateHud();
}

function updateHud() {
  els.score.textContent = Math.floor(score);
  els.best.textContent = Math.floor(best);
}

/* ---- drift banking ---- */
function bankDrift(wrecked = false) {
  if (driftPending > 0 && !wrecked) {
    score += driftPending * driftMult;
    if (score > best) { best = score; localStorage.setItem("driftDashBest", Math.floor(best)); }
    updateHud();
  } else if (wrecked && driftPending > 0) {
    wreckFlash = 1;
  }
  driftPending = 0;
  driftMult = 1;
  drifting = false;
}

/* ---- physics constants ---- */
const ENGINE = 0.26;     // forward acceleration
const REVERSE = 0.14;
const DRAG = 0.985;      // forward velocity retained per frame
const TURN = 0.052;      // base steering rate
const MAX_SPEED = 11;

function update(dt) {
  const ds = Math.min(2.4, dt * 60);    // frame-rate normalization

  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const rx = -fy, ry = fx;              // right (lateral) unit vector

  // decompose velocity into forward + lateral components
  let vForward = car.vx * fx + car.vy * fy;
  let vLateral = car.vx * rx + car.vy * ry;

  // throttle / brake
  const gas = (keys["w"] || keys["arrowup"]) ? 1 : 0;
  const brake = (keys["s"] || keys["arrowdown"]) ? 1 : 0;
  if (gas) vForward += ENGINE * ds;
  if (brake) vForward -= (vForward > 0 ? ENGINE : REVERSE) * ds;

  vForward *= Math.pow(DRAG, ds);

  // steering — scales with speed, flips when reversing
  const steer = ((keys["d"] || keys["arrowright"]) ? 1 : 0) - ((keys["a"] || keys["arrowleft"]) ? 1 : 0);
  const speed = Math.hypot(car.vx, car.vy);
  if (speed > 0.4) {
    const gripFeel = Math.min(1, speed / 3.5);
    const dir = vForward >= 0 ? 1 : -1;
    car.angle += steer * TURN * gripFeel * dir * ds;
  }

  // lateral traction: handbrake (or high speed) breaks grip → slide
  const handbrake = keys[" "];
  let retain = handbrake ? 0.965 : 0.80;     // how much sideways velocity survives
  // a little natural slip at high speed even without handbrake
  retain += Math.min(0.12, speed * 0.006);
  vLateral *= Math.pow(retain, ds);

  // recombine
  car.vx = fx * vForward + rx * vLateral;
  car.vy = fy * vForward + ry * vLateral;

  // clamp top speed
  const sp = Math.hypot(car.vx, car.vy);
  if (sp > MAX_SPEED) { car.vx = car.vx / sp * MAX_SPEED; car.vy = car.vy / sp * MAX_SPEED; }

  car.x += car.vx * ds;
  car.y += car.vy * ds;

  // arena walls — bounce
  const m = 26;
  if (car.x < m) { car.x = m; car.vx *= -0.4; bumpWall(); }
  if (car.x > WORLD.w - m) { car.x = WORLD.w - m; car.vx *= -0.4; bumpWall(); }
  if (car.y < m) { car.y = m; car.vy *= -0.4; bumpWall(); }
  if (car.y > WORLD.h - m) { car.y = WORLD.h - m; car.vy *= -0.4; bumpWall(); }

  /* ---- drift scoring ---- */
  const slip = Math.abs(Math.atan2(vLateral, Math.abs(vForward) + 0.4));
  const isDrift = sp > 2.6 && slip > 0.22;

  if (isDrift) {
    drifting = true;
    driftCool = 0;
    driftMult = Math.min(8, driftMult + dt * 0.45);
    driftPending += sp * slip * 7 * ds;
    emitDrift(rx, ry, sp, slip);
  } else if (drifting) {
    driftCool += dt;
    if (driftCool > 0.55) bankDrift();         // safe → bank the points
  }

  // cone collisions
  for (const c of cones) {
    const dx = car.x - c.x, dy = car.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d < c.r + 18) {
      // knock the car back, scatter the cone, lose the drift
      const nx = dx / (d || 1), ny = dy / (d || 1);
      car.vx += nx * 3; car.vy += ny * 3;
      c.x -= nx * 30; c.y -= ny * 30; c.hit = 1;
      shake = 10;
      bankDrift(true);
      burst(c.x, c.y, 10);
    }
    if (c.hit > 0) c.hit -= dt;
  }

  // smoke
  for (const p of smoke) { p.x += p.vx * ds; p.y += p.vy * ds; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt * 1.4; p.r += dt * 22; }
  smoke = smoke.filter((p) => p.life > 0);

  // skid marks fade
  for (const k of marks) k.life -= dt * 0.22;
  marks = marks.filter((k) => k.life > 0);
  if (marks.length > 1400) marks.splice(0, marks.length - 1400);

  if (wreckFlash > 0) wreckFlash -= dt * 1.6;
  if (shake > 0) shake = Math.max(0, shake - ds);

  // camera follows car, clamped to world
  const tx = car.x - VIEW.w / 2, ty = car.y - VIEW.h / 2;
  cam.x += (tx - cam.x) * Math.min(1, dt * 6);
  cam.y += (ty - cam.y) * Math.min(1, dt * 6);
  cam.x = Math.max(0, Math.min(WORLD.w - VIEW.w, cam.x));
  cam.y = Math.max(0, Math.min(WORLD.h - VIEW.h, cam.y));

  els.speed.textContent = Math.round(sp * 22);
}

function bumpWall() { shake = Math.max(shake, 6); bankDrift(true); }

function burst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    smoke.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7, r: 4, hue: 30 });
  }
}

function emitDrift(rx, ry, sp, slip) {
  // rear-wheel positions
  const bx = car.x - Math.cos(car.angle) * 16;
  const by = car.y - Math.sin(car.angle) * 16;
  const half = 9;
  for (const s of [-1, 1]) {
    const wx = bx + rx * half * s;
    const wy = by + ry * half * s;
    marks.push({ x: wx, y: wy, a: car.angle, life: 1, w: 6 });
    if (Math.random() < 0.5) {
      smoke.push({
        x: wx, y: wy,
        vx: (Math.random() - 0.5) * 1.4,
        vy: (Math.random() - 0.5) * 1.4,
        life: 0.6 + Math.random() * 0.4,
        r: 5, hue: 210,
      });
    }
  }
}

/* ---- rendering ---- */
function draw() {
  ctx.save();
  let ox = -cam.x, oy = -cam.y;
  if (shake > 0) { ox += (Math.random() - 0.5) * shake; oy += (Math.random() - 0.5) * shake; }
  ctx.translate(ox, oy);

  // ground
  ctx.fillStyle = "#171b27";
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  drawGrid();

  // arena border
  ctx.strokeStyle = "rgba(120,200,255,0.35)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, WORLD.w - 6, WORLD.h - 6);

  // skid marks
  ctx.lineCap = "round";
  for (const k of marks) {
    ctx.globalAlpha = Math.min(0.5, k.life * 0.5);
    ctx.strokeStyle = "#0c0e15";
    ctx.lineWidth = k.w;
    const dx = Math.cos(k.a) * 5, dy = Math.sin(k.a) * 5;
    ctx.beginPath();
    ctx.moveTo(k.x - dx, k.y - dy);
    ctx.lineTo(k.x + dx, k.y + dy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // cones
  for (const c of cones) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.shadowBlur = c.hit > 0 ? 16 : 6;
    ctx.shadowColor = "#ff7a2c";
    ctx.fillStyle = "#ff7a2c";
    ctx.beginPath();
    ctx.moveTo(0, -c.r);
    ctx.lineTo(c.r * 0.8, c.r);
    ctx.lineTo(-c.r * 0.8, c.r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffd9b0";
    ctx.fillRect(-c.r * 0.55, -c.r * 0.1, c.r * 1.1, c.r * 0.32);
    ctx.restore();
  }
  ctx.shadowBlur = 0;

  // smoke
  for (const p of smoke) {
    ctx.globalAlpha = Math.max(0, p.life) * 0.5;
    ctx.fillStyle = `hsl(${p.hue}, 30%, 80%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawCar();

  ctx.restore();

  // wreck flash vignette
  if (wreckFlash > 0) {
    ctx.fillStyle = `rgba(255,40,70,${wreckFlash * 0.25})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  // live drift banner
  if (drifting && driftPending > 1) {
    els.drift.classList.add("show");
    els.driftPts.textContent = "+" + Math.floor(driftPending);
    els.driftMult.textContent = "x" + driftMult.toFixed(1);
  } else {
    els.drift.classList.remove("show");
  }
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.w; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.h); ctx.stroke();
  }
  for (let y = 0; y <= WORLD.h; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.w, y); ctx.stroke();
  }
}

function drawCar() {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(-18, -9, 38, 20, 5);

  // body
  const g = ctx.createLinearGradient(-18, 0, 22, 0);
  g.addColorStop(0, "#ff4d6d");
  g.addColorStop(1, "#ff2d55");
  ctx.fillStyle = g;
  roundRect(-20, -11, 40, 22, 6);

  // windshield / cockpit
  ctx.fillStyle = "#1a2230";
  roundRect(-2, -8, 11, 16, 3);

  // nose accent
  ctx.fillStyle = "#fff";
  roundRect(16, -9, 4, 18, 2);

  // wheels
  ctx.fillStyle = "#0a0c12";
  ctx.fillRect(-14, -13, 7, 4);
  ctx.fillRect(-14, 9, 7, 4);
  ctx.fillRect(8, -13, 7, 4);
  ctx.fillRect(8, 9, 7, 4);

  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/* ---- loop ---- */
let last = 0;
function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000) || 0;
  last = t;
  if (running) update(dt);
  draw();
  requestAnimationFrame(loop);
}

/* ---- start ---- */
els.start.addEventListener("click", () => {
  init();
  running = true;
  els.overlay.classList.add("hidden");
});

resize();
init();
requestAnimationFrame(loop);
