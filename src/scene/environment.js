import * as THREE from 'three'
import { scenes } from '../configuration.js'
import { createEnvironmentGroup, disposeEnvironmentGroup } from './environments.js'

// Each scene gets its own reflection probe: emissive panels placed where that
// room's lights are, so glossy plastic visibly reflects the world it stands in.
const PROBES = {
  Studio: { room: ['#63665f', 1], panels: [[[0, 8, 2], [12, .2, 10], '#ffffff', 7], [[-9, 2, 4], [.2, 10, 3], '#ffffff', 9], [[9, 2, 2], [.2, 10, 1.4], '#ffffff', 11], [[0, 3, 10], [7, 5, .2], '#ffffff', 2.2], [[0, 2, -10], [16, 8, .2], '#ffffff', 1.2]] },
  'Retro Desk': { room: ['#21150e', 1], panels: [[[-5, 3, -10], [5, 5, .2], '#ff9c73', 7], [[7, 3, -8], [3, 3, .2], '#ffc88a', 11], [[-1, 5, 10], [9, 5, .2], '#fff1dd', 6], [[-9, 3, 0], [.2, 5, 4], '#8f7dff', 2.5], [[0, -6, 0], [16, .2, 16], '#6d4830', 1.4]] },
  Arcade: { room: ['#0c0618', 1], panels: [[[0, 8, -6], [7, .2, 10], '#ff2fa8', 9], [[-9, 2, -2], [.2, 5, 5], '#25d9f0', 9], [[9, 2, -3], [.2, 5, 4], '#ff4fc0', 8], [[0, 2, -10], [5, 5, .2], '#6fe0ff', 6], [[-1, 5, 10], [9, 5, .2], '#fffaf2', 7], [[0, -6, 0], [16, .2, 16], '#2a1640', 1.5]] },
  'Dark Tech': { room: ['#060b10', 1], panels: [[[-9, 3, -2], [.2, 8, .7], '#59e1ff', 26], [[9, 3, -2], [.2, 8, .7], '#3f7cff', 24], [[0, 3, -10], [5, 7, .2], '#2f9fe6', 2], [[-1, 5, 10], [8, 5, .2], '#f1f8ff', 6], [[0, 8, 0], [12, .2, 1], '#bdeaff', 10]] },
}
function probeScene(name) {
  const { room, panels } = PROBES[name]
  const probe = new THREE.Scene()
  const shared = new THREE.BoxGeometry(1, 1, 1)
  const shell = new THREE.Mesh(shared, new THREE.MeshBasicMaterial({ color: room[0], side: THREE.BackSide }))
  shell.scale.setScalar(24)
  probe.add(shell)
  for (const [position, size, color, intensity] of panels) {
    const panel = new THREE.Mesh(shared, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }))
    panel.position.set(...position)
    panel.scale.set(...size)
    probe.add(panel)
  }
  return probe
}

export function createEnvironment(renderer, scene, viewport) {
  const generator = new THREE.PMREMGenerator(renderer)
  const reflections = new Map()
  function reflectionFor(name) {
    if (!reflections.has(name)) {
      const probe = probeScene(name)
      reflections.set(name, generator.fromScene(probe, 0.03))
      probe.traverse(object => { object.geometry?.dispose(); object.material?.dispose() })
    }
    return reflections.get(name).texture
  }
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
      scene.environment = reflectionFor(name)
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
      reflections.forEach(reflection => reflection.dispose())
      reflections.clear()
      generator.dispose()
    },
  }
}
