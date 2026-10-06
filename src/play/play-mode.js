import { createGameSurface } from './surface.js'
import { createSpaceInvadersSurface } from './space-invaders-surface.js'
import './play.css'

const bindings = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', KeyZ: 'action', Space: 'action', KeyX: 'boost', ShiftLeft: 'boost', ShiftRight: 'boost' }
export function createPlayMode(viewer, app, button) {
  const surfaces = { vector: createGameSurface(), invaders: createSpaceInvadersSurface() }
  let selectedGame = 'vector'
  let surface = surfaces[selectedGame]
  viewer.setScreenTexture(surface.texture)
  const overlay = document.createElement('section')
  overlay.className = 'play-overlay'
  overlay.hidden = true
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-labelledby', 'game-title')
  overlay.tabIndex = -1
  overlay.innerHTML = `
    <div class="game-shell">
      <header class="game-header"><div><span class="eyebrow">GAMEBOY OS / SYSTEM 01</span><h2 id="game-title">GAME LIBRARY</h2></div><button type="button" class="game-exit">Exit Game <span>ESC</span></button></header>
      <div class="game-picker" aria-labelledby="game-picker-title">
        <div class="game-picker-intro"><span class="game-os-status"><i aria-hidden="true"></i> SYSTEM READY</span><span class="game-os-count">02 PROGRAMS LOADED</span></div>
        <div class="game-picker-heading"><span class="eyebrow">YOUR NEXT DISTRACTION</span><h3 id="game-picker-title">Choose a program<span aria-hidden="true">_</span></h3><p>Select a game to launch on your handheld.</p></div>
        <div class="game-picker-options">
          <button type="button" data-game="vector"><span class="game-card-index">01 / ARCADE</span><span class="game-card-glyph vector-glyph" aria-hidden="true"><i></i><i></i><i></i></span><span class="game-card-copy"><strong>VECTOR FIELD</strong><small>Rotate · Thrust · Survive</small></span><span class="game-card-launch" aria-hidden="true">↗</span></button>
          <button type="button" data-game="invaders"><span class="game-card-index">02 / DEFENSE</span><span class="game-card-glyph invaders-glyph" aria-hidden="true"><i></i><i></i><i></i></span><span class="game-card-copy"><strong>SPACE INVADERS</strong><small>Move · Fire · Defend</small></span><span class="game-card-launch" aria-hidden="true">↗</span></button>
        </div>
        <div class="game-picker-footer"><span>FORM / PLAY SYSTEM</span><span>SELECT A PROGRAM TO BEGIN →</span></div>
      </div>
      <div class="game-display"></div>
      <div class="game-status"><span class="game-score" aria-live="off">SCORE 00000</span><span class="game-message" role="status"></span><button type="button" class="game-restart">Restart</button></div>
      <p class="game-hints">← → / A D — ROTATE · ↑ / W — THRUST · SPACE / Z — FIRE · SHIFT / X — BOOST</p>
      <div class="game-touch" aria-label="Touch game controls">
        <div class="touch-pad"><button data-key="up" aria-label="Thrust">↑</button><button data-key="left" aria-label="Rotate left">←</button><button disabled aria-label="No reverse thrust">↓</button><button data-key="right" aria-label="Rotate right">→</button></div>
        <div class="touch-actions"><button data-key="action">Z<span>Fire</span></button><button data-key="boost">X<span>Boost</span></button></div>
      </div>
    </div>`
  overlay.querySelector('.game-display').appendChild(surface.canvas)
  document.body.appendChild(overlay)
  const exitButton = overlay.querySelector('.game-exit')
  const restartButton = overlay.querySelector('.game-restart')
  const score = overlay.querySelector('.game-score')
  const message = overlay.querySelector('.game-message')
  const title = overlay.querySelector('#game-title')
  const hints = overlay.querySelector('.game-hints')
  const picker = overlay.querySelector('.game-picker')
  const display = overlay.querySelector('.game-display')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const lifetime = new AbortController()
  let keyboard = null
  let phase = 'idle'
  let accumulator = 0, paintTime = 0, idlePaintTime = 0
  let paused = false
  let focusBefore = null, previousOverflow = '', previousPadding = ''
  const pressed = new Map()
  const keys = new Set()
  function syncKeys() {
    keys.clear()
    for (const action of pressed.values()) keys.add(action)
    // Keep the existing viewer's button-B channel; boost replaces the old action.
    viewer.setButtonFeedback(new Set([...keys].map(key => key === 'boost' ? 'brake' : key)))
  }
  function clearKeys() { pressed.clear(); syncKeys() }
  function restart() {
    if (phase !== 'playing') return
    clearKeys(); surface.game.restart(); accumulator = 0; surface.draw()
    message.textContent = ''
    overlay.focus({ preventScroll: true })
  }
  function chooseGame(name) {
    if (phase !== 'selecting' || !surfaces[name]) return
    selectedGame = name
    surface = surfaces[name]
    display.replaceChildren(surface.canvas)
    viewer.setScreenTexture(surface.texture)
    surface.setReducedMotion(reducedMotion.matches)
    title.textContent = name === 'vector' ? 'VECTOR FIELD' : 'SPACE INVADERS'
    hints.textContent = name === 'vector'
      ? '← → / A D — ROTATE · ↑ / W — THRUST · SPACE / Z — FIRE · SHIFT / X — BOOST'
      : '← → / A D — MOVE · SPACE / Z — FIRE'
    overlay.dataset.currentGame = name
    phase = 'playing'; overlay.dataset.phase = phase
    surface.game.restart(); surface.draw(); accumulator = paintTime = 0
    message.textContent = name === 'vector' ? 'Rotate. Thrust. Clear the field.' : 'Move. Fire. Hold the line.'
    overlay.focus({ preventScroll: true })
  }
  function setPaused(value) {
    paused = value; accumulator = 0; clearKeys(); surface.setPaused(value)
    if (phase === 'playing') message.textContent = value ? 'Paused — return to the game' : ''
  }
  function enter() {
    if (phase !== 'idle' || !viewer.canPlay()) return
    phase = 'entering'
    title.textContent = 'GAME LIBRARY'
    surface.setReducedMotion(reducedMotion.matches)
    accumulator = paintTime = 0
    focusBefore = document.activeElement
    previousOverflow = document.body.style.overflow
    previousPadding = document.body.style.paddingRight
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`
    document.body.style.overflow = 'hidden'
    app.inert = true
    document.body.classList.add('in-play-mode')
    overlay.hidden = false
    overlay.dataset.phase = phase
    overlay.focus({ preventScroll: true })
    viewer.setPlayMode(true, reducedMotion.matches)
    keyboard = new AbortController()
    const signal = keyboard.signal
    window.addEventListener('keydown', event => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.code === 'Escape') { event.preventDefault(); exit(); return }
      if (event.code === 'Tab') {
        const buttons = [...overlay.querySelectorAll('button')].filter(node => node.getClientRects().length && !node.disabled)
        const index = buttons.indexOf(document.activeElement)
        event.preventDefault()
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
        return
      }
      // Leave native button activation intact when Space is used on a control.
      if (event.code === 'Space' && event.target instanceof HTMLButtonElement) return
      const action = bindings[event.code]
      if (action) {
        event.preventDefault()
        if (action === 'action' && surface.game.state.phase === 'over' && !event.repeat) { restart(); return }
        pressed.set(event.code, action); syncKeys()
      }
      if (event.code === 'KeyR' && !event.repeat) { event.preventDefault(); restart() }
    }, { signal })
    window.addEventListener('keyup', event => {
      if (bindings[event.code]) { event.preventDefault(); pressed.delete(event.code); syncKeys() }
    }, { signal })
    window.addEventListener('blur', () => setPaused(true), { signal })
    window.addEventListener('focus', () => { if (!document.hidden) setPaused(false) }, { signal })
    document.addEventListener('visibilitychange', () => setPaused(document.hidden), { signal })
  }
  function exit() {
    if (phase === 'idle' || phase === 'exiting') return
    phase = 'exiting'
    overlay.dataset.phase = phase
    clearKeys()
    viewer.setPlayMode(false, reducedMotion.matches)
    // The game is frozen during the return journey; its last frame remains visible.
  }
  function finishExit() {
    keyboard?.abort(); keyboard = null
    clearKeys()
    paused = false
    surface.game.idle(); surface.setPaused(false)
    phase = 'idle'
    overlay.hidden = true
    document.body.classList.remove('in-play-mode')
    document.body.style.overflow = previousOverflow
    document.body.style.paddingRight = previousPadding
    app.inert = false
    if (focusBefore?.isConnected) focusBefore.focus({ preventScroll: true })
    focusBefore = null
  }
  function update(dt) {
    if (button.disabled === viewer.canPlay()) {
      button.disabled = !viewer.canPlay()
      button.title = button.disabled ? 'Play becomes available when the handheld loads' : 'Play VECTOR FIELD'
    }
    if (phase === 'idle') {
      surface.setAttract(viewer.attracting && !reducedMotion.matches)
      idlePaintTime += dt
      if (idlePaintTime >= 1 / 12) {
        surface.tickIdle(idlePaintTime)
        idlePaintTime = 0
      }
      return
    }
    const progress = viewer.playProgress
    overlay.style.setProperty('--reveal', String(Math.max(0, Math.min(1, (progress - 0.65) / 0.35))))
    document.body.style.setProperty('--play-dim', String(progress))
    overlay.style.setProperty('--pixel-transition', String(reducedMotion.matches ? 0 : Math.sin(progress * Math.PI) * 0.09))
    if (phase === 'entering' && progress === 1) {
      phase = 'selecting'; overlay.dataset.phase = phase
      message.textContent = ''
      picker.querySelector(`[data-game="${selectedGame}"]`)?.focus({ preventScroll: true })
    }
    if (phase === 'exiting' && progress === 0) { finishExit(); return }
    if (phase !== 'playing' || paused) return
    accumulator += dt; paintTime += dt
    while (accumulator >= 1 / 120) { surface.game.step(1 / 120, keys); accumulator -= 1 / 120 }
    if (paintTime >= 1 / 60) {
      paintTime %= 1 / 60
      surface.draw()
      score.textContent = `SCORE ${String(surface.game.state.score).padStart(5, '0')}`
      if (surface.game.state.phase === 'over') message.textContent = 'Game over — Space to retry'
    }
  }
  button.addEventListener('click', enter, { signal: lifetime.signal })
  exitButton.addEventListener('click', exit, { signal: lifetime.signal })
  restartButton.addEventListener('click', restart, { signal: lifetime.signal })
  picker.addEventListener('click', event => chooseGame(event.target.closest('[data-game]')?.dataset.game), { signal: lifetime.signal })
  overlay.addEventListener('pointerdown', event => {
    const control = event.target.closest('[data-key]')
    if (!control || phase !== 'playing') return
    event.preventDefault(); control.setPointerCapture(event.pointerId)
    if (control.dataset.key === 'action' && surface.game.state.phase === 'over') { restart(); return }
    pressed.set(`pointer:${event.pointerId}`, control.dataset.key); syncKeys()
  }, { signal: lifetime.signal })
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) overlay.addEventListener(name, event => {
    pressed.delete(`pointer:${event.pointerId}`); syncKeys()
  }, { signal: lifetime.signal })
  viewer.setFrameHandler(update, () => ({ phase, selectedGame, theme: surface.theme, keyboardActive: Boolean(keyboard), pressed: [...keys], game: structuredClone(surface.game.state) }))
  return {
    get active() { return phase !== 'idle' },
    setTheme(edition, screenColor) { Object.values(surfaces).forEach(item => item.setTheme(edition ?? 'Custom', screenColor)) },
    dispose() {
      lifetime.abort(); keyboard?.abort()
      if (phase !== 'idle') finishExit()
      viewer.setFrameHandler(null, null)
      overlay.remove()
      Object.values(surfaces).forEach(item => { if (item !== surface) item.texture.dispose() })
      // Viewer/model disposal owns the CanvasTexture, including failed loads.
    },
  }
}
