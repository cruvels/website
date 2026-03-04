const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');

const ROOT = __dirname;
const STORAGE_DIR = path.join(ROOT, 'storage');
const LEADS_FILE = path.join(STORAGE_DIR, 'leads.jsonl');
const ENV_FILES = ['.env.local', '.env'];

function loadEnvFiles() {
  ENV_FILES.forEach((fileName) => {
    const filePath = path.join(ROOT, fileName);
    if (!fs.existsSync(filePath)) {
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        return;
      }

      const key = trimmed.slice(0, eqIndex).trim();
      const rawValue = trimmed.slice(eqIndex + 1).trim();
      const unquoted = rawValue.replace(/^['"]|['"]$/g, '');

      if (!process.env[key]) {
        process.env[key] = unquoted;
      }
    });
  });
}

loadEnvFiles();

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const EMAIL_ROUTING = {
  cruvel_inquiry: process.env.CRUVEL_LEADS_EMAIL || null,
  cruvel_careers: process.env.CRUVEL_CAREERS_EMAIL || process.env.CRUVEL_LEADS_EMAIL || null,
  cru_early_access: process.env.CRU_EARLY_ACCESS_EMAIL || null,
  cru_advertising: process.env.CRU_ADVERTISING_EMAIL || null,
};

const EMAIL_ALERTS_ENABLED = String(process.env.ENABLE_LEAD_EMAIL_ALERTS || 'false').toLowerCase() === 'true';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || '';
const LEAD_RATE_LIMIT_WINDOW_MS = Number(process.env.LEAD_RATE_LIMIT_WINDOW_MS || 60_000);
const LEAD_RATE_LIMIT_MAX = Number(process.env.LEAD_RATE_LIMIT_MAX || 8);
const leadRequestsByIp = new Map();

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
  });
  res.end(JSON.stringify(data));
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function isValidLead(body) {
  if (!body || typeof body !== 'object') return false;
  if (!['cruvel_inquiry', 'cruvel_careers', 'cru_early_access', 'cru_advertising'].includes(body.type)) return false;
  if (!body.fields || typeof body.fields !== 'object') return false;

  const requiredByType = {
    cruvel_inquiry: ['full_name', 'work_email', 'company', 'project_brief'],
    cruvel_careers: ['full_name', 'email', 'role_interest', 'profile_url', 'note'],
    cru_early_access: ['full_name', 'email', 'access_track'],
    cru_advertising: ['organization_name', 'work_email', 'campaign_objective', 'interest_type'],
  };

  const required = requiredByType[body.type];
  return required.every((key) => {
    const value = body.fields[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function mapLeadTypeToTitle(type) {
  const map = {
    cruvel_inquiry: 'Cruvel Client Inquiry',
    cruvel_careers: 'Cruvel Careers Application',
    cru_early_access: 'Cru Early Access Request',
    cru_advertising: 'Cru Advertising Interest',
  };
  return map[type] || 'Lead Submission';
}

function sanitizeForText(input) {
  return String(input).replace(/\r?\n/g, ' ').trim();
}

async function sendLeadEmail(record) {
  if (!EMAIL_ALERTS_ENABLED) {
    return { sent: false, reason: 'disabled' };
  }

  if (!record.targetEmail) {
    return { sent: false, reason: 'missing_target_email' };
  }

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    return { sent: false, reason: 'missing_smtp_config' };
  }

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (error) {
    return { sent: false, reason: 'nodemailer_not_installed' };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const lines = Object.entries(record.fields).map(([key, value]) => `- ${key}: ${sanitizeForText(value)}`);
  const text = [
    `${mapLeadTypeToTitle(record.type)} received`,
    '',
    `Lead ID: ${record.id}`,
    `Created At: ${record.createdAt}`,
    `Type: ${record.type}`,
    `Source Page: ${record.sourcePage}`,
    '',
    'Submitted Fields:',
    ...lines,
  ].join('\n');

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: record.targetEmail,
      subject: `[Lead Alert] ${mapLeadTypeToTitle(record.type)}`,
      text,
    });
    return { sent: true, reason: 'ok' };
  } catch (error) {
    return {
      sent: false,
      reason: `smtp_error:${error && error.code ? error.code : 'unknown'}`,
      detail: error && error.message ? error.message : 'SMTP send failed',
    };
  }
}

async function handleLeadSubmission(req, res) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
  const now = Date.now();
  const windowStart = now - LEAD_RATE_LIMIT_WINDOW_MS;
  const recent = (leadRequestsByIp.get(ip) || []).filter((ts) => ts > windowStart);
  if (recent.length >= LEAD_RATE_LIMIT_MAX) {
    return sendJson(res, 429, { ok: false, error: 'Too many requests. Please try again later.' });
  }
  recent.push(now);
  leadRequestsByIp.set(ip, recent);

  parseJsonBody(req)
    .then(async (body) => {
      if (!isValidLead(body)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid lead payload' });
      }

      const record = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        type: body.type,
        sourcePage: body.sourcePage || 'unknown',
        targetEmail: EMAIL_ROUTING[body.type],
        fields: body.fields,
      };

      fs.mkdirSync(STORAGE_DIR, { recursive: true });
      fs.appendFileSync(LEADS_FILE, JSON.stringify(record) + '\n', 'utf8');
      const emailStatus = await sendLeadEmail(record);

      return sendJson(res, 201, {
        ok: true,
        id: record.id,
        stored: true,
        deliveryConfigured: Boolean(record.targetEmail),
        emailAlertsEnabled: EMAIL_ALERTS_ENABLED,
        emailStatus,
        message: record.targetEmail
          ? emailStatus.sent
            ? `Lead stored and emailed to ${record.targetEmail}.`
            : `Lead stored. Email not sent (${emailStatus.reason}).`
          : 'Lead stored locally. Configure email routing env vars after company registration.',
      });
    })
    .catch((error) => {
      sendJson(res, 400, { ok: false, error: error.message || 'Bad request' });
    });
}

