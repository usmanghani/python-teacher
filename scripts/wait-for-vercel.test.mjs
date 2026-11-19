import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readDeploymentSha, waitForVercel } from './wait-for-vercel.mjs'

function scenario(frames) {
  let frame = 0, time = 0
  const github = { rest: { repos: { listDeployments: null, listDeploymentStatuses: async ({ deployment_id }) => ({ data: frames[frame].statuses[deployment_id] || [] }) } },
    paginate: async () => frames[frame].deployments }
  return { github, owner: 'owner', repo: 'repo', sha: 'exact', probe: async () => 'exact', intervalMs: 10, timeoutMs: 30, log() {}, now: () => time,
    sleep: async ms => { time += ms; frame = Math.min(frame + 1, frames.length - 1) } }
}
const deployment = (id, sha = 'exact', creator = 'vercel[bot]') => ({ id, sha, creator: { login: creator } })
const ready = { state: 'success', environment_url: 'https://python-teacher-preview.vercel.app' }

test('waits through absent, queued and building deployments, then returns the exact commit', async () => {
  const options = scenario([
    { deployments: [deployment(99, 'old')], statuses: { 99: [ready] } },
    { deployments: [deployment(100)], statuses: { 100: [{ state: 'queued' }] } },
    { deployments: [deployment(100)], statuses: { 100: [{ state: 'in_progress' }] } },
    { deployments: [deployment(100)], statuses: { 100: [ready] } },
  ])
  options.timeoutMs = 40
  assert.equal(await waitForVercel(options), ready.environment_url)
})
test('does not fall back to an older successful deployment when a redeploy fails', async () => {
  await assert.rejects(waitForVercel(scenario([{ deployments: [deployment(1), deployment(2)], statuses: { 1: [ready], 2: [{ state: 'failure' }] } }])), /is failure/)
})
test('times out when Vercel never creates a deployment instead of passing', async () => {
  await assert.rejects(waitForVercel(scenario([{ deployments: [], statuses: {} }])), /No ready Vercel deployment/)
})
test('ignores deployments created by other actors', async () => {
  await assert.rejects(waitForVercel(scenario([{ deployments: [deployment(1, 'exact', 'attacker')], statuses: { 1: [ready] } }])), /No ready Vercel deployment/)
})
for (const address of ['http://preview.vercel.app', 'https://preview.vercel.app.attacker.test', 'https://user:pass@preview.vercel.app', 'https://preview.vercel.app:8443']) {
  test(`rejects unsafe deployment URL ${address}`, async () => {
    await assert.rejects(waitForVercel(scenario([{ deployments: [deployment(1)], statuses: { 1: [{ state: 'success', environment_url: address }] } }])), /unexpected deployment URL/)
  })
}

test('tests a built production candidate before promotion, avoiding a Deployment Checks deadlock', async () => {
  const options = scenario([{ deployments: [deployment(1)], statuses: { 1: [{ ...ready, state: 'in_progress' }] } }])
  assert.equal(await waitForVercel(options), ready.environment_url)
})
test('does not accept a URL serving the wrong commit, even if GitHub says success', async () => {
  const options = scenario([{ deployments: [deployment(1)], statuses: { 1: [ready] } }])
  options.probe = async () => 'stale-commit'
  await assert.rejects(waitForVercel(options), /No ready Vercel deployment/)
})
test('fails clearly when preview protection rejects CI', async () => {
  const options = scenario([{ deployments: [deployment(1)], statuses: { 1: [ready] } }])
  options.probe = async () => { throw new Error('Preview protection rejected CI') }
  await assert.rejects(waitForVercel(options), /Preview protection/)
})

test('recognises the sign-in redirect of a protected deployment instead of waiting it out', async () => {
  const redirect = async () => new Response(null, { status: 302, headers: { location: 'https://vercel.com/sso-api?url=https%3A%2F%2Fpython-teacher-preview.vercel.app' } })
  await assert.rejects(readDeploymentSha('https://python-teacher-preview.vercel.app', '', redirect), /VERCEL_AUTOMATION_BYPASS_SECRET/)
  const elsewhere = async () => new Response(null, { status: 302, headers: { location: 'https://example.com/' } })
  assert.equal(await readDeploymentSha('https://python-teacher-preview.vercel.app', '', elsewhere), null)
})
