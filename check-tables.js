import { sequelize } from './models/db.js';

try {
  const [tables] = await sequelize.query(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME
  `);

  console.log('');
  console.log('========================================');
  console.log('GUIDANCECONNECT DATABASE TABLES');
  console.log('========================================');

  console.table(tables);

  await sequelize.close();

} catch (err) {
  console.error('ERROR:', err.message);

  await sequelize.close();
  process.exit(1);
}