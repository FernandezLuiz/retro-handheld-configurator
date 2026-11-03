import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

// Only true HDR emitters (neon, CRTs, the moon) clear the threshold, never lit plastic.
const BLOOM = { strength: .34, radius: .5, threshold: 1.15 }

function gpuName(renderer) {
  const gl = renderer.getContext()
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
}

// The premium pipeline (bloom, shadows, entrance motion) runs where a GPU can
// carry it. Software renderers get the plain path, and a real device that cannot
// hold its frame rate steps down once rather than stuttering. ?quality= overrides.
export function createQuality(renderer) {
  const requested = new URLSearchParams(window.location.search).get('quality')
  const software = /swiftshader|llvmpipe|software/i.test(gpuName(renderer))
  const high = requested ? requested === 'high' : !software
  let frames = 0, total = 0, degraded = false
  const pixelRatio = Math.min(window.devicePixelRatio, high ? 2 : 1.5)
  return {
    high,
    pixelRatio,
    createPipeline(scene, camera) {
      if (!high) return { render: () => renderer.render(scene, camera), setSize() {}, setPlayFocus() {}, setMood() {}, dispose() {} }
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
      const composer = new EffectComposer(renderer, target)
      const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM.strength, BLOOM.radius, BLOOM.threshold)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(bloom)
      composer.addPass(new OutputPass())
      let dark = true
      const syncBloom = () => { bloom.enabled = dark && !degraded }
      return {
        // Bright rooms have no emitters to bloom: the whole frame would glow instead.
        setMood(isDark) { dark = isDark; syncBloom() },
        degrade: syncBloom,
        render() { if (bloom.enabled) composer.render(); else renderer.render(scene, camera) },
        setSize(width, height) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(width, height) },
        // Keep the game on the LCD legible: most of the glow yields during play.
        setPlayFocus(amount) { bloom.strength = BLOOM.strength * (1 - amount * .7) },
        dispose() { composer.dispose(); target.dispose(); bloom.dispose() },
      }
    },
    sample(elapsed, pipeline) {
      if (!high || requested || degraded || !elapsed) return
      // An unfocused window is throttled by the browser, and long gaps are stalls:
      // neither says anything about this GPU, so they must not cost the look for good.
      if (elapsed > .25 || !document.hasFocus()) return
      total += elapsed
      if (++frames < 150) return
      if (total / frames > 1 / 28) {
        degraded = true
        pipeline.degrade?.()
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25))
      }
      frames = 0; total = 0
    },
    inspect() { return { high, degraded } },
  }
}
