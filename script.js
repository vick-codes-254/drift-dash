/* drift-dash v2.1.0 */
/* ============================================================================
   DRIFT DASH — a top-down arcade drifter
   Momentum drift physics · nitro · near-miss style scoring · procedural audio
   · garage with selectable cars & paint · dynamic camera · Free Drift and
   Time Attack modes with a recorded ghost car. No dependencies.
   ========================================================================== */

"use strict";

/* ----------------------------------------------------------------------------
   Canvas + viewport
---------------------------------------------------------------------------- */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const DPR = Math.min(2, window.devicePixelRatio || 1);

const WORLD = { w: 2600, h: 1800 };
let VIEW = { w: 960, h: 600 };

function resize() {
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * DPR);
  canvas.height = Math.round(r.height * DPR);
  VIEW.w = r.width;
  VIEW.h = r.height;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);

/* ----------------------------------------------------------------------------
   Persistence
---------------------------------------------------------------------------- */
const SAVE = JSON.parse(localStorage.getItem("driftDash") || "{}");
function persist() { localStorage.setItem("driftDash", JSON.stringify(SAVE)); }
SAVE.best = SAVE.best || 0;
SAVE.bestTA = SAVE.bestTA || 0;
SAVE.volume = SAVE.volume == null ? 0.7 : SAVE.volume;
SAVE.sfx = SAVE.sfx == null ? true : SAVE.sfx;
SAVE.muted = SAVE.muted || false;
SAVE.car = SAVE.car || 0;
SAVE.color = SAVE.color || 0;
SAVE.mode = SAVE.mode === "ta" ? "ta" : "free";
SAVE.ghost = SAVE.ghost || null;

/* ----------------------------------------------------------------------------
   Cars + paint
---------------------------------------------------------------------------- */
const CARS = [
  { name: "Comet", blurb: "All-rounder. Forgiving slides, easy to read.",
    accel: 0.27, maxSpeed: 11, turn: 0.052, retain: 0.80,
    bars: { Power: 70, Speed: 70, Grip: 65, Agility: 70 } },
  { name: "Viper", blurb: "Loose & fast. Lights up the rears — for show-offs.",
    accel: 0.31, maxSpeed: 12.6, turn: 0.058, retain: 0.855,
    bars: { Power: 92, Speed: 96, Grip: 38, Agility: 86 } },
  { name: "Boulder", blurb: "Heavy & planted. Hard to spin, slower to wind up.",
    accel: 0.225, maxSpeed: 9.6, turn: 0.046, retain: 0.74,
    bars: { Power: 54, Speed: 50, Grip: 92, Agility: 54 } },
  { name: "Wisp", blurb: "Featherweight scalpel. Darts into gates, twitchy at speed.",
    accel: 0.335, maxSpeed: 11.8, turn: 0.066, retain: 0.83,
    bars: { Power: 82, Speed: 82, Grip: 48, Agility: 98 } },
];
const PAINTS = [
  ["#ff5d7a", "#ff2d55"], ["#54e6ff", "#10b3e8"], ["#9bff5a", "#4fd11a"],
  ["#ffd24d", "#ff9e2c"], ["#c08cff", "#8a4dff"], ["#ff8a3c", "#ff5e1a"],
  ["#f4f7ff", "#c4cee0"], ["#2ce6b0", "#12a67f"],
];
const GHOST_PAINT = ["#9fb4d8", "#5f76a0"];

