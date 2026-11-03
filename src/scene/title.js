import * as THREE from 'three'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'

// A camera-composed, real extruded sign, clear of the product's head in the default
// view and behind it in depth when zooming in. Each scene relights it in its own way.
const SIGNS = {
  Arcade: { face: ['#2a0a24', '#ff2fa8', 1.45, .35, 0], side: ['#160a2c', '#8f4dff', .32, .4, .1], flicker: .07 },
  Studio: { face: ['#20221e', '#000000', 0, .32, .05], side: ['#3b3e37', '#000000', 0, .5, 0], flicker: 0 },
  'Retro Desk': { face: ['#e9d8b4', '#ffb36b', .22, .42, 0], side: ['#3a241c', '#000000', 0, .6, 0], flicker: 0 },
  'Dark Tech': { face: ['#dbe9ee', '#59e1ff', .45, .3, .35], side: ['#0d2c3a', '#25d9f0', .35, .4, .4], flicker: .02 },
}
export function createTitle(scene, onReady = () => {}) {
  const group = new THREE.Group()
  group.name = 'GameBoy_title'
  scene.add(group)
  let disposed = false
  let mesh
  const materials = [
    new THREE.MeshStandardMaterial({ fog: false }),
    new THREE.MeshStandardMaterial({ fog: false }),
  ]
  let sign = SIGNS.Arcade
  function setScene(name) {
    sign = SIGNS[name] ?? SIGNS.Arcade
    ;[sign.face, sign.side].forEach(([color, emissive, intensity, roughness, metalness], index) => {
      Object.assign(materials[index], { roughness, metalness, emissiveIntensity: intensity })
      materials[index].color.set(color)
      materials[index].emissive.set(emissive)
    })
  }
  new FontLoader().load('/fonts/syne-title.json', font => {
    if (disposed) return
    const geometry = new TextGeometry('GameBoy', {
      font, size: 1, depth: .26,
      curveSegments: 6, bevelEnabled: true, bevelThickness: .014,
      bevelSize: .011, bevelSegments: 2,
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
    const distance = camera.position.length() + 1.15
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance
    const halfWidth = halfHeight * camera.aspect
    const box = mesh.geometry.boundingBox
    // Bold but breathing: the sign fills the band between the framed product's head
    // and the top of the view, leaving a clear gap above the handheld.
    const portrait = camera.aspect < .8
    const floor = portrait ? .71 : .685
    const scale = Math.min(halfWidth * (portrait ? 1.72 : 1.6) / (box.max.x - box.min.x), halfHeight * (.895 - floor) / (box.max.y - box.min.y))
    group.scale.setScalar(scale)
    const center = floor + (box.max.y - box.min.y) * scale / halfHeight / 2
    group.position.set(0, halfHeight * center, -distance).applyQuaternion(camera.quaternion).add(camera.position)
    group.quaternion.copy(camera.quaternion)
    const drift = reducedMotion ? 0 : Math.sin(elapsed * 0.42)
    mesh.rotation.set(.03 + drift * .004, -.05 + drift * .012, 0)
    // Neon strikes on, then holds a faint mains flicker.
    const strike = reducedMotion ? 1 : Math.min(1, elapsed / .9)
    const stutter = strike < 1 && Math.sin(elapsed * 46) > .1 ? .25 : 1
    const flicker = reducedMotion ? 1 : 1 - sign.flicker * (Math.sin(elapsed * 9.1) * Math.sin(elapsed * 3.3) > .6 ? 1 : .15)
    materials[0].emissiveIntensity = sign.face[2] * strike * stutter * flicker
    materials[1].emissiveIntensity = sign.side[2] * strike * flicker
    group.updateMatrixWorld(true)
  }
  return {
    update,
    setScene,
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
