// CSV to Firestore uploader with auto username/password generation
// Run: node scripts/upload-students-from-csv.js <path-to-csv>
// Example: node scripts/upload-students-from-csv.js ./KSCL-B2-Data.csv

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const crypto = require('crypto');

// Load service account key
let serviceAccount;
try {
  serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
} catch (error) {
  console.error('❌ Error: serviceAccountKey.json not found!');
  console.log('\n📝 To fix this:');
  console.log('1. Go to Firebase Console → Project Settings');
  console.log('2. Click "Service Accounts" tab');
  console.log('3. Click "Generate New Private Key"');
  console.log('4. Save the JSON file as: serviceAccountKey.json (in project root)');
  console.log('5. Run this script again');
  process.exit(1);
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();
const auth = admin.auth();

// Generate unique username from roll number
function generateUsername(rollNo) {
  return rollNo.toLowerCase().replace(/\s+/g, '');
}

// Generate secure password
function generatePassword() {
  return crypto.randomBytes(6).toString('hex'); // 12 char password
}

// Parse CSV
function parseCSV(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return records;
  } catch (error) {
    console.error('❌ Error reading CSV:', error.message);
    process.exit(1);
  }
}

async function uploadStudents(csvPath) {
  try {
    console.log(`📖 Reading CSV file: ${csvPath}\n`);
    const records = parseCSV(csvPath);

    if (!records || records.length === 0) {
      console.log('⚠️  No records found in CSV');
      process.exit(0);
    }

    console.log(`📚 Found ${records.length} students. Starting upload...\n`);
    console.log('Column mapping:');
    console.log(records[0]);
    console.log('\n' + '='.repeat(70) + '\n');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const credentials = [];

    for (const record of records) {
      try {
        // Map CSV columns (handle spaces and different formats)
        const name = record.Name?.trim() || record.name?.trim() || '';
        const rollNo = record['Rollno ']?.trim() || record.rollNo?.trim() || record.Rollno?.trim() || '';
        const year = record.year?.trim() || record.Year?.trim() || '';
        const backlogs = record['Blacklogs']?.trim() || record.backlogs?.trim() || '0';
        const email = record.Email?.trim() || record.email?.trim() || '';
        const phone = record['Phone no']?.trim() || record.phone?.trim() || '';
        const linkedin = record.LinkedIn?.trim() || record.linkedin?.trim() || '';
        const github = record.GitHub?.trim() || record.github?.trim() || '';

        if (!name || !rollNo || !email) {
          console.log(`⏭️  Skipping row - missing name, rollNo, or email`);
          skipCount++;
          continue;
        }

        // Generate credentials
        const username = generateUsername(rollNo);
        const password = generatePassword();
        const qrId = `QR-${crypto.randomBytes(8).toString('hex')}`;

        // Check if email already exists
        try {
          await auth.getUserByEmail(email);
          console.log(`⏭️  ${email} - Already exists in Auth (skipping)`);
          skipCount++;
          continue;
        } catch (error) {
          if (error.code !== 'auth/user-not-found') {
            throw error;
          }
        }

        // Create Firebase Auth user
        await auth.createUser({
          email: email,
          password: password,
          displayName: name,
          emailVerified: true,
        });

        // Create Firestore student document
        const studentDoc = {
          name: name,
          rollNo: rollNo,
          username: username,
          password: password,
          year: year || '0',
          backlogs: backlogs || '0',
          email: email,
          phoneNo: phone || '',
          linkedin: linkedin || '',
          github: github || '',
          qrId: qrId,
          createdAt: admin.firestore.Timestamp.now(),
        };

        await db.collection('students').doc(`student-${rollNo}`).set(studentDoc);

        // Store credentials for display
        credentials.push({
          name,
          rollNo,
          email,
          username,
          password,
          qrId,
        });

        console.log(`✅ ${name} (${rollNo})`);
        console.log(`   📧 Email: ${email}`);
        console.log(`   👤 Username: ${username}`);
        console.log(`   🔑 Password: ${password}`);
        console.log(`   🎫 QR ID: ${qrId}`);
        console.log('');

        successCount++;
      } catch (error) {
        console.error(`❌ ${record.Email || 'Unknown'} - Error: ${error.message}\n`);
        errorCount++;
      }
    }

    // Save credentials to file for reference
    const credentialsFile = path.join(__dirname, `../student-credentials-${Date.now()}.json`);
    fs.writeFileSync(credentialsFile, JSON.stringify(credentials, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('📊 UPLOAD SUMMARY:');
    console.log('='.repeat(70));
    console.log(`✅ Created: ${successCount}`);
    console.log(`⏭️  Skipped: ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`💾 Credentials saved: ${credentialsFile}`);
    console.log('='.repeat(70));

    if (successCount > 0) {
      console.log('\n✨ Students are now ready to log in!');
      console.log('🔑 They can use: Username/Email + Password');
      console.log(`📋 Credentials saved in: student-credentials-${Date.now()}.json`);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Get CSV path from command line or use default
const csvPath = process.argv[2] || './KSCL-B2-Data.csv';

if (!fs.existsSync(csvPath)) {
  console.error(`❌ CSV file not found: ${csvPath}`);
  console.log('\nUsage: node scripts/upload-students-from-csv.js <path-to-csv>');
  console.log('Example: node scripts/upload-students-from-csv.js ./KSCL-B2-Data.csv');
  process.exit(1);
}

uploadStudents(csvPath);
