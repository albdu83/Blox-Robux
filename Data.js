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

window.db = db;

const list = document.getElementById("list");

if (list) {
    db.ref("users").get().then(snapshot => {
    if (!snapshot.exists()) return;

    const users = snapshot.val();

    list.innerHTML = ""; // On vide le tableau avant d'ajouter

    Object.keys(users).forEach(username => {
        const user = users[username];

        list.innerHTML += `
            <tr>
                <td>${username}</td>
                <td>${user.balance ||0} R$</td>
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
});
}
