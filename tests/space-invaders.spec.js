import { test, expect } from '@playwright/test'

const inspect = page => page.evaluate(async () => {
  const { inspectViewer } = await import('/src/scene/viewer.js')
  return inspectViewer(document.querySelector('#scene'))
})

test('game selection launches Space Invaders with movement, shooting and restart', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#play')).toBeEnabled()
  await page.locator('#play').click()
  await expect.poll(async () => (await inspect(page))?.play.phase).toBe('selecting')
  await expect(page.locator('.game-picker')).toBeVisible()
  await expect(page.locator('[data-game="vector"]')).toBeVisible()
  await page.locator('[data-game="invaders"]').click()
  await expect.poll(async () => (await inspect(page)).play.phase).toBe('playing')
  await expect(page.locator('#game-title')).toHaveText('SPACE INVADERS')
  expect((await inspect(page)).play.selectedGame).toBe('invaders')

  const initial = await inspect(page)
  expect(initial.play.game.enemies.length).toBeGreaterThan(20)
  expect(initial.play.game.shields.length).toBeGreaterThan(20)
  await page.keyboard.down('ArrowRight')
  await expect.poll(async () => (await inspect(page)).play.game.player.x).toBeGreaterThan(initial.play.game.player.x + 8)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.down('Space')
  await expect.poll(async () => (await inspect(page)).play.game.shots).toBeGreaterThan(0)
  await page.keyboard.up('Space')
  await expect.poll(async () => (await inspect(page)).play.game.enemyBullets.length, { timeout: 5000 }).toBeGreaterThan(0)
  await page.locator('.game-restart').click()
  const restarted = (await inspect(page)).play.game
  expect(restarted.score).toBe(0)
  expect(restarted.lives).toBe(3)
  expect(restarted.wave).toBe(1)
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await inspect(page)).play.phase).toBe('idle')
})
