// Main application file - Trading Platform
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const db = require('./db');





// Create Express app
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const sessionSecret = process.env.SESSION_SECRET || 'development-only-session-secret';

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'change_this_to_a_strong_secret') {
  console.warn('SESSION_SECRET is not set to a private value. Set a long random secret before production.');
}

// Initialize data files if they don't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Initialize users.json if it doesn't exist
const usersPath = path.join(dataDir, 'users.json');
if (!fs.existsSync(usersPath)) {
  fs.writeFileSync(usersPath, JSON.stringify([]));
}

// Initialize withdrawals.json if it doesn't exist
const withdrawalsPath = path.join(dataDir, 'withdrawals.json');
if (!fs.existsSync(withdrawalsPath)) {
  fs.writeFileSync(withdrawalsPath, JSON.stringify([]));
}

// Initialize deposits.json if it doesn't exist
const depositsPath = path.join(dataDir, 'deposits.json');
if (!fs.existsSync(depositsPath)) {
  fs.writeFileSync(depositsPath, JSON.stringify([]));
}

// Set up middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true, limit: '32kb' }));
app.use(cookieParser());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  // Increase session lifetime to 30 days so active trades remain visible
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

// Import middleware
const { checkAuthenticated, checkNotAuthenticated } = require('./middleware/auth');

// Set up routes
app.use('/', authRoutes);
app.use('/user', checkAuthenticated, userRoutes);
app.use('/admin', adminRoutes);

// Home route
app.get('/', checkNotAuthenticated, (req, res) => {
  res.render('landing');
});

// Legal pages
app.get('/terms', (req, res) => res.render('legal/terms'));
app.get('/privacy', (req, res) => res.render('legal/privacy'));
app.get('/risk-disclaimer', (req, res) => res.render('legal/risk-disclaimer'));
app.get('/contact', (req, res) => res.render('legal/contact'));

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });

  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is already in use. Trying port ${port + 1}...`);
      return startServer(port + 1);
    }
    throw error;
  });
};

// Start the server after MongoDB connects
db.connectToDatabase()
  .then(() => {
    console.log('Connected to MongoDB');
    startServer(Number(PORT));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });