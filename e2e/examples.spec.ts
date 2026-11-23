import { test, expect } from './fixtures'

for (const [id, title] of [['house', 'House'], ['star', 'Star'], ['flower', 'Flower'], ['rainbow-spiral', 'Rainbow spiral'], ['logo-mastercard', 'Mastercard'], ['logo-delta', 'Delta Air Lines'], ['logo-olympic-rings', 'Olympic rings']]) {
  test(`loads, persists and runs ${title}`, async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.monaco-editor')).toBeVisible()
    page.on('dialog', dialog => dialog.accept())
    await page.getByRole('combobox', { name: 'Preloaded examples' }).selectOption(id)
    await expect(page.getByRole('log')).toContainText(`Loaded ${title}. Press Run`)
    const source = await page.evaluate(() => sessionStorage.getItem('python-teacher.program.v1'))
    expect(source).toBeTruthy()
    await page.reload()
    await expect(page.locator('.monaco-editor')).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('python-teacher.program.v1'))).toBe(source)
    await expect(page.locator('.python-state')).toHaveCount(0, { timeout: 60000 })
    await page.getByTitle('Run (Ctrl+Enter)', { exact: true }).click()
    await expect(page.getByRole('log')).toHaveText('')
    const ink = () => page.locator('.canvas-panel canvas').evaluate((el: HTMLCanvasElement) => {
      const d = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data
      let n = 0
      for (let i = 0; i < d.length; i += 4) if (d[i] < 220 || d[i + 1] < 220 || d[i + 2] < 220) n++
      return n
    })
    await expect.poll(ink, { timeout: 20000 }).toBeGreaterThan(100)
  })
}

test('declining to replace the program keeps it; accepting loads the example', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.monaco-editor')).toBeVisible()
  const source = await page.evaluate(() => sessionStorage.getItem('python-teacher.program.v1'))
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('combobox', { name: 'Preloaded examples' }).selectOption('house')
  expect(await page.evaluate(() => sessionStorage.getItem('python-teacher.program.v1'))).toBe(source)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('combobox', { name: 'Preloaded examples' }).selectOption('house')
  await expect(page.getByRole('log')).toContainText('Loaded House')
  expect(await page.evaluate(() => sessionStorage.getItem('python-teacher.program.v1'))).toContain('def roof(size)')
})

test('the animated rocket keeps changing, and Stop freezes it', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.monaco-editor')).toBeVisible()
  await expect(page.locator('.python-state')).toHaveCount(0, { timeout: 60000 })
  page.on('dialog', dialog => dialog.accept())
  await page.getByRole('combobox', { name: 'Preloaded examples' }).selectOption('rocket-launch')
  await page.getByTitle('Run (Ctrl+Enter)', { exact: true }).click()
  const canvas = page.locator('.canvas-panel canvas')
  const frame = () => canvas.evaluate((c: HTMLCanvasElement) => {
    const data = c.getContext('2d')!.getImageData(700, 350, 600, 800).data
    let hash = 2166136261
    for (let i = 0; i < data.length; i += 16) hash = Math.imul(hash ^ data[i], 16777619)
    return hash >>> 0
  })
  const blank = await frame()
  await expect.poll(frame, { timeout: 10000 }).not.toBe(blank)
  const countdown = await frame()
  // The countdown takes three seconds; after it the rocket moves every frame.
  await expect.poll(frame, { timeout: 8000 }).not.toBe(countdown)
  await page.getByTitle('Stop', { exact: true }).click()
  await expect(page.getByRole('log')).toContainText('[Stopped]')
  const stopped = await frame()
  await page.waitForTimeout(400)
  expect(await frame()).toBe(stopped)
})
