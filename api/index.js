const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

// --- Firebase Admin SDK Initialization ---
// It's best practice to not hardcode credentials.
// Cloud Run will automatically provide credentials if the
// service account has the right permissions.
try {
  admin.initializeApp({
    // projectId is read from the GCLOUD_PROJECT environment variable
  });
} catch (error) {
  console.error("Firebase Admin initialization failed:", error);
  // If running locally, you might need to specify the service account key:
  // const serviceAccount = require("./path/to/your/serviceAccountKey.json");
  // admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const app = express();

// --- Middleware ---
// Enable CORS for all routes. In a production environment, you might want to
// restrict this to your frontend's domain.
app.use(cors());

// --- API Routes ---

/**
 * @api {get} /quiz/:quizCode Get Quiz Data
 * @apiName GetQuiz
 * @apiGroup Quiz
 *
 * @apiParam {String} quizCode The unique code for the quiz (e.g., "GCP-ML").
 *
 * @apiSuccess {Object} quizDocument The entire quiz document from Firestore.
 *
 * @apiError (404) QuizNotFound The quiz with the specified code was not found.
 * @apiError (500) InternalServerError An error occurred on the server.
 */
app.get("/quiz/:quizCode", async (req, res) => {
  const { quizCode } = req.params;

  if (!quizCode) {
    return res.status(400).send({ error: "Quiz code is required." });
  }

  try {
    const questionSnapshot = await db.collection("questions")
      .where("code", "==", quizCode)
      .limit(1)
      .get();

    if (questionSnapshot.empty) {
      console.log(`No quiz found with code: ${quizCode}`);
      return res.status(404).send({ error: `Quiz with code "${quizCode}" not found.` });
    }

    const questionDoc = questionSnapshot.docs[0].data();
    console.log(`Fetched Quiz: ${questionDoc.title} for code: ${quizCode}`);

    // Send the entire document data back to the client
    res.status(200).json(questionDoc);
  } catch (error) {
    console.error(`Error fetching quiz ${quizCode}:`, error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// --- Server Start ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
