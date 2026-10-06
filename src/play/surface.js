import * as THREE from 'three'
import { createGame, WIDTH, HEIGHT } from './game.js'

export const gameThemes = {
  Classic: ['#0c1712', '#93b68a', '#d3e6b7'],
  Atomic: ['#0a151d', '#8cc8d9', '#deeff6'],
  Forest: ['#09160f', '#69a979', '#bdd5a1'],
  Sunset: ['#1b1015', '#d8a077', '#f0bdad'],
  Stealth: ['#171c20', '#adb7ba', '#e5e9e1'],
}
export function createGameSurface() {
  const canvas = document.createElement('canvas')
  // Supersample the vector strokes; logical gameplay dimensions stay fixed.
  canvas.width = WIDTH * 2; canvas.height = HEIGHT * 2
  canvas.setAttribute('aria-label', 'Gameboy Vector Field game screen')
  const ctx = canvas.getContext('2d', { alpha: false })
  const texture = new THREE.CanvasTexture(canvas)
  texture.name = 'form_os_live_canvas'
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.flipY = false // Match the existing GLB LCD UVs.
  const game = createGame()
  let theme = 'Classic', colors = gameThemes.Classic, paused = false, reducedMotion = false, idleTime = 0, attracting = false
  function text(value, x, y, size = 10, align = 'left', color = colors[1]) {
    ctx.fillStyle = color; ctx.font = `${size}px monospace`; ctx.textAlign = align; ctx.fillText(value, x, y)
  }
  function line(points, close = false) {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (close) ctx.closePath(); ctx.stroke()
  }
  function copies(object, radius, draw) {
    // Wrapped copies make edge crossings visually continuous, including rings.
    const xs = [0], ys = [0]
    if (object.x < radius) xs.push(WIDTH)
    if (object.x > WIDTH - radius) xs.push(-WIDTH)
    if (object.y < radius) ys.push(HEIGHT)
    if (object.y > HEIGHT - radius) ys.push(-HEIGHT)
    for (const x of xs) for (const y of ys) { ctx.save(); ctx.translate(object.x + x, object.y + y); draw(); ctx.restore() }
  }
  function draw() {
    const s = game.state, p = s.player
    ctx.setTransform(2, 0, 0, 2, 0, 0)
    ctx.globalAlpha = 1; ctx.shadowBlur = 0
    ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.strokeStyle = colors[1]; ctx.lineWidth = 1
    if (s.phase === 'idle') {
      const pulse = reducedMotion ? .8 : .76 + Math.sin(idleTime * 1.5) * .1
      ctx.shadowColor = colors[1]; ctx.shadowBlur = reducedMotion ? 0 : 3 + pulse * 4
      ctx.globalAlpha = 0.3; ctx.strokeRect(28.5, 28.5, WIDTH - 57, HEIGHT - 57); ctx.globalAlpha = 1
      text('GAMEBOY OS', WIDTH / 2, 124, 26, 'center')
      text('VECTOR FIELD / 001', WIDTH / 2, 150, 10, 'center')
      ctx.globalAlpha = pulse; text('READY', WIDTH / 2, 232, 21, 'center'); ctx.globalAlpha = 1
      text('PRESS PLAY', WIDTH / 2, 270, 13, 'center')
      for (let i = 0; i < 7; i++) {
        const height = attracting && !reducedMotion ? 5 + (Math.sin(idleTime * 2.2 + i * .8) + 1) * 5 : 7
        ctx.globalAlpha = attracting ? .58 : .3
        ctx.fillStyle = colors[1]; ctx.fillRect(WIDTH / 2 - 31 + i * 10, 184 - height, 5, height)
      }
      ctx.globalAlpha = 1
      if (!reducedMotion) {
        const scanY = 34 + (idleTime * 19) % (HEIGHT - 68)
        ctx.fillStyle = colors[2]; ctx.globalAlpha = .035; ctx.fillRect(29, scanY, WIDTH - 58, 5); ctx.globalAlpha = 1
      }
    } else {
      ctx.save()
      if (s.shake && !reducedMotion) ctx.translate(Math.sin(s.time * 113) * s.shake * 7, Math.cos(s.time * 137) * s.shake * 7)
      ctx.shadowColor = colors[1]; ctx.shadowBlur = 3
      for (const h of s.hazards) copies(h, h.radius + 3, () => {
        ctx.rotate(h.angle); ctx.strokeStyle = h.hit ? colors[2] : colors[1]
        ctx.lineWidth = h.hit ? 1.8 : 1
        line(h.vertices.map(v => [Math.cos(v.angle) * v.radius * h.radius, Math.sin(v.angle) * v.radius * h.radius]), true)
        ctx.globalAlpha = 0.4
        if (h.kind === 'large') line([[-h.radius * 0.5, 0], [0, -h.radius * 0.35], [h.radius * 0.5, h.radius * 0.25]])
        if (h.kind === 'drifter') line([[-6, -4], [4, 0], [-6, 4]])
        if (h.kind === 'hunter') line([[-6, 0], [0, -6], [6, 0], [0, 6]], true)
        if (h.kind === 'pulse') { ctx.globalAlpha = h.charge < 0.7 ? 0.9 : 0.35; ctx.beginPath(); ctx.arc(0, 0, 7 + Math.max(0, 0.7 - h.charge) * 10, 0, Math.PI * 2); ctx.stroke() }
        ctx.globalAlpha = 1
      })
      ctx.strokeStyle = colors[2]; ctx.lineWidth = 1
      for (const b of s.bullets) copies(b, 6, () => { const length = Math.hypot(b.vx, b.vy); line([[0, 0], [-b.vx / length * 5, -b.vy / length * 5]]) })
      for (const r of s.rings) copies(r, r.radius, () => { ctx.globalAlpha = Math.min(0.65, r.life); ctx.beginPath(); ctx.arc(0, 0, r.radius, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1 })
      for (const bit of s.particles) {
        ctx.globalAlpha = Math.min(0.7, bit.life * 2)
        line([[bit.x, bit.y], [bit.x - bit.vx * 0.035, bit.y - bit.vy * 0.035]])
      }
      ctx.globalAlpha = p.invulnerable && Math.floor(s.time * 7) % 2 ? 0.3 : 1
      if (s.phase !== 'over') copies(p, 18, () => {
        ctx.rotate(p.angle); ctx.lineWidth = 1.3
        // Original split-tail dart, with an inset flight-axis mark.
        line([[13, 0], [-9, -8], [-5, 0], [-9, 8]], true)
        line([[2, 0], [-2, 0]])
        if (p.thrust || p.dash) {
          ctx.globalAlpha *= 0.65
          line([[-9, -3], [-15 - (p.dash ? 10 : 4) * (0.5 + Math.sin(s.time * 45) * 0.5), 0], [-9, 3]])
        }
      })
      ctx.restore()
      ctx.globalAlpha = 1; ctx.shadowBlur = 0
      if (s.flash && !reducedMotion) { ctx.fillStyle = colors[2]; ctx.globalAlpha = s.flash * 0.4; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.globalAlpha = 1 }
      // Keep the toroidal playfield visible under the floating HUD at the edges.
      ctx.shadowColor = colors[0]; ctx.shadowBlur = 3
      text(`SCORE ${String(s.score).padStart(6, '0')}`, 14, 20)
      text(`WAVE ${String(s.wave).padStart(2, '0')}`, WIDTH / 2, 20, 10, 'center')
      text(`LIVES × ${s.lives}`, WIDTH - 14, 20, 10, 'right')
      text(`HIGH ${String(s.highScore).padStart(6, '0')}`, 14, HEIGHT - 10)
      text(p.cooldown ? `BOOST ${p.cooldown.toFixed(1)}` : 'BOOST READY', WIDTH - 14, HEIGHT - 10, 10, 'right')
      if (s.waveDelay && s.phase === 'playing') text('FIELD CLEAR', WIDTH / 2, HEIGHT / 2, 16, 'center', colors[2])
      if (s.phase === 'over' || paused) {
        ctx.fillStyle = colors[0]; ctx.globalAlpha = 0.94; ctx.fillRect(75, 137, WIDTH - 150, 124); ctx.globalAlpha = 1
        text(paused ? 'PAUSED' : 'GAME OVER', WIDTH / 2, 174, 24, 'center', colors[2])
        text(paused ? 'RETURN TO PLAY' : `SCORE ${s.score}`, WIDTH / 2, 202, 12, 'center')
        if (!paused) text('PRESS SPACE TO RETRY', WIDTH / 2, 237, 11, 'center')
      }
    }
    ctx.shadowBlur = 0
    ctx.globalAlpha = 0.035; ctx.fillStyle = '#000000'
    for (let y = 0; y < HEIGHT; y += 3) ctx.fillRect(0, y, WIDTH, 0.5)
    ctx.globalAlpha = 1
    texture.needsUpdate = true
  }
  draw()
  return { canvas, texture, game, draw,
    tickIdle(dt) { if (game.state.phase !== 'idle') return; idleTime += dt; draw() },
    setAttract(value) { if (attracting === value) return; attracting = value; draw() },
    setTheme(name, customColor) {
      const next = gameThemes[name] ?? ['#10171a', customColor, '#e5ece3']
      if (theme === name && colors.join() === next.join()) return
      theme = name; colors = next; draw()
    },
    setPaused(value) { paused = value; draw() },
    setReducedMotion(value) { reducedMotion = value },
    get theme() { return theme },
  }
}
