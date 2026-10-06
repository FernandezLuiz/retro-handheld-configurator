import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { scenes } from '../configuration.js'
import { createEnvironmentGroup, disposeEnvironmentGroup } from './environments.js'

export function createEnvironment(renderer, scene, viewport) {
  const generator = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const reflection = generator.fromScene(room, 0.04)
  room.dispose()
  generator.dispose()
  scene.environment = reflection.texture
  const groups = new Map()
  let active
  let elapsed = 0

  function stats() {
    return [...groups].map(([name, group]) => {
      let meshes = 0, triangles = 0, objects = 0
      group.traverse(object => {
        objects++
        if (!object.isMesh) return
        meshes++
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1)
      })
      return { name, uuid: group.uuid, visible: group.visible, meshes, triangles, objects }
    })
  }
  return {
    setPreset(name) {
      if (active === name || !scenes[name]) return
      const preset = scenes[name]
      if (!groups.has(name)) {
        const group = createEnvironmentGroup(name, preset)
        groups.set(name, group)
        scene.add(group)
      }
      // Retain at most one group per preset. Invisible groups hide their lights too.
      for (const [key, group] of groups) group.visible = key === name
      active = name
      elapsed = 0
      scene.background = new THREE.Color(preset.background)
      scene.fog = groups.get(name).userData.fog
      scene.environmentIntensity = preset.environment
      viewport.style.backgroundColor = preset.background
      viewport.dataset.mood = preset.dark ? 'dark' : 'light'
      viewport.dataset.scene = name
    },
    update(dt, reducedMotion = false) {
      const group = groups.get(active)
      if (!group?.userData.animate) return
      if (!reducedMotion) elapsed += dt
      group.userData.animate(elapsed, reducedMotion)
    },
    stats,
    dispose() {
      scene.environment = null
      scene.background = null
      scene.fog = null
      for (const group of groups.values()) disposeEnvironmentGroup(group)
      groups.clear()
      reflection.dispose()
    },
  }
}
