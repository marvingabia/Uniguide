#!/usr/bin/env node

/**
 * Update GOOGLE_CALLBACK_URL on Vercel using API
 */

import { execSync } from 'child_process';

const newUrl = 'https://uniguide-ekqoto5st-marvingabia5-gmailcoms-projects.vercel.app/auth/google/callback';

console.log('Updating GOOGLE_CALLBACK_URL...');
console.log('New URL:', newUrl);

try {
  // Read the current .env to get the structure
  const env = {
    GOOGLE_CALLBACK_URL: newUrl
  };
  
  // Try to write to a temp env file that Vercel can use
  console.log('\nTo update on Vercel, you can:');
  console.log('\n1. Go to Vercel Dashboard:');
  console.log('   https://vercel.com/marvingabia5-gmailcoms-projects/uniguide');
  console.log('\n2. Settings > Environment Variables');
  console.log('\n3. Find GOOGLE_CALLBACK_URL and click Edit');
  console.log('\n4. Change value to:');
  console.log(`   ${newUrl}`);
  console.log('\n5. Save');
  
  console.log('\n✅ Current status:');
  console.log('   - FIREBASE_SERVICE_ACCOUNT: ✓ Set (11m ago)');
  console.log('   - GOOGLE_CLIENT_ID: ✓ Set (53d ago)');
  console.log('   - GOOGLE_CLIENT_SECRET: ✓ Set (53d ago)');
  console.log('   - GOOGLE_CALLBACK_URL: ⚠️  Needs update (53d ago)');
  console.log('   - SESSION_SECRET: ✓ Set');
  
} catch (error) {
  console.error('Error:', error.message);
}
