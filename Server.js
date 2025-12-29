const API_BASE_URL = location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://blox-robux.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  const auth = firebase.auth();
  const db = firebase.database();

  /* =======================
     AUTH STATE (SOURCE UNIQUE)
  ======================= */
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.log("Aucun utilisateur connecté");
      return;
    }

    if (user) {
        localStorage.setItem("connectedUser", user.uid);
    }

    const uid = user.uid;
    console.log("UID connecté :", uid);

    try {
      const snapshot = await db.ref("users/" + uid).get();
      if (!snapshot.exists()) {
        console.log("Utilisateur absent de la DB");
        return;
      }

      const { username, RobloxName } = snapshot.val();
      localStorage.setItem("robloxName", RobloxName);

      /* ===== PROFIL HEADER ===== */
      const lienprofil = document.getElementById("lien-profil");
      if (lienprofil) {
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

        btnConnexion.textContent = "Commencer";
        btnConnexion.href = "./Page de gain/gagner.html";

        btnInscription.onclick = () => {
          if (warn) warn.style.display = "flex";
        };
      }

    } catch (err) {
      console.error("Erreur chargement profil :", err);
    }
  });

  /* =======================
     INSCRIPTION
  ======================= */
  const formInscription = document.getElementById("form-inscription");
  if (formInscription) {
    formInscription.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirmPassword").value;
      const RobloxName = document.getElementById("RobloxName").value.trim();

      if (password !== confirmPassword) {
        alert("Les mots de passe ne correspondent pas ❌");
        return;
      }

      try {
        const email = `${username}@bloxrobux.local`;
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const uid = cred.user.uid;

        await db.ref("users/" + uid).set({
          username,
          RobloxName,
          balance: 0
        });

        alert("Compte créé avec succès ✅");
        window.location.href = "../Page de gain/gagner.html";

      } catch (err) {
        console.error(err);
        alert(err.message);
      }
    });
  }

  /* =======================
     CONNEXION
  ======================= */
  const formConnexion = document.getElementById("form-connexion");
  if (formConnexion) {
    formConnexion.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("loginUsername").value.trim();
      const password = document.getElementById("loginPassword").value;
      const email = `${username}@bloxrobux.local`;

      try {
        await auth.signInWithEmailAndPassword(email, password);
        alert("Connexion réussie ✅");
        window.location.href = "../Page de gain/gagner.html";

      } catch (err) {
        console.error(err);
        alert("Username ou mot de passe incorrect ❌");
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

  if (!Interface) return;

  Interface.classList.remove("tablet", "desktop")

  const width = window.innerWidth

  if (width >= 1200) {
    Interface.classList.add("desktop")
  } else if (width >= 768) {
    Interface.classList.add("tablet")
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
});
