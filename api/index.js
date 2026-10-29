import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cookieSession from 'cookie-session';
import flash from 'connect-flash';
import hbs from 'hbs';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { FirestoreAdapter } from '../models/firestore-adapter.js';
import * as authController from '../controllers/authController.js';
import * as student from '../controllers/studentController.js';
import * as cashier from '../controllers/cashierController.js';
import * as guidance from '../controllers/guidanceController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ================================================================
// AUTH MIDDLEWARE
// ================================================================

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.redirect('/login');
    }

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('403', { title: 'Access Denied' });
    }

    next();
  };
};

// ================================================================
// MULTER STORAGE
// ================================================================

const storage = (folder) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, `../public/uploads/${folder}`)),
  filename: (req, file, cb) => cb(null, `${folder}-${Date.now()}${path.extname(file.originalname)}`)
});

const uploadPayment = multer({ storage: storage('payments'), limits: { fileSize: 5 * 1024 * 1024 } });
const uploadReceipt = multer({ storage: storage('receipts'), limits: { fileSize: 5 * 1024 * 1024 } });
const uploadAvatar = multer({ storage: storage('avatars'), limits: { fileSize: 3 * 1024 * 1024 } });

// ================================================================
// BASIC CONFIG
// ================================================================

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================================================================
// SESSIONS - cookie-session stores everything in the cookie itself
// No server-side store = works perfectly on Vercel serverless
// (each cold start reads session from the cookie, not memory)
// ================================================================

app.use(
  cookieSession({
    name: 'uniguide.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    maxAge: 1000 * 60 * 60 * 8,  // 8 hours
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/'
  })
);

// cookie-session doesn't have .save() — shim it so existing code doesn't break
app.use((req, res, next) => {
  if (req.session && !req.session.save) {
    req.session.save = (cb) => { if (cb) cb(); };
  }
  if (req.session && !req.session.destroy) {
    req.session.destroy = (cb) => {
      req.session = null;
      if (cb) cb();
    };
  }
  next();
});

app.use(flash());

// ================================================================
// MAKE LOCALS AVAILABLE
// ================================================================

app.use((req, res, next) => {
  res.locals.success = req.flash('success') || [];
  res.locals.error = req.flash('error') || [];
  res.locals.user = req.session?.user || null;
  next();
});

// ================================================================
// VIEWS SETUP
// ================================================================

app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'xian');

// Register partials
const partialsDir = path.join(__dirname, '../views/partials');
if (fs.existsSync(partialsDir)) {
  fs.readdirSync(partialsDir)
    .filter(f => f.endsWith('.xian'))
    .forEach(file => {
      const partialName = file.replace('.xian', '');
      hbs.registerPartial(partialName, fs.readFileSync(path.join(partialsDir, file), 'utf8'));
    });
}

// Register helpers
hbs.registerHelper('eq', (a, b) => a === b);
hbs.registerHelper('ne', (a, b) => a !== b);

// ── Date/time helpers ──────────────────────────────────────────
hbs.registerHelper('formatDate', (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return val; }
});

hbs.registerHelper('formatDateTime', (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return val; }
});

hbs.registerHelper('formatTime', (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  } catch { return val; }
});

