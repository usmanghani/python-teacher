import { defineWorkflowTool } from 'eve/tools'
import { z } from 'zod'
import { MAX_PROGRAM_CHARS, readRunReport } from '../lib/run-report'

export default defineWorkflowTool({
  description: "Run Python code privately in the student's browser, without changing their code pane or drawing. Use it to check a snippet before showing it, or to learn what a program does. Returns printed output, errors with line numbers, the turtle's final position, and the size and colors of the drawing.",
  inputSchema: z.object({
    code: z.string().min(1).max(MAX_PROGRAM_CHARS).describe('Python source to run. No Markdown fences.'),
  }),
  label: { start: () => 'Checking some code' },
  async execute(_input, ctx) {
    'use workflow'
    // Answered by the student's page, which runs the code out of sight. See write_program.
    const answer = await ctx.ask({ prompt: 'Checking some code.', display: 'text' })
    return readRunReport(answer)
  },
})
