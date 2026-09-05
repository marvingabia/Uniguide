import dotenv from 'dotenv';

dotenv.config();

import express from 'express';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import flash from 'connect-flash';
import hbs from 'hbs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import passport from './config/passport.js';
import router from './routes/index.js';
import { syncDB } from './models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = Number(process.env.PORT) || 3000;

/* ================================================================
   BASIC APP CONFIG
================================================================ */

app.disable('x-powered-by');

/*
 * Important for Vercel / HTTPS reverse proxy.
 */
app.set('trust proxy', 1);

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

/* ================================================================
   SESSION — MYSQL STORE
================================================================ */

const isProduction =
  process.env.NODE_ENV === 'production';

/*
 * Read Aiven DATABASE_URL
 *
 * Example:
 * mysql://avnadmin:password@host:15878/defaultdb
 */
if (!process.env.DATABASE_URL) {
  console.error(
    '❌ DATABASE_URL is not configured.'
  );
}

/*
 * Parse DATABASE_URL
 */
let dbUrl;

try {
  dbUrl = new URL(
    process.env.DATABASE_URL
  );
} catch (err) {
  console.error(
    '❌ Invalid DATABASE_URL'
  );

  console.error(err.message);

  process.exit(1);
}

/*
 * MySQL session store
 */
const MySQLStore =
  MySQLStoreFactory(session);

/*
 * Aiven MySQL requires SSL.
 *
 * For local development using the same Aiven
 * database, this will also work.
 */
const sessionStoreOptions = {
  host: dbUrl.hostname,

  port:
    Number(dbUrl.port) || 3306,

  user:
    decodeURIComponent(
      dbUrl.username
    ),

  password:
    decodeURIComponent(
      dbUrl.password
    ),

  database:
    dbUrl.pathname.replace(
      /^\//,
      ''
    ) || 'defaultdb',

  /*
   * Session table configuration
   */
  tableName: 'sessions',

  /*
   * Automatically create the sessions table.
   */
  createDatabaseTable: true,

  /*
   * Remove expired sessions periodically.
   */
  clearExpired: true,

  /*
   * Check every 15 minutes.
   */
  checkExpirationInterval:
    1000 * 60 * 15,

  /*
   * Expire sessions after 8 hours.
   */
  expiration:
    1000 * 60 * 60 * 8,

  /*
   * Keep connection alive.
   */
  keepAlive: true,

  /*
   * Aiven SSL.
   */
  ssl: {
    rejectUnauthorized: false
  }
};

/*
 * Create persistent MySQL session store.
 */
const sessionStore =
  new MySQLStore(
    sessionStoreOptions
  );

/*
 * Session middleware
 */
app.use(
  session({
    name: 'uniguide.sid',

    secret:
      process.env.SESSION_SECRET ||
      'minsu-guidance-secret-change-this',

    store: sessionStore,

    resave: false,

    saveUninitialized: false,

    rolling: true,

    proxy: isProduction,

    cookie: {
      httpOnly: true,

      /*
       * HTTPS on Vercel.
       */
      secure: isProduction,

      /*
       * Works for normal navigation
       * between your pages.
       */
      sameSite: 'lax',

      /*
       * 8 hours.
       */
      maxAge:
        1000 * 60 * 60 * 8,

      path: '/'
    }
  })
);

/* ================================================================
   FLASH MESSAGES
================================================================ */

app.use(
  flash()
);

/*
 * Make session user and flash messages
 * available to Handlebars.
 */
app.use(
  (req, res, next) => {
    res.locals.success =
      req.flash('success');

    res.locals.error =
      req.flash('error');

    res.locals.user =
      req.session?.user || null;

    next();
  }
);

/* ================================================================
   PASSPORT
================================================================ */

/*
 * Google authentication uses:
 *
 * passport.authenticate(
 *   'google',
 *   { session: false }
 * )
 *
 * Therefore Passport does not maintain
 * the application login session.
 *
 * The actual logged-in user is stored in:
 *
 * req.session.user
 */
app.use(
  passport.initialize()
);

/* ================================================================
   STATIC FILES
================================================================ */

app.use(
  express.static(
    path.join(
      __dirname,
      'public'
    )
  )
);

/* ================================================================
   HANDLEBARS HELPERS
================================================================ */

hbs.registerHelper(
  'eq',
  (a, b) => a === b
);

