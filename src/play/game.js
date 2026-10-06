// Seeded, fixed-step-compatible simulation. No DOM, clocks, timers or palette input.
export const WIDTH = 512
export const HEIGHT = 400
export const wrap = (value, size) => (value % size + size) % size
export const delta = (a, b, size) => wrap(a - b + size / 2, size) - size / 2
export const distance = (a, b) => Math.hypot(delta(a.x, b.x, WIDTH), delta(a.y, b.y, HEIGHT))
export function seeded(seed = 0xf04d) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
const sizes = { large: [29, 3, 24, 100], medium: [18, 2, 39, 200], small: [10, 1, 61, 400], drifter: [13, 2, 46, 650], hunter: [15, 3, 32, 800], pulse: [20, 4, 20, 1000] }
export function createGame(random = seeded()) {
  const effects = seeded(0xbeef) // Cosmetic particles never change spawn/physics randomness.
  const ship = () => ({ x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0, angle: -Math.PI / 2, invulnerable: 2.5, dash: 0, cooldown: 0, thrust: false })
  const state = { phase: 'idle', player: ship(), hazards: [], bullets: [], particles: [], rings: [], time: 0, score: 0, highScore: 0, wave: 0, lives: 3, waveDelay: 0, flash: 0, shake: 0, shots: 0, destroyed: 0 }
  let fireCooldown = 0, trailClock = 0
  function hazard(kind, x, y, heading = random() * Math.PI * 2) {
    const [radius, hp, baseSpeed, points] = sizes[kind]
    const speed = baseSpeed * (1 + Math.min(0.75, (state.wave - 1) * 0.055))
    const count = kind === 'large' ? 9 : kind === 'medium' ? 7 : 6
    return { kind, x, y, radius, hp, points, speed, vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed,
      angle: random() * 6.28, spin: (random() - 0.5) * 0.7, turn: 1 + random() * 2, charge: 2.6 + random(), hit: 0,
      vertices: Array.from({ length: count }, (_, i) => ({ angle: i / count * Math.PI * 2 + (random() - 0.5) * 0.18, radius: 0.7 + random() * 0.3 })) }
  }
  function burst(x, y, count, force = 1) {
    for (let i = 0; i < count; i++) {
      const angle = effects() * Math.PI * 2, speed = (20 + effects() * 60) * force
      state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.25 + effects() * 0.45 })
    }
    if (state.particles.length > 180) state.particles.splice(0, state.particles.length - 180)
  }
  function startWave() {
    state.wave++
    const kinds = Array.from({ length: Math.min(10, 2 + state.wave) }, () => 'large')
    if (state.wave >= 3) kinds.push('drifter')
    if (state.wave >= 5) kinds.push('hunter')
    if (state.wave >= 7) kinds.push('pulse')
    state.hazards = kinds.map((kind, index) => {
      const angle = index / kinds.length * Math.PI * 2 + random() * 0.35
      // A perimeter deployment with a guaranteed clear center for each wave.
      return hazard(kind, WIDTH / 2 + Math.cos(angle) * 210, HEIGHT / 2 + Math.sin(angle) * 155)
    })
    state.player.invulnerable = Math.max(state.player.invulnerable, 1.6)
    state.waveDelay = 0
  }
  function restart() {
    const highScore = state.highScore
    Object.assign(state, { phase: 'playing', player: ship(), hazards: [], bullets: [], particles: [], rings: [], time: 0, score: 0, highScore, wave: 0, lives: 3, waveDelay: 0, flash: 0, shake: 0, shots: 0, destroyed: 0 })
    fireCooldown = trailClock = 0
    startWave()
  }
  function destroy(object) {
    state.score += object.points
    state.highScore = Math.max(state.highScore, state.score)
    state.destroyed++
    burst(object.x, object.y, object.kind === 'small' ? 7 : 14)
    state.flash = 0.035
    const next = object.kind === 'large' ? 'medium' : object.kind === 'medium' ? 'small' : null
    if (next) for (const sign of [-1, 1]) {
      const heading = Math.atan2(object.vy, object.vx) + sign * (0.6 + random() * 0.5)
      state.hazards.push(hazard(next, wrap(object.x + sign * 8, WIDTH), wrap(object.y + sign * 8, HEIGHT), heading))
    }
  }
  function loseLife() {
    burst(state.player.x, state.player.y, 25, 1.4)
    state.shake = 0.22; state.flash = 0.065
    state.lives--
    if (!state.lives) { state.phase = 'over'; return }
    let best = { x: WIDTH / 2, y: HEIGHT / 2 }, clearance = -1
    for (let y = 80; y < HEIGHT; y += 120) for (let x = 80; x < WIDTH; x += 120) {
      const point = { x, y }
      const d = Math.min(...state.hazards.map(h => distance(point, h) - h.radius), ...state.rings.map(r => Math.abs(distance(point, r) - r.radius)))
      if (d > clearance) { clearance = d; best = point }
    }
    state.player = { ...ship(), ...best }
  }
  function step(dt, keys) {
    if (state.phase !== 'playing') return
    const p = state.player
    state.time += dt
    state.flash = Math.max(0, state.flash - dt); state.shake = Math.max(0, state.shake - dt)
    p.invulnerable = Math.max(0, p.invulnerable - dt)
    p.cooldown = Math.max(0, p.cooldown - dt); p.dash = Math.max(0, p.dash - dt)
    p.angle += (Number(keys.has('right')) - Number(keys.has('left'))) * 3.5 * dt
    p.thrust = keys.has('up')
    const ux = Math.cos(p.angle), uy = Math.sin(p.angle)
    if (p.thrust) { p.vx += ux * 145 * dt; p.vy += uy * 145 * dt }
    if (keys.has('boost') && !p.cooldown) {
      p.vx += ux * 180; p.vy += uy * 180; p.dash = 0.22; p.cooldown = 3.2
      burst(p.x, p.y, 7, 0.6)
    }
    const drag = Math.exp(-0.28 * dt)
    p.vx *= drag; p.vy *= drag
    const speed = Math.hypot(p.vx, p.vy), limit = p.dash ? 300 : 220
    if (speed > limit) { p.vx *= limit / speed; p.vy *= limit / speed }
    p.x = wrap(p.x + p.vx * dt, WIDTH); p.y = wrap(p.y + p.vy * dt, HEIGHT)
    trailClock -= dt
    if ((p.thrust || p.dash) && trailClock <= 0) {
      state.particles.push({ x: p.x - ux * 11, y: p.y - uy * 11, vx: p.vx * 0.2 - ux * 40, vy: p.vy * 0.2 - uy * 40, life: 0.22 })
      trailClock = 0.04
    }
    fireCooldown = Math.max(0, fireCooldown - dt)
    if (keys.has('action') && !fireCooldown) {
      state.bullets.push({ x: wrap(p.x + ux * 14, WIDTH), y: wrap(p.y + uy * 14, HEIGHT), vx: ux * 280 + p.vx * 0.4, vy: uy * 280 + p.vy * 0.4, life: 1.15 })
      fireCooldown = 0.17; state.shots++
    }
    for (const h of state.hazards) {
      h.angle += h.spin * dt; h.hit = Math.max(0, h.hit - dt)
      if (h.kind === 'drifter') {
        h.turn -= dt
        if (h.turn <= 0) { const a = Math.atan2(h.vy, h.vx) + (random() - 0.5) * 1.8; h.vx = Math.cos(a) * h.speed; h.vy = Math.sin(a) * h.speed; h.turn = 1.6 + random() * 1.6 }
      }
      if (h.kind === 'hunter') {
        const dx = delta(p.x, h.x, WIDTH), dy = delta(p.y, h.y, HEIGHT), length = Math.hypot(dx, dy) || 1
        const blend = 1 - Math.exp(-0.45 * dt)
        h.vx += (dx / length * h.speed - h.vx) * blend; h.vy += (dy / length * h.speed - h.vy) * blend
      }
      if (h.kind === 'pulse') {
        h.charge -= dt
        if (h.charge <= 0) { state.rings.push({ x: h.x, y: h.y, radius: h.radius, life: 1.7 }); h.charge = 3.6 }
      }
      h.x = wrap(h.x + h.vx * dt, WIDTH); h.y = wrap(h.y + h.vy * dt, HEIGHT)
    }
    for (const b of state.bullets) {
      b.x = wrap(b.x + b.vx * dt, WIDTH); b.y = wrap(b.y + b.vy * dt, HEIGHT); b.life -= dt
      if (b.life <= 0) continue
      const hit = state.hazards.find(h => distance(b, h) < h.radius * 0.86 + 2)
      if (hit) {
        b.life = 0; hit.hp--; hit.hit = 0.1; burst(b.x, b.y, 3, 0.45)
        if (hit.hp <= 0) { state.hazards.splice(state.hazards.indexOf(hit), 1); destroy(hit) }
      }
    }
    state.bullets = state.bullets.filter(b => b.life > 0)
    for (const r of state.rings) { r.radius += 58 * dt; r.life -= dt }
    state.rings = state.rings.filter(r => r.life > 0)
    if (!p.invulnerable && !p.dash && (state.hazards.some(h => distance(p, h) < h.radius * 0.82 + 6) || state.rings.some(r => Math.abs(distance(p, r) - r.radius) < 6))) loseLife()
    for (const particle of state.particles) { particle.x = wrap(particle.x + particle.vx * dt, WIDTH); particle.y = wrap(particle.y + particle.vy * dt, HEIGHT); particle.life -= dt }
    state.particles = state.particles.filter(particle => particle.life > 0)
    if (!state.hazards.length && !state.rings.length && state.phase === 'playing') {
      state.waveDelay += dt
      if (state.waveDelay >= 1.7) startWave()
    }
  }
  return { state, restart, step, idle() { state.phase = 'idle' } }
}
