const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { checkAuthenticated, checkNotAuthenticated } = require('../middleware/auth');
const { getCollection } = require('../db');
const { sendWelcomeEmail, sendLoginEmail, sendPasswordResetEmail } = require('../mailer');

const router = express.Router();
const usersCollection = () => getCollection('users');
const referralsCollection = () => getCollection('referrals');
const normalize = (value) => (value || '').toString().trim().toLowerCase();

const findUserByIdentity = async (identity) => {
  const lower = normalize(identity);
  if (!lower) return null;
  const users = await usersCollection();
  return users.findOne({ $or: [{ emailLower: lower }, { usernameLower: lower }] });
};

const validateSignup = ({ username, fullName, email, password, country }) => {
  if (!username || !fullName || !email || !password || !country) return 'All fields are required';
  if (password.length < 8 || !/[A-Z]/.test(password)) return 'Password must be at least 8 characters and include an uppercase letter';
  return null;
};

const createUser = async (body) => {
  const { username, fullName, email, phone, password, country } = body;
  const users = await usersCollection();
  const emailLower = normalize(email);
  const usernameLower = normalize(username);
  const existingUser = await users.findOne({ $or: [{ emailLower }, { usernameLower }] });
  if (existingUser) return { error: 'Email or username already registered' };

  const newUser = {
    id: uuidv4(), username, usernameLower, fullName, email, emailLower,
    phone: phone || '', password: await bcrypt.hash(password, 10), country,
    role: 'user', status: 'active', balance: 0, referralEarnings: 0,
    referralsCount: 0, referrals: [], canTrade: false, createdAt: new Date().toISOString()
  };
  await users.insertOne(newUser);

  const referrerId = body.referrer || body.referrerId;
  if (referrerId) {
    const referrer = await users.findOne({ id: referrerId });
    const referrals = await referralsCollection();
    const existingReferral = await referrals.findOne({ referredId: newUser.id });
    if (referrer && referrer.id !== newUser.id && !existingReferral) {
      const bonus = 10;
      await users.updateOne({ id: referrerId }, {
        $inc: { referralsCount: 1, referralEarnings: bonus, balance: bonus },
        $push: { referrals: newUser.id }
      });
      await referrals.insertOne({ id: uuidv4(), referrerId, referredId: newUser.id, amount: bonus, type: 'signup', createdAt: new Date().toISOString() });
      await users.updateOne({ id: newUser.id }, { $set: { referredBy: referrerId } });
    }
  }
  return { user: newUser };
};

router.get('/ref/:referrerId', (req, res) => {
  const referrerId = String(req.params.referrerId || '').trim();
  return res.redirect(`/signup?ref=${encodeURIComponent(referrerId)}`);
});

router.get('/signup', checkNotAuthenticated, (req, res) => res.render('auth/signup', { error: null }));

router.post('/signup', checkNotAuthenticated, async (req, res) => {
  const error = validateSignup(req.body);
  if (error) return res.render('auth/signup', { error, formData: req.body });
  try {
    const result = await createUser(req.body);
    if (result.error) return res.render('auth/signup', { error: result.error, formData: req.body });
    sendWelcomeEmail(result.user.email, result.user.fullName).catch((err) => console.error('Welcome email error:', err));
    req.session.flashMessage = 'Account created successfully! Please log in.';
    return res.redirect('/login');
  } catch (err) {
    console.error('Signup error:', err);
    return res.render('auth/signup', { error: 'An error occurred. Please try again.', formData: req.body });
  }
});

router.post('/api/auth/signup', checkNotAuthenticated, async (req, res) => {
  const error = validateSignup(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const result = await createUser(req.body);
    if (result.error) return res.status(409).json({ error: result.error });
    sendWelcomeEmail(result.user.email, result.user.fullName).catch((err) => console.error('Welcome email error:', err));
    req.session.userId = result.user.id;
    return res.status(201).json({ success: true, redirect: '/user/dashboard', user: {
      id: result.user.id, username: result.user.username, email: result.user.email,
      country: result.user.country, createdAt: result.user.createdAt, status: result.user.status
    } });
  } catch (err) {
    console.error('API signup error:', err);
    return res.status(500).json({ error: 'An error occurred' });
  }
});

router.get('/login', checkNotAuthenticated, (req, res) => {
  const message = req.session.flashMessage;
  req.session.flashMessage = null;
  res.render('auth/login', { error: null, message });
});

router.get('/forgot-password', checkNotAuthenticated, (req, res) => {
  res.render('auth/forgot-password', { error: null, message: null });
});

router.post('/forgot-password', checkNotAuthenticated, async (req, res) => {
  const email = normalize(req.body.email);
  const genericMessage = 'If an account exists for that email, a password reset link has been sent.';
  try {
    const users = await usersCollection();
    const user = await users.findOne({ emailLower: email });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await users.updateOne({ id: user.id }, { $set: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() } });
      sendPasswordResetEmail(user.email, user.fullName, token).catch((err) => console.error('Password reset email error:', err));
    }
    return res.render('auth/forgot-password', { error: null, message: genericMessage });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.render('auth/forgot-password', { error: 'Unable to process your request. Please try again.', message: null });
  }
});

router.get('/reset-password/:token', checkNotAuthenticated, async (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const users = await usersCollection();
  const user = await users.findOne({ resetTokenHash: tokenHash });
  const valid = user && user.resetTokenExpiresAt && new Date(user.resetTokenExpiresAt) > new Date();
  res.render('auth/reset-password', { token: req.params.token, error: valid ? null : 'This reset link is invalid or has expired.' });
});

router.post('/reset-password/:token', checkNotAuthenticated, async (req, res) => {
  const { password, confirmPassword } = req.body;
  if (!password || password.length < 8 || !/[A-Z]/.test(password) || password !== confirmPassword) {
    return res.render('auth/reset-password', { token: req.params.token, error: 'Passwords must match, be at least 8 characters, and include an uppercase letter.' });
  }
  const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const users = await usersCollection();
  const user = await users.findOne({ resetTokenHash: tokenHash });
  if (!user || !user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) <= new Date()) {
    return res.render('auth/reset-password', { token: req.params.token, error: 'This reset link is invalid or has expired.' });
  }
  await users.updateOne({ id: user.id }, { $set: { password: await bcrypt.hash(password, 12) }, $unset: { resetTokenHash: '', resetTokenExpiresAt: '' } });
  return res.redirect('/login?reset=success');
});

router.post('/login', checkNotAuthenticated, async (req, res) => {
  const identity = (req.body.identity || req.body.email || '').trim();
  const { password } = req.body;
  if (!identity || !password) return res.render('auth/login', { error: 'Email/username and password are required', formData: { identity } });
  try {
    const user = await findUserByIdentity(identity);
    const valid = user && await bcrypt.compare(password, user.password);
    if (!valid) return res.render('auth/login', { error: 'Invalid email/username or password', formData: { identity } });
    req.session.userId = user.id;
    sendLoginEmail(user.email, user.fullName).catch((err) => console.error('Login email error:', err));
    return res.redirect('/user/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    return res.render('auth/login', { error: 'An error occurred. Please try again.', formData: { identity } });
  }
});

router.get('/admin/login', (req, res) => res.render('admin/login', { error: null }));

router.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  }
  return res.render('admin/login', { error: 'Invalid admin credentials', formData: { email } });
});

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.redirect('/login');
  });
});

module.exports = router;
