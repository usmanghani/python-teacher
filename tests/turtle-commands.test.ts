// @vitest-environment node
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadPyodide } from 'pyodide'
import { createRuntime, type DrawCommand, type PythonRuntime } from '../src/python/runtime'

// Every command the turtle module offers, run in real CPython (Pyodide) exactly as the page runs it.
let python: PythonRuntime
beforeAll(async () => {
  python = createRuntime(await loadPyodide(), readFileSync(new URL('../src/python/turtle_shim.py', import.meta.url), 'utf8'))
}, 120_000)

/** Run a program that has `turtle` imported, and collect what it printed and drew. */
function run(body: string) {
  const commands: DrawCommand[] = []
  const report = python.run(`import turtle\n${body}`, { onCommands: batch => commands.push(...batch) })
  return { report, commands, of: (kind: string) => commands.filter(command => command[0] === kind) }
}

/** Run a program that must succeed, and return what it printed. */
function printed(body: string): string {
  const { report } = run(body)
  expect(report.errors).toEqual([])
  return report.output
}

/** The message of the error a program must end with. */
function failure(body: string): string {
  const { report } = run(body)
  expect(report.ok).toBe(false)
  return report.errors[0].message
}

const TURTLE_COMMANDS = [
  'back', 'backward', 'begin_fill', 'bk', 'circle', 'clear', 'color', 'distance', 'dot', 'down', 'end_fill', 'fd', 'fillcolor',
  'filling', 'forward', 'getscreen', 'goto', 'heading', 'hideturtle', 'home', 'ht', 'isdown', 'isvisible', 'left', 'lt', 'pd',
  'pencolor', 'pendown', 'pensize', 'penup', 'pos', 'position', 'pu', 'reset', 'right', 'rt', 'seth', 'setheading', 'setpos',
  'setposition', 'setx', 'sety', 'shape', 'shapesize', 'showturtle', 'speed', 'st', 'stamp', 'teleport', 'towards', 'turtlesize',
  'up', 'width', 'write', 'xcor', 'ycor',
]
const SCREEN_COMMANDS = [
  'bgcolor', 'bye', 'clearscreen', 'colormode', 'delay', 'done', 'exitonclick', 'getshapes', 'listen', 'mainloop', 'onclick',
  'onkey', 'onkeypress', 'onscreenclick', 'ontimer', 'resetscreen', 'screensize', 'setup', 'title', 'tracer', 'turtles', 'update',
  'window_height', 'window_width',
]
const OTHER_NAMES = ['Pen', 'RawTurtle', 'Screen', 'Turtle', 'TurtleGraphicsError', 'getpen', 'getturtle']

describe('what the module offers', () => {
  it('is exactly the commands this file tests', () => {
    // A command added to the module has to be added here, and tested below.
    const names = JSON.parse(printed('import json\nprint(json.dumps(sorted(turtle.__all__)))')) as string[]
    expect(names).toEqual([...TURTLE_COMMANDS, ...SCREEN_COMMANDS, ...OTHER_NAMES].sort())
  })
  it('has every turtle command as a method too', () => {
    const missing = JSON.parse(printed(`import json\nt = turtle.Turtle()\nprint(json.dumps([name for name in ${JSON.stringify(TURTLE_COMMANDS)} if not callable(getattr(t, name, None))]))`))
    expect(missing).toEqual([])
  })
  it('supports "from turtle import *"', () => {
    expect(printed('from turtle import *\nforward(30)\nshape("turtle")\nprint(xcor(), shape())')).toBe('30.0 turtle')
  })
  it('reports a misspelt command by name', () => {
    expect(failure('turtle.forwrd(10)')).toBe("AttributeError: module 'turtle' has no attribute 'forwrd'")
  })
})

