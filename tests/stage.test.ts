import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SHAPES, Stage, type TurtlePose } from '../src/turtle/Stage'
import type { DrawCommand } from '../src/python/runtime'

// The canvas side of the turtle: each drawing command from Python must end up as the right marks.
type MockContext = Record<string, ReturnType<typeof vi.fn>> & { fillStyle: string; strokeStyle: string; lineWidth: number; font: string; textAlign: string }

let screen: MockContext // what the student sees: background, ink, and the turtles on top
let ink: MockContext // the drawing itself, which the turtles must never smudge
let stage: Stage
let poses: Array<TurtlePose | null>

beforeEach(() => {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 640
  screen = canvas.getContext('2d') as unknown as MockContext
  canvas.getContext = (() => screen) as unknown as typeof canvas.getContext
  const createElement = document.createElement.bind(document)
  const spy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const element = createElement(tag)
    if (tag === 'canvas') {
      ink = (element as HTMLCanvasElement).getContext('2d') as unknown as MockContext
      ;(element as HTMLCanvasElement).getContext = (() => ink) as unknown as HTMLCanvasElement['getContext']
    }
    return element
  }) as typeof document.createElement)
  poses = []
  stage = new Stage(canvas, pose => poses.push(pose))
  spy.mockRestore()
  for (const context of [screen, ink]) for (const value of Object.values(context)) if (typeof value === 'function') value.mockClear()
})

/** Draw commands at once, as the Stop button and the tests do. */
function draw(...commands: DrawCommand[]) {
  stage.enqueue(commands)
  stage.finish()
}

/** The outline most recently laid down on a context for a shape with this many corners. */
function outline(context: MockContext, corners: number): Array<[number, number]> {
  const start = context.moveTo.mock.calls.at(-1) as [number, number]
  return [start, ...(context.lineTo.mock.calls as Array<[number, number]>).slice(-(corners - 1))]
}

/** Canvas coordinates for a shape: y flipped, stretched by width and length. */
const onCanvas = (name: string, wide = 1, long = 1) => SHAPES[name].map(([x, y]) => [x * long, -y * wide === 0 ? 0 : -y * wide])
const drawn = (context: MockContext, name: string) => outline(context, SHAPES[name].length).map(([x, y]) => [x, y === 0 ? 0 : y])

describe('drawing lines', () => {
  it('puts the origin in the middle with y going up', () => {
    draw(['go', 0, 0, 0, 100, 50, 0, 'red', 3])
    expect(ink.moveTo).toHaveBeenCalledWith(320, 320)
    expect(ink.lineTo).toHaveBeenCalledWith(420, 270)
    expect(ink.stroke).toHaveBeenCalledTimes(1)
    expect(ink.strokeStyle).toBe('red')
    expect(ink.lineWidth).toBe(3)
  })
  it('moves the turtle without ink when the pen is up', () => {
    draw(['go', 0, 0, 0, 100, 50, 30, null, 1])
    expect(ink.stroke).not.toHaveBeenCalled()
    expect(poses.at(-1)).toMatchObject({ x: 100, y: 50, heading: 30 })
  })
  it('turns the turtle on pose', () => {
    draw(['pose', 0, 5, 6, 135])
    expect(poses.at(-1)).toMatchObject({ x: 5, y: 6, heading: 135 })
    expect(ink.stroke).not.toHaveBeenCalled()
  })
})

describe('marks', () => {
  it('draws a dot as a filled circle', () => {
    draw(['dot', 10, 20, 15, 'gold'])
    expect(ink.arc).toHaveBeenCalledWith(330, 300, 15, 0, Math.PI * 2)
    expect(ink.fillStyle).toBe('gold')
    expect(ink.fill).toHaveBeenCalledTimes(1)
  })
  it('fills a shape and puts its outline back on top', () => {
    draw(['fill', [[0, 0], [60, 0], [30, 52], [0, 0]], 'teal', [[0, 0, 60, 0, 'black', 2]]])
    expect(ink.fill).toHaveBeenCalledTimes(1)
    expect(ink.closePath).toHaveBeenCalledTimes(1)
    expect(ink.fill.mock.invocationCallOrder[0]).toBeLessThan(ink.stroke.mock.invocationCallOrder[0])
    expect(ink.strokeStyle).toBe('black')
  })
  it('writes text in the size and alignment asked for', () => {
    draw(['text', 0, 0, 'Hello', 'purple', 24, 'center'])
    expect(ink.fillText).toHaveBeenCalledWith('Hello', 320, 320)
    expect(ink.font).toBe('24px Arial, sans-serif')
    expect(ink.textAlign).toBe('center')
    expect(ink.fillStyle).toBe('purple')
  })
  it('clear wipes the ink but not the turtle', () => {
    draw(['go', 0, 0, 0, 50, 0, 0, 'black', 1], ['clear'])
    expect(ink.clearRect).toHaveBeenCalledWith(0, 0, 640, 640)
    expect(poses.at(-1)).toMatchObject({ x: 50, y: 0 })
  })
  it('paints the background color behind everything', () => {
    draw(['bg', 'navy'])
    const order = screen.fillRect.mock.invocationCallOrder.at(-1)!
    expect(order).toBeLessThan(screen.drawImage.mock.invocationCallOrder.at(-1)!)
    expect(screen.fillRect).toHaveBeenLastCalledWith(0, 0, 640, 640)
  })
})

