#!/usr/bin/env node

/**
 * Push GOOGLE_CALLBACK_URL to Vercel using REST API
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

const newCallbackUrl = 'https://uniguide-ekqoto5st-marvingabia5-gmailcoms-projects.vercel.app/auth/google/callback';

// Try to read Vercel token from .vercel/auth.json
function getVercelToken() {
  try {
    const authPath = path.join(process.env.USERPROFILE, '.vercel', 'auth.json');
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
    return auth.token;
  } catch (e) {
    return null;
  }
}

const token = getVercelToken();

if (!token) {
  console.log('❌ Could not find Vercel token at ~/.vercel/auth.json');
  console.log('\n📝 Manual fix required:');
  console.log('   Go to: https://vercel.com/marvingabia5-gmailcoms-projects/uniguide');
  console.log('   Settings > Environment Variables');
  console.log('   Edit GOOGLE_CALLBACK_URL');
  console.log(`   Value: ${newCallbackUrl}`);
  process.exit(1);
}

console.log('🚀 Pushing to Vercel API...\n');

const options = {
  hostname: 'api.vercel.com',
  port: 443,
  path: '/v9/projects/uniguide/env/GOOGLE_CALLBACK_URL?teamId=marvingabia5-gmailcoms-projects',
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
};

const data = JSON.stringify({
  value: newCallbackUrl,
  target: ['production']
});

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(body);
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('✅ Successfully updated GOOGLE_CALLBACK_URL on Vercel!');
        console.log(`   URL: ${newCallbackUrl}`);
        console.log('\n🔄 Vercel will automatically redeploy...');
        console.log('⏳ Check deployment status: https://vercel.com/marvingabia5-gmailcoms-projects/uniguide/deployments');
      } else {
        console.log('⚠️  Response:', result);
      }
    } catch (e) {
      console.log('Response:', body);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Error:', e.message);
});

req.write(data);
req.end();

console.log('Request sent...');