describe('moving', () => {
  it('forward and fd move the way the turtle faces', () => {
    const { report, of } = run('turtle.forward(100)\nturtle.fd(20)')
    expect(report.turtle).toEqual({ x: 120, y: 0, heading: 0 })
    expect(of('go')).toEqual([['go', 0, 0, 0, 100, 0, 0, 'black', 1], ['go', 0, 100, 0, 120, 0, 0, 'black', 1]])
  })
  it('forward follows the heading', () => {
    expect(run('turtle.left(90)\nturtle.forward(50)').report.turtle).toEqual({ x: 0, y: 50, heading: 90 })
    expect(run('turtle.left(45)\nturtle.forward(100)').report.turtle).toEqual({ x: 70.71, y: 70.71, heading: 45 })
  })
  it('a negative forward goes backwards', () => {
    expect(run('turtle.forward(-40)').report.turtle).toEqual({ x: -40, y: 0, heading: 0 })
  })
  it.each(['backward', 'back', 'bk'])('%s moves backwards without turning', name => {
    expect(run(`turtle.${name}(60)`).report.turtle).toEqual({ x: -60, y: 0, heading: 0 })
  })
  it.each(['left', 'lt'])('%s turns counter-clockwise', name => {
    const { report, of } = run(`turtle.${name}(90)`)
    expect(report.turtle).toEqual({ x: 0, y: 0, heading: 90 })
    expect(of('pose')).toEqual([['pose', 0, 0, 0, 90]])
    expect(report.drawing.strokes).toBe(0)
  })
  it.each(['right', 'rt'])('%s turns clockwise', name => {
    expect(run(`turtle.${name}(90)`).report.turtle!.heading).toBe(270)
  })
  it('turning wraps around a full circle', () => {
    expect(run('turtle.left(450)').report.turtle!.heading).toBe(90)
    expect(run('turtle.right(30)\nturtle.left(30)').report.turtle!.heading).toBe(0)
    expect(run('turtle.left(-90)').report.turtle!.heading).toBe(270)
  })
  it.each(['goto', 'setpos', 'setposition'])('%s goes to a point, drawing on the way, and keeps the heading', name => {
    const { report } = run(`turtle.left(30)\nturtle.${name}(30, 40)`)
    expect(report.turtle).toEqual({ x: 30, y: 40, heading: 30 })
    expect(report.drawing).toMatchObject({ strokes: 1, bounds: { left: 0, right: 30, bottom: 0, top: 40 } })
  })
  it('goto accepts a pair as well as two numbers', () => {
    expect(run('turtle.goto((30, 40))').report.turtle).toMatchObject({ x: 30, y: 40 })
    expect(run('spot = turtle.Turtle()\nspot.penup()\nspot.goto(-5, 9)\nturtle.goto(spot.position())').report.turtle).toMatchObject({ x: -5, y: 9 })
  })
  it('setx and sety change one coordinate', () => {
    expect(run('turtle.goto(10, 20)\nturtle.setx(-70)').report.turtle).toMatchObject({ x: -70, y: 20 })
    expect(run('turtle.goto(10, 20)\nturtle.sety(55)').report.turtle).toMatchObject({ x: 10, y: 55 })
  })
  it.each(['setheading', 'seth'])('%s points the turtle in a compass direction', name => {
    expect(run(`turtle.${name}(180)`).report.turtle!.heading).toBe(180)
    expect(run(`turtle.${name}(-90)`).report.turtle!.heading).toBe(270)
    expect(run(`turtle.${name}(725)`).report.turtle!.heading).toBe(5)
  })
  it('home goes back to the middle facing right, drawing if the pen is down', () => {
    const { report } = run('turtle.penup()\nturtle.goto(60, 80)\nturtle.left(77)\nturtle.pendown()\nturtle.home()')
    expect(report.turtle).toEqual({ x: 0, y: 0, heading: 0 })
    expect(report.drawing.strokes).toBe(1)
  })
  it('teleport jumps without drawing and leaves the pen as it was', () => {
    const { report, of } = run('turtle.teleport(50, -20)\nprint(turtle.isdown())\nturtle.forward(10)')
    expect(report.output).toBe('True')
    expect(report.turtle).toMatchObject({ x: 60, y: -20 })
    expect(of('go').map(command => command[7])).toEqual([null, 'black'])
    expect(report.drawing.strokes).toBe(1)
  })
  it('teleport can move along one axis only', () => {
    expect(run('turtle.teleport(10, 20)\nturtle.teleport(y=-5)').report.turtle).toMatchObject({ x: 10, y: -5 })
    expect(run('turtle.teleport(10, 20)\nturtle.teleport(x=99)').report.turtle).toMatchObject({ x: 99, y: 20 })
  })
})

