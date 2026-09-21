SHELL := bash
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

WEB := apps/web
SITE := site
D1_NAME := pinshelf

.PHONY: help setup format check test-watch db-migrate db-migrate-remote d1-create r2-create secret secret-put deploy site-dev site-deploy cf-login cf-whoami icons clean

help: ## Show available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

setup: ## Install dependencies, create local .dev.vars, apply local migrations
	pnpm install
	if [[ ! -f $(WEB)/.dev.vars ]]; then
		cp $(WEB)/.dev.vars.example $(WEB)/.dev.vars
		echo "Created $(WEB)/.dev.vars — set BETTER_AUTH_SECRET (make secret)"
	fi
	pnpm db:migrate

format: ## Format the repository with Prettier
	pnpm format

check: ## Run everything CI runs: formatting, lint, build, types, tests
	pnpm format:check
	pnpm lint
	pnpm --filter @pinshelf/site check
	pnpm build typecheck test

test-watch: ## Run all package tests in watch mode
	pnpm -r --parallel exec vitest

db-migrate: ## Apply Drizzle migrations to the local D1 database
	pnpm db:migrate

db-migrate-remote: ## Apply Drizzle migrations to the remote D1 database
	pnpm --filter @pinshelf/web exec wrangler d1 migrations apply $(D1_NAME) --remote

d1-create: ## Create the remote D1 database (prints the id for wrangler.jsonc)
	pnpm --filter @pinshelf/web exec wrangler d1 create $(D1_NAME)

r2-create: ## Create the R2 bucket that holds JSON backups
	pnpm --filter @pinshelf/web exec wrangler r2 bucket create $(D1_NAME)-backups

secret: ## Print a fresh value for BETTER_AUTH_SECRET
	@openssl rand -base64 32

secret-put: ## Upload BETTER_AUTH_SECRET as a Worker secret (prompts)
	pnpm --filter @pinshelf/web exec wrangler secret put BETTER_AUTH_SECRET

deploy: ## Build and deploy the web app to Cloudflare
	pnpm deploy

site-dev: ## Serve the static site locally on Cloudflare's dev server
	pnpm --filter @pinshelf/site dev

site-deploy: ## Deploy the static site to Cloudflare
	pnpm --filter @pinshelf/site deploy

icons: ## Regenerate icons, brand copies, and site assets from docs/brand
	node $(WEB)/scripts/generate-icons.mjs

cf-login: ## Authenticate wrangler with your Cloudflare account
	pnpm --filter @pinshelf/web exec wrangler login

cf-whoami: ## Show the Cloudflare account wrangler is using
	pnpm --filter @pinshelf/web exec wrangler whoami

clean: ## Remove build output, caches, and local D1 state
	rm -rf .turbo node_modules/.cache
	rm -rf $(WEB)/.turbo $(WEB)/dist $(WEB)/.output
	rm -rf packages/shared/node_modules/.cache
	@echo "Removed build output and caches. Local D1 state kept in $(WEB)/.wrangler — delete it manually to reset the database."
