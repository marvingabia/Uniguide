import { sequelize } from '../models/db.js';
import { QueryTypes } from 'sequelize';

async function addPurposeToTimeSlot() {
  try {
    console.log('🔄 Adding purpose field to time_slots table...');

    // Check if column already exists
    const [columns] = await sequelize.query(
      "SHOW COLUMNS FROM time_slots LIKE 'purpose'",
      { type: QueryTypes.SELECT }
    );

    if (columns) {
      console.log('✅ Column "purpose" already exists. Skipping migration.');
      return;
    }

    // Add purpose column
    await sequelize.query(`
      ALTER TABLE time_slots 
      ADD COLUMN purpose VARCHAR(100) DEFAULT 'General' AFTER timeSlot
    `);

    console.log('✅ Successfully added purpose field to time_slots table');
    console.log('   Purpose types: Counseling, Good Moral Pickup, General, etc.');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  }
}

// Run migration
addPurposeToTimeSlot()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
