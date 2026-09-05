import { sequelize } from './models/db.js';

try {
  const [rows] = await sequelize.query(`
    SELECT
      kcu.TABLE_NAME,
      kcu.COLUMN_NAME,
      kcu.CONSTRAINT_NAME,
      c.COLUMN_TYPE AS FK_COLUMN_TYPE,
      c.DATA_TYPE AS FK_DATA_TYPE,
      c.CHARACTER_MAXIMUM_LENGTH,
      c.IS_NULLABLE,
      c.COLUMN_DEFAULT
    FROM information_schema.KEY_COLUMN_USAGE kcu
    JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      AND c.TABLE_NAME = kcu.TABLE_NAME
      AND c.COLUMN_NAME = kcu.COLUMN_NAME
    WHERE kcu.TABLE_SCHEMA = DATABASE()
      AND kcu.REFERENCED_TABLE_NAME = 'users'
      AND kcu.REFERENCED_COLUMN_NAME = 'id'
    GROUP BY
      kcu.TABLE_NAME,
      kcu.COLUMN_NAME,
      kcu.CONSTRAINT_NAME,
      c.COLUMN_TYPE,
      c.DATA_TYPE,
      c.CHARACTER_MAXIMUM_LENGTH,
      c.IS_NULLABLE,
      c.COLUMN_DEFAULT
    ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME;
  `);

  console.log('');
  console.log('========================================');
  console.log('USER FOREIGN KEY COLUMN TYPES');
  console.log('========================================');

  console.table(rows);

  console.log('');
  console.log(`Found ${rows.length} foreign-key definition(s).`);
  console.log('========================================');

} catch (err) {
  console.error('');
  console.error('❌ ERROR:', err.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}