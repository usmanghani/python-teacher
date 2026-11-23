# Mitsubishi: three red diamonds that meet at the middle.
# A simplified practice drawing. The real logo is a trademark of its owner.
import turtle

SIDE = 120

def diamond(direction):
    """Fill a diamond with one sharp corner at the middle, pointing in a direction."""
    turtle.penup()
    turtle.home()
    turtle.setheading(direction)
    turtle.begin_fill()
    turtle.left(30)
    turtle.forward(SIDE)
    turtle.right(60)
    turtle.forward(SIDE)
    turtle.right(120)
    turtle.forward(SIDE)
    turtle.right(60)
    turtle.forward(SIDE)
    turtle.end_fill()

turtle.speed(7)
turtle.color("#e60012")

# three diamonds, a third of a turn apart
for direction in [90, 210, 330]:
    diamond(direction)

turtle.hideturtle()
