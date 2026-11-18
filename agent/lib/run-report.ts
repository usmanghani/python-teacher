/** The most Python source one tool call may carry. */
export const MAX_PROGRAM_CHARS = 30_000

/** What the student's page says happened when it ran a program. */
export interface RunReport {
  ok: boolean
  output: string
  errors: Array<{ message: string; line?: number }>
  turtle: { x: number; y: number; heading: number } | null
  drawing: { strokes: number; bounds: { left: number; right: number; bottom: number; top: number } | null; colors: string[] }
}

const number = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : 0)
const text = (value: unknown, limit: number): string => (typeof value === 'string' ? value.slice(0, limit) : '')
const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null)

const noReport = (message: string): RunReport => ({ ok: false, output: '', errors: [{ message }], turtle: null, drawing: { strokes: 0, bounds: null, colors: [] } })

/**
 * Python runs in the student's browser, so a run's result arrives from the browser as text.
 * The browser is not trusted: rebuild the report field by field, with every value type-checked
 * and bounded, before any of it reaches the model.
 */
export function readRunReport(answer: { status: string; text?: string }): RunReport {
  if (answer.status !== 'answered') return noReport("The student's page is not open, so the program could not be run. Ask the student to run it and tell you what happened.")
  let raw: Record<string, unknown> | null = null
  try { raw = record(JSON.parse(answer.text ?? '')) } catch { /* reported below */ }
  if (!raw) return noReport('The page did not report how the run went. Ask the student to press Run and tell you what happened.')

  const errors = (Array.isArray(raw.errors) ? raw.errors : []).slice(0, 5).flatMap(item => {
    const error = record(item)
    const message = text(error?.message, 400)
    if (!message) return []
    const line = number(error?.line)
    return [{ message, ...(line >= 1 ? { line: Math.floor(line) } : {}) }]
  })
  const turtle = record(raw.turtle)
  const drawing = record(raw.drawing)
  const bounds = record(drawing?.bounds)
  return {
    ok: errors.length === 0,
    output: text(raw.output, 4000),
    errors,
    turtle: turtle && { x: number(turtle.x), y: number(turtle.y), heading: number(turtle.heading) },
    drawing: {
      strokes: Math.max(0, Math.floor(number(drawing?.strokes))),
      bounds: bounds && { left: number(bounds.left), right: number(bounds.right), bottom: number(bounds.bottom), top: number(bounds.top) },
      colors: (Array.isArray(drawing?.colors) ? drawing.colors : []).slice(0, 12).map(color => text(color, 30)).filter(Boolean),
    },
  }
}
