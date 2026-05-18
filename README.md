# 4S Sound — Alert Monitoring System

A browser-based alert monitoring dashboard for call centre employees. Receives critical SOS alerts via webhook, plays a looping alarm sound until all alerts are acknowledged, and forwards the payload to an email API.

## Environments

| Environment | Domain | Deployment | Server |
|-------------|--------|------------|--------|
| **Production** | `https://esurvey-api-uat.emsd.gov.hk/ssss-escalation/` | Docker (Nginx + Node.js container) | `UATESURVEYLBP` |
| **UAT** | `https://4ssound.vercel.app` | Vercel (Turso DB) | Vercel managed |

### Production endpoints

| Endpoint | URL |
|----------|-----|
| Dashboard | `https://esurvey-api-uat.emsd.gov.hk/ssss-escalation/` |
| Webhook API | `POST https://esurvey-api-uat.emsd.gov.hk/ssss-escalation/api/webhook` |
| Debug | `https://esurvey-api-uat.emsd.gov.hk/ssss-escalation/api/debug` |

### UAT endpoints

| Endpoint | URL |
|----------|-----|
| Dashboard | `https://4ssound.vercel.app` |
| Webhook API | `POST https://4ssound.vercel.app/api/webhook` |

## Deployment

### Option A: Docker (Recommended for Production)

The Docker deployment uses a Node.js container with local SQLite storage, deployed behind an Nginx reverse proxy that handles TLS termination.

#### Prerequisites
- Docker and Docker Compose on the target server
- An Nginx reverse proxy handling TLS termination

#### 1. Clone the repo

```bash
git clone <repo-url>
cd ssss-sound
git checkout docker-deploy
```

If the server is behind a corporate proxy, configure git to bypass it for internal hosts:

```bash
# Bypass proxy for internal GitLab
git config --global http."http://<internal-gitlab-host>/".proxy ""
```

#### 2. Create the `.env` file

```bash
cp .env.example .env
```

Edit `.env` with the following **required** values:

| Variable | Description |
|----------|-------------|
| `WEBHOOK_API_KEY` | API key for webhook authentication (`X-API-Key` header) |
| `DASHBOARD_PASSWORD` | Password for dashboard login |
| `SESSION_SECRET` | Secret for session token signing (generate with `openssl rand -hex 32`) |

And one **optional** value:

| Variable | Description |
|----------|-------------|
| `EMAIL_FORWARD_URL` | Email API endpoint for webhook payload forwarding |

> The remaining variables (`PORT`, `BASE_PATH`, `DATABASE_PATH`) are set in `docker-compose.yml` and should not need changing.

#### 3. Build and start the container

If your server **has direct internet access**:

```bash
docker compose up -d --build
```

If your server is **behind a corporate proxy**, pass the proxy as build args:

```bash
docker compose build --no-cache \
  --build-arg HTTP_PROXY='http://<user>:<pass>@<proxy-host>:<port>' \
  --build-arg HTTPS_PROXY='http://<user>:<pass>@<proxy-host>:<port>'
docker compose up -d
```

> **Important:** If you rebuild after a failed build, always use `--no-cache`. Docker caches failed `npm ci` layers silently, which results in missing `node_modules` and `Cannot find module` errors at runtime.

#### 4. Verify the container is running

```bash
# Check the container status
docker ps

# Test the app directly (bypass proxy if needed)
curl --noproxy '*' http://127.0.0.1:3000/ssss-escalation/

# Check logs
docker compose logs -f ssss-sound
```

You should see the login page HTML and `Server running on port 3000` in the logs.

#### 5. Configure Nginx

Add a `location` block to your Nginx site config **before** the existing `location / { ... }` block:

```nginx
location /ssss-escalation/ {
    proxy_pass http://<host-ip>:3000/ssss-escalation/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

> **Important:** If your Nginx runs inside a Docker container, `127.0.0.1` refers to the container itself — not the host. Use the Docker bridge gateway IP instead:
>
> ```bash
> # Find the gateway IP
> docker network inspect bridge | grep Gateway
> # e.g., "Gateway": "172.17.0.1"
> ```
>
> Then use `proxy_pass http://172.17.0.1:3000/ssss-escalation/;` in your Nginx config.

Test and reload Nginx:

```bash
docker exec esurvey-lb nginx -t
docker exec esurvey-lb nginx -s reload
```

#### 6. Verify the full stack

Access the dashboard in your browser:

| Endpoint | URL |
|----------|-----|
| Dashboard | `https://esurvey-api-uat.emsd.gov.hk/ssss-escalation/` |
| Webhook | `POST https://esurvey-api-uat.emsd.gov.hk/ssss-escalation/api/webhook` |
| Debug | `https://esurvey-api-uat.emsd.gov.hk/ssss-escalation/api/debug` |

#### Data persistence

SQLite data is stored in a Docker named volume (`ssss-sound-data`), mapped to `/app/data` inside the container. The volume persists across container restarts and rebuilds.

#### Updating

```bash
cd ssss-sound
git pull
docker compose up -d --build
```

If behind a corporate proxy, include the `--build-arg` flags as shown in step 3.

#### Useful commands

```bash
docker compose logs -f ssss-sound    # Follow container logs
docker compose ps                    # Check container status
docker compose restart ssss-sound   # Restart the app
docker exec esurvey-lb nginx -t      # Test Nginx config syntax
```

---

### Option B: Vercel (UAT / Development)

Uses Turso (managed SQLite) as the database.

#### 1. Install dependencies

```bash
npm install
```

#### 2. Create a Turso database (free)

1. Sign up at [turso.tech](https://turso.tech)
2. Create a database:
   ```bash
   npm i -g turso
   turso auth login
   turso db create 4ssound
   turso db show 4ssound --url      # copy the URL
   turso db tokens create 4ssound   # copy the auth token
   ```

#### 3. Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

#### 4. Set environment variables

In Vercel project settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `WEBHOOK_API_KEY` | API key for webhook authentication |
| `DASHBOARD_PASSWORD` | Password for dashboard login |
| `SESSION_SECRET` | Secret for session token signing |
| `EMAIL_FORWARD_URL` | Email API endpoint |
| `TURSO_DATABASE_URL` | Turso database URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |

---

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
