# The Olympic rings: five circles, three above and two below.
# A simplified practice drawing. The real logo is a trademark of its owner.
import turtle

RADIUS = 55

def ring(x, y, color):
    """Draw a ring with its middle at x, y."""
    turtle.penup()
    turtle.goto(x, y - RADIUS)
    turtle.setheading(0)
    turtle.pencolor(color)
    turtle.pendown()
    turtle.circle(RADIUS)

turtle.speed(8)
turtle.pensize(9)

ring(-130, 30, "#0081c8")   # blue
ring(0, 30, "black")
ring(130, 30, "#ee334e")    # red
ring(-65, -25, "#fcb131")   # yellow
ring(65, -25, "#00a651")    # green

turtle.hideturtle()
