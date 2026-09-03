/**
 * Staff Account Seeder
 * Creates default Guidance and Cashier accounts.
 * Run once: node seeders/createStaffAccounts.js
 */

import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import { sequelize } from '../models/db.js';
import { User } from '../models/User.js';

const staffAccounts = [
  {
    firstName:  'Guidance',
    lastName:   'Officer',
    email:      'guidance@minsu.edu.ph',
    password:   'Guidance@2025',
    role:       'guidance',
  },
  {
    firstName:  'Cashier',
    lastName:   'Officer',
    email:      'cashier@minsu.edu.ph',
    password:   'Cashier@2025',
    role:       'cashier',
  }
];

const seed = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log('✅ Connected to database\n');

    for (const staff of staffAccounts) {
      const existing = await User.findOne({ where: { email: staff.email } });

      if (existing) {
        console.log(`⚠️  Account already exists: ${staff.email} (skipped)`);
        continue;
      }

      const hashed = await bcrypt.hash(staff.password, 10);
      await User.create({
        firstName:  staff.firstName,
        lastName:   staff.lastName,
        email:      staff.email,
        password:   hashed,
        role:       staff.role,
        authMethod: 'local',
        isApproved: true
      });

      console.log(`✅ Created ${staff.role} account:`);
      console.log(`   Email   : ${staff.email}`);
      console.log(`   Password: ${staff.password}\n`);
    }

    console.log('🎓 Done! You can now login with the accounts above.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeder error:', err.message);
    process.exit(1);
  }
};

seed();
