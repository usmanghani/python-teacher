# Visa: four slanted blue letters and a gold flick, drawn with one thick pen.
# A simplified practice drawing. The real logo is a trademark of its owner.
import turtle

BLUE = "#1a1f71"
GOLD = "#f7b600"
SLANT = 0.25   # how far each point leans to the right as it goes up

def stroke(points, color=BLUE):
    """Draw one line through all the points, leaning them to the right."""
    turtle.penup()
    turtle.pencolor(color)
    for x, y in points:
        turtle.goto(x + y * SLANT, y)
        turtle.pendown()

turtle.speed(7)
turtle.pensize(22)

stroke([(-235, 60), (-195, -60), (-145, 60)])                      # V
stroke([(-95, -60), (-95, 60)])                                    # I
stroke([(25, 42), (-5, 60), (-40, 42), (-35, 12), (15, -12), (20, -42), (-10, -60), (-45, -42)])  # S
stroke([(70, -60), (120, 60), (165, -60)])                         # A
stroke([(90, -18), (150, -18)])                                    # the bar of the A
stroke([(-285, 62), (-240, 62)], GOLD)                             # the gold flick

turtle.hideturtle()
