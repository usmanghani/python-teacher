"""Turtle graphics and the program runner for Python Teacher.

This file is loaded into Pyodide once. It provides a `turtle` module that works like the
standard library's, except that it does not open a window: every mark the turtle makes is
sent to the page as a small drawing command, and the page draws it on its canvas.

It also runs the student's program (`_run`) and command-line entries (`_line`), and reports
what happened in a form the teacher can use: printed output, errors with line numbers, where
the turtle ended, and the size of the drawing.
"""
import builtins
import json
import math
import sys
import time
import traceback
import types

MAX_COMMANDS = 150_000
MAX_OUTPUT = 20_000
PROGRAM = "<program>"

# Set by the host (the worker, or a test) before a run.
_send_commands = None  # called with a JSON string holding a list of drawing commands
_send_output = None    # called with printed text


class _Stage:
    """Everything drawn in one run, shared by all turtles."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.pending = []
        self.sent = 0
        self.strokes = 0
        self.bounds = None
        self.colors = []
        self.turtles = []
        self.colormode = 1.0
        self.output = 0

    def emit(self, command):
        self.sent += 1
        if self.sent > MAX_COMMANDS:
            raise RuntimeError("The turtle drew too much and was stopped. Look for a loop that never ends.")
        self.pending.append(command)
        if len(self.pending) >= 400:
            self.flush()

    def flush(self):
        if self.pending and _send_commands is not None:
            _send_commands(json.dumps(self.pending))
        self.pending = []

    def ink(self, points, color, margin=0.0):
        self.strokes += 1
        if color not in self.colors and len(self.colors) < 12:
            self.colors.append(color)
        b = self.bounds or [math.inf, -math.inf, math.inf, -math.inf]
        for x, y in points:
            b[0] = min(b[0], x - margin); b[1] = max(b[1], x + margin)
            b[2] = min(b[2], y - margin); b[3] = max(b[3], y + margin)
        self.bounds = b


_stage = _Stage()


def _round(value):
    return round(value, 2) + 0.0


def _color(value, *rest):
    """Accept what turtle accepts: a name, "#rrggbb", or r, g, b numbers."""
    if rest:
        value = (value, *rest)
    if isinstance(value, str):
        return value.strip().lower()
    try:
        r, g, b = value
    except Exception:
        raise TypeError(f"bad color: {value!r}. Use a name like 'red', '#ff0000', or three numbers.") from None
    scale = 255 if _stage.colormode == 1.0 else 1
    r, g, b = (max(0, min(255, round(c * scale))) for c in (r, g, b))
    return f"#{r:02x}{g:02x}{b:02x}"


class Turtle:
    def __init__(self, shape="classic", visible=True):
        self._id = len(_stage.turtles)
        _stage.turtles.append(self)
        self._x = 0.0
        self._y = 0.0
        self._heading = 0.0  # degrees, 0 is east, counter-clockwise
        self._down = True
        self._pencolor = "black"
        self._fillcolor = "black"
        self._size = 1
        self._visible = visible
        self._fill = None
        self._speed = 6
        _stage.emit(["new", self._id, self._visible])

    # --- moving ---
    def _go(self, x, y):
        color = self._pencolor if self._down else None
        _stage.emit(["go", self._id, _round(self._x), _round(self._y), _round(x), _round(y), _round(self._heading), color, self._size])
        if self._down:
            _stage.ink([(self._x, self._y), (x, y)], self._pencolor)
        if self._fill is not None:
            self._fill["points"].append((x, y))
            if self._down:
                self._fill["lines"].append([_round(self._x), _round(self._y), _round(x), _round(y), self._pencolor, self._size])
        self._x, self._y = x, y

    def _pose(self):
        _stage.emit(["pose", self._id, _round(self._x), _round(self._y), _round(self._heading)])

    def forward(self, distance):
        rad = math.radians(self._heading)
        self._go(self._x + math.cos(rad) * distance, self._y + math.sin(rad) * distance)

    def backward(self, distance):
        self.forward(-distance)

    def left(self, angle):
        self._heading = (self._heading + angle) % 360
        self._pose()

    def right(self, angle):
        self.left(-angle)

    def goto(self, x, y=None):
        if y is None:
            x, y = x
        self._go(float(x), float(y))

    def setx(self, x):
        self._go(float(x), self._y)

    def sety(self, y):
        self._go(self._x, float(y))

    def setheading(self, angle):
        self._heading = angle % 360
        self._pose()

    def home(self):
        self._go(0.0, 0.0)
        self.setheading(0)

    def teleport(self, x=None, y=None, *, fill_gap=False):
        was_down, self._down = self._down, False
        self._go(self._x if x is None else float(x), self._y if y is None else float(y))
        self._down = was_down

    def circle(self, radius, extent=None, steps=None):
        if extent is None:
            extent = 360
        if steps is None:
            steps = 1 + int(min(11 + abs(radius) / 6.0, 59.0) * abs(extent) / 360)
        step_angle = extent / steps
        half = step_angle / 2
        length = 2 * radius * math.sin(math.radians(half))
        if radius < 0:
            length, step_angle, half = -length, -step_angle, -half
        self._heading = (self._heading + half) % 360
        for _ in range(steps):
            self.forward(length)
            self._heading = (self._heading + step_angle) % 360
        self._heading = (self._heading - half) % 360
        self._pose()

    def dot(self, size=None, *color):
        radius = (size if size is not None else max(self._size + 4, self._size * 2)) / 2
        fill = _color(*color) if color else self._pencolor
        _stage.emit(["dot", _round(self._x), _round(self._y), _round(radius), fill])
        _stage.ink([(self._x, self._y)], fill, radius)

    def stamp(self):
        _stage.emit(["stamp", _round(self._x), _round(self._y), _round(self._heading), self._pencolor])
        _stage.ink([(self._x, self._y)], self._pencolor, 8)

    def write(self, arg, move=False, align="left", font=("Arial", 12, "normal")):
        size = font[1] if isinstance(font, (tuple, list)) and len(font) > 1 else 12
        _stage.emit(["text", _round(self._x), _round(self._y), str(arg), self._pencolor, size, align])
        _stage.ink([(self._x, self._y)], self._pencolor, size)

    # --- pen ---
    def penup(self):
        self._down = False

    def pendown(self):
        self._down = True

    def isdown(self):
        return self._down

    def pensize(self, width=None):
        if width is None:
            return self._size
        self._size = max(1, float(width))

    def pencolor(self, *args):
        if not args:
            return self._pencolor
        self._pencolor = _color(*args)
        _stage.emit(["ink", self._id, self._pencolor])

    def fillcolor(self, *args):
        if not args:
            return self._fillcolor
        self._fillcolor = _color(*args)

    def color(self, *args):
        if not args:
            return self._pencolor, self._fillcolor
        if len(args) == 2:
            self.pencolor(args[0]); self.fillcolor(args[1])
        else:
            self.pencolor(*args); self.fillcolor(*args)

    def begin_fill(self):
        self._fill = {"points": [(self._x, self._y)], "lines": []}

    def end_fill(self):
        fill, self._fill = self._fill, None
        if fill and len(fill["points"]) > 2:
            _stage.emit(["fill", [[_round(x), _round(y)] for x, y in fill["points"]], self._fillcolor, fill["lines"]])
            _stage.ink(fill["points"], self._fillcolor)

    def filling(self):
        return self._fill is not None

    # --- the turtle itself ---
    def hideturtle(self):
        self._visible = False
        _stage.emit(["show", self._id, False])

    def showturtle(self):
        self._visible = True
        _stage.emit(["show", self._id, True])

    def isvisible(self):
        return self._visible

    def speed(self, speed=None):
        if speed is None:
            return self._speed
        names = {"fastest": 0, "fast": 10, "normal": 6, "slow": 3, "slowest": 1}
        speed = names.get(speed, speed) if isinstance(speed, str) else speed
        self._speed = 0 if speed > 10 or speed < 0.5 else int(round(speed))
        _stage.emit(["speed", self._speed])

    def clear(self):
        _stage.emit(["clear"])
        _stage.strokes, _stage.bounds, _stage.colors = 0, None, []

    def reset(self):
        self.clear()
        self._x = self._y = self._heading = 0.0
        self._down, self._pencolor, self._fillcolor, self._size, self._visible = True, "black", "black", 1, True
        _stage.emit(["ink", self._id, "black"])
        _stage.emit(["show", self._id, True])
        self._pose()

    # --- asking where it is ---
    def position(self):
        return (_round(self._x), _round(self._y))

    def xcor(self):
        return _round(self._x)

    def ycor(self):
        return _round(self._y)

    def heading(self):
        return _round(self._heading)

    def distance(self, x, y=None):
        if y is None:
            x, y = x.position() if isinstance(x, Turtle) else x
        return math.hypot(x - self._x, y - self._y)

    def towards(self, x, y=None):
        if y is None:
            x, y = x.position() if isinstance(x, Turtle) else x
        return math.degrees(math.atan2(y - self._y, x - self._x)) % 360

    # --- accepted so ordinary turtle programs run unchanged ---
    def shape(self, name=None):
        return "classic"

    def shapesize(self, *args, **kwargs):
        return None

    def getscreen(self):
        return Screen()

    fd = forward
    bk = back = backward
    lt = left
    rt = right
    setpos = setposition = goto
    seth = setheading
    pu = up = penup
    pd = down = pendown
    width = pensize
    ht = hideturtle
    st = showturtle
    pos = position
    turtlesize = shapesize


class _Screen:
    def bgcolor(self, *args):
        if args:
            _stage.emit(["bg", _color(*args)])

    def colormode(self, mode=None):
        if mode is None:
            return _stage.colormode
        if mode not in (1, 1.0, 255):
            raise ValueError("colormode must be 1.0 or 255")
        _stage.colormode = 255 if mode == 255 else 1.0

    def clear(self):
        _stage.emit(["clear"])

    clearscreen = reset = resetscreen = clear

    def _nothing(self, *args, **kwargs):
        return None

    setup = title = tracer = update = mainloop = exitonclick = bye = delay = screensize = listen = _nothing
    onkey = onkeypress = onkeyrelease = onclick = onscreenclick = ontimer = _nothing

    def window_width(self):
        return 640

    def window_height(self):
        return 640


_screen = _Screen()


def Screen():
    return _screen


def _first():
    """The turtle that the module-level functions move."""
    return _stage.turtles[0] if _stage.turtles else Turtle()


def _module():
    module = types.ModuleType("turtle")
    module.Turtle = module.Pen = module.RawTurtle = Turtle
    module.Screen = Screen
    module.getturtle = module.getpen = _first
    names = [name for name in vars(Turtle) if not name.startswith("_")]
    for name in names:
        def call(*args, _name=name, **kwargs):
            return getattr(_first(), _name)(*args, **kwargs)
        call.__name__ = name
        setattr(module, name, call)
    for name in ("bgcolor", "colormode", "setup", "title", "tracer", "update", "mainloop", "exitonclick", "bye", "delay", "screensize", "clearscreen", "resetscreen", "window_width", "window_height", "listen", "onkey", "onkeypress", "onclick", "onscreenclick", "ontimer"):
        setattr(module, name, getattr(_screen, name))
    module.done = _screen.mainloop
    module.__all__ = [name for name in vars(module) if not name.startswith("_")]
    return module


sys.modules["turtle"] = _module()


class _Output:
    """Printed text goes to the page as it is written."""

    def write(self, text):
        text = str(text)
        room = MAX_OUTPUT - _stage.output
        if room > 0 and text and _send_output is not None:
            _send_output(text[:room])
        _stage.output += len(text)
        return len(text)

    def flush(self):
        pass

    def isatty(self):
        return False


def _no_input(prompt=""):
    raise RuntimeError("input() is not available here yet. Put the value in a variable instead, like name = 'Ada'.")


def _sleep(seconds):
    # Pause the drawing rather than the program, so animations play at the right pace.
    _stage.emit(["wait", max(0, min(float(seconds), 10)) * 1000])


_namespace = {}


def _problem(error):
    """Describe an exception the way a beginner needs it: what, and on which line."""
    if isinstance(error, SyntaxError):
        line = error.lineno if error.filename == PROGRAM else None
        return {"message": f"SyntaxError: {error.msg}", **({"line": line} if line else {})}
    line = None
    for frame in traceback.extract_tb(error.__traceback__):
        if frame.filename == PROGRAM:
            line = frame.lineno
    text = str(error)
    if isinstance(error, RecursionError):
        text = "a function kept calling itself and never stopped"
    message = f"{type(error).__name__}: {text}" if text else type(error).__name__
    return {"message": message[:400], **({"line": line} if line else {})}


def _report(errors):
    turtle = _stage.turtles[0] if _stage.turtles else None
    b = _stage.bounds
    return json.dumps({
        "ok": not errors,
        "errors": errors,
        "turtle": {"x": _round(turtle._x), "y": _round(turtle._y), "heading": _round(turtle._heading)} if turtle else None,
        "drawing": {
            "strokes": _stage.strokes,
            "bounds": {"left": _round(b[0]), "right": _round(b[1]), "bottom": _round(b[2]), "top": _round(b[3])} if b else None,
            "colors": list(_stage.colors),
        },
    })


def _execute(source, mode):
    errors = []
    sys.stdout = sys.stderr = _Output()
    builtins.input = _no_input
    time.sleep = _sleep
    try:
        if mode == "line":
            try:
                value = eval(compile(source, PROGRAM, "eval"), _namespace)
                if value is not None:
                    print(repr(value))
            except SyntaxError:
                exec(compile(source, PROGRAM, "exec"), _namespace)
        else:
            exec(compile(source, PROGRAM, "exec"), _namespace)
    except SystemExit:
        pass
    except BaseException as error:  # the student's program may raise anything
        errors.append(_problem(error))
    try:
        _stage.flush()
    except BaseException as error:
        errors.append(_problem(error))
    return _report(errors)


def _run(source):
    """Run a whole program from a clean slate."""
    global _namespace
    _stage.reset()
    sys.modules["turtle"] = _module()
    _namespace = {"__name__": "__main__"}
    _stage.emit(["reset"])
    return _execute(source, "program")


def _line(source):
    """Run one command-line entry, keeping what the last program defined and drew."""
    return _execute(source, "line")
