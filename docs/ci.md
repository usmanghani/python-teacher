# Tests and checks

Every push and pull request runs CI (`.github/workflows/ci.yml`):

- **Unit tests, lint, and build**: `npm run test:ci`, `npm run lint`, the page build and the agent build. The unit tests include the turtle module running on real Python.
- **Browser tests**: `npm run test:e2e` in Chromium against a local preview, with a scripted model and an in-process Postgres. No credentials are needed.
- **CI gate**: requires both.

CI does not test the Vercel deployment. To check a deployment by hand, run the live smoke against its URL:

```bash
PLAYWRIGHT_BASE_URL=https://your-preview.vercel.app npm run test:live
```

If the deployment is behind Vercel Deployment Protection, also set `VERCEL_AUTOMATION_BYPASS_SECRET`. `scripts/wait-for-vercel.mjs` is included for wiring deployment tests into CI later, as Logo Teacher does.

## Local commands

```
npm ci
npm test
npm run lint
npm run build
npm run build:agent
npx playwright install chromium
npm run test:e2e
```

Node 24 is used by CI and declared in package.json for Vercel. `npm ci` installs the committed lockfile. Monaco and Pyodide are copied from their pinned dependencies before builds and served from versioned local URLs. Browser coverage blocks public CDNs to prove the editor and Python work without them.

## Browser session

The editor saves edits in sessionStorage, scoped to this browser tab. Refresh restores source, including an intentionally empty editor, without running it. `Clear saved session` asks before clearing. Use **My programs** to keep a program.
