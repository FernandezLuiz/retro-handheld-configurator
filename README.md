# GameBoy — Retro Handheld Configurator

An experimental single-page 3D configurator: customise a handheld, explore its environments and play games on its actual screen.

This is a student concept and educational prototype inspired by the classic Game Boy. It is not affiliated with or endorsed by Nintendo.

[Live project](https://retro-handheld-configurator.vercel.app) · [GitHub repository](https://github.com/FernandezLuiz/retro-handheld-configurator)

## Features

- Rotate and zoom around a Blender-built handheld with pressable physical controls.
- Independently customise **Body, Buttons, D-pad and Screen**; choose **Matte, Glossy or Translucent** plastic. Translucent reveals internal electronics.
- Apply Classic, Atomic, Forest, Sunset or Stealth editions, then fine-tune individual properties. Scene selection stays independent of editions.
- Explore four art-directed environments: **Arcade** (default), a neon corridor with attract screens; **Studio**, a clean product-photography sweep; **Retro Desk**, an evening workspace with a lit terminal and lamp; and **Dark Tech**, a dark product lab with cyan light.
- Enter Play Mode to play **Vector Field** or the **Space Invaders-inspired game** on the visible 3D handheld. Keyboard and mouse/touch controls provide tactile feedback, and key hints follow the player's keyboard layout (QWERTY or AZERTY). Exit restores the configurator view and settings.
- Responsive desktop/mobile layouts: on touch screens, vertical swipes scroll the page, sideways swipes rotate and pinch zooms.
- Bloom, shadows and entrance motion on capable GPUs, with a plainer path for slower devices; reduced-motion support and Reset.

## Technology

Vanilla JavaScript, Vite, Three.js (GLTFLoader, OrbitControls, CanvasTexture and post-processing), Blender/Python and GLB assets. Tests use Node’s built-in test runner and Playwright. Version control is Git/GitHub; deployment is Vercel.

## Run locally

Use Node.js 20.19+ (20.x) or 22.12+ and npm.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Tests and production build

```bash
npm test                      # Unit tests
npx playwright install chromium # Install Playwright's browser once
npm run test:browser           # Browser tests; starts Vite automatically
npm run build                 # Production output in dist/
npm run preview               # Preview the production build locally
```

The suite has 26 unit tests and 27 browser tests.

On Linux systems missing browser libraries, use `npx playwright install --with-deps chromium`. Browser tests use Playwright-managed Chromium; no locally installed Chrome is required. SwiftShader flags enable software WebGL for reproducible headless checks, not native-GPU performance benchmarks.

## Project references

- [Moodboard and visual direction](moodboard/README.md): Take/Ignore notes, palette, Syne/IBM Plex Sans typography, spacing, materials and lighting.
- [Project plan and handover](PLAN.md).
- [Contributor instructions](AGENTS.md).
- [AI-assisted development process](AI_PROCESS.md).
- [Game implementation and controls](src/play/README.md).

## Credits and licences

The handheld model was authored with Blender/Python for this project as a concept inspired by the classic Game Boy. Its source is `scripts/create-retro-handheld.py`; the Blender file and exported GLB are included. AI-assisted development and critical revisions are summarised in AI_PROCESS.md.

Moodboard images are **inspiration only**, not original project artwork or a grant of reuse rights. Known attribution is retained; unknown sources are explicitly marked in the moodboard. Game Boy is a trademark of Nintendo, and other brand and game names belong to their respective owners. This is a non-commercial student project, not an official product.

Syne and IBM Plex Sans are distributed under the SIL Open Font License; licence texts are included in `public/fonts/`. Three.js and Vite use the MIT licence; Playwright uses Apache-2.0. Other dependencies retain their own licences. No blanket licence for third-party reference images is implied.
