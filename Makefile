.PHONY: help up down dev-deps migrate-up migrate-down test clean

help:
	@echo "Available commands:"
	@echo "  make up           - Start all services with Docker Compose"
	@echo "  make down         - Stop all services"
	@echo "  make dev-deps     - Start only Postgres and Redis (for local dev)"
	@echo "  make migrate-up   - Run database migrations"
	@echo "  make migrate-down - Rollback last migration"
	@echo "  make test         - Run all tests"
	@echo "  make clean        - Remove containers, volumes, and build artifacts"

up:
	docker-compose up -d

down:
	docker-compose down

dev-deps:
	docker-compose up -d postgres redis

migrate-up:
	cd backend && go run cmd/migrator/main.go up

migrate-down:
	cd backend && go run cmd/migrator/main.go down

test:
	cd backend && go test ./... -v
	cd frontend && npm test -- --watchAll=false

clean:
	docker-compose down -v
	rm -rf backend/bin
	rm -rf frontend/.next