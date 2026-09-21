import { describe, expect, it } from 'vitest'
import { prepareHtml } from '../src/lib/reader.server'

describe('prepareHtml', () => {
  it('strips scripts and inline handlers', () => {
    const html = prepareHtml(
      '<html><head></head><body onload="steal()"><script>evil()</script><p onclick="x()">hi</p></body></html>',
      'https://example.com/page',
    )
    expect(html).not.toContain('evil()')
    expect(html).not.toContain('onload')
    expect(html).not.toContain('onclick')
    expect(html).toContain('<p>hi</p>')
  })

  it('injects a base so relative urls resolve against the original site', () => {
    const html = prepareHtml(
      '<html><head><title>t</title></head><body></body></html>',
      'https://example.com/a/b',
    )
    expect(html).toContain('<base href="https://example.com/a/b">')
    expect(html).toContain('background:#fff')
    expect(html.indexOf('<base')).toBeLessThan(html.indexOf('<title>'))
  })

  it('keeps an existing base and prepends one when there is no head', () => {
    expect(prepareHtml('<base href="https://other.test/">x', 'https://example.com')).toBe(
      '<base href="https://other.test/">x',
    )
    expect(prepareHtml('<p>x</p>', 'https://example.com')).toContain(
      '<base href="https://example.com"><style>',
    )
  })
})
