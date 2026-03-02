# Lead Handling (Local Only, Not Deployed)

This project includes a local API endpoint for form submissions.

## What is saved
- Cruvel inquiries (`cruvel_inquiry`)
- Cruvel careers applications (`cruvel_careers`)
- Cru early access (`cru_early_access`)
- Cru advertising interest (`cru_advertising`)

All requests are written to:
- `storage/leads.jsonl`

## 1) Install and run locally
```bash
cd /Users/admin/Dev/website
npm install
npm start
```

Then open:
- `http://localhost:8080/` (Cruvel)
- `http://localhost:8080/cru` (Cru)

## 2) Configure environment file
Create `.env.local` in `/Users/admin/Dev/website` and copy values from `.env.leads.example`.

Important:
- Keep `ENABLE_LEAD_EMAIL_ALERTS=false` until SMTP is configured.
- Never commit `.env.local`.

## 3) Lead routing mailboxes
Set these for final routing:
- `CRUVEL_LEADS_EMAIL`
- `CRUVEL_CAREERS_EMAIL`
- `CRU_EARLY_ACCESS_EMAIL`
- `CRU_ADVERTISING_EMAIL`

## 4) SMTP linking (when ready)
Set these values in `.env.local`:
- `ENABLE_LEAD_EMAIL_ALERTS=true`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE` (`true` for SSL 465, `false` for STARTTLS 587)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `LEAD_RATE_LIMIT_WINDOW_MS`
- `LEAD_RATE_LIMIT_MAX`
- `HOST` (`127.0.0.1` for local, `0.0.0.0` on most hosting platforms)

Restart server after editing env:
```bash
npm start
```

## 5) Behavior after enabling SMTP
- Leads are still stored in `storage/leads.jsonl`.
- API also attempts to send alert emails to target mailboxes.
- If email fails, lead is still stored safely.

## 6) Health check endpoint
- `GET /api/health` returns service status for deployment monitoring.

## 7) Security notes
- Use app passwords or provider API keys, not personal account passwords.
- Rotate SMTP credentials periodically.
- Restrict sender domain with SPF/DKIM/DMARC when you deploy.
