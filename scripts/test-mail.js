require('dotenv').config();
const path = require('path');
const {
  sendWelcomeEmail,
  sendLoginEmail,
  sendCopyTradeEmail,
  sendInvestmentEmail,
  sendTradeEmail,
  sendDepositEmail,
  sendWithdrawalEmail,
  sendPasswordResetEmail
} = require(path.join(__dirname, '..', 'mailer'));

async function run() {
  const to = process.argv[2] || process.env.TEST_MAIL_TO;
  if (!to) {
    console.error('Usage: node scripts/test-mail.js recipient@example.com');
    process.exit(1);
  }

  try {
    console.log('Sending welcome test email to', to);
    if (!await sendWelcomeEmail(to, 'Test User')) throw new Error('SMTP is not configured or rejected the welcome message');
    console.log('Welcome email sent');

    console.log('Sending login test email to', to);
    if (!await sendLoginEmail(to, 'Test User')) throw new Error('SMTP rejected the login message');
    console.log('Login email sent');

    console.log('Sending copy trade test email to', to);
    if (!await sendCopyTradeEmail(to, 'Test User', 'Expert Alpha', 250)) throw new Error('SMTP rejected the copy-trade message');
    console.log('Copy trade email sent');

    console.log('Sending investment test email to', to);
    if (!await sendInvestmentEmail(to, 'Test User', 'Starter Plan', 500)) throw new Error('SMTP rejected the investment message');
    console.log('Investment email sent');

    console.log('Sending trade test email to', to);
    if (!await sendTradeEmail(to, 'Test User', 100, 'BUY')) throw new Error('SMTP rejected the trade message');
    console.log('Trade email sent');

    console.log('Sending deposit test email to', to);
    if (!await sendDepositEmail(to, 'Test User', 500, 'USDT')) throw new Error('SMTP rejected the deposit message');
    console.log('Deposit email sent');

    console.log('Sending withdrawal test email to', to);
    if (!await sendWithdrawalEmail(to, 'Test User', 100, 'Bitcoin')) throw new Error('SMTP rejected the withdrawal message');
    console.log('Withdrawal email sent');

    console.log('Sending password reset test email to', to);
    if (!await sendPasswordResetEmail(to, 'Test User', 'test-token')) throw new Error('SMTP rejected the password-reset message');
    console.log('Password reset email sent');

    console.log('All test emails sent successfully');
  } catch (err) {
    console.error('Test mail error', err);
    process.exit(1);
  }
}

run();
