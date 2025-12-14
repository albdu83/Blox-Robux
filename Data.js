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

// --- Initialisation Firebase ---
firebase.initializeApp(firebaseConfig);
// --- Auth + Database ---
const auth = firebase.auth();
const db = firebase.database();

window.auth = auth;
window.db = db;

// --- Attendre que le DOM soit prêt ---
document.addEventListener("DOMContentLoaded", () => {
  // Vérification si utilisateur connecté
  auth.onAuthStateChanged(user => {
    if (!user) {
      console.log("Utilisateur non connecté !");

      return;
    }
    // --- Lecture de la DB ---
    const list = document.getElementById("list");
    if (!list) return;
    db.ref("users").get()
      .then(snapshot => {
        if (!snapshot.exists()) return;
        const users = snapshot.val();
        list.innerHTML = ""; // vide le tableau

      Object.keys(users).forEach(uid => {
        const userData = users[uid];

        const username = userData.username || "Inconnu";
        const balance = userData.balance || 0;
        const role = userData.role || "Utilisateur";

        list.innerHTML += `
          <tr>
            <td>${username}</td>
            <td>${balance} R$</td>
            <td>${role}</td>
            <td class="actions">
              <button class="btn profil" data-uid="${uid}">Profil</button>
              <button class="btn credit" data-uid="${uid}">Créditer</button>
              <button class="btn ban" data-uid="${uid}">Bannir</button>
              <button class="btn promote" data-uid="${uid}">Promouvoir</button>
            </td>
          </tr>
        `;
      });
      })
      .catch(err => console.error("Erreur DB:", err));
  });

});
