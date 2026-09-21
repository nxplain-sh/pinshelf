import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

const PAGE_HTML = `<!doctype html>
<html>
  <head>
    <title>Example Domain</title>
    <meta property="og:description" content="An example page">
    <meta property="og:site_name" content="Example">
    <link rel="icon" href="/favicon.ico">
  </head>
  <body>hi</body>
</html>`

export default defineConfig({
  resolve: {
    alias: {
      '~': path.join(import.meta.dirname, 'src'),
    },
  },
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        path.join(import.meta.dirname, 'migrations'),
      )

      return {
        wrangler: { configPath: './test/wrangler.test.jsonc' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
          outboundService: async (request: Request) => {
            const url = new URL(request.url)

            if (url.hostname === 'example.com') {
              return new Response(PAGE_HTML, {
                headers: { 'content-type': 'text/html; charset=utf-8' },
              })
            }

            if (url.hostname === 'www.youtube.com') {
              return new Response(
                `<html><script>var ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://captions.test/timedtext?lang=en","languageCode":"en"}]}}};</script></html>`,
                { headers: { 'content-type': 'text/html; charset=utf-8' } },
              )
            }

            if (url.hostname === 'captions.test') {
              return Response.json({
                events: [{ segs: [{ utf8: 'hello ' }, { utf8: 'from the transcript' }] }],
              })
            }

            // Test double for an OpenAI-compatible endpoint. It answers with
            // proposals that reference the ids it was given, so scan and apply
            // can be exercised end to end without a real model.
            if (url.hostname === 'ai.test') {
              const body = (await request.json()) as {
                messages?: { role: string; content: string }[]
              }
              const userMessage = body.messages?.find(
                (message) => message.role === 'user',
              )
              const payload = userMessage
                ? (JSON.parse(userMessage.content) as {
                    intent?: string
                    bookmarks?: { id: string }[]
                    tags?: string[]
                    collections?: string[]
                  })
                : {}

              // Every prompt shape gets its own answer so the stub stays a
              // faithful double rather than one shape guessed at.
              if (payload.intent === 'ask-bookmark') {
                return Response.json({
                  choices: [{ message: { content: 'Stub answer about the page.' } }],
                })
              }

              if (payload.intent === 'tag-merges') {
                const names = payload.tags ?? []
                return Response.json({
                  choices: [
                    {
                      message: {
                        content: JSON.stringify({
                          merges:
                            names.length >= 2
                              ? [{ from: names[0], into: names[1], reason: 'stub pair' }]
                              : [],
                        }),
                      },
                    },
                  ],
                })
              }

              // Smart search and smart collections get their own shapes so the
              // stub stays a faithful double for each prompt.
              if (payload.intent === 'smart-search') {
                return Response.json({
                  choices: [
                    {
                      message: {
                        content: JSON.stringify({
                          q: 'rust',
                          tag: payload.tags?.[0],
                          sort: 'newest',
                          explanation: 'rust bookmarks, newest first',
                        }),
                      },
                    },
                  ],
                  usage: { prompt_tokens: 20, completion_tokens: 10 },
                })
              }

              if (payload.intent === 'smart-collections') {
                return Response.json({
                  choices: [
                    {
                      message: {
                        content: JSON.stringify({
                          collections: [
                            {
                              name: 'ai picks',
                              tag: payload.tags?.[0],
                              q: 'example',
                              reason: 'stub suggestion',
                            },
                            {
                              name: 'ai picks',
                              q: 'duplicate of the first',
                              reason: 'stub duplicate',
                            },
                            { name: 'made up', tag: 'not-a-real-tag' },
                          ],
                        }),
                      },
                    },
                  ],
                  usage: { prompt_tokens: 30, completion_tokens: 15 },
                })
              }

              const ids = (payload.bookmarks ?? []).map((bookmark) => bookmark.id)

              const reply = {
                duplicates:
                  ids.length >= 2
                    ? [{ keepId: ids[0], removeIds: [ids[1]], reason: 'same page' }]
                    : [],
                updates:
                  ids.length >= 3
                    ? [
                        {
                          id: ids[2],
                          tags: ['ai-tag'],
                          description: 'AI description',
                          collection: 'AI Collection',
                        },
                      ]
                    : [],
              }

              return Response.json({
                choices: [{ message: { content: JSON.stringify(reply) } }],
              })
            }

            return new Response('no stub for this host', { status: 502 })
          },
        },
      }
    }),
  ],
  test: {
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
  },
})
