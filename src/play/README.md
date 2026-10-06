# FORM // VECTOR FIELD

The original vector arcade game runs inside the existing Play Mode. The
configurator, GLB, scenes, camera transitions, OrbitControls and Edition/Scene
independence are preserved.

## Controls

| Input | Action |
| --- | --- |
| Left / A | Rotate counter-clockwise |
| Right / D | Rotate clockwise |
| Up / W | Forward thrust |
| Space / Z | Fire |
| Shift / X | Short boost, with a cooldown |
| R or Restart | Restart the run |
| Space on Game Over | Retry |
| Escape or Exit Game | Return to the saved configurator view |

Touch controls provide rotation, thrust, fire and boost. There is no reverse
thrust. Keyboard listeners exist only during a Play session. Blur/visibility
changes pause simulation and clear held inputs. Focus returns to PLAY on exit.

## Existing implementation

- `game.js`: seeded simulation, acceleration/inertia with mild drag, toroidal
  wrapping and collision distances, rate-limited projectiles with inherited
  velocity and finite lifetime, boost cooldown, and three lives with protected
  respawns. Large hazards take three hits and split into two medium hazards;
  medium hazards take two hits and split into two small hazards. Small hazards
  take one hit. Scores are 100 / 200 / 400, with higher special-enemy scores.
- Waves add hazards and gradually raise speed. Drifter appears from wave 3,
  Hunter from wave 5, and Pulse from wave 7. Drifter changes heading, Hunter
  steers toward the ship, and Pulse telegraphs expanding collision rings.
- The session high score survives Restart and exiting/re-entering Play Mode.
  Reloading the page starts a new session; no persistent storage is used.
- `surface.js`: procedural wireframe polygons, split-tail ship, projectiles,
  trails, line-fragment bursts, subtle flashes and collision shake, HUD and
  Game Over display. Reduced-motion preference suppresses shake and flashes.
  The logical 512 × 400 field is drawn onto a supersampled 1024 × 800 canvas.
- Edition themes use green, cyan, deep green, amber/coral or grey vector lines
  on dark backgrounds. Custom configurations use the selected screen color.
  Palette changes never enter the physics simulation; Scenes do not select
  palettes.
- `play-mode.js`: original entry/exit state machine, modal, session input,
  focus handling, touch input and tactile feedback bridge. The viewer's legacy
  button-B channel is mapped to boost without changing the 3D viewer.
- `play.css`: existing overlay layout, with smooth vector-canvas sampling.

The original viewer owns the only animation loop. Simulation advances in 120 Hz
fixed steps; canvas painting targets 60 Hz. The same CanvasTexture remains on the
actual screen mesh, using the GLB's existing UV orientation. Covered 3D rendering
is skipped while the opaque game overlay is fully open and resumes on exit.
The viewer owns texture disposal. No external art or audio assets are required;
optional procedural audio has not been added.

## Resume audit — 2026-09-28

All required game mechanics, rendering, input, palette and Play Mode integrations
above were already implemented before resuming. The README still described Grid
Runner, and final full-suite verification needed to be completed. The resume
preserves the working gameplay code and updates this documentation.

Verification commands:

- `npm test`: 19 unit tests covering game mechanics and the existing product.
- `npx playwright test`: 12 Chrome checks covering the configurator, four scenes,
  Play transitions/restoration, rotation/thrust/fire/boost, tactile feedback,
  palette pixels, repeated-session listener/resource counts, mobile input,
  missing-model fallback, and Game Over/Space retry.
- `npm run build`: production compilation. Vite retains its non-failing
  advisory for the Three.js bundle exceeding 500 kB.

Chrome automation uses SwiftShader; these are functional/rendering checks, not
native-GPU frame-rate benchmarks. Screenshots are saved under `scripts/`,
including `play-idle.png`, `play-mode.png`, and `vector-field-game-over.png`.
