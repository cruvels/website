# Deployment Guide (Cruvel + Cru)

## 1) Pre-deploy checklist
- [ ] Replace all mailbox env values with real company emails
- [ ] Set SMTP credentials
- [ ] Enable `ENABLE_LEAD_EMAIL_ALERTS=true`
- [ ] Confirm DNS records for domain/subdomain
- [ ] Run local smoke tests for all forms

## 2) Required environment variables
- `HOST=0.0.0.0`
- `PORT=8080` (or host-provided)
- `CRUVEL_LEADS_EMAIL`
- `CRUVEL_CAREERS_EMAIL`
- `CRU_EARLY_ACCESS_EMAIL`
- `CRU_ADVERTISING_EMAIL`
- `ENABLE_LEAD_EMAIL_ALERTS=true`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `LEAD_RATE_LIMIT_WINDOW_MS`
- `LEAD_RATE_LIMIT_MAX`

## 3) Build/start
```bash
npm install
npm start
```

## 4) Endpoints
- Website: `/` (Cruvel)
- Product: `/cru` (Cru)
- Careers: `/careers`
- Health check: `/api/health`
- Lead API: `POST /api/leads`

## 5) Post-deploy verification
1. Open `https://yourdomain.com/` and submit Cruvel contact form.
2. Open `https://yourdomain.com/careers` and submit careers form.
3. Open `https://yourdomain.com/cru` and submit:
   - early access form
   - advertising form
4. Confirm:
   - alerts arrive by email
   - leads append to `storage/leads.jsonl` on server
   - `/api/health` returns `{ ok: true }`
