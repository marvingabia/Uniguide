import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import hbs from 'hbs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
    rolling: true,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
      path: '/'
    }
  })
);

// ================================================================
// FLASH MESSAGES
// ================================================================

app.use(flash());
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.session?.user || null;
  next();
});

// ================================================================
// VIEWS
// ================================================================

app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'xian');

hbs.registerHelper('eq', (a, b) => a === b);
hbs.registerHelper('ne', (a, b) => a !== b);
hbs.registerHelper('or', (a, b) => a || b);
hbs.registerHelper('and', (a, b) => a && b);

hbs.registerHelper('formatDate', (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
});

app.engine('xian', (filePath, options, callback) => {
  try {
    hbs.__express(filePath, options, (err, renderedHtml) => {
      if (err) {
        callback(err);
      } else {
        callback(null, renderedHtml);
      }
    });
  } catch (err) {
    callback(err);
  }
});

// ================================================================
// STATIC FILES
// ================================================================

app.use(express.static(path.join(__dirname, '../public')));

// ================================================================
// ROUTES - MINIMAL FOR TESTING
// ================================================================

app.get('/', (req, res) => {
  res.render('login', { title: 'Login - GuidanceConnect' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/login', (req, res) => {
  res.render('login', { title: 'Login - GuidanceConnect' });
});

app.get('/register', (req, res) => {
  res.render('register', { title: 'Register - GuidanceConnect' });
});

// ================================================================
// ERROR HANDLING
// ================================================================

app.use((req, res) => {
  res.status(404).render('404', { title: '404 - Not Found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// ================================================================
// EXPORT FOR VERCEL
// ================================================================

export default app;
