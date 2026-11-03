# GameBoy — Retro Handheld Configurator

An experimental single-page 3D configurator: customise GameBoy, an original retro-inspired handheld, explore its environments and play games on its actual screen.

[Live project](https://retro-handheld-configurator.vercel.app) · [GitHub repository](https://github.com/FernandezLuiz/retro-handheld-configurator)

## Features

- Rotate and zoom around a refined Blender-built handheld with pressable physical controls.
- Independently customise **Body, Buttons, D-pad and Screen**; choose **Matte, Glossy or Translucent** plastic. Translucent reveals internal electronics.
- Apply Classic, Atomic, Forest, Sunset or Stealth editions, then fine-tune individual properties. Scene selection stays independent of editions.
- Explore **Arcade** (default), **Studio**, **Retro Desk** and **Dark Tech** environments.
- Enter Play Mode to play **Vector Field** or the **Space Invaders-inspired game** on the visible 3D handheld. Keyboard and mouse/touch controls provide tactile feedback; Exit restores the configurator view and settings.
- Responsive desktop/mobile presentation, reduced-motion support and Reset.

## Technology

Vanilla JavaScript, Vite, Three.js (GLTFLoader, OrbitControls and CanvasTexture), Blender/Python and GLB assets. Tests use Node’s built-in test runner and Playwright. Version control is Git/GitHub; deployment is Vercel.

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

On Linux systems missing browser libraries, use `npx playwright install --with-deps chromium`. Browser tests use Playwright-managed Chromium; no locally installed Chrome is required. SwiftShader flags enable software WebGL for reproducible headless checks, not native-GPU performance benchmarks.

## Project references

- [Moodboard and visual direction](moodboard/README.md): Take/Ignore notes, palette, Syne/IBM Plex Sans typography, spacing, materials and lighting.
- [Project plan and handover](PLAN.md).
- [Contributor instructions](AGENTS.md).
- [AI-assisted development process](AI_PROCESS.md).
- [Game implementation and controls](src/play/README.md).

## Credits and licences

The handheld is an original retro-inspired model, authored with Blender/Python for this project. Its source is `scripts/create-retro-handheld.py`; the Blender file and exported GLB are included. AI-assisted development and critical revisions are summarised in AI_PROCESS.md.

Moodboard images are **inspiration only**, not original project artwork or a grant of reuse rights. Known attribution is retained; unknown sources are explicitly marked in the moodboard. Existing brands and game names belong to their respective owners; this is an independent student project, not an official branded product.

Syne and IBM Plex Sans are distributed under the SIL Open Font License; licence texts are included in `public/fonts/`. Three.js and Vite use the MIT licence; Playwright uses Apache-2.0. Other dependencies retain their own licences. No blanket licence for third-party reference images is implied.
