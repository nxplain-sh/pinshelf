import { describe, expect, it } from 'vitest'
import { buildFtsQuery } from './search'

describe('buildFtsQuery', () => {
  it('returns null for empty or punctuation-only input', () => {
    expect(buildFtsQuery('')).toBeNull()
    expect(buildFtsQuery('   ')).toBeNull()
    expect(buildFtsQuery('*** ???')).toBeNull()
  })

  it('builds prefix queries for each token', () => {
    expect(buildFtsQuery('React hooks')).toBe('"react"* "hooks"*')
  })

  it('neutralizes FTS operators and quotes from input', () => {
    expect(buildFtsQuery('react" OR "x')).toBe('"react"* "or"* "x"*')
    expect(buildFtsQuery('title:foo NEAR(bar)')).toBe('"title"* "foo"* "near"* "bar"*')
  })

  it('keeps unicode letters and numbers', () => {
    expect(buildFtsQuery('café 100 días')).toBe('"café"* "100"* "días"*')
  })

  it('caps the number of tokens', () => {
    const input = Array.from({ length: 20 }, (_, index) => `t${index}`).join(' ')
    expect(buildFtsQuery(input)?.split(' ')).toHaveLength(10)
  })
})
