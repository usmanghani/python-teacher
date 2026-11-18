# A flower made of circles, on a green stem.
import turtle

def petal(size):
    turtle.circle(size, 60)
    turtle.left(120)
    turtle.circle(size, 60)
    turtle.left(120)

turtle.speed(9)

# stem
turtle.penup()
turtle.goto(0, -220)
turtle.setheading(90)
turtle.pendown()
turtle.pensize(6)
turtle.color("forestgreen")
turtle.forward(220)

# petals
turtle.pensize(2)
turtle.color("deeppink", "pink")
for count in range(12):
    turtle.begin_fill()
    petal(110)
    turtle.end_fill()
    turtle.left(30)

# middle
turtle.dot(36, "gold")
turtle.hideturtle()
