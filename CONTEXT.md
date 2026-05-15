# 4S Sound — Alert Monitoring System

## Overview
A browser-based alert monitoring dashboard for call centre employees. Receives critical SOS alerts via webhook from an external rule engine, plays a looping alarm sound until all alerts are acknowledged, and forwards the payload to an email API.

## Glossary

| Term | Definition |
|------|-----------|
| **Alert** | A critical notification received via webhook. Always escalated (critical). Contains `issue_alert_id`, base64-encoded `message_data`, and `language_template_map`. |
| **Escalated** | The status of an unacknowledged alert. All incoming alerts start as escalated. |
| **Acknowledged** | The status after a call centre employee dismisses the alert via the dashboard UI. Sound stops only when zero escalated alerts remain. |
| **Message Data** | Base64-encoded JSON within the webhook payload containing device info, coordinates, timestamps, project code, and alert metadata. |
| **Language Template Map** | Go-style template map in the payload. Used to render the alert message in various languages (en-US, zh-CN, zh-HK). |
| **System Link** | A URL linking to the external alert management system. Constructed from a configurable base URL + `issueAlertId`. |
| **Email Forwarding** | Fire-and-forget proxy of the raw webhook payload to a configured email API endpoint. |
| **Polling** | Browser polls the API every 5 seconds to check for new/updated alerts. |

## Architecture

### Docker Deployment (Production)

```
External Alert System ──POST──▶ Nginx LB (:443)
                                       │
                                       └── /ssss-escalation/ ──▶ Node.js App (:3000)
                                                                    ├── Store alert in libSQL/SQLite (status: escalated)
                                                                    └── Forward payload to Email API (fire-and-forget)

Browser ◀──GET poll (5s)──▶ Nginx LB (:443) ──▶ Node.js App ──▶ 🔊 Looping sound
                                  │
Dashboard UI ──POST──▶ Nginx LB ──▶ Node.js App ──▶ Stop sound if none left
```

### Vercel Deployment (UAT)

```
Alert System ──POST──▶ Vercel API (/api/webhook)
                          ├── Store alert in Turso (SQLite) (status: escalated)
                          └── Forward payload to Email API (fire-and-forget)

Browser tab ◀──GET poll (5s)──▶ Vercel API (/api/alerts) ──▶ 🔊 Looping sound
                          │
Dashboard UI ──POST──▶ Vercel API (/api/acknowledge) ──▶ Stop sound if none left
```

## Key Decisions
- **All alerts are critical** — no severity filtering needed
- **Single operator** — one person monitors all alerts
- **Sound loops continuously** until all escalated alerts acknowledged
- **New alerts don't interrupt** the current sound
- **History retained 24 hours** after acknowledgment
- **API key auth** on webhook endpoint (`X-API-Key` header)
- **Simple password auth** on dashboard
- **Tab title flashes** when alerts are active and tab is in background
- **Polling over WebSocket** — simpler, works behind any reverse proxy

### Docker-specific decisions
- **Express server** wraps the Vercel-compatible API handlers
- **libSQL local file** for persistence — no external DB service, data in Docker volume
- **BASE_PATH** env var supports path-prefix deployment behind reverse proxy
- **Nginx terminates TLS** and proxies to the app container over plain HTTP

## Environment Variables

### Docker Deployment

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_PATH` | libSQL database file path | `file:data/ssss-sound.db` |
| `BASE_PATH` | URL path prefix for reverse proxy | (empty = root) |
| `PORT` | Server listen port | `3000` |
| `WEBHOOK_API_KEY` | API key for webhook authentication | (required) |
| `DASHBOARD_PASSWORD` | Password for dashboard login | (required) |
| `SESSION_SECRET` | Secret for session token signing | (required) |
| `EMAIL_FORWARD_URL` | Email API endpoint for payload forwarding | (optional) |

### Vercel Deployment

| Variable | Purpose |
|----------|---------|
| `TURSO_DATABASE_URL` | Turso database connection URL |
| `TURSO_AUTH_TOKEN` | Turso authentication token |
| `WEBHOOK_API_KEY` | API key for webhook authentication |
| `DASHBOARD_PASSWORD` | Password for dashboard login |
| `SESSION_SECRET` | Secret for session token signing |
| `EMAIL_FORWARD_URL` | Email API endpoint for payload forwarding |

## Docker Deployment Guide

### Prerequisites
- Docker and Docker Compose on the target server
- An existing Nginx reverse proxy handling TLS termination

### 1. Deploy the app container

```bash
# Clone the repo and checkout the docker branch
git clone <repo-url> && cd ssss-sound
git checkout docker-deploy

# Create .env from example
cp .env.example .env
# Edit .env with production values
nano .env

# Build and start
docker compose up -d --build
```

### 2. Configure Nginx

Add this location block to your Nginx site config (e.g., `/home/docker/nginx/conf.d/esurvey-api-uat.conf`) **before** the existing `location / { ... }` block:

```nginx
location /ssss-escalation/ {
    proxy_pass http://127.0.0.1:3000/ssss-escalation/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Reload Nginx:
```bash
docker exec esurvey-lb nginx -s reload
```

### 3. Verify

- Dashboard: `https://esurvey-api-uat.emsd.gov.hk/ssss-escalation/`
- Webhook: `POST https://esurvey-api-uat.emsd.gov.hk/ssss-escalation/api/webhook`
- Debug: `https://esurvey-api-uat.emsd.gov.hk/ssss-escalation/api/debug`

### Data Persistence

SQLite data is stored in a Docker named volume (`ssss-sound-data`), mapped to `/app/data` inside the container. The volume persists across container restarts and rebuilds.

### Updating

```bash
git pull
docker compose up -d --build
```

### Logs

```bash
docker compose logs -f ssss-sound
```
