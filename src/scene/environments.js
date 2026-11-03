import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

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
// A soft additive light shape: glows, halos and fake floor reflections.
function glowPlane(parent, name, map, color, opacity, size, position, flat = false) {
  const material = new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })
  const plane = mesh(parent, name, new THREE.PlaneGeometry(...size), material, position)
  if (flat) plane.rotation.x = -Math.PI / 2
  return plane
}
function room(group, floorY, wallMat, floorMat, ceiling = false, height = 10, ceilingY = 8.2) {
  box(group, 'room_floor', [30, 0.16, 30], [0, floorY - 0.08, 0], floorMat).receiveShadow = true
  const architecture = place(group, 'room_architecture', 0, 0, 0)
  box(architecture, 'rear_wall', [24, height, 0.3], [0, floorY + height / 2, -11.8], wallMat)
  for (const x of [-11.8, 11.8]) box(architecture, 'side_wall', [0.3, height, 24], [x, floorY + height / 2, 0], wallMat)
  // A front wall provides a designed background when orbiting behind the hero.
  box(architecture, 'front_wall', [24, height, 0.3], [0, floorY + height / 2, 11.8], wallMat)
  if (ceiling) box(group, 'ceiling', [24, 0.12, 24], [0, ceilingY, 0], matte('#090c11'))
  const skirting = matte('#272b2b')
  for (const z of [-11.58, 11.58]) box(group, 'wall_skirting', [23.2, 0.17, 0.07], [0, floorY + 0.085, z], skirting)
}

function studio(group) {
  // A photographer's seamless sweep: no walls, no seams, only a tonal falloff from
  // a bright pool behind the product to quiet edges. Softboxes live in the probe.
  const sections = [[0, TOP], [10.4, TOP]]
  for (let i = 1; i <= 20; i++) {
    const angle = i / 20 * Math.PI / 2
    sections.push([10.4 + 2.6 * Math.sin(angle), TOP + 2.6 * (1 - Math.cos(angle))])
  }
  sections.push([13, 12])
  const positions = [], indices = [], tones = [], segments = 96
  const floorTone = new THREE.Color('#c8c9c2'), wallTone = new THREE.Color('#9fa29a'), edgeTone = new THREE.Color('#878a83')
  sections.forEach(([radius, y]) => {
    for (let j = 0; j <= segments; j++) {
      const a = j / segments * Math.PI * 2
      positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius)
      const height = THREE.MathUtils.smoothstep(y, TOP, 6)
      const tone = floorTone.clone().lerp(wallTone, THREE.MathUtils.smoothstep(radius, 2, 11)).lerp(edgeTone, height)
      tones.push(tone.r, tone.g, tone.b)
    }
  })
  for (let row = 0; row < sections.length - 1; row++) for (let j = 0; j < segments; j++) {
    const a = row * (segments + 1) + j, b = a + segments + 1
    indices.push(a, b + 1, b, a, a + 1, b + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(tones, 3))
  geometry.computeVertexNormals()
  const material = matte('#ffffff', 0.62)
  material.vertexColors = true
  material.side = THREE.DoubleSide
  mesh(group, 'continuous_studio_cyclorama', geometry, material).receiveShadow = true
  // The product stands on a polished white riser that picks up the softboxes.
  const riserMaterial = new THREE.MeshPhysicalMaterial({ color: '#efeee8', roughness: .16, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.1 })
  const riser = cylinder(group, 'studio_riser', 1.34, .12, [0, TOP + .06, 0], riserMaterial, 72)
  riser.receiveShadow = true
  cylinder(group, 'studio_riser_foot', 1.28, .012, [0, TOP + .006, 0], matte('#55574f', .7), 72)
  shadow(group, 0, TOP + .007, .15, 3.9, 2.5, .46)
  shadow(group, 0, TOP + .124, .05, 2.3, .95, .58)
  const pool = arcadeGlowMap()
  glowPlane(group, 'backdrop_light_pool', pool, '#fffdf6', .3, [17, 8.4], [1.6, 2.6, -9.9])
  glowPlane(group, 'floor_light_pool', pool, '#fffdf6', .1, [12, 9], [0, TOP + .004, -3.2], true)
}

