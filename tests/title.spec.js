import { test, expect } from '@playwright/test'
const inspect = page => page.evaluate(async () => (await import('/src/scene/viewer.js')).inspectViewer(document.querySelector('#scene')))
test('3D title fits common screen sizes and all scenes; missing title retains readable fallback', async ({ page }) => {
  await page.goto('/')
  await expect.poll(async () => (await inspect(page))?.title.ready).toBe(true)
  for (const width of [1920, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 701 ? 844 : 1000 })
    await page.waitForTimeout(400)
    const state = await inspect(page)
    // Default framing must remain inside the surrounding studio cove.
    expect(Math.hypot(...state.camera)).toBeLessThan(10.5)
    const { bounds } = state.title
    expect(bounds.minX).toBeGreaterThan(-.95)
    expect(bounds.maxX).toBeLessThan(.95)
    expect(Math.abs(bounds.minX + bounds.maxX)).toBeLessThan(.08)
    expect(bounds.minY).toBeGreaterThan(.65)
    expect(bounds.maxY).toBeLessThan(.95)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/title-mobile.png' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  for (const name of ['Studio', 'Retro Desk', 'Arcade', 'Dark Tech']) {
    await page.locator(`[data-option="scene"][data-value="${name}"]`).click()
    await page.waitForTimeout(400)
    expect((await inspect(page)).title.visible).toBe(true)
    await page.screenshot({ path: `/tmp/title-${name.replaceAll(' ', '-')}.png` })
  }
  await page.route('**/fonts/syne-title.json', route => route.abort())
  await page.reload()
  await expect(page.locator('#play')).toBeEnabled({ timeout: 30000 })
  await expect(page.locator('.viewport')).not.toHaveClass(/title-ready/)
  await expect(page.locator('h1')).toBeVisible()
})
