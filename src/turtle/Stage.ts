import type { DrawCommand } from '../python/runtime'

export interface TurtlePose { x: number; y: number; heading: number; color: string; visible: boolean }

interface Marker extends TurtlePose { id: number }
type Line = [x1: number, y1: number, x2: number, y2: number, color: string, width: number]

/** Turtle steps drawn per animation frame at each turtle.speed() setting; 0 means "at once". */
const STEPS_PER_FRAME = [Infinity, 2, 4, 6, 9, 12, 16, 22, 30, 42, 60]

/**
 * Draws what the Python turtle module asks for, and plays it back at the turtle's speed so
 * the student watches the picture being made. The program itself has usually finished by
 * the time the turtle starts walking: Python computes the commands, this plays them.
 */
export class Stage {
  private readonly ctx: CanvasRenderingContext2D
  private readonly ink: HTMLCanvasElement
  private readonly inkCtx: CanvasRenderingContext2D
  private queue: DrawCommand[] = []
  private markers = new Map<number, Marker>()
  private background = '#ffffff'
  private speed = 6
  private frame = 0
  private progress = 0 // how far along the command at the head of the queue the turtle is
  private waitUntil = 0
  private idle: Array<() => void> = []
  private readonly canvas: HTMLCanvasElement
  private readonly onPose: ((pose: TurtlePose | null) => void) | undefined

  constructor(canvas: HTMLCanvasElement, onPose?: (pose: TurtlePose | null) => void) {
    this.canvas = canvas
    this.onPose = onPose
    this.ctx = canvas.getContext('2d')!
    this.ink = document.createElement('canvas')
    this.ink.width = canvas.width
    this.ink.height = canvas.height
    this.inkCtx = this.ink.getContext('2d')!
    this.reset()
  }

  /** Back to a blank page with one turtle at home. */
  reset(): void {
    this.queue = []
    this.progress = 0
    this.waitUntil = 0
    this.speed = 6
    this.background = '#ffffff'
    this.markers = new Map([[0, { id: 0, x: 0, y: 0, heading: 0, color: 'black', visible: true }]])
    this.inkCtx.clearRect(0, 0, this.ink.width, this.ink.height)
    this.render()
    this.settle()
  }

  /** Add commands to play. */
  enqueue(commands: DrawCommand[]): void {
    for (const command of commands) this.queue.push(command)
    if (!this.frame && this.queue.length) this.frame = requestAnimationFrame(this.tick)
  }

  /** Draw everything still waiting, now. */
  finish(): void {
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.waitUntil = 0
    while (this.queue.length) this.apply(this.queue.shift()!, 1)
    this.progress = 0
    this.render()
    this.settle()
  }

  /** Throw away what has not been drawn yet and leave the picture as it stands. */
  halt(): void {
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.queue = []
    this.progress = 0
    this.waitUntil = 0
    this.render()
    this.settle()
  }

  /** Resolves when the queue has been drawn. */
  whenIdle(): Promise<void> {
    if (!this.queue.length) return Promise.resolve()
    return new Promise(resolve => { this.idle.push(resolve) })
  }

  get playing(): boolean {
    return this.queue.length > 0
  }

  private settle(): void {
    const first = this.markers.get(0)
    this.onPose?.(first ? { x: first.x, y: first.y, heading: first.heading, color: first.color, visible: first.visible } : null)
    for (const resolve of this.idle.splice(0)) resolve()
  }

  private tick = (now: number): void => {
    this.frame = 0
    if (now < this.waitUntil) { this.frame = requestAnimationFrame(this.tick); return }
    // A long drawing speeds up so it never takes minutes: the more that is waiting, the bigger each step.
    let budget = STEPS_PER_FRAME[this.speed] * (1 + this.queue.length / 150)
    let guard = 4000
    while (this.queue.length && budget > 0 && guard-- > 0) {
      const command = this.queue[0]
      if (command[0] === 'wait') {
        this.queue.shift()
        this.waitUntil = now + Number(command[1])
        break
      }
      if (command[0] === 'go') {
        const [, , x1, y1, x2, y2] = command as unknown as [string, number, number, number, number, number]
        const length = Math.hypot(x2 - x1, y2 - y1)
        const from = this.progress
        const to = length <= budget + from * length ? 1 : from + budget / length
        this.apply(command, to, from)
        budget -= (to - from) * length + 0.5
        if (to >= 1) { this.queue.shift(); this.progress = 0 } else this.progress = to
      } else {
        this.apply(this.queue.shift()!, 1)
        budget -= command[0] === 'pose' ? 0.5 : 2
      }
    }
    this.render()
    if (this.queue.length) this.frame = requestAnimationFrame(this.tick)
    else this.settle()
  }

