# Audi: four rings in a row, each one overlapping the next.
# A simplified practice drawing. The real logo is a trademark of its owner.
import turtle

RADIUS = 60
STEP = 85   # less than two radiuses, so the rings overlap

turtle.speed(8)
turtle.pensize(9)
turtle.pencolor("#333333")

for count in range(4):
    turtle.penup()
    turtle.goto(-1.5 * STEP + count * STEP, -RADIUS)
    turtle.pendown()
    turtle.circle(RADIUS)

turtle.hideturtle()
