import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import hbs from 'hbs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { FirestoreAdapter } from '../models/firestore-adapter.js';
import * as authController from '../controllers/authController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

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

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
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

        return done(null, user);
      } catch (err) {
        console.error('Google strategy error:', err);
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

app.get('/', (req, res) => {
  res.render('login', { title: 'Login - GuidanceConnect' });
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

// ================================================================
// AUTH ROUTES
// ================================================================

app.post('/auth/login', authController.login);

app.post('/auth/register', authController.register);

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), authController.googleCallback);

app.get('/auth/logout', authController.logout);

// ================================================================
// ERROR HANDLING
// ================================================================

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// ================================================================
// EXPORT
// ================================================================

export default app;
