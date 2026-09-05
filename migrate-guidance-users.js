import { sequelize } from './models/db.js';

console.log('');
console.log('========================================');
console.log('GUIDANCECONNECT USER DATABASE MIGRATION');
console.log('========================================');

try {
  await sequelize.authenticate();

  console.log('✅ Database connection successful');
  console.log('');

  // ========================================
  // 1. BACKUP CURRENT USERS
  // ========================================

  console.log('💾 Creating backup of current users...');

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

  console.log('✅ Backup created');
  console.log('');

  // ========================================
  // 2. SHOW CURRENT USERS
  // ========================================

  const [oldUsers] = await sequelize.query(`
    SELECT id, email, role
    FROM users
    ORDER BY id
  `);

  console.log('========================================');
  console.log('CURRENT USERS');
  console.log('========================================');

  console.table(oldUsers);

  // ========================================
  // 3. CREATE NEW GUIDANCECONNECT USERS TABLE
  // ========================================

  console.log('');
  console.log('🔧 Creating new GuidanceConnect users table...');

  await sequelize.query(`
    DROP TABLE IF EXISTS users_guidance_new
  `);

  await sequelize.query(`
    CREATE TABLE users_guidance_new (
      id INT NOT NULL AUTO_INCREMENT,

      firstName VARCHAR(255) NOT NULL,
      lastName VARCHAR(255) NOT NULL,

      email VARCHAR(255) NOT NULL UNIQUE,

      password VARCHAR(255) NULL,

      googleId VARCHAR(255) NULL UNIQUE,

      avatar VARCHAR(255) NULL,

      authMethod ENUM('local', 'google') DEFAULT 'local',

      role ENUM('student', 'cashier', 'guidance') DEFAULT 'student',

      studentId VARCHAR(255) NULL,
      course VARCHAR(255) NULL,
      yearLevel VARCHAR(255) NULL,
      section VARCHAR(255) NULL,
      contactNo VARCHAR(255) NULL,

      birthdate DATE NULL,
      address TEXT NULL,

      emergencyContact VARCHAR(255) NULL,
      guardianName VARCHAR(255) NULL,
      guardianContact VARCHAR(255) NULL,

      previousSchool VARCHAR(255) NULL,
      scholarshipInfo VARCHAR(255) NULL,

      profileImage VARCHAR(255) NULL,
      bio TEXT NULL,

      isApproved TINYINT(1) DEFAULT 1,

      createdAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (id)
    )
  `);

  console.log('✅ New users table created');

  // ========================================
  // 4. MIGRATE ONLY GUIDANCECONNECT USERS
  // ========================================
  //
  // Old roles:
  // admin  -> guidance
  // staff  -> cashier
  // farmer -> REMOVE
  //
  // This intentionally excludes farmer accounts.
  //

  console.log('');
  console.log('🔄 Migrating GuidanceConnect users...');
  console.log('   admin  → guidance');
  console.log('   staff  → cashier');
  console.log('   farmer → removed');

  await sequelize.query(`
    INSERT INTO users_guidance_new (
      firstName,
      lastName,
      email,
      password,
      googleId,
      avatar,
      authMethod,
      role,
      studentId,
      course,
      yearLevel,
      section,
      contactNo,
      birthdate,
      address,
      emergencyContact,
      guardianName,
      guardianContact,
      previousSchool,
      scholarshipInfo,
      profileImage,
      bio,
      isApproved,
      createdAt,
      updatedAt
    )
    SELECT
      COALESCE(firstName, ''),
      COALESCE(lastName, ''),
      email,
      password,
      googleId,
      avatar,
      CASE
        WHEN authMethod IN ('local', 'google')
          THEN authMethod
        ELSE 'local'
      END,

      CASE
        WHEN role = 'admin' THEN 'guidance'
        WHEN role = 'staff' THEN 'cashier'
        ELSE 'student'
      END,

      studentId,
      course,
      yearLevel,
      section,
      contactNo,
      birthdate,
      address,
      emergencyContact,
      guardianName,
      guardianContact,
      previousSchool,
      scholarshipInfo,
      profileImage,
      bio,
      COALESCE(isApproved, 1),
      createdAt,
      updatedAt

    FROM users
    WHERE role IN ('admin', 'staff')
  `);

  // ========================================
  // 5. SHOW NEW USERS
  // ========================================

  const [newUsers] = await sequelize.query(`
    SELECT id, firstName, lastName, email, role
    FROM users_guidance_new
    ORDER BY id
  `);

  console.log('');
  console.log('========================================');
  console.log('NEW GUIDANCECONNECT USERS');
  console.log('========================================');

  console.table(newUsers);

  // ========================================
  // 6. CHECK FOR EXISTING GUIDANCECONNECT TABLES
  // ========================================

  const [tables] = await sequelize.query(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
  `);

  const tableNames = tables.map(row => row.TABLE_NAME);

  const guidanceTables = [
    'applications',
    'appointments',
    'notifications',
    'student_profiles',
    'counseling_sessions',
    'time_slots'
  ];

  const existingGuidanceTables =
    guidanceTables.filter(table => tableNames.includes(table));

  console.log('');
  console.log('========================================');
  console.log('EXISTING GUIDANCECONNECT TABLES');
  console.log('========================================');

  console.table(existingGuidanceTables);

  // ========================================
  // 7. CHECK FOREIGN KEYS
  // ========================================

  const [fks] = await sequelize.query(`
    SELECT
      TABLE_NAME,
      COLUMN_NAME,
      CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME = 'users'
  `);

  if (fks.length > 0) {
    console.log('');
    console.log('⚠️ Existing foreign keys found:');
    console.table(fks);

    throw new Error(
      'Foreign keys still reference users. Migration stopped before replacing the table.'
    );
  }

  console.log('');
  console.log('✅ No foreign keys currently reference users');

  // ========================================
  // 8. REPLACE USERS TABLE
  // ========================================

  console.log('');
  console.log('🔄 Replacing old users table...');

  await sequelize.query(`
    RENAME TABLE
      users TO users_old_guidance_backup,
      users_guidance_new TO users
  `);

  console.log('✅ users table replaced');

  // ========================================
  // 9. RESET AUTO_INCREMENT
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
  // 10. VERIFY USERS.ID
  // ========================================

  console.log('');
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
  // 11. VERIFY ROLES
  // ========================================

  const [roles] = await sequelize.query(`
    SELECT role, COUNT(*) AS total
    FROM users
    GROUP BY role
    ORDER BY role
  `);

  console.log('');
  console.log('========================================');
  console.log('GUIDANCECONNECT ROLES');
  console.log('========================================');

  console.table(roles);

  // ========================================
  // 12. FINAL USERS
  // ========================================

  const [finalUsers] = await sequelize.query(`
    SELECT id, firstName, lastName, email, role
    FROM users
    ORDER BY id
  `);

  console.log('');
  console.log('========================================');
  console.log('FINAL USERS');
  console.log('========================================');

  console.table(finalUsers);

  console.log('');
  console.log('========================================');
  console.log('✅ MIGRATION COMPLETE');
  console.log('========================================');

  console.log('');
  console.log('Current table: users');
  console.log('Old table backup: users_old_guidance_backup');
  console.log('Original backup: users_before_guidance_migration');
  console.log(`Next AUTO_INCREMENT: ${nextId}`);

  await sequelize.close();

} catch (err) {

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
  console.error('No existing users table was replaced if the error');
  console.error('happened before the RENAME TABLE step.');

  try {
    await sequelize.close();
  } catch {}

  process.exit(1);
}