import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PythonClient, RUN_LIMIT_MS } from '../src/python/client'
import type { RunReport } from '../src/python/runtime'

// The page's side of Python, against a stand-in worker we can make slow, silent or broken.
const report = (output: string): RunReport => ({ ok: true, output, errors: [], turtle: null, drawing: { strokes: 0, bounds: null, colors: [] } })

class FakeWorker {
  static made: FakeWorker[] = []
  static failStart = false
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  terminated = false
  requests: Array<{ id: number; kind: string; code: string }> = []
  constructor() { FakeWorker.made.push(this) }
  postMessage(message: any) {
    if ('start' in message) {
      queueMicrotask(() => this.onmessage?.({ data: FakeWorker.failStart ? { type: 'failed', message: 'no wasm' } : { type: 'ready' } }))
      return
    }
    this.requests.push(message)
    if (message.code === 'forever') return // never answers
    queueMicrotask(() => {
      if (this.terminated) return
      this.onmessage?.({ data: { type: 'output', id: message.id, text: `out:${message.code}` } })
      this.onmessage?.({ data: { type: 'commands', id: message.id, commands: [['reset']] } })
      this.onmessage?.({ data: { type: 'done', id: message.id, report: report(message.code) } })
    })
  }
  terminate() { this.terminated = true }
}

beforeEach(() => { FakeWorker.made = []; FakeWorker.failStart = false; vi.useFakeTimers() })
afterEach(() => vi.useRealTimers())
const client = () => new PythonClient(() => new FakeWorker() as unknown as Worker)

describe('the Python client', () => {
  it('runs a program and passes on what it prints and draws', async () => {
    const python = client()
    const printed: string[] = []
    const drawn: unknown[] = []
    const result = await python.run('print(1)', { onOutput: text => printed.push(text), onCommands: commands => drawn.push(...commands) })
    expect(result.output).toBe('print(1)')
    expect(printed).toEqual(['out:print(1)'])
    expect(drawn).toEqual([['reset']])
    expect(FakeWorker.made).toHaveLength(1)
  })
  it('runs programs one at a time, in order, on one worker', async () => {
    const python = client()
    const results = await Promise.all([python.run('a'), python.line('b'), python.run('c')])
    expect(results.map(result => result.output)).toEqual(['a', 'b', 'c'])
    expect(FakeWorker.made[0].requests.map(request => request.kind)).toEqual(['run', 'line', 'run'])
  })
  it('says a program is running, but not a command-line entry, so entries can queue', async () => {
    const python = client()
    expect(python.runningProgram).toBe(false)
    const entries = [python.line('a'), python.line('b')]
    expect(python.busy).toBe(true)
    expect(python.runningProgram).toBe(false)
    expect((await Promise.all(entries)).map(result => result.output)).toEqual(['a', 'b'])
    const program = python.run('c')
    expect(python.runningProgram).toBe(true)
    await program
    expect(python.runningProgram).toBe(false)
    // A program waiting behind a command-line entry counts too.
    const waiting = [python.line('d'), python.run('e')]
    expect(python.runningProgram).toBe(true)
    await Promise.all(waiting)
    expect(python.runningProgram).toBe(false)
  })
  it('ends a program that never finishes by replacing the worker, and keeps working', async () => {
    const python = client()
    const stuck = python.run('forever')
    await vi.advanceTimersByTimeAsync(RUN_LIMIT_MS + 10)
    expect((await stuck).errors[0].message).toMatch(/ran too long/)
    expect(FakeWorker.made[0].terminated).toBe(true)
    expect((await python.run('after')).output).toBe('after')
    expect(FakeWorker.made).toHaveLength(2)
  })
  it('stops the running program and everything waiting behind it', async () => {
    const python = client()
    const first = python.run('forever')
    const second = python.run('queued')
    await vi.advanceTimersByTimeAsync(1)
    expect(python.busy).toBe(true)
    python.stop('Stopped.')
    expect((await first).errors).toEqual([{ message: 'Stopped.' }])
    expect((await second).errors).toEqual([{ message: 'Stopped.' }])
    expect(python.busy).toBe(false)
    expect(FakeWorker.made[0].terminated).toBe(true)
  })
  it('reports clearly when Python cannot start, and tries again next time', async () => {
    FakeWorker.failStart = true
    const python = client()
    expect((await python.run('x')).errors[0].message).toMatch(/could not start/)
    FakeWorker.failStart = false
    expect((await python.run('y')).output).toBe('y')
  })
})
