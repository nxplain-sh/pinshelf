# pinshelf browser extension

WXT-based extension for Chrome and Firefox. It saves the current page (or a right-clicked link) to your pinshelf instance through the REST API using an API token.

## Development

```bash
pnpm --filter @pinshelf/extension dev      # Chrome, opens a browser with the extension loaded
pnpm --filter @pinshelf/extension dev -- -b firefox
pnpm --filter @pinshelf/extension build    # production build into .output/chrome-mv3
pnpm --filter @pinshelf/extension zip      # store-ready zip
```

Note: `pnpm dev` at the repository root also starts this, which launches Chrome. If you only want the web app, run `pnpm --filter @pinshelf/web dev`.

## First run

1. Start the web app (`pnpm dev`) or use your deployed instance.
2. In pinshelf, open **settings** and create an API token. The key is shown once.
3. Click the extension icon, press **settings**, and paste the token. For local development set the API base URL to `http://localhost:3000`.

## What it does

- Popup: current tab URL and title, comma-separated tags, collection picker, save button. Shows `saved` or `already saved`.
- Right-click a page or link → **Save to pinshelf**. The toolbar badge flashes `✓` on success and `!` on failure.
- Token and base URL are stored in `browser.storage.local`, never synced anywhere else.

## Permissions, and why

| Permission                                                                   | Reason                                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `activeTab`                                                                  | Read the URL and title of the tab you are saving                    |
| `contextMenus`                                                               | The right-click save entry                                          |
| `storage`                                                                    | Keep your token and base URL                                        |
| `host_permissions` (`https://app.pinshelf.app/*`, `http://localhost:3000/*`) | Call the API without CORS preflight; no other origins are reachable |

## Publishing

Icons are not shipped yet, so both stores will show a default mark. Before publishing, add `public/icon/{16,32,48,96,128}.png` and bump the version in `package.json`. Firefox builds come from the same source (`wxt build -b firefox`); the manifest differences are handled by WXT.