describe('the turtle on the canvas', () => {
  it('is drawn on the screen and never on the ink', () => {
    draw(['pose', 0, 0, 0, 0])
    expect(screen.fill).toHaveBeenCalled()
    expect(ink.fill).not.toHaveBeenCalled()
  })
  it('stands at its position, turned to its heading', () => {
    draw(['pose', 0, 40, 30, 90])
    expect(screen.translate).toHaveBeenLastCalledWith(360, 290)
    expect(screen.rotate.mock.calls.at(-1)![0]).toBeCloseTo(-Math.PI / 2)
  })
  it('takes the pen color', () => {
    draw(['ink', 0, 'crimson'])
    expect(screen.fillStyle).toBe('crimson')
    expect(poses.at(-1)).toMatchObject({ color: 'crimson' })
  })
  it('is not drawn while hidden, and comes back when shown', () => {
    draw(['show', 0, false])
    expect(screen.fill).not.toHaveBeenCalled()
    expect(poses.at(-1)).toMatchObject({ visible: false })
    draw(['show', 0, true])
    expect(screen.fill).toHaveBeenCalledTimes(1)
  })
  it('draws every turtle the program made', () => {
    draw(['reset'], ['new', 0, true], ['new', 1, true], ['new', 2, false])
    expect(screen.fill).toHaveBeenCalledTimes(2)
  })
})

