import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import session from 'express-session';
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
// SESSIONS
// ================================================================

app.use(
  session({
    name: 'uniguide.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
      path: '/'
    }
  })
);

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

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
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
  console.log('🔐 SERIALIZE USER:', user.id || user.email);
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    console.log('🔐 DESERIALIZE USER:', id);
    const user = await FirestoreAdapter.findUserById(id);
    console.log('✅ User deserialized:', user?.email);
    done(null, user);
  } catch (err) {
    console.error('❌ Deserialization error:', err);
    done(err);
  }
});

app.use(passport.initialize());
app.use(passport.session());

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

app.get('/auth-test', (req, res) => {
  res.json({ message: 'Auth test endpoint works', timestamp: new Date().toISOString(), path: req.path });
});

// ================================================================
// AUTH ROUTES
// ================================================================

app.post('/auth/login', authController.login);
app.post('/auth/register', authController.register);
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));

// Google OAuth callback
app.get('/auth/google/callback', (req, res, next) => {
  try {
    console.log('🔐 [CALLBACK] Request received');
    console.log('   Code:', req.query.code ? '✅' : '❌');
    console.log('   State:', req.query.state ? '✅' : '❌');
    console.log('   Session ID:', req.sessionID);
    
    passport.authenticate('google', { session: true }, async (err, user, info) => {
      try {
        console.log('🔐 [PASSPORT RESULT]');
        console.log('   Error:', err ? `YES - ${err.message}` : 'NO');
        console.log('   User:', user ? `YES - ${user.email}` : 'NO');
        console.log('   Info:', info);
        
        if (err) {
          console.error('❌ Google OAuth error:', err);
          return res.status(401).json({ 
            error: 'OAuth failed',
            message: err.message,
            type: err.name
          });
        }
        
        if (!user) {
          console.log('❌ No user returned. Info:', info);
          return res.status(401).json({ 
            error: 'Authentication failed',
            message: info?.message || 'Unknown error',
            details: info
          });
        }
        
        // User exists, log them in
        console.log('✅ User authenticated:', user.email);
        console.log('   User role:', user.role);
        console.log('   User ID:', user.id);
        
        req.logIn(user, { session: true }, (loginErr) => {
          try {
            if (loginErr) {
              console.error('❌ Login error:', loginErr.message);
              return res.status(500).json({ error: 'Login failed', message: loginErr.message });
            }
            
            req.session.user = {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              role: user.role || 'student',
              avatar: user.avatar || null
            };
            
            console.log('✅ Session user set:', req.session.user.email, 'Role:', req.session.user.role);
            
            req.session.save((saveErr) => {
              try {
                if (saveErr) {
                  console.error('❌ Session save error:', saveErr.message);
                  return res.status(500).json({ error: 'Session save failed', message: saveErr.message });
                }
                
                const role = user.role || 'student';
                const redirectPath = role === 'guidance' ? '/guidance/dashboard' 
                                   : role === 'cashier' ? '/cashier/dashboard'
                                   : '/student/dashboard';
                
                console.log('✅ Redirecting to:', redirectPath);
                console.log('   Session saved, redirecting...');
                res.redirect(redirectPath);
              } catch (e) {
                console.error('❌ CRITICAL ERROR in session.save callback:', e);
                res.status(500).json({ error: 'Session redirect failed', message: e.message });
              }
            });
          } catch (e) {
            console.error('❌ CRITICAL ERROR in logIn callback:', e);
            res.status(500).json({ error: 'Login callback error', message: e.message });
          }
        });
      } catch (e) {
        console.error('❌ CRITICAL ERROR in passport authenticate callback:', e);
        res.status(500).json({ error: 'Passport error', message: e.message, stack: e.stack });
      }
    })(req, res, next);
  } catch (e) {
    console.error('❌ CRITICAL ERROR in callback route:', e);
    res.status(500).json({ error: 'Callback error', message: e.message, stack: e.stack });
  }
});

app.get('/auth/logout', authController.logout);

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

// Export the Express app directly
export default app;
