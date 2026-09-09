Nodemailer setup

1. Required .env variables (create a `.env` in project root):

MAIL_SERVICE=           # optional (e.g. Gmail)
MAIL_HOST=              # SMTP host (e.g. smtp.gmail.com)
MAIL_PORT=465           # typical 465 (secure) or 587 (starttls)
MAIL_USER=you@example.com
MAIL_PASS=your_smtp_password_or_app_password
MAIL_FROM="Veloxicity <no-reply@example.com>"

2. Gmail (recommended using App Passwords):
- Enable 2-Step Verification on the Google account.
- Create an App Password for "Mail" and "Other (Custom name)".
- Use the generated 16-character string as `MAIL_PASS` and `MAIL_USER` as your Gmail address.
- Set `MAIL_SERVICE=Gmail` or set `MAIL_HOST=smtp.gmail.com` and `MAIL_PORT=465`.

3. Using other SMTP providers:
- Obtain SMTP host, port, username and password from the provider.
- Use `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`.
- Do not set `MAIL_SERVICE` when using `MAIL_HOST`.

4. Test emails locally:
- Install dependencies: `npm install` (nodemailer is already in package.json)
- Run the test script:

```bash
node scripts/test-mail.js your-email@example.com
```

- The script will attempt to send a login, copy-trade and investment test email.

5. What the app already does:
- The app calls `sendLoginEmail` after successful login.
- When a user starts a copy trade (`POST /user/join-copy`) the app calls `sendCopyTradeEmail`.
- When a user starts a bot investment (`POST /user/join-plan`) the app calls `sendInvestmentEmail`.
- If SMTP is not configured (missing `MAIL_USER`/`MAIL_PASS`) the `mailer.js` will log a warning and skip sending.

6. Troubleshooting:
- If you get authentication errors with Gmail, ensure App Password is used (not your regular password) and 2FA is enabled.
- For providers requiring TLS on port 587, set `MAIL_PORT=587` and `MAIL_HOST` appropriately.
- Check console output for `Copy trade email error:` or `Investment email error:` logs.

7. Optional: Use a testing SMTP service
- For local testing without sending real mail, use services like Mailtrap, Ethereal, or Mailhog and point `MAIL_HOST`/`MAIL_PORT` and credentials to their values.

That's it — after setting the .env correctly, restart the app and try `node scripts/test-mail.js you@domain.com` to verify.

Render deployment checklist

- Add `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, and `MAIL_FROM` under Render Dashboard -> Service -> Environment. Render does not use your local `.env` file.
- For Gmail, use a 16-character Google App Password, not the normal account password. Use port `465` for SSL or port `587` for STARTTLS.
- Set `APP_URL` to the real HTTPS Render URL. Remove any placeholder `RENDER_EXTERNAL_URL` value if you are setting `APP_URL` explicitly.
- Also set a long random `SESSION_SECRET`, `NODE_ENV=production`, and the production `MONGO_URI` in Render.
- Deploy and confirm `Mailer: transporter verified and ready` in the Render logs. Then test signup or login once on the deployed service.
- Rotate any SMTP or database credentials that have ever been committed, pasted into chat, or exposed in a screenshot. Keep `.env` local and never add it to source control.