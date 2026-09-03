import { sequelize } from '../models/db.js';

/**
 * Migration script to update Application table schema
 * Run this once to ensure the database matches the new fee structure
 * 
 * COMPLETED: This migration has been successfully run.
 * Old columns (qtyAuth, qtyDocStamp) have been removed.
 * New columns (qtyGoodMoral, qtyCTC, totalAmount) are in place.
 * 
 * To run again if needed: node --env-file=.env migrations/updateApplicationSchema.js
 */

async function migrate() {
  try {
    console.log('🔄 Checking Application table schema...');

    // Check if old columns exist
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'applications' 
      AND TABLE_SCHEMA = DATABASE()
      AND COLUMN_NAME IN ('qtyAuth', 'qtyDocStamp', 'qtyGoodMoral', 'qtyCTC', 'totalAmount')
    `);

    const columnNames = results.map(r => r.COLUMN_NAME);
    console.log('Found columns:', columnNames);

    // Remove old columns if they exist
    if (columnNames.includes('qtyAuth')) {
      console.log('  - Dropping old column: qtyAuth');
      await sequelize.query('ALTER TABLE applications DROP COLUMN qtyAuth');
    }

    if (columnNames.includes('qtyDocStamp')) {
      console.log('  - Dropping old column: qtyDocStamp');
      await sequelize.query('ALTER TABLE applications DROP COLUMN qtyDocStamp');
    }

    // Add new columns if they don't exist
    if (!columnNames.includes('qtyGoodMoral')) {
      console.log('  - Adding new column: qtyGoodMoral');
      await sequelize.query('ALTER TABLE applications ADD COLUMN qtyGoodMoral INT DEFAULT 0');
    }

    if (!columnNames.includes('qtyCTC')) {
      console.log('  - Adding new column: qtyCTC');
      await sequelize.query('ALTER TABLE applications ADD COLUMN qtyCTC INT DEFAULT 0');
    }

    if (!columnNames.includes('totalAmount')) {
      console.log('  - Adding new column: totalAmount');
      await sequelize.query('ALTER TABLE applications ADD COLUMN totalAmount DECIMAL(10,2) DEFAULT 0.00');
    }

    console.log('✅ Application table schema updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