describe('circle', () => {
  it('draws a full circle to the left and comes back to the start', () => {
    const { report } = run('turtle.circle(50)')
    expect(report.turtle).toEqual({ x: 0, y: 0, heading: 0 })
    const { left, right, bottom, top } = report.drawing.bounds!
    expect(left).toBeCloseTo(-50, 0)
    expect(right).toBeCloseTo(50, 0)
    expect(bottom).toBeCloseTo(0, 0)
    expect(top).toBeCloseTo(100, 0)
  })
  it('a negative radius circles to the right', () => {
    const { report } = run('turtle.circle(-50)')
    expect(report.turtle).toEqual({ x: 0, y: 0, heading: 0 })
    expect(report.drawing.bounds!.bottom).toBeCloseTo(-100, 0)
    expect(report.drawing.bounds!.top).toBeCloseTo(0, 0)
  })
  it('an extent draws part of the circle and turns the turtle by that much', () => {
    const half = run('turtle.circle(50, 180)').report.turtle!
    expect(half.x).toBeCloseTo(0, 1)
    expect(half.y).toBeCloseTo(100, 1)
    expect(half.heading).toBe(180)
    const quarter = run('turtle.circle(50, 90)').report.turtle!
    expect(quarter.x).toBeCloseTo(50, 1)
    expect(quarter.y).toBeCloseTo(50, 1)
    expect(quarter.heading).toBe(90)
  })
  it('a negative extent draws the arc backwards', () => {
    const { x, y, heading } = run('turtle.circle(50, -90)').report.turtle!
    expect(x).toBeCloseTo(-50, 1)
    expect(y).toBeCloseTo(50, 1)
    expect(heading).toBe(270)
  })
  it('steps turns the circle into a polygon with that many sides', () => {
    const { report, of } = run('turtle.circle(60, steps=6)')
    expect(of('go')).toHaveLength(6)
    expect(report.drawing.strokes).toBe(6)
    expect(report.turtle).toEqual({ x: 0, y: 0, heading: 0 })
    // A hexagon's side is as long as the radius of the circle around it.
    const [, , x1, y1, x2, y2] = of('go')[0] as [string, number, number, number, number, number]
    expect(Math.hypot(x2 - x1, y2 - y1)).toBeCloseTo(60, 1)
  })
  it('uses more sides for a bigger circle, so both look round', () => {
    expect(run('turtle.circle(6)').of('go').length).toBeLessThan(run('turtle.circle(200)').of('go').length)
    expect(run('turtle.circle(6)').of('go').length).toBeGreaterThanOrEqual(12)
  })
  it('draws nothing with the pen up, but still moves', () => {
    const { report } = run('turtle.penup()\nturtle.circle(50, 180)')
    expect(report.drawing.strokes).toBe(0)
    expect(report.turtle!.y).toBeCloseTo(100, 1)
  })
})

describe('the pen', () => {
  it.each([['penup', 'pendown'], ['pu', 'pd'], ['up', 'down']])('%s lifts the pen and %s puts it back', (lift, lower) => {
    const { report, of } = run(`print(turtle.isdown())\nturtle.${lift}()\nprint(turtle.isdown())\nturtle.forward(40)\nturtle.${lower}()\nprint(turtle.isdown())\nturtle.forward(40)`)
    expect(report.output).toBe('True\nFalse\nTrue')
    expect(of('go').map(command => command[7])).toEqual([null, 'black'])
    expect(report.drawing).toMatchObject({ strokes: 1, bounds: { left: 40, right: 80 } })
  })
  it.each(['pensize', 'width'])('%s sets and reads the line thickness', name => {
    const { report, of } = run(`print(turtle.${name}())\nturtle.${name}(5)\nprint(turtle.${name}() == 5)\nturtle.forward(10)`)
    expect(report.output).toBe('1\nTrue')
    expect(of('go')[0][8]).toBe(5)
  })
  it('never lets the pen get thinner than one', () => {
    expect(run('turtle.pensize(0)\nturtle.forward(10)').of('go')[0][8]).toBe(1)
  })
  it('pencolor sets and reads the line color, and recolors the turtle', () => {
    const { report, of } = run('print(turtle.pencolor())\nturtle.pencolor("blue")\nprint(turtle.pencolor())\nturtle.forward(10)')
    expect(report.output).toBe('black\nblue')
    expect(of('ink')).toEqual([['ink', 0, 'blue']])
    expect(of('go')[0][7]).toBe('blue')
    expect(report.drawing.colors).toEqual(['blue'])
  })
  it('fillcolor sets and reads the fill color and leaves the pen alone', () => {
    expect(printed('print(turtle.fillcolor())\nturtle.fillcolor("gold")\nprint(turtle.fillcolor(), turtle.pencolor())')).toBe('black\ngold black')
  })
  it('color sets both, or each one, and reads both', () => {
    expect(printed('print(turtle.color())')).toBe("('black', 'black')")
    expect(printed('turtle.color("red")\nprint(turtle.color())')).toBe("('red', 'red')")
    expect(printed('turtle.color("red", "yellow")\nprint(turtle.color())')).toBe("('red', 'yellow')")
    expect(printed('turtle.color(1, 0.5, 0)\nprint(turtle.color())')).toBe("('#ff8000', '#ff8000')")
    expect(printed('turtle.color((0, 0, 1), "#ABCDEF")\nprint(turtle.color())')).toBe("('#0000ff', '#abcdef')")
  })
  it('accepts names in any case, hex codes, three numbers, and a tuple of three', () => {
    expect(printed('turtle.pencolor(" Red ")\nprint(turtle.pencolor())')).toBe('red')
    expect(printed('turtle.pencolor("#FF00aa")\nprint(turtle.pencolor())')).toBe('#ff00aa')
    expect(printed('turtle.pencolor(0, 1, 0)\nprint(turtle.pencolor())')).toBe('#00ff00')
    expect(printed('turtle.pencolor((0.2, 0.4, 0.6))\nprint(turtle.pencolor())')).toBe('#336699')
  })
  it('colormode switches number colors between 0-1 and 0-255', () => {
    expect(printed('print(turtle.colormode())\nturtle.colormode(255)\nprint(turtle.colormode())\nturtle.pencolor(255, 128, 0)\nprint(turtle.pencolor())')).toBe('1.0\n255\n#ff8000')
    expect(printed('turtle.colormode(255)\nturtle.colormode(1)\nturtle.pencolor(1, 1, 1)\nprint(turtle.pencolor())')).toBe('#ffffff')
    expect(failure('turtle.colormode(100)')).toBe('ValueError: colormode must be 1.0 or 255')
  })
  it('keeps number colors inside the range instead of failing', () => {
    expect(printed('turtle.pencolor(2, -1, 0.5)\nprint(turtle.pencolor())')).toBe('#ff0080')
  })
  it('explains a color it cannot read', () => {
    expect(failure('turtle.pencolor(5)')).toMatch(/^TypeError: bad color: 5\./)
    expect(failure('turtle.fillcolor((1, 2))')).toMatch(/^TypeError: bad color/)
  })
  it('starts each run back in colormode 1.0', () => {
    run('turtle.colormode(255)')
    expect(printed('print(turtle.colormode())')).toBe('1.0')
  })
})

