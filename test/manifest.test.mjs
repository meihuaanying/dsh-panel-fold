// Manifest consistency test: the package name, the bundle patch row, and the client
// entry all have to agree, or the plugin silently loads nothing.
//
// Run with: node test/manifest.test.mjs

import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import test from 'node:test'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (rel) => readFileSync(join(root, rel), 'utf8')

const pkg = JSON.parse(read('package.json'))

test('package name is a plain npm-safe name', () => {
	assert.match(pkg.name, /^[a-z0-9][a-z0-9._-]*$/)
	assert.equal(pkg.private, undefined, 'published packages must not set "private": true')
})

test('dsh manifest wires a bundle patch and a web client half', () => {
	assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml')
	assert.equal(pkg.dsh?.client?.platform, 'web')
	assert.deepEqual(pkg.dsh?.client?.inject, ['@deepseek-ai/dsh-client-ui-sidebar'])
})

test('declared entry points exist and are listed in "files"', () => {
	for (const rel of [pkg.main, pkg.exports['./client'], './cordis.patch.yml', './README.md', './LICENSE']) {
		assert.ok(existsSync(join(root, rel)), `${rel} is missing`)
	}
	for (const rel of ['lib', 'cordis.patch.yml', 'README.md', 'LICENSE', 'docs']) {
		assert.ok(pkg.files.includes(rel), `"files" should list ${rel}`)
	}
})

test('bundle patch inserts exactly the package row', () => {
	const patch = read('cordis.patch.yml')
	const ids = [...patch.matchAll(/^\s*-?\s*id:\s*(\S+)\s*$/gm)].map((m) => m[1])
	const names = [...patch.matchAll(/^\s*-?\s*name:\s*(\S+)\s*$/gm)].map((m) => m[1])
	assert.deepEqual(ids, [pkg.name], 'patch id must equal the package name')
	assert.deepEqual(names, [pkg.name], 'patch name must equal the package name')
})

test('client half registers under the same id it declares', () => {
	const client = read(pkg.exports['./client'])
	assert.ok(
		client.includes(`id: '${pkg.name}'`),
		'client.js must load itself under the package name',
	)
	const registration = /register\(\s*\{([^}]*)\}/.exec(client)
	assert.ok(registration, 'client.js must call slots.register')
	assert.match(registration[1], new RegExp(`id:\\s*'${pkg.name}'`))
	assert.match(registration[1], /name:\s*'sidebar\.panellist\.actions'/)
})

test('client half only injects services it is allowed to use', () => {
	const client = read(pkg.exports['./client'])
	const inject = /inject:\s*\[([^\]]*)\]/.exec(client)
	assert.ok(inject, 'client.js must declare inject')
	const services = [...inject[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
	assert.deepEqual(services, ['slots'])
	// The slot must be one the sidebar actually renders.
	assert.ok(client.includes("'sidebar.panellist.actions'"))
})

test('storage key and root classes stay namespaced to the package', () => {
	const client = read(pkg.exports['./client'])
	assert.ok(client.includes(`${pkg.name}:mode`), 'localStorage key should be namespaced')
	assert.ok(client.includes(`'${pkg.name}-collapsed'`), 'fold class should be namespaced')
})

test('host half is a no-op stub, not a service', () => {
	const host = read(pkg.main)
	assert.ok(host.includes(`export const name = '${pkg.name}'`))
	assert.ok(!/\bexport (const|function|class) (inject|Config)\b/.test(host), 'host half should stay a stub')
})
