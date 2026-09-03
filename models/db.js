import { Sequelize } from 'sequelize';

// Log environment for debugging
console.log('🔍 DB Config Check:');
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Not set');
console.log('   DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('   DB_NAME:', process.env.DB_NAME || 'guidance');

export const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'mysql',
      dialectOptions: { 
        ssl: { require: true, rejectUnauthorized: false },
        supportBigNumbers: true,
        bigNumberStrings: true
      },
      logging: false,
      pool: { max: 5, min: 0, idle: 10000 }
    })
  : new Sequelize(
      process.env.DB_NAME || 'guidance',
      process.env.DB_USER || 'root',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false,
        pool: { max: 5, min: 0, idle: 10000 },
        dialectOptions: {
          supportBigNumbers: true,
          bigNumberStrings: true
        }
      }
    );
