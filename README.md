# 4S Sound — Alert Monitoring System

A browser-based alert monitoring dashboard for call centre employees. Receives critical SOS alerts via webhook, plays a looping alarm sound until all alerts are acknowledged, and forwards the payload to an email API.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Deploy to Vercel
```bash
npm i -g vercel
vercel login
vercel --prod
```

### 3. Enable Vercel KV
In your Vercel project dashboard, go to **Storage** → **Create Database** → **KV (Redis)**. Link it to your project.

### 4. Set environment variables
In Vercel project settings → Environment Variables, set:

| Variable | Description |
|----------|-------------|
| `WEBHOOK_API_KEY` | API key for webhook authentication |
| `DASHBOARD_PASSWORD` | Password for dashboard login |
| `SESSION_SECRET` | Secret for session token signing |
| `EMAIL_FORWARD_URL` | Email API endpoint |

## Usage

### Receiving alerts
POST to `/api/webhook` with header `X-API-Key: <your-key>` and JSON body containing `issue_alert_id`, `message_data` (base64), and `language_template_map`.

### Dashboard
Open the deployed URL in a browser and log in with the dashboard password. The alarm will sound when active alerts exist and stop only when all are acknowledged.

## Sound options
- **Pulse Alarm** — beep-beep-beep pattern (default)
- **Continuous** — steady high-pitched tone
- **Siren** — rising/falling tone
- **Chime** — repeating chime
- **Custom** — upload your own audio file
