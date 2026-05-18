const API_BASE_URL = "https://il.bloxrbx.fr";

async function fetchCsrfToken() {
  const res = await fetch(`${API_BASE_URL}/getCsrfToken`, {
    credentials: "include",
  });
  const data = await res.json();
  return data.token;
}

if (!window.firebaseReady) {
  window.firebaseReady = (async () => {
    const res = await fetch("https://api.bloxrbx.fr/firebase-config", {
      method: "POST",
    });
    const config = await res.json();
    firebase.initializeApp(config);
    window.auth = firebase.auth();
    window.db = firebase.database();
    return { auth: window.auth, db: window.db };
  })();
}

function initFirebase() {
  return window.firebaseReady;
}

async function adminAction(endpoint, body) {
  const token = await firebase.auth().currentUser.getIdToken();
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}

async function setRoblox_Avatar(robloxName) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/avatar/${robloxName}`);
    const data = await res.json();
    const img = document.getElementById("avatar-roblox");
    if (!img) return;
    img.src = data.avatarUrl || "img/default-avatar.png";
    img.style.display = "inline-block";
  } catch (err) {
    console.error("Erreur avatar :", err);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("adminEnter").addEventListener("click", async () => {
    const codeInput = document.getElementById("adminCode").value;
    const msg = document.getElementById("adminMessage");

    const csrfToken = await fetchCsrfToken();
    const response = await fetch(`${API_BASE_URL}/checkAdminCode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({ code: codeInput }),
    });

    const data = await response.json();

    if (!data.success) {
      msg.style.color = "#ff5555";
      msg.textContent = "❌ Code invalide.";
      setTimeout(() => (msg.textContent = ""), 3000);
      return;
    }

    msg.style.color = "#00ff6a";
    msg.textContent = "✅ Code correct.";

    const res = await fetch("../admin/Content.html");
    const html = await res.text();
    document.getElementById("app").innerHTML = html;

    const { auth, db } = await initFirebase();
    if (!auth || !db) return console.error("Firebase non initialisé");

    /* ===== ÉLÉMENTS UI ===== */
    const btnprofil = document.getElementById("btn-profil");
    const disco = document.getElementById("disconnect");
    const body = document.getElementById("body");
    const loadinggif = document.getElementById("sous-container-wrapper");
    const loadimg = document.querySelectorAll(".loadimg");
    const elements = document.getElementById("lien-profil");
    const switch2 = document.getElementById("drawer-disabled");
    const title = document.getElementById("Titre");
    const content = document.getElementById("Contenu");
    const imgage = document.getElementById("roblox");
    const drawer = document.getElementById("promo-drawer");
    const list = document.getElementById("list");
    const searchInput = document.getElementById("search");
    const nbuInput = document.getElementById("NBU");
    const background = document.getElementById("background");
    const pseudoR = document.getElementById("pseudoR");
    const retour = document.getElementById("retour");

    if (loadinggif) loadinggif.style.display = "flex";
    if (btnprofil) btnprofil.style.display = "none";

    /* ===== SSE ANNONCES ===== */
    function LoadMessage() {
      if (!switch2) return;
      const evtSource = new EventSource(`${API_BASE_URL}/discord/getannounce`);
      evtSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch2.checked = !!data.messageEnabled;
        if (title) title.value = data.Titre || "";
        if (content)
          content.innerHTML = DOMPurify.sanitize(data.Contexte || "");
      };
    }
    LoadMessage();

    /* ===== AVATAR PROFIL ADMIN ===== */
    async function setRobloxAvatar(robloxName) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/avatar/${robloxName}`);
        const data = await res.json();
        if (!imgage) return;
        imgage.src = data.avatarUrl || "../img/default-avatar.png";
        imgage.style.display = "inline-block";
      } catch (err) {
        console.error("Erreur avatar :", err);
      }
    }

    /* ===== PROFIL D'UN UTILISATEUR ===== */
    // ✅ Récupère les données fraîches à chaque ouverture de profil
    async function updateProfileInfo(uid) {
      try {
        const snap = await db.ref(`users/${uid}`).get();
        if (!snap.exists()) return;
        const data = snap.val();

        document.getElementById("robuxGagnes").textContent =
          data.robuxGagnes ?? "0";
        document.getElementById("retraits").textContent = Object.keys(
          data.transactions || {},
        ).length;
        document.getElementById("balance").textContent = data.balance ?? "0";
        document.getElementById("statut").textContent =
          data.role ?? "Utilisateur";
        document.getElementById("nomRoblox").textContent =
          data.RobloxName ?? "—";
        document.getElementById("username").textContent = data.username ?? "—";
        document.getElementById("motdepasse").textContent = data.createdAt
          ? new Date(data.createdAt).toLocaleDateString()
          : "—";
        document.getElementById("nbConnexions").textContent =
          data.nbConnexions ?? "0";
      } catch (err) {
        console.error("Erreur mise à jour profil :", err);
      }
    }

    /* ===== AUTH STATE — UN SEUL LISTENER ===== */
    let connectedUser = null;

    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        alert("Vous devez être connecté pour accéder à cette page !");
        window.location.href = "../Pages/Profil";
        return;
      }

      connectedUser = user.uid;

      try {
        // ✅ Une seule requête Firebase pour l'utilisateur connecté
        const snap = await db.ref("users/" + connectedUser).get();

        if (!snap.exists()) {
          alert("Utilisateur introuvable !");
          await auth.signOut();
          window.location.href = "../Pages/Profil";
          return;
        }

        const userData = snap.val();

        // Vérification ban
        if (userData.isBanned === true) {
          await auth.signOut();
          document.body.innerHTML = "";
          window.location.replace("../Pages/Ban");
          return;
        }

        // Vérification rôle admin
        if (userData.role !== "admin") {
          alert("Accès refusé : rôle admin requis !");
          await auth.signOut();
          window.location.href = "../Pages/Profil";
          return;
        }

        // Mise à jour header
        const { username, RobloxName } = userData;
        await setRoblox_Avatar(RobloxName);

        const lienprofil = document.getElementById("lien-profil");
        if (lienprofil) {
          lienprofil.href = "../Pages/Profil";
          lienprofil.style.justifyContent = "center";
          const span = lienprofil.querySelector("span");
          if (elements) elements.style.display = "flex";
          if (loadimg) loadimg.forEach((img) => (img.style.display = "none"));
          if (span) span.textContent = username;
        }

        // Chargement des données admin
        loadUsers();
        loadPromocodes();
      } catch (err) {
        if (err.message?.includes("Permission denied")) {
          await auth.signOut();
          document.body.innerHTML = "";
          window.location.replace("../Pages/Ban");
        } else {
          console.error("Erreur chargement profil :", err);
        }
      }
    });

    /* ===== RETOUR PROFIL ===== */
    retour?.addEventListener("click", () => {
      background.classList.remove("active");
      background.addEventListener(
        "transitionend",
        () => {
          background.style.display = "none";
          pseudoR.textContent = "...";
          imgage.src = "../img/default-avatar.png";
          [
            "robuxGagnes",
            "retraits",
            "balance",
            "statut",
            "nomRoblox",
            "username",
            "motdepasse",
            "nbConnexions",
          ].forEach((id) => {
            document.getElementById(id).textContent = "...";
          });
        },
        { once: true },
      );
    });

    /* ===== ACTIONS SUR LES UTILISATEURS ===== */
    list?.addEventListener("click", async (e) => {
      const btn = e.target;
      const tr = btn.closest("tr");
      if (!tr) return;

      const uid = tr.dataset.uid;
      if (!uid) return;

      // PROFIL
      if (btn.classList.contains("profil")) {
        background.style.display = "flex";
        setTimeout(() => background.classList.toggle("active"), 0);

        // ✅ Récupère les données fraîches de CET utilisateur
        const snap = await db.ref(`users/${uid}/RobloxName`).get();
        const robloxName = snap.val();
        if (!robloxName) return alert("Pseudo introuvable");
        pseudoR.textContent = `@${robloxName}`;
        setRobloxAvatar(robloxName);
        updateProfileInfo(uid);
      }

      // CRÉDITER
      if (btn.classList.contains("credit")) {
        const amount = prompt("Montant à créditer :");
        if (
          !amount ||
          isNaN(amount) ||
          Number(amount) <= 0 ||
          Number(amount) > 10000
        )
          return alert("Montant invalide (1-10000)");
        try {
          await adminAction("/admin/credit", { uid, amount: Number(amount) });
          alert("✅ Crédit ajouté");
          loadUsers();
        } catch (err) {
          alert("❌ " + err.message);
        }
      }

      // BANNIR
      if (btn.classList.contains("ban")) {
        const isBanned = tr.dataset.isBanned === "true";
        if (
          !confirm(
            isBanned ? "Voulez-vous débannir ?" : "Confirmer le bannissement ?",
          )
        )
          return;
        try {
          await adminAction("/admin/ban", { uid, isBanned: !isBanned });
          alert(!isBanned ? "🚫 Utilisateur banni" : "✅ Utilisateur débanni");
          loadUsers();
        } catch (err) {
          alert("❌ " + err.message);
        }
      }

      // PROMOUVOIR
      if (btn.classList.contains("promote")) {
        if (uid === connectedUser)
          return alert("❌ Vous ne pouvez pas modifier votre propre rôle.");
        const newRole = tr.dataset.role === "admin" ? "Utilisateur" : "admin";
        const confirmMsg =
          newRole === "admin"
            ? "Promouvoir en admin ?"
            : "Retirer le rôle admin ?";
        if (!confirm(confirmMsg)) return;
        try {
          await adminAction("/admin/promote", { uid, newRole });
          alert(newRole === "admin" ? "⭐ Promu admin" : "⬇️ Rôle retiré");
          loadUsers();
        } catch (err) {
          alert("❌ " + err.message);
        }
      }
    });

    /* ===== CHARGER LES UTILISATEURS ===== */
    let allUsers = [];

    async function loadUsers() {
      try {
        const snap = await db.ref("users").get();
        if (!snap.exists()) {
          list.innerHTML =
            "<tr><td colspan='4'>Aucun utilisateur trouvé.</td></tr>";
          return;
        }
        const users = snap.val();
        allUsers = Object.keys(users).map((uid) => ({
          uid,
          username: users[uid].username,
          balance: users[uid].balance || 0,
          role: (users[uid].role || "Utilisateur").toLowerCase(),
          isBanned: users[uid].isBanned || false,
        }));
        renderUsers();
        searchInput?.addEventListener("input", renderUsers);
        nbuInput?.addEventListener("input", renderUsers);
      } catch (err) {
        console.error("Erreur chargement utilisateurs :", err);
        list.innerHTML =
          "<tr><td colspan='4'>Erreur lors du chargement.</td></tr>";
      }
    }

    function renderUsers() {
      const search = searchInput?.value.toLowerCase() || "";
      const limit =
        nbuInput?.value === "none"
          ? allUsers.length
          : Number(nbuInput?.value) || allUsers.length;
      list.innerHTML = "";
      let count = 0;
      for (const user of allUsers) {
        if (!user.username?.toLowerCase().includes(search)) continue;
        if (count >= limit) break;
        count++;
        const tr = document.createElement("tr");
        tr.dataset.role = user.role;
        tr.dataset.uid = user.uid;
        tr.dataset.isBanned = user.isBanned;
        const isAdmin = user.role === "admin";
        tr.innerHTML = `
          <td>${user.username ?? "—"}</td>
          <td>${user.balance} R$</td>
          <td>${user.role}</td>
          <td class="actions">
            <button class="btn profil">Profil</button>
            <button class="btn credit">Créditer</button>
            <button class="btn ban">${user.isBanned ? "Débannir" : "Bannir"}</button>
            <button class="btn promote">${isAdmin ? "Rétrograder" : "Promouvoir"}</button>
          </td>`;
        list.appendChild(tr);
      }
      if (count === 0)
        list.innerHTML =
          "<tr><td colspan='4'>Aucun utilisateur trouvé.</td></tr>";
    }

    /* ===== CODES PROMO ===== */
    const promoTableBody = document.querySelector(
      "section.card:nth-of-type(2) tbody",
    );
    let currentPromo = null;

    // ✅ Toujours récupère les données fraîches
    async function loadPromocodes() {
      try {
        promoTableBody.innerHTML = "";
        const snap = await db.ref("promocodes").get();
        if (!snap.exists()) {
          promoTableBody.innerHTML =
            "<tr><td colspan='6'>Aucun code promo trouvé.</td></tr>";
          return;
        }
        const promos = snap.val();
        const now = new Date();
        Object.keys(promos).forEach((code) => {
          const promo = promos[code];
          const expirationDate = promo.expiration
            ? new Date(promo.expiration)
            : null;
          const usesLeft = promo.usesLeft !== undefined ? promo.usesLeft : "∞";
          let status = "Actif";
          if (
            (expirationDate && expirationDate < now) ||
            (promo.usesLeft !== undefined && promo.usesLeft <= 0) ||
            promo.enabled === false
          ) {
            status = "Inactif";
          }
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${code}</td>
            <td>${promo.amount}</td>
            <td>${usesLeft}</td>
            <td>${expirationDate ? expirationDate.toLocaleDateString() : "∞"}</td>
            <td><span class="status ${status.toLowerCase()}">${status}</span></td>
            <td><button class="optionsbtn" data-code="${code}">Options</button></td>`;
          promoTableBody.appendChild(tr);
        });
      } catch (err) {
        console.error("Erreur chargement promos :", err);
        promoTableBody.innerHTML =
          "<tr><td colspan='6'>Erreur lors du chargement.</td></tr>";
      }
    }

    promoTableBody?.addEventListener("click", async (e) => {
      const btn = e.target.closest(".optionsbtn");
      if (!btn) return;
      currentPromo = btn.dataset.code;

      // ✅ Récupère les données fraîches de CE code promo
      const snap = await db.ref(`promocodes/${currentPromo}`).get();
      if (!snap.exists()) return;

      const p = snap.val();
      document.getElementById("drawer-name").value = currentPromo;
      document.getElementById("drawer-code").textContent = currentPromo;
      document.getElementById("drawer-enabled").checked = p.enabled !== false;
      document.getElementById("drawer-amount").value = p.amount ?? 0;
      document.getElementById("drawer-uses").value = p.usesLeft ?? 0;
      document.getElementById("drawer-expiration").value = p.expiration
        ? p.expiration.split("T")[0]
        : "";
      drawer.classList.remove("hidden");
    });

    document
      .getElementById("createPromo")
      ?.addEventListener("click", async () => {
        const name = document
          .getElementById("promoName")
          .value.trim()
          .toUpperCase();
        const amount = parseInt(document.getElementById("promoAmount").value);
        const uses = parseInt(document.getElementById("promoUses").value);
        const expiration = document.getElementById("promoExpiration").value;
        if (!name || !amount || isNaN(uses) || !expiration)
          return alert("Remplissez tous les champs");
        if (name.length > 11) return alert("11 caractères maximum !");
        try {
          await adminAction("/admin/promo/create", {
            name,
            amount,
            uses,
            expiration,
          });
          alert("✔️ Code promo créé !");
          ["promoName", "promoAmount", "promoUses", "promoExpiration"].forEach(
            (id) => (document.getElementById(id).value = ""),
          );
          loadPromocodes();
        } catch (err) {
          alert("❌ " + err.message);
        }
      });

    document
      .getElementById("saveDrawer")
      ?.addEventListener("click", async () => {
        if (!currentPromo) return;
        const newName = document
          .getElementById("drawer-name")
          .value.trim()
          .toUpperCase();
        if (!newName) return alert("Nom invalide");
        if (newName.length > 11) return alert("11 caractères maximum !");
        const data = {
          newName,
          oldName: currentPromo,
          enabled: document.getElementById("drawer-enabled").checked,
          amount: Number(document.getElementById("drawer-amount").value),
          usesLeft: Number(document.getElementById("drawer-uses").value),
          expiration:
            document.getElementById("drawer-expiration").value || null,
        };
        try {
          await adminAction("/admin/promo/update", data);
          closeDrawer();
          loadPromocodes();
          alert("✅ Code promo mis à jour");
        } catch (err) {
          alert("❌ " + err.message);
        }
      });

    document
      .getElementById("deleteDrawer")
      ?.addEventListener("click", async () => {
        if (!currentPromo) return;
        if (!confirm(`Supprimer "${currentPromo}" ?`)) return;
        try {
          await adminAction("/admin/promo/delete", { code: currentPromo });
          closeDrawer();
          loadPromocodes();
        } catch (err) {
          alert("❌ " + err.message);
        }
      });

    function closeDrawer() {
      drawer.classList.add("hidden");
      currentPromo = null;
    }

    document
      .getElementById("closeDrawer")
      ?.addEventListener("click", closeDrawer);

    /* ===== MULTIPLICATEUR ===== */
    const multiplierSpan = document.querySelector(".current-multiplier");
    const multiplierInput = document.getElementById("Multiplicator");
    const applyMultiplierBtn = document.querySelector(".btn.apply");

    db.ref("settings/gainMultiplier").on("value", (snap) => {
      const value = snap.val() ?? 1;
      if (multiplierSpan)
        multiplierSpan.textContent = `x${Number(value).toFixed(2)}`;
    });

    applyMultiplierBtn?.addEventListener("click", async () => {
      const percent = Number(multiplierInput.value);
      if (isNaN(percent) || percent < 0 || percent > 500)
        return alert("❌ Valeur invalide (0 - 500%)");
      try {
        await adminAction("/admin/multiplier", { percent });
        alert("✅ Multiplicateur mis à jour");
        multiplierInput.value = "";
      } catch (err) {
        alert("❌ " + err.message);
      }
    });

    /* ===== ANNONCES ===== */
    const announcebtn = document.querySelector(".btn.create-announce");
    const clearbtn = document.querySelector(".btn.clear-input");
    const checkbox = document.getElementById("drawer-disabled");

    clearbtn?.addEventListener("click", () => {
      const editor = tinymce.get("Contenu");
      if (title) title.value = "";
      if (content) content.innerHTML = "";
      editor?.setContent("");
    });

    announcebtn?.addEventListener("click", () => {
      const editor = tinymce.get("Contenu");
      if (!title?.value || !editor?.getContent())
        return alert("Contenu et/ou titre manquant");
      if (!confirm("Êtes-vous sûr de vouloir publier cette annonce ?")) return;
      SendDiscordMessage(title.value, editor.getContent());
    });

    checkbox?.addEventListener("change", async () => {
      try {
        await adminAction("/discord/statuemessage", {
          statue: checkbox.checked,
        });
      } catch (err) {
        console.error("Erreur statut message :", err);
      }
    });

    async function SendDiscordMessage(title, content) {
      if (!title || !content) return;
      try {
        await adminAction("/discord/annouce", { title, content });
        alert("✅ Message envoyé avec succès !");
      } catch (err) {
        alert("❌ Erreur lors de l'envoi : " + err.message);
      }
    }

    /* ===== TINYMCE ===== */
    tinymce.init({
      selector: "#Contenu",
      language: "fr-FR",
      plugins: [
        "anchor",
        "autolink",
        "charmap",
        "codesample",
        "emoticons",
        "link",
        "lists",
        "media",
        "searchreplace",
        "table",
        "visualblocks",
        "wordcount",
      ],
      toolbar:
        "undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link media table | align | numlist bullist | emoticons charmap | removeformat",
    });

    /* ===== MENU NAVIGATION ===== */
    const barres = document.getElementById("barres");
    const navigation = document.getElementById("navigation");
    const navpanel = document.getElementById("nav-panel");
    const barres2 = document.getElementById("barres2");

    barres?.addEventListener("click", () => {
      navigation.classList.toggle("active");
      navpanel.classList.toggle("active");
      barres.classList.toggle("rotated");
    });

    barres2?.addEventListener("click", () => {
      navigation.classList.remove("active");
      navpanel.classList.remove("active");
      barres.classList.remove("rotated");
    });

    navigation?.addEventListener("click", (e) => {
      if (e.target === navigation) {
        navigation.classList.remove("active");
        navpanel.classList.remove("active");
        barres.classList.remove("rotated");
      }
    });

    /* ===== HEADER SCROLL ===== */
    const header = document.querySelector("header");
    window.addEventListener("scroll", () => {
      header?.classList.toggle("scrolled", window.scrollY > 50);
    });
  });
});
