# Terms of Service

Last updated: 2026-09-20

These terms cover two different things, and it matters which one applies to you.

1. **The software.** pinshelf is open source under the MIT license. You can run it yourself, on your own Cloudflare account. When you do, these terms do not govern your instance — you do. See [License](#license) below.
2. **A hosted instance.** If someone operates a pinshelf instance and gives you access to it, that operator's terms apply. The section [Hosted instances](#hosted-instances) is a template for that case, and describes what the upstream project would require of an operator who uses the pinshelf name.

## The software

pinshelf is provided as-is, without warranty of any kind, under the [MIT license](LICENSE). Running it is your responsibility, including:

- the security and configuration of your Cloudflare account, Worker, and D1 database
- the secrets you generate and store (`BETTER_AUTH_SECRET`, any AI provider key)
- backups: exports are available as JSON and HTML from the settings page, and you are responsible for taking them
- the content you save, and whether you have the right to save it

Nothing in this document adds restrictions on top of the MIT license for people running their own instance.

## Hosted instances

If an operator runs an instance and grants you access, these terms apply to your use of it. A single instance serves a single owner account; there is no signup beyond the first-run setup form.

### Your account

- Keep your credentials to yourself. Anyone with your session or an API token you created has full access to everything in that instance.
- You are responsible for activity under your account and for API tokens you create. Tokens can be revoked from the settings page at any time.
- The operator may suspend or end your access at any time, with or without notice.

### Acceptable use

Do not use an instance to:

- break any law, or infringe anyone's rights
- store or distribute malware, phishing pages, or material you have no right to hold
- attack, overload, or probe the instance, the operator's Cloudflare account, or third-party sites through the metadata fetcher
- resell or share access to the instance as if it were your own service

Automated use through the REST API is welcome, within the rate limits the instance enforces (300 requests per minute per API token by default). Deliberate circumvention of those limits is grounds for revocation.

### Your content

- What you save stays yours. The operator claims no ownership of your bookmarks, notes, tags, or collections.
- You are responsible for the URLs you save. Saving a page causes the instance to fetch that page, so do not point it at resources you are not permitted to access.
- Deleting a bookmark moves it to trash, where it stays until you delete it permanently or empty it.

### Third-party services

An instance talks to services that the operator and you choose, and content may leave the instance in the process:

- **Saved pages.** The metadata fetcher requests each saved URL to read its title, description, and images. The site you save learns the instance's IP address, as any visitor would.
- **AI features.** If AI cleanup is configured, the bookmarks in a scanned batch are sent to the provider configured in settings. If you do not want that, leave AI unconfigured; nothing else in the app sends your data anywhere.
- **Hosting.** A self-hosted instance stores everything in the operator's own Cloudflare account. There is no pinshelf-operated backend, no telemetry, and no analytics.

### Availability

Instances are provided as-is, with no service level, no uptime commitment, and no support obligation. The operator may change, break, or discontinue an instance at any time, and may lose data if a backup was never taken. Take exports if the data matters to you.

## Disclaimer of warranties

TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SOFTWARE AND ANY HOSTED INSTANCE ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. NO WARRANTY IS GIVEN THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT DATA WILL NOT BE LOST.

## Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE AUTHORS, MAINTAINERS, AND OPERATORS OF PINSHELF ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF DATA, PROFITS, OR GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF THE SOFTWARE OR ANY HOSTED INSTANCE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

## Changes

These terms may change. The date at the top is the version that applies, and material changes will be described in the repository's commit history. Continuing to use a hosted instance after a change means you accept the new terms.

## License

The software is licensed under the [MIT license](LICENSE). These terms do not modify, restrict, or replace that license.

## Contact

Open an issue in the repository for questions about these terms. For security reports, follow [SECURITY.md](SECURITY.md) instead.

---

<!--
Before publishing a hosted instance, the operator should fill in:

- governing law and venue (a jurisdiction must be chosen deliberately, not by default)
- a monitored contact address for legal notices
- the operator's legal identity, if the instance is run by an entity rather than an individual
-->
