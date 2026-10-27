# AI-assisted development process

This summary records actual project iterations, not reconstructed prompt transcripts. AI produced implementation drafts; user feedback, source inspection and tests determined what was kept or revised.

## 1. From sneaker to original handheld

- **Feedback / goal:** Replace the sneaker concept with an original retro handheld without rebuilding the configurator.
- **AI output:** A Blender Python generator, GLB asset and mappings for named body, screen and control meshes.
- **Critical revision / validation:** Preserve independent materials and existing controls rather than assume mesh names. GLTFLoader inspection and colour/material tests verified the exported structure and configuration mapping.

## 2. Environments guided by references

- **Feedback / goal:** Background colours alone felt too primitive; Arcade needed stronger depth and atmosphere.
- **AI output:** Lightweight scene groups, unbranded arcade cabinets, original screen visuals and restrained animation in the shared render loop.
- **Critical revision / validation:** Use moodboard lighting and composition without copying brands. Environment tests check geometry budgets, repeated switching, resource stability and Scene/Edition independence; browser views were inspected.

## 3. Repairing shell assembly

- **Feedback / goal:** Screenshots exposed side hardware intersections and gaps around the rear battery door.
- **AI output:** Focused revisions to the existing Blender generator: backed recesses, seated hardware, a closed gasket seam and corrected wheel geometry.
- **Critical revision / validation:** Prefer assembly fixes over a new model. Blender topology checks, GLB raycast/clearance regression tests and browser inspection from front, sides and rear verified the repair, including Translucent mode.

## 4. Physical controls and accurate instructions

- **Feedback / goal:** Controls should feel tactile, and game instructions must match the actual bindings.
- **AI output:** Raycast-based physical button interaction, temporary press transforms and shared binding definitions for instructions and input.
- **Critical revision / validation:** Intercept control presses before OrbitControls and restore transforms on release/cancellation. Browser tests exercise advertised keys, independent presses and mobile touch cancellation.

## 5. Playing on the visible handheld

- **Feedback / goal:** The fullscreen game overlay detached gameplay from the product.
- **AI output:** Whole-handheld Play framing, a live screen texture, physical game input and a lighter HUD/library treatment.
- **Critical revision / validation:** Restore the exact camera/configuration on exit and suppress display glare only during play. A quick-tap test caught clicks lost between simulation frames; input was revised to consume each physical tap at least once. Tests cover held/simultaneous inputs, both games, restart, exit, repeated-session resources and listener cleanup. Desktop/mobile screenshots were reviewed.

## Submission checks

`npm test`, `npm run test:browser` and `npm run build` are the reproducible verification commands. Playwright uses its managed Chromium installation. Test failures are investigated rather than treated as permission to redesign unrelated systems. Remaining unknown moodboard sources are documented honestly.
