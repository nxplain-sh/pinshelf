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

- Popup: current tab URL and title, comma-separated tags, collection picker, save button, and **all tabs (N)** to save every open tab in the window at once. Shows `saved`, `already there`, or a failed count.
- Right-click a page or link → **Save to pinshelf**. Select text → **Highlight selection in pinshelf**; the page is saved first when it is new, then the quote is attached to it. The toolbar badge flashes `✓` on success and `!` on failure.
- Popup **summarise** asks the configured model about the current page (it must be saved first), and **sidebar** opens the app in Chrome's side panel.
- **Saved-page badge**: tabs whose url is already in the library get a `✓` badge. Checked on navigation and tab switch only, never in the background; disable it from the popup's settings.
- **Omnibox**: type `pin` and a space in the address bar to search the library; the default suggestion opens the instance search.
- Token and base URL are stored in `browser.storage.local`, never synced anywhere else.

## Permissions, and why

| Permission                                                                   | Reason                                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `activeTab`                                                                  | Read the URL and title of the tab you are saving                          |
| `contextMenus`                                                               | The right-click save entry                                                |
| `storage`                                                                    | Keep your token and base URL, and the badge preference                    |
| `tabs`                                                                       | List open tabs for "all tabs" and read the active tab's url for the badge |
| `sidePanel`                                                                  | The popup's "sidebar" button (Chrome and Edge only)                       |
| `host_permissions` (`https://app.pinshelf.app/*`, `http://localhost:3000/*`) | Call the API without CORS preflight; no other origins are reachable       |

## Publishing

Icons are not shipped yet, so both stores will show a default mark. Before publishing, add `public/icon/{16,32,48,96,128}.png` and bump the version in `package.json`. Firefox builds come from the same source (`wxt build -b firefox`); the manifest differences are handled by WXT.