function filePathFromUrlPath(urlPath) {
  const cleanPolicyRoutes = {
    '/cru-policies/privacy-policy': 'cru-policies/privacy-policy.html',
    '/cru-policies/terms-of-service': 'cru-policies/terms-of-service.html',
    '/cru-policies/community-guidelines': 'cru-policies/community-guidelines.html',
    '/cru-policies/content-policy': 'cru-policies/content-policy.html',
    '/cru-policies/ai-ethics-moderation-policy': 'cru-policies/ai-ethics-moderation-policy.html',
    '/cru-policies/copyright-takedown-policy': 'cru-policies/copyright-takedown-policy.html',
    '/cru-policies/minor-protection-policy': 'cru-policies/minor-protection-policy.html',
    '/cru-policies/political-advertising-policy': 'cru-policies/political-advertising-policy.html',
    '/cru-policies/grievance-redressal': 'cru-policies/grievance-redressal.html',
    '/cru-policies/refund-payment-policy': 'cru-policies/refund-payment-policy.html',
    '/cru-policies/data-retention-policy': 'cru-policies/data-retention-policy.html',
    '/cru-policies/transparency-accountability-policy': 'cru-policies/transparency-accountability-policy.html',
  };
  const normalizedPath = urlPath.replace(/\/+$/, '') || '/';

  if (normalizedPath === '/') return path.join(ROOT, 'index.html');
  if (normalizedPath === '/cru') return path.join(ROOT, 'cru-public.html');
  if (normalizedPath === '/careers') return path.join(ROOT, 'careers.html');
  if (normalizedPath === '/legal') return path.join(ROOT, 'legal.html');
  if (normalizedPath === '/privacy') return path.join(ROOT, 'privacy.html');
  if (normalizedPath === '/compliance') return path.join(ROOT, 'compliance.html');
  if (cleanPolicyRoutes[normalizedPath]) return path.join(ROOT, cleanPolicyRoutes[normalizedPath]);

  // Also support direct policy .html URLs on local server.
  if (normalizedPath.startsWith('/cru-policies/') && normalizedPath.endsWith('.html')) {
    return path.join(ROOT, normalizedPath.replace(/^\//, ''));
  }

  const unsafe = path
    .normalize(decodeURIComponent(normalizedPath))
    .replace(/^([.][.][/\\])+/, '')
    .replace(/^[/\\]+/, '');
  return path.join(ROOT, unsafe);
}

function serveStatic(req, res, pathname) {
  const filePath = filePathFromUrlPath(pathname);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || 'application/octet-stream';

    applySecurityHeaders(res);
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && url.pathname === '/api/leads') {
    return handleLeadSubmission(req, res);
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      service: 'cruvel-website',
      uptimeSeconds: Math.round(process.uptime()),
      emailAlertsEnabled: EMAIL_ALERTS_ENABLED,
    });
  }

  if (req.method === 'GET') {
    return serveStatic(req, res, url.pathname);
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`Local website server running at http://${HOST}:${PORT}`);
  console.log(`Lead storage file: ${LEADS_FILE}`);
  console.log(`Email alerts enabled: ${EMAIL_ALERTS_ENABLED ? 'yes' : 'no'}`);
});
