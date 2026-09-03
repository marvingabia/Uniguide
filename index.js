import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import hbs from 'hbs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import passport from './config/passport.js';
import router from './routes/index.js';
import { syncDB } from './models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'minsu-guidance-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 }
}));

app.use(flash());
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error   = req.flash('error');
  res.locals.user    = req.session.user || null;
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ── Handlebars Helpers ──────────────────────────────────────────
hbs.registerHelper('eq',       (a, b) => a === b);
hbs.registerHelper('ne',       (a, b) => a !== b);
hbs.registerHelper('or',       (a, b) => a || b);
hbs.registerHelper('and',      (a, b) => a && b);
hbs.registerHelper('gt',       (a, b) => a > b);
hbs.registerHelper('includes', (arr, val) => Array.isArray(arr) && arr.includes(val));

hbs.registerHelper('formatDate', (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
});
hbs.registerHelper('formatTime', (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
});
hbs.registerHelper('formatDateTime', (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
});
hbs.registerHelper('timeAgo', (d) => {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
});

hbs.registerHelper('statusLabel', (s) => {
  const map = {
    pending:           'Pending Payment',
    payment_submitted: 'Payment Submitted',
    payment_verified:  'Payment Verified',
    receipt_issued:    'Receipt Issued',
    approved:          'Approved',
    released:          'Ready for Release',
    rejected:          'Rejected'
  };
  return map[s] || s;
});
hbs.registerHelper('statusClass', (s) => {
  const map = {
    pending:           'badge-pending',
    payment_submitted: 'badge-submitted',
    payment_verified:  'badge-verified',
    receipt_issued:    'badge-receipted',
    approved:          'badge-approved',
    released:          'badge-released',
    rejected:          'badge-rejected'
  };
  return map[s] || '';
});
hbs.registerHelper('apptStatusClass', (s) => {
  const map = { pending: 'badge-pending', approved: 'badge-verified', cancelled: 'badge-rejected', done: 'badge-released' };
  return map[s] || '';
});
hbs.registerHelper('notifClass', (t) => {
  const map = { success: 'notif-success', warning: 'notif-warning', danger: 'notif-danger', info: 'notif-info' };
  return map[t] || 'notif-info';
});

hbs.registerHelper('multiply', (a, b) => (parseFloat(a) * parseFloat(b)).toFixed(2));
hbs.registerHelper('currency', (v) => `₱${parseFloat(v || 0).toFixed(2)}`);
hbs.registerHelper('add',      (a, b) => parseFloat(a || 0) + parseFloat(b || 0));
hbs.registerHelper('subtract', (a, b) => parseFloat(a || 0) - parseFloat(b || 0));
hbs.registerHelper('json',     (v) => JSON.stringify(v));
hbs.registerHelper('list',     (...args) => args.slice(0, -1)); // Create array from arguments

// ── Register partials ───────────────────────────────────────────
const partialsDir = path.join(__dirname, 'views', 'partials');
if (fs.existsSync(partialsDir)) {
  fs.readdirSync(partialsDir)
    .filter(f => f.endsWith('.xian'))
    .forEach(f => {
      hbs.registerPartial(
        f.replace('.xian', ''),
        fs.readFileSync(path.join(partialsDir, f), 'utf8')
      );
    });
}

// ── Custom view engine (.xian = Handlebars) ─────────────────────
app.engine('xian', async (filePath, options, cb) => {
  try {
    const result = await new Promise((resolve, reject) =>
      hbs.__express(filePath, options, (err, html) => err ? reject(err) : resolve(html))
    );
    cb(null, result);
  } catch (err) { cb(err); }
});
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'xian');

app.use('/', router);
app.use((req, res) => res.status(404).render('404', { title: '404 — GuidanceConnect' }));

syncDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`🎓 MinSU GuidanceConnect running → http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️  Port ${PORT} busy — killing it and retrying...`);
      import('child_process').then(({ execSync }) => {
        try {
          // kill whatever holds the port (Windows)
          execSync(
            `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${PORT} ^| findstr LISTENING') do taskkill /PID %a /F`,
            { shell: 'cmd.exe', stdio: 'ignore' }
          );
        } catch (_) { /* already gone */ }
        // short delay then retry
        setTimeout(() => {
          server.close();
          app.listen(PORT, () => {
            console.log(`🎓 MinSU GuidanceConnect running → http://localhost:${PORT}`);
          });
        }, 800);
      });
      return;
    }
    console.error('Server error:', err);
    process.exit(1);
  });
});

export default app;
