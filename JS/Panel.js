const API_BASE_URL = "https://vps.bloxrbx.fr";

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
          Number(amount) <= -10000 ||
          Number(amount) > 10000
        )
          return alert("Montant invalide (-10000/10000)");
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

    let selectedTicketId = null;
    let currentTickets = [];

    async function loadTickets() {
      const filter = document.getElementById("ticketFilter").value;
      const list = document.getElementById("ticketList");
      list.innerHTML = '<p class="empty-state">Chargement des tickets...</p>';

      try {
        const token = await firebase.auth().currentUser.getIdToken();
        const res = await fetch(
          `${API_BASE_URL}/api/admin/support/tickets?status=${filter}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await res.json();

        if (!res.ok)
          throw new Error(data.error || "Impossible de charger les tickets.");

        currentTickets = data.tickets || [];

        if (!currentTickets.length) {
          list.innerHTML =
            '<p class="empty-state">Aucun ticket pour ce filtre.</p>';
          return;
        }

        list.innerHTML = currentTickets
          .map((ticket) => {
            const date = new Date(
              ticket.createdAt || Date.now(),
            ).toLocaleString("fr-FR");
            return `
            <button class="ticket-row ${ticket.id === selectedTicketId ? "active" : ""}" data-ticket-id="${ticket.id}">
              <span>
                <strong>${escapeHTML(ticket.type)}</strong>
                <small>${escapeHTML(ticket.username || ticket.robloxName || "Utilisateur")}</small>
              </span>
              <em>${ticket.status}</em>
              <small>${date}</small>
            </button>
          `;
          })
          .join("");
      } catch (err) {
        list.innerHTML = `<p class="empty-state error">${escapeHTML(err.message)}</p>`;
      }
    }

    function openTicket(ticketId) {
      selectedTicketId = ticketId;
      const ticket = currentTickets.find((item) => item.id === ticketId);
      const detail = document.getElementById("ticketDetail");

      if (!ticket) return;

      const replies = Object.values(ticket.replies || {});

      detail.innerHTML = `
      <div class="ticket-top">
        <div>
          <h3>${escapeHTML(ticket.type)}</h3>
          <p>${escapeHTML(ticket.username || "Utilisateur")} - ${escapeHTML(ticket.robloxName || "")}</p>
        </div>
        <span class="ticket-status">${ticket.status}</span>
      </div>
      <img src="../img/Refresh.png" alt="Rafraîchir" id="refreshTickets" title="Rafraîchir mes tickets" />

      <div class="ticket-message">
        ${escapeHTML(ticket.message)}
      </div>

      <div class="reply-list">
        ${
          replies.length
            ? replies
                .map(
                  (reply) => `
              <div class="reply ${reply.authorRole === "admin" ? "admin" : ""}">
                <strong>${reply.authorRole === "admin" ? "Admin" : "Utilisateur"}</strong>
                <p class="ticket-message-text">${escapeHTML(reply.message)}</p>
              </div>
            `,
                )
                .join("")
            : '<p class="empty-state">Aucune réponse pour le moment.</p>'
        }
      </div>

      <textarea id="replyMessage" placeholder="Réponse à envoyer..."></textarea>

      <div class="ticket-actions">
        <button class="btn" id="replyTicket">Répondre</button>
        <button class="btn secondary" id="pendingTicket">Mettre en attente</button>
        <button class="btn danger" id="closeTicket">Fermer</button>
        <button class="btn danger" id="deleteTicket">Supprimer</button>
      </div>
    `;

      document
        .getElementById("replyTicket")
        .addEventListener("click", replyTicket);
      document
        .getElementById("pendingTicket")
        .addEventListener("click", () => updateTicketStatus("pending"));
      document
        .getElementById("closeTicket")
        .addEventListener("click", () => updateTicketStatus("closed"));
      document
        .getElementById("deleteTicket")
        .addEventListener("click", deleteTicket);
      document.getElementById("refreshTickets").addEventListener("click", () => {
        document.getElementById("refreshTickets").classList.add("refresh-spin");
        loadTickets();
        openTicket(ticketId);
      });

      loadTickets();
    }

    async function deleteTicket() {
      if (!selectedTicketId) return;

      const confirmDelete = confirm("Supprimer définitivement ce ticket ?");
      if (!confirmDelete) return;

      try {
        const token = await firebase.auth().currentUser.getIdToken();

        const res = await fetch(
          `${API_BASE_URL}/api/admin/support/tickets/${selectedTicketId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || "Impossible de supprimer le ticket.");
        }

        selectedTicketId = null;
        document.getElementById("ticketDetail").innerHTML =
          '<p class="empty-state">Sélectionnez un ticket.</p>';

        await loadTickets();
      } catch (err) {
        alert(err.message);
      }
    }

    async function replyTicket() {
      const message = document.getElementById("replyMessage").value.trim();
      if (!selectedTicketId || !message) return;

      const token = await firebase.auth().currentUser.getIdToken();
      const res = await fetch(
        `${API_BASE_URL}/api/admin/support/tickets/${selectedTicketId}/reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message }),
        },
      );

      if (res.ok) {
        await loadTickets();
        openTicket(selectedTicketId);
      }
    }

    async function updateTicketStatus(status) {
      if (!selectedTicketId) return;

      const token = await firebase.auth().currentUser.getIdToken();
      const res = await fetch(
        `${API_BASE_URL}/api/admin/support/tickets/${selectedTicketId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        },
      );

      if (res.ok) {
        await loadTickets();
        openTicket(selectedTicketId);
      }
    }

    function escapeHTML(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    document
      .getElementById("ticketFilter")
      .addEventListener("change", loadTickets);
    document.getElementById("ticketList").addEventListener("click", (event) => {
      const row = event.target.closest("[data-ticket-id]");
      if (row) openTicket(row.dataset.ticketId);
    });

    loadTickets();

        async function loadMatches() {
      const snap = await db.ref("eventFootball2026/matches").get();
      const tbody = document.getElementById("football-matches-list");
      if (!tbody) return;
      tbody.innerHTML = "";

      if (!snap.exists()) {
        tbody.innerHTML = "<tr><td colspan='5'>Aucun match.</td></tr>";
        return;
      }

      const matches = snap.val();
      Object.entries(matches).forEach(([id, m]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${m.homeTeam} vs ${m.awayTeam}</td>
      <td>${new Date(m.date).toLocaleDateString("fr-FR")}</td>
      <td>${m.reward || 20} R$</td>
      <td>${m.result ? "✅ " + m.result : "⏳ En attente"}</td>
      <td class="actions">
        ${
          !m.result
            ? `
          <button class="btn football-result" data-match="${id}" data-home="${m.homeTeam}" data-away="${m.awayTeam}">Résultat</button>
        `
            : ""
        }
      </td>`;
        tbody.appendChild(tr);
      });
    }

    document
      .getElementById("football-create-match")
      ?.addEventListener("click", async () => {
        const home = document.getElementById("football-home").value.trim();
        const away = document.getElementById("football-away").value.trim();
        const date = document.getElementById("football-date").value;
        const reward =
          parseInt(document.getElementById("football-reward").value) || 20;

        if (!home || !away || !date) return alert("Remplissez tous les champs");

        try {
          const token = await firebase.auth().currentUser.getIdToken();
          const res = await fetch(
            `${API_BASE_URL}/api/admin/football2026/create-match`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                homeTeam: home,
                awayTeam: away,
                date,
                reward,
              }),
            },
          );
          const data = await res.json();
          if (!data.ok) throw new Error(data.error);
          alert("✅ Match créé !");
          ["football-home", "football-away", "football-date"].forEach(
            (id) => (document.getElementById(id).value = ""),
          );
          loadMatches();
        } catch (err) {
          alert("❌ " + err.message);
        }
      });

    document
      .getElementById("football-matches-list")
      ?.addEventListener("click", async (e) => {
        const btn = e.target.closest(".football-result");
        if (!btn) return;

        const matchId = btn.dataset.match;
        const home = btn.dataset.home;
        const away = btn.dataset.away;

        const choice = prompt(
          `Résultat du match ${home} vs ${away} ?\n\n"home" = ${home}\n"draw" = Nul\n"away" = ${away}`,
        );
        if (!["home", "draw", "away"].includes(choice))
          return alert("Valeur invalide. Tapez home, draw ou away.");

        try {
          const token = await firebase.auth().currentUser.getIdToken();
          const res = await fetch(
            `${API_BASE_URL}/api/admin/football2026/set-result`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ matchId, result: choice }),
            },
          );
          const data = await res.json();
          if (!data.ok) throw new Error(data.error);
          alert(
            `✅ Résultat enregistré ! ${data.winnersCount} gagnant(s) récompensé(s).`,
          );
          loadMatches();
        } catch (err) {
          alert("❌ " + err.message);
        }
      });

    document
      .getElementById("football-end-event")
      ?.addEventListener("click", async () => {
        const bonus = parseInt(
          prompt(
            "Montant du bonus pour chaque membre de l'équipe gagnante (en R$) :",
          ),
        );
        if (!bonus || isNaN(bonus) || bonus <= 0)
          return alert("Montant invalide");
        if (
          !confirm(
            `Distribuer ${bonus} R$ à tous les membres de l'équipe gagnante ? Cette action est irréversible.`,
          )
        )
          return;

        try {
          const token = await firebase.auth().currentUser.getIdToken();
          const res = await fetch(
            `${API_BASE_URL}/api/admin/football2026/end-event`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ bonusAmount: bonus }),
            },
          );
          const data = await res.json();
          if (!data.ok) throw new Error(data.error);
          alert(
            `🏆 Événement terminé ! Équipe gagnante : ${data.winner} — ${data.membersRewarded} membres récompensés.`,
          );
        } catch (err) {
          alert("❌ " + err.message);
        }
      });

    loadMatches();

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
      "section.card:nth-of-type(3) tbody",
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

    /* ===== STOCKS ===== */
    const stockInput = document.getElementById("Stockrestant");
    const stockBtn = document.querySelector(".EditStock");

    stockBtn?.addEventListener("click", async () => {
      const stockValue = Number(stockInput.value);
      if (isNaN(stockValue) || stockValue < 0 || stockInput.value === "") {
        stockInput.value = "";
        return alert("❌ Valeur invalide (0 ou plus)");
      }
      try {
        await adminAction("/admin/stock", { stock: stockValue });
        alert("✅ Stock mis à jour");
        stockInput.value = "";
      } catch (err) {
        alert("❌ " + err.message);
      }
    });

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