function keyboard(parent, materials) {
  box(parent, 'keyboard_lower_shell', [3.1, 0.18, 1.22], [0, 0.09, 0], materials.dark, 0.05)
  box(parent, 'keyboard_upper_shell', [3.08, 0.19, 1.20], [0, 0.21, 0], materials.cream, 0.055)
  box(parent, 'key_recess', [2.89, 0.015, 1.00], [0, 0.312, 0], materials.dark, 0.02)
  const positions = []
  for (let row = 0; row < 4; row++) for (let col = 0; col < 13; col++) positions.push([(col - 6) * 0.205, 0.36, (row - 1.5) * 0.205 - 0.08])
  instances(parent, 'keycaps', [0.178, 0.09, 0.175], positions, materials.keys)
  box(parent, 'spacebar', [1.25, 0.08, 0.16], [0, 0.35, 0.42], materials.keys, 0.025)
  box(parent, 'keyboard_indicator', [0.05, 0.012, 0.025], [1.38, 0.314, -0.44], glow('#b0bb85', 0.2))
}
function desk(group) {
  // Early evening at a home desk: dusk through the blinds, one warm lamp, one lit CRT.
  const walnut = surface('wood', '#6d4830', [3, 2]), edge = matte('#3f2b1d'), brass = surface('brushed', '#a08a5e')
  const plaster = surface('fabric', '#5a4332', [6, 3])
  const m = { cream: matte('#b4a98f'), keys: matte('#c5bda6'), dark: matte('#262320'), green: matte('#4f5f4d') }
  const halo = arcadeGlowMap()
  room(group, -5.1, plaster, surface('wood', '#3a2c22', [5, 5]), false, 16)
  box(group, 'solid_walnut_desktop', [18, 0.28, 10.8], [0, TOP - 0.14, -4.5], walnut, 0.06).receiveShadow = true
  box(group, 'rounded_desktop_edge', [18.02, 0.12, 0.11], [0, TOP - 0.19, 0.93], edge, 0.035)
  for (const x of [-7.5, 7.5]) for (const z of [-8.4, -0.1]) cylinder(group, 'tapered_desk_leg', 0.13, 3.2, [x, TOP - 1.9, z], edge, 10, 0.22)
  const pad = box(group, 'felt_presentation_pad', [3.5, 0.025, 2.3], [0, TOP + 0.012, -0.2], surface('fabric', '#39402f', [4, 3]), 0.07)
  pad.receiveShadow = true
  shadow(group, 0, TOP + 0.028, 0, 2.9, 1.5, 0.42)

  // Dusk window: the far light that gives the room its depth.
  const duskMap = pixelTexture(4, 64, (x, y) => {
    const t = y / 63, ramp = t < .5 ? [[255, 176, 96], [226, 96, 118]] : [[226, 96, 118], [58, 44, 112]]
    const f = t < .5 ? t * 2 : t * 2 - 1
    return ramp[0].map((value, i) => value + (ramp[1][i] - value) * f)
  }, 'dusk_sky', THREE.LinearFilter)
  const window_ = place(group, 'dusk_window', -4.3, 2.9, -11.56)
  box(window_, 'window_frame', [5.1, 5, .1], [0, 0, 0], edge)
  const sky = new THREE.MeshBasicMaterial({ map: duskMap, fog: false })
  sky.color.setScalar(1.15)
  mesh(window_, 'dusk_sky', new THREE.PlaneGeometry(4.7, 4.6), sky, [0, 0, .07])
  box(window_, 'window_mullion', [.07, 4.6, .05], [0, 0, .1], edge)
  const slats = Array.from({ length: 13 }, (_, i) => [0, 2.08 - i * .29, .13])
  instances(window_, 'venetian_blind_slats', [4.66, .1, .03], slats, matte('#2a1e18', .7))
  glowPlane(group, 'window_wall_glow', halo, '#ff9a6a', .3, [11, 9], [-4.3, 2.9, -11.4])
  glowPlane(group, 'window_desk_reflection', halo, '#ff8f70', .13, [5.5, 6.5], [-3.6, TOP + .004, -5.8], true)

  // A beige home computer with a lit phosphor screen.
  const crtMap = pixelTexture(64, 48, (x, y) => {
    const text = y > 6 && y < 40 && y % 5 < 2 && x > 6 && x < 22 + ((y * 37) % 34) && (x * 3 + y) % 7 > 1
    const glow = text ? [150, 255, 150] : [8, 34, 20]
    return glow.map(value => value * (y % 2 ? .78 : 1))
  }, 'crt_terminal')
  const computer = place(group, 'home_computer', -3.7, TOP, -9.6, .24)
  box(computer, 'computer_base', [2.5, .42, 2.1], [0, .21, 0], m.cream, .04)
  box(computer, 'floppy_slot', [.72, .05, .03], [.62, .24, 1.06], m.dark)
  box(computer, 'monitor_housing', [2.14, 1.82, 1.72], [0, 1.36, -.05], m.cream, .08)
  box(computer, 'monitor_bezel', [1.84, 1.5, .08], [0, 1.38, .84], matte('#7d7560'), .03)
  const terminal = new THREE.MeshPhysicalMaterial({ color: '#020402', roughness: .3, specularIntensity: .25, emissive: '#ffffff', emissiveMap: crtMap, emissiveIntensity: 1.5, envMapIntensity: .4, fog: false })
  mesh(computer, 'crt_terminal_screen', new THREE.PlaneGeometry(1.56, 1.2), terminal, [0, 1.38, .89])
  glowPlane(group, 'crt_desk_glow', halo, '#5dff9a', .13, [3.6, 3], [-3.3, TOP + .005, -7.7], true)
  const crtLight = point(group, '#79ffa8', 7, [-3.3, TOP + 1.4, -8], 6)

  // Foreground of the desk: keyboard, cartridges and a tape, set back from the orbit.
  const keys = place(group, 'retro_keyboard', -3.2, TOP, -7.5, 0.16)
  keyboard(keys, m)
  shadow(group, -3.2, TOP + 0.005, -7.5, 3.6, 1.7, 0.4)
  const carts = place(group, 'game_cartridge_stack', -.35, TOP, -8.4, -.3)
  ;[['#8f3d56', 0], ['#2f3a3f', .075], ['#c9b37c', .15]].forEach(([color, y], i) => {
    const cart = box(carts, 'game_cartridge', [.92, .07, 1.05], [i * .05, y + .035, i * -.03], matte(color, .55))
    cart.rotation.y = i * .12
  })
  const cassette = place(group, 'cassette_tape', 1.05, TOP, -7.45, -0.17)
  box(cassette, 'tape_case', [1.2, 0.14, 0.77], [0, 0.07, 0], m.dark)
  box(cassette, 'paper_label', [1.05, 0.008, 0.42], [0, 0.145, -0.04], m.cream)
  for (const x of [-0.24, 0.24]) cylinder(cassette, 'reel_hub', 0.087, 0.018, [x, 0.16, -0.04], m.keys, 12)
  const notebook = place(group, 'notebook_and_pencil', 1.9, TOP, -9.2, -0.16)
  box(notebook, 'book_lower_cover', [1.65, 0.035, 2.05], [0, 0.02, 0], m.green)
  box(notebook, 'book_page_block', [1.57, 0.14, 1.98], [0.025, 0.10, 0], m.keys)
  box(notebook, 'book_cover', [1.65, 0.04, 2.05], [0, 0.19, 0], m.green)
  bar(notebook, 'wood_pencil', [-0.45, 0.25, -0.7], [0.5, 0.25, 0.65], 0.022, matte('#a07a42'))
  shadow(group, 1.9, TOP + 0.005, -9.2, 2, 2.4, .36)

  // The lamp is the room's real practical: a visible pool on the desk and wall.
  const lamp = place(group, 'vintage_desk_lamp', 4.1, TOP, -9.1)
  cylinder(lamp, 'weighted_lamp_base', 0.55, 0.12, [0, 0.06, 0], m.green, 24)
  bar(lamp, 'lamp_stem', [0, 0.14, 0], [0, 1.95, 0], 0.045, brass)
  bar(lamp, 'lamp_arm', [0, 1.95, 0], [-0.58, 2.28, 0], 0.05, brass)
  const shade = mesh(lamp, 'bell_lamp_shade', new THREE.LatheGeometry([new THREE.Vector2(0.65, -0.22), new THREE.Vector2(0.63, -0.18), new THREE.Vector2(0.55, -0.05), new THREE.Vector2(0.39, 0.12), new THREE.Vector2(0.23, 0.22)], 24), m.green, [-0.58, 2.28, 0])
  shade.material.side = THREE.DoubleSide
  const bulb = glow('#ffcf8f', 3)
  bulb.fog = false
  cylinder(lamp, 'frosted_lamp_diffuser', 0.58, 0.025, [-0.58, 2.06, 0], bulb, 24)
  const lampLight = point(group, '#ffc88a', 34, [3.5, TOP + 1.9, -9.1], 11)
  glowPlane(group, 'lamp_desk_pool', halo, '#ffb066', .4, [7, 5.4], [3.5, TOP + .006, -8.4], true)
  glowPlane(group, 'lamp_wall_glow', halo, '#ffa95e', .22, [8, 7], [4, 1.4, -11.4])
  shadow(group, 4.1, TOP + 0.007, -9.1, 1.5, 1.2, 0.45)

  // Shelf with a warm under-glow: a second depth layer behind the lamp.
  const shelf = place(group, 'wall_shelf', 3.9, 2.5, -11.2)
  box(shelf, 'shelf_board', [5.2, 0.14, 0.9], [0, 0, 0], walnut)
  const strip = glow('#ffbe78', 2.2)
  strip.fog = false
  box(shelf, 'shelf_under_light', [4.9, .025, .05], [0, -.09, .3], strip)
  for (const x of [-2.2, 2.2]) box(shelf, 'bracket_wall_mount', [0.09, 0.72, 0.06], [x, -0.36, -0.34], brass)
  const spines = ['#8f3d56', '#b4a98f', '#4f5f4d', '#b9705b', '#2f3a3f', '#b4a98f', '#8f3d56', '#4f5f4d']
  spines.forEach((color, i) => box(shelf, 'shelf_book', [.25, .95 + (i * 3 % 4) * .1, .5], [-2.05 + i * .29, .55 + (i * 3 % 4) * .05, 0], matte(color, .75)))
  const plant = place(group, 'shelf_plant', 5.3, 2.57, -11.2)
  cylinder(plant, 'plant_pot', .22, .36, [0, .18, 0], matte('#b9705b', .7), 12, .3)
  for (let i = 0; i < 6; i++) {
    const leaf = box(plant, 'plant_leaf', [.09, .72, .025], [Math.cos(i * 1.05) * .14, .66, Math.sin(i * 1.05) * .14], m.green)
    leaf.rotation.set(Math.sin(i * 1.05) * .6, 0, -Math.cos(i * 1.05) * .6)
  }
  group.userData.animate = (time, reducedMotion) => {
    const t = reducedMotion ? 0 : time
    terminal.emissiveIntensity = 1.5 + (reducedMotion ? 0 : .06 * Math.sin(t * 7) + .05 * Math.sin(t * 1.3))
    crtMap.offset.y = reducedMotion ? 0 : Math.floor(t * 1.5) / 48
    crtLight.intensity = 7 + (reducedMotion ? 0 : .5 * Math.sin(t * 7))
    lampLight.intensity = 34 + (reducedMotion ? 0 : .8 * Math.sin(t * .9))
  }
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
// --- Arcade: a neon corridor with a moon at its vanishing point. Every cabinet
// shares merged template geometry, so the room costs few draw calls and stays
// outside the camera's orbit radius.
const CORRIDOR_END = -22
const ARCADE_CLEARANCE = 8.95
function pixelTexture(width, height, paint, name, filter = THREE.NearestFilter) {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [r, g, b] = paint(x, y)
    data.set([r, g, b, 255], (y * width + x) * 4)
  }
  const map = new THREE.DataTexture(data, width, height)
  map.name = name
  map.colorSpace = THREE.SRGBColorSpace
  map.magFilter = filter
  map.minFilter = filter
  map.needsUpdate = true
  return map
}
// Four original attract screens: no existing game artwork, characters or logos.
const cabinetArt = [
  // Vector road running into a horizon.
  (x, y, c) => {
    const horizon = 34
    if (y > horizon) {
      const depth = (y - horizon) / 62, center = 64
      const edge = Math.abs(Math.abs(x - center) - depth * 52) < 1.6
      const rung = (y * y) % 19 < 4
      return edge ? c.a : rung ? c.b.map(v => v * .45) : [6, 4, 18]
    }
    return Math.hypot(x - 64, y - 26) < 15 && y % 4 ? c.c : (x * 7 + y * 13) % 89 === 0 ? [235, 240, 255] : [8, 5, 26]
  },
  // Falling block stacks.
  (x, y, c) => {
    const col = Math.floor(x / 10), row = Math.floor(y / 10)
    const stack = 9 - ((col * 7 + 3) % 6)
    const filled = col > 2 && col < 10 && row >= stack
    const gap = x % 10 === 0 || y % 10 === 0
    if (x / 10 < 3 || x / 10 > 10) return (x + y) % 9 === 0 ? c.b.map(v => v * .35) : [5, 6, 20]
    return filled && !gap ? (col % 3 === 0 ? c.a : col % 3 === 1 ? c.b : c.c) : [7, 5, 22]
  },
  // Scrolling starfield with a wedge fighter.
  (x, y, c) => {
    const ship = Math.abs(x - 28) < (y > 40 && y < 56 ? 22 - Math.abs(y - 48) * 2.6 : 0)
    const beam = y === 48 && x > 50 && x % 8 < 5
    const rock = Math.hypot(x - 98, y - 28) < 12 && (x ^ y) % 5 > 0
    const star = (x * 31 + y * 17) % 113 === 0
    return ship ? c.a : beam ? c.c : rock ? c.b : star ? [240, 245, 255] : [6, 6, 22]
  },
  // Abstract concentric targets and score bars.
  (x, y, c) => {
    const ring = Math.hypot(x - 64, y - 54) % 16 < 3
    const bar = y < 10 && x % 14 < 10
    return bar ? c.c : ring ? (y % 3 ? c.a : c.b) : [8, 5, 24]
  },
]
const arcadeColors = [
  { a: [80, 240, 255], b: [255, 70, 190], c: [255, 214, 90] },
  { a: [255, 80, 190], b: [90, 230, 255], c: [205, 255, 90] },
  { a: [205, 255, 90], b: [120, 120, 255], c: [255, 90, 160] },
  { a: [255, 200, 90], b: [255, 70, 190], c: [80, 240, 255] },
]
function crtMaterial(variant) {
  const colors = arcadeColors[variant % arcadeColors.length]
  const art = cabinetArt[variant % cabinetArt.length]
  const map = pixelTexture(128, 96, (x, y) => art(x, y, colors).map((value, channel) => {
    // Phosphor scanlines; the shader only adds gain, not more pixels.
    return Math.min(255, value * (y % 2 ? .62 : 1) + (channel === 2 ? 3 : 0))
  }), `arcade_screen_${variant}`)
  return new THREE.MeshPhysicalMaterial({ color: '#020208', roughness: .3, metalness: 0, specularIntensity: .12, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 1.25, envMapIntensity: .3, fog: false })
}
function merged(parts) {
  const result = mergeGeometries(parts)
  parts.forEach(part => part.dispose())
  return result
}
function part(geometry, position = [0, 0, 0], rotationX = 0, rotationZ = 0) {
  geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationX, 0, rotationZ)), new THREE.Vector3(1, 1, 1)))
  return geometry.index ? geometry.toNonIndexed() : geometry
}
const slab = (size, position, rotationX = 0, rotationZ = 0) => part(new THREE.BoxGeometry(...size), position, rotationX, rotationZ)
// Side profile as (depth, height): monitor hood, control deck and marquee.
const CABINET_PROFILE = [[-.68, 0], [.62, 0], [.62, 1.7], [.96, 1.98], [.94, 2.18], [.38, 2.35], [.04, 3.75], [.43, 3.85], [.43, 4.4], [-.68, 4.4]]
function cabinetTemplate() {
  const shape = new THREE.Shape()
  CABINET_PROFILE.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y))
  shape.closePath()
  const profile = new THREE.ExtrudeGeometry(shape, { depth: 1.65, bevelEnabled: false, steps: 1 })
  profile.rotateY(-Math.PI / 2)
  profile.translate(.825, 0, 0)
  const tilt = -.23, screenAt = new THREE.Vector3(0, 3.05, .33)
  const onScreen = z => screenAt.clone().add(new THREE.Vector3(0, 0, z).applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt)).toArray()
  const shell = merged([
    profile.index ? profile.toNonIndexed() : profile,
    slab([1.66, .12, 1.3], [0, .06, -.02]),
    slab([.58, .68, .06], [0, .84, .64]),
    slab([.17, .027, .025], [0, 1.02, .68]),
    slab([.16, .09, .03], [0, .64, .68]),
    slab([1.47, 1.33, .14], onScreen(0), tilt),
    slab([1.5, .39, .1], [0, 4.12, .43]),
    part(new THREE.CylinderGeometry(.03, .03, .26, 6), [-.4, 2.31, .68]),
  ])
  const panel = merged([
    slab([.49, .58, .03], [0, .84, .68]),
    slab([1.55, .1, .64], [0, 2.13, .68], .12),
  ])
  // Glowing T-molding traces the silhouette on both sides.
  const trim = []
  for (const side of [-.84, .84]) {
    CABINET_PROFILE.forEach(([z, y], i) => {
      const [nextZ, nextY] = CABINET_PROFILE[(i + 1) % CABINET_PROFILE.length]
      if (y === 0 && nextY === 0) return
      const length = Math.hypot(nextZ - z, nextY - y)
      trim.push(slab([.022, length + .02, .022], [side, (y + nextY) / 2, (z + nextZ) / 2], Math.atan2(nextZ - z, nextY - y)))
    })
    for (const [y, length] of [[1.0, 1.05], [1.28, .78], [1.56, .5]]) trim.push(slab([.012, .07, length], [side * 1.002, y, .62 - length / 2 - .1]))
  }
  trim.push(slab([1.6, .018, .018], [0, .13, .63]))
  for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) trim.push(part(new THREE.CylinderGeometry(.062, .062, .05, 8), [.12 + col * .18, 2.22, .56 + row * .19], .12))
  trim.push(part(new THREE.IcosahedronGeometry(.1, 0), [-.4, 2.46, .68]))
  return {
    shell, panel, trim: merged(trim),
    screen: part(new THREE.PlaneGeometry(1.24, 1.04), onScreen(.078), tilt),
    marquee: part(new THREE.PlaneGeometry(1.36, .27), [0, 4.12, .485]),
    scan: part(new THREE.BoxGeometry(1.12, .012, .006)),
    onScreen, tilt,
  }
}
function arcade(group) {
  const haloMap = arcadeGlowMap()
  const additive = (color, opacity) => new THREE.MeshBasicMaterial({ color, map: haloMap, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })
  const pink = glow('#ff2fa8', 3.1), cyan = glow('#25d9f0', 1.9), violet = glow('#8f4dff', 2.6)
  const accents = [pink, cyan, violet, glow('#ffc14d', 1.5)]
  for (const material of [pink, cyan, violet, accents[3]]) material.fog = false
  // A polished floor: env reflections carry the neon, the emissive map the grid.
  const gridMap = pixelTexture(64, 64, (x, y) => {
    const line = x < 2 || y < 2
    return line ? [58, 26, 112] : [0, 0, 0]
  }, 'arcade_floor_grid', THREE.LinearFilter)
  gridMap.wrapS = gridMap.wrapT = THREE.RepeatWrapping
  gridMap.repeat.set(26, 34)
  gridMap.generateMipmaps = true
  gridMap.minFilter = THREE.LinearMipmapLinearFilter
  gridMap.anisotropy = 8
  const floor = box(group, 'room_floor', [52, .16, 68], [0, TOP - .08, -8], new THREE.MeshPhysicalMaterial({ color: '#07040e', roughness: .34, metalness: 0, specularIntensity: .1, emissive: '#ffffff', emissiveMap: gridMap, emissiveIntensity: 1, envMapIntensity: .55 }))
  floor.receiveShadow = true
  const wall = matte('#140b26', .7), dark = matte('#090614', .82)
  const architecture = place(group, 'room_architecture', 0, 0, 0)
  // The camera never enters the corridor, so its low neon roof is safe. The hall it
  // orbits in has a higher roof, above the top of the orbit, sealed by a lintel.
  const H = 7.8, HALL_H = 11.4, baseY = TOP + H / 2, hallY = TOP + HALL_H / 2
  box(architecture, 'corridor_end_wall', [13, H, .3], [0, baseY, CORRIDOR_END], wall)
  for (const x of [-6.4, 6.4]) box(architecture, 'corridor_wall', [.3, H, 15.4], [x, baseY, -14.5], wall)
  for (const x of [-9.5, 9.5]) box(architecture, 'corridor_shoulder', [6.5, H, .3], [x, baseY, -7], wall)
  box(architecture, 'corridor_lintel', [25.5, HALL_H - H, .3], [0, TOP + H + (HALL_H - H) / 2, -7], wall)
  for (const x of [-12.6, 12.6]) box(architecture, 'hall_wall', [.3, HALL_H, 24], [x, hallY, 5], wall)
  box(architecture, 'hall_rear_wall', [25.5, HALL_H, .3], [0, hallY, 16.8], wall)
  box(group, 'corridor_ceiling', [13, .14, 15.4], [0, TOP + H, -14.5], dark)
  box(group, 'hall_ceiling', [25.5, .14, 24], [0, TOP + HALL_H, 5], dark)
  // Ceiling: a hot pink band running to the moon, then stepped neon portals.
  box(group, 'ceiling_neon_band', [4.2, .03, 15], [0, TOP + H - .09, -14.4], pink)
  mesh(group, 'ceiling_band_bloom', new THREE.PlaneGeometry(11, 16), additive('#ff2fa8', .2), [0, TOP + H - .16, -14.4]).rotation.x = Math.PI / 2
  for (const [z, material] of [[-8.2, cyan], [-12.6, pink], [-17, violet]]) {
    box(group, 'portal_header', [12.2, .06, .06], [0, TOP + H - .36, z], material)
    for (const x of [-6.1, 6.1]) box(group, 'portal_post', [.06, H - .4, .06], [x, TOP + (H - .4) / 2, z], material)
  }
  for (const x of [-6.2, 6.2]) box(group, 'corridor_wash_line', [.04, .05, 14.6], [x, TOP + 5.45, -14.4], x < 0 ? cyan : pink)
  for (const x of [-12.4, 12.4]) for (const y of [TOP + 1.5, TOP + 5.2]) box(group, 'hall_neon_line', [.04, .05, 23], [x, y, 5], x < 0 ? violet : cyan)
  box(group, 'hall_rear_neon', [24, .05, .04], [0, TOP + 5.2, 16.6], pink)

  // The moon: striped like a CRT raster, fading into the far wall.
  const moonMap = pixelTexture(128, 128, (x, y) => {
    const v = 1 - y / 127
    const raster = v < .46 && (v * 62) % 6 < 1 + (1 - v * 2) * 2.4
    if (raster) return [18, 8, 40]
    return [150 + v * 90, 240 - v * 40, 255]
  }, 'arcade_moon', THREE.LinearFilter)
  const moonMaterial = new THREE.MeshBasicMaterial({ map: moonMap, toneMapped: false, fog: false })
  moonMaterial.color.setScalar(1.25)
  const moon = mesh(group, 'corridor_moon', new THREE.CircleGeometry(2.45, 56), moonMaterial, [0, TOP + 4.1, CORRIDOR_END + .2])
  mesh(group, 'moon_halo', new THREE.PlaneGeometry(12, 12), additive('#38c8ff', .42), [0, TOP + 4.1, CORRIDOR_END + .24])
  mesh(group, 'moon_floor_reflection', new THREE.PlaneGeometry(5.4, 15), additive('#59d6ff', .2), [0, TOP + .012, -14]).rotation.x = -Math.PI / 2
  const starPositions = []
  for (let i = 0; i < 90; i++) {
    const x = ((i * 137) % 120) / 10 - 6, y = TOP + 1.6 + ((i * 53) % 58) / 10
    starPositions.push(x, y, CORRIDOR_END + .22)
  }
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3)), new THREE.PointsMaterial({ color: '#d9f2ff', size: .055, sizeAttenuation: true, toneMapped: false, fog: false }))
  stars.name = 'corridor_stars'
  group.add(stars)

  // Hero plinth, ringed in light so the product has a ground and a stage.
  const plinthMaterial = new THREE.MeshPhysicalMaterial({ color: '#0c0716', roughness: .36, metalness: 0, specularIntensity: .14, envMapIntensity: .5 })
  const plinth = cylinder(group, 'hero_plinth', 1.3, .1, [0, TOP + .05, 0], plinthMaterial, 56)
  plinth.receiveShadow = true
  cylinder(group, 'hero_plinth_ring', 1.335, .018, [0, TOP + .052, 0], pink, 56)
  mesh(group, 'hero_plinth_glow', new THREE.PlaneGeometry(6.4, 6.4), additive('#ff2fa8', .34), [0, TOP + .01, 0]).rotation.x = -Math.PI / 2

  const template = cabinetTemplate()
  const shellMaterial = matte('#120d22', .42), panelMaterial = matte('#2b2140', .36)
  shellMaterial.envMapIntensity = panelMaterial.envMapIntensity = .9
  const displays = [0, 1, 2, 3].map(crtMaterial)
  const marquees = accents.map((_, i) => {
    const colors = arcadeColors[i]
    const map = pixelTexture(64, 12, (x, y) => (x % 8 < 5 && y > 3 && y < 9 && (x * 3 + i) % 11 > 2) ? [255, 250, 240] : colors.b, `arcade_marquee_${i}`)
    return new THREE.MeshStandardMaterial({ color: '#050308', emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 1.3, roughness: .4, fog: false })
  })
  const streakGeometry = new THREE.PlaneGeometry(1.5, 3.4)
  const streaks = accents.map((_, i) => additive(['#ff2fa8', '#25d9f0', '#8f4dff', '#ffc14d'][i], .28))
  const cabinets = []
  function cabinet(x, z, rotation, variant) {
    const machine = place(group, 'arcade_cabinet', x, TOP, z, rotation)
    const accent = variant % accents.length
    const add = (name, geometry, material) => mesh(machine, name, geometry, material)
    add('cabinet_shell', template.shell, shellMaterial)
    add('cabinet_panels', template.panel, panelMaterial)
    add('cabinet_trim', template.trim, accents[accent])
    add('cabinet_screen', template.screen, displays[variant % displays.length])
    add('cabinet_marquee', template.marquee, marquees[accent])
    const scan = mesh(machine, 'screen_attract_scan', template.scan, accents[accent])
    scan.position.fromArray(template.onScreen(.085))
    scan.rotation.x = template.tilt
    // A flat floor decal, not a physical prop: it belongs to the room, not the obstacle.
    const reflection = mesh(group, 'cabinet_floor_reflection', streakGeometry, streaks[accent], [x + Math.sin(rotation) * 2.3, TOP + .014, z + Math.cos(rotation) * 2.3])
    reflection.rotation.set(-Math.PI / 2, rotation, 0, 'YXZ')
    machine.userData.displayMaterial = displays[variant % displays.length]
    machine.userData.scan = scan
    machine.userData.scanRest = scan.position.y
    cabinets.push(machine)
    return machine
  }
  // Corridor rows face inward; a few more dress the hall when orbiting.
  ;[-9, -11.7, -14.4, -17.1, -19.6].forEach((z, i) => {
    cabinet(-4.65, z, 1.18, i)
    cabinet(4.65, z, -1.18, i + 2)
  })
  for (const side of [-1, 1]) {
    cabinet(side * 9.3, -4.9, side * -.92, side < 0 ? 1 : 2)
    cabinet(side * 11.2, 4, side * -Math.PI / 2, side < 0 ? 3 : 0)
  }
  for (const x of [-6.6, -2.2, 2.2, 6.6]) cabinet(x, 14.6, Math.PI, Math.abs(Math.round(x)) % 4)
  group.userData.clearance = ARCADE_CLEARANCE

  // Slow dust through the light. One draw call; the group's rotation animates it.
  const dust = new THREE.Group()
  dust.name = 'arcade_dust'
  const motes = []
  for (let i = 0; i < 160; i++) {
    const angle = i * 2.399, radius = 2.4 + ((i * 41) % 90) / 10
    motes.push(Math.cos(angle) * radius, TOP + .4 + ((i * 29) % 56) / 10, Math.sin(angle) * radius - 3)
  }
  const dustPoints = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(motes, 3)), new THREE.PointsMaterial({ color: '#f3b7ff', size: .03, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))
  dustPoints.name = 'arcade_dust_points'
  dust.add(dustPoints)
  group.add(dust)
  for (const [z, color, opacity] of [[-8.6, '#b92bff', .08], [-15, '#25b6f0', .1]]) {
    mesh(group, 'corridor_haze', new THREE.PlaneGeometry(16, 9), additive(color, opacity), [0, TOP + 2.8, z])
  }

  const lights = [
    point(group, '#ff2fa8', 42, [-4, TOP + 5.6, -11], 18),
    point(group, '#25d9f0', 42, [4, TOP + 5.6, -11], 18),
    point(group, '#cfc6ff', 12, [0, TOP + 3, 9], 16),
  ]
  const lightBase = lights.map(light => light.intensity)
  group.userData.animate = (time, reducedMotion) => {
    const t = reducedMotion ? 0 : time
    cabinets.forEach((machine, i) => {
      const { displayMaterial, scan, scanRest } = machine.userData
      displayMaterial.emissiveIntensity = 1.25 + (reducedMotion ? 0 : .18 * Math.sin(t * 1.35 + i * 1.2))
      scan.position.y = reducedMotion ? scanRest : scanRest - .46 + (t * .22 + i * .13) % .92
    })
    // Screen content scrolls in stepped frames, like attract-mode hardware.
    displays.forEach((display, i) => {
      if (i === 1) return
      display.emissiveMap.offset.x = reducedMotion ? 0 : Math.floor(t * 10 + i * 3) / 128 * (i === 2 ? 2 : 0)
      display.emissiveMap.offset.y = reducedMotion ? 0 : i === 0 ? -Math.floor(t * 14) / 96 : 0
    })
    pink.emissiveIntensity = 3.1 + (reducedMotion ? 0 : .25 * Math.sin(t * .62))
    cyan.emissiveIntensity = 1.9 + (reducedMotion ? 0 : .16 * Math.sin(t * .74 + 1.1))
    violet.emissiveIntensity = 2.6 + (reducedMotion ? 0 : .18 * Math.sin(t * .53 + 2))
    lights.forEach((light, i) => { light.intensity = lightBase[i] * (reducedMotion ? 1 : 1 + .08 * Math.sin(t * .65 + i * 1.3)) })
    moon.position.y = TOP + 4.1 + (reducedMotion ? 0 : Math.sin(t * .2) * .04)
    dust.rotation.y = reducedMotion ? 0 : t * .012
  }
}

