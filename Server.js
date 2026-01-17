const API_BASE_URL = location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://blox-robux.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  const auth = firebase.auth();
  const db = firebase.database();

  /* =======================
     AUTH STATE (SOURCE UNIQUE)
  ======================= */
const btnprofil = document.getElementById("btn-profil")
const disco = document.getElementById("disconnect")
const body = document.getElementById("body")
if (btnprofil) btnprofil.style.display = "none";
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.log("Aucun utilisateur connecté");
      if (disco && body) {
        disco.style.display = "flex"
        body.innerHTML = ""
      }
      return;
    }
    await checkAndFixRobloxName(user);
    const uid = user.uid;
    console.log("UID connecté :", uid);

    try {
      const snapshot = await db.ref("users/" + uid).get();
      if (!snapshot.exists()) {
        await auth.signOut();
        return;
      }

      const data = snapshot.val();
      if (data.banned === true) {
        await auth.signOut();
        document.body.innerHTML = ""; // nettoie l’UI
        window.location.replace("../banned.html"); // plus sûr que href
        return;
      }

      if (user) {
        localStorage.setItem("connectedUser", uid);
      }

      const { username, RobloxName } = data;
      if (RobloxName) {
        localStorage.setItem("robloxName", RobloxName);
      }


      /* ===== PROFIL HEADER ===== */
      const lienprofil = document.getElementById("lien-profil");
      if (lienprofil) {
        lienprofil.href = "Page de profil/Profil.html"
        const span = lienprofil.querySelector("span");
        if (span) span.textContent = `${username} / ${RobloxName}`;
      }

      /* ===== AVATAR ROBLOX ===== */
      setRobloxAvatar(RobloxName);

      /* ===== TIMEWALL ===== */
      const container = document.getElementById("timewall-container");
      if (container) {
        container.innerHTML = "";
        const iframe = document.createElement("iframe");
        iframe.src = `https://timewall.io/users/login?oid=2578908b35321055&uid=${RobloxName}`;
        iframe.width = "100%";
        iframe.height = "1000";
        iframe.frameBorder = "0";
        container.appendChild(iframe);
      }

 
      const container2 = document.getElementById("theoremecontainer");
      if (container2) {
        container2.innerHTML = "";

        const transactionId =
          crypto.randomUUID?.() ||
          Date.now() + "_" + Math.random().toString(36).slice(2);

        const iframe2 = document.createElement("iframe");
        iframe2.src =
          "https://theoremreach.com/respondent_entry/direct" +
          "?api_key=36131d298e73a7a2bc9bc433de51" +
          "&user_id=" + encodeURIComponent(RobloxName) +
          "&transaction_id=" + transactionId;

          iframe2.width = "100%";
          iframe2.height = "1000";
          iframe2.frameBorder = "0";
          iframe2.allow = "accelerometer; gyroscope; magnetometer; camera; microphone";

        container2.appendChild(iframe2);
      }
      /* ===== BOUTONS ===== */
      const btnInscription = document.getElementById("btn-inscription");
      const btnConnexion = document.getElementById("btn-connexion");
      const warn = document.getElementById("warn");
      if (warn) warn.style.display = "none";

      if (btnInscription && btnConnexion) {
        btnInscription.textContent = "Déconnexion";
        btnInscription.removeAttribute("href");
        btnInscription.style.cursor = "pointer";
        btnprofil.style.display = "flex"
        btnprofil.textContent = "Profil"
        btnConnexion.textContent = "Commencer";
        btnConnexion.href = "./Page de gain/gagner.html";

        btnInscription.onclick = () => {
          if (warn) warn.style.display = "flex";
        };
      } else if (lienprofil) {
        lienprofil.href = "../Page de profil/Profil.html"
      }
    } catch (err) {
     if (err.message && err.message.includes("Permission denied")) {
      console.warn("Vous n'avez pas la permission d'accéder à vos données (banni)");
      await auth.signOut();
      document.body.innerHTML = "";
      window.location.replace("../Ban/Ban.html");
    } else {
      console.error("Erreur chargement profil :", err);
    }
  }
  });

  /* =======================
     INSCRIPTION
  ======================= */
