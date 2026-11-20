import { appendFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export async function readDeploymentSha(url, secret = '', fetcher = fetch) {
  const response = await fetcher(new URL('/deployment.json', url), {
    redirect: 'manual', signal: AbortSignal.timeout(15_000),
    headers: { 'Cache-Control': 'no-cache', ...(secret ? { 'x-vercel-protection-bypass': secret } : {}) },
  })
  // Vercel Authentication answers with 401, or with a redirect to its sign-in page.
  // Either way CI cannot get in, and waiting longer will not change that.
  const signIn = response.status >= 300 && response.status < 400 && /(^|\.)vercel\.com$/.test(new URL(response.headers.get('location') ?? '', url).hostname)
  if (response.status === 401 || response.status === 403 || signIn) throw new Error('Preview protection rejected CI. Configure VERCEL_AUTOMATION_BYPASS_SECRET.')
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null
  const data = await response.json()
  return data.sha
}

// Poll the newest Vercel deployment for this exact commit. Never reuse an older success.
export async function waitForVercel({ github, owner, repo, sha, timeoutMs = 15 * 60_000,
  intervalMs = 10_000, now = Date.now, probe = readDeploymentSha, secret = '', productionUrl = '', sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log }) {
  const deadline = now() + timeoutMs
  const production = productionUrl ? new URL(productionUrl) : null
  if (production && (production.protocol !== 'https:' || !production.hostname.endsWith('.vercel.app') || production.username || production.password || production.port)) {
    throw new Error('PRODUCTION_URL must be an HTTPS vercel.app address.')
  }
  while (now() < deadline) {
    const deployments = await github.paginate(github.rest.repos.listDeployments, { owner, repo, sha, per_page: 100 })
    const deployment = deployments
      .filter(d => d.sha === sha && d.creator?.login === 'vercel[bot]')
      .sort((a, b) => b.id - a.id)[0]
    if (deployment) {
      const { data: statuses } = await github.rest.repos.listDeploymentStatuses({ owner, repo, deployment_id: deployment.id, per_page: 1 })
      const latest = statuses[0]
      if (['failure', 'error', 'inactive'].includes(latest?.state)) {
        throw new Error(`Vercel deployment ${deployment.id} for ${sha} is ${latest.state}. Fix or redeploy this commit.`)
      }
      const address = latest?.environment_url || latest?.target_url
      if (address && ['success', 'in_progress', 'pending', 'queued'].includes(latest.state)) {
        const url = new URL(address)
        if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app') || url.username || url.password || url.port) {
          throw new Error('Vercel returned an unexpected deployment URL; refusing to send automation credentials.')
        }
        // A production deployment can be built but held by Deployment Checks.
        // Check its own commit marker instead of waiting for promotion's success status.
        let deployedSha
        try { deployedSha = await probe(url.origin, secret) } catch (error) {
          if (error.message?.includes('Preview protection')) throw error
          log('Deployment URL is not reachable yet')
        }
        if (deployedSha === sha) {
          log(`Vercel deployment ${deployment.id} serves ${sha}: ${url.origin}`)
          return url.origin
        }
      }
      log(`Waiting for Vercel deployment ${deployment.id}: ${latest?.state || 'no status yet'}`)
    } else if (production) {
      // This project's Vercel integration records no deployments on GitHub, so there is nothing
      // to look up. For the production branch the public address says which commit it serves.
      let deployedSha
      try { deployedSha = await probe(production.origin, secret) } catch (error) {
        if (error.message?.includes('Preview protection')) throw error
        log('Production URL is not reachable yet')
      }
      if (deployedSha === sha) {
        log(`Production serves ${sha}: ${production.origin}`)
        return production.origin
      }
      log(`Waiting for production to serve ${sha}; it serves ${deployedSha ?? 'nothing yet'}`)
    } else log(`Waiting for Vercel to create a deployment for ${sha}`)
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())))
  }
  throw new Error(`No ready Vercel deployment for ${sha} within ${timeoutMs / 60_000} minutes. Check the Git integration, build logs, or approval for fork deployments.`)
}

// The read-only Actions token discovers deployments; the optional bypass only reaches their origin.
export async function run({ github, context, core }) {
  const sha = context.payload.pull_request?.head.sha || context.sha
  // Only a build of the production branch ends up at the production address.
  const onProductionBranch = !context.payload.pull_request && context.ref === `refs/heads/${context.payload.repository?.default_branch ?? 'main'}`
  const productionUrl = onProductionBranch ? process.env.PRODUCTION_URL ?? '' : ''
  const preview = await waitForVercel({ github, ...context.repo, sha, log: core.info, secret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET, productionUrl })
  core.setOutput('preview', preview)
  await core.summary.addRaw(`Deployed tests will use commit ${sha}: ${preview}`).write()
}

// Expose a standalone poller for local verification with a GitHub token.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, DEPLOYMENT_SHA, GITHUB_OUTPUT } = process.env
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !DEPLOYMENT_SHA) throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY and DEPLOYMENT_SHA are required')
  const [owner, repo] = GITHUB_REPOSITORY.split('/')
  async function get(path) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/${path}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`GitHub API returned HTTP ${response.status}`)
    return response.json()
  }
  const github = { rest: { repos: { listDeployments: null, listDeploymentStatuses: async ({ deployment_id }) => ({ data: await get(`deployments/${deployment_id}/statuses?per_page=1`) }) } },
    paginate: async () => {
      const all = []
      for (let page = 1; ; page++) {
        const batch = await get(`deployments?sha=${encodeURIComponent(DEPLOYMENT_SHA)}&per_page=100&page=${page}`)
        all.push(...batch)
        if (batch.length < 100) return all
      }
    } }
  const preview = await waitForVercel({ github, owner, repo, sha: DEPLOYMENT_SHA, secret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET })
  if (GITHUB_OUTPUT) await appendFile(GITHUB_OUTPUT, `preview=${preview}\n`)
}
