// Test script to add sample announcement and check data
// Run: node scripts/test-notifications.js

console.log('🔔 Testing Notification System');
console.log('📅 Today is:', new Date().toISOString().split('T')[0]);

// Check Firebase collections structure
console.log('\n📋 To test notifications:');
console.log('1. Go to Firebase Console');
console.log('2. Create "announcements" collection if it doesn\'t exist');
console.log('3. Add a test document with:');

const testAnnouncement = {
  title: "Welcome Back Students!",
  content: "New semester has started. Check your schedules and attendance requirements.",
  type: "general",
  createdAt: new Date(),
  authorId: "admin",
  authorName: "SCL Admin",
  priority: "normal"
};

console.log(JSON.stringify(testAnnouncement, null, 2));

console.log('\n4. Add attendance session for today:');
const testSession = {
  date: new Date().toISOString().split('T')[0],
  isActive: true,
  startTime: "09:00 AM", 
  endTime: "11:00 AM",
  location: "Smart City Lab",
  subject: "Git & GitHub + Deployment"
};

console.log('Collection: attendanceSessions');
console.log('Document ID:', testSession.date);
console.log(JSON.stringify(testSession, null, 2));

console.log('\n5. Add today\'s syllabus:');
const testSyllabus = {
  topic: "Git & GitHub + Deployment",
  subtopics: "Version Control, Repository Management, CI/CD Pipeline",
  date: new Date().toISOString().split('T')[0],
  day: 15,
  status: "In Progress",
  mentors: ["Sri Ram"],
  studyMaterial: "https://github.com/example/git-tutorial"
};

console.log('Collection: syllabus');
console.log(JSON.stringify(testSyllabus, null, 2));

console.log('\n✅ After adding these, refresh /pwa/home to see notifications!');