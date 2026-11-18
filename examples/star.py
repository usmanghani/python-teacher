# A five-pointed star, filled in.
import turtle

turtle.speed(6)
turtle.pensize(3)
turtle.color("darkorange", "gold")

turtle.penup()
turtle.goto(-120, 40)
turtle.pendown()

turtle.begin_fill()
for point in range(5):
    turtle.forward(240)
    turtle.right(144)
turtle.end_fill()

turtle.hideturtle()
