// Aaromach Arcade — shared leaderboard settings.
// Leave this as null and scores are kept on each device only.
// To turn on the shared leaderboard, create a SEPARATE Firebase project for the arcade
// (not the Command Center project), add a Web app, and paste its config here. See README.md.
// These values are public by design (every visitor's browser loads them). The Firestore rules and
// the Cloud Functions in functions/ are what protect the data.
window.ARCADE_FIREBASE = {
  apiKey: "AIzaSyDEYnRSVEXuvZUM8rqtyOdA0SspU9BsqiM",
  authDomain: "aaromach-arcade.firebaseapp.com",
  projectId: "aaromach-arcade",
  storageBucket: "aaromach-arcade.firebasestorage.app",
  messagingSenderId: "269405406156",
  appId: "1:269405406156:web:d01bfad556fb957fa49369",
};
// App Check: the reCAPTCHA Enterprise site key registered for this site (Firebase console, App Check).
// (For a classic reCAPTCHA v3 key instead, also set window.ARCADE_APPCHECK_PROVIDER = 'v3'.)
window.ARCADE_APPCHECK_KEY = "6Lf6fCAuAAAAANeIK3o9CZZ0D3fLzbiw-qVY8Q02";
// Region the Cloud Functions are deployed to (functions/index.js).
window.ARCADE_FUNCTIONS_REGION = 'us-central1';
/* Example:
window.ARCADE_FIREBASE = {
  apiKey: "…",
  authDomain: "aaromach-arcade.firebaseapp.com",
  projectId: "aaromach-arcade",
  appId: "…",
};
*/
