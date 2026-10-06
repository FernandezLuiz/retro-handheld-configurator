import * as THREE from 'three'

// Shown while the handheld loads, or when the GLB is unavailable.
export function createPlaceholder() {
  const geometry = new THREE.TorusKnotGeometry(1.05, 0.32, 160, 32)
  const material = new THREE.MeshStandardMaterial({
    color: '#c5cbbb', roughness: 0.48, metalness: 0.12,
  })
  const model = new THREE.Mesh(geometry, material)
  model.rotation.set(0.25, -0.3, 0.15)
  return model
}
