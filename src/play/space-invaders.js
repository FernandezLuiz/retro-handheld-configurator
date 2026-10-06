import { WIDTH, HEIGHT, seeded } from './game.js'

const PLAYER_Y = HEIGHT - 34
const PLAYER_SPEED = 215

export function createSpaceInvaders(random = seeded(0x51ace)) {
  const state = {
    phase: 'idle', player: { x: WIDTH / 2, y: PLAYER_Y, cooldown: 0, invulnerable: 0 },
    enemies: [], bullets: [], enemyBullets: [], shields: [], score: 0, highScore: 0,
    lives: 3, wave: 0, time: 0, shots: 0, direction: 1, formationSpeed: 25,
    drop: 0, enemyFire: 0, waveDelay: 0,
  }

  function makeShields() {
    return [105, 205, 307, 407].flatMap(cx => {
      const blocks = []
      for (let row = 0; row < 3; row++) for (let col = -3; col <= 3; col++) {
        if (row === 2 && Math.abs(col) < 2) continue
        blocks.push({ x: cx + col * 7, y: HEIGHT - 82 + row * 6, w: 6, h: 5, hp: 2 })
      }
      return blocks
    })
  }

  function startWave() {
    state.wave++
    state.enemies = []
    const rows = Math.min(5, 3 + Math.floor((state.wave - 1) / 2))
    for (let row = 0; row < rows; row++) for (let col = 0; col < 9; col++) {
      state.enemies.push({ x: 104 + col * 38, y: 58 + row * 29, row, col, alive: true })
    }
    state.direction = 1
    state.formationSpeed = 23 + state.wave * 4
    state.enemyFire = 0.85
    state.waveDelay = 0
  }

  function restart() {
    const highScore = state.highScore
    Object.assign(state, {
      phase: 'playing', player: { x: WIDTH / 2, y: PLAYER_Y, cooldown: 0, invulnerable: 1.25 },
      enemies: [], bullets: [], enemyBullets: [], shields: makeShields(), score: 0,
      highScore, lives: 3, wave: 0, time: 0, shots: 0, direction: 1,
      formationSpeed: 25, drop: 0, enemyFire: 0, waveDelay: 0,
    })
    startWave()
  }

  function hitShield(projectile) {
    const block = state.shields.find(part => part.hp && Math.abs(projectile.x - part.x) < part.w / 2 + 2 && Math.abs(projectile.y - part.y) < part.h / 2 + 4)
    if (!block) return false
    block.hp--
    return true
  }

  function loseLife() {
    state.lives--
    state.enemyBullets.length = 0
    if (!state.lives) state.phase = 'over'
    else Object.assign(state.player, { x: WIDTH / 2, invulnerable: 1.6 })
  }

  function step(dt, keys) {
    if (state.phase !== 'playing') return
    state.time += dt
    const player = state.player
    player.cooldown = Math.max(0, player.cooldown - dt)
    player.invulnerable = Math.max(0, player.invulnerable - dt)
    player.x = Math.max(18, Math.min(WIDTH - 18, player.x + (Number(keys.has('right')) - Number(keys.has('left'))) * PLAYER_SPEED * dt))
    if (keys.has('action') && !player.cooldown) {
      state.bullets.push({ x: player.x, y: player.y - 14, vy: -310 })
      player.cooldown = 0.22
      state.shots++
    }

    const live = state.enemies.filter(enemy => enemy.alive)
    if (live.length) {
      const edge = live.some(enemy => enemy.x + state.direction * state.formationSpeed * dt < 24 || enemy.x + state.direction * state.formationSpeed * dt > WIDTH - 24)
      if (edge) {
        state.direction *= -1
        live.forEach(enemy => { enemy.y += 12 })
        state.formationSpeed *= 1.025
      } else live.forEach(enemy => { enemy.x += state.direction * state.formationSpeed * dt })
      if (live.some(enemy => enemy.y > PLAYER_Y - 34)) { state.lives = 0; state.phase = 'over' }
    }

    state.enemyFire -= dt
    if (state.enemyFire <= 0 && live.length) {
      const columns = [...new Set(live.map(enemy => enemy.col))]
      const col = columns[Math.floor(random() * columns.length)]
      const shooter = live.filter(enemy => enemy.col === col).sort((a, b) => b.y - a.y)[0]
      state.enemyBullets.push({ x: shooter.x, y: shooter.y + 12, vy: 125 + state.wave * 7 })
      state.enemyFire = Math.max(0.2, 0.95 - state.wave * 0.055) * (0.65 + random() * 0.7)
    }

    for (const bullet of state.bullets) {
      bullet.y += bullet.vy * dt
      if (hitShield(bullet)) { bullet.dead = true; continue }
      const enemy = live.find(target => target.alive && Math.abs(bullet.x - target.x) < 13 && Math.abs(bullet.y - target.y) < 10)
      if (enemy) {
        enemy.alive = false; bullet.dead = true
        state.score += (3 - Math.min(2, enemy.row)) * 10
        state.highScore = Math.max(state.highScore, state.score)
      }
    }
    for (const bullet of state.enemyBullets) {
      bullet.y += bullet.vy * dt
      if (hitShield(bullet)) { bullet.dead = true; continue }
      if (!player.invulnerable && Math.abs(bullet.x - player.x) < 12 && Math.abs(bullet.y - player.y) < 10) { bullet.dead = true; loseLife() }
    }
    state.bullets = state.bullets.filter(bullet => !bullet.dead && bullet.y > 20)
    state.enemyBullets = state.enemyBullets.filter(bullet => !bullet.dead && bullet.y < HEIGHT)
    state.shields = state.shields.filter(block => block.hp)

    if (state.phase === 'playing' && !state.enemies.some(enemy => enemy.alive)) {
      state.waveDelay += dt
      if (state.waveDelay >= 1.2) startWave()
    }
  }

  return { state, restart, step, idle() { state.phase = 'idle' } }
}
