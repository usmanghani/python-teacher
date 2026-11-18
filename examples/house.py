# A house: a square, a triangle roof, a door and a sun.
import turtle

def square(size):
    for side in range(4):
        turtle.forward(size)
        turtle.left(90)

def roof(size):
    for side in range(3):
        turtle.forward(size)
        turtle.left(120)

def move(x, y):
    turtle.penup()
    turtle.goto(x, y)
    turtle.setheading(0)
    turtle.pendown()

turtle.speed(8)
turtle.pensize(3)

# walls
move(-80, -100)
turtle.color("saddlebrown", "wheat")
turtle.begin_fill()
square(160)
turtle.end_fill()

# roof
move(-80, 60)
turtle.color("firebrick", "tomato")
turtle.begin_fill()
roof(160)
turtle.end_fill()

# door
move(-20, -100)
turtle.color("saddlebrown", "peru")
turtle.begin_fill()
for side in range(2):
    turtle.forward(40)
    turtle.left(90)
    turtle.forward(70)
    turtle.left(90)
turtle.end_fill()

# sun
move(170, 170)
turtle.dot(60, "gold")

turtle.hideturtle()