  private screen(x: number, y: number): [number, number] {
    return [this.canvas.width / 2 + x, this.canvas.height / 2 - y]
  }

  private marker(id: number): Marker {
    let marker = this.markers.get(id)
    if (!marker) { marker = { id, x: 0, y: 0, heading: 0, color: 'black', visible: true }; this.markers.set(id, marker) }
    return marker
  }

  private stroke([x1, y1, x2, y2, color, width]: Line): void {
    const ink = this.inkCtx
    ink.strokeStyle = color
    ink.lineWidth = width
    ink.lineCap = 'round'
    ink.lineJoin = 'round'
    ink.beginPath()
    ink.moveTo(...this.screen(x1, y1))
    ink.lineTo(...this.screen(x2, y2))
    ink.stroke()
  }

  /** Carry out one command. For a move, `to` and `from` say which part of it to draw. */
  private apply(command: DrawCommand, to: number, from = 0): void {
    const ink = this.inkCtx
    switch (command[0]) {
      case 'reset':
        this.markers.clear()
        this.background = '#ffffff'
        this.speed = 6
        ink.clearRect(0, 0, this.ink.width, this.ink.height)
        break
      case 'new': this.marker(command[1] as number).visible = command[2] as boolean; break
      case 'go': {
        const [, id, x1, y1, x2, y2, heading, color, width] = command as unknown as [string, number, number, number, number, number, number, string | null, number]
        const at = (t: number): [number, number] => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]
        if (color) this.stroke([...at(from), ...at(to), color, width])
        const marker = this.marker(id)
        ;[marker.x, marker.y] = at(to)
        marker.heading = heading
        break
      }
      case 'pose': {
        const marker = this.marker(command[1] as number)
        marker.x = command[2] as number
        marker.y = command[3] as number
        marker.heading = command[4] as number
        break
      }
      case 'ink': this.marker(command[1] as number).color = command[2] as string; break
      case 'show': this.marker(command[1] as number).visible = command[2] as boolean; break
      case 'speed': this.speed = Math.max(0, Math.min(10, command[1] as number)); break
      case 'bg': this.background = command[1] as string; break
      case 'clear': ink.clearRect(0, 0, this.ink.width, this.ink.height); break
      case 'dot': {
        ink.fillStyle = command[4] as string
        ink.beginPath()
        ink.arc(...this.screen(command[1] as number, command[2] as number), command[3] as number, 0, Math.PI * 2)
        ink.fill()
        break
      }
      case 'fill': {
        const points = command[1] as Array<[number, number]>
        ink.fillStyle = command[2] as string
        ink.beginPath()
        points.forEach(([x, y], index) => (index ? ink.lineTo(...this.screen(x, y)) : ink.moveTo(...this.screen(x, y))))
        ink.closePath()
        ink.fill()
        // The outline was drawn before the fill; put it back on top.
        for (const line of command[3] as Line[]) this.stroke(line)
        break
      }
      case 'text': {
        const [, x, y, text, color, size, align] = command as unknown as [string, number, number, string, string, number, CanvasTextAlign]
        ink.fillStyle = color
        ink.font = `${size}px Arial, sans-serif`
        ink.textAlign = align
        ink.fillText(text, ...this.screen(x, y))
        break
      }
      case 'stamp': this.drawTurtle(ink, command[1] as number, command[2] as number, command[3] as number, command[4] as string); break
    }
  }

  private drawTurtle(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, color: string): void {
    const [sx, sy] = this.screen(x, y)
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate((-heading * Math.PI) / 180)
    ctx.fillStyle = color
    ctx.strokeStyle = '#1c2924'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(10, 0)
    ctx.lineTo(-6, 6)
    ctx.lineTo(-3, 0)
    ctx.lineTo(-6, -6)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  private render(): void {
    this.ctx.fillStyle = this.background
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.drawImage(this.ink, 0, 0)
    for (const marker of this.markers.values()) if (marker.visible) this.drawTurtle(this.ctx, marker.x, marker.y, marker.heading, marker.color)
  }
}
