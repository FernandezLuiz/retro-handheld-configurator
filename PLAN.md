# PLAN.md

## Project

A student concept and educational prototype: a handheld inspired by the classic Game Boy, presented in an experimental 3D configurator built with Vite and Three.js. It is not affiliated with or endorsed by Nintendo.

The project lets the user customise a retro-inspired handheld console, inspect it in 3D, switch between different environments and enter Play Mode to play small retro-inspired games.

The goal is to create something playful, interactive and visually distinctive instead of a standard product configurator.

---

## Main concept

The configurator is based around a handheld that intentionally references the classic Game Boy and other late 1980s and early 1990s portable gaming hardware.

The product should feel nostalgic but still contemporary.

The visual identity combines:
- playful product design
- oversized experimental typography
- retro technology
- arcade graphics
- translucent electronics
- clean modern web design

The name and product design reference the classic Game Boy on purpose, as a school prototype. Other references, such as Playdate, are inspiration only and their branding is not used.

---

## 3D product

The main object is a custom 3D handheld, modelled for this project.

The model contains separate configurable parts such as:
- body / shell
- buttons
- D-pad
- screen
- back panel
- internal electronic components

The user can rotate and zoom around the product.

---

## Configurator controls

The current configurator includes:

### Scene

- Arcade — default / hero environment: neon corridor with attract screens and a moon at its vanishing point
- Studio — clean product-photography sweep with a polished riser
- Retro Desk — evening workspace with a dusk window, lit terminal and desk lamp
- Dark Tech — dark product lab with a cyan light gate

Scenes only change the environment around the product and remain independent from Editions.

### Edition
- Classic
- Atomic
- Forest
- Sunset
- Stealth

Editions change the appearance of the handheld but should not automatically change the Scene.

### Individual controls
- Body colour
- Button colour
- D-pad colour
- Screen appearance
- Material

### Materials
- Matte
- Glossy
- Translucent

Translucent mode reveals the internal electronics of the handheld.

---

## Play Mode

The configurator contains an ENTER GAME button.

When activated:
- the camera moves towards the handheld screen
- the configurator interface transitions into Play Mode
- the game appears on the actual 3D screen
- the player can exit and return to the configurator

Games currently include:
- Vector Field
- Space Invaders-inspired game

The games should use original graphics and avoid copying copyrighted artwork.

---

## Visual identity

The visual direction is playful, experimental and retro-tech.

### Typography

Display:
Syne ExtraBold

Used for:
- large headings
- GameBoy title
- major graphic elements

Body / UI:
IBM Plex Sans

Used for:
- labels
- controls
- small text
- explanations

### Colour direction

Main background:
warm off-white / cream

Main text:
very dark charcoal

Accent colours:
- acid green
- burgundy
- muted green
- mint
- clay / warm orange

The acid green should mainly be used for interactive moments such as:
- ENTER GAME
- selected states
- small highlights

---

## Moodboard

The visual references are stored in:

/moodboard

Each image contains a written instruction in:

/moodboard/README.md

The references focus on:
- Playdate-style playful product presentation
- arcade environments
- translucent electronics
- retro workspaces
- monochrome retro interfaces
- experimental oversized typography

The references are inspiration only. Their exact branding, layouts and products should not be copied.

---

## Interaction principles

The interface should feel playful but remain understandable.

Use:
- bold typography
- asymmetrical layouts
- strong selected states
- small CRT / pixel / glitch effects
- clear hover feedback
- smooth 3D transitions

Avoid:
- generic SaaS-style cards
- too many rounded pill buttons
- excessive shadows
- unnecessary animations
- effects that make the interface difficult to use

---

## Technical setup

Framework:
Vite

Language:
JavaScript

3D library:
Three.js

3D model:
GLB

Main source files live in:
/src

3D assets and other public assets live in:
/public

Moodboard:
/moodboard

---

## Responsive behaviour

The configurator should work on both desktop and mobile.

Desktop:
- large 3D viewer
- controls visible next to the viewer

Mobile:
- product remains clearly visible
- controls remain usable
- text does not overlap
- important actions remain accessible
- vertical swipes scroll the page; sideways swipes rotate the product and pinch zooms
- Play Mode uses the handheld's own on-screen controls

---

## Testing

After meaningful changes, test:

- project loads correctly
- 3D model appears
- orbit / rotation works
- zoom works
- Body control works
- Buttons control works
- D-pad control works
- Screen control works
- Material control works
- Translucent mode works
- Scenes work independently
- Editions work independently
- ENTER GAME works
- game selection works
- games can be played
- user can exit Play Mode
- Reset returns to the default state
- desktop layout works
- mobile layout works

---

## Rules for future changes

Preserve working functionality whenever possible.

Do not redesign unrelated parts when fixing one specific problem.

Make focused changes and test them afterwards.

