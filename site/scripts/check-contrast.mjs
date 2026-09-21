// Fails when a text token drops under 4.5:1 on any surface it sits on.
// --ink-faint is reserved for non-text (the fallback mark, decorative fills),
// so it is held to the 3:1 non-text threshold instead. Run: make check.
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8')
const tokens = Object.fromEntries(
  [...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, name, hex]) => [
    name,
    hex.toLowerCase(),
  ]),
)

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const luminance = (hex) =>
  channels(hex)
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const surfaces = ['canvas', 'surface', 'surface-hover']
// danger is defined for token parity with the app but never rendered as text
// here, so it is not checked; every token the site does render is.
const checks = [
  { names: ['ink', 'ink-muted', 'accent', 'warn'], min: 4.5 },
  { names: ['ink-faint'], min: 3 },
]

let failed = false

for (const surface of surfaces) {
  for (const { names, min } of checks) {
    for (const name of names) {
      const ratio = contrast(tokens[name], tokens[surface])
      const ok = ratio >= min
      if (!ok) failed = true
      console.log(
        `${ok ? 'ok  ' : 'FAIL'} ${name} on ${surface}: ${ratio.toFixed(2)} (min ${min})`,
      )
    }
  }
}

if (failed) {
  console.error('contrast check failed — darken the surface or move the text a step up')
  process.exitCode = 1
}
