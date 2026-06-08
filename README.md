# Cloud Cost Observability & Optimization Hub (CCOH)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub contributors](https://img.shields.io/github/contributors/oseghalep/cloud-cost-optimization-hub)](https://github.com/oseghalep/cloud-cost-optimization-hub/graphs/contributors)
[![First Contributions](https://img.shields.io/badge/first--contributions-welcome-brightgreen)](CONTRIBUTING.md)

**Stop cloud cost surprises. One dashboard for AWS, GCP, and Azure.**

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://cloud-cost-optimization-hub.vercel.app/)

## ✨ Features (v0.1)

- ✅ Multi-cloud ready architecture
- ✅ User authentication (register/login)
- ✅ Professional dashboard UI
- ✅ Mock cost data to demo the platform
- ✅ Docker Compose one-command setup
- ✅ Ready for real AWS/GCP/Azure integration

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/oseghalep/cloud-cost-optimization-hub.git
cd cloud-cost-optimization-hub

# Copy environment variables
cp .env.example .env

# Start everything (database, backend, frontend)
make up

# Wait 30 seconds for services to initialize
# Then open http://localhost:3000


Default credentials (first-time setup):

Go to /register and create an account

Log in at /login

View the dashboard with sample data

🏗️ Architecture
This is a full-stack application with:

Backend: Go 1.21+ with Gin framework

Database: PostgreSQL 15 + TimescaleDB for time-series

Queue: Redis (for background jobs)

Frontend: Next.js 14 + TypeScript + Tailwind CSS

Deployment: Docker Compose (dev) + Helm chart (prod)

📁 Project Structure
text
backend/     - Go API server
frontend/    - Next.js application
docker-compose.yml - Local development environment
Makefile     - Common development commands

🔧 Development Commands
Command	Description
make dev-deps	Start only Postgres & Redis
make up	Start all services
make down	Stop all services
make logs	View container logs
make test	Run all tests

## 🤝 Contributors Wanted
🎁 Contributor Incentive
$50 gift card for the first 50 contributors with a merged PR.
See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

📄 License
Apache 2.0