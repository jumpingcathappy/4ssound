# 4S Sound — Alert Monitoring System

A browser-based alert monitoring dashboard for call centre employees. Receives critical SOS alerts via webhook, plays a looping alarm sound until all alerts are acknowledged, and forwards the payload to an email API.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create a Turso database (free)
1. Sign up at [turso.tech](https://turso.tech)
2. Create a database:
   ```bash
   npm i -g turso
   turso auth login
   turso db create 4ssound
   turso db show 4ssound --url      # copy the URL
   turso db tokens create 4ssound   # copy the auth token
   ```

### 3. Deploy to Vercel
```bash
npm i -g vercel
vercel login
vercel --prod
```

### 4. Set environment variables
In Vercel project settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `WEBHOOK_API_KEY` | API key for webhook authentication |
| `DASHBOARD_PASSWORD` | Password for dashboard login |
| `SESSION_SECRET` | Secret for session token signing |
| `EMAIL_FORWARD_URL` | Email API endpoint |
| `TURSO_DATABASE_URL` | Turso database URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |

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