/* ----------------------------------------------------------------------------
   Audio — fully procedural (engine, screech, impact, nitro, ui)
---------------------------------------------------------------------------- */
const Audio = {
  ctx: null, master: null,
  eng: null, engGain: null, engFilt: null, eng2: null,
  scr: null, scrGain: null, scrFilt: null,
  ready: false,

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    this.ctx = ac;

    this.master = ac.createGain();
    this.master.connect(ac.destination);
    this.applyVolume();

    // engine: two detuned sawtooths through a lowpass
    this.engFilt = ac.createBiquadFilter();
    this.engFilt.type = "lowpass";
    this.engFilt.frequency.value = 900;
    this.engGain = ac.createGain();
    this.engGain.gain.value = 0;
    this.eng = ac.createOscillator(); this.eng.type = "sawtooth"; this.eng.frequency.value = 55;
    this.eng2 = ac.createOscillator(); this.eng2.type = "sawtooth"; this.eng2.frequency.value = 82;
    this.eng.connect(this.engFilt); this.eng2.connect(this.engFilt);
    this.engFilt.connect(this.engGain); this.engGain.connect(this.master);
    this.eng.start(); this.eng2.start();

    // tire screech: looping noise through a bandpass
    const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.scr = ac.createBufferSource(); this.scr.buffer = buf; this.scr.loop = true;
    this.scrFilt = ac.createBiquadFilter(); this.scrFilt.type = "bandpass";
    this.scrFilt.frequency.value = 1400; this.scrFilt.Q.value = 1.2;
    this.scrGain = ac.createGain(); this.scrGain.gain.value = 0;
    this.scr.connect(this.scrFilt); this.scrFilt.connect(this.scrGain); this.scrGain.connect(this.master);
    this.scr.start();

    this.ready = true;
  },
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  applyVolume() {
    if (!this.master) return;
    const v = (SAVE.muted || !SAVE.sfx) ? 0 : SAVE.volume;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  },
  engine(speedNorm, throttle) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const base = 50 + speedNorm * 165;
    this.eng.frequency.setTargetAtTime(base, t, 0.08);
    this.eng2.frequency.setTargetAtTime(base * 1.5, t, 0.08);
    this.engFilt.frequency.setTargetAtTime(500 + speedNorm * 2200, t, 0.1);
    const g = 0.035 + speedNorm * 0.05 + (throttle > 0 ? 0.05 : 0);
    this.engGain.gain.setTargetAtTime(g, t, 0.06);
  },
  screech(intensity) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.scrGain.gain.setTargetAtTime(Math.min(0.16, intensity * 0.16), t, 0.05);
    this.scrFilt.frequency.setTargetAtTime(1100 + intensity * 1600, t, 0.05);
  },
  idle() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(0, t, 0.1);
    this.scrGain.gain.setTargetAtTime(0, t, 0.05);
  },
  blast(type, strength = 1) {
    if (!this.ready) return;
    const ac = this.ctx, t = ac.currentTime;
    if (type === "impact") {
      const b = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const s = ac.createBufferSource(); s.buffer = b;
      const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 700;
      const g = ac.createGain(); g.gain.value = 0.5 * strength;
      s.connect(f); f.connect(g); g.connect(this.master); s.start();
    } else if (type === "nitro") {
      const o = ac.createOscillator(); o.type = "sawtooth";
      const g = ac.createGain();
      o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.4);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g); g.connect(this.master); o.start(); o.stop(t + 0.55);
    } else if (type === "ui") {
      const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = 520;
      const g = ac.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g); g.connect(this.master); o.start(); o.stop(t + 0.13);
    } else if (type === "bank") {
      const o = ac.createOscillator(); o.type = "triangle";
      const g = ac.createGain();
      o.frequency.setValueAtTime(440, t); o.frequency.exponentialRampToValueAtTime(880, t + 0.18);
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(this.master); o.start(); o.stop(t + 0.26);
    } else if (type === "gate") {
      // bright two-tone chime for clearing a checkpoint
      const o = ac.createOscillator(); o.type = "triangle";
      const g = ac.createGain();
      o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(990, t + 0.09);
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(this.master); o.start(); o.stop(t + 0.31);
    }
  },
};

/* ----------------------------------------------------------------------------
   DOM
---------------------------------------------------------------------------- */
const $ = (id) => document.getElementById(id);
const E = {
  score: $("score"), best: $("best"), speed: $("speed"),
  drift: $("drift"), driftPts: $("drift-pts"), driftMult: $("drift-mult"),
  boostFill: $("boost-fill"), boostRdy: $("boost-rdy"), boostBar: $("boost-fill").parentElement,
  menu: $("menu"), pause: $("pause"), countdown: $("countdown"),
  start: $("start"), resume: $("resume"), restart: $("restart"), toMenu: $("to-menu"),
  carName: $("car-name"), carBlurb: $("car-blurb"), stats: $("stats"), swatches: $("swatches"),
  carPrev: $("car-prev"), carNext: $("car-next"),
  muteBtn: $("muteBtn"), pauseBtn: $("pauseBtn"),
  vol: $("vol"), sfx: $("sfx"), runStats: $("run-stats"),
  touch: $("touch"), meters: $("meters"),
  taHud: $("ta-hud"), taTime: $("ta-time"), taGates: $("ta-gates"),
  modeBest: $("mode-best"),
  result: $("result"), resultStats: $("result-stats"),
  resultRetry: $("result-retry"), resultMenu: $("result-menu"),
};

/* ----------------------------------------------------------------------------
   Time Attack tuning
---------------------------------------------------------------------------- */
const TA_START = 20;    // seconds on the clock at the start
const TA_BONUS = 3.6;   // seconds added per gate cleared
const GATE_R = 64;      // pass radius
const GATE_W = 54;      // visual half-width of a gate
const GH_DT = 0.06;     // ghost sample interval (seconds)
const GH_MAX = 9000;    // max recorded values (3000 samples)

/* ----------------------------------------------------------------------------
   Game state
---------------------------------------------------------------------------- */
let state = "menu";   // menu | countdown | playing | paused | over
let mode = SAVE.mode; // free | ta
let car, cones, smoke, marks, pops, cam, gates, tires;
let score, driftPending, driftMult, drifting, driftCool;
let boost, boosting, wreckFlash, shake, comboHeat;
let countdownT = 0, menuSpin = 0;
let taTime = TA_START, gateIdx = 0, gatesPassed = 0;
let ghostRec, ghRecTimer, ghT, ghostPlay;
let run = { time: 0, longest: 0, curDrift: 0, bestCombo: 0 };
let asphaltPat = null;

function curCar() { return CARS[SAVE.car]; }
function curPaint() { return PAINTS[SAVE.color]; }

function resetCar() {
  if (!car) car = {};
  car.x = WORLD.w / 2; car.y = WORLD.h / 2;
  car.vx = 0; car.vy = 0; car.angle = -Math.PI / 2;
  bankDrift(true);
}