describe('filling', () => {
  const triangle = 'for side in range(3):\n    turtle.forward(60)\n    turtle.left(120)\n'
  it('begin_fill and end_fill fill the path walked between them', () => {
    const { report, of } = run(`turtle.color("black", "gold")\nturtle.begin_fill()\n${triangle}turtle.end_fill()`)
    const [fill] = of('fill')
    expect(fill[1]).toEqual([[0, 0], [60, 0], [30, 51.96], [0, 0]])
    expect(fill[2]).toBe('gold')
    expect(fill[3]).toHaveLength(3)
    expect(report.drawing.colors).toEqual(['black', 'gold'])
  })
  it('filling() says whether a fill is under way', () => {
    expect(printed('print(turtle.filling())\nturtle.begin_fill()\nprint(turtle.filling())\nturtle.end_fill()\nprint(turtle.filling())')).toBe('False\nTrue\nFalse')
  })
  it('fills the shape even when the pen is up, with no outline', () => {
    const [fill] = run(`turtle.penup()\nturtle.fillcolor("teal")\nturtle.begin_fill()\n${triangle}turtle.end_fill()`).of('fill')
    expect(fill[1]).toHaveLength(4)
    expect(fill[3]).toEqual([])
  })
  it('fills a circle', () => {
    const [fill] = run('turtle.fillcolor("red")\nturtle.begin_fill()\nturtle.circle(40)\nturtle.end_fill()').of('fill')
    expect((fill[1] as unknown[]).length).toBeGreaterThan(12)
    expect(fill[2]).toBe('red')
  })
  it('uses the fill color in force when the fill ends', () => {
    expect(run(`turtle.begin_fill()\n${triangle}turtle.fillcolor("orchid")\nturtle.end_fill()`).of('fill')[0][2]).toBe('orchid')
  })
  it('does nothing for a fill with no shape in it, or an end with no begin', () => {
    expect(run('turtle.begin_fill()\nturtle.forward(50)\nturtle.end_fill()').of('fill')).toEqual([])
    expect(run('turtle.end_fill()').report.ok).toBe(true)
  })
})

describe('marks', () => {
  it('dot draws a filled circle where the turtle stands, without moving it', () => {
    const { report, of } = run('turtle.goto(10, 20)\nturtle.dot(30, "red")')
    expect(of('dot')).toEqual([['dot', 10, 20, 15, 'red']])
    expect(report.turtle).toMatchObject({ x: 10, y: 20 })
    expect(report.drawing.bounds).toMatchObject({ right: 25, top: 35 })
  })
  it('dot defaults to the pen color and a size that suits the pen', () => {
    expect(run('turtle.dot()').of('dot')).toEqual([['dot', 0, 0, 2.5, 'black']])
    expect(run('turtle.pencolor("navy")\nturtle.pensize(10)\nturtle.dot()').of('dot')).toEqual([['dot', 0, 0, 10, 'navy']])
  })
  it('dot takes a number color and draws even with the pen up', () => {
    const { report, of } = run('turtle.penup()\nturtle.dot(8, 0, 0, 1)')
    expect(of('dot')).toEqual([['dot', 0, 0, 4, '#0000ff']])
    expect(report.drawing.strokes).toBe(1)
  })
  it('stamp leaves a copy of the turtle behind', () => {
    const { report, of } = run('turtle.pencolor("green")\nturtle.left(45)\nturtle.stamp()\nturtle.penup()\nturtle.forward(50)')
    expect(of('stamp')).toEqual([['stamp', 0, 0, 45, 'green', 'classic', 1, 1]])
    expect(report.drawing.strokes).toBe(1)
  })
  it('write puts text at the turtle', () => {
    const { report, of } = run('turtle.goto(5, 5)\nturtle.pencolor("purple")\nturtle.write("Hello")')
    expect(of('text')).toEqual([['text', 5, 5, 'Hello', 'purple', 12, 'left']])
    expect(report.turtle).toMatchObject({ x: 5, y: 5 })
  })
  it('write takes an alignment and a font size, and turns anything into text', () => {
    expect(run('turtle.write(42, align="center", font=("Arial", 24, "bold"))').of('text')).toEqual([['text', 0, 0, '42', 'black', 24, 'center']])
    expect(run('turtle.write([1, 2], False, "right")').of('text')[0].slice(3)).toEqual(['[1, 2]', 'black', 12, 'right'])
  })
})

