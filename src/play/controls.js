// One source for both the keyboard bindings and the instructions on screen.
const key = (label, ...codes) => ({ label, codes })
const directions = [key('← / A', 'ArrowLeft', 'KeyA'), key('→ / D', 'ArrowRight', 'KeyD')]
const fire = { label: 'Fire', actions: ['action'], keys: [key('Space / Z', 'Space', 'KeyZ')] }
export const gameControls = {
  vector: {
    title: 'VECTOR FIELD', description: 'Pilot a drifting ship. Break the field and survive each wave.',
    controls: [
      { label: 'Rotate', actions: ['left', 'right'], keys: directions },
      { label: 'Thrust', actions: ['up'], keys: [key('↑ / W', 'ArrowUp', 'KeyW')] },
      fire,
      { label: 'Boost', actions: ['boost'], keys: [key('Shift / X', 'ShiftLeft', 'ShiftRight', 'KeyX')] },
    ],
  },
  invaders: {
    title: 'SPACE INVADERS', description: 'Defend the barriers. Clear the descending formation.',
    controls: [{ label: 'Move', actions: ['left', 'right'], keys: directions }, fire],
  },
}
export const sessionControls = { restart: key('R', 'KeyR'), exit: key('Esc', 'Escape') }
export function bindingsFor(game) {
  return Object.fromEntries(gameControls[game].controls.flatMap(control => control.keys.flatMap((entry, i) => entry.codes.map(code => [code, control.actions[i]]))))
}
export function controlMarkup(game) {
  return gameControls[game].controls.map(control => `<span class="control-pair"><b>${control.label}</b><span>${control.keys.map(entry => `<kbd>${entry.label}</kbd>`).join(' ')}</span></span>`).join('')
}
