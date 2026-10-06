import test from 'node:test'
import * as THREE from 'three'
import assert from 'node:assert/strict'
import { createEnvironmentGroup, disposeEnvironmentGroup } from '../src/scene/environments.js'
import { scenes } from '../src/configuration.js'

for (const [name, preset] of Object.entries(scenes)) {
  test(`${name}: genuine geometry, bounded budget and resource disposal`, () => {
    const group = createEnvironmentGroup(name, preset)
    let triangles = 0
    const resources = new Set()
    group.traverse(object => {
      if (object.geometry) {
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.count ?? 1)
        resources.add(object.geometry)
      }
      if (object.material) {
        resources.add(object.material)
        for (const value of Object.values(object.material)) if (value?.isTexture) resources.add(value)
      }
    })
    assert.ok(triangles > 50 && triangles < 14000, `${triangles} triangles`)
    assert.ok(group.userData.fog)
    const disposed = new Set()
    for (const resource of resources) resource.addEventListener('dispose', () => disposed.add(resource))
    disposeEnvironmentGroup(group)
    assert.equal(group.children.length, 0)
    assert.equal(disposed.size, resources.size)
  })
}


test('environment props leave a clear normal orbit and sightlines around the hero', () => {
  for (const [name, preset] of Object.entries(scenes)) {
    const group = createEnvironmentGroup(name, preset)
    group.updateMatrixWorld(true)
    const obstacles = []
    group.traverse(object => {
      if (!object.isMesh) return
      let node = object.parent
      while (node && node !== group) {
        if (node.userData.orbitObstacle) { obstacles.push(object); break }
        node = node.parent
      }
    })
    for (const object of obstacles) {
      const bounds = new THREE.Box3().setFromObject(object)
      const nearest = bounds.clampPoint(new THREE.Vector3(0, 0, 0), new THREE.Vector3())
      assert.ok(Math.hypot(nearest.x, nearest.z) >= 6.6, `${name}/${object.name} enters safe orbit`)
    }
    // Normal camera elevations and a complete turn. No prop or wall can block
    // the central product at its top, center, or lower controls.
    for (let step = 0; step < 24; step++) {
      const angle = step / 24 * Math.PI * 2
      for (const height of [0.25, 1.1, 2.0]) {
        const origin = new THREE.Vector3(Math.sin(angle) * 6.2, height, Math.cos(angle) * 6.2)
        for (const targetY of [-1.3, 0, 1.3]) {
          const target = new THREE.Vector3(0, targetY, 0)
          const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize(), 0, origin.distanceTo(target) - 0.1)
          assert.equal(ray.intersectObjects(obstacles, false).length, 0, `${name}: blocked orbit ${step}`)
        }
      }
    }
    disposeEnvironmentGroup(group)
  }
})

test('Arcade attract details animate in place and honor reduced motion', () => {
  const group = createEnvironmentGroup('Arcade', scenes.Arcade)
  const cabinet = group.getObjectByName('arcade_cabinet')
  const scan = cabinet.userData.scan
  const display = cabinet.userData.displayMaterial
  let objects = 0
  group.traverse(() => objects++)
  group.userData.animate(0, false)
  const first = [scan.position.y, display.emissiveIntensity]
  group.userData.animate(1, false)
  assert.notDeepEqual([scan.position.y, display.emissiveIntensity], first)
  group.userData.animate(4, true)
  const still = [scan.position.y, display.emissiveIntensity]
  group.userData.animate(8, true)
  assert.deepEqual([scan.position.y, display.emissiveIntensity], still)
  let after = 0
  group.traverse(() => after++)
  assert.equal(after, objects)
  disposeEnvironmentGroup(group)
})
