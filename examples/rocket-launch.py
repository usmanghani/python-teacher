# A rocket that counts down and lifts off.
# time.sleep pauses the drawing, which is what makes it an animation.
import time
import turtle

pen = turtle.Turtle()
pen.hideturtle()
pen.speed(0)

def rocket(y):
    pen.clear()
    # body
    pen.penup()
    pen.goto(-25, y)
    pen.setheading(0)
    pen.pendown()
    pen.color("gray", "lightgray")
    pen.begin_fill()
    for side in range(2):
        pen.forward(50)
        pen.left(90)
        pen.forward(120)
        pen.left(90)
    pen.end_fill()
    # nose
    pen.penup()
    pen.goto(-25, y + 120)
    pen.pendown()
    pen.color("firebrick", "tomato")
    pen.begin_fill()
    pen.goto(0, y + 170)
    pen.goto(25, y + 120)
    pen.goto(-25, y + 120)
    pen.end_fill()
    # window
    pen.penup()
    pen.goto(0, y + 80)
    pen.dot(24, "skyblue")

def flame(y):
    pen.penup()
    pen.goto(-15, y)
    pen.pendown()
    pen.color("orange", "gold")
    pen.begin_fill()
    pen.goto(0, y - 50)
    pen.goto(15, y)
    pen.goto(-15, y)
    pen.end_fill()

def say(text, y):
    pen.penup()
    pen.goto(0, y)
    pen.color("black")
    pen.write(text, align="center", font=("Arial", 28, "bold"))

turtle.bgcolor("midnightblue")

for count in [3, 2, 1]:
    rocket(-200)
    pen.color("white")
    pen.penup()
    pen.goto(0, 60)
    pen.write(count, align="center", font=("Arial", 48, "bold"))
    time.sleep(1)

height = -200
speed = 4
while height < 400:
    rocket(height)
    flame(height)
    time.sleep(0.05)
    height = height + speed
    speed = speed + 1

pen.clear()
pen.color("white")
pen.penup()
pen.goto(0, 0)
pen.write("Liftoff!", align="center", font=("Arial", 36, "bold"))
