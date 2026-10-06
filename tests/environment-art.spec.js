import { test, expect } from '@playwright/test'

for (const name of ['Studio', 'Retro Desk', 'Arcade', 'Dark Tech']) {
  test(`${name}: front, three-quarter and full orbit inspection`, async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error' && message.text().includes('THREE.')) errors.push(message.text()) })
    await page.route('https://fonts.googleapis.com/**', route => route.abort())
    await page.goto('/')
    const canvas = page.locator('canvas[aria-label^="Handheld"]')
    await expect(canvas).toBeVisible()
    await page.locator(`[data-option="scene"][data-value="${name}"]`).click()
    await page.evaluate(() => scrollTo(0, 0))
    const bounds = await canvas.boundingBox()
    const turn = async fraction => {
      const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + bounds.height * fraction, y, { steps: 14 })
      await page.mouse.up()
      await page.waitForTimeout(600)
    }
    // Remove the existing ~20 degree azimuth, then inspect a 45 degree view.
    await turn(Math.atan(0.36) / (Math.PI * 2))
    const stem = name.toLowerCase().replaceAll(' ', '-')
    await canvas.screenshot({ path: `scripts/environment-previews/${stem}-front.png` })
    await turn(-0.125)
    await canvas.screenshot({ path: `scripts/environment-previews/${stem}-three-quarter.png` })
    await turn(-0.25)
    await canvas.screenshot({ path: `scripts/environment-previews/${stem}-rear-quarter.png` })
    for (let i = 0; i < 3; i++) await turn(-0.25)
    await expect(page.locator('#edition-selection')).toHaveText('Classic')
    await expect(page.locator('.viewport')).toHaveAttribute('data-scene', name)
    expect(errors).toEqual([])
  })
}
