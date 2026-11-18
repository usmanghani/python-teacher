/** The words a beginner meets in this course, for the "Python words" panel. */

export interface HelpEntry {
  name: string
  aliases: string[]
  category: string
  description: string
  example?: string
}

export const HELP_DATA: HelpEntry[] = [
  { name: 'forward', aliases: ['fd'], category: 'Moving', description: 'Walk forward this many steps, drawing if the pen is down.', example: 'turtle.forward(100)' },
  { name: 'backward', aliases: ['bk', 'back'], category: 'Moving', description: 'Walk backward this many steps without turning around.', example: 'turtle.backward(50)' },
  { name: 'left', aliases: ['lt'], category: 'Moving', description: 'Turn left (counter-clockwise) by this many degrees.', example: 'turtle.left(90)' },
  { name: 'right', aliases: ['rt'], category: 'Moving', description: 'Turn right (clockwise) by this many degrees.', example: 'turtle.right(45)' },
  { name: 'goto', aliases: ['setpos'], category: 'Moving', description: 'Go straight to a point. The middle of the page is (0, 0).', example: 'turtle.goto(50, 80)' },
  { name: 'setheading', aliases: ['seth'], category: 'Moving', description: 'Face a direction: 0 is right, 90 is up, 180 is left, 270 is down.', example: 'turtle.setheading(90)' },
  { name: 'home', aliases: [], category: 'Moving', description: 'Go back to the middle, facing right.', example: 'turtle.home()' },
  { name: 'circle', aliases: [], category: 'Moving', description: 'Walk in a circle of this radius. Give a second number to draw only part of it.', example: 'turtle.circle(50)\nturtle.circle(50, 180)' },
  { name: 'speed', aliases: [], category: 'Moving', description: 'How fast the turtle walks: 1 is slow, 10 is fast, 0 draws at once.', example: 'turtle.speed(3)' },

  { name: 'penup', aliases: ['pu', 'up'], category: 'Pen', description: 'Lift the pen. The turtle moves without drawing.', example: 'turtle.penup()' },
  { name: 'pendown', aliases: ['pd', 'down'], category: 'Pen', description: 'Put the pen down. The turtle draws as it moves.', example: 'turtle.pendown()' },
  { name: 'pensize', aliases: ['width'], category: 'Pen', description: 'Set how thick the line is.', example: 'turtle.pensize(4)' },
  { name: 'pencolor', aliases: [], category: 'Pen', description: 'Set the line color with a name or a "#rrggbb" code.', example: 'turtle.pencolor("red")' },
  { name: 'fillcolor', aliases: [], category: 'Pen', description: 'Set the color used to fill shapes.', example: 'turtle.fillcolor("gold")' },
  { name: 'color', aliases: [], category: 'Pen', description: 'Set the line color, or the line and fill colors together.', example: 'turtle.color("blue")\nturtle.color("black", "yellow")' },
  { name: 'begin_fill', aliases: [], category: 'Pen', description: 'Start a shape that will be filled in.', example: 'turtle.begin_fill()' },
  { name: 'end_fill', aliases: [], category: 'Pen', description: 'Fill the shape drawn since begin_fill().', example: 'turtle.end_fill()' },
  { name: 'dot', aliases: [], category: 'Pen', description: 'Draw a round dot where the turtle is.', example: 'turtle.dot(20, "red")' },
  { name: 'write', aliases: [], category: 'Pen', description: 'Write text on the drawing where the turtle is.', example: 'turtle.write("Hello!")' },
  { name: 'bgcolor', aliases: [], category: 'Pen', description: 'Set the color of the whole page.', example: 'turtle.bgcolor("lightblue")' },
  { name: 'hideturtle', aliases: ['ht'], category: 'Pen', description: 'Hide the turtle so only the drawing shows.', example: 'turtle.hideturtle()' },
  { name: 'showturtle', aliases: ['st'], category: 'Pen', description: 'Show the turtle again.', example: 'turtle.showturtle()' },
  { name: 'clear', aliases: [], category: 'Pen', description: 'Wipe the drawing. The turtle stays where it is.', example: 'turtle.clear()' },

  { name: 'import', aliases: [], category: 'Basics', description: 'Bring in a toolbox. Every drawing program starts by importing turtle.', example: 'import turtle' },
  { name: 'print', aliases: [], category: 'Basics', description: 'Show a value in the output under the drawing.', example: 'print("Hello", 2 + 3)' },
  { name: 'variable', aliases: ['='], category: 'Basics', description: 'Give a value a name so you can use it again.', example: 'side = 80\nturtle.forward(side)' },
  { name: '#', aliases: ['comment'], category: 'Basics', description: 'A note for people. Python ignores the rest of the line.', example: '# draw the roof' },
  { name: 'random.randint', aliases: [], category: 'Basics', description: 'Pick a whole number between two numbers, different each run.', example: 'import random\nsteps = random.randint(20, 100)' },

  { name: 'for', aliases: ['range'], category: 'Loops', description: 'Repeat the indented lines a set number of times.', example: 'for side in range(4):\n    turtle.forward(100)\n    turtle.left(90)' },
  { name: 'while', aliases: [], category: 'Loops', description: 'Repeat the indented lines for as long as something is true.', example: 'size = 10\nwhile size < 100:\n    turtle.forward(size)\n    size = size + 10' },

  { name: 'if', aliases: ['elif', 'else'], category: 'Decisions', description: 'Run the indented lines only when something is true.', example: 'if side % 2 == 0:\n    turtle.color("red")\nelse:\n    turtle.color("blue")' },
  { name: '==', aliases: ['!=', '<', '>'], category: 'Decisions', description: 'Compare two values. == asks "are these equal?"', example: 'if size > 50:\n    print("big")' },

  { name: 'def', aliases: [], category: 'Functions', description: 'Teach Python a new command. The indented lines are what it does.', example: 'def square(size):\n    for side in range(4):\n        turtle.forward(size)\n        turtle.left(90)\n\nsquare(60)' },
  { name: 'return', aliases: [], category: 'Functions', description: 'Hand a value back from a function.', example: 'def double(n):\n    return n * 2' },

  { name: 'list', aliases: ['[]'], category: 'Lists', description: 'Several values in order, inside square brackets.', example: 'colors = ["red", "gold", "blue"]' },
  { name: 'for … in list', aliases: [], category: 'Lists', description: 'Do something with each item of a list in turn.', example: 'for name in ["red", "gold", "blue"]:\n    turtle.color(name)\n    turtle.forward(50)' },
  { name: 'len', aliases: [], category: 'Lists', description: 'How many items a list has.', example: 'len(colors)' },
]

export function findHelp(query: string): HelpEntry[] {
  const q = query.trim().toLowerCase()
  return HELP_DATA.filter(entry => entry.name.toLowerCase().includes(q) || entry.aliases.some(alias => alias.toLowerCase().includes(q)) || entry.description.toLowerCase().includes(q))
}