describe('turtle.shape', () => {
  it('starts as "classic"', () => {
    expect(printed('print(turtle.shape())')).toBe('classic')
  })
  it.each(['arrow', 'blank', 'circle', 'classic', 'square', 'triangle', 'turtle'])('changes the turtle to "%s" and reads it back', name => {
    const { report, of } = run(`print(turtle.shape("${name}"))\nprint(turtle.shape())`)
    expect(report.output).toBe(`None\n${name}`)
    expect(of('shape')).toEqual([['shape', 0, name, 1, 1]])
  })
  it('lists the shapes it knows', () => {
    expect(printed('print(turtle.getshapes())\nprint(turtle.Screen().getshapes() == turtle.getshapes())')).toBe("['arrow', 'blank', 'circle', 'classic', 'square', 'triangle', 'turtle']\nTrue")
  })
  it('names the shapes to choose from when the name is wrong', () => {
    const { report } = run('turtle.forward(10)\nturtle.shape("dragon")')
    expect(report.errors).toEqual([{ message: 'TurtleGraphicsError: There is no shape named dragon. Choose one of: arrow, blank, circle, classic, square, triangle, turtle.', line: 3 }])
    expect(failure('turtle.shape("Turtle")')).toMatch(/no shape named Turtle/)
  })
  it('keeps the shape it had after a bad name', () => {
    expect(printed('turtle.shape("square")\ntry:\n    turtle.shape("nope")\nexcept turtle.TurtleGraphicsError:\n    pass\nprint(turtle.shape())')).toBe('square')
  })
  it('does not draw, move, or count as ink', () => {
    const { report } = run('turtle.shape("turtle")')
    expect(report).toMatchObject({ ok: true, turtle: { x: 0, y: 0, heading: 0 }, drawing: { strokes: 0, bounds: null, colors: [] } })
  })
  it('can be chosen when a turtle is made', () => {
    const { report, of } = run('ada = turtle.Turtle("turtle")\nbob = turtle.Turtle(shape="circle")\nprint(ada.shape(), bob.shape())')
    expect(report.output).toBe('turtle circle')
    expect(of('shape')).toEqual([['shape', 0, 'turtle', 1, 1], ['shape', 1, 'circle', 1, 1]])
    expect(failure('turtle.Turtle("dragon")')).toMatch(/no shape named dragon/)
  })
  it('belongs to one turtle, not all of them', () => {
    expect(printed('ada = turtle.Turtle()\nbob = turtle.Turtle()\nbob.shape("square")\nprint(ada.shape(), bob.shape())')).toBe('classic square')
  })
  it('is what stamp() leaves behind', () => {
    expect(run('turtle.shape("turtle")\nturtle.stamp()\nturtle.shape("circle")\nturtle.stamp()').of('stamp').map(command => command[5])).toEqual(['turtle', 'circle'])
  })
  it('survives reset(), as it does in the real turtle module, but not a new run', () => {
    expect(printed('turtle.shape("turtle")\nturtle.reset()\nprint(turtle.shape())')).toBe('turtle')
    run('turtle.shape("turtle")')
    expect(printed('print(turtle.shape())')).toBe('classic')
  })
  it('can change from the command line after a program has run', () => {
    run('turtle.forward(10)')
    const commands: DrawCommand[] = []
    expect(python.line('turtle.shape("turtle")', { onCommands: batch => commands.push(...batch) }).ok).toBe(true)
    expect(commands).toEqual([['shape', 0, 'turtle', 1, 1]])
    let shown = ''
    python.line('turtle.shape()', { onOutput: text => { shown += text } })
    expect(shown).toBe("'turtle'\n")
  })
})

