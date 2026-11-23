# Target: a bullseye made of three dots, each smaller than the last.
# A simplified practice drawing. The real logo is a trademark of its owner.
import turtle

turtle.speed(6)
turtle.penup()

turtle.dot(300, "#cc0000")   # the outer red ring
turtle.dot(200, "white")     # the white ring covers its middle
turtle.dot(100, "#cc0000")   # the red middle

turtle.hideturtle()
