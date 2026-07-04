<div align="center">

# DRIFT DASH

**A top-down arcade drifter with real momentum physics, procedural audio, and a risk/reward style system.**
Break traction, thread the cones, stack a multiplier — then bank it before you crash.

![version](https://img.shields.io/badge/version-2.1.0-blue) ![tech](https://img.shields.io/badge/HTML5-Canvas-ffd24d) ![audio](https://img.shields.io/badge/Web%20Audio-procedural-ff8a3c) ![deps](https://img.shields.io/badge/dependencies-none-ff3d6e) ![license](https://img.shields.io/badge/license-MIT-yellow)

</div>

---

## Features

### Game modes
- **Free Drift** — the endless sandbox: carve the course, thread the cones, stack and bank multipliers for as long as you like
- **Time Attack** — a checkpoint dash against the clock. You start with a short countdown timer and a circuit of ordered gates; drive through the next lit (green) gate to add time and points, then chase the one after it. Run the clock to zero and it is over. Your best Time Attack score is saved.
- **Ghost car** — Time Attack records the path, heading, and timing of your best run and replays it as a translucent ghost on every attempt after, so you can race your own personal best line

### Gameplay
- **Momentum-based drift physics** — velocity is split into forward + lateral components; the handbrake cuts lateral grip so the rear steps out and the car *slides*
- **Risk/reward scoring** — a held drift builds a multiplier (up to **×8**); straighten out to **bank** it, but clip a cone or kiss a wall and you **lose the whole pending combo**
- **Near-miss style bonuses** — slide *close* to a cone without hitting it for a **"CLOSE +"** style reward and bonus nitro
- **Nitro system** — fill the bar by drifting & threading cones, then hold **Shift** to burn it for a speed surge, flames, and a camera punch

### Procedural Audio (no audio files!)
- Real-time **engine** that pitches with your speed (dual detuned oscillators → low-pass)
- **Tire screech** (filtered noise) that tracks drift intensity
- Synthesized **impact**, **nitro whoosh**, **bank**, and UI sounds
- Master volume, SFX toggle, and one-tap mute — all saved

### Garage
- **4 cars** with genuinely different handling — *Comet* (balanced), *Viper* (loose & fast), *Boulder* (heavy & planted), *Wisp* (featherweight, razor-sharp turn-in) — shown with live stat bars
- **8 paint colors**, with a slowly-rotating live preview on the menu
- Your car, paint, mode, settings, and **best scores** (Free Drift and Time Attack) persist via `localStorage`

### Game feel
- **Dynamic camera** — follows the car, looks ahead in the direction of travel, and zooms out at speed / during nitro
- A detailed **arena** — asphalt texture, red/white racing curbs, corner tire-stack barriers, and glowing Time Attack gates
- Heat-tinted **tire marks**, drift **smoke**, nitro **flames**, checkpoint **sparks**, **screen shake**, wreck flash, and a vignette
- Animated **3‑2‑1‑GO** countdown, pause menu with run stats (best combo, longest drift, time)
- **Mobile ready** — on-screen touch controls appear automatically on touch devices

## Controls

| Key | Action | | Key | Action |
|-----|--------|---|-----|--------|
| `W` / `↑` | Gas | | `Space` | **Handbrake** (break traction) |
| `S` / `↓` | Brake / reverse | | `Shift` | **Nitro** |
| `A` `D` / `← →` | Steer | | `P` / `Esc` | Pause |
| | | | `R` | Reset car |

Pick **Free Drift** or **Time Attack** from the mode toggle on the menu before you start the engine.

> **How to drift:** get up to speed, then tap **Space** while steering into a corner. Hold the slide to grow the multiplier, weave it past the cones for CLOSE bonuses, and ease off to bank the points.
>
> **Time Attack:** the next gate to clear glows green. Aim for it, punch through the middle to bank time and points, then chase the next one. A translucent ghost of your best run drives alongside you.

## How the drift works

Each frame the car's velocity is projected onto its **forward** and **sideways** axes. The forward part is driven by the throttle and light drag; the sideways part is multiplied by a *grip* factor every frame. Normal driving keeps grip high — sideways speed dies fast, so the car tracks straight. The handbrake (and each car's base looseness) raises how much sideways velocity survives, so the rear steps out and the car slides. The **slip angle** between heading and actual travel direction drives the smoke, the screech volume, and your score.

## Run it

Open `index.html` in any modern browser — no build, no server. Click once to start the audio engine (browsers require a user gesture before sound).

With XAMPP: drop the folder in `htdocs` and visit **`http://localhost/drift-dash/`**.

## Built with
Vanilla JavaScript · HTML5 Canvas · Web Audio API. **Zero dependencies.**

## License
MIT.
