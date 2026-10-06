// Fails when a text token drops under 4.5:1 on any fill it sits on. The
// palette is light: canvas/surface/surface-hover carry the text tokens, and
// the pop colours (accent, pink, sky, mint, lilac) are fills that carry ink.
// accent is never text here; accent-ink is the brass text token. Run: make check.
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
// ok, danger, and coral are defined for token parity with the app but never
// rendered as text or behind text here (coral is only a window-chrome dot), so
// they are not checked; every pair the site does render is.
const checks = [
  {
    names: ['ink', 'ink-muted', 'ink-faint', 'accent-ink', 'warn'],
    on: surfaces,
    min: 4.5,
  },
  { names: ['ink'], on: ['accent', 'pink', 'sky', 'mint', 'lilac'], min: 4.5 },
  // The closing panel's lede is ink-muted on accent.
  { names: ['ink-muted'], on: ['accent'], min: 4.5 },
  // The active filter chip in the product shot inverts: surface text on ink.
  { names: ['surface'], on: ['ink'], min: 4.5 },
]

let failed = false

for (const { names, on, min } of checks) {
  for (const fill of on) {
    for (const name of names) {
      const ratio = contrast(tokens[name], tokens[fill])
      const ok = ratio >= min
      if (!ok) failed = true
      console.log(
        `${ok ? 'ok  ' : 'FAIL'} ${name} on ${fill}: ${ratio.toFixed(2)} (min ${min})`,
      )
    }
  }
}

if (failed) {
  console.error('contrast check failed — darken the text or lighten the fill it sits on')
  process.exitCode = 1
}
