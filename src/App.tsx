import { useCallback, useEffect, useRef, useState } from 'react'
import { Editor, type EditorHandle } from './components/Editor'
import { ProgramsDialog, SignInDialog } from './account/AccountDialogs'
import { useAccount } from './account/useAccount'
import { usePrograms } from './account/usePrograms'
import { ExamplesMenu, type LoadableProgram } from './components/ExamplesMenu'
import { HelpPanel } from './components/HelpPanel'
import { REPL } from './components/REPL'
import { StatusBar } from './components/StatusBar'
import { TurtleCanvas } from './components/TurtleCanvas'
import { PythonClient } from './python/client'
import type { RunReport } from './python/runtime'
import type { Lesson } from './teacher/lessons'
import { useConsent, useProgress } from './teacher/progress'
import { PipFace, TeacherPanel } from './teacher/TeacherPanel'
import { useTeacher, type PageSnapshot } from './teacher/useTeacher'
import { Stage, type TurtlePose } from './turtle/Stage'
import './styles/global.css'

type Pane = 'teacher' | 'code' | 'drawing'
interface RunRecord { by: 'student' | 'pip'; code: string; output: string; errors: string[]; stopped: boolean }

const STOPPED = 'Stopped.'
const describe = (error: { message: string; line?: number }) => (error.line ? `${error.message} (line ${error.line})` : error.message)