const gif = document.getElementById("loading")
const inscription = document.getElementById("ininscription")
const formInscription = document.getElementById("form-inscription");
if (formInscription) {
  formInscription.addEventListener("submit", async (e) => {
    e.preventDefault();
      inscription.style.display = "none"
      gif.style.display = "block"

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirmPassword").value;
      const RobloxName = document.getElementById("RobloxName").value.trim();

      if (password !== confirmPassword) {
        gif.style.display = "none";
        inscription.style.display = "block";
        alert("Les mots de passe ne correspondent pas ❌");
        return;
      }

      const token = grecaptcha.getResponse();
      if (!token) {
        gif.style.display = "none";
        inscription.style.display = "block";
        alert("Veuillez cocher le CAPTCHA ❌");
        return;
      }

      try {
        const res2 = await fetch(`${API_BASE_URL}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username, password, captcha: token })
        });
      const data2 = await res2.json();

      if (!data2) {
        gif.style.display = "none";
        inscription.style.display = "block";
        alert(data2.error || "Erreur connexion ❌");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/roblox-user/${RobloxName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usernames: [RobloxName], excludeBannedUsers: true })
      });
      const data = await res.json();
      if (!data?.data?.length) return alert("Pseudo Roblox inexistant ❌");

      const email = `${username}@bloxrobux.local`;
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const uid = cred.user.uid;

      await db.ref("users/" + uid).set({
        email: email,
        username: username,
        firstUsername: username,
        RobloxName,
        balance: 0,
        createdAt: new Date().toISOString(),
        nbConnexions : 1,
        robuxGagnes : 0,
      });
      gif.style.display = "none";
      inscription.style.display = "block";
      alert("Compte créé avec succès ✅");
      window.location.href = "../Page de gain/gagner.html";

    } catch (err) {
      gif.style.display = "none";
      inscription.style.display = "block";
      console.error(err);
      alert(err.message);
    }
  });
}

  /* =======================
     CONNEXION
  ======================= */
const formConnexion = document.getElementById("form-connexion");
const connexion = document.getElementById("inconnexion")
if (formConnexion) {
  formConnexion.addEventListener("submit", async (e) => {
    e.preventDefault();
    connexion.style.display = "none"
    gif.style.display = "block"
    const inputUsername = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!inputUsername || !password) {
      gif.style.display = "none";
      connexion.style.display = "block";
      alert("Veuillez remplir tous les champs ❌");
      return;
    }

    const token = grecaptcha.getResponse();
    if (!token) {
      gif.style.display = "none";
      connexion.style.display = "block";
      alert("Veuillez cocher le CAPTCHA ❌");
      return;
    }

    try {

      const res2 = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inputUsername, password, captcha: token })
      });
      const data2 = await res2.json();

      if (!data2) {
        gif.style.display = "none";
        connexion.style.display = "block";
        alert(data2.error || "Erreur connexion ❌");
        return;
      }

      // 1️⃣ Récupérer l'email via le backend
      const res = await fetch(`${API_BASE_URL}/getEmail?username=${encodeURIComponent(inputUsername)}`);
      if (!res.ok) {
        const errData = await res.json();
        gif.style.display = "none";
        connexion.style.display = "block";
        alert(errData.error || "Utilisateur introuvable ❌");
        return;
      }
      const data = await res.json();
      const email = data.email;

      if (!email) {
        gif.style.display = "none";
        connexion.style.display = "block";
        alert("Erreur lors de la connexion ❌");
        return;
      }

      // 2️⃣ Se connecter avec Firebase Auth côté front
      const cred = await auth.signInWithEmailAndPassword(email, password);

      // Maintenant on a accès à uid
      const uid = cred.user.uid;

      const snapshot = await db.ref("users/" + uid + "/nbConnexions").get();
      const currentConnexions = snapshot.exists() ? snapshot.val() : 1;

      await db.ref("users/" + uid + "/nbConnexions").set(currentConnexions + 1);

      connexion.style.display = "block";
      gif.style.display = "none";
      alert("Connexion réussie ✅");
      window.location.href = "../Page de gain/gagner.html";

    } catch (err) {
      gif.style.display = "none";
      connexion.style.display = "block";
      console.error("Erreur connexion :", err);
      alert("Username ou mot de passe incorrect ❌");
    }
  });
}
  /* =======================
        MENU DEPLOYING
  ======================= */

const barres = document.getElementById("barres")
const navigation = document.getElementById("navigation")
const navpanel = document.getElementById("nav-panel")
const barres2 = document.getElementById("barres2")

if (barres) {
  barres.addEventListener("click", () => {
  navigation.classList.toggle("active");
  navpanel.classList.toggle("active");
  barres.classList.toggle("rotated");
});
}

if (barres2) {
  barres2.addEventListener("click", () => {
    navigation.classList.remove("active");
    navpanel.classList.remove("active");
    barres.classList.remove("rotated");
  });
}

if (navigation) {
navigation.addEventListener("click", (e) => {
  if (e.target === navigation) {
    navigation.classList.remove("active");
    navpanel.classList.remove("active");
    barres.classList.remove("rotated");
  }
});
}

  /* =======================
        TOGGLE PASSWORD
  ======================= */
function togglePasswordImage(imgId, inputId) {
  const img = document.getElementById(imgId);
  const input = document.getElementById(inputId);

  if (img && input) {
    img.addEventListener("click", () => {
      if (input.type === "password") {
        input.type = "text";
        img.src = "../img/checked.png"; // optionnel : changer l'image
      } else {
        input.type = "password";
        img.src = "../img/unchecked.png";
      }
    });
  }
}

// Appel pour chaque input
togglePasswordImage("checkimg", "loginPassword");
togglePasswordImage("checkimg2", "password");
togglePasswordImage("checkimg3", "confirmPassword");


  document.addEventListener("click", (e) => {
    // Vérifie si on clique sur l'image ou sur le texte
    if (!e.target.classList.contains("copy-img") && !e.target.classList.contains("copy-id")) return;

    const parent = e.target.closest(".copy-id");
    if (!parent) return;

    const idToCopy = parent.dataset.copy;
    if (!idToCopy) return;
    const originalHTML = parent.innerHTML;

    navigator.clipboard.writeText(idToCopy)
        .then(() => {
            // Remplace tout le contenu par "Copié ✅"
            parent.innerHTML = "Copié ✅";

            setTimeout(() => {
                // Remet le contenu original après 1,2 seconde
                parent.innerHTML = originalHTML;
            }, 1200);
        })
        .catch(() => alert("Impossible de copier"));
});

  /* =======================
   AVATAR ROBLOX
======================= */
async function setRobloxAvatar(robloxName) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/avatar/${robloxName}`);
    const data = await res.json();

    const img = document.getElementById("avatar-roblox");
    if (data.targetId) { 
        console.log("UserId récupéré :", data.targetId) 
        getPublicsPlaces(data.targetId.toString()) 
    }
    if (!img) return;

    img.src = data.avatarUrl || "img/default-avatar.png";
    img.style.display = "inline-block";

  } catch (err) {
    console.error("Erreur avatar :", err);
  }
}

async function getRobloxUserId(username) {
    const response = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
    });
    const data = await response.json();
    if (data.data && data.data.length > 0) {
        return data.data[0].id;
    } else {
        throw new Error("Utilisateur Roblox introuvable");
    }
}
const rootIdMap = {};
async function getPublicsPlaces(targetId) {
    if (!targetId) return;

    try {
        const select = document.getElementById("public-places");
        if (!select) return;

        // Vider le select avant
        select.innerHTML = "";

        // Option par défaut
        const defaultOption = document.createElement("option");
        defaultOption.textContent = "Sélectionner un jeu";
        defaultOption.value = ""; // important
        defaultOption.disabled = true;
        defaultOption.selected = true;
        select.appendChild(defaultOption);

        // Récupérer les places
        const res = await fetch(`${API_BASE_URL}/api/places?targetId=${targetId}`);
        const data = await res.json();

        if (!data?.data?.length) {
            const option = document.createElement("option");
            option.textContent = "Aucun emplacement public trouvé";
            option.disabled = true;
            select.appendChild(option);
            return;
        }

        // Ajouter les options
        data.data.forEach(game => {
          rootIdMap[game.ID] = game.RootID;
          let gameID = game.ID
            let displayName = game.name;
            if (displayName.length > 15) {
                displayName = displayName.slice(0, 15) + "...";
            }

            const option = document.createElement("option");
            option.textContent = `${displayName}`;
            option.value = gameID;
            select.appendChild(option);
        });
        let variable = false
        select.onchange = () => {
          const Interface = document.querySelector(".Interface")
          const explain = document.getElementById("explain")
          const HELP = document.getElementById("HELP")
          const tutocontainer = document.getElementById("tutocontainer")
          const paragraphe = document.getElementById("paragraphe")
          const href = document.getElementById("href")
          const href2 = document.getElementById("href2")
          if (!href) return;
          if (!href2) return;
          href.href = `https://create.roblox.com/dashboard/creations/experiences/${select.value}/access`;
          href2.href = `https://create.roblox.com/dashboard/creations/experiences/${select.value}/experience-questionnaire`;
          if (!paragraphe) return;
          if (variable === true) {
            tutocontainer.style.position = "relative"
            tutocontainer.classList.remove("active10")
            tutocontainer.addEventListener("transitionend", () => {
              href.href = `https://create.roblox.com/dashboard/creations/experiences/${select.value}/access`
              href2.href = `https://create.roblox.com/dashboard/creations/experiences/${select.value}/experience-questionnaire`;
              tutocontainer.classList.add("active10")
            }, { once: true })
          };
          Interface.classList.add("active9")
          explain.classList.add("active6")
          HELP.classList.add("active7")
          if (variable === false) {
            href.href = `https://create.roblox.com/dashboard/creations/experiences/${select.value}/access`
            href2.href = `https://create.roblox.com/dashboard/creations/experiences/${select.value}/experience-questionnaire`;
          }
          variable = true
          explain.addEventListener("transitionend", () => {
            tutocontainer.classList.add("active10")
            HELP.classList.add("activeA")
            explain.classList.add("activeB")
          }, { once: true })
        };
    } catch (err) {
        console.error("Erreur lors de la récupération des places :", err);
    }
}
function updateInterfaceSize() {
  const Interface = document.querySelector(".Interface")
  const logoimg = document.getElementById("logoimg")
  if (!Interface) return;

  Interface.classList.remove("tablet", "desktop")

  const width = window.innerWidth

  if (width >= 1200) {
    Interface.classList.add("desktop")
  } else if (width >= 768) {
    Interface.classList.add("tablet")
  } else if (logoimg) {
    logoimg.style.display = "none"
  }
}

