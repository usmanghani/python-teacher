/**
 * The Python course. This file is plain data shared by the page (the lesson path) and
 * the agent (its teaching brief), so the two can never drift apart.
 */
export interface Lesson {
  id: string
  title: string
  /** One line for the student. */
  blurb: string
  /** What the student should be able to do afterwards. Written for the teacher. */
  goal: string
  /** New words this lesson introduces. */
  commands: string[]
  /** A small program the teacher can start from. */
  starter: string
  /** The exercise that proves the idea has landed. */
  challenge: string
}

export const lessons: Lesson[] = [
  {
    id: 'meet-the-turtle',
    title: 'Meet the turtle',
    blurb: 'Move, turn, and draw your first line.',
    goal: 'Understand that a program is a list of instructions run from top to bottom, that the turtle has a position and a heading, and that forward draws while left and right only turn.',
    commands: ['import turtle', 'turtle.forward()', 'turtle.backward()', 'turtle.left()', 'turtle.right()'],
    starter: 'import turtle\n\nturtle.forward(100)\nturtle.left(90)\nturtle.forward(100)',
    challenge: 'Draw a square by hand: four sides, four turns.',
  },
  {
    id: 'loops',
    title: 'Say it once: for loops',
    blurb: 'Let Python do the boring part.',
    goal: 'Replace copied lines with a for loop over range(), understand that indentation marks what is repeated, and discover that the turns of a closed shape add up to 360.',
    commands: ['for … in range():', 'indentation'],
    starter: 'import turtle\n\nfor side in range(4):\n    turtle.forward(100)\n    turtle.left(90)',
    challenge: 'Draw a triangle, then a hexagon. What angle does each one need?',
  },
  {
    id: 'pen-and-color',
    title: 'Pen and color',
    blurb: 'Lift the pen, change color, fill shapes.',
    goal: 'Move without drawing using penup, style lines with color and pensize, and fill a shape with begin_fill and end_fill.',
    commands: ['turtle.penup()', 'turtle.pendown()', 'turtle.color()', 'turtle.pensize()', 'turtle.begin_fill()', 'turtle.end_fill()', 'turtle.goto()'],
    starter: 'import turtle\n\nturtle.pensize(3)\nturtle.color("red", "gold")\nturtle.begin_fill()\nfor side in range(4):\n    turtle.forward(80)\n    turtle.left(90)\nturtle.end_fill()\n\nturtle.penup()\nturtle.goto(-150, 0)\nturtle.pendown()\nturtle.color("blue")\nturtle.circle(40)',
    challenge: 'Draw three squares in a row, each a different color, without a line joining them.',
  },
  {
    id: 'variables',
    title: 'Names for values',
    blurb: 'Store a value in a variable and change it as you go.',
    goal: 'Create a variable, use it, update it inside a loop, and print values to check your thinking.',
    commands: ['name = value', 'print()', '+ - * /'],
    starter: 'import turtle\n\nside = 10\nfor step in range(20):\n    turtle.forward(side)\n    turtle.left(90)\n    side = side + 10\n\nprint("The last side was", side)',
    challenge: 'Change the spiral so it turns 91 degrees, then make the sides grow faster.',
  },
  {
    id: 'functions',
    title: 'Teach Python a new word',
    blurb: 'Write your own commands with def.',
    goal: 'Define a function with a parameter, call it with different values, and reuse it to build a bigger picture.',
    commands: ['def name(parameter):', 'calling a function'],
    starter: 'import turtle\n\ndef square(size):\n    for side in range(4):\n        turtle.forward(size)\n        turtle.left(90)\n\nsquare(40)\nsquare(80)\nsquare(120)',
    challenge: 'Write polygon(sides, size) that draws any regular polygon. Hint: the turn is 360 / sides.',
  },
  {
    id: 'decisions',
    title: 'Making decisions',
    blurb: 'Do different things with if and else.',
    goal: 'Compare values and branch with if, elif and else, and use % to test for every second or third time.',
    commands: ['if … :', 'else:', '== != < >', '%'],
    starter: 'import turtle\n\nturtle.pensize(3)\nfor step in range(12):\n    if step % 2 == 0:\n        turtle.color("red")\n    else:\n        turtle.color("blue")\n    turtle.forward(60)\n    turtle.backward(60)\n    turtle.left(30)',
    challenge: 'Draw a row of 6 dots where every third dot is green.',
  },
  {
    id: 'lists',
    title: 'Lists of things',
    blurb: 'Keep several values together and visit each one.',
    goal: 'Make a list, loop over its items, and pick an item by position with an index.',
    commands: ['[a, b, c]', 'for item in list:', 'list[index]', 'len()'],
    starter: 'import turtle\n\ncolors = ["red", "orange", "gold", "green", "blue", "purple"]\n\nturtle.pensize(4)\nfor color in colors:\n    turtle.color(color)\n    turtle.forward(120)\n    turtle.backward(120)\n    turtle.left(60)\n\nprint("I used", len(colors), "colors")',
    challenge: 'Make a list of sizes and draw one square for each size, each in a different color.',
  },
  {
    id: 'recursion',
    title: 'A function that calls itself',
    blurb: 'Spirals and trees from one short idea.',
    goal: 'Write a recursive function with a stopping rule, and explain why the rule is needed.',
    commands: ['return', 'recursion'],
    starter: 'import turtle\n\ndef spiral(size):\n    if size > 200:\n        return\n    turtle.forward(size)\n    turtle.left(91)\n    spiral(size + 4)\n\nturtle.speed(0)\nspiral(4)',
    challenge: 'Write tree(size) that draws a branch, then two smaller trees, and stops when the branch is tiny.',
  },
]

export const lessonById = (id: string | undefined | null): Lesson | undefined => lessons.find(lesson => lesson.id === id)
