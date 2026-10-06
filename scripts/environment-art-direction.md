# Final environment and handheld polish

The UI files and Edition/Scene selection logic are unchanged. Scene switching
uses four cached groups with only one visible, including its lights. Default
framing is slightly closer with a lower elevation; OrbitControls behavior and
scene-independent camera position remain intact.

Latest polish adds a tonal cyclorama sweep and layered contact shadow; a profiled
lamp shade, rolled lip, shelf supports, page-edge details and wall battens at the
desk; original emissive CRT horizon graphics and cabinet scale variation in the
arcade; a profiled plinth and machining reveals in Dark Tech. Dark environments
use a product-focused spotlight with distance falloff so background architecture
recedes. All designs remain unbranded.

## Final sets

- **Studio:** a circular seamless floor/cove supports viewing from every side.
  Softbox illumination comes from the existing reflection environment and lights;
  no softbox geometry is visible. Faint architectural reveals and a filtered
  contact shadow keep the product-photography composition minimal.
- **Retro Desk:** a finite walnut desktop with a rounded edge, drawers, brass
  pulls and tapered legs; plaster room walls; detailed keyboard, cassette,
  notebook, pencil, angled-stem vintage lamp, analog clock, ceramic mug, framed
  original geometric artwork and books on a wall shelf. A felt presentation pad
  anchors the handheld. Grain, fabric and painted-metal variations remain subtle.
- **Arcade:** an enclosed room with restrained broken-diamond carpet texture,
  five profiled cabinets at different depths, coin doors, CRT surrounds, original
  abstract screen graphics, joysticks, six-button decks, illuminated marquees,
  wall signage, ceiling-mounted light strips and a stool. No licensed artwork.
- **Dark Tech:** chamfered graphite presentation plinth with an inset light ring;
  multiple-depth wall bays, service rails, panel joints, panel fastener details,
  vent arrays, recessed light channels, supported overhead rails, conduits and
  a small abstract status module. Brushed metal adds fine material variation.

## Orbit safety and performance

Raised props and room architecture leave a 6.6-unit horizontal presentation
radius clear. Desk/floor/pedestal surfaces stay below the product. Automated
ray checks cover 24 azimuths at three normal camera heights and three product
target heights. This designs for normal orbiting without changing the existing
camera limits or adding new collision controls.

Final triangles (including instance multiplicity):

| Scene | Triangles |
| --- | ---: |
| Studio | 4,252 |
| Retro Desk | 13,320 |
| Arcade | 10,628 |
| Dark Tech | 10,754 |

Small procedural material maps use mipmaps; rounded keyboard keys and repeated
vents use instancing. Geometry, materials and textures are disposed on viewer
teardown. The GPU-resource switching test checks stable geometries/textures,
scene child counts, and group UUIDs after warm-up across repeated cycles.

## Verification

- `npm test`: product behavior, independent editions/scenes, scene budgets,
  resource disposal, raised-prop clearance and full-turn sightlines.
- `npx playwright test`: all product controls/Reset, independent presets,
  all four scenes, front/three-quarter/rear views, full horizontal rotations,
  repeated switching and runtime shader errors.
- `npm run build`: production compilation.
- `environment-previews/`: captured front, three-quarter and rear-quarter views.
- `environment-validation.json`: machine-readable final scene budgets.

## Handheld and Atomic correction

The Blender source and GLB were regenerated. All 37 mesh names remain; the asset
is 35,378 triangles / 1,064,516 bytes. Geometry changes affect `body`, `back_panel`,
`shell_seam`, `screen_bezel`, `dpad`, `button_a`, `button_b`, `speaker`,
`side_buttons`, and `internal_solder`. These refine corner/edge radii, button
thumb dishes, the switch recess, acoustic backing ribs and PCB vias. No mesh was
added or renamed. All closed-solid materials now export with backface culling;
`screen_glass` also has a lower-roughness, uncoated lens for a crisper LCD.

The old shell transmission thickness was 0.035 in the GLB's meter coordinates:
35 mm, exceeding the entire device depth and far exceeding its 2.5–3 mm walls.
Three.js multiplies this by the model scale before sampling the refraction
buffer, which displaced opaque button shapes. Double-sided materials also
triggered an additional back-face transmission pass and layered refraction.

The shell now uses 0.0025 m thickness, FrontSide rendering, opacity 1,
transparent=false and depthWrite=true. Transmission 0.78, roughness 0.25,
IOR 1.46, no clearcoat, envMapIntensity 0.28 and specularIntensity 0.38 give a
soft frosted finish while retaining visible internals and geometric wall depth.
There is no extra render target, alpha-sorted shell or custom shader patch.

Final validation: 13 Node tests, 8 Chrome tests and production build passed.
Chrome uses SwiftShader in automated testing; this validates rendering and
resource stability, not a native-GPU frame-rate benchmark. The build retains
Vite's existing advisory about the Three.js bundle exceeding 500 kB.
Atomic front, side and rear captures are in `environment-previews/atomic-polished-*`.
