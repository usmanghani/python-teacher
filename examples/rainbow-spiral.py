# A spiral that changes color as it grows.
import turtle

colors = ["red", "orange", "gold", "green", "blue", "purple"]

turtle.speed(0)
turtle.bgcolor("black")
turtle.pensize(2)

for step in range(150):
    turtle.color(colors[step % len(colors)])
    turtle.forward(step * 2)
    turtle.left(59)

turtle.hideturtle()
