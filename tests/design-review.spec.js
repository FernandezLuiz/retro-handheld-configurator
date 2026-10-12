import { test, expect } from '@playwright/test'
import { gameControls, bindingsFor } from '../src/play/controls.js'

const inspect = page => page.evaluate(async () => (await import('/src/scene/viewer.js')).inspectViewer(document.querySelector('#scene')))
const phase = (page, value) => expect.poll(async () => (await inspect(page))?.play.phase, { timeout: 12000 }).toBe(value)
async function buttonPoint(page, name) {
  const { ndc } = (await inspect(page)).buttonTargets.find(button => button.name === name)
  const rect = await page.locator('#scene canvas').boundingBox()
  return { x: rect.x + (ndc[0] + 1) * rect.width / 2, y: rect.y + (1 - ndc[1]) * rect.height / 2 }
}

test('physical controls depress independently, release exactly, and leave orbit usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('#play')).toBeEnabled()
  for (const name of ['button_a', 'button_b', 'dpad', 'start_button', 'select_button']) {
    const point = await buttonPoint(page, name)
    const before = await inspect(page)
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await expect.poll(async () => (await inspect(page)).buttonFeedback.find(button => button.name === name)).not.toEqual(before.buttonFeedback.find(button => button.name === name))
    const pressed = await inspect(page)
    expect(pressed.controlsEnabled).toBe(false)
    expect(pressed.buttonFeedback.filter(button => button.name !== name)).toEqual(before.buttonFeedback.filter(button => button.name !== name))
    await page.mouse.move(point.x + 60, point.y + 20, { steps: 3 })
    expect((await inspect(page)).camera).toEqual(before.camera)
    await page.mouse.up()
    await expect.poll(async () => (await inspect(page)).buttonFeedback).toEqual(before.buttonFeedback)
    expect((await inspect(page)).controlsEnabled).toBe(true)
  }
  const beforeOrbit = (await inspect(page)).camera
  const rect = await page.locator('#scene canvas').boundingBox()
  await page.mouse.move(rect.x + 30, rect.y + rect.height / 2)
  await page.mouse.down()
  await page.mouse.move(rect.x + 130, rect.y + rect.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await inspect(page)).camera).not.toEqual(beforeOrbit)
  await page.locator('#reset').click()
  expect((await inspect(page)).controlsEnabled).toBe(true)
})

test('touch presses and cancellations restore the physical controls on mobile', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('#play')).toBeEnabled()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  const point = await buttonPoint(page, 'button_a')
  const before = await inspect(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] })
  await expect.poll(async () => (await inspect(page)).buttonFeedback.find(button => button.name === 'button_a').position[2]).toBeLessThan(0)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await expect.poll(async () => (await inspect(page)).buttonFeedback).toEqual(before.buttonFeedback)
  expect((await inspect(page)).camera).toEqual(before.camera)
  expect((await inspect(page)).controlsEnabled).toBe(true)
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    const swatch = await page.locator('.swatch').first().boundingBox()
    expect(swatch.width).toBeGreaterThanOrEqual(44)
    expect(swatch.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('#play').click()
  await phase(page, 'selecting')
  await page.screenshot({ path: '/tmp/review-launcher-mobile.png' })
  const picker = await page.locator('.game-picker').boundingBox()
  expect(picker.x).toBeGreaterThanOrEqual(0)
  expect(picker.x + picker.width).toBeLessThanOrEqual(390)
  await page.locator('[data-game="invaders"]').click()
  await phase(page, 'playing')
  await expect(page.locator('[data-key="left"]')).toHaveAttribute('aria-label', 'Move left')
  await page.screenshot({ path: '/tmp/review-game-mobile.png' })
  await page.locator('.game-exit').click()
  await phase(page, 'idle')
})

test('both launch descriptions and every advertised key match the live game actions', async ({ page }) => {
  test.setTimeout(120000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('#play')).toBeEnabled()
  for (const id of ['vector', 'invaders']) {
    await page.locator('#play').click()
    await phase(page, 'selecting')
    const card = page.locator(`[data-game="${id}"]`)
    await expect(card).toContainText(gameControls[id].description)
    await expect(card).toContainText('Space / Z')
    await page.screenshot({ path: `/tmp/review-launcher-${id}.png` })
    await card.click()
    await phase(page, 'playing')
    for (const [code, action] of Object.entries(bindingsFor(id))) {
      await page.keyboard.press('KeyR')
      const initial = (await inspect(page)).play.game
      await page.keyboard.down(code)
      await expect.poll(async () => (await inspect(page)).play.pressed).toContain(action)
      if (action === 'action') await expect.poll(async () => (await inspect(page)).play.game.shots).toBeGreaterThan(initial.shots)
      else if (action === 'boost') await expect.poll(async () => (await inspect(page)).play.game.player.cooldown).toBeGreaterThan(0)
      else if (action === 'up') await expect.poll(async () => (await inspect(page)).play.game.player.thrust).toBe(true)
      else {
        const axis = id === 'vector' ? 'angle' : 'x'
        const assertion = expect.poll(async () => (await inspect(page)).play.game.player[axis])
        if (action === 'left') await assertion.toBeLessThan(initial.player[axis])
        else await assertion.toBeGreaterThan(initial.player[axis])
      }
      await page.keyboard.up(code)
      await expect.poll(async () => (await inspect(page)).play.pressed).not.toContain(action)
    }
    await expect(page.locator('.game-hints')).toContainText('RestartR')
    await expect(page.locator('.game-hints')).toContainText('ExitEsc')
    await page.keyboard.press('KeyR')
    expect((await inspect(page)).play.game.lives).toBe(3)
    await page.keyboard.press('Escape')
    await phase(page, 'idle')
  }
})