hbs.registerHelper(
  'ne',
  (a, b) => a !== b
);

hbs.registerHelper(
  'or',
  (a, b) => a || b
);

hbs.registerHelper(
  'and',
  (a, b) => a && b
);

hbs.registerHelper(
  'gt',
  (a, b) => a > b
);

hbs.registerHelper(
  'includes',
  (arr, val) =>
    Array.isArray(arr) &&
    arr.includes(val)
);

/* ================================================================
   DATE HELPERS
================================================================ */

hbs.registerHelper(
  'formatDate',
  (d) => {
    if (!d) return '—';

    const date = new Date(d);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '—';
    }

    return date.toLocaleDateString(
      'en-PH',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }
    );
  }
);

hbs.registerHelper(
  'formatTime',
  (d) => {
    if (!d) return '—';

    const date = new Date(d);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '—';
    }

    return date.toLocaleTimeString(
      'en-PH',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }
    );
  }
);

hbs.registerHelper(
  'formatDateTime',
  (d) => {
    if (!d) return '—';

    const date = new Date(d);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '—';
    }

    return date.toLocaleString(
      'en-PH',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    );
  }
);

hbs.registerHelper(
  'timeAgo',
  (d) => {
    if (!d) return '—';

    const date = new Date(d);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '—';
    }

    const diff =
      Date.now() -
      date.getTime();

    const mins =
      Math.floor(
        diff / 60000
      );

    if (mins < 1) {
      return 'just now';
    }

    if (mins < 60) {
      return `${mins}m ago`;
    }

    const hrs =
      Math.floor(
        mins / 60
      );

    if (hrs < 24) {
      return `${hrs}h ago`;
    }

    return `${Math.floor(
      hrs / 24
    )}d ago`;
  }
);

/* ================================================================
   APPLICATION STATUS HELPERS
================================================================ */

hbs.registerHelper(
  'statusLabel',
  (s) => {
    const map = {
      pending: 'Pending Payment',
      payment_submitted:
        'Payment Submitted',
      payment_verified:
        'Payment Verified',
      receipt_issued:
        'Receipt Issued',
      approved: 'Approved',
      released:
        'Ready for Release',
      rejected: 'Rejected'
    };

    return map[s] || s;
  }
);

hbs.registerHelper(
  'statusClass',
  (s) => {
    const map = {
      pending: 'badge-pending',
      payment_submitted:
        'badge-submitted',
      payment_verified:
        'badge-verified',
      receipt_issued:
        'badge-receipted',
      approved:
        'badge-approved',
      released:
        'badge-released',
      rejected:
        'badge-rejected'
    };

    return map[s] || '';
  }
);

/* ================================================================
   APPOINTMENT HELPERS
================================================================ */

hbs.registerHelper(
  'apptStatusClass',
  (s) => {
    const map = {
      pending: 'badge-pending',
      approved: 'badge-verified',
      cancelled: 'badge-rejected',
      done: 'badge-released'
    };

    return map[s] || '';
  }
);

/* ================================================================
   NOTIFICATION HELPERS
================================================================ */

hbs.registerHelper(
  'notifClass',
  (t) => {
    const map = {
      success: 'notif-success',
      warning: 'notif-warning',
      danger: 'notif-danger',
      info: 'notif-info'
    };

    return map[t] || 'notif-info';
  }
);

/* ================================================================
   MATH / FORMATTING HELPERS
================================================================ */

hbs.registerHelper(
  'multiply',
  (a, b) => {
    const result =
      parseFloat(a) *
      parseFloat(b);

    if (
      Number.isNaN(result)
    ) {
      return '0.00';
    }

    return result.toFixed(2);
  }
);

hbs.registerHelper(
  'currency',
  (v) => {
    const value =
      parseFloat(v || 0);

    return `₱${
      Number.isNaN(value)
        ? '0.00'
        : value.toFixed(2)
    }`;
  }
);

hbs.registerHelper(
  'add',
  (a, b) =>
    parseFloat(a || 0) +
    parseFloat(b || 0)
);

hbs.registerHelper(
  'subtract',
  (a, b) =>
    parseFloat(a || 0) -
    parseFloat(b || 0)
);

hbs.registerHelper(
  'json',
  (v) =>
    JSON.stringify(v)
);

hbs.registerHelper(
  'list',
  (...args) =>
    args.slice(0, -1)
);