function makeCones() {
  cones = [];
  const cx = WORLD.w / 2, cy = WORLD.h / 2;
  // a sweeping figure-of-eight-ish course to carve around
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    cones.push(cone(cx + Math.cos(a) * 680, cy + Math.sin(a) * 470));
  }
  for (let i = 0; i < 12; i++) {
    let x, y, ok = false, tries = 0;
    while (!ok && tries++ < 40) {
      x = 220 + Math.random() * (WORLD.w - 440);
      y = 220 + Math.random() * (WORLD.h - 440);
      ok = Math.hypot(x - cx, y - cy) > 220 &&
           cones.every((c) => Math.hypot(c.x - x, c.y - y) > 150);
    }
    if (ok) cones.push(cone(x, y));
  }
}
function cone(x, y) { return { x, y, r: 13, hit: 0, cool: 0 }; }

// Time Attack: a ring of ordered gates forming a continuous circuit
function makeGates() {
  gates = [];
  const cx = WORLD.w / 2, cy = WORLD.h / 2;
  const rx = 780, ry = 560, N = 12;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    gates.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, ang: a + Math.PI / 2 });
  }
}

// decorative tire-stack barriers at the four corners (no collision)
function makeTires() {
  tires = [];
  const inset = 200;
  const spots = [
    [inset, inset], [WORLD.w - inset, inset],
    [inset, WORLD.h - inset], [WORLD.w - inset, WORLD.h - inset],
  ];
  for (const [x, y] of spots) {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * 26;
      tires.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: 12 + Math.random() * 4 });
    }
  }
}

function init() {
  mode = SAVE.mode === "ta" ? "ta" : "free";
  resetCar();
  makeCones();
  makeTires();
  gates = [];
  if (mode === "ta") makeGates();
  smoke = []; marks = []; pops = [];
  cam = { x: car.x, y: car.y, zoom: 1 };
  score = 0; driftPending = 0; driftMult = 1; drifting = false; driftCool = 0;
  boost = 0; boosting = false; wreckFlash = 0; shake = 0; comboHeat = 0;
  taTime = TA_START; gateIdx = 0; gatesPassed = 0;
  ghostRec = []; ghRecTimer = 0; ghT = 0;
  ghostPlay = (mode === "ta" && SAVE.ghost && SAVE.ghost.s && SAVE.ghost.s.length >= 6) ? SAVE.ghost : null;
  run = { time: 0, longest: 0, curDrift: 0, bestCombo: 0 };
  updateHud();
  updateTaHud();
}

function updateHud() {
  E.score.textContent = Math.floor(score);
  E.best.textContent = Math.floor(mode === "ta" ? SAVE.bestTA : SAVE.best);
}

function updateTaHud() {
  if (mode !== "ta") return;
  E.taTime.textContent = Math.max(0, taTime).toFixed(1);
  E.taGates.textContent = gatesPassed;
  E.taHud.classList.toggle("low", taTime <= 5);
}

/* ----------------------------------------------------------------------------
   Drift banking / scoring helpers
---------------------------------------------------------------------------- */
function bankDrift(wrecked = false) {
  if (driftPending > 0) {
    if (wrecked) {
      wreckFlash = 1;
    } else {
      score += driftPending * driftMult;
      if (mode === "free" && score > SAVE.best) { SAVE.best = score; persist(); }
      Audio.blast("bank");
      updateHud();
    }
  }
  if (run.curDrift > run.longest) run.longest = run.curDrift;
  run.curDrift = 0;
  driftPending = 0; driftMult = 1; drifting = false; comboHeat = 0;
}

function popText(x, y, text, color) {
  pops.push({ x, y, text, color, life: 1, vy: -0.6 });
}

/* ----------------------------------------------------------------------------
   Update
---------------------------------------------------------------------------- */
const DRAG = 0.986;

