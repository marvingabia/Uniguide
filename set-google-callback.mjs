#!/usr/bin/env node

/**
 * Set GOOGLE_CALLBACK_URL on Vercel using the CLI
 * This version uses the non-interactive update command
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const newCallbackUrl = 'https://uniguide-ekqoto5st-marvingabia5-gmailcoms-projects.vercel.app/auth/google/callback';

console.log('🔐 Setting GOOGLE_CALLBACK_URL on Vercel...');
console.log(`New URL: ${newCallbackUrl}\n`);

// Since the Vercel CLI doesn't support non-interactive updates easily,
// we'll document what needs to be done manually
console.log(`To set this via CLI, you would run:
echo '${newCallbackUrl}' | vercel env update GOOGLE_CALLBACK_URL production

However, the CLI will prompt for confirmation. Here's what to do:

OPTION 1 - Via Vercel Dashboard (Easier):
1. Go to: https://vercel.com/marvingabia5-gmailcoms-projects/uniguide
2. Click "Settings" in the top menu
3. Click "Environment Variables" in the left sidebar
4. Find "GOOGLE_CALLBACK_URL"
5. Click the three dots and select "Edit"
6. Change the value to:
   ${newCallbackUrl}
7. Save

OPTION 2 - Via CLI (requires confirmation):
Run this command and answer 'y' when prompted:
echo '${newCallbackUrl}' | vercel env update GOOGLE_CALLBACK_URL production

After updating, also make sure to add this URL to Google OAuth:
1. Go to: https://console.cloud.google.com/apis/credentials
2. Find "UniGuide Web Client" OAuth 2.0 Client ID
3. Click Edit
4. Add this to Authorized redirect URIs:
   ${newCallbackUrl}
5. Save
`);
