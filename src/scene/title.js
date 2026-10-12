import * as THREE from 'three'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'

// A camera-composed, real extruded sign, shaded by the active scene environment.
// Its safe-area placement is independent of the user's product orbit and zoom.
export function createTitle(scene, onReady = () => {}) {
  const group = new THREE.Group()
  group.name = 'GameBoy_title'
  scene.add(group)
  let disposed = false
  let mesh
  const materials = [
    new THREE.MeshStandardMaterial({ color: '#536446', emissive: '#b3c3a7', emissiveIntensity: 0, roughness: .46, metalness: .16 }),
    new THREE.MeshStandardMaterial({ color: '#59654b', emissive: '#b3c3a7', emissiveIntensity: 0, roughness: .38, metalness: .22 }),
  ]
  new FontLoader().load('/fonts/syne-title.json', font => {
    if (disposed) return
    const geometry = new TextGeometry('GameBoy', {
      font, size: 1, depth: .16,
      curveSegments: 6, bevelEnabled: true, bevelThickness: .012,
      bevelSize: .009, bevelSegments: 2,
    })
    geometry.center()
    mesh = new THREE.Mesh(geometry, materials)
    mesh.name = 'GameBoy_lettering'
    group.add(mesh)
    onReady()
  }, undefined, () => { /* The accessible HTML title remains visible on failure. */ })

  function update(camera, progress, elapsed = 0, reducedMotion = false) {
    group.visible = progress < .12
    if (!mesh) return
    const distance = 3
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance
    const halfWidth = halfHeight * camera.aspect
    const box = mesh.geometry.boundingBox
    // Leave generous room for bevels, perspective depth and narrow phone screens.
    const scale = Math.min(halfWidth * 1.05 / (box.max.x - box.min.x), halfHeight * .17 / (box.max.y - box.min.y))
    group.scale.setScalar(scale)
    group.position.set(0, halfHeight * .8, -distance).applyQuaternion(camera.quaternion).add(camera.position)
    group.quaternion.copy(camera.quaternion)
    const drift = reducedMotion ? 0 : Math.sin(elapsed * 0.42)
    mesh.rotation.set(.10 + drift * .004, -.14 + drift * .008, -.015)
    materials.forEach((material, index) => { material.emissiveIntensity = reducedMotion ? 0 : .012 + Math.max(0, Math.sin(elapsed * .52 - index * .7)) * .018 })
    group.updateMatrixWorld(true)
  }
  return {
    update,
    inspect(camera) {
      if (!mesh) return { ready: false }
      const box = new THREE.Box3().setFromObject(mesh)
      const points = []
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z).project(camera))
      return { ready: true, visible: group.visible, bounds: { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)) } }
    },
    dispose() {
      disposed = true
      mesh?.geometry.dispose()
      materials.forEach(material => material.dispose())
      group.removeFromParent()
    },
  }
}
