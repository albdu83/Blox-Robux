document.addEventListener("DOMContentLoaded", async () => {
  const { auth, db } = await initFirebase();
  const imgage = document.getElementById("roblox");
  const drawer = document.getElementById("promo-drawer");

  if (!auth || !db) {
    console.error("Firebase non initialisé");
  }
  // Initialisation Firebase

  async function setRobloxAvatar(robloxName) {
    try {
      const res = await fetch(`https://blox-robux.onrender.com/api/avatar/${robloxName}`);
      const data = await res.json();
      if (!imgage) return;

      imgage.src = data.avatarUrl || "img/default-avatar.png";
      imgage.style.display = "inline-block";

    } catch (err) {
      console.error("Erreur avatar :", err);
    }
  }
  async function updateProfileInfo(uid) {
    try {
      const snapshot = await db.ref(`users/${uid}`).get();
      if (!snapshot.exists()) return;

      const data = snapshot.val();

      document.getElementById("robuxGagnes").textContent = data.robuxGagnes ?? "0";
      document.getElementById("retraits").textContent = Object.keys(data.transactions || {}).length;
      document.getElementById("balance").textContent = data.balance ?? "0";
      document.getElementById("statut").textContent = data.role ?? "Utilisateur";
      document.getElementById("nomRoblox").textContent = data.RobloxName ?? "—";
      document.getElementById("username").textContent = data.username ?? "—";
      const date = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : "—";
      document.getElementById("motdepasse").textContent = date;
      document.getElementById("nbConnexions").textContent = data.nbConnexions ?? "0";

    } catch (err) {
      console.error("Erreur mise à jour profil :", err);
    }
  }

  let connectedUser = null;
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      alert("Vous devez être connecté pour accéder à cette page !");
      window.location.href = "../Pages/Profil";
      return;
    }

    connectedUser = user.uid;

    try {
      const snapshot = await db.ref("users/" + connectedUser).get();
      if (!snapshot.exists()) {
        alert("Utilisateur introuvable !");
        await auth.signOut();
        window.location.href = "../Pages/Profil";
        return;
      }

      const data = snapshot.val();

      if (data.role !== "admin") {
        alert("Accès refusé : rôle admin requis !");
        await auth.signOut();
        window.location.href = "../Pages/Profil";
        return;
      }

      // L'utilisateur est admin ✅, on peut charger la liste des utilisateurs
      loadUsers();

    } catch (err) {
      console.error("Erreur récupération utilisateur :", err);
      alert("Erreur lors du chargement de votre compte");
    }
  });

  // ------------------------
  // CHARGER LES UTILISATEURS
  // ------------------------
  const list = document.getElementById("list");
  const searchInput = document.getElementById("search");
  const nbuInput = document.getElementById("NBU");
  const background = document.getElementById("background");
  const pseudoR = document.getElementById("pseudoR");
  const retour = document.getElementById("retour")
  let allUsers = [];

  retour.addEventListener("click", () => {
    background.classList.remove("active")
    background.addEventListener("transitionend", () => {
      background.style.display = "none";
      pseudoR.innerHTML = "...";
      imgage.src = "../img/default-avatar.png";
      document.getElementById("robuxGagnes").textContent = "...";
      document.getElementById("retraits").textContent = "...";
      document.getElementById("balance").textContent = "...";
      document.getElementById("statut").textContent = "...";
      document.getElementById("nomRoblox").textContent = "...";
      document.getElementById("username").textContent = "...";
      document.getElementById("motdepasse").textContent = "...";
      document.getElementById("nbConnexions").textContent = "...";
    }, { once: true })
  });

  list.addEventListener("click", async (e) => {
    const btn = e.target;
    const tr = btn.closest("tr");
    if (!tr) return;

    const uid = tr.dataset.uid;
    if (!uid) return;

    // PROFIL
    if (btn.classList.contains("profil")) {
      background.style.display = "flex"
      setTimeout(() => {
        background.classList.toggle("active")
      }, 0);
      const snap = await db.ref(`users/${uid}/RobloxName`).get()
      const robloxName = snap.val()
      if (!robloxName) return alert("alertee");
      pseudoR.innerHTML = `@${robloxName}`;
      setRobloxAvatar(robloxName);
      updateProfileInfo(uid);
    }

    // CRÉDITER
    if (btn.classList.contains("credit")) {
      const amount = prompt("Montant à créditer :");
      if (!amount || isNaN(amount)) return;

      await db.ref(`users/${uid}/balance`)
        .transaction(b => (b || 0) + Number(amount));

      alert("✅ Crédit ajouté");
      loadUsers();
    }

    // BANNIR
    if (btn.classList.contains("ban")) {
      const isBanned = tr.dataset.isBanned === "true"; // récupère l'état actuel

      const confirmMsg = isBanned 
        ? "Voulez-vous débannir cet utilisateur ?" 
        : "Confirmer le bannissement ?";

      if (!confirm(confirmMsg)) return;

      // Mettre à jour la base de données
      await db.ref(`users/${uid}/isBanned`).set(!isBanned);

      alert(
        !isBanned 
          ? "🚫 Utilisateur banni" 
          : "✅ Utilisateur débanni"
      );

      loadUsers(); // Recharge la liste pour mettre à jour le bouton et le dataset
    }

      // PROMOUVOIR
    if (btn.classList.contains("promote")) {
      if (uid === connectedUser) {
        return alert("❌ Vous ne pouvez pas modifier votre propre rôle.");
      }

      const currentRole = tr.dataset.role;
      const newRole = currentRole === "admin" ? "Utilisateur" : "admin";

      const confirmMsg =
        newRole === "admin"
          ? "Promouvoir cet utilisateur en admin ?"
          : "Retirer le rôle admin à cet utilisateur ?";

      if (!confirm(confirmMsg)) return;

      await db.ref(`users/${uid}/role`).set(newRole);

      alert(
        newRole === "admin"
          ? "⭐ Utilisateur promu admin"
          : "⬇️ Rôle admin retiré"
      );

      loadUsers();
    }
  });

  async function loadUsers() {
    try {
      const snapshot = await db.ref("users").get();
      if (!snapshot.exists()) {
        list.innerHTML = "<tr><td colspan='4'>Aucun utilisateur trouvé.</td></tr>";
        return;
      }

      const users = snapshot.val();
      allUsers = Object.keys(users).map(uid => ({
        uid: uid,
        username: users[uid].username ,
        balance: users[uid].balance || 0,
        role: (users[uid].role || "Utilisateur").toLowerCase(),
        isBanned: users[uid].isBanned || false
      }));

      renderUsers();

      // Événements recherche et limite
      if (searchInput) searchInput.addEventListener("input", renderUsers);
      if (nbuInput) nbuInput.addEventListener("input", renderUsers);

    } catch (err) {
      console.error("Erreur chargement utilisateurs :", err);
      list.innerHTML = "<tr><td colspan='4'>Erreur lors du chargement des utilisateurs.</td></tr>";
    }
  }

  // ------------------------
  // AFFICHER LES UTILISATEURS
  // ------------------------
  function renderUsers() {
    const search = searchInput?.value.toLowerCase() || "";
    const limit = nbuInput?.value === "none" ? allUsers.length : Number(nbuInput?.value) || allUsers.length;

    list.innerHTML = "";
    let count = 0;

    for (const user of allUsers) {
      if (
          !user.username ||
          !user.username.toLowerCase().includes(search)
      ) continue;
      if (count >= limit) break;
      count++;

      const tr = document.createElement("tr");
      tr.dataset.role = user.role;
      tr.dataset.uid = user.uid;
      tr.dataset.isBanned = user.isBanned || false;
      const isAdmin = user.role === "admin";
      tr.innerHTML = `
        <td>${user.username ?? "—"}</td>
        <td>${user.balance} R$</td>
        <td>${user.role}</td>
        <td class="actions">
          <button class="btn profil">Profil</button>
          <button class="btn credit">Créditer</button>
          <button class="btn ban">${user.isBanned ? "Débannir" : "Bannir"}</button>
          <button class="btn promote">
            ${isAdmin ? "Rétrograder" : "Promouvoir"}
          </button>
        </td>
      `;
      list.appendChild(tr);
    }

    if (count === 0) {
      list.innerHTML = "<tr><td colspan='4'>Aucun utilisateur trouvé.</td></tr>";
    }
  }

  // ------------------------
  // CODES PROMOS CREATIONS
  // ------------------------

  document.getElementById("createPromo").addEventListener("click", async () => {
      const nameInput = document.getElementById("promoName");
      const amountInput = document.getElementById("promoAmount");
      const usesInput = document.getElementById("promoUses");
      const expirationInput = document.getElementById("promoExpiration");

      const name = nameInput.value.trim().toUpperCase();
      const amount = parseInt(amountInput.value);
      const uses = parseInt(usesInput.value);
      const expiration = expirationInput.value; // yyyy-mm-dd

      if (!name || !amount || isNaN(uses) || !expiration) return alert("Remplissez tous les champs");
      if (name.length > 11) return alert("11 caractères maximum pour le promocode !")
      try {
          await db.ref(`promocodes/${name}`).set({
              amount: amount,
              usesLeft: uses,
              expiration: new Date(expiration).toISOString(),
              usedBy: {},
              enabled: true
          });
          alert("✔️ Code promo créé !");

          // ✅ Réinitialiser les champs correctement
          nameInput.value = "";
          amountInput.value = "";
          usesInput.value = "";
          expirationInput.value = "";

          loadPromocodes();
      } catch (err) {
          console.error(err);
          alert("❌ Erreur lors de la création du code");
      }
  });
  const promoTableBody = document.querySelector("section.card:nth-of-type(2) tbody"); // tbody de la section Promocodes

  async function loadPromocodes() {
    try {
        promoTableBody.innerHTML = ""; // vider le tableau
        const snapshot = await db.ref("promocodes").get();
        if (!snapshot.exists()) {
            promoTableBody.innerHTML = "<tr><td colspan='5'>Aucun code promo trouvé.</td></tr>";
            return;
        }

        const promos = snapshot.val();
        const now = new Date();

        Object.keys(promos).forEach(code => {
            const promo = promos[code];
            const expirationDate = promo.expiration ? new Date(promo.expiration) : null;
            const usesLeft = promo.usesLeft !== undefined ? promo.usesLeft : "∞";

            // Statut
            let status = "Actif";
            if ((expirationDate && expirationDate < now) || (promo.usesLeft !== undefined && promo.usesLeft <= 0) || (promo.enabled === false)) {
                status = "Inactif";
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${code}</td>
                <td>${promo.amount}</td>
                <td>${usesLeft}</td>
                <td>${expirationDate ? expirationDate.toLocaleDateString() : "∞"}</td>
                <td><span class="status ${status.toLowerCase()}">${status}</span></td>
                <td><button class="optionsbtn" data-code="${code}">Options</button></td>
            `;
            promoTableBody.appendChild(tr);
        });

    } catch (err) {
        console.error("Erreur chargement promos :", err);
        promoTableBody.innerHTML = "<tr><td colspan='5'>Erreur lors du chargement des codes promo.</td></tr>";
    }
  }
  let currentPromo = null;

  promoTableBody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".optionsbtn");
    if (!btn) return;

    currentPromo = btn.dataset.code;

    const snap = await db.ref(`promocodes/${currentPromo}`).get();
    if (!snap.exists()) return;

    const p = snap.val();
    document.getElementById("drawer-name").value = currentPromo;
    document.getElementById("drawer-code").textContent = currentPromo;
    document.getElementById("drawer-enabled").checked = p.enabled !== false;
    document.getElementById("drawer-amount").value = p.amount ?? 0;
    document.getElementById("drawer-uses").value = p.usesLeft ?? 0;
    document.getElementById("drawer-expiration").value =
      p.expiration ? p.expiration.split("T")[0] : "";

    drawer.classList.remove("hidden");
  });

  document.getElementById("saveDrawer").addEventListener("click", async () => {
    if (!currentPromo) return;

    const newName = document
      .getElementById("drawer-name")
      .value
      .trim()
      .toUpperCase();

    if (!newName) return alert("Nom du code invalide");

    const data = {
      enabled: document.getElementById("drawer-enabled").checked,
      amount: Number(document.getElementById("drawer-amount").value),
      usesLeft: Number(document.getElementById("drawer-uses").value),
      expiration: document.getElementById("drawer-expiration").value
        ? new Date(document.getElementById("drawer-expiration").value).toISOString()
        : null,
      updatedAt: Date.now()
    };

    try {
      if (newName !== currentPromo) {
        if (newName.length > 11) return alert("11 caractère maximum pour le nom !")
        // 🔁 vérifier si le nouveau nom existe déjà
        const exists = await db.ref(`promocodes/${newName}`).get();
        if (exists.exists()) {
          return alert("❌ Ce nom de code existe déjà");
        }

        // 🔁 créer le nouveau
        await db.ref(`promocodes/${newName}`).set(data);

        // 🗑 supprimer l’ancien
        await db.ref(`promocodes/${currentPromo}`).remove();

        currentPromo = newName;
      } else {
        // ✏️ simple update
        await db.ref(`promocodes/${currentPromo}`).update(data);
      }

      closeDrawer();
      loadPromocodes();
      alert("✅ Code promo mis à jour");

    } catch (err) {
      console.error(err);
      alert("❌ Erreur lors de la modification");
    }
  });

  document.getElementById("deleteDrawer").addEventListener("click", async () => {
    if (!currentPromo) return;

    if (!confirm(`Supprimer définitivement le code "${currentPromo}" ?`)) return;

    await db.ref(`promocodes/${currentPromo}`).remove();

    closeDrawer();
    loadPromocodes();
  });

  function closeDrawer() {
    drawer.classList.add("hidden");
    currentPromo = null;
  }

  document.getElementById("closeDrawer").addEventListener("click", closeDrawer);

  const multiplierSpan = document.querySelector(".current-multiplier");
  const multiplierInput = document.getElementById("Multiplicator");
  const applyMultiplierBtn = document.querySelector(".btn.apply");

  // 🔁 Charger le multiplicateur en temps réel
  db.ref("settings/gainMultiplier").on("value", (snap) => {
    const value = snap.val() ?? 1;
    multiplierSpan.textContent = `x${Number(value).toFixed(2)}`;
  });

  // ✅ Appliquer un nouveau multiplicateur
  applyMultiplierBtn.addEventListener("click", async () => {
    const percent = Number(multiplierInput.value);

    if (isNaN(percent) || percent < 0) {
      alert("❌ Pourcentage invalide");
      return;
    }

    const multiplier = 1 + percent / 100;

    try {
      await db.ref("settings").update({
        gainMultiplier: Number(multiplier.toFixed(2)),
        updatedAt: Date.now()
      });

      alert(`✅ Multiplicateur mis à jour : x${multiplier.toFixed(2)}`);
      multiplierInput.value = "";

    } catch (err) {
      console.error("Erreur multiplicateur :", err);
      alert("❌ Erreur lors de la mise à jour");
    }
  });

  // Charger les codes au démarrage
  loadPromocodes();
  const header = document.querySelector("header");

  window.addEventListener("scroll", () => {
      if (window.scrollY > 50) {
          header.classList.add("scrolled");
      } else {
          header.classList.remove("scrolled");
      }
  });
  
  const announcebtn = document.querySelector(".btn.create-announce");
  const clearbtn = document.querySelector(".btn.clear-input");
  const checkbox = document.getElementById("drawer-disabled");
  const title = document.getElementById("Titre");
  const content = document.getElementById("Contenu");
  

  checkbox.addEventListener("change", async () => {
    const statue = checkbox.checked;
    const res = await fetch(`${API_BASE_URL}/discord/statuemessage`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ statue })
    });
  });

  clearbtn.addEventListener("click", () => {
    const editor = tinymce.get('Contenu');
    title.value = "";
    content.innerHTML = "";
    editor.setContent("");
  });

  announcebtn.addEventListener("click", () => {
    const editor = tinymce.get('Contenu');
    if (!title.value || !content.value) return alert("Contenu et/ou titre manquant");
    if (!confirm("Êtes-vous sûr de vouloir publier cette annonce ?")) return;
    SendDiscordMessage(title.value, editor.getContent());
  });

  async function SendDiscordMessage(title, content) {
    if(title === null || title === null) return;

    try {
      const res = await fetch(`${API_BASE_URL}/discord/annouce`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ title, content })
      });
      const status = await res.status;
      const json = res.json()
      if (status !== 200) {
        alert("❌ Echec de l'envoie", json.error);
        return;
      } else {
        alert("✅ Message envoyé avec succès !")
      }
    } catch(err) {
      console.error("Erreur d'envoie :", err);
      alert("❌ Erreur lors de l'envoie de l'annonce");
    }
  }
});
