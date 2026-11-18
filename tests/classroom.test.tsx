import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { forwardRef, useEffect, useImperativeHandle } from 'react'
import App from '../src/App'
import type { RunReport } from '../src/python/runtime'
import type { TeacherHandlers } from '../src/teacher/useTeacher'

// The page around a stubbed Pip and a stubbed Python: what the classroom does when the
// teacher's tools fire, and what it tells the teacher about the student's work.
const state = vi.hoisted(() => ({ code: 'print(111)', handlers: null as any, sent: [] as string[], ran: [] as string[], marked: [] as unknown[] }))
vi.mock('../src/components/Editor', () => ({
  Editor: forwardRef(function MockEditor(_props, ref) {
    useImperativeHandle(ref, () => ({ getValue: () => state.code, setValue: (code: string) => { state.code = code }, clearErrors() {}, showError: (...args: unknown[]) => { state.marked.push(args) } }))
    return <div>Code editor</div>
  }),
}))
vi.mock('../src/components/TurtleCanvas', () => ({
  TurtleCanvas: ({ onReady }: { onReady: (canvas: HTMLCanvasElement) => void }) => {
    useEffect(() => { onReady(document.createElement('canvas')) }, [onReady])
    return null
  },
}))
vi.mock('../src/python/client', () => ({
  PythonClient: class {
    busy = false
    warm() { return Promise.resolve() }
    stop() {}
    line() { return this.run('') }
    async run(code: string, handlers: { onOutput?: (text: string) => void } = {}): Promise<RunReport> {
      state.ran.push(code)
      const base = { turtle: { x: 0, y: 0, heading: 0 }, drawing: { strokes: 0, bounds: null, colors: [] } }
      if (code.includes('forwrd')) return { ...base, ok: false, output: '', errors: [{ message: "AttributeError: module 'turtle' has no attribute 'forwrd'", line: 2 }] }
      const printed = /print\((\d+)\)/.exec(code)?.[1] ?? ''
      if (printed) handlers.onOutput?.(`${printed}\n`)
      return { ...base, ok: true, output: printed, errors: [] }
    }
  },
}))
vi.mock('../src/teacher/useTeacher', async original => ({
  ...await original<typeof import('../src/teacher/useTeacher')>(),
  useTeacher: (handlers: TeacherHandlers) => {
    state.handlers = handlers
    return { messages: [], drawings: new Map(), working: false, resuming: false, failure: null, send: async (text: string) => { state.sent.push(text) }, stop: async () => {}, newChat() {} }
  },
}))

beforeEach(() => { localStorage.clear(); localStorage.setItem('python-teacher.consent.v1', 'yes'); Object.assign(state, { code: 'print(111)', sent: [], ran: [], marked: [] }) })
afterEach(cleanup)
const log = () => screen.getByRole('log').textContent
const handlers = () => state.handlers as TeacherHandlers

it('runs the student’s program and tells Pip what happened', async () => {
  render(<App />)
  expect(handlers().getPage()).toMatchObject({ program: 'print(111)', lastRun: null, lesson: null, completed: [] })
  fireEvent.click(screen.getByTitle('Run (Ctrl+Enter)'))
  await waitFor(() => expect(log()).toBe('111'))
  await waitFor(() => expect(handlers().getPage().lastRun).toEqual({ by: 'student', current: true, output: '111', errors: [], stopped: false }))
  state.code = 'print(222)'
  expect(handlers().getPage().lastRun).toMatchObject({ current: false })
})

it('puts Pip’s program in the code pane, runs it, hands Pip the report, and can undo it', async () => {
  render(<App />)
  let report: RunReport | undefined
  await act(async () => { report = await handlers().onProgram('print(333)') })
  expect(report).toMatchObject({ ok: true, output: '333' })
  expect(log()).toBe('333')
  expect(state.code).toBe('print(333)')
  expect(handlers().getPage().lastRun).toMatchObject({ by: 'pip', current: true })
  fireEvent.click(screen.getByRole('button', { name: 'Undo change' }))
  expect(state.code).toBe('print(111)')
  expect(screen.queryByRole('button', { name: 'Undo change' })).toBeNull()
})

it('runs Pip’s private checks without touching the code pane or the output', async () => {
  render(<App />)
  let report: RunReport | undefined
  await act(async () => { report = await handlers().onTest('print(42)') })
  expect(report).toMatchObject({ ok: true, output: '42' })
  expect(state.code).toBe('print(111)')
  expect(log()).toBe('')
  expect(handlers().getPage().lastRun).toBeNull()
})

it('does not undo over edits the student made afterwards', async () => {
  render(<App />)
  await act(async () => { await handlers().onProgram('print(333)') })
  state.code = 'print(333)\nprint(444)'
  fireEvent.click(screen.getByRole('button', { name: 'Undo change' }))
  expect(state.code).toBe('print(333)\nprint(444)')
})

it('shows an error with its line, marks it in the editor, and offers Pip’s help once', async () => {
  state.code = 'import turtle\nturtle.forwrd(50)'
  render(<App />)
  expect(screen.queryByText('Ask Pip')).toBeNull()
  fireEvent.click(screen.getByTitle('Run (Ctrl+Enter)'))
  await waitFor(() => expect(log()).toContain("has no attribute 'forwrd' (line 2)"))
  expect(state.marked[0]).toEqual(["AttributeError: module 'turtle' has no attribute 'forwrd'", { line: 2, col: 1 }])
  fireEvent.click(await screen.findByRole('button', { name: /Your program stopped.*Ask Pip/ }))
  expect(state.sent[0]).toContain("has no attribute 'forwrd' (line 2)")
  expect(handlers().getPage().lastRun).toMatchObject({ by: 'student', errors: ["AttributeError: module 'turtle' has no attribute 'forwrd' (line 2)"] })
})

it('records a finished lesson and reports it back to Pip', async () => {
  render(<App />)
  act(() => handlers().onLessonComplete('meet-the-turtle'))
  await waitFor(() => expect(screen.getByRole('button', { name: /Lessons/ })).toHaveTextContent('1/8'))
  expect(handlers().getPage().completed).toEqual(['meet-the-turtle'])
})
