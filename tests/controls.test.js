import test from 'node:test'
import assert from 'node:assert/strict'
import { bindingsFor, gameControls, keyName, sessionControls, retryLabel, setKeyboardLayout, detectKeyboardLayout, learnKeyboardLayout } from '../src/play/controls.js'

const labels = game => Object.fromEntries(gameControls[game].controls.map(control => [control.label, control.keys.map(entry => entry.label)]))
const AZERTY_MAP = new Map([['KeyQ', 'a'], ['KeyA', 'q'], ['KeyW', 'z'], ['KeyZ', 'w'], ['KeyD', 'd'], ['KeyX', 'x'], ['KeyR', 'r'], ['Digit1', '&']])

test('QWERTY labels name the bound physical keys', () => {
  setKeyboardLayout({})
  assert.deepEqual(labels('vector'), { Rotate: ['← / A', '→ / D'], Thrust: ['↑ / W'], Fire: ['Space / Z'], Boost: ['Shift / X'] })
  assert.deepEqual(labels('invaders'), { Move: ['← / A', '→ / D'], Fire: ['Space / Z'] })
  assert.equal(sessionControls.exit.label, 'Esc')
  assert.equal(retryLabel(), 'R / Space / Z')
})

test('a reported AZERTY layout relabels keys without moving a single binding', async () => {
  setKeyboardLayout({})
  const before = { vector: bindingsFor('vector'), invaders: bindingsFor('invaders') }
  await detectKeyboardLayout({ keyboard: { getLayoutMap: async () => AZERTY_MAP }, languages: ['en-US'] })
  assert.deepEqual(labels('vector'), { Rotate: ['← / Q', '→ / D'], Thrust: ['↑ / Z'], Fire: ['Space / W'], Boost: ['Shift / X'] })
  assert.deepEqual(labels('invaders'), { Move: ['← / Q', '→ / D'], Fire: ['Space / W'] })
  assert.equal(retryLabel(), 'R / Space / W')
  assert.deepEqual(bindingsFor('vector'), before.vector)
  assert.deepEqual(bindingsFor('invaders'), before.invaders)
  // A reported layout is authoritative: typed characters cannot overrule it.
  assert.equal(learnKeyboardLayout({ code: 'KeyA', key: 'a' }), false)
  assert.equal(keyName('KeyA'), 'Q')
})

test('without the layout API, the locale guesses and the first typed letter corrects', async () => {
  for (const language of ['fr-BE', 'nl-BE', 'fr-FR', 'fr']) {
    setKeyboardLayout({})
    await detectKeyboardLayout({ keyboard: undefined, languages: [language] })
    assert.equal(keyName('KeyW'), 'Z', language)
  }
  for (const language of ['en-US', 'nl-NL', 'fr-CA']) {
    setKeyboardLayout({})
    await detectKeyboardLayout({ keyboard: undefined, languages: [language] })
    assert.equal(keyName('KeyW'), 'W', language)
  }
  setKeyboardLayout({})
  assert.equal(learnKeyboardLayout({ code: 'KeyA', key: 'q' }), true)
  assert.deepEqual([keyName('KeyA'), keyName('KeyW'), keyName('KeyZ')], ['Q', 'Z', 'W'])
  assert.equal(learnKeyboardLayout({ code: 'KeyA', key: 'Q' }), false, 'Shift or Caps Lock is not a layout change')
  // A wrong locale guess heals the same way, and shortcuts teach nothing.
  setKeyboardLayout({ KeyA: 'q', KeyW: 'z' })
  assert.equal(learnKeyboardLayout({ code: 'KeyA', key: 'a', metaKey: true }), false)
  assert.equal(learnKeyboardLayout({ code: 'KeyA', key: 'a' }), true)
  assert.equal(keyName('KeyA'), 'A')
  setKeyboardLayout({})
})
