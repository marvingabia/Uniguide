import { Sequelize } from 'sequelize';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Test mysql2 loading
let mysql2;

try {
  mysql2 = require('mysql2');

  console.log('✅ mysql2 loaded successfully');
  console.log('📦 mysql2 path:', require.resolve('mysql2'));

} catch (err) {
  console.error('❌ MYSQL2 LOAD FAILED');
  console.error(err);
  throw err;
}

console.log('🔍 DB Config Check:');
console.log(
  '   DATABASE_URL:',
  process.env.DATABASE_URL ? '✓ Set' : '✗ Not set'
);
console.log(
  '   NODE_ENV:',
  process.env.NODE_ENV || 'development'
);

let sequelize;

try {
  if (process.env.DATABASE_URL) {
    console.log('📍 Using DATABASE_URL connection');

    sequelize = new Sequelize(process.env.DATABASE_URL, {
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

  } else {
    console.log('📍 Using individual DB variables');

    sequelize = new Sequelize(
      process.env.DB_NAME || 'defaultdb',
      process.env.DB_USER || 'avnadmin',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
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
      }
    );
  }

  console.log('✅ Sequelize configured successfully');

} catch (err) {
  console.error('❌ Database configuration error:', err.message);
  throw err;
}

export { sequelize };