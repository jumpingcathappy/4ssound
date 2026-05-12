# ADR 0001: Polling over WebSocket for real-time browser updates

## Status
Accepted

## Context
The dashboard needs to display alerts in near-real-time when they arrive via webhook. Vercel's serverless architecture cannot maintain persistent WebSocket connections — each function invocation handles one request and terminates.

Options considered:
1. **Polling** — Browser GETs `/api/alerts` every 3 seconds
2. **WebSocket via third-party** (Pusher, Supabase Realtime) — External push service
3. **Server-Sent Events** — Vercel serverless functions have timeouts (10s hobby tier), making persistent SSE unreliable

## Decision
Use polling at 3-second intervals.

## Consequences
- **Pros**: No additional services, no extra cost, simple implementation, works reliably on Vercel
- **Cons**: Up to 3-second delay between alert arrival and display; ~28k KV reads/day per connected browser (within free tier limits for single user)
- **Acceptable because**: Call centre alerts are not sub-second latency critical; 3-second delay is tolerable
