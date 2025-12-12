// 🔹 Connexion Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDwZ7eVgxjrkh6U1kycVyPdjNKJ6b-_xZc",
  authDomain: "bloxrobux-e9244.firebaseapp.com",
  databaseURL: "https://bloxrobux-e9244-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bloxrobux-e9244",
  storageBucket: "bloxrobux-e9244.appspot.com",
  messagingSenderId: "178163807426",
  appId: "1:178163807426:web:649b90d1867023d190b75b",
  measurementId: "G-YWK7EDQ55E"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

// 🔹 Connexion anonyme obligatoire avant tout accès DB
auth.signInAnonymously()
  .then(() => console.log("Connecté anonymement"))
  .catch(err => console.error("Erreur connexion anonyme :", err));

window.addEventListener("DOMContentLoaded", () => {

  const list = document.getElementById("list");
  const searchInput = document.getElementById("search");
  const nbuInput = document.getElementById("NBU");
  let allUsers = [];

  if (!list || !searchInput) return;

  // 🔹 Fonction pour afficher la liste filtrée
  function renderUsers() {
    const search = searchInput.value.toLowerCase();
    const limit = Number(nbuInput.value) || allUsers.length;
    list.innerHTML = "";
    let count = 0;

    for (const user of allUsers) {
      if (!user.username.toLowerCase().includes(search)) continue;
      if (count >= limit) break;
      count++;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${user.username}</td>
        <td>${user.balance || 0} R$</td>
        <td>${user.role || "Utilisateur"}</td>
        <td class="actions">
          <button class="btn profil">Profil</button>
          <button class="btn credit">Créditer</button>
          <button class="btn ban">Bannir</button>
          <button class="btn promote">Promouvoir</button>
        </td>`;
      list.appendChild(tr);
    }
  }

  searchInput.addEventListener("input", renderUsers);
  if (nbuInput) nbuInput.addEventListener("input", renderUsers);

  // 🔹 Attendre que l'utilisateur (anonyme) soit prêt
  auth.onAuthStateChanged(user => {
    if (!user) {
      console.warn("Utilisateur non connecté !");
      list.innerHTML = "<tr><td colspan='4'>Veuillez vous connecter pour voir la liste.</td></tr>";
      return;
    }

    console.log("Utilisateur connecté :", user.uid);

    // 🔹 Lecture DB
    db.ref("users").get()
      .then(snapshot => {
        if (!snapshot.exists()) {
          list.innerHTML = "<tr><td colspan='4'>Aucun utilisateur trouvé.</td></tr>";
          return;
        }

        const users = snapshot.val();
        allUsers = Object.keys(users).map(username => ({
          username,
          balance: users[username].balance || 0,
          role: users[username].role || "Utilisateur"
        }));

        renderUsers();
      })
      .catch(err => console.error("Erreur DB:", err));
  });
});











