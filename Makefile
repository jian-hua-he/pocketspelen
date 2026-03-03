.PHONY: help dev build stop clean install deploy
.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

dev: ## Start dev server at http://localhost:5173
	docker compose up

build: ## Production build to dist/
	docker compose run --rm dev npx vite build

stop: ## Stop running containers
	docker compose down

clean: ## Remove containers, volumes, and dist/
	docker compose down -v
	rm -rf dist

install: ## Install npm dependencies
	docker compose run --rm dev npm install

deploy: ## Deploy via GitHub Actions (push to master)
	@echo "Deploying: push to master triggers GitHub Actions → GitHub Pages"
	@echo "URL: https://jian-hua-he.github.io/pocketspelen/"
