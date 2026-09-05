import { sequelize } from './models/db.js';

console.log('');
console.log('========================================');
console.log('GUIDANCECONNECT USER ID MIGRATION');
console.log('========================================');

try {
  await sequelize.authenticate();

  console.log('✅ Database connection successful');
  console.log('');

  // ========================================
  // 1. BACKUP USERS
  // ========================================

  console.log('💾 Creating users backup...');

  await sequelize.query(`
    DROP TABLE IF EXISTS users_before_guidance_migration
  `);

  await sequelize.query(`
    CREATE TABLE users_before_guidance_migration LIKE users
  `);

  await sequelize.query(`
    INSERT INTO users_before_guidance_migration
    SELECT * FROM users
  `);

  console.log('✅ Users backup created');
  console.log('');

  // ========================================
  // 2. SHOW CURRENT USERS
  // ========================================

  console.log('👥 Current users:');

  const [users] = await sequelize.query(`
    SELECT id, firstName, lastName, email, role
    FROM users
    ORDER BY id
  `);

  console.table(users);

  if (users.length === 0) {
    throw new Error('No users found. Migration stopped.');
  }

  console.log(`Found ${users.length} user(s).`);
  console.log('');

  // ========================================
  // 3. DISABLE FOREIGN KEY CHECKS
  // ========================================

  console.log('🔒 Disabling foreign key checks...');

  await sequelize.query(`
    SET FOREIGN_KEY_CHECKS = 0
  `);

  // ========================================
  // 4. ADD TEMPORARY ID
  // ========================================

  console.log('🔧 Creating temporary integer ID...');

  await sequelize.query(`
    ALTER TABLE users
    ADD COLUMN guidance_new_id INT NULL
  `);

  // ========================================
  // 5. GENERATE NEW INTEGER IDs
  // ========================================

  console.log('🔄 Generating new integer IDs...');

  await sequelize.query(`
    SET @new_id = 0
  `);

  await sequelize.query(`
    UPDATE users
    SET guidance_new_id = (@new_id := @new_id + 1)
    ORDER BY id
  `);

  const [mapping] = await sequelize.query(`
    SELECT
      id AS old_id,
      guidance_new_id AS new_id,
      firstName,
      lastName,
      email,
      role
    FROM users
    ORDER BY guidance_new_id
  `);

  console.log('');
  console.log('========================================');
  console.log('ID MAPPING');
  console.log('========================================');

  console.table(mapping);

  // ========================================
  // 6. DROP OLD PRIMARY KEY
  // ========================================

  console.log('');
  console.log('🔧 Removing old primary key...');

  await sequelize.query(`
    ALTER TABLE users
    DROP PRIMARY KEY
  `);

  // ========================================
  // 7. DROP OLD VARCHAR ID
  // ========================================

  console.log('🔧 Removing old VARCHAR id...');

  await sequelize.query(`
    ALTER TABLE users
    DROP COLUMN id
  `);

  // ========================================
  // 8. RENAME NEW ID
  // ========================================

  console.log('🔧 Creating new INT AUTO_INCREMENT id...');

  await sequelize.query(`
    ALTER TABLE users
    CHANGE COLUMN guidance_new_id
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY
  `);

  // ========================================
  // 9. SET AUTO_INCREMENT
  // ========================================

  const [maxResult] = await sequelize.query(`
    SELECT COALESCE(MAX(id), 0) + 1 AS next_id
    FROM users
  `);

  const nextId = Number(maxResult[0].next_id);

  await sequelize.query(`
    ALTER TABLE users AUTO_INCREMENT = ${nextId}
  `);

  // ========================================
  // 10. RESTORE FK CHECKS
  // ========================================

  await sequelize.query(`
    SET FOREIGN_KEY_CHECKS = 1
  `);

  console.log('🔓 Foreign key checks restored');
  console.log('');

  // ========================================
  // 11. VERIFY USERS.ID
  // ========================================

  console.log('========================================');
  console.log('VERIFYING users.id');
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

  // ========================================
  // 12. SHOW UPDATED USERS
  // ========================================

  console.log('');
  console.log('========================================');
  console.log('UPDATED USERS');
  console.log('========================================');

  const [updatedUsers] = await sequelize.query(`
    SELECT id, firstName, lastName, email, role
    FROM users
    ORDER BY id
  `);

  console.table(updatedUsers);

  console.log('');
  console.log('========================================');
  console.log('✅ USER ID MIGRATION COMPLETE');
  console.log('========================================');

  console.log('');
  console.log('Backup table: users_before_guidance_migration');
  console.log(`Next AUTO_INCREMENT ID: ${nextId}`);

  await sequelize.close();

} catch (err) {

  try {
    await sequelize.query(`
      SET FOREIGN_KEY_CHECKS = 1
    `);
  } catch {}

  console.error('');
  console.error('========================================');
  console.error('❌ MIGRATION FAILED');
  console.error('========================================');
  console.error('Message:', err.message);

  if (err.code) {
    console.error('Code:', err.code);
  }

  if (err.sql) {
    console.error('SQL:', err.sql);
  }

  console.error('');
  console.error('Backup table: users_before_guidance_migration');

  try {
    await sequelize.close();
  } catch {}

  process.exit(1);
}