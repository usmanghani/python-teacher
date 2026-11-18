/** One drawing command from the turtle module. See turtle_shim.py for the full list. */
export type DrawCommand = [string, ...unknown[]]

/** What one run did, small enough to hand to the teacher. */
export interface RunReport {
  ok: boolean
  output: string
  errors: Array<{ message: string; line?: number }>
  turtle: { x: number; y: number; heading: number } | null
  drawing: { strokes: number; bounds: { left: number; right: number; bottom: number; top: number } | null; colors: string[] }
}

export interface RunHandlers {
  onOutput?: (text: string) => void
  onCommands?: (commands: DrawCommand[]) => void
}

export interface PythonRuntime {
  /** Run a whole program from a clean slate. */
  run: (code: string, handlers?: RunHandlers) => RunReport
  /** Run one command-line entry in the namespace the last program left behind. */
  line: (code: string, handlers?: RunHandlers) => RunReport
}

interface PyodideLike {
  runPython: (code: string, options?: { globals?: unknown }) => any
}

const MAX_REPORTED_OUTPUT = 4000

/** Load the turtle module and runner into a Pyodide instance. Works in a worker and in Node. */
export function createRuntime(pyodide: PyodideLike, shimSource: string): PythonRuntime {
  const module = pyodide.runPython("import sys, types\n_teacher = types.ModuleType('_teacher')\nsys.modules['_teacher'] = _teacher\n_teacher")
  pyodide.runPython(shimSource, { globals: module.__dict__ })

  const execute = (entry: '_run' | '_line', code: string, handlers: RunHandlers = {}): RunReport => {
    let output = ''
    module._send_output = (text: string) => {
      if (output.length < MAX_REPORTED_OUTPUT) output = (output + text).slice(0, MAX_REPORTED_OUTPUT)
      handlers.onOutput?.(text)
    }
    module._send_commands = (json: string) => handlers.onCommands?.(JSON.parse(json) as DrawCommand[])
    const report = JSON.parse(module[entry](code)) as Omit<RunReport, 'output'>
    return { ...report, output: output.trimEnd() }
  }
  return {
    run: (code, handlers) => execute('_run', code, handlers),
    line: (code, handlers) => execute('_line', code, handlers),
  }
}

/** The report for a run that never finished. */
export function stoppedReport(message: string): RunReport {
  return { ok: false, output: '', errors: [{ message }], turtle: null, drawing: { strokes: 0, bounds: null, colors: [] } }
}
