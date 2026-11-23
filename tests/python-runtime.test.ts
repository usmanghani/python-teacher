// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadPyodide } from 'pyodide'
import { createRuntime, type DrawCommand, type PythonRuntime } from '../src/python/runtime'
import { lessons } from '../src/teacher/lessons'
import { examples as catalog } from '../src/examples/catalog'

// The real thing: CPython (Pyodide) running the turtle module and runner the page uses.
let python: PythonRuntime
beforeAll(async () => {
  python = createRuntime(await loadPyodide(), readFileSync(new URL('../src/python/turtle_shim.py', import.meta.url), 'utf8'))
}, 120_000)

function run(code: string) {
  const commands: DrawCommand[] = []
  let printed = ''
  const report = python.run(code, { onCommands: batch => commands.push(...batch), onOutput: text => { printed += text } })
  return { report, commands, printed }
}

describe('running a program', () => {
  it('reports output, where the turtle ended, and what it drew', () => {
    const { report, commands, printed } = run('import turtle\nturtle.color("red")\nfor side in range(4):\n    turtle.forward(80)\n    turtle.left(90)\nprint("done")')
    expect(report).toEqual({ ok: true, output: 'done', errors: [], turtle: { x: 0, y: 0, heading: 0 }, drawing: { strokes: 4, bounds: { left: 0, right: 80, bottom: 0, top: 80 }, colors: ['red'] } })
    expect(printed).toBe('done\n')
    expect(commands[0]).toEqual(['reset'])
    expect(commands.filter(command => command[0] === 'go')).toHaveLength(4)
    expect(commands.find(command => command[0] === 'go')).toEqual(['go', 0, 0, 0, 80, 0, 0, 'red', 1])
  })
  it('names the error and the line it happened on', () => {
    expect(run('import turtle\n\nturtle.forwrd(10)').report.errors).toEqual([{ message: "AttributeError: module 'turtle' has no attribute 'forwrd'", line: 3 }])
    expect(run('x = 1\nprint(y)').report.errors).toEqual([{ message: "NameError: name 'y' is not defined", line: 2 }])
    expect(run('for i in range(3)\n    print(i)').report.errors).toEqual([{ message: "SyntaxError: expected ':'", line: 1 }])
    expect(run('def f():\n    return 1 / 0\n\nf()').report.errors).toEqual([{ message: 'ZeroDivisionError: division by zero', line: 2 }])
  })
  it('keeps what was printed and drawn before an error', () => {
    const { report } = run('import turtle\nturtle.forward(50)\nprint("before")\nboom')
    expect(report).toMatchObject({ ok: false, output: 'before', drawing: { strokes: 1 } })
  })
  it('stops a turtle that never stops, and explains runaway recursion', () => {
    expect(run('import turtle\nwhile True:\n    turtle.forward(1)').report.errors[0].message).toMatch(/drew too much/)
    expect(run('def again():\n    return again()\nagain()').report.errors[0].message).toBe('RecursionError: a function kept calling itself and never stopped')
  })
  it('starts every run from a clean slate', () => {
    run('leftover = 5\nimport turtle\nturtle.forward(300)')
    const { report } = run('print(leftover)')
    expect(report.errors[0].message).toBe("NameError: name 'leftover' is not defined")
    expect(report.drawing).toEqual({ strokes: 0, bounds: null, colors: [] })
  })
  it('explains that input() is not available instead of hanging', () => {
    expect(run('name = input("Name? ")').report.errors[0].message).toMatch(/input\(\) is not available/)
  })
  it('turns time.sleep into a pause in the drawing, so the program itself never waits', () => {
    const started = Date.now()
    const { report, commands } = run('import time\ntime.sleep(2)\nprint("after")')
    expect(report).toMatchObject({ ok: true, output: 'after' })
    expect(commands).toContainEqual(['wait', 2000])
    expect(Date.now() - started).toBeLessThan(1500)
  })
  it('bounds the output it reports', () => {
    expect(run('for i in range(5000):\n    print("hello hello hello")').report.output.length).toBeLessThanOrEqual(4000)
  })
})

