.PHONY: dev build stop clean install

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
