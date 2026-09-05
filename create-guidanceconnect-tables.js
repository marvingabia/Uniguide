import { sequelize } from './models/db.js';

console.log('');
console.log('========================================');
console.log('GUIDANCECONNECT TABLE CREATION');
console.log('========================================');

const tables = [
  'applications',
  'appointments',
  'student_profiles',
  'counseling_sessions',
  'time_slots'
];

async function createTables() {
  try {
    await sequelize.authenticate();

    console.log('✅ Database connection successful');
    console.log('');

    // --------------------------------------------------
    // APPLICATIONS
    // --------------------------------------------------
    console.log('🔧 Creating applications...');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id INT NOT NULL AUTO_INCREMENT,
        userId INT NOT NULL,

        surname VARCHAR(255) NOT NULL,
        givenName VARCHAR(255) NOT NULL,
        middleName VARCHAR(255) NULL,

        gender ENUM('Male', 'Female', 'Other') NOT NULL,
        contactNumber VARCHAR(255) NOT NULL,

        course VARCHAR(255) NOT NULL,
        major VARCHAR(255) NULL,
        yearLevel VARCHAR(255) NULL,
        section VARCHAR(255) NULL,

        enrollmentStatus ENUM(
          'currently_enrolled',
          'was_enrolled',
          'graduated'
        ) NOT NULL,

        academicYear VARCHAR(255) NULL,
        semester ENUM('1st', '2nd') NULL,
        monthYearGraduated VARCHAR(255) NULL,

        purposes TEXT NOT NULL,
        otherPurpose VARCHAR(255) NULL,

        qtyGoodMoral INT DEFAULT 0,
        qtyCTC INT DEFAULT 0,
        totalAmount DECIMAL(10,2) DEFAULT 0.00,

        paymentMethod ENUM('GCash', 'LandBank', 'Cash') NULL,
        paymentScreenshot VARCHAR(255) NULL,
        referenceNumber VARCHAR(255) NULL,
        paymentDate DATE NULL,

        orNumber VARCHAR(255) NULL,
        receiptFile VARCHAR(255) NULL,

        releasedAt DATETIME NULL,
        releasedBy VARCHAR(255) NULL,

        claimStatus ENUM('unclaimed', 'claimed') DEFAULT 'unclaimed',

        status ENUM(
          'pending',
          'payment_submitted',
          'payment_verified',
          'receipt_issued',
          'approved',
          'released',
          'rejected'
        ) DEFAULT 'pending',

        remarks TEXT NULL,

        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,

        PRIMARY KEY (id),

        CONSTRAINT applications_user_fk
          FOREIGN KEY (userId)
          REFERENCES users(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      )
    `);

    console.log('   ✅ applications created');

    // --------------------------------------------------
    // APPOINTMENTS
    // --------------------------------------------------
    console.log('🔧 Creating appointments...');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INT NOT NULL AUTO_INCREMENT,
        userId INT NOT NULL,
        timeSlotId INT NULL,

        purpose VARCHAR(255) NOT NULL,
        date DATE NULL,
        timeSlot VARCHAR(255) NULL,
        notes TEXT NULL,

        status ENUM(
          'pending',
          'approved',
          'cancelled',
          'done'
        ) DEFAULT 'pending',

        cancelReason VARCHAR(255) NULL,

        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,

        PRIMARY KEY (id),

        CONSTRAINT appointments_user_fk
          FOREIGN KEY (userId)
          REFERENCES users(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      )
    `);

    console.log('   ✅ appointments created');

    // --------------------------------------------------
    // STUDENT PROFILES
    // --------------------------------------------------
    console.log('🔧 Creating student_profiles...');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS student_profiles (
        id INT NOT NULL AUTO_INCREMENT,
        userId INT NOT NULL,

        birthdate DATE NULL,
        address TEXT NULL,

        guardianName VARCHAR(255) NULL,
        guardianContact VARCHAR(255) NULL,
        emergencyContact VARCHAR(255) NULL,

        previousSchool VARCHAR(255) NULL,
        scholarshipInfo TEXT NULL,

        behavioralNotes TEXT NULL,

        caseType ENUM(
          'none',
          'academic',
          'behavioral',
          'personal',
          'family',
          'health',
          'other'
        ) DEFAULT 'none',

        riskLevel ENUM(
          'low',
          'moderate',
          'high'
        ) DEFAULT 'low',

        totalSessions INT DEFAULT 0,
        lastSessionDate DATETIME NULL,
        lastSessionNotes TEXT NULL,

        isActive BOOLEAN DEFAULT TRUE,
        remarks TEXT NULL,

        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,

        PRIMARY KEY (id),

        UNIQUE KEY student_profiles_user_unique (userId),

        CONSTRAINT student_profiles_user_fk
          FOREIGN KEY (userId)
          REFERENCES users(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      )
    `);

    console.log('   ✅ student_profiles created');

    // --------------------------------------------------
    // COUNSELING SESSIONS
    // --------------------------------------------------
    console.log('🔧 Creating counseling_sessions...');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS counseling_sessions (
        id INT NOT NULL AUTO_INCREMENT,

        userId INT NOT NULL,
        counselorId INT NULL,

        sessionDate DATETIME NOT NULL,
        duration INT NULL,

        sessionType ENUM(
          'individual',
          'group',
          'crisis',
          'follow-up'
        ) DEFAULT 'individual',

        topic VARCHAR(255) NULL,
        notes TEXT NULL,
        actionPlan TEXT NULL,

        followUpDate DATETIME NULL,

        status ENUM(
          'scheduled',
          'completed',
          'cancelled',
          'no-show'
        ) DEFAULT 'completed',

        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,

        PRIMARY KEY (id),

        CONSTRAINT counseling_sessions_user_fk
          FOREIGN KEY (userId)
          REFERENCES users(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,

        CONSTRAINT counseling_sessions_counselor_fk
          FOREIGN KEY (counselorId)
          REFERENCES users(id)
          ON DELETE SET NULL
          ON UPDATE CASCADE
      )
    `);

    console.log('   ✅ counseling_sessions created');

    // --------------------------------------------------
    // TIME SLOTS
    // --------------------------------------------------
    console.log('🔧 Creating time_slots...');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS time_slots (
        id INT NOT NULL AUTO_INCREMENT,

        counselorId INT NOT NULL,

        date DATE NOT NULL,
        timeSlot VARCHAR(255) NOT NULL,

        purpose VARCHAR(255) DEFAULT 'General',

        maxSlots INT DEFAULT 1,
        bookedCount INT DEFAULT 0,

        isAvailable BOOLEAN DEFAULT TRUE,

        notes TEXT NULL,

        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,

        PRIMARY KEY (id),

        KEY time_slots_date_time_idx (date, timeSlot),

        CONSTRAINT time_slots_counselor_fk
          FOREIGN KEY (counselorId)
          REFERENCES users(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      )
    `);

    console.log('   ✅ time_slots created');

    // --------------------------------------------------
    // VERIFY
    // --------------------------------------------------
    console.log('');
    console.log('========================================');
    console.log('VERIFYING GUIDANCECONNECT TABLES');
    console.log('========================================');

    const [rows] = await sequelize.query(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'users',
          'applications',
          'announcements',
          'appointments',
          'notifications',
          'student_profiles',
          'counseling_sessions',
          'time_slots'
        )
      ORDER BY TABLE_NAME
    `);

    console.table(rows);

    console.log('');
    console.log('========================================');
    console.log('✅ GUIDANCECONNECT DATABASE READY');
    console.log('========================================');

  } catch (err) {
    console.log('');
    console.log('========================================');
    console.log('❌ TABLE CREATION FAILED');
    console.log('========================================');

    console.error('Message:', err.message);

    if (err.sql) {
      console.error('SQL:', err.sql);
    }

    process.exitCode = 1;

  } finally {
    await sequelize.close();
  }
}

createTables();