function update(dt) {
  const ds = Math.min(2.4, dt * 60);
  const C = curCar();

  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  const rx = -fy, ry = fx;

  let vForward = car.vx * fx + car.vy * fy;
  let vLateral = car.vx * rx + car.vy * ry;

  const gas = keys["w"] || keys["arrowup"];
  const brake = keys["s"] || keys["arrowdown"];

  // nitro
  boosting = (keys["shift"] || keys["shiftleft"] || keys["shiftright"]) && boost > 1;
  let accel = C.accel;
  let topSpeed = C.maxSpeed;
  if (boosting) {
    accel *= 1.9; topSpeed *= 1.4;
    boost = Math.max(0, boost - dt * 38);
    vForward += accel * 0.4 * ds;        // surge even without gas held
    if (Math.random() < 0.9) emitFlame(fx, fy, rx, ry);
    if (!car._boostSnd) { Audio.blast("nitro"); car._boostSnd = true; }
  } else { car._boostSnd = false; }

  if (gas) vForward += accel * ds;
  if (brake) vForward -= (vForward > 0 ? accel : C.accel * 0.55) * ds;
  vForward *= Math.pow(DRAG, ds);

  // steering
  const steer = ((keys["d"] || keys["arrowright"]) ? 1 : 0) - ((keys["a"] || keys["arrowleft"]) ? 1 : 0);
  let speed = Math.hypot(car.vx, car.vy);
  if (speed > 0.4) {
    const gripFeel = Math.min(1, speed / 3.5);
    const dir = vForward >= 0 ? 1 : -1;
    car.angle += steer * C.turn * gripFeel * dir * ds;
  }

  // lateral traction (handbrake breaks grip → slide)
  const handbrake = keys[" "];
  let retain = handbrake ? 0.965 : C.retain;
  retain += Math.min(0.12, speed * 0.006);
  vLateral *= Math.pow(retain, ds);

  // recombine
  car.vx = fx * vForward + rx * vLateral;
  car.vy = fy * vForward + ry * vLateral;

  speed = Math.hypot(car.vx, car.vy);
  if (speed > topSpeed) { car.vx = car.vx / speed * topSpeed; car.vy = car.vy / speed * topSpeed; speed = topSpeed; }

  car.x += car.vx * ds; car.y += car.vy * ds;

  // walls
  const m = 28;
  if (car.x < m) { car.x = m; car.vx = Math.abs(car.vx) * 0.4; bumpWall(); }
  if (car.x > WORLD.w - m) { car.x = WORLD.w - m; car.vx = -Math.abs(car.vx) * 0.4; bumpWall(); }
  if (car.y < m) { car.y = m; car.vy = Math.abs(car.vy) * 0.4; bumpWall(); }
  if (car.y > WORLD.h - m) { car.y = WORLD.h - m; car.vy = -Math.abs(car.vy) * 0.4; bumpWall(); }

  /* ---- drift scoring ---- */
  const slip = Math.abs(Math.atan2(vLateral, Math.abs(vForward) + 0.4));
  const isDrift = speed > 2.6 && slip > 0.22;

  if (isDrift) {
    drifting = true; driftCool = 0;
    run.curDrift += dt;
    comboHeat = Math.min(1, comboHeat + dt * 1.5);
    driftMult = Math.min(8, driftMult + dt * 0.5);
    const gain = speed * slip * 7 * ds;
    driftPending += gain;
    boost = Math.min(100, boost + gain * 0.05);
    if (driftMult > run.bestCombo) run.bestCombo = driftMult;
    emitDrift(rx, ry, speed, slip);
  } else if (drifting) {
    driftCool += dt;
    comboHeat = Math.max(0, comboHeat - dt * 2);
    if (driftCool > 0.55) bankDrift();
  }

  // audio
  Audio.engine(speed / C.maxSpeed, gas ? 1 : 0);
  Audio.screech(isDrift ? Math.min(1, slip * speed * 0.18) : 0);

  /* ---- cones: collision + near-miss style ---- */
  for (const c of cones) {
    const dx = car.x - c.x, dy = car.y - c.y;
    const d = Math.hypot(dx, dy);
    if (c.hit > 0) c.hit -= dt;
    if (c.cool > 0) c.cool -= dt;

    if (d < c.r + 17) {
      const nx = dx / (d || 1), ny = dy / (d || 1);
      car.vx += nx * 3.2; car.vy += ny * 3.2;
      c.x -= nx * 26; c.y -= ny * 26; c.hit = 0.4;
      shake = Math.max(shake, 11);
      bankDrift(true);
      Audio.blast("impact", 1);
      burst(c.x, c.y, 12);
    } else if (drifting && speed > 4 && d < c.r + 46 && c.cool <= 0) {
      // threaded the needle while sliding → style bonus
      const closeness = 1 - (d - c.r) / 46;
      const bonus = Math.round(40 + closeness * 160 + speed * 6);
      driftPending += bonus;
      boost = Math.min(100, boost + 6);
      c.cool = 1.1;
      popText(c.x, c.y - 24, "CLOSE +" + bonus, "#54e6ff");
    }
  }

  /* ---- Time Attack: clock, gates, ghost recording ---- */
  if (mode === "ta") {
    taTime -= dt;
    ghT += dt;
    ghRecTimer += dt;
    if (ghRecTimer >= GH_DT) {
      ghRecTimer -= GH_DT;
      if (ghostRec.length < GH_MAX) ghostRec.push(car.x, car.y, car.angle);
    }
    const g = gates[gateIdx % gates.length];
    if (g && Math.hypot(car.x - g.x, car.y - g.y) < GATE_R) {
      gateIdx++; gatesPassed++;
      const pts = 300 + Math.round(speed * 10);
      score += pts;
      taTime += TA_BONUS;
      boost = Math.min(100, boost + 14);
      shake = Math.max(shake, 5);
      sparkBurst(g.x, g.y, 14, 110);
      popText(g.x, g.y - 30, "GATE +" + pts, "#9bff5a");
      Audio.blast("gate");
      updateHud();
    }
    updateTaHud();
    if (taTime <= 0) { taTime = 0; endTimeAttack(); return; }
  }

  // particles
  for (const p of smoke) { p.x += p.vx * ds; p.y += p.vy * ds; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt * (p.spark ? 2.6 : 1.5); p.r += dt * (p.spark ? 6 : 24); }
  smoke = smoke.filter((p) => p.life > 0);
  for (const k of marks) k.life -= dt * 0.16;
  marks = marks.filter((k) => k.life > 0);
  if (marks.length > 1600) marks.splice(0, marks.length - 1600);
  for (const p of pops) { p.y += p.vy * ds; p.life -= dt * 0.9; }
  pops = pops.filter((p) => p.life > 0);

  if (wreckFlash > 0) wreckFlash -= dt * 1.6;
  if (shake > 0) shake = Math.max(0, shake - ds * 1.1);

  /* ---- camera: follow + look-ahead + speed zoom ---- */
  const lead = 16;
  const tx = car.x + car.vx * lead;
  const ty = car.y + car.vy * lead;
  cam.x += (tx - cam.x) * Math.min(1, dt * 5);
  cam.y += (ty - cam.y) * Math.min(1, dt * 5);
  const zTarget = (boosting ? 0.86 : 1.0) - Math.min(0.14, speed * 0.012);
  cam.zoom += (zTarget - cam.zoom) * Math.min(1, dt * 4);
  clampCam();

  run.time += dt;

  // HUD readouts
  E.speed.textContent = Math.round(speed * 17.5);
  const bp = Math.round(boost);
  E.boostFill.style.width = bp + "%";
  E.boostBar.classList.toggle("full", bp >= 100);
  E.boostRdy.textContent = bp >= 100 ? "READY" : boosting ? "BURN" : "";

  if (drifting && driftPending > 1) {
    E.drift.classList.add("show");
    E.drift.classList.toggle("hot", driftMult >= 4);
    E.driftPts.textContent = "+" + Math.floor(driftPending);
    E.driftMult.textContent = "x" + driftMult.toFixed(1);
  } else {
    E.drift.classList.remove("show");
  }
}

