// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDwZ7eVgxjrkh6U1kycVyPdjNKJ6b-_xZc",
  authDomain: "bloxrobux-e9244.firebaseapp.com",
  databaseURL: "https://bloxrobux-e9244-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bloxrobux-e9244",
  storageBucket: "bloxrobux-e9244.firebasestorage.app",
  messagingSenderId: "178163807426",
  appId: "1:178163807426:web:649b90d1867023d190b75b",
  measurementId: "G-YWK7EDQ55E"
};

// --- Initialisation Firebase (obligatoire) ---
firebase.initializeApp(firebaseConfig);

// --- Accès à la Realtime Database ---
const db = firebase.database();
