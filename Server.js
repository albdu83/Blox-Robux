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
            let displayName = game.name;
            if (displayName.length > 15) {
                displayName = displayName.slice(0, 15) + "...";
            }

            const option = document.createElement("option");
            option.textContent = `${displayName}`;
            option.value = game.placeId;
            select.appendChild(option);
        });


        // Event listener (une seule fois)
        select.onchange = () => {
            console.log("Place sélectionnée :", select.value);
        };

    } catch (err) {
        console.error("Erreur lors de la récupération des places :", err);
    }
}
});




//async function getPrivateServers() {
    //try {
        //const res = await fetch(`${API_BASE_URL}/api/privateservers`);
        //if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);

        //const data = await res.json();

        //const container = document.getElementById("private-servers");
        //if (!container) return;

        //container.innerHTML = "";

        //if (!data.data || data.data.length === 0) {
            //container.textContent = "Aucun serveur privé disponible.";
            //return;
        //}

        // Utiliser un Set pour éviter les doublons sur le nom du serveur
        //const seenNames = new Set();

        //const div2 = document.createElement("option");
            //div2.textContent = "selectionner un serveur"
            //container.appendChild(div2);

        //data.data.forEach(server => {
            //if (seenNames.has(server.name)) return; // ignorer doublons
            //seenNames.add(server.name);
            //let serverName = server.name || "Nom inconnu";

            // Tronquer à 10 caractères si nécessaire
            //if (serverName.length > 10) {
                //serverName = serverName.slice(0, 10) + "...";
            //}
        //});

    //} catch (err) {
        //console.error("Erreur récupération serveurs privés :", err);
        //const container = document.getElementById("private-servers");
        //if (container) container.textContent = "Impossible de récupérer les serveurs privés ou cookie ROBLOSECURITY invalide.";
    //}
//}
