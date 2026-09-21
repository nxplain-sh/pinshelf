import { createAuthClient } from 'better-auth/react'
import { twoFactorClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      // Sign-in answers with a second-factor challenge instead of a session;
      // send the browser to the code page.
      onTwoFactorRedirect: () => {
        window.location.href = '/two-factor'
      },
    }),
  ],
})
