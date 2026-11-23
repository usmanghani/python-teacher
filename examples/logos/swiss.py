# Swiss International Air Lines: a white cross on a red square, like the Swiss flag.
# A simplified practice drawing. The real logo is a trademark of its owner.
import turtle

def box(width, height, color):
    """Fill a box with its middle at the middle of the picture."""
    turtle.penup()
    turtle.goto(-width / 2, -height / 2)
    turtle.setheading(0)
    turtle.color(color)
    turtle.begin_fill()
    for side in range(2):
        turtle.forward(width)
        turtle.left(90)
        turtle.forward(height)
        turtle.left(90)
    turtle.end_fill()

turtle.speed(7)

box(260, 260, "#e30613")   # the red square
box(160, 50, "white")      # the cross: one bar lying down...
box(50, 160, "white")      # ...and one standing up

turtle.hideturtle()
