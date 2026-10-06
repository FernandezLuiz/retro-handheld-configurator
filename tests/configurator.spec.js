import { test, expect } from '@playwright/test'
import { defaults, editions, palettes, scenes } from '../src/configuration.js'

test('all controls, editions, scenes, rotation and Reset work in the browser', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('fonts.googleapis')) errors.push(message.text()) })
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.goto('/')
  await expect(page.locator('canvas[aria-label^="Handheld"]')).toBeVisible()
  await expect(page.locator('#edition-selection')).toHaveText('Classic')
  await expect(page.locator('.viewport')).toHaveAttribute('data-scene', defaults.scene)
  for (const name of Object.keys(scenes)) {
    await page.locator(`[data-option="scene"][data-value="${name}"]`).click()
    await expect(page.locator('.viewport')).toHaveAttribute('data-scene', name)
    await expect(page.locator('#edition-selection')).toHaveText('Classic')
  }
  for (const [name, settings] of Object.entries(editions)) {
    await page.locator(`[data-edition="${name}"]`).click()
    await expect(page.locator('#edition-selection')).toHaveText(name)
    for (const [key, value] of Object.entries(settings)) {
      await expect(page.locator(`[data-option="${key}"][data-value="${value}"]`)).toHaveAttribute('aria-pressed', 'true')
    }
    await expect(page.locator('.viewport')).toHaveAttribute('data-scene', 'Dark Tech')
    for (const scene of ['Arcade', 'Studio', 'Retro Desk', 'Dark Tech']) {
      await page.locator(`[data-option="scene"][data-value="${scene}"]`).click()
      await expect(page.locator('#edition-selection')).toHaveText(name)
      await expect(page.locator('.viewport')).toHaveAttribute('data-scene', scene)
    }
  }
  for (const [key, value] of Object.entries({body: 'Ink', buttons: 'Clay', dpad: 'Chalk', screen: 'Amber', material: 'Glossy'})) {
    await page.locator('[data-edition="Classic"]').click()
    await page.locator(`[data-option="${key}"][data-value="${value}"]`).click()
    await expect(page.locator('#edition-selection')).toHaveText('Custom')
    await page.locator('[data-option="scene"][data-value="Arcade"]').click()
    await expect(page.locator('#edition-selection')).toHaveText('Custom')
  }
  for (const [part, palette] of Object.entries(palettes)) {
    for (const color of palette) {
      const button = page.locator(`[data-option="${part}"][data-value="${color.name}"]`)
      await button.click()
      await expect(button).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator(`[data-selection="${part}"]`)).toHaveText(color.name)
    }
  }
  for (const material of ['Matte', 'Glossy', 'Translucent']) {
    const button = page.locator(`[data-option="material"][data-value="${material}"]`)
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
  }
  await page.locator('[data-edition="Atomic"]').click()
  await page.evaluate(() => window.scrollTo(0,0))
  await page.waitForTimeout(1000)
  await page.screenshot({ path: '/tmp/handheld-atomic.png' })
  await page.locator('[data-option="screen"][data-value="Amber"]').click()
  await expect(page.locator('#edition-selection')).toHaveText('Custom')
  await expect(page.locator('[data-edition][aria-pressed="true"]')).toHaveCount(0)
  const canvas = page.locator('#scene canvas')
  await canvas.scrollIntoViewIfNeeded()
  const box = await canvas.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 30, { steps: 12 })
  await page.mouse.up()
  await page.mouse.wheel(0,100)
  await page.locator('#reset').click()
  for (const [key, value] of Object.entries(editions.Classic)) {
    await expect(page.locator(`[data-option="${key}"][data-value="${value}"]`)).toHaveAttribute('aria-pressed', 'true')
  }
  await expect(page.locator('#edition-selection')).toHaveText('Classic')
  await expect(page.locator('.viewport')).toHaveAttribute('data-scene', defaults.scene)
  await page.evaluate(() => window.scrollTo(0,0))
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/handheld-classic.png' })
  await page.setViewportSize({width:390,height:844})
  await expect(canvas).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors.filter(error => !error.includes('net::ERR_FAILED'))).toEqual([])
})