// ── Currency / math helpers ────────────────────────────────────
hbs.registerHelper('currency', (val) => {
  if (val === null || val === undefined || val === '') return '₱0.00';
  return '₱' + parseFloat(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
});

hbs.registerHelper('multiply', (a, b) => {
  return (parseFloat(a) || 0) * (parseFloat(b) || 0);
});

// ── Application status helpers ─────────────────────────────────
const STATUS_LABELS = {
  pending:             'Pending',
  payment_submitted:   'Payment Submitted',
  waiting_for_cashier: 'Waiting for Cashier',
  payment_verified:    'Payment Verified',
  receipt_issued:      'Receipt Issued',
  approved:            'Approved',
  released:            'Released',
  rejected:            'Rejected',
  claimed:             'Claimed',
};

const STATUS_CLASSES = {
  pending:             'badge-warning',
  payment_submitted:   'badge-info',
  waiting_for_cashier: 'badge-info',
  payment_verified:    'badge-info',
  receipt_issued:      'badge-success',
  approved:            'badge-success',
  released:            'badge-success',
  rejected:            'badge-danger',
  claimed:             'badge-success',
};

hbs.registerHelper('statusLabel', (status) => STATUS_LABELS[status] || status || '—');
hbs.registerHelper('statusClass', (status) => STATUS_CLASSES[status] || 'badge-secondary');

// ── Appointment status helper ──────────────────────────────────
const APPT_STATUS_CLASSES = {
  pending:   'badge-warning',
  approved:  'badge-success',
  done:      'badge-secondary',
  cancelled: 'badge-danger',
  rejected:  'badge-danger',
};

hbs.registerHelper('apptStatusClass', (status) => APPT_STATUS_CLASSES[status] || 'badge-secondary');

// ── Notification type helper ───────────────────────────────────
hbs.registerHelper('notifClass', (type) => {
  const map = {
    success: 'bg-green-50',
    danger:  'bg-red-50',
    warning: 'bg-yellow-50',
    info:    'bg-blue-50',
  };
  return map[type] || 'bg-gray-50';
});

// ── Logic / comparison helpers ─────────────────────────────────
hbs.registerHelper('or', (...args) => {
  // last arg is the Handlebars options object — ignore it
  const vals = args.slice(0, -1);
  return vals.some(Boolean);
});

hbs.registerHelper('and', (...args) => {
  const vals = args.slice(0, -1);
  return vals.every(Boolean);
});

hbs.registerHelper('not', (val) => !val);

hbs.registerHelper('gt',  (a, b) => parseFloat(a) >  parseFloat(b));
hbs.registerHelper('gte', (a, b) => parseFloat(a) >= parseFloat(b));
hbs.registerHelper('lt',  (a, b) => parseFloat(a) <  parseFloat(b));
hbs.registerHelper('lte', (a, b) => parseFloat(a) <= parseFloat(b));

// ── Array helper ───────────────────────────────────────────────
// Usage: {{#each (list 'a' 'b' 'c')}} … {{/each}}
hbs.registerHelper('list', (...args) => args.slice(0, -1));

app.engine('xian', (filePath, options, callback) => {
  try {
    hbs.__express(filePath, options, (err, html) => {
      callback(err, html);
    });
  } catch (err) {
    callback(err);
  }
});

// ================================================================
// PASSPORT CONFIGURATION
// ================================================================

console.log('========================================');
console.log('PASSPORT CONFIGURATION');
console.log('========================================');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ SET' : '❌ NOT SET');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ SET' : '❌ NOT SET');
console.log('GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL || '❌ NOT SET - USING DEFAULT: /auth/google/callback');
console.log('========================================');

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('❌ CRITICAL: Google OAuth credentials missing!');
  console.error('   Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Vercel environment variables');
} else {
  console.log('✅ Google OAuth credentials found');
}

// Determine callback URL:
// Always use the git-main URL in production (works on any Vercel deployment alias)
// Fall back to env var or relative path for local dev
const CALLBACK_URL = process.env.NODE_ENV === 'production'
  ? 'https://uniguide-git-main-marvingabia5-gmailcoms-projects.vercel.app/auth/google/callback'
  : (process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback');

console.log('🔗 OAuth Callback URL:', CALLBACK_URL);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      console.log('🔐 GOOGLE STRATEGY EXECUTING');
      console.log('Email:', profile.emails?.[0]?.value);
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(null, false, { message: 'No email from Google' });
        }

        let user = await FirestoreAdapter.findUserByEmail(email);

        if (!user) {
          // Create new user from Google profile
          user = await FirestoreAdapter.createUser({
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            email,
            authMethod: 'google',
            role: 'student',
            isApproved: true
          });
        }

        console.log('✅ User found/created:', email);
        return done(null, user);
      } catch (err) {
        console.error('❌ Google strategy error:', err);
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  // We store full user in req.session.user, so this is a no-op
  done(null, { id });
});

