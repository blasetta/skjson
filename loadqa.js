// This is a Node.js script to be run from your command line.
// It adds a predefined set of questions to a specific document in your Firestore database.

// 1. SETUP:
//    - Make sure you have Node.js installed.
//    - Create a folder for this script.
//    - Save this file as 'import.js' in that folder.
//    - Create a file named 'questions.json' in the same folder. This file must contain an array of the question objects you want to import.
//    - Get your Firebase Service Account Key JSON file and save it as 'serviceAccountKey.json' in the same folder.
//      (Go to Firebase Console > Project Settings > Service accounts > Generate new private key)
//    - Open your terminal in the folder and run:
//      npm init -y
//      npm install firebase-admin

// Import required modules
const admin = require('firebase-admin');
const fs = require('fs'); // Node.js File System module

// --- Configuration ---

// Path to your service account key file
const serviceAccount = require('./serviceAccountKey.json');

// The name of your Firestore collection
const COLLECTION_NAME = 'questions'; // <-- IMPORTANT: Change this!

// The value to identify the document to update
const DOCUMENT_CODE = 'GCP-ML2';

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Get a reference to the Firestore database
const db = admin.firestore();

/**
 * The main function to find the document and add questions.
 */
async function importQuestions() {
    console.log('Starting import process...');

    if (COLLECTION_NAME === 'your-collection-name') {
        console.error("\n❌ ERROR: Please open the script and change 'your-collection-name' to your actual Firestore collection name.\n");
        return;
    }

    // --- Load Data from Local File ---
    let questionsToImport;
    try {
        console.log("Reading questions from 'questions.json'...");
        const rawData = fs.readFileSync('./questions.json', 'utf8');
        questionsToImport = JSON.parse(rawData);

        if (!Array.isArray(questionsToImport)) {
             console.error("\n❌ ERROR: The 'questions.json' file must contain a valid JSON array.\n");
             return;
        }
        console.log(`✅ Found ${questionsToImport.length} questions to import from file.`);

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error("\n❌ ERROR: 'questions.json' file not found. Please create it in the same directory as the script.\n");
        } else if (error instanceof SyntaxError) {
            console.error("\n❌ ERROR: Could not parse 'questions.json'. Please ensure it is a valid JSON array.\n");
        } else {
            console.error("\n❌ ERROR: Could not read 'questions.json':", error);
        }
        return; // Stop execution if the file can't be read or parsed
    }


    try {
        // 1. Find the document with code = DOCUMENT_CODE
        console.log(`Searching for document in collection '${COLLECTION_NAME}' where code='${DOCUMENT_CODE}'...`);
        const collectionRef = db.collection(COLLECTION_NAME);
        const q = collectionRef.where("code", "==", DOCUMENT_CODE);
        
        const querySnapshot = await q.get();

        if (querySnapshot.empty) {
            console.error(`\n❌ ERROR: No document found with code='${DOCUMENT_CODE}'. Please check your collection name and data.\n`);
            return;
        }

        // Assuming there's only one such document
        const targetDoc = querySnapshot.docs[0];
        console.log(`✅ Found document with ID: ${targetDoc.id}.`);
        
        // 2. Loop through the questions and add them using arrayUnion
        for (const question of questionsToImport) {
            console.log(`   -> Adding question #${question.number}: "${question.title}"...`);
            await targetDoc.ref.update({
                qa: admin.firestore.FieldValue.arrayUnion(question)
            });
        }

        // 3. Final success message
        console.log(`\n✨ Success! Added ${questionsToImport.length} new questions to the document.\n`);

    } catch (error) {
        console.error("\n❌ An error occurred during the import process:");
        console.error(error);
        console.error("\nPlease check your Firebase credentials and Firestore security rules.");
    }
}

// Run the main function
importQuestions();
