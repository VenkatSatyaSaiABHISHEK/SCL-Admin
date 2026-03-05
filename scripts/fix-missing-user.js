// Script to check and manually add missing student in Firestore
// This provides the data structure - add manually in Firebase Console

const uid = 'JOBfXDKqyOaY6cFj2x38u4JOiuy2';

console.log('\n🔍 USER WITH MISSING FIRESTORE PROFILE:');
console.log('UID:', uid);
console.log('\n📝 TO FIX THIS ERROR:');
console.log('1. Open Firebase Console (https://console.firebase.google.com)');
console.log('2. Go to Authentication > Users');
console.log('3. Find user with UID:', uid);
console.log('4. Copy their email address');
console.log('5. Go to Firestore Database > students collection');
console.log('6. Click "Add Document"');
console.log('7. Document ID: ' + uid);
console.log('8. Add these fields:\n');

const studentData = {
  uid: uid,
  email: '(copy from Firebase Auth)',
  name: '(copy from Firebase Auth or enter name)',
  rollNo: '(copy email username or enter roll number)',
  role: 'student',
  department: 'Computer Science & Engineering',
  semester: '4th Semester',
  teamNumber: 5,
  initial: '(first letter of name)',
  createdAt: '(Firebase Timestamp - use "now")',
  updatedAt: '(Firebase Timestamp - use "now")'
};

console.log(JSON.stringify(studentData, null, 2));
console.log('\n✅ After adding this document, the auth error will be fixed!\n');
