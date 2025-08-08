const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Replace with your key file path
const questionsData = require('./questions.json'); // Replace with your JSON data file path

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function uploadQuestions() {
  for (const question of questionsData) {
    try {
      await db.collection('questions').add(question);
      console.log(`Question added: ${question.title}`);
    } catch (error) {
      console.error('Error adding question: ', error);
    }
  }
  console.log('All questions uploaded.');
}

uploadQuestions();
