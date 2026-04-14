# Cloud Cost Observability & Optimization Hub (CCOH)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Stop cloud cost surprises. One dashboard for AWS, GCP, and Azure.**

CCOH is an open-source, self-hosted platform that provides unified visibility into multi-cloud spending with actionable optimization recommendations.

## 🎯 Why This Project Matters

Companies waste 30-40% of cloud spend on idle or oversized resources. CCOH helps you find and fix that waste.

## ✨ MVP Features

- Connect AWS, GCP, and Azure accounts
- Unified dashboard showing all cloud costs
- Cost breakdown by service, region, and tag
- Automated recommendations (rightsizing, orphaned resources)
- Email alerts for cost anomalies

## 🚀 Quick Start

```bash
git clone https://github.com/oseghalep/cloud-cost-optimization-hub.git
cd cloud-cost-optimization-hub
cp .env.example .env
# Edit .env with your cloud credentials
make up