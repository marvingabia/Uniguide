#!/usr/bin/env node

/**
 * Update Vercel environment variables
 * Usage: node update-vercel-env.mjs
 */

import { execSync } from 'child_process';

const newCallbackUrl = 'https://uniguide-ekqoto5st-marvingabia5-gmailcoms-projects.vercel.app/auth/google/callback';

console.log('📝 Updating Vercel environment variables...\n');

// Update GOOGLE_CALLBACK_URL
console.log('1. Updating GOOGLE_CALLBACK_URL...');
console.log(`   New URL: ${newCallbackUrl}`);

try {
  // Try to update via piping
  execSync(`echo "${newCallbackUrl}" | vercel env update GOOGLE_CALLBACK_URL production --confirm 2>&1 || true`, { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✓ Done\n');
} catch (error) {
  console.log('⚠️  Could not auto-update (interactive prompt). Do this manually:\n');
  console.log(`   Run: echo "${newCallbackUrl}" | vercel env update GOOGLE_CALLBACK_URL production\n`);
}

// List current env vars
console.log('2. Current environment variables on Vercel:');
try {
  execSync('vercel env list production', { stdio: 'inherit', cwd: process.cwd() });
} catch (error) {
  console.log('   (Could not fetch - try manually)\n');
}

console.log('\n✅ Setup complete!');
console.log('\nNext steps:');
console.log('1. Visit: https://uniguide-ekqoto5st-marvingabia5-gmailcoms-projects.vercel.app/login');
console.log('2. Click "Sign in with Google"');
console.log('3. Test navigation to ensure sessions persist');