export default function App() {
  const [output, setOutput] = useState('')
  const [pose, setPose] = useState<TurtlePose | null>(null)
  const [pythonState, setPythonState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [showHelp, setShowHelp] = useState(false)
  const [pane, setPane] = useState<Pane>('teacher')
  const [lesson, setLesson] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<RunRecord | null>(null)
  const [checkpoint, setCheckpoint] = useState<{ before: string; after: string } | null>(null)
  const [askedAbout, setAskedAbout] = useState<RunRecord | null>(null)
  const account = useAccount()
  const programs = usePrograms(account.user)
  const [dialog, setDialog] = useState<'programs' | 'sign-in' | null>(null)
  const { completed, complete } = useProgress(account.user)
  const { consent, accept } = useConsent()

  const pythonRef = useRef<PythonClient | null>(null)
  const stageRef = useRef<Stage | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const editorRef = useRef<EditorHandle | null>(null)
  const lastRunRef = useRef<RunRecord | null>(null)
  const runCount = useRef(0)

  const python = useCallback(() => (pythonRef.current ??= new PythonClient()), [])

  // Load Python as soon as the page opens, so the first Run does not wait for it.
  useEffect(() => {
    let current = true
    python().warm().then(() => { if (current) setPythonState('ready') }, () => { if (current) setPythonState('failed') })
    return () => { current = false; pythonRef.current?.stop() }
  }, [python])

  const onCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    if (stageRef.current && canvasRef.current === canvas) return
    canvasRef.current = canvas
    stageRef.current = new Stage(canvas, setPose)
  }, [])

  /** Run the program in the code pane from a clean slate, and watch the turtle draw it. */
  const runCode = useCallback(async (by: 'student' | 'pip' = 'student'): Promise<RunReport> => {
    const run = ++runCount.current
    const code = editorRef.current?.getValue() ?? ''
    python().stop(STOPPED) // a new run replaces whatever was running
    stageRef.current?.reset()
    setOutput('')
    editorRef.current?.clearErrors()
    const report = await python().run(code, {
      onOutput: text => { if (run === runCount.current) setOutput(previous => previous + text) },
      onCommands: commands => { if (run === runCount.current) stageRef.current?.enqueue(commands) },
    })
    const stopped = report.errors[0]?.message === STOPPED
    const errors = stopped ? [] : report.errors
    if (run === runCount.current && errors.length) {
      setOutput(previous => `${previous}${previous && !previous.endsWith('\n') ? '\n' : ''}${errors.map(describe).join('\n')}\n`)
      editorRef.current?.showError(errors[0].message, errors[0].line ? { line: errors[0].line, col: 1 } : undefined)
    }
    // A run that was stopped did not finish cleanly, and Pip must not be told it did.
    const finished: RunRecord = { by, code, output: report.output.slice(0, 2000), errors: errors.slice(0, 5).map(describe), stopped }
    lastRunRef.current = finished
    setLastRun(finished)
    return report
  }, [python])

  const stop = useCallback(() => {
    python().stop(STOPPED)
    stageRef.current?.halt()
    setOutput(previous => previous + '\n[Stopped]\n')
  }, [python])

  const clearScreen = useCallback(() => {
    runCount.current++
    python().stop(STOPPED)
    stageRef.current?.reset()
    setOutput('')
  }, [python])

  const loadExample = useCallback((example: LoadableProgram) => {
    const current = editorRef.current?.getValue() ?? ''
    if (current.trim() && current !== example.source && !window.confirm(`Replace the current program with ${example.title}? Save a copy first if you want to keep it.`)) return
    python().stop(STOPPED)
    editorRef.current?.setValue(example.source)
    editorRef.current?.clearErrors()
    setCheckpoint(null)
    setOutput(`Loaded ${example.title}. Press Run to draw it.\n`)
  }, [python])

  /** One line at the command line, in whatever the last program left behind. */
  const replSubmit = useCallback((line: string) => {
    if (python().busy) {
      setOutput(previous => previous + 'Stop the running program before using the command line.\n')
      return
    }
    setOutput(previous => `${previous}>>> ${line}\n`)
    void python().line(line, {
      onOutput: text => setOutput(previous => previous + text),
      onCommands: commands => stageRef.current?.enqueue(commands),
    }).then(report => {
      if (report.errors.length) setOutput(previous => `${previous}${report.errors.map(error => error.message).join('\n')}\n`)
    })
  }, [python])

  /** Put code in the pane and run it: Pip's write_program tool, and the "Try it" buttons. */
  const showProgram = useCallback((code: string, by: 'student' | 'pip') => {
    const before = editorRef.current?.getValue() ?? ''
    editorRef.current?.setValue(code)
    setCheckpoint(before !== code ? { before, after: code } : null)
    return runCode(by)
  }, [runCode])

  const undo = useCallback(() => {
    if (!checkpoint) return
    if (editorRef.current?.getValue() === checkpoint.after) {
      python().stop(STOPPED)
      editorRef.current?.setValue(checkpoint.before)
      editorRef.current?.clearErrors()
    }
    setCheckpoint(null)
  }, [checkpoint, python])

  const getPage = useCallback((): PageSnapshot => {
    const program = editorRef.current?.getValue() ?? ''
    const run = lastRunRef.current
    return {
      program,
      lastRun: run && { by: run.by, current: run.code === program, output: run.output, errors: run.errors, stopped: run.stopped },
      lesson,
      completed,
    }
  }, [lesson, completed])

  const teacher = useTeacher({
    getPage,
    // Pip's tools run in this page, where Python is, and the report goes back to Pip.
    onProgram: code => showProgram(code, 'pip'),
    onTest: code => python().run(code),
    onLessonComplete: complete,
  })

  // Offer Pip's help once for each failed run the student started themselves.
  const runProblem = lastRun && lastRun.by === 'student' && lastRun.errors.length && lastRun !== askedAbout ? lastRun.errors[0] : null
  useEffect(() => { if (teacher.working) setAskedAbout(lastRunRef.current) }, [teacher.working])

  return (
    <div className="app" data-pane={pane}>
      <header className="masthead">
        <div className="brand"><PipFace /><span>Python Teacher</span></div>
        <nav className="masthead-tools" aria-label="Workspace">
          <ExamplesMenu onSelect={loadExample} mine={programs.programs} />
          <button type="button" onClick={() => setShowHelp(value => !value)} title="Help">Python words</button>
          {account.available && (account.user
            ? <span className="account-chip"><strong>{account.user.name}</strong><button type="button" onClick={() => void account.signOut()}>Sign out</button></span>
            : <button type="button" onClick={() => setDialog('sign-in')}>Sign in</button>)}
        </nav>
      </header>

      <main className="classroom">
        <TeacherPanel
          teacher={teacher}
          consent={consent}
          onConsent={accept}
          completed={completed}
          lesson={lesson}
          onLesson={(picked: Lesson | null) => setLesson(picked?.id ?? null)}
          onTry={code => { void showProgram(code, 'student'); setPane('drawing') }}
          runProblem={runProblem}
        />

        <section className="canvas-area" aria-label="Your Python workspace">
          <section className="pane code-pane" aria-label="Code">
            <header className="pane-header">
              <h2>Code</h2>
              <div className="pane-actions">
                {checkpoint && <button type="button" onClick={undo}>Undo change</button>}
                <button type="button" onClick={() => setDialog('programs')}>My programs{programs.programs.length ? ` (${programs.programs.length})` : ''}</button>
              </div>
            </header>
            <div className="editor-panel"><Editor ref={editorRef} onRun={() => void runCode('student')} /></div>
          </section>

          <section className="pane drawing-pane" aria-label="Drawing">
            <header className="pane-header">
              <h2>Drawing</h2>
              <div className="pane-actions">
                <button type="button" className="run" onClick={() => void runCode('student')} title="Run (Ctrl+Enter)">▶ Run</button>
                <button type="button" onClick={stop} title="Stop">■ Stop</button>
                <button type="button" onClick={clearScreen} title="Clear Screen">Clear</button>
              </div>
            </header>
            <div className="canvas-panel"><TurtleCanvas onReady={onCanvasReady} /></div>
            <StatusBar pose={pose} python={pythonState} />
            <div className="output" role="log" aria-label="Printed output">
              {output.split('\n').map((line, index) => <div key={index}>{line}</div>)}
            </div>
            <REPL onSubmit={replSubmit} />
          </section>
        </section>
      </main>

      <nav className="pane-tabs" aria-label="Show">
        {([['teacher', 'Pip'], ['code', 'Code'], ['drawing', 'Drawing']] as const).map(([id, label]) =>
          <button key={id} type="button" aria-pressed={pane === id} onClick={() => setPane(id)}>{label}</button>)}
      </nav>

      {dialog === 'programs' && <ProgramsDialog programs={programs} account={account} getSource={() => editorRef.current?.getValue() ?? ''}
        onOpen={loadExample} onSignIn={() => setDialog('sign-in')} onClose={() => setDialog(null)} />}
      {dialog === 'sign-in' && <SignInDialog account={account} onClose={() => setDialog(null)} />}
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
    </div>
  )
}
