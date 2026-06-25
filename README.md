# 🏎️ Drift Dash

A small top-down arcade **drifting** game. Break traction with the handbrake, slide around the cones, and hold a continuous drift to stack a score multiplier — then bank it before you crash.

![tech](https://img.shields.io/badge/Canvas-2D-ffd24d) ![deps](https://img.shields.io/badge/dependencies-none-ff8a3c) ![license](https://img.shields.io/badge/license-MIT-yellow)

## ✨ Features
- **Momentum-based drift physics** — velocity is split into forward + lateral components; the handbrake reduces lateral grip so the car slides
- **Risk/reward scoring** — a drift builds a multiplier the longer you hold it; bank it by straightening out, but **crash and you lose the lot**
- **Tire marks & smoke** that trail your slides
- **Scattered cones** to weave around (clip one and your drift is wrecked)
- **Smooth camera** follow across a large arena, screen shake on impact
- **Persistent best score** via `localStorage`

## 🎮 Controls
| Key | Action |
|-----|--------|
| `W` / `↑` | Gas |
| `S` / `↓` | Brake / reverse |
| `A` `D` / `← →` | Steer |
| `Space` | Handbrake (break traction) |
| `R` | Reset the car |

## 🧠 How the drift works
Each frame the car's velocity is projected onto its **forward** and **sideways** axes. The forward part is driven by the throttle and light drag; the sideways part is multiplied by a *grip* factor every frame. Normal driving keeps grip high (sideways speed is killed quickly, so the car tracks straight). Pulling the handbrake raises how much sideways velocity survives — the rear steps out and the car slides. The **slip angle** between heading and travel direction drives both the smoke and the score.

## 🚀 Run it
Open `index.html` — no build, no server. With XAMPP, visit `http://localhost/drift-dash/`.

## 📄 License
MIT.
