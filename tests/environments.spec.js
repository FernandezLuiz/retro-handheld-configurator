import { test, expect } from '@playwright/test'

const names = ['Studio', 'Retro Desk', 'Arcade', 'Dark Tech']
const inspect = page => page.evaluate(async () => {
  const { inspectViewer } = await import('/src/scene/viewer.js')
  return inspectViewer(document.querySelector('#scene'))
})
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

test('four real environments stay bounded, preserve the product and render all finishes', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && message.text().includes('THREE.')) errors.push(message.text()) })
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.goto('/')
  await expect(page.locator('canvas[aria-label^="Handheld"]')).toBeVisible()
  await page.locator('[data-edition="Atomic"]').click()
  const product = (await inspect(page)).product
  const camera = (await inspect(page)).camera
  for (const name of names) {
    await page.locator(`[data-option="scene"][data-value="${name}"]`).click()
    await settle(page)
    const state = await inspect(page)
    expect(state.environments.filter(group => group.visible)).toHaveLength(1)
    const current = state.environments.find(group => group.visible)
    expect(current.name).toBe(name)
    expect(current.meshes).toBeGreaterThan(3)
    expect(current.triangles).toBeLessThan(14000)
    expect(state.product).toEqual(product)
    expect(state.camera).toEqual(camera)
    await expect(page.locator('#edition-selection')).toHaveText('Atomic')
    await page.evaluate(() => scrollTo(0, 0))
    await page.waitForTimeout(350)
    await page.screenshot({ path: `scripts/scene-${name.toLowerCase().replaceAll(' ', '-')}.png` })
  }
  const warmed = await inspect(page)
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const name of names) {
      await page.locator(`[data-option="scene"][data-value="${name}"]`).click()
      await settle(page)
      const state = await inspect(page)
      expect(state.environments).toHaveLength(4)
      expect(state.environments.map(({ visible, ...group }) => group)).toEqual(warmed.environments.map(({ visible, ...group }) => group))
      expect(state.sceneObjects).toEqual(warmed.sceneObjects)
      expect(state.memory).toEqual(warmed.memory)
      expect(state.product).toEqual(product)
      expect(state.camera).toEqual(camera)
    }
  }
  for (const material of ['Matte', 'Glossy', 'Translucent']) {
    await page.locator(`[data-option="material"][data-value="${material}"]`).click()
    await settle(page)
    const state = await inspect(page)
    const body = state.product.find(mesh => mesh.name === 'body')
    expect(body.transmission > 0).toBe(material === 'Translucent')
    for (const mesh of state.product.filter(mesh => mesh.name.startsWith('internal_'))) expect(mesh.visible).toBe(material === 'Translucent')
  }
  await page.locator('#reset').click()
  await settle(page)
  await expect(page.locator('#edition-selection')).toHaveText('Classic')
  expect((await inspect(page)).environments.find(group => group.visible).name).toBe('Arcade')
  expect(errors).toEqual([])
})
