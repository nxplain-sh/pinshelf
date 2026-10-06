// Every tag keeps one fill everywhere it appears, so `rust` is the same colour
// in the list, the filters, and insights. Literal class names, so Tailwind
// sees them.
const TONES = ['bg-accent', 'bg-pink', 'bg-sky', 'bg-mint', 'bg-lilac'] as const

export type TagTone = (typeof TONES)[number]

export function tagTone(name: string): TagTone {
  // FNV-1a, then murmur3's finaliser: short, similar names (css, dev, git)
  // would otherwise land on the same few tones.
  let hash = 0x811c9dc5
  for (const char of name.toLowerCase()) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return TONES[(hash >>> 0) % TONES.length]
}