function tech(group) {
  // A dark product lab: layered panels held back in shadow, cyan linear light,
  // and one glowing gate at the end of the room to pull the eye through it.
  const graphite = surface('brushed', '#1a2126', [1, 5]), metal = surface('brushed', '#343f45', [1, 8])
  const black = matte('#070b0f', 0.78), seam = matte('#04070a')
  const halo = arcadeGlowMap()
  const diffuser = glow('#59e1ff', 1.75), soft = glow('#2f9fd8', 1.1), white = glow('#d5f4ff', 1.5)
  for (const material of [diffuser, soft, white]) material.fog = false
  const floorMaterial = new THREE.MeshPhysicalMaterial({ color: '#05090d', roughness: .36, specularIntensity: .12, envMapIntensity: .3 })
  room(group, TOP - 0.46, matte('#0b1217', 0.83), floorMaterial, true, 13, 9.8)
  // A low chamfered plinth, its top edge drawn in light.
  cylinder(group, 'plinth_lower_base', 1.61, 0.12, [0, TOP - 0.39, 0], black, 48)
  mesh(group, 'plinth_main_body', new THREE.LatheGeometry([
    new THREE.Vector2(1.61, -0.36), new THREE.Vector2(1.70, -0.33),
    new THREE.Vector2(1.73, -0.28), new THREE.Vector2(1.73, -0.10),
    new THREE.Vector2(1.66, -0.05),
  ], 48), graphite, [0, TOP, 0])
  cylinder(group, 'plinth_top_plate', 1.66, 0.025, [0, TOP - 0.035, 0], metal, 48).receiveShadow = true
  const rim = mesh(group, 'plinth_light_ring', new THREE.TorusGeometry(1.69, 0.012, 6, 64), diffuser, [0, TOP - 0.08, 0])
  rim.rotation.x = Math.PI / 2
  shadow(group, 0, TOP - 0.02, 0, 3.1, 1.8, 0.42)
  glowPlane(group, 'plinth_floor_glow', halo, '#25b9f0', .13, [7, 7], [0, TOP - .45, 0], true)

  // Wall bays recede in shadow; only their light channels read at a distance.
  for (const z of [-10.5, 10.5]) for (const x of [-7.2, -3.6, 0, 3.6, 7.2]) {
    const bay = place(group, 'layered_lab_wall_bay', x, TOP - 0.46, z, z > 0 ? Math.PI : 0)
    box(bay, 'panel_backing', [3.45, 11, 0.12], [0, 5.5, 0], seam)
    for (const dx of [-1.63, 1.63]) box(bay, 'vertical_technical_rail', [0.09, 11, 0.25], [dx, 5.5, 0.10], metal)
    box(bay, 'beveled_upper_panel', [3.14, 3.95, 0.18], [0, 4.15, 0.14], graphite)
    box(bay, 'recessed_lower_panel', [3.02, 2.05, 0.09], [0, 1.08, 0.08], black)
    box(bay, 'horizontal_panel_joint', [3.17, 0.065, 0.19], [0, 2.17, 0.2], seam)
    if (x) box(bay, 'frosted_linear_diffuser', [0.03, 3.0, 0.02], [x < 0 ? 1.1 : -1.1, 4.15, 0.25], soft)
    for (const y of [3.1, 5.4]) box(bay, 'panel_machined_reveal', [1.45, 0.012, 0.009], [0.42, y, 0.236], seam)
    const positions = Array.from({ length: 9 }, (_, i) => [-0.65 + i * 0.16, 1.10, 0.143])
    instances(bay, 'recessed_vent_slots', [0.055, 0.55, 0.014], positions, seam)
  }
  // The gate: a light portal behind the product, framing it from the default view.
  const gate = place(group, 'light_gate', 0, TOP - .46, -9.9)
  box(gate, 'gate_recess', [6.4, 7.2, .1], [0, 3.6, -.1], matte('#03070c'))
  for (const x of [-3.1, 3.1]) box(gate, 'gate_post', [.05, 7.1, .05], [x, 3.55, .02], diffuser)
  box(gate, 'gate_header', [6.25, .05, .05], [0, 7.1, .02], diffuser)
  box(gate, 'gate_inner_top', [4.6, .018, .03], [0, 6.5, .02], soft)
  const gateGlow = glowPlane(group, 'gate_core_glow', halo, '#1f7fd0', .2, [9, 9], [0, 3.3, -9.7])
  const scanMaterial = white
  const scan = box(gate, 'gate_scan_line', [6.2, .016, .03], [0, 2, .04], scanMaterial)
  glowPlane(group, 'gate_floor_reflection', halo, '#35c9ff', .1, [6.5, 12], [0, TOP - .452, -5.2], true)
  glowPlane(group, 'lab_haze', halo, '#1a6f9c', .035, [18, 9], [0, 2.4, -6.4])
  // Lead-in lines drawn on the floor, converging on the gate.
  for (const side of [-1, 1]) {
    bar(group, 'floor_lead_line', [side * 2.1, TOP - .445, -1.2], [side * 3.1, TOP - .445, -9.8], .01, soft)
    bar(group, 'floor_lead_line', [side * 3.4, TOP - .445, 2], [side * 5.4, TOP - .445, -9.8], .007, soft)
  }
  for (const x of [-10.9, 10.9]) {
    box(group, 'structural_side_column', [0.45, 11, 0.6], [x, 3, -3.4], graphite)
    box(group, 'sidewall_light', [.03, 5, .05], [x * .975, 2.4, -3.4], diffuser)
    box(group, 'sidewall_recess', [0.08, 3.6, 6], [x, 1.6, 1.5], black)
  }
  const console_ = place(group, 'lab_status_module', -6.8, TOP - 0.46, -6.8, 0.42)
  box(console_, 'status_module_housing', [1.3, 1.35, 0.7], [0, 0.675, 0], graphite)
  box(console_, 'status_recess', [0.9, 0.40, 0.035], [0, 1.02, 0.37], black)
  const leds = []
  for (let i = 0; i < 4; i++) leds.push(box(console_, 'abstract_status_light', [0.095, 0.016, 0.012], [-0.27 + i * 0.18, 1.02, 0.40], i === 0 ? white : soft))
  for (const x of [-7.4, 7.4]) {
    box(group, 'overhead_rail', [0.34, 0.16, 20], [x, 8.1, 0], graphite)
    box(group, 'overhead_recessed_light', [0.05, 0.02, 18], [x, 8.01, 0], soft)
    for (const z of [-8, 8]) bar(group, 'rail_ceiling_support', [x, 8.18, z], [x, 9.74, z], 0.035, metal)
  }
  const labLight = point(group, '#3fc9ff', 14, [0, 3.6, -8.2], 16)
  group.userData.animate = (time, reducedMotion) => {
    const t = reducedMotion ? 0 : time
    scan.position.y = reducedMotion ? 2 : .3 + ((t * .32) % 1) * 6.5
    gateGlow.material.opacity = .2 + (reducedMotion ? 0 : .025 * Math.sin(t * .7))
    labLight.intensity = 14 + (reducedMotion ? 0 : 1.2 * Math.sin(t * .7))
    diffuser.emissiveIntensity = 1.75 + (reducedMotion ? 0 : .1 * Math.sin(t * .7))
  }
}

