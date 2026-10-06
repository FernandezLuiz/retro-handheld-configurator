import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createHandheldController } from '../src/scene/handheld.js'
import { MODEL_PARTS } from '../src/scene/model-parts.js'
import { palettes, defaults, finishes, scenes, editions, selectedEdition, updateSelection, resolveConfiguration } from '../src/configuration.js'
import { centerModel } from '../src/scene/model-utils.js'

async function fixture() {
  const data = await fs.readFile(new URL('../public/models/retro-handheld.glb', import.meta.url))
  const { scene } = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')
  const meshes = {}
  scene.traverse(mesh => { if (mesh.isMesh) meshes[mesh.name] = mesh })
  const controller = createHandheldController()
  return { scene, meshes, controller }
}

function snapshot(meshes) {
  return Object.fromEntries(Object.entries(meshes).map(([name, mesh]) => [name, mesh.material.toJSON()]))
}

test('every color option changes exactly its mapped GLB meshes', async () => {
  const { scene, meshes, controller } = await fixture()
  const names = Object.keys(meshes)
  controller.attach(scene)
  for (const [part, palette] of Object.entries(palettes)) {
    for (const option of palette) {
      controller.applyConfiguration(resolveConfiguration(defaults))
      const before = snapshot(meshes)
      controller.applyConfiguration(resolveConfiguration({ ...defaults, [part]: option.name }))
      for (const [name, mesh] of Object.entries(meshes)) {
        if (MODEL_PARTS[part].includes(name)) assert.equal(mesh.material.color.getHexString(), option.value.slice(1))
        else assert.deepEqual(mesh.material.toJSON(), before[name], `${part}/${option.name} changed ${name}`)
      }
    }
  }
  assert.deepEqual(Object.keys(meshes), names)
  assert.equal(new Set(Object.values(meshes).map(mesh => mesh.material)).size, Object.keys(meshes).length)
})

test('finishes only affect body/back panel and Reset restores all defaults', async () => {
  const { scene, meshes, controller } = await fixture()
  controller.attach(scene)
  const original = snapshot(meshes)
  for (const finish of Object.keys(finishes)) {
    controller.applyConfiguration(resolveConfiguration({ ...defaults, material: finish }))
    for (const [name, mesh] of Object.entries(meshes)) {
      if (MODEL_PARTS.body.includes(name)) {
        assert.ok(mesh.material.isMeshPhysicalMaterial)
        assert.ok(Object.hasOwn(mesh.material.defines, 'PHYSICAL'))
        for (const [property, value] of Object.entries(finishes[finish])) assert.equal(mesh.material[property], value)
      } else assert.deepEqual(mesh.material.toJSON(), original[name])
    }
  }
  controller.applyConfiguration(resolveConfiguration({ body: 'Ink', buttons: 'Moss', dpad: 'Clay', screen: 'Amber', material: 'Translucent' }))
  controller.applyConfiguration(resolveConfiguration(defaults))
  assert.deepEqual(snapshot(meshes), original)
})

test('loading preserves queued selections, GLB mesh names, geometry and textures', async () => {
  const { scene, meshes, controller } = await fixture()
  const before = Object.fromEntries(Object.entries(meshes).map(([name, mesh]) => [name, { geometry: mesh.geometry, map: mesh.material.map }]))
  controller.applyConfiguration(resolveConfiguration({ ...defaults, screen: 'Blue-grey', material: 'Glossy' }))
  controller.attach(scene)
  assert.equal(meshes.screen.material.color.getHexString(), '708b96')
  assert.equal(meshes.body.material.clearcoat, 1)
  for (const [name, mesh] of Object.entries(meshes)) {
    assert.equal(mesh.name, name)
    assert.equal(mesh.geometry, before[name].geometry)
    if (name === 'screen' && !before[name].map) {
      assert.ok(mesh.material.map.isDataTexture)
      assert.ok(mesh.geometry.attributes.uv)
    } else assert.equal(mesh.material.map, before[name].map)
  }
  const centered = centerModel(scene)
  const box = new THREE.Box3().setFromObject(centered)
  assert.ok(box.getCenter(new THREE.Vector3()).length() < 1e-6)
  assert.ok(Math.abs(box.getSize(new THREE.Vector3()).y - 3) < 1e-6)
  // The display faces +Z after Blender's Y-up export, toward our default camera.
  assert.ok(new THREE.Box3().setFromObject(meshes.screen).getCenter(new THREE.Vector3()).z > 0)
})


test('internals stay inside the shell and are visible only in Translucent mode', async () => {
  const { scene, meshes, controller } = await fixture()
  controller.attach(scene)
  const internals = Object.values(meshes).filter(mesh => mesh.name.startsWith('internal_'))
  assert.equal(internals.length, 14)
  const bodyBox = new THREE.Box3().setFromObject(meshes.body).union(new THREE.Box3().setFromObject(meshes.back_panel))
  for (const mesh of internals) {
    assert.equal(mesh.visible, false)
    assert.ok(bodyBox.containsBox(new THREE.Box3().setFromObject(mesh)), mesh.name)
  }
  for (const finish of ['Translucent', 'Glossy', 'Translucent', 'Matte']) {
    controller.applyConfiguration(resolveConfiguration({ ...defaults, material: finish }))
    for (const mesh of internals) assert.equal(mesh.visible, finish === 'Translucent')
    assert.equal(meshes.body.material.opacity, 1)
    assert.equal(meshes.body.material.transparent, false)
  }
})

