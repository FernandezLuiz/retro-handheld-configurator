import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, seeded, WIDTH, HEIGHT, distance } from '../src/play/game.js'
const none = new Set()
const run = (game, seconds, keys = none) => { for (let i = 0; i < Math.round(seconds * 120); i++) game.step(1 / 120, keys) }
const fixture = () => { const game = createGame(seeded(123)); game.restart(); return game }
function strike(game, object) { game.state.bullets.push({ x: object.x, y: object.y, vx: 0, vy: 0, life: 1 }); game.step(0.00001, none) }
function clear(game) { while (game.state.hazards.length) { const h = game.state.hazards[0]; h.hp = 1; strike(game, h) } game.state.rings = []; run(game, 1.8) }

test('rotation, acceleration and momentum respond independently; drag and speed stay bounded', () => {
  const game = fixture(), p = game.state.player
  const angle = p.angle
  run(game, 0.2, new Set(['left']))
  assert.ok(p.angle < angle); assert.equal(p.vx, 0); assert.equal(p.vy, 0)
  run(game, 0.4, new Set(['right']))
  assert.ok(p.angle > angle)
  run(game, 0.5, new Set(['up']))
  const speed = Math.hypot(p.vx, p.vy), before = { ...p }
  run(game, 0.4)
  assert.ok(Math.hypot(p.vx, p.vy) < speed)
  assert.ok(Math.hypot(p.vx, p.vy) > speed * 0.7)
  assert.ok(distance(p, before) > 10)
  run(game, 1, new Set(['up', 'boost']))
  assert.ok(Math.hypot(p.vx, p.vy) <= 300.01)
  assert.ok(p.cooldown > 0)
})

test('ship and bullets wrap at both axes; firing is rate limited and inherits momentum', () => {
  const game = fixture(), p = game.state.player
  Object.assign(p, { x: WIDTH - 0.1, y: HEIGHT - 0.1, vx: 100, vy: 100, angle: 0 })
  game.step(1 / 120, new Set(['action']))
  assert.ok(p.x < 2 && p.y < 2)
  assert.ok(game.state.bullets[0].vx > 280)
  assert.ok(game.state.bullets[0].vy > 0)
  game.state.hazards = []
  run(game, 0.5, new Set(['action']))
  assert.ok(game.state.shots >= 3 && game.state.shots <= 4)
  game.state.bullets = [{ x: WIDTH - 0.1, y: HEIGHT - 0.1, vx: 100, vy: 100, life: 0.3 }]
  game.step(1 / 120, none)
  assert.ok(game.state.bullets[0].x < 2 && game.state.bullets[0].y < 2)
  run(game, 0.4)
  assert.equal(game.state.bullets.length, 0)
})

test('multi-hit large/medium hazards split into two fragments; small hazards vanish and score', () => {
  const game = fixture(), large = game.state.hazards[0]
  game.state.hazards = [large]
  strike(game, large); assert.equal(large.hp, 2); assert.equal(game.state.score, 0)
  strike(game, large); strike(game, large)
  assert.equal(game.state.score, 100)
  assert.deepEqual(game.state.hazards.map(h => h.kind), ['medium', 'medium'])
  const medium = game.state.hazards[0]
  // Separate targets to avoid accidentally striking the sibling's collision circle.
  Object.assign(medium, { x: 50, y: 50 })
  strike(game, medium); strike(game, medium)
  assert.equal(game.state.hazards.filter(h => h.kind === 'small').length, 2)
  assert.equal(game.state.score, 300)
  const small = game.state.hazards.find(h => h.kind === 'small')
  Object.assign(small, { x: 300, y: 300 })
  strike(game, small)
  assert.equal(game.state.score, 700)
  assert.equal(game.state.highScore, 700)
  assert.ok(game.state.particles.length > 0)
})

test('collisions across seams remove one life; respawn protection, game over and high score persist', () => {
  const game = fixture()
  for (let life = 3; life > 0; life--) {
    Object.assign(game.state.player, { x: 1, y: 100, invulnerable: 0, dash: 0 })
    Object.assign(game.state.hazards[0], { x: WIDTH - 2, y: 100 })
    game.step(1 / 120, none)
    assert.equal(game.state.lives, life - 1)
    if (life > 1) {
      Object.assign(game.state.hazards[0], { x: game.state.player.x, y: game.state.player.y })
      game.step(1 / 120, none)
      assert.equal(game.state.lives, life - 1)
      assert.ok(game.state.player.invulnerable > 2)
    }
  }
  assert.equal(game.state.phase, 'over')
  const time = game.state.time
  run(game, 1, new Set(['action']))
  assert.equal(game.state.time, time)
  game.state.highScore = 1400
  game.restart()
  assert.equal(game.state.lives, 3); assert.equal(game.state.wave, 1)
  assert.equal(game.state.score, 0); assert.equal(game.state.highScore, 1400)
  game.idle(); const idleTime = game.state.time; run(game, 1)
  assert.equal(game.state.time, idleTime)
})

test('cleared waves increase population/speed and introduce all three special behaviors gradually', () => {
  const game = fixture(), initialSpeed = game.state.hazards[0].speed
  clear(game)
  assert.equal(game.state.wave, 2)
  assert.equal(game.state.hazards.length, 4)
  assert.ok(game.state.hazards[0].speed > initialSpeed)
  clear(game)
  assert.ok(game.state.hazards.some(h => h.kind === 'drifter'))
  while (game.state.wave < 7) clear(game)
  const hunter = game.state.hazards.find(h => h.kind === 'hunter')
  const drifter = game.state.hazards.find(h => h.kind === 'drifter')
  const pulse = game.state.hazards.find(h => h.kind === 'pulse')
  assert.ok(hunter && drifter && pulse)
  const old = { vx: hunter.vx, vy: hunter.vy }
  drifter.turn = 0; pulse.charge = 0
  const drift = drifter.vx
  game.step(1 / 120, none)
  assert.notEqual(drifter.vx, drift)
  assert.notDeepEqual({ vx: hunter.vx, vy: hunter.vy }, old)
  assert.equal(game.state.rings.length, 1)
  const ring = game.state.rings[0]
  Object.assign(game.state.player, { x: ring.x + ring.radius, y: ring.y, invulnerable: 0, dash: 0 })
  const lives = game.state.lives
  game.step(1 / 120, none)
  assert.equal(game.state.lives, lives - 1)
})

test('same seed and inputs reproduce a run; fixed substeps agree across frame rates and stay bounded', () => {
  const a = fixture(), b = fixture()
  for (let frame = 0; frame < 240; frame++) {
    const keys = new Set(frame < 120 ? ['up', 'right', 'action'] : ['left', 'action', 'boost'])
    a.step(1 / 120, keys); a.step(1 / 120, keys)
    for (let tick = 0; tick < 2; tick++) b.step(1 / 120, keys)
  }
  assert.deepEqual(a.state, b.state)
  assert.ok(a.state.bullets.length <= 8)
  assert.ok(a.state.particles.length < 200)
})
