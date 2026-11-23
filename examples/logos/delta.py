# Delta Air Lines: a triangle built from four smaller pieces in two reds.
# A simplified practice drawing. The real logo is a trademark of its owner.
import turtle

LIGHT = "#e3132c"
DARK = "#9b1631"

def piece(color, points):
    """Fill the shape with these corners."""
    turtle.penup()
    turtle.goto(points[-1])
    turtle.color(color)
    turtle.begin_fill()
    for point in points:
        turtle.goto(point)
    turtle.end_fill()

turtle.speed(7)

# the top pyramid: a light half and a dark half
piece(LIGHT, [(0, 150), (-85, 7), (0, -28)])
piece(DARK, [(0, 150), (85, 7), (0, -28)])

# the chevron underneath, with the colors swapped
piece(DARK, [(-102, -21), (-170, -135), (0, -72), (0, -63)])
piece(LIGHT, [(102, -21), (170, -135), (0, -72), (0, -63)])

turtle.hideturtle()
