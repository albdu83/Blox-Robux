import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, child } from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// --- Config ---
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

// --- Initialisation ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const list = document.getElementById("list");

// --- On attend que l'utilisateur soit connecté ---
onAuthStateChanged(auth, (user) => {
  if (!user) {
    console.log("Utilisateur non connecté !");
    return;
  }

  // --- Lecture de la DB ---
  get(child(ref(db), "users"))
    .then((snapshot) => {
      if (!snapshot.exists()) return;

      const users = snapshot.val();
      list.innerHTML = ""; // vide le tableau

      Object.keys(users).forEach((username) => {
        const user = users[username];
        list.innerHTML += `
          <tr>
              <td>${username}</td>
              <td>${user.balance || 0} R$</td>
              <td>${user.role || "Utilisateur"}</td>
              <td class="actions">
                  <button class="btn profil">Profil</button>
                  <button class="btn credit">Créditer</button>
                  <button class="btn ban">Bannir</button>
                  <button class="btn promote">Promouvoir</button>
              </td>
          </tr>
        `;
      });
    })
    .catch((err) => console.error("Erreur DB:", err));
});

