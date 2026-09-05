import { sequelize } from './models/db.js';

// Import all GuidanceConnect models + associations
import './models/index.js';

console.log('');
console.log('========================================');
console.log('GUIDANCECONNECT DATABASE CLEANUP');
console.log('========================================');

const oldFarmerTables = [
  'benefits',
  'claims',
  'conversations',
  'damage_reports',
  'insurance',
  'inventory',
  'messages',
  'request_letters',
  'sessions'
];

try {
  await sequelize.authenticate();

  console.log('✅ Database connection successful');
  console.log('');

  // ========================================
  // 1. REMOVE OLD FARMER TABLES
  // ========================================

  console.log('🗑️ Removing old Farmer tables...');

  // Disable FK checks temporarily so old Farmer
  // foreign keys do not block table removal.
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

  for (const table of oldFarmerTables) {
    console.log(`   → Dropping ${table}...`);

    await sequelize.query(`DROP TABLE IF EXISTS \`${table}\``);
  }

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('✅ Old Farmer tables removed');
  console.log('');

  // ========================================
  // 2. FIX USERS.ID
  // ========================================

  console.log('🔧 Checking users.id...');

  const [userColumns] = await sequelize.query(`
    SELECT
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

  if (userColumns.length === 0) {
    throw new Error('users table does not exist');
  }

  console.table(userColumns);

  console.log('🔧 Converting users.id to INT AUTO_INCREMENT...');

  await sequelize.query(`
    ALTER TABLE users
    MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT
  `);

  console.log('✅ users.id is now INT AUTO_INCREMENT');
  console.log('');

  // ========================================
  // 3. FIX USER ROLE
  // ========================================

  console.log('🔧 Updating users.role for GuidanceConnect...');

  /*
   * Old Farmer system:
   * farmer / staff / admin
   *
   * GuidanceConnect:
   * student / cashier / guidance
   *
   * Mapping:
   * farmer -> student
   * staff  -> guidance
   * admin  -> guidance
   */

  await sequelize.query(`
    ALTER TABLE users
    MODIFY COLUMN role VARCHAR(50) NOT NULL
  `);

  await sequelize.query(`
    UPDATE users
    SET role = 'student'
    WHERE role = 'farmer'
  `);

  await sequelize.query(`
    UPDATE users
    SET role = 'guidance'
    WHERE role IN ('staff', 'admin')
  `);

  await sequelize.query(`
    ALTER TABLE users
    MODIFY COLUMN role ENUM('student', 'cashier', 'guidance')
    NOT NULL DEFAULT 'student'
  `);

  console.log('✅ users.role updated');
  console.log('');

  // ========================================
  // 4. REMOVE DUPLICATE OLD COLUMNS IF NEEDED
  // ========================================

  console.log('🔧 Checking users table structure...');

  const [columns] = await sequelize.query(`
    SELECT
      COLUMN_NAME,
      COLUMN_TYPE,
      IS_NULLABLE,
      COLUMN_DEFAULT
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
    ORDER BY ORDINAL_POSITION
  `);

  console.table(columns);

  // ========================================
  // 5. CREATE GUIDANCECONNECT TABLES
  // ========================================

  console.log('');
  console.log('🔄 Creating GuidanceConnect tables...');

  /*
   * alter: false means:
   * - Existing tables are NOT aggressively modified
   * - Missing tables are created
   * - We already manually fixed users.id and users.role
   */
  await sequelize.sync({ alter: false });

  console.log('✅ GuidanceConnect tables synced');
  console.log('');

  // ========================================
  // 6. SHOW FINAL TABLES
  // ========================================

  console.log('========================================');
  console.log('FINAL GUIDANCECONNECT TABLES');
  console.log('========================================');

  const [tables] = await sequelize.query(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);

  console.table(tables);

  console.log('');
  console.log('========================================');
  console.log('✅ CLEANUP COMPLETE');
  console.log('========================================');

  await sequelize.close();
  process.exit(0);

} catch (err) {

  // Always try to restore FK checks
  try {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  } catch {}

  console.error('');
  console.error('========================================');
  console.error('❌ CLEANUP FAILED');
  console.error('========================================');
  console.error('Message:', err.message);

  if (err.code) {
    console.error('Code:', err.code);
  }

  if (err.sql) {
    console.error('SQL:', err.sql);
  }

  console.error('');
  console.error('No further database changes were attempted.');

  try {
    await sequelize.close();
  } catch {}

  process.exit(1);
}