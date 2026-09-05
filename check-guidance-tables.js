import { sequelize } from './models/db.js';

console.log('');
console.log('========================================');
console.log('GUIDANCECONNECT TABLE CHECK');
console.log('========================================');

try {
  await sequelize.authenticate();

  console.log('✅ Database connection successful');
  console.log('');

  const [tables] = await sequelize.query(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);

  console.log('========================================');
  console.log('CURRENT DATABASE TABLES');
  console.log('========================================');

  console.table(tables);

  const guidanceTables = [
    'users',
    'applications',
    'announcements',
    'appointments',
    'notifications',
    'student_profiles',
    'counseling_sessions',
    'time_slots'
  ];

  for (const table of guidanceTables) {
    const exists = tables.some(row => row.TABLE_NAME === table);

    console.log(
      `${exists ? '✅' : '❌'} ${table}`
    );
  }

  console.log('');
  console.log('========================================');
  console.log('USERS');
  console.log('========================================');

  const [users] = await sequelize.query(`
    SELECT
      id,
      firstName,
      lastName,
      email,
      role,
      authMethod,
      isApproved
    FROM users
    ORDER BY id
  `);

  console.table(users);

  console.log('');
  console.log('========================================');
  console.log('USERS.ID DEFINITION');
  console.log('========================================');

  const [idInfo] = await sequelize.query(`
    SELECT
      COLUMN_NAME,
      COLUMN_TYPE,
      DATA_TYPE,
      IS_NULLABLE,
      COLUMN_KEY,
      EXTRA
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'id'
  `);

  console.table(idInfo);

  await sequelize.close();

} catch (err) {

  console.error('');
  console.error('========================================');
  console.error('❌ CHECK FAILED');
  console.error('========================================');

  console.error('Message:', err.message);

  if (err.sql) {
    console.error('SQL:', err.sql);
  }

  try {
    await sequelize.close();
  } catch {}

  process.exit(1);
}