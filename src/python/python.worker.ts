import shim from './turtle_shim.py?raw'
import { createRuntime, type PythonRuntime } from './runtime'

// Python runs here, off the page's main thread, so a program that never ends cannot freeze
// the page: the page stops it by ending this worker and starting a fresh one.
export type WorkerRequest = { id: number; kind: 'run' | 'line'; code: string }
export type WorkerMessage =
  | { type: 'ready' }
  | { type: 'failed'; message: string }
  | { type: 'output'; id: number; text: string }
  | { type: 'commands'; id: number; commands: unknown[] }
  | { type: 'done'; id: number; report: unknown }

const post = (message: WorkerMessage) => (self as unknown as Worker).postMessage(message)
let runtime: PythonRuntime | undefined

async function start(base: string) {
  try {
    // Pyodide is served from this site (see scripts/prepare-assets.mjs), not from a CDN.
    const { loadPyodide } = await import(/* @vite-ignore */ `${base}pyodide.mjs`)
    runtime = createRuntime(await loadPyodide({ indexURL: base }), shim)
    post({ type: 'ready' })
  } catch (error) {
    post({ type: 'failed', message: error instanceof Error ? error.message : String(error) })
  }
}

self.onmessage = (event: MessageEvent<{ start: string } | WorkerRequest>) => {
  if ('start' in event.data) { void start(event.data.start); return }
  const { id, kind, code } = event.data
  if (!runtime) return
  const report = runtime[kind](code, {
    onOutput: text => post({ type: 'output', id, text }),
    onCommands: commands => post({ type: 'commands', id, commands }),
  })
  post({ type: 'done', id, report })
}
