# Changelog

All notable changes to Drift Dash are documented here.

## [2.1.0] - 2026-07-04

### Added
- Game-mode selector on the menu: Free Drift (the original endless mode) and Time Attack.
- Time Attack mode: a circuit of ordered gates and a countdown clock. Clearing the next lit gate adds time and points; when the clock hits zero the run ends on a results screen. Best Time Attack score is persisted to localStorage.
- Ghost car: Time Attack records the position, heading, and timing of your best run and replays it as a translucent ghost on later attempts.
- New car, Wisp: a featherweight with razor-sharp turn-in, distinct handling stats.
- New paint color (teal), bringing the palette to eight.
- Time Attack HUD showing remaining time and gates cleared, with a low-time warning state.
- Results screen with retry and garage options, including a new-best indicator.

### Changed
- Environment art pass: procedural asphalt texture via a cached canvas pattern, red/white racing curbs around the arena, corner tire-stack barriers, and glowing gate markers.
- Car sprite detail: rear wing, front splitter, tinted cockpit glass, tail lights, and a body highlight.
- Particle polish: checkpoint spark bursts and sparks added to cone impacts.
- Pause stats and the top BEST readout adapt to the active mode.

### Preserved
- All 2.0.0 systems remain intact: momentum drift physics, risk/reward combo banking, near-miss CLOSE bonuses, nitro, procedural audio with mute/volume/sfx, garage with cars and paints and live preview, dynamic camera, countdown, pause menu with run stats, touch controls, and localStorage saves.

## [2.0.0] - 2026-07-04

Top-tier rewrite: procedural audio, nitro, near-miss scoring, garage, dynamic camera, touch controls.

## [1.0.0] - 2026-07-04

Initial release.
