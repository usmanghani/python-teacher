# Microsoft: four colored squares in a two-by-two grid.
# A simplified practice drawing. The real logo is a trademark of its owner.
import turtle

SIZE = 110
GAP = 12

def square(x, y, color):
    """Fill a square whose bottom-left corner is at x, y."""
    turtle.penup()
    turtle.goto(x, y)
    turtle.setheading(0)
    turtle.color(color)
    turtle.begin_fill()
    for side in range(4):
        turtle.forward(SIZE)
        turtle.left(90)
    turtle.end_fill()

turtle.speed(7)

near = GAP / 2           # the squares to the right of, or above, the middle
far = -GAP / 2 - SIZE    # the squares to the left of, or below, it

square(far, near, "#f25022")    # red, top left
square(near, near, "#7fba00")   # green, top right
square(far, far, "#00a4ef")     # blue, bottom left
square(near, far, "#ffb900")    # yellow, bottom right

turtle.hideturtle()
