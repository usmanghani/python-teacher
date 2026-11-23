import { test, expect } from './fixtures'

async function command(page: import('@playwright/test').Page, code: string) {
  const input = page.getByPlaceholder('Type one line of Python...')
  await input.fill(code)
  await input.press('Enter')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByPlaceholder('Type one line of Python...')).toBeVisible()
  await expect(page.locator('.canvas-panel canvas').first()).toBeVisible()
  await expect(page.locator('.python-state')).toHaveCount(0, { timeout: 60000 })
})

test('loads the app and core controls without browser exceptions', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.reload()
  for (const title of ['Run (Ctrl+Enter)', 'Stop', 'Clear Screen', 'Help']) {
    await expect(page.getByTitle(title, { exact: true })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: /^My programs/ })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Pip, your Python teacher' })).toBeVisible()
  await command(page, 'print(6 * 7)')
  await expect(page.getByRole('log')).toContainText('42')
  expect(errors).toEqual([])
})

for (const [code, output] of [
  ['2 + 3 * 4', '14'],
  ['"farm" + "house"', "'farmhouse'"],
  ['print(len([1, 2, 3]))', '3'],
  ['animals = 8', '>>> animals = 8'],
  ['import math; print(math.floor(7.9))', '7'],
]) {
  test(`listener evaluates ${code}`, async ({ page }) => {
    await command(page, code)
    await expect(page.getByRole('log')).toContainText(output)
  })
}

test('command history recalls the previous command', async ({ page }) => {
  await command(page, 'print(123)')
  const input = page.getByPlaceholder('Type one line of Python...')
  await input.press('ArrowUp')
  await expect(input).toHaveValue('print(123)')
  await input.press('ArrowDown')
  await expect(input).toHaveValue('')
})

test('the command line remembers values and draws on the same page', async ({ page }) => {
  const canvas = page.locator('.canvas-panel canvas').first()
  const redPixels = () => canvas.evaluate((el: HTMLCanvasElement) => {
    const pixels = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data
    let count = 0
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 200 && pixels[i + 1] < 60 && pixels[i + 2] < 60) count++
    return count
  })
  await command(page, 'import turtle')
  await command(page, 'side = 60')
  await command(page, 'turtle.hideturtle(); turtle.color("red"); turtle.pensize(3)')
  await command(page, 'turtle.forward(side)')
  await command(page, 'print(side * 2)')
  await expect(page.getByRole('log')).toContainText('120')
  await expect.poll(redPixels).toBeGreaterThan(50)
  await page.getByTitle('Clear Screen', { exact: true }).click()
  await expect(page.getByRole('log')).toHaveText('')
  await expect.poll(redPixels).toBe(0)
})

test('stop reports to the output panel', async ({ page }) => {
  await page.getByTitle('Stop', { exact: true }).click()
  await expect(page.getByRole('log')).toContainText('[Stopped]')
})

test('mobile layout keeps the listener usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('navigation', { name: 'Show' }).getByRole('button', { name: 'Drawing' }).click()
  await command(page, 'print("MOBILE")')
  await expect(page.getByRole('log')).toContainText('MOBILE')
})


test('turtle.shape changes the turtle on the canvas', async ({ page }) => {
  // Count the pixels that are not white: with nothing drawn, that is the turtle itself.
  const marked = () => page.locator('.canvas-panel canvas').first().evaluate((el: HTMLCanvasElement) => {
    const d = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data
    let n = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] < 220 || d[i + 1] < 220 || d[i + 2] < 220) n++
    return n
  })
  await command(page, 'import turtle')
  await command(page, 'turtle.shape()')
  await expect(page.getByRole('log')).toContainText("'classic'")
  const classic = await marked()
  expect(classic).toBeGreaterThan(20)

  await command(page, 'turtle.shape("square")')
  await expect.poll(marked).toBeGreaterThan(classic * 2)
  const square = await marked()
  await command(page, 'turtle.shapesize(4)')
  await expect.poll(marked).toBeGreaterThan(square * 8)

  await command(page, 'turtle.shape("blank")')
  await expect.poll(marked).toBe(0)
  await command(page, 'turtle.shape("turtle")')
  await expect.poll(marked).toBeGreaterThan(square * 4)

  await command(page, 'turtle.shape("dragon")')
  await expect(page.getByRole('log')).toContainText('There is no shape named dragon')
  await command(page, 'turtle.shape()')
  await expect(page.getByRole('log')).toContainText("'turtle'")
})
