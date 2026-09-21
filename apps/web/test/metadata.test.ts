import { describe, expect, it } from 'vitest'
import { extractMetadata } from '../src/lib/metadata.server'

function htmlResponse(html: string) {
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

describe('extractMetadata', () => {
  it('prefers og tags over page title and meta description', async () => {
    const metadata = await extractMetadata(
      htmlResponse(`<!doctype html><html><head>
        <title>Page title</title>
        <meta name="description" content="plain description">
        <meta property="og:title" content="OG title">
        <meta property="og:description" content="OG description">
        <meta property="og:site_name" content="Example">
        <meta property="og:image" content="/images/card.png">
        <link rel="icon" href="/favicon.ico">
      </head><body></body></html>`),
      'https://example.com/post',
    )

    expect(metadata).toEqual({
      title: 'OG title',
      description: 'OG description',
      siteName: 'Example',
      faviconUrl: 'https://example.com/favicon.ico',
      ogImageUrl: 'https://example.com/images/card.png',
    })
  })

  it('falls back to title and description tags', async () => {
    const metadata = await extractMetadata(
      htmlResponse(
        '<html><head><title>Just a title</title><meta name="description" content="desc"></head></html>',
      ),
      'https://example.com/',
    )

    expect(metadata.title).toBe('Just a title')
    expect(metadata.description).toBe('desc')
    expect(metadata.ogImageUrl).toBeUndefined()
  })

  it('collapses whitespace and truncates long values', async () => {
    const long = 'x'.repeat(600)
    const metadata = await extractMetadata(
      htmlResponse(`<html><head><title>  spaced   out  </title>
        <meta name="description" content="${long}"></head></html>`),
      'https://example.com/',
    )

    expect(metadata.title).toBe('spaced out')
    expect(metadata.description).toHaveLength(500)
  })

  it('returns nothing for non-html responses', async () => {
    const response = new Response('%PDF-1.4', {
      headers: { 'content-type': 'application/pdf' },
    })
    expect(await extractMetadata(response, 'https://example.com/file.pdf')).toEqual({})
  })

  it('returns nothing for error responses', async () => {
    const response = new Response('<html><title>Not found</title></html>', {
      status: 404,
      headers: { 'content-type': 'text/html' },
    })
    expect(await extractMetadata(response, 'https://example.com/missing')).toEqual({})
  })

  it('ignores non-http favicon and image urls', async () => {
    const metadata = await extractMetadata(
      htmlResponse(`<html><head><title>t</title>
        <link rel="icon" href="data:image/png;base64,AAAA">
        <meta property="og:image" content="javascript:alert(1)"></head></html>`),
      'https://example.com/',
    )

    expect(metadata.faviconUrl).toBeUndefined()
    expect(metadata.ogImageUrl).toBeUndefined()
  })
})
