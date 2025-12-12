// --- Config et initialisation Firebase ---
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

firebase.initializeApp(firebaseConfig);

// --- Accès à la Realtime Database et Auth ---
const db = firebase.database();
const auth = firebase.auth();
window.db = db;

// --- Vérifier la connexion de l'utilisateur ---
auth.onAuthStateChanged((user) => {
    if (!user) {
        console.log("Utilisateur non connecté !");
        return; // On stoppe si non connecté
    }

    console.log("Utilisateur connecté :", user.uid);

    const list = document.getElementById("list");
    if (!list) return;

    // --- Lecture de la DB ---
    db.ref("users").get().then(snapshot => {
        if (!snapshot.exists()) return;

        const users = snapshot.val();
        list.innerHTML = ""; // vide le tableau

        Object.keys(users).forEach(username => {
            const userData = users[username];

            list.innerHTML += `
                <tr>
                    <td>${username}</td>
                    <td>${userData.balance || 0} R$</td>
                    <td>${userData.role || "Utilisateur"}</td>
                    <td class="actions">
                        <button class="btn profil">Profil</button>
                        <button class="btn credit">Créditer</button>
                        <button class="btn ban">Bannir</button>
                        <button class="btn promote">Promouvoir</button>
                    </td>
                </tr>
            `;
        });
    }).catch(err => console.error("Erreur DB:", err));
});