window.addEventListener("resize", updateInterfaceSize)
updateInterfaceSize()

const btn = document.getElementById("buttonretrait");
const select = document.getElementById("public-places");

if (!btn || !select) return;

btn.addEventListener("click", async () => {
  const selectedGameID = select.value;
  const rootID = rootIdMap[selectedGameID]
  console.log("selectedGameID:", selectedGameID, "rootID:", rootID);
  if (!rootID) return alert("Place introuvable !");

  if (!selectedGameID) return alert("Sélectionne un jeu");

  const pseudo = localStorage.getItem("robloxName");
  const amountEl = document.getElementById("amount");
  const amount = parseFloat(amountEl.value);

  if (!pseudo || !amount) {
    return alert("Utilisateur ou montant invalide");
  }

  // 1️⃣ Vérifier le solde
  const balanceRes = await fetch(`${API_BASE_URL}/api/getBalance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: pseudo })
  });

  const balanceData = await balanceRes.json();

  if (balanceData.robux < amount) {
    return alert(`Solde insuffisant (${balanceData.robux} R$)`);
  }

  // 2️⃣ Payer le serveur privé
  const payRes = await fetch(`${API_BASE_URL}/api/payServer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: pseudo,
      gameId: rootID,
      amount
    })
  });

  const payData = await payRes.json();

  if (payData.status === 200) {
    alert("✅ Serveur privé payé avec succès !");
  } else {
    alert(payData.error || "❌ Erreur lors du paiement");
  }
});
async function checkAndFixRobloxName(user) {
    if (!user) return;

    const uid = user.uid;
    const snapshot = await firebase.database().ref(`users/${uid}/RobloxName`).get();
    const robloxName = snapshot.val();

    // Vérifier via backend
    const res = await fetch(`${API_BASE_URL}/api/roblox-user/${robloxName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [robloxName], excludeBannedUsers: true })
    });
    const data = await res.json();

    if (!data?.data?.length) {
        // Pseudo invalide → afficher modal
        showRobloxWarning("Le pseudo entré lors de votre inscription sur notre site est invalide ! Merci de bien vouloir mettre un pseudo Roblox valide pour poursuivre vos fonctions sur notre site.", async (newName, overlay) => {
            // Vérifier le nouveau pseudo
            const resCheck = await fetch(`${API_BASE_URL}/api/roblox-user/${newName}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usernames: [newName], excludeBannedUsers: true })
            });
            const dataCheck = await resCheck.json();
            if (!dataCheck?.data?.length) return alert("Pseudo invalide, essayez un autre !");

            // Mettre à jour Firebase
            await firebase.database().ref(`users/${uid}/RobloxName`).set(newName);
            alert("Pseudo Roblox mis à jour ✅");

            // Fermer le modal
            document.body.removeChild(overlay);
            window.location.reload();
        });
    }
}


