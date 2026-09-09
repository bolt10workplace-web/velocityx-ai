require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const getEnv = (...names) => {
  const value = names.map((name) => process.env[name]).find((item) => item !== undefined && item !== '');
  return value === undefined ? '' : String(value).trim().replace(/^(['"])(.*)\1$/, '$2');
};
const mailService = getEnv('MAIL_SERVICE', 'SMTP_SERVICE');
const mailHost = getEnv('MAIL_HOST', 'SMTP_HOST') || (mailService ? undefined : 'smtp.gmail.com');
const configuredPort = Number.parseInt(getEnv('MAIL_PORT', 'SMTP_PORT') || '587', 10);
const mailPort = Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort < 65536 ? configuredPort : 587;
const mailUser = getEnv('MAIL_USER', 'SMTP_USER');
const rawMailPass = getEnv('MAIL_PASS', 'SMTP_PASS');
const mailPass = /gmail/i.test(`${mailService} ${mailHost}`) ? rawMailPass.replace(/\s+/g, '') : rawMailPass;
const appUrl = (getEnv('APP_URL', 'RENDER_EXTERNAL_URL') || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const defaultImageUrl = 'https://i.imgur.com/hdo1Zvj.png';
const configuredImageUrl = process.env.EMAIL_IMAGE_URL || '';
const imageUrl = configuredImageUrl && !configuredImageUrl.includes('b8aqlNz') ? configuredImageUrl : defaultImageUrl;
let mailFrom = getEnv('MAIL_FROM') || mailUser || 'Veloxicity <no-reply@veloxicity.com>';
mailFrom = mailFrom.replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^"(.+)"$/, '$1');
const resendApiKey = getEnv('RESEND_API_KEY');
const resendFrom = getEnv('RESEND_FROM') || mailFrom;

const useNamedMailService = Boolean(mailService && !mailHost);
const transporterOptions = useNamedMailService
  ? { pool: true, maxConnections: 5, connectionTimeout: 10000, greetingTimeout: 5000, socketTimeout: 10000, service: mailService, auth: { user: mailUser, pass: mailPass } }
  : { pool: true, maxConnections: 5, connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 15000, host: mailHost, port: mailPort, secure: mailPort === 465, requireTLS: mailPort === 587, auth: mailUser && mailPass ? { user: mailUser, pass: mailPass } : undefined };

const transporter = nodemailer.createTransport(transporterOptions);
const mailConfigured = Boolean(mailUser && mailPass);
const resendConfigured = Boolean(resendApiKey && resendFrom);
const mailUserLabel = mailUser ? `${mailUser.slice(0, 2)}***${mailUser.slice(-Math.min(12, mailUser.length - 2))}` : 'missing';
const dataDir = path.join(__dirname, 'data');
const failedEmailsPath = path.join(dataDir, 'failed_emails.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const textFromHtml = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const layout = (title, content, preview) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#172033">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preview || title)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fa;padding:36px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e3e9f0;border-radius:10px;overflow:hidden">
<tr><td style="background:#10243d;padding:28px 32px;text-align:center;border-bottom:4px solid #1a9bd1"><img src="${escapeHtml(imageUrl)}" alt="Veloxicity" width="180" style="display:block;width:180px;max-width:100%;height:auto;margin:0 auto 14px"><div style="color:#fff;font-size:12px;font-weight:bold;letter-spacing:2px">VELOCITYX AI</div></td></tr>
<tr><td style="padding:34px 36px 30px;line-height:1.65;font-size:15px">${content}</td></tr>
<tr><td style="border-top:1px solid #e8edf3;background:#f8fafc;padding:22px 32px;text-align:center;color:#667085;font-size:12px;line-height:1.6">This is an automated message from VelocityX AI.<br>Please do not reply to this email.<br>&copy; ${new Date().getFullYear()} VelocityX AI</td></tr>
</table></td></tr></table></body></html>`;
const enqueueFailedEmail = (to, subject, html, error) => {
  try {
    const records = fs.existsSync(failedEmailsPath) ? JSON.parse(fs.readFileSync(failedEmailsPath, 'utf8') || '[]') : [];
    records.push({ to, subject, html, error: error?.message || String(error), createdAt: new Date().toISOString() });
    fs.writeFileSync(failedEmailsPath, JSON.stringify(records.slice(-500), null, 2));
  } catch (writeError) {
    console.error('Failed to queue email:', writeError.message);
  }
};

if (resendConfigured) {
  console.info('Mailer: Resend API configured', { from: resendFrom });
} else if (mailConfigured) {
  console.info('Mailer configuration:', {
    mode: useNamedMailService ? 'service' : 'smtp',
    service: useNamedMailService ? mailService : undefined,
    host: useNamedMailService ? undefined : mailHost,
    port: useNamedMailService ? undefined : mailPort,
    user: mailUserLabel,
    from: mailFrom
  });
  console.info('Mailer image configured:', imageUrl);
  transporter.verify()
    .then(() => console.info('Mailer: transporter verified and ready'))
    .catch((error) => console.error('Mailer verify failed:', error.message));
} else {
  console.warn('Mailer disabled: set RESEND_API_KEY and RESEND_FROM, or MAIL_USER and MAIL_PASS in the deployment environment.');
}
const sendMail = async (to, subject, html) => {
  if (resendConfigured) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: resendFrom, to: [to], subject, html, text: textFromHtml(html) })
      });
      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Resend ${response.status}: ${details.slice(0, 300)}`);
      }
      return true;
    } catch (error) {
      console.error(`Mailer failed for ${to}:`, error.message);
      enqueueFailedEmail(to, subject, html, error);
      return false;
    }
  }
  if (!mailConfigured) {
    return false;
  }
  try {
      const mailOptions = { from: mailFrom, to, subject, text: textFromHtml(html), html };
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try { await transporter.sendMail(mailOptions); return true; }
        catch (error) {
          if (attempt === 3) throw error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 750));
        }
      }
