document.addEventListener("DOMContentLoaded", async () => {
  const { auth, db } = await initFirebase();

  if (!db || !auth) {
    console.error("Firebase n'est pas initialisé !");
    return;
  }

  const gif = document.getElementById("loading");
  const saveBtn = document.getElementById("saveProfile");
  const warn = document.getElementById("warn");
  const confirmBtn = document.getElementById("Confirm");
  const msg = document.getElementById("profileMessage");
  const msg2 = document.getElementById("profileMessage2");
  const pseudoR = document.getElementById("pseudoR");

  function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min} min ${sec.toString().padStart(2, "0")} s`;
  }

  let pendingData = null;

  firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      console.log("Utilisateur non connecté");
      return;
    }

    const uid = user.uid;
    updateProfileInfo(uid);
  });
  const imgage = document.getElementById("roblox");
  async function setRobloxAvatar(robloxName) {
    pseudoR.textContent = `@${robloxName}`;
    try {
      const res = await fetch(`${API_BASE_URL}/api/avatar/${robloxName}`);
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
      setRobloxAvatar(data.RobloxName);
      document.getElementById("robuxGagnes").textContent =
        data.robuxGagnes ?? "0";
      document.getElementById("retraits").textContent = Object.keys(
        data.transactions || {},
      ).length;
      document.getElementById("balance").textContent = data.balance ?? "0";
      document.getElementById("statut").textContent =
        data.role ?? "Utilisateur";
      document.getElementById("nomRoblox").textContent = data.RobloxName ?? "—";
      document.getElementById("Username").textContent = data.username ?? "—";
      const date = data.createdAt
        ? new Date(data.createdAt).toLocaleDateString()
        : "—";
      document.getElementById("motdepasse").textContent = date;
      document.getElementById("nbConnexions").textContent =
        data.nbConnexions ?? "0";
    } catch (err) {
      console.error("Erreur mise à jour profil :", err);
    }
  }

  /* =========================
       ENREGISTRER PROFIL
    ========================== */
  saveBtn.addEventListener("click", async () => {
    msg.textContent = "";

    const user = auth.currentUser;
    if (!user) return showMsg(msg, "❌ Utilisateur non connecté");

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("email").value.trim();
    const robloxName = document.getElementById("Roblox").value.trim();

    if (!username || !password || !confirmPassword || !robloxName)
      return showMsg(msg, "❌ Informations manquantes");
    if (password !== confirmPassword)
      return showMsg(msg, "❌ Les mots de passe ne correspondent pas");
    if (password.length < 6) return showMsg(msg, "❌ Mot de passe trop court");

    /* Vérif pseudo Roblox via backend */
    try {
      const res = await fetch(`${API_BASE_URL}/api/roblox-user/${robloxName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: [robloxName],
          excludeBannedUsers: true,
        }),
      });
      const data = await res.json();
      if (!data?.data?.length)
        return showMsg(msg, "❌ Pseudo Roblox inexistant");

      pendingData = { username, password, robloxName };
      warn.style.display = "flex";
      requestAnimationFrame(() => warn.classList.add("active"));
    } catch (err) {
      console.error(err);
      showMsg(msg, "❌ Erreur inattendue");
    } finally {
      saveBtn.disabled = false;
    }
  });

  /* =========================
       CONFIRMATION (RÉAUTH)
    ========================== */
  // ✅ APRÈS — le serveur gère le timer, le client affiche juste l'erreur
  confirmBtn.addEventListener("click", async () => {
    confirmBtn.style.display = "none";
    gif.style.display = "flex";

    const user = auth.currentUser;
    const oldUsername = document.getElementById("a").value.trim();
    const oldPassword = document.getElementById("b").value.trim();

    if (!oldUsername || !oldPassword) {
      gif.style.display = "none";
      confirmBtn.style.display = "block";
      return showMsg(msg2, "❌ Informations manquantes");
    }

    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/update-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: pendingData.username,
          robloxName: pendingData.robloxName,
          newPassword: pendingData.password,
          oldUsername,
          oldPassword,
        }),
      });

      const data = await res.json();

      // ✅ Le serveur renvoie le temps restant si rate limit atteint
      if (res.status === 429) {
        gif.style.display = "none";
        confirmBtn.style.display = "block";
        return showMsg(
          msg2,
          `❌ Réessayez dans ${formatTime(data.retryAfter)}`,
        );
      }

      if (!res.ok) throw new Error(data.error || "Erreur backend");

      await firebase.auth().signInWithCustomToken(data.customToken);

      gif.style.display = "none";
      confirmBtn.style.display = "block";
      showMsg(msg, "✅ Profil mis à jour", true);

      ["username", "password", "email", "Roblox", "a", "b"].forEach(
        (id) => (document.getElementById(id).value = ""),
      );
      pendingData = null;
      warn.classList.remove("active");
      warn.addEventListener("transitionend", function handleEnd() {
        warn.style.display = "none";
        warn.removeEventListener("transitionend", handleEnd);
      });
    } catch (err) {
      gif.style.display = "none";
      confirmBtn.style.display = "block";
      console.error(err);
      showMsg(msg2, "❌ Erreur lors de la mise à jour");
    }
  });

  /* =========================
       Fonctions utilitaires
    ========================== */
  function showMsg(el, text, success = false) {
    el.textContent = text;
    el.style.color = success ? "#00ff6a" : "#ff5555";
    setTimeout(() => (el.textContent = ""), 3000);
  }
  /* ----- PROMOCODE ----- */
  // ✅ APRÈS — le client envoie juste le code, le serveur fait tout
  document.getElementById("applyPromo").addEventListener("click", async () => {
    const btn = document.getElementById("applyPromo");
    if (btn.disabled) return console.warn("Action en cours, veuillez patienter...");
    btn.disabled = true;

    const inputEl = document.getElementById("promoInput");
    const codeInput = inputEl.value.trim().toUpperCase();
    const msg = document.getElementById("promoMessage");
    const user = firebase.auth().currentUser;

    if (!codeInput || /[.#$\[\]]/.test(codeInput)) {
      btn.disabled = false;
      showMsg(msg, "❌ Code promo invalide.");
      return;
    }
    if (!user) {
      btn.disabled = false;
      showMsg(msg, "❌ Vous devez être connecté");
      return;
    }

    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/apply-promo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: codeInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        btn.disabled = false;
        return showMsg(msg, `❌ ${data.error}`);
      }

      inputEl.value = "";
      showMsg(msg, `✔️ +${data.amount} R$ ajouté !`, true);
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      showMsg(msg, "❌ Une erreur est survenue.");
    } finally {
      btn.disabled = false;
    }
  });

  const header = document.querySelector("header");

  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });
});