describe('shapesize and turtlesize', () => {
  it.each(['shapesize', 'turtlesize'])('%s reads width stretch, length stretch and outline', name => {
    expect(printed(`print(turtle.${name}())`)).toBe('(1.0, 1.0, 1)')
  })
  it('one number stretches both ways', () => {
    const { report, of } = run('turtle.shapesize(3)\nprint(turtle.shapesize())')
    expect(report.output).toBe('(3.0, 3.0, 1)')
    expect(of('shape')).toEqual([['shape', 0, 'classic', 3, 3]])
  })
  it('two numbers stretch width and length separately, and a third sets the outline', () => {
    expect(printed('turtle.shapesize(2, 5)\nprint(turtle.shapesize())')).toBe('(2.0, 5.0, 1)')
    expect(printed('turtle.shapesize(2, 5, 4)\nprint(turtle.shapesize())')).toBe('(2.0, 5.0, 4)')
  })
  it('keyword arguments change only what they name', () => {
    expect(printed('turtle.shapesize(2, 3)\nturtle.shapesize(stretch_len=7)\nprint(turtle.shapesize())')).toBe('(2.0, 7.0, 1)')
    expect(printed('turtle.shapesize(2, 3)\nturtle.shapesize(outline=6)\nprint(turtle.shapesize())')).toBe('(2.0, 3.0, 6)')
  })
  it('refuses a stretch of zero', () => {
    expect(failure('turtle.shapesize(0)')).toBe('TurtleGraphicsError: stretch_wid/stretch_len must not be zero')
    expect(failure('turtle.shapesize(1, 0)')).toBe('TurtleGraphicsError: stretch_wid/stretch_len must not be zero')
  })
  it('applies to the shape in use, to stamps, and to how much room a stamp takes', () => {
    const { report, of } = run('turtle.shape("square")\nturtle.shapesize(2, 4)\nturtle.stamp()')
    expect(of('shape').at(-1)).toEqual(['shape', 0, 'square', 2, 4])
    expect(of('stamp')).toEqual([['stamp', 0, 0, 0, 'black', 'square', 2, 4]])
    expect(report.drawing.bounds).toEqual({ left: -32, right: 32, bottom: -32, top: 32 })
  })
  it('goes back to normal on reset()', () => {
    expect(printed('turtle.shapesize(4)\nturtle.reset()\nprint(turtle.shapesize())')).toBe('(1.0, 1.0, 1)')
  })
})

describe('showing, hiding and speed', () => {
  it.each([['hideturtle', 'showturtle'], ['ht', 'st']])('%s hides the turtle and %s shows it', (hide, show) => {
    const { report, of } = run(`print(turtle.isvisible())\nturtle.${hide}()\nprint(turtle.isvisible())\nturtle.${show}()\nprint(turtle.isvisible())`)
    expect(report.output).toBe('True\nFalse\nTrue')
    expect(of('show')).toEqual([['show', 0, false], ['show', 0, true]])
  })
  it('a hidden turtle still draws', () => {
    expect(run('turtle.hideturtle()\nturtle.forward(10)').report.drawing.strokes).toBe(1)
  })
  it('a turtle can be made invisible from the start', () => {
    const { report, of } = run('ghost = turtle.Turtle(visible=False)\nprint(ghost.isvisible())')
    expect(report.output).toBe('False')
    expect(of('new')).toEqual([['new', 0, false]])
  })
  it('speed sets and reads how fast the drawing plays', () => {
    const { report, of } = run('print(turtle.speed())\nturtle.speed(3)\nprint(turtle.speed())')
    expect(report.output).toBe('6\n3')
    expect(of('speed')).toEqual([['speed', 3]])
  })
  it.each([['fastest', 0], ['fast', 10], ['normal', 6], ['slow', 3], ['slowest', 1]])('speed("%s") is %i', (name, value) => {
    expect(printed(`turtle.speed("${name}")\nprint(turtle.speed())`)).toBe(String(value))
  })
  it('treats speeds outside 1 to 10 as "fastest", like the real turtle', () => {
    expect(printed('turtle.speed(0)\nprint(turtle.speed())')).toBe('0')
    expect(printed('turtle.speed(11)\nprint(turtle.speed())')).toBe('0')
    expect(printed('turtle.speed(-3)\nprint(turtle.speed())')).toBe('0')
    expect(printed('turtle.speed(4.4)\nprint(turtle.speed())')).toBe('4')
  })
})

