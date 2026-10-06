import { test, expect } from '@playwright/test'

const inspect = page => page.evaluate(async () => {
  const { inspectViewer } = await import('/src/scene/viewer.js')
  return inspectViewer(document.querySelector('#scene'))
})

test('Atomic presentation survives front/rear orbit and Reset restores the camera', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && message.text().includes('THREE.')) errors.push(message.text()) })
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.goto('/')
  const canvas = page.locator('canvas[aria-label^="Handheld"]')
  await expect(canvas).toBeVisible()
  const initial = (await inspect(page)).camera
  await page.locator('[data-edition="Atomic"]').click()
  await page.evaluate(() => scrollTo(0, 0))
  const bounds = await canvas.boundingBox()
  await canvas.screenshot({ path: 'scripts/environment-previews/atomic-polished-front.png' })
  for (const view of ['side', 'rear', 'opposite-side']) {
    const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - bounds.height / 4, y, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(750)
    await canvas.screenshot({ path: `scripts/environment-previews/atomic-polished-${view}.png` })
  }
  expect((await inspect(page)).camera).not.toEqual(initial)
  await page.mouse.wheel(0, -120)
  await page.waitForTimeout(250)
  await page.locator('#reset').click()
  await page.waitForTimeout(500)
  const state = await inspect(page)
  for (let i = 0; i < 3; i++) expect(state.camera[i]).toBeCloseTo(initial[i], 6)
  expect(state.product.filter(mesh => mesh.name.startsWith('internal_')).every(mesh => !mesh.visible)).toBe(true)
  await expect(page.locator('#edition-selection')).toHaveText('Classic')
  expect(errors).toEqual([])
})

test('missing model keeps the fallback and controls usable', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('**/models/retro-handheld.glb', route => route.fulfill({ status: 404, body: '' }))
  await page.goto('/')
  await expect(page.locator('canvas[aria-label^="Temporary"]')).toBeVisible()
  await page.locator('[data-option="scene"][data-value="Arcade"]').click()
  await page.locator('[data-edition="Atomic"]').click()
  await expect(page.locator('.viewport')).toHaveAttribute('data-scene', 'Arcade')
  await expect(page.locator('#edition-selection')).toHaveText('Atomic')
  await page.locator('#reset').click()
  await expect(page.locator('#edition-selection')).toHaveText('Classic')
  await expect(page.locator('.viewport')).toHaveAttribute('data-scene', 'Arcade')
  expect(errors).toEqual([])
})
