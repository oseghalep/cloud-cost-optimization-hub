# Contributing to Cloud Cost Optimization Hub

Thanks for your interest! We're building an open-source multi-cloud cost optimization tool.

## 🎁 $50 Gift Card Incentive

To build momentum, we're offering **$50 Amazon or GitHub gift cards** to the **first 100 contributors** who have a non-trivial pull request merged.

### Eligibility:
- PR must be merged into `main`
- Must add meaningful code, docs, or tests (not just typo fixes)
- First-time contributor to this repo
- Follows the guidelines below

**How to claim:** After your PR merges, the maintainer will DM you on GitHub within 5 business days.

---

## Quick Start

### Prerequisites
- Go 1.21+
- Node.js 18+
- Docker + Docker Compose
- Make (optional)

### Setup

```bash
# Clone your fork
git clone https://github.com/oseghalep/cloud-cost-optimization-hub.git
cd cloud-cost-optimization-hub

# Copy environment variables
cp .env.example .env

# Start dependencies (Postgres + Redis)
docker-compose up -d postgres redis

# Run migrations (coming soon)
# make migrate-up

# Start backend
cd backend
go mod download
go run cmd/api/main.go

# Start frontend (new terminal)
cd frontend
npm install
npm run dev