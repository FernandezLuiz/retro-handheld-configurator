// One source for both the keyboard bindings and the instructions on screen.
// Bindings use event.code (a physical key position), so W/A/S/D keep their shape
// on any layout. Labels therefore have to name what that position prints here.
const NAMED_KEYS = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', Escape: 'Esc' }
const AZERTY = { KeyQ: 'a', KeyA: 'q', KeyW: 'z', KeyZ: 'w' }
let printed = {}
let layoutIsReported = false

export function keyName(code) {
  return NAMED_KEYS[code] ?? (printed[code] ?? code.replace('Key', '')).toUpperCase()
}
const key = (...codes) => ({ codes, get label() { return [...new Set(codes.map(keyName))].join(' / ') } })
const directions = [key('ArrowLeft', 'KeyA'), key('ArrowRight', 'KeyD')]
const fire = { label: 'Fire', actions: ['action'], keys: [key('Space', 'KeyZ')] }
export const gameControls = {
  vector: {
    title: 'VECTOR FIELD', description: 'Pilot a drifting ship. Break the field and survive each wave.',
    controls: [
      { label: 'Rotate', actions: ['left', 'right'], keys: directions },
      { label: 'Thrust', actions: ['up'], keys: [key('ArrowUp', 'KeyW')] },
      fire,
      { label: 'Boost', actions: ['boost'], keys: [key('ShiftLeft', 'ShiftRight', 'KeyX')] },
    ],
  },
  invaders: {
    title: 'SPACE INVADERS', description: 'Defend the barriers. Clear the descending formation.',
    controls: [{ label: 'Move', actions: ['left', 'right'], keys: directions }, fire],
  },
}
export const sessionControls = { restart: key('KeyR'), exit: key('Escape') }
export const retryLabel = () => `${sessionControls.restart.label} / ${fire.keys[0].label}`
export function bindingsFor(game) {
  return Object.fromEntries(gameControls[game].controls.flatMap(control => control.keys.flatMap((entry, i) => entry.codes.map(code => [code, control.actions[i]]))))
}
export function controlMarkup(game) {
  return gameControls[game].controls.map(control => `<span class="control-pair"><b>${control.label}</b><span>${control.keys.map(entry => `<kbd>${entry.label}</kbd>`).join(' ')}</span></span>`).join('')
}

export function setKeyboardLayout(map, reported = false) {
  printed = { ...map }
  layoutIsReported = reported
}
// Chromium reports the layout outright. Elsewhere, start from the locale's usual
// layout and correct it from the first letter the player actually types.
export async function detectKeyboardLayout({ keyboard = globalThis.navigator?.keyboard, languages = globalThis.navigator?.languages ?? [] } = {}) {
  if (/^(fr(-(FR|BE|LU|MC))?|nl-BE)$/i.test(languages[0] ?? '')) setKeyboardLayout(AZERTY)
  if (!keyboard?.getLayoutMap) return
  try {
    const entries = [...(await keyboard.getLayoutMap()).entries()].filter(([code]) => code.startsWith('Key'))
    if (entries.length) setKeyboardLayout(Object.fromEntries(entries), true)
  } catch { /* A blocked API leaves the locale guess in place. */ }
}
export function learnKeyboardLayout({ code, key: character, altKey, ctrlKey, metaKey }) {
  if (layoutIsReported || altKey || ctrlKey || metaKey || !code?.startsWith('Key') || character?.length !== 1) return false
  const typed = character.toLowerCase()
  if (typed === (printed[code] ?? code.slice(3).toLowerCase())) return false
  printed = AZERTY[code] === typed ? { ...printed, ...AZERTY } : { ...printed, [code]: typed }
  return true
}