export function createEnvironmentGroup(name, preset) {
  const group = new THREE.Group()
  group.name = `environment:${name}`
  group.userData.environment = true
  group.userData.safeOrbitRadius = SAFE_ORBIT_RADIUS
  const ambient = new THREE.HemisphereLight('#ffffff', preset.ground, { Studio: .5, 'Retro Desk': .22, Arcade: .1, 'Dark Tech': .13 }[name])
  // Focus the dark-room key on the product: unlike a directional light this
  // falls off before reaching cabinets/panels, so their practical lights read.
  const key = preset.dark
    ? new THREE.SpotLight(preset.key, preset.light * { Arcade: 11, 'Retro Desk': 11, 'Dark Tech': 13 }[name], 22, 0.27, 0.9, 2)
    : new THREE.DirectionalLight(preset.key, preset.light)
  key.name = 'product_key'
  key.position.set(3, 5, 5)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.02
  key.shadow.radius = 5
  if (key.isDirectionalLight) Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 18 })
  const fill = new THREE.DirectionalLight(preset.dark ? '#fff4ea' : preset.fill, preset.dark ? .55 : .42)
  fill.position.set(-4, 2, 3)
  group.add(ambient, key, fill)
  if (preset.dark) {
    // Coloured rims aimed only at the product: they cut its silhouette from the dark
    // room without washing it, and the neutral fill keeps product colours truthful.
    const [power, rims] = {
      Arcade: [78, [['#ff2fa8', [-3.6, 3.4, -3.6]], ['#25d9f0', [3.8, 1.8, -3.2]]]],
      'Retro Desk': [46, [['#ffae6e', [3.8, 2.8, -3.2]], ['#8f7dff', [-3.6, 3, -3.6]]]],
      'Dark Tech': [96, [['#25d9f0', [-3.6, 2.6, -3.6]], ['#3f7cff', [3.8, 2, -3.2]]]],
    }[name]
    for (const [color, position] of rims) {
      const hot = new THREE.SpotLight(color, power, 12, .3, .7, 2)
      hot.position.set(...position)
      group.add(hot)
    }
  } else {
    // In the studio a clean white kicker separates the product from the bright sweep.
    const kicker = new THREE.DirectionalLight('#ffffff', 1.25)
    kicker.position.set(-3, 3, -4)
    group.add(kicker)
  }
  const builders = { Studio: studio, 'Retro Desk': desk, Arcade: arcade, 'Dark Tech': tech }
  builders[name](group)
  group.userData.fog = new THREE.Fog(name === 'Arcade' ? '#150930' : preset.background, 15, name === 'Arcade' ? 46 : 38)
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
