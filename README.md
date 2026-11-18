# Python Teacher

Learn to program by drawing. **Pip**, a turtle who teaches Python, sits beside your code and your drawing and shows you one idea at a time.

The page has three panes:

| Pane | What it is |
| --- | --- |
| **Pip** | The teacher. A conversation, an eight-lesson course, and progress that is remembered. |
| **Code** | Your Python program, in an editor that highlights Python and marks the line an error came from. |
| **Drawing** | What the turtle drew, what the program printed, and a command line for one-off lines of Python. |

It is real Python 3, running in your browser, with a `turtle` module that draws on the page. Pip can put a program in your code pane and run it while you watch, check code privately before showing it, and mark a lesson complete when you have done its challenge. You can show Pip a photo of something you drew on paper, and Pip will write a program that draws it. Every code block in Pip's replies has a **Try it** button. When a program you ran stops with an error, one click asks Pip what went wrong.

Save any program as one of your own examples with **My programs**. It works without an account, in your browser; sign in and your programs and finished lessons are kept with your account and follow you to any computer.

Pip is told what is in your code pane and how your last run went with every message, so you never have to paste code into the chat.

This is the Python sibling of [Logo Teacher](https://github.com/usmanghani/ucblogo). The two share their structure; the language, the course and the way programs are run differ.

## How it is built

```
agent/                 Pip, an eve agent (https://eve.dev)
  agent.ts             model and limits
  instructions.ts      the teaching brief, built from the course
  tools/               write_program, test_program, complete_lesson
  channels/eve.ts      who may talk to Pip, and what page context reaches the model
  channels/account.ts  the account, saved-programs and progress routes
  lib/                 access check, usage quota, page-context and run-report sanitisers, prompt
server/                accounts, saved programs and progress: handlers, database, auth
                       (Better Auth on Postgres)
src/
  python/              Python in the browser: the turtle module (turtle_shim.py), the worker
                       it runs in, and the page's handle on it
  turtle/Stage.ts      draws the turtle's commands on the canvas, at the turtle's speed
  teacher/             the Pip pane: assistant-ui chat on an eve session, lessons, progress
  account/             sign-in, My programs, and syncing progress
  components/          code editor, canvas, command line, Python word reference
examples/              Python programs offered in the Examples menu
e2e/                   browser tests, with a scripted stand-in for the language model
tests/                 unit tests
vercel.ts              deploys the page and the agent as two services of one Vercel project
```

Three things are worth knowing before changing anything:

- **Python never runs on the server.** It runs in the student's browser, in a Web Worker, using [Pyodide](https://pyodide.org) served from this site. A program that never ends is stopped by replacing the worker, so it cannot freeze the page.
- **Pip's program tools are answered by the page.** When Pip calls `write_program` or `test_program`, the agent opens a question on the session and waits. The page sees the call, runs the code, and answers with a run report: printed output, errors with line numbers, where the turtle ended, and the size and colors of the drawing. The agent rebuilds that report field by field before the model sees it (`agent/lib/run-report.ts`). Pip never sees the picture.
- **The course is one file.** `src/teacher/lessons.ts` feeds both the lesson path on the page and Pip's teaching brief. Add or edit a lesson there and both follow.

The turtle module is this project's own (`src/python/turtle_shim.py`), written to behave like the standard library's for the programs beginners write. It does not open a window: each mark becomes a small drawing command that the page plays back. `input()`, keyboard and mouse events are not supported.

The chat is [assistant-ui](https://www.assistant-ui.com) primitives over eve's `useEveAgent` hook. The agent loop, streaming, session history and resuming after a reload are eve's.

## Run it

Node 24.

```bash
npm ci
```

```bash
npm run dev
```

`npm run dev` starts the page and Pip together; the Vite plugin from eve proxies `/eve/v1/*` to the agent. Python works without any setup. Pip needs a model to answer: either link the directory to your Vercel project so the agent can use AI Gateway,

```bash
npx eve link
```

or put `AI_GATEWAY_API_KEY`, or a `PIP_MODEL_BASE_URL` for any OpenAI-compatible endpoint, in `.env.local`. See `.env.example`.

## Test it

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run test:e2e
```

The unit tests run the turtle module on real CPython (Pyodide under Node), including every lesson starter and every example. The browser tests run the real page, agent, tools and Python. Only the language model is replaced, by the scripted one in `e2e/fake-model.mjs`, so they need no credentials and cost nothing.

## Deploy it

Push to a Git-connected Vercel project. `vercel.ts` builds the page with Vite and adds Pip as an eve service; Vercel Workflow keeps conversations durable, and AI Gateway serves the model using the deployment's own identity, so there is no provider key to set.

Accounts are optional and off until the project has a Postgres database and a secret: see [docs/accounts.md](docs/accounts.md).

Before the first production deploy, read [docs/pip.md](docs/pip.md): Pip is a public, anonymous endpoint that spends money, and it refuses to answer until its two usage-limit rules exist in the project's Firewall.

## More

- [docs/pip.md](docs/pip.md): how Pip works, its configuration, limits and privacy
- [docs/accounts.md](docs/accounts.md): sign-in, saved programs, progress, and how to turn accounts on
- [docs/ci.md](docs/ci.md): tests and release checks
