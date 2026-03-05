// Create Firebase Auth user for existing Firestore student
// Run: node scripts/create-auth-user.js

const admin = require('firebase-admin');

// Instructions to add service account:
// 1. Go to Firebase Console → Project Settings → Service Accounts
// 2. Click "Generate new private key"
// 3. Save as 'serviceAccountKey.json' in project root
// 4. Run this script

try {
  const serviceAccount = require('../serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();

  async function createAuthUser() {
    const email = 'abhi31mahi@gmail.com';
    const password = 'Bu3kPvB#FL2x';
    const firestoreUID = 'FElRtnj1tsVMuSxTYUZWlhw7VMe2';

    try {
      // Check if user already exists in Firebase Auth
      let authUser;
      try {
        authUser = await admin.auth().getUserByEmail(email);
        console.log('✅ User already exists in Firebase Auth');
        console.log('UID:', authUser.uid);
        
        // Update password
        await admin.auth().updateUser(authUser.uid, { password });
        console.log('✅ Password updated successfully');
        
        // Check if UIDs match
        if (authUser.uid !== firestoreUID) {
          console.log('\n⚠️  WARNING: UID MISMATCH!');
          console.log('Firebase Auth UID:', authUser.uid);
          console.log('Firestore Doc UID:', firestoreUID);
          console.log('\nYou need to update the Firestore document to use UID:', authUser.uid);
          console.log('Or recreate the auth user with the Firestore UID');
        }
        
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // Create new user with specific UID to match Firestore
          console.log('⏳ Creating user in Firebase Auth...');
          authUser = await admin.auth().createUser({
            uid: firestoreUID, // Use same UID as Firestore
            email: email,
            password: password,
            emailVerified: false,
            disabled: false
          });
          console.log('✅ User created successfully!');
          console.log('UID:', authUser.uid);
        } else {
          throw error;
        }
      }

      console.log('\n✅ DONE! User can now log in with:');
      console.log('Email:', email);
      console.log('Password:', password);
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
    
    process.exit(0);
  }

  createAuthUser();
  
} catch (error) {
  console.error('\n❌ Service account key not found!');
  console.error('\n📝 TO FIX:');
  console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
  console.error('2. Click "Generate new private key"');
  console.error('3. Save as "serviceAccountKey.json" in project root');
  console.error('4. Add to .gitignore to keep it secure');
  console.error('5. Run: node scripts/create-auth-user.js\n');
  process.exit(1);
}
