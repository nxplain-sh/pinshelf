import { describe, expect, it } from 'vitest'
import { normalizeTagName, tagNameKey } from './tags'

describe('normalizeTagName', () => {
  it('trims, collapses whitespace and strips leading hashes', () => {
    expect(normalizeTagName('  #web   dev ')).toBe('web dev')
    expect(normalizeTagName('#react')).toBe('react')
  })

  it('rejects empty and over-long names', () => {
    expect(normalizeTagName('')).toBeNull()
    expect(normalizeTagName('#')).toBeNull()
    expect(normalizeTagName('   ')).toBeNull()
    expect(normalizeTagName('x'.repeat(65))).toBeNull()
    expect(normalizeTagName('x'.repeat(64))).toBe('x'.repeat(64))
  })

  it('preserves inner case for display', () => {
    expect(normalizeTagName('iOS')).toBe('iOS')
  })
})

describe('tagNameKey', () => {
  it('lowercases for uniqueness checks', () => {
    expect(tagNameKey('iOS')).toBe('ios')
    expect(tagNameKey('iOS')).toBe(tagNameKey('ios'))
  })
})