describe('asking the turtle', () => {
  it.each(['position', 'pos'])('%s gives where it is', name => {
    expect(printed(`turtle.goto(12.345, -7)\nprint(turtle.${name}())`)).toBe('(12.35, -7.0)')
  })
  it('xcor and ycor give one coordinate each', () => {
    expect(printed('turtle.goto(30, -40)\nprint(turtle.xcor(), turtle.ycor())')).toBe('30.0 -40.0')
  })
  it('heading gives the direction it faces', () => {
    expect(printed('print(turtle.heading())\nturtle.right(45)\nprint(turtle.heading())')).toBe('0.0\n315.0')
  })
  it('does not show the tiny errors of repeated turning', () => {
    expect(printed('for turn in range(10):\n    turtle.left(36)\n    turtle.forward(10)\nprint(turtle.position(), turtle.heading())')).toBe('(0.0, 0.0) 0.0')
  })
  it('distance measures to a point, a pair, or another turtle', () => {
    expect(printed('me = turtle.Turtle()\nother = turtle.Turtle()\nother.penup()\nother.goto(30, 40)\nprint(me.distance(30, 40), me.distance((3, 4)), me.distance(other), turtle.distance(other))')).toBe('50.0 5.0 50.0 50.0')
  })
  it('towards gives the heading that points at a point, a pair, or another turtle', () => {
    expect(printed('me = turtle.Turtle()\nother = turtle.Turtle()\nother.penup()\nother.goto(-10, 0)\nprint(me.towards(0, 50), me.towards((10, -10)), me.towards(other))')).toBe('90.0 315.0 180.0')
  })
  it('asking never draws or moves', () => {
    const { report, of } = run('turtle.position(); turtle.pos(); turtle.xcor(); turtle.ycor(); turtle.heading(); turtle.distance(1, 1); turtle.towards(1, 1)\nturtle.isdown(); turtle.isvisible(); turtle.filling(); turtle.pensize(); turtle.pencolor(); turtle.fillcolor(); turtle.color(); turtle.speed(); turtle.shape(); turtle.shapesize()')
    expect(report).toMatchObject({ ok: true, drawing: { strokes: 0 } })
    expect(of('go')).toEqual([])
    expect(of('pose')).toEqual([])
  })
})

describe('clearing and resetting', () => {
  it('clear wipes the drawing and leaves the turtle where it is', () => {
    const { report, of } = run('turtle.pencolor("red")\nturtle.left(90)\nturtle.forward(80)\nturtle.clear()')
    expect(of('clear')).toHaveLength(1)
    expect(report.drawing).toEqual({ strokes: 0, bounds: null, colors: [] })
    expect(report.turtle).toEqual({ x: 0, y: 80, heading: 90 })
    expect(printed('turtle.pencolor("red")\nturtle.clear()\nprint(turtle.pencolor())')).toBe('red')
  })
  it('counts only what is drawn after a clear', () => {
    expect(run('turtle.forward(80)\nturtle.clear()\nturtle.pencolor("blue")\nturtle.forward(20)').report.drawing).toEqual({ strokes: 1, bounds: { left: 80, right: 100, bottom: 0, top: 0 }, colors: ['blue'] })
  })
  it('reset wipes the drawing and puts the turtle back as new', () => {
    const { report } = run('turtle.color("red", "blue")\nturtle.pensize(9)\nturtle.penup()\nturtle.hideturtle()\nturtle.goto(50, 60)\nturtle.left(33)\nturtle.begin_fill()\nturtle.reset()\nprint(turtle.position(), turtle.heading(), turtle.color(), turtle.pensize(), turtle.isdown(), turtle.isvisible(), turtle.filling())')
    expect(report.output).toBe("(0.0, 0.0) 0.0 ('black', 'black') 1 True True False")
    expect(report.turtle).toEqual({ x: 0, y: 0, heading: 0 })
    expect(report.drawing.strokes).toBe(0)
  })
  it('reset tells the page to redraw the turtle as new', () => {
    const { commands } = run('turtle.pencolor("red")\nturtle.hideturtle()\nturtle.goto(5, 5)\nturtle.reset()')
    expect(commands.slice(-5)).toEqual([['clear'], ['shape', 0, 'classic', 1, 1], ['ink', 0, 'black'], ['show', 0, true], ['pose', 0, 0, 0, 0]])
  })
  it.each(['clearscreen', 'resetscreen'])('%s wipes the drawing', name => {
    const { report, of } = run(`turtle.forward(50)\nturtle.${name}()`)
    expect(of('clear')).toHaveLength(1)
    expect(report.drawing.strokes).toBe(0)
  })
})

