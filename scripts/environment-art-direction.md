# Environment and handheld art direction

This records the final scenes and the handheld's material decisions. The project
is a student educational prototype inspired by the classic Game Boy, not
affiliated with or endorsed by Nintendo. The sets use no licensed artwork.

Scene switching uses four cached groups with only one visible, including its
lights. Scene and Edition stay independent, and a scene change does not move the
product or the camera.

## Final sets

- **Arcade (default):** a neon corridor running to a striped moon at its vanishing
  point. Eighteen cabinets with original attract screens line the corridor and
  dress the hall around the orbit. A polished floor carries the neon, stepped
  portals and a pink ceiling band lead the eye, and a ringed hero plinth gives the
  product a stage. Dust drifts slowly through the light.
- **Studio:** a photographer's seamless sweep with no walls or seams, only a tonal
  falloff from a bright pool behind the product. It stands on a polished white
  riser. The softboxes exist only in the reflection probe, so none are visible.
- **Retro Desk:** early evening at a home desk. A dusk window with blinds gives the
  room depth, and a beige home computer has a lit CRT. The foreground holds a
  keyboard, game cartridges, a cassette and a notebook, set back from the orbit.
  A bell-shaded lamp pools light on the desk and wall, and a shelf with a warm
  under-glow adds a second layer. A felt pad on the walnut desk anchors the product.
- **Dark Tech:** a dark product lab. Layered wall bays stay in shadow behind cyan
  linear light, and one glowing gate behind the product pulls the eye through the
  room. Lead-in lines on the floor converge on the gate, and the product stands on
  a low chamfered plinth edged in light.

## Light and reflections

Each scene has its own procedural reflection probe, with emissive panels placed
where that room's lights are. The dark scenes aim their key and coloured rim lights
at the product, so the rims cut its silhouette without washing the room, while a
neutral fill keeps product colours true. Studio uses a clean white kicker instead.

Bloom runs only in the dark scenes, on GPUs that can carry it: bright rooms have no
emitters to bloom, and the whole frame would glow instead.

## Orbit safety and performance

Raised props and room architecture leave a 6.6-unit horizontal presentation radius
clear. Automated ray checks cover 24 azimuths at three normal camera heights and
three product target heights. A second check covers the whole orbit at five
elevations, including top-down, so no solid scene geometry can block or swallow the
camera. This designs for normal orbiting without adding collision controls.

Current triangles (including instance multiplicity), against a limit of 14,000 per
scene:

| Scene | Triangles | Meshes |
| --- | ---: | ---: |
| Arcade | 13,295 | 166 |
| Studio | 4,808 | 7 |
| Retro Desk | 3,134 | 73 |
| Dark Tech | 4,362 | 145 |

Geometry, materials and textures are disposed on viewer teardown. The browser
switching test checks that geometry, texture and object counts stay stable across
repeated cycles.

## Handheld and Translucent

The GLB has 42 meshes, 37,912 triangles and 1,134,188 bytes, against a limit of
40,000 triangles. Exact figures are in `retro-handheld-validation.json`, regenerated
by `node scripts/validate-retro-handheld.js`.

An early shell transmission thickness of 0.035 in the GLB's meter coordinates meant
35 mm, more than the entire device depth, which displaced the opaque buttons seen
through it. Double-sided materials also added a back-face transmission pass and
layered refraction.

The Translucent shell now uses 0.0025 m thickness, FrontSide rendering, opacity 1,
transparent=false and depthWrite=true. Transmission 0.84, roughness 0.25, IOR 1.46,
no clearcoat, envMapIntensity 0.62 and specularIntensity 0.7 give a frosted finish
that keeps the internals visible. There is no alpha-sorted shell or custom shader
patch.

## Verification

- `npm test`: 26 tests. Product behaviour, independent Editions and Scenes, scene
  budgets, resource disposal, orbit clearance and sightlines.
- `npm run test:browser`: 27 tests. All product controls and Reset, all four scenes
  from several angles, repeated switching, Play Mode, touch and runtime shader
  errors.
- `npm run build`: production compilation. Vite's advisory about the Three.js bundle
  exceeding 500 kB is expected.

Chrome uses SwiftShader in automated testing. This validates rendering and resource
stability, not native-GPU frame rate.

The browser suite writes `scene-*.png` and `environment-previews/` when it runs. The
copies in the repository are only as recent as the last time that output was
committed.
