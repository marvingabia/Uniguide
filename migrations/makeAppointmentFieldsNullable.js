import { sequelize } from '../models/db.js';

async function makeAppointmentFieldsNullable() {
  try {
    console.log('🔄 Making appointment date and timeSlot fields nullable...');

    // Modify columns to allow NULL
    await sequelize.query(`
      ALTER TABLE appointments 
      MODIFY COLUMN date DATE NULL
    `);

    await sequelize.query(`
      ALTER TABLE appointments 
      MODIFY COLUMN timeSlot VARCHAR(255) NULL
    `);

    console.log('✅ Successfully updated appointments table');
    console.log('   - date field is now nullable');
    console.log('   - timeSlot field is now nullable');
    console.log('   Students can now submit requests without pre-selecting schedules!');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  }
}

// Run migration
makeAppointmentFieldsNullable()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
