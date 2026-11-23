import { dependencies } from '../../package.json'
import type { WorkerMessage, WorkerRequest } from './python.worker'
import { stoppedReport, type DrawCommand, type RunHandlers, type RunReport } from './runtime'

export const PYODIDE_BASE = `/pyodide/${dependencies.pyodide.replace(/^[^\d]*/, '')}/`
/** How long a program may compute before it is stopped. Drawing plays back afterwards, at its own pace. */
export const RUN_LIMIT_MS = 8000

interface Job extends RunHandlers {
  request: WorkerRequest
  resolve: (report: RunReport) => void
  timer?: ReturnType<typeof setTimeout>
}

/**
 * The page's handle on Python. One worker runs one program at a time; a program that runs
 * too long, or that the student stops, is ended by replacing the worker.
 */
export class PythonClient {
  private worker: Worker | undefined
  private ready: Promise<void> | undefined
  private queue: Job[] = []
  private active: Job | undefined
  private nextId = 1
  private readonly createWorker: () => Worker

  constructor(createWorker: () => Worker = () => new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })) {
    this.createWorker = createWorker
  }

  /** Start loading Python now, so the first Run does not wait for it. */
  warm(): Promise<void> {
    if (this.ready) return this.ready
    const worker = this.createWorker()
    this.worker = worker
    this.ready = new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data
        if (message.type === 'ready') resolve()
        else if (message.type === 'failed') reject(new Error(message.message))
        else this.receive(message)
      }
      worker.onerror = () => reject(new Error('Python could not start.'))
    })
    worker.postMessage({ start: PYODIDE_BASE })
    return this.ready
  }

  run(code: string, handlers: RunHandlers = {}): Promise<RunReport> {
    return this.enqueue('run', code, handlers)
  }

  line(code: string, handlers: RunHandlers = {}): Promise<RunReport> {
    return this.enqueue('line', code, handlers)
  }

  /** End whatever is running or waiting. Each one resolves with a report saying it was stopped. */
  stop(message = 'Stopped.'): void {
    const stopped = [this.active, ...this.queue].filter((job): job is Job => job !== undefined)
    this.active = undefined
    this.queue = []
    if (stopped.length || !this.worker) this.restart()
    for (const job of stopped) { clearTimeout(job.timer); job.resolve(stoppedReport(message)) }
  }

  get busy(): boolean {
    return this.active !== undefined
  }

  /**
   * Whether a whole program is running or waiting to run. Command-line entries do not count:
   * they are short, and a new one simply waits its turn behind them.
   */
  get runningProgram(): boolean {
    return [this.active, ...this.queue].some(job => job?.request.kind === 'run')
  }

  private enqueue(kind: 'run' | 'line', code: string, handlers: RunHandlers): Promise<RunReport> {
    return new Promise(resolve => {
      this.queue.push({ ...handlers, request: { id: this.nextId++, kind, code }, resolve })
      void this.pump()
    })
  }

  private async pump(): Promise<void> {
    if (this.active || !this.queue.length) return
    const job = this.queue.shift()!
    this.active = job
    try {
      await this.warm()
    } catch {
      if (this.active === job) {
        this.active = undefined
        this.ready = undefined
        job.resolve(stoppedReport('Python could not start in this browser. Reload the page and try again.'))
        void this.pump()
      }
      return
    }
    if (this.active !== job) return // stopped while Python was loading
    job.timer = setTimeout(() => {
      if (this.active !== job) return
      this.active = undefined
      this.restart()
      job.resolve(stoppedReport('The program ran too long and was stopped. Look for a loop that never ends.'))
      void this.pump()
    }, RUN_LIMIT_MS)
    this.worker!.postMessage(job.request)
  }

  private receive(message: Exclude<WorkerMessage, { type: 'ready' | 'failed' }>): void {
    const job = this.active
    if (!job || job.request.id !== message.id) return
    if (message.type === 'output') job.onOutput?.(message.text)
    else if (message.type === 'commands') job.onCommands?.(message.commands as DrawCommand[])
    else {
      clearTimeout(job.timer)
      this.active = undefined
      job.resolve(message.report as RunReport)
      void this.pump()
    }
  }

  private restart(): void {
    this.worker?.terminate()
    this.worker = undefined
    this.ready = undefined
    void this.warm().catch(() => { /* reported on the next run */ })
  }
}
