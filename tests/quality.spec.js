import { test, expect } from '@playwright/test'

const inspect = page => page.evaluate(async () => (await import('/src/scene/viewer.js')).inspectViewer(document.querySelector('#scene')))

test('premium pipeline renders every scene and material without errors; software GPUs take the plain path', async ({ page }) => {
  // Bloom and shadows are slow on software WebGL; this is a correctness check, not a benchmark.
  test.setTimeout(300_000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' || (message.type() === 'warning' && message.text().includes('THREE.'))) errors.push(message.text()) })
  await page.goto('/')
  await expect(page.locator('canvas[aria-label^="Handheld"]')).toBeVisible({ timeout: 60_000 })
  expect((await inspect(page)).quality.high).toBe(false)
  await page.goto('/?quality=high')
  await expect(page.locator('canvas[aria-label^="Handheld"]')).toBeVisible({ timeout: 60_000 })
  expect((await inspect(page)).quality).toEqual({ high: true, degraded: false })
  for (const name of ['Studio', 'Retro Desk', 'Dark Tech', 'Arcade']) {
    await page.locator(`[data-option="scene"][data-value="${name}"]`).click()
    await expect(page.locator('.viewport')).toHaveAttribute('data-scene', name)
    await page.waitForTimeout(800)
  }
  await page.locator('[data-option="material"][data-value="Translucent"]').click()
  await page.waitForTimeout(800)
  await expect(page.locator('[data-hud="material"]')).toHaveText('Translucent')
  await expect(page.locator('[data-hud="scene"]')).toHaveText('Arcade')
  // A real frame reached the screen: Arcade's neon gives many distinct colours.
  const colours = await page.locator('#scene canvas').screenshot().then(buffer => new Set(buffer.subarray(0, 40_000)).size)
  expect(colours).toBeGreaterThan(50)
  await page.locator('#play').click()
  await expect(page.locator('.play-overlay')).toHaveAttribute('data-phase', 'selecting', { timeout: 60_000 })
  await page.keyboard.press('Escape')
  await expect(page.locator('.play-overlay')).toBeHidden({ timeout: 60_000 })
  expect(errors).toEqual([])
})
