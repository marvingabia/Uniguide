#!/usr/bin/env node

/**
 * Fix GOOGLE_CALLBACK_URL by updating .env and redeploying
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const newCallbackUrl = 'https://uniguide-ekqoto5st-marvingabia5-gmailcoms-projects.vercel.app/auth/google/callback';

console.log('🔧 Fixing Google OAuth Callback URL...\n');

// Read current .env
const envPath = path.resolve('.env');
let envContent = fs.readFileSync(envPath, 'utf-8');

// Check if GOOGLE_CALLBACK_URL exists and update it
if (envContent.includes('GOOGLE_CALLBACK_URL=')) {
  // Update existing
  envContent = envContent.replace(
    /GOOGLE_CALLBACK_URL=.*/,
    `GOOGLE_CALLBACK_URL=${newCallbackUrl}`
  );
  console.log('✓ Updated GOOGLE_CALLBACK_URL in .env');
} else {
  // Add new
  envContent += `\n# Updated for Vercel production\nGOOGLE_CALLBACK_URL=${newCallbackUrl}\n`;
  console.log('✓ Added GOOGLE_CALLBACK_URL to .env');
}

// Write back
fs.writeFileSync(envPath, envContent);
console.log(`✓ .env updated with: ${newCallbackUrl}\n`);

// Now we need to manually add this to Vercel
console.log('📝 Next step - Add to Vercel:');
console.log('─'.repeat(60));
console.log('\nRun this command with the value when prompted:');
console.log(`  echo "${newCallbackUrl}" | vercel env update GOOGLE_CALLBACK_URL production`);
console.log('\nOr do it manually in Vercel Dashboard:');
console.log('  1. https://vercel.com/marvingabia5-gmailcoms-projects/uniguide');
console.log('  2. Settings > Environment Variables');
console.log('  3. Edit GOOGLE_CALLBACK_URL');
console.log(`  4. Value: ${newCallbackUrl}`);
console.log('  5. Save');
console.log('\n' + '─'.repeat(60));

console.log('\n✅ Local .env is ready. Push changes and redeploy.');
