/**
 * One-time Gmail OAuth setup script.
 * Run: node scripts/gmail-auth.js
 *
 * Prerequisites:
 *   1. credentials.json downloaded from Google Cloud Console
 *      (OAuth 2.0 Desktop App credentials)
 *   2. Place credentials.json in the app/ root directory
 *
 * On success: creates token.json (do NOT commit this to git)
 */

const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const TOKEN_PATH = path.join(__dirname, '../token.json');
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

if (!fs.existsSync(CREDENTIALS_PATH)) {
  console.error(`\n❌ credentials.json not found at ${CREDENTIALS_PATH}`);
  console.error('Please download OAuth 2.0 Desktop App credentials from Google Cloud Console');
  console.error('and place the file at:', CREDENTIALS_PATH);
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const authUrl = auth.generateAuthUrl({ access_type: 'offline', scope: SCOPES });

console.log('\n🔐 Gmail OAuth Setup\n');
console.log('1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Sign in with finn@finnworks.ai');
console.log('3. Grant access');
console.log('4. Copy the authorization code and paste it below\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Paste authorization code: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await auth.getToken(code.trim());
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log(`\n✅ token.json saved to ${TOKEN_PATH}`);
    console.log('Gmail API is ready. You can now send emails from finn@finnworks.ai');
  } catch (err) {
    console.error('\n❌ Error getting token:', err.message);
  }
});
