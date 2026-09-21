export function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Expected an object')
  }
  return input as Record<string, unknown>
}

export function requireString(input: unknown, key: string): string {
  const value = asRecord(input)[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Expected a non-empty "${key}" string`)
  }
  return value.trim()
}

export function optionalString(input: unknown, key: string): string | undefined {
  const value = asRecord(input)[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new Error(`Expected "${key}" to be a string`)
  return value
}

export function optionalStringArray(input: unknown, key: string): string[] | undefined {
  const value = asRecord(input)[key]
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Expected "${key}" to be an array of strings`)
  }
  return value
}

export function requireStringArray(input: unknown, key: string): string[] {
  const value = optionalStringArray(input, key)
  if (!value) throw new Error(`Expected "${key}" to be an array of strings`)
  return value
}
