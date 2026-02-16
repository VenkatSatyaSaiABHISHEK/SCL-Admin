// Simple script to upload demo student to Firestore
// Run: node scripts/upload-demo-student.js

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function uploadStudent() {
  const student = {
    name: 'Abhi',
    rollNo: '23B21A4565',
    year: '3',
    backlogs: '0',
    email: 'abhi@example.com',
    phoneNo: '9876543210',
    linkedin: '',
    github: '',
    username: '23B21A4565',
    passwordHash: Buffer.from('ySRpaXUc').toString('base64'),
    qrId: 'QR-19c0c7bc09f-uz8n4css',
    createdAt: admin.firestore.Timestamp.now(),
  };

  try {
    await db.collection('students').doc(`student-23B21A4565`).set(student);
    console.log('✅ Student uploaded successfully!');
    console.log('Roll No: 23B21A4565');
    console.log('Username: 23B21A4565');
    console.log('Password: ySRpaXUc');
    console.log('QR ID:', student.qrId);
  } catch (error) {
    console.error('❌ Error uploading student:', error);
  } finally {
    process.exit(0);
  }
}

uploadStudent();