function clampCam() {
  const hw = VIEW.w / (2 * cam.zoom), hh = VIEW.h / (2 * cam.zoom);
  cam.x = WORLD.w <= hw * 2 ? WORLD.w / 2 : Math.max(hw, Math.min(WORLD.w - hw, cam.x));
  cam.y = WORLD.h <= hh * 2 ? WORLD.h / 2 : Math.max(hh, Math.min(WORLD.h - hh, cam.y));
}

function bumpWall() { shake = Math.max(shake, 7); bankDrift(true); Audio.blast("impact", 0.7); }

function burst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    smoke.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7, r: 4, hue: 30, sat: 90 });
  }
  sparkBurst(x, y, 6, 30);
}
function sparkBurst(x, y, n, hue) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
    smoke.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5,
      r: 2.5, hue: hue + Math.random() * 20, sat: 95, flame: true, spark: true });
  }
}
function emitDrift(rx, ry, speed, slip) {
  const bx = car.x - Math.cos(car.angle) * 16, by = car.y - Math.sin(car.angle) * 16;
  for (const s of [-1, 1]) {
    const wx = bx + rx * 9 * s, wy = by + ry * 9 * s;
    marks.push({ x: wx, y: wy, a: car.angle, life: 1, heat: comboHeat });
    if (Math.random() < 0.5)
      smoke.push({ x: wx, y: wy, vx: (Math.random() - 0.5) * 1.6, vy: (Math.random() - 0.5) * 1.6,
        life: 0.6 + Math.random() * 0.4, r: 5, hue: 210, sat: 12 });
  }
}
function emitFlame(fx, fy, rx, ry) {
  const bx = car.x - fx * 18, by = car.y - fy * 18;
  for (const s of [-1, 1]) {
    smoke.push({
      x: bx + rx * 6 * s, y: by + ry * 6 * s,
      vx: -fx * 4 + (Math.random() - 0.5), vy: -fy * 4 + (Math.random() - 0.5),
      life: 0.4, r: 3, hue: 20 + Math.random() * 30, sat: 95, flame: true,
    });
  }
}

/* ----------------------------------------------------------------------------
   Ghost playback sampling
---------------------------------------------------------------------------- */
function ghostSample(t) {
  const g = ghostPlay;
  if (!g) return null;
  const s = g.s, dts = g.dt || GH_DT, n = s.length / 3;
  if (n < 2) return null;
  const idx = t / dts;
  if (idx >= n - 1) return null; // ghost finished its recorded run
  const i = Math.floor(idx), f = idx - i;
  const x = s[i * 3] + (s[(i + 1) * 3] - s[i * 3]) * f;
  const y = s[i * 3 + 1] + (s[(i + 1) * 3 + 1] - s[i * 3 + 1]) * f;
  return { x, y, a: s[i * 3 + 2] };
}

/* ----------------------------------------------------------------------------
   Rendering
---------------------------------------------------------------------------- */
function makeAsphalt() {
  const t = document.createElement("canvas");
  t.width = t.height = 96;
  const c = t.getContext("2d");
  c.fillStyle = "#13161f"; c.fillRect(0, 0, 96, 96);
  // fine speckle
  for (let i = 0; i < 1600; i++) {
    const light = Math.random() > 0.5;
    c.fillStyle = `rgba(${light ? "255,255,255" : "0,0,0"},${Math.random() * 0.035})`;
    c.fillRect(Math.random() * 96, Math.random() * 96, 1, 1);
  }
  // a few larger aggregate flecks
  for (let i = 0; i < 40; i++) {
    c.fillStyle = `rgba(120,140,170,${0.02 + Math.random() * 0.04})`;
    c.beginPath(); c.arc(Math.random() * 96, Math.random() * 96, 1 + Math.random() * 2, 0, Math.PI * 2); c.fill();
  }
  asphaltPat = ctx.createPattern(t, "repeat");
}