Keep Scene and Edition independent.

Keep Translucent material available.

Keep Play Mode working.

Follow the visual direction documented in the moodboard.

---

## Current status

The configurator is implemented and deployed on Vercel, with source tracked in Git/GitHub.

Completed:
- custom 3D handheld with refined geometry, closed shell assembly and physical pressable controls
- independent Body / Buttons / D-pad / Screen customisation
- Matte / Glossy / Translucent materials and visible internal electronics
- Edition presets independent of Scene selection
- four environments, with Arcade as the default
- OrbitControls, zoom, Reset and loading/fallback behaviour
- Play Mode with Vector Field and a Space Invaders-inspired game
- keyboard and mouse/touch controls, including physical 3D control feedback during gameplay
- handheld-visible gameplay, game library and exit/state restoration
- desktop and mobile behaviour, plus reduced-motion support
- automated unit and Playwright browser tests
- visual direction and moodboard Take/Ignore notes
- final README and AI process documentation; portable Playwright browser setup
- key hints that follow the player's keyboard layout (QWERTY or AZERTY)

Remaining submission items:
- recover final moodboard source information where possible; retain honest unknown attribution otherwise

Visual upgrade (merged into `main`):
- remodelled handheld: signature lower-right corner, bezel, diagonal speaker, angled Start/Select, printed marks and rear cartridge
- rebuilt Arcade: neon corridor with a moon at its vanishing point, attract screens, polished floor and hero plinth
- per-scene reflection probes, neutral product lighting with Arcade rim lights, shadows and bloom
- longer lens, product turned to show its corner, oversized 3D title standing behind it
- full-bleed viewer, printed spec-sheet sidebar, entrance motion, change feedback and scene wipe
- Studio, Retro Desk (now an evening scene) and Dark Tech individually art-directed; Arcade stays the hero
- touch: vertical swipes scroll the page, sideways swipes orbit and pinches zoom; key labels follow the player's keyboard layout

Final verification:
- `npm test`: 26 of 26 passed
- `npm run test:browser`: 27 of 27 passed in one full run (software WebGL, not a native-GPU benchmark)
- `npm run build`: succeeded, with Vite's non-failing advisory about the 780 kB JavaScript bundle
- browser tests simulate touch; real-device feel and frame rate are not measured by the suite

`src/scene/quality.js` runs bloom, shadows and entrance motion only on capable GPUs. Software renderers use the plain path, and a real device that cannot hold its frame rate steps down once. `?quality=high` or `?quality=low` overrides this for testing.

## Audience

The configurator is aimed at people who enjoy retro gaming, playful digital experiences and product customisation.

The experience should also be understandable for someone who has never used a 3D configurator before.

The main focus is not realism, but exploration, personality and interaction.

---

## Sources & licences

Visual references are stored in /moodboard.

The moodboard is used as visual inspiration only.

The 3D handheld was modelled for this project as a student concept inspired by the classic Game Boy. It is not affiliated with or endorsed by Nintendo.

Other brands, logos, game artwork and copyrighted visual assets should not be copied.

Any external assets added later should have a licence that allows their use in this student project.

---

## Handover

### Decisions

- The product is a student concept inspired by the classic Game Boy, named GameBoy; its system branding is GameBoy OS.
- The visual direction is playful, experimental and retro-tech.
- Scene and Edition remain independent.
- Translucent material remains an important feature.
- Play Mode is part of the final concept.
- The moodboard defines the visual direction.

### Open questions

- Sources/creators of saved moodboard references currently marked unknown

### Next action

The visual upgrade is merged and live. Submit the final zip and links. Moodboard attribution stays honestly marked unknown unless a source is recovered.

Preserve working functionality during any further polish.

## Development steps

### First version
- Load one retro handheld in Three.js
- Allow rotate and zoom
- Add basic colour customisation
- Create a simple configurator interface

### Improvements
- Added separate Body, Buttons, D-pad and Screen controls
- Added Matte, Glossy and Translucent materials
- Added visible internal electronics
- Added Edition presets
- Added four environments
- Improved visual identity using the moodboard
- Added Play Mode
- Added Vector Field
- Added Space Invaders-style game
- Improved responsive behaviour and visual hierarchy

### Visual upgrade (handover from Codex to Claude Code)
- Remodelled the handheld and rebuilt Arcade
- Added per-scene reflections, shadows and bloom
- Redesigned the interface, composition and motion
- Art-directed Studio, Retro Desk and Dark Tech
- Fixed touch scrolling and made key hints follow the keyboard layout

## Version control & publishing

Version control:
Git

Repository:
GitHub

Repository URL:
https://github.com/FernandezLuiz/retro-handheld-configurator

Hosting:
Vercel

Live URL:
https://retro-handheld-configurator.vercel.app

The main branch is connected to Vercel.
Every push to main automatically triggers a new deployment.