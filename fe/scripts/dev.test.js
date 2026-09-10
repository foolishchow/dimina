const assert = require('node:assert/strict')
const { spawn, execFileSync } = require('node:child_process')
const { once } = require('node:events')
const net = require('node:net')
const path = require('node:path')
const { setTimeout: delay } = require('node:timers/promises')
const { test } = require('node:test')

const feRoot = path.resolve(__dirname, '..')
const ports = [[5173, 'localhost'], [7788, '127.0.0.1']]

async function bind(port, host) {
	const server = net.createServer()
	server.listen(port, host)
	await once(server, 'listening')
	return server
}

async function portsAreFree(entries = ports) {
	const held = []
	try {
		for (const [port, host] of entries) held.push(await bind(port, host))
		return true
	}
	catch { return false }
	finally { for (const server of held) server.close() }
}

async function until(check, message, timeout = 15000) {
	const deadline = Date.now() + timeout
	while (!await check()) {
		assert.ok(Date.now() < deadline, message())
		await delay(25)
	}
}

function descendants(pid) {
	const rows = execFileSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' })
		.trim().split('\n').map(line => line.trim().split(/\s+/).map(Number))
	const found = new Set([pid])
	let changed = true
	while (changed) {
		changed = false
		for (const [child, parent] of rows) {
			if (found.has(parent) && !found.has(child)) { found.add(child); changed = true }
		}
	}
	return [...found]
}

function signal(pid, name) {
	try { process.kill(pid, name) }
	catch (error) { if (error.code !== 'ESRCH') throw error }
}

function launch(script = 'dev') {
	const pnpm = process.env.npm_execpath || 'pnpm'
	const nodeEntry = /\.[cm]?js$/.test(pnpm)
	const child = spawn(nodeEntry ? process.execPath : pnpm,
		nodeEntry ? [pnpm, 'run', script] : ['run', script], {
			cwd: feRoot, detached: true, env: { ...process.env, BROWSER: 'none', NO_COLOR: '1' },
			stdio: ['ignore', 'pipe', 'pipe'],
		})
	let output = ''
	let exited = false
	let code
	let owned = []
	child.stdout.on('data', data => { output += data })
	child.stderr.on('data', data => { output += data })
	child.on('exit', value => { exited = true; code = value })
	child.on('error', error => { output += error.message; exited = true; code = -1 })
	return {
		async ready() {
			await until(() => exited || (output.includes('Local:') && output.includes('Dimina proxy is listening')),
				() => `Development services did not start:\n${output}`)
			assert.equal(exited, false, output)
			owned = descendants(child.pid)
		},
		async stop(name) {
			signal(-child.pid, name)
			await until(() => exited, () => `Development command did not exit:\n${output}`)
			await until(portsAreFree, () => `Development services retained their ports after ${name}:\n${output}`, 3000)
		},
		async fails() {
			await until(() => {
				if (!exited && child.pid) owned = [...new Set([...owned, ...descendants(child.pid)])]
				assert.doesNotMatch(output, /trying another one/)
				return exited
			}, () => `Conflicting development server did not exit:\n${output}`)
			assert.notEqual(code, 0, output)
			assert.match(output, /Port 5173 is already in use/)
			assert.doesNotMatch(output, /trying another one/)
		},
		cleanup() {
			// Only this test's recorded process tree, never unrelated port owners.
			for (const pid of owned.reverse()) signal(pid, 'SIGTERM')
			if (!exited && child.pid) signal(-child.pid, 'SIGTERM')
			child.stdout.destroy()
			child.stderr.destroy()
		},
	}
}

test('development services release their ports and reject conflicting launches', {
	skip: process.platform === 'win32' ? 'POSIX process group signals' : false,
	timeout: 60000,
}, async (t) => {
	if (!await portsAreFree()) { t.skip('Development ports are already occupied'); return }
	for (const name of ['SIGINT', 'SIGTERM']) {
		await t.test(`pnpm dev can stop with ${name} and restart`, async () => {
			const app = launch()
			try { await app.ready(); await app.stop(name) }
			finally { app.cleanup() }
		})
	}
	await t.test('a Vite port conflict also shuts down the proxy', async () => {
		const blocker = await bind(5173, 'localhost')
		const app = launch('dev:services')
		try {
			await app.fails()
			await until(() => portsAreFree([ports[1]]), () => 'The proxy outlived the failed Vite startup', 3000)
		}
		finally { app.cleanup(); await new Promise(resolve => blocker.close(resolve)) }
	})
})
