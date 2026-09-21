// Static site Worker. Workers Static Assets serves the files; this wrapper
// exists to add the security headers and cache lifetimes that an assets-only
// Worker cannot set. Keep the CSP hash in sync with the inline script in
// public/index.html and public/docs.html — `pnpm --filter @pinshelf/site check`
// fails if they drift. See docs/adr/0015.
const INLINE_SCRIPT_HASH = 'sha256-k8ZoqoS/qHVRhkcvg0oiWri9mxhXHtdBYt1phVUaxW8='

const CSP = [
  "default-src 'self'",
  `script-src 'self' '${INLINE_SCRIPT_HASH}'`,
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ')

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()',
}

// Names are stable (no content hashes), so HTML, CSS, and JS keep revalidating;
// only the binary brand assets get a real lifetime.
const CACHEABLE = /\.(png|svg|ico|webp)$/

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    const headers = new Headers(response.headers)

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value)
    }

    if (CACHEABLE.test(new URL(request.url).pathname)) {
      headers.set('Cache-Control', 'public, max-age=86400')
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
}
