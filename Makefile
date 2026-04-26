.PHONY: build backend frontend test

build: backend frontend

backend:
	cd backend && go build ./...

frontend:
	cd frontend && npm install && npm run build

test:
	cd backend && go test ./...
	cd frontend && npm test
