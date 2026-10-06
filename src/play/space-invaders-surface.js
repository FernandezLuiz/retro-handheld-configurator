import * as THREE from 'three'
import { WIDTH, HEIGHT } from './game.js'
import { createSpaceInvaders } from './space-invaders.js'
import { gameThemes } from './surface.js'

export function createSpaceInvadersSurface() {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * 2; canvas.height = HEIGHT * 2
  canvas.setAttribute('aria-label', 'Gameboy Space Invaders game screen')
  const ctx = canvas.getContext('2d', { alpha: false })
  const texture = new THREE.CanvasTexture(canvas)
  texture.name = 'space_invaders_live_canvas'
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.flipY = false
  const game = createSpaceInvaders()
  let theme = 'Classic', colors = gameThemes.Classic, paused = false, reducedMotion = false, idleTime = 0, attracting = false

  function text(value, x, y, size = 10, align = 'left', color = colors[1]) {
    ctx.fillStyle = color; ctx.font = `${size}px monospace`; ctx.textAlign = align; ctx.fillText(value, x, y)
  }
  function enemyShape(enemy) {
    const frames = [
      ['  ██  ', ' ████ ', '██████', '██  ██', ' █  █ '],
      [' ████ ', '██████', '██  ██', '██████', '█ ██ █'],
      ['  ██  ', ' ████ ', '██  ██', ' ████ ', '█ ██ █'],
    ][Math.min(2, enemy.row)]
    const pixel = 2.6
    frames.forEach((line, y) => [...line].forEach((cell, x) => { if (cell !== ' ') ctx.fillRect((x - 3) * pixel, (y - 2) * pixel, pixel, pixel) }))
  }
  function draw() {
    const state = game.state
    ctx.setTransform(2, 0, 0, 2, 0, 0)
    ctx.globalAlpha = 1; ctx.shadowBlur = 0
    ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, WIDTH, HEIGHT)
    if (state.phase === 'idle') {
      const pulse = reducedMotion ? .8 : .76 + Math.sin(idleTime * 1.5) * .1
      ctx.shadowColor = colors[1]; ctx.shadowBlur = reducedMotion ? 0 : 3 + pulse * 4
      ctx.strokeStyle = colors[1]; ctx.globalAlpha = .3; ctx.strokeRect(28.5, 28.5, WIDTH - 57, HEIGHT - 57); ctx.globalAlpha = 1
      text('GAMEBOY OS', WIDTH / 2, 124, 26, 'center')
      text('SPACE INVADERS / 002', WIDTH / 2, 150, 10, 'center')
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
      ctx.fillStyle = colors[1]
      for (const enemy of state.enemies) if (enemy.alive) { ctx.save(); ctx.translate(enemy.x, enemy.y); enemyShape(enemy); ctx.restore() }
      for (const block of state.shields) { ctx.globalAlpha = block.hp === 1 ? .48 : .82; ctx.fillRect(block.x - block.w / 2, block.y - block.h / 2, block.w, block.h) }
      ctx.globalAlpha = 1
      ctx.fillStyle = colors[2]
      for (const bullet of state.bullets) ctx.fillRect(bullet.x - 1, bullet.y - 5, 2, 10)
      for (const bullet of state.enemyBullets) { ctx.fillRect(bullet.x - 1.5, bullet.y - 4, 3, 8); ctx.fillRect(bullet.x - 4, bullet.y - 1, 8, 2) }
      if (state.phase !== 'over') {
        ctx.globalAlpha = state.player.invulnerable && Math.floor(state.time * 8) % 2 ? .3 : 1
        const x = state.player.x, y = state.player.y
        ctx.fillRect(x - 13, y + 2, 26, 6); ctx.fillRect(x - 8, y - 3, 16, 5); ctx.fillRect(x - 2, y - 8, 4, 5)
      }
      ctx.globalAlpha = 1
      text(`SCORE ${String(state.score).padStart(6, '0')}`, 14, 20)
      text(`WAVE ${String(state.wave).padStart(2, '0')}`, WIDTH / 2, 20, 10, 'center')
      text(`LIVES × ${state.lives}`, WIDTH - 14, 20, 10, 'right')
      text(`HIGH ${String(state.highScore).padStart(6, '0')}`, 14, HEIGHT - 10)
      if (state.waveDelay) text('SECTOR CLEAR', WIDTH / 2, HEIGHT / 2, 16, 'center', colors[2])
      if (state.phase === 'over' || paused) {
        ctx.fillStyle = colors[0]; ctx.globalAlpha = .94; ctx.fillRect(75, 137, WIDTH - 150, 124); ctx.globalAlpha = 1
        text(paused ? 'PAUSED' : 'GAME OVER', WIDTH / 2, 174, 24, 'center', colors[2])
        text(paused ? 'RETURN TO PLAY' : `SCORE ${state.score}`, WIDTH / 2, 202, 12, 'center')
        if (!paused) text('PRESS SPACE TO RETRY', WIDTH / 2, 237, 11, 'center')
      }
    }
    ctx.globalAlpha = .04; ctx.fillStyle = '#000'; for (let y = 0; y < HEIGHT; y += 3) ctx.fillRect(0, y, WIDTH, .5)
    ctx.globalAlpha = 1; texture.needsUpdate = true
  }
  draw()
  return { canvas, texture, game, draw,
    tickIdle(dt) { if (game.state.phase !== 'idle') return; idleTime += dt; draw() },
    setAttract(value) { if (attracting === value) return; attracting = value; draw() },
    setTheme(name, customColor) { theme = name; colors = gameThemes[name] ?? ['#10171a', customColor, '#e5ece3']; draw() },
    setPaused(value) { paused = value; draw() },
    setReducedMotion(value) { reducedMotion = value },
    get theme() { return theme },
  }
}
