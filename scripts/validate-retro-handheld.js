import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const bytes = await fs.readFile(new URL('../public/models/retro-handheld.glb', import.meta.url))
const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
const meshes = []
scene.traverse(mesh => { if (mesh.isMesh) meshes.push(mesh) })
const previous = ['body', 'screen_bezel', 'screen', 'dpad', 'button_a', 'button_b', 'start_button', 'select_button', 'speaker', 'back_panel', 'side_buttons', 'screws', 'internal_pcb', 'internal_battery', 'internal_chip_main', 'internal_chip_power', 'internal_speaker', 'internal_posts', 'internal_ribbon', 'internal_traces']
for (const name of previous) assert.ok(meshes.some(mesh => mesh.name === name), name)
const report = {
  meshes: meshes.map(mesh => ({mesh: mesh.name, material: mesh.material.name, slots: 1, status: previous.includes(mesh.name) ? 'modified' : 'added'})),
  triangles: meshes.reduce((count, mesh) => count + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0),
  dimensionsMeters: new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()).toArray(),
  bytes: bytes.length,
  validation: 'GLTFLoader parse and all 20 previous mesh names preserved. See npm test and npm run test:browser for control and UI validation.',
}
await fs.writeFile(new URL('./retro-handheld-validation.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
console.log(`${report.triangles} triangles; ${report.bytes} bytes; ${meshes.length} meshes`)
