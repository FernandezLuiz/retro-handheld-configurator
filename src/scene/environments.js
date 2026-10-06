import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const TOP = -1.62
// Tall props and architecture stay outside the ordinary ~6.3-unit camera orbit.
export const SAFE_ORBIT_RADIUS = 6.6
const matte = (color, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.25 })
const glow = (color, strength = 0.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: 0.55, envMapIntensity: 0.1 })

function mesh(parent, name, geometry, material, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material)
  object.name = name
  object.position.set(...position)
  parent.add(object)
  return object
}
function box(parent, name, size, position, material, radius = 0) {
  return mesh(parent, name, radius ? new RoundedBoxGeometry(...size, 1, radius) : new THREE.BoxGeometry(...size), material, position)
}
function cylinder(parent, name, radius, height, position, material, segments = 24, topRadius = radius) {
  return mesh(parent, name, new THREE.CylinderGeometry(topRadius, radius, height, segments), material, position)
}
function bar(parent, name, a, b, radius, material) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b)
  const object = cylinder(parent, name, radius, start.distanceTo(end), start.clone().add(end).multiplyScalar(0.5).toArray(), material, 10)
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize())
  return object
}
function place(parent, name, x, y, z, rotation = 0) {
  const group = new THREE.Group()
  group.name = name
  group.position.set(x, y, z)
  group.rotation.y = rotation
  group.userData.orbitObstacle = true
  parent.add(group)
  return group
}
function point(group, color, intensity, position, distance = 14) {
  const light = new THREE.PointLight(color, intensity, distance, 2)
  light.position.set(...position)
  group.add(light)
  return light
}
function instances(parent, name, size, positions, material, radius = 0) {
  const geometry = radius ? new RoundedBoxGeometry(...size, 1, radius) : new THREE.BoxGeometry(...size)
  const object = new THREE.InstancedMesh(geometry, material, positions.length)
  object.name = name
  positions.forEach((position, i) => object.setMatrixAt(i, new THREE.Matrix4().makeTranslation(...position)))
  object.computeBoundingBox()
  object.computeBoundingSphere()
  parent.add(object)
  return object
}
function surface(kind, base, repeat = [1, 1]) {
  const size = 128, data = new Uint8Array(size * size * 4)
  const rgb = new THREE.Color(base).getHex()
  const color = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255]
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const noise = ((x * 73 + y * 139 + x * y * 19) % 31) / 31 - 0.5
    let offset = noise * 3
    if (kind === 'wood') offset += Math.sin(y * 1.1 + Math.sin(x * 0.043) * 1.1) * 3 + Math.sin(y * 0.15) * 5
    if (kind === 'brushed') offset += Math.sin(y * 2.3) * 3
    if (kind === 'fabric') offset += ((x + y) % 2) * 2
    if (kind === 'carpet') {
      const dx = x % 32 - 16, dy = y % 32 - 16
      const d = Math.abs(dx) + Math.abs(dy)
      if (d > 11 && d < 13 && dx * dy > 0) offset += 14
      if ((x + 9) % 32 < 2 && (y + 4) % 32 < 6) offset += 8
    }
    data.set([...color.map(c => Math.max(0, Math.min(255, c + offset))), 255], (y * size + x) * 4)
  }
  const map = new THREE.DataTexture(data, size, size)
  map.name = `${kind}_surface`
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(...repeat)
  map.generateMipmaps = true
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.magFilter = THREE.LinearFilter
  map.needsUpdate = true
  return new THREE.MeshStandardMaterial({ map, roughness: kind === 'brushed' ? 0.52 : 0.88, metalness: kind === 'brushed' ? 0.55 : 0, envMapIntensity: 0.22 })
}
function shadow(parent, x, y, z, width, depth, opacity = 0.22) {
  const size = 32, data = new Uint8Array(size * size * 4)
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const distance = Math.hypot((col + 0.5) / size * 2 - 1, (row + 0.5) / size * 2 - 1)
    data[(row * size + col) * 4 + 3] = Math.round(Math.max(0, 1 - distance) ** 1.8 * 255)
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  const object = mesh(parent, 'soft_contact_shadow', new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ color: '#080b0a', map: texture, transparent: true, opacity, depthWrite: false }), [x, y, z])
  object.rotation.x = -Math.PI / 2
}
function room(group, floorY, wallMat, floorMat, ceiling = false) {
  box(group, 'room_floor', [30, 0.16, 30], [0, floorY - 0.08, 0], floorMat)
  const architecture = place(group, 'room_architecture', 0, 0, 0)
  box(architecture, 'rear_wall', [24, 10, 0.3], [0, floorY + 5, -11.8], wallMat)
  for (const x of [-11.8, 11.8]) box(architecture, 'side_wall', [0.3, 10, 24], [x, floorY + 5, 0], wallMat)
  // A front wall provides a designed background when orbiting behind the hero.
  box(architecture, 'front_wall', [24, 10, 0.3], [0, floorY + 5, 11.8], wallMat)
  if (ceiling) box(group, 'ceiling', [24, 0.12, 24], [0, 8.2, 0], matte('#090c11'))
  const skirting = matte('#272b2b')
  for (const z of [-11.58, 11.58]) box(group, 'wall_skirting', [23.2, 0.17, 0.07], [0, floorY + 0.085, z], skirting)
}