describe('the turtle module', () => {
  it('faces right at the start, turns left counter-clockwise, and measures in steps', () => {
    const { report } = run('import turtle\nturtle.left(90)\nturtle.forward(100)\nprint(turtle.position(), turtle.heading())')
    expect(report.output).toBe('(0.0, 100.0) 90.0')
    expect(report.turtle).toEqual({ x: 0, y: 100, heading: 90 })
  })
  it('moves without drawing when the pen is up', () => {
    const { report, commands } = run('import turtle\nturtle.penup()\nturtle.goto(50, 50)\nturtle.pendown()\nturtle.forward(10)')
    expect(report.drawing.strokes).toBe(1)
    expect(commands.filter(command => command[0] === 'go').map(command => command[7])).toEqual([null, 'black'])
  })
  it('draws a circle that comes back to where it started', () => {
    const { report } = run('import turtle\nturtle.circle(50)')
    expect(report.turtle).toEqual({ x: 0, y: 0, heading: 0 })
    expect(report.drawing.bounds!.top).toBeCloseTo(100, 0)
    expect(report.drawing.bounds!.left).toBeCloseTo(-50, 0)
  })
  it('fills a shape and keeps its outline on top', () => {
    const { commands } = run('import turtle\nturtle.color("black", "gold")\nturtle.begin_fill()\nfor side in range(3):\n    turtle.forward(60)\n    turtle.left(120)\nturtle.end_fill()')
    const fill = commands.find(command => command[0] === 'fill')!
    expect(fill[2]).toBe('gold')
    expect(fill[1]).toHaveLength(4)
    expect(fill[3]).toHaveLength(3)
  })
  it('accepts color names, hex codes and number triples', () => {
    const { report } = run('import turtle\nturtle.pencolor("Red")\nturtle.forward(1)\nturtle.pencolor("#00ff00")\nturtle.forward(1)\nturtle.pencolor(0, 0, 1)\nturtle.forward(1)\nturtle.colormode(255)\nturtle.pencolor(255, 128, 0)\nturtle.forward(1)')
    expect(report.drawing.colors).toEqual(['red', '#00ff00', '#0000ff', '#ff8000'])
    expect(run('import turtle\nturtle.color(5)').report.errors[0].message).toMatch(/bad color/)
  })
  it('supports the short names, several turtles, and ordinary endings like done()', () => {
    const { report } = run('from turtle import *\nfd(10); bk(10); lt(90); rt(90); pu(); pd()\nt = Turtle()\nt.goto(0, 40)\nScreen().bgcolor("black")\ndone()')
    expect(report.ok).toBe(true)
    expect(report.drawing.strokes).toBe(3)
  })
})

describe('the command line', () => {
  it('shows the value of an expression and remembers what the program defined', () => {
    run('side = 40\nimport turtle')
    let printed = ''
    expect(python.line('side + 2', { onOutput: text => { printed += text } }).ok).toBe(true)
    expect(printed).toBe('42\n')
    const commands: DrawCommand[] = []
    python.line('turtle.forward(side)', { onCommands: batch => commands.push(...batch) })
    expect(commands).toContainEqual(['go', 0, 0, 0, 40, 0, 0, 'black', 1])
    expect(python.line('nope').errors[0].message).toBe("NameError: name 'nope' is not defined")
  })
})

describe('the course and the examples', () => {
  it('has unique lesson ids', () => {
    expect(new Set(lessons.map(lesson => lesson.id)).size).toBe(lessons.length)
  })
  it.each(lessons.map(lesson => [lesson.title, lesson] as const))('starter for "%s" runs cleanly and fits the pane', (_title, lesson) => {
    const { report } = run(lesson.starter)
    expect(report.errors).toEqual([])
    expect(report.drawing.strokes).toBeGreaterThan(0)
    const { left, right, bottom, top } = report.drawing.bounds!
    expect(Math.max(-left, right, -bottom, top)).toBeLessThanOrEqual(320)
  })
  const examples = readdirSync(new URL('../examples/', import.meta.url), { recursive: true, encoding: 'utf8' }).filter(name => name.endsWith('.py')).sort()
  it.each(examples)('example %s runs cleanly, draws, and fits the pane', name => {
    const { report } = run(readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'))
    expect(report.errors).toEqual([])
    expect(report.drawing.strokes).toBeGreaterThan(0)
    const { left, right, bottom, top } = report.drawing.bounds!
    expect(Math.max(-left, right, -bottom, top)).toBeLessThanOrEqual(320)
  })
  it('every example file is in the menu, once', () => {
    expect(catalog.map(example => example.source).sort()).toEqual(examples.map(name => readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8')).sort())
    expect(new Set(catalog.map(example => example.id)).size).toBe(catalog.length)
  })
  it('the Mastercard overlap closes into a lens between the two circles', () => {
    const { commands } = run(readFileSync(new URL('../examples/logos/mastercard.py', import.meta.url), 'utf8'))
    const points = commands.find(command => command[0] === 'fill')![1] as Array<[number, number]>
    expect(points.at(-1)![0]).toBeCloseTo(points[0][0], 0)
    expect(points.at(-1)![1]).toBeCloseTo(points[0][1], 0)
    const widest = Math.max(...points.map(([x]) => Math.abs(x)))
    expect(widest).toBeGreaterThan(28)
    expect(widest).toBeLessThanOrEqual(30)
  })
  it('the Mitsubishi diamonds each start and end at the middle', () => {
    const { commands } = run(readFileSync(new URL('../examples/logos/mitsubishi.py', import.meta.url), 'utf8'))
    const fills = commands.filter(command => command[0] === 'fill')
    expect(fills).toHaveLength(3)
    for (const fill of fills) expect((fill[1] as Array<[number, number]>).at(-1)!.map(Math.round).map(Math.abs)).toEqual([0, 0])
  })
})
