// Guards site/src/index.js: every inline script in the pages must be covered by
// the CSP hash, and the security headers must still be set. Run: make check.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const worker = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
const pages = ['index.html', 'docs.html', '404.html']

const hashes = new Set()
for (const page of pages) {
  const html = readFileSync(new URL(`../public/${page}`, import.meta.url), 'utf8')
  for (const match of html.matchAll(
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    hashes.add(`sha256-${createHash('sha256').update(match[1]).digest('base64')}`)
  }
}

let failed = false

for (const hash of hashes) {
  const ok = worker.includes(hash)
  if (!ok) failed = true
  console.log(`${ok ? 'ok  ' : 'FAIL'} CSP covers inline script ${hash}`)
}

const required = [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
]

for (const name of required) {
  const ok = worker.includes(`'${name}'`)
  if (!ok) failed = true
  console.log(`${ok ? 'ok  ' : 'FAIL'} header ${name} is set`)
}

if (failed) {
  console.error('header check failed — update site/src/index.js to match the pages')
  process.exitCode = 1
}
