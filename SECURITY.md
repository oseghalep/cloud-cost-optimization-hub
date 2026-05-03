# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Yes    |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please:

**DO NOT** file a public issue.

**DO** email us at: **security@ccoh.io**

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes

We will respond within 48 hours and work to resolve the issue promptly.

## Security Best Practices for Contributors

When contributing code, please ensure:
- No hardcoded secrets or credentials
- Input validation on all user inputs
- SQL injection prevention (use parameterized queries)
- XSS protection
- CSRF protection where applicable

## Data Protection

This tool handles cloud credentials. We recommend:
- Running CCOH in a private network
- Using IAM roles instead of access keys when possible
- Encrypting credentials at rest
- Regular security audits