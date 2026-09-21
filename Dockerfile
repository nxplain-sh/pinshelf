# syntax=docker/dockerfile:1

# pinshelf is a Cloudflare Worker, so the container runs the built Worker on
# workerd through `wrangler dev` with local D1 and R2 state under /data. See
# docs/adr/0016-self-host-with-docker-on-workerd.md for why and what is lost.

# Base images are pinned by digest so a rebuild is the same image; Renovate
# moves the digest when the tag moves.
FROM node:22-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9 AS build

ENV CI=1
RUN corepack enable
WORKDIR /app

# Workspace manifests first, so the install layer survives source edits.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/web/wrangler.jsonc apps/web/
COPY apps/extension/package.json apps/extension/
COPY packages/shared/package.json packages/shared/
COPY site/package.json site/
RUN pnpm install --frozen-lockfile --filter @pinshelf/web...

COPY . .
RUN pnpm --filter @pinshelf/web build

FROM node:22-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9 AS runtime

LABEL org.opencontainers.image.title="pinshelf" \
  org.opencontainers.image.description="Self-hosted bookmark manager" \
  org.opencontainers.image.source="https://github.com/nxplain-sh/pinshelf" \
  org.opencontainers.image.licenses="MIT"

# Keep in sync with the wrangler devDependency in apps/web/package.json.
ARG WRANGLER_VERSION=4.135.0
ENV WRANGLER_SEND_METRICS=false NODE_ENV=production
RUN npm install --global --no-fund --no-audit "wrangler@${WRANGLER_VERSION}" \
  && npm cache clean --force

WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/dist ./dist
COPY --from=build --chown=node:node /app/apps/web/migrations ./migrations
COPY --chmod=0755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# The entrypoint writes the local secrets file next to the build output and
# keeps D1 and R2 state under /data, so both belong to the unprivileged user
# the container runs as.
RUN mkdir -p /data && chown node:node /data

USER 1000:1000

EXPOSE 3000
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PINSHELF_PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

ENTRYPOINT ["docker-entrypoint.sh"]
