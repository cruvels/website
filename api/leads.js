const nodemailer = require('nodemailer');

function getTargetEmail(type) {
  const routing = {
    cruvel_inquiry: process.env.CRUVEL_LEADS_EMAIL,
    cruvel_careers: process.env.CRUVEL_CAREERS_EMAIL || process.env.CRUVEL_LEADS_EMAIL,
    cru_early_access: process.env.CRU_EARLY_ACCESS_EMAIL,
    cru_advertising: process.env.CRU_ADVERTISING_EMAIL,
  };
  return routing[type] || null;
}

function getTitle(type) {
  const titles = {
    cruvel_inquiry: 'Cruvels Client Inquiry',
    cruvel_careers: 'Cruvels Careers Application',
    cru_early_access: 'Cru Early Access Request',
    cru_advertising: 'Cru Advertising Interest',
  };
  return titles[type] || 'Website Lead';
}

function normalizeBody(reqBody) {
  if (!reqBody) return {};
  if (typeof reqBody === 'string') {
    try {
      return JSON.parse(reqBody);
    } catch (_) {
      return {};
    }
  }
  return reqBody;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = normalizeBody(req.body);
  const { type, fields = {}, sourcePage = 'unknown' } = body;

  if (!type || typeof fields !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid payload' });
  }

  const targetEmail = getTargetEmail(type);
  if (!targetEmail) {
    return res.status(400).json({ ok: false, error: 'Missing receiver email mapping for lead type' });
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(500).json({ ok: false, error: 'SMTP environment not configured' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const lines = Object.entries(fields).map(([key, value]) => `${key}: ${String(value).replace(/\n/g, ' ')}`);

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: targetEmail,
      subject: `[Lead Alert] ${getTitle(type)}`,
      text: [
        `${getTitle(type)} received`,
        `Source Page: ${sourcePage}`,
        '',
        ...lines,
      ].join('\n'),
    });

    return res.status(200).json({ ok: true, success: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Email send failed',
      reason: error && error.code ? error.code : 'unknown',
      detail: error && error.message ? error.message : 'SMTP error',
    });
  }
};
