#!/usr/bin/env node

/**
 * Setup helper for Vercel deployment
 * This script helps generate the FIREBASE_SERVICE_ACCOUNT env variable value
 * Usage: node scripts/setup-vercel-env.js
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function main() {
  console.log('\n📋 Vercel Environment Setup Helper');
  console.log('==================================\n');

  try {
    // Check if firebase-key.json exists
    const firebaseKeyPath = path.resolve('./firebase-key.json');
    
    if (!fs.existsSync(firebaseKeyPath)) {
      console.error('❌ firebase-key.json not found!');
      console.log('   Please make sure firebase-key.json exists in the project root.\n');
      process.exit(1);
    }

    // Read the file
    console.log('✅ Found firebase-key.json');
    const firebaseKeyContent = fs.readFileSync(firebaseKeyPath, 'utf8');
    
    try {
      JSON.parse(firebaseKeyContent);
      console.log('✅ firebase-key.json is valid JSON\n');
    } catch (e) {
      console.error('❌ firebase-key.json is not valid JSON!');
      console.error(e.message);
      process.exit(1);
    }

    console.log('📝 To deploy on Vercel, add this environment variable:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Variable Name: FIREBASE_SERVICE_ACCOUNT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Variable Value (copy and paste):\n');
    console.log(firebaseKeyContent);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Steps:');
    console.log('1. Go to Vercel Dashboard → Your Project → Settings');
    console.log('2. Click "Environment Variables"');
    console.log('3. Add new variable:');
    console.log('   - Name: FIREBASE_SERVICE_ACCOUNT');
    console.log('   - Value: [Paste the content above]');
    console.log('   - Environment: Production, Preview, Development');
    console.log('4. Click "Save"');
    console.log('5. Go to Deployments and redeploy\n');

    const saved = await prompt('Would you like to save this to a file? (y/n) ');
    
    if (saved.toLowerCase() === 'y') {
      const outputPath = path.resolve('./vercel-env-value.txt');
      fs.writeFileSync(outputPath, firebaseKeyContent);
      console.log(`\n✅ Saved to: ${outputPath}`);
      console.log('   You can copy the content from this file directly to Vercel\n');
    }

    console.log('✅ Setup complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