function studio(group) {
  // A 360-degree seamless cove keeps walls outside the normal orbit. No visible
  // softbox meshes: the existing PMREM studio reflection map supplies softboxes.
  const sections = [[0, TOP], [8.5, TOP]]
  for (let i = 1; i <= 20; i++) {
    const angle = i / 20 * Math.PI / 2
    sections.push([8.5 + 2.5 * Math.sin(angle), TOP + 2.5 * (1 - Math.cos(angle))])
  }
  sections.push([11, 9])
  const positions = [], indices = [], segments = 96
  sections.forEach(([radius, y]) => {
    for (let j = 0; j <= segments; j++) {
      const a = j / segments * Math.PI * 2
      positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius)
    }
  })
  for (let row = 0; row < sections.length - 1; row++) for (let j = 0; j < segments; j++) {
    const a = row * (segments + 1) + j, b = a + segments + 1
    indices.push(a, b + 1, b, a, a + 1, b + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // A quiet tonal sweep in the cove, without an extra transparent backdrop.
  const tones = []
  for (let i = 0; i < positions.length; i += 3) {
    const tone = new THREE.Color('#e2e3de').lerp(new THREE.Color('#c3c7c2'), THREE.MathUtils.smoothstep(positions[i + 1], TOP, 7) * 0.55)
    tones.push(tone.r, tone.g, tone.b)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(tones, 3))
  const material = matte('#ffffff', 0.76)
  material.vertexColors = true
  material.side = THREE.DoubleSide
  mesh(group, 'continuous_studio_cyclorama', geometry, material)
  shadow(group, 0, TOP + 0.006, 0, 2.7, 1.35, 0.22)
  shadow(group, 0, TOP + 0.008, 0, 1.6, 0.7, 0.13)
  // Wall reveals are deliberately distant and only emerge at oblique angles.
  for (const x of [-8.8, 8.8]) box(group, 'distant_studio_reveal', [0.035, 6, 0.06], [x, 2, -6.7], matte('#c5c8c2'))
}

function keyboard(parent, materials) {
  box(parent, 'keyboard_lower_shell', [3.1, 0.18, 1.22], [0, 0.09, 0], materials.dark, 0.05)
  box(parent, 'keyboard_upper_shell', [3.08, 0.19, 1.20], [0, 0.21, 0], materials.cream, 0.055)
  box(parent, 'key_recess', [2.89, 0.015, 1.00], [0, 0.312, 0], materials.dark, 0.02)
  const positions = []
  for (let row = 0; row < 4; row++) for (let col = 0; col < 13; col++) positions.push([(col - 6) * 0.205, 0.36, (row - 1.5) * 0.205 - 0.08])
  instances(parent, 'rounded_keycaps', [0.178, 0.09, 0.175], positions, materials.keys, 0.022)
  box(parent, 'spacebar', [1.25, 0.08, 0.16], [0, 0.35, 0.42], materials.keys, 0.025)
  box(parent, 'keyboard_indicator', [0.05, 0.012, 0.025], [1.38, 0.314, -0.44], glow('#b0bb85', 0.2))
}
function desk(group) {
  const walnut = surface('wood', '#715039', [3, 2]), edge = matte('#533c2a'), brass = surface('brushed', '#82745a')
  const plaster = surface('fabric', '#ada492', [6, 3])
  const m = { cream: matte('#b0a995'), keys: matte('#c5bfae'), dark: matte('#292e29'), green: matte('#4a5a4b') }
  room(group, -5.1, plaster, surface('wood', '#504439', [5, 5]))
  box(group, 'solid_walnut_desktop', [18, 0.28, 10.8], [0, TOP - 0.14, -4.5], walnut, 0.06)
  box(group, 'rounded_desktop_edge', [18.02, 0.12, 0.11], [0, TOP - 0.19, 0.93], edge, 0.035)
  // Tapered mid-century legs and modest drawers, all below the orbit plane.
  for (const x of [-7.5, 7.5]) for (const z of [-8.4, -0.1]) {
    cylinder(group, 'tapered_desk_leg', 0.13, 3.2, [x, TOP - 1.9, z], edge, 12, 0.22)
    cylinder(group, 'brass_leg_shoe', 0.14, 0.24, [x, -4.98, z], brass, 12)
  }
  for (const x of [-6.8, 6.8]) {
    box(group, 'drawer_carcass', [3.1, 1.15, 4.1], [x, TOP - 0.9, -2.8], walnut, 0.05)
    for (const y of [TOP - 0.65, TOP - 1.15]) {
      box(group, 'drawer_face', [2.95, 0.43, 0.13], [x, y, -0.69], edge, 0.025)
      box(group, 'drawer_pull', [0.75, 0.05, 0.10], [x, y, -0.57], brass, 0.02)
    }
  }
  box(group, 'felt_presentation_pad', [3.6, 0.025, 2.3], [0, TOP + 0.012, -0.2], surface('fabric', '#62675a', [4, 3]), 0.07)
  shadow(group, 0, TOP + 0.028, 0, 2.9, 1.5, 0.26)
  const keys = place(group, 'retro_keyboard', -4.8, TOP, -7.3, 0.12)
  keyboard(keys, m)
  shadow(group, -4.8, TOP + 0.005, -7.3, 3.6, 1.7, 0.3)
  const cassette = place(group, 'cassette_tape', -3.15, TOP, -6.8, -0.17)
  box(cassette, 'tape_case', [1.2, 0.14, 0.77], [0, 0.07, 0], m.dark, 0.035)
  box(cassette, 'paper_label', [1.05, 0.008, 0.42], [0, 0.145, -0.04], m.cream, 0.015)
  box(cassette, 'tape_window', [0.67, 0.012, 0.23], [0, 0.15, -0.04], m.dark, 0.01)
  for (const x of [-0.24, 0.24]) {
    cylinder(cassette, 'reel_hub', 0.087, 0.018, [x, 0.16, -0.04], m.keys, 16)
    cylinder(cassette, 'reel_center', 0.035, 0.023, [x, 0.17, -0.04], m.dark, 12)
  }
  for (const x of [-0.51, 0.51]) for (const z of [-0.28, 0.28]) cylinder(cassette, 'tape_screw', 0.018, 0.015, [x, 0.145, z], brass, 8)
  const notebook = place(group, 'notebook_and_pencil', 1.75, TOP, -8.0, -0.16)
  box(notebook, 'book_lower_cover', [1.65, 0.035, 2.05], [0, 0.02, 0], m.green, 0.025)
  box(notebook, 'book_page_block', [1.57, 0.14, 1.98], [0.025, 0.10, 0], m.keys, 0.018)
  for (const y of [0.055, 0.095, 0.135]) box(notebook, 'page_edge_reveal', [1.52, 0.008, 0.01], [0.025, y, 0.993], matte('#a49a84'))
  box(notebook, 'book_cover', [1.65, 0.04, 2.05], [0, 0.19, 0], m.green, 0.03)
  box(notebook, 'book_spine', [0.095, 0.19, 2.04], [-0.79, 0.11, 0], m.green, 0.025)
  box(notebook, 'elastic_bookmark', [0.055, 0.006, 2.06], [0.56, 0.215, 0], m.dark)
  bar(notebook, 'wood_pencil', [-0.45, 0.25, -0.7], [0.5, 0.25, 0.65], 0.022, matte('#a07a42'))
  shadow(group, 1.75, TOP + 0.005, -8.0, 2, 2.4)
  const lamp = place(group, 'vintage_desk_lamp', 3.25, TOP, -8.1)
  cylinder(lamp, 'weighted_lamp_base', 0.55, 0.12, [0, 0.06, 0], m.green, 32)
  cylinder(lamp, 'base_inlay', 0.38, 0.016, [0, 0.13, 0], brass)
  bar(lamp, 'lamp_stem', [0, 0.14, 0], [0, 1.95, 0], 0.045, brass)
  bar(lamp, 'lamp_arm', [0, 1.95, 0], [-0.58, 2.28, 0], 0.05, brass)
  const shade = mesh(lamp, 'bell_lamp_shade', new THREE.LatheGeometry([new THREE.Vector2(0.65, -0.22), new THREE.Vector2(0.63, -0.18), new THREE.Vector2(0.55, -0.05), new THREE.Vector2(0.39, 0.12), new THREE.Vector2(0.23, 0.22)], 32), m.green, [-0.58, 2.28, 0])
  shade.material.side = THREE.DoubleSide
  cylinder(lamp, 'frosted_lamp_diffuser', 0.58, 0.025, [-0.58, 2.06, 0], glow('#e7c593', 0.5))
  const shadeLip = mesh(lamp, 'rolled_shade_lip', new THREE.TorusGeometry(0.64, 0.014, 6, 32), brass, [-0.58, 2.06, 0])
  shadeLip.rotation.x = Math.PI / 2
  cylinder(lamp, 'lamp_switch', 0.035, 0.055, [0.25, 0.16, 0.1], m.dark, 12)
  point(group, '#ffd5a1', 18, [2.67, TOP + 1.95, -8.1])
  shadow(group, 3.25, TOP + 0.005, -8.1, 1.5, 1.2, 0.3)
  const clock = place(group, 'analog_desk_clock', -1.0, TOP, -9)
  box(clock, 'clock_body', [1.25, 1.25, 0.42], [0, 0.65, 0], edge, 0.14)
  const dial = cylinder(clock, 'clock_dial', 0.49, 0.035, [0, 0.67, 0.23], m.keys, 48)
  dial.rotation.x = Math.PI / 2
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6
    const tick = box(clock, 'clock_tick', [0.025, 0.085, 0.015], [Math.sin(a) * 0.405, 0.67 + Math.cos(a) * 0.405, 0.26], m.dark)
    tick.rotation.z = -a
  }
  const hand = box(clock, 'hour_hand', [0.035, 0.27, 0.025], [-0.08, 0.74, 0.28], m.dark)
  hand.rotation.z = -0.85
  const minute = box(clock, 'minute_hand', [0.025, 0.39, 0.02], [0.04, 0.85, 0.29], m.dark)
  minute.rotation.z = -0.2
  const mug = place(group, 'ceramic_mug', 5.2, TOP, -7.7)
  const cup = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.25, 0), new THREE.Vector2(0.31, 0.6), new THREE.Vector2(0.27, 0.61), new THREE.Vector2(0.23, 0.07), new THREE.Vector2(0, 0.07)], 24)
  mesh(mug, 'ceramic_cup', cup, matte('#8d9984'))
  const handle = mesh(mug, 'mug_handle', new THREE.TorusGeometry(0.18, 0.045, 8, 18), matte('#8d9984'), [0.3, 0.32, 0])
  handle.rotation.y = Math.PI / 2
  const art = place(group, 'framed_abstract_print', -4.5, 1.8, -11.56)
  box(art, 'walnut_picture_frame', [3.6, 3.3, 0.12], [0, 0, 0], edge, 0.025)
  box(art, 'print_paper', [3.36, 3.06, 0.018], [0, 0, 0.07], matte('#c1b59b'))
  box(art, 'abstract_color_block', [1.5, 1.65, 0.008], [-0.5, -0.22, 0.085], matte('#6d7c67'))
  const circle = cylinder(art, 'abstract_sun', 0.64, 0.01, [0.5, 0.55, 0.09], matte('#b48157'), 40)
  circle.rotation.x = Math.PI / 2
  const shelf = place(group, 'wall_shelf', 3.8, 1.5, -11.2)
  box(shelf, 'shelf_board', [4.7, 0.16, 0.9], [0, 0, 0], walnut, 0.025)
  for (const x of [-1.65, 1.65]) {
    bar(shelf, 'shelf_bracket', [x, -0.08, 0.28], [x, -0.65, -0.3], 0.025, brass)
    box(shelf, 'bracket_wall_mount', [0.09, 0.72, 0.06], [x, -0.3, -0.34], brass, 0.012)
  }
  // Wall battens imply a window outside the hero's clear orbit.
  for (let i = 0; i < 7; i++) box(group, 'warm_wall_batten', [0.065, 5.5, 0.09], [7.1 + i * 0.35, 1.4, -11.59], edge, 0.012)
  for (let i = 0; i < 6; i++) box(shelf, 'shelf_book', [0.25, 0.95 + i % 2 * 0.15, 0.5], [-1.6 + i * 0.29, 0.57, 0], i % 2 ? m.green : m.cream, 0.025)
}

