// Bulk create Firebase Auth users from Firestore students
// Run: node scripts/bulk-create-firebase-users.js

const admin = require('firebase-admin');
const path = require('path');

// Load service account key - you need to download this from Firebase Console
// Go to: Project Settings → Service Accounts → Generate new private key
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
  console.log('5. Add serviceAccountKey.json to .gitignore');
  console.log('6. Run this script again');
  process.exit(1);
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();
const auth = admin.auth();

async function bulkCreateUsers() {
  try {
    console.log('📚 Fetching all students from Firestore...\n');

    // Get all students from Firestore
    const snapshot = await db.collection('students').get();

    if (snapshot.empty) {
      console.log('⚠️  No students found in Firestore');
      process.exit(0);
    }

    const students = [];
    snapshot.forEach((doc) => {
      students.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    console.log(`Found ${students.length} students. Starting bulk creation...\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const student of students) {
      try {
        const email = student.email;
        const password = student.passwordHash; // Using stored password (ideally should be hashed)
        const displayName = student.name;

        if (!email || !password) {
          console.log(`⏭️  Skipping ${student.name} - missing email or password`);
          skipCount++;
          continue;
        }

        // Check if user already exists
        try {
          await auth.getUserByEmail(email);
          console.log(`⏭️  ${email} - Already exists (skipped)`);
          skipCount++;
          continue;
        } catch (error) {
          if (error.code !== 'auth/user-not-found') {
            throw error;
          }
        }

        // Create the user
        await auth.createUser({
          email: email,
          password: password,
          displayName: displayName,
          emailVerified: true,
        });

        console.log(`✅ ${email} - Created successfully`);
        successCount++;
      } catch (error) {
        console.error(`❌ ${student.email} - Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 BULK CREATION SUMMARY:');
    console.log('='.repeat(50));
    console.log(`✅ Created: ${successCount}`);
    console.log(`⏭️  Skipped: ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));

    if (successCount > 0) {
      console.log('\n✨ Students are now ready to log in!');
      console.log('🔑 They can use: Email/Username + Password');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

bulkCreateUsers();
