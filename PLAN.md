# PLAN.md

## Project

An experimental 3D retro handheld configurator built with Vite and Three.js.

The project lets the user customise a retro-inspired handheld console, inspect it in 3D, switch between different environments and enter Play Mode to play small retro-inspired games.

The goal is to create something playful, interactive and visually distinctive instead of a standard product configurator.

---

## Main concept

The configurator is based around an original retro handheld inspired by late 1980s and early 1990s portable gaming hardware.

The product should feel nostalgic but still contemporary.

The visual identity combines:
- playful product design
- oversized experimental typography
- retro technology
- arcade graphics
- translucent electronics
- clean modern web design

The project should not directly copy existing Nintendo or Playdate branding.

---

## 3D product

The main object is a custom retro handheld.

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
- Studio
- Retro Desk
- Arcade (default homepage scene)
- Dark Tech

Scenes only change the environment around the product.

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
- GAMEBOY title
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

The main configurator is already working.

Completed:
- custom 3D handheld
- multiple configurable properties
- multiple materials
- translucent internals
- four 3D environments
- edition presets
- camera controls
- visual identity
- Play Mode
- multiple playable games
- moodboard

Still to review:
- responsive/mobile behaviour
- final visual polish
- usability
- final testing
- documentation

## Audience

The configurator is aimed at people who enjoy retro gaming, playful digital experiences and product customisation.

The experience should also be understandable for someone who has never used a 3D configurator before.

The main focus is not realism, but exploration, personality and interaction.

---

## Sources & licences

Visual references are stored in /moodboard.

The moodboard is used as visual inspiration only.

The 3D handheld is an original retro-inspired design and should not directly reproduce an existing Nintendo or other branded product.

Existing brands, logos, game artwork and copyrighted visual assets should not be copied.

Any external assets added later should have a licence that allows their use in this student project.

---

## Handover

### Decisions

- The product is a retro-inspired handheld console.
- The visual direction is playful, experimental and retro-tech.
- Scene and Edition remain independent.
- Translucent material remains an important feature.
- Play Mode is part of the final concept.
- The moodboard defines the visual direction.

### Open questions

- Final project name.
- Final mobile layout.
- Whether all four environments need additional visual polish.
- Final number of playable games.

### Next action

Review the configurator on different screen sizes and continue improving the design using the moodboard as reference without breaking existing functionality.

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
