import { describe, expect, it } from 'vitest'
import { normalizeUrl, urlHash } from './url'

describe('normalizeUrl', () => {
  it('strips tracking parameters', () => {
    expect(
      normalizeUrl(
        'https://example.com/post?utm_source=news&utm_medium=email&id=7&fbclid=abc',
      ),
    ).toBe('https://example.com/post?id=7')
  })

  it('sorts remaining parameters', () => {
    expect(normalizeUrl('https://example.com/p?b=2&a=1')).toBe(
      'https://example.com/p?a=1&b=2',
    )
  })

  it('lowercases host and strips www', () => {
    expect(normalizeUrl('https://WWW.Example.COM/Path')).toBe('https://example.com/Path')
  })

  it('strips hash, trailing slash and default ports', () => {
    expect(normalizeUrl('http://example.com:80/docs/#intro')).toBe(
      'http://example.com/docs',
    )
    expect(normalizeUrl('https://example.com:443/')).toBe('https://example.com/')
  })

  it('keeps non-default ports and real query parameters', () => {
    expect(normalizeUrl('https://example.com:8443/search?q=hello+world')).toBe(
      'https://example.com:8443/search?q=hello+world',
    )
  })

  it('rejects non-http protocols', () => {
    expect(() => normalizeUrl('ftp://example.com/file')).toThrow(
      'Unsupported URL protocol',
    )
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow('Unsupported URL protocol')
  })
})

describe('urlHash', () => {
  it('is stable across equivalent URLs', async () => {
    const a = await urlHash('https://www.Example.com/post/?utm_source=x#top')
    const b = await urlHash('https://example.com/post')
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
  })

  it('differs for different pages', async () => {
    const a = await urlHash('https://example.com/one')
    const b = await urlHash('https://example.com/two')
    expect(a).not.toBe(b)
  })
})
