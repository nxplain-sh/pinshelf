const TOKEN_SPLIT = /[^\p{L}\p{N}_]+/u
const MAX_TOKENS = 10

export function buildFtsQuery(input: string): string | null {
  const tokens = input
    .toLowerCase()
    .split(TOKEN_SPLIT)
    .filter(Boolean)
    .slice(0, MAX_TOKENS)

  if (tokens.length === 0) return null

  return tokens.map((token) => `"${token}"*`).join(' ')
}
