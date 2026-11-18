import { defineWorkflowTool } from 'eve/tools'
import { z } from 'zod'
import { MAX_PROGRAM_CHARS, readRunReport } from '../lib/run-report'

export default defineWorkflowTool({
  description: "Replace the program in the student's code pane with a complete Python program and run it, so they watch it draw. Returns what the run did in their browser: printed output, errors with line numbers, the turtle's final position, and the size and colors of the drawing. If it reports errors, fix the program and call this again.",
  inputSchema: z.object({
    code: z.string().min(1).max(MAX_PROGRAM_CHARS).describe('The complete Python source. No Markdown fences.'),
  }),
  label: { start: () => 'Writing a program' },
  async execute(_input, ctx) {
    'use workflow'
    // Python lives in the student's browser. The page sees this call, puts the program in the
    // code pane, runs it, and answers this question with the run report. No person types it.
    const answer = await ctx.ask({ prompt: 'Running the program in the code pane.', display: 'text' })
    return readRunReport(answer)
  },
})
