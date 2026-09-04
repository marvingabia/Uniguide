import { Sequelize } from 'sequelize';

// Log environment for debugging
console.log('🔍 DB Config Check:');
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Not set');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');

let sequelize;

try {
  if (process.env.DATABASE_URL) {
    console.log('📍 Using DATABASE_URL connection');
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'mysql',
      dialectOptions: { 
        ssl: { require: true, rejectUnauthorized: false },
        supportBigNumbers: true,
        bigNumberStrings: true
      },
      logging: false,
      pool: { max: 5, min: 0, idle: 10000 }
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
        logging: false,
        pool: { max: 5, min: 0, idle: 10000 },
        dialectOptions: {
          supportBigNumbers: true,
          bigNumberStrings: true,
          ssl: { require: true, rejectUnauthorized: false }
        }
      }
    );
  }
} catch (err) {
  console.error('❌ Database configuration error:', err.message);
  throw err;
}

export { sequelize };
