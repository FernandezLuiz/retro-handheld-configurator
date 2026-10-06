import * as THREE from 'three'
import { createLCDTexture } from './screen-surface.js'
import { MODEL_PARTS } from './model-parts.js'
import { defaults, finishes, resolveConfiguration } from '../configuration.js'

export function createHandheldController() {
  let parts = Object.fromEntries(Object.keys(MODEL_PARTS).map(part => [part, []]))
  let screenTexture = null
  let screenGlow = 0.3
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
      material.needsUpdate = true
    }
  }

  return {
    attach(model) {
      parts = Object.fromEntries(Object.keys(MODEL_PARTS).map(part => [part, []]))
      internals = []
      const replaced = new Set()
      const retained = new Set()
      model.traverse(mesh => {
        if (!mesh.isMesh) return
        if (mesh.name.startsWith('internal_')) internals.push(mesh)
        const part = Object.keys(MODEL_PARTS).find(part => MODEL_PARTS[part].includes(mesh.name))
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        const clones = materials.map(original => {
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
            material.transparent = false
            material.opacity = 1
            material.depthWrite = true
          }
          if (part === 'screen') {
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