function draw() {
  ctx.clearRect(0, 0, VIEW.w, VIEW.h);

  if (state === "menu") { drawMenu(); return; }

  ctx.save();
  let sx = 0, sy = 0;
  if (shake > 0) { sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; }
  ctx.translate(VIEW.w / 2 + sx, VIEW.h / 2 + sy);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  drawWorld();
  ctx.restore();

  // screen-space overlays
  if (wreckFlash > 0) {
    ctx.fillStyle = `rgba(255,40,70,${wreckFlash * 0.22})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
  drawVignette();
}

function drawWorld() {
  // asphalt texture
  ctx.fillStyle = asphaltPat || "#13161f";
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // faint alignment grid
  ctx.strokeStyle = "rgba(255,255,255,0.022)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.w; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.h); ctx.stroke(); }
  for (let y = 0; y <= WORLD.h; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.w, y); ctx.stroke(); }

  drawCurbs();
  drawTires();

  // border
  ctx.strokeStyle = "rgba(120,200,255,0.35)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, WORLD.w - 6, WORLD.h - 6);

  // gates (Time Attack)
  if (mode === "ta") drawGates();

  // skid marks (warmer as combo heats up)
  ctx.lineCap = "round";
  for (const k of marks) {
    const a = Math.min(0.5, k.life * 0.55);
    ctx.globalAlpha = a;
    ctx.strokeStyle = k.heat > 0.4
      ? `rgba(${40 + k.heat * 60}, 20, 24, 1)`
      : "#0c0e15";
    ctx.lineWidth = 6;
    const dx = Math.cos(k.a) * 5, dy = Math.sin(k.a) * 5;
    ctx.beginPath(); ctx.moveTo(k.x - dx, k.y - dy); ctx.lineTo(k.x + dx, k.y + dy); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // cones
  for (const c of cones) drawCone(c);

  // smoke / flames
  for (const p of smoke) {
    ctx.globalAlpha = Math.max(0, p.life) * (p.flame ? 0.8 : 0.5);
    ctx.fillStyle = p.flame ? `hsl(${p.hue},100%,60%)` : `hsl(${p.hue},${p.sat}%,80%)`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ghost car (Time Attack)
  if (mode === "ta" && ghostPlay) {
    const gs = ghostSample(ghT);
    if (gs) { ctx.globalAlpha = 0.32; drawCar(gs.x, gs.y, gs.a, GHOST_PAINT, true); ctx.globalAlpha = 1; }
  }

  drawCar(car.x, car.y, car.angle, curPaint());

  // floating score pops
  ctx.textAlign = "center";
  for (const p of pops) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.font = "800 22px Segoe UI, sans-serif";
    ctx.shadowBlur = 12; ctx.shadowColor = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

// red/white racing curbs along the inner edge of the arena
function drawCurbs() {
  const inset = 12, seg = 54, th = 9;
  ctx.save();
  ctx.globalAlpha = 0.5;
  let flip = 0;
  for (let x = 0; x < WORLD.w; x += seg) {
    ctx.fillStyle = (flip++ % 2) ? "#e23b4e" : "#f4f7ff";
    const w = Math.min(seg, WORLD.w - x);
    ctx.fillRect(x, inset, w, th);
    ctx.fillRect(x, WORLD.h - inset - th, w, th);
  }
  flip = 0;
  for (let y = 0; y < WORLD.h; y += seg) {
    ctx.fillStyle = (flip++ % 2) ? "#e23b4e" : "#f4f7ff";
    const h = Math.min(seg, WORLD.h - y);
    ctx.fillRect(inset, y, th, h);
    ctx.fillRect(WORLD.w - inset - th, y, th, h);
  }
  ctx.restore();
}

// decorative tire-stack barriers
function drawTires() {
  if (!tires) return;
  for (const t of tires) {
    ctx.fillStyle = "#0b0d13";
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1b2130";
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0b0d13";
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawGates() {
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    const isNext = (gateIdx % gates.length) === i;
    const dirx = Math.cos(g.ang), diry = Math.sin(g.ang);
    const ax = g.x + dirx * GATE_W, ay = g.y + diry * GATE_W;
    const bx = g.x - dirx * GATE_W, by = g.y - diry * GATE_W;
    const col = isNext ? "#9bff5a" : "#54e6ff";

    ctx.save();
    ctx.globalAlpha = isNext ? 0.9 : 0.32;
    ctx.strokeStyle = col;
    ctx.lineWidth = isNext ? 5 : 3;
    if (isNext) { ctx.shadowBlur = 18; ctx.shadowColor = col; }
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    // pylons
    ctx.fillStyle = col;
    for (const [px, py] of [[ax, ay], [bx, by]]) {
      ctx.beginPath(); ctx.arc(px, py, isNext ? 8 : 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawCone(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.shadowBlur = c.hit > 0 ? 18 : 7;
  ctx.shadowColor = "#ff7a2c";
  ctx.fillStyle = "#ff7a2c";
  ctx.beginPath();
  ctx.moveTo(0, -c.r); ctx.lineTo(c.r * 0.82, c.r); ctx.lineTo(-c.r * 0.82, c.r); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffe0c2";
  ctx.fillRect(-c.r * 0.55, -c.r * 0.08, c.r * 1.1, c.r * 0.32);
  ctx.restore();
}

function drawCar(x, y, angle, paint, ghost) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = 0;

  // shadow
  if (!ghost) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    rr(-19, -10, 40, 22, 6);
  }

  // rear wing
  ctx.fillStyle = ghost ? "#3a445c" : "#0d1017";
  rr(-25, -13, 5, 26, 2);
  ctx.fillRect(-23, -3, 5, 6);

  // body
  const g = ctx.createLinearGradient(-22, 0, 24, 0);
  g.addColorStop(0, paint[0]); g.addColorStop(1, paint[1]);
  ctx.fillStyle = g;
  rr(-22, -12, 44, 24, 7);

  // top-edge highlight for a little sheen
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  rr(-18, -11, 34, 4, 3);

  // front splitter
  ctx.fillStyle = ghost ? "#3a445c" : "#0d1017";
  ctx.fillRect(20, -11, 4, 22);

  // racing stripe
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(-22, -2.5, 44, 5);

  // cockpit glass (tinted gradient)
  const cg = ctx.createLinearGradient(-3, 0, 9, 0);
  cg.addColorStop(0, "#1a2333"); cg.addColorStop(1, "#0a0f18");
  ctx.fillStyle = cg;
  rr(-3, -8.5, 12, 17, 4);
  ctx.fillStyle = "rgba(120,170,230,0.35)";
  rr(-1, -7, 4, 14, 2);

  // headlights
  ctx.fillStyle = "#fff7d6";
  ctx.fillRect(20, -9, 3, 6); ctx.fillRect(20, 3, 3, 6);

  // tail lights
  ctx.fillStyle = ghost ? "#5a6478" : "#ff3040";
  ctx.fillRect(-22, -9, 2, 5); ctx.fillRect(-22, 4, 2, 5);

  // wheels
  ctx.fillStyle = "#0a0c12";
  ctx.fillRect(-15, -14, 8, 4); ctx.fillRect(-15, 10, 8, 4);
  ctx.fillRect(8, -14, 8, 4); ctx.fillRect(8, 10, 8, 4);

  ctx.restore();
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }

function drawVignette() {
  const g = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.35, VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.85);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
}

/* ---- menu: slowly rotating car on a spotlit platform ---- */
function drawMenu() {
  const cx = VIEW.w / 2, cy = VIEW.h * 0.46;
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 240);
  g.addColorStop(0, "rgba(255,160,80,0.16)");
  g.addColorStop(1, "rgba(255,160,80,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(2.4, 2.4);
  // platform ring
  ctx.strokeStyle = "rgba(120,200,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 60, 26, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.rotate(menuSpin);
  drawCar(0, 0, 0, curPaint());
  ctx.restore();
}

/* ----------------------------------------------------------------------------
   Garage UI
---------------------------------------------------------------------------- */
function renderGarage() {
  const c = curCar();
  E.carName.textContent = c.name;
  E.carBlurb.textContent = c.blurb;
  E.stats.innerHTML = "";
  for (const [label, val] of Object.entries(c.bars)) {
    const row = document.createElement("div");
    row.className = "srow";
    row.innerHTML = `<span>${label}</span><div class="track"><i style="width:${val}%"></i></div>`;
    E.stats.appendChild(row);
  }
  E.swatches.innerHTML = "";
  PAINTS.forEach((p, i) => {
    const s = document.createElement("div");
    s.className = "swatch" + (i === SAVE.color ? " sel" : "");
    s.style.background = `linear-gradient(135deg, ${p[0]}, ${p[1]})`;
    s.style.color = p[0];
    s.addEventListener("click", () => { SAVE.color = i; persist(); renderGarage(); Audio.blast("ui"); });
    E.swatches.appendChild(s);
  });
}
E.carPrev.addEventListener("click", () => { SAVE.car = (SAVE.car + CARS.length - 1) % CARS.length; persist(); renderGarage(); Audio.blast("ui"); });
E.carNext.addEventListener("click", () => { SAVE.car = (SAVE.car + 1) % CARS.length; persist(); renderGarage(); Audio.blast("ui"); });

/* ---- mode selector ---- */
function updateModeUI() {
  document.querySelectorAll(".mode-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === SAVE.mode);
  });
  E.modeBest.textContent = SAVE.mode === "ta"
    ? "Best Time Attack: " + Math.floor(SAVE.bestTA || 0)
    : "Best drift score: " + Math.floor(SAVE.best || 0);
}
document.querySelectorAll(".mode-btn").forEach((b) => {
  b.addEventListener("click", () => { SAVE.mode = b.dataset.mode; persist(); updateModeUI(); Audio.blast("ui"); });
});

/* ----------------------------------------------------------------------------
   Flow: menu → countdown → playing → pause / over
---------------------------------------------------------------------------- */
function applyModeHud() { E.taHud.hidden = mode !== "ta"; }

function startGame() {
  Audio.init(); Audio.resume(); Audio.blast("ui");
  init();
  applyModeHud();
  E.menu.classList.add("fade");
  setTimeout(() => { E.menu.hidden = true; E.menu.classList.remove("fade"); }, 300);
  beginCountdown();
}
function beginCountdown() {
  state = "countdown";
  countdownT = 3.2;
  E.countdown.classList.add("show");
}
function tickCountdown(dt) {
  countdownT -= dt;
  const n = Math.ceil(countdownT - 0.2);
  if (countdownT <= 0) {
    state = "playing";
    E.countdown.classList.remove("show", "go");
    E.countdown._n = null;
  } else if (E.countdown._n !== n) {
    // only rebuild on change so the pop animation plays once per number
    E.countdown._n = n;
    E.countdown.classList.toggle("go", n <= 0);
    E.countdown.innerHTML = `<b>${n <= 0 ? "GO!" : n}</b>`;
    Audio.blast("ui");
  }
}

function endTimeAttack() {
  bankDrift(false);
  const finalScore = Math.floor(score);
  let record = false;
  if (finalScore > (SAVE.bestTA || 0)) {
    SAVE.bestTA = finalScore;
    SAVE.ghost = { dt: GH_DT, s: ghostRec.slice(0, GH_MAX) };
    record = true;
  }
  persist();
  state = "over";
  Audio.idle();
  E.drift.classList.remove("show");
  E.resultStats.innerHTML = `
    <div class="rs"><span>Score</span><b>${finalScore}</b></div>
    <div class="rs"><span>Gates cleared</span><b>${gatesPassed}</b></div>
    <div class="rs"><span>Best combo</span><b>x${run.bestCombo.toFixed(1)}</b></div>
    <div class="rs"><span>Best Time Attack</span><b>${Math.floor(SAVE.bestTA)}</b></div>
    ${record ? '<div class="rs record"><span>NEW BEST</span><b>!</b></div>' : ""}`;
  E.result.hidden = false;
}

function togglePause() {
  if (state === "playing") {
    state = "paused";
    Audio.idle();
    E.runStats.innerHTML = `
      <div class="rs"><span>Score</span><b>${Math.floor(score)}</b></div>
      <div class="rs"><span>Best combo</span><b>x${run.bestCombo.toFixed(1)}</b></div>
      <div class="rs"><span>Longest drift</span><b>${run.longest.toFixed(1)}s</b></div>
      ${mode === "ta"
        ? `<div class="rs"><span>Gates cleared</span><b>${gatesPassed}</b></div>
           <div class="rs"><span>Time left</span><b>${Math.max(0, taTime).toFixed(1)}s</b></div>`
        : `<div class="rs"><span>Time</span><b>${run.time.toFixed(0)}s</b></div>`}`;
    E.pause.hidden = false;
  } else if (state === "paused") {
    state = "playing";
    E.pause.hidden = true;
    Audio.resume();
  }
}

E.start.addEventListener("click", startGame);
E.resume.addEventListener("click", togglePause);
E.restart.addEventListener("click", () => { E.pause.hidden = true; init(); applyModeHud(); beginCountdown(); });
E.toMenu.addEventListener("click", () => {
  E.pause.hidden = true;
  state = "menu";
  Audio.idle();
  E.menu.hidden = false;
  E.taHud.hidden = true;
  E.drift.classList.remove("show");
  updateModeUI();
});
E.resultRetry.addEventListener("click", () => { E.result.hidden = true; init(); applyModeHud(); beginCountdown(); });
E.resultMenu.addEventListener("click", () => {
  E.result.hidden = true;
  state = "menu";
  Audio.idle();
  E.menu.hidden = false;
  E.taHud.hidden = true;
  E.drift.classList.remove("show");
  updateModeUI();
});

/* ---- settings ---- */
E.vol.value = Math.round(SAVE.volume * 100);
E.sfx.checked = SAVE.sfx;
E.muteBtn.textContent = SAVE.muted ? "🔇" : "🔊";
E.vol.addEventListener("input", () => { SAVE.volume = E.vol.value / 100; persist(); Audio.applyVolume(); });
E.sfx.addEventListener("change", () => { SAVE.sfx = E.sfx.checked; persist(); Audio.applyVolume(); });
E.muteBtn.addEventListener("click", () => {
  SAVE.muted = !SAVE.muted; persist();
  E.muteBtn.textContent = SAVE.muted ? "🔇" : "🔊";
  Audio.applyVolume();
});
E.pauseBtn.addEventListener("click", togglePause);

/* ----------------------------------------------------------------------------
   Input
---------------------------------------------------------------------------- */
const keys = {};
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  if (k === "p" || k === "escape") { togglePause(); return; }
  keys[k] = true;
  if (k === "r" && state === "playing") resetCar();
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

// touch buttons map onto the same key state
if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
  E.touch.hidden = false;
  document.querySelectorAll(".tbtn").forEach((btn) => {
    const k = btn.dataset.k;
    const on = (e) => { e.preventDefault(); keys[k] = true; };
    const off = (e) => { e.preventDefault(); keys[k] = false; };
    btn.addEventListener("touchstart", on, { passive: false });
    btn.addEventListener("touchend", off, { passive: false });
    btn.addEventListener("touchcancel", off, { passive: false });
  });
}

/* ----------------------------------------------------------------------------
   Main loop
---------------------------------------------------------------------------- */
let last = 0;
function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000) || 0;
  last = t;

  if (state === "playing") update(dt);
  else if (state === "countdown") { tickCountdown(dt); }
  else if (state === "menu") menuSpin += dt * 0.5;

  if (state === "paused" || state === "over") Audio.idle();
  draw();
  requestAnimationFrame(loop);
}

/* ----------------------------------------------------------------------------
   Boot
---------------------------------------------------------------------------- */
resize();
makeAsphalt();
init();
renderGarage();
updateModeUI();
requestAnimationFrame(loop);
