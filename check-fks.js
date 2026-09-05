import { sequelize } from './models/db.js';

try {
  const [rows] = await sequelize.query(`
    SELECT
      TABLE_NAME,
      COLUMN_NAME,
      CONSTRAINT_NAME,
      REFERENCED_TABLE_NAME,
      REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE REFERENCED_TABLE_NAME = 'users'
      AND REFERENCED_COLUMN_NAME = 'id'
  `);

  console.log('');
  console.log('========================================');
  console.log('FOREIGN KEYS REFERENCING users.id');
  console.log('========================================');

  console.table(rows);

  console.log('========================================');
  console.log(`Found ${rows.length} foreign key(s).`);
  console.log('========================================');
} catch (err) {
  console.error('');
  console.error('❌ ERROR:', err.message);
} finally {
  await sequelize.close();
}