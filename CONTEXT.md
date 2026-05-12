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
| **Polling** | Browser polls the API every 3 seconds to check for new/updated alerts. Chosen over WebSocket for simplicity. |

## Architecture

```
Alert System ──POST──▶ Vercel API (/api/webhook)
                          ├── Store alert in Vercel KV (status: escalated)
                          └── Forward payload to Email API (fire-and-forget)

Browser tab ◀──GET poll (3s)──▶ Vercel API (/api/alerts) ──▶ 🔊 Looping sound
                          │
Dashboard UI ──POST──▶ Vercel API (/api/acknowledge) ──▶ Stop sound if none left
```

## Key Decisions
- **All alerts are critical** — no severity filtering needed
- **Single operator** — one person monitors all alerts
- **Sound loops continuously** until all escalated alerts acknowledged
- **New alerts don't interrupt** the current sound
- **History retained 24 hours** after acknowledgment
- **API key auth** on webhook endpoint
- **Simple password auth** on dashboard
- **Tab title flashes** when alerts are active and tab is in background

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `WEBHOOK_API_KEY` | API key for webhook authentication |
| `DASHBOARD_PASSWORD` | Password for dashboard login |
| `SESSION_SECRET` | Secret for session token signing |
| `EMAIL_FORWARD_URL` | Email API endpoint for payload forwarding |
| `KV_REST_API_URL` | Vercel KV connection (auto-configured) |
| `KV_REST_API_TOKEN` | Vercel KV token (auto-configured) |
