# Mastercard: two circles that overlap, with a third color where they meet.
# A simplified practice drawing. The real logo is a trademark of its owner.
import math
import turtle

RADIUS = 80
APART = 50   # how far each circle's middle is from the middle of the picture

turtle.speed(8)
turtle.penup()

# the two circles
turtle.goto(-APART, 0)
turtle.dot(RADIUS * 2, "#eb001b")
turtle.goto(APART, 0)
turtle.dot(RADIUS * 2, "#f79e1b")

# The overlap is a lens made of two arcs. A little geometry says how big each arc is.
angle = math.degrees(math.acos(APART / RADIUS))
height = math.sqrt(RADIUS ** 2 - APART ** 2)

turtle.goto(0, -height)
turtle.setheading(90 - angle)
turtle.fillcolor("#ff5f00")
turtle.begin_fill()
turtle.circle(RADIUS, 2 * angle)
turtle.left(180 - 2 * angle)
turtle.circle(RADIUS, 2 * angle)
turtle.end_fill()

turtle.hideturtle()