describe('turtle.shape on the canvas', () => {
  it('starts as the classic arrowhead', () => {
    draw(['pose', 0, 0, 0, 0])
    expect(drawn(screen, 'classic')).toEqual(onCanvas('classic'))
  })
  it.each(['arrow', 'square', 'triangle', 'turtle', 'classic'])('draws the "%s" outline', name => {
    draw(['shape', 0, name, 1, 1])
    expect(drawn(screen, name)).toEqual(onCanvas(name))
    expect(screen.closePath).toHaveBeenCalled()
    expect(screen.fill).toHaveBeenCalledTimes(1)
    expect(screen.stroke).toHaveBeenCalledTimes(1)
  })
  it('draws "circle" as a circle', () => {
    draw(['shape', 0, 'circle', 1, 1])
    expect(screen.arc).toHaveBeenLastCalledWith(0, 0, 10, 0, Math.PI * 2)
    expect(screen.lineTo).not.toHaveBeenCalled()
  })
  it('draws nothing for "blank"', () => {
    draw(['shape', 0, 'blank', 1, 1])
    expect(screen.fill).not.toHaveBeenCalled()
    expect(screen.stroke).not.toHaveBeenCalled()
  })
  it('falls back to the classic turtle for a shape it does not know', () => {
    draw(['shape', 0, 'dragon', 1, 1])
    expect(drawn(screen, 'classic')).toEqual(onCanvas('classic'))
  })
  it('every shape faces along the heading: its nose is the point furthest forward', () => {
    for (const [name, points] of Object.entries(SHAPES)) {
      const front = Math.max(...points.map(([x]) => x))
      const back = Math.min(...points.map(([x]) => x))
      expect(front, name).toBeGreaterThan(0)
      if (name !== 'square') expect(points.filter(([x]) => x === front), name).toHaveLength(1)
      expect(front, name).toBeGreaterThanOrEqual(-back)
    }
  })
  it('every shape is the same on its left and right', () => {
    for (const [name, points] of Object.entries(SHAPES)) {
      const key = ([x, y]: [number, number]) => `${x},${y === 0 ? 0 : y}`
      const mirrored = new Set(points.map(([x, y]) => key([x, -y])))
      expect(points.every(point => mirrored.has(key(point))), name).toBe(true)
    }
  })
  it('stretches width across the turtle and length along it', () => {
    draw(['shape', 0, 'square', 2, 4])
    expect(drawn(screen, 'square')).toEqual(onCanvas('square', 2, 4))
    expect(drawn(screen, 'square')).toContainEqual([40, -20])
  })
  it('stretches a circle into an ellipse', () => {
    draw(['shape', 0, 'circle', 2, 4])
    expect(screen.scale).toHaveBeenLastCalledWith(4, 2)
  })
  it('outlines the turtle and its stamps with the width asked for', () => {
    draw(['shape', 0, 'square', 1, 1, 6])
    expect(screen.lineWidth).toBe(6)
    draw(['stamp', 0, 0, 0, 'red', 'square', 1, 1, 4])
    expect(ink.lineWidth).toBe(4)
    expect(ink.stroke).toHaveBeenCalledTimes(1)
  })
  it('draws no outline at width zero, and a thin one when no width is given', () => {
    draw(['shape', 0, 'square', 1, 1, 0])
    expect(screen.fill).toHaveBeenCalledTimes(1)
    expect(screen.stroke).not.toHaveBeenCalled()
    draw(['shape', 0, 'square', 1, 1])
    expect(screen.lineWidth).toBe(1)
    expect(screen.stroke).toHaveBeenCalledTimes(1)
  })
  it('gives each turtle its own shape', () => {
    draw(['reset'], ['new', 0, true], ['new', 1, true], ['shape', 1, 'circle', 1, 1])
    expect(screen.arc).toHaveBeenCalledTimes(1)
    expect(screen.fill).toHaveBeenCalledTimes(2)
  })
  it('goes back to classic on a new run', () => {
    draw(['shape', 0, 'circle', 1, 1])
    screen.arc.mockClear()
    draw(['reset'], ['new', 0, true])
    expect(screen.arc).not.toHaveBeenCalled()
    expect(drawn(screen, 'classic')).toEqual(onCanvas('classic'))
  })
  it('stamps the shape into the ink, where it stays', () => {
    draw(['stamp', 10, 20, 90, 'green', 'square', 2, 3])
    expect(ink.translate).toHaveBeenCalledWith(330, 300)
    expect(ink.rotate.mock.calls[0][0]).toBeCloseTo(-Math.PI / 2)
    expect(ink.fillStyle).toBe('green')
    expect(drawn(ink, 'square')).toEqual(onCanvas('square', 2, 3))
    expect(ink.fill).toHaveBeenCalledTimes(1)
  })
  it('stamps a circle, and leaves nothing for a blank stamp', () => {
    draw(['stamp', 0, 0, 0, 'red', 'circle', 1, 1])
    expect(ink.arc).toHaveBeenCalledWith(0, 0, 10, 0, Math.PI * 2)
    ink.fill.mockClear()
    draw(['stamp', 0, 0, 0, 'red', 'blank', 1, 1])
    expect(ink.fill).not.toHaveBeenCalled()
  })
  it('still draws a stamp that names no shape', () => {
    draw(['stamp', 0, 0, 0, 'red'])
    expect(drawn(ink, 'classic')).toEqual(onCanvas('classic'))
  })
})

describe('playing and stopping', () => {
  it('reset clears the page and puts one turtle at home', () => {
    draw(['go', 0, 0, 0, 50, 50, 45, 'black', 1], ['shape', 0, 'turtle', 2, 2])
    stage.reset()
    expect(poses.at(-1)).toEqual({ x: 0, y: 0, heading: 0, color: 'black', visible: true })
    expect(drawn(screen, 'classic')).toEqual(onCanvas('classic'))
    expect(stage.playing).toBe(false)
  })
  it('halt drops what has not been drawn', () => {
    stage.enqueue([['go', 0, 0, 0, 500, 0, 0, 'black', 1]])
    expect(stage.playing).toBe(true)
    stage.halt()
    expect(stage.playing).toBe(false)
    expect(ink.stroke).not.toHaveBeenCalled()
  })
  it('whenIdle resolves once everything is drawn', async () => {
    stage.enqueue([['go', 0, 0, 0, 500, 0, 0, 'black', 1]])
    const idle = stage.whenIdle()
    stage.finish()
    await expect(idle).resolves.toBeUndefined()
    await expect(stage.whenIdle()).resolves.toBeUndefined()
  })
  it('speed and wait commands never draw', () => {
    draw(['speed', 0], ['wait', 500], ['speed', 99])
    expect(ink.stroke).not.toHaveBeenCalled()
    expect(ink.fill).not.toHaveBeenCalled()
  })
})
