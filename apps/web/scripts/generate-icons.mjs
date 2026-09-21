// Rasterizes the pinshelf mark into every icon the app and the extension need.
//
// Source of truth is docs/brand/. Run with `make icons` after changing the mark.
// The React component in apps/web/src/components/Logo.tsx and
// apps/web/public/favicon.svg are the other two copies of the geometry; see
// docs/design.md for which cut goes where.
//
// Produces:
//   apps/web/public/icons/*        PWA icons, full cut (transparent)
//   docs/brand/social-card.png     regenerated 1200x630 card (lockup + tagline)
//   apps/web/public/social-card.png copy of that card for og:image
//   apps/extension/public/icon/*   toolbar icons, plated for contrast on light toolbars
//   apps/extension/public/mark.svg copy of the mark for the popup header
//   site/public/assets/*           copies for the static site
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const BRAND = join(ROOT, 'docs', 'brand')
const MARK = join(BRAND, 'mark.svg')
const PLATE = join(BRAND, 'mark-plate.svg')

async function rasterize(source, relativePath, size) {
  const output = join(ROOT, relativePath)
  mkdirSync(dirname(output), { recursive: true })

  await sharp(source, { density: 512 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(output)

  console.log(`${relativePath}: ${size}x${size}`)
}

function copy(source, relativePath) {
  const output = join(ROOT, relativePath)
  mkdirSync(dirname(output), { recursive: true })
  copyFileSync(source, output)
  console.log(`${relativePath}: copied`)
}

// The social card is composed here so the lockup stays in sync with
// logo-dark.svg and the tagline changes in one place. Menlo sets the tagline;
// on machines without it fontconfig picks another mono and the line shifts.
const TAGLINE = 'pin it \u00b7 shelf it \u00b7 find it'
const CARD = { width: 1200, height: 630, bg: '#131110', tagline: '#b3a99b' }
// Content of logo-dark.svg spans x 16.16..418.24, y 15.88..101.72 in its
// viewBox; the card places it 692px wide with its top-left at 268,205.
const LOCKUP = {
  x: 268,
  y: 205,
  width: 692,
  sourceX: 16.16,
  sourceY: 15.88,
  sourceWidth: 402.23,
}

async function writeSocialCard(relativePath) {
  const logo = readFileSync(join(BRAND, 'logo-dark.svg'), 'utf8')
  const lockup = logo
    .replace(/<metadata>[\s\S]*?<\/metadata>/, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
  const scale = LOCKUP.width / LOCKUP.sourceWidth
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${CARD.height}" viewBox="0 0 ${CARD.width} ${CARD.height}">
  <rect width="${CARD.width}" height="${CARD.height}" fill="${CARD.bg}"/>
  <g transform="translate(${(LOCKUP.x - scale * LOCKUP.sourceX).toFixed(2)} ${(LOCKUP.y - scale * LOCKUP.sourceY).toFixed(2)}) scale(${scale.toFixed(4)})">${lockup}</g>
  <text x="349.56" y="472" font-family="Menlo, monospace" font-size="29.3" letter-spacing="0.96" fill="${CARD.tagline}">${TAGLINE}</text>
</svg>`

  const output = join(ROOT, relativePath)
  mkdirSync(dirname(output), { recursive: true })
  await sharp(Buffer.from(svg), { density: 72 })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(output)
  console.log(`${relativePath}: ${CARD.width}x${CARD.height}`)
}

// PWA icons use the full cut on a transparent canvas, per docs/design.md.
await rasterize(MARK, 'apps/web/public/icons/icon-192.png', 192)
await rasterize(MARK, 'apps/web/public/icons/icon-512.png', 512)

// iOS composites the home screen icon, and a transparent one lands on an
// unknown background, so this one carries the plate for the same reason the
// favicon does.
await rasterize(PLATE, 'apps/web/public/icons/apple-touch-icon.png', 180)

// Toolbar icons sit on browser chrome we do not control; the plate keeps the
// steel pin readable there.
for (const size of [16, 32, 48, 96, 128]) {
  await rasterize(PLATE, `apps/extension/public/icon/${size}.png`, size)
}

await writeSocialCard('docs/brand/social-card.png')
copy(join(BRAND, 'social-card.png'), 'apps/web/public/social-card.png')

// The static site serves its own copies; generate them here so the mark and
// the card keep changing in one place. See docs/design.md.
const SITE_ASSETS = 'site/public/assets'
for (const file of [
  'logo-dark.svg',
  'logo-light.svg',
  'mark.svg',
  'mark-light.svg',
  'mark-plate.svg',
  'social-card.png',
]) {
  copy(join(BRAND, file), `${SITE_ASSETS}/${file}`)
}
copy('apps/web/public/favicon.svg', `${SITE_ASSETS}/favicon.svg`)
copy(MARK, 'apps/extension/public/mark.svg')
