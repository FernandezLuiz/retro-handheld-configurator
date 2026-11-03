import { test, expect } from '@playwright/test'

const inspect = page => page.evaluate(async () => (await import('/src/scene/viewer.js')).inspectViewer(document.querySelector('#scene')))
const phase = (page, value) => expect.poll(async () => (await inspect(page))?.play.phase, { timeout: 20000 }).toBe(value)
const canvasCenter = async page => {
  const box = await page.locator('#scene canvas').boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test.describe('keyboard labels', () => {
  test('a reported AZERTY layout relabels hints, and those physical keys drive the game', async ({ page }) => {
    await page.addInitScript(() => {
      const map = new Map([['KeyQ', 'a'], ['KeyA', 'q'], ['KeyW', 'z'], ['KeyZ', 'w'], ['KeyD', 'd'], ['KeyX', 'x'], ['KeyR', 'r']])
      Object.defineProperty(navigator, 'keyboard', { value: { getLayoutMap: async () => map } })
    })
    await page.goto('/')
    await expect(page.locator('#play')).toBeEnabled()
    await page.locator('#play').click()
    await phase(page, 'selecting')
    await expect(page.locator('[data-game="invaders"]')).toContainText('← / Q')
    await expect(page.locator('[data-game="invaders"]')).toContainText('Space / W')
    await expect(page.locator('[data-game="vector"]')).toContainText('↑ / Z')
    await page.locator('[data-game="vector"]').click()
    await phase(page, 'playing')
    await expect(page.locator('.game-hints')).toContainText('↑ / Z')
    await expect(page.locator('.game-hints')).toContainText('← / Q')
    // Playwright presses by physical code: the key printed Z here is the code KeyW.
    await page.keyboard.down('KeyW')
    await expect.poll(async () => (await inspect(page)).play.pressed).toContain('up')
    await page.keyboard.up('KeyW')
    await page.keyboard.down('KeyA')
    await expect.poll(async () => (await inspect(page)).play.pressed).toContain('left')
    await page.keyboard.up('KeyA')
    await page.keyboard.down('KeyZ')
    await expect.poll(async () => (await inspect(page)).play.pressed).toContain('action')
    await page.keyboard.up('KeyZ')
  })

  test('without the layout API, the first typed letter corrects the labels', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'keyboard', { value: undefined }))
    await page.goto('/')
    await expect(page.locator('#play')).toBeEnabled()
    await page.locator('#play').click()
    await phase(page, 'selecting')
    await expect(page.locator('[data-game="invaders"]')).toContainText('← / A')
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'q' })))
    await expect(page.locator('[data-game="invaders"]')).toContainText('← / Q')
    await expect(page.locator('[data-game="vector"]')).toContainText('↑ / Z')
  })
})

test.describe('desktop', () => {
  test('the wheel still zooms where the viewer sits beside the controls', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#play')).toBeEnabled()
    const before = (await inspect(page)).orbitLimits.currentDistance
    const { x, y } = await canvasCenter(page)
    await page.mouse.move(x, y)
    await page.mouse.wheel(0, -600)
    await expect.poll(async () => (await inspect(page)).orbitLimits.currentDistance).toBeLessThan(before)
    expect(await page.evaluate(() => scrollY)).toBe(0)
  })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('vertical swipes scroll the page, sideways swipes orbit, and Play Mode owns every touch', async ({ page, context }) => {
    test.setTimeout(150_000)
    await page.goto('/')
    await expect(page.locator('#play')).toBeEnabled()
    const canvas = page.locator('#scene canvas')
    expect(await canvas.evaluate(node => getComputedStyle(node).touchAction)).toBe('pan-y')
    await expect(page.locator('.hint-touch')).toBeVisible()
    await expect(page.locator('.hint-pointer')).toBeHidden()
    const start = await inspect(page)
    const { x, y } = await canvasCenter(page)
    const client = await context.newCDPSession(page)
    const swipe = (xDistance, yDistance) => client.send('Input.synthesizeScrollGesture', { x, y, xDistance, yDistance, gestureSourceType: 'touch', speed: 1200 })
    // Start on the middle of the product: the worst case for a scroll being captured.
    await swipe(0, -320)
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(120)
    const scrolled = await inspect(page)
    expect(scrolled.camera).toEqual(start.camera)
    expect(scrolled.orbitLimits.currentDistance).toBe(start.orbitLimits.currentDistance)

    await page.evaluate(() => scrollTo(0, 0))
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
    await swipe(-140, 0)
    await expect.poll(async () => (await inspect(page)).camera).not.toEqual(start.camera)
    expect(await page.evaluate(() => scrollY)).toBe(0)

    await page.locator('#reset').click()
    await page.evaluate(() => scrollTo(0, 0))
    await page.locator('#play').click()
    await phase(page, 'selecting')
    // Touch screens get the handheld's controls rather than a keyboard legend.
    await expect(page.locator('[data-game="vector"] .game-card-touch')).toBeVisible()
    await expect(page.locator('[data-game="vector"] .game-card-controls')).toBeHidden()
    await page.locator('[data-game="vector"]').click()
    await phase(page, 'playing')
    expect(await page.locator('#scene canvas').evaluate(node => getComputedStyle(node).touchAction)).toBe('none')
    await page.locator('.game-exit').click()
    await phase(page, 'idle')
    expect(await page.locator('#scene canvas').evaluate(node => getComputedStyle(node).touchAction)).toBe('pan-y')
  })

  test('a mouse wheel over the stacked viewer scrolls the page instead of zooming', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 700, height: 800 } })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page.locator('#play')).toBeEnabled()
    const before = (await inspect(page)).orbitLimits.currentDistance
    const { x, y } = await canvasCenter(page)
    await page.mouse.move(x, y)
    await page.mouse.wheel(0, 400)
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100)
    expect((await inspect(page)).orbitLimits.currentDistance).toBe(before)
    await context.close()
  })
})
