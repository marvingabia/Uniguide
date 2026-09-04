import { Sequelize } from 'sequelize';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const mysql2 = require('mysql2');

console.log('========================================');
console.log('DATABASE CONFIG');
console.log('========================================');

console.log(
  'DATABASE_URL:',
  process.env.DATABASE_URL ? '✓ Set' : '✗ Not set'
);

console.log(
  'NODE_ENV:',
  process.env.NODE_ENV || 'development'
);

let sequelize;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured');
}

try {
  const dbUrl = new URL(process.env.DATABASE_URL);

  console.log('📍 Using Aiven DATABASE_URL');
  console.log('DB Host:', dbUrl.hostname);
  console.log('DB Port:', dbUrl.port);
  console.log('DB Name:', dbUrl.pathname.replace(/^\/+/, ''));

  // Remove query parameters such as ssl-mode=REQUIRED
  dbUrl.search = '';

  sequelize = new Sequelize(dbUrl.toString(), {
    dialect: 'mysql',
    dialectModule: mysql2,

    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      },
      supportBigNumbers: true,
      bigNumberStrings: true
    },

    logging: false,

    pool: {
      max: 5,
      min: 0,
      idle: 10000,
      acquire: 30000
    }
  });

  console.log('✅ Sequelize configured successfully');

} catch (err) {
  console.error('❌ DATABASE CONFIG ERROR');
  console.error(err.message);
  throw err;
}

export { sequelize };