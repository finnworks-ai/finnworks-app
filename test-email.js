require('dotenv').config();
const { sendAuditEmail } = require('./src/email/gmail');
const fs = require('fs');
const path = require('path');

// Use the test PDF we just generated
const pdfPath = fs.readdirSync('.').filter(f => f.startsWith('test-report-'))[0];
if (!pdfPath) {
  console.error('No test PDF found. Run test-pipeline.js first.');
  process.exit(1);
}

const pdfBuffer = fs.readFileSync(pdfPath);
const testEmail = 'msconsultingnz@gmail.com';
const testUrl = 'https://narrative.so';

console.log(`Testing email send with new HTML format...`);
console.log(`  From: finn@finnworks.ai`);
console.log(`  To: ${testEmail}`);
console.log(`  PDF: ${pdfPath} (${pdfBuffer.length} bytes)`);

sendAuditEmail({
  to: testEmail,
  websiteUrl: testUrl,
  pdfBuffer,
  overallScore: 58
})
  .then(result => {
    console.log(`✅ Email sent successfully`);
    console.log(`   Message ID: ${result.messageId}`);
  })
  .catch(err => {
    console.error(`❌ Email send failed:`, err.message);
    process.exit(1);
  });