test('every edition resolves product settings; fine-tuning and Reset stay synchronized', async () => {
  const { scene, meshes, controller } = await fixture()
  for (const [name, expected] of Object.entries(editions)) {
    let selection = updateSelection(defaults, { type: 'edition', value: name })
    assert.deepEqual(selection, { ...expected, scene: defaults.scene })
    assert.equal(selectedEdition(selection), name)
    assert.ok(scenes[selection.scene])
    controller.applyConfiguration(resolveConfiguration(selection))
    controller.attach(scene)
    assert.equal(meshes.screen.material.color.getHexString(), resolveConfiguration(selection).colors.screen.slice(1))
    assert.equal(meshes.internal_pcb.visible, selection.material === 'Translucent')
    selection = updateSelection(selection, { type: 'option', key: 'screen', value: selection.screen === 'Amber' ? 'Dark' : 'Amber' })
    assert.equal(selectedEdition(selection), null)
    selection = updateSelection(selection, { type: 'reset' })
    assert.deepEqual(selection, defaults)
    assert.equal(selectedEdition(selection), 'Classic')
  }
})


test('editions and scenes remain independent in all combinations', () => {
  for (const scene of Object.keys(scenes)) {
    for (const [name, product] of Object.entries(editions)) {
      let selection = updateSelection({ ...defaults, scene }, { type: 'edition', value: name })
      assert.deepEqual(selection, { ...product, scene })
      assert.equal(selectedEdition(selection), name)
      for (const nextScene of Object.keys(scenes)) {
        const changed = updateSelection(selection, { type: 'option', key: 'scene', value: nextScene })
        assert.deepEqual(changed, { ...product, scene: nextScene })
        assert.equal(selectedEdition(changed), name)
      }
      for (const key of ['body', 'buttons', 'dpad', 'screen', 'material']) {
        const options = key === 'material' ? Object.keys(finishes) : palettes[key].map(color => color.name)
        const value = options.find(value => value !== selection[key])
        const custom = updateSelection(selection, { type: 'option', key, value })
        assert.equal(selectedEdition(custom), null, `${name}: ${key}`)
        assert.equal(custom.scene, scene)
        const changedScene = updateSelection(custom, { type: 'option', key: 'scene', value: 'Arcade' })
        assert.equal(selectedEdition(changedScene), null)
        assert.deepEqual(updateSelection(changedScene, { type: 'reset' }), defaults)
      }
    }
  }
})


test('refined asset preserves configurable names and stays within web geometry budget', async () => {
  const { scene, meshes } = await fixture()
  const required = ['body', 'screen_bezel', 'screen', 'dpad', 'button_a', 'button_b', 'start_button', 'select_button', 'speaker', 'back_panel', 'side_buttons', 'screws']
  for (const name of required) assert.ok(meshes[name], name)
  let triangles = 0
  for (const mesh of Object.values(meshes)) {
    assert.ok(mesh.position.length() < 1e-7)
    assert.ok(mesh.scale.distanceTo(new THREE.Vector3(1, 1, 1)) < 1e-7)
    assert.ok(mesh.quaternion.angleTo(new THREE.Quaternion()) < 1e-7)
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3
    assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite))
  }
  assert.ok(triangles < 40_000)
  assert.ok((await fs.stat(new URL('../public/models/retro-handheld.glb', import.meta.url))).size < 1_500_000)
  assert.ok(meshes.screen_glass.material.transmission > 0)
  const bounds = new THREE.Box3().setFromObject(scene)
  assert.ok(bounds.getCenter(new THREE.Vector3()).length() < 1e-6)
})


test('Atomic uses wall-scale refraction without a double-sided transmission pass', async () => {
  const { scene, meshes, controller } = await fixture()
  controller.attach(scene)
  controller.applyConfiguration(resolveConfiguration({ ...defaults, ...editions.Atomic }))
  for (const name of ['body', 'back_panel']) {
    const material = meshes[name].material
    assert.equal(material.side, THREE.FrontSide, `${name}: no back-face feedback pass`)
    assert.equal(material.depthWrite, true)
    assert.equal(material.transparent, false)
    assert.equal(material.opacity, 1)
    assert.ok(material.thickness >= 0.001 && material.thickness <= 0.0035, 'thickness is in GLB meters, before normalization')
    assert.ok(material.roughness >= 0.25 && material.transmission < 0.85)
    assert.equal(material.clearcoat, 0)
  }
  assert.equal(meshes.screen_glass.material.side, THREE.FrontSide)
})
