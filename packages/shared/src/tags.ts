const MAX_TAG_LENGTH = 64

export function normalizeTagName(input: string): string | null {
  const name = input.trim().replace(/^#+/, '').replace(/\s+/g, ' ')
  if (!name || name.length > MAX_TAG_LENGTH) return null
  return name
}

export function tagNameKey(input: string): string {
  return input.toLowerCase()
}