describe('the screen', () => {
  it('Screen() and getscreen() give the same screen every time', () => {
    expect(printed('print(turtle.Screen() is turtle.Screen(), turtle.getscreen() is turtle.Screen(), turtle.Turtle().getscreen() is turtle.Screen())')).toBe('True True True')
  })
  it('bgcolor sets and reads the background', () => {
    const { report, of } = run('print(turtle.bgcolor())\nturtle.bgcolor("Black")\nturtle.Screen().bgcolor(0, 0, 1)\nprint(turtle.bgcolor())')
    expect(report.output).toBe('white\n#0000ff')
    expect(of('bg')).toEqual([['bg', 'black'], ['bg', '#0000ff']])
    expect(report.drawing.strokes).toBe(0)
  })
  it('starts each run with a white background', () => {
    run('turtle.bgcolor("black")')
    expect(printed('print(turtle.bgcolor())')).toBe('white')
  })
  it('reports the size of the drawing pane', () => {
    expect(printed('screen = turtle.Screen()\nprint(turtle.window_width(), turtle.window_height(), screen.window_width(), screen.window_height())')).toBe('640 640 640 640')
  })
  it('turtles() lists every turtle made in this run', () => {
    expect(printed('print(len(turtle.turtles()))\nada = turtle.Turtle()\nbob = turtle.Turtle()\nprint(turtle.turtles() == [ada, bob], turtle.Screen().turtles() == [ada, bob])')).toBe('0\nTrue True')
  })
  it('accepts the window and event calls ordinary programs make, and does nothing', () => {
    const { report, commands } = run([
      'screen = turtle.Screen()',
      'screen.setup(800, 600); screen.title("Mine"); screen.tracer(0); screen.update(); screen.delay(0); screen.screensize(400, 400); screen.listen()',
      'screen.onkey(None, "Up"); screen.onkeypress(None, "a"); screen.onkeyrelease(None, "a"); screen.onclick(None); screen.onscreenclick(None); screen.ontimer(None, 100)',
      'turtle.setup(800, 600); turtle.title("Mine"); turtle.tracer(0, 0); turtle.update(); turtle.delay(0); turtle.screensize(); turtle.listen()',
      'turtle.onkey(None, "Up"); turtle.onkeypress(None, "a"); turtle.onclick(None); turtle.onscreenclick(None); turtle.ontimer(None, 100)',
      'screen.mainloop(); screen.exitonclick(); screen.bye(); turtle.mainloop(); turtle.done(); turtle.exitonclick(); turtle.bye()',
      'print("still running")',
    ].join('\n'))
    expect(report).toMatchObject({ ok: true, output: 'still running' })
    expect(commands).toEqual([['reset']])
  })
})

describe('several turtles', () => {
  it('Turtle, Pen and RawTurtle all make a turtle', () => {
    expect(printed('print(turtle.Pen is turtle.Turtle, turtle.RawTurtle is turtle.Turtle)')).toBe('True True')
  })
  it('each turtle has its own place, pen and number', () => {
    const { report, of } = run('ada = turtle.Turtle()\nbob = turtle.Turtle()\nada.pencolor("red")\nbob.pencolor("blue")\nada.forward(50)\nbob.left(90)\nbob.forward(70)\nprint(ada.position(), bob.position())')
    expect(report.output).toBe('(50.0, 0.0) (0.0, 70.0)')
    expect(of('new')).toEqual([['new', 0, true], ['new', 1, true]])
    expect(of('go')).toEqual([['go', 0, 0, 0, 50, 0, 0, 'red', 1], ['go', 1, 0, 0, 0, 70, 90, 'blue', 1]])
    expect(report.drawing).toMatchObject({ strokes: 2, colors: ['red', 'blue'] })
  })
  it('the module-level commands move the first turtle, making one if needed', () => {
    expect(printed('ada = turtle.Turtle()\nturtle.forward(25)\nprint(ada.xcor(), turtle.getturtle() is ada, turtle.getpen() is ada)')).toBe('25.0 True True')
    expect(run('turtle.forward(1)').of('new')).toEqual([['new', 0, true]])
  })
  it('the report describes the first turtle', () => {
    expect(run('ada = turtle.Turtle()\nbob = turtle.Turtle()\nbob.goto(90, 90)\nada.goto(-5, 0)').report.turtle).toEqual({ x: -5, y: 0, heading: 0 })
  })
  it('reports no turtle when the program never used one', () => {
    expect(run('print("no drawing")').report.turtle).toBeNull()
  })
})

describe('using a command wrongly', () => {
  it.each([
    ['turtle.forward()', /^TypeError: .*missing 1 required positional argument: 'distance'/],
    ['turtle.forward("ten")', /^TypeError/],
    ['turtle.left()', /^TypeError: .*missing 1 required positional argument: 'angle'/],
    ['turtle.goto("a", "b")', /^ValueError: could not convert string to float/],
    ['turtle.circle()', /^TypeError: .*missing 1 required positional argument: 'radius'/],
    ['turtle.penup(1)', /^TypeError/],
  ])('%s is reported with the line it is on', (code, message) => {
    const { report } = run(`turtle.forward(10)\n${code}`)
    expect(report.errors).toHaveLength(1)
    expect(report.errors[0].message).toMatch(message)
    expect(report.errors[0].line).toBe(3)
    expect(report.drawing.strokes).toBe(1)
  })
})
