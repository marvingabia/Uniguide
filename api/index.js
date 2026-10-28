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
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await FirestoreAdapter.findUserById(id);
    done(null, user);
  } catch (err) {
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

app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint works', time: new Date().toISOString() });
});

// ================================================================
// AUTH ROUTES
// ================================================================

app.post('/auth/login', authController.login);
app.post('/auth/register', authController.register);
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));
app.get('/auth/google/callback', 
  (req, res, next) => {
    console.log('🔍 CALLBACK ROUTE HIT');
    console.log('URL:', req.originalUrl);
    console.log('Query:', req.query);
    next();
  },
  passport.authenticate('google', { failureRedirect: '/login' }), 
  authController.googleCallback
);
app.get('/auth/logout', authController.logout);

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
// 404 & ERROR HANDLING
// ================================================================

app.use((req, res) => {
  res.status(404).render('404', { title: '404 — Not Found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).render('404', { title: 'Error' });
});

// ================================================================
// EXPORT
// ================================================================

export default app;
