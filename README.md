<div align="center">

# DRIFT DASH

**A top-down arcade drifter with real momentum physics, procedural audio, and a risk/reward style system.**
Break traction, thread the cones, stack a multiplier — then bank it before you crash.

![tech](https://img.shields.io/badge/HTML5-Canvas-ffd24d) ![audio](https://img.shields.io/badge/Web%20Audio-procedural-ff8a3c) ![deps](https://img.shields.io/badge/dependencies-none-ff3d6e) ![license](https://img.shields.io/badge/license-MIT-yellow)

</div>

---

## Features

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
- **3 cars** with genuinely different handling — *Comet* (balanced), *Viper* (loose & fast), *Boulder* (heavy & planted) — shown with live stat bars
- **7 paint colors**, with a slowly-rotating live preview on the menu
- Your car, paint, settings, and **best score** persist via `localStorage`

### Game feel
- **Dynamic camera** — follows the car, looks ahead in the direction of travel, and zooms out at speed / during nitro
- Heat-tinted **tire marks**, drift **smoke**, nitro **flames**, **screen shake**, wreck flash, and a vignette
- Animated **3‑2‑1‑GO** countdown, pause menu with run stats (best combo, longest drift, time)
- **Mobile ready** — on-screen touch controls appear automatically on touch devices

## Controls

| Key | Action | | Key | Action |
|-----|--------|---|-----|--------|
| `W` / `↑` | Gas | | `Space` | **Handbrake** (break traction) |
| `S` / `↓` | Brake / reverse | | `Shift` | **Nitro** |
| `A` `D` / `← →` | Steer | | `P` / `Esc` | Pause |
| | | | `R` | Reset car |

> **How to drift:** get up to speed, then tap **Space** while steering into a corner. Hold the slide to grow the multiplier, weave it past the cones for CLOSE bonuses, and ease off to bank the points.

## How the drift works

Each frame the car's velocity is projected onto its **forward** and **sideways** axes. The forward part is driven by the throttle and light drag; the sideways part is multiplied by a *grip* factor every frame. Normal driving keeps grip high — sideways speed dies fast, so the car tracks straight. The handbrake (and each car's base looseness) raises how much sideways velocity survives, so the rear steps out and the car slides. The **slip angle** between heading and actual travel direction drives the smoke, the screech volume, and your score.

## Run it

Open `index.html` in any modern browser — no build, no server. Click once to start the audio engine (browsers require a user gesture before sound).

With XAMPP: drop the folder in `htdocs` and visit **`http://localhost/drift-dash/`**.

## Built with
Vanilla JavaScript · HTML5 Canvas · Web Audio API. **Zero dependencies.**

## License
MIT.