app.use(passport.initialize());
// NOTE: NOT using passport.session() — we manage sessions via cookie-session directly

app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint works', time: new Date().toISOString() });
});

// ================================================================
// STATIC FILES AND UPLOADS
// ================================================================

const publicDir = path.join(__dirname, '../public');

app.use(express.static(publicDir));

// ================================================================
// ROUTES
// ================================================================

// Redirect if already logged in
app.get('/', (req, res) => {
  if (req.session?.user) {
    const { role } = req.session.user;
    if (role === 'student') return res.redirect('/student/dashboard');
    if (role === 'cashier') return res.redirect('/cashier/dashboard');
    if (role === 'guidance') return res.redirect('/guidance/dashboard');
  }
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { title: 'Login - GuidanceConnect' });
});

app.get('/register', (req, res) => {
  res.render('register', { title: 'Register - GuidanceConnect' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/test-callback', (req, res) => {
  res.json({ message: 'Test callback endpoint works', path: req.path });
});

app.get('/auth-test', (req, res) => {
  res.json({ message: 'Auth test endpoint works', timestamp: new Date().toISOString(), path: req.path });
});

// ================================================================
// AUTH ROUTES
// ================================================================

app.post('/auth/login', authController.login);
app.post('/login', authController.login);           // login form posts here
app.post('/auth/register', authController.register);
app.post('/register', authController.register);     // register form posts here
app.get('/auth/google', passport.authenticate('google', { 
  scope: ['profile', 'email'], 
  prompt: 'select_account',
  callbackURL: 'https://uniguide-git-main-marvingabia5-gmailcoms-projects.vercel.app/auth/google/callback'
}));

// Google OAuth callback - handle both real OAuth and test requests
app.all('/auth/google/callback', (req, res, next) => {
  try {
    console.log('🔐 CALLBACK: Request received - Method:', req.method);
    console.log('   Has code?', !!req.query.code);
    console.log('   Has error?', !!req.query.error);

    // If no code and no error, this is likely a test/direct request
    if (!req.query.code && !req.query.error) {
      console.log('✅ Test callback endpoint working');
      return res.json({ 
        message: 'OAuth callback endpoint is working',
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }

    // If there's an error from Google
    if (req.query.error) {
      console.error('❌ Google OAuth error:', req.query.error);
      return res.redirect('/login?error=' + req.query.error);
    }

    // Real OAuth callback with code - only process GET
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('🔐 Processing OAuth callback with code');
    
    passport.authenticate('google', { session: false }, (err, user, info) => {
      try {
        if (err) {
          console.error('❌ PASSPORT ERROR:', err.message);
          return res.redirect('/login?error=oauth_error');
        }

        if (!user) {
          console.error('❌ NO USER RETURNED');
          return res.redirect('/login?error=no_user');
        }

        console.log('✅ User from passport:', user.email);

        // Manually set the user in session (bypass deserialization)
        req.session.user = {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role || 'student',
          avatar: user.avatar || null
        };

        console.log('✅ Session user set:', req.session.user.email);

        const role = user.role || 'student';
        const redirectPath = role === 'guidance' ? '/guidance/dashboard' 
                           : role === 'cashier' ? '/cashier/dashboard'
                           : '/student/dashboard';

        console.log('✅ Redirecting to:', redirectPath);
        res.redirect(redirectPath);
      } catch (authErr) {
        console.error('❌ ERROR IN PASSPORT CALLBACK:', authErr.message);
        res.status(500).send('Passport callback error: ' + authErr.message);
      }
    })(req, res, next);
  } catch (e) {
    console.error('❌ CALLBACK ERROR:', e.message);
    res.status(500).send('Callback error: ' + e.message);
  }
});

app.get('/auth/logout', authController.logout);
app.post('/logout', authController.logout);       // sidebar logout button
app.get('/logout', authController.logout);        // direct link fallback

// ================================================================
// DEBUG ROUTES
// ================================================================

// Check session status
app.get('/debug/session', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    hasSession: !!req.session,
    hasUser: !!req.session?.user,
    user: req.session?.user || null,
    cookies: req.cookies,
    headers: {
      cookie: req.headers.cookie
    }
  });
});

// ================================================================
// PUBLIC PAGES (For Google OAuth Branding)
// ================================================================

// Privacy Policy
app.get('/privacy', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Privacy Policy - UniGuide</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1 { color: #333; }
        h2 { color: #555; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Privacy Policy - UniGuide</h1>
      <p><strong>Last Updated: October 27, 2026</strong></p>
      
      <h2>1. Information We Collect</h2>
      <p>UniGuide collects the following information:</p>
      <ul>
        <li>Google account information (name, email, profile picture)</li>
        <li>Application submissions and personal data related to applications</li>
        <li>Payment information and transaction records</li>
        <li>Session data and login activity</li>
      </ul>
      
      <h2>2. How We Use Your Information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Authenticate users through Google OAuth</li>
        <li>Process applications and payments</li>
        <li>Maintain user sessions and accounts</li>
        <li>Provide guidance office services</li>
      </ul>
      
      <h2>3. Data Protection</h2>
      <p>Your data is encrypted and stored securely. We do not share your personal information with third parties except as required by law.</p>
      
      <h2>4. Contact Us</h2>
      <p>For privacy concerns, contact: <strong>marvingabia5@gmail.com</strong></p>
    </body>
    </html>
  `);
});

// Terms of Service
app.get('/terms', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Terms of Service - UniGuide</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1 { color: #333; }
        h2 { color: #555; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Terms of Service - UniGuide</h1>
      <p><strong>Last Updated: October 27, 2026</strong></p>
      
      <h2>1. Acceptance of Terms</h2>
      <p>By using UniGuide, you agree to these terms and conditions.</p>
      
      <h2>2. User Responsibilities</h2>
      <ul>
        <li>Provide accurate information when registering</li>
        <li>Maintain confidentiality of your account</li>
        <li>Use the service for legitimate purposes only</li>
      </ul>
      
      <h2>3. Service Availability</h2>
      <p>UniGuide is provided "as is" without warranties. We reserve the right to modify or discontinue services.</p>
      
      <h2>4. Limitation of Liability</h2>
      <p>UniGuide and its developers are not liable for any indirect, incidental, or consequential damages.</p>
      
      <h2>5. Contact</h2>
      <p>For questions about these terms, contact: <strong>marvingabia5@gmail.com</strong></p>
    </body>
    </html>
  `);
});

// App Info Page (Home for OAuth)
app.get('/info', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>UniGuide - Guidance Office Management System</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; background: #f5f5f5; }
        .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        h2 { color: #555; margin-top: 20px; }
        .features { list-style: none; padding: 0; }
        .features li { padding: 8px 0; padding-left: 20px; }
        .features li:before { content: "✓ "; color: green; font-weight: bold; margin-right: 10px; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎓 UniGuide</h1>
        <p><strong>Guidance Office Management System</strong></p>
        
        <h2>About UniGuide</h2>
        <p>UniGuide is a modern, secure platform designed to streamline guidance office operations. Students can submit applications, make payments, and request appointments online. Guidance officers can manage applications, verify payments, and conduct counseling sessions efficiently.</p>
        
        <h2>Key Features</h2>
        <ul class="features">
          <li>Google OAuth authentication</li>
          <li>Online application submissions</li>
          <li>Payment processing and verification</li>
          <li>Appointment scheduling</li>
          <li>Real-time notifications</li>
          <li>Secure data management</li>
        </ul>
        
        <h2>User Roles</h2>
        <ul>
          <li><strong>Students:</strong> Submit applications, make payments, view status</li>
          <li><strong>Cashiers:</strong> Verify payments and issue receipts</li>
          <li><strong>Guidance Officers:</strong> Manage applications and conduct counseling</li>
        </ul>
        
        <div class="footer">
          <p>For more information, visit the <a href="/privacy">Privacy Policy</a> or <a href="/terms">Terms of Service</a>.</p>
          <p>Support: <strong>marvingabia5@gmail.com</strong></p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// ================================================================
// STUDENT ROUTES
// ================================================================

app.get('/student/home', requireRole('student'), student.dashboard);
app.get('/student/dashboard', requireRole('student'), student.dashboard);
app.get('/student/history', requireRole('student'), student.applicationHistory);
app.get('/student/apply', requireRole('student'), student.showApplyForm);
app.post('/student/apply', requireRole('student'), student.submitApplication);
app.get('/student/application/:id', requireRole('student'), student.viewApplication);
app.post('/student/application/:id/delete', requireRole('student'), student.deleteApplication);
app.get('/student/application/:id/payment', requireRole('student'), student.showPaymentForm);
app.post('/student/application/:id/payment', requireRole('student'), uploadPayment.single('screenshot'), student.submitPayment);
app.get('/student/notifications', requireRole('student'), student.viewNotifications);
app.get('/student/announcements', requireRole('student'), student.viewAnnouncements);
app.get('/student/appointments', requireRole('student'), student.showAppointmentForm);
app.post('/student/appointments', requireRole('student'), student.bookAppointment);
app.get('/student/profile', requireRole('student'), student.showProfile);
app.post('/student/profile', requireRole('student'), uploadAvatar.single('profileImage'), student.updateProfile);

// ================================================================
// CASHIER ROUTES
// ================================================================

app.get('/cashier/home', requireRole('cashier'), cashier.dashboard);
app.get('/cashier/dashboard', requireRole('cashier'), cashier.dashboard);
app.get('/cashier/application/:id', requireRole('cashier'), cashier.viewApplication);
app.post('/cashier/application/:id/verify-and-issue', requireRole('cashier'), uploadReceipt.single('receiptFile'), cashier.verifyAndIssueReceipt);
app.post('/cashier/application/:id/issue-receipt', requireRole('cashier'), uploadReceipt.single('receiptFile'), cashier.issueReceipt);
app.post('/cashier/application/:id/reissue-receipt', requireRole('cashier'), uploadReceipt.single('receiptFile'), cashier.reissueReceipt);
app.post('/cashier/application/:id/reject', requireRole('cashier'), cashier.rejectApplication);
app.get('/cashier/history', requireRole('cashier'), cashier.paymentHistory);
app.get('/cashier/daily-collections', requireRole('cashier'), cashier.dailyCollections);
app.get('/cashier/notifications', requireRole('cashier'), cashier.viewNotifications);
app.post('/cashier/notifications/mark-read', requireRole('cashier'), cashier.markNotificationsRead);

// ================================================================
// GUIDANCE ROUTES
// ================================================================

app.get('/guidance/home', requireRole('guidance'), guidance.dashboard);
app.get('/guidance/dashboard', requireRole('guidance'), guidance.dashboard);
app.get('/guidance/applications', requireRole('guidance'), guidance.allApplications);
app.get('/guidance/application/:id', requireRole('guidance'), guidance.viewApplication);
app.post('/guidance/application/:id/approve', requireRole('guidance'), guidance.approveApplication);
app.post('/guidance/application/:id/release', requireRole('guidance'), guidance.releaseCertificate);
app.post('/guidance/application/:id/reject', requireRole('guidance'), guidance.rejectApplication);
app.post('/guidance/application/:id/claim', requireRole('guidance'), guidance.markClaimed);
app.get('/guidance/announcements/new', requireRole('guidance'), guidance.showAnnouncementForm);
app.post('/guidance/announcements', requireRole('guidance'), guidance.createAnnouncement);
app.get('/guidance/announcements/:id/edit', requireRole('guidance'), guidance.editAnnouncement);
app.post('/guidance/announcements/:id/edit', requireRole('guidance'), guidance.updateAnnouncement);
app.post('/guidance/announcements/:id/delete', requireRole('guidance'), guidance.deleteAnnouncement);
app.get('/guidance/users', requireRole('guidance'), guidance.manageUsers);
app.post('/guidance/users', requireRole('guidance'), guidance.createStaffAccount);
app.get('/guidance/appointments', requireRole('guidance'), guidance.manageAppointments);
app.post('/guidance/appointments/:id/update', requireRole('guidance'), guidance.updateAppointment);
app.post('/guidance/appointments/:id/reschedule', requireRole('guidance'), guidance.rescheduleAppointment);
app.get('/guidance/time-slots', requireRole('guidance'), guidance.manageTimeSlots);
app.post('/guidance/time-slots', requireRole('guidance'), guidance.createTimeSlots);
app.post('/guidance/time-slots/:id/delete', requireRole('guidance'), guidance.deleteTimeSlot);
app.post('/guidance/time-slots/:id/toggle', requireRole('guidance'), guidance.toggleTimeSlot);
app.get('/guidance/reports', requireRole('guidance'), guidance.reports);
app.get('/guidance/notifications', requireRole('guidance'), guidance.viewNotifications);
app.post('/guidance/notifications/mark-read', requireRole('guidance'), guidance.markNotificationsRead);
app.get('/guidance/profiling', requireRole('guidance'), guidance.studentProfiling);
app.get('/guidance/profiling/student/:id', requireRole('guidance'), guidance.viewStudentProfile);
app.post('/guidance/profiling/student/:id', requireRole('guidance'), guidance.updateStudentProfile);
app.post('/guidance/profiling/student/:id/session', requireRole('guidance'), guidance.addCounselingSession);

// ================================================================
// DEBUG: Log all requests before 404
// ================================================================

app.use((req, res, next) => {
  if (req.path.startsWith('/auth') || req.path.includes('callback')) {
    console.log('🔍 REQUEST MATCHED:', req.method, req.path);
  }
  next();
});

// ================================================================
// 404 & ERROR HANDLING
// ================================================================

app.use((req, res) => {
  console.log('❌ 404 NOT FOUND:', req.method, req.path);
  console.log('   Query:', req.query);
  console.log('   Session:', req.session?.user ? 'exists' : 'none');
  
  // Check if it's an API request or browser
  if (req.accepts('json')) {
    return res.status(404).json({ error: 'Not found', path: req.path });
  }
  
  // For browser requests, try rendering view
  try {
    return res.status(404).render('404', { title: '404 — Not Found' });
  } catch (err) {
    // Fallback to JSON if rendering fails
    console.error('❌ Could not render 404 view:', err.message);
    return res.status(404).json({ error: 'Not found', path: req.path });
  }
});

app.use((err, req, res, next) => {
  console.error('❌ ERROR HANDLER TRIGGERED');
  console.error('Message:', err.message);
  console.error('Status:', err.status || 500);
  console.error('Stack:', err.stack);
  
  if (req.accepts('json')) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
  
  try {
    return res.status(500).render('404', { title: 'Error' });
  } catch (renderErr) {
    console.error('❌ Could not render error view:', renderErr.message);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ================================================================
// EXPORT FOR VERCEL SERVERLESS
// ================================================================

const deployTime = new Date().toISOString();
console.log(`✅ API SERVER INITIALIZING [${deployTime}] - All routes registered`);
console.log('   Routes include: /auth/google/callback (all methods), /auth/google, /login, /health, etc.');
console.log('   Session: Cookie-based (Vercel serverless compatible)');
console.log('   vercel.json: using rewrites (fixed routing)');
console.log('   Build: 346cfa1-clean');

// Export the Express app directly
export default app;