/* ================================================================
   HANDLEBARS PARTIALS
================================================================ */

const partialsDir =
  path.join(
    __dirname,
    'views',
    'partials'
  );

if (
  fs.existsSync(
    partialsDir
  )
) {
  fs.readdirSync(
    partialsDir
  )
    .filter(
      (file) =>
        file.endsWith('.xian')
    )
    .forEach(
      (file) => {
        const partialName =
          file.replace(
            '.xian',
            ''
          );

        hbs.registerPartial(
          partialName,
          fs.readFileSync(
            path.join(
              partialsDir,
              file
            ),
            'utf8'
          )
        );
      }
    );
}

/* ================================================================
   CUSTOM HANDLEBARS VIEW ENGINE
================================================================ */

app.engine(
  'xian',
  async (
    filePath,
    options,
    callback
  ) => {
    try {
      const html =
        await new Promise(
          (
            resolve,
            reject
          ) => {
            hbs.__express(
              filePath,
              options,
              (
                err,
                renderedHtml
              ) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(
                    renderedHtml
                  );
                }
              }
            );
          }
        );

      callback(
        null,
        html
      );
    } catch (err) {
      callback(
        err
      );
    }
  }
);

app.set(
  'views',
  path.join(
    __dirname,
    'views'
  )
);

app.set(
  'view engine',
  'xian'
);

/* ================================================================
   ROUTES
================================================================ */

app.use(
  '/',
  router
);

/* ================================================================
   404
================================================================ */

app.use(
  (req, res) => {
    res
      .status(404)
      .render(
        '404',
        {
          title:
            '404 — GuidanceConnect'
        }
      );
  }
);

/* ================================================================
   START DATABASE + SERVER
================================================================ */

const startServer =
  async () => {
    try {
      console.log(
        '========================================'
      );

      console.log(
        'STARTING GUIDANCECONNECT'
      );

      console.log(
        '========================================'
      );

      console.log(
        'Environment:',
        process.env.NODE_ENV ||
          'development'
      );

      console.log(
        'Port:',
        PORT
      );

      console.log(
        'Session Store:',
        'MySQL / Aiven'
      );

      console.log(
        'Session Cookie:',
        'uniguide.sid'
      );

      /* ------------------------------------------------------------
         Database
      ------------------------------------------------------------ */

      const dbReady =
        await syncDB();

      if (!dbReady) {
        console.warn(
          '⚠️ Database sync reported issues.'
        );

        console.warn(
          '⚠️ Server will continue starting.'
        );
      } else {
        console.log(
          '✅ Database ready'
        );
      }

      /* ------------------------------------------------------------
         Server
      ------------------------------------------------------------ */

      const server =
        app.listen(
          PORT,
          () => {
            console.log('');

            console.log(
              '========================================'
            );

            console.log(
              '🎓 MinSU GuidanceConnect'
            );

            console.log(
              '========================================'
            );

            console.log(
              `🌐 http://localhost:${PORT}`
            );

            console.log(
              '🔐 Session: enabled'
            );

            console.log(
              '🗄️ Database:',
              dbReady
                ? 'ready'
                : 'issues detected'
            );

            console.log(
              '💾 Session Store: MySQL'
            );

            console.log(
              '========================================'
            );

            console.log('');
          }
        );

      /* ------------------------------------------------------------
         Server errors
      ------------------------------------------------------------ */

      server.on(
        'error',
        (err) => {
          if (
            err.code ===
            'EADDRINUSE'
          ) {
            console.error('');

            console.error(
              '❌ PORT ALREADY IN USE'
            );

            console.error(
              `❌ Port ${PORT} is already being used.`
            );

            console.error('');

            console.error(
              'Try this in PowerShell:'
            );

            console.error(
              `Get-NetTCPConnection -LocalPort ${PORT}`
            );

            console.error('');

            console.error(
              'Then stop the process if necessary.'
            );

            console.error('');

            process.exit(1);
          }

          console.error(
            '❌ Server error:',
            err
          );

          process.exit(1);
        }
      );

    } catch (err) {
      console.error('');

      console.error(
        '========================================'
      );

      console.error(
        '❌ FATAL STARTUP ERROR'
      );

      console.error(
        '========================================'
      );

      console.error(err);

      console.error(
        '========================================'
      );

      process.exit(1);
    }
  };

startServer();

export default app;