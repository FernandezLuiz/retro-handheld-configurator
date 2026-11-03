import * as THREE from 'three'
import { createLCDTexture } from './screen-surface.js'
import { MODEL_PARTS } from './model-parts.js'
import { defaults, finishes, resolveConfiguration } from '../configuration.js'

// Moulded-plastic micro-grain, carried by the shell's planar UVs from Blender.
function createGrainTexture() {
  const size = 64, data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const a = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, b = Math.sin(x * 39.346 + y * 11.135) * 24634.6345
    data.set([128 + (a - Math.floor(a) - .5) * 90, 128 + (b - Math.floor(b) - .5) * 90, 255, 255], (y * size + x) * 4)
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.name = 'shell_micro_grain'
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}
// Electronics glow softly through the frosted shell, as in the translucent reference.
const INTERNAL_GLOW = { internal_traces: ['#6dffd6', 3.2], internal_contacts: ['#9dffe4', 1.6], internal_solder: ['#6dffd6', .35] }

export function createHandheldController() {
  let parts = Object.fromEntries(Object.keys(MODEL_PARTS).map(part => [part, []]))
  let screenTexture = null
  let screenGlow = 0.55
  let internals = []
  let current = resolveConfiguration(defaults)

  function applyConfiguration(configuration) {
    current = { colors: { ...configuration.colors }, material: configuration.material }
    for (const [part, materials] of Object.entries(parts)) {
      materials.forEach(material => material.color.set(current.colors[part]))
    }
    for (const material of parts.screen) {
      material.emissive.copy(material.color)
      material.emissiveIntensity = 0.025
      if (screenTexture) { material.emissive.set('#ffffff'); material.emissiveIntensity = screenGlow }
    }
    internals.forEach(mesh => { mesh.visible = current.material === 'Translucent' })
    for (const material of parts.body) {
      Object.assign(material, finishes[current.material])
      material.normalScale.setScalar(current.material === 'Matte' ? .22 : .025)
      material.needsUpdate = true
    }
  }

  return {
    attach(model) {
      parts = Object.fromEntries(Object.keys(MODEL_PARTS).map(part => [part, []]))
      internals = []
      const replaced = new Set()
      const retained = new Set()
      const grain = createGrainTexture()
      model.traverse(mesh => {
        if (!mesh.isMesh) return
        if (mesh.name.startsWith('internal_')) internals.push(mesh)
        if (INTERNAL_GLOW[mesh.name]) {
          mesh.material.emissive.set(INTERNAL_GLOW[mesh.name][0])
          mesh.material.emissiveIntensity = INTERNAL_GLOW[mesh.name][1]
        }
        const part = Object.keys(MODEL_PARTS).find(part => MODEL_PARTS[part].includes(mesh.name))
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        const clones = materials.map(original => {
          if (mesh.name === 'screen_glass') {
            // The LCD already has its own shaded surface. A low-glare cover
            // avoids two strong reflections washing out the live OS texture.
            const glass = original.clone()
            glass.roughness = 0.025
            glass.ior = 1.25
            glass.specularIntensity = 0.35
            glass.envMapIntensity = 0.3
            replaced.add(original)
            return glass
          }
          if (!part) { retained.add(original); return original }
          // Keep maps and colors; body uses PhysicalMaterial for transmission/coating.
          const material = part === 'body' ? new THREE.MeshPhysicalMaterial() : original.clone()
          if (part === 'body') {
            THREE.MeshStandardMaterial.prototype.copy.call(material, original)
            // Standard.copy replaces defines; retain the physical shader for IOR/transmission.
            material.defines = { STANDARD: '', PHYSICAL: '' }
            // Closed, physically thick shells already contain their inner walls.
            // DoubleSide adds a second back-face transmission pass in Three.js,
            // feeding refracted controls back into the shell's refraction buffer.
            material.side = THREE.FrontSide
            if (mesh.geometry.attributes.uv) material.normalMap = grain
            material.transparent = false
            material.opacity = 1
            material.depthWrite = true
          }
          if (part === 'screen') {
            material.clearcoat = 0
            material.envMapIntensity = 0.25
            material.specularIntensity = 0.35
            if (screenTexture) { material.map = screenTexture; material.emissiveMap = screenTexture }
            else if (!material.map) material.map = createLCDTexture()
          }
          replaced.add(original)
          parts[part].push(material)
          return material
        })
        mesh.material = Array.isArray(mesh.material) ? clones : clones[0]
      })
      replaced.forEach(material => { if (!retained.has(material)) material.dispose() })
      applyConfiguration(current)
      for (const [part, materials] of Object.entries(parts)) {
        if (!materials.length) console.warn(`No configured handheld meshes found for ${part}.`)
      }
    },
    applyConfiguration,
    setScreenTexture(texture) {
      screenTexture = texture
      for (const material of parts.screen) {
        // Play Mode can switch between live canvas programs. Keep those reusable;
        // only the original static LCD texture is replaced and disposed here.
        if (material.map !== texture && !material.map?.isCanvasTexture) material.map?.dispose()
        material.map = texture
        material.emissiveMap = texture
        material.needsUpdate = true
      }
      applyConfiguration(current)
    },
    setScreenGlow(value) {
      screenGlow = value
      if (screenTexture) for (const material of parts.screen) material.emissiveIntensity = value
    },
  }
}
