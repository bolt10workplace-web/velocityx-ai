require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const mailService = process.env.MAIL_SERVICE || process.env.SMTP_SERVICE;
const mailHost = process.env.MAIL_HOST || process.env.SMTP_HOST || (mailService ? undefined : 'smtp.gmail.com');
const mailPort = Number(process.env.MAIL_PORT || process.env.SMTP_PORT || 465);
const mailUser = process.env.MAIL_USER || process.env.SMTP_USER;
const mailPass = process.env.MAIL_PASS || process.env.SMTP_PASS;
const appUrl = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
const defaultImageUrl = 'https://i.imgur.com/hdo1Zvj.png';
const configuredImageUrl = process.env.EMAIL_IMAGE_URL || '';
const imageUrl = configuredImageUrl && !configuredImageUrl.includes('b8aqlNz') ? configuredImageUrl : defaultImageUrl;
let mailFrom = process.env.MAIL_FROM || 'Veloxicity <no-reply@veloxicity.com>';
mailFrom = mailFrom.replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^"(.+)"$/, '$1');

const useNamedMailService = Boolean(mailService && !mailHost);
const transporterOptions = useNamedMailService
  ? { pool: true, maxConnections: 5, connectionTimeout: 10000, greetingTimeout: 5000, socketTimeout: 10000, service: mailService, auth: { user: mailUser, pass: mailPass } }
  : { pool: true, maxConnections: 5, connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 15000, host: mailHost, port: mailPort, secure: mailPort === 465, requireTLS: mailPort === 587, auth: mailUser && mailPass ? { user: mailUser, pass: mailPass } : undefined };

const transporter = nodemailer.createTransport(transporterOptions);
const mailConfigured = Boolean(mailUser && mailPass);
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

if (mailConfigured) {
  console.info('Mailer image configured:', imageUrl);
  transporter.verify()
    .then(() => console.info('Mailer: transporter verified and ready'))
    .catch((error) => console.error('Mailer verify failed:', error.message));
} else {
  console.warn('Mailer disabled: set MAIL_USER and MAIL_PASS in the deployment environment.');
}
const sendMail = async (to, subject, html) => {
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
    } catch (error) {
      console.error(`Mailer failed for ${to}:`, error.message);
      enqueueFailedEmail(to, subject, html, error);
      return false;
    }
  return false;
};

const sendTemplated = (to, subject, title, body, preview) => sendMail(to, subject, layout(title, body, preview));
const money = (amount) => `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const greeting = (name) => `<p style="font-size:18px">Hi ${escapeHtml(name || 'there')},</p>`;
const button = (url, label) => `<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="background:#1769e0;color:#fff;padding:13px 22px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>`;

const sendWelcomeEmail = (email, fullName) => sendTemplated(email, 'Welcome to Veloxicity', 'Welcome to Veloxicity', `${greeting(fullName)}<p>Your account has been created successfully. You can now sign in and manage your account.</p>${button(`${appUrl}/login`, 'Sign in to your account')}<p>Keep your password private and contact support if you did not create this account.</p>`, 'Your Veloxicity account is ready.');
const sendLoginEmail = (email, fullName) => sendTemplated(email, 'New sign-in to your Veloxicity account', 'New sign-in', `${greeting(fullName)}<p>Your Veloxicity account was just used to sign in.</p><p>If this was not you, reset your password and contact support immediately.</p>`, 'A new sign-in was detected on your account.');
const sendCopyTradeEmail = (email, fullName, expertName, amount) => sendTemplated(email, 'Your copy trade has started', 'Copy trade started', `${greeting(fullName)}<p>Your copy trade is now active.</p><p><strong>Expert:</strong> ${escapeHtml(expertName)}<br><strong>Amount:</strong> ${money(amount)}</p>${button(`${appUrl}/user/dashboard`, 'View your dashboard')}`, 'Your copy trade is now active.');
const sendInvestmentEmail = (email, fullName, planName, amount) => sendTemplated(email, 'Your investment has started', 'Investment started', `${greeting(fullName)}<p>Your investment is now active.</p><p><strong>Plan:</strong> ${escapeHtml(planName)}<br><strong>Amount:</strong> ${money(amount)}</p>${button(`${appUrl}/user/dashboard`, 'View your dashboard')}`, 'Your investment is now active.');
const sendTradeEmail = (email, fullName, amount, signal) => sendTemplated(email, 'Trade confirmed', 'Trade confirmed', `${greeting(fullName)}<p>Your trade was processed successfully.</p><p><strong>Amount:</strong> ${money(amount)}${signal ? `<br><strong>Signal:</strong> ${escapeHtml(signal)}` : ''}</p>${button(`${appUrl}/user/dashboard`, 'View your dashboard')}`, 'Your trade was processed successfully.');
const sendDepositEmail = (email, fullName, amount, currency) => sendTemplated(email, 'Deposit request received', 'Deposit received', `${greeting(fullName)}<p>Your deposit request has been received and is awaiting review.</p><p><strong>Amount:</strong> ${money(amount)}<br><strong>Currency:</strong> ${escapeHtml(currency)}</p>`, 'Your deposit request is awaiting review.');
const sendWithdrawalEmail = (email, fullName, amount, method) => sendTemplated(email, 'Withdrawal request received', 'Withdrawal received', `${greeting(fullName)}<p>Your withdrawal request has been received and is awaiting review.</p><p><strong>Amount:</strong> ${money(amount)}<br><strong>Method:</strong> ${escapeHtml(method || 'Selected method')}</p>`, 'Your withdrawal request is awaiting review.');
const sendPasswordResetEmail = (email, fullName, token) => sendTemplated(email, 'Reset your Veloxicity password', 'Reset your password', `${greeting(fullName)}<p>We received a request to reset your password. This link expires in one hour.</p>${button(`${appUrl}/reset-password/${encodeURIComponent(token)}`, 'Reset password')}<p>If you did not request this, you can safely ignore this email.</p>`, 'Your password reset link is ready.');

module.exports = { sendWelcomeEmail, sendLoginEmail, sendCopyTradeEmail, sendInvestmentEmail, sendTradeEmail, sendDepositEmail, sendWithdrawalEmail, sendPasswordResetEmail };