function showRobloxWarning(message, callback) {
    // Crée le fond modal
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.background = "rgba(0,0,0,0.6)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";

    // Crée le conteneur du modal
    const modal = document.createElement("div");
    modal.style.background = "#222";
    modal.style.padding = "20px";
    modal.style.borderRadius = "10px";
    modal.style.width = "300px";
    modal.style.textAlign = "center";
    modal.style.color = "#fff";
    overlay.appendChild(modal);
    // Erreur
    const errorMsg = document.createElement("p");
    errorMsg.style.color = "#ff5555";
    errorMsg.style.fontSize = "0.9rem";
    modal.appendChild(errorMsg);
    // Message
    const msg = document.createElement("p");
    msg.textContent = message;
    modal.appendChild(msg);

    // Input pseudo
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Nouveau pseudo Roblox";
    input.style.width = "90%";
    input.style.margin = "10px 0";
    input.style.padding = "8px";
    input.style.borderRadius = "5px";
    input.style.border = "1px solid #555";
    modal.appendChild(input);

    // Boutons container
    const btnContainer = document.createElement("div");
    btnContainer.style.display = "flex";
    btnContainer.style.justifyContent = "space-around";
    modal.appendChild(btnContainer);

    // Bouton Valider
    const validateBtn = document.createElement("button");
    validateBtn.textContent = "Valider";
    validateBtn.style.padding = "8px 12px";
    validateBtn.style.borderRadius = "5px";
    validateBtn.style.border = "none";
    validateBtn.style.cursor = "pointer";
    validateBtn.style.background = "#00ff6a";
    validateBtn.style.color = "#000";
    btnContainer.appendChild(validateBtn);

    document.body.appendChild(overlay);

    // Event Valider
    validateBtn.onclick = async () => {
        const newName = input.value.trim();
        if (!newName) return alert("Veuillez entrer un pseudo Roblox valide !");
        callback(newName, overlay); // renvoie le pseudo au callback pour traitement
    };
}
});