function crtMaterial(color, variant) {
  const size = 64, data = new Uint8Array(size * size * 4)
  const ink = new THREE.Color(color)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grid = y > 32 && ((y % 8 === 0) || ((x + Math.floor(y / 4)) % 16 === 0))
    const horizon = Math.abs(y - 28) < 1
    const orb = Math.abs(Math.hypot(x - (variant ? 42 : 22), y - 19) - 8) < 1.2
    const value = (orb || horizon ? 0.65 : grid ? 0.22 : 0.028) * (y % 2 ? 0.76 : 1)
    data.set([ink.r * value * 255, ink.g * value * 255, ink.b * value * 255, 255], (y * size + x) * 4)
  }
  const map = new THREE.DataTexture(data, size, size)
  map.magFilter = THREE.LinearFilter
  map.needsUpdate = true
  return new THREE.MeshStandardMaterial({ color: '#080e19', roughness: 0.36, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 1.6, envMapIntensity: 0.08 })
}
function cabinet(parent, x, z, rotation, color, variant = 0) {
  const machine = place(parent, 'arcade_cabinet', x, TOP, z, rotation)
  const shell = matte(variant ? '#17172c' : '#26172c', 0.64), edge = matte('#0b0b18'), accent = glow(color, 0.9), panel = matte('#332b45', 0.48)
  // A profiled side silhouette: sloping monitor, extended control deck and hood.
  const shape = new THREE.Shape()
  shape.moveTo(-0.68, 0); shape.lineTo(0.62, 0); shape.lineTo(0.62, 1.7)
  shape.lineTo(0.96, 1.98); shape.lineTo(0.94, 2.18); shape.lineTo(0.38, 2.35)
  shape.lineTo(0.04, 3.75); shape.lineTo(0.43, 3.85); shape.lineTo(0.43, 4.4)
  shape.lineTo(-0.68, 4.4); shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1.65, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 1 })
  geometry.rotateY(-Math.PI / 2)
  geometry.translate(0.825, 0, 0)
  mesh(machine, 'profiled_cabinet_shell', geometry, shell)
  box(machine, 'cabinet_foot', [1.66, 0.12, 1.30], [0, 0.06, -0.02], edge, 0.04)
  box(machine, 'coin_door_frame', [0.58, 0.68, 0.06], [0, 0.84, 0.66], edge, 0.025)
  box(machine, 'coin_door', [0.49, 0.58, 0.03], [0, 0.84, 0.7], panel, 0.02)
  box(machine, 'coin_slot', [0.17, 0.027, 0.025], [0, 1.02, 0.723], matte('#06080c'))
  box(machine, 'coin_return', [0.16, 0.09, 0.03], [0, 0.64, 0.73], edge, 0.01)
  const screen = new THREE.Group()
  screen.position.set(0, 3.05, 0.33)
  screen.rotation.x = -0.23
  machine.add(screen)
  machine.scale.set(variant ? 0.94 : 1, variant ? 1.07 : 1, 1)
  box(screen, 'crt_surround', [1.47, 1.33, 0.14], [0, 0, 0], edge, 0.08)
  const displayMaterial = crtMaterial(color, variant)
  box(screen, 'curved_crt_glass', [1.2, 1.03, 0.12], [0, 0, 0.09], displayMaterial, 0.08)
  // Original abstract display marks: restrained vector-like graphics, no artwork.
  const marks = []
  for (let i = 0; i < 5; i++) marks.push([-0.40 + i * 0.18, -0.24 + (i % 3) * 0.17, 0.155])
  instances(screen, 'screen_vector_marks', [0.09, 0.10, 0.008], marks, accent)
  box(screen, 'screen_status_line', [0.82, 0.018, 0.009], [0, 0.33, 0.155], accent)
  const scan = box(screen, 'screen_attract_scan', [0.95, 0.014, 0.009], [0, -0.29, 0.158], accent)
  const deck = box(machine, 'sloped_control_deck', [1.55, 0.13, 0.64], [0, 2.13, 0.68], panel, 0.035)
  deck.rotation.x = 0.12
  bar(machine, 'joystick_shaft', [-0.4, 2.18, 0.68], [-0.4, 2.44, 0.68], 0.03, matte('#656972', 0.3, 0.7))
  mesh(machine, 'joystick_ball', new THREE.SphereGeometry(0.105, 16, 10), matte(color, 0.28), [-0.4, 2.45, 0.68])
  for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) cylinder(machine, 'action_button', 0.065, 0.045, [0.12 + col * 0.18, 2.23, 0.54 + row * 0.20], matte(color, 0.3), 16)
  box(machine, 'marquee_frame', [1.50, 0.39, 0.10], [0, 4.12, 0.43], edge, 0.025)
  box(machine, 'frosted_marquee', [1.34, 0.25, 0.025], [0, 4.12, 0.495], accent, 0.015)
  const marqueePixels = [[-0.48, 4.12, 0.513], [-0.24, 4.12, 0.513], [0.02, 4.12, 0.513], [0.28, 4.12, 0.513], [0.49, 4.12, 0.513]]
  instances(machine, 'abstract_marquee_pixels', [0.12, 0.035, 0.01], marqueePixels, glow('#e6f4ff', 0.75))
  for (const side of [-0.83, 0.83]) box(machine, 'cabinet_edge_trim', [0.025, 1.45, 0.045], [side, 0.84, 0.635], accent)
  shadow(parent, x, TOP + 0.005, z, 2.7, 2.4, 0.38)
  machine.userData.displayMaterial = displayMaterial
  machine.userData.accentMaterial = accent
  machine.userData.scan = scan
  return machine
}
function arcadeGlowMap() {
  const size = 48, pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1)
    const offset = (y * size + x) * 4
    pixels.set([255, 255, 255, Math.round(Math.max(0, 1 - radius) ** 2 * 255)], offset)
  }
  const map = new THREE.DataTexture(pixels, size, size)
  map.minFilter = map.magFilter = THREE.LinearFilter
  map.needsUpdate = true
  return map
}
function arcade(group) {
  const carpet = surface('carpet', '#130d23', [12, 12])
  room(group, TOP, matte('#130e23'), carpet, true)
  shadow(group, 0, TOP + 0.005, 0, 3, 1.7, 0.32)

  // A clear aisle leads the eye into two staggered rows, with the product
  // occupying the quiet foreground. Cabinets stay outside the camera orbit.
  const violet = glow('#9e54de', 0.95), cyan = glow('#38c7e3', 0.85), pink = glow('#ef4aaf', 0.9)
  box(group, 'recessed_arcade_aisle', [5.6, 0.006, 8.8], [0, TOP + 0.004, -6], matte('#171128', 0.85))
  for (const x of [-2.85, 2.85]) box(group, 'aisle_edge_light', [0.022, 0.008, 8.6], [x, TOP + 0.012, -6], x < 0 ? pink : cyan)
  for (const z of [-3.1, -4.8, -6.5, -8.2, -9.9]) box(group, 'aisle_grid_reveal', [5.65, 0.006, 0.014], [0, TOP + 0.012, z], violet)
  const cabinets = [
    cabinet(group, -7.6, -3.9, 0.26, '#c160e7'),
    cabinet(group, 7.6, -3.9, -0.26, '#42d7e7', 1),
    cabinet(group, -4.6, -7.3, 0.16, '#e366bc', 1),
    cabinet(group, 4.6, -7.3, -0.16, '#688bff'),
    cabinet(group, -3.0, -9.7, 0.06, '#55ccdc'),
    cabinet(group, 3.0, -9.7, -0.06, '#da68d8', 1),
  ]

  // The ceiling and wall light channels create depth without filling the
  // central viewing axis with props or branded signage.
  for (const z of [-11.5, 11.5]) {
    box(group, 'wall_dado', [23, 1.25, 0.08], [0, TOP + 0.63, z], matte('#201429'))
    box(group, 'wall_light_channel', [23, 0.16, 0.10], [0, 2.95, z], matte('#090915'))
    box(group, 'wall_neon_line', [22.8, 0.04, 0.12], [0, 2.96, z + (z < 0 ? 0.03 : -0.03)], pink)
  }
  for (const x of [-9.5, 9.5]) {
    box(group, 'ceiling_light_housing', [0.25, 0.09, 18], [x, 6.9, 0], matte('#080c18'), 0.02)
    box(group, 'ceiling_diffuser', [0.07, 0.025, 17.5], [x, 6.84, 0], cyan)
    for (const z of [-6.5, 6.5]) bar(group, 'ceiling_fixture_suspension', [x, 6.945, z], [x, 8.14, z], 0.022, matte('#252a34', 0.55, 0.3))
  }
  for (const z of [-9.5, -6.4, -3.3]) {
    box(group, 'ceiling_neon_channel', [18, 0.12, 0.24], [0, 7.05, z], matte('#090817'))
    box(group, 'ceiling_neon_diffuser', [17.7, 0.025, 0.08], [0, 6.98, z], z === -6.4 ? cyan : pink)
  }
  box(group, 'upper_neon_seam', [21.7, 0.045, 0.13], [0, 5.15, -11.45], violet)
  for (const x of [-11.5, 11.5]) for (const z of [-9, -5, -1, 3]) {
    box(group, 'sidewall_light_reveal', [0.045, 3.6, 0.06], [x, 1.2, z], x < 0 ? violet : cyan)
  }
  const haloMap = arcadeGlowMap()
  const halos = [
    new THREE.MeshBasicMaterial({ color: '#bb2eab', map: haloMap, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: '#267bda', map: haloMap, transparent: true, opacity: 0.39, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  ]
  mesh(group, 'magenta_wall_halo', new THREE.PlaneGeometry(10, 5.8), halos[0], [-5.8, 3.6, -11.48])
  mesh(group, 'cyan_wall_halo', new THREE.PlaneGeometry(10, 5.8), halos[1], [3.8, 3.6, -11.48])
  const portal = place(group, 'abstract_arcade_portal', 3.5, 3.45, -11.5)
  box(portal, 'portal_recess', [3.3, 2.3, 0.07], [0, 0, 0], matte('#0a0a1d'), 0.08)
  const ring = mesh(portal, 'portal_neon_ring', new THREE.TorusGeometry(0.66, 0.035, 6, 40), cyan, [0, 0, 0.08])
  box(portal, 'portal_horizontal_mark', [1.7, 0.025, 0.02], [0, -0.8, 0.09], violet)
  const lights = [
    point(group, '#e346a5', 28, [-6.9, 3.2, -5.6], 17),
    point(group, '#33afd5', 28, [6.9, 3.2, -5.6], 17),
    point(group, '#ad54ed', 18, [0, 6.7, -8.8], 17),
  ]
  point(group, '#bc59b5', 10, [-4.2, 3.1, 1.7], 8)
  point(group, '#4bbbe3', 10, [4.2, 3.1, 1.7], 8)
  group.userData.animate = (time, reducedMotion) => {
    const t = reducedMotion ? 0 : time
    cabinets.forEach((machine, i) => {
      const { displayMaterial, accentMaterial, scan } = machine.userData
      displayMaterial.emissiveIntensity = 1.45 + (reducedMotion ? 0 : 0.2 * Math.sin(t * 1.35 + i * 1.2))
      accentMaterial.emissiveIntensity = 0.9 + (reducedMotion ? 0 : 0.12 * Math.sin(t * 0.9 + i * 0.8))
      scan.position.y = reducedMotion ? -0.29 : -0.29 + (t * 0.12 + i * 0.13) % 0.58
    })
    pink.emissiveIntensity = 0.9 + (reducedMotion ? 0 : 0.1 * Math.sin(t * 0.62))
    cyan.emissiveIntensity = 0.85 + (reducedMotion ? 0 : 0.08 * Math.sin(t * 0.74 + 1.1))
    violet.emissiveIntensity = 0.95 + (reducedMotion ? 0 : 0.08 * Math.sin(t * 0.53 + 2))
    halos[0].opacity = 0.34 + (reducedMotion ? 0 : 0.025 * Math.sin(t * 0.63))
    halos[1].opacity = 0.39 + (reducedMotion ? 0 : 0.025 * Math.sin(t * 0.73 + 1))
    lights.forEach((light, i) => { light.intensity = [28, 28, 18][i] * (reducedMotion ? 1 : 1 + 0.08 * Math.sin(t * 0.65 + i * 1.3)) })
    ring.rotation.z = reducedMotion ? 0 : t * 0.035
  }
}

function tech(group) {
  const graphite = surface('brushed', '#20272b', [1, 5]), metal = surface('brushed', '#3b4549', [1, 8])
  const black = matte('#0b1116', 0.78), seam = matte('#080c10'), diffuser = glow('#9fc4c9', 0.5)
  room(group, TOP - 0.46, matte('#111a21', 0.83), surface('brushed', '#1c252b', [4, 7]), true)
  // A low chamfered presentation platform, with a recessed base and reveal.
  cylinder(group, 'plinth_lower_base', 1.61, 0.12, [0, TOP - 0.39, 0], black, 64)
  mesh(group, 'plinth_main_body', new THREE.LatheGeometry([
    new THREE.Vector2(1.61, -0.36), new THREE.Vector2(1.70, -0.33),
    new THREE.Vector2(1.73, -0.28), new THREE.Vector2(1.73, -0.10),
    new THREE.Vector2(1.66, -0.05),
  ], 64), graphite, [0, TOP, 0])
  cylinder(group, 'plinth_top_plate', 1.66, 0.025, [0, TOP - 0.035, 0], metal, 64)
  const rim = mesh(group, 'plinth_inset_light_ring', new THREE.TorusGeometry(1.63, 0.007, 6, 64), glow('#88b8c0', 0.3), [0, TOP - 0.37, 0])
  rim.rotation.x = Math.PI / 2
  shadow(group, 0, TOP - 0.02, 0, 3.1, 1.8, 0.35)
  // Wall bays have several physical depths: rails, backing, panel and inset.
  for (const z of [-10.5, 10.5]) for (const x of [-7.2, -3.6, 0, 3.6, 7.2]) {
    const bay = place(group, 'layered_lab_wall_bay', x, TOP - 0.46, z, z > 0 ? Math.PI : 0)
    box(bay, 'panel_backing', [3.45, 6.5, 0.12], [0, 3.25, 0], seam)
    for (const dx of [-1.63, 1.63]) box(bay, 'vertical_technical_rail', [0.09, 6.5, 0.25], [dx, 3.25, 0.10], metal, 0.012)
    box(bay, 'beveled_upper_panel', [3.14, 3.95, 0.18], [0, 4.15, 0.14], graphite, 0.055)
    box(bay, 'recessed_lower_panel', [3.02, 2.05, 0.09], [0, 1.08, 0.08], black, 0.04)
    box(bay, 'horizontal_panel_joint', [3.17, 0.065, 0.19], [0, 2.17, 0.2], seam)
    box(bay, 'recessed_light_channel', [0.11, 3.15, 0.035], [-1.1, 4.15, 0.245], black, 0.012)
    box(bay, 'frosted_linear_diffuser', [0.029, 3.0, 0.02], [-1.1, 4.15, 0.267], diffuser)
    // Offset machining lines break up the repeated wall bays without added props.
    for (const y of [3.1, 5.4]) box(bay, 'panel_machined_reveal', [1.45, 0.012, 0.009], [0.42, y, 0.236], seam)
    const positions = Array.from({ length: 9 }, (_, i) => [-0.65 + i * 0.16, 1.10, 0.143])
    instances(bay, 'recessed_vent_slots', [0.055, 0.55, 0.014], positions, seam)
    for (const dx of [-1.3, 1.3]) {
      const screw = cylinder(bay, 'panel_fastener', 0.032, 0.018, [dx, 2.65, 0.244], metal, 10)
      screw.rotation.x = Math.PI / 2
    }
  }
  for (const x of [-10.9, 10.9]) {
    box(group, 'structural_side_column', [0.45, 8, 0.6], [x, 2, -3.4], graphite, 0.045)
    box(group, 'sidewall_recess', [0.08, 3.6, 6], [x, 1.6, 1.5], black)
    bar(group, 'protected_service_conduit', [x * 0.96, -1.3, -7], [x * 0.96, -1.3, 6], 0.04, metal)
  }
  const console = place(group, 'lab_status_module', -6.8, TOP - 0.46, -6.2, 0.2)
  box(console, 'status_module_housing', [1.3, 1.35, 0.7], [0, 0.675, 0], graphite, 0.065)
  box(console, 'status_recess', [0.9, 0.40, 0.035], [0, 1.02, 0.37], black, 0.025)
  for (let i = 0; i < 4; i++) box(console, 'abstract_status_light', [0.095, 0.016, 0.012], [-0.27 + i * 0.18, 1.02, 0.40], i === 0 ? diffuser : matte('#3b5056'))
  for (const x of [-8.8, 8.8]) {
    box(group, 'overhead_rail', [0.34, 0.16, 18], [x, 6.7, 0], graphite, 0.03)
    box(group, 'overhead_recessed_light', [0.06, 0.022, 16], [x, 6.60, 0], diffuser)
    for (const z of [-7.5, 7.5]) bar(group, 'rail_ceiling_support', [x, 6.78, z], [x, 8.14, z], 0.035, metal)
  }
  point(group, '#a6c9d4', 20, [-7, 4.5, -5.4], 18)
}

export function createEnvironmentGroup(name, preset) {
  const group = new THREE.Group()
  group.name = `environment:${name}`
  group.userData.environment = true
  group.userData.safeOrbitRadius = SAFE_ORBIT_RADIUS
  const ambient = new THREE.HemisphereLight('#ffffff', preset.ground, name === 'Studio' ? 0.85 : name === 'Retro Desk' ? 0.7 : 0.32)
  // Focus the dark-room key on the product: unlike a directional light this
  // falls off before reaching cabinets/panels, so their practical lights read.
  const key = preset.dark
    ? new THREE.SpotLight(preset.key, preset.light * 40, 22, 0.5, 0.85, 2)
    : new THREE.DirectionalLight(preset.key, preset.light)
  key.name = 'product_key'
  key.position.set(3, 5, 4)
  const fill = new THREE.DirectionalLight(preset.fill, name === 'Studio' ? 0.72 : 0.48)
  fill.position.set(-4, 2, 3)
  const rim = new THREE.DirectionalLight(name === 'Dark Tech' ? '#b6d6df' : preset.fill, name === 'Studio' ? 0.6 : 1.1)
  rim.position.set(-3, 3, -4)
  group.add(ambient, key, fill, rim)
  const builders = { Studio: studio, 'Retro Desk': desk, Arcade: arcade, 'Dark Tech': tech }
  builders[name](group)
  group.userData.fog = new THREE.Fog(preset.background, 15, 38)
  return group
}

export function disposeEnvironmentGroup(group) {
  const resources = new Set()
  group.traverse(object => {
    if (object.geometry) resources.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue
      resources.add(material)
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value)
    }
    if (object.isInstancedMesh) object.dispose()
  })
  resources.forEach(resource => resource.dispose())
  group.removeFromParent()
  group.clear()
}
